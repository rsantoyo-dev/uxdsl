const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { encodeGoogleFontFamily, googleFontsImportUrls } = require('../dist/fonts');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateThemeCss } = require('../dist/ds-runtime');

const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });

// MIG-B6-29 (FEAT-008), phase 4/4 ("paso 9"): the one shared Google Fonts
// encoder both the PostCSS plugin (src/index.ts) and generateThemeCss
// (ds-runtime/theme-generator.ts) use, so they emit the same `@import` for
// the same theme. See fonts.ts's own header for the character-safety design.

test('encodeGoogleFontFamily preserves css2 syntax characters unescaped', () => {
  assert.equal(encodeGoogleFontFamily('Inter:wght@400;500;600;700'), 'Inter:wght@400;500;600;700');
  assert.equal(encodeGoogleFontFamily('Roboto Flex:opsz,wght@8..144,100..1000'), 'Roboto+Flex:opsz,wght@8..144,100..1000');
  assert.equal(encodeGoogleFontFamily('Nunito Sans:ital,wght@0,400;1,400'), 'Nunito+Sans:ital,wght@0,400;1,400');
});

test('encodeGoogleFontFamily turns a space into "+", not "%20" (this repo\'s own established convention)', () => {
  assert.equal(encodeGoogleFontFamily('Open Sans'), 'Open+Sans');
  assert.equal(encodeGoogleFontFamily('Playfair Display:wght@700'), 'Playfair+Display:wght@700');
});

test('encodeGoogleFontFamily percent-encodes a genuinely unsafe character instead of corrupting the URL', () => {
  // A family name is very unlikely to contain a quote or ampersand, but the
  // encoder must never let one through unescaped and break the query string.
  assert.equal(encodeGoogleFontFamily("O'Brien"), "O%27Brien");
  assert.equal(encodeGoogleFontFamily('A&B'), 'A%26B');
  assert.equal(encodeGoogleFontFamily("Weird'Name & Co"), "Weird%27Name+%26+Co");
});

test('a literal apostrophe in a family name would break out of the single-quoted url(\'...\') CSS string if left unescaped — this is checked by actually parsing the emitted CSS, not just inspecting the string', async () => {
  // encodeURIComponent alone leaves `'` unescaped (it is in its own
  // "unreserved" exception list), which is exactly wrong here: this URL is
  // embedded in a single-quoted CSS string by both callers. Found while
  // writing this suite (the first version of the encoder used
  // encodeURIComponent's exception list unmodified); confirmed to actually
  // corrupt the generated CSS before the fix — postcss.parse threw on the
  // early-closed string — and confirmed fixed here by parsing the real
  // output instead of trusting the encoded string alone.
  assert.doesNotMatch(encodeGoogleFontFamily("O'Brien"), /'/);
  const theme = { fonts: { google: ["O'Brien Sans"] } };
  const compiled = await compile('.x { color: red; }', { theme });
  assert.doesNotThrow(() => postcss.parse(compiled.css), 'the emitted CSS must remain syntactically valid');
  assert.match(compiled.css, /family=O%27Brien\+Sans/);
});

test('encodeGoogleFontFamily is a no-op on an already-safe string and handles the empty string', () => {
  assert.equal(encodeGoogleFontFamily(''), '');
  assert.equal(encodeGoogleFontFamily('Inter'), 'Inter');
});

test('googleFontsImportUrls: empty or missing list emits nothing', () => {
  assert.deepEqual(googleFontsImportUrls([]), []);
  assert.deepEqual(googleFontsImportUrls(undefined), []);
});

test('googleFontsImportUrls: several families, order preserved, each with &display=swap', () => {
  const urls = googleFontsImportUrls(['Inter:wght@400;700', 'Open Sans', 'Playfair Display:wght@700']);
  assert.deepEqual(urls, [
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
    'https://fonts.googleapis.com/css2?family=Open+Sans&display=swap',
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap',
  ]);
});

test('the PostCSS plugin and generateThemeCss emit byte-identical @import URLs for the same theme (paso 9\'s own acceptance)', async () => {
  const theme = { fonts: { google: ['Open Sans:wght@400;700', 'Playfair Display'] } };
  const extractUrls = (css) => [...css.matchAll(/@import url\('([^']+)'\)/g)].map((m) => m[1]);

  const compiled = await compile('.x { color: red; }', { theme });
  const pluginUrls = extractUrls(compiled.css);
  const runtimeUrls = extractUrls(generateThemeCss(theme));

  assert.deepEqual(pluginUrls, [
    'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap',
  ]);
  assert.deepEqual(pluginUrls, runtimeUrls, 'the plugin and generateThemeCss must agree on both the URLs and their order');
});

test('a space in the family name used to produce an invalid URL before this phase; now it does not, in either path', async () => {
  const theme = { fonts: { google: ['Open Sans:wght@400;700'] } };
  const compiled = await compile('.x { color: red; }', { theme });
  assert.doesNotMatch(compiled.css, /family=Open Sans/, 'a literal space in the emitted URL is invalid');
  assert.match(compiled.css, /family=Open\+Sans/);

  const runtimeCss = generateThemeCss(theme);
  assert.doesNotMatch(runtimeCss, /family=Open Sans/);
  assert.match(runtimeCss, /family=Open\+Sans/);
});

test('generateThemeCss emits nothing for an empty fonts.google, and its @import (when present) leads the stylesheet', () => {
  const withFonts = generateThemeCss({ fonts: { google: ['Inter:wght@400;700'] } });
  assert.ok(withFonts.trimStart().startsWith("@import url('https://fonts.googleapis.com/css2?family=Inter"), 'the @import must be the very first rule, as CSS requires');

  const withoutFonts = generateThemeCss({ fonts: { google: [] } });
  assert.doesNotMatch(withoutFonts, /@import/);
});

test('repeated compilation is idempotent: no duplicate or accumulating @import across calls (paso 9\'s own "repetición de compilación")', async () => {
  const theme = { fonts: { google: ['Inter:wght@400;700'] } };

  const runtimeFirst = generateThemeCss(theme);
  const runtimeSecond = generateThemeCss(theme);
  assert.equal(runtimeFirst, runtimeSecond);
  assert.equal((runtimeFirst.match(/@import/g) || []).length, 1);

  // Simulates a watcher recompiling the same source from scratch on every
  // rebuild — each call is independent, but must produce the identical,
  // single @import every time, not an accumulating or drifting one.
  const compiledFirst = await compile('.x { color: red; }', { theme });
  const compiledSecond = await compile('.x { color: red; }', { theme });
  assert.equal((compiledFirst.css.match(/@import/g) || []).length, 1);
  assert.equal(compiledFirst.css, compiledSecond.css);
});

test('fonts.ts stays browser-safe: no fs/path/config import, so ds-runtime consumers never pull in Node-only code', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/fonts.ts'), 'utf8');
  assert.doesNotMatch(source, /from ['"](?:fs|path|node:fs|node:path|\.\/config)['"]/);
  assert.doesNotMatch(source, /\bfetch\(/, 'this module only builds URL strings; it must never perform the request itself');
});

test('MIG-B6-28: the story\'s own example encodes as specified', () => {
  // `fonts.google: ['Open Sans:wght@400;700']` -> `family=Open+Sans:wght@400;700`:
  // the space becomes `+`, and neither the `:` nor the `;` separators are
  // percent-encoded, because Google's css2 endpoint uses them structurally.
  assert.deepEqual(
    googleFontsImportUrls(['Open Sans:wght@400;700']),
    ['https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap']);
});
