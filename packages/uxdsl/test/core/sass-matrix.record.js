#!/usr/bin/env node
'use strict';

// MIG-B9-10 (FEAT-010): records the expectations of the Sass matrix
// (sass-matrix.cases.js) from the two compilers that define them, and rewrites
// the cases file deterministically.
//
//   node test/core/sass-matrix.record.js            # report drift, exit 1 on any
//   node test/core/sass-matrix.record.js --update   # rewrite the cases file
//
// A case belongs to one of three groups (its `group` field):
// - `sass`: the source has no UXDSL construct. Its expectation is what Dart
//   Sass itself produces for it — the `sass` package compiled directly, no
//   UXDSL — as CSS (`{ css }`, normalized) or as its error (`{ error:
//   'UXD_SASS', sass: <Sass's message> }`). The recorder refuses to put a
//   source with a UXDSL construct in this group.
// - `today`: the source is UXDSL (`sass-tol-*`, `interact-*`, …) on which
//   Dart Sass is structurally a no-op (no nesting to flatten, no `#{}` or
//   `$var` whose value Sass would print differently). Its expectation is what
//   `compile()` produces today, byte for byte after normalize(); the UXDSL
//   semantics do not change with the pipeline.
// - `mixed`: Sass constructs and UXDSL constructs together, where the pipeline's
//   output is Sass's structure (flattened nesting, evaluated mixins) with the
//   UXDSL constructs then resolved by the plugin. Neither compiler alone
//   produces it, so it is recorded by hand from the two parts and marked
//   `reviewed: true`; the recorder keeps it as written.
//
// `normalize()` is the old matrix's (scss-subset.test.js), so the literals stay
// comparable with the ones recorded before the pipeline.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CASES_FILE = path.join(__dirname, 'sass-matrix.cases.js');
const FIXTURES = path.join(__dirname, 'fixtures/scss-subset');

const normalize = (css) => css.replace(/\s+/g, ' ').trim();

/** The installed Dart Sass's version. `sass`'s `exports` map does not expose its
 * package.json, so it is read next to the resolved entry file. */
function sassVersion() {
  let dir = path.dirname(require.resolve('sass'));
  while (!fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir);
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
}

/** The UXDSL constructs Dart Sass cannot be the oracle for. */
const UXDSL_CONSTRUCT = /\b(?:space|density|palette|color|radius|border|shadow|tone|xs|sm|md|lg|xl)\(|@ds-|@uxdsl\b|\.uxdsl\b/i;

const silentLogger = { warn() {}, debug() {} };

/** A fresh directory holding the matrix fixtures (`_partial.scss`, `partial-vars.uxdsl`, `plain.css`). */
function fixtureDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const file of fs.readdirSync(FIXTURES)) fs.copyFileSync(path.join(FIXTURES, file), path.join(dir, file));
  return dir;
}

let sassDir;
/** Dart Sass's own result for a source: `{ css }` (normalized) or `{ error: <Sass's message> }`. */
function liveSass(name, source) {
  const sass = require('sass');
  if (!sassDir) sassDir = fixtureDir('uxdsl-sass-matrix-sass-');
  const file = path.join(sassDir, `${name}.scss`);
  fs.writeFileSync(file, source + '\n');
  try {
    return { css: normalize(sass.compile(file, { style: 'expanded', logger: silentLogger }).css) };
  } catch (error) {
    const message = error.sassMessage || String(error.message).split('\n')[0];
    const located = error.span && error.span.start ? `${error.span.start.line + 1}:${error.span.start.column + 1}` : null;
    return { error: message, at: located };
  }
}

const codeOf = (message) => (/\b(UXD_[A-Z0-9_]+)\b/.exec(String(message)) || [])[1] || String(message).split('\n')[0];

let todayDir;
/** Today's `compile()` for a source, `includeTheme: false`: `{ css }` (normalized) or `{ error: <code> }`. */
async function today(name, source) {
  const core = require('../../dist/entries/index.js');
  if (!todayDir) todayDir = fixtureDir('uxdsl-sass-matrix-today-');
  const entry = path.join(todayDir, `${name}.uxdsl`);
  fs.writeFileSync(entry, source + '\n');
  try {
    return { css: normalize((await core.compile({ entry }, { includeTheme: false })).css) };
  } catch (error) {
    return { error: codeOf(error.message) };
  }
}

