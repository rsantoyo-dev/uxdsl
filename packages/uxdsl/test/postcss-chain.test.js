'use strict';

// uxdsl/postcss in one PostCSS run with another plugin. The Sass-like syntax
// that plugin resolves (a nesting plugin's `&_title`, a variables plugin's
// `$gap`) compiles in either plugin order, to what the documented two passes
// give; a Sass construct UXDSL's own steps read still fails as it does with
// the plugin alone; and the plugin alone reports exactly what it reported
// before: the first Sass construct, before any warning a later step gives.
//
// The stand-ins reproduce each real plugin's timing: postcss-nested unwraps in
// a Rule visitor, tailwindcss/nesting flattens in its own Once and then marks
// every leaf dirty, postcss-simple-vars resolves in a Declaration visitor.
// fixtures/mig-b9-27-postcss-chain runs the real plugins.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/plugin');
const plugin = exported.default || exported;
const { compile } = require('../dist/entries/index.js');

const FROM = '/project/src/app.css';
const sassContext = (construct) => `UXD_SASS_CONTEXT: ${construct} is Sass; the PostCSS plugin compiles CSS plus UXDSL. Name the file .uxdsl and compile it with uxdsl build, compile() or an adapter, or remove the Sass.`;
const uxdsl = (options = {}) => plugin({ discoverTheme: false, ...options });

// --- stand-ins ---------------------------------------------------------------

/** As postcss-nested: a Rule visitor moves a nested rule after its parent, writing the parent's selector for `&`, and removes a parent it emptied. */
const nestingVisitor = ({ leave = false } = {}) => ({
  postcssPlugin: 'stand-in/nesting-visitor',
  prepare() {
    const lastMoved = new WeakMap();
    return {
      Rule(rule) {
        const parent = rule.parent;
        if (leave || !parent || parent.type !== 'rule') return;
        rule.selector = rule.selector.replace(/&/g, parent.selector);
        (lastMoved.get(parent) || parent).after(rule);
        lastMoved.set(parent, rule);
        if (parent.nodes.length === 0) parent.remove();
      },
    };
  },
});

/** As tailwindcss/nesting: in its own Once, the nesting visitor runs synchronously over the root, and every leaf is then marked dirty, so later plugins' visitors run again. */
const nestingOnce = ({ leave = false } = {}) => ({
  postcssPlugin: 'stand-in/nesting-once',
  Once(root, { result }) {
    postcss([nestingVisitor({ leave })]).process(root, result.opts).sync();
    const markDirty = (node) => {
      if (node.nodes) node.nodes.forEach(markDirty);
      else node.markDirty();
    };
    markDirty(root);
  },
});

/** As postcss-simple-vars: a Declaration visitor stores and removes `$name: value`, and writes the value in place of `$name` elsewhere. */
const variablesVisitor = ({ resolveNothing = false } = {}) => ({
  postcssPlugin: 'stand-in/variables',
  prepare() {
    const values = new Map();
    return {
      Declaration(decl) {
        if (resolveNothing) return;
        if (decl.prop.startsWith('$')) {
          values.set(decl.prop.slice(1), decl.value);
          decl.remove();
        } else if (decl.value.includes('$')) {
          decl.value = decl.value.replace(/\$([\w-]+)/g, (written, name) => (values.has(name) ? values.get(name) : written));
        }
      },
    };
  },
});

// --- helpers -----------------------------------------------------------------

/** One PostCSS run: its CSS, or its error. */
async function run(plugins, source) {
  try {
    return { css: (await postcss(plugins).process(source, { from: FROM })).css };
  } catch (error) {
    return { error };
  }
}

/** The documented workaround: the other plugin in a pass of its own, then uxdsl/postcss. */
async function twoPasses(other, source) {
  const first = await postcss([other()]).process(source, { from: FROM });
  return run([uxdsl()], first.css);
}

/** Both plugin orders in one run each. */
const orders = (other) => [['other first', () => [other(), uxdsl()]], ['uxdsl first', () => [uxdsl(), other()]]];

const normalized = (css) => {
  const root = postcss.parse(css);
  root.cleanRaws();
  return root.toString();
};

function assertSassError(error, construct, line, column, label) {
  assert.ok(error, `${label}: expected UXD_SASS_CONTEXT for ${construct}, but it compiled`);
  assert.equal(error.name, 'CssSyntaxError', `${label}: ${error.message}`);
  assert.equal(error.reason, sassContext(construct), label);
  assert.deepEqual([error.line, error.column], [line, column], label);
}

