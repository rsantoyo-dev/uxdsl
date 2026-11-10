'use strict';

// Stability phase 4 (decision DE-9): `@uxdsl theme;` emits the theme where it
// is written, and only there — so a PostCSS-only setup (Next.js with
// `'uxdsl/postcss': { includeTheme: false }` in postcss.config.js) needs no
// CLI: the one global stylesheet carries the marker, every CSS Module just
// uses tokens and stays free of `:root`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const plugin = require('../dist/plugin');
const { compile } = require('../dist/entries/index');
const { generateThemeCss } = require('../dist/entries/theme');

const run = (css, options = {}) => postcss([plugin({ discoverTheme: false, ...options })]).process(css, { from: 'globals.css' }).css;
const rootBlocks = (css) => (css.match(/(^|[\s}]):root[\s{[:]/g) || []).length;
const failure = (fn) => { try { fn(); } catch (error) { return error; } throw new Error('expected a failure'); };

test('DE-9: with includeTheme: false, `@uxdsl theme;` emits the theme at the marker and nowhere else', () => {
  const css = run('.before { color: red; }\n@uxdsl theme;\n.after { color: palette(primary.main); }\n', { includeTheme: false });
  assert.doesNotMatch(css, /@uxdsl/, 'the marker itself is not in the output');
  assert.ok(rootBlocks(css) > 0, 'the theme was emitted');
  const before = css.indexOf('.before');
  const firstRoot = css.indexOf(':root');
  const after = css.indexOf('.after');
  assert.ok(before < firstRoot && firstRoot < after, 'the theme sits where the marker was');
  assert.match(css.slice(firstRoot, after), /--uxdsl__palette__primary-main:/);
});

test('DE-9: the emitted theme is the theme stylesheet generateThemeCss returns, byte for byte (its @imports lead the file)', () => {
  const theme = { fonts: { google: ['Inter:wght@400;700'] } };
  const css = run('.a { color: red; }\n@uxdsl theme;\n', { includeTheme: false, theme });
  const generated = generateThemeCss(theme);
  const imports = generated.split('\n').filter((line) => line.startsWith('@import'));
  const blocks = generated.split('\n').filter((line) => !line.startsWith('@import')).join('\n');
  assert.ok(imports.length > 0, 'control: the theme has a Google Fonts @import');
  assert.ok(css.startsWith(imports.join('\n')), 'the theme\'s @import leads the stylesheet, as CSS requires');
  assert.ok(css.includes(blocks), 'the blocks are the generated theme, unchanged');
});

test('DE-9: without the marker, includeTheme: false still emits no :root (a CSS Module)', () => {
  const css = run('.card { padding: density(2); color: palette(primary.main); }\n', { includeTheme: false });
  assert.equal(rootBlocks(css), 0);
  assert.match(css, /var\(--uxdsl__density__2\)/);
});

test('DE-9: with the default includeTheme, the marker decides where the one copy goes', () => {
  const css = run('.first { color: red; }\n@uxdsl theme;\n');
  const marked = css.indexOf(':root');
  assert.ok(css.indexOf('.first') < marked, 'not hoisted above the rules written before the marker');
  assert.equal(css.split('--uxdsl__palette__primary-main:').length - 1, run('.first { color: red; }\n').split('--uxdsl__palette__primary-main:').length - 1, 'emitted once, as without the marker');
});

test('DE-9: a misplaced, repeated or misspelled marker is UXD_THEME_MARKER, with its position', () => {
  const nested = failure(() => run('.a { @uxdsl theme; }\n', { includeTheme: false }));
  assert.match(nested.message, /UXD_THEME_MARKER: .*top level/);
  assert.equal(nested.line, 1);
  const media = failure(() => run('@media (min-width: 1px) { @uxdsl theme; }\n', { includeTheme: false }));
  assert.match(media.message, /UXD_THEME_MARKER/);
  const twice = failure(() => run('@uxdsl theme;\n.a { color: red; }\n@uxdsl theme;\n', { includeTheme: false }));
  assert.match(twice.message, /UXD_THEME_MARKER: .*twice/);
  assert.equal(twice.line, 3);
  const typo = failure(() => run('@uxdsl them;\n', { includeTheme: false }));
  assert.match(typo.message, /UXD_THEME_MARKER: @uxdsl them is not a UXDSL at-rule.*`@uxdsl theme;`/);
  const block = failure(() => run('@uxdsl theme { }\n', { includeTheme: false }));
  assert.match(block.message, /UXD_THEME_MARKER/);
});

test('DE-9: the marker works through compile() (the pipeline the CLI and the adapters run)', async () => {
  const { css } = await compile({ source: '$gap: 1rem;\n@uxdsl theme;\n.a { gap: $gap; color: palette(primary.main); }\n', from: 'globals.uxdsl' }, { includeTheme: false, theme: {} });
  assert.ok(rootBlocks(css) > 0);
  assert.doesNotMatch(css, /@uxdsl/);
});

test('DE-9: the emitted theme is reference-checked like any other: a dangling theme value fails the marked stylesheet', () => {
  const theme = { palette: { primary: { main: 'color(nope.500)' } } };
  const error = failure(() => run('@uxdsl theme;\n.a { color: red; }\n', { includeTheme: false, theme }));
  assert.match(error.message, /UXD_REFERENCE_MISSING: .*--uxdsl__color__nope-500/);
});

// compile() reports whether its compilation emitted the theme. The PostCSS
// plugin says so in one result message per compilation, which compile() reads:
// a build host counts its stylesheets from that flag, never from its own
// options or a :root search.

const tmpProject = (t, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-theme-emitted-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
};
const themeMessages = (result) => result.messages.filter((message) => message.type === 'uxdsl-theme');
const definitions = (css) => css.split('--uxdsl__palette__primary-main:').length - 1;

test('MIG-B9-20: compile() reports whether the compilation emitted the theme', async (t) => {
  const marked = await compile({ source: '@uxdsl theme;\n.card { padding: density(4); }\n', from: 'marked.uxdsl' }, { theme: {} });
  assert.equal(marked.themeEmitted, true, 'the marker emits the theme, and compile() says so');
  assert.ok(rootBlocks(marked.css) > 0, 'control: the marked output defines :root');

  const unmarked = await compile({ source: '.card { padding: density(4); }\n', from: 'card.uxdsl' }, { theme: {}, includeTheme: false });
  assert.equal(unmarked.themeEmitted, false, 'no marker and no default theme: nothing emitted, and compile() says so');
  assert.equal(rootBlocks(unmarked.css), 0, 'control: the unmarked output defines no :root');

  const dir = tmpProject(t, {
    '_theme.uxdsl': '@uxdsl theme;\n',
    'global.uxdsl': "@use './theme';\n.card { padding: density(4); }\n",
  });
  const used = await compile({ entry: path.join(dir, 'global.uxdsl') }, { theme: {}, includeTheme: false });
  assert.equal(used.themeEmitted, true, 'a marker reached through @use emits the theme');
  assert.ok(rootBlocks(used.css) > 0);

  const alone = await postcss([plugin({ discoverTheme: false, includeTheme: false })]).process('@uxdsl theme;\n.a { color: red; }\n', { from: 'a.css' });
  assert.deepEqual(themeMessages(alone), [{ type: 'uxdsl-theme', plugin: 'uxdsl', emitted: true }], 'the plugin alone pushes one message per compilation');
  const aloneUnmarked = await postcss([plugin({ discoverTheme: false, includeTheme: false })]).process('.a { color: red; }\n', { from: 'a.css' });
  assert.deepEqual(themeMessages(aloneUnmarked), [{ type: 'uxdsl-theme', plugin: 'uxdsl', emitted: false }]);
});

test('MIG-B9-20: a marker partial reached by @use from two modules of one compilation is emitted once; reached by two @import it is UXD_THEME_MARKER', async (t) => {
  const dir = tmpProject(t, {
    '_theme.uxdsl': '@uxdsl theme;\n',
    '_a.uxdsl': "@use './theme';\n.a { color: palette(primary.main); }\n",
    '_b.uxdsl': "@use './theme';\n.b { color: palette(primary.main); }\n",
    'used.uxdsl': "@use './a';\n@use './b';\n",
    'imported.uxdsl': "@import './theme';\n@import './theme';\n.c { color: red; }\n",
  });
  const used = await compile({ entry: path.join(dir, 'used.uxdsl') }, { theme: {}, includeTheme: false });
  assert.equal(used.themeEmitted, true);
  const once = await compile({ source: '@uxdsl theme;\n', from: 'once.uxdsl' }, { theme: {}, includeTheme: false });
  assert.ok(definitions(once.css) > 0, 'control: one theme defines the token');
  assert.equal(definitions(used.css), definitions(once.css), 'Sass loads a @use module once, so the theme is emitted once');
  assert.equal(rootBlocks(used.css), rootBlocks(once.css));
  await assert.rejects(
    compile({ entry: path.join(dir, 'imported.uxdsl') }, { theme: {}, includeTheme: false }),
    /UXD_THEME_MARKER: .*appears twice/,
    'an @import copies the partial each time, and a second marker is an error',
  );
});

test('MIG-B9-20: a stylesheet that is only `@uxdsl theme;` compiles to exactly generateThemeCss, with or without a Google Fonts import', () => {
  for (const theme of [{}, { fonts: { google: [] } }, { fonts: { google: ['Inter:wght@400;700', 'Playfair Display'] } }]) {
    const generated = generateThemeCss(theme);
    assert.equal(run('@uxdsl theme;', { includeTheme: false, theme }), generated, JSON.stringify(theme));
  }
  // A marker glued onto the rule before it still starts the theme on a line of its own.
  const glued = run('.a { color: red; }@uxdsl theme;', { includeTheme: false, theme: { fonts: { google: [] } } });
  assert.ok(glued.startsWith('.a { color: red; }\n:root {'), glued.slice(0, 40));
});
