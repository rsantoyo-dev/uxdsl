# MIG-B9-62 — The generated language reference

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · beta.10 under DEC-03 (b), or beta.9 under (a) |
| Wave | 6 |
| Decision gate | None (plan §5.3) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-30, MIG-B9-34 (the language and families it documents must be final) |
| Blocks | MIG-B9-63 |
| Base | `feat/beta9` after wave 3 |
| Owns | `packages/playground-nextjs/scripts/generate-reference.js` (new), `src/generated/reference.json` (generated), the `/docs/language`, `/docs/theme`, `/docs/diagnostics` pages |
| Shares | `scripts/lib/capabilities.js`, `packages/uxdsl/README.md` (links) |
| Output impact | the site only |

## 1. Goal

One page per reference — the language, the theme, the diagnostics — generated
from the code, complete by construction: every function with its grammar and
one compiled example, every directive with its arguments, every theme family
with its shape and key ranges, every `UXD_*` code with its fix.

## 2. Sources

- Plan §5.3: "One-page language reference, generated from the code … In the
  site (`/docs/language`, `/docs/theme`, `/docs/diagnostics` already exist
  from phase 6 — make them complete and generated) and linked from the
  README."
- The sources of truth: `LANGUAGE_COMPLETIONS` (functions, directives,
  breakpoint names; the at-rules after MIG-B9-30), `TOKEN_FUNCTIONS`,
  `RADIUS_KEYWORDS`, `KNOWN_CSS_FUNCTIONS`; `KNOWN_THEME_FAMILIES` and the
  validator's closed field sets (`TYPOGRAPHY_PROPERTIES`, `SURFACE_PROPERTIES`,
  `BUTTON_PROPERTIES`/`INPUT_PROPERTIES`, the states maps, the focus fields);
  `theme/base.json` for key ranges; `DIAGNOSTIC_CATALOG`; the CLI `--help`
  per command.
- `scripts/lib/capabilities.js` already derives the capability list from the
  same sources and reads the CLI help; `capture-examples.js` compiles
  examples at build time; `/docs/diagnostics` renders the catalog from
  captures.
- FEAT-009 MIG-B7-08 (`theme --diff` summarizing surfaces/buttons/inputs) —
  a candidate, not a commitment.

## 3. Preconditions

```bash
test -f packages/playground-nextjs/src/app/docs/language/page.* && test -f packages/playground-nextjs/src/app/docs/theme/page.* && test -f packages/playground-nextjs/src/app/docs/diagnostics/page.*
grep -q "cliSurface" scripts/lib/capabilities.js
```

## 4. Baseline

Record which functions, directives, families and codes each page mentions
today (a script run) versus the derived lists.

## 5. Contract

- **R1 — The generator.** `scripts/generate-reference.js` (in the playground)
  writes `src/generated/reference.json` with: `functions` (name, kind,
  argument grammar, one example source and its compiled output, the codes it
  can raise); `directives` (name, grammar, arguments, roles/tones/sizes of the
  base theme, one example and output); `atRules` (`@uxdsl theme;`, the
  breakpoint blocks); `families` (name, shape as the validator defines it,
  the base theme's keys and ranges, the variable name pattern, which
  functions read it); `diagnostics` (the catalog as is, grouped by owner);
  `cli` (every command's help). Examples are compiled with the real
  `compile()` at generation time; a failing example fails the generator.
- **R2 — The pages.** `/docs/language`, `/docs/theme` and `/docs/diagnostics`
  render `reference.json` through the layer's components (`CodeBlock`,
  `Section`, `Text`); no hand-written list of functions, families or codes
  remains in `.mdx`/`.tsx`.
- **R3 — Complete by test.** `scripts/capability-matrix.test.js` (or a new
  `reference-complete.test.js`) asserts every derived capability appears on
  its page by name; `npm run test:captures`-style `--check` fails when
  `reference.json` is stale.
- **R4 — Links.** The package README's "Learn more" links the three pages;
  the quick start links `/docs/language`.
- **R5 — Candidate.** If it costs under half a day, `uxdsl theme --diff`
  summarizes `surfaces`, `buttons` and `inputs` like `palette` and
  `typography_details` (FEAT-009 MIG-B7-08); otherwise it stays a §15 item.

Must stay byte-identical: the package.

## 6. Out of scope

- `uxdsl explain` and hover: MIG-B9-63 (they read the same `reference.json`
  shape for arguments).

## 7. Approach and traps

- Reuse `scripts/lib/capabilities.js`'s derivations rather than reading the
  sources again; export what it computes.
- Argument grammars are strings written once per directive in
  `directives.ts` (the usage text in the `_ARGUMENT` messages); surface them
  through `LANGUAGE_COMPLETIONS` or a small exported table so the reference
  and the error messages cannot disagree.
- Stop rule: a capability with no example is a documentation gap to fill, not
  a reason to skip it.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `packages/playground-nextjs/scripts/generate-reference.js --check` | `reference.json` is current | docs | R1, R3 | a changed catalog entry makes `--check` fail |
| T2 | `scripts/reference-complete.test.js` (new) | every derived function, directive, family and code appears on its page | docs | R2, R3 | a removed row fails |
| T3 | `fixtures/playground-browser/walk.js` | the three pages render | Chrome | R2 | — |

## 9. Acceptance criteria

- **AC1** `node packages/playground-nextjs/scripts/generate-reference.js --check` exits 0.
- **AC2** `node --test scripts/reference-complete.test.js` exits 0.
- **AC3** `npm test` exits 0; `npm run verify:playground-browser` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| the playground's `reference.json` | yes (part of `uxdsl:build`) |
| `npm run generate:capabilities` | yes |
| package README | yes (links) |

## 11. Documentation

The three pages; `packages/uxdsl/README.md`.

## 12. Verification

```bash
node packages/playground-nextjs/scripts/generate-reference.js --check   # exit 0
node --test scripts/reference-complete.test.js                           # exit 0
npm run verify:playground-browser                                        # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-62-reference`. Commit:
`feat(FEAT-010): MIG-B9-62 - the language, theme and diagnostics references generated from the code`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

- `theme --diff` for surfaces/buttons/inputs if R5 was not done.

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- Do this before MIG-B9-50, and generate both the docs pages and the markdown reference from one `reference.json`.
