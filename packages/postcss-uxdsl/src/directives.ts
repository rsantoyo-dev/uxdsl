import valueParser from 'postcss-value-parser';
import { closestKey, formatKeyList } from './diagnostics';

// The directive grammar — one for `@ds-surface`, `@ds-button` and `@ds-input`:
//
//   @ds-<family>(role [tone] [size] [radius(k)] [shadow(k)])
//
// and `@ds-typo(role)`. Parentheses directly after the name, arguments
// separated by whitespace, the role first. Letter case does not matter (names
// are lowercase in the theme, so `Contained` is `contained`); whitespace inside
// the parentheses does not matter. Anything else — a comma, a quoted word, a
// second tone, a repeated override, a function that is not an override,
// `!important` — is the family's `_ARGUMENT` error naming the grammar, never a
// guess at what was meant and never text that reaches CSS.

/** The directive names and the family prefix of their diagnostic codes. */
export const DIRECTIVE_FAMILIES: Readonly<Record<string, string>> = Object.freeze({
  'ds-surface': 'SURFACE', 'ds-button': 'BUTTON', 'ds-input': 'INPUT', 'ds-typo': 'TYPO',
});

export const DIRECTIVE_USAGE: Readonly<Record<string, string>> = Object.freeze({
  'ds-surface': '@ds-surface(role [tone] [size] [radius(k)] [shadow(k)])',
  'ds-button': '@ds-button(role [tone] [size] [radius(k)] [shadow(k)])',
  'ds-input': '@ds-input(role [tone] [size] [radius(k)] [shadow(k)])',
  'ds-typo': '@ds-typo(role)',
});

export interface DirectiveArguments { role: string; tone: string; size: string; radius: string; shadow: string }

/** The error class every argument problem of a directive is reported as. */
export function directiveArgumentError(name: string, message: string): Error {
  return new Error(`UXD_${DIRECTIVE_FAMILIES[name]}_ARGUMENT: ${message} Usage: ${DIRECTIVE_USAGE[name]}.`);
}

/**
 * The text between the parentheses of a directive, from how it was written:
 * `params` is what follows the name (PostCSS keeps the parentheses in it) and
 * `afterName` the whitespace between the name and `params`.
 */
export function directiveInner(name: string, params: string, afterName = ''): string {
  const text = params.trim();
  if (/!important/i.test(text)) throw directiveArgumentError(name, `A directive takes no !important; put it on the declarations you write after it.`);
  if (!text) throw directiveArgumentError(name, `Missing arguments: write @${name}(…).`);
  if (!text.startsWith('(') || !text.endsWith(')') || afterName.length > 0) {
    const bare = text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1).trim() : text;
    throw directiveArgumentError(name, `Write @${name}(${bare}), with the parentheses directly after the name.`);
  }
  const inner = text.slice(1, -1);
  // `(a) (b)`: the first `)` closes the directive's own parentheses early.
  let balance = 0;
  for (const ch of inner) {
    if (ch === '(') balance++;
    else if (ch === ')' && --balance < 0) throw directiveArgumentError(name, `Unbalanced parentheses in @${name}${text}.`);
  }
  if (balance !== 0) throw directiveArgumentError(name, `Unbalanced parentheses in @${name}${text}.`);
  return inner;
}

/** The arguments of a directive given as text, with or without the parentheses: `(role tone)` or `role tone`. */
export function directiveArgumentsInner(name: string, input: string): string {
  const text = String(input || '').trim();
  if (text.startsWith('(')) return directiveInner(name, text, '');
  if (/!important/i.test(text)) throw directiveArgumentError(name, 'A directive takes no !important; put it on the declarations you write after it.');
  return text;
}

type Token = { kind: 'word'; value: string } | { kind: 'override'; name: 'radius' | 'shadow'; key: string };

