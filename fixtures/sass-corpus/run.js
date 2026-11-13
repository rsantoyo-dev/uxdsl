#!/usr/bin/env node
'use strict';

// The guarantee behind "rename .scss to .uxdsl and it works": Bootstrap 5.3.8's
// SCSS, every file renamed to .uxdsl, compiles through compile() to exactly the
// CSS Dart Sass produces from the original .scss, and a file mixing UXDSL with
// Bootstrap's own variables, functions and mixins compiles on top of it without
// changing Bootstrap's part.
//
// It also times the two in this one process, alternately and Dart Sass first,
// four runs each. Each one's first run is cold and left out: compile(), which
// always runs Dart Sass with its source map, must take at most 1.5 times Dart
// Sass's median of the three warm runs (--no-timing-budget prints the ratio
// without asserting it). Dart Sass caps its deprecation warnings at five per
// type, so an untimed verbose run counts every one.
//
// The corpus root is made in a fresh directory that holds nothing else, under
// this directory's git-ignored .work/, so the temporary directory is not on its
// path and no other entry sits beside it.
//
// Network: installs bootstrap@5.3.8 from the registry into the corpus root.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../..');
const BOOTSTRAP = 'bootstrap@5.3.8';
const TIMING_BUDGET = 1.5;
/** How many times each compiler runs; its first, cold run is left out of its median. */
const ROUNDS = 4;
/** Where each invocation makes its own directory for the corpus root (git-ignored). */
const WORK = path.join(__dirname, '.work');

function usage() {
  return `Usage: node fixtures/sass-corpus/run.js [--keep] [--sass <path>] [--uxdsl <dir>] [--no-timing-budget]

Compiles Bootstrap 5.3.8's SCSS renamed to .uxdsl with uxdsl's compile(),
compares it byte for byte with Dart Sass's output for the original .scss, then
compiles UXDSL mixed with Bootstrap's own Sass. Times both in one process,
alternately and Dart Sass first, ${ROUNDS} runs each; each one's first run is cold and
left out: compile()'s median of the warm runs must be at most ${TIMING_BUDGET}x Dart Sass's.
The corpus root is made in a fresh directory under fixtures/sass-corpus/.work.
Exits 1 on any difference (printing the first 10 differing lines), on a failed
mixed check, or over the timing budget.

  --keep              keep the corpus root (its path is printed)
  --sass <path>       the Dart Sass package to compare against (a directory or its
                      package.json); default: the repository's own copy
  --uxdsl <dir>       the uxdsl package to test (an installed tarball's directory);
                      default: the repository build, packages/uxdsl
  --no-timing-budget  print the timing ratio without asserting it
  --help              this text

Needs network access to install ${BOOTSTRAP}.`;
}

function parseArgs(argv) {
  const args = { keep: false, sass: null, uxdsl: path.join(REPO, 'packages/uxdsl'), budget: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { console.log(usage()); process.exit(0); }
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--sass') args.sass = path.resolve(argv[++i]);
    else if (arg === '--uxdsl') args.uxdsl = path.resolve(argv[++i]);
    else if (arg === '--no-timing-budget') args.budget = false;
    else { console.error(`Unknown argument ${arg}.\n\n${usage()}`); process.exit(2); }
  }
  return args;
}

/** The directory of the package that owns `file`: the nearest ancestor with a package.json. */
function packageDirOf(file) {
  let dir = path.dirname(file);
  while (!fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir);
  return dir;
}

function loadSass(explicit) {
  const read = (dir) => ({ sass: require(dir), version: JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version });
  if (explicit) return read(explicit.endsWith('package.json') ? path.dirname(explicit) : explicit);
  // `sass`'s `exports` map does not expose its package.json, so the package is
  // found by resolving its entry file and reading the package.json next to it.
  for (const base of [path.join(REPO, 'packages/uxdsl'), path.join(REPO, 'packages/playground-nextjs'), REPO]) {
    try {
      return read(packageDirOf(require.resolve('sass', { paths: [base] })));
    } catch {
      // not installed there; try the next place
    }
  }
  throw new Error('No Dart Sass found: install the repository (npm ci) or pass --sass <path>.');
}

function copyRenamed(from, to) {
  let count = 0;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    if (entry.isDirectory()) count += copyRenamed(source, path.join(to, entry.name));
    else if (entry.name.endsWith('.scss')) { fs.copyFileSync(source, path.join(to, entry.name.replace(/\.scss$/, '.uxdsl'))); count++; }
  }
  return count;
}

/**
 * A corpus root in a fresh directory that holds nothing else: an empty
 * `<work>/run-XXXXXX/corpus-root`, outside the temporary directory.
 */
function freshCorpusRoot(work = WORK) {
  fs.mkdirSync(work, { recursive: true });
  const root = path.join(fs.mkdtempSync(path.join(work, 'run-')), 'corpus-root');
  fs.mkdirSync(root);
  return root;
}

