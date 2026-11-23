# FEAT-010 — UXDSL 0.5.0-beta.9: the plan, written for agents

| Field | Value |
| --- | --- |
| Status | Planned on 2026-10-11 over `main` at `685c132`. Every decision confirmed by the owner on 2026-10-23 (§2). MIG-B9-23 added on 2026-11-02, by the owner's decision on MIG-B9-13's AC1. On 2026-11-04 the owner revised DEC-03 to two releases and registered MIG-B9-24 to 29, 37 and 92 (§2). On 2026-11-08 the owner settled the flags of MIG-B9-14 and 15 and registered MIG-B9-16, 38 and 39 (§2). On 2026-11-09 the owner settled the flags of MIG-B9-22 and 23 and registered MIG-B9-44 (§2). On 2026-11-10 the owner answered the open questions of the story files of MIG-B9-16 and 24 to 29 and three notes of their PR, split MIG-B9-26 into MIG-B9-26 and MIG-B9-17, made `migration.md` append-only and registered MIG-B9-66 (§2); under the owner's standing instruction of the same day, MIG-B9-29's delivery flags became decisions 33 to 37, which register MIG-B9-18 in wave 3 (§2). On 2026-11-13, under the same standing instruction, MIG-B9-20's delivery flags became the owner's decisions of 2026-11-13, which assign follow-ups to MIG-B9-21, 60 and 91 (§2). On 2026-11-23 the owner cut `0.5.0-beta.9` to what `feat/beta9` holds at `6cdadaf` plus MIG-B9-91, moved the rest of wave 3 to `0.5.0-beta.10`, and asked for a review of the documentation with Claude before publishing; under the standing instruction, the flags of MIG-B9-17, 24, 27, 28 and 30, and MIG-B9-18's two flags of 2026-11-14, became the owner's decisions of 2026-11-23, which register MIG-B9-68 to 70 and 99 to 103, 100 excepted (§2). Merged: MIG-B9-01 to 05, 10 to 18, 20 to 30, 39 and 53; waves 0 to 2 are complete. The index has each story's status. |
| Goal | Make the definition below true in the code and pinned by tests, then make the playground the best implementer of it. |
| Release | Two releases (DEC-03, revised on 2026-11-04 and on 2026-11-23): `uxdsl@0.5.0-beta.9`, the first publish of the single `uxdsl` package, with every story merged into `feat/beta9` at `6cdadaf` and MIG-B9-91; then `uxdsl@0.5.0-beta.10`, with the rest of wave 3 (MIG-B9-06, 19 and 31 to 38), waves 4 to 6, MIG-B9-90 and MIG-B9-92. |
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
| DEC-03 | **The release cut: two releases, option (b); beta.9 is what `feat/beta9` holds.** `0.5.0-beta.9` ships every story merged into `feat/beta9` at `6cdadaf` (MIG-B9-01 to 05, 10 to 18, 20 to 30, 39 and 53) and MIG-B9-91, the beta.9 gate, which includes the Press Craftor re-run and an English beta.8 → beta.9 migration section; before the owner publishes, the owner and Claude review the documentation together, an owner step of its record. `0.5.0-beta.10` ships the rest of wave 3 (MIG-B9-06, 19 and 31 to 38), waves 4 to 6, MIG-B9-90 and MIG-B9-92, the beta.10 gate and release record (the plan's "91b"). Of the stories registered on 2026-11-04, MIG-B9-24 to 29 ship in beta.9 and MIG-B9-37 in beta.10. | **Decided**, owner, 2026-11-23 (decision 1 of 2026-11-23, third revision: the wave-3 remainder moves to beta.10); 2026-11-04: option (b); option (a) of 2026-10-23 superseded | MIG-B9-91, MIG-B9-92 |
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
scope recommended above (until decision 1 of 2026-11-23, which moved
MIG-B9-06, 19 and 31 to 38 to beta.10). MIG-B9-64's recommended cut, and shipping MIG-B9-60,
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

PR #80's other notes, in its body and in its delivery report, were not
among the questions and are not decisions; nothing here settles them. One
of them, for example: MIG-B9-51 and 52 list `scripts/agent-guide.test.js`
and `migration.md` under Owns, which their re-baseline after wave 3 can move
to Shares.

On 2026-11-10 the owner also gave a standing instruction for FEAT-010,
verbatim:

> fusiona todo.. y preguntas como recomendadas, y sgeuimos

("fusiona todo.. y preguntas como recomendadas, y seguimos", typed with one
slip: "merge everything, and the questions as recommended, and let's keep
going.") Under it, each pull request is merged into `feat/beta9` when CI is
green, and every owner question is answered with its recommended option;
merging into `main` stays the owner's (the index's §2, "Authority").
MIG-B9-29 was merged into `feat/beta9` as PR #82 (`a00fbbe`), and its
delivery left five owner flags (its §15, "Delivery of 2026-11-10", and PR #82's body).
They were not put to the owner one by one: under the standing instruction
each recommendation below is the owner's decision of 2026-11-10, and the
owner may still override any of them. They continue this list's numbering,
as decisions 33 to 37; this record is in English. MIG-B9-29 carries them in
an "Owner decisions of 2026-11-10, on the delivery's flags" block at the end
of its §15, and MIG-B9-91 the two that concern it (decisions 35 and 37) in a
block of the same date. The index registers MIG-B9-18 in wave 3
(decision 36).

MIG-B9-29's delivery flags (its §15, "Delivery of 2026-11-10", owner flags 1 to 5):

- **Decision 33 — Which name C4 reads (flag 1).** (a), the output reading, as delivered: C4 is decided on the name as the run leaves it, and T2's `lead-size` case pins it (the input-only mutant fails it). Run 1 and run 2 print the same C4 `unresolved:` lines for any input. Option (b), only names kept as read, is not taken: with roles `lead` and `lead-font`, run 1 would rename `--uxdsl__typography__lead-size` to `lead-font-size` without a report, and run 2 would report it.
- **Decision 34 — Where C6 is documented (flag 2).** (a), as delivered: one sentence in MIG-B9-29's CHANGELOG subsection only ("Without `--theme`, the first path given is now read."). The package README keeps the single sentence of MIG-B9-29's §11, whose documented commands put `--theme` first.
- **Decision 35 — F8 and the shipped claim "a second run changes nothing" (flag 3).** (a): the package README's "so a second run changes nothing" and the CHANGELOG's "Running the codemod again now changes nothing." stay as written, and F8 is fixed in `0.5.0-beta.9` by MIG-B9-18 (decision 36), so the claim holds when beta.9 ships. Until MIG-B9-18 merges, the claim is broader than the code for a quoted `palette()`/`color()` argument inside a directive (`@ds-surface(palette("primary-main"))` takes two runs). MIG-B9-91's gate requires every wave-3 story merged, MIG-B9-18 included.
- **Decision 36 — F3, F7 and F8 (flag 4).** (a): MIG-B9-18 is registered, "The codemod's directive-argument rewrite is complete in one run": wave 3, S, decision gate none, depends on MIG-B9-29 (merged), branch `feat/b9-18-codemod-directive-arguments`. It runs the dashed-key rewrite on the arguments after the quotes are stripped (F8), rewrites a comma list with function arguments in one run (F3), and leaves a JSON string escape intact (F7). Option (b), folding them into MIG-B9-60's `doctor --fix`, is not taken. MIG-B9-18 ships in `0.5.0-beta.9` with wave 3.
- **Decision 37 — F5, the second codemod instruction in `docs/releases/0.5.0-beta.9.md` (flag 5).** (a): MIG-B9-91 removes it when it writes beta.9's record; MIG-B9-52 does not. Decision D4 of 2026-11-04 had given the release notes' instruction to MIG-B9-52 ("MIG-B9-52's release-notes instruction follows"), which ships in `0.5.0-beta.10`.

### Owner decisions of 2026-11-13

MIG-B9-20 was merged into `feat/beta9` as PR #88 (`cc10de6`) on 2026-11-13,
with `npm test` and `verify:1.0` green. Its delivery left eight owner flags,
F1 to F8 (its §15, "Delivery of 2026-11-13", and PR #88's body). They fall
under the owner's standing instruction of 2026-11-10 for FEAT-010, quoted
in the block above, verbatim:

> fusiona todo.. y preguntas como recomendadas, y sgeuimos

("merge everything, and the questions as recommended, and let's keep
going.") The flags were not put to the owner one by one: under that
instruction each recommendation below is the owner's decision of
2026-11-13, and the owner may still override any of them. This record is in
English. The numbers 1 to 11 belong to this list only, and a story cites one
as "decision 3 of 2026-11-13". Four stories carry a block of this date at
the end of their §15: MIG-B9-20 ("Owner decisions of 2026-11-13, on the
delivery's flags"), MIG-B9-21, 60 and 91. No new story id is registered.

MIG-B9-20's delivery flags (its §15, "Delivery of 2026-11-13", "Owner flags"):

- **Decision 1 — When the build-level "none" warning fires (F1).** (c), as implemented: only when the build's CSS references a `--uxdsl__` token and some output can carry the theme (not a `*.module.css` `outFile` in the CLI, not a `*.module.uxdsl` resource in webpack). Token-free builds and modules-only builds stay silent.
- **Decision 2 — A theme delivered out of band (F2).** A project that delivers its theme through SSR `generateThemeCss`, `applyTheme` or another build warns "none" on every build. (a) for `0.5.0-beta.9`: the warning is kept, and the case is to be documented. MIG-B9-60's doctor revisits it (decision 10). Option (b), suppressing it through `references`, is not taken.
- **Decision 3 — A generated entry's first leading comment moves after the theme block (F3).** (a), accepted and recorded under the CHANGELOG's "Visual changes", as done: the playground's `uxdsl.css` keeps its byte count (332,334 bytes), with `/* Single opt-in gate for DS typography */` moved. Option (b), MIG-B9-40 moving the playground comment, is not taken.
- **Decision 4 — Gate checks S-5 and S-6 (F4).** (a), as implemented: each expects the Dart Sass deprecation plus exactly one `UXD_THEME_MARKER`.
- **Decision 5 — The Vite dev server has no end of build (F5).** (a), as implemented: it warns "many" only, once per change of the emitting set; `vite build` is the gate.
- **Decision 6 — webpack's limits (F6).** (a): webpack stays silent in child-compilation mode, under `thread-loader` or a bare loader runner, in a new process whose persistent cache restores every `.uxdsl` module, and in Turbopack; the limits are accepted and documented. Option (b), a public `UxdslWebpackPlugin`, is not taken.
- **Decision 7 — One `UXD_OPTION_REMOVED` template (F7).** (a), as implemented: one template for the five removed options (`includeTheme`, `breakpoints`, `themeVar`, `spaceVar`, `colorVar`), checked on the plugin, `compile()`, Vite and webpack.
- **Decision 8 — The CLI's theme warning text against M4's literal sentence, and the "none" hint (F8; review findings CT-3 and HB-5).** (b).
  - The coded text shared with Vite and webpack stands as M4's implementation, a recorded deviation from M4's literal sentence.
  - The CLI's "none" hint is reworded so that it is true in general, for example " An entry generate-entry wrote without --no-theme loads its theme file; run uxdsl generate-entry again if that file is missing."
  - The rewording is code: the CLI message, `cli-captures.json` regenerated, `cli.md`, the CHANGELOG and the CLI tests. It is assigned to MIG-B9-21, the next story on `bin/uxdsl.js` and `packages/uxdsl/test/cli/**`, as an added item, together with RR-1: drop the `MIG-B6-21 (FEAT-008):` prefix from the reworded comment above `loadConfig`'s sourcemap validation in `bin/uxdsl.js`.

Follow-ups the delivery recorded (its §15, "Follow-ups"), as assignments:

- **Decision 9 — MIG-B9-91 (review finding DGE-2).** It refreshes `docs/releases/0.5.0-beta.9.md:33`, which still shows `'uxdsl/postcss': { includeTheme: false }`, and marks as superseded the two older beta.9 CHANGELOG subsections that still describe `includeTheme` as current.
- **Decision 10 — MIG-B9-60.** The doctor counts the PostCSS plugin's `{ type: 'uxdsl-theme', plugin: 'uxdsl', emitted }` result message, for the host that runs the PostCSS plugin alone, and revisits F2 (decision 2).
- **Decision 11 — MIG-B9-16 keeps its own scope.** The language page's stale "SCSS-style subset" section, which the delivery names, is already in it: its C1 replaces the section that starts at `<h2 id="scss">`, and its §3 precondition `grep -q "<h2 id=\"scss\">The SCSS-style subset</h2>" packages/playground-nextjs/src/app/docs/language/page.tsx` exits 0 on `5a041fc`. MIG-B9-20 rewrote only the marker passage above it, so the heading moved from line 107 to line 110. MIG-B9-16's §3 and §4 are re-run when it starts on a base that includes MIG-B9-20, as its header says.

The proposed MIG-B9-67, per-page or per-chunk theme counting on the CLI,
Vite and webpack, is not registered: the owner has not asked for it, and it
stays a proposal in MIG-B9-20's §15. The delivery's other notes, such as
its list of what Press Craftor must change on `0.5.0-beta.9`, were not
among the flags and are not decisions.

Two facts checked on `5a041fc` while recording, not decisions:

- The delivery places the first stale CHANGELOG passage in MIG-B9-22's subsection, "about line 384". On `5a041fc` it is `packages/uxdsl/CHANGELOG.md:423–425` ("The Next.js PostCSS setup is unchanged (`'uxdsl/postcss': { includeTheme: false }`, no `@uxdsl theme;`)"). It sits in MIG-B9-14's subsection, "The CLI, Vite and webpack on the Sass pipeline (MIG-B9-14)" (heading at line 362), which commit `e51b775` added. The second passage is DE-9's "Added: `@uxdsl theme;`" subsection (heading at line 1025; `includeTheme` at lines 1027, 1030 and 1031).
- Decision 2 keeps the warning "and documents it", but no shipped document states the out-of-band case on `5a041fc`. `cli.md`, `vite.md`, `webpack.md` and `compile.md` (the theme-warning passages), `migration.md`'s new beta.9 section, the package README and the CHANGELOG's MIG-B9-20 subsection were searched. What they say is that the warning cannot be silenced: "There is no switch to silence it." (`cli.md:416`) and "There is no switch to silence the warning." (`vite.md:153`, `webpack.md:141`). This record does not assign the missing sentence to any story; who writes it is an open question for the owner, Q1 of MIG-B9-21's §15.

PR #89 (merged into `feat/beta9` as `d1e07a3` on 2026-11-13) wrote the
story files of MIG-B9-18, 37, 38 and 39, and its body put 22 numbered open
questions to the owner: the "Open questions for the owner" of MIG-B9-18's
§15 (its Q1 to Q5), MIG-B9-21's (Q1, Q2), MIG-B9-37's (Q1 to Q5),
MIG-B9-38's (Q1 to Q4) and MIG-B9-39's (Q1 to Q6), in that order. They fall
under the owner's standing instruction of 2026-11-10, quoted above,
verbatim:

> fusiona todo.. y preguntas como recomendadas, y sgeuimos

("merge everything, and the questions as recommended, and let's keep
going.") They were not put to the owner one by one: under that instruction
each question's recommended option below is the owner's decision of
2026-11-13, and the owner may still override any of them. PR #89's body
listed six of them as recommendations that widen a registration, for the
owner to look at before they apply: its questions 1, 5, 13, 17, 18 and 19,
which are decisions 12, 16, 24, 28, 29 and 30 here. This record is in
English. The decisions continue this list's numbering, as decisions 12 to
33, in PR #89's order, so PR #89's question n is decision n + 11 of
2026-11-13. The lead-in above was written for decisions 1 to 11: its "No new
story id is registered" and its four stories stay true of those eleven.
Decisions 28 and 29 register two story ids, MIG-B9-19 and MIG-B9-06. The
standing instruction assigns no id, so the recorder took them, as each
decision says, and the owner may renumber them. Six stories carry an "Owner
decisions of 2026-11-13" block for these decisions at the end of their §15:
MIG-B9-18, 19, 21, 37, 38 and 39.

MIG-B9-18 (its §15, Q1 to Q5; PR #89's questions 1 to 5):

- **Decision 12 — Only the dashed-key rewrite, or every token rewrite, after the quotes are removed (Q1).** (b): every token rewrite applies to a directive's arguments after the quotes are removed, so a quoted `radius("full")` (F9) is finished in one run too. C6 and T6 are added, and C1 loses its one exception. It widens decision 36 of 2026-11-10's wording ("It runs the dashed-key rewrite on the arguments after the quotes are stripped"); the story's contract had assumed (a). Decision 35 of 2026-11-10's claim, "a second run changes nothing", then holds for every input when beta.9 ships.
- **Decision 13 — A comma inside a nested call (Q2).** (a), as the contract assumed: BASE's rule, every comma inside the directive's parentheses becomes a space, nested ones included.
- **Decision 14 — What "leaves a JSON string escape intact" means (Q3; F7).** (a), as the contract assumed: an escaped quote in a directive's arguments is removed with its backslash, as a plain quote is; no escape is split, and the JSON stays valid.
- **Decision 15 — Does MIG-B9-18 wait for MIG-B9-21 (Q4)?** (a): no, it starts now. MIG-B9-18 edits no file under `packages/uxdsl/src` or `bin`, which MIG-B9-21's K7 rewrites, and shares only the append-only CHANGELOG and package README with it; decision 36 of 2026-11-10 names only MIG-B9-29, merged, as its dependency. The story had assumed (b), the index's §7 sentence "every wave-3 story waits for MIG-B9-21" as written. Its header's Depends on and Base drop MIG-B9-21, and the index's §7 records MIG-B9-18 as the one exception to that sentence.
- **Decision 16 — F3's form without parentheses (Q5).** (b): both of F3's forms, the comma list in parentheses and `@ds-surface contained radius(2);`. C3's bullet for the form without parentheses, T2's `.b` and `.b2` cases and AC2's `.b` line are part of the contract. It widens decision 36 of 2026-11-10's paraphrase ("rewrites a comma list with function arguments in one run (F3)"); the contract had assumed (a).

MIG-B9-21 (Q1, Q2; PR #89's questions 6 and 7):

- **Decision 17 — Who documents decision 2's out-of-band case (Q1).** (a), as the story assumed: MIG-B9-21 writes one sentence next to each of the "no switch" lines of `cli.md`, `vite.md` and `webpack.md` ("There is no switch to silence it.", `cli.md:416`; "There is no switch to silence the warning.", `vite.md:153` and `webpack.md:141`, on `5a041fc`), with its F8 edit of `cli.md`. `vite.md` and `webpack.md` are in its Shares, as they already are on `d1e07a3`. MIG-B9-21 is being implemented with this answer applied. This settles the open question the second fact above recorded.
- **Decision 18 — Who waits for whom on the files decision 8 adds (Q2).** (a), as the index assumed: the index's §5 order stands, and MIG-B9-25 and MIG-B9-16 wait for MIG-B9-21 on `packages/uxdsl/test/cli/**` and `packages/playground-nextjs/**`.

MIG-B9-37 (Q1 to Q5; PR #89's questions 8 to 12), each (a), as the contract assumed, so §5 of the story does not change:

- **Decision 19 — Where the warning is located (Q1).** (a): the key path, from `validateTheme`, relayed by every path as `UXD_THEME_FAMILY` is.
- **Decision 20 — The code (Q2).** (a): a new catalogued code, `UXD_THEME_KEYWORD`, owner `theme`.
- **Decision 21 — A keyword that is the whole of a breakpoint group (Q3).** (a): only a value that is itself a keyword warns.
- **Decision 22 — `generateThemeCss` (Q4).** (a): unchanged; a caller that wants the warning calls `validateTheme` on the same theme, and the README says so.
- **Decision 23 — How the CLI prints it (Q5).** (a): once per process, at its key path, by `warnUnknownThemeKeys`, whose filter is extended to the new code; `bin/uxdsl.js` stays in the story's Shares.

MIG-B9-38 (Q1 to Q4; PR #89's questions 13 to 16):

- **Decision 24 — Which hosts print it (Q1).** (a), as the contract assumed: `compile()` reports it in `warnings`, so the CLI, `build --watch`, `uxdsl/vite`, `uxdsl/webpack` and any direct caller print it, located. It goes beyond the registered title's word "CLI", so the story is retitled to say what the answer makes it: "A located warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS". The title registered on 2026-11-08, "A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS", is recorded in the story's §15.
- **Decision 25 — The code (Q2).** (a): `UXD_PLAIN_IMPORT`, owner `compiler`.
- **Decision 26 — Which URLs (Q3).** (a): the URL's path, before `?` or `#`, ends with `.uxdsl`, `.scss` or `.sass`, compared without regard to case, for every scheme.
- **Decision 27 — The byte count (Q4).** (b), as the contract assumed: the `(<n> bytes)` fix rides along, two `Buffer.byteLength` expressions in `bin/uxdsl.js`.

MIG-B9-39 (Q1 to Q6; PR #89's questions 17 to 22):

- **Decision 28 — One M story, or two S stories (Q1).** (b), a split into two S stories, as Q1 (b) describes; the contract had assumed (a), one M story.
  - MIG-B9-39 keeps the adapters: C1 to C5, T1 to T10, AC1 to AC3, and AC7 to AC9 for its part. It shares only `vite.ts`, `webpack.ts`, `vite.md`, `webpack.md`, the two adapter fixtures and the append-only rows, so under the index's §7 it waits for MIG-B9-21 alone on its files.
  - The second story, the CLI and the tests, C6 to C9, T11 to T14, AC4 to AC6, and AC7 to AC9 for its part, is registered as MIG-B9-19, "The CLI's watch recovers after a failed compile, and its flaky watch test and captures check name what failed": wave 3, S, decision gate none, depends on MIG-B9-14, 21 and 22 (MIG-B9-39's registration); it is on `bin/uxdsl.js`, `packages/uxdsl/test/cli/**`, `cli.md` and `packages/playground-nextjs/**`, as MIG-B9-39 was; branch `feat/b9-19-cli-watch-recovers`. The title given to the recorder, "… and its watch test is stable", was adjusted: C8 makes the two CI-flaky tests diagnosable and C9 makes the captures check name the differing line, and neither promises stability (decision 32).
  - Each keeps its C-n, T-n and AC-n as numbered in MIG-B9-39, and the "must stay byte-identical" list applies to both. Neither story depends on the other: they share only the append-only CHANGELOG and package README.
  - The id: the owner assigns ids, and the standing instruction does not, so the recorder took the first free id in the 1x range, 19, as MIG-B9-17 and 18 had been taken. The owner may renumber.
- **Decision 29 — The CLI watch's four older gaps (Q2).** (a), as the contract assumed: a separate story, registered as MIG-B9-06, "The CLI watch's four older gaps, the same class in the adapters, and an error while a recreated watcher starts". It covers MIG-B9-14 §15's four gaps (the queued selective batch that runs outside `building`; a glob root or plain `watch` path deleted and re-created; a file modified after Dart Sass read it, during the build that first loads it; a missing partial created where no pattern matches), the same class in the adapters (a partial that never existed, created later), and MIG-B9-22's uncaught error while a recreated watcher starts. Wave 3, S, decision gate none, after MIG-B9-19 and, for the adapters' class, MIG-B9-39; on `bin/uxdsl.js`, `packages/uxdsl/test/cli/**` and `cli.md`, provisionally until its story file states its Owns and Shares. Status "Draft (story file to be written; registered by decision 29 of 2026-11-13)". The id: the 1x range has no free id after 19, so the recorder took the lowest free id, 06; ids name stories, not waves (MIG-B9-17 is in wave 2 and MIG-B9-18 in wave 3). The owner may renumber. The fourth gap's documented limit (`cli.md`'s Watch mode, accepted by MIG-B9-14's flag 15) stays until MIG-B9-06 fixes it.
- **Decision 30 — Two extensions of "the last good dependencies and `err.file`" (Q3).** (a), both, as the contract assumed: (i) the CLI follows the file a failed build names (C6, now MIG-B9-19's), and (ii) the adapters also register the discovered theme file's tree on a failed compile, the first included (C1 (c), C2 (c), C3 (d), MIG-B9-39's). It widens the registration's words "the adapters re-register the last good dependencies and `err.file`".
- **Decision 31 — The path in webpack's error text (Q4).** (a): relative to `rootContext`, with the frame and no stack (C5, MIG-B9-39's).
- **Decision 32 — When the flake and the captures count as done (Q5).** (a): C7 and C8 for the test and C9 for the captures, AC5's and AC6's stress runs, and the PR's CI runs; a later occurrence is recorded with its named step by the story whose run sees it, and routed by the owner. It now concerns MIG-B9-19.
- **Decision 33 — The atomic-replace watch failure seen once on CI, Dependabot's PR #84 (Q6).** (a): out of scope for MIG-B9-39 and MIG-B9-19; the owner routes it. Q6 (a) names MIG-B9-06 only as an example ("for instance to Q2's story"), so no story is assigned it here.

### Owner decisions of 2026-11-15

Three stories were merged into `feat/beta9` on 2026-11-15: MIG-B9-21 as
PR #92 (`cf98cb8`), MIG-B9-16 as PR #93 (`44eac7c`) and MIG-B9-25 as PR #94
(`99f6a82`). Their §15 holds the flags they raised and the follow-ups they
proposed: MIG-B9-21's "Delivery of 2026-11-15" (owner flags 1 to 5 and its
follow-ups); MIG-B9-16's "Owner decisions taken under the standing
instruction of 2026-11-10" (the scout's flags 1 to 3) and its "Delivery of
2026-11-15"; and MIG-B9-25's "Owner decisions taken under the standing
instruction of 2026-11-10 (2026-11-15)" (flags 1 to 8) and its "Delivery of
2026-11-15". They fall under the owner's standing instruction of 2026-11-10
for FEAT-010, quoted above, verbatim:

> fusiona todo.. y preguntas como recomendadas, y sgeuimos

("merge everything, and the questions as recommended, and let's keep
going."), which the owner reaffirmed on 2026-11-13, verbatim:

> haz todo como recomendado

("do everything as recommended."), explicitly including recommendations
that widen a registration. The flags were implemented as recommended and
were not put to the owner one by one: each recommendation below is the
owner's decision of 2026-11-15, and the owner may still override any of
them. Where a follow-up named two possible homes without choosing, the
decision chose the recommended one and gives the reason; each such decision
is marked *routing*, and each one that registers a new story *widening*.
This record is in English. The numbers 1 to 28 belong to this list only,
and a story cites one as "decision 17 of 2026-11-15". Decisions 17 and 18
register two story ids for `0.5.0-beta.10`, MIG-B9-94 and MIG-B9-95, the ids
MIG-B9-21's delivery proposed; the owner may renumber them. No other id is
registered: MIG-B9-96 waits on MIG-B9-39's delivery (decision 19), MIG-B9-97
is not taken (decision 21) and MIG-B9-98 is not needed (decision 25). Eight
stories carry a block of this date at the end of their §15: MIG-B9-21, 16
and 25 ("Owner decisions of 2026-11-15, on the delivery's flags"), and
MIG-B9-19, 28, 43, 51 and 91 ("Owner decisions of 2026-11-15 (apply before
implementing)"). MIG-B9-39, in progress on its own branch, carries none:
decisions 15, 19 and 27 concern it and are recorded here only, and its §15
note follows when it merges. No decision of this list concerns MIG-B9-26,
also in progress.

MIG-B9-21's delivery flags (its §15, "Delivery of 2026-11-15", "Owner
flags", each implemented as its recommendation):

- **Decision 1 — The CLI and a theme file in the working directory (flag 1, K3 against K8).** (a), as implemented: "The CLI passes `discoverTheme: false`", so a `uxdsl.theme.json` in the working directory no longer stands in, silently, for a build config's missing theme file (the leak MIG-B9-21's "Facts re-measured on `d1e07a3`" reproduced). Not taken: (b) "Keep the leak and list both keys as unforwarded"; (c) "Pass `configRoot` = the config's directory, which searches twice". The story records that (b), if chosen instead, "is a one-line revert plus the list entry".
- **Decision 2 — Warnings printed before an error against the frozen checks (flag 2).** (a), as implemented: "`fixtures/parity/run.js` compares the CLI output from `[uxdsl] Error:` on, still exactly, and `error-location.test.js` scopes its two `doesNotMatch` assertions to that part." Not taken: (b) "No host prints"; (c) "Re-record the oracles, which K8 forbids".
- **Decision 3 — K5 against decision 7 of 2026-11-13 (flag 3, informational).** (a): "Keep all five `REMOVED_OPTIONS`, with no generic warning here." Not taken: (b) "Also add a generic unknown-option warning, a new `UXD_` code"; (c) "Delete three and add the generic warning". The generic warning is decision 17's story.
- **Decision 4 — The extended Shares (flag 4).** (a): the Shares extended for the decided items (`a90042b`, the block "Facts re-measured on `d1e07a3`") are kept. Not taken: (b) "Restrict, deferring K3's doc corrections and the parity narrowing".
- **Decision 5 — A `code` on the CssSyntaxError `compile()` throws for a UXDSL error (flag 5, MIG-B9-39's F3).** (a): "Not here." Not taken: (b) "Add it here." Its destination is decision 19.

MIG-B9-16's flags (its §15, "Owner decisions taken under the standing
instruction of 2026-11-10", flags 1 to 3, raised by the scout on
2026-11-15 on `cf98cb8`):

- **Decision 6 — AC2's total floor (flag 1).** (a): AC2's text ("at least 64 examples (62 on `f855765`)") is not rewritten, though the base has 65 and meets it trivially. The intended floor, measured on `cf98cb8`, is 65 plus the page's net gain, with the page's own count by route (at least 8 examples, at least 3 through `compile()`, 0 problems, under decision 1 of 2026-11-10) as the binding evidence; with the `@each` example kept (decision 8), the derived floor is 69. Not taken: (b) ask the owner to amend AC2's number before implementing.
- **Decision 7 — T3's reach (flag 2).** (a): T3's checker also reports `<h2 id="css">It is CSS</h2>` and `or inside <code>@media</code> under the rule, it is` when present, and the phrase `every SCSS file is a valid UXDSL file` when missing, and T4 embeds base lines 24 and 79–80 and proves each is reported. It gives C6, C7 and C1.2 their negative controls; the checker does not assert `uxdsl-probe-`, which MIG-B9-26 will change (F4). Not taken: (b) T3 as §8 lists it, plus the subtitle check of decision 1 of 2026-11-10.
- **Decision 8 — The base's `@each` example (flag 3).** (a): kept, as a second `compile()` example, the only one that interpolates a Sass variable into a directive argument. Not taken: (b) drop it, since the new feature example also shows `@each` over a map.

MIG-B9-25's flags (its §15, "Owner decisions taken under the standing
instruction of 2026-11-10 (2026-11-15)", flags 1 to 8):

- **Decision 9 — A directory made where no test context is in scope (flag 1).** (a): "The exit path wherever no `t` is in scope: such a directory follows its file's exit code, so a failing file keeps all of them and a passing file removes them all; no call site or test signature changes." Not taken: (b) thread `t` through every helper and test callback ("hundreds of edited call sites, against §6"); (c) mixed, file by file.
- **Decision 10 — `watch-mode.test.js` (flag 2).** (a): "The exit path in `mkProject`: a piped child keeps the file's process alive until it exits, so the removal runs after every watcher is gone; no hook edits." Not taken: (b) "Pass `t` and replace about 30 hooks with a kill that awaits `exit`." MIG-B9-19 inherits the constraint (decision 27).
- **Decision 11 — The guard when the command cannot be spawned (flag 3).** (a): it prints `tmpdir-guard: cannot run <command>: <reason>`, then follows C3's failure branch: it keeps the directory, prints the kept line and exits 1, tested by `MIG-B9-25: the guard keeps its directory and exits 1 when the command cannot be run`. Not taken: (b) print the reason, remove the empty directory, exit 1; (c) Node's default, an unhandled error.
- **Decision 12 — The helper's line for a kept directory (flag 4).** (a): `temporary directory kept: <absolute path>`, through `t.diagnostic` for a test and on stderr for the exit path; T6 and T7 assert it. Not taken: (b) the guard's sentence; (c) free per file.
- **Decision 13 — The CHANGELOG (flag 5).** (a): no CHANGELOG entry; the docs guard is met by the package README sentence. Not taken: (b) a subsection, with the CHANGELOG added to Shares (AC6 and the index's row would change).
- **Decision 14 — T9's kept corpus root when T9 fails (flag 6).** (a): removed in `finally`, pass or fail. Decision 5 of 2026-11-10 concerns temporary directories, and this root is under `fixtures/sass-corpus/.work`, in the repository, where AC5 requires no `.work` afterwards. Not taken: (b) keep it on a failure.
- **Decision 15 — MIG-B9-39's new tests under `test/vite` and `test/webpack` (flag 7).** (a): "The second to merge moves its new tests to the helper; a follow-up for MIG-B9-39 records it." "The guard makes the conflict loud, not silent." Not taken: (b) MIG-B9-25 waits for MIG-B9-39; (c) MIG-B9-39 waits for MIG-B9-25. MIG-B9-25 merged first, so the second is MIG-B9-39 (decision 27).
- **Decision 16 — The guard given no command (flag 8).** (a): it prints `usage: node scripts/tmpdir-guard.js <command> [args…]` on stderr, makes nothing and exits 1, tested by `MIG-B9-25: the guard prints its usage, makes nothing and exits 1 when it is given no command`. Not taken: (b) exit 0 doing nothing; (c) Node's error from `spawn(undefined)`, after the directory is made.

The follow-ups, routed (MIG-B9-21's §15 "Follow-ups", MIG-B9-16's
"Delivery of 2026-11-15" and MIG-B9-25's "Follow-ups" and "Delivery of
2026-11-15"):

- **Decision 17 (widening) — A generic unknown-option warning on the plugin, `compile()`, Vite and webpack (MIG-B9-21's follow-up).** The follow-up: "Any key other than the five removed ones is still ignored silently. Proposed: MIG-B9-60 (doctor) or a new MIG-B9-94." Registered as MIG-B9-94, "Unknown options warn on the plugin, `compile()`, Vite and webpack": wave 6, last in the wave (after MIG-B9-66), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 17 of 2026-11-15)". Reason: nothing is silent, but a new `UXD_` code across four hosts is a design decision of its own, and putting it in `0.5.0-beta.10` leaves beta.9's cut unchanged.
  - The title given to the recorder, "Unknown options warn on every host", was adjusted to the four hosts the follow-up names. On `99f6a82` the CLI already refuses an unknown flag (`Unknown option …`, `packages/uxdsl/bin/uxdsl.js:2673`), but its build config ignores an unknown key: `rejectRemovedConfigKeys` (`bin/uxdsl.js:661–669`) checks only `REMOVED_CONFIG_KEYS`, and a `uxdsl.config.cjs` with `bogusKey: 1` built with exit 0 and no warning. Whether the CLI's build config joins the story is for its story file.
  - MIG-B9-60's registered scope was checked and does not already cover it. Its T2 has `uxdsl doctor` scan a project for known removed items (the five former package names, `uxdsl watch`, `uxdsl.theme.config.*`, `REMOVED_CONFIG_KEYS`, removed grammar, old import and guide paths); no host warns on an unknown option there, so nothing is folded into MIG-B9-60.
- **Decision 18 (widening) — The reference checker ignores `!important` where the CSS cascade does not (MIG-B9-21's follow-up).** The follow-up: "An important `:root` definition followed by a plain one hides a dangling reference in the important one. Fixing it re-records the equivalence oracle. Proposed: a new MIG-B9-95, or 1.0." Registered as MIG-B9-95, "The reference checker follows `!important` as the cascade does": wave 6, last in the wave (after MIG-B9-94), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 18 of 2026-11-15)". It re-records the equivalence oracle (`ORACLE_SHA256`), which MIG-B9-21's K8 kept, so it is not in `0.5.0-beta.9`. Reason: a hidden dangling reference is a silent failure, and 1.0 is later than needed. For context: MIG-B9-21's K6 removed the comparator's dead `!important` term in `reference-core.ts`, and its T5 pins the behavior this story changes ("the definition that applies is the last one in document order, one on the context's own selector before one on `:root`, and `!important` takes no part").
- **Decision 19 (routing) — A `code` on the CssSyntaxError `compile()` throws (MIG-B9-39's F3).** The follow-up: "Proposed: MIG-B9-39, or a new MIG-B9-96 if MIG-B9-39's contract does not take it." It goes to MIG-B9-39 if its delivery, in progress, takes it; otherwise it is registered as MIG-B9-96 when MIG-B9-39 merges. Reason: F3 is MIG-B9-39's own finding, and a new id is needed only if its delivery does not take it. Recorded here only; MIG-B9-39's story file is not edited while it is in progress. On `ef0dc8f`, the head of MIG-B9-39's branch read on 2026-11-15, its §15 still has F3 as written ("Proposed: MIG-B9-21, … or the owner's choice") and no delivery block.
- **Decision 20 (routing) — Removing the 13 `FORMER` engine values together with the shims (MIG-B9-21's follow-up).** The values: `DIAGNOSTIC_CODES`, `TOKEN_FUNCTION_CODES`, `typographyValueToCss`, `TYPOGRAPHY_CSS_PROPERTIES`, `edgeValueToCss`, `DEFAULT_SHADOWS`, `cloneThemeValue`, `THEME_SCHEMA_KEY`, `parseLiteralColor`, `relativeLuminance`, `contrastRatio`, `compositeOver`, `resolveExpression`, which `packages/_deprecated/shims.test.js`'s `FORMER` table pins. No story now: the item is recorded for the story that removes `packages/_deprecated`, none of which is registered, at 1.0 at the latest. FEAT-010 keeps no list of 1.0 items; its out-of-feature list is §3's "Not in this feature, on purpose", and a line after it now records this item and decision 21's.
- **Decision 21 (routing) — The `src`-only engine exports and the semver-bound dead exports MIG-B9-21 listed.** The follow-up: "Proposed: a 1.0 API review story (new MIG-B9-97, or FEAT-011)." A 1.0 API review, outside FEAT-010 (FEAT-011 or later); recorded, not registered here, and MIG-B9-97 is not taken. Reason: K2 removed none of them, and removing an export of a semver-bound entry is a 1.0 change; the `src`-only `uxdsl/engine` exports, though exempt from semver, were kept under K1's literal roots (Q-K1b) and are reviewed with them. The lists are MIG-B9-21's §15, "Dead exports of semver-bound entries, for 1.0" and "Kept in `uxdsl/engine`, for a later decision".
- **Decision 22 (routing) — A watch-mode test that a failed compile's warnings print before its error (MIG-B9-21's follow-up).** MIG-B9-19, "which owns CLI watch recovery", as the follow-up proposed.
- **Decision 23 — T6's remaining blind spots (MIG-B9-21's follow-up).** "A new `src` file before `git add`, and a bare id with no prefix (`B6-17`, `PR #88`)." No story; recorded.
- **Decision 24 (routing) — RR-N1, the unreflowed 118-character comment line in `bin/uxdsl.js` (MIG-B9-21's follow-up).** MIG-B9-19, the next story on `bin/uxdsl.js`. On `99f6a82` it is line 756.
- **Decision 25 (routing) — The playground's ESLint step loads no config (MIG-B9-16's delivery).** `next build` prints `Failed to load config "next/typescript" to extend from`, referenced from `packages/playground-nextjs/.eslintrc.json`, so ESLint checks nothing on the playground. The delivery proposed MIG-B9-43, with "a small story of its own on §7's `packages/playground-nextjs/**` row" as the alternative. MIG-B9-43's registered scope was checked and covers the playground's build hygiene: its H5 moves the playground to the current Next major and requires `npm audit` to be 0, its H1 enforces rules on the playground's sources, and its Shares include `packages/playground-nextjs/**`. It goes to MIG-B9-43, so MIG-B9-98 is not registered. Reason: the story that already enforces the playground's rules and upgrades its Next is where the lint step is restored, and a separate story would wait on the same row.
- **Decision 26 (routing) — `verify:1.0`'s load-sensitive UX-10 and the five directories it leaves (MIG-B9-16's and MIG-B9-25's deliveries).** MIG-B9-91, the beta.9 gate. UX-10 failed once at `doubling cost x3.27` and passed alone at `x2.48` on the same HEAD under load (load average about 28); MIG-B9-91 decides whether it measures on a quieter basis (more repetitions, the minimum of several runs) or records its run conditions. `verify:1.0` leaves five directories in its `TMPDIR` (`uxdsl-1.0-gate-`, `uxdsl-1.0-upgrade-before-`, `uxdsl-vite-adapter-5-`, `uxdsl-vite-adapter-7-`, `uxdsl-webpack-adapter-`), and `packAndInstall` never removes its consumer directory; this is decision 4 of 2026-11-10's follow-up, with the five as its baseline.
- **Decision 27 (routing) — MIG-B9-25's remaining follow-ups.**
  - MIG-B9-19: its watch tests in `watch-mode.test.js` keep `mkProject`'s exit path, or pass `t` only with a kill that awaits the child's exit, registered before the directory's hook (flag 2, decision 10).
  - MIG-B9-28: the guard (`scripts/tmpdir-guard.js`) and MIG-B9-25's §12 loop run on Windows, where `os.tmpdir()` reads `TEMP` and `TMP`.
  - MIG-B9-51: `CONTRIBUTING.md` states the rule for a new test: make its directories with `packages/uxdsl/test/helpers/temporary-directory.js` (or remove them in `t.after`), and expect `npm test` to fail when one is left.
  - MIG-B9-39: it adopts the helper for its new `test/vite` and `test/webpack` tests, since it merges second (flag 7, decision 15). Recorded here only.
- **Decision 28 (routing; closes decision 33 of 2026-11-13) — The atomic-replace watch failure seen once on CI.** The test `MIG-B6-23: an output file is never observed empty or truncated while a rebuild is writing it (atomic replace)` failed once, on Dependabot's PR #84 against `main` (MIG-B9-39 §15, F2; MIG-B9-19 §4.5). It goes to MIG-B9-06, whose story file is still to be written and takes it into its scope; the index's §5 row for MIG-B9-06 says so. Reason: it is a CLI watch-mode failure in `packages/uxdsl/test/cli/watch-mode.test.js`, the class MIG-B9-06 covers, and MIG-B9-06 follows MIG-B9-19 on `test/cli/**`. MIG-B9-19's C8 makes the two other CI-flaky watch tests (lines 36 and 145) name the step that failed; the atomic-replace test, at line 442, is not among them, so MIG-B9-06 starts from its current failure message. MIG-B9-06 is in wave 3, so MIG-B9-91's gate waits for this fix too. Decision 33 of 2026-11-13 is not edited; this decision closes it.

Later on 2026-11-15 two more stories were merged into `feat/beta9`:
MIG-B9-39 as PR #96 (`e89fdb8`) and MIG-B9-26 as PR #97 (`5dace3a`). Their
§15 holds this second batch's flags and follow-ups: MIG-B9-39's "Findings
and owner flags from the scout (2026-11-15)" (flags 1 to 4), "Review
findings and the implementer's (2026-11-15)" (the two flags on AC7's and
AC2's mutations) and "Delivery of 2026-11-15"; and MIG-B9-26's "Owner
decisions taken under the standing instruction of 2026-11-10 (2026-11-15)"
(flags 1 to 4), "Review of 2026-11-15", "Re-review of 2026-11-15" and
"Delivery of 2026-11-15". They fall under the same standing instruction of
2026-11-10, verbatim, "fusiona todo.. y preguntas como recomendadas, y
sgeuimos" ("merge everything, and the questions as recommended, and let's
keep going."), which the owner reaffirmed on 2026-11-13, verbatim, "haz todo
como recomendado" ("do everything as recommended."), explicitly including
recommendations that widen a registration. The flags were implemented as
recommended and were not put to the owner one by one: each recommendation
below is the owner's decision of 2026-11-15, and the owner may still
override any of them. This batch continues this block's list, as decisions
29 to 44 of 2026-11-15, cited the same way; *routing* and *widening* mean
what they mean above. This record is in English. These statements of the
lead-in above, which is not edited, no longer hold: the list now runs from 1
to 44, not 1 to 28; ten stories carry a block of this date, MIG-B9-39 and 26
included, not eight; MIG-B9-39, now merged, carries one, so its decisions 15,
19 and 27 are no longer recorded here only; MIG-B9-39's delivery did not
take F3, so MIG-B9-96 is registered (decision 39); MIG-B9-97 is now taken,
for the Vite adapter fixture on Vite 6 (decision 41), and still not for
decision 21's API review; and decisions 35 to 38 and 42 concern MIG-B9-26.
MIG-B9-96 is the id decision 19 named, and MIG-B9-97 the id this batch gives
(decision 21 had left it untaken); both are for `0.5.0-beta.10`, the owner
may renumber them, and `0.5.0-beta.9`'s cut does not change. MIG-B9-39 and MIG-B9-26 carry a
block "Owner decisions of 2026-11-15, on the delivery's flags" at the end of
their §15. MIG-B9-06, which decision 40 gives one more item, has no story
file: the index's §5 row says what it takes. MIG-B9-17's story file, in
progress on its own branch, is not edited (decision 44).

MIG-B9-39's flags (its §15: the scout's flags 1 to 4, then the two the
review raised and the deliverer answered, each implemented as its
recommendation):

- **Decision 29 — W1, a Vite dev module whose first load failed (the scout's flag 1).** (a), as implemented: "the HMR hook returns the failed node's importers, so Vite sends its own `full-reload` (measured on 7.3.7 and 5.4.21), and V6 keeps its `update`". The story's reason: "It is the only option that recovers the page, and it uses Vite's own propagation on both majors." C2's W1 line ("an `update` naming `/styles/main.uxdsl?uxdsl&lang.css`") is recorded as wrong and is not rewritten: "Vite 5 and 7 never propagate an `update` through a module node they have not analyzed". Not taken: (b) "force an `update` through Vite's internals, which is fragile and still does not recover the page"; (c) "leave W1 a documented limit".
- **Decision 30 — Where the adapters get the theme file's `require()` tree on a failed compile (the scout's flag 2; C1 (c), C2 (c), C3 (d)).** (a), as implemented: "each adapter calls `config.ts`'s existing exports `findThemeConfigPath(configRoot)` and `collectLocalRequireTree(file)` in a `try`, only when `theme` is undefined and `discoverTheme !== false`, so MIG-B9-21's `/discoverTheme(?:Async|Sync)/` guard still holds and `config.ts` is not edited". Its documented limit: "a theme file whose own `require()` throws part-way registers only the theme file, not the files it failed to load." Not taken: (b) "a shared helper in `config.ts`, which adds it to the Shares"; (c) "`compile()` puts its dependencies on its error, which the must-stay list forbids".
- **Decision 31 — `TMPDIR` after the fixtures (the scout's flag 3, AC3).** (a), as implemented: "the new tests clean up after themselves, and the deliverer removes the fixtures' directories by hand and records them as base behaviour". The leftovers of `fixtures/vite-adapter` and `fixtures/webpack-adapter` (`packAndInstall`'s consumer directories) are not fixed in MIG-B9-39; decision 44 says where they go. Not taken: (b) "edit `tarball-consumer.js` here, outside the Shares and against MIG-B9-25's decision".
- **Decision 32 — MIG-B9-25's temporary-directory helper (the scout's flag 4).** (a): "do not wait: the new test files make and remove their own directories (`mkdtemp`, `realpathSync`, `rmSync` in `t.after`), so they pass a leak guard, and whichever story merges second switches them to the helper". MIG-B9-25 merged first (PR #94), so MIG-B9-39 adopted the helper: its two new test files make their directories with `temporaryDirectory` (`test/helpers/temporary-directory.js`), as its §15's "Flag 4 carried out" records. That also carries out decisions 15 and 27 for MIG-B9-39. Not taken: (b) "wait for MIG-B9-25".
- **Decision 33 — AC7's mutation does not hold as written (the review's finding, answered by the deliverer).** (a), as implemented: "pin the must-stay line in the new file, leaving T15's `theme-emission.test.js` unedited as T15 requires (and clear of MIG-B9-25, which may edit `test/webpack`)". The guard is `MIG-B9-39: a webpack module whose compile failed carries no theme flags, so a build whose global fails reports no missing @uxdsl theme`, in `packages/uxdsl/test/webpack/watch-recovery.test.js`. AC7's mutation line is recorded as wrong and is not rewritten. Not taken: (b) "add the test to `theme-emission.test.js`, against T15's 'unedited'".
- **Decision 34 — AC2's mutation "no `hotUpdate` fails T6" (the review's finding, answered by the deliverer).** (a), as implemented: "pin the hook with a spy in T6, so AC2's mutation holds". T6 wraps the plugin's HMR hooks and asserts that on Vite 7 `hotUpdate` is the hook that runs and returns the module, and that `handleHotUpdate` is not called; the contract is not rewritten. Not taken: (b) "record that the mutation that holds is 'no HMR hook' and leave `hotUpdate` unpinned".

MIG-B9-26's flags (its §15, "Owner decisions taken under the standing
instruction of 2026-11-10 (2026-11-15)", flags 1 to 4; flags 1 to 3 raised
by the scout on `99f6a82`, flag 4 by the re-reviews' RR3 and S1):

- **Decision 35 — C1's "declaration value" (flag 1).** (a), as implemented: "protect only inside a property declaration (the statement starts with a property name followed by `:`, not `$`, `@`, `%` or `--`, and does not end with `{`); variable assignments, `@include`/`@return`/`@if` arguments, custom properties and directive arguments keep BASE's behavior". Not taken: (b) "protect any statement that ends with `;`, accepting the leak".
- **Decision 36 — The CLI collapses identical located warning lines (flag 2).** (a), as implemented: "keep the CLI's rule (`compile()` keeps one warning per evaluation; T3's loop uses distinct messages; the CHANGELOG says an identical located line prints once per build)". Not taken: (b) "exempt `DEBUG:` lines, editing `bin/uxdsl.js` outside this story's Shares".
- **Decision 37 — C9's entry-point directory (flag 3).** (b), the recommendation, as implemented: "pass `process.cwd()` when `argv[1]` is not a file path, as the decision words it, and hide `argv[1]` during construction". In the standard-input case the importer gets `process.cwd()`, constructed with `process.argv` cut to `[argv0]` and restored in a `finally`; every other caller keeps `dirname(entryPath)`. The review's R3 recorded that "flag 3's directory choice has no effect a test can see"; flag 3's answer sums it up: "the argv swap is the whole fix". The code is kept as decided. Not taken: (a) "keep `dirname(entryPath)` and only hide `argv[1]` during construction".
- **Decision 38 — R1's fix edits `packages/uxdsl/src/compile.ts`, outside the header's Shares (flag 4).** (a), a **Shares widening**, as implemented: "keep the replay in `compile.ts`, the one place the plugin runs, and widen this story's Shares to it". README §7's `compile.ts` row reads `13, 20, 21, 26, 17, 38`, MIG-B9-26 before MIG-B9-17; the order did not change, since MIG-B9-17 already depended on MIG-B9-26 and had not started. Not taken: (b) "move it into `compile-sass.ts`, which would rebuild the plugin's error (reason, frame, `CssSyntaxError` shape) inside the stage — a second serializer, which AGENTS.md forbids — and throw before any plugin error".

The follow-ups (MIG-B9-39's "Delivery of 2026-11-15"; MIG-B9-26's
"Re-review of 2026-11-15" and "Delivery of 2026-11-15"):

- **Decision 39 (widening; carries out decision 19) — The error `compile()` throws for a UXDSL error carries its `UXD_` code (MIG-B9-39's F3).** MIG-B9-39's delivery: "F3 is not taken here, so it is MIG-B9-96 (decision 19 of 2026-11-15). Giving the `CssSyntaxError` that `compile()` throws a `code` changes `compile.ts` or `diagnostics.ts`, which this story's must-stay list forbids." F3 (its §15, which cites §4.6): "`name=CssSyntaxError`, `code=undefined`, while its message carries `UXD_SPACE_REFERENCE` (§4.6); a `UXD_SASS` error has `code`. A host that branches on `err.code` sees no code there." Registered as MIG-B9-96, "`compile()`'s error for a UXDSL error carries its `UXD_` code": wave 6, last in the wave (after MIG-B9-95), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 39 of 2026-11-15)". The title given to the recorder is kept, with code spans added: it says what F3 and MIG-B9-21's follow-up ("`code` on the CssSyntaxError `compile()` throws") describe. Reason: decision 19 provided for it; a `code` on a thrown error is a new API property that `compile()`'s hosts may branch on, and putting it in `0.5.0-beta.10` leaves beta.9's cut unchanged; as the last wave-6 row it comes after every unmerged story on `compile.ts` and `diagnostics.ts`.
- **Decision 40 (routing) — webpack runs an extra build of a module edited just before a build starts (MIG-B9-39's delivery).** The follow-up: "It was seen locally under load and on CI's ubuntu runner. The new tests pass over it … The older watch tests in `test/webpack/loader.test.js` (MIG-B9-20's `in webpack watch mode the count covers modules the rebuild kept`) still take the next build as the one that carries an edit. Proposed: fold the same `next(step, accept)` into those tests, in **MIG-B9-19** (the story on watch tests) or a new story under an id the owner assigns". It goes to MIG-B9-06, whose story file is still to be written and takes it into its scope, as decision 28 did for the atomic-replace test; the index's §5 row for MIG-B9-06 says so. It joins the adapters' watch class MIG-B9-06 already covers ("the same class in the adapters", which decision 29 of 2026-11-13 defines as "a partial that never existed, created later") and the watch test seen failing once on CI (decision 28); it is a test-harness gap, not that adapter gap, so it is a new item of MIG-B9-06's scope. Reason: MIG-B9-19 is the CLI's watch story, and `packages/uxdsl/test/webpack/loader.test.js` is not in its Shares (`bin/uxdsl.js`, `test/cli/watch-mode.test.js`, the captures, `cli.md`), so taking it there would widen MIG-B9-19; MIG-B9-06 comes after MIG-B9-39, whose new tests' `next(step, accept)` it can reuse, and no new id is needed. This differs from the follow-up's proposal (MIG-B9-19 or a new id). MIG-B9-06 stays in wave 3, so MIG-B9-91's gate waits for it as before.
- **Decision 41 (widening) — The Vite adapter fixture runs on Vite 6 (MIG-B9-39's delivery).** The follow-up: "Vite 6 is untested. `hotUpdate` is the hook on Vite 6 and later, and it was measured only on 7.3.7 and 7.3.8. Proposed: an install of `vite@^6` in `fixtures/vite-adapter`, in **MIG-B9-64** (on `vite.ts`) or a new story." Checked on `5dace3a`: `packages/uxdsl/package.json` declares `peerDependencies.vite: ">=4.0.0"` (optional through `peerDependenciesMeta`), `packages/uxdsl/docs/integrations/vite.md` says "Works with Vite 4 and later (`peerDependencies.vite: ">=4.0.0"`, verified through Vite 8)", and `fixtures/vite-adapter/run.js` runs `vite@^5` and `vite@^7` only. Vite 6 is inside the supported range, so the follow-up is registered as MIG-B9-97, "The Vite adapter fixture runs on Vite 6": wave 6, last in the wave (after MIG-B9-96), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 41 of 2026-11-15)". MIG-B9-97, which decision 21 left untaken, is taken for this. Not routed to MIG-B9-64, which is `emit: 'used'`, not a version matrix. Reason: a major inside the declared peer range that no fixture runs is an untested support claim; `vite.md`'s "verified through Vite 8" is for the story file to check.
- **Decision 42 — Three known differences of MIG-B9-26, recorded for a later diagnostics story (no story now).** Each is loud and on the author's declaration; none is registered.
  - RR4: "When a declaration's value starts on a later line, the evaluated path reports the value's position (`.a {\n  color:\n    palete(primary.main);\n}` at 3:5, through Sass's map) and the replay the property name's (the same declaration in an unused `@mixin` at 2:3), which is C1's 'declaration's start'."
  - RR5: "`color: (xd(primary.main));` evaluated through `compile()` is `UXD_BREAKPOINT_UNKNOWN` (Sass strips the parentheses before the plugin sees the value), where `uxdsl/postcss` alone and the replay give `UXD_FUNCTION_UNKNOWN … did you mean xs()?`." MIG-B9-26's delivery names "README §7's `diagnostics.ts` queue" as its candidate home, "not scheduled".
  - S3: "Inside a Sass function that evaluates its argument (`rgb(palete(primary.main))`, `darken(palete(primary.main), 10%)`), an evaluated dotted near-miss fails as that function's `UXD_SASS` …; through `uxdsl/postcss` alone it is `UXD_FUNCTION_UNKNOWN`." `compile.md`, `migration.md`'s item 6 and the CHANGELOG already say it in one clause.
- **Decision 43 — The host machine suspends during long local runs (MIG-B9-39's delivery).** "A workflow that runs `npm test` on this machine should keep it awake (for example `caffeinate -i`). For the owner; no story." An owner matter; no story.
- **Decision 44 — Follow-ups an earlier decision already routes.**
  - The fixtures' `packAndInstall` directories, which `verify:vite-adapter`, `verify:webpack-adapter` and `verify:1.0` leave (MIG-B9-39's flag 3 and its delivery): decision 26, MIG-B9-91. The delivery proposes "the story decision 15's routing names, or **MIG-B9-25's follow-up**"; decision 15 concerns the helper for MIG-B9-39's own tests, and MIG-B9-25's follow-up on these directories is the one decision 26 routes to MIG-B9-91.
  - The helper for MIG-B9-39's new `test/vite` and `test/webpack` tests (decisions 15 and 27): carried out by MIG-B9-39 (decision 32).
  - MIG-B9-17 meets the near-miss replay (`nearMissError`, after the plugin's warnings are collected) in `compileInto` (MIG-B9-26's delivery): MIG-B9-17's own §15 records it when it delivers, and its story file, in progress on its own branch, is not edited here. README §7's `compile.ts` row already orders MIG-B9-17 after MIG-B9-26 (decision 38).

### Owner decisions of 2026-11-23

After the record of 2026-11-15 (PR #98, merged into `feat/beta9` as
`06c99d1`), five stories were merged into `feat/beta9`: MIG-B9-17 as PR #99
(`f254b24`), MIG-B9-27 as PR #100 (`dec40b1`) and MIG-B9-24 as PR #102
(`6b8e3a9`) on 2026-11-16, then MIG-B9-28 as PR #101 (`461116b`) and
MIG-B9-30 as PR #104 (`6cdadaf`) on 2026-11-23. `feat/beta9` is at
`6cdadaf`.

On 2026-11-17 the owner wrote, in Spanish, verbatim:

> buno en realidad quieor tener beta 9 para empezarlo a mostrar y darle una revisada a la documentacion.. podemos separar l no propritario para beta 10. si me ayudas cone sto,estipular beta 9, alcance y beta 10. alcance, asi nos enfocamos en beta 9, lo que si es que en beta 9 debemos revisar muy bien la documentacion

("well, actually I want to have beta.9 to start showing it and to give the
documentation a review. We can separate what is not a priority into
beta.10. If you help me with this: set out beta.9 and its scope, and beta.10
and its scope, so that we focus on beta.9. What is certain is that in beta.9
we must review the documentation very carefully.") On 2026-11-23 the owner
wrote, verbatim:

> continua por favor.. la idea es dejar una version lista para beta 9.. lo que quede pendiente lo dejamos para la 10.. asi que mergea todo, y deja lista la version..una vez funcinal y antes de publicar.,. revisaremos documnentacionm, pero avisame cuando 9 este lista en codigo..

("continue, please. The idea is to leave a version ready for beta.9;
whatever is still pending we leave for 10. So merge everything, and leave
the version ready. Once it works and before publishing, we will review the
documentation; but tell me when 9 is ready in code.") Decision 1 is what
these two messages decide; this record states it in English.

Decisions 2 to 38 are the owner flags the five deliveries answered with
their recommended option, story by story, in the order the stories were
merged. They fall under the owner's standing instruction of 2026-11-10 for
FEAT-010, quoted above, verbatim, "fusiona todo.. y preguntas como
recomendadas, y sgeuimos" ("merge everything, and the questions as
recommended, and let's keep going."), which the owner reaffirmed on
2026-11-13, verbatim, "haz todo como recomendado" ("do everything as
recommended."). They were implemented as recommended and were not put to
the owner one by one: each is the owner's decision of 2026-11-23, and the
owner may still override any of them. MIG-B9-28's G4 (decision 29) was
chosen by the owner's session when no option was clearly recommended, and
PR #101 then recommended confirming it; it is recorded as that
recommendation, with what an override would mean. Decisions 39 to 53 route
the deliveries' follow-ups; *routing* and *widening* mean what they mean in
the block of 2026-11-15. Decisions 54 to 57 are MIG-B9-18's (merged as
PR #91 on 2026-11-15, before PR #98): its two flags of 2026-11-14, which no
earlier record carried, and its two follow-ups. Decision 58 lists the owner
checks the merged stories leave open, for the documentation review before
publishing. This record is in English. The numbers 1 to 58 belong to this
list only, and a story cites one as "decision 29 of 2026-11-23".

Seven story ids are registered, all for `0.5.0-beta.10`: MIG-B9-99, 101,
102 and 103, the ids the deliveries proposed, and MIG-B9-68, 69 and 70
(decisions 39, 41, 43 to 47). MIG-B9-30's delivery proposed MIG-B9-66 and
MIG-B9-67 for two of them: MIG-B9-66 is registered (decision 15 of
2026-11-10), and MIG-B9-67 is MIG-B9-20's proposal, not registered and
named in the block of 2026-11-13, so those two get the next free ids, 69
and 70, after MIG-B9-68, which the same delivery proposed for a third
item. MIG-B9-100 is not registered (decision 40), and MIG-B9-24's optional
MIG-B9-102 is not taken, the id going to MIG-B9-28's proposal, which a
shipped test title and the CHANGELOG already cite (decisions 42 and 43).
The standing instruction assigns no id, so the recorder took them, and the
owner may renumber them. Blocks of this date sit at the end of the §15 of
MIG-B9-17, 18, 24, 27, 28 and 30 ("Owner decisions of 2026-11-23, on the
delivery's flags"), of MIG-B9-55, 60 and 91 ("Owner decisions of 2026-11-23
(apply before implementing)"), and of the moved stories MIG-B9-19 and 31
to 38 ("Owner decisions of 2026-11-23"). MIG-B9-06 and 66 have no story
file: the index's §5 rows say what they take.

The cut:

- **Decision 1 — DEC-03, third revision: `0.5.0-beta.9` is what `feat/beta9` holds at `6cdadaf`, plus MIG-B9-91.**
  - `0.5.0-beta.9` ships every story merged into `feat/beta9` at `6cdadaf`: MIG-B9-01 to 05, MIG-B9-10 to 18, MIG-B9-20 to 30, MIG-B9-39 and MIG-B9-53 (wave 5, merged early as PR #35), and MIG-B9-91, the beta.9 gate and release record. Waves 0, 1 and 2 are complete; of wave 3, MIG-B9-18, 30 and 39 are merged.
  - Moved to `0.5.0-beta.10`, unstarted: MIG-B9-19, MIG-B9-31 to 38 and MIG-B9-06, the remainder of wave 3. They keep their wave, which is an order, not a release (§3), and their decisions (DEC-08 to DEC-13 stay decided; they ship later). Clause 3's gaps in §1 (scoped palettes, `extends` for roles and typography) therefore stay open in `0.5.0-beta.9`.
  - Waves 4 to 6, MIG-B9-90 and MIG-B9-92 were already `0.5.0-beta.10` (decision D13 of 2026-11-04) and stay there, with the follow-ups this block registers (decisions 39 to 47). MIG-B9-92, the beta.10 gate, now also depends on the moved stories.
  - What the cut lifts: the gate's wait for MIG-B9-06 (decision 28 of 2026-11-15, and decision 40's "MIG-B9-91's gate waits for it as before"). The atomic-replace watch failure, webpack's extra build in the older loader watch tests and MIG-B9-28's G4 class (decision 48) become known limitations of beta.9's record, routed to MIG-B9-06 in `0.5.0-beta.10`, so beta.9 ships with `test/cli/watch-mode.test.js` outside the Windows gate. The checks the moved and later stories add are not in the beta.9 gate: MIG-B9-31's scoped-palette check (planned in its §8 as `S-5`, an id `fixtures/release-1.0/run.js` already gives MIG-B9-14's webpack check, so MIG-B9-31's re-baseline renames it), MIG-B9-38's `B9-38`, MIG-B9-35's contrast re-pin, and `DR-1`, `AU-1`, `EX-1`/`EX-2`, `EU-1` and `TX-1`. The checks the merged stories added stay: `S-1` to `S-3` (MIG-B9-13), `S-4` to `S-6` (MIG-B9-14), `S-7` (MIG-B9-26 and 17) and `S-8` (MIG-B9-30), as `run.js` names them at `6cdadaf`. Decision 35 of 2026-11-10 still holds: MIG-B9-18 is merged.
  - Before the owner publishes `0.5.0-beta.9`, the owner and Claude review the documentation together. It is an owner step of the release record that MIG-B9-91 writes, the first of its owner steps, not a story, and the owner checks the merged stories leave open are its inputs (decision 58); the documentation stories of wave 5 (MIG-B9-50 to 54) and MIG-B9-90 stay in `0.5.0-beta.10`. The publish itself stays the owner's.
  - Reason: the owner's two messages above. `0.5.0-beta.9` is what is ready in code now, so the owner can start showing it; whatever is pending moves to `0.5.0-beta.10`.

MIG-B9-17's flags (merged as PR #99; its §15, "Owner flags of 2026-11-15,
answered as recommended", F1 to F9, raised by its design before PR #98's
record and not recorded there while the story was in progress (decision
44 of 2026-11-15), and "Delivery of 2026-11-16", "Owner flags of the
review", DB-1, DB-2 and CT-2):

- **Decision 2 — `protect.ts` and `protect.test.js` outside Shares (F1).** (a): Shares widened to both files (`ProtectProblem.bodyStart`, a new export `findTopLevelVariables`, the `bodies` test destructuring `bodyStart`). Not taken: (b) duplicate the brace matcher in `compile-sass.ts`, against "no separate parsers"; (c) a lexical heuristic.
- **Decision 3 — `compile-sass.test.js`'s row W2 (F2).** (a): Shares widened to `compile-sass.test.js`; `sassWarnings` also drops `UXD_MODULE_ISOLATION`, and each DEC-17 row asserts its exact isolation list. "W2 warns by design." Not taken: (b) exclude names hidden by `@forward … hide/show` from C5; (c) compute C5 only with a map.
- **Decision 4 — `compile.md` outside Shares (F3).** (a): Shares widened to `compile.md`, docs only. Not taken: (b) leave it for MIG-B9-27 or 38.
- **Decision 5 — `diagnostics-catalog.test.js`'s core set (F4).** (a): Shares widened, and that test retitled in place as MIG-B9-17's with the fourth `core` code. Not taken: (b) owner `compiler`, against decision 9 of 2026-11-10; (c) stop.
- **Decision 6 — C4 where the call's own file defines the function (F5).** (a): the same code, with the fix clause "define it at the top level of its file, before this call". Not taken: (b) the generic message, whose fix is wrong there; (c) no warning.
- **Decision 7 — `compile.ts`'s header (F6).** (a): both comments updated, no code. Not taken: (b) only the warnings comment.
- **Decision 8 — Isolation warnings on a later error (F7).** (a): the error `compile()` throws after a successful stage carries the stage's warnings, as `compile.md` promises. Not taken: (b) only on successful compiles.
- **Decision 9 — A build that defines `get-function` or `function-exists` (F8).** (a): C5 is never reported in such a build, a narrowing of an edge case that keeps every message true. Not taken: (b) report it and amend the sentence.
- **Decision 10 — The index's §7 table (F9).** (a): the closing implementer updates the rows of `protect.ts`, `compile-sass.test.js` and `compile.md` in the closure commit. Not taken: (b) record only in the story.
- **Decision 11 — Where the `!default` twins run (DB-1).** (a), implemented in `7754e2f`: never folded into the shadowing probe; the records come from the dedicated, guarded compile. Not taken: (b) keep folding and re-run the probe without twins on a failure; (c) stop the story as Blocked.
- **Decision 12 — The fix for a private member (DB-2).** (a), implemented in `7754e2f`: the same code, with a fix that renames first ("`<name>` is private to its file, as its name starts with `<c>`: rename it without the leading `<c>`, then …"). The story asks the owner to review the wording. Not taken: (b) skip C4 and C6 for private members; (c) keep the wrong fix.
- **Decision 13 — `with ($x: null)` against C6's "Never reported" (CT-2).** (a): the warning is kept, "configured" is read as configured with a value, and the CHANGELOG, `compile.md`, `cli.md` and `migration.md` say "unless the value is `null`". Not taken: (b) suppress C6 for any `with` configuration.

The delivery's other notes are not flags and are not decisions: its README
"From SCSS" passage gained two sentences where the index's §7 allows one
per story, and the owner may ask for them to be merged (DE-7).

MIG-B9-27's flags (merged as PR #100; its §15, "Owner decisions taken under
the standing instruction of 2026-11-10 (2026-11-16)", flags 1 to 3):

- **Decision 14 — PostCSS Document roots under C1's strict reading (flag 1).** (a): a Document's roots keep BASE's timing; `holdSassSyntax` throws in `Once` for a root whose parent is a Document, T4 and T5 have Document cases, and the docs say such a root is checked when `uxdsl/postcss`'s `Once` runs. Not taken: (b) defer per Document; (c) leave it, which fails C1 (outcome B).
- **Decision 15 — Chain inputs outside C4's set change their error (flag 2).** (a): accepted, the evidence recorded in the story's §14 and documented ("another plugin's own error is reported as that plugin gives it"); the inputs are not added to T7. Not taken: (b) read C4 as covering every chain input (outcome B).
- **Decision 16 — `compiler-structure.test.js` pinned the old factory's source shape (flag 3).** (a): restructured into named top-level steps (`Once` = `validateOptions` → `holdSassSyntax` → `runSteps`, `OnceExit` = `releaseSassSyntax`), with the pin updated to the new shape and the same intent. Not taken: (b) outcome B.

MIG-B9-24's flags (merged as PR #102; its §15, "Scout and owner flags of
2026-11-16, under the standing instruction", flags 1 to 3):

- **Decision 17 — Where the shared engine pass lives (flag 1).** (a): a module-only Symbol key (`THEME_ENGINE_OUTPUTS`), the `ThemeEngineOutputs` type and `renderThemeCssFromOutputs` in `theme-generator.ts`, which `uxdsl/engine` re-exports by name only; the plugin calls the public `validateTheme` with it. Every file stays within Shares; only `ds-runtime/theme-generator.d.ts` differs from BASE among the built declarations. Not taken: (b) turn `engine.ts`'s `export *` into an explicit list of 110 names; (c) add a public name.
- **Decision 18 — What §4 reads on the head for the columns §12 does not name (flag 2).** (a): "theme renders 0", "validateTheme 1" and about 11.5k value parses are recorded; C1 ties the CSS to `renderThemeCss`'s bytes, not to calls of it. Not taken: (b) keep calling `renderThemeCss`, impossible without a second engine run.
- **Decision 19 — C1 per `compile()` or per plugin run (flag 3).** (a): C1 is read per plugin run (per Compilation, as its title says); on `compile()`'s near-miss path, which runs the plugin twice, T1 asserts 2 engine runs. Not taken: (b) add `compile.ts` to Shares and carry the render across the two runs; (c) Blocked.

MIG-B9-28's flags (merged as PR #101; its §15, "Owner decisions taken under
the standing instruction (2026-11-16)", F1 to F6, "… second batch", G1 to
G3, "The owner's session's decision on G4, open for the owner to confirm
(2026-11-16, third batch)", and "Review of 2026-11-23", R1):

- **Decision 20 — The Windows job wraps the package's test script in `scripts/tmpdir-guard.js` (F1).** (a): step 8 runs the suites inside the guard. Not taken: (b) the guard runs once elsewhere for the record.
- **Decision 21 — Where a Windows leftover is fixed (F2).** (a): in the test file that leaves it or in `test/helpers/temporary-directory.js`, the file joining Shares with the run id that showed it; a cause in `src` or `bin` stays decision 19 of 2026-11-10's stop. Not taken: (b) a follow-up; (c) tolerated.
- **Decision 22 — How the job runs MIG-B9-25's §12 loop (F3).** (a): a permanent step 9 (`if: success() || failure()`), limited to the package's steps; the loop's other steps go to MIG-B9-66 (decision 49). Not taken: (b) only on failure; (c) on branch commits, then removed.
- **Decision 23 — Test files outside the Shares that fail on win32 for a harness reason (F4).** (a): Shares widened to each file the job shows, with its run id, and 28 put before the provisional 06 on the index's §7 row of `test/vite/index.test.js` and `test/webpack/loader.test.js`. Not taken: (b) stop and ask for each.
- **Decision 24 — How `test/helpers/npm.js` starts npm on win32 (F5).** (a): `shell: true` with each argument double-quoted, refusing an argument that holds a cmd metacharacter. Not taken: (b) `process.execPath` with `npm-cli.js`.
- **Decision 25 — An encoded negative control for "`os.tmpdir()` reads `TEMP` and `TMP` on Windows" (F6).** (a): T11 in `win32-harness.test.js`. Not taken: (b) none.
- **Decision 26 — A file Dart Sass loads itself through `pkg:` is spelled in lower case on win32 (G1).** (b): recorded as a win32 difference, `src` untouched: the failing test finds the file whatever its case on win32, a new test pins Dart Sass's spelling and names the follow-up, and the package README sentence on spelling is narrowed. The fix is MIG-B9-102 (decision 43). Not taken: (a) fix it in `src` in MIG-B9-28.
- **Decision 27 — T7's ACL cannot be set up on the hosted runner (G2).** (a): on win32 T7 skips with the exact reason when the directory can still be listed, printing the `readdirSync` result and the `icacls` listing; C6c stays unobserved on win32, and the README and CHANGELOG keep decision 2 of 2026-11-09's sentence for that case. Not taken: (b) another, unelevated account; (c) pin outcome B unobserved.
- **Decision 28 — On win32 `build --watch`'s atomic replace is refused while a reader holds the output file (G3).** (b): recorded as a win32 difference, `bin` untouched: on win32 the atomic-replace test accepts, per rebuild, the new output or the `EPERM` line with the previous output whole, and checks that a change with no reader then builds; the CLI guide, the package README and the CHANGELOG say so. The retry is MIG-B9-103 (decision 44). Not taken: (a) retry the rename in `bin`; (c) skip the test on win32.
- **Decision 29 — One save reaches `build --watch` as two `change` events on win32 (G4): (c), confirmed as PR #101 recommended, under the standing instruction.** (c): `test/cli/watch-mode.test.js` runs in the Windows job with its whole output printed, as a named exclusion from the job's pass/fail (the line `excluded from the Windows gate: watch-mode.test.js, one save reaches build --watch as two change events on win32; MIG-B9-06 returns it to the gate`), every other file stays in the gate, and C3, C6g and AC2 are amended accordingly; the class goes to MIG-B9-06 (decision 48). The story recorded that no option was clearly the recommended one when the owner's session chose (c) on 2026-11-16 to keep the story moving, and, since decision 19 of 2026-11-10 has the owner decide each product defect the Windows job finds, asked the owner to confirm or override it before merge. PR #101's body ("G4, needs your confirmation") then recommended, verbatim, "**Recommendation:** confirm (c). MIG-B9-06 fixes the class and returns the file to the gate, so beta.9 ships with the exclusion if 06 moves to beta.10." PR #101 was merged on 2026-11-23, after the owner's message of that day ("mergea todo"), which does not name G4; this record does not read the merge as the owner's confirmation. It applies the PR's recommendation under the standing instruction, as G1 and G3 (decisions 26 and 28, also win32 product differences) were applied, and lists G4 among the owner checks of decision 58; the owner may override it.
  - Without an override, `0.5.0-beta.9` ships with `watch-mode.test.js` outside the Windows gate, a known limitation of its record, and MIG-B9-06, now in `0.5.0-beta.10` (decision 1), returns it to the gate.
  - An override to (a), "change `bin` so that an event whose file keeps the stats of its last build builds nothing", is a change to `bin/uxdsl.js` before the beta.9 gate: a new story, or MIG-B9-06's `bin` part brought back into `0.5.0-beta.9`, which reopens decision 1's cut for that part and makes MIG-B9-91 wait for it again.
  - An override to (b), "keep `bin` and pin the difference on win32 in each watch test that counts builds", edits about a dozen count assertions in `watch-mode.test.js` (test files only), with the coalescing of events left to MIG-B9-06; it also needs a story or an amendment before MIG-B9-91. It pins the doubled-event counts only: the story's option (b) leaves the two config-reload timeouts to MIG-B9-19's class ("the config-reload timeouts stay MIG-B9-19's class and are re-run"), and MIG-B9-19 and 06 are now in `0.5.0-beta.10` (decision 1), so the file returns to the Windows gate in `0.5.0-beta.9` only if those two tests are also excluded or fixed before MIG-B9-91.
  - Not taken by the session: (a) and (b), for the reasons the story gives: "(a) changes `bin` against C7; (b) weakens about a dozen count assertions; (c) keeps every assertion and `bin` intact and names the gap."
- **Decision 30 — AC1's recorded mutation no longer fails the job (R1).** (a): the `script-shell` step is kept, so npm's scripts run in bash as on ubuntu, with its name and comment saying what it does now, and AC1's mutation is amended to step 8's drift check. Not taken: (b) remove the step.

MIG-B9-30's flags (merged as PR #104; its §15, "Owner flags of 2026-11-16,
under the standing instruction", F1 to F5, and "Delivery of 2026-11-23",
"Owner flags raised at review and delivery", flags 1 to 3):

- **Decision 31 — A responsive value in a nested block, with the plugin alone (F1).** (b): `UXD_BREAKPOINT_CONTEXT` only when an enclosing `@media` was rewritten from `(--bp)`; literal inputs keep BASE's bytes, and the literal case is a follow-up (MIG-B9-70, decision 46). Not taken: (a) the error for every such at-rule, which changes outputs with no `(--name)`; (c) leave it; (d) fix the emission, which changes literal outputs.
- **Decision 32 — Which unknown `(--name)` is an error, and when (F2).** (a): every `(--name)` that is neither a theme breakpoint nor a top-level `@custom-media` is `UXD_BREAKPOINT_UNKNOWN`, judged at `OnceExit` so another plugin may resolve it first. Option (d), an option listing external names, can be added later (MIG-B9-68, decision 47). Not taken: (b) judged in `Once`; (c) only names near a breakpoint.
- **Decision 33 — The base breakpoint in a prelude, `(--xs)` (F3).** (a): `UXD_BREAKPOINT_CONTEXT` with the form to write. Not taken: (b) `(min-width: 0px)`; (c) drop the feature.
- **Decision 34 — `(--<bp>)` outside an `@media` prelude (F4).** (a): left as written, documented, with the `@import` case a follow-up (MIG-B9-69, decision 45). Not taken: (b) `UXD_BREAKPOINT_CONTEXT`, which changes outputs whose preludes hold no `--`; (c) also rewrite `@import` and `@custom-media` media lists.
- **Decision 35 — AC3's "no visual difference" (F5).** (a): AC3 reads "no visual difference except the declared docs additions"; SideNav and every other route unchanged. Not taken: (b) no demo, leaving capability-matrix gaps.
- **Decision 36 — Where `UXD_BREAKPOINT_UNKNOWN` is located through `compile()` (delivery flag 1).** (a): B5 and §7 qualified: at the token with the plugin alone, at the `@media` rule's line and column through `compile()`. Not taken: (b) point `compile()` at the token, which the Sass map cannot give; (c) leave B5 and record a finding.
- **Decision 37 — The byte-identity line (delivery flag 2).** (a): §5's "Must stay" reads "every output whose `@media` preludes hold no `--`". Not taken: (b) name the exception after the existing wording; (c) drop the bare-name check.
- **Decision 38 — "In that build" (delivery flag 3).** (a): DEC-07's "in that build" is read as "in that compilation: the stylesheet and the partials it loads"; stylesheets compiled apart keep the theme's query. Not taken: (b) carry a definition across every entry of a build.

The follow-ups (MIG-B9-17's "Follow-ups"; MIG-B9-27's and MIG-B9-24's
"Delivery of 2026-11-16"; MIG-B9-28's "Follow-ups (proposed)" and
"Delivery of 2026-11-23"; MIG-B9-30's "Delivery of 2026-11-23"):

- **Decision 39 (widening) — The isolation warnings' edge cases (MIG-B9-17's follow-up).** Registered as MIG-B9-99, "The isolation warnings' edge cases": wave 6, last in the wave (after MIG-B9-97), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 39 of 2026-11-23)". It covers what the follow-up lists: C4 reading an uppercase or mixed-case `URL(name(…))` that Dart Sass evaluates (RR-1); C6's "earlier" by evaluation order rather than load order, no C6 for an earlier `$x: null;`, and the setter named as the last assignment in the earlier file (DB-3 (a) to (c)); and `compile-error-warnings.test.js`'s header comment naming `UXD_MODULE_ISOLATION` in the order. Reason: the follow-up's first option; each item changes `compile-sass.ts`, and `0.5.0-beta.9` is cut. Until then MIG-B9-91's record lists them as known limitations of beta.9, the follow-up's alternative.
- **Decision 40 — `verify:1.0` leaves five directories in `TMPDIR` (MIG-B9-27's proposed MIG-B9-100; seen again by MIG-B9-24's and MIG-B9-17's deliveries).** Not registered: the item is already MIG-B9-91's, by decisions 26 and 44 of 2026-11-15 (`uxdsl-1.0-gate-`, `uxdsl-1.0-upgrade-before-`, two `uxdsl-vite-adapter-`, `uxdsl-webpack-adapter-`, and `packAndInstall`'s consumer directories), as MIG-B9-17's delivery says ("Already MIG-B9-91's, by decision 44 of 2026-11-15"). MIG-B9-100 is left unused. Reason: one owner per item; the beta.9 gate already has it.
- **Decision 41 (widening) — The timing test `MIG-B6-25: reference validation grows near-linearly` fails under load (MIG-B9-27's proposed MIG-B9-101).** Registered as MIG-B9-101, "The near-linear timing test of reference validation holds under load": wave 6, last in the wave (after MIG-B9-99), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 41 of 2026-11-23)". Its story file chooses between the follow-up's two options: the interleaved re-measure the Sass corpus budget uses, or fencing it from `npm test` under load as MIG-B9-23 did for the corpus. It is the package test in `npm test`, not the gate's `UX-10` check, which decision 26 of 2026-11-15 gives MIG-B9-91.
- **Decision 42 — `compile()`'s near-miss path runs the plugin twice (MIG-B9-24's optional proposed MIG-B9-102).** Not registered, as the delivery recommends: "do not register it unless the error path's time matters". The gain is on an error path, and reusing the first run's engine outputs needs a new option or a cache. The id MIG-B9-102, which MIG-B9-28's delivery also proposed, goes to that proposal (decision 43); MIG-B9-24's §15 is pointed at it.
- **Decision 43 (widening) — win32: a file Dart Sass loads itself through `pkg:` is spelled in its on-disk case (MIG-B9-28's proposed MIG-B9-102, from G1).** Registered as MIG-B9-102, with the title the delivery gave: wave 6, last in the wave (after MIG-B9-101), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 43 of 2026-11-23)". Its regression is G1's test, which then asserts the on-disk case. It keeps the id because `packages/uxdsl/test/core/sass-stage-win32.test.js` (G1's test title) and the CHANGELOG already cite MIG-B9-102 for it.
- **Decision 44 (widening) — win32: `build --watch` retries a rename onto an output file a reader holds open (MIG-B9-28's proposed MIG-B9-103, from G3).** Registered as MIG-B9-103, with the title the delivery gave: wave 6, last in the wave (after MIG-B9-102), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 44 of 2026-11-23)". Its regression is the atomic-replace test's win32 branch, which then expects every rebuild to land. The delivery's first option is taken; "within MIG-B9-06, if the owner prefers" stays the owner's to choose. The CHANGELOG already cites MIG-B9-103 for it.
- **Decision 45 (widening) — `(--lg)` in an `@import` media list is left as written on both paths (MIG-B9-30's follow-up 1; F4 (a), decision 34).** The delivery proposed "a new beta.10 story, MIG-B9-66", an id registered by decision 15 of 2026-11-10. Registered as MIG-B9-69, "`(--<breakpoint>)` in an `@import` media list": wave 6, last in the wave (after MIG-B9-68), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 45 of 2026-11-23)". Its story file makes it `UXD_BREAKPOINT_CONTEXT` or rewrites it, with the owner's call on byte identity, as the follow-up says. MIG-B9-30's §15 is pointed at the new id.
- **Decision 46 (widening) — With `uxdsl/postcss` alone, a responsive value in a literal `@media` nested in a rule prints a selector-less clone at the root (MIG-B9-30's follow-up 2; F1 (b), decision 31).** The delivery proposed MIG-B9-67, which is MIG-B9-20's unregistered proposal (block of 2026-11-13). Registered as MIG-B9-70, "A responsive value in a literal `@media` nested in a rule, with `uxdsl/postcss` alone": wave 6, last in the wave (after MIG-B9-69), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 46 of 2026-11-23)". It changes literal outputs, so its story file states the byte-identity exception for the owner. MIG-B9-30's §15 is pointed at the new id.
- **Decision 47 (widening) — Custom media across files and two messages (MIG-B9-30's follow-ups 3 and 4, both proposed as MIG-B9-68).** Registered as MIG-B9-68, "`@custom-media` defined in another file, and the breakpoint messages under a project `@custom-media`": wave 6, last in the wave (after MIG-B9-103), S, decision gate none, `0.5.0-beta.10`, status "Draft (story file to be written; registered by decision 47 of 2026-11-23)". It covers F2 (d), an option listing external custom-media names for `uxdsl/postcss` alone, which "can be added later without breaking anyone", and the message polish: F1's message advising `lg(…)` where a project `@custom-media --lg` moved `(--lg)`, and `UXD_BREAKPOINT_SHADOWED` naming an unwrapped query where a compound prelude wraps it.
- **Decision 48 (routing) — G4's class goes to MIG-B9-06 (MIG-B9-28's follow-ups).** MIG-B9-06 takes one save reaching `build --watch` as two `change` events on win32 (a build for each) and the two config-reload watch tests that time out on Windows with no output; one of its acceptance criteria returns `test/cli/watch-mode.test.js` to the Windows job's gate, removing step 8's exclusion and step 9's `excluded` branch. MIG-B9-06 has no story file; the index's §5 row says so. It is in `0.5.0-beta.10` (decision 1), so the exclusion stays in `0.5.0-beta.9`.
- **Decision 49 (routing) — The root `npm test`'s other suites on Windows (MIG-B9-28's delivery; F3, decision 22).** MIG-B9-66 also takes the loop's other §12 steps (the VS Code extension, the playground, the fixtures and `scripts/`) on Windows, together with `scripts/tmpdir-guard.test.js`. It widens MIG-B9-66's registered scope (parity, the consumer fixtures and the shims, decision 15 of 2026-11-10); MIG-B9-66 has no story file, and the index's §5 row says so.
- **Decision 50 (routing) — VS Code: completion of `--<bp>` in an `@media` prelude, and highlighting of `@ds-*` and `xs()` written inside a rule (MIG-B9-30's follow-up 5).** MIG-B9-55, as the delivery proposed: it packages the extension, and VS Code's CSS property list owns those tokens inside a rule. MIG-B9-55 carries a block of this date.
- **Decision 51 (routing) — `fixtures/playground-browser/snapshot.js`'s interactions time out (MIG-B9-30's follow-up 6).** MIG-B9-44, registered for exactly this by decision 12 of 2026-11-09 ("`fixtures/playground-browser/snapshot.js`'s interaction step times out on `.density-card__edit-btn`"), in `0.5.0-beta.10`; MIG-B9-91's record lists the compare's `--no-interactions` as a known limitation of beta.9. This differs from the delivery's proposal (MIG-B9-91), so that the beta.9 gate does not take a fix MIG-B9-44 already owns.
- **Decision 52 (routing) — The playground walk's fixed port 3919, shared by concurrent gate runs on one machine (MIG-B9-30's follow-up 7).** MIG-B9-91, as the delivery proposed: a free port or a lock, or, if its re-baseline finds that the gate's run conditions suffice, the record states them, as decision 26 of 2026-11-15 allows for UX-10.
- **Decision 53 — Follow-ups an earlier decision already routes, or that need no story.**
  - `UX-10`'s timing under load (MIG-B9-30's follow-up 8): decision 26 of 2026-11-15, MIG-B9-91.
  - MIG-B9-27's note to MIG-B9-24 ("MIG-B9-24's fixed per-build costs should measure from this base"): carried out; MIG-B9-24 started and measured on `dec40b1`, the merge of PR #100.
  - `applyTheme` and `generateThemeCss` still run the engines more than once per call (MIG-B9-24's follow-up 3, "No new id"): recorded; whether the runtime's cost matters is the owner's call.
  - Press Craftor's eight hand-written queries that equal a theme breakpoint (MIG-B9-30's follow-up 9): the owner's patch after beta.9 (decision D17 of 2026-11-04).
  - The pre-commit hook in a new worktree (MIG-B9-24's "Delivery of 2026-11-16", new fact 1: "`git commit` ran no hook until `npm run prepare` wrote `.husky/_`"): a process note, no story. The index's §1 item 3 prepares a worktree with `npm ci --ignore-scripts`, which skips the root `prepare` script (`husky`), so that item now also runs `npm run prepare`.

MIG-B9-18's flags and follow-ups (merged as PR #91, `f6c009d`, on
2026-11-15, before PR #98's record, which flipped its index row to Merged
but did not carry them; its §15, "Owner decisions of 2026-11-14 (the
scout's two flags)", which already answered both under the standing
instruction, and "Delivery of 2026-11-14"):

- **Decision 54 — F13, an unclosed directive parenthesis (flag 1).** (b), as implemented: the fallback join (the text to the first `)`) also has the token rewrites run on the text it unquoted, so F13 is final in run 1 and C1 holds literally; its run-1 bytes differ from BASE (`palette(primary.main)` instead of `palette(primary-main)`) for an input the compiler rejects either way. Test: T4's `unclosed.css`. This replaces what §6 and F13 had kept for that input, BASE's two-run behavior, which decision 12 of 2026-11-13 (C1 for any files) contradicted.
- **Decision 55 — F11, `${…}` after a function argument (flag 2).** (b), as implemented: one assertion inside T5, in its own file `h.css`, pins BASE's half rewrite (`.h { @ds-surface(contained, radius(2), ${r}); }` gives `.h { @ds-surface(contained radius(2), ${r}); }`), with `.w { @ds-surface(contained  primary); }` beside it so a run that stops collapsing whitespace fails T5. Before it, §6 pinned F11 to BASE's half rewrite and no test asserted it.
- **Decision 56 (routing) — F11's half rewrite and the codemod as a module (MIG-B9-18's follow-up for MIG-B9-60).** MIG-B9-60, as the delivery proposed: "F11 stays a known half rewrite (`${…}` after a function argument keeps BASE's bytes), as do the other directives the balanced pattern does not match. If `uxdsl doctor` loads the codemod as a module, its story file should list this file (F12)." MIG-B9-60 carries a block of this date. `0.5.0-beta.9` ships the half rewrite, so MIG-B9-91's record lists it as a known limitation.
- **Decision 57 — The test file's `tmp()` helper (MIG-B9-18's follow-up for MIG-B9-25).** Not taken, no story: MIG-B9-25 is merged, and the helper in `packages/uxdsl/test/codemod-canonical-grammar.test.js` removes its directory itself (`t.after(() => fs.rmSync(dir, { recursive: true, force: true }))`), so it leaves nothing behind. A later story that edits the file may move it to `packages/uxdsl/test/helpers/temporary-directory.js`.

The owner checks:

- **Decision 58 — The owner checks the merged stories leave open are inputs to the documentation review before publishing (decision 1).** Each is pending and the owner's; none is marked PASS by this record. MIG-B9-91's record lists them among its owner steps.
  - MIG-B9-17: the wording of the three `UXD_MODULE_ISOLATION` messages and of their catalog entry (its §9), the rename-first fix for a private member included (decision 12, DB-2), as PR #99 asks; and the README "From SCSS" passage's two sentences (its DE-7).
  - MIG-B9-18: decisions 54 and 55, taken under the standing instruction.
  - MIG-B9-28: the win32 spellings the CHANGELOG and the package README record (its §9: 8.3 names keep their spelling, `pkg:` files are lower case), and G1, G3 and G4 (decisions 26, 28 and 29), the product differences decision 19 of 2026-11-10 leaves to the owner.
  - MIG-B9-30: the catalog entries PR #104 lists for the owner check (the new `UXD_BREAKPOINT_SHADOWED`, and the reworded `UXD_BREAKPOINT_UNKNOWN`, `UXD_BREAKPOINT_CONTEXT` and `UXD_DIRECTIVE_CONTEXT`), and the Press Craftor check of the `migration.md` entry (decision Q18, its §15 I2, "Not verified here").

## 3. Scope, in waves

The stories are grouped in waves. A wave is an order, not a release: under
DEC-03, as revised on 2026-11-04, waves 0 to 3 were to ship in
`0.5.0-beta.9` and waves 4 to 6 in `0.5.0-beta.10`. On 2026-11-23 the owner
cut `0.5.0-beta.9` to what `feat/beta9` holds at `6cdadaf` (decision 1 of
2026-11-23): waves 0 to 2 and, of wave 3, MIG-B9-18, 30 and 39, plus
MIG-B9-53 from wave 5, merged early. MIG-B9-91 closes that release. The rest
of wave 3 (MIG-B9-06, 19 and 31 to 38) keeps its wave and its order and
ships in `0.5.0-beta.10` with waves 4 to 6, which MIG-B9-90 and MIG-B9-92
close. MIG-B9-91 is the one story out of its wave's order: it belongs to
wave 7 but integrates before wave 4, and its row in the index's §5 sits
right after MIG-B9-30's, the last merged wave-3 row before the moved ones,
ahead of the moved stories.

| Wave | What | Stories | Release |
| --- | --- | --- | --- |
| 0 | Housekeeping and validation: numbering, dependencies, `main` proven on a real project, the language refuses near-misses, byte-preserving plugin. | MIG-B9-01 to 05 | `0.5.0-beta.9` |
| 1 | The SCSS superset: tests first, the protect pass, Dart Sass with the `.uxdsl` importer, `compile()` on the new pipeline, the CLI and adapters, the documentation. | MIG-B9-10 to 15 | `0.5.0-beta.9` |
| 2 | One source of truth, less code: the theme at the marker only, deletions, `build --watch` keeps the entry; `compile()` within 1.5× of Dart Sass. Registered on 2026-11-04: the plugin's fixed per-build costs, the suites remove their temporary directories, dotted near-misses and `@debug` through `compile()`, `uxdsl/postcss` in a PostCSS chain, CI on Windows, an idempotent codemod. Registered on 2026-11-08: the playground's `/docs/language` page on the superset. Registered on 2026-11-10, by splitting MIG-B9-26: the silent cases of `@use`'s module isolation warn. | MIG-B9-16, MIG-B9-17, MIG-B9-20 to 29 | `0.5.0-beta.9` |
| 3 | Output-changing decisions, each behind its DEC: `@media (--lg)`, scoped palettes, one `extends` rule for roles and typography, focus, canvas-tone contrast warnings, `:user-invalid`. Registered on 2026-11-04: a located warning for a CSS-wide keyword as a theme token value. Registered on 2026-11-08: a located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS; every host's watch recovers after a failed compile. Registered on 2026-11-10, from MIG-B9-29's delivery (decision 36): the codemod's directive-argument rewrite is complete in one run. On 2026-11-13, the plain-`@import` warning was retitled "a located warning", since every host prints it (decision 24), and two stories were registered: by splitting MIG-B9-39 (decision 28), the CLI's watch recovers after a failed compile, and its flaky watch test and captures check name what failed (MIG-B9-39 keeps the adapters); and the CLI watch's four older gaps, the same class in the adapters, and an error while a recreated watcher starts (decision 29). On 2026-11-15, MIG-B9-06 (decision 29 of 2026-11-13) also took the atomic-replace watch failure seen once on CI (decision 28 of 2026-11-15), and, later that day, the extra webpack build that the older watch tests in `test/webpack/loader.test.js` can take for an edit's (decision 40 of 2026-11-15). On 2026-11-23, the stories of this wave not merged at `6cdadaf` moved to `0.5.0-beta.10` (decision 1 of 2026-11-23), and MIG-B9-06 also took the class of MIG-B9-28's G4, one save reaching `build --watch` as two `change` events on win32 (decision 48). | MIG-B9-06, MIG-B9-18, MIG-B9-19, MIG-B9-30 to 39 | MIG-B9-18, 30 and 39 (merged): `0.5.0-beta.9`; MIG-B9-06, 19 and 31 to 38: `0.5.0-beta.10` (decision 1 of 2026-11-23) |
| 4 | The playground as reference implementer: the design-system layer, one demo frame and one editor, the five principles live, nothing hardcoded. Registered on 2026-11-09, first in the wave: a deterministic visual comparison harness. | MIG-B9-40 to 44 | `0.5.0-beta.10` |
| 5 | Documentation and presentation: README and quick start, AGENTS.md and CONTRIBUTING.md, migration guide in English, maintenance signals, "Why UXDSL", the VS Code extension. | MIG-B9-50 to 55 | `0.5.0-beta.10`, except MIG-B9-53, merged early, which ships in `0.5.0-beta.9` (decision 1 of 2026-11-23) |
| 6 | Tools for the adoption ladder: `doctor`, `audit` and `migrate --suggest`, the generated reference, `explain` and hover, `emit: 'used'`, the container note. Registered on 2026-11-10, last in the wave: CI on Windows, part two (parity, the consumer fixtures and the shims). Registered on 2026-11-15, last in the wave, from MIG-B9-21's delivery: unknown options warn on the plugin, `compile()`, Vite and webpack (decision 17); the reference checker follows `!important` as the cascade does (decision 18). Registered later on 2026-11-15, last in the wave, from MIG-B9-39's delivery: the error `compile()` throws for a UXDSL error carries its `UXD_` code (MIG-B9-96, decision 39); the Vite adapter fixture runs on Vite 6, inside the declared peer range `>=4.0.0` (MIG-B9-97, decision 41). Registered on 2026-11-23, last in the wave, from the deliveries of MIG-B9-17, 27, 28 and 30: the isolation warnings' edge cases (MIG-B9-99, decision 39); the near-linear timing test of reference validation holds under load (MIG-B9-101, decision 41); win32 spells a file Dart Sass loads through `pkg:` in its on-disk case (MIG-B9-102, decision 43); win32's `build --watch` retries a rename onto an output a reader holds open (MIG-B9-103, decision 44); `@custom-media` defined in another file and the breakpoint messages under a project `@custom-media` (MIG-B9-68, decision 47); `(--<breakpoint>)` in an `@import` media list (MIG-B9-69, decision 45); a responsive value in a literal `@media` nested in a rule with `uxdsl/postcss` alone (MIG-B9-70, decision 46). MIG-B9-66 also takes the root `npm test`'s other suites on Windows (decision 49 of 2026-11-23). | MIG-B9-60 to 66, MIG-B9-94 to 97, MIG-B9-99, MIG-B9-101 to 103, MIG-B9-68 to 70 | `0.5.0-beta.10` |
| 7 | Release: the test exercise, the gates, the records. MIG-B9-91 closes beta.9 over what `feat/beta9` holds at `6cdadaf`, before wave 4 (decision 1 of 2026-11-23); MIG-B9-90 and MIG-B9-92 close beta.10 after wave 6 and the moved wave-3 stories. | MIG-B9-90, 91, 92 | MIG-B9-91: `0.5.0-beta.9`; MIG-B9-90 and 92: `0.5.0-beta.10` |

**Not in this feature, on purpose:** the MUI theme import (plan D-11, a
mapping table in the docs is part of MIG-B9-50), container queries, fluid
scales, DTCG, a Tailwind bridge. They wait for users to ask.

**Not in this feature, for 1.0 at the latest** (decisions 20 and 21 of
2026-11-15): removing the 13 `uxdsl/engine` values that
`packages/_deprecated/shims.test.js`'s `FORMER` table pins, together with
the shims, in the story that removes `packages/_deprecated` (none is
registered); and a 1.0 API review of the `src`-only engine exports and the
semver-bound dead exports MIG-B9-21's §15 lists, in FEAT-011 or later.

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

The beta.9 gate is MIG-B9-91. `0.5.0-beta.9` ships what `feat/beta9`
holds at `6cdadaf` (decision 1 of 2026-11-23): MIG-B9-01 to 05, 10 to 18,
20 to 30, 39 and 53. After the gate passes, and before publishing, the owner
and Claude review the documentation together, an owner step of the release
record. Then the owner publishes `uxdsl@0.5.0-beta.9` with `latest` and
`beta`, and decides about the five former names (deprecate; optionally
publish the shims). The record of what was published is
`docs/releases/0.5.0-beta.9.md`, written by MIG-B9-91 from the gate's
output; its "moved to beta.10" section lists MIG-B9-06, 19 and 31 to 38.
`0.5.0-beta.10` has its own gate and release record, MIG-B9-92 (DEC-03,
revised on 2026-11-04 and on 2026-11-23).
