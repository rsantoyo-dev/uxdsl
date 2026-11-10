'use strict';

// The corpus runner's own instruments, without the network: the timing verdict
// and the flag that turns its assertion off, the alternated timing and its warm
// runs, the fresh directory the corpus root is made in, the two counts of Dart
// Sass's deprecation warnings, the byte comparison's report, and a whole run as
// main() makes it, on a fake install, Dart Sass, compile() and clock. run.js
// itself installs Bootstrap 5.3.8 from the registry: it runs by hand and in the
// release gate (S-1), not in `npm test`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs, timingVerdict, deprecationCounter, firstDifferences, loadSass, TIMING_BUDGET, alternate, warm, freshCorpusRoot, removeCorpusRoot, runCorpus, ROUNDS, WORK } = require('./run');

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

/**
 * What runCorpus() needs, faked: an install that makes the corpus directory in
 * the root it is given, a Dart Sass and a compile() that advance one clock by
 * their next scripted duration (ms) and record each call in order, and a mixed
 * compile whose CSS passes the five checks.
 */
function fakeCorpus(plainMs, pipedMs) {
  let clock = 0n;
  const calls = [];
  const roots = [];
  const configs = [];
  const css = '.a {\n  color: red;\n}\n';
  const surfaces = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark'].map((name) => `.surface-${name} {}`).join('\n');
  const mixed = `${css}.card-x {\n  padding: var(--uxdsl__density__4);\n}\n.g { color: var(--uxdsl__color__gray-900); }\n${surfaces}\n.btn-x-danger { background: var(--uxdsl__palette__error-main); }\n`;
  const timed = (name, durations) => {
    clock += BigInt(durations[calls.filter((call) => call === name).length]) * 1000000n;
    calls.push(name);
  };
  return {
    calls,
    roots,
    configs,
    now: () => clock,
    install(root) {
      roots.push(root);
      const corpus = path.join(root, 'corpus');
      fs.mkdirSync(corpus);
      return { corpus, entryScss: path.join(root, 'bootstrap.scss'), entryUxdsl: path.join(corpus, 'bootstrap.uxdsl'), renamed: 92 };
    },
    sass: {
      compile(_file, options) {
        if (options.verbose) calls.push('verbose');
        else timed('plain', plainMs);
        return { css, loadedUrls: [new URL('file:///bootstrap.scss')] };
      },
    },
    async compile(input, config) {
      configs.push(config);
      if (path.basename(input.entry) === 'with-extras.uxdsl') {
        calls.push('mixed');
        return { css: mixed, warnings: [] };
      }
      timed('piped', pipedMs);
      return { css, warnings: [] };
    },
  };
}

test('MIG-B9-23: a run of the corpus runner alternates Dart Sass and compile(), Dart Sass first, judges the three warm runs of each and compiles in a fresh directory outside the temporary directory', async () => {
  // A slow cold run of each, and warm runs whose medians the cold runs would move over the budget.
  const plainMs = [900, 300, 310, 320];
  const pipedMs = [1500, 400, 450, 700];
  assert.equal(timingVerdict(plainMs, pipedMs).failed, true, 'the cold runs inside the medians would put compile() at 700 over 320 ms');
  const fake = fakeCorpus(plainMs, pipedMs);
  const lines = [];
  const passed = await runCorpus({ args: parseArgs([]), sass: fake.sass, sassVersion: 'fake', compile: fake.compile, install: fake.install, now: fake.now, log: (line) => lines.push(line) });
  assert.deepEqual(fake.calls, ['plain', 'piped', 'plain', 'piped', 'plain', 'piped', 'plain', 'piped', 'verbose', 'mixed'], 'four timed runs each, alternated, Dart Sass first; then the untimed verbose run and the mixed compile');
  assert.ok(lines.includes('  Dart Sass runs: 900 (cold, discarded), 300, 310, 320 ms; compile() runs: 1500 (cold, discarded), 400, 450, 700 ms (alternated, Dart Sass first)'), lines.join('\n'));
  assert.ok(lines.some((line) => line.startsWith('  timing: compile()\'s median is 1.45x Dart Sass\'s (budget 1.5x;')), `the medians of the warm runs, 450 over 310 ms:\n${lines.join('\n')}`);
  assert.equal(lines.filter((line) => line.includes('FAIL')).length, 0, lines.join('\n'));
  assert.equal(passed, true);
  assert.equal(fake.roots.length, 1, 'one corpus root');
  const [root] = fake.roots;
  assert.equal(path.dirname(path.dirname(root)), WORK, 'made by freshCorpusRoot() under the work directory');
  assert.equal(lines.find((line) => line.startsWith('  corpus root: ')), `  corpus root: ${root} (fresh, alone in its directory, outside the temporary directory)`);
  assert.equal(fs.existsSync(path.dirname(root)), false, 'its directory is removed after the run');
});

test('MIG-B9-20: the corpus runner passes compile() no includeTheme: Bootstrap has no marker, so it emits no theme without one', async () => {
  const fake = fakeCorpus([300, 300, 300, 300], [400, 400, 400, 400]);
  const passed = await runCorpus({ args: parseArgs([]), sass: fake.sass, sassVersion: 'fake', compile: fake.compile, install: fake.install, now: fake.now, log: () => {} });
  assert.equal(passed, true);
  assert.equal(fake.configs.length, 5, 'four timed compiles and the mixed one');
  for (const config of fake.configs) assert.equal(config === undefined || !('includeTheme' in config), true, JSON.stringify(config));
});
