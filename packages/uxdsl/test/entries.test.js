'use strict';

// Stability phase 4: one package, `uxdsl`, with one entry point per job. This
// pins the layout a consumer installs: the exports map, a `types` condition on
// every code entry, the peers, the shipped files, and exactly what each public
// entry exports. A name moving between entries — or a new one appearing in a
// semver-covered entry — fails here first, so the change is deliberate.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PKG_DIR = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const entry = (name) => require(path.join(PKG_DIR, 'dist', 'entries', name));
const keys = (mod) => Object.keys(mod).filter((key) => key !== '__esModule').sort();

test('phase 4: the package is `uxdsl`, with one bin and the exports map of the 1.0 layout', () => {
  assert.equal(pkg.name, 'uxdsl');
  assert.deepEqual(pkg.bin, { uxdsl: './bin/uxdsl.js' });
  assert.equal(pkg.sideEffects, false);
  assert.deepEqual(Object.keys(pkg.exports), [
    '.', './postcss', './vite', './webpack', './runtime', './theme', './language', './config', './engine',
    './theme/base.json', './theme/base.contrast-exceptions.json', './schema/theme.schema.json', './package.json',
  ]);
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (typeof target === 'string') {
      assert.ok(fs.existsSync(path.join(PKG_DIR, target)), `${subpath} -> ${target} exists`);
      continue;
    }
    assert.equal(Object.keys(target)[0], 'types', `${subpath}: "types" comes first`);
    for (const file of Object.values(target)) assert.ok(fs.existsSync(path.join(PKG_DIR, file)), `${subpath} -> ${file} exists (build first)`);
  }
});

test('phase 4: postcss is a peer; vite and webpack are optional peers; hard dependencies are only what the code needs', () => {
  assert.deepEqual(pkg.peerDependencies, { postcss: '^8.4.31', vite: '>=4.0.0', webpack: '^5.0.0' });
  assert.deepEqual(pkg.peerDependenciesMeta, { vite: { optional: true }, webpack: { optional: true } });
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
    'chokidar', 'minimist', 'picomatch', 'postcss-advanced-variables', 'postcss-import', 'postcss-scss', 'postcss-value-parser',
  ]);
  assert.equal(pkg.dependencies.postcss, undefined, 'postcss is never a hard dependency: one copy, the project\'s');
});

test('phase 4: `files` ships code, the theme JSON, the schema and the agent guide — no CHANGELOG, tests or images', () => {
  assert.deepEqual(pkg.files, [
    'dist', 'bin', 'src/theme', 'schema', 'docs/agent-guide.md',
    'scripts/codemod-canonical-grammar.js', 'scripts/codemod-namespace.js', 'scripts/codemod-size-overrides.js',
  ]);
});

test('phase 4: each subpath resolves to the module the exports map names', () => {
  const plugin = require('uxdsl/postcss');
  assert.equal(typeof plugin, 'function');
  assert.equal(plugin.postcss, true);
  assert.equal(require('uxdsl/postcss'), require('../dist/plugin'));
  assert.equal(typeof require('uxdsl/vite'), 'function');
  assert.equal(require('uxdsl/vite').default, require('uxdsl/vite'), 'ESM default and CommonJS export are the same function');
  assert.equal(typeof require('uxdsl/webpack'), 'function');
  assert.equal(require('uxdsl/theme/base.json'), require('../src/theme/base.json'));
});

test('phase 4: the package root exports compile(), the resolved theme and defineConfig', () => {
  assert.deepEqual(keys(entry('index')), ['DEFAULT_THEME', 'compile', 'defineConfig', 'resolveTheme']);
});

test('phase 4: uxdsl/runtime exports the browser API and nothing else', () => {
  assert.deepEqual(keys(entry('runtime')), [
    'DEFAULT_THEME_STORAGE_KEY', 'DEFAULT_THEME_STYLE_ID', 'applyTheme', 'getAppliedTheme', 'loadPersistedTheme', 'resetTheme', 'subscribeTheme',
  ]);
});

test('phase 4: uxdsl/theme exports the isomorphic theme model', () => {
  assert.deepEqual(keys(entry('theme')), [
    'DEFAULT_BREAKPOINTS', 'DEFAULT_THEME', 'KNOWN_THEME_FAMILIES', 'checkThemeContrast', 'deepMergeTheme',
    'generateThemeCss', 'googleFontsImportUrls', 'resolveTheme', 'validateTheme',
  ]);
});

test('phase 4: uxdsl/language exports what an editor needs, and the closed diagnostics catalog', () => {
  assert.deepEqual(keys(entry('language')), [
    'DIAGNOSTIC_CATALOG', 'DIAGNOSTIC_CODES', 'KNOWN_CSS_FUNCTIONS', 'LANGUAGE_COMPLETIONS', 'getToneFamilies',
    'inspectResponsiveValue', 'resolveResponsiveValue', 'responsiveEntries', 'validateResponsiveExpression',
  ]);
});

test('phase 4: uxdsl/config exports defineConfig and theme-file discovery', () => {
  assert.deepEqual(keys(entry('config')), ['THEME_CANDIDATES', 'defineConfig', 'discoverThemeAsync', 'discoverThemeSync', 'findThemeConfigPath']);
});

test('phase 4: a name exported by two entries is the same binding in both', () => {
  const entries = ['index', 'runtime', 'theme', 'language', 'config', 'engine'].map((name) => [name, entry(name)]);
  for (const [a, modA] of entries) {
    for (const [b, modB] of entries) {
      if (a >= b) continue;
      for (const name of keys(modA).filter((key) => key in modB)) assert.equal(modA[name], modB[name], `${name}: uxdsl/${a} and uxdsl/${b} disagree`);
    }
  }
});

test('phase 4: uxdsl/engine says, in its README section, that it is exempt from semver', () => {
  const readme = fs.readFileSync(path.join(PKG_DIR, 'README.md'), 'utf8');
  assert.match(readme, /`uxdsl\/engine`[^\n]*(?:\n[^\n]+)*?semver/i);
});
