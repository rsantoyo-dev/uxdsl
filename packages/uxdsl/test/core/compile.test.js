'use strict';

// MIG-B6-18 (FEAT-008): the one shared compile() pipeline the CLI, Vite and
// webpack use. Since MIG-B9-13 (FEAT-010) it is protect, Dart Sass, restore
// and the UXDSL plugin: imports, cycles and missing files follow Dart Sass's
// rules and fail as UXD_SASS, and what the former line-by-line implementation
// got wrong without erroring (url()/comment corruption, a silently-ignored
// missing import) stays covered.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../../dist/entries/index.js');

const FIXTURES = path.resolve(__dirname, 'fixtures');

function write(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function mkTmpDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-core-test-')));
}

// --- CommonJS consumption contract ---

test('require(\'uxdsl\') is an object: compile(), the resolved theme and defineConfig — no callable default', () => {
  // The callable default export (`processUxdsl(source, { fileId })`) was a
  // second signature for the same pipeline; `compile()` is the API. The
  // PostCSS plugin is `uxdsl/postcss`, not the package root.
  assert.equal(typeof core, 'object');
  assert.equal(typeof core.compile, 'function');
  assert.deepEqual(Object.keys(core).filter((k) => k !== '__esModule').sort(), ['DEFAULT_THEME', 'compile', 'defineConfig', 'resolveTheme']);
});

test('stability phase 2: compile() has no breakpoints option — thresholds are the theme\'s own family', async () => {
  const { css } = await core.compile({ source: '.a { padding: xs(1rem) md(2rem); }' }, { includeTheme: false, theme: { breakpoints: { md: 900 } } });
  assert.match(css, /@media \(min-width: 900px\)/);
  assert.doesNotMatch(css, /768px/);
});

// --- Import cycles: Dart Sass's own error, located at the @import or @use that
// closes the loop. ---

const rejection = (promise) => promise.then(() => assert.fail('the compile succeeded; it should fail'), (error) => error);
const at = (error) => `${path.basename(error.file || '')}:${error.line}:${error.column}`;

test('MIG-B9-13: an @import cycle fails as UXD_SASS "This file is already being loaded." at cycle-b.uxdsl:1:9', async () => {
  const error = await rejection(core.compile({ entry: path.join(FIXTURES, 'cycle-a.uxdsl') }));
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.sassMessage, 'This file is already being loaded.');
  assert.equal(at(error), 'cycle-b.uxdsl:1:9');
  assert.equal(error.message, `${path.join(FIXTURES, 'cycle-b.uxdsl')}:1:9: UXD_SASS: This file is already being loaded.`);
  assert.doesNotMatch(error.message, /UXD_IMPORT_CYCLE|->/, 'not the former chain');
});

test('MIG-B9-13: a @use loop fails as UXD_SASS "Module loop: this module is already being loaded."', async () => {
  const dir = mkTmpDir();
  write(dir, '_a.uxdsl', '@use "b";\n');
  write(dir, '_b.uxdsl', '@use "a";\n');
  const error = await rejection(core.compile({ entry: write(dir, 'entry.uxdsl', '@use "a";\n') }));
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.sassMessage, 'Module loop: this module is already being loaded.');
  assert.equal(at(error), '_b.uxdsl:1:1');
  assert.doesNotMatch(error.message, /UXD_IMPORT_CYCLE/);
});

test('MIG-B9-13: compile({ source, from }) rejects the same @import cycle as UXD_SASS at cycle-b.uxdsl:1:9', async () => {
  const entry = path.join(FIXTURES, 'cycle-a.uxdsl');
  const error = await rejection(core.compile({ source: fs.readFileSync(entry, 'utf8'), from: entry }));
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.sassMessage, 'This file is already being loaded.');
  assert.equal(at(error), 'cycle-b.uxdsl:1:9');
  assert.doesNotMatch(error.message, /UXD_IMPORT_CYCLE|->/);
});