/** One run gives the two passes' CSS. */
async function assertAsTwoPasses(other, source, label) {
  const expected = await twoPasses(other, source);
  assert.ok(expected.css !== undefined, `${label}: the two passes fail: ${expected.error?.message}`);
  for (const [order, plugins] of orders(other)) {
    const { css, error } = await run(plugins(), source);
    assert.ok(css !== undefined, `${label}, ${order}: ${error?.message}`);
    assert.equal(normalized(css), normalized(expected.css), `${label}, ${order}`);
  }
}

const nested = (inner) => `.phone {\n  &_title {\n    ${inner}\n  }\n}\n`;

// --- T1 ----------------------------------------------------------------------

test('MIG-B9-27: a nesting plugin\'s &_title compiles with uxdsl/postcss listed before or after it, to what the two passes give; with a responsive value, @ds-surface or @ds-button inside, it gives the two passes\' CSS or BASE\'s error', async () => {
  for (const [name, other] of [['visitor', () => nestingVisitor()], ['once', () => nestingOnce()]]) {
    await assertAsTwoPasses(other, nested('padding: space(2);'), `nesting ${name}, space(2)`);
    const expected = await twoPasses(other, nested('padding: space(2);'));
    assert.match(expected.css, /\.phone_title \{\s*padding: var\(--uxdsl__space__2\);\s*\}/);
    // C5's evidence inputs: the two passes' CSS, or the plugin alone's error for the input; nothing else.
    for (const inner of ['padding: xs(1rem) md(2rem);', '@ds-surface(contained);', '@ds-button(contained);']) {
      const source = nested(inner);
      const passes = await twoPasses(other, source);
      assert.ok(passes.css !== undefined, `${name}, ${inner}: the two passes fail: ${passes.error?.message}`);
      for (const [order, plugins] of orders(other)) {
        const label = `nesting ${name}, ${order}, ${inner}`;
        const { css, error } = await run(plugins(), source);
        if (error) assertSassError(error, '&_title', 2, 3, label);
        else assert.equal(normalized(css), normalized(passes.css), label);
      }
    }
  }
  // Negative control: stand-ins that leave &_title in place give the plugin alone's error, in both orders.
  for (const [name, other] of [['visitor', () => nestingVisitor({ leave: true })], ['once', () => nestingOnce({ leave: true })]]) {
    for (const [order, plugins] of orders(other)) {
      const { error } = await run(plugins(), nested('padding: space(2);'));
      assertSassError(error, '&_title', 2, 3, `nesting ${name} that leaves &_title, ${order}`);
    }
  }
});

// --- T2 ----------------------------------------------------------------------

test('MIG-B9-27: a variables plugin\'s $gap compiles with uxdsl/postcss listed before or after it, to what the two passes give', async () => {
  const source = '$gap: 4px;\n.card {\n  padding: $gap;\n  margin: space(2);\n}\n';
  await assertAsTwoPasses(() => variablesVisitor(), source, 'variables, $gap');
  const expected = await twoPasses(() => variablesVisitor(), source);
  assert.match(expected.css, /\.card \{\s*padding: 4px;\s*margin: var\(--uxdsl__space__2\);\s*\}/);
  // Negative control: a stand-in that resolves nothing gives the plugin alone's error, in both orders.
  for (const [order, plugins] of orders(() => variablesVisitor({ resolveNothing: true }))) {
    const { error } = await run(plugins(), source);
    assertSassError(error, '$gap', 1, 1, `variables that resolve nothing, ${order}`);
  }
});

// --- T3 ----------------------------------------------------------------------

test('MIG-B9-27: in a chain, a Sass construct UXDSL\'s own steps read fails as on BASE, never as other CSS', async () => {
  for (const [source, construct, expectedCss] of [
    ['$n: 2;\n.card {\n  padding: space($n);\n}\n', '$n', /padding: var\(--uxdsl__space__2\)/],
    ['$pad: space(2);\n.card {\n  padding: $pad;\n}\n', '$pad', /padding: var\(--uxdsl__space__2\)/],
    ['$pad: xs(1rem) md(2rem);\n.card {\n  padding: $pad;\n}\n', '$pad', /@media \(min-width: 768px\) \{\s*\.card \{\s*padding: 2rem;\s*\}\s*\}/],
  ]) {
    // Negative control: the two passes compile each input, md's value included,
    // so a chain that compiled, or lost a value, would be seen below.
    const passes = await twoPasses(() => variablesVisitor(), source);
    assert.ok(passes.css !== undefined, `${construct}: the two passes fail: ${passes.error?.message}`);
    assert.match(passes.css, expectedCss);
    for (const [order, plugins] of orders(() => variablesVisitor())) {
      const { error } = await run(plugins(), source);
      assertSassError(error, construct, 1, 1, `${JSON.stringify(source.split('\n')[0])}, ${order}`);
    }
  }
});

