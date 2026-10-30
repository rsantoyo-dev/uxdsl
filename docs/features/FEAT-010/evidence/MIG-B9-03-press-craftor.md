# MIG-B9-03 — Press Craftor migrated to a local `uxdsl@0.5.0-beta.9` tarball

The migration log of [MIG-B9-03](../MIG-B9-03-validate-main-on-press-craftor.md):
Press Craftor (the `story-radar` repository), cloned to `/tmp/press-craftor`,
moved from the four `0.5.0-beta.8` packages to a tarball packed from this
branch, following only the documented steps (C1). Every step the documents did
not cover is a numbered finding (§4). The real project was not touched (C7, §7).

Run on 2026-10-29. Environment: macOS 27.0.0 (Darwin), Node v20.19.0, npm
11.21.1 (CI resolves `node-version: 20` to the same Node), Google Chrome
156.0.8078.74 (macOS default path) driven by playwright-core 1.63.0 from
`fixtures/mig02-nextjs-cssmodules`, Next.js 16.3.5 (`next build --webpack`,
the project's own script). UXDSL worktree at `0c9fbf6` (`feat/beta9` after
MIG-B9-01, 02, 04, 05, 53 and part 1 of 10); Press Craftor at `dbec897`
(the story's §2 was read at `983ed88`; the drift is 3 commits of application
work — Draft 2 and story collection — and changes none of the files the
story names: `package.json` still lists the four packages at `0.5.0-beta.8`,
the 7-entry `builds`, `uxdsl watch`, `uxdsl.theme.config.cjs` and
`postcss-uxdsl-source.cjs` are as described).

## 1. Preconditions and preparation

The worktree was prepared as CI does (`npm ci --ignore-scripts --no-audit
--no-fund` at the root and in `packages/uxdsl`, `packages/uxdsl-vscode`,
`packages/playground-nextjs`; `npm install` in
`fixtures/mig02-nextjs-cssmodules`; `npm --prefix packages/uxdsl run build`;
`node fixtures/mig07-consumer/run.js`) — every command exit 0.

| Precondition (story §3) | Exit |
| --- | --- |
| `test -d /Users/ricardosantoyo/Documents/projects/story-radar/src/app` | 0 |
| `test "$(node -p "require('./packages/uxdsl/package.json').version")" = "0.5.0-beta.9"` | 0 |
| `node packages/uxdsl/bin/uxdsl.js --version \| grep -q 0.5.0-beta.9` (prints `uxdsl 0.5.0-beta.9`) | 0 |
| `test -x "$(command -v git)"` | 0 |

The tarball (C2): `npm pack --pack-destination /tmp/press-craftor-tarball` in
`packages/uxdsl` produced `uxdsl-0.5.0-beta.9.tgz`, 235,376 bytes packed,
870.2 kB unpacked, 90 files, shasum `5f81c183aa02ca605bff18b89fc35550dd39f7c1`
(sha256 `8d5986e4…04dba5b`). It lives outside the repository so nothing
untracked lands in the worktree.

## 2. Before and after

The baseline (story §4) in the clone: `rm -rf /tmp/press-craftor && git clone
--quiet …/story-radar /tmp/press-craftor` (exit 0, HEAD `dbec897`, clean),
then `npm ci --ignore-scripts --no-audit --no-fund` (exit 0, 586 packages,
11 s), `npm run uxdsl:build` (exit 0, 4 s) and `npm run build` (exit 0,
56 s; `next build --webpack`: compiled in 23.4 s, TypeScript 15.7 s, 70
static pages). No environment variable or secret was needed for the build
(the database client is lazy by design); none was copied into the clone.

| | Before (beta.8 packages) | After (uxdsl@0.5.0-beta.9 tarball) |
| --- | --- | --- |
| `npm run uxdsl:build` | exit 0, 4 s | exit 0, 1 s |
| `npm run build` (`uxdsl build && next build --webpack`) | exit 0, 56 s (compile 23.4 s) | exit 0, 57 s with the `:root`-stripping workaround still in place; exit 0, 56 s without it (C4); exit 0, 55 s final rebuild |
| `src/app/uxdsl.css` | 368,181 B | 89,566 B |
| `src/app/radar-dashboard.generated.module.css` | 463,716 B | 497,778 B |
| `src/app/creative-draft-workspace.generated.module.css` | 276,300 B | 293,052 B |
| `src/app/draft-2-canvas.generated.module.css` | 60,710 B | 62,247 B |
| `src/app/editorial-profile-panel.generated.module.css` | 10,460 B | 10,796 B |
| `src/app/topic-configuration-panel.generated.module.css` | 41,507 B | 43,633 B |
| `src/app/ui/primitives.generated.module.css` | 35,764 B | 39,982 B |
| `node scripts/uxdsl-audit.mjs --json` totals | color 0, spacing 0, radius 0, border 0, shadow 0, type 0, focus 0, button 0, surface 0, important 0, exception 7; components rawButtons 199, sharedButtons 167 | identical |
| `node scripts/uxdsl-audit.mjs --check` | — | exit 0, "no category grew past the baseline" |
| Next CSS chunks (`.next/static/css`) | — | 7 chunks; `:root` only in the global one (11 blocks, 124,806 B, which also carries the one `[style*="--uxdsl__palette__"]` re-declaration); 0 `:root` in the six module chunks |

(`wc -c` sizes. The CLI reports string lengths — `368175 bytes` for a
368,181-byte file — because the file holds six multi-byte characters.)

The theme stylesheet shrinks by 76 % because Button and Input per-tone
variables are now emitted only where the tone changes the value (4,008 →
500 `--uxdsl__button__*`, 372 → 101 `--uxdsl__input__*`): this is the
project's own finding F‑18 ("every Button role is emitted once per palette
tone, used or not") closed by the stability work. The module outputs grow
by the state rules the base roles now carry (§3).

## 3. Build parity (C3, T3): every hunk classified

The seven generated files were saved before the migration
(`/tmp/press-craftor-before/`) and compared with the files `uxdsl build`
wrote afterwards. Three comparisons were made: a plain `diff`; a diff with the
documented typography rename applied to the "before" file and blank lines
ignored; and a rule-level, whitespace-insensitive comparison with PostCSS
(every rule as `selector { prop:value; … }`, inside its `@media` if any),
which lists the rules present on only one side.

### 3.1 `src/app/uxdsl.css` (the theme entry) — 110 changed lines, all (a)

| Hunk | Classification | CHANGELOG reference (`packages/uxdsl/CHANGELOG.md`, section `0.5.0-beta.9`) |
| --- | --- | --- |
| The whole generated theme moves from the end of the file to one insertion point after the author's prelude (line 9), as one block per family on one line each, with no blank lines between blocks | (a) | "One insertion point": the generated theme is one string (`renderThemeCss`) placed after the prelude; an author's own `:root` override now wins |
| The three Density `:root` blocks (base, `md`, `xl`) change from PostCSS's multi-line layout to one line each | (a) | "The density `:root` blocks the plugin emits are now formatted like every other generated block" (stability phase 3, `tokenValueToCss`) |
| Palette declarations become references — `--uxdsl__palette__primary-main: var(--uxdsl__color__purple-700)` instead of `#7e22ce` — and a `colors` block with 49 declarations is added (4 before, the gray scale, which now reads lowercase `#cbd5e1` instead of `#CBD5E1`) | (a) | "the base theme demonstrates Colors → Palette" (DE-11 / T12): palette references `colors`, 45 color declarations added, gray shades lowercased |
| Six resolved palette values change: light `warning.main` `#d97706` → `#b45309`, `warning.dark` `#c25e0a` → `#92400e`, `warning.contrast` `#000000` → `#ffffff`; dark `neutral.dark` `#475569` → `#94a3b8`, dark `warning.dark` (inherited) → `#f59e0b`, dark `light.dark` (inherited) → `#334155` — in both dark blocks (`prefers-color-scheme` and `[data-theme='dark']`), measured with a real parser, 118 → 122 palette declarations | (a) — visible in Press Craftor: its `warning` Button role, `notice-warning` Surface and `warning*` Borders use `palette(warning.*)` | "Six resolved palette values of the packaged base theme change" (the contrast-correction table) |
| Typography variables renamed: `-size` → `-font-size`, `-line` → `-line-height`, `-weight` → `-font-weight`, `-spacing` → `-letter-spacing`, `-transform` → `-text-transform` (230 references in this file, in the theme block and in the author's `body` rule, the latter rewritten by the codemod) | (a) | "Typography variables are named after their CSS property" (`### Removed` table of the seven suffixes) |
| `--font-code: "JetBrains Mono", …` removed | (a) | "The compiled CSS of the packaged base theme loses exactly one declaration, `--font-code`" (flat `typography` family removed) |
| `--uxdsl__space__0: 0` and `--uxdsl__border__0: none` added | (a) | "Explicit zeros" (stability phase 5) |
| Button variables 4,008 → 500, Input 372 → 101: per-tone copies emitted only when the tone changes the value; the untoned base roles gain `focusvisible` and `disabled` variables (`--uxdsl__button__outlined-focusvisible-outline: 2px solid var(--uxdsl__button__tone-main, …)`, `-disabled-opacity: 0.6`, `-disabled-cursor: not-allowed`), and the project's `field` Input role gains `--uxdsl__input__field-disabled-cursor: not-allowed` from the base defaults it does not override | (a) | "Emission … only when substituting the tone changes the value" (the `tone()` entry) and "states the base Button roles were missing" (phase 5, T15/L17/T13) |
| The trailing `/*@uxdsl-bp {…}*/` comment and `#uxdsl-bp-meta { --bp: '…'; display: none; }` rule removed | (a) | "Removed (uxdsl-core, CLI): compiled output no longer ends with the `/*@uxdsl-bp {…}*/` comment and the `#uxdsl-bp-meta` rule" (runtime phase 4) |
| `palette(light-main)`/`palette(dark-main)` in the author's `:root` compile to the same `var(--uxdsl__palette__light-main)`/`…dark-main` after the codemod wrote `palette(light.main)` | (a) | "One spelling per concept … every accepted spelling compiles to the same declarations" (canonical grammar) |

The dark-mode blocks are still emitted twice (under `@media
(prefers-color-scheme: dark)` for `:root:not([data-theme='light'])` and for
`:root[data-theme='dark']`); no Google Fonts `@import` appears before or after
(the project sets `fonts.google: []`), so the `@import` placement change does
not apply here.

### 3.2 The six CSS Modules — every rule-level difference classified

| File | Rules before → after | Only before | Only after | Blank lines before → after |
| --- | --- | --- | --- | --- |
| `radar-dashboard` | 1,547 → 1,605 | 78 plain `:hover`/`:active`, 15 `:disabled` with opacity only, 5 `field` disabled with color + opacity | 78 `:hover:not(:where(:disabled, [aria-disabled="true"]))`/`:active:not(…)`, 29 `:focus-visible { outline … }`, 44 `:disabled, [aria-disabled="true"] { opacity …; cursor … }`, 5 `field` disabled with color + opacity + cursor | 720 → 754 |
| `creative-draft-workspace` | 873 → 897 | 42 plain hover/active, 11 disabled opacity-only, 3 `field` disabled | 42 disabled-aware hover/active, 12 focus-visible, 23 disabled with cursor, 3 `field` disabled with cursor | 734 → 750 |
| `topic-configuration-panel` | 141 → 143 | 3 plain hover, 3 disabled opacity-only | 3 disabled-aware hover, 1 focus-visible, 4 disabled with cursor | 69 → 71 |
| `ui/primitives` | 119 → 129 | 6 plain hover, 1 disabled opacity-only | 6 disabled-aware hover, 5 focus-visible, 6 disabled with cursor | 0 → 0 |
| `editorial-profile-panel` | 44 → 44 | 1 disabled opacity-only (`.panel input/textarea`) | the same rule with `cursor: var(--uxdsl__input__outlined-tone-primary-disabled-cursor, …)` | 25 → 25 |
| `draft-2-canvas` | 236 → 236 | none | none | 17 → 17 |

Every difference belongs to one of these kinds:

| Kind | Classification | CHANGELOG reference |
| --- | --- | --- |
| Typography variable references renamed (946 in `creative-draft-workspace`, 1,576 in `radar-dashboard`, 257 in `draft-2-canvas`, 41, 166, 133): `var(--uxdsl__typography__fine-size)` → `…fine-font-size`, etc. After this rename and ignoring blank lines, `draft-2-canvas` and `editorial-profile-panel` differ by 0 and 21 lines | (a) | "Typography variables are named after their CSS property" |
| Button `hover`/`active` state rules exclude disabled controls: `.button:hover` → `.button:hover:not(:where(:disabled, [aria-disabled="true"]))` | (a) | "A disabled Button or Input no longer changes on hover or press" (stability phase 3) |
| A `:focus-visible` rule and a `:disabled, [aria-disabled="true"]` rule for every `@ds-button(outlined primary 2)`, `@ds-button(contained …)`, `@ds-button(flat …)` that overrides no state; `cursor` added to every Input `disabled` rule, including the project's own `field` role (`disabled: { opacity: "0.6" }` merges the base `cursor: not-allowed`) | (a) | "Every `@ds-button(...)` with no override of the role's states now emits two more rules, and every text-like `@ds-input(...)` one more declaration" (phase 5) |
| Blank lines inserted between generated state rules and between `@import`-inlined rules (+34 in `radar-dashboard`, +16 in `creative-draft-workspace`, +2 in `topic-configuration-panel`) | (a) — the whitespace-only change MIG-B9-02 recorded | "In the CSS text, blank lines can appear between rules the compiler inserts after another rule: `postcss` 8.5.19 changed `Root.normalize`" (MIG-B9-02, `### Visual changes`) |
| Responsive rules the breakpoint split emits carry the author's formatting: `.copyGrid {\n    grid-template-columns: …; }` → `.copyGrid { grid-template-columns: …; }`, `    align-items` (four spaces) → `  align-items` (two) | (a) | "the `@media` blocks the compiler creates for an author's responsive declaration now carry the author's own formatting … the cloned declarations copy the source declaration's `raws`" (stability phase 3) |
| Order of the generated state rules: before `hover, selected, focus-visible, disabled`; after `hover, focus-visible, selected, disabled` (e.g. `.choice` in `ui/primitives`) | **(b) — finding 5** | not found in the CHANGELOG; no rendering change because the two rules set disjoint properties (`selected`: bg/color/border; `focusvisible`: outline/outline-offset) |

No hunk is unexplained: the rule-level comparison reports nothing outside the
rows above, and the two files with no state rules (`draft-2-canvas`,
`editorial-profile-panel`) are byte-identical after the rename (and, for
the latter, the formatting and `cursor` rows).

## 4. Findings

Each finding was written when the step was met, before working around it.
"Documented steps" are `docs/releases/0.5.0-beta.9.md` "Moving `story-radar`"
and `packages/uxdsl/docs/migration.md` "To 1.0: one package, `uxdsl`".

1. **`uxdsl` does not run after the documented install when the project uses `legacy-peer-deps`.**
   Expected (release notes step 2): `npm uninstall postcss-uxdsl uxdsl-cli
   uxdsl-core vite-plugin-uxdsl uxdsl-webpack-loader && npm i -D uxdsl`
   leaves a working `uxdsl` command. Happened: both exit 0 (`removed 21
   packages`; `added 9 packages`), but `npx uxdsl --version` exits 1 with
   `Error: Cannot find module 'postcss' … Require stack: …/node_modules/uxdsl/bin/uxdsl.js`.
   Press Craftor's `.npmrc` sets `legacy-peer-deps=true` (its comment says
   why: `vite-plugin-uxdsl`'s Vite 7 peer conflicted with better-auth's
   optional SvelteKit peers), so npm does not install `uxdsl`'s `postcss`
   peer, and the former packages that depended on `postcss` directly are
   gone. The README's Install section does say "With `--legacy-peer-deps`
   … add it yourself (`npm install -D postcss`)"; neither migration text
   does, and the project's own `scripts/uxdsl-audit.mjs` imports `postcss`
   without declaring it (it rode on hoisting). Workaround: `npm i -D
   postcss` (exit 0, `postcss@8.5.32`), then `uxdsl 0.5.0-beta.9`.
   Target: **MIG-B9-52** (the migration steps name the peer and the
   `legacy-peer-deps` case); **MIG-B9-60** could detect a missing peer.
2. **The documented codemod command misses the theme.** Expected (release
   notes step 3): after the codemod over `src`, the build compiles. Happened:
   `node node_modules/uxdsl/scripts/codemod-canonical-grammar.js --write
   --theme uxdsl.theme.config.cjs src` rewrote 14 files (7 `.uxdsl` sources,
   7 generated `.css` outputs), then `npm run uxdsl:build` exits 1 with
   `[uxdsl] Error: builds[0] (src/app/uxdsl.css): uxdsl.theme.cjs:
   UXD_PALETTE_SYNTAX: palette(primary-main) is not a dotted path; write
   palette(primary.main).` plus four more (`primary-dark`, `light-light`,
   `primary-main, 0.12`, `dark-main, 0.08`). The dashed grammar is refused
   in theme values too, and Press Craftor's theme values live in
   `uxdsl.config.js` at the project root, outside `src` — 98 occurrences. The
   command's target is `src`, and nothing says to run the codemod over the
   theme module as well (the sentence "paths: your .uxdsl/.css/.json
   sources" names JSON, not `.js`/`.cjs` themes). The error names the theme
   file that was loaded (`uxdsl.theme.cjs`), not `uxdsl.config.js`, where
   the value is written. Workaround: `node …/codemod-canonical-grammar.js
   --theme uxdsl.theme.cjs uxdsl.config.js` (preview: 98 rewrites), then
   `--write`; the build then exits 0. Target: **MIG-B9-52** (the step says
   "and over your theme module"); **MIG-B9-60** (`doctor` runs the codemod
   over the discovered theme file too).
3. **The codemod is not idempotent on canonical typography names.** Expected:
   running the codemod a second time — the release notes list it twice, at
   step 3 and again at the end ("run the grammar codemod over the `.uxdsl`
   files; rebuild and compare") — changes nothing. Happened: a second
   preview over `src` reports `typography variable suffixes ×712 … ×1186`
   on the seven generated `.css` files, and in isolation
   `var(--uxdsl__typography__h1-font-size)` is rewritten to
   `var(--uxdsl__typography__h1-font-font-size)` (the lazy
   `[a-z0-9-]*?` head lets `-size` match inside `-font-size`;
   `-line-height` happens to be safe). Here the only files hit are generated
   outputs (gitignored, regenerated by the next build — the generated CSS
   under `src` is also noise in the codemod's report, finding 7), but a
   project that reads `--uxdsl__typography__<role>-font-size` by hand in a
   `.tsx`, `.css` or `.md` file would be corrupted by the second run the
   notes prescribe. Target: **a new story** (fix the suffix regex to require
   the old suffix as the whole trailing segment, e.g. by excluding `font-`,
   `line-`, `letter-`, `text-` heads, and pin the second run as a no-op);
   **MIG-B9-52** removes the duplicate instruction.
4. **A theme value of `inherit` compiles to an unresolvable custom property,
   and nothing says so** (pre-existing in beta.8; found by the Chrome probe,
   not a regression). Press Craftor's `emphasis`, `regular`, `inherit` and
   `multiline` Typography roles set `fontFamily`/`fontSize`/`lineHeight`/
   `letterSpacing`/`fontWeight` to `"inherit"` (its F‑13 workaround), its
   `card`/`panel`/… Surfaces `color: "inherit"`, and its `text`/`outline`
   Button roles `color: "inherit"`. The theme emits
   `:root { --uxdsl__typography__emphasis-font-size: inherit; … }`; in CSS a
   custom property set to `inherit` on the root element takes the initial
   (guaranteed-invalid) value, so every `var(--uxdsl__typography__emphasis-font-size)`
   is unresolved — Chrome reports an empty computed value and the declaration
   becomes `unset`, which for these inherited properties coincidentally gives
   the intended look. The reference-integrity check passes (the property is
   declared) and the compiler is silent. Measured: 24 custom properties, all
   declared `inherit`, read by 512 (rule, element) pairs across the
   `radar-dashboard` and `creative-draft-workspace` modules, identical before
   and after the migration except for the renamed suffixes; the live `/help`
   route shows the same four `emphasis` variables unresolved on
   `.helpContent a`. Target: **a new story** — a located warning (or error
   under a strict flag) when a theme token value is a CSS-wide keyword
   (`inherit`, `initial`, `unset`, `revert`, `revert-layer`), since the
   emitted variable can never resolve; **MIG-B9-33** (`extends: "none"`
   roles emitting only their own fields) is the design that removes the
   need for the `inherit` trick, and should say so in its documentation.
5. **The order of generated state rules changed and is not in the
   CHANGELOG.** Expected: every compiled-output change named in a `###
   Visual changes` entry. Happened: a role's rules are emitted as `hover,
   focus-visible, selected, disabled` where beta.8 emitted `hover, selected,
   focus-visible, disabled`. No rendering change (disjoint properties), but
   a consumer diffing output sees moved lines. Target: **MIG-B9-52** (one
   sentence in the CHANGELOG), or the engine keeps the former order.
6. **The documentation does not say which build config wins when
   `uxdsl.config.cjs` and `uxdsl.config.js` both exist.** Press Craftor has
   both: `.cjs` is the build config, `.js` is theme data required by the
   theme file. The CLI's `CONFIG_CANDIDATES` tries `.cjs` first, so the
   build config wins, and `uxdsl build` printed nothing about the other
   file. The README and CHANGELOG name "`uxdsl.config.cjs` or
   `uxdsl.config.js`" without an order (the theme-file order *is*
   documented). Target: **MIG-B9-50** (one line in the CLI docs: the order,
   and a note that a second candidate is ignored silently); **MIG-B9-60**
   could warn when both exist.
7. **The codemod walks generated outputs.** `src/app/*.generated.module.css`
   and `src/app/uxdsl.css` are build outputs under `src`; the codemod
   rewrote them (typography suffixes ×946, ×1,576, …) and reported them as
   changed, which doubles the report and feeds finding 3. The docs could say
   to run it on sources only, or the codemod could skip files a
   `uxdsl.config.cjs` lists as `outFile`. Target: **MIG-B9-52** (docs), or
   the new codemod story.
8. **The release-notes example names only a JSON theme.** `--theme
   uxdsl.theme.json` in both commands; the codemod's own header documents
   that `--theme` also takes a `.js`/`.cjs` module (and it loaded both the
   former `{ theme, references }` wrapper and the bare theme without
   complaint — not finding number one, as the story feared). Target:
   **MIG-B9-52** (say `--theme <your theme file>`).

Not findings (environment or the project's own decisions), recorded for the
owner in §7: the `.npmrc` `legacy-peer-deps=true` whose reason
(`vite-plugin-uxdsl`'s Vite 7 peer) no longer exists; the two project tests
that pinned the deleted `:root`-stripping half; the comment in
`src/design/topic-themes.ts` that cites `node_modules/postcss-uxdsl/dist/foundations.js`.

Answers to the story's §7 questions: the codemod loaded the `.cjs` theme
module (no finding there); `references` moved into `uxdsl.config.cjs` and
the build accepted it at the top level of a `builds` config; the `uxdsl.config.js`
vs `.cjs` collision is finding 6; `postcss.config.mjs` kept the
`references.css: [readFileSync("src/app/uxdsl.css")]` approach and the
local wrapper plugin by absolute path, which requires `uxdsl/postcss` by
name — this is what the delivered build uses; and, as a separate throwaway
experiment, `plugins: { "uxdsl/postcss": { … } }` **by name** also builds on
Next 16.3.5 with webpack (`next build --webpack`, exit 0, 60 s) — the Turbopack
worker path was not exercised, because the project builds with webpack.

## 5. Commands, in order, with exit codes

Baseline (§2) and preparation (§1) are listed there. Migration, in the clone:

| # | Step (document) | Command | Exit |
| --- | --- | --- | --- |
| 1 | release notes step 1 | `npm uninstall postcss-uxdsl uxdsl-cli uxdsl-core vite-plugin-uxdsl uxdsl-webpack-loader` | 0 (`removed 21 packages`) |
| 2 | release notes step 2 (C2: the tarball instead of the registry) | `npm i -D /tmp/press-craftor-tarball/uxdsl-0.5.0-beta.9.tgz` | 0 (`added 9 packages`) |
| 2a | check | `node -p "require('uxdsl/package.json').version"` → `0.5.0-beta.9`; `npx uxdsl --version` | 0; **1** (finding 1) |
| 2b | workaround, finding 1 | `npm i -D postcss` → 8.5.32; `npx uxdsl --version` → `uxdsl 0.5.0-beta.9` | 0; 0 |
| 3 | release notes step 3 (preview) | `node node_modules/uxdsl/scripts/codemod-canonical-grammar.js --theme uxdsl.theme.config.cjs src` — 14 files would change: 7 `.uxdsl` (`palette()/color() dashed -> dotted` 2 + 88 + 71 + 640 + 25 + 113 + 293; `directive arguments` 1 + 16 + 15 + 403 + 1 + 69 + 263; `radius(full) -> radius(pill)` 10 + 10) and 7 generated `.css` (`typography variable suffixes`) | 0 |
| 4 | release notes step 4 (write) | the same with `--write` — `14 file(s) rewritten` | 0 |
| 5 | release notes "Then": rename the theme file, bare export, `references` into `uxdsl.config.cjs` | `git mv uxdsl.theme.config.cjs uxdsl.theme.cjs`; edit (see the patch) | — |
| 5a | `uxdsl watch` → `uxdsl build --watch` | `package.json` `uxdsl:watch` script edited | — |
| 5b | migration.md step 3: imports | `postcss-uxdsl-source.cjs`: `require("postcss-uxdsl")` → `require("uxdsl/postcss")`; `postcss.config.mjs`: import `./uxdsl.theme.cjs` (bare theme) and `./uxdsl.config.cjs` (for `references`). No `postcss-uxdsl/ds-runtime` import and no `updatePalette`-style call exist in the project (grep over `src`, `scripts`, root files) | — |
| 6 | "rebuild" | `npm run uxdsl:build` | **1** (`UXD_PALETTE_SYNTAX` ×5, finding 2) |
| 6a | workaround, finding 2 | `node …/codemod-canonical-grammar.js --theme uxdsl.theme.cjs uxdsl.config.js` (98 would change); the same with `--write` | 0; 0 |
| 6b | rebuild | `npm run uxdsl:build` (1 s; `draft-2-canvas` reported "unchanged": the codemod's rewrite of that output equals the new compile) | 0 (T1) |
| 7 | `next build`, workaround intact | `npm run build` (57 s) | 0 (T2) |
| 7a | audit | `node scripts/uxdsl-audit.mjs --json`; `--check` | 0; 0 |
| 8 | C4 | delete the `:root`-stripping half of `postcss-uxdsl-source.cjs` (comment names MIG-B9-31); delete the two project tests that asserted it (`src/design/uxdsl-postcss.test.ts`); `rm -rf .next && npm run build` (56 s) | 0 |
| 8a | project plugin test | `node --import tsx --test src/design/uxdsl-postcss.test.ts` — 2 pass | 0 |
| 9 | idempotency probe (finding 3) | second codemod preview over `src`; `--write` on a one-line copy with canonical names | 0 (rewrites reported) |
| 10 | C5 | `env -i PATH HOME NODE_ENV=production npx next start -p 3921` (no secrets, no database); Chrome probe (§6) | probe **1** (§6 explains) |
| 11 | §7 experiment | `postcss.config.mjs` temporarily `plugins: { "uxdsl/postcss": {…} }`; `rm -rf .next && npx next build --webpack` (60 s); restore; `rm -rf .next && npm run build` (55 s) | 0; 0 |

## 6. Chrome (C5, T4) — what ran and what did not

Google Chrome 156.0.8078.74, headless, via playwright-core 1.63.0; the probe is
`walk.js`'s `findUnresolvedVars` verbatim (every custom property a matching
rule reads without a fallback must resolve, computed style, on the elements
the rule applies to) plus console errors, page errors, failed requests and
responses ≥ 400, at 390 and 1280 px, light and dark `prefers-color-scheme`.
Negative control first: a page with `.x { color: var(--uxdsl__nope); }` and a
`console.error` is reported as `unresolved-var --uxdsl__nope … on div.x` and
`console-error injected` (exit 1).

**Not run — the two routes themselves.** `radar-dashboard` is the `/` page and
`creative-draft-workspace` is used by the story and Draft 2 pages
(`/topics/[topicId]/stories/[storyId]…`). Both need `DATABASE_URL` (a Neon
serverless endpoint; the client is `drizzle-orm/neon-http`, not swappable for
PGlite) and, with the project's `AUTH_REQUIRED="true"`, a Google or e-mail
sign-in. The clone was started without the owner's `.env.local` (not copied: it
holds live credentials and the dashboard would read the owner's database);
`/` answers 500 (`DATABASE_URL is not configured`, logged by the server),
which the probe records as `http-500`, a `console-error` and React error #441
on the client — environment, not UXDSL. Theme switching: the app has no
light/dark switcher (it applies a palette per topic as inline
`--uxdsl__palette__*` on a container, which is MIG-B9-31's case); the probe
ran both color schemes anyway.

**Run — the routes that render without data.** `/login` (uses
`ui/primitives.generated.module.css` and `uxdsl.css`): 200 at 390 and 1280 px,
light and dark, **no console error, no UXDSL warning, no failed request, no
unresolved `var()`** (the `--font-geist-*` variables resolve from `next/font`).
`/help` (uses `creative-draft-workspace.generated.module.css`): 200 in all four
cases; the only problems are the four `emphasis` typography variables of
finding 4 (`--uxdsl__typography__emphasis-font-family`, `-font-size`,
`-line-height`, `-letter-spacing` read by `.helpContent a`) and an aborted
prefetch of `/` (`net::ERR_ABORTED`, the 500 above).

**Run — a static proxy for the two modules.** One page per module, with the
compiled `uxdsl.css` and the module's CSS inlined (a `file://` stylesheet
linked from a `file://` page is cross-origin for the CSSOM: its `cssRules`
throw and the probe would skip it silently — the first attempt did exactly
that and "passed"; it is discarded) and one `div`, `button`, `input`,
`textarea`, `select`, `a` and `span` for each of the 494 (`radar-dashboard`)
and 322 (`creative-draft-workspace`) classes the modules' selectors name.
Result, before and after the migration, in both schemes and widths: 512
unresolved (rule, element) pairs, 24 distinct custom properties, every one
declared `inherit` in `uxdsl.css` — finding 4, pre-existing; the two sets are
identical once the renamed suffixes are mapped (`emphasis-size` ↔
`emphasis-font-size`, …). No other unresolved variable, no console error.
This is not the routes: nothing in it proves layout, hydration or the
topic-palette scoping, and it is listed here as what it is.

## 7. The patch and the owner's steps

Applying the patch to the real project is the owner's step (C7). From the
`story-radar` checkout, at `dbec897`:

1. `git apply` the patch block in §8 (it adds `uxdsl.theme.cjs`, deletes
   `uxdsl.theme.config.cjs`, and edits the files listed in the `--stat`). The
   lockfile is not in the block: run `npm uninstall postcss-uxdsl uxdsl-cli
   uxdsl-core vite-plugin-uxdsl` and `npm i -D postcss <path to
   uxdsl-0.5.0-beta.9.tgz>` (or `uxdsl@0.5.0-beta.9` once published) to
   regenerate it. In the clone the lockfile diff is 264 lines: `+ uxdsl`,
   `+ uxdsl/node_modules/picomatch`, `postcss` 8.5.26 → 8.5.32 (now a
   direct dev dependency), and the removal of `postcss-uxdsl`, `uxdsl-cli`,
   `uxdsl-core`, `vite-plugin-uxdsl`, `postcss-advanced-variables` (with its
   own `postcss@7` and `picocolors`), `@csstools/sass-import-resolve`,
   `anymatch`, `binary-extensions`, `chokidar/node_modules/glob-parent`,
   `is-binary-path`, `normalize-path`.
2. `package.json`'s `uxdsl` entry in the clone points at the local tarball
   (`file:../../../tmp/press-craftor-tarball/uxdsl-0.5.0-beta.9.tgz`); the
   patch shows that line — replace it with the published version.
3. Decide on `.npmrc`: `legacy-peer-deps=true` existed for
   `vite-plugin-uxdsl`'s Vite 7 peer, which `uxdsl` no longer has (Vite is
   an optional peer, `>=4`). Keeping it is harmless now that `postcss` is a
   direct dependency; removing it lets npm resolve peers again. Not changed
   here (not a documented step).
4. The two tests in `src/design/uxdsl-postcss.test.ts` that asserted the
   `:root` stripping are deleted by the patch (they pinned the workaround
   C4 removes); the remaining two pass. The comment in
   `src/design/topic-themes.ts` still cites
   `node_modules/postcss-uxdsl/dist/foundations.js`; the file is now
   `node_modules/uxdsl/dist/foundations.js` (not changed: a comment, not a
   documented step).
5. Expect the visible changes of §3: `warning` colors (the `warning` Button
   role, `notice-warning` Surface, `warning*` Borders), keyboard focus rings
   and dimmed-with-`not-allowed` disabled states on the built-in roles the
   primitives use (`@ds-button(outlined primary 2)`, `@ds-input(outlined …)`),
   and no hover change on disabled controls. Clear `.next/cache` after the
   upgrade (the project's own F‑7b note).
6. Finding 4 is the project's `inherit` trick; it worked by accident before
   and still does. MIG-B9-33's `extends: "none"` is the intended replacement.

The clone stays at `/tmp/press-craftor` for inspection (with `node_modules`
and the final `.next`); the "before" outputs at `/tmp/press-craftor-before/`,
the tarball, harness pages and probe outputs at `/tmp/press-craftor-tarball/`.

T5 (C7): `git -C /Users/ricardosantoyo/Documents/projects/story-radar status
--porcelain` printed `?? 4f91cb9c-7c15-4f6d-bf64-0b3a71a8213b.png` and HEAD
`dbec897eaa573db1b8a84aada7626a8f03aaca57` at the start, after the Chrome
checks and at the end of the story — identical.

## 8. The patch (`git -C /tmp/press-craftor diff HEAD`, without `package-lock.json`)

`git diff HEAD --stat` (the lockfile line included for the record):

```text
 package-lock.json                              |  264 +---
 package.json                                   |    8 +-
 postcss-uxdsl-source.cjs                       |   28 +-
 postcss.config.mjs                             |    7 +-
 src/app/creative-draft-workspace.module.uxdsl  | 1024 +++++++-------
 src/app/draft-2-canvas.module.uxdsl            |  222 ++--
 src/app/editorial-profile-panel.module.uxdsl   |   40 +-
 src/app/radar-dashboard.module.uxdsl           | 1692 ++++++++++++------------
 src/app/topic-configuration-panel.module.uxdsl |  136 +-
 src/app/ui/primitives.module.uxdsl             |  116 +-
 src/app/uxdsl.uxdsl                            |    6 +-
 src/design/uxdsl-postcss.test.ts               |   25 -
 uxdsl.config.cjs                               |   25 +-
 uxdsl.config.js                                |  148 +--
 uxdsl.theme.cjs                                |   16 +
 uxdsl.theme.config.cjs                         |   25 -
 16 files changed, 1804 insertions(+), 1978 deletions(-)
```

No untracked file remains in the clone (the generated CSS and `.next` are
gitignored). The `.uxdsl` and `uxdsl.config.js` hunks are the codemod's
mechanical rewrite (`palette(x-y)` → `palette(x.y)`, `@ds-typo (x)` →
`@ds-typo(x)`, `radius(full)` → `radius(pill)`), reproducible by running it;
the hand-written changes are the first eight files and the last four. The
full diff follows (7,608 lines).

````diff
diff --git a/package.json b/package.json
index 3cb89d3..89d6eee 100644
--- a/package.json
+++ b/package.json
@@ -17,7 +17,7 @@
     "pretest": "npm run uxdsl:build",
     "test": "node --import tsx --test scripts/vercel-env.test.mjs scripts/r2-lifecycle-rules.test.mjs scripts/uxdsl-audit.test.mjs src/app/*.test.ts src/app/ui/*.test.tsx src/app/modules/auth/*.test.ts src/app/modules/billing/*.test.ts src/app/modules/observability/*.test.ts src/app/modules/credits/*.test.ts src/app/modules/stories/*.test.ts src/app/modules/draft2/*.test.ts src/app/modules/photo-bank/*.test.ts src/app/modules/documents/*.test.ts src/app/modules/meta/*.test.ts src/app/modules/topics/*.test.ts src/app/modules/sources/*.test.ts src/design/*.test.ts src/design/*/*.test.ts",
     "uxdsl:build": "uxdsl build",
-    "uxdsl:watch": "uxdsl watch",
+    "uxdsl:watch": "uxdsl build --watch",
     "lint": "eslint && node scripts/uxdsl-audit.mjs --check",
     "db:generate": "drizzle-kit generate",
     "db:migrate": "drizzle-kit migrate",
@@ -62,11 +62,9 @@
     "eslint": "^9",
     "eslint-config-next": "16.3.0",
     "patch-package": "^8.0.1",
-    "postcss-uxdsl": "0.5.0-beta.8",
+    "postcss": "^8.5.32",
     "tsx": "^4.20.6",
     "typescript": "^5",
-    "uxdsl-cli": "0.5.0-beta.8",
-    "uxdsl-core": "0.5.0-beta.8",
-    "vite-plugin-uxdsl": "0.5.0-beta.8"
+    "uxdsl": "file:../../../tmp/press-craftor-tarball/uxdsl-0.5.0-beta.9.tgz"
   }
 }
diff --git a/postcss-uxdsl-source.cjs b/postcss-uxdsl-source.cjs
index a64ff14..bb37f08 100644
--- a/postcss-uxdsl-source.cjs
+++ b/postcss-uxdsl-source.cjs
@@ -1,22 +1,21 @@
 /* eslint-disable @typescript-eslint/no-require-imports */
-const uxdsl = require("postcss-uxdsl");
+const uxdsl = require("uxdsl/postcss");
 
-// The CLI already compiles generated CSS Modules. Running UXDSL on them again
-// inherits its process-wide density tokens and injects impure :root selectors.
-//
-// Since 0.5.0-beta.0 the CLI also writes the global token blocks (density,
-// shadow, radius/border, surface, button, input) into every entry it builds,
-// including the per-panel CSS Modules. Those blocks duplicate what the theme
-// build already emits into src/app/uxdsl.css verbatim, and CSS Modules reject
-// them outright ("Selector :root is not pure"). Strip them here so the rule
-// holds for `next build` and `next dev` alike, rather than in a post-build
-// step the UXDSL watcher would bypass.
 // A topic applies its own palette on a container, as inline
 // `--uxdsl__palette__*` properties. The theme's composite tokens (Border,
 // Shadow, Surface, Button and Input variables) are declared on :root, where
 // their `var(--uxdsl__palette__…)` is resolved once against the stock
 // palette, so they would ignore the topic's colors. Declaring them again on
 // every element that carries palette overrides makes them resolve there.
+//
+// UXDSL's MIG-B9-31 (scoped palettes reach every composite) is the story that
+// makes this step deletable: once it ships, the theme itself re-declares the
+// palette-dependent composites on every element carrying a palette scope.
+//
+// The CLI (`uxdsl build`, `includeTheme: false` entries) emits no `:root` into
+// the generated CSS Modules, and refuses an entry that would, so nothing is
+// stripped here any more; the plugin runs on every stylesheet except the
+// generated modules, which the CLI already compiled.
 const THEMED = '[style*="--uxdsl__palette__"]';
 const COMPOSITE = /^--uxdsl__(border|shadow|surface|button|input)__/;
 const PALETTE_DEPENDENT = /var\(--uxdsl__(palette|border|shadow|surface|button|input)__/;
@@ -46,13 +45,6 @@ module.exports = function sourceOnlyUxdsl(options) {
       if (!root.source?.input.file?.endsWith(".generated.module.css")) {
         return plugin.Once(root, helpers);
       }
-      root.walkRules((rule) => {
-        if (rule.selector.trim() === ":root") rule.remove();
-      });
-      // A responsive token block leaves behind an empty @media wrapper.
-      root.walkAtRules("media", (atRule) => {
-        if (!atRule.nodes?.length) atRule.remove();
-      });
     },
   };
 };
diff --git a/postcss.config.mjs b/postcss.config.mjs
index 9452c8c..5186304 100644
--- a/postcss.config.mjs
+++ b/postcss.config.mjs
@@ -1,4 +1,5 @@
-import themeConfig from "./uxdsl.theme.config.cjs";
+import theme from "./uxdsl.theme.cjs";
+import buildConfig from "./uxdsl.config.cjs";
 import { readFileSync } from "node:fs";
 import path from "node:path";
 
@@ -9,11 +10,11 @@ const config = {
     // `theme.breakpoints` when it's absent, and `theme` already carries it
     // (see uxdsl.config.js) — setting it here too would shadow, not merge.
     [path.resolve(process.cwd(), "postcss-uxdsl-source.cjs")]: {
-      theme: themeConfig.theme,
+      theme,
       includeTheme: false,
       references: {
         css: [readFileSync("src/app/uxdsl.css", "utf8")],
-        ...themeConfig.references,
+        ...buildConfig.references,
       },
     },
   },
diff --git a/src/app/creative-draft-workspace.module.uxdsl b/src/app/creative-draft-workspace.module.uxdsl
index 955f48f..a4a470d 100644
--- a/src/app/creative-draft-workspace.module.uxdsl
+++ b/src/app/creative-draft-workspace.module.uxdsl
@@ -5,12 +5,12 @@
   display: grid;
   place-items: center;
   padding: xs(density(3)) md(density(6));
-  background: palette(dark-main, 0.66);
+  background: palette(dark.main, 0.66);
   backdrop-filter: blur(8px);
 }
 
 .workspace {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   overflow: hidden;
   flex-direction: column;
@@ -27,7 +27,7 @@
   gap: density(6);
   padding: xs(density(5)) md(density(6));
   border-bottom: border(subtle);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .header p,
@@ -35,24 +35,24 @@
 .recommendation span,
 .briefCopy span {
   margin: 0 0 space(2);
-  color: palette(tertiary-main);
-  @ds-typo (badge);
+  color: palette(tertiary.main);
+  @ds-typo(badge);
 }
 
 .header h2 {
   max-width: 900px;
   margin: 0;
-  color: palette(dark-main);
-  @ds-typo (title-lg);
+  color: palette(dark.main);
+  @ds-typo(title-lg);
 }
 
 .header > button {
-  @ds-button (secondary);
+  @ds-button(secondary);
   width: 36px;
   height: 36px;
   border: border(subtle);
   border-radius: radius(circle);
-  @ds-typo (icon-lg);
+  @ds-typo(icon-lg);
 }
 
 .body {
@@ -63,7 +63,7 @@
 .loading {
   min-height: 260px;
   padding: density(8);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 
 .progress {
@@ -75,14 +75,14 @@
 }
 
 .progressStep {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   align-items: center;
   gap: density(3);
   padding: density(3) density(4);
   border-radius: radius(pill);
-  color: palette(tertiary-main);
-  @ds-typo (meta-strong);
+  color: palette(tertiary.main);
+  @ds-typo(meta-strong);
 }
 
 .progressStep span {
@@ -91,18 +91,18 @@
   height: 20px;
   place-items: center;
   border-radius: radius(circle);
-  background: palette(light-light);
-  @ds-typo (fine);
+  background: palette(light.light);
+  @ds-typo(fine);
 }
 
 .progressActive {
-  border-color: palette(primary-main);
-  color: palette(primary-dark);
+  border-color: palette(primary.main);
+  color: palette(primary.dark);
 }
 
 .progressComplete span {
-  background: palette(surface-light);
-  color: palette(primary-dark);
+  background: palette(surface.light);
+  color: palette(primary.dark);
 }
 
 .notice,
@@ -111,19 +111,19 @@
   margin: 0 0 space(5);
   padding: density(4) density(5);
   border-radius: radius(3);
-  @ds-typo (caption);
+  @ds-typo(caption);
 }
 
 .notice {
   border: border(primary-soft);
-  background: palette(light-light);
-  color: palette(primary-dark);
+  background: palette(light.light);
+  color: palette(primary.dark);
 }
 
 .error {
   border: border(error);
-  background: palette(light-light);
-  color: palette(error-dark);
+  background: palette(light.light);
+  color: palette(error.dark);
 }
 
 .error strong,
@@ -137,23 +137,23 @@
 
 .warning {
   border: border(warning);
-  background: palette(light-light);
-  color: palette(warning-dark);
+  background: palette(light.light);
+  color: palette(warning.dark);
 }
 
 .profilePanel {
-  @ds-surface (panel);
+  @ds-surface(panel);
   border-radius: radius(3);
 }
 
 .profilePanel summary {
-  @ds-button (link);
+  @ds-button(link);
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: density(5);
   padding: density(4) density(5);
-  @ds-typo (compact-strong);
+  @ds-typo(compact-strong);
   list-style: none;
 }
 
@@ -168,8 +168,8 @@
 }
 
 .profilePanel summary small {
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .profileSummaryHead {
@@ -187,29 +187,29 @@
 }
 
 .profileSummaryHead strong {
-  @ds-typo (eyebrow);
-  color: palette(primary-dark);
+  @ds-typo(eyebrow);
+  color: palette(primary.dark);
 }
 
 .profileSummaryHead small {
-  @ds-typo (fine);
-  color: palette(tertiary-main);
+  @ds-typo(fine);
+  color: palette(tertiary.main);
 }
 
 .profileSummaryLink {
-  @ds-surface (card);
+  @ds-surface(card);
   flex: 0 0 auto;
   padding: density(2) density(3);
-  border-radius: radius(full);
-  color: palette(primary-main);
-  @ds-typo (meta-strong);
+  border-radius: radius(pill);
+  color: palette(primary.main);
+  @ds-typo(meta-strong);
   text-decoration: none;
   white-space: nowrap;
 }
 
 .profileSummaryLink:hover,
 .profileSummaryLink:focus-visible {
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
   outline: 0;
 }
 
@@ -253,14 +253,14 @@
   min-width: 0;
   padding: density(3);
   border-top: border(control);
-  background: palette(light-light);
+  background: palette(light.light);
   box-shadow: shadow(1);
 }
 
 .profileGuideHint {
   margin: calc(density(3) * -1) 0 0;
-  color: palette(tertiary-main);
-  @ds-typo (caption);
+  color: palette(tertiary.main);
+  @ds-typo(caption);
 }
 
 .carouselChromePanel {
@@ -272,7 +272,7 @@
   padding: density(4);
   border: border(1);
   border-radius: radius(3);
-  background: palette(surface-light);
+  background: palette(surface.light);
   box-shadow: shadow(1);
 }
 
@@ -303,7 +303,7 @@
   padding: density(2);
   border: border(1);
   border-radius: radius(2);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .paletteColor input[type="color"] {
@@ -332,8 +332,8 @@
 }
 
 .paletteColor code {
-  color: palette(tertiary-dark);
-  @ds-typo (fine);
+  color: palette(tertiary.dark);
+  @ds-typo(fine);
 }
 
 .paletteRemove,
@@ -342,7 +342,7 @@
   border-radius: radius(1);
   width: max-content;
   min-height: density(6);
-  @ds-typo (label);
+  @ds-typo(label);
 }
 
 .paletteRemove {
@@ -364,8 +364,8 @@
 .carouselChromeSelect {
   display: grid;
   gap: density(2);
-  color: palette(primary-dark);
-  @ds-typo (label);
+  color: palette(primary.dark);
+  @ds-typo(label);
 }
 
 .carouselChromeSelect select,
@@ -383,13 +383,13 @@
   padding: density(3);
   border: border(1);
   border-radius: radius(2);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .carouselChromePreview > span,
 .carouselChromePreview p {
   margin: 0;
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
   @ds-typo(caption);
 }
 
@@ -407,7 +407,7 @@
 }
 
 .carouselChromeStyleOption {
-  @ds-button (secondary);
+  @ds-button(secondary);
   display: grid;
   gap: density(1);
   justify-items: center;
@@ -415,16 +415,16 @@
   padding: density(2);
   border: border(1);
   border-radius: radius(2);
-  @ds-typo (label);
+  @ds-typo(label);
 }
 
 .carouselChromeStyleOption:hover {
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
 }
 
 .carouselChromeStyleSelected {
   border: border(2);
-  background: palette(primary-light);
+  background: palette(primary.light);
 }
 
 .brandUiPreview {
@@ -434,8 +434,8 @@
 }
 
 .brandUiPreviewLabel {
-  color: palette(tertiary-dark);
-  @ds-typo (eyebrow);
+  color: palette(tertiary.dark);
+  @ds-typo(eyebrow);
 }
 
 .brandUiFrame {
@@ -457,7 +457,7 @@
 }
 
 .brandUiNav strong {
-  @ds-typo (label);
+  @ds-typo(label);
 }
 
 .brandUiMain {
@@ -473,7 +473,7 @@
 }
 
 .brandUiCard strong {
-  @ds-typo (body-strong);
+  @ds-typo(body-strong);
 }
 
 .brandUiCard p {
@@ -495,15 +495,15 @@
   padding: density(1) density(3);
   border: border(1);
   border-radius: radius(1);
-  @ds-typo (label);
+  @ds-typo(label);
 }
 
 .brandUiBadge {
   display: inline-flex;
   align-items: center;
   padding: density(1) density(2);
-  border-radius: radius(full);
-  @ds-typo (label);
+  border-radius: radius(pill);
+  @ds-typo(label);
 }
 
 .brandUiInput {
@@ -530,30 +530,30 @@
   gap: density(1);
   padding: density(1) density(2);
   border: border(1);
-  border-radius: radius(full);
-  color: palette(tertiary-dark);
+  border-radius: radius(pill);
+  color: palette(tertiary.dark);
   @ds-typo(caption);
 }
 
 .brandUiCheck[data-pass="false"] {
-  @ds-typo (emphasis);
-  border-color: palette(secondary-main);
+  @ds-typo(emphasis);
+  border-color: palette(secondary.main);
 }
 
 .brandUiCheck code {
 
-  @ds-typo (fine);
+  @ds-typo(fine);
 }
 
 .brandUiWarnings {
-  @ds-surface (card);
+  @ds-surface(card);
   display: grid;
   gap: density(1);
   margin: 0;
   padding: density(2) density(3);
   border-left: border(2);
   border-radius: radius(1);
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
   @ds-typo(caption);
 }
 
@@ -566,7 +566,7 @@
   padding: density(4);
   border: border(1);
   border-radius: radius(3);
-  background: palette(surface-light);
+  background: palette(surface.light);
   box-shadow: shadow(1);
 }
 
@@ -580,14 +580,14 @@
 
 .brandOverlayHeader strong {
   display: block;
-  color: palette(primary-dark);
-  @ds-typo (label);
+  color: palette(primary.dark);
+  @ds-typo(label);
 }
 
 .brandOverlayHeader p {
   max-width: 660px;
   margin: density(1) 0 0;
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
   @ds-typo(caption);
 }
 
@@ -601,15 +601,15 @@
   padding: density(2) density(3);
   border: border(1);
   border-radius: radius(2);
-  background: palette(light-light);
-  color: palette(primary-dark);
-  @ds-typo (label);
+  background: palette(light.light);
+  color: palette(primary.dark);
+  @ds-typo(label);
   cursor: pointer;
 }
 
 .brandEnabledToggle input,
 .brandRange input {
-  accent-color: palette(primary-main);
+  accent-color: palette(primary.main);
 }
 
 .brandEnabledToggle:has(input:disabled) {
@@ -626,16 +626,16 @@
 
 /* A status, not an action: a tinted label with a dot, never a filled button shape. */
 .metaStatusChip {
-  @ds-surface (boxed);
+  @ds-surface(boxed);
   border: border(1);
   display: inline-flex;
   flex: 0 0 auto;
   align-items: center;
   gap: space(3);
   padding: space(2) space(4);
-  border-radius: radius(full);
-  color: palette(tertiary-dark);
-  @ds-typo (meta-strong);
+  border-radius: radius(pill);
+  color: palette(tertiary.dark);
+  @ds-typo(meta-strong);
   white-space: nowrap;
 }
 
@@ -648,21 +648,21 @@
 }
 
 .metaStatusConnected {
-  border-color: palette(success-main, 0.35);
-  background: palette(success-main, 0.08);
-  color: palette(success-dark);
+  border-color: palette(success.main, 0.35);
+  background: palette(success.main, 0.08);
+  color: palette(success.dark);
 }
 
 .metaStatusWarning {
-  border-color: palette(warning-main, 0.45);
-  background: palette(warning-main, 0.08);
-  color: palette(warning-dark);
+  border-color: palette(warning.main, 0.45);
+  background: palette(warning.main, 0.08);
+  color: palette(warning.dark);
 }
 
 .metaStatusError {
-  border-color: palette(error-main, 0.35);
-  background: palette(error-main, 0.06);
-  color: palette(error-dark);
+  border-color: palette(error.main, 0.35);
+  background: palette(error.main, 0.06);
+  color: palette(error.dark);
 }
 
 .metaConnectionBody {
@@ -683,14 +683,14 @@
 }
 
 .metaConnectionDetails dt {
-  color: palette(tertiary-dark);
-  @ds-typo (badge);
+  color: palette(tertiary.dark);
+  @ds-typo(badge);
 }
 
 .metaConnectionDetails dd {
   margin: 0;
-  color: palette(primary-dark);
-  @ds-typo (label);
+  color: palette(primary.dark);
+  @ds-typo(label);
 }
 
 .metaConnectionActions {
@@ -714,11 +714,11 @@
   padding: density(3);
   border: border(1);
   border-radius: radius(2);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .brandAssetPreview {
-  @ds-surface (card);
+  @ds-surface(card);
   border: border(1);
   display: grid;
   min-height: density(14);
@@ -727,11 +727,11 @@
   padding: density(4);
   border-radius: radius(2);
   background:
-    linear-gradient(45deg, palette(surface-light) 25%, transparent 25%),
-    linear-gradient(-45deg, palette(surface-light) 25%, transparent 25%),
-    linear-gradient(45deg, transparent 75%, palette(surface-light) 75%),
-    linear-gradient(-45deg, transparent 75%, palette(surface-light) 75%),
-    palette(light-light);
+    linear-gradient(45deg, palette(surface.light) 25%, transparent 25%),
+    linear-gradient(-45deg, palette(surface.light) 25%, transparent 25%),
+    linear-gradient(45deg, transparent 75%, palette(surface.light) 75%),
+    linear-gradient(-45deg, transparent 75%, palette(surface.light) 75%),
+    palette(light.light);
   background-position: 0 0, 0 density(2), density(2) calc(density(2) * -1), calc(density(2) * -1) 0;
   background-size: density(4) density(4);
 }
@@ -746,7 +746,7 @@
   display: grid;
   min-height: density(10);
   place-items: center;
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
   @ds-typo(caption);
   text-align: center;
 }
@@ -759,7 +759,7 @@
 
 .brandAssetMeta strong {
   overflow: hidden;
-  color: palette(primary-dark);
+  color: palette(primary.dark);
   @ds-typo(caption);
   text-overflow: ellipsis;
   white-space: nowrap;
@@ -770,14 +770,14 @@
 .brandEnableHint,
 .brandBackdropHint {
   margin: 0;
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
   @ds-typo(caption);
 }
 
 .brandAssetHint,
 .brandEnableHint {
 
-  @ds-typo (fine);
+  @ds-typo(fine);
 }
 
 .brandUpload {
@@ -791,7 +791,7 @@
   justify-content: center;
   padding: 0 density(4);
   border-radius: radius(2);
-  @ds-typo (label);
+  @ds-typo(label);
   cursor: pointer;
 }
 
@@ -836,8 +836,8 @@
 .brandControlLabel,
 .brandRange > span,
 .brandColorControl > span:first-child {
-  color: palette(primary-dark);
-  @ds-typo (label);
+  color: palette(primary.dark);
+  @ds-typo(label);
 }
 
 .brandSegmented {
@@ -852,7 +852,7 @@
   justify-content: center;
   padding: 0 density(3);
   border-radius: radius(2);
-  @ds-typo (label);
+  @ds-typo(label);
   cursor: pointer;
 }
 
@@ -881,8 +881,8 @@
   position: absolute;
   width: density(2);
   height: density(2);
-  border-radius: radius(full);
-  background: palette(tertiary-main);
+  border-radius: radius(pill);
+  background: palette(tertiary.main);
   content: "";
 }
 
@@ -922,7 +922,7 @@
 }
 
 .brandPlacementSelected::after {
-  background: palette(primary-contrast);
+  background: palette(primary.contrast);
 }
 
 .brandRangeGrid,
@@ -950,7 +950,7 @@
   gap: density(3);
   padding: density(2) density(3);
   border-radius: radius(2);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .brandColorPicker input {
@@ -966,12 +966,12 @@
 }
 
 .brandColorPicker code {
-  color: palette(dark-main);
+  color: palette(dark.main);
   @ds-typo(code);
 }
 
 .brandBackdropHint {
-  @ds-surface (boxed);
+  @ds-surface(boxed);
   border: border(1);
   padding: density(3);
   border-radius: radius(2);
@@ -1011,7 +1011,7 @@
 
 /* A negative version is white or light: it shows on a dark ground, as it will be used. */
 .logoVersionPreview[data-tone="negative"] {
-  background: palette(primary-dark);
+  background: palette(primary.dark);
 }
 
 .charactersSection {
@@ -1033,21 +1033,21 @@
 
 .charactersHeading strong,
 .characterSlot > header strong {
-  color: palette(primary-dark);
-  @ds-typo (meta);
+  color: palette(primary.dark);
+  @ds-typo(meta);
 }
 
 .charactersHeading p,
 .referenceEmpty {
   margin: density(1) 0 0;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .charactersHeading small,
 .characterReferencesHeading small {
-  color: palette(tertiary-main);
-  @ds-typo (fine-strong);
+  color: palette(tertiary.main);
+  @ds-typo(fine-strong);
 }
 
 .characterGrid {
@@ -1057,7 +1057,7 @@
 }
 
 .characterSlot {
-  @ds-surface (card);
+  @ds-surface(card);
   display: grid;
   align-content: start;
   gap: density(3);
@@ -1069,15 +1069,15 @@
 .characterReferencesHeading > span {
   display: block;
   margin-bottom: density(1);
-  color: palette(tertiary-main);
-  @ds-typo (badge);
+  color: palette(tertiary.main);
+  @ds-typo(badge);
 }
 
 .characterRemoveButton,
 .referenceItem button {
-  @ds-button (link-danger);
+  @ds-button(link-danger);
   font: inherit;
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
 }
 
 .characterRemoveButton:disabled,
@@ -1098,7 +1098,7 @@
 }
 
 .referenceItem {
-  @ds-surface (card);
+  @ds-surface(card);
   min-width: 0;
   margin: 0;
   overflow: hidden;
@@ -1111,9 +1111,9 @@
   width: 100%;
   aspect-ratio: 1;
   place-items: center;
-  background: palette(light-light);
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  background: palette(light.light);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
   object-fit: cover;
 }
 
@@ -1124,19 +1124,19 @@
 
 .referenceItem figcaption span {
   overflow: hidden;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
   text-overflow: ellipsis;
   white-space: nowrap;
 }
 
 .referenceItem figcaption button {
   flex: 0 0 auto;
-  @ds-typo (fine);
+  @ds-typo(fine);
 }
 
 .referenceUpload {
-  @ds-button (secondary);
+  @ds-button(secondary);
   display: inline-flex;
   width: max-content;
   max-width: 100%;
@@ -1145,7 +1145,7 @@
   padding: 0 space(4);
   border: border(dashed-primary);
   border-radius: radius(2);
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
 }
 
 .referenceUpload input {
@@ -1175,22 +1175,22 @@
 
 .field > span,
 .factPicker legend {
-  color: palette(primary-dark);
-  @ds-typo (fine-strong);
+  color: palette(primary.dark);
+  @ds-typo(fine-strong);
 }
 
 .field input,
 .field textarea,
 .field select,
 .emojiRow input[type="number"] {
-  @ds-input (field);
+  @ds-input(field);
   width: 100%;
   /* surface-light sits too close to the page background to read as a field edge. */
   border-radius: radius(2);
   outline: none;
-  color: palette(dark-main);
+  color: palette(dark.main);
   font: inherit;
-  @ds-typo (caption);
+  @ds-typo(caption);
 }
 
 .field input,
@@ -1204,7 +1204,7 @@
   width: 18px;
   height: 18px;
   padding: 0;
-  accent-color: palette(primary-main);
+  accent-color: palette(primary.main);
 }
 
 .field textarea {
@@ -1216,7 +1216,7 @@
 .field input:focus,
 .field textarea:focus,
 .field select:focus {
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
   box-shadow: shadow(ring);
 }
 
@@ -1226,15 +1226,15 @@
   gap: density(4);
   padding: density(4);
   border-radius: radius(3);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .sliders label {
   display: flex;
   flex-direction: column;
   gap: density(2);
-  color: palette(primary-main);
-  @ds-typo (fine-strong);
+  color: palette(primary.main);
+  @ds-typo(fine-strong);
 }
 
 .sliders label span {
@@ -1243,15 +1243,15 @@
 }
 
 .sliders input {
-  accent-color: palette(primary-dark);
+  accent-color: palette(primary.dark);
 }
 
 .emojiRow {
   display: flex;
   align-items: center;
   gap: density(6);
-  color: palette(primary-dark);
-  @ds-typo (meta-strong);
+  color: palette(primary.dark);
+  @ds-typo(meta-strong);
 }
 
 .emojiRow label {
@@ -1270,8 +1270,8 @@
   flex-wrap: wrap;
   align-items: center;
   gap: density(2) density(5);
-  color: palette(primary-dark);
-  @ds-typo (meta-strong);
+  color: palette(primary.dark);
+  @ds-typo(meta-strong);
 }
 
 .checkRow label {
@@ -1281,7 +1281,7 @@
 }
 
 .section {
-  @ds-surface (card);
+  @ds-surface(card);
   margin-top: density(5);
   padding: density(5);
   border-radius: radius(4);
@@ -1298,27 +1298,27 @@
 
 .sectionHeading h3 {
   margin: 0;
-  color: palette(dark-main);
-  @ds-typo (title);
+  color: palette(dark.main);
+  @ds-typo(title);
 }
 
 .budget,
 .statusPill {
   padding: density(2) density(3);
   border-radius: radius(pill);
-  background: palette(light-light);
-  color: palette(primary-main);
-  @ds-typo (fine-strong);
+  background: palette(light.light);
+  color: palette(primary.main);
+  @ds-typo(fine-strong);
 }
 
 .statusApproved {
-  background: palette(surface-light);
-  color: palette(primary-dark);
+  background: palette(surface.light);
+  color: palette(primary.dark);
 }
 
 .briefCallout,
 .generateDraftCard {
-  @ds-surface (dropzone);
+  @ds-surface(dropzone);
   display: flex;
   align-items: xs(stretch) md(center);
   flex-direction: xs(column) md(row);
@@ -1330,15 +1330,15 @@
 
 .briefCallout strong,
 .generateDraftCard strong {
-  color: palette(primary-dark);
-  @ds-typo (caption);
+  color: palette(primary.dark);
+  @ds-typo(caption);
 }
 
 .briefCallout p,
 .generateDraftCard p {
   margin: density(2) 0 0;
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .editorialDirectionPanel {
@@ -1353,18 +1353,18 @@
 
 .editorialDirectionPanel > p {
   margin: 0;
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
   @ds-typo(caption);
 }
 
 .historyPanel {
-  @ds-surface (card);
+  @ds-surface(card);
   margin-top: density(5);
   border-radius: radius(3);
 }
 
 .historyPanel summary {
-  @ds-button (link);
+  @ds-button(link);
   display: flex;
   align-items: center;
   justify-content: space-between;
@@ -1387,20 +1387,20 @@
 
 .historyPanel summary strong,
 .historyList button strong {
-  @ds-typo (meta);
+  @ds-typo(meta);
 }
 
 .historyPanel summary small,
 .historyList button small {
-  color: palette(tertiary-main);
-  @ds-typo (fine-strong);
+  color: palette(tertiary.main);
+  @ds-typo(fine-strong);
 }
 
 .historyPanel summary > span:last-child,
 .historyList button > span:last-child {
   flex: 0 0 auto;
-  color: palette(primary-main);
-  @ds-typo (fine-strong);
+  color: palette(primary.main);
+  @ds-typo(fine-strong);
 }
 
 .historyList {
@@ -1410,7 +1410,7 @@
 }
 
 .historyList button {
-  @ds-button (secondary);
+  @ds-button(secondary);
   display: flex;
   min-width: 0;
   align-items: center;
@@ -1430,12 +1430,12 @@
 .historyList button:hover,
 .historyList button:focus-visible,
 .historyList button.historySelected {
-  border-color: palette(primary-main);
-  background: palette(light-light);
+  border-color: palette(primary.main);
+  background: palette(light.light);
 }
 
 .historyCallout {
-  @ds-surface (callout);
+  @ds-surface(callout);
   display: flex;
   align-items: xs(stretch) md(center);
   flex-direction: xs(column) md(row);
@@ -1447,14 +1447,14 @@
 }
 
 .historyCallout strong {
-  color: palette(primary-dark);
-  @ds-typo (caption);
+  color: palette(primary.dark);
+  @ds-typo(caption);
 }
 
 .historyCallout p {
   margin: density(2) 0 0;
-  color: palette(primary-main);
-  @ds-typo (fine);
+  color: palette(primary.main);
+  @ds-typo(fine);
 }
 
 .historyActions {
@@ -1470,7 +1470,7 @@
 }
 
 .historicalDraftDetails {
-  @ds-surface (card);
+  @ds-surface(card);
   display: grid;
   gap: density(4);
   margin-bottom: density(5);
@@ -1487,24 +1487,24 @@
 }
 
 .historicalDraftHeading strong {
-  color: palette(primary-dark);
-  @ds-typo (caption);
+  color: palette(primary.dark);
+  @ds-typo(caption);
 }
 
 .historicalDraftHeading p {
   margin: density(2) 0 0;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .historicalDraftHeading small {
   flex: 0 0 auto;
-  color: palette(primary-main);
-  @ds-typo (fine-strong);
+  color: palette(primary.main);
+  @ds-typo(fine-strong);
 }
 
 .historicalRegenerationAction {
-  @ds-surface (contained primary 2);
+  @ds-surface(contained primary 2);
   display: flex;
   flex-direction: xs(column) md(row);
   align-items: xs(stretch) md(center);
@@ -1514,18 +1514,18 @@
 }
 
 .historicalRegenerationAction strong {
-  color: palette(primary-contrast);
-  @ds-typo (meta);
+  color: palette(primary.contrast);
+  @ds-typo(meta);
 }
 
 .historicalRegenerationAction p {
   margin: density(1) 0 0;
-  color: palette(primary-contrast);
-  @ds-typo (fine);
+  color: palette(primary.contrast);
+  @ds-typo(fine);
 }
 
 .historicalRegenerationAction button {
-  @ds-button (contained light 3);
+  @ds-button(contained light 3);
   border-radius: radius(2);
   flex: 0 0 auto;
 }
@@ -1538,8 +1538,8 @@
 
 .historicalRegenerationControls small {
   max-width: xs(none) md(320px);
-  color: palette(error-light);
-  @ds-typo (fine);
+  color: palette(error.light);
+  @ds-typo(fine);
 }
 
 .historicalDraftFields {
@@ -1554,31 +1554,31 @@
 }
 
 .readOnlyDraftField > span {
-  color: palette(tertiary-main);
-  @ds-typo (badge);
+  color: palette(tertiary.main);
+  @ds-typo(badge);
 }
 
 .readOnlyDraftField textarea {
-  @ds-input (field);
+  @ds-input(field);
   width: 100%;
   min-height: 0;
   resize: vertical;
   border: border(subtle);
   border-radius: radius(2);
-  color: palette(dark-main);
+  color: palette(dark.main);
   font: inherit;
-  @ds-typo (meta);
+  @ds-typo(meta);
 }
 
 .historicalUnits {
-  @ds-surface (card);
+  @ds-surface(card);
   border-radius: radius(2);
 }
 
 .historicalUnits summary {
-  @ds-button (link);
+  @ds-button(link);
   padding: density(4) density(4);
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
 }
 
 .historicalUnits > div {
@@ -1588,7 +1588,7 @@
 }
 
 .historicalUnits article {
-  @ds-surface (card);
+  @ds-surface(card);
   display: grid;
   gap: density(3);
   padding: density(4);
@@ -1603,26 +1603,26 @@
 }
 
 .historicalUnits article strong {
-  color: palette(primary-dark);
-  @ds-typo (meta);
+  color: palette(primary.dark);
+  @ds-typo(meta);
 }
 
 .historicalUnits article small {
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .completeScript {
-  @ds-surface (flat primary);
+  @ds-surface(flat primary);
   border-radius: radius(3);
   box-shadow: shadow(1);
   overflow: hidden;
 }
 
 .completeScript summary {
-  @ds-button (link);
+  @ds-button(link);
   padding: density(4);
-  @ds-typo (label);
+  @ds-typo(label);
 }
 
 .completeScriptBody {
@@ -1640,28 +1640,28 @@
 }
 
 .completeScriptHeading strong {
-  color: palette(primary-dark);
-  @ds-typo (label);
+  color: palette(primary.dark);
+  @ds-typo(label);
 }
 
 .completeScriptHeading p {
   margin: density(1) 0 0;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .completeScript textarea {
-  @ds-input (outlined neutral 3);
+  @ds-input(outlined neutral 3);
   border-radius: radius(2);
   width: 100%;
   resize: vertical;
-  color: palette(dark-main);
-  @ds-typo (fine);
+  color: palette(dark.main);
+  @ds-typo(fine);
 }
 
 .completeScript small {
-  color: palette(error-main);
-  @ds-typo (fine);
+  color: palette(error.main);
+  @ds-typo(fine);
 }
 
 .primaryButton,
@@ -1669,24 +1669,24 @@
 .approveButton,
 .unapproveButton {
   min-height: 38px;
-  @ds-typo (button);
+  @ds-typo(button);
 }
 
 .primaryButton,
 .approveButton {
 
-  @ds-button (primary);
+  @ds-button(primary);
 }
 
 .secondaryButton {
-  @ds-button (secondary);
+  @ds-button(secondary);
   justify-self: start;
   border: border(control);
 }
 
 .unapproveButton {
 
-  @ds-button (warning);
+  @ds-button(warning);
 }
 
 .primaryButton:disabled,
@@ -1712,25 +1712,25 @@
   gap: density(5);
   padding: density(5);
   border-radius: radius(3);
-  background: linear-gradient(135deg, palette(light-light), palette(light-light));
+  background: linear-gradient(135deg, palette(light.light), palette(light.light));
 }
 
 .recommendation strong {
   display: block;
-  color: palette(dark-main);
-  @ds-typo (title-lg);
+  color: palette(dark.main);
+  @ds-typo(title-lg);
 }
 
 .recommendation small {
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .recommendation p,
 .briefCopy p {
   margin: 0;
-  color: palette(primary-dark);
-  @ds-typo (caption);
+  color: palette(primary.dark);
+  @ds-typo(caption);
 }
 
 .briefCopyGrid {
@@ -1759,29 +1759,29 @@
 
 .editorialAngle header strong {
   @ds-typo(h5);
-  color: palette(primary-dark);
+  color: palette(primary.dark);
 }
 
 .editorialAngle header small,
 .editorialAngle details small {
   @ds-typo(small);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 
 .editorialAngle [role="status"] {
   @ds-typo(small);
   margin: 0;
-  color: palette(warning-dark);
+  color: palette(warning.dark);
 }
 
 .editorialAngleDefinition {
   @ds-typo(small);
   margin: 0;
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
 }
 
 .editorialAngle details summary {
-  @ds-button (link-accent);
+  @ds-button(link-accent);
   @ds-typo(small);
 }
 
@@ -1791,7 +1791,7 @@
 }
 
 .carouselPlanSummary {
-  @ds-surface (card);
+  @ds-surface(card);
   border: border(1);
   display: grid;
   gap: density(3);
@@ -1805,14 +1805,14 @@
 }
 
 .carouselPlanSummary h4 {
-  color: palette(primary-dark);
-  @ds-typo (meta-strong);
+  color: palette(primary.dark);
+  @ds-typo(meta-strong);
 }
 
 .carouselPlanSummary p {
   margin-top: density(1);
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .carouselPlanSummary ol {
@@ -1829,24 +1829,24 @@
   gap: density(1);
   padding: density(3);
   border-radius: radius(1);
-  background: palette(surface-light);
+  background: palette(surface.light);
 }
 
 .carouselPlanSummary strong,
 .carouselPlanSummary span,
 .carouselPlanSummary small {
-  @ds-typo (caption);
+  @ds-typo(caption);
 }
 
 .carouselPlanSummary strong {
-  @ds-typo (fine);
-  color: palette(primary-dark);
+  @ds-typo(fine);
+  color: palette(primary.dark);
 }
 
 .carouselPlanSummary span,
 .carouselPlanSummary small {
-  @ds-typo (fine);
-  color: palette(tertiary-main);
+  @ds-typo(fine);
+  color: palette(tertiary.main);
 }
 
 .formatOptions {
@@ -1856,7 +1856,7 @@
 }
 
 .formatOptions button {
-  @ds-button (secondary);
+  @ds-button(secondary);
   display: grid;
   grid-template-columns: 1fr auto;
   gap: density(2) density(5);
@@ -1867,27 +1867,27 @@
 }
 
 .formatOptions button > span {
-  @ds-typo (meta-strong);
+  @ds-typo(meta-strong);
 }
 
 .formatOptions button > strong {
-  @ds-typo (title);
+  @ds-typo(title);
 }
 
 .formatOptions button > small {
   grid-column: 1 / -1;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .formatOptions .selectedFormat {
-  border-color: palette(primary-main);
-  background: palette(light-light);
+  border-color: palette(primary.main);
+  background: palette(light.light);
   box-shadow: shadow(ring);
 }
 
 .draftSetup {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   align-items: xs(stretch) md(flex-end);
   flex-direction: xs(column) md(row);
@@ -1904,12 +1904,12 @@
 
 .draftSetup p {
   margin: 0 0 space(2);
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .imageQualitySetup {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   align-items: xs(stretch) md(flex-end);
   flex-direction: xs(column) md(row);
@@ -1926,8 +1926,8 @@
 
 .imageQualitySetup p {
   margin: 0 0 space(2);
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .factsAndRisks {
@@ -1939,14 +1939,14 @@
 .factsAndRisks > div {
   padding: density(4);
   border-radius: radius(3);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .factsAndRisks h4,
 .unitsHeading h4 {
   margin: 0 0 space(3);
-  color: palette(primary-dark);
-  @ds-typo (meta-strong);
+  color: palette(primary.dark);
+  @ds-typo(meta-strong);
 }
 
 .factsAndRisks ul {
@@ -1960,15 +1960,15 @@
 .factsAndRisks li,
 .factsAndRisks p {
   margin: 0;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .factsAndRisks li small {
   display: block;
   margin-top: density(1);
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .factsAndRisks li span {
@@ -1976,9 +1976,9 @@
   margin-right: density(3);
   padding: density(1) density(2);
   border-radius: radius(1);
-  background: palette(surface-light);
-  color: palette(primary-dark);
-  @ds-typo (fine-strong);
+  background: palette(surface.light);
+  color: palette(primary.dark);
+  @ds-typo(fine-strong);
 }
 
 .editor {
@@ -2000,16 +2000,16 @@
 
 .unitsHeading p {
   margin: 0;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .unitsHeading button,
 .unitActions button {
-  @ds-button (secondary);
+  @ds-button(secondary);
   border: border(subtle);
   border-radius: radius(2);
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
 }
 
 .unitsHeading button {
@@ -2023,15 +2023,15 @@
 }
 
 .narrativeReview {
-  @ds-surface (card);
+  @ds-surface(card);
   padding: density(4);
   border: border(1);
   border-radius: radius(2);
-  color: palette(warning-dark);
+  color: palette(warning.dark);
 }
 
 .narrativeReview strong {
-  @ds-typo (label);
+  @ds-typo(label);
 }
 
 .narrativeReview ul {
@@ -2042,11 +2042,11 @@
 }
 
 .narrativeReview li {
-  @ds-typo (fine);
+  @ds-typo(fine);
 }
 
 .unit {
-  @ds-surface (card);
+  @ds-surface(card);
   display: grid;
   gap: density(4);
   padding: density(5);
@@ -2069,14 +2069,14 @@
 .unit > header span {
   padding: density(2) density(3);
   border-radius: radius(2);
-  background: palette(surface-light);
-  color: palette(primary-dark);
-  @ds-typo (badge);
+  background: palette(surface.light);
+  color: palette(primary.dark);
+  @ds-typo(badge);
 }
 
 .unit > header strong {
-  color: palette(primary-dark);
-  @ds-typo (meta);
+  color: palette(primary.dark);
+  @ds-typo(meta);
 }
 
 .unitActions {
@@ -2104,17 +2104,17 @@
 }
 
 .factPicker label {
-  @ds-button (secondary);
+  @ds-button(secondary);
   display: flex;
   align-items: center;
   gap: density(2);
   padding: density(2) density(3);
   border-radius: radius(2);
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
 }
 
 .factPicker input {
-  accent-color: palette(primary-dark);
+  accent-color: palette(primary.dark);
 }
 
 .approvalBar {
@@ -2135,13 +2135,13 @@
 }
 
 .approvalBar strong {
-  color: palette(primary-dark);
-  @ds-typo (meta);
+  color: palette(primary.dark);
+  @ds-typo(meta);
 }
 
 .approvalBar small {
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .approvalBar > div:last-child {
@@ -2163,13 +2163,13 @@
   justify-content: space-between;
   gap: density(5);
   padding: density(5) density(1) 0;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .footer a {
-  color: palette(primary-dark);
-  @ds-typo (fine-strong);
+  color: palette(primary.dark);
+  @ds-typo(fine-strong);
   text-decoration: none;
 }
 
@@ -2177,14 +2177,14 @@
   padding: density(6);
   border: border(dashed-subtle);
   border-radius: radius(3);
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
   text-align: center;
 }
 
 .generateDraftCard .assetVariantHint {
-  color: palette(primary-main);
-  @ds-typo (fine);
+  color: palette(primary.main);
+  @ds-typo(fine);
 }
 
 .assetWorkspace {
@@ -2200,24 +2200,24 @@
   gap: density(5);
   padding: density(4) density(5);
   border-radius: radius(3);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .assetBatchSummary strong {
-  color: palette(primary-dark);
-  @ds-typo (caption);
+  color: palette(primary.dark);
+  @ds-typo(caption);
 }
 
 .assetBatchSummary p {
   margin: density(1) 0 0;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .assetBatchSummary small {
   flex: 0 0 auto;
-  color: palette(tertiary-main);
-  @ds-typo (fine-strong);
+  color: palette(tertiary.main);
+  @ds-typo(fine-strong);
 }
 
 .assetGrid {
@@ -2228,28 +2228,28 @@
 .assetGrid > div { min-width: 0; max-width: 780px; }
 .assetSelection { display: flex; gap: density(3); overflow-x: auto; padding: density(2); }
 .assetSelectionItem { position: relative; flex: 0 0 112px; }
-.assetSelectionThumb { @ds-button (secondary); display: grid; width: 100%; gap: density(2); padding: density(2); border: border(subtle); border-radius: radius(2); color: palette(dark-main); text-align: left; }
+.assetSelectionThumb { @ds-button(secondary); display: grid; width: 100%; gap: density(2); padding: density(2); border: border(subtle); border-radius: radius(2); color: palette(dark.main); text-align: left; }
 .assetSelectionThumb[aria-pressed="true"] { border: border(focus); box-shadow: shadow(1); }
-.assetSelectionThumb > span:not(.assetSelectionImage):not(.assetSelectionPlaceholder) { @ds-typo (meta-strong); }
-.assetSelectionThumb small { color: palette(tertiary-main); @ds-typo (fine); }
-.assetSelectionApprove { @ds-button (check); position: absolute; top: density(3); right: density(3); display: grid; width: 28px; height: 28px; place-items: center; @ds-typo (small-strong); box-shadow: shadow(1); }
+.assetSelectionThumb > span:not(.assetSelectionImage):not(.assetSelectionPlaceholder) { @ds-typo(meta-strong); }
+.assetSelectionThumb small { color: palette(tertiary.main); @ds-typo(fine); }
+.assetSelectionApprove { @ds-button(check); position: absolute; top: density(3); right: density(3); display: grid; width: 28px; height: 28px; place-items: center; @ds-typo(small-strong); box-shadow: shadow(1); }
 @media (pointer: coarse) { .assetSelectionApprove { width: 36px; height: 36px; } }
-.assetSelectionImage, .assetSelectionPlaceholder { position: relative; display: grid; width: 100%; aspect-ratio: 4 / 5; place-items: center; overflow: hidden; border-radius: radius(1); background: palette(surface-light); }
+.assetSelectionImage, .assetSelectionPlaceholder { position: relative; display: grid; width: 100%; aspect-ratio: 4 / 5; place-items: center; overflow: hidden; border-radius: radius(1); background: palette(surface.light); }
 .assetSelectionImage img { object-fit: cover; }
 
-.assetActionFeedback { @ds-surface (notice-success); margin: 0; padding: density(2) density(3); border-radius: radius(2); color: palette(dark-main); @ds-typo(small); }
-.assetActionFeedbackError { @ds-typo (emphasis); border-color: palette(error-main); background: color-mix(in srgb, palette(error-main) 10%, palette(light-light)); }
+.assetActionFeedback { @ds-surface(notice-success); margin: 0; padding: density(2) density(3); border-radius: radius(2); color: palette(dark.main); @ds-typo(small); }
+.assetActionFeedbackError { @ds-typo(emphasis); border-color: palette(error.main); background: color-mix(in srgb, palette(error.main) 10%, palette(light.light)); }
 
 .editorFacts { display: grid; gap: density(3); margin-top: density(4); }
 .editorFactList { display: grid; gap: density(2); margin: 0; padding: 0; list-style: none; }
-.editorFactList li { @ds-surface (boxed); display: flex; align-items: flex-start; justify-content: space-between; gap: density(3); padding: density(3); border-radius: radius(2); }
+.editorFactList li { @ds-surface(boxed); display: flex; align-items: flex-start; justify-content: space-between; gap: density(3); padding: density(3); border-radius: radius(2); }
 .editorFactList li > div { display: grid; gap: density(1); min-width: 0; }
-.editorFactList strong { color: palette(primary-dark); @ds-typo (label); }
-.editorFactList p { margin: 0; color: palette(dark-main); @ds-typo(small); overflow-wrap: anywhere; }
-.editorFactList a { color: palette(primary-dark); @ds-typo (label); }
+.editorFactList strong { color: palette(primary.dark); @ds-typo(label); }
+.editorFactList p { margin: 0; color: palette(dark.main); @ds-typo(small); overflow-wrap: anywhere; }
+.editorFactList a { color: palette(primary.dark); @ds-typo(label); }
 
 .assetCard {
-  @ds-surface (card);
+  @ds-surface(card);
   display: grid;
   align-content: start;
   gap: density(4);
@@ -2272,35 +2272,35 @@
 }
 
 .assetCard > header strong {
-  color: palette(dark-main);
-  @ds-typo (caption);
+  color: palette(dark.main);
+  @ds-typo(caption);
 }
 
 .assetCard > header small {
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .assetStatus {
   padding: density(2) density(3);
   border-radius: radius(pill);
-  background: palette(light-light);
-  color: palette(tertiary-main);
-  @ds-typo (badge);
+  background: palette(light.light);
+  color: palette(tertiary.main);
+  @ds-typo(badge);
 }
 
 .assetApproved {
-  background: palette(surface-light);
-  color: palette(primary-dark);
+  background: palette(surface.light);
+  color: palette(primary.dark);
 }
 
 .assetFailed {
-  background: palette(error-light);
-  color: palette(error-dark);
+  background: palette(error.light);
+  color: palette(error.dark);
 }
 
 .assetPreview {
-  @ds-surface (card);
+  @ds-surface(card);
   position: relative;
   overflow: hidden;
   width: 100%;
@@ -2320,24 +2320,24 @@
   justify-items: center;
   gap: density(3);
   padding: density(6);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
   text-align: center;
 }
 
 .assetPlaceholder strong {
-  @ds-typo (meta);
+  @ds-typo(meta);
 }
 
 .assetPlaceholder small {
   max-width: 300px;
-  @ds-typo (fine);
+  @ds-typo(fine);
 }
 
 .assetSpinner {
   width: 24px;
   height: 24px;
   border: border(subtle);
-  border-top-color: palette(primary-dark);
+  border-top-color: palette(primary.dark);
   border-radius: radius(circle);
   animation: asset-spin 0.8s linear infinite;
 }
@@ -2349,62 +2349,62 @@
 }
 
 .expectedText {
-  @ds-surface (card);
+  @ds-surface(card);
   padding: density(3) density(4);
   border-radius: radius(2);
 }
 
 .expectedText span {
-  color: palette(tertiary-main);
-  @ds-typo (badge);
+  color: palette(tertiary.main);
+  @ds-typo(badge);
 }
 
 .expectedText p {
   margin: density(2) 0 0;
-  color: palette(dark-main);
-  @ds-typo (meta-strong);
+  color: palette(dark.main);
+  @ds-typo(meta-strong);
   white-space: pre-wrap;
 }
 
 .assetSafety {
-  @ds-surface (notice-error);
+  @ds-surface(notice-error);
   padding: density(3) density(3);
   border-radius: radius(2);
-  color: palette(error-dark);
-  @ds-typo (fine);
+  color: palette(error.dark);
+  @ds-typo(fine);
 }
 
 .assetTextWarning {
-  @ds-surface (notice-warning);
+  @ds-surface(notice-warning);
   padding: density(3) density(3);
   border-radius: radius(2);
-  color: palette(warning-dark);
-  @ds-typo (fine);
+  color: palette(warning.dark);
+  @ds-typo(fine);
 }
-.inlineLink { @ds-button (link); @ds-typo (emphasis); padding: 0; font: inherit; text-decoration: underline; }
+.inlineLink { @ds-button(link); @ds-typo(emphasis); padding: 0; font: inherit; text-decoration: underline; }
 
 .assetPrompt {
-  @ds-surface (card);
+  @ds-surface(card);
   border-radius: radius(2);
 }
 
 .assetPrompt summary {
-  @ds-button (link);
+  @ds-button(link);
   padding: density(3) density(4);
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
 }
 
 .assetPrompt textarea {
-  @ds-input (field);
+  @ds-input(field);
   width: calc(100% - 20px);
   margin: 0 space(4) space(4);
   padding: density(3);
   border: border(subtle);
   border-radius: radius(2);
   outline: none;
-  color: palette(dark-main);
+  color: palette(dark.main);
   font: inherit;
-  @ds-typo (fine);
+  @ds-typo(fine);
   resize: vertical;
 }
 
@@ -2427,14 +2427,14 @@
 }
 
 .assetActions a {
-  color: palette(primary-dark);
-  @ds-typo (fine-strong);
+  color: palette(primary.dark);
+  @ds-typo(fine-strong);
   text-decoration: none;
 }
 
 .assetActions small {
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .assetActions button {
@@ -2451,8 +2451,8 @@
   flex-direction: column;
   gap: density(3);
   padding: density(5);
-  color: palette(surface-contrast);
-  background: palette(surface-main);
+  color: palette(surface.contrast);
+  background: palette(surface.main);
   border: border(1);
 }
 
@@ -2481,7 +2481,7 @@
 }
 
 .documentaryPanel a {
-  color: palette(primary-main);
+  color: palette(primary.main);
   overflow-wrap: anywhere;
 }
 
@@ -2494,8 +2494,8 @@
   flex-direction: column;
   gap: density(3);
   padding: density(5);
-  color: palette(surface-contrast);
-  background: palette(surface-main);
+  color: palette(surface.contrast);
+  background: palette(surface.main);
   border: border(1);
 }
 
@@ -2516,7 +2516,7 @@
 
 .instagramFilters .field select,
 .instagramFilters .field input {
-  border-color: palette(dark-main, 0.16);
+  border-color: palette(dark.main, 0.16);
 }
 
 .instagramFilters > button {
@@ -2549,7 +2549,7 @@
   width: 100%;
   aspect-ratio: 4 / 5;
   object-fit: cover;
-  background: palette(surface-light);
+  background: palette(surface.light);
 }
 
 .instagramThumbFallback {
@@ -2559,8 +2559,8 @@
   aspect-ratio: 4 / 5;
   padding: density(3);
   text-align: center;
-  color: palette(tertiary-main);
-  background: palette(surface-light);
+  color: palette(tertiary.main);
+  background: palette(surface.light);
   @ds-typo(caption);
 }
 
@@ -2579,8 +2579,8 @@
 }
 
 .instagramBadge {
-  @ds-typo (label);
-  color: palette(primary-main);
+  @ds-typo(label);
+  color: palette(primary.main);
 }
 
 .instagramCaption {
@@ -2590,24 +2590,24 @@
   -webkit-box-orient: vertical;
   overflow: hidden;
   @ds-typo(caption);
-  color: palette(surface-contrast);
+  color: palette(surface.contrast);
 }
 
 .instagramLinkPill {
   @ds-typo(caption);
   padding: density(1) density(2);
-  border-radius: radius(full);
-  color: palette(tertiary-contrast);
-  background: palette(tertiary-main);
+  border-radius: radius(pill);
+  color: palette(tertiary.contrast);
+  background: palette(tertiary.main);
 }
 
 .instagramLinkPillOn {
-  color: palette(primary-contrast);
-  background: palette(primary-main);
+  color: palette(primary.contrast);
+  background: palette(primary.main);
 }
 
 .instagramLink {
-  @ds-button (link-accent);
+  @ds-button(link-accent);
   @ds-typo(caption);
   padding: 0;
   text-decoration: underline;
@@ -2615,8 +2615,8 @@
 
 /* IG-04 — link a publication to its editorial story */
 .instagramLinkChip {
-  @ds-typo (label);
-  color: palette(primary-main);
+  @ds-typo(label);
+  color: palette(primary.main);
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
@@ -2634,7 +2634,7 @@
 
 .instagramLinkSuggested {
   @ds-typo(caption);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 
 .instagramLinkActions {
@@ -2663,35 +2663,35 @@
 }
 
 .instagramMetricLabel {
-  @ds-typo (fine);
-  color: palette(tertiary-dark);
+  @ds-typo(fine);
+  color: palette(tertiary.dark);
 }
 
 .instagramMetricValue {
-  @ds-typo (label);
-  color: palette(primary-dark);
+  @ds-typo(label);
+  color: palette(primary.dark);
 }
 
 .instagramMetricUnavailable {
-  @ds-typo (label);
-  color: palette(tertiary-main);
+  @ds-typo(label);
+  color: palette(tertiary.main);
 }
 
 .instagramMetricError {
-  @ds-typo (label);
-  color: palette(warning-dark);
+  @ds-typo(label);
+  color: palette(warning.dark);
 }
 
 .instagramMetricRatios {
   margin: 0;
-  @ds-typo (fine);
-  color: palette(tertiary-dark);
+  @ds-typo(fine);
+  color: palette(tertiary.dark);
 }
 
 .instagramMetricsHint {
   margin: 0;
-  @ds-typo (fine);
-  color: palette(tertiary-dark);
+  @ds-typo(fine);
+  color: palette(tertiary.dark);
 }
 
 /* IG-06 — story Instagram results */
@@ -2735,8 +2735,8 @@
 }
 
 .storyInstagramVersionChip {
-  @ds-typo (label);
-  color: palette(primary-main);
+  @ds-typo(label);
+  color: palette(primary.main);
   display: flex;
   align-items: center;
   gap: density(2);
@@ -2744,7 +2744,7 @@
 
 .storyInstagramVersionMissing {
   @ds-typo(caption);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 
 .storyInstagramPicker {
@@ -2793,7 +2793,7 @@
 }
 
 .brandReferenceItem {
-  @ds-surface (card);
+  @ds-surface(card);
   margin: 0;
   border-radius: radius(2);
   overflow: hidden;
@@ -2804,7 +2804,7 @@
   width: 100%;
   aspect-ratio: 4 / 5;
   object-fit: cover;
-  background: palette(surface-light);
+  background: palette(surface.light);
 }
 
 .brandReferenceInactive {
@@ -2818,21 +2818,21 @@
 }
 
 .brandReferenceBadge {
-  @ds-typo (fine);
-  color: palette(primary-main);
+  @ds-typo(fine);
+  color: palette(primary.main);
 }
 
 .brandReferencePill {
   display: flex;
   align-items: center;
   gap: density(1);
-  @ds-typo (fine);
-  color: palette(tertiary-dark);
+  @ds-typo(fine);
+  color: palette(tertiary.dark);
 }
 
 .brandReferencePillOn {
-  @ds-typo (emphasis);
-  color: palette(primary-dark);
+  @ds-typo(emphasis);
+  color: palette(primary.dark);
 }
 
 /* BRAND-02 — contribution + analysis */
@@ -2843,11 +2843,11 @@
 }
 
 .brandContributionChip {
-  @ds-button (chip);
-  @ds-typo (fine-strong);
+  @ds-button(chip);
+  @ds-typo(fine-strong);
   padding: density(1) density(3);
   border: border(control);
-  border-radius: radius(full);
+  border-radius: radius(pill);
   text-transform: capitalize;
 }
 
@@ -2857,13 +2857,13 @@
 }
 
 .brandContributionChipOn {
-  border-color: palette(primary-main);
-  background: palette(primary-main);
-  color: palette(primary-contrast);
+  border-color: palette(primary.main);
+  background: palette(primary.main);
+  color: palette(primary.contrast);
 }
 
 .brandAnalysis {
-  @ds-surface (card);
+  @ds-surface(card);
   display: grid;
   gap: density(2);
   padding: density(3);
@@ -2875,15 +2875,15 @@
   grid-template-columns: 84px 1fr auto;
   gap: density(2);
   align-items: start;
-  @ds-typo (fine);
+  @ds-typo(fine);
 }
 
 .brandAnalysisBadge {
-  @ds-button (chip);
-  @ds-typo (fine-strong);
+  @ds-button(chip);
+  @ds-typo(fine-strong);
   padding: density(1) density(2);
   border: border(control);
-  border-radius: radius(full);
+  border-radius: radius(pill);
   white-space: nowrap;
 }
 
@@ -2893,30 +2893,30 @@
 }
 
 .brandAnalysisBadgeLow {
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
 }
 
 .brandAnalysisBadgeMedium {
-  color: palette(warning-dark);
-  border-color: palette(warning-main);
+  color: palette(warning.dark);
+  border-color: palette(warning.main);
 }
 
 .brandAnalysisBadgeHigh {
-  color: palette(success-dark);
-  border-color: palette(success-main);
+  color: palette(success.dark);
+  border-color: palette(success.main);
 }
 
 /* BRAND-03 — auto-selected brand references per unit (read-only) */
 .brandUnitSelection {
   display: grid;
   gap: density(1);
-  @ds-typo (fine);
-  color: palette(tertiary-dark);
+  @ds-typo(fine);
+  color: palette(tertiary.dark);
 }
 
 .brandUnitSelection > span {
-  @ds-typo (emphasis);
-  color: palette(primary-dark);
+  @ds-typo(emphasis);
+  color: palette(primary.dark);
 }
 
 .brandUnitSelection ul {
@@ -2925,8 +2925,8 @@
 }
 
 .brandUnitSelection code {
-  @ds-typo (fine);
-  color: palette(tertiary-main);
+  @ds-typo(fine);
+  color: palette(tertiary.main);
 }
 
 
@@ -2937,7 +2937,7 @@
   display: flex;
   flex-direction: column;
   gap: density(2);
-  color: palette(primary-main);
+  color: palette(primary.main);
 }
 
 .brandImageEditor details[open] {
@@ -2970,8 +2970,8 @@
   align-self: flex-start;
   padding: density(1) density(2);
   border: border(1);
-  border-radius: radius(full);
-  color: palette(primary-main);
+  border-radius: radius(pill);
+  color: palette(primary.main);
 }
 
 .editRequestActions {
@@ -2987,7 +2987,7 @@
   border: border(1);
 }
 
-.mapsPreviewPanel summary { @ds-typo (emphasis); cursor: pointer; }
+.mapsPreviewPanel summary { @ds-typo(emphasis); cursor: pointer; }
 .mapsPreviewActions { display: flex; flex-wrap: wrap; gap: density(2); }
 .mapsPreviewActions button { @ds-button(outlined primary 2); }
 .mapsPreviewActions button:disabled { opacity: 0.5; cursor: not-allowed; }
@@ -3001,7 +3001,7 @@
   min-width: 0;
   padding: density(3);
   gap: density(2);
-  color: palette(primary-dark);
+  color: palette(primary.dark);
   border: border(1);
 }
 .mapsPreviewComposition h3 { @ds-typo(h6); margin: density(1) 0; }
@@ -3021,19 +3021,19 @@
   gap: density(2);
   padding: xs(density(3)) md(density(4));
   box-shadow: shadow(1);
-  color: palette(primary-main);
+  color: palette(primary.main);
   @ds-typo(body);
 }
 
 .publicationCandidate h4 {
   @ds-typo(h5);
-  color: palette(primary-main);
+  color: palette(primary.main);
 }
 
 /* Inline "go to where this is fixed" action beside a publication blocker. */
 .blockerAction {
   @ds-button(flat primary 1);
-  @ds-typo (label);
+  @ds-typo(label);
   text-decoration: underline;
   text-underline-offset: 2px;
   cursor: pointer;
@@ -3067,9 +3067,9 @@
 }
 
 .publicationPreviewList { display: flex; flex-wrap: wrap; gap: density(3); margin: 0; padding: 0; list-style: none; }
-.publicationPreviewList img { display: block; width: 108px; height: 135px; border-radius: radius(2); object-fit: contain; background: palette(surface-light); }
-.publicationPreviewList span { color: palette(tertiary-dark); @ds-typo(caption); }
-.publicationConfirm { @ds-surface (notice-warning); display: grid; gap: density(2); padding: density(3); border: border(warning-strong); border-radius: radius(2); color: palette(dark-main); }
+.publicationPreviewList img { display: block; width: 108px; height: 135px; border-radius: radius(2); object-fit: contain; background: palette(surface.light); }
+.publicationPreviewList span { color: palette(tertiary.dark); @ds-typo(caption); }
+.publicationConfirm { @ds-surface(notice-warning); display: grid; gap: density(2); padding: density(3); border: border(warning-strong); border-radius: radius(2); color: palette(dark.main); }
 .publicationConfirm p { margin: 0; @ds-typo(small); }
 
 .publicationPackageActions {
@@ -3080,13 +3080,13 @@
 }
 
 .publicationJob {
-  @ds-surface (boxed);
+  @ds-surface(boxed);
   display: grid;
   gap: density(1);
   padding: density(2);
   border-radius: radius(2);
-  background: palette(primary-contrast);
-  color: palette(primary-main);
+  background: palette(primary.contrast);
+  color: palette(primary.main);
 }
 
 /* ---------------------------------------------------------------------------
@@ -3102,7 +3102,7 @@
   padding: density(4);
   border: border(control);
   border-radius: radius(3);
-  background: palette(surface-light);
+  background: palette(surface.light);
   box-shadow: shadow(1);
 }
 
@@ -3114,13 +3114,13 @@
 /* Creative identity: one fieldset per branch, each with its own AI rewrite row. */
 /* Content sits at the top: a shorter field must not stretch its rows to match its neighbour. */
 .identityFields { display: grid; grid-template-columns: xs(1fr) lg(repeat(2, minmax(0, 1fr))); gap: density(4); align-items: start; }
-.identityField { @ds-surface (boxed); display: grid; align-content: start; gap: density(2); min-width: 0; margin: 0; padding: density(3); border-radius: radius(2); }
-.identityField legend { padding: 0 density(1); @ds-typo (label); color: palette(primary-dark); }
+.identityField { @ds-surface(boxed); display: grid; align-content: start; gap: density(2); min-width: 0; margin: 0; padding: density(3); border-radius: radius(2); }
+.identityField legend { padding: 0 density(1); @ds-typo(label); color: palette(primary.dark); }
 .identityField textarea, .identityField select, .paletteAssistantForm input, .identityFieldAssistant input { @ds-input(outlined neutral 2); width: 100%; }
-.identityField small { @ds-typo(caption); color: palette(dark-main, 0.6); }
+.identityField small { @ds-typo(caption); color: palette(dark.main, 0.6); }
 /* Folded per-field AI rewrite: a small, clearly attached disclosure under its field. */
-.profilePanel .identityFieldAssistant { display: grid; gap: density(2); padding: density(1) density(2); border: 0; border-radius: radius(2); background: palette(primary-light, 0.12); box-shadow: none; }
-.profilePanel .identityFieldAssistant summary { @ds-button (link); display: block; min-height: 0; padding: density(1) 0; @ds-typo (label); }
+.profilePanel .identityFieldAssistant { display: grid; gap: density(2); padding: density(1) density(2); border: 0; border-radius: radius(2); background: palette(primary.light, 0.12); box-shadow: none; }
+.profilePanel .identityFieldAssistant summary { @ds-button(link); display: block; min-height: 0; padding: density(1) 0; @ds-typo(label); }
 .profilePanel .identityFieldAssistant[open] { padding-bottom: density(2); }
 .identityFieldAssistant button { justify-self: start; }
 .identityAvoidAdd { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: density(2); align-items: center; }
@@ -3132,26 +3132,26 @@
 .identityAvoidGroups > small, .identityAvoidGroups > button { grid-column: 1 / -1; }
 .identityAvoidGroup { display: grid; gap: density(2); padding: density(2); border: border(warning-soft); border-radius: radius(2); }
 .identityAvoidGroupHeader { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: density(2); align-items: center; }
-.identityAvoidGroupHeader input { @ds-typo (emphasis); @ds-input(outlined neutral 2); width: 100%; }
-.identityField select { @ds-typo (inherit); min-height: 42px; padding-block: 0; }
-.identityField textarea::placeholder, .identityField input::placeholder, .paletteAssistantForm input::placeholder { color: palette(dark-main, 0.45); }
+.identityAvoidGroupHeader input { @ds-typo(emphasis); @ds-input(outlined neutral 2); width: 100%; }
+.identityField select { @ds-typo(inherit); min-height: 42px; padding-block: 0; }
+.identityField textarea::placeholder, .identityField input::placeholder, .paletteAssistantForm input::placeholder { color: palette(dark.main, 0.45); }
 .identityAvoidList { display: flex; flex-wrap: wrap; gap: density(1); margin: 0; padding: 0; list-style: none; }
-.identityAvoidList li { @ds-surface (card); display: inline-flex; align-items: center; gap: density(1); padding: density(1) density(2); border: border(warning-soft); border-radius: radius(pill); background: palette(warning-light, 0.4); @ds-typo(caption); color: palette(dark-main); }
-.identityAvoidList button { @ds-button (link-warning); @ds-typo (emphasis); }
+.identityAvoidList li { @ds-surface(card); display: inline-flex; align-items: center; gap: density(1); padding: density(1) density(2); border: border(warning-soft); border-radius: radius(pill); background: palette(warning.light, 0.4); @ds-typo(caption); color: palette(dark.main); }
+.identityAvoidList button { @ds-button(link-warning); @ds-typo(emphasis); }
 
 .paletteAssistantForm textarea {
-  @ds-typo (multiline);
+  @ds-typo(multiline);
   @ds-input(outlined neutral 2);
   width: 100%;
   min-height: density(12);
   padding: density(3);
   resize: vertical;
-  background: palette(light-light);
-  color: palette(dark-main);
+  background: palette(light.light);
+  color: palette(dark.main);
 }
 
 .paletteAssistantForm textarea:focus {
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
   box-shadow: shadow(ring);
   outline: none;
 }
@@ -3186,7 +3186,7 @@
   padding: density(2);
   border: border(control);
   border-radius: radius(2);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .paletteAssistantSwatch i {
@@ -3204,15 +3204,15 @@
 
 .paletteAssistantSwatch strong {
   overflow: hidden;
-  color: palette(dark-main);
-  @ds-typo (label);
+  color: palette(dark.main);
+  @ds-typo(label);
   text-overflow: ellipsis;
   white-space: nowrap;
 }
 
 .paletteAssistantSwatch small {
-  color: palette(tertiary-dark);
-  @ds-typo (fine);
+  color: palette(tertiary.dark);
+  @ds-typo(fine);
 }
 
 /* Brand palette: optional usage intent and share per colour. */
@@ -3238,7 +3238,7 @@
   display: inline-flex;
   align-items: center;
   gap: density(1);
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
   @ds-typo(caption);
 }
 
@@ -3253,16 +3253,16 @@
 }
 
 .paletteShareSummary small {
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
   @ds-typo(caption);
 }
 
 .paletteShareOver {
-  color: palette(error-dark);
+  color: palette(error.dark);
 }
 
 .paletteShareBar {
-  @ds-surface (boxed);
+  @ds-surface(boxed);
   display: flex;
   height: density(4);
   overflow: hidden;
@@ -3279,88 +3279,88 @@
 .paletteShareFree {
   background: repeating-linear-gradient(
     135deg,
-    palette(surface-dark, 0.35) 0 4px,
+    palette(surface.dark, 0.35) 0 4px,
     transparent 4px 8px
   );
 }
 
 .workspace [hidden] { /* uxdsl-exception: the hidden attribute must win over any display a component sets */ display: none !important; }
-.pageRoot { min-height: 100svh; padding: xs(density(3)) md(density(6)); background: palette(light-light); }
+.pageRoot { min-height: 100svh; padding: xs(density(3)) md(density(6)); background: palette(light.light); }
 .pageWorkspace { width: min(1440px, 100%); max-height: none; margin-inline: auto; overflow: visible; border: 0; border-radius: 0; box-shadow: none; }
 .pageWorkspace .body { overflow: visible; padding: xs(density(3)) md(density(6)); }
 .pageWorkspace .header { position: sticky; top: 0; z-index: 5; padding-block: density(4); }
 .workspaceTabs { display: flex; gap: density(2); margin-bottom: density(5); overflow-x: auto; border-bottom: border(subtle); }
-.workspaceTabs button { @ds-button (tab); display: inline-flex; align-items: center; gap: density(2); min-height: 44px; padding: density(2) density(4); border-bottom: border(clear); @ds-typo (compact-strong); white-space: nowrap; }
-.workspaceTabs button:hover, .workspaceTabs button:focus-visible { color: palette(primary-dark); }
-.workspaceTabs button.workspaceTabActive { border-bottom-color: palette(primary-main); color: palette(primary-dark); }
-.workspaceTabs button span { display: inline-grid; width: 16px; height: 16px; place-items: center; border-radius: radius(full); background: palette(success-light); color: palette(success-dark); @ds-typo (fine); }
+.workspaceTabs button { @ds-button(tab); display: inline-flex; align-items: center; gap: density(2); min-height: 44px; padding: density(2) density(4); border-bottom: border(clear); @ds-typo(compact-strong); white-space: nowrap; }
+.workspaceTabs button:hover, .workspaceTabs button:focus-visible { color: palette(primary.dark); }
+.workspaceTabs button.workspaceTabActive { border-bottom-color: palette(primary.main); color: palette(primary.dark); }
+.workspaceTabs button span { display: inline-grid; width: 16px; height: 16px; place-items: center; border-radius: radius(pill); background: palette(success.light); color: palette(success.dark); @ds-typo(fine); }
 .pageWorkspace .progress { display: none; }
-.contentStage { @ds-surface (card); display: grid; gap: density(4); padding: density(7); border-radius: radius(3); }
-.contentStage h3 { margin: 0; color: palette(dark-main); @ds-typo (title-lg); }
-.contentStage p { max-width: 70ch; margin: 0; color: palette(tertiary-main); @ds-typo(body); }
-.contentStage > span, .stageEyebrow { color: palette(primary-dark); @ds-typo (label); }
+.contentStage { @ds-surface(card); display: grid; gap: density(4); padding: density(7); border-radius: radius(3); }
+.contentStage h3 { margin: 0; color: palette(dark.main); @ds-typo(title-lg); }
+.contentStage p { max-width: 70ch; margin: 0; color: palette(tertiary.main); @ds-typo(body); }
+.contentStage > span, .stageEyebrow { color: palette(primary.dark); @ds-typo(label); }
 .contentStage button { justify-self: start; }
-.contentStage a { color: palette(primary-dark); @ds-typo(small); }
-.contentSummary { @ds-surface (card); display: grid; gap: density(3); padding: density(4); border-radius: radius(2); background: palette(surface-light, 0.2); }
-.contentSummary h4 { margin: 0; color: palette(dark-main); @ds-typo (title-sm); }
-.contentSummary > strong { color: palette(primary-dark); @ds-typo (caption); }
+.contentStage a { color: palette(primary.dark); @ds-typo(small); }
+.contentSummary { @ds-surface(card); display: grid; gap: density(3); padding: density(4); border-radius: radius(2); background: palette(surface.light, 0.2); }
+.contentSummary h4 { margin: 0; color: palette(dark.main); @ds-typo(title-sm); }
+.contentSummary > strong { color: palette(primary.dark); @ds-typo(caption); }
 .contentSummary details { min-width: 0; }
-.contentSummary summary { @ds-button (link); @ds-typo (emphasis); }
+.contentSummary summary { @ds-button(link); @ds-typo(emphasis); }
 .contentSummary details p { max-height: 24rem; overflow: auto; margin-block: density(3); white-space: pre-wrap; overflow-wrap: anywhere; }
-.textPreview { @ds-surface (card); margin-bottom: density(5); border-radius: radius(3); }
-.textPreview > summary { @ds-button (link-dark); padding: density(4); @ds-typo (small-strong); }
+.textPreview { @ds-surface(card); margin-bottom: density(5); border-radius: radius(3); }
+.textPreview > summary { @ds-button(link-dark); padding: density(4); @ds-typo(small-strong); }
 .textPreviewGrid { display: flex; gap: density(3); padding: density(4); overflow-x: auto; }
-.textPreviewPiece { @ds-button (tinted); display: flex; flex: 0 0 min(190px, 70vw); min-height: 235px; flex-direction: column; align-items: stretch; gap: density(3); padding: density(5); border: border(subtle); border-radius: radius(3); aspect-ratio: 4 / 5; background: palette(primary-light, 0.18); text-align: left; }
+.textPreviewPiece { @ds-button(tinted); display: flex; flex: 0 0 min(190px, 70vw); min-height: 235px; flex-direction: column; align-items: stretch; gap: density(3); padding: density(5); border: border(subtle); border-radius: radius(3); aspect-ratio: 4 / 5; background: palette(primary.light, 0.18); text-align: left; }
 .textPreviewPieceSelected { border: border(focus); box-shadow: shadow(1); }
-.textPreviewPiece > span, .textPreviewPiece small { color: palette(tertiary-main); @ds-typo (meta); }
-.textPreviewPiece strong { color: palette(dark-main); @ds-typo (title-sm); }
-.textPreviewPiece p { margin: 0; color: palette(primary-dark); @ds-typo (caption); }
+.textPreviewPiece > span, .textPreviewPiece small { color: palette(tertiary.main); @ds-typo(meta); }
+.textPreviewPiece strong { color: palette(dark.main); @ds-typo(title-sm); }
+.textPreviewPiece p { margin: 0; color: palette(primary.dark); @ds-typo(caption); }
 .textPreviewPiece small { margin-top: auto; }
 .textPreviewImage { position: relative; display: block; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; border-radius: radius(1); }
 .textPreviewImage img { object-fit: cover; }
 .pieceSelector { display: flex; gap: density(2); overflow-x: auto; padding: density(2); }
 .pieceSelector button { display: grid; flex: 0 0 min(150px, 60vw); gap: density(1); min-height: 54px; padding: density(3); @ds-button(outlined neutral 2); text-align: left; cursor: pointer; }
-.pieceSelector button[aria-pressed="true"] { border: border(focus); background: palette(primary-light, 0.2); }
-.pieceSelector button span { color: palette(tertiary-main); @ds-typo (meta); }
-.pieceSelector button strong { overflow: hidden; color: palette(dark-main); @ds-typo (caption); text-overflow: ellipsis; white-space: nowrap; }
-.routeShell { min-height: 100svh; background: palette(light-light); color: palette(dark-main); }
-.routeTopbar { display: flex; align-items: center; justify-content: space-between; gap: density(4); min-height: 56px; padding-inline: xs(density(4)) md(density(7)); border-bottom: border(subtle); background: palette(light-light); }
-.routeTopbar a:not([data-ui-button]) { color: palette(primary-dark); @ds-typo (compact-strong); text-decoration: none; white-space: nowrap; }
-.routeBrand { color: palette(dark-main); @ds-typo (compact-strong); white-space: nowrap; }
+.pieceSelector button[aria-pressed="true"] { border: border(focus); background: palette(primary.light, 0.2); }
+.pieceSelector button span { color: palette(tertiary.main); @ds-typo(meta); }
+.pieceSelector button strong { overflow: hidden; color: palette(dark.main); @ds-typo(caption); text-overflow: ellipsis; white-space: nowrap; }
+.routeShell { min-height: 100svh; background: palette(light.light); color: palette(dark.main); }
+.routeTopbar { display: flex; align-items: center; justify-content: space-between; gap: density(4); min-height: 56px; padding-inline: xs(density(4)) md(density(7)); border-bottom: border(subtle); background: palette(light.light); }
+.routeTopbar a:not([data-ui-button]) { color: palette(primary.dark); @ds-typo(compact-strong); text-decoration: none; white-space: nowrap; }
+.routeBrand { color: palette(dark.main); @ds-typo(compact-strong); white-space: nowrap; }
 .routeTopbar a:not([data-ui-button]):hover, .routeTopbar a:not([data-ui-button]):focus-visible { text-decoration: underline; }
-.routeBreadcrumb { overflow: hidden; color: palette(tertiary-main); @ds-typo (caption); text-overflow: ellipsis; white-space: nowrap; }
+.routeBreadcrumb { overflow: hidden; color: palette(tertiary.main); @ds-typo(caption); text-overflow: ellipsis; white-space: nowrap; }
 .routeBreadcrumb span { padding-inline: density(2); }
-.routeError, .routeLoading { @ds-surface (card); width: min(700px, calc(100% - 2rem)); margin: density(9) auto; padding: density(7); border-radius: radius(3); @ds-typo(body); }
+.routeError, .routeLoading { @ds-surface(card); width: min(700px, calc(100% - 2rem)); margin: density(9) auto; padding: density(7); border-radius: radius(3); @ds-typo(body); }
 .routeError strong { @ds-typo(h3); }
-.routeError a { color: palette(primary-dark); @ds-typo (small-strong); }
-.routeRefresh { @ds-surface (card); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(3); width: min(1320px, calc(100% - 2rem)); margin: density(4) auto 0; padding: density(4); border: border(warning); border-radius: radius(2); background: palette(warning-light, 0.25); color: palette(warning-dark); @ds-typo (compact); }
-.routeRefresh button { @ds-button(outlined warning 2); min-height: 34px; @ds-typo (label); cursor: pointer; }
+.routeError a { color: palette(primary.dark); @ds-typo(small-strong); }
+.routeRefresh { @ds-surface(card); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(3); width: min(1320px, calc(100% - 2rem)); margin: density(4) auto 0; padding: density(4); border: border(warning); border-radius: radius(2); background: palette(warning.light, 0.25); color: palette(warning.dark); @ds-typo(compact); }
+.routeRefresh button { @ds-button(outlined warning 2); min-height: 34px; @ds-typo(label); cursor: pointer; }
 @media (max-width: 639px) { .routeTopbar a span { display: none; } .routeBreadcrumb { flex: 1; } }
 .helpContent { width: min(760px, calc(100% - 2rem)); margin: density(9) auto; }
-.helpContent > p:first-child { margin: 0; color: palette(primary-dark); @ds-typo (eyebrow); }
-.helpContent h1 { margin: density(2) 0 density(8); color: palette(dark-main); @ds-typo (display-lg); }
+.helpContent > p:first-child { margin: 0; color: palette(primary.dark); @ds-typo(eyebrow); }
+.helpContent h1 { margin: density(2) 0 density(8); color: palette(dark.main); @ds-typo(display-lg); }
 .helpContent ol { display: grid; gap: density(3); padding-left: density(7); }
-.helpContent li, .helpContent p { color: palette(tertiary-main); @ds-typo(body); }
-.helpContent li strong { color: palette(dark-main); }
-.helpContent a { @ds-typo (emphasis); color: palette(primary-dark); }
+.helpContent li, .helpContent p { color: palette(tertiary.main); @ds-typo(body); }
+.helpContent li strong { color: palette(dark.main); }
+.helpContent a { @ds-typo(emphasis); color: palette(primary.dark); }
 
-.hookPanel { @ds-surface (callout); display: grid; gap: density(3); margin-bottom: density(5); padding: density(4) density(5); border-radius: radius(3); }
+.hookPanel { @ds-surface(callout); display: grid; gap: density(3); margin-bottom: density(5); padding: density(4) density(5); border-radius: radius(3); }
 .hookPanelHeader { display: flex; flex-direction: xs(column) md(row); align-items: xs(stretch) md(center); justify-content: space-between; gap: density(3); }
-.hookPanelHeader strong { color: palette(primary-dark); @ds-typo (caption); }
-.hookPanelHeader p, .hookPanelNote { margin: density(1) 0 0; color: palette(primary-main); @ds-typo (meta); }
+.hookPanelHeader strong { color: palette(primary.dark); @ds-typo(caption); }
+.hookPanelHeader p, .hookPanelNote { margin: density(1) 0 0; color: palette(primary.main); @ds-typo(meta); }
 .hookOptions { display: grid; gap: density(2); margin: 0; padding: 0; list-style: none; }
-.hookOption { @ds-surface (callout); display: grid; grid-template-columns: xs(1fr) md(minmax(0, 1fr) auto); gap: density(2) density(3); align-items: center; padding: density(3); border-radius: radius(2); }
-.hookOptionChosen { border-color: palette(primary-main); box-shadow: shadow(inset-primary); }
+.hookOption { @ds-surface(callout); display: grid; grid-template-columns: xs(1fr) md(minmax(0, 1fr) auto); gap: density(2) density(3); align-items: center; padding: density(3); border-radius: radius(2); }
+.hookOptionChosen { border-color: palette(primary.main); box-shadow: shadow(inset-primary); }
 .hookOptionText { display: grid; gap: density(1); min-width: 0; }
-.hookOptionText strong { @ds-typo (body-strong); color: palette(dark-main); }
-.hookOptionText span { @ds-typo(caption); color: palette(dark-main, 0.72); }
+.hookOptionText strong { @ds-typo(body-strong); color: palette(dark.main); }
+.hookOptionText span { @ds-typo(caption); color: palette(dark.main, 0.72); }
 .hookSecond { padding-left: density(2); border-left: border(focus-soft); }
 .hookOptionAction { display: flex; justify-content: xs(flex-start) md(flex-end); }
 .hookOptionMeta { display: flex; flex-wrap: wrap; gap: density(1); grid-column: 1 / -1; }
-.hookOptionMeta span { padding: space(1) density(2); border-radius: radius(pill); background: palette(primary-light, 0.45); @ds-typo (fine); color: palette(primary-dark); }
-.hookScores { grid-column: 1 / -1; margin: 0; @ds-typo (meta); color: palette(dark-main, 0.72); }
-.hookScores b { @ds-typo (compact); margin-right: density(1); color: palette(primary-dark); }
-.hookScores em { font-style: normal; color: palette(dark-main, 0.6); }
-.hookCurrent { @ds-typo (label); color: palette(success-dark); }
-.hookAll summary { @ds-button (link-accent); @ds-typo(caption); }
+.hookOptionMeta span { padding: space(1) density(2); border-radius: radius(pill); background: palette(primary.light, 0.45); @ds-typo(fine); color: palette(primary.dark); }
+.hookScores { grid-column: 1 / -1; margin: 0; @ds-typo(meta); color: palette(dark.main, 0.72); }
+.hookScores b { @ds-typo(compact); margin-right: density(1); color: palette(primary.dark); }
+.hookScores em { font-style: normal; color: palette(dark.main, 0.6); }
+.hookCurrent { @ds-typo(label); color: palette(success.dark); }
+.hookAll summary { @ds-button(link-accent); @ds-typo(caption); }
 .hookAll[open] summary { margin-bottom: density(2); }
diff --git a/src/app/draft-2-canvas.module.uxdsl b/src/app/draft-2-canvas.module.uxdsl
index e1449c6..cb8919c 100644
--- a/src/app/draft-2-canvas.module.uxdsl
+++ b/src/app/draft-2-canvas.module.uxdsl
@@ -2,23 +2,23 @@
 /* Every value comes from the theme: Typography roles first in each rule, Palette colors, Density spacing, Border and Shadow presets, Surface roles for cards. */
 
 /* ---------- Shell ---------- */
-.shell { min-height: 100svh; background: palette(light-light); color: palette(dark-main); }
+.shell { min-height: 100svh; background: palette(light.light); color: palette(dark.main); }
 .notice { width: min(68rem, calc(100% - 2rem)); margin: density(6) auto 0; }
 
 /* The top bar: the way back, the story it works on, the session's time and cost, the article and the autopilot. Translucent over the screen it scrolls above. */
-.topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: xs(density(3)) md(density(4)); min-height: 3.5rem; padding-inline: xs(density(4)) md(density(6)); border-bottom: border(hairline); background: palette(light-light, 0.86); backdrop-filter: saturate(1.4) blur(14px); }
-.topbarBack { @ds-typo (compact-strong); flex: none; color: palette(primary-dark); text-decoration: none; white-space: nowrap; }
+.topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: xs(density(3)) md(density(4)); min-height: 3.5rem; padding-inline: xs(density(4)) md(density(6)); border-bottom: border(hairline); background: palette(light.light, 0.86); backdrop-filter: saturate(1.4) blur(14px); }
+.topbarBack { @ds-typo(compact-strong); flex: none; color: palette(primary.dark); text-decoration: none; white-space: nowrap; }
 .topbarBack:hover { text-decoration: underline; }
 .topbarTitle { display: grid; flex: 1; min-width: 0; }
-.topbarTopic { @ds-typo (meta); overflow: hidden; color: palette(tertiary-main); text-overflow: ellipsis; white-space: nowrap; }
-.topbarStory { @ds-typo (compact-strong); overflow: hidden; color: palette(dark-main); text-overflow: ellipsis; white-space: nowrap; }
+.topbarTopic { @ds-typo(meta); overflow: hidden; color: palette(tertiary.main); text-overflow: ellipsis; white-space: nowrap; }
+.topbarStory { @ds-typo(compact-strong); overflow: hidden; color: palette(dark.main); text-overflow: ellipsis; white-space: nowrap; }
 .topbarActions { display: flex; flex: none; align-items: center; gap: density(2); }
-.topbarVitals { @ds-typo (meta); color: palette(tertiary-dark); white-space: nowrap; }
+.topbarVitals { @ds-typo(meta); color: palette(tertiary.dark); white-space: nowrap; }
 .topbarAutopilot { display: flex; align-items: center; gap: density(2); white-space: nowrap; }
 @media (max-width: 639px) { .topbarAutopilot { display: none; } }
 /* A step running on another screen: a pill that takes the editor to it. */
-.livePill { @ds-typo (label); display: inline-flex; align-items: center; gap: density(2); padding: density(1) density(3); border-radius: radius(pill); background: palette(info-main, 0.12); color: palette(info-dark); text-decoration: none; white-space: nowrap; }
-.livePill::before { width: 0.5rem; height: 0.5rem; flex: none; border-radius: radius(circle); background: palette(info-main); animation: liveBlink 1.4s ease-in-out infinite; content: ""; }
+.livePill { @ds-typo(label); display: inline-flex; align-items: center; gap: density(2); padding: density(1) density(3); border-radius: radius(pill); background: palette(info.main, 0.12); color: palette(info.dark); text-decoration: none; white-space: nowrap; }
+.livePill::before { width: 0.5rem; height: 0.5rem; flex: none; border-radius: radius(circle); background: palette(info.main); animation: liveBlink 1.4s ease-in-out infinite; content: ""; }
 @keyframes liveBlink { 50% { opacity: 0.25; } }
 @media (max-width: 1023px) { .topbarVitals { display: none; } }
 @media (max-width: 639px) { .topbarBack span, .topbarTopic, .livePill { display: none; } }
@@ -30,27 +30,27 @@
 
 /* ---------- The pipeline rail ---------- */
 /* A strip of steps under the top bar on a narrow window; a vertical rail beside the screen on a wide one. */
-.rail { position: sticky; top: 3.5rem; z-index: 20; display: flex; align-items: center; gap: density(3); overflow-x: auto; padding-block: density(2); padding-inline: density(4); border-bottom: border(hairline); background: palette(light-light, 0.94); backdrop-filter: blur(14px); scrollbar-width: none; }
-.railOverview { display: grid; flex: none; gap: density(1); padding: density(1) density(3); border-radius: radius(pill); color: palette(dark-main); text-decoration: none; transition: background 150ms ease; }
-.railOverview:hover { background: palette(primary-light, 0.12); }
-.railOverview[aria-current="page"] { background: palette(primary-light, 0.22); }
-.railOverviewTitle { @ds-typo (compact-strong); }
-.railOverviewMeta { @ds-typo (meta); display: none; color: palette(tertiary-dark); }
-.railProgress { display: none; overflow: hidden; height: 0.25rem; border-radius: radius(pill); background: palette(neutral-light, 0.7); }
-.railProgress span { display: block; height: 100%; border-radius: radius(pill); background: palette(success-main); transition: width 400ms ease; }
+.rail { position: sticky; top: 3.5rem; z-index: 20; display: flex; align-items: center; gap: density(3); overflow-x: auto; padding-block: density(2); padding-inline: density(4); border-bottom: border(hairline); background: palette(light.light, 0.94); backdrop-filter: blur(14px); scrollbar-width: none; }
+.railOverview { display: grid; flex: none; gap: density(1); padding: density(1) density(3); border-radius: radius(pill); color: palette(dark.main); text-decoration: none; transition: background 150ms ease; }
+.railOverview:hover { background: palette(primary.light, 0.12); }
+.railOverview[aria-current="page"] { background: palette(primary.light, 0.22); }
+.railOverviewTitle { @ds-typo(compact-strong); }
+.railOverviewMeta { @ds-typo(meta); display: none; color: palette(tertiary.dark); }
+.railProgress { display: none; overflow: hidden; height: 0.25rem; border-radius: radius(pill); background: palette(neutral.light, 0.7); }
+.railProgress span { display: block; height: 100%; border-radius: radius(pill); background: palette(success.main); transition: width 400ms ease; }
 .railPhase { display: flex; flex: none; align-items: center; gap: density(2); }
-.railPhaseTitle { @ds-typo (eyebrow); display: none; color: palette(tertiary-main); }
+.railPhaseTitle { @ds-typo(eyebrow); display: none; color: palette(tertiary.main); }
 .railList { display: flex; gap: density(1); margin: 0; padding: 0; list-style: none; }
 .railList li { position: relative; flex: none; }
-.railLink { display: flex; align-items: center; gap: density(2); padding-block: density(1); padding-inline: density(1) density(3); border-radius: radius(pill); color: palette(tertiary-dark); text-decoration: none; white-space: nowrap; transition: background 150ms ease, color 150ms ease; }
-.railLink:hover { background: palette(primary-light, 0.12); color: palette(dark-main); }
-.railLink[aria-current="page"] { background: palette(primary-light, 0.22); color: palette(dark-main); }
+.railLink { display: flex; align-items: center; gap: density(2); padding-block: density(1); padding-inline: density(1) density(3); border-radius: radius(pill); color: palette(tertiary.dark); text-decoration: none; white-space: nowrap; transition: background 150ms ease, color 150ms ease; }
+.railLink:hover { background: palette(primary.light, 0.12); color: palette(dark.main); }
+.railLink[aria-current="page"] { background: palette(primary.light, 0.22); color: palette(dark.main); }
 .railText { display: grid; min-width: 0; }
-.railTitle { @ds-typo (compact-strong); }
-.railMeta { @ds-typo (meta); display: none; color: palette(tertiary-dark); }
+.railTitle { @ds-typo(compact-strong); }
+.railMeta { @ds-typo(meta); display: none; color: palette(tertiary.dark); }
 
 @media (min-width: 1024px) {
-  .rail { flex-direction: column; align-items: stretch; gap: density(6); height: calc(100svh - 3.5rem); overflow-x: hidden; overflow-y: auto; padding-block: density(6) density(9); padding-inline: density(4); border-right: border(hairline); border-bottom: 0; background: palette(light-main, 0.55); backdrop-filter: none; }
+  .rail { flex-direction: column; align-items: stretch; gap: density(6); height: calc(100svh - 3.5rem); overflow-x: hidden; overflow-y: auto; padding-block: density(6) density(9); padding-inline: density(4); border-right: border(hairline); border-bottom: 0; background: palette(light.main, 0.55); backdrop-filter: none; }
   .railOverview { gap: density(2); padding: density(3); border-radius: radius(2); }
   .railOverview[aria-current="page"] { box-shadow: shadow(inset-primary); }
   .railOverviewMeta, .railProgress { display: block; }
@@ -61,19 +61,19 @@
   .railLink[aria-current="page"] { box-shadow: shadow(inset-primary); }
   .railMeta { display: block; }
   /* The track: a line from each step's ring to the next one's, green once the step is done. */
-  .railList li:not(:last-child)::before { position: absolute; top: calc(density(2) + 1.75rem + 0.25rem); bottom: calc(0.25rem - density(1) - density(2)); left: calc(density(3) + 0.875rem - 1px); width: 2px; border-radius: radius(pill); background: palette(neutral-light, 0.8); content: ""; }
-  .railList li[data-state="done"]:not(:last-child)::before { background: palette(success-main); }
+  .railList li:not(:last-child)::before { position: absolute; top: calc(density(2) + 1.75rem + 0.25rem); bottom: calc(0.25rem - density(1) - density(2)); left: calc(density(3) + 0.875rem - 1px); width: 2px; border-radius: radius(pill); background: palette(neutral.light, 0.8); content: ""; }
+  .railList li[data-state="done"]:not(:last-child)::before { background: palette(success.main); }
 }
 
 /* A step's number in a ring that reads its state: done, running, waiting for the editor, failed, ready, or waiting on an earlier step. */
-.railRing { @ds-typo (label); position: relative; display: inline-grid; flex: none; place-items: center; width: 1.75rem; height: 1.75rem; border: border(clear); border-radius: radius(circle); border-color: palette(neutral-light); color: palette(tertiary-dark); }
-[data-state="done"] .railRing { background: palette(success-main); border-color: palette(success-main); color: palette(success-contrast); }
-[data-state="running"] .railRing { border-color: palette(info-main); color: palette(info-dark); }
-[data-state="running"] .railRing::after { position: absolute; inset: -0.3rem; border: border(clear); border-radius: radius(circle); border-color: palette(info-main); animation: ringPulse 1.6s ease-out infinite; content: ""; }
-[data-state="attention"] .railRing { background: palette(warning-main, 0.16); border-color: palette(warning-main); color: palette(warning-dark); }
-[data-state="failed"] .railRing { background: palette(error-main, 0.1); border-color: palette(error-main); color: palette(error-dark); }
-[data-state="blocked"] .railRing { border-style: dashed; color: palette(tertiary-main); }
-[data-state="blocked"] .railTitle { color: palette(tertiary-main); }
+.railRing { @ds-typo(label); position: relative; display: inline-grid; flex: none; place-items: center; width: 1.75rem; height: 1.75rem; border: border(clear); border-radius: radius(circle); border-color: palette(neutral.light); color: palette(tertiary.dark); }
+[data-state="done"] .railRing { background: palette(success.main); border-color: palette(success.main); color: palette(success.contrast); }
+[data-state="running"] .railRing { border-color: palette(info.main); color: palette(info.dark); }
+[data-state="running"] .railRing::after { position: absolute; inset: -0.3rem; border: border(clear); border-radius: radius(circle); border-color: palette(info.main); animation: ringPulse 1.6s ease-out infinite; content: ""; }
+[data-state="attention"] .railRing { background: palette(warning.main, 0.16); border-color: palette(warning.main); color: palette(warning.dark); }
+[data-state="failed"] .railRing { background: palette(error.main, 0.1); border-color: palette(error.main); color: palette(error.dark); }
+[data-state="blocked"] .railRing { border-style: dashed; color: palette(tertiary.main); }
+[data-state="blocked"] .railTitle { color: palette(tertiary.main); }
 @keyframes ringPulse { from { opacity: 0.7; transform: scale(0.85); } to { opacity: 0; transform: scale(1.4); } }
 
 /* ---------- The stage and a step's screen ---------- */
@@ -81,105 +81,105 @@
 .screen { display: grid; gap: density(6); width: min(100%, 68rem); margin-inline: auto; animation: screenIn 220ms ease-out; }
 @keyframes screenIn { from { opacity: 0; transform: translateY(0.375rem); } }
 .screenHead { display: grid; gap: density(3); padding-bottom: density(5); border-bottom: border(hairline); }
-.screenKicker { @ds-typo (eyebrow); margin: 0; color: palette(primary-dark); }
+.screenKicker { @ds-typo(eyebrow); margin: 0; color: palette(primary.dark); }
 .screenTitleRow { display: flex; flex-wrap: wrap; align-items: center; gap: density(2) density(3); }
-.screenTitle { @ds-typo (display); margin: 0; color: palette(dark-main); }
+.screenTitle { @ds-typo(display); margin: 0; color: palette(dark.main); }
 /* The title takes the focus when its screen opens, for screen readers; it is not a control. */
 .screenTitle:focus-visible { outline: 0; }
-.screenLead { @ds-typo (body); max-width: 62ch; margin: 0; color: palette(tertiary-dark); }
-.screenVitals { @ds-typo (meta); margin: 0; color: palette(tertiary-dark); }
+.screenLead { @ds-typo(body); max-width: 62ch; margin: 0; color: palette(tertiary.dark); }
+.screenVitals { @ds-typo(meta); margin: 0; color: palette(tertiary.dark); }
 .screenActions { display: flex; flex-wrap: wrap; align-items: center; gap: density(2); }
 .screenHowBody { display: grid; gap: density(2); padding-top: density(2); }
-.screenHowBody p { @ds-typo (small); max-width: 72ch; margin: 0; color: palette(tertiary-dark); }
+.screenHowBody p { @ds-typo(small); max-width: 72ch; margin: 0; color: palette(tertiary.dark); }
 .screenBody { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(4); }
 .screenSection { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(4); padding-top: density(5); border-top: border(hairline); }
 .screenSection:first-child { padding-top: 0; border-top: 0; }
-.screen summary, .trace summary { @ds-typo (small-strong); color: palette(primary-dark); }
+.screen summary, .trace summary { @ds-typo(small-strong); color: palette(primary.dark); }
 
 /* What a step waits for, with the way to the step that provides it. */
-.prereq { @ds-surface (callout); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(2) density(4); padding: density(3) density(4); }
-.prereq p { @ds-typo (small); margin: 0; color: palette(dark-main); }
-.prereq a { @ds-typo (small-strong); color: palette(primary-dark); text-decoration: none; white-space: nowrap; }
+.prereq { @ds-surface(callout); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(2) density(4); padding: density(3) density(4); }
+.prereq p { @ds-typo(small); margin: 0; color: palette(dark.main); }
+.prereq a { @ds-typo(small-strong); color: palette(primary.dark); text-decoration: none; white-space: nowrap; }
 .prereq a:hover { text-decoration: underline; }
 
 /* The screens before and after this one, as two cards. */
 .pager { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(3); padding-top: density(5); border-top: border(hairline); }
 @media (min-width: 640px) { .pager { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
-.pagerLink { @ds-surface (card); display: grid; gap: density(1); padding: density(4); color: palette(dark-main); text-decoration: none; transition: border-color 150ms ease, box-shadow 150ms ease; }
-.pagerLink:hover { border-color: palette(primary-main); box-shadow: shadow(float); }
+.pagerLink { @ds-surface(card); display: grid; gap: density(1); padding: density(4); color: palette(dark.main); text-decoration: none; transition: border-color 150ms ease, box-shadow 150ms ease; }
+.pagerLink:hover { border-color: palette(primary.main); box-shadow: shadow(float); }
 .pagerLink[data-direction="next"] { grid-column: -2; justify-items: end; text-align: right; }
-.pagerHint { @ds-typo (eyebrow); color: palette(primary-dark); }
-.pagerTitle { @ds-typo (title); }
-.pagerMeta { @ds-typo (meta); color: palette(tertiary-dark); }
-.pagerKeys { @ds-typo (meta); grid-column: 1 / -1; margin: 0; color: palette(tertiary-main); text-align: center; }
+.pagerHint { @ds-typo(eyebrow); color: palette(primary.dark); }
+.pagerTitle { @ds-typo(title); }
+.pagerMeta { @ds-typo(meta); color: palette(tertiary.dark); }
+.pagerKeys { @ds-typo(meta); grid-column: 1 / -1; margin: 0; color: palette(tertiary.main); text-align: center; }
 @media (pointer: coarse) { .pagerKeys { display: none; } }
 
 /* ---------- Facts: the article beside the facts drawn from it ---------- */
 .factsColumns { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(5); align-items: start; }
 @media (min-width: 1280px) { .factsColumns { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); } }
-.factsSource { @ds-surface (panel); display: grid; gap: density(3); padding: density(4); }
+.factsSource { @ds-surface(panel); display: grid; gap: density(3); padding: density(4); }
 .factsResult { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(4); }
 .reading { display: grid; gap: density(3); max-height: 70svh; overflow: auto; padding-right: density(2); }
-.reading p { @ds-typo (body); max-width: 70ch; margin: 0; color: palette(dark-main); }
+.reading p { @ds-typo(body); max-width: 70ch; margin: 0; color: palette(dark.main); }
 
 /* ---------- The overview ---------- */
 .overviewHero { display: grid; gap: density(3); padding-bottom: density(5); border-bottom: border(hairline); }
-.overviewTitle { @ds-typo (display-lg); max-width: 26ch; margin: 0; color: palette(dark-main); }
+.overviewTitle { @ds-typo(display-lg); max-width: 26ch; margin: 0; color: palette(dark.main); }
 .overviewTitle:focus-visible { outline: 0; }
-.meta { @ds-typo (small); display: flex; flex-wrap: wrap; align-items: center; gap: density(2) density(3); margin: 0; color: palette(tertiary-dark); }
-.meta a { @ds-typo (small-strong); color: palette(primary-dark); }
+.meta { @ds-typo(small); display: flex; flex-wrap: wrap; align-items: center; gap: density(2) density(3); margin: 0; color: palette(tertiary.dark); }
+.meta a { @ds-typo(small-strong); color: palette(primary.dark); }
 /* The pipeline in one bar: a segment per step, colored by its state. */
 .strip { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: density(1); margin: density(2) 0 0; padding: 0; list-style: none; }
-.strip li { height: 0.375rem; border-radius: radius(pill); background: palette(neutral-light, 0.8); }
-.strip li[data-state="done"] { background: palette(success-main); }
-.strip li[data-state="running"] { background: palette(info-main); animation: liveBlink 1.4s ease-in-out infinite; }
-.strip li[data-state="attention"] { background: palette(warning-main); }
-.strip li[data-state="failed"] { background: palette(error-main); }
-.strip li[data-state="blocked"] { background: palette(neutral-light, 0.4); }
-.autopilotCard { @ds-surface (panel); display: grid; gap: density(3); padding: density(5); }
+.strip li { height: 0.375rem; border-radius: radius(pill); background: palette(neutral.light, 0.8); }
+.strip li[data-state="done"] { background: palette(success.main); }
+.strip li[data-state="running"] { background: palette(info.main); animation: liveBlink 1.4s ease-in-out infinite; }
+.strip li[data-state="attention"] { background: palette(warning.main); }
+.strip li[data-state="failed"] { background: palette(error.main); }
+.strip li[data-state="blocked"] { background: palette(neutral.light, 0.4); }
+.autopilotCard { @ds-surface(panel); display: grid; gap: density(3); padding: density(5); }
 .autopilotHead { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: density(3) density(5); }
-.autopilotTitle { @ds-typo (title); margin: 0; color: palette(dark-main); }
-.autopilotIntro { @ds-typo (small); max-width: 68ch; margin: density(1) 0 0; color: palette(tertiary-dark); }
-.autopilotList { @ds-typo (small); display: grid; gap: density(1); margin: 0; padding-left: density(5); color: palette(dark-main); }
-.autopilotList li[data-status="failed"] { color: palette(error-dark); }
-.autopilotList li[data-status="needs-review"] { color: palette(warning-dark); }
+.autopilotTitle { @ds-typo(title); margin: 0; color: palette(dark.main); }
+.autopilotIntro { @ds-typo(small); max-width: 68ch; margin: density(1) 0 0; color: palette(tertiary.dark); }
+.autopilotList { @ds-typo(small); display: grid; gap: density(1); margin: 0; padding-left: density(5); color: palette(dark.main); }
+.autopilotList li[data-status="failed"] { color: palette(error.dark); }
+.autopilotList li[data-status="needs-review"] { color: palette(warning.dark); }
 /* The board: the four phases side by side as far as they fit, each step a card to open. */
 .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: density(5) density(4); }
 .boardPhase { display: grid; gap: density(2); align-content: start; }
-.boardPhaseTitle { @ds-typo (eyebrow); margin: 0; color: palette(tertiary-main); }
+.boardPhaseTitle { @ds-typo(eyebrow); margin: 0; color: palette(tertiary.main); }
 .boardList { display: grid; gap: density(2); margin: 0; padding: 0; list-style: none; }
-.boardCard { @ds-surface (card); display: grid; gap: density(2); padding: density(3) density(4); color: palette(dark-main); text-decoration: none; transition: border-color 150ms ease, box-shadow 150ms ease; }
-.boardCard:hover { border-color: palette(primary-main); box-shadow: shadow(float); }
+.boardCard { @ds-surface(card); display: grid; gap: density(2); padding: density(3) density(4); color: palette(dark.main); text-decoration: none; transition: border-color 150ms ease, box-shadow 150ms ease; }
+.boardCard:hover { border-color: palette(primary.main); box-shadow: shadow(float); }
 .boardHead { display: flex; align-items: center; gap: density(2); }
-.boardTitle { @ds-typo (compact-strong); flex: 1; min-width: 0; }
-.boardSummary { @ds-typo (small); display: -webkit-box; overflow: hidden; color: palette(dark-main); -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
-[data-state="blocked"] .boardSummary, [data-state="idle"] .boardSummary { color: palette(tertiary-dark); }
+.boardTitle { @ds-typo(compact-strong); flex: 1; min-width: 0; }
+.boardSummary { @ds-typo(small); display: -webkit-box; overflow: hidden; color: palette(dark.main); -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
+[data-state="blocked"] .boardSummary, [data-state="idle"] .boardSummary { color: palette(tertiary.dark); }
 .boardFoot { display: flex; flex-wrap: wrap; align-items: center; gap: density(1) density(2); }
-.boardMeta { @ds-typo (meta); color: palette(tertiary-dark); }
+.boardMeta { @ds-typo(meta); color: palette(tertiary.dark); }
 
 /* ---------- The article beside the screen ---------- */
-.source { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: density(4); padding: density(5) density(4); border-left: border(hairline); background: palette(light-light); }
+.source { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: density(4); padding: density(5) density(4); border-left: border(hairline); background: palette(light.light); }
 .source[hidden] { display: none; }
 @media (max-width: 1279px) { .source { position: fixed; top: 3.5rem; right: 0; bottom: 0; z-index: 40; width: min(100%, 28rem); box-shadow: shadow(overlay); } }
 @media (min-width: 1280px) { .source { position: sticky; top: 3.5rem; height: calc(100svh - 3.5rem); } }
 .sourceHead { display: flex; align-items: flex-start; justify-content: space-between; gap: density(3); }
-.sourceTitle { @ds-typo (title-sm); margin: density(1) 0 0; color: palette(dark-main); }
-.sourceMeta { @ds-typo (meta); margin: density(1) 0 0; color: palette(tertiary-dark); }
+.sourceTitle { @ds-typo(title-sm); margin: density(1) 0 0; color: palette(dark.main); }
+.sourceMeta { @ds-typo(meta); margin: density(1) 0 0; color: palette(tertiary.dark); }
 .sourceBody { display: grid; align-content: start; gap: density(3); overflow: auto; padding-right: density(2); }
-.sourceBody p { @ds-typo (body); margin: 0; color: palette(dark-main); }
+.sourceBody p { @ds-typo(body); margin: 0; color: palette(dark.main); }
 
 /* ---------- Inside the steps: rounds, facts, versions, slides ---------- */
-.eyebrow { @ds-typo (eyebrow); margin: 0; color: palette(primary-dark); }
+.eyebrow { @ds-typo(eyebrow); margin: 0; color: palette(primary.dark); }
 .roundList, .factList, .traceList { display: grid; gap: density(3); margin: 0; padding: 0; list-style: none; }
 .roundCard, .factItem { display: grid; gap: density(2); padding: density(3); border: border(control); border-radius: radius(2); }
-.factHead { @ds-typo (small); display: flex; flex-wrap: wrap; align-items: center; gap: density(2); color: palette(tertiary-dark); }
-.factHead strong { @ds-typo (small-strong); color: palette(dark-main); }
-.factId { @ds-typo (label); color: palette(primary-dark); }
-.factClaim { @ds-typo (body); margin: 0; color: palette(dark-main); }
-.factMeta { @ds-typo (caption); margin: 0; color: palette(tertiary-dark); }
-.issueList { @ds-typo (small); display: grid; gap: density(1); margin: 0; padding-left: density(5); color: palette(dark-main); }
-.issueList strong { @ds-typo (label); }
-.factItem blockquote { @ds-typo (small); margin: density(2) 0 0; padding-left: density(3); border-left: border(control); color: palette(tertiary-dark); }
+.factHead { @ds-typo(small); display: flex; flex-wrap: wrap; align-items: center; gap: density(2); color: palette(tertiary.dark); }
+.factHead strong { @ds-typo(small-strong); color: palette(dark.main); }
+.factId { @ds-typo(label); color: palette(primary.dark); }
+.factClaim { @ds-typo(body); margin: 0; color: palette(dark.main); }
+.factMeta { @ds-typo(caption); margin: 0; color: palette(tertiary.dark); }
+.issueList { @ds-typo(small); display: grid; gap: density(1); margin: 0; padding-left: density(5); color: palette(dark.main); }
+.issueList strong { @ds-typo(label); }
+.factItem blockquote { @ds-typo(small); margin: density(2) 0 0; padding-left: density(3); border-left: border(control); color: palette(tertiary.dark); }
 /* The Focus step: one control per field, as many columns as the screen fits; the voice and the direction span it. */
 /* Shrinkable tracks, as for the opening cards: a long option or line name must not widen the screen. */
 .focusBody { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(3); }
@@ -187,7 +187,7 @@
 .focusField { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(1); align-content: start; }
 .focusWide { grid-column: 1 / -1; }
 .focusVoice { display: grid; gap: density(2); min-width: 0; margin: 0; padding: 0; border: 0; }
-.focusLegend { @ds-typo (small-strong); padding: 0; color: palette(dark-main); }
+.focusLegend { @ds-typo(small-strong); padding: 0; color: palette(dark.main); }
 .voiceDials { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); gap: density(2); }
 /* The chosen cover and slide 2 as 4:5 cards, the judge's scores in one row. */
 /* Shrinkable tracks: a 4:5 card turns its text height into a minimum width, which an auto track would grow to fit past the screen. */
@@ -195,20 +195,20 @@
 .openingCards { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(3); }
 @media (min-width: 960px) { .openingCards { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
 .openingCard { display: flex; flex-direction: column; gap: density(2); aspect-ratio: 4 / 5; padding: density(4); border: border(control); border-radius: radius(2); }
-.openingHeadline { @ds-typo (title-lg); margin: 0; color: palette(dark-main); }
-.openingText { @ds-typo (body); margin: 0; color: palette(dark-main); }
+.openingHeadline { @ds-typo(title-lg); margin: 0; color: palette(dark.main); }
+.openingText { @ds-typo(body); margin: 0; color: palette(dark.main); }
 /* The last slide's call to action, apart from its text as it will be on the slide. */
-.openingCta { @ds-typo (small-strong); margin: 0; color: palette(primary-dark); }
+.openingCta { @ds-typo(small-strong); margin: 0; color: palette(primary.dark); }
 /* A list item's practical line: day · time · ages · price. */
-.openingPractical { @ds-typo (small-strong); margin: 0; color: palette(tertiary-dark); }
+.openingPractical { @ds-typo(small-strong); margin: 0; color: palette(tertiary.dark); }
 /* The whole carousel, cover to call to action, as many cards per row as fit; the slides other steps wrote are quieter. */
 .carouselCards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); gap: density(3); margin: 0; padding: 0; list-style: none; }
 .openingCard[data-quiet] { opacity: 0.72; }
 /* After the role, whose block margins are 0: the cited facts sit at the card's foot. */
-.openingFacts { @ds-typo (caption); margin-top: auto; color: palette(tertiary-dark); }
-.scoreRow { @ds-typo (caption); display: flex; flex-wrap: wrap; gap: density(1) density(3); margin: 0; color: palette(tertiary-dark); }
-.scoreRow strong { @ds-typo (label); color: palette(dark-main); }
-.scoreRow [data-low] strong { color: palette(warning-dark); }
+.openingFacts { @ds-typo(caption); margin-top: auto; color: palette(tertiary.dark); }
+.scoreRow { @ds-typo(caption); display: flex; flex-wrap: wrap; gap: density(1) density(3); margin: 0; color: palette(tertiary.dark); }
+.scoreRow strong { @ds-typo(label); color: palette(dark.main); }
+.scoreRow [data-low] strong { color: palette(warning.dark); }
 /* People and places: a person's Commons candidates, each a thumbnail beside who it is. */
 .candidateList { display: grid; gap: density(2); margin: 0; padding: 0; list-style: none; }
 .candidate { display: grid; grid-template-columns: minmax(0, 10rem) minmax(0, 1fr); gap: density(3); align-items: start; }
@@ -218,39 +218,39 @@
 /* The visual script: each slide's words above its beat and art direction. */
 .visualBody { display: grid; gap: density(2); }
 .visualSlide { display: flex; flex-direction: column; gap: density(1); padding: density(3); border: border(control); border-radius: radius(2); }
-.visualWords { @ds-typo (small-strong); margin: 0; color: palette(dark-main); }
+.visualWords { @ds-typo(small-strong); margin: 0; color: palette(dark.main); }
 .imageGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: density(3); margin: 0; padding: 0; list-style: none; }
 .imageCard { display: flex; flex-direction: column; gap: density(2); padding: density(3); border: border(control); border-radius: radius(2); }
-.imageFrame { display: grid; place-items: center; aspect-ratio: 4 / 5; overflow: hidden; border-radius: radius(1); background: palette(light-light); }
+.imageFrame { display: grid; place-items: center; aspect-ratio: 4 / 5; overflow: hidden; border-radius: radius(1); background: palette(light.light); }
 .imageFill { width: 100%; height: 100%; object-fit: cover; }
 .imageVersions { display: flex; flex-wrap: wrap; gap: density(1); }
 /* A panorama's scene: the one wide image the slides are cut from, at its own proportions, with its cuts drawn on it. */
-.sceneFrame { display: grid; place-items: center; overflow: hidden; border-radius: radius(1); background: palette(light-light); }
+.sceneFrame { display: grid; place-items: center; overflow: hidden; border-radius: radius(1); background: palette(light.light); }
 .sceneFill { display: block; width: 100%; height: auto; }
 /* A slide's words as an object: the slide as the server sets them, and the box the editor drags and widens. */
-.wordsStage { position: relative; display: grid; place-items: center; aspect-ratio: 4 / 5; overflow: hidden; border-radius: radius(1); background: palette(light-light); touch-action: none; }
+.wordsStage { position: relative; display: grid; place-items: center; aspect-ratio: 4 / 5; overflow: hidden; border-radius: radius(1); background: palette(light.light); touch-action: none; }
 .wordsBox { position: absolute; border: border(dashed-primary); border-radius: radius(1); cursor: move; touch-action: none; }
 .wordsBox:focus-visible { outline: border(focus); outline-offset: space(1); }
 /* The text's box, set apart from the headline's or following it, and each box's name. */
 .wordsBoxText { position: absolute; border: border(dashed-control); border-radius: radius(1); cursor: move; touch-action: none; }
 .wordsBoxText:focus-visible { outline: border(focus); outline-offset: space(1); }
-.wordsTag { @ds-typo (label); position: absolute; top: 0; left: 0; padding: 0 density(1); border-radius: radius(1); background: palette(light-light); color: palette(primary-dark); pointer-events: none; }
-.wordsHandle { position: absolute; top: 50%; right: -8px; width: 14px; height: 36px; transform: translateY(-50%); border-radius: radius(1); background: palette(primary-main); cursor: ew-resize; touch-action: none; }
+.wordsTag { @ds-typo(label); position: absolute; top: 0; left: 0; padding: 0 density(1); border-radius: radius(1); background: palette(light.light); color: palette(primary.dark); pointer-events: none; }
+.wordsHandle { position: absolute; top: 50%; right: -8px; width: 14px; height: 36px; transform: translateY(-50%); border-radius: radius(1); background: palette(primary.main); cursor: ew-resize; touch-action: none; }
 .wordsControls { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); gap: density(2); }
 /* The slide studio: one slide over the Images screen, the preview as tall as the window allows, the controls beside it, Apply always in view. */
-.studioBackdrop { position: fixed; z-index: 50; display: grid; place-items: center; inset: 0; padding: density(3); background: palette(dark-main, 0.48); backdrop-filter: blur(6px); }
+.studioBackdrop { position: fixed; z-index: 50; display: grid; place-items: center; inset: 0; padding: density(3); background: palette(dark.main, 0.48); backdrop-filter: blur(6px); }
 /* A flex column, as the Dialog is: a grid's 1fr row cannot resolve against a max-height, so the body overflowed the studio and its controls and Apply were clipped out of reach. */
-.studio { @ds-surface (boxed); display: flex; flex-direction: column; width: min(1200px, 100%); max-height: calc(100svh - 1.5rem); overflow: hidden; border-radius: radius(2); }
+.studio { @ds-surface(boxed); display: flex; flex-direction: column; width: min(1200px, 100%); max-height: calc(100svh - 1.5rem); overflow: hidden; border-radius: radius(2); }
 .studioHeader, .studioFooter, .studio > [role="status"], .studio > [role="alert"] { flex: none; }
 .studioHeader { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(3); padding: density(3) density(4); border-bottom: border(control); }
 .studioNav { display: flex; flex-wrap: wrap; align-items: center; gap: density(2); min-width: 0; }
-.studioTitle { @ds-typo (title); margin: 0 density(2); }
+.studioTitle { @ds-typo(title); margin: 0 density(2); }
 .studioBody { flex: 1 1 auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: density(4); min-height: 0; padding: density(4); overflow: auto; }
 .studioStageColumn { display: grid; align-content: start; justify-items: center; gap: density(2); min-width: 0; }
-.studioStage { position: relative; display: grid; place-items: center; width: min(100%, calc((100svh - 17rem) * 0.8)); aspect-ratio: 4 / 5; overflow: hidden; border-radius: radius(1); background: palette(light-light); touch-action: none; }
+.studioStage { position: relative; display: grid; place-items: center; width: min(100%, calc((100svh - 17rem) * 0.8)); aspect-ratio: 4 / 5; overflow: hidden; border-radius: radius(1); background: palette(light.light); touch-action: none; }
 .studioPanel { display: grid; align-content: start; gap: density(2); min-width: 0; }
 .studioGroup { border: border(control); border-radius: radius(2); }
-.studioGroup > summary { @ds-typo (small-strong); padding: density(2) density(3); color: palette(primary-dark); }
+.studioGroup > summary { @ds-typo(small-strong); padding: density(2) density(3); color: palette(primary.dark); }
 .studioGroupBody { display: grid; gap: density(2); padding: 0 density(3) density(3); }
 .studioFooter { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(2); padding: density(3) density(4); border-top: border(control); }
 .studioActions { display: flex; flex-wrap: wrap; align-items: center; gap: density(2); }
@@ -265,7 +265,7 @@
 
 /* A colour: the brand's swatches first, then any other, and an opacity for a background. */
 .colorField { display: grid; gap: density(1); align-content: start; }
-.colorLabel { @ds-typo (small-strong); color: palette(dark-main); }
+.colorLabel { @ds-typo(small-strong); color: palette(dark.main); }
 .swatches { display: flex; flex-wrap: wrap; align-items: center; gap: density(1); }
 .swatch[aria-pressed="true"] { outline: border(focus); outline-offset: space(1); }
 /* The editor's own image for a slide: the story's photos to choose from, each with its rights. */
@@ -273,20 +273,20 @@
 .ownPhoto { display: flex; flex-direction: column; gap: density(1); min-width: 0; }
 /* The caption: the post as it will read, its line breaks and blank lines kept. */
 .captionPost { display: grid; gap: density(2); max-width: 60ch; padding: density(4); border: border(control); border-radius: radius(2); }
-.captionText { @ds-typo (body); margin: 0; color: palette(dark-main); white-space: pre-wrap; overflow-wrap: anywhere; }
+.captionText { @ds-typo(body); margin: 0; color: palette(dark.main); white-space: pre-wrap; overflow-wrap: anywhere; }
 /* Adding an account to tag: its username, who it is and whom in the story it stands for. */
 .mentionForm { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: density(3); }
 
 /* A story published with the earlier studio: its page outside the canvas (published-story-page-client.tsx). */
 .publishedBody { display: grid; gap: density(4); width: min(100%, 68rem); margin-inline: auto; padding: density(4); }
-.publishedBody h1 { @ds-typo (title); margin: 0; }
-.publishedBody p { @ds-typo (body); margin: 0; color: palette(dark-main); }
+.publishedBody h1 { @ds-typo(title); margin: 0; }
+.publishedBody p { @ds-typo(body); margin: 0; color: palette(dark.main); }
 
 /* ---------- Provider calls ---------- */
 .trace { padding-top: density(2); }
 .traceList { margin-top: density(2); }
-.traceList li { @ds-typo (caption); display: flex; flex-wrap: wrap; justify-content: space-between; gap: density(2); color: palette(tertiary-dark); }
-.traceList li[data-outcome="error"] { color: palette(error-dark); }
+.traceList li { @ds-typo(caption); display: flex; flex-wrap: wrap; justify-content: space-between; gap: density(2); color: palette(tertiary.dark); }
+.traceList li[data-outcome="error"] { color: palette(error.dark); }
 
 /* Motion is decoration here: none when the reader asks for less. */
 @media (prefers-reduced-motion: reduce) {
diff --git a/src/app/editorial-profile-panel.module.uxdsl b/src/app/editorial-profile-panel.module.uxdsl
index 6f21a5c..e7da7bb 100644
--- a/src/app/editorial-profile-panel.module.uxdsl
+++ b/src/app/editorial-profile-panel.module.uxdsl
@@ -4,7 +4,7 @@
   gap: density(5);
   margin-top: density(5);
   padding: density(4);
-  border-color: palette(primary-light, 0.28);
+  border-color: palette(primary.light, 0.28);
 }
 
 .heading,
@@ -30,16 +30,16 @@
 }
 
 .heading p {
-  @ds-typo (eyebrow);
+  @ds-typo(eyebrow);
   margin: 0 0 space(2);
-  color: palette(info-main);
+  color: palette(info.main);
 }
 
 .heading h2,
 .weightsHeading h3 {
   @ds-typo(h3);
   margin: 0;
-  color: palette(info-dark);
+  color: palette(info.dark);
 }
 
 .heading small,
@@ -49,7 +49,7 @@
   @ds-typo(small);
   display: block;
   margin-top: density(2);
-  color: palette(info-main);
+  color: palette(info.main);
 }
 
 .defaultBadge,
@@ -62,10 +62,10 @@
   white-space: nowrap;
 }
 
-.defaultBadge { background: palette(light-light); color: palette(info-main); }
+.defaultBadge { background: palette(light.light); color: palette(info.main); }
 .savedBadge,
-.validTotal { background: palette(surface-light); color: palette(primary-dark); }
-.invalidTotal { background: palette(error-light); color: palette(error-main); }
+.validTotal { background: palette(surface.light); color: palette(primary.dark); }
+.invalidTotal { background: palette(error.light); color: palette(error.main); }
 
 .copyGrid,
 .policyGrid,
@@ -86,7 +86,7 @@
   @ds-typo(caption);
   display: grid;
   gap: density(1);
-  color: palette(info-dark);
+  color: palette(info.dark);
 }
 
 .panel input,
@@ -100,28 +100,28 @@
 
 .panel textarea { resize: vertical; }
 .panel input:focus,
-.panel textarea:focus { outline: border(focus-soft); border-color: palette(info-main); }
+.panel textarea:focus { outline: border(focus-soft); border-color: palette(info.main); }
 
 .numberField > div { position: relative; }
 .numberField input { padding-right: space(9); }
-.numberField > div small { @ds-typo(caption); position: absolute; right: density(2); color: palette(info-main); }
-.numberField > small { @ds-typo(caption); color: palette(error-main); }
-.numberField input[aria-invalid="true"] { border-color: palette(error-main); }
+.numberField > div small { @ds-typo(caption); position: absolute; right: density(2); color: palette(info.main); }
+.numberField > small { @ds-typo(caption); color: palette(error.main); }
+.numberField input[aria-invalid="true"] { border-color: palette(error.main); }
 
 .weightsHeading { margin-top: density(2); padding-top: density(5); border-top: border(1); }
 
 .policyHint {
   @ds-typo(small);
   margin: calc(density(2) * -1) 0 0;
-  color: palette(info-main);
+  color: palette(info.main);
 }
 
 .policyHint code {
   @ds-typo(code);
   padding: density(1);
   border-radius: radius(1);
-  background: palette(light-light);
-  color: palette(info-main);
+  background: palette(light.light);
+  color: palette(info.main);
 }
 
 .footer { padding-top: density(2); }
@@ -136,7 +136,7 @@
   border-radius: radius(2);
   padding: density(3);
 }
-.locked { background: palette(light-light); color: palette(tertiary-main); }
-.loading { color: palette(info-main); }
-.notice { background: palette(light-light); color: palette(primary-dark); }
-.error { background: palette(error-light); color: palette(error-main); }
+.locked { background: palette(light.light); color: palette(tertiary.main); }
+.loading { color: palette(info.main); }
+.notice { background: palette(light.light); color: palette(primary.dark); }
+.error { background: palette(error.light); color: palette(error.main); }
diff --git a/src/app/radar-dashboard.module.uxdsl b/src/app/radar-dashboard.module.uxdsl
index c337985..42ecd8e 100644
--- a/src/app/radar-dashboard.module.uxdsl
+++ b/src/app/radar-dashboard.module.uxdsl
@@ -1,7 +1,7 @@
 .appShell {
   display: flex;
   min-height: 100svh;
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .sidebar {
@@ -17,8 +17,8 @@
   flex-direction: column;
   padding: density(6) density(5);
   overflow-y: auto;
-  background: palette(dark-main);
-  color: palette(light-light);
+  background: palette(dark.main);
+  color: palette(light.light);
   box-shadow: shadow(3);
   transform: xs(translateX(-105%)) lg(none);
   transition: xs(transform 180ms ease) lg(none);
@@ -43,19 +43,19 @@
 }
 
 .sidebar .brand h1 {
-  color: palette(light-light);
-  @ds-typo (brand);
+  color: palette(light.light);
+  @ds-typo(brand);
 }
 
 .sidebar .eyebrow {
-  color: palette(primary-main);
-  @ds-typo (fine);
+  color: palette(primary.main);
+  @ds-typo(fine);
 }
 
 .sidebar .logo {
   width: 36px;
   height: 36px;
-  background: palette(dark-main);
+  background: palette(dark.main);
   box-shadow: none;
 }
 
@@ -71,18 +71,18 @@
 
 .closeSidebarButton,
 .menuButton {
-  @ds-button (text);
+  @ds-button(text);
   display: xs(block) lg(none);
 }
 
 .closeSidebarButton {
   padding: 0 density(2);
-  color: palette(primary-light);
-  @ds-typo (icon-lg);
+  color: palette(primary.light);
+  @ds-typo(icon-lg);
 }
 
 .menuButton {
-  @ds-surface (card);
+  @ds-surface(card);
   /* The shared rule above sets display:block; this one wins for .menuButton
    * specifically, same as the original max-width:960px override did. */
   display: xs(grid) lg(none);
@@ -100,7 +100,7 @@
   width: 100%;
   height: 1.5px;
   border-radius: radius(pill);
-  background: palette(primary-dark);
+  background: palette(primary.dark);
 }
 
 .sidebarNav {
@@ -111,8 +111,8 @@
 
 .navLabel {
   margin: density(5) density(3) density(3);
-  color: palette(primary-main);
-  @ds-typo (badge);
+  color: palette(primary.main);
+  @ds-typo(badge);
 }
 
 .navLabel:first-child { margin-top: 0; }
@@ -125,18 +125,18 @@
   padding: 0 density(4);
   border: border(clear-thin);
   border-radius: radius(2);
-  color: palette(primary-light);
-  @ds-typo (compact-strong);
+  color: palette(primary.light);
+  @ds-typo(compact-strong);
   text-decoration: none;
   transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
 }
 
 .sidebarNav a:hover,
 .sidebarNav a:focus-visible {
-  border-color: palette(primary-light, 0.14);
+  border-color: palette(primary.light, 0.14);
   outline: 0;
-  background: palette(primary-light, 0.11);
-  color: palette(light-light);
+  background: palette(primary.light, 0.11);
+  color: palette(light.light);
 }
 
 .navIcon {
@@ -144,40 +144,40 @@
   width: 19px;
   height: 19px;
   place-items: center;
-  color: palette(primary-light);
-  @ds-typo (icon);
+  color: palette(primary.light);
+  @ds-typo(icon);
 }
 
 .sidebarNav a.navSubItem {
-  @ds-typo (label);
+  @ds-typo(label);
   min-height: 2.25rem;
   margin-left: density(6);
   padding-left: density(3);
   border-left: border(focus-soft);
   border-radius: 0 radius(2) radius(2) 0;
-  color: palette(primary-light, 0.82);
+  color: palette(primary.light, 0.82);
 }
 
 .sidebarNav a.navSubItem .navIcon {
-  @ds-typo (icon-xs);
+  @ds-typo(icon-xs);
   width: 14px;
   height: 14px;
 }
 
 .sidebarNav a.navSubItem:hover,
 .sidebarNav a.navSubItem:focus-visible {
-  border-left-color: palette(secondary-main);
+  border-left-color: palette(secondary.main);
 }
 
 .sidebarNav a.navActive,
 .sidebarNav a.navSubItem.navActive {
-  border-color: palette(secondary-main, 0.42);
-  background: palette(primary-light, 0.14);
-  color: palette(light-light);
+  border-color: palette(secondary.main, 0.42);
+  background: palette(primary.light, 0.14);
+  color: palette(light.light);
 }
 
 .sidebarNav a.navSubItem.navActive {
-  border-left-color: palette(secondary-main);
+  border-left-color: palette(secondary.main);
 }
 
 .navBadge {
@@ -187,10 +187,10 @@
   height: 18px;
   padding: 0 density(1);
   place-items: center;
-  border-radius: radius(full);
-  background: palette(secondary-main);
-  color: palette(secondary-contrast);
-  @ds-typo (fine-strong);
+  border-radius: radius(pill);
+  background: palette(secondary.main);
+  color: palette(secondary.contrast);
+  @ds-typo(fine-strong);
 }
 
 .navGroup {
@@ -218,7 +218,7 @@
 
 .navGroupSummary:hover,
 .navGroupSummary:focus-visible {
-  background: palette(primary-light, 0.06);
+  background: palette(primary.light, 0.06);
 }
 
 .navGroupSummary a,
@@ -232,14 +232,14 @@
   gap: density(4);
   min-height: 2.75rem;
   padding: 0 density(4);
-  color: palette(primary-light);
-  @ds-typo (compact-strong);
+  color: palette(primary.light);
+  @ds-typo(compact-strong);
 }
 
 .navGroupSummary::after {
   padding: density(2) density(4);
-  color: palette(primary-light, 0.55);
-  @ds-typo (icon-sm);
+  color: palette(primary.light, 0.55);
+  @ds-typo(icon-sm);
   content: "⌄";
 }
 
@@ -274,15 +274,15 @@
 
 .navItemCaption {
   overflow: hidden;
-  color: palette(primary-light, 0.55);
-  @ds-typo (fine);
+  color: palette(primary.light, 0.55);
+  @ds-typo(fine);
   text-overflow: ellipsis;
   white-space: nowrap;
 }
 
 .sidebarNav a.navItemWithCaption:hover .navItemCaption,
 .sidebarNav a.navItemWithCaption.navActive .navItemCaption {
-  color: palette(light-light, 0.72);
+  color: palette(light.light, 0.72);
 }
 
 .sidebarFooter {
@@ -293,15 +293,15 @@
 
 
 .sidebarFooter .environment {
-  border-color: palette(primary-light, 0.16);
-  background: palette(light-light, 0.06);
-  color: palette(primary-light);
+  border-color: palette(primary.light, 0.16);
+  background: palette(light.light, 0.06);
+  color: palette(primary.light);
 }
 
 .sidebarFooter p {
   margin: density(4) density(1) 0;
-  color: palette(primary-main);
-  @ds-typo (meta);
+  color: palette(primary.main);
+  @ds-typo(meta);
 }
 
 .sidebarBackdrop {
@@ -312,7 +312,7 @@
   z-index: 15;
   width: 100%;
   border: 0;
-  background: palette(dark-main, 0.42);
+  background: palette(dark.main, 0.42);
   cursor: pointer;
 }
 
@@ -329,7 +329,7 @@
   gap: density(1);
   padding: xs(density(2) density(4)) md(density(2) density(5));
   border-bottom: border(hairline);
-  background: palette(light-light, 0.9);
+  background: palette(light.light, 0.9);
   backdrop-filter: blur(18px);
 }
 
@@ -395,18 +395,18 @@
   width: 30px;
   height: 30px;
   padding: 0;
-  border-color: palette(dark-main, 0.12);
+  border-color: palette(dark.main, 0.12);
   background: transparent;
-  color: palette(primary-dark);
+  color: palette(primary.dark);
   cursor: pointer;
   place-items: center;
   transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
 }
 
 .disconnectButton:hover:not(:disabled) {
-  border-color: palette(error-main, 0.45);
-  background: palette(error-main, 0.08);
-  color: palette(error-dark);
+  border-color: palette(error.main, 0.45);
+  background: palette(error.main, 0.08);
+  color: palette(error.dark);
 }
 
 .disconnectButton:disabled {
@@ -418,18 +418,18 @@
   @ds-button(outlined primary 2);
   min-height: 30px;
   padding: 0 density(3);
-  border-color: palette(primary-main, 0.45);
+  border-color: palette(primary.main, 0.45);
   background: transparent;
-  color: palette(primary-dark);
-  @ds-typo (meta-strong);
+  color: palette(primary.dark);
+  @ds-typo(meta-strong);
   white-space: nowrap;
   cursor: pointer;
   transition: background 150ms ease, border-color 150ms ease, opacity 150ms ease;
 }
 
 .secretConnectButton:hover:not(:disabled) {
-  border-color: palette(primary-main);
-  background: palette(primary-main, 0.08);
+  border-color: palette(primary.main);
+  background: palette(primary.main, 0.08);
 }
 
 .secretConnectButton:disabled {
@@ -446,8 +446,8 @@
 
 .secretField > span {
   display: xs(none) sm(inline);
-  color: palette(tertiary-main);
-  @ds-typo (badge);
+  color: palette(tertiary.main);
+  @ds-typo(badge);
   white-space: nowrap;
 }
 
@@ -459,14 +459,14 @@
   width: xs(100%) sm(200px);
   min-height: 30px;
   padding: 0 density(3);
-  border-color: palette(dark-main, 0.12);
-  background: palette(light-light);
-  color: palette(dark-main);
-  @ds-typo (caption);
+  border-color: palette(dark.main, 0.12);
+  background: palette(light.light);
+  color: palette(dark.main);
+  @ds-typo(caption);
 }
 
 .secretField input:focus-visible {
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
   box-shadow: shadow(ring);
 }
 
@@ -478,8 +478,8 @@
 
 .topbarLabel {
   display: xs(none) md(inline);
-  color: palette(tertiary-main);
-  @ds-typo (badge);
+  color: palette(tertiary.main);
+  @ds-typo(badge);
   white-space: nowrap;
 }
 
@@ -504,11 +504,11 @@
    * in the same logical properties the base already uses. */
   padding-block: xs(density(5) density(7)) md(density(9) density(11));
   padding-inline: xs(density(4)) md(density(5));
-  color: palette(dark-main);
+  color: palette(dark.main);
   background:
-    radial-gradient(circle at 8% 0%, palette(primary-light, 0.62), transparent 30rem),
-    radial-gradient(circle at 94% 14%, palette(info-light, 0.68), transparent 34rem),
-    palette(light-light);
+    radial-gradient(circle at 8% 0%, palette(primary.light, 0.62), transparent 30rem),
+    radial-gradient(circle at 94% 14%, palette(info.light, 0.68), transparent 34rem),
+    palette(light.light);
 }
 
 .shell {
@@ -545,15 +545,15 @@
 
 .brand h1 {
   margin: density(1) 0 0;
-  @ds-typo (brand);
+  @ds-typo(brand);
 }
 
 .eyebrow,
 .kicker,
 .sectionNumber {
   margin: 0;
-  color: palette(primary-main);
-  @ds-typo (eyebrow);
+  color: palette(primary.main);
+  @ds-typo(eyebrow);
 }
 
 .logo {
@@ -563,7 +563,7 @@
   height: 42px;
   place-items: center;
   border-radius: radius(circle);
-  background: palette(dark-main);
+  background: palette(dark.main);
   box-shadow: shadow(3);
 }
 
@@ -592,21 +592,21 @@
   width: 4px;
   height: 4px;
   border: 0;
-  background: palette(primary-main);
+  background: palette(primary.main);
 }
 
 .environment,
 .online,
 .idle {
-  @ds-surface (panel);
+  @ds-surface(panel);
   display: inline-flex;
   align-items: center;
   gap: density(3);
   padding: density(3) density(4);
   border-radius: radius(pill);
-  background: palette(light-light, 0.58);
-  color: palette(primary-dark);
-  @ds-typo (label);
+  background: palette(light.light, 0.58);
+  color: palette(primary.dark);
+  @ds-typo(label);
   backdrop-filter: blur(10px);
 }
 
@@ -616,13 +616,13 @@
   width: 7px;
   height: 7px;
   border-radius: radius(circle);
-  background: palette(primary-main);
+  background: palette(primary.main);
   content: "";
   box-shadow: shadow(ring);
 }
 
 .idle::before {
-  background: palette(surface-dark);
+  background: palette(surface.dark);
   box-shadow: none;
 }
 
@@ -646,12 +646,12 @@
 }
 
 .topbarStatus.online {
-  background: palette(success-main);
+  background: palette(success.main);
   box-shadow: shadow(ring-success);
 }
 
 .topbarStatus.idle {
-  background: palette(error-main);
+  background: palette(error.main);
   box-shadow: shadow(ring-error);
 }
 
@@ -666,15 +666,15 @@
 .hero h2 {
   max-width: 43rem;
   margin: density(3) 0 density(4);
-  color: palette(dark-main);
-  @ds-typo (display-xl);
+  color: palette(dark.main);
+  @ds-typo(display-xl);
 }
 
 .hero > div > p:last-child {
   max-width: 39rem;
   margin: 0;
-  color: palette(primary-main);
-  @ds-typo (body);
+  color: palette(primary.main);
+  @ds-typo(body);
 }
 
 .heroMetric {
@@ -687,14 +687,14 @@
 .heroMetric span,
 .heroMetric small {
   display: block;
-  color: palette(tertiary-main);
-  @ds-typo (caption);
+  color: palette(tertiary.main);
+  @ds-typo(caption);
 }
 
 .heroMetric strong {
   display: block;
   margin: density(2) 0;
-  @ds-typo (metric);
+  @ds-typo(metric);
 }
 
 .mainGrid {
@@ -709,7 +709,7 @@
   border: border(hairline);
   /* Was a max-width:520px override of the mixin's own radius(3). */
   border-radius: radius(4);
-  background: palette(light-light, 0.8);
+  background: palette(light.light, 0.8);
   box-shadow: shadow(4);
   backdrop-filter: blur(18px);
 }
@@ -721,27 +721,27 @@
 
 .panel h2 {
   margin: density(2) 0 0;
-  @ds-typo (section-title);
+  @ds-typo(section-title);
 }
 
 .discoverSearchPanel { padding: density(5); }
 .discoverSearchHeading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(3); }
 .discoverSearchHeading h2 { margin: 0; }
-.discoverSearchHeading p { margin: density(1) 0 0; color: palette(tertiary-main); @ds-typo(small); }
-.discoverSearchHeading a { color: palette(primary-dark); @ds-typo (small-strong); text-decoration: none; }
+.discoverSearchHeading p { margin: density(1) 0 0; color: palette(tertiary.main); @ds-typo(small); }
+.discoverSearchHeading a { color: palette(primary.dark); @ds-typo(small-strong); text-decoration: none; }
 .discoverSearchHeading a:hover { text-decoration: underline; }
 .discoverSearchFields { display: grid; grid-template-columns: xs(1fr) md(minmax(220px, 0.9fr) minmax(280px, 1.4fr)); gap: density(3); align-items: start; }
 .discoverSearchFieldsSingle { grid-template-columns: 1fr; }
 .discoverSearchFieldsSingle .field { max-width: 460px; }
 .discoverSearchFields .field { margin-top: density(4); }
-.discoverSearchFields .field > span small { @ds-typo (regular); color: palette(tertiary-main); }
-.discoverSearchFields select { @ds-input(outlined primary 2); width: 100%; height: 48px; padding-inline: density(4); border-color: palette(surface-dark); background: palette(light-light, 0.84); color: palette(dark-main); }
-.discoverSearchScope { margin: density(4) 0 0; color: palette(tertiary-main); @ds-typo(small); }
+.discoverSearchFields .field > span small { @ds-typo(regular); color: palette(tertiary.main); }
+.discoverSearchFields select { @ds-input(outlined primary 2); width: 100%; height: 48px; padding-inline: density(4); border-color: palette(surface.dark); background: palette(light.light, 0.84); color: palette(dark.main); }
+.discoverSearchScope { margin: density(4) 0 0; color: palette(tertiary.main); @ds-typo(small); }
 .discoverSearchOptions { margin-top: density(3); border-top: border(hairline); }
-.discoverSearchOptions > summary { @ds-button (link); min-height: 44px; display: flex; align-items: center; @ds-typo (small-strong); }
-.discoverSearchOptions > p { margin: density(3) 0; color: palette(tertiary-main); @ds-typo(small); }
-.discoverPeriodToggle { @ds-button (link); display: flex; align-items: center; gap: density(3); min-height: 44px; @ds-typo(small); }
-.discoverPeriodToggle input { width: 18px; height: 18px; accent-color: palette(primary-main); }
+.discoverSearchOptions > summary { @ds-button(link); min-height: 44px; display: flex; align-items: center; @ds-typo(small-strong); }
+.discoverSearchOptions > p { margin: density(3) 0; color: palette(tertiary.main); @ds-typo(small); }
+.discoverPeriodToggle { @ds-button(link); display: flex; align-items: center; gap: density(3); min-height: 44px; @ds-typo(small); }
+.discoverPeriodToggle input { width: 18px; height: 18px; accent-color: palette(primary.main); }
 .discoverSearchPanel .buttonRow { justify-content: flex-end; margin-top: density(3); }
 .discoverSearchPanel .primaryButton { flex: none; }
 
@@ -753,35 +753,35 @@
 .field > span {
   display: block;
   margin-bottom: density(3);
-  color: palette(primary-dark);
-  @ds-typo (compact-strong);
+  color: palette(primary.dark);
+  @ds-typo(compact-strong);
 }
 
 .field input {
   @ds-input(outlined primary 2);
   height: 48px;
   padding: 0 density(4);
-  border-color: palette(surface-dark);
-  background: palette(light-light, 0.84);
-  color: palette(dark-main);
+  border-color: palette(surface.dark);
+  background: palette(light.light, 0.84);
+  color: palette(dark.main);
   transition: border-color 160ms ease, box-shadow 160ms ease;
 }
 
 .field input:focus {
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
   box-shadow: shadow(ring);
 }
-.field input[aria-invalid="true"] { border-color: palette(error-main); }
+.field input[aria-invalid="true"] { border-color: palette(error.main); }
 .rangeEndpoint { display: flex; flex-wrap: wrap; gap: density(3); margin-top: density(4); }
-.rangeEndpoint label { display: grid; flex: 1 1 180px; gap: density(2); min-width: 0; color: palette(primary-dark); @ds-typo (small-strong); }
-.rangeEndpoint input { @ds-input(outlined primary 2); width: 100%; min-height: 44px; padding-inline: density(3); border-color: palette(surface-dark); background: palette(light-light); color: palette(dark-main); }
-.rangeEndpoint input[aria-invalid="true"] { border-color: palette(error-main); }
+.rangeEndpoint label { display: grid; flex: 1 1 180px; gap: density(2); min-width: 0; color: palette(primary.dark); @ds-typo(small-strong); }
+.rangeEndpoint input { @ds-input(outlined primary 2); width: 100%; min-height: 44px; padding-inline: density(3); border-color: palette(surface.dark); background: palette(light.light); color: palette(dark.main); }
+.rangeEndpoint input[aria-invalid="true"] { border-color: palette(error.main); }
 
 .field small {
   display: block;
   margin-top: density(3);
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .inputSuffix {
@@ -796,8 +796,8 @@
   position: absolute;
   top: 50%;
   right: density(4);
-  color: palette(tertiary-main);
-  @ds-typo (caption);
+  color: palette(tertiary.main);
+  @ds-typo(caption);
   transform: translateY(-50%);
 }
 
@@ -813,7 +813,7 @@
   width: xs(100%) sm(auto);
   min-height: 45px;
   padding: 0 density(5);
-  @ds-typo (compact-strong);
+  @ds-typo(compact-strong);
   cursor: pointer;
   transition: transform 150ms ease, opacity 150ms ease, box-shadow 150ms ease;
 }
@@ -847,20 +847,20 @@
   @ds-surface(contained light 2);
   padding: density(5);
   border: border(hairline);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .metric span,
 .lastRun span {
   display: block;
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .metric strong {
   display: block;
   margin-top: density(3);
-  @ds-typo (headline);
+  @ds-typo(headline);
 }
 
 .statusList {
@@ -869,8 +869,8 @@
 
 .statusList > p {
   margin: 0 0 density(3);
-  color: palette(tertiary-main);
-  @ds-typo (eyebrow);
+  color: palette(tertiary.main);
+  @ds-typo(eyebrow);
 }
 
 .statusList > div:not(.emptyState) {
@@ -878,30 +878,30 @@
   justify-content: space-between;
   padding: density(3) density(1);
   border-bottom: border(light);
-  color: palette(primary-dark);
-  @ds-typo (compact);
+  color: palette(primary.dark);
+  @ds-typo(compact);
 }
 
 .statusList strong {
-  color: palette(dark-main);
+  color: palette(dark.main);
 }
 
 .emptyState {
   padding: density(5) 0;
-  color: palette(tertiary-main);
-  @ds-typo (compact);
+  color: palette(tertiary.main);
+  @ds-typo(compact);
 }
 
 .lastRun {
   @ds-surface(contained dark 2);
   margin-top: density(5);
   padding: density(4) density(5);
-  color: palette(light-light);
+  color: palette(light.light);
 }
 
 .lastRun span,
 .lastRun small {
-  color: palette(surface-dark);
+  color: palette(surface.dark);
 }
 
 .lastRun strong,
@@ -911,11 +911,11 @@
 }
 
 .lastRun strong {
-  @ds-typo (small);
+  @ds-typo(small);
 }
 
 .lastRun small {
-  @ds-typo (meta);
+  @ds-typo(meta);
 }
 
 .notice {
@@ -926,7 +926,7 @@
 }
 
 .notice > span {
-  @ds-typo (emphasis);
+  @ds-typo(emphasis);
   display: grid;
   flex: 0 0 density(6);
   width: density(6);
@@ -939,7 +939,7 @@
 .notice p {
   display: block;
   margin: 0;
-  @ds-typo (compact);
+  @ds-typo(compact);
 }
 
 .notice p {
@@ -948,23 +948,23 @@
 }
 
 .noticeSuccess {
-  border-color: palette(primary-light);
-  background: palette(light-light);
-  color: palette(dark-main);
+  border-color: palette(primary.light);
+  background: palette(light.light);
+  color: palette(dark.main);
 }
 
 .noticeSuccess > span {
-  background: palette(primary-light);
+  background: palette(primary.light);
 }
 
 .noticeError {
-  border-color: palette(error-light);
-  background: palette(light-light);
-  color: palette(error-dark);
+  border-color: palette(error.light);
+  background: palette(light.light);
+  color: palette(error.dark);
 }
 
 .noticeError > span {
-  background: palette(error-light);
+  background: palette(error.light);
 }
 
 .preferencesPanel {
@@ -976,19 +976,19 @@
   padding: density(1) density(2);
   border: border(current);
   border-radius: radius(pill);
-  @ds-typo (meta-strong);
+  @ds-typo(meta-strong);
 }
 
 .savedBadge {
-  border-color: palette(primary-light);
-  background: palette(light-light);
-  color: palette(primary-dark);
+  border-color: palette(primary.light);
+  background: palette(light.light);
+  color: palette(primary.dark);
 }
 
 .unsavedBadge {
-  border-color: palette(warning-light);
-  background: palette(light-light);
-  color: palette(warning-dark);
+  border-color: palette(warning.light);
+  background: palette(light.light);
+  color: palette(warning.dark);
 }
 
 .preferencesIntro,
@@ -1007,8 +1007,8 @@
 .preferencesIntro p {
   max-width: 670px;
   margin: 0;
-  color: palette(tertiary-main);
-  @ds-typo (compact);
+  color: palette(tertiary.main);
+  @ds-typo(compact);
 }
 
 .preferencesIntro > span {
@@ -1016,9 +1016,9 @@
   align-self: xs(flex-start) sm(auto);
   padding: density(1) density(2);
   border-radius: radius(2);
-  background: palette(light-light);
-  color: palette(primary-dark);
-  @ds-typo (meta-strong);
+  background: palette(light.light);
+  color: palette(primary.dark);
+  @ds-typo(meta-strong);
 }
 
 .preferencesGrid {
@@ -1033,7 +1033,7 @@
   padding: density(4);
   border: border(subtle);
   border-radius: radius(3);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .termField > span {
@@ -1041,8 +1041,8 @@
   align-items: center;
   gap: density(1);
   margin-bottom: density(3);
-  color: palette(primary-dark);
-  @ds-typo (compact-strong);
+  color: palette(primary.dark);
+  @ds-typo(compact-strong);
 }
 
 .termField > span::before {
@@ -1051,18 +1051,18 @@
   height: 20px;
   place-items: center;
   border-radius: radius(2);
-  @ds-typo (compact);
+  @ds-typo(compact);
   content: "+";
 }
 
 .favoredLabel::before {
-  background: palette(primary-light);
-  color: palette(primary-dark);
+  background: palette(primary.light);
+  color: palette(primary.dark);
 }
 
 .termField > .unfavoredLabel::before {
-  background: palette(error-light);
-  color: palette(error-main);
+  background: palette(error.light);
+  color: palette(error.main);
   content: "−";
 }
 
@@ -1075,23 +1075,23 @@
   border: border(subtle);
   border-radius: radius(3);
   outline: 0;
-  background: palette(light-light);
-  color: palette(dark-main);
+  background: palette(light.light);
+  color: palette(dark.main);
   font: inherit;
-  @ds-typo (compact);
+  @ds-typo(compact);
   transition: border-color 160ms ease, box-shadow 160ms ease;
 }
 
 .termField textarea:focus {
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
   box-shadow: shadow(ring);
 }
 
 .termField small {
   display: block;
   margin-top: density(3);
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .preferencesFooter {
@@ -1099,8 +1099,8 @@
 }
 
 .preferencesFooter > small {
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .savePreferencesButton {
@@ -1110,10 +1110,10 @@
   padding: 0 density(4);
   border: border(primary-strong);
   border-radius: radius(3);
-  background: palette(primary-dark);
-  color: palette(light-light);
+  background: palette(primary.dark);
+  color: palette(light.light);
   font: inherit;
-  @ds-typo (compact-strong);
+  @ds-typo(compact-strong);
   cursor: pointer;
   box-shadow: shadow(float);
   transition: transform 150ms ease, opacity 150ms ease;
@@ -1134,11 +1134,11 @@
 }
 
 .runBadge {
-  @ds-surface (card);
+  @ds-surface(card);
   padding: density(1) density(2);
   border-radius: radius(pill);
-  color: palette(tertiary-main);
-  @ds-typo (meta-strong);
+  color: palette(tertiary.main);
+  @ds-typo(meta-strong);
 }
 
 .optimizationMetrics {
@@ -1148,25 +1148,25 @@
 }
 
 .optimizationMetric {
-  @ds-surface (panel);
+  @ds-surface(panel);
   min-width: 0;
   padding: density(4);
   border-radius: radius(3);
-  background: linear-gradient(145deg, palette(light-light), palette(light-light));
+  background: linear-gradient(145deg, palette(light.light), palette(light.light));
 }
 
 .optimizationMetric span,
 .optimizationMetric small {
   display: block;
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .optimizationMetric strong {
   display: block;
   margin: density(2) 0 density(2);
-  color: palette(dark-main);
-  @ds-typo (figure);
+  color: palette(dark.main);
+  @ds-typo(figure);
 }
 
 .optimizationMetric small {
@@ -1185,8 +1185,8 @@
 .efficiencyItem {
   padding: density(4);
   border-radius: radius(3);
-  background: palette(dark-main);
-  color: palette(light-light);
+  background: palette(dark.main);
+  color: palette(light.light);
 }
 
 .efficiencyItem > div:first-child {
@@ -1197,20 +1197,20 @@
 }
 
 .efficiencyItem span {
-  color: palette(primary-light);
-  @ds-typo (label);
+  color: palette(primary.light);
+  @ds-typo(label);
 }
 
 .efficiencyItem strong {
-  color: palette(primary-main);
-  @ds-typo (title-lg);
+  color: palette(primary.main);
+  @ds-typo(title-lg);
 }
 
 .efficiencyItem small {
   display: block;
   margin-top: density(3);
-  color: palette(primary-main);
-  @ds-typo (meta);
+  color: palette(primary.main);
+  @ds-typo(meta);
 }
 
 .progressTrack {
@@ -1218,14 +1218,14 @@
   margin-top: density(4);
   overflow: hidden;
   border-radius: radius(pill);
-  background: palette(light-light, 0.12);
+  background: palette(light.light, 0.12);
 }
 
 .progressTrack span {
   display: block;
   height: 100%;
   border-radius: inherit;
-  background: linear-gradient(90deg, palette(primary-main), palette(primary-main));
+  background: linear-gradient(90deg, palette(primary.main), palette(primary.main));
   transition: width 500ms ease;
 }
 
@@ -1237,120 +1237,120 @@
 }
 
 .relevanceStrip span {
-  @ds-surface (card);
+  @ds-surface(card);
   padding: density(1) density(2);
   border-radius: radius(2);
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .relevanceStrip strong {
-  color: palette(dark-main);
-  @ds-typo (caption);
+  color: palette(dark.main);
+  @ds-typo(caption);
 }
 
 .optimizationEmpty {
   padding: density(6) density(4);
   border: border(dashed-subtle);
   border-radius: radius(3);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
   text-align: center;
-  @ds-typo (compact);
+  @ds-typo(compact);
 }
 
 .editorialPanel {
   margin-top: xs(density(4)) md(density(5));
 }
 
-.candidateWorkspace { background: palette(light-light); }
+.candidateWorkspace { background: palette(light.light); }
 .candidateHero { display: flex; flex-direction: xs(column) md(row); justify-content: space-between; align-items: xs(stretch) md(center); gap: density(5); }
-.candidateHero h2 { margin: density(1) 0; color: palette(dark-main); @ds-typo (display); }
-.candidateHero p:not(.kicker) { max-width: 62ch; margin: 0; color: palette(tertiary-main); @ds-typo(small); }
+.candidateHero h2 { margin: density(1) 0; color: palette(dark.main); @ds-typo(display); }
+.candidateHero p:not(.kicker) { max-width: 62ch; margin: 0; color: palette(tertiary.main); @ds-typo(small); }
 .candidateHeroActions { display: flex; flex: none; flex-wrap: xs(wrap) md(nowrap); align-items: center; gap: density(2); }
 .candidateHeroActions > * { flex: xs(1 1 auto) md(none); }
-.candidateHeroActions a { @ds-button(outlined primary 2); display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding-inline: density(4); border-radius: radius(3); color: palette(primary-dark); @ds-typo (compact-strong); text-decoration: none; white-space: nowrap; }
+.candidateHeroActions a { @ds-button(outlined primary 2); display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding-inline: density(4); border-radius: radius(3); color: palette(primary.dark); @ds-typo(compact-strong); text-decoration: none; white-space: nowrap; }
 .candidateHeroActions .evaluateButton { width: auto; box-shadow: none; white-space: nowrap; }
-.candidateStageLinks { display: flex; flex-wrap: wrap; align-items: center; gap: density(3); margin-top: density(4); padding-bottom: density(4); border-bottom: border(hairline); color: palette(tertiary-main); @ds-typo(small); }
-.candidateStageLinks a { @ds-typo (emphasis); color: palette(primary-dark); text-decoration: none; }
+.candidateStageLinks { display: flex; flex-wrap: wrap; align-items: center; gap: density(3); margin-top: density(4); padding-bottom: density(4); border-bottom: border(hairline); color: palette(tertiary.main); @ds-typo(small); }
+.candidateStageLinks a { @ds-typo(emphasis); color: palette(primary.dark); text-decoration: none; }
 .candidateStageLinks a:hover { text-decoration: underline; }
-.candidateAiDetails { @ds-surface (panel); margin-top: density(3); padding: density(2) density(3); border-radius: radius(2); background: palette(surface-main, 0.35); }
-.candidateAiDetails > summary { @ds-button (link); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(2); min-height: 40px; @ds-typo (small-strong); }
-.candidateAiDetails > summary span { color: palette(tertiary-main); @ds-typo (caption); }
-.candidateAiDetails > p { margin: density(3) 0; color: palette(tertiary-main); @ds-typo(small); }
+.candidateAiDetails { @ds-surface(panel); margin-top: density(3); padding: density(2) density(3); border-radius: radius(2); background: palette(surface.main, 0.35); }
+.candidateAiDetails > summary { @ds-button(link); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(2); min-height: 40px; @ds-typo(small-strong); }
+.candidateAiDetails > summary span { color: palette(tertiary.main); @ds-typo(caption); }
+.candidateAiDetails > p { margin: density(3) 0; color: palette(tertiary.main); @ds-typo(small); }
 .candidateAiDetails .reevaluateButton { margin-top: density(3); }
 .candidateQueueControls { margin-top: density(5); }
 .candidateViewButtons { display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) md(repeat(3, minmax(0, 1fr))); gap: density(2); }
-.candidateViewButtons button { @ds-button (secondary); display: flex; align-items: center; justify-content: space-between; gap: density(2); min-height: 56px; padding: density(3) density(4); border-radius: radius(2); font: inherit; @ds-typo (small-strong); text-align: left; }
-.candidateViewButtons button:hover { border-color: palette(primary-main, 0.5); }
-.candidateViewButtons button.candidateViewActive { border-color: palette(primary-main); background: palette(primary-main, 0.1); }
-.candidateViewButtons button span { display: inline-grid; min-width: 30px; min-height: 30px; padding-inline: density(1); place-items: center; border-radius: radius(full); background: palette(dark-main, 0.07); color: palette(primary-dark); @ds-typo(caption); }
-.candidateToolbar { @ds-surface (panel); margin-top: density(3); padding: density(3); border-radius: radius(3); background: palette(surface-main, 0.3); }
+.candidateViewButtons button { @ds-button(secondary); display: flex; align-items: center; justify-content: space-between; gap: density(2); min-height: 56px; padding: density(3) density(4); border-radius: radius(2); font: inherit; @ds-typo(small-strong); text-align: left; }
+.candidateViewButtons button:hover { border-color: palette(primary.main, 0.5); }
+.candidateViewButtons button.candidateViewActive { border-color: palette(primary.main); background: palette(primary.main, 0.1); }
+.candidateViewButtons button span { display: inline-grid; min-width: 30px; min-height: 30px; padding-inline: density(1); place-items: center; border-radius: radius(pill); background: palette(dark.main, 0.07); color: palette(primary.dark); @ds-typo(caption); }
+.candidateToolbar { @ds-surface(panel); margin-top: density(3); padding: density(3); border-radius: radius(3); background: palette(surface.main, 0.3); }
 .candidateToolbarTop { display: flex; flex-wrap: wrap; align-items: end; gap: density(3); }
 .candidateSearchField, .candidateSortField { display: grid; gap: density(1); }
 .candidateSearchField { flex: 1 1 280px; }
 .candidateSortField { flex: 0 1 195px; }
-.candidateSearchField > span, .candidateSortField > span, .candidateFilterGrid label > span { color: palette(tertiary-main); @ds-typo (label); }
-.candidateSearchField input, .candidateSortField select, .candidateFilterGrid select, .candidateFilterGrid input[type="number"] { @ds-input(outlined primary 2); box-sizing: border-box; width: 100%; min-height: 44px; padding-inline: density(3); border-color: palette(dark-main, 0.16); background: palette(light-light); color: palette(dark-main); font: inherit; @ds-typo(small); }
+.candidateSearchField > span, .candidateSortField > span, .candidateFilterGrid label > span { color: palette(tertiary.main); @ds-typo(label); }
+.candidateSearchField input, .candidateSortField select, .candidateFilterGrid select, .candidateFilterGrid input[type="number"] { @ds-input(outlined primary 2); box-sizing: border-box; width: 100%; min-height: 44px; padding-inline: density(3); border-color: palette(dark.main, 0.16); background: palette(light.light); color: palette(dark.main); font: inherit; @ds-typo(small); }
 .candidateToolbarTop .clearStoryFiltersButton { min-height: 44px; padding-inline: density(3); }
 .candidateFilterDetails { margin-top: density(2); }
-.candidateFilterDetails > summary { @ds-button (link); display: inline-flex; align-items: center; gap: density(2); min-height: 40px; @ds-typo (small-strong); }
-.candidateFilterDetails > summary span { padding: density(1) density(2); border-radius: radius(full); background: palette(primary-main, 0.1); color: palette(primary-dark); @ds-typo(caption); }
+.candidateFilterDetails > summary { @ds-button(link); display: inline-flex; align-items: center; gap: density(2); min-height: 40px; @ds-typo(small-strong); }
+.candidateFilterDetails > summary span { padding: density(1) density(2); border-radius: radius(pill); background: palette(primary.main, 0.1); color: palette(primary.dark); @ds-typo(caption); }
 .candidateFilterGrid { display: grid; grid-template-columns: xs(1fr) sm(repeat(2, minmax(0, 1fr))) lg(repeat(3, minmax(0, 1fr))); gap: density(3); padding-top: density(3); border-top: border(hairline); }
 .candidateFilterGrid label { display: grid; align-content: start; gap: density(1); min-width: 0; }
 .candidateFilterGrid label.candidateFloorControl { display: flex; align-items: center; gap: density(2); min-height: 44px; cursor: pointer; }
-.candidateFloorControl input { width: 18px; height: 18px; accent-color: palette(primary-main); }
-.candidateFilterDetails > p { margin: density(3) 0 0; color: palette(tertiary-main); @ds-typo(caption); }
+.candidateFloorControl input { width: 18px; height: 18px; accent-color: palette(primary.main); }
+.candidateFilterDetails > p { margin: density(3) 0 0; color: palette(tertiary.main); @ds-typo(caption); }
 .candidateActiveFilters { display: flex; flex-wrap: wrap; gap: density(1); margin-top: density(2); }
-.candidateActiveFilters span { padding: density(1) density(2); border-radius: radius(full); background: palette(primary-main, 0.09); color: palette(primary-dark); @ds-typo(caption); }
+.candidateActiveFilters span { padding: density(1) density(2); border-radius: radius(pill); background: palette(primary.main, 0.09); color: palette(primary.dark); @ds-typo(caption); }
 .candidateResultsHeading { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: density(3); margin: density(6) 0 density(3); }
-.candidateResultsHeading h3 { margin: 0; color: palette(dark-main); @ds-typo (title); }
-.candidateResultsHeading p { margin: density(1) 0 0; color: palette(tertiary-main); @ds-typo(small); }
-.candidateResultsHeading > span { color: palette(primary-dark); @ds-typo (small-strong); white-space: nowrap; }
+.candidateResultsHeading h3 { margin: 0; color: palette(dark.main); @ds-typo(title); }
+.candidateResultsHeading p { margin: density(1) 0 0; color: palette(tertiary.main); @ds-typo(small); }
+.candidateResultsHeading > span { color: palette(primary.dark); @ds-typo(small-strong); white-space: nowrap; }
 .candidateCardList { display: grid; gap: density(3); }
-.candidateCard { @ds-surface (panel); display: grid; grid-template-columns: xs(1fr) lg(minmax(0, 1fr) 230px); gap: density(3) density(5); padding: density(4); border-radius: radius(3); }
-.candidateCard:hover { border-color: palette(primary-main, 0.35); }
-.candidateCard.candidateCardSelected { border-color: palette(primary-main); background: palette(primary-main, 0.045); }
+.candidateCard { @ds-surface(panel); display: grid; grid-template-columns: xs(1fr) lg(minmax(0, 1fr) 230px); gap: density(3) density(5); padding: density(4); border-radius: radius(3); }
+.candidateCard:hover { border-color: palette(primary.main, 0.35); }
+.candidateCard.candidateCardSelected { border-color: palette(primary.main); background: palette(primary.main, 0.045); }
 .candidateCardMain { display: flex; gap: density(3); min-width: 0; }
 .candidateCardSelect, .candidateCardSelectPlaceholder { flex: 0 0 22px; padding-top: density(1); }
-.candidateCardSelect input { width: 20px; height: 20px; margin: 0; accent-color: palette(primary-main); cursor: pointer; }
+.candidateCardSelect input { width: 20px; height: 20px; margin: 0; accent-color: palette(primary.main); cursor: pointer; }
 .candidateCardContent { min-width: 0; }
 .candidateCardMeta, .candidateCardBadges { display: flex; flex-wrap: wrap; align-items: center; gap: density(1) density(2); }
-.candidateCardMeta { color: palette(tertiary-main); @ds-typo(caption); }
-.candidateCardContent h3 { margin: density(2) 0; color: palette(dark-main); @ds-typo (title-sm); }
+.candidateCardMeta { color: palette(tertiary.main); @ds-typo(caption); }
+.candidateCardContent h3 { margin: density(2) 0; color: palette(dark.main); @ds-typo(title-sm); }
 .candidateCardContent h3 a, .candidateCardContent h3 button { color: inherit; text-decoration: none; }
-.candidateCardContent h3 button { @ds-button (text); padding: 0; font: inherit; text-align: left; }
-.candidateCardContent h3 a:hover, .candidateCardContent h3 button:not(:disabled):hover { color: palette(primary-dark); text-decoration: underline; }
+.candidateCardContent h3 button { @ds-button(text); padding: 0; font: inherit; text-align: left; }
+.candidateCardContent h3 a:hover, .candidateCardContent h3 button:not(:disabled):hover { color: palette(primary.dark); text-decoration: underline; }
 .candidateCardContent h3 button:disabled { cursor: default; opacity: 0.6; }
-.candidateCardContent h3 a span { @ds-typo (small); color: palette(tertiary-main); }
-.candidateCardBadges > span:not(.tableBadge) { padding: density(1) density(2); border-radius: radius(full); background: palette(surface-main); color: palette(tertiary-main); @ds-typo(caption); }
-.candidateCardReason { margin: density(2) 0 0; color: palette(tertiary-main); @ds-typo(small); }
-.candidateCardWarning { margin: density(2) 0 0; color: palette(error-main); @ds-typo(caption); }
+.candidateCardContent h3 a span { @ds-typo(small); color: palette(tertiary.main); }
+.candidateCardBadges > span:not(.tableBadge) { padding: density(1) density(2); border-radius: radius(pill); background: palette(surface.main); color: palette(tertiary.main); @ds-typo(caption); }
+.candidateCardReason { margin: density(2) 0 0; color: palette(tertiary.main); @ds-typo(small); }
+.candidateCardWarning { margin: density(2) 0 0; color: palette(error.main); @ds-typo(caption); }
 .candidateCardSignals { display: grid; align-content: start; gap: density(3); padding-left: xs(0) lg(density(4)); border-left: xs(0) lg(border(hairline)); }
-.candidateSignal > div:first-child { display: flex; align-items: baseline; justify-content: space-between; gap: density(2); color: palette(tertiary-main); @ds-typo(caption); }
-.candidateSignal strong { color: palette(primary-dark); @ds-typo (small-strong); }
-.candidateSignalTrack { height: 5px; margin-top: density(1); border-radius: radius(full); background: palette(dark-main, 0.08); overflow: hidden; }
-.candidateSignalTrack span { display: block; height: 100%; border-radius: inherit; background: palette(primary-main); }
+.candidateSignal > div:first-child { display: flex; align-items: baseline; justify-content: space-between; gap: density(2); color: palette(tertiary.main); @ds-typo(caption); }
+.candidateSignal strong { color: palette(primary.dark); @ds-typo(small-strong); }
+.candidateSignalTrack { height: 5px; margin-top: density(1); border-radius: radius(pill); background: palette(dark.main, 0.08); overflow: hidden; }
+.candidateSignalTrack span { display: block; height: 100%; border-radius: inherit; background: palette(primary.main); }
 .candidateCardActions { display: flex; grid-column: 1 / -1; flex-wrap: wrap; gap: density(2); padding-top: density(3); border-top: border(hairline); }
-.candidateCardActions button { @ds-button(outlined primary 2); min-height: 44px; padding-inline: density(3); color: palette(primary-dark); @ds-typo (label); cursor: pointer; }
+.candidateCardActions button { @ds-button(outlined primary 2); min-height: 44px; padding-inline: density(3); color: palette(primary.dark); @ds-typo(label); cursor: pointer; }
 .candidateCardActions button:disabled { cursor: not-allowed; opacity: 0.5; }
-.candidateShowMore { @ds-button(outlined primary 2); display: flex; align-items: center; justify-content: center; gap: density(2); width: 100%; min-height: 48px; margin-top: density(3); color: palette(primary-dark); @ds-typo (small-strong); cursor: pointer; }
-.candidateShowMore span { color: palette(tertiary-main); @ds-typo (caption); }
-.candidateEmpty { @ds-surface (dropzone); padding: density(7); border: border(dashed); border-radius: radius(3); background: palette(surface-main, 0.35); }
-.candidateEmpty strong { color: palette(dark-main); @ds-typo (title-sm); }
-.candidateEmpty p { margin: density(2) 0; color: palette(tertiary-main); @ds-typo(small); }
-.candidateEmpty a { @ds-typo (emphasis); color: palette(primary-dark); }
+.candidateShowMore { @ds-button(outlined primary 2); display: flex; align-items: center; justify-content: center; gap: density(2); width: 100%; min-height: 48px; margin-top: density(3); color: palette(primary.dark); @ds-typo(small-strong); cursor: pointer; }
+.candidateShowMore span { color: palette(tertiary.main); @ds-typo(caption); }
+.candidateEmpty { @ds-surface(dropzone); padding: density(7); border: border(dashed); border-radius: radius(3); background: palette(surface.main, 0.35); }
+.candidateEmpty strong { color: palette(dark.main); @ds-typo(title-sm); }
+.candidateEmpty p { margin: density(2) 0; color: palette(tertiary.main); @ds-typo(small); }
+.candidateEmpty a { @ds-typo(emphasis); color: palette(primary.dark); }
 .candidateDetailedTable { margin-top: density(5); border: border(hairline); border-radius: radius(3); }
-.candidateDetailedTable > summary { @ds-button (link); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(2); min-height: 48px; padding: density(2) density(4); @ds-typo (small-strong); }
-.candidateDetailedTable > summary span { color: palette(tertiary-main); @ds-typo (caption); }
+.candidateDetailedTable > summary { @ds-button(link); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(2); min-height: 48px; padding: density(2) density(4); @ds-typo(small-strong); }
+.candidateDetailedTable > summary span { color: palette(tertiary.main); @ds-typo(caption); }
 .candidateDetailedTable .storyTableShell { border: 0; border-top: border(hairline); border-radius: 0 0 radius(3) radius(3); }
 
 .aiBadge {
-  @ds-surface (card);
+  @ds-surface(card);
   padding: density(1) density(2);
   border: border(info);
   border-radius: radius(pill);
-  color: palette(info-main);
-  @ds-typo (meta-strong);
+  color: palette(info.main);
+  @ds-typo(meta-strong);
 }
 
 .editorialIntro {
@@ -1366,14 +1366,14 @@
 .editorialIntro small {
   display: block;
   margin: 0;
-  color: palette(tertiary-main);
-  @ds-typo (compact);
+  color: palette(tertiary.main);
+  @ds-typo(compact);
 }
 
 .editorialIntro small {
   margin-top: density(2);
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .evaluateButton {
@@ -1384,10 +1384,10 @@
   padding: 0 density(4);
   border: border(info-strong);
   border-radius: radius(3);
-  background: palette(info-dark);
-  color: palette(light-light);
+  background: palette(info.dark);
+  color: palette(light.light);
   font: inherit;
-  @ds-typo (compact-strong);
+  @ds-typo(compact-strong);
   cursor: pointer;
   box-shadow: shadow(float-info);
   transition: transform 150ms ease, opacity 150ms ease;
@@ -1418,9 +1418,9 @@
   padding: 0 density(4);
   border: border(1);
   border-radius: radius(3);
-  background: palette(light-light);
-  color: palette(info-dark);
-  @ds-typo (small-strong);
+  background: palette(light.light);
+  color: palette(info.dark);
+  @ds-typo(small-strong);
   cursor: pointer;
 }
 
@@ -1436,7 +1436,7 @@
 }
 
 .aiRunSummary {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   flex-wrap: wrap;
   justify-content: space-between;
@@ -1444,17 +1444,17 @@
   margin-top: density(3);
   padding: density(3);
   border-radius: radius(3);
-  color: palette(info-main);
-  @ds-typo (meta);
+  color: palette(info.main);
+  @ds-typo(meta);
 }
 
 .aiRunSummary strong {
-  color: palette(info-dark);
+  color: palette(info.dark);
   text-transform: capitalize;
 }
 
 .reviewToolbar {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   align-items: xs(stretch) md(center);
   flex-wrap: xs(wrap) md(nowrap);
@@ -1471,22 +1471,22 @@
 }
 
 .selectAllControl {
-  @ds-button (link);
+  @ds-button(link);
   gap: density(1);
-  @ds-typo (label);
+  @ds-typo(label);
 }
 
 .selectAllControl input,
 .storyCheckbox {
   width: 17px;
   height: 17px;
-  accent-color: palette(primary-dark);
+  accent-color: palette(primary.dark);
   cursor: pointer;
 }
 
 .selectionCount {
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .reviewActions {
@@ -1502,7 +1502,7 @@
   padding: 0 density(3);
   border-radius: radius(2);
   font: inherit;
-  @ds-typo (label);
+  @ds-typo(label);
   cursor: pointer;
   transition: transform 150ms ease, opacity 150ms ease;
 }
@@ -1518,11 +1518,11 @@
 
 .rejectStoriesButton {
 
-  @ds-button (danger-outline);
+  @ds-button(danger-outline);
 }
 
 .approveStoriesButton {
-  @ds-button (primary);
+  @ds-button(primary);
   box-shadow: shadow(float);
 }
 
@@ -1539,9 +1539,9 @@
   @ds-button(outlined neutral 2);
   min-height: density(7);
   padding: 0 density(3);
-  border-color: palette(secondary-main);
-  color: palette(secondary-dark);
-  @ds-typo (label);
+  border-color: palette(secondary.main);
+  color: palette(secondary.dark);
+  @ds-typo(label);
   cursor: pointer;
 }
 
@@ -1576,15 +1576,15 @@
 
 .storyWorkspaceHeader h3,
 .tableViewHeading h3 {
-  color: palette(dark-main);
-  @ds-typo (title-sm);
+  color: palette(dark.main);
+  @ds-typo(title-sm);
 }
 
 .storyWorkspaceHeader p,
 .tableViewHeading p {
   margin-top: density(2);
-  color: palette(tertiary-main);
-  @ds-typo (meta);
+  color: palette(tertiary.main);
+  @ds-typo(meta);
 }
 
 .quickViews {
@@ -1595,23 +1595,23 @@
 }
 
 .quickViews button {
-  @ds-button (chip);
+  @ds-button(chip);
   display: inline-flex;
   align-items: center;
   gap: density(1);
   min-height: 32px;
   padding: 0 density(3);
   border: border(subtle);
-  border-radius: radius(full);
-  color: palette(tertiary-main);
+  border-radius: radius(pill);
+  color: palette(tertiary.main);
   font: inherit;
-  @ds-typo (label);
+  @ds-typo(label);
   transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
 }
 
 .quickViews button:hover,
 .quickViews button:focus-visible {
-  border-color: palette(secondary-main, 0.5);
+  border-color: palette(secondary.main, 0.5);
   outline: 0;
 }
 
@@ -1621,20 +1621,20 @@
   height: 19px;
   padding: 0 density(1);
   place-items: center;
-  border-radius: radius(full);
-  background: palette(dark-main, 0.08);
-  @ds-typo (fine);
+  border-radius: radius(pill);
+  background: palette(dark.main, 0.08);
+  @ds-typo(fine);
 }
 
 .quickViews .quickViewActive {
-  border-color: palette(secondary-main);
-  background: palette(secondary-main);
-  color: palette(secondary-contrast);
+  border-color: palette(secondary.main);
+  background: palette(secondary.main);
+  color: palette(secondary.contrast);
 }
 
 .quickViews .quickViewActive span {
-  background: palette(secondary-contrast, 0.22);
-  color: palette(secondary-contrast);
+  background: palette(secondary.contrast, 0.22);
+  color: palette(secondary.contrast);
 }
 
 .tableViewHeading {
@@ -1642,12 +1642,12 @@
 }
 
 .tableViewHeading > span {
-  color: palette(tertiary-main);
-  @ds-typo (meta-strong);
+  color: palette(tertiary.main);
+  @ds-typo(meta-strong);
 }
 
 .storyFilterBar {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   align-items: xs(stretch) md(end);
   flex-wrap: wrap;
@@ -1677,8 +1677,8 @@
 }
 
 .storyFilterField > span {
-  color: palette(tertiary-main);
-  @ds-typo (fine-strong);
+  color: palette(tertiary.main);
+  @ds-typo(fine-strong);
 }
 
 .storyFilterField select,
@@ -1688,10 +1688,10 @@
   min-height: 34px;
   border: border(subtle);
   border-radius: radius(2);
-  background: palette(light-light);
-  color: palette(dark-main);
+  background: palette(light.light);
+  color: palette(dark.main);
   font: inherit;
-  @ds-typo (caption);
+  @ds-typo(caption);
 }
 
 .storyFilterField select {
@@ -1710,16 +1710,16 @@
 .storyFilterField input:focus {
   outline: border(focus);
   outline-offset: space(1);
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
 }
 
 .topicFloorControl {
-  @ds-button (link);
+  @ds-button(link);
   display: inline-flex;
   align-items: center;
   gap: density(1);
   min-height: xs(38px) sm(34px);
-  @ds-typo (meta-strong);
+  @ds-typo(meta-strong);
   white-space: nowrap;
 }
 
@@ -1727,7 +1727,7 @@
   width: 16px;
   height: 16px;
   margin: 0;
-  accent-color: palette(primary-dark);
+  accent-color: palette(primary.dark);
   cursor: pointer;
 }
 
@@ -1737,10 +1737,10 @@
   padding: 0 density(2);
   border: border(subtle);
   border-radius: radius(2);
-  background: palette(light-light);
-  color: palette(tertiary-main);
+  background: palette(light.light);
+  color: palette(tertiary.main);
   font: inherit;
-  @ds-typo (meta-strong);
+  @ds-typo(meta-strong);
   cursor: pointer;
 }
 
@@ -1749,19 +1749,19 @@
 }
 
 .storyFilterCount {
-  color: palette(primary-dark);
-  @ds-typo (meta-strong);
+  color: palette(primary.dark);
+  @ds-typo(meta-strong);
   white-space: nowrap;
 }
 
 .storyFilterHint {
   flex-basis: 100%;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .storyTableShell {
-  @ds-surface (card);
+  @ds-surface(card);
   max-width: 100%;
   overflow: auto;
   border-radius: radius(3);
@@ -1773,8 +1773,8 @@
   min-width: 1815px;
   border-collapse: separate;
   border-spacing: 0;
-  color: palette(primary-dark);
-  @ds-typo (meta);
+  color: palette(primary.dark);
+  @ds-typo(meta);
 }
 
 .storyTable th {
@@ -1783,14 +1783,14 @@
   z-index: 1;
   padding: 0;
   border-bottom: border(subtle);
-  background: palette(light-light);
-  color: palette(tertiary-main);
+  background: palette(light.light);
+  color: palette(tertiary.main);
   text-align: left;
   white-space: nowrap;
 }
 
 .tableHeaderLabel {
-  @ds-typo (emphasis);
+  @ds-typo(emphasis);
   display: flex;
   min-height: 43px;
   align-items: center;
@@ -1805,7 +1805,7 @@
   max-width: 180px;
   padding: density(3) density(2);
   border-bottom: border(light);
-  background: palette(light-light);
+  background: palette(light.light);
   vertical-align: top;
 }
 
@@ -1814,11 +1814,11 @@
 }
 
 .storyTable tbody tr:hover td {
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .storyTable .selectedTableRow td {
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .selectionColumn {
@@ -1828,12 +1828,12 @@
 }
 
 .unavailableSelection {
-  color: palette(surface-dark);
+  color: palette(surface.dark);
 }
 
 .dateCell {
   width: 92px;
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
   white-space: nowrap;
 }
 
@@ -1845,12 +1845,12 @@
 
 .storyTitleCell > a, .storyTitleCell > button {
   display: block;
-  color: palette(dark-main);
-  @ds-typo (label);
+  color: palette(dark.main);
+  @ds-typo(label);
   text-decoration: none;
 }
 
-.storyTitleCell > button { @ds-button (text); padding: 0; text-align: left; }
+.storyTitleCell > button { @ds-button(text); padding: 0; text-align: left; }
 .storyTitleCell > a:hover, .storyTitleCell > button:not(:disabled):hover {
   text-decoration: underline;
   text-underline-offset: 3px;
@@ -1859,24 +1859,24 @@
 
 .aiResearchStoryBadge {
   margin-top: density(1);
-  background: palette(primary-main);
-  color: palette(primary-contrast);
+  background: palette(primary.main);
+  color: palette(primary.contrast);
 }
 
 .storyTitleCell > small {
   display: -webkit-box;
   margin-top: density(2);
   overflow: hidden;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
   -webkit-box-orient: vertical;
   -webkit-line-clamp: 2;
 }
 
 .sourceCell {
-  @ds-typo (emphasis);
+  @ds-typo(emphasis);
   min-width: 130px;
-  color: palette(primary-dark);
+  color: palette(primary.dark);
 }
 
 .sourceCellContent {
@@ -1893,13 +1893,13 @@
 }
 
 .scoreCell {
-  @ds-typo (emphasis);
-  color: palette(primary-dark);
+  @ds-typo(emphasis);
+  color: palette(primary.dark);
   font-variant-numeric: tabular-nums;
 }
 
 .accentScoreCell {
-  color: palette(info-dark);
+  color: palette(info.dark);
 }
 
 .growthScoreCell {
@@ -1915,7 +1915,7 @@
 }
 
 .growthScoreSummary > strong {
-  color: palette(primary-dark);
+  color: palette(primary.dark);
   font-variant-numeric: tabular-nums;
 }
 
@@ -1924,11 +1924,11 @@
 }
 
 .growthScoreDetails summary {
-  @ds-button (link-accent);
+  @ds-button(link-accent);
   display: inline-flex;
   align-items: center;
   gap: density(1);
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
   list-style: none;
 }
 
@@ -1937,7 +1937,7 @@
 }
 
 .growthScoreDetails summary::after {
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
   content: "⌄";
 }
 
@@ -1958,14 +1958,14 @@
   border: border(1);
   border-radius: radius(2);
   box-shadow: shadow(3);
-  color: palette(dark-main);
+  color: palette(dark.main);
   text-align: left;
 }
 
 .growthScorePopover p {
   margin: 0 0 density(2);
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .growthScorePopover dl {
@@ -1984,16 +1984,16 @@
 .growthScorePopover dt,
 .growthScorePopover dd {
   margin: 0;
-  @ds-typo (fine);
+  @ds-typo(fine);
 }
 
 .growthScorePopover dt {
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 
 .growthScorePopover dd {
-  @ds-typo (fine-strong);
-  color: palette(primary-dark);
+  @ds-typo(fine-strong);
+  color: palette(primary.dark);
   font-variant-numeric: tabular-nums;
 }
 
@@ -2007,9 +2007,9 @@
 .tableRiskFlags span {
   padding: density(1);
   border-radius: radius(1);
-  background: palette(light-light);
-  color: palette(error-main);
-  @ds-typo (fine);
+  background: palette(light.light);
+  color: palette(error.main);
+  @ds-typo(fine);
 }
 
 .storySourceLink {
@@ -2018,8 +2018,8 @@
   align-items: center;
   gap: density(1);
   margin-top: density(2);
-  color: palette(primary-main);
-  @ds-typo (fine);
+  color: palette(primary.main);
+  @ds-typo(fine);
   text-decoration: none;
 }
 
@@ -2031,11 +2031,11 @@
 
 .storySourceLink strong {
   flex: 0 0 auto;
-  @ds-typo (fine);
+  @ds-typo(fine);
 }
 
 .storySourceLink:hover {
-  color: palette(primary-dark);
+  color: palette(primary.dark);
   text-decoration: underline;
   text-underline-offset: 2px;
 }
@@ -2044,28 +2044,28 @@
   display: inline-flex;
   padding: density(1) density(2);
   border-radius: radius(2);
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
   white-space: nowrap;
 }
 
 .tableBadgeNeutral {
-  background: palette(light-light);
-  color: palette(tertiary-main);
+  background: palette(light.light);
+  color: palette(tertiary.main);
 }
 
 .tableBadgePositive {
-  background: palette(surface-light);
-  color: palette(primary-dark);
+  background: palette(surface.light);
+  color: palette(primary.dark);
 }
 
 .tableBadgeWarning {
-  background: palette(warning-light);
-  color: palette(warning-dark);
+  background: palette(warning.light);
+  color: palette(warning.dark);
 }
 
 .tableBadgeNegative {
-  background: palette(error-light);
-  color: palette(error-main);
+  background: palette(error.light);
+  color: palette(error.main);
 }
 
 .publicationStatusCell {
@@ -2079,8 +2079,8 @@
 }
 
 .publicationNotTracked {
-  color: palette(tertiary-main);
-  @ds-typo (fine-strong);
+  color: palette(tertiary.main);
+  @ds-typo(fine-strong);
   white-space: nowrap;
 }
 
@@ -2091,7 +2091,7 @@
   gap: density(1);
 }
 
-.publicationQuickControl strong { color: palette(dark-main); @ds-typo(small); }
+.publicationQuickControl strong { color: palette(dark.main); @ds-typo(small); }
 
 .publicationQuickControl label {
   display: grid;
@@ -2100,8 +2100,8 @@
 
 .publicationQuickControl span,
 .publicationQuickControl small {
-  color: palette(tertiary-main);
-  @ds-typo (caption);
+  color: palette(tertiary.main);
+  @ds-typo(caption);
 }
 
 .publicationQuickControl select {
@@ -2111,17 +2111,17 @@
   padding: 0 density(2);
   border: border(subtle);
   border-radius: radius(2);
-  background: palette(light-light);
-  color: palette(primary-dark);
+  background: palette(light.light);
+  color: palette(primary.dark);
   font: inherit;
-  @ds-typo (small-strong);
+  @ds-typo(small-strong);
   cursor: pointer;
 }
 
 .publicationQuickControl select:focus {
   outline: border(focus);
   outline-offset: space(1);
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
 }
 
 .publicationQuickControl select:disabled {
@@ -2144,17 +2144,17 @@
 .contentStatusCell small {
   max-width: 150px;
   overflow: hidden;
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
   text-overflow: ellipsis;
 }
 
 .contentStatusCell .enrichmentComplete {
-  color: palette(primary-dark);
+  color: palette(primary.dark);
 }
 
 .contentStatusCell .enrichmentProblem {
-  color: palette(error-main);
+  color: palette(error.main);
 }
 
 .contentActionsCell {
@@ -2171,7 +2171,7 @@
   padding: 0 density(2);
   border-radius: radius(2);
   font: inherit;
-  @ds-typo (fine-strong);
+  @ds-typo(fine-strong);
   white-space: nowrap;
   cursor: pointer;
   transition: transform 150ms ease, opacity 150ms ease;
@@ -2179,27 +2179,27 @@
 
 .prepareTableButton {
 
-  @ds-button (primary);
+  @ds-button(primary);
 }
 
 .viewContentButton {
-  @ds-button (secondary);
+  @ds-button(secondary);
   border: border(subtle);
 }
 
 .creativeStudioButton {
-  @ds-button (warning);
+  @ds-button(warning);
   border: border(warning-dark);
 }
 
 .promoteStoryButton {
 
-  @ds-button (info);
+  @ds-button(info);
 }
 
 .clearDuplicateButton {
 
-  @ds-button (neutral);
+  @ds-button(neutral);
 }
 
 .prepareTableButton:hover:not(:disabled),
@@ -2224,14 +2224,14 @@
   z-index: 50;
   display: grid;
   padding: xs(density(4)) md(density(5));
-  background: palette(dark-main, 0.48);
+  background: palette(dark.main, 0.48);
   inset: 0;
   place-items: center;
   backdrop-filter: blur(6px);
 }
 
 .contentViewer {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   width: min(820px, 100%);
   max-height: xs(calc(100svh - 24px)) md(min(820px, calc(100svh - 48px)));
@@ -2257,26 +2257,26 @@
 }
 
 .contentViewerHeader p {
-  color: palette(tertiary-main);
-  @ds-typo (badge);
+  color: palette(tertiary.main);
+  @ds-typo(badge);
 }
 
 .contentViewerHeader h2 {
   max-width: 680px;
   margin-top: density(2);
-  color: palette(dark-main);
-  @ds-typo (title);
+  color: palette(dark.main);
+  @ds-typo(title);
 }
 
 .contentViewerHeader button {
-  @ds-button (secondary);
+  @ds-button(secondary);
   display: grid;
   width: 34px;
   height: 34px;
   flex: 0 0 auto;
   border: border(subtle);
   border-radius: radius(circle);
-  @ds-typo (icon-lg);
+  @ds-typo(icon-lg);
   place-items: center;
 }
 
@@ -2287,12 +2287,12 @@
   gap: density(1);
   padding: density(3) density(5);
   border-bottom: border(subtle);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .contentViewerMeta > span:not(.tableBadge) {
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .contentViewerWarning {
@@ -2300,17 +2300,17 @@
   gap: density(1);
   padding: density(3) density(5);
   border-bottom: border(1);
-  background: palette(warning-light);
-  color: palette(warning-dark);
+  background: palette(warning.light);
+  color: palette(warning.dark);
   flex-direction: column;
 }
 
 .contentViewerWarning strong {
-  @ds-typo (caption);
+  @ds-typo(caption);
 }
 
 .contentViewerWarning span {
-  @ds-typo (meta);
+  @ds-typo(meta);
 }
 
 .contentViewerBody {
@@ -2320,8 +2320,8 @@
 
 .contentViewerBody > p {
   margin: 0;
-  color: palette(dark-main);
-  @ds-typo (small);
+  color: palette(dark.main);
+  @ds-typo(small);
   white-space: pre-wrap;
 }
 
@@ -2333,12 +2333,12 @@
   gap: density(5);
   padding: density(4) density(5);
   border-top: border(subtle);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .contentViewerFooter a {
-  color: palette(primary-dark);
-  @ds-typo (meta-strong);
+  color: palette(primary.dark);
+  @ds-typo(meta-strong);
   text-decoration: none;
 }
 
@@ -2348,8 +2348,8 @@
 }
 
 .contentViewerFooter span {
-  color: palette(tertiary-main);
-  @ds-typo (fine);
+  color: palette(tertiary.main);
+  @ds-typo(fine);
 }
 
 .dangerPanel {
@@ -2357,8 +2357,8 @@
   grid-template-columns: xs(1fr) md(1fr minmax(360px, 0.8fr));
   gap: xs(density(4)) md(density(9));
   margin-top: xs(density(4)) md(density(5));
-  border-color: palette(error-main, 0.2);
-  background: palette(light-light, 0.86);
+  border-color: palette(error.main, 0.2);
+  background: palette(light.light, 0.86);
 }
 
 .dangerCopy h2 {
@@ -2368,8 +2368,8 @@
 .dangerCopy > p:last-child {
   max-width: 530px;
   margin: density(3) 0 0;
-  color: palette(error-main);
-  @ds-typo (compact);
+  color: palette(error.main);
+  @ds-typo(compact);
 }
 
 .dangerActions .field {
@@ -2378,11 +2378,11 @@
 
 .dangerButton {
 
-  @ds-button (danger-outline);
+  @ds-button(danger-outline);
 }
 
 .regenerateButton {
-  @ds-button (danger);
+  @ds-button(danger);
   flex: 1;
 }
 
@@ -2414,15 +2414,15 @@
 
 .ovwTitle {
   margin: 0;
-  color: palette(primary-main);
-  @ds-typo (h2);
+  color: palette(primary.main);
+  @ds-typo(h2);
 }
 
 .ovwDescription {
   margin: 0;
   max-width: 46rem;
-  color: palette(dark-main, 0.78);
-  @ds-typo (body);
+  color: palette(dark.main, 0.78);
+  @ds-typo(body);
   display: -webkit-box;
   -webkit-line-clamp: 2;
   -webkit-box-orient: vertical;
@@ -2444,7 +2444,7 @@
 
 .ovwPeriodButton {
   @ds-button(flat neutral 2);
-  @ds-typo (label);
+  @ds-typo(label);
   cursor: pointer;
 }
 
@@ -2455,13 +2455,13 @@
 
 .ovwPeriodButtonActive {
   @ds-button(contained primary 2);
-  @ds-typo (label);
+  @ds-typo(label);
 }
 
 .ovwFreshness {
   margin: 0;
-  color: palette(tertiary-main);
-  @ds-typo (caption);
+  color: palette(tertiary.main);
+  @ds-typo(caption);
 }
 
 .ovwHeaderActions {
@@ -2473,7 +2473,7 @@
 .ovwRefreshButton {
   @ds-button(outlined neutral 2);
   border-radius: radius(pill);
-  @ds-typo (label);
+  @ds-typo(label);
   cursor: pointer;
 }
 
@@ -2483,8 +2483,8 @@
 }
 
 .ovwConfigLink {
-  color: palette(primary-main);
-  @ds-typo (label);
+  color: palette(primary.main);
+  @ds-typo(label);
   text-decoration: none;
 }
 
@@ -2505,7 +2505,7 @@
   gap: density(1);
   padding: density(4);
   border: border(hairline);
-  background: palette(light-light, 0.82);
+  background: palette(light.light, 0.82);
   box-shadow: shadow(1);
 }
 
@@ -2521,29 +2521,29 @@
   width: density(5);
   height: density(5);
   border-radius: radius(2);
-  background: palette(primary-main, 0.14);
-  color: palette(primary-dark);
-  @ds-typo (caption);
+  background: palette(primary.main, 0.14);
+  color: palette(primary.dark);
+  @ds-typo(caption);
 }
 
 .ovwMetricLabel {
-  color: palette(dark-main, 0.7);
-  @ds-typo (eyebrow);
+  color: palette(dark.main, 0.7);
+  @ds-typo(eyebrow);
 }
 
 .ovwMetricValue {
-  color: palette(dark-main);
-  @ds-typo (h2);
+  color: palette(dark.main);
+  @ds-typo(h2);
 }
 
 .ovwMetricScope {
-  color: palette(tertiary-main);
-  @ds-typo (caption);
+  color: palette(tertiary.main);
+  @ds-typo(caption);
 }
 
 .ovwMetricLink {
-  color: palette(primary-main);
-  @ds-typo (label);
+  color: palette(primary.main);
+  @ds-typo(label);
   text-decoration: none;
 }
 
@@ -2553,8 +2553,8 @@
 
 .ovwMetricBreakdown {
   margin: density(1) 0 0;
-  color: palette(dark-main, 0.68);
-  @ds-typo (caption);
+  color: palette(dark.main, 0.68);
+  @ds-typo(caption);
 }
 
 .ovwSections {
@@ -2570,14 +2570,14 @@
   gap: density(3);
   padding: density(5);
   border: border(hairline);
-  background: palette(light-light, 0.82);
+  background: palette(light.light, 0.82);
   box-shadow: shadow(1);
 }
 
 .ovwSectionTitle {
   margin: 0;
-  color: palette(dark-main);
-  @ds-typo (h4);
+  color: palette(dark.main);
+  @ds-typo(h4);
 }
 
 .ovwSectionBody {
@@ -2597,9 +2597,9 @@
   border-radius: radius(2);
   background: linear-gradient(
     90deg,
-    palette(dark-main, 0.06),
-    palette(dark-main, 0.12),
-    palette(dark-main, 0.06)
+    palette(dark.main, 0.06),
+    palette(dark.main, 0.12),
+    palette(dark.main, 0.06)
   );
 }
 
@@ -2613,12 +2613,12 @@
 
 .ovwEmpty {
   margin: 0;
-  color: palette(tertiary-main);
-  @ds-typo (small);
+  color: palette(tertiary.main);
+  @ds-typo(small);
 }
 
 .ovwError {
-  @ds-surface (card);
+  @ds-surface(card);
   display: flex;
   flex-direction: xs(column) sm(row);
   align-items: xs(flex-start) sm(center);
@@ -2626,14 +2626,14 @@
   padding: density(3);
   border: border(error-soft);
   border-radius: radius(2);
-  background: palette(error-light, 0.16);
-  color: palette(error-dark);
-  @ds-typo (small);
+  background: palette(error.light, 0.16);
+  color: palette(error.dark);
+  @ds-typo(small);
 }
 
 .ovwRetryButton {
   @ds-button(flat primary 1);
-  @ds-typo (label);
+  @ds-typo(label);
   cursor: pointer;
 }
 
@@ -2664,18 +2664,18 @@
 }
 
 .ovwListPrimary {
-  color: palette(dark-main);
-  @ds-typo (small-strong);
+  color: palette(dark.main);
+  @ds-typo(small-strong);
 }
 
 .ovwListMeta {
-  color: palette(tertiary-main);
-  @ds-typo (caption);
+  color: palette(tertiary.main);
+  @ds-typo(caption);
 }
 
 .ovwListLink {
-  @ds-typo (emphasis);
-  color: palette(primary-main);
+  @ds-typo(emphasis);
+  color: palette(primary.main);
   text-decoration: none;
 }
 
@@ -2695,17 +2695,17 @@
   gap: density(1);
   padding: density(2);
   border-radius: radius(2);
-  background: palette(dark-main, 0.04);
+  background: palette(dark.main, 0.04);
 }
 
 .ovwStageValue {
-  color: palette(dark-main);
-  @ds-typo (h4);
+  color: palette(dark.main);
+  @ds-typo(h4);
 }
 
 .ovwStageLabel {
-  color: palette(tertiary-main);
-  @ds-typo (caption);
+  color: palette(tertiary.main);
+  @ds-typo(caption);
 }
 
 .ovwBadge {
@@ -2713,14 +2713,14 @@
   align-items: center;
   padding: density(1) density(2);
   border-radius: radius(pill);
-  background: palette(primary-main, 0.14);
-  color: palette(primary-dark);
-  @ds-typo (label);
+  background: palette(primary.main, 0.14);
+  color: palette(primary.dark);
+  @ds-typo(label);
 }
 
 .ovwBadgeMuted {
-  background: palette(dark-main, 0.08);
-  color: palette(dark-main, 0.7);
+  background: palette(dark.main, 0.08);
+  color: palette(dark.main, 0.7);
 }
 
 .storyMaterials {
@@ -2730,7 +2730,7 @@
   display: grid;
   gap: density(2);
   min-width: 0;
-  color: palette(neutral-main);
+  color: palette(neutral.main);
 }
 .storyMaterialForm {
   display: grid;
@@ -2761,7 +2761,7 @@
   @ds-surface(contained light);
   border-radius: radius(2);
   box-shadow: shadow(1);
-  color: palette(dark-main);
+  color: palette(dark.main);
   padding: density(2);
   display: grid;
   align-content: start;
@@ -2849,19 +2849,19 @@
   align-items: center;
   gap: density(2);
   @ds-typo(small);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 .bankSubjectHead strong {
   @ds-typo(small-strong);
-  color: palette(dark-main);
+  color: palette(dark.main);
 }
 .bankSubjectHead a {
-  color: palette(primary-dark);
+  color: palette(primary.dark);
 }
 .bankMeta {
   margin: 0;
   @ds-typo(caption);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 .bankTags {
   display: flex;
@@ -2890,11 +2890,11 @@
   margin-bottom: density(4);
   border: border(1);
   border-radius: radius(3);
-  color: palette(neutral-main);
+  color: palette(neutral.main);
   display: grid;
   gap: density(3);
 }
-.dailyPlanner h2 { @ds-typo(h5); color: palette(primary-main); }
+.dailyPlanner h2 { @ds-typo(h5); color: palette(primary.main); }
 .dailyPlanner h3 { @ds-typo(h6); }
 .dailyPlanner p, .dailyPlanner li { @ds-typo(body); }
 .dailyPlanner small { @ds-typo(caption); }
@@ -2908,8 +2908,8 @@
 .dailyPlannerControls label { display: grid; gap: density(1); @ds-typo(body); }
 .dailyPlannerControls input, .dailyPlannerControls select { @ds-input(outlined neutral); padding: density(2); border-radius: radius(2); width: 100%; }
 /* The auto-approve opt-in is a checkbox row, not a full-width field. */
-.dailyPlannerControls .dailyPreparationAutoApprove { display: flex; align-items: flex-start; gap: density(2); @ds-typo(caption); color: palette(dark-main); }
-.dailyPlannerControls .dailyPreparationAutoApprove input { width: auto; flex: none; margin: space(1) 0 0; padding: 0; border: 0; box-shadow: none; accent-color: palette(primary-main); }
+.dailyPlannerControls .dailyPreparationAutoApprove { display: flex; align-items: flex-start; gap: density(2); @ds-typo(caption); color: palette(dark.main); }
+.dailyPlannerControls .dailyPreparationAutoApprove input { width: auto; flex: none; margin: space(1) 0 0; padding: 0; border: 0; box-shadow: none; accent-color: palette(primary.main); }
 .dailyPlannerChoices { display: grid; grid-template-columns: xs(1fr) md(repeat(3, 1fr)); gap: density(3); }
 .dailyPlannerChoice {
   @ds-surface(flat primary);
@@ -2944,25 +2944,25 @@
 }
 .dailyPreparationStepButton {
   @ds-button(outlined primary);
-  @ds-typo (label);
+  @ds-typo(label);
   display: inline-flex;
   align-items: center;
   gap: density(2);
   padding: density(2) density(3);
-  border-radius: radius(full);
+  border-radius: radius(pill);
   white-space: nowrap;
   cursor: pointer;
   box-shadow: none;
   transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
 }
 .dailyPreparationStepButton span {
-  @ds-typo (fine);
+  @ds-typo(fine);
   display: inline-grid;
   min-width: 16px;
   height: 16px;
   place-items: center;
-  border-radius: radius(full);
-  background: palette(primary-light, 0.16);
+  border-radius: radius(pill);
+  background: palette(primary.light, 0.16);
 }
 /* A step in progress still gets the current-step highlight around the chip. */
 .dailyPreparationSteps li[aria-current="step"] .dailyPreparationStepButton {
@@ -2993,101 +2993,101 @@
    and "running" (palette(info-*), always blue) can look close to each other
    at a glance — accepted knowingly, not missed. */
 .dailyPreparationStepButton[data-step-status="done-open"] {
-  border-color: palette(primary-main);
-  background: palette(primary-light, 0.18);
-  color: palette(primary-dark);
+  border-color: palette(primary.main);
+  background: palette(primary.light, 0.18);
+  color: palette(primary.dark);
 }
 .dailyPreparationStepButton[data-step-status="done"] {
-  border-color: palette(primary-light);
-  background: palette(primary-light, 0.08);
-  color: palette(primary-dark);
+  border-color: palette(primary.light);
+  background: palette(primary.light, 0.08);
+  color: palette(primary.dark);
 }
 .dailyPreparationStepButton[data-step-status="running"] {
-  border-color: palette(info-main);
-  background: palette(info-light, 0.18);
-  color: palette(info-dark);
+  border-color: palette(info.main);
+  background: palette(info.light, 0.18);
+  color: palette(info.dark);
 }
 .dailyPreparationStepButton[data-step-status="attention"] {
-  border-color: palette(warning-main);
-  background: palette(warning-light, 0.2);
-  color: palette(warning-dark);
+  border-color: palette(warning.main);
+  background: palette(warning.light, 0.2);
+  color: palette(warning.dark);
 }
 .dailyPreparationStepButton[data-step-status="todo"] {
-  border-color: palette(primary-light);
+  border-color: palette(primary.light);
 }
 
 /* The one place that always spells out exactly what's happening right now —
    compact chips above trade their old subtitle line for this. */
 /* Live view of a preparation run: a timeline beside the story it is building. */
 .runStory { display: grid; grid-template-columns: xs(1fr) md(minmax(0, 1fr) minmax(0, 1fr)); gap: density(4); align-items: start; }
-.runStory h3 { margin: 0 0 density(2); @ds-typo (eyebrow); color: palette(dark-main, 0.7); }
+.runStory h3 { margin: 0 0 density(2); @ds-typo(eyebrow); color: palette(dark.main, 0.7); }
 .runTimeline { display: grid; gap: density(1); margin: 0; padding: 0; list-style: none; }
-.runTimeline li { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: density(2); @ds-typo(caption); color: palette(dark-main); }
-.runTimeline time { color: palette(dark-main, 0.55); font-variant-numeric: tabular-nums; white-space: nowrap; }
-.runTimeline li[data-kind="skip"] span { color: palette(warning-dark); }
-.runTimeline li[data-kind="auto"] span { @ds-typo (emphasis); color: palette(primary-dark); }
-.runTimeline li[data-kind="now"] span { @ds-typo (emphasis); color: palette(info-dark); }
+.runTimeline li { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: density(2); @ds-typo(caption); color: palette(dark.main); }
+.runTimeline time { color: palette(dark.main, 0.55); font-variant-numeric: tabular-nums; white-space: nowrap; }
+.runTimeline li[data-kind="skip"] span { color: palette(warning.dark); }
+.runTimeline li[data-kind="auto"] span { @ds-typo(emphasis); color: palette(primary.dark); }
+.runTimeline li[data-kind="now"] span { @ds-typo(emphasis); color: palette(info.dark); }
 .runCalls { display: grid; gap: density(1); margin: 0 0 density(3); padding: 0; list-style: none; }
-.runCalls li { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: density(2); @ds-typo(caption); color: palette(dark-main); }
-.runCalls li > span:first-child { color: palette(dark-main, 0.55); font-variant-numeric: tabular-nums; }
-.runCalls small { display: block; color: palette(dark-main, 0.6); font-variant-numeric: tabular-nums; }
-.runCalls li[data-status="reserved"] small { @ds-typo (emphasis); color: palette(info-dark); }
-.runCalls li[data-status="uncertain"] small, .runCalls li[data-status="failed"] small { color: palette(warning-dark); }
+.runCalls li { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: density(2); @ds-typo(caption); color: palette(dark.main); }
+.runCalls li > span:first-child { color: palette(dark.main, 0.55); font-variant-numeric: tabular-nums; }
+.runCalls small { display: block; color: palette(dark.main, 0.6); font-variant-numeric: tabular-nums; }
+.runCalls li[data-status="reserved"] small { @ds-typo(emphasis); color: palette(info.dark); }
+.runCalls li[data-status="uncertain"] small, .runCalls li[data-status="failed"] small { color: palette(warning.dark); }
 .runStory section[aria-label="AI calls"] h3 { margin-top: density(3); }
-.runCard { @ds-surface(flat primary); display: grid; gap: density(1); padding: density(3); border: border(1); border-radius: radius(2); color: palette(dark-main); min-width: 0; }
+.runCard { @ds-surface(flat primary); display: grid; gap: density(1); padding: density(3); border: border(1); border-radius: radius(2); color: palette(dark.main); min-width: 0; }
 .runCard p { margin: 0; @ds-typo(caption); overflow-wrap: anywhere; }
 /* While another story is previewed, the latest run shrinks to one line so its actions cannot be mistaken for this story's. */
-.previousRunLine { margin: 0; @ds-typo(caption); color: palette(dark-main, 0.6); }
+.previousRunLine { margin: 0; @ds-typo(caption); color: palette(dark.main, 0.6); }
 .storyProgress { display: grid; gap: density(1); margin: 0; padding: 0; list-style: none; @ds-typo(caption); }
-.storyProgress li[data-done="true"] { @ds-typo (emphasis); color: palette(success-dark); }
-.storyProgress li[data-done="false"] { color: palette(warning-dark); }
+.storyProgress li[data-done="true"] { @ds-typo(emphasis); color: palette(success.dark); }
+.storyProgress li[data-done="false"] { color: palette(warning.dark); }
 .runImages { display: grid; gap: density(1); margin-top: density(1); }
 /* Full width of the panel: up to four per row, two on small screens. */
 .runImages ol { display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) md(repeat(4, minmax(0, 1fr))); gap: density(1); margin: 0; padding: 0; list-style: none; }
-.runImages li { aspect-ratio: 4 / 5; border-radius: radius(1); overflow: hidden; background: palette(neutral-light, 0.4); display: grid; place-items: center; }
+.runImages li { aspect-ratio: 4 / 5; border-radius: radius(1); overflow: hidden; background: palette(neutral.light, 0.4); display: grid; place-items: center; }
 .runImages li[data-status="failed"] { outline: border(focus-error); }
 .runImages img { width: 100%; height: 100%; object-fit: cover; }
 .runImages li { position: relative; }
 /* Same approve checkmark as the draft's thumbnails. */
-.runImageApproval { @ds-button (check); @ds-typo (emphasis); position: absolute; top: density(1); right: density(1); display: grid; width: 30px; height: 30px; place-items: center; }
+.runImageApproval { @ds-button(check); @ds-typo(emphasis); position: absolute; top: density(1); right: density(1); display: grid; width: 30px; height: 30px; place-items: center; }
 .runPublish { display: grid; gap: density(2); margin-top: density(3); padding-top: density(3); border-top: border(1); }
-.runPublish h3 { margin: 0; @ds-typo (eyebrow); color: palette(dark-main, 0.7); }
-.runPublishConfirm { @ds-surface (card); display: grid; gap: density(2); padding: density(3); border: border(1); border-radius: radius(2); background: palette(primary-light, 0.15); color: palette(dark-main); }
+.runPublish h3 { margin: 0; @ds-typo(eyebrow); color: palette(dark.main, 0.7); }
+.runPublishConfirm { @ds-surface(card); display: grid; gap: density(2); padding: density(3); border: border(1); border-radius: radius(2); background: palette(primary.light, 0.15); color: palette(dark.main); }
 .runPublishConfirm p { margin: 0; @ds-typo(caption); overflow-wrap: anywhere; }
 .runPublishError { white-space: pre-line; }
-.runPublishResults { display: grid; gap: density(1); margin: 0; padding: 0; list-style: none; @ds-typo(caption); color: palette(dark-main); }
-.runPublishResults li[data-status="published"] strong { color: palette(success-dark); }
-.runPublishResults li[data-status="failed"], .runPublishResults li[data-status="suspended"] { color: palette(warning-dark); }
+.runPublishResults { display: grid; gap: density(1); margin: 0; padding: 0; list-style: none; @ds-typo(caption); color: palette(dark.main); }
+.runPublishResults li[data-status="published"] strong { color: palette(success.dark); }
+.runPublishResults li[data-status="failed"], .runPublishResults li[data-status="suspended"] { color: palette(warning.dark); }
 /* Text-only slide cards: the script's shape before images exist. */
 .runImages .runSlides { display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) md(repeat(4, minmax(0, 1fr))); gap: density(2); margin: 0; padding: 0; list-style: none; }
-.runImages .runSlides li { @ds-surface (callout); border: border(1); aspect-ratio: 4 / 5; display: grid; grid-template-rows: auto 1fr; place-items: start stretch; align-content: start; gap: density(1); padding: density(2); border-radius: radius(1); overflow: hidden; }
-.runImages .runSlides li > span { @ds-typo (label); color: palette(primary-main); font-variant-numeric: tabular-nums; }
-.runImages .runSlides strong { @ds-typo (small-strong); color: palette(dark-main); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
-.runImages span { @ds-typo(caption); color: palette(dark-main, 0.6); }
+.runImages .runSlides li { @ds-surface(callout); border: border(1); aspect-ratio: 4 / 5; display: grid; grid-template-rows: auto 1fr; place-items: start stretch; align-content: start; gap: density(1); padding: density(2); border-radius: radius(1); overflow: hidden; }
+.runImages .runSlides li > span { @ds-typo(label); color: palette(primary.main); font-variant-numeric: tabular-nums; }
+.runImages .runSlides strong { @ds-typo(small-strong); color: palette(dark.main); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
+.runImages span { @ds-typo(caption); color: palette(dark.main, 0.6); }
 
 .dailyPreparationStatusLine {
-  @ds-surface (card);
-  @ds-typo (body-strong);
+  @ds-surface(card);
+  @ds-typo(body-strong);
   padding: density(3) density(4);
   border-radius: radius(2);
   border: border(1);
-  background: palette(info-light, 0.12);
-  color: palette(info-dark);
+  background: palette(info.light, 0.12);
+  color: palette(info.dark);
 }
 .dailyPreparationStatusLine[data-run-status="completed"] {
-  border-color: palette(success-light);
-  background: palette(success-light, 0.14);
-  color: palette(success-dark);
+  border-color: palette(success.light);
+  background: palette(success.light, 0.14);
+  color: palette(success.dark);
 }
 .dailyPreparationStatusLine[data-run-status="needs-review"] {
-  border-color: palette(warning-main);
-  background: palette(warning-light, 0.2);
-  color: palette(warning-dark);
+  border-color: palette(warning.main);
+  background: palette(warning.light, 0.2);
+  color: palette(warning.dark);
 }
 .dailyPreparationStatusLine[data-run-status="failed"] {
-  border-color: palette(error-main);
-  background: palette(error-light, 0.16);
-  color: palette(error-dark);
+  border-color: palette(error.main);
+  background: palette(error.light, 0.16);
+  color: palette(error.dark);
 }
 
 .acquisitionLenses {
@@ -3105,31 +3105,31 @@
 .acquisitionLenses header h2 {
   @ds-typo(h3);
   margin: 0;
-  color: palette(primary-dark);
+  color: palette(primary.dark);
 }
 
 .acquisitionLenses header p {
   @ds-typo(body);
   margin: 0;
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
 }
 
 .acquisitionLenses header small,
 .acquisitionLensSummary {
   @ds-typo(small);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 
 .acquisitionLenses [role="alert"] {
   @ds-typo(small);
   margin: 0;
-  color: palette(error-dark);
+  color: palette(error.dark);
 }
 
 .acquisitionLenses [role="status"] {
   @ds-typo(small);
   margin: 0;
-  color: palette(success-dark);
+  color: palette(success.dark);
 }
 
 .acquisitionLensList {
@@ -3160,7 +3160,7 @@
 
 .acquisitionLensHead code {
   @ds-typo(code);
-  color: palette(primary-main);
+  color: palette(primary.main);
 }
 
 .acquisitionLensHead label,
@@ -3169,7 +3169,7 @@
   @ds-typo(small);
   display: grid;
   gap: density(1);
-  color: palette(tertiary-dark);
+  color: palette(tertiary.dark);
 }
 
 .acquisitionLensHead label {
@@ -3202,19 +3202,19 @@
 .linesManager { display: grid; gap: density(5); }
 .linesManager header { display: grid; gap: density(1); }
 .linesManager header h2 { margin: 0; }
-.linesManager header p { @ds-typo(small); margin: 0; color: palette(tertiary-dark); }
-.linesManager [role="alert"] { @ds-typo(small); margin: density(2) 0 0; color: palette(error-dark); }
+.linesManager header p { @ds-typo(small); margin: 0; color: palette(tertiary.dark); }
+.linesManager [role="alert"] { @ds-typo(small); margin: density(2) 0 0; color: palette(error.dark); }
 .linesPicker { display: flex; flex-wrap: wrap; gap: density(2); }
-.linesPicker button { @ds-button (chip); display: inline-flex; align-items: center; gap: density(2); min-height: 38px; padding: 0 density(4); border-radius: radius(pill); @ds-typo (small-strong); }
-.linesPicker button:hover:not(:disabled) { border-color: palette(primary-main); }
-.linesPicker button[aria-pressed="true"] { border-color: palette(dark-main); background: palette(dark-main); color: palette(light-light); }
-.linesPicker button small { padding: space(1) density(2); border-radius: radius(pill); background: palette(primary-main, 0.12); @ds-typo (meta); }
-.linesPicker button[aria-pressed="true"] small { background: palette(light-light, 0.18); }
+.linesPicker button { @ds-button(chip); display: inline-flex; align-items: center; gap: density(2); min-height: 38px; padding: 0 density(4); border-radius: radius(pill); @ds-typo(small-strong); }
+.linesPicker button:hover:not(:disabled) { border-color: palette(primary.main); }
+.linesPicker button[aria-pressed="true"] { border-color: palette(dark.main); background: palette(dark.main); color: palette(light.light); }
+.linesPicker button small { padding: space(1) density(2); border-radius: radius(pill); background: palette(primary.main, 0.12); @ds-typo(meta); }
+.linesPicker button[aria-pressed="true"] small { background: palette(light.light, 0.18); }
 .linesPicker button:disabled { cursor: not-allowed; opacity: 0.5; }
 .linesManager fieldset { display: grid; gap: density(4); min-width: 0; margin: 0; padding: 0; border: 0; }
-.linesManager legend { @ds-typo (body-strong); margin-bottom: density(2); padding: 0; color: palette(dark-main); }
+.linesManager legend { @ds-typo(body-strong); margin-bottom: density(2); padding: 0; color: palette(dark.main); }
 .linesGroup { display: grid; min-width: 0; padding-top: density(4); border-top: border(hairline); }
-.linesGroup h3 { @ds-typo (eyebrow); margin: 0; color: palette(primary-main); }
+.linesGroup h3 { @ds-typo(eyebrow); margin: 0; color: palette(primary.main); }
 .linesFields { display: grid; grid-template-columns: xs(1fr) md(repeat(2, minmax(0, 1fr))); column-gap: density(4); }
 .linesManager .field,
 .discoverSearchOptions .field { margin-top: density(3); }
@@ -3224,7 +3224,7 @@
 .linesManager .field select,
 .linesManager .field textarea,
 .discoverSearchOptions .field input,
-.discoverSearchOptions .field select { @ds-input(outlined primary 2); box-sizing: border-box; width: 100%; border-color: palette(surface-dark); background: palette(light-light, 0.84); color: palette(dark-main); font: inherit; @ds-typo(small); }
+.discoverSearchOptions .field select { @ds-input(outlined primary 2); box-sizing: border-box; width: 100%; border-color: palette(surface.dark); background: palette(light.light, 0.84); color: palette(dark.main); font: inherit; @ds-typo(small); }
 .linesManager .field input,
 .linesManager .field select,
 .discoverSearchOptions .field input,
@@ -3232,13 +3232,13 @@
 .linesManager .field textarea { min-height: 88px; padding: density(3); resize: vertical; }
 .linesSources { margin: density(3) 0 0; padding: 0; border: border(hairline); border-radius: radius(2); list-style: none; }
 .linesSources li + li { border-top: border(hairline); }
-.linesSources label { display: flex; align-items: center; justify-content: space-between; gap: density(3); padding: density(2) density(3); color: palette(dark-main); @ds-typo(small); }
+.linesSources label { display: flex; align-items: center; justify-content: space-between; gap: density(3); padding: density(2) density(3); color: palette(dark.main); @ds-typo(small); }
 .linesSources label > span { min-width: 0; overflow-wrap: anywhere; }
-.linesSources small { color: palette(tertiary-main); }
-.linesSources select { @ds-input (field); flex: none; width: 112px; min-height: 36px; padding: 0 density(2); border-radius: radius(2); color: palette(dark-main); font: inherit; }
-.linesNote { @ds-typo(small); margin: density(3) 0 0; color: palette(tertiary-main); }
+.linesSources small { color: palette(tertiary.main); }
+.linesSources select { @ds-input(field); flex: none; width: 112px; min-height: 36px; padding: 0 density(2); border-radius: radius(2); color: palette(dark.main); font: inherit; }
+.linesNote { @ds-typo(small); margin: density(3) 0 0; color: palette(tertiary.main); }
 .linesActions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(3); padding-top: density(4); border-top: border(hairline); }
-.linesActions [role="status"] { @ds-typo(small); margin: 0; color: palette(tertiary-main); }
+.linesActions [role="status"] { @ds-typo(small); margin: 0; color: palette(tertiary.main); }
 .linesActions .buttonRow { width: xs(100%) sm(auto); margin-top: 0; }
 .linesActions .primaryButton { flex: none; }
 
@@ -3257,28 +3257,28 @@
   width: 100%;
   min-height: 32px;
   padding: 0 density(3);
-  border-color: palette(primary-main, 0.28);
-  background: palette(primary-main, 0.1);
-  color: palette(primary-dark);
-  @ds-typo (label);
+  border-color: palette(primary.main, 0.28);
+  background: palette(primary.main, 0.1);
+  color: palette(primary.dark);
+  @ds-typo(label);
   white-space: nowrap;
   cursor: pointer;
   transition: background 150ms ease, border-color 150ms ease, opacity 150ms ease;
 }
 
 .newStoryButton:hover:not(:disabled) {
-  border-color: palette(primary-main, 0.5);
-  background: palette(primary-main, 0.16);
+  border-color: palette(primary.main, 0.5);
+  background: palette(primary.main, 0.16);
 }
 
 .addSourceButton {
-  border-color: palette(dark-main, 0.12);
+  border-color: palette(dark.main, 0.12);
   background: transparent;
 }
 
 .addSourceButton:hover:not(:disabled) {
-  border-color: palette(dark-main, 0.2);
-  background: palette(dark-main, 0.04);
+  border-color: palette(dark.main, 0.2);
+  background: palette(dark.main, 0.04);
 }
 
 .newStoryButton:disabled {
@@ -3287,7 +3287,7 @@
 }
 
 .newStoryButton > span {
-  @ds-typo (small);
+  @ds-typo(small);
   opacity: 0.8;
 }
 
@@ -3304,20 +3304,20 @@
 .newStoryHint,
 .newStoryError {
   margin: 0;
-  @ds-typo (compact);
+  @ds-typo(compact);
 }
 
 .newStoryHint {
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 
 .newStoryError {
-  @ds-surface (card);
+  @ds-surface(card);
   padding: density(3) density(4);
   border: border(error-soft);
   border-radius: radius(2);
-  background: palette(error-light);
-  color: palette(error-dark);
+  background: palette(error.light);
+  color: palette(error.dark);
 }
 
 .newStoryGrid {
@@ -3341,8 +3341,8 @@
 }
 
 .newStoryOptional summary {
-  @ds-button (link);
-  @ds-typo (emphasis);
+  @ds-button(link);
+  @ds-typo(emphasis);
 }
 
 .newStoryOptional > .newStoryGrid { margin-top: density(3); }
@@ -3351,9 +3351,9 @@
 .newStoryGrid textarea {
   @ds-input(outlined primary 2);
   width: 100%;
-  border-color: palette(surface-dark);
-  background: palette(light-light, 0.84);
-  color: palette(dark-main);
+  border-color: palette(surface.dark);
+  background: palette(light.light, 0.84);
+  color: palette(dark.main);
   transition: border-color 160ms ease, box-shadow 160ms ease;
 }
 
@@ -3363,7 +3363,7 @@
 }
 
 .newStoryGrid textarea {
-  @ds-typo (multiline);
+  @ds-typo(multiline);
   min-height: 180px;
   padding: density(3) density(4);
   resize: vertical;
@@ -3371,7 +3371,7 @@
 
 .newStoryGrid select:focus,
 .newStoryGrid textarea:focus {
-  border-color: palette(primary-main);
+  border-color: palette(primary.main);
   box-shadow: shadow(ring);
   outline: none;
 }
@@ -3390,7 +3390,7 @@
 .newStoryFooter button {
   min-height: 45px;
   padding: 0 density(5);
-  @ds-typo (compact-strong);
+  @ds-typo(compact-strong);
   cursor: pointer;
 }
 
@@ -3404,14 +3404,14 @@
 }
 
 .sourceDropZone {
-  @ds-surface (dropzone);
+  @ds-surface(dropzone);
   border: border(1);
   @ds-typo(small);
   display: grid;
   gap: density(2);
   border-radius: radius(3);
   padding: density(4);
-  color: palette(dark-main);
+  color: palette(dark.main);
 }
 
 .sourceDropZone input { @ds-input(outlined primary 2); width: 100%; }
@@ -3425,9 +3425,9 @@
   padding: density(3);
 }
 
-.sourceTopicChoices legend { @ds-typo(caption); color: palette(tertiary-main); }
-.sourceTopicChoices label { @ds-typo(small); display: flex; align-items: center; gap: density(2); color: palette(dark-main); }
-.sourceTopicChoices input[type="checkbox"] { accent-color: palette(primary-main); }
+.sourceTopicChoices legend { @ds-typo(caption); color: palette(tertiary.main); }
+.sourceTopicChoices label { @ds-typo(small); display: flex; align-items: center; gap: density(2); color: palette(dark.main); }
+.sourceTopicChoices input[type="checkbox"] { accent-color: palette(primary.main); }
 
 .sourcePreview {
   @ds-surface(outlined surface 3);
@@ -3436,44 +3436,44 @@
   padding: density(4);
 }
 
-.sourcePreview strong { @ds-typo(body); color: palette(dark-main); }
+.sourcePreview strong { @ds-typo(body); color: palette(dark.main); }
 .sourcePreview span,
 .sourcePreview p,
-.sourcePreview small { @ds-typo(small); margin: 0; overflow-wrap: anywhere; color: palette(tertiary-main); }
+.sourcePreview small { @ds-typo(small); margin: 0; overflow-wrap: anywhere; color: palette(tertiary.main); }
 
 /* Navigation workspace */
 .appShell [hidden] { /* uxdsl-exception: the hidden attribute must win over any display a component sets */ display: none !important; }
 
 .sidebar { flex-basis: 240px; width: 240px; padding: density(5) density(4); box-shadow: none; }
 .sidebarNav { gap: density(1); margin-top: density(4); }
-.sidebarNav a { @ds-typo (small); min-height: 40px; padding-inline: density(4); }
-.sidebarNav a.navActive { border-color: palette(primary-light, 0.28); box-shadow: shadow(inset-secondary); }
-.navLabel { margin-block: density(7) density(2); color: palette(primary-light, 0.62); }
+.sidebarNav a { @ds-typo(small); min-height: 40px; padding-inline: density(4); }
+.sidebarNav a.navActive { border-color: palette(primary.light, 0.28); box-shadow: shadow(inset-secondary); }
+.navLabel { margin-block: density(7) density(2); color: palette(primary.light, 0.62); }
 .sidebarBottomNav { display: grid; gap: density(1); margin-top: auto; padding-top: density(5); border-top: border(primary-soft); }
-.sidebarBottomNav a { display: flex; align-items: center; gap: density(4); min-height: 40px; padding-inline: density(4); border-radius: radius(2); color: palette(primary-light); @ds-typo (small-strong); text-decoration: none; }
-.sidebarBottomNav a:hover, .sidebarBottomNav a:focus-visible, .sidebarBottomNav a.navActive { background: palette(primary-light, 0.12); color: palette(light-light); outline: 0; }
+.sidebarBottomNav a { display: flex; align-items: center; gap: density(4); min-height: 40px; padding-inline: density(4); border-radius: radius(2); color: palette(primary.light); @ds-typo(small-strong); text-decoration: none; }
+.sidebarBottomNav a:hover, .sidebarBottomNav a:focus-visible, .sidebarBottomNav a.navActive { background: palette(primary.light, 0.12); color: palette(light.light); outline: 0; }
 .sidebarFooter { margin-top: density(3); padding: density(2) density(3) 0; border: 0; }
-.sidebarFooter p { @ds-typo (fine); margin: 0; }
+.sidebarFooter p { @ds-typo(fine); margin: 0; }
 .sidebarHeader { align-items: center; gap: density(2); padding: 0; }
 .sidebar .brand { min-width: 0; gap: density(2); }
-.sidebar .brand h1 { @ds-typo (brand-sm); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
+.sidebar .brand h1 { @ds-typo(brand-sm); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
 .sidebar .logo { flex: none; width: 30px; height: 30px; }
 .sidebar .logo::before { width: 17px; height: 17px; }
 .sidebar .logo::after { width: 9px; height: 9px; }
-.sidebarTopic { @ds-surface (callout); display: grid; gap: density(2); margin-top: density(6); padding: density(3); border-radius: radius(3); background: palette(primary-light, 0.06); }
+.sidebarTopic { @ds-surface(callout); display: grid; gap: density(2); margin-top: density(6); padding: density(3); border-radius: radius(3); background: palette(primary.light, 0.06); }
 .sidebarTopicPicker { position: relative; display: flex; align-items: center; gap: density(2); min-width: 0; }
-.sidebarTopicAvatar { display: grid; flex: none; width: 30px; height: 30px; place-items: center; padding: 0; border: 0; border-radius: radius(2); background: palette(primary-main); color: palette(light-light); @ds-typo (small-strong); }
+.sidebarTopicAvatar { display: grid; flex: none; width: 30px; height: 30px; place-items: center; padding: 0; border: 0; border-radius: radius(2); background: palette(primary.main); color: palette(light.light); @ds-typo(small-strong); }
 button.sidebarTopicAvatar { cursor: pointer; }
 button.sidebarTopicAvatar:focus-visible { outline: border(focus-soft); outline-offset: space(1); }
-.sidebarTopicPicker select { /* uxdsl-exception: a native control or a dismiss area, not an action a Button role styles */ appearance: none; flex: 1; width: 100%; min-width: 0; min-height: 34px; padding: 0 density(6) 0 density(1); overflow: hidden; border: 0; border-radius: radius(2); background: transparent; color: palette(light-light); @ds-typo (small-strong); text-overflow: ellipsis; cursor: pointer; }
-.sidebarTopicPicker select option { color: palette(dark-main); }
+.sidebarTopicPicker select { /* uxdsl-exception: a native control or a dismiss area, not an action a Button role styles */ appearance: none; flex: 1; width: 100%; min-width: 0; min-height: 34px; padding: 0 density(6) 0 density(1); overflow: hidden; border: 0; border-radius: radius(2); background: transparent; color: palette(light.light); @ds-typo(small-strong); text-overflow: ellipsis; cursor: pointer; }
+.sidebarTopicPicker select option { color: palette(dark.main); }
 .sidebarTopicPicker select:focus-visible { outline: border(focus-soft); outline-offset: space(1); }
 .sidebarTopicPicker select:disabled { cursor: progress; opacity: 0.7; }
-.sidebarTopicChevron, .sidebarTopicPicker .topicLoadingIndicator { position: absolute; inset-block: 0; right: density(1); display: flex; align-items: center; color: palette(primary-light); pointer-events: none; }
-.sidebarTopicSettings { justify-self: start; color: palette(primary-light); @ds-typo (label); text-decoration: none; }
-.sidebarTopicSettings:hover, .sidebarTopicSettings:focus-visible { color: palette(light-light); text-decoration: underline; }
-.collapseSidebarButton { @ds-button (outline); display: xs(none) lg(grid); flex: none; width: 26px; height: 26px; place-items: center; border: border(primary-soft); border-radius: radius(2); color: palette(primary-light); @ds-typo (title); }
-.collapseSidebarButton:hover, .collapseSidebarButton:focus-visible { border-color: palette(primary-light, 0.6); color: palette(light-light); }
+.sidebarTopicChevron, .sidebarTopicPicker .topicLoadingIndicator { position: absolute; inset-block: 0; right: density(1); display: flex; align-items: center; color: palette(primary.light); pointer-events: none; }
+.sidebarTopicSettings { justify-self: start; color: palette(primary.light); @ds-typo(label); text-decoration: none; }
+.sidebarTopicSettings:hover, .sidebarTopicSettings:focus-visible { color: palette(light.light); text-decoration: underline; }
+.collapseSidebarButton { @ds-button(outline); display: xs(none) lg(grid); flex: none; width: 26px; height: 26px; place-items: center; border: border(primary-soft); border-radius: radius(2); color: palette(primary.light); @ds-typo(title); }
+.collapseSidebarButton:hover, .collapseSidebarButton:focus-visible { border-color: palette(primary.light, 0.6); color: palette(light.light); }
 @media (min-width: 1024px) {
   .sidebarCollapsed { flex-basis: 64px; width: 64px; padding-inline: density(2); }
   .sidebarCollapsed .sidebarHeader { flex-direction: column; align-items: center; gap: density(3); padding: 0; }
@@ -3484,7 +3484,7 @@ button.sidebarTopicAvatar:focus-visible { outline: border(focus-soft); outline-o
   .sidebarCollapsed .navIcon { width: 20px; height: 20px; }
 }
 
-.topbar { gap: 0; padding: 0 density(5); background: palette(light-light, 0.94); }
+.topbar { gap: 0; padding: 0 density(5); background: palette(light.light, 0.94); }
 /* The menu button (below lg) on the left; the brand picker lives in the sidebar, actions on the right. */
 .topbarPrimary { min-height: 56px; grid-template-columns: auto minmax(0, 1fr); gap: density(3); padding-block: density(2); }
 .topbarLeft { justify-content: xs(space-between) lg(flex-start); gap: density(3); }
@@ -3493,108 +3493,108 @@ button.sidebarTopicAvatar:focus-visible { outline: border(focus-soft); outline-o
 .splitAction { display: inline-flex; align-items: stretch; min-height: 34px; }
 .splitAction .newStoryButton { min-height: 34px; border-radius: radius(2) 0 0 radius(2); }
 .actionMenu { position: relative; }
-.actionMenu summary { @ds-button (tinted); display: grid; width: 34px; min-height: 34px; height: 100%; padding-left: space(1); place-items: center; border-left: 0; border-radius: 0 radius(2) radius(2) 0; background: palette(primary-main, 0.1); list-style: none; }
+.actionMenu summary { @ds-button(tinted); display: grid; width: 34px; min-height: 34px; height: 100%; padding-left: space(1); place-items: center; border-left: 0; border-radius: 0 radius(2) radius(2) 0; background: palette(primary.main, 0.1); list-style: none; }
 .actionMenu summary::marker { content: ""; }
 .actionMenu summary::-webkit-details-marker { display: none; }
 .actionMenuChevron { display: block; flex: none; transition: transform 150ms ease; }
 .actionMenu[open] .actionMenuChevron { transform: rotate(180deg); }
-.actionMenuItems { @ds-surface (card); position: absolute; z-index: 25; top: calc(100% + 6px); right: 0; display: grid; min-width: 180px; max-width: calc(100vw - 16px); padding: density(2); border-radius: radius(2); box-shadow: shadow(4); }
-.actionMenuItems button, .actionMenuItems a { @ds-button (link-dark); width: 100%; min-height: 40px; padding: density(2) density(3); border-radius: radius(2); @ds-typo (compact); text-align: left; text-decoration: none; }
-.actionMenuItems button:hover, .actionMenuItems a:hover { background: palette(primary-light, 0.35); }
+.actionMenuItems { @ds-surface(card); position: absolute; z-index: 25; top: calc(100% + 6px); right: 0; display: grid; min-width: 180px; max-width: calc(100vw - 16px); padding: density(2); border-radius: radius(2); box-shadow: shadow(4); }
+.actionMenuItems button, .actionMenuItems a { @ds-button(link-dark); width: 100%; min-height: 40px; padding: density(2) density(3); border-radius: radius(2); @ds-typo(compact); text-align: left; text-decoration: none; }
+.actionMenuItems button:hover, .actionMenuItems a:hover { background: palette(primary.light, 0.35); }
 .actionMenuItems button:focus-visible, .actionMenuItems a:focus-visible { outline: border(focus); outline-offset: calc(space(1) * -1); }
-.topbarActionLink { display: inline-flex; align-items: center; min-height: 34px; padding-inline: density(3); border: border(hairline); border-radius: radius(2); color: palette(primary-dark); @ds-typo (label); text-decoration: none; white-space: nowrap; }
-.topbarActionLink:hover, .topbarActionLink:focus-visible { border-color: palette(primary-main, 0.4); background: palette(primary-light, 0.2); }
+.topbarActionLink { display: inline-flex; align-items: center; min-height: 34px; padding-inline: density(3); border: border(hairline); border-radius: radius(2); color: palette(primary.dark); @ds-typo(label); text-decoration: none; white-space: nowrap; }
+.topbarActionLink:hover, .topbarActionLink:focus-visible { border-color: palette(primary.main, 0.4); background: palette(primary.light, 0.2); }
 .demoCredits { position: relative; flex: none; }
-.demoCredits > summary { @ds-button (tinted); display: flex; align-items: center; gap: density(2); min-height: 34px; padding: density(1) density(3); border-radius: radius(2); @ds-typo (caption); list-style: none; white-space: nowrap; }
+.demoCredits > summary { @ds-button(tinted); display: flex; align-items: center; gap: density(2); min-height: 34px; padding: density(1) density(3); border-radius: radius(2); @ds-typo(caption); list-style: none; white-space: nowrap; }
 .demoCredits > summary::marker { content: ""; }
 .demoCredits > summary::-webkit-details-marker { display: none; }
 .demoCredits > summary::after { content: ""; flex: none; width: 6px; height: 6px; margin: 0 density(1) space(2); border-right: border(stroke); border-bottom: border(stroke); transform: rotate(45deg); }
 .demoCredits[open] > summary::after { margin-bottom: calc(space(2) * -1); transform: rotate(225deg); }
-.demoCreditsPanel { @ds-surface (card); position: absolute; z-index: 30; top: calc(100% + 8px); right: 0; width: min(390px, calc(100vw - 24px)); max-height: min(70vh, 650px); overflow-y: auto; padding: density(5); border-radius: radius(3); box-shadow: shadow(4); color: palette(dark-main); }
-.demoCreditsPanel h2 { margin: 0 0 density(2); @ds-typo (title-sm); }
-.demoCreditsPanel h3 { margin: density(5) 0 density(2); @ds-typo (small-strong); }
-.demoCreditsPanel p { margin: 0 0 density(3); color: palette(tertiary-main); @ds-typo (caption); }
+.demoCreditsPanel { @ds-surface(card); position: absolute; z-index: 30; top: calc(100% + 8px); right: 0; width: min(390px, calc(100vw - 24px)); max-height: min(70vh, 650px); overflow-y: auto; padding: density(5); border-radius: radius(3); box-shadow: shadow(4); color: palette(dark.main); }
+.demoCreditsPanel h2 { margin: 0 0 density(2); @ds-typo(title-sm); }
+.demoCreditsPanel h3 { margin: density(5) 0 density(2); @ds-typo(small-strong); }
+.demoCreditsPanel p { margin: 0 0 density(3); color: palette(tertiary.main); @ds-typo(caption); }
 .demoCreditsTotals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: density(2); margin: density(4) 0; }
-.demoCreditsTotals > div { padding: density(2); border-radius: radius(2); background: palette(primary-light, 0.16); }
-.demoCreditsTotals dt { color: palette(tertiary-main); @ds-typo (meta); }
-.demoCreditsTotals dd { margin: density(1) 0 0; @ds-typo (small-strong); }
+.demoCreditsTotals > div { padding: density(2); border-radius: radius(2); background: palette(primary.light, 0.16); }
+.demoCreditsTotals dt { color: palette(tertiary.main); @ds-typo(meta); }
+.demoCreditsTotals dd { margin: density(1) 0 0; @ds-typo(small-strong); }
 /* Daily spend: one series, so one color and no legend; each bar carries its own tooltip. */
 .demoCreditsChart { display: grid; gap: density(1); margin: 0 0 density(3); }
-.demoCreditsChart > small, .demoCreditsChart figcaption { @ds-typo(caption); color: palette(tertiary-main); font-variant-numeric: tabular-nums; }
+.demoCreditsChart > small, .demoCreditsChart figcaption { @ds-typo(caption); color: palette(tertiary.main); font-variant-numeric: tabular-nums; }
 .demoCreditsChart ol { display: grid; grid-template-columns: repeat(30, minmax(0, 1fr)); gap: space(1); align-items: end; height: 72px; margin: 0; padding: 0; list-style: none; border-bottom: border(neutral-soft); }
 .demoCreditsChart li { height: 100%; display: flex; align-items: flex-end; }
-.demoCreditsChart li span { display: block; width: 100%; border-radius: radius(1) radius(1) 0 0; background: palette(primary-main); }
-.demoCreditsChart li:hover span { background: palette(primary-dark); }
+.demoCreditsChart li span { display: block; width: 100%; border-radius: radius(1) radius(1) 0 0; background: palette(primary.main); }
+.demoCreditsChart li:hover span { background: palette(primary.dark); }
 .demoCreditsChart figcaption { display: flex; justify-content: space-between; }
 .demoCreditsKinds { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: density(2); margin: 0 0 density(3); }
-.demoCreditsKinds > div { padding: density(2); border-radius: radius(2); background: palette(neutral-light, 0.3); }
-.demoCreditsKinds dt { @ds-typo(caption); color: palette(tertiary-main); }
-.demoCreditsKinds dd { margin: density(1) 0 0; @ds-typo (small-strong); font-variant-numeric: tabular-nums; }
+.demoCreditsKinds > div { padding: density(2); border-radius: radius(2); background: palette(neutral.light, 0.3); }
+.demoCreditsKinds dt { @ds-typo(caption); color: palette(tertiary.main); }
+.demoCreditsKinds dd { margin: density(1) 0 0; @ds-typo(small-strong); font-variant-numeric: tabular-nums; }
 .demoCreditsHistory { display: grid; gap: 0; max-height: 230px; overflow-y: auto; margin: 0 0 density(3); padding: 0; list-style: none; }
-.demoCreditsHistory li { display: flex; justify-content: space-between; gap: density(3); padding-block: density(2); border-top: border(hairline); @ds-typo (caption); }
+.demoCreditsHistory li { display: flex; justify-content: space-between; gap: density(3); padding-block: density(2); border-top: border(hairline); @ds-typo(caption); }
 .demoCreditsHistory li > span { display: grid; min-width: 0; gap: density(1); }
-.demoCreditsHistory li small { @ds-typo (meta); overflow-wrap: anywhere; color: palette(tertiary-main); }
+.demoCreditsHistory li small { @ds-typo(meta); overflow-wrap: anywhere; color: palette(tertiary.main); }
 .demoCreditsHistory li b { flex: none; font-variant-numeric: tabular-nums; }
-.demoCreditsRefresh { @ds-button (secondary); min-height: 36px; padding: density(2) density(3); border: border(primary-faint); border-radius: radius(2); @ds-typo (label); }
-.demoCreditsRefresh:hover { background: palette(primary-light, 0.25); }
+.demoCreditsRefresh { @ds-button(secondary); min-height: 36px; padding: density(2) density(3); border: border(primary-faint); border-radius: radius(2); @ds-typo(label); }
+.demoCreditsRefresh:hover { background: palette(primary.light, 0.25); }
 .demoCreditsRefresh:disabled { cursor: progress; opacity: 0.6; }
 /* The signed-in account in the top bar. */
 .accountMenu { position: relative; flex: none; }
-.accountMenu > summary { @ds-button (secondary); display: flex; align-items: center; gap: density(2); min-height: 34px; padding: 0 density(2) 0 density(1); border-radius: radius(2); color: palette(dark-main); list-style: none; }
+.accountMenu > summary { @ds-button(secondary); display: flex; align-items: center; gap: density(2); min-height: 34px; padding: 0 density(2) 0 density(1); border-radius: radius(2); color: palette(dark.main); list-style: none; }
 .accountMenu > summary::marker { content: ""; }
 .accountMenu > summary::-webkit-details-marker { display: none; }
-.accountAvatar { display: grid; width: 26px; height: 26px; place-items: center; border-radius: radius(pill); background: palette(primary-main); color: palette(light-light); @ds-typo (label); }
-.accountEmail { max-width: 180px; overflow: hidden; @ds-typo (label); text-overflow: ellipsis; white-space: nowrap; }
-.accountPanel { @ds-surface (card); position: absolute; z-index: 30; top: calc(100% + 8px); right: 0; display: grid; gap: density(1); width: min(280px, calc(100vw - 24px)); padding: density(4); border-radius: radius(3); box-shadow: shadow(4); color: palette(dark-main); }
-.accountPanel strong { overflow-wrap: anywhere; @ds-typo (small-strong); }
-.accountPanel small { overflow-wrap: anywhere; color: palette(tertiary-main); @ds-typo (caption); }
+.accountAvatar { display: grid; width: 26px; height: 26px; place-items: center; border-radius: radius(pill); background: palette(primary.main); color: palette(light.light); @ds-typo(label); }
+.accountEmail { max-width: 180px; overflow: hidden; @ds-typo(label); text-overflow: ellipsis; white-space: nowrap; }
+.accountPanel { @ds-surface(card); position: absolute; z-index: 30; top: calc(100% + 8px); right: 0; display: grid; gap: density(1); width: min(280px, calc(100vw - 24px)); padding: density(4); border-radius: radius(3); box-shadow: shadow(4); color: palette(dark.main); }
+.accountPanel strong { overflow-wrap: anywhere; @ds-typo(small-strong); }
+.accountPanel small { overflow-wrap: anywhere; color: palette(tertiary.main); @ds-typo(caption); }
 .accountPanel button { justify-self: start; margin-top: density(2); }
 .demoCreditsActions { display: flex; flex-wrap: wrap; align-items: center; gap: density(2); }
-.demoCreditsLink { display: inline-flex; align-items: center; min-height: 36px; padding: density(2) density(3); border-radius: radius(2); background: palette(primary-main); color: palette(light-light); @ds-typo (label); text-decoration: none; }
-.demoCreditsLink:hover { background: palette(primary-dark); }
+.demoCreditsLink { display: inline-flex; align-items: center; min-height: 36px; padding: density(2) density(3); border-radius: radius(2); background: palette(primary.main); color: palette(light.light); @ds-typo(label); text-decoration: none; }
+.demoCreditsLink:hover { background: palette(primary.dark); }
 
 /* Guided brand setup: identity → sources → channels, one step at a time. */
-.setupPage { display: grid; align-content: start; gap: density(5); max-width: 1080px; min-height: 100dvh; margin: 0 auto; padding: density(6) density(5) density(11); background: palette(light-main); color: palette(dark-main); }
+.setupPage { display: grid; align-content: start; gap: density(5); max-width: 1080px; min-height: 100dvh; margin: 0 auto; padding: density(6) density(5) density(11); background: palette(light.main); color: palette(dark.main); }
 .setupHeader { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: density(4); }
-.setupHeader > div:first-child > span { color: palette(tertiary-main); @ds-typo (label); }
-.setupHeader h1 { margin: density(1) 0 0; @ds-typo (display); }
+.setupHeader > div:first-child > span { color: palette(tertiary.main); @ds-typo(label); }
+.setupHeader h1 { margin: density(1) 0 0; @ds-typo(display); }
 .setupHeaderActions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: density(3); }
-.setupBrandSwitch { display: flex; align-items: center; gap: density(2); color: palette(tertiary-main); @ds-typo (label); }
-.setupBrandSwitch select { @ds-input (field); min-height: 34px; padding: 0 density(3); border-radius: radius(2); color: palette(dark-main); @ds-typo(small); }
-.setupAccount { max-width: 220px; overflow: hidden; color: palette(tertiary-main); @ds-typo (caption); text-overflow: ellipsis; white-space: nowrap; }
+.setupBrandSwitch { display: flex; align-items: center; gap: density(2); color: palette(tertiary.main); @ds-typo(label); }
+.setupBrandSwitch select { @ds-input(field); min-height: 34px; padding: 0 density(3); border-radius: radius(2); color: palette(dark.main); @ds-typo(small); }
+.setupAccount { max-width: 220px; overflow: hidden; color: palette(tertiary.main); @ds-typo(caption); text-overflow: ellipsis; white-space: nowrap; }
 .setupSteps { display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) md(repeat(4, minmax(0, 1fr))); gap: density(2); margin: 0; padding: 0; list-style: none; }
-.setupSteps button { @ds-button (secondary); display: flex; align-items: center; gap: density(3); width: 100%; min-height: 56px; padding: density(3); border-radius: radius(3); color: palette(dark-main); text-align: left; }
+.setupSteps button { @ds-button(secondary); display: flex; align-items: center; gap: density(3); width: 100%; min-height: 56px; padding: density(3); border-radius: radius(3); color: palette(dark.main); text-align: left; }
 .setupSteps button:disabled { cursor: not-allowed; }
-.setupSteps b { display: grid; flex: none; width: 28px; height: 28px; place-items: center; border-radius: radius(pill); background: palette(neutral-light, 0.6); color: palette(tertiary-main); @ds-typo (label); }
+.setupSteps b { display: grid; flex: none; width: 28px; height: 28px; place-items: center; border-radius: radius(pill); background: palette(neutral.light, 0.6); color: palette(tertiary.main); @ds-typo(label); }
 .setupSteps span { display: grid; min-width: 0; gap: space(1); }
-.setupSteps strong { @ds-typo (small-strong); }
-.setupSteps small { overflow: hidden; color: palette(tertiary-main); @ds-typo (meta); text-overflow: ellipsis; white-space: nowrap; }
-.setupSteps li[data-state="current"] button { border-color: palette(primary-main); box-shadow: shadow(inset-outline); }
-.setupSteps li[data-state="current"] b { background: palette(primary-main); color: palette(light-light); }
-.setupSteps li[data-state="done"] b { background: palette(success-main); color: palette(light-light); }
+.setupSteps strong { @ds-typo(small-strong); }
+.setupSteps small { overflow: hidden; color: palette(tertiary.main); @ds-typo(meta); text-overflow: ellipsis; white-space: nowrap; }
+.setupSteps li[data-state="current"] button { border-color: palette(primary.main); box-shadow: shadow(inset-outline); }
+.setupSteps li[data-state="current"] b { background: palette(primary.main); color: palette(light.light); }
+.setupSteps li[data-state="done"] b { background: palette(success.main); color: palette(light.light); }
 .setupSteps li[data-state="locked"] button { opacity: 0.55; }
-.setupNotice { margin: 0; padding: density(3) density(4); border-radius: radius(2); background: palette(primary-light, 0.2); color: palette(primary-dark); @ds-typo (small-strong); }
-.setupNotice[data-tone="error"] { background: palette(error-light, 0.2); color: palette(error-dark); }
-.setupStep { @ds-surface (panel); display: grid; gap: density(4); padding: density(5); border-radius: radius(3); }
+.setupNotice { margin: 0; padding: density(3) density(4); border-radius: radius(2); background: palette(primary.light, 0.2); color: palette(primary.dark); @ds-typo(small-strong); }
+.setupNotice[data-tone="error"] { background: palette(error.light, 0.2); color: palette(error.dark); }
+.setupStep { @ds-surface(panel); display: grid; gap: density(4); padding: density(5); border-radius: radius(3); }
 .setupIntro { display: grid; gap: density(2); max-width: 760px; }
-.setupIntro h2 { margin: 0; @ds-typo (title); }
-.setupIntro p { margin: 0; color: palette(tertiary-main); @ds-typo (small); }
-.setupIntro p.setupOk { @ds-typo (emphasis); color: palette(success-dark); }
-.setupMissing { display: grid; gap: density(1); margin: 0; padding-left: density(5); color: palette(error-dark); @ds-typo (small-strong); }
-.setupTabs { display: flex; flex-wrap: wrap; gap: density(1); padding: density(1); border-radius: radius(3); background: palette(neutral-light, 0.45); justify-self: start; }
-.setupTabs button { @ds-button (tab); min-height: 34px; padding: 0 density(3); border-radius: radius(2); @ds-typo (label); }
-.setupTabs button[aria-pressed="true"] { background: palette(light-light); color: palette(primary-dark); box-shadow: shadow(1); }
+.setupIntro h2 { margin: 0; @ds-typo(title); }
+.setupIntro p { margin: 0; color: palette(tertiary.main); @ds-typo(small); }
+.setupIntro p.setupOk { @ds-typo(emphasis); color: palette(success.dark); }
+.setupMissing { display: grid; gap: density(1); margin: 0; padding-left: density(5); color: palette(error.dark); @ds-typo(small-strong); }
+.setupTabs { display: flex; flex-wrap: wrap; gap: density(1); padding: density(1); border-radius: radius(3); background: palette(neutral.light, 0.45); justify-self: start; }
+.setupTabs button { @ds-button(tab); min-height: 34px; padding: 0 density(3); border-radius: radius(2); @ds-typo(label); }
+.setupTabs button[aria-pressed="true"] { background: palette(light.light); color: palette(primary.dark); box-shadow: shadow(1); }
 .setupPanel { display: grid; gap: density(4); min-width: 0; }
 .setupAlternative { border-top: border(hairline); padding-top: density(3); }
-.setupAlternative > summary { @ds-button (link); @ds-typo (small-strong); }
+.setupAlternative > summary { @ds-button(link); @ds-typo(small-strong); }
 .setupSummary { display: grid; gap: density(2); margin: 0; padding: 0; list-style: none; }
-.setupSummary li { @ds-typo (small-strong); }
-.setupSummary li::before { content: "○ "; color: palette(tertiary-main); }
-.setupSummary li[data-done="true"]::before { content: "✓ "; color: palette(success-dark); }
+.setupSummary li { @ds-typo(small-strong); }
+.setupSummary li::before { content: "○ "; color: palette(tertiary.main); }
+.setupSummary li[data-done="true"]::before { content: "✓ "; color: palette(success.dark); }
 .setupFooter { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: density(2); padding-top: density(3); border-top: border(hairline); }
-.setupPrimary { @ds-button(contained primary 2); min-height: 40px; padding-inline: density(5); @ds-typo (small-strong); }
-.setupSecondary { @ds-button(outlined primary 2); justify-self: start; min-height: 40px; padding-inline: density(4); @ds-typo (small-strong); }
-.setupGhost { @ds-button (tab); min-height: 40px; padding-inline: density(4); border-radius: radius(2); @ds-typo (small-strong); }
+.setupPrimary { @ds-button(contained primary 2); min-height: 40px; padding-inline: density(5); @ds-typo(small-strong); }
+.setupSecondary { @ds-button(outlined primary 2); justify-self: start; min-height: 40px; padding-inline: density(4); @ds-typo(small-strong); }
+.setupGhost { @ds-button(tab); min-height: 40px; padding-inline: density(4); border-radius: radius(2); @ds-typo(small-strong); }
 .setupPrimary:disabled, .setupSecondary:disabled, .setupGhost:disabled { cursor: not-allowed; opacity: 0.5; }
 @media (max-width: 639px) {
   .setupPage { padding-inline: density(4); }
@@ -3603,57 +3603,57 @@ button.sidebarTopicAvatar:focus-visible { outline: border(focus-soft); outline-o
 }
 
 /* Spending page: prepaid balance, products sold, and who they were sold for. */
-.spendingPage { display: grid; gap: density(6); max-width: 1180px; min-height: 100dvh; margin: 0 auto; padding: density(6) density(5) density(11); background: palette(light-main); color: palette(dark-main); }
+.spendingPage { display: grid; gap: density(6); max-width: 1180px; min-height: 100dvh; margin: 0 auto; padding: density(6) density(5) density(11); background: palette(light.main); color: palette(dark.main); }
 .spendingHeader { display: grid; gap: density(3); }
-.spendingHeader h1 { margin: 0; @ds-typo (display); }
-.spendingHeader p { max-width: 720px; margin: density(2) 0 0; color: palette(tertiary-main); @ds-typo (small); }
-.spendingBack { justify-self: start; color: palette(primary-dark); @ds-typo (small-strong); text-decoration: none; }
+.spendingHeader h1 { margin: 0; @ds-typo(display); }
+.spendingHeader p { max-width: 720px; margin: density(2) 0 0; color: palette(tertiary.main); @ds-typo(small); }
+.spendingBack { justify-self: start; color: palette(primary.dark); @ds-typo(small-strong); text-decoration: none; }
 .spendingBack:hover { text-decoration: underline; }
-.spendingError { @ds-surface (card); padding: density(5); border: border(error-soft); border-radius: radius(3); background: palette(error-light, 0.15); }
+.spendingError { @ds-surface(card); padding: density(5); border: border(error-soft); border-radius: radius(3); background: palette(error.light, 0.15); }
 .spendingError p { margin: density(2) 0; @ds-typo(small); }
-.spendingError a { color: palette(primary-dark); @ds-typo (small-strong); }
+.spendingError a { color: palette(primary.dark); @ds-typo(small-strong); }
 .spendingControls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: density(4); }
-.spendingPeriods { display: flex; flex-wrap: wrap; gap: density(1); padding: density(1); border-radius: radius(3); background: palette(neutral-light, 0.45); }
-.spendingPeriods button { @ds-button (tab); min-height: 36px; padding: density(2) density(3); border-radius: radius(2); @ds-typo (label); }
-.spendingPeriods button[aria-pressed="true"] { background: palette(light-light); color: palette(primary-dark); box-shadow: shadow(1); }
-.spendingTopic { display: grid; gap: density(1); color: palette(tertiary-main); @ds-typo (label); }
-.spendingTopic select { @ds-input (field); min-height: 38px; min-width: 200px; padding: density(1) density(3); border-radius: radius(2); color: palette(dark-main); @ds-typo(small); }
-.spendingReset { margin-left: auto; @ds-button(outlined primary 2); min-height: 38px; padding-inline: density(4); @ds-typo (label); }
+.spendingPeriods { display: flex; flex-wrap: wrap; gap: density(1); padding: density(1); border-radius: radius(3); background: palette(neutral.light, 0.45); }
+.spendingPeriods button { @ds-button(tab); min-height: 36px; padding: density(2) density(3); border-radius: radius(2); @ds-typo(label); }
+.spendingPeriods button[aria-pressed="true"] { background: palette(light.light); color: palette(primary.dark); box-shadow: shadow(1); }
+.spendingTopic { display: grid; gap: density(1); color: palette(tertiary.main); @ds-typo(label); }
+.spendingTopic select { @ds-input(field); min-height: 38px; min-width: 200px; padding: density(1) density(3); border-radius: radius(2); color: palette(dark.main); @ds-typo(small); }
+.spendingReset { margin-left: auto; @ds-button(outlined primary 2); min-height: 38px; padding-inline: density(4); @ds-typo(label); }
 .spendingReset:disabled { cursor: progress; opacity: 0.6; }
-.spendingNotice, .spendingLoading, .spendingNote { margin: 0; color: palette(tertiary-main); @ds-typo (compact); }
-.spendingNotice { @ds-typo (compact-strong); padding: density(3) density(4); border-radius: radius(2); background: palette(primary-light, 0.2); color: palette(primary-dark); }
+.spendingNotice, .spendingLoading, .spendingNote { margin: 0; color: palette(tertiary.main); @ds-typo(compact); }
+.spendingNotice { @ds-typo(compact-strong); padding: density(3) density(4); border-radius: radius(2); background: palette(primary.light, 0.2); color: palette(primary.dark); }
 .spendingSummary { display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) md(repeat(3, minmax(0, 1fr))) lg(repeat(auto-fit, minmax(150px, 1fr))); gap: density(3); margin: 0; }
-.spendingSummary > div { @ds-surface (panel); display: grid; gap: density(1); padding: density(4); border-radius: radius(3); }
-.spendingSummary dt { color: palette(tertiary-main); @ds-typo (label); }
-.spendingSummary dd { margin: 0; @ds-typo (title); font-variant-numeric: tabular-nums; }
-.spendingSummary small { display: block; color: palette(tertiary-main); @ds-typo (meta-strong); }
+.spendingSummary > div { @ds-surface(panel); display: grid; gap: density(1); padding: density(4); border-radius: radius(3); }
+.spendingSummary dt { color: palette(tertiary.main); @ds-typo(label); }
+.spendingSummary dd { margin: 0; @ds-typo(title); font-variant-numeric: tabular-nums; }
+.spendingSummary small { display: block; color: palette(tertiary.main); @ds-typo(meta-strong); }
 .spendingSection { display: grid; gap: density(3); }
-.spendingSection h2 { margin: 0; @ds-typo (title-sm); }
-.spendingTableWrap { @ds-surface (panel); overflow-x: auto; border-radius: radius(3); }
-.spendingTable { width: 100%; border-collapse: collapse; @ds-typo (compact); font-variant-numeric: tabular-nums; }
+.spendingSection h2 { margin: 0; @ds-typo(title-sm); }
+.spendingTableWrap { @ds-surface(panel); overflow-x: auto; border-radius: radius(3); }
+.spendingTable { width: 100%; border-collapse: collapse; @ds-typo(compact); font-variant-numeric: tabular-nums; }
 .spendingTable th, .spendingTable td { padding: density(2) density(3); border-bottom: border(hairline); text-align: right; white-space: nowrap; }
-.spendingTable thead th { color: palette(tertiary-main); @ds-typo (meta-strong); }
-.spendingTable th[scope="row"], .spendingTable thead th:first-child { @ds-typo (emphasis); max-width: 360px; overflow: hidden; text-align: left; text-overflow: ellipsis; }
-.spendingTable td:nth-child(2) { text-align: left; color: palette(tertiary-main); }
+.spendingTable thead th { color: palette(tertiary.main); @ds-typo(meta-strong); }
+.spendingTable th[scope="row"], .spendingTable thead th:first-child { @ds-typo(emphasis); max-width: 360px; overflow: hidden; text-align: left; text-overflow: ellipsis; }
+.spendingTable td:nth-child(2) { text-align: left; color: palette(tertiary.main); }
 .spendingTable tbody tr:last-child th, .spendingTable tbody tr:last-child td { border-bottom: 0; }
-.spendingTable a { color: palette(primary-dark); text-decoration: none; }
+.spendingTable a { color: palette(primary.dark); text-decoration: none; }
 .spendingTable a:hover { text-decoration: underline; }
-.spendingHistory { @ds-surface (panel); display: grid; margin: 0; padding: 0; border-radius: radius(3); list-style: none; }
-.spendingHistory li { display: flex; justify-content: space-between; gap: density(4); padding: density(3) density(4); border-top: border(hairline); @ds-typo (compact); }
+.spendingHistory { @ds-surface(panel); display: grid; margin: 0; padding: 0; border-radius: radius(3); list-style: none; }
+.spendingHistory li { display: flex; justify-content: space-between; gap: density(4); padding: density(3) density(4); border-top: border(hairline); @ds-typo(compact); }
 .spendingHistory li:first-child { border-top: 0; }
 .spendingHistory li > span { display: grid; min-width: 0; gap: density(1); }
-.spendingHistory small { @ds-typo (caption); overflow-wrap: anywhere; color: palette(tertiary-main); }
+.spendingHistory small { @ds-typo(caption); overflow-wrap: anywhere; color: palette(tertiary.main); }
 .spendingHistory b { flex: none; font-variant-numeric: tabular-nums; }
-.spendingMore { justify-self: start; @ds-button(outlined primary 2); min-height: 36px; padding-inline: density(4); @ds-typo (label); }
-.spendingSection > p { margin: 0; color: palette(tertiary-main); @ds-typo (compact); }
+.spendingMore { justify-self: start; @ds-button(outlined primary 2); min-height: 36px; padding-inline: density(4); @ds-typo(label); }
+.spendingSection > p { margin: 0; color: palette(tertiary.main); @ds-typo(compact); }
 .spendingPacks { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: density(3); margin: 0; padding: 0; list-style: none; }
-.spendingPacks li { @ds-surface (panel); display: grid; align-content: start; gap: density(2); padding: density(4); border-radius: radius(3); }
-.spendingPacks strong { @ds-typo (title-sm); }
-.spendingPacks b { @ds-typo (title-lg); font-variant-numeric: tabular-nums; }
-.spendingPacks small { color: palette(tertiary-main); @ds-typo (label); }
-.spendingBuy { justify-self: stretch; @ds-button(contained primary 2); min-height: 38px; padding-inline: density(4); @ds-typo (compact-strong); }
+.spendingPacks li { @ds-surface(panel); display: grid; align-content: start; gap: density(2); padding: density(4); border-radius: radius(3); }
+.spendingPacks strong { @ds-typo(title-sm); }
+.spendingPacks b { @ds-typo(title-lg); font-variant-numeric: tabular-nums; }
+.spendingPacks small { color: palette(tertiary.main); @ds-typo(label); }
+.spendingBuy { justify-self: stretch; @ds-button(contained primary 2); min-height: 38px; padding-inline: density(4); @ds-typo(compact-strong); }
 .spendingBuy:disabled { cursor: progress; opacity: 0.6; }
-.spendingTestMode { justify-self: start; padding: density(1) density(2); border-radius: radius(2); background: palette(warning-light, 0.35); color: palette(dark-main); @ds-typo (meta-strong); }
+.spendingTestMode { justify-self: start; padding: density(1) density(2); border-radius: radius(2); background: palette(warning.light, 0.35); color: palette(dark.main); @ds-typo(meta-strong); }
 @media (max-width: 639px) {
   .spendingPage { padding-inline: density(4); }
   .spendingReset { margin-left: 0; }
@@ -3663,55 +3663,55 @@ button.sidebarTopicAvatar:focus-visible { outline: border(focus-soft); outline-o
 .topbarSession .disconnectButton { width: 34px; height: 34px; }
 .contextBar { display: flex; align-items: center; gap: density(6); min-height: 48px; border-top: border(hairline); }
 .contextHeading { display: grid; flex: none; gap: space(1); min-width: xs(0) md(155px); }
-.contextHeading > span { color: palette(tertiary-main); @ds-typo (fine); }
-.contextHeading strong { color: palette(dark-main); @ds-typo (small-strong); }
+.contextHeading > span { color: palette(tertiary.main); @ds-typo(fine); }
+.contextHeading strong { color: palette(dark.main); @ds-typo(small-strong); }
 .contextTabs { display: flex; align-self: stretch; align-items: center; min-width: 0; gap: density(1); overflow-x: auto; scrollbar-width: thin; }
-.contextTabs a { display: inline-flex; align-self: stretch; align-items: center; min-height: 44px; padding-inline: density(3); border-bottom: border(clear); color: palette(tertiary-main); @ds-typo (label); text-decoration: none; white-space: nowrap; }
-.contextTabs a:hover, .contextTabs a:focus-visible { color: palette(primary-dark); }
-.contextTabs a.contextTabActive { border-bottom-color: palette(primary-main); color: palette(primary-dark); }
+.contextTabs a { display: inline-flex; align-self: stretch; align-items: center; min-height: 44px; padding-inline: density(3); border-bottom: border(clear); color: palette(tertiary.main); @ds-typo(label); text-decoration: none; white-space: nowrap; }
+.contextTabs a:hover, .contextTabs a:focus-visible { color: palette(primary.dark); }
+.contextTabs a.contextTabActive { border-bottom-color: palette(primary.main); color: palette(primary.dark); }
 .contextActions { display: flex; align-items: center; margin-left: auto; }
-.contextPrimaryAction { @ds-button(contained primary 2); min-height: 34px; padding-inline: density(4); @ds-typo (label); white-space: nowrap; }
+.contextPrimaryAction { @ds-button(contained primary 2); min-height: 34px; padding-inline: density(4); @ds-typo(label); white-space: nowrap; }
 .contextPrimaryAction:disabled { cursor: not-allowed; opacity: 0.55; }
-.contextSelectedLink { @ds-button(outlined primary 2); display: inline-flex; align-items: center; gap: density(2); min-height: 36px; padding-inline: density(3); @ds-typo (label); text-decoration: none; white-space: nowrap; }
-.contextSelectedLink span { display: inline-grid; min-width: 21px; min-height: 21px; padding-inline: density(1); place-items: center; border-radius: radius(pill); background: palette(primary-main, 0.12); }
+.contextSelectedLink { @ds-button(outlined primary 2); display: inline-flex; align-items: center; gap: density(2); min-height: 36px; padding-inline: density(3); @ds-typo(label); text-decoration: none; white-space: nowrap; }
+.contextSelectedLink span { display: inline-grid; min-width: 21px; min-height: 21px; padding-inline: density(1); place-items: center; border-radius: radius(pill); background: palette(primary.main, 0.12); }
 .page { padding-block: density(6) density(11); }
 
 .workQueue { display: grid; gap: density(5); }
 .queueHeading { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: density(3); }
-.queueHeading h2 { margin: density(1) 0 0; color: palette(dark-main); @ds-typo (display); }
-.queueHeading > span, .queueIntro, .queueMeta { color: palette(tertiary-main); @ds-typo (compact); }
+.queueHeading h2 { margin: density(1) 0 0; color: palette(dark.main); @ds-typo(display); }
+.queueHeading > span, .queueIntro, .queueMeta { color: palette(tertiary.main); @ds-typo(compact); }
 .queueIntro { margin: 0; }
 .queueList { display: grid; gap: density(3); }
-.queueItem { @ds-surface (panel); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(5); padding: density(5); border-radius: radius(3); }
+.queueItem { @ds-surface(panel); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(5); padding: density(5); border-radius: radius(3); }
 .queueItem > div:first-child { min-width: 220px; flex: 1; }
-.queueItem h3 { margin: density(1) 0; color: palette(dark-main); @ds-typo (title-sm); }
-.queueItem p { margin: 0; color: palette(tertiary-main); @ds-typo (compact); }
-.queueItem p.queueProgress { @ds-typo (emphasis); margin-top: density(2); color: palette(primary-dark); }
+.queueItem h3 { margin: density(1) 0; color: palette(dark.main); @ds-typo(title-sm); }
+.queueItem p { margin: 0; color: palette(tertiary.main); @ds-typo(compact); }
+.queueItem p.queueProgress { @ds-typo(emphasis); margin-top: density(2); color: palette(primary.dark); }
 .queueActions { display: flex; flex-wrap: wrap; align-items: flex-start; gap: density(2); }
 .queuePublicationDetails { position: relative; }
-.queuePublicationDetails > summary { @ds-button (secondary); display: inline-flex; align-items: center; min-height: 36px; padding: density(2) density(3); border: border(primary-faint); border-radius: radius(2); @ds-typo (label); list-style: none; }
+.queuePublicationDetails > summary { @ds-button(secondary); display: inline-flex; align-items: center; min-height: 36px; padding: density(2) density(3); border: border(primary-faint); border-radius: radius(2); @ds-typo(label); list-style: none; }
 .queuePublicationDetails > summary::marker { content: ""; }
 .queuePublicationDetails > summary::-webkit-details-marker { display: none; }
-.queuePublicationDetails > summary:hover { background: palette(primary-light, 0.2); }
-.queuePublicationDetails > .publicationQuickControl { @ds-surface (card); position: absolute; z-index: 5; top: calc(100% + 6px); right: 0; width: 230px; padding: density(4); border-radius: radius(2); box-shadow: shadow(4); }
+.queuePublicationDetails > summary:hover { background: palette(primary.light, 0.2); }
+.queuePublicationDetails > .publicationQuickControl { @ds-surface(card); position: absolute; z-index: 5; top: calc(100% + 6px); right: 0; width: 230px; padding: density(4); border-radius: radius(2); box-shadow: shadow(4); }
 @media (max-width: 639px) {
   .queuePublicationDetails > .publicationQuickControl { position: static; width: min(100%, 260px); margin-top: density(2); }
 }
 .queuePublishedBody { display: flex; align-items: flex-start; gap: density(4); }
 .queuePublishedBody > div { flex: 1; min-width: 0; }
-.queueThumbnail, .queueThumbnailPlaceholder { @ds-surface (panel); flex: none; width: 72px; aspect-ratio: 4 / 5; border-radius: radius(2); background: palette(dark-main, 0.06); }
+.queueThumbnail, .queueThumbnailPlaceholder { @ds-surface(panel); flex: none; width: 72px; aspect-ratio: 4 / 5; border-radius: radius(2); background: palette(dark.main, 0.06); }
 .queueThumbnail { display: block; height: auto; object-fit: cover; }
-.queueThumbnailPlaceholder { display: grid; place-items: center; padding: density(1); color: palette(tertiary-main); @ds-typo (meta-strong); text-align: center; }
+.queueThumbnailPlaceholder { display: grid; place-items: center; padding: density(1); color: palette(tertiary.main); @ds-typo(meta-strong); text-align: center; }
 .queuePublishedDestinations { display: flex; flex-wrap: wrap; gap: density(2); margin-top: density(3); }
-.queuePublishedDestinations a, .queuePublishedDestinations span { display: inline-flex; align-items: center; min-height: 28px; padding: density(1) density(2); border-radius: radius(2); background: palette(primary-main, 0.09); color: palette(primary-dark); @ds-typo (label); text-decoration: none; }
-.queuePublishedDestinations a:hover { background: palette(primary-main, 0.16); }
-.queueEmpty { @ds-surface (dropzone); padding: density(7); border: border(dashed); border-radius: radius(3); background: palette(light-light, 0.7); }
-.queueEmpty strong { @ds-typo (title-sm); }
-.queueEmpty p { margin: density(2) 0; color: palette(tertiary-main); @ds-typo(small); }
-.queueEmpty a { color: palette(primary-dark); @ds-typo (small-strong); }
-.productionReviewDetails { @ds-surface (panel); margin-top: density(5); border-radius: radius(3); }
-.productionReviewDetails > summary { @ds-button (link); display: flex; min-height: 44px; align-items: center; padding: density(3) density(5); @ds-typo (small-strong); }
-.productionReviewDetails > p { margin: 0; padding: 0 density(5) density(3); color: palette(tertiary-main); @ds-typo(small); }
+.queuePublishedDestinations a, .queuePublishedDestinations span { display: inline-flex; align-items: center; min-height: 28px; padding: density(1) density(2); border-radius: radius(2); background: palette(primary.main, 0.09); color: palette(primary.dark); @ds-typo(label); text-decoration: none; }
+.queuePublishedDestinations a:hover { background: palette(primary.main, 0.16); }
+.queueEmpty { @ds-surface(dropzone); padding: density(7); border: border(dashed); border-radius: radius(3); background: palette(light.light, 0.7); }
+.queueEmpty strong { @ds-typo(title-sm); }
+.queueEmpty p { margin: density(2) 0; color: palette(tertiary.main); @ds-typo(small); }
+.queueEmpty a { color: palette(primary.dark); @ds-typo(small-strong); }
+.productionReviewDetails { @ds-surface(panel); margin-top: density(5); border-radius: radius(3); }
+.productionReviewDetails > summary { @ds-button(link); display: flex; min-height: 44px; align-items: center; padding: density(3) density(5); @ds-typo(small-strong); }
+.productionReviewDetails > p { margin: 0; padding: 0 density(5) density(3); color: palette(tertiary.main); @ds-typo(small); }
 .productionReviewDetails > section { border: 0; box-shadow: none; }
 
 @media (max-width: 767px) {
@@ -3747,86 +3747,86 @@ button.sidebarTopicAvatar:focus-visible { outline: border(focus-soft); outline-o
 .activityPanel { display: grid; gap: density(4); }
 .activityPanel header { display: grid; gap: density(1); }
 .activityPanel header h2 { margin: 0; }
-.activityPanel header p { @ds-typo(small); margin: 0; color: palette(tertiary-dark); }
-.activityModes { display: inline-flex; justify-self: start; gap: density(1); padding: density(1); border-radius: radius(3); background: palette(surface-light); }
-.activityModes button { @ds-button (tab); min-height: 36px; padding: 0 density(4); border-radius: radius(2); color: palette(tertiary-dark); @ds-typo (small-strong); }
-.activityModes button[aria-pressed="true"] { background: palette(light-light); color: palette(primary-dark); box-shadow: shadow(1); }
+.activityPanel header p { @ds-typo(small); margin: 0; color: palette(tertiary.dark); }
+.activityModes { display: inline-flex; justify-self: start; gap: density(1); padding: density(1); border-radius: radius(3); background: palette(surface.light); }
+.activityModes button { @ds-button(tab); min-height: 36px; padding: 0 density(4); border-radius: radius(2); color: palette(tertiary.dark); @ds-typo(small-strong); }
+.activityModes button[aria-pressed="true"] { background: palette(light.light); color: palette(primary.dark); box-shadow: shadow(1); }
 .activityFilters { display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) md(repeat(3, minmax(0, 200px)) auto); align-items: end; gap: density(3); }
-.activityFilters > label:not(.activityToggle) { display: grid; gap: density(1); min-width: 0; color: palette(primary-dark); @ds-typo (label); }
-.activityFilters select { @ds-input (field); box-sizing: border-box; width: 100%; min-height: 40px; padding: 0 density(3); border-radius: radius(2); color: palette(dark-main); font: inherit; @ds-typo(small); }
-.activityToggle { @ds-button (link); display: flex; align-items: center; gap: density(2); min-height: 40px; @ds-typo(small); }
-.activityToggle input { width: 16px; height: 16px; accent-color: palette(primary-main); }
-.activityEmpty { @ds-typo(small); margin: 0; padding: density(4); border: border(dashed); border-radius: radius(2); color: palette(tertiary-main); text-align: center; }
-.activityEmpty[role="alert"] { border-style: solid; border-color: palette(error-main, 0.3); color: palette(error-dark); }
+.activityFilters > label:not(.activityToggle) { display: grid; gap: density(1); min-width: 0; color: palette(primary.dark); @ds-typo(label); }
+.activityFilters select { @ds-input(field); box-sizing: border-box; width: 100%; min-height: 40px; padding: 0 density(3); border-radius: radius(2); color: palette(dark.main); font: inherit; @ds-typo(small); }
+.activityToggle { @ds-button(link); display: flex; align-items: center; gap: density(2); min-height: 40px; @ds-typo(small); }
+.activityToggle input { width: 16px; height: 16px; accent-color: palette(primary.main); }
+.activityEmpty { @ds-typo(small); margin: 0; padding: density(4); border: border(dashed); border-radius: radius(2); color: palette(tertiary.main); text-align: center; }
+.activityEmpty[role="alert"] { border-style: solid; border-color: palette(error.main, 0.3); color: palette(error.dark); }
 .activityDays { display: grid; gap: density(4); }
-.activityDays h3 { @ds-typo (eyebrow); margin: 0 0 density(2); color: palette(primary-main); }
+.activityDays h3 { @ds-typo(eyebrow); margin: 0 0 density(2); color: palette(primary.main); }
 .activityDays ol { margin: 0; padding: 0; border: border(hairline); border-radius: radius(2); list-style: none; }
 .activityItem { display: grid; grid-template-columns: 10px minmax(0, 1fr); gap: density(3); padding: density(3) density(4); }
 .activityItem + .activityItem { border-top: border(hairline); }
 .activityItem > div { display: grid; gap: density(1); min-width: 0; }
-.activityItem p { display: flex; flex-wrap: wrap; align-items: baseline; gap: density(2); margin: 0; color: palette(dark-main); @ds-typo(small); }
-.activityItem code { overflow-wrap: anywhere; color: palette(tertiary-dark); @ds-typo (code-sm); }
-.activityItem small { color: palette(tertiary-main); @ds-typo (caption); }
-.activityItem details > summary { @ds-button (link); width: fit-content; @ds-typo (label); }
-.activityItem dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: density(1) density(3); margin: density(2) 0 0; @ds-typo (caption); }
-.activityItem dt { @ds-typo (emphasis); color: palette(tertiary-main); }
-.activityItem dd { margin: 0; overflow-wrap: anywhere; color: palette(dark-main); }
-.activityItem details > p { @ds-typo (meta); margin: density(2) 0 0; color: palette(tertiary-main); }
-.activityDot { width: 8px; height: 8px; margin-top: space(3); border-radius: radius(circle); background: palette(tertiary-main); }
-.activityDot[data-outcome="success"], .activityDot[data-operation="INSERT"] { background: palette(success-main); }
-.activityDot[data-outcome="failure"], .activityDot[data-operation="DELETE"] { background: palette(error-main); }
-.activityDot[data-outcome="denied"] { background: palette(warning-main); }
-.activityDot[data-operation="UPDATE"] { background: palette(primary-main); }
-.activityValues { width: 100%; margin-top: density(2); border-collapse: collapse; @ds-typo (caption); table-layout: fixed; }
+.activityItem p { display: flex; flex-wrap: wrap; align-items: baseline; gap: density(2); margin: 0; color: palette(dark.main); @ds-typo(small); }
+.activityItem code { overflow-wrap: anywhere; color: palette(tertiary.dark); @ds-typo(code-sm); }
+.activityItem small { color: palette(tertiary.main); @ds-typo(caption); }
+.activityItem details > summary { @ds-button(link); width: fit-content; @ds-typo(label); }
+.activityItem dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: density(1) density(3); margin: density(2) 0 0; @ds-typo(caption); }
+.activityItem dt { @ds-typo(emphasis); color: palette(tertiary.main); }
+.activityItem dd { margin: 0; overflow-wrap: anywhere; color: palette(dark.main); }
+.activityItem details > p { @ds-typo(meta); margin: density(2) 0 0; color: palette(tertiary.main); }
+.activityDot { width: 8px; height: 8px; margin-top: space(3); border-radius: radius(circle); background: palette(tertiary.main); }
+.activityDot[data-outcome="success"], .activityDot[data-operation="INSERT"] { background: palette(success.main); }
+.activityDot[data-outcome="failure"], .activityDot[data-operation="DELETE"] { background: palette(error.main); }
+.activityDot[data-outcome="denied"] { background: palette(warning.main); }
+.activityDot[data-operation="UPDATE"] { background: palette(primary.main); }
+.activityValues { width: 100%; margin-top: density(2); border-collapse: collapse; @ds-typo(caption); table-layout: fixed; }
 .activityValues th, .activityValues td { padding: density(1) density(2); border-bottom: border(hairline); overflow-wrap: anywhere; text-align: left; vertical-align: top; }
-.activityValues thead th { @ds-typo (emphasis); color: palette(tertiary-main); }
-.activityValues tbody th { @ds-typo (emphasis); width: 30%; color: palette(primary-dark); }
-.activityMore { @ds-button (chip); justify-self: center; min-height: 40px; padding: 0 density(5); border-radius: radius(pill); @ds-typo (small-strong); }
-.activityMore:hover:not(:disabled) { border-color: palette(primary-main); }
+.activityValues thead th { @ds-typo(emphasis); color: palette(tertiary.main); }
+.activityValues tbody th { @ds-typo(emphasis); width: 30%; color: palette(primary.dark); }
+.activityMore { @ds-button(chip); justify-self: center; min-height: 40px; padding: 0 density(5); border-radius: radius(pill); @ds-typo(small-strong); }
+.activityMore:hover:not(:disabled) { border-color: palette(primary.main); }
 .activityMore:disabled { cursor: progress; opacity: 0.6; }
 .activityToolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(3); }
-.activityDownload { @ds-button (secondary); min-height: 36px; padding: 0 density(4); border-radius: radius(2); @ds-typo (small-strong); }
-.activityDownload:hover:not(:disabled) { border-color: palette(primary-main); }
+.activityDownload { @ds-button(secondary); min-height: 36px; padding: 0 density(4); border-radius: radius(2); @ds-typo(small-strong); }
+.activityDownload:hover:not(:disabled) { border-color: palette(primary.main); }
 .activityDownload:disabled { cursor: not-allowed; opacity: 0.5; }
-.activitySubject { min-width: 0; color: palette(tertiary-dark); overflow-wrap: anywhere; }
-.activityItem code.activityRoute { @ds-typo (meta); justify-self: start; }
+.activitySubject { min-width: 0; color: palette(tertiary.dark); overflow-wrap: anywhere; }
+.activityItem code.activityRoute { @ds-typo(meta); justify-self: start; }
 .activityItemActions { display: flex; flex-wrap: wrap; align-items: baseline; gap: density(1) density(4); }
-.activityItemActions > button { @ds-button (link-accent); padding: 0; @ds-typo (label); }
+.activityItemActions > button { @ds-button(link-accent); padding: 0; @ds-typo(label); }
 .activityItemActions > button:hover { text-decoration: underline; }
-.activityItem pre { max-height: 260px; margin: density(2) 0 0; padding: density(2) density(3); overflow: auto; border-radius: radius(2); background: palette(surface-light); color: palette(dark-main); @ds-typo (code-sm); white-space: pre-wrap; overflow-wrap: anywhere; }
-.activityBack { @ds-button (link-accent); justify-self: start; padding: 0; @ds-typo (small-strong); }
+.activityItem pre { max-height: 260px; margin: density(2) 0 0; padding: density(2) density(3); overflow: auto; border-radius: radius(2); background: palette(surface.light); color: palette(dark.main); @ds-typo(code-sm); white-space: pre-wrap; overflow-wrap: anywhere; }
+.activityBack { @ds-button(link-accent); justify-self: start; padding: 0; @ds-typo(small-strong); }
 .activityBack:hover { text-decoration: underline; }
 .activityRequestHeader { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: density(3); }
 .activityRequestHeader > div { display: grid; gap: density(1); min-width: 0; }
 .activityRequestHeader h2 { margin: 0; }
-.activityRequestHeader p { @ds-typo(small); margin: 0; color: palette(tertiary-dark); overflow-wrap: anywhere; }
-.activityFacts { @ds-surface (panel); display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) md(repeat(3, minmax(0, 1fr))); gap: density(2) density(4); margin: 0; padding: density(3) density(4); border-radius: radius(2); }
+.activityRequestHeader p { @ds-typo(small); margin: 0; color: palette(tertiary.dark); overflow-wrap: anywhere; }
+.activityFacts { @ds-surface(panel); display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) md(repeat(3, minmax(0, 1fr))); gap: density(2) density(4); margin: 0; padding: density(3) density(4); border-radius: radius(2); }
 .activityFacts > div { display: grid; gap: space(1); min-width: 0; }
-.activityFacts dt { @ds-typo (meta-strong); color: palette(tertiary-main); }
-.activityFacts dd { display: flex; flex-wrap: wrap; align-items: center; gap: density(2); margin: 0; color: palette(dark-main); @ds-typo(small); overflow-wrap: anywhere; }
-.activityFacts dd code { @ds-typo (code-sm); overflow-wrap: anywhere; }
-.activityFacts dd button { @ds-button (secondary); padding: space(1) density(2); border-radius: radius(2); @ds-typo (meta-strong); }
+.activityFacts dt { @ds-typo(meta-strong); color: palette(tertiary.main); }
+.activityFacts dd { display: flex; flex-wrap: wrap; align-items: center; gap: density(2); margin: 0; color: palette(dark.main); @ds-typo(small); overflow-wrap: anywhere; }
+.activityFacts dd code { @ds-typo(code-sm); overflow-wrap: anywhere; }
+.activityFacts dd button { @ds-button(secondary); padding: space(1) density(2); border-radius: radius(2); @ds-typo(meta-strong); }
 .activityFactWide { grid-column: 1 / -1; }
 .activityProblems, .activityTimeline { display: grid; gap: density(2); }
-.activityProblems h3, .activityTimeline h3 { @ds-typo (eyebrow); margin: 0; color: palette(primary-main); }
+.activityProblems h3, .activityTimeline h3 { @ds-typo(eyebrow); margin: 0; color: palette(primary.main); }
 .activityProblems ol, .activityTimeline ol { margin: 0; padding: 0; border: border(hairline); border-radius: radius(2); list-style: none; }
 .activityProblems li { display: grid; gap: density(1); padding: density(3) density(4); border-left: border(warning-strong); }
-.activityProblems li[data-level="error"] { border-left-color: palette(error-main); }
+.activityProblems li[data-level="error"] { border-left-color: palette(error.main); }
 .activityProblems li + li { border-top: border(hairline); }
-.activityProblems p { display: flex; flex-wrap: wrap; align-items: baseline; gap: density(2); margin: 0; color: palette(dark-main); @ds-typo(small); }
-.activityProblems li[data-level="error"] strong { color: palette(error-dark); }
-.activityProblems li[data-level="warn"] strong { color: palette(warning-dark); }
-.activityProblems code { color: palette(tertiary-dark); @ds-typo (code-sm); }
-.activityProblems small { color: palette(tertiary-main); @ds-typo (caption); }
-.activityProblems pre { max-height: 260px; margin: density(1) 0 0; padding: density(2) density(3); overflow: auto; border-radius: radius(2); background: palette(surface-light); @ds-typo (code-sm); white-space: pre-wrap; overflow-wrap: anywhere; }
-.activityProblems summary { @ds-button (link); width: fit-content; @ds-typo (label); }
-.activityNote { @ds-typo (caption); margin: 0; color: palette(tertiary-main); }
-.activityDot[data-kind="ai"] { background: palette(secondary-main); }
-.activityDot[data-kind="change"] { background: palette(primary-main); }
-.activityDot[data-kind="action"] { background: palette(success-main); }
+.activityProblems p { display: flex; flex-wrap: wrap; align-items: baseline; gap: density(2); margin: 0; color: palette(dark.main); @ds-typo(small); }
+.activityProblems li[data-level="error"] strong { color: palette(error.dark); }
+.activityProblems li[data-level="warn"] strong { color: palette(warning.dark); }
+.activityProblems code { color: palette(tertiary.dark); @ds-typo(code-sm); }
+.activityProblems small { color: palette(tertiary.main); @ds-typo(caption); }
+.activityProblems pre { max-height: 260px; margin: density(1) 0 0; padding: density(2) density(3); overflow: auto; border-radius: radius(2); background: palette(surface.light); @ds-typo(code-sm); white-space: pre-wrap; overflow-wrap: anywhere; }
+.activityProblems summary { @ds-button(link); width: fit-content; @ds-typo(label); }
+.activityNote { @ds-typo(caption); margin: 0; color: palette(tertiary.main); }
+.activityDot[data-kind="ai"] { background: palette(secondary.main); }
+.activityDot[data-kind="change"] { background: palette(primary.main); }
+.activityDot[data-kind="action"] { background: palette(success.main); }
 .activityPanel .activityRequestHeader { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: density(3); }
 .activityItem[data-later="first"] { position: relative; margin-top: density(6); border-top: border(dashed); }
-.activityAfter { position: absolute; top: -1.6em; left: density(4); color: palette(tertiary-main); @ds-typo (meta-strong); }
+.activityAfter { position: absolute; top: -1.6em; left: density(4); color: palette(tertiary.main); @ds-typo(meta-strong); }
 .activityGroup { display: grid; gap: density(2); margin: density(2) 0 0; padding: 0 0 0 density(3); border-left: border(hairline); list-style: none; }
 .activityGroup > li > div { display: grid; gap: density(1); min-width: 0; }
 
@@ -3835,93 +3835,93 @@ button.sidebarTopicAvatar:focus-visible { outline: border(focus-soft); outline-o
 .autoGrid { display: grid; grid-template-columns: xs(1fr) md(repeat(2, minmax(0, 1fr))); align-items: start; gap: density(3); }
 .autoToggle { display: flex; align-items: flex-start; gap: density(2); }
 .autoToggle span { display: grid; gap: density(1); }
-.autoToggle strong { @ds-typo(body-strong); color: palette(primary-dark); }
+.autoToggle strong { @ds-typo(body-strong); color: palette(primary.dark); }
 .autoToggle small,
-.autoMeta { @ds-typo(meta); margin: 0; color: palette(tertiary-main); }
+.autoMeta { @ds-typo(meta); margin: 0; color: palette(tertiary.main); }
 .autoFieldset { display: grid; gap: density(3); margin: 0; padding: density(3); border: border(hairline); border-radius: radius(3); }
-.autoFieldset legend { @ds-typo(label); padding: 0 density(1); color: palette(primary-dark); }
+.autoFieldset legend { @ds-typo(label); padding: 0 density(1); color: palette(primary.dark); }
 .urgentList { display: grid; gap: density(2); margin: 0; padding: 0; list-style: none; }
 .urgentItem { @ds-surface(card); display: grid; gap: density(2); padding: density(3); }
 .urgentItemHeading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: density(2); }
-.urgentItemHeading strong { @ds-typo(body-strong); color: palette(primary-dark); }
-.urgentReasons { @ds-typo(fine); margin: 0; color: palette(tertiary-main); }
+.urgentItemHeading strong { @ds-typo(body-strong); color: palette(primary.dark); }
+.urgentReasons { @ds-typo(fine); margin: 0; color: palette(tertiary.main); }
 .urgentBanner { @ds-surface(notice-warning); display: grid; gap: density(3); margin-bottom: density(4); padding: density(4); }
-.urgentBanner h2 { @ds-typo(title-sm); margin: 0; color: palette(dark-main); }
-.urgentBannerEyebrow { @ds-typo(eyebrow); margin: 0; color: palette(warning-dark); }
-.navBadgeUrgent { background: palette(warning-main); color: palette(warning-contrast); }
+.urgentBanner h2 { @ds-typo(title-sm); margin: 0; color: palette(dark.main); }
+.urgentBannerEyebrow { @ds-typo(eyebrow); margin: 0; color: palette(warning.dark); }
+.navBadgeUrgent { background: palette(warning.main); color: palette(warning.contrast); }
 
 /* Instagram performance: what each post earned, the trend, how posts grow, what works, every post with its image. */
 .insights { display: grid; gap: density(4); margin-bottom: density(6); }
 .insightsHeader { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: density(3); }
-.insightsEyebrow { @ds-typo (eyebrow); margin: 0; color: palette(primary-dark); }
-.insightsTitle { @ds-typo (section-title); margin: 0; color: palette(dark-main); }
-.insightsLead { @ds-typo (compact); max-width: 46rem; margin: 0; color: palette(tertiary-dark); }
+.insightsEyebrow { @ds-typo(eyebrow); margin: 0; color: palette(primary.dark); }
+.insightsTitle { @ds-typo(section-title); margin: 0; color: palette(dark.main); }
+.insightsLead { @ds-typo(compact); max-width: 46rem; margin: 0; color: palette(tertiary.dark); }
 .insightsControls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: density(2); }
 .insightsSegment { display: inline-flex; flex-wrap: wrap; gap: density(1); }
-.insightsField { @ds-typo (meta-strong); display: grid; gap: density(1); color: palette(tertiary-dark); }
-.insightsField select, .insightsField input { @ds-input (field); min-width: 9rem; color: palette(dark-main); }
+.insightsField { @ds-typo(meta-strong); display: grid; gap: density(1); color: palette(tertiary.dark); }
+.insightsField select, .insightsField input { @ds-input(field); min-width: 9rem; color: palette(dark.main); }
 .insightsKpis { display: grid; grid-template-columns: xs(repeat(2, minmax(0, 1fr))) lg(repeat(4, minmax(0, 1fr))); gap: density(3); }
-.insightsKpi { @ds-surface (card); display: grid; align-content: start; gap: density(1); min-width: 0; padding: density(3) density(4); }
-.insightsKpiLabel { @ds-typo (eyebrow); color: palette(tertiary-main); }
-.insightsKpiValue { @ds-typo (figure); color: palette(dark-main); }
-.insightsKpiNote { @ds-typo (meta); margin: 0; color: palette(tertiary-dark); }
-.insightsDelta { @ds-typo (meta-strong); color: palette(tertiary-dark); }
-.insightsDelta[data-tone="up"] { color: palette(success-dark); }
-.insightsDelta[data-tone="down"] { color: palette(error-dark); }
+.insightsKpi { @ds-surface(card); display: grid; align-content: start; gap: density(1); min-width: 0; padding: density(3) density(4); }
+.insightsKpiLabel { @ds-typo(eyebrow); color: palette(tertiary.main); }
+.insightsKpiValue { @ds-typo(figure); color: palette(dark.main); }
+.insightsKpiNote { @ds-typo(meta); margin: 0; color: palette(tertiary.dark); }
+.insightsDelta { @ds-typo(meta-strong); color: palette(tertiary.dark); }
+.insightsDelta[data-tone="up"] { color: palette(success.dark); }
+.insightsDelta[data-tone="down"] { color: palette(error.dark); }
 .insightsBest { display: flex; align-items: center; gap: density(3); }
-.insightsBestImage { width: 2.75rem; height: 3.4rem; flex: none; border-radius: radius(1); background: palette(surface-light); object-fit: cover; }
+.insightsBestImage { width: 2.75rem; height: 3.4rem; flex: none; border-radius: radius(1); background: palette(surface.light); object-fit: cover; }
 .insightsCharts { display: grid; grid-template-columns: xs(minmax(0, 1fr)) lg(repeat(2, minmax(0, 1fr))); gap: density(3); }
-.insightsCard { @ds-surface (card); display: grid; align-content: start; gap: density(3); min-width: 0; padding: density(4); }
+.insightsCard { @ds-surface(card); display: grid; align-content: start; gap: density(3); min-width: 0; padding: density(4); }
 .insightsCardGrid { display: grid; align-content: start; gap: density(3); min-width: 0; }
-.insightsCardTitle { @ds-typo (title-sm); margin: 0; color: palette(dark-main); }
-.insightsCardNote { @ds-typo (meta); margin: 0; color: palette(tertiary-dark); }
+.insightsCardTitle { @ds-typo(title-sm); margin: 0; color: palette(dark.main); }
+.insightsCardNote { @ds-typo(meta); margin: 0; color: palette(tertiary.dark); }
 .insightsChart { display: block; width: 100%; height: auto; overflow: visible; }
-.insightsAxis { stroke: palette(dark-main, 0.16); }
-.insightsGrid { stroke: palette(dark-main, 0.06); }
-.insightsAxisLabel { @ds-typo (fine); fill: palette(tertiary-dark); }
-.insightsBar { fill: palette(primary-main, 0.45); transition: fill 150ms ease; }
-.insightsBar:hover { fill: palette(primary-main, 0.75); }
-.insightsBarActive { fill: palette(error-main); }
-.insightsTrendLine { fill: none; stroke: palette(warning-dark); stroke-linejoin: round; stroke-width: 2.5; }
-.insightsCurveMedian { fill: none; stroke: palette(dark-main); stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
-.insightsCurveA { fill: none; stroke: palette(primary-main); stroke-linejoin: round; stroke-width: 2; }
-.insightsCurveB { fill: none; stroke: palette(success-main); stroke-linejoin: round; stroke-width: 2; }
-.insightsCurveC { fill: none; stroke: palette(secondary-main); stroke-linejoin: round; stroke-width: 2; }
-.insightsCurveSelected { fill: none; stroke: palette(error-main); stroke-dasharray: 6 4; stroke-linejoin: round; stroke-width: 2.5; }
-.insightsLegend { @ds-typo (meta); display: flex; flex-wrap: wrap; gap: density(1) density(4); margin: 0; padding: 0; color: palette(tertiary-dark); list-style: none; }
+.insightsAxis { stroke: palette(dark.main, 0.16); }
+.insightsGrid { stroke: palette(dark.main, 0.06); }
+.insightsAxisLabel { @ds-typo(fine); fill: palette(tertiary.dark); }
+.insightsBar { fill: palette(primary.main, 0.45); transition: fill 150ms ease; }
+.insightsBar:hover { fill: palette(primary.main, 0.75); }
+.insightsBarActive { fill: palette(error.main); }
+.insightsTrendLine { fill: none; stroke: palette(warning.dark); stroke-linejoin: round; stroke-width: 2.5; }
+.insightsCurveMedian { fill: none; stroke: palette(dark.main); stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
+.insightsCurveA { fill: none; stroke: palette(primary.main); stroke-linejoin: round; stroke-width: 2; }
+.insightsCurveB { fill: none; stroke: palette(success.main); stroke-linejoin: round; stroke-width: 2; }
+.insightsCurveC { fill: none; stroke: palette(secondary.main); stroke-linejoin: round; stroke-width: 2; }
+.insightsCurveSelected { fill: none; stroke: palette(error.main); stroke-dasharray: 6 4; stroke-linejoin: round; stroke-width: 2.5; }
+.insightsLegend { @ds-typo(meta); display: flex; flex-wrap: wrap; gap: density(1) density(4); margin: 0; padding: 0; color: palette(tertiary.dark); list-style: none; }
 .insightsLegend li { display: inline-flex; align-items: center; gap: density(1); }
-.insightsSwatch { width: 0.875rem; height: 0.25rem; flex: none; border-radius: radius(pill); background: palette(dark-main); }
-.insightsSwatch[data-series="bar"] { height: 0.625rem; background: palette(primary-main, 0.45); }
-.insightsSwatch[data-series="trend"] { background: palette(warning-dark); }
-.insightsSwatch[data-series="a"] { background: palette(primary-main); }
-.insightsSwatch[data-series="b"] { background: palette(success-main); }
-.insightsSwatch[data-series="c"] { background: palette(secondary-main); }
-.insightsSwatch[data-series="selected"] { background: palette(error-main); }
+.insightsSwatch { width: 0.875rem; height: 0.25rem; flex: none; border-radius: radius(pill); background: palette(dark.main); }
+.insightsSwatch[data-series="bar"] { height: 0.625rem; background: palette(primary.main, 0.45); }
+.insightsSwatch[data-series="trend"] { background: palette(warning.dark); }
+.insightsSwatch[data-series="a"] { background: palette(primary.main); }
+.insightsSwatch[data-series="b"] { background: palette(success.main); }
+.insightsSwatch[data-series="c"] { background: palette(secondary.main); }
+.insightsSwatch[data-series="selected"] { background: palette(error.main); }
 .insightsBreakdown { display: grid; gap: density(2); margin: 0; padding: 0; list-style: none; }
-.insightsBreakdownRow { @ds-typo (compact); display: grid; grid-template-columns: minmax(7rem, 11rem) minmax(0, 1fr) auto; align-items: center; gap: density(3); color: palette(dark-main); }
-.insightsBreakdownTrack { height: 0.625rem; overflow: hidden; border-radius: radius(pill); background: palette(surface-light); }
-.insightsBreakdownFill { display: block; height: 100%; border-radius: radius(pill); background: palette(primary-main, 0.7); }
-.insightsBreakdownValue { @ds-typo (meta-strong); color: palette(tertiary-dark); white-space: nowrap; }
+.insightsBreakdownRow { @ds-typo(compact); display: grid; grid-template-columns: minmax(7rem, 11rem) minmax(0, 1fr) auto; align-items: center; gap: density(3); color: palette(dark.main); }
+.insightsBreakdownTrack { height: 0.625rem; overflow: hidden; border-radius: radius(pill); background: palette(surface.light); }
+.insightsBreakdownFill { display: block; height: 100%; border-radius: radius(pill); background: palette(primary.main, 0.7); }
+.insightsBreakdownValue { @ds-typo(meta-strong); color: palette(tertiary.dark); white-space: nowrap; }
 .insightsPostsHeader { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: density(3); }
 .insightsGridPosts { display: grid; grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr)); gap: density(3); }
-.insightsPost { @ds-surface (card); display: grid; grid-template-rows: auto 1fr; min-width: 0; overflow: hidden; }
-.insightsPostImage { position: relative; display: block; aspect-ratio: 4 / 5; overflow: hidden; background: palette(surface-light); }
+.insightsPost { @ds-surface(card); display: grid; grid-template-rows: auto 1fr; min-width: 0; overflow: hidden; }
+.insightsPostImage { position: relative; display: block; aspect-ratio: 4 / 5; overflow: hidden; background: palette(surface.light); }
 .insightsPostImage img { display: block; width: 100%; height: 100%; object-fit: cover; }
-.insightsRank { @ds-typo (badge); position: absolute; top: density(2); left: density(2); padding: density(1) density(2); border-radius: radius(pill); background: palette(dark-main, 0.78); color: palette(light-light); }
+.insightsRank { @ds-typo(badge); position: absolute; top: density(2); left: density(2); padding: density(1) density(2); border-radius: radius(pill); background: palette(dark.main, 0.78); color: palette(light.light); }
 .insightsPostBody { display: grid; align-content: start; gap: density(2); padding: density(3); }
 .insightsPostValue { display: flex; align-items: baseline; gap: density(1); }
-.insightsPostValue strong { @ds-typo (title); color: palette(dark-main); }
-.insightsPostValue span { @ds-typo (meta); color: palette(tertiary-dark); }
-.insightsPostMeta { @ds-typo (meta); margin: 0; color: palette(tertiary-dark); }
-.insightsPostCaption { @ds-typo (compact); display: -webkit-box; margin: 0; overflow: hidden; color: palette(dark-main); -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
+.insightsPostValue strong { @ds-typo(title); color: palette(dark.main); }
+.insightsPostValue span { @ds-typo(meta); color: palette(tertiary.dark); }
+.insightsPostMeta { @ds-typo(meta); margin: 0; color: palette(tertiary.dark); }
+.insightsPostCaption { @ds-typo(compact); display: -webkit-box; margin: 0; overflow: hidden; color: palette(dark.main); -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
 .insightsSpark { display: block; width: 100%; height: 1.75rem; }
-.insightsSparkLine { fill: none; stroke: palette(primary-main); stroke-linejoin: round; stroke-width: 2; vector-effect: non-scaling-stroke; }
-.insightsSparkMedian { fill: none; stroke: palette(dark-main, 0.3); stroke-dasharray: 3 3; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
-.insightsPlaceholder { @ds-typo (meta); display: grid; place-items: center; width: 100%; height: 100%; background: palette(surface-light); color: palette(tertiary-main); }
+.insightsSparkLine { fill: none; stroke: palette(primary.main); stroke-linejoin: round; stroke-width: 2; vector-effect: non-scaling-stroke; }
+.insightsSparkMedian { fill: none; stroke: palette(dark.main, 0.3); stroke-dasharray: 3 3; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
+.insightsPlaceholder { @ds-typo(meta); display: grid; place-items: center; width: 100%; height: 100%; background: palette(surface.light); color: palette(tertiary.main); }
 .insightsDetail { display: grid; grid-template-columns: xs(minmax(0, 1fr)) md(minmax(10rem, 16rem) minmax(0, 1fr)); align-items: start; gap: density(4); }
-.insightsDetailImage { width: 100%; aspect-ratio: 4 / 5; border-radius: radius(2); background: palette(surface-light); object-fit: cover; }
-.insightsTable { @ds-typo (compact); width: 100%; border-collapse: collapse; color: palette(dark-main); }
+.insightsDetailImage { width: 100%; aspect-ratio: 4 / 5; border-radius: radius(2); background: palette(surface.light); object-fit: cover; }
+.insightsTable { @ds-typo(compact); width: 100%; border-collapse: collapse; color: palette(dark.main); }
 .insightsTable th, .insightsTable td { padding: density(1) density(2); border-bottom: border(hairline); text-align: right; white-space: nowrap; }
 .insightsTable th:first-child, .insightsTable td:first-child { text-align: left; }
-.insightsTable thead th { @ds-typo (meta-strong); color: palette(tertiary-dark); }
-.insightsEmpty { @ds-typo (compact); margin: 0; color: palette(tertiary-dark); }
+.insightsTable thead th { @ds-typo(meta-strong); color: palette(tertiary.dark); }
+.insightsEmpty { @ds-typo(compact); margin: 0; color: palette(tertiary.dark); }
diff --git a/src/app/topic-configuration-panel.module.uxdsl b/src/app/topic-configuration-panel.module.uxdsl
index 9a99b31..95c02aa 100644
--- a/src/app/topic-configuration-panel.module.uxdsl
+++ b/src/app/topic-configuration-panel.module.uxdsl
@@ -1,6 +1,6 @@
 .panel {
   @ds-surface(contained surface 4);
-  border-color: palette(primary-light, 0.28);
+  border-color: palette(primary.light, 0.28);
   padding: density(4);
 }
 
@@ -46,15 +46,15 @@
 .heading p,
 .sourcesHeading p,
 .knowledgeHeading p {
-  @ds-typo (eyebrow);
+  @ds-typo(eyebrow);
   margin: 0 0 space(2);
-  color: palette(primary-main);
+  color: palette(primary.main);
 }
 
 /* The panel eyebrow matches the dashboard's .eyebrow so every view opens the same way. */
 .heading > div > p {
 
-  @ds-typo (meta-strong);
+  @ds-typo(meta-strong);
 }
 
 .heading h2,
@@ -62,7 +62,7 @@
 .knowledgeHeading h3 {
   @ds-typo(h3);
   margin: 0;
-  color: palette(dark-main);
+  color: palette(dark.main);
 }
 
 .heading small,
@@ -71,7 +71,7 @@
   @ds-typo(small);
   display: block;
   margin-top: density(2);
-  color: palette(tertiary-main);
+  color: palette(tertiary.main);
 }
 
 .count,
@@ -87,8 +87,8 @@
   @ds-typo(caption);
   border-radius: radius(5);
   padding: density(1) density(2);
-  background: palette(warning-light);
-  color: palette(warning-dark);
+  background: palette(warning.light);
+  color: palette(warning.dark);
   white-space: nowrap;
 }
 
@@ -96,20 +96,20 @@
   @ds-typo(caption);
   border-radius: radius(5);
   padding: density(1) density(2);
-  background: palette(error-light);
-  color: palette(error-main);
+  background: palette(error.light);
+  color: palette(error.main);
   white-space: nowrap;
 }
 
 .count,
 .enabled {
-  background: palette(surface-light);
-  color: palette(primary-dark);
+  background: palette(surface.light);
+  color: palette(primary.dark);
 }
 
 .disabled {
-  background: palette(light-light);
-  color: palette(tertiary-main);
+  background: palette(light.light);
+  color: palette(tertiary.main);
 }
 
 .topicRow {
@@ -118,7 +118,7 @@
   margin-top: density(6);
   padding: density(4);
   border-radius: radius(3);
-  background: palette(light-light);
+  background: palette(light.light);
 }
 
 .topicForm label,
@@ -127,18 +127,18 @@
   @ds-typo(caption);
   display: grid;
   gap: density(1);
-  color: palette(dark-main);
+  color: palette(dark.main);
 }
 
-.topicRowContext { margin: 0; color: palette(tertiary-dark); @ds-typo(small); }
-.topicRowContext strong { color: palette(dark-main); }
-.topicSetupGuide { @ds-surface (boxed); display: grid; gap: density(3); margin-top: density(5); padding: density(4); border-radius: radius(3); }
-.topicSetupGuide h3 { margin: 0; color: palette(dark-main); @ds-typo (title); }
-.topicSetupGuide > p { margin: 0; color: palette(tertiary-dark); @ds-typo(small); }
+.topicRowContext { margin: 0; color: palette(tertiary.dark); @ds-typo(small); }
+.topicRowContext strong { color: palette(dark.main); }
+.topicSetupGuide { @ds-surface(boxed); display: grid; gap: density(3); margin-top: density(5); padding: density(4); border-radius: radius(3); }
+.topicSetupGuide h3 { margin: 0; color: palette(dark.main); @ds-typo(title); }
+.topicSetupGuide > p { margin: 0; color: palette(tertiary.dark); @ds-typo(small); }
 .topicSetupGuide ol { display: grid; grid-template-columns: xs(minmax(0, 1fr)) md(repeat(2, minmax(0, 1fr))); gap: density(2); margin: 0; padding: 0; list-style: none; }
-.topicSetupGuide a { @ds-typo (emphasis); display: grid; min-height: 44px; gap: density(1); padding: density(3); border: border(control); border-radius: radius(2); color: palette(primary-dark); text-decoration: none; }
-.topicSetupGuide a:hover, .topicSetupGuide a:focus-visible { border-color: palette(primary-main); background: palette(primary-light); }
-.topicSetupGuide a span { color: palette(tertiary-dark); @ds-typo (caption); }
+.topicSetupGuide a { @ds-typo(emphasis); display: grid; min-height: 44px; gap: density(1); padding: density(3); border: border(control); border-radius: radius(2); color: palette(primary.dark); text-decoration: none; }
+.topicSetupGuide a:hover, .topicSetupGuide a:focus-visible { border-color: palette(primary.main); background: palette(primary.light); }
+.topicSetupGuide a span { color: palette(tertiary.dark); @ds-typo(caption); }
 
 .topicActions,
 .sourceActions,
@@ -155,9 +155,9 @@
   padding: density(2) density(3);
 }
 
-.panel button:not([data-ui-button]):hover:not(:disabled) { background: palette(light-light); }
+.panel button:not([data-ui-button]):hover:not(:disabled) { background: palette(light.light); }
 .panel button:not([data-ui-button]):disabled { cursor: not-allowed; opacity: 0.55; }
-.panel .remove { border-color: palette(error-light); color: palette(error-main); }
+.panel .remove { border-color: palette(error.light); color: palette(error.main); }
 
 .locked,
 .loading,
@@ -170,15 +170,15 @@
   padding: density(3);
 }
 
-.locked { background: palette(light-light); color: palette(tertiary-main); }
-.loading { color: palette(tertiary-main); }
-.empty { display: grid; gap: density(1); background: palette(light-light); color: palette(dark-main); }
-.notice { background: palette(light-light); color: palette(primary-dark); }
-.error { background: palette(error-light); color: palette(error-main); }
+.locked { background: palette(light.light); color: palette(tertiary.main); }
+.loading { color: palette(tertiary.main); }
+.empty { display: grid; gap: density(1); background: palette(light.light); color: palette(dark.main); }
+.notice { background: palette(light.light); color: palette(primary.dark); }
+.error { background: palette(error.light); color: palette(error.main); }
 
 .topicForm,
 .sourceForm {
-  @ds-surface (boxed);
+  @ds-surface(boxed);
   border: border(1);
   display: grid;
   gap: density(4);
@@ -189,7 +189,7 @@
 
 .topicForm { grid-template-columns: xs(1fr) sm(minmax(12rem, 1fr) minmax(15rem, 2fr) minmax(10rem, 1fr) auto); align-items: end; }
 .themeField select { @ds-input(outlined primary 2); }
-.sourceForm > p { @ds-typo(small); margin: 0; color: palette(tertiary-main); }
+.sourceForm > p { @ds-typo(small); margin: 0; color: palette(tertiary.main); }
 
 .formGrid { display: grid; grid-template-columns: xs(1fr) sm(repeat(2, minmax(0, 1fr))); gap: density(3); }
 
@@ -216,7 +216,7 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   padding: 0;
   border: none;
   background: initial;
-  accent-color: palette(primary-main);
+  accent-color: palette(primary.main);
   cursor: pointer;
 }
 
@@ -249,10 +249,10 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   justify-self: start;
 }
 
-.linkedSources h3 { @ds-typo(h5); margin: 0; color: palette(dark-main); }
-.linkedSources p { @ds-typo(small); margin: 0; color: palette(tertiary-main); }
+.linkedSources h3 { @ds-typo(h5); margin: 0; color: palette(dark.main); }
+.linkedSources p { @ds-typo(small); margin: 0; color: palette(tertiary.main); }
 .linkedSources a,
-.catalogList a { @ds-typo(small); overflow-wrap: anywhere; color: palette(primary-dark); }
+.catalogList a { @ds-typo(small); overflow-wrap: anywhere; color: palette(primary.dark); }
 
 .linkChoice,
 .topicChoices label {
@@ -261,7 +261,7 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   align-items: flex-start;
   gap: density(2);
   min-width: 0;
-  color: palette(dark-main);
+  color: palette(dark.main);
 }
 
 .panel .linkChoice input[type="checkbox"],
@@ -272,7 +272,7 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   height: density(3);
   min-height: 0;
   padding: 0;
-  accent-color: palette(primary-main);
+  accent-color: palette(primary.main);
 }
 
 .topicChoices {
@@ -284,7 +284,7 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   padding: density(3);
 }
 
-.topicChoices legend { @ds-typo(caption); color: palette(tertiary-main); }
+.topicChoices legend { @ds-typo(caption); color: palette(tertiary.main); }
 
 .catalogFilters {
   display: flex;
@@ -298,7 +298,7 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   display: grid;
   gap: density(1);
   min-width: xs(100%) sm(12rem);
-  color: palette(dark-main);
+  color: palette(dark.main);
 }
 
 .catalogList {
@@ -309,9 +309,9 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   list-style: none;
 }
 
-.catalogList strong { @ds-typo(body); color: palette(dark-main); }
+.catalogList strong { @ds-typo(body); color: palette(dark.main); }
 .catalogList small,
-.catalogList p { @ds-typo(small); margin: 0; color: palette(tertiary-main); }
+.catalogList p { @ds-typo(small); margin: 0; color: palette(tertiary.main); }
 
 .catalogLinks {
   display: flex;
@@ -326,9 +326,9 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   flex-wrap: wrap;
   gap: density(2);
   border-radius: radius(2);
-  background: palette(surface-light);
+  background: palette(surface.light);
   padding: density(2);
-  color: palette(primary-dark);
+  color: palette(primary.dark);
 }
 
 .sourcesHeading { margin: 0; }
@@ -341,14 +341,14 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
 .documentList > li { @ds-surface(outlined surface 3); flex-wrap: wrap; justify-content: space-between; gap: density(3); padding: density(3); }
 .sourceCopy { min-width: 0; flex: 1; display: grid; gap: density(1); }
 .sourceCopy > div { display: flex; align-items: center; gap: density(1); }
-.sourceCopy a { @ds-typo(caption); overflow: hidden; color: palette(primary-dark); text-overflow: ellipsis; white-space: nowrap; }
-.sourceCopy small { @ds-typo(small); color: palette(tertiary-main); }
-.preview { @ds-typo(caption); width: 100%; border-top: border(1); padding-top: density(3); color: palette(dark-main); }
+.sourceCopy a { @ds-typo(caption); overflow: hidden; color: palette(primary.dark); text-overflow: ellipsis; white-space: nowrap; }
+.sourceCopy small { @ds-typo(small); color: palette(tertiary.main); }
+.preview { @ds-typo(caption); width: 100%; border-top: border(1); padding-top: density(3); color: palette(dark.main); }
 .preview ol { display: grid; gap: density(1); margin: density(2) 0 0; padding-left: density(5); }
-.preview a { color: palette(primary-dark); }
-.inlineError { @ds-typo(small); color: palette(error-main); }
+.preview a { color: palette(primary.dark); }
+.inlineError { @ds-typo(small); color: palette(error.main); }
 .documentSections { width: 100%; border-top: border(1); padding-top: density(3); }
-.documentSections > strong { @ds-typo(body); color: palette(dark-main); }
+.documentSections > strong { @ds-typo(body); color: palette(dark.main); }
 .dossierBuilder {
   @ds-surface(flat neutral);
   border-radius: radius(3);
@@ -361,36 +361,36 @@ label.toggle { display: flex; align-items: center; gap: density(1); }
   border: border(1);
 }
 .dossierBuilder > div { display: grid; gap: density(1); }
-.dossierBuilder strong { @ds-typo(caption); color: palette(primary-dark); }
-.dossierBuilder small { @ds-typo(small); color: palette(tertiary-main); }
+.dossierBuilder strong { @ds-typo(caption); color: palette(primary.dark); }
+.dossierBuilder small { @ds-typo(small); color: palette(tertiary.main); }
 .dossierTitle { display: grid; gap: density(1); }
-.dossierTitle span { @ds-typo(small); color: palette(tertiary-main); }
+.dossierTitle span { @ds-typo(small); color: palette(tertiary.main); }
 .dossierTitle input { @ds-input(outlined neutral 2); width: 100%; }
 .documentSections ol { display: grid; gap: density(2); margin: density(3) 0 0; padding-left: density(5); }
-.documentSections li { display: flex; align-items: center; justify-content: space-between; gap: density(3); color: palette(dark-main); }
+.documentSections li { display: flex; align-items: center; justify-content: space-between; gap: density(3); color: palette(dark.main); }
 .documentSections li > div { min-width: 0; }
 .documentSections li span { @ds-typo(caption); display: block; }
-.documentSections li small { @ds-typo(small); display: block; color: palette(tertiary-main); }
+.documentSections li small { @ds-typo(small); display: block; color: palette(tertiary.main); }
 .chapterSelect { display: flex; align-items: center; gap: density(2); cursor: pointer; }
-.chapterSelect input { accent-color: palette(primary-main); }
+.chapterSelect input { accent-color: palette(primary.main); }
 .documentSections .candidateReady {
   border-radius: radius(5);
-  background: palette(surface-light);
-  color: palette(primary-dark);
+  background: palette(surface.light);
+  color: palette(primary.dark);
   padding: density(1) density(2);
   white-space: nowrap;
 }
 
-.topicCardsHeading { @ds-typo (eyebrow); margin: density(6) 0 0; color: palette(primary-main); }
+.topicCardsHeading { @ds-typo(eyebrow); margin: density(6) 0 0; color: palette(primary.main); }
 .topicCards { display: grid; grid-template-columns: xs(1fr) sm(repeat(2, minmax(0, 1fr))) xl(repeat(3, minmax(0, 1fr))); gap: density(4); margin-block: density(3) density(6); }
-.topicCard { @ds-button (secondary); display: grid; overflow: hidden; min-width: 0; padding: 0; border-radius: radius(3); color: palette(dark-main); text-align: left; }
-.topicCard:hover:not(:disabled), .topicCard:focus-visible { border-color: palette(primary-main, 0.65); box-shadow: shadow(2); }
-.topicCard.topicCardActive { border-color: palette(primary-main); box-shadow: shadow(ring); }
+.topicCard { @ds-button(secondary); display: grid; overflow: hidden; min-width: 0; padding: 0; border-radius: radius(3); color: palette(dark.main); text-align: left; }
+.topicCard:hover:not(:disabled), .topicCard:focus-visible { border-color: palette(primary.main, 0.65); box-shadow: shadow(2); }
+.topicCard.topicCardActive { border-color: palette(primary.main); box-shadow: shadow(ring); }
 .topicCard:disabled { cursor: not-allowed; opacity: 0.65; }
-.topicCardPreview { display: grid; height: 90px; place-items: center; background: linear-gradient(135deg, palette(primary-main), palette(secondary-main)); color: palette(primary-contrast); @ds-typo (monogram); }
+.topicCardPreview { display: grid; height: 90px; place-items: center; background: linear-gradient(135deg, palette(primary.main), palette(secondary.main)); color: palette(primary.contrast); @ds-typo(monogram); }
 .topicCardCopy { display: grid; gap: density(2); padding: density(4); }
-.topicCardCopy strong { color: palette(dark-main); @ds-typo (title-sm); }
-.topicCardCopy small { overflow: hidden; color: palette(tertiary-main); @ds-typo (caption); text-overflow: ellipsis; white-space: nowrap; }
-.topicCardCopy > span { color: palette(primary-dark); @ds-typo (meta-strong); }
+.topicCardCopy strong { color: palette(dark.main); @ds-typo(title-sm); }
+.topicCardCopy small { overflow: hidden; color: palette(tertiary.main); @ds-typo(caption); text-overflow: ellipsis; white-space: nowrap; }
+.topicCardCopy > span { color: palette(primary.dark); @ds-typo(meta-strong); }
 .topicAdvanced { margin-top: density(6); border-top: border(subtle); }
-.topicAdvanced > summary { @ds-button (link); min-height: 44px; padding-block: density(4); @ds-typo (small-strong); }
+.topicAdvanced > summary { @ds-button(link); min-height: 44px; padding-block: density(4); @ds-typo(small-strong); }
diff --git a/src/app/ui/primitives.module.uxdsl b/src/app/ui/primitives.module.uxdsl
index fc0f60f..2fe6191 100644
--- a/src/app/ui/primitives.module.uxdsl
+++ b/src/app/ui/primitives.module.uxdsl
@@ -1,4 +1,4 @@
-.button { @ds-button(outlined primary 2); display: inline-flex; align-items: center; justify-content: center; gap: density(2); max-width: 100%; min-height: 40px; padding: 0 density(4); @ds-typo (small-strong); text-align: center; text-decoration: none; cursor: pointer; transition: background 150ms ease, border-color 150ms ease, color 150ms ease; }
+.button { @ds-button(outlined primary 2); display: inline-flex; align-items: center; justify-content: center; gap: density(2); max-width: 100%; min-height: 40px; padding: 0 density(4); @ds-typo(small-strong); text-align: center; text-decoration: none; cursor: pointer; transition: background 150ms ease, border-color 150ms ease, color 150ms ease; }
 .buttonCompact { min-height: 36px; padding-inline: density(3); }
 .buttonPrimary { @ds-button(contained primary 2); }
 .buttonSecondary { @ds-button(outlined primary 2); }
@@ -6,93 +6,93 @@
 .buttonDestructive { @ds-button(outlined error 2); }
 .button.buttonPrimary, .button.buttonSecondary, .button.buttonQuiet, .button.buttonDestructive { padding-block: 0; }
 .button.buttonCompact { padding: 0 density(3); }
-.buttonSecondary, .buttonQuiet { color: palette(primary-dark); }
-.buttonSecondary { border-color: palette(primary-dark); }
-.buttonDestructive { color: palette(dark-main); background: color-mix(in srgb, palette(error-main) 10%, palette(light-light)); border-color: palette(error-dark); }
-.buttonPrimary:hover:not(:disabled) { background: palette(primary-dark); }
-.buttonSecondary:hover:not(:disabled), .buttonQuiet:hover:not(:disabled) { background: palette(primary-light); color: palette(primary-dark); border-color: palette(primary-dark); }
-.buttonDestructive:hover:not(:disabled) { background: color-mix(in srgb, palette(error-main) 20%, palette(light-light)); color: palette(dark-main); border-color: palette(error-dark); }
+.buttonSecondary, .buttonQuiet { color: palette(primary.dark); }
+.buttonSecondary { border-color: palette(primary.dark); }
+.buttonDestructive { color: palette(dark.main); background: color-mix(in srgb, palette(error.main) 10%, palette(light.light)); border-color: palette(error.dark); }
+.buttonPrimary:hover:not(:disabled) { background: palette(primary.dark); }
+.buttonSecondary:hover:not(:disabled), .buttonQuiet:hover:not(:disabled) { background: palette(primary.light); color: palette(primary.dark); border-color: palette(primary.dark); }
+.buttonDestructive:hover:not(:disabled) { background: color-mix(in srgb, palette(error.main) 20%, palette(light.light)); color: palette(dark.main); border-color: palette(error.dark); }
 .button:disabled { opacity: 0.55; cursor: not-allowed; }
 .button:focus-visible, .tabs a:focus-visible { outline: border(focus-strong); outline-offset: space(1); }
 .iconButton { width: 40px; padding: 0; flex: none; }
 .iconButton.buttonCompact { width: 36px; }
 @media (max-width: 639px), (pointer: coarse) { .button { min-height: 44px; } .iconButton, .iconButton.buttonCompact { width: 44px; } }
-.surface { @ds-surface(contained surface 3); border-color: color-mix(in srgb, palette(dark-main) 16%, transparent); }
+.surface { @ds-surface(contained surface 3); border-color: color-mix(in srgb, palette(dark.main) 16%, transparent); }
 .surfaceSubtle { @ds-surface(flat light 3); border: border(control); }
 .sectionHeader { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: density(4); }
-.sectionHeader h2, .sectionHeader h3 { margin: 0; color: palette(dark-main); @ds-typo (title-lg); }
+.sectionHeader h2, .sectionHeader h3 { margin: 0; color: palette(dark.main); @ds-typo(title-lg); }
 .sectionHeader h3 {
- @ds-typo (title); }
-.eyebrow { margin: 0 0 density(1); color: palette(primary-dark); @ds-typo (eyebrow); }
-.description { margin: density(1) 0 0; color: palette(tertiary-dark); @ds-typo(small); }
+ @ds-typo(title); }
+.eyebrow { margin: 0 0 density(1); color: palette(primary.dark); @ds-typo(eyebrow); }
+.description { margin: density(1) 0 0; color: palette(tertiary.dark); @ds-typo(small); }
 .headerActions, .actionRow { display: flex; align-items: center; flex-wrap: wrap; gap: density(2); }
 .formField { display: grid; gap: density(1); }
-.formField label { display: grid; gap: density(1); color: palette(dark-main); @ds-typo (small-strong); }
+.formField label { display: grid; gap: density(1); color: palette(dark.main); @ds-typo(small-strong); }
 .fieldLabel { display: flex; align-items: baseline; gap: density(2); }
-.fieldLabel small { color: palette(tertiary-dark); @ds-typo (caption); }
+.fieldLabel small { color: palette(tertiary.dark); @ds-typo(caption); }
 .formField input:not([type="checkbox"]):not([type="radio"]), .formField select, .formField textarea { @ds-input(outlined primary 2); width: 100%; min-height: 40px; padding: density(2) density(3); @ds-typo(small); }
 .formField input:focus-visible, .formField select:focus-visible, .formField textarea:focus-visible { outline: border(focus-strong); outline-offset: space(1); }
-.formFieldError input:not([type="checkbox"]):not([type="radio"]), .formFieldError select, .formFieldError textarea { border-color: palette(error-main); }
+.formFieldError input:not([type="checkbox"]):not([type="radio"]), .formFieldError select, .formFieldError textarea { border-color: palette(error.main); }
 .fieldHelp, .fieldError { margin: 0; @ds-typo(caption); }
-.fieldHelp { color: palette(tertiary-dark); }
-.fieldError { @ds-typo (label); color: palette(dark-main); }
-.statusBadge { display: inline-flex; align-items: center; border-radius: radius(pill); padding: density(1) density(2); @ds-typo (label); color: palette(dark-main); border: border(current); }
-.statusNeutral { background: color-mix(in srgb, palette(neutral-main) 13%, palette(light-light)); border-color: palette(neutral-main); }
-.statusSuccess { background: color-mix(in srgb, palette(success-main) 12%, palette(light-light)); border-color: palette(success-main); }
-.statusWarning { background: color-mix(in srgb, palette(warning-main) 12%, palette(light-light)); border-color: palette(warning-main); }
-.statusError { background: color-mix(in srgb, palette(error-main) 12%, palette(light-light)); border-color: palette(error-main); }
-.statusInfo { background: color-mix(in srgb, palette(info-main) 12%, palette(light-light)); border-color: palette(info-main); }
-.inlineNotice { display: grid; gap: density(1); padding: density(3); border-radius: radius(2); border: border(current); color: palette(dark-main); @ds-typo(small); }
-.noticeInfo { background: color-mix(in srgb, palette(info-main) 10%, palette(light-light)); border-color: palette(info-main); }
-.noticeSuccess { background: color-mix(in srgb, palette(success-main) 10%, palette(light-light)); border-color: palette(success-main); }
-.noticeWarning { background: color-mix(in srgb, palette(warning-main) 10%, palette(light-light)); border-color: palette(warning-main); }
-.noticeError { background: color-mix(in srgb, palette(error-main) 10%, palette(light-light)); border-color: palette(error-main); }
-.emptyState { display: grid; justify-items: start; gap: density(2); padding: density(5); border: border(dashed-control); border-radius: radius(3); color: palette(tertiary-dark); @ds-typo(small); }
-.emptyState strong { color: palette(dark-main); @ds-typo(body); }
-.loadingState { display: inline-flex; align-items: center; gap: density(2); color: palette(tertiary-dark); @ds-typo(small); }
-.loadingMark { width: 1rem; height: 1rem; border: border(focus-soft); border-top-color: palette(primary-main); border-radius: radius(circle); animation: spin 900ms linear infinite; }
+.fieldHelp { color: palette(tertiary.dark); }
+.fieldError { @ds-typo(label); color: palette(dark.main); }
+.statusBadge { display: inline-flex; align-items: center; border-radius: radius(pill); padding: density(1) density(2); @ds-typo(label); color: palette(dark.main); border: border(current); }
+.statusNeutral { background: color-mix(in srgb, palette(neutral.main) 13%, palette(light.light)); border-color: palette(neutral.main); }
+.statusSuccess { background: color-mix(in srgb, palette(success.main) 12%, palette(light.light)); border-color: palette(success.main); }
+.statusWarning { background: color-mix(in srgb, palette(warning.main) 12%, palette(light.light)); border-color: palette(warning.main); }
+.statusError { background: color-mix(in srgb, palette(error.main) 12%, palette(light.light)); border-color: palette(error.main); }
+.statusInfo { background: color-mix(in srgb, palette(info.main) 12%, palette(light.light)); border-color: palette(info.main); }
+.inlineNotice { display: grid; gap: density(1); padding: density(3); border-radius: radius(2); border: border(current); color: palette(dark.main); @ds-typo(small); }
+.noticeInfo { background: color-mix(in srgb, palette(info.main) 10%, palette(light.light)); border-color: palette(info.main); }
+.noticeSuccess { background: color-mix(in srgb, palette(success.main) 10%, palette(light.light)); border-color: palette(success.main); }
+.noticeWarning { background: color-mix(in srgb, palette(warning.main) 10%, palette(light.light)); border-color: palette(warning.main); }
+.noticeError { background: color-mix(in srgb, palette(error.main) 10%, palette(light.light)); border-color: palette(error.main); }
+.emptyState { display: grid; justify-items: start; gap: density(2); padding: density(5); border: border(dashed-control); border-radius: radius(3); color: palette(tertiary.dark); @ds-typo(small); }
+.emptyState strong { color: palette(dark.main); @ds-typo(body); }
+.loadingState { display: inline-flex; align-items: center; gap: density(2); color: palette(tertiary.dark); @ds-typo(small); }
+.loadingMark { width: 1rem; height: 1rem; border: border(focus-soft); border-top-color: palette(primary.main); border-radius: radius(circle); animation: spin 900ms linear infinite; }
 @keyframes spin { to { transform: rotate(360deg); } }
 @media (prefers-reduced-motion: reduce) { .loadingMark { animation: none; } }
 .tabs { display: flex; flex-wrap: wrap; gap: density(1); border-bottom: border(control); }
-.tabs a { display: inline-flex; align-items: center; min-height: 40px; padding: density(2) density(3); border-bottom: border(clear); color: palette(tertiary-dark); @ds-typo (small-strong); text-decoration: none; }
-.tabs a:hover { color: palette(primary-dark); background: palette(primary-light); }
-.tabs .tabCurrent { color: palette(primary-dark); border-bottom-color: palette(primary-main); }
-.dialogBackdrop { position: fixed; z-index: 50; display: grid; place-items: center; inset: 0; padding: xs(density(4)) md(density(5)); background: palette(dark-main, 0.48); backdrop-filter: blur(6px); }
-.dialog { @ds-surface (boxed); display: flex; flex-direction: column; width: min(640px, 100%); max-height: xs(calc(100svh - 24px)) md(min(820px, calc(100svh - 48px))); overflow: hidden; border-radius: radius(3); color: palette(dark-main); box-shadow: shadow(overlay); }
+.tabs a { display: inline-flex; align-items: center; min-height: 40px; padding: density(2) density(3); border-bottom: border(clear); color: palette(tertiary.dark); @ds-typo(small-strong); text-decoration: none; }
+.tabs a:hover { color: palette(primary.dark); background: palette(primary.light); }
+.tabs .tabCurrent { color: palette(primary.dark); border-bottom-color: palette(primary.main); }
+.dialogBackdrop { position: fixed; z-index: 50; display: grid; place-items: center; inset: 0; padding: xs(density(4)) md(density(5)); background: palette(dark.main, 0.48); backdrop-filter: blur(6px); }
+.dialog { @ds-surface(boxed); display: flex; flex-direction: column; width: min(640px, 100%); max-height: xs(calc(100svh - 24px)) md(min(820px, calc(100svh - 48px))); overflow: hidden; border-radius: radius(3); color: palette(dark.main); box-shadow: shadow(overlay); }
 .dialogHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: density(4); padding: density(5) density(5) density(4); border-bottom: border(control); }
-.dialogHeader h2 { margin: 0; @ds-typo (title); }
+.dialogHeader h2 { margin: 0; @ds-typo(title); }
 .dialogBody { display: grid; gap: density(3); overflow: auto; padding: density(5); @ds-typo(small); }
 .dialogFooter { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: density(2); padding: density(4) density(5); border-top: border(control); }
-.channelCard { display: grid; gap: density(3); min-width: 0; @ds-surface(contained surface 4); border-color: color-mix(in srgb, palette(dark-main) 16%, transparent); }
+.channelCard { display: grid; gap: density(3); min-width: 0; @ds-surface(contained surface 4); border-color: color-mix(in srgb, palette(dark.main) 16%, transparent); }
 .channelCardHeader { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: density(3); }
-.channelCardHeader h3 { margin: 0; color: palette(dark-main); @ds-typo (title); }
-.channelCardHeader p { margin: density(1) 0 0; color: palette(tertiary-dark); @ds-typo(small); overflow-wrap: anywhere; }
+.channelCardHeader h3 { margin: 0; color: palette(dark.main); @ds-typo(title); }
+.channelCardHeader p { margin: density(1) 0 0; color: palette(tertiary.dark); @ds-typo(small); overflow-wrap: anywhere; }
 .channelCardDetails { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: density(3); margin: 0; }
-.channelCardDetails dt { color: palette(tertiary-dark); @ds-typo (label); }
-.channelCardDetails dd { margin: 0; color: palette(dark-main); @ds-typo(small); overflow-wrap: anywhere; }
+.channelCardDetails dt { color: palette(tertiary.dark); @ds-typo(label); }
+.channelCardDetails dd { margin: 0; color: palette(dark.main); @ds-typo(small); overflow-wrap: anywhere; }
 .choiceList { display: grid; gap: density(2); margin: 0; padding: 0; border: 0; }
-.choice { @ds-button (outline); display: flex; align-items: flex-start; gap: density(3); padding: density(3); border: border(control); border-radius: radius(2); }
-.choice:has(input:checked) { border-color: palette(primary-main); background: color-mix(in srgb, palette(primary-main) 8%, palette(light-light)); }
-.choice input { margin-top: space(2); accent-color: palette(primary-main); }
+.choice { @ds-button(outline); display: flex; align-items: flex-start; gap: density(3); padding: density(3); border: border(control); border-radius: radius(2); }
+.choice:has(input:checked) { border-color: palette(primary.main); background: color-mix(in srgb, palette(primary.main) 8%, palette(light.light)); }
+.choice input { margin-top: space(2); accent-color: palette(primary.main); }
 .choice span { display: grid; gap: density(1); min-width: 0; }
-.choice strong { color: palette(dark-main); @ds-typo (small-strong); }
-.choice small { color: palette(tertiary-dark); @ds-typo(caption); overflow-wrap: anywhere; }
-.showcase { display: grid; min-width: 0; gap: density(5); min-height: 100svh; padding: density(6); background: palette(light-light); color: palette(dark-main); }
-.showcaseTitle { margin: 0; padding: density(4) density(6); background: palette(dark-main); color: palette(dark-contrast); @ds-typo(h3); }
+.choice strong { color: palette(dark.main); @ds-typo(small-strong); }
+.choice small { color: palette(tertiary.dark); @ds-typo(caption); overflow-wrap: anywhere; }
+.showcase { display: grid; min-width: 0; gap: density(5); min-height: 100svh; padding: density(6); background: palette(light.light); color: palette(dark.main); }
+.showcaseTitle { margin: 0; padding: density(4) density(6); background: palette(dark.main); color: palette(dark.contrast); @ds-typo(h3); }
 .showcaseGrid { display: grid; grid-template-columns: minmax(0, 1fr); gap: density(4); }
 .showcaseStack { display: grid; min-width: 0; align-content: start; gap: density(4); }
 @media (min-width: 1024px) { .showcaseGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
 .showcaseStack p { margin: 0; @ds-typo(small); }
-.showcaseStates { display: grid; gap: density(3); padding: density(6); background: palette(light-light); color: palette(dark-main); }
+.showcaseStates { display: grid; gap: density(3); padding: density(6); background: palette(light.light); color: palette(dark.main); }
 .showcaseStates h2 { margin: 0; @ds-typo(h2); }
-.showcaseStates > p { margin: 0; color: palette(tertiary-dark); @ds-typo(small); }
+.showcaseStates > p { margin: 0; color: palette(tertiary.dark); @ds-typo(small); }
 .showcaseFixtureGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: density(3); }
-.showcaseFixtureGrid article { display: grid; align-content: start; justify-items: start; gap: density(2); min-width: 0; padding: density(4); @ds-surface(contained light 2); border-color: palette(surface-dark); background: palette(light-light); color: palette(dark-main); }
-.showcaseFixtureGrid h3 { margin: 0; @ds-typo (title-sm); }
+.showcaseFixtureGrid article { display: grid; align-content: start; justify-items: start; gap: density(2); min-width: 0; padding: density(4); @ds-surface(contained light 2); border-color: palette(surface.dark); background: palette(light.light); color: palette(dark.main); }
+.showcaseFixtureGrid h3 { margin: 0; @ds-typo(title-sm); }
 .showcaseFixtureGrid p { margin: 0; overflow-wrap: anywhere; @ds-typo(small); }
-.centeredPage { display: grid; min-height: 100vh; place-items: center; padding: density(5); background: palette(light-main); }
+.centeredPage { display: grid; min-height: 100vh; place-items: center; padding: density(5); background: palette(light.main); }
 .centeredPanel { display: grid; gap: density(4); width: min(100%, 420px); padding: density(6); }
-.centeredPanel h1 { margin: 0; color: palette(dark-main); @ds-typo(h2); }
-.centeredPanel p { margin: 0; color: palette(tertiary-dark); @ds-typo(small); }
-.divider { margin: 0;  display: flex; align-items: center; gap: density(3); color: palette(tertiary-dark); @ds-typo(caption); }
+.centeredPanel h1 { margin: 0; color: palette(dark.main); @ds-typo(h2); }
+.centeredPanel p { margin: 0; color: palette(tertiary.dark); @ds-typo(small); }
+.divider { margin: 0;  display: flex; align-items: center; gap: density(3); color: palette(tertiary.dark); @ds-typo(caption); }
 .divider::before, .divider::after { content: ""; flex: 1; border-top: border(control); }
diff --git a/src/app/uxdsl.uxdsl b/src/app/uxdsl.uxdsl
index bcfa1a4..a4cad1a 100644
--- a/src/app/uxdsl.uxdsl
+++ b/src/app/uxdsl.uxdsl
@@ -7,8 +7,8 @@
  * functions instead of hand-typed --uxdsl__* variable names.
  */
 :root {
-  --background: palette(light-main);
-  --foreground: palette(dark-main);
+  --background: palette(light.main);
+  --foreground: palette(dark.main);
 }
 
 html,
@@ -22,7 +22,7 @@ html {
 }
 
 body {
-  @ds-typo (document);
+  @ds-typo(document);
   margin: 0;
   display: flex;
   flex-direction: column;
diff --git a/src/design/uxdsl-postcss.test.ts b/src/design/uxdsl-postcss.test.ts
index c5089f7..f33b036 100644
--- a/src/design/uxdsl-postcss.test.ts
+++ b/src/design/uxdsl-postcss.test.ts
@@ -31,28 +31,3 @@ test("composite tokens are declared again where a topic overrides the palette",
   const moduleResult = await postcss([sourceOnly({})]).process(".a { color: red; }", { from: "a.generated.module.css" });
   assert.doesNotMatch(moduleResult.css, /style\*=/);
 });
-
-test("global density tokens do not leak into already-compiled CSS Modules", async () => {
-  const global = await postcss([sourceOnly({})]).process("@theme { density-1: space(1); }", { from: "globals.css" });
-  assert.match(global.css, /:root/);
-  const compiledModule = await postcss([sourceOnly({})]).process(".card { padding: var(--density-1); }", { from: "card.generated.module.css" });
-  assert.doesNotMatch(compiledModule.css, /:root/);
-  assert.match(compiledModule.css, /var\(--density-1\)/);
-});
-
-test("token blocks the UXDSL CLI writes into a compiled CSS Module are stripped, class rules are not", async () => {
-  // Reproduces what `uxdsl build` emits per entry since 0.5.0-beta.0: global
-  // token blocks the theme build already provides, which CSS Modules reject.
-  const compiled = [
-    ":root { --density-1: var(--space-1); }",
-    "@media (min-width: 768px) { :root { --density-1: var(--space-2); } }",
-    "@media (min-width: 768px) { .card { padding: var(--density-2); } }",
-    ".card { padding: var(--surface-flat-padding); }",
-  ].join("\n");
-  const result = await postcss([sourceOnly({})]).process(compiled, { from: "card.generated.module.css" });
-  assert.doesNotMatch(result.css, /:root/);
-  // An @media that only wrapped tokens goes with them; one with real rules stays.
-  assert.equal(result.css.match(/@media/gu)?.length, 1);
-  assert.match(result.css, /\.card \{ padding: var\(--density-2\); \}/);
-  assert.match(result.css, /\.card \{ padding: var\(--surface-flat-padding\); \}/);
-});
diff --git a/uxdsl.config.cjs b/uxdsl.config.cjs
index 7b27315..ebda91d 100644
--- a/uxdsl.config.cjs
+++ b/uxdsl.config.cjs
@@ -5,11 +5,15 @@ const path = require("node:path");
 /**
  * Single orchestration file for all seven UXDSL entries. Neither `theme` nor
  * `breakpoints` is declared here — both are deliberately absent:
- * uxdsl-cli 0.5.0-beta.8 auto-discovers `uxdsl.theme.config.cjs` next to
- * this file and shares its `theme` (which nests `breakpoints` inside it)
- * across every build below. Setting `breakpoints` at this top level would
- * shadow the theme file's entirely rather than merge with it — see
- * uxdsl.config.js for why breakpoints live inside `theme`.
+ * uxdsl 0.5.0-beta.9 auto-discovers `uxdsl.theme.cjs` next to this file and
+ * shares its theme (which nests `breakpoints` inside it) across every build
+ * below; a `theme` or `breakpoints` key here is an error that names the
+ * theme file.
+ *
+ * `references.externalTokens` tells the reference-integrity check that a
+ * variable with no fallback (the host's Next/font variables) is guaranteed
+ * by the app shell, not something UXDSL itself defines. It moved here from
+ * the theme file, which now exports the bare theme.
  *
  * Only the theme entry sets `includeTheme: true`; it's the sole emitter of
  * the global `:root` token blocks. Every CSS Module panel stays at the
@@ -76,10 +80,11 @@ module.exports = {
       includeTheme: false,
     },
   ],
-  // uxdsl.config.cjs and uxdsl.theme.config.cjs are auto-watched by the CLI,
-  // and since beta.4 (MIG-B4-02) so is everything they `require()`
-  // transitively — uxdsl.config.js included, with no entry needed here.
-  // Confirmed live against a throwaway watcher: editing only uxdsl.config.js
-  // now triggers a rebuild with zero explicit `watch` entries at all.
+  references: {
+    externalTokens: ["--font-geist-sans", "--font-geist-mono"],
+  },
+  // uxdsl.config.cjs and uxdsl.theme.cjs are auto-watched by `uxdsl build
+  // --watch`, and so is everything they `require()` transitively —
+  // uxdsl.config.js included, with no entry needed here.
   watch: ["src/app/**/*.uxdsl"],
 };
diff --git a/uxdsl.config.js b/uxdsl.config.js
index 4bf7e03..27bbea8 100644
--- a/uxdsl.config.js
+++ b/uxdsl.config.js
@@ -142,104 +142,104 @@ module.exports = {
     // Edges the panels share. Hairlines and dividers are translucent dark so
     // they read on any surface; colored edges carry a state.
     borders: {
-      hairline: "1px solid palette(dark-main, 0.08)",
-      strong: "1px solid palette(dark-main, 0.16)",
-      subtle: "1px solid palette(surface-light)",
-      control: "1px solid palette(surface-dark)",
-      light: "1px solid palette(light-light)",
-      neutral: "1px solid palette(neutral-main)",
-      "neutral-soft": "1px solid palette(neutral-light)",
-      primary: "1px solid palette(primary-main)",
-      "primary-soft": "1px solid palette(primary-light)",
-      "primary-strong": "1px solid palette(primary-dark)",
-      warning: "1px solid palette(warning-light)",
-      "warning-strong": "1px solid palette(warning-main)",
-      error: "1px solid palette(error-light)",
-      dashed: "1px dashed palette(dark-main, 0.2)",
-      "dashed-control": "1px dashed palette(surface-dark)",
-      "dashed-subtle": "1px dashed palette(surface-light)",
-      "accent-bar": "3px solid palette(primary-main)",
-      focus: "2px solid palette(primary-main)",
-      "focus-soft": "2px solid palette(primary-light)",
-      "focus-strong": "3px solid palette(dark-main)",
-      inverse: "2px solid palette(light-light)",
+      hairline: "1px solid palette(dark.main, 0.08)",
+      strong: "1px solid palette(dark.main, 0.16)",
+      subtle: "1px solid palette(surface.light)",
+      control: "1px solid palette(surface.dark)",
+      light: "1px solid palette(light.light)",
+      neutral: "1px solid palette(neutral.main)",
+      "neutral-soft": "1px solid palette(neutral.light)",
+      primary: "1px solid palette(primary.main)",
+      "primary-soft": "1px solid palette(primary.light)",
+      "primary-strong": "1px solid palette(primary.dark)",
+      warning: "1px solid palette(warning.light)",
+      "warning-strong": "1px solid palette(warning.main)",
+      error: "1px solid palette(error.light)",
+      dashed: "1px dashed palette(dark.main, 0.2)",
+      "dashed-control": "1px dashed palette(surface.dark)",
+      "dashed-subtle": "1px dashed palette(surface.light)",
+      "accent-bar": "3px solid palette(primary.main)",
+      focus: "2px solid palette(primary.main)",
+      "focus-soft": "2px solid palette(primary.light)",
+      "focus-strong": "3px solid palette(dark.main)",
+      inverse: "2px solid palette(light.light)",
       clear: "2px solid transparent",
       "clear-thin": "1px solid transparent",
       current: "1px solid currentColor",
-      info: "1px solid palette(info-light)",
-      "info-accent": "1px solid palette(info-main)",
-      "info-strong": "1px solid palette(info-dark)",
-      success: "1px solid palette(success-main)",
-      "warning-soft": "1px solid palette(warning-main, 0.4)",
-      "warning-dark": "1px solid palette(warning-dark)",
-      "error-soft": "1px solid palette(error-main, 0.35)",
-      "error-strong": "1px solid palette(error-main)",
-      "neutral-strong": "1px solid palette(neutral-dark)",
-      "primary-faint": "1px solid palette(primary-main, 0.25)",
-      "light-soft": "1px solid palette(light-light, 0.68)",
-      "dashed-primary": "1px dashed palette(primary-main)",
-      "accent-secondary": "2px solid palette(secondary-main)",
-      "focus-error": "2px solid palette(error-main)",
+      info: "1px solid palette(info.light)",
+      "info-accent": "1px solid palette(info.main)",
+      "info-strong": "1px solid palette(info.dark)",
+      success: "1px solid palette(success.main)",
+      "warning-soft": "1px solid palette(warning.main, 0.4)",
+      "warning-dark": "1px solid palette(warning.dark)",
+      "error-soft": "1px solid palette(error.main, 0.35)",
+      "error-strong": "1px solid palette(error.main)",
+      "neutral-strong": "1px solid palette(neutral.dark)",
+      "primary-faint": "1px solid palette(primary.main, 0.25)",
+      "light-soft": "1px solid palette(light.light, 0.68)",
+      "dashed-primary": "1px dashed palette(primary.main)",
+      "accent-secondary": "2px solid palette(secondary.main)",
+      "focus-error": "2px solid palette(error.main)",
       // Strokes that draw small glyphs (chevrons, the logo mark).
       stroke: "1.5px solid currentColor",
-      "stroke-primary": "1.5px solid palette(primary-light)",
+      "stroke-primary": "1.5px solid palette(primary.light)",
     },
     // Containers. Each composes a Border, a Radius and a Palette background;
     // padding is left to the component (0 here), since containers of one
     // look come in many sizes.
     surfaces: {
-      card: { padding: "0", radius: "radius(2)", bg: "palette(light-light)", color: "inherit", border: "border(subtle)", shadow: "none" },
-      panel: { padding: "0", radius: "radius(2)", bg: "palette(light-light)", color: "inherit", border: "border(hairline)", shadow: "none" },
-      boxed: { padding: "0", radius: "radius(2)", bg: "palette(light-light)", color: "inherit", border: "border(control)", shadow: "none" },
-      callout: { padding: "0", radius: "radius(2)", bg: "palette(light-light)", color: "inherit", border: "border(primary-soft)", shadow: "none" },
-      dropzone: { padding: "0", radius: "radius(2)", bg: "palette(light-light)", color: "inherit", border: "border(dashed-control)", shadow: "none" },
-      "notice-warning": { padding: "0", radius: "radius(2)", bg: "palette(warning-light)", color: "inherit", border: "border(warning)", shadow: "none" },
-      "notice-error": { padding: "0", radius: "radius(2)", bg: "palette(light-light)", color: "inherit", border: "border(error)", shadow: "none" },
-      "notice-success": { padding: "0", radius: "radius(2)", bg: "color-mix(in srgb, palette(success-main) 10%, palette(light-light))", color: "inherit", border: "border(success)", shadow: "none" },
+      card: { padding: "0", radius: "radius(2)", bg: "palette(light.light)", color: "inherit", border: "border(subtle)", shadow: "none" },
+      panel: { padding: "0", radius: "radius(2)", bg: "palette(light.light)", color: "inherit", border: "border(hairline)", shadow: "none" },
+      boxed: { padding: "0", radius: "radius(2)", bg: "palette(light.light)", color: "inherit", border: "border(control)", shadow: "none" },
+      callout: { padding: "0", radius: "radius(2)", bg: "palette(light.light)", color: "inherit", border: "border(primary-soft)", shadow: "none" },
+      dropzone: { padding: "0", radius: "radius(2)", bg: "palette(light.light)", color: "inherit", border: "border(dashed-control)", shadow: "none" },
+      "notice-warning": { padding: "0", radius: "radius(2)", bg: "palette(warning.light)", color: "inherit", border: "border(warning)", shadow: "none" },
+      "notice-error": { padding: "0", radius: "radius(2)", bg: "palette(light.light)", color: "inherit", border: "border(error)", shadow: "none" },
+      "notice-success": { padding: "0", radius: "radius(2)", bg: "color-mix(in srgb, palette(success.main) 10%, palette(light.light))", color: "inherit", border: "border(success)", shadow: "none" },
     },
     // Actions: filled, outlined, on-image, chip, tab and text styles.
     buttons: {
-      primary: actionButton({ bg: "palette(primary-dark)", color: "palette(light-light)", border: "border(primary-strong)", hover: { bg: "palette(primary-main)", border: "border(primary)" } }),
-      secondary: actionButton({ bg: "palette(light-light)", color: "palette(primary-dark)", border: "border(hairline)", hover: { border: "border(primary)" }, selected: { bg: "palette(primary-light, 0.2)", border: "border(primary)" } }),
-      warning: actionButton({ bg: "palette(warning-light)", color: "palette(warning-dark)", border: "border(warning-strong)" }),
-      danger: actionButton({ bg: "palette(error-main)", color: "palette(light-light)", border: "border(error-strong)", hover: { bg: "palette(error-dark)" } }),
-      "danger-outline": actionButton({ bg: "palette(light-light)", color: "palette(error-main)", border: "border(error)", hover: { border: "border(error-strong)" } }),
-      info: actionButton({ bg: "palette(light-light)", color: "palette(info-dark)", border: "border(info-accent)", hover: { border: "border(info-strong)" } }),
-      neutral: actionButton({ bg: "palette(light-light)", color: "palette(neutral-dark)", border: "border(neutral-strong)" }),
+      primary: actionButton({ bg: "palette(primary.dark)", color: "palette(light.light)", border: "border(primary-strong)", hover: { bg: "palette(primary.main)", border: "border(primary)" } }),
+      secondary: actionButton({ bg: "palette(light.light)", color: "palette(primary.dark)", border: "border(hairline)", hover: { border: "border(primary)" }, selected: { bg: "palette(primary.light, 0.2)", border: "border(primary)" } }),
+      warning: actionButton({ bg: "palette(warning.light)", color: "palette(warning.dark)", border: "border(warning-strong)" }),
+      danger: actionButton({ bg: "palette(error.main)", color: "palette(light.light)", border: "border(error-strong)", hover: { bg: "palette(error.dark)" } }),
+      "danger-outline": actionButton({ bg: "palette(light.light)", color: "palette(error.main)", border: "border(error)", hover: { border: "border(error-strong)" } }),
+      info: actionButton({ bg: "palette(light.light)", color: "palette(info.dark)", border: "border(info-accent)", hover: { border: "border(info-strong)" } }),
+      neutral: actionButton({ bg: "palette(light.light)", color: "palette(neutral.dark)", border: "border(neutral-strong)" }),
       // A round approve toggle laid over an image: aria-pressed turns it green.
-      check: actionButton({ bg: "palette(dark-main, 0.5)", color: "palette(light-light)", border: "border(inverse)", radius: "radius(circle)", padding: "0",
-        hover: { bg: "palette(success-dark)" }, selected: { bg: "palette(success-main)", color: "palette(success-contrast)" } }),
-      chip: actionButton({ bg: "palette(light-light)", color: "palette(primary-dark)", border: "border(hairline)", radius: "radius(pill)", padding: "0 density(3)", hover: { border: "border(primary)" }, selected: { bg: "palette(primary-light, 0.2)", border: "border(primary)" } }),
-      tinted: actionButton({ bg: "palette(primary-light, 0.2)", color: "palette(primary-dark)", border: "border(primary-faint)", hover: { border: "border(primary)" } }),
+      check: actionButton({ bg: "palette(dark.main, 0.5)", color: "palette(light.light)", border: "border(inverse)", radius: "radius(circle)", padding: "0",
+        hover: { bg: "palette(success.dark)" }, selected: { bg: "palette(success.main)", color: "palette(success.contrast)" } }),
+      chip: actionButton({ bg: "palette(light.light)", color: "palette(primary.dark)", border: "border(hairline)", radius: "radius(pill)", padding: "0 density(3)", hover: { border: "border(primary)" }, selected: { bg: "palette(primary.light, 0.2)", border: "border(primary)" } }),
+      tinted: actionButton({ bg: "palette(primary.light, 0.2)", color: "palette(primary.dark)", border: "border(primary-faint)", hover: { border: "border(primary)" } }),
       outline: actionButton({ bg: "transparent", color: "inherit", border: "border(current)" }),
-      tab: actionButton({ bg: "transparent", color: "palette(tertiary-main)", border: "none", radius: "0", padding: "density(2) density(4)", hover: { color: "palette(primary-dark)" }, selected: { color: "palette(primary-dark)" } }),
+      tab: actionButton({ bg: "transparent", color: "palette(tertiary.main)", border: "none", radius: "0", padding: "density(2) density(4)", hover: { color: "palette(primary.dark)" }, selected: { color: "palette(primary.dark)" } }),
       text: textButton("inherit"),
-      link: textButton("palette(primary-dark)"),
-      "link-accent": textButton("palette(primary-main)", "palette(primary-dark)"),
-      "link-muted": textButton("palette(tertiary-dark)", "palette(primary-dark)"),
-      "link-dark": textButton("palette(dark-main)", "palette(primary-dark)"),
-      "link-danger": textButton("palette(error-main)", "palette(error-dark)"),
-      "link-warning": textButton("palette(warning-dark)"),
+      link: textButton("palette(primary.dark)"),
+      "link-accent": textButton("palette(primary.main)", "palette(primary.dark)"),
+      "link-muted": textButton("palette(tertiary.dark)", "palette(primary.dark)"),
+      "link-dark": textButton("palette(dark.main)", "palette(primary.dark)"),
+      "link-danger": textButton("palette(error.main)", "palette(error.dark)"),
+      "link-warning": textButton("palette(warning.dark)"),
     },
     // Text fields. Native :invalid matches an empty required field before the
     // reader types, so the invalid state keeps the resting edge.
     inputs: {
-      field: { surface: "panel", base: { padding: "density(2) density(3)", radius: "radius(2)", caret: "palette(primary-main)", placeholder: "palette(tertiary-main)" },
+      field: { surface: "panel", base: { padding: "density(2) density(3)", radius: "radius(2)", caret: "palette(primary.main)", placeholder: "palette(tertiary.main)" },
         states: { focus: { border: "border(primary)", shadow: "shadow(ring)" }, invalid: { border: "border(hairline)" }, focusvisible, disabled: { opacity: "0.6" } } },
     },
     // Elevations and rings beyond the stock 0–5 scale.
     shadows: {
-      ring: "0 0 0 3px palette(primary-main, 0.12)",
-      "ring-success": "0 0 0 3px palette(success-main, 0.2)",
-      "ring-error": "0 0 0 3px palette(error-main, 0.18)",
-      selected: "0 0 0 2px palette(primary-main), 0 1px 2px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.12)",
-      float: "0 9px 22px palette(primary-dark, 0.14)",
-      "float-info": "0 9px 22px palette(info-dark, 0.18)",
-      overlay: "0 30px 90px palette(dark-main, 0.3)",
-      "inset-primary": "inset 3px 0 0 palette(primary-main)",
-      "inset-secondary": "inset 3px 0 0 palette(secondary-main)",
-      "inset-outline": "inset 0 0 0 1px palette(primary-main)",
-      "inset-highlight": "inset 0 1px 0 palette(light-light, 0.7)",
+      ring: "0 0 0 3px palette(primary.main, 0.12)",
+      "ring-success": "0 0 0 3px palette(success.main, 0.2)",
+      "ring-error": "0 0 0 3px palette(error.main, 0.18)",
+      selected: "0 0 0 2px palette(primary.main), 0 1px 2px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.12)",
+      float: "0 9px 22px palette(primary.dark, 0.14)",
+      "float-info": "0 9px 22px palette(info.dark, 0.18)",
+      overlay: "0 30px 90px palette(dark.main, 0.3)",
+      "inset-primary": "inset 3px 0 0 palette(primary.main)",
+      "inset-secondary": "inset 3px 0 0 palette(secondary.main)",
+      "inset-outline": "inset 0 0 0 1px palette(primary.main)",
+      "inset-highlight": "inset 0 1px 0 palette(light.light, 0.7)",
     },
   },
 };
diff --git a/uxdsl.theme.cjs b/uxdsl.theme.cjs
new file mode 100644
index 0000000..fbcbab6
--- /dev/null
+++ b/uxdsl.theme.cjs
@@ -0,0 +1,16 @@
+/* eslint-disable @typescript-eslint/no-require-imports */
+
+const { theme } = require("./uxdsl.config.js");
+
+/**
+ * The theme file, discovered by `uxdsl` next to `uxdsl.config.cjs` and shared
+ * across every entry in that file's `builds` array — one source of truth for
+ * the whole project. It exports the theme itself (uxdsl 0.5.0-beta.9 refuses
+ * the former `{ theme, references }` wrapper); `references` lives in
+ * `uxdsl.config.cjs`.
+ *
+ * `theme.breakpoints` lives inside `theme` (see uxdsl.config.js): the theme is
+ * the one source of thresholds for every integration, and a `breakpoints`
+ * key in the build config is an error since beta.9.
+ */
+module.exports = theme;
diff --git a/uxdsl.theme.config.cjs b/uxdsl.theme.config.cjs
deleted file mode 100644
index 80b6520..0000000
--- a/uxdsl.theme.config.cjs
+++ /dev/null
@@ -1,25 +0,0 @@
-/* eslint-disable @typescript-eslint/no-require-imports */
-
-const { theme } = require("./uxdsl.config.js");
-
-/**
- * Canonical theme-data file, auto-discovered by uxdsl-cli next to
- * `uxdsl.config.cjs` and shared across every entry in that file's `builds`
- * array — one source of truth for the whole project.
- *
- * `theme.breakpoints` lives inside `theme` (see uxdsl.config.js) on
- * purpose: the plugin only reads it when nothing sets `breakpoints` at the
- * top level of a build config, so `uxdsl.config.cjs` must never declare
- * its own `breakpoints` — that would shadow this file's entirely, not
- * merge with it.
- *
- * `references.externalTokens` tells the reference-integrity check that a
- * variable with no fallback (the host's Next/font variables) is guaranteed
- * by the app shell, not something UXDSL itself defines.
- */
-module.exports = {
-  theme,
-  references: {
-    externalTokens: ["--font-geist-sans", "--font-geist-mono"],
-  },
-};
````
