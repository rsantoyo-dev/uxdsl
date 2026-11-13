'use strict';

// `@uxdsl theme;` emits the theme where it is written, and only there: a
// stylesheet without it carries only its own rules. So a PostCSS-only setup
// (Next.js with `'uxdsl/postcss': {}` in postcss.config.js) needs no CLI: the
// one global stylesheet carries the marker, every CSS Module just uses tokens
// and stays free of `:root`.

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

test('DE-9: `@uxdsl theme;` emits the theme at the marker and nowhere else', () => {
  const css = run('.before { color: red; }\n@uxdsl theme;\n.after { color: palette(primary.main); }\n');
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
  const css = run('.a { color: red; }\n@uxdsl theme;\n', { theme });
  const generated = generateThemeCss(theme);
  const imports = generated.split('\n').filter((line) => line.startsWith('@import'));
  const blocks = generated.split('\n').filter((line) => !line.startsWith('@import')).join('\n');
  assert.ok(imports.length > 0, 'control: the theme has a Google Fonts @import');
  assert.ok(css.startsWith(imports.join('\n')), 'the theme\'s @import leads the stylesheet, as CSS requires');
  assert.ok(css.includes(blocks), 'the blocks are the generated theme, unchanged');
});

test('DE-9: without the marker a stylesheet emits no :root (a CSS Module)', () => {
  const css = run('.card { padding: density(2); color: palette(primary.main); }\n');
  assert.equal(rootBlocks(css), 0);
  assert.match(css, /var\(--uxdsl__density__2\)/);
});

test('DE-9: the marker decides where the one copy goes', () => {
  const css = run('.first { color: red; }\n@uxdsl theme;\n');
  const marked = css.indexOf(':root');
  assert.ok(css.indexOf('.first') < marked, 'not hoisted above the rules written before the marker');
  const leading = run('@uxdsl theme;\n.first { color: red; }\n');
  assert.ok(leading.indexOf(':root') < leading.indexOf('.first'), 'control: a marker written first puts the theme first');
  assert.equal(css.split('--uxdsl__palette__primary-main:').length - 1, leading.split('--uxdsl__palette__primary-main:').length - 1, 'emitted once, wherever the marker is');
});

test('DE-9: a misplaced, repeated or misspelled marker is UXD_THEME_MARKER, with its position', () => {
  const nested = failure(() => run('.a { @uxdsl theme; }\n'));
  assert.match(nested.message, /UXD_THEME_MARKER: .*top level/);
  assert.equal(nested.line, 1);
  const media = failure(() => run('@media (min-width: 1px) { @uxdsl theme; }\n'));
  assert.match(media.message, /UXD_THEME_MARKER/);
  const twice = failure(() => run('@uxdsl theme;\n.a { color: red; }\n@uxdsl theme;\n'));
  assert.match(twice.message, /UXD_THEME_MARKER: .*twice/);
  assert.equal(twice.line, 3);
  const typo = failure(() => run('@uxdsl them;\n'));
  assert.match(typo.message, /UXD_THEME_MARKER: @uxdsl them is not a UXDSL at-rule.*`@uxdsl theme;`/);
  const block = failure(() => run('@uxdsl theme { }\n'));
  assert.match(block.message, /UXD_THEME_MARKER/);
});

test('DE-9: the marker works through compile() (the pipeline the CLI and the adapters run)', async () => {
  const { css } = await compile({ source: '$gap: 1rem;\n@uxdsl theme;\n.a { gap: $gap; color: palette(primary.main); }\n', from: 'globals.uxdsl' }, { theme: {} });
  assert.ok(rootBlocks(css) > 0);
  assert.doesNotMatch(css, /@uxdsl/);
});

