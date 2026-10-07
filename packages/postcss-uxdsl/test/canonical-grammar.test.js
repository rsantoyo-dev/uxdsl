'use strict';

// Stability phase 3 (audit 2026-09-29, DE-5; findings L4, L5, L7, L8, L9, L10,
// L15, L16): one grammar for token functions and directives. Every accepted
// spelling compiles to the same output as before; every other spelling is a
// located UXD_* error — nothing passes through to CSS as text.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const runtime = require('../dist/ds-runtime');
const language = require('../dist/language');

const compile = (source, options = {}) => postcss([plugin({ discoverTheme: false, includeTheme: false, ...options })]).process(source, { from: '/project/src/app.uxdsl' }).css;
function failure(source, options) {
  try { compile(source, options); } catch (error) { return error; }
  return assert.fail(`expected ${JSON.stringify(source)} to fail, but it compiled`);
}
/** `[code, reason]` of the located error a source fails with. */
function errorOf(source, options) {
  const error = failure(source, options);
  assert.equal(error.name, 'CssSyntaxError', `${source} must fail with a located error, got ${error.message}`);
  assert.equal(error.file, '/project/src/app.uxdsl');
  assert.ok(error.line >= 1 && error.column >= 1);
  return [error.reason.match(/^(UXD_[A-Z_]+):/)?.[1], error.reason];
}

// --- Token functions ---------------------------------------------------------

test('token functions: exactly one argument for space/density/radius/shadow/border', () => {
  for (const [source, code, mention] of [
    ['.a { border: border(1, red, dashed); }', 'UXD_EDGE_ARGUMENT', 'border(1)'],
    ['.a { border-radius: radius(2, 3); }', 'UXD_EDGE_ARGUMENT', 'radius(2)'],
    ['.a { padding: space(4, 0.5); }', 'UXD_SPACE_ARGUMENT', 'space(4)'],
    ['.a { padding: density(4, 2); }', 'UXD_DENSITY_ARGUMENT', 'density(4)'],
    ['.a { box-shadow: shadow(1, 2); }', 'UXD_SHADOW_ARGUMENT', 'shadow(1)'],
    ['.a { padding: space(); }', 'UXD_SPACE_ARGUMENT', 'space('],
    ['.a { color: palette(primary, 0.5, 1); }', 'UXD_PALETTE_ARGUMENT', 'palette('],
    ['.a { color: color(gray.300, 0.5, 1); }', 'UXD_COLOR_ARGUMENT', 'color('],
  ]) {
    const [actual, reason] = errorOf(source);
    assert.equal(actual, code, reason);
    assert.ok(reason.includes(mention), reason);
  }
  // Theme values: the same grammar, the same codes, on both paths.
  for (const [theme, code] of [
    [{ borders: { x: 'border(1, red)' } }, 'UXD_EDGE_ARGUMENT'],
    [{ radii: { x: 'space(1, 2)' } }, 'UXD_SPACE_ARGUMENT'],
    [{ surfaces: { contained: { shadow: 'shadow(1, 2)' } } }, 'UXD_SHADOW_ARGUMENT'],
  ]) {
    assert.throws(() => runtime.generateThemeCss(theme), new RegExp(code));
    assert.throws(() => compile('.a { color: red; }', { theme, includeTheme: true }), new RegExp(code));
  }
});

test('token functions: an alpha is optional on palette()/color() only, and stays UXD_TOKEN_ALPHA when invalid', () => {
  assert.equal(compile('.a { color: palette(primary, 0.5); background: color(gray.300, .25); }'),
    '.a { color: color-mix(in srgb, var(--uxdsl__palette__primary-main) 50%, transparent); background: color-mix(in srgb, var(--uxdsl__color__gray-300) 25%, transparent); }');
  for (const source of ['.a { color: palette(primary, 2); }', '.a { color: color(gray.300, x); }', '.a { color: palette(primary, ); }']) {
    assert.equal(errorOf(source)[0], 'UXD_TOKEN_ALPHA', source);
  }
});

