# FEAT-002 — Unified Typography engine

Status: implemented on `feat/002-unified-typography-engine`; pending review and merge.

## Problem and philosophy

Typography is a responsive text style defined in the theme JSON. Components select
its role; the system defines its behavior. Previously PostCSS ignored
`typography_details`, while the playground emitted its own rules and its editors
interpreted only selected breakpoint names and values. Matching a screenshot did
not guarantee matching the production contract.

## Implemented

- A pure `typography.ts` compiler owns field-to-variable mapping, responsive
  resolution, default-field inheritance and generation.
- PostCSS and `generateThemeCss` consume that same compiler. JSON `spacing` now
  emits the `--space-N` variables used by Typography references.
- Existing `@ds-typo` fallback values are centralized; custom role names and legacy
  flat Typography variables remain available.
- The playground applies the generated theme stylesheet, edits source expressions
  without converting tokens or unitless values to pixels, and uses the shared
  responsive inspector. The Typography editor no longer maintains a separate CSS
  override map. Full theme replacement allows removed fields to disappear.
- Breakpoint editing synchronizes the active theme JSON with runtime thresholds.
- Both Typography documentation entry points reuse one human and AI guide.

## Contract

Input is `typography_details: Record<role, style>`, alongside `spacing`, `fonts`
and `breakpoints`. Each style field is a nonempty string. `default` provides
missing fields to configured roles; an explicit field replaces its default
expression entirely. The latest applicable breakpoint rule persists.

Generation checks role/field names, finite nonnegative distinct breakpoint
widths, and a zero-width base with a value for each responsive field. Supported
fields are exported as `TYPOGRAPHY_PROPERTIES`. Native CSS functions and token
references are preserved, including nested expressions.

For live theme changes, generate first, then replace the managed style element's
textContent. Do not append old and new theme sheets. PostCSS options can explicitly
override the theme breakpoint map.

## Verification

`npm test` covers PostCSS/runtime declaration equivalence, field inheritance,
custom breakpoint names, inspection at threshold ±1px, native expressions,
invalid input and regeneration without retained declarations. Existing Density
and core import tests remain required. Type-check the playground and load both
Typography documentation routes before review.

## Follow-up roadmap

- Publish a versioned theme JSON schema and generate editor field documentation
  and theme-aware completion from the shared contract. The existing VS Code
  extension is not a Typography interpreter and does not yet validate theme JSON.
- Validate unresolved token references and invalid CSS field values, and define
  diagnostics for unknown breakpoint-like functions.
- Formalize accessibility and heading-scale checks separately from compilation.
- Reconcile legacy packaged default typography styles with configurable defaults
  in a compatibility-focused change, rather than silently changing the scale.
- The AI suggestion feature still has product heuristics for heading ordering and
  suggested fonts. These are suggestion constraints, not the language contract;
  generated patches must pass shared validation before application.
- Container-responsive Typography is outside this viewport-based contract.
