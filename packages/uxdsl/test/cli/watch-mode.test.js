'use strict';

// Regression coverage for watch-mode bugs found by review:
// 1. `uxdsl watch` reused the config/theme object it loaded once at
//    startup on every rebuild, and even a fresh loadConfig() call would
//    have returned the same stale module thanks to require()'s cache —
//    editing uxdsl.theme.cjs never showed up in the output CSS.
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
// events, so this drives the actual `uxdsl build --watch` subprocess in a temp
// project rather than calling startWatch()'s internals directly.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const CLI_BIN = path.resolve(__dirname, '..', '..', 'bin', 'uxdsl.js');
const POSTCSS_UXDSL_DIR = path.resolve(__dirname, '..', '..');

test('watch retargets the entry and source globs without restarting the CLI, and keeps following the theme file', async t => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'old'));
  fs.mkdirSync(path.join(dir, 'next'));
  const put = (file, text) => fs.writeFileSync(path.join(dir, file), text);
  // The theme file is discovered by name next to the config (there is no
  // `themeFile` pointer); what a config reload retargets is the entry and the
  // watch globs.
  const config = (folder) => `module.exports={entry:'./${folder}/entry.uxdsl',outFile:'./out.css',watch:['${folder}/**/*.uxdsl']};`;
  put('old/entry.uxdsl', '.old { color: red; }');
  put('next/entry.uxdsl', '.next { color: blue; }');
  put('uxdsl.theme.json', JSON.stringify({ palette: { primary: { main: '#123456' } } }));
  put('uxdsl.config.cjs', config('old'));
  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let logs = '';
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  const css = () => fs.existsSync(path.join(dir, 'out.css')) ? fs.readFileSync(path.join(dir, 'out.css'), 'utf8') : '';
  await waitFor(() => css().includes('#123456') && css().includes('.old'));
  await delay(WATCHER_SETTLE_MS);
  put('uxdsl.config.cjs', config('next'));
  await waitFor(() => css().includes('.next'));
  put('uxdsl.theme.json', JSON.stringify({ palette: { primary: { main: '#fedcba' } } }));
  await waitFor(() => css().includes('#fedcba'));
  put('next/entry.uxdsl', '.updated { color: green; }');
  await waitFor(() => css().includes('.updated'));
  await delay(300);
  const before = (logs.match(/\[uxdsl\] built/g) || []).length;
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
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.cjs'), "module.exports = { palette: { primary: { main: '#111111' } } };\n");

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  const cssPath = path.join(dir, 'src', 'uxdsl.css');

  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('#111111'));
  await delay(WATCHER_SETTLE_MS);

  // Edit the theme file's palette after the watcher is already running —
  // this is the exact repro: change primary.main, expect the rebuilt CSS
  // to carry the new value, not the one resolved at watch startup.
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.cjs'), "module.exports = { palette: { primary: { main: '#222222' } } };\n");

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
  // changes between builds; uxdsl.theme.cjs itself never does.
  fs.writeFileSync(path.join(dir, 'theme-data.json'), JSON.stringify({ palette: { primary: { main: '#111111' } } }));
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.cjs'), "module.exports = require('./theme-data.json');\n");

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  const cssPath = path.join(dir, 'src', 'uxdsl.css');

  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('#111111'));
  await delay(WATCHER_SETTLE_MS);

  // MIG-B4-02 (FEAT-005): only the nested JSON changes — uxdsl.theme.cjs's
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
  // The nested module decides which entry is compiled — the one build-config
  // value whose effect is unmistakable in the output. (It used to carry
  // `breakpoints`, which a build config no longer accepts.)
  fs.writeFileSync(path.join(dir, 'src', 'first.uxdsl'), '.first { color: red; }');
  fs.writeFileSync(path.join(dir, 'src', 'second.uxdsl'), '.second { color: blue; }');
  fs.writeFileSync(path.join(dir, 'real-config.js'), "module.exports = { entry: './src/first.uxdsl', outFile: './src/uxdsl.css' };\n");
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = require('./real-config.js');\n");

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  const cssPath = path.join(dir, 'src', 'uxdsl.css');

  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('.first'));
  await delay(WATCHER_SETTLE_MS);

  // Only real-config.js changes — uxdsl.config.cjs's own content is
  // untouched, so this exercises the config's own nested require(), the
  // exact case a real consumer reported as never triggering a rebuild.
  fs.writeFileSync(path.join(dir, 'real-config.js'), "module.exports = { entry: './src/second.uxdsl', outFile: './src/uxdsl.css' };\n");

  await waitFor(() => fs.readFileSync(cssPath, 'utf8').includes('.second'));
  assert.ok(fs.readFileSync(cssPath, 'utf8').includes('.second'), 'rebuilt CSS must come from the entry the nested require() now names');
  assert.ok(!fs.readFileSync(cssPath, 'utf8').includes('.first'), 'rebuilt CSS must not still carry the stale entry');
});

