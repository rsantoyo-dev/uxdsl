'use strict';

// MIG-B9-10 (FEAT-010): positions survive two stages (Dart Sass, then the UXDSL
// plugin). A diagnostic inside a file that uses @use, mixins, @extend, @each and
// nesting points at the author's line and column, a warning and a reference
// issue too, and the final map names the author's files.
//
// heavy.uxdsl and _mixins.uxdsl are the prototype's files verbatim (story §7.3).
// ok.uxdsl is heavy.uxdsl with a token that exists (for the successful map),
// uses-broken.uxdsl includes the mixin heavy.uxdsl never calls, and
// sass-error.uxdsl holds an undefined Sass variable.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const { SourceMapConsumer } = require('source-map-js');

const core = require('../../dist/entries/index.js');
const exported = require('../../dist/plugin');
const plugin = exported.default || exported;
const { compileSassStage } = require('../../dist/sass/compile-sass.js');
const { restoreDirectiveSpacing } = require('../../dist/sass/protect.js');

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

test('MIG-B9-10: a UXDSL error in a Sass-heavy file is reported at heavy.uxdsl:18:66', async () => {
  const error = await failure('heavy.uxdsl');
  assert.match(String(error.message), /UXD_SPACE_REFERENCE/);
  assert.equal(path.basename(error.file || ''), 'heavy.uxdsl');
  assert.equal(error.line, 18);
  assert.equal(error.column, 66);
});

test('MIG-B9-10: a UXDSL error inside a @use\'d mixin is reported at _mixins.uxdsl:11:3', async () => {
  const error = await failure('uses-broken.uxdsl');
  assert.match(String(error.message), /UXD_DENSITY_REFERENCE|UXD_TOKEN_KEY/);
  assert.equal(path.basename(error.file || ''), '_mixins.uxdsl');
  assert.equal(error.line, 11);
  assert.equal(error.column, 3);
});

test('MIG-B9-10: a Sass error keeps its exact column', async () => {
  const error = await failure('sass-error.uxdsl');
  assert.match(String(error.message), /UXD_SASS/);
  assert.equal(path.basename(error.file || ''), 'sass-error.uxdsl');
  assert.equal(error.line, 4);
  assert.equal(error.column, 18);
});

