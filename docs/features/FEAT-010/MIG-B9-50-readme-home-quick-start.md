# MIG-B9-50 — README, home and quick start

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 5 |
| Decision gate | None (plan §6.1, §6.2, §6.5, §3.3 accepted) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-15, MIG-B9-20 |
| Blocks | MIG-B9-54, MIG-B9-90 |
| Base | `feat/beta9` after MIG-B9-20 (and after wave 4 when the home page is rewritten under DEC-03 (a)) |
| Owns | `README.md` (root), `packages/uxdsl/README.md`, `packages/uxdsl/docs/*.md` (new reference pages the README's sections move to), `packages/playground-nextjs/src/app/docs/quick-start/page.mdx`, `src/app/page.tsx` (copy) |
| Shares | `scripts/lib/doc-examples.js` (the file list), `AGENTS.md` (the "Using this guide" paragraph) |
| Output impact | none |

## 1. Goal

A visitor understands UXDSL in a minute, tries it in five, and fits it into a
project they already have — an SCSS project by renaming a file, any project by
one PostCSS line and one marker. The README is a front door, not a manual.

## 2. Sources

- Plan §6.1 (audience: teams maintaining a design system or an app with
  several themes or brands; secondary: teams building with AI agents; people
  who want disciplined tokens without utilities in markup), §6.2 (the first
  impression: thesis, the five-line example with real output, who it is for,
  how to try it; no release history; CI and npm badges), §6.5 (the
  existing-project quick start first; "rename `.scss` to `.uxdsl`"; low
  lock-in), §3.3 (root README ≤120 lines; package README ≤150).
- Vision: "inspired by Material UI"; "UXDSL is to SCSS what TypeScript is to
  JavaScript"; never "replaces SCSS", never "no media queries" as an
  unqualified claim.
- Measured: `README.md` 405 lines (release history from beta.6 on);
  `packages/uxdsl/README.md` 1,686 lines with 24 `##` sections (install,
  entry points, "See it in 60 seconds", breakpoints, multi-entry theming,
  theme placement, references, spacing keys, overrides, the canonical grammar,
  theme values, variable names, collisions, zero-config defaults (700 lines),
  partial overrides, `applyTheme`, typed config, source maps, verified from
  a real install, AI agents, license).
- `scripts/lib/doc-examples.js` compiles `README.md`, `AGENTS.md`,
  `packages/*/README.md`, `migration.md`, `packages/uxdsl/docs/integrations/*.md`,
  `docs/architecture/*.md` and the playground's `.tsx`/`.mdx`.
- D-11's resolution (plan): a mapping table from an MUI theme to
  `uxdsl.theme.json` in the docs; no converter.

## 3. Preconditions

```bash
test "$(wc -l < README.md)" -gt 300
test "$(wc -l < packages/uxdsl/README.md)" -gt 1500
grep -q "^## From SCSS" packages/uxdsl/README.md    # MIG-B9-15 merged
grep -q "'packages/uxdsl/docs/integrations/" scripts/lib/doc-examples.js
```

## 4. Baseline

```bash
wc -l README.md packages/uxdsl/README.md; npm run verify:doc-examples 2>&1 | tail -2
```

## 5. Contract

- **W1 — Root `README.md`, at most 120 lines:** the thesis in two sentences
  (a design-system engine inspired by Material UI's, written in CSS; UXDSL is
  to SCSS what TypeScript is to JavaScript); the five-line example with its
  real compiled output (a `<!-- doc-example: output -->` block the harness
  verifies); who it is for (three sentences); three ways to start, each two
  lines: an existing project (`uxdsl/postcss` plus `@uxdsl theme;`), an SCSS
  project (rename, build), a new project (`uxdsl init`); links: the site, the
  package README, the reference pages, the CHANGELOG, the release records
  index, STABILITY.md (MIG-B9-53); one status line with the CI badge and the
  npm version badge. No release history (it moves to `docs/releases/README.md`,
  an index written here).
- **W2 — Package `README.md`, at most 150 lines:** install; the three ways
  to start (existing project first); the five-minute tour (one token, one
  directive, one responsive value, one breakpoint block, light/dark); where
  the theme goes (`@uxdsl theme;`); the entry points table; "Learn more"
  links to the reference pages; the AI-agents paragraph; license. Every
  section it drops moves verbatim (examples included) to a page under
  `packages/uxdsl/docs/`: `language.md` (the canonical grammar, token values,
  variable names, collisions, breakpoints, overrides), `theme.md` (zero-config
  defaults, partial overrides, typed config, `$schema`), `runtime.md`
  (`applyTheme`), `references.md`, `source-maps.md`, `from-mui.md` (the
  mapping table: `palette.*.main/light/dark/contrastText` →
  `main/light/dark/contrast`; `breakpoints.values`; `spacing` factor → a
  scale; typography variants → `typography_details`; `shadows[n]`;
  `shape.borderRadius` → `radii`; what has no counterpart), and the existing
  `integrations/*.md`. `scripts/lib/doc-examples.js` adds
  `packages/uxdsl/docs/*.md` to its list so nothing stops being compiled.
- **W3 — The quick start page** (`/docs/quick-start`) mirrors W2's three ways
  in the same order, each tried end to end (MIG-B9-90 is the proof); the
  existing-project path shows the one config line and the one marker, then
  one token in one component; the SCSS path shows the rename; the CLI path
  last.
- **W4 — The home page copy** states the thesis, the audience and the three
  ways to start in the same words as W1 (the demos are MIG-B9-42's).
- **W5 — Wording rules**, checked by a test: "inspired by Material UI" is
  present; "is MUI", "Material UI's engine", "replaces SCSS", "no media
  queries" are absent (the breakpoint block is described as "the author
  writes a breakpoint name, never a media query"; the compiled output still
  uses `@media`).

Must stay byte-identical: compiled outputs (documentation only; the harness
rule change only adds files).

## 6. Out of scope

- "Why UXDSL" in the owner's voice: MIG-B9-54.
- `AGENTS.md` and `CONTRIBUTING.md`: MIG-B9-51.
- The migration guide and the CHANGELOG: MIG-B9-52.

## 7. Approach and traps

- Move, do not rewrite, the package README's sections: `git mv`-like moves
  into the new pages keep the compiled examples intact; then run the harness.
- The README's "See it in 60 seconds" output block must be regenerated with
  the current compiler (the theme block changed in waves 2–3); use the
  harness's output claim, not a pasted stale block.
- Length tests count lines, not words; a table counts as its rows.
- Stop rule: an example that fails to compile after the move is a finding
  for the engine story that changed it; do not edit the example to pass.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/docs-shape.test.js` (new) | `MIG-B9-50: README.md is at most 120 lines and packages/uxdsl/README.md at most 150; the wording rules hold` | unit | W1, W2, W5 | a planted "replaces SCSS" fails |
| T2 | `scripts/doc-examples.test.js` | every example compiles, the new pages included; the README output block matches | docs | W1, W2 | — |
| T3 | `scripts/docs-provenance.test.js` | the releases index does not attribute browser coverage wrongly | docs | W1 | — |
| T4 | `fixtures/playground-browser/walk.js` | the quick-start and home pages render; links resolve (a new check: every internal link on `/` and `/docs/quick-start` returns 200) | Chrome | W3, W4 | — |

## 9. Acceptance criteria

- **AC1** `node --test scripts/docs-shape.test.js` exits 0.
- **AC2** `npm run verify:doc-examples` exits 0 and counts at least as many
  examples as before the story.
- **AC3** `npm test` exits 0; `npm run verify:playground-browser` exits 0.
- **AC4** `ls packages/uxdsl/docs/*.md` lists the pages of W2.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `AGENTS.md` + agent guide | yes ("Using this guide": the README links) |
| root `package.json` `test` | yes (docs-shape test) |
| playground captures | yes if the quick start quotes CLI output |
| `npm run generate:capabilities` | yes (documented functions are read from README/AGENTS: moving text may change the derived list — the pages under `packages/uxdsl/docs/` must be added to `documentedRuntimeFunctions()`'s sources) |

## 11. Documentation

This story is documentation.

## 12. Verification

```bash
node --test scripts/docs-shape.test.js scripts/doc-examples.test.js scripts/docs-provenance.test.js   # exit 0
npm run generate:capabilities && node --test scripts/capability-matrix.test.js                           # exit 0
npm test                                                                                                 # background; exit 0
npm run verify:playground-browser                                                                        # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-50-readme`. Commit:
`docs(FEAT-010): MIG-B9-50 - README as a front door, the package README at 150 lines with reference pages, the quick start for existing projects first`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- It leads with "existing project via `uxdsl/postcss`" (the pre-DEC-01 plan); for Sass teams that path cannot compile SCSS. Lead with the rename and give a per-host table (Vite plugin, webpack loader, Next.js via the CLI's `builds`).
- Qualify the "TypeScript/SCSS works" line with the reserved names (DEC-17); add "not affiliated with MUI"; make the primary audience SCSS teams who want a design system without utility classes, and do not attack Tailwind by name.
- The harness skips output blocks (doc-examples.js:23-24, 71): verifying the output block needs a harness change; add it to Owns.
- This story creates hand-maintained `docs/language.md` and `docs/theme.md` while MIG-B9-62 generates `/docs/language` and `/docs/theme`: do 62 first and generate both from one source.
- `files` ships only `docs/agent-guide.md`; the pages created here, `integrations/*.md` and `migration.md`, would be absent from `node_modules/uxdsl/docs/**`, which MIG-B9-90 reads. Add them and re-check the pack budget.
- Precondition `grep "'packages/uxdsl/docs/integrations/"` exits 1 on the base (doc-examples.js:267 holds a regex); the package README has 22 `##` sections, not 24.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-07:** the quick start's "one breakpoint block" is `@media (--md)`.
- **DEC-17:** the "SCSS works" line needs no qualification for reserved names; mention that a project function named like a UXDSL one wins, with a warning.
