'use strict';

// MIG-B6-18 (FEAT-008): the one shared compile() pipeline. Supersedes
// inline-imports.test.js (migrated here to node --test, same two cases:
// import cycles and non-cyclic duplicate imports), and adds coverage for
// what the previous line-by-line string implementation got wrong without
// ever erroring: url()/comment corruption, and a silently-ignored missing
// import. See docs/features/FEAT-008/MIG-B6-18-compile-compartido.md.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../dist/index.js');

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

test('MIG-B6-18: require(\'uxdsl-core\') is callable and exposes .compile', () => {
  assert.equal(typeof core, 'function');
  assert.equal(typeof core.compile, 'function');
});

test('MIG-B6-18: processUxdsl(source, options) keeps returning a Promise<string> (D3 compatibility)', async () => {
  const result = core('.a { color: red; }', { includeTheme: false });
  assert.ok(result instanceof Promise);
  const css = await result;
  assert.equal(typeof css, 'string');
  assert.match(css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
});

// --- Import cycles: migrated from inline-imports.test.js, now a hard error
// instead of the old string-based inlineImports() detecting it one way
// while postcss-import (used directly, no cycle guard) silently duplicated
// content instead of failing. ---

test('MIG-B6-18: a real import cycle fails naming the full file chain', async () => {
  const entry = path.join(FIXTURES, 'cycle-a.uxdsl');
  const source = fs.readFileSync(entry, 'utf8');
  await assert.rejects(
    () => core(source, { fileId: entry }),
    (err) => {
      assert.match(err.message, /^UXD_IMPORT_CYCLE: Circular import detected: /);
      assert.match(err.message, /cycle-a\.uxdsl -> .*cycle-b\.uxdsl -> .*cycle-a\.uxdsl/);
      return true;
    }
  );
});

test('MIG-B6-18: compile({ entry }) rejects the same cycle the same way', async () => {
  const entry = path.join(FIXTURES, 'cycle-a.uxdsl');
  await assert.rejects(() => core.compile({ entry }), /UXD_IMPORT_CYCLE: Circular import detected: /);
});

test('MIG-B6-20: compile({ source, from }) rejects the same cycle too — not just compile({ entry }) — since the Webpack loader and Vite\'s optional Sass pre-pass only ever call compile() this way', async () => {
  const entry = path.join(FIXTURES, 'cycle-a.uxdsl');
  const source = fs.readFileSync(entry, 'utf8');
  await assert.rejects(
    () => core.compile({ source, from: entry }),
    (err) => {
      assert.match(err.message, /^UXD_IMPORT_CYCLE: Circular import detected: /);
      assert.match(err.message, /cycle-a\.uxdsl -> .*cycle-b\.uxdsl -> .*cycle-a\.uxdsl/);
      return true;
    }
  );
});

test('MIG-B6-20: compile({ source, from }) still resolves a bare package-specifier @import, matching compile({ entry })', async () => {
  const source = "@import 'postcss-uxdsl/theme/default-colors.css';\n.a { color: red; }\n";
  const css = await core.compile({ source, from: path.join(FIXTURES, 'virtual-entry.uxdsl') }, { includeTheme: false });
  assert.match(css.css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
});

test('MIG-B6-20: compile({ source, from }) does not require `from` to be a real file on disk (an unsaved editor buffer/Sass-preprocessed content)', async () => {
  const result = await core.compile(
    { source: '.a { color: red; }', from: path.join(FIXTURES, 'this-file-does-not-exist-on-disk.uxdsl') },
    { includeTheme: false }
  );
  assert.match(result.css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
});

test('MIG-B6-18: a non-cyclic duplicate import is inlined only once (unchanged from before)', async () => {
  const entry = path.join(FIXTURES, 'duplicate-root.uxdsl');
  const source = fs.readFileSync(entry, 'utf8');
  // References validation is off — this fixture is about import
  // resolution, not styling. See docs/features/FEAT-002-beta-migration-hardening.md.
  const css = await core(source, { fileId: entry, references: { mode: 'off' } });
  const occurrences = css.split('--dup-test').length - 1;
  assert.equal(occurrences, 1, 'duplicate partial should be inlined only once');
});

// --- Missing import: a real, located postcss-import error, not a silently
// left-alone @import line in the output (the old string-based inlineImports
// only ever inlined a file if fs.existsSync() found it — otherwise the
// @import line just passed through untouched, compiling to invalid CSS with
// no error at all). ---

test('MIG-B6-18: a nonexistent import fails, naming the importing file and the exact line', async () => {
  const dir = mkTmpDir();
  // @import must be the first rule (CSS spec) — otherwise postcss-import
  // treats it as invalid and silently skips resolving it rather than
  // erroring, which would defeat the point of this test.
  const entry = write(dir, 'main.uxdsl', '@import "./missing-partial.uxdsl";\n.after { color: blue; }\n');
  const error = await core(fs.readFileSync(entry, 'utf8'), { fileId: entry, includeTheme: false }).then(() => null, e => e);
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /main\.uxdsl:1:1/);
  assert.match(error.message, /Failed to find '\.\/missing-partial\.uxdsl'/);
});

// --- url()/comment corruption: the old stripLineComments() cut everything
// after "//" on each line outside quotes, which doesn't understand
// unquoted url() or block comments — a real regression this compile()
// (real postcss-scss parsing, no line-splitting) closes. ---

test('MIG-B6-18: an unquoted url() with "//" is left completely intact', async () => {
  const css = await core('.a { background: url(https://example.com/a.png); }', { includeTheme: false });
  assert.match(css, /url\(https:\/\/example\.com\/a\.png\)/);
});

test('MIG-B6-18: a block comment containing a URL is left completely intact (not treated as a line comment)', async () => {
  const css = await core('/* docs: https://uxdsl.dev */\n.a { color: red; }', { includeTheme: false });
  assert.match(css, /\/\* docs: https:\/\/uxdsl\.dev \*\//);
  assert.match(css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
});

test('MIG-B6-18: a real "//" line comment (SCSS-style, outside any URL) is still stripped by the postcss-scss syntax itself', async () => {
  const css = await core('// a real comment\n.a { color: red; }', { includeTheme: false });
  assert.doesNotMatch(css, /a real comment/);
  assert.match(css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
});

// --- $var responsive expansion, matching MIG-B6-14's plugin-alone fix,
// now via the full pipeline (postcss-advanced-variables resolves $vars
// before postcss-uxdsl ever runs, so this was never actually broken at
// this layer — confirmed here so a future regression at either layer is
// caught). ---

test('MIG-B6-18: a $var holding a responsive expression expands into a real @media block', async () => {
  const css = await core('$gap: xs(1rem) md(2rem);\n.a { gap: $gap; }\n', { includeTheme: false });
  assert.match(css, /\.a\s*\{\s*gap:\s*1rem;?\s*\}/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.doesNotMatch(css, /\$gap/);
});

// --- Conditional imports (media/supports/layer): semantics must be
// preserved, not deduplicated by path globally regardless of the
// condition it's imported under. ---

test('MIG-B6-18: the same partial imported once plain and once under @media keeps both, not deduplicated away', async () => {
  const dir = mkTmpDir();
  write(dir, 'shared.uxdsl', '.shared { color: red; }');
  const entry = write(dir, 'main.uxdsl', '@import "./shared.uxdsl";\n@import "./shared.uxdsl" (min-width: 768px);\n');
  const css = await core(fs.readFileSync(entry, 'utf8'), { fileId: entry, includeTheme: false });
  assert.match(css, /\.shared\s*\{\s*color:\s*red;?\s*\}/);
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*\.shared/);
});

// --- Bare package-specifier imports (`@import 'postcss-uxdsl/theme/...'`,
// as playground-nextjs's real entry does): must resolve through real node
// module resolution, not existsSync(path.resolve(basedir, id)) — the old
// CLI's inline resolver used require.resolve() unconditionally and this
// compile() must not regress that for anything that isn't a relative
// path. ---

test('MIG-B6-18: a bare package-specifier @import (not relative, not "~") resolves via node module resolution', async () => {
  const dir = mkTmpDir();
  const entry = write(dir, 'main.uxdsl', "@import 'postcss-uxdsl/theme/default-colors.css';\n.a { color: red; }\n");
  const css = await core(fs.readFileSync(entry, 'utf8'), { fileId: entry, includeTheme: false });
  assert.match(css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
});

// --- Native CSS / comments left alone entirely when there's nothing
// UXDSL-specific to do — a positive control that this pipeline doesn't
// touch ordinary CSS it doesn't need to. ---

test('MIG-B6-18 (positive control): plain native CSS with no UXDSL functions compiles unchanged', async () => {
  const css = await core('.a {\n  color: red;\n  margin: 0 auto;\n}\n', { includeTheme: false });
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

test('MIG-B6-18: compile({ source, from }) compiles in-memory source without a real entry file', async () => {
  const result = await core.compile({ source: '.a { color: red; }', from: '/virtual/panel.uxdsl' }, { includeTheme: false });
  assert.match(result.css, /\.a\s*\{\s*color:\s*red;?\s*\}/);
  assert.deepEqual(result.dependencies, []);
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
