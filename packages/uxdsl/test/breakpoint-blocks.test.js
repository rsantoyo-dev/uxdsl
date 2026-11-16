'use strict';

// `@media (--<breakpoint>)`: a block that applies from a breakpoint up. In an
// @media prelude, `(--<bp>)` names a breakpoint of the effective theme and
// compiles to the query `<bp>()` emits, on both paths: compile() (after Dart
// Sass, which bubbles a nested block out of its rule and merges nested
// queries) and uxdsl/postcss alone (which keeps CSS nesting as written).
// What is written by hand wins: a literal query is never rewritten, and a
// top-level `@custom-media --<bp>` replaces the theme's breakpoint in that
// stylesheet with one warning. Any other `(--name)` in an @media prelude is
// UXD_BREAKPOINT_UNKNOWN once every plugin of the run has had its turn.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const exported = require('../dist/plugin');
const plugin = exported.default || exported;
const { compile } = require('../dist/entries/index.js');

const DIR = path.join(__dirname, 'mig-b9-30');
const CSS_FROM = path.join(DIR, 'x.css');
const UXDSL_FROM = path.join(DIR, 'x.uxdsl');
const SIDE_NAV = path.resolve(__dirname, '../../playground-nextjs/src/components/SideNav.uxdsl');

const uxdsl = (theme = {}) => plugin({ theme, discoverTheme: false });
/** The plugin alone: the CSS, its warnings' texts and the result. */
const viaPlugin = async (css, theme = {}) => {
  const result = await postcss([uxdsl(theme)]).process(css, { from: CSS_FROM });
  return { css: result.css, warnings: result.warnings().map((warning) => warning.text), result };
};
/** compile(), as for a .uxdsl file: the CSS and its warnings. */
const viaCompile = async (source, theme = {}, from = UXDSL_FROM) => {
  const result = await compile({ source, from }, { theme, discoverTheme: false });
  return { css: result.css, warnings: result.warnings, result };
};
const failure = (promise) => promise.then(() => null, (error) => error);
const flat = (css) => css.replace(/\s+/g, ' ').trim();

// --- T1 -----------------------------------------------------------------------

test('MIG-B9-30: with uxdsl/postcss alone, (--<bp>) in an @media prelude becomes the query <bp>() emits, top level and nested, in lists, with types, not, only and and, any case, inner spaces, a custom or fractional breakpoint; raws and comments kept', async () => {
  const cases = [
    ['@media (--md) { .a { color: red } }', '@media (min-width: 768px) { .a { color: red } }'],
    ['.a { color: red; @media (--lg) { color: blue } }', '.a { color: red; @media (min-width: 1024px) { color: blue } }'],
    ['@media screen and (--lg), print { .a { color: red } }', '@media screen and (min-width: 1024px), print { .a { color: red } }'],
    ['@media not all and (--lg) { .a { color: red } }', '@media not all and (min-width: 1024px) { .a { color: red } }'],
    ['@media only screen and (--md) and (orientation: landscape) { .a { color: red } }', '@media only screen and (min-width: 768px) and (orientation: landscape) { .a { color: red } }'],
    ['@media (--LG) { .a { color: red } }', '@media (min-width: 1024px) { .a { color: red } }'],
    ['@MEDIA ( --lg ) { .a { color: red } }', '@MEDIA (min-width: 1024px) { .a { color: red } }'],
    ['@media(--md){.a{color:red}}', '@media(min-width: 768px){.a{color:red}}'],
    ['@media  (--sm)  { .a { color: red } }', '@media  (min-width: 480px)  { .a { color: red } }'],
    ['@media (--sm) /* from sm */ and (orientation: landscape) { .a { color: red } }', '@media (min-width: 480px) /* from sm */ and (orientation: landscape) { .a { color: red } }'],
    ['@media print { @supports (display: grid) { .a { @media (--xl) { color: red } } } }', '@media print { @supports (display: grid) { .a { @media (min-width: 1280px) { color: red } } } }'],
    ['@media (--md) { .a { @media (--lg) { color: red } } }', '@media (min-width: 768px) { .a { @media (min-width: 1024px) { color: red } } }'],
  ];
  for (const [source, expected] of cases) {
    assert.equal((await viaPlugin(source)).css, expected, source);
  }
  // A breakpoint of the project's own theme, and a width that is not an integer.
  assert.equal((await viaPlugin('@media (--xxl) { .a { color: red } }', { breakpoints: { xxl: 1536 } })).css, '@media (min-width: 1536px) { .a { color: red } }');
  assert.equal((await viaPlugin('@media (--md) { .a { color: red } }', { breakpoints: { md: 767.5 } })).css, '@media (min-width: 767.5px) { .a { color: red } }');
  // The same query a responsive value emits, byte for byte.
  const fromFunction = (await viaPlugin('.a { padding: xs(0) lg(1rem); }')).result.root.nodes[1];
  assert.equal(fromFunction.params, '(min-width: 1024px)');

  // Negative controls: what is not a breakpoint feature in an @media prelude is left as written.
  for (const source of [
    '@media (min-width: 1024px) { .a { color: red } }',
    '@supports (--lg: 1) { .a { color: red } }',
    '@media (--lg: 1) { .a { color: red } }',
    '.a { @container (--lg) { color: red } }',
    '@import url("x.css") (--lg);',
    '@function --f(--lg) { result: 1 }',
    '@property --lg { syntax: "<length>"; inherits: false; initial-value: 0px }',
    '@layer --x { .a { color: red } }',
    '@custom-media --narrow (max-width: 400px);',
    '.a { --lg: 1px; color: var(--lg); }',
  ]) {
    assert.equal((await viaPlugin(source)).css, source, source);
  }
});

