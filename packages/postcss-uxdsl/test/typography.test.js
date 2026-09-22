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
    default: { fontFamily: 'var(--uxdsl__font__ui)', lineHeight: '1.5', fontWeight: '400' },
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
  assert.match(result.css, /font-size: var\(--uxdsl__typography__h1-size/);
  assert.match(result.css, /--uxdsl__space__4: 1rem/);
  assert.doesNotMatch(result.css, /font-size:.*xs\(/);
});
test('all configured fields inherit defaults and resolve custom breakpoints', () => {
  const rules = compileTypographyRules(theme.typography_details, theme.breakpoints);
  assert.equal(rules[0].values['--uxdsl__typography__h1-line'], '1.5');
  assert.equal(rules[0].values['--uxdsl__typography__h1-weight'], '700');
  assert.equal(rules[0].values['--uxdsl__typography__label-font-family'], 'var(--uxdsl__font__ui)');
  assert.equal(rules.find(r => r.minWidth === 800).values['--uxdsl__typography__label-transform'], 'uppercase');
  assert.deepEqual(rules.filter(r => r.values['--uxdsl__typography__h1-size']).map(r => r.minWidth), [null, 800, 1800]);
});
test('inspection agrees with generated rules around every threshold', () => {
  const expr = theme.typography_details.h1.fontSize;
  const rules = compileTypographyRules(theme.typography_details, theme.breakpoints);
  for (const threshold of Object.values(theme.breakpoints)) {
    for (const width of [threshold - 1, threshold, threshold + 1].filter(w => w >= 0)) {
      const expected = rules.filter(r => (r.minWidth ?? 0) <= width && r.values['--uxdsl__typography__h1-size']).at(-1).values['--uxdsl__typography__h1-size'];
      assert.equal(typographyValueToCss(inspectResponsiveValue(expr, width, theme.breakpoints).value), expected);
    }
  }
});
test('theme regeneration removes old declarations and moves thresholds without stale state', () => {
  const before = JSON.stringify(theme);
  const changed = { ...theme, breakpoints: { ...theme.breakpoints, md: 920 }, typography_details: { h1: { fontSize: 'xs(1rem) md(3rem)' } } };
  const css = generateTypographyCss(changed);
  assert.match(css, /min-width: 920px/);
  assert.doesNotMatch(css, /800px|--label-|--uxdsl__typography__h1-weight/);
  assert.equal(JSON.stringify(theme), before);
  assert.equal(generateTypographyCss(theme), generateTypographyCss(JSON.parse(before)));
});
test('native CSS, fractional and named tokens remain intact', () => {
  assert.equal(typographyValueToCss('clamp(space(0.5), 3vw, density(section))'), 'clamp(var(--uxdsl__space__0.5), 3vw, var(--uxdsl__density__section))');
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
  // Unlike typography_details (structured, role+field -> the shared
  // "typography" family), a flat `theme.typography` map is a pass-through
  // escape hatch: the JSON key IS the full variable name, verbatim. It is
  // not part of the `--uxdsl__<family>__<key>` contract and MIG-08 leaves
  // it untouched on purpose (the doc: "no se deben renombrar variables CSS
  // externas del consumidor" applies here too — this key is the
  // consumer's own choice, not one this compiler assigns).
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
  assert.equal(inspectTypographyTheme(input, 799)['--uxdsl__density__4'], 'var(--uxdsl__space__4)');
  assert.equal(inspectTypographyTheme(input, 800)['--uxdsl__density__4'], 'var(--uxdsl__space__5)');
  assert.equal(inspectTypographyTheme(input, 800)['--uxdsl__typography__h1-size'], 'var(--uxdsl__density__4)');
});
test('packaged data-typo selectors consume all configured properties', async () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../src/theme/default-typography.uxdsl'), 'utf8');
  // default-typography.uxdsl ships .ds-typo[data-typo="default"/"code"]
  // selectors unconditionally; a theme needs those two typography_details
  // roles for --uxdsl__typography__default-size/--uxdsl__typography__code-size to resolve (see MIG-04's note on
  // the shipped defaults not being fully self-contained).
  const built = await postcss([plugin({ theme: { spacing: FULL_SPACING, palette: BASE_PALETTE, typography_details: { default: { fontSize: '1rem' }, code: { fontSize: '0.9rem' } } } })]).process(source, { from: undefined });
  const rule = postcss.parse(built.css).nodes.find(n => n.selector === '.ds-typo[data-typo="h1"]');
  const props = Object.fromEntries(rule.nodes.map(d => [d.prop, d.value]));
  // MIG-B6-17 (FEAT-008): one declaration per field the effective theme
  // defines for this role, referencing the variable with no literal fallback.
  // This used to assert the opposite — `var(…, none)`, `var(…, normal)` and
  // `var(…, auto)` for fields the theme never defined at all.
  assert.equal(props['margin-block-end'], 'var(--uxdsl__typography__h1-margin-block-end)');
  assert.equal(props['font-family'], 'var(--uxdsl__typography__h1-font-family)');
  assert.equal(props['font-size'], 'var(--uxdsl__typography__h1-size)');
  // The base theme defines no textTransform/fontStyle for h1, so the packaged
  // selector must not invent them.
  assert.equal(props['text-transform'], undefined);
  assert.equal(props['font-style'], undefined);
  assert.equal(props['text-decoration'], undefined);
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

// --- MIG-B6-17 (FEAT-008): @ds-typo emits only what the theme defines ---
// The directive used to emit a fixed list of 10-11 declarations whose literal
// fallbacks came from a hardcoded map, not the theme: `auto` margins (which
// absorb free space in flex/grid instead of collapsing to 0), a
// `text-decoration: none` that stripped link underlines, `text-transform` /
// `font-style` resets, and an `opacity` that was impossible to override from
// JSON because it is not one of TYPOGRAPHY_PROPERTIES' fields at all.

const compileWithBase = (css, options = {}) =>
  postcss([plugin({ includeTheme: false, ...options })]).process(css, { from: 'typo.uxdsl' });

const emitted = (css) => {
  const rule = postcss.parse(css).first;
  return Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(d => [d.prop, d.value]));
};

