#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let version = null;
let bumpType = null;
let note = null;
let otp = process.env.NPM_OTP || null;
let tag = null;
let dryRun = false;
let skipPublish = false;
let skipBuild = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--version' || arg === '-v') {
    version = args[i + 1];
    i += 1;
  } else if (arg === '--bump') {
    bumpType = args[i + 1];
    i += 1;
  } else if (arg === '--note') {
    note = args[i + 1];
    i += 1;
  } else if (arg === '--otp') {
    otp = args[i + 1];
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

if (version && bumpType) {
  console.error('Use either --version <semver> or --bump <patch|minor|major>, not both.');
  process.exit(1);
}

if (!version && !bumpType) {
  console.error('Usage: node scripts/release.js (--version <semver> | --bump <patch|minor|major>) [--note "short update note"] [--otp <2fa-code>] [--tag <dist-tag>] [--dry-run] [--skip-build] [--skip-publish]');
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

function isValidSemver(input) {
  return /^\d+\.\d+\.\d+$/.test(String(input || '').trim());
}

function bumpSemver(current, type) {
  const [major, minor, patch] = current.split('.').map((n) => Number(n));
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

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

function runCapture(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function assertNpmPublishAccess(packageNames) {
  if (dryRun || skipPublish) return;

  const whoami = runCapture('npm', ['whoami'], rootDir);
  if (whoami.status !== 0 || !whoami.stdout) {
    console.error('NPM authentication check failed.');
    console.error('Run `npm login` (or configure an auth token) and try again.');
    if (whoami.stderr) console.error(whoami.stderr);
    process.exit(1);
  }

  const npmUser = whoami.stdout;
  console.log(`NPM user: ${npmUser}`);

  packageNames.forEach((pkgName) => {
    const owners = runCapture('npm', ['owner', 'ls', pkgName], rootDir);
    if (owners.status !== 0 || !owners.stdout) {
      console.error(`Cannot verify owners for ${pkgName}.`);
      if (owners.stderr) console.error(owners.stderr);
      process.exit(1);
    }

    const hasAccess = owners.stdout
      .split('\n')
      .map((line) => line.trim())
      .some((line) => line.toLowerCase().startsWith(`${npmUser.toLowerCase()} `));

    if (!hasAccess) {
      console.error(`NPM user '${npmUser}' is not an owner of '${pkgName}'.`);
      console.error(`Current owners:\n${owners.stdout}`);
      process.exit(1);
    }
  });
}

function appendCoreReadmeNote(nextVersion, text) {
  const readmeFile = path.join(rootDir, 'packages/uxdsl-core/README.md');
  if (!fs.existsSync(readmeFile)) return;

  const content = fs.readFileSync(readmeFile, 'utf8');
  const anchor = '## Demo update notes';
  const idx = content.indexOf(anchor);
  if (idx === -1) return;

  const normalized = String(text || '').trim();
  if (!normalized) return;

  const insertAfter = 'Use this section for short release notes on each npm tweak.';
  const insertAt = content.indexOf(insertAfter, idx);
  if (insertAt === -1) return;

  const line = `\n\n- v${nextVersion} — ${normalized}`;
  const updated =
    content.slice(0, insertAt + insertAfter.length) +
    line +
    content.slice(insertAt + insertAfter.length);

  if (dryRun) {
    console.log(`(dry-run) would append uxdsl-core demo note: v${nextVersion} — ${normalized}`);
    return;
  }

  fs.writeFileSync(readmeFile, updated);
  console.log(`Updated uxdsl-core README note for v${nextVersion}`);
}

if (bumpType) {
  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    console.error(`Invalid --bump value: ${bumpType}. Use patch, minor, or major.`);
    process.exit(1);
  }

  const sourcePkgFile = path.join(rootDir, 'packages/uxdsl-core/package.json');
  const sourcePkg = readJson(sourcePkgFile);
  const currentVersion = sourcePkg.version;

  if (!isValidSemver(currentVersion)) {
    console.error(`Current version is not semver-compatible: ${currentVersion}`);
    process.exit(1);
  }

  version = bumpSemver(currentVersion, bumpType);
  console.log(`Auto bump (${bumpType}): ${currentVersion} -> ${version}`);
}

if (!isValidSemver(version)) {
  console.error(`Invalid target version: ${version}`);
  process.exit(1);
}

assertNpmPublishAccess(packages.map((p) => p.name));

if (note) {
  appendCoreReadmeNote(version, note);
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
  if (otp) {
    argsList.push('--otp', otp);
  }
  try {
    run('npm', argsList, pkgDir);
  } catch (error) {
    console.error('\nPublish failed.');
    console.error('If you use npm 2FA, provide an OTP code:');
    console.error('  NPM_OTP=123456 npm run release:patch');
    console.error('  or: node scripts/release.js --bump patch --otp 123456');
    console.error('If using token-based publish, use a granular token with publish + 2FA bypass enabled.');
    throw error;
  }
});

console.log('Release complete.');
