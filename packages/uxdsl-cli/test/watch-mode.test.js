'use strict';

// Regression coverage for watch-mode bugs found by review:
// 1. `uxdsl watch` reused the config/theme object it loaded once at
//    startup on every rebuild, and even a fresh loadConfig() call would
//    have returned the same stale module thanks to require()'s cache —
//    editing uxdsl.theme.config.cjs never showed up in the output CSS.
// 2. `init`'s default `watch: ['src/**/*.uxdsl', 'src/**/*.css']` matches
//    the CLI's own output file (src/uxdsl.css) as a "source" — without
//    excluding it, every build's own write re-triggers the watcher,
//    which triggers another identical build, indefinitely.
// 3. (found on a second pass) clearing require()'s cache for only the
//    top-level config/theme file misses a file that itself does
//    `theme: require('./some-data.json')` — Node re-executes the
//    top-level file on reload, but that nested require() still resolves
//    to the untouched, pre-edit cache entry for the JSON file.
// 4. (found on the same pass) the self-triggering fix from #2 excluded
//    `outFile` once, at watcher-construction time — if a config reload
//    changes `outFile` to a new path, the new path was never excluded,
//    so the loop from #2 could recur under a different filename.
//
// All four need a real chokidar watcher reacting to real filesystem
// events, so this drives the actual `uxdsl watch` subprocess in a temp
// project rather than calling startWatch()'s internals directly.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const CLI_BIN = path.resolve(__dirname, '..', 'bin', 'uxdsl.js');
const POSTCSS_UXDSL_DIR = path.resolve(__dirname, '..', '..', 'postcss-uxdsl');

test('watch retargets themeFile and source globs without restarting the CLI', async t => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'old'));
  fs.mkdirSync(path.join(dir, 'next'));
  const put = (file, text) => fs.writeFileSync(path.join(dir, file), text);
  const config = (folder, theme) => `module.exports={entry:'./${folder}/entry.uxdsl',outFile:'./out.css',watch:['${folder}/**/*.uxdsl'],themeFile:'./${theme}.json'};`;
  put('old/entry.uxdsl', '.old { color: red; }');
  put('next/entry.uxdsl', '.next { color: blue; }');
  put('first.json', JSON.stringify({ palette: { primary: { main: '#123456' } } }));
  put('second.json', JSON.stringify({ palette: { primary: { main: '#abcdef' } } }));
  put('uxdsl.config.cjs', config('old', 'first'));
  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let logs = '';
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  const css = () => fs.existsSync(path.join(dir, 'out.css')) ? fs.readFileSync(path.join(dir, 'out.css'), 'utf8') : '';
  await waitFor(() => css().includes('#123456'));
  await delay(WATCHER_SETTLE_MS);
  put('uxdsl.config.cjs', config('next', 'second'));
  await waitFor(() => css().includes('#abcdef'));
  put('second.json', JSON.stringify({ palette: { primary: { main: '#fedcba' } } }));
  await waitFor(() => css().includes('#fedcba'));
  put('next/entry.uxdsl', '.updated { color: green; }');
  await waitFor(() => css().includes('.updated'));
  await delay(300);
  const before = (logs.match(/\[uxdsl\] built/g) || []).length;
  put('first.json', '{}');
  put('old/entry.uxdsl', '.unused {}');
  await delay(700);
  assert.equal((logs.match(/\[uxdsl\] built/g) || []).length, before, logs);
});

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-watch-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'watch-test', version: '0.0.0' }, null, 2));
  return dir;
}

function installPostcssUxdsl(dir) {
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--no-save', POSTCSS_UXDSL_DIR], { cwd: dir, stdio: 'pipe' });
}

// Generous timeouts: this spawns a real npm-installed CLI process and
// waits on real chokidar filesystem events, both of which can be
// meaningfully slower on a loaded or cold-cache machine than on a
// developer laptop with a warm npm cache.
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// chokidar's watch() call is synchronous, but the underlying OS-level
// watch handles can take a moment to actually arm, especially on a
// loaded machine or an unfamiliar filesystem. Editing a file immediately
// after confirming the initial build risks a race where the edit lands
// before the watcher is truly ready to see it, producing a flaky timeout
// that has nothing to do with the behavior under test.
const WATCHER_SETTLE_MS = 1000;

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
  await delay(WATCHER_SETTLE_MS);

  // Edit the theme file's palette after the watcher is already running —
  // this is the exact repro: change primary.main, expect the rebuilt CSS
  // to carry the new value, not the one resolved at watch startup.
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.config.cjs'), "module.exports = { palette: { primary: { main: '#222222' } } };\n");

  await waitFor(() => fs.readFileSync(cssPath, 'utf8').includes('#222222'));
  assert.ok(fs.readFileSync(cssPath, 'utf8').includes('#222222'), 'rebuilt CSS must carry the new primary.main value');
  assert.ok(!fs.readFileSync(cssPath, 'utf8').includes('#111111'), 'rebuilt CSS must not still carry the stale value');
});