// --- T4 ----------------------------------------------------------------------

// The plugin alone, on stylesheets that hold Sass and something UXDSL's own
// steps read: the error with its reason and full range, and each input's twin,
// its Sass construct replaced by CSS, which compiles or fails with another code.
const ALONE = [
  ['P1', '@use "sass:math";\n.a {\n  padding: space(99);\n}\n', ['@use', 1, 1, 1, 5], '.a {\n  padding: space(99);\n}\n', 'UXD_SPACE_REFERENCE'],
  ['P2', '.a {\n  padding: space($gap);\n}\n', ['$gap', 2, 18, 2, 22], '.a {\n  padding: space(2);\n}\n', null],
  ['P3', '.a {\n  padding: xs($gap) md(2rem);\n}\n', ['$gap', 2, 15, 2, 19], '.a {\n  padding: xs(2) md(2rem);\n}\n', null],
  ['P4', '@mixin card {\n  @ds-surface(contained);\n}\n', ['@mixin', 1, 1, 1, 7], '.card {\n  @ds-surface(contained);\n}\n', null],
  ['P5', '.a {\n  @if $wide {\n    @ds-surface(contained);\n  }\n}\n', ['@if', 2, 3, 2, 6], '.a {\n  @media (min-width: 1px) {\n    @ds-surface(contained);\n  }\n}\n', 'UXD_DIRECTIVE_CONTEXT'],
  ['P6', '.a {\n  color: palete($tone);\n}\n', ['$tone', 2, 17, 2, 22], '.a {\n  color: palete(primary);\n}\n', 'UXD_FUNCTION_UNKNOWN'],
  ['P7', '.a {\n  &__title {\n    padding: xs(1rem) md(2rem);\n  }\n}\n', ['&__title', 2, 3, 2, 11], '.a {\n  .title {\n    padding: xs(1rem) md(2rem);\n  }\n}\n', null],
  ['P8', '.a {\n  &__title {\n    @ds-surface(contained);\n  }\n}\n', ['&__title', 2, 3, 2, 11], '.a {\n  .title {\n    @ds-surface(contained);\n  }\n}\n', null],
  ['P9', '$pad: xs(1rem) md(2rem);\n.a {\n  padding: $pad;\n}\n', ['$pad', 1, 1, 1, 5], '.a {\n  padding: xs(1rem) md(2rem);\n}\n', null],
  ['P10', '.a {\n  margin: space(99);\n  padding: space(2) // inner\n}\n', ['a // comment', 3, 21, 3, 29], '.a {\n  margin: space(99);\n  padding: space(2) /* inner */\n}\n', 'UXD_SPACE_REFERENCE'],
];

const range = (error) => [error.line, error.column, error.endLine, error.endColumn];

/** A PostCSS Document of two roots, as postcss-html and similar syntaxes give. */
function documentOf(first, second) {
  const doc = postcss.document();
  doc.append(postcss.parse(first, { from: '/project/src/a.css' }));
  doc.append(postcss.parse(second, { from: '/project/src/b.css' }));
  return doc;
}

test('MIG-B9-27: the plugin alone reports BASE\'s error for a stylesheet holding Sass and something UXDSL\'s own steps read (P1 to P10)', async () => {
  for (const [id, source, [construct, ...expectedRange], twin, twinCode] of ALONE) {
    const { error } = await run([uxdsl()], source);
    assertSassError(error, construct, expectedRange[0], expectedRange[1], id);
    assert.deepEqual(range(error), expectedRange, id);
    // Negative control: without its Sass construct the input compiles, or fails with another code.
    const other = await run([uxdsl()], twin);
    if (twinCode === null) assert.ok(other.css !== undefined, `${id}'s twin: ${other.error?.message}`);
    else assert.match(other.error?.reason || '', new RegExp(`^${twinCode}:`), `${id}'s twin`);
  }
  // A Document's roots: the first root's Sass construct comes before the
  // second root's unknown token, as with each root compiled in turn.
  const { error } = await run([uxdsl()], documentOf('.b { &__x { color: red; } }', '.a { margin: space(99); }'));
  assertSassError(error, '&__x', 1, 6, 'document');
  assert.deepEqual([error.file, ...range(error)], ['/project/src/a.css', 1, 6, 1, 10]);
  const twin = await run([uxdsl()], documentOf('.b { .x { color: red; } }', '.a { margin: space(99); }'));
  assert.match(twin.error?.reason || '', /^UXD_SPACE_REFERENCE:/, 'document twin');
});

// --- T5 ----------------------------------------------------------------------

