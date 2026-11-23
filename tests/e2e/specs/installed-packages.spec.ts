import { expect, test } from '../fixtures/login.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { screenshotPath } from '../support/screenshots.ts';

/** A package manifest (an umbraco-package.json), as GET /manifest/manifest gives it. */
interface PackageManifest {
	name: string;
}

/** The migration plans of one package name, as GET /package/migration-status gives them. */
interface PackageMigrationStatus {
	packageName: string;
	hasPendingMigrations: boolean;
}

/** Whether a package name is Formulate's, or names a part of it. */
function isFormulate(name: string) {
	return /formulate/i.test(name);
}

test("Umbraco's list of installed packages shows Formulate once, with its migrations run", async ({ page }) => {
	await page.goto('/umbraco/section/packages/view/installed');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();

	// Packages, Installed shows each package manifest, and then each migration status whose name no
	// manifest has, as a package of its own. Umbraco gives one status for each package name of the
	// migration plans, so Store Data's plan must give the package name of Formulate's manifest too.
	const [manifests, statuses] = await Promise.all([
		callManagementApi<Array<PackageManifest>>(page, 'GET', '/manifest/manifest'),
		callManagementApi<{ items: Array<PackageMigrationStatus> }>(page, 'GET', '/package/migration-status?skip=0&take=100'),
	]);

	expect(manifests.map((manifest) => manifest.name).filter(isFormulate)).toEqual(['Formulate']);
	// The site ran both of Formulate's plans, its own and Store Data's, when it started.
	expect(statuses.items.filter((status) => isFormulate(status.packageName))).toEqual([
		{ packageName: 'Formulate', hasPendingMigrations: false },
	]);

	await expect(page.locator('umb-installed-packages-section-view-item uui-ref-node-package[name="Formulate"]')).toHaveCount(1);
	await page.screenshot({ path: screenshotPath('installed-packages.png') });
});