test('MIG-B9-10: the final map names the original files with their content', async () => {
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

// --- The final map and the locations, end to end -------------------------------------

const RESERVED = ['xs', 'sm', 'md', 'lg', 'xl'];
const read = (name) => fs.readFileSync(entry(name), 'utf8');
const where = (item) => `${path.basename(item.file || item.source || '')}:${item.line}:${item.column}`;
const rejection = (promise) => promise.then(() => assert.fail('the compile succeeded; it should fail'), (error) => error);

/** The plugin, with no compile() around it, on the Sass stage's output for `file`: what PostCSS reports by itself. */
function pluginOnStage(file, { map = false, to, references } = {}) {
  const stage = compileSassStage({ entry: file }, { reserved: RESERVED, sourceMap: true });
  const options = { from: file, to, map: map ? { prev: stage.map, inline: false, annotation: false, ...map } : false };
  return postcss([restoreDirectiveSpacing, plugin({ theme: {}, includeTheme: false, references })]).process(stage.css, options);
}

/** Every mapping of `map` whose source is a key of `texts` and that lies outside that file's text: a line past its end, or a column past its line's length. */
function outsideMappings(map, texts) {
  const outside = [];
  new SourceMapConsumer(map).eachMapping((mapping) => {
    const text = texts[mapping.source];
    if (text === undefined) return;
    const lines = text.split('\n');
    if (mapping.originalLine > lines.length || mapping.originalColumn > lines[mapping.originalLine - 1].length) {
      outside.push(`${mapping.source}:${mapping.originalLine}:${mapping.originalColumn}`);
    }
  });
  return outside;
}

test('MIG-B9-13: the final map names only the author\'s files, relative to `to`, with their text, and no mapping points into Dart Sass\'s output; the CSS is identical in the three modes', async () => {
  const to = path.join(MAPS, 'out', 'ok.css');
  const build = (sourceMap) => core.compile({ entry: entry('ok.uxdsl') }, { includeTheme: false, sourceMap, to });
  const external = await build('external');
  const map = JSON.parse(external.map);
  assert.deepEqual([...map.sources].sort(), ['../_mixins.uxdsl', '../ok.uxdsl', '<no source>']);
  assert.equal(new Set(map.sources).size, map.sources.length, 'no duplicate sources');
  assert.ok(map.sources.every((source) => !source.startsWith('file:') && !path.isAbsolute(source)), `relative sources, no file: URLs: ${map.sources}`);
  const texts = { '../ok.uxdsl': read('ok.uxdsl'), '../_mixins.uxdsl': read('_mixins.uxdsl') };
  map.sources.forEach((source, index) => assert.equal(map.sourcesContent[index], source === '<no source>' ? null : texts[source], `sourcesContent of ${source}`));
  assert.deepEqual(outsideMappings(map, texts), [], 'every mapping lies inside the text of the file it names');

  const marker = '\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,';
  const off = await build(false);
  const inline = await build('inline');
  assert.equal(off.map, undefined);
  assert.equal(external.css, off.css);
  assert.equal(inline.css.lastIndexOf(marker), inline.css.indexOf(marker), 'one annotation');
  assert.equal(inline.css.slice(0, inline.css.lastIndexOf(marker)), off.css);

  // A source that holds a sourceMappingURL comment of its own: Dart Sass drops it, and the three modes still agree.
  const annotated = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-maps-annotated-')), 'annotated.uxdsl');
  const compileAnnotated = (sourceMap) => core.compile({ source: '/*# sourceMappingURL=foo.css.map */\n.a { padding: space(2); }\n', from: annotated }, { includeTheme: false, sourceMap });
  const [a, b, c] = [await compileAnnotated(false), await compileAnnotated('external'), await compileAnnotated('inline')];
  assert.equal(b.css, a.css);
  assert.equal(c.css.slice(0, c.css.lastIndexOf(marker)), a.css);
  assert.doesNotMatch(a.css, /foo\.css\.map/);
});

test('MIG-B9-13: the final map names an author\'s file as PostCSS names it: relative to `to` (to the working directory without it) and URL-encoded', async () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-maps-encoded-')));
  const file = path.join(dir, 'my src #1', 'a?.uxdsl');
  const text = '.a {\n  color: red;\n}\n';
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, text);
  const to = path.join(dir, 'out', 'a.css');
  const named = async (opts) => JSON.parse((await core.compile({ entry: file }, { includeTheme: false, sourceMap: 'external', ...opts })).map).sources;
  const postcssNames = (opts) => postcss([]).process(text, { from: file, map: { inline: false, annotation: false }, ...opts }).map.toJSON().sources;
  assert.deepEqual(await named({ to }), ['../my%20src%20%231/a%3F.uxdsl']);
  assert.deepEqual(await named({ to }), postcssNames({ to }), 'the name PostCSS gives the same file for the same `to`');
  const original = process.cwd();
  process.chdir(dir);
  try {
    assert.deepEqual(await named({}), ['my%20src%20%231/a%3F.uxdsl']);
    assert.deepEqual(await named({}), postcssNames({}), 'without `to`, the name PostCSS gives it from the working directory');
  } finally {
    process.chdir(original);
  }
});

test('MIG-B9-13: the final map names only the author\'s files (negative control): without compile() the plugin reports Dart Sass\'s line 29, and PostCSS\'s chained map holds mappings outside ok.uxdsl\'s text', () => {
  let error;
  try {
    pluginOnStage(entry('heavy.uxdsl')).css;
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, 'the plugin rejects space(404)');
  assert.equal(path.basename(error.file), 'heavy.uxdsl');
  assert.equal(error.line, 29);
  assert.equal(error.column, 12);
  assert.match(error.showSourceCode(false), /> 29 \|\s+inset: space\(404\);/);

  const chained = pluginOnStage(entry('ok.uxdsl'), { map: { sourcesContent: true }, to: path.join(MAPS, 'out', 'ok.css') });
  chained.css;
  const raw = chained.map.toJSON();
  assert.notDeepEqual(outsideMappings(raw, { '../ok.uxdsl': read('ok.uxdsl') }), [], 'PostCSS\'s own input, Dart Sass\'s output, is mapped under the entry\'s name');
});

test('MIG-B9-13: a relocated error\'s stack names the author\'s position, never one in Dart Sass\'s output', async () => {
  const error = await failure('heavy.uxdsl');
  const [head, firstFrame] = error.stack.split('\n');
  assert.equal(head, `${error.name}: ${error.message}`);
  assert.equal(firstFrame, `    at ${entry('heavy.uxdsl')}:18:66`);
  assert.doesNotMatch(error.stack, /heavy\.uxdsl:29:/);
  // Control: the plugin alone puts the node's position in Dart Sass's output in the stack.
  let direct;
  try {
    pluginOnStage(entry('heavy.uxdsl')).css;
  } catch (caught) {
    direct = caught;
  }
  assert.match(direct.stack, /heavy\.uxdsl:29:5/);
});

