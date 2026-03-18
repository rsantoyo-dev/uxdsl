#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');

function runGit(args) {
  const result = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function getPublishablePackages() {
  if (!fs.existsSync(packagesDir)) return [];

  return fs
    .readdirSync(packagesDir)
    .filter((entry) => {
      const pkgJsonPath = path.join(packagesDir, entry, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) return false;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        return pkg && pkg.name && pkg.private !== true;
      } catch {
        return false;
      }
    })
    .map((entry) => ({
      dir: entry,
      rel: `packages/${entry}`,
      readme: `packages/${entry}/README.md`,
    }));
}

function isCodeChangeInPackage(relFile, pkgRel) {
  if (!relFile.startsWith(`${pkgRel}/`)) return false;
  const local = relFile.slice(pkgRel.length + 1);

  // Documentation-only changes do not require additional docs edits.
  const docOnly =
    local === 'README.md' ||
    local === 'CHANGELOG.md' ||
    local.startsWith('docs/');

  return !docOnly;
}

function main() {
  const stagedOutput = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  if (!stagedOutput) {
    process.exit(0);
  }

  const stagedFiles = stagedOutput
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\\/g, '/'));

  const publishablePackages = getPublishablePackages();
  if (publishablePackages.length === 0) {
    process.exit(0);
  }

  const rootReadmeChanged = stagedFiles.includes('README.md');
  const violations = [];
  const touchedPackages = [];

  publishablePackages.forEach((pkg) => {
    const hasCodeChange = stagedFiles.some((f) => isCodeChangeInPackage(f, pkg.rel));
    if (!hasCodeChange) return;

    touchedPackages.push(pkg.dir);

    const packageReadmeChanged = stagedFiles.includes(pkg.readme);
    if (!packageReadmeChanged && !rootReadmeChanged) {
      violations.push(pkg);
    }
  });

  if (touchedPackages.length > 0) {
    console.log(`📦 Changed npm packages: ${touchedPackages.join(', ')}`);
  }

  if (violations.length > 0) {
    console.error('\n❌ Documentation update required before commit.');
    console.error('You changed publishable package code, but no README update was staged for:');
    violations.forEach((pkg) => {
      console.error(`  - ${pkg.rel}/ (stage ${pkg.readme} or README.md)`);
    });
    console.error('\nTip: include at least one docs note per package change to keep npm consumers informed.');
    process.exit(1);
  }

  if (touchedPackages.length > 0) {
    console.log('✅ Docs check passed.');
  }
}

main();
