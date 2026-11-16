'use strict';

// How the Sass stage (src/sass/compile-sass.ts) spells, on win32, the paths
// only Windows has, and the final map compile() writes there:
// - a component written as an 8.3 short name keeps that spelling, since no
//   entry of its directory equals it under toLowerCase(), while
//   fs.realpathSync.native spells it long;
// - fs.lstatSync reports a junction as a symbolic link, so a junction keeps
//   its own name and only the directory that holds it is listed;
// - in a directory whose ACL denies listing, fs.accessSync(R_OK) still
//   succeeds (Node does not read ACLs there), so a name written in another
//   case takes its on-disk case, where macOS keeps the written one;
// - the stage names its files with a drive letter, and the final map keeps
//   every author mapping when `to` is in another directory.
// Off win32 each test is skipped with its reason; on win32 each fails, never
// skips, when its precondition cannot be set up. Each test removes what it
// creates, the ACL it adds first.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const postcss = require('postcss');
const { SourceMapConsumer } = require('source-map-js');

const PACKAGE = path.resolve(__dirname, '../..');
const { compileSassStage } = require(path.join(PACKAGE, 'dist/sass/compile-sass.js'));
const { compile } = require(path.join(PACKAGE, 'dist/entries/index.js'));
const { resolveTheme } = require(path.join(PACKAGE, 'dist/entries/theme.js'));
const exported = require(path.join(PACKAGE, 'dist/plugin'));
const plugin = exported.default || exported;

const RESERVED = Object.keys(resolveTheme().breakpoints);
const ONLY_WIN32 = process.platform === 'win32' ? false : 'the Windows paths this checks exist only on win32';

const stage = (entry, sourceMap = false) => compileSassStage({ entry }, { reserved: RESERVED, sourceMap });
const dependencies = async (entry) => (await compile({ entry })).dependencies;
const under = (dir, files) => files.map((file) => path.join(dir, file));

/** Makes a directory in os.tmpdir(), named as mkdtemp returns it, and removes it after the test. */
function scratch(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }));
  return dir;
}

