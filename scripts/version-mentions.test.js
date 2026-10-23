'use strict';

// A version string that describes the next release ages the moment that release
// is published or renumbered. This test catches the two shapes stale version
// facts have taken in this repository, outside the folders that are history by
// design (feature stories, audits, release records, the CHANGELOG):
//
// 1. a version below the package's own that is still described as unreleased,
//    or pinned to a date ("as of 2026-…") instead of to a release;
// 2. a version that was never published (0.5.0-beta.7) named without saying so.
//
// A true sentence about history — "until 0.5.0-beta.6 this was a separate
// package" — passes: its version is below the current one and claims nothing
// about the future.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NEVER_PUBLISHED = new Set(['0.5.0-beta.7']);
const TEXT = /\.(md|mdx|json|js|cjs|mjs|ts|tsx|yml|yaml)$/;
const HISTORY = [/^docs\/(features|audits|releases)\//, /^packages\/uxdsl\/CHANGELOG\.md$/, /(^|\/)node_modules\//, /^scripts\/version-mentions\.test\.js$/];
const STALE_CLAIM = /\bunreleased\b|\bnot (yet )?published\b|\bas of 20\d\d\b/i;
const SAYS_NEVER = /\bnever\b|\bno `?0\.5\.0-beta\.\d+`? was\b|-dev\b|not published/i;

function betaNumber(version) {
  const match = /^0\.5\.0-beta\.(\d+)/.exec(version);
  return match ? Number(match[1]) : null;
}

/** Splits text into sentences: a blank line, or a sentence end followed by a capital, a heading or a list mark. */
function sentences(text) {
  return text.replace(/\r/g, '').split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z`(*#[-])/);
}

/** Returns `[file, sentence]` pairs whose version mention is stale for `current` (a beta number). */
function findStaleMentions(files, current) {
  const stale = [];
  for (const { file, text } of files) {
    if (HISTORY.some((pattern) => pattern.test(file))) continue;
    for (const sentence of sentences(text)) {
      for (const match of sentence.matchAll(/0\.5\.0-beta\.(\d+)/g)) {
        const version = match[0];
        const n = Number(match[1]);
        const neverPublished = NEVER_PUBLISHED.has(version) && !SAYS_NEVER.test(sentence);
        const claimsFuture = n < current && STALE_CLAIM.test(sentence);
        if (neverPublished || claimsFuture) {
          stale.push([file, sentence.replace(/\s+/g, ' ').trim().slice(0, 200)]);
          break;
        }
      }
    }
  }
  return stale;
}

function trackedTextFiles() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((file) => TEXT.test(file) && fs.existsSync(path.join(ROOT, file)))
    .map((file) => ({ file, text: fs.readFileSync(path.join(ROOT, file), 'utf8') }));
}

const current = betaNumber(JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/uxdsl/package.json'), 'utf8')).version);

test('MIG-B9-01: no file outside the history folders states a stale version fact', () => {
  assert.equal(typeof current, 'number', 'packages/uxdsl/package.json carries a 0.5.0-beta.N version');
  assert.deepEqual(findStaleMentions(trackedTextFiles(), current), []);
});

test('MIG-B9-01 (negative control): a planted stale mention is caught, history is not', () => {
  const planted = [
    { file: 'packages/uxdsl/README.md', text: 'It ships in `0.5.0-beta.7`, its first release.' },
    { file: 'AGENTS.md', text: 'From `0.5.0-beta.8` (unreleased as of 2026-10-01) the import comes first.' },
  ];
  assert.equal(findStaleMentions(planted, 9).length, 2);
  const truthful = [
    { file: 'packages/uxdsl/README.md', text: 'Until 0.5.0-beta.6 this was the separate `uxdsl-cli` package.' },
    { file: 'packages/uxdsl/README.md', text: 'No `0.5.0-beta.7` was ever published.' },
    { file: 'docs/releases/0.5.0-beta.9.md', text: 'It ships in `0.5.0-beta.7`, unreleased.' },
    { file: 'README.md', text: 'The next release is `0.5.0-beta.9`, unreleased.' },
  ];
  assert.deepEqual(findStaleMentions(truthful, 9), []);
});
