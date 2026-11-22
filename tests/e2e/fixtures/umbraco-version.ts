import type { Page } from '@playwright/test';
import { callManagementApi } from './management-api.ts';

/** The version of Umbraco the site runs, such as { major: 17, minor: 6 } for 17.6.2. */
export async function getUmbracoVersion(page: Page): Promise<{ major: number; minor: number }> {
	const server = await callManagementApi<{ version: string }>(page, 'GET', '/server/information');
	const [major, minor] = server.version.split('.').map((part) => Number.parseInt(part, 10));

	return { major: major!, minor: minor! };
}

/** Whether the site runs Umbraco 17.7 or later (17.6 differs from it in the two ways named below). */
export function isUmbraco177OrLater(version: { major: number; minor: number }): boolean {
	return version.major > 17 || version.minor >= 7;
}

/**
 * How many children a tree item shows before "Load more". Core's tree item children manager asks for
 * 50 in Umbraco 17.6 (tree-item-children.manager, `#takeSize = 50`) and for 100 from 17.7 on.
 */
export function treePageSize(version: { major: number; minor: number }): number {
	return isUmbraco177OrLater(version) ? 100 : 50;
}

/**
 * The end of the URL a tree root opens. Umbraco 17.6 links a root to `.../workspace/<root type>/edit/null`
 * (tree item `constructPath` fills the missing unique with "null"; its own Data Types root does the same),
 * and its default workspace shows at that URL. From 17.7 the root links to the bare workspace path.
 */
export function rootWorkspaceUrlEnd(version: { major: number; minor: number }): string {
	return isUmbraco177OrLater(version) ? '' : '/edit/null';
}
