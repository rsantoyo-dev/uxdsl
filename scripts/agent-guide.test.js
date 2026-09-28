// MIG-B7-15 (FEAT-009): the packaged agent guide is generated from AGENTS.md,
// never a second source, and actually ships in the postcss-uxdsl tarball.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { render, check, SOURCE, TARGET, HEADER } = require('./generate-agent-guide');
const PKG_DIR = path.resolve(__dirname, '..', 'packages', 'postcss-uxdsl');

test('MIG-B7-15: the packaged guide is AGENTS.md byte for byte behind the generated header', () => {
  const copy = fs.readFileSync(TARGET, 'utf8');
  assert.ok(copy.startsWith(HEADER));
  assert.equal(copy.slice(HEADER.length), fs.readFileSync(SOURCE, 'utf8'));
  assert.equal(check(), true);
});

test('MIG-B7-15: --check fails on any drift (negative control)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-agent-guide-'));
  const stale = path.join(dir, 'agent-guide.md');
  fs.writeFileSync(stale, render().replace('Preserve intent, not just the current computed value.', 'Preserve intent.'));
  assert.equal(check(stale), false, 'an edited copy must fail the check');
  fs.writeFileSync(stale, render(fs.readFileSync(SOURCE, 'utf8') + '\nA newer line in AGENTS.md.\n'));
  assert.equal(check(stale), false, 'a copy of an older/newer AGENTS.md must fail the check');
  assert.equal(check(path.join(dir, 'missing.md')), false);

  const script = spawnSync(process.execPath, [path.join(__dirname, 'generate-agent-guide.js'), '--check'], { encoding: 'utf8' });
  assert.equal(script.status, 0, script.stderr);
});

test('MIG-B7-15: the guide is inside the postcss-uxdsl tarball', () => {
  const [info] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: PKG_DIR, encoding: 'utf8' }));
  assert.ok(info.files.some((f) => f.path === 'docs/agent-guide.md'), 'docs/agent-guide.md must be in "files"');
  // Only the guide: the rest of docs/ (migration.md) stays repository-only.
  assert.deepEqual(info.files.filter((f) => f.path.startsWith('docs/')).map((f) => f.path), ['docs/agent-guide.md']);
});
