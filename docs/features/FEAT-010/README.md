# FEAT-010 — the stories of 0.5.0-beta.9, for agents

This index is the only table of order and status for
[FEAT-010](../FEAT-010-beta9.md). Each story is the normative source of its own
contract, tests and acceptance; this file says how to work, in which order, and
what every story shares.

## 1. Before anything: read, prepare, verify

1. Read, in this order: the story; this file; [FEAT-010](../FEAT-010-beta9.md)
   (the definition and the decisions); the beta.9 plan
   ([docs/audits/2026-10-08-plan-beta9.md](../../audits/2026-10-08-plan-beta9.md))
   for the reasoning behind the story; `AGENTS.md`; and, for engine work,
   `docs/architecture/unified-engine-audit.md`.
2. Work in your own worktree under `.claude/worktrees/`, on a branch named
   `feat/b9-<nn>-<slug>` from the integration branch (§6). Never touch the
   owner's checkout (`/Users/ricardosantoyo/Documents/projects/uxdsl`, which
   holds uncommitted files), another agent's worktree, or the shared stash.
3. Prepare the worktree exactly as CI does (`.github/workflows/ci.yml`):

   ```bash
   npm ci --ignore-scripts --no-audit --no-fund
   for p in uxdsl uxdsl-vscode playground-nextjs; do (cd "packages/$p" && npm ci --ignore-scripts --no-audit --no-fund); done
   (cd fixtures/mig02-nextjs-cssmodules && npm install --ignore-scripts --no-audit --no-fund)
   npm --prefix packages/uxdsl run build
   node fixtures/mig07-consumer/run.js
   ```

4. Run the story's **Preconditions** block. Every line is a command that must
   exit 0. If one fails, stop and report: the base moved, and the story must be
   re-read against the new base before any code is written. A precondition
   that is only stale (a line number, a count, a file an earlier story of this
   feature renamed) may be corrected by the agent in the story itself, with the
   old and new line recorded in §15; contracts and acceptance criteria are
   never rewritten by the agent. Stories marked **Draft (re-baseline after
   wave 3)** were measured on `685c132` before waves 1–3 rewrite the pipeline:
   one S story after wave 3 re-runs all their preconditions and baselines and
   updates them in a single PR for the owner, before any of them starts.
   Every story's §15 "Review of 2026-10-11" block is applied (or rejected by
   the owner) before the story starts.
5. Run the story's **Baseline** block and compare its output with the recorded
   one. A different output is a finding to record, not a reason to skip it.

## 2. The rules every story follows

- **Failing test first.** Every contract line C-n has a test that fails on
  the base and passes after the change. Write the test, see it fail, then
  change the code through the owning module. No parallel parser, no duplicated
  default, no process-global cache.
- **Negative controls are encoded, never manual.** A test proves it can fail
  by exercising the behavior the change removes (an input that used to pass,
  a mutation the test rejects). No `git stash` to prove a failure.
- **Real browser claims need real Chrome.** Computed styles, modes, focus,
  overflow and hydration are checked by a fixture that drives Chrome
  (`fixtures/playground-browser/walk.js`, `fixtures/mig02-nextjs-cssmodules/browser*.js`
  or a new one next to them). Chrome comes from `UXDSL_CHROME_PATH` or the
  macOS default path. No Chrome is a block, not a pass.
- **What counts as PASS.** A command that exists at the base, was run, and
  exited 0, with its output recorded. A skipped command, an unrun browser
  check or an owner step is listed separately and never marked PASS.
- **Nothing silent.** A new behavior that cannot be honoured is a located
  `UXD_*` error. A new code is added to `DIAGNOSTIC_CATALOG`
  (`packages/uxdsl/src/diagnostics.ts`) with a meaning and a fix, produced by
  the code, and asserted by a test, or `test/diagnostics-catalog.test.js`
  fails.
- **Comments describe behavior, not history.** A story that edits a file
  rewrites the comments it touches so they state the contract. Story IDs stay
  in tests' titles and in the CHANGELOG, not in source comments.
