'use strict';

// MIG-B9-10 (FEAT-010): positions survive two stages (Dart Sass, then the UXDSL
// plugin). A diagnostic inside a file that uses @use, mixins, @extend, @each and
// nesting points at the author's line and column, and the final map names the
// author's files. `todo` until MIG-B9-12/13 put compile() on Dart Sass.
//
// heavy.uxdsl and _mixins.uxdsl are the prototype's files verbatim (story §7.3).
// ok.uxdsl is heavy.uxdsl with a token that exists (for the successful map),
// uses-broken.uxdsl includes the mixin heavy.uxdsl never calls, and
// sass-error.uxdsl holds an undefined Sass variable.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { SourceMapConsumer } = require('source-map-js');

const core = require('../../dist/entries/index.js');

const MAPS = path.join(__dirname, 'fixtures/sass-maps');
const entry = (name) => path.join(MAPS, name);

async function failure(name) {
  try {
    await core.compile({ entry: entry(name) }, { includeTheme: false });
  } catch (error) {
    return error;
  }
  assert.fail(`${name} compiled; it should fail`);
}

test('MIG-B9-10: the fixture positions the tests rely on are where the story says', () => {
  const fs = require('node:fs');
  const line = (file, n) => fs.readFileSync(entry(file), 'utf8').split('\n')[n - 1];
  assert.equal(line('heavy.uxdsl', 18).indexOf('inset: space(404)') + 1, 66);
  assert.equal(line('_mixins.uxdsl', 11).indexOf('padding: density(99)') + 1, 3);
  assert.equal(line('sass-error.uxdsl', 4).indexOf('$undefined') + 1, 18);
  assert.equal(line('ok.uxdsl', 18).indexOf('inset: space(4)') + 1, 66);
});

test.todo('MIG-B9-10: a UXDSL error in a Sass-heavy file is reported at heavy.uxdsl:18:66', async () => {
  const error = await failure('heavy.uxdsl');
  assert.match(String(error.message), /UXD_SPACE_REFERENCE/);
  assert.equal(path.basename(error.file || ''), 'heavy.uxdsl');
  assert.equal(error.line, 18);
  assert.equal(error.column, 66);
});

test.todo('MIG-B9-10: a UXDSL error inside a @use\'d mixin is reported at _mixins.uxdsl:11:3', async () => {
  const error = await failure('uses-broken.uxdsl');
  assert.match(String(error.message), /UXD_DENSITY_REFERENCE|UXD_TOKEN_KEY/);
  assert.equal(path.basename(error.file || ''), '_mixins.uxdsl');
  assert.equal(error.line, 11);
  assert.equal(error.column, 3);
});

test.todo('MIG-B9-10: a Sass error keeps its exact column', async () => {
  const error = await failure('sass-error.uxdsl');
  assert.match(String(error.message), /UXD_SASS/);
  assert.equal(path.basename(error.file || ''), 'sass-error.uxdsl');
  assert.equal(error.line, 4);
  assert.equal(error.column, 18);
});

test.todo('MIG-B9-10: the final map names the original files with their content', async () => {
  const to = path.join(MAPS, 'out', 'ok.css');
  const result = await core.compile({ entry: entry('ok.uxdsl') }, { includeTheme: false, sourceMap: 'external', to });
  const map = JSON.parse(result.map);
  const sources = map.sources.map((source) => path.basename(source));
  assert.ok(sources.includes('ok.uxdsl') && sources.includes('_mixins.uxdsl'), `sources: ${map.sources}`);
  assert.equal(new Set(map.sources).size, map.sources.length, 'no duplicate sources');
  assert.ok(map.sources.every((source) => !source.startsWith('file:') && !path.isAbsolute(source)), 'relative sources, no file: URLs');
  assert.equal(map.sourcesContent.length, map.sources.length);
  const consumer = new SourceMapConsumer(map);
  const lines = result.css.split('\n');
  const lineIndex = lines.findIndex((text) => text.includes('inset: var(--uxdsl__space__4)'));
  assert.ok(lineIndex >= 0, 'the compiled inset declaration is in the output');
  const original = consumer.originalPositionFor({ line: lineIndex + 1, column: lines[lineIndex].indexOf('inset') });
  assert.equal(path.basename(original.source || ''), 'ok.uxdsl');
  assert.equal(original.line, 18);
});
