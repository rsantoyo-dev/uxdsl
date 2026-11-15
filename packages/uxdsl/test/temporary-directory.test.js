'use strict';

// The tests' temporary directories (test/helpers/temporary-directory.js): a
// directory a test makes is removed when that test passes and kept, its path
// printed, when it fails; one made outside any test follows its process's exit
// code; a link inside one is removed, never followed. Each case runs a planted
// file in a subprocess with TMPDIR, TMP and TEMP of its own, and the same
// checker is applied to the real helper and to helpers that get it wrong.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HELPER = path.join(__dirname, 'helpers', 'temporary-directory.js');
const KEPT = 'temporary directory kept:';

/** A scratch directory for one test: removed when the test passes, kept with its path printed when it fails. */
function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-temporary-directory-test-'));
  t.after(() => {
    if (t.passed) fs.rmSync(dir, { recursive: true, force: true });
    else t.diagnostic(`${KEPT} ${dir}`);
  });
  return dir;
}

const PLANTED_TEST = `'use strict';
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { temporaryDirectory } = require(process.env.PLANTED_HELPER);
test('planted', (t) => {
  const dir = temporaryDirectory('planted-', t);
  fs.writeFileSync(path.join(dir, 'file.txt'), 'made by the planted test');
  if (process.env.PLANTED_LINK_TO) fs.symlinkSync(process.env.PLANTED_LINK_TO, path.join(dir, 'link'));
  fs.writeFileSync(process.env.PLANTED_RECORD, dir);
  if (process.env.PLANTED_OUTCOME === 'fail') throw new Error('the planted test fails');
});
`;

