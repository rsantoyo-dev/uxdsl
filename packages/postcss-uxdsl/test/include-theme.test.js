const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;

// Full 1-16 spacing (this file's own 1/2 win) plus the palette families the
// always-on density/surface/button/input defaults need, and an h1 typo
// role, so strict reference validation (every :root block the plugin
// always emits, not just what a given source uses) passes. See
// docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const theme = {
  breakpoints: { xs: 0, md: 800 },
  palette: {
    primary: { main: '#123456', dark: '#000', contrast: '#fff' },
    surface: { main: '#fff', dark: '#eee', contrast: '#000' },
    neutral: { main: '#999', dark: '#333' },
    error: { main: '#f00' },
  },
  spacing: { ...FULL_SPACING, 1: '4px', 2: '8px' },
  typography_details: { h1: { fontSize: '2rem' } },
  fonts: { families: { ui: 'Inter' }, google: ['Inter:wght@400;700'] },
};

const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });

test('includeTheme: false skips every global :root definition, including density and typography', async () => {
  const source = '.card { @ds-surface(contained); @ds-typo(h1); padding: space(1); border-radius: radius(2); box-shadow: shadow(1); border: border(1); }';
  const result = await compile(source, { theme, includeTheme: false });
  assert(!/(^|[^-\w])\:root\b/.test(result.css), `unexpected :root in:\n${result.css}`);
  assert(!result.css.includes('@import'));
  // References still resolve against the effective (default + configured) theme.
  assert.match(result.css, /padding: var\(--uxdsl__surface__contained-padding\)/);
  assert.match(result.css, /padding: var\(--uxdsl__space__1\)/);
  assert.match(result.css, /border-radius: var\(--uxdsl__radius__2\)/);
  assert.match(result.css, /box-shadow: var\(--uxdsl__shadow__1\)/);
  assert.match(result.css, /border: var\(--uxdsl__border__1\)/);
  assert.match(result.css, /font-size: var\(--uxdsl__typography__h1-size\)/);
});

test('includeTheme defaults to true and matches the explicit-true single-entry output', async () => {
  const source = '.card { @ds-surface(contained); }';
  const implicit = await compile(source, { theme });
  const explicit = await compile(source, { theme, includeTheme: true });
  assert.equal(implicit.css, explicit.css);
  assert(implicit.css.includes(':root'));
  assert(implicit.css.includes('--uxdsl__surface__contained-padding:'));
  assert(implicit.css.includes('@import'));
});

test('a theme entry (includeTheme: true) and a component entry (includeTheme: false) compose without duplicate definitions', async () => {
  const themeEntry = await compile('', { theme, includeTheme: true });
  const componentEntry = await compile('.card { @ds-surface(contained); }', { theme, includeTheme: false });
  const combined = `${themeEntry.css}\n${componentEntry.css}`;
  const rootBlocks = combined.match(/:root\s*\{/g) || [];
  // Density alone emits a base :root plus one per non-base breakpoint; the
  // component entry must not add any of its own.
  const soloRootBlocks = (themeEntry.css.match(/:root\s*\{/g) || []).length;
  assert.equal(rootBlocks.length, soloRootBlocks);
  assert(componentEntry.css.includes('var(--uxdsl__surface__contained-padding)'));
  assert(!componentEntry.css.includes('--uxdsl__surface__contained-padding:'));
});

test('includeTheme: false still validates references and rejects unknown tokens', async () => {
  await assert.rejects(compile('.x { @ds-surface(missing); }', { theme, includeTheme: false }));
  await assert.rejects(compile('.x { color: shadow(missing); }', { theme, includeTheme: false }));
  await assert.rejects(compile('.x { @ds-button(contained); }', { includeTheme: false, theme: { surfaces: { contained: null } } }));
});

test('consecutive compilations with different includeTheme values do not leak state', async () => {
  const first = await compile('.a { @ds-surface(contained); }', { theme, includeTheme: false });
  const second = await compile('.b { @ds-surface(contained); }', { theme, includeTheme: true });
  const third = await compile('.c { @ds-surface(contained); }', { theme, includeTheme: false });
  assert(!first.css.includes(':root'));
  assert(second.css.includes(':root'));
  assert(!third.css.includes(':root'));
  assert.equal(first.css.replace('.a', '.x'), third.css.replace('.c', '.x'));
});
