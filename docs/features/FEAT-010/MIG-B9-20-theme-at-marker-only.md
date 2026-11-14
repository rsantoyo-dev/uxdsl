# MIG-B9-20 — The theme is written where `@uxdsl theme;` is

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | DEC-06 (decided 2026-10-23: the marker is the only switch; `includeTheme` is removed) |
| Status | Merged (PR #88) |
| Size | M |
| Depends on | MIG-B9-14 |
| Blocks | MIG-B9-50, MIG-B9-60, MIG-B9-64 |
| Base | `feat/beta9` at `f855765` (after MIG-B9-14, 15, 22, 23 and the owner decisions of 2026-11-09) |
| Owns | `packages/uxdsl/test/include-theme.test.js` (deleted; its intents move to `theme-marker.test.js`), `packages/uxdsl/test/theme-marker.test.js` |
| Shares | `packages/uxdsl/src/{plugin,compile,config,types,vite,webpack,diagnostics}.ts`, `packages/uxdsl/bin/uxdsl.js`, `packages/uxdsl/test/**`, `packages/uxdsl/README.md`, `packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/docs/{migration.md,agent-guide.md (generated),integrations/{cli,compile,vite,webpack}.md}`, `fixtures/release-1.0/{run.js,verdicts.test.js}`, `fixtures/{mig02-nextjs-cssmodules,mig07-consumer,webpack-adapter,vite-adapter,mig-b2-03-cli-init}/**`, `fixtures/parity/run.js`, `fixtures/sass-corpus/{run.js,run.test.js}`, `fixtures/mig-b9-23-compile-budget/run.js`, `fixtures/mig-b9-13-compile-on-sass/browser.js`, `scripts/lib/doc-examples.js`, `scripts/bench-references.js`, `packages/playground-nextjs/{.stylelintrc.json, paradigm/frame.uxdsl, runtime-sandbox/sandbox.uxdsl, scripts/{build-paradigm-frame,build-runtime-sandbox,capture-capabilities,capture-examples}.js, capability-fixtures/cli-project/src/**, src/app/{uxdsl-entry.uxdsl,uxdsl-theme.uxdsl (new),uxdsl.css}, src/generated/*.json, src/components/WriteGet.tsx, src/app/docs/{quick-start/page.mdx,tooling/page.mdx,language/page.tsx}}`, `docs/architecture/{unified-engine-audit,playground-capability-matrix}.md`, `AGENTS.md` |
| Output impact | **breaking** (API/CLI): `includeTheme` option, config key and flags removed; a project without the marker emits no theme |

## 1. Goal

One way to say where the theme CSS goes: `@uxdsl theme;`, written once, in
the stylesheet that defines the tokens. Every other compiled file carries
only its own rules, so a Vite or webpack component module is 44 bytes, not
47 kilobytes.

## 2. Sources

- DEC-00: "Una sola fuente de verdad y una sola forma de actualizar este CSS".
- Measured (README §9): a one-rule module compiles to 47,273 bytes with the
  default `includeTheme` and 44 bytes without the theme; the Vite plugin and
  the webpack loader compile every `.uxdsl` module separately with the default,
  so each repeats the theme.
- `plugin.ts` `emitTheme`: `if (!c.includeTheme && !c.themeMarker) return;` —
  the marker already places the theme and the `includeTheme` default is the
  second switch; `REMOVED_OPTIONS` warns and ignores a removed plugin option
  (`UXD_OPTION_REMOVED`); the CLI's `REMOVED_CONFIG_KEYS` is a hard error
  naming the new home; `assertNoThemeLeakIntoCssModule` refuses `:root` in a
  `*.module.css` output; `warnIfMultipleEntriesEmitTheme`.
- `bin/uxdsl.js`: `includeTheme` is read at the top level and per `builds[]`
  entry, overridden by `--include-theme`/`--no-include-theme`
  (`resolveIncludeTheme`); `init --multi` scaffolds a theme entry plus panel
  entries with `includeTheme: false`; the Next.js scaffold writes
  `@uxdsl theme;` in the global stylesheet already.
- Audit §5.3 lists `includeTheme` among the plugin options of the 1.0
  contract; DEC-06 amends that list on purpose.
- Sass: `@use` rules must precede every other rule in a file (verify on the
  installed version in §3), and a used module's CSS is emitted before the
  entry's own rules, in `@use` order.
- The release gate checks that read the option: `B3-a` (exactly one of five
  CLI-built entries defines `:root`), `B3-e` (`--no-include-theme` overrides
  every entry), `B4-a` (`init --multi`), `UX-12` (`--no-include-theme`
  suppresses `:root`), `B2-b`, `DE-9` (the marker in `globals.css`), `cssmod`.

## 3. Preconditions

```bash
grep -q "includeTheme: opts.includeTheme !== false" packages/uxdsl/src/plugin.ts
grep -q "resolveIncludeTheme" packages/uxdsl/bin/uxdsl.js
grep -q "compileSassStage" packages/uxdsl/src/compile.ts   # MIG-B9-13 merged
# Sass facts this story relies on, verified on the installed version:
cd packages/uxdsl && node -e "
const sass=require('sass'); const fs=require('fs'), os=require('os'), path=require('path');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'b920-')); fs.writeFileSync(d+'/_a.scss','.a{x:1}'); fs.writeFileSync(d+'/_b.scss','.b{x:2}');
console.log(sass.compileString('@use \"./a\"; @use \"./b\"; .e{x:3}',{url:require('url').pathToFileURL(d+'/e.scss'),style:'compressed'}).css); // .a before .b before .e
try { sass.compileString('@uxdsl theme; @use \"./a\";',{url:require('url').pathToFileURL(d+'/e.scss')}); console.log('use-after-rule: allowed'); } catch(e) { console.log('use-after-rule: error'); }"
```

Record both lines; the contract below assumes `.a{x:1}.b{x:2}.e{x:3}` and
`use-after-rule: error`. If the second line says `allowed`, the generated
theme file of M3 is still the design (it keeps the theme first), but note it.

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {compile}=require('./dist/entries/index.js');(async()=>{const a=await compile({source:'.card{padding:density(4)}',from:process.cwd()+'/c.uxdsl'});const b=await compile({source:'.card{padding:density(4)}',from:process.cwd()+'/c.uxdsl'},{includeTheme:false});console.log(a.css.length,b.css.length)})()"
```

Recorded: `47273 44` (or the current figures).

## 5. Contract

- **M1 — The marker is the switch.** The plugin emits the theme exactly where
  a top-level `@uxdsl theme;` is written, once per compilation; with no
  marker it emits nothing (today's `includeTheme: false`). `UXD_THEME_MARKER`
  keeps its meaning (misplaced, repeated or misspelled marker).
- **M2 — The option is gone, loudly.** `UxdslOptions.includeTheme` and
  `CompileConfig.includeTheme` are removed from the types; a caller that still
  passes `includeTheme` to the plugin, to `compile()`, to the Vite plugin or to
  the webpack loader gets `UXD_OPTION_REMOVED: the "includeTheme" option was
  removed and is ignored; write @uxdsl theme; in the stylesheet that defines
  the tokens.` (a warning, through `REMOVED_OPTIONS`). The CLI treats
  `includeTheme` at the top level or in a `builds[]` entry as a hard error
  through `REMOVED_CONFIG_KEYS` with the same instruction, and
  `--include-theme`/`--no-include-theme` as removed flags whose error names
  the marker.
- **M3 — Generated entries carry the marker first.** `generate-entry` writes a
  second generated file next to the entry, `uxdsl-theme.uxdsl`, whose content
  is a header comment and `@uxdsl theme;`, and lists it as the first `@use`
  of the entry (`@use './uxdsl-theme' as uxdsl-theme;`), so the theme is the
  first CSS of the output (before every component module) and the entry
  itself needs no rule after its `@use` lines. `--no-theme` skips the file
  and the line (component-only entries in a `builds` project). `init`:
  the single-entry scaffold gets both generated files; `--multi` writes the
  marker into its theme entry (`src/theme.uxdsl`) and `--no-theme` entries
  for the panels; the Next.js scaffold is unchanged.
- **M4 — The CLI counts markers.** `compile()` returns `themeEmitted`. In a
  `builds` project, zero entries emitting the theme prints
  `[uxdsl] Warning: no entry writes @uxdsl theme; the compiled CSS references
  tokens nothing defines — add the marker to the entry that defines them`
  (a warning, once per build); more than one prints the existing warning
  reworded to name the marker. `assertNoThemeLeakIntoCssModule` stays: a
  marker in an entry whose output is `*.module.css` is still an error.
- **M5 — Adapters.** A Vite or webpack app writes the marker in its global
  `.uxdsl`; component modules carry no theme. The adapters pass no theme
  switch to `compile()`.
- **M6 — Reference integrity is unchanged.** Every compilation validates its
  `var(--uxdsl__…)` references against the resolved theme whether or not it
  emits it.
- **M7 — The playground.** Until MIG-B9-22 switches it to the CLI's
  `generate-entry`, its `scripts/generate-uxdsl-entry.js` writes `@uxdsl theme;`
  as the first statement of the generated entry (its lines are `@import`,
  which Sass allows after other rules), so `src/app/uxdsl.css` keeps its theme
  block where it was: after the prelude, before the first rule.
- **M8 — The gate.** `B3-a`, `B3-e`, `B4-a`, `UX-12`, `B2-b` are rewritten
  in terms of the marker (their ids kept, titles updated); `DE-9` and `cssmod`
  stay; `fixtures/mig02-nextjs-cssmodules` builds without the option.

Must stay byte-identical: the theme CSS itself; the compiled output of every
file that today sets `includeTheme: false` and has no marker; `generateThemeCss`.

## 6. Out of scope

- The playground's switch to the CLI's `generate-entry`: MIG-B9-22.
- `emit: 'used'`: MIG-B9-64.

## 7. Approach and traps

- Delete the option in this order: types → plugin (`validateOptions`,
  `emitTheme`) → `compile()` → adapters → CLI (`resolveIncludeTheme`, the
  flag specs in `COMMAND_FLAG_SPECS`, `loadConfig`'s per-build handling,
  `buildOnce`'s `themeEmittingLabels`, `init`) → tests → gate → docs. Each
  step leaves `npm test` green or the story is in the middle of a commit, not
  of a PR.
- `theme-marker.test.js` already proves the marker alone places the theme
  byte-identically to `generateThemeCss`; `include-theme.test.js`'s five
  intents become: no marker → no `:root`; the marker → the theme; two
  compilations with and without the marker share no state; the option →
  warning; the CLI key → error.
- The generated `uxdsl-theme.uxdsl` is excluded from the entry's scan like
  the entry itself (`excludedFiles`), or it would list itself twice.
- Stop rule: if Sass's `@use`-before-rules rule does not hold as §3 records,
  stop and record; the design must not be guessed.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/theme-marker.test.js` | `MIG-B9-20: without the marker a compilation emits no :root; with it the theme is at the marker, byte-identical to generateThemeCss` | unit | M1 | — |
| T2 | same | `MIG-B9-20: includeTheme passed to the plugin, compile(), Vite or webpack warns UXD_OPTION_REMOVED and is ignored` | unit | M2 | — |
| T3 | `test/cli/uxdsl-cli.test.js` | `MIG-B9-20: includeTheme in uxdsl.config.cjs (top level or builds[]) is an error naming the marker; --include-theme and --no-include-theme are removed flags` | CLI | M2 | — |
| T4 | `test/cli/uxdsl-cli.test.js` | `MIG-B9-20: generate-entry writes uxdsl-theme.uxdsl with the marker and lists it first; --no-theme skips it; the output's theme precedes every module` | CLI | M3 | — |
| T5 | `test/cli/init.test.js` | `MIG-B9-20: init and init --multi build with the theme defined exactly once` | CLI | M3 | — |
| T6 | `test/cli/uxdsl-cli.test.js` | `MIG-B9-20: a builds project with no marker warns once; with two markers warns once; a marker in a *.module.css entry is an error` | CLI | M4 | — |
| T7 | `test/vite/index.test.js`, `test/webpack/loader.test.js` | `MIG-B9-20: a component module compiles to its own rules only (bytes recorded)` | unit | M5 | — |
| T8 | `fixtures/release-1.0/run.js` | `B3-a`, `B3-e`, `B4-a`, `UX-12`, `B2-b` rewritten; `DE-9`, `cssmod` | tarball | M8 | — |
| T9 | `fixtures/playground-browser/walk.js` | the site renders (the theme is present once) | Chrome | M7 | the walk's undefined-`var()` control |

## 9. Acceptance criteria

- **AC1** `grep -rn "includeTheme" packages/uxdsl/src packages/uxdsl/bin` prints
  only the `REMOVED_OPTIONS`/`REMOVED_CONFIG_KEYS` entries and their tests.
- **AC2** `node --test packages/uxdsl/test/theme-marker.test.js packages/uxdsl/test/cli/*.test.js`
  exits 0; `test ! -f packages/uxdsl/test/include-theme.test.js`.
- **AC3** `npm test` exits 0; `npm run verify:1.0` exits 0 (including the
  walk).
- **AC4** The baseline command of §4, adapted (no option), prints `44` for a
  module without the marker.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | yes (every `includeTheme` mention; the "Where the theme goes" rule) |
| CHANGELOG | yes (`### Removed`, `### Breaking`) |
| `migration.md` | yes |
| package README | yes (section "Multi-entry theming (`includeTheme`)" becomes "Where the theme goes: `@uxdsl theme;`") |
| `verify-docs-update.js` | no |
| `DIAGNOSTIC_CATALOG` | no (reuses `UXD_OPTION_REMOVED`, `UXD_THEME_MARKER`) |
| playground `uxdsl:build` + captures | yes (`--help` captures) |
| `docs/architecture/unified-engine-audit.md` | yes (the contract list) |

## 11. Documentation

`packages/uxdsl/README.md`, `packages/uxdsl/docs/integrations/{cli,vite,webpack}.md`,
`AGENTS.md`, `packages/uxdsl/docs/migration.md`, `packages/uxdsl/CHANGELOG.md`,
`docs/audits/2026-09-29-auditoria-estabilidad.md` is history and is not
edited; the amendment of its §5.3 is recorded in FEAT-010 DEC-06.

## 12. Verification

```bash
node --test packages/uxdsl/test/theme-marker.test.js          # exit 0
node --test packages/uxdsl/test/cli/*.test.js                  # background; exit 0
npm test                                                       # background; exit 0
npm run verify:1.0                                             # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-20-theme-marker`. Commit:
`feat(FEAT-010): MIG-B9-20 - the theme is emitted only at @uxdsl theme;; includeTheme removed from the plugin, compile(), the adapters and the CLI`.

## 14. Closure record

Delivered in PR #88, from `feat/b9-20-theme-marker` into `feat/beta9`, by the full flow the owner keeps for M stories that change the engine (FEAT-010 §2, D1 of 2026-11-04). The flow was one scout, a design synthesis, three implementers, a review through three lenses (contract and tests, host behaviour, docs/gate/evidence), one fixer, a mutation re-review, and the deliverer. Where the delivered contract differs from §5, §15's blocks rule; the differences are listed below. The owner merges.

**Base and commits.** The base is `feat/beta9` at `f855765`.

| Commit | Content |
| --- | --- |
| `a37d244` | Stale corrections (Base and Shares lines; §15 block of 2026-11-10) |
| `50e3365` | `compile()` reports `themeEmitted`; every theme-relying source writes the marker |
| `f50a66c` | `generate-entry` writes `uxdsl-theme.uxdsl` and loads it first; `init` scaffolds the marker |
| `9def67b` | The flip: the theme only at the marker; `includeTheme` removed from the plugin, `compile()`, the adapters and the CLI |
| `d06ebba` | Vite and webpack warn `UXD_THEME_MARKER` at the end of a build |
| `82ca0bb` | Parity compares error oracles exactly; the budget and browser fixtures follow the marker |
| `4a39826` | Documentation |
| `66c0aa8` | Review fixes |
| `eca045c` | Merge of `origin/feat/beta9` at `a00fbbe` (PRs #80, #81, #82) |

The merge had one conflict, in `packages/uxdsl/CHANGELOG.md`, where both sides had added a subsection at the top of "## 0.5.0-beta.9 — unreleased". Both subsections were kept, MIG-B9-20's first, then MIG-B9-29's. `packages/uxdsl/README.md` merged cleanly with MIG-B9-29's codemod section. FEAT-010 README §5 is `feat/beta9`'s apart from this story's row.

**Environment.** macOS (Darwin 27), Node 20.19.0, npm 11.21.1, Dart Sass 1.107.0, PostCSS 8.5.31, Vite 7.3.7 (fixtures: 5.4.21 and 7.3.8), webpack 5.111.1, mini-css-extract-plugin 2.10.2, Chrome 157. `TMPDIR` pointed into the session scratchpad for every run.

**Failing first.** Each new test was shown failing before its change and passing after. The TAP logs are in the session scratchpad under `b9-20/I1`, `I2`, `I3` and the fixer's directory.

- c2: T10 and T11 (`themeEmitted` was undefined). A marker-only stylesheet compiled to something other than `generateThemeCss` until the newline fix.
- c3: T4, T5 (I1 part), T12, its `--no-theme` control, and the outside-`--src` case. Before the change: 5 failed, 0 passed. stylelint rejected `@uxdsl` until `.stylelintrc.json` was changed.
- c4, the flip: before the change these failed:
  - theme-marker: not ok 20, 25, 28, 29, 31, 33, 34, 35.
  - T17; removed-options 10–13 and 17; T20 (TS2578).
  - uxdsl-cli: T3, T6, T14, and the module-leak text.
  - watch-mode: T13 and its session control.
  - init: T5 and T15.
  - The vite and webpack suites: T7 and T2.
  - sass-corpus: T23.
  - mig07's `@ts-expect-error` control fails on the types of `f855765` (TS2578, exit 2).
- c5: T18 and T19 failed 9 of 10 against c4's adapters; the child-compilation control passed before and after. S-5 and S-6 failed with the old deprecation-only expectation.
- c6:
  - Parity run from `fixtures/` drifted, because of the cwd.
  - The loose comparison accepted the head line alone.
  - A single-line oracle was refused.
  - The budget fixture's t4 failed against `f855765` with "warnings differ".
  - `browser.js` failed its new no-removed-option check.
- Review fixes, each failing under a mutation or before the fix:
  - HB-1: `--no-theme=true` exited 0 and wrote files.
  - HB-4: `init` wrote its config before refusing.
  - CT-1: a false "none" without buildEnd's error guard.
  - CT-2: compile(), Vite and webpack each independently.
  - CT-5: '2 entries emit the theme (builds[0], builds[2])'.
  - DGE-3: a deduplicating `adapterWarningsMismatch` went unseen.
  - The mutation re-review confirmed all six.

**Commands.** Exit codes are given for each.

- Implementers, on their own heads:
  - `npm test`: 0 on each commit.
  - `npm run verify:1.0` with the walk: 0, 72/72, on `f50a66c`, `9def67b`, `d06ebba` and `4a39826`. c4's first run gave 69/72; B7-14a, B7-14b, B7-17E and mig07's panel comments were fixed inside c4 before it was committed.
  - `node fixtures/mig07-consumer/run.js`: 0.
  - Parity: 0, 10 cases, run from the root, from `fixtures/` and from an unrelated directory.
  - `node fixtures/mig-b9-23-compile-budget/run.js --base <f855765 build>` and `--base <candidate>`: 0, t4 equal in 9 of 9 cases.
  - `node fixtures/mig-b9-13-compile-on-sass/browser.js`: 0.
  - `node fixtures/vite-adapter/run.js`: 0.
  - `node fixtures/webpack-adapter/run.js`: 0.
  - `node fixtures/mig-b2-03-cli-init/run.js`: 0.
- Fixer, on `66c0aa8`: `npm test` 0; `verify:doc-examples` 0; language `--check` 0; agent-guide `--check` 0; parity 0.
- Deliverer, on `eca045c` after `npm run build` (0):
  - **AC1**: `grep -rn includeTheme packages/uxdsl/src packages/uxdsl/bin` exits 0 and prints exactly 2 lines. Both are allowed by AC1 as amended:
    - `src/config.ts:271`, the `REMOVED_OPTIONS` entry, which warns on the plugin, `compile()`, Vite and webpack.
    - `bin/uxdsl.js:66`, the `REMOVED_CONFIG_KEYS` entry.
  - **AC2**:
    - `node --test packages/uxdsl/test/theme-marker.test.js packages/uxdsl/test/cli/*.test.js` exits 0: 291 tests, 291 pass.
    - `test ! -f packages/uxdsl/test/include-theme.test.js` exits 0.
  - **AC3**:
    - `npm test` exits 0: 1,591 tests, 1,590 pass, 0 fail, 1 skipped (core, as at the base).
    - `npm run verify:1.0` exits 0: "72/72 automated checks passed. PASS: the 1.0 gate (automated portion) for uxdsl@0.5.0-beta.9." B2-b, B3-a, B3-e, B4-a, UX-12, S-1, S-5, S-6, N-03, N-04, cssmod, DE-9 and B7-17E were all ok.
  - **AC4**: the §4 command adapted, with no option, gives `46` characters, no `:root`, `themeEmitted` false, 0 warnings. That is identical to the same source without the marker. With the marker it gives `47275` and `themeEmitted` true. The base `f855765` gives `47275 46`.
  - `npm run verify:cssmodules-build` (Chrome): 0, PASS.
  - `node fixtures/parity/run.js`: 0, "PASS: 10 parity case(s)".
  - `node fixtures/webpack-adapter/run.js`: 0, PASS.
  - `node fixtures/sass-corpus/run.js`: 0, 276,926 bytes, "byte-identical: true", "compile() returned 21 warnings" (unchanged).
  - `npm run verify:doc-examples`: 0, "65 examples and 24 theme excerpts checked across 101 documentation files".
  - `node scripts/generate-language-artifacts.js --check`: 0.
  - `node scripts/generate-agent-guide.js --check`: 0.
  - `node fixtures/mig07-consumer/run.js`: 0, PASS.
  - `npm run verify:playground-browser` (Chrome): 0, "pages loaded: 380; focusable elements checked: 2220" and "PASS: no console errors, no UXDSL warnings, no unresolved var(), visible keyboard focus, contrast page = Node". It ran the first time on its default port.
  - No watcher or server was left under the worktree or the scratchpad.

**Figures** (Node 20.19.0, Sass 1.107.0):

| What | Value |
| --- | --- |
| AC4, without the marker / with it | 46 / 47,275 |
| Vite `load()` | 46 |
| `vite build` asset (minified) | 40 |
| webpack extracted CSS | 47 |
| Playground `uxdsl.css` | 332,334 bytes; diff `7d6/24a24` only (F3) |
| `init` project `uxdsl.css` | 48,138 |
| Paradigm frame / runtime sandbox | 53,459 / 52,815 |
| Bootstrap corpus | 276,926 bytes, 21 warnings |
| Capability matrix | 120 capabilities, 0 gaps |

**Must stay byte-identical, held.**

- The 8 parity CSS oracles pass with no `--update`.
- The Bootstrap corpus is unchanged.
- B3's five outputs and `init --multi`'s two outputs are `cmp`-identical to `f855765` with `includeTheme: false` on the components.
- `generateThemeCss` is unchanged for four themes.
- The theme CSS itself is unchanged.

**Contract as delivered, where it differs from §5, and why.**

- M3:
  - The `@use` is written `./uxdsl-theme.uxdsl` (MIG-B9-22).
  - The theme file is excluded by its exact path rather than a recorded `--exclude` (MIG-B9-14 flag 17).
  - The namespace `uxdsl-theme` is reserved.
  - The Next.js scaffold writes the marker through the generated file, and `POSTCSS_SNIPPET` is `{}` (owner decisions of 2026-10-23).
- M4:
  - It warns on every host, and under watch it counts over the last result of every entry (owner decisions of 2026-10-23).
  - "None" warns only when a `--uxdsl__` token is referenced and some output can carry the theme (F1 c).
  - The CLI's text is the `UXD_THEME_MARKER`-coded one it shares with Vite and webpack, not M4's literal sentence (§10, design Q19; owner flag F8).
- M7: the script it names was deleted by MIG-B9-22. Its intent holds through M3's file, which the CLI's `generate-entry` lists first.
- AC4 is restated by the review: 46, not 44.
- Added by the owner decisions and §15:
  - M9: the strict parity oracle.
  - M10: the webpack fixture's panel moves to `src/styles/`.
  - M11: the sass-corpus and budget fixtures drop the option.
- UXD_OPTION_REMOVED now uses one template for all five removed options, and the whole table is checked on all four hosts (F7).

**Review and outcome.** The review raised 13 findings: 0 blocking, 9 should-fix, 4 nits.

- Fixed in `66c0aa8`: HB-1, HB-4, CT-1, CT-2, CT-5, DGE-3, plus the docs findings DGE-1, HB-2 and HB-3.
- Handed on:
  - CT-3 and HB-5 are owner flag F8.
  - CT-4 is this record.
  - DGE-2 goes to MIG-B9-91.
- The mutation re-review confirmed every fix is load-bearing. It added one nit, RR-1, recorded in §15.

**What did not run, and why.**

- The `0.5.0-beta.9` publish and external-consumer validation, which only the owner does.
- Press Craftor against a beta.9 tarball: the owner patches it after beta.9 (D17); see §15.
- webpack under `thread-loader` and Turbopack, and Vite dev "none": these are documented limits (F5, F6).
- The deliverer did not re-run `fixtures/vite-adapter/run.js`, the budget fixture or `browser.js` on `eca045c`. They ran on the implementers' heads, and `verify:1.0`'s N-04 covers the Vite fixture on `eca045c`.

**Owner steps.**

1. Answer flags F1–F8 by exception (§15).
2. Review and merge PR #88 into `feat/beta9`.
3. After beta.9, patch Press Craftor (§15).

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Blocking — silent loss of the theme.** M4 warns only for `builds` projects. Single-entry CLI builds, Vite and webpack apps and Next.js PostCSS-only setups lose every token without the marker, and M6 keeps the reference checks green, so nothing fails. Warn once per build when a CLI build emits no theme (single entry or `builds`); in Vite/webpack warn at the end of the build when no module, or more than one, emitted it.
- Under `build --watch`, `runSelectiveBuild` compiles only some entries (`entryIndices`, bin/uxdsl.js ~1014): count `themeEmitted` over the last result of every entry, not the rebuilt subset.
- A marker in a shared partial brings back the theme-per-module problem: every module that `@use`s the partial emits it. Make a marker reached through `@use`/`@import` from more than one module a warning.
- Factual: the Next.js scaffold does not write the marker; `POSTCSS_SNIPPET` passes `includeTheme: false` (bin/uxdsl.js:1814). After M2 every CSS file Next compiles would warn: drop the option from the snippet in this story.
- Scope is larger than listed: 43 test files use `includeTheme` 185 times; fixtures `mig07-consumer` (its TypeScript check of `{ theme, includeTheme: false }` runs in README §1's setup and breaks every later story), `parity/run.js`, `mig-b2-03-cli-init`, `webpack-adapter`; playground docs `quick-start/page.mdx:68,88`, `tooling/page.mdx:35-66`, `language/page.tsx:103`. Split the story (engine + CLI; tests and fixtures; docs).
- AC4 pins 44 bytes measured on the old pipeline; after MIG-B9-13 the formatting is Sass's. Restate: no `:root` in the output, same length as the output of the same source without the marker.
- Run MIG-B9-22 first: both edit `bin/uxdsl.js`, and 20's M7 is work that 22 then replaces.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-06, confirmed** with the review's blocking condition: a build that emits no theme warns once on every host (a single-entry CLI build, `builds`, `build --watch` counted over the last result of every entry, Vite, webpack, Next.js), and so does a build in which more than one module emits it (a marker reached through a shared partial).
- The Next.js scaffold writes `@uxdsl theme;` and drops `includeTheme: false` from `POSTCSS_SNIPPET`. The PostCSS plugin alone sees one file at a time and has no end of build: if it cannot tell that no file emitted the theme, say so in §15 rather than warning on every file, and let the scaffold and `uxdsl doctor` (MIG-B9-60) cover that host.
- Split the story as the review asks if it helps (engine and CLI; tests and fixtures; docs).

### Owner decisions of 2026-11-08 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-08). The owner was given numbered recommendations, in Spanish, on the owner flags of MIG-B9-14 and MIG-B9-15, and answered, verbatim, "todo como recomendado" ("everything as recommended"): each recommendation is the owner's decision of 2026-11-08. This record is in English and lists those that concern this story. Where they differ from this story's contract, from the review above or from the owner decisions of 2026-10-23, they rule.

- **A strict comparison of error oracles (the decision on MIG-B9-14's flag 10).** A strict comparison of error oracles in `fixtures/parity/run.js` goes to this story. Its line 150 compares by substring in both directions, so the frame recorded in `missing-import.json` and `import-cycle.json` is not guarded: a CLI with no frame passes all ten cases (MIG-B9-14 §15, flag 10).
- **The exclusion rule, for information (the decision on MIG-B9-14's flag 17).** MIG-B9-22 makes `generate-entry` exclude only the output file, instead of every file with the entry's file name in any directory. The decision notes that this matters for this story's `uxdsl-theme.uxdsl`, which its approach (§7) excludes from the entry's scan "like the entry itself". README §7's prose and the review above run MIG-B9-22 before this story; README §5 lists this story first.

### Stale corrections and findings of 2026-11-10 (scout and design)

Recorded before implementing, on `feat/beta9` at `f855765` (Node 20.19.0, Sass 1.107.0). The two header lines below are preconditions or Owns/Shares and were corrected in place; every other item is a stale statement elsewhere in the story, listed here and not rewritten. No contract (§5), test (§8) or acceptance criterion (§9) text was changed.

**Header lines corrected in place.**

- Base. Old: `` | Base | `feat/beta9` after MIG-B9-14 | ``. New: `` | Base | `feat/beta9` at `f855765` (after MIG-B9-14, 15, 22, 23 and the owner decisions of 2026-11-09) | ``.
- Shares. Old: `` | Shares | `packages/uxdsl/src/plugin.ts`, `packages/uxdsl/src/compile.ts`, `packages/uxdsl/src/types.ts`, `packages/uxdsl/src/vite.ts`, `packages/uxdsl/src/webpack.ts`, `packages/uxdsl/bin/uxdsl.js`, `fixtures/release-1.0/run.js`, `fixtures/mig02-nextjs-cssmodules/**`, `packages/playground-nextjs/scripts/generate-uxdsl-entry.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` | ``. New: the row now in the header. Why: MIG-B9-22 (PR #76) deleted `scripts/generate-uxdsl-entry.js` (the playground runs the CLI's `generate-entry`); MIG-B9-23 §15 assigns `fixtures/sass-corpus/run.js` to this story; the review of 2026-10-11 and MIG-B9-14 §15 add the other fixtures; the scout found the rest that pass or rely on the option (the budget fixture, `scripts/lib/doc-examples.js`, `scripts/bench-references.js`, the playground's paradigm frame, runtime sandbox, `capture-examples.js` and `cli-project` capture fixture, its stylelint config for the new generated theme file).

**Stale statements, not rewritten.**

- §2, Next.js: "the Next.js scaffold writes `@uxdsl theme;` in the global stylesheet already" is wrong. The scaffold writes no marker, and `POSTCSS_SNIPPET` passes `'uxdsl/postcss': { includeTheme: false }` (bin/uxdsl.js:2440 at `f855765`). `init --multi` scaffolds one panel entry (`src/panel-a.uxdsl`), not several.
- §7, `excludedFiles`: it no longer exists in bin/uxdsl.js. Since MIG-B9-22, `planEntry` leaves out only its own output file, by path, and `--exclude` file names; the generated `uxdsl-theme.uxdsl` has to be left out explicitly (the owner decision of 2026-11-08 on MIG-B9-14's flag 17).
- §4, the baseline: on `f855765` the command prints `47275 46` (recorded `47273 44` on `685c132`). The figures are Sass's formatting after MIG-B9-13; the module without the theme is `.card {\n  padding: var(--uxdsl__density__4);\n}`.
- §11, documentation: it omits `packages/uxdsl/docs/integrations/compile.md` (lines 56 and 117 document `includeTheme`), the playground pages `src/app/docs/quick-start/page.mdx` (68, 88), `tooling/page.mdx` (35-36, 67-72) and `language/page.tsx` (103), and `docs/releases/0.5.0-beta.9.md:33` (the prepublish record's "Next.js without the CLI" row). That release record is left to MIG-B9-91, which refreshes it.
- The review of 2026-10-11, figures: `POSTCSS_SNIPPET` is now at bin/uxdsl.js:2440 (not 1814), and 48 files under `packages/uxdsl/test` name `includeTheme` on 295 lines (not 43 files, 185 times); 2 test files carry the `--include-theme` flags.
- M3's `@use './uxdsl-theme' as uxdsl-theme;` is written MIG-B9-22's way: `@use './uxdsl-theme.uxdsl' as uxdsl-theme;` (each `@use` writes the `.uxdsl` extension).
- M7 is obsolete as written: the script it names was deleted by MIG-B9-22, and §6's "MIG-B9-22" item is done. Its intent (the playground's `src/app/uxdsl.css` keeps its theme block after the prelude and before the first rule) is met by M3's generated `src/app/uxdsl-theme.uxdsl`, listed first by the CLI's `generate-entry` ahead of the playground's four `--first` files.
- M3's "the Next.js scaffold is unchanged" and M4's "in a `builds` project" are overruled by the owner decisions of 2026-10-23 above (the Next.js scaffold writes the marker and `POSTCSS_SNIPPET` drops the option; a build that emits no theme warns on every host).
- `fixtures/sass-corpus/run.js` joins this story (MIG-B9-23 §15: "It owns dropping run.js's `{ includeTheme: false }`").

### Delivery of 2026-11-13

**New facts since the 2026-11-10 block.**

- `origin/feat/beta9` moved to `a00fbbe` (PRs #80, #81, #82) and was merged at `eca045c`; the only conflict was the CHANGELOG, and both subsections are kept.
- The four removed options (`breakpoints`, `themeVar`, `spaceVar`, `colorVar`) were silently ignored by `compile()`, Vite and webpack. They now warn there (F7).
- X1: a top-level `includeTheme` in a `builds` config was silently ignored. It is now an error, like every other placement.
- Decision 31: this story only appends to `packages/uxdsl/docs/migration.md`. It adds one new beta.9 section and rewrites no passage; `git diff -U0 origin/feat/beta9...HEAD` shows a single hunk, `@@ -249,0 +250,51 @@`.

**The PostCSS plugin alone cannot tell (owner decision of 2026-10-23).**

- The plugin runs once per file, in PostCSS's `Once`, and PostCSS has no end-of-build hook.
- postcss-loader, Next.js and Turbopack run it per file, possibly in workers. Counting across files would need process-global state, which AGENTS.md forbids.
- So that host gives no build-level warning. DE-9's control 2 (no marker: the page builds and the tokens are undefined) stays silent. The only per-file warning there is `UXD_OPTION_REMOVED`, while a config still passes `includeTheme`.
- The scaffold covers that host: the CLI-built global CSS carries `src/uxdsl-theme.uxdsl`, and `POSTCSS_SNIPPET` is `{}`. MIG-B9-60's doctor will cover it too. Each compilation pushes `{ type: 'uxdsl-theme', plugin: 'uxdsl', emitted }` into the result messages, which is the seam the doctor can count; `compile()` reads it for `themeEmitted`.

**Host limits** (F5, F6, and the review's HB-2 and HB-3).

- The Vite dev server has no end of build. It never reports "none", and it reports "many" once per change of the emitting set. It counts every module it compiled in the session until that module's file is deleted.
- webpack stays silent rather than guess in these setups:
  - child-compilation mode;
  - `thread-loader` and bare loader runners;
  - a new process whose persistent cache restores every `.uxdsl` module;
  - Turbopack.
  Watch mode does count kept modules.
- Every host counts the whole build, compilation or `builds` config, not each page or chunk. A multi-page app with one global (with the marker) per page warns "many" on every build; sharing one global stays silent. vite.md, webpack.md and cli.md say so.

**Contract as delivered.** See §14. The CT-3 finding: M4's literal sentence ("no entry writes @uxdsl theme; the compiled CSS references tokens nothing defines — add the marker to the entry that defines them") is not what the CLI prints. It prints the `UXD_THEME_MARKER`-coded text shared with Vite and webpack, then a CLI hint (§10's reuse of the code, design Q19). M4 is not edited; F8 asks the owner.

**Review nit RR-1.** A comment above `loadConfig`'s sourcemap validation in `bin/uxdsl.js` was reworded in this branch and kept its `MIG-B6-21 (FEAT-008):` prefix. Dropping the prefix is a comment-only change, left for the next story that edits that function.

**Press Craftor** (`story-radar`, read-only grep; the owner patches it after beta.9, D17). It is on `postcss-uxdsl` and `uxdsl-cli` `0.5.0-beta.8`. On `uxdsl@0.5.0-beta.9` it must change:

1. `uxdsl.config.cjs`: delete `includeTheme` from all seven `builds[]` entries, and the comment at lines 14–18. The key becomes a hard error.
2. `src/app/uxdsl.uxdsl`, the global entry built to `src/app/uxdsl.css`: add `@uxdsl theme;` once, at the top level. Without it the build emits no theme and warns `UXD_THEME_MARKER`. The six `*.module.uxdsl` panels stay without the marker.
3. `postcss.config.mjs:13`: drop `includeTheme: false` from the `postcss-uxdsl-source.cjs` options. Otherwise every file warns `UXD_OPTION_REMOVED`.
4. `src/design/uxdsl-postcss.test.ts:24`: `sourceOnly({ includeTheme: false })` becomes `sourceOnly({})`.
5. `docs/uxdsl-agent-guide.md` (lines 29–33, 65, 100 and 243) still describes `includeTheme`. Refresh it from `node_modules/uxdsl/docs/agent-guide.md`.

**Owner flags.** Each is answered by exception; the code implements the recommendation.

- **F1, when "none" warns.**
  - Options: (a) always; (b) when a token is referenced; (c) as (b), and when some output can carry the theme.
  - Recommendation: **(c)**, which is implemented. Token-free builds and modules-only builds stay silent, and mig02 holds.
- **F2, theme delivered out of band** (SSR `generateThemeCss`, `applyTheme`, another build). Such a project warns "none" on every build.
  - Options: (a) document it; (b) suppress it through `references`.
  - Recommendation: **(a)** for beta.9; revisit with MIG-B9-60.
- **F3, the moved leading comment in generated entries.**
  - Options: (a) accept it and record it under Visual changes; (b) MIG-B9-40 moves the playground comment.
  - Recommendation: **(a)**, which is done.
- **F4, S-5 and S-6.**
  - Options: (a) expect the deprecation plus exactly one `UXD_THEME_MARKER`; (b) put the marker in the panel; (c) add a separate global.
  - Recommendation: **(a)**, which is implemented.
- **F5, Vite dev.**
  - Options: (a) "many" only; (b) nothing; (c) a debounce.
  - Recommendation: **(a)**, which is implemented.
- **F6, webpack limits.**
  - Options: (a) accept and document them; (b) a public `UxdslWebpackPlugin`.
  - Recommendation: **(a)**.
- **F7, one `UXD_OPTION_REMOVED` template for all five options, on all four hosts.**
  - Options: (a) one template; (b) keep "plugin option" for the old four.
  - Recommendation: **(a)**, which is implemented.
- **F8, the CLI warning text against M4's literal sentence, and the "none" hint** (CT-3, HB-5).
  - Options:
    - (a) Accept the coded, shared text and keep the hint as it is.
    - (b) As (a), with a hint that is true in general: "An entry generate-entry wrote without --no-theme loads its theme file; run uxdsl generate-entry again if that file is missing."
    - (c) As (a), and print the hint only for generated entries without `--no-theme`.
    - (d) Restore M4's literal text.
  - Recommendation: **(b)**.

**Follow-ups.**

- **MIG-B9-91** (the release record):
  - `docs/releases/0.5.0-beta.9.md:33` still shows `'uxdsl/postcss': { includeTheme: false }`.
  - Two older subsections under "## 0.5.0-beta.9 — unreleased" in the CHANGELOG still describe `includeTheme` as current: MIG-B9-22's (about line 384) and DE-9's "Added: `@uxdsl theme;`" (about lines 986–990). They were left as history; the release notes should mark them superseded.
- **MIG-B9-60 (doctor)**: count the `uxdsl-theme` result message to cover the PostCSS-alone host.
- **MIG-B9-16**: the language page's stale "SCSS-style subset" section is still there; only its marker passage changed here.
- **Proposed MIG-B9-67**, only if the owner wants it: per-page or per-chunk theme counting on the CLI, Vite and webpack.
- **F8**, if answered (b) or (c): reword the CLI hint, regenerate `cli-captures.json`, and update cli.md, the CHANGELOG and the CLI tests. That is a small follow-up, or part of MIG-B9-60.

### Owner decisions of 2026-11-13, on the delivery's flags

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-13), as decisions 1 to 11 of 2026-11-13. On 2026-11-10 the owner gave a standing instruction for FEAT-010, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"). This story was merged into `feat/beta9` as PR #88 (`cc10de6`) on 2026-11-13, with `npm test` and `verify:1.0` green. The flags F1 to F8 of the "Delivery of 2026-11-13" block above were not put to the owner one by one: under that instruction each recommendation is the owner's decision of 2026-11-13, and the owner may still override any of them. This record is in English. The header's Status is the deliverer's to set.

- **F1 (decision 1): (c)**, as implemented. The build-level "none" warning fires only when the build's CSS references a `--uxdsl__` token and some output can carry the theme: not a `*.module.css` `outFile` in the CLI (`bin/uxdsl.js:1113` and `1147`, `canCarryTheme: !/\.module\.css$/i.test(outFile)`), not a `*.module.uxdsl` resource in webpack (`src/webpack.ts:220`).
- **F2 (decision 2): (a)** for `0.5.0-beta.9`. A project that delivers its theme out of band (SSR `generateThemeCss`, `applyTheme`, another build) keeps the "none" warning on every build, and the case is to be documented. MIG-B9-60's doctor revisits it. On `5a041fc` no shipped document states this case yet (FEAT-010 §2 records the search); the decision names no story for that sentence, and who writes it is an open question for the owner, Q1 of MIG-B9-21's §15.
- **F3 (decision 3): (a)**, accepted and recorded under the CHANGELOG's "Visual changes" (`packages/uxdsl/CHANGELOG.md:177–186` on `5a041fc`), as done.
- **F4 (decision 4): (a)**, as implemented. Gate checks S-5 and S-6 expect the deprecation plus exactly one `UXD_THEME_MARKER` (`fixtures/release-1.0/run.js:209–215`, `ADAPTER_THEME_WARNING`).
- **F5 (decision 5): (a)**, as implemented. The Vite dev server warns "many" only, once per change of the emitting set; `vite build` is the gate.
- **F6 (decision 6): (a).** The limits are accepted and documented (`packages/uxdsl/docs/integrations/webpack.md:134–139`): webpack stays silent in child-compilation mode, under `thread-loader` or a bare runner, in a fully cache-restored process and in Turbopack.
- **F7 (decision 7): (a)**, as implemented. One `UXD_OPTION_REMOVED` template for the five removed options (`src/config.ts:266–279`, `REMOVED_OPTIONS`), checked on the plugin, `compile()`, Vite and webpack.
- **F8 (decision 8): (b).**
  - The `UXD_THEME_MARKER`-coded text shared with Vite and webpack stands as M4's implementation, a recorded deviation from M4's literal sentence (CT-3). M4 is not edited.
  - The CLI's "none" hint is reworded so that it is true in general (HB-5), for example " An entry generate-entry wrote without --no-theme loads its theme file; run uxdsl generate-entry again if that file is missing."
  - That rewording, and RR-1 above, are assigned to MIG-B9-21 as added items. MIG-B9-21's §15 has a block of this date with the current text and every file that repeats it.
- **Follow-ups (decisions 9 to 11).**
  - MIG-B9-91 refreshes `docs/releases/0.5.0-beta.9.md:33` and marks the two older beta.9 CHANGELOG subsections superseded (DGE-2). On `5a041fc` the first of them is in MIG-B9-14's subsection (`CHANGELOG.md:423–425`), not MIG-B9-22's as the delivery block above says. MIG-B9-91's §15 has a block of this date.
  - MIG-B9-60 counts the `{ type: 'uxdsl-theme', plugin: 'uxdsl', emitted }` result message for the PostCSS-alone host and revisits F2. MIG-B9-60's §15 has a block of this date.
  - MIG-B9-16 keeps its own scope: its C1 already replaces the "SCSS-style subset" section, now at `page.tsx:110`.
- **The proposed MIG-B9-67 is not registered.** The owner has not asked for it, and it stays a proposal in the delivery block above.
