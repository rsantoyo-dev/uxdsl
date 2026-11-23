'use strict';

// The CLI, compile() and the bundler plugins print a file's path relative to a
// directory with the platform's separator, as path.relative gives it: `\` on
// Windows. The tests write the paths they expect with `/`. These read each
// separator of a text as `/`, so one expected line holds on every platform;
// where path.sep is already `/` they return their argument unchanged.
const path = require('node:path');

/** `text` with each path.sep written as `/`: the identity where path.sep is `/`. */
function posixSeparators(text, sep = path.sep) {
  return sep === '/' ? text : String(text).split(sep).join('/');
}

/** A spawnSync result whose stdout and stderr read their separators as `/`: the same object where path.sep is `/`. */
function posixOutput(result, sep = path.sep) {
  if (sep === '/') return result;
  const read = (text) => (typeof text === 'string' ? posixSeparators(text, sep) : text);
  return { ...result, stdout: read(result.stdout), stderr: read(result.stderr) };
}

module.exports = { posixSeparators, posixOutput };
