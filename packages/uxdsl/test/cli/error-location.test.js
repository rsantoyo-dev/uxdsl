'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cli = path.join(__dirname, '..', '..', 'bin', 'uxdsl.js');

test('MIG-B9-13: a CSS error in an imported partial names the partial at its declaration start and prints its code frame', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-location-'));
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(path.join(directory, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './src/a.css' };");
  fs.writeFileSync(path.join(directory, 'src', 'a.uxdsl'), '@import "./partial.uxdsl";\n');
  fs.writeFileSync(path.join(directory, 'src', 'partial.uxdsl'), '.card {\n  color: red;\n  padding: density(16);\n}\n');

  const result = spawnSync(process.execPath, [cli, 'build'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 1);
  // Dart Sass maps the start of a declaration, so the position is where `padding` starts.
  assert.match(result.stderr, /src\/partial\.uxdsl:3:3: UXD_DENSITY_REFERENCE: density\(16\) does not exist; available keys: 0–15\./);
  assert.match(result.stderr, />\s*3 \|\s+padding: density\(16\);/);
  assert.doesNotMatch(result.stderr, /src\/a\.uxdsl:\d/, 'never the importing file');
  assert.doesNotMatch(result.stderr, /:3:12:/, 'not the token column the former pipeline printed');
  assert.equal(fs.existsSync(path.join(directory, 'src', 'a.css')), false);
});

test('MIG-B6-13: a theme error names the theme file and exact key path', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-theme-location-'));
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(path.join(directory, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './src/a.css' };");
  fs.writeFileSync(path.join(directory, 'uxdsl.theme.json'), JSON.stringify({ typography_details: { h1: { fontsize: '2rem' } } }));
  fs.writeFileSync(path.join(directory, 'src', 'a.uxdsl'), '.card { color: red; }\n');

  const result = spawnSync(process.execPath, [cli, 'build'], { cwd: directory, encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[uxdsl\] Error: uxdsl\.theme\.json: UXD_TYPO_FIELD: Invalid h1\.fontsize \(at typography_details\.h1\.fontsize\)\./);
});

// MIG-B6-13 code-review follow-up: surfaces/densities/radii/borders theme
// errors previously threw a plain, unlocated Error, so annotateThemeError
// (which only fires when `err.keyPath` is set) never got a chance to
// prepend the theme file's path for them — this exercises that same CLI
// path (build -> buildOnce -> annotateThemeError) for each newly-located
// family, not just typography_details.
// Stability phase 1: an empty leaf is a structural problem the one validator
// reports as UXD_THEME_INVALID (same key path) before any engine runs; an
// unknown field is still the engine's own closed-set code.
for (const [themeSnippet, expectedMessage] of [
  [{ surfaces: { contained: { bogus: 'red' } } }, 'UXD_SURFACE_FIELD: Unknown contained.bogus (at surfaces.contained.bogus).'],
  [{ densities: { x: '' } }, 'UXD_THEME_INVALID: Expected a nonempty string, got an empty string (at densities.x).'],
  [{ radii: { '1': '' } }, 'UXD_THEME_INVALID: Expected a nonempty string, got an empty string (at radii.1).'],
  [{ borders: { '1': '' } }, 'UXD_THEME_INVALID: Expected a nonempty string, got an empty string (at borders.1).'],
  [{ shadows: { '1': '' } }, 'UXD_THEME_INVALID: Expected a nonempty string, got an empty string (at shadows.1).'],
  [{ palette: { primary: { main: 5 } } }, 'UXD_THEME_INVALID: Expected a nonempty string, got number 5 (at palette.primary.main).'],
]) {
  test(`MIG-B6-13: theme file location for ${expectedMessage.split(':')[0]} at ${expectedMessage.match(/\(at ([^)]+)\)/)[1]}`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-theme-location-'));
    fs.mkdirSync(path.join(directory, 'src'));
    fs.writeFileSync(path.join(directory, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './src/a.css' };");
    fs.writeFileSync(path.join(directory, 'uxdsl.theme.cjs'), `module.exports = ${JSON.stringify(themeSnippet)};`);
    fs.writeFileSync(path.join(directory, 'src', 'a.uxdsl'), '.card { color: red; }\n');

    const result = spawnSync(process.execPath, [cli, 'build'], { cwd: directory, encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`\\[uxdsl\\] Error: uxdsl\\.theme\\.cjs: ${expectedMessage.replace(/[.()]/g, '\\$&')}`));
  });
}
// A Sass failure is printed as its message, then Sass's own frame of the
// author's source (`error.sassFrame`: the code frame and Sass's stack, without
// the message line), every frame line indented by two spaces. A UXDSL error in
// a Sass-heavy file keeps PostCSS's frame of the author's source.
function mkSassProject(prefix) {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function put(directory, relative, text) {
  fs.mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
  fs.writeFileSync(path.join(directory, relative), text);
}

test("MIG-B9-14: a Sass error prints UXD_SASS at the author's position with Sass's frame; a UXDSL error in a Sass-heavy file prints heavy.uxdsl:18:66 with its frame", () => {
  // One entry: the message line, then the frame and the stack, nothing else.
  const single = mkSassProject('uxdsl-cli-sass-frame-');
  put(single, 'uxdsl.config.cjs', "module.exports = { entry: './src/a.uxdsl', outFile: './src/a.css' };");
  put(single, 'src/a.uxdsl', "@use './missing';\n");
  const one = spawnSync(process.execPath, [cli, 'build'], { cwd: single, encoding: 'utf8' });
  assert.equal(one.status, 1, one.stderr);
  assert.equal(one.stdout, '');
  assert.equal(one.stderr, [
    "[uxdsl] Error: src/a.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import.",
    '    ╷',
    "  1 │ @use './missing';",
    '    │ ^^^^^^^^^^^^^^^^',
    '    ╵',
    '    src/a.uxdsl 1:1  root stylesheet',
    '',
  ].join('\n'));
  assert.equal(fs.existsSync(path.join(single, 'src', 'a.css')), false, 'nothing is written');

  // A "builds" config keeps the entry's label before the location, and the frame follows.
  const multi = mkSassProject('uxdsl-cli-sass-frame-builds-');
  put(multi, 'uxdsl.config.cjs', "module.exports = { builds: [\n  { entry: './src/a.uxdsl', outFile: './out/a.css' },\n  { entry: './src/b.uxdsl', outFile: './out/b.css' },\n] };");
  put(multi, 'src/a.uxdsl', '.a { color: red; }\n');
  put(multi, 'src/b.uxdsl', "@use './gone';\n.b { color: blue; }\n");
  const two = spawnSync(process.execPath, [cli, 'build'], { cwd: multi, encoding: 'utf8' });
  assert.equal(two.status, 1, two.stderr);
  assert.equal(two.stderr, [
    "[uxdsl] Error: builds[1] (out/b.css): src/b.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import.",
    '    ╷',
    "  1 │ @use './gone';",
    '    │ ^^^^^^^^^^^^^',
    '    ╵',
    '    src/b.uxdsl 1:1  root stylesheet',
    '',
  ].join('\n'));
  assert.equal(fs.existsSync(path.join(multi, 'out')), false, 'no entry is written when one fails');

  // A UXDSL error inside a Sass-heavy file: PostCSS's frame of the author's line,
  // the caret under the column compile() reports.
  const heavy = mkSassProject('uxdsl-cli-sass-heavy-');
  for (const file of ['heavy.uxdsl', '_mixins.uxdsl']) {
    fs.copyFileSync(path.join(__dirname, '..', 'core', 'fixtures', 'sass-maps', file), path.join(heavy, file));
  }
  const h = spawnSync(process.execPath, [cli, 'build', '--entry', 'heavy.uxdsl', '--out', 'out.css', '--no-include-theme'], { cwd: heavy, encoding: 'utf8' });
  assert.equal(h.status, 1, h.stderr);
  const lines = h.stderr.split('\n');
  assert.match(lines[0], /^\[uxdsl\] Error: uxdsl: heavy\.uxdsl:18:66: UXD_SPACE_REFERENCE: space\(404\) does not exist/);
  const at = lines.findIndex((line) => /^> 18 \|/.test(line));
  assert.ok(at > 0, h.stderr);
  const code = lines[at].indexOf('|') + 2;
  assert.ok(lines[at].slice(code + 65).startsWith('inset: space(404);'), lines[at]);
  assert.equal(lines[at + 1].indexOf('^') - code + 1, 66, `${lines[at]}\n${lines[at + 1]}`);
  assert.equal(fs.existsSync(path.join(heavy, 'out.css')), false);
});

test("MIG-B9-14: the CLI's Sass frame shows the author's text, where error.cause shows the protected text (negative control)", async () => {
  const source = '.a { color: palette(primary.main); border-color: color(gray.300); width: $nope; }\n';
  const directory = mkSassProject('uxdsl-cli-sass-protected-');
  put(directory, 'uxdsl.config.cjs', "module.exports = { entry: './src/a.uxdsl', outFile: './src/a.css' };");
  put(directory, 'src/a.uxdsl', source);

  // The protected text exists: a printer of error.cause.message would show it.
  const { compile } = require('../../dist/compile');
  const error = await compile({ source, from: path.join(directory, 'src', 'a.uxdsl') }, { theme: {}, includeTheme: false }).then(() => null, (e) => e);
  assert.ok(error, 'the source must fail in Sass');
  assert.equal(error.code, 'UXD_SASS');
  assert.match(error.cause.message, /#\{"palette\(primary\.main\)"\}/);

  const result = spawnSync(process.execPath, [cli, 'build'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const lines = result.stderr.split('\n');
  assert.equal(lines[0], '[uxdsl] Error: src/a.uxdsl:1:74: UXD_SASS: Undefined variable.');
  const code = lines.find((line) => line.startsWith('  1 │ '));
  assert.equal(code, `  1 │ ${source.trimEnd()}`, result.stderr);
  const caret = lines[lines.indexOf(code) + 1];
  assert.equal(caret.indexOf('^') - (code.indexOf('│') + 2) + 1, 74, `${code}\n${caret}`);
  assert.doesNotMatch(result.stderr, /#\{/, 'never the protected text');
});