test('MIG-B9-13: compile({ source, from }): a bare-specifier .css @import stays a CSS @import; @use of the package path inlines it through the node_modules load paths', async () => {
  const dir = mkTmpDir();
  write(dir, 'node_modules/some-package/tokens.css', '.from-package { color: green; }\n');
  const from = path.join(dir, 'virtual-entry.uxdsl');
  const imported = await core.compile({ source: "@import 'some-package/tokens.css';\n.a { color: red; }\n", from }, { includeTheme: false });
  assert.equal(imported.css, "@import 'some-package/tokens.css';\n.a {\n  color: red;\n}");
  assert.deepEqual(imported.dependencies, [from], 'a plain CSS @import is not loaded, so not a dependency');
  const used = await core.compile({ source: "@use 'some-package/tokens';\n.a { color: red; }\n", from }, { includeTheme: false });
  assert.equal(used.css, '.from-package {\n  color: green;\n}\n\n.a {\n  color: red;\n}');
  assert.deepEqual(used.dependencies, [from, path.join(dir, 'node_modules/some-package/tokens.css')]);
});

test('MIG-B6-20: compile({ source, from }) does not require `from` to be a real file on disk (an unsaved editor buffer/Sass-preprocessed content)', async () => {
  const result = await core.compile(
    { source: '.a { color: red; }', from: path.join(FIXTURES, 'this-file-does-not-exist-on-disk.uxdsl') },
    { includeTheme: false }
  );
  assert.match(result.css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
});

test('MIG-B9-13: a file @imported twice is emitted twice, as Dart Sass does; loaded with @use from two modules, once', async () => {
  // References validation is off: this fixture is about loading, not styling.
  const { css, warnings } = await core.compile({ entry: path.join(FIXTURES, 'duplicate-root.uxdsl') }, { references: { mode: 'off' } });
  assert.equal(css.split('--dup-test').length - 1, 2, 'the partial is included at each @import');
  assert.deepEqual(warnings.map((warning) => `${at(warning)} ${warning.text.startsWith('UXD_SASS_WARNING: [import] ')}`), [
    'duplicate-root.uxdsl:1:9 true',
    'duplicate-root.uxdsl:2:9 true',
  ], 'each @import carries Sass\'s [import] deprecation');
  const dir = mkTmpDir();
  write(dir, '_partial.uxdsl', ':root {\n  --dup-test: 1;\n}\n');
  write(dir, '_other.uxdsl', '@use "./partial";\n');
  const used = await core.compile({ entry: write(dir, 'root.uxdsl', '@use "./partial";\n@use "./other";\n') }, { references: { mode: 'off' }, includeTheme: false });
  assert.equal(used.css.split('--dup-test').length - 1, 1, 'a module is loaded once');
});

// --- Missing import: Dart Sass's located error, never a silently left-alone
// @import line in the output. ---

test('MIG-B9-13: a nonexistent import fails as UXD_SASS "Can\'t find stylesheet to import." with the importing file, line 1 and column 9', async () => {
  const dir = mkTmpDir();
  const entry = write(dir, 'main.uxdsl', '@import "./missing-partial.uxdsl";\n.after { color: blue; }\n');
  const error = await rejection(core.compile({ entry }, { includeTheme: false }));
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.message, `${entry}:1:9: UXD_SASS: Can't find stylesheet to import.`);
  assert.equal(error.file, entry);
  assert.equal(error.line, 1);
  assert.equal(error.column, 9);
  assert.doesNotMatch(error.message, /Failed to find/, 'not the former postcss-import message');
});

// --- url()/comment corruption: the old stripLineComments() cut everything
// after "//" on each line outside quotes, which doesn't understand
// unquoted url() or block comments. ---

test('MIG-B6-18: an unquoted url() with "//" is left completely intact', async () => {
  const { css } = await core.compile({ source: '.a { background: url(https://example.com/a.png); }' }, { includeTheme: false });
  assert.match(css, /url\(https:\/\/example\.com\/a\.png\)/);
});

