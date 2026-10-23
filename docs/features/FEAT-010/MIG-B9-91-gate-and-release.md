# MIG-B9-91 — The gate and the release record

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 7 |
| Decision gate | DEC-03 (decided 2026-10-23: one release, `0.5.0-beta.9`, with every wave) |
| Status | Draft (re-baseline after wave 3) |
| Size | M |
| Depends on | every story of waves 0 to 6 (DEC-03); MIG-B9-90 |
| Blocks | the owner's publish |
| Base | `feat/beta9` after those waves |
| Owns | `docs/releases/0.5.0-beta.9.md`, `fixtures/release-1.0/run.js` (the DROPPED list and the new checks' wiring), `fixtures/release-1.0/contrast-baseline.json` |
| Shares | `packages/uxdsl/CHANGELOG.md` (the date), `README.md` (the status line) |
| Output impact | none |

## 1. Goal

One command proves the release from the real tarball, in real Chrome, and
one document says what was proven, what was not, and what the owner does
next. Nothing is published by this story.

## 2. Sources

- `fixtures/release-1.0/run.js` (`npm run verify:1.0`): one tarball, installed
  the documented way; every check awaited; a check that cannot run is named
  with its owner; the DROPPED list; `--skip-upgrade`, `--skip-playground-walk`,
  `--write-contrast-baseline`; Chrome from `UXDSL_CHROME_PATH`; 65 checks on
  `main`.
- The checks the stories add: `AUDIT-lock` (02), `S-1`…`S-3` (13), `S-4` (30),
  `S-5` (31), `DR-1` (60), `AU-1` (61), `EX-1`/`EX-2` (54), `EU-1` (64),
  `TX-1` (90), and the rewritten `B3-a`, `B3-e`, `B4-a`, `UX-12`, `B2-b`,
  `N-02`, `UX-02`, `UX-16`, `UX-20`, `contrast`, `cssmod`.
- `docs/releases/0.5.0-beta.9.md` (renamed by MIG-B9-01, figures to refresh);
  `scripts/release.js --version --tag --otp --dry-run --skip-build`;
  the audit's rule: "Prepublish, browser, external-consumer and postpublish
  evidence are separate"; "Planning and verification do not authorize
  publishing or changing dist-tags."
- The handoff's rule: never claim an unrun check.

## 3. Preconditions

```bash
test -f docs/releases/0.5.0-beta.9.md
test -f fixtures/test-exercise/run.js   # MIG-B9-90 merged
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
  walked), external (Press Craftor on the tarball: the MIG-B9-03/14/31
  evidence), manual pending (VS Code with the VSIX installed), postpublish
  pending (dist-tags, a fresh `npm i -D uxdsl`, the StackBlitz links, the
  extension publish); publish steps for the owner (the exact commands with
  `--otp <code>` placeholders; the five former names: deprecate, optionally
  the shims at beta.9); afterwards (bump to `0.5.0-beta.10-dev`); known
  limitations (honest, from the stories' §15); moved to beta.10 (per DEC-03).
- **G4 — Dates and versions.** The CHANGELOG's beta.9 heading keeps
  "unreleased" until the owner publishes; the record says so; `README.md`'s
  status line names beta.9 as the release candidate of the branch.
- **G5 — The bump commit, prepared.** A commit that sets `0.5.0-beta.10-dev`
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
| T2 | `scripts/docs-provenance.test.js`, `scripts/changelog-shape.test.js`, `scripts/version-mentions.test.js` | the record and the CHANGELOG pass | docs | G3, G4 | — |
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
| contrast baseline | already re-pinned by MIG-B9-35; the gate verifies it |
| playground captures | current (the gate's `B7-17` checks) |

## 11. Documentation

`docs/releases/0.5.0-beta.9.md`, `docs/releases/README.md` (the index row),
`README.md` (status line).

## 12. Verification

```bash
npm run verify:1.0 2>&1 | tee /tmp/gate-beta9.log       # background; exit 0
node scripts/release.js --version 0.5.0-beta.9 --tag latest --dry-run --skip-build   # exit 0
node --test scripts/docs-provenance.test.js scripts/changelog-shape.test.js scripts/version-mentions.test.js   # exit 0
npm test                                                  # background; exit 0
```

## 13. Delivery

Branch `feat/b9-91-gate`. Commit:
`docs(FEAT-010): MIG-B9-91 - the beta.9 gate complete and green; the release record`.
Then the owner merges `feat/beta9` into `main` and publishes from a clean
checkout of `main`.

## 14. Closure record

To be filled in the delivering PR, with both gate summaries.

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
