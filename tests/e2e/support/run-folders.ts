import { lstatSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

/** The start of the name of every run folder: formulate-e2e-<time the run started>. */
export const RUN_FOLDER_PREFIX = 'formulate-e2e-';

/** How long a run folder is kept after its last change. Far longer than any run takes. */
const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Removes the run folders that earlier runs left in the temp folder once they have not changed for a
 * day (nothing else clears them on Windows). Only real folders directly inside the temp folder whose
 * names start with the prefix are removed: never a symbolic link or what it points to, and never the
 * current run's folder. A folder that cannot be removed now, such as one Windows still has open, is
 * left for a later run.
 * @param tempFolder The system's temp folder.
 * @param options.now The current time, in milliseconds.
 * @param options.keep The current run's folder.
 */
export function removeOldRunFolders(tempFolder: string, options: { now: number; keep: string }) {
	let folder: string;
	let names: Array<string>;

	try {
		folder = realpathSync(tempFolder);
		names = readdirSync(folder);
	} catch {
		return;
	}

	for (const name of names) {
		if (!name.startsWith(RUN_FOLDER_PREFIX) || name === basename(options.keep)) {
			continue;
		}

		const path = join(folder, name);

		try {
			// lstat looks at the entry itself, so a symbolic link is never followed.
			const entry = lstatSync(path);
			const lastChange = Math.max(entry.mtimeMs, entry.ctimeMs);

			if (entry.isDirectory() && options.now - lastChange > MAX_AGE) {
				rmSync(path, { recursive: true });
			}
		} catch {
			// Gone already, or still in use: a later run tries again.
		}
	}
}
