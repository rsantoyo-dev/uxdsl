#!/usr/bin/env node
/**
 * Option (a) probe: Dart Sass FIRST, then the real UXDSL compile() on Sass's
 * output — exactly what vite-plugin-uxdsl's opt-in `scss: 'on'` pre-pass does.
 * Shows which UXDSL syntax survives a Sass pass, and which Sass rejects.
 *
 *   node run-two-stage.js
 */
const path = require('path');
const REPO = '/Users/ricardosantoyo/Documents/projects/uxdsl';
const { compile } = require(path.join(REPO, 'packages/uxdsl-core/dist/index.js'));
const sass = require(path.join(REPO, 'packages/playground-nextjs/node_modules/sass'));
const FROM = path.join(__dirname, 'cases', 'two-stage.uxdsl');

const cases = {
  // UXDSL token syntax through Sass
  'ts-01 responsive fn': `.a { padding: xs(1px) md(2px); }`,
  'ts-02 palette dot (documented form)': `.a { color: palette(primary.main); }`,
  'ts-03 palette hyphen form': `.a { color: palette(primary-main); }`,
  'ts-04 palette quoted': `.a { color: palette("primary.main"); }`,
  'ts-05 palette interp-quoted': `.a { color: palette(#{"primary.main"}); }`,
  'ts-06 palette plain': `.a { color: palette(primary); }`,
  'ts-07 density + space in responsive': `.a { gap: density(2); padding: xs(space(1)) md(space(2)); }`,
  'ts-08 @ds-surface (Sass inserts a space)': `.a { @ds-surface(contained); }`,
  'ts-09 @ds-button 3 args': `.a { @ds-button(contained primary 2); }`,
  'ts-10 @ds-typo': `.a { @ds-typo(h1); }`,
  'ts-11 @ds-* arg from $var (no interp)': `$t: primary;\n.a { @ds-button(contained $t); }`,
  'ts-12 @ds-* arg from $var (interp)': `$t: primary;\n.a { @ds-button(contained #{$t}); }`,
  'ts-13 palette(#{$t}.main)': `$t: primary;\n.a { color: palette(#{$t}.main); }`,
  'ts-14 palette(#{$t}-main)': `$t: primary;\n.a { color: palette(#{$t}-main); }`,
  'ts-15 $var holding responsive expr': `$pad: xs(1px) md(2px);\n.a { padding: $pad; }`,
  'ts-16 $var holding palette dot': `$c: palette(primary.main);\n.a { color: $c; }`,
  'ts-17 mixin arg density()': `@mixin pad($p) { padding: $p; }\n.a { @include pad(density(2)); }`,
  'ts-18 mixin arg responsive': `@mixin pad($p) { padding: $p; }\n.a { @include pad(xs(1px) md(2px)); }`,
  'ts-19 nesting & responsive + directive': `.a { @ds-surface(contained); &:hover { padding: xs(1px) md(2px); } &-suffix { color: red; } }`,
  'ts-20 Sass math + UXDSL': `@use "sass:math";\n.a { width: math.div(100%, 3); padding: density(2); }`,
  'ts-21 darken on a palette token': `.a { color: darken(palette(primary), 10%); }`,
  'ts-22 calc with space()': `.a { width: calc(100% - space(2)); }`,
  'ts-23 responsive value inside Sass @media nesting': `.a { @media (min-width: 600px) { padding: xs(1px) md(2px); } }`,
  'ts-24 keyword mixin args + @ds-typo in @content': `@mixin wrap($sel: '.inner') { #{$sel} { @content; } }\n.a { @include wrap($sel: '.title') { @ds-typo(h1); } }`,
  'ts-25 unit arithmetic with rem+px': `.a { width: 1rem + 2px; }`,
  'ts-26 @extend + placeholder': `%base { color: red; }\n.a { @extend %base; padding: density(2); }`,
};

(async () => {
  for (const [name, src] of Object.entries(cases)) {
    console.log(`\n${'='.repeat(78)}\n# ${name}\n${'-'.repeat(78)}\n${src}`);
    let sassCss;
    try {
      sassCss = sass.compileString(src, { syntax: 'scss', logger: sass.Logger.silent }).css.trim();
      console.log(`\n--- after Dart Sass ---\n${sassCss || '(empty)'}`);
    } catch (e) {
      console.log(`\n--- Dart Sass ERROR ---\n${String(e.message).split('\n')[0]}`);
      continue;
    }
    try {
      const { css } = await compile({ source: sassCss, from: FROM }, { includeTheme: false });
      console.log(`\n--- then UXDSL (OK) ---\n${css.replace(/\n\/\*@uxdsl-bp[\s\S]*$/, '').trim() || '(empty)'}`);
    } catch (e) {
      console.log(`\n--- then UXDSL ERROR ---\n${String(e.message).split('\n')[0]}`);
    }
  }
})();
