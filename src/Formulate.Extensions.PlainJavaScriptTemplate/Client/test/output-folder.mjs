// File helpers for the build tests that check what the build leaves in its output folder. The tests are type
// checked without Node's types, so these are JavaScript, with their types in output-folder.d.mts.
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The client folder. */
export const clientFolder = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A path in a folder, from a path with forward slashes. */
export function pathIn(root, path) {
  return join(root, ...path.split("/"));
}

/** The SHA-256 of a text or of bytes, in hex. */
export function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

/** Every file in a folder and below it, by its path with forward slashes, with the hash of its bytes. */
export function snapshot(root) {
  const result = {};
  for (const name of readdirSync(root, { recursive: true, encoding: "utf8" }).sort()) {
    const path = join(root, name);
    if (statSync(path).isFile()) {
      result[name.split(sep).join("/")] = hash(readFileSync(path));
    }
  }
  return result;
}

/** Writes a file into a folder (a path with forward slashes), with the folders it needs. */
export function put(root, path, text) {
  const target = pathIn(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

/** Whether there is a file or folder at the path. */
export function exists(path) {
  return existsSync(path);
}

/** A file's text. */
export function readText(path) {
  return readFileSync(path, "utf8");
}

/** Adds paths to a build's record of the files it wrote, as if that build had written them too. */
export function addToRecord(recordFile, paths) {
  const record = JSON.parse(readFileSync(recordFile, "utf8"));
  record.files.push(...paths);
  writeFileSync(recordFile, JSON.stringify(record));
}

/** Writes a file's text, at a full path. */
export function writeText(path, text) {
  writeFileSync(path, text);
}

/** Makes a link to a folder, unless there is already something at the path. */
export function linkFolder(target, path) {
  try {
    lstatSync(path);
    return;
  } catch {
    // Nothing there yet.
  }
  mkdirSync(dirname(path), { recursive: true });
  // A junction is a link to a folder that Windows makes without special rights. Elsewhere the type is ignored.
  symlinkSync(target, path, "junction");
}

/** Lets files be added to and taken out of a folder, or stops it (for every user but an administrator). */
export function setWritable(folder, writable) {
  chmodSync(folder, writable ? 0o755 : 0o555);
}

/** A new, empty folder in the system's temporary folder. */
export function newTempFolder() {
  return mkdtempSync(join(tmpdir(), "formulate-build-test-"));
}