// --- T2 -----------------------------------------------------------------------

test('MIG-B9-30: a (--lg) block compiles byte for byte to what the literal theme query compiles to, on both paths, and follows the theme', async () => {
  const literal = (source, px) => source.replaceAll('(--lg)', `(min-width: ${px}px)`);
  const both = [
    '@media (--lg) { .a { color: red; } }',
    '@media (--lg) { .nav { display: flex; @ds-surface(flat); } }',
    '@media screen and (--lg), print { .a { padding: density(2); } }',
    '.a { color: red; @media (--lg) { color: blue; } }',
  ];
  const compileOnly = ['.nav { color: red; @media (--lg) { display: flex; @ds-surface(flat); } }'];
  for (const [label, run, sources] of [['the plugin alone', viaPlugin, both], ['compile()', viaCompile, [...both, ...compileOnly]]]) {
    for (const source of sources) {
      const block = (await run(source)).css;
      assert.equal(block, (await run(literal(source, 1024))).css, `${label}: ${source}`);
      assert.ok(!block.includes('(--lg)'), `${label}: ${source} keeps no (--lg)`);
      // The block follows the theme: with lg at 1100 it is the 1100px literal, not the 1024px one.
      const moved = (await run(source, { breakpoints: { lg: 1100 } })).css;
      assert.equal(moved, (await run(literal(source, 1100), { breakpoints: { lg: 1100 } })).css, `${label}: ${source} at 1100px`);
      assert.notEqual(moved, (await run(literal(source, 1024), { breakpoints: { lg: 1100 } })).css, `${label}: ${source} is not the 1024px literal`);
    }
  }

  // The playground's SideNav compiles the same with (--lg) as with the literal 1024px query it replaced.
  const text = fs.readFileSync(SIDE_NAV, 'utf8');
  const withBlock = text.replace('@media (min-width: 1024px) {', '@media (--lg) {');
  const withLiteral = text.replace('@media (--lg) {', '@media (min-width: 1024px) {');
  assert.ok(withBlock.includes('@media (--lg) {') && withLiteral.includes('@media (min-width: 1024px) {'), 'SideNav holds the block, in one spelling or the other');
  assert.equal((await viaCompile(withBlock)).css, (await viaCompile(withLiteral)).css);
});

// --- T3 -----------------------------------------------------------------------

test('MIG-B9-30: through compile(), a nested @media (--lg) holding @ds-surface(flat) bubbles and the directive expands; also in a mixin\'s @content, &:hover, @supports and @layer', async () => {
  const { css: flatRole } = await viaCompile('.nav { @ds-surface(flat); }');
  const role = flatRole.replace(/^\.nav \{\n/, '').replace(/\n\}\n?$/, '').split('\n').map((line) => `  ${line}`).join('\n');
  assert.equal(role.split('\n').length, 6, 'the flat role\'s six declarations');

  const nested = await viaCompile('.nav { color: red; @media (--lg) { display: flex; @ds-surface(flat); } }');
  assert.equal(nested.css, `.nav {\n  color: red;\n}\n@media (min-width: 1024px) {\n  .nav {\n    display: flex;\n${role}\n  }\n}`);
  assert.deepEqual(nested.warnings, []);

  const mixin = await viaCompile('@mixin up { @media (--lg) { @content; } }\n.nav { @include up { display: flex; @ds-surface(flat); } }');
  assert.equal(mixin.css, `@media (min-width: 1024px) {\n  .nav {\n    display: flex;\n${role}\n  }\n}`);

  const hover = await viaCompile('.nav { &:hover { @media (--lg) { color: red; } } }');
  assert.equal(flat(hover.css), '@media (min-width: 1024px) { .nav:hover { color: red; } }');

  const supports = await viaCompile('.nav { @supports (display: grid) { @media (--lg) { display: grid; @ds-surface(flat); } } }');
  assert.equal(flat(supports.css), flat(`@supports (display: grid) { @media (min-width: 1024px) { .nav { display: grid; ${role} } } }`));

  const layer = await viaCompile('@layer base { .nav { @media (--lg) { color: red; } } }');
  assert.equal(flat(layer.css), '@layer base { @media (min-width: 1024px) { .nav { color: red; } } }');
});

