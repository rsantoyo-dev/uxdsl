# FEAT-010 — UXDSL 0.5.0-beta.9: the plan, written for agents

| Field | Value |
| --- | --- |
| Status | Planned on 2026-10-11 over `main` at `685c132`. Every decision confirmed by the owner on 2026-10-23 (§2). Merged: MIG-B9-01, 05 and 53; in progress: MIG-B9-10. The index has each story's status. |
| Goal | Make the definition below true in the code and pinned by tests, then make the playground the best implementer of it. |
| Release | `uxdsl@0.5.0-beta.9`, the first publish of the single `uxdsl` package, with every wave (DEC-03). |
| Implemented by | AI agents only. The owner decides, reviews, merges and publishes. |
| Index and stories | [FEAT-010/README.md](FEAT-010/README.md) holds the protocol, the test policy, the story template, the order of work and the status table. Each story is one file in [FEAT-010/](FEAT-010/). |
| Backlog and reasons | [docs/audits/2026-10-08-plan-beta9.md](../audits/2026-10-08-plan-beta9.md) records every candidate with its options. This feature is the executable form of it. |
| Publication | No agent publishes, changes dist-tags, deprecates a package, merges to `main` or pushes to a branch it did not create. |

## 1. The definition (DEC-00, the owner, 2026-10-09 and 2026-10-11)

The owner's words are the source. Verbatim:

> Uxdsl es una capa encima de scss que permite funciones de UI como todas la
> que hemos hablado: `padding: xs(2px)`, eso es lo básico; `padding:
> xs(spacing(2))` y `padding: density(2)` que deben también ser leídas. Debe
> funcionar similar a como funciona ahora: un SCSS superset, para convertir en
> UXDSL — UX Design System Language son las iniciales. Todo el sistema
> responsive, paleta, espaciado, está controlado por un JSON que define todos
> los tokens, y que puede ser live updated. PostCSS nos ayuda siempre a
> transformar todo, y así generamos estabilidad. La teoría es sencilla, así
> que en lo posible es simplificar el código al máximo para usar esta capa
> encima del SCSS. Una sola fuente de verdad y una sola forma de actualizar
> este CSS, para redibujar si se quiere actualizar el tema.

> Una persona cambia `.scss` por `.uxdsl` y debe funcionar, y a partir de ahí
> agregar cualquier cosa de UXDSL. El JSON theme como fuente de guía, que se
> actualiza en run time. Es una librería basada en MUI — basada, no igual —
> que permite replicar su engine pero desde la capa de CSS. Y el demo
> playground debe ser el mejor implementador de UXDSL.

Each clause was checked against `main` on 2026-10-09 and 2026-10-11. "Today"
says what the code does now. "Stories" says which stories make the clause
true.

