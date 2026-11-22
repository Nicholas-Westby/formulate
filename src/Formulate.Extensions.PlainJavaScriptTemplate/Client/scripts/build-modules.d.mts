// The types of build-modules.mjs, for the tests that run the build.

/** A file the build wrote. */
export interface BuiltFile {
  /** Its path in the output folder, with forward slashes, such as "fields/plain-text.min.js". */
  path: string;
  text: string;
}

/** What the build wrote. */
export interface BuiltModules {
  /** The output folder (an absolute path). */
  outDir: string;
  /** The package version, which the entry exposes. */
  version: string;
  /** Every file it wrote, sorted by path. */
  files: BuiltFile[];
  /** The minified modules, as modules.json lists them: the entry first. */
  modules: string[];
  /** The record of the files this build wrote into the folder (an absolute path, in .build/written). */
  recordFile: string;
  /** The files the last build into the folder wrote that this one does not make, which it removed, sorted. */
  removed: string[];
}

export interface BuildModulesOptions {
  /** Where the modules go, relative to the client folder. */
  outDir?: string;
  /** Where TypeScript writes its output first, relative to the client folder. */
  stagingDir?: string;
  /**
   * The file that records what the build wrote into the output folder, relative to the client folder. Default: one
   * for the output folder in .build/written.
   */
  recordFile?: string;
}

/** How each module is minified (the options of Vite's minifySync). */
export declare const minifyOptions: { module: boolean; compress: boolean; mangle: { toplevel: boolean } };

/** Builds the modules and returns what it wrote. */
export declare function buildModules(options?: BuildModulesOptions): BuiltModules;
