'use strict';

// MIG-B6-28 (FEAT-008): regression coverage for scripts/release.js's new
// higiene-de-paquetes guards — none of this had any test before (the whole
// script was a top-level, argv-driven side-effecting block; `main()` and
// the checks below did not exist as importable functions).
//
// Two layers, matching the story's own testing instruction ("usando
// procesos/npm falsos, nunca registry real"):
//
// 1. Pure unit tests below call the exported check functions directly,
//    in-process, with injected fake data — fast, no subprocess, no npm.
// 2. A handful of real subprocess tests spawn a COPY of release.js inside
//    a disposable fake monorepo (mirroring scripts/verify-docs-update.test.js's
//    own mkFakeRepo() pattern), with a fake `npm` executable placed first
//    on PATH. This is the only way to prove ordering guarantees like "the
//    preflight gate aborts before any package.json is touched" without
//    calling main() in-process, which would call process.exit() and kill
//    the test runner itself.
//
// The real npm registry is never contacted by anything in this file.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  isValidSemver,
  getChannel,
  bumpSemver,
  parseArgs,
  checkPackBudgets,
  checkExportsPresent,
  checkVersionAlignment,
  verifyDistTags,
} = require('./release');

// ---------------------------------------------------------------------
// Unit tests: pure functions, in-process, no subprocess.
// ---------------------------------------------------------------------

test('MIG-B6-28: isValidSemver accepts stable, beta and the announced rc channel', () => {
  assert.equal(isValidSemver('1.2.3'), true);
  assert.equal(isValidSemver('0.5.0-beta.6'), true);
  assert.equal(isValidSemver('0.5.0-rc.1'), true);
  assert.equal(isValidSemver('not-a-version'), false);
  assert.equal(isValidSemver('1.2'), false);
  assert.equal(isValidSemver('0.5.0-alpha.1'), false);
});

test('MIG-B6-28: getChannel classifies beta/rc/stable and does not misclassify rc as beta', () => {
  assert.equal(getChannel('0.5.0-beta.6'), 'beta');
  assert.equal(getChannel('0.5.0-rc.1'), 'rc');
  assert.equal(getChannel('1.0.0'), 'stable');
});

test('MIG-B6-28: bumpSemver patch/minor/major (unchanged behavior)', () => {
  assert.equal(bumpSemver('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpSemver('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpSemver('1.2.3', 'major'), '2.0.0');
});

test('MIG-B6-28: parseArgs recognizes --check-pack and every existing flag', () => {
  const options = parseArgs(['--version', '1.2.3', '--dry-run', '--skip-publish', '--skip-build', '--tag', 'next', '--otp', '123456', '--note', 'hi']);
  assert.equal(options.version, '1.2.3');
  assert.equal(options.dryRun, true);
  assert.equal(options.skipPublish, true);
  assert.equal(options.skipBuild, true);
  assert.equal(options.tag, 'next');
  assert.equal(options.otp, '123456');
  assert.equal(options.note, 'hi');
  assert.equal(options.checkPack, false);

  assert.equal(parseArgs(['--check-pack']).checkPack, true);
});

test('MIG-B6-28: parseArgs throws (does not process.exit) on an unknown flag', () => {
  assert.throws(() => parseArgs(['--bogus']), /Unknown option: --bogus/);
});

function fakePackages(names) {
  return names.map((name) => ({ name, dir: `packages/${name}`, deps: [] }));
}

test('MIG-B6-28: checkPackBudgets simulates "tamaño excedido" with a fake pack function, never shelling out', () => {
  const packageList = fakePackages(['tiny-pkg', 'huge-pkg']);
  const fakePackDryRun = (pkgDir) => {
    const name = path.basename(pkgDir);
    return name === 'huge-pkg'
      ? { size: 500 * 1024, files: [{ path: 'index.js' }] }
      : { size: 1024, files: [{ path: 'index.js' }] };
  };
  const { results, violations } = checkPackBudgets(packageList, { 'tiny-pkg': 10, 'huge-pkg': 10 }, '/fake-root', {
    packDryRunFn: fakePackDryRun,
  });
  assert.equal(results.length, 2);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].name, 'huge-pkg');
});

