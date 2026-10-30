'use strict';

// A misspelled UXDSL function never reaches the browser as an unknown CSS
// function: `padding: spacing(2)` and `color: palete(primary.main)` fail where
// they are written, naming the function the author meant. A real CSS function
// the compiler does not know is left untouched, so the rule fires only near a
// UXDSL name — a token function, tone(), or a breakpoint of the effective theme.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const postcss = require('postcss');

const exported = require('../dist/plugin');
const plugin = exported.default || exported;
const core = require('../dist/entries/index.js');
const { generateThemeCss, resolveTheme, validateTheme } = require('./helpers/ds-runtime');

const file = path.join(process.cwd(), 'src', 'panel.uxdsl');
const throughPlugin = (css, opts = {}) => postcss([plugin({ includeTheme: false, discoverTheme: false, ...opts })]).process(css, { from: file });
const throughCompile = (source, opts = {}) => core.compile({ source, from: file }, { includeTheme: false, discoverTheme: false, ...opts });
const failure = (promise) => promise.then(() => null, (error) => error);

const unknownFunction = (name, suggestion) => `UXD_FUNCTION_UNKNOWN: ${name}() is not a function CSS or UXDSL knows; did you mean ${suggestion}()?`;

/** [the call as written, the name as written, the UXDSL function meant] */
const NEAR_MISSES = [
  ['spacing(2)', 'spacing', 'space'],
  ['palete(primary.main)', 'palete', 'palette'],
  ['densty(2)', 'densty', 'density'],
  ['SPACING(2)', 'SPACING', 'space'],
  ['colour(gray.300)', 'colour', 'color'],
  ['pallete(primary.main)', 'pallete', 'palette'],
  ['pallet(primary.main)', 'pallet', 'palette'],
  ['radii(2)', 'radii', 'radius'],
  ['borders(1)', 'borders', 'border'],
  ['shadows(2)', 'shadows', 'shadow'],
  ['tne(main)', 'tne', 'tone'],
];

test('MIG-B9-04: spacing(), palete(), densty() and SPACING() are UXD_FUNCTION_UNKNOWN with the right suggestion, located', async () => {
  for (const [call, name, suggestion] of NEAR_MISSES) {
    const source = `.a {\n  padding: ${call};\n}\n`;
    const viaPlugin = await failure(throughPlugin(source));
    assert.ok(viaPlugin, `${call} fails through uxdsl/postcss`);
    assert.equal(viaPlugin.reason || viaPlugin.message.replace(/^.*?: (?=UXD_)/, ''), unknownFunction(name, suggestion), call);
    assert.equal(viaPlugin.name, 'CssSyntaxError', `${call} is located`);
    assert.equal(viaPlugin.line, 2, `${call} is located at the declaration`);
    assert.equal(viaPlugin.file, file);

    const viaCompile = await failure(throughCompile(source));
    assert.ok(viaCompile, `${call} fails through compile()`);
    assert.match(viaCompile.message, new RegExp(unknownFunction(name, suggestion).replace(/[()?.]/g, '\\$&')));
  }

  // Control: the canonical spellings compile to their variables in the same run.
  const ok = await throughPlugin('.a { padding: space(2); color: palette(primary.main); gap: density(2); }');
  assert.match(ok.css, /padding: var\(--uxdsl__space__2\)/);
  assert.match(ok.css, /color: var\(--uxdsl__palette__primary-main\)/);
  assert.match(ok.css, /gap: var\(--uxdsl__density__2\)/);

  // Control: a top-level name one edit from a breakpoint stays the breakpoint
  // check's error, which lists the configured names.
  const breakpointTypo = await failure(throughPlugin('.a { padding: xd(1rem); }'));
  assert.match(breakpointTypo.message, /UXD_BREAKPOINT_UNKNOWN: xd\(\.\.\.\)/);
  assert.doesNotMatch(breakpointTypo.message, /UXD_FUNCTION_UNKNOWN/);
});

test('MIG-B9-04 (negative control): log(), rem(), mod(), calc(), color-mix(), -webkit-foo() and a custom breakpoint xxl() are never flagged', async () => {
  const untouched = [
    'log(1, 2)', 'rem(10, 3)', 'mod(10, 3)', 'sign(-1)', 'exp(1)',
    'calc(1px + 1px)', 'color-mix(in srgb, red, blue)',
    '-webkit-foo(1)', '-moz-spcae(1)',
    'shape(from 0 0, line to 10px 10px)',
    'counter(x)', 'circle(50%)', 'ray(45deg)', 'inset(10px)', 'image(red)',
  ];
  for (const call of untouched) {
    const source = `.a { width: ${call}; }`;
    const result = await throughPlugin(source);
    assert.equal(result.css, source, `${call} passes through byte for byte`);
    assert.equal((await throughCompile(source)).css, source, `${call} passes through compile() byte for byte`);
  }

  // A breakpoint the effective theme defines is a breakpoint, however close
  // its name is to xl.
  const theme = { breakpoints: { xxl: 1536 } };
  const responsive = await throughPlugin('.a { padding: xs(1rem) xxl(2rem); }', { theme });
  assert.match(responsive.css, /padding: 1rem/);
  assert.match(responsive.css, /min-width: 1536px/);
  const alone = await throughPlugin('.a { padding: xxl(2rem); }', { theme });
  assert.match(alone.css, /min-width: 1536px/);
  const inTheme = generateThemeCss(resolveTheme({ ...theme, densities: { wide: 'xs(space(1)) xxl(space(2))' } }));
  assert.match(inTheme, /--uxdsl__density__wide: var\(--uxdsl__space__2\)/);
});

