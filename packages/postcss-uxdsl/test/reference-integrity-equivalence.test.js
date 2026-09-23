// MIG-B6-25 (FEAT-008): the optimization in `inspectReferences` is only
// acceptable if it is *indistinguishable* from the implementation it replaces.
// Hand-written expectations could not establish that — they would only encode
// what the author believed the old behavior was — so every case below runs the
// current implementation and the frozen pre-optimization oracle over the same
// input and compares the issue arrays element for element, in order.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');

const implementation = require('../dist/reference-integrity');
const oracle = require('./fixtures/reference-integrity-oracle');
const plugin = require('../dist');
const theme = require('../../../fixtures/mig07-consumer/theme.json');

// Pinned so that "make the oracle agree" is never an available way to fix a
// failing comparison. Regenerating the fixture changes this digest and fails
// here first, with this comment as the explanation.
const ORACLE_SHA256 = '7d6fac7b57adfe644e2e456d04dfcc668904d14bc0a4eb5a495647c1fb519059';

/** Every comparison funnels through here so one counter can prove the suite
 * is not passing vacuously on empty arrays. */
const totals = { comparisons: 0, issues: 0 };

function compare(label, root, consumers, options) {
  const mine = implementation.inspectReferences(root, consumers, options);
  const theirs = oracle.inspectReferences(root, consumers, options);
  assert.deepEqual(mine, theirs, `${label}: optimized output differs from the frozen oracle`);
  totals.comparisons++;
  totals.issues += mine.length;
  return mine;
}

function compareCss(label, css, { consumerProps = ['color', 'padding', 'background', 'margin'], options, from = 'equivalence-fixture.css' } = {}) {
  const root = postcss.parse(css, { from });
  const consumers = [];
  root.walkDecls(node => { if (consumerProps.includes(node.prop) || node.prop.startsWith('--')) consumers.push(node); });
  return compare(label, root, consumers, options);
}

/** Runs a real plugin compilation and hands back every `enforceReferences`
 * call it made, so the comparison uses the same live root, consumer list and
 * generated theme CSS the compiler itself validated — not a reconstruction. */
async function capture(css, pluginOptions, from) {
  const calls = [];
  const original = implementation.enforceReferences;
  implementation.enforceReferences = (root, consumers, options) => {
    calls.push({ root, consumers, options });
    return original(root, consumers, options);
  };
  try {
    await postcss([plugin(pluginOptions)]).process(css, { from, syntax: postcssScss });
  } catch (err) {
    // A reference error is a valid outcome to compare; anything else is a bug
    // in the fixture, not a result.
    if (!/UXD_REFERENCE/.test(String(err && err.message))) throw err;
  } finally {
    implementation.enforceReferences = original;
  }
  assert.ok(calls.length > 0, 'the compilation never reached reference validation');
  return calls;
}

test('MIG-B6-25: the oracle fixture is the frozen pre-optimization implementation', () => {
  const file = path.join(__dirname, 'fixtures', 'reference-integrity-oracle.js');
  const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(digest, ORACLE_SHA256,
    'test/fixtures/reference-integrity-oracle.js changed. It is a frozen copy of the implementation ' +
    'this story replaces; if the new implementation disagrees with it, fix the new implementation.');
});

test('MIG-B6-25: equivalent on the cases reference-integrity.test.js already covers', () => {
  compareCss('missing transitive', ':root { --a: var(--b); } .x { color: var(--a); }');
  compareCss('cycle', ':root { --a: var(--b); --b: var(--a); } .x { color: var(--a); }');
  compareCss('recovering fallback', '.x { color: var(--missing, red); }');
  compareCss('foreign selector', '.other { --a: red; } .x { color: var(--a); }');
  compareCss('narrower breakpoint only', '@media (min-width: 800px) { :root { --a: red; } } .x { color: var(--a); }');
  compareCss('wider consumer breakpoint',
    '@media (min-width: 800px) { :root { --a: red; } } @media (min-width: 900px) { .x { color: var(--a); } }');
});

