#!/usr/bin/env node
'use strict';

// MIG-B9-10 (FEAT-010): the guarantee behind "rename .scss to .uxdsl and it works".
// Bootstrap 5.3.8's SCSS, every file renamed to .uxdsl, must compile through
// compile() to exactly the CSS Dart Sass produces from the original .scss.
// Then a file mixing UXDSL with Bootstrap's own variables, functions and mixins
// must compile on top of it without changing Bootstrap's part.
//
// Network: installs bootstrap@5.3.8 from the registry into a temporary directory.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../..');
const BOOTSTRAP = 'bootstrap@5.3.8';

function usage() {
  return `Usage: node fixtures/sass-corpus/run.js [--keep] [--sass <path>] [--uxdsl <dir>]

Compiles Bootstrap 5.3.8's SCSS renamed to .uxdsl with uxdsl's compile() and
compares it byte for byte with Dart Sass's output for the original .scss.
Exits 1 on any difference, printing the first 10 differing lines.

  --keep          leave the temporary directory (its path is printed)
  --sass <path>   the Dart Sass package to compare against (a directory or its
                  package.json); default: the repository's own copy
  --uxdsl <dir>   the uxdsl package to test (an installed tarball's directory);
                  default: the repository build, packages/uxdsl
  --help          this text

Needs network access to install ${BOOTSTRAP}.`;
}

function parseArgs(argv) {
  const args = { keep: false, sass: null, uxdsl: path.join(REPO, 'packages/uxdsl') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { console.log(usage()); process.exit(0); }
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--sass') args.sass = path.resolve(argv[++i]);
    else if (arg === '--uxdsl') args.uxdsl = path.resolve(argv[++i]);
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

async function timed(times, fn) {
  const durations = [];
  let result;
  for (let i = 0; i < times; i++) {
    const start = process.hrtime.bigint();
    result = await fn();
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return { result, ms: Math.round(median(durations)) };
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

const EXTRAS = fs.readFileSync(path.join(__dirname, '_uxdsl-extras.uxdsl'), 'utf8');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { sass, version: sassVersion } = loadSass(args.sass);
  const { compile } = require(path.join(args.uxdsl, 'dist/entries/index.js'));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-corpus-'));
  let failed = false;
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'sass-corpus', version: '1.0.0', private: true }));
    const install = spawnSync('npm', ['install', BOOTSTRAP, '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: tmp, encoding: 'utf8', shell: process.platform === 'win32' });
    if (install.status !== 0) throw new Error(`npm install ${BOOTSTRAP} failed:\n${install.stderr}`);

    const scssDir = path.join(tmp, 'node_modules/bootstrap/scss');
    const corpus = path.join(tmp, 'corpus');
    const renamed = copyRenamed(scssDir, corpus);

    const deprecations = {};
    const logger = { warn(_message, options = {}) { const id = options.deprecationType ? options.deprecationType.id : 'other'; deprecations[id] = (deprecations[id] || 0) + 1; }, debug() {} };
    const plain = await timed(3, () => sass.compile(path.join(scssDir, 'bootstrap.scss'), { style: 'expanded', logger }));
    for (const id of Object.keys(deprecations)) deprecations[id] = Math.round(deprecations[id] / 3);
    let piped;
    try {
      piped = await timed(3, () => compile({ entry: path.join(corpus, 'bootstrap.uxdsl') }, { includeTheme: false }));
    } catch (error) {
      console.log(`Bootstrap 5.3.8: ${renamed} files renamed to .uxdsl; Dart Sass ${sassVersion}: ${Buffer.byteLength(plain.result.css)} bytes, median ${plain.ms} ms`);
      console.log(`  byte-identical: false — compile() failed: ${String(error && error.message).split('\n')[0]}`);
      failed = true;
      return;
    }

    const expected = plain.result.css;
    const actual = piped.result.css;
    const identical = expected === actual;
    console.log(`Bootstrap 5.3.8: ${renamed} files renamed to .uxdsl, ${plain.result.loadedUrls.length} loaded by the entry; Dart Sass ${sassVersion}`);
    console.log(`  Dart Sass: ${Buffer.byteLength(expected)} bytes, median ${plain.ms} ms`);
    console.log(`  compile(): ${Buffer.byteLength(actual)} bytes, median ${piped.ms} ms`);
    console.log(`  deprecation warnings from Bootstrap's sources: ${JSON.stringify(deprecations)}`);
    console.log(`  byte-identical: ${identical}`);
    if (!identical) {
      failed = true;
      console.log(firstDifferences(expected, actual).join('\n'));
    }

    // UXDSL on top of Bootstrap's own Sass: Bootstrap's part must not move.
    fs.writeFileSync(path.join(corpus, '_uxdsl-extras.uxdsl'), EXTRAS);
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

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
