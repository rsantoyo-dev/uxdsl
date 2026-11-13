#!/usr/bin/env node
'use strict';

// compile() within 1.5x of Dart Sass, wherever the project is: three checks on
// Bootstrap 5.3.8 renamed to .uxdsl, each with a control that must fail.
//
// - The corpus runner's two verdicts (fixtures/sass-corpus/run.js): a compile()
//   250 ms slower per call exits 1 over the budget, and one that changes a byte
//   exits 1 with `byte-identical: false`. Both runs must also show the runner's
//   method: the corpus root fresh, alone in its directory and outside the
//   temporary directory, four runs of each compiler with the first marked cold,
//   and a ratio that is the three warm runs' medians.
// - compile() equals a base build's css, map, dependencies and warnings in the
//   three sourceMap modes, with the entry as written and, where the filesystem
//   folds case, miscased and through a symlink whose target is in another
//   directory, the link and the directory that holds it written in another
//   case. The corpus writes no `@uxdsl theme;`, so compile() emits no theme
//   for it; a base whose compile() emits the theme without the marker is
//   compiled with that switch off, as the same stylesheet without one. The
//   control, a compile() that changes the case of one dependency, must differ.
// - compile()'s median moves at most 15 ms when the directory that holds the
//   corpus root also holds 129,944 empty entries. The control, a compile() that
//   lists that directory on each call, must move more. It runs last, as long
//   after the entries are written as the run allows, and its default of 61
//   rounds keeps a run-to-run spread of tens of milliseconds well inside the
//   15 ms.
//
// Everything it makes is under one directory of the temporary directory,
// removed at the end, the 129,944 entries included. Network: three installs
// of bootstrap@5.3.8, two by the corpus runner and one here.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { installCorpus } = require('../sass-corpus/run');

const REPO = path.resolve(__dirname, '../..');
const RUNNER = path.join(REPO, 'fixtures/sass-corpus/run.js');
/** Empty entries beside the large copy of the corpus root: the size of the temporary directory the budget was first measured in. */
const ENTRIES = 129944;
/** How far compile()'s median may move between the two copies. */
const MOVE_MS = 15;
/** Measured rounds of the location check by default. */
const ROUNDS = 61;
const SLOW_MS = 250;
const WARMUPS = 2;
const FOLDS_CASE = process.platform === 'darwin' || process.platform === 'win32';
const TITLES = {
  t2: 'MIG-B9-23: run.js fails a compile() 250 ms slower per call, and one that changes a byte (negative control)',
  t3: 'MIG-B9-23: compile()\'s median on the corpus moves at most 15 ms when the directory that holds the corpus root also holds 129,944 empty entries',
  t4: 'MIG-B9-23: the corpus through compile() equals the base build\'s css, map, dependencies and warnings in the three sourceMap modes',
  method: 'MIG-B9-23: run.js compiles the corpus in a fresh directory outside the temporary directory and judges the three warm runs of each compiler, the cold first run left out (decision D8)',
};

function usage() {
  return `Usage: node fixtures/mig-b9-23-compile-budget/run.js --base <dir> [--uxdsl <dir>] [--rounds <n>]

  --base <dir>    a build of the base to compare against: a uxdsl package directory with dist/
  --uxdsl <dir>   the uxdsl package to test; default: the repository build, packages/uxdsl
  --rounds <n>    measured rounds of the location check, after ${WARMUPS} warm-up rounds; at least 9, default ${ROUNDS}
  --help          this text

Exits 0 when every check and every control prints ok, 1 otherwise, 2 on a usage error.
Needs network access to install bootstrap@5.3.8.`;
}

