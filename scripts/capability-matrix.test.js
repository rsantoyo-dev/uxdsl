'use strict';

// MIG-B7-17 (FEAT-009), phase A. What the playground has to show is derived from
// UXDSL's own sources (scripts/lib/capabilities.js); this test holds the playground
// to it. Three ratchets, each failing in the direction that matters:
//   - a capability without a live example, that is not on the recorded list of gaps,
//     fails (a new capability cannot go unshown);
//   - a recorded gap that is now shown fails until it is removed from the list (so
//     the list only ever shrinks, and phase C has a measurable finish line);
//   - the styling the playground writes around UXDSL may not grow.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, deriveCapabilities, dogfoodingCounts, manualEvidence, FAMILY_CONSUMERS } = require('./lib/capabilities');
const { render, OUT } = require('./generate-capability-matrix');

const rows = deriveCapabilities();
const evidence = manualEvidence();
const kinds = (kind) => rows.filter((r) => r.kind === kind);

test('the capability list is derived from UXDSL\'s own sources, and covers every kind', () => {
  const rt = require(path.join(ROOT, 'packages/postcss-uxdsl/dist/ds-runtime'));
  const language = require(path.join(ROOT, 'packages/postcss-uxdsl/dist/language')).LANGUAGE_COMPLETIONS;
  assert.equal(kinds('directive').length, language.directives.length);
  assert.equal(kinds('family').length, rt.KNOWN_THEME_FAMILIES.size, 'one row per registered theme family');
  assert.equal(kinds('function').length + kinds('breakpoint-function').length, language.functions.length);
  assert.equal(kinds('role').length, Object.keys(rt.DEFAULT_SURFACES).length + Object.keys(rt.DEFAULT_BUTTONS).length + Object.keys(rt.DEFAULT_INPUTS).length);
  assert.equal(kinds('state').length, Object.keys(rt.BUTTON_STATES).length + Object.keys(rt.INPUT_STATES).length);
  for (const kind of ['runtime', 'cli-command', 'cli-flag', 'package-export', 'diagnostics']) assert.ok(kinds(kind).length > 0, `no ${kind} capabilities were derived`);
  assert.ok(rows.length >= 100, `expected at least 100 capabilities, derived ${rows.length}`);
});

test('every registered theme family has a rule saying what consuming it looks like (a new family cannot be skipped)', () => {
  assert.deepEqual(rows.filter((r) => /NO CONSUMER RULE/.test(r.note)).map((r) => r.id), []);
});

test('negative control: a family with no consumer rule is reported as a gap, not silently skipped', () => {
  const saved = FAMILY_CONSUMERS.modes;
  delete FAMILY_CONSUMERS.modes;
  try {
    const row = deriveCapabilities().find((r) => r.id === 'family:modes');
    assert.match(row.note, /NO CONSUMER RULE/);
    assert.equal(row.met, false);
  } finally { FAMILY_CONSUMERS.modes = saved; }
});

test('gaps: exactly the recorded ones — a new gap fails, and so does a gap that has been closed', () => {
  const gaps = rows.filter((r) => !r.met).map((r) => r.id).sort();
  const recorded = [...evidence.knownGaps].sort();
  const introduced = gaps.filter((id) => !recorded.includes(id));
  const closed = recorded.filter((id) => !gaps.includes(id));
  assert.deepEqual(introduced, [], 'capabilities with no live example that are not recorded — show them in the playground, or add them to knownGaps in packages/playground-nextjs/capability-evidence.json on purpose');
  assert.deepEqual(closed, [], 'recorded gaps that are now shown — remove them from knownGaps so the list only shrinks');
  for (const id of recorded) assert.ok(rows.some((r) => r.id === id), `knownGaps lists ${id}, which is not a capability any more`);
});

test('manual evidence is a pointer a test can hold to: the file exists, contains the string, and names a real capability', () => {
  for (const { id, file, needle, why } of evidence.manual) {
    assert.ok(rows.some((r) => r.id === id), `${id} is not a capability`);
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${id}: ${file} does not exist`);
    assert.ok(fs.readFileSync(path.join(ROOT, file), 'utf8').includes(needle), `${id}: ${file} does not contain ${JSON.stringify(needle)}`);
    assert.ok(why && why.length > 20, `${id}: say why text search cannot find this`);
  }
});

test('dogfooding: the styling written around UXDSL may not grow, and an improvement is locked in at once', () => {
  const now = dogfoodingCounts();
  assert.deepEqual(Object.keys(evidence.dogfoodingBaseline).sort(), Object.keys(now).sort(), 'baseline and measures must name the same things');
  for (const [name, value] of Object.entries(now)) {
    const baseline = evidence.dogfoodingBaseline[name];
    assert.ok(value <= baseline, `${name} grew from ${baseline} to ${value}: use the UXDSL token or function instead, or justify the increase and raise the baseline deliberately`);
    assert.equal(value, baseline, `${name} improved from ${baseline} to ${value}: lower "${name}" in packages/playground-nextjs/capability-evidence.json so the gain cannot be lost`);
  }
});

test('the committed matrix is up to date with the sources (node scripts/generate-capability-matrix.js)', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, OUT), 'utf8'), render());
});
