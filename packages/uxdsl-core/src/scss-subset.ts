/**
 * The SCSS subset UXDSL supports, made explicit.
 *
 * `compile()` runs `postcss-advanced-variables` for `$variables`, `@if/@else`,
 * `@each`, `@for`, `@mixin/@include`, `@content` and `@import`. Everything
 * else Sass has is unsupported — and used to pass through to the browser as
 * text (`&__item` nesting, `darken()`, `10px * 2`, a `%placeholder`), or to be
 * mangled on the way (`@include pad(density(2))` became `padding: densit;`,
 * because the variables plugin splits mixin arguments at the first
 * parenthesis). Two plugins close that:
 *
 * - `includeArguments()` runs *before* the variables plugin and binds every
 *   `@include` argument that contains parentheses to a variable declared
 *   right before the include, so `@include pad(density(2))` and
 *   `@include pad(xs(1px) md(2px))` work as written.
 * - `sassLeftoverGuard()` runs *after* it and fails on anything Sass-only
 *   still in the tree, each error naming the construct and what to write
 *   instead: `UXD_SCSS_UNSUPPORTED`, or `UXD_NESTING_INVALID` for an
 *   `&-suffix` selector native nesting cannot express.
 */
import type { AtRule, Declaration, Node, Plugin, Root } from 'postcss';
import valueParser from 'postcss-value-parser';

const KNOWN_CSS_FUNCTIONS: readonly string[] = require('postcss-uxdsl/language').KNOWN_CSS_FUNCTIONS;

const PLUGIN = 'uxdsl-core';

