'use strict';

// Stability phase 4: the five former package names get one last version,
// 0.6.0, that depends on `uxdsl` and re-exports it. Prepared here, published by
// the owner (docs/releases/uxdsl-package-move.md).
//
// Each shim is installed the way npm would lay it out — its files copied into a
// node_modules next to the built `uxdsl` — and required from outside. It must
// re-export exactly the `uxdsl` entry (or entries) it maps to, value for value,
// print nothing, and keep the names the old package exported, except the
// internals listed in DROPPED on purpose.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const HERE = __dirname;
const UXDSL_DIR = path.resolve(HERE, '../uxdsl');
const SHIMS = ['postcss-uxdsl', 'uxdsl-core', 'uxdsl-cli', 'vite-plugin-uxdsl', 'uxdsl-webpack-loader'];

/** What the packages exported at 0.5.0-beta.7-dev, the last state before the move. */
const FORMER = {
  'postcss-uxdsl/ds-runtime': ['BUTTON_PROPERTIES', 'BUTTON_STATES', 'DEFAULT_BORDERS', 'DEFAULT_BORDER_COLORS', 'DEFAULT_BREAKPOINTS', 'DEFAULT_BUTTONS', 'DEFAULT_DENSITIES', 'DEFAULT_INPUTS', 'DEFAULT_RADII', 'DEFAULT_SHADOWS', 'DEFAULT_SURFACES', 'DEFAULT_THEME', 'DEFAULT_THEME_STORAGE_KEY', 'DEFAULT_THEME_STYLE_ID', 'DIAGNOSTIC_CATALOG', 'DIAGNOSTIC_CODES', 'INPUT_PROPERTIES', 'INPUT_STATES', 'KNOWN_THEME_FAMILIES', 'NOT_DISABLED', 'RADIUS_KEYWORDS', 'ReferenceIntegrityError', 'SURFACE_PROPERTIES', 'THEME_KEY_PATTERN', 'THEME_NAME_PATTERN', 'THEME_SCHEMA_KEY', 'THEME_VALUE_PATTERN', 'TYPOGRAPHY_CSS_PROPERTIES', 'TYPOGRAPHY_PROPERTIES', 'applyTheme', 'buttonComponentCss', 'buttonDeclarations', 'checkThemeContrast', 'cloneThemeValue', 'compileButtonRules', 'compileEdgeRules', 'compileInputRules', 'compileShadowRules', 'compileSurfaceRules', 'compileTypographyRules', 'compositeOver', 'contrastRatio', 'deepMergeTheme', 'edgeValueToCss', 'encodeGoogleFontFamily', 'generateButtonCss', 'generateDensityCss', 'generateEdgeCss', 'generateInputCss', 'generateShadowCss', 'generateSurfaceCss', 'generateThemeCss', 'generateTypographyCss', 'getAppliedTheme', 'getButtonTokens', 'getDensityTokens', 'getEdgeTokens', 'getInputTokens', 'getShadowTokens', 'getSurfaceTokens', 'googleFontsImportUrls', 'inputComponentCss', 'inputDeclarations', 'inspectButtonTheme', 'inspectEdgeTheme', 'inspectInputTheme', 'inspectReferences', 'inspectShadowTheme', 'inspectSurfaceTheme', 'inspectTypographyTheme', 'loadPersistedTheme', 'parseButtonArguments', 'parseInputArguments', 'parseLiteralColor', 'parseSurfaceArguments', 'relativeLuminance', 'renderThemeCss', 'requireRole', 'resetTheme', 'resolveExpression', 'resolveTheme', 'resolveTypographyRole', 'structuralChanges', 'subscribeTheme', 'surfaceDeclarations', 'surfaceValueToCss', 'themeStructure', 'themeValidationError', 'typographyValueToCss', 'validateTheme'],
  'postcss-uxdsl/language': ['DEFAULT_BREAKPOINTS', 'DEFAULT_DENSITIES', 'KNOWN_CSS_FUNCTIONS', 'LANGUAGE_COMPLETIONS', 'RADIUS_KEYWORDS', 'REMOVED_RADIUS_FULL', 'TOKEN_FUNCTIONS', 'TOKEN_FUNCTION_CODES', 'analyzeResponsiveValue', 'compileDensityRules', 'generateDensityCss', 'getDensityTokens', 'getToneFamilies', 'inspectResponsiveValue', 'parseTokenReference', 'removedSyntaxMessage', 'resolveResponsiveValue', 'responsiveEntries', 'spacingValueToCss', 'tokenReferenceToCss', 'tokenValueToCss', 'validateBreakpoints', 'validateResponsiveExpression'],
  'postcss-uxdsl/config': ['THEME_CANDIDATES', 'assertBareThemeExport', 'clearLocalRequireCache', 'collectLocalRequireTree', 'defineConfig', 'discoverThemeAsync', 'discoverThemeSync', 'findThemeConfigPath', 'loadThemeConfigAsync', 'loadThemeConfigSync', 'warnIfLooksLikeBuildConfig'],
  'postcss-uxdsl': ['DIAGNOSTIC_CATALOG', 'postcss'],
  'uxdsl-core': ['compile'],
};

