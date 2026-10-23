# MIG-B9-01 — Renumber to 0.5.0-beta.9 and record beta.8

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 0 |
| Decision gate | None (owner decision of 2026-10-08: the first `uxdsl` release is `0.5.0-beta.9`) |
| Status | Ready |
| Size | S |
| Depends on | — (first story; creates the integration branch `feat/beta9`) |
| Blocks | MIG-B9-03, MIG-B9-52, MIG-B9-91 |
| Base | `main` at `685c132` or later |
| Owns | `packages/uxdsl/package.json`, `packages/uxdsl/package-lock.json`, `packages/_deprecated/**`, `docs/releases/0.5.0-beta.8.md`, `docs/releases/0.5.0-beta.9.md` (renamed from `0.5.0-beta.7.md`), `docs/releases/uxdsl-package-move.md`, `README.md` (status lines only) |
| Shares | `packages/uxdsl/CHANGELOG.md` (one heading and one new section), `AGENTS.md` (version facts only; MIG-B9-51 rewrites it), `packages/uxdsl/README.md`, `packages/uxdsl/docs/migration.md`, `fixtures/release-1.0/contrast-baseline.json` |
| Output impact | none (compiled CSS unchanged) |

## 1. Goal

The repository says `0.5.0-beta.9` everywhere a version is a fact about the
next release, and the truth about `0.5.0-beta.8` (the five old packages,
published 2026-10-08 from pre-stability code) is written down once, so no
document claims that beta.7 was published or that beta.8 is the one package.

## 2. Sources

- Plan §0 and §1.1–1.2 (`docs/audits/2026-10-08-plan-beta9.md`): "the first
  release of `uxdsl` is **`0.5.0-beta.9`**, so the product's numbering stays
  monotonic"; the renumber list; "Record beta.8".
- The owner's checkout (`/Users/ricardosantoyo/Documents/projects/uxdsl`, branch
  `docs/stability-audit`) holds an **untracked** draft
  `docs/releases/0.5.0-beta.8.md` (42 lines, 2026-10-08). Its facts, copied here
  so this story never touches that checkout:
  - published on 2026-10-08 with `latest` pointing at `0.5.0-beta.8` for
    `postcss-uxdsl`, `uxdsl-core`, `vite-plugin-uxdsl`, `uxdsl-webpack-loader`
    and `uxdsl-cli`;
  - "This release packages the current repository implementation, including
    the unpublished changes described in the beta.7 record" — read: the code
    of `main` at `0446d7c`, FEAT-009's beta.7 stories, in the old five-package
    layout;
  - verification run: `node scripts/release.js --version 0.5.0-beta.8 --skip-publish`,
    `npm run verify:pack-budget`, `npm test` (exit 0; a sandbox retry with a
    temporary npm cache); "Browser and external consumer checks: not run";
  - publish: `npm whoami` = `ricardo.santoyo`; the first publish was refused
    with `EOTP`; interactive browser authentication then published all five;
  - "Their `beta` tags still point to `0.5.0-beta.6`"; the dist-tag alignment
    was cancelled without changing the tags; "Do not rerun the release script".
- The registry, read on 2026-10-11: the five names have `latest` =
  `0.5.0-beta.8` and `beta` = `0.5.0-beta.6`; `npm view uxdsl version` is
  `E404` (the name does not exist yet).
- The registry smoke test of beta.8 (plan §0): install, `init`, `build` work
  (51 KB CSS); `npm audit` shows the inherited high findings.

## 3. Preconditions

```bash
test "$(node -p "require('./packages/uxdsl/package.json').version")" = "0.5.0-beta.7"
test "$(npm view postcss-uxdsl dist-tags.latest)" = "0.5.0-beta.8"
npm view uxdsl version 2>&1 | grep -q E404
grep -q "^## 0.5.0-beta.7 — unreleased" packages/uxdsl/CHANGELOG.md
test -f docs/releases/0.5.0-beta.7.md && test ! -f docs/releases/0.5.0-beta.8.md
grep -q "0.5.0-beta.7" packages/_deprecated/shims.test.js
```

## 4. Baseline

```bash
grep -rl "0\.5\.0-beta\.7" --include='*.md' --include='*.json' --include='*.js' --include='*.ts' . | grep -v node_modules | grep -v '\.git/' | sort
```

Recorded output on the base: 29 files — `README.md`, `AGENTS.md`,
`docs/releases/uxdsl-package-move.md`, `docs/releases/0.5.0-beta.7.md`,
`docs/audits/2026-10-08-plan-beta9.md`, `docs/features/FEAT-009-path-to-0.5.0.md`,
eight `docs/features/FEAT-009/*.md`, `packages/uxdsl/package.json`,
`packages/uxdsl/package-lock.json`, `packages/uxdsl/README.md`,
`packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/docs/migration.md`,
`packages/uxdsl/docs/agent-guide.md`, `packages/_deprecated/shims.test.js`, and
the ten `packages/_deprecated/*/{package.json,README.md}`.