test('watch mode does not treat its own output file as a source change (no self-triggered rebuild loop)', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  // Matches exactly what `init` generates: a watch glob that, without the
  // exclusion, matches the output file itself.
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl', 'src/**/*.css'] };\n");
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '/* zero-config */');

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
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
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.cjs'), "module.exports = { palette: { primary: { main: '#111111' } } };\n");

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
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
  fs.writeFileSync(path.join(dir, 'uxdsl.theme.cjs'), "module.exports = { palette: { primary: { main: '#222222' } } };\n");
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

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
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

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let exited = false;
  child.on('exit', () => { exited = true; });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  await waitFor(() => /UXD_PALETTE_REFERENCE|error/i.test(output));
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

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
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

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
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
  // MIG-B7-15 (FEAT-009): the message says what "unchanged" means.
  assert.match(output, /\[uxdsl\] unchanged src[\\/]uxdsl\.css \(compiled output identical to the file on disk; not rewritten\)/);
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

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
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
  // The declarations B's partial writes, not the bare words: the generated
  // theme block legitimately names a `green` Colors family (stability phase 5).
  assert.doesNotMatch(fs.readFileSync(aCssPath, 'utf8'), /color: (yellow|green)/, "A's output must never contain B's partial content");
});

test('MIG-B6-23: an output file is never observed empty or truncated while a rebuild is writing it (atomic replace)', async (t) => {
  const dir = mkProject();
  installPostcssUxdsl(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
  fs.writeFileSync(path.join(dir, 'src', 'uxdsl-entry.uxdsl'), '.a { color: red; }');

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
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

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let exited = false;
  child.on('exit', () => { exited = true; });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  // The first build of a watch session fails like any later one, as
  // `[uxdsl] build failed: … UXD_SASS: Can't find stylesheet to import.`.
  await waitFor(() => /UXD_SASS|error/i.test(output));
  await delay(WATCHER_SETTLE_MS);
  const cssPath = path.join(dir, 'src', 'uxdsl.css');
  assert.equal(fs.existsSync(cssPath), false, 'nothing should have been written for the initial failed build');

  // Created outside the graph's knowledge (there is no graph yet) but
  // still inside the watched glob — this must still trigger a rebuild.
  fs.writeFileSync(path.join(dir, 'src', 'missing-partial.uxdsl'), '.imported { color: green; }');
  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('color: green'));
  assert.equal(exited, false, 'the process must still be running after the missing partial is created');
});

