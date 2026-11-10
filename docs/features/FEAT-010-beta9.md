# FEAT-010 — UXDSL 0.5.0-beta.9: the plan, written for agents

| Field | Value |
| --- | --- |
| Status | Planned on 2026-10-11 over `main` at `685c132`. Every decision confirmed by the owner on 2026-10-23 (§2). MIG-B9-23 added on 2026-11-02, by the owner's decision on MIG-B9-13's AC1. On 2026-11-04 the owner revised DEC-03 to two releases and registered MIG-B9-24 to 29, 37 and 92 (§2). On 2026-11-08 the owner settled the flags of MIG-B9-14 and 15 and registered MIG-B9-16, 38 and 39 (§2). On 2026-11-09 the owner settled the flags of MIG-B9-22 and 23 and registered MIG-B9-44 (§2). On 2026-11-10 the owner answered the open questions of the story files of MIG-B9-16 and 24 to 29 and three notes of their PR, split MIG-B9-26 into MIG-B9-26 and MIG-B9-17, made `migration.md` append-only and registered MIG-B9-66 (§2). Merged: MIG-B9-01 to 05, 10 to 15, 22, 23 and 53; wave 1 is complete. The index has each story's status. |
| Goal | Make the definition below true in the code and pinned by tests, then make the playground the best implementer of it. |
| Release | Two releases (DEC-03, revised on 2026-11-04): `uxdsl@0.5.0-beta.9`, the first publish of the single `uxdsl` package, with waves 0 to 3 and MIG-B9-91; then `uxdsl@0.5.0-beta.10`, with waves 4 to 6, MIG-B9-90 and MIG-B9-92. |
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
| DEC-03 | **The release cut: two releases, option (b).** `0.5.0-beta.9` ships waves 0 to 3 and MIG-B9-91, the beta.9 gate, which includes the Press Craftor re-run and an English beta.8 → beta.9 migration section. `0.5.0-beta.10` ships waves 4 to 6, MIG-B9-90 and MIG-B9-92, the beta.10 gate and release record (the plan's "91b"). The stories registered on 2026-11-04 ship in beta.9: MIG-B9-24 to 29 in wave 2 and MIG-B9-37 in wave 3. | **Decided**, owner, 2026-11-04: option (b); option (a) of 2026-10-23 superseded | MIG-B9-91, MIG-B9-92 |
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
block and the story's contract differ, the block rules. Eight stories also
carry an "Owner decisions of 2026-11-04" block (below), which rules where it
differs from an earlier block; six carry an "Owner decisions of 2026-11-08"
block, four an "Owner decisions of 2026-11-09" block and eleven an "Owner
decisions of 2026-11-10" block (below), which rule in the same way.

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
differ: `@media (--lg)` (DEC-07) and a contrast warning (DEC-12). Their third
difference, one release with every wave (DEC-03, option (a)), was itself
revised on 2026-11-04 to this table's option (b): MIG-B9-91 is the review's
91a and MIG-B9-92 its 91b, and beta.9 keeps all of wave 3, not the narrower
scope recommended above. MIG-B9-64's recommended cut, and shipping MIG-B9-60,
61, 63 and 65 only when users ask, were not part of those questions and remain
the owner's call.

### Owner decisions of 2026-11-04

On 2026-11-04 the owner was given 19 numbered recommendations, in Spanish,
and answered, verbatim:

> voy a seguir todas tus recomendciones

("I will follow all your recommendations.") Every recommendation below is
therefore the owner's decision of 2026-11-04; this record is in English. D1
to D19 number them in the order they were given; the numbers belong to this
list only and are neither `DEC-nn` nor the beta.9 plan's `D-n`, and a story
cites one as "decision D4 of 2026-11-04". Eight stories carry an "Owner
decisions of 2026-11-04" block at the end of their §15: MIG-B9-03, 12, 13,
15, 23, 52, 90 and 91. The other unmerged stories that D13 moves to
`0.5.0-beta.10` name that release in their header, and the index registers
the new stories.

- **D1 — Process by story size.** An S story is delivered by a light flow (a scout, one implementer, one review, the deliverer); the full flow (a design panel, several implementers, review lenses, a mutation re-review) is kept for M stories that change the engine. Every rule of the index's §2 still applies to both.
- **D2 — MIG-B9-25 registered,** "The test suites remove the temporary directories they create": S, wave 2, early. Proposed in MIG-B9-23 §15: the owner's `$TMPDIR` held 127,359 entries left by the suites, 99,469 of them `uxdsl-sass-stage-*` from `compile-sass.test.js`.
- **D3 — MIG-B9-24 registered,** "The plugin's fixed per-build costs": S, wave 2, low priority. Proposed in MIG-B9-23 §15.
- **D4 — MIG-B9-03's findings 3 and 4 registered:** MIG-B9-29, "The canonical-grammar codemod is idempotent" (S, wave 2: a second run is a no-op, pinned by a test; MIG-B9-52's release-notes instruction follows), and MIG-B9-37, "A located warning for a CSS-wide keyword as a theme token value" (S, wave 3: `inherit`, `initial`, `unset`, `revert` and `revert-layer` emit a guaranteed-invalid `:root` property today, silently).
- **D5 — MIG-B9-26 registered,** "Dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning": S, wave 2, after MIG-B9-14 (which makes the CLI print `compile()`'s warnings). It answers MIG-B9-13's owner flag 10 (`palete(primary.main)` through `compile()` is `UXD_SASS: expected "(".`, with no suggestion) and MIG-B9-12's owner flag 8 (`@debug` dropped).
- **D6 — MIG-B9-13's owner flag 6:** a `$variable` Dart Sass keeps as written stays an error (`UXD_SASS_CONTEXT`), not a warning; a literal `$identifier` cannot be emitted except through the `\$` escape; MIG-B9-15 documents the limitation and the escape's caveat.
- **D7 — MIG-B9-13's owner flag 8 (F3):** `uxdsl/postcss` after postcss-nested or postcss-simple-vars failing, in either order, is accepted as documented for now; MIG-B9-27 registered, "`uxdsl/postcss` in a PostCSS chain: run the Sass-syntax checks at `OnceExit` if that keeps every contract" (S, wave 2, after MIG-B9-21, since it edits `plugin.ts`), which also verifies `tailwindcss/nesting`.
- **D8 — P10's measuring method is corrected; the budget stays 1.5×:** the cold first run is discarded, Dart Sass and `compile()` alternate, and the corpus is compiled from a fresh directory. MIG-B9-23 implements it: `fixtures/sass-corpus/run.js` joins its Shares, its C1 uses the corrected method, and its C2 (location independence) stays.
- **D9 — MIG-B9-91 re-measures P10** on the owner's Mac, with the corrected method, before publishing.
- **D10 — `uxdsl` declares `"engines": { "node": ">=20.19" }`** (MIG-B9-12's owner flag 11: `sass` 1.107.0, `chokidar` 5 and `readdirp` 5 require it), in MIG-B9-91, with the release note in the beta.9 migration section.
- **D11 — CI runs on Windows before the release:** MIG-B9-28 registered, "CI on Windows" (wave 2; its scout sizes it, S or split, since the suites may assume POSIX paths); MIG-B9-91 depends on it. Windows is unverified today (MIG-B9-13's owner flag 20; MIG-B9-23's `realCase` path runs on win32).
- **D12 — Sass's `@debug` output** is accepted as dropped for now; MIG-B9-26 shows it as a warning.
- **D13 — DEC-03 is revised to option (b)** (the table above): `0.5.0-beta.9` ships waves 0 to 3 and MIG-B9-91, the beta.9 gate, which includes the Press Craftor re-run and an English beta.8 → beta.9 migration section; `0.5.0-beta.10` ships waves 4 to 6, MIG-B9-90 and a new MIG-B9-92, the beta.10 gate and release record (the plan's "91b"). The new stories 24 to 29 (wave 2) and 37 (wave 3) ship in beta.9. The review of 2026-10-11 recommended (b) and the owner chose (a), one release, on 2026-10-23; the owner was told that this reverses that decision.
- **D14 — Ten Dependabot pull requests were closed** on 2026-11-05 (UTC), each with a comment giving the reason: #58 (`postcss-import`, no longer a dependency on `feat/beta9`), #57 and #51 (TypeScript 7, a major upgrade), #60 and #61 (majors whose CI fails), #56 (a group whose CI fails), #54 and #55 (React 19 in the CSS-modules fixture, which fails), #53 (`@types/node` 26, above the extension's runtime) and #50 (`@types/vscode` above `engines.vscode` `^1.80.0`).
- **D15 — #52 (`playwright-core`) and #59 (the playground's minor-and-patch group),** green, are merged into `main` by the owner (`main` is the owner's). Both were still open on 2026-11-05.
- **D16 — The owner enables Dependabot security updates** in GitHub. They were not yet enabled on 2026-11-05.
- **D17 — The Press Craftor patch** (MIG-B9-03's evidence) is applied to the real project after beta.9 is published.
- **D18 — MIG-B9-13's owner flags 2, 3, 4, 5, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18 and 19 are accepted as delivered** (flag 1 was decided on 2026-11-02; flags 6, 8, 10 and 20 are D6, D7, D5 and D11). For flag 14, the proposed CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL stays with MIG-B9-14.
- **D19 — MIG-B9-12's owner flags 1, 2, 3, 4, 5, 7, 9, 14, 15, 16, 17, 18, 19, 20, 21 and 22 are accepted as delivered** (flag 15's lockfile item goes to MIG-B9-91); flags 6, 10, 12 and 13 were settled by MIG-B9-13 and MIG-B9-14; flag 8 is D12 and flag 11 is D10.

### Owner decisions of 2026-11-08

On 2026-11-08 the owner was given numbered recommendations, in Spanish, on
the owner flags of the last two stories of wave 1: MIG-B9-14's 18 flags (its
§15, "Delivery of 2026-11-06", and the body of PR #71) and five on MIG-B9-15
(its §15, "Delivery of 2026-11-08", and PR #72). The owner answered,
verbatim:

> todo como recomendado

("everything as recommended.") Every recommendation below is therefore the
owner's decision of 2026-11-08; this record is in English. This list adds no
numbering of its own: a story cites a decision by the flag it answers, as
"the decision of 2026-11-08 on MIG-B9-14's flag 12". MIG-B9-14 was merged as
PR #71 (`db0e28d`) and MIG-B9-15 as PR #72 (`4ecdc51`), so wave 1 is
complete. Six stories carry an "Owner decisions of 2026-11-08" block at the
end of their §15: MIG-B9-14, 15, 20, 21, 22 and 62. The index registers the
three new stories, MIG-B9-16 (wave 2) and MIG-B9-38 and 39 (wave 3), which
ship in `0.5.0-beta.9` with their waves.

MIG-B9-14's flags:

- **Flag 1 — the namespace basis.** `generate-entry`'s namespaces are computed from the path relative to `--src`, not to the entry (today the playground gets names like `f----components-…`): MIG-B9-22 does it.
- **Flag 2 — the extension in each `@use`.** `generate-entry` writes the extension in each `@use` (`@use './x.uxdsl'`), so a `.scss` twin beside a `.uxdsl` file is not ambiguous: MIG-B9-22.
- **Flag 3 — isolation's silent cases.** The silent cases of `@use`'s module isolation (another file's `@function` called, a `!default` set by an earlier file, a project `@function` shadowing a token, a bare call under a namespaced `@use`) are detected by MIG-B9-26.
- **Flag 4 — `PRIORITY_PATTERNS`.** `PRIORITY_PATTERNS` (`variables`, `theme-def`) is removed, since it now only orders the output and listing `_variables` first can break a `with (…)` configured elsewhere: MIG-B9-22.
- **Flags 5, 6, 7, 9, 13, 14, 15 and 18 — accepted as delivered:** watch's first failure prints `build failed:`; warnings are reprinted on every rebuild; adapter warnings are located as text; the gate's extra S-4 to S-6; the CLI keeps `compile()`'s bytes; `--multi` uses `@use` vacuously; A3's fallback limits; Shares as delivered, with MIG-B9-21, 31, 33, 34, 36 and wave 3's playground stories serialized after PR #71.
- **Flag 8 — the `sass` refusals that reach `uxdsl theme`.** They are kept, and MIG-B9-22 pins them with a test.
- **Flag 10 — the error oracles.** A strict comparison of error oracles in `fixtures/parity/run.js` (line 150 compares by substring both ways) goes to MIG-B9-20.
- **Flag 11 — warnings lost when `compile()` throws.** `error.warnings` goes to MIG-B9-21.
- **Flag 12 — MIG-B9-38 registered,** "A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS": S, wave 3, depends on MIG-B9-14 and 22; one new catalogued code. It answers MIG-B9-13's flag 14 and moves to MIG-B9-38 the warning that decision D18 of 2026-11-04 kept with MIG-B9-14, which did not implement it.
- **Flag 16 — MIG-B9-39 registered,** "Every host's watch recovers after a failed compile": wave 3, S or split by its scout, depends on MIG-B9-14, 21 and 22; the adapters re-register the last good dependencies and `err.file`. It also owns the flaky watch-mode test that failed on CI's ubuntu runner for PR #71 and PR #72 (`waitFor timed out`) and the occasionally stale `cli-captures.json` `--check` (MIG-B9-15 §15).
- **Flag 17 — the exclusion by file name.** `generate-entry` excludes only the output file, instead of every file with the entry's file name in any directory: MIG-B9-22 (it matters for MIG-B9-20's `uxdsl-theme.uxdsl`).

The five decisions on MIG-B9-15 are recorded once, in its §15, "Owner
decisions of 2026-11-08", merged with PR #72, and are not repeated here:
flag 1, D3's sentence, which also gives MIG-B9-26 the removal of the
`uxdsl-probe-` prefix exception; flag 2, D1's reading; flag 3,
`/docs/language`, which registers MIG-B9-16, "The playground's
`/docs/language` page on the superset"; flag 4, the files outside Owns and
Shares; and the flaky watch test, which goes to MIG-B9-39.

### Owner decisions of 2026-11-09

On 2026-11-09, after MIG-B9-23 (PR #75, merged into `feat/beta9` as
`dfcd216`) and MIG-B9-22 (PR #76, `08d00e0`) reached `main` (PR #78,
`8dacc8b`), the owner was given 13 numbered recommendations, in Spanish, on
the owner flags of the two deliveries (each story's §15, "Delivery of
2026-11-09", and the bodies of PR #75 and PR #76) and on three housekeeping
items. The owner answered, verbatim:

> todoc omo recomendadi

("todo como recomendado", typed with two slips: "everything as
recommended.") Every recommendation below is therefore the owner's decision
of 2026-11-09; this record is in English. The numbers 1 to 13 are the order
in which the recommendations were given; they belong to this list only, and
a story cites one as "decision 12 of 2026-11-09". Four stories carry an
"Owner decisions of 2026-11-09" block at the end of their §15: MIG-B9-22,
23, 40 and 91. The index registers MIG-B9-44 at the head of wave 4.

MIG-B9-23's flags:

- **Decision 1 — Where D8's fresh directory lives (MIG-B9-23's flag 1).** The corpus runner compiles from `fixtures/sass-corpus/.work/run-XXXXXX/corpus-root`: git-ignored, outside `os.tmpdir()` and holding nothing else, so `$TMPDIR`'s size reaches no measurement. Confirmed: the first reading, not a fresh subdirectory of `os.tmpdir()`.
- **Decision 2 — An execute-only directory (flag 3).** A directory that can be searched but not listed keeps the spelling as written, the base's behavior, through `access(R_OK)` (test T9b), unlike Dart Sass and a realpath-only spelling. Accepted.
- **Decision 3 — AC1's triple (flag 5).** The review's fix to `run.js` (`f442d02`) restarted the count: the first three runner invocations after it, 1.33×, 1.31× and 1.36× from 11:26 EST on 2026-11-09, are AC1's triple; the 13 earlier invocations after the Sass stage's change are recorded in MIG-B9-23 §14. Accepted.
- **Decision 4 — T3's statistic (flag 4).** The budget fixture keeps the difference of the two medians, with 61 rounds by default (C2 allows at least 9). MIG-B9-91 decides whether T3 also reports a paired statistic, the median of per-round differences. Kept.

MIG-B9-22's flags:

- **Decision 5 — AC3 (MIG-B9-22's flag 1).** The literal `grep -c "RussianDoll"` on `uxdsl.css` is 0 before and after, since the component's selectors are `.concentric-*` and `.ring-label`. AC3 is read as satisfied by the counts that see the duplicate: lines starting `.concentric-wrapper {` 2 → 1, rules 1,274 → 1,252, the diff being exactly the hunks `3c3,5` and `415,579d416`. Accepted.
- **Decision 6 — `theme-def.uxdsl`'s comment (flag 2).** Its lines 14–15, also in the compiled `uxdsl.css`, still name the deleted script `generate-uxdsl-entry.js`. MIG-B9-40 rewrites the comment.
- **Decision 7 — An entry generated before MIG-B9-22 (flag 3).** It records no invocation, so it is treated as hand-written: watch never rewrites it, and `generate-entry` with no arguments re-runs nothing for it (it writes the defaults, as before, when it is the default output). The documentation tells users to run `generate-entry` once with their options. Kept as delivered, with no start-up hint.
- **Decision 8 — `ENTRY_PRIORITY_PATTERNS` (flag 4).** It is removed whole, `layout` and `app` included, not only `variables` and `theme-def`; a project that relied on those names being listed first uses `--first` (documented as Breaking). Confirmed.
- **Decision 9 — E1's fallback (flag 5; the review's finding F1).** `generate-entry` with no arguments, when no configured entry records an invocation, re-runs the recorded line of the default output file if it has one, and exits 1 naming the file when that line does not parse. Accepted.
- **Decision 10 — E2's watch targets (flag 6; the review's finding F3).** `build --watch` recomputes its watch targets before every selective build too, not only on full rebuilds. Accepted.

Housekeeping:

- **Decision 11 — The index's §7 completed** with the files the two stories touched. The `fixtures/sass-corpus` row lists `run.js`, `run.test.js`, `README.md` and `.gitignore`, for MIG-B9-10, 23 and 25 (MIG-B9-23's flag 2); MIG-B9-22 is added to the rows for `packages/uxdsl/test/cli/**` and `fixtures/mig-b2-03-cli-init/**` (MIG-B9-22's follow-up).
- **Decision 12 — MIG-B9-44 registered,** "The playground's visual comparison harness is deterministic": S, from MIG-B9-22's delivery. `fixtures/playground-browser/snapshot.js`'s interaction step times out on `.density-card__edit-btn`, at the base too, so a snapshot completes only with `--no-interactions`; and two snapshots of one build differ by up to 1,266 box-only differences, from unstyled `<select>` widths of ±4 px, although the fixture's README says they are identical. It must merge before any wave-4 story starts, because every wave-4 story relies on `compare.js`: it is placed at the head of wave 4, which ships in `0.5.0-beta.10` under DEC-03 (b), so `0.5.0-beta.9`'s scope does not change, and MIG-B9-40 depends on it.
- **Decision 13 — `main` merged into `feat/beta9`.** `main` carries two Dependabot updates that `feat/beta9` lacks: PR #52 (`playwright-core` 1.63.0 → 1.64.1 in `fixtures/mig02-nextjs-cssmodules`) and PR #59 (the playground's minor-and-patch group: `@next/mdx`, `@types/mdx`, `react-syntax-highlighter` and `postcss-loader`). `packages/uxdsl` is identical on both. The documentation PR that records these decisions carries that merge.

The deliveries' other notes were not among the recommendations and are not
decisions; they stay where the deliveries wrote them. Among them are
MIG-B9-23's flags 6 to 8: the story that merges second rebases its CHANGELOG
subsection and README sentence, MIG-B9-21 rebases on MIG-B9-23, and the PR
targets `feat/beta9`.

### Owner decisions of 2026-11-10

On 2026-11-10, after PR #80 wrote the story files of MIG-B9-16 and MIG-B9-24
to 29, the owner was given 32 numbered questions, in Spanish, each with its
options and a recommendation. Questions 1 to 29 are the open questions of
those story files' §15, numbered across PR #80's body in this order:
MIG-B9-16, 25, 26, 27, 28, 29, 24. Questions 30 to 32 came from PR #80's
delivery notes. The owner answered, verbatim:

> fusiona y haz como recmiendes

("fusiona y haz como recomiendes", typed with one slip: "merge, and do as
you recommend.") PR #80 was merged into `feat/beta9` (`e704b3e`), and every
recommendation below is therefore the owner's decision of 2026-11-10; this
record is in English. The numbers 1 to 32 are the order in which the
questions were given; they belong to this list only, and a story cites one
as "decision 6 of 2026-11-10". Eleven stories carry an "Owner decisions of
2026-11-10" block at the end of their §15: MIG-B9-16, 17, 24 to 29, 51, 52
and 91. The index splits MIG-B9-26's row into MIG-B9-26 and MIG-B9-17
(wave 2), registers MIG-B9-66 (wave 6), and its §7 follows both and makes
`migration.md` append-only.

MIG-B9-16 (its §15, Q1 and Q2):

- **Decision 1 — How much of `/docs/language` the story rewrites (Q1).** (c): the registered passages (`page.tsx:28` and 107–133), the subtitle and first heading ("A .uxdsl file is CSS"), and the directive paragraph. Its C6 and C7 apply.
- **Decision 2 — A directive inside `@media` or `@supports` under its rule (Q2).** (a): it compiles through `compile()` and is `UXD_DIRECTIVE_CONTEXT` through the plugin alone, as intended, and the page documents the asymmetry. AGENTS.md's sentence becomes a follow-up, proposed for MIG-B9-51.

MIG-B9-25 (Q1 to Q3):

- **Decision 3 — What `--keep` leaves (Q1).** (a): `fixtures/sass-corpus/run.js --keep` leaves the corpus as installed; the mixed check's two files are removed.
- **Decision 4 — The scope (Q2).** (a): `npm test` only. The release gate's leftovers become a follow-up, proposed for MIG-B9-91.
- **Decision 5 — A failing test's temporary directories (Q3).** (b): they are kept when the test fails, with the path printed, and the guard keeps its directory. The story had assumed (a) until answered.

MIG-B9-26 (Q1 to Q6):

- **Decision 6 — One story or two (Q1).** (b), a split.
  - MIG-B9-26 keeps the S part, C1 to C3: dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning; the `uxdsl-probe-` prefix exception is removed. It also takes decision 30.
  - The M part, C4 to C6 (module isolation's silent cases), is registered as MIG-B9-17, in wave 2, right after MIG-B9-26. Its story file is made from MIG-B9-26's C4 to C6 material: contract, tests, acceptance criteria, sources, questions 9 to 11 and their answers.
- **Decision 7 — `@debug`'s code (Q2).** (a): `UXD_SASS_WARNING`, with "DEBUG:", and the catalog's meaning of that code is extended.
- **Decision 8 — The `uxdsl-probe-` prefix (Q3).** (c): a random tag per `compile()` call, which reaches no result.
- **Decision 9 — The isolation code (Q4).** (a): one code, named `UXD_MODULE_ISOLATION`. It is now MIG-B9-17's.
- **Decision 10 — A function named like a UXDSL function and called through a namespace (Q5; DEC-17's pattern).** (a): a bare call that keeps the token warns only when no call reaches the definition. It is now MIG-B9-17's.
- **Decision 11 — When a `!default` warns (Q6).** (b): only when the earlier file that assigns it emits no CSS, as a settings file does. It is now MIG-B9-17's.

MIG-B9-27 (Q1 to Q3):

- **Decision 12 — The real plugins for the tests (Q1).** (b): stand-ins in `npm test`, plus a fixture run by hand that installs the pinned real plugins, postcss-nested and postcss-simple-vars among them.
- **Decision 13 — What "every contract" means for a stylesheet with Sass plus another UXDSL mistake (Q2).** (a), the strict reading: the plugin alone returns BASE's results for every input.
- **Decision 14 — MIG-B9-13's CHANGELOG item that outcome A makes false (Q3).** (b): if `OnceExit` is adopted (outcome A), MIG-B9-13's `### Breaking` item is also rewritten in the unreleased section, besides the story's new entry. The story had assumed (a).

MIG-B9-28 (Q1 to Q7):

- **Decision 15 — What the Windows job runs (Q1).** (a): the `uxdsl` package's own suites. Option (b)'s second part (parity, the consumer fixtures and the shims on Windows) is registered for `0.5.0-beta.10` as MIG-B9-66, "CI on Windows, part two: parity, the consumer fixtures and the shims": wave 6, after the other wave-6 rows; its size is set by its story file (S, or split); it depends on MIG-B9-28; its status is "Draft (story file to be written; registered by decision 15 of 2026-11-10)".
- **Decision 16 — `verify:1.0` on Windows (Q2).** (a): not in `0.5.0-beta.9`.
- **Decision 17 — Line endings (Q3).** (a): the job sets `core.autocrlf` to `false` before checkout.
- **Decision 18 — The scripts' globs on Windows (Q4).** (a): npm's `script-shell` is set to Git for Windows' bash.
- **Decision 19 — A product defect the job finds (Q5).** (a): the story stops at the first one, and the owner decides each.
- **Decision 20 — A directory whose ACL denies listing, on win32 (Q6, item 1).** (b). If win32 shows the on-disk case where decision 2 of 2026-11-09 keeps the written one, that is recorded as a win32 difference, not a stop. Decision 2 is then narrowed to macOS, and the package README passage the story cites ("On macOS and Windows", lines 1550–1553 on `f855765`) says so. The story's C6c and its stop rule follow this answer; the review's R5 had made a divergence stop the story.
- **Decision 21 — A path component written as an 8.3 short name (Q6, item 2).** (a): the written spelling is kept (MIG-B9-23's C3).
- **Decision 22 — The CLI's path separators on Windows (Q7).** (a): native separators, and the tests compare regardless of separator.

MIG-B9-29 (Q1 to Q3):

- **Decision 23 — A name that reads both ways (Q1).** Role `body-text`'s former `body-text-transform` is role `body`'s canonical name. (b): the canonical reading wins, plus an `unresolved:` report when the theme defines the former role. The story had assumed (a).
- **Decision 24 — F1: without `--theme` the first path argument is dropped (Q2).** So `npm run codemod:canonical-grammar -- <path>` fails. (b): fixed in this story, with the one-line fix, C6 and one test. The story had assumed (a).
- **Decision 25 — Generated outputs (Q3; MIG-B9-03's finding 7).** (a): MIG-B9-52 documents running the codemod over sources only.

MIG-B9-24 (Q1 to Q4):

- **Decision 26 — The candidates (Q1).** (b): the output-free C2 and C3 (`plugin.ts`), plus one engine pass per compilation (C1: `theme-validate.ts`, `theme-generator.ts`).
- **Decision 27 — The gated candidates (Q2).** (a): the stage map only on request, and Dart Sass's map without `sourcesContent`, stay out.
- **Decision 28 — A timing criterion (Q3).** (a): none. The deterministic counts are the contract; timings are indicative and go in §14.
- **Decision 29 — A theme value PostCSS cannot parse, though `validateTheme` accepts it (Q4).** (a): every error is kept. C2 skips only the inspection.

From PR #80's delivery notes:

- **Decision 30 — `compile()` from standard input.** `compile()` fails when the main module is standard input (`node -`): Dart Sass's `NodePackageImporter`, which the Sass stage constructs on every pass (`compile-sass.ts`, about line 669), reads `process.argv[1]` and throws `ERR_INVALID_ARG_VALUE` for `-`. Three story files found it: MIG-B9-16 (F2), MIG-B9-24 (new fact 6) and MIG-B9-26 (F1).
  - The fix goes in MIG-B9-26's S part. When `process.argv[1]` is not a file path, the Sass stage gives `NodePackageImporter` the current working directory as its entry-point directory.
  - A test runs `compile()` from `node -`. Its negative control is BASE's `ERR_INVALID_ARG_VALUE`.
- **Decision 31 — `migration.md` is append-only.** `packages/uxdsl/docs/migration.md` is append-only, like the CHANGELOG: one subsection per story, as the index's §7 row for it now says. A story that rewrites an existing passage of `migration.md` lists it in Shares and is serialized as before. Consequence: MIG-B9-32, 33, 34 and 36 no longer wait for MIG-B9-26 and 27 on `migration.md`, unless another shared file keeps the wait.
- **Decision 32 — Header statuses.** Some story files of waves 4 to 6, and MIG-B9-90's, had a header Status of "Ready" while their row in the index's §5 read otherwise: MIG-B9-41 to 43, 50 to 52, 54, 55, 60 to 65 and 90. Each header Status is set to its row's value.

PR #80's other notes were not among the questions and are not decisions;
they stay where PR #80 wrote them. For example, MIG-B9-51 and 52 list
`scripts/agent-guide.test.js` and `migration.md` under Owns; their
re-baseline after wave 3 moves those to Shares.

## 3. Scope, in waves

The stories are grouped in waves. A wave is an order, not a release: under
DEC-03, as revised on 2026-11-04, waves 0 to 3 ship in `0.5.0-beta.9`, which
MIG-B9-91 closes after wave 3, and waves 4 to 6 ship in `0.5.0-beta.10`,
which MIG-B9-90 and MIG-B9-92 close. MIG-B9-91 is the one story out of its
wave's order: it belongs to wave 7 but integrates after wave 3 and before
wave 4, since `0.5.0-beta.9` ships waves 0 to 3 (D13), and its row in the
index's §5 sits there.

| Wave | What | Stories | Release |
| --- | --- | --- | --- |
| 0 | Housekeeping and validation: numbering, dependencies, `main` proven on a real project, the language refuses near-misses, byte-preserving plugin. | MIG-B9-01 to 05 | `0.5.0-beta.9` |
| 1 | The SCSS superset: tests first, the protect pass, Dart Sass with the `.uxdsl` importer, `compile()` on the new pipeline, the CLI and adapters, the documentation. | MIG-B9-10 to 15 | `0.5.0-beta.9` |
| 2 | One source of truth, less code: the theme at the marker only, deletions, `build --watch` keeps the entry; `compile()` within 1.5× of Dart Sass. Registered on 2026-11-04: the plugin's fixed per-build costs, the suites remove their temporary directories, dotted near-misses and `@debug` through `compile()`, `uxdsl/postcss` in a PostCSS chain, CI on Windows, an idempotent codemod. Registered on 2026-11-08: the playground's `/docs/language` page on the superset. Registered on 2026-11-10, by splitting MIG-B9-26: the silent cases of `@use`'s module isolation warn. | MIG-B9-16, MIG-B9-17, MIG-B9-20 to 29 | `0.5.0-beta.9` |
| 3 | Output-changing decisions, each behind its DEC: `@media (--lg)`, scoped palettes, one `extends` rule for roles and typography, focus, canvas-tone contrast warnings, `:user-invalid`. Registered on 2026-11-04: a located warning for a CSS-wide keyword as a theme token value. Registered on 2026-11-08: a located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS; every host's watch recovers after a failed compile. | MIG-B9-30 to 39 | `0.5.0-beta.9` |
| 4 | The playground as reference implementer: the design-system layer, one demo frame and one editor, the five principles live, nothing hardcoded. Registered on 2026-11-09, first in the wave: a deterministic visual comparison harness. | MIG-B9-40 to 44 | `0.5.0-beta.10` |
| 5 | Documentation and presentation: README and quick start, AGENTS.md and CONTRIBUTING.md, migration guide in English, maintenance signals, "Why UXDSL", the VS Code extension. | MIG-B9-50 to 55 | `0.5.0-beta.10` (MIG-B9-53 is merged already) |
| 6 | Tools for the adoption ladder: `doctor`, `audit` and `migrate --suggest`, the generated reference, `explain` and hover, `emit: 'used'`, the container note. Registered on 2026-11-10, last in the wave: CI on Windows, part two (parity, the consumer fixtures and the shims). | MIG-B9-60 to 66 | `0.5.0-beta.10` |
| 7 | Release: the test exercise, the gates, the records. MIG-B9-91 closes beta.9 after wave 3, before wave 4; MIG-B9-90 and MIG-B9-92 close beta.10 after wave 6. | MIG-B9-90, 91, 92 | MIG-B9-91: `0.5.0-beta.9`; MIG-B9-90 and 92: `0.5.0-beta.10` |

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
| MIG-B7-11 (gate for rc.1) | MIG-B9-91 is beta.9's gate and MIG-B9-92 beta.10's; rc.1 comes after beta.10 (DEC-03). |
| MIG-B7-13 (editor hover with the project theme) | MIG-B9-63. |
| MIG-B7-17 phase D (playground, with the owner) | MIG-B9-42 and MIG-B9-43. |

## 5. Release

The beta.9 gate is MIG-B9-91. After it passes, the owner publishes
`uxdsl@0.5.0-beta.9` with `latest` and `beta`, then decides about the five
former names (deprecate; optionally publish the shims). The record of what was
published is `docs/releases/0.5.0-beta.9.md`, written by MIG-B9-91 from the
gate's output. `0.5.0-beta.10` has its own gate and release record,
MIG-B9-92 (DEC-03, revised on 2026-11-04).
