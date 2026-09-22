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

  // MIG-B4-02 (FEAT-005): only the nested JSON changes — uxdsl.theme.config.cjs's
  // own file content and mtime are untouched. Before this fix, chokidar only
  // watched the top-level theme file, so this edit produced no filesystem
  // event at all and required a synthetic fs.utimesSync touch of the parent
  // file as a workaround; theme-data.json is now itself part of the watch
  // list (collectLocalRequireTree), so the real edit alone is enough.
  fs.writeFileSync(path.join(dir, 'theme-data.json'), JSON.stringify({ palette: { primary: { main: '#333333' } } }));

  await waitFor(() => fs.readFileSync(cssPath, 'utf8').includes('#333333'));
  assert.ok(fs.readFileSync(cssPath, 'utf8').includes('#333333'), 'rebuilt CSS must carry the new value from the nested JSON require()');
  assert.ok(!fs.readFileSync(cssPath, 'utf8').includes('#111111'), 'rebuilt CSS must not still carry the stale nested value');
});

// MIG-B4-02 (FEAT-005): the exact scenario a real consumer found — a build
// config (not a theme file) that delegates to another local module — never
// triggered a rebuild on its own before this fix, only the top-level
// uxdsl.config.cjs was watched.
test('watch mode reloads when the build config (not the theme file) delegates to a nested require()', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  // A real responsive declaration is required — the breakpoint value alone
  // (e.g. via the #uxdsl-bp-meta marker) is serialized as `"xl":1280`, with
  // no "px" suffix, so only an actual @media rule proves the value changed.
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '.card { width: xs(100%) xl(50%); }');
  fs.writeFileSync(path.join(dir, 'real-config.js'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', breakpoints: { xl: 1280 } };\n");
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = require('./real-config.js');\n");

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  const cssPath = path.join(dir, 'src', 'uxdsl.css');

  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('1280px'));
  await delay(WATCHER_SETTLE_MS);

  // Only real-config.js changes — uxdsl.config.cjs's own content is
  // untouched, so this exercises the config's own nested require(), the
  // exact case a real consumer reported as never triggering a rebuild.
  fs.writeFileSync(path.join(dir, 'real-config.js'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', breakpoints: { xl: 1440 } };\n");

  await waitFor(() => fs.readFileSync(cssPath, 'utf8').includes('1440px'));
  assert.ok(fs.readFileSync(cssPath, 'utf8').includes('1440px'), 'rebuilt CSS must carry the new breakpoint from the nested require()');
  assert.ok(!fs.readFileSync(cssPath, 'utf8').includes('1280px'), 'rebuilt CSS must not still carry the stale nested value');
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

// MIG-B6-23 (FEAT-008): watch mode surviving errors, atomic/skip-unchanged
// writes, and dependency-graph-based selective rebuilds.

test('MIG-B6-23: an initial compile error does not end the process; correcting the entry produces output', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
  // A real, valid config and a real entry file that fails to *compile* —
  // an unresolvable token — not a broken config file (that's the next test).
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '.a { color: palette(this-family-does-not-exist); }');

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let exited = false;
  child.on('exit', () => { exited = true; });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  await waitFor(() => /UXD_REFERENCE_MISSING|error/i.test(output));
  await delay(WATCHER_SETTLE_MS);
  assert.equal(exited, false, `the process must still be running after an initial compile error.\n${output}`);
  assert.equal(fs.existsSync(path.join(dir, 'src', 'uxdsl.css')), false, 'nothing should have been written for a build that failed to compile');

  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '.a { color: red; }');
  const cssPath = path.join(dir, 'src', 'uxdsl.css');
  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('color: red'));
  assert.equal(exited, false, 'the process must still be running after recovering from the error');
});

test('MIG-B6-23: a config broken at startup (syntax error) recovers once fixed, without restarting the CLI', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '.a { color: red; }');
  // A real syntax error, not just a semantically invalid config — this is
  // "failed to *load*", the case item 1 distinguishes from a compile error.
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), 'module.exports = { this is not valid javascript');

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let exited = false;
  child.on('exit', () => { exited = true; });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  await waitFor(() => /SyntaxError|Unexpected|error/i.test(output));
  await delay(WATCHER_SETTLE_MS);
  assert.equal(exited, false, `the process must still be running after a config file that fails to load at all.\n${output}`);

  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
  const cssPath = path.join(dir, 'src', 'uxdsl.css');
  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('color: red'));
  assert.equal(exited, false, 'the process must still be running after the config becomes loadable');
});

test('MIG-B6-23: a rebuild triggered by an unrelated watched file produces byte-identical output and preserves mtime/inode', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  // Both files match the watch glob; only unused.uxdsl changes, and
  // nothing imports it, so the entry's own compiled output cannot differ.
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '.a { color: red; }');
  fs.writeFileSync(path.join(dir, 'src', 'unused.uxdsl'), '/* not imported by anything */');

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });

  const cssPath = path.join(dir, 'src', 'uxdsl.css');
  await waitFor(() => fs.existsSync(cssPath));
  await delay(WATCHER_SETTLE_MS);
  const statBefore = fs.statSync(cssPath);

  fs.writeFileSync(path.join(dir, 'src', 'unused.uxdsl'), '/* edited, still unused by anything */');
  await waitFor(() => output.includes('unused.uxdsl'));
  await waitFor(() => /\[uxdsl\] unchanged /.test(output));
  await delay(300);

  const statAfter = fs.statSync(cssPath);
  assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, `an unaffected rebuild must not touch the output file's mtime.\n${output}`);
  assert.equal(statAfter.ino, statBefore.ino, "an unaffected rebuild must not replace the output file's inode (no rewrite happened)");
});

