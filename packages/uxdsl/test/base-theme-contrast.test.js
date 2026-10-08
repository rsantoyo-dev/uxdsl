const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkThemeContrast } = require('../dist/ds-runtime/contrast');
const { resolveTheme } = require('../dist/default-theme');
const exceptions = require('../src/theme/base.contrast-exceptions.json');

// MIG-B6-29 (FEAT-008), phase 2/4 — the gate itself, run against the real
// shipped theme (`theme/base.json` via `resolveTheme()`), in both light
// and dark, at every configured breakpoint. See contrast.test.js for unit
// coverage of the primitives this relies on.
//
// This story's own reproduction ("Por qué"/"Reproducción") hand-computed
// three of these ratios, pinned here originally so a future change could
// never silently drift from them: tertiary/contained/hover 2.77:1,
// warning/outlined/base 3.19:1, light-tone/outlined/base 1.10:1. Phase 3
// (color correction, this same story's step 8) fixed `tertiary.dark`
// (#475569 -> #68778c), which resolved the first one (~4.61:1). Stability
// phase 5 (audit DE-7) closed the other two: `warning` was re-chosen
// (main #b45309, dark #92400e, contrast #ffffff, with its own dark-mode
// set), and `light`/`dark`/`surface` used as a tone are excepted as the
// structural class they are (three patterns, see contrast.test.js), with
// every covered pair still listed as failing. With the dark-mode values
// `neutral.dark` #94a3b8 and `light.dark` #334155 the base theme passes
// its own gate; nothing below asserts a count that was not measured.

const theme = resolveTheme();
// Stability phase 5 (audit DE-7, D-8 = a): the canvas-identity families used
// as a tone are a property of the role, not a color to fix, so the shipped
// file excepts them as three patterns instead of one exact record per pair.
const IDENTITY_TONES = ['surface', 'light', 'dark'];
const failsItsThreshold = (pair) => pair.ratio === null || pair.ratio < pair.required;

test('the base theme passes its own contrast gate: zero failing pairs, every excepted pair listed, no exception issue', () => {
  const report = checkThemeContrast(theme, { exceptions });
  assert.equal(report.passed, true);
  assert.deepEqual(report.failures, []);
  assert.deepEqual(report.exceptionIssues, []);
  assert.ok(report.excepted.length > 0, 'passing is not "every pair passed": the canvas-identity pairs are still listed');
  assert.ok(report.excepted.every(failsItsThreshold));
});

test('negative control: reverting any one of this phase\'s value fixes makes the gate fail again, and not through an exception', () => {
  const reverts = {
    'light warning (main #d97706, dark #c25e0a, contrast #000000)': { palette: { warning: { main: '#d97706', dark: '#c25e0a', contrast: '#000000' } } },
    'dark warning.dark back to inheriting the light-mode value': { modes: { dark: { palette: { warning: { dark: '#92400e' } } } } },
    'dark neutral.dark #475569': { modes: { dark: { palette: { neutral: { dark: '#475569' } } } } },
    'dark light.dark back to inheriting #e2e8f0': { modes: { dark: { palette: { light: { dark: '#e2e8f0' } } } } },
  };
  for (const [label, override] of Object.entries(reverts)) {
    const report = checkThemeContrast(resolveTheme(override), { exceptions });
    assert.equal(report.passed, false, label);
    assert.ok(report.failures.length > 0, label);
    assert.deepEqual(report.exceptionIssues, [], `${label}: the patterns stay valid, they just do not cover a value finding`);
  }
  // The `light.dark` revert is the one a pattern could have hidden: it is a
  // canvas family's own fill, which the shipped `against: ambient` leaves out.
  const lightDark = checkThemeContrast(resolveTheme(reverts['dark light.dark back to inheriting #e2e8f0']), { exceptions });
  assert.ok(lightDark.failures.some((f) => f.mode === 'dark' && f.tone === 'light' && f.component === 'contained' && f.pair === 'text' && f.against === 'own'));
});

test('both light and dark are actually evaluated — modes.dark is a real, present default now (MIG-B6-29 phase 1)', () => {
  const report = checkThemeContrast(theme, { exceptions });
  assert.ok(report.checked.some((c) => c.mode === 'light'));
  assert.ok(report.checked.some((c) => c.mode === 'dark'));
  assert.ok(report.excepted.some((f) => f.mode === 'light'));
  assert.ok(report.excepted.some((f) => f.mode === 'dark'));
});

