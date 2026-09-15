const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const plugin = require('../dist');
const language = require('../dist/language');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const defs = { 4: 'xs(space(4)) md(space(5)) xl(space(6))' };
// Full 1-16 spacing plus the palette families the always-on density/surface/
// button/input defaults need, so strict reference validation (every :root
// block the plugin, and generateThemeCss itself, always emits — not just
// what a given call's own definitions use) passes. See
// docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const BASE_PALETTE = { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999', dark: '#333' }, error: { main: '#f00' } };
const withBaseline = (extra = {}) => ({ spacing: FULL_SPACING, palette: BASE_PALETTE, ...extra });

function densityDeclarations(css) {
  const output = [];
  postcss.parse(css).walkDecls(/^--density-/, decl => {
    output.push([decl.parent.parent.type === 'atrule' ? decl.parent.parent.params : 'base', decl.prop, decl.value]);
  });
  return output;
}

test('shared module imports without a browser and preserves breakpoint compatibility export', () => {
  assert.equal(require('../dist/ds-runtime/breakpoints').DEFAULT_BREAKPOINTS, language.DEFAULT_BREAKPOINTS);
  assert.equal(typeof document, 'undefined');
});
test('Density preserves references and suppresses redundant breakpoints', () => {
  assert.deepEqual(language.compileDensityRules(defs).map(x => [x.minWidth, x.values['--density-4']]), [
    [null, 'var(--space-4)'], [768, 'var(--space-5)'], [1280, 'var(--space-6)'],
  ]);
});
test('runtime and PostCSS have equivalent Density declarations', async () => {
  const built = await postcss([plugin({ theme: withBaseline() })]).process('@theme { density-4: xs(space(4)) md(space(5)) xl(space(6)); } .card { padding: density(4); }', { from: undefined });
  assert.deepEqual(densityDeclarations(built.css), densityDeclarations(generateThemeCss(withBaseline({ densities: defs }))));
  assert.match(built.css, /padding: var\(--density-4\)/);
});
test('custom breakpoint values and input order are handled consistently', () => {
  const css = language.generateDensityCss({ 4: 'xl(space(6)) xs(space(4)) md(space(5))' }, { xl: 1600, xs: 0, md: 850 });
  assert.deepEqual(densityDeclarations(css).map(x => x[0]), ['base', '(min-width: 850px)', '(min-width: 1600px)']);
});
test('nested native expressions and quoted spacing references survive', () => {
  assert.equal(language.spacingValueToCss('calc(space("4") + 2px)'), 'calc(var(--space-4) + 2px)');
  assert.equal(language.resolveResponsiveValue('xs(calc(space(4) + 2px)) md(space(5))', 'xs', language.DEFAULT_BREAKPOINTS), 'calc(space(4) + 2px)');
  assert.equal(language.resolveResponsiveValue('rgb(10, 20, 30)', 'md', language.DEFAULT_BREAKPOINTS), 'rgb(10, 20, 30)');
});
test('container emitter uses scoped selector and shared rules', () => {
  const css = language.generateDensityCss(defs, language.DEFAULT_BREAKPOINTS, '.preview', 'container');
  assert.match(css, /@container \(min-width: 768px\)/);
  assert.match(css, /\.preview/);
  assert.doesNotMatch(css, /:root|@media/);
});
test('pure engine does not leak between calls or mutate definitions', () => {
  const before = JSON.stringify(defs);
  const first = language.generateDensityCss(defs);
  language.generateDensityCss({ 40: 'xs(space(1))' });
  assert.equal(language.generateDensityCss(defs), first);
  assert.equal(JSON.stringify(defs), before);
});
test('runtime recompiles Density after breakpoint changes', () => {
  assert.match(generateThemeCss(withBaseline({ densities: defs, breakpoints: { md: 900 } })), /min-width: 900px/);
});
test('invalid widths are rejected before serialization', () => {
  assert.throws(() => language.generateDensityCss(defs, { xs: 0, md: NaN }), /UXD_BP_INVALID/);
});

test('inspector distinguishes current breakpoint from inherited token rule', () => {
  assert.deepEqual(language.inspectResponsiveValue(defs[4], 1100, language.DEFAULT_BREAKPOINTS), {
    active: 'lg', applied: 'md', value: 'space(5)',
  });
});
test('inspector uses exact boundaries and responds to theme breakpoint changes', () => {
  for (const [width, applied] of [[767, 'xs'], [768, 'md'], [769, 'md'], [1279, 'md'], [1280, 'xl'], [1281, 'xl']]) {
    assert.equal(language.inspectResponsiveValue(defs[4], width, language.DEFAULT_BREAKPOINTS).applied, applied);
  }
  assert.equal(language.inspectResponsiveValue(defs[4], 800, { ...language.DEFAULT_BREAKPOINTS, md: 900 }).applied, 'xs');
});
test('inspector resolves edited mappings and static native values', () => {
  assert.equal(language.inspectResponsiveValue('xs(space(1)) md(space(2))', 1000, language.DEFAULT_BREAKPOINTS).value, 'space(2)');
  assert.deepEqual(language.inspectResponsiveValue('12px', 1000, language.DEFAULT_BREAKPOINTS), { active: 'md', applied: null, value: '12px' });
});
