#!/usr/bin/env node
/**
 * Fallback validity check (no browser): parse each case's UXDSL output with
 * css-tree 3.1.0 (which understands CSS Nesting) and validate every
 * declaration's value against css-tree's CSS syntax dictionary. Reports
 * parse errors, unknown at-rules, and declarations whose value does not
 * match the property's grammar — i.e. what a browser would discard.
 *
 *   node csstree-check.js            # the same case list as browser-check.js
 */
const path = require('path');
const REPO = '/Users/ricardosantoyo/Documents/projects/uxdsl';
const { compile } = require(path.join(REPO, 'packages/uxdsl-core/dist/index.js'));
const csstree = require(path.join(REPO, 'packages/playground-nextjs/node_modules/css-tree'));
const CASES = path.join(__dirname, 'cases');

const names = [
  'vars-01-basic',
  'nest-01-basic', 'nest-02-amp-hover', 'nest-03-amp-suffix', 'nest-04-amp-plus-amp',
  'nest-05-parent-amp', 'nest-06-media-inside-rule', 'nest-07-at-root',
  'nest-09-responsive-in-nested', 'nest-10-amp-hover-responsive',
  'vars-03-property-name', 'vars-07-global-flag',
  'mixin-04-uxdsl-fn-param', 'mixin-05-responsive-arg', 'mixin-15-calc-arg',
  'fn-02-darken', 'fn-04-rgba-var', 'fn-05-math-div', 'fn-06-percentage', 'fn-07-if', 'fn-08-unquote',
  'vars-08-map-get', 'vars-09-list-nth',
  'ctrl-06-while', 'ctrl-08-debug-warn',
  'extend-01-placeholder', 'extend-02-class',
  'import-07-forward', 'import-08-use-sass-builtin-only',
  'interp-01-palette',
  'arith-01-slash-div', 'arith-02-string-concat', 'arith-03-unit-mismatch', 'arith-04-mul', 'arith-06-add-vars',
  'modern-11-keyframes-responsive',
];

const KNOWN_AT = new Set(['media', 'supports', 'container', 'layer', 'keyframes', 'font-face', 'property', 'import', 'charset', 'page', 'namespace', 'scope', 'starting-style', 'counter-style', 'font-feature-values']);

(async () => {
  for (const name of names) {
    const entry = path.join(CASES, `${name}.uxdsl`);
    let css;
    try {
      css = (await compile({ entry }, { includeTheme: false })).css.replace(/\n\/\*@uxdsl-bp[\s\S]*$/, '').trim();
    } catch (e) {
      console.log(`${name}: (compile error) ${e.message.split('\n')[0]}`);
      continue;
    }
    const problems = [];
    const ast = csstree.parse(css, {
      positions: true,
      onParseError(err) { problems.push(`parse error: ${err.message}`); },
    });
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        if (!KNOWN_AT.has(node.name)) problems.push(`unknown at-rule @${node.name} (a browser drops it)`);
      },
    });
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        if (node.property.startsWith('--')) return;
        const m = csstree.lexer.matchDeclaration(node);
        if (m.error) problems.push(`invalid value: "${node.property}: ${csstree.generate(node.value)}" -> ${m.error.message.split('\n')[0]}`);
      },
    });
    csstree.walk(ast, {
      visit: 'Raw',
      enter(node) {
        const v = node.value.trim();
        if (v) problems.push(`unparsed raw: ${JSON.stringify(v.slice(0, 60))}`);
      },
    });
    console.log(`${'='.repeat(78)}\n# ${name}\n${css}\n--> ${problems.length ? problems.join('\n--> ') : 'valid per css-tree'}`);
  }
})();
