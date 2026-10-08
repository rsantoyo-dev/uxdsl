/**
 * The SCSS subset UXDSL supports, made explicit — and implemented here.
 *
 * `compile()` reads `.uxdsl` with `postcss-scss`, inlines `@import` with
 * `postcss-import`, and then runs two plugins of this module:
 *
 * - `scssSubset()` expands the subset: `$variables` (block scope, `!default`,
 *   `#{$var}` in selectors, values and at-rule preludes), `@if`/`@else`,
 *   `@each $x in <list>`, `@for $i from a through|to b`, `@mixin`/`@include`
 *   with positional and default arguments (the argument list is split at its
 *   top-level commas, so `@include pad(density(2))` and
 *   `@include pad(xs(1px) md(2px))` work as written), and `@content`.
 *   Anything it cannot evaluate exactly fails, located: an undefined
 *   `$variable` or mixin, a keyword or variadic argument, `@else if`, a
 *   condition with `and`/`or`/`not`, an `@import` inside a block.
 * - `sassLeftoverGuard()` runs after it and fails on anything Sass-only still
 *   in the tree, each error naming the construct and what to write instead:
 *   `UXD_SCSS_UNSUPPORTED`, or `UXD_NESTING_INVALID` for an `&-suffix`
 *   selector native nesting cannot express.
 *
 * Until 1.0 the expansion was `postcss-advanced-variables@3`, which pulls
 * `postcss@7` into every install (an `npm audit` high with no upstream fix)
 * and split mixin arguments at the first parenthesis. This keeps its tree
 * operations — variables live on the container that declares them and are
 * looked up through the parents; a mixin body, an `@each`/`@for` iteration and
 * a content block are cloned and their nodes moved where the at-rule was — so
 * the compiled CSS, whitespace and source positions included, is the same.
 */
import { list } from 'postcss';
import type { AtRule, ChildNode, Container, Declaration, Node, Plugin, Root, Rule } from 'postcss';
import valueParser from 'postcss-value-parser';

import { KNOWN_CSS_FUNCTIONS as CSS_FUNCTIONS } from './language';

const KNOWN_CSS_FUNCTIONS: readonly string[] = CSS_FUNCTIONS;

const PLUGIN = 'uxdsl';

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

