'use strict';

// scripts/audit-themes.mjs — MIG-B7-09 (FEAT-009) made it run at all (a stray `+`
// from a diff had broken it, and nothing ran it); MIG-B7-17 phase B (5) moved it onto
// the shared engine. These tests pin what matters about it now:
//   - it parses, and runs from the package and from the repository root;
//   - its contrast verdict IS the shared gate's: the same count `checkThemeContrast`
//     gives for the same themes, and a failing exit status while that gate fails;
//   - it does not grow its own parsers again (AGENTS.md: "Do not add separate parsers").

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkThemeContrast, resolveTheme } = require('postcss-uxdsl/ds-runtime');
const exceptions = require('postcss-uxdsl/theme/base.contrast-exceptions.json');
const { themes } = require('../themes.js');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_DIR, '..', '..');
const SCRIPT = path.join(PACKAGE_DIR, 'scripts', 'audit-themes.mjs');

const run = (cwd) => spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' });
const expectedFailures = Object.keys(themes).reduce((sum, name) => sum + checkThemeContrast(resolveTheme(themes[name]), { exceptions }).failures.length, 0);

test('audit-themes.mjs parses', () => {
  assert.equal(spawnSync(process.execPath, ['--check', SCRIPT], { encoding: 'utf8' }).status, 0);
});

test('audit-themes.mjs audits every named theme, from the package and from the repo root, and its verdict is the shared gate\'s', () => {
  assert.ok(expectedFailures > 0, 'the shipped themes fail the shared gate today; when that changes, this expectation (exit 1) must flip to exit 0');
  for (const cwd of [PACKAGE_DIR, REPO_ROOT]) {
    const result = run(cwd);
    for (const name of Object.keys(themes)) assert.match(result.stdout, new RegExp(`=== Theme: ${name} ===`), `${name} was not audited from ${cwd}`);
    assert.equal(result.status, 1, `cwd ${cwd}: the script must fail while checkThemeContrast fails, as \`uxdsl theme --contrast\` does`);
    assert.match(result.stderr, /Theme audit FAILED: (\d+) failing contrast pair/);
    assert.equal(Number(/FAILED: (\d+) failing/.exec(result.stderr)[1]), expectedFailures);
  }
});

test('audit-themes.mjs reports each theme\'s own count, the same as checkThemeContrast', () => {
  const { stdout } = run(PACKAGE_DIR);
  for (const name of Object.keys(themes)) {
    const expected = checkThemeContrast(resolveTheme(themes[name]), { exceptions });
    const section = stdout.split(`=== Theme: ${name} ===`)[1].split('=== Theme:')[0];
    assert.match(section, new RegExp(`${expected.checked.length} pairs checked, ${expected.failures.length} failing`));
  }
});

test('audit-themes.mjs keeps using the engine: no private responsive parser, luminance or hex parser', () => {
  const source = fs.readFileSync(SCRIPT, 'utf8');
  for (const name of ['parseResponsive', 'resolveResponsive(', 'relLuminance', 'srgbToLin', 'hexToRgb', 'contrastRatio', 'deepMerge(']) {
    assert.ok(!source.includes(`function ${name.replace('(', '')}`), `audit-themes.mjs defines its own ${name}`);
  }
  for (const used of ['checkThemeContrast', 'resolveTheme', 'resolveTypographyRole', 'resolveResponsiveValue']) {
    assert.match(source, new RegExp(`\\b${used}\\(`), `audit-themes.mjs no longer calls ${used}`);
  }
});
