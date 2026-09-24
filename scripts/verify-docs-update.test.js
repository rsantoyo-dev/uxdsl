'use strict';

// MIG-B3-05 (FEAT-004): regression coverage for verify-docs-update.js's
// pre-commit guard, including the new visual-default-files rule it did not
// have before (a change to default-theme.ts/typography-defaults.ts/
// typography.ts requires postcss-uxdsl's own CHANGELOG.md to be staged,
// not just any README — beta.2's unannounced h2/h3 line-height change is
// exactly the gap this closes).
//
// The script resolves its own repo root from `__dirname`, not `cwd` — so
// each test copies it into a disposable, real git repo instead of trying
// to run it against a mocked filesystem or (worse) staging real changes in
// this repo's own git index.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REAL_SCRIPT = path.resolve(__dirname, 'verify-docs-update.js');

function git(dir, args) {
  execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
}

function mkFakeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-docs-guard-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);

  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(REAL_SCRIPT, path.join(dir, 'scripts', 'verify-docs-update.js'));

  const pkgDir = path.join(dir, 'packages', 'postcss-uxdsl');
  fs.mkdirSync(path.join(pkgDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'postcss-uxdsl', version: '0.0.0' }));
  fs.writeFileSync(path.join(pkgDir, 'README.md'), '# readme\n');
  fs.writeFileSync(path.join(pkgDir, 'CHANGELOG.md'), '# changelog\n');
  fs.writeFileSync(path.join(pkgDir, 'src', 'typography.ts'), '// typography\n');
  fs.writeFileSync(path.join(pkgDir, 'src', 'other.ts'), '// other\n');

  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'initial']);
  return { dir, pkgDir };
}

function stage(dir, ...relFiles) {
  git(dir, ['add', ...relFiles]);
}

function runGuard(dir) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts', 'verify-docs-update.js')], { cwd: dir, encoding: 'utf8' });
}

test('MIG-B3-05: an ordinary package code change with no README staged fails', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.appendFileSync(path.join(pkgDir, 'src', 'other.ts'), '// edit\n');
  stage(dir, 'packages/postcss-uxdsl/src/other.ts');
  const result = runGuard(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Documentation update required/);
});

test('MIG-B3-05: the same change with the package README staged passes (no visual-default file touched)', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.appendFileSync(path.join(pkgDir, 'src', 'other.ts'), '// edit\n');
  fs.appendFileSync(path.join(pkgDir, 'README.md'), '\nnote\n');
  stage(dir, 'packages/postcss-uxdsl/src/other.ts', 'packages/postcss-uxdsl/README.md');
  const result = runGuard(dir);
  assert.equal(result.status, 0, result.stderr);
});

test('MIG-B3-05: editing typography.ts with README staged but no CHANGELOG still fails', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.appendFileSync(path.join(pkgDir, 'src', 'typography.ts'), '// edit\n');
  fs.appendFileSync(path.join(pkgDir, 'README.md'), '\nnote\n');
  stage(dir, 'packages/postcss-uxdsl/src/typography.ts', 'packages/postcss-uxdsl/README.md');
  const result = runGuard(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Visual-default change without a CHANGELOG note/);
  assert.match(result.stderr, /typography\.ts/);
});

test('MIG-B3-05: editing typography.ts with both README and CHANGELOG staged passes', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.appendFileSync(path.join(pkgDir, 'src', 'typography.ts'), '// edit\n');
  fs.appendFileSync(path.join(pkgDir, 'README.md'), '\nnote\n');
  fs.appendFileSync(path.join(pkgDir, 'CHANGELOG.md'), '\n## note\n');
  stage(dir, 'packages/postcss-uxdsl/src/typography.ts', 'packages/postcss-uxdsl/README.md', 'packages/postcss-uxdsl/CHANGELOG.md');
  const result = runGuard(dir);
  assert.equal(result.status, 0, result.stderr);
});

// MIG-B6-17 (FEAT-008) deleted `typography-defaults.ts` (its DEFAULT_TYPOGRAPHY
// map lost its last importer when @ds-typo stopped inventing values), so this
// now pairs default-theme.ts with typography.ts — the other visual-default
// source file that is still real — instead of a path that no longer exists.
test('MIG-B3-05: default-theme.ts and typography.ts are covered by the same guard', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.writeFileSync(path.join(pkgDir, 'src', 'default-theme.ts'), '// default theme\n');
  fs.writeFileSync(path.join(pkgDir, 'src', 'typography.ts'), '// typography\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'add visual-default files']);

  fs.appendFileSync(path.join(pkgDir, 'src', 'default-theme.ts'), '// edit\n');
  fs.appendFileSync(path.join(pkgDir, 'README.md'), '\nnote\n');
  stage(dir, 'packages/postcss-uxdsl/src/default-theme.ts', 'packages/postcss-uxdsl/README.md');
  const result = runGuard(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Visual-default change without a CHANGELOG note/);
  assert.match(result.stderr, /default-theme\.ts/);
});

test('MIG-B6-29: theme/base.json is covered by the same guard', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.mkdirSync(path.join(pkgDir, 'src', 'theme'), { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'src', 'theme', 'base.json'), '{}\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'add base.json']);

  fs.writeFileSync(path.join(pkgDir, 'src', 'theme', 'base.json'), '{"spacing":{}}\n');
  fs.appendFileSync(path.join(pkgDir, 'README.md'), '\nnote\n');
  stage(dir, 'packages/postcss-uxdsl/src/theme/base.json', 'packages/postcss-uxdsl/README.md');
  const result = runGuard(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Visual-default change without a CHANGELOG note/);
  assert.match(result.stderr, /theme\/base\.json/);
});