## 5. Contract

- **C1 — The package.** `packages/uxdsl/package.json` `version` is
  `0.5.0-beta.9`; `packages/uxdsl/package-lock.json` agrees
  (`npm install --package-lock-only` inside `packages/uxdsl`); `npx uxdsl --version`
  prints `0.5.0-beta.9`.
- **C2 — The shims.** Each of the five packages under `packages/_deprecated/`
  has `version` `0.5.0-beta.9` and depends on exactly `uxdsl@0.5.0-beta.9`;
  `packages/_deprecated/shims.test.js` pins those two values and passes. Their
  READMEs say beta.9.
- **C3 — The CHANGELOG.** The heading `## 0.5.0-beta.7 — unreleased` becomes
  `## 0.5.0-beta.9 — unreleased`, and its first paragraph states, in two
  sentences, that no `0.5.0-beta.7` was ever published and that
  `0.5.0-beta.8` (2026-10-08) was the last release of the five-package layout,
  built from `0446d7c` without the stability work. A new section
  `## 0.5.0-beta.8 — 2026-10-08` follows it, listing what that release
  contained (FEAT-009's beta.7 stories: the Google Fonts `@import` order fix,
  the typed `init` config, the upgrade flow, the packaged agent guide) and the
  five package names and versions. Nothing else in the CHANGELOG changes
  (MIG-B9-52 restructures it).
