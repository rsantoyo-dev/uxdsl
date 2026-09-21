#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packages = [
  { name: 'postcss-uxdsl', dir: 'packages/postcss-uxdsl', deps: [] },
  { name: 'uxdsl-core', dir: 'packages/uxdsl-core', deps: ['postcss-uxdsl'] },
  { name: 'vite-plugin-uxdsl', dir: 'packages/vite-plugin-uxdsl', deps: ['postcss-uxdsl', 'uxdsl-core'] },
  { name: 'uxdsl-webpack-loader', dir: 'packages/uxdsl-webpack-loader', deps: ['postcss-uxdsl', 'uxdsl-core'] },
  { name: 'uxdsl-cli', dir: 'packages/uxdsl-cli', deps: ['postcss-uxdsl', 'uxdsl-core'] },
];

// MIG-B6-28 (FEAT-008): postcss-uxdsl gets a fixed budget (its README/PNG
// bloat was the story's own reproduction: 2 040 KB packed before `files`
// existed at all). The other four already had no size problem; their
// budget is their own measured packed size once `files` was added here,
// +50% headroom, rounded up to a round number — not a moving target
// recomputed from whatever happens to be on disk at check time.
const PACK_BUDGETS_KB = {
  'postcss-uxdsl': 250,
  'uxdsl-cli': 55,
  'uxdsl-core': 15,
  'uxdsl-webpack-loader': 5,
  'vite-plugin-uxdsl': 12,
};

function isValidSemver(input) {
  return /^\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?$/.test(String(input || '').trim());
}

