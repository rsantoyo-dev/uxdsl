# FEAT-001 — Unified UXDSL Language Engine

| Field | Value |
| --- | --- |
| Type | Architecture feature / roadmap epic |
| Status | In progress — initial shared Density foundation implemented; acceptance gates remain open |
| Priority | P0: foundation before new language features |
| Owner | Ricardo Santoyo; implementation owners TBD |
| Baseline | Local repository revision `699f72b7ba869acd74ec77708576e836032d287f` |
| Target release | TBD after compatibility inventory; no release commitment |

## Objective

Make PostCSS, runtime, playground and VS Code consume the same UXDSL semantics. A theme and expression must have the same meaning, token references and diagnostics in every supported environment.

Preserve UXDSL's defining capabilities: clean component markup, responsive Density built on spacing, configurable themes, and live updates including regenerated breakpoint rules. This feature consolidates existing behavior; it does not redesign the language or promise replacement of Tailwind.

## Evidence and current limitations

These findings come from source inspection, not a browser or production validation run. The following links are relative to this document.

| Area | Observed implementation | Consequence |
| --- | --- | --- |
| Compiler | [PostCSS index](../../packages/postcss-uxdsl/src/index.ts) owns `resolveValueForBp`, `rewriteFuncs`, token emission and process-global Density state | Semantics are embedded in an adapter; compilation isolation needs tests |
| Core | [Core processor](../../packages/uxdsl-core/src/index.ts) resolves files/imports and invokes PostCSS | Existing `uxdsl-core` is a Node orchestration layer, not a browser-safe semantic engine |
| Runtime | [Runtime](../../packages/postcss-uxdsl/src/ds-runtime/index.ts) normalizes and updates tokens independently | Naming, dependencies and responsive behavior require parity checks |
| Playground | [RussianDoll](../../packages/playground-nextjs/src/components/RussianDoll.tsx) owns defaults, parsing and CSS generation | Demo behavior can drift from production compilation |
| Breakpoints | [DensityPlayground](../../packages/playground-nextjs/src/components/DensityPlayground.tsx) declares its own breakpoint map | Explicit demo overrides must be distinguished from canonical defaults |
| Editor | [VS Code extension](../../packages/uxdsl-vscode/src/extension.ts) maintains handwritten completions | Accepted syntax and suggested syntax can diverge |
| Metadata | [Theme manifest](../../packages/postcss-uxdsl/src/theme/theme-manifest.json) declares Density 1–5; defaults declare 1–15; demo exposes 1–14 | Metadata does not consistently describe the active token set |
| Numeric parsing | Compiler uses `parseInt` for Density identifiers | `density(0.5)` can silently become a different token; acceptance policy remains a decision |

Code with no obvious demo usage is not necessarily dead: public exports, package entrypoints, generated files and external consumers must be considered before removal.

## Proposal review: architectural corrections

1. **Separate language rules from theme data.** The language defines syntax and supported families; the active theme defines available tokens and breakpoint values. A default range is not a language-wide maximum.
2. **Preserve references.** Do not permanently flatten `space(4)` to pixels during resolution. Retain the reference and emit `var(--space-4)` so live spacing changes propagate. Computing a preview value is a separate inspection operation.
3. **Metadata cannot implement semantics.** Generate schema, completions and reference tables from a registry, but every advertised function also needs a real handler and contract tests. Adding a registry entry alone must not advertise a working feature.
4. **Equivalence is semantic, not necessarily byte-for-byte.** PostCSS and runtime may serialize differently; compare declarations, conditions, cascade and browser-computed behavior. Require deterministic output within each emitter.
5. **Container support is not proven by emitting `@container`.** Verify an actual query-container ancestor, scoping and behavior at container boundaries in browser tests.
6. **Extract incrementally.** Capture existing valid behavior before replacing it. Record intentional fixes separately rather than freezing known defects as the desired contract.

## Technical requirements

