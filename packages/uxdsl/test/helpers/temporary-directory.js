'use strict';

// Temporary directories for the repository's tests and fixtures, made in
// os.tmpdir() and removed when the work that made them succeeds.
//
// - Given a test context `t`, a directory is removed when that test passes,
//   and kept when it fails, its path printed through t.diagnostic as
//   "temporary directory kept: <path>".
// - Without one (a directory made by a helper that receives no context, when
//   a file loads, or by a fixture script), it follows its process: removed
//   when the process exits with code 0, kept when it exits with any other
//   code, each kept path printed on stderr in the same form. A test file run
//   by `node --test` exits 1 when one of its tests fails, so such a directory
//   is kept when any test of its file fails.
//
// Removal is fs.rmSync with `recursive`, which removes a symbolic link inside
// the directory without following it: what the link points to is untouched.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const KEPT = 'temporary directory kept:';

const untilExit = new Set();
let exitHandlerInstalled = false;

function remove(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function onExit(code) {
  for (const dir of untilExit) {
    if (code === 0) remove(dir);
    else fs.writeSync(2, `${KEPT} ${dir}\n`);
  }
}

/**
 * Removes `dir`, a directory made elsewhere, when the test `t` passes or, with
 * no `t`, when the process exits 0; keeps it and prints its path otherwise.
 * Returns `dir`.
 */
function removeWhenDone(dir, t) {
  if (t) {
    t.after(() => {
      if (t.passed) remove(dir);
      else t.diagnostic(`${KEPT} ${dir}`);
    });
    return dir;
  }
  untilExit.add(dir);
  if (!exitHandlerInstalled) {
    exitHandlerInstalled = true;
    process.once('exit', onExit);
  }
  return dir;
}

/**
 * Makes a directory in os.tmpdir() whose name starts with `prefix`, and
 * returns its path as fs.mkdtempSync returns it; removeWhenDone(dir, t)
 * decides when it is removed.
 */
function temporaryDirectory(prefix, t) {
  return removeWhenDone(fs.mkdtempSync(path.join(os.tmpdir(), prefix)), t);
}

module.exports = { temporaryDirectory, removeWhenDone };
