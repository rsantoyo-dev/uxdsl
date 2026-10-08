'use strict';

// The installed-package mechanism every release gate and consumer fixture
// shares: builds and `npm pack`s `packages/uxdsl` — the one distributable
// package — installs that real tarball into an isolated temp directory (no
// workspace or symlink resolution back into this monorepo), and hands back a
// `require` scoped to that install plus helpers for running its binary.
//
// The install is the documented one, `npm i -D uxdsl`: npm installs the
// `postcss` peer itself, and the optional `vite`/`webpack` peers are left out.
// `extra` packs further local package directories into the same install (the
// deprecation shims, for instance) after `uxdsl`.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGE_DIR = path.join(REPO_ROOT, 'packages', 'uxdsl');

/** Builds and packs one package directory into `destination`; returns the tarball path. */
function packPackage(cwd, destination, run) {
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  if (pkg.scripts?.build) run('npm', ['run', 'build'], cwd);
  const pack = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], cwd))[0];
  return { file: path.join(destination, pack.filename), pack };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.tmpPrefix] os.tmpdir() prefix for the consumer directory.
 * @param {object} [opts.consumerPkg] package.json contents for the install directory.
 * @param {string[]} [opts.extra] further package directories (relative to the repo root) to pack and install.
 * @returns {{ dir: string, run: Function, write: Function, req: NodeRequire, version: string, tarball: string, pack: object }}
 */
function packAndInstall({ tmpPrefix = 'uxdsl-tarball-consumer-', consumerPkg, extra = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), tmpPrefix));
  const run = (cmd, args, cwd = dir) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 180000 });
  const write = (file, value) => {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, value);
  };

  console.log(`Tarball consumer: ${dir}`);
  const { file: tarball, pack } = packPackage(PACKAGE_DIR, dir, run);
  const archives = [tarball, ...extra.map((rel) => packPackage(path.join(REPO_ROOT, rel), dir, run).file)];
  write('package.json', JSON.stringify(consumerPkg || { name: 'uxdsl-tarball-consumer', version: '1.0.0', private: true }));
  run('npm', ['install', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', ...archives]);

  const req = createRequire(path.join(dir, 'package.json'));
  const version = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')).version;
  const pkgDir = path.join(dir, 'node_modules', 'uxdsl');
  assert.equal(fs.lstatSync(pkgDir).isSymbolicLink(), false, 'uxdsl must be a real install, not a workspace symlink');
  assert.equal(JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version, version, 'the installed uxdsl must be this checkout\'s version');

  return { dir, run, write, req, version, tarball, pack };
}

module.exports = { packAndInstall, packPackage, REPO_ROOT, PACKAGE_DIR };
