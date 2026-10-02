'use strict';

// Stability phase 1 (audit 2026-09-29, finding T6): `tone(main|dark|contrast)`
// replaces the regex-over-a-magic-literal contract Buttons and Inputs used for
// tone substitution. Until now only a value spelled *exactly*
// `var(--uxdsl__button__tone-X, var(--uxdsl__palette__primary-X))` varied by
// tone; `states.hover.bg: 'palette(primary.dark)'` silently did not. The base
// theme carried that literal 17 times. `tone(X)` compiles to that same chain in
// the untoned variable and to the tone's own variant in the per-tone one, so the
// rewrite of theme/base.json is byte-identical in compiled CSS — proved below by
// compiling the old literal form (kept here as an override) against the new base.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateThemeCss, resolveTheme, inspectButtonTheme, inspectInputTheme, buttonDeclarations } = require('../dist/ds-runtime');
const { toneReferences } = require('../dist/control-engine');
const base = require('../src/theme/base.json');

const compile = (source, theme = {}, options = {}) => postcss([plugin({ theme, discoverTheme: false, ...options })]).process(source, { from: undefined }).css;

/** theme/base.json's buttons/inputs/palette exactly as they were spelled before
 * this phase: the hand-written fallback chains and the compiled palette names. */
const chain = (family, variant) => `var(--uxdsl__${family}__tone-${variant}, var(--uxdsl__palette__primary-${variant}))`;
const LEGACY_FORM = {
  palette: {
    surface: { paper: 'var(--uxdsl__palette__surface-light)', subtle: 'var(--uxdsl__palette__surface-dark)' },
    text: { main: 'var(--uxdsl__palette__text-primary)', primary: 'var(--uxdsl__palette__surface-contrast)', secondary: 'var(--uxdsl__palette__neutral-dark)', disabled: 'var(--uxdsl__palette__tertiary-main)' },
    divider: { main: 'var(--uxdsl__palette__surface-dark)' },
    action: { disabled: 'var(--uxdsl__palette__text-disabled)' },
  },
  buttons: {
    contained: { states: { hover: { bg: chain('button', 'dark'), color: chain('button', 'contrast') }, selected: { bg: chain('button', 'dark'), color: chain('button', 'contrast') } } },
    outlined: { states: { hover: { color: chain('button', 'dark'), border: `1px solid ${chain('button', 'dark')}` }, selected: { bg: chain('button', 'main'), color: chain('button', 'contrast'), border: `1px solid ${chain('button', 'main')}` } } },
    flat: { states: { hover: { color: chain('button', 'dark') }, selected: { color: chain('button', 'dark') } } },
  },
  inputs: {
    contained: { base: { caret: chain('input', 'main') }, states: { focus: { border: `1px solid ${chain('input', 'main')}` } } },
    outlined: { base: { caret: chain('input', 'main') }, states: { focus: { border: `1px solid ${chain('input', 'main')}` } } },
    underline: { base: { caret: chain('input', 'main') }, states: { focus: { underline: `1px solid ${chain('input', 'main')}` } } },
  },
};

