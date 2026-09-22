# Unified engine audit

## Technical requirement

Given the same effective theme, PostCSS and runtime must preserve the same token
names, values, responsive rules, role inheritance and state composition. A demo
must consume those functions rather than maintain a competing interpretation.
“One engine” means one implementation per responsibility, not one large file.

## Scope

Verified: `packages/postcss-uxdsl` build/runtime exports, the current Next.js
playground, generated defaults and VS Code completion inventory. The old
`packages/playground` application and its demo implementations are outside this
verification; do not describe every historical application in the repository as
migrated. CLI/Vite/Webpack continue to delegate through the PostCSS integration.

## Findings corrected

| Finding | Shared owner / correction |
| --- | --- |
| Density leaked across builds and JSON was not applied by PostCSS | `language.ts`: effective defaults < per-build legacy < JSON |
| Runtime omitted Density defaults | Same effective map in both adapters and current demos |
| PostCSS omitted JSON Colors and Palette modes | `foundations.ts` emits both build and runtime foundation CSS |
| Tokens differed between direct CSS, presets and a final compiler pass | `preset-engine.ts` owns normalization and alpha; final pass reuses it |
| Standalone Color names acquired `-main` in browser helpers | Kind-aware normalization shared with runtime Color get/set/reset |
| Inputs and Buttons duplicated role/state mechanics | `control-engine.ts`; family modules contain their own schema/default data |
| Component responsive values had a separate extraction implementation | Shared `resolveResponsiveValue`; independent groups and future-only overrides tested |
| Literal string whitespace was collapsed | Preserve native CSS strings |
| Density editor parsed expressions independently and changed global CSS | Shared parser/resolver, active theme, scoped stylesheet with cleanup |
| Fractional Density arguments were silently truncated | Reject coercion; tiny demo spacing is explicitly `space(1)` |
| Examples referenced nonexistent Density 24/30 | Explicit native CSS for those local control/decorative sizes |
| Default Density 15 referenced missing Spacing 17 | Cap the default progression at shipped Spacing 16 |
| Zero-size legacy consumers lacked Density 0 | Explicit `density-0: 0` default |
| Editor inventory omitted supported functions/directives | Generated completion inventory includes Inputs and token aliases |

## Process flow and ownership

1. Read the effective JSON and optional legacy definitions for this compilation.
2. Merge defaults and overrides inside the relevant shared family engine.
3. Resolve responsive expressions and token references using shared functions.
4. Emit CSS variables; directives/components consume references and shared roles.
5. Generate successfully before replacing managed runtime or preview styles.

- `language.ts`: breakpoints, responsive resolution, Density map and compilation.
- `preset-engine.ts`: common value validation and token normalization.
- `foundations.ts`: JSON Colors, Palette, Spacing and Palette modes.
- `typography.ts`, `edges.ts`, `shadows.ts`, `surfaces.ts`: family semantics.
- `control-engine.ts`: shared role inheritance, state fields, tones and emission.
- `buttons.ts`, `inputs.ts`: family-specific fields, states, defaults, public API.
- PostCSS: legacy syntax and stylesheet AST adapter; runtime: theme/style adapter.
- Generated artifacts: default packs and editor inventory; never edit independently.

## Testing scenarios

`test/unified-engine.test.js` adds whole-theme variable/selector parity including
modes, sequential compilation isolation, JSON precedence, token/alpha equivalence,
Density validation, shipped default dependencies, browser Color naming, native
CSS string preservation and responsive shorthand semantics. Family tests retain
coverage of inheritance, states, breakpoint boundaries and legacy packs.

The Next.js verification covers real Input states, custom roles, tones and sizes,
Density editing without global leakage, and the position of AI guidance after demos.

## Explicit limits and follow-up scope

These are not implied capabilities of the engine:

- Existing variable values can change through theme CSS. Changing role structure,
  adding/removing fields or changing Surface selection requires regenerated
  component CSS. Breakpoint changes in previously compiled local rules require
  the browser breakpoint integration or recompilation.
- Arbitrary CSS variables may be supplied by external stylesheets. This is not a
  complete dependency-graph validator, CSS grammar validator or accessibility audit.
- Reference validation is expected to cost time roughly proportional to the size
  of the stylesheet. It is not free, and it is not constant: each consumer is
  still inspected in every declared context whose selector and conditions can
  reach it, which is what lets a dependency that only fails at one breakpoint or
  in one mode be reported at all. What it may not do is grow with the *square* of
  the input — before MIG-B6-25 it did, because the candidate contexts were
  recomputed by scanning every declaration once per consumer. Its per-pass
  indexes (contexts bucketed by selector, memoized resolutions, values parsed
  once) are built and discarded inside `inspectReferences`; like every other
  family, it keeps no process-global cache between builds.
  `packages/postcss-uxdsl/test/performance/reference-performance.test.js` asserts the growth
  ratio, and `npm run bench:references` prints the absolute curve with the
  machine that produced it.
- Legacy DOM linking/persistence APIs and advanced compiler callback options remain
  integration-specific APIs. Whole-theme parity uses the same effective JSON and
  standard serializers; it is not a promise that arbitrary callbacks can run in
  the browser without an equivalent adapter.
- VS Code completions are generated inventory, not a schema-aware language server.
  Custom theme autocomplete and semantic diagnostics need a dedicated editor task.
- The historical playground needs migration or explicit retirement before making
  a repository-wide claim covering every demo. Preserve this as a separate scope
  item rather than silently assuming that it uses the current Next.js engines.

## Migration

FEAT-002 adds explicit `uxdsl__` namespace migration and a packaged
Next.js/Chrome verification path (`npm run verify:cssmodules-build`). The
static reference validator checks generated consumers against declared
providers; it remains conservative for arbitrary selectors and conditions.
Strict themes must supply dependencies of all emitted presets. Runtime
applications record last-valid state only after successful CSS generation.

Import legacy definitions in each build; process-global Density inheritance is
removed. Use defined Density keys; decimals are no longer truncated. Default
Density 15 stops at Spacing 16 and Density 0 is explicitly zero. Out-of-range
Palette/Color alpha fails rather than being clamped. `color(white)` uses the
standalone Color token; `palette(primary)` selects the main Palette variant.