function parseArgs(argv) {
  const args = { base: null, uxdsl: path.join(REPO, 'packages/uxdsl'), rounds: ROUNDS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { console.log(usage()); process.exit(0); }
    else if (arg === '--base') args.base = path.resolve(argv[++i]);
    else if (arg === '--uxdsl') args.uxdsl = path.resolve(argv[++i]);
    else if (arg === '--rounds') args.rounds = Number(argv[++i]);
    else { console.error(`Unknown argument ${arg}.\n\n${usage()}`); process.exit(2); }
  }
  if (!args.base) { console.error(`--base is required.\n\n${usage()}`); process.exit(2); }
  if (!Number.isInteger(args.rounds) || args.rounds < 9) { console.error(`--rounds must be an integer of at least 9.\n\n${usage()}`); process.exit(2); }
  for (const dir of [args.base, args.uxdsl]) {
    if (!fs.existsSync(path.join(dir, 'dist/entries/index.js'))) { console.error(`${dir} has no dist/entries/index.js: build it first.`); process.exit(2); }
  }
  return args;
}

let failures = 0;
function report(ok, title, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${title}${detail ? `: ${detail}` : ''}`);
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const load = () => os.loadavg().map((value) => value.toFixed(2)).join(' ');

/** A package directory whose dist/entries/index.js is `uxdsl`'s, with compile() followed by `after(result)`. */
function wrapper(dir, uxdsl, after) {
  const file = path.join(dir, 'dist/entries/index.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [
    "'use strict';",
    `const real = require(${JSON.stringify(path.join(uxdsl, 'dist/entries/index.js'))});`,
    'module.exports = { ...real, compile: async (...args) => {',
    '  const result = await real.compile(...args);',
    `  ${after}`,
    '  return result;',
    '} };',
    '',
  ].join('\n'));
  return dir;
}

/** The corpus runner on a wrapped compile(): its exit status and output. */
function runner(uxdsl) {
  const run = spawnSync(process.execPath, [RUNNER, '--uxdsl', uxdsl], { cwd: REPO, encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

/**
 * What one run of the corpus runner shows of its method: the problems found in
 * its output, none when its corpus root is fresh, alone in its directory and
 * outside the temporary directory, each compiler ran four times with the first
 * marked cold, and its ratio is the warm runs' medians, within the rounding of
 * the printed milliseconds.
 */
function methodProblems(out) {
  const problems = [];
  const root = /^ {2}corpus root: .+ \((.+)\)$/m.exec(out);
  if (!root) problems.push('no corpus root line');
  else if (root[1] !== 'fresh, alone in its directory, outside the temporary directory') problems.push(`corpus root ${root[1]}`);
  const runs = /Dart Sass runs: (.+) ms; compile\(\) runs: (.+) ms \(alternated, Dart Sass first\)/.exec(out);
  const ratio = /compile\(\)'s median is ([\d.]+)x/.exec(out);
  if (!runs || !ratio) return [...problems, 'no runs line or no ratio'];
  const warmRuns = (list) => {
    const shape = /^\d+ \(cold, discarded\), (\d+), (\d+), (\d+)$/.exec(list);
    return shape ? shape.slice(1).map(Number) : null;
  };
  const plain = warmRuns(runs[1]);
  const piped = warmRuns(runs[2]);
  if (!plain || !piped) return [...problems, `not four runs each with the first marked cold: ${runs[0]}`];
  // Each printed duration is rounded to the millisecond, and the ratio to two decimals.
  const p = median(plain);
  const c = median(piped);
  const printed = Number(ratio[1]);
  if (printed < (c - 0.5) / (p + 0.5) - 0.005 || printed > (c + 0.5) / (p - 0.5) + 0.005) problems.push(`the ratio ${ratio[1]}x is not the warm runs' medians, ${c} over ${p} ms`);
  return problems;
}

