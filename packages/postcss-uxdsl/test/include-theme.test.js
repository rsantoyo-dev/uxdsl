const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;

const theme = {
  breakpoints: { xs: 0, md: 800 },
  palette: { primary: { main: '#123456', dark: '#000', contrast: '#fff' } },
  spacing: { 1: '4px', 2: '8px' },
  fonts: { families: { ui: 'Inter' }, google: ['Inter:wght@400;700'] },
};

const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });

test('includeTheme: false skips every global :root definition, including density and typography', async () => {
  const source = '.card { @ds-surface(contained); @ds-typo(h1); padding: space(1); border-radius: radius(2); box-shadow: shadow(1); border: border(1); }';
  const result = await compile(source, { theme, includeTheme: false });
  assert(!/(^|[^-\w])\:root\b/.test(result.css), `unexpected :root in:\n${result.css}`);
  assert(!result.css.includes('@import'));
  // References still resolve against the effective (default + configured) theme.
  assert.match(result.css, /padding: var\(--surface-contained-padding\)/);
  assert.match(result.css, /padding: var\(--space-1\)/);
  assert.match(result.css, /border-radius: var\(--radius-2\)/);
  assert.match(result.css, /box-shadow: var\(--shadow-1\)/);
  assert.match(result.css, /border: var\(--border-1\)/);
  assert.match(result.css, /font-size: var\(--h1-size\)/);
});

test('includeTheme defaults to true and matches the explicit-true single-entry output', async () => {
  const source = '.card { @ds-surface(contained); }';
  const implicit = await compile(source, { theme });
  const explicit = await compile(source, { theme, includeTheme: true });
  assert.equal(implicit.css, explicit.css);
  assert(implicit.css.includes(':root'));
  assert(implicit.css.includes('--surface-contained-padding:'));
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
  assert(componentEntry.css.includes('var(--surface-contained-padding)'));
  assert(!componentEntry.css.includes('--surface-contained-padding:'));
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
