# MIG-B9-14 — The CLI, Vite and webpack on the new pipeline

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided) |
| Status | In progress |
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

To be filled in the delivering PR.

### Notes for the closure record (draft)

Appended by each implementer in its own commits; the deliverer turns them into the record once (DEC-16). Environment: macOS, Node 20.19.0, npm 11.21.1, Dart Sass 1.107.0, `TMPDIR` set to a scratch directory of the implementer's own.

- **A1, errors (I1).**
  - Failing first, against the unchanged CLI of `ca31f13`: `node --test --test-name-pattern="MIG-B9-14" packages/uxdsl/test/cli/error-location.test.js packages/uxdsl/test/cli/watch-mode.test.js` exited 1 with 3 failures. T1: stderr was only `[uxdsl] Error: src/a.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import.\n`, with no frame. Its negative control: no frame line for line 1 (`undefined`). T1b: `waitFor timed out`, because the first build of the watch session printed `[uxdsl] Error: …` with no frame. After the change, the same command exits 0.
  - T11: the MIG-B6-23 missing-partial test, with its former `/error/i` wait, run against the new CLI: `waitFor timed out`, since the first watch build prints `[uxdsl] build failed: … UXD_SASS: Can't find stylesheet to import.` and Sass's frame, neither of which contains "error". With `/UXD_SASS|error/i` it passes.
  - `node --test packages/uxdsl/test/cli/*.test.js`: 221 tests, 221 pass (45.3 s). `npm test`: exit 0 (132.8 s). `npm run verify:doc-examples`: exit 0.
  - Captures, regenerated by the script after `uxdsl:build` (`--check` exit 0): the `UXD_SASS` diagnostic's stderr gains Sass's five frame lines, and the watch transcript's error step gains PostCSS's frame (`> 5 |   gap: density(4) xxl(2rem);`, six lines).

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
