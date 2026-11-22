// Builds the renderer as ES modules, one file for each module in src, in the same folders:
//
// - name.js: the module compiled by TypeScript (tsconfig.build.json), with its comments, not minified;
// - name.min.js: the same module, minified on its own. These are the files Formulate loads;
// - name.d.ts: its type declarations, and name.min.d.ts, which re-exports them for the minified file.
//
// The readable files import each other (./name.js) and the minified files import each other (./name.min.js), so
// each set works on its own. The entry, src/index.ts, becomes formulate.js and formulate.min.js. A module with
// nothing but types (src/types.ts) only gets its .d.ts. There are no source maps: the readable file is the
// minified file's cross-reference.
//
// modules.json lists every minified module, the entry first and then in the order the entry imports them, so
// the Razor view can write a <link rel="modulepreload"> for each.
//
// Usage: node scripts/build-modules.mjs [--out-dir <folder>] [--staging-dir <folder>]
//
//   --out-dir      Where the modules go. Default: ../wwwroot/App_Plugins/Formulate/PlainJavaScript, beside the
//                  themes, which "npm run build:theme" writes.
//   --staging-dir  Where TypeScript writes its output first. Default: .build/tsc. Only the files that this run of
//                  TypeScript lists are used, so older files there do no harm.
//
// Folders are relative to the client folder.
//
// The build records the files it writes into a folder (in .build/written, never in the output folder, which is
// served and packed). Before it writes, it removes each file the last build into that folder recorded and this
// build does not make, such as the files of a renamed module. It removes those by their own paths, inside the
// output folder only, and never anything it did not write: the themes, which "npm run build:theme" writes, and any
// other file stay. It removes nothing through a folder that is a link.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { minifySync, parseSync } from "vite";

const client = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = "../wwwroot/App_Plugins/Formulate/PlainJavaScript";
const defaultStagingDir = ".build/tsc";

/** The source module that is the entry, and the name of the files it becomes. */
const entrySource = "index";
const entryName = "formulate";

/** Replaced by the package version, as a string. */
const versionIdentifier = "__FORMULATE_VERSION__";

/** How each module is minified: as a module, with the names it does not export shortened. */
export const minifyOptions = { module: true, compress: true, mangle: { toplevel: true } };

/**
 * Builds the modules and returns what it wrote.
 * @param {{ outDir?: string, stagingDir?: string, recordFile?: string }} [options] Folders and the record's file,
 * relative to the client folder. The record's file defaults to one for the output folder in .build/written.
 */
