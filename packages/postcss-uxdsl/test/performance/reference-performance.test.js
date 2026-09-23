// MIG-B6-25 (FEAT-008): a guard against the quadratic term coming back.
//
// It asserts a *ratio*, never a millisecond budget: doubling the input may not
// much more than double the work. An absolute threshold would only encode how
// fast the machine that wrote it happened to be, and would fail on a loaded CI
// runner for reasons that have nothing to do with the algorithm. The story's
// absolute numbers live in `npm run bench:references`, with the machine
// recorded next to them.
//
// It lives in `test/performance/` and runs in its own `node --test
// --test-concurrency=1` pass, after the main suite, because `node --test` runs
// test *files* in parallel: measured inside that pool this test saw its own
// absolute times nearly double and reported a x3.04 growth that isolated runs
// put at x1.78. That was CPU contention, not the algorithm — and a timing test
// that competes with thirty other files measures the scheduler.
//
// Only `inspectReferences` is timed, on a root the compiler itself produced.
// Timing a whole compile would fold in parsing, theme generation and directive
// expansion — all linear, all large — and would dilute a regression in the
// part under test until it no longer failed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');

const implementation = require('../../dist/reference-integrity');
const plugin = require('../../dist');

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

function time(run) {
  const started = process.hrtime.bigint();
  run();
  return Number(process.hrtime.bigint() - started) / 1e6;
}

function median(times) {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Measures both sizes interleaved (small, large, small, large, …) rather than
 * all of one and then all of the other.
 *
 * Measuring in phases means a slowdown that arrives partway through — another
 * process waking up, a thermal step — lands entirely on whichever size was
 * being measured at the time and shows up as a change in the *ratio*, which is
 * the number under test. Interleaving exposes both sizes to the same
 * conditions, so noise mostly cancels instead of being attributed to the
 * algorithm.
 */
function interleavedMedians(small, large) {
  const smallTimes = [];
  const largeTimes = [];
  for (let i = 0; i < SAMPLES; i++) {
    smallTimes.push(time(small));
    largeTimes.push(time(large));
  }
  return [median(smallTimes), median(largeTimes)];
}

test(`MIG-B6-25: reference validation grows near-linearly (${BLOCKS} -> ${BLOCKS * 2} blocks)`, async (t) => {
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

  const [smallMs, largeMs] = interleavedMedians(check(small), check(large));
  const growth = largeMs / smallMs;

  t.diagnostic(`${smallMs.toFixed(1)} ms -> ${largeMs.toFixed(1)} ms, growth x${growth.toFixed(2)} (budget ${MAX_GROWTH})`);
  assert.ok(growth <= MAX_GROWTH,
    `doubling the input multiplied reference validation by ${growth.toFixed(2)} ` +
    `(${smallMs.toFixed(1)} ms -> ${largeMs.toFixed(1)} ms), above the ${MAX_GROWTH} budget. ` +
    'This is the quadratic behaviour MIG-B6-25 removed; run `npm run bench:references` for the full curve.');
});