- Browser-safe TypeScript semantic module: no `fs`, DOM, React, VS Code or Node-only imports. A browser-safe parsing dependency is acceptable after bundle verification.
- Explicit per-compilation context: theme, breakpoint map, token registry, source locations and diagnostic policy; no mutable process-global semantic caches.
- Shared parsing, normalization, reference validation, dependency resolution and responsive interpretation.
- Shared CSS variable naming and rule representation; adapters only perform environment-specific integration.
- Preserve existing public imports through compatibility exports during migration; avoid dependency cycles.
- Deterministic artifacts generated from one language registry and one default-theme source.
- Unknown UXDSL references produce structured diagnostics; ordinary CSS remains supported without treating every unknown CSS function as a UXDSL error.
- Runtime validates and prepares a complete update before applying it; a rejected update retains the last valid theme.
- No undocumented changes to defaults, cascade, breakpoint boundaries or CSS variable names.

## Scope

### Included

Inventory of engines and exports; shared language foundation; space/Density/responsive vertical slice; remaining token families and directives; runtime alignment; generated editor metadata; parity tests; removal of verified duplicates after migration.

### Excluded

New syntax such as semantic Density identifiers unless approved separately; redesign of the demo; new framework integrations; Tailwind migration tooling; a full language server; new component features; npm publishing or production deployment.

## Target ownership

Proposed module/package name: `uxdsl-language`. Confirm packaging in phase 0. Keep it internal in intent, but if published adapters depend on it, it must be bundled or made installable before release; a private unresolved dependency is not acceptable.

| Consumer | Owns | Must not own |
| --- | --- | --- |
| Shared language module | Registry, parsing, validation, references, responsive model, diagnostics, naming | DOM, filesystem traversal, editor APIs |
| PostCSS | AST traversal, source mapping and insertion of generated rules | Independent token semantics |
| Existing core / CLI / Vite / Webpack | File resolution, imports, build/watch orchestration | Copied parsers or fallback defaults that drift |
| Runtime | Scoped application, persistence, subscriptions and lifecycle | Alternative interpretation of expressions |
| Playground | Editing, visualization and explicit example themes | Demo-only semantic engines |
| VS Code | Completion presentation and diagnostic mapping | Handwritten inventories contradicting the registry |

## Process flow

1. Load source and theme through the host adapter.
2. Parse expressions and preserve source spans.
3. Normalize the theme and validate references using an explicit context.
4. Resolve dependencies and responsive rules into a reference-preserving intermediate model.
5. Emit CSS/rule data for build or runtime; expose inspection data and diagnostics to tooling.
6. Apply only valid runtime output; display diagnostics without modifying the active theme on failure.

## Implementation details

Suggested shared concepts, not a frozen public API:

```ts
type TokenReference = { family: string; name: string };
type ResponsiveEntry = {
  breakpoint: string;
  value: TokenReference | { css: string };
};
type Diagnostic = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  sourcePath?: string;
  start?: number;
  end?: number;
};
```

The first fixture should describe `density(4)` referencing `space(4)`, `space(5)` and `space(6)` across configured breakpoints. Its compiled model must retain those references. Changing spacing updates dependent values; changing breakpoint thresholds regenerates the affected rules.

Generate manifest, JSON Schema and editor metadata with a deterministic command. A check-only mode must fail CI when committed artifacts differ. Token suggestions come from the resolved project theme, with defaults used only when appropriate.

For runtime, preserve existing helpers as wrappers over the shared validation/resolution path. Define scope ownership, stylesheet replacement, subscriptions, cleanup and persistence timing. Persist and notify success only after a successful application. Do not mutate unrelated stylesheets.

## Roadmap and implementation backlog

The implementation record below identifies partial progress. No phase is complete until its full exit gate passes. Each phase can become one or more GitHub issues/PRs; no remote issues or PRs have been created.

