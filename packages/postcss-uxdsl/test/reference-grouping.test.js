'use strict';

// Stability phase 1 (audit 2026-09-29, "cascading errors"): one missing token
// used to come back as one `UXD_REFERENCE_MISSING` line per consumer — a
// Palette value that does not resolve is referenced by every Surface, Button
// and Input variable built on it — and the hint could suggest the missing name
// itself when the same name was defined in another scope.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateThemeCss, inspectReferences, ReferenceIntegrityError } = require('../dist/ds-runtime');
const { formatReferenceIssues } = require('../dist/reference-integrity');

const compile = (source, theme = {}, options = {}) => postcss([plugin({ theme, discoverTheme: false, ...options })]).process(source, { from: 'x.uxdsl' });
const missingLines = (message) => message.split('\n').filter((line) => line.startsWith('UXD_REFERENCE_MISSING'));
const caught = async (promise) => promise.then(() => null, (error) => error);

test('grouping: a dangling Palette value is one line naming its consumers, not one line per consumer', () => {
  const theme = { palette: { primary: { main: 'var(--uxdsl__color__brand-500)' } } };
  let error;
  try { generateThemeCss(theme); } catch (e) { error = e; }
  assert.ok(error instanceof ReferenceIntegrityError);
  assert.ok(error.issues.length > 5, `the cascade is real: ${error.issues.length} issues`);
  const lines = missingLines(error.message);
  assert.equal(lines.length, 1, error.message);
  assert.match(lines[0], /^UXD_REFERENCE_MISSING: --uxdsl__color__brand-500 has no definition in the active theme\/scope\. Define it or declare its external provider\. Referenced by \d+ definitions: --uxdsl__palette__primary-main, /);
  assert.match(lines[0], / and \d+ more\.$/, 'the consumer list is capped');
  // The listed consumers are distinct and at most five before "and N more".
  const listed = lines[0].match(/definitions: (.*) and \d+ more\.$/)[1].split(', ');
  assert.equal(listed.length, 5);
  assert.equal(new Set(listed).size, 5);
  // Per-consumer issues are still there for tooling and warn mode.
  assert.ok(error.issues.every((issue) => issue.reference === '--uxdsl__color__brand-500'));
});

test('grouping: an author\'s own declaration is listed first, with its position', async () => {
  const error = await caught(compile('.a {\n  color: palette(primary);\n}', { palette: { primary: { main: 'var(--uxdsl__color__brand-500)' } } }));
  assert.ok(error, 'compilation fails');
  const lines = missingLines(error.message);
  assert.equal(lines.length, 1, error.message);
  // PostCSS resolves `from` to an absolute path; the position is what matters.
  assert.match(lines[0], /Referenced by \d+ definitions: color \([^)]*x\.uxdsl:2:3\), --uxdsl__palette__primary-main/);
  assert.ok(String(error.file).endsWith('x.uxdsl'));
  assert.equal(error.line, 2);
});

test('grouping: two missing tokens are two lines; a token with one consumer keeps the full chain message', () => {
  const theme = { surfaces: { contained: { bg: 'palette(nope.main)', color: 'palette(zilch.main)' } } };
  let error;
  try { generateThemeCss(theme); } catch (e) { error = e; }
  const lines = missingLines(error.message);
  assert.equal(lines.length, 2, error.message);
  assert.match(lines[0], /^UXD_REFERENCE_MISSING: --uxdsl__surface__contained-bg -> --uxdsl__palette__nope-main has no definition/);
  assert.match(lines[1], /^UXD_REFERENCE_MISSING: --uxdsl__surface__contained-color -> --uxdsl__palette__zilch-main has no definition/);
  assert.doesNotMatch(error.message, /Referenced by/);
});

test('hint: the missing name itself is never suggested — a token defined only in dark mode', () => {
  // `brand.dark` exists in the dark-mode palette only; in the light scope it is
  // missing, and the definition under the identical name must not become the
  // suggestion. A genuinely near name still is.
  const theme = {
    palette: { brand: { main: '#111', contrast: '#fff', dusk: '#222' } },
    modes: { dark: { palette: { brand: { dark: '#000' } } } },
    surfaces: { contained: { border: '1px solid palette(brand.dark)' } },
  };
  let error;
  try { generateThemeCss(theme); } catch (e) { error = e; }
  assert.ok(error instanceof ReferenceIntegrityError, 'the light scope lacks brand-dark');
  assert.doesNotMatch(error.message, /Did you mean "brand-dark"\?/, error.message);
  assert.match(error.message, /Did you mean "brand-dusk"\?/, error.message);
});

test('hint: with no near name there is no suggestion at all, and the message still groups', () => {
  const theme = { palette: { brand: { main: '#111' } }, modes: { dark: { palette: { brand: { dark: '#000' } } } }, surfaces: { contained: { border: '1px solid palette(brand.dark)' } } };
  let error;
  try { generateThemeCss(theme); } catch (e) { error = e; }
  assert.doesNotMatch(error.message, /Did you mean/);
  assert.equal(missingLines(error.message).length, 1);
});

test('formatReferenceIssues: cycles are left one per issue and missing tokens are grouped', () => {
  const root = postcss.parse(':root { --a: var(--b); --b: var(--a); --c: var(--gone); --d: var(--gone); } .x { color: var(--a); background: var(--gone); }', { from: 'cycle.css' });
  const consumers = [];
  root.walkDecls((node) => consumers.push(node));
  const issues = inspectReferences(root, consumers);
  const text = formatReferenceIssues(issues, 2);
  const lines = text.split('\n');
  assert.ok(lines.some((line) => /UXD_REFERENCE_CYCLE/.test(line)));
  const missing = lines.filter((line) => line.startsWith('UXD_REFERENCE_MISSING'));
  assert.equal(missing.length, 1);
  // Consumers in discovery order, located ones first, capped at `limit`.
  assert.match(missing[0], /^UXD_REFERENCE_MISSING: --gone has no definition .* Referenced by 3 definitions: --c \([^)]*cycle\.css:1:\d+\), --d \([^)]*cycle\.css:1:\d+\) and 1 more\.$/);
});

test('warn mode still reports every consumer individually', async () => {
  const warned = [];
  const result = await compile('.a { color: palette(primary); }', { palette: { primary: { main: 'var(--uxdsl__color__brand-500)' } } }, { references: { mode: 'warn', onWarning: (issue) => warned.push(issue) } });
  assert.ok(warned.length > 5);
  assert.equal(result.warnings().length, warned.length);
});
