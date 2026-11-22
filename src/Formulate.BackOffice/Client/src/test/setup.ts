// Tests load Lit's development build, which reports problems such as class fields that shadow
// reactive properties. Keep those reports, but mark the one-time "Lit is in dev mode" notice as
// already shown, so the test output stays clean.
const lit = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
(lit.litIssuedWarnings ??= new Set()).add('dev-mode');

// jsdom's ElementInternals has none of the form methods that Umbraco UI's form controls (such as
// uui-button) call each time they render. Give them versions that keep the validity a control sets, as
// browsers do, so those elements can render and report their validation messages in tests.
const internals = globalThis.ElementInternals?.prototype;
if (internals && !('setValidity' in internals)) {
	const validities = new WeakMap<object, { valid: boolean; message: string }>();
	const isValid = (internals: object) => validities.get(internals)?.valid ?? true;

	Object.assign(internals, {
		setFormValue() {},
		setValidity(this: object, flags: Record<string, boolean | undefined> = {}, message = '') {
			const valid = !Object.entries(flags).some(([flag, set]) => flag !== 'valid' && set);
			validities.set(this, { valid, message: valid ? '' : (message ?? '') });
		},
		checkValidity(this: object) {
			return isValid(this);
		},
		reportValidity(this: object) {
			return isValid(this);
		},
	});
	Object.defineProperty(internals, 'validationMessage', {
		configurable: true,
		get(this: object) {
			return validities.get(this)?.message ?? '';
		},
	});
}
