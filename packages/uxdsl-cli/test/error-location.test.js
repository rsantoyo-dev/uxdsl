'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cli = path.join(__dirname, '..', 'bin', 'uxdsl.js');

test('MIG-B6-13: a CSS error in an imported partial names the partial and prints its code frame', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-location-'));
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(path.join(directory, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './src/a.css' };");
  fs.writeFileSync(path.join(directory, 'src', 'a.uxdsl'), '@import "./partial.uxdsl";\n');
  fs.writeFileSync(path.join(directory, 'src', 'partial.uxdsl'), '.card {\n  color: red;\n  padding: density(16);\n}\n');

  const result = spawnSync(process.execPath, [cli, 'build'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/partial\.uxdsl:3:12: UXD_DENSITY_REFERENCE: density\(16\) does not exist; available keys: 0–15\./);
  assert.match(result.stderr, />\s*3 \|\s+padding: density\(16\);/);
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
for (const [themeSnippet, expectedMessage] of [
  [{ surfaces: { contained: { bogus: 'red' } } }, 'UXD_SURFACE_FIELD: Unknown contained.bogus (at surfaces.contained.bogus).'],
  [{ densities: { x: '' } }, 'UXD_DENSITY_VALUE: Invalid x (at densities.x).'],
  [{ radii: { '1': '' } }, 'UXD_EDGE_VALUE: Invalid token 1 (at radii.1).'],
  [{ borders: { '1': '' } }, 'UXD_EDGE_VALUE: Invalid token 1 (at borders.1).'],
  [{ shadows: { '1': '' } }, 'UXD_SHADOW_VALUE: Invalid token 1 (at shadows.1).'],
]) {
  test(`MIG-B6-13: theme file location for ${expectedMessage.split(':')[0]}`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-cli-theme-location-'));
    fs.mkdirSync(path.join(directory, 'src'));
    fs.writeFileSync(path.join(directory, 'uxdsl.config.cjs'), "module.exports = { entry: './src/a.uxdsl', outFile: './src/a.css' };");
    fs.writeFileSync(path.join(directory, 'uxdsl.theme.config.cjs'), `module.exports = { theme: ${JSON.stringify(themeSnippet)} };`);
    fs.writeFileSync(path.join(directory, 'src', 'a.uxdsl'), '.card { color: red; }\n');

    const result = spawnSync(process.execPath, [cli, 'build'], { cwd: directory, encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`\\[uxdsl\\] Error: uxdsl\\.theme\\.config\\.cjs: ${expectedMessage.replace(/[.()]/g, '\\$&')}`));
  });
}