// MIG-B6-28: beta.6 only ever publishes latest/beta (D-6). rc/stable exist
// here so --version accepts them (the announced 0.5.0-rc.1 path used to be
// rejected outright), but their own dist-tag policy is not enforced by
// verifyDistTags below — it is declared, channel by channel, in that
// release's own record, per the story's explicit instruction not to apply
// the beta rule to every channel automatically.
function getChannel(version) {
  if (/-beta\.\d+$/.test(version)) return 'beta';
  if (/-rc\.\d+$/.test(version)) return 'rc';
  return 'stable';
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

function updateDependencyRanges(pkgJson, depNames, version) {
  const fields = ['dependencies', 'devDependencies', 'optionalDependencies'];
  depNames.forEach((dep) => {
    fields.forEach((field) => {
      if (pkgJson[field] && pkgJson[field][dep]) {
        pkgJson[field][dep] = version;
      }
    });
  });
}

function run(command, args, cwd, { dryRun = false } = {}) {
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

// MIG-B6-28: the real, local `npm pack --dry-run --json` a package
// currently produces. Never mutates a version, never publishes, never
// touches the registry — safe to run standalone (--check-pack) or as a
// prepublish gate. Injectable so tests can simulate an over-budget/
// missing-export tarball without shelling out to npm at all.
function packDryRun(pkgDir, { runCaptureFn = runCapture } = {}) {
  const result = runCaptureFn('npm', ['pack', '--dry-run', '--json'], pkgDir);
  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run failed in ${pkgDir}: ${result.stderr}`);
  }
  const [info] = JSON.parse(result.stdout);
  return info;
}

// Returns one violation entry per package that exceeds its budget, or an
// empty array. Never throws by itself — the caller decides whether an
// empty/non-empty result is fatal, so this stays reusable for both the
// standalone --check-pack report and the prepublish gate.
function checkPackBudgets(packageList, budgetsKB, rootDirPath, options = {}) {
  const results = [];
  const violations = [];
  packageList.forEach((pkg) => {
    const pkgDir = path.join(rootDirPath, pkg.dir);
    const info = options.packDryRunFn
      ? options.packDryRunFn(pkgDir)
      : packDryRun(pkgDir, options);
    const budgetKB = budgetsKB[pkg.name];
    const sizeKB = info.size / 1024;
    const entry = { name: pkg.name, sizeKB, budgetKB, files: info.files.map((f) => f.path) };
    results.push(entry);
    if (typeof budgetKB === 'number' && sizeKB > budgetKB) {
      violations.push(entry);
    }
  });
  return { results, violations };
}

// MIG-B6-28: every path package.json's own main/types/bin/exports claims a
// consumer can load must actually be inside the tarball `files` produces —
// otherwise a clean install resolves to a file that was never published. A
// wildcard subpath (`./theme/*`) can't be checked exactly; it passes when
// at least one packed file sits under that prefix. `package.json` itself
// is always included by npm regardless of `files`, so it is never flagged.
function resolveDeclaredPaths(pkgJson) {
  const paths = [];
  if (typeof pkgJson.main === 'string') paths.push(pkgJson.main);
  if (typeof pkgJson.types === 'string') paths.push(pkgJson.types);
  if (pkgJson.bin) {
    if (typeof pkgJson.bin === 'string') paths.push(pkgJson.bin);
    else Object.values(pkgJson.bin).forEach((p) => paths.push(p));
  }
  const walkExports = (node) => {
    if (typeof node === 'string') {
      paths.push(node);
    } else if (node && typeof node === 'object') {
      Object.values(node).forEach(walkExports);
    }
  };
  if (pkgJson.exports) walkExports(pkgJson.exports);
  return paths.map((p) => p.replace(/^\.\//, '')).filter((p) => p !== 'package.json');
}

function checkExportsPresent(packageList, rootDirPath, options = {}) {
  const results = [];
  const violations = [];
  packageList.forEach((pkg) => {
    const pkgDir = path.join(rootDirPath, pkg.dir);
    const pkgJson = options.readJsonFn
      ? options.readJsonFn(path.join(pkgDir, 'package.json'))
      : readJson(path.join(pkgDir, 'package.json'));
    const info = options.packDryRunFn ? options.packDryRunFn(pkgDir) : packDryRun(pkgDir, options);
    const packedPaths = info.files.map((f) => f.path);
    const declared = resolveDeclaredPaths(pkgJson);
    const missing = declared.filter((declaredPath) => {
      if (declaredPath.includes('*')) {
        const prefix = declaredPath.split('*')[0];
        return !packedPaths.some((p) => p.startsWith(prefix));
      }
      return !packedPaths.includes(declaredPath);
    });
    results.push({ name: pkg.name, declared, missing });
    if (missing.length > 0) violations.push({ name: pkg.name, missing });
  });
  return { results, violations };
}

// MIG-B6-28: after the version-bump loop writes every package.json for
// real, confirms every coordinated dependency string actually landed on
// the target version — a self-check on updateDependencyRanges rather than
// trusting it silently did the right thing. Only meaningful once files are
// really written, so callers gate this on `!dryRun`.
function checkVersionAlignment(packageList, rootDirPath, targetVersion, options = {}) {
  const violations = [];
  packageList.forEach((pkg) => {
    const pkgFile = path.join(rootDirPath, pkg.dir, 'package.json');
    const pkgJson = options.readJsonFn ? options.readJsonFn(pkgFile) : readJson(pkgFile);
    if (pkgJson.version !== targetVersion) {
      violations.push({ name: pkg.name, field: 'version', expected: targetVersion, actual: pkgJson.version });
    }
    pkg.deps.forEach((dep) => {
      ['dependencies', 'devDependencies', 'optionalDependencies'].forEach((field) => {
        if (pkgJson[field] && pkgJson[field][dep] && pkgJson[field][dep] !== targetVersion) {
          violations.push({
            name: pkg.name,
            field: `${field}.${dep}`,
            expected: targetVersion,
            actual: pkgJson[field][dep],
          });
        }
      });
    });
  });
  return { violations };
}

// MIG-B6-28: bounded-retry dist-tags check, run *after* a real publish —
// separate from the prepublish pack-budget gate above. Registry dist-tag
// propagation can lag by a few seconds, hence the retries; this never
// republishes to "fix" a tag (the story is explicit that republishing an
// already-published version is not a valid remediation) — it only reports
// exactly which `npm dist-tag add` command would fix it.
function defaultNpmViewDistTags(pkgName) {
  const result = runCapture('npm', ['view', pkgName, 'dist-tags', '--json'], rootDir);
  if (result.status !== 0) {
    throw new Error(`npm view ${pkgName} dist-tags failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function sleep(ms) {
  const { execSync } = require('child_process');
  if (ms <= 0) return;
  execSync(`node -e "setTimeout(()=>{}, ${ms})"`);
}

function verifyDistTags(packageNames, version, options = {}) {
  const {
    npmViewDistTagsFn = defaultNpmViewDistTags,
    retries = 5,
    delayMs = 2000,
    sleepFn = sleep,
  } = options;
  const channel = getChannel(version);

  return packageNames.map((pkgName) => {
    if (channel !== 'beta') {
      return {
        pkg: pkgName,
        channel,
        checked: false,
        ok: null,
        message: `channel '${channel}' has no automatic dist-tag policy here; declare it in that release's own record (see MIG-B6-12).`,
      };
    }

    let lastTags = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      lastTags = npmViewDistTagsFn(pkgName);
      const latestOk = lastTags.latest === version;
      const betaOk = lastTags.beta === version;
      if (latestOk && betaOk) {
        return { pkg: pkgName, channel, checked: true, ok: true, distTags: lastTags, attempt };
      }
      if (attempt < retries) sleepFn(delayMs);
    }

    const fixes = [];
    if (lastTags.latest !== version) fixes.push(`npm dist-tag add ${pkgName}@${version} latest`);
    if (lastTags.beta !== version) fixes.push(`npm dist-tag add ${pkgName}@${version} beta`);
    return {
      pkg: pkgName,
      channel,
      checked: true,
      ok: false,
      distTags: lastTags,
      message: `latest/beta do not both point at ${version} after ${retries} attempt(s). Do not republish to fix this — run:\n    ${fixes.join('\n    ')}`,
    };
  });
}

function assertNpmPublishAccess(packageNames, { dryRun, skipPublish }) {
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

function appendCoreReadmeNote(nextVersion, text, { dryRun } = {}) {
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

function printCheckPackReport({ results, violations }) {
  results.forEach((entry) => {
    const budget = typeof entry.budgetKB === 'number' ? `${entry.budgetKB}KB` : 'n/a';
    const status = violations.includes(entry) ? 'OVER BUDGET' : 'ok';
    console.log(`${entry.name}: ${entry.sizeKB.toFixed(1)}KB / ${budget} budget — ${status}`);
  });
  if (violations.length > 0) {
    console.error('\nPack budget exceeded:');
    violations.forEach((entry) => {
      console.error(`  - ${entry.name}: ${entry.sizeKB.toFixed(1)}KB > ${entry.budgetKB}KB`);
      console.error(`    files: ${entry.files.join(', ')}`);
    });
  }
}

function printExportsReport({ violations }) {
  if (violations.length === 0) {
    console.log('exports: every main/types/bin/exports path is present in every tarball.');
    return;
  }
  console.error('\nDeclared entry points missing from the tarball:');
  violations.forEach((entry) => {
    console.error(`  - ${entry.name}: ${entry.missing.join(', ')}`);
  });
}

function parseArgs(argv) {
  const options = {
    version: null,
    bumpType: null,
    note: null,
    otp: process.env.NPM_OTP || null,
    tag: null,
    dryRun: false,
    skipPublish: false,
    skipBuild: false,
    checkPack: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--version' || arg === '-v') {
      options.version = argv[i + 1];
      i += 1;
    } else if (arg === '--bump') {
      options.bumpType = argv[i + 1];
      i += 1;
    } else if (arg === '--note') {
      options.note = argv[i + 1];
      i += 1;
    } else if (arg === '--otp') {
      options.otp = argv[i + 1];
      i += 1;
    } else if (arg === '--tag') {
      options.tag = argv[i + 1];
      i += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-publish') {
      options.skipPublish = true;
    } else if (arg === '--skip-build') {
      options.skipBuild = true;
    } else if (arg === '--check-pack') {
      options.checkPack = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const { dryRun, skipPublish } = options;
  let { skipBuild, version, bumpType } = options;

  if (options.checkPack) {
    // MIG-B6-28: a real, local, side-effect-free check — no version bump,
    // no publish. Builds first (unless --skip-build) so the sizes reflect
    // current sources, not a stale dist/ from an earlier run.
    if (!skipBuild) {
      packages.forEach((pkg) => {
        const pkgDir = path.join(rootDir, pkg.dir);
        const pkgJson = readJson(path.join(pkgDir, 'package.json'));
        if (pkgJson.scripts && pkgJson.scripts.build) {
          run('npm', ['run', 'build'], pkgDir, { dryRun: false });
        }
      });
    }
    const report = checkPackBudgets(packages, PACK_BUDGETS_KB, rootDir);
    printCheckPackReport(report);
    const exportsReport = checkExportsPresent(packages, rootDir);
    printExportsReport(exportsReport);
    process.exit(report.violations.length > 0 || exportsReport.violations.length > 0 ? 1 : 0);
  }

  if (version && bumpType) {
    console.error('Use either --version <semver> or --bump <patch|minor|major>, not both.');
    process.exit(1);
  }

  if (!version && !bumpType) {
    console.error('Usage: node scripts/release.js (--version <semver> | --bump <patch|minor|major>) [--note "short update note"] [--otp <2fa-code>] [--tag <dist-tag>] [--dry-run] [--skip-build] [--skip-publish] | --check-pack [--skip-build]');
    process.exit(1);
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

  assertNpmPublishAccess(packages.map((p) => p.name), { dryRun, skipPublish });

  // MIG-B6-28: prepublish pack-budget gate. Runs before any version is
  // written to disk or anything is published — a build here uses whatever
  // sources are on disk *right now*, same as the version-bump/build loop
  // just below, so an over-budget tarball is caught before touching any
  // package.json/dist output for the release.
  if (!skipBuild) {
    const gateReport = checkPackBudgets(packages, PACK_BUDGETS_KB, rootDir);
    printCheckPackReport(gateReport);
    const exportsReport = checkExportsPresent(packages, rootDir);
    printExportsReport(exportsReport);
    if (gateReport.violations.length > 0 || exportsReport.violations.length > 0) {
      console.error('\nAborting release: preflight check failed (see above). Nothing was published.');
      process.exit(1);
    }
  }

  if (options.note) {
    appendCoreReadmeNote(version, options.note, { dryRun });
  }

  // MIG-B6-28: hash the pre-build tarball state so a source/dependency
  // change slipping in between this gate and the actual publish call below
  // is detectable, instead of silently publishing something that was never
  // the thing just validated.
  const preBuildHashes = !dryRun && !skipBuild
    ? Object.fromEntries(
        packages.map((pkg) => [pkg.name, packDryRun(path.join(rootDir, pkg.dir)).shasum])
      )
    : null;

  packages.forEach((pkg) => {
    const pkgDir = path.join(rootDir, pkg.dir);
    const pkgFile = path.join(pkgDir, 'package.json');
    const pkgJson = readJson(pkgFile);
    pkgJson.version = version;
    if (pkg.deps.length > 0) {
      updateDependencyRanges(pkgJson, pkg.deps, version);
    }
    if (dryRun) {
      console.log(`(dry-run) would set ${pkg.name}@${version}`);
    } else {
      writeJson(pkgFile, pkgJson);
      console.log(`Set ${pkg.name}@${version}`);
    }
    if (!skipBuild && pkgJson.scripts && pkgJson.scripts.build) {
      run('npm', ['run', 'build'], pkgDir, { dryRun });
    }
  });

  // MIG-B6-28: self-check on updateDependencyRanges above — only meaningful
  // once package.json files were actually rewritten, so this is skipped in
  // --dry-run (every file would still show its pre-bump version, which is
  // not a real misalignment).
  if (!dryRun) {
    const alignment = checkVersionAlignment(packages, rootDir, version);
    if (alignment.violations.length > 0) {
      console.error('\nAborting release: internal version misalignment after bump. Nothing was published.');
      alignment.violations.forEach((v) => {
        console.error(`  - ${v.name}.${v.field}: expected ${v.expected}, got ${v.actual}`);
      });
      process.exit(1);
    }
  }

  // MIG-B5-03 (FEAT-006): keeps packages/postcss-uxdsl/src/theme/theme-manifest.json's
  // own `uxdslVersion` (and every other generated language artifact) in
  // sync with the version just written above. Without this, the manifest
  // silently goes stale on every release — it did after both the beta.3
  // and beta.4 publishes, caught only by a release-gate fixture's own
  // registry check, not by anything in this script. Depends on
  // postcss-uxdsl's freshly-built dist/ output (generate-language-artifacts.js
  // reads compiled defaults from there), so this runs after the build loop
  // above and is skipped along with it in --skip-build mode.
  if (!skipBuild) {
    if (dryRun) {
      console.log('(dry-run) would run node scripts/generate-language-artifacts.js');
    } else {
      run('node', ['scripts/generate-language-artifacts.js'], rootDir, { dryRun });
    }
  }

  if (skipPublish) {
    // Before publishing, registry tarballs for this version do not exist yet.
    // Development locks resolve coordinated packages to sibling checkouts;
    // published manifests still declare exact registry versions. Never invent
    // registry integrity hashes for artifacts that have not been published.
    if (!dryRun) {
      const byName = Object.fromEntries(packages.map(pkg => [pkg.name, readJson(path.join(rootDir, pkg.dir, 'package.json'))]));
      for (const dir of [...packages.map(pkg => pkg.dir), 'packages/playground', 'packages/playground-nextjs']) {
        const lockFile = path.join(rootDir, dir, 'package-lock.json');
        if (!fs.existsSync(lockFile)) continue;
        const lock = readJson(lockFile);
        const own = readJson(path.join(rootDir, dir, 'package.json'));
        lock.version = own.version;
        Object.assign(lock.packages[''], { version: own.version, dependencies: own.dependencies, devDependencies: own.devDependencies });
        for (const [name, pkg] of Object.entries(byName)) {
          const key = `node_modules/${name}`, local = `../${name}`;
          if (!lock.packages[key] && !lock.packages[local]) continue;
          lock.packages[key] = { resolved: local, link: true };
          lock.packages[local] = { version: pkg.version, license: pkg.license, dependencies: pkg.dependencies, devDependencies: pkg.devDependencies, peerDependencies: pkg.peerDependencies, bin: pkg.bin };
        }
        writeJson(lockFile, lock);
      }
    }
    console.log('Publish skipped.');
    return;
  }

  if (!dryRun && preBuildHashes) {
    const postBuildViolations = [];
    packages.forEach((pkg) => {
      const info = packDryRun(path.join(rootDir, pkg.dir));
      if (info.shasum !== preBuildHashes[pkg.name]) {
        postBuildViolations.push(pkg.name);
      }
    });
    if (postBuildViolations.length > 0) {
      console.error('\nAborting release: the following packages changed after the prepublish gate ran:');
      postBuildViolations.forEach((name) => console.error(`  - ${name}`));
      console.error('This should not happen inside a single release run; re-run the release from a clean state.');
      process.exit(1);
    }
  }

  packages.forEach((pkg) => {
    const pkgDir = path.join(rootDir, pkg.dir);
    const argsList = ['publish', '--access', 'public'];
    if (options.tag) {
      argsList.push('--tag', options.tag);
    }
    if (options.otp) {
      argsList.push('--otp', options.otp);
    }
    try {
      run('npm', argsList, pkgDir, { dryRun });
    } catch (error) {
      console.error('\nPublish failed.');
      console.error('If you use npm 2FA, provide an OTP code:');
      console.error('  NPM_OTP=123456 npm run release:patch');
      console.error('  or: node scripts/release.js --bump patch --otp 123456');
      console.error('If using token-based publish, use a granular token with publish + 2FA bypass enabled.');
      throw error;
    }
  });

  // MIG-B6-28 (D-6): postpublish dist-tag verification is deliberately
  // separate from everything above — publishing already succeeded by this
  // point, so a tag mismatch here is reported as an actionable follow-up,
  // never turned into a script failure that would suggest the release
  // itself failed, and never "fixed" by republishing.
  if (!dryRun) {
    const tagResults = verifyDistTags(packages.map((p) => p.name), version);
    tagResults.forEach((result) => {
      if (!result.checked) {
        console.log(`dist-tags (${result.pkg}): ${result.message}`);
      } else if (result.ok) {
        console.log(`dist-tags (${result.pkg}): latest/beta both at ${version} (confirmed after ${result.attempt} check(s)).`);
      } else {
        console.error(`dist-tags (${result.pkg}): ${result.message}`);
      }
    });
  }

  console.log('Release complete.');
}

module.exports = {
  packages,
  PACK_BUDGETS_KB,
  isValidSemver,
  getChannel,
  bumpSemver,
  packDryRun,
  checkPackBudgets,
  checkExportsPresent,
  checkVersionAlignment,
  verifyDistTags,
  parseArgs,
  main,
};

if (require.main === module) {
  main(process.argv.slice(2));
}