| ID | Priority | Deliverable | Depends on | Exit gate |
| --- | --- | --- | --- | --- |
| ENG-00 | P0 | Baseline inventory and architecture decisions | — | Supported exports, syntax, defaults and known divergences recorded; characterization fixtures run |
| ENG-01 | P0 | Shared module, registry, defaults and context | ENG-00 | Node/browser import checks pass; compatibility exports work; no dependency cycles |
| ENG-02 | P0 | Shared space/Density/responsive implementation | ENG-01 | Compiler and runtime fixtures pass; identifiers are never silently truncated |
| ENG-03 | P0 | Density playground and editor alignment | ENG-02 | No local Density parser/default copies; token UI reflects active theme; browser parity passes |
| ENG-04 | P1 | Remaining token families | ENG-03 | Palette/color/radius/shadow/border and existing typography/motion paths inventoried and migrated where supported |
| ENG-05 | P1 | Existing component directives | ENG-04 | Surface/button/input/typography recipes preserve states, precedence and CSS output semantics |
| ENG-06 | P1 | Unified runtime theme updates | ENG-05 | Scope isolation, dependency updates, rollback, cleanup and SSR checks pass |
| ENG-07 | P1 | Generated tooling and integration gate | ENG-06 | Manifest/schema/editor data consistent; adapters build and install from package artifacts |
| ENG-08 | P1 | Verified cleanup and release readiness | ENG-07 | Replaced engines removed with evidence; migration notes and release compatibility decision approved |

### ENG-00 — Baseline and decisions

- [ ] Inventory every parser, resolver, generator, hardcoded default and public entrypoint, including both playgrounds.
- [ ] Record existing tests and add characterization fixtures for currently valid output.
- [ ] Separate confirmed defects from intentional demo overrides and compatibility aliases.
- [ ] Decide decimal/zero Density identifier behavior; never silently round or truncate.
- [ ] Decide default scale reconciliation without confusing default tokens with theme extensibility.
- [ ] Decide missing base, repeated breakpoint and unknown-breakpoint behavior.
- [ ] Decide strict/warning migration policy for previously accepted invalid input.
- [ ] Confirm module packaging, dependency direction and browser bundle constraints.

### ENG-01 through ENG-03 — First implementation milestone

- [ ] Introduce the shared module and re-export existing breakpoint imports.
- [ ] Move default theme data to one authoritative source; generate existing formats as needed.
- [ ] Extract nested-expression parsing and reference-preserving Density resolution.
- [ ] Migrate PostCSS without changing valid CSS semantics.
- [ ] Make runtime and playground consume the shared rules and diagnostics.
- [ ] Replace RussianDoll parsing/generation with presentation-only consumption.
- [ ] Replace implicit demo defaults with either canonical values or labeled theme overrides.
- [ ] Generate Density/spacing editor metadata and derive token suggestions from theme data.
- [ ] Run shared fixtures plus browser tests for live spacing, Density and breakpoint changes.

### ENG-04 through ENG-08 — Completion

- [ ] Migrate each remaining family and directive with its own fixtures and compatibility notes.
- [ ] Unify runtime updates while preserving public helper signatures where feasible.
- [ ] Check metadata against implemented handlers, not merely registry declarations.
- [ ] Wire a real root test/build/check pipeline and CI drift protection.
- [ ] Verify packed package installation, existing exports and adapter builds.
- [ ] Remove verified redundant implementations only after all call sites migrate.
- [ ] Record deletion evidence and intentional breaking changes in migration notes.

## Testing scenarios and acceptance criteria

| Scenario | Required result |
| --- | --- |
| Valid Density expression | Shared model preserves token references; all consumers agree |
| Spacing update | Every connected Density consumer updates without changing component source |
| Density mapping update | All scoped consumers follow the new mapping |
| Breakpoint change | Rules regenerate; test just below, at and above each threshold |
| Non-default theme tokens | Valid configured tokens are accepted regardless of default demo range |
| Decimal/unknown token | Explicit supported behavior or diagnostic; never reinterpret as another identifier |
| Nested CSS expression | Parentheses, quotes and standard CSS functions survive parsing |
| Invalid reference/cycle | Same diagnostic code/path across adapters; no partial runtime update |
| Media versus container | Correct context determines spacing, including narrow container on wide viewport |
| Two simultaneous themes | Compiling/applying one does not leak tokens into the other |
| Repeated compilation | Same inputs produce deterministic output with no accumulated global rules |
| Native CSS interoperability | Unrelated declarations/functions remain unchanged |
| SSR/runtime lifecycle | Safe import without DOM; no stale style nodes or listeners after cleanup |
| Generated metadata | Check-only generation detects drift and unsupported advertised functions |
| Package consumers | Existing imports resolve from packed artifacts, not only monorepo paths |

