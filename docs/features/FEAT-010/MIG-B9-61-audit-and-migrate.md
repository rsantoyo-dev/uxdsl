# MIG-B9-61 — `uxdsl audit` and `uxdsl migrate --suggest`

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · beta.10 under DEC-03 (b), or beta.9 under (a) |
| Wave | 6 |
| Decision gate | None (plan §8.2; the ladder's steps 2 and 3) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-43 (the playground's strict check and exceptions file become this command's first user) |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-43 |
| Owns | `packages/uxdsl/src/audit.ts` (new), `packages/uxdsl/test/cli/audit.test.js` (new), `fixtures/audit/**` (new) |
| Shares | `packages/uxdsl/bin/uxdsl.js`, `scripts/playground-strict.test.js` (replaced by the command), `packages/playground-nextjs/uxdsl.exceptions.json`, `fixtures/release-1.0/run.js` |
| Output impact | CLI (two new commands) |

## 1. Goal

The ladder's second and third steps have a tool: `audit` counts the decisions
a project still writes by hand and fails CI when the count grows;
`migrate --suggest` proposes the nearest token or role for each one. UXDSL's
"strict mode" is `uxdsl audit --check`.

## 2. Sources

- Plan §8.2: "`uxdsl audit [--check] [--update]`: counts the decisions the
  theme should own (literal colors, spacing, radii, edges, shadows, type,
  hand-built buttons, containers, focus rings) in a project's sources,
  honours a `/* uxdsl-exception: <reason> */` marker, and with `--check`
  fails CI when a count grows past a committed baseline … `uxdsl migrate
  --suggest`: proposes the nearest token or role for each literal … `uxdsl
  doctor` stays the upgrade tool; `audit` is the adoption and drift tool. One
  shared scanner."
- Press Craftor's `scripts/uxdsl-audit.mjs`: categories `color`, `spacing`,
  `radius`, `border`, `shadow`, `type`, `focus`, `button`, `surface`,
  `important`, `exception`; property regexes per category; the
  `uxdsl-exception: <reason>` comment; `--json`, `--check` against a committed
  baseline, `--update`; their `lint` script runs `--check`.
- MIG-B9-43's `scripts/playground-strict.test.js` and
  `uxdsl.exceptions.json` (the same idea, as a repository test).
- The vision's ladder: "Guarantees come with it: components never write a
  breakpoint, nothing fails silently, contrast is checked — UXDSL's 'strict
  mode', which `uxdsl audit --check` can embody."

## 3. Preconditions

```bash
test -f scripts/playground-strict.test.js
test -f packages/playground-nextjs/uxdsl.exceptions.json
test ! -f packages/uxdsl/src/audit.ts
```

## 4. Baseline

```bash
node packages/uxdsl/bin/uxdsl.js audit 2>&1 | head -1   # "Unknown command" today
```

## 5. Contract

- **A1 — `uxdsl audit [--check] [--update] [--json] [paths…]`.** Scans
  `.uxdsl`, `.css` and `.scss` sources (default: the project's configured
  entries' directories; `paths` override) and counts, per file and in total,
  declarations that decide something the theme should own: a literal color
  on a color property; a literal length on padding/margin/gap; a literal
  radius; a literal border width or style with a color; a literal shadow; a
  literal `font-size`/`font-weight`/`line-height`/`letter-spacing`/`font-family`;
  a hand-built focus ring (`outline` on `:focus*` without the focus family);
  a hand-built button or input (a rule on `button`/`input` selectors with
  background and padding but no directive); a hand-written `@media` whose
  `min-width` equals a theme breakpoint; `!important`; a `/* uxdsl-exception:
  <reason> */` on the rule or the line counts as `exception` instead and the
  reason is listed. Output: a table per file and totals; `--json` the
  findings. `--update` writes `uxdsl.audit.json` (the baseline: counts per
  category per file); `--check` exits 1 when any count exceeds the baseline
  and prints which, exit 0 otherwise.
- **A2 — `uxdsl migrate --suggest [paths…]`.** For each `audit` finding with
  a value, proposes the nearest theme token or role without writing: a
  length → the nearest `space(k)` (exact match first, then within 10%) or
  `density(k)` when a responsive pair of the same property exists; a radius →
  `radius(k)`; a shadow → the nearest `shadow(k)` by layer count and blur; a
  color → the nearest `palette` or `colors` entry by OKLCH distance under a
  threshold (`ΔE < 6`), else "no token within range"; a font size → the
  typography role whose base `fontSize` resolves to it; a button rule →
  `@ds-button(<role>)` of the role whose base matches most fields. Output:
  `<file>:<line>: <declaration> → <suggestion>`; `--json`.
- **A3 — One scanner.** `src/audit.ts` holds the scanner, the categories and
  the suggestion logic; `scripts/playground-strict.test.js` is replaced by
  `uxdsl audit --check` on the playground with `uxdsl.exceptions.json` as the
  exceptions file (the command accepts `--exceptions <file>` in the same
  format MIG-B9-43 defined); the root `npm test` runs it.
- **A4 — Press Craftor.** Their `scripts/uxdsl-audit.mjs` is replaced by the
  command in the MIG-B9-03 copy; the baseline is migrated with `--update`;
  the counts match theirs within the categories both define (documented
  differences explained).
- **A5 — Fixture and gate.** `fixtures/audit/` holds a small project with
  known counts; `AU-1` in the gate runs `audit --check` from the tarball
  against its baseline and `migrate --suggest` with expected suggestions.

Must stay byte-identical: everything compiled.

## 6. Out of scope

- Writing the migration (`migrate` without `--suggest`): later, once the
  suggestions prove right on real projects.
- Scanning `.tsx` inline styles: the playground's strict check kept that
  rule as a repository test for `style={{`; `audit` reads stylesheets.

## 7. Approach and traps

- Parse with PostCSS (`.scss` through `postcss-scss`? — no: `.scss`/`.uxdsl`
  go through the Sass stage first? For counting literals in *authored*
  sources, parse the author's text: use `postcss-scss`-free parsing by
  compiling? Decide: the scanner reads the **authored** file with a tolerant
  parser (PostCSS's default parser fails on Sass syntax); `sass`'s own parser
  is not exposed. Use `postcss-scss` as a devDependency of the scanner only if
  needed, or compile each file through the Sass stage and scan the output
  with source positions mapped back. The second keeps one parser; measure
  both on Press Craftor and record the choice in §14.
- Resolve the theme once (`resolveTheme` on the discovered theme) for the
  suggestions; token values with `rem` compare at 16 px per rem unless the
  project declares otherwise (documented).
- Stop rule: a suggestion that is wrong on the fixture is a bug; never widen
  the threshold to make it pass.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/cli/audit.test.js` | `MIG-B9-61: audit counts each category on the fixture, honours exceptions, writes and checks a baseline` | CLI | A1, A5 | a grown count fails `--check` |
| T2 | same | `MIG-B9-61: migrate --suggest proposes the expected token or role for each planted literal and says when none is within range` | CLI | A2 | — |
| T3 | root `npm test` | `uxdsl audit --check` on the playground with its exceptions file | CLI | A3 | — |
| T4 | `fixtures/release-1.0/run.js` | `AU-1` | tarball | A5 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/cli/audit.test.js` exits 0.
- **AC2** `node packages/uxdsl/bin/uxdsl.js audit --check --exceptions packages/playground-nextjs/uxdsl.exceptions.json packages/playground-nextjs/src` exits 0; `test ! -f scripts/playground-strict.test.js`.
- **AC3** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk` exits 0 with `AU-1 ok`.
- **AC4** The MIG-B9-03 evidence file has the `audit` section with the count comparison.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes (`### CLI`) |
| package README | yes ("From SCSS": step two and three use these) |
| `verify-docs-update.js` classification | yes (`src/audit.ts` non-visual) |
| `npm run generate:capabilities` | yes |
| playground captures | yes |
| `AGENTS.md` | yes (the ladder's tools, one paragraph) |

## 11. Documentation

`packages/uxdsl/docs/integrations/cli.md`, `packages/uxdsl/README.md`,
`AGENTS.md`, the playground's `/docs/cli` and `/docs/from-scss` pages.

## 12. Verification

```bash
node --test packages/uxdsl/test/cli/audit.test.js                      # exit 0
node packages/uxdsl/bin/uxdsl.js audit --check --exceptions packages/playground-nextjs/uxdsl.exceptions.json packages/playground-nextjs/src   # exit 0
npm test                                                                # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                            # background; exit 0
```

## 13. Delivery

Branch `feat/b9-61-audit`. Commit:
`feat(FEAT-010): MIG-B9-61 - uxdsl audit [--check] and uxdsl migrate --suggest: the adoption ladder's tools`.

## 14. Closure record

To be filled in the delivering PR, with the parser decision of §7.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- A3/AC2 delete the strict test while §6 keeps its `.tsx` rules as a repository test; §7 leaves the parser undecided and suggests `postcss-scss` "as a devDependency", which consumers would not have and which MIG-B9-13 deletes. Cites `/docs/cli` (now `/docs/tooling`). Recommended: defer; keep the repository's strict test.
