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
| Shares | `packages/uxdsl/src/plugin.ts`, `packages/uxdsl/src/language.ts` (completions), `packages/uxdsl/src/diagnostics.ts`, `scripts/generate-language-artifacts.js` (the grammar), `fixtures/release-1.0/run.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | new syntax (additive); the playground's two `@media` become breakpoint blocks (one declared visual change) |

## 1. Goal

"The author never writes a media query" becomes literally true. A block of
declarations, nested rules or a directive that applies from a breakpoint up
is written as the breakpoint's name: `.nav { @lg { @ds-surface(flat); } }`.

## 2. Sources

- Vision guardrail 4 (plan): "'Never write a media query' must be literally
  true, or it becomes a trap: close D-2".
- Plan D-2: today's one remaining case is "applying a whole role from a named
  breakpoint (the playground's SideNav keeps `@media (min-width: 1024px)`)";
  option (a) "a breakpoint block nested in a rule".
- Verified with Dart Sass 1.94.2 (2026-10-11): `.nav { lg { display: flex } }`
  compiles to the **descendant selector** `.nav lg` (so the plan's `lg { … }`
  cannot be the syntax); `.nav { @lg { display: flex; @ds-surface(flat); } }`
  compiles to `@lg { .nav { display: flex; @ds-surface (flat); } }` (Sass
  bubbles an unknown at-rule like `@media`); nested rules and `&:hover`
  inside `@lg` bubble correctly; `@lg` inside `@media print` nests; a mixin
  containing `@lg` works.
- `plugin.ts`: the Once order (`emitTheme`, `expandDirectives`,
  `expandResponsive`, `rejectLeftoverDirectives`, `checkReferences`);
  `UNSPLITTABLE_AT_RULES` (`keyframes`, `font-face`, `page`, `counter-style`);
  `UXD_BREAKPOINT_CONTEXT`; a directive nested inside `@media` under its rule
  is `UXD_DIRECTIVE_CONTEXT`, while a rule nested inside a top-level `@media`
  with its own directive compiles (`directives-leftover.test.js`).
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

Recorded: the output contains a literal `@lg { … }` block (passed through,
dropped by browsers) — or, if the plugin rejects it, the error. Record which.

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

## 6. Out of scope

- Responsive directive arguments (`@ds-surface(xs(contained) lg(flat))`):
  plan D-2 option (b), not adopted.
- `max-width` or range blocks (`@md-down`): not in this release.
- Container context: MIG-B9-65 (a note).

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

## 11. Documentation

`packages/uxdsl/README.md`, `AGENTS.md`, `packages/uxdsl/docs/migration.md`,
`packages/uxdsl/CHANGELOG.md`, the playground's `/docs/breakpoints` page
(`BreakpointDocumentation.tsx`: the block form, live).

## 12. Verification

```bash
node --test packages/uxdsl/test/breakpoint-blocks.test.js   # exit 0
npm run generate:language && node scripts/generate-language-artifacts.js --check   # exit 0
npm --prefix packages/playground-nextjs run uxdsl:build       # exit 0
npm run verify:playground-browser                             # background; exit 0 (Chrome)
npm test                                                      # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                  # background; exit 0
```

## 13. Delivery

Branch `feat/b9-30-breakpoint-blocks`. Commit:
`feat(FEAT-010): MIG-B9-30 - breakpoint blocks: @lg { … } means from lg up; the playground's last two media queries removed`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

- Owner's call recorded here: `not-found.uxdsl`'s 600 px threshold moves to
  `@md` (768 px) by default; keeping 600 px would need an allowlisted
  `@media` in MIG-B9-43.

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Name collisions.** Breakpoint names are only checked against `^[a-z][a-z0-9-]*$` (theme-validate.ts:68), so a breakpoint called `page`, `layer`, `container`, `media`, `scope`, `theme`, `uxdsl`, `else` or `content` would turn those at-rules into breakpoint blocks. Reserve them in `validateTheme`.
- Declarations directly in a top-level block (`@lg { color: red }`) pass Sass and become `@media { color: red }`, which browsers drop: make it an error.
- A responsive function inside a block: with the plugin alone the at-rule branch (plugin.ts ~555-569) inserts the clone at the root without its selector; through Sass `md()` ends up applying from lg up. Make it `UXD_BREAKPOINT_CONTEXT`.
- `@ds-button`/`@ds-input` inside a block creates a second set of states on another rule node and bypasses `UXD_DIRECTIVE_DUPLICATE`: define it, preferably as an error.
- Cascade against `lg()`: the media query from `lg()` is inserted right after its rule and the block Sass moves out lands after it, so the block wins whatever the source order. Pin it with a test.
- Value: directives under a nested `@media` already work (MIG-B9-10 D10; SideNav does it today). Consider `@media (--lg)` (CSS custom-media syntax: no name collisions, Sass merges it with outer queries) before adding an at-rule per breakpoint; the playground's stylelint `scss/at-rule-no-unknown` would also need the names. Recommended: defer to beta.10.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-07 changes the syntax.** Rewrite §1 and §5 before implementing: the block form is `@media (--<breakpoint>) { … }`, the CSS custom-media syntax. `(--<bp>)` in an `@media` prelude is replaced with the effective theme's query for `<bp>`, the same one `<bp>()` produces, on both paths (`compile()` after Sass, and the plugin alone). It combines with other conditions (`@media print and (--lg)`); pin Sass's merge of nested media queries with a test.
- **What is written by hand wins.** A literal query (`@media (min-width: 1024px)`) is compiled as written and never rewritten. A project's own `@custom-media --<bp> …` replaces the theme's `--<bp>` in that build, with one warning (the DEC-17 rule). `(--name)` that is neither a theme breakpoint nor a project `@custom-media` is `UXD_BREAKPOINT_UNKNOWN` with a "did you mean".
- Directives inside `@media (--lg)` under a rule work as they do under a nested `@media` today (MIG-B9-10 D10). The playground's SideNav moves from `@media (min-width: 1024px)` to `@media (--lg)`; `not-found.uxdsl` keeps its deliberate local 600px.
- The review's at-rule findings (name collisions, declarations at the top of a block, a second directive set inside a block, stylelint's `at-rule-no-unknown`) no longer apply; the cascade test against `lg()` still does.
