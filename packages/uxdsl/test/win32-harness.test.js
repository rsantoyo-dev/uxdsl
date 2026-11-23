'use strict';

// The negative controls of the Windows harness. Each shows, on win32, the
// difference a helper or an assertion of the suites accounts for, or shows
// that none is needed: npm is a .cmd file Node starts only through a shell; a
// POSIX absolute `from` is absolute on win32 too, so PostCSS names an error's
// file as written, not resolved onto the current drive; and os.tmpdir() reads
// TEMP and TMP (not TMPDIR), which the tmpdir guard sets. Off win32 those
// tests are skipped with their reason. Two more run on every platform: they
// pin what the npm and separator helpers do for each platform, given the
// platform or the separator, so a change to the POSIX branch fails on POSIX.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');
const postcss = require('postcss');

const { npmCall, execNpmSync } = require('./helpers/npm');
const { posixSeparators, posixOutput } = require('./helpers/separators');
const exported = require('../dist/plugin');
const plugin = exported.default || exported;

const WIN32 = process.platform === 'win32';
const ONLY_WIN32 = WIN32 ? false : 'the Windows paths this checks exist only on win32';
const GUARD = path.resolve(__dirname, '..', '..', '..', 'scripts', 'tmpdir-guard.js');

test('MIG-B9-28: on win32 npm cannot be started without the helper, and the helper starts it (negative control)', { skip: ONLY_WIN32 }, () => {
  let unhelped;
  try {
    execFileSync('npm', ['--version'], { stdio: 'pipe' });
  } catch (error) {
    unhelped = error;
  }
  assert.ok(unhelped, 'execFileSync(\'npm\') started npm without a shell');
  assert.ok(['ENOENT', 'EINVAL'].includes(unhelped.code), `${unhelped.code}: ${unhelped.message}`);
  const version = String(execNpmSync(['--version'], { stdio: 'pipe' })).trim();
  assert.match(version, /^\d+\.\d+\.\d+/);
  // An argument cmd.exe would read is refused before any process starts.
  assert.throws(() => npmCall(['pack', 'a&b']), { name: 'TypeError', message: /"a&b"/ });
});

test('MIG-B9-28: on win32 PostCSS keeps a POSIX absolute from as written, where path.resolve gives it a drive letter, so an error.file assertion keeps its POSIX literal (negative control)', { skip: ONLY_WIN32 }, () => {
  const literal = '/project/src/app.uxdsl';
  // path.isAbsolute reads a path that starts with a separator as absolute on
  // win32 too, and PostCSS resolves `from` only when it is not absolute.
  assert.equal(path.isAbsolute(literal), true);
  const resolved = path.resolve(literal);
  assert.match(resolved, /^[A-Za-z]:\\project\\src\\app\.uxdsl$/);
  let error;
  try {
    postcss([plugin({ discoverTheme: false })]).process('.a { padding: space(404); }', { from: literal }).css;
  } catch (caught) {
    error = caught;
  }
  assert.equal(error?.name, 'CssSyntaxError', error?.message);
  assert.equal(error.file, literal, 'the literal as written');
  assert.notEqual(error.file, resolved, 'never the drive-lettered path');
});

test('MIG-B9-28: on win32 the tmpdir guard sets TEMP and TMP, so a passing command that leaves an entry in os.tmpdir() fails it (negative control)', { skip: ONLY_WIN32 }, () => {
  // The guard starts its command through cmd.exe on win32, which splits an
  // unquoted argument at its spaces: the node path and the script are quoted.
  const node = `"${process.execPath}"`;
  const make = "require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'left-by-harness-'))";
  const leaves = spawnSync(process.execPath, [GUARD, node, '-e', `"${make}"`], { encoding: 'utf8' });
  assert.equal(leaves.status, 1, leaves.stderr);
  assert.match(leaves.stderr, /tmpdir-guard: the tests passed but left these entries/);
  assert.match(leaves.stderr, /^ {2}left-by-harness-\S+$/m);
  const tidy = `require('fs').rmSync(${make}, { recursive: true })`;
  const clean = spawnSync(process.execPath, [GUARD, node, '-e', `"${tidy}"`], { encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(clean.stderr, '');
});

test('MIG-B9-28: npmCall gives the call unchanged off win32, and on win32 adds a shell, double-quotes each argument and refuses one cmd.exe reads specially', () => {
  const args = ['pack', '--dry-run', 'C:\\a b\\kit'];
  const options = { cwd: 'x', stdio: 'pipe' };
  for (const platform of ['linux', 'darwin']) {
    const [command, given, opts] = npmCall(args, options, platform);
    assert.equal(command, 'npm');
    assert.equal(given, args, `${platform}: the same arguments array`);
    assert.equal(opts, options, `${platform}: the same options object, no shell`);
  }
  const [command, quoted, opts] = npmCall(args, options, 'win32');
  assert.equal(command, 'npm');
  assert.deepEqual(quoted, ['"pack"', '"--dry-run"', '"C:\\a b\\kit"']);
  assert.deepEqual(opts, { cwd: 'x', stdio: 'pipe', shell: true });
  assert.equal(options.shell, undefined, 'the caller\'s options are not changed');
  for (const special of ['"', '%', '!', '^', '&', '|', '<', '>']) {
    assert.throws(() => npmCall(['pack', `a${special}b`], {}, 'win32'), { name: 'TypeError', message: /reads specially/ }, special);
    assert.doesNotThrow(() => npmCall(['pack', `a${special}b`], {}, 'linux'), special);
  }
});

test('MIG-B9-28: posixSeparators and posixOutput are the identity where path.sep is /, and read each backslash as / where path.sep is a backslash', () => {
  const text = 'src\\a.uxdsl and src/b.uxdsl';
  assert.equal(posixSeparators(text, '/'), text, 'a backslash is kept where the separator is /');
  assert.equal(posixSeparators(text, '\\'), 'src/a.uxdsl and src/b.uxdsl');
  const result = { status: 1, stdout: 'out\\x.css', stderr: 'in\\y.uxdsl', stdio: null };
  assert.equal(posixOutput(result, '/'), result, 'the same object where the separator is /');
  assert.deepEqual(posixOutput(result, '\\'), { status: 1, stdout: 'out/x.css', stderr: 'in/y.uxdsl', stdio: null });
  assert.deepEqual(posixOutput({ stdout: null, stderr: undefined }, '\\'), { stdout: null, stderr: undefined }, 'a missing stream stays missing');
});
