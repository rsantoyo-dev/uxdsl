const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateFoundationCss } = require('../dist/foundations');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');

// A realistic, otherwise-complete theme: full 1-16 spacing (DEFAULT_DENSITIES
// depends on the whole range) and the palette families the OTHER always-on
// defaults need (surfaces/buttons/inputs), but deliberately no colors.gray —
// that is exactly the one dependency MIG-04 is responsible for supplying.
// This lets these tests run with strict reference validation (the real
// default), instead of masking it with references: { mode: 'off' }, which
// would only prove the CSS text looks right, not that a strict compile
// actually succeeds.
const SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const PALETTE = {
  primary: { main: '#123', dark: '#111', contrast: '#fff' },
  surface: { main: '#fff', dark: '#eee', contrast: '#000' },
  neutral: { main: '#999', dark: '#333' },
  error: { main: '#f00' },
};

const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });

test('MIG-04: border(1..5) resolves out of the box, and validates in strict mode, with only a theme object', async () => {
  const theme = { spacing: SPACING, palette: PALETTE };
  const result = await compile('.x { border: border(1); }', { theme });
  assert.match(result.css, /border: var\(--uxdsl__border__1\)/);
  assert(result.css.includes('--uxdsl__color__gray-300:'));
  assert(result.css.includes('--uxdsl__border__1: 1px solid var(--uxdsl__color__gray-300)'));
});

test('MIG-04: a custom gray shade overrides the default without losing sibling shades', async () => {
  const theme = { colors: { gray: { 300: '#custom' } } };
  const css = generateFoundationCss(theme);
  assert(css.includes('--uxdsl__color__gray-300: #custom'));
  // 400/500/600 still fall back to the shipped defaults.
  assert(css.includes('--uxdsl__color__gray-400: #9ca3af'));
  assert(css.includes('--uxdsl__color__gray-500: #6b7280'));
  assert(css.includes('--uxdsl__color__gray-600: #4b5563'));
});

test('MIG-04: a theme overriding every DEFAULT_BORDERS key never needs the gray dependency to be correct, even though it is still emitted, and still validates strictly', async () => {
  const theme = {
    spacing: SPACING, palette: PALETTE, borders: {
      1: 'xs(1px solid palette(primary.main))', 2: 'xs(1px solid palette(primary.main))',
      3: 'xs(1px solid palette(primary.main))', 4: 'xs(1px solid palette(primary.main))', 5: 'xs(1px solid palette(primary.main))',
    },
  };
  const result = await compile('.x { border: border(1); }', { theme });
  assert.match(result.css, /border: var\(--uxdsl__border__1\)/);
  assert(result.css.includes('--uxdsl__border__1: 1px solid var(--uxdsl__palette__primary-main)'));
  // The gray dependency is still emitted (foundations always defines it —
  // same as DEFAULT_SHADOWS/DEFAULT_RADII always being emitted regardless
  // of use), but no border preset references it anymore.
  assert(!/--uxdsl__border__\d+:[^;]*gray/.test(result.css));
});

test('MIG-04: a component entry (includeTheme: false) resolves border() against the theme entry without re-emitting the gray dependency, in strict mode', async () => {
  // includeTheme: false still cross-validates against what the linked
  // theme entry (same theme object, includeTheme: true) would emit, so
  // that theme needs to cover border(2)'s own space(1) dependency — but,
  // per MIG-04, not colors.gray.
  const componentEntry = await compile('.card { border: border(2); }', { theme: { spacing: SPACING }, includeTheme: false });
  assert(!componentEntry.css.includes(':root'));
  assert.match(componentEntry.css, /border: var\(--uxdsl__border__2\)/);
});

test('MIG-04: a border preset supplied by an external stylesheet (no generated theme at all) is accepted when declared, in strict mode', async () => {
  // The consumer writes their own plain CSS defining --uxdsl__border__1..5 (and
  // whatever those declarations reference), bypassing edges.ts entirely —
  // no theme option, no includeTheme:true entry anywhere for this build.
  await assert.rejects(
    compile('.x { border: border(1); }', { includeTheme: false }),
    /UXD_REFERENCE_MISSING: border -> --uxdsl__border__1/,
    'sanity check: without a declared external token or a theme, border(1) still fails validation'
  );
  const result = await compile('.x { border: border(1); }', {
    includeTheme: false,
    references: { externalTokens: ['--uxdsl__border__1'] },
  });
  assert(!result.css.includes(':root'));
  assert.match(result.css, /border: var\(--uxdsl__border__1\)/);
});

test('MIG-04: PostCSS and the runtime theme generator emit the same gray dependency', () => {
  const theme = { colors: { gray: { 400: '#custom-400' } } };
  const foundation = generateFoundationCss(theme);
  const runtime = generateThemeCss(theme, { mode: 'off' });
  assert(foundation.includes('--uxdsl__color__gray-300: #d1d5db'));
  assert(foundation.includes('--uxdsl__color__gray-400: #custom-400'));
  assert(runtime.includes('--uxdsl__color__gray-300: #d1d5db'));
  assert(runtime.includes('--uxdsl__color__gray-400: #custom-400'));
});