test('DE-9: the emitted theme is reference-checked like any other: a dangling theme value fails the marked stylesheet', () => {
  const theme = { palette: { primary: { main: 'color(nope.500)' } } };
  const error = failure(() => run('@uxdsl theme;\n.a { color: red; }\n', { theme }));
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

  const unmarked = await compile({ source: '.card { padding: density(4); }\n', from: 'card.uxdsl' }, { theme: {} });
  assert.equal(unmarked.themeEmitted, false, 'no marker: nothing emitted, and compile() says so');
  assert.equal(rootBlocks(unmarked.css), 0, 'control: the unmarked output defines no :root');

  const dir = tmpProject(t, {
    '_theme.uxdsl': '@uxdsl theme;\n',
    'global.uxdsl': "@use './theme';\n.card { padding: density(4); }\n",
  });
  const used = await compile({ entry: path.join(dir, 'global.uxdsl') }, { theme: {} });
  assert.equal(used.themeEmitted, true, 'a marker reached through @use emits the theme');
  assert.ok(rootBlocks(used.css) > 0);

  const alone = await postcss([plugin({ discoverTheme: false })]).process('@uxdsl theme;\n.a { color: red; }\n', { from: 'a.css' });
  assert.deepEqual(themeMessages(alone), [{ type: 'uxdsl-theme', plugin: 'uxdsl', emitted: true }], 'the plugin alone pushes one message per compilation');
  const aloneUnmarked = await postcss([plugin({ discoverTheme: false })]).process('.a { color: red; }\n', { from: 'a.css' });
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
  const used = await compile({ entry: path.join(dir, 'used.uxdsl') }, { theme: {} });
  assert.equal(used.themeEmitted, true);
  const once = await compile({ source: '@uxdsl theme;\n', from: 'once.uxdsl' }, { theme: {} });
  assert.ok(definitions(once.css) > 0, 'control: one theme defines the token');
  assert.equal(definitions(used.css), definitions(once.css), 'Sass loads a @use module once, so the theme is emitted once');
  assert.equal(rootBlocks(used.css), rootBlocks(once.css));
  await assert.rejects(
    compile({ entry: path.join(dir, 'imported.uxdsl') }, { theme: {} }),
    /UXD_THEME_MARKER: .*appears twice/,
    'an @import copies the partial each time, and a second marker is an error',
  );
});

test('MIG-B9-20: a stylesheet that is only `@uxdsl theme;` compiles to exactly generateThemeCss, with or without a Google Fonts import', () => {
  for (const theme of [{}, { fonts: { google: [] } }, { fonts: { google: ['Inter:wght@400;700', 'Playfair Display'] } }]) {
    const generated = generateThemeCss(theme);
    assert.equal(run('@uxdsl theme;', { theme }), generated, JSON.stringify(theme));
  }
  // A marker glued onto the rule before it still starts the theme on a line of its own.
  const glued = run('.a { color: red; }@uxdsl theme;', { theme: { fonts: { google: [] } } });
  assert.ok(glued.startsWith('.a { color: red; }\n:root {'), glued.slice(0, 40));
});

// The marker is the only switch: a compilation without it emits no theme,
// whatever it is passed, and `includeTheme` is a removed option.

const REMOVED_INCLUDE_THEME = 'UXD_OPTION_REMOVED: the "includeTheme" option was removed and is ignored; write @uxdsl theme; in the stylesheet that defines the tokens.';
const optionWarnings = (warnings) => warnings.map((warning) => warning.text).filter((text) => text.startsWith('UXD_OPTION_REMOVED'));

test('MIG-B9-20: without the marker a compilation emits no :root; with it the theme is at the marker, byte-identical to generateThemeCss', async () => {
  const bare = await compile({ source: '.card{padding:density(4)}' });
  assert.equal(bare.css, '.card {\n  padding: var(--uxdsl__density__4);\n}', 'only the component\'s own rule');
  assert.equal(bare.css.length, 46);
  assert.equal(rootBlocks(bare.css), 0);
  assert.equal(bare.themeEmitted, false);
  assert.deepEqual(bare.warnings, []);
  assert.equal(rootBlocks(run('.card { padding: density(4); }\n')), 0, 'the plugin alone emits no :root either');

  // Negative control: the same source with the marker carries the theme, so the
  // assertions above can fail.
  const marked = await compile({ source: '@uxdsl theme;\n.card{padding:density(4)}' }, { theme: {} });
  assert.equal(marked.themeEmitted, true);
  assert.ok(rootBlocks(marked.css) > 0);
  assert.notEqual(marked.css.length, bare.css.length);
  assert.equal(marked.css, `${generateThemeCss({})}\n${bare.css}`, 'the theme at the marker is generateThemeCss, then the rules after it');
});

const FULL_SPACING = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, `${(i + 1) * 4}px`]));
const componentTheme = {
  breakpoints: { xs: 0, md: 800 },
  palette: {
    primary: { main: '#123456', dark: '#000', contrast: '#fff' },
    surface: { main: '#fff', dark: '#eee', contrast: '#000' },
    neutral: { main: '#999', dark: '#333' },
    error: { main: '#f00' },
  },
  spacing: { ...FULL_SPACING, 1: '4px', 2: '8px' },
  typography_details: { h1: { fontSize: '2rem' } },
  fonts: { families: { ui: 'Inter' }, google: ['Inter:wght@400;700'] },
};
const processed = (source, options = {}) => postcss([plugin({ discoverTheme: false, ...options })]).process(source, { from: undefined });

