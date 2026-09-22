// MIG-B6-29 (FEAT-008), phase 4/4 ("paso 9" of the story): the one shared
// Google Fonts encoder, used by both the PostCSS plugin (src/index.ts) and
// the runtime/SSR generator (ds-runtime/theme-generator.ts) so they emit the
// exact same `@import` for the same `theme.fonts.google`. Browser-safe: no
// Node globals, no import of `./config` or `fs`/`path` — see the guard test
// in test/fonts.test.js. Never calls fetch; this only builds URL strings.

// Characters a css2 family spec depends on for its own syntax (family name /
// axis tags / value lists) and must never be percent-encoded: `:` separates
// the family name from its axis spec, `@` separates axis tags from values,
// `,` separates axis tags and separates values within one tuple, `;`
// separates multiple value tuples, `.` and `-`/`_` appear in decimal axis
// values and in real family names. A literal space is encoded as `+`
// (the css2 API's own convention, not `%20`), matching this repo's existing
// playground implementation. Anything else is percent-encoded, one character
// at a time, so an unexpected character can never corrupt a later one.
const CSS2_SAFE_CHAR = /[A-Za-z0-9:@;,._-]/;

/**
 * `encodeURIComponent` alone is not safe here: per spec it leaves
 * `- _ . ! ~ * ' ( )` unescaped, and this value is embedded inside a
 * single-quoted `url('...')` CSS string by both callers — an unescaped `'`
 * would close that string early and corrupt the generated CSS, not just
 * produce a wrong-looking URL. This module's own safe-list is authoritative
 * regardless of what `encodeURIComponent` itself considers safe.
 */
function percentEncodeChar(ch: string): string {
  switch (ch) {
    case "'": return '%27';
    case '(': return '%28';
    case ')': return '%29';
    case '!': return '%21';
    case '~': return '%7E';
    case '*': return '%2A';
    default: return encodeURIComponent(ch);
  }
}

export function encodeGoogleFontFamily(spec: string): string {
  let out = '';
  for (const ch of spec) {
    if (ch === ' ') out += '+';
    else if (CSS2_SAFE_CHAR.test(ch)) out += ch;
    else out += percentEncodeChar(ch);
  }
  return out;
}

/**
 * Builds the full `https://fonts.googleapis.com/css2?...` URL for each entry
 * of an already-resolved `theme.fonts.google` (resolveTheme's own validation
 * guarantees a plain array of non-empty, trimmed strings, or `undefined` —
 * this never re-validates that shape). Order matches the input array; an
 * empty or missing list returns `[]`, emitting nothing, never an empty
 * `@import url('')`.
 */
export function googleFontsImportUrls(google: string[] | undefined): string[] {
  if (!Array.isArray(google)) return [];
  return google.map((family) => `https://fonts.googleapis.com/css2?family=${encodeGoogleFontFamily(family)}&display=swap`);
}
