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
  // catch, not something to route around. `palette(surface.contrast)`
  // inverts with the mode on purpose, so this role is actually
  // theme-correct (and passing) in both.
  const theme = resolveTheme({
    surfaces: { 'obviously-fine': { bg: '#ffffff', color: '#000000', border: '1px solid palette(surface.contrast)' } },
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

// ---------------------------------------------------------------------
// Pattern exceptions (stability phase 5, audit DE-7 / D-8 = a): a
// structural class of pairs — one tone family, optionally narrowed —
// instead of one exact pair. Every number below is measured against the
// same theme with no exceptions; none is hand-asserted.
// ---------------------------------------------------------------------

const failsItsThreshold = (pair) => pair.ratio === null || pair.ratio < pair.required;

test('pattern exception: covers the failing pairs of its tone and lists each as excepted — never as passing', () => {
  const theme = resolveTheme();
  const without = checkThemeContrast(theme);
  const toneFailures = without.failures.filter((f) => f.tone === 'surface');
  assert.ok(toneFailures.length > 0, 'the `surface` tone must fail something for this test to mean anything');

  const report = checkThemeContrast(theme, { exceptions: [{ tone: 'surface', reason: 'test: the canvas drawn on the canvas' }] });
  assert.equal(report.failures.filter((f) => f.tone === 'surface').length, 0);
  assert.equal(report.excepted.length, toneFailures.length);
  assert.ok(report.excepted.every((e) => e.tone === 'surface' && e.exception === 'tone:surface'));
  assert.ok(report.excepted.every(failsItsThreshold), 'an excepted pair still fails its threshold');
  // Nothing was moved to "passing": the same pairs are checked, with the same ratios.
  assert.equal(report.checked.length, without.checked.length);
  assert.equal(report.checked.filter((c) => !c.exempt && failsItsThreshold(c)).length, without.failures.length);
  // Every other failure is untouched.
  assert.equal(report.failures.length, without.failures.length - toneFailures.length);
  assert.equal(report.passed, false);

  const [entry] = report.exceptions;
  assert.deepEqual(
    { id: entry.id, kind: entry.kind, matched: entry.matched, covered: entry.covered },
    { id: 'tone:surface', kind: 'pattern', matched: true, covered: toneFailures.length });
  assert.deepEqual(report.exceptionIssues, []);
});

test('pattern exception: each narrowing key restricts the match; an absent key matches anything', () => {
  const theme = resolveTheme();
  const all = checkThemeContrast(theme, { exceptions: [{ tone: 'surface', reason: 'test' }] }).excepted;
  for (const [key, value] of [['mode', 'dark'], ['family', 'input'], ['component', 'outlined'], ['state', 'base'], ['pair', 'border'], ['against', 'ambient']]) {
    const report = checkThemeContrast(theme, { exceptions: [{ tone: 'surface', [key]: value, reason: 'test' }] });
    const expected = all.filter((e) => e[key] === value);
    assert.ok(expected.length > 0, `${key}=${value} must select something`);
    assert.equal(report.excepted.length, expected.length, `${key}=${value}`);
    assert.ok(report.excepted.every((e) => e[key] === value), `${key}=${value}`);
    assert.equal(report.exceptions[0].id, `tone:surface,${key}=${value}`);
    assert.equal(report.exceptions[0].covered, expected.length);
  }
});

test('pattern exception, negative control: a pattern that matches nothing is an exceptionIssue and fails the gate', () => {
  const theme = resolveTheme();
  const failuresWithout = checkThemeContrast(theme).failures.length;
  const patterns = [
    { tone: 'no-such-family', reason: 'test' },
    { tone: 'primary', reason: 'test: primary passes everywhere, so there is nothing to except' },
    { tone: 'surface', component: 'no-such-role', reason: 'test' },
  ];
  for (const pattern of patterns) {
    const report = checkThemeContrast(theme, { exceptions: [pattern] });
    assert.equal(report.exceptions[0].matched, false, JSON.stringify(pattern));
    assert.equal(report.exceptions[0].covered, 0);
    assert.equal(report.excepted.length, 0);
    assert.equal(report.failures.length, failuresWithout);
    assert.equal(report.exceptionIssues.length, 1);
    assert.match(report.exceptionIssues[0], /^stale exception "[^"]+": the pattern matches no failing pair$/);
    assert.equal(report.passed, false);
  }
});

test('pattern exception: a malformed pattern is reported and never applied — a misspelled key cannot silently broaden it', () => {
  const theme = resolveTheme();
  const failuresWithout = checkThemeContrast(theme).failures.length;
  const cases = [
    [{ tone: 'surface', componnet: 'outlined', reason: 'test' }, /unknown key "componnet"/],
    [{ tone: 'surface' }, /needs a written `reason`/],
    [{ tone: 'surface', reason: '   ' }, /needs a written `reason`/],
    [{ reason: 'no tone at all' }, /needs `tone`/],
    [{ tone: null, reason: 'test' }, /needs `tone`/],
    [{ tone: 'surface', pair: 'outline', reason: 'test' }, /`pair` must be one of text, placeholder, border/],
    [{ tone: 'surface', mode: 'night', reason: 'test' }, /`mode` must be one of light, dark/],
    [{ tone: 'surface', against: 'canvas', reason: 'test' }, /`against` must be one of own, ambient/],
    [{ tone: 'surface', id: '', reason: 'test' }, /`id` must be a nonempty string/],
    ['surface', /expected an object/],
  ];
  for (const [exception, message] of cases) {
    const report = checkThemeContrast(theme, { exceptions: [exception] });
    const issues = report.exceptionIssues.join('\n');
    assert.match(issues, message, JSON.stringify(exception));
    assert.doesNotMatch(issues, /stale exception/, 'a malformed record is reported once, as malformed');
    assert.equal(report.excepted.length, 0, `${JSON.stringify(exception)} must not cover anything`);
    assert.equal(report.failures.length, failuresWithout);
    assert.equal(report.passed, false);
  }
  const notAList = checkThemeContrast(theme, { exceptions: { tone: 'surface', reason: 'test' } });
  assert.match(notAList.exceptionIssues.join('\n'), /expected an array/);
  assert.equal(notAList.excepted.length, 0);
  assert.equal(notAList.passed, false);
});

test('pattern exception: the same colors under a tone the pattern does not name remain a failure', () => {
  // `ghost` repeats the canvas color, so its outlined text resolves to the
  // very pair the `surface` tone produces. The checker collapses identical
  // pairs across tones; a per-tone pattern must not ride on that.
  const theme = resolveTheme({ palette: { ghost: { main: '#ffffff', dark: '#ffffff', contrast: '#000000' } } });
  const isGhostText = (f) => f.tone === 'ghost' && f.family === 'surface' && f.component === 'outlined' && f.pair === 'text' && f.mode === 'light';

  const onlySurface = checkThemeContrast(theme, { exceptions: [{ tone: 'surface', reason: 'test' }] });
  assert.ok(onlySurface.failures.some(isGhostText), 'the un-excepted tone must be reported as its own failure');
  assert.ok(!onlySurface.excepted.some((e) => e.tone === 'ghost'));

  const both = checkThemeContrast(theme, { exceptions: [{ tone: 'surface', reason: 'test' }, { tone: 'ghost', reason: 'test' }] });
  assert.equal(both.failures.filter((f) => f.tone === 'ghost' || f.tone === 'surface').length, 0);
  assert.deepEqual(both.exceptions.map((e) => e.matched), [true, true]);
  assert.deepEqual(both.exceptionIssues, []);
  assert.equal(both.exceptions.reduce((sum, e) => sum + e.covered, 0), both.excepted.length, 'every excepted pair is attributed to exactly one exception');
});

test('checked pairs say what they were measured against, and `against: ambient` leaves a role\'s own fill uncovered', () => {
  const plain = checkThemeContrast(resolveTheme());
  const find = (wanted) => plain.checked.find((c) => c.mode === 'light' && c.tone === null && Object.keys(wanted).every((k) => c[k] === wanted[k]));
  assert.equal(find({ family: 'surface', component: 'contained', pair: 'text' }).against, 'own');
  assert.equal(find({ family: 'surface', component: 'outlined', pair: 'text' }).against, 'ambient');
  assert.equal(find({ family: 'surface', component: 'outlined', pair: 'border' }).against, 'ambient');

  // A real value mistake on a canvas-identity family: its own `contrast` no
  // longer reads on its own fill. That is a color to fix, not the canvas
  // drawn on the canvas, and a pattern narrowed to the page must not hide it.
  const broken = resolveTheme({ palette: { light: { contrast: '#fdfdfd' } } });
  const isOwnFill = (f) => f.tone === 'light' && f.component === 'contained' && f.pair === 'text' && f.against === 'own';
  const narrowed = checkThemeContrast(broken, { exceptions: [{ tone: 'light', against: 'ambient', reason: 'test' }] });
  assert.ok(narrowed.failures.some(isOwnFill), 'the fill\'s own text must still fail the gate');
  assert.ok(!narrowed.excepted.some(isOwnFill));
  assert.ok(narrowed.excepted.length > 0 && narrowed.excepted.every((e) => e.against === 'ambient'));
  const broad = checkThemeContrast(broken, { exceptions: [{ tone: 'light', reason: 'test' }] });
  assert.ok(broad.excepted.some(isOwnFill), 'control: the un-narrowed pattern is what would have hidden it');
});

test('an exempt (disabled) pair is never excepted, so an exception written for one is stale', () => {
  const theme = resolveTheme({
    inputs: { 'disabled-fails': { surface: 'contained', base: {}, states: { disabled: { color: '#fefefe' } } } },
  });
  const pattern = { tone: 'light', component: 'disabled-fails', state: 'disabled', reason: 'test' };
  const exact = {
    id: 'test-disabled-exact', mode: 'light', family: 'input', component: 'disabled-fails', tone: null, state: 'disabled',
    pair: 'text', background: 'own-bg-or-ambient', resolved: { foreground: '#fefefe', background: '#ffffff' }, reason: 'test',
  };
  const report = checkThemeContrast(theme, { exceptions: [pattern, exact] });
  const disabled = report.checked.filter((c) => c.component === 'disabled-fails' && c.state === 'disabled' && c.pair === 'text');
  assert.ok(disabled.some((c) => c.tone === null && c.exempt && failsItsThreshold(c)), 'the untoned disabled pair is computed, failing and exempt');
  assert.ok(disabled.some((c) => c.tone === 'light' && c.exempt && failsItsThreshold(c)), 'so is the light-toned one');
  assert.equal(report.excepted.length, 0);
  assert.deepEqual(report.exceptions.map((e) => e.matched), [false, false]);
  assert.equal(report.exceptionIssues.filter((issue) => /^stale exception/.test(issue)).length, 2);
});

test('pattern exception: an explicit id is kept, a missing one is derived, duplicates are reported, exact records and patterns mix', () => {
  const theme = resolveTheme();
  const report = checkThemeContrast(theme, { exceptions: [{ id: 'my-id', tone: 'surface', reason: 'test' }, { tone: 'light', pair: 'text', reason: 'test' }] });
  assert.deepEqual(report.exceptions.map((e) => e.id), ['my-id', 'tone:light,pair=text']);
  assert.ok(report.excepted.some((e) => e.exception === 'my-id'));
  assert.ok(report.excepted.some((e) => e.exception === 'tone:light,pair=text'));

  const duplicated = checkThemeContrast(theme, { exceptions: [{ tone: 'surface', reason: 'one' }, { tone: 'surface', reason: 'two' }] });
  assert.match(duplicated.exceptionIssues.join(' '), /duplicate exception id "tone:surface" \(2 entries\)/);
  assert.equal(duplicated.passed, false);

  // The exact record this file used to ship, followed by the pattern that
  // subsumes it: the pair is attributed to the first one that covers it.
  const exact = {
    id: 'exact-first', mode: 'light', family: 'surface', component: 'outlined', tone: 'light', state: 'base',
    pair: 'text', background: 'own-bg-or-ambient', resolved: { foreground: '#f1f5f9', background: '#ffffff' }, reason: 'test',
  };
  const mixed = checkThemeContrast(theme, { exceptions: [exact, { tone: 'light', reason: 'test' }] });
  assert.deepEqual(mixed.exceptions.map((e) => e.kind), ['pair', 'pattern']);
  assert.equal(mixed.exceptions[0].covered, 1);
  assert.equal(mixed.excepted.filter((e) => e.exception === 'exact-first').length, 1);
  assert.equal(mixed.exceptions[0].covered + mixed.exceptions[1].covered, mixed.excepted.length);
  assert.deepEqual(mixed.exceptionIssues, []);
});
