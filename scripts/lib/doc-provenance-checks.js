'use strict';

// MIG-B6-02 (FEAT-008): shared detector for FEAT-002's coverage-provenance
// regression test. Extracted from scripts/docs-provenance.test.js so the
// detector itself has direct positive/negative fixture coverage, not just
// an assertion that it currently finds zero violations in the live docs
// (a code-review of that first version pointed out a bare "sin"/"no"
// anywhere on the line was accepted as a qualifying negation — which a line
// like "MIG-07 verifica browser sin limitaciones." would pass even though
// "sin limitaciones" reinforces the claim rather than negating it).
//
// A line only qualifies as NOT a contradiction when it either:
//   - names the actual external gate that provides browser coverage
//     (verify:cssmodules-build / the mig02-nextjs-cssmodules fixture), or
//   - contains one of a fixed set of negation *phrases* actually used in
//     this repo's docs, each pairing a negation with the verb/noun it
//     negates (e.g. "no ejecuta", "does not run", "No headless browser",
//     "no atribuirle") rather than a bare negation word anywhere on the line.
const MIG07_PATTERN = /mig-?07|mig07-consumer/i;
const BROWSER_PATTERN = /\bbrowser\b|navegador/i;

const GATE_REFERENCE_PATTERN = /verify:cssmodules-build|mig02(?:-nextjs-cssmodules)?\b/i;

const NEGATION_PHRASE_PATTERNS = [
  /no\s+(?:ejecuta|abre|prueba|verifica|atribu\w*|abrir)\b/i,
  /does(?:n't| not)\s+(?:run|open|execute|verify)\b/i,
  /\bno\s+headless\b/i,
  /\bnot\s+(?:available|equivalent)\b/i,
  /\bnever\s+(?:opens?|runs?|executes?)\b/i,
  /\bsin\s+(?:ejecutar|abrir|atribuirle)\b/i,
];

/** True when `line` mentions both MIG-07 and browser/navegador without
 * qualifying that mention with a real negation phrase or an explicit
 * reference to the external gate that actually provides browser coverage. */
function isUnqualifiedMig07BrowserClaim(line) {
  if (!MIG07_PATTERN.test(line) || !BROWSER_PATTERN.test(line)) return false;
  if (GATE_REFERENCE_PATTERN.test(line)) return false;
  return !NEGATION_PHRASE_PATTERNS.some(pattern => pattern.test(line));
}

module.exports = { isUnqualifiedMig07BrowserClaim };
