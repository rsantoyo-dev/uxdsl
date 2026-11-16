# MIG-B9-30 — Breakpoint media queries: `@media (--lg)`

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | DEC-07 (decided 2026-10-23, amended: `@media (--<breakpoint>)`, not `@lg { … }`) |
| Status | Ready |
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
  edit-distance threshold for the error. It is located at the token. The
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
`(--name)` (parity oracles are not re-recorded); the theme CSS; the
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
- Only the `(--<name>)` token is replaced (`/\(\s*--([A-Za-z0-9_-]+)\s*\)/g`),
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

To be filled in the delivering PR.

## 15. Findings and follow-ups

- Owner's call recorded here: `not-found.uxdsl`'s 600 px threshold moves to
  `@md` (768 px) by default; keeping 600 px would need an allowlisted
  `@media` in MIG-B9-43.

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
