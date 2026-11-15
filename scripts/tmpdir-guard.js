#!/usr/bin/env node
'use strict';

// Runs a command in a temporary directory of its own and fails a run that
// passes but leaves something there: `npm test` runs its steps through it.
//
//   node scripts/tmpdir-guard.js <command> [args…]
//
// - It makes one directory, uxdsl-npm-test-XXXXXX, in os.tmpdir() and runs the
//   command with TMPDIR, TMP and TEMP set to it and its standard streams
//   inherited. When it cannot make that directory it runs nothing, prints
//   "tmpdir-guard: cannot make a temporary directory in <directory>: <reason>"
//   on stderr and exits 1.
// - It reads, lists and removes nothing in the directory it is given but its
//   own directory.
// - The command exits 0 and leaves nothing: it removes its directory, prints
//   nothing and exits 0.
// - The command exits 0 and leaves something: it prints "tmpdir-guard: the
//   tests passed but left these entries in their temporary directory, now
//   removed:" on stderr, then each entry's name, sorted, one per line,
//   indented by two spaces; removes its directory; and exits 1.
// - The command exits non-zero, is ended by a signal or cannot be run: it
//   keeps its directory as it is, prints "tmpdir-guard: the tests failed;
//   their temporary directory is kept: <absolute path>" on stderr and exits
//   with the command's code (1 for a signal or a command that cannot be run,
//   after "tmpdir-guard: cannot run <command>: <reason>").
//
// Removal is fs.rmSync with `recursive`, which removes a symbolic link without
// following it. SIGINT and SIGTERM are passed on to the command.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function say(line) {
  fs.writeSync(2, `${line}\n`);
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  say('usage: node scripts/tmpdir-guard.js <command> [args…]');
  process.exit(1);
}

const given = os.tmpdir();
let own;
try {
  own = path.resolve(fs.mkdtempSync(path.join(given, 'uxdsl-npm-test-')));
} catch (error) {
  say(`tmpdir-guard: cannot make a temporary directory in ${given}: ${error.message}`);
  process.exit(1);
}

function keep(code) {
  say(`tmpdir-guard: the tests failed; their temporary directory is kept: ${own}`);
  process.exit(code);
}

let settled = false;
const child = spawn(command, args, {
  stdio: 'inherit',
  env: { ...process.env, TMPDIR: own, TMP: own, TEMP: own },
  shell: process.platform === 'win32',
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!settled) child.kill(signal);
  });
}

child.on('error', (error) => {
  if (settled) return;
  settled = true;
  say(`tmpdir-guard: cannot run ${command}: ${error.message}`);
  keep(1);
});

child.on('close', (code, signal) => {
  if (settled) return;
  settled = true;
  if (signal !== null || code !== 0) keep(signal !== null || code === null ? 1 : code);
  const left = fs.readdirSync(own).sort();
  fs.rmSync(own, { recursive: true, force: true });
  if (left.length === 0) process.exit(0);
  say('tmpdir-guard: the tests passed but left these entries in their temporary directory, now removed:');
  for (const name of left) say(`  ${name}`);
  process.exit(1);
});
