# UXDSL stability plan — handoff (2026-10-07)

Written for the agent that continues the plan. Everything here is self-contained:
the plan is `docs/audits/2026-09-29-auditoria-estabilidad.md` (Spanish; §5 is the
plan, §5.2 the 13 owner decisions — **all accepted**, §5.3 the frozen 1.0
contract). Read that document first, then this one. Nothing is published; the
owner publishes.

## Update 2026-10-08 — read `2026-10-08-plan-beta9.md` instead

Everything this handoff lists as remaining is now planned, with the owner's
later decisions, in [2026-10-08-plan-beta9.md](2026-10-08-plan-beta9.md):
the first release of `uxdsl` is `0.5.0-beta.9` (the five former names were
published as `0.5.0-beta.8` from the pre-stability code), plus the pending
playground, extension and documentation work, the philosophy items and the
user-experience improvements. The working rules in §2 below still apply.

## 0. Status update — 2026-10-07, later the same day

Sections 3.1, 3.2 and 3.3 below are **done**. `feat/stability-integration`
(PR #25 → main) now contains phases 0, 1, 2, 3, 4 and 5; CI is green there
(`npm test` and `verify:1.0`: one tarball, real Chrome). It contains the
PRs numbered 22–24 and 26–28. The packages are now ONE package, `uxdsl`
(`packages/uxdsl`); every `postcss-uxdsl` / `uxdsl-core` / `uxdsl-cli` path
below is historical — read it as `packages/uxdsl` and `uxdsl/<subpath>`. The
beta gates are replaced by `npm run verify:1.0` (`fixtures/release-1.0/run.js`).
Owner publish steps: `docs/releases/uxdsl-package-move.md`.

Owner decisions taken after this handoff was written:

1. **Playground CSS Modules:** re-implement the pattern of branch
   `docs/playground-page-audit` inside phase 6 on the current code (do not
   rebase that branch; close it afterwards).
2. **`npm audit`:** fix both inherited HIGH chains before 1.0 —
   `chokidar` → v4 (+ a glob matcher for `watch` patterns) and UXDSL's own
   implementation of the documented SCSS subset instead of
   `postcss-advanced-variables`. The 1.0 gate requires 0 high/critical on a
   fresh `npm i -D uxdsl`. (This supersedes §5's parking-lot note.)
3. **`packages/playground`** (the old, broken Vite demo): delete it in phase 6.

Remaining work, in order:

- **Dependencies** (decision 2) — branch `feat/stability-deps`, in progress.
- **Phase 6, playground site** (§3.4 playground list + decisions 1 and 3,
  `@uxdsl theme;` added to `LANGUAGE_COMPLETIONS`, VS Code packaging) —
  branch `feat/stability-phase-6-playground`, in progress.
- **Phase 6, markdown docs** (§3.4 "Files": root README ≤120, package README,
  AGENTS ≤600 + CONTRIBUTING, migration in English, drop dated claims) —
  not started; do it after the dependencies branch lands, since it rewrites
  the README section the dependencies branch touches.
- **Phase 7** (§3.5) — not started.
- Small open item: the "did you mean" for numeric keys picks the first key at
  edit distance 1 (`color(gray.350)` → "Did you mean 50?" although 340 and
  300 are as close); prefer the numerically nearest key.

## 1. Where things are (as of the first writing)

Repository `rsantoyo-dev/uxdsl`. `main` is at `0446d7c` (beta.7 integrated).
Nothing from the stability plan is merged yet.

| Work | Branch | PR | State |
| --- | --- | --- | --- |
| Audit + plan + this handoff | `docs/stability-audit` | #21 → main | ready to merge |
| Phase 0 (safety, CI) | `feat/stability-phase-0` | #22 → main | superseded by #25 |
| Phase 1 (validator, parity, `tone()`) | `feat/stability-phase-1-validator` | #24 → phase-0 | superseded by #25 |
| Phase 2 (one runtime API, config, CLI) | `feat/stability-phase-2-runtime-cli` | #23 → phase-0 | superseded by #25 |
| **Phases 0–2 integrated** | `feat/stability-integration` (`858cbeb`) | **#25 → main** | **CI green (test + gate)** |
| Phase 5 (base theme, contrast) | `feat/stability-phase-5-base-theme` (`4eb4b7a`) | #26 → integration | done, verified |
| Phase 3 (grammar, no silent output) | `feat/stability-phase-3-grammar` (`0ff4c42`) | none yet | 4 of 5 deliverables pushed; 5th half-done, uncommitted |
| PRs #16–#19 | old FEAT-009 branches | | already contained in `main`; close them |

Phase 3's uncommitted work lives in the worktree
`.claude/worktrees/agent-acc09a777d09819dc` (6 modified files:
`packages/postcss-uxdsl/src/{diagnostics.ts,ds-runtime.ts,index.ts,preset-engine.ts}`,
`packages/postcss-uxdsl/test/diagnostics-catalog.test.js`, plus a stray
`packages/uxdsl-cli/package-lock.json` that must not be committed). If that
worktree is gone, start deliverable 5 again from `origin/feat/stability-phase-3-grammar`.

What phases 0–2 and 5 already guarantee (verified first-hand, keep it true):
build and runtime emit byte-identical theme CSS; one validator (`validateTheme`)
called by plugin, `generateThemeCss`, `applyTheme`, CLI; one runtime API
(`applyTheme, getAppliedTheme, resetTheme, subscribeTheme, loadPersistedTheme`);
the base theme passes `checkThemeContrast` (0 failing, 111 excepted by three
pattern records, `uxdsl theme --contrast` exits 0 zero-config); default output
≈38 KB (one rule) / 47.7 KB (one `@ds-button`).

## 2. Working rules (same as the agents so far)

- Never `--no-verify` / `HUSKY=0`. The pre-commit hook runs the docs guard and a
  full playground build (~3 min). A change to a guarded engine file needs a
  `### Visual changes` entry in `packages/postcss-uxdsl/CHANGELOG.md`; any
  package code change needs its README touched (`scripts/verify-docs-update.js`).
- Failing test first, then the change, through the owning engine. No parallel
  parsers or duplicated defaults.
- Before each commit: `npm test`, `npm run verify:doc-examples`,
  `node scripts/generate-language-artifacts.js --check`,
  `node scripts/generate-agent-guide.js --check` — all exit 0. Before a PR:
  `node fixtures/mig-b7-18-release/run.js --skip-beta6` and
  `npm run verify:playground-browser` (Chrome at the macOS default path or
  `UXDSL_CHROME_PATH`). Report exact exit codes; never claim an unrun check.
- Doc examples compile (`scripts/doc-examples.test.js`); the capability matrix
  is derived (`npm run generate:capabilities`, `knownGaps` stays empty); after
  editing `AGENTS.md` run `node scripts/generate-agent-guide.js`.
- Generated files to regenerate after any engine/theme/CLI change: build
  `postcss-uxdsl` and `uxdsl-core`; `packages/playground-nextjs`:
  `npm run uxdsl:build` and `node scripts/capture-capabilities.js`; root:
  `npm run generate:capabilities`, `node scripts/generate-language-artifacts.js`,
  `node scripts/generate-agent-guide.js`.
- Commit and push after every deliverable. Sessions have been cut by rate
  limits and by a stream watchdog: keep foreground commands under ~4 minutes
  (run suites, gates and installs in the background with a log file).
- Commits: `feat(stability): phase N (K) - …`; PR bodies end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Do not merge, publish or change dist-tags; those are the owner's.

## 3. Remaining work, in order

### 3.1 Finish phase 3 — deliverable 5 (small)

Branch `feat/stability-phase-3-grammar`. Spec (audit L21, §5.3):

1. Export a frozen `DIAGNOSTIC_CODES` catalog from `postcss-uxdsl`
   (code → one-line meaning → fix), used by the compiler itself, with a test that
   every thrown code is in the catalog and every catalog code is thrown by some
   test. The playground's `/docs/diagnostics` data is generated from it (all
   codes, not 12).
2. Split `Once()` in `src/index.ts` into `validateOptions / emitTheme /
   expandDirectives / expandResponsive` with a per-compilation object instead
   of properties on `root`. Move story-ID history comments (`MIG-…`, `FEAT-…`)
   out of `src/**`; keep comments that describe behavior.
3. From phase 5's report: Button/Input `hover`/`active` selectors do not exclude
   `:disabled` / `[aria-disabled="true"]`, so a disabled control still changes
   color on hover under its dimming. Make the state selectors exclude disabled
   (`test/base-theme-states.test.js` pins the current selectors — change it
   consciously; CHANGELOG `### Visual changes`).
4. Open the PR against `feat/stability-integration` with the final report:
   per deliverable what changed and the test that pins it, the SCSS matrix
   tally (ok / error / silent — silent must be 0), codes added/removed,
   playground CSS before/after.

### 3.2 Integrate phases 3 and 5 (half a day)

On `feat/stability-integration`: merge `origin/feat/stability-phase-5-base-theme`
first (clean), then `origin/feat/stability-phase-3-grammar`. Expected conflicts:

- `packages/postcss-uxdsl/src/theme/base.json`: phase 3 deletes the legacy
  `typography` family and respells `palette(surface-main)` → `palette(surface.main)`
  in `surfaces`; phase 5 rewrote values everywhere else (colors, palette, modes,
  button/input states, zeros). Keep phase 5's values, phase 3's deletions and
  spellings. The result must pass `validateTheme` and the contrast gate
  (`node fixtures/mig-b7-18-release/run.js --write-contrast-baseline` only if
  the pinned set legitimately changed, and say why).
- `CHANGELOG.md`, `README.md`, `AGENTS.md`: both add sections; keep both.
- Generated files (`uxdsl.css`, `cli-captures.json`, `compiler-captures.json`,
  `playground-capability-matrix.md`, `agent-guide.md`, schema, language
  artifacts): take either side, then regenerate everything (§2).
- Phase 5's playground theme overrides use dotted `palette()`/`color()`; phase
  3's codemod (`packages/postcss-uxdsl/scripts/codemod-canonical-grammar.js`)
  may need a second run over files phase 5 added.

Then `npm test`, `npm run verify:beta7`, push; CI on #25 must be green
(`.github/workflows/ci.yml`: `npm test` job, then the gate with Chrome).

### 3.3 Phase 4 — one package `uxdsl` (DE-1, DE-9, DE-10; audit §3.5, §5.3)

Breaking rename, free now (0 external users). Target layout:

```text
uxdsl                      (bin: uxdsl)
  "."          compile(), resolveTheme, DEFAULT_THEME, defineConfig, types
  "./postcss"  the PostCSS plugin  uxdsl({ theme?, includeTheme?, references?, discoverTheme?, configRoot? })
  "./vite"     Vite plugin        peer vite >=4 (optional)
  "./webpack"  loader             peer webpack ^5 (optional)
  "./runtime"  applyTheme, getAppliedTheme, resetTheme, subscribeTheme, loadPersistedTheme — browser-safe, MUST NOT import postcss (audit R5: today 149 KB min because theme-generator/contrast/control-engine require postcss; split generation from application)
  "./theme"    resolveTheme, deepMergeTheme, validateTheme, generateThemeCss, checkThemeContrast, googleFontsImportUrls, KNOWN_THEME_FAMILIES, DEFAULT_BREAKPOINTS; files ./theme/base.json, ./theme/base.contrast-exceptions.json, ./schema/theme.schema.json
  "./language" resolveResponsiveValue, responsiveEntries, inspectResponsiveValue, validateResponsiveExpression, getToneFamilies, LANGUAGE_COMPLETIONS, KNOWN_CSS_FUNCTIONS, DIAGNOSTIC_CODES
  "./config"   defineConfig, discoverThemeAsync/Sync, findThemeConfigPath, THEME_CANDIDATES, config types
  "./engine"   every per-family generate*/inspect*/compile*/…Declarations/…ComponentCss, resolveTypographyRole, themeStructure, inspectReferences, color primitives — declared semver-exempt in its README
```

Steps: create `packages/uxdsl` by moving `postcss-uxdsl` + `uxdsl-core` +
`uxdsl-cli` + the two adapters into one package with `exports` as above and
`sideEffects: false`; `peerDependencies: postcss ^8.4.31`; hard deps only
`postcss-value-parser`, `postcss-import`, `postcss-scss`, `chokidar`, `minimist`
and `postcss-advanced-variables` (keep it; the `@include` fix from phase 3
wraps it); trim `files` (no CHANGELOG/README bloat beyond what npm needs,
ship `docs/agent-guide.md`); delete the CLI's "project-first resolution" block
(`bin/uxdsl.js` top ~90 lines, only needed for version skew between five
packages). Rename theme discovery to `uxdsl.theme.json` (+ `uxdsl.theme.js`/
`.cjs` for computed themes) and drop the `uxdsl.theme.config.*` names.
Publish-time shims: the five old names get one last version that re-exports
from `uxdsl/*` and `npm deprecate` text (prepare them; the owner publishes).
`init`: `npm i -D uxdsl` is the only install line; Next.js keeps writing the
default plugins + `uxdsl/postcss`. Optional (DE-9, only if small): an
`@uxdsl theme;` at-rule that emits the theme `:root` where written, so a
PostCSS-only Next.js setup needs no CLI. Rewrite `fixtures/lib/tarball-consumer.js`
and the gates to one tarball (`verify:1.0` replaces `verify:beta2…7`; keep what
each old gate proved as checks, drop checks of removed features); `scripts/release.js`
to one package; `uxdsl-vscode` stays separate. Update every README, AGENTS.md,
the playground's `local-deps`, CI. Root `package.json` stays `private: true`.

### 3.4 Phase 6 — documentation and playground (audit §3.6, §3.7; docs report)

Depends on the owner's branch `docs/playground-page-audit` (converts every
playground component sheet to a CSS Module; 144 KB global sheet instead of
394 KB): merge it first or rebase the playground work onto it.