test('token functions: references are validated at rewrite time with a "did you mean"', () => {
  for (const [source, code, pattern] of [
    ['.a { padding: space(99); }', 'UXD_SPACE_REFERENCE', /space\(99\) does not exist; available keys: 1–16/],
    ['.a { padding: space(guter); }', 'UXD_SPACE_REFERENCE', /Did you mean "gutter"/],
    ['.a { color: palette(primary.mian); }', 'UXD_PALETTE_REFERENCE', /palette\(primary\.mian\) does not exist; primary has: main, light, dark, contrast\. Did you mean "main"/],
    ['.a { color: palette(primry); }', 'UXD_PALETTE_REFERENCE', /palette\(primry\) does not exist; available families: .*Did you mean "primary"/],
    ['.a { color: color(gray.350); }', 'UXD_COLOR_REFERENCE', /color\(gray\.350\) does not exist; gray has: 300, 400, 500, 600/],
    ['.a { color: color(grey.300); }', 'UXD_COLOR_REFERENCE', /Did you mean "gray"/],
    ['.a { padding: density(99); }', 'UXD_DENSITY_REFERENCE', /density\(99\) does not exist/],
  ]) {
    const [actual, reason] = errorOf(source, { theme: { spacing: { gutter: '1rem' } } });
    assert.equal(actual, code, reason);
    assert.match(reason, pattern);
  }
  // …and the error points at the declaration, even with references off.
  const error = failure('.a {\n  color: red;\n  margin: space(99);\n}', { references: { mode: 'off' } });
  assert.equal(error.line, 3);
  assert.match(error.reason, /^UXD_SPACE_REFERENCE/);
});

test('token functions and breakpoint functions: names are case-insensitive and normalized', () => {
  assert.equal(compile('.a { padding: Space(1); color: PALETTE(primary); margin: MD(2rem) xs(1rem); gap: Density(2); }'),
    compile('.a { padding: space(1); color: palette(primary); margin: md(2rem) xs(1rem); gap: density(2); }'));
  assert.equal(compile('.a { border-radius: RADIUS(PILL); }'), '.a { border-radius: 9999px; }');
  assert.equal(compile('.a { padding: space(1); }'), '.a { padding: var(--uxdsl__space__1); }');
});

test('palette()/color(): the dotted path is the only spelling', () => {
  assert.equal(compile('.a { color: palette(primary.main); background: palette(primary); border-color: color(gray.300); }'),
    '.a { color: var(--uxdsl__palette__primary-main); background: var(--uxdsl__palette__primary-main); border-color: var(--uxdsl__color__gray-300); }');
  for (const [source, code, suggestion] of [
    ['.a { color: palette(primary-main); }', 'UXD_PALETTE_SYNTAX', 'palette(primary.main)'],
    ['.a { color: palette(surface-contrast, 0.5); }', 'UXD_PALETTE_SYNTAX', 'palette(surface.contrast, 0.5)'],
    ['.a { color: palette(text-primary); }', 'UXD_PALETTE_SYNTAX', 'palette(text.primary)'],
    ['.a { color: color(gray-300); }', 'UXD_COLOR_SYNTAX', 'color(gray.300)'],
    ['.a { color: palette(a.b.c); }', 'UXD_PALETTE_SYNTAX', 'palette(family.variant)'],
  ]) {
    const [actual, reason] = errorOf(source);
    assert.equal(actual, code, reason);
    assert.ok(reason.includes(suggestion), reason);
  }
  // A family whose own name contains a dash stays expressible, as written.
  const theme = { palette: { 'text-primary': { main: '#111', dark: '#000', contrast: '#fff' } } };
  assert.equal(compile('.a { color: palette(text-primary); background: palette(text-primary.dark); }', { theme }),
    '.a { color: var(--uxdsl__palette__text-primary-main); background: var(--uxdsl__palette__text-primary-dark); }');
  // A theme value with the dashed spelling is refused the same way.
  assert.throws(() => runtime.generateThemeCss({ surfaces: { contained: { bg: 'palette(surface-main)' } } }), /UXD_PALETTE_SYNTAX: .*palette\(surface\.main\)/);
  assert.throws(() => compile('.a { color: red; }', { theme: { surfaces: { contained: { bg: 'palette(surface-main)' } } }, includeTheme: true }), /UXD_PALETTE_SYNTAX/);
});

test('token keys are bare: a quoted key is UXD_TOKEN_KEY', () => {
  for (const source of ['.a { padding: space("1"); }', ".a { color: palette('primary'); }", '.a { border-radius: radius("pill"); }']) {
    assert.equal(errorOf(source)[0], 'UXD_TOKEN_KEY', source);
  }
});

