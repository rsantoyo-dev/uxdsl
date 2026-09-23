// MIG-B7-01 (FEAT-009): `placeholder` follows the requested tone, on the
// roles whose surface actually tints — never silently becoming `primary`
// when no tone is requested.
//
// The obvious-looking fix — reuse the `tone-<variant>` fallback pattern
// already written into theme/base.json for e.g. button hover states
// (`var(--uxdsl__button__tone-dark, var(--uxdsl__palette__primary-dark))`)
// — does not work here and is deliberately NOT what this file pins.
// compileRules' own regex substitution hard-codes its untoned fallback to
// the `primary` family (verified: it looks for the literal string
// `palette__primary-<variant>`), which is exactly right for a control whose
// whole design is "primary-colored unless told otherwise" (that is what
// already makes an untoned Button hover and an untoned Input caret both
// resolve to primary) — and exactly wrong for a placeholder, whose untoned
// default has to stay a neutral gray. Tried and rejected in the ficha's own
// evidence: reusing that pattern verbatim never substituted at all, because
// the fallback text did not match the regex the mechanism looks for; had it
// matched, no-tone would have silently become `primary.contrast` instead of
// staying gray.
//
// The actual fix lives in TypeScript (control-engine.ts's declarations()),
// reusing the same signal surfaceDeclarations already computes —
// `background === 'transparent'` distinguishes outlined/flat (untinted) from
// contained (tinted) — so a gray placeholder is left alone exactly where it
// already reads fine, and only overridden where the whole surface saturates.
//
// Where that fix actually lives matters for how this file verifies it.
// `declarations()` backs two different callers: `compileRules`/
// `generateInputCss` (emits the *theme* stylesheet's `:root` variables —
// `--uxdsl__input__<role>-tone-<tone>-base-placeholder` etc., one bucket per
// role/state/tone, built by regex-substituting the JSON literal) and
// `componentCss`/`inputComponentCss` (emits the actual per-selector rule a
// real `.foo { @ds-input(...); }` directive compiles to — this is what
// `checkThemeContrast` also evaluates directly, via `inputDeclarations`).
// This fix overrides `base.placeholder` inside `declarations()` itself, so it
// changes what `componentCss` emits (a direct `var(--uxdsl__palette__<tone>
// -contrast)` reference, bypassing the intermediate `:root` variable
// entirely for the tinted case) — but it does NOT and should not change what
// `compileRules` puts in `:root`: that variable simply becomes unused for
// this specific case, exactly as `bg`/`color`/`border` never had one to begin
// with. So verification here compiles real `@ds-input(...)` source through
// the actual plugin and reads the emitted `::placeholder` rule — not
// `generateInputCss`'s `:root` output, which this fix intentionally leaves
// alone and which would misleadingly still show the unsubstituted value.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { checkThemeContrast, resolveTheme } = require('../dist/ds-runtime');

const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const compile = (source, theme = {}) => postcss([plugin({ theme, includeTheme: false })]).process(source, { from: undefined });

/** Compiles a single `@ds-input(role [tone])` directive and reads the color
 * its real, compiled `::placeholder` rule carries — the thing a browser
 * actually renders, not an intermediate theme variable. */