// A compile failure in a watch session, the first build included, prints
// `[uxdsl] build failed: ` with the same message and frame as a one-shot build;
// a config failure keeps `[uxdsl] Error: … — watching for a fix...`.
test('MIG-B9-14: in watch mode every failed build, the first one included, prints build failed: with the same frame, and the process keeps watching', async (t) => {
  const dir = mkProject();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css', includeTheme: false };\n");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), "@use './missing';\n.a { color: red; }\n");

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let exited = false;
  child.on('exit', () => { exited = true; });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.stdout.on('data', () => {});

  await waitFor(() => /root stylesheet/.test(stderr));
  assert.match(stderr, /^\[uxdsl\] build failed: src\/a\.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import\.\n {4}╷\n {2}1 │ @use '\.\/missing';\n {4}│ \^{16}\n {4}╵\n {4}src\/a\.uxdsl 1:1 {2}root stylesheet\n/, stderr);
  assert.doesNotMatch(stderr, /\[uxdsl\] Error:/, 'the first build of a watch session is a build failure like any later one');
  await delay(WATCHER_SETTLE_MS);

  const cssPath = path.join(dir, 'out', 'a.css');
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a {\n  color: red;\n}\n');
  await waitFor(() => fs.existsSync(cssPath) && fs.readFileSync(cssPath, 'utf8').includes('color: red'));
  const lastGood = fs.readFileSync(cssPath, 'utf8');
  await delay(300);

  // A UXDSL error prints PostCSS's frame of the author's source.
  const before = stderr.length;
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a {\n  color: red;\n  padding: density(99);\n}\n');
  await waitFor(() => /^> 3 \|/m.test(stderr.slice(before)));
  const failure = stderr.slice(before);
  assert.match(failure, /^\[uxdsl\] build failed: uxdsl: src\/a\.uxdsl:3:3: UXD_DENSITY_REFERENCE: density\(99\) does not exist/m, failure);
  assert.match(failure, /^> 3 \| {3}padding: density\(99\);$/m, failure);
  assert.equal(fs.readFileSync(cssPath, 'utf8'), lastGood, 'the last good output stays on disk');
  assert.equal(exited, false, 'the process keeps watching');

  // Negative control: a config that fails to load is not a build failure.
  const configBefore = stderr.length;
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), 'module.exports = { this is not valid javascript');
  await waitFor(() => /watching for a fix/.test(stderr.slice(configBefore)));
  await delay(500);
  const configFailure = stderr.slice(configBefore);
  assert.match(configFailure, /^\[uxdsl\] Error: [\s\S]* — watching for a fix\.\.\.$/m, configFailure);
  assert.doesNotMatch(configFailure, /build failed:/);
  assert.equal(exited, false);
});

