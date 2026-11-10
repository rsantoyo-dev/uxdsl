# MIG-B9-20 — The theme is written where `@uxdsl theme;` is

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | DEC-06 (decided 2026-10-23: the marker is the only switch; `includeTheme` is removed) |
| Status | Ready |
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

To be filled in the delivering PR.

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
