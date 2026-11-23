import type { FullConfig } from '@playwright/test';
import { buildSite, siteBuildProperties } from './sites.ts';

/** The environment variable that gives the workers the built site's assembly. */
export const SITE_ASSEMBLY_VARIABLE = 'FORMULATE_E2E_SITE_ASSEMBLY';

/**
 * Builds the dev site once, before the workers start, so that each worker only starts a site of its own from the
 * build (see fixtures/site.ts). The workers inherit the built assembly's path through FORMULATE_E2E_SITE_ASSEMBLY.
 */
export default function globalSetup(config: FullConfig) {
	const siteVersion = process.env.UMBRACO_SITE_VERSION;
	const packageVersion = process.env.FORMULATE_PACKAGE_VERSION;
	const started = Date.now();
	const on = [siteVersion ? `Umbraco ${siteVersion}` : '', packageVersion ? `the Formulate ${packageVersion} packages` : '']
		.filter(Boolean)
		.join(' and ');

	console.log(`Building the dev site${on ? ` on ${on}` : ''}.`);
	process.env[SITE_ASSEMBLY_VARIABLE] = buildSite({
		dotnet: process.env.DOTNET_EXE || 'dotnet',
		properties: siteBuildProperties({ siteVersion, packageVersion }),
	});
	console.log(
		`Built it in ${Math.round((Date.now() - started) / 1000)} s. Each worker starts a site of its own, with up to ${config.workers} at once.`,
	);
}