// `build --watch` starts from the first build's dependency graph and follows
// every entry and every file Dart Sass loaded, through their directories, so
// a `.scss` partial or a partial outside the entry's directory rebuilds the
// entries that load it, and only those.
test("MIG-B9-14: editing a @use'd partial rebuilds only the entries that load it; a missing partial keeps the previous output until it appears", async (t) => {
  const dir = mkProject();
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  // No `watch` key: the patterns are the entries and src/**/*.uxdsl, which
  // match neither the .scss partial nor anything under shared/.
  put('uxdsl.config.cjs', `module.exports = { builds: [
    { entry: './src/a.uxdsl', outFile: './out/a.css', includeTheme: false },
    { entry: './src/b.uxdsl', outFile: './out/b.css', includeTheme: false },
  ] };\n`);
  put('src/a.uxdsl', '.a { color: red; }\n');
  put('src/b.uxdsl', "@use './part';\n@use './tokens';\n@use '../shared/far';\n.b { color: blue; }\n");
  put('src/_part.uxdsl', "@import './legacy';\n.part { color: olive; }\n");
  put('src/_legacy.uxdsl', '.legacy { color: gray; }\n');
  put('src/_tokens.scss', '.tok { color: gold; }\n');
  put('shared/_far.uxdsl', '.far { color: teal; }\n');
  put('shared/notes.txt', 'notes\n');

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const bCss = () => fs.readFileSync(path.join(dir, 'out', 'b.css'), 'utf8');
  const builtB = /\[uxdsl\] built out[\\/]b\.css/;
  await waitFor(() => /watching for changes/.test(output) && fs.existsSync(path.join(dir, 'out', 'b.css')));
  await delay(WATCHER_SETTLE_MS);

  // The first edit after start already rebuilds only b, from the first build's graph.
  let mark = output.length;
  put('src/_part.uxdsl', "@import './legacy';\n.part { color: maroon; }\n");
  await waitFor(() => builtB.test(output.slice(mark)));
  await delay(WATCHER_SETTLE_MS);
  const firstEdit = output.slice(mark);
  assert.doesNotMatch(firstEdit, /out[\\/]a\.css/, `a does not load the partial, so it is not rebuilt:\n${firstEdit}`);
  const beforeBuilt = firstEdit.slice(0, firstEdit.search(builtB));
  assert.equal(beforeBuilt.split('\n').filter((line) => line === '[uxdsl] Warning: src/_part.uxdsl:1:9: UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.').length, 1, firstEdit);
  assert.match(bCss(), /maroon/);

  // A .scss partial and a partial outside the entry's directory rebuild b.
  put('src/_tokens.scss', '.tok { color: khaki; }\n');
  await waitFor(() => bCss().includes('khaki'));
  put('shared/_far.uxdsl', '.far { color: navy; }\n');
  await waitFor(() => bCss().includes('navy'));
  await delay(WATCHER_SETTLE_MS);

  // Negative control: a file beside a followed one is not followed.
  mark = output.length;
  put('shared/notes.txt', 'edited\n');
  await delay(WATCHER_SETTLE_MS * 1.5);
  assert.doesNotMatch(output.slice(mark), /\[uxdsl\] (built|unchanged|change|add)\b/, output.slice(mark));

  // Deleting a loaded partial fails with UXD_SASS and keeps b's last output;
  // re-creating it rebuilds b.
  const lastGood = bCss();
  mark = output.length;
  fs.unlinkSync(path.join(dir, 'shared', '_far.uxdsl'));
  await waitFor(() => /root stylesheet/.test(output.slice(mark)));
  assert.match(output.slice(mark), /^\[uxdsl\] build failed: builds\[1\] \(out[\\/]b\.css\): src\/b\.uxdsl:3:1: UXD_SASS: Can't find stylesheet to import\.$/m, output.slice(mark));
  assert.match(output.slice(mark), /^ {2}3 │ @use '\.\.\/shared\/far';$/m, output.slice(mark));
  assert.equal(bCss(), lastGood, 'the last good output stays');
  await delay(500);
  put('shared/_far.uxdsl', '.far { color: lime; }\n');
  await waitFor(() => bCss().includes('lime'));

  // A partial b starts loading before it exists: the build fails and keeps the
  // output; creating the file, where a watch pattern matches it, rebuilds.
  await delay(500);
  const beforeMissing = bCss();
  mark = output.length;
  put('src/b.uxdsl', "@use './part';\n@use './tokens';\n@use '../shared/far';\n@use './later';\n.b { color: blue; }\n");
  await waitFor(() => /UXD_SASS: Can't find stylesheet to import\./.test(output.slice(mark)));
  assert.equal(bCss(), beforeMissing);
  await delay(500);
  put('src/_later.uxdsl', '.later { color: plum; }\n');
  await waitFor(() => bCss().includes('plum'));
});

// A file an entry starts loading is followed once that build succeeds. The
// watcher first sees such a file when it next reads the file's directory, and
// that is the directory of the file just saved when the two sit together: what
// it then reports is the file the build has just loaded, not a change, so the
// save builds the entry once and prints its warnings once. Whether or not the
// watcher reads that directory after the build, an event that finds the file as
// the build read it (here, its times written again as they were) builds nothing
// until the file changes.
test('MIG-B9-14: an entry that starts loading an existing file beside the file just saved builds once for that save and prints its warning once, and an event that finds that file unchanged builds nothing; an edit of that file then rebuilds the entry', async (t) => {
  const dir = mkProject();
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  put('uxdsl.config.cjs', `module.exports = { builds: [
    { entry: './src/a.uxdsl', outFile: './out/a.css', includeTheme: false },
    { entry: './src/b.uxdsl', outFile: './out/b.css', includeTheme: false },
  ] };\n`);
  put('src/a.uxdsl', '.a { color: red; }\n');
  put('src/b.uxdsl', '.b { color: blue; }\n');
  put('src/_x.scss', '.x { color: teal; }\n');
  put('src/_legacy.uxdsl', '.legacy { color: gray; }\n');
  // Files that existed well before the session, as a project's partials do.
  const past = (Date.now() - 10000) / 1000;
  for (const file of ['uxdsl.config.cjs', 'src/a.uxdsl', 'src/b.uxdsl', 'src/_x.scss', 'src/_legacy.uxdsl']) fs.utimesSync(path.join(dir, file), past, past);

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const bCss = () => fs.readFileSync(path.join(dir, 'out', 'b.css'), 'utf8');
  const buildsOfB = (text) => (text.match(/\[uxdsl\] (built|unchanged) out[\\/]b\.css/g) || []).length;
  await waitFor(() => /watching for changes/.test(output) && fs.existsSync(path.join(dir, 'out', 'b.css')));
  await delay(WATCHER_SETTLE_MS);

  // b starts loading src/_x.scss, which no watch pattern matches, beside b itself.
  let mark = output.length;
  put('src/b.uxdsl', "@use './x';\n@import './legacy';\n.b { color: blue; }\n");
  await waitFor(() => bCss().includes('teal'));
  await delay(WATCHER_SETTLE_MS * 2.5);
  const save = output.slice(mark);
  assert.equal(buildsOfB(save), 1, `one save, one build of b:\n${save}`);
  assert.equal(save.split('\n').filter((line) => line === '[uxdsl] Warning: src/b.uxdsl:2:9: UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.').length, 1, save);
  assert.doesNotMatch(save, /\[uxdsl\] add src[\\/]_x\.scss/, save);

  // An event that finds the file as that build read it builds nothing.
  mark = output.length;
  fs.utimesSync(path.join(dir, 'src', '_x.scss'), past, past);
  await delay(WATCHER_SETTLE_MS * 1.5);
  assert.doesNotMatch(output.slice(mark), /\[uxdsl\] (built|unchanged|change|add)\b/, output.slice(mark));

  // The file is followed: editing it rebuilds b, once, with the new content.
  mark = output.length;
  put('src/_x.scss', '.x { color: coral; }\n');
  await waitFor(() => bCss().includes('coral'));
  await delay(WATCHER_SETTLE_MS * 1.5);
  assert.equal(buildsOfB(output.slice(mark)), 1, output.slice(mark));
});

// The same holds for a save that rebuilds every entry, as the save of an entry
// whose first build failed does, since the session has no graph for it yet.
test('MIG-B9-14: an entry whose first build failed, saved so that it loads an existing file beside it, builds once for that save and prints its warning once, and an event that finds that file unchanged builds nothing; an edit of that file then rebuilds the entry', async (t) => {
  const dir = mkProject();
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  // No `watch` key: the patterns are the entry and src/**/*.uxdsl, which do not match src/_x.scss.
  put('uxdsl.config.cjs', "module.exports = { entry: './src/b.uxdsl', outFile: './out/b.css', includeTheme: false };\n");
  put('src/b.uxdsl', "@use './missing';\n.b { color: blue; }\n");
  put('src/_x.scss', '.x { color: teal; }\n');
  put('src/_legacy.uxdsl', '.legacy { color: gray; }\n');
  const past = (Date.now() - 10000) / 1000;
  for (const file of ['uxdsl.config.cjs', 'src/b.uxdsl', 'src/_x.scss', 'src/_legacy.uxdsl']) fs.utimesSync(path.join(dir, file), past, past);

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const cssPath = path.join(dir, 'out', 'b.css');
  const bCss = () => (fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '');
  const buildsOfB = (text) => (text.match(/\[uxdsl\] (built|unchanged) out[\\/]b\.css/g) || []).length;
  await waitFor(() => /watching for changes/.test(output) && /^\[uxdsl\] build failed: src\/b\.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import\.$/m.test(output));
  await delay(WATCHER_SETTLE_MS);

  // The save rebuilds every entry, and that build starts loading src/_x.scss.
  let mark = output.length;
  put('src/b.uxdsl', "@use './x';\n@import './legacy';\n.b { color: blue; }\n");
  await waitFor(() => bCss().includes('teal'));
  await delay(WATCHER_SETTLE_MS * 2.5);
  const save = output.slice(mark);
  assert.equal(buildsOfB(save), 1, `one save, one build of b:\n${save}`);
  assert.equal(save.split('\n').filter((line) => line === '[uxdsl] Warning: src/b.uxdsl:2:9: UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.').length, 1, save);
  assert.doesNotMatch(save, /\[uxdsl\] add src[\\/]_x\.scss/, save);

  // An event that finds the file as that build read it builds nothing.
  mark = output.length;
  fs.utimesSync(path.join(dir, 'src', '_x.scss'), past, past);
  await delay(WATCHER_SETTLE_MS * 1.5);
  assert.doesNotMatch(output.slice(mark), /\[uxdsl\] (built|unchanged|change|add)\b/, output.slice(mark));

  // The file is followed: editing it rebuilds b, once, with the new content.
  mark = output.length;
  put('src/_x.scss', '.x { color: coral; }\n');
  await waitFor(() => bCss().includes('coral'));
  await delay(WATCHER_SETTLE_MS * 1.5);
  assert.equal(buildsOfB(output.slice(mark)), 1, output.slice(mark));
});

// The files followed are every entry and the files the last successful build
// of each entry loaded: what a rebuild starts loading is followed from then
// on, and what it stops loading is not.
test('MIG-B9-14: a file an entry starts loading after start is followed once that rebuild succeeds, and is no longer followed once the entry stops loading it', async (t) => {
  const dir = mkProject();
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  // No `watch` key: the patterns are the entry and src/**/*.uxdsl, which do not reach lib/.
  put('uxdsl.config.cjs', "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css', includeTheme: false };\n");
  put('src/a.uxdsl', '.a { color: red; }\n');
  put('lib/_x.uxdsl', '.x { color: teal; }\n');
  const past = (Date.now() - 10000) / 1000;
  for (const file of ['uxdsl.config.cjs', 'src/a.uxdsl', 'lib/_x.uxdsl']) fs.utimesSync(path.join(dir, file), past, past);

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const aCss = () => fs.readFileSync(path.join(dir, 'out', 'a.css'), 'utf8');
  await waitFor(() => /watching for changes/.test(output) && fs.existsSync(path.join(dir, 'out', 'a.css')));
  await delay(WATCHER_SETTLE_MS);

  // a starts loading lib/_x.uxdsl: once that rebuild succeeds, an edit of it rebuilds a.
  put('src/a.uxdsl', "@use '../lib/x';\n.a { color: red; }\n");
  await waitFor(() => aCss().includes('teal'));
  await delay(WATCHER_SETTLE_MS);
  put('lib/_x.uxdsl', '.x { color: navy; }\n');
  await waitFor(() => aCss().includes('navy'));
  await delay(WATCHER_SETTLE_MS);

  // a stops loading it: an edit of it no longer rebuilds anything.
  put('src/a.uxdsl', '.a { color: red; }\n');
  await waitFor(() => !aCss().includes('navy'));
  await delay(WATCHER_SETTLE_MS);
  const mark = output.length;
  put('lib/_x.uxdsl', '.x { color: plum; }\n');
  await delay(WATCHER_SETTLE_MS * 1.5);
  assert.doesNotMatch(output.slice(mark), /\[uxdsl\] (built|unchanged|change|add)\b/, output.slice(mark));
});

// A config edit that moves an entry follows the moved entry before its first
// build, so a failure there recovers when the entry is saved, whatever the
// `watch` list matches; a file that recovering full rebuild loads is followed.
test('MIG-B9-14: an entry a config edit moves outside the watch patterns is followed before its first build: a failure there recovers when it is saved, and a file that full rebuild loads is followed', async (t) => {
  const dir = mkProject();
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  const config = (entry) => `module.exports = { entry: './src/${entry}.uxdsl', outFile: './out/${entry}.css', includeTheme: false, watch: ['styles/**'] };\n`;
  put('uxdsl.config.cjs', config('a'));
  put('styles/theme.uxdsl', '.t { color: red; }\n');
  put('src/a.uxdsl', '.a { color: red; }\n');
  put('src/c.uxdsl', "@use './missing';\n.c { color: green; }\n");
  put('lib/_y.uxdsl', '.y { color: teal; }\n');
  const past = (Date.now() - 10000) / 1000;
  for (const file of ['uxdsl.config.cjs', 'styles/theme.uxdsl', 'src/a.uxdsl', 'src/c.uxdsl', 'lib/_y.uxdsl']) fs.utimesSync(path.join(dir, file), past, past);

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const cCssPath = path.join(dir, 'out', 'c.css');
  const cCss = () => (fs.existsSync(cCssPath) ? fs.readFileSync(cCssPath, 'utf8') : '');
  await waitFor(() => /watching for changes/.test(output) && fs.existsSync(path.join(dir, 'out', 'a.css')));
  await delay(WATCHER_SETTLE_MS);

  // The entry moves to src/c.uxdsl, which `watch: ['styles/**']` does not
  // match, and its first build fails; the list is unchanged, so the watcher is
  // the same one.
  put('uxdsl.config.cjs', config('c'));
  await waitFor(() => /^\[uxdsl\] build failed: src\/c\.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import\.$/m.test(output));
  await delay(WATCHER_SETTLE_MS);

  // Saving it recovers; that full rebuild loads lib/_y.uxdsl, and an edit of it rebuilds c.
  put('src/c.uxdsl', "@use '../lib/y';\n.c { color: green; }\n");
  await waitFor(() => cCss().includes('teal'));
  await delay(WATCHER_SETTLE_MS);
  put('lib/_y.uxdsl', '.y { color: navy; }\n');
  await waitFor(() => cCss().includes('navy'));
});

test('MIG-B9-14: an entry the watch patterns do not match is still followed: a failed first build recovers when the entry is saved', async (t) => {
  const dir = mkProject();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'styles', 'theme.uxdsl'), '.t { color: red; }\n');
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css', includeTheme: false, watch: ['styles/**'] };\n");
  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), "@use './missing';\n.a { color: red; }\n");

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  await waitFor(() => /watching for changes/.test(output) && /build failed:/.test(output));
  await delay(WATCHER_SETTLE_MS);

  fs.writeFileSync(path.join(dir, 'src', 'a.uxdsl'), '.a { color: red; }\n');
  await waitFor(() => /\[uxdsl\] built out[\\/]a\.css/.test(output));
  await delay(WATCHER_SETTLE_MS);

  // Negative control: a .uxdsl file beside the entry that no entry loads is not followed.
  const mark = output.length;
  fs.writeFileSync(path.join(dir, 'src', 'other.uxdsl'), '.other { color: blue; }\n');
  await delay(WATCHER_SETTLE_MS * 1.5);
  assert.doesNotMatch(output.slice(mark), /\[uxdsl\] (built|unchanged|change|add)\b/, output.slice(mark));
});

// A followed file's directory that is deleted is watched for again, from the
// nearest directory above it that still exists: the build fails and keeps the
// last good CSS, restoring the file rebuilds the entries that load it, and
// every later edit of it rebuilds them again.
test('MIG-B9-14: a deleted directory of followed files outside the watch patterns is followed again once restored, one level below the project or two: restoring the file rebuilds its entry, and every later edit does too', async (t) => {
  const dir = mkProject();
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  // No `watch` key: the patterns are the entries and src/**/*.uxdsl, which reach neither shared/ nor lib/.
  put('uxdsl.config.cjs', `module.exports = { builds: [
    { entry: './src/a.uxdsl', outFile: './out/a.css', includeTheme: false },
    { entry: './src/b.uxdsl', outFile: './out/b.css', includeTheme: false },
  ] };\n`);
  put('src/a.uxdsl', "@use '../shared/far';\n.a { color: red; }\n");
  put('src/b.uxdsl', "@use '../lib/deep/x';\n.b { color: blue; }\n");
  put('shared/_far.uxdsl', '.far { color: teal; }\n');
  put('shared/notes.txt', 'notes\n');
  put('lib/deep/_x.uxdsl', '.x { color: teal; }\n');

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const css = (name) => {
    const file = path.join(dir, 'out', `${name}.css`);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  };
  await waitFor(() => /watching for changes/.test(output) && css('a') && css('b'));
  await delay(WATCHER_SETTLE_MS);

  // shared/ goes: a fails and keeps its CSS; restoring the file rebuilds a, and
  // so does each later edit.
  let mark = output.length;
  fs.rmSync(path.join(dir, 'shared'), { recursive: true, force: true });
  await waitFor(() => /^\[uxdsl\] build failed: builds\[0\] \(out[\\/]a\.css\): src\/a\.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import\.$/m.test(output.slice(mark)));
  assert.match(css('a'), /teal/, 'the last good output stays');
  await delay(WATCHER_SETTLE_MS);
  put('shared/_far.uxdsl', '.far { color: lime; }\n');
  await waitFor(() => css('a').includes('lime'));
  for (const color of ['coral', 'plum']) {
    await delay(WATCHER_SETTLE_MS);
    put('shared/_far.uxdsl', `.far { color: ${color}; }\n`);
    await waitFor(() => css('a').includes(color));
  }

  // Negative control: the restored directory's other files are not followed.
  await delay(WATCHER_SETTLE_MS);
  mark = output.length;
  put('shared/notes.txt', 'edited\n');
  await delay(WATCHER_SETTLE_MS * 1.5);
  assert.doesNotMatch(output.slice(mark), /\[uxdsl\] (built|unchanged|change|add)\b/, output.slice(mark));

  // lib/ goes, two levels above the followed lib/deep/: restoring the file
  // rebuilds b, and so does a later edit.
  mark = output.length;
  fs.rmSync(path.join(dir, 'lib'), { recursive: true, force: true });
  await waitFor(() => /^\[uxdsl\] build failed: builds\[1\] \(out[\\/]b\.css\): src\/b\.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import\.$/m.test(output.slice(mark)));
  await delay(WATCHER_SETTLE_MS);
  put('lib/deep/_x.uxdsl', '.x { color: lime; }\n');
  await waitFor(() => css('b').includes('lime'));
  await delay(WATCHER_SETTLE_MS);
  put('lib/deep/_x.uxdsl', '.x { color: coral; }\n');
  await waitFor(() => css('b').includes('coral'));
});

