import type { Plugin } from 'postcss';
import { TOKEN_FUNCTIONS } from '../language';

// The protect pass: the text transformation that lets UXDSL's own syntax pass
// through Dart Sass unchanged, and the one-line restore of what Sass changes.
//
// Dart Sass reads `palette(primary.main)` as a module member access and fails;
// it passes an unknown function through as plain CSS but evaluates its
// arguments (`space(10-2)` becomes `space(8)`, `space(0-5)` becomes
// `space(-5)`), and since 1.79 it parses `color()` as the CSS Color 4 function
// (`color(white)` and `color(black, 0.5)` are errors). It keeps `$var` literally
// inside an unknown at-rule's parameters, and writes that at-rule with a space
// before its parenthesis (`@ds-surface (contained)`).
//
// So, in one linear scan of the text:
// - every call of a token function (`space density color palette radius border
//   shadow`, case-insensitive) whose first argument is key-like — identifier
//   characters, dots, `#{…}` and `$var`/`ns.$var`, nothing else — is rewritten
//   to `#{"name(key[, arg…])"}`: inside the key `$v` becomes `#{$v}` and
//   `ns.$v` becomes `#{ns.$v}`; a further argument is kept when it is a bare
//   number or already an interpolation and wrapped in `#{…}` otherwise. Sass
//   evaluates the interpolations and emits the call text unquoted, so nothing
//   needs restoring. A first argument that is not key-like (`color(display-p3
//   1 0 0)`, `color(from …)`, `space(2 + 1)`, `space("2")`) is Sass's to
//   evaluate and the call is left as written;
// - inside the parentheses of `@ds-<name>(…)` (whitespace before `(` allowed,
//   parameters may span lines), `$var` and `ns.$var` become `#{$var}` and
//   `#{ns.$var}`;
// - nothing inside a block comment, a line comment, a string or an unquoted
//   `url(…)` is touched, and a parenthesis there does not count;
// - `@function <name>` whose name is a token function, `tone` or one of the
//   reserved names (the effective theme's breakpoints) is reported as a
//   `UXD_FUNCTION_SHADOWED` warning located at the name, and calls to that
//   bare name later in the text are left untouched so Dart Sass calls the
//   author's function (the author's SCSS wins). Sass resolves a function by
//   its exact name with `_` and `-` the same, so `@function Space` shadows
//   nothing. A name defined in another file reaches this pass through
//   `options.unprotected`. A call through a namespace (`helpers.space()`) is
//   never protected. `@mixin` and `@include` names are never calls;
// - the output has exactly as many lines as the input: a rewrite spanning
//   lines re-emits its newlines after the replacement, and the result maps
//   every column of the output back to the input.

/** The token function names, lowercase, from the language's own table. */
export const TOKEN_FUNCTION_NAMES: ReadonlySet<string> = new Set(Object.keys(TOKEN_FUNCTIONS).map((name) => name.toLowerCase()));

/** A `@function` that replaces a UXDSL function in this build: a warning, not an error. */
export interface ProtectProblem {
  code: 'UXD_FUNCTION_SHADOWED';
  message: string;
  /** 1-based line of the function's name in its `@function` declaration. */
  line: number;
  /** 1-based column of the function's name. */
  column: number;
  /** The declared name as Sass resolves it (`_` read as `-`). */
  name: string;
}

export interface ProtectOptions {
  /** Names a project function may shadow besides the token functions and `tone`: the effective theme's breakpoint names. */
  reserved?: Iterable<string>;
  /** Function names defined elsewhere in the build (another loaded file): calls to them are left untouched. */
  unprotected?: Iterable<string>;
  /** The file being protected, for the warning's location. */
  file?: string;
}

export interface ProtectResult {
  /** The text to hand to Sass. */
  code: string;
  /** The column in the source for a column in `code`, both 0-based, on the same line: identical before the first rewrite on that line, shifted after it, the rewrite's own start when inside it. */
  toOriginalColumn(line0: number, column0: number): number;
  /** The shadowing `@function` declarations found, in order of appearance. */
  problems: ProtectProblem[];
}

