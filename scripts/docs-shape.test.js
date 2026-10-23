'use strict';

// The files a visitor reads to decide whether UXDSL is maintained exist and stay
// within their size, and the root README sends readers to product documentation,
// never to the internal history under docs/features or docs/audits.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const lineCount = (text) => text.replace(/\n$/, '').split('\n').length;

const REQUIRED = [
  'STABILITY.md',
  'docs/ROADMAP.md',
  'docs/README.md',
  'docs/releases/README.md',
  '.github/ISSUE_TEMPLATE/bug.yml',
  '.github/ISSUE_TEMPLATE/question.yml',
  '.github/ISSUE_TEMPLATE/idea.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
];

/** Markdown link targets in `text` that point into the internal history folders. */
function historyLinks(text) {
  return [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]).filter((target) => /(^|\/)docs\/(features|audits)\//.test(target));
}

test('MIG-B9-53: the stability policy, roadmap, docs indexes and issue templates exist', () => {
  for (const file of REQUIRED) assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is missing`);
  assert.ok(lineCount(read('STABILITY.md')) <= 80, 'STABILITY.md is at most 80 lines');
  assert.ok(lineCount(read('docs/ROADMAP.md')) <= 60, 'docs/ROADMAP.md is at most 60 lines');
  assert.match(read('.github/ISSUE_TEMPLATE/config.yml'), /^blank_issues_enabled: false$/m);
});

test('MIG-B9-53: every release record is listed in docs/releases/README.md', () => {
  const index = read('docs/releases/README.md');
  const records = fs.readdirSync(path.join(ROOT, 'docs/releases')).filter((file) => /^0\.\d+\.\d+.*\.md$/.test(file));
  for (const record of records) assert.ok(index.includes(`(${record})`), `${record} is not in the releases index`);
});

test('MIG-B9-53: the root README links the project files and no internal history', () => {
  const readme = read('README.md');
  for (const target of ['STABILITY.md', 'docs/ROADMAP.md', 'docs/releases/README.md', 'docs/README.md', 'issues/new/choose']) {
    assert.ok(readme.includes(target), `README.md links ${target}`);
  }
  assert.deepEqual(historyLinks(readme), []);
});

test('MIG-B9-53 (negative control): a README link into docs/features is caught', () => {
  assert.deepEqual(historyLinks('See [the plan](docs/features/FEAT-010-beta9.md) and [records](docs/releases/README.md).'), ['docs/features/FEAT-010-beta9.md']);
});