test('MIG-B6-28: checkPackBudgets does not flag a package absent from the budget map', () => {
  const packageList = fakePackages(['unbudgeted-pkg']);
  const { violations } = checkPackBudgets(packageList, {}, '/fake-root', {
    packDryRunFn: () => ({ size: 999 * 1024 * 1024, files: [] }),
  });
  assert.equal(violations.length, 0);
});

test('MIG-B6-28: checkExportsPresent simulates "export faltante" for main/types/bin and a wildcard export', () => {
  const packageList = fakePackages(['missing-main', 'missing-wildcard', 'complete-pkg']);
  const fakeReadJson = (pkgFile) => {
    if (pkgFile.includes('missing-main')) {
      return { main: 'dist/index.js', types: 'dist/index.d.ts' };
    }
    if (pkgFile.includes('missing-wildcard')) {
      return { exports: { './theme/*': './src/theme/*' } };
    }
    return { main: 'dist/index.js', exports: { '.': './dist/index.js', './package.json': './package.json' } };
  };
  const fakePackDryRun = (pkgDir) => {
    if (pkgDir.includes('missing-main')) {
      return { files: [{ path: 'dist/index.d.ts' }] }; // index.js itself missing
    }
    if (pkgDir.includes('missing-wildcard')) {
      return { files: [{ path: 'README.md' }] }; // nothing under src/theme/
    }
    return { files: [{ path: 'dist/index.js' }, { path: 'package.json' }] };
  };

  const { results, violations } = checkExportsPresent(packageList, '/fake-root', {
    readJsonFn: fakeReadJson,
    packDryRunFn: fakePackDryRun,
  });

  assert.equal(results.length, 3);
  assert.deepEqual(violations.map((v) => v.name).sort(), ['missing-main', 'missing-wildcard']);
  const missingMain = violations.find((v) => v.name === 'missing-main');
  assert.deepEqual(missingMain.missing, ['dist/index.js']);
  const missingWildcard = violations.find((v) => v.name === 'missing-wildcard');
  assert.deepEqual(missingWildcard.missing, ['src/theme/*']);
});

test('MIG-B6-28: checkExportsPresent never flags package.json itself (npm always includes it)', () => {
  const packageList = fakePackages(['pkg-a']);
  const { violations } = checkExportsPresent(packageList, '/fake-root', {
    readJsonFn: () => ({ exports: { './package.json': './package.json' } }),
    packDryRunFn: () => ({ files: [] }), // package.json deliberately absent from the fake list
  });
  assert.equal(violations.length, 0);
});

test('MIG-B6-28: checkVersionAlignment simulates "versión interna desalineada"', () => {
  const packageList = [
    { name: 'uxdsl-cli', dir: 'packages/uxdsl-cli', deps: ['postcss-uxdsl'] },
  ];
  const fakeReadJson = () => ({
    version: '0.5.0-beta.6',
    dependencies: { 'postcss-uxdsl': '0.5.0-beta.5' }, // stale: bump forgot this one
  });
  const { violations } = checkVersionAlignment(packageList, '/fake-root', '0.5.0-beta.6', {
    readJsonFn: fakeReadJson,
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].field, 'dependencies.postcss-uxdsl');
  assert.equal(violations[0].expected, '0.5.0-beta.6');
  assert.equal(violations[0].actual, '0.5.0-beta.5');
});

test('MIG-B6-28: checkVersionAlignment passes once every coordinated field matches', () => {
  const packageList = [
    { name: 'uxdsl-cli', dir: 'packages/uxdsl-cli', deps: ['postcss-uxdsl'] },
  ];
  const fakeReadJson = () => ({
    version: '0.5.0-beta.6',
    dependencies: { 'postcss-uxdsl': '0.5.0-beta.6' },
  });
  const { violations } = checkVersionAlignment(packageList, '/fake-root', '0.5.0-beta.6', {
    readJsonFn: fakeReadJson,
  });
  assert.equal(violations.length, 0);
});

test('MIG-B6-28: verifyDistTags reports ok once latest/beta both match, without exhausting retries', () => {
  let calls = 0;
  const results = verifyDistTags(['postcss-uxdsl'], '0.5.0-beta.6', {
    npmViewDistTagsFn: () => {
      calls += 1;
      return { latest: '0.5.0-beta.6', beta: '0.5.0-beta.6' };
    },
    retries: 5,
    sleepFn: () => { throw new Error('should not sleep when the first check already matches'); },
  });
  assert.equal(calls, 1);
  assert.equal(results[0].ok, true);
});