/** The line of `frame` PostCSS marks as the error's, and the column of its caret on the line below, as an index into the marked line. */
function markedLine(frame) {
  const lines = frame.split('\n');
  const index = lines.findIndex((line) => line.startsWith('>'));
  assert.notEqual(index, -1, `a marked line in the frame:\n${frame}`);
  return { text: lines[index], caret: lines[index + 1].indexOf('^') };
}

test('MIG-B9-13: a relocated error ends where it starts and carries the author\'s text, so showSourceCode() frames the author\'s line, one over 160 characters too', async () => {
  const error = await failure('heavy.uxdsl');
  assert.deepEqual([error.line, error.column, error.endLine, error.endColumn], [18, 66, 18, 66], 'no position in Dart Sass\'s output is left on the error');
  assert.equal(error.source, read('heavy.uxdsl'));
  const heavy = markedLine(error.showSourceCode(false));
  assert.ok(heavy.text.startsWith('> 18 |'), heavy.text);
  assert.equal(heavy.caret, heavy.text.indexOf('inset: space(404)'), 'the caret is under column 66');

  // PostCSS frames a line over 160 characters from 20 characters before the column to 20 after the end column.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-maps-long-')));
  const long = `${Array.from({ length: 12 }, (_, index) => `.selector-number-${index}`).join(', ')} { padding: space(404); }`;
  assert.ok(long.length > 160, 'the author\'s line is over 160 characters');
  fs.writeFileSync(path.join(dir, 'long.uxdsl'), `${long}\n`);
  const wide = await rejection(core.compile({ entry: path.join(dir, 'long.uxdsl') }, { includeTheme: false }));
  const column = long.indexOf('padding: space(404)') + 1;
  assert.deepEqual([where(wide), wide.endLine, wide.endColumn], [`long.uxdsl:1:${column}`, 1, column]);
  const framed = markedLine(wide.showSourceCode(false));
  assert.ok(framed.text.startsWith('> 1 |'), framed.text);
  assert.notEqual(framed.text.indexOf('padding: space(404)'), -1, `the frame shows the author's declaration: ${framed.text}`);
  assert.equal(framed.caret, framed.text.indexOf('padding: space(404)'), 'the caret is under the declaration');
});

/** A project whose partial's mixin and entry each hold a declaration referencing a palette token nothing defines. */
function referenceProject() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-maps-references-')));
  fs.writeFileSync(path.join(dir, '_mix.uxdsl'), '@mixin warned {\n  &__w {\n    box-shadow: 0 0 0 space(1) var(--uxdsl__palette__primry-main);\n  }\n}\n');
  fs.writeFileSync(path.join(dir, 'entry.uxdsl'), '@use "mix";\n\n.card {\n  @include mix.warned;\n  .inner { color: red; box-shadow: 0 0 0 space(1) var(--uxdsl__palette__primry-main); }\n}\n');
  return path.join(dir, 'entry.uxdsl');
}

test('MIG-B9-13: plugin warnings, references.onWarning issues and a ReferenceIntegrityError name the author\'s file, line and column', async () => {
  const file = referenceProject();
  const seen = [];
  const warned = await core.compile({ entry: file }, { includeTheme: false, references: { mode: 'warn', onWarning: (issue) => seen.push(where(issue)) } });
  const missing = warned.warnings.filter((warning) => warning.text.startsWith('UXD_REFERENCE_MISSING: '));
  assert.deepEqual(missing.map(where), ['_mix.uxdsl:3:5', 'entry.uxdsl:5:24']);
  assert.deepEqual(seen, ['_mix.uxdsl:3:5', 'entry.uxdsl:5:24']);

  const error = await rejection(core.compile({ entry: file }, { includeTheme: false }));
  assert.equal(error.name, 'ReferenceIntegrityError');
  assert.equal(error.message, formatted(file));
  assert.equal(where(error), '_mix.uxdsl:3:5');
  assert.equal(error.issues[0].hint, ' Did you mean "primary"?', 'the non-enumerable hint survives the relocation');
  assert.equal(error.stack.split('\n')[0], `ReferenceIntegrityError: ${error.message}`);
});