// --- Directives --------------------------------------------------------------

const CANONICAL = {
  surface: compile('.a { @ds-surface(contained primary 2 radius(pill) shadow(1)); }'),
  button: compile('.a { @ds-button(outlined secondary 1 shadow(2)); }'),
  input: compile('.a { @ds-input(underline primary radius(3)); }'),
  typo: compile('.a { @ds-typo(h1); }'),
};

test('directives: one grammar, @ds-x(role [tone] [size] [radius(k)] [shadow(k)]), is the reference output', () => {
  assert.match(CANONICAL.surface, /background: var\(--uxdsl__palette__primary-main\)/);
  assert.match(CANONICAL.surface, /padding: var\(--uxdsl__density__2\)/);
  assert.match(CANONICAL.surface, /border-radius: 9999px/);
  assert.match(CANONICAL.surface, /box-shadow: var\(--uxdsl__shadow__1\)/);
  assert.match(CANONICAL.button, /\.a:hover:not\(:where\(:disabled, \[aria-disabled="true"\]\)\) \{/);
  assert.match(CANONICAL.input, /\.a::placeholder \{/);
  assert.match(CANONICAL.typo, /font-size: var\(--uxdsl__typography__h1-/);
  // Whitespace inside the parentheses, and letter case, do not matter.
  assert.equal(compile('.a { @ds-surface(  contained   primary  2   radius(pill)  shadow(1) ); }'), CANONICAL.surface);
  assert.equal(compile('.a { @DS-SURFACE(CONTAINED Primary 2 RADIUS(pill) Shadow(1)); }'), CANONICAL.surface);
  assert.equal(compile('.a { @ds-typo(H1); }'), CANONICAL.typo);
});

for (const [source, code, mention] of [
  ['.a { @ds-surface (contained); }', 'UXD_SURFACE_ARGUMENT', '@ds-surface(contained)'],
  ['.a { @ds-surface contained; }', 'UXD_SURFACE_ARGUMENT', '@ds-surface(contained)'],
  ['.a { @ds-surface; }', 'UXD_SURFACE_ARGUMENT', '@ds-surface(role'],
  ['.a { @ds-surface(); }', 'UXD_SURFACE_ARGUMENT', 'role'],
  ['.a { @ds-surface(contained, primary, 2); }', 'UXD_SURFACE_ARGUMENT', 'space'],
  ['.a { @ds-surface(2 primary contained); }', 'UXD_SURFACE_ARGUMENT', 'role'],
  ['.a { @ds-surface(contained primary secondary); }', 'UXD_SURFACE_ARGUMENT', 'secondary'],
  ['.a { @ds-surface(contained 2 3); }', 'UXD_SURFACE_ARGUMENT', '3'],
  ['.a { @ds-surface(contained radius(1) radius(2)); }', 'UXD_SURFACE_ARGUMENT', 'radius('],
  ['.a { @ds-surface(contained density(0)); }', 'UXD_SURFACE_ARGUMENT', 'density(0)'],
  ['.a { @ds-surface(contained) !important; }', 'UXD_SURFACE_ARGUMENT', '!important'],
  ['.a { @ds-surface(contained text); }', 'UXD_SURFACE_TONE', '"text" is not a tone'],
  ['.a { @ds-surface(contained bogus); }', 'UXD_SURFACE_TONE', '"bogus" is not a tone'],
  ['.a { @ds-surface(primary); }', 'UXD_SURFACE_REFERENCE', 'primary'],
  ['.a { @ds-surface(glass); }', 'UXD_SURFACE_REFERENCE', 'glass'],
  ['.a { @ds-surface(contained 99); }', 'UXD_SURFACE_SIZE', '99'],
  ['.a { @ds-button(contained text); }', 'UXD_BUTTON_TONE', '"text" is not a tone'],
  ['.a { @ds-button(contained, primary); }', 'UXD_BUTTON_ARGUMENT', 'space'],
  ['.a { @ds-button (contained); }', 'UXD_BUTTON_ARGUMENT', '@ds-button(contained)'],
  ['.a { @ds-input(outlined divider); }', 'UXD_INPUT_TONE', '"divider" is not a tone'],
  ['.a { @ds-input(outlined shadow(1) shadow(2)); }', 'UXD_INPUT_ARGUMENT', 'shadow('],
  ['.a { @ds-typo(h1 h2); }', 'UXD_TYPO_ARGUMENT', 'h2'],
  ['.a { @ds-typo(); }', 'UXD_TYPO_ARGUMENT', 'role'],
  ['.a { @ds-typo h1; }', 'UXD_TYPO_ARGUMENT', '@ds-typo(h1)'],
  ['.a { @ds-typo(h1) !important; }', 'UXD_TYPO_ARGUMENT', '!important'],
]) {
  test(`directive grammar: ${source.trim()} fails with ${code}`, () => {
    const [actual, reason] = errorOf(source);
    assert.equal(actual, code, reason);
    assert.ok(reason.includes(mention), `${reason} should mention ${mention}`);
  });
}

test('directive grammar: the tone error lists the real tone families', () => {
  const [, reason] = errorOf('.a { @ds-surface(contained text); }');
  const tones = language.getToneFamilies(runtime.DEFAULT_THEME.palette);
  for (const tone of tones) assert.ok(reason.includes(tone), `${reason} should list ${tone}`);
  assert.doesNotMatch(reason, /\btext\b.*\bdivider\b/, 'partial families are not offered as tones');
});

test('a second control directive in the same rule is UXD_DIRECTIVE_DUPLICATE', () => {
  for (const source of [
    '.a { @ds-button(contained); @ds-button(outlined); }',
    '.a { @ds-input(outlined); @ds-input(contained); }',
    '.a { @ds-button(contained); @ds-input(outlined); }',
  ]) {
    const error = failure(source);
    assert.match(error.reason, /^UXD_DIRECTIVE_DUPLICATE: /, source);
    assert.equal(error.column, source.indexOf('@ds-', 10) + 1, 'located at the second directive');
  }
  // A control after a surface is composition; a repeated surface or
  // typography directive, like a plain declaration after a directive, is
  // ordinary cascade: the later one wins.
  assert.match(compile('.a { @ds-surface(contained); @ds-button(outlined); }'), /\.a:hover/);
  assert.match(compile('.a { @ds-surface(contained); @ds-surface(flat); }'), /flat-bg/);
  assert.match(compile('.a { @ds-typo(h1); @ds-typo(h2); }'), /h2-/);
  const overridden = compile('.a { @ds-surface(contained); padding: 0; }');
  assert.ok(overridden.indexOf('padding: var(--uxdsl__surface__contained-padding);') < overridden.indexOf('padding: 0;'));
});

test('an unknown or misspelled directive is still UXD_DIRECTIVE_UNKNOWN, case-insensitively', () => {
  assert.equal(errorOf('.a { @ds-surfaces(contained); }')[0], 'UXD_DIRECTIVE_UNKNOWN');
  assert.equal(errorOf('.a { @DS-CARD(contained); }')[0], 'UXD_DIRECTIVE_UNKNOWN');
});

test('the public argument parsers follow the same grammar', () => {
  const { parseSurfaceArguments } = require('../dist/surfaces');
  const { parseButtonArguments } = require('../dist/buttons');
  const { parseInputArguments } = require('../dist/inputs');
  const theme = runtime.resolveTheme({});
  assert.deepEqual(parseSurfaceArguments(theme, 'contained primary 2 radius(pill) shadow(1)'), { role: 'contained', tone: 'primary', size: '2', radius: 'pill', shadow: '1' });
  assert.deepEqual(parseButtonArguments(theme, 'outlined'), { role: 'outlined', tone: '', size: '', radius: '', shadow: '' });
  assert.deepEqual(parseInputArguments(theme, 'UNDERLINE Primary'), { role: 'underline', tone: 'primary', size: '', radius: '', shadow: '' });
  assert.throws(() => parseSurfaceArguments(theme, 'contained, primary'), /UXD_SURFACE_ARGUMENT/);
  assert.throws(() => parseButtonArguments(theme, 'contained text'), /UXD_BUTTON_TONE/);
  assert.throws(() => parseInputArguments(theme, 'outlined radius(1) radius(2)'), /UXD_INPUT_ARGUMENT/);
  assert.throws(() => parseSurfaceArguments(theme, ''), /UXD_SURFACE_ARGUMENT/);
});
