// "Name a theme" (src/lib/generated-theme.js): what the site does with a language model's
// answer before applying it. The fixtures are answers the model really gave, as it wrote them
// (scripts/fixtures/generated-themes): applied as written they collapsed the layout, were
// refused by the validator or left text unreadable, which the negative controls below pin.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deepMergeTheme, resolveTheme, validateTheme, checkThemeContrast } = require('uxdsl/theme');
const { parseLiteralColor, relativeLuminance } = require('uxdsl/engine');
const exceptions = require('uxdsl/theme/base.contrast-exceptions.json');
const { baseTheme } = require('../themes');
const { sanitizeGeneratedTheme, FONTS, FONT_NAMES, FONT_CATALOG } = require('../src/lib/generated-theme.js');
const { checkPatch } = require('../src/lib/theme-patch.js');

const DIR = path.join(__dirname, 'fixtures', 'generated-themes');
const ANSWERS = Object.fromEntries(fs.readdirSync(DIR).sort().map((file) => [
  path.basename(file, '.json'),
  JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')),
]));
const FAMILIES = ['primary', 'secondary', 'tertiary', 'success', 'info', 'warning', 'error', 'neutral', 'surface', 'light', 'dark'];
const VARIANTS = ['main', 'light', 'dark', 'contrast'];
const ACCENTS = ['primary', 'secondary', 'tertiary', 'success', 'info', 'warning', 'error', 'neutral'];

const effective = (theme) => deepMergeTheme(baseTheme, theme);
const contrastFailures = (theme) => checkThemeContrast(resolveTheme(theme), { exceptions }).failures;
const luminanceOf = (hex) => relativeLuminance(parseLiteralColor(hex));
const made = (answer, options) => {
  const result = sanitizeGeneratedTheme(answer, options);
  assert.ok(result.ok, result.reason);
  return result;
};

test('the fixtures are the five answers', () => {
  assert.deepEqual(Object.keys(ANSWERS), ['forest', 'midnight', 'ocean', 'ocean2', 'sunset']);
});

test('negative control: applied as written, the answers break the site', () => {
  // Every one replaces the Spacing scale the layout is drawn for.
  for (const [name, answer] of Object.entries(ANSWERS)) {
    assert.notDeepEqual(effective(answer).spacing, baseTheme.spacing, name);
  }
  // Some name Spacing keys that do not exist.
  assert.equal(checkPatch(baseTheme, ANSWERS.ocean).ok, false);
  // And the colors are unreadable in places: a dark page in light mode, pale accents as text.
  const { spacing: _spacing, typography_details: _typography, breakpoints: _breakpoints, ...sunset } = ANSWERS.sunset;
  assert.ok(contrastFailures(effective(sunset)).length > 100);
  const { spacing: _s, typography_details: _t, breakpoints: _b, ...midnight } = ANSWERS.midnight;
  assert.ok(contrastFailures(effective(midnight)).length > 100);
});

