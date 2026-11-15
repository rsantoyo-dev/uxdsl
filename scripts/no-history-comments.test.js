'use strict';

// Source comments under packages/uxdsl/src and in bin/uxdsl.js state what the
// code does and why. A comment that names a story, a review or audit finding,
// a phase, a date, a release or a story item is reported as file:line with the
// rule and the text it matched. Only comments are read, through the TypeScript
// parser, so the same text in a string, a template literal or a regular
// expression is never reported; a URL in a comment is ignored, and so is a
// path to a fixture directory that exists. A story id is matched in any case.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const ts = require(require.resolve('typescript', { paths: [path.join(REPO, 'packages', 'uxdsl')] }));

const RULES = [
  ['story id', /\b(?:MIG|FEAT|DEC)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/i],
  ['review or audit id', /\b(?:D|DE|HB|CT|RR|DGE|R)-\d+\b|\baudit (?:finding )?[A-Z]{1,3}\d+\b/],
  ['phase', /\bstability phase\b|\bphase \d+\b/i],
  ['date', /\b20\d\d-[01]\d-[0-3]\d\b/],
  ['release', /\bbeta\.\d+\b|\b\d+\.\d+\.\d+-(?:alpha|beta|rc)\b/],
  ['story item', /\bitems? \d+\b/],
];
const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
// A fixture directory may carry a story's name; a path to one that exists is a
// place a reader can open, so it is not reported. One that does not exist is.
const FIXTURE_PATH_PATTERN = /\bfixtures\/[A-Za-z0-9._-]+/g;
const withoutFixturePaths = (line) => line.replace(FIXTURE_PATH_PATTERN, (found) => (fs.existsSync(path.join(REPO, found)) ? '' : found));

/** Every comment of a file, once each, with the line it starts on. */
function commentsOf(fileName, text) {
  const kind = fileName.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const seen = new Set();
  const comments = [];
  const take = (ranges) => {
    for (const range of ranges || []) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      comments.push({ pos: range.pos, text: text.slice(range.pos, range.end) });
    }
  };
  const visit = (node) => {
    take(ts.getLeadingCommentRanges(text, node.getFullStart()));
    take(ts.getTrailingCommentRanges(text, node.getEnd()));
    node.getChildren(source).forEach(visit);
  };
  visit(source);
  return comments
    .sort((a, b) => a.pos - b.pos)
    .map((comment) => ({ line: source.getLineAndCharacterOfPosition(comment.pos).line + 1, text: comment.text }));
}

/** The history a file's comments name: [{ file, line, rule, match, text }]. */
function findHistory(fileName, text) {
  const found = [];
  for (const comment of commentsOf(fileName, text)) {
    comment.text.split('\n').forEach((raw, index) => {
      const line = withoutFixturePaths(raw.replace(URL_PATTERN, ''));
      for (const [rule, pattern] of RULES) {
        const match = line.match(pattern);
        if (match) found.push({ file: fileName, line: comment.line + index, rule, match: match[0], text: raw.trim() });
      }
    });
  }
  return found;
}

function scannedFiles() {
  return execFileSync('git', ['ls-files', '--', 'packages/uxdsl/src/*.ts', 'packages/uxdsl/bin/uxdsl.js'], { cwd: REPO, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

const reported = (text, fileName = 'sample.ts') => findHistory(fileName, text).map((hit) => `${hit.line}:${hit.rule}`);

test('MIG-B9-21: no source comment under packages/uxdsl/src or bin names a story id, a phase or a date', () => {
  const files = scannedFiles();
  assert.ok(files.includes('packages/uxdsl/bin/uxdsl.js'), 'bin/uxdsl.js is scanned');
  assert.ok(files.includes('packages/uxdsl/src/compile.ts'), 'src/compile.ts is scanned');
  let comments = 0;
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');
    comments += commentsOf(file, text).length;
    hits.push(...findHistory(file, text));
  }
  assert.ok(comments > 2000, `the scan reads the comments (${comments} found)`);
  assert.deepEqual(
    hits.map((hit) => `${hit.file}:${hit.line} [${hit.rule}: ${hit.match}] ${hit.text}`),
    [],
    'state the behavior or the reason, not the story, phase, date or release that introduced it'
  );
});

test('MIG-B9-21: a planted history comment is reported at its line, one sample per rule', () => {
  const sample = [
    '// MIG-B6-17: planted',
    '/* stability phase 2 */',
    'const a = 1; // 2026-11-13',
    '/** FEAT-008 */',
    '// audit T6 and audit finding T3',
    "// beta.4's behavior",
    '// decision D-1, DE-7',
    '// per item 4 of the story',
    'function f() {',
    '  return 1; /* DEC-17 */',
    '}',
    '/*',
    ' * line two',
    ' * MIG-B9-21 on line 14',
    ' */',
    'export {};',
  ].join('\n');
  assert.deepEqual(reported(sample), [
    '1:story id', '2:phase', '3:date', '4:story id', '5:review or audit id', '6:release',
    '7:review or audit id', '8:story item', '10:story id', '14:story id',
  ]);
  assert.deepEqual(reported('#!/usr/bin/env node\n// MIG-B6-17: in a script\n', 'bin.js'), ['2:story id']);
});

test('MIG-B9-21: a story id in lowercase is reported, and a path to a fixture that exists is not', () => {
  const sample = [
    "// the mig-b2-05-release fixture's partial override",
    '// what fixtures/mig-b2-03-cli-init/ pins',
    '// what fixtures/mig-b0-99-not-a-fixture/ pins',
    '/* see feat-008 */',
    'export {};',
  ].join('\n');
  assert.deepEqual(reported(sample), ['1:story id', '3:story id', '4:story id']);
});

test('MIG-B9-21: the same text in a string, a template literal, a regular expression or a URL is not reported', () => {
  const sample = [
    "const s = '// MIG-B6-17: in a string';",
    'const t = `// FEAT-008 ${1} /* stability phase 2 */`;',
    'const r = /\\/\\/ MIG-B6-17/;',
    '// see https://example.com/MIG-B6-17/2026-11-13 for the format',
    "const h = '// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY';",
    'export {};',
  ].join('\n');
  assert.deepEqual(reported(sample), []);
  assert.deepEqual(reported("#!/usr/bin/env node\n'use strict';\nconst x = '/* MIG-B1-01 */';\n", 'bin.js'), []);
});
