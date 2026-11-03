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

// A followed file (an entry, or a file Sass loaded) is watched through its
// directory, added to the running watcher in place: chokidar keeps reporting a
// directory's file after it is deleted and created again, where it stops for a
// file watched as its own root.
test('MIG-B9-14: a followed file outside every watched root is reported through its directory: change, unlink, add, change; its siblings are not, and a file no longer followed stops being reported', async (t) => {
  const s = cli.watchSelection([p('src/**/*.uxdsl')]);
  const far = p('shared/_far.scss');
  assert.deepEqual(s.follow([far, p('src/a.uxdsl')]), [p('shared'), p('src')], 'the directories of the newly followed files');
  assert.deepEqual(s.follow([far, p('src/a.uxdsl')]), [], 'nothing new to add');
  assert.equal(s.selects(far), true);
  assert.equal(s.selects(p('shared/notes.txt')), false);
  assert.equal(s.ignored(far, FILE), false);
  assert.equal(s.ignored(p('shared'), DIR), false);
  assert.equal(s.ignored(p('shared/notes.txt'), FILE), true, 'a sibling of a followed file is not watched');
  assert.equal(s.ignored(p('shared/deep'), DIR), true, 'nor is a directory below it that no pattern reaches');
  assert.deepEqual(s.follow([p('src/a.uxdsl')]), []);
  assert.equal(s.selects(far), false, 'a file no longer followed is no longer selected');
  assert.equal(s.ignored(far, FILE), true);

  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-watch-follow-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/a.uxdsl'), '.a {}');
  fs.mkdirSync(path.join(dir, 'shared/deep'), { recursive: true });
  const farFile = path.join(dir, 'shared/_far.scss');
  fs.writeFileSync(farFile, '.far {}');
  fs.writeFileSync(path.join(dir, 'shared/notes.txt'), 'x');
  fs.writeFileSync(path.join(dir, 'shared/deep/x.scss'), '.x {}');
  const watcher = cli.createWatcher([path.join(dir, 'src/**/*.uxdsl')]);
  t.after(() => watcher.close());
  const events = [];
  watcher.on('all', (event, file) => events.push(`${event} ${path.relative(dir, file)}`));
  await new Promise((resolve) => watcher.once('ready', resolve));
  watcher.follow([farFile]);
  await delay(300);
  const farRel = path.join('shared', '_far.scss');
  fs.writeFileSync(farFile, '.far { color: red; }');
  await waitFor(() => events.includes(`change ${farRel}`));
  fs.unlinkSync(farFile);
  await waitFor(() => events.includes(`unlink ${farRel}`));
  await delay(300);
  fs.writeFileSync(farFile, '.far {}');
  await waitFor(() => events.includes(`add ${farRel}`));
  await delay(300);
  const changes = () => events.filter((e) => e === `change ${farRel}`).length;
  fs.writeFileSync(farFile, '.far { color: blue; }');
  await waitFor(() => changes() === 2);

  // Negative control: the followed file's siblings, a directory below it, and
  // the file itself once it is no longer followed, report nothing. A file the
  // patterns select is still reported meanwhile; only shared/ is counted, so
  // its events (a late one for a write made before the watcher started
  // included) are no part of the control.
  fs.writeFileSync(path.join(dir, 'shared/notes.txt'), 'y');
  fs.writeFileSync(path.join(dir, 'shared/deep/x.scss'), '.x { color: red; }');
  watcher.follow([]);
  await delay(300);
  fs.writeFileSync(farFile, '.far { color: green; }');
  fs.writeFileSync(path.join(dir, 'src/a.uxdsl'), '.a { color: red; }');
  await waitFor(() => events.includes(`change ${path.join('src', 'a.uxdsl')}`));
  await delay(1000);
  const inShared = events.filter((e) => e.slice(e.indexOf(' ') + 1).startsWith(`shared${path.sep}`));
  assert.deepEqual(inShared.filter((e) => !e.endsWith(farRel)), [], events.join('\n'));
  assert.equal(changes(), 2, events.join('\n'));
});

// A file followed after the build that loaded it keeps its stats, so that the
// `add` chokidar reports when it first reads such a file (an event that finds
// the stats unchanged) is dropped; watch-mode.test.js drives that end to end.
// Only a file the watch list did not select, last modified before the build
// started by more than the file system's time resolution, keeps them: one
// modified during the build is reported, whatever its stats.
test('MIG-B9-14: a file followed after the build that loaded it keeps its stats only when the watch list did not select it and it was last modified before that build started, by more than the time resolution', async (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-watch-kept-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'src'));
  const names = ['a.uxdsl', '_old.uxdsl', '_old.scss', '_recent.scss', '_whole.scss', '_fraction.scss'];
  const file = (name) => path.join(dir, 'src', name);
  for (const name of names) fs.writeFileSync(file(name), '.x {}');
  const startedAt = Date.now();
  const setTime = (name, ms) => fs.utimesSync(file(name), ms / 1000, ms / 1000);
  setTime('_old.uxdsl', startedAt - 10000);
  setTime('_old.scss', startedAt - 10000);
  setTime('_recent.scss', startedAt - 50.5);
  // Less than two seconds back, in whole seconds: a file system that keeps
  // seconds may have rounded down a write made after the build started.
  setTime('_whole.scss', Math.ceil((startedAt - 1900) / 1000) * 1000);
  // As far back, with a fraction of a millisecond: a file system with finer times.
  setTime('_fraction.scss', startedAt - 1500.5);
  const watcher = cli.createWatcher([path.join(dir, 'src/**/*.uxdsl')]);
  t.after(() => watcher.close());
  await new Promise((resolve) => watcher.once('ready', resolve));
  assert.deepEqual(watcher.follow(names.map(file), startedAt), [file('_old.scss'), file('_fraction.scss')]);
  // Without a build's start (the follow at start, and before a full build), none keeps them.
  watcher.follow([]);
  assert.deepEqual(watcher.follow(names.map(file)), []);
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, timeout = 10000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await delay(50);
  }
}