/** `name` and `name(args)`, with the arguments split; null when the list does not balance. */
function parseCall(params: string): { name: string; args: string[]; rest: string } | null {
  const text = params.trim();
  const open = text.indexOf('(');
  if (open === -1) return { name: text, args: [], rest: '' };
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) {
      const args = splitArguments(text.slice(open + 1, i));
      if (!args) return null;
      // `m()` has no arguments, and a trailing comma closes the list (`m(a, b,)`).
      if (args.length === 1 && args[0] === '') args.pop();
      else if (args.length > 1 && args[args.length - 1] === '') args.pop();
      return { name: text.slice(0, open).trim(), args, rest: text.slice(i + 1).trim() };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Values: a variable holds a string, a number (an @for counter), or the list or
// map an @each item came from.

type Value = string | number | Value[] | { [key: string]: Value };

const stringify = (value: Value): string => Array.isArray(value)
  ? `(${value.map(stringify).join(',')})`
  : Object(value) === value
    ? `(${Object.keys(value as object).map((key) => `${key}:${stringify((value as Record<string, Value>)[key])}`).join(',')})`
    : String(value);

const WRAPPING_PARENS = /^\(([\W\w]*)\)$/;

/** An `@each` list: `a, b`, `(a, b)`, a map `(a: 1px, b: 2px)` (its values), or one item. */
function listValue(value: string): Value {
  const unwrapped = (WRAPPING_PARENS.test(value) ? value.replace(WRAPPING_PARENS, '$1') : value).replace(/\s*,\s*$/, '');
  const separated = list.comma(unwrapped);
  if (separated[0] === value) return value;
  const objectValue: Record<string, Value> = {};
  const arrayValue: Value[] = [];
  separated.forEach((item, index) => {
    const pair = item.match(/^([\w-]+)\s*:\s*([\W\w]+)\s*$/);
    if (pair) objectValue[pair[1]] = listValue(pair[2]);
    else arrayValue[index] = listValue(item);
  });
  return Object.keys(objectValue).length > 0 ? Object.assign(objectValue, arrayValue) : arrayValue;
}

// ---------------------------------------------------------------------------
// The expansion.

interface MixinDefinition { params: { name: string; value: Value | undefined }[]; rule: AtRule; hasContent: boolean }

/** `$name`, `$(name)` and `#{$name}`, with the character before (a `\` escapes). */
const VARIABLE_REFERENCE = /(.?)(?:\$([A-z][\w-]*)|\$\(([A-z][\w-]*)\)|#\{\$([A-z][\w-]*)\})/g;
const DEFAULT_FLAG = /\s+!default$/;
const VARIABLE_DECLARATION = /^\$[\w-]+$/;
const CONTROL_BLOCKS = new Set(['if', 'else', 'each', 'for', 'mixin']);
const COMPARISONS = new Set(['==', '!=', '<', '<=', '>', '>=']);
const NUMBER_WITH_UNIT = /^(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

function fail(node: Node, message: string, word?: string): Error {
  return node.error(message, word ? { plugin: PLUGIN, word } : { plugin: PLUGIN });
}

function unsupported(node: Node, what: string, instead: string, code = 'UXD_SCSS_UNSUPPORTED') {
  return node.error(`${code}: ${what} is not part of the SCSS subset UXDSL compiles; ${instead}.`, { plugin: PLUGIN });
}

class Expansion {
  /** The variables (and `@mixin name` definitions) a container declares. */
  private readonly scopes = new WeakMap<Node, Map<string, Value | MixinDefinition>>();
  /** A mixin body being expanded -> the @include it expands, for @content. */
  private readonly includes = new WeakMap<Node, AtRule>();

  private lookup(name: string, node: Node | undefined): Value | MixinDefinition | undefined {
    for (let scope: Node | undefined = node; scope; scope = scope.parent as Node | undefined) {
      const value = this.scopes.get(scope)?.get(name);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private declare(node: Node, name: string, value: Value | MixinDefinition): void {
    const isDefault = DEFAULT_FLAG.test(String(value));
    if (isDefault && this.lookup(name, node) !== undefined) return;
    let scope = this.scopes.get(node);
    if (!scope) this.scopes.set(node, (scope = new Map()));
    scope.set(name, isDefault ? String(value).replace(DEFAULT_FLAG, '') : value);
  }

  /** `text` with every variable resolved from the scope of `node`'s parent. */
  private substitute(text: string, node: Node): string {
    return text.replace(VARIABLE_REFERENCE, (match: string, before: string, name1?: string, name2?: string, name3?: string) => {
      if (before === '\\') return match.slice(1);
      const name = (name1 || name2 || name3) as string;
      const value = this.lookup(name, node.parent as Node | undefined);
      if (value === undefined || isMixin(value)) {
        throw fail(node, `UXD_SCSS_UNSUPPORTED: $${name} is not defined where "${text}" uses it; declare it before its use, in the same block or an enclosing one ($variables are block-scoped).`, `$${name}`);
      }
      return `${before}${stringify(value)}`;
    });
  }

  run(root: Root): void {
    this.expandChildren(root);
  }

  private expandChildren(container: Container | Node): void {
    for (const child of [...((container as Container).nodes || [])]) {
      // An @else its @if already consumed.
      if (!child.parent) continue;
      this.expand(child);
      if (child.parent) this.expandChildren(child);
    }
  }

  private expand(child: ChildNode): void {
    if (child.type === 'decl') return this.declaration(child);
    if (child.type === 'rule') { child.selector = this.substitute(child.selector, child); return; }
    if (child.type !== 'atrule') return;
    const name = child.name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(SASS_ONLY_AT_RULES, name)) throw unsupported(child, `@${child.name}`, SASS_ONLY_AT_RULES[name]);
    if (CONTROL_BLOCKS.has(name) && !child.nodes) throw unsupported(child, `@${child.name} without a block`, `write @${child.name} … { … }`);
    switch (name) {
      case 'mixin': return this.mixin(child);
      case 'include': return this.include(child);
      case 'content': return this.content(child);
      case 'if': return this.condition(child);
      case 'else': throw unsupported(child, `@else that does not follow an @if`, 'write @else right after the @if block');
      case 'each': return this.each(child);
      case 'for': return this.for(child);
      case 'import':
        // Root-level imports are postcss-import's: what it leaves (a remote URL) stays as written.
        if (child.parent && child.parent.type !== 'root') throw unsupported(child, `@import inside a block, @if, @each, @for or @mixin`, 'write @import at the top of the file');
        return;
      default:
        child.params = this.substitute(child.params, child);
    }
  }

  private declaration(decl: Declaration): void {
    decl.value = this.substitute(decl.value, decl);
    if (VARIABLE_DECLARATION.test(decl.prop)) {
      this.declare(decl.parent as Node, decl.prop.slice(1), decl.value);
      decl.remove();
    }
  }

  // --- @mixin / @include / @content ------------------------------------------

  private mixin(rule: AtRule): void {
    const call = parseCall(rule.params);
    if (!call || call.rest || !/^[\w-]+$/.test(call.name)) throw unsupported(rule, `@mixin ${rule.params}`, 'write @mixin name or @mixin name($a, $b: default)');
    const params = call.args.map((param) => {
      if (/\.\.\.$/.test(param)) throw unsupported(rule, `the variadic parameter ${param} of @mixin ${call.name}`, 'list the parameters one by one');
      const match = /^\$([\w-]+)\s*(?::\s*([\s\S]+))?$/.exec(param);
      if (!match) throw unsupported(rule, `the parameter "${param}" of @mixin ${call.name}`, 'write a parameter as $name or $name: default');
      return { name: match[1], value: match[2] === undefined ? undefined : this.substitute(match[2].trim(), rule) };
    });
    let hasContent = false;
    rule.walkAtRules((at) => { if (at.name.toLowerCase() === 'content') hasContent = true; });
    this.declare(rule.parent as Node, `@mixin ${call.name}`, { params, rule, hasContent });
    rule.remove();
  }

  private include(rule: AtRule): void {
    const call = parseCall(rule.params) as NonNullable<ReturnType<typeof parseCall>>; // validated by checkIncludes
    if (/\busing\b/.test(call.name) || /^using\b/.test(call.rest)) throw unsupported(rule, `@include … using (content arguments)`, '@content takes no arguments in the subset');
    const mixin = this.lookup(`@mixin ${call.name}`, rule.parent as Node | undefined);
    if (!mixin || !isMixin(mixin)) {
      throw fail(rule, `UXD_SCSS_UNSUPPORTED: the mixin "${call.name}" is not defined where @include uses it; define it with @mixin before the @include, in the same block or an enclosing one.`);
    }
    for (const arg of call.args) {
      if (/^\$[\w-]+\s*:/.test(arg)) throw unsupported(rule, `the keyword argument "${arg}" in @include ${call.name}`, 'pass the arguments by position');
      if (/\.\.\.$/.test(arg)) throw unsupported(rule, `the variadic argument "${arg}" in @include ${call.name}`, 'pass the arguments one by one');
    }
    if (call.args.length > mixin.params.length) {
      throw fail(rule, `UXD_INCLUDE_ARGUMENT: @include ${rule.params} passes ${call.args.length} argument${call.args.length === 1 ? '' : 's'}; @mixin ${call.name} takes ${mixin.params.length}.`);
    }
    if (rule.nodes && rule.nodes.length > 0 && !mixin.hasContent) {
      throw fail(rule, `UXD_INCLUDE_ARGUMENT: @include ${call.name} passes a content block, but @mixin ${call.name} has no @content to place it.`);
    }
    mixin.params.forEach((param, index) => {
      const value = index < call.args.length ? this.substitute(call.args[index], rule) : param.value;
      if (value === undefined) throw fail(rule, `UXD_INCLUDE_ARGUMENT: @include ${rule.params} is missing the argument $${param.name} of @mixin ${call.name}, which has no default.`);
      this.declare(rule, param.name, value);
    });
    const body = mixin.rule.clone();
    body.parent = rule.parent;
    this.includes.set(body, rule);
    const scope = this.scopes.get(rule);
    if (scope) this.scopes.set(body, scope);
    this.expandChildren(body);
    rule.parent!.insertBefore(rule, body.nodes);
    rule.remove();
  }

  private content(rule: AtRule): void {
    if (rule.params.trim()) throw unsupported(rule, `@content(${rule.params.trim().replace(/^\(|\)$/g, '')})`, '@content takes no arguments in the subset');
    let mixinBody: Node | undefined = rule.parent as Node | undefined;
    while (mixinBody && !this.includes.has(mixinBody)) mixinBody = mixinBody.parent as Node | undefined;
    if (!mixinBody) throw unsupported(rule, '@content outside a @mixin', 'use @content inside a @mixin body');
    const block = (this.includes.get(mixinBody) as AtRule).clone();
    block.parent = rule.parent;
    this.expandChildren(block);
    rule.parent!.insertBefore(rule, block.nodes || []);
    rule.remove();
  }

  // --- @if / @else -----------------------------------------------------------

  private condition(rule: AtRule): void {
    const truthy = this.evaluate(rule);
    let next = rule.next();
    while (next && next.type === 'comment') next = next.next();
    const elseRule = next && next.type === 'atrule' && next.name.toLowerCase() === 'else' ? next : undefined;
    if (elseRule && elseRule.params.trim()) {
      throw unsupported(elseRule, `@else ${elseRule.params.trim()}`, /^if\b/.test(elseRule.params.trim()) ? 'write a second @if, or nest one inside @else' : 'write @else { … }');
    }
    if (elseRule && !elseRule.nodes) throw unsupported(elseRule, '@else without a block', 'write @else { … }');
    if (truthy) {
      this.expandChildren(rule);
      rule.parent!.insertBefore(rule, rule.nodes);
    }
    rule.remove();
    if (elseRule) {
      if (!truthy) {
        this.expandChildren(elseRule);
        elseRule.parent!.insertBefore(elseRule, elseRule.nodes);
      }
      elseRule.remove();
    }
  }

  /** Sass truthiness: `false` and `null` are false, every other value is true. */
  private evaluate(rule: AtRule): boolean {
    let params = rule.params.trim();
    // `($a == b)` is `$a == b`; `()` is a value (an empty list, true).
    if (WRAPPING_PARENS.test(params) && params.slice(1, -1).trim() && splitArguments(params.slice(1, -1)) !== null) params = params.slice(1, -1).trim();
    const terms = list.space(params);
    const operand = (term: string) => this.substitute(term, rule).trim();
    if (terms.length === 1) {
      const value = operand(terms[0]);
      if (value === '') throw unsupported(rule, `@if ${rule.params} (its condition is empty)`, 'give @if a value or a comparison');
      return value !== 'false' && value !== 'null';
    }
    if (terms.length !== 3 || !COMPARISONS.has(terms[1])) {
      throw unsupported(rule, terms.length === 0 ? '@if without a condition' : `the condition "${rule.params.trim()}"`, '@if takes one value or one comparison (==, !=, <, <=, >, >=); write nested @if blocks instead of and/or/not');
    }
    const operator = terms[1];
    const left = operand(terms[0]);
    const right = operand(terms[2]);
    if (operator === '==' || operator === '!=') return (interpret(left) === interpret(right)) === (operator === '==');
    const a = NUMBER_WITH_UNIT.exec(left);
    const b = NUMBER_WITH_UNIT.exec(right);
    if (!a || !b || (a[2] && b[2] && a[2].toLowerCase() !== b[2].toLowerCase())) {
      throw unsupported(rule, `the comparison "${left} ${operator} ${right}"`, `${operator} compares numbers, unitless or in the same unit`);
    }
    const x = Number(a[1]);
    const y = Number(b[1]);
    return operator === '<' ? x < y : operator === '<=' ? x <= y : operator === '>' ? x > y : x >= y;
  }

  // --- @each / @for ----------------------------------------------------------

  private each(rule: AtRule): void {
    const match = /^\s*\$([\w-]+)\s+in\s+([\s\S]+)$/.exec(rule.params);
    if (!match) {
      throw unsupported(rule, `@each ${rule.params}`, /^\s*\$[\w-]+\s*,/.test(rule.params) ? 'the subset iterates one variable over a list: @each $item in a, b, c' : 'write @each $item in a, b, c');
    }
    const text = this.substitute(match[2].trim(), rule);
    const raw = listValue(text);
    let items: Value = typeof raw === 'string' ? [raw] : raw;
    // `()` is the empty list: no iteration.
    if (/^\(\s*\)$/.test(text)) items = [];
    // A list without commas is separated by spaces, as in Sass: `@each $s in sm md lg`.
    const inner = WRAPPING_PARENS.test(text) ? text.slice(1, -1) : text;
    if (Array.isArray(items) && items.length === 1 && typeof items[0] === 'string' && (splitArguments(inner) || []).length <= 1) {
      const words = list.space(items[0]);
      if (words.length > 1) items = words;
    }
    this.repeat(rule, match[1], Object.keys(items).map((key) => (items as Record<string, Value>)[key]));
  }

  private for(rule: AtRule): void {
    const match = /^\s*\$([\w-]+)\s+from\s+(\S+)\s+(through|to)\s+(\S+)\s*$/.exec(rule.params);
    if (!match) throw unsupported(rule, `@for ${rule.params}`, 'write @for $i from 1 through 3 (or "to" to leave the end out)');
    const start = Number(this.substitute(match[2], rule));
    const end = Number(this.substitute(match[4], rule));
    if (!Number.isInteger(start) || !Number.isInteger(end)) throw unsupported(rule, `@for ${rule.params} (its bounds are not whole numbers)`, 'write whole numbers, or $variables holding them');
    const step = start <= end ? 1 : -1;
    const values: number[] = [];
    for (let i = start; match[3] === 'through' ? i * step <= end * step : i * step < end * step; i += step) values.push(i);
    this.repeat(rule, match[1], values);
  }

  /** One clone of `rule`'s block per value, with `$name` set to it, expanded in order where `rule` was. */
  private repeat(rule: AtRule, name: string, values: Value[]): void {
    const clones = values.map((value) => {
      this.declare(rule, name, value);
      const clone = rule.clone();
      clone.parent = rule.parent;
      this.scopes.set(clone, new Map(this.scopes.get(rule)));
      return clone;
    });
    const replacements: ChildNode[] = [];
    for (const clone of clones) {
      this.expandChildren(clone);
      replacements.push(...(clone.nodes || []));
    }
    rule.parent!.insertBefore(rule, replacements);
    rule.remove();
  }
}

const isMixin = (value: Value | MixinDefinition | undefined): value is MixinDefinition =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && (value as MixinDefinition).rule !== undefined && Array.isArray((value as MixinDefinition).params);

/** A comparison operand as a boolean, a number, or a string. */
const interpret = (value: string): boolean | number | string =>
  value === 'true' ? true : value === 'false' ? false : isNaN(value as unknown as number) ? value : Number(value);

/**
 * Every `@include` in the stylesheet — expanded or not, inside a mixin or a
 * branch never taken — has an argument list that balances and nothing after
 * it, checked before anything is expanded: `UXD_INCLUDE_ARGUMENT`, located.
 */
function checkIncludes(root: Root): void {
  root.walkAtRules('include', (at: AtRule) => {
    const params = at.params.trim();
    if (params.indexOf('(') === -1) return;
    if (!params.endsWith(')')) {
      throw at.error(`UXD_INCLUDE_ARGUMENT: @include ${params} has text after its argument list; write @include name(arg, arg).`, { plugin: PLUGIN });
    }
    if (!parseCall(params) || parseCall(params)!.rest) throw at.error(`UXD_INCLUDE_ARGUMENT: @include ${params} has unbalanced parentheses; write @include name(arg, arg).`, { plugin: PLUGIN });
  });
}

/** The subset's expansion — see the module comment. */
export function scssSubset(): Plugin {
  return {
    postcssPlugin: 'uxdsl/scss-subset-expand',
    Once(root: Root) {
      checkIncludes(root);
      new Expansion().run(root);
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

/**
 * Fails on anything Sass-only left after the variables plugin ran: a
 * `$variable` or `#{interpolation}` it did not resolve, a `%placeholder` or
 * `@extend`, `!global`, a Sass-only at-rule, a Sass-only function, an
 * `&-suffix` selector, and arithmetic outside `calc()`.
 */
export function sassLeftoverGuard(): Plugin {
  return {
    postcssPlugin: 'uxdsl/scss-subset',
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
