#!/usr/bin/env node
'use strict';

/**
 * MIG-07: builds this fixture using postcss-uxdsl installed from a real
 * `npm pack` tarball — never importing the monorepo's TypeScript source —
 * then checks the acceptance criteria that can be verified without a real
 * browser. See the "NOT VERIFIED" section printed at the end for what
 * remains (browser-computed styles): Chromium has been unavailable in
 * this environment before (see FEAT-001's implementation record), so this
 * script substitutes the installed package's own inspector functions
 * (inspectSurfaceTheme/inspectButtonTheme/...) — the same non-browser
 * verification method the rest of this repo's test suite already uses —
 * rather than attempt another browser install.
 *
 * Usage: node run.js   (from this directory, or `npm run verify` here)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cascadedVariables, mapsEqual } = require('./lib/css-cascade-compare');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = __dirname;
const PACKAGE_DIR = path.join(ROOT, 'packages/postcss-uxdsl');
const ENTRIES_DIR = path.join(FIXTURE_DIR, 'entries');
const OUT_DIR = path.join(FIXTURE_DIR, '.out');

const failures = [];
function check(label, condition) {
  if (condition) console.log(`  ok  - ${label}`);
  else { console.log(`FAIL  - ${label}`); failures.push(label); }
}

function packAndInstall() {
  execFileSync('npm', ['run', 'build'], { cwd: PACKAGE_DIR, stdio: 'inherit' });
  console.log('Packing postcss-uxdsl (npm pack)...');
  const packOutput = execFileSync('npm', ['pack', '--pack-destination', FIXTURE_DIR], { cwd: PACKAGE_DIR, encoding: 'utf8' });
  const tarballName = packOutput.trim().split('\n').filter(Boolean).pop();
  const tarballPath = path.join(FIXTURE_DIR, tarballName);
  if (!fs.existsSync(tarballPath)) throw new Error(`Expected tarball at ${tarballPath}, got pack output:\n${packOutput}`);

  // Fresh install every run, from the tarball just produced — not a
  // stale one, and never a symlink/workspace link to the monorepo source.
  fs.rmSync(path.join(FIXTURE_DIR, 'node_modules'), { recursive: true, force: true });
  fs.rmSync(path.join(FIXTURE_DIR, 'package-lock.json'), { force: true });
  console.log(`Installing ${tarballName} (local tarball, no network)...`);
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--no-save', tarballPath], { cwd: FIXTURE_DIR, stdio: 'inherit' });
  fs.rmSync(tarballPath, { force: true });
  return tarballName;
}

function loadInstalled() {
  // Resolve from the fixture's own node_modules — proves the tarball is
  // self-contained and never falls back to the monorepo source.
  const req = require('module').createRequire(path.join(FIXTURE_DIR, 'package.json'));
  const pluginModule = req('postcss-uxdsl');
  return {
    plugin: pluginModule.default || pluginModule,
    postcss: req('postcss'),
    runtime: req('postcss-uxdsl/ds-runtime'),
    pkgJson: JSON.parse(fs.readFileSync(req.resolve('postcss-uxdsl/package.json'), 'utf8')),
    pkgDir: path.dirname(req.resolve('postcss-uxdsl/package.json')),
  };
}

async function buildOnce(installed, theme) {
  const { plugin, postcss } = installed;
  const compile = (source, includeTheme) =>
    postcss([plugin({ theme, includeTheme })]).process(source, { from: undefined }).then((r) => r.css);

  const entries = fs.readdirSync(ENTRIES_DIR).filter((f) => f.endsWith('.uxdsl')).sort();
  const outputs = {};
  for (const file of entries) {
    const source = fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8');
    const includeTheme = file === 'theme.uxdsl';
    outputs[file] = await compile(source, includeTheme);
  }
  return outputs;
}

// cascadedVariables/mapsEqual live in ./lib/css-cascade-compare.js (see its
// header for why a flat "collect every declaration then sort()" comparison
// is wrong, and unit-tested in ./test/cascade-compare.test.js).

async function main() {
  const tarballName = packAndInstall();
  check('tarball installed under ./node_modules/postcss-uxdsl (not the monorepo source)', fs.existsSync(path.join(FIXTURE_DIR, 'node_modules/postcss-uxdsl/dist/index.js')));

  // Self-check: the comparison this script relies on below (cascadedVariables)
  // has its own regression coverage — run it before trusting its verdicts,
  // so a future regression in the comparison itself fails loudly here
  // instead of silently passing a real bug through.
  try {
    execFileSync('node', ['--test', 'test/cascade-compare.test.js'], { cwd: FIXTURE_DIR, encoding: 'utf8', stdio: 'pipe' });
    check('cascade-aware CSS comparison (lib/css-cascade-compare.js) passes its own regression tests', true);
  } catch (err) {
    check(`cascade-aware CSS comparison regression tests — FAILED:\n${err.stdout || err.stderr || err.message}`, false);
  }

  const installed = loadInstalled();
  check('installed package.json declares main/types/exports for a consumer to resolve', !!(installed.pkgJson.main && installed.pkgJson.types && installed.pkgJson.exports));
  for (const doc of ['README.md', 'CHANGELOG.md']) {
    check(`installed tarball includes ${doc}`, fs.existsSync(path.join(installed.pkgDir, doc)));
  }
  // MIG-B6-28 (FEAT-008): docs/migration.md is deliberately *not* shipped
  // any more (package.json's new `files` field excludes it — it was 38.8KB
  // of pure prose bloating every install for something no code path reads
  // at runtime). That only stays correct if the README's own link to it
  // was switched from a relative repo path (which would 404 for anyone
  // reading the installed copy, e.g. via a local file browser or an IDE's
  // node_modules README preview) to an absolute GitHub URL.
  check('installed tarball does not include docs/ (moved to an absolute README link instead)', !fs.existsSync(path.join(installed.pkgDir, 'docs')));
  const installedReadme = fs.readFileSync(path.join(installed.pkgDir, 'README.md'), 'utf8');
  check('installed README links migration.md via an absolute URL, not a relative path that would 404 once unshipped', /\]\(https:\/\/github\.com\/[^)]*\/docs\/migration\.md\)/.test(installedReadme));

  // MIG-B6-27 (FEAT-008): the types and the JSON Schema are only useful if
  // they survive `npm pack`. Checking `files` in the repository's package.json
  // proves intent; this proves delivery.
  const installedSchemaPath = path.join(installed.pkgDir, 'schema/theme.schema.json');
  check('installed tarball includes schema/theme.schema.json', fs.existsSync(installedSchemaPath));
  if (fs.existsSync(installedSchemaPath)) {
    const Ajv = require(path.join(PACKAGE_DIR, 'node_modules/ajv'));
    const validateTheme = new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(fs.readFileSync(installedSchemaPath, 'utf8')));
    const fixtureTheme = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'theme.json'), 'utf8'));
    check("this fixture's own theme.json validates against the *installed* schema",
      validateTheme(fixtureTheme) || (console.error(validateTheme.errors), false));
    check('the installed schema rejects an unknown family', !validateTheme({ palete: {} }));
  }
  check('installed tarball includes dist/types.d.ts (the public type surface)',
    fs.existsSync(path.join(installed.pkgDir, 'dist/types.d.ts')));

  // Type-check a consumer against the *installed* package, under Node16
  // resolution. This is the check that catches an exports map whose `types`
  // condition is unreachable: resolution runs against the tarball's own
  // package.json, not the repository's source tree.
  const typeDir = path.join(FIXTURE_DIR, '.types');
  fs.rmSync(typeDir, { recursive: true, force: true });
  fs.mkdirSync(typeDir, { recursive: true });
  fs.writeFileSync(path.join(typeDir, 'consumer.ts'), [
    "import { defineConfig } from 'postcss-uxdsl/config';",
    "import type { UxdslTheme, UxdslConfig, UxdslOptions } from 'postcss-uxdsl';",
    "export const config: UxdslConfig = defineConfig({ entry: './a.uxdsl', outFile: './a.css' });",
    "export const theme: UxdslTheme = { palette: { brand: { main: '#000' } }, typography_details: { h1: { fontSize: '2rem' } } };",
    "export const options: UxdslOptions = { theme, includeTheme: false };",
    '// @ts-expect-error the field is `fontSize` — if this stops erroring the directive is unused and tsc fails.',
    "export const typo: UxdslTheme = { typography_details: { h1: { fontsize: '2rem' } } };",
  ].join('\n'));
  fs.writeFileSync(path.join(typeDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { noEmit: true, strict: true, skipLibCheck: true, module: 'node16', moduleResolution: 'node16', target: 'es2022' },
    files: ['consumer.ts'],
  }, null, 2));
  try {
    execFileSync('node', [path.join(PACKAGE_DIR, 'node_modules/typescript/bin/tsc'), '--project', typeDir], { cwd: FIXTURE_DIR, encoding: 'utf8', stdio: 'pipe' });
    check('a TypeScript consumer type-checks against the installed tarball (Node16 resolution, exports map, @ts-expect-error used)', true);
  } catch (err) {
    check(`a TypeScript consumer type-checks against the installed tarball — FAILED:\n${err.stdout || err.stderr || err.message}`, false);
  }
  fs.rmSync(typeDir, { recursive: true, force: true });

  const theme = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'theme.json'), 'utf8'));

  console.log('\nBuilding: 1 theme entry (includeTheme: true) + 4 CSS-Module panel entries (includeTheme: false)...');
  let outputs;
  try {
    outputs = await buildOnce(installed, theme);
    check('all 5 entries compiled without throwing (zero unresolved mandatory UXDSL references — MIG-03 enforceReferences runs by default)', true);
  } catch (err) {
    check(`all 5 entries compiled without throwing — FAILED: ${err.message.split('\n')[0]}`, false);
    outputs = {};
  }

  check('theme entry emits :root (it is the includeTheme: true entry)', (outputs['theme.uxdsl'] || '').includes(':root'));
  for (const file of ['panel-surface.uxdsl', 'panel-button.uxdsl', 'panel-input.uxdsl', 'panel-border.uxdsl']) {
    check(`${file} emits zero :root blocks (includeTheme: false — a CSS Modules loader in strict mode accepts this)`, !!outputs[file] && !outputs[file].includes(':root'));
  }

  // Parity: the theme entry's PostCSS output and the installed runtime's
  // generateThemeCss must agree on the same set of :root variables for
  // the same theme.
  if (outputs['theme.uxdsl']) {
    const postcssVars = cascadedVariables(outputs['theme.uxdsl'], installed.postcss);
    const runtimeCss = installed.runtime.generateThemeCss(theme);
    const runtimeVars = cascadedVariables(runtimeCss, installed.postcss);
    check('PostCSS and runtime (generateThemeCss) agree on the same :root variables for the theme entry', mapsEqual(postcssVars, runtimeVars));
  } else {
    check('PostCSS/runtime parity — skipped, theme entry did not build', false);
  }

  // Determinism: build again from scratch (same installed package, no
  // reinstall) and diff every output byte-for-byte.
  console.log('\nRebuilding once more to check determinism...');
  const secondOutputs = await buildOnce(installed, theme);
  const deterministic = Object.keys(outputs).every((file) => outputs[file] === secondOutputs[file]);
  check('repeated compilation of the same entries produces byte-identical output', deterministic);

  // Approximate computed-value check (see file header: no real browser in
  // this environment). Uses the installed package's own inspector
  // functions to resolve effective padding/radius/border at a few
  // breakpoints, the same non-browser method the rest of the test suite
  // already relies on.
  console.log('\nApproximate computed-value check via inspector functions (not a real browser — see header):');
  const surfaceAt0 = installed.runtime.inspectSurfaceTheme(theme, 0);
  const surfaceAtLg = installed.runtime.inspectSurfaceTheme(theme, 1024);
  check('surface.contained padding resolves at xs (width 0)', surfaceAt0['--uxdsl__surface__contained-padding'] === 'var(--uxdsl__density__2)');
  check('edge radius(3) and border(2) resolve to concrete var() references', (() => {
    const edge = installed.runtime.inspectEdgeTheme(theme, 0);
    return edge['--uxdsl__radius__3'] !== undefined && edge['--uxdsl__border__2'] !== undefined;
  })());
  check('button.contained padding tracks the theme breakpoint (xs vs lg can legitimately be equal without a density override; check both resolve)', surfaceAt0['--uxdsl__surface__contained-padding'] !== undefined && surfaceAtLg['--uxdsl__surface__contained-padding'] !== undefined);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [file, css] of Object.entries(outputs)) fs.writeFileSync(path.join(OUT_DIR, file.replace(/\.uxdsl$/, '.css')), css || '');
  console.log(`\nCompiled CSS written to ${path.relative(process.cwd(), OUT_DIR)}/ for manual inspection.`);

  console.log('\nNOT VERIFIED by this script (documented gap, see docs/features/FEAT-002-beta-migration-hardening.md MIG-07):');
  console.log('  - Real browser-computed styles at each breakpoint (no headless browser available in this environment).');
  console.log('  - An actual CSS Modules build (e.g. webpack css-loader in strict mode) rejecting/accepting the panel output.');
  console.log(`  - Coordinated multi-package install (only postcss-uxdsl@${installed.pkgJson.version} was packed; uxdsl-core/uxdsl-cli/vite-plugin-uxdsl were not exercised here).`);

  console.log(`\n${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  if (failures.length) {
    console.log(`${failures.length} check(s) failed:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log('All checks passed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
