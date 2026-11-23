# MIG-B9-91 — The gate and the release record

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 7 |
| Decision gate | DEC-03 (revised 2026-11-04: option (b), two releases; revised 2026-11-23: this story gates `0.5.0-beta.9`, with every story merged into `feat/beta9` at `6cdadaf`, and MIG-B9-92 gates `0.5.0-beta.10`) |
| Status | In review (PR #106) |
| Size | M |
| Depends on | every story merged into `feat/beta9` at `6cdadaf`, MIG-B9-28 (CI on Windows) included (decision 1 of 2026-11-23, §15) |
| Blocks | the owner's publish of `0.5.0-beta.9` |
| Base | `feat/beta9` at `6cdadaf` or later, before any moved story merges |
| Owns | `docs/releases/0.5.0-beta.9.md`, `fixtures/release-1.0/run.js` (the DROPPED list and the new checks' wiring), `fixtures/release-1.0/contrast-baseline.json`, `docs/features/FEAT-010/evidence/MIG-B9-91-press-craftor.md` (new) |
| Shares | `packages/uxdsl/CHANGELOG.md` ("What changes for you" and this story's subsection; the heading keeps "unreleased"), `README.md` (the status line), `docs/releases/README.md` (the index row), `packages/uxdsl/package.json` and `packages/uxdsl/package-lock.json` (the `engines` field; the owner's decision D10 of 2026-11-04, §15), root `package.json` (`verify:1.0` through `scripts/tmpdir-guard.js`), `fixtures/release-1.0/verdicts.test.js` (the new verdicts' controls), `fixtures/lib/tarball-consumer.js` (`packAndInstall`'s directory removed on success), `packages/playground-nextjs/package-lock.json` (the `../uxdsl` entry, decision D19), `packages/uxdsl/README.md` (four sentences) and `packages/uxdsl/src/config.ts` (the message of a theme file under a former name), both from the release review (§15, "Delivery of 2026-11-23 (review)") |
| Output impact | none |

## 1. Goal

One command proves the release from the real tarball, in real Chrome, and
one document says what was proven, what was not, and what the owner does
next. Nothing is published by this story.

## 2. Sources

- `fixtures/release-1.0/run.js` (`npm run verify:1.0`): one tarball, installed
  the documented way; every check awaited; a check that cannot run is named
  with its owner; the DROPPED list; `--skip-upgrade`, `--skip-playground-walk`,
  `--write-contrast-baseline`; Chrome from `UXDSL_CHROME_PATH`; 74 checks on
  `feat/beta9` at `6cdadaf` (72 on `main` at `8dacc8b`, 65 at the beta.8-era
  gate `c737fa8`).
- The checks the included stories added: `AUDIT-lock` (02), `S-1`…`S-3`
  (13), `S-4`…`S-6` (14), `S-7` (26, 17), `S-8` (30); rewritten: `B2-b`,
  `B3-a`, `B3-e`, `B4-a`, `UX-12`, `B7-14a` (20), `N-02`, `UX-20` (13),
  `cssmod` (14). `UX-02`, `UX-16` and `contrast` keep their beta.8 labels.
  Not in the beta.9 gate: MIG-B9-31's scoped-palette check, `B9-38`, `DR-1`,
  `AU-1`, `EX-1`/`EX-2`, `EU-1`, `TX-1` (decision 1 of 2026-11-23).
- `docs/releases/0.5.0-beta.9.md` (renamed by MIG-B9-01, figures to refresh);
  `scripts/release.js --version --tag --otp --dry-run --skip-build`;
  the audit's rule: "Prepublish, browser, external-consumer and postpublish
  evidence are separate"; "Planning and verification do not authorize
  publishing or changing dist-tags."
- The handoff's rule: never claim an unrun check.

## 3. Preconditions

```bash
test -f docs/releases/0.5.0-beta.9.md
git merge-base --is-ancestor 6cdadaf HEAD   # MIG-B9-90 ships in 0.5.0-beta.10
git -C . log --oneline -1 origin/feat/beta9 >/dev/null
```

## 4. Baseline

```bash
npm run verify:1.0 2>&1 | tail -5   # the count of checks and the result on the integration branch
```

## 5. Contract

- **G1 — The gate is complete.** `verify:1.0` runs every check the included
  stories added, under their ids; the DROPPED list names each check removed
  in beta.9 and why (for example the `includeTheme` flag checks replaced by
  marker checks); the summary prints the total and the delegated items
  (owner steps) separately.
- **G2 — Green twice.** The gate passes locally (macOS, Chrome) and in CI
  (Linux, Chrome) on the integration branch at the release commit; the two
  runs' summaries are in the record.
- **G3 — The record.** `docs/releases/0.5.0-beta.9.md`: status (prepublish,
  not published); what this release is (one paragraph, "What changes for
  you" copied from the CHANGELOG); verification: automated (the gate's
  summary with the check count, `npm test`'s count, `verify:doc-examples`'s
  count, the tarball size and file count against the 300 KB budget, the fresh
  install's `npm audit`, the dry run of `release.js`), browser (what the gate
  walked), external (Press Craftor on the final tarball: this story's re-run,
  compared with the MIG-B9-03 and MIG-B9-14 evidence), manual pending (VS Code with the VSIX installed), postpublish
  pending (dist-tags, a fresh `npm i -D uxdsl`, the StackBlitz links, the
  extension publish); publish steps for the owner (the exact commands with
  `--otp <code>` placeholders; the five former names: deprecate, optionally
  the shims at beta.9); afterwards (bump to `0.5.0-beta.9.dev`); known
  limitations (honest, from the stories' §15); moved to beta.10 (per DEC-03).
- **G4 — Dates and versions.** The CHANGELOG's beta.9 heading keeps
  "unreleased" until the owner publishes; the record says so; `README.md`'s
  status line names beta.9 as the release candidate of the branch.
- **G5 — The bump commit, prepared.** A commit that sets `0.5.0-beta.9.dev`
  in `packages/uxdsl/package.json` and the lockfile is prepared on a branch
  `chore/after-beta9-publish` for the owner to merge after publishing; it is
  not merged by the agent.

Must stay byte-identical: the tarball the gate verified is the tarball the
owner publishes (same commit).

## 6. Out of scope

- Publishing, dist-tags, deprecations, the extension publish: the owner's.
- The beta.10 gate: this story is repeated for beta.10 with its own record.

## 7. Approach and traps

- Run the gate in the background with a log; it takes long (CI's job has a
  60-minute timeout).
- The record's figures come from the gate's output, pasted, never typed from
  memory.
- `scripts/docs-provenance.test.js` scans the record.
- Stop rule: a red check is a story's regression; the record is not written
  until the gate is green.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `fixtures/release-1.0/run.js` | the full gate, locally and in CI | tarball + Chrome | G1, G2 | the gate's own negative controls |
| T2 | `scripts/docs-provenance.test.js`, `scripts/version-mentions.test.js`, `scripts/docs-shape.test.js` (`changelog-shape.test.js` is MIG-B9-52's, `0.5.0-beta.10`) | the record and the CHANGELOG pass | docs | G3, G4 | — |
| T3 | `node scripts/release.js --version 0.5.0-beta.9 --tag latest --dry-run --skip-build` | the publish dry run | release | G3 | — |

## 9. Acceptance criteria

- **AC1** `npm run verify:1.0` exits 0 locally with every included check ok;
  the CI run on the release commit is green (link in the record).
- **AC2** `docs/releases/0.5.0-beta.9.md` has every section of G3 with figures
  from the gate output.
- **AC3** The dry run exits 0.
- **AC4** `npm test` exits 0.

Owner steps (from the record): publish with `release.js`, add the `beta`
dist-tag, deprecate the five names, optionally publish the shims, publish the
VSIX, verify the postpublish checks, merge the bump commit.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| contrast baseline | as at `6cdadaf` (0 failing, 111 excepted); the gate verifies it; MIG-B9-35's re-pin is `0.5.0-beta.10` |
| playground captures | current (the gate's `B7-17` checks) |

## 11. Documentation

`docs/releases/0.5.0-beta.9.md`, `docs/releases/README.md` (the index row),
`README.md` (status line).

## 12. Verification

```bash
TMPDIR=<scratch>/tmp-<role>/ npm run verify:1.0 > <scratch>/gate-beta9.log 2>&1   # background; exit 0
node scripts/release.js --version 0.5.0-beta.9 --tag latest --dry-run --skip-build   # exit 0
node --test scripts/docs-provenance.test.js scripts/version-mentions.test.js scripts/docs-shape.test.js   # exit 0
npm test                                                  # background; exit 0
```

## 13. Delivery

Branch `feat/b9-91-gate`. Commit:
`docs(FEAT-010): MIG-B9-91 - the beta.9 gate complete and green; the release record`.
Then the owner merges `feat/beta9` into `main` and publishes from a clean
checkout of `main`.

## 14. Closure record

Delivered on `feat/b9-91-gate`, branched from `6d38d19` (`feat/beta9` at
`6cdadaf` plus the owner decisions of 2026-11-23, PR #105), with
`feat/beta9` at `ad79871` (PR #105 merged) merged in as `5949268`. The final
gate ran on `d44252b`, after the release review's fixes (§15, "Delivery of
2026-11-23 (review)"); the commits after it change no packaged file (the
record, this story and the index), so the tarball the gate verified is the
one the branch carries. The owner's publish step re-runs the gate on the
`main` commit it publishes. Environment:
macOS 27.0, MacBookPro18,3, Node v20.19.0, npm 11.21.1, Google Chrome
158.0.8127.37; every run with `TMPDIR` in the session's scratch directory.
Figures are pasted from the logs.

| Criterion | Evidence | Result |
| --- | --- | --- |
| G1 | `npm run verify:1.0` on `d44252b`: the 74 checks of `6cdadaf` under their ids plus `I-7` and `LOCK-pg`; DROPPED names `B3-e (beta.8)` and `UX-12 (beta.8)`; DELEGATED's external line names the Press Craftor evidence | "76/76 automated checks passed." |
| G2, local | the same run, with no other run of this delivery, 20:13:42–20:20:04 UTC, load 3.27 → 6.35; `UX-10` "x1.98 per doubling (fastest of 5 rounds: 1600 blocks 171 ms, 3200 blocks 339 ms; load 3.71 4.63 5.50)" (earlier: 76/76 on `3267c93`, 75/76 on `82b676d`) | exit 0; `ls -A` of its `TMPDIR` afterwards: 0 entries |
| G2, CI | the gate PR's run | green: [run 45244860590](https://github.com/rsantoyo-dev/uxdsl/actions/runs/45244860590) of PR #106 on `09849f3` (the merge into `feat/beta9`), 19:03–19:20 UTC: `npm test` success (1,727 tests, 1,713 pass, 0 fail, 14 skipped); `verify:1.0 (one tarball, real Chrome)` success, "76/76 automated checks passed." (`UX-10` x1.80, load 1.31); `npm test (uxdsl, Windows)` success, with `test/cli/watch-mode.test.js` run and reported as its named exclusion ("exit 1: node --test test/cli/watch-mode.test.js (excluded from the Windows gate)") |
| G3 | `docs/releases/0.5.0-beta.9.md` rewritten from the logs; `node --test scripts/docs-provenance.test.js scripts/version-mentions.test.js scripts/docs-shape.test.js` | exit 0, 16 tests, 16 pass |
| G4 | CHANGELOG heading "0.5.0-beta.9 — unreleased"; `README.md` "(0.5.0-beta.9: this branch's release candidate, not published yet)"; releases index "release candidate, not published" | T2 above |
| G5 | `chore/after-beta9-publish`, one commit, pushed, no PR (§15, "Delivery of 2026-11-23") | see there |
| AC1 | the gate (above) and CI | local exit 0; CI green: [run 45244860590](https://github.com/rsantoyo-dev/uxdsl/actions/runs/45244860590) of PR #106 on `09849f3` (the merge into `feat/beta9`), 19:03–19:20 UTC: `npm test` success (1,727 tests, 1,713 pass, 0 fail, 14 skipped); `verify:1.0 (one tarball, real Chrome)` success, "76/76 automated checks passed." (`UX-10` x1.80, load 1.31); `npm test (uxdsl, Windows)` success, with `test/cli/watch-mode.test.js` run and reported as its named exclusion ("exit 1: node --test test/cli/watch-mode.test.js (excluded from the Windows gate)") |
| AC2 | the record | every G3 section, figures from the logs |
| AC3 | `node scripts/release.js --version 0.5.0-beta.9 --tag latest --dry-run --skip-build`, on `d44252b` | exit 0, "uxdsl: 299.8KB / 300KB budget — ok", "Release complete."; the tarball 307,006 B packed, 90 files, 194 bytes to spare |
| AC4 | `npm test` on `e090c28` (the package and gate of `d44252b`) | exit 0: the 29 `node --test` runs it holds report 1,728 tests, 1,719 pass, 0 fail, 9 skipped (on `3267c93`, before the review's fixes: 1,727, 1,718, 0, 9; the base `6d38d19`: 1,718, 1,709, 0, 9), and its other steps (parity, the CLI `init` fixture, the generated-artifact checks) exit 0; `scripts/tmpdir-guard.js` found its temporary directory empty |
| D9 (P10) | `node fixtures/sass-corpus/run.js` three times, alone, at `3e1e269` (the package as at `3267c93`) | exit 0 each; byte-identical; 1.19x, 1.28x, 1.47x; load 4.04, 4.84, 4.93 |
| The budget fixture | `node fixtures/mig-b9-23-compile-budget/run.js --base <a build of 6cdadaf>` at `3e1e269` | exit 0, "All checks ok."; T3 −2.4 ms |
| D10 | `engines` in `packages/uxdsl/package.json` and its lockfile (written by `npm install --package-lock-only`); `I-7` and its verdict tests | gate `I-7` ok |
| D19 | the playground lockfile's `../uxdsl` entry refreshed (diff limited to that entry); `npm ci --ignore-scripts` there; `LOCK-pg` | exit 0 ("added 1133 packages"); gate `LOCK-pg` ok |
| D13 (external) | Press Craftor on the candidate: `evidence/MIG-B9-91-press-craftor.md` | built after finding 1's wrapper change; Chrome as MIG-B9-03 recorded |

Failing-first: the eight verdict tests for `UX-10`, `I-7`, `LOCK-pg`, the
free port and DROPPED failed before the code (`assertNearLinear is not a
function`, …; 8 of 8 failing), and the test for `installedManifests` failed
with `installedManifests is not a function` before it existed. Each verdict
has its negative control in `fixtures/release-1.0/verdicts.test.js`.

Not run or not a pass: the CI run of the release commit itself (the owner's
`feat/beta9` → `main` PR); `verify:1.0` on Windows (decision 16 of
2026-11-10); the VS Code VSIX check (manual, the owner's); the postpublish
checks; Press Craftor's database routes.

## 15. Findings and follow-ups

The known limitations the record lists, each with its story id.

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Blocking — DEC-03 (b) cannot run with this story.** Its precondition needs `fixtures/test-exercise/run.js` (MIG-B9-90), T2 runs `changelog-shape.test.js` (MIG-B9-52), and §2/G3 need tools, the VSIX and StackBlitz links from waves 5–7. Split it: **91a** for beta.9 (waves 0–3, the MIG-B9-03/14 Press Craftor re-run, a minimal English beta.8 → beta.9 migration section and "What changes for you") and **91b** for beta.10. Stop hard-coding "beta.9" in 52, 55 and 91.
- G5: `0.5.0-beta.10-dev` sorts above `0.5.0-beta.10` (an alphanumeric identifier outranks a numeric one); use `0.5.0-beta.9.dev` after publishing beta.9.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-03 is (a): one release.** This story gates `0.5.0-beta.9` with every wave; there is no 91a/91b split and no beta.10 gate (the "repeated for beta.10" line is void). The review's blocking finding about (b) no longer applies.
- The record's "moved to beta.10" section lists only what the owner cuts explicitly, if anything. G5's bump: the next version is `1.0.0-rc.1`; choose a development version that sorts below it (the review's note on G5 explains why `-dev` suffixes can sort above their release).

### Owner decisions of 2026-11-04 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-04). The owner was given 19 numbered recommendations, in Spanish, and answered, verbatim, "voy a seguir todas tus recomendciones" ("I will follow all your recommendations"): each recommendation is the owner's decision of 2026-11-04. This record is in English and lists those that concern this story. Where they differ from this story's contract, from the review above or from the owner decisions of 2026-10-23, they rule.

- **DEC-03 is (b): two releases (decision D13 of 2026-11-04).** `0.5.0-beta.9` ships waves 0 to 3 and this story, the beta.9 gate, which includes the Press Craftor re-run and an English beta.8 → beta.9 migration section. `0.5.0-beta.10` ships waves 4 to 6, MIG-B9-90 and MIG-B9-92, the beta.10 gate and release record (the plan's "91b"). The stories registered on 2026-11-04 ship in beta.9: MIG-B9-24 to 29 (wave 2) and MIG-B9-37 (wave 3). The DEC-03 item of the block of 2026-10-23 above is superseded, and the review's blocking finding above applies again, with this story as its 91a and MIG-B9-92 as its 91b. The header's Decision gate, Depends on and Blocks follow this decision (Depends on also follows decision D11, below, and Shares follows decision D10).
- **What decision D13 changes in the block of 2026-10-23:** the record's "moved to beta.10" section is no longer limited to what the owner cuts, since decision D13 moves waves 4 to 6 and MIG-B9-90 to beta.10; and G5's next version after `0.5.0-beta.9` is `0.5.0-beta.10`, not `1.0.0-rc.1`, so the development version must sort below `0.5.0-beta.10` (the review's note on G5 above).
- **P10 re-measured before the publish (decision D9 of 2026-11-04).** On the owner's Mac, with the corrected method of decision D8 (MIG-B9-23), this story re-measures P10 before publishing.
- **`engines` (decision D10 of 2026-11-04).** `uxdsl` declares `"engines": { "node": ">=20.19" }` (MIG-B9-12's owner flag 11: `sass` 1.107.0, `chokidar` 5 and `readdirp` 5 require it), in this story, with the release note in the beta.9 migration section.
- **CI on Windows (decision D11 of 2026-11-04).** CI runs on Windows before the release: this story depends on MIG-B9-28, "CI on Windows" (wave 2; its scout sizes it, S or split). Windows is unverified today (MIG-B9-13's owner flag 20; MIG-B9-23's `realCase` path runs on win32).
- **The playground's lockfile (decision D19 of 2026-11-04).** MIG-B9-12's owner flag 15 is accepted as delivered, and its lockfile item goes to this story: the playground's lockfile records `../uxdsl`'s manifest, stale for devDependencies since MIG-B9-10, while `npm ci` there still passes.

### Owner decisions of 2026-11-09 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-09). The owner was given 13 numbered recommendations, in Spanish, on the owner flags of MIG-B9-22 and MIG-B9-23 and on three housekeeping items, and answered, verbatim, "todoc omo recomendadi" ("todo como recomendado", "everything as recommended"): each recommendation is the owner's decision of 2026-11-09. This record is in English and lists those that concern this story. Where they differ from this story's contract or from an earlier block, they rule.

- **T3's paired statistic (decision 4, on MIG-B9-23's flag 4).** MIG-B9-23's budget fixture (`fixtures/mig-b9-23-compile-budget/run.js`) keeps the difference of the two medians that its C2 names, with 61 rounds by default (C2 allows at least 9). This story decides whether T3 also reports a paired statistic, the median of per-round differences (MIG-B9-23 §15, "Delivery of 2026-11-09", flag 4 and new fact 5).

### Owner decisions of 2026-11-10 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-10). The owner was given 32 numbered questions, in Spanish, on the open questions of the seven story files written on 2026-11-10 and on three notes of their PR (#80), each with its options and a recommendation, and answered, verbatim, "fusiona y haz como recmiendes" ("fusiona y haz como recomiendes", "merge, and do as you recommend"): PR #80 was merged, and each recommendation is the owner's decision of 2026-11-10. This record is in English and lists those that concern this story. Each proposes a follow-up for this story or states what the gate covers; none changes its contract, and the re-baseline after wave 3 decides how each enters.

- **The gate's temporary directories (decision 4, on MIG-B9-25's question 2).** MIG-B9-25 makes `npm test` leave its temporary directory as it found it, and `npm test` only. The leftovers of the release gate and of the `verify:*` fixtures are a follow-up proposed for this story: MIG-B9-23's new fact 8 recorded that `verify:1.0` left 18 entries, and `fixtures/lib/tarball-consumer.js`'s `packAndInstall`, which the gate, the Vite, webpack and consumer fixtures and `fixtures/mig-b2-03-cli-init/run.js` use, never removes the directory it makes (MIG-B9-25 §15, question 2).
- **`verify:1.0` on Windows (decision 16, on MIG-B9-28's question 2).** Not in `0.5.0-beta.9`. The gate runs where it runs today; MIG-B9-28's Windows job runs the `uxdsl` package's own suites, and MIG-B9-66, registered by decision 15 for `0.5.0-beta.10`, the parity, consumer-fixture and shim checks on Windows.
- **A product defect the Windows job finds (decision 19, on MIG-B9-28's question 5).** MIG-B9-28 stops at the first failure whose cause is in `packages/uxdsl/src` or `bin`, and the owner decides each defect: a fix in MIG-B9-28, or a follow-up story. This story depends on MIG-B9-28 (D11), so it starts after those answers and MIG-B9-28's merge; whether a defect sent to a follow-up story is in `0.5.0-beta.9` is the owner's decision at that time.

### Owner decisions of 2026-11-10, on MIG-B9-29's delivery flags (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-10), as decisions 33 to 37. On 2026-11-10 the owner gave a standing instruction for FEAT-010, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"). MIG-B9-29's delivery (PR #82, merged as `a00fbbe`) left five owner flags in its §15, "Delivery of 2026-11-10". They were not put to the owner one by one: under that instruction each recommendation is the owner's decision of 2026-11-10, and the owner may still override any of them. This record is in English and lists the two that concern this story. Where they differ from this story's contract or from an earlier block, they rule.

- **The second codemod instruction in beta.9's record (decision 37, on MIG-B9-29's flag 5, its F5).** This story removes it when it writes `docs/releases/0.5.0-beta.9.md`, the record it owns. On `a00fbbe` that record prescribes the codemod twice in "Moving `story-radar` (or any beta.6 or beta.8 project)": lines 158–160 run it (a preview, then `--write`), and lines 167–168 repeat it in the paragraph after them, "run the grammar codemod over the `.uxdsl` files; rebuild and compare". The one at lines 167–168 is removed. Decision D4 of 2026-11-04 had given that instruction to MIG-B9-52, which ships in `0.5.0-beta.10`: its §15, "Owner decisions of 2026-11-04", says "The finding's target for this story is "MIG-B9-52 (one instruction)" (MIG-B9-03 §15)". Decision 37 moves it to this story. Since MIG-B9-29, a second run is harmless for typography names (MIG-B9-29 §15, flag 5).
- **The gate requires MIG-B9-18 merged (decision 35, on MIG-B9-29's flag 3).** MIG-B9-29's package README sentence ("so a second run changes nothing") and its CHANGELOG sentence ("Running the codemod again now changes nothing.") stay as written. They hold only once MIG-B9-18, "The codemod's directive-argument rewrite is complete in one run" (wave 3, registered by decision 36), is merged: until then a quoted `palette()`/`color()` argument inside a directive takes two runs (MIG-B9-29 §15, F8). This story depends on every story of waves 0 to 3, so on MIG-B9-18 as on every other wave-3 story, and its gate does not start before MIG-B9-18 is merged.

### Owner decisions of 2026-11-13, on MIG-B9-20's delivery flags (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-13), as decision 9 of 2026-11-13. On 2026-11-10 the owner gave a standing instruction for FEAT-010, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"). MIG-B9-20 was merged into `feat/beta9` as PR #88 (`cc10de6`) and left eight owner flags and its follow-ups in its §15 ("Delivery of 2026-11-13"). They were not put to the owner one by one: under that instruction each recommendation is the owner's decision of 2026-11-13, and the owner may still override any of them. This record is in English and lists the decision that concerns this story. Where it differs from this story's contract or from an earlier block, it rules. Facts below were checked on `5a041fc` (`feat/beta9` after MIG-B9-20).

- **The release record's Next.js row (decision 9, review finding DGE-2).** This story refreshes `docs/releases/0.5.0-beta.9.md:33`, the record it owns, which still reads:

  ```text
  | **Next.js without the CLI** | `'uxdsl/postcss': { includeTheme: false }` plus `@uxdsl theme;` once in the global stylesheet. |
  ```

  Since MIG-B9-20, `includeTheme` warns `UXD_OPTION_REMOVED` and is ignored, and the Next.js snippet `uxdsl init` writes is `'uxdsl/postcss': {}` (`POSTCSS_SNIPPET`, `packages/uxdsl/bin/uxdsl.js:2480`). The MIG-B9-20 story file's "Stale corrections and findings of 2026-11-10" block also leaves this record to this story.
- **The two older beta.9 CHANGELOG subsections that still describe `includeTheme` as current (decision 9, DGE-2).** This story marks them superseded. The delivery wrote "They were left as history; the release notes should mark them superseded."
  - `packages/uxdsl/CHANGELOG.md:423–425`: "The Next.js PostCSS setup is unchanged (`'uxdsl/postcss': { includeTheme: false }`, no `@uxdsl theme;`)." The delivery placed it in MIG-B9-22's subsection "about line 384". On `5a041fc` it is in MIG-B9-14's subsection, "The CLI, Vite and webpack on the Sass pipeline (MIG-B9-14)" (heading at line 362; added by `e51b775`).
  - `packages/uxdsl/CHANGELOG.md:1025–1033`, DE-9's "Added: `@uxdsl theme;`": "A PostCSS-only setup — Next.js with `'uxdsl/postcss': { includeTheme: false }` …", with `includeTheme` at lines 1027, 1030 and 1031.
  - The index's §7 makes the CHANGELOG append-only, one subsection per story. Where the "superseded" note is written is settled in this story's re-baseline: in the record this story owns, or as a note the CHANGELOG's append-only rule allows. That rule's exceptions are only those §7 names.

### Owner decisions of 2026-11-15 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-15), as decisions 26 and 28 of 2026-11-15. On 2026-11-10 the owner gave a standing instruction for FEAT-010, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"), and reaffirmed it on 2026-11-13, verbatim, "haz todo como recomendado" ("do everything as recommended"). MIG-B9-16 (PR #93, `44eac7c`) and MIG-B9-25 (PR #94, `99f6a82`) were merged into `feat/beta9` on 2026-11-15, and their follow-ups were routed as recommended, without being put to the owner one by one; the owner may still override any of them. This record is in English and lists what this story receives. Each is a follow-up for this story's re-baseline after wave 3, which decides how it enters the contract.

- **UX-10 is load-sensitive (decision 26, from MIG-B9-16's §15 "Delivery of 2026-11-15").** The finding, verbatim: "On a machine shared by three workflows (load average about 28), UX-10 failed once at `doubling cost x3.27` and passed alone at `x2.48`. Proposed: **MIG-B9-91** (the gate and the release record) decides whether UX-10 measures on a quieter basis (more repetitions, the minimum of several runs) or records its run conditions." On `99f6a82` the check is `fixtures/release-1.0/run.js:845–857` (`reference validation stays near-linear`): it compiles 200 blocks to warm up, then 800 and 400 once each, in that order, and fails when the 800/400 time ratio exceeds 3. `run.js` is in this story's Owns.
- **The gate's leftovers (decision 26, from MIG-B9-25's §15 "Delivery of 2026-11-15").** The follow-up, verbatim: "the gate's and the `verify:*` fixtures' leftovers, including `packAndInstall`'s consumer directory (decision 4), with the 5 entries above as its baseline." The five entries `npm run verify:1.0` leaves in the temporary directory it is given, on the merged MIG-B9-25: `uxdsl-1.0-gate-`, `uxdsl-1.0-upgrade-before-`, `uxdsl-vite-adapter-5-`, `uxdsl-vite-adapter-7-` and `uxdsl-webpack-adapter-` (MIG-B9-23 had recorded 18). `packAndInstall` (`fixtures/lib/tarball-consumer.js:39–40`) makes its directory with `fs.mkdtempSync` and never removes it. This confirms the follow-up decision 4 of 2026-11-10 proposed here, with that baseline. `fixtures/lib/tarball-consumer.js` is on no README §7 row; if this story edits it, its Shares and the index follow. The helper `packages/uxdsl/test/helpers/temporary-directory.js` and the guard `scripts/tmpdir-guard.js` exist since MIG-B9-25.
- **The gate waits for MIG-B9-06's fix of the atomic-replace watch failure (decision 28).** MIG-B9-06 (wave 3, story file still to be written) also takes the test `MIG-B6-23: an output file is never observed empty or truncated while a rebuild is writing it (atomic replace)`, which failed once on Dependabot's PR #84; this story depends on every story of waves 0 to 3, MIG-B9-06 included.

### Owner decisions of 2026-11-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-23), as decisions 1, 29, 39, 40, 48, 51, 52, 56 and 58 of 2026-11-23. On 2026-11-17 the owner wrote, verbatim, "buno en realidad quieor tener beta 9 para empezarlo a mostrar y darle una revisada a la documentacion.. podemos separar l no propritario para beta 10. si me ayudas cone sto,estipular beta 9, alcance y beta 10. alcance, asi nos enfocamos en beta 9, lo que si es que en beta 9 debemos revisar muy bien la documentacion" ("well, actually I want to have beta.9 to start showing it and to give the documentation a review; we can separate what is not a priority into beta.10; set out beta.9 and its scope, and beta.10 and its scope, so we focus on beta.9; in beta.9 we must review the documentation very carefully"), and on 2026-11-23, verbatim, "continua por favor.. la idea es dejar una version lista para beta 9.. lo que quede pendiente lo dejamos para la 10.. asi que mergea todo, y deja lista la version..una vez funcinal y antes de publicar.,. revisaremos documnentacionm, pero avisame cuando 9 este lista en codigo.." ("continue, please; the idea is to leave a version ready for beta.9; whatever is still pending we leave for 10; so merge everything, and leave the version ready; once it works and before publishing, we will review the documentation; but tell me when 9 is ready in code"). Decision 1 is what those messages decide; the others were taken under the owner's standing instruction of 2026-11-10 ("fusiona todo.. y preguntas como recomendadas, y sgeuimos"), reaffirmed on 2026-11-13 ("haz todo como recomendado"), and the owner may override any of them. This record is in English and lists what changes for this story. Where it differs from this story's contract or from an earlier block, it rules; the re-baseline decides how each item enters the contract.

- **When the re-baseline runs (decision 1).** The rest of wave 3 moved to `0.5.0-beta.10`, so this story does not wait for it: the re-baseline that the index's §1 item 4 sets "after wave 3" runs on `6cdadaf` (or a later `feat/beta9`, before any moved story merges), and the header's Status says so. It is this story's first step.
- **What the gate covers (decision 1, DEC-03's third revision).** `0.5.0-beta.9` is every story merged into `feat/beta9` at `6cdadaf`, MIG-B9-28 included: MIG-B9-01 to 05, 10 to 18, 20 to 30, 39 and 53. This story depends on those, not on "every story of waves 0 to 3"; the header follows. MIG-B9-06, 19 and 31 to 38 move to `0.5.0-beta.10`, unstarted, and MIG-B9-92 depends on them. On the index's §7, MIG-B9-31 and 38 now wait for this story on `fixtures/release-1.0/run.js`, and MIG-B9-34 and 35 on `fixtures/release-1.0/contrast-baseline.json`, not the reverse.
- **The wait for MIG-B9-06 is lifted (decision 28 of 2026-11-15, decision 48 of 2026-11-23).** The atomic-replace watch failure (`MIG-B6-23: an output file is never observed empty or truncated while a rebuild is writing it (atomic replace)`, seen once on Dependabot's PR #84), webpack's extra build in the older loader watch tests (decision 40 of 2026-11-15) and MIG-B9-28's G4 class (one save reaching `build --watch` as two `change` events on win32, so `test/cli/watch-mode.test.js` is a named exclusion from the Windows job's gate) are known limitations of the record, each routed to MIG-B9-06 in `0.5.0-beta.10`. G4 (decision 29) is (c), PR #101's recommendation, and the owner may override it; an override to its option (a) or (b) brings a change into `0.5.0-beta.9` before this gate, as decision 29 says, and this story then waits for it.
- **Checks that are not in the beta.9 gate.** The checks of moved and later stories: MIG-B9-31's scoped-palette check, MIG-B9-38's `B9-38`, `DR-1` (MIG-B9-60), `AU-1` (MIG-B9-61), `EX-1`/`EX-2` (MIG-B9-54), `EU-1` (MIG-B9-64) and `TX-1` (MIG-B9-90). MIG-B9-35's contrast re-pin is not in it either: §10's "already re-pinned by MIG-B9-35" does not hold, and the gate verifies the baseline as it is at `6cdadaf`. The ids in §2 are the plan's: on `6cdadaf`, `fixtures/release-1.0/run.js` names `S-1` to `S-3` (MIG-B9-13), `S-4` to `S-6` (MIG-B9-14: the CLI, the installed `uxdsl/webpack` and `uxdsl/vite` on Dart Sass), `S-7` (MIG-B9-26 and 17) and `S-8` (MIG-B9-30), and all of them stay. MIG-B9-31's check was planned in its §8 as `S-5`, the id of MIG-B9-14's webpack check, so its re-baseline renames it. §3's precondition on `fixtures/test-exercise/run.js` (MIG-B9-90) and T2's `scripts/changelog-shape.test.js` (MIG-B9-52) are beta.10's, as the review of 2026-10-11 found for option (b); neither file exists on `6cdadaf`.
- **The record's "moved to beta.10" section** lists MIG-B9-06, 19 and 31 to 38, besides waves 4 to 6, MIG-B9-90 and MIG-B9-92 (decision D13 of 2026-11-04), and the stories registered for `0.5.0-beta.10` since (among them MIG-B9-99, 101, 102, 103 and 68 to 70, decisions 39 to 47 of 2026-11-23).
- **Known limitations the record adds (decisions 39, 51 and 56).** The isolation warnings' edge cases that MIG-B9-99 takes (MIG-B9-17's follow-up); the playground compare's `--no-interactions` (`fixtures/playground-browser/snapshot.js`'s interactions time out; MIG-B9-44's, decision 12 of 2026-11-09); and the codemod's half rewrite of `${…}` after a function argument, and of the other directives its balanced pattern does not match (MIG-B9-18's F11, pinned by its T5; MIG-B9-60's).
- **The walk's fixed port 3919 (decision 52, MIG-B9-30's follow-up 7).** Concurrent gate runs on one machine share it; this story gives the walk a free port or a lock, or, if its re-baseline finds that the gate's run conditions suffice, the record states them, as decision 26 of 2026-11-15 allows for `UX-10`.
- **`verify:1.0`'s leftovers stay this story's (decision 40).** MIG-B9-27's proposed MIG-B9-100 is not registered: the five directories and `packAndInstall`'s consumer directories are this story's by decisions 26 and 44 of 2026-11-15, seen again by MIG-B9-17, 24, 27 and 28's deliveries.
- **The owner steps begin with the documentation review.** The record's owner steps start with "review the documentation with Claude before publishing", then the publish and the steps after it (§9's list). The publish itself, dist-tags, deprecations and the extension stay the owner's; this story publishes nothing.
- **The owner checks the merged stories leave open are the review's inputs (decision 58).** The record lists each as pending and the owner's, never as PASS: MIG-B9-17's wording of the three `UXD_MODULE_ISOLATION` messages and their catalog entry, the rename-first fix for a private member included (DB-2), and its README "From SCSS" passage's two sentences (DE-7); MIG-B9-18's decisions 54 and 55; MIG-B9-28's win32 spellings in the CHANGELOG and the package README, and its G1, G3 and G4 (decisions 26, 28 and 29); MIG-B9-30's catalog entries (the new `UXD_BREAKPOINT_SHADOWED`, and the reworded `UXD_BREAKPOINT_UNKNOWN`, `UXD_BREAKPOINT_CONTEXT` and `UXD_DIRECTIVE_CONTEXT`) and the Press Craftor check of its `migration.md` entry (decision Q18).

### Re-baseline of 2026-11-23 (apply before implementing)

Run on `feat/b9-91-gate` at `6d38d19` (`6cdadaf` plus the owner decisions of
2026-11-23), on the owner's Mac (MacBookPro18,3, macOS 27.0, Node v20.19.0,
Google Chrome 158.0.8127.37), with `TMPDIR` in the session's scratch
directory. Figures are pasted from the scout's logs.

**Baseline.**

- `npm run verify:1.0`, exit 0, 2026-11-23T18:04:51Z–18:11:17Z (6m26s, load
  average about 7): "74/74 automated checks passed." and "PASS: the 1.0 gate
  (automated portion) for uxdsl@0.5.0-beta.9. The items listed above
  remain." Header: "uxdsl-0.5.0-beta.9.tgz (306943 bytes packed, 1131467
  unpacked, 90 files)". `UX-10` "x2.39 per doubling"; `B7-16` "78 examples
  and 24 theme excerpts checked across 101 documentation files."; `contrast`
  "0 failing pairs, 111 excepted (listed, not passing), unchanged"; `AUDIT`
  and `AUDIT-lock` "0 critical, 0 high, 0 moderate, 0 low"; "packages
  installed with uxdsl: 20". It left five entries in its `TMPDIR`:
  `uxdsl-1.0-gate-…`, `uxdsl-1.0-upgrade-before-…`,
  `uxdsl-vite-adapter-5-…`, `uxdsl-vite-adapter-7-…`,
  `uxdsl-webpack-adapter-…` (decision 26 of 2026-11-15's baseline).
- `node scripts/release.js --version 0.5.0-beta.9 --tag latest --dry-run
  --skip-build`, exit 0: "uxdsl: 299.7KB / 300KB budget — ok"; 307200 −
  306943 = 257 bytes of headroom.
- `node --test scripts/docs-provenance.test.js scripts/version-mentions.test.js
  scripts/docs-shape.test.js`, exit 0: 16 tests, 16 pass.
- P10 by decision D8's method, alone after the gate, three runs of
  `node fixtures/sass-corpus/run.js`, each exit 0 and byte-identical
  (276926 bytes): 1.39x (Dart Sass 331 ms, `compile()` 460 ms), 1.30x
  (342/445), 1.35x (340/458); budget 1.5x; load 7.52, 7.40, 7.53.
- `npm test` was not run by the re-baseline; this story runs it (AC4).

**Stale corrections** (old → new; applied above in this commit, except in the block of 2026-11-13, which keeps its text as recorded and is corrected by this table).

| Section | Old | New | Why |
| --- | --- | --- | --- |
| 3 | `test -f fixtures/test-exercise/run.js   # MIG-B9-90 merged` | `git merge-base --is-ancestor 6cdadaf HEAD   # MIG-B9-90 ships in 0.5.0-beta.10` | Decision 1 of 2026-11-23: the file does not exist on `6cdadaf`; the old line exits 1 by design of the cut. |
| 2 | "Chrome from `UXDSL_CHROME_PATH`; 65 checks on `main`." | "… 74 checks on `feat/beta9` at `6cdadaf` (72 on `main` at `8dacc8b`, 65 at the beta.8-era gate `c737fa8`)." | Counted from `await check('` and confirmed by the baseline's "74/74". |
| 2 | "The checks the stories add: `AUDIT-lock` (02), `S-1`…`S-3` (13), `S-4` (30), `S-5` (31), `DR-1` (60), …" | The checks the included stories added, by id and story, and those not in the beta.9 gate. | `git diff c737fa8..HEAD` of `run.js`'s labels; decision 1 of 2026-11-23. |
| 5, G3 | "external (Press Craftor on the tarball: the MIG-B9-03/14/31 evidence)" | "external (Press Craftor on the final tarball: this story's re-run, compared with the MIG-B9-03 and MIG-B9-14 evidence)" | MIG-B9-31 moved to `0.5.0-beta.10`; D13 puts the re-run in this story. |
| 5, G3 and G5 | `0.5.0-beta.10-dev` | `0.5.0-beta.9.dev` | Review of 2026-10-11 and D13: with `semver` 7.8.5, `0.5.0-beta.10-dev` and `0.5.0-beta.9-dev` sort above `0.5.0-beta.10`; `0.5.0-beta.9.dev` sorts between `0.5.0-beta.9` and `0.5.0-beta.10`. |
| 8, T2 | `scripts/docs-provenance.test.js`, `scripts/changelog-shape.test.js`, `scripts/version-mentions.test.js` | `scripts/docs-provenance.test.js`, `scripts/version-mentions.test.js`, `scripts/docs-shape.test.js` | `changelog-shape.test.js` is MIG-B9-52's, in `0.5.0-beta.10`; absent on `6cdadaf`. |
| 10 | "contrast baseline: already re-pinned by MIG-B9-35; the gate verifies it" | "as at `6cdadaf` (0 failing, 111 excepted); … MIG-B9-35's re-pin is `0.5.0-beta.10`" | Decision 1 of 2026-11-23 and the baseline. |
| 12 | `npm run verify:1.0 2>&1 \| tee /tmp/gate-beta9.log` | `TMPDIR=<scratch>/tmp-<role>/ npm run verify:1.0 > <scratch>/gate-beta9.log 2>&1` | The session's rule: temporary files go to the scratch directory, never to `/tmp`. |
| 15, block of 2026-11-13 | `packages/uxdsl/CHANGELOG.md:423–425` and `:1025–1033` | On `6cdadaf`: line 957 (MIG-B9-14's subsection, heading at line 894, the bullet on `init`'s entry) and lines 1562–1568 (DE-9's "Added: `@uxdsl theme;`", heading at 1562) | Positions moved with later subsections (`grep -n includeTheme`). |
| Header, Shares | the CHANGELOG, `README.md`, `packages/uxdsl/package.json` and its lockfile | also `docs/releases/README.md`, root `package.json`, `fixtures/release-1.0/verdicts.test.js`, `fixtures/lib/tarball-consumer.js`, `packages/playground-nextjs/package-lock.json` | The amended contract below edits them; the index's §7 follows. |

**The contract as amended** (where it differs from §5, this rules).

- **G1.** `npm run verify:1.0` runs the 74 checks `run.js` names on `6cdadaf`
  under their ids, plus `I-7` (the installed `uxdsl` declares `engines.node`
  and every installed package's `engines.node` contains it) and `LOCK-pg`
  (the playground lockfile's `../uxdsl` entry agrees with
  `packages/uxdsl/package.json`), and no check of a moved story. DROPPED
  gains the beta.8 meanings of `B3-e` ("`--no-include-theme` overrides every
  `builds[]` entry") and `UX-12` ("`--no-include-theme` really suppresses
  `:root`"), replaced under the same ids by the marker checks (MIG-B9-20).
  DELEGATED's external line names this story's Press Craftor evidence.
- **G2.** Locally: `verify:1.0` exit 0 on the final tree, run last and alone.
  CI: the gate PR's run (`feat/b9-91-gate` → `feat/beta9`): `npm test`,
  `verify:1.0 (one tarball, real Chrome)` and `npm test (uxdsl, Windows)`
  with `watch-mode.test.js` as its named exclusion (decision 29). CI runs
  only on `pull_request` and on a push to `main`, so the release commit's own
  run is the owner's `feat/beta9` → `main` PR, listed as an owner check; the
  owner's publish steps rerun `verify:1.0` on clean `main`. A timing check
  (`UX-10`, P10) failing under load is re-run once alone, both runs recorded.
- **G5.** Branch `chore/after-beta9-publish` from the gate's final head: one
  commit setting `0.5.0-beta.9.dev` in `packages/uxdsl/package.json`, its
  lockfile (`version`, `packages[""].version`) and the playground lockfile's
  `packages["../uxdsl"].version`; pushed, no PR, never merged by the agent.
  `scripts/release.js`'s `isValidSemver` rejects it, which is correct: it is
  never published.

**Owner flags, answered as recommended** under the owner's standing
instruction of 2026-11-10 ("fusiona todo.. y preguntas como recomendadas, y
sgeuimos"), reaffirmed on 2026-11-13 ("haz todo como recomendado"); the owner
may override any of them.

1. **Tarball headroom (257 bytes).** (a): the 300 KB budget stays; no
   package README text in beta.9; the root `README.md` carries the status
   line; if `--check-pack` fails, stop and ask.
2. **`UX-10`'s basis (decision 26 of 2026-11-15, decision 53 of
   2026-11-23).** (a): after the 200-block warm-up, 400 and 800 blocks are
   compiled interleaved for 5 rounds, the order alternating; the verdict is
   the ratio of the two minima, threshold 3 unchanged; the check prints
   `os.loadavg()`. The verdict is an exported function with a negative
   control.
3. **The walk's port 3919 (decision 52).** (a): `run.js` asks the OS for a
   free port and passes `--port <n>` to `walk.js`, which already reads it;
   `walk.js` is not edited (its row is beta.10's stories 40 to 44).
4. **T3's paired statistic (decision 4 of 2026-11-09).** (a): not added in
   `0.5.0-beta.9`. The budget fixture keeps C2's difference of medians with
   61 rounds; P10's re-measure uses the corpus runner, which T3 does not
   involve; the paired statistic is an option for beta.10's timing work.
5. **Where the "superseded" note for the two `includeTheme` passages goes
   (decision 9 of 2026-11-13).** (a): in the record and as one item of this
   story's own CHANGELOG subsection naming both headings; the two older
   passages are not edited (§7: append-only).
6. **Where "What changes for you" lives.** (a): a new `### What changes for
   you` as the first subsection of the beta.9 section, copied verbatim into
   the record; no other story's text is edited.
7. **The playground lockfile (D19).** (a): `npm install --package-lock-only`
   in the playground, the diff limited to `packages["../uxdsl"]`, `npm ci`
   there exit 0, and the `[repo]` check `LOCK-pg`.
8. **The gate's leftovers (decisions 4, 26 and 40).** (a): `packAndInstall`'s
   directory and B7-15a's `uxdsl-1.0-upgrade-before-` directory are removed
   when the process exits 0 and kept, their paths printed, otherwise
   (`packages/uxdsl/test/helpers/temporary-directory.js`'s process-exit
   mode), and `verify:1.0` runs through `node scripts/tmpdir-guard.js`, so a
   leftover fails the gate.
9. **G2's CI evidence.** (a): the record carries the gate PR's CI run and
   lists the `feat/beta9` → `main` PR's run as an owner check; no workflow
   change.
10. **Scope of G5's bump commit.** (a): the version only; the CHANGELOG date
    and the record's status are the owner's post-publish edits, listed in the
    record.

### Delivery of 2026-11-23

What the implementation found, and the owner flags it raised, each answered
with its recommended option under the owner's standing instruction of
2026-11-10 ("fusiona todo.. y preguntas como recomendadas, y sgeuimos"),
reaffirmed on 2026-11-13 ("haz todo como recomendado"); the owner may
override any of them. None changes the release cut or publishes anything.

- **Flag 11 — `uxdsl/postcss`'s plugin object has `prepare`, not `Once`
  (the Press Craftor run's finding 1).** Since MIG-B9-27 (`d049f2f`) the
  plugin returns `{ postcssPlugin, prepare }`; Press Craftor's
  `postcss-uxdsl-source.cjs` called `plugin.Once(root, helpers)` itself, so
  `next build` failed ("TypeError: plugin.Once is not a function"). A plugin
  listed in `postcss.config.js` is unaffected. MIG-B9-27's CHANGELOG entry
  does not say the property is gone. Options: (a) document it in
  `0.5.0-beta.9` (a `Breaking` item of this story's CHANGELOG subsection,
  the record's table row and migration step 6 with the forwarding wrapper)
  and change no code; (b) add a compatibility `Once` to the plugin object in
  `0.5.0-beta.9`, a product change after the cut. **Recommended and taken:
  (a)**; the compatibility `Once` is offered to `0.5.0-beta.10` as a
  follow-up (proposed: MIG-B9-92's re-baseline routes it, or a new story).
  The owner's Press Craftor patch (D17) needs the wrapper hunk the evidence
  file shows.
- **`npm ls --parseable` prints a path with a segment replaced by `***`.**
  In this session, npm 11.21.1 replaced the session's UUID-like directory
  name in every path it printed, so `I-7`'s first version, which read those
  paths, failed the gate's first final run with ENOENT (75/76 at
  `82b676d`). `I-7` now reads `node_modules` itself (`installedManifests`,
  exported, with a planted tree as its test). The gate's "packages installed
  with uxdsl" measurement still counts `npm ls`'s lines, which redaction does
  not change.
- **A leftover seen once.** One run of `node --test
  fixtures/release-1.0/verdicts.test.js` (the first after the
  `installedManifests` test was added) left its new test's directory,
  `uxdsl-gate-verdicts-…`, in the `TMPDIR` it was given; three runs after it
  (two of the file, one of the test alone) and the final `npm test` (under
  `scripts/tmpdir-guard.js`) left nothing. Not reproduced; recorded, not
  fixed.
- **P10's third run at 1.47x** (Dart Sass 337 ms, `compile()` 494 ms; warm
  `compile()` runs 494, 438, 556 ms), under the 1.5x budget with load 4.93.
  Not a failure, so not re-run; the margin is small on a machine with other
  work.
- **The gate's two runs and the load.** The machine ran other agents' work
  (load average 6 to 9). `UX-10` passed in both final runs, x1.74 and x1.70,
  on the fastest of five rounds.
- **npm 11.21.1 warns `install-scripts … not yet covered by allowScripts`**
  for `@parcel/watcher@2.6.0`, an optional dependency of `sass`, on every
  install in Press Craftor; its prebuilt platform package is installed and
  nothing failed. Recorded for the documentation review.

- **The bump found a test that pinned the version.** `npm test` on the first
  bump commit failed one test, `LOCK-pg rejects a stale entry …`: its stale
  fixture carried `0.5.0-beta.9`, so at `0.5.0-beta.9.dev` the verdict also
  named `version`. The fixture now takes the manifest's version (a test-only
  change, after the gate's run on `3267c93`); the unpushed bump commit was
  remade on top of it.

**G5, the bump commit.** Prepared after this block's commit, on it: `chore/after-beta9-publish`, one commit setting `0.5.0-beta.9.dev` in `packages/uxdsl/package.json`, its lockfile (`version`, `packages[""].version`) and the playground lockfile's `packages["../uxdsl"].version`; pushed with no pull request, never merged by an agent. Its SHA and the results of `npm test` and the playground's `npm ci` on it are in PR #106's conversation, since a commit cannot name the one built on it. `semver` 7.8.5 (`packages/uxdsl/node_modules`) orders it as decided: `0.5.0-beta.9.dev` is valid, after `0.5.0-beta.9` and before `0.5.0-beta.10`, while `0.5.0-beta.10-dev` is after `0.5.0-beta.10` (the negative control).

### Delivery of 2026-11-23 (review)

Three reviews of the delivery (the evidence, the gate's code, the
documentation as a reader follows it), each finding reproduced before it was
fixed, on `feat/b9-91-gate` after merging `feat/beta9` at `ad79871` (PR
#105, the owner decisions of 2026-11-23) as `5949268`. Owner flags arising
here are answered with the recommended option under the owner's standing
instruction of 2026-11-10, reaffirmed on 2026-11-13; the owner may override
any of them. None changes the release cut or publishes anything.

**Fixed.**

- **Flag 12 — `UX-10` could not catch work quadratic in the declarations
  (a contract change: decision 26 of 2026-11-15 kept 400 and 800 blocks).**
  The theme adds about 700 declarations that do not grow with the blocks, so
  at 400 and 800 blocks the declarations grow by 1.70 and quadratic work by at
  most 2.89, under the threshold of 3. Reproduced with a copy of `dist` whose
  `inspectReferences` scans the definitions three times per consumer: clean
  x1.75 at 400/800 and x2.02 at 1600/3200; planted, PASS x2.51 at 400/800
  (the compile 2.6 to 3.8 times slower) and FAIL x3.64 at 1600/3200. Options:
  (a) measure at 1600 and 3200 blocks, same five interleaved rounds, minima and
  threshold, a few seconds more; (b) keep 400/800 and record the blind spot
  for `0.5.0-beta.10`'s timing work. **Recommended and taken: (a)**; the gate
  check is in this story's Owns and the gate was re-run anyway. The negative
  control now models the real input (689 + 4 declarations per block, work
  quadratic in them): it fails at the sizes and, as the test states, would
  pass at 400/800. Mutation: sizes back to 400/800, three tests fail.
- **`freePort`'s control passed with a fixed port.** Its test now holds 3919
  (when free) and the port `freePort` just returned, and requires another;
  `return Promise.resolve(3919)` fails it.
- **`LOCK-pg` ignored `peerDependenciesMeta`.** Added to the compared fields,
  with keys sorted at every depth; a manifest without `vite`'s entry and an
  entry with `optional: false` are both rejected; dropping the field from
  `LOCK_FIELDS` fails two tests. (`bin` stays out: npm writes
  `./bin/uxdsl.js` as `bin/uxdsl.js`.)
- **The package README** (in the tarball): the 60-second examples go into
  `src/styles.uxdsl`, not the generated entry `generate-entry` overwrites,
  and compile to the CSS shown "formatted by Dart Sass"; `uxdsl` itself needs
  Node 20.19; the `@ds-button` example names its hover, keyboard focus,
  selected and disabled states; the silent-typo example is `sourceMaps` (a
  config with it builds and writes no map), since `includeTheme` is gone and
  `outfile` alone fails ("No output file configured").
- **The message of a theme file under a former name** said "the contents
  stay the same", false for a file exporting `{ theme, references }`; it now
  says what that file does. `test/config.test.js` (27 pass) and the gate's
  `P4-rename` match its unchanged first sentence.
- **The CHANGELOG's subsection** said "above" for two subsections below it.
- **The record:** the status and §14 no longer say the published tarball is
  "from the same commit" (the gate ran on `d44252b`; the owner's step 3
  re-runs it on the `main` commit it publishes); the owner steps say an
  agent runs none of steps 2 to 7, start step 2 with merging PR #106, and
  install as CI does (the root, three packages, the CSS Modules fixture, the
  build, the consumer fixture), which `npm test` and `verify:1.0` need; the
  migration gains the codemod without a theme file, `@theme` blocks (Press
  Craftor's own test holds one), a generated entry, the marker in a `builds`
  project and the config's `@type` import, and says that `migration.md`'s
  "To 1.0" first paragraph describes the rename alone; the P10 and budget
  rows name `3e1e269`; the `[postpublish]` shim line is read against owner
  step 4; StackBlitz is wave 5; the "Theme files", "Fonts" and "Editor"
  rows; two known limitations (the CLI's byte count, the wrapper's `Once`)
  and the compatibility `Once` in the moved list. The evidence file quotes
  `pc-05` exactly and says the `wc -c` sizes were read at run time and not
  saved (the documentation review read the same seven on a fresh clone).

**Not fixed here, for the owner's documentation review** (owner step 1 lists
them): `migration.md`'s "To 1.0" first paragraph (the file is frozen until
MIG-B9-52; the record corrects it for this move); `init`'s pointer to
"Editor support" in the README, where only a link of that name is (changing
it changes `bin/uxdsl.js`, `test/cli/init.test.js` and the site's captured
CLI output); the CLI's `built … (N bytes)` counting characters, already
MIG-B9-38's (fact 4, `0.5.0-beta.10`); npm 11's `install-scripts` warning.

**Routed.** The compatibility `Once` (flag 11) is routed by MIG-B9-92's
re-baseline, and the record's moved list says so. The verdicts leftover of
the delivery block is explained: the helper keeps a test file's directories
when one of its tests fails, by design (`temporary-directory.js`); a passing
run of `verdicts.test.js` with an empty `TMPDIR` left 0 entries, failing
(mutated) runs left theirs. Nothing to fix.

**Re-run after the fixes.** `npm test` on `e090c28` exit 0 (29 runs: 1,728
tests, 1,719 pass, 0 fail, 9 skipped; the guard's directory empty);
`verify:doc-examples` "78 examples and 24 theme excerpts checked across 101
documentation files."; T2 16/16; both `--check` exit 0; `release.js` dry run
exit 0, "uxdsl: 299.8KB / 300KB budget — ok"; `npm pack --dry-run`
307,006 B packed, 1,131,674 unpacked, 90 files (194 bytes to spare);
`verify:1.0` on `d44252b`: exit 0, 2026-11-23 20:13:42–20:20:04 UTC, "76/76 automated checks passed." and "PASS: the 1.0 gate (automated portion) for uxdsl@0.5.0-beta.9. The items listed above remain."; header "uxdsl-0.5.0-beta.9.tgz (307006 bytes packed, 1131674 unpacked, 90 files)"; `UX-10` "x1.98 per doubling (fastest of 5 rounds: 1600 blocks 171 ms, 3200 blocks 339 ms; load 3.71 4.63 5.50)"; `LOCK-pg` names `peerDependenciesMeta`; `B7-17E` on port 49785; `ls -A` of its `TMPDIR` afterwards: 0 entries. P10 was not re-run: no commit after
`3e1e269` changes the compile path.

**G5.** `chore/after-beta9-publish` recreated on this branch's final package
state, on the commit that adds this block, and force-pushed (that branch
only); its SHA, `npm test` and the playground's `npm ci` on it are in PR
#106's conversation, since a commit cannot name the one built on it.