Documentation (English only in public docs; history lives in CHANGELOG and
`docs/releases/`; one host `uxdsl.io`, `uxdsl.vercel.app` → 301):

| Page | Content | Target |
| --- | --- | --- |
| `/` | thesis sentence; the 5-line `.uxdsl` next to its compiled CSS; a drag-to-resize frame with one card whose `density(4)` and `@ds-typo(h2)` step while a readout shows the live `--uxdsl__density__4`; 3 CTAs | one screen |
| `/docs/introduction` | the paradigm ("breakpoints belong to the theme"), what it is / is not, comparison table (Tailwind v4, Open Props, Panda, Sass, DTCG) | ≤120 lines |
| `/docs/quick-start` | ONE path (`npm i -D uxdsl`, `init`, `build --watch`), a real `.uxdsl` and its output; Vite/Webpack/Next as tabs; a version line instead of the "Not Production Ready" banner | ≤80 |
| `/docs/language` | grammar of every value function and directive, responsive values (rules, groups, `!important`), `$var`/`@import`/`@mixin` subset exactly as supported — generated from `LANGUAGE_COMPLETIONS` | ≤250 |
| `/docs/theme` | the 14 families with shape, defaults and key ranges, merge rules, `modes.dark`, `fonts.google` opt-out, the JSON editor — generated from the schema | ≤250 |
| token pages | breakpoints · spacing+densities · colors+palette · typography · borders+radii · shadows · surfaces · buttons · inputs; same template: one sentence → live demo → JSON → "you write / you get" → rules | ≤150 each |
| `/docs/runtime` | `applyTheme` only (what it refuses), SSR `generateThemeCss`, `data-theme` switch | ≤150 |
| `/docs/tooling` | CLI tables, config, discovery, multi-entry/CSS Modules, source maps, editor support | ≤250 |
| `/docs/diagnostics` | every code from `DIAGNOSTIC_CODES`: code · when · fix | generated |
| `/docs/accessibility` | the contrast gate, exceptions, pattern records | ≤100 |
| `/docs/for-ai-agents` | the ≈600 durable lines of AGENTS.md (= the packaged guide) | — |
| `/changelog`, `/migration` | generated from CHANGELOG; migration in English, one section per version boundary | — |