test('MIG-B9-04: a far name such as foo(1) passes through untouched', async () => {
  for (const call of ['foo(1)', 'myfn(1px, 2px)', 'notAFunction(1)']) {
    const source = `.a { width: ${call}; }`;
    assert.equal((await throughPlugin(source)).css, source, call);
    assert.equal((await throughCompile(source)).css, source, call);
  }
});

test('MIG-B9-04: a theme value spelled spacing(2) fails with the suggestion in its message', async () => {
  const expected = new RegExp(unknownFunction('spacing', 'space').replace(/[()?.]/g, '\\$&'));

  // Nested in a breakpoint group — the owner's own example — and at the top level.
  for (const value of ['xs(spacing(2))', 'xs(spacing(2)) md(space(3))', 'spacing(2)']) {
    const theme = resolveTheme({ densities: { gutter: value } });
    assert.throws(() => generateThemeCss(theme), expected, `generateThemeCss: ${value}`);
    const report = validateTheme(theme);
    assert.equal(report.ok, false, `validateTheme: ${value}`);
    assert.deepEqual(report.errors.map((error) => error.code), ['UXD_FUNCTION_UNKNOWN'], `validateTheme: ${value}`);
    assert.match(report.errors[0].message, expected);
    const viaPlugin = await failure(throughPlugin('.a { padding: density(gutter); }', { includeTheme: true, theme: { densities: { gutter: value } } }));
    assert.ok(viaPlugin, `the plugin: ${value}`);
    assert.match(viaPlugin.message, expected);
  }

  // A Surface field and a Palette value go through the same grammar.
  assert.throws(() => generateThemeCss(resolveTheme({ surfaces: { contained: { padding: 'xs(spacing(2))' } } })), expected);
  assert.throws(() => generateThemeCss(resolveTheme({ palette: { brand: { main: 'colour(gray.300)' } } })), new RegExp(unknownFunction('colour', 'color').replace(/[()?.]/g, '\\$&')));

  // Control: the canonical spelling compiles.
  assert.match(generateThemeCss(resolveTheme({ densities: { gutter: 'xs(space(2))' } })), /--uxdsl__density__gutter: var\(--uxdsl__space__2\)/);
});

test('MIG-B9-04: numeric did-you-mean names the nearest keys (space(17) → 16; color(gray.350) → 340 or 400)', async () => {
  // The base theme's Spacing scale ends at 16: only a lower neighbour exists.
  const space = await failure(throughPlugin('.a { padding: space(17); }'));
  assert.match(space.message, /UXD_SPACE_REFERENCE: space\(17\) does not exist/);
  assert.match(space.message, /Did you mean "16"\?/);

  // The base theme's gray has both 340 and 400 around 350.
  const gray = await failure(throughPlugin('.a { color: color(gray.350); }'));
  assert.match(gray.message, /UXD_COLOR_REFERENCE: color\(gray\.350\) does not exist/);
  assert.match(gray.message, /Did you mean "340" or "400"\?/);

  // Planted key lists: without 340 the lower neighbour is 300; with 345 it is 345.
  const brand = (shades) => ({ colors: { brand: Object.fromEntries(shades.map((shade) => [shade, '#777'])) } });
  const without340 = await failure(throughPlugin('.a { color: color(brand.350); }', { theme: brand([300, 400, 500]) }));
  assert.match(without340.message, /Did you mean "300" or "400"\?/);
  const with345 = await failure(throughPlugin('.a { color: color(brand.350); }', { theme: brand([300, 345, 400]) }));
  assert.match(with345.message, /Did you mean "345" or "400"\?/);
  // A numeric key is never matched by spelling: 50 is one edit from 350 and is not offered.
  const spelled = await failure(throughPlugin('.a { color: color(brand.350); }', { theme: brand([50, 100, 900]) }));
  assert.match(spelled.message, /Did you mean "100" or "900"\?/);
  const above = await failure(throughPlugin('.a { color: color(brand.950); }', { theme: brand([50, 900]) }));
  assert.match(above.message, /Did you mean "900"\?/);

  // Control: a non-numeric key keeps the spelling suggestion.
  const variant = await failure(throughPlugin('.a { color: palette(primary.mian); }'));
  assert.match(variant.message, /UXD_PALETTE_REFERENCE: palette\(primary\.mian\) does not exist/);
  assert.match(variant.message, /Did you mean "main"\?/);
});
