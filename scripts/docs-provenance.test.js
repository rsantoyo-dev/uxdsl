'use strict';

// MIG-B6-02 (FEAT-008): regression coverage for FEAT-002's coverage-provenance
// claims. FEAT-002 used to say "the integrated fixture verifies responsive
// dependencies in the browser" without naming which fixture, and titled MIG-07
// "Consumidor desde tarball y navegador" even though mig07-consumer/run.js
// never opens a browser or runs css-loader — the real browser evidence lives
// in fixtures/mig02-nextjs-cssmodules/browser.js, invoked by
// `npm run verify:cssmodules-build` after that command first runs MIG-07's
// packaged-consumer fixture. This test keeps FEAT-002 naming its evidence
// explicitly and keeps every doc file free of a same-line claim that
// attributes browser coverage to MIG-07 itself.
//
// It deliberately does not fail on a line that mentions both "MIG-07" (or
// "mig07-consumer") and "browser"/"navegador" when that line is a negation
// ("MIG-07 no ejecuta browser") or names the actual external gate
// (verify:cssmodules-build / mig02) that provides the browser coverage —
// only an unqualified positive attribution is a contradiction.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FEAT_002 = path.join(ROOT, 'docs/features/FEAT-002-beta-migration-hardening.md');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

test('MIG-B6-02: FEAT-002 names every provenance command from the table', () => {
  const content = read('docs/features/FEAT-002-beta-migration-hardening.md');
  assert.match(content, /npm run verify:consumer-fixture/);
  assert.match(content, /npm run verify:cssmodules-build/);
  assert.match(content, /fixtures\/mig02-nextjs-cssmodules\/browser\.js/);
});

test('MIG-B6-02: FEAT-002 contains a provenance table identifying runner, coverage and limits', () => {
  const content = read('docs/features/FEAT-002-beta-migration-hardening.md');
  const headerRow = content.split('\n').find(line =>
    /\|\s*Evidencia\s*\|/.test(line) && /\bComando\b/.test(line) && /\bVerifica\b/.test(line) && /No verifica/.test(line));
  assert.ok(headerRow, 'Expected a "| Evidencia | Comando | Verifica | No verifica |"-shaped table header in FEAT-002.');

  const rows = ['Consumidor de tarball', 'Next.js/CSS Modules', 'Chrome controlado'];
  for (const row of rows) {
    assert.match(content, new RegExp(`\\|\\s*${row}\\s*\\|`), `Expected a provenance row for "${row}".`);
  }
});

test('MIG-B6-02: FEAT-002 no longer makes an ambiguous "integrated fixture" browser claim', () => {
  const content = read('docs/features/FEAT-002-beta-migration-hardening.md');
  assert.doesNotMatch(content, /la fixture integrada verifica/i);
});

test('MIG-B6-02: MIG-07\'s own heading in FEAT-002 does not attribute browser verification to it', () => {
  const content = read('docs/features/FEAT-002-beta-migration-hardening.md');
  const heading = content.split('\n').find(line => /^##\s+MIG-07\b/.test(line));
  assert.ok(heading, 'Expected a "## MIG-07" heading in FEAT-002.');
  assert.doesNotMatch(heading, /navegador|browser/i);
});

test('MIG-B6-02: no doc line attributes browser/navegador coverage to MIG-07 without a negation or an external-gate reference', () => {
  const negationOrGate = /\bno\b|\bnot\b|\bsin\b|does not|doesn't|never|verify:cssmodules-build|mig02/i;
  const targets = [
    'docs/features/FEAT-002-beta-migration-hardening.md',
    'README.md',
    'fixtures/mig07-consumer/README.md',
    'fixtures/mig02-nextjs-cssmodules/README.md',
    ...fs.readdirSync(path.join(ROOT, 'docs/releases')).filter(f => f.endsWith('.md')).map(f => `docs/releases/${f}`),
  ];

  const violations = [];
  for (const relPath of targets) {
    const lines = read(relPath).split('\n');
    lines.forEach((line, index) => {
      const mentionsMig07 = /mig-?07|mig07-consumer/i.test(line);
      const mentionsBrowser = /\bbrowser\b|navegador/i.test(line);
      if (mentionsMig07 && mentionsBrowser && !negationOrGate.test(line)) {
        violations.push(`${relPath}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(violations, [], 'MIG-07 + browser mentioned together without a negation or external-gate reference:\n' + violations.join('\n'));
});

test('MIG-B6-02: fixtures still document what they do not verify, matching FEAT-002\'s provenance table', () => {
  const consumer = read('fixtures/mig07-consumer/README.md');
  assert.match(consumer, /No headless\s+browser\s+is available/i);
  assert.match(consumer, /does not run that loader/i);

  const cssModules = read('fixtures/mig02-nextjs-cssmodules/README.md');
  assert.match(cssModules, /App Router/i);
  assert.match(cssModules, /Pages\s+Router/i);

  const feat002 = read('docs/features/FEAT-002-beta-migration-hardening.md');
  assert.match(feat002, /Next\.js 14.*Pages Router/);
});