Files: root `README.md` ≤120 lines (what/why, 5-line example, install, package
table, links, one status line); package README ≤150; `AGENTS.md` ≤600 (move
"Beta.6 implementation planning" and "Maintaining this guide" to
`CONTRIBUTING.md`; strip MIG/FEAT references and every "as of …" date);
`migration.md` → English ≤200. Claims to drop everywhere: "replaces SCSS",
"no media queries", "type-safe", "fluid typography" (see audit §2.3).

Playground: cut the 12 top-level twins (`/spacing`, `/buttons`, …) and
`/theming` (redirect to `/docs/*`); merge `/docs/home` → `/`,
`/docs/config` → `/docs/theme`, colors+palette, spacing+densities,
`/docs/productivity` → a section (cap its 3,000 cards at ≤48); fix horizontal
overflow at 390 px (`/`, `/docs/buttons`, `/docs/cli`, `/docs/productivity`:
code blocks `overflow-x: auto`); dark-mode header gradient and hero subtitle
contrast; Buttons page JSON/CSS through the code-block component; header with
Docs / GitHub / npm links + version badge; one product name "UXDSL"; move every
"AI implementation guide" block to `/docs/for-ai-agents`; demo before JSON on
each token page; `npm run verify:playground-browser` and the capability matrix
stay green (≈18 routes).

