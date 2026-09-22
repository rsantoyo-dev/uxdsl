const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(packageRoot, 'src/theme/theme-manifest.json');

// MIG-B6-28 (FEAT-008): theme-manifest.json's `defaults.files` pointed
// consumers at `src/theme/default-motion.css`, which has never existed —
// a real dead reference nothing caught until this test. `npm pack
// --dry-run --json` is the same command the story's own reproduction and
// scripts/release.js's pack-budget check use: the *actual* tarball file
// list, not a directory listing that could diverge from what `files` in
// package.json really ships.
function packedFilePaths() {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const [{ files }] = JSON.parse(result.stdout);
  return new Set(files.map((f) => f.path));
}

test('MIG-B6-28: every defaults.files path in theme-manifest.json exists inside the real npm tarball', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const packed = packedFilePaths();

  for (const [key, relPath] of Object.entries(manifest.defaults.files)) {
    assert.ok(
      packed.has(relPath),
      `defaults.files.${key} = "${relPath}" is not in the packed tarball`
    );
    assert.ok(
      fs.existsSync(path.join(packageRoot, relPath)),
      `defaults.files.${key} = "${relPath}" does not exist on disk`
    );
  }
});

test('MIG-B6-28: the previously-shipped "motion" dead path is gone, not just skipped', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(
    'motion' in manifest.defaults.files,
    false,
    'defaults.files.motion should have been removed (src/theme/default-motion.css never existed)'
  );
});

test('MIG-B6-28 (negative control): a manifest entry pointing at a real dead path is detected as missing', () => {
  const packed = packedFilePaths();
  const fakeDeadPath = 'src/theme/default-motion.css';
  assert.equal(
    packed.has(fakeDeadPath),
    false,
    'sanity check: this path must not exist, or the positive assertions above would not be meaningful'
  );
});
