# MIG-B9-51 — AGENTS.md and CONTRIBUTING.md

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` (or beta.10 under DEC-03 (b)) |
| Wave | 5 |
| Decision gate | None (plan §3.3; DEC-16 for the evidence rule) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-15 (and every wave-3 story, whose sections it rewrites) |
| Blocks | MIG-B9-90 |
| Base | `feat/beta9` after wave 3 |
| Owns | `AGENTS.md`, `CONTRIBUTING.md` (new), `scripts/agent-guide.test.js` (size rule) |
| Shares | `packages/uxdsl/docs/agent-guide.md` (generated), `scripts/generate-agent-guide.js` |
| Output impact | none |

## 1. Goal

`AGENTS.md` is the contract an agent reads before touching UI with UXDSL:
primitives, process, grammar, build and runtime, verification — at most 600
lines, with no story ids and no dates. How to work on UXDSL itself lives in
`CONTRIBUTING.md`.

## 2. Sources

- Plan §3.3: "`AGENTS.md` ≤600 lines of contract, with 'Beta.6 implementation
  planning' and 'Maintaining this guide' moved to `CONTRIBUTING.md` and every
  MIG-/FEAT- reference and 'as of …' date removed".
- Measured: `AGENTS.md` is 1,114 lines; its sections: Core principle,
  Process, Spacing and Density, Colors and Palette, Dark mode, Breakpoints,
  Typography, Borders and Radii, Shadows, Surfaces, Buttons, Inputs, Build
  time/runtime/one source of truth (250 lines), Verification scenarios,
  Editor support, Using this guide, Maintaining this guide (70 lines), Beta.6
  implementation planning and evidence (77 lines).
- `scripts/generate-agent-guide.js` generates the packaged copy; `npm test`
  runs its `--check`; `scripts/agent-guide.test.js`.
- FEAT-010 README §1–2 (the protocol and the rules) and DEC-16 (evidence
  recorded once, in the story, in the delivering PR).
- The playground's `/docs/for-ai-agents` page points at the guide.

## 3. Preconditions

```bash
test "$(wc -l < AGENTS.md)" -gt 1000
test ! -f CONTRIBUTING.md
grep -q "^## Beta.6 implementation planning and evidence" AGENTS.md
```

## 4. Baseline

```bash
wc -l AGENTS.md; grep -c "MIG-B\|FEAT-0\|as of 20" AGENTS.md
```

## 5. Contract

- **G1 — `AGENTS.md` ≤ 600 lines**, English, these sections in this order:
  Core principle and responsibilities (the table, with `focus` added);
  Process before changing UI; one section per primitive (Spacing and Density,
  Colors and Palette with modes and scopes, Breakpoints with the block form,
  Typography with `extends`, Borders and Radii, Shadows, Surfaces, Buttons
  with `extends` and the focus rule, Inputs with `:user-invalid`), each with
  responsibility, one compiled example, the rules as bullets, the decision
  rule; Sass inside `.uxdsl` files (what Sass handles, reserved names, the
  `.css` path); Build time and run time (one theme, one generator, the
  marker, `applyTheme` and what is structural, `generateThemeCss`);
  Diagnostics (the catalog exists; nothing silent); Verification scenarios;
  Editor support; Using this guide in another project. Every example compiles
  under the harness.
- **G2 — No history.** No `MIG-`, `FEAT-`, `DE-`, `DEC-` reference, no
  "as of <date>", no "beta.N" version narrative, no "used to", no "removed in".
  A behavior is stated as it is.
- **G3 — `CONTRIBUTING.md`** (English): how to prepare a worktree (FEAT-010
  README §1), the working rules (§2) condensed to one page, the generated
  artifacts and guards, the test levels and the gate, the evidence rule
  (DEC-16), the owner-only actions (merge, publish, dist-tags, deprecate,
  extension), where plans live (`docs/features`, `docs/audits`,
  `docs/releases`), and how the agent guide is generated (the former
  "Maintaining this guide").
- **G4 — The generated guide follows.** `npm run generate:agent-guide`
  produces the packaged copy from the new `AGENTS.md`; `scripts/agent-guide.test.js`
  gains the size rule (≤ 600 lines) and the no-history rule (G2) as tests.
- **G5 — The repository's own instructions point right.** The root
  `README.md` and the `/docs/for-ai-agents` page link `AGENTS.md` for
  consumers and `CONTRIBUTING.md` for contributors.

Must stay byte-identical: compiled outputs.

## 6. Out of scope

- The reference pages the README sections move to: MIG-B9-50.
- The content of the per-primitive rules themselves beyond what waves 1–3
  changed: this story condenses, it does not redesign.

## 7. Approach and traps

- Write `CONTRIBUTING.md` first by moving the two sections out; then condense
  `AGENTS.md` section by section, running `npm run verify:doc-examples`
  after each.
- The "Build time, runtime and one source of truth" section is the longest
  and the most historical; rewrite it from the FEAT-010 §1 "architecture
  after beta.9" and the "one way to update" rules.
- Keep the primitive sections' decision rules verbatim where they are still
  true; they are the part agents quote.
- Stop rule: a rule you cannot state without history is a rule you do not
  understand; find the test that pins it, then state it.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/agent-guide.test.js` | `MIG-B9-51: AGENTS.md is at most 600 lines and names no story id, decision id or date` | unit | G1, G2 | a planted `MIG-B9-51` line fails |
| T2 | `scripts/doc-examples.test.js` | every AGENTS.md example compiles | docs | G1 | — |
| T3 | `node scripts/generate-agent-guide.js --check` | the packaged copy matches | docs | G4 | — |
| T4 | `scripts/docs-shape.test.js` (MIG-B9-50) | `CONTRIBUTING.md` exists and the README links both files | unit | G3, G5 | — |

## 9. Acceptance criteria

- **AC1** `wc -l < AGENTS.md` ≤ 600; `grep -c "MIG-B\|FEAT-0\|DEC-\|as of 20" AGENTS.md` prints 0.
- **AC2** `test -f CONTRIBUTING.md`; it names the generated artifacts, the
  gate and the owner-only actions (grep for `verify:1.0`, `generate:agent-guide`, `publish`).
- **AC3** `node scripts/generate-agent-guide.js --check` exits 0;
  `npm run verify:doc-examples` exits 0; `npm test` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:agent-guide` | yes |
| `npm run generate:capabilities` | yes (documented functions are read from AGENTS.md) |
| playground captures | no |

## 11. Documentation

This story is documentation; the `/docs/for-ai-agents` page copy is updated
with the two links.

## 12. Verification

```bash
node --test scripts/agent-guide.test.js scripts/doc-examples.test.js      # exit 0
node scripts/generate-agent-guide.js --check                                # exit 0
npm run generate:capabilities && node --test scripts/capability-matrix.test.js   # exit 0
npm test                                                                    # background; exit 0
```

## 13. Delivery

Branch `feat/b9-51-agents`. Commit:
`docs(FEAT-010): MIG-B9-51 - AGENTS.md as a 600-line contract without history; CONTRIBUTING.md for working on UXDSL`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

None yet.
