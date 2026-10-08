'use strict';

// chokidar 4 has no globs (and no `braces` in its tree): the CLI splits its
// watch list into paths to watch and a picomatch selection of events
// (`watchSelection` in bin/uxdsl.js). These pin that the patterns of
// `uxdsl.config.*` (`watch: ['src/**/*.uxdsl', …]`) select exactly what
// chokidar 3 selected with them — picomatch with `dot: true` — and what is
// and is not traversed. watch-mode.test.js drives the whole `build --watch`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cli = require('../../bin/uxdsl.js');

const ROOT = path.resolve('/project');
const p = (...parts) => path.join(ROOT, ...parts);
const DIR = { isDirectory: () => true };
const FILE = { isDirectory: () => false };

test('a glob watches its base directory and selects the paths it matches, dot-directories included', () => {
  const s = cli.watchSelection([p('src/**/*.uxdsl'), p('src/**/*.css')]);
  assert.deepEqual(s.roots, [p('src')]);
  for (const file of ['src/a.uxdsl', 'src/x/y/b.uxdsl', 'src/.hidden/c.uxdsl', 'src/uxdsl.css']) assert.equal(s.selects(p(file)), true, file);
  for (const file of ['src/a.txt', 'src', 'src/x', 'other/a.uxdsl', 'a.uxdsl']) assert.equal(s.selects(p(file)), false, file);
});

test('a path is watched as written: a parenthesis is a path character (Next.js route groups), not a glob', () => {
  const page = p('app/(marketing)/page.uxdsl');
  const s = cli.watchSelection([page, p('styles/file (1).uxdsl')]);
  assert.deepEqual(s.roots, [page, p('styles/file (1).uxdsl')]);
  assert.equal(s.selects(page), true);
  assert.equal(s.selects(p('app/marketing/page.uxdsl')), false);
});

test('a directory given as a path selects everything inside it, recursively', () => {
  const s = cli.watchSelection([p('tokens')]);
  assert.equal(s.selects(p('tokens/a.json')), true);
  assert.equal(s.selects(p('tokens/deep/b.css')), true);
  assert.equal(s.selects(p('tokens-old/a.json')), false);
});

test('traversal: a directory no glob can reach below is not watched; `**` reaches every depth', () => {
  const shallow = cli.watchSelection([p('src/*.uxdsl'), p('src/*/theme.css')]);
  assert.equal(shallow.ignored(p('src'), DIR), false);
  assert.equal(shallow.ignored(p('src/components'), DIR), false, 'src/*/theme.css reaches one level down');
  assert.equal(shallow.ignored(p('src/components/deep'), DIR), true);
  const deep = cli.watchSelection([p('src/**/*.uxdsl')]);
  assert.equal(deep.ignored(p('src/a/b/c/d'), DIR), false);
  assert.equal(deep.ignored(p('src/a/b/c/d/x.txt'), FILE), true, 'a file no glob matches is not watched');
  assert.equal(deep.ignored(p('src/a/b/c/d/x.uxdsl'), FILE), false);
  assert.equal(deep.ignored(p('src/a/b/c/d/x.txt')), false, 'without stats nothing is ignored; chokidar asks again with them');
});

test('traversal: a brace or extglob spanning segments never prunes, and paths keep their ancestors', () => {
  const s = cli.watchSelection([p('src/{a/b,c}/*.uxdsl'), p('cfg/uxdsl.config.cjs')]);
  assert.equal(s.ignored(p('src/zzz/deeper'), DIR), false);
  // A path that does not exist yet is watched through its parent directory.
  assert.equal(s.ignored(p('cfg'), DIR), false);
  assert.equal(s.ignored(ROOT, DIR), false);
  assert.equal(s.selects(p('src/a/b/x.uxdsl')), true);
  assert.equal(s.selects(p('src/c/x.uxdsl')), true);
});

test('createWatcher reports matching files only, and follows a glob whose base directory appears later', async (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-watch-selection-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/a.uxdsl'), '.a {}');
  const watcher = cli.createWatcher([path.join(dir, 'src/**/*.uxdsl'), path.join(dir, 'styles/**/*.uxdsl')]);
  t.after(() => watcher.close());
  const events = [];
  watcher.on('all', (event, file) => events.push(`${event} ${path.relative(dir, file)}`));
  await new Promise((resolve) => watcher.once('ready', resolve));
  await delay(300);
  fs.writeFileSync(path.join(dir, 'src/note.txt'), 'x');
  fs.writeFileSync(path.join(dir, 'src/a.uxdsl'), '.b {}');
  await waitFor(() => events.includes('change src/a.uxdsl'));
  fs.mkdirSync(path.join(dir, 'styles'));
  await delay(300);
  fs.writeFileSync(path.join(dir, 'styles/s.uxdsl'), '.s {}');
  await waitFor(() => events.includes(`add ${path.join('styles', 's.uxdsl')}`));
  await delay(300);
  assert.deepEqual(events.filter((e) => /note\.txt|addDir|unlinkDir/.test(e)), [], events.join('\n'));
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, timeout = 10000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await delay(50);
  }
}