test('MIG-B6-28: verifyDistTags simulates "tag incorrecto" and reports remediation, not a republish', () => {
  let sleeps = 0;
  const results = verifyDistTags(['postcss-uxdsl'], '0.5.0-beta.6', {
    npmViewDistTagsFn: () => ({ latest: '0.5.0-beta.5', beta: '0.5.0-beta.6' }),
    retries: 3,
    sleepFn: () => { sleeps += 1; },
  });
  assert.equal(sleeps, 2); // retries between attempts, not after the last one
  const result = results[0];
  assert.equal(result.ok, false);
  assert.match(result.message, /npm dist-tag add postcss-uxdsl@0\.5\.0-beta\.6 latest/);
  assert.doesNotMatch(result.message, /npm publish/);
});

test('MIG-B6-28: verifyDistTags does not apply the beta latest/beta rule to rc or stable, and never calls npm for them', () => {
  const npmViewDistTagsFn = () => { throw new Error('must not be called for a non-beta channel'); };
  const rcResult = verifyDistTags(['postcss-uxdsl'], '0.5.0-rc.1', { npmViewDistTagsFn })[0];
  assert.equal(rcResult.checked, false);
  assert.equal(rcResult.ok, null);
  const stableResult = verifyDistTags(['postcss-uxdsl'], '1.0.0', { npmViewDistTagsFn })[0];
  assert.equal(stableResult.checked, false);
  assert.equal(stableResult.ok, null);
});

// ---------------------------------------------------------------------
// Subprocess tests: a real copy of release.js, a fake `npm` on PATH, a
// disposable fake monorepo. release.js hardcodes its 5 package names/dirs,
// so the fake repo must reproduce those exactly.
// ---------------------------------------------------------------------

const REAL_SCRIPT = path.resolve(__dirname, 'release.js');
const PKG_NAMES = ['postcss-uxdsl', 'uxdsl-core', 'vite-plugin-uxdsl', 'uxdsl-webpack-loader', 'uxdsl-cli'];

function mkFakeMonorepo({ withGenerateStub = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-release-guard-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(REAL_SCRIPT, path.join(dir, 'scripts', 'release.js'));
  if (withGenerateStub) {
    // The real generate-language-artifacts.js needs postcss-uxdsl's compiled
    // dist/; a full-flow test only needs the call site to succeed.
    fs.writeFileSync(path.join(dir, 'scripts', 'generate-language-artifacts.js'), 'process.exit(0);\n');
  }

  PKG_NAMES.forEach((name) => {
    const pkgDir = path.join(dir, 'packages', name);
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name, version: '0.0.1', main: 'index.js' }, null, 2)
    );
    fs.writeFileSync(path.join(pkgDir, 'index.js'), '// fake\n');
  });

  return dir;
}

// A fake `npm` executable (real file named exactly `npm`, no extension, a
// node shebang) placed first on PATH. Every scenario is driven entirely by
// env vars so one script serves every test below — never the real registry,
// never a real pack/build/publish.
const FAKE_NPM_SOURCE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const args = process.argv.slice(2);

// cwd is always <repo>/packages/<name> for the commands release.js runs
// per package, so the fake repo root is two levels up.
const repoRoot = path.resolve(process.cwd(), '..', '..');
const mutationMarker = path.join(repoRoot, '.fake-npm-mutated');
const publishLog = path.join(repoRoot, '.fake-npm-published');

function readOwnPackageText() {
  try { return fs.readFileSync('package.json', 'utf8'); } catch { return ''; }
}
function readOwnPackageName() {
  try { return JSON.parse(readOwnPackageText()).name; } catch { return null; }
}