/** The expectation a case should carry, per its group. */
async function expectationFor([name, source, expected, meta]) {
  if (meta.group === 'sass') {
    if (UXDSL_CONSTRUCT.test(source)) throw new Error(`${name}: a source with a UXDSL construct cannot be in the "sass" group; Dart Sass is not its oracle`);
    const live = liveSass(name, source);
    return live.css !== undefined ? { css: live.css } : { error: 'UXD_SASS', sass: live.error };
  }
  if (meta.group === 'today') return today(name, source);
  if (meta.group === 'mixed') {
    if (!meta.reviewed) throw new Error(`${name}: a "mixed" case is recorded by hand and marked reviewed`);
    return expected;
  }
  throw new Error(`${name}: unknown group ${JSON.stringify(meta.group)}`);
}

const q = JSON.stringify;
const obj = (value) => '{ ' + Object.entries(value).map(([key, item]) => `${key}: ${q(item)}`).join(', ') + ' }';

function render(cases, expectedErrors, sassVersion) {
  const lines = [];
  let section = '';
  for (const [name, source, expected, meta] of cases) {
    const prefix = name.replace(/-\d+.*$/, '');
    if (prefix !== section) { if (section) lines.push(''); lines.push(`  // --- ${prefix}`); section = prefix; }
    lines.push(`  [${q(name)}, ${q(source)}, ${obj(expected)}, ${obj(meta)}],`);
  }
  return `'use strict';

// MIG-B9-10 (FEAT-010): the Sass matrix — the 110 cases of scss-subset.test.js,
// same names and sources, re-expected to what compile() must produce once it
// runs on Dart Sass (MIG-B9-13). Generated by sass-matrix.record.js; do not edit
// a "sass" or "today" expectation by hand (run \`node test/core/sass-matrix.record.js
// --update\`); a "mixed" case is recorded by hand there and marked reviewed.
//
// Each case is [name, source, expectation, meta]:
// - expectation: { css } — compile()'s output after normalize() — or
//   { error: <UXD_* code> }; an invalid-Sass source is { error: "UXD_SASS",
//   sass: <Dart Sass's message> }.
// - meta.group: "sass" (Dart Sass is the oracle), "today" (compile()'s output
//   today, byte for byte), "mixed" (recorded by hand from the two parts).
// - meta.reviewed: the expectation was written and checked by hand.
// - meta.authorValue: the author wrote a value that is not valid CSS on purpose;
//   the output's grammar is not checked for it.
// - meta.note: why the expectation is what it is, where it is not obvious.
//
// Recorded with sass ${sassVersion} (Dart Sass, expanded style).

const CASES = [
${lines.join('\n')}
];

// The number of sources Dart Sass rejects: the cases whose error is UXD_SASS.
const expectedErrors = ${expectedErrors};

module.exports = { CASES, expectedErrors, SASS_VERSION: ${q(sassVersion)} };
`;
}

async function recordAll(cases) {
  const next = [];
  for (const entry of cases) {
    const [name, source, , meta] = entry;
    next.push([name, source, await expectationFor(entry), meta]);
  }
  return next;
}

async function main(argv) {
  const update = argv.includes('--update');
  const current = require(CASES_FILE);
  const recorded = await recordAll(current.CASES);
  const expectedErrors = recorded.filter(([, , expected]) => expected.error === 'UXD_SASS').length;
  const version = sassVersion();
  const text = render(recorded, expectedErrors, version);
  const existing = fs.readFileSync(CASES_FILE, 'utf8');
  if (text === existing) { console.log(`sass-matrix.cases.js is up to date (${recorded.length} cases, ${expectedErrors} invalid-Sass sources, sass ${version}).`); return 0; }
  if (update) {
    fs.writeFileSync(CASES_FILE, text);
    console.log(`sass-matrix.cases.js written (${recorded.length} cases, ${expectedErrors} invalid-Sass sources, sass ${version}).`);
    return 0;
  }
  for (let i = 0; i < recorded.length; i++) {
    const before = JSON.stringify(current.CASES[i][2]);
    const after = JSON.stringify(recorded[i][2]);
    if (before !== after) console.log(`${recorded[i][0]}\n  recorded: ${before}\n  now:      ${after}`);
  }
  console.log('sass-matrix.cases.js differs from what the recorder produces; run with --update to rewrite it.');
  return 1;
}

module.exports = { normalize, liveSass, today, sassVersion, UXDSL_CONSTRUCT, CASES_FILE };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(error.stack || error); process.exitCode = 1; });
}
