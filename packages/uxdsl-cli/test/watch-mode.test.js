'use strict';

// Regression coverage for two watch-mode bugs found by review:
// 1. `uxdsl watch` reused the config/theme object it loaded once at
//    startup on every rebuild, and even a fresh loadConfig() call would
//    have returned the same stale module thanks to require()'s cache —
//    editing uxdsl.theme.config.cjs never showed up in the output CSS.
// 2. `init`'s default `watch: ['src/**/*.uxdsl', 'src/**/*.css']` matches
//    the CLI's own output file (src/uxdsl.css) as a "source" — without
//    excluding it, every build's own write re-triggers the watcher,
//    which triggers another identical build, indefinitely.
//
// Both need a real chokidar watcher reacting to real filesystem events,
// so this drives the actual `uxdsl watch` subprocess in a temp project
// rather than calling startWatch()'s internals directly.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const CLI_BIN = path.resolve(__dirname, '..', 'bin', 'uxdsl.js');
const POSTCSS_UXDSL_DIR = path.resolve(__dirname, '..', '..', 'postcss-uxdsl');

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-watch-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'watch-test', version: '0.0.0' }, null, 2));
  return dir;
}

function installPostcssUxdsl(dir) {
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--no-save', POSTCSS_UXDSL_DIR], { cwd: dir, stdio: 'pipe' });
}

function waitFor(predicate, { timeout = 10000, interval = 100 } = {}) {
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

test('watch mode reloads config and theme on change instead of serving a stale require() cache', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '/* zero-config, all tokens come from the theme */');
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.config.cjs'), "module.exports = { palette: { primary: { main: '#111111' } } };\n");

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  const cssPath = path.join(dir, 'src', 'uxdsl.css');

  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('#111111'));

  // Edit the theme file's palette after the watcher is already running —
  // this is the exact repro: change primary.main, expect the rebuilt CSS
  // to carry the new value, not the one resolved at watch startup.
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.config.cjs'), "module.exports = { palette: { primary: { main: '#222222' } } };\n");

  await waitFor(() => fs.readFileSync(cssPath, 'utf8').includes('#222222'));
  assert.ok(fs.readFileSync(cssPath, 'utf8').includes('#222222'), 'rebuilt CSS must carry the new primary.main value');
  assert.ok(!fs.readFileSync(cssPath, 'utf8').includes('#111111'), 'rebuilt CSS must not still carry the stale value');
});

test('watch mode does not treat its own output file as a source change (no self-triggered rebuild loop)', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  // Matches exactly what `init` generates: a watch glob that, without the
  // exclusion, matches the output file itself.
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl', 'src/**/*.css'] };\n");
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '/* zero-config */');

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let buildCount = 0;
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
    buildCount = (output.match(/\[uxdsl\] built /g) || []).length;
  });

  const cssPath = path.join(dir, 'src', 'uxdsl.css');
  await waitFor(() => fs.existsSync(cssPath));
  // Give a self-triggered loop, if the bug were still present, several
  // full cycles to manifest — a single build settles well within this.
  await new Promise((resolve) => setTimeout(resolve, 5000));
  assert.equal(buildCount, 1, `expected exactly 1 build (the initial one); got ${buildCount} — the watcher is reacting to its own output write.\n${output}`);
});