if (args[0] === 'pack' && args.includes('--dry-run')) {
  const name = readOwnPackageName();
  const oversizePkg = process.env.FAKE_NPM_OVERSIZE_PKG;
  const missingExportPkg = process.env.FAKE_NPM_MISSING_EXPORT_PKG;
  const size = name === oversizePkg ? 999 * 1024 * 1024 : 1024;
  const files = name === missingExportPkg
    ? [{ path: 'package.json', size: 100 }]
    : [{ path: 'package.json', size: 100 }, { path: 'index.js', size: 200 }];
  // Content-derived, like real npm's reproducible pack: a version bump or a
  // simulated source mutation changes the shasum. A constant here would
  // silently mask any bug in release.js's hash comparison.
  const mutated = fs.existsSync(mutationMarker) ? 'mutated' : '';
  const shasum = crypto.createHash('sha1').update(readOwnPackageText() + mutated).digest('hex');
  process.stdout.write(JSON.stringify([{ name, version: '0.0.1', size, unpackedSize: size, shasum, files }]));
  process.exit(0);
}
if (args[0] === 'run' && args[1] === 'build') {
  process.exit(0);
}
if (args[0] === 'whoami') {
  process.stdout.write('fake-user\\n');
  process.exit(0);
}
if (args[0] === 'owner' && args[1] === 'ls') {
  process.stdout.write('fake-user <fake@example.com>\\n');
  process.exit(0);
}
if (args[0] === 'publish') {
  const name = readOwnPackageName();
  if (name === process.env.FAKE_NPM_FAIL_PUBLISH_PKG) {
    process.stderr.write('fake-npm: simulated publish failure\\n');
    process.exit(1);
  }
  fs.appendFileSync(publishLog, name + '\\n');
  // Simulates a source change landing on disk while the publish loop is
  // already running — after this, every later pack --dry-run hashes differently.
  if (process.env.FAKE_NPM_MUTATE_ON_FIRST_PUBLISH && !fs.existsSync(mutationMarker)) {
    fs.writeFileSync(mutationMarker, '');
  }
  process.exit(0);
}
if (args[0] === 'view' && args.includes('dist-tags')) {
  process.stdout.write(JSON.stringify({ latest: process.env.FAKE_NPM_LATEST || '0.0.1', beta: process.env.FAKE_NPM_BETA || '0.0.1' }));
  process.exit(0);
}
process.stderr.write('fake-npm: unhandled invocation: ' + args.join(' ') + '\\n');
process.exit(1);
`;

function installFakeNpm(dir) {
  const binDir = path.join(dir, 'fake-npm-bin');
  fs.mkdirSync(binDir, { recursive: true });
  const npmPath = path.join(binDir, 'npm');
  fs.writeFileSync(npmPath, FAKE_NPM_SOURCE);
  fs.chmodSync(npmPath, 0o755);
  return binDir;
}

function runRelease(repoDir, args, env = {}) {
  const binDir = installFakeNpm(repoDir);
  return spawnSync(process.execPath, [path.join(repoDir, 'scripts', 'release.js'), ...args], {
    cwd: repoDir,
    encoding: 'utf8',
    env: { ...process.env, ...env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
  });
}

function readFakeVersion(repoDir, name) {
  return JSON.parse(fs.readFileSync(path.join(repoDir, 'packages', name, 'package.json'), 'utf8')).version;
}

function publishedPackages(repoDir) {
  const logFile = path.join(repoDir, '.fake-npm-published');
  if (!fs.existsSync(logFile)) return [];
  return fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
}

test('MIG-B6-28 (subprocess, fake npm): the preflight gate aborts an oversized package before any file is touched, and accepts an rc version string', () => {
  const dir = mkFakeMonorepo();
  const result = runRelease(dir, ['--version', '0.9.0-rc.1', '--skip-publish'], {
    FAKE_NPM_OVERSIZE_PKG: 'uxdsl-webpack-loader',
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr + result.stdout, /Pack budget exceeded/);
  assert.match(result.stderr + result.stdout, /uxdsl-webpack-loader/);
  assert.match(result.stderr, /Aborting release/);
  // The whole point of a *preflight* gate: nothing was bumped, anywhere.
  PKG_NAMES.forEach((name) => assert.equal(readFakeVersion(dir, name), '0.0.1', `${name} must not have been bumped`));
});

test('MIG-B6-28 (subprocess, fake npm): the preflight gate aborts on a declared export missing from the tarball, before any file is touched', () => {
  const dir = mkFakeMonorepo();
  const result = runRelease(dir, ['--version', '0.9.0-rc.1', '--skip-publish'], {
    FAKE_NPM_MISSING_EXPORT_PKG: 'uxdsl-core',
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr + result.stdout, /missing from the tarball/);
  assert.match(result.stderr + result.stdout, /uxdsl-core/);
  PKG_NAMES.forEach((name) => assert.equal(readFakeVersion(dir, name), '0.0.1', `${name} must not have been bumped`));
});

test('MIG-B6-28 (subprocess, fake npm): a real publish failure ("publicación parcial") stops immediately and does not attempt the remaining packages', () => {
  const dir = mkFakeMonorepo();
  // uxdsl-core is the 2nd package in release.js's own publish order; a
  // failure there must stop vite-plugin-uxdsl/uxdsl-webpack-loader/
  // uxdsl-cli from ever being attempted. --skip-build sidesteps the
  // unrelated generate-language-artifacts.js call, which does not exist in
  // this minimal fake repo and is not what this test is about.
  const result = runRelease(dir, ['--version', '9.9.9', '--skip-build'], {
    FAKE_NPM_FAIL_PUBLISH_PKG: 'uxdsl-core',
  });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Publish failed/);
  assert.match(result.stderr, /simulated publish failure/);
  // Exactly the first package reached the registry; the failing 2nd one and
  // the three after it were never attempted.
  assert.deepEqual(publishedPackages(dir), ['postcss-uxdsl']);
  // Every package.json was still bumped for real (the version-bump loop
  // runs before publishing starts) — only the *publish step itself* is
  // partial, which is exactly the state a human operator needs to see
  // accurately to know what still needs `npm publish` run by hand.
  PKG_NAMES.forEach((name) => assert.equal(readFakeVersion(dir, name), '9.9.9'));
});

test('MIG-B6-28 (subprocess, fake npm): a clean full release — no --dry-run/--skip-build/--skip-publish — publishes all five packages and completes', () => {
  // Regression: the first version of this story recorded each tarball's
  // shasum *before* the version-bump loop rewrote every package.json (and
  // before generate-language-artifacts rewrote theme-manifest.json, which
  // ships), then compared *after* — so every real release aborted with
  // "changed after the prepublish gate ran" before publishing anything.
  // None of the other subprocess tests reach a real publish with a real
  // build path, and the fake npm used to return a constant shasum, which
  // would have masked it even if they had.
  const dir = mkFakeMonorepo({ withGenerateStub: true });
  const result = runRelease(dir, ['--version', '9.9.9']);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Release complete/);
  assert.deepEqual(publishedPackages(dir), PKG_NAMES);
  PKG_NAMES.forEach((name) => {
    assert.equal(readFakeVersion(dir, name), '9.9.9');
    assert.match(result.stdout, new RegExp(`validated ${name}@9\\.9\\.9: .*shasum [0-9a-f]{40}`));
  });
});

test('MIG-B6-28 (subprocess, fake npm): a source change landing between validation and publish stops the loop before the affected package is published', () => {
  const dir = mkFakeMonorepo({ withGenerateStub: true });
  const result = runRelease(dir, ['--version', '9.9.9'], { FAKE_NPM_MUTATE_ON_FIRST_PUBLISH: '1' });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  // The mutation lands while publishing the 1st package; the 2nd package's
  // own pre-publish recheck is the one that sees a different tarball.
  assert.match(result.stderr, /uxdsl-core changed after it was validated/);
  assert.match(result.stderr, /Already published: postcss-uxdsl/);
  assert.match(result.stderr, /Not published: uxdsl-core, vite-plugin-uxdsl, uxdsl-webpack-loader, uxdsl-cli/);
  assert.doesNotMatch(result.stderr, /npm publish/);
  assert.deepEqual(publishedPackages(dir), ['postcss-uxdsl']);
});

test('MIG-B6-28 (subprocess, fake npm): --check-pack is a real, local, side-effect-free check that needs no --version at all', () => {
  const dir = mkFakeMonorepo();
  const okResult = runRelease(dir, ['--check-pack', '--skip-build']);
  assert.equal(okResult.status, 0, okResult.stdout + okResult.stderr);
  assert.match(okResult.stdout, /ok/);
  PKG_NAMES.forEach((name) => assert.equal(readFakeVersion(dir, name), '0.0.1'));

  const overResult = runRelease(dir, ['--check-pack', '--skip-build'], { FAKE_NPM_OVERSIZE_PKG: 'postcss-uxdsl' });
  assert.equal(overResult.status, 1, overResult.stdout + overResult.stderr);
  assert.match(overResult.stdout, /OVER BUDGET/);
  PKG_NAMES.forEach((name) => assert.equal(readFakeVersion(dir, name), '0.0.1'));
});
