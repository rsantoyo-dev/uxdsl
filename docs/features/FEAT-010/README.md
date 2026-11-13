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
  - `packages/uxdsl/CHANGELOG.md`, section `## 0.5.0-beta.9 — unreleased`
    (`## 0.5.0-beta.10 — unreleased` for a story that ships in beta.10,
    DEC-03), with `### Visual changes` when compiled output changes. The
    pre-commit guard (`scripts/verify-docs-update.js`) demands the CHANGELOG
    be staged in the same commit as any file in its `VISUAL_DEFAULT_FILES`
    list, and a package README change for any package code change.
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

### Process by story size

The owner decided on 2026-11-04 (FEAT-010 §2, D1): an S story is delivered
by a light flow, with a scout, one implementer, one review and the
deliverer; the full flow, with a design panel, several implementers, review
lenses and a mutation re-review, is kept for M stories that change the
engine. Every rule of §2 still applies to both.

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
| MIG-B9-02 | [Refresh the repository's dependencies](MIG-B9-02-dependencies.md) | 0 | — | S | — | Merged (PR #45) |
| MIG-B9-03 | [Validate `main` on Press Craftor from a local tarball](MIG-B9-03-validate-main-on-press-craftor.md) | 0 | — | M | 01 | Merged (PR #47) |
| MIG-B9-05 | [The plugin preserves untouched declarations byte for byte](MIG-B9-05-preserve-untouched-declarations.md) | 0 | — | S | — | Merged (PR #30) |
| MIG-B9-04 | [Near-miss function names are errors](MIG-B9-04-near-miss-functions.md) | 0 | DEC-02 | S | — | Merged (PR #44) |
| MIG-B9-10 | [The superset's tests, first](MIG-B9-10-superset-tests-first.md) | 1 | DEC-01 | M | 05 | Merged (PR #34, PR #46) |
| MIG-B9-11 | [`src/sass/protect.ts`: protect and restore](MIG-B9-11-protect-and-restore.md) | 1 | DEC-01, DEC-17 | M | 10 | Merged (PR #49) |
| MIG-B9-12 | [`src/sass/compile-sass.ts`: Dart Sass with the `.uxdsl` importer](MIG-B9-12-compile-sass.md) | 1 | DEC-01, DEC-04 | M | 11 | Merged (PR #62) |
| MIG-B9-13 | [`compile()` on the new pipeline; the subset deleted](MIG-B9-13-compile-on-sass.md) | 1 | DEC-01, DEC-05 | M | 12 | Merged (PR #63) |
| MIG-B9-14 | [The CLI, Vite and webpack on the new pipeline](MIG-B9-14-cli-and-adapters.md) | 1 | DEC-01 | M | 13 | Merged (PR #71) |
| MIG-B9-15 | [Documentation of the superset](MIG-B9-15-superset-docs.md) | 1 | DEC-01 | S | 14 | Merged (PR #72) |
| MIG-B9-20 | [The theme is written where `@uxdsl theme;` is](MIG-B9-20-theme-at-marker-only.md) | 2 | DEC-06 | M | 14 | Ready |
| MIG-B9-21 | [Delete what repeats](MIG-B9-21-delete-what-repeats.md) | 2 | — | M | 13 | Ready |
| MIG-B9-22 | [`build --watch` keeps the entry; the playground drops its own generator](MIG-B9-22-watch-keeps-the-entry.md) | 2 | — | M | 14 | Merged (PR #76) |
| MIG-B9-16 | [The playground's `/docs/language` page on the superset](MIG-B9-16-language-page-superset.md) | 2 | DEC-01 | S | 15 | Ready |
| MIG-B9-23 | [`compile()` within 1.5× of Dart Sass, wherever the project is](MIG-B9-23-compile-within-budget.md) | 2 | — | S | 13 | Merged (PR #75) |
| MIG-B9-25 | [The test suites remove the temporary directories they create](MIG-B9-25-suites-remove-temp-dirs.md) | 2 | — | S | 13 | Ready |
| MIG-B9-26 | [Dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning](MIG-B9-26-near-misses-debug-isolation.md) | 2 | DEC-02 | S | 14, 21 | Ready |
| MIG-B9-17 | [The silent cases of `@use`'s module isolation warn](MIG-B9-17-module-isolation-warnings.md) | 2 | DEC-17 | M | 26 | Ready |
| MIG-B9-27 | [`uxdsl/postcss` in a PostCSS chain: run the Sass-syntax checks at `OnceExit` if that keeps every contract](MIG-B9-27-postcss-chain.md) | 2 | DEC-05 | S | 21 | Ready |
| MIG-B9-28 | [CI on Windows](MIG-B9-28-ci-on-windows.md) | 2 | — | M | — | Ready |
| MIG-B9-29 | [The canonical-grammar codemod is idempotent](MIG-B9-29-codemod-idempotent.md) | 2 | — | S | — | In review (PR #82) |
| MIG-B9-24 | [The plugin's fixed per-build costs](MIG-B9-24-plugin-fixed-costs.md) | 2 | — | S | 20, 21 | Ready |
| MIG-B9-30 | [Breakpoint media queries: `@media (--lg)`](MIG-B9-30-breakpoint-blocks.md) | 3 | DEC-07 | M | 13 | Ready |
| MIG-B9-31 | [Scoped palettes reach every composite](MIG-B9-31-scoped-palettes.md) | 3 | DEC-08 | M | 13 | Ready |
| MIG-B9-32 | [One inheritance rule for roles: `extends`](MIG-B9-32-custom-roles.md) | 3 | DEC-09 | S | 34 | Ready |
| MIG-B9-33 | [Typography `extends`](MIG-B9-33-typography-extends.md) | 3 | DEC-10 | S | 13 | Ready |
| MIG-B9-34 | [The `focus` family and one `:focus-visible` rule](MIG-B9-34-focus-family.md) | 3 | DEC-11 | M | 13 | Ready |
| MIG-B9-35 | [Canvas-identity tones: a contrast warning](MIG-B9-35-canvas-tones.md) | 3 | DEC-12 | S | 13 | Ready |
| MIG-B9-36 | [Inputs: `:user-invalid`](MIG-B9-36-user-invalid.md) | 3 | DEC-13 | S | 13 | Ready |
| MIG-B9-37 | A located warning for a CSS-wide keyword as a theme token value | 3 | — | S | 13 | Draft (story file to be written; registered by D4 of 2026-11-04, as proposed in MIG-B9-03 §15, finding 4) |
| MIG-B9-38 | A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS | 3 | — | S | 14, 22 | Draft (story file to be written; registered by the decision of 2026-11-08 on MIG-B9-14's flag 12, as proposed in its §15; it answers MIG-B9-13 §15, flag 14, and takes over the warning that D18 of 2026-11-04 kept with MIG-B9-14) |
| MIG-B9-39 | Every host's watch recovers after a failed compile | 3 | — | S or split (its scout sizes it) | 14, 21, 22 | Draft (story file to be written; registered by the decision of 2026-11-08 on MIG-B9-14's flag 16, as proposed in its §15) |
| MIG-B9-91 | [The gate and the release record](MIG-B9-91-gate-and-release.md) | 7 | DEC-03 | M | every story of waves 0 to 3; 28 | Draft (re-baseline after wave 3) |
| MIG-B9-44 | The playground's visual comparison harness is deterministic | 4 | — | S | — | Draft (story file to be written; registered by decision 12 of 2026-11-09, as MIG-B9-22's delivery proposed in its §15) |
| MIG-B9-40 | [The playground's design-system layer](MIG-B9-40-playground-design-system-layer.md) | 4 | DEC-14 | M | 22, 30, 33, 34, 44 | Draft (re-baseline after wave 3) |
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
| MIG-B9-66 | CI on Windows, part two: parity, the consumer fixtures and the shims | 6 | — | S or split (its story file sets it) | 28 | Draft (story file to be written; registered by decision 15 of 2026-11-10) |
| MIG-B9-90 | [The test exercise: an app from the public docs only](MIG-B9-90-test-exercise.md) | 7 | — | M | 50 | Draft (re-baseline after wave 3) |
| MIG-B9-92 | The beta.10 gate and release record | 7 | DEC-03 | M | every story of waves 4 to 6; 90 | Draft (story file to be written; registered by D13 of 2026-11-04, as the review's 91b proposed in MIG-B9-91 §15) |

The owner decided DEC-02 to DEC-13, DEC-16 and DEC-17 on 2026-10-23
(FEAT-010 §2): no story is blocked by a decision. Each story a decision
touches has an "Owner decisions of 2026-10-23" block at the end of its §15,
which rules where it differs from the contract.

On 2026-11-04 the owner revised DEC-03 to two releases and registered
MIG-B9-24 to 29, MIG-B9-37 and MIG-B9-92, whose story files are still to be
written (FEAT-010 §2, "Owner decisions of 2026-11-04", whose list numbers
the decisions D1 to D19). `0.5.0-beta.9` ships waves 0 to 3, and MIG-B9-91
closes it: its row sits right after the last wave-3 row, although the story
is in wave 7, because it integrates after wave 3 and before wave 4.
`0.5.0-beta.10` ships waves 4 to 6, and MIG-B9-90 and MIG-B9-92 close it;
the unmerged stories of waves 4 to 6 and MIG-B9-90 name that release in
their header.

MIG-B9-25 is early in wave 2 and MIG-B9-24 is low priority (decisions D2
and D3), so their rows are the first and the last of the wave-2 stories
registered on 2026-11-04. Under §7 that order has two consequences.
MIG-B9-25 waits for MIG-B9-23 (`fixtures/sass-corpus/run.js`) and for
MIG-B9-14 (`packages/uxdsl/test/cli/**`); MIG-B9-23 §15 accepts either order
between it and MIG-B9-25. And MIG-B9-24, the last row before wave 3, makes
MIG-B9-30 to 35 and MIG-B9-37 wait for it (`plugin.ts`, `theme-validate.ts`,
`theme-generator.ts`); only MIG-B9-36 does not, and neither do MIG-B9-38 and
39, registered on 2026-11-08.

Eight stories carry an "Owner decisions of 2026-11-04" block at the end of
their §15 (MIG-B9-03, 12, 13, 15, 23, 52, 90 and 91), which rules where it
differs from the contract or from an earlier block.

On 2026-11-08 the owner settled the flags of MIG-B9-14 and MIG-B9-15, both
merged, so wave 1 is complete, and registered MIG-B9-16, MIG-B9-38 and
MIG-B9-39, whose story files are still to be written (FEAT-010 §2, "Owner
decisions of 2026-11-08", which cites each decision by the flag it answers).
MIG-B9-16 rewrites `/docs/language` for the superset before `0.5.0-beta.9`
ships. Its row follows MIG-B9-22: under §7 it waits for MIG-B9-20 and
MIG-B9-22, which also edit `packages/playground-nextjs/**` (MIG-B9-20 the
same page, at line 103), so MIG-B9-20 and MIG-B9-22, which are Ready, do not
wait for a story whose file is still to be written; the wave-3 stories that
edit the playground (MIG-B9-30, 33, 34, 35 and 36) wait for it in turn.
MIG-B9-38 and 39 are the last wave-3 rows, right before MIG-B9-91; both edit
`bin/uxdsl.js`, so MIG-B9-39 waits for MIG-B9-38. MIG-B9-39 is also on the
rows for `packages/uxdsl/test/cli/**` and `packages/playground-nextjs/**`,
for the watch-mode test and the captures check the decision gives it
(`watch-mode.test.js`, `capture-capabilities.js`), so it also waits for
MIG-B9-25 and for the earlier stories of the playground row. Six stories
carry an "Owner decisions of 2026-11-08" block at the end of their §15
(MIG-B9-14, 15, 20, 21, 22 and 62), which rules where it differs from the
contract or from an earlier block.

On 2026-11-09 the owner settled the flags of MIG-B9-22 and MIG-B9-23, both
merged, and registered MIG-B9-44, whose story file is still to be written
(FEAT-010 §2, "Owner decisions of 2026-11-09", whose list numbers the
decisions 1 to 13). Every wave-4 story relies on
`fixtures/playground-browser/compare.js`, so MIG-B9-44 merges before any of
them starts: its row is the first of wave 4, right after MIG-B9-91's, and
MIG-B9-40 depends on it. It ships in `0.5.0-beta.10` with its wave, so
`0.5.0-beta.9`'s scope does not change. Under §7 it shares
`fixtures/playground-browser/**` with MIG-B9-40 to 43, which follow it. Four
stories carry an "Owner decisions of 2026-11-09" block at the end of their
§15 (MIG-B9-22, 23, 40 and 91), which rules where it differs from the
contract or from an earlier block.

On 2026-11-10 the story files of MIG-B9-16 and MIG-B9-24 to 29 were written,
and a review of them was applied before the owner's; their rows link them,
and §7 follows their Owns and Shares. Each story's §15 holds its open
questions for the owner, answered before the story starts; until then its
contract states the option it assumes. MIG-B9-26 and MIG-B9-28 are M, and
each asks the owner whether to split it. Under §7, MIG-B9-26 now waits for
MIG-B9-16 and 25, MIG-B9-27 for MIG-B9-25 and 26, and MIG-B9-28 for
MIG-B9-20, 25, 26 and 27, since they edit the same test and documentation
files; wave 3's MIG-B9-30 to 36 wait for MIG-B9-27 on `migration.md`, and
MIG-B9-36 also for MIG-B9-26 (the playground, `migration.md`); MIG-B9-24 no
longer waits on `compile.ts`.

On 2026-11-10 the owner then answered those open questions and three of
PR #80's notes, each as recommended (FEAT-010 §2, "Owner decisions of
2026-11-10", whose list numbers the decisions 1 to 32). MIG-B9-26 is split
(decision 6): as an S story it keeps C1 to C3, and takes decision 30's fix
for `compile()` run from standard input; its C4 to C6, module isolation's
silent cases, are MIG-B9-17 (M), whose row follows it and which depends on
it. MIG-B9-26's row now also names MIG-B9-21, which its header already
depended on (C2 relies on `error.warnings`): the split took `compile.ts`, the
§7 row that carried that wait, to MIG-B9-17. MIG-B9-28's second part is
MIG-B9-66, registered for `0.5.0-beta.10` after the last wave-6 row
(decision 15); it depends on MIG-B9-28, and its story file is still to be
written. `migration.md` is append-only (decision 31): a story that rewrites
one of its passages stays serialized on it (the story files name MIG-B9-26,
17, 27 and 52; MIG-B9-20 and 60 are not classified yet), and a story that
only appends its subsection waits for no story on it. So MIG-B9-32, 33, 34
and 36 no longer wait for MIG-B9-26 or 27 on `migration.md`. Besides the
append-only rows (the CHANGELOG and the package README), they share no file
with MIG-B9-27, though 32 to 34 still follow it through MIG-B9-24
(`theme-validate.ts`);
32 to 34 wait for MIG-B9-26 and 17 on `diagnostics.ts`, and 33, 34 and 36
for MIG-B9-26 on the playground. Under §7, MIG-B9-17 takes MIG-B9-26's place
on `compile.ts`, `test/cli/**`, `cli.md` and `unified-engine-audit.md`, and
joins it on `compile-sass.ts`, `diagnostics.ts`, `migration.md`,
`fixtures/release-1.0/run.js`, `verdicts.test.js` and the new
`sass-stage-diagnostics.test.js`: MIG-B9-27 waits for it on `migration.md`,
MIG-B9-28 and 39 on `test/cli/**`, and MIG-B9-30 to 35, 37 and 38 on
`diagnostics.ts` or `run.js`, while MIG-B9-36 waits for MIG-B9-26 on the
playground only.
Eleven stories carry an "Owner decisions of 2026-11-10" block at the end of
their §15 (MIG-B9-16, 17, 24 to 29, 51, 52 and 91), which rules where it
differs from the contract or from an earlier block. The header Status of
MIG-B9-41 to 43, 50 to 52, 54, 55, 60 to 65 and 90 now reads as its row
does (decision 32).

## 6. Branches and merges

- One integration branch, `feat/beta9`, created from `main` by the first
  story. Every story branches from it and merges back into it through a PR
  that CI has run (CI runs on every pull request). The agent that owns a
  story merges its own PR into `feat/beta9` once CI is green and the closure
  record is written; it never merges into `main`.
- The owner merges `feat/beta9` into `main` at the end of each wave (one
  review per wave, in the order of §5), and before each of the two releases
  (DEC-03): `0.5.0-beta.9` after wave 3 and MIG-B9-91, `0.5.0-beta.10` after
  wave 6, MIG-B9-90 and MIG-B9-92.
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
| `packages/uxdsl/src/plugin.ts` | 04, 05, 13, 20, 21, 24, 27, 30, 31, 35 |
| `packages/uxdsl/src/compile.ts` | 13, 20, 21, 17 |
| `packages/uxdsl/src/sass/compile-sass.ts` | 12, 23, 26, 17 |
| `packages/uxdsl/src/sass/protect.ts` | 11, 26 |
| `packages/uxdsl/test/core/compile-sass.test.js` | 12, 25, 26, 28 |
| `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` (new) | 26, 17 |
| `packages/uxdsl/test/cli/**` | 14, 20, 22, 25, 17, 28, 39 |
| `packages/uxdsl/test/no-silent-output.test.js` | 13, 25, 27, 28 |
| `packages/uxdsl/test/core/sass-source-maps.test.js` | 13, 25, 28 |
| `packages/uxdsl/test/vite/index.test.js`, `test/webpack/loader.test.js` | 20, 25 |
| `packages/uxdsl/bin/uxdsl.js` | 14, 20, 22, 38, 39, 60, 61, 63 |
| `packages/uxdsl/src/vite.ts`, `webpack.ts` | 14, 20, 21, 39, 64 |
| `packages/uxdsl/src/diagnostics.ts` | 04, 11, 12, 13, 26, 17, 30, 32, 33, 34, 35, 37, 38 |
| `packages/uxdsl/src/theme/base.json` and `base.contrast-exceptions.json` | 33, 34, 35 |
| `packages/uxdsl/src/ds-runtime/theme-validate.ts` | 24, 32, 33, 34, 37 |
| `packages/uxdsl/src/ds-runtime/theme-generator.ts` | 24, 34 |
| `packages/uxdsl/src/foundations.ts`, `css-blocks.ts`, `reference-core.ts` | 31, 34 |
| `packages/uxdsl/src/control-engine.ts`, `inputs.ts`, `buttons.ts`, `surfaces.ts` | 31, 32, 34, 35, 36 |
| `packages/uxdsl/CHANGELOG.md` | every story that lists it in Owns or Shares (append-only, one subsection per story; MIG-B9-27, in its outcome A, also rewrites MIG-B9-13's `### Breaking` item on PostCSS chains, by decision 14 of 2026-11-10, and no other story edits that item) |
| `AGENTS.md` and the generated agent guide | 01, 04, 13, 15, 20, 30, 31, 32, 33, 34, 35, 36, 51 |
| `packages/uxdsl/docs/integrations/compile.md` | 13, 15, 26, 27 |
| `packages/uxdsl/docs/integrations/cli.md` | 20, 17, 60, 61, 63 |
| `packages/uxdsl/docs/migration.md` | 20, 26, 17, 27, 30, 31, 32, 33, 34, 35, 36, 52, 60 (append-only, one subsection per story, by decision 31 of 2026-11-10; a story that rewrites an existing passage lists the file in Shares and is serialized as before: MIG-B9-26, 17 and 27 rewrite items 6, 9 and 4 of "beta.9 — Sass inside compile()", and MIG-B9-52 restructures the file. A story that only appends its subsection waits for no story on this file) |
| `docs/architecture/unified-engine-audit.md` | 20, 21, 17 |
| `scripts/verify-docs-update.js` | 11, 12, 13, 21, 34 |
| `scripts/agent-guide.test.js` | 25, 51, 52 |
| `fixtures/release-1.0/run.js` | 02, 13, 14, 20, 26, 17, 30, 31, 91, 92 |
| `fixtures/release-1.0/verdicts.test.js` | 14, 25, 26, 17, 66 |
| `fixtures/sass-corpus/run.js`, `run.test.js`, `README.md`, `.gitignore` | 10, 20, 23, 25, 66 (`run.test.js`) |
| `packages/playground-nextjs/**` | 16, 20, 22, 26, 30, 33, 34, 35, 36, 39, 40, 41, 42, 43 |
| `fixtures/playground-browser/**` (MIG-B9-42 and 43: `walk.js`) | 40, 41, 42, 43, 44 |
| `package.json`, `package-lock.json` (root and `packages/uxdsl`) | 01, 02, 10, 12, 13, 25, 91 |
| `packages/uxdsl/README.md` (the docs guard asks almost every code story to touch it) | every code story (append-only, one sentence per story; MIG-B9-26 and 27 also rewrite passages their §11 names, and MIG-B9-28 rewrites the sentence at lines 1550–1553 on `f855765` if `windows-latest` shows the on-disk case, by decision 20 of 2026-11-10) |
| `packages/uxdsl/src/typography.ts` | 31, 33 |
| `packages/uxdsl/src/language.ts` | 04, 30, 31 |
| `scripts/generate-language-artifacts.js` and its artifacts | 30, 32, 33, 34 |
| `packages/uxdsl/src/contrast.ts`, `fixtures/release-1.0/contrast-baseline.json` | 34, 35 |
| `fixtures/mig02-nextjs-cssmodules/browser*.js` | 34, 36 |
| `fixtures/parity/expected/**` | 13, 31, 33, 34 |
| `fixtures/mig07-consumer/**`, `fixtures/webpack-adapter/**` | 20, 66 (`fixtures/mig07-consumer/**`) |
| `fixtures/parity/run.js` | 20, 25, 66 |
| `fixtures/mig-b2-03-cli-init/**` | 20, 22, 25, 66 |
| `packages/_deprecated/shims.test.js`, `fixtures/release-1.0/audit-lock.test.js` | 25, 66 |
| `.github/workflows/ci.yml` | 28, 66 |

The rows that name MIG-B9-16, MIG-B9-17 and MIG-B9-24 to 29 follow the Owns
and Shares of their story files, written on 2026-11-10 (MIG-B9-17's made
from MIG-B9-26's C4 to C6 by decision 6 of 2026-11-10; MIG-B9-24's follow
its questions 1 (b) and 2 (a), which decisions 26 and 27 of 2026-11-10
confirmed; MIG-B9-27's apply whichever outcome it reaches).
A new row is added only where two unmerged stories edit the same file.
MIG-B9-20 is on the rows of the files its story file, or a fact recorded
since, names: its tests under `packages/uxdsl/test/cli/**` (its §8, T3 to
T6), `test/vite/index.test.js` and `test/webpack/loader.test.js` (T7), and
`fixtures/sass-corpus/run.js` (MIG-B9-23 §15: "It owns dropping `run.js`'s
`{ includeTheme: false }`"). Its §15 records that 43 test files pass
`includeTheme`, so its delivery may edit test files no row names for it;
every story registered since 2026-11-04 already comes after it.

The rows that name MIG-B9-37 and 92 come from their proposals, those that
name MIG-B9-38 and 39 from the decisions of 2026-11-08 that registered them,
MIG-B9-44's from decision 12 of 2026-11-09, and MIG-B9-66's from decision 15
of 2026-11-10 and the files MIG-B9-28's question 1, option (b), names for
its second part, before their story files exist; they are provisional: each
story file states its Owns and Shares, and this table follows them before
the story starts.

One file that the decisions of 2026-11-08 may add to an earlier story is
not in the table yet. MIG-B9-21's story file states its Shares before the
story starts, and listing it changes who waits:

- `packages/uxdsl/src/sass/compile-sass.ts` for MIG-B9-21's `error.warnings`
  (MIG-B9-14's flag 11): MIG-B9-26 and 17 would wait for MIG-B9-21 on it,
  and through it for MIG-B9-20. Both already do: MIG-B9-26 because it
  depends on MIG-B9-21 (its §5 row and its header: C2 relies on
  `error.warnings`), MIG-B9-17 through `compile.ts`. MIG-B9-23, which this
  item also named, is merged.

`packages/uxdsl/src/diagnostics.ts`, for the catalog code that the
detection of isolation's silent cases needs (MIG-B9-14 §15, flag 3), is in
the table since MIG-B9-26's story file listed it. Since decision 6 of
2026-11-10 that code, `UXD_MODULE_ISOLATION`, is MIG-B9-17's, and MIG-B9-26
stays on the row for `UXD_SASS_WARNING`'s meaning (decision 7): MIG-B9-30,
32 to 35, 37 and 38 wait for both. `packages/uxdsl/test/cli/**` for
MIG-B9-22 is in the table since decision 11 of 2026-11-09; MIG-B9-22 is
merged, so no story waits for it.

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