- **Generated artifacts and guards**, after any engine, theme, language or
  CLI change (each story's §10 says which apply):
  - `npm run generate:language` (the completions, the TextMate grammar, the
    theme JSON Schema), then `node scripts/generate-language-artifacts.js --check`.
  - `AGENTS.md` edited in the same change, then `npm run generate:agent-guide`
    (never edit `packages/uxdsl/docs/agent-guide.md`).
  - `packages/uxdsl/CHANGELOG.md`, section `## 0.5.0-beta.9 — unreleased`,
    with `### Visual changes` when compiled output changes. The pre-commit
    guard (`scripts/verify-docs-update.js`) demands the CHANGELOG be staged in
    the same commit as any file in its `VISUAL_DEFAULT_FILES` list, and a
    package README change for any package code change.
  - A new or deleted file under `packages/uxdsl/src` is classified in
    `scripts/verify-docs-update.js` (`VISUAL_DEFAULT_FILES` or
    `NON_VISUAL_SOURCE_FILES` with its reason), or `npm test` fails.
  - The playground, after an engine change: `npm --prefix packages/playground-nextjs run uxdsl:build`
    and `node packages/playground-nextjs/scripts/capture-capabilities.js`
    (`npm test` fails while the captures are stale), and
    `npm run generate:capabilities` (the derived matrix; a new capability
    needs a live example or `npm test` fails).
  - `docs/architecture/*.md`, every README, `AGENTS.md`, `migration.md` and
    the playground documentation components are **compiled** by
    `scripts/doc-examples.test.js`: an example there must compile, and an
    error example must carry its `/* UXD_CODE … */` comment. `docs/features`
    and `docs/audits` are not compiled, which is why design notes with
    hypothetical syntax live there.
- **Hooks.** Never `--no-verify` or `HUSKY=0`. The pre-commit hook runs the
  docs guard and a full playground build (about three minutes).
- **Before each commit:** `npm test`, `npm run verify:doc-examples`,
  `node scripts/generate-language-artifacts.js --check`,
  `node scripts/generate-agent-guide.js --check`, all exit 0. Before a PR:
  `npm run verify:1.0` (or the flags the story names) and
  `npm run verify:playground-browser`. Run suites and gates in the background
  with a log file; keep foreground commands under four minutes.
- **Commit and push after every deliverable.** Sessions get cut.
- **Commits:** `<type>(FEAT-010): MIG-B9-NN - <summary in English>`, ending
  with the `Co-Authored-By` trailer the session gives you. PR bodies end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Authority.** Only the owner merges to `main`, publishes, changes
  dist-tags, deprecates, publishes the extension, and answers a DEC. A story
  whose contract turns out to be wrong is set to Blocked with a finding; its
  acceptance criteria are never rewritten by the agent.

### Verifying without the npm registry

A session that cannot reach `registry.npmjs.org` cannot install, build or
run the suite. It may still deliver a story: the failing test is pushed alone
first and CI records the failure; the change follows; CI green on the branch
is the evidence. The closure record says which checks ran only in CI, that
the pre-commit hook did not run locally, and which checks (browser, Press
Craftor) did not run at all. CI's job logs live on a host such a session may
not reach either; the step that failed (`gh api …/actions/jobs/<id>`) is
then the only failure detail, and the record says so.

## 3. Test policy

What a story's tests must cover, as a checklist the reviewer reads against
the story's §8:

| Level | Where | When required |
| --- | --- | --- |
| Unit, on the public entry points (`uxdsl`, `uxdsl/postcss`, `uxdsl/theme`, `uxdsl/runtime`, `uxdsl/language`, `uxdsl/config`, the CLI as a subprocess) | `packages/uxdsl/test/**/*.test.js`, `node:test` | Every C-n |
| The full matrices | `test/core/sass-matrix.test.js` (replaces `scss-subset.test.js`), `test/core/protect.test.js`, `test/core/compile.test.js` | Every language change |
| Parity | `fixtures/parity` (CLI vs `compile()` vs oracle; `--update` only after reviewing the diff) | Every change to compiled output |
| Tarball | `fixtures/release-1.0/run.js` (`npm run verify:1.0`), new checks under their story id | Every change a consumer sees |
| Chrome | `fixtures/playground-browser/walk.js`, `fixtures/mig02-nextjs-cssmodules/browser*.js`, or a new `fixtures/<story>/browser.js` | Every claim about rendering |
| Performance | `test/performance/*.test.js` (`--test-concurrency=1`) and the budgets a story states | Every change to the pipeline |
| Documentation | `npm run verify:doc-examples`, `npm run generate:capabilities`, the captures | Every documentation change |

A test's title starts with the story id: `MIG-B9-12: a Sass error points at
the author's line`. The negative control is part of the same test or the next
one, titled `… (negative control)`.

## 4. The story template

Every `MIG-B9-NN-<slug>.md` has these sections, in this order. A section
that does not apply says "None" rather than being omitted.

0. **Header table:** Feature · Release; Wave; Decision gate (DEC-nn and its
   state, or none); Status; Size (S or M only; anything larger is split into
   stories, not phases); Depends on; Blocks; Base (branch and minimum SHA);
   Owns (files only this story edits); Shares (files serialized through §7);
   Output impact (none · visual · breaking · API/CLI).
1. **Goal.** The observable result, in two or three sentences.
2. **Sources.** Verbatim quotes with file references.
3. **Preconditions.** Commands that must exit 0 before work starts.
4. **Baseline.** A reproduction with its exact output on the base.
5. **Contract.** Numbered behaviors C-n on public entry points, with exact
   `UXD_*` codes and exit codes, and a "must stay byte-identical" list.
6. **Out of scope.** Each item with its destination.
7. **Approach and traps.** Non-normative. Ends with the stop rule.
8. **Tests.** A table: id, file, title, level, proves C-n, negative control.
9. **Acceptance criteria.** Immutable AC-n lines: command, expected exit,
   test file, mutation that makes it fail. Owner checks in a separate list.
10. **Generated artifacts and guards.** The checklist of §2 with yes/no.
11. **Documentation.** Exact files and sections.
12. **Verification.** Exact commands, expected exit codes, which run in the
    background.
13. **Delivery.** Branch, commit subject, PR title and body skeleton.
14. **Closure record.** Filled once, in the delivering PR: base SHA, PR
    number, environment, commands with exit codes, controls run, owner steps
    pending. No later commits for it.
15. **Findings and follow-ups.** New facts with a proposed story id; never
    fixed inside this story.

Status vocabulary, closed: `Blocked (DEC-nn)` · `Ready` · `In progress` ·
`In review (PR #n)` · `Merged` · `Superseded by MIG-B9-NN`.

## 5. Status and order

Rows are in integration order. "Depends on" lists stories that must be
merged into the integration branch first; a story with no dependency inside
its wave can run in parallel with its siblings, within §7.

| ID | Story | Wave | Decision gate | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| MIG-B9-01 | [Renumber to 0.5.0-beta.9 and record beta.8](MIG-B9-01-renumber-and-record-beta8.md) | 0 | — | S | — | Merged (PR #33) |
| MIG-B9-02 | [Refresh the repository's dependencies](MIG-B9-02-dependencies.md) | 0 | — | S | — | In review (PR #45) |
| MIG-B9-03 | [Validate `main` on Press Craftor from a local tarball](MIG-B9-03-validate-main-on-press-craftor.md) | 0 | — | M | 01 | In review (PR #47) |
| MIG-B9-05 | [The plugin preserves untouched declarations byte for byte](MIG-B9-05-preserve-untouched-declarations.md) | 0 | — | S | — | Merged (PR #30) |
| MIG-B9-04 | [Near-miss function names are errors](MIG-B9-04-near-miss-functions.md) | 0 | DEC-02 | S | — | In review (PR #44) |
| MIG-B9-10 | [The superset's tests, first](MIG-B9-10-superset-tests-first.md) | 1 | DEC-01 | M | 05 | In review (PR #46; part 1 merged, PR #34) |
| MIG-B9-11 | [`src/sass/protect.ts`: protect and restore](MIG-B9-11-protect-and-restore.md) | 1 | DEC-01, DEC-17 | M | 10 | In review (PR #49) |
| MIG-B9-12 | [`src/sass/compile-sass.ts`: Dart Sass with the `.uxdsl` importer](MIG-B9-12-compile-sass.md) | 1 | DEC-01, DEC-04 | M | 11 | Ready |
| MIG-B9-13 | [`compile()` on the new pipeline; the subset deleted](MIG-B9-13-compile-on-sass.md) | 1 | DEC-01, DEC-05 | M | 12 | Ready |
| MIG-B9-14 | [The CLI, Vite and webpack on the new pipeline](MIG-B9-14-cli-and-adapters.md) | 1 | DEC-01 | M | 13 | Ready |
| MIG-B9-15 | [Documentation of the superset](MIG-B9-15-superset-docs.md) | 1 | DEC-01 | S | 14 | Ready |
| MIG-B9-20 | [The theme is written where `@uxdsl theme;` is](MIG-B9-20-theme-at-marker-only.md) | 2 | DEC-06 | M | 14 | Ready |
| MIG-B9-21 | [Delete what repeats](MIG-B9-21-delete-what-repeats.md) | 2 | — | M | 13 | Ready |
| MIG-B9-22 | [`build --watch` keeps the entry; the playground drops its own generator](MIG-B9-22-watch-keeps-the-entry.md) | 2 | — | S | 14 | Ready |
| MIG-B9-30 | [Breakpoint media queries: `@media (--lg)`](MIG-B9-30-breakpoint-blocks.md) | 3 | DEC-07 | M | 13 | Ready |
| MIG-B9-31 | [Scoped palettes reach every composite](MIG-B9-31-scoped-palettes.md) | 3 | DEC-08 | M | 13 | Ready |
| MIG-B9-32 | [One inheritance rule for roles: `extends`](MIG-B9-32-custom-roles.md) | 3 | DEC-09 | S | 34 | Ready |
| MIG-B9-33 | [Typography `extends`](MIG-B9-33-typography-extends.md) | 3 | DEC-10 | S | 13 | Ready |
| MIG-B9-34 | [The `focus` family and one `:focus-visible` rule](MIG-B9-34-focus-family.md) | 3 | DEC-11 | M | 13 | Ready |
| MIG-B9-35 | [Canvas-identity tones: a contrast warning](MIG-B9-35-canvas-tones.md) | 3 | DEC-12 | S | 13 | Ready |
| MIG-B9-36 | [Inputs: `:user-invalid`](MIG-B9-36-user-invalid.md) | 3 | DEC-13 | S | 13 | Ready |
| MIG-B9-40 | [The playground's design-system layer](MIG-B9-40-playground-design-system-layer.md) | 4 | DEC-14 | M | 22, 30, 33, 34 | Draft (re-baseline after wave 3) |
| MIG-B9-41 | [One demo frame, one token editor](MIG-B9-41-playground-demo-frame-and-editor.md) | 4 | DEC-14 | M | 40 | Draft (re-baseline after wave 3) |
| MIG-B9-42 | [Every principle demonstrated live, the superset included](MIG-B9-42-playground-principles-live.md) | 4 | DEC-14 | M | 41 | Draft (re-baseline after wave 3) |
| MIG-B9-43 | [Nothing hand-written, nothing hardcoded, enforced](MIG-B9-43-playground-nothing-hardcoded.md) | 4 | DEC-14 | M | 42 | Draft (re-baseline after wave 3) |
| MIG-B9-50 | [README, home and quick start](MIG-B9-50-readme-home-quick-start.md) | 5 | — | M | 15, 20 | Draft (re-baseline after wave 3) |
| MIG-B9-51 | [AGENTS.md and CONTRIBUTING.md](MIG-B9-51-agents-and-contributing.md) | 5 | — | M | 15 | Draft (re-baseline after wave 3) |
| MIG-B9-52 | [Migration guide in English; CHANGELOG "What changes for you"](MIG-B9-52-migration-and-changelog.md) | 5 | — | S | 01 | Draft (re-baseline after wave 3) |
| MIG-B9-53 | [Signals that it is maintained](MIG-B9-53-maintenance-signals.md) | 5 | — | S | — | Merged (PR #35) |
| MIG-B9-54 | ["Why UXDSL" and the browser examples](MIG-B9-54-why-uxdsl-and-browser-examples.md) | 5 | — | M | 50 | Draft (re-baseline after wave 3) |
| MIG-B9-55 | [The VS Code extension, packaged](MIG-B9-55-vscode-extension.md) | 5 | — | S | 30 | Draft (re-baseline after wave 3) |
| MIG-B9-60 | [`uxdsl doctor [--fix]`](MIG-B9-60-doctor.md) | 6 | — | M | 20 | Draft (re-baseline after wave 3) |
| MIG-B9-61 | [`uxdsl audit` and `uxdsl migrate --suggest`](MIG-B9-61-audit-and-migrate.md) | 6 | — | M | 43 | Draft (re-baseline after wave 3) |
| MIG-B9-62 | [The generated language reference](MIG-B9-62-generated-reference.md) | 6 | — | M | 30, 34 | Draft (re-baseline after wave 3) |
| MIG-B9-63 | [`uxdsl explain` and editor hover with the project theme](MIG-B9-63-explain-and-hover.md) | 6 | — | M | 62 | Draft (re-baseline after wave 3) |
| MIG-B9-64 | [`emit: 'used'`, opt-in](MIG-B9-64-emit-used.md) | 6 | — | M | 20 | Draft — recommended cut (review 2026-10-11) |
| MIG-B9-65 | [Container context: a design note](MIG-B9-65-container-context-note.md) | 6 | — | S | 30 | Draft (re-baseline after wave 3) |
| MIG-B9-90 | [The test exercise: an app from the public docs only](MIG-B9-90-test-exercise.md) | 7 | — | M | 50 | Draft (re-baseline after wave 3) |
| MIG-B9-91 | [The gate and the release record](MIG-B9-91-gate-and-release.md) | 7 | DEC-03 | M | every story of waves 0 to 6; 90 | Draft (re-baseline after wave 3) |

The owner decided DEC-02 to DEC-13, DEC-16 and DEC-17 on 2026-10-23
(FEAT-010 §2): no story is blocked by a decision. Each story a decision
touches has an "Owner decisions of 2026-10-23" block at the end of its §15,
which rules where it differs from the contract.

## 6. Branches and merges

- One integration branch, `feat/beta9`, created from `main` by the first
  story. Every story branches from it and merges back into it through a PR
  that CI has run (CI runs on every pull request). The agent that owns a
  story merges its own PR into `feat/beta9` once CI is green and the closure
  record is written; it never merges into `main`.
- The owner merges `feat/beta9` into `main` at the end of each wave (one
  review per wave, in the order of §5), and before the one release
  (DEC-03).
- A story that needs a decision stops at `Blocked (DEC-nn)` with its branch
  pushed and the finding written in its §15.

## 7. Shared files, serialized

Two stories that edit the same file must not run at the same time, in the
same wave or not; the later row in §5 waits for the earlier one to merge. In
particular every wave-3 story waits for MIG-B9-21, whose K7 rewrites comments
in every `src` file, and MIG-B9-22 runs before MIG-B9-20 (both edit
`bin/uxdsl.js`).

| File | Stories that edit it |
| --- | --- |
| `packages/uxdsl/src/plugin.ts` | 04, 05, 13, 20, 21, 30, 31, 35 |
| `packages/uxdsl/src/compile.ts` | 13, 20, 21 |
| `packages/uxdsl/bin/uxdsl.js` | 14, 20, 22, 60, 61, 63 |
| `packages/uxdsl/src/diagnostics.ts` | 04, 11, 12, 13, 30, 32, 33, 34, 35 |
| `packages/uxdsl/src/theme/base.json` and `base.contrast-exceptions.json` | 33, 34, 35 |
| `packages/uxdsl/src/ds-runtime/theme-validate.ts` | 32, 33, 34 |
| `packages/uxdsl/src/foundations.ts`, `css-blocks.ts`, `reference-core.ts` | 31, 34 |
| `packages/uxdsl/src/control-engine.ts`, `inputs.ts`, `buttons.ts`, `surfaces.ts` | 31, 32, 34, 35, 36 |
| `packages/uxdsl/CHANGELOG.md` | every story with output impact (append-only, one subsection per story) |
| `AGENTS.md` and the generated agent guide | 01, 04, 13, 15, 20, 30, 31, 32, 33, 34, 35, 36, 51 |
| `scripts/verify-docs-update.js` | 11, 12, 13, 21, 34 |
| `fixtures/release-1.0/run.js` | 02, 13, 14, 20, 30, 31, 91 |
| `packages/playground-nextjs/**` | 20, 22, 30, 33, 34, 35, 36, 40, 41, 42, 43 |
| `package.json`, `package-lock.json` (root and `packages/uxdsl`) | 01, 02, 10, 12, 13 |
| `packages/uxdsl/README.md` (the docs guard asks almost every code story to touch it) | every code story (append-only, one sentence per story) |
| `packages/uxdsl/src/typography.ts` | 31, 33 |
| `packages/uxdsl/src/language.ts` | 04, 30, 31 |
| `scripts/generate-language-artifacts.js` and its artifacts | 30, 32, 33, 34 |
| `packages/uxdsl/src/contrast.ts`, `fixtures/release-1.0/contrast-baseline.json` | 34, 35 |
| `fixtures/mig02-nextjs-cssmodules/browser*.js` | 34, 36 |
| `fixtures/parity/expected/**` | 13, 31, 33, 34 |
| `fixtures/mig07-consumer/**`, `fixtures/parity/run.js`, `fixtures/mig-b2-03-cli-init/**`, `fixtures/webpack-adapter/**` | 20 |

## 8. Decision register

| FEAT-010 | Plan 2026-10-08 | FEAT-009 | Audit 2026-09-29 | Press Craftor |
| --- | --- | --- | --- | --- |
| DEC-01 superset | D-1 | — | reopens DE-2 | — |
| DEC-02 `space()` and near-misses | — | — | DE-5 (one grammar) | — |
| DEC-03 release cut | §10 | — | — | — |
| DEC-04 `sass` dependency | D-1 inner | — | — | — |
| DEC-05 plugin without Sass | — | — | — | — |
| DEC-06 theme at the marker | — | — | amends §5.3 (plugin options) | 7a |
| DEC-07 breakpoint blocks | D-2, D-9 | — | adds syntax (§5.3) | — |
| DEC-08 scoped palettes | D-4, §8.1 | — | — | item 1, F‑16 |
| DEC-09 custom roles | D-5 | — | — | 2b, F‑11 |
| DEC-10 typography | D-6 | — | — | 3, F‑9, F‑13 |
| DEC-11 focus | D-7 | — | adds a family (§5.3) | 4, F‑14 |
| DEC-12 canvas tones | D-8, §4.3 | D-8 (opposite) | reverses DE-7 | — |
| DEC-13 `:user-invalid` | §8 2c | — | — | 2c, F‑12 |
| DEC-14 playground | §7 | MIG-B7-17 | — | — |
| DEC-15 English | §3.3 | — | DE-12 | 6 |
| DEC-16 evidence once | — | — | §5.5 | — |

## 9. Numbers every story may cite without re-measuring

Measured on `main` at `685c132`, 2026-10-09 to 2026-10-11, macOS, Node 20.19,
Dart Sass 1.94.2 (the playground's copy), Bootstrap 5.3.8:

- The compiled one-rule module: 47,273 bytes with the default `includeTheme`,
  44 bytes without the theme.
- Bootstrap's SCSS (96 files, 87 loaded by the entry) renamed to `.uxdsl`:
  the Sass stage equals plain Dart Sass byte for byte; the UXDSL plugin
  changed 3 declarations (`--bs-btn-font-family: ;` → `:;`) until it stopped
  rewriting untouched values (MIG-B9-05); then byte-identical. Plain Sass
  324–625 ms; the prototype pipeline 385–502 ms (Sass 316–348, restore ≤1,
  plugin 68–154). Deprecation warnings from Bootstrap's own sources:
  `import` 87, `global-builtin` 154, `color-functions` 6.
- The protect/restore case list: 63 cases; the regex prototype gets 21 wrong,
  the tokenizer prototype 2 (one a harness artifact, one the directive-space
  case that DEC-01's grammar now accepts).
- `DIAGNOSTIC_CATALOG`: 107 codes (theme 59, compiler 38, runtime 6, core 4).
- The playground: 19 routes, 55 `.tsx` and 33 `.uxdsl` component files, 42
  `.uxdsl` files; 25 files with their own `<pre>`, 19 with `<button>`, 12 with
  `<input>`, 8 with `<textarea>`; 78 literal `font-size`, 131 hand-written
  `var(--uxdsl__…)`, 128 pixel edge values in `.uxdsl`; 20 `style={{`; two
  hand-written `@media`.
- Press Craftor (`story-radar`): Next.js 16.3.5, the four former packages at
  `0.5.0-beta.8`, 7 `.uxdsl` files (7,883 lines), no Sass feature, hundreds
  of dashed palette references (`palette(dark-main)` 143 times), a 7-entry
  `builds` config, `uxdsl watch` in its scripts, `uxdsl.theme.config.cjs`,
  a PostCSS workaround that re-declares composites on
  `[style*="--uxdsl__palette__"]`, and `scripts/uxdsl-audit.mjs`.