test('MIG-B3-05: a docs-only change (README/CHANGELOG/docs) never requires further docs', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.appendFileSync(path.join(pkgDir, 'CHANGELOG.md'), '\n## note\n');
  stage(dir, 'packages/postcss-uxdsl/CHANGELOG.md');
  const result = runGuard(dir);
  assert.equal(result.status, 0, result.stderr);
});

test('MIG-B6-30: a lockfile sync alone does not demand a README note, but package.json still does', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.writeFileSync(path.join(pkgDir, 'package-lock.json'), '{"lockfileVersion":3}\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'add lockfile']);

  // Adding a devDependency to one package rewrites its siblings' lockfiles;
  // there is no consumer-facing note to write for that.
  fs.writeFileSync(path.join(pkgDir, 'package-lock.json'), '{"lockfileVersion":3,"synced":true}\n');
  stage(dir, 'packages/postcss-uxdsl/package-lock.json');
  assert.equal(runGuard(dir).status, 0, 'a lockfile-only change should not require a README');

  // The real dependency declaration is still guarded.
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'postcss-uxdsl', version: '0.0.1' }));
  stage(dir, 'packages/postcss-uxdsl/package.json');
  assert.notEqual(runGuard(dir).status, 0, 'a package.json change must still require a docs note');
});

// --- MIG-B7-16 (FEAT-009): engines are covered, and the classification is complete ---

const { VISUAL_DEFAULT_FILES, NON_VISUAL_SOURCE_FILES } = require('./verify-docs-update.js');
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = 'packages/postcss-uxdsl/src';

function sourceFiles(dir = SRC_DIR) {
  // Hidden files (.DS_Store) are not source. Untracked files still count, so a new
  // engine is caught before it is ever staged.
  return fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true }).filter((entry) => !entry.name.startsWith('.')).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(rel) : [rel];
  });
}

test('MIG-B7-16: every file under postcss-uxdsl/src is classified — visual or not-visual, never neither, never both', () => {
  const visual = new Set(VISUAL_DEFAULT_FILES);
  const nonVisual = new Set(Object.keys(NON_VISUAL_SOURCE_FILES));
  const unclassified = sourceFiles().filter((file) => !visual.has(file) && !nonVisual.has(file));
  assert.deepEqual(unclassified, [], 'a new source file must be added to VISUAL_DEFAULT_FILES, or to NON_VISUAL_SOURCE_FILES with a reason, in scripts/verify-docs-update.js');
  assert.deepEqual([...visual].filter((file) => nonVisual.has(file)), [], 'a file cannot be both');
});

test('MIG-B7-16: neither list carries a dead entry (a path that no longer exists guards nothing)', () => {
  for (const file of [...VISUAL_DEFAULT_FILES, ...Object.keys(NON_VISUAL_SOURCE_FILES)]) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, file)), `${file} is listed but does not exist`);
  }
});

test('MIG-B7-16: every not-visual file says why, in terms of compiled output', () => {
  for (const [file, reason] of Object.entries(NON_VISUAL_SOURCE_FILES)) {
    assert.ok(typeof reason === 'string' && reason.trim().length >= 20, `${file} needs a reason`);
  }
});

test('MIG-B7-16: the engines that turn defaults into CSS are guarded — the files whose changes went unannounced', () => {
  for (const engine of ['control-engine.ts', 'index.ts', 'fonts.ts', 'surfaces.ts', 'ds-runtime/theme-generator.ts']) {
    assert.ok(VISUAL_DEFAULT_FILES.includes(`${SRC_DIR}/${engine}`), `${engine} must be a guarded visual-default file`);
  }
});

test('MIG-B7-16: editing an engine with README staged but no CHANGELOG fails; with the CHANGELOG it passes', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.writeFileSync(path.join(pkgDir, 'src', 'control-engine.ts'), '// engine\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'add engine']);

  fs.appendFileSync(path.join(pkgDir, 'src', 'control-engine.ts'), '// edit\n');
  fs.appendFileSync(path.join(pkgDir, 'README.md'), '\nnote\n');
  stage(dir, 'packages/postcss-uxdsl/src/control-engine.ts', 'packages/postcss-uxdsl/README.md');
  const blocked = runGuard(dir);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /Visual-default change without a CHANGELOG note/);
  assert.match(blocked.stderr, /control-engine\.ts/);

  fs.appendFileSync(path.join(pkgDir, 'CHANGELOG.md'), '\n## note\n');
  stage(dir, 'packages/postcss-uxdsl/CHANGELOG.md');
  assert.equal(runGuard(dir).status, 0);
});

test('MIG-B7-16: a not-visual file (diagnostics.ts) still needs only a README, as before', () => {
  const { dir, pkgDir } = mkFakeRepo();
  fs.writeFileSync(path.join(pkgDir, 'src', 'diagnostics.ts'), '// diagnostics\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'add diagnostics']);

  fs.appendFileSync(path.join(pkgDir, 'src', 'diagnostics.ts'), '// edit\n');
  fs.appendFileSync(path.join(pkgDir, 'README.md'), '\nnote\n');
  stage(dir, 'packages/postcss-uxdsl/src/diagnostics.ts', 'packages/postcss-uxdsl/README.md');
  assert.equal(runGuard(dir).status, 0);
});