test('MIG-B6-23: with two entries A and B, editing a partial only B imports does not rewrite A', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), `module.exports = {
    builds: [
      { entry: './src/a.uxdsl', outFile: './src/a.css' },
      { entry: './src/b.uxdsl', outFile: './src/b.css' },
    ],
    watch: ['src/**/*.uxdsl'],
  };\n`);
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }');
  fs.writeFileSync(path.join(dir, 'src', 'b-partial.uxdsl'), '.b-partial { color: green; }');
  fs.writeFileSync(path.join(dir, 'src', 'b.uxdsl'), '@import "./b-partial.uxdsl";\n.b { color: blue; }');

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });

  const aCssPath = path.join(dir, 'src', 'a.css');
  const bCssPath = path.join(dir, 'src', 'b.css');
  await waitFor(() => fs.existsSync(aCssPath) && fs.existsSync(bCssPath));
  await waitFor(() => fs.readFileSync(bCssPath, 'utf8').includes('color: green'));
  await delay(WATCHER_SETTLE_MS);
  const aStatBefore = fs.statSync(aCssPath);

  fs.writeFileSync(path.join(dir, 'src', 'b-partial.uxdsl'), '.b-partial { color: yellow; }');
  await waitFor(() => fs.readFileSync(bCssPath, 'utf8').includes('color: yellow'));
  await delay(500);

  const aStatAfter = fs.statSync(aCssPath);
  assert.equal(aStatAfter.mtimeMs, aStatBefore.mtimeMs, `editing B's own partial must not rewrite A.\n${output}`);
  assert.equal(aStatAfter.ino, aStatBefore.ino, "editing B's own partial must not replace A's file");
  assert.doesNotMatch(fs.readFileSync(aCssPath, 'utf8'), /yellow|green/, "A's output must never contain B's partial content");
});

test('MIG-B6-23: an output file is never observed empty or truncated while a rebuild is writing it (atomic replace)', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '.a { color: red; }');

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  const cssPath = path.join(dir, 'src', 'uxdsl.css');
  await waitFor(() => fs.existsSync(cssPath));
  await delay(WATCHER_SETTLE_MS);

  let polling = true;
  let sawBadRead = null;
  const pollLoop = (async () => {
    while (polling) {
      let content;
      try {
        content = fs.readFileSync(cssPath, 'utf8');
      } catch (_) {
        sawBadRead = sawBadRead || 'output file disappeared mid-rebuild';
        await new Promise((resolve) => setImmediate(resolve));
        continue;
      }
      if (content.trim() === '' || !/color:\s*(red|blue|green|purple|orange)/.test(content)) {
        sawBadRead = sawBadRead || `output file observed empty/truncated: ${JSON.stringify(content)}`;
      }
      // Yields to the event loop each iteration — a tight synchronous loop
      // here would starve this test process's own event loop (including
      // the `waitFor` polls below), not just spin CPU. Still effectively
      // continuous: setImmediate fires as soon as the loop is idle.
      await new Promise((resolve) => setImmediate(resolve));
    }
  })();

  const colors = ['blue', 'green', 'purple', 'orange', 'red'];
  for (const color of colors) {
    fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), `.a { color: ${color}; }`);
    await waitFor(() => fs.readFileSync(cssPath, 'utf8').includes(`color: ${color}`));
  }
  polling = false;
  await pollLoop;
  assert.equal(sawBadRead, null, sawBadRead || '');
});

test('MIG-B6-23: creating a previously-missing partial recovers the build (unknown-to-the-graph file falls back to a full rebuild)', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
  // The import target doesn't exist yet — the initial build fails, so the
  // dependency graph never learns about missing-partial.uxdsl at all (it
  // isn't a dependency of anything that compiled successfully).
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '@import "./missing-partial.uxdsl";\n.a { color: red; }');

  const child = spawn(process.execPath, [CLI_BIN, 'watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let exited = false;
  child.on('exit', () => { exited = true; });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  await waitFor(() => /error/i.test(output));
  await delay(WATCHER_SETTLE_MS);
  const cssPath = path.join(dir, 'src', 'uxdsl.css');
  assert.equal(fs.existsSync(cssPath), false, 'nothing should have been written for the initial failed build');

  // Created outside the graph's knowledge (there is no graph yet) but
  // still inside the watched glob — this must still trigger a rebuild.
  fs.writeFileSync(path.join(dir, 'src', 'missing-partial.uxdsl'), '.imported { color: green; }');
  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('color: green'));
  assert.equal(exited, false, 'the process must still be running after the missing partial is created');
});