/** Former exports the shims deliberately do not carry: helpers the CLI used
 * across packages, internal to `uxdsl` now that the CLI ships inside it. */
const DROPPED = {
  'postcss-uxdsl/config': ['assertBareThemeExport', 'clearLocalRequireCache', 'collectLocalRequireTree', 'loadThemeConfigAsync', 'loadThemeConfigSync', 'warnIfLooksLikeBuildConfig'],
};

/** Each shim subpath and the `uxdsl` entries it is made of. */
const MAPPING = {
  'postcss-uxdsl': ['uxdsl/postcss'],
  'postcss-uxdsl/ds-runtime': ['uxdsl/engine', 'uxdsl/runtime'],
  'postcss-uxdsl/language': ['uxdsl/engine', 'uxdsl/language'],
  'postcss-uxdsl/config': ['uxdsl/config'],
  'postcss-uxdsl/theme/base.json': ['uxdsl/theme/base.json'],
  'postcss-uxdsl/theme/base.contrast-exceptions.json': ['uxdsl/theme/base.contrast-exceptions.json'],
  'postcss-uxdsl/schema/theme.schema.json': ['uxdsl/schema/theme.schema.json'],
  'uxdsl-core': ['uxdsl'],
  'vite-plugin-uxdsl': ['uxdsl/vite'],
  'uxdsl-webpack-loader': ['uxdsl/webpack'],
};

/** A project whose node_modules holds the built `uxdsl` and the shims, as npm installs them. */
function install() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-shims-')));
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(nm);
  fs.symlinkSync(UXDSL_DIR, path.join(nm, 'uxdsl'), 'dir');
  for (const shim of SHIMS) {
    const pkg = JSON.parse(fs.readFileSync(path.join(HERE, shim, 'package.json'), 'utf8'));
    const target = path.join(nm, shim);
    for (const file of ['package.json', 'README.md', 'LICENSE', ...pkg.files]) fs.cpSync(path.join(HERE, shim, file), path.join(target, file), { recursive: true });
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'shim-consumer', version: '1.0.0', private: true }));
  return { dir, req: createRequire(path.join(dir, 'package.json')) };
}

const surface = (mod) => (typeof mod === 'function' || (mod && typeof mod === 'object') ? Object.keys(mod).filter((key) => key !== '__esModule').sort() : []);

test('phase 4: each shim is 0.6.0, depends on uxdsl ^1.0.0-rc.1, keeps the postcss peer and ships only re-exports', () => {
  for (const shim of SHIMS) {
    const pkg = JSON.parse(fs.readFileSync(path.join(HERE, shim, 'package.json'), 'utf8'));
    assert.equal(pkg.name, shim);
    assert.equal(pkg.version, '0.6.0');
    assert.deepEqual(pkg.dependencies, { uxdsl: '^1.0.0-rc.1' });
    assert.equal(pkg.peerDependencies.postcss, '^8.4.31');
    assert.equal(pkg.publishConfig.access, 'public');
    for (const file of pkg.files) {
      const full = path.join(HERE, shim, file);
      assert.ok(fs.existsSync(full), `${shim}: ${file} exists`);
      if (file.endsWith('.js')) assert.match(fs.readFileSync(full, 'utf8'), /^'use strict';[\s\S]*module\.exports = /, `${shim}/${file} is a re-export`);
    }
  }
});