type Mode = 'general' | 'directive';

interface Edit {
  cStart: number;
  cEnd: number;
  sStart: number;
  sEnd: number;
}

const WHITESPACE = /\s/;
const BARE_NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
/** A character that makes the identifier after it something other than a function call: a class, an id, a variable, a placeholder, an at-rule, a parent reference, an escape. */
const NOT_A_CALL_AFTER = new Set(['.', '#', '$', '%', '@', '&', '\\']);

// --- skippers: indices only, over any text ----------------------------------
function endOfBlockComment(s: string, from: number): number {
  const close = s.indexOf('*/', from + 2);
  return close === -1 ? s.length : close + 2;
}

function endOfLineComment(s: string, from: number): number {
  const close = s.indexOf('\n', from);
  return close === -1 ? s.length : close;
}

/** The index after the closing quote (or at the newline that ends an unterminated string). */
function endOfString(s: string, from: number): number {
  const quote = s[from];
  let k = from + 1;
  while (k < s.length) {
    const c = s[k];
    if (c === '\\') { k += 2; continue; }
    if (c === quote) return k + 1;
    if (c === '\n') return k;
    if (c === '#' && s[k + 1] === '{') { k = endOfInterpolation(s, k); continue; }
    k++;
  }
  return s.length;
}

/** `from` at `#{`: the index after the matching `}`. */
function endOfInterpolation(s: string, from: number): number {
  let depth = 0;
  let k = from + 1;
  while (k < s.length) {
    const c = s[k];
    if (c === '"' || c === "'") { k = endOfString(s, k); continue; }
    if (c === '/' && s[k + 1] === '*') { k = endOfBlockComment(s, k); continue; }
    if (c === '/' && s[k + 1] === '/') { k = endOfLineComment(s, k); continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return k + 1;
    k++;
  }
  return s.length;
}

/** `from` at `(`: the index of the matching `)`, or -1. */
function matchParen(s: string, from: number): number {
  let depth = 0;
  let k = from;
  while (k < s.length) {
    const c = s[k];
    if (c === '"' || c === "'") { k = endOfString(s, k); continue; }
    if (c === '/' && s[k + 1] === '*') { k = endOfBlockComment(s, k); continue; }
    if (c === '/' && s[k + 1] === '/') { k = endOfLineComment(s, k); continue; }
    if (c === '#' && s[k + 1] === '{') { k = endOfInterpolation(s, k); continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return k;
    k++;
  }
  return -1;
}

/** The [from, to) ranges between the top-level commas of [from, to). */
function splitArguments(s: string, from: number, to: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let depth = 0;
  let start = from;
  let k = from;
  while (k < to) {
    const c = s[k];
    if (c === '"' || c === "'") { k = endOfString(s, k); continue; }
    if (c === '/' && s[k + 1] === '*') { k = endOfBlockComment(s, k); continue; }
    if (c === '/' && s[k + 1] === '/') { k = endOfLineComment(s, k); continue; }
    if (c === '#' && s[k + 1] === '{') { k = endOfInterpolation(s, k); continue; }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { ranges.push([start, k]); start = k + 1; }
    k++;
  }
  ranges.push([start, to]);
  return ranges;
}

/** A trimmed argument that is exactly one `#{…}`. */
const isOneInterpolation = (text: string): boolean => text.startsWith('#{') && endOfInterpolation(text, 0) === text.length;

const isIdentStart = (c: string | undefined): boolean => c !== undefined && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_');
const isIdentChar = (c: string | undefined): boolean => c !== undefined && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === '-');
/** Sass treats `_` and `-` as the same character in an identifier. */
const sassName = (name: string): string => name.replace(/_/g, '-');

class Protector {
  /** The scan position. Text between `flushed` and `i` is plain and is written when the next special region or the end flushes it. */
  private i = 0;
  private flushed = 0;
  private readonly out: string[] = [];
  /** Line and line start of `flushed`, in the source. */
  private line = 0;
  private lineStart = 0;
  /** Output column minus source column on the current line (the rewrites so far on it). */
  private delta = 0;
  private readonly edits = new Map<number, Edit[]>();
  private readonly defined = new Set<string>();
  readonly problems: ProtectProblem[] = [];

  constructor(
    private readonly src: string,
    private readonly reserved: ReadonlySet<string>,
    private readonly unprotected: ReadonlySet<string>,
    private readonly file: string | undefined,
  ) {}

  run(): string {
    this.scan(this.src.length, 'general');
    this.copy(this.src.length);
    return this.out.join('');
  }

  toOriginalColumn(line0: number, column0: number): number {
    const edits = this.edits.get(line0);
    if (!edits) return column0;
    let delta = 0;
    for (const edit of edits) {
      if (column0 < edit.cStart) break;
      if (column0 < edit.cEnd) return edit.sStart;
      delta += edit.sEnd - edit.sStart - (edit.cEnd - edit.cStart);
    }
    return column0 + delta;
  }

  // --- the scan -------------------------------------------------------------

  private scan(end: number, mode: Mode): void {
    const s = this.src;
    while (this.i < end) {
      const c = s[this.i];
      if (c === '/') {
        const n = s[this.i + 1];
        if (n === '*') { this.i = Math.min(endOfBlockComment(s, this.i), end); continue; }
        if (n === '/') { this.i = Math.min(endOfLineComment(s, this.i), end); continue; }
        this.i++;
        continue;
      }
      if (c === '"' || c === "'") { this.string(end); continue; }
      if (c === '#') { if (s[this.i + 1] === '{') this.interpolation(end); else this.i++; continue; }
      if (c === '@') { this.atRule(end); continue; }
      if (c === '$') { this.variable(end, mode); continue; }
      if (isIdentStart(c) || (c === '-' && (isIdentStart(s[this.i + 1]) || s[this.i + 1] === '-'))) { this.identifier(end, mode); continue; }
      this.i++;
    }
  }

  /** A string, with its escapes; an interpolation inside it is scanned like any expression. A string ends at a newline, as it does for Sass. */
  private string(end: number): void {
    const s = this.src;
    const quote = s[this.i];
    let k = this.i + 1;
    while (k < end) {
      const c = s[k];
      if (c === '\\') { k += 2; continue; }
      if (c === quote) { k++; break; }
      if (c === '\n') break;
      if (c === '#' && s[k + 1] === '{') {
        this.i = k;
        this.interpolation(end);
        k = this.i;
        continue;
      }
      k++;
    }
    this.i = Math.min(k, end);
  }

  /** `#{…}`: the braces are kept, the expression inside is scanned in general mode. */
  private interpolation(end: number): void {
    const close = Math.min(endOfInterpolation(this.src, this.i), end);
    this.i = Math.min(this.i + 2, end);
    if (close - 1 > this.i) this.scan(close - 1, 'general');
    this.i = close;
  }

  private atRule(end: number): void {
    const s = this.src;
    const start = this.i;
    let j = start + 1;
    while (j < end && isIdentChar(s[j])) j++;
    const lower = s.slice(start + 1, j).toLowerCase();
    if (lower.startsWith('ds-')) {
      let k = j;
      while (k < end && WHITESPACE.test(s[k])) k++;
      if (s[k] === '(') {
        const close = matchParen(s, k);
        if (close !== -1 && close < end) {
          this.i = k + 1;
          this.scan(close, 'directive');
          this.i = close + 1;
          return;
        }
      }
      this.i = j;
      return;
    }
    if (lower === 'function' || lower === 'mixin' || lower === 'include') {
      let k = j;
      while (k < end && WHITESPACE.test(s[k])) k++;
      if (k < end && (isIdentStart(s[k]) || s[k] === '-')) {
        let m = k + 1;
        while (m < end && (isIdentChar(s[m]) || s[m] === '.')) m++;
        if (lower === 'function') this.declaredFunction(k, m);
        this.i = m;
        return;
      }
    }
    this.i = j;
  }

  private declaredFunction(from: number, to: number): void {
    const written = this.src.slice(from, to);
    const name = sassName(written);
    if (!TOKEN_FUNCTION_NAMES.has(name) && name !== 'tone' && !this.reserved.has(name)) return;
    this.defined.add(name);
    this.copy(from);
    const where = this.file ? `${this.file}:${this.line + 1}` : `line ${this.line + 1}`;
    this.problems.push({
      code: 'UXD_FUNCTION_SHADOWED',
      message: `UXD_FUNCTION_SHADOWED: @function ${written} (${where}) replaces UXDSL's ${name}() in this build; rename it to use the token`,
      line: this.line + 1,
      column: from - this.lineStart + 1,
      name,
    });
  }

  private variable(end: number, mode: Mode): void {
    const s = this.src;
    const start = this.i;
    if (!isIdentStart(s[start + 1])) { this.i = start + 1; return; }
    let j = start + 2;
    while (j < end && isIdentChar(s[j])) j++;
    if (mode === 'directive') this.rewrite(start, j, `#{${s.slice(start, j)}}`);
    else this.i = j;
  }

  private identifier(end: number, mode: Mode): void {
    const s = this.src;
    const start = this.i;
    let j = start + 1;
    while (j < end && isIdentChar(s[j])) j++;
    const next = s[j];
    if (next === '(') {
      const prev = start > 0 ? s[start - 1] : undefined;
      const callable = prev === undefined || !(isIdentChar(prev) || NOT_A_CALL_AFTER.has(prev));
      if (callable) {
        const lower = s.slice(start, j).toLowerCase();
        if (lower === 'url') {
          let k = j + 1;
          while (k < end && WHITESPACE.test(s[k])) k++;
          const close = matchParen(s, j);
          if (s[k] !== '"' && s[k] !== "'" && close !== -1 && close < end) { this.i = close + 1; return; }
        } else if (TOKEN_FUNCTION_NAMES.has(lower) && !this.isUnprotected(s.slice(start, j)) && this.protectCall(start, j, end)) {
          return;
        }
      }
    } else if (mode === 'directive' && next === '.' && s[j + 1] === '$' && isIdentStart(s[j + 2])) {
      let k = j + 3;
      while (k < end && isIdentChar(s[k])) k++;
      this.rewrite(start, k, `#{${s.slice(start, k)}}`);
      return;
    }
    this.i = j;
  }

  private isUnprotected(name: string): boolean {
    const resolved = sassName(name);
    return this.defined.has(resolved) || this.unprotected.has(resolved);
  }

  /** Rewrites `name(args)` at [start, …] when its first argument is key-like; returns false, leaving the text alone, otherwise. */
  private protectCall(start: number, paren: number, end: number): boolean {
    const s = this.src;
    const close = matchParen(s, paren);
    if (close === -1 || close >= end) return false;
    const args = splitArguments(s, paren + 1, close);
    const key = this.protectedKey(args[0][0], args[0][1]);
    if (key === null) return false;
    let extras = '';
    for (const [from, to] of args.slice(1)) {
      const raw = s.slice(from, to).trim();
      if (!raw) return false;
      extras += `, ${BARE_NUMBER.test(raw) || isOneInterpolation(raw) ? raw : `#{${raw}}`}`;
    }
    this.rewrite(start, close + 1, `#{"${s.slice(start, paren)}(${key}${extras})"}`);
    return true;
  }

  /** The key with its variables interpolated, or null when the text is not key-like. */
  private protectedKey(from: number, to: number): string | null {
    const s = this.src;
    while (from < to && WHITESPACE.test(s[from])) from++;
    while (to > from && WHITESPACE.test(s[to - 1])) to--;
    if (from === to) return null;
    let result = '';
    let pending = '';
    let k = from;
    while (k < to) {
      const c = s[k];
      if (isIdentChar(c) || c === '.') { pending += c; k++; continue; }
      if (c === '#' && s[k + 1] === '{') {
        const close = endOfInterpolation(s, k);
        if (close > to) return null;
        result += pending + s.slice(k, close);
        pending = '';
        k = close;
        continue;
      }
      if (c === '$' && isIdentStart(s[k + 1])) {
        let j = k + 2;
        while (j < to && isIdentChar(s[j])) j++;
        const variable = s.slice(k, j);
        const namespace = /([A-Za-z_][A-Za-z0-9_-]*)\.$/.exec(pending);
        if (namespace) result += pending.slice(0, -namespace[0].length) + `#{${namespace[1]}.${variable}}`;
        else result += pending + `#{${variable}}`;
        pending = '';
        k = j;
        continue;
      }
      return null;
    }
    return result + pending;
  }

  // --- output and the column map -------------------------------------------

  /** Writes the plain source text up to `to`, tracking the line it ends on. */
  private copy(to: number): void {
    if (to <= this.flushed) return;
    const chunk = this.src.slice(this.flushed, to);
    this.out.push(chunk);
    let k = chunk.indexOf('\n');
    while (k !== -1) {
      this.line++;
      this.lineStart = this.flushed + k + 1;
      this.delta = 0;
      k = chunk.indexOf('\n', k + 1);
    }
    this.flushed = to;
    if (this.i < to) this.i = to;
  }

  /** Replaces the source [start, end) with `text` (no newlines); the newlines of the span are re-emitted after it. */
  private rewrite(start: number, end: number, text: string): void {
    this.copy(start);
    const s = this.src;
    const sStart = start - this.lineStart;
    const cStart = sStart + this.delta;
    const newline = s.indexOf('\n', start);
    if (newline === -1 || newline >= end) {
      this.addEdit(this.line, { cStart, cEnd: cStart + text.length, sStart, sEnd: end - this.lineStart });
      this.delta += text.length - (end - start);
      this.out.push(text);
    } else {
      this.addEdit(this.line, { cStart, cEnd: cStart + text.length, sStart, sEnd: newline - this.lineStart });
      let count = 1;
      let lineStart = newline + 1;
      this.line++;
      let next = s.indexOf('\n', lineStart);
      while (next !== -1 && next < end) {
        this.addEdit(this.line, { cStart: 0, cEnd: 0, sStart: 0, sEnd: next - lineStart });
        lineStart = next + 1;
        this.line++;
        count++;
        next = s.indexOf('\n', lineStart);
      }
      this.addEdit(this.line, { cStart: 0, cEnd: 0, sStart: 0, sEnd: end - lineStart });
      this.lineStart = lineStart;
      this.delta = -(end - lineStart);
      this.out.push(text + '\n'.repeat(count));
    }
    this.flushed = end;
    this.i = end;
  }

  private addEdit(line: number, edit: Edit): void {
    const list = this.edits.get(line);
    if (list) list.push(edit);
    else this.edits.set(line, [edit]);
  }
}

const normalizedSet = (names: Iterable<string> | undefined): ReadonlySet<string> => new Set(Array.from(names || [], sassName));

/** Protects UXDSL's syntax in `source` so Dart Sass passes it through; see the file comment for the rules. */
export function protect(source: string, options: ProtectOptions = {}): ProtectResult {
  const protector = new Protector(source, normalizedSet(options.reserved), normalizedSet(options.unprotected), options.file);
  const code = protector.run();
  return {
    code,
    toOriginalColumn: (line0, column0) => protector.toOriginalColumn(line0, column0),
    problems: protector.problems,
  };
}

/** The `@function` declarations in `source` that shadow a UXDSL function — the same scan as `protect`, for a file Sass loaded (`.scss` included) whose text is not rewritten. */
export function findShadowingFunctions(source: string, options: ProtectOptions = {}): ProtectProblem[] {
  return protect(source, options).problems;
}

/**
 * Dart Sass writes an unknown at-rule with a space between its name and its
 * parenthesis (`@ds-surface (contained)`); the directive grammar wants none.
 * Runs before the UXDSL plugin: both work in `Once`, so plugin order decides.
 */
export const restoreDirectiveSpacing: Plugin = {
  postcssPlugin: 'uxdsl/sass-restore',
  Once(root) {
    root.walkAtRules(/^ds-/i, (atRule) => {
      atRule.raws.afterName = '';
    });
  },
};