VS Code extension: add `icon` (128 px PNG), `license: "MIT"` + LICENSE file,
`keywords`, a marketplace-facing README, verified `publisher`, a CI job that
packages the VSIX; publishing to Marketplace and Open VSX is the owner's step.

### 3.5 Phase 7 — gate 1.0 and release

1. `verify:1.0` from the single tarball: everything beta.7's gate proved, plus
   build/runtime parity for every theme, the SCSS matrix (0 silent), the
   contrast gate (0 failing, exact excepted set pinned), the Chrome walk,
   compiled doc examples, `npm audit` with 0 high.
2. The test exercise: build a small realistic app (cards, form, buttons,
   light/dark, responsive layout) **from scratch, using only the public
   documentation**, in a fresh project installed from the tarball. Every time
   you have to leave the docs → a documentation bug; every documented thing
   that does not work → a code bug. Record, fix, repeat until it runs clean.
3. `docs/releases/1.0.0-rc.1.md` with the four verification categories
   (automated, browser, external, postpublish); the owner publishes `1.0.0-rc.1`.
4. The owner validates in `story-radar` (note: it currently runs `uxdsl watch`,
   removed in phase 2 → `uxdsl build --watch`; and the package rename).
5. `STABILITY.md` (or a CONTRIBUTING section): the post-1.0 policy from audit
   §5.5 — strict semver on §5.3, `uxdsl/engine` exempt, what is additive in a
   minor, what is forbidden, deprecation = one minor of `UXD_DEPRECATED`
   warnings, bump to `-dev` right after each publish.
