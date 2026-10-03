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
const reports = Object.fromEntries(Object.keys(themes).map((name) => [name, checkThemeContrast(resolveTheme(themes[name]), { exceptions })]));
const expectedFailures = Object.values(reports).reduce((sum, report) => sum + report.failures.length, 0);
const expectedExcepted = Object.values(reports).reduce((sum, report) => sum + report.excepted.length, 0);

test('audit-themes.mjs parses', () => {
  assert.equal(spawnSync(process.execPath, ['--check', SCRIPT], { encoding: 'utf8' }).status, 0);
});

test('audit-themes.mjs audits every named theme, from the package and from the repo root, and its verdict is the shared gate\'s', () => {
  // Stability phase 5: every shipped theme passes the shared gate (with the
  // packaged pattern exceptions), so the script exits 0 — and says how many
  // pairs were excepted rather than letting exit 0 read as "all passed".
  assert.equal(expectedFailures, 0, 'the shipped themes pass the shared gate; a failing one is a regression of its values');
  assert.ok(expectedExcepted > 0);
  for (const cwd of [PACKAGE_DIR, REPO_ROOT]) {
    const result = run(cwd);
    for (const name of Object.keys(themes)) assert.match(result.stdout, new RegExp(`=== Theme: ${name} ===`), `${name} was not audited from ${cwd}`);
    assert.equal(result.status, 0, `cwd ${cwd}: the script must pass while checkThemeContrast passes, as \`uxdsl theme --contrast\` does: ${result.stderr}`);
    assert.match(result.stdout, new RegExp(`Theme audit PASSED: 0 failing contrast pairs; ${expectedExcepted} excepted pair\\(s\\)`));
  }
});

test('audit-themes.mjs still fails, as the gate does, when a theme regresses', async () => {
  // Negative control: the default theme with `warning` put back to its values
  // before this phase, run through the real gate and the script's own verdict.
  const { contrastVerdict } = await import('./audit-themes.mjs');
  const regressed = checkThemeContrast(resolveTheme({ ...themes.default, palette: { ...themes.default.palette, warning: { main: '#d97706', light: '#fbbf24', dark: '#c25e0a', contrast: '#000000' } } }), { exceptions });
  assert.ok(regressed.failures.length > 0, 'the old warning values fail the gate');
  const verdict = contrastVerdict([regressed, ...Object.values(reports)]);
  assert.equal(verdict.passed, false);
  assert.equal(verdict.failures, regressed.failures.length);
});

test('audit-themes.mjs reports each theme\'s own count, the same as checkThemeContrast', () => {
  const { stdout } = run(PACKAGE_DIR);
  for (const name of Object.keys(themes)) {
    const expected = checkThemeContrast(resolveTheme(themes[name]), { exceptions });
    const section = stdout.split(`=== Theme: ${name} ===`)[1].split('=== Theme:')[0];
    assert.match(section, new RegExp(`${expected.checked.length} pairs checked, ${expected.failures.length} failing`));
  }
});

test('audit-themes.mjs rejects an invalid exception even when no ordinary contrast failures remain', async () => {
  const { contrastVerdict } = await import('./audit-themes.mjs');
  assert.deepEqual(contrastVerdict([{ passed: false, failures: [], excepted: [], exceptionIssues: ['stale exception'] }]), {
    failures: 0,
    excepted: 0,
    exceptionIssues: 1,
    passed: false,
  });
});

test('audit-themes.mjs counts excepted pairs separately from failing ones, and prints both per theme', async () => {
  const { contrastVerdict } = await import('./audit-themes.mjs');
  assert.deepEqual(contrastVerdict([
    { passed: true, failures: [], excepted: [{}, {}], exceptionIssues: [] },
    { passed: true, failures: [], excepted: [{}], exceptionIssues: [] },
  ]), { failures: 0, excepted: 3, exceptionIssues: 0, passed: true });

  const { stdout } = run(PACKAGE_DIR);
  for (const name of Object.keys(themes)) {
    const expected = checkThemeContrast(resolveTheme(themes[name]), { exceptions });
    const section = stdout.split(`=== Theme: ${name} ===`)[1].split('=== Theme:')[0];
    assert.match(section, new RegExp(`${expected.failures.length} failing, ${expected.excepted.length} excepted \\(failing, covered by an exception, not counted as passing\\)`));
    for (const exception of expected.exceptions) {
      assert.ok(section.includes(`exception ${exception.id} (${exception.kind}): ${exception.matched ? `covers ${exception.covered}` : 'matches nothing'}`), `${name}: ${exception.id} is not reported`);
    }
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
