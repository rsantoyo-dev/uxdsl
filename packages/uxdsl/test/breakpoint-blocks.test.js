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
const { compile, DEFAULT_THEME } = require('../dist/entries/index.js');
const { temporaryDirectory } = require('./helpers/temporary-directory');

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

test('MIG-B9-30: a dashed name in a function inside an @media prelude, var(--lg), env(--lg) or theme(--breakpoint-xl), is not a media feature and is left as written, on both paths', async () => {
  const preludes = [
    '(min-width: var(--lg))',
    '(min-width: var(--gutter))',
    '(min-width: calc(100px + var( --xs )))',
    '(min-width: calc(var(--lg) * 1px))',
    '(min-width: env(--lg))',
    '(width >= theme(--breakpoint-xl))',
  ];
  for (const prelude of preludes) {
    const source = `@media ${prelude} { .a { color: red } }`;
    assert.equal((await viaPlugin(source)).css, source, `the plugin alone: ${source}`);
    const compiled = await viaCompile(`@media ${prelude} { .a { color: red; } }`);
    // Dart Sass prints `var( --xs )` as `var(--xs)`; nothing else in these preludes changes.
    assert.ok(compiled.css.startsWith(`@media ${prelude.replace('( --xs )', '(--xs)')} {`), `compile(): ${compiled.css}`);
    assert.deepEqual(compiled.warnings, [], `compile(): ${prelude}`);
  }
  // Control: beside such a function, the media feature (--lg) is still the theme's query, and an unknown one still fails.
  assert.equal((await viaPlugin('@media (--lg) and (max-width: var(--lg)) { .a { color: red } }')).css, '@media (min-width: 1024px) and (max-width: var(--lg)) { .a { color: red } }');
  assert.equal((await failure(viaPlugin('@media (--gutter) and (max-width: var(--gutter)) { .a { color: red } }'))).reason, unknownText('--gutter'));
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

test('MIG-B9-30: with uxdsl/postcss alone a directive inside a nested @media (--lg) is UXD_DIRECTIVE_CONTEXT, located, and the message names the rule-inside form', async () => {
  const error = await failure(viaPlugin('.nav {\n  color: red;\n  @media (--lg) {\n    @ds-surface(flat);\n  }\n}'));
  assert.ok(error, 'the plugin alone rejects it');
  assert.equal(error.reason, 'UXD_DIRECTIVE_CONTEXT: @ds-surface must be a direct child of the rule it styles. To apply a role from a breakpoint up, put the rule inside the block, @media (--md) { .card { @ds-surface(…); } }, which works on both paths (in a .uxdsl file compiled by compile() the block may also be nested in the rule); to change one property, use a responsive value, padding: xs(…) md(…).');
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
  // A theme whose zero-width breakpoint is `base`, with xs at 320px (every default value written over base()): (--base) is the
  // base, and (--xs) is a breakpoint like any other.
  const overBase = (value) => (typeof value === 'string' ? value.replace(/\bxs\(/g, 'base(') : Array.isArray(value) ? value : Object.fromEntries(Object.entries(value).map(([key, each]) => [key, overBase(each)])));
  const baseTheme = { ...overBase(DEFAULT_THEME), breakpoints: { ...DEFAULT_THEME.breakpoints, base: 0, xs: 320 } };
  assert.match((await context(viaPlugin, '@media (--base) { .a { color: red } }', baseTheme)).reason, /^UXD_BREAKPOINT_CONTEXT: \(--base\) is the base breakpoint/);
  assert.equal((await viaPlugin('@media (--xs) { .a { color: red } }', baseTheme)).css, '@media (min-width: 320px) { .a { color: red } }');

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

// --- T8 -----------------------------------------------------------------------

const shadowedText = (written, query, bp = 'lg', theirs = '(min-width: 1024px)', result = query) => `UXD_BREAKPOINT_SHADOWED: @custom-media ${written} ${query} replaces the theme's ${bp}, ${theirs}, in this stylesheet: (--${bp}) compiles to ${result} here, while ${bp}() and stylesheets compiled apart keep the theme's. Remove it to use the theme's ${bp}, or change breakpoints.${bp} in the theme to move it everywhere.`;

test('MIG-B9-30: a project @custom-media --lg replaces the theme\'s lg with one UXD_BREAKPOINT_SHADOWED per definition, located at it, and stays in the output', async (t) => {
  // The plugin alone: the definition stays, (--lg) is the project's query, one warning at the definition.
  const alone = await viaPlugin('@custom-media --lg (min-width: 900px);\n@media (--lg) { .a { color: red } }\n.b { padding: xs(0) lg(1rem); }');
  assert.equal(alone.css, '@custom-media --lg (min-width: 900px);\n@media (min-width: 900px) { .a { color: red } }\n.b { padding: 0; }\n@media (min-width: 1024px){\n.b { padding: 1rem; } }');
  assert.deepEqual(alone.warnings, [shadowedText('--lg', '(min-width: 900px)')]);
  const [warning] = alone.result.warnings();
  assert.deepEqual([warning.line, warning.column], [1, 15]);

  // compile(): the same, with the warning at the author's line; a definition after its use counts.
  const compiled = await viaCompile('.a { color: red; @media (--lg) { color: blue; } }\n@custom-media --lg (min-width: 900px);\n.b { padding: xs(0) lg(1rem); }');
  assert.match(compiled.css, /@media \(min-width: 900px\) \{\n {2}\.a \{\n {4}color: blue;/);
  assert.match(compiled.css, /@custom-media --lg \(min-width: 900px\);/);
  assert.match(compiled.css, /@media \(min-width: 1024px\) \{\n\.b \{\n {2}padding: 1rem;/, 'lg() keeps the theme\'s query');
  assert.deepEqual(compiled.warnings.map((each) => each.text), [shadowedText('--lg', '(min-width: 900px)')]);
  assert.deepEqual([compiled.warnings[0].file, compiled.warnings[0].line], [UXDSL_FROM, 2]);

  // In a @use'd partial, the warning names the partial's file and line.
  const dir = fs.realpathSync(temporaryDirectory('uxdsl-breakpoint-blocks-', t));
  fs.writeFileSync(path.join(dir, '_breakpoints.uxdsl'), '// The project moves lg.\n@custom-media --lg (min-width: 900px);\n');
  const entry = path.join(dir, 'main.uxdsl');
  const partial = await viaCompile("@use 'breakpoints';\n@media (--lg) { .a { color: red; } }\n", {}, entry);
  assert.match(partial.css, /@media \(min-width: 900px\)/);
  assert.deepEqual(partial.warnings.map((each) => [each.text, each.file, each.line]), [[shadowedText('--lg', '(min-width: 900px)'), path.join(dir, '_breakpoints.uxdsl'), 2]]);

  // Any case shadows every spelling; the last of two definitions wins, and each warns.
  const upper = await viaPlugin('@custom-media --LG (min-width: 900px);\n@media (--lg), (--Lg) { .a { color: red } }');
  assert.equal(upper.css, '@custom-media --LG (min-width: 900px);\n@media (min-width: 900px), (min-width: 900px) { .a { color: red } }');
  assert.deepEqual(upper.warnings, [shadowedText('--LG', '(min-width: 900px)')]);
  const twice = await viaPlugin('@custom-media --lg (min-width: 900px);\n@custom-media --lg (min-width: 950px);\n@media (--lg) { .a { color: red } }');
  assert.match(twice.css, /@media \(min-width: 950px\)/);
  // Each definition's warning names what (--lg) compiles to: the last definition's query.
  assert.deepEqual(twice.warnings, [shadowedText('--lg', '(min-width: 900px)', 'lg', '(min-width: 1024px)', '(min-width: 950px)'), shadowedText('--lg', '(min-width: 950px)')]);

  // What the definition becomes: a condition is wrapped inside a compound prelude; a whole list item takes the query as written.
  const substituted = async (definition, prelude) => {
    const { css } = await viaPlugin(`@custom-media --lg ${definition};\n@media ${prelude} { .a { color: red } }`);
    return css.split('\n')[1].replace(/ \{ \.a \{ color: red \} \}$/, '');
  };
  assert.equal(await substituted('(min-width: 900px) and (hover: hover)', 'print and (--lg)'), '@media print and ((min-width: 900px) and (hover: hover))');
  assert.equal(await substituted('not (hover: hover)', 'print and (--lg)'), '@media print and (not (hover: hover))');
  assert.equal(await substituted('((min-width: 900px) or (hover: hover))', 'print and (--lg)'), '@media print and ((min-width: 900px) or (hover: hover))');
  assert.equal(await substituted('screen and (min-width: 900px)', '(--lg)'), '@media screen and (min-width: 900px)');
  assert.equal(await substituted('screen and (min-width: 900px)', '(--lg), print'), '@media screen and (min-width: 900px), print');
  assert.equal(await substituted('true', '(--lg)'), '@media all');
  assert.equal(await substituted('false', '(--lg)'), '@media not all');
  // The warning names the query (--lg) compiles to: `all` for a definition of `true`, `not all` for `false`.
  assert.deepEqual((await viaPlugin('@custom-media --lg true;\n@media (--lg) { .a { color: red } }')).warnings, [shadowedText('--lg', 'true', 'lg', '(min-width: 1024px)', 'all')]);
  assert.deepEqual((await viaPlugin('@custom-media --lg false;\n@media (--lg) { .a { color: red } }')).warnings, [shadowedText('--lg', 'false', 'lg', '(min-width: 1024px)', 'not all')]);

  // The base breakpoint can be given a query too, and its warning says it had none.
  const base = await viaPlugin('@custom-media --xs (min-width: 100px);\n@media (--xs) { .a { color: red } }');
  assert.match(base.css, /@media \(min-width: 100px\)/);
  assert.deepEqual(base.warnings, [shadowedText('--xs', '(min-width: 100px)', 'xs', 'no media query (the base breakpoint)')]);

  // Negative controls: no definition, no warning; a name that is not a breakpoint is the author's; a held
  // Sass construct that fails the compilation takes the warning with it.
  const none = await viaPlugin('@media (--lg) { .a { color: red } }');
  assert.deepEqual([none.css, none.warnings], ['@media (min-width: 1024px) { .a { color: red } }', []]);
  const own = await viaPlugin('@custom-media --narrow (max-width: 400px);\n@media (--narrow) { .a { color: red } }');
  assert.deepEqual([own.css, own.warnings], ['@custom-media --narrow (max-width: 400px);\n@media (--narrow) { .a { color: red } }', []]);
  const held = postcss([uxdsl(), variables({ resolveNothing: true })]).process('@custom-media --lg (min-width: 900px);\n.a { margin: $gap; }', { from: CSS_FROM });
  assert.match(String((await failure(held)).reason), /^UXD_SASS_CONTEXT: \$gap is Sass/);
  assert.deepEqual(held.result.messages.filter((message) => message.type === 'warning'), []);
});

test('MIG-B9-30: a breakpoint where it cannot apply is UXD_BREAKPOINT_CONTEXT: a nested @custom-media --lg the stylesheet uses, a typed project query inside a compound prelude', async () => {
  // A @custom-media inside a rule defines nothing; when the stylesheet uses the name, the override would silently not apply.
  const nested = await failure(viaPlugin('.x { @custom-media --lg (min-width: 1px); }\n@media (--lg) { .a { color: red } }'));
  assert.equal(nested.reason, "UXD_BREAKPOINT_CONTEXT: @custom-media --lg is not at the top level of the stylesheet, where a custom media query is defined; move it out of the rule to replace the theme's lg.");
  assert.deepEqual([nested.line, nested.column], [1, 6]);
  const inMedia = await failure(viaPlugin('@media print { @custom-media --LG (min-width: 1px); }\n@media (--lg) { .a { color: red } }'));
  assert.match(inMedia.reason, /^UXD_BREAKPOINT_CONTEXT: @custom-media --LG is not at the top level of the stylesheet, where a custom media query is defined; move it out of the @media to replace the theme's lg\.$/);
  const viaSass = await failure(viaCompile('.x { @custom-media --lg (min-width: 1px); }\n@media (--lg) { .a { color: red; } }'));
  assert.match(viaSass.reason, /^UXD_BREAKPOINT_CONTEXT: @custom-media --lg is not at the top level/);
  assert.equal(viaSass.line, 1);

  // A query with a media type, a keyword or a list cannot be combined inside another.
  const typed = await failure(viaPlugin('@custom-media --lg screen and (min-width: 900px);\n@media print and (--lg) { .a { color: red } }'));
  assert.equal(typed.reason, 'UXD_BREAKPOINT_CONTEXT: (--lg) stands for screen and (min-width: 900px) in this stylesheet (@custom-media --lg), a query with a media type, a list or a keyword, which cannot be combined inside @media print and (--lg); write the definition as a condition such as (min-width: 900px), or use (--lg) on its own.');
  assert.deepEqual([typed.line, typed.column], [2, 18]);
  for (const definition of ['(min-width: 1px), print', 'true', 'only screen']) {
    assert.match(String((await failure(viaPlugin(`@custom-media --lg ${definition};\n@media print and (--lg) { .a { color: red } }`))).reason), /^UXD_BREAKPOINT_CONTEXT: \(--lg\) stands for /, definition);
  }

  // Negative controls: a lone nested @custom-media with no use is left as written, and a top-level definition beside it wins.
  const lone = '.x { @custom-media --lg (min-width: 1px); }\n@media (--md) { .a { color: red } }';
  assert.equal((await viaPlugin(lone)).css, '.x { @custom-media --lg (min-width: 1px); }\n@media (min-width: 768px) { .a { color: red } }');
  const both = await viaPlugin('@custom-media --lg (min-width: 900px);\n.x { @custom-media --lg (min-width: 1px); }\n@media (--lg) { .a { color: red } }');
  assert.match(both.css, /@media \(min-width: 900px\)/);
});

// --- T6 -----------------------------------------------------------------------

const unknownText = (name, suggestion, usable = '(--sm), (--md), (--lg), (--xl)') => `UXD_BREAKPOINT_UNKNOWN: (${name}) is not a breakpoint of the theme or a @custom-media of this stylesheet; breakpoints usable in @media: ${usable}.${suggestion ? ` Did you mean "${suggestion}"?` : ''}`;

test('MIG-B9-30: an unknown (--name) in @media is UXD_BREAKPOINT_UNKNOWN with the usable breakpoints and a suggestion, on both paths, located', async () => {
  const alone = await failure(viaPlugin('.a { color: red; }\n@media (--lgg) { .a { color: blue } }'));
  assert.equal(alone.reason, unknownText('--lgg', '(--lg)'));
  assert.deepEqual([alone.file, alone.line, alone.column], [CSS_FROM, 2, 8]);
  const compiled = await failure(viaCompile('.a { color: red; }\n@media (--lgg) { .a { color: blue; } }'));
  assert.equal(compiled.reason, unknownText('--lgg', '(--lg)'));
  // Through compile() the Sass stage's map locates the @media rule's line; its column is the rule's.
  assert.deepEqual([compiled.file, compiled.line, compiled.column], [UXDSL_FROM, 2, 1]);

  assert.equal((await failure(viaPlugin('@media (--LGG) { .a { color: red } }'))).reason, unknownText('--LGG', '(--lg)'));
  assert.equal((await failure(viaPlugin('@media (--large) { .a { color: red } }'))).reason, unknownText('--large'));
  assert.equal((await failure(viaPlugin('@media (--xxll) { .a { color: red } }', { breakpoints: { xxl: 1536 } }))).reason, unknownText('--xxll', '(--xxl)', '(--sm), (--md), (--lg), (--xl), (--xxl)'));
  // A stylesheet's own definitions are offered too, as written.
  assert.equal((await failure(viaPlugin('@custom-media --Narrow (max-width: 400px);\n@media (--narrow) { .a { color: red } }'))).reason, unknownText('--narrow', '(--Narrow)'));
  // A nested @media, and one in a list, are read the same way.
  assert.equal((await failure(viaPlugin('.a { @media screen and (--nope), print { color: red } }'))).reason, unknownText('--nope'));

  // Negative control: a name the stylesheet defines is left as written, beside a rewritten breakpoint.
  const defined = await viaPlugin('@custom-media --narrow (max-width: 400px);\n@media (--narrow) and (--md) { .a { color: red } }');
  assert.equal(defined.css, '@custom-media --narrow (max-width: 400px);\n@media (--narrow) and (min-width: 768px) { .a { color: red } }');
  assert.deepEqual(defined.warnings, []);
});

// --- T9 -----------------------------------------------------------------------

/** As postcss-custom-media: its Once collects and removes the top-level definitions, an AtRule visitor resolves the uses. */
const customMedia = ({ resolveNothing = false } = {}) => ({
  postcssPlugin: 'stand-in/custom-media',
  prepare() {
    const queries = new Map();
    return {
      Once(root) {
        root.each((node) => {
          if (node.type !== 'atrule' || node.name !== 'custom-media') return;
          const [, name, query] = /^(--[\w-]+)\s+([\s\S]+)$/.exec(node.params);
          queries.set(name, query);
          node.remove();
        });
      },
      AtRule: {
        media(at) {
          if (!resolveNothing) at.params = at.params.replace(/\(\s*(--[\w-]+)\s*\)/g, (token, name) => (queries.has(name) ? queries.get(name) : token));
        },
      },
    };
  },
});

test('MIG-B9-30: in a PostCSS chain a custom media another plugin resolves is not UXD_BREAKPOINT_UNKNOWN, because it is judged at OnceExit', async () => {
  const own = '@custom-media --narrow (max-width: 400px);\n@media (--narrow) { .a { color: red } }';
  for (const order of [[customMedia(), uxdsl()], [uxdsl(), customMedia()]]) {
    const result = await postcss(order).process(own, { from: CSS_FROM });
    assert.equal(result.css, '@media (max-width: 400px) { .a { color: red } }', order[0].postcssPlugin);
  }
  // uxdsl/postcss first: it sees the project's --lg, warns and applies it, and the other plugin finds nothing left to do.
  const project = '@custom-media --lg (min-width: 900px);\n@media (--lg) { .a { color: red } }';
  const first = await postcss([uxdsl(), customMedia()]).process(project, { from: CSS_FROM });
  assert.equal(first.css, '@media (min-width: 900px) { .a { color: red } }');
  assert.deepEqual(first.warnings().map((warning) => warning.text), [shadowedText('--lg', '(min-width: 900px)')]);
  // The documented caveat: listed after it, uxdsl/postcss never sees the definition the other plugin removed in its Once.
  const after = await postcss([customMedia(), uxdsl()]).process(project, { from: CSS_FROM });
  assert.equal(after.css, '@media (min-width: 1024px) { .a { color: red } }');
  assert.deepEqual(after.warnings(), []);

  // Negative controls: with no plugin to resolve it, or one that removes the definition and resolves nothing, it fails at OnceExit.
  const undefinedName = '@media (--narrow) { .a { color: red } }';
  assert.equal((await failure(postcss([uxdsl()]).process(undefinedName, { from: CSS_FROM }))).reason, unknownText('--narrow'));
  assert.equal((await failure(postcss([customMedia({ resolveNothing: true }), uxdsl()]).process(own, { from: CSS_FROM }))).reason, unknownText('--narrow'));
});

test('MIG-B9-30: an unknown (--name) waiting for OnceExit holds the compilation\'s warnings, and is judged on the stylesheet that reaches the end of the run', async () => {
  // While it waits, what the steps report waits with it: a compilation it fails gives no warning.
  const shadowedAndUnknown = '@custom-media --lg (min-width: 900px);\n@media (--lg) { .a { color: red } }\n@media (--nope) { .a { color: red } }';
  const lazy = postcss([uxdsl()]).process(shadowedAndUnknown, { from: CSS_FROM });
  assert.equal((await failure(lazy)).reason, unknownText('--nope'));
  assert.deepEqual(lazy.result.messages.filter((message) => message.type === 'warning'), []);
  // Control: without the unknown name the same definition's warning is given.
  assert.deepEqual((await viaPlugin(shadowedAndUnknown.replace(/\n@media \(--nope\).*$/, ''))).warnings, [shadowedText('--lg', '(min-width: 900px)')]);

  // A root another plugin replaced cannot be looked in: the first unknown name fails, never silently.
  const replaceRoot = () => ({
    postcssPlugin: 'stand-in/replace-root',
    Once(root, { result }) {
      result.root = postcss.parse(root.toString(), { from: CSS_FROM });
    },
  });
  assert.equal((await failure(postcss([uxdsl(), replaceRoot()]).process('@media (--nope) { .a { color: red } }', { from: CSS_FROM }))).reason, unknownText('--nope'));
  // Control: with no unknown name, the replaced root compiles.
  assert.equal((await postcss([uxdsl(), replaceRoot()]).process('@media (--lg) { .a { color: red } }', { from: CSS_FROM })).css, '@media (min-width: 1024px) { .a { color: red } }');

  // A plugin listed after uxdsl/postcss that adds the definition in its Once is heard.
  const inject = () => ({
    postcssPlugin: 'stand-in/inject-custom-media',
    Once(root) {
      root.prepend(postcss.atRule({ name: 'custom-media', params: '--narrow (max-width: 400px)' }));
    },
  });
  const injected = await postcss([uxdsl(), inject()]).process('@media (--narrow) { .a { color: red } }', { from: CSS_FROM });
  assert.equal(injected.css, '@custom-media --narrow (max-width: 400px); @media (--narrow) { .a { color: red } }');
  // A plugin that removes the at-rule holding the name leaves nothing to judge.
  const remove = () => ({
    postcssPlugin: 'stand-in/remove-media',
    Once(root) {
      root.walkAtRules('media', (at) => {
        if (at.params.includes('--nope')) at.remove();
      });
    },
  });
  assert.equal((await postcss([uxdsl(), remove()]).process('.b { color: red }\n@media (--nope) { .a { color: red } }', { from: CSS_FROM })).css, '.b { color: red }');
});

// --- T11 ----------------------------------------------------------------------

test('MIG-B9-30: the cascade between an @media (--lg) block and lg() on the same property, on both paths', async () => {
  const functionFirst = '.a { padding: xs(0) lg(1rem); @media (--lg) { padding: 2rem; } }';
  const blockFirst = '.a { @media (--lg) { padding: 2rem; } padding: xs(0) lg(1rem); }';
  const literal = (source) => source.replace('(--lg)', '(min-width: 1024px)');
  /** Which value the last rule that applies from 1024px up gives: the one written later wins. */
  const winner = (css) => (css.lastIndexOf('padding: 1rem') > css.lastIndexOf('padding: 2rem') ? 'lg()' : 'block');

  // compile(): source order decides; Dart Sass emits what follows a nested block in a new rule after it.
  const compiledA = (await viaCompile(functionFirst)).css;
  const compiledB = (await viaCompile(blockFirst)).css;
  assert.equal(flat(compiledA), '.a { padding: 0; }@media (min-width: 1024px) {.a { padding: 1rem; } } @media (min-width: 1024px) { .a { padding: 2rem; } }');
  assert.equal(winner(compiledA), 'block');
  assert.equal(flat(compiledB), '@media (min-width: 1024px) { .a { padding: 2rem; } } .a { padding: 0; } @media (min-width: 1024px) { .a { padding: 1rem; } }');
  assert.equal(winner(compiledB), 'lg()');

  // The plugin alone: the block stays nested in its rule and lg()'s @media follows the rule, so lg() wins in both orders.
  const aloneA = (await viaPlugin(functionFirst)).css;
  const aloneB = (await viaPlugin(blockFirst)).css;
  assert.equal(aloneA, '.a { padding: 0; @media (min-width: 1024px) { padding: 2rem; } } @media (min-width: 1024px) {.a { padding: 1rem } }');
  assert.equal(aloneB, '.a { @media (min-width: 1024px) { padding: 2rem; } padding: 0; } @media (min-width: 1024px) {.a { padding: 1rem; } }');
  assert.equal(winner(aloneA), 'lg()');
  assert.equal(winner(aloneB), 'lg()');

  // Negative control: the literal query gives the same four outputs, so the cascade is the one CSS already had.
  assert.equal((await viaCompile(literal(functionFirst))).css, compiledA);
  assert.equal((await viaCompile(literal(blockFirst))).css, compiledB);
  assert.equal((await viaPlugin(literal(functionFirst))).css, aloneA);
  assert.equal((await viaPlugin(literal(blockFirst))).css, aloneB);
});

// --- T12 ----------------------------------------------------------------------

test('MIG-B9-30: with uxdsl/postcss alone a responsive value directly in an @media (--lg) block nested in a rule is UXD_BREAKPOINT_CONTEXT', async () => {
  const source = '.a {\n  color: red;\n  @media (--lg) {\n    padding: xs(1rem) xl(2rem);\n  }\n}';
  const error = await failure(viaPlugin(source));
  assert.equal(error.reason, 'UXD_BREAKPOINT_CONTEXT: a responsive value cannot sit in @media (--lg) nested in a rule with uxdsl/postcss alone: CSS nesting cannot move the block out of the rule. Write the value on the rule (padding: xs(…) lg(…)), put the rule inside a top-level @media (--lg), or compile the file with compile() (a .uxdsl file).');
  assert.deepEqual([error.line, error.column], [4, 5]);
  // The message shows the prelude as the author wrote it.
  assert.match((await failure(viaPlugin('.a { @media print and (--MD) { padding: xs(1rem) xl(2rem); } }'))).reason, /cannot sit in @media print and \(--MD\) nested in a rule .* \(padding: xs\(…\) md\(…\)\), put the rule inside a top-level @media print and \(--MD\),/);

  // Negative controls: through compile() Dart Sass moved the block out of the rule, so the value compiles to valid nested media;
  // a block at the top level, or a value on the rule, compiles with the plugin alone; and the literal nested form keeps its bytes.
  assert.equal(flat((await viaCompile(source)).css), '.a { color: red; } @media (min-width: 1024px) { .a { padding: 1rem; } @media (min-width: 1280px) { .a { padding: 2rem; } } }');
  assert.equal((await viaPlugin('@media (--lg) { .a { padding: xs(1rem) xl(2rem); } }')).css, '@media (min-width: 1024px) { .a { padding: 1rem; } @media (min-width: 1280px) { .a { padding: 2rem; } } }');
  const literal = '.a { color: red; @media (min-width: 1024px) { padding: xs(1rem) xl(2rem); } }';
  assert.equal((await viaPlugin(literal)).css, '@media (min-width: 1280px) { @media (min-width: 1024px) { padding: 2rem; } }.a { color: red; @media (min-width: 1024px) { padding: 1rem; } }');
});
