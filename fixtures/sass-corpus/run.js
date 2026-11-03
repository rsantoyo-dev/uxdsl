#!/usr/bin/env node
'use strict';

// The guarantee behind "rename .scss to .uxdsl and it works": Bootstrap 5.3.8's
// SCSS, every file renamed to .uxdsl, compiles through compile() to exactly the
// CSS Dart Sass produces from the original .scss, and a file mixing UXDSL with
// Bootstrap's own variables, functions and mixins compiles on top of it without
// changing Bootstrap's part.
//
// It also times the two in this one process, Dart Sass three times and then
// compile() three times: compile(), which always runs Dart Sass with its source
// map, must take at most 1.5 times Dart Sass's median (--no-timing-budget prints
// the ratio without asserting it). Dart Sass caps its deprecation warnings at
// five per type, so an untimed verbose run counts every one.
//
// Network: installs bootstrap@5.3.8 from the registry into a temporary directory.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../..');
const BOOTSTRAP = 'bootstrap@5.3.8';
const TIMING_BUDGET = 1.5;

function usage() {
  return `Usage: node fixtures/sass-corpus/run.js [--keep] [--sass <path>] [--uxdsl <dir>] [--no-timing-budget]

Compiles Bootstrap 5.3.8's SCSS renamed to .uxdsl with uxdsl's compile(),
compares it byte for byte with Dart Sass's output for the original .scss, then
compiles UXDSL mixed with Bootstrap's own Sass. Times both, three runs each in
one process, Dart Sass first: compile()'s median must be at most ${TIMING_BUDGET}x Dart
Sass's. Exits 1 on any difference (printing the first 10 differing lines), on a
failed mixed check, or over the timing budget.

  --keep              leave the temporary directory (its path is printed)
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

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Runs `fn` `times` times in a row: the last result and every duration, in ms. */
async function timed(times, fn) {
  const durations = [];
  let result;
  for (let i = 0; i < times; i++) {
    const start = process.hrtime.bigint();
    result = await fn();
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return { result, durations };
}

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

const runs = (durations) => durations.map((ms) => Math.round(ms)).join(', ');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { sass, version: sassVersion } = loadSass(args.sass);
  const { compile } = require(path.join(args.uxdsl, 'dist/entries/index.js'));
  const extras = fs.readFileSync(path.join(__dirname, '_uxdsl-extras.uxdsl'), 'utf8');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-corpus-'));
  let failed = false;
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'sass-corpus', version: '1.0.0', private: true }));
    const install = spawnSync('npm', ['install', BOOTSTRAP, '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: tmp, encoding: 'utf8', shell: process.platform === 'win32' });
    if (install.status !== 0) throw new Error(`npm install ${BOOTSTRAP} failed:\n${install.stderr}`);

    const scssDir = path.join(tmp, 'node_modules/bootstrap/scss');
    const corpus = path.join(tmp, 'corpus');
    const renamed = copyRenamed(scssDir, corpus);
    const entryScss = path.join(scssDir, 'bootstrap.scss');

    const delivered = deprecationCounter();
    const plain = await timed(3, () => sass.compile(entryScss, { style: 'expanded', logger: delivered.logger }));
    for (const id of Object.keys(delivered.counts)) delivered.counts[id] = Math.round(delivered.counts[id] / 3);
    let piped;
    try {
      piped = await timed(3, () => compile({ entry: path.join(corpus, 'bootstrap.uxdsl') }, { includeTheme: false }));
    } catch (error) {
      console.log(`Bootstrap 5.3.8: ${renamed} files renamed to .uxdsl; Dart Sass ${sassVersion}: ${Buffer.byteLength(plain.result.css)} bytes, median ${Math.round(median(plain.durations))} ms`);
      console.log(`  byte-identical: false — compile() failed: ${String(error && error.message).split('\n')[0]}`);
      failed = true;
      return;
    }

    const expected = plain.result.css;
    const actual = piped.result.css;
    const identical = expected === actual;
    console.log(`Bootstrap 5.3.8: ${renamed} files renamed to .uxdsl, ${plain.result.loadedUrls.length} loaded by the entry; Dart Sass ${sassVersion}`);
    console.log(`  Dart Sass: ${Buffer.byteLength(expected)} bytes, median ${Math.round(median(plain.durations))} ms`);
    console.log(`  compile(): ${Buffer.byteLength(actual)} bytes, median ${Math.round(median(piped.durations))} ms`);
    console.log(`  byte-identical: ${identical}`);
    if (!identical) {
      failed = true;
      console.log(firstDifferences(expected, actual).join('\n'));
    }

    const timing = timingVerdict(plain.durations, piped.durations, { budget: args.budget });
    console.log(`  Dart Sass runs: ${runs(plain.durations)} ms; compile() runs: ${runs(piped.durations)} ms`);
    console.log(`  timing: compile()'s median is ${timing.ratio.toFixed(2)}x Dart Sass's (budget ${TIMING_BUDGET}x${args.budget ? '' : ', not asserted: --no-timing-budget'}; compile() always runs Dart Sass with its source map)`);
    if (timing.failed) {
      failed = true;
      console.log(`  FAIL  compile() is over the ${TIMING_BUDGET}x budget (--no-timing-budget reports the ratio without asserting it)`);
    }

    // Untimed, after the timed runs, so that it warms neither compiler.
    const totals = deprecationCounter();
    sass.compile(entryScss, { style: 'expanded', verbose: true, logger: totals.logger });
    console.log(`  deprecation warnings Dart Sass delivered (capped at five per type, then a summary): ${JSON.stringify(delivered.counts)}`);
    console.log(`  deprecation totals (verbose): ${JSON.stringify(totals.counts)}`);
    console.log(`  compile() returned ${piped.result.warnings.length} warnings`);

    // UXDSL on top of Bootstrap's own Sass: Bootstrap's part must not move.
    fs.writeFileSync(path.join(corpus, '_uxdsl-extras.uxdsl'), extras);
    fs.writeFileSync(path.join(corpus, 'with-extras.uxdsl'), '@import "bootstrap";\n@import "uxdsl-extras";\n');
    const mixed = (await compile({ entry: path.join(corpus, 'with-extras.uxdsl') }, { includeTheme: false })).css;
    const prefix = mixed.startsWith(expected.replace(/\n+$/, ''));
    const checks = [
      ['Bootstrap\'s CSS is an unchanged prefix', prefix],
      ['.card-x reads its padding from density(4)', /\.card-x\s*\{[^}]*padding:\s*var\(--uxdsl__density__4\)/.test(mixed)],
      ['color(gray.900) resolves inside a Bootstrap-flavoured rule', mixed.includes('var(--uxdsl__color__gray-900)')],
      ['a Surface per $theme-colors entry', ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark'].every((name) => mixed.includes(`.surface-${name}`))],
      ['a Button per mapped tone, Bootstrap\'s danger as UXDSL\'s error', /\.btn-x-danger/.test(mixed) && mixed.includes('--uxdsl__palette__error-main')],
    ];
    for (const [label, ok] of checks) {
      console.log(`  ${ok ? 'ok' : 'FAIL'}  ${label}`);
      if (!ok) failed = true;
    }
  } finally {
    if (args.keep) console.log(`Kept ${tmp}`);
    else fs.rmSync(tmp, { recursive: true, force: true });
    process.exitCode = failed ? 1 : 0;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
}

module.exports = { parseArgs, loadSass, timingVerdict, deprecationCounter, firstDifferences, TIMING_BUDGET };