test('MIG-B9-14: an entry outside the watch patterns whose directory is deleted is followed again once restored: restoring it rebuilds it, and a later edit does too', async (t) => {
  const dir = mkProject();
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  put('uxdsl.config.cjs', "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css', includeTheme: false, watch: ['styles/**'] };\n");
  put('styles/theme.uxdsl', '.t { color: red; }\n');
  put('src/a.uxdsl', '.a { color: red; }\n');

  const child = spawn(process.execPath, [CLI_BIN, 'build', '--watch'], { cwd: dir, stdio: 'pipe' });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const cssPath = path.join(dir, 'out', 'a.css');
  const css = () => (fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '');
  await waitFor(() => /watching for changes/.test(output) && css());
  await delay(WATCHER_SETTLE_MS);

  const mark = output.length;
  fs.rmSync(path.join(dir, 'src'), { recursive: true, force: true });
  await waitFor(() => /^\[uxdsl\] build failed: Entry file not found: src[\\/]a\.uxdsl\./m.test(output.slice(mark)));
  assert.match(css(), /color: red/, 'the last good output stays');
  await delay(WATCHER_SETTLE_MS);
  put('src/a.uxdsl', '.a { color: navy; }\n');
  await waitFor(() => css().includes('navy'));
  await delay(WATCHER_SETTLE_MS);
  put('src/a.uxdsl', '.a { color: maroon; }\n');
  await waitFor(() => css().includes('maroon'));
});
