'use strict';

// Shared installed-package mechanism for every "coordinated tarballs"
// release-gate fixture (mig-b2-05-release, mig-b3-06-release, ...): builds
// and `npm pack`s the five distributable packages, installs them together
// from their real tarballs into an isolated temp directory (no workspace/
// symlink resolution back into this monorepo), and hands back a `require`
// scoped to that install plus a `run` helper for invoking its binaries.
// Extracted so each release-gate fixture reuses this exact mechanism
// instead of re-implementing pack/install from scratch.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_NAMES = ['postcss-uxdsl', 'uxdsl-core', 'vite-plugin-uxdsl', 'uxdsl-webpack-loader', 'uxdsl-cli'];

/**
 * @param {object} [opts]
 * @param {string[]} [opts.names] packages to build/pack/install, in dependency order.
 * @param {string} [opts.tmpPrefix] os.tmpdir() prefix for the consumer directory.
 * @param {object} [opts.consumerPkg] package.json contents for the install directory.
 * @returns {{ dir: string, run: Function, write: Function, req: NodeRequire, version: string }}
 */
function packAndInstall({ names = DEFAULT_NAMES, tmpPrefix = 'uxdsl-tarball-consumer-', consumerPkg } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), tmpPrefix));
  const run = (cmd, args, cwd = dir) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 180000 });
  const write = (file, value) => {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, value);
  };

  console.log(`Tarball consumer: ${dir}`);
  const archives = [];
  for (const name of names) {
    const cwd = path.join(REPO_ROOT, 'packages', name);
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json')));
    if (pkg.scripts?.build) run('npm', ['run', 'build'], cwd);
    const pack = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', dir], cwd))[0];
    archives.push(path.join(dir, pack.filename));
  }
  write('package.json', JSON.stringify(consumerPkg || { name: 'uxdsl-tarball-consumer', version: '1.0.0', private: true }));
  run('npm', ['install', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund', ...archives]);

  const req = createRequire(path.join(dir, 'package.json'));
  const version = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/postcss-uxdsl/package.json'), 'utf8')).version;
  for (const name of names) {
    const pkgDir = path.join(dir, 'node_modules', name);
    assert.equal(fs.lstatSync(pkgDir).isSymbolicLink(), false, `${name} must be a real install, not a workspace symlink`);
    assert.equal(JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version, version, `${name} version must match the coordinated release version`);
  }

  return { dir, run, write, req, version };
}

module.exports = { packAndInstall, DEFAULT_NAMES, REPO_ROOT };