/** Removes the directory freshCorpusRoot() made for `root`, and the work directory once it is empty. */
function removeCorpusRoot(root, work = WORK) {
  fs.rmSync(path.dirname(root), { recursive: true, force: true });
  try {
    fs.rmdirSync(work);
  } catch {
    // another invocation's directory is still there, or the work directory is gone
  }
}

/**
 * Installs bootstrap@5.3.8 into `root` and copies its SCSS to `root/corpus`,
 * every file renamed to .uxdsl: the two entries and the number of files renamed.
 */
function installCorpus(root) {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'sass-corpus', version: '1.0.0', private: true }));
  const install = spawnSync('npm', ['install', BOOTSTRAP, '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  if (install.status !== 0) throw new Error(`npm install ${BOOTSTRAP} failed:\n${install.stderr}`);
  const scssDir = path.join(root, 'node_modules/bootstrap/scss');
  const corpus = path.join(root, 'corpus');
  const renamed = copyRenamed(scssDir, corpus);
  return { corpus, entryScss: path.join(scssDir, 'bootstrap.scss'), entryUxdsl: path.join(corpus, 'bootstrap.uxdsl'), renamed };
}

/** Whether `file` is outside `dir` (both real paths). */
function isOutside(file, dir) {
  const relative = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

/** Where the corpus root sits, as the run prints it. */
function placement(root) {
  const others = fs.readdirSync(path.dirname(root)).filter((name) => name !== path.basename(root)).length;
  const beside = others === 0 ? 'alone in its directory' : `beside ${others} other entries`;
  return `fresh, ${beside}, ${isOutside(root, os.tmpdir()) ? 'outside' : 'inside'} the temporary directory`;
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * Runs `plain` then `piped`, `rounds` times: each one's last result and every
 * duration, in ms, the first (cold) run first. `now` is the clock, in ns.
 */
async function alternate(rounds, plain, piped, now = () => process.hrtime.bigint()) {
  const timings = { plain: { durations: [], result: undefined }, piped: { durations: [], result: undefined } };
  const time = async (into, fn) => {
    const start = now();
    into.result = await fn();
    into.durations.push(Number(now() - start) / 1e6);
  };
  for (let i = 0; i < rounds; i++) {
    await time(timings.plain, plain);
    await time(timings.piped, piped);
  }
  return timings;
}

/** The warm runs: every run but the first, cold one. */
const warm = (durations) => durations.slice(1);

/**
 * compile()'s median duration over Dart Sass's; `failed` when the ratio is
 * above the budget and the budget is asserted.
 */
function timingVerdict(plainDurations, pipedDurations, { budget = true } = {}) {
  const ratio = median(pipedDurations) / median(plainDurations);
  return { ratio, failed: budget && ratio > TIMING_BUDGET };
}

/** A Dart Sass logger counting warnings by deprecation id ('other' for the rest, Sass's summary included). */
function deprecationCounter() {
  const counts = {};
  const logger = {
    warn(_message, options = {}) {
      const id = options.deprecationType ? options.deprecationType.id : 'other';
      counts[id] = (counts[id] || 0) + 1;
    },
    debug() {},
  };
  return { counts, logger };
}

function firstDifferences(expected, actual, limit = 10) {
  const a = expected.split('\n');
  const b = actual.split('\n');
  const lines = [];
  for (let i = 0; i < Math.max(a.length, b.length) && lines.length < limit; i++) {
    if (a[i] !== b[i]) lines.push(`line ${i + 1}\n  sass:  ${JSON.stringify(a[i])}\n  uxdsl: ${JSON.stringify(b[i])}`);
  }
  return lines;
}

/** Every run's duration, in ms, the first marked as the cold run left out of the median. */
const runs = (durations) => durations.map((ms, i) => (i === 0 ? `${Math.round(ms)} (cold, discarded)` : `${Math.round(ms)}`)).join(', ');

/**
 * One run of the corpus, printed line by line through `log`: the corpus root
 * made fresh, the corpus installed into it, Dart Sass and compile() timed
 * alternately, their CSS compared, the deprecation warnings counted and the
 * mixed checks run. Whether every check passed. main() passes the real Dart
 * Sass, compile(), install, clock and console; `now` is the clock, in ns.
 */
async function runCorpus({ args, sass, sassVersion, compile, install = installCorpus, now, log = console.log }) {
  const extras = fs.readFileSync(path.join(__dirname, '_uxdsl-extras.uxdsl'), 'utf8');

  const root = freshCorpusRoot();
  let failed = false;
  try {
    const { corpus, entryScss, entryUxdsl, renamed } = install(root);

    const delivered = deprecationCounter();
    let compileError = null;
    const piped = () => compile({ entry: entryUxdsl }).catch((error) => {
      compileError = error;
      throw error;
    });
    let timings;
    try {
      timings = await alternate(ROUNDS, () => sass.compile(entryScss, { style: 'expanded', logger: delivered.logger }), piped, now);
    } catch (error) {
      if (error !== compileError) throw error;
      log(`Bootstrap 5.3.8: ${renamed} files renamed to .uxdsl; Dart Sass ${sassVersion}`);
      log(`  corpus root: ${root} (${placement(root)})`);
      log(`  byte-identical: false — compile() failed: ${String(error && error.message).split('\n')[0]}`);
      return false;
    }
    for (const id of Object.keys(delivered.counts)) delivered.counts[id] = Math.round(delivered.counts[id] / ROUNDS);
    const plainWarm = warm(timings.plain.durations);
    const pipedWarm = warm(timings.piped.durations);

    const expected = timings.plain.result.css;
    const actual = timings.piped.result.css;
    const identical = expected === actual;
    log(`Bootstrap 5.3.8: ${renamed} files renamed to .uxdsl, ${timings.plain.result.loadedUrls.length} loaded by the entry; Dart Sass ${sassVersion}`);
    log(`  corpus root: ${root} (${placement(root)})`);
    log(`  Dart Sass: ${Buffer.byteLength(expected)} bytes, median ${Math.round(median(plainWarm))} ms`);
    log(`  compile(): ${Buffer.byteLength(actual)} bytes, median ${Math.round(median(pipedWarm))} ms`);
    log(`  byte-identical: ${identical}`);
    if (!identical) {
      failed = true;
      log(firstDifferences(expected, actual).join('\n'));
    }

    const timing = timingVerdict(plainWarm, pipedWarm, { budget: args.budget });
    log(`  Dart Sass runs: ${runs(timings.plain.durations)} ms; compile() runs: ${runs(timings.piped.durations)} ms (alternated, Dart Sass first)`);
    log(`  timing: compile()'s median is ${timing.ratio.toFixed(2)}x Dart Sass's (budget ${TIMING_BUDGET}x${args.budget ? '' : ', not asserted: --no-timing-budget'}; each median is of the ${ROUNDS - 1} warm runs, the cold first run left out; compile() always runs Dart Sass with its source map)`);
    if (timing.failed) {
      failed = true;
      log(`  FAIL  compile() is over the ${TIMING_BUDGET}x budget (--no-timing-budget reports the ratio without asserting it)`);
    }

    // Untimed, after the timed runs, so that it warms neither compiler.
    const totals = deprecationCounter();
    sass.compile(entryScss, { style: 'expanded', verbose: true, logger: totals.logger });
    log(`  deprecation warnings Dart Sass delivered (capped at five per type, then a summary): ${JSON.stringify(delivered.counts)}`);
    log(`  deprecation totals (verbose): ${JSON.stringify(totals.counts)}`);
    log(`  compile() returned ${timings.piped.result.warnings.length} warnings`);

    // UXDSL on top of Bootstrap's own Sass: Bootstrap's part must not move.
    fs.writeFileSync(path.join(corpus, '_uxdsl-extras.uxdsl'), extras);
    fs.writeFileSync(path.join(corpus, 'with-extras.uxdsl'), '@import "bootstrap";\n@import "uxdsl-extras";\n');
    const mixed = (await compile({ entry: path.join(corpus, 'with-extras.uxdsl') })).css;
    const prefix = mixed.startsWith(expected.replace(/\n+$/, ''));
    const checks = [
      ['Bootstrap\'s CSS is an unchanged prefix', prefix],
      ['.card-x reads its padding from density(4)', /\.card-x\s*\{[^}]*padding:\s*var\(--uxdsl__density__4\)/.test(mixed)],
      ['color(gray.900) resolves inside a Bootstrap-flavoured rule', mixed.includes('var(--uxdsl__color__gray-900)')],
      ['a Surface per $theme-colors entry', ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark'].every((name) => mixed.includes(`.surface-${name}`))],
      ['a Button per mapped tone, Bootstrap\'s danger as UXDSL\'s error', /\.btn-x-danger/.test(mixed) && mixed.includes('--uxdsl__palette__error-main')],
    ];
    for (const [label, ok] of checks) {
      log(`  ${ok ? 'ok' : 'FAIL'}  ${label}`);
      if (!ok) failed = true;
    }
  } finally {
    if (args.keep) log(`Kept ${root}`);
    else removeCorpusRoot(root);
  }
  return !failed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { sass, version: sassVersion } = loadSass(args.sass);
  const { compile } = require(path.join(args.uxdsl, 'dist/entries/index.js'));
  process.exitCode = (await runCorpus({ args, sass, sassVersion, compile })) ? 0 : 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
}

module.exports = { parseArgs, loadSass, timingVerdict, deprecationCounter, firstDifferences, alternate, warm, freshCorpusRoot, removeCorpusRoot, installCorpus, runCorpus, TIMING_BUDGET, ROUNDS, WORK };
