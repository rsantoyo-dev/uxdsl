'use strict';

// Stability phase 1 (audit 2026-09-29, L11/DE-4/DE-10): the plugin options
// `breakpoints` (in the three shapes it accepted), `themeVar`, `spaceVar` and
// `colorVar` are removed. `breakpoints` replaced the theme's map wholesale —
// `{ a: 0, b: 500 }` next to the base theme failed as `UXD_EDGE_BP: xs` — and
// was one of three places a threshold could come from. The CLI, `uxdsl-core`
// and the adapters forwarded it until their own phase lands, so a caller that
// still passes it is warned and the option is ignored: never a throw.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;

const SOURCE = '.a { padding: xs(1rem) md(2rem); color: palette(primary); margin: space(2); border-color: color(gray.300); }';
const run = (options) => postcss([plugin({ discoverTheme: false, includeTheme: false, ...options })]).process(SOURCE, { from: undefined });
const removedWarnings = (result) => result.warnings().map((w) => w.text).filter((text) => /^UXD_OPTION_REMOVED/.test(text));

test('removed options: no option, no warning — and the output is the reference for the cases below', async () => {
  const result = await run({});
  assert.deepEqual(removedWarnings(result), []);
  assert.match(result.css, /@media \(min-width: 768px\)/);
  assert.match(result.css, /color: var\(--uxdsl__palette__primary-main\)/);
  assert.match(result.css, /margin: var\(--uxdsl__space__2\)/);
  assert.match(result.css, /border-color: var\(--uxdsl__color__gray-300\)/);
});

for (const [shape, breakpoints] of [
  ['an object', { xs: 0, md: 900 }],
  ['an array of pairs', [['xs', 0], ['md', 900]]],
  ['an array of { name, min }', [{ name: 'xs', min: 0 }, { name: 'md', min: 900 }]],
  ['a map that would have dropped the base names (the audit\'s UXD_EDGE_BP repro)', { a: 0, b: 500 }],
]) {
  test(`removed options: breakpoints as ${shape} is ignored with a warning, not thrown`, async () => {
    const baseline = await run({});
    const result = await run({ breakpoints });
    assert.deepEqual(removedWarnings(result), ['UXD_OPTION_REMOVED: the "breakpoints" plugin option was removed and is ignored; breakpoints are configured in the theme (`theme.breakpoints`).']);
    assert.equal(result.css, baseline.css, 'the option changes nothing: the theme\'s 768px threshold stands');
    assert.doesNotMatch(result.css, /900px|500px/);
  });
}

test('removed options: the same holds with includeTheme: true — the theme compiles against its own map', async () => {
  const result = await run({ breakpoints: { a: 0, b: 500 }, includeTheme: true });
  assert.equal(removedWarnings(result).length, 1);
  assert.match(result.css, /@media \(min-width: 1280px\)/);
});

test('removed options: theme.breakpoints is the one source of a threshold', async () => {
  const result = await run({ theme: { breakpoints: { md: 900 } } });
  assert.deepEqual(removedWarnings(result), []);
  assert.match(result.css, /@media \(min-width: 900px\)/);
  assert.doesNotMatch(result.css, /768px/);
  // …and wins regardless of what the removed option says.
  const both = await run({ theme: { breakpoints: { md: 900 } }, breakpoints: { xs: 0, md: 600 } });
  assert.equal(both.css, result.css);
});

test('removed options: themeVar, spaceVar and colorVar are ignored with a warning each; the names are the contract', async () => {
  const baseline = await run({});
  const result = await run({ themeVar: (p) => `var(--mine-${p})`, spaceVar: (i) => `var(--gap-${i})`, colorVar: (p) => `var(--hue-${p})` });
  assert.deepEqual(removedWarnings(result).map((text) => text.match(/"(\w+)"/)[1]).sort(), ['colorVar', 'spaceVar', 'themeVar']);
  assert.equal(result.css, baseline.css);
  assert.doesNotMatch(result.css, /--mine-|--gap-|--hue-/);
});

test('removed options: the plugin source no longer mentions them outside the removal notice', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
  assert.doesNotMatch(source, /opts\.(breakpoints|themeVar|spaceVar|colorVar)\b/);
  assert.doesNotMatch(source, /normalizeBreakpoints|UxdslBreakpointSpec|UxDslOptions/);
  const types = fs.readFileSync(path.join(__dirname, '../src/types.ts'), 'utf8');
  assert.doesNotMatch(types, /UxdslBreakpointSpec|UxDslOptions|themeVar\?|spaceVar\?|colorVar\?/);
  const options = types.match(/export interface UxdslOptions \{([\s\S]*?)\n\}/)[1];
  assert.deepEqual([...options.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]).sort(), ['configRoot', 'discoverTheme', 'includeTheme', 'references', 'theme']);
});
