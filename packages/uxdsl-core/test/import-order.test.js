'use strict';

// MIG-B7-14 (FEAT-009): the CLI, Vite and Webpack all go through compile(), so
// this is the path a consumer actually gets. Beta.6 shipped compile() output in
// which the Google Fonts `@import` sat in position 2, behind a `:root`, where a
// browser discards it. The plugin-level tests live in postcss-uxdsl; this file
// pins the same invariant through the shared pipeline, including what only the
// pipeline does: inlining a local `@import` of a partial.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const core = require('../dist/index.js');

function project(files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-core-import-order-')));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

const cssOf = (result) => (typeof result === 'string' ? result : result.css);
const nodes = (css) => postcss.parse(css).nodes.filter((node) => node.type !== 'comment');
const isImport = (node) => node.type === 'atrule' && node.name === 'import';
const label = (node) => (node.type === 'atrule' ? `@${node.name} ${node.params}`.slice(0, 55) : node.selector);

function assertImportsFirst(css, what) {
  const list = nodes(css).filter((node) => !(node.type === 'atrule' && (node.name === 'charset' || (node.name === 'layer' && !node.nodes))));
  const last = list.map(isImport).lastIndexOf(true);
  const blocker = list.slice(0, last + 1).find((node) => !isImport(node));
  assert.equal(blocker, undefined, `${what}: an @import follows ${blocker && label(blocker)} — a browser would discard it. Order: ${list.slice(0, 5).map(label).join(' -> ')}`);
}

test('MIG-B7-14: compile({ entry }) with the default theme leads with the Google Fonts @import', async () => {
  const dir = project({ 'entry.uxdsl': '.a { padding: density(2); }\n' });
  const css = cssOf(await core.compile({ entry: path.join(dir, 'entry.uxdsl') }));
  const first = nodes(css)[0];
  assert.ok(isImport(first), `the first rule must be the @import, was ${label(first)}`);
  assert.match(first.params, /fonts\.googleapis\.com/);
  assertImportsFirst(css, 'default theme');
});

test('MIG-B7-14: an author @import that arrives through a partial is still honored', async () => {
  // postcss-import inlines the local partial; the remote import it contains is
  // left as an at-rule and must not end up behind the theme's :root.
  const dir = project({
    'entry.uxdsl': '@import "./partial.uxdsl";\n.a { padding: density(2); }\n',
    'partial.uxdsl': '@import url("https://example.com/author.css");\n.b { color: red; }\n',
  });
  const css = cssOf(await core.compile({ entry: path.join(dir, 'entry.uxdsl') }));
  assertImportsFirst(css, 'author import via partial');
  const imports = nodes(css).filter(isImport).map((node) => node.params);
  assert.ok(imports.some((params) => params.includes('fonts.googleapis.com')), 'theme import present');
  assert.ok(imports.some((params) => params.includes('example.com/author.css')), "the author's import is kept");
});

test('MIG-B7-14 (valid control): fonts.google: [] leaves no import of the theme\'s and does not reorder anything else', async () => {
  const dir = project({ 'entry.uxdsl': '.a { padding: density(2); }\n' });
  const css = cssOf(await core.compile({ entry: path.join(dir, 'entry.uxdsl') }, { theme: { fonts: { google: [] } } }));
  assert.doesNotMatch(css, /@import/);
  assert.equal(nodes(css)[0].selector, ':root');
});

test('MIG-B7-14 (valid control): includeTheme:false emits no theme import and no :root', async () => {
  const dir = project({ 'entry.uxdsl': '.a { padding: density(2); }\n' });
  const css = cssOf(await core.compile({ entry: path.join(dir, 'entry.uxdsl') }, { includeTheme: false }));
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /:root/);
});
