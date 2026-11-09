# MIG-B9-14 — The CLI, Vite and webpack on the new pipeline

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided) |
| Status | Merged (PR #71) |
| Size | M |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-15, MIG-B9-20, MIG-B9-22 |
| Base | `feat/beta9` after MIG-B9-13 |
| Owns | `packages/uxdsl/bin/uxdsl.js` (`generateEntry`, error printing, the `sass` config key, `init`'s entry), `packages/uxdsl/src/vite.ts`, `packages/uxdsl/src/webpack.ts`, `packages/uxdsl/src/types.ts` (`UxdslConfigShared.sass`), `fixtures/mig02-nextjs-cssmodules/**` (one new entry), `packages/uxdsl/test/cli/**`, `test/vite/**`, `test/webpack/**` |
| Shares | `fixtures/release-1.0/run.js`, `packages/uxdsl/CHANGELOG.md`, `docs/features/FEAT-010/evidence/MIG-B9-03-press-craftor.md` (a second run appended) |
| Output impact | API/CLI: `generate-entry` writes `@use`; new `sass` config key and adapter option; `--first` flag |

## 1. Goal

Every entry point exposes the superset the same way: the CLI prints Sass
errors and warnings at the author's position, watches every file Sass
loaded, and generates `@use` entries; the Vite plugin and the webpack loader
register the same dependencies and chain the same maps; a Next.js project
has a documented path for `.module.uxdsl` files.

## 2. Sources

- `packages/uxdsl/bin/uxdsl.js`: `compileEntryToCss` (delegates to
  `compile()`; `dependencies` feed `startWatch`'s graph), `generateEntry`
  (writes `@import '<path>';` lines; `PRIORITY_PATTERNS = ['theme-def', 'layout', 'app', 'variables']`),
  `init` (scaffolds `src/uxdsl-entry.uxdsl` importing `src/styles.uxdsl`),
  `main`'s error printing (`[uxdsl] Error: …` plus `err.showSourceCode(false)`),
  `startWatch`'s `classify` (a file outside the known graph triggers a full
  rebuild).
- `packages/uxdsl/src/vite.ts`: `load()` calls `compile({ entry })`, adds
  every dependency with `this.addWatchFile`, returns `{ code, map }`; maps
  follow `build.sourcemap`/`css.devSourcemap`.
- `packages/uxdsl/src/webpack.ts`: `compile({ source, from })`,
  `this.addDependency` per dependency, the map object for css-loader.
- Verified Sass facts (MIG-B9-12 §2): `@use` of the same module twice in one
  file with the same namespace is an error ("There's already a module with
  namespace"); namespaces derive from the file name, so two files named
  `card.uxdsl` in different folders collide; `@use "./x" as <name>` picks the
  namespace; `@import` is deprecated and removed in Dart Sass 3.
- Press Craftor builds its `.module.uxdsl` files with the CLI into
  `*.generated.module.css` consumed by Next.js — the host never runs Sass on
  them (MIG-B9-03 §2).
- `test/cli/watch-mode.test.js` (13 tests), `test/cli/error-location.test.js`,
  `test/vite/index.test.js` (17), `test/webpack/loader.test.js` (7).

## 3. Preconditions

```bash
grep -q "compileSassStage" packages/uxdsl/src/compile.ts
grep -q "@import '\${item.path}';" packages/uxdsl/bin/uxdsl.js
grep -q "sourcemap?: false" packages/uxdsl/src/types.ts
test -f fixtures/mig02-nextjs-cssmodules/browser.js
```

## 4. Baseline

```bash
cli="$PWD/packages/uxdsl/bin/uxdsl.js" && d="$(mktemp -d "${TMPDIR:-/tmp}/ge.XXXXXX")" && mkdir -p "$d/src/components" && printf '.a{color:red}' > "$d/src/components/card.uxdsl" && printf '.b{color:blue}' > "$d/src/card.uxdsl" && cd "$d" && node "$cli" generate-entry --src ./src && cat src/uxdsl-entry.uxdsl   # from the worktree root
```

Recorded: two `@import` lines (`./card.uxdsl`, `./components/card.uxdsl`).
Through the new `compile()` with `@use` and default namespaces these two
would collide; with `@import` they compile with two deprecation warnings.

## 5. Contract

- **A1 — Errors in the CLI.** A `UXD_SASS` error prints, to stderr:
  `[uxdsl] Error: <file>:<line>:<column>: UXD_SASS: <sassMessage>` and then
  Sass's own formatted block (`error.sassFrame`: the code frame and the Sass
  stack) indented by two spaces; exit code 1. A UXDSL error inside a
  Sass-heavy file prints its PostCSS frame from the original source
  (`showSourceCode`), at the corrected column (MIG-B9-13 P5). In watch mode
  the same text follows `[uxdsl] build failed:` and the process keeps
  watching.
- **A2 — Warnings in the CLI.** Each `CompileWarning` prints once as
  `[uxdsl] Warning: <file>:<line>:<column>: <text>`; Sass's deprecation cap
  applies. A new config key `sass: { silenceDeprecations?: string[]; quietDeps?: boolean }`
  in `UxdslConfigShared` (typed; `uxdsl init`'s config comment mentions it)
  is passed to `compile()`. The same `sass` option exists on the Vite plugin
  and the webpack loader.
- **A3 — Watch.** The dependency graph is built from `dependencies`
  (Sass's `loadedFiles`): editing a `@use`d partial or a `.scss` file
  rebuilds only the entries that load it; a missing partial fails the build
  with `UXD_SASS`, keeps the previous output, and creating the file triggers
  a full rebuild (the existing `classify` fallback). Deleting a partial that
  an entry still loads: `UXD_SASS`, previous output kept.
- **A4 — `generate-entry` writes `@use`.** Each line is
  `@use '<relative path without extension>' as <namespace>;` where
  `<namespace>` is unique per file: the relative path with `./` and the
  extension removed, every character outside `[a-z0-9-]` replaced by `-`,
  lowercased, prefixed with `f-` when it starts with a digit or a `-`
  (`components/card` → `components-card`; `card` → `card`). Partials
  (`_name.uxdsl`) are listed by their path without the underscore. The header
  comment says the file is generated and how to regenerate it. A new flag
  `--first a,b,c` (paths relative to `--src`, comma-separated) puts those
  files first in that order; without it the existing `PRIORITY_PATTERNS`
  heuristic orders them. The excluded output file rule stays.
- **A5 — `init`.** The scaffolded `src/uxdsl-entry.uxdsl` uses `@use` for
  `src/styles.uxdsl`; `src/styles.uxdsl`'s comment names
  `uxdsl generate-entry`; the `--multi` scaffold's entries use `@use`; the
  Next.js variant is unchanged (PostCSS path, `@uxdsl theme;`).
- **A6 — Vite.** `addWatchFile` for every dependency (`@use`d partials
  included; test); `?inline` unchanged; the returned map's `sources` name the
  `.uxdsl` files that contributed (test reads it); the `sass` option is
  forwarded.
- **A7 — webpack.** `addDependency` for every dependency (test with a `@use`d
  partial); the map object; the `sass` option.
- **A8 — Next.js.** `fixtures/mig02-nextjs-cssmodules` gains one
  `panel.module.uxdsl` entry that uses `@use "sass:math"`, nesting with
  `&__title`, `$vars` and `palette(primary.main)`, built by the CLI into
  `panel.generated.module.css` and imported by a page; `browser.js` checks a
  computed style from it in Chrome. `docs/integrations/cli.md` documents the
  path and states that a `.module.scss` compiled by Next's own Sass cannot
  carry dotted tokens.
- **A9 — `uxdsl theme`** is unchanged.
- **A10 — Press Craftor again.** The MIG-B9-03 procedure is repeated on the
  copy against this branch's tarball; the seven generated files are compared
  with the MIG-B9-03 "after" set; every difference is flattening, a dropped
  `//` comment or a documented change, or a finding. Appended to the MIG-B9-03
  evidence file.

Must stay byte-identical: `uxdsl theme` output; the theme CSS; every
compiled output of a file without nesting, `//` comments or `.css` imports.

## 6. Out of scope

- `build --watch` regenerating the entry when files appear: MIG-B9-22.
- Removing `includeTheme`: MIG-B9-20.
- The playground's own entry script: MIG-B9-22.

## 7. Approach and traps

- Sass requires `@use` rules before any other rule except `@charset`,
  `@forward` and variable declarations; a generated entry contains only
  `@use` lines and comments, so this holds. A hand-written entry that mixes
  rules and `@use` gets Sass's own error (`UXD_SASS`).
- The namespace of `@use … as x` is unused (no member access from the
  entry); it exists only to avoid collisions. `as *` was rejected: two files
  defining the same `$variable` would then conflict when referenced.
- `@use` loads a module once per compilation: a file both `@use`d by the
  entry and `@import`ed by another file is emitted twice (Sass semantics);
  MIG-B9-22 checks the playground for this (`app.uxdsl` imports
  `RussianDoll.uxdsl`, also listed by the entry).
- `showSourceCode` on a prev-mapped error reads `sourcesContent`; verify the
  frame shows `.uxdsl` text, not Sass's output.
- Stop rule: if Vite or webpack's own Sass handling intercepts `.uxdsl`
  (they do not: both match extensions explicitly), stop and record.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/cli/error-location.test.js` | `MIG-B9-14: a Sass error prints UXD_SASS at the author's position with Sass's frame; a UXDSL error in a Sass-heavy file prints heavy.uxdsl:18:66 with its frame` | CLI | A1 | — |
| T2 | `test/cli/uxdsl-cli.test.js` | `MIG-B9-14: warnings print once with their position; sass.silenceDeprecations removes a type; an invalid sass key is a config error` | CLI | A2 | — |
| T3 | `test/cli/watch-mode.test.js` | `MIG-B9-14: editing a @use'd partial rebuilds only the entries that load it; a missing partial keeps the previous output until it appears` | CLI | A3 | — |
| T4 | `test/cli/uxdsl-cli.test.js` | `MIG-B9-14: generate-entry writes @use lines with unique namespaces for two files named alike, honours --first, and the entry compiles` | CLI | A4 | two files named alike through `@use` without `as` fail in Sass: asserted as the control |
| T5 | `test/cli/init.test.js` | `MIG-B9-14: init's entry uses @use and the project builds` | CLI | A5 | — |
| T6 | `test/vite/index.test.js` | `MIG-B9-14: load() adds every Sass-loaded file as a watch file and the map names the partial` | unit | A6 | — |
| T7 | `test/webpack/loader.test.js` | `MIG-B9-14: a @use'd partial is a dependency and a change to it recompiles` | unit | A7 | — |
| T8 | `fixtures/mig02-nextjs-cssmodules/browser.js` | `panel.module.uxdsl` built by the CLI renders with the expected computed style | Chrome | A8 | — |
| T9 | `fixtures/release-1.0/run.js` | `cssmod` extended (A8); `S-3` from MIG-B9-13 covers the CLI frame | tarball | A1, A8 | — |
| T10 | `fixtures/parity/run.js` | CLI and `compile()` agree on new cases `sass-use-partial`, `sass-nesting` | parity | A1 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/cli/*.test.js` exits 0.
- **AC2** `node --test packages/uxdsl/test/vite/*.test.js packages/uxdsl/test/webpack/*.test.js`
  exits 0.
- **AC3** `node fixtures/parity/run.js` exits 0 (new cases recorded with
  `--update`, listed in the PR).
- **AC4** `npm run verify:cssmodules-build` exits 0 in real Chrome.
- **AC5** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk`
  exits 0.
- **AC6** The MIG-B9-03 evidence file has a second section "On the superset
  pipeline" with the comparison and zero unexplained hunks.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | no |
| CHANGELOG | yes (`### CLI`: `@use` entries, `--first`, `sass` key; `### Adapters`) |
| `migration.md` | yes (regenerate entries with `generate-entry`) |
| package README | yes |
| `verify-docs-update.js` classification | no |
| `DIAGNOSTIC_CATALOG` | no |
| playground captures | yes (`uxdsl --help`, `generate-entry --help` captures) |

## 11. Documentation

`packages/uxdsl/docs/integrations/cli.md` ("Commands": `generate-entry`
`--first`; "Watch mode"; a new "Next.js" subsection), `vite.md` and
`webpack.md` ("Options": `sass`), `packages/uxdsl/README.md` (entry points
paragraph), `packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/docs/migration.md`.

## 12. Verification

```bash
node --test packages/uxdsl/test/cli/*.test.js                                   # exit 0 (background)
node --test packages/uxdsl/test/vite/*.test.js packages/uxdsl/test/webpack/*.test.js  # exit 0
node fixtures/parity/run.js                                                      # exit 0
npm run verify:cssmodules-build                                                  # exit 0, Chrome
npm test                                                                         # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                                     # background; exit 0
```

## 13. Delivery

Branch `feat/b9-14-cli-adapters`. Commit:
`feat(FEAT-010): MIG-B9-14 - the CLI, Vite and webpack on the Sass pipeline: @use entries, located Sass errors and warnings, the sass option`.

## 14. Closure record

Delivered in one PR (#71), from `feat/b9-14-cli-adapters`. Where it differs from §5, §15's blocks rule:
- the review of 2026-10-11, as applied in "Applied before implementing (2026-11-03)";
- the follow-ups MIG-B9-12 and MIG-B9-13 routed here (their §15 "Delivery" blocks);
- the owner decisions of 2026-11-04 that settle them: D18, D19, and D5 for MIG-B9-26.

Four documents were written before the code. They stay with the run's evidence outside the repository:
- the scout's report (2026-11-03): the base's behavior as checked facts, the findings routed here, and 11 open questions;
- the design record (2026-11-03): decisions Q1–Q11 and X1–X5, tests T1–T11, 12 commits for three implementers, 14 owner flags, 14 stop conditions;
- the review: four lenses, 23 findings;
- the mutation re-review: 24 mutants.

The decisions that change §5 are summarized below. "Evidence by part", at the end of this section, holds each implementer's failing-first output and figures, corrected where the review found a claim wrong.

- **Base and merges.**
  - The base is `feat/beta9` at `7aec3e0` (MIG-B9-13 merged, PR #63).
  - On 2026-11-06 `origin/feat/beta9` had moved to `b2a7206`: PR #64 (MIG-B9-23's story) and PR #65 (the owner's decisions of 2026-11-04). Both are documentation only. They were merged into this branch as `7691b0c`, a merge commit; there was no rebase and no force-push.
  - Its one conflict was this index's §5 table (`docs/features/FEAT-010/README.md`). Every other row was kept as `feat/beta9` has it, and this story's row as this branch has it.
  - The head before this record is `7691b0c`. The 22 story commits since the base:
    - `ca31f13` (§4 and the review applied), `cf73ee0` (A1), `9a758b6` (A2), `e87ff3d` (A3): implementer I1;
    - `b392450` (A4, A5), `7188f54` (T10), `4c34bb8` (the `UXD_FUNCTION_SHADOWED` capture): I2;
    - `1c00ee3` (A6, A7), `5181edb` (A8, the gate's S-4), `e51b775` (documentation), `23c561e` (A10), `ec7d492` (notes): I3;
    - the four review lenses' fixers: `10ec3c6` and `64519d7` (contract and tests), `f3a3718`, `6774b73` and `6efd29e` (CLI behavior), `3208507` and `51ac1c9` (adapters and maps), `1a67e88` and `b209f61` (docs, guards and evidence);
    - `f4e8756`: the mutation re-review's fixer.
- **Environment.**
  - macOS 27.0 (Darwin 27.0.0, Apple Silicon, 8 cores).
  - Node 20.19.0 and npm 11.21.1, CI's versions, never the machine's default Node 20.14 or npm 10.7.
  - Dart Sass 1.107.0 in the repository. A fresh consumer install resolves 1.107.1 from the tarball's `^1.107.0`, and Press Craftor's seven files are byte-identical under both.
  - PostCSS 8.5.31. Google Chrome 156.0.8078.80 at the macOS default path.
  - Every command ran with `TMPDIR` set to a scratch directory of the role's own, never the owner's.
  - The worktree was prepared as `ci.yml` does, and every step exited 0. `npm run prepare` installed husky's hooks, so the pre-commit hook ran on every commit, the merge included: the docs guard, then the full playground build. No commit used `--no-verify` or `HUSKY=0`.
  - The owner's dev servers ran throughout and were not touched: story-radar's `next dev` and `uxdsl watch`, and the playground's `next dev` in the owner's checkout. Load average was 10 to 13 during the delivery runs.
- **Preconditions (§3).** All four exit 0 on `7aec3e0` with `/usr/bin/grep`. P2 fails only under this session's zsh `grep` function, which is ugrep.
- **Baseline (§4).** The corrected line, which uses repository files only, prints the two recorded `@import` lines, and the recorded consequences hold (§15, "Applied before implementing"). Also at the base:
  - the CLI suite: 218 tests;
  - the Vite and webpack suites: 24;
  - parity: 8 cases;
  - the playground's `uxdsl:build`: 2.96, 2.26 and 2.30 s;
  - `verify:cssmodules-build`: exit 0;
  - `fixtures/vite-adapter`: exit 0, with maps still not chained.
- **Failing test first.** Every new test was run against the commit before its change and failed there. The failure output is quoted in "Evidence by part":
  - I1: T1, T1b, T2, T2b, T2c, T2d, T3, T3b and T3c;
  - I2: T4, T4b, T4c, T5 and the capture's warning case;
  - I3: T6, T7, T2c's adapter part, T8 and S-4.

  Two kinds of test pin behavior that already held, and are recorded as pins:
  - T10's two cases, which already agreed on the base;
  - the parts of T6 and T7 about watch files and maps.

  Each finding the review raised was reproduced before its fix. Where the behavior was right and only a test was missing, the gap was shown by a mutant, of `bin/uxdsl.js` or of the capture script, that the old tests let pass and the new test kills (see "The review and its outcome").
- **Contract as delivered, where it differs from §5:**
  - **A1.**
    - The frame is chosen by `error.code === 'UXD_SASS'`, since `diagnosticCode()` returns `undefined` for a message that starts with a location.
    - It is `error.sassFrame`, printed after the head line with two spaces before each line, and never `error.cause.message`, the protected text.
    - In watch mode every failed compile prints `[uxdsl] build failed:`, the session's first build included (owner flag 5). That build printed `[uxdsl] Error:` before; a config that fails to load still does.
  - **A2.**
    - "Prints once" is read as once per build for a line with a file, and once per entry for a line without a position. The second part is review finding CLI-3: dropping a second entry's identical Dart Sass summary had understated the count of omitted deprecations.
    - Every rebuild prints the rebuilt entry's warnings again (owner flag 6).
    - A compile that throws prints no warnings, because `compile()` puts none on its error (owner flag 11).
    - `UxdslConfigShared.sass` is written inline in `types.ts`, with a tsc test that pins it equal to `CompileConfig['sass']`. The design's `import type` from `./compile` failed the hook's playground type-check (Evidence by part, A2).
    - The config refuses `builds[i].sass` and a top-level `silenceDeprecations` or `quietDeps` too. Those refusals reach `uxdsl theme` (owner flag 8).
  - **A3.**
    - Every entry and every file Dart Sass loaded is followed through its directory.
    - A deleted directory of followed files is watched for again from the nearest directory above it that remains (review CLI-1).
    - A file a build newly loads, beside the saved file, keeps its stats, so the late event chokidar reports for it builds nothing (review F2).
    - The two limitations are documented in cli.md (owner flag 15): a missing partial created where no `watch` pattern matches, and a file written within 100 ms (2 s on a whole-second file system) before the build that first loads it.
  - **A4.**
    - The namespace is the path relative to the entry, as A4 reads (owner flag 1).
    - A collision gets `-2`, `-3` and so on, in today's sort order.
    - `%`, `#`, `?`, `'` and `\` are percent-encoded (`\` since review CLI-5).
    - `--first`'s errors write nothing.
    - A third header line says how to regenerate the file.
    - One warning is printed when the entry being replaced used `@import`.
    - The rule that excludes files by the entry's file name, in any directory, is unchanged and is now documented and pinned (review DGE-2, owner flag 17).
    - Module isolation is documented, tested by T4b with an `@import`-entry control, and refined by review DGE-1: under a file's own namespaced `@use`, a bare function call stays in the CSS without an error.
  - **A5.**
    - As corrected by the review, init writes no `@uxdsl theme;` today; MIG-B9-20 adds the marker.
    - The `--multi` entries import nothing, so "use `@use`" holds vacuously (owner flag 14).
  - **A6 and A7.**
    - Warnings arrive located, as text, which goes beyond A6 and A7's wording (owner flag 7).
    - `uxdsl/webpack` hands css-loader absolute map sources (review adapters F2). css-loader resolved relative sources against the working directory, so the map webpack emitted named the files at the wrong paths. That defect was present at the base.
    - What an edit does not recompile is documented, not changed (owner flag 16): a file under `node_modules`, and the files of a compile that failed.
  - **A8.**
    - The CLI's config and theme file are in `fixtures/mig02-nextjs-cssmodules/uxdsl-cli/`, because a theme file at the fixture's root silently changed `browser-import-order.js`'s theme.
    - Chrome reads the served `next build`, through `next start`.
  - **A9.** For a valid config, `uxdsl theme`'s output is byte-identical to the base's. For an invalid `sass` value or a misplaced key it now exits 1 (owner flag 8).
  - **A10.** The MIG-B9-03 after set was rebuilt from `0c9fbf6`. One class of difference has no CHANGELOG entry: the `calc()` that Dart Sass writes without `calc()` inside `min()`, `max()` or `clamp()`. It is finding 9 of the evidence file.
  - **T9.** It gains S-4 (the installed CLI's frame and warnings), and, after review adapters F4, S-5 (the installed `uxdsl/webpack`) and S-6 (the installed `uxdsl/vite`). Owner flag 9 covers them.
  - **T10.** It pins agreement only: its two cases already agreed on the base. Its error oracles record A1's frame but cannot guard it, because `fixtures/parity/run.js` compares an error with its oracle by substring in both directions (review F1, blocking).
    - A CLI that prints the head line alone still passes all ten cases; that was reproduced.
    - A1's frame is guarded by T1, T1b, T3 and S-4.
    - §8's "T10 proves A1" cannot be met inside this story's Owns (owner flag 10; MIG-B9-20 owns `run.js`).
- **Tests.**
  - CLI (`packages/uxdsl/test/cli`): 218 → 252 tests (34 more). The new ones are T1, T1b, T2, T2b, the `sass` type check, T2c, T2d, T3, T3b, T3c, T4, T4b, T4c and T5, their negative controls, and the review's watch, warning, generate-entry and namespaced-`@use` tests.
  - Vite and webpack: 24 → 30. These are T6, T7, the two `sass`-option tests, and webpack's map test with its negative control.
  - Parity: 8 → 10 cases.
  - `fixtures/release-1.0/verdicts.test.js`: 4 → 10. S-4, S-5 and S-6 each have an accepting test and a negative control.
  - The gate's automated checks with `--skip-playground-walk`: 69 at `23c561e`, 71 now, and 72 with the playground walk.
  - Doc examples: 51 → 52. Diagnostics captures: 22 → 23, the first warning case. The capability matrix: 119 → 120 capabilities, 0 gaps.
  - T11 lists the four adapted assertions, each of which fails for exactly its contract reason:
    - MIG-B6-23's missing-partial wait;
    - MIG-B2-03's entry line;
    - `init.test.js` phase 2 (3);
    - `fixtures/mig-b2-03-cli-init`'s check.
- **Parity (AC3).** `node fixtures/parity/run.js --update`, from the repository root, and then every hunk was read (Evidence by part, T10):
  - two new oracles, `sass-use-partial.json` and `sass-nesting.json`;
  - `missing-import.json` and `import-cycle.json`, whose head line is unchanged and is now followed by Sass's frame;
  - no hunk in the six existing CSS oracles.
- **Press Craftor (A10, AC6).** Recorded once, in `evidence/MIG-B9-03-press-craftor.md`, "On the superset pipeline":
  - the after set rebuilt from `0c9fbf6` reproduces the seven sizes, and its pack shasum is MIG-B9-03's;
  - this branch's tarball builds the seven files with no warning, and `next build` passes;
  - rule counts and order are equal in all seven files, and 175 rules differ, every one classified, with zero unexplained;
  - Chrome gives MIG-B9-03 §6's result for `/login` and `/help` on both builds;
  - the proxy pages compute the same style for all 7,588 elements.

  The comparison table's blank-line counts, the `/` breakdown and its attribute examples were corrected after the review (DGE-5); the conclusion did not change.
- **The review and its outcome.** Four lenses read the branch at `ec7d492` and ran experiments in scratch roots:
  - **Contract and tests.** F1, blocking: T10 cannot guard A1. F2, F3, F4 and F5 should be fixed. F6 and F7 are nits.
  - **CLI behavior.** CLI-1 to CLI-4 should be fixed; CLI-5 is a nit.
  - **Adapters and maps.** F1, blocking (the same as the first lens's F1). F2 to F4 should be fixed; F5 is a nit.
  - **Docs, guards and evidence.** DGE-1 and DGE-2 should be fixed; DGE-3 to DGE-6 are nits.

  What was done:
  - **Fixed, each with a test that failed first:**
    - one save building an entry twice: contract F2 = CLI-2, `10ec3c6`;
    - three `followAll()` calls no test guarded: F3, `10ec3c6`;
    - T3b's flaky control: F5 = CLI-4, `10ec3c6`;
    - the capture's mismatch check, whose negative controls had been run by hand only: F6, `64519d7`;
    - a deleted followed directory never watched again: CLI-1, `f3a3718`;
    - the second entry's Dart Sass summary dropped: CLI-3, `6774b73`;
    - a backslash in a file name: CLI-5, `6efd29e`;
    - webpack's map sources: adapters F2, `3208507`;
    - no tarball check of the adapters: adapters F4, `51ac1c9`, which adds S-5 and S-6 and found Vite's `resolveConfig` leaking `NODE_ENV=production` into the gate process.
  - **Fixed in the documentation, the help or a message:**
    - what an adapter edit does not recompile: adapters F3 and F5;
    - what a namespaced `@use` reads, which files the entry leaves out, and `generate-entry`'s defaults: DGE-1 to DGE-3, `1a67e88`, with two new tests;
    - the README's watch sentence, the Press Craftor table's counts and a decision id shown on `/docs/diagnostics`: DGE-4 to DGE-6, `b209f61`.
  - **Not a defect.** Contract F4, `uxdsl theme` refusing an invalid `sass`, is the behavior the design chose; it is owner flag 8.
  - **Recorded, not fixed in this story.** F1 (owner flag 10, routed to MIG-B9-20), F7 (this record) and adapters F3's code part (owner flag 16).
  - **The mutation re-review** read `b209f61`. Of 24 mutants of the fixes, 23 were killed.
    - The survivor, RR-1: the start time a full rebuild passes to `followAll()`. It is now guarded by `watch-mode.test.js`'s new same-directory full-rebuild test, by an unchanged-event step in it and in the selective-build test, and by a unit test of the drop (`f4e8756`). Every mutant of the fix fails one of them, on macOS, and also with the save step's assertions removed, as on a platform with no late event.
    - RR-2: the watch guide now says when a partial written with its entry builds it twice.
    - RR-3: owner flag 8.
- **Final verification, on `7691b0c`, by the deliverer.** One after another, each with its log, on 2026-11-06:

  | Command | Exit | Result |
  | --- | --- | --- |
  | `npm --prefix packages/uxdsl run build` | 0 | `tsc -p tsconfig.json`, 2 s |
  | AC1 `node --test packages/uxdsl/test/cli/*.test.js` | 0 | 252 of 252 (96 s) |
  | AC2 `node --test packages/uxdsl/test/vite/*.test.js packages/uxdsl/test/webpack/*.test.js` | 0 | 30 of 30 (2 s) |
  | AC3 `node fixtures/parity/run.js` | 0 | `PASS: 10 parity case(s) — CLI, compile(), and the Vite/Webpack adapters agree, matching the committed oracle.` |
  | AC4 `npm run verify:cssmodules-build` | 0 | 29 s, Chrome: `PASS: the served next build renders the CLI-built styles/panel.generated.module.css: padding 16px, radius 8px, border and title rgb(37, 99, 235), title margin-bottom 8px, class panel_generated_panel__title__k6OTO, body rgb(0, 0, 0).` The negative build still rejects a `:root` `.module.css`. |
  | AC5 `npm test` | 0 | 193 s, no `not ok`. The package's suites: 723, core 336 and 1 skipped, CLI 252, Vite 19, webpack 11, performance 1. Then the VS Code extension 30, the playground's suites and its captures' and examples' `--check`, parity 10 cases, `verdicts.test.js` 10, the docs and generated-artifact checks. |
  | AC5 `npm run verify:1.0 -- --skip-playground-walk` | 0 | 106 s, `71/71 automated checks passed.` The tarball is `uxdsl-0.5.0-beta.9.tgz`, 269,733 bytes packed and 92 files. S-1 to S-6, N-03, N-04, `cssmod` and DE-9 are `ok`, and S-1 reports `compile()` at 1.25× Dart Sass. |
  | `npm run verify:1.0` | 0 | 337 s, `72/72 automated checks passed.`, B7-17E (the playground walk) included |
  | `npm run verify:doc-examples` | 0 | `52 examples and 24 theme excerpts checked across 101 documentation files.` |
  | `node scripts/generate-language-artifacts.js --check` | 0 | no drift |
  | `node scripts/generate-agent-guide.js --check` | 0 | no drift |
  | `npm run verify:playground-browser` | 0 | 236 s, first run, port 3919. 380 pages and 2,222 focusable elements: `PASS: no console errors, no UXDSL warnings, no unresolved var(), visible keyboard focus, contrast page = Node.` Its six negative controls were caught. |
  | `npm --prefix packages/playground-nextjs run uxdsl:build`, three times | 0 | real 2.28, 2.21 and 2.19 s, against the scout's 2.96, 2.26 and 2.30 s at the base. It prints 17 warning lines, and `src/app/uxdsl.css` is unchanged. |
  | AC6 | — | `## On the superset pipeline` at line 8036 of `docs/features/FEAT-010/evidence/MIG-B9-03-press-craftor.md` |
  | `git status --short` afterwards | — | clean; no watcher and no `next start` of the run left |

- **CI.** PR #71's checks ran on the branch tip after this record was pushed. Their result is the PR's, not this record's.
- **Not run.**
  - Linux and Windows on this machine, which has no container runtime. CI's ubuntu run is the first Linux run of the new watch tests, of webpack's map test and of S-5 and S-6. Windows is MIG-B9-28.
  - The gate lists four checks as not run and not passing: B7-12, which is manual; the owner's project, which is external; the postpublish check; and B7-17E, skipped by `--skip-playground-walk` and run by the full `npm run verify:1.0`.
  - Press Craftor's database routes, as in MIG-B9-03 §6.
- **Owner steps.**
  - Review PR #71. Answer the owner flags in §15, "Delivery of 2026-11-06", and decide the proposed stories MIG-B9-38 and MIG-B9-39.
  - Merge the PR into `feat/beta9`. This run does not merge it.
  - Remove, if wanted, the two directories a scout's `mktemp -d` left in the owner's temporary directory (§15).
  - Still the owner's from the decisions of 2026-11-04: Dependabot security updates (D16), and the Press Craftor patch after beta.9 is published (D17).

### Evidence by part

Written by each implementer in its own commits, from the "Notes for the closure record" each appended; where the review showed a claim wrong, the claim is corrected here and the correction says so. Environment as above.

- **A1, errors (I1).**
  - Failing first, against the unchanged CLI of `ca31f13`: `node --test --test-name-pattern="MIG-B9-14" packages/uxdsl/test/cli/error-location.test.js packages/uxdsl/test/cli/watch-mode.test.js` exited 1 with 3 failures. T1: stderr was only `[uxdsl] Error: src/a.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import.\n`, with no frame. Its negative control: no frame line for line 1 (`undefined`). T1b: `waitFor timed out`, because the first build of the watch session printed `[uxdsl] Error: …` with no frame. After the change, the same command exits 0.
  - T11: the MIG-B6-23 missing-partial test, with its former `/error/i` wait, run against the new CLI: `waitFor timed out`, since the first watch build prints `[uxdsl] build failed: … UXD_SASS: Can't find stylesheet to import.` and Sass's frame, neither of which contains "error". With `/UXD_SASS|error/i` it passes.
  - `node --test packages/uxdsl/test/cli/*.test.js`: 221 tests, 221 pass (45.3 s). `npm test`: exit 0 (132.8 s). `npm run verify:doc-examples`: exit 0.
  - Captures, regenerated by the script after `uxdsl:build` (`--check` exit 0): the `UXD_SASS` diagnostic's stderr gains Sass's five frame lines, and the watch transcript's error step gains PostCSS's frame (`> 5 |   gap: density(4) xxl(2rem);`, six lines).
- **A2, warnings and the `sass` key (I1).**
  - Failing first, against the CLI of `cf73ee0`: `node --test --test-name-pattern="MIG-B9-14" packages/uxdsl/test/cli/uxdsl-cli.test.js packages/uxdsl/test/cli/plugin-option-parity.test.js packages/uxdsl/test/cli/init.test.js` exited 1 with 4 failures. T2: stderr held no warning (`+ []` against the three expected lines). T2b: `sass: null — loadConfig accepts it, compile() refuses it`. T2c: `CompileConfig key(s) ["sass"] are not forwarded by the CLI's compile() call`. T2d: the generated config had no `sass` comment. The two negative controls passed there, as a control does: the probe coverage check reports `loadPaths`, and the unknown theme family printed once, since the CLI printed no `compile()` warning at all. After the change, the same command exits 0 (9 pass, the type check below included).
  - Deviation from the design record's Q2: the key is not typed `sass?: CompileConfig['sass']` through `import type { CompileConfig } from './compile'`. With that import, the pre-commit hook's playground build failed: Next's type-check reads uxdsl's `src` through the playground's path aliases (`uxdsl/theme` → `src/entries/theme.ts` → `types.ts`), and the import brought in compile.ts, whose `import uxdslPlugin = require('./plugin')` fails there (`../uxdsl/src/compile.ts:50:1 Type error: Import assignment cannot be used when targeting ECMAScript modules.`). `types.ts` therefore writes the shape, `{ silenceDeprecations?: string[]; quietDeps?: boolean }`, and a CLI test has tsc read it and `CompileConfig['sass']` from the published declarations as one type, with a strict equality that an optional member added to either side breaks; its negative control (a shape without `quietDeps`) fails with TS2322. Making compile.ts take the shape from types.ts would remove the second spelling; compile.ts is not this story's file.
  - `node --test packages/uxdsl/test/cli/*.test.js`: 228 tests, 228 pass (48.0 s) before the type check was added; after it, `npm test` exits 0 (130.5 s) with its CLI step at 230 of 230. `npm run verify:doc-examples`: exit 0. `uxdsl theme` prints the same JSON with and without a valid `sass` key (T2's last part).
  - Captures, regenerated after `uxdsl:build`: `build`, `build-config`, `build-strict-theme-scoped` and the watch transcript's start, edit and undo steps gain the two `[import]` warnings of the committed `@import` entry (`src/main.uxdsl:5:9` and `:6:9`), until that entry is regenerated with `@use`; `init` and `init-next` gain the three-line `sass` comment. `--check` exit 0, five runs in a row.
  - The playground's `npm --prefix packages/playground-nextjs run uxdsl:build` (3.03 s) now prints 17 warning lines: 5 `[import]` at `src/app/uxdsl-entry.uxdsl:5:9` to `:9:9`; 11 `You probably don't mean to use the color value <name> in interpolation here.` at `src/components/DemoColors.uxdsl:104:16` (aqua, blue, gray, green, indigo, orange, pink, purple, red, teal, yellow); and `UXD_SASS_WARNING: 37 repetitive deprecation warnings omitted.` Its output is unchanged (`[uxdsl] unchanged src/app/uxdsl.css`).
  - The watch transcript interleaves stdout and stderr in the order the capture script reads them. The two warning lines (stderr) arrive a few milliseconds before `[uxdsl] built …` (stdout), so their order rests on the reader; the five `--check` runs agreed. Regenerating the fixture's entry with `@use` removes these lines from the build and watch captures.
- **A3, watch (I1).**
  - Failing first, against the CLI of `9a758b6`: `node --test --test-name-pattern="MIG-B9-14: (editing a @use|an entry the watch|a followed file)" packages/uxdsl/test/cli/watch-mode.test.js packages/uxdsl/test/cli/watch-selection.test.js` exited 1 with 3 failures. T3: the first edit of `src/_part.uxdsl` after start also printed `[uxdsl] unchanged out/a.css …`, because the graph was not seeded. T3c: `waitFor timed out`, since `src/a.uxdsl`, outside `watch: ['styles/**']`, was never rebuilt. T3b: `s.follow is not a function`. A scratch session of the same CLI on T3's layout showed the later steps failing too: editing `src/_tokens.scss` (khaki), editing `shared/_far.uxdsl` (navy) and re-creating it (lime) each printed nothing and left `out/b.css` unchanged. After the change, the same command exits 0 (T3 7.5 s, T3c 4.0 s, T3b 2.5 s).
  - Stability: `node --test packages/uxdsl/test/cli/watch-mode.test.js packages/uxdsl/test/cli/watch-selection.test.js` three times in a row, each 23 of 23 (55.7, 55.9 and 55.8 s). Then `node --test packages/uxdsl/test/cli/*.test.js`: 233 of 233 (56.5 s). `npm test`: exit 0 (137.7 s). `npm run verify:doc-examples`: exit 0. The capture `--check`: up to date, no regeneration. No `uxdsl … --watch` process of the run was left (`pgrep -fl "uxdsl.*--watch"` empty).
  - Deviation from the design record's Q3: `followAll()` runs after every config reload in `runFullBuild`, whether or not the watcher was recreated, besides after every successful build. The record names only the recreation. Following on every reload is a superset: when a config edit moves an entry but leaves an explicit `watch` list as it was, the watcher is not recreated, and the moved entry is still followed even if its first build fails.
  - The new watch tests spawn the CLI without `npm install`ing the package into the project: the CLI compiles with the package it ships in, and their configs load nothing else.
- **A4 and A5, the generated entry (I2).**
  - Failing first, against the CLI of `e87ff3d`: `node --test --test-reporter=spec --test-name-pattern="MIG-B9-14: (generate-entry|two files named|under a generated|through a hand-written|init's entry uses)" packages/uxdsl/test/cli/uxdsl-cli.test.js packages/uxdsl/test/cli/init.test.js` exited 1 with 4 failures. T4: stdout ended `… with 2 imports.` where `… with 2 @use rules.` was expected. T4b: the `$variable` case built with exit 0 and printed `[uxdsl] Warning: src/uxdsl-entry.uxdsl:5:9: UXD_SASS_WARNING: [import] …`, where `UXD_SASS` was expected. T4c: no warning line (0 where 1 was expected). T5: `[plain]` the entry held `@import './styles.uxdsl';` where `@use './styles' as styles;` was expected. The two negative controls passed there, as controls do: two `card.uxdsl` files through `@use` without `as` fail with `src/uxdsl-entry.uxdsl:2:1: UXD_SASS: There's already a module with namespace "card".`, and a hand-written `@import` entry shares every member (red, `padding: 1px`, `margin: 0`, `8px`, the earlier `!default`'s red, the project `space()`'s `8px`). After the change, the same command exits 0 (8 pass, the two adapted tests included).
  - T11: against what the new CLI writes, the three former assertions are false and their `@use` replacements true (a scratch script): MIG-B2-03's `/components\/Button\.uxdsl/` (the line is now `@use './components/Button' as components-button;`; its unchanged legacy-theme assertion still holds), init.test.js phase 2 (3)'s `/^@import '\.\/styles\.uxdsl';$/m`, and fixtures/mig-b2-03-cli-init's `/@import '\.\/styles\.uxdsl';/`. Each fails for the `@import` line and nothing else.
  - What T4b's cases print, measured through `compile()` before the test was written: under a generated entry, a project `@function space` in `_shadow.uxdsl` gives `pad.uxdsl` the token (`var(--uxdsl__space__2)`) and no `UXD_FUNCTION_SHADOWED` warning at all (the warning appears once `pad.uxdsl` itself `@use`s `./shadow` `as *`, or `@import`s it; under a plain `@use './shadow';` the token stays and nothing warns, as review DGE-1 found and `uxdsl-cli.test.js` pins since `1a67e88`), so that case is silent; the placeholder's error is two lines (`The target selector was not found.`, then `Use "@extend %reset !optional" to avoid this error.`); a module another file configures with `with (...)` fails at `src/brand.uxdsl:1:1: UXD_SASS: This module was already loaded, so it can't be configured using "with".` while `_variables` is listed first, and `--first brand` compiles it (`.v` and `.brand` blue).
  - The playground, with MIG-B9-22's list: on a scratch copy of `packages/playground-nextjs/src`, `generate-entry --src src --out src/app/uxdsl-entry.uxdsl --first app/typography-roles.uxdsl,app/theme-def.uxdsl,app/layout.uxdsl,app/app.uxdsl` (exit 0) writes 41 `@use` lines whose URLs, in order, are the 41 `@import` paths `scripts/generate-uxdsl-entry.js` writes, without `.uxdsl`: `diff` of the two lists is empty (exit 0); no playground file is a partial or needs encoding. It printed the transition warning once, since the entry it replaced was the script's `@import` entry. `compile()` of that `@use` entry with the playground's `uxdsl.theme.cjs` (716 ms) gives 337,304 bytes against the committed `src/app/uxdsl.css`'s 337,214, and `diff` shows only the header (the script's `Generated by` line against the CLI's two lines); 12 warnings (one `[import]` from `app.uxdsl`'s own `@import` of RussianDoll, 11 from `DemoColors.uxdsl:104`).
  - The visual change, measured on the capture fixture: its CSS through the regenerated `@use` entry and through its former `@import` entry differ by the header's third comment line only (49,480 → 49,581 bytes; `diff`: one added line).
  - Captures, regenerated by the script after `uxdsl:build` (`--check` exit 0). The fixture's `src/main.uxdsl` was regenerated with `node ../../../uxdsl/bin/uxdsl.js generate-entry --src src --out src/main.uxdsl --exclude legacy.uxdsl` (it printed the transition warning once). As a result: `generate-entry` shows `with 2 @use rules.` and the `@use` file; `build`, `build-config`, `build-strict-theme-scoped` and the three watch steps lose the two `[import]` warnings and gain 101 bytes; `init` and `init-next` show `with 1 @use rule.`, the new `styles.uxdsl` comment and the `@use` entry; `help` shows the new `init` and `generate-entry` rows; a new `generate-entry-help` run, shown collapsed on the tooling page. `npm run generate:capabilities`: 120 capabilities, 120 at their level, 0 gaps (`cli-flag:--first`, documented on `src/app/docs/tooling/page.mdx`).
  - Commands: `node --test packages/uxdsl/test/cli/*.test.js` 239 of 239 (60.4 s); `node fixtures/mig-b2-03-cli-init/run.js` PASS (50 checks, 12.3 s); `node --test scripts/capability-matrix.test.js` 7 of 7; `npm run verify:doc-examples` exit 0 (51 examples); `npm test` exit 0 (153.6 s) on its second run. Its first run exited 1 on T3b (see the next item).
  - A flake in I1's T3b (`watch-selection.test.js:92`), seen once: inside the first `npm test` run of this commit its negative control's first event was `change src/a.uxdsl`, a file written just before `createWatcher` and never touched after it. The test passed 8 of 8 runs alone, 5 of 5 beside three other CLI test files, in the standalone CLI suite and in the second `npm test`. The negative control counts every event that is not the followed file's, so a late event macOS delivers for a write made before the watcher started fails it; counting only `shared/` events, or waiting before `createWatcher`, would remove that. Left as it is here (I1's test, outside this commit); CI runs on Linux. Fixed after the review (F5, CLI-4) in `10ec3c6`: the control counts only `shared/` events and writes `src/a.uxdsl` on purpose; the original control failed 1 run in 40 with this event order, and the current one passed 67 of 67 at `6efd29e`.
  - For MIG-B9-22: its precondition `grep -q "'--first'\|first:" packages/uxdsl/bin/uxdsl.js` exits 1 against the registry form (`string: [..., 'first']`, and a help line that starts with two spaces and `--first`), while `node packages/uxdsl/bin/uxdsl.js generate-entry --help | grep -q -- --first` exits 0. Its other precondition, `Generated by uxdsl generate-entry`, still holds (header line 2 is unchanged).
  - For I3: the transition warning ends `see "Regenerate the entry" in the migration guide.`, so migration.md's item carries that title.
- **T10, parity (I2).**
  - Cases added, design 2's sources: `fixtures/parity/cases/sass-use-partial` (`entry.uxdsl` reads a variable and a mixin of `_tokens.uxdsl` through `@use './tokens' as t;` and `@use`s `_card.uxdsl`, which `@use`s the same module under its default namespace) and `fixtures/parity/cases/sass-nesting/entry.uxdsl` (a `//` comment, `&__title`, `&:hover`, `.icon &` and a nested `@media`, with tokens).
  - The four paths already agree on the base: in a scratch copy of `7aec3e0` (`git archive 7aec3e0 packages/uxdsl fixtures/parity tsconfig.base.json`, `npm ci`, `npm run build`), its `run.js` with the two cases exits 0, and the two oracles it writes are byte-identical to the ones recorded here. T10 is therefore an agreement pin, not a failing-first test. Its error oracles record A1's frame but do not guard it (corrected after review F1): `run.js` compares an error with its oracle by substring in both directions, so a CLI that prints the head line alone passes all ten cases. A1's frame is guarded by T1, T1b, T3 and S-4.
  - `node fixtures/parity/run.js --update` from the worktree root (exit 0), then `git diff fixtures/parity/expected`. Every hunk:
    1. `expected/import-cycle.json`: the head line `[uxdsl] Error: fixtures/parity/cases/import-cycle/cycle-b.uxdsl:1:9: UXD_SASS: This file is already being loaded.` is unchanged and is now followed by Sass's frame and stack, each line indented by two spaces: `1 │ @import "./entry.uxdsl";`, the caret line, `fixtures/parity/cases/import-cycle/cycle-b.uxdsl 1:9  @import` and `fixtures/parity/cases/import-cycle/entry.uxdsl 1:9    root stylesheet`.
    2. `expected/missing-import.json`: the head line `[uxdsl] Error: fixtures/parity/cases/missing-import/entry.uxdsl:1:9: UXD_SASS: Can't find stylesheet to import.` is unchanged and is now followed by `1 │ @import "./does-not-exist.uxdsl";`, the caret line and `fixtures/parity/cases/missing-import/entry.uxdsl 1:9  root stylesheet`.
    3. New `expected/sass-use-partial.json`: `.card { color: var(--uxdsl__palette__primary-main); margin: var(--uxdsl__space__2); }`, `.entry { padding: var(--uxdsl__space__2); display: flex; flex-direction: column; gap: var(--uxdsl__density__2); }`, then `@media (min-width: 768px)` holding `.entry { flex-direction: row; }`. The blank line after the `@media` brace is the plugin's existing raws, as in `vars-responsive`.
    4. New `expected/sass-nesting.json`: `.card`, `.card__title`, `.card:hover`, `.icon .card`, then `@media (min-width: 600px) { .card { padding: var(--uxdsl__space__4); } }`; the rules are flattened, the `//` comment is dropped, and there is no final newline.

    The six CSS oracles of the existing cases have no hunk.
  - `node fixtures/parity/run.js`: exit 0, 10 cases (3.6 s). `npm test`: exit 0 (148.4 s). The runner leaves one `uxdsl-parity-*` directory per case in `TMPDIR` (38 in mine after four runs), removed by hand.
- **The `UXD_FUNCTION_SHADOWED` capture (I2).**
  - Failing first: with the case added to `DIAGNOSTICS` and the script's single error branch, `node packages/playground-nextjs/scripts/capture-capabilities.js --check` exited 1 with `diagnostic case "A project @function named like a UXDSL function: the author's SCSS wins, with one warning (DEC-17)": expected UXD_FUNCTION_SHADOWED and a failing exit, got UXD_FUNCTION_SHADOWED (exit 0).`, followed by the warning line the CLI printed.
  - After the change, a case marked `warning: true` requires exit 0 and its code first on stderr, and error cases are checked as before. The capture records exit 0 and one line, `[uxdsl] Warning: src/example.uxdsl:1:11: UXD_FUNCTION_SHADOWED: @function space (src/example.uxdsl:1) replaces UXDSL's space() in this build; rename it to use the token`; `--check` exits 0, and `cli-captures.json` is unchanged.
  - A mismatch still throws, shown on three variants of the script piped to `node -` (nothing written): the warning case expecting `UXD_SASS_WARNING` (`expected UXD_SASS_WARNING and a passing exit, got UXD_FUNCTION_SHADOWED (exit 0)`); the `UXD_SASS` error case marked `warning: true` (`expected UXD_SASS and a passing exit, got UXD_SASS (exit 1)`); the warning case without its flag (`… expected UXD_FUNCTION_SHADOWED and a failing exit, got UXD_FUNCTION_SHADOWED (exit 0)`). These ran by hand at first. Since `64519d7` (review F6) the script runs four such mismatch controls before every capture, `npm test`'s `--check` included, and a mutant of its predicate fails `--check` with `the diagnostic check accepts UXD_SASS (exit 1) for a warning case expecting UXD_SASS`.
  - The served page: after `npm --prefix packages/playground-nextjs run build` (exit 0, 16.8 s), `next start` on a free 127.0.0.1 port answered `GET /docs/diagnostics` with 200. The catalog links `#capture-uxd_function_shadowed` (23 example links in all, one per captured code), the list carries that id, and the warning line is rendered. The server was stopped; no `next start` of the run is left.
  - Deviation: `src/app/docs/diagnostics/page.mdx` said every captured case shows "the error under it". Its heading and that sentence now say errors and warnings, and that the capture fails when a case stops producing its code or its exit. It is one file beyond the work plan's two, kept so that the page that shows the new case describes it. The capability matrix is unchanged (`npm run generate:capabilities`, then `node --test scripts/capability-matrix.test.js` 7 of 7).
  - `npm test`: exit 0 (143.6 s).
- **A6 and A7, the adapters (I3).**
  - Failing first, against the adapters of `4c34bb8`: `node --test --test-reporter=spec --test-name-pattern="MIG-B9-14" packages/uxdsl/test/vite/index.test.js` exited 1 with 2 failures. T6: the watch files and the map's `sources` (which pin what already held) passed, then `this.warn()` received `UXD_SASS_WARNING: [import] Sass @import rules are deprecated …` where `styles/_partial.uxdsl:1:9: UXD_SASS_WARNING: [import] …` was expected. The `sass`-option test: the load with `sass: { silenceDeprecations: ['import'] }` still reported the deprecation (`+ ['UXD_SASS_WARNING: [import] …'] - []`). The same command on `packages/uxdsl/test/webpack/loader.test.js` exited 1 with 2 failures: T7 at the located warning, after its `fileDependencies` assertions passed, and the `sass`-option test at the silenced build. T2c, extended to `src/vite.ts` and `src/webpack.ts`: `CompileConfig key(s) not forwarded by a host's compile() call: {"uxdsl/vite (src/vite.ts)":["sass"],"uxdsl/webpack (src/webpack.ts)":["sass"]}`; its negative control, extended to both adapters' call shapes, passed there, as a control does.
  - After the change: AC2 28 of 28 (24 before: T6, T7 and the two `sass`-option tests are new); `plugin-option-parity` 4 of 4. T7's recompile step first failed in 4 of 4 runs of the whole file, never alone: a build that still carried the old value arrived after the edit. The test now dates the files it writes ten seconds back before the watcher starts and waits for the build that carries the edit (each wait times out after 20 s); 6 of 6 runs of the file passed after that, T7 about 0.5 s.
  - `node fixtures/vite-adapter/run.js` exit 0 (Vite 5.4.21 and 7.3.7; both still print `note - … vite did not carry the .uxdsl source through to the emitted CSS map; support is NOT advertised`), `node fixtures/webpack-adapter/run.js` exit 0, the CLI suite exit 0 (59 s), `npm test` exit 0 (153 s). Commit `1c00ee3`.
  - A warning reaches Vite as `<file>:<line>:<column>: <text>`, the file relative to the root `configResolved` gives (the working directory before it), and webpack as the same text relative to `rootContext`; a warning without a position is its text alone, as in the CLI. Each adapter has its own five-line `formatWarning`, since a shared one would need a new `src` file or `compile.ts`.
- **A8 and the gate (I3).**
  - Failing first, T8: in a scratch copy of the fixture whose `pages/index.js` is the base `7aec3e0`'s, `next build` exit 0, then the new `browser.js` exit 1 with `the served page renders the CLI-built panel` (`['cli-panel', 'cli-panel-title', 'cli-panel-body']` missing); its `finally` stopped the server (no `next` process left). T9b: the S-4 verdicts on the base `7aec3e0`'s CLI (I2's scratch build of `git archive 7aec3e0`): `assertSassFramed` rejects with `no frame after the head line` (stderr was only `[uxdsl] Error: src/a.uxdsl:1:43: UXD_SASS: Undefined variable.`), `assertLocatedWarning` with `0 [import] warnings, expected 1`; on the tarball `fixtures/mig07-consumer` installs from this branch both accept (`src/a.uxdsl:1:43: UXD_SASS: Undefined variable., framed (5 lines)`; `the [import] deprecation at src/a.uxdsl:1:9`). The silenced case accepts on both, which is why S-4 also requires the deprecation without the option.
  - After: `npm run verify:cssmodules-build` exit 0 (25 s and 34 s), printing `PASS: the served next build renders the CLI-built styles/panel.generated.module.css: padding 16px, radius 8px, border and title rgb(37, 99, 235), title margin-bottom 8px, class panel_generated_panel__title__k6OTO, body rgb(0, 0, 0).` The module the installed CLI writes is 302 bytes (the CLI's line says 297, the string length, as MIG-B9-03 §2 noted), starts with `@charset "UTF-8";`, holds no `:root`, and Next accepts it in pure mode. `node --test fixtures/release-1.0/verdicts.test.js` 6 of 6. `npm test` exit 0 (153 s). Commit `5181edb`.
  - Deviation: the CLI's build config and theme file are in `fixtures/mig02-nextjs-cssmodules/uxdsl-cli/`, not at the fixture's root as the design placed them. `browser-import-order.js` compiles with `plugin({ includeTheme: true })` and the plugin's theme discovery from the fixture's root, so a `uxdsl.theme.cjs` there would have changed its theme without a sign: measured on the installed plugin, 47,346 → 46,915 bytes and `--uxdsl__palette__primary-main` from `var(--uxdsl__color__purple-700)` to `#2563eb`. `compile.js` runs `uxdsl build` in `uxdsl-cli/`, whose entries resolve from the config's directory.
- **Documentation (I3).** cli.md (the `generate-entry` row and subsection; `sass` among the config keys, with its refusals; "Next.js: CSS Modules written in `.uxdsl`"; Watch mode; Diagnostics), vite.md and webpack.md (the `sass` option, warnings; webpack's Options block gains `sourceMap`), the package README (links), the CHANGELOG (`### The CLI, Vite and webpack on the Sass pipeline (MIG-B9-14)` with `#### CLI`, `#### Adapters`, then `### Visual changes` and `### Breaking`), migration.md items 9 to 12 (item 9 is "Regenerate the entry", the title the transition warning names). `npm run verify:doc-examples`: 52 examples and 24 theme excerpts (51 before: cli.md's Next.js example, which has a `$gap:` line, compiles through `compile()`; the `@use` examples carry no UXDSL token). `docs-shape`, `version-mentions`, `docs-provenance` and `doc-examples` tests 29 of 29; `npm test` exit 0 (152 s). Commit `e51b775`. The double emission the CHANGELOG's Visual changes describe was measured first: a file listed by the entry and `@use`d by another listed file is emitted twice through an `@import` entry and once through a `@use` entry.
- **A10, Press Craftor (I3).** Recorded once, in `evidence/MIG-B9-03-press-craftor.md`, "On the superset pipeline" (commit `23c561e`): the after set rebuilt from `0c9fbf6` reproduces the seven sizes, its pack's shasum is MIG-B9-03's; this branch's tarball (packed at `e51b775`: 267,640 bytes, 92 files, shasum `f8ff8f14074a3ce024ba9307c2a3052e559b4bf6`) installs and builds with no warning, and `next build` passes; 175 rules differ, every one classified (Dart Sass's documented formatting, and the `calc()` class, finding 9 there); `/login` and `/help` give MIG-B9-03 §6's Chrome result on both builds; the static proxy pages of the six modules compute the same style for all 7,588 elements; the base `7aec3e0`'s CLI writes the same bytes as this branch's.
- **The acceptance criteria on the branch tip (I3).** At `23c561e`, run one after another in the background, each with its log, `TMPDIR` set to the implementer's scratch directory:
  - AC1 `node --test packages/uxdsl/test/cli/*.test.js`: exit 0, 239 of 239 (62 s).
  - AC2 `node --test packages/uxdsl/test/vite/*.test.js packages/uxdsl/test/webpack/*.test.js`: exit 0, 28 of 28 (3 s).
  - AC3 `node fixtures/parity/run.js`: exit 0, `PASS: 10 parity case(s) — CLI, compile(), and the Vite/Webpack adapters agree, matching the committed oracle.` (4 s).
  - AC4 `npm run verify:cssmodules-build`: exit 0 in Chrome 156.0.8078.80 (31 s), the served-page line above included.
  - AC5 `npm test`: exit 0 (197 s). `npm run verify:1.0 -- --skip-playground-walk`: exit 0, `69/69 automated checks passed.` (133 s), from `uxdsl-0.5.0-beta.9.tgz` (267,640 bytes packed, 92 files); S-1 to S-4 `ok` (S-4: `src/a.uxdsl:1:43: UXD_SASS: Undefined variable., framed (5 lines); the [import] deprecation at src/a.uxdsl:1:9; no [import] warning with sass.silenceDeprecations`), `cssmod` `ok` with its new title. Listed there, not run and not counted: B7-12 (manual), the owner's project (external), postpublish, and B7-17E (skipped by the flag, run next).
  - `npm run verify:playground-browser`: exit 0 (254 s): 19 routes × 2 schemes × 10 widths, 380 pages, 2,222 focusable elements, `PASS: no console errors, no UXDSL warnings, no unresolved var(), visible keyboard focus, contrast page = Node.`, its six negative controls caught.
  - After the runs: no `next start` and no `uxdsl … --watch` process of the run left, the worktree clean.
- **For §15 (I3).** Finding 9 of the MIG-B9-03 evidence file, the `calc()` that Dart Sass writes without `calc()` inside `min()`/`max()`/`clamp()` (9 declarations in Press Craftor, the same computed value in Chrome), goes to MIG-B9-15 or MIG-B9-52, since MIG-B9-13's CHANGELOG entry is append-only. The adapters print `UXD_FUNCTION_SHADOWED`'s text as `compile()` gives it, with the definition's absolute path inside (the CLI makes it relative through its own formatter): for the owners of the message (MIG-B9-21). Vite receives warnings as text: Rollup's `loc` object, which would add a frame in Vite's dev overlay, reports 0-based columns, unlike every other UXDSL entry point; and the adapters add no frame of their own to an error: both stay the owner flag the design wrote. A fresh install resolves Dart Sass 1.107.1 from the tarball's `^1.107.0`, while the repository tests 1.107.0; Press Craftor's seven files are byte-identical under both. The static-proxy harness saw one page load in 145 that read every element differently from two agreeing loads of the same page (a load-level race of headless Chrome); a future harness that hashes computed styles should load each page until two loads agree, as `pc-static-compare.js` does.
- **The review's fixes (four fixers, `10ec3c6` to `b209f61`).** Each fix was shown failing against the commit before it, in scratch roots holding that commit's CLI.
  - **Contract and tests.**
    - F2. Against `ec7d492`'s CLI, `watch-mode.test.js`'s new same-directory test failed in 3 of 3 runs (`one save, one build of b: … [uxdsl] add src/_x.scss … [uxdsl] unchanged out/b.css … 2 !== 1`), and the reviewer's scenario gave `{buildsOfB: 2, importWarnings: 2}`. After `10ec3c6` both give one build and one warning in 3 of 3 runs. The unit test failed on the old `follow()`, which returned `undefined`.
    - F3. Mutants that each remove one `followAll()` call passed the old watch tests (exit 0). The two new tests fail at the step each call guards (`waitFor timed out`).
    - F5. T3b's former filter fails in 3 of 3 runs on `change src/a.uxdsl`. A watcher that reports everything still fails the narrowed control.
    - F6. A mutant of the capture's predicate went unnoticed by `--check` (exit 0) before `64519d7`, and fails it afterwards (exit 1).
    - Results: CLI suite 243 of 243, and `npm test` exit 0 (191 s and 188 s).
  - **CLI behavior.** For each fix, the tests at HEAD were run against the CLI of the commit before it.
    - CLI-1, against `64519d7`: all three tests fail at their restore steps (`waitFor timed out`). Both watch files gave 27 pass and 3 fail in three runs. After `f3a3718`: 30 of 30, three times. Six mutants of the fix each fail at least one of the tests. The reviewer's scenarios that printed nothing after a restore now rebuild.
    - CLI-3, against `f3a3718`: the second entry's summary is missing. After `6774b73` it passes.
    - CLI-5, against `6774b73`: `@use './a\\b'` where `@use './a%5Cb'` was expected. After `6efd29e` the entry loads the file.
    - One verification run was invalid, not flaky: it overlapped a clamshell sleep, and `waitFor` measures `Date.now()`. It was re-run on 2026-11-06 with no sleep: 30 of 30, three times, and the CLI suite 248 of 248.
  - **Adapters and maps.**
    - F2. Against `6efd29e`'s loader, the new map test failed with sources holding the worktree's path. After `3208507` the map names `styles/_partial.uxdsl`, `styles/panel.uxdsl` and `shared/_far.uxdsl` from three working directories, and a lookup lands in the partial.
    - F4. The new S-5 and S-6 verdicts reject the base's adapters (unlocated, unsilenced, unknown key accepted) and `6efd29e`'s relative map sources. They accept the fix.
    - The first gate run with S-6 exited 1 (68 of 71): Vite's `resolveConfig` had set `NODE_ENV=production` in the gate process, so later `npm install`s omitted the tarball. `viteAdapterRecord` now restores `process.env`, and the S-6 accepting test asserts it. Without the restore that test fails with `actual: production`. The second run passed, 71 of 71 (110 s).
    - Battery before each commit: adapters 30 of 30, CLI 248 of 248, `npm test` exit 0 (196 s and 188 s).
  - **Docs, guards and evidence.**
    - The documented claims were encoded as scratch tests and failed against `51ac1c9`'s CLI: a namespaced `@use` giving the project function, a nested `main.uxdsl` listed, `--src styles` writing `src/`, and the scan of `.` without `src/`.
    - The new tests (`uxdsl-cli.test.js`: the same-name exclusion, T4c's `namespace` fragment) failed on the old message and the old warning. The namespaced-`@use` pin passed there, as a pin of unchanged behavior does.
    - After `1a67e88`: CLI 250 of 250, `npm test` exit 0 (191 s). After `b209f61`: `npm test` exit 0 (189 s). `capture-capabilities.js --check` was stale until the title's `(DEC-17)` capture was regenerated.
- **The mutation re-review and its fix (`f4e8756`).**
  - 24 mutants of the fixes, built in APFS clones of a copy of the package at `b209f61`, with `TMPDIR` its own. 23 were killed by the fixes' tests, the capture check or the gate's verdicts.
  - F2_ARGFULL survived: `followAll()` called without its start time after a full rebuild. The CLI suite passed 250 of 250 on it, while a scenario showed the double build in 3 of 3 runs.
  - After `f4e8756` it fails the new full-rebuild test (`2 !== 1`). ARGSEL, NODROP, NOKEEP, NOMARGIN, NOFORGET and M3 each fail at least one of the new or extended tests. With the save step's assertions removed, the unchanged-event step alone fails ARGFULL, ARGSEL and NODROP.
  - At `f4e8756`: CLI 252 of 252 (95 s), `npm test` exit 0 (196 s), parity 10 cases, adapters 30 of 30, core 336 pass and 1 skipped.
  - Two notes from the re-review, for later runs. Watch runs that overlapped the laptop's clamshell sleep were discarded and re-run under `caffeinate -s -i` on AC power. The `uxdsl theme` reproduction of RR-3 used the base CLI from I2's scratch build of `7aec3e0`, whose `bin/uxdsl.js` is byte-identical to `git show 7aec3e0:packages/uxdsl/bin/uxdsl.js`.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- A5: `uxdsl init` for Next.js does not write `@uxdsl theme;` today; `POSTCSS_SNIPPET` passes `includeTheme: false` (bin/uxdsl.js:1814). Correct the claim and say which story adds the marker.
- A4: `@use` isolates variables. Today `@import` inlining shares `$vars` across files (that is why `PRIORITY_PATTERNS` lists `variables` and `theme-def`); with `@use … as ns` a shared variables file breaks. Document it, test it, and reconsider the generated entry.
- A1: see MIG-B9-12 — the code frame must show the author's text, not the protected text.
- The baseline reads another agent's worktree; use repository files only.

### Applied before implementing (2026-11-03)

Applied by the first implementer before any code, as README §1 item 4 requires, on the base `7aec3e0`. The contract (§5) and the acceptance criteria (§9) are not edited: where the review corrects a claim of the contract, the reading the implementation follows is stated here.

- **§3 Preconditions.** All four exit 0 on `7aec3e0` with `/usr/bin/grep`. P2 exits 1 only when `grep` is this session's zsh function, which runs ugrep with `--ignore-files` and reads the `$` in the middle of the pattern as an anchor; `/usr/bin/grep` (BSD grep 2.6.0) matches `bin/uxdsl.js:1670`. The line is not stale; the preconditions are run with `/usr/bin/grep`.
- **§4 Baseline (review item 4: repository files only).** The line read another agent's worktree and wrote a fixed `/tmp/ge`. Old line:

  ```bash
  cd /tmp && rm -rf ge && mkdir -p ge/src/components && cd ge && printf '.a{color:red}' > src/components/card.uxdsl && printf '.b{color:blue}' > src/card.uxdsl && node /Users/ricardosantoyo/Documents/projects/uxdsl/.claude/worktrees/agent-acc09a777d09819dc/packages/uxdsl/bin/uxdsl.js generate-entry --src ./src && cat src/uxdsl-entry.uxdsl
  ```

  New line, run from the worktree root with this repository's CLI:

  ```bash
  cli="$PWD/packages/uxdsl/bin/uxdsl.js" && d="$(mktemp -d "${TMPDIR:-/tmp}/ge.XXXXXX")" && mkdir -p "$d/src/components" && printf '.a{color:red}' > "$d/src/components/card.uxdsl" && printf '.b{color:blue}' > "$d/src/card.uxdsl" && cd "$d" && node "$cli" generate-entry --src ./src && cat src/uxdsl-entry.uxdsl   # from the worktree root
  ```

  The template is explicit because macOS `mktemp` ignores `TMPDIR` without one. On `7aec3e0` it exits 0 and prints `[uxdsl] Generated entry file at src/uxdsl-entry.uxdsl with 2 imports.` and the two recorded `@import` lines. The recorded consequences (a namespace collision under `@use` with default namespaces, two `[import]` deprecations under `@import`) were re-verified, so the "Recorded:" paragraph is unchanged.
- **A5 (review item 1).** A5's "the Next.js variant is unchanged (PostCSS path, `@uxdsl theme;`)" is read as corrected: `uxdsl init` for Next.js writes no `@uxdsl theme;` today, and `POSTCSS_SNIPPET` passes `'uxdsl/postcss': { includeTheme: false }` (`bin/uxdsl.js:1814`). This story leaves that PostCSS path as it is. MIG-B9-20, under DEC-06, writes the marker in the Next.js scaffold and drops `includeTheme: false` from the snippet. The Next.js init writes the same generated entry as the single scaffold, so that entry uses `@use` like the others. The `--multi` scaffold's entries import nothing today (`theme.uxdsl` is a comment, `panel-a.uxdsl` one rule), so "the `--multi` scaffold's entries use `@use`" holds vacuously; T5 asserts that no scaffolded `.uxdsl` file contains `@import`.
- **A4 (review item 2).** `@use` isolates variables, where `@import` shared `$variables`, mixins and functions across the entry's files (the reason `PRIORITY_PATTERNS` lists `variables` and `theme-def`). Under a generated `@use … as <namespace>` entry each listed file is its own Sass module:
  - a file that reads another listed file's `$variable`, mixin or placeholder fails loudly as `UXD_SASS`;
  - three cases change the output without an error: a call to another file's `@function` stays in the CSS as written, a `!default` set by an earlier listed file no longer applies, and a project `@function` named like a UXDSL function (DEC-17) no longer shadows the token in the other files.

  The entry is reconsidered within A4 and keeps `@use … as <namespace>`: no entry shape restores sharing, because Sass refuses `@use` after any other rule and an `@import`ed file would still not share with the `@use`d modules. The change is documented (cli.md, migration.md, the CHANGELOG's "Breaking"), tested by T4b against an `@import`-entry negative control, and announced by one warning when `generate-entry` replaces an entry that listed its files with `@import` (T4c). An owner flag offers the alternatives (an `--import` escape hatch for one release, or detecting an unresolved project `@function` call, which needs `compile-sass.ts` and a new catalog code), and another records that `PRIORITY_PATTERNS`, kept as A4 says, now only orders the output.
- **A1 (review item 3).** The code frame shows the author's text, never the protected text. The CLI prints `error.sassFrame`, which the Sass stage redraws with the author's text and columns, and never `error.cause.message`, which shows protect's `#{"palette(…)"}`. The frame is chosen by `error.code === 'UXD_SASS'`, since `diagnosticCode()` returns `undefined` for a message that starts with a location (MIG-B9-12 flag 13). T1's negative control compiles `.a { color: palette(primary.main); border-color: color(gray.300); width: $nope; }` in-process, asserts that `error.cause.message` contains `#{`, then asserts that the CLI prints `palette(primary.main)` in the frame with the caret under `$nope` (column 74) and no `#{` anywhere on stderr.

### Delivery of 2026-11-06

Written by the deliverer with PR #71. It records new facts, the owner flags, Shares as delivered, the MIG-B9-12 and 13 flags this story touched, and the follow-ups, each with the story proposed for it. The owner decisions of 2026-11-04 settle MIG-B9-12's flag 13, as delivered here (D19). They accept MIG-B9-13's flags 2 to 5, 7, 9 and 11 to 19 as delivered (D18). They keep flag 14's proposed CLI warning with this story (D18), which owner flag 12 below answers.

**New facts.**

1. **`feat/beta9` moved during the run.** On 2026-11-06 `origin/feat/beta9` had moved from `7aec3e0` to `b2a7206` (PR #64 and PR #65, documentation only). It is merged into this branch as `7691b0c`; §14 says how.
2. **#52 and #59 are merged.** Dependabot's #52 (`playwright-core` in `fixtures/mig02-nextjs-cssmodules`) and #59 (the playground's minor-and-patch group) were merged into `main` by the owner on 2026-11-06, at 20:40 and 20:41 UTC (`gh pr view`: `MERGED`). Decision D15 is done. `feat/beta9` is not affected; it gets them when `main` is merged into it.
3. **Sass resolved by a fresh install.** A fresh install of this branch's tarball resolves Dart Sass 1.107.1 from `^1.107.0`, while the repository tests 1.107.0. Press Craftor's seven files are byte-identical under both.
4. **Byte counts.** The CLI's `[uxdsl] built <file> (<n> bytes)` counts characters, not bytes. The Next.js fixture's module is 302 bytes on disk, and the CLI reports 297. This predates the story (MIG-B9-03 §2 noted it).
5. **Temporary directories left by the suites.** Every run of the suites leaves directories in `TMPDIR`: `uxdsl-sass-stage-*` (984 of 1,814 entries after one fixer's battery), `uxdsl-cli-watch-*`, `uxdsl-parity-*`, and `uxdsl-gate-verdicts-*`, two more per run since S-5 and S-6. This story's new watch tests add to the second kind. This is for MIG-B9-25.
6. **Clamshell sleep.** The laptop sleeps when its lid closes on battery. A watch suite running across that sleep fails as `waitFor timed out`, because `waitFor` measures `Date.now()`. One fixer's run was invalidated this way and re-run. Watch suites on this machine should run under `caffeinate -i -s` on AC power.
7. **Headless Chrome.** It once read every element of a page differently from two agreeing loads of the same page (1 load in 145). A harness that hashes computed styles should load each page until two loads agree, as Press Craftor's `pc-static-compare.js` does.
8. **The playground's build.** `npm --prefix packages/playground-nextjs run uxdsl:build` took 2.28, 2.21 and 2.19 s on `7691b0c`, against the scout's 2.96, 2.26 and 2.30 s at the base. It now prints its 17 warning lines, and its CSS is unchanged.
9. **Two stray directories.** A scout's `mktemp -d`, run before the run found that macOS's `mktemp` ignores `TMPDIR` without a template, left two directories in the owner's temporary directory: `/var/folders/kv/gp_3sskx7kb8vy0d00hyjgpr0000gn/T/tmp.0nbDnSY0o4` and `tmp.fvSbHnaRNH`. Each holds `src/card.uxdsl`, `src/components/card.uxdsl` and `src/uxdsl-entry.uxdsl`. The run's rules forbid deleting anything there, so the owner may remove them.
10. **Story ids in `bin/uxdsl.js`.** Comments carrying a story id fell from 67 lines to 43: every comment this story touched was rewritten to describe behavior. No added line carries a story id. `vite.ts`, `webpack.ts` and `types.ts` carry none.

**Owner flags.**

1. **A4: the namespace basis.** Implemented as A4 reads: the path relative to the entry. An entry above its files therefore gets names like `f----components-agentguidance`, and the playground's components all look like that.
   - Alternatives: the path relative to `--src` (`components-agentguidance`, a one-line change), or `as *`. A generated entry references no member, so `as *` meets no conflict there.
2. **A4: "without extension".** A `.scss` or `.sass` twin beside a `.uxdsl` file, as in DEC-00's copy-then-rename path, makes the generated `@use './x'` hit Dart Sass's `It's not clear which file to import`.
   - Writing `@use './x.uxdsl' as x;` would avoid it. Implemented as written.
3. **A4 review item: isolation's silent cases.** These compile differently without an error:
   - a call to another file's `@function` stays in the CSS as written;
   - a value an earlier file set for a variable declared `!default` elsewhere no longer reaches it;
   - a project `@function` named like a UXDSL function no longer replaces the token in the other files.

   Review DGE-1 adds a fourth: under a file's own namespaced `@use`, a bare function call stays in the CSS too. Delivered: the documentation, T4b and its `@import` control, the namespaced-`@use` pin, and the warning at generation.
   - Options: an `--import` escape hatch for one release, or detection of an unresolved project-`@function` call. Detection needs `compile-sass.ts` and a catalog code, and is proposed with MIG-B9-26.
4. **`PRIORITY_PATTERNS`.** It lists `variables` and `theme-def` because `@import` shared one scope. Under `@use` they only order the output, and listing `_variables` first breaks a `@use … with (…)` configuration made in another file, loudly. T4b pins that, and `--first` fixes it.
   - The owner may drop the two patterns; A4 keeps the heuristic.
5. **A1 in watch mode, read literally.** The first build of a watch session prints `[uxdsl] build failed:`, where it printed `[uxdsl] Error:`. MIG-B6-23's missing-partial test now waits for `/UXD_SASS|error/i`.
6. **A2's "prints once".** It is read as:
   - once per build for a line with a file;
   - once per entry for a line without a position;
   - again on every rebuild.

   Until MIG-B9-22 and MIG-B9-43 clear them, the playground's watch prints its 17 warning lines on every rebuild of its entry.
   - The alternative is once per process.
7. **Located adapter warnings.** They are delivered as text, `<file>:<line>:<column>: <text>`, which goes beyond A6 and A7's wording.
   - Not done: Rollup's `loc` object, which would frame the warning in Vite's dev overlay but reports 0-based columns, and frames of the adapters' own on an error.
8. **The `sass` refusals beyond A2, and A9.** The CLI also refuses `builds[i].sass` and a top-level `silenceDeprecations` or `quietDeps`. Other unknown top-level keys stay accepted, and a generic check is proposed below.

   The refusals sit in `loadConfig`, so they reach `uxdsl theme`. Three configs that the base `7aec3e0` accepted now make `uxdsl theme` exit 1, where it used to print the theme (14,571 bytes):
   - `sass: 'x'`;
   - `sass: { bogus: 1 }`;
   - a top-level `quietDeps: true`.

   That departs from A9 ("`uxdsl theme` is unchanged") and from §5's byte-identical list. A valid `sass` key gives the base's bytes, and `sourcemap: 'External'` was already refused at the base. No test pins either outcome.
   - Option (a): keep the refusal, with a test of `uxdsl theme`'s exit and message, and one for `sourcemap`.
   - Option (b): skip the `sass` checks when only the theme is printed, with a test that the output equals the base's.
9. **T9 beyond its wording.** It gains S-4, the installed CLI's frame and warnings, because README §3 asks for a tarball check of every change a consumer sees and S-3 covers only the PostCSS frame. After review adapters F4 it also gains S-5 and S-6, the installed adapters.

   S-5 and S-6 drive the installed `uxdsl/webpack` and `uxdsl/vite` with the repository's webpack 5.111.1, css-loader 7.1.5, MiniCssExtractPlugin 2.10.2 and Vite 7.3.7, named as instruments under the gate's rule 1. A consumer-style install of the bundlers stays with N-03 and N-04.
   - Accept, or ask for registry installs inside S-5 and S-6.
10. **T10 cannot prove A1 inside this story's Owns.** `fixtures/parity/run.js` accepts an error oracle when either string contains the other (`run.js:150`), so the frame recorded in `missing-import.json` and `import-cycle.json` is not guarded. A CLI with no frame passes all ten cases; this was reproduced twice.

    A1 is guarded by T1, T1b, T3 and S-4. `run.js` is MIG-B9-20's (§7), and design Q8 kept it unchanged.
    - Route a strict comparison to MIG-B9-20, or accept T10 as an agreement pin.
11. **Warnings lost when `compile()` throws.** `error.warnings` does not exist, so every host loses the warnings produced before a failure. That includes a Dart Sass deprecation printed before a UXDSL error. The CLI's printer is ready for it.
    - Proposed for MIG-B9-21: `compile.ts` and `compile-sass.ts`.
12. **MIG-B9-13's flag 14, kept with this story by D18.** The proposed CLI warning, for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the output, is not implemented. It needs a new catalog code, and §10 says "`DIAGNOSTIC_CATALOG`: no" for this story.
    - Proposed: MIG-B9-38 below. Alternatively the owner amends §10 and it is added here.
13. **MIG-B9-13's flag 4.** The CLI writes `compile()`'s bytes as they are: no final newline, and `@charset` where Dart Sass writes it. T8 shows Next.js accepting and rendering a CLI-built module that starts with `@charset`. In Press Craftor's `next build`, Next's minifier keeps one `@charset`, at offset 0 of one chunk, and drops the others.
14. **A5's `--multi`.** "The `--multi` scaffold's entries use `@use`" holds vacuously: those entries import nothing. T5 asserts that no scaffolded file holds `@import`.
15. **A3's full-rebuild fallback.** "Creating the file triggers a full rebuild" holds only where a `watch` pattern matches the new file. Dart Sass reports no candidate paths, so a missing `.scss` partial under the default `**/*.uxdsl`, or one outside every pattern, is noticed at the next save of a watched file.

    A file written within 100 ms of the build that first loads it may build its entry twice (2 s on a file system with whole-second times). That margin keeps an edit made during the build from being dropped (RR-2).

    Both are documented in cli.md's Watch mode.
16. **The adapters after a failed compile.** This predates the story (measured identical at `7aec3e0`) and is documented, not fixed (design X5).
    - `uxdsl/webpack`: after a failed compile it watches only the module's own file. Fixing a broken partial, or re-creating a deleted one, rebuilds only when the module is saved.
    - `uxdsl/vite`: a partial that the failing load was the first to load stays out of the module graph, so fixing it sends no update.

    The reviewer measured fixes on webpack 5.112.2 and on Vite 5.4.21 and 7.3.7:
    - webpack: keep the last successful dependencies per resource, and re-add them and `err.file` in the catch;
    - Vite: map `err.file` to the failing module in `handleHotUpdate`, or in `hotUpdate` on Vite 7.
    - Proposed: MIG-B9-39 below, or MIG-B9-21 if `compile()` should put the files Dart Sass loaded on its error.
17. **`generate-entry`'s exclusion by file name.** This predates the story. Every `.uxdsl` file with the entry's file name is left out, in any directory under `--src`, without a message. A4 ("the excluded output file rule stays") and design Q4 keep the rule. It is now documented, named by `--first`'s message and pinned (review DGE-2).
    - Options: keep it; exclude only the output file itself; or print one line per file left out for its name.
    - MIG-B9-20's plan excludes its generated `uxdsl-theme.uxdsl` "like the entry itself", which by this rule would also drop any other `uxdsl-theme.uxdsl`.
18. **Shares as delivered, and §7.** This story edited files outside its header's Owns and Shares, because §10, T9, T10 and AC5 need them:
    - in `packages/playground-nextjs`: `scripts/capture-capabilities.js`, `capability-fixtures/cli-project/src/main.uxdsl`, `src/generated/cli-captures.json` and `compiler-captures.json` (regenerated by the script only), `src/app/docs/tooling/page.mdx` and `src/app/docs/diagnostics/page.mdx`;
    - `docs/architecture/playground-capability-matrix.md`, regenerated;
    - in `fixtures/parity`: `cases/sass-use-partial/**`, `cases/sass-nesting/**`, and `expected/{sass-use-partial,sass-nesting,missing-import,import-cycle}.json`;
    - `fixtures/mig-b2-03-cli-init/run.js`;
    - `fixtures/release-1.0/verdicts.test.js`;
    - `packages/uxdsl/docs/integrations/{cli,vite,webpack}.md` and `packages/uxdsl/docs/migration.md`;
    - the FEAT-010 index row.

    Within its Owns it also touched `fixtures/mig02-nextjs-cssmodules` beyond "one new entry": `browser.js`, `compile.js`, `run.js`, `README.md`, `pages/index.js`, `.gitignore`, and the new `uxdsl-cli/` directory.

    §7 omits this story for several files it touched, so serialize these after this PR:
    - MIG-B9-34 and 36 on `fixtures/mig02-nextjs-cssmodules/browser*.js`;
    - MIG-B9-31, 33 and 34 on `fixtures/parity/expected/**`;
    - wave 3's stories on `packages/playground-nextjs/**`;
    - MIG-B9-21 on the comments of `bin/uxdsl.js`, `vite.ts` and `webpack.ts`. §7 does not list 21 for `bin/uxdsl.js`, although 21 shares those comments.

    MIG-B9-25 already waits for this story on `packages/uxdsl/test/cli/**` (§5).

**MIG-B9-12's and MIG-B9-13's flags this story touched.**
- **MIG-B9-12 flag 13, settled here (D19):**
  - `error.code` is read;
  - `sassFrame` is printed after the message line;
  - an unknown or misplaced `sass` key is a config error;
  - a top-level `silenceDeprecations` or `quietDeps` is refused in `uxdsl.config.cjs`.

  `compile()` itself still ignores a top-level `silenceDeprecations` silently: MIG-B9-21.
- **MIG-B9-13 flag 4:** owner flag 13 above.
- **MIG-B9-13 flag 6 (D6):** A8's module puts no `$variable` in a custom property.
- **MIG-B9-13 flag 11:** positions are printed as `compile()` gives them; T1 and S-3 pin `heavy.uxdsl:18:66`.
- **MIG-B9-13 flag 13:** A8 uses `.module.uxdsl`.
- **MIG-B9-13 flag 14:** owner flag 12.
- **MIG-B9-13 flag 16:** RussianDoll is still emitted twice under a `@use` entry, because `app.uxdsl` keeps its own `@import`; that is MIG-B9-22's E5.
- **MIG-B9-13 flag 18:** owner flag 18.

**Follow-ups, each with its proposed story.**

- **MIG-B9-20.**
  - Compare error oracles exactly in `fixtures/parity/run.js`, or at least require `actual.error.includes(expected.error)`, and encode the head-line-only control (owner flag 10).
  - `fixtures/webpack-adapter`'s flat layout and its `endsWith('panel.uxdsl')` check could not see webpack's map defect; move its panel into a subdirectory.
  - `excludedFiles` matches by file name (owner flag 17).
- **MIG-B9-21.**
  - `error.warnings`, and the files Dart Sass loaded, on the error `compile()` throws (owner flags 11 and 16).
  - `compile()` silently ignores a top-level `silenceDeprecations`.
  - The `sass` shape is spelled twice: `types.ts` writes it, and a tsc test pins it equal to `CompileConfig['sass']`. Importing it from `compile.ts` fails the playground's type-check on `compile.ts`'s `import uxdslPlugin = require('./plugin')`.
  - `UXD_THEME_FAMILY`'s message reaches `compile()`'s warnings without its code or path, and the CLI skips it there to keep one line per process.
  - The adapters print `UXD_FUNCTION_SHADOWED` with the definition's absolute path; the CLI makes it relative.
  - A generic unknown-key check for `uxdsl.config.cjs`, or in MIG-B9-60's doctor.
- **MIG-B9-22.**
  - Its precondition `grep -q "'--first'\|first:" packages/uxdsl/bin/uxdsl.js` exits 1 against the registry form of the flag. `node packages/uxdsl/bin/uxdsl.js generate-entry --help | grep -q -- --first` exits 0.
  - With its `--first` list, `generate-entry` reproduces `scripts/generate-uxdsl-entry.js`'s 41-line order (an empty diff, §14). The playground's own generator, its 5 `[import]` warnings and RussianDoll stay its E4 and E5.
- **MIG-B9-25.** The directories the suites leave in `TMPDIR` (fact 5), these two included: `watch-mode.test.js`'s `uxdsl-cli-watch-*` and `verdicts.test.js`'s `uxdsl-gate-verdicts-*`.
- **MIG-B9-26.** Detect an unresolved call of a project `@function`, the silent isolation case of owner flag 3. It is the same files and the same kind of warning as its dotted near-misses and `@debug`. The CLI now prints `compile()`'s warnings, which D5 waits for.
- **MIG-B9-15, or MIG-B9-52 for the CHANGELOG and migration notes.**
  - Finding 9 of the MIG-B9-03 evidence file: Dart Sass writes a `calc()` inside `min()`, `max()` or `clamp()` without `calc()`. MIG-B9-13's CHANGELOG entry is append-only.
  - `AGENTS.md`'s list of config keys lacks `sass`; D5's rewrite of that paragraph.
  - vite.md's "No SCSS pre-pass".
- **MIG-B9-43, or MIG-B9-40.** `DemoColors.uxdsl:104`'s 11 color-interpolation warnings.
- **MIG-B9-28.** Windows: the new watch tests, `follow()`'s directories, and webpack's absolute map sources, which `path.resolve` gives a drive letter.
- **MIG-B9-38, new.** "A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS". S, wave 3, depends on 14 and 22 (`bin/uxdsl.js`).
  - It answers MIG-B9-13's flag 14 (D18) with one new catalog code.
  - The byte count of `[uxdsl] built … (<n> bytes)` (fact 4) can ride along.
- **MIG-B9-39, new.** "Every host's watch recovers after a failed compile". Wave 3, S or split by its scout, depends on 14, 21 and 22. It covers:
  - the adapters' recovery (owner flag 16), with the reviewer's measured patches;
  - adapters' error frames (Vite's `err.loc` and `err.frame`, webpack's message);
  - the CLI watch's gaps that predate this story:
    - the queued selective batch that runs outside the `building` flag;
    - a glob root or plain `watch` path that holds no followed file, which is not watched again once deleted and re-created;
    - a file modified during the build that first loads it, after Dart Sass read it, which chokidar then discovers without an event;
    - a missing partial created where no pattern matches (owner flag 15).

### Owner decisions of 2026-11-08

The owner decided the flags of "Delivery of 2026-11-06" above on 2026-11-08. The owner was given numbered recommendations, in Spanish, on this story's 18 owner flags and on MIG-B9-15's, and answered, verbatim, "todo como recomendado" ("everything as recommended"): each recommendation is the owner's decision of 2026-11-08, recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-08). This record is in English and gives the answer to every owner flag of this story. Where they differ from this story's contract, they rule.

- **Flag 1, the namespace basis:** `generate-entry` computes each namespace from the path relative to `--src`, not to the entry (today, relative to the entry, the playground gets names like `f----components-…`). MIG-B9-22 does it.
- **Flag 2, "without extension":** `generate-entry` writes the extension in each `@use` (`@use './x.uxdsl'`), so a `.scss` twin beside a `.uxdsl` file is not ambiguous. MIG-B9-22 does it.
- **Flag 3, isolation's silent cases:** MIG-B9-26 detects them: another file's `@function` called, a `!default` set by an earlier file, a project `@function` shadowing a token, and a bare call under a namespaced `@use`.
- **Flag 4, `PRIORITY_PATTERNS`:** `PRIORITY_PATTERNS` (`variables`, `theme-def`) is removed, since it now only orders the output and listing `_variables` first can break a `with (…)` configured elsewhere. MIG-B9-22 does it.
- **Flag 5, A1 in watch mode:** accepted as delivered: the first failure of a watch session prints `[uxdsl] build failed:`.
- **Flag 6, A2's "prints once":** accepted as delivered: warnings are printed again on every rebuild.
- **Flag 7, located adapter warnings:** accepted as delivered, located as text.
- **Flag 8, the `sass` refusals beyond A2, and A9:** the refusals that reach `uxdsl theme` are kept, and MIG-B9-22 pins them with a test.
- **Flag 9, T9 beyond its wording:** accepted as delivered, with the gate's extra S-4 to S-6.
- **Flag 10, T10:** a strict comparison of error oracles in `fixtures/parity/run.js`, whose line 150 compares by substring in both directions, goes to MIG-B9-20.
- **Flag 11, warnings lost when `compile()` throws:** `error.warnings` goes to MIG-B9-21.
- **Flag 12, MIG-B9-13's flag 14:** MIG-B9-38 is registered as proposed in the follow-ups above, "A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS" (S, wave 3, depends on MIG-B9-14 and 22), with one new catalogued code. It answers MIG-B9-13's flag 14 and moves to MIG-B9-38 the warning that decision D18 of 2026-11-04 kept with this story, which did not implement it.
- **Flag 13, MIG-B9-13's flag 4:** accepted as delivered: the CLI keeps `compile()`'s bytes.
- **Flag 14, A5's `--multi`:** accepted as delivered: the `--multi` scaffold uses `@use` vacuously.
- **Flag 15, A3's full-rebuild fallback:** accepted as delivered, with its documented limits.
- **Flag 16, the adapters after a failed compile:** MIG-B9-39 is registered as proposed in the follow-ups above, "Every host's watch recovers after a failed compile" (wave 3, S or split by its scout, depends on MIG-B9-14, 21 and 22): the adapters re-register the last good dependencies and `err.file`. It also owns the flaky watch-mode test that failed on CI's ubuntu runner for PR #71 and PR #72 (`waitFor timed out`), and the occasionally stale `cli-captures.json` `--check` (MIG-B9-15 §15).
- **Flag 17, `generate-entry`'s exclusion by file name:** `generate-entry` excludes only the output file, instead of every file with the entry's file name in any directory. MIG-B9-22 does it; it matters for MIG-B9-20's `uxdsl-theme.uxdsl`.
- **Flag 18, Shares as delivered:** accepted as delivered, with MIG-B9-21, 31, 33, 34, 36 and wave 3's playground stories serialized after PR #71.
