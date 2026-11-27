// The "Use it in your project" examples of the Live theme handler (src/lib/usage-snippets.js):
// every stylesheet compiles through the real PostCSS plugin against every named theme, for
// every token and role a tab can select, and every excerpt is a valid part of a theme.
const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const uxdsl = require('uxdsl/postcss');
const { validateTheme, deepMergeTheme } = require('uxdsl/theme');
const packagedBase = require('uxdsl/theme/base.json');
const { themes } = require('../themes');
const u = require('../src/lib/usage-snippets.js');

const TONES = ['', 'primary', 'success'];

async function compiles(theme, stylesheet, label) {
  const result = await postcss([uxdsl({ theme })]).process(stylesheet, { from: 'example.css' });
  assert.ok(!result.css.includes('@ds-'), `${label}: a directive was left uncompiled`);
  assert.ok(!/\b(?:density|space|palette|radius|border|shadow)\(|(?<![-\w])color\(/.test(result.css.replace(/var\([^)]*\)/g, '')), `${label}: a token was left uncompiled`);
  return result;
}

function excerptValid(excerpt, label) {
  const checked = validateTheme(deepMergeTheme(packagedBase, excerpt));
  assert.ok(checked.ok, `${label}: ${JSON.stringify(checked.errors)}`);
}

test('every tab example compiles against every named theme', async () => {
  for (const [name, theme] of Object.entries(themes)) {
    const cases = [];
    for (const family of Object.keys(theme.palette)) cases.push([`palette ${family}`, u.paletteUsage(theme, family)]);
    for (const [family, entry] of Object.entries(theme.colors)) {
      for (const key of typeof entry === 'string' ? [family] : Object.keys(entry).map((shade) => `${family}.${shade}`)) cases.push([`color ${key}`, u.colorsUsage(theme, key)]);
    }
    cases.push(['breakpoints', u.breakpointsUsage(theme.breakpoints)]);
    for (const key of Object.keys(theme.densities)) cases.push([`density ${key}`, u.densityUsage(theme, key)]);
    for (const key of Object.keys(theme.spacing)) cases.push([`space ${key}`, u.spacingUsage(theme, key)]);
    for (const role of Object.keys(theme.typography_details)) cases.push([`typo ${role}`, u.typographyUsage(theme, role)]);
    for (const kind of ['borders', 'radii']) for (const key of Object.keys(theme[kind])) cases.push([`${kind} ${key}`, u.edgeUsage(theme, kind, key)]);
    for (const key of Object.keys(theme.shadows)) cases.push([`shadow ${key}`, u.shadowUsage(theme, key)]);
    for (const role of Object.keys(theme.surfaces)) for (const tone of TONES) cases.push([`surface ${role} ${tone}`, u.surfaceUsage(theme, role, tone)]);
    for (const family of ['buttons', 'inputs']) for (const role of Object.keys(theme[family])) for (const tone of TONES) cases.push([`${family} ${role} ${tone}`, u.controlUsage(theme, family, role, tone)]);
    for (const [label, usage] of cases) {
      await compiles(theme, usage.stylesheet, `${name}: ${label}`);
      excerptValid(usage.excerpt, `${name}: ${label}`);
    }
  }
});

test('the project example: the file, the marker and the components compile', async () => {
  const usage = u.projectUsage(themes.green);
  const file = JSON.parse(usage.file);
  const { $schema, ...override } = file;
  const theme = deepMergeTheme(packagedBase, override);
  const result = await compiles(theme, usage.stylesheet, 'project');
  assert.match(result.css, /--uxdsl__palette__primary-main:/, 'the marker emits the theme');
  assert.match(usage.runtime, /applyTheme\(theme, \{ replace: true \}\)/);
  // The runtime example imports the downloaded file as it is, `$schema` included.
  assert.ok($schema, 'the file names its schema');
  const whole = validateTheme(deepMergeTheme(packagedBase, file));
  assert.ok(whole.ok, JSON.stringify(whole.errors));
  assert.deepEqual(whole.warnings, [], 'the schema key is not an unknown family');
});

test('the examples name the selection', () => {
  const theme = themes.default;
  assert.match(u.densityUsage(theme, '7').stylesheet, /padding: density\(7\);/);
  assert.match(u.densityUsage(theme, '7').stylesheet, /gap: density\(7\);/);
  assert.match(u.typographyUsage(theme, 'caption').stylesheet, /^\.caption \{\n  @ds-typo\(caption\);/);
  assert.match(u.typographyUsage(theme, 'h1').stylesheet, /^\.page-title \{/);
  assert.equal(u.typographySelector('a-role-added-later'), '.text');
  assert.match(u.spacingUsage(theme, '6').stylesheet, /width: space\(6\);/);
  assert.match(u.colorsUsage(theme, 'purple.700').stylesheet, /background: color\(purple\.700, 0\.5\);/);
  assert.deepEqual(u.colorsUsage(theme, 'purple.700').excerpt, { colors: { purple: { 700: theme.colors.purple['700'] } } });
  assert.deepEqual(u.colorsUsage(theme, 'white').excerpt, { colors: { white: theme.colors.white } });
  assert.match(u.controlUsage(theme, 'inputs', 'underline', 'error').stylesheet, /@ds-input\(underline error\);/);
  assert.match(u.surfaceUsage(theme, 'flat', '').stylesheet, /@ds-surface\(flat\);/);
  assert.deepEqual(Object.keys(u.paletteUsage(theme, 'primary').excerpt), ['palette', 'modes']);
});
