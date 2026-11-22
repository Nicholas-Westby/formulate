import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The repository's root folder. */
export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

/**
 * Reads a property's default from src/Directory.Build.props, such as VersionPrefix (5.0.0) or
 * UmbracoSiteVersion (17.8.2). Only for plain values written on one line.
 * @param name The property's name.
 */
export function readBuildProperty(name: string): string {
	const props = readFileSync(join(REPO_ROOT, 'src', 'Directory.Build.props'), 'utf8');
	const match = new RegExp(`<${name}(?:\\s[^>]*)?>([^<]+)</${name}>`).exec(props);

	if (!match) {
		throw new Error(`src/Directory.Build.props has no <${name}> value.`);
	}

	return match[1]!.trim();
}
