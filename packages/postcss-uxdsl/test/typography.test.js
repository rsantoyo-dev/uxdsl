const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const plugin = require('../dist');
const { compileTypographyRules, generateTypographyCss, typographyValueToCss } = require('../dist/typography');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const { validateAndNormalizeTheme } = require('../dist/ds-runtime/theme-validate');
const { inspectResponsiveValue } = require('../dist/language');
// Full 1-16 spacing (this file's own 4/5/6 win) plus the palette families
// the always-on density/surface/button/input defaults need, so strict
// reference validation (every :root block the plugin always emits, not
// just what this file's source uses) passes. See
// docs/features/FEAT-002-beta-migration-hardening.md.
const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const BASE_PALETTE = { primary: { main: '#123', dark: '#111', contrast: '#fff' }, surface: { main: '#fff', dark: '#eee', contrast: '#000' }, neutral: { main: '#999', dark: '#333' }, error: { main: '#f00' } };
const theme = {
  breakpoints: { xs: 0, sm: 480, md: 800, lg: 1100, xl: 1400, wide: 1800 },
  spacing: { ...FULL_SPACING, 4: '1rem', 5: '1.5rem', 6: '2rem' },
  palette: BASE_PALETTE,
  fonts: { families: { ui: 'Inter, sans-serif' } },
  typography_details: {
    default: { fontFamily: 'var(--font-ui)', lineHeight: '1.5', fontWeight: '400' },
    h1: { fontSize: 'xs(space(4)) md(calc(space(5) + 2px)) wide(space(6))', fontWeight: '700' },
    label: { fontSize: '0.875rem', textTransform: 'xs(none) md(uppercase)' }
  }
};
function declarations(css) {
  const result = [];
  postcss.parse(css).walkDecls(/^--(?:h1|label|default|font)-/, d => {
    result.push([d.parent.parent.type === 'atrule' ? d.parent.parent.params : 'base', d.prop, d.value]);
  });
  return result.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
test('PostCSS and runtime emit equivalent Typography from the same JSON', async () => {
  const result = await postcss([plugin({ theme })]).process('.title { @ds-typo(h1); }', { from: undefined });
  assert.deepEqual(declarations(result.css), declarations(generateThemeCss(theme)));
  assert.match(result.css, /font-size: var\(--h1-size/);
  assert.match(result.css, /--space-4: 1rem/);
  assert.doesNotMatch(result.css, /font-size:.*xs\(/);
});
test('all configured fields inherit defaults and resolve custom breakpoints', () => {
  const rules = compileTypographyRules(theme.typography_details, theme.breakpoints);
  assert.equal(rules[0].values['--h1-line'], '1.5');
  assert.equal(rules[0].values['--h1-weight'], '700');
  assert.equal(rules[0].values['--label-font-family'], 'var(--font-ui)');
  assert.equal(rules.find(r => r.minWidth === 800).values['--label-transform'], 'uppercase');
  assert.deepEqual(rules.filter(r => r.values['--h1-size']).map(r => r.minWidth), [null, 800, 1800]);
});
test('inspection agrees with generated rules around every threshold', () => {
  const expr = theme.typography_details.h1.fontSize;
  const rules = compileTypographyRules(theme.typography_details, theme.breakpoints);
  for (const threshold of Object.values(theme.breakpoints)) {
    for (const width of [threshold - 1, threshold, threshold + 1].filter(w => w >= 0)) {
      const expected = rules.filter(r => (r.minWidth ?? 0) <= width && r.values['--h1-size']).at(-1).values['--h1-size'];
      assert.equal(typographyValueToCss(inspectResponsiveValue(expr, width, theme.breakpoints).value), expected);
    }
  }
});
test('theme regeneration removes old declarations and moves thresholds without stale state', () => {
  const before = JSON.stringify(theme);
  const changed = { ...theme, breakpoints: { ...theme.breakpoints, md: 920 }, typography_details: { h1: { fontSize: 'xs(1rem) md(3rem)' } } };
  const css = generateTypographyCss(changed);
  assert.match(css, /min-width: 920px/);
  assert.doesNotMatch(css, /800px|--label-|--h1-weight/);
  assert.equal(JSON.stringify(theme), before);
  assert.equal(generateTypographyCss(theme), generateTypographyCss(JSON.parse(before)));
});
test('native CSS, fractional and named tokens remain intact', () => {
  assert.equal(typographyValueToCss('clamp(space(0.5), 3vw, density(section))'), 'clamp(var(--space-0.5), 3vw, var(--density-section))');
});
test('invalid definitions fail in the shared compiler and theme validator', () => {
  for (const details of [{ h1: { fontSize: 'md(2rem)' } }, { h1: { bogus: '2rem' } }, { h1: { fontSize: '' } }]) {
    assert.throws(() => compileTypographyRules(details), /UXD_TYPO_/);
    assert.equal(validateAndNormalizeTheme({ typography_details: details }).ok, false);
  }
  assert.throws(() => compileTypographyRules(theme.typography_details, { xs: 0, md: NaN }), /UXD_TYPO_BP/);
  const validated = validateAndNormalizeTheme(theme);
  assert.equal(validated.ok, true);
  assert.equal(validated.theme.breakpoints.wide, 1800);
});
test('legacy flat typography and font variables remain supported', () => {
  assert.match(generateTypographyCss({ typography: { 'h1-size': '2rem' }, fonts: { families: { ui: 'sans-serif' } } }), /--h1-size: 2rem;/);
});
test('legacy responsive variables remain equivalent in both adapters', async () => {
  const input = { spacing: FULL_SPACING, palette: BASE_PALETTE, typography: { 'h1-size': 'xs(space(4)) md(3rem)' } };
  const built = await postcss([plugin({ theme: input })]).process('', { from: undefined });
  assert.deepEqual(declarations(built.css), declarations(generateThemeCss(input)));
});
test('preview scopes Density and Typography to the same simulated viewport', () => {
  const { inspectTypographyTheme } = require('../dist/typography');
  const input = { ...theme, densities: { 4: 'xs(space(4)) md(space(5))' }, typography_details: { h1: { fontSize: 'density(4)' } } };
  assert.equal(inspectTypographyTheme(input, 799)['--density-4'], 'var(--space-4)');
  assert.equal(inspectTypographyTheme(input, 800)['--density-4'], 'var(--space-5)');
  assert.equal(inspectTypographyTheme(input, 800)['--h1-size'], 'var(--density-4)');
});
test('packaged data-typo selectors consume all configured properties', async () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../src/theme/default-typography.uxdsl'), 'utf8');
  // default-typography.uxdsl ships .ds-typo[data-typo="default"/"code"]
  // selectors unconditionally; a theme needs those two typography_details
  // roles for --default-size/--code-size to resolve (see MIG-04's note on
  // the shipped defaults not being fully self-contained).
  const built = await postcss([plugin({ theme: { spacing: FULL_SPACING, palette: BASE_PALETTE, typography_details: { default: { fontSize: '1rem' }, code: { fontSize: '0.9rem' } } } })]).process(source, { from: undefined });
  const rule = postcss.parse(built.css).nodes.find(n => n.selector === '.ds-typo[data-typo="h1"]');
  const props = Object.fromEntries(rule.nodes.map(d => [d.prop, d.value]));
  assert.equal(props['text-transform'], 'var(--h1-transform, none)');
  assert.equal(props['font-style'], 'var(--h1-style, normal)');
  assert.equal(props['margin-block-end'], 'var(--h1-margin-block-end, auto)');
});
test('switching theme breakpoint maps can remove previous custom names', () => {
  const runtime = require('../dist/ds-runtime/index');
  const previousDocument = global.document;
  global.document = { querySelectorAll: () => [], styleSheets: [] };
  try {
    runtime.applyBreakpoints({ wide: 1800 }, { replace: true });
    assert.equal(runtime.getBreakpoints().wide, 1800);
    runtime.applyBreakpoints({ md: 900 }, { replace: true });
    assert.equal(runtime.getBreakpoints().wide, undefined);
    assert.equal(runtime.getBreakpoints().md, 900);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});
