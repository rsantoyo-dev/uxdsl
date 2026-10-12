# MIG-B9-65 — Container context: a design note

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · beta.10 under DEC-03 (b), or beta.9 under (a) |
| Wave | 6 |
| Decision gate | None (plan §5.6 and D-3: a note, not an implementation) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-30 (the breakpoint block is the syntax a container form would extend) |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-30 |
| Owns | `docs/audits/2026-container-context-note.md` (new; `docs/audits` is not compiled by the doc-examples harness, so hypothetical syntax may appear) |
| Shares | None |
| Output impact | none |

## 1. Goal

Before anyone asks for `@container`, the project has written down how UXDSL
would say "this density responds to the component's container" without a
component ever writing a container query, and what it costs. The decision
stays open; the thinking is done once.

## 2. Sources

- Plan D-3: "Container context. Same promise for components: a card in a
  sidebar should not need `@container`. (a) Theme-level context ('this
  density responds to its container'), components unchanged. (b) Container
  variants of the breakpoint functions. (c) After 1.0." and §5.6: "Write down
  how a theme would say 'this density responds to the component's container'
  while components keep writing `density(4)` … and how it relates to §4.2."
- Vision guardrail 4: "keep the 'context' model (§4.2) ready to absorb
  containers (D-3), the modern expectation for components".
- Plan §4.2: one vocabulary for "context": breakpoints and `modes.dark` are
  both contexts the theme maps a decision onto.
- `applyTheme` refuses structural changes (`UXD_THEME_STRUCTURE`); a
  container context compiled into component rules would be structural too.
- CSS: `@container` size queries are Baseline 2023; `container-type` must be
  set on the container; custom properties cannot be queried by size.

## 3. Preconditions

```bash
test ! -f docs/audits/2026-container-context-note.md
grep -q "UXD_BREAKPOINT_BLOCK" packages/uxdsl/src/diagnostics.ts   # MIG-B9-30 merged
```

## 4. Baseline

None.

## 5. Contract

The note (≤ 250 lines, English) answers, with compiled-CSS sketches:

- **N1 — The vocabulary.** Viewport, mode and container as the three contexts
  a decision is resolved in; which are known at build time (viewport
  thresholds, mode selectors, container thresholds) and which at run time
  (the values).
- **N2 — Two designs**, each with its theme JSON shape, its compiled CSS, how
  `density(4)` keeps its spelling, and what becomes structural for
  `applyTheme`:
  - (a) theme-level: a `contexts` family declaring named containers
    (`sidebar: { "container": "inline-size", "steps": { "sm": 320, "md": 480 } }`)
    and a Density expression over them (`"4": "xs(space(4)) md(space(5)) @sidebar(sm(space(3)))"`
    — a sketch, not a grammar) with the compiled `@container sidebar (min-width: …)`
    blocks on the token variables, so components change nothing;
  - (b) component-level: `@sidebar-md { … }`-style blocks (the breakpoint
    block's container form) and `sidebar-md(…)` functions, compiled to
    `@container` queries where the component is written.
- **N3 — What each costs**: where `container-type` is declared (a role? a
  directive argument?), nesting of containers, the interaction with viewport
  blocks in the same rule, the runtime (`applyTheme` can change values, not
  thresholds), the reference pass (container-scoped definitions), the
  contrast gate (unchanged), the playground (which demo would show it).
- **N4 — A recommendation** for after 1.0, with the smallest first step (for
  example (a) for Density only), and what evidence would justify starting
  (a consumer asking; the playground's own SideNav case).
- **N5 — What is explicitly not promised** in beta.9, beta.10, rc.1 and 1.0.

Must stay byte-identical: everything (a document).

## 6. Out of scope

- Any code.

## 7. Approach and traps

- Keep sketches labelled as sketches; the doc-examples harness does not
  compile `docs/audits`, but a reader may paste them — every sketch says
  "not implemented".
- Stop rule: none.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/docs-shape.test.js` | the note exists and is at most 250 lines | unit | N1–N5 | — |

## 9. Acceptance criteria

- **AC1** `test -f docs/audits/2026-container-context-note.md && test "$(wc -l < docs/audits/2026-container-context-note.md)" -le 250`.
- **AC2** `npm test` exits 0 (the harness ignores `docs/audits`).

## 10. Generated artifacts and guards

None.

## 11. Documentation

The note; a one-line pointer from `docs/ROADMAP.md` (MIG-B9-53).

## 12. Verification

```bash
wc -l docs/audits/2026-container-context-note.md   # ≤ 250
npm test                                            # background; exit 0
```

## 13. Delivery

Branch `feat/b9-65-container-note`. Commit:
`docs(FEAT-010): MIG-B9-65 - container context: the design note for after 1.0`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

None yet.