test('watch mode reloads a theme value that comes from a nested require() (e.g. a separate JSON file), not just the top-level theme file', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '/* zero-config, all tokens come from the theme */');
  // The theme file itself is stable; the actual token data lives in a
  // separate JSON file it requires — a common real-world split (JSON as
  // pure data, a thin .cjs wrapper around it). Only theme-data.json
  // changes between builds; uxdsl.theme.config.cjs itself never does.
  fs.writeFileSync(path.join(dir, 'theme-data.json'), JSON.stringify({ palette: { primary: { main: '#111111' } } }));
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.config.cjs'), "module.exports = require('./theme-data.json');\n");

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  const cssPath = path.join(dir, 'src', 'uxdsl.css');

  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('#111111'));
  await delay(WATCHER_SETTLE_MS);

  // Only the nested JSON changes — uxdsl.theme.config.cjs's own file
  // content and mtime are untouched, so this exercises the require()
  // cache specifically for the dependency, not the top-level file.
  fs.writeFileSync(path.join(dir, 'theme-data.json'), JSON.stringify({ palette: { primary: { main: '#333333' } } }));
  // theme-data.json isn't itself in `watch` — touch the theme file (whose
  // content is unchanged) so chokidar has something to react to, exactly
  // as an editor's "save" would if a project watched the whole directory.
  fs.utimesSync(path.join(dir, 'uxdsl.theme.config.cjs'), new Date(), new Date());

  await waitFor(() => fs.readFileSync(cssPath, 'utf8').includes('#333333'));
  assert.ok(fs.readFileSync(cssPath, 'utf8').includes('#333333'), 'rebuilt CSS must carry the new value from the nested JSON require()');
  assert.ok(!fs.readFileSync(cssPath, 'utf8').includes('#111111'), 'rebuilt CSS must not still carry the stale nested value');
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
  await delay(6000);
  assert.equal(buildCount, 1, `expected exactly 1 build (the initial one); got ${buildCount} — the watcher is reacting to its own output write.\n${output}`);
});

// MIG-B3-02 (FEAT-004): a "builds" config drives a single watcher across
// several entries. Unlike the unit-level buildOnce/loadConfig tests
// elsewhere, this exercises the full main()/startWatch() wiring with a real
// chokidar watcher and a real spawned CLI process.
test('watch mode with a "builds" config rebuilds every entry from one watcher, excluding both output files from self-triggering', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), `module.exports = {
    builds: [
      { entry: './src/theme.uxdsl', outFile: './src/theme.css', includeTheme: true },
      { entry: './src/panel.uxdsl', outFile: './src/panel.css', includeTheme: false },
    ],
    // Matches init's own default watch list, and both compiled outFiles —
    // the exact shape that needs the self-trigger exclusion to do anything.
    watch: ['src/**/*.uxdsl', 'src/**/*.css'],
  };\n`);
  fs.writeFileSync(path.join(dir, 'src', 'theme.uxdsl'), '/* theme-only entry */');
  fs.writeFileSync(path.join(dir, 'src', 'panel.uxdsl'), '.card { color: red; }');
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.config.cjs'), "module.exports = { palette: { primary: { main: '#111111' } } };\n");

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  const themeCssPath = path.join(dir, 'src', 'theme.css');
  const panelCssPath = path.join(dir, 'src', 'panel.css');
  await waitFor(() => fs.existsSync(themeCssPath) && fs.existsSync(panelCssPath));
  await waitFor(() => fs.readFileSync(themeCssPath, 'utf8').includes('#111111'));
  assert.doesNotMatch(fs.readFileSync(panelCssPath, 'utf8'), /:root/, 'the includeTheme: false entry must not define :root');
  await delay(WATCHER_SETTLE_MS);

  // Editing the theme file rebuilds both entries against the new theme.
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.config.cjs'), "module.exports = { palette: { primary: { main: '#222222' } } };\n");
  await waitFor(() => fs.readFileSync(themeCssPath, 'utf8').includes('#222222'));
  await delay(WATCHER_SETTLE_MS);

  const buildCount = () => (output.match(/\[uxdsl\] built /g) || []).length;
  const before = buildCount();
  // Neither output file is a real source change — give a self-triggering
  // loop, if either exclusion were missing, several cycles to manifest.
  await delay(4000);
  assert.equal(buildCount(), before, `neither builds[] outFile may trigger its own rebuild.\n${output}`);
});

test('changing outFile via a config reload does not resurrect the self-triggered rebuild loop under the new path', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '/* zero-config */');
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl', 'src/**/*.css'] };\n");

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  const buildCountFor = (name) => (output.match(new RegExp(`\\[uxdsl\\] built ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) || []).length;

  const originalCss = path.join(dir, 'src', 'uxdsl.css');
  await waitFor(() => fs.existsSync(originalCss));
  await delay(WATCHER_SETTLE_MS);

  // Move outFile to a second path matched by the same broad `**/*.css`
  // watch glob — the exact scenario a static, construction-time `ignored`
  // can't handle: it would still (harmlessly) exclude the old path
  // forever, but never learn about this new one.
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl-renamed.css', watch: ['src/**/*.uxdsl', 'src/**/*.css'] };\n");
  const renamedCss = path.join(dir, 'src', 'uxdsl-renamed.css');
  await waitFor(() => fs.existsSync(renamedCss));
  await delay(6000);

  assert.equal(buildCountFor('src/uxdsl-renamed.css'), 1, `expected exactly 1 build of the new outFile; the watcher is reacting to its own output write under the new path.\n${output}`);
});
