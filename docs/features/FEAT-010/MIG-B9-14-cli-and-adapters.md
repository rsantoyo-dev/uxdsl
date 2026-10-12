# MIG-B9-14 — The CLI, Vite and webpack on the new pipeline

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided) |
| Status | Ready |
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
cd /tmp && rm -rf ge && mkdir -p ge/src/components && cd ge && printf '.a{color:red}' > src/components/card.uxdsl && printf '.b{color:blue}' > src/card.uxdsl && node /Users/ricardosantoyo/Documents/projects/uxdsl/.claude/worktrees/agent-acc09a777d09819dc/packages/uxdsl/bin/uxdsl.js generate-entry --src ./src && cat src/uxdsl-entry.uxdsl
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

## 15. Findings and follow-ups

None yet.
