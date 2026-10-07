'use strict';

// Stability phase 3 (audit 2026-09-29, DE-4): every legacy or duplicate
// language surface is removed, and each removed spelling fails with a located
// UXD_* error that names its replacement — it never reaches CSS untouched and
// never keeps working quietly.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const runtime = require('../dist/ds-runtime');
const language = require('../dist/language');

const packageRoot = path.resolve(__dirname, '..');
const compile = (source, options = {}) => postcss([plugin({ discoverTheme: false, includeTheme: false, ...options })]).process(source, { from: '/project/src/app.uxdsl' }).css;
/** The error a source fails with: code, line and column are the located part. */
function failure(source, options) {
  try { compile(source, options); } catch (error) { return error; }
  return assert.fail(`expected ${JSON.stringify(source)} to fail, but it compiled`);
}

test('@theme { … } is removed: UXD_THEME_BLOCK_REMOVED, located, naming the theme JSON', () => {
  const error = failure('.a { color: red; }\n@theme {\n  radius-2: 99px;\n}\n.b { border-radius: radius(2); }');
  assert.equal(error.name, 'CssSyntaxError');
  assert.match(error.reason, /^UXD_THEME_BLOCK_REMOVED: /);
  assert.match(error.reason, /theme JSON/);
  assert.equal(error.line, 2);
  assert.equal(error.column, 1);
  assert.equal(error.file, '/project/src/app.uxdsl');
  // Every former pack shape, and an empty block: none is consumed any more.
  for (const source of [
    '@theme { density-4: xs(space(1)) md(space(2)); }',
    '@theme { shadow-2: 0 1px 2px red; border-1: 1px solid red; }',
    '@theme { surface-contained: { bg: pink; } }',
    '@theme { button-cta: { @ds-surface(contained); :hover { bg: red; } } }',
    '@theme { input-search: { @ds-surface(outlined); padding: 7px; } }',
    '@theme {}',
    '@THEME { radius-2: 1px; }',
  ]) assert.match(failure(source).reason, /^UXD_THEME_BLOCK_REMOVED: /, source);
});

test('@theme: the JSON is the only source — what a pack used to define is written in the theme', () => {
  const css = compile('.card { border-radius: radius(2); box-shadow: shadow(2); padding: density(4); }', {
    theme: { radii: { 2: '99px' }, shadows: { 2: '0 9px 9px red' }, densities: { 4: 'xs(space(1)) md(space(2))' } },
    includeTheme: true,
  });
  assert.match(css, /--uxdsl__radius__2: 99px/);
  assert.match(css, /--uxdsl__shadow__2: 0 9px 9px red/);
  assert.match(css, /--uxdsl__density__4: var\(--uxdsl__space__1\)/);
});

for (const [source, replacement] of [
  ['.a { border-radius: rounded(2); }', 'radius(2)'],
  ['.a { box-shadow: elevation(1); }', 'shadow(1)'],
  ['.a { border-radius: radius(full); }', 'radius(pill)'],
  ['.a { gap: densities(1, 2, 3); }', 'density('],
  // Inside another value, and inside a breakpoint group: still caught.
  ['.a { border-radius: xs(rounded(1)) md(rounded(2)); }', 'radius(1)'],
  ['.a { box-shadow: 0 0 0 1px red, elevation(2); }', 'shadow(2)'],
]) {
  test(`removed spelling ${source} fails with UXD_SYNTAX_REMOVED naming ${replacement}`, () => {
    const error = failure(source);
    assert.equal(error.name, 'CssSyntaxError');
    assert.match(error.reason, /^UXD_SYNTAX_REMOVED: /);
    assert.ok(error.reason.includes(replacement), error.reason);
    assert.equal(error.line, 1);
    assert.ok(error.column > 1, 'the column points into the declaration');
  });
}

test('removed spellings in a theme value fail the same way on both CSS paths', () => {
  for (const [theme, replacement] of [
    [{ radii: { hero: 'rounded(2)' } }, 'radius(2)'],
    [{ shadows: { hero: 'elevation(2)' } }, 'shadow(2)'],
    [{ surfaces: { hero: { shadow: 'elevation(2)' } } }, 'shadow(2)'],
    [{ surfaces: { hero: { radius: 'radius(full)' } } }, 'radius(pill)'],
    [{ densities: { hero: 'densities(1, 2)' } }, 'density('],
  ]) {
    for (const run of [() => compile('.a { color: red; }', { theme, includeTheme: true }), () => runtime.generateThemeCss(theme)]) {
      assert.throws(run, (error) => /UXD_SYNTAX_REMOVED/.test(error.message) && error.message.includes(replacement), JSON.stringify(theme));
    }
  }
});

test('radius(full): a theme may still define its own "full" token; only the keyword is gone', () => {
  const css = compile('.a { border-radius: radius(full); }', { theme: { radii: { full: '12px' } } });
  assert.match(css, /border-radius: var\(--uxdsl__radius__full\)/);
  assert.deepEqual(Object.keys(language.RADIUS_KEYWORDS).sort(), ['circle', 'pill']);
  assert.equal(compile('.a { border-radius: radius(pill); } .b { border-radius: radius(circle); }'), '.a { border-radius: 9999px; } .b { border-radius: 50%; }');
});