- **C4 — The release records.** `docs/releases/0.5.0-beta.8.md` exists with:
  status (published), date, the five names and versions, the commit and branch
  it was built from (`0446d7c`, the owner's checkout on `docs/stability-audit`),
  the dist-tags as read from the registry (`latest` beta.8, `beta` beta.6),
  the verification that was run and the two checks that were not (browser,
  external consumer), the registry smoke test, and the owner step still open
  (`npm dist-tag add <name>@0.5.0-beta.8 beta --otp <code>` for each of the
  five names, never a republish). `docs/releases/0.5.0-beta.7.md` is renamed
  (`git mv`) to `docs/releases/0.5.0-beta.9.md`; its title, status line,
  commands (`--version 0.5.0-beta.9`, `npm dist-tag add uxdsl@0.5.0-beta.9 beta`)
  and the "Moved to 0.5.0-beta.8" heading (now "Moved to 0.5.0-beta.10,
  pending DEC-03") are updated; its verification figures are marked "to be
  refreshed by MIG-B9-91" rather than restated. `docs/releases/uxdsl-package-move.md`
  points at the renamed file and says beta.9.
- **C5 — Every other mention, reviewed one by one.** A mention that is a
  version fact about the next `uxdsl` release becomes `0.5.0-beta.9`. A
  mention that describes what shipped (for example `AGENTS.md`: "From
  `0.5.0-beta.7` (unreleased as of 2026-09-28; `0.5.0-beta.6` still has the
  old placement)") is rewritten to the truth: that behavior shipped in
  `0.5.0-beta.8` under the old names, and ships in `uxdsl@0.5.0-beta.9`. No
  "as of <date>" clause survives in `AGENTS.md`, `packages/uxdsl/README.md` or
  `packages/uxdsl/docs/migration.md`. Mentions inside `docs/features/FEAT-009/**`,
  `docs/features/FEAT-009-path-to-0.5.0.md` and `docs/audits/**` are history
  and stay as written.
- **C6 — The gate's baseline file.** `fixtures/release-1.0/contrast-baseline.json`:
  if its beta.7 mention is a version field, it reads beta.9; if it is a
  comment about when the set was pinned, it stays.
- **C7 — The root README** status lines name beta.9 as the next release and
  beta.8 as the last published, with one link to each record.
- **C8 — Generated copies.** `npm run generate:agent-guide` regenerates
  `packages/uxdsl/docs/agent-guide.md`; the playground captures that print
  `uxdsl --version` are regenerated
  (`node packages/playground-nextjs/scripts/capture-capabilities.js`).
- **C9 — The owner's checkout is not touched.** The draft there is the
  owner's to delete after this story merges (owner step).

Must stay byte-identical: every compiled CSS output; `fixtures/parity`
oracles; the contrast baseline's pair sets.

## 6. Out of scope

- The CHANGELOG's "What changes for you" restructure and the English migration
  guide: MIG-B9-52.
- Aligning the `beta` dist-tag of the five names: the owner (recorded as an
  open step in the beta.8 record).
- Bumping to `0.5.0-beta.10-dev` after publishing: MIG-B9-91.

## 7. Approach and traps

- Do the renumber with `grep -rn "0\.5\.0-beta\.7"` and edit by hand, file by
  file; a mechanical replace turns true sentences about beta.8 into false ones
  (`AGENTS.md` lines about the Google Fonts `@import` placement and the typed
  `init` config describe FEAT-009 work that shipped as beta.8).
- `packages/uxdsl/package-lock.json` has the version in two places (the root
  `version` and `packages[""].version`); regenerate it, do not edit it.
- `scripts/docs-provenance.test.js` scans every `docs/releases/*.md`: the new
  record must not attribute browser coverage to MIG-07 on any line.
- The release gate's `B7-15a` installs `0.5.0-beta.6` from the registry to
  compare `uxdsl theme` output; it is not this story's concern and must keep
  passing.
- Stop rule: if a mention cannot be classified as fact-about-next-release or
  history, record it in §15 and leave it unchanged.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `packages/_deprecated/shims.test.js` | `phase 4: each shim is 0.5.0-beta.9, depends on exactly uxdsl 0.5.0-beta.9, …` (updated title) | unit | C2 | the test fails against the base's `0.5.0-beta.7` manifests |
| T2 | `scripts/release.test.js` | existing checks (version flow) | unit | C1 | — |
| T3 | `scripts/version-mentions.test.js` (new) | `MIG-B9-01: no file outside the history folders mentions a package version below the one in package.json` | unit | C5 | add a stray `0.5.0-beta.7` to `packages/uxdsl/README.md`: the test fails |
| T4 | `scripts/docs-provenance.test.js` | existing | unit | C4 | — |
| T5 | `fixtures/release-1.0/run.js` `I-5` | `uxdsl --version prints the one version` | tarball | C1 | — |

T3's allowlist: `docs/features/**`, `docs/audits/**`, `docs/releases/**`
(records are history), `packages/uxdsl/CHANGELOG.md` (history sections) and
`node_modules`. Everything else must not contain `0.5.0-beta.<n>` with
`n < 9` except inside a sentence that also contains "beta.8" or "published"
(a true statement about history). Keep the rule that simple; its job is to
catch the next stale version string, not to parse prose.

## 9. Acceptance criteria

- **AC1** `node -p "require('./packages/uxdsl/package.json').version"` prints
  `0.5.0-beta.9`, and `node packages/uxdsl/bin/uxdsl.js --version` prints it.
- **AC2** `node --test packages/_deprecated/shims.test.js` exits 0 and T1's
  title names beta.9.
- **AC3** `node --test scripts/version-mentions.test.js` exits 0; with a
  planted `0.5.0-beta.7` in `packages/uxdsl/README.md` it exits 1.
- **AC4** `test -f docs/releases/0.5.0-beta.8.md && test -f docs/releases/0.5.0-beta.9.md && test ! -f docs/releases/0.5.0-beta.7.md`.
- **AC5** `grep -c "as of 20" AGENTS.md packages/uxdsl/README.md packages/uxdsl/docs/migration.md` prints 0 for each file.
- **AC6** `npm test` exits 0; `node scripts/generate-agent-guide.js --check`
  exits 0.
- **AC7** `fixtures/parity`: `node fixtures/parity/run.js` exits 0 without
  `--update`.

Owner steps (not part of acceptance): `npm dist-tag add <name>@0.5.0-beta.8 beta`
for the five names; delete the untracked draft in the owner's checkout.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | no |
| `AGENTS.md` + `npm run generate:agent-guide` | yes (version facts) |
| CHANGELOG | yes (heading and the beta.8 section) |
| `migration.md` | yes (version mentions only) |
| package README | yes (version mentions) |
| `scripts/verify-docs-update.js` classification | no |
| `DIAGNOSTIC_CATALOG` | no |
| `npm run generate:capabilities` | no |
| playground `uxdsl:build` + `capture-capabilities.js` | yes (the `--version` capture) |
| contrast baseline | no |
| `docs/architecture/*` | no |

## 11. Documentation

`README.md` (root), `packages/uxdsl/README.md`, `packages/uxdsl/CHANGELOG.md`,
`packages/uxdsl/docs/migration.md`, `AGENTS.md`, `docs/releases/0.5.0-beta.8.md`,
`docs/releases/0.5.0-beta.9.md`, `docs/releases/uxdsl-package-move.md`, the five
`packages/_deprecated/*/README.md`.

## 12. Verification

```bash
npm test                                           # background, log to a file; exit 0
node scripts/generate-agent-guide.js --check        # exit 0
node scripts/generate-language-artifacts.js --check # exit 0
node fixtures/parity/run.js                         # exit 0
npm run verify:1.0 -- --skip-playground-walk        # background; 65+ checks, I-5 ok
```

## 13. Delivery

Branch `feat/b9-01-renumber` from `feat/beta9` (create `feat/beta9` from
`main` first). Commit: `chore(FEAT-010): MIG-B9-01 - renumber uxdsl to 0.5.0-beta.9 and record beta.8`.
PR title the same; body: the §9 results and the two owner steps.

## 14. Closure record

To be filled in the delivering PR: base SHA · PR · environment (OS, Node,
Chrome if used) · each §12 command with exit code · controls run · owner steps
pending.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- The baseline grep lists 31 files, not 29, and omits `fixtures/release-1.0/contrast-baseline.json`; re-record it.
- Preconditions 2–3 (`npm view …`) need registry access; an environment without it records them as not run, never as PASS.
