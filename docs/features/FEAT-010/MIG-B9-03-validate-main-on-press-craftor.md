# MIG-B9-03 — Validate `main` on Press Craftor from a local tarball

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 0 |
| Decision gate | None |
| Status | Ready |
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

To be filled in the delivering PR.

## 15. Findings and follow-ups

Filled by the story. Known before it starts: `uxdsl watch` is gone
(`uxdsl build --watch`); `uxdsl.theme.config.cjs` is a removed name; the
dashed palette grammar is an error; `postcss-uxdsl/ds-runtime` imports (if
any) become `uxdsl/runtime`.
