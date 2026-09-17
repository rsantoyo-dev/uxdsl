'use strict';

// MIG-B4-04 (FEAT-005): release gate for beta.4's zero-remaining-friction
// work, reproducing all three stories against real npm tarballs of all
// five packages — no resolution back into the monorepo.
//
// Reuses the same tarball pack/install mechanism as mig-b2-05-release and
// mig-b3-06-release (fixtures/lib/tarball-consumer.js) rather than
// re-implementing it.
//
// This does not publish anything — publication requires the owner's
// separate, explicit approval, same as beta.2 and beta.3.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { packAndInstall } = require('../lib/tarball-consumer');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor(predicate, { timeout = 20000, interval = 150 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      let result;
      try {
        result = predicate();
      } catch (err) {
        reject(err);
        return;
      }
      if (result) {
        resolve(result);
        return;
      }
      if (Date.now() - start > timeout) {
        reject(new Error('waitFor timed out'));
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

async function main() {
  const { dir, run, write, req } = packAndInstall({ tmpPrefix: 'uxdsl-beta4-release-' });
  const cli = path.join(dir, 'node_modules/uxdsl-cli/bin/uxdsl.js');
  const command = (...args) => run(process.execPath, [cli, ...args]);
  const read = (name) => fs.readFileSync(path.join(dir, 'src', name), 'utf8');

  // --- Phase 1 (MIG-B4-03): `init --multi` scaffolds a working builds
  // project from the real, tarball-installed CLI. ---
  command('init', '--multi');
  const configContent = fs.readFileSync(path.join(dir, 'uxdsl.config.cjs'), 'utf8');
  assert.match(configContent, /builds:\s*\[/, 'init --multi must generate a "builds" array');
  assert.ok(fs.existsSync(path.join(dir, 'src/theme.uxdsl')));
  assert.ok(fs.existsSync(path.join(dir, 'src/panel-a.uxdsl')));

  command('build');
  const initialTheme = read('theme.css');
  const initialPanel = read('panel-a.css');
  assert.match(initialTheme, /:root/, 'the theme entry must define :root');
  assert.doesNotMatch(initialPanel, /:root/, 'the component entry (includeTheme: false) must not define :root');
  const bpMetaCount = (initialTheme + initialPanel).match(/#uxdsl-bp-meta/g)?.length || 0;
  assert.equal(bpMetaCount, 1, 'expected exactly one #uxdsl-bp-meta across both entries');
  console.log('PASS: init --multi scaffolds a working builds project from the installed CLI.');

  // --- Phase 2 (MIG-B4-02 + MIG-B4-01): the build config itself (not a
  // separate theme file) delegates its `theme` to a nested require() —
  // the exact shape a real consumer reported as never triggering a
  // rebuild — combined with --strict-theme on a partial theme. ---
  write('theme-data.json', JSON.stringify({ palette: { primary: { main: '#123456' } } }));
  write('uxdsl.config.cjs', `module.exports = {
    builds: [
      { entry: './src/theme.uxdsl', outFile: './src/theme.css' },
      { entry: './src/panel-a.uxdsl', outFile: './src/panel-a.css', includeTheme: false },
    ],
    theme: require('./theme-data.json'),
    watch: ['src/**/*.uxdsl'],
  };\n`);

  // Partial palette (only primary.main) + --strict-theme: must fail,
  // naming the family, and must not touch the previous good output.
  assert.throws(
    () => command('build', '--strict-theme'),
    (error) => /--strict-theme:.*palette/.test(String(error.stderr))
  );
  assert.equal(read('theme.css'), initialTheme, 'a failed --strict-theme build must not touch the previous output');
  console.log('PASS: --strict-theme fails on a partially-defaulted family declared via a nested require(), writing nothing.');

  // Complete the family: --strict-theme must now pass.
  const { DEFAULT_THEME } = req('postcss-uxdsl/ds-runtime');
  write('theme-data.json', JSON.stringify({ palette: DEFAULT_THEME.palette }));
  command('build', '--strict-theme'); // Must not throw.
  console.log('PASS: --strict-theme passes once every key of the declared family is explicit.');

  // --- Phase 3 (MIG-B4-02): a real `uxdsl watch`, editing *only* the
  // nested theme-data.json — never uxdsl.config.cjs itself — must still
  // trigger a rebuild. This is the exact gap a real consumer found:
  // before the fix, only the top-level config file was watched. ---
  write('theme-data.json', JSON.stringify({ palette: { ...DEFAULT_THEME.palette, primary: { ...DEFAULT_THEME.palette.primary, main: '#111111' } } }));
  const child = spawn(process.execPath, [cli, 'watch'], { cwd: dir, stdio: 'pipe' });
  let watchOutput = '';
  child.stdout.on('data', (chunk) => { watchOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { watchOutput += chunk.toString(); });
  try {
    await waitFor(() => fs.existsSync(path.join(dir, 'src/theme.css')) && read('theme.css').includes('#111111'));
    await delay(1000); // Let the watcher settle before the real edit — matches watch-mode.test.js's own convention.

    // Only the nested JSON changes — uxdsl.config.cjs's own content and
    // mtime are untouched.
    write('theme-data.json', JSON.stringify({ palette: { ...DEFAULT_THEME.palette, primary: { ...DEFAULT_THEME.palette.primary, main: '#222222' } } }));
    await waitFor(() => read('theme.css').includes('#222222'));
    assert.ok(read('theme.css').includes('#222222'), 'rebuilt CSS must carry the new value from the nested require()');
    assert.ok(!read('theme.css').includes('#111111'), 'rebuilt CSS must not still carry the stale value');
  } finally {
    child.kill();
  }
  console.log('PASS: uxdsl watch rebuilds when only a build config\'s nested require() changes, against the installed tarball.');
}

main().catch((error) => {
  console.error(error.stdout || '', error.stderr || '', error);
  process.exitCode = 1;
});
