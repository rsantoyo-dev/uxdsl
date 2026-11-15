'use strict';

// The error compile() throws carries `warnings`: the warnings it produced
// before it failed, in the order CompileResult.warnings lists them (Dart
// Sass's, then UXD_FUNCTION_SHADOWED, then the plugin's), each at the author's
// position. It is always present, `[]` when nothing came first, and nothing
// else on the error changes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { compile } = require('../../dist/compile');

const DEPRECATION = 'UXD_SASS_WARNING: [global-builtin] Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0.';

function project(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-error-warnings-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** The error compile() rejects with. */
async function failure(input, config = {}) {
  try {
    await compile(input, { discoverTheme: false, ...config });
  } catch (error) {
    return error;
  }
  assert.fail('compile() resolved');
}

/** A file whose line 3 raises Dart Sass's global-builtin deprecation and whose line 4 is `last`. */
const withDeprecation = (last) => `$m: (a: 1px);\n.a {\n  margin: map-get($m, a);\n  ${last}\n}\n`;

test("MIG-B9-21: compile()'s error carries the warnings produced before it, in the order a result lists them", async (t) => {
  const dir = project(t);
  const file = path.join(dir, 'a.uxdsl');

  // The same file, compiling: what its result lists before line 4.
  fs.writeFileSync(file, withDeprecation('padding: space(2);'));
  const ok = await compile({ entry: file }, { discoverTheme: false });
  assert.deepEqual(ok.warnings, [{ text: DEPRECATION, file, line: 3, column: 11 }]);

  // A UXDSL error after the deprecation: the plugin's CssSyntaxError, unchanged but for `warnings`.
  fs.writeFileSync(file, withDeprecation('padding: space(999);'));
  const uxdsl = await failure({ entry: file });
  assert.equal(uxdsl.name, 'CssSyntaxError');
  assert.deepEqual(
    { file: uxdsl.file, line: uxdsl.line, column: uxdsl.column, code: uxdsl.code },
    { file, line: 4, column: 3, code: undefined }
  );
  assert.match(uxdsl.message, /a\.uxdsl:4:3: UXD_SPACE_REFERENCE: space\(999\) does not exist/);
  assert.deepEqual(uxdsl.warnings, ok.warnings);
  assert.ok(Object.prototype.propertyIsEnumerable.call(uxdsl, 'warnings'));

  // A Sass error after the deprecation: UXD_SASS, unchanged but for `warnings`.
  fs.writeFileSync(file, withDeprecation('@error "boom";'));
  const sass = await failure({ entry: file });
  assert.deepEqual({ file: sass.file, line: sass.line, column: sass.column, code: sass.code }, { file, line: 4, column: 3, code: 'UXD_SASS' });
  assert.match(sass.message, /a\.uxdsl:4:3: UXD_SASS: "boom"/);
  assert.equal(typeof sass.sassFrame, 'string');
  assert.deepEqual(sass.warnings, ok.warnings);

  // Dart Sass's warning, then the plugin's (an unknown theme family), then the error.
  fs.writeFileSync(file, withDeprecation('padding: space(999);'));
  const both = await failure({ entry: file }, { theme: { notafamily: { a: '1px' } } });
  assert.equal(both.warnings.length, 2, JSON.stringify(both.warnings));
  assert.deepEqual(both.warnings[0], ok.warnings[0]);
  assert.deepEqual(both.warnings[1], { text: 'Unknown theme family "notafamily" — it will not be compiled into any CSS.' });

  // A removed option is the plugin's warning too, with no position.
  const removed = await failure({ source: '.a { padding: space(999); }', from: path.join(dir, 'b.css') }, { themeVar: '--x' });
  assert.deepEqual(removed.warnings, [{ text: 'UXD_OPTION_REMOVED: the "themeVar" option was removed and is ignored; palette() always compiles to var(--uxdsl__palette__<key>).' }]);

  // An anonymous source names no file, in the error or in a warning.
  const anonymous = await failure({ source: withDeprecation('padding: space(999);') });
  assert.equal(anonymous.file, undefined);
  assert.deepEqual(anonymous.warnings, [{ text: DEPRECATION, line: 3, column: 11 }]);
  const anonymousSass = await failure({ source: withDeprecation('@error "boom";') });
  assert.deepEqual(anonymousSass.warnings, [{ text: DEPRECATION, line: 3, column: 11 }]);
});

test("MIG-B9-21: a Sass error raised after a project @function shadows a token function carries UXD_FUNCTION_SHADOWED after Dart Sass's warnings", async (t) => {
  const dir = project(t);
  const file = path.join(dir, 'a.uxdsl');
  // Line 2 defines a project space(), which raises @error for 999; line 9 is `last`.
  const shadowing = (last) =>
    `$m: (a: 1px);\n@function space($n) {\n  @if $n == 999 { @error "big"; }\n  @return $n * 1px;\n}\n.a {\n  margin: map-get($m, a);\n  padding: space(2);\n  ${last}\n}\n`;

  // The same file, compiling: the deprecation, then the shadowing at the definition.
  fs.writeFileSync(file, shadowing('width: space(3);'));
  const ok = await compile({ entry: file }, { discoverTheme: false });
  assert.deepEqual(
    ok.warnings.map((warning) => [warning.text.split(':')[0], warning.line]),
    [['UXD_SASS_WARNING', 7], ['UXD_FUNCTION_SHADOWED', 2]]
  );

  fs.writeFileSync(file, shadowing('width: space(999);'));
  const error = await failure({ entry: file });
  assert.equal(error.code, 'UXD_SASS');
  assert.match(error.message, /UXD_SASS: "big"/);
  assert.deepEqual(error.warnings, ok.warnings);
});

test("MIG-B9-21: compile()'s error carries an empty warnings list when nothing came before it", async (t) => {
  const dir = project(t);
  const file = path.join(dir, 'a.uxdsl');
  fs.writeFileSync(file, '.a {\n  padding: space(999);\n}\n');
  assert.deepEqual((await failure({ entry: file })).warnings, []);
  fs.writeFileSync(file, '.a {\n  @error "boom";\n}\n');
  assert.deepEqual((await failure({ entry: file })).warnings, []);
  assert.deepEqual((await failure({ entry: path.join(dir, 'missing.uxdsl') })).warnings, []);
  assert.deepEqual((await failure({ entry: file }, { sass: { nope: true } })).warnings, []);
});