/** The one-line grouped message for referenceProject(), at the author's positions. */
function formatted(file) {
  const dir = path.dirname(file);
  return 'UXD_REFERENCE_MISSING: --uxdsl__palette__primry-main has no definition in the active theme/scope. Define it or declare its external provider. ' +
    `Did you mean "primary"? Referenced by 2 definitions: box-shadow (${path.join(dir, '_mix.uxdsl')}:3:5), box-shadow (${path.join(dir, 'entry.uxdsl')}:5:24).`;
}

test('MIG-B9-13: plugin warnings, references.onWarning issues and a ReferenceIntegrityError name the author\'s file, line and column (negative control)', () => {
  // The plugin on the Sass stage's output, with no compile() around it, names the entry at Dart Sass's positions.
  const result = pluginOnStage(referenceProject(), { references: { mode: 'warn', onWarning() {} } });
  result.css;
  assert.deepEqual(result.warnings().map((warning) => `${path.basename(warning.node.source.input.file)}:${warning.line}:${warning.column}`), ['entry.uxdsl:2:3', 'entry.uxdsl:6:3']);
});

test('MIG-B9-13: locations do not depend on PostCSS\'s prev-map arithmetic', async () => {
  // PostCSS 8.4.31 to 8.5.15 report a prev map's column one less than 8.5.16 and later; the stub gives
  // the installed PostCSS the older arithmetic.
  const Input = require('postcss/lib/input');
  const origin = Input.prototype.origin;
  Input.prototype.origin = function oneLess(...args) {
    const position = origin.apply(this, args);
    if (position) position.column -= 1;
    return position;
  };
  try {
    const error = await rejection(core.compile({ entry: entry('heavy.uxdsl') }, { includeTheme: false, sourceMap: 'external', to: path.join(MAPS, 'out', 'heavy.css') }));
    assert.equal(where(error), 'heavy.uxdsl:18:66');
    // Control: under the same stub, PostCSS's own location through map.prev is one less.
    let direct;
    try {
      pluginOnStage(entry('heavy.uxdsl'), { map: {} }).css;
    } catch (caught) {
      direct = caught;
    }
    assert.equal(where(direct), 'heavy.uxdsl:18:65');
  } finally {
    Input.prototype.origin = origin;
  }
});

test('MIG-B9-13: a diagnostic with no author position names the entry without line, column or frame', async () => {
  // compile()'s lookup goes through source-map-js's originalPositionFor, which nothing else calls on
  // this path (sourceMap false): stubbed to find nothing, the error keeps only the entry.
  const prototype = Object.getPrototypeOf(new SourceMapConsumer({ version: 3, sources: [], names: [], mappings: '' }));
  const originalPositionFor = prototype.originalPositionFor;
  prototype.originalPositionFor = () => ({ source: null, line: null, column: null, name: null });
  let error;
  try {
    error = await failure('heavy.uxdsl');
  } finally {
    prototype.originalPositionFor = originalPositionFor;
  }
  assert.equal(error.file, entry('heavy.uxdsl'));
  for (const key of ['line', 'column', 'endLine', 'endColumn', 'source']) assert.equal(key in error, false, `no ${key}`);
  assert.equal(error.showSourceCode(false), '');
  assert.ok(error.message.startsWith(`uxdsl: ${entry('heavy.uxdsl')}: UXD_SPACE_REFERENCE: `), error.message);
  // Control: with the lookup restored, the same build is located.
  assert.equal(where(await failure('heavy.uxdsl')), 'heavy.uxdsl:18:66');
});

