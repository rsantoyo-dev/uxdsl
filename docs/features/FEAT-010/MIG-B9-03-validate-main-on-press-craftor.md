# MIG-B9-03 — Validate `main` on Press Craftor from a local tarball

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 0 |
| Decision gate | None |
| Status | In review (PR #46) |
| Size | M |
| Depends on | MIG-B9-01 (the tarball must say beta.9) |
| Blocks | MIG-B9-50, MIG-B9-52, MIG-B9-60 (they consume its findings) |
| Base | `feat/beta9` after MIG-B9-01 |
| Owns | `docs/features/FEAT-010/evidence/MIG-B9-03-press-craftor.md` (new; the migration log and the patch) |
| Shares | None (this story changes no package code; every defect it finds becomes a finding for another story) |
| Output impact | none |

## 1. Goal

The stability rewrite on `main` has only been validated by its own gate. This
story proves it on the one real project that uses UXDSL, Press Craftor
(the `story-radar` repository), by migrating a copy of it to a local
`uxdsl@0.5.0-beta.9` tarball following only the published migration steps,
and turns every step the documentation did not cover into a finding.

## 2. Sources

- Plan §2.1 and §2.3: "Record every step that was not obvious from the docs —
  each one is a docs or tooling bug for this plan"; "The move must let it
  delete its workarounds (§8) and follow only the published migration steps".
- `docs/releases/0.5.0-beta.9.md`, section "Moving `story-radar` (or any
  beta.6 project)": the documented steps.
- Press Craftor, read on 2026-10-11 at `/Users/ricardosantoyo/Documents/projects/story-radar`
  (`main`, ahead of origin by 2; HEAD `983ed88`):
  - `package.json`: `next ^16.3.5`; `postcss-uxdsl`, `uxdsl-cli`, `uxdsl-core`,
    `vite-plugin-uxdsl` at `0.5.0-beta.8`; scripts `uxdsl:build: uxdsl build`,
    `uxdsl:watch: uxdsl watch` (a removed command), `lint` runs
    `node scripts/uxdsl-audit.mjs --check`;
  - `uxdsl.config.cjs`: a 7-entry `builds` array, the theme entry
    `includeTheme: true`, six `*.module.uxdsl` → `*.generated.module.css`
    entries with `includeTheme: false`, `watch: ["src/app/**/*.uxdsl"]`;
  - `uxdsl.theme.config.cjs` (a removed file name) requires the theme from
    `uxdsl.config.js` (a JavaScript theme with helper functions, a custom
    `border(focus)` preset, `padding: "0 density(4)"`) and carries
    `references.externalTokens`;
  - `postcss.config.mjs` loads `postcss-uxdsl-source.cjs`, a local plugin
    that requires `postcss-uxdsl`, strips `:root` blocks from CSS Modules and
    re-declares the composite tokens on `[style*="--uxdsl__palette__"]`
    (its F‑16 workaround), with `references.css: [readFileSync("src/app/uxdsl.css")]`;
  - 7 `.uxdsl` files, 7,883 lines, no Sass feature, and hundreds of dashed
    palette references (`palette(dark-main)` 143 times, `palette(light-light)`
    105, …), which `main` rejects as `UXD_PALETTE_SYNTAX`;
  - `docs/uxdsl-findings.md` and `docs/uxdsl-next-beta.md` (their F‑n findings
    and proposals), `scripts/uxdsl-audit.mjs` with a committed baseline.

## 3. Preconditions

```bash
test -d /Users/ricardosantoyo/Documents/projects/story-radar/src/app
test "$(node -p "require('./packages/uxdsl/package.json').version")" = "0.5.0-beta.9"
node packages/uxdsl/bin/uxdsl.js --version | grep -q 0.5.0-beta.9
test -x "$(command -v git)"
```

## 4. Baseline