test('MIG-B6-18: a block comment containing a URL is left completely intact (not treated as a line comment)', async () => {
  const { css } = await core.compile({ source: '/* docs: https://uxdsl.dev */\n.a { color: red; }' }, { includeTheme: false });
  assert.match(css, /\/\* docs: https:\/\/uxdsl\.dev \*\//);
  assert.match(css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
});

test('MIG-B9-13: a "//" line comment is dropped by Dart Sass', async () => {
  const { css } = await core.compile({ source: '// a real comment\n.a { color: red; }' }, { includeTheme: false });
  assert.equal(css, '.a {\n  color: red;\n}');
});

// --- $var responsive expansion through the whole pipeline: Dart Sass
// substitutes the variable, then the plugin splits the responsive value. ---

test('MIG-B6-18: a $var holding a responsive expression expands into a real @media block', async () => {
  const { css } = await core.compile({ source: '$gap: xs(1rem) md(2rem);\n.a { gap: $gap; }\n' }, { includeTheme: false });
  assert.match(css, /\.a\s*\{\s*gap:\s*1rem;?\s*\}/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.doesNotMatch(css, /\$gap/);
});

// --- Conditional imports: an @import with a media query is a plain CSS
// @import for Dart Sass; meta.load-css() includes a module under a condition. ---

test('MIG-B9-13: an @import with a media query stays a plain CSS @import; @include meta.load-css() under @media inlines the partial there', async () => {
  const dir = mkTmpDir();
  write(dir, 'shared.uxdsl', '.shared { color: red; }');
  const entry = write(dir, 'main.uxdsl', '@import "./shared.uxdsl";\n@import "./shared.uxdsl" (min-width: 768px);\n');
  const { css } = await core.compile({ entry }, { includeTheme: false });
  assert.equal(css, '@import "./shared.uxdsl" (min-width: 768px);\n.shared {\n  color: red;\n}', 'the conditioned import is CSS, hoisted first');
  assert.doesNotMatch(css, /@media/);
  write(dir, '_part.uxdsl', '.part { color: red; }');
  const loaded = await core.compile({ entry: write(dir, 'load.uxdsl', '@use "sass:meta";\n@include meta.load-css("part");\n@media (min-width: 768px) {\n  @include meta.load-css("part");\n}\n') }, { includeTheme: false });
  assert.equal(loaded.css, '.part {\n  color: red;\n}\n\n@media (min-width: 768px) {\n  .part {\n    color: red;\n  }\n}');
});

// --- Bare package-specifier imports (`@import 'some-package/tokens.css'`):
// a `.css` URL is a plain CSS @import for Dart Sass, left for the browser; the
// package path loaded with @use is found through the node_modules load paths
// and inlined. ---

test('MIG-B9-13: a bare-specifier .css @import stays a CSS @import; @use of the package path inlines it through the node_modules load paths', async () => {
  const dir = mkTmpDir();
  write(dir, 'node_modules/some-package/tokens.css', '.from-package { color: green; }\n');
  const imported = await core.compile({ entry: write(dir, 'main.uxdsl', "@import 'some-package/tokens.css';\n.a { color: red; }\n") }, { includeTheme: false });
  assert.equal(imported.css, "@import 'some-package/tokens.css';\n.a {\n  color: red;\n}");
  assert.doesNotMatch(imported.css, /from-package/, 'not inlined, as the former pipeline did');
  const used = await core.compile({ entry: write(dir, 'use.uxdsl', "@use 'some-package/tokens';\n.a { color: red; }\n") }, { includeTheme: false });
  assert.equal(used.css, '.from-package {\n  color: green;\n}\n\n.a {\n  color: red;\n}');
});

// --- Native CSS / comments left alone entirely when there's nothing
// UXDSL-specific to do — a positive control that this pipeline doesn't
// touch ordinary CSS it doesn't need to. ---

test('stability phase 2: a theme entry ends with its last rule — no /*@uxdsl-bp*/ trailer and no #uxdsl-bp-meta rule', async () => {
  const { css } = await core.compile({ source: '.a { padding: xs(1rem) md(2rem); }' }, { includeTheme: true });
  assert.doesNotMatch(css, /@uxdsl-bp/);
  assert.doesNotMatch(css, /#uxdsl-bp-meta/);
  assert.match(css, /:root/, 'control: the theme itself is still emitted');
  assert.ok(css.trimEnd().endsWith('}'), 'nothing is appended after the stylesheet');
});

test('MIG-B6-18 (positive control): plain native CSS with no UXDSL functions compiles unchanged', async () => {
  const { css } = await core.compile({ source: '.a {\n  color: red;\n  margin: 0 auto;\n}\n' }, { includeTheme: false });
  assert.match(css, /\.a\s*\{\s*color:\s*red;\s*margin:\s*0 auto;?\s*\}/);
});

// --- compile()'s own input validation ---

test('MIG-B6-18: compile() rejects a call with neither entry nor source', async () => {
  await assert.rejects(() => core.compile({}), /requires either \{ entry \} or \{ source \}/);
});

test('MIG-B6-18: compile() rejects a call with both entry and source', async () => {
  const entry = path.join(FIXTURES, 'duplicate-root.uxdsl');
  await assert.rejects(() => core.compile({ entry, source: '.a{}' }), /accepts either \{ entry \} or \{ source \}, not both/);
});

// MIG-B6-21 (FEAT-008) implemented `sourceMap`, so 'inline'/'external' are
// no longer rejected. What this case still pins is the half that has not
// changed: an unrecognised value is a hard error, never silently ignored —
// the reason the option threw while it was unimplemented in the first place.
test('MIG-B6-21: compile() rejects an unrecognised sourceMap value instead of silently emitting no map', async () => {
  for (const bad of ['External', true, 'yes', 1]) {
    await assert.rejects(
      () => core.compile({ source: '.a{}' }, { sourceMap: bad }),
      /invalid sourceMap option/i,
      `sourceMap: ${JSON.stringify(bad)} must be rejected`
    );
  }
  // The three documented values are accepted.
  for (const good of [false, 'inline', 'external']) {
    await assert.doesNotReject(() => core.compile({ source: '.a{}' }, { sourceMap: good, includeTheme: false }));
  }
});

test('MIG-B6-18: compile() returns dependencies (entry first) and warnings', async () => {
  const dir = mkTmpDir();
  write(dir, 'shared.uxdsl', '.shared { color: red; }');
  const entry = write(dir, 'main.uxdsl', '@import "./shared.uxdsl";\n.a { color: blue; }\n');
  const result = await core.compile({ entry }, { includeTheme: false });
  assert.equal(typeof result.css, 'string');
  assert.ok(Array.isArray(result.dependencies));
  assert.equal(result.dependencies[0], entry);
  assert.ok(result.dependencies.some((d) => d.endsWith('shared.uxdsl')));
  assert.ok(Array.isArray(result.warnings));
});

test('MIG-B9-13: compile({ source, from }) with a from that does not exist lists from first in dependencies', async () => {
  const result = await core.compile({ source: '.a { color: red; }', from: '/virtual/panel.uxdsl' }, { includeTheme: false });
  assert.equal(result.css, '.a {\n  color: red;\n}');
  assert.deepEqual(result.dependencies, [path.resolve('/virtual/panel.uxdsl')], 'Dart Sass loaded it, as the stage reports, never the empty list');
});

// --- MIG-B6-21 (FEAT-008): source maps through PostCSS ---
// Real queries against the emitted map with SourceMapConsumer (source-map-js
// is PostCSS's own dependency), not just "a map came back" — the point of the
// story is that a devtools lookup lands on the .uxdsl line, so that is what
// gets asserted.
const { SourceMapConsumer } = require('source-map-js');

function mapFixture() {
  const dir = mkTmpDir();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'dist', 'css'), { recursive: true });
  write(dir, 'src/partial.uxdsl', '.from-partial {\n  color: palette(primary.main);\n}\n');
  const entry = write(dir, 'src/entry.uxdsl', [
    "@import './partial.uxdsl';",
    '',
    '.plain {',
    '  color: red;',
    '}',
    '',
    '.spaced {',
    '  padding: density(4);',
    '}',
    '',
    '.btn {',
    '  @ds-button(contained);',
    '}',
    '',
  ].join('\n'));
  return { dir, entry, to: path.join(dir, 'dist', 'css', 'out.css') };
}

/** Line/column of the first output line containing `needle`, pointing at
 * `at` (default: the needle itself) within it. */
function positionOf(css, needle, at) {
  const lines = css.split('\n');
  const line = lines.findIndex((l) => l.includes(needle));
  assert.notEqual(line, -1, `output should contain ${needle}`);
  return { line: line + 1, column: lines[line].indexOf(at || needle) };
}

test('MIG-B6-21: every required map query lands on the right .uxdsl line', async () => {
  const { entry, to } = mapFixture();
  const result = await core.compile({ entry }, { sourceMap: 'external', to });
  assert.equal(typeof result.map, 'string');
  const consumer = new SourceMapConsumer(JSON.parse(result.map));
  const lookup = (needle, at) => consumer.originalPositionFor(positionOf(result.css, needle, at));

  // 1. A plain declaration -> its own line in the entry.
  const plain = lookup('color: red');
  assert.match(plain.source, /entry\.uxdsl$/);
  assert.equal(plain.line, 4);

  // 2. A declaration the compiler rewrote (density()) -> the original line,
  //    not wherever the generated value ended up.
  const density = lookup('padding: var(--uxdsl__density__4)', 'padding:');
  assert.match(density.source, /entry\.uxdsl$/);
  assert.equal(density.line, 8);

  // 3. A declaration generated by @ds-button -> the directive's own line.
  const button = lookup('.btn {', 'padding:');
  assert.match(button.source, /entry\.uxdsl$/);
  assert.equal(button.line, 12);

  // 4. A declaration from an imported partial -> that partial as its own
  //    source, with its own line — not the entry that imported it.
  const partial = lookup('color: var(--uxdsl__palette__primary-main)', 'color:');
  assert.match(partial.source, /partial\.uxdsl$/);
  assert.equal(partial.line, 2);
});

test('MIG-B6-21: no sources entry is absolute, and theme-only globals invent no source file', async () => {
  const { entry, to } = mapFixture();
  const { map } = await core.compile({ entry }, { sourceMap: 'external', to });
  const parsed = JSON.parse(map);
  for (const source of parsed.sources) {
    assert.ok(!path.isAbsolute(source), `sources must stay relative, got ${source}`);
  }
  // Only the two real files (plus PostCSS's own "<no source>" placeholder for
  // generated nodes). Theme globals used to drag seven anonymous
  // `<input css …>` inputs into `sources`, each with its whole body in
  // `sourcesContent`, advertising files the user never wrote.
  const real = parsed.sources.filter((s) => s.endsWith('.uxdsl'));
  assert.equal(real.length, 2);
  assert.equal(parsed.sources.some((s) => s.includes('input%20css') || s.includes('input css')), false);
});

test('MIG-B6-21: sourceMap: false is byte-identical to the same compiler without the option', async () => {
  const { entry, to } = mapFixture();
  const off = await core.compile({ entry }, { sourceMap: false, to });
  const omitted = await core.compile({ entry }, { to });
  const external = await core.compile({ entry }, { sourceMap: 'external', to });
  assert.equal(off.css, omitted.css);
  assert.equal(off.map, undefined);
  // 'external' leaves the annotation to the writer, so its CSS is identical
  // too — the CLI is what appends the sourceMappingURL comment.
  assert.equal(external.css, off.css);
});

test('MIG-B6-21: inline embeds the map as a data URI, last in the file, and returns it too', async () => {
  const { entry, to } = mapFixture();
  const inline = await core.compile({ entry }, { sourceMap: 'inline', to });
  const marker = '/*# sourceMappingURL=data:application/json;charset=utf-8;base64,';
  assert.ok(inline.css.includes(marker));
  assert.equal(inline.css.indexOf(marker), inline.css.lastIndexOf(marker), 'exactly one annotation');
  assert.ok(inline.css.trimEnd().endsWith('*/'), 'the annotation must be the last thing in the file');
  // The embedded map decodes to the same map the caller gets back.
  const encoded = inline.css.slice(inline.css.indexOf(marker) + marker.length).split(' */')[0];
  assert.equal(Buffer.from(encoded, 'base64').toString('utf8'), inline.map);
});

test('MIG-B6-21: sourcesContent is included by default and omitted when turned off', async () => {
  const { entry, to } = mapFixture();
  const withContent = await core.compile({ entry }, { sourceMap: 'external', to });
  assert.ok(JSON.parse(withContent.map).sourcesContent.some((c) => typeof c === 'string' && c.includes('.plain')));

  const without = await core.compile({ entry }, { sourceMap: 'external', to, sourcesContent: false });
  const parsed = JSON.parse(without.map);
  assert.equal(parsed.sourcesContent === undefined || parsed.sourcesContent.every((c) => c === null), true);
});

test('MIG-B6-21: sources resolve against the map location, from any cwd', async () => {
  const { entry, to } = mapFixture();
  const original = process.cwd();
  const seen = [];
  try {
    for (const cwd of [original, os.tmpdir()]) {
      process.chdir(cwd);
      const { map } = await core.compile({ entry }, { sourceMap: 'external', to });
      seen.push(JSON.parse(map).sources.filter((s) => s.endsWith('.uxdsl')).sort().join('|'));
    }
  } finally {
    process.chdir(original);
  }
  assert.equal(seen[0], seen[1], 'sources must not depend on the working directory');
  assert.match(seen[0], /^\.\.\/\.\.\/src\//, 'resolved relative to the map/CSS location, not the cwd');
});

// --- The anonymous source, the sass option, the cascade after a directive,
// dependencies and reserved names (MIG-B9-13, FEAT-010) ---

/** Runs `body` with the working directory set to `dir`, restored afterwards. */
async function inDirectory(dir, body) {
  const original = process.cwd();
  process.chdir(dir);
  try {
    return await body();
  } finally {
    process.chdir(original);
  }
}

test('MIG-B9-13: compile({ source }) without from is an anonymous .uxdsl file in the working directory, named <css input>', async () => {
  const dir = mkTmpDir();
  write(dir, '_part.uxdsl', '.p { color: red; }\n');
  const seen = [];
  await inDirectory(dir, async () => {
    const used = await core.compile({ source: '@use "part";\n.a { color: blue; }\n' }, { includeTheme: false, sourceMap: 'external' });
    assert.equal(used.css, '.p {\n  color: red;\n}\n\n.a {\n  color: blue;\n}', 'a relative @use resolves from the working directory');
    assert.deepEqual(used.dependencies, [path.join(dir, '_part.uxdsl')], 'the anonymous source is never a dependency');
    assert.deepEqual(JSON.parse(used.map).sources, ['_part.uxdsl', '<css input>']);
    seen.push(JSON.stringify(used));

    const plugin = await rejection(core.compile({ source: '.a { padding: space(404); }\n' }, { includeTheme: false }));
    assert.ok(plugin.message.startsWith('uxdsl: <css input>:1:6: UXD_SPACE_REFERENCE: '), plugin.message);
    assert.equal('file' in plugin, false, 'no file');
    seen.push(plugin.message, plugin.stack);

    const missing = await rejection(core.compile({ source: '@use "nope";\n.a { color: red; }\n' }, { includeTheme: false }));
    assert.equal(missing.message, "<css input>:1:1: UXD_SASS: Can't find stylesheet to import.");
    assert.equal('file' in missing, false, 'no file');
    assert.match(missing.sassFrame, /<css input> 1:1 {2}root stylesheet/);
    seen.push(missing.message, missing.stack, missing.sassFrame);

    const warned = await core.compile({ source: '@function space($k) { @return $k; }\n.a { padding: space(2); }\n@import "part";\n' }, { includeTheme: false });
    assert.deepEqual(warned.warnings, [
      { text: 'UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.', line: 3, column: 9 },
      { text: "UXD_FUNCTION_SHADOWED: @function space (<css input>:1) replaces UXDSL's space() in this build; rename it to use the token", line: 1, column: 11 },
    ]);
    seen.push(JSON.stringify(warned));
  });
  for (const text of seen) assert.doesNotMatch(text, /__uxdsl_css_input__/, 'the file name an anonymous source is compiled as never surfaces');
});

test('MIG-B9-13: compile({ source }) without from is an anonymous .uxdsl file (negative control): with from, the error names that file and it is the first dependency', async () => {
  const dir = mkTmpDir();
  write(dir, '_part.uxdsl', '.p { color: red; }\n');
  const named = path.join(dir, 'named.uxdsl');
  const missing = await rejection(core.compile({ source: '@use "nope";\n', from: named }, { includeTheme: false }));
  assert.equal(missing.message, `${named}:1:1: UXD_SASS: Can't find stylesheet to import.`);
  assert.equal(missing.file, named);
  const used = await core.compile({ source: '@use "part";\n', from: named }, { includeTheme: false });
  assert.deepEqual(used.dependencies, [named, path.join(dir, '_part.uxdsl')]);
});

test('MIG-B9-13: config.sass passes silenceDeprecations and quietDeps to Dart Sass; an unknown key or a wrong type is an error before any I/O', async () => {
  // A nonexistent entry: the option is checked before compile() looks for it.
  const missingEntry = path.join(mkTmpDir(), 'missing.uxdsl');
  const rejects = (sass) => rejection(core.compile({ entry: missingEntry }, { sass }));
  assert.equal((await rejects({ style: 'compressed' })).message, 'uxdsl: unknown sass option "style"; compile() passes only silenceDeprecations and quietDeps to Dart Sass.');
  assert.equal((await rejects({ quietDeps: 'yes' })).message, 'uxdsl: sass.quietDeps must be a boolean.');
  assert.equal((await rejects({ silenceDeprecations: 'import' })).message, 'uxdsl: sass.silenceDeprecations must be an array of deprecation ids (strings).');
  assert.equal((await rejects({ silenceDeprecations: [1] })).message, 'uxdsl: sass.silenceDeprecations must be an array of deprecation ids (strings).');
  for (const sass of ['import', null, []]) {
    assert.equal((await rejects(sass)).message, 'uxdsl: the sass option must be an object: { silenceDeprecations?: string[], quietDeps?: boolean }.', JSON.stringify(sass));
  }
  // Control: a valid option reaches the entry check, then Dart Sass.
  assert.equal((await rejects({ silenceDeprecations: ['import'] })).message, `uxdsl: entry file not found: ${missingEntry}`);
});

test('MIG-B9-13: config.sass passes silenceDeprecations and quietDeps to Dart Sass (negative control): the [import] warning without the option', async () => {
  const dir = mkTmpDir();
  write(dir, '_a.uxdsl', '.a { color: red; }\n');
  const entry = write(dir, 'entry.uxdsl', '@import "a";\n');
  const loud = await core.compile({ entry }, { includeTheme: false });
  assert.equal(loud.warnings.length, 1);
  assert.ok(loud.warnings[0].text.startsWith('UXD_SASS_WARNING: [import] '), loud.warnings[0].text);
  const quiet = await core.compile({ entry }, { includeTheme: false, sass: { silenceDeprecations: ['import'], quietDeps: true } });
  assert.deepEqual(quiet.warnings, []);
  assert.equal(quiet.css, loud.css);
});

test('MIG-B9-13: config.sass.quietDeps reaches Dart Sass: it silences the deprecations of a dependency loaded through the node_modules load paths, never those of the project\'s own files', async () => {
  const dir = mkTmpDir();
  write(dir, 'node_modules/dep/_index.scss', '@import "part";\n');
  write(dir, 'node_modules/dep/_part.scss', '.dep { color: red; }\n');
  write(dir, '_own.uxdsl', '.own { color: blue; }\n');
  const entry = write(dir, 'entry.uxdsl', '@use "dep";\n@import "own";\n');
  const positions = (result) => result.warnings.map((warning) => [warning.text.startsWith('UXD_SASS_WARNING: [import] '), warning.file, warning.line, warning.column]);
  const loud = await core.compile({ entry }, { includeTheme: false });
  assert.deepEqual(positions(loud), [
    [true, entry, 2, 9],
    [true, path.join(dir, 'node_modules', 'dep', '_index.scss'), 1, 9],
  ], 'without the option, the dependency\'s [import] deprecation is reported after the entry\'s');
  const quiet = await core.compile({ entry }, { includeTheme: false, sass: { quietDeps: true } });
  assert.deepEqual(positions(quiet), [[true, entry, 2, 9]], 'quietDeps alone silences the dependency\'s deprecation, and only that one');
  assert.equal(quiet.css, loud.css);
});

/** The selectors of `css`'s top-level rules, in order. */
const selectorsOf = (css) => require('postcss').parse(css).nodes.filter((node) => node.type === 'rule').map((node) => node.selector);

test('MIG-B9-13: a rule nested after a control directive follows the directive\'s generated rules', async () => {
  const source = '.btn { @ds-button(contained); &:hover { background: red; } }';
  const { css } = await core.compile({ source }, { includeTheme: false });
  const selectors = selectorsOf(css);
  const generated = selectors.indexOf('.btn:hover:not(:where(:disabled, [aria-disabled="true"]))');
  const author = selectors.indexOf('.btn:hover');
  assert.equal(selectors[0], '.btn');
  assert.ok(generated > 0, `the generated hover state is emitted: ${selectors}`);
  assert.ok(author > generated, `Dart Sass flattens &:hover before the plugin runs, so the author's rule follows the generated states and wins ties: ${selectors}`);
});

test('MIG-B9-13: a rule nested after a control directive follows the directive\'s generated rules (negative control: uxdsl/postcss alone keeps it nested, before them)', () => {
  const postcss = require('postcss');
  const exported = require('../../dist/plugin');
  const plugin = exported.default || exported;
  const root = postcss([plugin({ includeTheme: false, discoverTheme: false })]).process('.btn { @ds-button(contained); &:hover { background: red; } }', { from: undefined }).root;
  const [btn, firstState] = root.nodes;
  assert.equal(btn.selector, '.btn');
  assert.ok(btn.nodes.some((node) => node.type === 'rule' && node.selector === '&:hover'), 'the nested rule stays inside .btn');
  assert.equal(firstState.selector, '.btn:hover:not(:where(:disabled, [aria-disabled="true"]))');
});

test('MIG-B9-13: dependencies are what Dart Sass loaded, then the discovered theme files; reserved names come from the effective theme', async () => {
  const dir = mkTmpDir();
  write(dir, '_a.uxdsl', '@use "b";\n.a { color: red; }\n');
  write(dir, '_b.uxdsl', '.b { color: blue; }\n');
  write(dir, 'x.css', '.x { color: green; }\n');
  const entry = write(dir, 'entry.uxdsl', '@use "a";\n@use "b";\n@import "x.css";\n');
  const loaded = await core.compile({ entry }, { includeTheme: false, theme: {} });
  assert.deepEqual(loaded.dependencies, [entry, path.join(dir, '_a.uxdsl'), path.join(dir, '_b.uxdsl')], 'the entry first, then Sass\'s load order, each once; the plain-CSS @import target is not loaded');
  assert.match(loaded.css, /^@import "x\.css";/);
  const usedCss = await core.compile({ entry: write(dir, 'use-css.uxdsl', '@use "x";\n') }, { includeTheme: false, theme: {} });
  assert.deepEqual(usedCss.dependencies, [path.join(dir, 'use-css.uxdsl'), path.join(dir, 'x.css')], 'the same file loaded with @use is listed');

  write(dir, 'uxdsl.theme.json', JSON.stringify({ breakpoints: { tablet: 700 } }));
  const source = '@function tablet($v) { @return $v; }\n.a { width: tablet(1px); }\n';
  const discovered = await inDirectory(dir, () => core.compile({ source, from: path.join(dir, 'tab.uxdsl') }, { includeTheme: false }));
  assert.deepEqual(discovered.dependencies, [path.join(dir, 'tab.uxdsl'), path.join(dir, 'uxdsl.theme.json')], 'the discovered theme file follows Sass\'s files');
  assert.deepEqual(discovered.warnings.map((warning) => [warning.text.split(' (')[0], warning.line, warning.column]), [['UXD_FUNCTION_SHADOWED: @function tablet', 1, 11]]);
  assert.equal(discovered.css, '.a {\n  width: 1px;\n}');
});

test('MIG-B9-13: dependencies are what Dart Sass loaded (negative control): with config.theme {}, tablet is not reserved and nothing warns', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.theme.json', JSON.stringify({ breakpoints: { tablet: 700 } }));
  const source = '@function tablet($v) { @return $v; }\n.a { width: tablet(1px); }\n';
  const explicit = await inDirectory(dir, () => core.compile({ source, from: path.join(dir, 'tab.uxdsl') }, { includeTheme: false, theme: {} }));
  assert.deepEqual(explicit.warnings, []);
  assert.deepEqual(explicit.dependencies, [path.join(dir, 'tab.uxdsl')], 'an explicit theme discovers nothing');
  assert.equal(explicit.css, '.a {\n  width: 1px;\n}');
});

test('MIG-B9-13: warnings are Dart Sass\'s, then the plugin\'s, at the author\'s positions; a plugin warning with no position is { text } alone', async () => {
  const dir = mkTmpDir();
  write(dir, '_a.uxdsl', '.a { color: red; }\n');
  // Line 1 gives Dart Sass's [import] warning and line 2 the plugin's reference warning; the
  // unknown theme family is the plugin's warning with no stylesheet position.
  const entry = write(dir, 'entry.uxdsl', '@import "a";\n.b { box-shadow: 0 0 0 space(1) var(--uxdsl__palette__nope-main); }\n');
  const { warnings } = await core.compile({ entry }, { includeTheme: false, theme: { unknownfamily: { a: 'b' } }, references: { mode: 'warn' } });
  const codeOf = (warning) => (/^UXD_[A-Z_]+/.exec(warning.text) || ['(no code)'])[0];
  assert.deepEqual(warnings.map((warning) => [codeOf(warning), Object.keys(warning).sort().join(','), warning.file, warning.line, warning.column]), [
    ['UXD_SASS_WARNING', 'column,file,line,text', entry, 1, 9],
    ['(no code)', 'text', undefined, undefined, undefined],
    ['UXD_REFERENCE_MISSING', 'column,file,line,text', entry, 2, 6],
  ]);
  assert.match(warnings[1].text, /^Unknown theme family "unknownfamily"/);
});