/** Writes `files` ({ relativePath: text }) under `dir`. */
function write(dir, files) {
  for (const [file, text] of Object.entries(files)) {
    const abs = path.join(dir, file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}

/** Runs `fn` with every fs.readdirSync and fs.opendirSync recorded: its result and the directories listed, in order. */
function listing(fn) {
  const listed = [];
  const { readdirSync, opendirSync } = fs;
  fs.readdirSync = function recordedReaddir(dir, ...rest) {
    listed.push(path.resolve(String(dir)));
    return readdirSync.call(this, dir, ...rest);
  };
  fs.opendirSync = function recordedOpendir(dir, ...rest) {
    listed.push(path.resolve(String(dir)));
    return opendirSync.call(this, dir, ...rest);
  };
  try {
    return { result: fn(), listed };
  } finally {
    fs.readdirSync = readdirSync;
    fs.opendirSync = opendirSync;
  }
}

/** The 8.3 short form cmd.exe gives for `dir` (%~sI), the path as given when the volume makes none. */
function shortForm(dir) {
  const run = spawnSync('cmd', ['/d', '/c', `for %I in ("${dir}") do @echo %~sI`], { encoding: 'utf8', windowsVerbatimArguments: true });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

/**
 * A directory that exists, written with a component in its 8.3 short form:
 * os.tmpdir() when fs.realpathSync.native changes one of its components, else
 * the short form of a long-named directory made in it.
 */
function shortNamed(t) {
  const given = scratch(t, 'uxdsl-stage-win32-');
  if (fs.realpathSync.native(given) !== given) return given;
  const long = path.join(given, 'a-directory-with-a-long-name');
  fs.mkdirSync(long);
  const short = shortForm(long);
  assert.notEqual(short.toLowerCase(), long.toLowerCase(), `volume ${path.parse(long).root} makes no 8.3 short name: neither os.tmpdir() (${os.tmpdir()}) nor ${long} has one`);
  return short;
}

test('MIG-B9-28: on win32 a path component written as an 8.3 short name keeps that spelling in loadedFiles and compile()\'s dependencies, as its directory lists it', { skip: ONLY_WIN32 }, async (t) => {
  const dir = shortNamed(t);
  write(dir, { 'entry.uxdsl': '@use "part";\n.e { a: b; }\n', '_part.uxdsl': '.p { a: b; }\n' });
  const short = dir.split(path.sep).filter((component) => /~\d/.test(component));
  assert.ok(short.length > 0, `${dir} has a component in 8.3 form`);
  const real = fs.realpathSync.native(dir);
  assert.notEqual(real.toLowerCase(), dir.toLowerCase(), 'fs.realpathSync.native spells the short component in its long form, so a spelling taken from the real path would differ');
  for (const component of short) assert.equal(real.split(path.sep).includes(component), false, `the real path ${real} has no ${component}`);
  const written = under(dir, ['entry.uxdsl', '_part.uxdsl']);
  assert.deepEqual(stage(path.join(dir, 'entry.uxdsl')).loadedFiles, written, 'the short name as written');
  assert.deepEqual(await dependencies(path.join(dir, 'entry.uxdsl')), written);
});

test('MIG-B9-28: on win32 lstat reports a junction as a symbolic link, so the Sass stage keeps the junction\'s own name and lists only the directory that holds it', { skip: ONLY_WIN32 }, (t) => {
  const dir = fs.realpathSync.native(scratch(t, 'uxdsl-stage-junction-'));
  write(dir, { 'target/entry.uxdsl': '@use "PART";\n', 'target/_part.uxdsl': '.p { a: b; }\n' });
  const junction = path.join(dir, 'Link');
  fs.symlinkSync(path.join(dir, 'target'), junction, 'junction');
  assert.equal(fs.lstatSync(junction).isSymbolicLink(), true, 'lstat reports the junction as a symbolic link');
  assert.equal(fs.realpathSync.native(junction), path.join(dir, 'target'), 'the junction resolves to its target');
  const { result, listed } = listing(() => stage(path.join(dir, 'LINK/ENTRY.UXDSL')));
  assert.deepEqual(result.loadedFiles, under(dir, ['Link/entry.uxdsl', 'Link/_part.uxdsl']), 'the junction kept, in its own name; the files in their on-disk case');
  assert.ok(listed.length > 0, 'the recorder sees the listing that spells the junction\'s name');
  assert.deepEqual([...new Set(listed)], [dir], 'only the directory that holds the junction is listed');
});

test('MIG-B9-28: on win32 a name written in another case in a directory whose ACL denies listing takes its on-disk case, unlike macOS\'s written case (decision 2 of 2026-11-09 narrowed to macOS)', { skip: ONLY_WIN32 }, async (t) => {
  const dir = fs.realpathSync.native(scratch(t, 'uxdsl-stage-acl-'));
  write(dir, { 'entry.uxdsl': '@use "locked/PART";\n', 'locked/_part.uxdsl': '.p { a: b; }\n' });
  const locked = path.join(dir, 'locked');
  const user = process.env.USERNAME;
  assert.ok(user, 'USERNAME names the user the ACL denies');
  const icacls = (...args) => {
    const run = spawnSync('icacls', [locked, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 0, `icacls ${args.join(' ')}: ${run.stdout}${run.stderr}`);
  };
  icacls('/deny', `${user}:(RD)`);
  t.after(() => icacls('/remove:d', user));
  assert.throws(() => fs.readdirSync(locked), { code: 'EPERM' }, 'the ACL denies listing the directory');
  assert.equal(fs.realpathSync.native(path.join(locked, '_PART.uxdsl')), path.join(locked, '_part.uxdsl'), 'the real path still names the file as stored');
  let accessible = true;
  try {
    fs.accessSync(locked, fs.constants.R_OK);
  } catch {
    accessible = false;
  }
  assert.equal(accessible, true, 'fs.accessSync(R_OK) succeeds on a directory whose ACL denies listing: Node does not read the ACL');
  const onDisk = under(dir, ['entry.uxdsl', 'locked/_part.uxdsl']);
  assert.deepEqual(stage(path.join(dir, 'entry.uxdsl')).loadedFiles, onDisk, 'the on-disk case, read from the real path');
  assert.deepEqual(await dependencies(path.join(dir, 'entry.uxdsl')), onDisk);
});

test('MIG-B9-28: on win32 the final map keeps every author mapping when to is in another directory, the Sass stage naming its files with a drive letter (MIG-B9-13\'s LM-3, observed)', { skip: ONLY_WIN32 }, async (t) => {
  const dir = fs.realpathSync.native(scratch(t, 'uxdsl-stage-map-'));
  const files = {
    'src/entry.uxdsl': '@use "parts/mixins" as m;\n.card {\n  @include m.pad;\n  .title { color: palette(primary.main); }\n}\n',
    'src/parts/_mixins.uxdsl': '@mixin pad {\n  padding: space(2);\n  margin: space(1);\n}\n',
  };
  write(dir, files);
  const entry = path.join(dir, 'src/entry.uxdsl');
  const to = path.join(dir, 'out/css/entry.css');
  const texts = new Map(Object.entries(files).map(([file, text]) => [text, file]));

  const result = await compile({ entry }, { sourceMap: 'external', to });
  const final = new SourceMapConsumer(JSON.parse(result.map));
  const authored = [];
  final.eachMapping((mapping) => {
    const file = texts.get(final.sourceContentFor(mapping.source, true));
    if (file) authored.push(`${mapping.generatedLine}:${mapping.generatedColumn} ${file}:${mapping.originalLine}:${mapping.originalColumn}`);
  });
  assert.ok(authored.some((line) => line.includes(' src/entry.uxdsl:')) && authored.some((line) => line.includes(' src/parts/_mixins.uxdsl:')), `the final map maps both author files:\n${authored.join('\n')}`);

  const { css, map } = stage(entry, true);
  assert.ok(map.sources.length >= 2 && map.sources.every((source) => /^[A-Z]:\\/.test(source)), `the stage names its files with a drive letter: ${map.sources}`);
  // Mapped as compile() maps them: the plugin rewrites the stage's CSS, and a
  // mapping of PostCSS's map counts for the author when its source is one of
  // the map PostCSS was handed.
  const kept = async (prev) => {
    const out = await postcss([plugin({ discoverTheme: false })]).process(css, { from: entry, to, map: { prev, inline: false, annotation: false } });
    const handed = new Set(new SourceMapConsumer(prev).sources);
    let count = 0;
    new SourceMapConsumer(out.map.toJSON()).eachMapping((mapping) => {
      if (handed.has(mapping.source)) count += 1;
    });
    return count;
  };
  const chained = await kept({ ...map, sources: map.sources.map((source) => `/${source.replace(/\\/g, '/')}`) });
  assert.ok(chained > 0, 'written from /, the stage map\'s sources keep their mappings');
  assert.equal(authored.length, chained, `compile()'s final map keeps every author mapping:\n${authored.join('\n')}`);
  assert.equal(await kept(map), 0, 'negative control: handed as the stage wrote it, PostCSS joins each source onto a directory and no author mapping is kept');
});