Browser assertions must compare computed styles, not just strings. Keep baseline fixtures for intentional differences and document each approved behavior change. Record build time and runtime bundle size before/after; agree on budgets from measured baselines rather than invented performance claims.

## Safe cleanup policy

For every deletion, record the replacement, migrated consumers, export review and passing tests. Check dynamic imports, package `exports`/`main`, generated outputs and external API compatibility. Classify findings as duplicated, obsolete, invalid usage, generated, or publicly supported; these require different actions.

Do not remove the older playground, shipped JavaScript or legacy aliases simply because TypeScript replacements exist. Deprecate public behavior when necessary. Preserve unrelated worktree changes.

## Definition of done

- [ ] One semantic implementation per migrated feature; adapters and playground do not reparse independently.
- [ ] One authoritative default theme; custom theme configuration remains supported.
- [ ] Compiler, runtime, editor and demos agree on accepted syntax and diagnostics.
- [ ] Live updates preserve references, scope and last-valid-state behavior.
- [ ] Root test/build/generated-artifact checks pass on a clean checkout.
- [ ] Browser parity and package-install checks pass.
- [ ] Removed code has a documented replacement and compatibility review.
- [ ] Documentation distinguishes implemented behavior from future proposals.

## Tracking and handoff

Start with ENG-00, then deliver ENG-01–ENG-03 as the first end-to-end milestone. Do not mark the remaining engine unified merely because Density passes. Update this document's status, link the resulting issues/PRs, and record test evidence as each gate closes.

## Implementation record — initial branch

Branch: `feat/001-unified-language-engine`.

Implemented and checked locally:

- Shared pure module shipped initially as `postcss-uxdsl/language`, avoiding an unresolved private-package dependency. It depends on the existing value parser, not PostCSS or DOM APIs.
- Extracted responsive group selection and Density rule generation; PostCSS and runtime theme CSS generation now delegate to shared functions.
- Removed the local RussianDoll parser/generator and Density definitions in favor of shared imports. Existing RussianDoll exports remain available to consumers.
- Moved breakpoint defaults to the shared module with a compatibility re-export.
- Added generated Density defaults, manifest Density/breakpoint fields and VS Code completion metadata. The remaining manifest sections are still maintained manually.
- Added nine contract tests; `npm test` also executes existing core import tests and generated-artifact drift checks.

Decisions for this incremental extraction:

- Preserve current valid compiler selection behavior and CSS token references.
- Keep Density defaults 1–15 and the UI's 14-layer display limit. The layer limit is presentation, not a grammar restriction.
- Do not silently change the existing density-15/space-17 inconsistency or decimal identifier policy during extraction; both remain explicit follow-up work.
- Preserve process-global compiler caches temporarily because removing them requires cross-file compatibility tests. The new pure module itself has no mutable global state.

Not yet verified or implemented:

- Full playground and VS Code builds, browser-computed styles and packed-consumer installation.
- Container ancestor correctness, active-rule highlighting and explicit demo breakpoint override cleanup.
- Strict token-reference validation, shared diagnostic schema, runtime atomic application, SSR hydration and all other token/directive migrations.
- Full registry-to-handler coverage and generated JSON Schema/custom CSS data.

Current automated evidence: nine new tests pass, existing core import tests pass,
generated-artifact checks pass and `git diff --check` passes. Playground dependencies
are absent locally, so source migration is not reported as browser-verified.
No npm release, deployment or remote push has occurred.
