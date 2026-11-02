'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertAuthorLocated, assertMissingImport } = require('./run');
const { PACKAGE_DIR } = require('../lib/tarball-consumer');

// The release gate's S-3 and N-02 verdicts, on the output they must accept and
// on the failures they exist to catch. The gate applies them to the installed
// tarball; here the accepted output comes from this repository's own build.

const temporaryDirectory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-gate-verdicts-'));

/** `uxdsl build` of heavy.uxdsl, as S-3 runs it. */
function buildHeavy() {
  const dir = temporaryDirectory();
  for (const file of ['heavy.uxdsl', '_mixins.uxdsl']) {
    fs.copyFileSync(path.join(PACKAGE_DIR, 'test/core/fixtures/sass-maps', file), path.join(dir, file));
  }
  return spawnSync(process.execPath, [path.join(PACKAGE_DIR, 'bin/uxdsl.js'), 'build', '--entry', 'heavy.uxdsl', '--out', 'out.css', '--no-include-theme'], { cwd: dir, encoding: 'utf8' });
}

test('MIG-B9-13: S-3 accepts `uxdsl build` of heavy.uxdsl: UXD_SPACE_REFERENCE at the author\'s 18:66, framed at the author\'s line 18', () => {
  const built = buildHeavy();
  assert.equal(assertAuthorLocated(built), 'heavy.uxdsl:18:66 UXD_SPACE_REFERENCE, framed at the author\'s line 18', built.stderr);
});

test('MIG-B9-13: S-3 rejects a build that is not located and framed at the author\'s line (negative control)', () => {
  const [message] = buildHeavy().stderr.split('\n');
  assert.match(message, /heavy\.uxdsl:18:66: UXD_SPACE_REFERENCE/);
  for (const [built, reason] of [
    [{ status: 0, stderr: '' }, /^exited 0/],
    // The SCSS subset's build of the same file.
    [{ status: 1, stderr: '[uxdsl] Error: uxdsl: heavy.uxdsl:1:1: UXD_SCSS_UNSUPPORTED: @use is not part of the SCSS subset UXDSL compiles; the subset has @import with a path ("./partial") and no modules.\n' }, /^stderr: .*heavy\.uxdsl:1:1: UXD_SCSS_UNSUPPORTED/],
    // Dart Sass's output, where the declaration is on line 29, framed under the author's position.
    [{ status: 1, stderr: `${message}\n  28 | .card__body {\n> 29 |   inset: space(404);\n     |   ^\n  30 | }\n` }, /line 29 of Dart Sass's output/],
    // Line 18 of Dart Sass's output, framed under the author's position.
    [{ status: 1, stderr: `${message}\n  17 | }\n> 18 | .card--primary {\n     |                 ^\n  19 |   @ds-button (contained primary 1);\n` }, /line 18 is not the author's/],
    // The author's line, with the caret elsewhere.
    [{ status: 1, stderr: `${message}\n> 18 |       padding: density(2); margin: space(1); outline: border(1); inset: space(404);\n     |       ^\n` }, /caret/],
    [{ status: 1, stderr: `${message}\n` }, /no code frame of the author's line 18/],
  ]) {
    assert.throws(() => assertAuthorLocated(built), { message: reason }, built.stderr);
  }
});

/** compile() of a file whose first line @imports a missing partial, as N-02 runs it: the rejection. */
async function missingImport() {
  const dir = temporaryDirectory();
  fs.writeFileSync(path.join(dir, 'missing-partial.uxdsl'), '@import "./nope.uxdsl";\n.a { color: red; }\n');
  const { compile } = require(path.join(PACKAGE_DIR, 'dist/entries/index.js'));
  return compile({ entry: path.join(dir, 'missing-partial.uxdsl') }, { theme: {}, includeTheme: false }).then(() => undefined, (error) => error);
}

test('MIG-B9-13: N-02 accepts Dart Sass\'s UXD_SASS "Can\'t find stylesheet to import." at missing-partial.uxdsl:1:9', async () => {
  assert.equal(assertMissingImport(await missingImport()), 'UXD_SASS at missing-partial.uxdsl:1:9: Can\'t find stylesheet to import.');
});

test('MIG-B9-13: N-02 rejects a compile that succeeds, an error with another code or message, and the wrong position (negative control)', async () => {
  const error = await missingImport();
  const like = (changes) => Object.assign(Object.create(Object.getPrototypeOf(error)), error, { message: error.message }, changes);
  for (const [candidate, reason] of [
    [undefined, /^compiled$/],
    // An error with no code, such as postcss-import's for the same file.
    [new Error('Failed to find \'./nope.uxdsl\''), /^code undefined: Failed to find/],
    [like({ code: 'UXD_SASS_WARNING' }), /^code UXD_SASS_WARNING/],
    [like({ message: `${error.file}:1:9: UXD_SASS: Undefined variable.` }), /^message: /],
    [like({ column: 1 }), /^located at missing-partial\.uxdsl:1:1$/],
    [like({ file: path.join(path.dirname(error.file), 'nope.uxdsl') }), /^located at nope\.uxdsl:1:9$/],
  ]) {
    assert.throws(() => assertMissingImport(candidate), { message: reason });
  }
});