test('MIG-B6-17: the ficha\'s own reproduction no longer emits auto, an implicit none, or opacity', async () => {
  const result = await compileWithBase('.eyebrow { margin: 0; @ds-typo(caption); }');
  const props = emitted(result.css);

  assert.equal(props['opacity'], undefined, 'opacity was never a theme field and must not be invented');
  assert.equal(props['text-decoration'], undefined, 'inventing text-decoration: none strips link underlines (WCAG 1.4.1)');
  assert.equal(props['text-transform'], undefined);
  assert.equal(props['font-style'], undefined);
  for (const value of Object.values(props)) {
    assert.doesNotMatch(value, /,/, `no declaration may carry a literal fallback any more: ${value}`);
  }
  // The declaration written before the directive keeps its place and value.
  assert.equal(props['margin'], '0');
  // Margins are still emitted, but now because theme/base.json genuinely
  // defines them ("0"), not as an invented `auto`.
  assert.equal(props['margin-block-start'], 'var(--uxdsl__typography__caption-margin-block-start)');
});

test('MIG-B6-17: a role the theme does not define fails with a location instead of silently becoming default', async () => {
  const error = await compileWithBase('.a {\n  @ds-typo(nope);\n}').then(() => null, (caught) => caught);
  assert.ok(error, 'an unknown role must not compile');
  assert.match(error.reason, /^UXD_TYPO_REFERENCE: ds-typo\(nope\) does not exist/);
  assert.equal(error.line, 2);
});

