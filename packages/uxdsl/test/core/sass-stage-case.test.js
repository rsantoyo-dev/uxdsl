'use strict';

// How the Sass stage (src/sass/compile-sass.ts) spells the files it loads where
// the filesystem folds case (darwin, win32): each component in its on-disk
// case, read from the file's real path, so no directory is listed for it; a
// symlink kept in its own name, the one directory listed being the one that
// holds the symlink; the name as written where the real path's name differs
// under toLowerCase() (a name stored in NFD and written in NFC) or where its
// directory cannot be listed; and nothing kept from one call to the next.
// compileSassStage's loadedFiles and compile()'s dependencies carry the same
// spelling. Each test removes every directory it creates, symlinks and renamed
// files included.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE = path.resolve(__dirname, '../..');
const { compileSassStage } = require(path.join(PACKAGE, 'dist/sass/compile-sass.js'));
const { compile } = require(path.join(PACKAGE, 'dist/entries/index.js'));
const { resolveTheme } = require(path.join(PACKAGE, 'dist/entries/theme.js'));

/** The effective theme's breakpoint names, which the stage checks a project @function against. */
const RESERVED = Object.keys(resolveTheme().breakpoints);
const SKIP = process.platform === 'darwin' || process.platform === 'win32'
  ? false
  : 'the Sass stage reads a path\'s on-disk spelling only where the filesystem folds case (darwin, win32); elsewhere it keeps the path as written';
const NO_LISTING_DENIAL = process.platform === 'win32'
  ? 'file permissions do not deny listing a directory on win32'
  : process.getuid && process.getuid() === 0 ? 'running as root, which lists a directory whatever its mode' : false;

/**
 * Writes `files` ({ relativePath: text }) and `links` ({ link: target }, both
 * relative; a junction on win32) into a fresh directory, named by its real path
 * in on-disk case, and removes it after the test.
 */
function project(t, files, links = {}) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-stage-case-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    const abs = path.join(dir, file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  for (const [link, target] of Object.entries(links)) {
    fs.mkdirSync(path.dirname(path.join(dir, link)), { recursive: true });
    fs.symlinkSync(path.join(dir, target), path.join(dir, link), 'junction');
  }
  return dir;
}

const stage = (entry) => compileSassStage({ entry }, { reserved: RESERVED, sourceMap: false });
const dependencies = async (entry) => (await compile({ entry }, { includeTheme: false })).dependencies;
const under = (dir, files) => files.map((file) => path.join(dir, file));

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

const NESTED = {
  'src/Entry.uxdsl': '@use "PARTS/A";\n@use "parts/DEEP/b";\n.e { p: space(2); }\n',
  'src/parts/_a.uxdsl': '.a { b: c; }\n',
  'src/parts/deep/_b.uxdsl': '.b { c: d; }\n',
};

test('MIG-B9-23: on darwin and win32 the Sass stage lists no directory to spell a path component that is not a symlink', { skip: SKIP }, (t) => {
  const dir = project(t, NESTED);
  for (let up = dir; ; up = path.dirname(up)) {
    assert.equal(fs.lstatSync(up).isSymbolicLink(), false, `${up} is not a symlink, so no component of the project's paths is one`);
    if (path.dirname(up) === up) break;
  }
  const { result, listed } = listing(() => stage(path.join(dir, 'SRC/ENTRY.UXDSL')));
  assert.deepEqual(result.loadedFiles, under(dir, ['src/Entry.uxdsl', 'src/parts/_a.uxdsl', 'src/parts/deep/_b.uxdsl']), 'every file in its on-disk case');
  assert.deepEqual(listed, [], 'no directory listed');
});

test('MIG-B9-23: on darwin and win32 the Sass stage lists no directory to spell a path component that is not a symlink (negative control: through a symlinked directory, the directory that holds the symlink is listed)', { skip: SKIP }, (t) => {
  const dir = project(t, NESTED, { link: 'src' });
  const { result, listed } = listing(() => stage(path.join(dir, 'LINK/ENTRY.UXDSL')));
  assert.deepEqual(result.loadedFiles, under(dir, ['link/Entry.uxdsl', 'link/parts/_a.uxdsl', 'link/parts/deep/_b.uxdsl']), 'the symlink kept, in its own name');
  assert.ok(listed.length > 0, 'the recorder sees the listing that spells the symlink\'s name');
  assert.deepEqual([...new Set(listed)], [dir], 'only the directory that holds the symlink is listed');
});