/** Whitespace-separated tokens: bare words and the two override functions. */
function tokenize(name: string, inner: string): Token[] {
  const tokens: Token[] = [];
  for (const node of valueParser(inner).nodes) {
    if (node.type === 'space' || node.type === 'comment') continue;
    if (node.type === 'div') throw directiveArgumentError(name, `Separate the arguments with spaces, not "${node.value.trim()}".`);
    if (node.type === 'string') throw directiveArgumentError(name, `Quoted arguments are not part of the directive grammar; write ${node.value} without quotes.`);
    if (node.type === 'word') {
      if (!/^[\w.-]+$/.test(node.value)) throw directiveArgumentError(name, `"${node.value}" is not a directive argument.`);
      tokens.push({ kind: 'word', value: node.value.toLowerCase() });
      continue;
    }
    if (node.type === 'function') {
      const fn = node.value.toLowerCase();
      const args = node.nodes.filter((child) => child.type !== 'space' && child.type !== 'comment');
      if (fn !== 'radius' && fn !== 'shadow') {
        throw directiveArgumentError(name, `${node.value}(${valueParser.stringify(node.nodes)}) is not a directive argument; a size is a number, and only radius(k) and shadow(k) override a field.`);
      }
      if (args.length !== 1 || args[0].type !== 'word' || !/^[\w-]+$/.test(args[0].value)) {
        throw directiveArgumentError(name, `${fn}(${valueParser.stringify(node.nodes)}) takes exactly one token key.`);
      }
      tokens.push({ kind: 'override', name: fn, key: args[0].value.toLowerCase() });
      continue;
    }
    throw directiveArgumentError(name, `"${valueParser.stringify(node)}" is not a directive argument.`);
  }
  return tokens;
}

/**
 * Parses `role [tone] [size] [radius(k)] [shadow(k)]`. Existence of the role,
 * tone, size and override keys is checked by the caller against the theme;
 * this is the grammar only.
 */
export function parseDirectiveTokens(name: string, inner: string): DirectiveArguments {
  const tokens = tokenize(name, inner);
  if (!tokens.length) throw directiveArgumentError(name, `Missing the role: write @${name}(role …).`);
  const [first, ...rest] = tokens;
  if (first.kind !== 'word' || /^\d+$/.test(first.value)) {
    throw directiveArgumentError(name, `The role comes first; "${first.kind === 'word' ? first.value : `${first.name}(${first.key})`}" is not a role.`);
  }
  const result: DirectiveArguments = { role: first.value, tone: '', size: '', radius: '', shadow: '' };
  for (const token of rest) {
    if (token.kind === 'override') {
      if (result[token.name]) throw directiveArgumentError(name, `Repeated ${token.name}() argument.`);
      result[token.name] = token.key;
    } else if (/^\d+$/.test(token.value)) {
      if (result.size) throw directiveArgumentError(name, `A second size, "${token.value}"; one numeric size selects both Density and Radius.`);
      result.size = token.value;
    } else {
      if (result.tone) throw directiveArgumentError(name, `Extra argument "${token.value}"; one tone (a Palette family) follows the role.`);
      result.tone = token.value;
    }
  }
  return result;
}

/** `@ds-typo(role)`: exactly one word. */
export function parseTypoArguments(inner: string): string {
  const tokens = tokenize('ds-typo', inner);
  if (!tokens.length) throw directiveArgumentError('ds-typo', 'Missing the role: write @ds-typo(role).');
  if (tokens.length > 1 || tokens[0].kind !== 'word') {
    const extra = tokens[1] ? (tokens[1].kind === 'word' ? tokens[1].value : `${tokens[1].name}(${tokens[1].key})`) : `${(tokens[0] as any).name}(${(tokens[0] as any).key})`;
    throw directiveArgumentError('ds-typo', `A typography role is one word; "${extra}" is extra.`);
  }
  return (tokens[0] as { value: string }).value;
}

/** `<code>: "x" is not a tone …`, listing the Palette families that are (`code` is the family's `_TONE` code). */
export function toneError(code: string, tone: string, tones: string[]): Error {
  const suggestion = closestKey(tone, tones);
  return new Error(`${code}: "${tone}" is not a tone; a tone is a Palette family with main, dark and contrast: ${formatKeyList(tones)}.${suggestion ? ` Did you mean "${suggestion}"?` : ''}`);
}
