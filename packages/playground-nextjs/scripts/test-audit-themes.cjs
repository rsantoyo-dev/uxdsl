'use strict';

// MIG-B7-09 (FEAT-009): scripts/audit-themes.mjs was syntactically broken (a stray
// `+` from a diff, before `const map = {}`) and nobody noticed, because nothing runs
// it. This runs it, and pins two things beyond "it no longer throws": that it works
// from any directory, and that its verdict does not read as "accessible" while the
// shared WCAG gate says the shipped themes fail.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkThemeContrast, resolveTheme } = require('postcss-uxdsl/ds-runtime');
const exceptions = require('postcss-uxdsl/theme/base.contrast-exceptions.json');
const { themes } = require('../themes.js');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_DIR, '..', '..');
const SCRIPT = path.join(PACKAGE_DIR, 'scripts', 'audit-themes.mjs');

const run = (cwd) => spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' });

test('audit-themes.mjs parses; a stray `+` before a statement (the original defect) does not', () => {
  assert.equal(spawnSync(process.execPath, ['--check', SCRIPT], { encoding: 'utf8' }).status, 0);

  const broken = fs.readFileSync(SCRIPT, 'utf8').replace("  if (!val) return { kind: 'missing' };\n\n  const map = {};", "  if (!val) return { kind: 'missing' };\n+\n  const map = {};");
  assert.notEqual(broken, fs.readFileSync(SCRIPT, 'utf8'), 'the mutation must actually change the script');
  const file = path.join(os.tmpdir(), `audit-themes-broken-${process.pid}.mjs`);
  fs.writeFileSync(file, broken);
  try {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unexpected token 'const'/, 'negative control: this is the exact SyntaxError that was reported');
  } finally { fs.rmSync(file, { force: true }); }
});

test('audit-themes.mjs audits all four named themes and exits 0, from the package and from the repo root', () => {
  for (const cwd of [PACKAGE_DIR, REPO_ROOT]) {
    const result = run(cwd);
    assert.equal(result.status, 0, `cwd ${cwd}: ${result.stderr}`);
    for (const name of ['default', 'green', 'purple', 'slate']) assert.match(result.stdout, new RegExp(`=== Theme: ${name} ===`), `${name} was not audited from ${cwd}`);
    assert.match(result.stdout, /Palette audit PASSED/);
  }
});

test('audit-themes.mjs does not read as "accessible": it discloses the shared gate\'s failure count, and that count is the real one', () => {
  const expected = Object.keys(themes).reduce((sum, name) => sum + checkThemeContrast(resolveTheme(themes[name]), { exceptions }).failures.length, 0);
  assert.ok(expected > 0, 'the shipped themes do fail the shared gate today; if that changes, this test and the script\'s disclosure should be revisited');
  const { stdout } = run(PACKAGE_DIR);
  assert.match(stdout, /Not the full accessibility gate: it reports (\d+) failing pair\(s\)/);
  assert.equal(Number(/reports (\d+) failing pair/.exec(stdout)[1]), expected);
  assert.doesNotMatch(stdout, /Accessibility audit PASSED/, 'the old wording claimed an accessibility verdict this script cannot give');
});
