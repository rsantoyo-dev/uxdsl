# MIG-B9-15 — Documentation of the superset

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided) |
| Status | Merged (PR #72) |
| Size | S |
| Depends on | MIG-B9-14 |
| Blocks | MIG-B9-50, MIG-B9-51 |
| Base | `feat/beta9` after MIG-B9-14 |
| Owns | `packages/uxdsl/docs/integrations/compile.md`, `packages/uxdsl/docs/integrations/{cli,vite,webpack}.md` (the Sass parts), `scripts/lib/doc-examples.js` (the `scss` fence rule) |
| Shares | `packages/uxdsl/README.md`, `AGENTS.md`, `packages/uxdsl/docs/migration.md`, `packages/uxdsl/CHANGELOG.md` |
| Output impact | none |

## 1. Goal

A reader learns in one place that every Sass feature works in a `.uxdsl`
file, how to start from an SCSS project, what UXDSL reserves, and what the
Sass stage reports. Every example compiles through the real pipeline.

## 2. Sources

- Plan §9.6: "'From SCSS' becomes a first-class path in the quick start and
  the README: rename, build, then adopt tokens gradually"; "The language
  reference says plainly: every SCSS feature works; UXDSL adds its words on
  top; the reserved names".
- Vision (plan): "UXDSL is to SCSS what TypeScript is to JavaScript"; the
  positioning always says "inspired by Material UI".
- `packages/uxdsl/docs/integrations/compile.md` has `## The SCSS subset`
  (line 109 on `main`); `AGENTS.md` lines 873–911 (rewritten by MIG-B9-13)
  describe the Sass pipeline and end with "`packages/uxdsl/docs/integrations/compile.md`
  still describes the SCSS subset it replaced." (line 910); the build-config
  keys sentence (lines 686–688) lists no `sass`.
- `scripts/lib/doc-examples.js`: fenced `css`, `scss` and `uxdsl` blocks that
  contain UXDSL syntax are compiled; most through the plugin
  (`postcss([plugin({ theme, includeTheme: false })])`), "a few" through
  `core.compile()` — a Sass example must go through `compile()`.
- The facts to document come from MIG-B9-12 to 14's contracts (importer rules,
  `@import "x.css"`, `pkg:`, reserved names, warnings, `sass` option,
  `@use` entries, the Next.js path).

## 3. Preconditions

```bash
grep -q "^## The SCSS subset" packages/uxdsl/docs/integrations/compile.md
grep -q "still describes the SCSS subset" AGENTS.md
grep -q "core.compile(" scripts/lib/doc-examples.js
```

## 4. Baseline

```bash
npm run verify:doc-examples 2>&1 | tail -3
```

Recorded on `feat/beta9` at `db0e28d`: `52 examples and 24 theme excerpts
checked across 101 documentation files. All documentation examples hold.`
(exit 0).

## 5. Contract

- **D1 — The harness compiles Sass examples.** In `scripts/lib/doc-examples.js`
  a fenced block whose language is `scss`, or whose code contains a Sass-only
  construct (`@use`, `@mixin`, `@include`, `@each`, `$name:`, `&`-nesting,
  `#{`), compiles through `compile({ source, from })`, never through the plugin
  alone; `css` blocks keep the plugin. The error-comment rule
  (`/* UXD_CODE: … */`) applies to `UXD_SASS` examples too.