const PLANTED_SCRIPT = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { temporaryDirectory } = require(process.env.PLANTED_HELPER);
const dir = temporaryDirectory('planted-');
fs.writeFileSync(path.join(dir, 'file.txt'), 'made outside any test');
if (process.env.PLANTED_LINK_TO) fs.symlinkSync(process.env.PLANTED_LINK_TO, path.join(dir, 'link'));
fs.writeFileSync(process.env.PLANTED_RECORD, dir);
if (process.env.PLANTED_OUTCOME === 'fail') process.exitCode = 1;
`;

const PLANTED_FILE_LEVEL = `'use strict';
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { temporaryDirectory } = require(process.env.PLANTED_HELPER);
const dir = temporaryDirectory('planted-');
fs.writeFileSync(path.join(dir, 'file.txt'), 'made when the test file loads');
fs.writeFileSync(process.env.PLANTED_RECORD, dir);
test('planted', () => {
  if (process.env.PLANTED_OUTCOME === 'fail') throw new Error('the planted test fails');
});
`;

const ALWAYS_REMOVES = `'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const made = new Set();
let installed = false;
exports.temporaryDirectory = (prefix, t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  if (t) t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  else {
    made.add(dir);
    if (!installed) {
      installed = true;
      process.once('exit', () => { for (const each of made) fs.rmSync(each, { recursive: true, force: true }); });
    }
  }
  return dir;
};
`;

const NEVER_REMOVES = `'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
exports.temporaryDirectory = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
`;

// Removes by walking with fs.statSync, which follows a link into its target.
const STAT_WALK = `'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
function walk(entry) {
  if (fs.statSync(entry).isDirectory()) {
    for (const name of fs.readdirSync(entry)) walk(path.join(entry, name));
    try { fs.rmdirSync(entry); } catch { fs.unlinkSync(entry); }
  } else fs.unlinkSync(entry);
}
const made = new Set();
let installed = false;
exports.temporaryDirectory = (prefix, t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  if (t) t.after(() => { if (t.passed) walk(dir); });
  else {
    made.add(dir);
    if (!installed) {
      installed = true;
      process.once('exit', (code) => { if (code === 0) for (const each of made) walk(each); });
    }
  }
  return dir;
};
`;

/** Writes `text` to a new file in `dir` and returns its path. */
function plant(dir, name, text) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, text);
  return file;
}

/**
 * Runs a planted file once, in its own temporary directory, and returns what
 * the run left: its exit status, its output, the directory it made and whether
 * that directory is still there.
 */
function runPlanted(base, { helper, file, viaTestRunner, outcome, linkTo }) {
  const run = fs.mkdtempSync(path.join(base, 'run-'));
  const tmp = path.join(run, 'tmp');
  fs.mkdirSync(tmp);
  const record = path.join(run, 'record.txt');
  const env = { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp, PLANTED_HELPER: helper, PLANTED_RECORD: record, PLANTED_OUTCOME: outcome };
  delete env.NODE_TEST_CONTEXT;
  if (linkTo) env.PLANTED_LINK_TO = linkTo;
  else delete env.PLANTED_LINK_TO;
  const args = viaTestRunner ? ['--test', '--test-reporter=tap', file] : [file];
  const result = spawnSync(process.execPath, args, { cwd: run, env, encoding: 'utf8' });
  const dir = fs.existsSync(record) ? fs.readFileSync(record, 'utf8') : null;
  return { status: result.status, output: `${result.stdout}${result.stderr}`, dir, kept: dir !== null && fs.existsSync(dir) };
}

/**
 * The two halves C4 asks of a helper, for one planted file: a passing run
 * removes its directory; a failing run keeps it, with the file inside, and
 * prints its path. Returns each half's problems; none means the half holds.
 */
function checkHalves(base, helper, file, viaTestRunner) {
  const problems = { passing: [], failing: [] };
  const pass = runPlanted(base, { helper, file, viaTestRunner, outcome: 'pass' });
  if (pass.status !== 0) problems.passing.push(`exit ${pass.status}, expected 0:\n${pass.output}`);
  if (pass.dir === null) problems.passing.push('the planted file recorded no directory');
  else if (pass.kept) problems.passing.push(`${pass.dir} is still there after a passing run`);
  const fail = runPlanted(base, { helper, file, viaTestRunner, outcome: 'fail' });
  if (fail.status !== 1) problems.failing.push(`exit ${fail.status}, expected 1:\n${fail.output}`);
  if (fail.dir === null) problems.failing.push('the planted file recorded no directory');
  else {
    if (!fail.kept || !fs.existsSync(path.join(fail.dir, 'file.txt'))) problems.failing.push(`${fail.dir} was removed after a failing run`);
    if (!fail.output.includes(`${KEPT} ${fail.dir}`)) problems.failing.push(`the output does not print "${KEPT} ${fail.dir}":\n${fail.output}`);
  }
  return problems;
}

/** The mutants' verdicts: each must break the half it names, and the real helper neither. */
function assertHelperAndMutants(base, files) {
  const helpers = {
    real: HELPER,
    alwaysRemoves: plant(base, 'always-removes.js', ALWAYS_REMOVES),
    neverRemoves: plant(base, 'never-removes.js', NEVER_REMOVES),
  };
  for (const { label, file, viaTestRunner } of files) {
    const real = checkHalves(base, helpers.real, file, viaTestRunner);
    assert.deepEqual(real, { passing: [], failing: [] }, `${label}: the helper`);
    const always = checkHalves(base, helpers.alwaysRemoves, file, viaTestRunner);
    assert.deepEqual(always.passing, [], `${label}: a helper that always removes passes the passing half`);
    assert.ok(always.failing.length > 0, `${label}: a helper that always removes must fail the failing half`);
    const never = checkHalves(base, helpers.neverRemoves, file, viaTestRunner);
    assert.ok(never.passing.length > 0, `${label}: a helper that never removes must fail the passing half`);
  }
}

test('MIG-B9-25: a test\'s temporary directory is removed when the test passes and kept, with its path printed, when it fails', (t) => {
  const base = scratch(t);
  const file = plant(base, 'planted.test.js', PLANTED_TEST);
  assertHelperAndMutants(base, [{ label: 'a directory made with the test\'s context', file, viaTestRunner: true }]);
});

test('MIG-B9-25: a temporary directory made outside any test is removed when its file exits 0 and kept when it exits non-zero', (t) => {
  const base = scratch(t);
  assertHelperAndMutants(base, [
    { label: 'a script that sets its exit code', file: plant(base, 'planted-script.js', PLANTED_SCRIPT), viaTestRunner: false },
    { label: 'a test file whose directory is made when it loads', file: plant(base, 'planted-file-level.test.js', PLANTED_FILE_LEVEL), viaTestRunner: true },
  ]);
});

test('MIG-B9-25: removing a test\'s temporary directory removes a link inside it, never the link\'s target', (t) => {
  const base = scratch(t);
  const statWalk = plant(base, 'stat-walk.js', STAT_WALK);
  const cases = [
    { label: 'with the test\'s context', file: plant(base, 'planted.test.js', PLANTED_TEST), viaTestRunner: true },
    { label: 'outside any test', file: plant(base, 'planted-script.js', PLANTED_SCRIPT), viaTestRunner: false },
  ];
  /** Runs one passing case against `helper` with a link to a fresh sentinel; returns whether the sentinel and its file survived. */
  const survives = (helper, { file, viaTestRunner }) => {
    const sentinel = fs.mkdtempSync(path.join(base, 'sentinel-'));
    fs.writeFileSync(path.join(sentinel, 'keep.txt'), 'outside the temporary directory');
    const run = runPlanted(base, { helper, file, viaTestRunner, outcome: 'pass', linkTo: sentinel });
    return { run, intact: fs.existsSync(path.join(sentinel, 'keep.txt')) };
  };
  for (const each of cases) {
    const real = survives(HELPER, each);
    assert.equal(real.run.status, 0, `${each.label}:\n${real.run.output}`);
    assert.equal(real.run.kept, false, `${each.label}: the directory and its link are removed`);
    assert.equal(real.intact, true, `${each.label}: the link's target and its file are untouched`);
    assert.equal(survives(statWalk, each).intact, false, `${each.label}: a removal that follows the link must delete the target's file (negative control)`);
  }
});
