'use strict';

// The guard `npm test` runs its steps through (scripts/tmpdir-guard.js), as a
// subprocess on a scratch directory that stands for the temporary directory it
// is given. A sentinel file in that directory shows the guard touches nothing
// there but its own directory.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GUARD = path.join(__dirname, 'tmpdir-guard.js');
const OWN = /^uxdsl-npm-test-[A-Za-z0-9]{6}$/;

/** A directory for one test: removed when the test passes, kept with its path printed when it fails. */
function scratch(t, prefix = 'uxdsl-tmpdir-guard-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    if (t.passed) fs.rmSync(dir, { recursive: true, force: true });
    else t.diagnostic(`temporary directory kept: ${dir}`);
  });
  return dir;
}

/** The directory the guard is given, holding one sentinel file. */
function given(t) {
  const dir = scratch(t);
  fs.writeFileSync(path.join(dir, 'sentinel.txt'), 'placed before the run');
  return dir;
}

/** Runs the guard with TMPDIR, TMP and TEMP set to `tmp`, on `node -e <code>`. */
function guard(tmp, code, extraEnv = {}) {
  const env = { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp, ...extraEnv };
  const result = spawnSync(process.execPath, [GUARD, process.execPath, '-e', code], { env, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('MIG-B9-25: the guard runs a command with TMPDIR, TMP and TEMP set to a directory of its own inside the one it is given, and removes it when the command passes and leaves nothing', (t) => {
  const dir = given(t);
  const run = guard(dir, 'process.stdout.write(JSON.stringify([process.env.TMPDIR, process.env.TMP, process.env.TEMP, require("node:fs").existsSync(process.env.TMPDIR)]))');
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, '', 'it prints nothing of its own');
  const [tmpdir, tmp, temp, existed] = JSON.parse(run.stdout);
  assert.equal(existed, true, 'the command ran with its directory in place');
  assert.equal(path.dirname(tmpdir), dir, 'TMPDIR names a directory inside the one the guard is given');
  assert.match(path.basename(tmpdir), OWN);
  assert.equal(tmp, tmpdir, 'TMP names the same directory');
  assert.equal(temp, tmpdir, 'TEMP names the same directory');
  assert.deepEqual(fs.readdirSync(dir), ['sentinel.txt'], 'its directory is removed; the sentinel is untouched and alone');
});

test('MIG-B9-25: the guard fails a command that passes but leaves an entry, names it and removes it (negative control)', (t) => {
  const dir = given(t);
  const run = guard(dir, 'const fs = require("node:fs"); const path = require("node:path"); const os = require("node:os"); fs.writeFileSync(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "planted-")), "file.txt"), "left");');
  assert.equal(run.status, 1, run.stderr);
  const lines = run.stderr.split('\n');
  const at = lines.indexOf('tmpdir-guard: the tests passed but left these entries in their temporary directory, now removed:');
  assert.notEqual(at, -1, run.stderr);
  assert.match(lines[at + 1], /^ {2}planted-[A-Za-z0-9]{6}$/, run.stderr);
  assert.equal(lines[at + 2], '', 'one entry, then the end of the output');
  assert.deepEqual(fs.readdirSync(dir), ['sentinel.txt'], 'the guard\'s directory and the entry are removed; the sentinel is untouched');
});

test('MIG-B9-25: the guard names every entry left, sorted, one per line', (t) => {
  const dir = given(t);
  const run = guard(dir, 'const fs = require("node:fs"); const path = require("node:path"); const os = require("node:os"); for (const name of ["zeta", "alpha", "mid"]) fs.mkdirSync(path.join(os.tmpdir(), name));');
  assert.equal(run.status, 1, run.stderr);
  assert.ok(run.stderr.endsWith('tmpdir-guard: the tests passed but left these entries in their temporary directory, now removed:\n  alpha\n  mid\n  zeta\n'), run.stderr);
  assert.deepEqual(fs.readdirSync(dir), ['sentinel.txt']);
});

test('MIG-B9-25: the guard keeps its directory when the command fails, prints its path and exits with the command\'s code', (t) => {
  const dir = given(t);
  const run = guard(dir, 'const fs = require("node:fs"); const path = require("node:path"); const os = require("node:os"); fs.mkdtempSync(path.join(os.tmpdir(), "planted-")); process.exit(3);');
  assert.equal(run.status, 3, run.stderr);
  const match = /^tmpdir-guard: the tests failed; their temporary directory is kept: (.+)$/m.exec(run.stderr);
  assert.ok(match, run.stderr);
  const kept = match[1];
  assert.ok(path.isAbsolute(kept), kept);
  assert.equal(path.dirname(kept), dir);
  assert.match(path.basename(kept), OWN);
  const inside = fs.readdirSync(kept);
  assert.equal(inside.length, 1, inside.join(', '));
  assert.match(inside[0], /^planted-[A-Za-z0-9]{6}$/);
  assert.deepEqual(fs.readdirSync(dir).sort(), [path.basename(kept), 'sentinel.txt'].sort());
});

test('MIG-B9-25: the guard keeps its directory and exits 1 when the command is ended by a signal', (t) => {
  const dir = given(t);
  const run = guard(dir, 'process.kill(process.pid, "SIGTERM"); setTimeout(() => {}, 10000);');
  assert.equal(run.status, 1, run.stderr);
  const match = /^tmpdir-guard: the tests failed; their temporary directory is kept: (.+)$/m.exec(run.stderr);
  assert.ok(match, run.stderr);
  assert.equal(fs.existsSync(match[1]), true);
});

test('MIG-B9-25: the guard runs nothing and exits 1 when it cannot make its directory', (t) => {
  const dir = given(t);
  const missing = path.join(dir, 'missing');
  const marker = path.join(dir, 'marker.txt');
  const run = guard(missing, `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran")`);
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, new RegExp(`^tmpdir-guard: cannot make a temporary directory in ${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: .+$`, 'm'));
  assert.equal(fs.existsSync(marker), false, 'the command did not run');
  assert.deepEqual(fs.readdirSync(dir), ['sentinel.txt']);
});

test('MIG-B9-25: the guard keeps its directory and exits 1 when the command cannot be run', (t) => {
  const dir = given(t);
  const missing = path.join(dir, 'no-such-command');
  const run = spawnSync(process.execPath, [GUARD, missing], { env: { ...process.env, TMPDIR: dir, TMP: dir, TEMP: dir }, encoding: 'utf8' });
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, new RegExp(`^tmpdir-guard: cannot run ${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: .+$`, 'm'));
  const match = /^tmpdir-guard: the tests failed; their temporary directory is kept: (.+)$/m.exec(run.stderr);
  assert.ok(match, run.stderr);
  assert.deepEqual(fs.readdirSync(match[1]), [], 'nothing ran in it');
});