- **D2 — `compile.md`.** `## The SCSS subset` is replaced by `## Sass inside
  compile()`: the four stages; what Sass handles (everything SCSS); the
  importer rules (extensions, partials, index files, `.uxdsl` before `.scss`,
  ambiguity error, `pkg:`, `node_modules` load paths, no `~`); `@import "x.css"`
  stays a CSS import, `@use "./x"` inlines it; nesting flattened; reserved
  names; errors (`UXD_SASS` with Sass's frame) and warnings
  (`UXD_SASS_WARNING`, the `sass.silenceDeprecations` option); source maps
  point at the author's files. One compiled example with `@use "sass:math"`,
  a map, a mixin and three UXDSL tokens, with its output shown
  (`<!-- doc-example: output -->`).
- **D3 — README "From SCSS".** `packages/uxdsl/README.md` gains, right after
  "Install", a section `## From SCSS: rename and keep building` with three
  steps (rename `.scss` → `.uxdsl`, run `uxdsl build` or add the plugin,
  change one value to a token), the sentence "UXDSL is to SCSS what TypeScript
  is to JavaScript: every SCSS file is a valid UXDSL file", and the two
  limits (a `.module.scss` compiled by a host's own Sass cannot carry dotted
  tokens; `~pkg` imports become `pkg:` or a bare path). The intro paragraph
  says "inspired by Material UI's theme engine" where it positions UXDSL.
- **D4 — Integrations.** `cli.md`: `generate-entry` with `@use` and
  `--first`; the `sass` config key; the Next.js subsection (MIG-B9-14 A8).
  `vite.md`, `webpack.md`: the `sass` option; a `.uxdsl` may `@use` a `.scss`.
- **D5 — `AGENTS.md`.** The SCSS paragraph is rewritten: Sass runs first and
  handles all of SCSS; UXDSL's words are resolved after; the reserved names;
  `$variables` in a `.css` file compiled by the plugin alone are
  `UXD_SASS_CONTEXT`; agents write Sass features freely in `.uxdsl` files and
  never emulate them with UXDSL constructs. The generated agent guide follows.
- **D6 — `migration.md`.** A "beta.9 — Sass inside compile()" section: what
  changes for a project (nesting flattened, `//` comments dropped by Sass,
  `@import` of `.uxdsl` deprecated → `@use`, `@import "x.css"` no longer
  inlined, retired codes and their replacements, the `sass` key).
- **D7 — Diagnostics page.** The playground's `/docs/diagnostics` captures are
  regenerated so `UXD_SASS`, `UXD_SASS_WARNING`, `UXD_SASS_CONTEXT`,
  `UXD_RESERVED_NAME` appear with their meaning and fix.

Must stay byte-identical: compiled outputs (documentation only, plus the
harness rule).

## 6. Out of scope

- The root README rewrite and the audience paragraph: MIG-B9-50.
- The playground's live "From SCSS" demo: MIG-B9-42.
- AGENTS.md's size and structure: MIG-B9-51.

## 7. Approach and traps

- Every example in D2–D4 must compile under the harness after D1; write the
  example, run `npm run verify:doc-examples`, then write the prose.
- An example that shows a `UXD_SASS` error needs a source Sass rejects and the
  comment `/* UXD_SASS: … */` on the statement's line; the harness checks the
  code, not the message.
- Do not write "replaces SCSS" or "no media queries" anywhere (the audit
  retired both claims); write "SCSS plus a design-system engine" and, for
  media queries, what MIG-B9-30 ships when it ships.
- Stop rule: if an example cannot compile because of a pipeline defect, that
  is a finding for MIG-B9-13/14; do not weaken the example.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/doc-examples.test.js` | existing: every example compiles | docs | D1–D4, D6 | a planted invalid Sass example without an error comment fails the run |
| T2 | `scripts/doc-examples.test.js` (new unit) | `MIG-B9-15: a scss fence or a Sass construct routes through compile(), a css fence through the plugin` | unit | D1 | — |
| T3 | `scripts/agent-guide.test.js` + `generate-agent-guide.js --check` | the guide matches AGENTS.md | docs | D5 | — |
| T4 | `scripts/capability-matrix.test.js` | no recorded gap | docs | D7 | — |

## 9. Acceptance criteria

- **AC1** `npm run verify:doc-examples` exits 0 and reports more examples than
  the baseline (the new Sass examples are counted).
- **AC2** `grep -c "replaces SCSS\|no media queries" README.md packages/uxdsl/README.md AGENTS.md`
  prints 0 for each.
- **AC3** `grep -c "inspired by Material UI" packages/uxdsl/README.md` prints
  at least 1 and `grep -ci "is MUI\|Material UI's engine" packages/uxdsl/README.md AGENTS.md`
  prints 0.
- **AC4** `node scripts/generate-agent-guide.js --check` exits 0.
- **AC5** `npm test` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `AGENTS.md` + agent guide | yes |
| CHANGELOG | no (documentation) |
| `migration.md` | yes |
| package README | yes |
| `npm run generate:capabilities` | yes |
| playground captures | yes (diagnostics) |

## 11. Documentation

This story is documentation: the files in §5.

## 12. Verification

```bash
npm run verify:doc-examples                        # exit 0
node scripts/generate-agent-guide.js --check       # exit 0
node --test scripts/doc-examples.test.js scripts/capability-matrix.test.js   # exit 0
npm test                                           # background; exit 0
```

## 13. Delivery

Branch `feat/b9-15-superset-docs`. Commit:
`docs(FEAT-010): MIG-B9-15 - Sass inside compile(): From SCSS, the importer rules, functions named like UXDSL's, warnings; examples compile through compile()`.

## 14. Closure record

Delivered in one PR (#72), from `feat/b9-15-superset-docs`, by the light flow the owner chose for an S story on 2026-11-04 (FEAT-010 §2, D1): one scout, one implementer, one review and the deliverer. Where it differs from §5, §15's blocks rule:
- the review of 2026-10-11 (D1's routing and error marking, D2's opaque tokens, AC2's negative control);
- the owner decisions of 2026-10-23 (DEC-17, DEC-07) and of 2026-11-04 (D6; D7 gives this story no task);
- the stale corrections of 2026-11-08;
- the facts MIG-B9-12, 13 and 14 routed here (their §14 and §15).

The scout's report, the implementer's evidence and the review stay with the run's evidence outside the repository. What they decided is summarized below.

- **Base and merges.**
  - The base is `feat/beta9` at `db0e28d` (MIG-B9-14 merged, PR #71).
  - `git fetch origin`, run before the PR and again before this record, found `origin/feat/beta9` still at `db0e28d`. There is no merge commit.
  - The story commits since the base:
    - by the implementer: `0777ce5` (the harness tests and rule, with the stale corrections), `d6cfb9b` (compile.md) and `06c2c23` (the README, AGENTS.md and the guide, migration.md, cli/vite/webpack, the capture, the introduction page);
    - by the deliverer: `e2d4170` (the review's findings) and this record.
- **Environment.**
  - macOS 27.0 (Darwin 27.0.0, Apple M1 Pro, 8 cores).
  - Node 20.19.0 and npm 11.21.1, CI's versions. Dart Sass 1.107.0 and PostCSS 8.5.31 in the repository. Google Chrome 156.0.8078.80 at the macOS default path.
  - Every command ran with `TMPDIR` set to a scratch directory of the role's own, never the owner's.
  - The scout prepared the worktree as `ci.yml` does, and every step exited 0. `npm run prepare` installed husky's hooks, so the pre-commit hook ran on every commit: the docs guard, then the full playground build. No commit used `--no-verify` or `HUSKY=0`.
  - The owner's dev servers ran throughout and were not touched: story-radar's `next dev` and `uxdsl watch`, and the playground's `next dev` in the owner's checkout, on ports 3000 and 3001. The one-minute load average ranged from 2.5 to 10.5 during the deliverer's runs.
- **Preconditions (§3).** On `db0e28d`, lines 1 and 3 exit 0. Line 2 as first written exited 1, because MIG-B9-13 had rewritten AGENTS.md's paragraph. It was corrected as only stale (§15) and then exited 0. On the head, lines 1 and 2 exit 1, because this story replaced what they pinned; line 3 exits 0.
- **Baseline (§4).** The output matches the corrected recording: `52 examples and 24 theme excerpts checked across 101 documentation files. All documentation examples hold.` (exit 0). `npm test` at the base: 1,524 tests, 1,523 pass, 0 fail, 1 skipped (197 s).
- **Failing test first.** The four harness tests were run against `db0e28d`'s `scripts/lib/doc-examples.js` before the rule was written, and all four failed:
  - test 10, `MIG-B9-15: a scss fence or a Sass construct routes through compile(), a css fence through the plugin`: `fails to compile as shown: UXD_SASS_CONTEXT: @use is Sass; …`, because the base sent the `scss` fence to the plugin;
  - test 11, `MIG-B9-15: a Sass example documents one error, on the line compile() reports, and compiles without that line`: `` `.b { color: darken(palette(primary.main), 10%); }` is documented as UXD_SASS but compiles ``;
  - test 12, `MIG-B9-15: a Sass example's claimed output must appear in the compiled CSS, not only in its own comment`: the same `UXD_SASS_CONTEXT`;
  - test 13, `MIG-B9-15: a planted invalid Sass example without an error comment fails the run (negative control)`: 0 problems where 1 was expected.

  `MIG-B9-15: the READMEs and AGENTS.md make neither retired claim` failed before the README change, with `the package README says where UXDSL comes from`, while its negative control passed.

  The tests are committed together with the rule in `0777ce5`, because every commit must pass `npm test`; the failing runs are in the implementer's logs. The review reproduced the four failures against the base harness in a clone.

  The review's findings are documentation, so no test could fail first for them. Each was reproduced as a script against the worktree's build before its fix.
- **Contract as delivered, where it differs from §5:**
  - **D1.**
    - The fence language decides first (owner flag 2). A `css` fence goes through the plugin alone, whatever it holds, so a plugin-alone `UXD_SASS_CONTEXT` example can be documented. A `scss` fence goes through `compile()` as `docs/doc-example.uxdsl`. Any other fence goes through `compile()` when it holds a Sass-only construct.
    - A `compile()`-routed example documents at most one error, on a line that ends with a `/* UXD_… */` comment. It must fail with that code (the error's `code`, else the first code in its message), at that line, and must compile without that line.
    - Beyond §5, its `var(--…)` claims are checked against the CSS with comments removed. The harness header and AGENTS.md state the rule.
  - **D2.**
    - **Importer rules.** No ".uxdsl before .scss" precedence exists, which matches the rule MIG-B9-12 delivered: two Sass files of one directory that answer one URL are Sass's ambiguity error. A candidate beside the importing file beats a load path, and `SASS_PATH` is searched after the `node_modules` load paths. Load paths are joined as review R1 corrected it. The page also covers the `pkg:` exception and the absence of `~`.
    - **What the extension decides.** As review R6 corrected it.
    - **Sass's import rules**, and Dart Sass's output, including `calc()` inside `min()`/`max()`/`clamp()`.
    - **Tokens are opaque strings to Sass**, with the alternatives (the review of 2026-10-11).
    - **Functions named like UXDSL's**, in place of reserved names (DEC-17), with the recorded differences: SH-4, RR-1 and the `uxdsl-probe-` prefix.
    - **A kept `$variable`**, with the `\$` escape's caveat (D6).
    - Non-CSS text, errors and warnings, and the plugin used alone.
    - There is no media-query section (DEC-07).
  - **D3.**
    - The sentence is unqualified (DEC-17, owner flag 1).
    - Step 2 builds with the CLI, `uxdsl/vite` or `uxdsl/webpack`, never with `uxdsl/postcss` alone (DEC-05).
    - The first limit reads "dotted tokens, `color()` tokens or directives" (review R2).
    - Links to compile.md are absolute GitHub URLs, because the tarball's `docs/` holds only the agent guide.
  - **D4.** MIG-B9-14 had delivered `generate-entry` with `@use` and `--first`, the `sass` key and the Next.js section. This story adds:
    - the entry's extension rule;
    - `color(white)` and directives in the Next.js sentence;
    - the `@use` of a `.scss` file, in vite.md and webpack.md;
    - vite.md's "No SCSS pre-pass", rewritten as "Dart Sass runs inside `compile()`";
    - webpack.md's rule that the loader goes on `.uxdsl` files.
  - **D5.** MIG-B9-13 had rewritten the paragraph. This story:
    - replaces its pointer to the subset;
    - adds the opaque-token rule, the `\$` escape and the parser-first forms;
    - adds `sass` to the config keys;
    - adds the D1 rule to "What an example may rely on", narrowed to what the harness checks (review R5);
    - adds "besides the recorded differences" to "three exceptions" (review R3).
  - **D6.** MIG-B9-13 and 14 had written items 1 to 12. This story adds:
    - item 13, the six retired codes and what reports each now;
    - in item 1, `//` comments and `calc()`;
    - the link to compile.md.
  - **D7.** `UXD_FUNCTION_SHADOWED` replaces `UXD_RESERVED_NAME`, which does not exist (DEC-17). `/docs/diagnostics` already rendered the catalog's meaning and fix for the four codes, and already had captures for three of them. This story adds the `UXD_SASS_WARNING` capture: `@import './card';`, `[import]` at `src/example.uxdsl:1:9`, exit 0.
- **Tests and counts.**
  - `scripts/doc-examples.test.js` goes from 13 tests to 19. The six new ones are tests 10 to 13, the claims test and its negative control. The surfaces test gains a floor of 5 examples for compile.md.
  - `npm test` goes from 1,524 tests to 1,530.
  - Doc examples go from 52 to 62. Routes go from plugin 48 and `compile()` 4 to plugin 49 and `compile()` 13. The new examples:
    - compile.md: 8. Seven are `scss` examples that `compile()` compiles; four of those document one error each, `UXD_SASS` three times and `UXD_SASS_CONTEXT` once. The eighth is a `css` example the plugin compiles, documenting three `UXD_SASS_CONTEXT`s.
    - the package README: 1.
    - AGENTS.md: 1, documenting `UXD_SASS`.
  - The D2, From SCSS and `@function space` outputs are shown under `<!-- doc-example: output -->`. The review compared them with `compile()`'s output byte for byte.
  - Diagnostics captures go from 23 to 24. The capability matrix is unchanged: `npm run generate:capabilities` gives no diff.
  - Criteria to tests:
    - D1 and T2 map to tests 10 to 12, and T1's negative control to test 13.
    - D2 to D4 and D6 map to `every UXDSL example in the documentation compiles as shown, or fails with the error it documents`, plus the compile.md floor.
    - D5, T3 and AC4 map to `generate-agent-guide.js --check` and `scripts/agent-guide.test.js`.
    - D7 and T4 map to `capture-capabilities.js --check` and `scripts/capability-matrix.test.js`.
    - AC2 and AC3 map to `MIG-B9-15: the READMEs and AGENTS.md make neither retired claim` and its negative control.
    - AC1 and AC5 map to the commands below.
- **The review and its outcome.** One review read `06c2c23` and raised eight findings: R1 blocking, R2 to R5 should-fix, R6 to R8 nits. The deliverer reproduced each one against the worktree's build before fixing it. Every fix is documentation, in `e2d4170`:
  - **R1, fixed.** compile.md said a `../x` that misses beside its file "is never a same-named file in another directory". That is false through a load path that exists: `<root>/node_modules/../x` is `<root>/x`.
    - Reproduction: with `proj/node_modules/` present and `proj/src/_x.uxdsl` absent, `proj/src/components/card.uxdsl`'s `@use '../x'` loads `proj/_x.uxdsl`, and plain Dart Sass with the same load paths does the same. A control with no `node_modules` gives `Can't find stylesheet to import.`
    - The fix corrects compile.md's "Where" bullet and the package README's pipeline paragraph.
    - The same claim remains in MIG-B9-12's CHANGELOG entry: §15, follow-ups.
  - **R2, fixed.** A host's own Dart Sass passes `space(2)`, `palette(primary)`, `radius(2)` and `xs(space(2)) md(space(4))` through, and `uxdsl/postcss` then resolves them.
    - It stops at `palette(primary.main)` (`expected "(".`) and `color(white)`.
    - It writes the four directives as `@ds-x (…)`, which the plugin refuses with `UXD_SURFACE_ARGUMENT`, `UXD_BUTTON_ARGUMENT`, `UXD_INPUT_ARGUMENT` and `UXD_TYPO_ARGUMENT`.
    - The README's first limit and cli.md's Next.js sentence now say exactly that.
  - **R3, fixed.** compile.md's "Three things differ from plain Dart Sass" now sets the recorded differences apart. Both reproduce silently:
    - SH-4 gives `var(--uxdsl__space__2)` where Dart Sass gives `6px`;
    - a project `uxdsl-probe-pick` gives `v: 1` twice where Dart Sass gives `space(2)` and `6px`.

    The README's pointer and AGENTS.md's "three exceptions" now name these differences too.
  - **R4, fixed.** `compile()`, like plain Dart Sass, moves `@import "x.css"` written after `.first` above it, and above an earlier `@layer base;`. compile.md no longer says "Nothing you wrote is reordered", and neither does the README's placement paragraph, which made the same claim. The plugin used alone leaves such an `@import` where it is.
  - **R5, fixed in the documentation.** A false top-level claim in an unmarked `css` block, or one inside a rule, returns no problem. AGENTS.md's rule now says where the harness checks a claim. Checking claims in every `css` example is a follow-up (§15).
  - **R6, fixed.** compile.md's extension rule now says what each kind of UXDSL syntax does in each extension:
    - in a `.scss` or `.sass` file, `space(10-2)` becomes `space(8)` (a `.uxdsl` file gives `UXD_SPACE_REFERENCE`), and `$t` in `@ds-surface(contained $t)` is `UXD_SASS_CONTEXT`;
    - in a `.css` file, `space(10-2)` is `Operators aren't allowed in plain CSS.`, and `color(white)` compiles.
  - **R7, owner flag 1.** No change.
  - **R8, done.** This record and §15's "Delivery of 2026-11-08".
- **Final verification, on `e2d4170`, by the deliverer.** These commands ran one after another on 2026-11-08, each with its log. `e2d4170` is the head before this record. The record's own commit changes only `docs/features/FEAT-010`, which no test, doc example or guard reads.

  | Command | Exit | Result |
  | --- | --- | --- |
  | AC1 `npm run verify:doc-examples` | 0 | `62 examples and 24 theme excerpts checked across 101 documentation files. All documentation examples hold.` |
  | AC4 `node scripts/generate-agent-guide.js --check` | 0 | no drift |
  | `node scripts/generate-language-artifacts.js --check` | 0 | no drift |
  | §12 `node --test scripts/doc-examples.test.js scripts/capability-matrix.test.js` | 0 | 26 of 26 |
  | T3 `node --test scripts/agent-guide.test.js` | 0 | 3 of 3 |
  | T4 `node packages/playground-nextjs/scripts/capture-capabilities.js --check` | 0 | `Captured CLI and compiler output is up to date.` |
  | AC2, §9's `grep -c` of "replaces SCSS" or "no media queries" in `README.md`, `packages/uxdsl/README.md` and `AGENTS.md` | 1 (nothing matches) | `0`, `0`, `0` |
  | AC3 `grep -c "inspired by Material UI" packages/uxdsl/README.md` | 0 | `1` (0 at the base) |
  | AC3, §9's `grep -ci` of "is MUI" or "Material UI's engine" in `packages/uxdsl/README.md` and `AGENTS.md` | 1 (nothing matches) | `0`, `0` |
  | AC5 `npm test` | 0 | 179 s. 1,530 tests: 1,529 pass, 0 fail, 1 skipped, no `not ok`. Parity `PASS: 10 parity case(s)`, `Captured CLI and compiler output is up to date.`, `Compiled examples are up to date (11).`, mig07 `All checks passed.` |
  | `npm run verify:1.0 -- --skip-playground-walk` | 0 | 104 s, `71/71 automated checks passed.` The tarball is `uxdsl-0.5.0-beta.9.tgz`, 271,826 bytes packed and 92 files. S-1 reports `compile()` at 1.25× Dart Sass. |
  | `npm run verify:playground-browser` | 0 | 234 s, port 3919. 380 pages and 2,222 focusable elements, `/docs/introduction` and `/docs/diagnostics` included: `PASS: no console errors, no UXDSL warnings, no unresolved var(), visible keyboard focus, contrast page = Node.` Its six negative controls were caught. |
  | `git status --short` afterwards | — | clean; no process of the run left |

- **CI.** PR #72's checks ran on the branch tip after this record was pushed. Their result is the PR's, not this record's.
- **Not run.**
  - Linux and Windows on this machine. CI's ubuntu job is the Linux run; Windows is MIG-B9-28.
  - Four gate items are listed as not run and not passing: B7-12, which is manual; the owner's project, which is external; the postpublish check; and B7-17E, which `--skip-playground-walk` skips. B7-17E's walk ran separately as `npm run verify:playground-browser`, above.
  - Press Craftor, and `fixtures/parity/run.js --update`. Compiled output does not change: `npm test`'s parity run passes against the committed oracles.
- **Owner steps.**
  - Review PR #72, and answer the owner flags in §15's "Delivery of 2026-11-08". The most urgent is flag 3: `/docs/language` stays stale for beta.9.
  - Merge the PR into `feat/beta9`. This run does not merge it.
  - Optionally, stop the `tail -f` (pid 4215) that MIG-B9-14's run left. It is harmless, and this run did not touch it.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- D1: the doc-example harness compiles only pipeline examples (doc-examples.js:193-198) and per-statement error comments rely on `postcss.parse`; define how a Sass example is compiled and how an error example is marked.
- D2 omits the limitation users hit first: tokens are opaque strings to Sass, so `darken(palette(…))`, `rgba(color(…), .5)` and Bootstrap's color mixins applied to tokens are Sass errors. Document it with the alternative (`palette(x, 0.5)`, `color-mix()`).
- D3 ("every SCSS file is a valid UXDSL file") is false while MIG-B9-11 R4 reserves names; qualify it according to DEC-17.
- AC2 already passes on the base (vacuous); give it a negative control.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-17:** D3 ("every SCSS file is a valid UXDSL file") holds without qualification: no name is reserved. Document `UXD_FUNCTION_SHADOWED` (meaning and fix) instead of `UXD_RESERVED_NAME`.
- **DEC-07:** the media-query section documents `@media (--<breakpoint>)` once MIG-B9-30 ships.

### Owner decisions of 2026-11-04 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-04). The owner was given 19 numbered recommendations, in Spanish, and answered, verbatim, "voy a seguir todas tus recomendciones" ("I will follow all your recommendations"): each recommendation is the owner's decision of 2026-11-04. This record is in English and lists those that concern this story. Where they differ from this story's contract, from the review above or from the owner decisions of 2026-10-23, they rule.

- **A kept `$variable` stays an error (decision D6 of 2026-11-04, on MIG-B9-13's owner flag 6).** A `$variable` Dart Sass keeps as written stays `UXD_SASS_CONTEXT`, not a warning, and a literal `$identifier` cannot be emitted except through the `\$` escape. This story documents the limitation and the escape's caveat (MIG-B9-13 §15, flag 6: only `\$x` passes, and Chrome then reads `\$x`).
- **PostCSS chains, for information only (decision D7 of 2026-11-04, on MIG-B9-13's owner flag 8, F3).** Decision D7 accepts as documented for now that `uxdsl/postcss` placed after postcss-nested or postcss-simple-vars fails, in either order; the README, the migration guide and the CHANGELOG already give the workaround (MIG-B9-13 §15, flag 8). MIG-B9-27 (wave 2) may remove the limitation. Decision D7 gives this story no task.

### Stale corrections before implementing (2026-11-08)

Corrected by the agent on `feat/beta9` at `db0e28d`, per [README §1 item 4](README.md#1-before-anything-read-prepare-verify): each line was only stale, because an earlier story of this feature moved what it pointed at. No contract line or acceptance criterion changed.

- §3 Preconditions, line 2. Old: `grep -q "The SCSS subset" AGENTS.md` (exits 1 on `db0e28d`: MIG-B9-13 rewrote AGENTS.md's SCSS paragraph). New: `grep -q "still describes the SCSS subset" AGENTS.md` (exits 0; it pins the sentence this story replaces, AGENTS.md:910).
- §4 Baseline. Old: "Recorded: the count of examples and theme excerpts compiled (48 examples, 24 excerpts in 101 files on `main` at beta.7; record the current figures)." New: "Recorded on `feat/beta9` at `db0e28d`: `52 examples and 24 theme excerpts checked across 101 documentation files. All documentation examples hold.` (exit 0)." MIG-B9-12, 13 and 14 brought the count to 49, 51 and 52.
- §2 Sources, the AGENTS.md reference. Old: "`AGENTS.md` describes the subset at "The SCSS subset `compile()` compiles (`$variables`, `@if/@else`, …" (around line 860)." New: AGENTS.md lines 873–911, rewritten by MIG-B9-13, ending with the line-910 sentence; the build-config keys sentence (686–688) lists no `sass`.
- §13 Delivery, the commit subject. Old: "… From SCSS, the importer rules, reserved names, warnings; …". New: "… From SCSS, the importer rules, functions named like UXDSL's, warnings; …". DEC-17 reserves no name; wording only.

### Delivery of 2026-11-08

Written by the deliverer with PR #72. It records new facts, the owner flags, Shares as delivered and the follow-ups, each with the story proposed for it.

**New facts.**

1. **`feat/beta9` did not move.** `origin/feat/beta9` stayed at `db0e28d` throughout the run. It was fetched before the PR and again before this record, so there is no merge commit.
2. **A `../x` through a load path that exists (review R1).** `compile()` searches each load path as plain Dart Sass does, so a `../x` that misses beside its file can still be found:
   - from `proj/src/components/card.uxdsl`, it resolves to `proj/_x.uxdsl` through `proj/node_modules/`;
   - from `app/src/entry.uxdsl`, it resolves to `app/src/_x.uxdsl` through `app/src/node_modules/`.

   Only a load path that does not exist finds nothing, which is MIG-B9-12's RES-1.
3. **What a host's own Sass does with UXDSL (review R2).** Measured with the repository's Dart Sass 1.107.0, with `uxdsl/postcss` run after it:
   - Undotted tokens and responsive values pass through Sass, and the plugin resolves them, a 768px media block included: `space(2)`, `palette(primary)`, `radius(2)`, `xs(space(2)) md(space(4))`.
   - Sass stops at `palette(primary.main)` (`expected "(".`), and at `color(white)` and `color(gray.300)` (`$description: … is not a string.`).
   - The four directives come out of Sass as `@ds-x (…)`. The plugin refuses each one as `UXD_SURFACE_ARGUMENT`, `UXD_BUTTON_ARGUMENT`, `UXD_INPUT_ARGUMENT` or `UXD_TYPO_ARGUMENT`.
4. **The extension rule, per extension (review R6).** Through `compile()`:

   | Source | `.uxdsl` | `.scss` or `.sass` | `.css` |
   | --- | --- | --- | --- |
   | `palette(primary.main)` | resolved | `UXD_SASS: expected "(".` | the same |
   | `color(white)` | resolved | `UXD_SASS: $description: white is not a string.` | resolved |
   | `color(gray.300)` | resolved | `UXD_SASS: $description: gray is not a string.` | `UXD_SASS: Expected identifier.` |
   | `space(10-2)` | `UXD_SPACE_REFERENCE` | `var(--uxdsl__space__8)`, silently | `UXD_SASS: Operators aren't allowed in plain CSS.` |
   | `$t: primary;` with `@ds-surface(contained $t)` | resolved | `UXD_SASS_CONTEXT` | `UXD_SASS: Sass variables aren't allowed in plain CSS.` |
   | `space(2)`, `palette(primary)`, `@ds-surface(contained)` | resolved | resolved | resolved |
5. **`@import` order (review R4).** Dart Sass moves a plain-CSS `@import` to the top when it is written after a rule or after an `@layer` statement. It goes after leading comments and `@charset`, in `compile()` as in plain Dart Sass. The PostCSS plugin used alone leaves it after the rule, where a browser discards it. Dart Sass 1.107.0 keeps a declaration written after a nested rule after it, so nothing else moves.
6. **Captures.** In this run `cli-captures.json` was never reported stale: both of the deliverer's `npm test` runs and the direct `--check` passed. The implementer saw the false report twice, once in a full run and once in three direct `--check` runs.
7. **Temporary directories.** One `npm test` run left 930 entries in `TMPDIR`, as the scout measured. The largest groups were 492 `uxdsl-sass-stage-*`, 152 `uxdsl-cli-test-*`, 26 `postcss-uxdsl-config-test-*`, 24 `uxdsl-theme-cmd-test-*`, 22 `uxdsl-cli-watch-*`, 21 `uxdsl-core-test-*` and 20 `uxdsl-sass-pipeline-*`. All were removed.
8. **A stray `tail -f`.** At delivery, pid 4215 was still alive after 1 day 20 hours. It is a `tail -n +1 -f` of `scratchpad/b9-14/fixer2/logs/battery-c1.summary`, left by MIG-B9-14's run, not this one, and it was not touched.

**Owner flags.**

1. **D3's sentence, "every SCSS file is a valid UXDSL file" (review R7).** It is written unqualified, as DEC-17 decided, in the README and with "No name is reserved" in compile.md. The introduction page's Sass row says UXDSL lacks "Nothing in the language". Three behaviors contradict it literally. compile.md documents all three, and the README links to it:
   - a valid SCSS file that prints a `$variable` into a custom property fails as `UXD_SASS_CONTEXT` (decision D6 of 2026-11-04);
   - one that prints text from a string that is not CSS fails as PostCSS's error (D18);
   - a project function named with the internal `uxdsl-probe-` prefix silently changes the output of a build that also defines a function named like UXDSL's, which makes the prefix reserved in practice.

   Confirm the wording, or qualify it.
2. **D1's reading: the fence language decides first.** A `css` fence always goes through the plugin alone, even when it holds Sass, so plugin-alone `UXD_SASS_CONTEXT` examples can be documented, and a mislabeled Sass example fails the run. The other reading, where any fence with a Sass construct goes through `compile()`, would change no current example, but it would make plugin-alone examples impossible.
3. **`/docs/language` stays stale for beta.9.** It still documents the deleted subset:
   - `packages/playground-nextjs/src/app/docs/language/page.tsx:28` says native nesting is "forwarded to the browser as written, not flattened";
   - lines 107 to 133 are the whole "The SCSS-style subset" section: its table, the claim that the plugin alone reads `$variables`, `UXD_SCSS_UNSUPPORTED` and `UXD_NESTING_INVALID`.

   This is outside this story's Owns and more than a sentence, so it was not edited. MIG-B9-62 owns the page but ships in beta.10, so a small story, or a wave-2 or wave-3 story, has to fix the text before beta.9 ships.
4. **Files outside Owns and Shares.** These were needed by D7, or keep the page from contradicting itself:
   - `packages/playground-nextjs/scripts/capture-capabilities.js`: one DIAGNOSTICS case;
   - `src/generated/compiler-captures.json`: regenerated by the script only;
   - `src/app/docs/introduction/page.mdx`, text only:
     - lines 27 and 34, which the scout named;
     - line 28, which said the PostCSS plugin runs `compile()`;
     - the Sass row of the comparison table, which said Sass has "A complete language" that UXDSL lacks.

   §7's row for `packages/playground-nextjs/**` does not list this story, so the wave-2 and wave-3 playground stories should serialize after this PR. MIG-B9-42 owns the introduction page in beta.10.
5. **AC2's negative control.** It is encoded as a test, `MIG-B9-15: the READMEs and AGENTS.md make neither retired claim (negative control)`, and AC2 itself is not rewritten. The accepting test also asserts AC3's phrases, and scans the root README for the two Material UI slips, so it is stricter than the AC3 grep.
6. **Status bookkeeping.** `db0e28d` is the merge of PR #71, yet README §5's MIG-B9-14 row and MIG-B9-14's header still say "In review (PR #71)". This record updates only the MIG-B9-15 row.

**Shares as delivered.**
- `packages/uxdsl/README.md`:
  - the "From SCSS" section and the overview;
  - review R1 to R4's corrections to sentences that MIG-B7-14, MIG-B9-12 and MIG-B9-13 wrote: the placement paragraph, the pipeline paragraph and the pointer to compile.md.
- `AGENTS.md` and the regenerated guide.
- `packages/uxdsl/docs/migration.md`.
- The CHANGELOG is untouched, as §10 says.

Within Owns, `scripts/lib/doc-examples.js` changed beyond the `scss` fence rule:
- claims are checked in examples that `compile()` compiles;
- `errorCode()` prefers an error's own UXD `code`;
- `firstLine()` strips the `docs/doc-example.uxdsl` location.

`scripts/doc-examples.test.js` gains a floor of 5 examples for compile.md.

**Follow-ups, each with its proposed story.**
- **MIG-B9-26.** The `uxdsl-probe-` prefix is reserved in practice (owner flag 1). Give a project definition with the prefix a located error, or use a prefix no project would write.
- **MIG-B9-52.**
  - The CHANGELOG's Dart Sass formatting bullet does not say that a `calc()` inside `min()`, `max()` or `clamp()` is written without `calc()`. migration.md item 1 and compile.md now say it.
  - MIG-B9-12's CHANGELOG entry says, in a parenthetical, that a `../x` that misses beside its file is "never a same-named file in another directory". That holds only where no load path that exists answers it (new fact 2).
- **MIG-B9-62, or a later docs-harness story.**
  - The blocks marked `<!-- doc-example: output -->` are never compared with `compile()`'s real output, so the outputs shown in compile.md and the README can drift.
  - In a `css` example, a `var(--…)` claim is checked only in a block that documents an error, and never inside a rule (review R5). AGENTS.md now says so. Two correct claims are unchecked today: `AGENTS.md:197` and `packages/uxdsl/README.md:941`.
- **MIG-B9-91.** `docs/releases/0.5.0-beta.9.md:59` records the doc-examples gate as "48 examples and 24 theme excerpts in 101 files"; the head has 62.
- **MIG-B9-39, or the story that owns the captures.** `capture-capabilities.js --check` sometimes reports `src/generated/cli-captures.json` as stale while the file is byte-identical (new fact 6). The likely cause is the timing-dependent `uxdsl build --watch` transcript in `captureWatch()`.
- **MIG-B9-25.** The 930 entries one `npm test` run leaves in `TMPDIR` (new fact 7).

### Owner decisions of 2026-11-08

The owner answered the flags of "Delivery of 2026-11-08" (and MIG-B9-14's) with, verbatim, "todo como recomendado" ("everything as recommended"): each recommendation below is the owner's decision. This record is in English; FEAT-010 §2 lists the full set. Where they differ from this story's contract or from the earlier blocks, they rule.

- **Flag 1, D3's sentence:** qualified rather than left unqualified. The package README, `compile.md` and the introduction page now say that every SCSS file is a valid UXDSL file except in the three cases `compile.md` documents: a `$variable` Sass keeps as written (`UXD_SASS_CONTEXT`), text Sass prints that is not CSS (a parse error), and a project function named with the Sass stage's internal prefix `uxdsl-probe-`. "No name is reserved" now reads "No UXDSL name is reserved", with the prefix named as the one exception. MIG-B9-26 removes the prefix exception (a located error for a project definition with the prefix, or an unguessable prefix). Applied in this PR, after the closure record, by the commit that adds this block.
- **Flag 2, D1's reading:** confirmed. The fence language decides first: a `css` fence always goes through the plugin alone, even when it holds Sass, so `UXD_SASS_CONTEXT` examples can be documented.
- **Flag 3, `/docs/language`:** a new S story, MIG-B9-16, rewrites the page's SCSS-subset section (page.tsx:28 and 107-133) for the superset before `0.5.0-beta.9` ships; MIG-B9-62 keeps the page in beta.10.
- **Flag 4, files outside Owns and Shares** (`capture-capabilities.js`, the regenerated `compiler-captures.json`, the introduction page): accepted. The wave-2 and wave-3 playground stories serialize after this PR.
- **The flaky watch test** (`watch-mode.test.js`, "waitFor timed out" on CI's ubuntu runner): owned by MIG-B9-39.