test('phase 4: every shim subpath is exactly the uxdsl entries it maps to, value for value', () => {
  const { req } = install();
  for (const [specifier, targets] of Object.entries(MAPPING)) {
    const shim = req(specifier);
    const expected = Object.assign({}, ...targets.map((target) => req(target)));
    if (targets.length === 1) assert.equal(shim, req(targets[0]), `${specifier} is ${targets[0]} itself`);
    assert.deepEqual(surface(shim), surface(expected), `${specifier}: the export surface`);
    for (const key of surface(expected)) assert.equal(shim[key], expected[key], `${specifier}.${key} is the uxdsl binding`);
  }
});

test('phase 4: a shim keeps every name its package exported, except the internals dropped on purpose', () => {
  const { req } = install();
  for (const [specifier, names] of Object.entries(FORMER)) {
    const available = new Set(surface(req(specifier)));
    const missing = names.filter((name) => !available.has(name));
    assert.deepEqual(missing, DROPPED[specifier] || [], `${specifier}: names an old consumer loses`);
  }
  assert.equal(typeof req('postcss-uxdsl'), 'function', 'the plugin is still the package export');
  assert.equal(req('postcss-uxdsl').postcss, true);
  assert.equal(typeof req('vite-plugin-uxdsl'), 'function');
  assert.equal(typeof req('vite-plugin-uxdsl').default, 'function');
  assert.equal(typeof req('uxdsl-webpack-loader'), 'function');
});

test('phase 4: requiring a shim prints nothing', () => {
  const { dir } = install();
  const script = `for (const s of ${JSON.stringify(Object.keys(MAPPING))}) require(s);`;
  const run = spawnSync(process.execPath, ['-e', script], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, '');
});

test('phase 4: the uxdsl-cli shim\'s `uxdsl` bin runs the uxdsl command', () => {
  const { dir } = install();
  const bin = path.join(dir, 'node_modules/uxdsl-cli/bin/uxdsl.js');
  const version = JSON.parse(fs.readFileSync(path.join(UXDSL_DIR, 'package.json'), 'utf8')).version;
  const run = spawnSync(process.execPath, [bin, '--version'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, `uxdsl ${version}\n`);
  const help = spawnSync(process.execPath, [bin, 'build', '--help'], { cwd: dir, encoding: 'utf8' });
  assert.match(help.stdout, /^Usage: uxdsl build/);
});

test('phase 4: the deprecation messages name the replacement and fit npm deprecate', () => {
  const messages = JSON.parse(fs.readFileSync(path.join(HERE, 'deprecations.json'), 'utf8'));
  assert.deepEqual(Object.keys(messages).sort(), [...SHIMS].sort());
  for (const [shim, message] of Object.entries(messages)) {
    assert.match(message, /npm i -D uxdsl/, shim);
    assert.match(message, /CHANGELOG\.md#package-layout/, shim);
    assert.ok(message.length < 1024, `${shim}: ${message.length} characters`);
  }
});

test('phase 4: the shims type-check as their packages did (d.ts re-exports resolve)', () => {
  const { dir } = install();
  fs.writeFileSync(path.join(dir, 'consumer.ts'), [
    "import plugin = require('postcss-uxdsl');",
    "import { applyTheme, generateThemeCss, generateButtonCss } from 'postcss-uxdsl/ds-runtime';",
    "import { inspectResponsiveValue, tokenValueToCss } from 'postcss-uxdsl/language';",
    "import { defineConfig } from 'postcss-uxdsl/config';",
    "import { compile } from 'uxdsl-core';",
    "import vite from 'vite-plugin-uxdsl';",
    "export const used = [plugin, applyTheme, generateThemeCss, generateButtonCss, inspectResponsiveValue, tokenValueToCss, defineConfig, compile, vite];",
  ].join('\n'));
  const tsc = path.join(UXDSL_DIR, 'node_modules/typescript/bin/tsc');
  const run = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--esModuleInterop', '--module', 'node16', '--moduleResolution', 'node16', '--target', 'es2022', 'consumer.ts'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});