test('spacing keys: the "space-" prefix is removed — UXD_SPACING_KEY with the key path and the bare key', () => {
  const theme = { spacing: { 'space-1': '4px' } };
  const result = runtime.validateTheme(runtime.resolveTheme(theme), { references: false });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((issue) => [issue.code, issue.path]), [['UXD_SPACING_KEY', 'spacing.space-1']]);
  assert.match(result.errors[0].message, /"1"/);
  assert.throws(() => runtime.generateThemeCss(theme), /UXD_SPACING_KEY/);
  assert.throws(() => compile('.a { color: red; }', { theme }), /UXD_SPACING_KEY: .*spacing\.space-1/);
  // The bare key is the one spelling; nothing merges two spellings any more.
  assert.match(runtime.generateThemeCss({ spacing: { gutter: '12px' } }), /--uxdsl__space__gutter: 12px/);
  assert.equal(language.normalizeSpacingKey, undefined);
  assert.equal(language.normalizeSpacingDefinitions, undefined);
});

test('the flat "typography" family is removed: an error naming typography_details, and no --font-code', () => {
  assert.equal(runtime.KNOWN_THEME_FAMILIES.has('typography'), false);
  const theme = { typography: { 'font-code': 'monospace' } };
  const result = runtime.validateTheme(runtime.resolveTheme(theme), { references: false });
  assert.deepEqual(result.errors.map((issue) => [issue.code, issue.path]), [['UXD_THEME_INVALID', 'typography']]);
  assert.match(result.errors[0].message, /typography_details/);
  assert.match(result.errors[0].message, /fonts\.families/);
  assert.throws(() => compile('.a { color: red; }', { theme }), /UXD_THEME_INVALID: .*typography_details/);
  assert.throws(() => runtime.generateThemeCss(theme), /UXD_THEME_INVALID: .*typography_details/);
  // The base theme no longer carries the family, so no un-namespaced variable is emitted.
  assert.equal('typography' in runtime.DEFAULT_THEME, false);
  const css = runtime.generateThemeCss();
  assert.doesNotMatch(css, /--font-code\b/);
  const names = css.match(/--[\w-]+(?=\s*:)/g) || [];
  assert.deepEqual(names.filter((name) => !name.startsWith('--uxdsl__')), [], 'every emitted name is --uxdsl__<family>__<key>');
});

for (const [source, family] of [
  ['.a { @ds-typo("h1"); }', 'TYPO'],
  ["a { @ds-typo('h1'); }", 'TYPO'],
  ['.a { @ds-surface("contained"); }', 'SURFACE'],
  ['.a { @ds-button("contained primary"); }', 'BUTTON'],
  ['.a { @ds-input("outlined"); }', 'INPUT'],
]) {
  test(`quoted directive arguments are not stripped: ${source}`, () => {
    const error = failure(source);
    assert.equal(error.name, 'CssSyntaxError');
    assert.match(error.reason, new RegExp(`^UXD_${family}_ARGUMENT: `));
    assert.match(error.reason, /quot/i);
    assert.equal(error.line, 1);
  });
}

test('the legacy theme files and the ./theme/* glob export are gone; the two JSON files are explicit exports', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.exports['./theme/*'], undefined);
  assert.equal(pkg.exports['./theme/base.json'], './src/theme/base.json');
  assert.equal(pkg.exports['./theme/base.contrast-exceptions.json'], './src/theme/base.contrast-exceptions.json');
  assert.deepEqual(fs.readdirSync(path.join(packageRoot, 'src/theme')).sort(), ['base.contrast-exceptions.json', 'base.json']);

  const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: packageRoot, encoding: 'utf8' });
  assert.equal(packed.status, 0, packed.stderr);
  const files = JSON.parse(packed.stdout)[0].files.map((file) => file.path);
  assert.deepEqual(files.filter((file) => /theme\/default-|theme-manifest|\.uxdsl$/.test(file)), []);
  assert.ok(files.includes('src/theme/base.json'));
  assert.ok(files.includes('src/theme/base.contrast-exceptions.json'));
});

test('the removed runtime names are not exported', () => {
  for (const name of ['getDefaultTheme', 'validateAndNormalizeTheme']) assert.equal(runtime[name], undefined, name);
  assert.equal(typeof runtime.validateTheme, 'function');
  assert.equal(typeof runtime.resolveTheme, 'function');
  assert.ok(runtime.DEFAULT_THEME.palette);
});

test('one name per concept in the language inventory', () => {
  assert.deepEqual([...language.LANGUAGE_COMPLETIONS.directives].sort(), ['ds-button', 'ds-input', 'ds-surface', 'ds-typo']);
  for (const name of ['rounded', 'elevation', 'densities']) {
    assert.equal(language.LANGUAGE_COMPLETIONS.functions.includes(name), false, name);
    assert.equal(language.KNOWN_CSS_FUNCTIONS.includes(name), false, name);
    assert.equal(Object.prototype.hasOwnProperty.call(language.TOKEN_FUNCTIONS, name), false, name);
  }
});

test('the compiler source carries no legacy pack parser', () => {
  const source = fs.readFileSync(path.join(packageRoot, 'src/index.ts'), 'utf8');
  for (const leftover of ['parseButtonPack', '__btnPacks', '__surfacePacks', '__inputPacks']) assert.equal(source.includes(leftover), false, leftover);
});