test('every configured breakpoint width is actually resolved, even though none of this theme\'s colors are responsive', () => {
  // checkThemeContrast's own signature-based dedup (see its header
  // comment) collapses a breakpoint into the prior one whenever the
  // resolved colors are byte-identical — true for every pair in this
  // theme today, since no Surface/Button/Input color field uses a
  // responsive xs()/md() expression. That is a feature (one real finding,
  // not five identical copies of it), not a sign a breakpoint was
  // skipped — this checks the breakpoint that must always survive dedup
  // (the base one, width 0, since it seeds every signature) and confirms
  // a *responsive* color really does produce its own distinct entry.
  const report = checkThemeContrast(theme, { exceptions });
  assert.ok(report.checked.some((c) => c.breakpoint === 0));

  const responsiveTheme = resolveTheme({
    surfaces: { 'responsive-role': { bg: '#ffffff', color: 'xs(#ffffff) md(#000000)' } },
  });
  const responsiveReport = checkThemeContrast(responsiveTheme);
  const mine = responsiveReport.checked.filter((c) => c.component === 'responsive-role' && c.pair === 'text');
  const distinctBreakpoints = new Set(mine.map((c) => c.breakpoint));
  assert.ok(distinctBreakpoints.size >= 2, 'a genuinely responsive color must produce more than one distinct entry');
});

test('every Surface/Button/Input role actually defined is covered, not a hand-picked subset', () => {
  const report = checkThemeContrast(theme, { exceptions });
  const components = new Set(report.checked.map((c) => `${c.family}.${c.component}`));
  for (const role of Object.keys(theme.surfaces || {})) assert.ok(components.has(`surface.${role}`), role);
  assert.ok(components.has('surface.contained'));
  assert.ok(components.has('surface.outlined'));
  assert.ok(components.has('surface.flat'));
  assert.ok(components.has('button.contained'));
  assert.ok(components.has('button.outlined'));
  assert.ok(components.has('button.flat'));
  assert.ok(components.has('input.contained'));
  assert.ok(components.has('input.outlined'));
  assert.ok(components.has('input.underline'));
});

test('every real tone family (getToneFamilies\' own 11) is checked, not just the untoned default', () => {
  const report = checkThemeContrast(theme, { exceptions });
  const tones = new Set(report.checked.map((c) => c.tone).filter(Boolean));
  for (const family of ['primary', 'secondary', 'surface', 'tertiary', 'success', 'info', 'warning', 'error', 'dark', 'neutral', 'light']) {
    assert.ok(tones.has(family), `tone family "${family}" was never checked`);
  }
});

test('the story\'s three hand-computed pairs: two fixed as values, the third excepted as the structural class it is', () => {
  const report = checkThemeContrast(theme);

  const tertiaryHover = report.checked.find((c) => c.mode === 'light' && c.tone === 'tertiary' && c.state === 'hover' && c.pair === 'text' && c.family === 'button');
  assert.ok(tertiaryHover, 'expected the tertiary/contained/hover text pair to still be checked');
  assert.ok(tertiaryHover.ratio >= 4.5, `tertiary.dark's phase-3 correction should have fixed this pair, got ${tertiaryHover.ratio}`);

  // warning.main #d97706 read 3.19:1 as outlined text; #b45309 (same hue,
  // lightness only) reads ~5.02:1 and is no longer a failure.
  const warningOutlined = report.checked.find((c) => c.mode === 'light' && c.tone === 'warning' && c.component === 'outlined' && c.state === 'base' && c.pair === 'text' && c.family === 'surface');
  assert.ok(warningOutlined.ratio >= 4.5, `warning.main's phase-5 correction should have fixed this pair, got ${warningOutlined.ratio}`);
  assert.ok(!report.failures.some((f) => f.tone === 'warning'), 'no warning pair fails in either mode without any exception');

  // The light tone on outlined is still 1.10:1 without exceptions — it is the
  // canvas drawn on the canvas, which the shipped pattern covers.
  const lightOutlined = report.failures.find((f) => f.mode === 'light' && f.tone === 'light' && f.component === 'outlined' && f.state === 'base' && f.pair === 'text' && f.family === 'surface');
  assert.ok(lightOutlined, 'expected a light-tone/outlined/base text failure in light mode without the shipped exceptions');
  assert.equal(Number(lightOutlined.ratio.toFixed(2)), 1.10);
  assert.ok(report.failures.every((f) => IDENTITY_TONES.includes(f.tone) && f.against === 'ambient'), 'with no exceptions at all, every remaining failure is a canvas identity drawn on the page');
});