export function buildModules(options = {}) {
  const outDir = resolve(client, options.outDir ?? defaultOutDir);
  const stagingDir = resolve(client, options.stagingDir ?? defaultStagingDir);
  const version = JSON.parse(readFileSync(join(client, "package.json"), "utf8")).version;

  const emitted = compile(stagingDir);
  const modules = new Map();
  const typeDeclarations = [];

  for (const file of emitted) {
    const path = toModulePath(relative(stagingDir, file));
    if (path.endsWith(".d.ts")) {
      typeDeclarations.push({ path: renameEntry(path), text: readFileSync(file, "utf8") });
    } else if (path.endsWith(".js")) {
      const module = readModule(path, readFileSync(file, "utf8"), version);
      if (module) {
        modules.set(module.path, module);
      }
    }
  }

  const files = [];
  for (const module of modules.values()) {
    checkImports(module, modules);
    const minifiedPath = toMinifiedPath(module.path);
    files.push({ path: module.path, text: module.text });
    files.push({ path: minifiedPath, text: minify(minifiedPath, module) });
    files.push({ path: minifiedPath.replace(/\.js$/, ".d.ts"), text: minifiedTypeDeclarations(module) });
  }
  for (const declaration of typeDeclarations) {
    files.push(declaration);
  }

  const list = listModules(modules);
  files.push({ path: "modules.json", text: `${JSON.stringify(list, null, 2)}\n` });

  // First the files the last build wrote that this one does not make are removed. Then the record lists every file
  // this build writes, before it writes them, so a build that stops part way still has a record of what it wrote.
  const recordFile = options.recordFile ? resolve(client, options.recordFile) : recordFileFor(outDir);
  const paths = new Set(files.map((file) => file.path));
  const removed = removeEarlierFiles(outDir, recordFile, paths);
  mkdirSync(dirname(recordFile), { recursive: true });
  writeFileSync(recordFile, `${JSON.stringify({ outDir: folderName(outDir), files: [...paths].sort() }, null, 2)}\n`);

  // modules.json is written last: MSBuild runs the build when a source is newer than it, so a build that fails
  // part way runs again.
  for (const file of files) {
    const target = join(outDir, ...file.path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.text);
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { outDir, version, files, modules: list, recordFile, removed };
}

/** The output folder, as the record names it: from the client folder, with forward slashes. */
function folderName(outDir) {
  return relative(client, outDir).split(sep).join("/") || ".";
}

/** Where the build records the files it wrote into a folder: one record for each output folder, in .build/written. */
function recordFileFor(outDir) {
  const name = folderName(outDir);
  const hash = createHash("sha256").update(name).digest("hex").slice(0, 12);
  return join(client, ".build", "written", `${posix.basename(name).replace(/[^A-Za-z0-9_.-]/g, "_")}-${hash}.json`);
}

/** The files the last build into the folder recorded: none when there is no record, or it is for another folder. */
function readRecord(recordFile, outDir) {
  let record;
  try {
    record = JSON.parse(readFileSync(recordFile, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`The record of the last build's files, ${recordFile}, could not be read, so no earlier files are removed.`);
    }
    return [];
  }
  if (record?.outDir !== folderName(outDir) || !Array.isArray(record.files)) {
    return [];
  }
  return record.files.filter((path) => typeof path === "string");
}

/**
 * Whether a recorded path names a file of the kind the build writes, inside the output folder: a module's .js or
 * .d.ts file, or modules.json. Not a theme, and nothing with "..", a root, a backslash or another kind of file.
 */
function isBuildFilePath(path) {
  const segments = path.split("/");
  return (
    segments.every((segment) => /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(segment)) &&
    segments[0] !== "themes" &&
    (path === "modules.json" || /\.(?:js|d\.ts)$/.test(path))
  );
}

/**
 * Removes the files the last build into this folder wrote that this build does not make, each by its own path.
 * It skips anything outside the folder, anything that is not a plain file (a folder or a link), files that are
 * already gone, and, with a warning, files with a link among the folders between the output folder and them.
 * Returns the paths it removed.
 */
function removeEarlierFiles(outDir, recordFile, paths) {
  const removed = [];
  let realOutDir = null;
  for (const path of readRecord(recordFile, outDir)) {
    if (paths.has(path) || !isBuildFilePath(path)) {
      continue;
    }
    const segments = path.split("/");
    const target = resolve(outDir, ...segments);
    const inside = relative(outDir, target);
    if (!inside || inside.startsWith("..") || isAbsolute(inside)) {
      continue;
    }
    let stats;
    let folder;
    try {
      stats = lstatSync(target);
      realOutDir ??= realpathSync(outDir);
      folder = realpathSync(dirname(target));
    } catch {
      continue;
    }
    if (!stats.isFile()) {
      continue;
    }
    // With every link resolved, the file's folder must be the folder its path names in the output folder. When
    // it is not, a folder on the way is a link, and the file may be outside the output folder.
    if (folder !== resolve(realOutDir, ...segments.slice(0, -1))) {
      console.warn(
        `The build did not remove ${path}, which the last build recorded, because a folder on its path is a link.`,
      );
      continue;
    }
    unlinkSync(target);
    removed.push(path);
  }
  return removed.sort();
}

/** Runs TypeScript and returns the files it wrote. */
function compile(stagingDir) {
  const require = createRequire(import.meta.url);
  const tsc = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
  const result = spawnSync(
    process.execPath,
    [tsc, "-p", "tsconfig.build.json", "--outDir", stagingDir, "--listEmittedFiles"],
    { cwd: client, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`TypeScript failed (exit code ${result.status}).\n${result.stdout}${result.stderr}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("TSFILE: "))
    .map((line) => resolve(line.slice("TSFILE: ".length).trim()));
}

/** A path inside the output folder, with forward slashes. */
function toModulePath(path) {
  if (isAbsolute(path) || path.startsWith("..")) {
    throw new Error(`TypeScript wrote ${path}, outside its output folder.`);
  }
  return path.split(sep).join("/");
}

/** The entry's files are named formulate.*, not index.*. */
function renameEntry(path) {
  return path.replace(new RegExp(`^${entrySource}(?=\\.)`), entryName);
}

function toMinifiedPath(path) {
  return path.replace(/\.js$/, ".min.js");
}

/**
 * Reads a module TypeScript wrote: its imports and exports, with the version put in. Returns null for a module
 * that has nothing but types, which TypeScript writes as an empty module.
 */
function readModule(emittedPath, code, version) {
  const path = renameEntry(emittedPath);
  const { program, module, errors } = parseSync(path, code);
  if (errors.length > 0) {
    throw new Error(`${path} could not be read: ${errors[0].message}`);
  }
  const isEmpty = program.body.every(
    (statement) =>
      statement.type === "ExportNamedDeclaration" &&
      !statement.declaration &&
      !statement.source &&
      statement.specifiers.length === 0,
  );
  if (isEmpty) {
    return null;
  }
  if (module.dynamicImports.length > 0) {
    throw new Error(`${path} has a dynamic import. The modules only import each other statically.`);
  }

  // Each import or re-export names another module by a relative path ending in .js.
  const requests = [
    ...module.staticImports.map((x) => x.moduleRequest),
    ...module.staticExports.flatMap((x) => x.entries.map((entry) => entry.moduleRequest)).filter(Boolean),
  ];
  const requestsByStart = new Map(requests.map((request) => [request.start, request]));
  for (const request of requestsByStart.values()) {
    if (code.slice(request.start + 1, request.end - 1) !== request.value) {
      throw new Error(`${path}: could not find the import of "${request.value}" in the code.`);
    }
  }

  const replacements = [...requestsByStart.values()].map((request) => ({
    start: request.start,
    end: request.end,
    minified: JSON.stringify(request.value.replace(/\.js$/, ".min.js")),
  }));
  const versionSpans = findIdentifiers(program, versionIdentifier);
  const text = replaceSpans(code, versionSpans.map((span) => ({ ...span, text: JSON.stringify(version) })));
  // The minified file starts from the readable text: its imports point at the minified files.
  const minifiedSource = replaceSpans(code, [
    ...versionSpans.map((span) => ({ ...span, text: JSON.stringify(version) })),
    ...replacements.map((x) => ({ start: x.start, end: x.end, text: x.minified })),
  ]);

  const hasDefaultExport = module.staticExports.some((x) =>
    x.entries.some((entry) => entry.exportName.kind === "Default"),
  );

  const specifiers = [...requestsByStart.values()].map((request) => request.value);
  return {
    path,
    text,
    minifiedSource,
    hasDefaultExport,
    specifiers,
    imports: specifiers.map((specifier) => posix.join(posix.dirname(path), specifier)),
  };
}

/**
 * Fails the build when a module imports something that is not one of the renderer's modules: every import is a
 * relative path to a .js file the build makes, so each set of files works on its own.
 */
function checkImports(module, modules) {
  module.specifiers.forEach((specifier, index) => {
    const imported = module.imports[index];
    if (!/^\.\.?\//.test(specifier) || !specifier.endsWith(".js") || imported.startsWith("..")) {
      throw new Error(`${module.path} imports "${specifier}". Modules import each other by relative paths ending in .js.`);
    }
    if (!modules.has(imported)) {
      throw new Error(
        `${module.path} imports "${specifier}", which is not one of the modules the build makes (import a module of types only with "import type").`,
      );
    }
  });
}

function minify(path, module) {
  const result = minifySync(path, module.minifiedSource, minifyOptions);
  if (result.errors.length > 0) {
    throw new Error(`${path} could not be minified: ${result.errors[0].message}`);
  }
  return result.code;
}

/** The minified file's declarations: the readable file's, re-exported. */
function minifiedTypeDeclarations(module) {
  const readable = `./${posix.basename(module.path)}`;
  const lines = [`export * from "${readable}";`];
  if (module.hasDefaultExport) {
    lines.push(`export { default } from "${readable}";`);
  }
  return `${lines.join("\n")}\n`;
}

/** Every minified module: the entry, then the modules in the order the entry reaches them, then any others. */
function listModules(modules) {
  const reached = [];
  const queue = [`${entryName}.js`];
  while (queue.length > 0) {
    const path = queue.shift();
    if (!reached.includes(path) && modules.has(path)) {
      reached.push(path);
      queue.push(...modules.get(path).imports);
    }
  }
  const others = [...modules.keys()].filter((path) => !reached.includes(path)).sort();
  return [...reached, ...others].map(toMinifiedPath);
}

/** The spans of every identifier with the name, found by walking the syntax tree. */
function findIdentifiers(node, name, spans = []) {
  if (Array.isArray(node)) {
    for (const child of node) {
      findIdentifiers(child, name, spans);
    }
  } else if (node && typeof node === "object") {
    if (node.type === "Identifier" && node.name === name) {
      spans.push({ start: node.start, end: node.end });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "parent" && value && typeof value === "object") {
        findIdentifiers(value, name, spans);
      }
    }
  }
  return spans;
}

/** Replaces spans of the code (which must not overlap) with new text. */
function replaceSpans(code, spans) {
  let result = code;
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, span.start) + span.text + result.slice(span.end);
  }
  return result;
}

/** The sizes of the minified modules, for the build's log. */
function summarize(result) {
  const minified = result.files.filter((x) => x.path.endsWith(".min.js"));
  const bytes = minified.reduce((total, x) => total + Buffer.byteLength(x.text), 0);
  const gzipped = minified.reduce((total, x) => total + gzipSync(x.text, { level: 9 }).length, 0);
  const folder = relative(client, result.outDir) || ".";
  const removed = result.removed.length > 0 ? ` Removed what an earlier build wrote and this one does not: ${result.removed.join(", ")}.` : "";
  return `Built ${minified.length} modules in ${folder}: ${(bytes / 1000).toFixed(1)} kB minified, ${(gzipped / 1000).toFixed(1)} kB gzipped file by file.${removed}`;
}

function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    const value = args[i + 1];
    if ((name === "--out-dir" || name === "--staging-dir") && value) {
      options[name === "--out-dir" ? "outDir" : "stagingDir"] = value;
      i++;
    } else {
      throw new Error(`Unknown argument ${name}. Usage: node scripts/build-modules.mjs [--out-dir <folder>] [--staging-dir <folder>]`);
    }
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(summarize(buildModules(parseArguments(process.argv.slice(2)))));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
