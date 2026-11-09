'use strict';

// The corpus runner's own instruments, without the network: the timing verdict
// and the flag that turns its assertion off, the alternated timing and its warm
// runs, the fresh directory the corpus root is made in, the two counts of Dart
// Sass's deprecation warnings, and the byte comparison's report. run.js itself
// installs Bootstrap 5.3.8 from the registry: it runs by hand and in the
// release gate (S-1), not in `npm test`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs, timingVerdict, deprecationCounter, firstDifferences, loadSass, TIMING_BUDGET, alternate, warm, freshCorpusRoot, removeCorpusRoot, ROUNDS, WORK } = require('./run');

test('MIG-B9-13: the corpus runner fails compile() above 1.5x Dart Sass\'s median time and passes it at 1.5x or below', () => {
  assert.equal(TIMING_BUDGET, 1.5);
  const over = timingVerdict([400, 380, 420], [610, 640, 600]); // medians 400 and 610 ms
  assert.equal(over.failed, true);
  assert.ok(Math.abs(over.ratio - 1.525) < 1e-9, `ratio ${over.ratio}`);
  assert.equal(timingVerdict([400, 400, 400], [600, 600, 600]).failed, false, '1.5x is within the budget');
  const outliers = timingVerdict([380, 400, 1000], [560, 590, 2000]); // the medians decide, not the means
  assert.equal(outliers.failed, false);
  assert.ok(Math.abs(outliers.ratio - 1.475) < 1e-9, `ratio ${outliers.ratio}`);
});

test('MIG-B9-13: --no-timing-budget reports the ratio without asserting it', () => {
  assert.equal(parseArgs([]).budget, true);
  assert.equal(parseArgs(['--no-timing-budget']).budget, false);
  assert.deepEqual(timingVerdict([400, 400, 400], [800, 800, 800], { budget: false }), { ratio: 2, failed: false });
});

test('MIG-B9-13: the corpus runner counts the deprecation warnings Dart Sass delivers under its cap and, verbose, every one', () => {
  const { sass } = loadSass(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-corpus-deprecations-'));
  try {
    fs.writeFileSync(path.join(dir, '_part.scss'), '.a { color: red; }\n');
    fs.writeFileSync(path.join(dir, 'entry.scss'), '@import "part";\n'.repeat(7));
    const delivered = deprecationCounter();
    sass.compile(path.join(dir, 'entry.scss'), { style: 'expanded', logger: delivered.logger });
    assert.deepEqual(delivered.counts, { import: 5, other: 1 }, 'five per deprecation type, then one summary');
    const totals = deprecationCounter();
    sass.compile(path.join(dir, 'entry.scss'), { style: 'expanded', verbose: true, logger: totals.logger });
    assert.deepEqual(totals.counts, { import: 7 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('MIG-B9-13: the corpus runner\'s comparison reports a byte Dart Sass did not write, a final newline included', () => {
  const sassCss = '.a {\n  color: red;\n}';
  assert.deepEqual(firstDifferences(sassCss, sassCss), []);
  const lines = firstDifferences(sassCss, `${sassCss}\n`);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^line 4\n/);
});

/** Two compilers on a fake clock: each call advances the clock by its next scripted duration (ms) and records its name. */
function scripted(plainMs, pipedMs) {
  let clock = 0n;
  const calls = [];
  const step = (name, durations) => () => {
    const ms = durations[calls.filter((call) => call === name).length];
    calls.push(name);
    clock += BigInt(ms) * 1000000n;
    return { name, ms };
  };
  return { calls, plain: step('plain', plainMs), piped: step('piped', pipedMs), now: () => clock };
}

test('MIG-B9-23: the corpus runner times Dart Sass and compile() alternately, Dart Sass first, and takes each median from the three warm runs, the cold first run left out', async () => {
  assert.equal(ROUNDS, 4, 'four runs each: one cold, three warm');
  const run = scripted([900, 300, 310, 320], [1500, 400, 420, 410]);
  const timings = await alternate(ROUNDS, run.plain, run.piped, run.now);
  assert.deepEqual(run.calls, ['plain', 'piped', 'plain', 'piped', 'plain', 'piped', 'plain', 'piped']);
  assert.deepEqual(timings.plain.durations, [900, 300, 310, 320], 'every run is recorded, the cold one first');
  assert.deepEqual(timings.piped.durations, [1500, 400, 420, 410]);
  assert.deepEqual(timings.plain.result, { name: 'plain', ms: 320 }, 'the last run\'s result');
  assert.deepEqual(timings.piped.result, { name: 'piped', ms: 410 });
  assert.deepEqual(warm(timings.plain.durations), [300, 310, 320]);
  assert.deepEqual(warm(timings.piped.durations), [400, 420, 410]);
  const verdict = timingVerdict(warm(timings.plain.durations), warm(timings.piped.durations));
  assert.equal(verdict.ratio, 410 / 310, 'the medians of the warm runs');
  assert.equal(verdict.failed, false);
  // A cold run of any length leaves the verdict where the warm runs put it.
  const slowCold = scripted([5000, 300, 310, 320], [9000, 400, 420, 410]);
  const again = await alternate(ROUNDS, slowCold.plain, slowCold.piped, slowCold.now);
  assert.deepEqual(timingVerdict(warm(again.plain.durations), warm(again.piped.durations)), verdict);
  // The cold runs inside the median would move it: what the warm runs leave out.
  assert.notEqual(timingVerdict(again.plain.durations, again.piped.durations).ratio, verdict.ratio);
});

test('MIG-B9-23: the corpus runner makes the corpus root in a fresh directory that holds nothing else, outside the temporary directory', () => {
  const made = [];
  try {
    const root = freshCorpusRoot();
    made.push(root);
    const other = freshCorpusRoot();
    made.push(other);
    assert.equal(path.basename(root), 'corpus-root');
    assert.deepEqual(fs.readdirSync(path.dirname(root)), ['corpus-root'], 'its directory holds the corpus root alone');
    assert.deepEqual(fs.readdirSync(root), [], 'the corpus root starts empty');
    assert.notEqual(path.dirname(other), path.dirname(root), 'each run gets its own directory');
    assert.equal(path.dirname(path.dirname(root)), WORK);
    const outside = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(root));
    assert.ok(outside === '..' || outside.startsWith(`..${path.sep}`) || path.isAbsolute(outside), `${root} is not under the temporary directory ${os.tmpdir()}`);
    const ignored = spawnSync('git', ['check-ignore', '--quiet', root], { cwd: __dirname });
    assert.equal(ignored.status, 0, 'git ignores the work directory');
  } finally {
    for (const root of made) removeCorpusRoot(root);
  }
});
