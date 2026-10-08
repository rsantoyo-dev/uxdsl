'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../../packages/uxdsl/dist/entries/theme');
const exceptions = require('../../packages/uxdsl/src/theme/base.contrast-exceptions.json');
const baseline = require('./contrast-baseline.json');
const { assertContrastBaseline, contrastBaselineOf } = require('./run');

// The release gate pins the base theme's contrast verdict pair by pair: the
// failing set, and — since stability phase 5 made the shipped exceptions
// patterns — the excepted set too, each pair with the exception that covers
// it. Excepted is never counted as passing; it is listed and it is pinned.

const report = (options = { exceptions }) => runtime.checkThemeContrast(runtime.resolveTheme(), options);

test('the pinned baseline is what the shipped theme and exceptions produce today', () => {
  const valid = report();
  assert.match(assertContrastBaseline(valid, baseline), /^\d+ failing pairs, \d+ excepted \(listed, not passing\), unchanged$/);
  assert.equal(baseline.count, valid.failures.length);
  assert.equal(baseline.exceptedCount, valid.excepted.length);
  assert.deepEqual(contrastBaselineOf(valid, baseline.version), baseline, 'contrast-baseline.json is stale: re-pin with --write-contrast-baseline and review the diff');
});

test('negative control: a duplicated exception fails the gate while the pinned pairs stay unchanged', () => {
  const valid = report();
  const duplicate = report({ exceptions: [...exceptions, ...exceptions] });
  assert.deepEqual(duplicate.failures, valid.failures, 'the negative control keeps the same ordinary failures');
  assert.match(duplicate.exceptionIssues.join(' '), /duplicate exception id/);
  assert.throws(() => assertContrastBaseline(duplicate, baseline), /contrast exceptions invalid/);
});

test('negative control: a pattern that matches nothing fails the gate', () => {
  const stale = report({ exceptions: [...exceptions, { tone: 'primary', reason: 'negative control: primary fails nothing' }] });
  assert.match(stale.exceptionIssues.join(' '), /stale exception "tone:primary": the pattern matches no failing pair/);
  assert.throws(() => assertContrastBaseline(stale, baseline), /contrast exceptions invalid/);
});

test('negative control: removing a shipped pattern turns its pairs back into failures the baseline rejects', () => {
  const without = report({ exceptions: exceptions.filter((e) => e.tone !== 'surface') });
  assert.ok(without.failures.length > report().failures.length);
  assert.throws(() => assertContrastBaseline(without, baseline), /failing pairs: \d+ new/);
});

test('negative control: a pattern widened to cover more than what is pinned is rejected', () => {
  // The shipped patterns are narrowed to `against: ambient`. Dropping that
  // narrowing is the quiet way an exception grows; the set of covered pairs
  // must not be allowed to change without a reviewed re-pin.
  const widened = exceptions.map(({ against, ...rest }) => rest);
  const broad = report({ exceptions: widened });
  const narrow = report();
  if (broad.excepted.length === narrow.excepted.length) {
    // Nothing fails on a canvas-identity family's own fill today, so the two
    // lists cover the same pairs; force a difference the baseline must see.
    const one = { ...narrow, excepted: narrow.excepted.slice(1) };
    assert.throws(() => assertContrastBaseline(one, baseline), /excepted pairs: 0 new .* 1 closed/);
  } else {
    assert.throws(() => assertContrastBaseline(broad, baseline), /(failing|excepted) pairs: /);
  }
});