test('MIG-B6-17: a custom role with only fontSize inherits default\'s other fields, in the directive and the generator alike', async () => {
  const custom = { typography_details: { 'card-title': { fontSize: '2rem' } } };
  const result = await compileWithBase('.card h2 { @ds-typo(card-title); }', { theme: custom });
  const props = emitted(result.css);
  // Its own field, plus every field `default` contributes.
  assert.equal(props['font-size'], 'var(--uxdsl__typography__card-title-size)');
  assert.equal(props['font-weight'], 'var(--uxdsl__typography__card-title-weight)');
  assert.equal(props['font-family'], 'var(--uxdsl__typography__card-title-font-family)');

  // The generator defines every variable the directive just referenced —
  // without a fallback, a mismatch here would silently render nothing.
  const generated = generateThemeCss(custom);
  for (const value of Object.values(props)) {
    const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
    if (name) assert.ok(generated.includes(`${name}:`), `generator must define ${name}`);
  }
});

test('MIG-B6-17: defining textDecoration in the theme makes it emitted again', async () => {
  const withDecoration = { typography_details: { caption: { textDecoration: 'underline' } } };
  const result = await compileWithBase('.a { @ds-typo(caption); }', { theme: withDecoration });
  assert.equal(emitted(result.css)['text-decoration'], 'var(--uxdsl__typography__caption-decoration)');
  assert.match(generateThemeCss(withDecoration), /--uxdsl__typography__caption-decoration:\s*underline/);
});

test('MIG-B6-17: a later declaration still overrides the directive, and two directives keep their positions', async () => {
  const result = await compileWithBase('.a { @ds-typo(h1); font-size: 3rem; }');
  const order = postcss.parse(result.css).first.nodes.filter(n => n.type === 'decl').map(d => d.prop);
  assert.equal(order[order.length - 1], 'font-size', 'a declaration written after the directive stays last and wins');

  const two = await compileWithBase('.a { @ds-typo(h1); color: red; @ds-typo(caption); }');
  const props = postcss.parse(two.css).first.nodes.filter(n => n.type === 'decl').map(d => d.prop);
  assert.ok(props.indexOf('color') > 0 && props.indexOf('color') < props.length - 1, 'the mid-rule declaration keeps its position between both directives');
});

test('MIG-B6-17 snapshot: every base-theme role emits exactly its theme-defined fields, and nothing dangles', async () => {
  const { resolveTheme } = require('../dist/default-theme');
  const { inspectTypographyTheme } = require('../dist/typography');
  const base = resolveTheme();
  const defined = inspectTypographyTheme(base, 0);
  const roles = Object.keys(base.typography_details).filter(r => r !== 'default').sort();

  // The approved "after" inventory (step 1 of this story): the base theme
  // defines fontFamily/fontSize/lineHeight/fontWeight/letterSpacing plus the
  // two margins for every role, so every role emits these seven and no more.
  const expected = ['font-family', 'font-size', 'line-height', 'font-weight', 'letter-spacing', 'margin-block-start', 'margin-block-end'];
  for (const role of roles) {
    const result = await compileWithBase(`.probe { @ds-typo(${role}); }`);
    const props = emitted(result.css);
    assert.deepEqual(Object.keys(props), expected, `role ${role}`);
    for (const [prop, value] of Object.entries(props)) {
      const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
      assert.ok(name, `${role}.${prop} must be a bare var() reference, got ${value}`);
      assert.ok(Object.prototype.hasOwnProperty.call(defined, name), `${role}.${prop} references ${name}, which the theme never defines`);
    }
  }
});

test('MIG-B6-17: the CSS-property map and the variable-suffix map cannot drift apart', () => {
  const { TYPOGRAPHY_PROPERTIES, TYPOGRAPHY_CSS_PROPERTIES } = require('../dist/typography');
  // applyTypo reads one key from each for the same field, so a field present
  // in only one of them would either emit a declaration naming a variable the
  // generator never defines, or silently stop being emitted at all.
  assert.deepEqual(Object.keys(TYPOGRAPHY_CSS_PROPERTIES).sort(), Object.keys(TYPOGRAPHY_PROPERTIES).sort());
});