test('MIG-B9-20: without the marker every :root definition is skipped, density and typography included, and references resolve against the effective theme', async () => {
  const source = '.card { @ds-surface(contained); @ds-typo(h1); padding: space(1); border-radius: radius(2); box-shadow: shadow(1); border: border(1); }';
  const result = await processed(source, { theme: componentTheme });
  assert.equal(rootBlocks(result.css), 0, result.css);
  assert.ok(!result.css.includes('@import'), 'no theme, so no Google Fonts @import either');
  assert.match(result.css, /padding: var\(--uxdsl__surface__contained-padding\)/);
  assert.match(result.css, /padding: var\(--uxdsl__space__1\)/);
  assert.match(result.css, /border-radius: var\(--uxdsl__radius__2\)/);
  assert.match(result.css, /box-shadow: var\(--uxdsl__shadow__1\)/);
  assert.match(result.css, /border: var\(--uxdsl__border__1\)/);
  assert.match(result.css, /font-size: var\(--uxdsl__typography__h1-font-size\)/);
});

test('MIG-B9-20: with the marker the stylesheet carries the theme: :root, its @import and every definition', async () => {
  const result = await processed('@uxdsl theme;\n.card { @ds-surface(contained); }', { theme: componentTheme });
  assert.ok(rootBlocks(result.css) > 0);
  assert.ok(result.css.includes('--uxdsl__surface__contained-padding:'));
  assert.ok(result.css.includes('@import'));
});

test('MIG-B9-20: a theme stylesheet (the marker) and a component stylesheet (none) compose without duplicate definitions', async () => {
  const themeSheet = await processed('@uxdsl theme;\n', { theme: componentTheme });
  const componentSheet = await processed('.card { @ds-surface(contained); }', { theme: componentTheme });
  const soloRootBlocks = rootBlocks(themeSheet.css);
  assert.ok(soloRootBlocks > 1, 'control: density alone emits a base :root plus one per non-base breakpoint');
  assert.equal(rootBlocks(`${themeSheet.css}\n${componentSheet.css}`), soloRootBlocks, 'the component adds no :root of its own');
  assert.ok(componentSheet.css.includes('var(--uxdsl__surface__contained-padding)'));
  assert.ok(!componentSheet.css.includes('--uxdsl__surface__contained-padding:'));
});

test('MIG-B9-20: without the marker references are still validated: unknown tokens fail', async () => {
  await assert.rejects(processed('.x { @ds-surface(missing); }', { theme: componentTheme }));
  await assert.rejects(processed('.x { color: shadow(missing); }', { theme: componentTheme }));
  await assert.rejects(processed('.x { @ds-button(contained); }', { theme: { surfaces: { contained: null } } }));
});

test('MIG-B9-20: consecutive compilations with and without the marker share no state', async () => {
  const first = await processed('.a { @ds-surface(contained); }', { theme: componentTheme });
  const second = await processed('@uxdsl theme;\n.b { @ds-surface(contained); }', { theme: componentTheme });
  const third = await processed('.c { @ds-surface(contained); }', { theme: componentTheme });
  assert.equal(rootBlocks(first.css), 0);
  assert.ok(rootBlocks(second.css) > 0);
  assert.equal(rootBlocks(third.css), 0);
  assert.equal(first.css.replace('.a', '.x'), third.css.replace('.c', '.x'));
});