async function placeholderColorFor(role, tone, theme) {
  const directive = tone ? `${role} ${tone}` : role;
  const { css } = await compile(`.f { @ds-input(${directive}); }`, theme);
  const match = css.match(/\.f::placeholder\s*\{\s*color:\s*([^;]+);/);
  if (!match) throw new Error(`::placeholder rule was never generated for @ds-input(${directive})`);
  return match[1].trim();
}

function fullTheme(overrides = {}) {
  return {
    spacing: FULL_SPACING,
    palette: {
      primary: { main: '#7e22ce', dark: '#581c87', contrast: '#ffffff' },
      secondary: { main: '#db2777', dark: '#be185d', contrast: '#ffffff' },
      surface: { main: '#ffffff', dark: '#8d929a', contrast: '#0f172a' },
      neutral: { main: '#64748b', dark: '#334155', contrast: '#ffffff' },
      error: { main: '#dc2626', dark: '#b91c1c', contrast: '#ffffff' },
    },
    ...overrides,
  };
}

test('MIG-B7-01: contained placeholder varies with the requested tone', async () => {
  const theme = fullTheme();
  const primary = await placeholderColorFor('contained', 'primary', theme);
  const secondary = await placeholderColorFor('contained', 'secondary', theme);
  const error = await placeholderColorFor('contained', 'error', theme);
  assert.notEqual(primary, secondary);
  assert.notEqual(primary, error);
  assert.equal(primary, 'var(--uxdsl__palette__primary-contrast)');
  assert.equal(secondary, 'var(--uxdsl__palette__secondary-contrast)');
  assert.equal(error, 'var(--uxdsl__palette__error-contrast)');
});

test('MIG-B7-01: no tone at all still resolves to the untoned gray, never to primary', async () => {
  // The exact regression this file exists to prevent: naively reusing the
  // hover-state substitution pattern would have made the untoned default
  // silently become palette(primary.contrast). It must not: this fix only
  // triggers when a tone is actually requested (`if (tone && ...)`), so the
  // untoned case must keep referencing the plain, never-substituted variable.
  const theme = fullTheme();
  const untoned = await placeholderColorFor('contained', '', theme);
  assert.equal(untoned, 'var(--uxdsl__input__contained-base-placeholder)');
  assert.doesNotMatch(untoned, /primary/);
});

test('MIG-B7-01: outlined and underline placeholders are untouched — the surface never tints there', async () => {
  const theme = fullTheme();
  for (const role of ['outlined', 'underline']) {
    const untoned = await placeholderColorFor(role, '', theme);
    const toned = await placeholderColorFor(role, 'error', theme);
    assert.equal(untoned, `var(--uxdsl__input__${role}-base-placeholder)`, `${role}: untoned`);
    // Still the old fallback-chain reference, unchanged: `composed.background`
    // is 'transparent' for these roles, so this fix's override never fires
    // and the pre-existing (always-a-no-op) mechanism-2 reference is left
    // exactly as it was — a gray placeholder over an always-white/transparent
    // surface never needed to change, and forcing it to the tone's own
    // contrast color (white, for most families) would make it disappear.
    assert.equal(toned, `var(--uxdsl__input__${role}-tone-error-base-placeholder, var(--uxdsl__input__${role}-base-placeholder))`, `${role}: toned reference unchanged too`);
  }
});

test('MIG-B7-01: Button is untouched — it has no placeholder field to trigger this at all', async () => {
  const theme = fullTheme();
  const css = (await compile('.b { @ds-button(contained primary); }', theme)).css;
  assert.doesNotMatch(css, /placeholder/, 'Button must never emit a placeholder rule');
});

test('MIG-B7-01: the contrast gate no longer reports the tinted-placeholder failures, and nothing else moved', () => {
  const exceptions = require('../src/theme/base.contrast-exceptions.json');
  const report = checkThemeContrast(resolveTheme(), { exceptions });
  const tintedPlaceholderFailures = report.failures.filter((f) => f.pair === 'placeholder' && f.tone !== null);
  assert.deepEqual(tintedPlaceholderFailures, [],
    `expected every toned placeholder pair to pass now, still failing: ${JSON.stringify(tintedPlaceholderFailures)}`);

  // The untoned dark-mode gap (neutral.dark itself not being dark-mode aware
  // enough against the default background) is a different, undiagnosed
  // finding — this fix does not and should not touch it. Pinned here so a
  // regression removing it silently is caught, and so this exact list is the
  // one MIG-B7-11's release gate is expected to still see.
  const remaining = report.failures.filter((f) => f.pair === 'placeholder');
  const signature = (f) => `${f.mode}/${f.family}/${f.component}/${f.tone}/${f.state}`;
  assert.deepEqual(
    [...new Set(remaining.map(signature))].sort(),
    ['dark/input/contained/null/base', 'dark/input/contained/null/focus', 'dark/input/contained/null/invalid',
     'dark/input/outlined/null/base', 'dark/input/outlined/null/focus', 'dark/input/outlined/null/invalid',
     'dark/input/underline/null/base', 'dark/input/underline/null/focus', 'dark/input/underline/null/invalid'].sort(),
    'the untoned dark-mode placeholder gap (out of scope here) should be exactly this set — investigate before editing this list');
});

test('MIG-B7-01: Button\'s own tone-state pattern (hover.bg etc.) is unaffected', () => {
  // Control: this fix must not have disturbed the *other* mechanism
  // (compileRules' regex substitution) that Button states and Input's own
  // caret still rely on.
  const exceptions = require('../src/theme/base.contrast-exceptions.json');
  const report = checkThemeContrast(resolveTheme(), { exceptions });
  assert.equal(report.failures.filter((f) => f.family === 'button').length, 47,
    'Button\'s failure count must be exactly what it was before this fix');
});
