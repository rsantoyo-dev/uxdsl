// `uxdsl/language` — what an editor or a linter needs to understand UXDSL
// source without compiling it: responsive values, tone families, the
// completion metadata and the closed catalog of diagnostic codes.
export {
  resolveResponsiveValue,
  responsiveEntries,
  inspectResponsiveValue,
  validateResponsiveExpression,
  getToneFamilies,
  LANGUAGE_COMPLETIONS,
  KNOWN_CSS_FUNCTIONS,
} from '../language';
export { DIAGNOSTIC_CATALOG, DIAGNOSTIC_CODES } from '../diagnostics';
export type { DiagnosticEntry, DiagnosticOwner } from '../diagnostics';
