'use strict';

// Starts npm the same way on every platform.
//
// - On POSIX the call is execFileSync/spawnSync('npm', args, options), as given.
// - On win32, npm is npm.cmd, which Node starts only through a shell (without
//   one, execFile cannot find `npm`, and a .cmd file is refused with EINVAL).
//   The call adds `shell: true` and double-quotes each argument; an argument
//   holding a character cmd.exe reads specially (" % ! ^ & | < >) is refused
//   with a TypeError naming it, rather than handed to cmd.exe.
const { execFileSync, spawnSync } = require('node:child_process');

const CMD_SPECIAL = /["%!^&|<>]/;

/** The command, arguments and options the platform starts npm with. */
function npmCall(args, options = {}, platform = process.platform) {
  if (platform !== 'win32') return ['npm', args, options];
  const quoted = args.map((arg) => {
    if (CMD_SPECIAL.test(arg)) {
      throw new TypeError(`npm argument ${JSON.stringify(arg)} holds a character cmd.exe reads specially (" % ! ^ & | < >)`);
    }
    return `"${arg}"`;
  });
  return ['npm', quoted, { ...options, shell: true }];
}

function execNpmSync(args, options) {
  return execFileSync(...npmCall(args, options));
}

function spawnNpmSync(args, options) {
  return spawnSync(...npmCall(args, options));
}

module.exports = { npmCall, execNpmSync, spawnNpmSync };
