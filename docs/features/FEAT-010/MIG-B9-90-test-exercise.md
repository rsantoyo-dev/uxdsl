# MIG-B9-90 — The test exercise: an app from the public docs only

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 7 |
| Decision gate | None (plan §2.2; audit phase 7) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-50, MIG-B9-51 (the docs it tests) |
| Blocks | MIG-B9-91 |
| Base | `feat/beta9` after wave 5 |
| Owns | `fixtures/test-exercise/**` (new: the app, its build script, its Chrome check, the findings log) |
| Shares | `fixtures/release-1.0/run.js` (one check) |
| Output impact | none |

## 1. Goal

Someone who has never seen the repository builds a small realistic app with
UXDSL using only what is published, and nothing stops them. Every place the
documentation fails is a documentation bug; every documented thing that does
not work is a code bug. The exercise repeats until a run is clean.

## 2. Sources

- Plan §2.2: "build a small realistic app (cards, a form, buttons, light/dark,
  a responsive layout) from scratch using only the public documentation.
  Leaving the docs = a docs bug; a documented thing that does not work = a
  code bug. Repeat until clean."
- Audit §5.4 / phase 7: the from-docs test exercise before `rc.1`.
- What is public: the npm tarball (`README.md`, `docs/agent-guide.md`,
  `docs/integrations/*.md`, `docs/*.md` after MIG-B9-50, the CLI's `--help`),
  the site (`uxdsl.io`), the CHANGELOG, `AGENTS.md` through the agent guide.

## 3. Preconditions

```bash
test "$(wc -l < README.md)" -le 120 && test "$(wc -l < AGENTS.md)" -le 600   # MIG-B9-50/51 merged
test ! -d fixtures/test-exercise
```

## 4. Baseline

None (the first run is the baseline).

## 5. Contract

- **X1 — The rules of the exercise.** The agent performing it works in a
  fresh directory with the local tarball installed as `uxdsl` and reads only:
  `node_modules/uxdsl/README.md`, `node_modules/uxdsl/docs/**`, the built
  playground site served locally (`npm --prefix packages/playground-nextjs
  run build && npm run start`), and `uxdsl <command> --help`. It does not open
  the repository's sources, tests or internal docs. Each time it needs
  something those do not give, it writes a numbered finding (what it needed,
  where it looked, what it did instead) before continuing. Each time a
  documented step fails, it writes a finding with the exact command and
  output.
- **X2 — The app**, built twice: in Next.js through the PostCSS path
  (`uxdsl/postcss`, `@uxdsl theme;`, CSS Modules) and in Vite through
  `uxdsl/vite`; both with: a page layout responsive through a breakpoint
  block; three cards (`@ds-surface` in three roles/tones); a form with
  `@ds-input` fields showing the invalid state after interaction; buttons in
  three roles and two tones with visible focus; a light/dark toggle through
  `applyTheme`; a brand-scoped section (`data-uxdsl-scope`); one SCSS file
  renamed to `.uxdsl` that uses a mixin and nesting; a custom theme file with
  one palette change, one density change, one typography role with
  `extends`.
- **X3 — The check.** `fixtures/test-exercise/run.js` builds both apps from
  the tarball and, in Chrome, asserts: no console errors, no unresolved
  `var()`, the card padding equals `--uxdsl__density__4` at two widths, the
  dark toggle changes `surface.main`, the scoped section's button is the
  brand color, a required field is not red before interaction and red after,
  a focused button has the theme's outline, the renamed SCSS file's rule is
  present. The gate gains `TX-1`.
- **X4 — Clean run.** The story ends when a full run from X1 produces zero
  findings. Each round's findings are filed as follow-ups on the owning
  story (documentation: MIG-B9-50/51/52/15; code: the engine story) and the
  round is repeated after they merge. The findings log is
  `fixtures/test-exercise/FINDINGS.md`, newest round first.
- **X5 — Independence.** The agent that runs the exercise is not the agent
  that wrote the documentation of the same wave (recorded in the closure
  record by branch author).

Must stay byte-identical: the package.

## 6. Out of scope

- Fixing the findings inside this story.

## 7. Approach and traps

- Serve the playground locally; do not rely on `uxdsl.io` reflecting the
  branch.
- The Next.js app uses the current Next major the examples use (MIG-B9-54);
  the Vite app the current Vite major.
- Stop rule: a round with findings ends the round, not the story; the story
  is Blocked until the owning stories merge.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `fixtures/test-exercise/run.js` | both apps build from the tarball and pass the Chrome assertions | tarball + Chrome | X2, X3 | a planted wrong density in the theme fails the padding assertion |
| T2 | `fixtures/release-1.0/run.js` | `TX-1` | tarball | X3 | — |
| T3 | `fixtures/test-exercise/FINDINGS.md` | the last round has zero findings | evidence | X4 | — |

## 9. Acceptance criteria

- **AC1** `node fixtures/test-exercise/run.js` exits 0 in real Chrome.
- **AC2** `FINDINGS.md`'s latest round states "0 findings" with its date and
  the tarball's version.
- **AC3** `npm run verify:1.0` exits 0 with `TX-1 ok`.

## 10. Generated artifacts and guards

None (fixture only).

## 11. Documentation

`fixtures/test-exercise/README.md` (the rules of X1).

## 12. Verification

```bash
node fixtures/test-exercise/run.js        # exit 0 (Chrome)
npm run verify:1.0                        # background; exit 0
```

## 13. Delivery

Branch `feat/b9-90-test-exercise`. Commit per round:
`test(FEAT-010): MIG-B9-90 - test exercise round N: <findings count>`.

## 14. Closure record

To be filled in the delivering PR, with the rounds and their findings.

## 15. Findings and follow-ups

Filled per round.

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- X2 builds the Next app's renamed SCSS file through the PostCSS path, which DEC-05 forbids; MIG-B9-14 A8 routes it through the CLI's `builds`.
- "Zero findings" with an LLM tester has no end: define blocking findings. X5 ("a different agent") cannot be verified: require a clean directory with no repository checkout.
- It also depends on wave 4 (it reads the site), MIG-B9-54 and whichever wave-6 tools ship; and on MIG-B9-50 adding the docs to the package `files`.