// --- T4 -----------------------------------------------------------------------

test('MIG-B9-30: Sass\'s merge of nested breakpoint media queries is pinned', async () => {
  const cases = [
    ['@media print { .a { @media (--lg) { color: red; } } }', '@media print and (min-width: 1024px) { .a { color: red; } }'],
    ['@media (--md) { .a { @media (--lg) { color: red; } } }', '@media (min-width: 768px) and (min-width: 1024px) { .a { color: red; } }'],
    ['@media print, screen { .a { @media (--lg) { color: red; } } }', '@media print and (min-width: 1024px), screen and (min-width: 1024px) { .a { color: red; } }'],
    ['@media (min-width: 10px) { .a { @media (--lg) { color: red; } } }', '@media (min-width: 10px) and (min-width: 1024px) { .a { color: red; } }'],
    // Negative control: Dart Sass does not merge under `not`, so the inner block stays nested and is rewritten where it is.
    ['@media not print { .a { @media (--lg) { color: red; } } }', '@media not print { @media (min-width: 1024px) { .a { color: red; } } }'],
  ];
  for (const [source, expected] of cases) {
    assert.equal(flat((await viaCompile(source)).css), expected, source);
  }
});

// --- T5 -----------------------------------------------------------------------

test('MIG-B9-30: with uxdsl/postcss alone a directive inside a nested @media (--lg) is UXD_DIRECTIVE_CONTEXT, located', async () => {
  const error = await failure(viaPlugin('.nav {\n  color: red;\n  @media (--lg) {\n    @ds-surface(flat);\n  }\n}'));
  assert.ok(error, 'the plugin alone rejects it');
  assert.match(error.reason, /^UXD_DIRECTIVE_CONTEXT: /);
  assert.deepEqual([error.file, error.line, error.column], [CSS_FROM, 4, 5]);

  // Negative control: the rule inside the block compiles on both paths.
  for (const [label, run] of [['the plugin alone', viaPlugin], ['compile()', viaCompile]]) {
    const { css } = await run('@media (--lg) { .nav { @ds-surface(flat); } }');
    assert.match(css, /@media \(min-width: 1024px\)/, label);
    assert.match(css, /padding: var\(--uxdsl__surface__flat-padding\)/, label);
  }
});

// --- T13 ----------------------------------------------------------------------

test('MIG-B9-30: the reference pass reads a rewritten prelude as the min-width query it is', async () => {
  // The theme's primary.main reads --a, which the stylesheet defines from 800px up.
  const theme = { palette: { primary: { main: 'var(--a)' } } };
  const definition = '@media (min-width: 800px) { :root { --a: red } }\n';
  const consumer = (prelude) => `${definition}@media ${prelude} { .x { color: palette(primary.main) } }`;
  const issues = async (prelude) => {
    const error = await failure(viaPlugin(consumer(prelude), theme));
    return error ? (error.message.match(/UXD_REFERENCE_MISSING/g) || []).length : 0;
  };
  assert.equal(await issues('(--lg)'), 0, 'from 1024px up, --a is defined');
  // Negative controls: from 480px up it is not; a compound prelude matches exactly only, as a literal one does.
  assert.equal(await issues('(--sm)'), 1);
  assert.equal(await issues('print and (--lg)'), 1);
  assert.equal(await issues('print and (min-width: 1024px)'), 1);
});

// --- T7 -----------------------------------------------------------------------

