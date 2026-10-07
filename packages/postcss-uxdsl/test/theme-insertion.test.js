'use strict';

// Stability phase 1 (audit 2026-09-29, finding T10): the generated theme is
// inserted at one place — after the author's prelude (`@charset`, body-less
// `@layer` statements, `@import`s, leading comments) and before the author's
// rules — as one string, the exact bytes `generateThemeCss` returns. Until now
// only the `@import`s and the density block went there; every other family was
// `root.append`ed after the author's rules, so an author's own
// `:root { --uxdsl__palette__primary-main: … }` silently lost to the theme's
// later declaration of the same name (the maintainer hit this and deleted the
// override rather than the cause).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const { generateThemeCss, resolveTheme } = require('../dist/ds-runtime');

const compile = (source, options = {}) => postcss([plugin({ discoverTheme: false, ...options })]).process(source, { from: undefined }).css;
const topLevel = (css) => postcss.parse(css).nodes;
const describeNode = (node) => (node.type === 'atrule' ? `@${node.name} ${node.params}`.slice(0, 50) : node.type === 'rule' ? node.selector : node.type);
// The author's own nodes in these sources are marked by `rebeccapurple` or a
// class selector; everything the theme generates is a `:root` rule, a `@media`
// wrapping only `:root` rules, or the Google Fonts import.
const isAuthor = (node) => node.toString().includes('rebeccapurple') || (node.type === 'rule' && node.selector.startsWith('.'));
const isGenerated = (node) => !isAuthor(node) && ((node.type === 'rule' && /^:root/.test(node.selector))
  || (node.type === 'atrule' && node.name === 'import' && node.params.includes('fonts.googleapis.com'))
  || (node.type === 'atrule' && node.name === 'media' && (node.nodes || []).every((child) => child.type === 'rule' && /^:root/.test(child.selector))));

test('T10: an author\'s own :root override of a theme variable now wins — it follows every generated block', () => {
  const css = compile(':root { --uxdsl__palette__primary-main: rebeccapurple; }\n.a { color: palette(primary); }');
  const nodes = topLevel(css);
  const authorRoot = nodes.findIndex((node) => node.type === 'rule' && node.selector === ':root' && node.toString().includes('rebeccapurple'));
  // The base palette references its Colors collection (stability phase 5), so the theme's own declaration is a var().
  const themeRoot = nodes.findIndex((node) => node.type === 'rule' && node.toString().includes('--uxdsl__palette__primary-main: var(--uxdsl__color__purple-700)'));
  assert.ok(authorRoot >= 0 && themeRoot >= 0);
  assert.ok(authorRoot > themeRoot, `the author's :root (index ${authorRoot}) must come after the theme's (index ${themeRoot}) so the cascade picks it`);
  const lastGenerated = nodes.map(isGenerated).lastIndexOf(true);
  assert.ok(lastGenerated < authorRoot, `every generated block precedes the author's first rule; order: ${nodes.map(describeNode).join(' -> ')}`);
  // The cascade agrees: the last declaration of the name in :root scope is the author's.
  const winners = [...css.matchAll(/:root \{[^}]*--uxdsl__palette__primary-main: ([^;]+);/g)].map((m) => m[1]);
  assert.equal(winners[winners.length - 1], 'rebeccapurple');
});

test('T10: the generated theme is contiguous, after the prelude and before the first author rule', () => {
  const source = '@charset "utf-8";\n/* header */\n@layer base, components;\n@import url("https://example.com/a.css") layer(base);\n@import url("https://example.com/b.css");\n.a { padding: xs(1rem) md(2rem); }\n.b { color: palette(primary); }';
  const css = compile(source);
  const nodes = topLevel(css);
  const kinds = nodes.map(describeNode);
  assert.equal(nodes[0].name, 'charset');
  assert.equal(nodes[1].type, 'comment');
  assert.match(kinds[2], /^@import url\('https:\/\/fonts\.googleapis\.com/, 'the theme import comes first among the imports');
  assert.equal(kinds[3], '@layer base, components');
  assert.match(kinds[4], /a\.css/);
  assert.match(kinds[5], /b\.css/);
  const firstAuthorRule = nodes.findIndex((node) => node.type === 'rule' && node.selector === '.a');
  const generated = nodes.map(isGenerated);
  const firstGenerated = generated.indexOf(true, 6);
  const lastGenerated = generated.lastIndexOf(true);
  assert.equal(firstGenerated, 6, 'the first generated block follows the prelude immediately');
  assert.ok(generated.slice(firstGenerated, lastGenerated + 1).every(Boolean), 'no author node sits inside the generated run');
  assert.equal(lastGenerated + 1, firstAuthorRule, 'the author\'s first rule follows the last generated block');
  // The author's responsive @media clone still follows the author's own rule.
  assert.ok(nodes.findIndex((node) => node.type === 'atrule' && node.name === 'media' && node.toString().includes('.a')) > firstAuthorRule);
});

test('T10: the plugin\'s theme is byte-identical to generateThemeCss, for a theme-only entry and once the author\'s rules are removed', () => {
  const generated = generateThemeCss(resolveTheme({}));
  assert.equal(compile(''), generated);
  const withAuthor = compile('.a { color: red; }\n.b { padding: xs(1rem) md(2rem); }');
  assert.ok(withAuthor.startsWith(generated), 'the theme leads the output verbatim, the author\'s rules follow');
});

test('T10: one formatting style — every generated block is a one-line rule or media block', () => {
  for (const node of topLevel(compile('')).filter(isGenerated)) {
    assert.doesNotMatch(node.toString(), /\n/, `generated block is multi-line: ${node.toString().slice(0, 80)}`);
  }
});

test('T10: a token the theme JSON adds goes to the same one place as the rest of the theme', () => {
  const css = compile('@import url("https://example.com/a.css");\n.a { padding: density(custom); }', { theme: { densities: { custom: 'xs(space(1)) md(space(2))' } } });
  const nodes = topLevel(css);
  assert.match(css, /--uxdsl__density__custom: var\(--uxdsl__space__1\)/);
  const firstAuthorRule = nodes.findIndex((node) => node.type === 'rule' && node.selector === '.a');
  assert.ok(nodes.slice(0, firstAuthorRule).filter(isGenerated).length > 10, 'the theme precedes the author rule');
  assert.equal(nodes.slice(firstAuthorRule).filter(isGenerated).length, 0, 'nothing generated follows the author rule');
});

test('T10 (control): includeTheme: false inserts nothing and validates against the same rendered theme', () => {
  const css = compile('@import url("https://example.com/a.css");\n.a { padding: density(2); }', { includeTheme: false });
  assert.equal(topLevel(css).length, 2);
  assert.doesNotMatch(css, /:root/);
});