test('MIG-B6-25: equivalent on media, modes and repeated selectors', () => {
  // The same selector defines the token under three different contexts, which
  // is precisely the case the story warns about: two declarations of one
  // selector under different media do not always share the same contexts.
  compareCss('selector repeated across media and modes', `
    :root { --tok: red; }
    @media (min-width: 768px) { :root { --tok: var(--tok-md); --tok-md: green; } }
    @media (min-width: 1280px) { .panel { --tok: var(--tok-xl); } }
    :root[data-theme='dark'] { --tok: var(--dark-only); }
    :root:not([data-theme='light']) { --dark-only: black; }
    .panel { color: var(--tok); }
    @media (min-width: 768px) { .panel { background: var(--tok); } }
  `);
  compareCss('min-width ordering is not lexical', `
    @media (min-width: 90px) { :root { --w: red; } }
    @media (min-width: 1000px) { .x { color: var(--w); } }
  `);
  // A :root consumer must also be inspected in the :root-prefixed mode scopes,
  // where a dependency can resolve to a *different* definition and fail there
  // only. Written deliberately: an earlier version of this suite passed while
  // the implementation ignored those scopes entirely, because no case made a
  // mode scope the one that produces the issue.
  compareCss('dark-mode :root scope is the only failing context', `
    :root { --tok: var(--mode-color); --mode-color: white; }
    :root[data-theme='dark'] { --mode-color: var(--missing-in-dark); }
    .panel { color: var(--tok); }
  `);
  compareCss('mode scope recovers what the base scope lacks', `
    :root { --tok: var(--mode-color); }
    :root:not([data-theme='light']) { --mode-color: black; }
    .panel { color: var(--tok); }
  `);
});

// The new implementation memoizes three things that the previous one
// recomputed per consumer: the context list per base, the set of distinct
// contexts, and each node's own context. A cache keyed too loosely would be
// invisible to every case above — each of these makes one of those keys decide
// the answer, so a wrong key changes the reported issues rather than only the
// running time.
test('MIG-B6-25: equivalent where a mis-keyed cache would change the answer', () => {
  // Two consumers share the selector `.x` but not the conditions. Only the
  // unconditioned one may fail: keying the per-base context list by selector
  // alone hands the second consumer the first one's contexts and invents an
  // issue for it.
  compareCss('same selector, different conditions, per-base contexts', `
    @media (min-width: 800px) { :root { --only-md: red; } }
    .x { color: var(--only-md); }
    @media (min-width: 800px) { .x { background: var(--only-md); } }
  `);
  // Both contexts here are `:root`, differing only in their media condition,
  // and the failure exists exclusively in the conditioned one. Deduplicating
  // distinct contexts by selector drops it and loses the issue.
  compareCss('same selector, different conditions, distinct-context set', `
    :root { --tok: var(--responsive); --responsive: red; }
    @media (min-width: 768px) { :root { --responsive: var(--missing-at-md); } }
    .panel { color: var(--tok); }
  `);
  // Two `color` declarations in different scopes, one of which can see the
  // token and one of which cannot: a per-node context cache keyed by property
  // would give the second one the first one's scope.
  compareCss('same property, different scopes', `
    .x { --scoped: red; color: var(--scoped); }
    .y { color: var(--scoped); }
  `);
});

test('MIG-B6-25: equivalent on shared cycles, nested fallbacks and !important', () => {
  compareCss('one cycle seen from two consumers', `
    :root { --loop-a: var(--loop-b); --loop-b: var(--loop-a); }
    .first { color: var(--loop-a); }
    .second { background: var(--loop-b); }
  `);
  compareCss('cycle reached through a fallback', `
    :root { --p: var(--q); --q: var(--p); }
    .x { color: var(--absent, var(--p)); }
  `);
  compareCss('nested fallbacks, last one valid', '.x { color: var(--m1, var(--m2, var(--m3, red))); }');
  compareCss('nested fallbacks, none valid', '.x { color: var(--m1, var(--m2, var(--m3))); }');
  // Equal widths written differently: `conditionsApply`'s string equality
  // misses these, so the comparison really does go through the numeric
  // min-width path, where `>=` (not `>`) is the documented rule.
  compareCss('equal min-width spelled differently still applies', `
    @media (min-width:800px) { :root { --eq: var(--missing-at-equal-width); } }
    @media (min-width: 800px) { .x { color: var(--eq); } }
  `);
  compareCss('narrower definition applies to a wider consumer', `
    @media (min-width:700px) { :root { --near: var(--missing-below); } }
    @media (min-width: 800px) { .x { color: var(--near); } }
  `);
  compareCss('wider definition does not apply to a narrower consumer', `
    @media (min-width:900px) { :root { --far: red; } }
    @media (min-width: 800px) { .x { color: var(--far); } }
  `);
  // Pins the order in which two definitions of one token resolve when the
  // earlier one carries !important. The comparator is kept verbatim from the
  // previous implementation, quirk included — see the story's follow-up note.
  compareCss('important declared before a plain override', `
    :root { --imp: var(--from-important) !important; }
    :root { --imp: var(--from-plain); --from-plain: red; }
    .panel { color: var(--imp); }
  `);
  compareCss('important overrides across contexts', `
    :root { --i: var(--base); --base: red; }
    @media (min-width: 800px) { :root { --i: var(--missing-md) !important; } }
    @media (min-width: 800px) { .x { color: var(--i); } }
  `);
  compareCss('definition on the consumer selector outranks :root', `
    :root { --s: var(--from-root); --from-root: red; }
    .x { --s: var(--from-local); color: var(--s); }
  `);
});

