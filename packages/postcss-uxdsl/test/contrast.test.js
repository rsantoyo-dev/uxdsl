const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  contrastRatio,
  relativeLuminance,
  parseLiteralColor,
  resolveExpression,
  compositeOver,
  checkThemeContrast,
} = require('../dist/ds-runtime/contrast');
const { resolveTheme } = require('../dist/default-theme');

// MIG-B6-29 (FEAT-008), phase 2/4 — unit coverage for the contrast
// primitives, independent of any real theme. See
// base-theme-contrast.test.js for the gate run against the actual
// shipped theme in both modes.

test('contrastRatio: known, unambiguous WCAG boundary cases', () => {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  assert.equal(contrastRatio(white, black), 21); // the maximum possible ratio, exactly.
  assert.equal(contrastRatio(white, white), 1); // identical colors: the minimum possible ratio.
  assert.equal(contrastRatio(black, black), 1);
  assert.equal(contrastRatio(white, black), contrastRatio(black, white)); // order-independent.
});

test('contrastRatio: monotonic — a darker foreground on the same light background never lowers the ratio', () => {
  const bg = { r: 255, g: 255, b: 255 };
  const lighter = { r: 200, g: 200, b: 200 };
  const darker = { r: 100, g: 100, b: 100 };
  assert.ok(contrastRatio(darker, bg) > contrastRatio(lighter, bg));
});

test('relativeLuminance: pure white is the maximum (1), pure black the minimum (0)', () => {
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
});

test('parseLiteralColor: hex in every supported width', () => {
  assert.deepEqual(parseLiteralColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseLiteralColor('#000000'), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseLiteralColor('#7e22ce'), { r: 126, g: 34, b: 206, a: 1 });
  assert.deepEqual(parseLiteralColor('#0000'), { r: 0, g: 0, b: 0, a: 0 }); // 4-digit hex: alpha channel.
  const rgba8 = parseLiteralColor('#ffffff80');
  assert.equal(rgba8.r, 255); assert.equal(rgba8.a, 128 / 255);
});

