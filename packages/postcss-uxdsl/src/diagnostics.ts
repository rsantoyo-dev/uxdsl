import type { Node } from 'postcss';

const CODE_PATTERN = /^(UXD_[A-Z0-9_]+):/;

// This is deliberately a catalog of emitted diagnostic identifiers, including
// the prefixes expanded by the preset and control engines. The source guard in
// test/diagnostics-catalog.test.js prevents a new code from bypassing it.
export const DIAGNOSTIC_CODES = new Set([
  'UXD_THEME_INVALID', 'UXD_SPACING_KEY', 'UXD_SPACING_COLLISION', 'UXD_FOUNDATION_NAME_COLLISION',
  'UXD_BP_INVALID', 'UXD_VALUE',
  'UXD_DENSITY_MAP', 'UXD_DENSITY_VALUE', 'UXD_DENSITY_KEY', 'UXD_DENSITY_BASE', 'UXD_DENSITY_REFERENCE',
  'UXD_TYPO_TOKEN', 'UXD_TYPO_BP', 'UXD_TYPO_DETAILS', 'UXD_TYPO_ROLE', 'UXD_TYPO_FIELD', 'UXD_TYPO_BASE', 'UXD_TYPO_NAME_COLLISION',
  'UXD_TOKEN_KEY', 'UXD_TOKEN_ALPHA', 'UXD_EDGE_REFERENCE', 'UXD_SHADOW_REFERENCE',
  'UXD_SURFACE_MAP', 'UXD_SURFACE_ROLE', 'UXD_SURFACE_FIELD', 'UXD_SURFACE_REFERENCE', 'UXD_SURFACE_TONE', 'UXD_SURFACE_SIZE', 'UXD_SURFACE_ARGUMENT', 'UXD_SURFACE_VIEWPORT',
  'UXD_REFERENCE_MISSING', 'UXD_REFERENCE_CYCLE', 'UXD_REFERENCE_CONTEXT',
  ...['UXD_PRESET', 'UXD_EDGE', 'UXD_SHADOW', 'UXD_SURFACE'].flatMap(prefix => ['ALPHA', 'MAP', 'VALUE', 'BP', 'BASE', 'NAME_COLLISION', 'VIEWPORT'].map(suffix => `${prefix}_${suffix}`)),
  ...['UXD_BUTTON', 'UXD_INPUT'].flatMap(prefix => ['ALPHA', 'MAP', 'ROLE', 'FIELD', 'FIELDS', 'SURFACE', 'STATES', 'STATE', 'VALUE', 'BP', 'BASE', 'NAME_COLLISION', 'ARGUMENT', 'VIEWPORT'].map(suffix => `${prefix}_${suffix}`)),
]);

export function diagnostic(message: string, word?: string): Error {
  const error = new Error(message);
  if (word) (error as any).word = word;
  return error;
}

export function themeError(code: string, message: string, keyPath: string): Error {
  const error = diagnostic(`${code}: ${message} (at ${keyPath}).`);
  (error as any).keyPath = keyPath;
  return error;
}

export function diagnosticCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return error.message.match(CODE_PATTERN)?.[1];
}

export function locateError(error: unknown, node: Node | undefined): unknown {
  if (!(error instanceof Error) || !diagnosticCode(error) || (error as any).keyPath || error.name === 'CssSyntaxError' || error.name === 'ReferenceIntegrityError') {
    return error;
  }

  let located: any = node;
  while (located && !(located.source?.input && located.source.start)) located = located.parent;
  if (!located) return error;

  const wrapped: any = located.error(error.message, {
    plugin: 'postcss-uxdsl',
    ...((error as any).word ? { word: (error as any).word } : {}),
  });
  wrapped.cause = error;
  return wrapped;
}

export function formatKeyList(keys: Iterable<string>): string {
  const all = Array.from(new Set(Array.from(keys, String)));
  const numeric = all.filter(key => /^\d+$/.test(key)).map(Number).sort((left, right) => left - right);
  const named = all.filter(key => !/^\d+$/.test(key)).sort();
  const parts: string[] = [];
  for (let index = 0; index < numeric.length;) {
    let end = index;
    while (end + 1 < numeric.length && numeric[end + 1] === numeric[end] + 1) end++;
    if (end - index >= 2) parts.push(`${numeric[index]}–${numeric[end]}`);
    else for (let current = index; current <= end; current++) parts.push(String(numeric[current]));
    index = end + 1;
  }
  return [...parts, ...named].join(', ') || '(none)';
}

function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column++) rows[0][column] = column;
  for (let row = 1; row <= left.length; row++) {
    for (let column = 1; column <= right.length; column++) {
      const substitution = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + substitution,
      );
    }
  }
  return rows[left.length][right.length];
}

export function closestKey(key: string, keys: Iterable<string>): string | undefined {
  let closest: string | undefined;
  let distance = 3;
  for (const candidate of Array.from(keys)) {
    const candidateDistance = editDistance(key.toLowerCase(), candidate.toLowerCase());
    if (candidateDistance > 2 || candidateDistance >= distance) continue;
    closest = candidate;
    distance = candidateDistance;
  }
  return closest;
}

export function missingKeyMessage(code: string, functionName: string, key: string, keys: Iterable<string>): string {
  const available = Array.from(keys, String);
  const suggestion = /^\d+$/.test(key) ? undefined : closestKey(key, available);
  return `${code}: ${functionName}(${key}) does not exist; available keys: ${formatKeyList(available)}.${suggestion ? ` Did you mean "${suggestion}"?` : ''}`;
}