test('MIG-B6-25: equivalent with external providers declared and withheld', () => {
  const css = '.x { color: var(--host-token); } .y { background: var(--host-token, blue); }';
  compareCss('external declared', css, { options: { externalTokens: ['--host-token'] } });
  compareCss('external withheld', css);
  compareCss('external declared but unused', ':root { --a: red; } .x { color: var(--a); }',
    { options: { externalTokens: ['--unused-host-token'] } });
});

test('MIG-B6-25: equivalent on the synthetic block with injected errors (N = 50)', () => {
  let css = `:root { --ring-a: var(--ring-b); --ring-b: var(--ring-c); --ring-c: var(--ring-a); }\n`;
  for (let i = 0; i < 50; i++) {
    css += `.card-${i} {
  padding: var(--uxdsl__density__2);
  margin: var(--uxdsl__space__1);
  color: var(--uxdsl__palette__primary-main);
  background: var(--uxdsl__palette__surface-main);
  ${i % 5 === 0 ? `border-color: var(--uxdsl__palette__nope-${i}-main);` : ''}
  ${i % 7 === 0 ? `outline-color: var(--ring-a);` : ''}
  ${i % 11 === 0 ? `color: var(--uxdsl__space__999, var(--uxdsl__space__998));` : ''}
}\n`;
  }
  const issues = compareCss('synthetic N=50', css, {
    consumerProps: ['color', 'padding', 'background', 'margin', 'border-color', 'outline-color'],
  });
  // The injected tokens must really fail, or this case would compare two empty
  // arrays and prove nothing about the hint text, dedup key or ordering.
  assert.ok(issues.some(issue => issue.code === 'UXD_REFERENCE_MISSING'), 'expected injected missing tokens');
  assert.ok(issues.some(issue => issue.code === 'UXD_REFERENCE_CYCLE'), 'expected the injected cycle');
  assert.ok(issues.some(issue => /Available space\(\) keys/.test(issue.message)), 'expected the space() hint to be exercised');
});

test('MIG-B6-25: equivalent on the repository\'s own .uxdsl entries', async () => {
  const entries = path.join(__dirname, '..', '..', '..', 'fixtures', 'mig07-consumer', 'entries');
  const files = fs.readdirSync(entries).filter(name => name.endsWith('.uxdsl'));
  assert.ok(files.length >= 5, `expected the mig07 consumer entries, found ${files.length}`);
  for (const name of files) {
    const from = path.join(entries, name);
    const calls = await capture(fs.readFileSync(from, 'utf8'), { theme, includeTheme: name === 'theme.uxdsl' }, from);
    calls.forEach((call, index) => compare(`${name}#${index}`, call.root, call.consumers, call.options));
  }
});

test('MIG-B6-25: equivalent across successive compilations with different themes', async () => {
  const css = '.x { padding: density(2); color: palette(primary.main); background: palette(surface.main); }';
  const themes = [
    { label: 'fixture theme', theme },
    { label: 'recolored', theme: { ...theme, palette: { ...theme.palette, primary: { ...theme.palette.primary, main: '#123456' } } } },
    { label: 'fixture theme again', theme },
  ];
  for (const variant of themes) {
    const calls = await capture(css, { theme: variant.theme, includeTheme: true }, 'successive.uxdsl');
    calls.forEach((call, index) => compare(`${variant.label}#${index}`, call.root, call.consumers, call.options));
  }
});

test('MIG-B6-25: the comparison suite is not vacuous', (t) => {
  t.diagnostic(`compared ${totals.comparisons} inputs, ${totals.issues} issues matched element for element`);
  assert.ok(totals.comparisons >= 25, `expected a real corpus, compared ${totals.comparisons} inputs`);
  assert.ok(totals.issues >= 40, `expected real issues to compare, saw ${totals.issues}`);
});
