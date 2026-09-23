// MIG-B7-14 (FEAT-009): every `@import` in the compiled output must precede
// every other rule.
//
// CSS only honors an `@import` that comes before all other rules (bar
// `@charset` and body-less `@layer` statements); a browser silently discards
// one that follows a style rule. Until this story the plugin emitted its
// `:root` density block above everything (`root.prepend`, src/index.ts) after
// having prepended the Google Fonts `@import`, so with the default
// `includeTheme: true` the import landed in position 2, behind a `:root` — and
// so did any `@import` the author wrote. The URL tests in fonts.test.js
// extract the import with a regex and never looked at where it sat; that is
// how a published release shipped with the font silently ignored.
//
// These tests therefore assert on the *position* of the node in the parsed
// output, not on the presence of a string.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateThemeCss } = require('../dist/ds-runtime');

const compile = async (source, options = {}) => (await postcss([plugin(options)]).process(source, { from: undefined })).css;

const topLevel = (css) => postcss.parse(css).nodes.filter((node) => node.type !== 'comment');
const isImport = (node) => node.type === 'atrule' && node.name.toLowerCase() === 'import';
const describeNode = (node) => (node.type === 'atrule' ? `@${node.name} ${node.params}`.slice(0, 60) : node.selector);

/** The invariant itself: no rule (or other at-rule) sits above any @import. */
function assertImportsFirst(css, label) {
  const nodes = topLevel(css).filter((node) => !(node.type === 'atrule' && (node.name === 'charset' || (node.name === 'layer' && !node.nodes))));
  const lastImport = nodes.map(isImport).lastIndexOf(true);
  const blockedBy = nodes.slice(0, lastImport + 1).find((node) => !isImport(node));
  assert.equal(blockedBy, undefined,
    `${label}: an @import follows ${blockedBy && describeNode(blockedBy)}, so a browser would discard it. Top-level order: ${nodes.slice(0, 5).map(describeNode).join('  ->  ')}`);
}

const googleImports = (css) => topLevel(css).filter((node) => isImport(node) && node.params.includes('fonts.googleapis.com'));

test('MIG-B7-14: zero-config output starts with the Google Fonts @import (the published-beta.6 defect)', async () => {
  const css = await compile('.a { padding: density(2); }');
  assert.equal(googleImports(css).length, 1, 'the default theme sets fonts.google, so exactly one import is emitted');
  assert.ok(isImport(topLevel(css)[0]), `the first rule must be the @import, was ${describeNode(topLevel(css)[0])}`);
  assertImportsFirst(css, 'zero-config');
});

test('MIG-B7-14: holds for every includeTheme:true entry, whatever the source contains', async () => {
  for (const [label, source] of Object.entries({
    'no UXDSL syntax': '.a { color: red; }',
    'density()': '.a { padding: density(2); }',
    'a directive': '.a { @ds-surface(contained); }',
    'a responsive value': '.a { padding: xs(1rem) md(2rem); }',
    'an empty file': '',
  })) {
    assertImportsFirst(await compile(source, { includeTheme: true }), label);
  }
});

test('MIG-B7-14: several fonts.google entries all lead, in their configured order', async () => {
  const css = await compile('.a { color: red; }', { theme: { fonts: { google: ['Open Sans:wght@400;700', 'Playfair Display'] } } });
  const urls = googleImports(css).map((node) => node.params);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /Open\+Sans/);
  assert.match(urls[1], /Playfair\+Display/);
  assertImportsFirst(css, 'two families');
});

test("MIG-B7-14: the author's own @import is honored too — it used to land behind :root as well", async () => {
  const css = await compile('@import url("https://example.com/user.css");\n.a { padding: density(2); }', { includeTheme: true });
  assertImportsFirst(css, "author's @import");
  const imports = topLevel(css).filter(isImport).map((node) => node.params);
  assert.equal(imports.length, 2);
  assert.match(imports[0], /fonts\.googleapis\.com/, 'the theme-owned import stays first');
  assert.match(imports[1], /example\.com\/user\.css/, "the author's import follows, source order preserved");
});