test('MIG-B9-27: while a Sass construct is pending, the plugin alone reports no warning and calls no onWarning before its error', async () => {
  const warned = '.a { padding: calc(space(2) + var(--nope)); }';
  const withWarnings = () => {
    const calls = [];
    return { calls, plugins: [uxdsl({ references: { mode: 'warn', onWarning: (issue) => calls.push(issue.message) } })] };
  };
  {
    const { calls, plugins } = withWarnings();
    const { error } = await run(plugins, `${warned} .b { &__x { color: red; } }`);
    assertSassError(error, '&__x', 1, 52, 'pending');
    assert.deepEqual(range(error), [1, 52, 1, 56]);
    assert.deepEqual(calls, []);
  }
  // Negative control: without the &__x rule the warning is reported, through
  // result.warnings() and onWarning alike.
  {
    const { calls, plugins } = withWarnings();
    const result = await postcss(plugins).process(warned, { from: FROM });
    assert.deepEqual(result.warnings().map((warning) => warning.text.match(/^UXD_[A-Z_]+/)?.[0]), ['UXD_REFERENCE_MISSING']);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^UXD_REFERENCE_MISSING: padding -> --nope/);
  }
  // A Document: the first root's Sass construct fails before the second root warns.
  {
    const { calls, plugins } = withWarnings();
    const { error } = await run(plugins, documentOf('.b { &__x { color: red; } }', warned));
    assertSassError(error, '&__x', 1, 6, 'document');
    assert.deepEqual(calls, []);
  }
  // compile(): a Sass construct Dart Sass keeps fails with no warning of the
  // plugin's later steps in error.warnings; without it, the warning is returned.
  const failed = await compile({ source: `${warned}\n.c { --gap: $gap; }\n` }, { theme: {}, references: { mode: 'warn' } }).then(
    () => assert.fail('expected compile() to fail on a $variable Sass keeps'),
    (caught) => caught
  );
  assert.match(failed.reason, /^UXD_SASS_CONTEXT: Sass keeps \$gap literally in the custom property --gap;/);
  assert.deepEqual(failed.warnings, []);
  const compiled = await compile({ source: `${warned}\n` }, { theme: {}, references: { mode: 'warn' } });
  assert.deepEqual(compiled.warnings.map((warning) => (warning.text || warning.message).match(/^UXD_[A-Z_]+/)?.[0]), ['UXD_REFERENCE_MISSING']);
});

// --- a replaced root ---------------------------------------------------------

test('MIG-B9-27: a Sass construct pending when another plugin replaces the root fails with the plugin alone\'s error, never silently', async () => {
  const replaceRoot = () => ({
    postcssPlugin: 'stand-in/replace-root',
    Once(root, { result }) {
      result.root = postcss.parse(root.toString(), { from: FROM });
    },
  });
  const { error } = await run([uxdsl(), replaceRoot()], nested('padding: space(2);'));
  assertSassError(error, '&_title', 2, 3, 'replaced root');
  // Negative control: a Sass construct the replacement resolved is no longer
  // in the root that reaches the end of the run, and is still reported, as the
  // plugin alone would.
  const resolving = () => ({
    postcssPlugin: 'stand-in/replace-root-resolved',
    Once(root, { result }) {
      result.root = postcss.parse(root.toString().replace('&_title', '.phone_title'), { from: FROM });
    },
  });
  const resolved = await run([uxdsl(), resolving()], nested('padding: space(2);'));
  assertSassError(resolved.error, '&_title', 2, 3, 'replaced root, resolved');
});

// --- a construct added before a held one -------------------------------------

test('MIG-B9-27: when another plugin adds a Sass construct before one still held, the held construct\'s error is reported, as the plugin alone reports it', async () => {
  const addVariable = () => ({
    postcssPlugin: 'stand-in/add-variable',
    Once(root) {
      root.prepend(postcss.decl({ prop: '$late', value: '1px' }));
    },
  });
  const source = '.b { &__x { color: red; } }';
  const { error } = await run([uxdsl(), addVariable()], source);
  assertSassError(error, '&__x', 1, 6, 'held, then $late added before it');
  assert.deepEqual(range(error), [1, 6, 1, 10]);
  // Negative control: with the held construct resolved, the added one is
  // still found at the end of the run and fails, never silently.
  const resolveHeld = () => ({
    postcssPlugin: 'stand-in/add-variable-resolve-held',
    Once(root) {
      root.walkRules('&__x', (rule) => {
        rule.selector = '.b__x';
        rule.parent.after(rule);
      });
      root.prepend(postcss.decl({ prop: '$late', value: '1px' }));
    },
  });
  const added = await run([uxdsl(), resolveHeld()], source);
  assert.match(added.error?.reason || '', /^UXD_SASS_CONTEXT: \$late is Sass;/, 'the added construct');
});
