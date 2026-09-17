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
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI_BIN = path.join(REPO_ROOT, 'packages', 'uxdsl-cli', 'bin', 'uxdsl.js');
const POSTCSS_UXDSL_DIR = path.join(REPO_ROOT, 'packages', 'postcss-uxdsl');

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

function installPostcssUxdsl(projectDir) {
  // Matches the documented flow (`npm install -D uxdsl-cli postcss-uxdsl`):
  // both packages installed as siblings in the project's own node_modules.
  // Installed from this checkout's own directory (not a tarball) — MIG-B2-05
  // is the story that owns tarball-fidelity gates; this one is about init/
  // build actually working, using the CLI's real dependency-resolution path.
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--no-save', POSTCSS_UXDSL_DIR], { cwd: projectDir, stdio: 'pipe' });
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
  installPostcssUxdsl(project);

  const init1 = runCli(['init'], project);
  check('init exits 0 in an empty project with a minimal package.json', init1.ok && init1.code === 0);
  check('init creates uxdsl.config.cjs', fs.existsSync(path.join(project, 'uxdsl.config.cjs')));
  check('init creates src/uxdsl-entry.uxdsl', fs.existsSync(path.join(project, 'src', 'uxdsl-entry.uxdsl')));
  check('init does NOT create postcss.config.js (no Next.js marker present)', !fs.existsSync(path.join(project, 'postcss.config.js')));
  check('init output documents the generated CSS import and watch command', /src\/uxdsl\.css/.test(init1.output) && /uxdsl:watch/.test(init1.output));
  const entryContent = fs.existsSync(path.join(project, 'src', 'uxdsl-entry.uxdsl'))
    ? fs.readFileSync(path.join(project, 'src', 'uxdsl-entry.uxdsl'), 'utf8')
    : '';
  check('generated entry does not duplicate the canonical theme with legacy default imports', !/postcss-uxdsl\/theme\/default-/.test(entryContent));
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
  const trackedFiles = ['uxdsl.config.cjs', path.join('src', 'uxdsl-entry.uxdsl'), 'package.json'];
  const before = snapshotHashes(project, trackedFiles);
  const init2 = runCli(['init'], project);
  const after = snapshotHashes(project, trackedFiles);
  check('running init a second time exits 0', init2.ok);
  check('running init a second time changes no existing file (hash comparison)', JSON.stringify(before) === JSON.stringify(after));

  // --- 6: a pre-existing uxdsl.config.cjs and postcss.config.js survive untouched ---
  const preserveProject = mkProject();
  installPostcssUxdsl(preserveProject);
  fs.writeFileSync(path.join(preserveProject, 'next.config.js'), 'module.exports = {};\n');
  const canaryConfig = "module.exports = { entry: './src/custom-entry.uxdsl', outFile: './src/custom.css', watch: [] };\n// CANARY: hand-written, must survive init untouched\n";
  const canaryPostcss = "module.exports = { plugins: { 'postcss-uxdsl': {}, 'autoprefixer': {} } };\n// CANARY: hand-written, must survive init untouched\n";
  fs.writeFileSync(path.join(preserveProject, 'uxdsl.config.cjs'), canaryConfig);
  fs.writeFileSync(path.join(preserveProject, 'postcss.config.js'), canaryPostcss);
  runCli(['init'], preserveProject);
  check('a pre-existing uxdsl.config.cjs is never overwritten', fs.readFileSync(path.join(preserveProject, 'uxdsl.config.cjs'), 'utf8') === canaryConfig);
  check('a pre-existing postcss.config.js is never overwritten or corrupted', fs.readFileSync(path.join(preserveProject, 'postcss.config.js'), 'utf8') === canaryPostcss);

  // --- 7: Next.js detection creates postcss.config.js only when absent ---
  const nextProject = mkProject();
  installPostcssUxdsl(nextProject);
  fs.writeFileSync(path.join(nextProject, 'next.config.js'), 'module.exports = {};\n');
  const nextInit = runCli(['init'], nextProject);
  check('with a next.config.js marker present, init creates postcss.config.js', nextInit.ok && fs.existsSync(path.join(nextProject, 'postcss.config.js')));
  check('the created postcss.config.js references postcss-uxdsl', fs.existsSync(path.join(nextProject, 'postcss.config.js')) && fs.readFileSync(path.join(nextProject, 'postcss.config.js'), 'utf8').includes('postcss-uxdsl'));

  // --- 8: actionable error messages ---
  const missingEntry = runCli(['build', '--entry', 'src/does-not-exist.uxdsl', '--out', 'src/out.css'], project);
  check('a missing --entry file fails with a message naming --entry and the expected path', !missingEntry.ok && /--entry/.test(missingEntry.output) && /does-not-exist\.uxdsl/.test(missingEntry.output));

  const missingConfig = runCli(['build', '--config', 'missing.cjs'], project);
  check('a missing --config file fails with a clear, specific message', !missingConfig.ok && /Configuration file not found/.test(missingConfig.output) && /missing\.cjs/.test(missingConfig.output));

  const badConfigProject = mkProject();
  installPostcssUxdsl(badConfigProject);
  fs.writeFileSync(path.join(badConfigProject, 'uxdsl.config.cjs'), 'module.exports = { entry: 123, outFile: "./src/uxdsl.css" };\n');
  const badConfig = runCli(['build'], badConfigProject);
  check('an invalid config property (wrong type) names the file and the property', !badConfig.ok && /uxdsl\.config\.cjs/.test(badConfig.output) && /"entry"/.test(badConfig.output));

  // --- 9 (MIG-B4-03, FEAT-005): --multi scaffolds a "builds" project ---
  const multiProject = mkProject();
  installPostcssUxdsl(multiProject);
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
