# MIG-B9-53 — Signals that it is maintained

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 5 |
| Decision gate | None (plan §6.6, §6.7; audit §5.5) |
| Status | Merged |
| Size | S |
| Depends on | — |
| Blocks | MIG-B9-50 (links to the files this story creates; can merge in either order if the links are added last) |
| Base | `feat/beta9` |
| Owns | `STABILITY.md` (new), `.github/ISSUE_TEMPLATE/{bug.yml,question.yml,idea.yml,config.yml}` (new), `docs/ROADMAP.md` (new), `docs/README.md` (new index), `docs/releases/README.md` (new index) |
| Shares | `README.md` (links only) |
| Output impact | none |

## 1. Goal

A visitor who asks "can I use this in production, and will it be here next
year" finds an answer: a stability policy, a roadmap, issue templates, and a
`docs/` folder that separates product documentation from the project's
internal history.

## 2. Sources

- Plan §6.6: "`CONTRIBUTING.md` (part of §3.3), issue templates (bug,
  question, idea), a short public roadmap (beta.9 → 1.0 → after 1.0), and
  the stability policy written as `STABILITY.md` (audit §5.5)"; §6.7: "the
  README links product docs only, and `docs/` gets a short index that says
  which folders are product documentation and which are internal history".
- Audit §5.5, the policy after 1.0: strict semver on the §5.3 contract;
  allowed in a minor: additive changes; forbidden in a minor: renaming
  emitted variables, changing what a directive emits, moving a base
  breakpoint, changing a theme's output except a documented bug fix under
  Visual changes; deprecation: one minor of `UXD_DEPRECATED` warnings first;
  the gate: tarballs, build/runtime parity, Chrome walk, compiled doc
  examples, exact contrast set; bump to `-dev` after every publish.
- `.github/` holds only `workflows/ci.yml`; `docs/` has `architecture`,
  `audits`, `features`, `releases` and no index; the playground redirects
  `uxdsl.vercel.app` to `uxdsl.io` (`next.config.js`) and `SITE_URL` is
  `https://uxdsl.io`.

## 3. Preconditions

```bash
test ! -f STABILITY.md && test ! -d .github/ISSUE_TEMPLATE && test ! -f docs/README.md && test ! -f docs/ROADMAP.md
```

## 4. Baseline

None.

## 5. Contract