In a **copy** (never the owner's checkout):

```bash
rm -rf /tmp/press-craftor && git clone --quiet /Users/ricardosantoyo/Documents/projects/story-radar /tmp/press-craftor
cd /tmp/press-craftor && npm ci --ignore-scripts --no-audit --no-fund && npm run uxdsl:build && npm run build
```

Record: exit code, build time, the sizes of the seven generated CSS files
(`src/app/uxdsl.css` and the six `*.generated.module.css`), and
`node scripts/uxdsl-audit.mjs --json` output. This is the "before".

## 5. Contract

- **C1 — Only the documented steps.** The migration is performed exactly as
  `docs/releases/0.5.0-beta.9.md` "Moving story-radar" and
  `packages/uxdsl/docs/migration.md` describe, in order. Each time a step is
  missing, wrong, or needs knowledge the documents do not give, the agent
  writes a numbered finding **before** working around it: what was expected,
  what happened, the exact message, and which story should fix it
  (MIG-B9-50 docs, MIG-B9-52 migration, MIG-B9-60 `doctor`, or a new id).
- **C2 — The tarball.** `npm pack` in `packages/uxdsl` of the worktree
  produces `uxdsl-0.5.0-beta.9.tgz`; the copy installs it with
  `npm i -D ./uxdsl-0.5.0-beta.9.tgz` and uninstalls the four former names.
- **C3 — Build parity.** After the migration, `uxdsl build` and `next build`
  exit 0. The seven generated CSS files are compared with the "before" set:
  every difference is either (a) a documented visual change of the stability
  work (the base theme's corrected colors, the typography variable names, the
  Google Fonts `@import` position, the canonical grammar producing identical
  output) and listed with its CHANGELOG reference, or (b) a finding.
- **C4 — The workaround.** `postcss-uxdsl-source.cjs`'s `:root`-stripping
  half is deleted in the copy (the CLI refuses a theme leak into a
  `*.module.css` output since MIG-B6-24, and `includeTheme: false` entries emit
  none); its composite re-declaration half stays, with a comment naming
  MIG-B9-31 as the story that makes it deletable. If deleting the first half
  breaks the build, that is a finding, not a reason to keep it.
- **C5 — Runtime.** The copy's browser behavior is checked in Chrome on the
  two routes that use the most UXDSL (`radar-dashboard`,
  `creative-draft-workspace`): no console errors, no unresolved `var()` (the
  same probe `fixtures/playground-browser/walk.js` uses), theme switching if
  the app has one.
- **C6 — The log.** `docs/features/FEAT-010/evidence/MIG-B9-03-press-craftor.md`
  records: the before/after figures, the numbered findings, the exact commands
  run with exit codes, the Chrome checks, and the full `git diff` of the copy
  as a patch block the owner can apply to the real project.
- **C7 — The real project is not touched.** Everything happens in
  `/tmp/press-craftor`. Applying the patch to the owner's repository is the
  owner's step.

## 6. Out of scope

- Fixing anything found: each finding goes to its story.
- The second validation on the superset pipeline: MIG-B9-14 and MIG-B9-31 each
  repeat this procedure in their §12 ("Press Craftor builds unchanged").
- Press Craftor's own audit baseline (`docs/uxdsl-alignment.baseline.json`):
  reported, not changed.

## 7. Approach and traps

- The dashed palette grammar is rewritten by the shipped codemod:
  `node node_modules/uxdsl/scripts/codemod-canonical-grammar.js --theme <theme> src`
  (preview), then `--write`. Their theme is a `.cjs` module, not JSON; if the
  codemod cannot load it, that is finding number one.
- `uxdsl.theme.config.cjs` must be renamed to `uxdsl.theme.cjs`; it exports
  `{ theme, references }`, which `main` refuses — `references` moves into
  `uxdsl.config.cjs`. Their `uxdsl.config.js` (theme data) and
  `uxdsl.config.cjs` (build config) share a name stem; the CLI's
  `CONFIG_CANDIDATES` tries `.cjs` first, so the build config wins today; note
  whether the documentation says so.
- `postcss.config.mjs` imports the theme module and reads `src/app/uxdsl.css`
  at config time; with `uxdsl/postcss` the `references.css` approach is still
  valid but should be checked against the Next 16 Turbopack worker note in
  their comments.
- Next 16 runs PostCSS plugins from a worker; a plugin referenced by absolute
  path works; `uxdsl/postcss` by name should too. Record which.
- Stop rule: if `next build` cannot pass after applying every documented step
  and the findings, stop, write the log, and set the story to Blocked with the
  blocking finding.

## 8. Tests

This story produces evidence, not package tests. Its checks:

| Id | What | Level | Proves |
| --- | --- | --- | --- |
| T1 | `uxdsl build` in the copy exits 0 | CLI | C2, C3 |
| T2 | `next build` in the copy exits 0 | host | C3 |
| T3 | `diff` of the seven generated files, before vs after, each hunk classified | parity | C3 |
| T4 | Chrome, two routes: console clean, no unresolved `var()` | Chrome | C5 |
| T5 | `git -C /Users/ricardosantoyo/Documents/projects/story-radar status --porcelain` identical before and after the story | hygiene | C7 |

## 9. Acceptance criteria

- **AC1** The evidence file exists and contains the before/after table, the
  numbered findings (possibly zero, stated explicitly), the commands with exit
  codes, and the patch block.
- **AC2** T1 and T2 exit 0 in the copy, or the story is Blocked with the
  blocking finding written.
- **AC3** Every hunk of T3 is classified (a) or (b); no hunk is unexplained.
- **AC4** T4 ran in real Chrome (the log names the Chrome version) or is
  listed as not run with the reason; never as passed.
- **AC5** T5 holds.

## 10. Generated artifacts and guards

None (no package code changes).

## 11. Documentation

Only the evidence file. Documentation defects are findings for MIG-B9-50 and
MIG-B9-52.

## 12. Verification

The commands of §4 and §5, recorded in the evidence file.

## 13. Delivery

Branch `feat/b9-03-press-craftor`. Commit:
`docs(FEAT-010): MIG-B9-03 - Press Craftor migrated to a local uxdsl@0.5.0-beta.9 tarball: log and findings`.

## 14. Closure record

- **Base:** `feat/beta9` at `0c9fbf6` (after MIG-B9-01, 02, 04, 05, 53 and
  part 1 of 10). **PR:** #46, branch `feat/b9-03-press-craftor`, into
  `feat/beta9`. Delivered 2026-10-29.
- **Environment:** macOS 27.0.0, Node v20.19.0, npm 11.21.1, Google Chrome
  156.0.8078.74 via playwright-core 1.63.0, Next.js 16.3.5 (`next build
  --webpack`, the project's script). Press Craftor read at `dbec897`; §2 was
  written at `983ed88` — the three commits in between are application work
  (Draft 2, story collection) and change none of the files §2 names.
- **Evidence:** [`evidence/MIG-B9-03-press-craftor.md`](evidence/MIG-B9-03-press-craftor.md)
  — before/after table, every hunk classified, the findings, every command
  with its exit code, the Chrome checks and the full patch.
- **Commands and exit codes (summary; the evidence file has every one):**
  preparation as CI, all exit 0; preconditions §3, four exit 0; `npm pack` →
  `uxdsl-0.5.0-beta.9.tgz` (235,376 B, 90 files); baseline in the clone:
  `git clone` 0, `npm ci` 0, `uxdsl:build` 0 (4 s), `npm run build` 0
  (56 s); migration: `npm uninstall …` 0, `npm i -D <tarball>` 0,
  `npx uxdsl --version` **1** (finding 1) → `npm i -D postcss` 0 → 0;
  codemod preview/write over `src` 0/0; `uxdsl build` **1**
  (`UXD_PALETTE_SYNTAX`, finding 2) → codemod over `uxdsl.config.js` 0/0 →
  `uxdsl build` 0 (T1, 1 s); `npm run build` 0 (T2, 57 s) with the
  workaround, 0 (56 s) without its `:root`-stripping half (C4), 0 (55 s)
  final; audit `--json`/`--check` 0/0, totals identical to the baseline;
  project plugin test 0 (2 pass); `uxdsl/postcss` by name in Next 16.3.5
  webpack 0 (60 s).
- **T3:** every hunk of the seven files is classified (a) with its CHANGELOG
  reference, except one (b): the order of generated state rules (finding 5).
- **T4 (Chrome 156.0.8078.74):** ran on `/login` (clean: no console error,
  no UXDSL warning, no failed request, no unresolved `var()`, 390/1280 px,
  light/dark) and `/help` (clean except finding 4's four `inherit`-valued
  typography variables and an aborted prefetch of `/`), plus a static
  harness of the two modules' CSS against the theme (512 unresolved pairs,
  all 24 variables declared `inherit`, identical before and after). **Not
  run:** the `radar-dashboard` (`/`) and `creative-draft-workspace` (story
  and Draft 2) routes themselves — they need `DATABASE_URL` (Neon) and a
  signed-in session; the owner's `.env.local` was not copied. `/` answered
  500 (`DATABASE_URL is not configured`). No theme switcher exists in the
  app. Not marked passed.
- **T5:** `git -C …/story-radar status --porcelain` =
  `?? 4f91cb9c-7c15-4f6d-bf64-0b3a71a8213b.png`, HEAD `dbec897`, identical
  at the start, mid-story and at the end.
- **Controls run:** the Chrome probe's negative control (an injected
  undefined `var()` and a `console.error`, both reported); the codemod's
  idempotency probe (a second run rewrites canonical names — finding 3); the
  first static harness, which "passed" because `file://` stylesheets are
  cross-origin for the CSSOM, was discarded and redone with inlined CSS.