function t2(work, uxdsl) {
  const slow = runner(wrapper(path.join(work, 'wrappers/slow'), uxdsl, `await new Promise((resolve) => setTimeout(resolve, ${SLOW_MS}));`));
  const ratio = (/compile\(\)'s median is ([\d.]+)x/.exec(slow.out) || [])[1];
  const slowOk = slow.status === 1 && slow.out.includes('byte-identical: true') && slow.out.includes('FAIL  compile() is over the 1.5x budget');
  report(slowOk, TITLES.t2, `a compile() ${SLOW_MS} ms slower per call exits ${slow.status}, ${ratio ? `${ratio}x` : 'no ratio printed'}, "FAIL  compile() is over the 1.5x budget"${slowOk ? '' : ` not printed:\n${slow.out}`}`);
  const byte = runner(wrapper(path.join(work, 'wrappers/byte'), uxdsl, "result.css = result.css.slice(0, -1) + (result.css.endsWith('x') ? 'y' : 'x');"));
  const byteOk = byte.status === 1 && byte.out.includes('byte-identical: false');
  report(byteOk, TITLES.t2, `a compile() that changes the last byte of its css exits ${byte.status}${byteOk ? ' with "byte-identical: false"' : `, "byte-identical: false" not printed:\n${byte.out}`}`);
  const problems = [...methodProblems(slow.out).map((problem) => `the slow run: ${problem}`), ...methodProblems(byte.out).map((problem) => `the changed-byte run: ${problem}`)];
  report(problems.length === 0, TITLES.method, problems.length === 0 ? 'both runs printed the corpus root fresh, alone in its directory and outside the temporary directory, four runs of each compiler with the first marked cold, and the warm runs\' ratio' : problems.join('; '));
}

/** compile()'s median on each copy of the corpus root, interleaved, the order swapped each round. */
async function medians(compile, roots, rounds) {
  const times = { small: [], large: [] };
  for (let round = 0; round < WARMUPS + rounds; round++) {
    for (const where of round % 2 === 0 ? ['small', 'large'] : ['large', 'small']) {
      const start = process.hrtime.bigint();
      await compile({ entry: path.join(roots[where], 'corpus/bootstrap.uxdsl') });
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (round >= WARMUPS) times[where].push(ms);
    }
  }
  const small = median(times.small);
  const large = median(times.large);
  return { small, large, move: large - small };
}

const ms = (value) => `${value.toFixed(1)} ms`;
const signed = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)} ms`;

async function t3(roots, compile, rounds, written) {
  const entries = (where) => fs.readdirSync(path.dirname(roots[where])).length;
  console.log(`  the small directory holds ${entries('small')} entry, the large one ${entries('large')}; ${WARMUPS} warm-up rounds, then ${rounds}; ${Math.round((Date.now() - written) / 1000)} s after the entries were written; load ${load()}`);
  // The control lists the directory that holds the compiled copy's corpus root on each call. It
  // runs first, so the check itself starts later still after the entries were written.
  const listing = (input, config) => {
    fs.readdirSync(path.dirname(path.dirname(path.dirname(input.entry))));
    return compile(input, config);
  };
  const planted = await medians(listing, roots, rounds);
  report(Math.abs(planted.move) > MOVE_MS, `${TITLES.t3} (planted control: a compile() that lists the directory holding the corpus root on each call fails it)`, `small ${ms(planted.small)}, large ${ms(planted.large)}, ${signed(planted.move)}`);
  console.log(`  ${Math.round((Date.now() - written) / 1000)} s after the entries were written; load ${load()}`);
  const real = await medians(compile, roots, rounds);
  report(Math.abs(real.move) <= MOVE_MS, TITLES.t3, `small ${ms(real.small)}, large ${ms(real.large)}, ${signed(real.move)} (at most ${MOVE_MS} ms either way)`);
  console.log(`  load ${load()}`);
}

const pick = (result) => ({
  css: result.css,
  map: result.map,
  dependencies: result.dependencies,
  warnings: result.warnings.map(({ text, file, line, column }) => ({ text, file, line, column })),
});

/**
 * The config a base build's compile() takes for the corpus. A base that emits
 * the theme without `@uxdsl theme;` (its compile() reports no `themeEmitted`
 * for a stylesheet without the marker, or reports `true`) is compiled with its
 * theme switch off, which is how a stylesheet without the marker compiles now;
 * any other base takes no option.
 */
async function baseConfigFor(base, work) {
  const probe = await base.compile({ source: '.a{}', from: path.join(work, 'probe.uxdsl') });
  return probe.themeEmitted === false ? {} : { includeTheme: false };
}

/** The fields of `a` and `b` that differ. */
function differences(a, b) {
  return Object.keys(a).filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
}

async function t4(work, root, base, candidate) {
  const baseConfig = await baseConfigFor(base, work);
  console.log(`  the base compiles the corpus with ${JSON.stringify(baseConfig)}, the candidate with no option`);
  const entries = [['the entry as written', path.join(root, 'corpus/bootstrap.uxdsl')]];
  if (FOLDS_CASE) {
    const links = path.join(work, 'links');
    fs.mkdirSync(links);
    fs.symlinkSync(root, path.join(links, 'Linked-Root'), 'junction');
    entries.push(['the entry miscased', path.join(path.dirname(root), path.basename(root).toUpperCase(), 'CORPUS/Bootstrap.UXDSL')]);
    entries.push(['the entry through a symlink whose target is in another directory, the link and its directory written in another case', path.join(work, 'LINKS/LINKED-ROOT/corpus/BOOTSTRAP.uxdsl')]);
  }
  for (const sourceMap of [false, 'inline', 'external']) {
    for (const [label, entry] of entries) {
      const a = pick(await candidate.compile({ entry }, { sourceMap }));
      const b = pick(await base.compile({ entry }, { ...baseConfig, sourceMap }));
      const differ = differences(a, b);
      report(differ.length === 0, TITLES.t4, `sourceMap ${JSON.stringify(sourceMap)}, ${label}: ${differ.length === 0 ? 'equal' : `${differ.join(', ')} differ`} (${Buffer.byteLength(a.css)} bytes of css, ${a.dependencies.length} dependencies, ${a.warnings.length} warnings)`);
    }
  }
  if (!FOLDS_CASE) console.log(`skip  ${TITLES.t4}: the entry miscased and through a symlink written in another case: the filesystem does not fold case on ${process.platform}`);
  // The control changes the case of one dependency, as a spelling that differs from the base's would.
  const entry = entries[0][1];
  const recased = pick(await candidate.compile({ entry }));
  recased.dependencies = recased.dependencies.map((file, index) => (index === 1 ? path.join(path.dirname(file), path.basename(file).toUpperCase()) : file));
  const differ = differences(recased, pick(await base.compile({ entry }, baseConfig)));
  report(differ.join() === 'dependencies', `${TITLES.t4} (negative control: a compile() that changes the case of one dependency fails it)`, differ.length === 0 ? 'no difference found' : `${differ.join(', ')} differ`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const candidate = require(path.join(args.uxdsl, 'dist/entries/index.js'));
  const base = require(path.join(args.base, 'dist/entries/index.js'));
  console.log(`uxdsl: ${args.uxdsl}\nbase:  ${args.base}\n${new Date().toString()}, ${os.platform()} ${os.release()}, Node ${process.version}, load ${load()}`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-compile-budget-'));
  try {
    // The empty entries first, so the system has settled from writing them by the time compile() is timed.
    const large = path.join(work, 'large');
    fs.mkdirSync(large);
    for (let i = 0; i < ENTRIES; i++) fs.closeSync(fs.openSync(path.join(large, `entry-${String(i).padStart(6, '0')}`), 'w'));
    const written = Date.now();
    const roots = { small: path.join(work, 'small/corpus-root'), large: path.join(large, 'corpus-root') };
    fs.mkdirSync(roots.small, { recursive: true });
    installCorpus(roots.small);
    fs.cpSync(roots.small, roots.large, { recursive: true });
    console.log(`  ${ENTRIES} empty entries written; the corpus installed in ${path.dirname(roots.small)} and copied beside them`);

    console.log('\nThe corpus runner\'s verdicts can fail, and its runs show its method:');
    t2(work, args.uxdsl);
    console.log('\nThe output is the base build\'s:');
    await t4(work, roots.small, base, candidate);
    console.log('\nWherever the project is:');
    await t3(roots, candidate.compile, args.rounds, written);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  console.log(failures === 0 ? '\nAll checks ok.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
