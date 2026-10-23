# MIG-B9-60 — `uxdsl doctor [--fix]`

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · beta.10 under DEC-03 (b), or beta.9 under (a) |
| Wave | 6 |
| Decision gate | None (plan §5.1; no syntax change) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-20 (the removed option it detects), MIG-B9-32 (roles that relied on inheritance) |
| Blocks | — |
| Base | `feat/beta9` after wave 3 |
| Owns | `packages/uxdsl/src/doctor.ts` (new), `packages/uxdsl/test/cli/doctor.test.js` (new), `fixtures/doctor/beta6-project/**` (new) |
| Shares | `packages/uxdsl/bin/uxdsl.js` (the command), `packages/uxdsl/src/diagnostics.ts`, `scripts/verify-docs-update.js`, `fixtures/release-1.0/run.js` |
| Output impact | CLI (a new command) |

## 1. Goal

A project on any earlier version runs one command and gets a list, file by
file, of what to change for the installed version, with the mechanical
changes applied on request. Upgrading stops being a reading exercise.

## 2. Sources

- Plan §5.1: "`uxdsl doctor [--fix]`. Inspects a project and lists, file by
  file, what to change for the installed version: removed commands in
  `package.json` scripts (`uxdsl watch`), old theme file names, removed config
  keys, old package names and import paths, removed or dashed grammar in
  `.uxdsl` files, the agent-guide path. `--fix` applies the mechanical ones by
  reusing the shipped codemods. Every message points at the
  `DIAGNOSTIC_CATALOG` entry. Test it on a copy of a beta.6 project and on
  `story-radar`."
- The shipped codemods: `scripts/codemod-canonical-grammar.js`,
  `codemod-namespace.js`, `codemod-size-overrides.js`; the CLI's
  `REMOVED_COMMANDS`, `REMOVED_CONFIG_KEYS`, `RENAMED_THEME_FILES`
  (`config.ts`), `REMOVED_OPTIONS` (plugin).
- MIG-B9-03's findings (every step the docs did not cover is a `doctor`
  check), MIG-B9-32 §15 (roles that relied on inheritance), MIG-B9-14 (`@import`
  of `.uxdsl` → `@use`), MIG-B9-20 (`includeTheme`).
- Press Craftor's AGENTS.md references `docs/uxdsl-agent-guide.md` and
  `node_modules/postcss-uxdsl/src/` (old paths).

## 3. Preconditions

```bash
grep -q "REMOVED_COMMANDS" packages/uxdsl/bin/uxdsl.js
test -f packages/uxdsl/scripts/codemod-canonical-grammar.js
grep -q "includeTheme" packages/uxdsl/bin/uxdsl.js   # the removed key is known
test ! -f packages/uxdsl/src/doctor.ts
```

## 4. Baseline

```bash
node packages/uxdsl/bin/uxdsl.js doctor 2>&1 | head -2   # "Unknown command" today
```

## 5. Contract

- **T1 — The command.** `uxdsl doctor [--fix] [--json] [<dir>]` scans the
  project at `<dir>` (default cwd) and prints one finding per line:
  `<file>:<line>: <UXD_DOCTOR_CODE>: <what> — <fix>`, grouped by file, then a
  summary (`N findings, M fixable`). Exit 1 when findings remain, 0 when
  none. `--json` prints the findings as an array.
- **T2 — The checks** (each a `UXD_DOCTOR_*` code in `DIAGNOSTIC_CATALOG`,
  owner `cli`, a new owner value):
  - `package.json`: dependencies on the five former names (fix: `npm uninstall`
    them, `npm i -D uxdsl`); scripts using `uxdsl watch` (fix: `uxdsl build --watch`);
  - config: `uxdsl.theme.config.*` present (fix: rename to `uxdsl.theme.*`);
    a theme file exporting `{ theme, references }` (fix: move `references`);
    `REMOVED_CONFIG_KEYS` in the build config, `includeTheme` included (fix:
    delete; put `@uxdsl theme;` in the theme entry);
  - sources (`.uxdsl`, `.css`, `.scss`): the removed and dashed grammar the
    canonical-grammar codemod rewrites (fixable by it); `@import` of a `.uxdsl`
    (fix: `@use`); a `$function` named like a UXDSL function (`UXD_RESERVED_NAME`);
    `includeTheme` in a comment or a config (informational);
  - imports in `.ts`/`.tsx`/`.js`: `postcss-uxdsl/ds-runtime`, `uxdsl-core`,
    `uxdsl-cli` (fix: `uxdsl/runtime`, `uxdsl/theme`, `uxdsl`); the removed
    runtime setters (`updatePalette` …; fix: one `applyTheme` patch);
  - the agent guide: `docs/uxdsl-agent-guide.md` copies or `node_modules/postcss-uxdsl/`
    paths in `AGENTS.md`/`CLAUDE.md` (fix: `node_modules/uxdsl/docs/agent-guide.md`);
  - theme: custom Button/Input roles without `extends` and without every
    state (informational: MIG-B9-32 changed what they emit);
    `typography_details.default` with margins (informational).
