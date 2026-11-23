import type { Page } from '@playwright/test';
import { callManagementApi } from './management-api.ts';

/** The version of Umbraco the site runs, such as { major: 18, minor: 0 } for 18.0.0. */
export interface UmbracoVersion {
	major: number;
	minor: number;
}

/** Asks the site which version of Umbraco it runs. */
export async function getUmbracoVersion(page: Page): Promise<UmbracoVersion> {
	const server = await callManagementApi<{ version: string }>(page, 'GET', '/server/information');
	const [major, minor] = server.version.split('.').map((part) => Number.parseInt(part, 10));

	return { major: major!, minor: minor! };
}

/**
 * Whether the site runs an Umbraco 18 older than 18.<minor>. Umbraco 18.0 came out before 17.6, so its back
 * office lacks some of what 17.8, the oldest supported 17, has. Each of those came to Umbraco 18 in a later minor.
 */
function isUmbraco18Before(version: UmbracoVersion, minor: number): boolean {
	return version.major === 18 && version.minor < minor;
}

/**
 * Whether the back office has what Umbraco 18.1 (and 17.6) added to trees: a page for a tree's root or folder that
 * lists what is in it, with a Create button above the list, and a move dialog with its own title, button label and
 * open folders. In Umbraco 18.0 the page of a root or folder shows no list, and the move dialog is the plain tree
 * picker, with a Choose button.
 */
export function hasTreePages(version: UmbracoVersion): boolean {
	return !isUmbraco18Before(version, 1);
}

/** The label of the move dialog's button (see hasTreePages). */
export function moveButtonLabel(version: UmbracoVersion): string {
	return hasTreePages(version) ? 'Move' : 'Choose';
}

/**
 * How many children a tree item shows before "Load more". Core's tree item children manager asks for 50 before
 * Umbraco 18.2 (tree-item-children.manager, `#takeSize = 50`), and for 100 from 18.2 on and in 17.8.
 */
export function treePageSize(version: UmbracoVersion): number {
	return isUmbraco18Before(version, 2) ? 50 : 100;
}

/**
 * The end of the URL a tree root opens. Before Umbraco 18.3, a root links to `.../workspace/<root type>/edit/null`
 * (the tree item's `constructPath` fills the missing unique with "null"), and its workspace shows at that URL.
 * From 18.3 on, and in 17.8, the root links to the bare workspace path.
 */
export function rootWorkspaceUrlEnd(version: UmbracoVersion): string {
	return isUmbraco18Before(version, 3) ? '/edit/null' : '';
}