test("MIG-B7-14: several author @imports keep their relative order", async () => {
  const css = await compile('@import url("https://example.com/a.css");\n@import url("https://example.com/b.css");\n.a { padding: density(2); }', { theme: { fonts: { google: [] } } });
  assertImportsFirst(css, 'two author imports');
  assert.deepEqual(topLevel(css).filter(isImport).map((node) => node.params), ['url("https://example.com/a.css")', 'url("https://example.com/b.css")']);
});

test('MIG-B7-14 (valid control): fonts.google: [] emits no import of its own and does not disturb the rest', async () => {
  const css = await compile('.a { padding: density(2); }', { theme: { fonts: { google: [] } } });
  assert.equal(googleImports(css).length, 0);
  assert.doesNotMatch(css, /@import/);
  assert.equal(topLevel(css)[0].selector, ':root', 'with nothing to hoist, the density :root keeps leading exactly as before');
});

test('MIG-B7-14 (valid control): includeTheme:false output is untouched — the import is already first', async () => {
  const source = '@import url("https://example.com/user.css");\n.a { padding: density(2); }';
  const css = await compile(source, { includeTheme: false });
  assert.equal(topLevel(css).length, 2);
  assertImportsFirst(css, 'includeTheme:false');
  assert.doesNotMatch(css, /:root/);
});

test('MIG-B7-14: @charset stays first and a body-less @layer is not treated as a blocker', async () => {
  const css = await compile('@charset "utf-8";\n@layer base, components;\n@import url("https://example.com/user.css");\n.a { padding: density(2); }', { includeTheme: true });
  const nodes = topLevel(css);
  assert.equal(nodes[0].name, 'charset', '@charset must remain the very first rule');
  assertImportsFirst(css, 'charset + layer + import');
  assert.ok(nodes.findIndex(isImport) < nodes.findIndex((node) => node.type === 'rule'), 'every import precedes the first rule');
});

test("MIG-B7-14: the author's own order is never rewritten — a layer-order statement stays ahead of the layered import that depends on it", async () => {
  // Moving author nodes would change the cascade here: `@layer y, x;` declares
  // that y is lower priority than x, and an `@import ... layer(x)` hoisted above
  // it would mention x first and silently reverse that. Theme nodes are inserted
  // after the author's prelude instead, so this order must survive untouched.
  const css = await compile('@layer y, x;\n@import url("https://example.com/a.css") layer(x);\n.a { padding: density(2); }', { includeTheme: true });
  const nodes = topLevel(css);
  const layerAt = nodes.findIndex((node) => node.type === 'atrule' && node.name === 'layer');
  const layeredImportAt = nodes.findIndex((node) => isImport(node) && node.params.includes('layer(x)'));
  assert.ok(layerAt >= 0 && layeredImportAt >= 0);
  assert.ok(layerAt < layeredImportAt, 'the @layer statement must still precede the import that names its layer');
  assertImportsFirst(css, 'layer + layered import');
});

test('MIG-B7-14: an @import inside another at-rule is not top-level and is left where it is', async () => {
  const css = await compile('@media print { @import url("https://example.com/print.css"); }\n.a { color: red; }', { includeTheme: false });
  const media = topLevel(css).find((node) => node.type === 'atrule' && node.name === 'media');
  assert.ok(media.nodes.some(isImport), 'the nested import is still inside @media, untouched');
});

test('MIG-B7-14: idempotent — compiling the already-ordered result again changes nothing', async () => {
  const first = await compile('.a { padding: density(2); }');
  const second = await compile(first, { includeTheme: false });
  assert.equal(second, first);
});

test('MIG-B7-14 (control): generateThemeCss, the runtime/SSR path, still leads with the import', () => {
  assert.ok(isImport(topLevel(generateThemeCss({ fonts: { google: ['Inter:wght@400;700'] } }))[0]));
});
