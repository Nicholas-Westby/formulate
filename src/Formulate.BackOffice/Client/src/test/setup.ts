// Tests load Lit's development build, which reports problems such as class fields that shadow
// reactive properties. Keep those reports, but mark the one-time "Lit is in dev mode" notice as
// already shown, so the test output stays clean.
const lit = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
(lit.litIssuedWarnings ??= new Set()).add('dev-mode');

// jsdom's ElementInternals has none of the form methods that Umbraco UI's form controls (such as
// uui-button) call each time they render. Give them versions that do nothing, so those elements can
// render in tests.
const internals = globalThis.ElementInternals?.prototype;
if (internals && !('setValidity' in internals)) {
	Object.assign(internals, {
		setFormValue() {},
		setValidity() {},
		checkValidity: () => true,
		reportValidity: () => true,
	});
}