6. `1.0.0`.

## 4. Owner-only actions (not for the agent)

- Merge #21 and #25 (then the integration of 3+5 when its CI is green). Close
  #16–#19 (already in `main`) and #22–#24 (absorbed by #25).
- Decide the order of `docs/playground-page-audit` versus phase 6.
- Publish: `1.0.0-rc.1`, `1.0.0`, the five deprecation shims, the VS Code
  extension; dist-tags.
- Three stale worktrees from earlier sessions
  (`.claude/worktrees/agent-a0ff343a3204ac71a`, `-a15cf1c9a77766cfd`,
  `-ae3aadc9d6dc5a793`, branches `feat/feat-008-mig-b6-01/02/13`, 2.7 GB)
  hold commits that are on no remote; delete or push them.

## 5. Parking lot (recorded, deliberately not in scope)

- Container queries, fluid `clamp()` scales, DTCG import/export, `modes.<name>`
  generalization, project-theme completion in the editor: listed in the docs
  as "not promised in 1.0"; all additive later.
- Base `gray` has three near-identical custom shades (`470/480/490`, L 0.56–0.58)
  from earlier contrast corrections; unifying them is a value decision.
- `postcss-advanced-variables@3` nests `postcss@7` (an `npm audit` high with no
  upstream fix); phase 3 wraps its `@include` parsing. Replacing it with a
  minimal own implementation of the documented subset is post-1.0 work.
