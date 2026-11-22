// Tests load Lit's development build, which reports problems such as class fields that shadow
// reactive properties. Keep those reports, but mark the one-time "Lit is in dev mode" notice as
// already shown, so the test output stays clean.
const lit = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
(lit.litIssuedWarnings ??= new Set()).add('dev-mode');