- **Owner steps pending:** apply the patch to the real project (evidence
  §7: regenerate the lockfile, replace the tarball path with the published
  version, decide on `.npmrc`'s `legacy-peer-deps`, expect the documented
  visual changes, clear `.next/cache`); route the findings below to their
  stories. `/tmp/press-craftor` is left in place for inspection.
- **Guards:** no package code changed; `npm run verify:doc-examples` exit 0
  (`docs/features` is not compiled); `git status` shows only this story's
  three files.

## 15. Findings and follow-ups

Known before it started: `uxdsl watch` is gone (`uxdsl build --watch`);
`uxdsl.theme.config.cjs` is a removed name; the dashed palette grammar is an
error; `postcss-uxdsl/ds-runtime` imports (if any) become `uxdsl/runtime` —
Press Craftor has none, and no `updatePalette`-style call.

Findings of the run (details and exact messages in the evidence file §4):

| # | Finding | Target |
| --- | --- | --- |
| 1 | After the documented uninstall/install, `uxdsl` fails with `Cannot find module 'postcss'` in a project with `legacy-peer-deps=true` (`.npmrc`); the migration steps do not name the `postcss` peer (the README's Install section does) | MIG-B9-52 (steps), MIG-B9-60 (`doctor` detects a missing peer) |
| 2 | The documented codemod command targets `src` only; theme values at the project root (`uxdsl.config.js`, 98 dashed references) stay dashed and `uxdsl build` fails with `UXD_PALETTE_SYNTAX` naming the loaded theme file, not the module holding the value | MIG-B9-52 (run it over the theme module too), MIG-B9-60 |
| 3 | The codemod is not idempotent: a second run rewrites `--uxdsl__typography__h1-font-size` to `h1-font-font-size`; the release notes prescribe the codemod twice | **new story** (fix the suffix regex, pin a second run as a no-op); MIG-B9-52 (one instruction) |
| 4 | A theme value of `inherit` (Press Craftor's `emphasis`/`regular`/`inherit`/`multiline` roles, `color: "inherit"` Surfaces and Buttons) emits a `:root` custom property that is guaranteed-invalid; `var()` reads of it are unresolved in Chrome (24 variables, 512 pairs; pre-existing in beta.8) and the compiler is silent | **new story** (a located warning for CSS-wide keywords in token values); MIG-B9-33 documents `extends: "none"` as the replacement for the trick |
| 5 | Generated state rules are emitted in the order `hover, focus-visible, selected, disabled` (was `hover, selected, focus-visible, disabled`); not in the CHANGELOG; no rendering change | MIG-B9-52 |
| 6 | With both `uxdsl.config.cjs` and `uxdsl.config.js` present, `.cjs` wins silently; the documentation gives no order | MIG-B9-50; MIG-B9-60 (warn) |
| 7 | The codemod rewrites and reports generated outputs under `src` (`*.generated.module.css`, `uxdsl.css`) | MIG-B9-52, or the codemod story |
| 8 | The release-notes example names only `--theme uxdsl.theme.json`; `.js`/`.cjs` themes work and the text should say so | MIG-B9-52 |

Confirmed, not findings: `references` at the top level of a `builds` config
is accepted; the codemod loads a `.cjs` theme module (bare or wrapped);
`uxdsl/postcss` by name works in a Next 16.3.5 webpack build (the Turbopack
worker was not exercised — the project builds with webpack); the CLI emits no
`:root` into `includeTheme: false` module entries, so the `:root`-stripping
half of the workaround is gone (C4) and the composite re-declaration half
stays until MIG-B9-31. For MIG-B9-14 and MIG-B9-31's "Press Craftor builds
unchanged" re-runs: the clone and the "before" set are in `/tmp`, and the
evidence file's §3 is the parity baseline to compare against.
