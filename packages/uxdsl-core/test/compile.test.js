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

test('MIG-B6-18: compile() rejects any sourceMap value other than false — declared, not silently ignored (MIG-B6-21 implements it)', async () => {
  await assert.rejects(
    () => core.compile({ source: '.a{}' }, { sourceMap: 'inline' }),
    /sourceMap option "inline" is not implemented yet/
  );
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