test('MIG-B9-30: a breakpoint where it cannot apply is UXD_BREAKPOINT_CONTEXT: (--xs), @media (--lg) under @keyframes, a bare --lg in @media', async () => {
  const context = async (run, source, theme) => {
    const error = await failure(run(source, theme));
    assert.ok(error, `${source} fails`);
    return error;
  };
  // The base breakpoint has no query, on both paths; the rule follows the width, not the name.
  const base = 'UXD_BREAKPOINT_CONTEXT: (--xs) is the base breakpoint: it has no media query, because its values apply at every width; write these rules outside @media, or remove (--xs) from the condition.';
  const viaPluginBase = await context(viaPlugin, '.a { color: red; }\n@media print and (--xs) { .a { color: blue } }');
  assert.equal(viaPluginBase.reason, base);
  assert.deepEqual([viaPluginBase.line, viaPluginBase.column], [2, 18]);
  const viaCompileBase = await context(viaCompile, '.a { color: red; }\n@media print and (--xs) { .a { color: blue; } }');
  assert.equal(viaCompileBase.reason, base);
  assert.equal(viaCompileBase.line, 2);
  assert.match((await context(viaPlugin, '@media (--XS) { .a { color: red } }')).reason, /^UXD_BREAKPOINT_CONTEXT: \(--XS\) is the base breakpoint/);

  // Under an at-rule that cannot hold a media query.
  const keyframes = await context(viaPlugin, '@keyframes spin {\n  @media (--lg) { from { color: red } }\n}');
  assert.equal(keyframes.reason, 'UXD_BREAKPOINT_CONTEXT: @media (--lg) cannot live inside @keyframes: a media query cannot be nested there; write @media (--lg) around the @keyframes instead.');
  assert.deepEqual([keyframes.line, keyframes.column], [2, 10]);
  assert.match((await context(viaPlugin, '@-webkit-keyframes spin { @media (--lg) { from { color: red } } }')).reason, /cannot live inside @-webkit-keyframes:/);
  // Negative control: a literal query there is left as written, as it was.
  const literal = '@keyframes spin { @media (min-width: 1px) { from { color: red } } }';
  assert.equal((await viaPlugin(literal)).css, literal);

  // A breakpoint name outside parentheses is not a media feature: what Sass prints for an unquoted query in a variable.
  const bare = 'UXD_BREAKPOINT_CONTEXT: --lg in @media --lg is not in parentheses, so it is not a media feature and the block never applies; write (--lg). In Sass, quote a query held in a variable: $query: "(--lg)".';
  const unquoted = await context(viaCompile, '$q: (--lg);\n@media #{$q} { .a { color: red; } }');
  assert.equal(unquoted.reason, bare);
  assert.equal(unquoted.line, 2);
  assert.match((await context(viaPlugin, '@media screen and --lg { .a { color: red } }')).reason, /^UXD_BREAKPOINT_CONTEXT: --lg in @media screen and --lg is not in parentheses/);
  // Negative controls: a quoted query compiles, and a dashed name that is not a breakpoint is left as written.
  assert.equal(flat((await viaCompile('$q: "(--lg)";\n@media #{$q} { .a { color: red; } }')).css), '@media (min-width: 1024px) { .a { color: red; } }');
  assert.equal((await viaPlugin('@media --narrow { .a { color: red } }')).css, '@media --narrow { .a { color: red } }');
});

// --- T10 ----------------------------------------------------------------------

/** As postcss-simple-vars: Declaration and AtRule visitors store `$name: value` and write the value in place of `$name`. */
const variables = ({ resolveNothing = false } = {}) => ({
  postcssPlugin: 'stand-in/variables',
  prepare() {
    const values = new Map();
    const resolve = (text) => text.replace(/\$([\w-]+)/g, (written, name) => (values.has(name) ? values.get(name) : written));
    return {
      Declaration(decl) {
        if (resolveNothing) return;
        if (decl.prop.startsWith('$')) {
          values.set(decl.prop.slice(1), decl.value);
          decl.remove();
        } else if (decl.value.includes('$')) decl.value = resolve(decl.value);
      },
      AtRule(at) {
        if (!resolveNothing && at.params.includes('$')) at.params = resolve(at.params);
      },
    };
  },
});

test('MIG-B9-30: a held $variable in a prelude that also holds (--lg) is judged on the rewritten prelude', async () => {
  const source = '$x: 10px;\n@media (--lg) and (min-width: $x) { .a { color: red } }';
  for (const order of [[variables(), uxdsl()], [uxdsl(), variables()]]) {
    const { css } = await postcss(order).process(source, { from: CSS_FROM });
    assert.equal(css, '@media (min-width: 1024px) and (min-width: 10px) { .a { color: red } }', order[0].postcssPlugin);
  }
  // The plugin alone fails on the $variable, where it is written, as it did.
  const alone = await failure(viaPlugin('@media (--lg) and (min-width: $x) { .a { color: red } }'));
  assert.match(alone.reason, /^UXD_SASS_CONTEXT: \$x is Sass/);
  assert.deepEqual([alone.line, alone.column], [1, 31]);
  // Negative control: a stand-in that resolves nothing leaves the construct, which fails at OnceExit.
  const unresolved = await failure(postcss([uxdsl(), variables({ resolveNothing: true })]).process(source, { from: CSS_FROM }));
  assert.match(unresolved.reason, /^UXD_SASS_CONTEXT: \$x is Sass/);
  assert.deepEqual([unresolved.line, unresolved.column], [1, 1]);
});
