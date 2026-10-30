'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { auditLockfile } = require('./run');
const { PACKAGE_DIR } = require('../lib/tarball-consumer');

// The release gate's `AUDIT-lock` check audits the repository's own
// `packages/uxdsl/package-lock.json` (not a fresh install) and accepts nothing
// of any severity. Both tests ask the npm registry's advisory endpoint, as the
// gate does; without the registry they fail rather than pass unmeasured.

/** A copy of the package's manifest and lockfile in a temp dir, with one pinned version rewritten. */
function lockfileCopyPinning(name, version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-audit-lock-'));
  fs.copyFileSync(path.join(PACKAGE_DIR, 'package.json'), path.join(dir, 'package.json'));
  const lock = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'package-lock.json'), 'utf8'));
  const entry = lock.packages[`node_modules/${name}`];
  assert.ok(entry, `${name} must be in the lockfile for the control to mean anything`);
  entry.version = version;
  entry.resolved = `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`;
  delete entry.integrity;
  fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(lock, null, 2));
  return dir;
}

test('MIG-B9-02: AUDIT-lock — the lockfile packages/uxdsl builds and tests from reports 0 vulnerabilities, dev dependencies included', () => {
  assert.equal(auditLockfile(PACKAGE_DIR), '0 critical, 0 high, 0 moderate, 0 low');
});

test('MIG-B9-02: AUDIT-lock fails when the lockfile pins source-map-js 1.2.1 (negative control)', () => {
  const dir = lockfileCopyPinning('source-map-js', '1.2.1');
  assert.throws(() => auditLockfile(dir), (error) => {
    assert.match(error.message, /source-map-js \(high\)/, `the pinned advisory must be named: ${error.message}`);
    return true;
  });
});