for (const [name, answer] of Object.entries(ANSWERS)) {
  test(`${name}: the override changes values only and keeps the site's layout`, () => {
    const { theme } = made(answer);
    assert.deepEqual(Object.keys(theme).filter((key) => !['fonts', 'typography_details', 'palette', 'modes'].includes(key)), []);
    assert.deepEqual(Object.keys(theme.modes), ['dark']);
    assert.deepEqual(Object.keys(theme.modes.dark), ['palette']);

    const checked = checkPatch(baseTheme, theme);
    assert.ok(checked.ok, checked.message);
    const merged = effective(theme);
    assert.deepEqual(validateTheme(merged).errors, []);
    for (const family of ['spacing', 'densities', 'breakpoints', 'radii', 'borders', 'shadows', 'surfaces', 'buttons', 'inputs', 'colors']) {
      assert.deepEqual(merged[family], baseTheme[family], family);
    }
    // The type scale is the site's: a role takes a family, a weight and a letter spacing.
    for (const [role, fields] of Object.entries(theme.typography_details || {})) {
      assert.ok(role !== 'default' && role in baseTheme.typography_details, role);
      assert.deepEqual(Object.keys(fields).filter((field) => !['fontFamily', 'fontWeight', 'letterSpacing'].includes(field)), [], role);
      assert.equal(merged.typography_details[role].fontSize, baseTheme.typography_details[role].fontSize, role);
      assert.equal(merged.typography_details[role].lineHeight, baseTheme.typography_details[role].lineHeight, role);
    }
  });

  test(`${name}: every pair the roles draw is readable, in both modes`, () => {
    const { theme } = made(answer);
    assert.deepEqual(contrastFailures(effective(theme)).map((pair) => JSON.stringify(pair)), []);
    for (const palette of [theme.palette, theme.modes.dark.palette]) {
      assert.deepEqual(Object.keys(palette), FAMILIES);
      for (const family of FAMILIES) {
        assert.deepEqual(Object.keys(palette[family]), VARIANTS);
        for (const variant of VARIANTS) assert.match(palette[family][variant], /^#[0-9a-f]{6}$/);
      }
    }
    // An accent reads as text on the page and on a header or a card, which are `surface.light`.
    for (const palette of [theme.palette, theme.modes.dark.palette]) {
      for (const family of ACCENTS) {
        for (const variant of ['main', 'dark']) {
          for (const canvas of ['main', 'light']) {
            const [a, b] = [luminanceOf(palette[family][variant]), luminanceOf(palette.surface[canvas])];
            const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            assert.ok(ratio >= 4.5, `${family}.${variant} ${palette[family][variant]} on surface.${canvas} ${palette.surface[canvas]}: ${ratio.toFixed(2)}`);
          }
        }
      }
    }
    // Light mode is light and dark mode dark, whatever the theme is called.
    assert.ok(luminanceOf(theme.palette.surface.main) >= 0.8, theme.palette.surface.main);
    assert.ok(luminanceOf(theme.modes.dark.palette.surface.main) <= 0.015, theme.modes.dark.palette.surface.main);
  });

  test(`${name}: the fonts exist, with weights they have`, () => {
    const { theme } = made(answer);
    assert.ok(theme.fonts.google.length >= 1 && theme.fonts.google.length <= 3);
    const imported = {};
    for (const entry of theme.fonts.google) {
      const [family, weights] = entry.split(':wght@');
      assert.ok(FONT_NAMES.includes(family), entry);
      imported[family] = weights.split(';').map(Number);
      for (const weight of imported[family]) assert.ok(FONTS[family][1].includes(weight), entry);
    }
    // A family a role or the theme names is one that is imported, in the weight the role asks for.
    const ui = theme.fonts.families.ui.split(',')[0].replace(/'/g, '');
    assert.ok(imported[ui], theme.fonts.families.ui);
    for (const [role, fields] of Object.entries(theme.typography_details || {})) {
      const family = fields.fontFamily ? fields.fontFamily.split(',')[0].replace(/'/g, '') : ui;
      if (fields.fontFamily) assert.ok(imported[family], `${role}: ${fields.fontFamily}`);
      if (fields.fontWeight && !['code', 'pre'].includes(role)) assert.ok(imported[family].includes(Number(fields.fontWeight)), `${role}: ${family} ${fields.fontWeight}`);
    }
  });
}

test('a repair moves lightness and keeps the color: Sunset stays orange, Forest green', () => {
  const hue = (hex) => {
    const { r, g, b } = parseLiteralColor(hex);
    const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
    const raw = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    return (raw * 60 + 360) % 360;
  };
  for (const name of ['sunset', 'forest', 'ocean']) {
    const before = ANSWERS[name].palette.primary.main;
    const after = made(ANSWERS[name]).theme.palette.primary.main;
    const turned = Math.abs(hue(before) - hue(after));
    assert.ok(Math.min(turned, 360 - turned) < 12, `${name}: ${before} -> ${after}`);
  }
  // A color that was already readable is not touched.
  assert.equal(made(ANSWERS.midnight).theme.palette.primary.main, ANSWERS.midnight.palette.primary.main.toLowerCase());
});

test('what the model leaves out stays the site\'s; a family it colored in light mode follows in dark', () => {
  const { theme } = made({ palette: { primary: { main: '#0b6e4f' } } });
  assert.equal(theme.fonts, undefined);
  assert.equal(theme.typography_details, undefined);
  assert.equal(theme.palette.primary.main, '#0b6e4f');
  // The same green, lightened until it reads on the dark page.
  const dark = parseLiteralColor(theme.modes.dark.palette.primary.main);
  assert.ok(dark.g > dark.r && dark.g > dark.b, theme.modes.dark.palette.primary.main);
  assert.deepEqual(contrastFailures(effective(theme)), []);
});

test('random palettes come out readable', () => {
  let seed = 20261127;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const hex = () => `#${[0, 0, 0].map(() => Math.floor(random() * 256).toString(16).padStart(2, '0')).join('')}`;
  const palette = (keep) => Object.fromEntries(FAMILIES.filter(() => random() < keep).map((family) => [
    family,
    Object.fromEntries(VARIANTS.filter(() => random() < keep).map((variant) => [variant, hex()])),
  ]));
  for (let index = 0; index < 12; index += 1) {
    const keep = [1, 0.7, 0.4][index % 3];
    const answer = { palette: palette(keep), modes: { dark: { palette: palette(keep) } } };
    const result = sanitizeGeneratedTheme(answer);
    if (!result.ok) continue; // nothing survived the dice
    assert.deepEqual(contrastFailures(effective(result.theme)).map((pair) => JSON.stringify(pair)), [], JSON.stringify(answer));
  }
});

test('an answer with nothing to use is said to be unusable', () => {
  for (const answer of ['', 'Sure! Here is your theme.', '[]', 'null', '{}', '{"name":"Empty","palette":{}}', '{"palette":{"primary":{"main":"blue"}}}', '{"palette":"#123456"}', 42, null, undefined]) {
    const result = sanitizeGeneratedTheme(answer);
    assert.equal(result.ok, false, String(answer));
    assert.equal(typeof result.reason, 'string');
  }
  // A code fence around the object is read through.
  assert.ok(sanitizeGeneratedTheme('```json\n{"palette":{"primary":{"main":"#0b6e4f"}}}\n```').ok);
});

test('fonts: only families that exist, in weights they have, three at most', () => {
  const answer = (fonts, typography_details) => ({ palette: { primary: { main: '#0b6e4f' } }, fonts, typography_details });

  // A family that is not on the list is not imported, and no role is left pointing at it.
  let { theme } = made(answer({ google: ['Comic Sans MS:wght@400'], families: { ui: 'Comic Sans MS, cursive' } }, { h1: { fontFamily: 'Papyrus, fantasy', fontWeight: '700' } }));
  assert.equal(theme.fonts, undefined);
  assert.deepEqual(theme.typography_details, { h1: { fontWeight: '700' } });

  // A renamed family, and a weight it does not have.
  ({ theme } = made(answer({ families: { ui: 'Lato, sans-serif' } }, { h1: { fontFamily: '"Fredoka One", cursive', fontWeight: '900' }, h2: { fontFamily: 'Pacifico', fontWeight: '700' } })));
  assert.deepEqual(theme.fonts.google, ['Lato:wght@400;700', 'Fredoka:wght@700', 'Pacifico:wght@400']);
  assert.deepEqual(theme.typography_details, { h1: { fontFamily: 'Fredoka, sans-serif', fontWeight: '700' }, h2: { fontFamily: 'Pacifico, cursive', fontWeight: '400' } });
  assert.equal(theme.fonts.families.ui, 'Lato, sans-serif');

  // A name with a space is quoted; the fourth family is not imported and its role follows the text font.
  ({ theme } = made(answer(
    { families: { ui: 'Open Sans', code: 'Space Mono, monospace' } },
    { h1: { fontFamily: 'Playfair Display, serif' }, h2: { fontFamily: 'Lobster' }, h3: { fontFamily: 'Bangers' }, code: { fontFamily: 'Lobster', fontWeight: '700' } },
  )));
  // The text font and the code font have their place before a heading font does: a family
  // the theme names is one it imports.
  assert.deepEqual(theme.fonts.google, ['Open Sans:wght@400;500;600;700', 'Space Mono:wght@400;700', 'Playfair Display:wght@400']);
  assert.equal(theme.fonts.families.ui, "'Open Sans', sans-serif");
  assert.equal(theme.fonts.families.code, "'Space Mono', monospace");
  assert.equal(theme.typography_details.h1.fontFamily, "'Playfair Display', serif");
  assert.equal(theme.typography_details.h2, undefined);
  assert.equal(theme.typography_details.h3, undefined);
  // `code` keeps the code font.
  assert.equal(theme.typography_details.code.fontFamily, undefined);
  assert.ok(checkPatch(baseTheme, theme).ok);
});

test('typography: nothing that would change the layout or what a role emits', () => {
  const { theme } = made({
    palette: { primary: { main: '#0b6e4f' } },
    typography_details: {
      default: { fontWeight: '300' },
      hero: { fontWeight: '900' },
      h1: { fontSize: 'xs(space(3.5)) md(9rem)', lineHeight: '0.8', textTransform: 'uppercase', fontStyle: 'italic', textDecoration: 'underline', marginBlockEnd: '4rem', fontWeight: 800, letterSpacing: '-0.03em' },
      h2: { fontWeight: 'bold', letterSpacing: '2em' },
      h3: { letterSpacing: '0' },
      p: 'bold',
    },
  });
  assert.deepEqual(theme.typography_details, { h1: { fontWeight: '800', letterSpacing: '-0.03em' }, h3: { letterSpacing: 'normal' } });
});

test('colors: only opaque colors the engine reads are taken', () => {
  const { theme } = made({
    palette: {
      primary: { main: 'rgb(11, 110, 79)', dark: '#0b6e4f; } body { display: none', light: 'rgba(0,0,0,0.2)', contrast: 'var(--x)' },
      surface: 'white',
      secondary: { main: 12 },
    },
  });
  assert.equal(theme.palette.primary.main, '#0b6e4f');
  for (const palette of [theme.palette, theme.modes.dark.palette]) {
    for (const family of FAMILIES) for (const variant of VARIANTS) assert.match(palette[family][variant], /^#[0-9a-f]{6}$/);
  }
  assert.deepEqual(contrastFailures(effective(theme)), []);
});

test('the name is a short line of text', () => {
  const colors = { palette: { primary: { main: '#0b6e4f' } } };
  assert.equal(made({ ...colors, name: '  Verdant\n\tCanopy  ' }).name, 'Verdant Canopy');
  assert.equal(made({ ...colors, name: '<b>Bold</b>' }).name, 'b Bold /b');
  assert.equal(made({ ...colors, name: 'x'.repeat(200) }).name.length, 48);
  assert.equal(made({ ...colors, name: 7 }, { fallbackName: 'ocean' }).name, 'ocean');
  assert.equal(made(colors).name, 'Custom theme');
});

test('the model is told of every family, with its weights', () => {
  assert.equal(FONT_CATALOG.length, FONT_NAMES.length);
  assert.ok(FONT_CATALOG.includes('Lato (sans-serif; 100, 300, 400, 700, 900)'));
  assert.ok(!FONT_NAMES.includes('Fredoka One'));
});