test('MIG-B9-23: the Sass stage spells a file as the disk does in each call, in compileSassStage\'s loadedFiles and compile()\'s dependencies: an entry written in three cases, a symlinked ancestor, a case-only rename between two calls', { skip: SKIP }, async (t) => {
  const dir = project(t, {
    'Entry.uxdsl': '@use "Part";\n',
    '_part.uxdsl': '.p { a: b; }\n',
    'real/entry.uxdsl': '@use "PART";\n',
    'real/_part.uxdsl': '.r { a: b; }\n',
    'outside.uxdsl': '@use "LINKS/LINK/part";\n',
    'targets/t/entry.uxdsl': '@use "PART";\n',
    'targets/t/_part.uxdsl': '.t { a: b; }\n',
  }, { alias: 'real', 'links/Link': 'targets/t' });
  const onDisk = under(dir, ['Entry.uxdsl', '_part.uxdsl']);
  for (const written of ['Entry.uxdsl', 'entry.uxdsl', 'ENTRY.UXDSL']) {
    assert.deepEqual(stage(path.join(dir, written)).loadedFiles, onDisk, `the entry written ${written}`);
    assert.deepEqual(await dependencies(path.join(dir, written)), onDisk, `the entry written ${written}, through compile()`);
  }
  const throughLink = under(dir, ['alias/entry.uxdsl', 'alias/_part.uxdsl']);
  assert.deepEqual(stage(path.join(dir, 'ALIAS/entry.uxdsl')).loadedFiles, throughLink, 'the symlinked ancestor kept, in its own name');
  assert.deepEqual(await dependencies(path.join(dir, 'ALIAS/entry.uxdsl')), throughLink);
  // A symlink whose target is in another directory: the directory that holds the
  // link is spelled from its own real path, never from the target's directory.
  const throughOtherDir = under(dir, ['links/Link/entry.uxdsl', 'links/Link/_part.uxdsl']);
  assert.deepEqual(stage(path.join(dir, 'LINKS/Link/entry.uxdsl')).loadedFiles, throughOtherDir, 'the link\'s directory in its on-disk case, the target\'s names nowhere');
  assert.deepEqual(await dependencies(path.join(dir, 'LINKS/Link/entry.uxdsl')), throughOtherDir);
  const fromOutside = under(dir, ['outside.uxdsl', 'links/Link/_part.uxdsl']);
  assert.deepEqual(stage(path.join(dir, 'outside.uxdsl')).loadedFiles, fromOutside, '@use "LINKS/LINK/part" from outside the link');
  assert.deepEqual(await dependencies(path.join(dir, 'outside.uxdsl')), fromOutside);
  const before = stage(path.join(dir, 'entry.uxdsl')).loadedFiles;
  fs.renameSync(path.join(dir, '_part.uxdsl'), path.join(dir, '_PART.uxdsl'));
  const after = stage(path.join(dir, 'entry.uxdsl')).loadedFiles;
  assert.deepEqual(after, under(dir, ['Entry.uxdsl', '_PART.uxdsl']), 'the second call spells the file as the disk now does');
  assert.notDeepEqual(after, before, 'negative control: a spelling kept from the first call would repeat it');
  assert.deepEqual(await dependencies(path.join(dir, 'entry.uxdsl')), after);
});

test('MIG-B9-23: where Dart Sass spells a file differently, the Sass stage keeps BASE\'s spelling (RES-4), in loadedFiles and compile()\'s dependencies: a file stored in NFD and written in NFC keeps the written name, a symlinked directory written in another case keeps the link\'s own name', { skip: SKIP }, async (t) => {
  if (process.platform === 'darwin') {
    const nfc = '_café.uxdsl';
    const nfd = '_café.uxdsl';
    const dir = project(t, { 'entry.uxdsl': '@use "café";\n', [nfd]: '.cafe { a: b; }\n' });
    assert.equal(path.basename(fs.realpathSync.native(path.join(dir, nfc))), nfd, 'the real path names the file as stored, in NFD: a spelling taken from it unconditionally would be NFD');
    const written = under(dir, ['entry.uxdsl', nfc]);
    assert.deepEqual(stage(path.join(dir, 'entry.uxdsl')).loadedFiles, written, 'the NFC name as written');
    assert.deepEqual(await dependencies(path.join(dir, 'entry.uxdsl')), written);
  } else {
    t.diagnostic('the NFD half runs on darwin only: NTFS does not take a name in NFC and in NFD for one file');
  }
  const dir = project(t, { 'entry.uxdsl': '@use "LINK/part";\n', 'target/_part.uxdsl': '.p { a: b; }\n' }, { Link: 'target' });
  const linked = under(dir, ['entry.uxdsl', 'Link/_part.uxdsl']);
  assert.deepEqual(stage(path.join(dir, 'entry.uxdsl')).loadedFiles, linked, 'the link\'s own name, as its directory lists it');
  assert.deepEqual(await dependencies(path.join(dir, 'entry.uxdsl')), linked);
});

test('MIG-B9-23: a name in a directory that cannot be listed keeps its written spelling (an execute-only directory)', { skip: SKIP || NO_LISTING_DENIAL }, async (t) => {
  const dir = project(t, { 'entry.uxdsl': '@use "locked/PART";\n', 'locked/_part.uxdsl': '.p { a: b; }\n' });
  const locked = path.join(dir, 'locked');
  fs.chmodSync(locked, 0o311);
  try {
    assert.throws(() => fs.readdirSync(locked), { code: 'EACCES' }, 'the directory cannot be listed');
    assert.equal(fs.realpathSync.native(path.join(locked, '_PART.uxdsl')), path.join(locked, '_part.uxdsl'), 'the real path still names the file as stored');
    const written = under(dir, ['entry.uxdsl', 'locked/_PART.uxdsl']);
    assert.deepEqual(stage(path.join(dir, 'entry.uxdsl')).loadedFiles, written, 'the name as written');
    assert.deepEqual(await dependencies(path.join(dir, 'entry.uxdsl')), written);
  } finally {
    fs.chmodSync(locked, 0o755);
  }
});