/** Splits `a, b(c, d), e` at its top-level commas. Returns null when the parentheses do not balance. */
export function splitArguments(text: string): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const ch of text) {
    if (quote) { current += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { if (--depth < 0) return null; }
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (depth !== 0 || quote) return null;
  args.push(current.trim());
  return args;
}

/**
 * `@include name(args)`: every argument that contains parentheses — a token
 * function, a responsive expression, `rgba(…)`, `calc(…)` — is bound to a
 * `$__uxdsl_include_<n>` variable declared right before the include, in the
 * same block, and the include is rewritten to pass the variable. The
 * variables plugin resolves `$name` arguments correctly; it only mishandles
 * nested parentheses. An argument with unbalanced parentheses is
 * `UXD_INCLUDE_ARGUMENT`.
 */
export function includeArguments(): Plugin {
  let counter = 0;
  return {
    postcssPlugin: 'uxdsl-core/include-arguments',
    Once(root: Root) {
      root.walkAtRules('include', (at: AtRule) => {
        const params = at.params.trim();
        const open = params.indexOf('(');
        if (open === -1) return;
        if (!params.endsWith(')')) {
          throw at.error(`UXD_INCLUDE_ARGUMENT: @include ${params} has unbalanced parentheses; write @include name(arg, arg).`, { plugin: PLUGIN });
        }
        const name = params.slice(0, open).trim();
        const args = splitArguments(params.slice(open + 1, -1));
        if (!args) throw at.error(`UXD_INCLUDE_ARGUMENT: @include ${params} has unbalanced parentheses; write @include name(arg, arg).`, { plugin: PLUGIN });
        if (!args.some((arg) => arg.includes('('))) return;
        const rewritten = args.map((arg) => {
          if (!arg.includes('(') || /^\$[\w-]+$/.test(arg) || arg.includes('#{')) return arg;
          const variable = `$__uxdsl_include_${counter++}`;
          at.parent!.insertBefore(at, { prop: variable, value: arg, source: at.source } as any);
          return variable;
        });
        at.params = `${name}(${rewritten.join(', ')})`;
      });
    },
  };
}

const SASS_ONLY_AT_RULES: Record<string, string> = {
  extend: 'write the shared declarations in a mixin and @include it, or use a shared class in the markup',
  use: 'the subset has @import with a path ("./partial") and no modules',
  forward: 'the subset has @import with a path ("./partial") and no modules',
  function: 'the subset has @mixin; compute a value in the theme JSON or with calc()',
  return: 'the subset has @mixin; compute a value in the theme JSON or with calc()',
  while: 'the subset has @for and @each',
  'at-root': 'write the rule at the root of the file',
  debug: 'remove it; the compiler reports its own diagnostics',
  warn: 'remove it; the compiler reports its own diagnostics',
  error: 'remove it; the compiler reports its own diagnostics',
};

// Sass's own value functions. `if()` is left out: CSS has a real `if()` now.
const SASS_ONLY_FUNCTIONS: Record<string, string> = Object.fromEntries([
  ...['darken', 'lighten', 'saturate-color', 'desaturate', 'adjust-hue', 'adjust-color', 'scale-color', 'change-color', 'complement', 'transparentize', 'fade-in', 'fade-out', 'opacify', 'mix', 'grayscale-color', 'ie-hex-str']
    .map((name) => [name, 'use a Palette variant (palette(primary.dark)), an alpha (palette(primary, 0.5)) or color-mix()']),
  ...['map-get', 'map-merge', 'map-keys', 'map-values', 'map-has-key', 'map-remove', 'nth', 'length', 'append', 'join', 'index', 'list-separator', 'set-nth', 'zip']
    .map((name) => [name, 'the subset has no maps or lists; write the value, or define it in the theme JSON']),
  ...['unquote', 'quote', 'str-length', 'str-slice', 'str-index', 'str-insert', 'to-upper-case', 'to-lower-case', 'unique-id']
    .map((name) => [name, 'write the string as it should appear']),
  ...['percentage', 'unit', 'unitless', 'comparable', 'random', 'ceil', 'floor']
    .map((name) => [name, 'use calc(), round(), min(), max() or clamp()']),
  ...['feature-exists', 'variable-exists', 'global-variable-exists', 'function-exists', 'mixin-exists', 'inspect', 'type-of', 'call', 'selector-nest', 'selector-append', 'selector-extend', 'selector-replace', 'is-superselector', 'simple-selectors', 'selector-parse', 'selector-unify']
    .map((name) => [name, 'the subset has no introspection']),
]);

const MATH_FUNCTIONS = new Set(['calc', 'min', 'max', 'clamp', 'round', 'mod', 'rem', 'abs', 'sign', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'pow', 'sqrt', 'hypot', 'log', 'exp']);

function unsupported(node: Node, what: string, instead: string, code = 'UXD_SCSS_UNSUPPORTED') {
  return node.error(`${code}: ${what} is not part of the SCSS subset UXDSL compiles; ${instead}.`, { plugin: PLUGIN });
}

/**
 * Fails on anything Sass-only left after the variables plugin ran: a
 * `$variable` or `#{interpolation}` it did not resolve, a `%placeholder` or
 * `@extend`, `!global`, a Sass-only at-rule, a Sass-only function, an
 * `&-suffix` selector, and arithmetic outside `calc()`.
 */
export function sassLeftoverGuard(): Plugin {
  return {
    postcssPlugin: 'uxdsl-core/scss-subset',
    Once(root: Root) {
      root.walk((node: Node) => {
        if (node.type === 'atrule') {
          const at = node as AtRule;
          const name = at.name.toLowerCase();
          if (Object.prototype.hasOwnProperty.call(SASS_ONLY_AT_RULES, name)) throw unsupported(at, `@${at.name}`, SASS_ONLY_AT_RULES[name]);
          if (name === 'include' && /\$|#\{/.test(at.params)) throw unsupported(at, `@include ${at.params}`, 'the mixin or its arguments were not resolved; check the mixin name and its parameters');
          if (at.params.includes('#{')) throw unsupported(at, `the interpolation in @${at.name} ${at.params}`, 'interpolation (#{…}) is resolved only around a $variable');
          return;
        }
        if (node.type === 'rule') {
          const selector = (node as any).selector as string;
          if (selector.includes('#{')) throw unsupported(node, `the interpolation in "${selector}"`, 'interpolation (#{…}) is resolved only around a $variable');
          if (/(^|[\s,>+~(])%[a-zA-Z_-]/.test(selector)) throw unsupported(node, `the placeholder selector "${selector}"`, 'the subset has no @extend; write the shared declarations in a mixin and @include it');
          if (/&[A-Za-z0-9_-]/.test(selector)) {
            throw node.error(`UXD_NESTING_INVALID: "${selector}" concatenates the parent selector; native CSS nesting cannot (it only nests "&:hover", "& .child", "&.other", ".x &"). Write the full selector, e.g. ".block__item" instead of "&__item".`, { plugin: PLUGIN });
          }
          return;
        }
        if (node.type !== 'decl') return;
        const decl = node as Declaration;
        if (decl.prop.startsWith('$')) throw unsupported(decl, `the variable ${decl.prop}`, 'it was not resolved; a $variable is declared before its use, in the same block or at the root');
        const value = decl.value;
        if (value.includes('#{')) throw unsupported(decl, `the interpolation in "${decl.prop}: ${value}"`, 'interpolation (#{…}) is resolved only around a $variable');
        if (/!global\b/.test(value)) throw unsupported(decl, '!global', 'declare the variable at the root of the file instead');
        if (decl.prop.includes('#{') ) throw unsupported(decl, `the interpolation in the property name "${decl.prop}"`, 'write the property name');
        const parsed = valueParser(value);
        const visit = (nodes: valueParser.Node[], insideMath: boolean) => {
          for (const part of nodes) {
            if (part.type === 'word') {
              if (/^\$[A-Za-z_][\w-]*$/.test(part.value)) throw unsupported(decl, `the variable ${part.value}`, `it is not defined; declare it before "${decl.prop}", in the same block or at the root`);
              if (!insideMath && (part.value === '*' || part.value === '+' || part.value === '-')) {
                throw unsupported(decl, `the arithmetic in "${decl.prop}: ${value}"`, `CSS does not evaluate "${part.value}" outside calc(); write calc(${value})`);
              }
              // Sass division: a length divided by a plain number (`10px / 2`). A slash
              // between two plain numbers or two lengths is CSS (aspect-ratio, grid-area,
              // border-radius), and `font` has its own slash.
            }
            if (part.type === 'div' && part.value === '/' && !insideMath && decl.prop.toLowerCase() !== 'font') {
              const before = nodes[nodes.indexOf(part) - 1], after = nodes[nodes.indexOf(part) + 1];
              if (before && after && before.type === 'word' && after.type === 'word' && /^-?\d*\.?\d+[a-z%]+$/i.test(before.value) && /^-?\d*\.?\d+$/.test(after.value)) {
                throw unsupported(decl, `the division in "${decl.prop}: ${value}"`, `CSS does not divide outside calc(); write calc(${value})`);
              }
            }
            if (part.type !== 'function') continue;
            const fn = part.value.toLowerCase();
            const args = valueParser.stringify(part.nodes).split(',').map((arg) => arg.trim());
            // Sass's `rgba($color, alpha)`/`rgb($color, alpha)`: a color, not channels, as the first argument.
            if ((fn === 'rgba' || fn === 'rgb') && args.length === 2 && /^(#|[a-z]+$)/i.test(args[0]) && !/^[\d.]/.test(args[0])) {
              throw unsupported(decl, `${part.value}(${args.join(', ')})`, `CSS ${fn}() takes channels; write rgb(from ${args[0]} r g b / ${args[1]}), or palette(family, ${args[1]}) for a theme color`);
            }
            // Sass's `if(condition, then, else)`: CSS if() is written with `condition: value; else: value`.
            if (fn === 'if' && args.length === 3 && !args.some((arg) => arg.includes(':'))) {
              throw unsupported(decl, `if(${args.join(', ')})`, 'the subset has @if/@else for conditions; CSS if() is if(style(…): value; else: value)');
            }
            if (Object.prototype.hasOwnProperty.call(SASS_ONLY_FUNCTIONS, fn)) throw unsupported(decl, `${part.value}()`, SASS_ONLY_FUNCTIONS[fn]);
            if (/^[a-z]+\.[a-z-]+$/.test(fn) && !KNOWN_CSS_FUNCTIONS.includes(fn)) throw unsupported(decl, `${part.value}() (a Sass module function)`, 'the subset has no Sass modules; use calc() for math, a Palette variant or color-mix() for color, the value itself for strings and lists');
            visit(part.nodes, insideMath || MATH_FUNCTIONS.has(fn));
          }
        };
        visit(parsed.nodes, false);
      });
    },
  };
}