test('MIG-B9-25: the guard prints its usage, makes nothing and exits 1 when it is given no command', (t) => {
  const dir = given(t);
  const run = spawnSync(process.execPath, [GUARD], { env: { ...process.env, TMPDIR: dir, TMP: dir, TEMP: dir }, encoding: 'utf8' });
  assert.equal(run.status, 1, run.stderr);
  assert.equal(run.stderr, 'usage: node scripts/tmpdir-guard.js <command> [args…]\n');
  assert.deepEqual(fs.readdirSync(dir), ['sentinel.txt'], 'no directory of its own was made');
});

test('MIG-B9-25: the guard removes a symbolic link left in its directory, never what the link points to', (t) => {
  const dir = given(t);
  const sentinel = scratch(t, 'uxdsl-tmpdir-guard-sentinel-');
  fs.writeFileSync(path.join(sentinel, 'keep.txt'), 'outside the given directory');
  const run = guard(dir, `require("node:fs").symlinkSync(${JSON.stringify(sentinel)}, require("node:path").join(require("node:os").tmpdir(), "link"))`);
  assert.equal(run.status, 1, run.stderr);
  assert.ok(run.stderr.endsWith('now removed:\n  link\n'), run.stderr);
  assert.deepEqual(fs.readdirSync(dir), ['sentinel.txt'], 'the link and the guard\'s directory are removed');
  assert.equal(fs.readFileSync(path.join(sentinel, 'keep.txt'), 'utf8'), 'outside the given directory', 'the link\'s target and its file are untouched');
});
