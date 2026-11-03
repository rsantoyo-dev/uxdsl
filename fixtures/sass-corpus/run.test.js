'use strict';

// The corpus runner's own instruments, without the network: the timing verdict
// and the flag that turns its assertion off, the two counts of Dart Sass's
// deprecation warnings, and the byte comparison's report. run.js itself
// installs Bootstrap 5.3.8 from the registry: it runs by hand and in the
// release gate (S-1), not in `npm test`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs, timingVerdict, deprecationCounter, firstDifferences, loadSass, TIMING_BUDGET } = require('./run');

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