- **T3 — `--fix`.** Applies only the mechanical fixes: the grammar codemod,
  the theme file rename, `uxdsl watch` → `uxdsl build --watch`, import path
  rewrites, `@import "x.uxdsl"` → `@use "x"`; prints what it changed; leaves
  the rest as findings. Never edits `node_modules`, never runs `npm`.
- **T4 — Fixture.** `fixtures/doctor/beta6-project/` is a small project in the
  beta.6 shape (five packages, `uxdsl.theme.config.cjs` with references, a
  `watch` script, dashed grammar, a `ds-runtime` import, an old agent-guide
  path); `doctor` reports every planted item; `doctor --fix` leaves exactly
  the informational ones; a second `--fix` changes nothing.
- **T5 — Press Craftor.** `doctor` on the MIG-B9-03 copy before its migration
  reports the steps MIG-B9-03 recorded as missing from the docs; appended to
  the evidence file.

Must stay byte-identical: everything else.

## 6. Out of scope

- Adoption counting (`uxdsl audit`): MIG-B9-61.
- A network check of the installed version: not offered.

## 7. Approach and traps

- `src/doctor.ts` is a library (`diagnoseProject(dir): Finding[]`,
  `applyFixes(findings)`) the CLI wraps; the codemods are required as
  modules, not spawned.
- Scan with `picomatch` over the project's files excluding `node_modules`,
  `.next`, `dist`, `out`; respect `.gitignore` when a `git` directory exists
  (`git ls-files` when available).
- Classify the file in `scripts/verify-docs-update.js` as non-visual ("reads
  a project and reports; compiles nothing").
- Stop rule: a check that cannot name a fix is not a check; drop it or make
  it informational with a documentation link.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/cli/doctor.test.js` | `MIG-B9-60: doctor reports every planted item of the beta6 fixture with file, line, code and fix; exit 1` | CLI | T1, T2, T4 | a clean project exits 0 with no findings |
| T2 | same | `MIG-B9-60: doctor --fix applies the mechanical fixes, leaves the informational ones, and is idempotent` | CLI | T3 | — |
| T3 | same | `MIG-B9-60: --json is parseable and lists the same findings` | CLI | T1 | — |
| T4 | `test/diagnostics-catalog.test.js` | the `UXD_DOCTOR_*` codes are catalogued and asserted | unit | T2 | — |
| T5 | `fixtures/release-1.0/run.js` | `DR-1 | doctor from the tarball on the beta6 fixture` | tarball | T4 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/cli/doctor.test.js` exits 0.
- **AC2** `node packages/uxdsl/bin/uxdsl.js doctor fixtures/doctor/beta6-project` exits 1 with the planted findings; after `--fix`, only informational ones.
- **AC3** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk` exits 0 with `DR-1 ok`.
- **AC4** The MIG-B9-03 evidence file has the `doctor` section.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes (`### CLI`) |
| `migration.md` | yes ("run `uxdsl doctor`" as step one) |
| package README | yes |
| `verify-docs-update.js` classification | yes (`src/doctor.ts` non-visual) |
| `DIAGNOSTIC_CATALOG` | yes |
| `npm run generate:capabilities` | yes (CLI surface) |
| playground captures | yes (`doctor --help`, a transcript) |
| `AGENTS.md` | yes (one sentence under "Using this guide in another project") |

## 11. Documentation

`packages/uxdsl/docs/integrations/cli.md` ("Commands": `doctor`),
`packages/uxdsl/docs/migration.md`, `packages/uxdsl/README.md`, the
playground's `/docs/cli` captures.

## 12. Verification

```bash
node --test packages/uxdsl/test/cli/doctor.test.js            # exit 0
node packages/uxdsl/bin/uxdsl.js doctor fixtures/doctor/beta6-project   # exit 1, findings
npm test                                                       # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                   # background; exit 0
```

## 13. Delivery

Branch `feat/b9-60-doctor`. Commit:
`feat(FEAT-010): MIG-B9-60 - uxdsl doctor [--fix]: what to change for the installed version, file by file`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- Cites `/docs/cli`, which redirects to `/docs/tooling` (next.config.js). Recommended: defer until users ask; the migration guide and the shipped codemods cover the one current consumer.
