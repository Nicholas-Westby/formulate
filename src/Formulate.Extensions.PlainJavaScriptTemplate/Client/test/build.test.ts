/// <reference types="vite/client" />
import { minifySync, parseSync } from "vite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { buildModules, minifyOptions, type BuiltFile, type BuiltModules } from "../scripts/build-modules.mjs";
import { addPlaceholder, fieldByLabel, loadFixture, resetPage } from "./helpers";
import {
  addToRecord,
  clientFolder,
  exists,
  hash,
  linkFolder,
  newTempFolder,
  pathIn,
  put,
  readText,
  setWritable,
  snapshot,
  writeText,
} from "./output-folder.mjs";

// The sources, read as text, so the build can be compared with them.
const sourceFiles = import.meta.glob<string>("../src/**/*.ts", { query: "?raw", import: "default", eager: true });

/** The source modules, as paths in src without the extension (such as "fields/plain-text"), and their text. */
const sources = new Map(
  Object.entries(sourceFiles)
    .filter(([path]) => !path.endsWith(".d.ts"))
    .map(([path, text]) => [path.replace(/^\.\.\/src\//, "").replace(/\.ts$/, ""), text]),
);

/** Modules that hold nothing but types: they get a .d.ts and no JavaScript. */
const typeOnlyModules = ["types"];

/** The output name of a source module: the entry, src/index.ts, is formulate.js. */
function outputName(sourceModule: string): string {
  return sourceModule === "index" ? "formulate" : sourceModule;
}

// The test build goes into a folder of its own, which only the tests use (paths are from the client folder).
const outDir = ".build/test/modules";
const stagingDir = ".build/test/tsc";

let built: BuiltModules;
let files: Map<string, BuiltFile>;

beforeAll(() => {
  built = buildModules({ outDir, stagingDir });
  files = new Map(built.files.map((file) => [file.path, file]));
}, 60_000);

function text(path: string): string {
  const file = files.get(path);
  if (!file) {
    throw new Error(`The build did not write ${path}.`);
  }
  return file.text;
}

/** The specifiers of a module's static imports and re-exports, and whether it has any dynamic import. */
function moduleRequests(path: string, code: string): { specifiers: string[]; dynamic: boolean } {
  const { module, errors } = parseSync(path, code);
  expect(errors, path).toEqual([]);
  const specifiers = [
    ...module.staticImports.map((x) => x.moduleRequest.value),
    ...module.staticExports.flatMap((x) => x.entries.map((entry) => entry.moduleRequest?.value ?? null)),
  ].filter((x): x is string => x !== null);
  return { specifiers: [...new Set(specifiers)].sort(), dynamic: module.dynamicImports.length > 0 };
}

/** The names a module exports ("default" for its default export). */
function exportNames(path: string, code: string): string[] {
  const { module } = parseSync(path, code);
  return module.staticExports
    .flatMap((x) => x.entries)
    .filter((entry) => !entry.isType)
    .map((entry) => (entry.exportName.kind === "Default" ? "default" : (entry.exportName.name ?? "*")))
    .sort();
}

/** The names a module declares at its top level (functions, classes and variables). */
function topLevelNames(path: string, code: string): string[] {
  const { program } = parseSync(path, code);
  const names: string[] = [];
  for (const statement of program.body as unknown as Array<Record<string, unknown>>) {
    const declaration = (statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement) as Record<string, unknown> | null;
    if (!declaration) {
      continue;
    }
    if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") {
      const id = declaration.id as { name: string } | null;
      if (id) {
        names.push(id.name);
      }
    } else if (declaration.type === "VariableDeclaration") {
      for (const declarator of declaration.declarations as Array<{ id: { type: string; name?: string } }>) {
        if (declarator.id.type === "Identifier" && declarator.id.name) {
          names.push(declarator.id.name);
        }
      }
    }
  }
  return names.sort();
}

/** Resolves a relative specifier against the folder of the module that holds it. */
function resolveSpecifier(fromPath: string, specifier: string): string {
  return new URL(specifier, `file:///${fromPath}`).pathname.slice(1);
}

const runtimeModules = () => [...sources.keys()].filter((x) => !typeOnlyModules.includes(x)).sort();

describe("the module build", () => {
  it("writes one readable file and one minified file per source module, in the same folders", () => {
    const expected = runtimeModules().flatMap((x) => [`${outputName(x)}.js`, `${outputName(x)}.min.js`]);
    const written = built.files.map((x) => x.path).filter((x) => x.endsWith(".js"));

    expect(written.sort()).toEqual(expected.sort());
    // A module of types only gets its declarations and no script.
    for (const typeOnly of typeOnlyModules) {
      expect(files.has(`${typeOnly}.js`)).toBe(false);
      expect(files.has(`${typeOnly}.d.ts`)).toBe(true);
    }
  });

  it("writes type declarations for both names, and nothing else but the module list", () => {
    for (const sourceModule of runtimeModules()) {
      const name = outputName(sourceModule);
      const baseName = name.split("/").pop();
      expect(files.has(`${name}.d.ts`), `${name}.d.ts`).toBe(true);
      // The minified file's declarations are the readable file's.
      const hasDefault = exportNames(`${name}.js`, text(`${name}.js`)).includes("default");
      expect(text(`${name}.min.d.ts`)).toBe(
        `export * from "./${baseName}.js";\n${hasDefault ? `export { default } from "./${baseName}.js";\n` : ""}`,
      );
    }
    const allowed = /^(?:(?:fields|steps|utils|validators)\/)?[a-z]+(?:-[a-z]+)*(?:\.min)?\.(?:js|d\.ts)$/;
    for (const file of built.files) {
      if (file.path !== "modules.json") {
        // No source maps, and no hashed or renamed files.
        expect(file.path, file.path).toMatch(allowed);
      }
    }
    expect(built.files.filter((x) => x.path.endsWith(".map"))).toEqual([]);
  });

  it("keeps the readable files readable, with their doc comments, and minifies the others", () => {
    const field = text("utils/field.js");
    expect(field).toContain("* The base class of the built-in field renderers.");
    expect(field.split("\n").length).toBeGreaterThan(100);
    for (const file of built.files.filter((x) => x.path.endsWith(".min.js"))) {
      const readable = text(file.path.replace(/\.min\.js$/, ".js"));
      expect(file.text.length, file.path).toBeLessThan(readable.length);
      expect(file.text, file.path).not.toMatch(/\/\*\*|^\s*\/\//m);
    }
  });

  it("makes the minified files import only minified files, and the readable files only readable ones", () => {
    for (const file of built.files.filter((x) => x.path.endsWith(".js"))) {
      const minified = file.path.endsWith(".min.js");
      const { specifiers, dynamic } = moduleRequests(file.path, file.text);
      expect(dynamic, `${file.path} has no dynamic import`).toBe(false);
      for (const specifier of specifiers) {
        // Relative, to a file the build wrote, of the same kind.
        expect(specifier, file.path).toMatch(/^\.\.?\//);
        expect(specifier.endsWith(".min.js"), `${file.path} imports ${specifier}`).toBe(minified);
        expect(files.has(resolveSpecifier(file.path, specifier)), `${file.path} imports ${specifier}`).toBe(true);
      }
    }
  });

  it("keeps each module's code in its own file", () => {
    for (const sourceModule of runtimeModules()) {
      const name = outputName(sourceModule);
      const readable = text(`${name}.js`);
      const minified = text(`${name}.min.js`);
      // The same exports, the same imports (each of its own kind), and no declarations of other modules.
      expect(exportNames(`${name}.min.js`, minified), name).toEqual(exportNames(`${name}.js`, readable));
      expect(moduleRequests(`${name}.min.js`, minified).specifiers, name).toEqual(
        moduleRequests(`${name}.js`, readable).specifiers.map((x) => x.replace(/\.js$/, ".min.js")),
      );
      const declared = topLevelNames(`${sourceModule}.ts`, sources.get(sourceModule) ?? "");
      for (const declaredName of topLevelNames(`${name}.js`, readable)) {
        expect(declared, `${name}.js declares ${declaredName}`).toContain(declaredName);
      }
    }
  });

  it("lists every minified module, the entry first, all reached from the entry", () => {
    const list = JSON.parse(text("modules.json")) as string[];
    const minifiedFiles = built.files.map((x) => x.path).filter((x) => x.endsWith(".min.js"));

    expect(list[0]).toBe("formulate.min.js");
    expect([...list].sort()).toEqual(minifiedFiles.sort());
    expect(built.modules).toEqual(list);

    // Every module is imported, directly or not, by the entry.
    const reached = new Set<string>();
    const queue = ["formulate.min.js"];
    while (queue.length > 0) {
      const path = queue.shift() ?? "";
      if (!reached.has(path)) {
        reached.add(path);
        queue.push(...moduleRequests(path, text(path)).specifiers.map((x) => resolveSpecifier(path, x)));
      }
    }
    expect([...reached].sort()).toEqual([...list].sort());
  });

  it("puts the package version in the entry", () => {
    expect(text("formulate.js")).toContain(`version: ${JSON.stringify(packageJson.version)}`);
    for (const file of built.files) {
      expect(file.text, file.path).not.toContain("__FORMULATE_VERSION__");
    }
  });

  it("minifies each module on its own, from its readable twin", () => {
    // Each minified file is its readable twin, with the imports pointing at the minified files, minified alone:
    // nothing from another module gets into it.
    for (const sourceModule of runtimeModules()) {
      const name = outputName(sourceModule);
      const readable = text(`${name}.js`).replace(/((?:from|import)\s*)"(\.\.?\/[^"]+)\.js"/g, '$1"$2.min.js"');
      const alone = minifySync(`${name}.min.js`, readable, minifyOptions);
      expect(alone.errors, name).toEqual([]);
      expect(text(`${name}.min.js`), name).toBe(alone.code);
    }
  });
});

describe("the output folder", () => {
  // Each test builds into a folder of its own (paths from the client folder), so they do not see each other's files.
  const folder = (name: string) => `.build/test/${name}/modules`;

  it("removes the files an earlier build wrote that this build does not make", () => {
    const first = buildModules({ outDir: folder("stale"), stagingDir });
    // The files of a module that an earlier build made, such as one renamed since.
    const stale = ["old-module.js", "old-module.min.js", "old-module.d.ts", "old-module.min.d.ts", "fields/old-field.min.js"];
    for (const path of stale) {
      put(first.outDir, path, "export {};\n");
    }
    addToRecord(first.recordFile, stale);

    const second = buildModules({ outDir: folder("stale"), stagingDir });

    for (const path of stale) {
      expect(exists(pathIn(second.outDir, path)), `${path} is still in the folder`).toBe(false);
    }
    expect(second.removed).toEqual([...stale].sort());
    expect(Object.keys(snapshot(second.outDir)).sort()).toEqual(second.files.map((x) => x.path).sort());
  }, 60_000);

  it("keeps every file it did not write, such as the themes, and anything outside its folder", () => {
    const outDir = pathIn(clientFolder, folder("kept"));
    const theirs: Record<string, string> = {
      "themes/basic.css": ".formulate__form {}\n",
      "themes/basic.min.css": ".formulate__form{}",
      "site/custom.js": "console.log('the site');\n",
      "notes.txt": "Not the build's.\n",
      "extra.min.js": "export {};\n",
    };
    for (const [path, text] of Object.entries(theirs)) {
      put(outDir, path, text);
    }
    const outside = pathIn(clientFolder, ".build/test/kept/outside.js");
    put(clientFolder, ".build/test/kept/outside.js", "export {};\n");
    const first = buildModules({ outDir: folder("kept"), stagingDir });
    // A record that names things the build never wrote: paths out of the folder, an absolute path, a theme and a
    // folder. None of them may go.
    addToRecord(first.recordFile, ["../outside.js", outside, "site/../../outside.js", "themes/basic.css", "site"]);

    const second = buildModules({ outDir: folder("kept"), stagingDir });

    expect(second.removed).toEqual([]);
    for (const [path, text] of Object.entries(theirs)) {
      expect(readText(pathIn(outDir, path)), path).toBe(text);
    }
    expect(exists(outside)).toBe(true);
  }, 60_000);

  it("removes nothing through a folder that is a link, such as one that leads out of the output folder", () => {
    const outDir = pathIn(clientFolder, folder("linked"));
    const outside = pathIn(clientFolder, ".build/test/linked/outside");
    if (exists(outside)) {
      setWritable(outside, true);
    }
    put(outside, "kept.js", "export {};\n");
    linkFolder(outside, pathIn(outDir, "linked"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // While the builds run, no file can be taken out of the folder outside, so a build that followed the link
    // fails instead of removing the file.
    setWritable(outside, false);
    let second: BuiltModules;
    try {
      const first = buildModules({ outDir: folder("linked"), stagingDir });
      // As if an earlier build had written linked/kept.js, which is outside/kept.js through the link.
      addToRecord(first.recordFile, ["linked/kept.js"]);
      second = buildModules({ outDir: folder("linked"), stagingDir });
    } finally {
      setWritable(outside, true);
    }

    expect(second.removed).toEqual([]);
    expect(exists(pathIn(outside, "kept.js"))).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("linked/kept.js"));
  }, 60_000);

  // A record it cannot use: the build removes nothing, and builds as usual.
  it("removes nothing when its record is not JSON, and says so", () => {
    const first = buildModules({ outDir: folder("corrupt"), stagingDir });
    put(first.outDir, "old-module.js", "export {};\n");
    writeText(first.recordFile, `{ "outDir": "${folder("corrupt")}", "files": ["old-module.js"`);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const second = buildModules({ outDir: folder("corrupt"), stagingDir });

    expect(second.removed).toEqual([]);
    expect(exists(pathIn(second.outDir, "old-module.js"))).toBe(true);
    expect(readText(pathIn(second.outDir, "formulate.min.js"))).toBe(text("formulate.min.js"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("could not be read"));
  }, 60_000);

  it("removes nothing when its record is for another output folder", () => {
    const first = buildModules({ outDir: folder("other"), stagingDir });
    put(first.outDir, "old-module.js", "export {};\n");
    writeText(first.recordFile, JSON.stringify({ outDir: folder("elsewhere"), files: ["old-module.js"] }));

    const second = buildModules({ outDir: folder("other"), stagingDir });

    expect(second.removed).toEqual([]);
    expect(exists(pathIn(second.outDir, "old-module.js"))).toBe(true);
    expect(readText(pathIn(second.outDir, "formulate.min.js"))).toBe(text("formulate.min.js"));
  }, 60_000);

  it("removes nothing on a first build, which has no record", () => {
    // The folder has a file that an older build left, and the record goes in a new folder, so there is none yet.
    const outDir = pathIn(clientFolder, folder("first"));
    put(outDir, "old-module.min.js", "export {};\n");
    const recordFile = pathIn(newTempFolder(), "written.json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const first = buildModules({ outDir: folder("first"), stagingDir, recordFile });

    expect(first.removed).toEqual([]);
    expect(exists(pathIn(outDir, "old-module.min.js"))).toBe(true);
    expect(readText(pathIn(outDir, "formulate.min.js"))).toBe(text("formulate.min.js"));
    expect(first.recordFile).toBe(recordFile);
    expect(JSON.parse(readText(recordFile)).files).toEqual(first.files.map((x) => x.path));
    expect(warn).not.toHaveBeenCalled();
  }, 60_000);

  it("writes the same bytes each time it builds", () => {
    const first = buildModules({ outDir: folder("twice"), stagingDir });
    const before = { files: snapshot(first.outDir), record: readText(first.recordFile) };

    const second = buildModules({ outDir: folder("twice"), stagingDir });

    expect({ files: snapshot(second.outDir), record: readText(second.recordFile) }).toEqual(before);
    expect(second.removed).toEqual([]);
    // And the same as the build the other tests read, which went into another folder.
    expect(before.files).toEqual(Object.fromEntries(built.files.map((x) => [x.path, hash(x.text)])));
  }, 60_000);
});

describe("the built modules", () => {
  beforeAll(resetPage);

  it("render a form from the minified entry", async () => {
    const form = loadFixture("contact");
    const wrapper = addPlaceholder(form);
    window["formulate-plain-js-forms"] = [form];

    const entry = `../${outDir}/formulate.min.js`;
    await import(/* @vite-ignore */ entry);

    expect(window.formulatePlainJs?.version).toBe(packageJson.version);
    expect(wrapper.querySelectorAll("form.formulate__form")).toHaveLength(1);
    expect(fieldByLabel(wrapper, "Your Name").classList).toContain("formulate__field--text");
  });
});
