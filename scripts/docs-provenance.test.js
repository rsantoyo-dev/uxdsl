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
// A first version of this test only checked that each table row's label
// existed anywhere in the file and that some line, somewhere, mentioned a
// negation word — a code review pointed out both gaps: (1) swapping which
// row claims Chrome coverage still passed, because nothing checked a row's
// own cell contents; (2) a line like "MIG-07 verifica browser sin
// limitaciones." also passed, because a bare "sin"/"no" anywhere on the
// line counted as a qualifying negation regardless of what it negated. Both
// are fixed below: the table test extracts and asserts on each row's own
// cells, and the contradiction scan delegates to
// scripts/lib/doc-provenance-checks.js, which has its own permanent
// positive/negative fixtures further down in this file.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isUnqualifiedMig07BrowserClaim } = require('./lib/doc-provenance-checks');

const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** Finds the single table row whose first cell is exactly `label` and
 * returns its cells, trimmed, without the leading/trailing empty cells a
 * `| a | b |`-style line produces when split on `|`. Fails loudly (instead
 * of returning undefined) when the row is missing or duplicated, so a typo
 * in a row label can't silently make the row's assertions vacuous. */
function tableRow(content, label) {
  const matches = content.split('\n').filter(line => new RegExp(`^\\|\\s*${label}\\s*\\|`).test(line));
  assert.equal(matches.length, 1, `Expected exactly one provenance row for "${label}", found ${matches.length}.`);
  const cells = matches[0].split('|').map(cell => cell.trim());
  return cells.slice(1, -1);
}

test('MIG-B6-02: FEAT-002 names every provenance command from the table', () => {
  const content = read('docs/features/FEAT-002-beta-migration-hardening.md');
  assert.match(content, /npm run verify:consumer-fixture/);
  assert.match(content, /npm run verify:cssmodules-build/);
  assert.match(content, /fixtures\/mig02-nextjs-cssmodules\/browser\.js/);
});

test('MIG-B6-02: the tarball row claims install/build coverage, not Chrome', () => {
  const content = read('docs/features/FEAT-002-beta-migration-hardening.md');
  const [, comando, verifica, noVerifica] = tableRow(content, 'Consumidor de tarball');
  assert.match(comando, /verify:consumer-fixture/);
  assert.match(verifica, /npm pack|instalaci[óo]n/i);
  assert.doesNotMatch(verifica, /chrome/i, 'Chrome coverage belongs to the "Chrome controlado" row, not the tarball row.');
  assert.match(noVerifica, /navegador|browser|chrome/i);
});

test('MIG-B6-02: the Next.js/CSS Modules row claims the production build, not Chrome, and names its gaps', () => {
  const content = read('docs/features/FEAT-002-beta-migration-hardening.md');
  const [, comando, verifica, noVerifica] = tableRow(content, 'Next.js/CSS Modules');
  assert.match(comando, /verify:cssmodules-build/);
  assert.match(verifica, /next\.js 14/i);
  assert.doesNotMatch(verifica, /chrome/i, 'Chrome coverage belongs to the "Chrome controlado" row.');
  assert.match(noVerifica, /app router/i);
  assert.match(noVerifica, /next\.js 16/i);
});

test('MIG-B6-02: the Chrome row is the one that actually claims Chrome/computed-style coverage', () => {
  const content = read('docs/features/FEAT-002-beta-migration-hardening.md');
  const [, comando, verifica, noVerifica] = tableRow(content, 'Chrome controlado');
  assert.match(comando, /browser\.js/);
  assert.match(verifica, /computed styles/i);
  assert.match(noVerifica, /auditor[ií]a visual/i);
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

test('MIG-B6-02: no doc line attributes browser/navegador coverage to MIG-07 without a qualifying negation or gate reference', () => {
  const targets = [
    'docs/features/FEAT-002-beta-migration-hardening.md',
    'README.md',
    'fixtures/mig07-consumer/README.md',
    'fixtures/mig02-nextjs-cssmodules/README.md',
    ...fs.readdirSync(path.join(ROOT, 'docs/releases')).filter(f => f.endsWith('.md')).map(f => `docs/releases/${f}`),
  ];

  const violations = [];
  for (const relPath of targets) {
    read(relPath).split('\n').forEach((line, index) => {
      if (isUnqualifiedMig07BrowserClaim(line)) violations.push(`${relPath}:${index + 1}: ${line.trim()}`);
    });
  }

  assert.deepEqual(violations, [], 'MIG-07 + browser mentioned together without a qualifying negation or gate reference:\n' + violations.join('\n'));
});

// Permanent fixtures for the detector itself, independent of what the live
// docs currently say — these are what a reviewer re-introducing the bug (or
// a future edit accidentally loosening the regex) would need to keep green.
test('MIG-B6-02: isUnqualifiedMig07BrowserClaim flags real-world-shaped contradictions', () => {
  assert.equal(isUnqualifiedMig07BrowserClaim('MIG-07 verifica browser sin limitaciones.'), true,
    '"sin limitaciones" reinforces the claim; it must not count as a negation.');
  assert.equal(isUnqualifiedMig07BrowserClaim('## MIG-07 — Consumidor desde tarball y navegador (P1)'), true);
  assert.equal(isUnqualifiedMig07BrowserClaim('mig07-consumer opens a real browser to check computed styles.'), true);
  assert.equal(isUnqualifiedMig07BrowserClaim('MIG-07 no navegador'), true,
    'A bare negation word elsewhere on the line with no verb it actually negates must still be flagged.');
});

test('MIG-B6-02: isUnqualifiedMig07BrowserClaim does not flag qualified mentions', () => {
  assert.equal(isUnqualifiedMig07BrowserClaim('MIG-07 no ejecuta browser ni css-loader.'), false);
  assert.equal(isUnqualifiedMig07BrowserClaim('mig07-consumer/README.md: "No headless browser is available".'), false);
  assert.equal(isUnqualifiedMig07BrowserClaim('MIG-07 | ... | No atribuirle navegador ni build real de CSS Modules |'), false);
  assert.equal(isUnqualifiedMig07BrowserClaim('mig07-consumer does not run that loader or open a browser.'), false);
  assert.equal(isUnqualifiedMig07BrowserClaim('MIG-07\'s tarball is reused by verify:cssmodules-build for the browser check.'), false,
    'Naming the actual external gate qualifies the mention even without a negation.');
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
