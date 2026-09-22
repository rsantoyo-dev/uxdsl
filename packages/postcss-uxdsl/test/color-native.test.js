'use strict';

// MIG-B6-14 (FEAT-008): `color()` is the one UXDSL token function name that
// collides with a real native CSS function — relative color syntax
// (`color(from red srgb r g b / 0.5)`) and an explicit color space
// (`color(display-p3 1 0 0)`). Before this story, presetValueToCss checked
// the first argument against a fixed list of known color-space keywords and
// threw UXD_TOKEN_KEY for anything else, including valid native forms that
// list didn't happen to cover. It's now a shape check instead: a token key
// never contains a space or a slash, so anything that does passes through
// untouched, and this needs no list of color spaces to keep up to date.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const postcss = require('postcss');
const plugin = require('../dist');

const file = path.join(process.cwd(), 'src', 'panel.uxdsl');
const theme = { colors: { primary: '#123456' } };

async function compile(css, opts = {}) {
  return postcss([plugin({ includeTheme: false, theme, ...opts })]).process(css, { from: file });
}
async function compileFail(css) {
  return compile(css).then(() => null, caught => caught);
}

for (const nativeColor of [
  'color(from red srgb r g b / 0.5)',
  'color(display-p3 1 0 0)',
  'color(srgb-linear 0.5 0.5 0.5)',
]) {
  test(`MIG-B6-14: native color() "${nativeColor}" passes through unchanged`, async () => {
    const result = await compile(`.a { color: ${nativeColor}; }`);
    assert.match(result.css, new RegExp(nativeColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('MIG-B6-14: native color() referencing an external custom property is still reference-checked (passthrough is not a validation bypass)', async () => {
  const missing = await compileFail('.a { color: color(from var(--x) hsl h s l); }');
  assert.ok(missing, 'compilation fails: --x is not declared anywhere');
  assert.match(missing.message, /UXD_REFERENCE_MISSING: color -> --x/);

  const declared = await compile('.a { color: color(from var(--x) hsl h s l); }', { references: { externalTokens: ['--x'] } });
  assert.match(declared.css, /color\(from var\(--x\) hsl h s l\)/);
});

test('MIG-B6-14 (positive control): a token color() still resolves to a var() reference', async () => {
  const result = await compile('.a { color: color(primary); }');
  assert.match(result.css, /var\(--uxdsl__color__primary\)/);
  assert.doesNotMatch(result.css, /color\(primary\)/);
});

test('MIG-B6-14 (positive control): a token color() with alpha still composes color-mix()', async () => {
  const result = await compile('.a { color: color(primary, 0.5); }');
  assert.match(result.css, /color-mix\(in srgb, var\(--uxdsl__color__primary\) 50%, transparent\)/);
});

test('MIG-B6-14: a token color() with an invalid alpha still fails — the shape check is not a bypass of the token validator', async () => {
  const error = await compileFail('.a { color: color(primary, banana); }');
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /UXD_TOKEN_ALPHA: /);
});

test('MIG-B6-14: any color() first argument containing a space is treated as native CSS, by design — not just the fixed keyword list this replaces', async () => {
  // The story explicitly replaces a fixed list of known color-space
  // keywords with this shape check: "any other form is left untouched",
  // not "any other RECOGNIZED native form" — a genuinely malformed value
  // here is still native CSS's problem to reject at paint/parse time, not
  // this plugin's.
  const result = await compile('.a { color: color(not a token); }');
  assert.match(result.css, /color\(not a token\)/);
});
