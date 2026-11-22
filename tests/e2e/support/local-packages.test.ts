import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localPackageVersion, packageVersionProblem } from './local-packages.ts';

const NOW = new Date('2026-11-22T09:30:05.123Z');

test('a clean checkout packs the version with the commit', () => {
	const version = localPackageVersion({ versionPrefix: '5.0.0', commit: '7dd0d289', dirty: false, now: NOW });

	assert.equal(version, '5.0.0-local.g7dd0d289');
});

test('changes that are not committed add the time, so every pack of them differs', () => {
	const first = localPackageVersion({ versionPrefix: '5.0.0', commit: '7dd0d289', dirty: true, now: NOW });
	const second = localPackageVersion({
		versionPrefix: '5.0.0',
		commit: '7dd0d289',
		dirty: true,
		now: new Date(NOW.getTime() + 1000),
	});

	assert.equal(first, '5.0.0-local.g7dd0d289.20261122093005');
	assert.equal(second, '5.0.0-local.g7dd0d289.20261122093006');
});

test('a commit hash made of digits still gives a label that is not a number', () => {
	// SemVer does not allow a number label with a leading zero, such as 0123456.
	const version = localPackageVersion({ versionPrefix: '5.0.0', commit: '0123456', dirty: false, now: NOW });

	assert.equal(version, '5.0.0-local.g0123456');
});

test('refuses something that is not a commit hash', () => {
	assert.throws(
		() => localPackageVersion({ versionPrefix: '5.0.0', commit: 'HEAD; rm', dirty: false, now: NOW }),
		/not a commit hash/,
	);
});

test('a run on the packs takes a version with a prerelease label', () => {
	const versions = ['5.0.0-local.g7dd0d289', '5.0.0-local.g7dd0d289.20261122093005', '5.0.0-ci.42.1', '5.0.0-rc.1'];

	for (const version of versions) {
		assert.equal(packageVersionProblem(version, { ci: true }), undefined, version);
	}
});

test('every version a local pack gets is one a run takes', () => {
	for (const dirty of [false, true]) {
		const version = localPackageVersion({ versionPrefix: '5.0.0', commit: '7dd0d289', dirty, now: NOW });

		assert.equal(packageVersionProblem(version, { ci: true }), undefined, version);
	}
});

test('refuses a release version, which an old pack with the same version could stand in for', () => {
	assert.match(packageVersionProblem('5.0.0', { ci: false }) ?? '', /no prerelease label/);
	assert.match(packageVersionProblem('5.0.0-', { ci: false }) ?? '', /no prerelease label/);
});

test('refuses what is not a version, since it goes into the start command', () => {
	for (const version of ['5.0.0 -p:FormulateFromPackages=false', '5.0.0-a;b']) {
		assert.match(packageVersionProblem(version, { ci: false }) ?? '', /not a package version/, version);
	}
});

test('CI never runs the browser tests on the source projects', () => {
	assert.match(packageVersionProblem(undefined, { ci: true }) ?? '', /FORMULATE_PACKAGE_VERSION is not set/);
	assert.match(packageVersionProblem('', { ci: true }) ?? '', /FORMULATE_PACKAGE_VERSION is not set/);
});

test('a local run without a version runs the source projects', () => {
	assert.equal(packageVersionProblem(undefined, { ci: false }), undefined);
});
