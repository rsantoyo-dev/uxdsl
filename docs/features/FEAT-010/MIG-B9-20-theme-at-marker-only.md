# MIG-B9-20 — The theme is written where `@uxdsl theme;` is

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | DEC-06 (recommended: the marker is the only switch; `includeTheme` is removed) |
| Status | Blocked (DEC-06) |
| Size | M |
| Depends on | MIG-B9-14 |
| Blocks | MIG-B9-50, MIG-B9-60, MIG-B9-64 |
| Base | `feat/beta9` after MIG-B9-14 |
| Owns | `packages/uxdsl/test/include-theme.test.js` (deleted; its intents move to `theme-marker.test.js`), `packages/uxdsl/test/theme-marker.test.js` |
| Shares | `packages/uxdsl/src/plugin.ts`, `packages/uxdsl/src/compile.ts`, `packages/uxdsl/src/types.ts`, `packages/uxdsl/src/vite.ts`, `packages/uxdsl/src/webpack.ts`, `packages/uxdsl/bin/uxdsl.js`, `fixtures/release-1.0/run.js`, `fixtures/mig02-nextjs-cssmodules/**`, `packages/playground-nextjs/scripts/generate-uxdsl-entry.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
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
