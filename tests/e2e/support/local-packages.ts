import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, readBuildProperty } from './repo.ts';

/** The packages one pack makes: one per packable project in src. */
export const PACKAGE_IDS = [
	'Umbraco.Community.Formulate',
	'Umbraco.Community.Formulate.BackOffice',
	'Umbraco.Community.Formulate.Core',
	'Umbraco.Community.Formulate.Extensions.PlainJavaScriptTemplate',
	'Umbraco.Community.Formulate.Extensions.SendData',
	'Umbraco.Community.Formulate.Extensions.SendEmail',
	'Umbraco.Community.Formulate.Extensions.StoreData',
	'Umbraco.Community.Formulate.Web',
];

/** Where packs go. The dev site's FormulateFromPackages mode reads them from here. */
export const PACKAGES_FOLDER = join(REPO_ROOT, 'artifacts', 'packages');

/**
 * The version for a local pack: the version in src/Directory.Build.props with a prerelease label of its own.
 * NuGet keeps the first copy of a version it extracts, so a new pack that reused a version would never be
 * used. A clean checkout gives 5.0.0-local.g<commit>. Uncommitted changes or new files add the time (UTC),
 * as in 5.0.0-local.g1a2b3c4.20261122093000. The "g" (as in "git describe") keeps the label from being a
 * number, which could start with a zero that SemVer does not allow.
 * @param options.versionPrefix The version in src/Directory.Build.props, such as 5.0.0.
 * @param options.commit The short hash of the checked out commit.
 * @param options.dirty Whether the checkout has changes or new files that are not committed.
 * @param options.now The time of the pack.
 */
export function localPackageVersion(options: { versionPrefix: string; commit: string; dirty: boolean; now: Date }): string {
	if (!/^[0-9a-f]{4,40}$/.test(options.commit)) {
		throw new Error(`"${options.commit}" is not a commit hash.`);
	}

	const version = `${options.versionPrefix}-local.g${options.commit}`;

	if (!options.dirty) {
		return version;
	}

	// 2026-11-22T09:30:00.000Z becomes 20261122093000.
	const time = options.now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

	return `${version}.${time}`;
}

/**
 * What is wrong with a run's FORMULATE_PACKAGE_VERSION, if anything. Without one, the site runs the source
 * projects, which CI must never do: it tests what is shipped. A version goes into the site's start command, so it
 * may hold only what a version can. And it needs a prerelease label, as localPackageVersion and CI's pack job give:
 * NuGet keeps the first copy of a version it extracts, so a run on a release version such as 5.0.0 could get an
 * old pack of that version and never see a new one.
 * @param version FORMULATE_PACKAGE_VERSION, if set.
 * @param options.ci Whether this is a CI run (CI is set).
 * @returns What is wrong, or undefined if nothing is.
 */
export function packageVersionProblem(version: string | undefined, options: { ci: boolean }): string | undefined {
	if (!version) {
		return options.ci
			? 'CI runs the browser tests on the packed packages, but FORMULATE_PACKAGE_VERSION is not set, so the ' +
					'site would run the source projects.'
			: undefined;
	}

	if (!/^[0-9A-Za-z.-]+$/.test(version)) {
		return `FORMULATE_PACKAGE_VERSION "${version}" is not a package version.`;
	}

	if (!/^\d+\.\d+\.\d+-[0-9A-Za-z][0-9A-Za-z.-]*$/.test(version)) {
		return (
			`FORMULATE_PACKAGE_VERSION ${version} has no prerelease label, such as 5.0.0-local.g1a2b3c4. Every ` +
			'pack needs a version of its own, or an old pack with the same version could be used instead. Pack one ' +
			'with "npm run pack:local".'
		);
	}

	return undefined;
}

/** The file a pack writes for one package, in artifacts/packages. */
export function packageFile(id: string, version: string): string {
	return join(PACKAGES_FOLDER, `${id}.${version}.nupkg`);
}

/** The packages of a version that are missing from artifacts/packages (none once it is packed). */
export function missingPackages(version: string): Array<string> {
	return PACKAGE_IDS.filter((id) => !existsSync(packageFile(id, version)));
}

/**
 * Packs every Formulate package into artifacts/packages with a version of its own (see localPackageVersion),
 * with the dotnet on the PATH (the .NET 10 SDK, as CI packs).
 * @returns The version.
 */
export function packLocal(): string {
	const git = (...args: Array<string>) => execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8' }).trim();
	const version = localPackageVersion({
		versionPrefix: readBuildProperty('VersionPrefix'),
		commit: git('rev-parse', '--short', 'HEAD'),
		dirty: git('status', '--porcelain') !== '',
		now: new Date(),
	});

	console.log(`Packing Formulate ${version} into ${PACKAGES_FOLDER}.`);

	const pack = spawnSync(
		'dotnet',
		['pack', join(REPO_ROOT, 'src', 'Formulate.sln'), '-c', 'Release', `-p:Version=${version}`, '-o', PACKAGES_FOLDER],
		{
			stdio: 'inherit',
			env: {
				...process.env,
				DOTNET_CLI_TELEMETRY_OPTOUT: '1',
				// Leave no MSBuild or compiler server running after the pack.
				MSBUILDDISABLENODEREUSE: '1',
				UseSharedCompilation: 'false',
			},
		},
	);

	if (pack.status !== 0) {
		throw new Error(`dotnet pack failed (${pack.error?.message ?? `exit code ${pack.status}`}).`);
	}

	const missing = missingPackages(version);

	if (missing.length > 0) {
		throw new Error(`The pack made no ${missing.join(', ')} ${version} package.`);
	}

	return version;
}
