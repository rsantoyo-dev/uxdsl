# MIG-B9-52 — Migration guide in English; CHANGELOG "What changes for you"

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.10` (DEC-03, revised 2026-11-04) |
| Wave | 5 |
| Decision gate | None (audit DE-12; plan §3.3 and §8 item 6) |
| Status | Draft (re-baseline after wave 3) |
| Size | S |
| Depends on | MIG-B9-01 (and every story with output impact, whose entries it organizes) |
| Blocks | MIG-B9-92 (DEC-03, revised 2026-11-04) |
| Base | `feat/beta9` after wave 3 |
| Owns | `packages/uxdsl/docs/migration.md`, `packages/uxdsl/CHANGELOG.md` (structure) |
| Shares | `scripts/lib/doc-examples.js` (compiles `migration.md` already) |
| Output impact | none |

## 1. Goal

A project on any earlier version reads one English page and knows what to
change; a reader of the CHANGELOG sees first what changes for them, then the
detail.

## 2. Sources

- Audit DE-12: English for all public documentation. Plan §3.3:
  "`migration.md` in English, one section per version boundary, ≤200 lines".
- Press Craftor item 6 (plan §8): "A CHANGELOG section for every published
  version, beta.8 included; a short 'What changes for you' summary at the top
  of every version, before internal detail (no ticket IDs or contrast counts
  up front); the packaged agent guide's paths either resolve inside
  `node_modules/uxdsl` or are marked repository-relative."
- Measured: `migration.md` is 1,033 lines, mostly Spanish (`## Antes de
  actualizar`, `## beta.6 — MIG-B6-29 …`, `## De beta.1 a beta.2`, …);
  `CHANGELOG.md` is 2,102 lines; its beta.9 section grows one subsection per
  story in waves 1–3.
- MIG-B9-03's findings (the steps the docs did not cover).

## 3. Preconditions

```bash
grep -q "^## Antes de actualizar" packages/uxdsl/docs/migration.md
grep -q "^## 0.5.0-beta.9 — unreleased" packages/uxdsl/CHANGELOG.md
test -f docs/features/FEAT-010/evidence/MIG-B9-03-press-craftor.md
```

## 4. Baseline

```bash
wc -l packages/uxdsl/docs/migration.md packages/uxdsl/CHANGELOG.md
```

## 5. Contract

- **C1 — `migration.md` ≤ 200 lines, English**, sections: "Before you
  upgrade" (snapshot `uxdsl theme`, read the CHANGELOG's "What changes for
  you"); "From the five packages (≤ 0.5.0-beta.8) to `uxdsl`" (install,
  rename the theme file, `references` to the config, scripts, imports, the
  grammar codemod, `@use` entries, the marker, `uxdsl doctor` once MIG-B9-60
  ships — written as "if your version has it"); "From 0.5.0-beta.9 on" (the
  policy: a minor adds, a deprecation warns for one minor); "Visual changes
  by version" (a table: version, what moved, where to look); every step
  MIG-B9-03 found missing is present. Every example compiles.
- **C2 — CHANGELOG structure.** Every version section starts with
  `### What changes for you` (three to eight bullets in plain words, no
  story ids, no counts), then `### Breaking`, `### Visual changes`, `### Added`,
  `### Removed`, `### Diagnostics`, `### Dependencies`, `### CLI`,
  `### Adapters` as needed, each entry ending with the story id in
  parentheses. The beta.8 section (MIG-B9-01) and the beta.9 section follow
  it; older sections get the summary added above their existing text,
  unchanged otherwise.
- **C3 — The packaged agent guide's paths.** `scripts/generate-agent-guide.js`
  rewrites repository-relative paths in the generated copy to resolve inside
  `node_modules/uxdsl` (`packages/uxdsl/src/theme/base.json` → `theme/base.json`)
  or marks them "(in the UXDSL repository)"; a test asserts no
  `packages/uxdsl/` path remains unmarked in the generated file.
- **C4 — A changelog test.** `scripts/changelog-shape.test.js` (new) checks
  that every `## <version>` section has `### What changes for you` as its
  first subsection and that the beta.9 section has no "unreleased" text once
  MIG-B9-91 dates it (the test reads the package version).

Must stay byte-identical: compiled outputs.

## 6. Out of scope

- The release record: MIG-B9-91.
- `uxdsl doctor` itself: MIG-B9-60.

## 7. Approach and traps

- Translate by rewriting from the current behavior, not sentence by sentence;
  the Spanish text describes intermediate betas no reader will install.
- The migration examples compile under the harness; a "before" snippet that
  is now an error carries its `/* UXD_CODE … */` comment.