test('the shipped exceptions are three patterns, one per canvas-identity family, each matched and justified', () => {
  assert.deepEqual(exceptions.map((e) => e.tone), IDENTITY_TONES);
  for (const exception of exceptions) {
    assert.ok(!('resolved' in exception), 'a pattern pins no resolved colors');
    assert.equal(exception.against, 'ambient', 'narrowed to the tone drawn on the page itself');
    assert.match(exception.reason, /only on `contained`/);
  }
  const report = checkThemeContrast(theme, { exceptions });
  assert.deepEqual(report.exceptions.map((e) => [e.kind, e.matched]), IDENTITY_TONES.map(() => ['pattern', true]));
  assert.ok(report.exceptions.every((e) => e.covered > 0));
  assert.equal(report.exceptions.reduce((sum, e) => sum + e.covered, 0), report.excepted.length);
  assert.deepEqual(report.exceptionIssues, []);
});

test('every excepted pair is listed, still failing, and is exactly a canvas-identity tone drawn on the page', () => {
  const report = checkThemeContrast(theme, { exceptions });
  const without = checkThemeContrast(theme);
  assert.ok(report.excepted.length > 0);
  assert.ok(report.excepted.every((e) => IDENTITY_TONES.includes(e.tone) && e.against === 'ambient'));
  assert.ok(report.excepted.every(failsItsThreshold), 'excepted is not passing');
  // Measured, not asserted: the patterns cover exactly the identity-tone
  // failures the unexcepted run reports against the page, and nothing else
  // left the failure list.
  const identityOnPage = without.failures.filter((f) => IDENTITY_TONES.includes(f.tone) && f.against === 'ambient');
  assert.equal(report.excepted.length, identityOnPage.length);
  assert.equal(report.failures.length, without.failures.length - identityOnPage.length);
  assert.equal(report.checked.length, without.checked.length);
  // The single exact record this file shipped before is subsumed: same pair, same 1.10:1.
  const former = report.excepted.find((e) => e.mode === 'light' && e.family === 'surface' && e.component === 'outlined' && e.tone === 'light' && e.state === 'base' && e.pair === 'text');
  assert.ok(former, 'the former exact record\'s pair must be among the excepted');
  assert.equal(Number(former.ratio.toFixed(2)), 1.10);
  assert.equal(former.exception, 'canvas-identity-tone-light');
});

test('the patterns do not reach a canvas-identity family\'s own fill: its text on `contained` is held to the gate and passes', () => {
  // Until this phase set `modes.dark.palette.light.dark` (#334155) a dark-mode
  // contained Button with the light tone hovered to a pale fill under
  // near-white text (1.95:1). The patterns never covered that pair — it is
  // measured against the fill, not the page — and now it passes on its own.
  const report = checkThemeContrast(theme, { exceptions });
  const ownFill = report.checked.filter((c) => IDENTITY_TONES.includes(c.tone) && c.against === 'own' && !c.exempt);
  assert.ok(ownFill.length > 0);
  assert.ok(ownFill.every((c) => c.ratio !== null && c.ratio >= c.required), `an own-fill pair of a canvas family fails: ${JSON.stringify(ownFill.filter(failsItsThreshold))}`);
  assert.ok(!report.excepted.some((e) => e.against === 'own'));
});

test('an unjustified, made-up exception does not silently suppress unrelated real failures', () => {
  const bogusException = {
    id: 'bogus-does-not-exist',
    mode: 'light',
    family: 'surface',
    component: 'contained',
    tone: null,
    state: 'base',
    pair: 'text',
    background: 'own-bg-or-ambient',
    resolved: { foreground: '#000000', background: '#ffffff' }, // not this theme's real resolved colors.
    reason: 'not a real exception',
  };
  const report = checkThemeContrast(theme, { exceptions: [bogusException] });
  assert.equal(report.exceptionIssues.length, 1);
  assert.match(report.exceptionIssues[0], /stale exception/);
  assert.equal(report.passed, false);
});

test('regression: a color change that newly breaks a previously-passing pair in either mode must fail', () => {
  // Simulates the exact class of accident this gate exists to catch: an
  // edit to one palette value that looks harmless in isolation.
  const brokenLight = resolveTheme({ palette: { primary: { contrast: '#7e22ce' } } }); // now identical to its own main.
  const lightReport = checkThemeContrast(brokenLight);
  assert.ok(lightReport.failures.some((f) => f.mode === 'light' && f.tone === null && f.component === 'contained' && f.family === 'button' && f.pair === 'text'));

  const brokenDark = resolveTheme({ modes: { dark: { palette: { primary: { contrast: '#ddbfff' } } } } }); // now identical to dark's own main.
  const darkReport = checkThemeContrast(brokenDark);
  assert.ok(darkReport.failures.some((f) => f.mode === 'dark' && f.tone === null && f.component === 'contained' && f.family === 'button' && f.pair === 'text'));
});
