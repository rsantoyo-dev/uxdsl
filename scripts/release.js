#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let version = null;
let tag = null;
let dryRun = false;
let skipPublish = false;
let skipBuild = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--version' || arg === '-v') {
    version = args[i + 1];
    i += 1;
  } else if (arg === '--tag') {
    tag = args[i + 1];
    i += 1;
  } else if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg === '--skip-publish') {
    skipPublish = true;
  } else if (arg === '--skip-build') {
    skipBuild = true;
  } else {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  }
}

if (!version) {
  console.error('Usage: node scripts/release.js --version <semver> [--tag <dist-tag>] [--dry-run] [--skip-build] [--skip-publish]');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const packages = [
  { name: 'postcss-uxdsl', dir: 'packages/postcss-uxdsl', deps: [] },
  { name: 'uxdsl-core', dir: 'packages/uxdsl-core', deps: ['postcss-uxdsl'] },
  { name: 'vite-plugin-uxdsl', dir: 'packages/vite-plugin-uxdsl', deps: ['postcss-uxdsl', 'uxdsl-core'] },
  { name: 'uxdsl-webpack-loader', dir: 'packages/uxdsl-webpack-loader', deps: ['uxdsl-core'] },
  { name: 'uxdsl-cli', dir: 'packages/uxdsl-cli', deps: ['uxdsl-core'] },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function updateDependencyRanges(pkgJson, depNames) {
  const fields = ['dependencies', 'devDependencies', 'optionalDependencies'];
  depNames.forEach((dep) => {
    fields.forEach((field) => {
      if (pkgJson[field] && pkgJson[field][dep]) {
        pkgJson[field][dep] = `^${version}`;
      }
    });
  });
}

function run(command, args, cwd) {
  if (dryRun) {
    console.log(`(dry-run) ${command} ${args.join(' ')} [cwd=${cwd}]`);
    return { status: 0 };
  }
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}`);
  }
  return result;
}

packages.forEach((pkg) => {
  const pkgDir = path.join(rootDir, pkg.dir);
  const pkgFile = path.join(pkgDir, 'package.json');
  const pkgJson = readJson(pkgFile);
  pkgJson.version = version;
  if (pkg.deps.length > 0) {
    updateDependencyRanges(pkgJson, pkg.deps);
  }
  if (dryRun) {
    console.log(`(dry-run) would set ${pkg.name}@${version}`);
  } else {
    writeJson(pkgFile, pkgJson);
    console.log(`Set ${pkg.name}@${version}`);
  }
  if (!skipBuild && pkgJson.scripts && pkgJson.scripts.build) {
    run('npm', ['run', 'build'], pkgDir);
  }
});

if (skipPublish) {
  console.log('Publish skipped.');
  process.exit(0);
}

packages.forEach((pkg) => {
  const pkgDir = path.join(rootDir, pkg.dir);
  const argsList = ['publish', '--access', 'public'];
  if (tag) {
    argsList.push('--tag', tag);
  }
  run('npm', argsList, pkgDir);
});

console.log('Release complete.');
