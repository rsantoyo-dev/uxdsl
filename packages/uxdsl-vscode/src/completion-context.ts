// MIG-B6-26 (FEAT-008): pure, VS Code-API-free completion context
// detection — testable with plain `node --test`, no extension host. Takes
// all document text from the start up to the cursor (not just the current
// line): a block comment or a declaration's value can start on an earlier
// line, so line-only context is not enough to tell "inside a comment"
// or "inside a value" apart from "inside a selector".
//
// This is a pragmatic heuristic scoped to what completion needs — telling
// a selector, a comment, a string, an `@` directive, inside `@ds-*(...)`,
// and a declaration's value apart — not a general CSS/UXDSL parser. It
// does not track full selector grammar (attribute selectors, `:not()`
// nesting, etc.) beyond what's needed to reject a colon that isn't a
// property separator.

export type CompletionContext =
  | { kind: 'none' }
  | { kind: 'directive' }
  | { kind: 'directive-arguments'; directive: string }
  | { kind: 'value' };

const NONE: CompletionContext = { kind: 'none' };

/** True once an unterminated `/* ... *\/` has been opened anywhere in
 * `text` — CSS/UXDSL block comments don't nest, so the last `/*` and the
 * last `*\/` are enough to tell open from closed. */
function isInsideBlockComment(text: string): boolean {
  const lastOpen = text.lastIndexOf('/*');
  if (lastOpen === -1) return false;
  const lastClose = text.lastIndexOf('*/');
  return lastClose < lastOpen;
}

/** `//` line comments end at the newline, so only the current (last) line
 * matters, and only a `//` outside a string on that line counts. */
function isInsideLineComment(text: string): boolean {
  const line = text.slice(text.lastIndexOf('\n') + 1);
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '/' && line[i + 1] === '/' && !inSingle && !inDouble) return true;
  }
  return false;
}

/** An odd number of unescaped quotes of one kind on the current line means
 * the cursor is inside an unterminated string of that kind. Strings don't
 * span lines in CSS/UXDSL (an unescaped newline ends them), so, unlike
 * block comments, only the current line is relevant. */
function isInsideString(text: string): boolean {
  const line = text.slice(text.lastIndexOf('\n') + 1);
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\') { i++; continue; } // Skip an escaped character entirely.
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
  }
  return inSingle || inDouble;
}

/** The text since the start of the *current* statement — the most recent
 * `{`, `}` or `;` at the same nesting depth as the cursor, tracked by
 * brace-depth so a nested rule's own `{`/`}`/`;` don't reset the outer
 * statement's start. Comments/strings are stripped first so a brace or
 * semicolon inside either is never mistaken for real UXDSL/CSS structure. */
function currentStatement(text: string): string {
  const stripped = stripCommentsAndStrings(text);
  let depth = 0;
  let start = 0;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '{') { depth++; start = i + 1; }
    else if (ch === '}') { depth = Math.max(0, depth - 1); start = i + 1; }
    else if (ch === ';' && depth >= 0) { start = i + 1; }
  }
  return stripped.slice(start);
}

/** Replaces every comment/string with same-length whitespace — preserves
 * character offsets (irrelevant here, since only the trailing shape is
 * read) while guaranteeing brace-counting above never looks inside one. */
function stripCommentsAndStrings(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (text[i] === "'" || text[i] === '"') {
      const quote = text[i];
      let j = i + 1;
      while (j < text.length && text[j] !== quote) j += text[j] === '\\' ? 2 : 1;
      const stop = Math.min(j + 1, text.length);
      out += ' '.repeat(stop - i);
      i = stop;
    } else {
      out += text[i];
      i++;
    }
  }
  return out;
}

// A real property/custom-property name — never a selector fragment: no
// `.`, `#`, `&`, `[`, `:`, combinators or pseudo-syntax before the colon.
const PROPERTY_VALUE_RE = /^\s*(--[\w-]+|[a-zA-Z-]+)\s*:(?!:)([^:;{}]*)$/;

export function getCompletionContext(textBeforeCursor: string): CompletionContext {
  if (isInsideBlockComment(textBeforeCursor) || isInsideLineComment(textBeforeCursor) || isInsideString(textBeforeCursor)) {
    return NONE;
  }

  // Inside `@ds-xxx(...)`: only within THIS statement, and only up to the
  // matching close paren (an already-closed call earlier in the same
  // statement must not still offer role/tone/size completions for it).
  const stmt = currentStatement(textBeforeCursor);
  const directiveArgs = /@(ds-[a-zA-Z0-9-]+)\(([^()]*)$/.exec(stmt);
  if (directiveArgs) return { kind: 'directive-arguments', directive: directiveArgs[1] };

  // `@` alone (optionally with a partial name already typed) suggests a
  // directive — but not once `(` has been reached (handled above) or once
  // arguments are already closed.
  if (/@[a-zA-Z0-9-]*$/.test(stmt)) return { kind: 'directive' };

  // A real property's value — text since its own `:` (not a pseudo-class/
  // pseudo-element's, rejected by PROPERTY_VALUE_RE requiring a bare
  // property-shaped identifier immediately before the colon).
  if (PROPERTY_VALUE_RE.test(stmt)) return { kind: 'value' };

  return NONE;
}