| # | Clause | Today on `main` | Stories |
| --- | --- | --- | --- |
| 1 | **UXDSL is a layer on top of SCSS.** A `.scss` file renamed to `.uxdsl` compiles to the CSS Dart Sass produces for it, and can then use UXDSL. | **False.** `compile()` emulates a subset of Sass inside PostCSS (`packages/uxdsl/src/compile.ts`, the `plugins` array: `postcss-import`, `scssSubset()`, `sassLeftoverGuard()`, the plugin). Real SCSS fails loudly: `@use "sass:math"` is `UXD_SCSS_UNSUPPORTED`, `&__title` is `UXD_NESTING_INVALID`. 41 of the audit's 110 SCSS cases fail. **Proven feasible** with Bootstrap 5.3.8's SCSS (96 files renamed): byte-identical to Dart Sass through the prototype pipeline. | MIG-B9-10 to MIG-B9-15 |
| 2 | **UI functions on top of SCSS.** Responsive functions named after the theme's breakpoints (`padding: xs(2px) md(4px)`), token functions (`space(2)`, `density(2)`, `palette(primary.main)`, `color(blue.700)`, `radius(2)`, `border(1)`, `shadow(2)`), both combined (`xs(space(2)) md(space(4))`), and the role directives (`@ds-surface`, `@ds-button`, `@ds-input`, `@ds-typo`). | **True**, verified: `padding: xs(2px)` → `padding: 2px`; `xs(2px) md(4px)` → `2px` plus `@media (min-width: 768px) { … 4px }`; `xs(space(2))` → `var(--uxdsl__space__2)`; `density(2)` → `var(--uxdsl__density__2)`. **Gap:** the spacing function is `space()`. `spacing(2)`, as the owner wrote it, compiles silently to the invalid `padding: spacing(2)`; so do typos such as `palete(primary.main)` and `densty(2)`. | MIG-B9-04 (DEC-02) |
| 3 | **One JSON theme defines every token** and is the only source of truth: breakpoints, spacing, densities, colors, palette with its dark mode, typography, borders, radii, shadows, surfaces, buttons, inputs. | **True** for definitions: the base theme ships in the package (`packages/uxdsl/src/theme/base.json`); a project theme file overrides it; one validator (`validateTheme`) and one generator (`renderThemeCss`) exist. **Gaps:** composite tokens resolve only at `:root`, so a palette scoped to an element does not reach borders, surfaces and controls (Press Craftor's first finding); custom roles silently inherit `contained`; typography roles inherit `default`'s zero margins. | MIG-B9-31, MIG-B9-32, MIG-B9-33 |
| 4 | **The theme updates live.** Changing it redraws the page; there is one way to update the CSS. | **True** at run time: `applyTheme(patch)` regenerates the theme stylesheet with the build's generator and swaps one managed `<style>`. A patch that changes *which declarations* a compiled rule has (a breakpoint threshold, a new state) is refused with `UXD_THEME_STRUCTURE`; that is a rebuild, by design. **Gap:** at build time, where the theme is written has three switches (`includeTheme`, `@uxdsl theme;`, per-build `includeTheme`), and the default writes the whole theme into every compiled file: a one-rule module is 47,273 bytes by default and 44 bytes without the theme, so every `.uxdsl` module a Vite or webpack app imports repeats it. | MIG-B9-20 (DEC-06) |
| 5 | **PostCSS performs the transform.** | **True** for UXDSL's own words (`plugin.ts`, the `Once` hook). After beta.9, Dart Sass performs SCSS and PostCSS performs UXDSL; nothing in UXDSL re-implements Sass. | MIG-B9-12, MIG-B9-13 |
| 6 | **The code is as simple as the theory.** One pipeline, one theme generator, one validator, one discovery, one way to update; code that emulates Sass or repeats another path is deleted. | **Partly.** One generator and one validator exist. Duplicates: `$variable` resolution twice (`scss-subset.ts` and the plugin's `resolveVariables`); theme-file discovery called from four places; the playground keeps its own copy of `generate-entry`; `compile.ts` carries a cycle detector and an import resolver that exist only because of `postcss-import`. | MIG-B9-13, MIG-B9-21, MIG-B9-22 |
| 7 | **Nothing fails silently.** | **Partly.** 107 catalogued `UXD_*` codes. Silent today: near-miss function names (clause 2). | MIG-B9-04 |
| 8 | **Inspired by Material UI, not equal to it.** The palette with `main`/`light`/`dark`/`contrast`, the spacing scale, the `xs sm md lg xl` breakpoints, responsive values per breakpoint, typography variants, component variants with states — written as a CSS language, with no JavaScript runtime required. | **True** in the model. What UXDSL does differently is deliberate: responsiveness lives in the theme (Density), the theme is data shared by build, runtime, audit and agents, and a decision that cannot be honoured is an error. Every public text says "inspired by Material UI", never "is MUI" or "Material UI's engine". | MIG-B9-50 |
| 9 | **The playground is the best implementer of UXDSL.** One component per concept, every principle demonstrated live, nothing hand-written, nothing hardcoded, and the superset shown. | **False.** 55 components with 25 ways to show code, 19 own buttons, 78 literal font sizes, 131 hand-written `var(--uxdsl__…)`, 128 pixel edge values, two hand-written `@media`, and its own copy of the entry generator. | MIG-B9-40 to MIG-B9-43 |

### What "one way to update" means, precisely

- **At build time** the theme JSON becomes CSS through one generator, in one
  place of the output: where `@uxdsl theme;` is written (MIG-B9-20).
- **At run time** `applyTheme(patch)` is the only way to change it. It runs
  the same generator and swaps one managed stylesheet. Nothing writes inline
  styles or individual custom properties.
- **Structural changes** (a breakpoint threshold, a state a role did not
  have, a typography field added) are a rebuild, by design. That is the one
  limit of live updates, and the runtime says so with `UXD_THEME_STRUCTURE`.

### The architecture after beta.9

```text
a .uxdsl file — SCSS plus UXDSL
  compile()  (the CLI, the Vite plugin, the webpack loader, the Node API)
    1. protect    UXDSL syntax Sass would misread           src/sass/protect.ts
    2. Dart Sass  all of SCSS: @use, nesting, maps, …       src/sass/compile-sass.ts
    3. restore    the directive spacing Sass changes        src/sass/protect.ts (a PostCSS plugin)
    4. UXDSL      the PostCSS plugin                        src/plugin.ts

a .css file in a host's own PostCSS (Next.js without the CLI)
    UXDSL         the same PostCSS plugin: CSS plus UXDSL, no Sass

theme JSON ─ one generator (renderThemeCss) ─┬─> the build, at `@uxdsl theme;`
                                             └─> applyTheme() in the browser
```

The file names under `src/sass/` are the names every story uses. MIG-B9-11
and MIG-B9-12 define their exported functions.

## 2. Decisions

FEAT-010 numbers its decisions `DEC-nn`. They are not the `D-n` of FEAT-008,
FEAT-009 or the beta.9 plan, which reuse the same numbers for different
questions; the register in [FEAT-010/README.md](FEAT-010/README.md) maps them.

| ID | Decision | State | Stories |
| --- | --- | --- | --- |
| DEC-00 | The definition in §1. | **Decided**, owner, 2026-10-09 and 2026-10-11 | all |
| DEC-01 | UXDSL is a superset of SCSS through real Dart Sass, in beta.9 (plan D-1). | **Decided**, owner, 2026-10-09 | MIG-B9-10 to 15 |
| DEC-14 | The playground is UXDSL's reference implementer: one component per concept, every principle demonstrated, nothing hand-written or hardcoded, and the superset shown live. | **Decided**, owner, 2026-10-08 and 2026-10-11 | MIG-B9-40 to 43 |
| DEC-15 | Public documentation, the stories of this feature and their tests are written in English (audit DE-12). | **Decided**, audit 2026-09-29 | all |
| DEC-02 | The spacing token function keeps the name `space()`. `spacing()` is an error that names `space()`, like the other removed spellings, and every near-miss of a UXDSL function name is an error with a "did you mean". With the review's precisions: a real CSS function (`shape()`) is never flagged; a top-level name one edit from a breakpoint stays `UXD_BREAKPOINT_UNKNOWN`; the check lives in `language.ts`, so theme values fail the same way. | **Decided**, owner, 2026-10-23 | MIG-B9-04 |
| DEC-03 | **The release cut: one release.** `0.5.0-beta.9` ships every wave, 0 to 7. There is no `0.5.0-beta.10` in this feature: the roadmap's beta.9 and beta.10 steps become one, and MIG-B9-91 stays one story. | **Decided**, owner, 2026-10-23: option (a). The plan and the review recommended (b). | MIG-B9-91 |
| DEC-04 | `sass`, the pure-JavaScript Dart Sass package (not `sass-embedded`, so it also runs in the browser), is a regular dependency of `uxdsl` (zero setup for "rename and it works"), not an optional peer. It is loaded only when `compile()` runs: the PostCSS plugin used alone never loads it. | **Decided**, owner, 2026-10-23 | MIG-B9-12 |
| DEC-05 | The PostCSS plugin used alone compiles CSS plus UXDSL, without Sass: its own `$variable` resolution is deleted, and Sass syntax in a file it compiles is a located error that names the fix (a `.uxdsl` file through `uxdsl build`, `compile()` or an adapter). Every Sass construct is detected, not only `$name`: `@use`, `@forward`, `@mixin`, `@include`, `@function`, `@extend`, the control rules, `#{…}`, `&`-suffix selectors and `%placeholders`. `--x: $var` has its own message: Sass keeps `$var` literally in a custom property; write `#{$var}`. | **Decided**, owner, 2026-10-23 | MIG-B9-13 |
| DEC-06 | The theme CSS is written only where `@uxdsl theme;` appears; the `includeTheme` option, config key and flags are removed. Generated entries, `uxdsl init` and the Next.js scaffold write the marker. A build that emits no theme warns once, on every host (a single-entry CLI build, `builds`, `build --watch` counted over every entry's last result, Vite, webpack, Next.js), and so does a build in which more than one module emits it (a marker reached through a shared partial). | **Decided**, owner, 2026-10-23 | MIG-B9-20 |
| DEC-07 | **Amended by the owner.** A block that applies from a breakpoint up is written `@media (--<breakpoint>) { … }`, the CSS custom-media syntax: UXDSL replaces `(--lg)` with the effective theme's `lg` query, so no value is copied by hand, and it combines with other conditions (`@media print and (--lg)`). `@lg { … }` is not added. What is written by hand wins: a literal query such as `@media (min-width: 1024px)` is plain CSS, compiled as written and never rewritten, and a project's own `@custom-media --lg …` replaces the theme's `--lg` in that build, with a warning (the DEC-17 rule). | **Decided**, owner, 2026-10-23: `@media (--lg)`, which the review proposed comparing, instead of `@lg { … }` | MIG-B9-30 |
| DEC-08 | Scoped palettes: palette modes match any element (`[data-theme='dark']`, `[data-theme='light']`) while `:root[data-theme='dark']` stays in the selector, and the palette-dependent composite tokens, only those, are re-declared on every element that carries `data-theme` or `data-uxdsl-scope`, so a palette override there reaches borders, shadows, surfaces and controls. `[data-theme='light']` re-declares only the palette. Inside a scope the theme's composites win over a hand-written `:root` composite override; the documented place for an override is the theme JSON, and a test pins the rule. Style recalculation with many scopes is measured. | **Decided**, owner, 2026-10-23 | MIG-B9-31 |
| DEC-09 | **Amended by the owner: one inheritance rule** for Surfaces, Buttons, Inputs and Typography. A role inherits as it does today (Surfaces, Buttons and Inputs from the same-named base role or `contained`; Typography from `default`); `"extends": "none"` starts from nothing but what the role declares; `"extends": "<role>"` inherits from that role instead. `none` is reserved as a role name. A theme that does not write `extends` compiles as before. | **Decided**, owner, 2026-10-23: the review's single rule instead of "a custom role inherits nothing" | MIG-B9-32, MIG-B9-33 |
| DEC-10 | **Amended by the owner: the DEC-09 rule.** Typography follows it. `default` keeps `marginBlockStart` and `marginBlockEnd` at `0`, so no browser margin comes back; a weight-only role is `{ "extends": "none", "fontWeight": "700" }`. (`null` is not a valid theme leaf, hence the string `"none"`.) | **Decided**, owner, 2026-10-23: the plan's removal of `default`'s margins is dropped | MIG-B9-33 |
| DEC-11 | A `focus` theme family (`outline`, `outline-offset`) and one generated `:where(…):focus-visible` rule emitted with the theme, at zero specificity. Its selector list covers every focusable element (links and areas with `href`, `button`, `input` including checkboxes, `select`, `textarea`, `summary`, `[tabindex]`, `[contenteditable]`), and a theme can switch the rule off. Base Buttons and Inputs keep their own focus states (the `tone(main)` ring, an Input's focus border), which win by specificity, so the base theme writes no compiled variable name by hand; a control styled by `@ds-button` or `@ds-input` looks focused exactly as it does today (checked in Chrome). | **Decided**, owner, 2026-10-23 | MIG-B9-34 |
| DEC-12 | **Amended by the owner.** A tone on a transparent-background role (`outlined`, `flat`, `underline`) or on an Input is checked by contrast, not by family name: for each mode of the effective theme the compiler computes the contrast of the tone against the canvas and, below the contrast gate's threshold, emits a located warning with the fix. It never fails the build, because the compiler cannot know the real background (a `data-theme` scope, a contained parent). The contrast gate's three pattern exceptions are replaced by the same predicate; those pairs stay listed, as warned, never as passing (the audit's DE-7 honesty). | **Decided**, owner, 2026-10-23: a warning from the contrast predicate instead of an error by family name | MIG-B9-35 |
| DEC-13 | Inputs show the invalid state on `:is(:user-invalid, [aria-invalid="true"])`, not on `:invalid`; a browser without `:user-invalid` still matches `[aria-invalid="true"]`, because `:is()` is forgiving. The CHANGELOG records it as a visual change: a form no longer turns red on load. | **Decided**, owner, 2026-10-23 | MIG-B9-36 |
| DEC-16 | Evidence is recorded once, in the story, in the same PR that delivers it; the merge commit identifies the delivery. No follow-up "fix SHA" commits. This reconciles the audit (§5.5: no evidence tables, no SHA commits) with AGENTS.md (record evidence in the story). | **Decided**, owner, 2026-10-23 | all |
| DEC-17 | **The author's SCSS wins.** A Sass `@function` named like a UXDSL function (a token function, `tone`, a breakpoint of the effective theme) is allowed. Where Sass calls it by its bare name (the same file, a file loaded with `@import`, `@use … as *`), the name means the author's function and the output is what Dart Sass produces; UXDSL emits one warning, located at the definition, naming the UXDSL function it replaces (`UXD_FUNCTION_SHADOWED`). A function reached only through a namespace (`helpers.space()`) shadows nothing, and mixins never conflict. Every loaded file is checked, `.scss` included, so no shadowing is silent. MIG-B9-11's R4 (`UXD_RESERVED_NAME`) is replaced by this rule. | **Decided**, owner, 2026-10-23: option (b) | MIG-B9-11, 12, 13, 15, 50, 60 |

A story whose decision is only recommended starts as **Blocked (DEC-nn)**.
The owner can confirm several decisions in one message; the agent that reads
it records the date in this table and in each story, and changes the status
to Ready.

On 2026-10-23 the owner decided every open decision, one question at a time.
No story is blocked by a decision. Each story a decision touches carries an
"Owner decisions of 2026-10-23" block at the end of its §15; where that
block and the story's contract differ, the block rules.

### Review of 2026-10-11

A static review of every story against `main` at `685c132` (three reviewers,
one per group of waves) found the plan's measurements accurate and its
direction sound, and raised findings that each story now lists in its §15
under "Review of 2026-10-11". None changes a decision's state; they are the
reviewer's recommendations for the owner:

| Decision | Review recommendation |
| --- | --- |
| DEC-02, DEC-04, DEC-16 | Confirm as written. |
| DEC-03 | (b), with MIG-B9-91 split into 91a (beta.9: waves 0–3, the Press Craftor re-run, an English beta.8 → beta.9 migration section) and 91b (beta.10). |
| DEC-05 | Confirm, with every Sass construct detected (not only `$name`) and a specific message for `--x: $var`. |
| DEC-06 | Confirm, with a warning whenever a build emits no theme (every host, watch included), not only for `builds`. |
| DEC-07 | Defer to beta.10; compare with `@media (--lg)` first. |
| DEC-08 | Confirm, keeping `:root[data-theme='dark']` in the selector, re-declaring only palette-dependent composites, and testing author overrides. |
| DEC-09, DEC-10 | One inheritance rule for Surfaces, Buttons, Inputs and Typography: inherit by default, `"extends": "none" \| "<role>"`. Drop the removal of `default`'s margins (`h1` has no top margin of its own). |
| DEC-11 | Defer, or confirm without hand-written compiled names in the base theme and with an opt-out. |
| DEC-12 | Defer, or derive the rejection per mode from the contrast predicate instead of family names. |
| DEC-13 | Confirm, emitting `:is(:user-invalid, [aria-invalid="true"])`. |
| DEC-17 | Open; the owner's call. |

Scope recommended by the review: beta.9 = waves 0–2 plus MIG-B9-31 and
MIG-B9-36; MIG-B9-30, 32, 33's margin change and 35 later; MIG-B9-60, 61, 63
and 65 when users ask; MIG-B9-64 cut. Waves 4–7 are marked "Draft
(re-baseline after wave 3)" in the index.

The owner's decisions of 2026-10-23 (§2) supersede this table where they
differ: one release with every wave (DEC-03), `@media (--lg)` (DEC-07) and a
contrast warning (DEC-12). MIG-B9-64's recommended cut, and shipping MIG-B9-60,
61, 63 and 65 only when users ask, were not part of those questions and remain
the owner's call.

## 3. Scope, in waves

The stories are grouped in waves. A wave is an order, not a release: under
DEC-03 every wave ships in `0.5.0-beta.9`.

| Wave | What | Stories |
| --- | --- | --- |
| 0 | Housekeeping and validation: numbering, dependencies, `main` proven on a real project, the language refuses near-misses, byte-preserving plugin. | MIG-B9-01 to 05 |
| 1 | The SCSS superset: tests first, the protect pass, Dart Sass with the `.uxdsl` importer, `compile()` on the new pipeline, the CLI and adapters, the documentation. | MIG-B9-10 to 15 |
| 2 | One source of truth, less code: the theme at the marker only, deletions, `build --watch` keeps the entry. | MIG-B9-20 to 22 |
| 3 | Output-changing decisions, each behind its DEC: `@media (--lg)`, scoped palettes, one `extends` rule for roles and typography, focus, canvas-tone contrast warnings, `:user-invalid`. | MIG-B9-30 to 36 |
| 4 | The playground as reference implementer: the design-system layer, one demo frame and one editor, the five principles live, nothing hardcoded. | MIG-B9-40 to 43 |
| 5 | Documentation and presentation: README and quick start, AGENTS.md and CONTRIBUTING.md, migration guide in English, maintenance signals, "Why UXDSL", the VS Code extension. | MIG-B9-50 to 55 |
| 6 | Tools for the adoption ladder: `doctor`, `audit` and `migrate --suggest`, the generated reference, `explain` and hover, `emit: 'used'`, the container note. | MIG-B9-60 to 65 |
| 7 | Release: the test exercise, the gate, the record. | MIG-B9-90, 91 |

**Not in this feature, on purpose:** the MUI theme import (plan D-11, a
mapping table in the docs is part of MIG-B9-50), container queries, fluid
scales, DTCG, a Tailwind bridge. They wait for users to ask.

## 4. Supersedes

FEAT-009 stories that were still open on `main` and their fate here:

| FEAT-009 | Fate |
| --- | --- |
| MIG-B7-02, MIG-B7-03 (canvas tones, `warning.main`) | `warning` was re-chosen in stability phase 5 (shipped on `main`). The canvas tones are DEC-12, MIG-B9-35. |
| MIG-B7-04 (real CI) | Done: `.github/workflows/ci.yml` runs `npm test` and `verify:1.0` with Chrome. Closed. |
| MIG-B7-05 (publish the extension) | MIG-B9-55 packages it; publishing is the owner's. |
| MIG-B7-06 (Vite source maps) | Re-verified by MIG-B9-14 on the new pipeline. |
| MIG-B7-07 (hygiene round 2) | MIG-B9-50 and MIG-B9-52. |
| MIG-B7-08 (`theme --diff` for surfaces/buttons/inputs) | Absorbed by MIG-B9-62 (the generated reference) as a candidate; not a commitment. |
| MIG-B7-10 (`!important` in the reference comparator) | Decided in MIG-B9-21 while deleting: either fixed with a test or deleted with the dead branch. |
| MIG-B7-11 (gate for rc.1) | MIG-B9-91 is the gate; rc.1 comes after beta.9 (DEC-03). |
| MIG-B7-13 (editor hover with the project theme) | MIG-B9-63. |
| MIG-B7-17 phase D (playground, with the owner) | MIG-B9-42 and MIG-B9-43. |

## 5. Release

The gate is MIG-B9-91. After it passes, the owner publishes
`uxdsl@0.5.0-beta.9` with `latest` and `beta`, then decides about the five
former names (deprecate; optionally publish the shims). The record of what was
published is `docs/releases/0.5.0-beta.9.md`, written by MIG-B9-91 from the
gate's output.