- **S1 — `STABILITY.md`** (English, ≤ 80 lines): what is covered by semver
  (the language, the theme JSON families and grammar, the emitted variable
  names, the package's entry points and their options, the CLI commands),
  what is not (`uxdsl/engine`, the playground, the diagnostics' message text),
  the beta policy (until 1.0 a beta may break with a CHANGELOG "Breaking"
  entry and a migration step), the policy after 1.0 (the audit's), how a
  deprecation is announced (`UXD_DEPRECATED` for one minor), what the release
  gate proves, and how to report a regression.
- **S2 — Issue templates**: `bug.yml` (version, integration — CLI, PostCSS,
  Vite, webpack, runtime —, the `.uxdsl` input, the theme excerpt, the
  expected and actual output, the `UXD_*` code if any), `question.yml`,
  `idea.yml` (what the theme or component should be able to say), and
  `config.yml` with `blank_issues_enabled: false` and a link to the docs.
- **S3 — `docs/ROADMAP.md`** (≤ 60 lines): beta.9, beta.10 (per DEC-03), rc.1,
  1.0, after 1.0 (the items FEAT-010 §3 excludes), each with a one-line
  definition of done and a link to its plan; no dates.
- **S4 — `docs/README.md`**: the folders and what they are — `releases/`
  (product: what each version shipped), `architecture/` (product: engine
  ownership and the capability matrix), `features/` and `audits/` (internal
  history and planning, mostly in Spanish, not maintained as documentation).
  `docs/releases/README.md` lists the records newest first with the version,
  the date and one line.
- **S5 — The root README links** `STABILITY.md`, `docs/ROADMAP.md`,
  `docs/releases/README.md`, `CONTRIBUTING.md` and the issue templates
  (through the GitHub "New issue" URL), and nothing under `docs/features` or
  `docs/audits`.

Must stay byte-identical: everything compiled.

## 6. Out of scope

- A `SECURITY.md` and a code of conduct: not asked for; noted in §15.
- The canonical host: already configured (redirect and `SITE_URL`); the story
  only verifies the redirect is documented in `docs/README.md`.

## 7. Approach and traps

- `scripts/docs-provenance.test.js` scans `docs/releases/*.md`; the new index
  must not make an unqualified MIG-07 browser claim.
- Issue templates are YAML forms; validate them with GitHub's schema by
  opening the "New issue" page once after push (an owner step if the agent
  has no browser access to GitHub).
- Stop rule: none specific.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/docs-shape.test.js` | `MIG-B9-53: STABILITY.md, docs/ROADMAP.md, docs/README.md, docs/releases/README.md and the three issue templates exist; the README links no internal history` | unit | S1–S5 | a planted README link to `docs/features/` fails |
| T2 | `scripts/docs-provenance.test.js` | the releases index passes the scan | docs | S4 | — |
| T3 | `scripts/doc-examples.test.js` | any example in STABILITY.md compiles | docs | S1 | — |

## 9. Acceptance criteria

- **AC1** `node --test scripts/docs-shape.test.js scripts/docs-provenance.test.js` exits 0.
- **AC2** `wc -l < STABILITY.md` ≤ 80; `wc -l < docs/ROADMAP.md` ≤ 60.
- **AC3** `npm test` exits 0.

Owner step: open the repository's "New issue" page once to confirm the forms
render.

## 10. Generated artifacts and guards

None (documentation and GitHub metadata).

## 11. Documentation

This story is documentation.

## 12. Verification

```bash
node --test scripts/docs-shape.test.js scripts/docs-provenance.test.js   # exit 0
npm test                                                                  # background; exit 0
```

## 13. Delivery

Branch `feat/b9-53-signals`. Commit:
`docs(FEAT-010): MIG-B9-53 - STABILITY.md, issue templates, a roadmap and a docs index`.

## 14. Closure record

- **Base:** `feat/beta9` at `d8677d8`, stacked on MIG-B9-01 (#33). **PR:** #35.
  **Commits:** `a6b2059` (the files), `c14d9cd` (the test in `npm test`),
  `e460905` (merges `ci/npm-11`, PR #37).
- **Environment:** a cloud session without npm registry access; CI on GitHub
  Actions (ubuntu-latest, Node 20.20.2, npm 11, Chrome for the gate).
- **Commands:**

  | Command | Where | Exit |
  | --- | --- | --- |
  | `node --test scripts/docs-shape.test.js scripts/docs-provenance.test.js scripts/version-mentions.test.js` | local | 0 (16 pass) |
  | `wc -l < STABILITY.md` / `wc -l < docs/ROADMAP.md` | local | 58 / 34 (AC2: ≤ 80 / ≤ 60) |
  | `node scripts/verify-docs-update.js` | local | 0 |
  | `npm test` (includes `scripts/docs-shape.test.js` and the compiled doc examples) | CI, run 39887973617 | 0 |
  | `npm run verify:1.0` | CI, run 39887973617 | 0 |

- **Controls:** T1's negative control (a README link into `docs/features`)
  is caught.
- **Owner steps pending:** open the repository's "New issue" page once to see
  the three forms render; create the `idea` label if it should be applied.

## 15. Findings and follow-ups

- Candidates for later: `SECURITY.md`, a code of conduct.
- S5 names `CONTRIBUTING.md`, which does not exist yet (MIG-B9-51 creates it):
  the README does not link it; MIG-B9-51 adds the link with the file.
- The root README's links into `docs/features` (FEAT-001, 003, 006, 007, 008,
  009 and MIG-B7-05) now name the feature as plain text; the "Feature roadmap"
  list points at `docs/ROADMAP.md`.
- The issue forms apply the labels `bug`, `question` and `idea`; GitHub skips a
  label the repository does not have, so `idea` is applied only once the owner
  creates it.
- Stacked on MIG-B9-01: the releases index lists the renamed records
  (`0.5.0-beta.8.md`, `0.5.0-beta.9.md`).
