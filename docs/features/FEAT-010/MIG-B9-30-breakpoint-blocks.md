# MIG-B9-30 — Breakpoint media queries: `@media (--lg)`

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | DEC-07 (decided 2026-10-23, amended: `@media (--<breakpoint>)`, not `@lg { … }`) |
| Status | In review (PR #104) |
| Size | M |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-40, MIG-B9-55, MIG-B9-62, MIG-B9-65 |
| Base | `feat/beta9` after MIG-B9-13 |
| Owns | `packages/uxdsl/test/breakpoint-blocks.test.js` (new), `packages/playground-nextjs/src/components/SideNav.uxdsl`, `packages/playground-nextjs/src/app/not-found.uxdsl` |
| Shares | `packages/uxdsl/src/plugin.ts`, `packages/uxdsl/src/language.ts` (completions), `packages/uxdsl/src/diagnostics.ts`, `scripts/generate-language-artifacts.js` (the grammar), `fixtures/release-1.0/run.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md`, `packages/uxdsl/test/compiler-structure.test.js`, `packages/uxdsl/test/plugin-work-per-compilation.test.js`, `scripts/lib/doc-examples.js`, `scripts/doc-examples.test.js`, `scripts/lib/capabilities.js`, `scripts/capability-matrix.test.js`, `packages/playground-nextjs/capability-evidence.json`, `docs/architecture/playground-capability-matrix.md` (generated), `packages/uxdsl-vscode/test/grammar.test.js`, `fixtures/vscode-extension/run.js`, `fixtures/release-1.0/verdicts.test.js`, `packages/playground-nextjs/scripts/capture-capabilities.js` (output only), `packages/playground-nextjs/scripts/capture-examples.js`, `packages/playground-nextjs/src/generated/compiler-captures.json`, `packages/playground-nextjs/src/generated/examples.json`, `packages/playground-nextjs/src/app/docs/language/page.tsx`, `packages/playground-nextjs/src/components/SurfaceDocumentation.tsx`, `packages/playground-nextjs/src/app/docs/introduction/page.mdx`, `packages/playground-nextjs/src/app/docs/breakpoints/breakpoints.uxdsl`, `packages/playground-nextjs/src/components/BreakpointDocumentation.tsx`, `packages/playground-nextjs/src/app/uxdsl.css` (generated), `packages/uxdsl/README.md`, `packages/uxdsl/docs/migration.md`, `packages/uxdsl/docs/agent-guide.md` (generated) |
| Output impact | new syntax (`@media (--<breakpoint>)`); an `@media` prelude holding an unknown `(--name)` now fails, and a project `@custom-media` named like a breakpoint now warns and is applied; SideNav moves to `@media (--lg)` with no visual change; `/docs/breakpoints` gains a live demo |

## 1. Goal

"The author never writes a media query" becomes literally true. A block of
declarations, nested rules or a directive that applies from a breakpoint up
is written `@media (--<breakpoint>) { … }`, the CSS custom-media syntax,
anywhere an `@media` may be written. UXDSL replaces `(--<breakpoint>)` with
the effective theme's query for it, the one `<breakpoint>()` produces, so no
threshold is copied by hand: `.nav { @media (--lg) { @ds-surface(flat); } }`
in a `.uxdsl` file applies the role from `lg` up, and moves when the theme's
`lg` moves.

## 2. Sources

- Vision guardrail 4 (plan): "'Never write a media query' must be literally
  true, or it becomes a trap: close D-2".
- Plan D-2: today's one remaining case is "applying a whole role from a named
  breakpoint (the playground's SideNav keeps `@media (min-width: 1024px)`)";
  option (a) "a breakpoint block nested in a rule".
- Verified with Dart Sass 1.107.0 (2026-11-16, `packages/uxdsl/node_modules/sass`):
  `@media (--lg)` is kept as written; a nested `@media (--lg)` bubbles out
  of a rule, through a mixin's `@content`, through `&:hover` and nested
  rules; `@media print { .a { @media (--lg) {} } }` merges to
  `print and (--lg)`; inside `@supports` it stays nested in the
  `@supports` (the rule moves inside); `@media not print { … @media (--lg) … }`
  stays nested.
- `plugin.ts`: the Once order (`emitTheme`, `expandDirectives`,
  `expandResponsive`, `rejectLeftoverDirectives`, `checkReferences`);
  `UNSPLITTABLE_AT_RULES` (`keyframes`, `font-face`, `page`, `counter-style`);
  `UXD_BREAKPOINT_CONTEXT`; with the plugin alone a directive nested inside
  `@media` under its rule is `UXD_DIRECTIVE_CONTEXT`
  (`directives-leftover.test.js:32`); through `compile()` Dart Sass bubbles
  the `@media` and the directive compiles (MIG-B9-10 D10,
  `test/core/protect.cases.js:79`), which SideNav.uxdsl relies on today. A
  rule nested inside a top-level `@media` with its own directive compiles
  on both paths (`directives-leftover.test.js:82`).
- The playground: `SideNav.uxdsl` has `@media (min-width: 1024px)` with the
  comment "a directive cannot be responsive, so this cannot be lg() on each
  property. Keep 1024px equal to the theme's lg"; `not-found.uxdsl` has
  `@media (min-width: 600px)` with "A local threshold … deliberately not `sm`
  (480) or `md` (768)".

## 3. Preconditions

```bash
grep -q "compileSassStage" packages/uxdsl/src/compile.ts
grep -c "@media" packages/playground-nextjs/src/components/SideNav.uxdsl packages/playground-nextjs/src/app/not-found.uxdsl   # 1 each (plus a comment)
grep -q "UNSPLITTABLE_AT_RULES" packages/uxdsl/src/plugin.ts
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {compile}=require('./dist/entries/index.js');compile({source:'.nav{color:red;@lg{display:flex;@ds-surface(flat)}}',from:process.cwd()+'/x.uxdsl'}).then(r=>console.log(r.css)).catch(e=>console.log(e.message.split('\n')[0]))"
```

Recorded on `6b8e3a9` (2026-11-16): passed through with no error and no
warning, `.nav {\n  color: red;\n}\n@lg {\n  .nav {\n    display: flex;\n    padding: var(--uxdsl__surface__flat-padding); … box-shadow: var(--uxdsl__surface__flat-shadow);\n  }\n}`
(the directive expanded inside the unknown at-rule). The decided syntax's
baseline is recorded the same way: every `@media (--…)` form passes through
as written on both paths, with no diagnostic (`(--lg)`, `(--LG)`,
`(--nope)`, `(--xs)`, `screen and (--lg), print`, a project
`@custom-media --lg`), except a directive inside a nested `@media` under a
rule with the plugin alone (`UXD_DIRECTIVE_CONTEXT` at `x.css:1:51`).

## 5. Contract

Rewritten on 2026-11-16 to DEC-07 as amended (§15, "Contract rewritten to
DEC-07 as amended, 2026-11-16", keeps the text it replaces). The exact
messages are in §7.

- **B1 — The rewrite.** In the prelude of every at-rule named `media`
  (case-insensitive; top level or nested at any depth; on both paths), each
  media feature `(--<name>)` (optional spaces inside the parentheses) whose
  `<name>` is a breakpoint of the effective theme is replaced by
  `(min-width: <px>px)`, the exact string the responsive expansion builds
  for `<name>()`, through one shared helper. Everything else in the prelude
  (media types, `and`/`not`/`only`, other features, commas, comments), the
  at-rule's raws and its position stay as written. Theme breakpoint names
  match case-insensitively (`(--LG)` is `lg`), as the functions do. The
  rewrite is the first of UXDSL's steps, so every later step and the
  reference pass see an ordinary `@media (min-width: …)`; the at-rules it
  reads are collected by the traversal `validateOptions` already makes, and a
  compilation with no `--` in an `@media` or `@custom-media` prelude does no
  other new work.
- **B2 — Through Sass (`compile()`).**
  `.nav { color: red; @media (--lg) { display: flex; @ds-surface(flat); } }`
  in a `.uxdsl` file compiles to `.nav { color: red; }` then
  `@media (min-width: 1024px) { .nav { display: flex; <the flat role's declarations> } }`:
  Dart Sass bubbles the block, as any nested `@media` (MIG-B9-10 D10), the
  plugin rewrites the prelude, and the directive is a direct child of its
  rule. Sass's merge of nested queries is pinned by a test:
  `@media print { .a { @media (--lg) { … } } }` → `@media print and (min-width: 1024px)`;
  `(--md)` around `(--lg)` → `(min-width: 768px) and (min-width: 1024px)`;
  `print, screen` is distributed; `@media not print { … @media (--lg) … }`
  stays nested, with the inner prelude rewritten.
- **B3 — Through the plugin alone.** `@media (--lg) { .a { … } }` and
  `.a { @media (--lg) { display: flex; } }` in a `.css` file are rewritten in
  place (the nested block stays native CSS nesting). A directive inside a
  nested `@media` under its rule is still `UXD_DIRECTIVE_CONTEXT`, as for a
  literal nested `@media`; its message names the form that works on both
  paths (the rule inside the block). A responsive value directly inside an
  `@media (--bp)` block nested in a rule is `UXD_BREAKPOINT_CONTEXT` (owner
  flag F1, §15): CSS nesting cannot move the block out of the rule, and the
  clone the responsive expansion would print has no selector. A literal
  nested `@media` keeps its bytes (a follow-up finding). The asymmetry is
  documented: a directive or a responsive value from a breakpoint inside a
  rule needs the `.uxdsl` (`compile()`) path.
- **B4 — What is written by hand wins.** A literal query
  (`@media (min-width: 1024px)`, `not-found.uxdsl`'s 600px) is compiled as
  written and never rewritten. A **definition** is a
  `@custom-media --<name> <query>;` that is a direct child of the
  compilation's root; all are collected before any rewrite, so one written
  after its use or in a `@use`d or `@import`ed partial counts (with the
  plugin alone, only the file being compiled is visible). A definition whose
  name, lowercased, is a theme breakpoint replaces that breakpoint for every
  spelling of `(--<bp>)` in that compilation, with one
  `UXD_BREAKPOINT_SHADOWED` warning per definition, located at it (the
  DEC-17 rule: allowed, the author wins, never silent); when a name is
  defined twice, the last wins and each definition warns. What `(--<bp>)`
  becomes: when it is a whole item of the prelude's comma list, the
  definition as written (`true` → `all`, `false` → `not all`); inside a
  compound item, a definition that is one parenthesized group as written, a
  media condition (it starts with `(` or `not (`, with no top-level comma)
  wrapped in parentheses, and anything else (a media type, `only`, a list,
  `true`/`false`) is `UXD_BREAKPOINT_CONTEXT`. Substituted text is not
  scanned again. UXDSL never removes a `@custom-media`. A definition for a
  name that is not a theme breakpoint is the author's CSS: it and its uses
  are left as written (UXDSL is not a general custom-media resolver).
  `<bp>()` and stylesheets compiled apart keep the theme's query.
- **B5 — Unknown names.** A `(--<name>)` in an `@media` prelude that is
  neither a theme breakpoint (case-insensitive) nor exactly the name of a
  top-level `@custom-media` is recorded in the plugin's `Once` and judged at
  its `OnceExit`, after every plugin's visitors: it is
  `UXD_BREAKPOINT_UNKNOWN` if the at-rule is still in the stylesheet, its
  prelude still holds that token and no top-level `@custom-media` of that
  name is there now, so a plugin that resolves custom media (before or after
  this one) is not refused. The message lists the breakpoints usable in
  `@media` (the theme's, without the base) and a "did you mean" over those
  and the stylesheet's own definitions (`(--lgg)` → `"(--lg)"`); there is no
  edit-distance threshold for the error. It is located at the token with
  `uxdsl/postcss` alone; through `compile()` at the `@media` rule's line and
  column, mapped through the Sass stage (as are the media forms of
  `UXD_BREAKPOINT_CONTEXT`). The
  function form's message is unchanged. While one is pending, the compilation's
  warnings wait, as for a held Sass construct.
- **B6 — The base breakpoint and other contexts** (`UXD_BREAKPOINT_CONTEXT`).
  `(--<base>)`, the zero-width breakpoint (`xs` by default): it has no query;
  the rule follows the width, not the name, and a project definition of it
  replaces it like any breakpoint. `@media (--<bp>)` under `@keyframes`,
  `@font-face`, `@page` or `@counter-style` (vendor prefix stripped), as for a
  responsive value there; a literal `@media` there passes as written. A theme
  breakpoint name outside parentheses in an `@media` prelude (`@media --lg`,
  which Sass prints for an unquoted `$q: (--lg); @media #{$q}`). A
  `@custom-media --<bp>` that is not at the top level, when the compilation
  also uses `(--<bp>)` in an `@media` prelude and no top-level definition
  replaces it (alone, it passes as written). Only `@media` preludes are
  rewritten or rejected: `(--lg)` in an `@import` media list, `@container`,
  `@supports`, `@property`, `@layer`, a CSS `@function` or a `@custom-media`'s
  own query is left exactly as written (owner flag F4, §15). A nested
  `@media (--md) { @media (--lg) { … } }` is allowed (two min-width
  conditions).
- **B7 — Cascade against `lg()`.** A test pins the cascade between an
  `@media (--lg)` block and `lg()` on the same property: through `compile()`
  source order decides (Dart Sass emits declarations written after a nested
  block in a new rule after it, and `lg()`'s `@media` follows that rule);
  with the plugin alone `lg()`'s `@media` is inserted after the rule and wins
  over a nested block whatever the order. Both are documented, not changed.
- **B8 — Metadata.** `LANGUAGE_COMPLETIONS.customMedia` lists the default
  breakpoints usable in `@media`, derived from `DEFAULT_BREAKPOINTS` without
  the base: `['--sm', '--md', '--lg', '--xl']`; `.functions` and
  `.directives` are unchanged, and so are the entries' export lists.
  `npm run generate:language` adds a `breakpointMedia` grammar entry
  (`(--sm|md|lg|xl)` in parentheses, case-insensitive, scope
  `support.constant.breakpoint.uxdsl`) and grammar `injections` into VS
  Code's CSS `@media` header and property-list scopes, so it is highlighted
  at the top level and nested. A project's custom names are not highlighted
  (documented, as for functions); completion inside a prelude is MIG-B9-55's.
- **B9 — Catalog.** New `UXD_BREAKPOINT_SHADOWED` (owner `compiler`, a
  warning), provoked by a test. `UXD_BREAKPOINT_UNKNOWN` and
  `UXD_BREAKPOINT_CONTEXT` gain the media forms in their meaning and fix.
  `UXD_DIRECTIVE_CONTEXT` keeps its trigger; its message, meaning and fix
  name `@media (--<bp>)` around the rule. `UXD_BREAKPOINT_BLOCK` is not
  added.
- **B10 — The playground.** `SideNav.uxdsl`'s `@media (min-width: 1024px)`
  becomes `@media (--lg)`, with its comment rewritten to describe behavior;
  `not-found.uxdsl` keeps its deliberate local `@media (min-width: 600px)`.
  No visual change on SideNav (the default theme's `lg` is 1024, and no
  playground theme sets breakpoints). The `/docs/breakpoints` page shows the
  block form live (`breakpoints.uxdsl` and `BreakpointDocumentation.tsx`,
  with `sm`, `md`, `lg` and `xl`) and a "write / get" example with a theme
  that moves `md`; `/docs/language`'s examples use `@media (--md)`. The
  capability matrix gains a derived `custom-media` kind, and
  `capability-evidence.json`'s `handWrittenMediaQueries` goes from 2 to 1.
- **B11 — Documentation examples.** An example of a breakpoint block
  holding a directive nested in a rule is written in a ```` ```scss ````
  fence, so `scripts/doc-examples.test.js` compiles it through `compile()`;
  the plugin-alone error goes in a ```` ```css ```` fence. The harness
  compiles an example whose only UXDSL is `@media (--<name>)`.
- **B12 — No runtime impact.** `applyTheme` is unchanged: a breakpoint block
  compiles to the same query a responsive value does, so moving a threshold
  stays structural (`UXD_THEME_STRUCTURE`).
- **Chain order.** When a project redefines a breakpoint name with
  `@custom-media` and also runs `postcss-custom-media` or
  `postcss-preset-env`, `uxdsl/postcss` goes before them: in the other order
  they remove the definition in their `Once`, and `(--lg)` gets the theme's
  query with no warning. Documented, and pinned by a test.

Must stay byte-identical: every output whose `@media` preludes hold no
`--` (parity oracles are not re-recorded); the theme CSS; the
Bootstrap corpus's bytes and warnings. Must stay: the entries' export lists
(`test/entries.test.js`); MIG-B9-24's pins (each theme engine once per
compilation, the reference pass skipping when nothing can be checked, no
value parse for a value without `(`); MIG-B9-27's pins (Sass constructs held
to `OnceExit` in a chain); the function form's `UXD_BREAKPOINT_UNKNOWN`
message; `LANGUAGE_COMPLETIONS.directives` and `.functions`.

## 6. Out of scope

- Responsive directive arguments (`@ds-surface(xs(contained) lg(flat))`):
  plan D-2 option (b), not adopted.
- `max-width` or range blocks (`@md-down`): not in this release.
- Container context: MIG-B9-65 (a note).

## 7. Approach and traps

- One step, `rewriteBreakpointMedia(c)`, the first call in `runSteps`
  (before `emitTheme`). `validateOptions`' declaration walk becomes one
  `root.walk` that keeps its declaration bookkeeping and also collects every
  at-rule named `media` or `custom-media` whose prelude includes `--`; the
  step returns at once when none was collected. It applies regexes to
  preludes only and parses no value. The theme's generated nodes are
  inserted later, so they are never collected.
- Only the `(--<name>)` media feature is replaced
  (`/(?<![\w-])\(\s*--([A-Za-z0-9_-]+)\s*\)/g`: a `(` that no name
  character precedes, so `var(--x)`, `env(--x)` and `theme(--x)` are not
  media features),
  with `minWidthQuery(px)`, the helper the responsive expansion's two media
  sites also call. A comment inside the prelude (`raws.params`) gets the same
  replacement in its raw text. The cheap guard is `params.includes('--')`:
  `( --lg )` is valid media-query syntax.
- `holdSassSyntax` keeps its constructs on the compilation. A held
  construct whose at-rule's prelude the step rewrote gets its recorded text
  updated, so it is judged at `OnceExit` on the rewritten prelude: without
  it the construct's text changes and the plugin throws even when a chain
  plugin would resolve the `$variable` (a MIG-B9-27 regression).
- Unknown names are recorded in `Once` and judged in `releaseSassSyntax`,
  after the held Sass constructs (MIG-B9-27's order) and before the held
  reports; a compilation with an unknown is registered in `pending` as one
  with a construct is. `Once()` still calls exactly `validateOptions`,
  `holdSassSyntax` and `runSteps`.
- The responsive expansion's non-rule branch checks, before cloning, whether
  an ancestor up to the nearest rule is an `@media` the step rewrote; that
  is owner flag F1's error, with the prelude the author wrote.
- `rejectLeftoverDirectives` reads the `ds` namespace only, so a rewritten
  `@media` is never mistaken for a directive.
- The reference pass reads `@media (min-width: Npx)` as a min-width
  condition (`reference-core.ts`, `parseMinWidth`): a rewritten
  single-feature prelude reads as one; a compound one matches exactly only,
  as a literal compound prelude does. No change there.
- Messages (exact; `<…>` is filled in):
  - `UXD_BREAKPOINT_UNKNOWN: (--lgg) is not a breakpoint of the theme or a @custom-media of this stylesheet; breakpoints usable in @media: (--sm), (--md), (--lg), (--xl). Did you mean "(--lg)"?`
  - `UXD_BREAKPOINT_CONTEXT: (--xs) is the base breakpoint: it has no media query, because its values apply at every width; write these rules outside @media, or remove (--xs) from the condition.`
  - `UXD_BREAKPOINT_CONTEXT: @media (--lg) cannot live inside @keyframes: a media query cannot be nested there; write @media (--lg) around the @keyframes instead.`
  - `UXD_BREAKPOINT_CONTEXT: --lg in @media --lg is not in parentheses, so it is not a media feature and the block never applies; write (--lg). In Sass, quote a query held in a variable: $query: "(--lg)".`
  - `UXD_BREAKPOINT_CONTEXT: @custom-media --lg is not at the top level of the stylesheet, where a custom media query is defined; move it out of the rule to replace the theme's lg.`
  - `UXD_BREAKPOINT_CONTEXT: (--lg) stands for screen and (min-width: 900px) in this stylesheet (@custom-media --lg), a query with a media type, a list or a keyword, which cannot be combined inside @media print and (--lg); write the definition as a condition such as (min-width: 900px), or use (--lg) on its own.`
  - `UXD_BREAKPOINT_CONTEXT: a responsive value cannot sit in @media (--lg) nested in a rule with uxdsl/postcss alone: CSS nesting cannot move the block out of the rule. Write the value on the rule (padding: xs(…) lg(…)), put the rule inside a top-level @media (--lg), or compile the file with compile() (a .uxdsl file).`
  - `UXD_BREAKPOINT_SHADOWED: @custom-media --lg (min-width: 900px) replaces the theme's lg, (min-width: 1024px), in this stylesheet: (--lg) compiles to (min-width: 900px) here, while lg() and stylesheets compiled apart keep the theme's. Remove it to use the theme's lg, or change breakpoints.lg in the theme to move it everywhere.`
    For the base it reads `the theme's xs, no media query (the base breakpoint),`.
  - `UXD_DIRECTIVE_CONTEXT: @ds-surface must be a direct child of the rule it styles. To apply a role from a breakpoint up, put the rule inside the block, @media (--md) { .card { @ds-surface(…); } }, which works on both paths (in a .uxdsl file compiled by compile() the block may also be nested in the rule); to change one property, use a responsive value, padding: xs(…) md(…).`
- Stop rule: if Dart Sass stops carrying `@media (--lg)` through a construct
  the playground uses (a mixin's `@content`, `@supports`, `&:hover`, nested
  rules), so that the plugin would need a second bubbling implementation,
  record it and stop; never build one. Verified not triggered on Dart Sass
  1.107.0 (mixin `@content`, `&:hover`, `@supports`, `@layer`); the
  playground's `.uxdsl` sources hold no `@mixin`, `@include`, `@supports` or
  `@container`.

## 8. Tests

Titles start with `MIG-B9-30:`; `test/` is `packages/uxdsl/test/`.

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/breakpoint-blocks.test.js` | `(--<bp>)` in an `@media` prelude becomes the query `<bp>()` emits with the plugin alone: top level and nested, lists, types, `not`, `only`, `and`, any case, inner spaces, a custom or fractional breakpoint; raws and comments kept | unit (`uxdsl/postcss`) | B1 | byte-identical: a literal `(min-width: 1024px)`, `@supports (--lg: 1)`, `@media (--lg: 1)`, `@container (--lg)`, an `@import` media list, a CSS `@function`, `@property --lg`, `@layer` |
| T2 | same | a `(--lg)` block compiles byte for byte to what the literal theme query compiles to, on both paths, and follows the theme | unit | B1, B10 | with `lg: 1100` it equals the 1100px literal and differs from the 1024px one |
| T3 | same | through `compile()`, a nested `@media (--lg)` holding `@ds-surface(flat)` bubbles and the directive expands; also in a mixin's `@content`, `&:hover`, `@supports` and `@layer` | unit (`compile()`) | B2 | the plugin alone gives `UXD_DIRECTIVE_CONTEXT` (T5) |
| T4 | same | Sass's merge of nested breakpoint media queries is pinned | unit (`compile()`) | B2 | `not print` stays nested |
| T5 | same | with the plugin alone a directive inside a nested `@media (--lg)` is `UXD_DIRECTIVE_CONTEXT`, located, naming the rule-inside form | unit | B3, B9 | the rule-inside form compiles on both paths |
| T6 | same | an unknown `(--name)` in `@media` is `UXD_BREAKPOINT_UNKNOWN` with the usable breakpoints and a suggestion, on both paths, located | unit | B5 | a defined `--narrow` combined with `(--md)` compiles; the function-form pins pass unchanged |
| T7 | same | a breakpoint where it cannot apply is `UXD_BREAKPOINT_CONTEXT`: `(--xs)`, under `@keyframes`, a bare `--lg`, a nested `@custom-media --lg` the stylesheet uses, a typed project query in a compound prelude | unit | B6, B4 | a literal `@media` under `@keyframes`, a quoted Sass query and a lone nested `@custom-media` keep the base's behavior |
| T8 | same | a project `@custom-media --lg` replaces the theme's `lg` with one `UXD_BREAKPOINT_SHADOWED` per definition, located at it, and stays in the output | unit | B4, B9 | `lg()` keeps 1024px; no definition, no warning; a failing compilation gives no warning; `--narrow` gives none |
| T9 | same | in a PostCSS chain a custom media another plugin resolves is not `UXD_BREAKPOINT_UNKNOWN`, because it is judged at `OnceExit` | unit | B5, chain order | without the resolving plugin it fails; the documented wrong order gives the theme's query (the caveat pinned) |
| T10 | same | a held `$variable` in a prelude that also holds `(--lg)` is judged on the rewritten prelude | unit | §7 | a stand-in that resolves nothing fails at `OnceExit`; `postcss-chain.test.js` unchanged |
| T11 | same | the cascade between an `@media (--lg)` block and `lg()` on the same property, on both paths | unit | B7 | the literal query gives the same outputs |
| T12 | same | with the plugin alone a responsive value directly in an `@media (--lg)` block nested in a rule is `UXD_BREAKPOINT_CONTEXT` | unit | B3 (F1) | through `compile()` it compiles; the literal nested form keeps its bytes |
| T13 | same | the reference pass reads a rewritten prelude as the min-width query it is | unit | §7 | `(--sm)` gives one issue; a compound prelude matches exactly only |
| T14 | `test/plugin-work-per-compilation.test.js` | a compilation whose `@media` preludes hold no `--` does no new work and compiles byte-identically | unit | B1, must stay | one `(--lg)` changes exactly that prelude |
| T15 | `test/compiler-structure.test.js` | (existing test, list updated) `runSteps` sequences `rewriteBreakpointMedia` first | unit | B1 | `runSteps()` only sequences the steps |
| T16 | `test/diagnostics-catalog.test.js`, `test/diagnostics-coverage.test.js` | `UXD_BREAKPOINT_SHADOWED` is catalogued and provoked | unit | B9 | `diagnostic()` refuses an uncatalogued code |
| T17 | `scripts/doc-examples.test.js` | an example whose only UXDSL is `@media (--lg)` is compiled by the doc-example harness | docs | B11 | `@media (--lgg)` documented with the wrong code is reported with `UXD_BREAKPOINT_UNKNOWN` |
| T18 | `test/language.test.js` | `LANGUAGE_COMPLETIONS.customMedia` lists the default breakpoints usable in `@media` | unit | B8 | no `--xs`; `.functions`/`.directives` unchanged |
| T19 | `packages/uxdsl-vscode/test/grammar.test.js` | `(--<breakpoint>)` is highlighted in an `@media` prelude, top level and nested | unit (Oniguruma) | B8 | no scope without the injections, for `var(--lg)`, `--lg: 1px`, `@container (--lg)`, `(--lgg)`, `(--xs)` |
| T20 | `fixtures/vscode-extension/run.js` | the packaged grammar carries `breakpointMedia` and its injections | VSIX | B8 | the directives assertion still holds |
| T21 | `scripts/capability-matrix.test.js` | `custom-media` rows are derived and live; the dogfooding baseline locks the removed media query | docs | B10 | the baseline left at 2 fails |
| T22 | `fixtures/release-1.0/run.js`, `verdicts.test.js` | `S-8 \| [tarball] a @media (--lg) block with a directive compiles through the installed CLI to @media (min-width: 1024px) with the role's declarations` | tarball | B2, B4, B5 | `verdicts.test.js` rejects BASE's pass-through, a misplaced warning and an error without the suggestion |
| T23 | `fixtures/playground-browser` (`walk.js`, `compare.js`) | SideNav unchanged at 1023 and 1024; only the declared docs routes differ | Chrome | B10 | the walk's built-in controls |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/breakpoint-blocks.test.js` exits 0.
- **AC2** `grep -rnE "@media[^{]*\(\s*min-width" packages/playground-nextjs/src --include='*.uxdsl'`
  prints exactly one line, `not-found.uxdsl:61` (the deliberate local
  600px), and `grep -q "(--lg)" packages/playground-nextjs/src/components/SideNav.uxdsl`
  exits 0 (MIG-B9-40's precondition).
- **AC3** `npm run verify:playground-browser` exits 0; the compare report
  lists no visual difference except the declared `/docs/breakpoints`
  addition and docs example text (SideNav at 1023 and 1024 and every other
  route unchanged).
- **AC4** `node scripts/generate-language-artifacts.js --check` exits 0 after
  `npm run generate:language`; the generated grammar holds the
  `breakpointMedia` entry and its injections, asserted by
  `packages/uxdsl-vscode/test/grammar.test.js` and
  `fixtures/vscode-extension/run.js`.
- **AC5** `npm test` exits 0; `npm run verify:1.0` exits 0 with `S-8 ok`.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes (`LANGUAGE_COMPLETIONS.customMedia`, the grammar's `breakpointMedia` and injections) |
| `AGENTS.md` + `npm run generate:agent-guide` | yes ("Breakpoints": the block form, the project `@custom-media` rule and its warning, the chain order, `@media` only, the plugin-alone file scope; "Surfaces": a directive under a nested `@media` fails only with `uxdsl/postcss` alone, and `@media (--bp)`) |
| CHANGELOG | yes: this story's subsection under `## 0.5.0-beta.9 — unreleased`, append-only (Added, Changed; no package visual change) |
| `migration.md` | yes (one appended beta.9 entry: replace a hand-written min-width query equal to a theme breakpoint with `@media (--<bp>)`, keep deliberate local thresholds, an undefined `(--name)` now fails, a project `@custom-media` named like a breakpoint now warns and is applied) |
| package README | yes (appended at the end of "Breakpoints (source of truth)") |
| `DIAGNOSTIC_CATALOG` | yes (`UXD_BREAKPOINT_SHADOWED`; `UXD_BREAKPOINT_UNKNOWN`, `UXD_BREAKPOINT_CONTEXT` and `UXD_DIRECTIVE_CONTEXT` reworded) |
| `npm run generate:capabilities` | yes: `scripts/lib/capabilities.js` gains a derived `custom-media` kind from `LANGUAGE_COMPLETIONS.customMedia`, and `packages/playground-nextjs/capability-evidence.json`'s `dogfoodingBaseline.handWrittenMediaQueries` goes from 2 to 1 (`scripts/capability-matrix.test.js` fails otherwise) |
| playground `uxdsl:build` | yes (SideNav's comment and the `/docs/breakpoints` demo's rules are the only differences in `uxdsl.css`) |
| captures | `packages/playground-nextjs/scripts/capture-capabilities.js` (the reworded `UXD_DIRECTIVE_CONTEXT` text) and `capture-examples.js` (the new `breakpoint-blocks` example) |

## 11. Documentation

`packages/uxdsl/README.md`, `AGENTS.md`, `packages/uxdsl/docs/migration.md`,
`packages/uxdsl/CHANGELOG.md`, the playground's `/docs/breakpoints` page
(`BreakpointDocumentation.tsx`: the block form, live).

## 12. Verification

```bash
node --test packages/uxdsl/test/breakpoint-blocks.test.js   # exit 0
npm run generate:language && node scripts/generate-language-artifacts.js --check   # exit 0
npm run generate:capabilities && node --test scripts/capability-matrix.test.js     # exit 0
grep -rnE "@media[^{]*\(\s*min-width" packages/playground-nextjs/src --include='*.uxdsl'   # one line: not-found.uxdsl:61
grep -q "(--lg)" packages/playground-nextjs/src/components/SideNav.uxdsl            # exit 0
npm --prefix packages/playground-nextjs run uxdsl:build       # exit 0
node fixtures/parity/run.js                                   # exit 0, never --update
node fixtures/sass-corpus/run.js --no-timing-budget           # bytes and warnings as BASE
npm run verify:playground-browser                             # background; exit 0 (Chrome)
npm test                                                      # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                  # background; exit 0, S-8 ok
node fixtures/mig-b9-23-compile-budget/run.js --base <a build of BASE>   # last and alone
```

## 13. Delivery

Branch `feat/b9-30-breakpoint-blocks`. Commit:
`feat(FEAT-010): MIG-B9-30 - breakpoint media queries: @media (--lg) means from lg up; the playground's SideNav follows the theme`.

## 14. Closure record

- **PR:** #104, `feat/b9-30-breakpoint-blocks` → `feat/beta9`. BASE `6b8e3a9`
  (the merge of PR #102). While the delivery ran, `origin/feat/beta9` moved
  to `461116b` (PR #101, MIG-B9-28, CI on Windows); it was merged into the
  branch as `8528a5b` (one conflict, `packages/uxdsl/CHANGELOG.md`, where
  both stories had added their subsection at the top of
  `## 0.5.0-beta.9 — unreleased`: both kept whole, no line removed).
  Machine: macOS 27.0, Node v20.19.0, npm 11.21.1, Chrome 158.0.8127.37 at
  the default path (157 for the implementers' runs of 2026-11-16), Dart
  Sass 1.107.0, PostCSS 8.5.31. Load averages were 4–11; another workflow
  shared the machine.
- **Commits:** `7040177` (contract rewritten to DEC-07 as amended),
  `81e2b95`, `83cc035`, `e1d7285`, `a61cea8`, `38cdf88` (the engine half),
  `4faa22b`, `c7f39e8`, `0c2e5cf`, `c5a42ac`, `7c809f8` (the playground,
  metadata, release gate and documentation half), `8137555` and `c6a37cd`
  (the review's fixes), `8528a5b` (the merge of `feat/beta9`), and the
  closure commit that adds this record.
- **Failing first.** Every behavior was run red against the build of the
  commit before it; §15's two implementation blocks quote each failure
  (on BASE: 9 of 12 of `breakpoint-blocks.test.js` and
  `compiler-structure.test.js`, e.g. `'@media (--md) { .a { color: red } }'`
  where `'@media (min-width: 768px) { … }'` was expected). The review's
  fixes were proven with mutants of the built plugin, each failing exactly
  one test (15 pass / 1 fail) and passing unmutated (16 / 16): four for the
  `OnceExit` conditions and the held warnings (CT-1), the unbounded token
  regex (CT-2/RB-1), the warning that quoted each definition's own query
  (RB-2/DE-3), the base chosen by name (DE-5), and the `OnceExit`
  re-check's regex (RR-1); the capability and doc-example patterns' mutants
  back to `7c809f8` fail 8/1 and 24/1 (RR-2).
- **Criterion to test:**
  - AC1 → `breakpoint-blocks.test.js` (16 tests, T1–T13 and the review's
    three): B1/B3 T1, T2, T13; B2 T3, T4; B3 T5, T12; B4 T8, T7; B5 T6, T9
    and the `OnceExit` test; B6 T7 (with the zero-width `base` theme case);
    B7 T11; chain order T9; held construct T10; dashed name in a function
    the CT-2 test. Must stay: T14 (`plugin-work-per-compilation.test.js`),
    T15 (`compiler-structure.test.js`), `postcss-chain.test.js`,
    `entries.test.js`, `no-silent-output.test.js` unchanged and green.
  - AC2 → the two greps.
  - AC3 → T23: the walk, and the second implementer's compare.
  - AC4 → T18 (`language.test.js`), T19 (`grammar.test.js`, 2), T20
    (`fixtures/vscode-extension/run.js`).
  - AC5 → `npm test`; `verify:1.0` with T22 (S-8, `verdicts.test.js`, 2).
  - B9 → T16 (catalog and coverage tests see `UXD_BREAKPOINT_SHADOWED`
    asserted by T8); B10 → T2, T21 (`capability-matrix.test.js`, 2); B11 →
    T17 (`doc-examples.test.js`, 2).
- **The deliverer's runs on `c6a37cd`** (2026-11-23, `TMPDIR` a scratch
  directory, 0 entries left after each run):
  - `npm --prefix packages/uxdsl run build`: exit 0.
  - **AC1:** `node --test` of `breakpoint-blocks`, `diagnostics-catalog`,
    `diagnostics-coverage`, `language`, `plugin-work-per-compilation`,
    `compiler-structure`, `postcss-chain`, `entries` and
    `no-silent-output` (11:21, load 8.86): exit 0, 148 pass, 0 fail.
  - **AC4:** `npm run generate:language` exit 0, then
    `node scripts/generate-language-artifacts.js --check` exit 0, tree
    clean; `node fixtures/vscode-extension/run.js` exit 0, "PASS", with
    "ok - the packaged grammar carries breakpointMedia and injects it into
    the @media header and the property list".
  - `node fixtures/parity/run.js` (never `--update`): exit 0, "PASS: 10
    parity case(s)"; `git diff --exit-code 6b8e3a9 --
    fixtures/parity/expected` exit 0.
  - `npm run verify:doc-examples`: exit 0, "78 examples and 24 theme
    excerpts checked across 101 documentation files."
    `node scripts/generate-agent-guide.js --check`: exit 0.
  - **AC5:** `npm test` (11:22–11:28, load 8.15 → 9.40): exit 0, 1708
    tests, 1707 pass, 0 fail, 1 skipped (MIG-B9-11's corpus test, which
    needs `UXDSL_SASS_CORPUS`, as on BASE); 52 log lines name
    `MIG-B9-30:`.
  - `npm --prefix packages/playground-nextjs run uxdsl:build`: exit 0,
    "unchanged src/app/uxdsl.css"; `git status` clean. Against BASE the
    file differs by SideNav's rewritten comment (its
    `@media (min-width: 1024px)` block byte-identical) and the
    `/docs/breakpoints` demo's rules (one `@media (min-width: 480 | 768 |
    1024 | 1280px)` per chip): 71 lines added, 3 removed.
    `node packages/playground-nextjs/scripts/capture-capabilities.js
    --check`: exit 0, "Captured CLI and compiler output is up to date."
  - **AC2:** the grep prints exactly
    `packages/playground-nextjs/src/app/not-found.uxdsl:61:@media
    (min-width: 600px) {`; `grep -q "(--lg)" …/SideNav.uxdsl` exits 0.
  - **AC3:** `npm run verify:playground-browser`, run 1 (11:29–11:31, load
    7.33 → 8.60): exit 1 after the 19 light routes,
    `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3919/` —
    the `next start` server went away mid-walk, not a page failure (the
    walk's port is fixed at 3919 and another workflow's gate ran on the
    machine; follow-up 7). Re-run (11:38–11:42, load 6.93 → 7.22): exit 0,
    "PASS: no console errors, no UXDSL warnings, no unresolved var(),
    visible keyboard focus, contrast page = Node.", 380 pages, 2240
    focusable elements, 19 routes × 2 schemes × 10 widths (1023 and 1024
    included), its six negative controls caught. The compare was the
    second implementer's, on `7c809f8` (§15): no difference outside
    `/docs/breakpoints` (5,328 records: the new demo and "write / get"
    example), `/docs/language` (3,635: example text), `/docs/surfaces`
    (647) and `/docs/introduction` (355) (prose wording), and
    `/docs/diagnostics` (20: the reworded `UXD_DIRECTIVE_CONTEXT`
    capture); none in the header or the SideNav column at any width. No
    file under `packages/playground-nextjs` changed after `7c809f8`, and
    the build above leaves `uxdsl.css` and `examples.json` unchanged, so
    it was not repeated.
  - **AC5:** `npm run verify:1.0` (the full gate, walk included), run 1
    (11:31–11:38, load 8.60 → 9.47): exit 1, 73/74, `FAIL UX-10 reference
    validation stays near-linear — doubling cost x3.18` (a timing under
    load; `S-8 ok`, `B7-17E` walk PASS). Re-run (11:42–11:49, load 7.22 →
    6.21): exit 0, "74/74 automated checks passed. PASS: the 1.0 gate
    (automated portion) for uxdsl@0.5.0-beta.9.", `UX-10 … x2.31 per
    doubling`, `S-8 ok` ("@media (--lg) compiled to @media
    (min-width: 1024px) with the flat role; UXD_BREAKPOINT_SHADOWED at
    src/a.uxdsl:1:1, (--lg) compiled to (min-width: 900px); src/a.uxdsl:4:1
    UXD_BREAKPOINT_UNKNOWN, did you mean "(--lg)""). Each run left five
    tarball-consumer directories in `TMPDIR` by design; they were removed.
  - `node fixtures/sass-corpus/run.js --no-timing-budget` (Mon Nov 23
    11:49:21 EST 2026, load 6.03 7.38 8.55): exit 0, 276,926 bytes,
    `byte-identical: true`, 21 warnings, the five checks ok; Dart Sass
    median 369 ms, `compile()` 450 ms, 1.22x.
  - `node --test --test-concurrency=1
    packages/uxdsl/test/performance/*.test.js` (11:49:32, load 5.53): exit
    0, 1 pass.
  - `node fixtures/mig-b9-23-compile-budget/run.js --base <a fresh build of
    6b8e3a9 in the scratch directory>`, last and alone (11:49:56–11:52:37,
    load 6.08 → 7.21): exit 0, "All checks ok."; the corpus equals BASE's
    css, map, dependencies and warnings in the three `sourceMap` modes
    (276,926 bytes; inline 791,522; 87 dependencies; 21 warnings); the
    large-directory check +1.5 ms (planted control +147.7 ms). The first
    attempt exited 2 before measuring anything: the implementer's BASE
    build had been emptied by the machine's temporary-file cleaner
    (`has no dist/entries/index.js: build it first`), so BASE was archived
    and built again.
- **On the merged head** (`8528a5b`'s tree): `npm --prefix packages/uxdsl
  run build` exit 0; `npm test` (11:54–11:59, load 10.30 → 6.31) exit 0,
  1718 tests, 1709 pass, 0 fail, 9 skipped (MIG-B9-28's win32-only tests
  and the corpus test); `npm run verify:doc-examples` exit 0; the
  pre-commit hook (`verify:docs`, the playground's `next build`) passed.
  The merge brought CI, test and documentation files only (no file under
  `src`), so the browser walk, `verify:1.0`, the corpus and the budget were
  not repeated on it; CI runs `npm test` and `verify:1.0` on the PR.
- **The implementers' and fixers' runs** are in §15 ("Implementation,
  engine half", "Implementation, playground, metadata and documentation
  half") and in the review's record below: `npm test` exit 0 before each
  of the 13 commits (1681 on BASE → 1697 → 1703, then the fixers' runs at
  load 45–54 and 7–12); corpus 276,926 bytes and 21 warnings every run,
  BASE 1.30x, 1.31x, 1.31x, 1.34x against the branch 1.32x, 1.32x, 1.40x,
  1.29x (2026-11-16, loads 3.7–7.6); the budget all ok twice (−1.2 ms,
  +2.9 ms); the plugin alone on Bootstrap's compiled CSS: BASE 45.19 /
  44.90 ms, branch 44.66 / 44.71 ms (medians, load 7.08), outputs
  identical; `verify:1.0 -- --skip-playground-walk` 73/73 with `S-8 ok`;
  the walk exit 0. The first fixer's gate run timed out in
  `capture-capabilities.js --check` under load ("timed out waiting for the
  first build") and passed on the re-run; both are recorded.
- **Contract as delivered, where it differs from the rewritten §5 and §7**
  (each line corrected in place, old and new text in §15's delivery
  block):
  - B5's location: at the token with `uxdsl/postcss` alone; through
    `compile()` at the `@media` rule's line and column (the Sass stage
    map's granularity). Owner flag, answered (a).
  - "Must stay byte-identical": outputs whose `@media` preludes hold no
    `--`, not no `(--name)`: a bare `@media --lg` is
    `UXD_BREAKPOINT_CONTEXT` by design Q12. Owner flag, answered (a).
  - §7's token regex has a left boundary, `(?<![\w-])\(\s*--…\)`:
    `var(--x)`, `env(--x)` and `theme(--x)` in a prelude are not media
    features and are left as written (review CT-2/RB-1); the grammar, the
    capability pattern and the doc-example harness follow it.
  - `UXD_BREAKPOINT_SHADOWED` names what `(--bp)` compiles to: the last
    definition's query, `all`/`not all` for `true`/`false` (review
    RB-2/DE-3); for one definition the text is §7's.
  - The F1 message names the declaration's own property and the prelude's
    breakpoint (`(padding: xs(…) lg(…))`); `UXD_BREAKPOINT_UNKNOWN`'s catalog
    fix says a plugin before or after `uxdsl/postcss` (DE-4).
- **Review and outcome.** Three lenses (contract-tests, rewrite-behavior,
  docs-evidence), then a mutation re-review. Blocking: CT-1 (B5's
  `OnceExit` conditions and held warnings untested: four surviving
  mutants) and RR-1 (the `OnceExit` re-check's boundary untested). Should
  fix: CT-2/RB-1 (`var(--lg)` in a prelude rewritten to
  `var(min-width: 1024px)`, `var(--gutter)` rejected), DE-1 (compile.md and
  AGENTS.md said `compile()` changes nothing else in Sass's output), DE-2
  (the byte-identity wording), CT-3 (B5's location). All fixed in
  `8137555` and `c6a37cd` with tests that fail on their mutants; RR-2 and
  the nits DE-3, DE-4, DE-5 fixed; CT-3, CT-4, CT-5 and DE-6 recorded by
  this closure. Not applied: RB-2's part (c) and the F1 advice under a
  project `@custom-media` (follow-up 4).
- **Not run, and why:** highlighting in a real VS Code with the VSIX
  installed (release-gate item B7-12, the owner's); `snapshot.js`'s
  interactions (they time out on BASE too; follow-up 6); a new browser
  compare (the playground is unchanged since the one recorded); the
  browser walk, `verify:1.0`, the corpus and the budget on the merged head
  (no source change came with the merge; CI runs `verify:1.0`).
- **Owner steps:** review and merge PR #104 into `feat/beta9`; override
  any flag answered as recommended (§15, "Owner flags of 2026-11-16" and
  the delivery block); check `UXD_BREAKPOINT_SHADOWED`'s catalog entry and
  the reworded `UXD_DIRECTIVE_CONTEXT` text; the VS Code check (B7-12);
  patch Press Craftor after beta.9 (D17; the delivery block lists its
  queries).

## 15. Findings and follow-ups

- Owner's call recorded here: `not-found.uxdsl`'s 600 px threshold moves to
  `@md` (768 px) by default; keeping 600 px would need an allowlisted
  `@media` in MIG-B9-43. (Superseded by the owner decisions of 2026-10-23:
  `not-found.uxdsl` keeps its 600px.)

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Name collisions.** Breakpoint names are only checked against `THEME_NAME_PATTERN` `^[a-z][a-z0-9-]*$` (theme-validate.ts:72), so a breakpoint called `page`, `layer`, `container`, `media`, `scope`, `theme`, `uxdsl`, `else` or `content` would turn those at-rules into breakpoint blocks. Reserve them in `validateTheme`.
- Declarations directly in a top-level block (`@lg { color: red }`) pass Sass and become `@media { color: red }`, which browsers drop: make it an error.
- A responsive function inside a block: with the plugin alone the non-rule branch of the responsive expansion (plugin.ts:918-935 on `6b8e3a9`) inserts the clone at the root without its selector (reproduced with a literal nested `@media`); through Sass `md()` ends up applying from lg up. Make it `UXD_BREAKPOINT_CONTEXT`.
- `@ds-button`/`@ds-input` inside a block creates a second set of states on another rule node and bypasses `UXD_DIRECTIVE_DUPLICATE`: define it, preferably as an error.
- Cascade against `lg()` (re-measured on Dart Sass 1.107.0): through `compile()` source order decides, because Sass emits declarations written after a nested `@media` in a new rule after the block and `lg()`'s `@media` is inserted right after that rule; with the plugin alone the block stays nested in its rule and `lg()`'s `@media` is inserted after the rule, so `lg()` wins whatever the source order. Pin both with a test.
- Value: directives under a nested `@media` already work (MIG-B9-10 D10; SideNav does it today). Consider `@media (--lg)` (CSS custom-media syntax: no name collisions, Sass merges it with outer queries) before adding an at-rule per breakpoint; the playground's stylelint `scss/at-rule-no-unknown` would also need the names. Recommended: defer to beta.10.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-07 changes the syntax.** Rewrite §1 and §5 before implementing: the block form is `@media (--<breakpoint>) { … }`, the CSS custom-media syntax. `(--<bp>)` in an `@media` prelude is replaced with the effective theme's query for `<bp>`, the same one `<bp>()` produces, on both paths (`compile()` after Sass, and the plugin alone). It combines with other conditions (`@media print and (--lg)`); pin Sass's merge of nested media queries with a test.
- **What is written by hand wins.** A literal query (`@media (min-width: 1024px)`) is compiled as written and never rewritten. A project's own `@custom-media --<bp> …` replaces the theme's `--<bp>` in that build, with one warning (the DEC-17 rule). `(--name)` that is neither a theme breakpoint nor a project `@custom-media` is `UXD_BREAKPOINT_UNKNOWN` with a "did you mean".
- Directives inside `@media (--lg)` under a rule work as they do under a nested `@media` today (MIG-B9-10 D10). The playground's SideNav moves from `@media (min-width: 1024px)` to `@media (--lg)`; `not-found.uxdsl` keeps its deliberate local 600px.
- The review's at-rule findings (name collisions, declarations at the top of a block, a second directive set inside a block, stylelint's `at-rule-no-unknown`) no longer apply; the cascade test against `lg()` still does.

### Contract rewritten to DEC-07 as amended, 2026-11-16

The owner's decisions of 2026-10-23 (above) say "Rewrite §1 and §5 before
implementing". Sections 1, 5, 7, 8, 9, 10 and 12 were rewritten to the
decided syntax, following the design of 2026-11-16 and the owner flags
below; the header's Shares and Output impact and §13's commit subject
were adapted; sections 6 and 13 otherwise stay. The rewritten text is the
binding contract. The text it replaces, verbatim:

Header:

`````markdown
| Shares | `packages/uxdsl/src/plugin.ts`, `packages/uxdsl/src/language.ts` (completions), `packages/uxdsl/src/diagnostics.ts`, `scripts/generate-language-artifacts.js` (the grammar), `fixtures/release-1.0/run.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | new syntax (additive); the playground's two `@media` become breakpoint blocks (one declared visual change) |
`````

§13 commit subject: `feat(FEAT-010): MIG-B9-30 - breakpoint blocks: @lg { … } means from lg up; the playground's last two media queries removed`

`````markdown
## 1. Goal

"The author never writes a media query" becomes literally true. A block of
declarations, nested rules or a directive that applies from a breakpoint up
is written as the breakpoint's name: `.nav { @lg { @ds-surface(flat); } }`.
`````

`````markdown
## 5. Contract

- **B1 — The rewrite.** Before `expandDirectives`, the plugin rewrites every
  at-rule whose lowercase name is a breakpoint of the effective theme
  (`c.bpNames`) **and** has a block **and** no parameters into
  `@media (min-width: <width>px)`, wherever it sits (top level or nested).
  The base breakpoint (width 0, `xs` by default) is not allowed as a block:
  `UXD_BREAKPOINT_BLOCK: @xs is the base breakpoint; write its declarations
  without a block.` A breakpoint-named at-rule with parameters
  (`@md (hover) { … }`) or without a block (`@md;`) is
  `UXD_BREAKPOINT_BLOCK` with the form to write. Names are case-insensitive,
  like the functions.
- **B2 — Through Sass.** `.nav { @lg { display: flex; @ds-surface(flat); } }`
  in a `.uxdsl` file compiles to
  `@media (min-width: 1024px) { .nav { display: flex; <the role's declarations> } }`:
  Sass bubbles the block, the plugin rewrites the at-rule, the directive is a
  direct child of its rule and expands.
- **B3 — Through the plugin alone (CSS nesting).** `.nav { @lg { display: flex; } }`
  in a `.css` file compiles to `.nav { @media (min-width: 1024px) { display: flex; } }`
  (native nested media); a directive inside such a nested block is still
  `UXD_DIRECTIVE_CONTEXT`, because CSS nesting cannot bubble. The asymmetry is
  documented: directives from a breakpoint need the `.uxdsl` path.
- **B4 — Context rules.** A breakpoint block inside an unsplittable at-rule
  (`@keyframes` …) is `UXD_BREAKPOINT_CONTEXT`, like a responsive value there.
  A breakpoint block inside another breakpoint block is allowed (two
  `min-width` conditions; the inner one wins or is redundant) — Sass and the
  browser handle it; no error.
- **B5 — Metadata.** `LANGUAGE_COMPLETIONS` lists the default breakpoint
  names as at-rules; `npm run generate:language` adds `@xs|@sm|@md|@lg|@xl`
  (the default names) to the TextMate grammar's at-rule alternation and the
  completions; a project's custom breakpoint names are not highlighted
  (documented, as for functions).
- **B6 — Catalog.** `UXD_BREAKPOINT_BLOCK` (owner `compiler`): meaning and
  fix as above.
- **B7 — The playground.** `SideNav.uxdsl`: the `@media (min-width: 1024px)`
  becomes `@lg { … }` with `@ds-surface(flat)` moved inside it (the comment
  about the exception deleted); `not-found.uxdsl`: `@media (min-width: 600px)`
  becomes `@md { … }` — a **declared visual change**: the card grid goes to
  two columns from 768px instead of 600px (the visual comparison harness
  records it as intended). The alternative — keeping 600px as an allowlisted
  exception — is noted for the owner in §15; the default is the principle.
- **B8 — Documentation examples.** A README example of a breakpoint block
  with a directive is written in a ```` ```scss ```` fence so the harness
  compiles it through `compile()` (Sass bubbling), not through the plugin
  alone.
- **B9 — No runtime impact.** `applyTheme` is unchanged (a breakpoint block
  compiles to the same `@media` a responsive value does; thresholds remain
  structural).

Must stay byte-identical: every output without a breakpoint-named at-rule;
the theme CSS.
`````

`````markdown
## 7. Approach and traps

- Rewrite at-rule names on the PostCSS root (`walkAtRules`) before anything
  else looks at directives; set `name = 'media'` and
  `params = '(min-width: Npx)'`, keep `raws` so output formatting matches the
  responsive expansion's media blocks (compare with `expandResponsive`'s
  `@media` output in the tests).
- `rejectLeftoverDirectives` must not see `@lg` as an unknown directive: it
  checks the `ds` namespace only; verify.
- The reference pass groups contexts by selector and conditions; a rewritten
  block is an ordinary `@media` by then.
- Stop rule: if Sass does not bubble a breakpoint block in some construct the
  playground uses (for example inside `@supports`), record it; do not add a
  second bubbling implementation in the plugin.
`````

`````markdown
## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/breakpoint-blocks.test.js` | `MIG-B9-30: a top-level @md block becomes @media (min-width: 768px); case-insensitive; a custom breakpoint name works` | unit (`uxdsl/postcss`) | B1 | `@foo { }` (not a breakpoint) passes through untouched |
| T2 | same | `MIG-B9-30: through compile(), .nav { @lg { @ds-surface(flat) } } bubbles and the directive expands inside the media block` | unit (`compile()`) | B2 | — |
| T3 | same | `MIG-B9-30: through the plugin alone, a nested @lg becomes a nested @media; a directive inside it is UXD_DIRECTIVE_CONTEXT` | unit | B3 | — |
| T4 | same | `MIG-B9-30: @xs { }, @md (hover) { } and @md; are UXD_BREAKPOINT_BLOCK, located; @md inside @keyframes is UXD_BREAKPOINT_CONTEXT` | unit | B1, B4 | — |
| T5 | `test/language.test.js` | completions list the default breakpoint at-rules | unit | B5 | — |
| T6 | `test/diagnostics-catalog.test.js` | the code is catalogued and asserted | unit | B6 | — |
| T7 | `fixtures/playground-browser/walk.js` | SideNav at 1023 (burger) and 1024 (sidebar); not-found at 767 (one column) and 768 (two) — the walk's widths include all four | Chrome | B7 | the `overflow` and `unresolved-var` controls |
| T8 | `fixtures/playground-browser/compare.js` | the only visual differences are not-found between 600 and 767 px, declared | Chrome | B7 | — |
| T9 | `fixtures/release-1.0/run.js` | `S-4 | a breakpoint block with a directive compiles from the tarball through the CLI` (new) | tarball | B2 | — |
| T10 | `scripts/doc-examples.test.js` | the README example compiles | docs | B8 | — |
`````

`````markdown
## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/breakpoint-blocks.test.js` exits 0.
- **AC2** `grep -c "@media" packages/playground-nextjs/src --include='*.uxdsl' -r`
  prints 0 for every file (no hand-written media query is left in the
  playground's sources).
- **AC3** `npm run verify:playground-browser` exits 0; the compare report lists
  only the declared not-found difference.
- **AC4** `node scripts/generate-language-artifacts.js --check` exits 0 after
  `npm run generate:language`; the VS Code grammar highlights `@lg` (the
  fixture `fixtures/vscode-extension/run.js` asserts the grammar contains the
  at-rule alternation).
- **AC5** `npm test` exits 0; `npm run verify:1.0` exits 0 with `S-4 ok`.
`````

`````markdown
## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes |
| `AGENTS.md` + agent guide | yes ("Breakpoints": the block form; the directive-from-a-breakpoint rule; the `.css` asymmetry) |
| CHANGELOG | yes (`### Added`; `### Visual changes` for the playground is the playground's, not the package's) |
| `migration.md` | yes (one line: replace hand-written `min-width` media queries that match a breakpoint) |
| package README | yes ("Breakpoints (source of truth)": the block form) |
| `DIAGNOSTIC_CATALOG` | yes |
| `npm run generate:capabilities` | yes (a new language capability must have a live example: SideNav) |
| playground `uxdsl:build` + captures | yes |
`````

`````markdown
## 12. Verification

```bash
node --test packages/uxdsl/test/breakpoint-blocks.test.js   # exit 0
npm run generate:language && node scripts/generate-language-artifacts.js --check   # exit 0
npm --prefix packages/playground-nextjs run uxdsl:build       # exit 0
npm run verify:playground-browser                             # background; exit 0 (Chrome)
npm test                                                      # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                  # background; exit 0
```
`````

### Stale lines corrected when the story started (2026-11-16)

The scout re-ran §3 and §4 on BASE `6b8e3a9` (the merge of PR #102), with
Node 20.19.0, Dart Sass 1.107.0 and PostCSS 8.5.31. The three preconditions
hold (SideNav.uxdsl has two `@media` lines, 113 a comment and 116 the rule;
not-found.uxdsl has one, line 61; `UNSPLITTABLE_AT_RULES` is at plugin.ts:76).
These lines were stale and were corrected in place:

- §2. Old: "Verified with Dart Sass 1.94.2 (2026-10-11): `.nav { lg { display: flex } }`
  compiles to the **descendant selector** `.nav lg` (so the plan's `lg { … }`
  cannot be the syntax); `.nav { @lg { display: flex; @ds-surface(flat); } }`
  compiles to `@lg { .nav { display: flex; @ds-surface (flat); } }` (Sass
  bubbles an unknown at-rule like `@media`); nested rules and `&:hover`
  inside `@lg` bubble correctly; `@lg` inside `@media print` nests; a mixin
  containing `@lg` works." New: "Verified with Dart Sass 1.107.0
  (2026-11-16, `packages/uxdsl/node_modules/sass`): `@media (--lg)` is kept
  as written; a nested `@media (--lg)` bubbles out of a rule, through a
  mixin's `@content`, through `&:hover` and nested rules;
  `@media print { .a { @media (--lg) {} } }` merges to `print and (--lg)`;
  inside `@supports` it stays nested in the `@supports` (the rule moves
  inside); `@media not print { … @media (--lg) … }` stays nested." The
  repository's Sass is 1.107.0, and the facts were re-run for the decided
  syntax.
- §2. Old: "a directive nested inside `@media` under its rule is
  `UXD_DIRECTIVE_CONTEXT`, while a rule nested inside a top-level `@media`
  with its own directive compiles (`directives-leftover.test.js`)." New:
  "with the plugin alone a directive nested inside `@media` under its rule is
  `UXD_DIRECTIVE_CONTEXT` (`directives-leftover.test.js:32`); through
  `compile()` Dart Sass bubbles the `@media` and the directive compiles
  (MIG-B9-10 D10, `test/core/protect.cases.js:79`), which SideNav.uxdsl
  relies on today. A rule nested inside a top-level `@media` with its own
  directive compiles on both paths (`directives-leftover.test.js:82`)."
  MIG-B9-10 and 13 made the `compile()` path bubble.
- §4. Old: "Recorded: the output contains a literal `@lg { … }` block (passed through,
  dropped by browsers) — or, if the plugin rejects it, the error. Record which."
  New: "Recorded on `6b8e3a9`: passed through with no error and no warning,
  `.nav {\n  color: red;\n}\n@lg {\n  .nav {\n    display: flex;\n    padding: var(--uxdsl__surface__flat-padding); … box-shadow: var(--uxdsl__surface__flat-shadow);\n  }\n}`
  (the directive expanded inside the unknown at-rule). The decided syntax's
  baseline is recorded the same way: every `@media (--…)` form passes
  through as written on both paths, with no diagnostic (`(--lg)`, `(--LG)`,
  `(--nope)`, `(--xs)`, `screen and (--lg), print`, a project
  `@custom-media --lg`), except a directive inside a nested `@media` under a
  rule with the plugin alone (`UXD_DIRECTIVE_CONTEXT` at `x.css:1:51`)."
- §15, review of 2026-10-11. Old: "with the plugin alone the at-rule branch
  (plugin.ts ~555-569) inserts the clone at the root without its selector".
  New: "with the plugin alone the non-rule branch of the responsive
  expansion (plugin.ts:918-935 on `6b8e3a9`) inserts the clone at the root
  without its selector (reproduced with a literal nested `@media`)".
  plugin.ts grew to 1169 lines.
- §15, review of 2026-10-11. Old: "Breakpoint names are only checked
  against `^[a-z][a-z0-9-]*$` (theme-validate.ts:68)". New: "… against
  `THEME_NAME_PATTERN` `^[a-z][a-z0-9-]*$` (theme-validate.ts:72)". The
  finding no longer applies under DEC-07.
- §15, review of 2026-10-11. Old: "Cascade against `lg()`: the media query
  from `lg()` is inserted right after its rule and the block Sass moves out
  lands after it, so the block wins whatever the source order. Pin it with a
  test." New: "Cascade against `lg()` (re-measured on Dart Sass 1.107.0):
  through `compile()` source order decides, because Sass emits declarations
  written after a nested `@media` in a new rule after the block and `lg()`'s
  `@media` is inserted right after that rule; with the plugin alone the
  block stays nested in its rule and `lg()`'s `@media` is inserted after the
  rule, so `lg()` wins whatever the source order. Pin both with a test."
- §8 T9 and §9 AC5 (rewritten with the contract). Old: "`S-4 | a breakpoint
  block with a directive compiles from the tarball through the CLI`" and
  "with `S-4 ok`". New: S-8. S-4 is MIG-B9-14's (`fixtures/release-1.0/run.js:1057`,
  `verdicts.test.js:71`); S-1 to S-7 are taken.
- §10 (rewritten with the contract). Old: "`npm run generate:capabilities` |
  yes (a new language capability must have a live example: SideNav)". New:
  the matrix is derived from `LANGUAGE_COMPLETIONS.directives`/`.functions`
  (`scripts/lib/capabilities.js:188-194`) and sees a media-prelude form only
  through a new kind, and the dogfooding measure `handWrittenMediaQueries`
  (`capabilities.js:265`) drops from 2 to 1, so
  `capability-evidence.json`'s baseline is lowered in the same change
  (`scripts/capability-matrix.test.js:74`). Neither file was in Owns or
  Shares; both are now in Shares.
- The review of 2026-10-11's at-rule findings (name collisions, declarations
  at the top of a block, a second directive set inside a block, stylelint's
  `at-rule-no-unknown`) no longer apply, as the owner decided on 2026-10-23;
  its cascade test against `lg()` remains (T11).

### Owner flags of 2026-11-16, under the standing instruction

The design raised five flags on BASE `6b8e3a9`. Each was answered with its
recommended option under the owner's standing instruction of 2026-11-10
("fusiona todo.. y preguntas como recomendadas, y sgeuimos"), reaffirmed on
2026-11-13 ("haz todo como recomendado"). These are owner decisions taken
that way, and the owner may override them. Each is written into the
rewritten contract above.

1. **F1: a responsive value in a nested block, plugin alone.** With
   `uxdsl/postcss` alone, a responsive value directly in an at-rule nested
   in a rule prints broken CSS (a selector-less clone at the root), literal
   `@media` included, and every `@media (--lg)` block nested in a rule now
   invites it.
   - (a) `UXD_BREAKPOINT_CONTEXT` for every such at-rule, literal or
     `(--bp)`: changes outputs with no `(--name)`.
   - (b) The error only when an enclosing `@media` was rewritten from
     `(--bp)`; literal inputs keep BASE's bytes, recorded as a follow-up.
   - (c) Leave it and file a follow-up.
   - (d) Fix the emission to nest clones: changes literal outputs.
   - **Taken: (b).** Nothing is silent for the new syntax, and every output
     without `(--name)` in an `@media` prelude stays byte-identical. B3, T12.
2. **F2: which unknown `(--name)` is an error, and when.** The plugin alone
   sees one file, and chain plugins (`postcss-custom-media`,
   `postcss-preset-env`) remove definitions in their `Once`.
   - (a) Every `(--name)` that is neither a theme breakpoint nor a top-level
     `@custom-media` is `UXD_BREAKPOINT_UNKNOWN`, judged at `OnceExit` so
     another plugin may resolve it first.
   - (b) The same, judged in `Once`: breaks `[postcss-preset-env, uxdsl]` on
     valid in-file custom media.
   - (c) Only names within edit distance of a breakpoint.
   - (d) (a) plus an option listing external names.
   - **Taken: (a).** DEC-07's text, nothing silent, and chain-safe
     (measured with `postcss-custom-media` 11.0.6 in the design's scratch
     run). (d) can be added later without breaking anyone. B5, T6, T9.
3. **F3: the base breakpoint in a prelude, `(--xs)`.**
   - (a) `UXD_BREAKPOINT_CONTEXT` with the form to write.
   - (b) `(min-width: 0px)`.
   - (c) Drop the feature.
   - **Taken: (a).** `xs()` emits no query, (b) is a second spelling, and
     (c) breaks `print and (--xs)`; the pre-amendment contract had the same
     rule for `@xs`. B6, T7.
4. **F4: `(--<bp>)` outside an `@media` prelude** (an `@import` media list,
   `@container`, a `@custom-media`'s own query).
   - (a) Leave it as written (dead CSS), documented, with the `@import` case
     recorded as a follow-up.
   - (b) `UXD_BREAKPOINT_CONTEXT`: changes outputs whose `@media` preludes
     hold no `--`.
   - (c) Also rewrite `@import`/`@custom-media` media lists.
   - **Taken: (a).** DEC-07 names the `@media` prelude, and the
     byte-identity rule forbids (b) without the owner. A breakpoint name
     outside parentheses inside an `@media` prelude is still an error. B6,
     T1, T7.
5. **F5: AC3's "no visual difference"** against the live block-form demo
   and "write / get" example on `/docs/breakpoints` (and the example text on
   `/docs/language`) that §10, §11 and the capability matrix require.
   - (a) AC3 reads "no visual difference except the declared docs
     additions"; SideNav and every other route unchanged.
   - (b) No demo, so the capability rows for `sm`, `md` and `xl` have no
     live evidence (matrix gaps).
   - **Taken: (a).** The owner's decision is about SideNav (no visual change
     at 1024); the docs addition is the live example the story already
     requires. AC3.

### Implementation, engine half (I1, 2026-11-16)

Failing first, then green, on the branch with Node 20.19.0. "Red" is the
new test run against the built package of the previous commit (BASE
`6b8e3a9` for the first); "green" is the same run after the change, then
`npm test` from the repository root under `scripts/tmpdir-guard.js`
(`TMPDIR` in the run's scratch directory, left empty).

- **Theme names in an `@media` prelude** (`rewriteBreakpointMedia`, the
  base, `@keyframes`, a bare name; T1 to T5, T7's first half, T10, T13,
  T15, T17). Red on BASE: `node --test test/breakpoint-blocks.test.js
  test/compiler-structure.test.js` failed 9 of 12; T1's first case gave
  `'@media (--md) { .a { color: red } }'` for
  `'@media (min-width: 768px) { .a { color: red } }'`, T3 kept
  `@media (--lg) {` around the expanded flat role, and the pinned `runSteps`
  list lacked `rewriteBreakpointMedia`. T17 against BASE's harness found no
  example (`[]` for `[2, 6]`). Green: 12 of 12 and T17; one test
  correction before green: T7's "a theme whose zero-width breakpoint is
  `base`" cannot be built, because the base theme's own values use `xs()`
  as their base (`UXD_TYPO_BASE`, `UXD_DENSITY_BASE`, `UXD_EDGE_BASE`), so
  it asserts `(--XS)` instead. `npm test` exit 0 (5:03); the Bootstrap
  corpus 276,926 bytes, `byte-identical: true`, 21 warnings (14:58, load
  4.90); `fixtures/parity/run.js` PASS without `--update`.
- **A project `@custom-media`** (shadowing and substitution,
  `UXD_BREAKPOINT_SHADOWED`, the nested definition and the typed query;
  T8, T7's second half, T16). Red on the previous commit: 2 of 10 failed;
  T8's first assertion got `@media (min-width: 1024px)` where the project's
  `@custom-media --lg (min-width: 900px)` asks for 900px, with no warning,
  and T7's nested definition compiled (`null` error). Green: 10 of 10, after
  one expectation corrected to the bytes the plugin alone already printed
  for `lg()` on BASE (`@media (min-width: 1024px){`, no space before the
  brace). `diagnostics-catalog.test.js` sees the new code asserted by T8.
  `npm test` exit 0 (5:07); corpus 276,926 bytes, `byte-identical: true`,
  21 warnings (15:06, load 4.50); parity PASS.
- **Unknown names, judged at `OnceExit`** (`UXD_BREAKPOINT_UNKNOWN` with
  the usable breakpoints and a suggestion; T6, T9, T17's control). Red on
  the previous commit: 2 of 12 failed, both because `(--lgg)` and an
  undefined `(--narrow)` compiled (`null` error), and T17's control found
  `(--lgg)` compiling. Green: 12 of 12, after recording the measured
  `compile()` position: the Sass stage's map gives the `@media` rule's line
  and column (`x.uxdsl:2:1`), while the plugin alone points at the token
  (`x.css:2:8`). The function form's pins (`breakpoint-unknown.test.js`,
  `near-miss-functions.test.js`, `sass-stage-diagnostics.test.js`) pass
  unchanged. `npm test` exit 0 (5:13); corpus 276,926 bytes,
  `byte-identical: true`, 21 warnings (15:13, load 5.80); parity PASS.
- **Owner flag F1, the cascade and the work pins** (T12, T11, T14). Red on
  the previous commit: T12 failed, the plugin alone compiling a responsive
  value in a nested `@media (--lg)` (`null` error) into the selector-less
  root clone. T11 and T14 pin behavior the change must keep, so they pass
  on the previous commit as well: T11's four outputs equal the literal
  query's, and T14's fifty literal blocks parse no value and compile as
  written, while one `(--lg)` changes exactly that prelude and parses no
  value either. Green: T12 at `x.css:4:5` (the declaration), with
  `compile()` giving valid nested media and the literal nested form its
  BASE bytes. `npm test` exit 0 (5:14); corpus 276,926 bytes,
  `byte-identical: true`, 21 warnings (15:21, load 9.08); parity PASS.
- **`UXD_DIRECTIVE_CONTEXT` reworded** (T5's message; the capture). Red on
  the previous commit: T5 got `Directives apply to a whole rule and are not
  responsive; …`. Green with the message of §7, the catalog's meaning and
  fix of decision Q15; `node packages/playground-nextjs/scripts/capture-capabilities.js`
  rewrote one line of `src/generated/compiler-captures.json` (the case's
  stderr; its source is unchanged), and `--check` then exits 0. `npm test`
  exit 0 (5:14).

**Measurements of the engine half (2026-11-16).** BASE is a build of
`6b8e3a9`'s `packages/uxdsl` in the run's scratch directory (`git archive`,
the worktree's `node_modules`, `tsc`).

- `node fixtures/sass-corpus/run.js --no-timing-budget`, alternating BASE
  and the branch (`--uxdsl`), twice each: BASE 1.30x (15:30:05, load 6.46)
  and 1.31x (15:30:18, load 7.58); branch 1.32x (15:30:13, load 6.58) and
  1.32x (15:30:24, load 7.53). Every run 276,926 bytes,
  `byte-identical: true`, 21 warnings.
- `uxdsl/postcss` alone on Bootstrap 5.3.8's compiled CSS (280,308 bytes,
  no `--` in any `@media` prelude), 15 warm runs each, alternated: BASE
  45.19 ms and 44.90 ms, branch 44.66 ms and 44.71 ms (medians; 15:30:41,
  load 7.08); outputs identical. The traversal `validateOptions` already
  made collects the at-rules, so no walk was added.
- `node fixtures/mig-b9-23-compile-budget/run.js --base <BASE build>`,
  last and alone (15:30:51, load 6.75): exit 0, "All checks ok"; the
  corpus equals BASE's css, map, dependencies and warnings in the three
  `sourceMap` modes (276,926 bytes, 87 dependencies, 21 warnings), and the
  large-directory check moved -1.2 ms.
- `fixtures/parity/run.js` PASS (10 cases) without `--update` at every
  commit; `$TMPDIR` empty after every run.

**Left for the second implementer and the closure.** T18 to T23
(completions, grammar, capability matrix, S-8, the playground walk), the
playground and documentation changes of decisions Q16, Q17/Q19 and the
chain caveat in AGENTS.md (whose test, T9, is in place), and the CHANGELOG
subsection's last lines (no package visual change).

### Implementation, playground, metadata and documentation half (I2, 2026-11-16)

On the branch after I1's `38cdf88`, with Node 20.19.0 and npm 11.21.1,
`TMPDIR` in the run's scratch directory (left empty after every run). Each
commit was preceded by `npm --prefix packages/uxdsl run build`, `npm test`
(root, under `scripts/tmpdir-guard.js`), `npm run verify:doc-examples`,
`node scripts/generate-language-artifacts.js --check`,
`node scripts/generate-agent-guide.js --check`, `node fixtures/parity/run.js`
(never `--update`; PASS, 10 cases),
`node packages/playground-nextjs/scripts/capture-capabilities.js --check` and
`node --test fixtures/release-1.0/verdicts.test.js`, all exit 0; the
pre-commit hook (`verify:docs` and the playground's `next build`) passed each
time.

| Commit | What | `npm test` |
| --- | --- | --- |
| `4faa22b` | The playground: SideNav's `@media (--lg)` (comment rewritten), the `/docs/breakpoints` chips demo and "write / get" example, `/docs/language`, `/docs/surfaces` and `/docs/introduction` wording, the dogfooding baseline 2 → 1 | 1697 pass, 0 fail |
| `c7f39e8` | `LANGUAGE_COMPLETIONS.customMedia`, the grammar's `breakpointMedia` and injections, the `custom-media` capability kind; `uxdsl-vscode`'s README | 1701 pass, 0 fail |
| `0c2e5cf` | S-8 in the release gate, with its verdicts | 1703 pass, 0 fail |
| `c5a42ac` | AGENTS.md (and the agent guide), README, `migration.md`, CHANGELOG | 1703 pass, 0 fail |

Failing first, then green:

- **T18** (`test/language.test.js`). Red on `38cdf88`'s build:
  `TypeError: LANGUAGE_COMPLETIONS.customMedia is not iterable`. Green after
  `customMedia` in `src/language.ts`, derived from `DEFAULT_BREAKPOINTS`
  without the zero-width base.
- **T19** (`packages/uxdsl-vscode/test/grammar.test.js`, two tests). Red: the
  positive test failed on the committed grammar (no breakpoint scope); the
  negative control passed before and after, as a control must. Green after
  `npm run generate:language`. A source.css stand-in in the test emits VS
  Code's scope names; the same lines were also tokenized against VS Code's
  real `css.tmLanguage.json` (the design's scratch copy): `(--lg)` gets
  `support.constant.breakpoint.uxdsl` in a top-level `@media` header and in a
  nested `@media` (where the real CSS grammar reads `media` as a property
  name), and `var(--lg)`, `--lg: 1px`, `@container (--lg)`, `(--lgg)` and
  `(--xs)` get none. The design's top-level `#breakpointMedia` include was
  left out (see deviations below).
- **T20** (`fixtures/vscode-extension/run.js`). Red: the assertion on the
  committed grammar threw `Cannot read properties of undefined (reading
  'patterns')`. Green: `npm run verify:vscode-extension` PASS.
- **T21** (`scripts/capability-matrix.test.js`). Red: the per-kind count
  (`0 !== 4`) and the new MIG-B9-30 test failed. Green after the
  `custom-media` kind and `npm run generate:capabilities` (124 capabilities,
  0 gaps; `--lg` live in SideNav and `/docs/breakpoints`, the others in
  `/docs/breakpoints`). The dogfooding ratchet failed on commit 1 until
  `handWrittenMediaQueries` went to 1 (it measured 1 against a baseline of 2).
- **T22** (S-8). Red: `verdicts.test.js`'s two new tests failed while
  `run.js` exported no S-8 sources or verdicts. Two test corrections before
  green: the "no `(--` left" check reads `@media` preludes only (the theme's
  `var(--…)` holds `(--`), and the pass-through control replaces the rule's
  query, not the theme's first `@media (min-width: 1024px)`. Green:
  `verdicts.test.js` 16 pass; `npm run verify:1.0 -- --skip-playground-walk`
  exit 0, 73/73, `S-8 ok`.
- **The playground's compiled examples.**
  `node packages/playground-nextjs/scripts/capture-examples.js --check` failed
  (stale) after the new `breakpoint-blocks` example was added and passed once
  `examples.json` was regenerated; its output shows `(min-width: 800px)` for
  the theme's `md: 800`, both nested and in `print and (--md)`.

**The playground CSS** (`npm --prefix packages/playground-nextjs run
uxdsl:build`). `uxdsl.css`'s diff is SideNav's rewritten comment (its
`@media (min-width: 1024px)` block is byte-identical) plus the
`/docs/breakpoints` demo's rules (`.bp-blocks`, `.bp-chip`, and one
`@media (min-width: 480px | 768px | 1024px | 1280px)` per chip): 71 lines
added, 3 removed.

**AC2.** `grep -rnE "@media[^{]*\(\s*min-width" packages/playground-nextjs/src --include='*.uxdsl'`
prints exactly `packages/playground-nextjs/src/app/not-found.uxdsl:61:@media (min-width: 600px) {`;
`grep -q "(--lg)" …/SideNav.uxdsl` exits 0.

**AC3 / T23** (Chrome 157 at the macOS default path). `snapshot.js
--no-interactions` of BASE's playground sources (checked out from `6b8e3a9`
into the worktree for the build, then restored; `git status` clean after),
twice, and of the branch with `--build`: 19 routes × 10 widths. BASE against
itself: 0 property differences over 142,960 records. BASE against the branch,
`--noise` the second BASE snapshot: 9,985 differences, all on
`/docs/breakpoints` (5,328: the new section, and the layout that follows it),
`/docs/language` (3,635), `/docs/surfaces` (647) and `/docs/introduction`
(355), whose text changed, and `/docs/diagnostics` (20: the code block that
shows I1's reworded `UXD_DIRECTIVE_CONTEXT` capture is wider). No
difference on any other route, none in the header (`body>div:1`) or the
SideNav column (`body>div:2>div:1`) of any route at any width, 1023 and 1024
included. In the branch's snapshot the four chips take the contained
primary background at exactly 480, 768, 1024 and 1280 px and not at 479,
767, 1023 and 1279. `snapshot.js`'s interactions (the Density edit dialog)
time out on BASE as on the branch (`TimeoutError`, the button is not
visible), so the snapshots were taken with `--no-interactions`; the walk
below presses through the pages itself. `npm run verify:playground-browser`
(16:35–16:39, load 4.42): exit 0, 19 routes × 2 schemes × 10 widths, no
console error, no UXDSL warning, no unresolved `var()`, visible keyboard
focus, contrast page = Node; its six negative controls each reported.

**Measurements, final (2026-11-16).** `node fixtures/sass-corpus/run.js
--no-timing-budget`, alternating BASE (I1's build of `6b8e3a9`, `--uxdsl`)
and the branch: BASE 1.31x (16:39:27, load 3.68) and 1.34x (16:39:38, load
3.97); branch 1.40x (16:39:32, load 3.79) and 1.29x (16:39:43, load 3.89).
Every run 276,926 bytes, `byte-identical: true`, 21 warnings. The second
half changes no engine code: the spread is the machine's. Then, last and
alone, `node fixtures/mig-b9-23-compile-budget/run.js --base <BASE build>`
(16:39:56, load 3.67): exit 0, "All checks ok"; the corpus equals BASE's
css, map, dependencies and warnings in the three `sourceMap` modes (276,926
bytes; inline 790,834; 87 dependencies; 21 warnings); the large-directory
check +2.9 ms (its planted control +141.9 ms).

**Criteria and tests.**

| Criterion | Evidence |
| --- | --- |
| AC1 | `node --test packages/uxdsl/test/breakpoint-blocks.test.js` exit 0 (I1's T1–T13), in every `npm test` above |
| AC2 | the grep above |
| AC3 | T23: the compare and the walk above |
| AC4 | T18, T19, T20; `generate-language-artifacts.js --check` exit 0 |
| AC5 | `npm test` exit 0 (1703 pass); `verify:1.0` 73/73 with `S-8 ok` |
| B8 | T18, T19, T20 |
| B10 | T2 (SideNav, I1), T21, T23, the `breakpoint-blocks` example |
| B11 | T17 (I1); 78 documentation examples hold (75 before), the new AGENTS.md css and scss blocks and the README scss block among them |
| Chain order | T9 (I1); documented in AGENTS.md "Breakpoints", the README and `migration.md` |

**Deviations of this half from the design record.**

- The grammar has no top-level `{ include: '#breakpointMedia' }`: source.css
  owns every place an `@media` prelude is written, so the two injections
  cover both, and a top-level pattern would only add a scope to `(--lg)`
  written outside an `@media` (the negative control `@container (--lg)` at
  the top level of a stylesheet would get it with the test's stand-in).
- The nested injection's begin/end rule is named
  `meta.at-rule.media.header.uxdsl` (the design gave no name): a nested
  `@media`, which VS Code's CSS grammar reads as a property name, is now one
  header scope.
- `scripts/generate-capability-matrix.js` gained the kind's title
  (`Breakpoint media queries`): the matrix renders only the kinds it names.
  It was not in the plan's file list.
- `/docs/breakpoints/page.mdx` renders the new `BreakpointBlocks` section
  (one import and one line); it was not in the plan's file list.
- `packages/uxdsl-vscode/README.md` gained a highlighting bullet, because
  `verify:docs` requires a README change with a change to that package.
- The chips use `@ds-surface(outlined primary 1)` below and
  `@ds-surface(contained primary 1)` from each breakpoint, with
  `@ds-typo(code)`; the page's existing `font-family: font(code)` (a
  function UXDSL does not define, printed as written) was not copied.
- This record is the second implementer's, under its own heading, as I1's
  is; §14 (the closure record), the story's status and the FEAT-010 README
  row are left to the delivery, as the role's instructions say.

**Not verified here.**

- Highlighting in a real VS Code with the VSIX installed (release-gate item
  B7-12, the owner's); the tokenization tests use Oniguruma with a stand-in
  and, outside the repository, VS Code's real CSS grammar.
- `@ds-*` directives and breakpoint functions written inside a rule are not
  highlighted in VS Code (the real CSS grammar's property list owns them:
  `@ds-surface` reads as a property name, `xs(` as part of a value). This
  predates the story; a follow-up for MIG-B9-55, which owns completion and
  highlighting inside rules.
- The owner's Press Craftor check of the `migration.md` entry (decision Q18).

**Follow-up findings** (to file at delivery).

1. `(--lg)` in an `@import` media list (`@import url("x.css") (--lg);`) is
   left as written on both paths, a stylesheet no browser loads (owner flag
   F4 (a)).
2. A literal nested `@media` holding a responsive value keeps BASE's broken
   output with `uxdsl/postcss` alone: the clone is printed at the root
   without its selector (owner flag F1 (b); the `(--bp)` form is
   `UXD_BREAKPOINT_CONTEXT`).
3. With `uxdsl/postcss` alone only the file being compiled is seen, so a
   `@custom-media` defined in another file is unknown there (documented).
4. VS Code highlighting of `@ds-*` and `xs()` inside rules, above, for
   MIG-B9-55.
5. `fixtures/playground-browser/snapshot.js`'s interactions time out on
   BASE `6b8e3a9` (the Density card's Edit button is not visible), so a
   snapshot needs `--no-interactions` today.

### Delivery of 2026-11-23

**New facts.**

1. `origin/feat/beta9` moved from `6b8e3a9` to `461116b` (PR #101,
   MIG-B9-28) after the pull request was opened; it was merged as
   `8528a5b`. The only conflict was the CHANGELOG, where both stories had
   put their subsection first under `## 0.5.0-beta.9 — unreleased`; both
   are kept whole. MIG-B9-28's Windows job now runs the package's suites,
   this story's tests included.
2. The walk's `next start` server answers on a fixed port, 3919. With
   another workflow's gate on the machine, the first walk lost its server
   after the 19 light routes (`net::ERR_CONNECTION_REFUSED`); the re-run
   passed, as did the walk inside `verify:1.0`.
3. UX-10 ("reference validation stays near-linear") failed once at load
   8.6–9.5 (x3.18 per doubling) and passed on the re-run (x2.31).
4. The implementer's BASE build in the scratch directory had been emptied
   by the machine's temporary-file cleaner between 2026-11-16 and today
   (directories kept, files gone), so the budget needed a fresh build of
   `6b8e3a9`.
5. B6's "the rule follows the width, not the name" is pinned by T7's
   zero-width `base` theme case (xs at 320px, the default `xs(` values
   written as `base(` so the theme validates): `(--base)` is
   `UXD_BREAKPOINT_CONTEXT` and `(--xs)` compiles to `(min-width: 320px)`.
   The mutant that chooses the base by name fails it.

**Stale or wrong lines corrected at delivery** (old → new):

- §5 B5: "edit-distance threshold for the error. It is located at the
  token. The" → "… It is located at the token with `uxdsl/postcss` alone;
  through `compile()` at the `@media` rule's line and column, mapped
  through the Sass stage (as are the media forms of
  `UXD_BREAKPOINT_CONTEXT`). The" (review CT-3/DE-5; owner flag 1 below).
- §5 "Must stay": "every output whose `@media` preludes hold no
  `(--name)`" → "… hold no `--`" (review DE-2; owner flag 2 below; T14,
  the CHANGELOG and `migration.md` already read so).
- §7: "Only the `(--<name>)` token is replaced
  (`/\(\s*--([A-Za-z0-9_-]+)\s*\)/g`)," → "Only the `(--<name>)` media
  feature is replaced (`/(?<![\w-])\(\s*--([A-Za-z0-9_-]+)\s*\)/g`: a `(`
  that no name character precedes, so `var(--x)`, `env(--x)` and
  `theme(--x)` are not media features)," (review CT-2/RB-1, fixed in
  `8137555`).
- §15's first bullet ("`not-found.uxdsl`'s 600 px threshold moves to `@md`
  (768 px) by default; …") is kept and gains "(Superseded by the owner
  decisions of 2026-10-23: `not-found.uxdsl` keeps its 600px.)" (review
  DE-6).

**AC3's declared differences, route by route** (review CT-4): the compare
differs on five routes and nowhere else: `/docs/breakpoints` (the new
block-form demo and "write / get" example), `/docs/language` (its examples
now use `@media (--md)`), `/docs/surfaces` and `/docs/introduction` (one
phrase each, no longer "a directive is not responsive"), and
`/docs/diagnostics` (the reworded `UXD_DIRECTIVE_CONTEXT` capture is a
wider code block). SideNav, the header and every other route are
unchanged at every width, 1023 and 1024 included.

**Owner flags raised at review and delivery**, answered with the
recommended option under the standing instruction of 2026-11-10 ("fusiona
todo.. y preguntas como recomendadas, y sgeuimos"), reaffirmed on
2026-11-13 ("haz todo como recomendado"); the owner may override them.

1. **Where `UXD_BREAKPOINT_UNKNOWN` is located through `compile()`.** B5
   said "at the token"; through `compile()` it is the `@media` rule's line
   and column (pinned at `x.uxdsl:2:1` by T6 and `src/a.uxdsl:4:1` by
   S-8). (a) Qualify B5 and §7: the token with the plugin alone, the rule
   through `compile()`. (b) Point `compile()` at the token (the Sass map
   gives no token-level positions). (c) Leave B5 and record a finding.
   **Taken: (a).**
2. **The byte-identity line.** §5 promised identical bytes for every
   output whose preludes hold no `(--name)`, false for a bare
   `@media screen and --lg`, now `UXD_BREAKPOINT_CONTEXT` (design Q12).
   (a) Reword to "hold no `--`". (b) Name the exception after the existing
   wording. (c) Drop the bare-name check. **Taken: (a).**
3. **"In that build"** (review CT-5). DEC-07 says a project `@custom-media
   --<bp>` "replaces the theme's `--<bp>` in that build". (a) Read it as
   "in that compilation: the stylesheet and the partials it loads", since a
   custom media is scoped to the CSS it is written in and stylesheets
   compiled apart cannot see it, so in a multi-entry CLI build a definition
   in one entry does not reach the others. (b) Carry a definition across
   every entry of a build (a cross-entry state the CLI, Vite and webpack do
   not have, and that the plugin alone cannot have). **Taken: (a)**, as
   the warning, B4, AGENTS.md and the README already say ("stylesheets
   compiled apart keep the theme's").

**Press Craftor** (read-only, decision D17 of 2026-11-04). A grep of
`/Users/ricardosantoyo/Documents/projects/story-radar` at `2b92723`
(`.env*`, `node_modules`, `.next` and `.git` excluded; nothing modified).
Its theme (`uxdsl.config.js`, read by `uxdsl.theme.config.cjs`) sets
`xs 0, sm 640, md 768, lg 1024, xl 1280`, and it still depends on
`postcss-uxdsl@0.5.0-beta.8`. Its eight `.uxdsl` sources hold ten
hand-written `min-width` queries (the `*.generated.module.css` files and
`src/app/uxdsl.css` are compiler output). Eight equal a theme breakpoint
and could become `@media (--<bp>)` after beta.9:
`draft-2-canvas.module.uxdsl:28` (lg), `:29` (xl), `:52` (lg), `:107`
(sm), `:119` (xl), `:164` (xl), `radar-dashboard.module.uxdsl:3477` (lg)
and `ui/primitives.module.uxdsl:84` (lg). Two are deliberate local
thresholds to keep: `draft-2-canvas.module.uxdsl:196` (960px) and `:257`
(900px). Its thirteen `max-width` queries (`639px`, `767px`, `1023px`,
`1279px`, some with `(pointer: coarse)`) have no block form (§6) and
stay. It holds no `@custom-media`, no `(--name)` and no `var(--x)` in any
`@media` prelude, so nothing in it newly warns or fails, and its outputs
stay byte-identical. The owner patches it after beta.9.

**Follow-ups**, each with a proposed story:

1. `(--lg)` in an `@import` media list is left as written on both paths, a
   stylesheet no browser loads (owner flag F4 (a)). Proposed: a new
   beta.10 story, MIG-B9-66, to make it `UXD_BREAKPOINT_CONTEXT` or
   rewrite it, with the owner's call on byte identity.
2. With `uxdsl/postcss` alone a responsive value in a literal `@media`
   nested in a rule still prints a selector-less clone at the root
   (BASE's bytes, F1 (b)). Proposed: a new beta.10 story, MIG-B9-67.
3. With `uxdsl/postcss` alone only the file being compiled is seen, so a
   `@custom-media` defined in another file is `UXD_BREAKPOINT_UNKNOWN`
   there (documented); F2 (d), an option listing external custom-media
   names, can be added later without breaking anyone. Proposed: MIG-B9-68.
4. Message polish: the F1 message advises `lg(…)` even when a project
   `@custom-media --lg` moved `(--lg)` (where `lg()` keeps the theme's
   query), and `UXD_BREAKPOINT_SHADOWED` names an unwrapped query where a
   compound prelude wraps it (the same condition). Proposed: MIG-B9-68.
5. VS Code: completion of `--<bp>` inside an `@media` prelude, and
   highlighting of `@ds-*` and `xs()` written inside a rule (VS Code's CSS
   property list owns them). MIG-B9-55.
6. `fixtures/playground-browser/snapshot.js`'s interactions time out on
   BASE as on the branch (the Density card's Edit button is not visible),
   so a compare needs `--no-interactions`. MIG-B9-91.
7. The walk's fixed port 3919 is shared by concurrent gate runs on one
   machine (fact 2). MIG-B9-91: a free port or a lock.
8. UX-10's timing under load (fact 3), the known flake. MIG-B9-91.
9. Press Craftor's eight queries above. The owner's patch after beta.9
   (D17; MIG-B9-03's project).
