#!/usr/bin/env node
'use strict';

/**
 * MIG-B2-03 (FEAT-003): `uxdsl init` + the zero-config flow, exercised
 * against the CLI *from this checkout* (never a global/registry
 * resolution) in real, disposable temp directories — not a mock of the
 * filesystem.
 *
 * Covers the 8 "Pruebas requeridas": (1) init in an empty project, (2)
 * checks file contents, (3) a real build, (4) namespaced vars in the
 * output CSS, (5) a second init leaves every file byte-identical
 * (hash comparison), (6) a pre-existing uxdsl.config.cjs/postcss.config.js
 * is preserved untouched, (7) Next.js/Vite-triggered init behavior (via
 * the same marker files the CLI itself checks for — next.config.js/
 * vite.config.js — no real `next`/`vite` package needed for this level),
 * (8) actionable error messages for a missing entry file and a missing
 * --config file.
 *
 * (9) MIG-B4-03 (FEAT-005): `init --multi` scaffolds a `builds` project
 * (theme entry + one example component entry) — build succeeds
 * immediately, only the theme entry defines `:root`, a second run is
 * idempotent (hash comparison), and plain `init` (no flag) is unaffected.
 *
 * (10) MIG-B7-12 (FEAT-009): from a real `npm pack` tarball of uxdsl
 * (not this checkout's directory), the `$schema` path the READMEs document
 * exists inside the installed package, is exported, and is the JSON Schema;
 * and the config `init` writes type-checks against that installed package —
 * a typo in it is reported, and it resolves the type rather than failing to.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { packAndInstall } = require('../lib/tarball-consumer');
const CLI_BIN = path.join(REPO_ROOT, 'packages', 'uxdsl', 'bin', 'uxdsl.js');
const UXDSL_DIR = path.join(REPO_ROOT, 'packages', 'uxdsl');

const failures = [];
function check(label, condition) {
  if (condition) console.log(`  ok  - ${label}`);
  else { console.log(`FAIL  - ${label}`); failures.push(label); }
}

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-init-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'mig-b2-03-project', version: '0.0.0' }, null, 2));
  return dir;
}

function installUxdsl(projectDir) {
  // Matches the documented flow (`npm i -D uxdsl`), installed from this
  // checkout's own directory (not a tarball) — the release gate owns
  // tarball fidelity; this one is about init/build actually working.
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--no-save', UXDSL_DIR], { cwd: projectDir, stdio: 'pipe' });
}

function runCli(args, projectDir, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI_BIN, ...args], { cwd: projectDir, encoding: 'utf8', stdio: 'pipe', ...opts });
    return { ok: true, code: 0, output: stdout };
  } catch (err) {
    return { ok: false, code: err.status, output: `${err.stdout || ''}${err.stderr || ''}` || err.message };
  }
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function snapshotHashes(dir, relPaths) {
  const out = {};
  for (const rel of relPaths) {
    const full = path.join(dir, rel);
    out[rel] = fs.existsSync(full) ? hashFile(full) : null;
  }
  return out;
}

async function main() {
  // --- 1/2/3/4: init in an empty project, then a real build ---
  const project = mkProject();
  installUxdsl(project);

  const init1 = runCli(['init'], project);
  check('init exits 0 in an empty project with a minimal package.json', init1.ok && init1.code === 0);
  check('init creates uxdsl.config.cjs', fs.existsSync(path.join(project, 'uxdsl.config.cjs')));
  check('init creates src/uxdsl-entry.uxdsl', fs.existsSync(path.join(project, 'src', 'uxdsl-entry.uxdsl')));
  check('init creates src/styles.uxdsl, the file the user edits', fs.existsSync(path.join(project, 'src', 'styles.uxdsl')));
  check('the generated entry imports src/styles.uxdsl', fs.existsSync(path.join(project, 'src', 'uxdsl-entry.uxdsl')) && /@import '\.\/styles\.uxdsl';/.test(fs.readFileSync(path.join(project, 'src', 'uxdsl-entry.uxdsl'), 'utf8')));
  check('init prints exactly one import path', init1.output.split('\n').filter((l) => /^\s*import '/.test(l)).length === 1);
  check('init does NOT create postcss.config.js (no Next.js marker present)', !fs.existsSync(path.join(project, 'postcss.config.js')));
  check('init output documents the generated CSS import and watch command', /src\/uxdsl\.css/.test(init1.output) && /uxdsl:watch/.test(init1.output));
  const entryContent = fs.existsSync(path.join(project, 'src', 'uxdsl-entry.uxdsl'))
    ? fs.readFileSync(path.join(project, 'src', 'uxdsl-entry.uxdsl'), 'utf8')
    : '';
  check('generated entry does not duplicate the canonical theme with legacy default imports', !/theme\/default-/.test(entryContent));
  const configContent = fs.existsSync(path.join(project, 'uxdsl.config.cjs')) ? fs.readFileSync(path.join(project, 'uxdsl.config.cjs'), 'utf8') : '';
  check('uxdsl.config.cjs uses relative paths for entry/outFile', /entry:\s*['"]\.\/?src/.test(configContent) && /outFile:\s*['"]\.\/?src/.test(configContent));
  const pkgAfterInit = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
  check('init adds uxdsl:build/uxdsl:watch scripts to package.json', pkgAfterInit.scripts && pkgAfterInit.scripts['uxdsl:build'] === 'uxdsl build' && pkgAfterInit.scripts['uxdsl:watch'] === 'uxdsl build --watch');

  const build1 = runCli(['build'], project);
  check('build succeeds immediately after init, with a src with no .uxdsl components of its own', build1.ok);
  if (!build1.ok) console.log(build1.output);
  const cssPath = path.join(project, 'src', 'uxdsl.css');
  check('build produces src/uxdsl.css', fs.existsSync(cssPath));
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  for (const family of ['space', 'palette', 'typography', 'radius', 'shadow', 'density']) {
    check(`output CSS contains namespaced ${family} variables`, new RegExp(`--uxdsl__${family}__`).test(css));
  }

  // --- 5: a second init changes nothing ---
  const trackedFiles = ['uxdsl.config.cjs', path.join('src', 'uxdsl-entry.uxdsl'), path.join('src', 'styles.uxdsl'), 'package.json'];
  const before = snapshotHashes(project, trackedFiles);
  const init2 = runCli(['init'], project);
  const after = snapshotHashes(project, trackedFiles);
  check('running init a second time exits 0', init2.ok);
  check('running init a second time changes no existing file (hash comparison)', JSON.stringify(before) === JSON.stringify(after));

  // --- 6: a pre-existing uxdsl.config.cjs and postcss.config.js survive untouched ---
  const preserveProject = mkProject();
  installUxdsl(preserveProject);
  fs.writeFileSync(path.join(preserveProject, 'next.config.js'), 'module.exports = {};\n');
  const canaryConfig = "module.exports = { entry: './src/custom-entry.uxdsl', outFile: './src/custom.css', watch: [] };\n// CANARY: hand-written, must survive init untouched\n";
  const canaryPostcss = "module.exports = { plugins: { 'uxdsl/postcss': {}, 'autoprefixer': {} } };\n// CANARY: hand-written, must survive init untouched\n";
  fs.writeFileSync(path.join(preserveProject, 'uxdsl.config.cjs'), canaryConfig);
  fs.writeFileSync(path.join(preserveProject, 'postcss.config.js'), canaryPostcss);
  runCli(['init'], preserveProject);
  check('a pre-existing uxdsl.config.cjs is never overwritten', fs.readFileSync(path.join(preserveProject, 'uxdsl.config.cjs'), 'utf8') === canaryConfig);
  check('a pre-existing postcss.config.js is never overwritten or corrupted', fs.readFileSync(path.join(preserveProject, 'postcss.config.js'), 'utf8') === canaryPostcss);

  // --- 7: Next.js detection creates postcss.config.js only when absent ---
  const nextProject = mkProject();
  installUxdsl(nextProject);
  fs.writeFileSync(path.join(nextProject, 'next.config.js'), 'module.exports = {};\n');
  const nextInit = runCli(['init'], nextProject);
  check('with a next.config.js marker present, init creates postcss.config.js', nextInit.ok && fs.existsSync(path.join(nextProject, 'postcss.config.js')));
  check('the created postcss.config.js references uxdsl/postcss', fs.existsSync(path.join(nextProject, 'postcss.config.js')) && fs.readFileSync(path.join(nextProject, 'postcss.config.js'), 'utf8').includes("'uxdsl/postcss'"));
  check('the created postcss.config.js keeps Next\'s default plugins (flexbugs-fixes, preset-env) ahead of uxdsl/postcss', (() => {
    const file = path.join(nextProject, 'postcss.config.js');
    if (!fs.existsSync(file)) return false;
    const keys = Object.keys(require(file).plugins);
    return keys.join(',') === 'next/dist/compiled/postcss-flexbugs-fixes,next/dist/compiled/postcss-preset-env,uxdsl/postcss';
  })());

  // --- 8: actionable error messages ---
  const missingEntry = runCli(['build', '--entry', 'src/does-not-exist.uxdsl', '--out', 'src/out.css'], project);
  check('a missing --entry file fails with a message naming --entry and the expected path', !missingEntry.ok && /--entry/.test(missingEntry.output) && /does-not-exist\.uxdsl/.test(missingEntry.output));

  const missingConfig = runCli(['build', '--config', 'missing.cjs'], project);
  check('a missing --config file fails with a clear, specific message', !missingConfig.ok && /Configuration file not found/.test(missingConfig.output) && /missing\.cjs/.test(missingConfig.output));

  const badConfigProject = mkProject();
  installUxdsl(badConfigProject);
  fs.writeFileSync(path.join(badConfigProject, 'uxdsl.config.cjs'), 'module.exports = { entry: 123, outFile: "./src/uxdsl.css" };\n');
  const badConfig = runCli(['build'], badConfigProject);
  check('an invalid config property (wrong type) names the file and the property', !badConfig.ok && /uxdsl\.config\.cjs/.test(badConfig.output) && /"entry"/.test(badConfig.output));

  // --- 9 (MIG-B4-03, FEAT-005): --multi scaffolds a "builds" project ---
  const multiProject = mkProject();
  installUxdsl(multiProject);
  const multiInit1 = runCli(['init', '--multi'], multiProject);
  check('init --multi exits 0 in an empty project', multiInit1.ok);
  check('init --multi creates uxdsl.config.cjs with a "builds" array', fs.existsSync(path.join(multiProject, 'uxdsl.config.cjs')) && /builds:\s*\[/.test(fs.readFileSync(path.join(multiProject, 'uxdsl.config.cjs'), 'utf8')));
  check('init --multi creates src/theme.uxdsl', fs.existsSync(path.join(multiProject, 'src', 'theme.uxdsl')));
  check('init --multi creates src/panel-a.uxdsl with a real example, not an empty file', fs.readFileSync(path.join(multiProject, 'src', 'panel-a.uxdsl'), 'utf8').trim().length > 0);
  check('init --multi output documents both generated CSS files', /theme\.css/.test(multiInit1.output) && /panel-a\.css/.test(multiInit1.output));

  const multiBuild1 = runCli(['build'], multiProject);
  check('build succeeds immediately after init --multi', multiBuild1.ok);
  if (!multiBuild1.ok) console.log(multiBuild1.output);
  const themeCssPath = path.join(multiProject, 'src', 'theme.css');
  const panelCssPath = path.join(multiProject, 'src', 'panel-a.css');
  check('build produces src/theme.css', fs.existsSync(themeCssPath));
  check('build produces src/panel-a.css', fs.existsSync(panelCssPath));
  const themeCss = fs.existsSync(themeCssPath) ? fs.readFileSync(themeCssPath, 'utf8') : '';
  const panelCss = fs.existsSync(panelCssPath) ? fs.readFileSync(panelCssPath, 'utf8') : '';
  check('the theme entry defines :root', /:root/.test(themeCss));
  check('the component entry (includeTheme: false) does not define :root', !/:root/.test(panelCss));
  check('the component entry\'s @ds-surface(contained) actually compiled', /background/.test(panelCss));

  const multiTrackedFiles = ['uxdsl.config.cjs', path.join('src', 'theme.uxdsl'), path.join('src', 'panel-a.uxdsl'), 'package.json'];
  const multiBefore = snapshotHashes(multiProject, multiTrackedFiles);
  const multiInit2 = runCli(['init', '--multi'], multiProject);
  const multiAfter = snapshotHashes(multiProject, multiTrackedFiles);
  check('running init --multi a second time exits 0', multiInit2.ok);
  check('running init --multi a second time changes no existing file (hash comparison)', JSON.stringify(multiBefore) === JSON.stringify(multiAfter));

  check('plain "init" (no --multi) still produces the single-entry form, unaffected by this story', !/builds:\s*\[/.test(configContent));

  // --- 10 (MIG-B7-12, FEAT-009): editor support from a real tarball ---
  const tarball = packAndInstall({ tmpPrefix: 'uxdsl-cli-init-tarball-' });
  const DOCUMENTED_SCHEMA = './node_modules/uxdsl/schema/theme.schema.json';
  const schemaFile = path.join(tarball.dir, DOCUMENTED_SCHEMA);
  check('the documented $schema path exists inside the installed tarball', fs.existsSync(schemaFile));
  let schema = null;
  try { schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8')); } catch (_) {}
  check('the documented $schema file is a JSON Schema', !!schema && typeof schema.$schema === 'string' && /json-schema/.test(schema.$schema));
  let exported = null;
  try { exported = tarball.req.resolve('uxdsl/schema/theme.schema.json'); } catch (_) {}
  check('uxdsl/schema/theme.schema.json is reachable through the exports map', exported === fs.realpathSync(schemaFile));
  check('the installed tarball ships the config types the JSDoc imports', fs.existsSync(path.join(tarball.dir, 'node_modules', 'uxdsl', 'dist', 'entries', 'config.d.ts')));

  const tarballInit = runCli(['init'], tarball.dir);
  check('init exits 0 in the tarball-installed project', tarballInit.ok);
  const tsc = path.join(UXDSL_DIR, 'node_modules', 'typescript', 'bin', 'tsc');
  const typeCheck = () => {
    try {
      execFileSync(process.execPath, [tsc, '--noEmit', '--allowJs', '--skipLibCheck', '--target', 'es2022', '--module', 'preserve', '--moduleResolution', 'bundler', 'uxdsl.config.cjs'], { cwd: tarball.dir, encoding: 'utf8', stdio: 'pipe' });
      return { ok: true, output: '' };
    } catch (err) {
      return { ok: false, output: `${err.stdout || ''}${err.stderr || ''}` };
    }
  };
  const cleanCheck = typeCheck();
  check('the config init writes type-checks clean against the installed package', cleanCheck.ok);
  if (!cleanCheck.ok) console.log(cleanCheck.output);
  const tarballConfig = path.join(tarball.dir, 'uxdsl.config.cjs');
  fs.writeFileSync(tarballConfig, fs.readFileSync(tarballConfig, 'utf8').replace("  outFile: './src/uxdsl.css',\n", "  outFile: './src/uxdsl.css',\n  includeThem: false,\n"));
  const typoCheck = typeCheck();
  check('a typo in that config is reported (TS2561), not a missing module (TS2307)', !typoCheck.ok && /TS2561/.test(typoCheck.output) && !/TS2307/.test(typoCheck.output));

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