test('tone(): theme/base.json is written with tone() and palette() — no compiled variable names left in it', () => {
  const text = JSON.stringify(base);
  assert.doesNotMatch(text, /var\(--uxdsl__(?:button|input)__tone-/, 'the literal fallback chain is gone from the base theme');
  assert.doesNotMatch(text, /var\(--uxdsl__palette__/, 'palette aliases reference palette(), not the compiled name');
  assert.equal((text.match(/tone\((?:main|dark|contrast)\)/g) || []).length, 17, 'the 17 former literals are now tone()');
});

test('tone(): the base theme compiles byte-identically to its former literal spelling, on both paths', () => {
  const rewritten = generateThemeCss(resolveTheme({}));
  const legacy = generateThemeCss(resolveTheme(LEGACY_FORM));
  assert.equal(legacy, rewritten, 'generateThemeCss: the legacy literal form must compile to the same bytes as tone()');
  assert.equal(compile('', LEGACY_FORM), compile('', {}), 'the plugin too');
  // Sanity: the override really restores the old spelling.
  assert.equal(resolveTheme(LEGACY_FORM).buttons.contained.states.hover.bg, chain('button', 'dark'));
  assert.equal(resolveTheme({}).buttons.contained.states.hover.bg, 'tone(dark)');
});

test('tone(): compiles to the fallback chain untoned and to the family variant per tone', () => {
  const theme = { palette: { brand: { main: '#111', dark: '#000', contrast: '#fff' } }, buttons: { cta: { states: { hover: { bg: 'tone(dark)', color: 'tone(contrast)', border: '1px solid tone(main)' } } } } };
  const values = inspectButtonTheme(theme, 0);
  assert.equal(values['--uxdsl__button__cta-hover-bg'], 'var(--uxdsl__button__tone-dark, var(--uxdsl__palette__primary-dark))');
  assert.equal(values['--uxdsl__button__cta-hover-border'], '1px solid var(--uxdsl__button__tone-main, var(--uxdsl__palette__primary-main))');
  assert.equal(values['--uxdsl__button__cta-tone-brand-hover-bg'], 'var(--uxdsl__palette__brand-dark)');
  assert.equal(values['--uxdsl__button__cta-tone-brand-hover-color'], 'var(--uxdsl__palette__brand-contrast)');
  assert.equal(values['--uxdsl__button__cta-tone-brand-hover-border'], '1px solid var(--uxdsl__palette__brand-main)');
  // The component references the tone variant with the untoned fallback, as before.
  assert.equal(buttonDeclarations(theme, 'cta', 'brand').states.hover.background, 'var(--uxdsl__button__cta-tone-brand-hover-bg, var(--uxdsl__button__cta-hover-bg))');
});

test('tone(): works inside a responsive group and in an Input value', () => {
  const theme = { palette: { brand: { main: '#111', dark: '#000', contrast: '#fff' } }, inputs: { search: { base: { caret: 'xs(tone(main)) md(tone(dark))' } } } };
  assert.equal(inspectInputTheme(theme, 0)['--uxdsl__input__search-base-caret'], 'var(--uxdsl__input__tone-main, var(--uxdsl__palette__primary-main))');
  assert.equal(inspectInputTheme(theme, 768)['--uxdsl__input__search-base-caret'], 'var(--uxdsl__input__tone-dark, var(--uxdsl__palette__primary-dark))');
  assert.equal(inspectInputTheme(theme, 768)['--uxdsl__input__search-tone-brand-base-caret'], 'var(--uxdsl__palette__brand-dark)');
});

test('tone(): a value that is not the magic literal now varies by tone when it says tone(), and still does not when it names a family', () => {
  const theme = { palette: { brand: { main: '#111', dark: '#000', contrast: '#fff' } }, buttons: { a: { states: { hover: { bg: 'tone(dark)' } } }, b: { states: { hover: { bg: 'palette(primary.dark)' } } } } };
  const values = inspectButtonTheme(theme, 0);
  assert.equal(values['--uxdsl__button__a-tone-brand-hover-bg'], 'var(--uxdsl__palette__brand-dark)');
  // An explicit Palette reference keeps its configured meaning (the audit's
  // T6 reproduction): it is primary, whichever tone the component asks for.
  assert.equal(values['--uxdsl__button__b-hover-bg'], 'var(--uxdsl__palette__primary-dark)');
  assert.equal(values['--uxdsl__button__b-tone-brand-hover-bg'] ?? values['--uxdsl__button__b-hover-bg'], 'var(--uxdsl__palette__primary-dark)');
});

test('tone() (deprecated literal): the hand-written fallback chain is still substituted for one release', () => {
  assert.equal(toneReferences(chain('button', 'dark'), 'button', 'brand', (m) => new Error(m)), 'var(--uxdsl__palette__brand-dark)');
  assert.equal(toneReferences(chain('button', 'dark'), 'button', null, (m) => new Error(m)), chain('button', 'dark'));
  assert.equal(toneReferences('tone(dark)', 'button', null, (m) => new Error(m)), chain('button', 'dark'));
});

test('tone(): an unknown variant is the family\'s own error', () => {
  assert.throws(() => generateThemeCss({ buttons: { contained: { states: { hover: { bg: 'tone(light)' } } } } }), /UXD_BUTTON_TONE: tone\(light\)/);
  assert.throws(() => generateThemeCss({ inputs: { contained: { base: { caret: 'tone(primary)' } } } }), /UXD_INPUT_TONE: tone\(primary\)/);
  assert.throws(() => compile('.a {}', { buttons: { contained: { states: { hover: { bg: 'tone(light)' } } } } }), /UXD_BUTTON_TONE/);
});

test('tone(): outside buttons/inputs it is UXD_TONE_CONTEXT — in a Surface, a Palette, a Typography field and an author declaration', () => {
  for (const theme of [
    { surfaces: { contained: { bg: 'tone(main)' } } },
    { palette: { brand: { main: 'tone(main)' } } },
    { typography_details: { h1: { letterSpacing: 'tone(main)' } } },
    { radii: { 1: 'tone(main)' } },
  ]) {
    assert.throws(() => generateThemeCss(theme), /UXD_TONE_CONTEXT/, JSON.stringify(theme));
    assert.throws(() => compile('.a {}', theme), /UXD_TONE_CONTEXT/, JSON.stringify(theme));
  }
  let caught;
  try { compile('.a {\n  color: tone(main);\n}'); } catch (error) { caught = error; }
  assert.ok(caught);
  assert.match(caught.reason || caught.message, /UXD_TONE_CONTEXT/);
  assert.equal(caught.line, 2);
});

test('tone(): a legacy @theme pack may use it too, and compiles like the JSON form', async () => {
  const pack = '@theme { button-cta: { @ds-surface(contained); :hover { bg: tone(dark); color: tone(contrast); } } }';
  const viaPack = compile(`${pack} .b { @ds-button(cta); }`);
  const viaJson = compile('.b { @ds-button(cta); }', { buttons: { cta: { surface: 'contained', states: { hover: { bg: 'tone(dark)', color: 'tone(contrast)' } } } } });
  // The removed @theme block leaves a different raw before `.b`, so compare
  // the declarations, not the whitespace between rules.
  const ctaVariables = (css) => Object.fromEntries([...css.matchAll(/(--uxdsl__button__cta-[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
  assert.ok(Object.keys(ctaVariables(viaJson)).length > 0);
  assert.deepEqual(ctaVariables(viaPack), ctaVariables(viaJson));
  assert.equal(viaPack.match(/\.b:hover \{[^}]*\}/)[0], viaJson.match(/\.b:hover \{[^}]*\}/)[0]);
  assert.match(viaJson, /--uxdsl__button__cta-hover-bg: var\(--uxdsl__button__tone-dark, var\(--uxdsl__palette__primary-dark\)\);/);
});

// --- Audit T8: a per-tone variant only when the tone changes the value --------

test('T8: a per-tone variant is emitted only when the tone changes the value', () => {
  const theme = { palette: { brand: { main: '#111', dark: '#000', contrast: '#fff' } }, buttons: { cta: { base: { opacity: '0.9' }, states: { hover: { bg: 'tone(dark)', opacity: '0.6', border: '1px solid palette(error.main)' } } } } };
  const values = inspectButtonTheme(theme, 0);
  assert.equal(values['--uxdsl__button__cta-tone-brand-hover-bg'], 'var(--uxdsl__palette__brand-dark)');
  for (const name of ['--uxdsl__button__cta-tone-brand-hover-opacity', '--uxdsl__button__cta-tone-brand-hover-border', '--uxdsl__button__cta-tone-brand-base-opacity']) {
    assert.equal(values[name], undefined, `${name} is an identical copy and must not be emitted`);
  }
  assert.equal(values['--uxdsl__button__cta-hover-opacity'], '0.6');
  // The consumer keeps referencing the variant with the untoned fallback, so
  // an omitted variant resolves to the value the copy used to carry.
  const { states } = buttonDeclarations(theme, 'cta', 'brand');
  assert.equal(states.hover.opacity, 'var(--uxdsl__button__cta-tone-brand-hover-opacity, var(--uxdsl__button__cta-hover-opacity))');
});

test('T8: the default output loses every identical tone copy and nothing else', () => {
  const css = generateThemeCss(resolveTheme({}));
  const declarations = css.match(/--[\w-]+\s*:/g) || [];
  const toneDeclarations = declarations.filter((d) => /-tone-/.test(d));
  // Before T8: 745 declarations, 341 of them tone variants, 617 unique names.
  assert.equal(declarations.length, 745 - 341 + toneDeclarations.length);
  assert.ok(toneDeclarations.length > 0 && toneDeclarations.length < 341, `expected fewer than 341 tone variants, got ${toneDeclarations.length}`);
  // Every remaining variant differs from its untoned sibling.
  const map = Object.fromEntries([...css.matchAll(/(--uxdsl__(?:button|input)__[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
  let checked = 0;
  for (const [name, value] of Object.entries(map)) {
    const match = name.match(/^(--uxdsl__(?:button|input)__[a-z0-9]+)-tone-[a-z0-9-]+?-(base|hover|active|focus|focusvisible|disabled|selected|readonly|invalid)-([\w-]+)$/);
    if (!match) continue;
    const untoned = `${match[1]}-${match[2]}-${match[3]}`;
    assert.ok(untoned in map, `${name} has no untoned sibling ${untoned}`);
    assert.notEqual(value, map[untoned], `${name} is identical to ${untoned} and should have been omitted`);
    checked++;
  }
  assert.ok(checked > 0);
});

test('T8: the contrast gate resolves through the fallback, so its verdict on the base theme is unchanged', () => {
  const { checkThemeContrast } = require('../dist/ds-runtime');
  const exceptions = require('../src/theme/base.contrast-exceptions.json');
  const report = checkThemeContrast(resolveTheme(), { exceptions });
  assert.equal(report.failures.filter((f) => f.family === 'button').length, 47);
  assert.equal(report.failures.length, 123);
  assert.deepEqual(report.failures.filter((f) => /unresolved/.test(f.reason || '')), []);
});

test('T8: making a value tone-independent at run time is a value change, not a structural one', () => {
  const runtime = require('../dist/ds-runtime');
  const byId = new Map();
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tag) { const attributes = {}; return { tagName: tag.toUpperCase(), id: '', textContent: '', setAttribute(n, v) { attributes[n] = v; }, getAttribute(n) { return n in attributes ? attributes[n] : null; } }; },
    getElementById(id) { return byId.get(id) || null; },
    head: { appendChild(node) { if (node.id) byId.set(node.id, node); return node; } },
  };
  try {
    require('../dist/ds-runtime/apply-theme').__resetThemeStateForTests();
    assert.equal(runtime.applyTheme({}, { replace: true }).ok, true);
    // contained.hover.bg goes from tone(dark) (a variant per tone family) to
    // a fixed color (none): the variants disappear, and every compiled
    // reference falls back to the role's own variable.
    const result = runtime.applyTheme({ buttons: { contained: { states: { hover: { bg: '#123456' } } } } });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    assert.doesNotMatch(byId.get('uxdsl-theme').textContent, /--uxdsl__button__contained-tone-[a-z]+-hover-bg:/);
  } finally {
    globalThis.document = previous;
  }
});
