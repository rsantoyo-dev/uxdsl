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
// (#475569 -> #68778c), which resolves the first one (now ~4.61:1, see the
// test below). The other two remain open BY DESIGN, not by omission: both
// trace to a family's own `main` being read directly as text/border via an
// `outlined`/`flat`/`underline` tone (warning.main isn't dark enough;
// `light` is a background-identity family, the same class of finding as
// its own already-shipped exception) — moving either far enough to pass
// would erase the family's own recognizable identity, which phase 3's own
// rules protect ("main" only moves as a last resort, never to the point of
// losing what makes it that family). Recorded as real, disclosed,
// out-of-scope architecture findings in this story's evidence, each
// recommended as its own follow-up MIG, not swept into ad hoc exceptions.

const theme = resolveTheme();

test('the base theme does not pass the contrast gate yet (phase 3 of this story fixes colors, not this phase)', () => {
  const report = checkThemeContrast(theme, { exceptions });
  assert.equal(report.passed, false);
  assert.ok(report.failures.length > 0);
  // Not marked passing by omission: the exceptions file itself must be
  // internally valid even while real failures remain.
  assert.deepEqual(report.exceptionIssues, []);
});

test('both light and dark are actually evaluated — modes.dark is a real, present default now (MIG-B6-29 phase 1)', () => {
  const report = checkThemeContrast(theme, { exceptions });
  assert.ok(report.checked.some((c) => c.mode === 'light'));
  assert.ok(report.checked.some((c) => c.mode === 'dark'));
  assert.ok(report.failures.some((f) => f.mode === 'light'));
  assert.ok(report.failures.some((f) => f.mode === 'dark'));
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

test('phase 3 fixed the story\'s tertiary/contained/hover example; the other two remain open, at their same documented ratios', () => {
  const report = checkThemeContrast(theme);

  const tertiaryHover = report.checked.find((c) => c.mode === 'light' && c.tone === 'tertiary' && c.state === 'hover' && c.pair === 'text' && c.family === 'button');
  assert.ok(tertiaryHover, 'expected the tertiary/contained/hover text pair to still be checked');
  assert.ok(tertiaryHover.ratio >= 4.5, `tertiary.dark's phase-3 correction should have fixed this pair, got ${tertiaryHover.ratio}`);
  assert.ok(!report.failures.some((f) => f.mode === 'light' && f.tone === 'tertiary' && f.state === 'hover' && f.pair === 'text' && f.family === 'button'), 'must no longer be a failure');

  const find = (predicate) => report.failures.find(predicate);
  const warningOutlined = find((f) => f.mode === 'light' && f.tone === 'warning' && f.component === 'outlined' && f.state === 'base' && f.pair === 'text');
  assert.ok(warningOutlined, 'expected a warning/outlined/base text failure in light mode — open by design (warning.main isn\'t dark enough for direct text use; see this story\'s evidence)');
  assert.equal(Number(warningOutlined.ratio.toFixed(2)), 3.19);

  const lightOutlined = find((f) => f.mode === 'light' && f.tone === 'light' && f.component === 'outlined' && f.state === 'base' && f.pair === 'text' && f.family === 'surface');
  assert.ok(lightOutlined, 'expected a light-tone/outlined/base text failure in light mode — open by design (background-identity family, same class as its own shipped exception)');
  assert.equal(Number(lightOutlined.ratio.toFixed(2)), 1.10);
});

test('the one exception this story\'s own reproduction names (light-tone text on a transparent-bg role) is declared, exact-matched and justified', () => {
  assert.equal(exceptions.length, 1);
  const [exception] = exceptions;
  assert.equal(exception.tone, 'light');
  assert.equal(exception.pair, 'text');
  assert.match(exception.reason, /background role/);
  const report = checkThemeContrast(theme, { exceptions });
  const matchedException = report.exceptions.find((e) => e.record.id === exception.id);
  assert.equal(matchedException.matched, true);
  // The same combination on other roles/families (flat, button, input —
  // not named by the story, not excepted here) remains a real, open
  // failure — the exception is scoped to exactly what it names, not
  // silently broadened.
  assert.ok(report.failures.some((f) => f.tone === 'light' && f.component === 'flat' && f.pair === 'text' && f.mode === 'light'));
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