test('MIG-B9-20: includeTheme passed to the plugin or compile() warns UXD_OPTION_REMOVED and is ignored', async () => {
  // The plugin: once per compilation, and the output is the output without it.
  for (const source of ['.a { color: palette(primary.main); }\n', '@uxdsl theme;\n.a { color: palette(primary.main); }\n']) {
    const without = await processed(source);
    assert.deepEqual(optionWarnings(without.warnings()), [], 'control: no option, no warning');
    for (const includeTheme of [false, true]) {
      const passed = await processed(source, { includeTheme });
      assert.deepEqual(optionWarnings(passed.warnings()), [REMOVED_INCLUDE_THEME]);
      assert.equal(passed.css, without.css, `includeTheme: ${includeTheme} changes nothing (${JSON.stringify(source)})`);
    }
  }
  assert.equal(rootBlocks((await processed('.a { color: red; }\n', { includeTheme: true })).css), 0, 'includeTheme: true without the marker emits no :root');

  // compile(): once per call, after Dart Sass's warnings.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-removed-include-theme-'));
  try {
    fs.writeFileSync(path.join(dir, '_part.uxdsl'), '.p { color: red; }\n');
    fs.writeFileSync(path.join(dir, 'main.uxdsl'), "@import './part';\n.a { color: palette(primary.main); }\n");
    const entry = path.join(dir, 'main.uxdsl');
    const without = await compile({ entry }, { theme: {} });
    const passed = await compile({ entry }, { theme: {}, includeTheme: false });
    assert.equal(passed.css, without.css);
    assert.equal(passed.themeEmitted, false);
    assert.deepEqual(optionWarnings(without.warnings), [], 'control: no option, no warning');
    assert.deepEqual(passed.warnings.map((warning) => warning.text), [...without.warnings.map((warning) => warning.text), REMOVED_INCLUDE_THEME], 'Sass\'s warnings first, then the plugin\'s one');
    assert.ok(without.warnings.some((warning) => warning.text.startsWith('UXD_SASS_WARNING: [import]')), 'control: Dart Sass did warn');
    const markedWith = await compile({ source: '@uxdsl theme;\n.a { color: red; }\n' }, { theme: {}, includeTheme: false });
    const markedWithout = await compile({ source: '@uxdsl theme;\n.a { color: red; }\n' }, { theme: {} });
    assert.equal(markedWith.css, markedWithout.css, 'with the marker too, the option changes nothing');
    assert.equal(markedWith.themeEmitted, true);
    assert.deepEqual(optionWarnings(markedWith.warnings), [REMOVED_INCLUDE_THEME]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The four options removed before `includeTheme`, as every host words them.
const OLDER_REMOVED = [
  'UXD_OPTION_REMOVED: the "breakpoints" option was removed and is ignored; breakpoints are configured in the theme (`theme.breakpoints`).',
  'UXD_OPTION_REMOVED: the "themeVar" option was removed and is ignored; palette() always compiles to var(--uxdsl__palette__<key>).',
  'UXD_OPTION_REMOVED: the "spaceVar" option was removed and is ignored; space() always compiles to var(--uxdsl__space__<key>).',
  'UXD_OPTION_REMOVED: the "colorVar" option was removed and is ignored; color() always compiles to var(--uxdsl__color__<key>).',
];
const OLDER_OPTIONS = { breakpoints: { xs: 0, md: 600 }, themeVar: '--x', spaceVar: '--y', colorVar: '--z' };

test('MIG-B9-20: compile() warns UXD_OPTION_REMOVED for breakpoints, themeVar, spaceVar and colorVar too, and ignores them', async () => {
  const source = '.a { padding: xs(1rem) md(2rem); color: palette(primary.main); margin: space(2); border-color: color(gray.300); }\n';
  const without = await compile({ source }, { theme: {} });
  assert.deepEqual(optionWarnings(without.warnings), [], 'control: no option, no warning');
  const passed = await compile({ source }, { theme: {}, ...OLDER_OPTIONS });
  assert.deepEqual(optionWarnings(passed.warnings), OLDER_REMOVED);
  assert.equal(passed.css, without.css, 'the options change nothing: the theme\'s 768px threshold stands');
  assert.match(passed.css, /@media \(min-width: 768px\)/);
  for (const [name, value] of Object.entries(OLDER_OPTIONS)) {
    const one = await compile({ source }, { theme: {}, [name]: value });
    assert.deepEqual(optionWarnings(one.warnings), OLDER_REMOVED.filter((text) => text.includes(`"${name}"`)), name);
  }
});

test('MIG-B9-20: the PostCSS plugin alone cannot tell that no file emitted the theme and does not warn', async () => {
  const source = '.a { color: palette(primary.main); padding: density(2); }\n';
  const unmarked = await processed(source);
  assert.equal(rootBlocks(unmarked.css), 0);
  assert.deepEqual(unmarked.warnings().map((warning) => warning.text), [], 'one file, no end of build: no warning');
  assert.deepEqual(themeMessages(unmarked), [{ type: 'uxdsl-theme', plugin: 'uxdsl', emitted: false }]);
  const marked = await processed(`@uxdsl theme;\n${source}`);
  assert.deepEqual(themeMessages(marked), [{ type: 'uxdsl-theme', plugin: 'uxdsl', emitted: true }]);
  // Negative control: compile() reads that message, so it reports the marker.
  assert.equal((await compile({ source: `@uxdsl theme;\n${source}` }, { theme: {} })).themeEmitted, true);
  assert.equal((await compile({ source }, { theme: {} })).themeEmitted, false);
});