- Stop rule: a migration step that cannot be verified on the Press Craftor
  copy (MIG-B9-03) is not written as a step.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/docs-shape.test.js` | `MIG-B9-52: migration.md is at most 200 lines and contains no Spanish section heading` | unit | C1 | — |
| T2 | `scripts/changelog-shape.test.js` (new) | `MIG-B9-52: every version section starts with "What changes for you"` | unit | C2, C4 | a planted section without it fails |
| T3 | `scripts/agent-guide.test.js` | `MIG-B9-52: the packaged guide has no unmarked repository path` | unit | C3 | — |
| T4 | `scripts/doc-examples.test.js` | migration examples compile | docs | C1 | — |

## 9. Acceptance criteria

- **AC1** `wc -l < packages/uxdsl/docs/migration.md` ≤ 200; `grep -c "^## .*\(Antes\|De beta\|Contexto\|Qué\|Guía\|Tabla\)" packages/uxdsl/docs/migration.md` prints 0.
- **AC2** `node --test scripts/changelog-shape.test.js scripts/agent-guide.test.js scripts/docs-shape.test.js` exits 0.
- **AC3** `npm run verify:doc-examples` exits 0; `npm test` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:agent-guide` | yes (C3) |
| root `package.json` `test` | yes (changelog-shape test) |

## 11. Documentation

This story is documentation.

## 12. Verification

```bash
node --test scripts/changelog-shape.test.js scripts/agent-guide.test.js scripts/docs-shape.test.js scripts/doc-examples.test.js   # exit 0
npm test   # background; exit 0
```

## 13. Delivery

Branch `feat/b9-52-migration-changelog`. Commit:
`docs(FEAT-010): MIG-B9-52 - the migration guide in English, one section per version boundary; the CHANGELOG leads with "What changes for you"`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- The precondition `## 0.5.0-beta.9 — unreleased` fails once beta.9 is published, and the English "five packages → `uxdsl`" migration (C1) must ship with the release that renames the package. Under DEC-03 (b) that is beta.9: move C1 into the beta.9 gate (MIG-B9-91a). Summaries for the beta.1–7 sections add little; drop them.

### Owner decisions of 2026-11-04 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-04). The owner was given 19 numbered recommendations, in Spanish, and answered, verbatim, "voy a seguir todas tus recomendciones" ("I will follow all your recommendations"): each recommendation is the owner's decision of 2026-11-04. This record is in English and lists those that concern this story. Where they differ from this story's contract or from the review above, they rule.

- **Two releases (decision D13 of 2026-11-04, DEC-03 revised).** This story ships in `0.5.0-beta.10` and blocks MIG-B9-92, the beta.10 gate and release record, instead of MIG-B9-91. MIG-B9-91, the beta.9 gate, includes an English beta.8 → beta.9 migration section; the review above, written for option (b), asks to move C1 into that gate.
- **The codemod (decision D4 of 2026-11-04).** MIG-B9-03's finding 3 is registered as MIG-B9-29, "The canonical-grammar codemod is idempotent" (S, wave 2): a second run is a no-op, pinned by a test, and "MIG-B9-52's release-notes instruction follows". The finding's target for this story is "MIG-B9-52 (one instruction)" (MIG-B9-03 §15).
- **The `engines` release note (decision D10 of 2026-11-04).** `uxdsl` declares `"engines": { "node": ">=20.19" }` in MIG-B9-91, with the release note in the beta.9 migration section. MIG-B9-12's owner flag 11 had proposed that note for this story.

### Owner decisions of 2026-11-10 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-10). The owner was given 32 numbered questions, in Spanish, on the open questions of the seven story files written on 2026-11-10 and on three notes of their PR (#80), each with its options and a recommendation, and answered, verbatim, "fusiona y haz como recmiendes" ("fusiona y haz como recomiendes", "merge, and do as you recommend"): PR #80 was merged, and each recommendation is the owner's decision of 2026-11-10. This record is in English and lists the one that concerns this story. It proposes a follow-up for this story; it does not change its contract, and the re-baseline after wave 3 decides how it enters.

- **Running the codemod over sources only (decision 25, on MIG-B9-29's Q3).** MIG-B9-03's finding 7: `scripts/codemod-canonical-grammar.js` walks generated outputs too, and on `f855765` it rewrites the playground's compiled `src/app/uxdsl.css` and `src/generated/examples.json` with the sources (MIG-B9-29 §15, F2). The owner chose option (a): this story documents running the codemod over sources, not build outputs, and the codemod's walk stays as it is. MIG-B9-29, which ships in `0.5.0-beta.9`, makes a second run a no-op, and its decision 24 makes `npm run codemod:canonical-grammar -- <path>` read every path.