test('MIG-B9-13: a parse error in CSS compile() did not get from Dart Sass (the theme the plugin generates, a references.css entry) keeps PostCSS\'s position in that CSS and names no author file', async () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-maps-own-css-')));
  const file = path.join(dir, 'e.uxdsl');
  const text = '.a {\n  color: red;\n}\n.b {\n  padding: space(1);\n  margin: 0;\n}\n';
  fs.writeFileSync(file, text);
  // The theme validator lets an unclosed comment through, so the plugin's parse of the theme CSS it generates fails.
  // That CSS writes a block on one line, over 160 characters, which PostCSS frames up to an end column this error
  // does not have: only the references case's marked line has text to compare.
  const broken = [
    [{ theme: { palette: { primary: { main: 'red /* oops' } } } }, 'Unclosed comment', null],
    [{ theme: {}, includeTheme: false, references: { css: ['.x { color: red; }\n.y {\n  color: blue;\n'] } }, 'Unclosed block', '.y {'],
  ];
  const nodeFrame = /^ {4}at (?:<css input>|<input css [^>]*>|.*\.uxdsl):\d+:\d+$/;
  for (const [config, reason, shown] of broken) {
    for (const input of [{ entry: file }, { source: text }]) {
      const label = `${reason}, ${input.entry ? 'compiling e.uxdsl' : 'compiling an anonymous source'}`;
      const error = await rejection(core.compile(input, config));
      assert.deepEqual([error.name, error.reason], ['CssSyntaxError', reason], label);
      assert.equal(error.file, undefined, `${label}: no author file`);
      assert.deepEqual([error.line, error.column], [error.input.line, error.input.column], `${label}: PostCSS's own position in the CSS that failed`);
      assert.equal(error.source, error.input.source, `${label}: the frame shows the CSS that failed`);
      assert.equal(error.message, `uxdsl: <css input>:${error.input.line}:${error.input.column}: ${reason}`, label);
      const frame = error.showSourceCode(false);
      assert.ok(markedLine(frame).text.startsWith(`> ${error.input.line} |`), `${label}: the frame marks the failing CSS's line`);
      if (shown) assert.ok(markedLine(frame).text.includes(shown), `${label}: the marked line shows ${shown}`);
      assert.doesNotMatch(frame, /padding: space\(1\)/, `${label}: the frame never shows the author's text`);
      assert.equal(error.stack.split('\n')[0], `CssSyntaxError: ${error.message}`, label);
      assert.deepEqual(error.stack.split('\n').filter((line) => nodeFrame.test(line)), [], `${label}: no stack frame names a stylesheet position`);
    }
  }
  // Control: a position in Dart Sass's output is still the author's, for a plugin error and for PostCSS's own parse error.
  fs.writeFileSync(path.join(dir, 'token.uxdsl'), text.replace('space(1)', 'space(404)'));
  assert.equal(where(await rejection(core.compile({ entry: path.join(dir, 'token.uxdsl') }, { includeTheme: false }))), 'token.uxdsl:5:3');
  fs.writeFileSync(path.join(dir, 'colon.uxdsl'), '@use "sass:string";\n.x {\n  b: string.unquote("a:b");\n}\n');
  const parsed = await rejection(core.compile({ entry: path.join(dir, 'colon.uxdsl') }, { includeTheme: false }));
  assert.deepEqual([parsed.name, parsed.reason, where(parsed)], ['CssSyntaxError', 'Missed semicolon', 'colon.uxdsl:3:3']);
});

test('MIG-B9-13: a plugin warning, an onWarning issue or a ReferenceIntegrityError\'s issue with no author position names the entry, without a line or column', async () => {
  // As in the test above for an error: compile()'s lookup, stubbed to find nothing.
  const file = referenceProject();
  const prototype = Object.getPrototypeOf(new SourceMapConsumer({ version: 3, sources: [], names: [], mappings: '' }));
  const originalPositionFor = prototype.originalPositionFor;
  prototype.originalPositionFor = () => ({ source: null, line: null, column: null, name: null });
  const seen = [];
  let warned;
  let error;
  try {
    warned = await core.compile({ entry: file }, { includeTheme: false, references: { mode: 'warn', onWarning: (issue) => seen.push({ ...issue }) } });
    error = await rejection(core.compile({ entry: file }, { includeTheme: false }));
  } finally {
    prototype.originalPositionFor = originalPositionFor;
  }
  const missing = warned.warnings.filter((warning) => warning.text.startsWith('UXD_REFERENCE_MISSING: '));
  assert.equal(missing.length, 2);
  for (const warning of missing) assert.deepEqual({ ...warning, text: '' }, { text: '', file }, 'a warning is { text, file: entry }');
  assert.equal(seen.length, 2);
  for (const issue of seen) assert.deepEqual([issue.source, 'line' in issue, 'column' in issue], [file, false, false], 'an onWarning issue names the entry alone');
  assert.equal(error.name, 'ReferenceIntegrityError');
  for (const issue of error.issues) assert.deepEqual([issue.source, 'line' in issue, 'column' in issue], [file, false, false], 'an issue names the entry alone');
  assert.deepEqual([error.file, error.line, error.column], [file, undefined, undefined]);
  assert.doesNotMatch(error.message, /\.uxdsl:\d/, 'the message names no position');
  // Control: with the lookup restored, the same build is located.
  const located = await core.compile({ entry: file }, { includeTheme: false, references: { mode: 'warn' } });
  assert.deepEqual(located.warnings.filter((warning) => warning.text.startsWith('UXD_REFERENCE_MISSING: ')).map(where), ['_mix.uxdsl:3:5', 'entry.uxdsl:5:24']);
});