test('parseLiteralColor: rgb()/rgba()/hsl()/hsla() and transparent', () => {
  assert.deepEqual(parseLiteralColor('rgb(126, 34, 206)'), { r: 126, g: 34, b: 206, a: 1 });
  const rgba = parseLiteralColor('rgba(126, 34, 206, 0.5)');
  assert.equal(rgba.r, 126); assert.equal(rgba.a, 0.5);
  assert.deepEqual(parseLiteralColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  const hsl = parseLiteralColor('hsl(0, 0%, 100%)'); // white via HSL.
  assert.equal(hsl.r, 255); assert.equal(hsl.g, 255); assert.equal(hsl.b, 255);
  const black = parseLiteralColor('hsl(0, 0%, 0%)');
  assert.equal(black.r, 0); assert.equal(black.g, 0); assert.equal(black.b, 0);
});

test('parseLiteralColor: not a color at all returns null, never a guessed value', () => {
  assert.equal(parseLiteralColor('not-a-color'), null);
  assert.equal(parseLiteralColor('oklch(0.7 0.15 30)'), null); // a real CSS color this parser deliberately does not support.
  assert.equal(parseLiteralColor(''), null);
});

test('compositeOver: alpha 1 returns the foreground unchanged; alpha 0 returns the background', () => {
  const bg = { r: 255, g: 255, b: 255 };
  assert.deepEqual(compositeOver({ r: 10, g: 20, b: 30, a: 1 }, bg), { r: 10, g: 20, b: 30 });
  assert.deepEqual(compositeOver({ r: 10, g: 20, b: 30, a: 0 }, bg), { r: 255, g: 255, b: 255 });
  const half = compositeOver({ r: 0, g: 0, b: 0, a: 0.5 }, bg);
  assert.equal(half.r, 127.5);
});

test('resolveExpression: a literal never needs the var map', () => {
  const result = resolveExpression('#ff0000', {});
  assert.equal(result.ok, true);
  assert.deepEqual(result.color, { r: 255, g: 0, b: 0, a: 1 });
});

test('resolveExpression: var() resolves against the map, chases multi-level references', () => {
  const map = { '--a': 'var(--b)', '--b': 'var(--c)', '--c': '#123456' };
  const result = resolveExpression('var(--a)', map);
  assert.equal(result.ok, true);
  assert.deepEqual(result.color, { r: 0x12, g: 0x34, b: 0x56, a: 1 });
});

test('resolveExpression: an undefined custom property with no fallback is unresolved, not silently ignored', () => {
  const result = resolveExpression('var(--totally-undefined)', {});
  assert.equal(result.ok, false);
  assert.match(result.reason, /undefined custom property/);
});

test('resolveExpression: var(x, fallback) uses the fallback only when x is undefined', () => {
  const withFallback = resolveExpression('var(--missing, #abcdef)', {});
  assert.equal(withFallback.ok, true);
  assert.deepEqual(withFallback.color, { r: 0xab, g: 0xcd, b: 0xef, a: 1 });
  const map = { '--present': '#111111' };
  const ignoresFallback = resolveExpression('var(--present, #ffffff)', map);
  assert.deepEqual(ignoresFallback.color, { r: 0x11, g: 0x11, b: 0x11, a: 1 });
});

test('resolveExpression: a real reference cycle is unresolved, not an infinite loop', () => {
  const map = { '--a': 'var(--b)', '--b': 'var(--a)' };
  const result = resolveExpression('var(--a)', map);
  assert.equal(result.ok, false);
  assert.match(result.reason, /cycle|excessive/);
});

test('resolveExpression: color-mix(in srgb, X Y%, transparent) — presetValueToCss\'s own alpha shape', () => {
  const map = { '--x': '#000000' };
  const result = resolveExpression('color-mix(in srgb, var(--x) 60%, transparent)', map);
  assert.equal(result.ok, true);
  assert.equal(result.color.a, 0.6);
});

test('resolveExpression: a border/underline shorthand resolves via its embedded color token', () => {
  const map = { '--border-color': '#334455' };
  const result = resolveExpression('1px solid var(--border-color)', map);
  assert.equal(result.ok, true);
  assert.deepEqual(result.color, { r: 0x33, g: 0x44, b: 0x55, a: 1 });
});

test('resolveExpression: "none" (no border at all) resolves as fully transparent, not black', () => {
  const result = resolveExpression('none', {});
  assert.equal(result.ok, true);
  assert.equal(result.color.a, 0);
});

// ---------------------------------------------------------------------
// checkThemeContrast: real, end-to-end runs — a deliberately isolated
// custom role added to the real DEFAULT_THEME, so assertions target only
// what this test controls, not the ambient default theme's own (real,
// separately tracked) findings.
// ---------------------------------------------------------------------

function findFor(report, component) {
  return {
    failures: report.failures.filter((f) => f.component === component),
    checked: report.checked.filter((c) => c.component === component),
  };
}

test('checkThemeContrast: a real, obviously-passing custom role produces zero failures for it', () => {
  // A literal `#000000` border would be exactly this test's point in
  // light mode, but genuinely invisible against dark mode's own
  // near-black ambient background — a real bug this gate is supposed to
  // catch, not something to route around. `palette(surface-contrast)`
  // inverts with the mode on purpose, so this role is actually
  // theme-correct (and passing) in both.
  const theme = resolveTheme({
    surfaces: { 'obviously-fine': { bg: '#ffffff', color: '#000000', border: '1px solid palette(surface-contrast)' } },
  });
  const report = checkThemeContrast(theme);
  const { failures } = findFor(report, 'obviously-fine');
  assert.deepEqual(failures, []);
});

test('checkThemeContrast: a real, obviously-failing custom role is caught, not silently passed', () => {
  const theme = resolveTheme({
    surfaces: { 'obviously-bad': { bg: '#ffffff', color: '#fefefe', border: '1px solid #fdfdfd' } },
  });
  const report = checkThemeContrast(theme);
  const { failures } = findFor(report, 'obviously-bad');
  assert.ok(failures.some((f) => f.pair === 'text'));
  assert.ok(failures.every((f) => f.ratio !== null && f.ratio < f.required));
});

test('checkThemeContrast: an unresolvable color reference fails the gate — never a 0 ratio, never an automatic pass', () => {
  const theme = resolveTheme({
    surfaces: { 'dangling-ref': { bg: '#ffffff', color: 'palette(totally-made-up.main)' } },
  });
  const report = checkThemeContrast(theme);
  const { failures, checked } = findFor(report, 'dangling-ref');
  const textFailure = failures.find((f) => f.pair === 'text');
  assert.ok(textFailure, 'an unresolved foreground must still be reported as a failure');
  assert.equal(textFailure.ratio, null);
  assert.match(textFailure.reason, /undefined custom property/);
  // The same "unresolved" pair also shows up in `checked` with ratio: null
  // — never silently dropped, never coerced into a 0 that would look like
  // a real, measured, maximally-bad ratio instead of "could not measure".
  const checkedEntry = checked.find((c) => c.pair === 'text');
  assert.equal(checkedEntry.ratio, null);
});

test('checkThemeContrast: an exact-match exception suppresses exactly the failure it names, and reports as matched', () => {
  // An unlisted `border` falls back to DEFAULT_SURFACES.contained's own
  // (separately, already-tracked) border, and this fixed hex pair repeats
  // identically in dark mode too (it's not a palette reference, so it
  // never changes) — both are real, independent findings, deliberately
  // left alone here; this test's own exception only claims the one light-
  // mode text pair it names, and only that one must disappear.
  const theme = resolveTheme({
    surfaces: { 'excepted-role': { bg: '#ffffff', color: '#fefefe' } },
  });
  const withoutException = checkThemeContrast(theme);
  const lightTextBefore = findFor(withoutException, 'excepted-role').failures.filter((f) => f.pair === 'text' && f.mode === 'light');
  assert.equal(lightTextBefore.length, 1);

  const exception = {
    id: 'test-excepted-role-text',
    mode: 'light',
    family: 'surface',
    component: 'excepted-role',
    tone: null,
    state: 'base',
    pair: 'text',
    background: 'own-bg-or-ambient',
    resolved: { foreground: '#fefefe', background: '#ffffff' },
    reason: 'test fixture',
  };
  const withException = checkThemeContrast(theme, { exceptions: [exception] });
  const lightTextAfter = findFor(withException, 'excepted-role').failures.filter((f) => f.pair === 'text' && f.mode === 'light');
  assert.equal(lightTextAfter.length, 0, 'exactly the named pair must be gone');
  assert.equal(withException.exceptions[0].matched, true);
  assert.deepEqual(withException.exceptionIssues, []);
});

test('checkThemeContrast: an override that changes the resolved color invalidates the old exception — it does not keep covering a different color', () => {
  const exception = {
    id: 'test-changed-role-text',
    mode: 'light',
    family: 'surface',
    component: 'changed-role',
    tone: null,
    state: 'base',
    pair: 'text',
    background: 'own-bg-or-ambient',
    resolved: { foreground: '#fefefe', background: '#ffffff' }, // the *old* (failing) color.
    reason: 'test fixture',
  };
  // The project now overrides the role to something else that still fails,
  // but with different resolved colors than the exception recorded.
  const theme = resolveTheme({
    surfaces: { 'changed-role': { bg: '#ffffff', color: '#f0f0f0' } },
  });
  const report = checkThemeContrast(theme, { exceptions: [exception] });
  assert.ok(findFor(report, 'changed-role').failures.some((f) => f.pair === 'text'), 'the new color must fail for real, uncovered by the stale exception');
  assert.equal(report.exceptions[0].matched, false);
  assert.match(report.exceptionIssues.join(' '), /stale exception/);
});

test('checkThemeContrast: a duplicate exception id fails the gate even if every individual pair passes', () => {
  const theme = resolveTheme();
  const exception = {
    id: 'duplicate-id',
    mode: 'light',
    family: 'surface',
    component: 'outlined',
    tone: 'light',
    state: 'base',
    pair: 'text',
    background: 'own-bg-or-ambient',
    resolved: { foreground: '#f1f5f9', background: '#ffffff' },
    reason: 'the real, story-documented exception, duplicated on purpose for this test',
  };
  const report = checkThemeContrast(theme, { exceptions: [exception, { ...exception }] });
  assert.equal(report.passed, false);
  assert.match(report.exceptionIssues.join(' '), /duplicate exception id/);
});

test('checkThemeContrast: a disabled-state failure is computed and reported, but never blocks the gate on its own', () => {
  const theme = resolveTheme({
    inputs: { 'disabled-fails': { surface: 'contained', base: {}, states: { disabled: { color: '#fefefe' } } } },
  });
  const report = checkThemeContrast(theme);
  const { failures, checked } = findFor(report, 'disabled-fails');
  const disabledChecked = checked.find((c) => c.state === 'disabled' && c.pair === 'text');
  assert.ok(disabledChecked, 'a disabled-state pair must still be computed and listed');
  assert.equal(disabledChecked.exempt, true);
  assert.equal(failures.some((f) => f.state === 'disabled'), false, 'exempt states never appear as blocking failures');
});

test('checkThemeContrast: dark mode is only checked when modes.dark actually exists', () => {
  const withoutDark = resolveTheme({ modes: undefined });
  const reportNoDark = checkThemeContrast({ ...withoutDark, modes: undefined });
  assert.equal(reportNoDark.checked.some((c) => c.mode === 'dark'), false);
  const reportWithDark = checkThemeContrast(withoutDark); // the real theme does define modes.dark.
  assert.ok(reportWithDark.checked.some((c) => c.mode === 'dark'));
});

test('checkThemeContrast: repeating the exact same call twice is deterministic', () => {
  const theme = resolveTheme();
  const a = checkThemeContrast(theme);
  const b = checkThemeContrast(theme);
  assert.deepEqual(a.failures, b.failures);
  assert.equal(a.checked.length, b.checked.length);
});
