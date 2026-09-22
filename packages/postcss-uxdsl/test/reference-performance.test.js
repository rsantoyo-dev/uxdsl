// MIG-B6-25 (FEAT-008): a guard against the quadratic term coming back.
//
// It asserts a *ratio*, never a millisecond budget: doubling the input may not
// much more than double the work. An absolute threshold would only encode how
// fast the machine that wrote it happened to be, and would fail on a loaded CI
// runner for reasons that have nothing to do with the algorithm. The story's
// absolute numbers live in `npm run bench:references`, with the machine
// recorded next to them.
//
// Only `inspectReferences` is timed, on a root the compiler itself produced.
// Timing a whole compile would fold in parsing, theme generation and directive
// expansion — all linear, all large — and would dilute a regression in the
// part under test until it no longer failed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');

const implementation = require('../dist/reference-integrity');
const plugin = require('../dist');

const BLOCKS = 500;
const MAX_GROWTH = 2.5;
const SAMPLES = 3;

function source(blocks) {
  let css = '';
  for (let i = 0; i < blocks; i++) {
    css += `.card-${i} {
  padding: density(2);
  margin: xs(space(1)) md(space(2)) lg(space(3));
  color: palette(primary);
  background: palette(surface);
  border-radius: radius(2);
  gap: xs(0.5rem) md(1rem);
  &:hover { color: palette(primary.dark); }
  .title-${i} { @ds-typo(h3); margin: 0; }
  @ds-surface(outlined primary);
}
`;
  }
  return css;
}

/** Compiles with validation switched off and keeps the arguments the compiler
 * would have validated, so the measurement runs over a real compiled root
 * rather than a hand-built approximation. */
async function prepare(blocks) {
  let captured = null;
  const original = implementation.enforceReferences;
  implementation.enforceReferences = (root, consumers, options) => {
    captured = { root, consumers, options };
    return original(root, consumers, options);
  };
  try {
    await postcss([plugin({ includeTheme: true, references: { mode: 'off' } })])
      .process(source(blocks), { from: `perf-${blocks}.uxdsl`, syntax: postcssScss });
  } finally {
    implementation.enforceReferences = original;
  }
  assert.ok(captured, 'the compilation never reached reference validation');
  return captured;
}

function medianOf(run) {
  const times = [];
  for (let i = 0; i < SAMPLES; i++) {
    const started = process.hrtime.bigint();
    run();
    times.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

test(`MIG-B6-25: reference validation grows near-linearly (${BLOCKS} -> ${BLOCKS * 2} blocks)`, async () => {
  const small = await prepare(BLOCKS);
  const large = await prepare(BLOCKS * 2);

  // Sanity: the fixture must really be twice the work, and must really reach
  // the validator with a full consumer list. Without this the ratio could look
  // excellent because both sides did nothing.
  assert.ok(small.consumers.length > 1000, `expected a large consumer list, got ${small.consumers.length}`);
  assert.ok(large.consumers.length / small.consumers.length > 1.9,
    `expected the large input to roughly double the consumers, got ${large.consumers.length} vs ${small.consumers.length}`);

  const check = ({ root, consumers, options }) => () => {
    const issues = implementation.inspectReferences(root, consumers, { ...options, mode: 'error' });
    assert.equal(issues.length, 0, 'the performance fixture is expected to be reference-clean');
  };
  // Warm up both sizes first so JIT compilation is not charged to whichever
  // one happens to run first.
  check(small)();
  check(large)();

  const smallMs = medianOf(check(small));
  const largeMs = medianOf(check(large));
  const growth = largeMs / smallMs;

  assert.ok(growth <= MAX_GROWTH,
    `doubling the input multiplied reference validation by ${growth.toFixed(2)} ` +
    `(${smallMs.toFixed(1)} ms -> ${largeMs.toFixed(1)} ms), above the ${MAX_GROWTH} budget. ` +
    'This is the quadratic behaviour MIG-B6-25 removed; run `npm run bench:references` for the full curve.');
});
