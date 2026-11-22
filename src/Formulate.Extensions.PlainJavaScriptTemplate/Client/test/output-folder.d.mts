// The types of output-folder.mjs, the build tests' file helpers.

/** The client folder. */
export declare const clientFolder: string;

/** A path in a folder, from a path with forward slashes. */
export declare function pathIn(root: string, path: string): string;

/** The SHA-256 of a text, in hex. */
export declare function hash(content: string): string;

/** Every file in a folder and below it, by its path with forward slashes, with the hash of its bytes. */
export declare function snapshot(root: string): Record<string, string>;

/** Writes a file into a folder (a path with forward slashes), with the folders it needs. */
export declare function put(root: string, path: string, text: string): void;

/** Whether there is a file or folder at the path. */
export declare function exists(path: string): boolean;

/** A file's text. */
export declare function readText(path: string): string;

/** Adds paths to a build's record of the files it wrote, as if that build had written them too. */
export declare function addToRecord(recordFile: string, paths: string[]): void;

/** Writes a file's text, at a full path. */
export declare function writeText(path: string, text: string): void;

/** Makes a link to a folder, unless there is already something at the path. */
export declare function linkFolder(target: string, path: string): void;

/** Lets files be added to and taken out of a folder, or stops it (for every user but an administrator). */
export declare function setWritable(folder: string, writable: boolean): void;

/** A new, empty folder in the system's temporary folder. */
export declare function newTempFolder(): string;
