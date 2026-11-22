import { join } from 'node:path';
import { readBuildProperty } from './repo.ts';

/** The Umbraco version the run tests: UMBRACO_SITE_VERSION, or the dev site's default. */
export const SITE_VERSION = process.env.UMBRACO_SITE_VERSION || readBuildProperty('UmbracoSiteVersion');

/**
 * Where a test saves a screenshot: tests/e2e/screenshots/<Umbraco version>/<name>, so each version's
 * screenshots can be compared. The folder is not committed.
 * @param name The file name, such as section.png.
 */
export function screenshotPath(name: string): string {
	return join(import.meta.dirname, '..', 'screenshots', SITE_VERSION, name);
}
