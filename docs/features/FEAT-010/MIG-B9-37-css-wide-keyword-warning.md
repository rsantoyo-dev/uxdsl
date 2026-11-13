# MIG-B9-37 — A located warning for a CSS-wide keyword as a theme token value

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | None (registered by decision D4 of 2026-11-04, as proposed in MIG-B9-03 §15, finding 4) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-13 (README §5; merged, PR #63). Under README §7 it also waits for the earlier rows of the files it shares: MIG-B9-24, 32, 33 and 34 (`theme-validate.ts`); MIG-B9-26, 17, 30 and 32 to 35 (`diagnostics.ts`); MIG-B9-30 to 36 (`AGENTS.md`); and MIG-B9-21, which every wave-3 story waits for (§7's preamble). On `bin/uxdsl.js` the earlier rows, MIG-B9-14, 20 and 22, are merged |
| Blocks | MIG-B9-91 (it depends on every story of waves 0 to 3). Under §7: MIG-B9-38 (`diagnostics.ts`, `bin/uxdsl.js`), MIG-B9-39 (`bin/uxdsl.js`), MIG-B9-51 (`AGENTS.md`), and MIG-B9-60, 61 and 63 (`bin/uxdsl.js`) |
| Base | `feat/beta9` after MIG-B9-13, and within §7 after MIG-B9-17, 21, 24, 26 and 30 to 36. §3 and §4 were recorded on `5a041fc` (`feat/beta9` at `cc10de6`, with MIG-B9-20 merged as PR #88), before all of them; both are re-run on the base the story starts from (§3). Five questions for the owner are open in §15; the contract states the option it assumes until they are answered |
| Owns | `packages/uxdsl/test/theme-css-wide-keyword.test.js` (new) |
| Shares | `packages/uxdsl/src/ds-runtime/theme-validate.ts` (the structure pass of `validateTheme`), `packages/uxdsl/src/diagnostics.ts` (one catalog entry), `packages/uxdsl/bin/uxdsl.js` (`warnUnknownThemeKeys`'s filter and the comments that describe it), `AGENTS.md` and the generated `packages/uxdsl/docs/agent-guide.md` (one sentence), `packages/uxdsl/CHANGELOG.md` (one subsection), `packages/uxdsl/README.md` (one sentence). This list follows Q2 (a) and Q5 (a) of §15; another answer changes it as §15 says |
| Output impact | API/CLI: a new warning, `UXD_THEME_KEYWORD` (Q2 (a)), from `validateTheme`, the PostCSS plugin, `compile()`, the CLI and `applyTheme`. Compiled output: none; the keyword is still emitted as written |

## 1. Goal

A theme token whose value is a CSS-wide keyword (`inherit`, `initial`,
`unset`, `revert`, `revert-layer`) becomes a custom property on `:root` that
has no value, so every `var()` that reads it is invalid. Today nothing says
so, on any path. After this story the one theme validator reports it as a
warning, at the token's key path, and every path that validates a theme
relays it: the build still succeeds and the CSS is unchanged.

## 2. Sources

- The registration, FEAT-010 §2, "Owner decisions of 2026-11-04"
  (`docs/features/FEAT-010-beta9.md`, line 179):

  > - **D4 — MIG-B9-03's findings 3 and 4 registered:** MIG-B9-29, "The canonical-grammar codemod is idempotent" (S, wave 2: a second run is a no-op, pinned by a test; MIG-B9-52's release-notes instruction follows), and MIG-B9-37, "A located warning for a CSS-wide keyword as a theme token value" (S, wave 3: `inherit`, `initial`, `unset`, `revert` and `revert-layer` emit a guaranteed-invalid `:root` property today, silently).

  and DEC-03, the release (same file, line 95):

  > The stories registered on 2026-11-04 ship in beta.9: MIG-B9-24 to 29 in wave 2 and MIG-B9-37 in wave 3.

- The index row (`docs/features/FEAT-010/README.md`, line 223):

  > | MIG-B9-37 | A located warning for a CSS-wide keyword as a theme token value | 3 | — | S | 13 | Draft (story file to be written; registered by D4 of 2026-11-04, as proposed in MIG-B9-03 §15, finding 4) |

  its waits (same file, lines 268–271):

  > And MIG-B9-24, the last row before wave 3, makes
  > MIG-B9-30 to 35 and MIG-B9-37 wait for it (`plugin.ts`, `theme-validate.ts`,
  > `theme-generator.ts`); only MIG-B9-36 does not, and neither do MIG-B9-38 and
  > 39, registered on 2026-11-08.

  and the status of its §7 rows (same file, lines 439–445):

  > The rows that name MIG-B9-37 and 92 come from their proposals, […]
  > they are provisional: each
  > story file states its Owns and Shares, and this table follows them before
  > the story starts.

- MIG-B9-03 §15 (`docs/features/FEAT-010/MIG-B9-03-validate-main-on-press-craftor.md`),
  finding 4, line 256:

  > | 4 | A theme value of `inherit` (Press Craftor's `emphasis`/`regular`/`inherit`/`multiline` roles, `color: "inherit"` Surfaces and Buttons) emits a `:root` custom property that is guaranteed-invalid; `var()` reads of it are unresolved in Chrome (24 variables, 512 pairs; pre-existing in beta.8) and the compiler is silent | **new story** (a located warning for CSS-wide keywords in token values); MIG-B9-33 documents `extends: "none"` as the replacement for the trick |

  and its "Owner decisions of 2026-11-04", line 277:

  > - **Finding 4 (decision D4 of 2026-11-04):** registered as MIG-B9-37, "A located warning for a CSS-wide keyword as a theme token value" (S, wave 3): `inherit`, `initial`, `unset`, `revert` and `revert-layer` emit a guaranteed-invalid `:root` property today, silently.

- Finding 4 in full, in MIG-B9-03's evidence
  (`docs/features/FEAT-010/evidence/MIG-B9-03-press-craftor.md`, lines 196–219):

  > 4. **A theme value of `inherit` compiles to an unresolvable custom property,
  >    and nothing says so** (pre-existing in beta.8; found by the Chrome probe,
  >    not a regression). Press Craftor's `emphasis`, `regular`, `inherit` and
  >    `multiline` Typography roles set `fontFamily`/`fontSize`/`lineHeight`/
  >    `letterSpacing`/`fontWeight` to `"inherit"` (its F‑13 workaround), its
  >    `card`/`panel`/… Surfaces `color: "inherit"`, and its `text`/`outline`
  >    Button roles `color: "inherit"`. The theme emits
  >    `:root { --uxdsl__typography__emphasis-font-size: inherit; … }`; in CSS a
  >    custom property set to `inherit` on the root element takes the initial
  >    (guaranteed-invalid) value, so every `var(--uxdsl__typography__emphasis-font-size)`
  >    is unresolved — Chrome reports an empty computed value and the declaration
  >    becomes `unset`, which for these inherited properties coincidentally gives
  >    the intended look. The reference-integrity check passes (the property is
  >    declared) and the compiler is silent. […] Target: **a new story** — a located warning (or error
  >    under a strict flag) when a theme token value is a CSS-wide keyword
  >    (`inherit`, `initial`, `unset`, `revert`, `revert-layer`), since the
  >    emitted variable can never resolve; **MIG-B9-33** (`extends: "none"`
  >    roles emitting only their own fields) is the design that removes the
  >    need for the `inherit` trick, and should say so in its documentation.

  and the owner's step for the real project (lines 382–383):

  > 6. Finding 4 is the project's `inherit` trick; it worked by accident before
  >    and still does. MIG-B9-33's `extends: "none"` is the intended replacement.

- What "located" means in this feature. Neither D4 nor the evidence defines
  the word. The index's rule (`docs/features/FEAT-010/README.md`, lines 61–65):

  > - **Nothing silent.** A new behavior that cannot be honoured is a located
  >   `UXD_*` error. A new code is added to `DIAGNOSTIC_CATALOG`
  >   (`packages/uxdsl/src/diagnostics.ts`) with a meaning and a fix, produced by
  >   the code, and asserted by a test, or `test/diagnostics-catalog.test.js`
  >   fails.

  For a theme value the location the code base gives today is its key path.
  `themeError` (`packages/uxdsl/src/diagnostics.ts`, lines 149–153):

  > ```ts
  > export function themeError(code: string, message: string, keyPath: string): Error {
  >   const error = diagnostic(`${code}: ${message} (at ${keyPath}).`);
  >   (error as any).keyPath = keyPath;
  >   return error;
  > }
  > ```

  and the CLI, which names the theme file in front of a theme error that has
  one (`packages/uxdsl/bin/uxdsl.js`, lines 806–813, `annotateThemeError`).
  §15's Q1 asks the owner which location applies.

- The one validator and its one warning today
  (`packages/uxdsl/src/ds-runtime/theme-validate.ts`). The issue type, lines
  14–21:

  > ```ts
  > export type ThemeValidationIssue = {
  >   /** The `UXD_*` code. Structural problems are `UXD_THEME_INVALID`; an engine or
  >    * reference problem carries that engine's own code. The unknown-family
  >    * warning is `UXD_THEME_FAMILY`. */
  >   code?: string;
  >   path: string;
  >   message: string;
  > };
  > ```

  the leaf check every CSS value goes through, lines 193–200:

  > ```ts
  >   const leaf = (path: string, value: unknown) => {
  >     if (typeof value !== 'string' || !value.trim()) {
  >       invalid(path, `Expected a nonempty string, got ${describe(value)}`);
  >       return;
  >     }
  >     if (!THEME_VALUE_PATTERN.test(value)) invalid(path, 'A theme value cannot contain ";", "{" or "}"');
  >     else if (!balancedParentheses(value)) invalid(path, 'Unbalanced parentheses');
  >   };
  > ```

  which also receives a role's name, not a CSS value, for a Button's or
  Input's Surface (line 240):

  > ```ts
  >       if (key === 'surface') leaf(entryPath, entry);
  > ```

  and the unknown-family warning, line 325:

  > ```ts
  >         warnings.push({ code: 'UXD_THEME_FAMILY', path: family, message: `Unknown theme family "${family}" — it will not be compiled into any CSS.` });
  > ```

- Where `validateTheme`'s warnings go today:
  - the PostCSS plugin (`packages/uxdsl/src/plugin.ts`, lines 125–127), on
    every compilation, whether or not it writes `@uxdsl theme;`, with no
    node:

    > ```ts
    >   const validated = validateTheme(theme, { references: false });
    >   if (!validated.ok) throw themeValidationError(validated.errors);
    >   for (const warning of validated.warnings) result.warn(warning.message, { plugin: PLUGIN });
    > ```

  - `generateThemeCss` (`packages/uxdsl/src/ds-runtime/theme-generator.ts`,
    lines 68–76), which returns a string and drops them:

    > ```ts
    > export function generateThemeCss(theme?: Record<string, any>, references: ReferenceOptions = {}): string {
    >   const effective = resolveTheme(theme);
    >   const validated = validateTheme(effective, { references: false });
    >   if (!validated.ok) throw themeValidationError(validated.errors);
    > ```

  - `applyTheme` (`packages/uxdsl/src/ds-runtime/apply-theme.ts`, line 266):

    > ```ts
    >   const warnings = (validated.warnings || []).map((issue: any) => `${issue.path}: ${issue.message}`);
    > ```

  - the CLI, which prints only the "Unknown …" ones itself, once per process,
    and skips `compile()`'s copies of them (`packages/uxdsl/bin/uxdsl.js`,
    lines 762–789):

    > ```js
    > // The theme's "Unknown …" warnings (validateTheme's), printed as
    > // `[uxdsl] Warning: <path>: <message>` once per process: an unfixed misspelled
    > // family does not reprint on every save of a watch session. […]
    > // The texts of those warnings, printed or not. compile() reports the same
    > // theme warnings with no file and no path; buildOnce skips them, so each is
    > // printed once, in the form above that names its path.
    > const themeWarningTexts = new Set();
    > […]
    >   for (const w of warnings || []) {
    >     if (!/^Unknown /.test(w.message)) continue;
    >     themeWarningTexts.add(w.message);
    >     const key = `${w.path}: ${w.message}`;
    >     if (warnedUnknownThemeKeys.has(key)) continue;
    >     warnedUnknownThemeKeys.add(key);
    >     console.warn(`[uxdsl] Warning: ${key}`);
    > ```

    while every other file-less `compile()` warning is printed once per
    entry (lines 1070–1075):

    > ```js
    >       for (const warning of result.warnings || []) {
    >         if (!warning.file && themeWarningTexts.has(warning.text)) continue;
    >         const line = formatCompileWarning(warning);
    >         const key = warning.file ? line : `${i}\n${line}`;
    > ```

    `warnUnknownThemeKeys` is called by `build` (`buildOnce`, line 1058)
    and by `theme` (line 1296), and exported (line 2820);
    `test/cli/uxdsl-cli.test.js` calls it by name (lines 1090–1136).

- The documentation of the validator's warning:
  - `AGENTS.md`, lines 814–816: "Closed field sets stay the engines' own
    errors (`UXD_TYPO_FIELD`, `UXD_BUTTON_STATE`, …). An unknown top-level
    family is a warning (`UXD_THEME_FAMILY`), not an error."
  - `packages/uxdsl/README.md`, lines 1760–1765: "An unknown **top-level**
    family is a warning (`UXD_THEME_FAMILY`), never an error: […] The
    PostCSS plugin reports it through `result.warn`, the CLI prints it,
    `applyTheme` returns it in `warnings`."
  - The catalog entry (`packages/uxdsl/src/diagnostics.ts`, line 47):
    `UXD_THEME_FAMILY: theme('A top-level theme key is not a family the compiler reads (a warning: nothing compiles it).', 'Check the spelling against KNOWN_THEME_FAMILIES, or remove the key.'),`.
    `DIAGNOSTIC_CATALOG` holds 106 codes on `5a041fc` (theme 59, compiler
    38, runtime 6, core 3), none for a keyword.

## 3. Preconditions

```bash
git merge-base --is-ancestor cc10de6 HEAD                                                     # PR #88 (MIG-B9-20) is in the base
grep -qF "warnings.push({ code: 'UXD_THEME_FAMILY', path: family," packages/uxdsl/src/ds-runtime/theme-validate.ts      # the validator's one warning today
grep -qF "if (key === 'surface') leaf(entryPath, entry);" packages/uxdsl/src/ds-runtime/theme-validate.ts                # a role name goes through leaf() (C1's exclusion)
grep -qF 'for (const warning of validated.warnings) result.warn(warning.message, { plugin: PLUGIN });' packages/uxdsl/src/plugin.ts   # the plugin relays them (C2)
grep -qF 'const validated = validateTheme(effective, { references: false });' packages/uxdsl/src/ds-runtime/theme-generator.ts     # generateThemeCss validates and drops them (C6)
grep -qF 'const warnings = (validated.warnings || []).map((issue: any) => `${issue.path}: ${issue.message}`);' packages/uxdsl/src/ds-runtime/apply-theme.ts   # applyTheme returns them (C5)
grep -qF 'if (!/^Unknown /.test(w.message)) continue;' packages/uxdsl/bin/uxdsl.js                                       # the CLI prints only "Unknown …" ones itself (C4)
grep -qF 'if (!warning.file && themeWarningTexts.has(warning.text)) continue;' packages/uxdsl/bin/uxdsl.js              # and skips compile()'s copies of those
node -e "process.exit(Object.keys(require('./packages/uxdsl/dist/diagnostics').DIAGNOSTIC_CATALOG).includes('UXD_THEME_KEYWORD') ? 1 : 0)"   # the code is free
node -e "const k = /^\s*(inherit|initial|unset|revert|revert-layer)\s*$/i, s = []; (function w(o) { for (const v of Object.values(o)) typeof v === 'string' ? s.push(v) : v && typeof v === 'object' && w(v); })(require('./packages/uxdsl/src/theme/base.json')); process.exit(s.some((v) => k.test(v)) ? 1 : 0)"   # the packaged base writes no keyword
! git grep -qiE "[:=] *[\"'\`] *(inherit|initial|unset|revert|revert-layer) *[\"'\`]" -- '*theme*' ':!docs/**'   # no tracked theme, theme test or theme script writes one
test ! -e packages/uxdsl/test/theme-css-wide-keyword.test.js
test -f fixtures/mig02-nextjs-cssmodules/node_modules/playwright-core/package.json             # §4 part 2's Chrome driver
```

All thirteen exit 0 on `5a041fc` (2026-11-13, run through `bash` from the
worktree root, with `TMPDIR` set to an empty scratch directory; the lines are
written for a plain shell). Two controls were run with them: line 10's walk
exits 1 on a planted `{ a: { b: " Inherit " } }`, and line 11's pattern
matches a planted `x: 'revert-layer',` (exit 0). Line 11 searched the 55
tracked files whose path contains `theme`, outside `docs/`. Lines 10 and 11
are why §5's must-stay-byte-identical list can include every capture and
parity output: no theme the repository builds writes a keyword, so none of
them gains the warning.

They are re-run on the base the story starts from. A line that is only stale
is corrected as README §1 item 4 allows. Lines that later stories may move:
line 3 (MIG-B9-32 rewrites the control-role check for `extends`), line 5
(MIG-B9-24's C1 shares the engine pass between `validateTheme` and the
render), line 4 (MIG-B9-24 edits `validateOptions` in `plugin.ts`; on
`5a041fc` the loop is at line 127), and lines 7 and 8 (on `5a041fc` at
`bin/uxdsl.js` lines 782 and 1072; MIG-B9-21's comment rewrite may move
them).

## 4. Baseline

**Part 1 — every path, every family.** Run from the worktree root, on
`5a041fc`, through `bash`, with `TMPDIR` set to an empty scratch directory
(the scratch directory is named from `$TMPDIR`: on macOS 27.0 `mktemp -d`
without a template ignores `TMPDIR`, MIG-B9-29 §15 F6). `applyTheme` runs in
Node with a minimal DOM stub: it shows the validator's verdict and the result
object only, and proves nothing about rendering.

```bash
P="$PWD/packages/uxdsl"
X="$(mktemp -d "${TMPDIR:?}/mig-b9-37.XXXXXX")"
cat > "$X/probe.js" <<'EOF'
const P = process.argv[2];
const { validateTheme, generateThemeCss, resolveTheme } = require(P + '/dist/entries/theme');
const { compile } = require(P + '/dist/entries/index');
const uxdsl = require(P + '/dist/plugin');
const postcss = require(P + '/node_modules/postcss');
const KEYWORDS = ['inherit', 'initial', 'unset', 'revert', 'revert-layer', 'INHERIT', ' Revert-Layer '];
const CASES = {
  'spacing.4': (k) => ({ spacing: { 4: k } }),
  'densities.4': (k) => ({ densities: { 4: k } }),
  'colors.white': (k) => ({ colors: { white: k } }),
  'colors.gray.300': (k) => ({ colors: { gray: { 300: k } } }),
  'palette.primary.main': (k) => ({ palette: { primary: { main: k } } }),
  'modes.dark.palette.primary.main': (k) => ({ modes: { dark: { palette: { primary: { main: k } } } } }),
  'fonts.families.ui': (k) => ({ fonts: { families: { ui: k } } }),
  'typography_details.emphasis.fontSize': (k) => ({ typography_details: { emphasis: { fontSize: k } } }),
  'typography_details.default.letterSpacing': (k) => ({ typography_details: { default: { letterSpacing: k } } }),
  'typography_details.emphasis.fontSize, md group': (k) => ({ typography_details: { emphasis: { fontSize: `xs(1rem) md(${k})` } } }),
  'borders.1': (k) => ({ borders: { 1: k } }),
  'radii.2': (k) => ({ radii: { 2: k } }),
  'shadows.2': (k) => ({ shadows: { 2: k } }),
  'surfaces.card.color': (k) => ({ surfaces: { card: { color: k } } }),
  'surfaces.contained.color': (k) => ({ surfaces: { contained: { color: k } } }),
  'buttons.text.base.color': (k) => ({ buttons: { text: { base: { color: k } } } }),
  'buttons.contained.states.hover.color': (k) => ({ buttons: { contained: { states: { hover: { color: k } } } } }),
  'inputs.field.base.color': (k) => ({ inputs: { field: { base: { color: k } } } }),
  'inputs.contained.states.focus.color': (k) => ({ inputs: { contained: { states: { focus: { color: k } } } } }),
};
const KEYWORD = /^\s*(inherit|initial|unset|revert|revert-layer)\s*$/i;
const keywordProps = (css) => { let n = 0; postcss.parse(css).walkDecls((d) => { if (d.prop.startsWith('--') && KEYWORD.test(d.value)) n++; }); return n; };
(async () => {
  let runs = 0, ok = 0, warned = 0, emittedByGenerate = 0, emittedByPlugin = 0, pluginWarned = 0;
  for (const [name, make] of Object.entries(CASES)) {
    for (const k of KEYWORDS) {
      const theme = make(k);
      runs++;
      const v = validateTheme(resolveTheme(theme));
      if (v.ok && v.errors.length === 0) ok++;
      if (v.warnings.length) warned++;
      if (keywordProps(generateThemeCss(theme)) > 0) emittedByGenerate++;
      const r = await postcss([uxdsl({ theme })]).process('@uxdsl theme;\n.c { color: red; }\n', { from: undefined });
      if (keywordProps(r.css) > 0) emittedByPlugin++;
      if (r.warnings().length) pluginWarned++;
    }
  }
  console.log(`${Object.keys(CASES).length} theme paths x ${KEYWORDS.length} spellings = ${runs} themes`);
  console.log(`validateTheme: ok with no error ${ok}/${runs}, with a warning ${warned}/${runs}`);
  console.log(`generateThemeCss: a custom property whose whole value is the keyword ${emittedByGenerate}/${runs}`);
  console.log(`uxdsl/postcss: the same ${emittedByPlugin}/${runs}; result.warnings() non-empty ${pluginWarned}/${runs}`);
  const project = require(process.argv[3] + '/uxdsl.theme.json');
  const c = await compile({ source: '@uxdsl theme;\n.link { @ds-typo(emphasis); }\n.cta { color: palette(primary.main); }\n' }, { theme: project });
  console.log(`compile(): warnings ${JSON.stringify(c.warnings)}`);
  const style = { tagName: 'STYLE', textContent: '', setAttribute() {} };
  globalThis.document = { head: { appendChild() {} }, getElementById: () => null, createElement: () => style };
  const { applyTheme } = require(P + '/dist/entries/runtime');
  applyTheme({}, { replace: true });
  const a = applyTheme(project);
  console.log(`applyTheme (Node, a DOM stub): ok ${a.ok}, warnings ${JSON.stringify(a.warnings)}`);
})().catch((error) => { console.error(error); process.exit(1); });
EOF
mkdir -p "$X/project/src"
printf '%s\n' '{' \
  '  "palette": { "primary": { "main": "initial" } },' \
  '  "typography_details": { "emphasis": { "fontSize": "inherit", "fontWeight": "600" } },' \
  '  "surfaces": { "card": { "color": "unset" } },' \
  '  "borders": { "1": "revert" },' \
  '  "radii": { "2": "revert-layer" },' \
  '  "colour": { "red": "#f00" }' \
  '}' > "$X/project/uxdsl.theme.json"
printf '%s\n' "module.exports = { builds: [ { entry: 'src/a.uxdsl', outFile: 'dist/a.css' }, { entry: 'src/b.uxdsl', outFile: 'dist/b.css' } ] };" > "$X/project/uxdsl.config.cjs"
printf '%s\n' '@uxdsl theme;' '.link { @ds-typo(emphasis); }' '.cta { color: palette(primary.main); }' '.card { @ds-surface(card); border: border(1); border-radius: radius(2); }' > "$X/project/src/a.uxdsl"
printf '%s\n' '.b { color: palette(primary.main); }' > "$X/project/src/b.uxdsl"
node "$X/probe.js" "$P" "$X/project"; echo "probe exit=$?"
(cd "$X/project" && node "$P/bin/uxdsl.js" build > ../build.out 2> ../build.err; echo "uxdsl build exit=$?")
echo "build stdout:"; cat "$X/build.out"; echo "build stderr:"; cat "$X/build.err"
for f in a b; do echo "dist/$f.css: $(grep -oE -- '--uxdsl__[a-z0-9_-]+: *(inherit|initial|unset|revert|revert-layer);' "$X/project/dist/$f.css" | sort | tr -d ';' | tr '\n' ' ')"; done
(cd "$X/project" && node "$P/bin/uxdsl.js" theme > ../theme.out 2> ../theme.err; echo "uxdsl theme exit=$?")
echo "theme stderr:"; cat "$X/theme.err"
rm -rf "$X"
```

The output on `5a041fc`, 2026-11-13 09:22 EST, exactly (the script exits 0,
and the scratch directory is empty again afterwards):

```text
19 theme paths x 7 spellings = 133 themes
validateTheme: ok with no error 133/133, with a warning 0/133
generateThemeCss: a custom property whose whole value is the keyword 133/133
uxdsl/postcss: the same 133/133; result.warnings() non-empty 0/133
compile(): warnings [{"text":"Unknown theme family \"colour\" — it will not be compiled into any CSS."}]
applyTheme (Node, a DOM stub): ok true, warnings ["colour: Unknown theme family \"colour\" — it will not be compiled into any CSS."]
probe exit=0
uxdsl build exit=0
build stdout:
[uxdsl] Theme config detected
[uxdsl] built dist/a.css (48793 bytes)
[uxdsl] built dist/b.css (52 bytes)
build stderr:
[uxdsl] Warning: colour: Unknown theme family "colour" — it will not be compiled into any CSS.
dist/a.css: --uxdsl__border__1: revert --uxdsl__palette__primary-main: initial --uxdsl__radius__2: revert-layer --uxdsl__surface__card-color: unset --uxdsl__typography__emphasis-font-size: inherit 
dist/b.css: 
uxdsl theme exit=0
theme stderr:
[uxdsl] Warning: colour: Unknown theme family "colour" — it will not be compiled into any CSS.
```

**Part 2 — what the keyword becomes in real Chrome.** Same directory and
`TMPDIR`. The plugin compiles a theme whose `spacing.4` and
`typography_details.emphasis.fontSize` are the value under test; the page
reads both custom properties on `:root` and the computed values of their two
consumers (`padding` is not inherited, `font-size` is; the body's font size
is 20px).

```bash
P="$PWD/packages/uxdsl"
X="$(mktemp -d "${TMPDIR:?}/mig-b9-37-chrome.XXXXXX")"
cat > "$X/chrome.js" <<'EOF'
const [P, ROOT] = process.argv.slice(2);
const { chromium } = require('module').createRequire(ROOT + '/fixtures/mig02-nextjs-cssmodules/package.json')('playwright-core');
const postcss = require(P + '/node_modules/postcss');
const uxdsl = require(P + '/dist/plugin');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  console.log(`Chrome ${browser.version()}`);
  const run = async (label, value, layered = '') => {
    const theme = { spacing: { 4: value }, typography_details: { emphasis: { fontSize: value } } };
    const { css } = await postcss([uxdsl({ theme })]).process('@uxdsl theme;\n.pad { padding: space(4); }\n.em { @ds-typo(emphasis); }\n', { from: undefined });
    await page.setContent(`<!doctype html><style>${layered}\n${css}</style><body style="font-size: 20px"><div class="pad">x</div><p class="em">y</p></body>`);
    const r = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return [JSON.stringify(root.getPropertyValue('--uxdsl__space__4')), getComputedStyle(document.querySelector('.pad')).paddingTop,
        JSON.stringify(root.getPropertyValue('--uxdsl__typography__emphasis-font-size')), getComputedStyle(document.querySelector('.em')).fontSize];
    });
    console.log(`${label}: --uxdsl__space__4 ${r[0]}, .pad padding-top ${r[1]}; --uxdsl__typography__emphasis-font-size ${r[2]}, .em font-size ${r[3]}`);
  };
  await run('"1.5rem" (control)', '1.5rem');
  for (const k of ['inherit', 'initial', 'unset', 'revert', 'revert-layer']) await run(`"${k}"`, k);
  await run('"revert-layer" under an @layer that declares both', 'revert-layer', '@layer base { :root { --uxdsl__space__4: 7px; --uxdsl__typography__emphasis-font-size: 9px; } }');
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
EOF
node "$X/chrome.js" "$P" "$PWD"; echo "exit=$?"
rm -rf "$X"
```

The output on `5a041fc`, 2026-11-13 09:22 EST, exactly (no Chrome process
was left running):

```text
Chrome 157.0.8103.51
"1.5rem" (control): --uxdsl__space__4 "1.5rem", .pad padding-top 24px; --uxdsl__typography__emphasis-font-size "1.5rem", .em font-size 24px
"inherit": --uxdsl__space__4 "", .pad padding-top 0px; --uxdsl__typography__emphasis-font-size "", .em font-size 20px
"initial": --uxdsl__space__4 "", .pad padding-top 0px; --uxdsl__typography__emphasis-font-size "", .em font-size 20px
"unset": --uxdsl__space__4 "", .pad padding-top 0px; --uxdsl__typography__emphasis-font-size "", .em font-size 20px
"revert": --uxdsl__space__4 "", .pad padding-top 0px; --uxdsl__typography__emphasis-font-size "", .em font-size 20px
"revert-layer": --uxdsl__space__4 "", .pad padding-top 0px; --uxdsl__typography__emphasis-font-size "", .em font-size 20px
"revert-layer" under an @layer that declares both: --uxdsl__space__4 "7px", .pad padding-top 7px; --uxdsl__typography__emphasis-font-size "9px", .em font-size 9px
exit=0
```

What it shows:

- **Every family, every path, silent.** In all 19 theme paths where a CSS
  value can be written (Spacing, Density, a standalone Color and a shade,
  Palette and its dark mode, a font family, Typography fields of a role and
  of `default`, a breakpoint group of a Typography field, Border, Radius,
  Shadow, Surface fields of a custom and a default role, Button and Input
  base and state fields) and with all five keywords, in lower case, upper
  case and with surrounding whitespace, `validateTheme` returns `ok: true`
  with no warning, `generateThemeCss` and the plugin emit a custom property
  whose whole value is the keyword, and the plugin reports nothing. The
  project's theme reaches `compile()`, the CLI's `build` and `theme`, and
  `applyTheme` the same way: the only warning any of them prints is the
  unknown family's. `dist/a.css`, the entry that writes `@uxdsl theme;`,
  carries the five keyword properties; `dist/b.css` writes no marker, so it
  carries no theme (52 bytes) and none of them.
- **Every compilation validates the theme, marker or not.** Probed on the
  same base, not part of the block above: `compile()` of `src/b.uxdsl`'s
  source alone, with an override that holds only `colour`, returns
  `themeEmitted: false`, 52 bytes of CSS and
  the same `Unknown theme family "colour"` warning, with no file. The CLI
  prints it once because `buildOnce` skips the copy each entry's `compile()`
  returns (`themeWarningTexts`, §2), not because `b` emits no theme.
- **Where they land.** Probed on the same base, not part of the block above:
  a dark-mode value lands in the two dark blocks
  (`@media (prefers-color-scheme: dark) > :root:not([data-theme='light'])`
  and `:root[data-theme='dark']`), a later breakpoint group
  (`xs(1rem) md(inherit)`) inside `@media (min-width: 768px) > :root`, and
  every other one in `:root`. Every consumer the plugin emits reads it
  through `var()` (`font-size: var(--uxdsl__typography__emphasis-font-size)`,
  `color: var(--uxdsl__surface__card-color)`,
  `color: var(--uxdsl__button__text-base-color)`, …); none inlines the value.
- **What it does in Chrome 157.** All five keywords give the custom property
  no value on `:root` (`""`). A non-inherited consumer falls back to its
  initial value (`padding-top: 0px`), an inherited one to the inherited
  value (`font-size: 20px`), which is why Press Craftor's `inherit` trick
  looked right (MIG-B9-03's finding 4). One exception: `revert-layer` takes
  the value a cascade layer declares for the same custom property (`7px`,
  `9px`), since the theme's `:root` block is unlayered (§7, §15 F6).
- **Where a warning can come from today.** The PostCSS plugin, `compile()`,
  the CLI, `generateThemeCss` and `applyTheme` all run the one validator,
  `validateTheme` (§2). It knows the key path of each value; it does not
  know the theme file, which only the CLI loads, nor any stylesheet position.
  `generateThemeCss` returns a string and has no channel for a warning.
- With one entry writing `@uxdsl theme;`, the build prints no
  `UXD_THEME_MARKER` warning: exactly one stylesheet emits the theme.

On the same base, the existing tests of every function this story touches
(`node --test` of `test/diagnostics-catalog.test.js`,
`diagnostics-coverage.test.js`, `theme-validate-unknown-family.test.js`,
`theme-validation-matrix.test.js`, `ds-runtime-apply-theme.test.js`,
`test/cli/uxdsl-cli.test.js` and `test/cli/theme-command.test.js`, from
`packages/uxdsl`) ran 330 tests, 330 passed, exit 0, in 38 s of wall time on
a machine other workflows were using at the same time (indicative only).
They left 218 entries in the scratch `TMPDIR` (`uxdsl-cli-test-*` 179,
`uxdsl-theme-cmd-test-*` 24, `uxdsl-cli-map-*` 10, `uxdsl-cli-flags-*` 5),
MIG-B9-25's territory; the directory was emptied afterwards.

## 5. Contract

The public entry points are `validateTheme` and `generateThemeCss`
(`uxdsl/theme`), the PostCSS plugin (`uxdsl/postcss`), `compile()`
(`uxdsl`), `applyTheme` (`uxdsl/runtime`), `DIAGNOSTIC_CATALOG`
(`uxdsl/language`) and the CLI as a subprocess. Where §15's open questions
leave a choice, the contract assumes the option stated there: Q1 (a), Q2 (a),
Q3 (a), Q4 (a) and Q5 (a), the recommended option of each. BASE is the
commit the story branches from (§9: `git merge-base HEAD origin/feat/beta9`).

- **C1 — `validateTheme` reports it, at the key path.** For a theme value
  that is a CSS-wide keyword, `validateTheme(theme, opts)` returns one
  warning `{ code: 'UXD_THEME_KEYWORD', path, message }`:
  - **The keyword.** The value, with surrounding whitespace removed, is
    `inherit`, `initial`, `unset`, `revert` or `revert-layer`, in any ASCII
    case, as CSS matches it. A value that only contains one (`inherited`,
    `inherit-x`, `1px solid inherit`, `var(--x, inherit)`, `'inherit'`) is
    not one. Under Q3 (a) a responsive expression whose group holds one
    (`xs(1rem) md(inherit)`) is not one either; under Q3 (b) it warns once,
    and the message also names the breakpoint.
  - **Which values.** Every value the structure pass checks as a CSS value:
    a Spacing, Density, Radius, Border or Shadow token; a standalone Color
    and every shade; every Palette variant, in `palette` and in
    `modes.dark.palette`; every `fonts.families` entry; every field of every
    `typography_details` role, `default` included; every Surface field; every
    `base` and state field of a Button or Input role; and the values of any
    family a later story adds whose leaves are CSS values (MIG-B9-34's
    `focus`). Not: a value that names a role (a Button's or Input's
    `surface`, and MIG-B9-32's and 33's `extends`, once merged: Press
    Craftor's theme has a typography role named `inherit`), `breakpoints`
    (numbers), `fonts.google` (font specs) or `$schema`.
  - **One per value.** One warning per theme value written, not per custom
    property emitted: a `default` Typography field that every role takes
    warns once, at `typography_details.default.<field>`.
  - **The fields.** `path` is the dotted key path the validator's other
    issues use (`typography_details.emphasis.fontSize`,
    `modes.dark.palette.primary.main`, `colors.gray.300`,
    `buttons.contained.states.hover.color`). `message` is one line in
    `themeError`'s form: it starts with `UXD_THEME_KEYWORD: `, holds the
    value without its surrounding whitespace in double quotes, and ends with
    ` (at <path>).`.
  - **A warning.** `ok` and `errors` are what BASE returns for the same
    theme; the warning is reported whether or not the theme has errors, as
    `UXD_THEME_FAMILY` is. A theme with no keyword value gets BASE's
    warnings, byte for byte.
- **C2 — The PostCSS plugin relays it.** For each C1 warning of the
  effective theme (passed as `theme` or discovered),
  `postcss([uxdsl(opts)]).process(css, …)` resolves, and `result.warnings()`
  holds one warning whose `text` is C1's `message`, with `plugin` `'uxdsl'`
  and no node, line or column, as `UXD_THEME_FAMILY`'s. The CSS is BASE's.
- **C3 — `compile()` returns it.** `(await compile(input, config)).warnings`
  holds `{ text: <C1's message> }` once per compilation, with no `file`,
  `line` or `column`. The call resolves; `css`, `map` and `dependencies` are
  BASE's.
- **C4 — The CLI prints it once, at its key path.** Under Q5 (a), for each
  C1 warning of the project's theme, `uxdsl build` (one entry or a
  `builds` array) and `uxdsl theme` print, on stderr, exactly one line
  `[uxdsl] Warning: <path>: <message>` per process: the form the CLI already
  gives `UXD_THEME_FAMILY`, printed by the same function before any entry
  compiles. The copy `compile()` returns for each entry is not printed
  again, so a two-entry `builds` prints it once, not twice. Every exit code
  is BASE's (0 for a theme whose only problems are these warnings), stdout
  is BASE's, and every output file is BASE's, byte for byte.
- **C5 — `applyTheme` returns it.** For each C1 warning of the effective
  theme, `applyTheme(patch, opts)` returns `ok: true` with
  `<path>: <message>` in `warnings`, the form it gives every validator
  warning. The managed stylesheet's text, the applied override and the
  persisted state are BASE's.
- **C6 — `generateThemeCss` is unchanged.** Under Q4 (a) it returns BASE's
  string, throws only what BASE throws, and writes nothing to the console or
  to stderr. A caller that wants the warning calls `validateTheme` on the
  same theme (C1); the README says so (§11).
- **C7 — The code is catalogued.** Under Q2 (a), `DIAGNOSTIC_CATALOG` gains
  exactly one entry, `UXD_THEME_KEYWORD`, with owner `theme`, a one-line
  meaning (a theme token value is a CSS-wide keyword, which as a custom
  property on `:root` has no value, so a `var()` of it takes its fallback
  or is invalid; a warning, the value is still emitted) and a one-line fix
  (write the value the token should have). It is produced in
  `theme-validate.ts` and asserted by T1, so
  `test/diagnostics-catalog.test.js` passes unedited.
- **C8 — Nothing else changes.** No error or exit code is added, removed or
  moved; no value is rewritten, dropped or reported as an error.

Must stay byte-identical with BASE:

- every compiled output, for every theme with or without a keyword: the
  plugin's, `compile()`'s, the CLI's files, `generateThemeCss`'s string and
  `applyTheme`'s stylesheet text. The keyword is still emitted as written;
- `validateTheme`'s `ok`, `errors` and every warning BASE gives, and
  `UXD_THEME_FAMILY`'s path and message on every path;
- the CLI's stdout, its exit codes and its `UXD_THEME_FAMILY` line;
  `warnUnknownThemeKeys` keeps its name and its export
  (`test/cli/uxdsl-cli.test.js` calls it);
- `fixtures/parity/expected/**`, the playground's `src/app/uxdsl.css` and
  its captures (`src/generated/cli-captures.json`,
  `compiler-captures.json`): no theme the repository builds writes a
  keyword (§3, lines 10 and 11);
- the theme JSON Schema (`packages/uxdsl/schema/theme.schema.json`) and the
  language artifacts;
- `packages/uxdsl/src/plugin.ts`, `compile.ts`,
  `ds-runtime/theme-generator.ts` and `ds-runtime/apply-theme.ts`, unedited:
  each relays the validator's warnings already;
- `DIAGNOSTIC_CATALOG`, except the one entry C7 adds.

## 6. Out of scope

- **An error under a strict flag.** The evidence proposed "a located
  warning (or error under a strict flag)"; D4 registered "a located
  warning". §15, F4.
- **The consuming declarations' positions** (Q1 (c)): the reference pass
  reporting each author declaration that reads a keyword-valued property.
  The contract assumes Q1 (a).
- **`generateThemeCss` reporting warnings** (Q4 (b) or (c)): it stays pure.
- **The adapters' per-module repetition** of the theme's warnings (§15,
  F3): `vite.ts` and `webpack.ts` relay `compile()`'s warnings as they do
  `UXD_THEME_FAMILY`'s, unedited.
- **A responsive expression in a family that has none** (§15, F1): accepted
  and emitted literally today, keyword or not; a separate defect.
- **The codes and paths missing from `UXD_THEME_FAMILY`'s text** on the
  plugin and `compile()` paths (§15, F2): its forms stay BASE's (C8).
- **`extends: "none"` as the replacement for the `inherit` trick**:
  MIG-B9-33's design (MIG-B9-03's finding 4). This story's documentation
  names it (§11); MIG-B9-33 owns the feature (§15, F5).
- **The theme JSON Schema.** A schema has no warning level; marking the
  keywords there would make editors report an error. Unchanged.
- **A captured case on the playground's `/docs/diagnostics` page.** The
  page renders `DIAGNOSTIC_CATALOG` at build time, so the new entry appears
  there without a capture; adding a case to
  `scripts/capture-capabilities.js` would put this story on
  `packages/playground-nextjs/**`. Not done.
- **The beta.8 → beta.9 migration section**: MIG-B9-91 writes it (D13),
  from the CHANGELOG subsection this story adds. `migration.md` is not
  edited here.
- **Press Craftor's theme**: the patch is applied after beta.9 is published
  (D17); the warning is what that project will see.

## 7. Approach and traps

Non-normative.

- **One check, in the structure pass.** A module-level pattern such as
  `/^\s*(inherit|initial|unset|revert|revert-layer)\s*$/i`, tested where
  `leaf()` (line 193) accepts a CSS value, pushing
  `{ code: 'UXD_THEME_KEYWORD', path, message: themeError('UXD_THEME_KEYWORD', …, path).message }`
  into `warnings`. `themeError` gives the `(at <path>).` ending and refuses
  an uncatalogued code, so the catalog entry comes first.
- **Not every `leaf()` call is a CSS value.** Line 240 passes a control
  role's `surface`, a Surface role's name, through `leaf()`; MIG-B9-32 and
  33 add `extends`, a role's name, and may route it the same way. A role
  may be named `inherit` (Press Craftor has a typography role of that name,
  `@ds-typo(inherit)`), so a check placed inside `leaf()` itself would warn
  on a correct theme (T3, mutation 3). Give `leaf()` a flag, or check at the
  callers that pass CSS values.
- **Under Q3 (b) only:** parse the value with the language's own
  responsive parser (`responsiveEntries`, `uxdsl/language`), never a second
  one (AGENTS.md: "Reuse shared language and Typography
  generators/resolvers").
- **The message's claim.** In Chrome 157 (§4, part 2) the property has no
  value on `:root`, so a `var()` of it takes its fallback if it has one and
  is otherwise invalid at computed-value time (an inherited property then
  inherits; another takes its initial value). `revert-layer` is the
  exception: it takes a cascade layer's declaration of the same property
  when the project has one. The catalog meaning and the message must not
  say "never resolves" without that condition.
- **The CLI, Q5 (a).** Extend the filter at line 782
  (`if (!/^Unknown /.test(w.message)) continue;`) to the new code, so
  `themeWarningTexts` also holds its messages and `buildOnce`'s check at
  line 1072 skips `compile()`'s copies, which every entry returns, whether
  or not it writes `@uxdsl theme;` (§4). The plugin validates the effective
  theme while `warnUnknownThemeKeys` validates the project's override; the
  two messages are the same string because the path and the value are.
  Keep the function's name: it is exported and tested by name. Rewrite the
  comments at lines 762–771, 1027–1028 and 1056–1057 so they state what is
  printed (the unknown family and the CSS-wide keyword), with no story id.
  `build --watch` calls `buildOnce` for every build, so it prints each
  warning once per process, as it does the unknown family.
- **No code in `plugin.ts`, `compile.ts`, `theme-generator.ts` or
  `apply-theme.ts`** (§5's byte-identical list): they relay the validator's
  warnings already. MIG-B9-24's C1 (one engine pass per compilation) moves
  where `validateTheme` runs inside the plugin; the structure pass, where
  this check sits, is the same.
- **The test file, `packages/uxdsl/test/theme-css-wide-keyword.test.js`.**
  It requires the public entries' built files, as the existing theme tests
  do (`../dist/entries/theme`, `../dist/entries/index`, `../dist/plugin`,
  `../dist/entries/runtime`, `../dist/diagnostics`). T7 runs
  `bin/uxdsl.js` with `process.execPath` from a temporary project, so the
  story stays off `packages/uxdsl/test/cli/**`; it uses no shell tool
  (MIG-B9-28 runs CI on Windows) and removes what it creates: with
  MIG-B9-25's helper (`test/helpers/temporary-directory.js`, not on
  `5a041fc`; MIG-B9-25 is a wave-2 story, Ready) if it is merged when this
  story starts, otherwise with `fs.rmSync` in an `after` hook. T8's DOM stub sets
  `globalThis.document` in a child process or restores it after the test,
  so no other test in the process sees it.
- **Documentation examples are compiled.** `scripts/doc-examples.test.js`
  compiles every example in `AGENTS.md` and the package README, and a
  `/* UXD_CODE */` comment means an error. The sentences of §11 carry no
  code block.
- Stop rule: if the warning cannot be added without changing a compiled
  output, an exit code or `UXD_THEME_FAMILY`'s forms, stop, set the story to
  Blocked, and record the case in §15. Never weaken a test, drop a family
  from C1, or turn the warning into an error to get there.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `packages/uxdsl/test/theme-css-wide-keyword.test.js` (new) | `MIG-B9-37: validateTheme warns once, at the key path, for a CSS-wide keyword in every family that holds a CSS value` | unit (`uxdsl/theme`) | C1, C7 | The 18 whole-value paths of §4 (all but the md group) × the five keywords: exactly one `UXD_THEME_KEYWORD` issue each, with C1's `path` and message shape, and `ok: true`. The same 18 paths with a valid value of their family (`1rem`, `red`, `0 1px 2px red`, …) give none, so a check that warns on every value fails; BASE gives none, so the test fails on BASE |
| T2 | same | `MIG-B9-37: the keyword is matched as CSS matches it, in any ASCII case and with surrounding whitespace, and only as the whole value` | unit | C1 | `INHERIT`, ` Revert-Layer ` and `Unset` warn, and the message quotes the value without its whitespace. `inherited`, `inherit-x`, `revert-rule`, `1px solid inherit`, `var(--x, inherit)` and `'inherit'` do not: a substring or prefix match fails |
| T3 | same | `MIG-B9-37: a value that names a role is not a CSS value: a control's surface naming a Surface role called inherit does not warn` | unit | C1 (the exclusion) | `surfaces: { inherit: { color: 'red' } }` with `buttons: { x: { surface: 'inherit' } }` (and, once MIG-B9-32 and 33 are merged, an `extends` naming a role called `inherit`) gives no warning. Its control is the same theme with `surfaces.inherit.color` set to `inherit`: exactly one warning, at `surfaces.inherit.color`, so a check inside every `leaf()` call fails |
| T4 | same | under Q3 (a): `MIG-B9-37: a keyword inside a breakpoint group is not a whole value and does not warn`; under Q3 (b): `MIG-B9-37: a keyword that is the whole of a breakpoint group warns once at the key path, naming the breakpoint` | unit | C1 | `typography_details.emphasis.fontSize: 'xs(1rem) md(inherit)'` and `borders.1: 'xs(inherit) md(1px solid red)'`. Under (a): no `UXD_THEME_KEYWORD`. Under (b): one each, naming `md` and `xs`, and the control `xs(1rem) md(2rem)` gives none. Either way the opposite implementation fails |
| T5 | same | `MIG-B9-37: a warning, not an error: generateThemeCss returns the keyword as written and prints nothing` | unit (`uxdsl/theme`) | C1, C6, C8 | With `console.warn`, `console.error` and `process.stderr.write` spied: `generateThemeCss` of a keyword theme returns CSS whose `:root` declares `--uxdsl__typography__emphasis-font-size: inherit`, and nothing is written. Its control: the same theme plus `spacing: { 4: 4 }` (a number) still throws `UXD_THEME_INVALID`, and `validateTheme` reports both the error and the keyword warning, so a change that makes every issue a warning, or drops the keyword declaration, fails |
| T6 | same | `MIG-B9-37: uxdsl/postcss reports it through result.warn and compile() returns it, once per compilation and without a position` | unit (`uxdsl/postcss`, `uxdsl`) | C2, C3 | A theme with `colour` and three keyword values: `result.warnings()` and `compile().warnings` each hold the three C1 messages once, with no line or file, and `colour`'s text is BASE's (`Unknown theme family "colour" — it will not be compiled into any CSS.`). The same input with `1rem` in place of each keyword gives no `UXD_THEME_KEYWORD` |
| T7 | same | `MIG-B9-37: uxdsl build prints it once per process at its key path across a two-entry builds config, uxdsl theme prints it too, and both exit 0` | CLI (subprocess) | C4 | §4's project: `build` exits 0 and its stderr has exactly one `[uxdsl] Warning: <path>: UXD_THEME_KEYWORD: …` line per keyword path, plus BASE's `colour` line; `theme` exits 0 with the same lines. BASE's filter, which leaves the new warnings to `compile()`'s per-entry relay, prints each twice and without the `<path>: ` prefix, so it fails. A theme without keywords prints no `UXD_THEME_KEYWORD` line |
| T8 | same | `MIG-B9-37: applyTheme returns it in warnings and still applies the theme (Node, a DOM stub: the result only)` | unit (`uxdsl/runtime`) | C5 | `applyTheme({}, { replace: true })` returns `warnings: []`; the keyword patch returns `ok: true`, `<path>: <message>` for each keyword, and a stylesheet text that still declares each keyword property. A change that rejects the patch, or drops the declaration, fails |
| T9 | `packages/uxdsl/test/diagnostics-catalog.test.js`, `diagnostics-coverage.test.js` (unedited) | as they are | unit | C7 | Built in: a code the sources produce and the catalog lacks fails "every code the sources can produce is cataloged", and `themeError` throws `uxdsl: diagnostic UXD_THEME_KEYWORD is not in DIAGNOSTIC_CATALOG` |

T1, T2, T6, T7 and T8 are the failing-first tests (README §2): each fails
on BASE, which reports nothing. T3, T4 (under Q3 (a)) and T5 state what the
change must keep; they pass on BASE by design, and their controls show they
can fail. Under Q3 (b), T4 fails on BASE too.

## 9. Acceptance criteria

BASE below is `git merge-base HEAD origin/feat/beta9`.

- **AC1** `TMPDIR=<an empty scratch directory> node --test packages/uxdsl/test/theme-css-wide-keyword.test.js`
  exits 0, with T1 to T8 run and none skipped, and leaves that directory
  empty.
  - Test file: `packages/uxdsl/test/theme-css-wide-keyword.test.js`.
  - Mutations, each of which fails the tests named:
    1. BASE's `theme-validate.ts` (no check): T1, T2, T6, T7, T8;
    2. a case-sensitive or untrimmed match: T2;
    3. the check inside every `leaf()` call, `surface` included: T3;
    4. the warning pushed into `errors`: T1 (`ok`), T5, T7 (exit 1);
    5. BASE's CLI filter (`/^Unknown /`): T7;
    6. under Q3 (a), matching groups; under Q3 (b), not matching them: T4;
    7. `generateThemeCss` printing the warnings: T5;
    8. the keyword declaration dropped or rewritten: T5, T8.
- **AC2** `node --test packages/uxdsl/test/diagnostics-catalog.test.js packages/uxdsl/test/diagnostics-coverage.test.js`
  exits 0, both files unedited.
  - Test files: the two named (T9).
  - Mutation: the catalog entry removed. `themeError` then throws, which
    fails T1, and the catalog test fails.
- **AC3** §4's part 1, re-run on the head through `bash`, exits 0. It prints
  what the same block prints on BASE (re-run as §3 says), with these
  differences only:
  - `validateTheme: … with a warning 126/133` under Q3 (a), `133/133` under
    Q3 (b);
  - `result.warnings() non-empty` the same count;
  - `compile(): warnings` also holds the five C1 messages (for
    `palette.primary.main`, `typography_details.emphasis.fontSize`,
    `surfaces.card.color`, `borders.1` and `radii.2`), with no file;
  - `applyTheme`'s `warnings` also holds those five as `<path>: <message>`;
  - `build stderr` and `theme stderr` each also hold those five as
    `[uxdsl] Warning: <path>: <message>` lines, each once.

  The other lines, `dist/a.css` and `dist/b.css` included, are BASE's.
  - Test file: none (the reproduction of §4).
  - Mutation: BASE's code prints BASE's output, with none of the
    differences above.
- **AC4** `node --test packages/uxdsl/test/theme-validate-unknown-family.test.js packages/uxdsl/test/theme-validation-matrix.test.js packages/uxdsl/test/ds-runtime-apply-theme.test.js packages/uxdsl/test/cli/uxdsl-cli.test.js packages/uxdsl/test/cli/theme-command.test.js`
  exits 0, and
  `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/test/theme-validate-unknown-family.test.js packages/uxdsl/test/theme-validation-matrix.test.js packages/uxdsl/test/ds-runtime-apply-theme.test.js packages/uxdsl/test/cli packages/uxdsl/test/diagnostics-catalog.test.js packages/uxdsl/test/diagnostics-coverage.test.js packages/uxdsl/src/plugin.ts packages/uxdsl/src/compile.ts packages/uxdsl/src/ds-runtime/theme-generator.ts packages/uxdsl/src/ds-runtime/apply-theme.ts packages/uxdsl/schema fixtures/parity/expected packages/playground-nextjs/src/generated packages/playground-nextjs/src/app/uxdsl.css`
  exits 0.
  - Test files: the five named.
  - Mutation: none; an invariant guard, like C8.
- **AC5** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk`
  exits 0; `npm run verify:playground-browser` exits 0.
  - Test files: the suites `npm test` runs, which include AC1's file
    (`node --test test/*.test.js` in `packages/uxdsl`), the parity oracles,
    the captures check, the documentation examples and the agent guide's
    `--check`; and `fixtures/release-1.0/run.js`.
  - Mutation: AC1's, which `npm test` runs; the two gates are invariant
    guards (no compiled output changes, and the playground renders the new
    catalog entry on `/docs/diagnostics` and `/docs/language`).

Owner checks, never marked PASS by the agent:

- Answer §15's Q1 to Q5 before the story starts. The contract assumes
  Q1 (a), Q2 (a), Q3 (a), Q4 (a) and Q5 (a) until then.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: one subsection under `## 0.5.0-beta.9 — unreleased`, with `### Visual changes`: none. The docs guard does not demand it (`theme-validate.ts` and `diagnostics.ts` are in `NON_VISUAL_SOURCE_FILES`, and `bin/` is outside `src`), but every consumer with such a value sees a new warning |
| package README | yes: the docs guard demands it for any change under `packages/uxdsl` outside its docs; one sentence (§11) |
| `verify-docs-update.js` classification | no (no file added or deleted under `packages/uxdsl/src`) |
| `npm run generate:language` | no (the schema and completions do not change; `node scripts/generate-language-artifacts.js --check` stays green) |
| `AGENTS.md` + agent guide | yes: one sentence (§11), then `npm run generate:agent-guide` |
| `DIAGNOSTIC_CATALOG` | yes (C7) |
| `npm run generate:capabilities` | no (diagnostics are one capability row, "UXD_* error codes") |
| playground `uxdsl:build` + captures | no (no playground theme writes a keyword; the catalog pages read `DIAGNOSTIC_CATALOG` when the playground builds) |
| `migration.md` | no (§6: MIG-B9-91 writes beta.9's migration section) |

## 11. Documentation

- `packages/uxdsl/src/ds-runtime/theme-validate.ts`: `validateTheme`'s doc
  comment (lines 149–175) states the new warning next to `UXD_THEME_FAMILY`,
  and `ThemeValidationIssue`'s `code` comment (lines 15–17) names it.
- `packages/uxdsl/bin/uxdsl.js`: the comments of §7 (lines 762–771,
  1027–1028, 1056–1057) state that the CLI prints the validator's warnings
  for an unknown family and a CSS-wide keyword once per process, with their
  path.
- `packages/uxdsl/src/diagnostics.ts`: the `UXD_THEME_KEYWORD` entry, next
  to `UXD_THEME_FAMILY` (line 47).
- `AGENTS.md`, "Build time, runtime and one source of truth", the
  validator's paragraph (lines 799–818): one sentence after "An unknown
  top-level family is a warning (`UXD_THEME_FAMILY`), not an error.". It
  says that a token value that is a CSS-wide keyword is a warning,
  `UXD_THEME_KEYWORD`, at its key path, because as a custom property on
  `:root` it has no value; that a theme should not write one; and that a
  typography role that should not take `default`'s field uses
  `"extends": "none"` (MIG-B9-33, merged before this story under §7). Then
  `npm run generate:agent-guide`.
- `packages/uxdsl/README.md`, after the `UXD_THEME_FAMILY` paragraph (lines
  1760–1768): one sentence with the same content, and that
  `generateThemeCss` returns its CSS without warnings, so a server that
  wants them calls `validateTheme` on the same theme (C6).
- `packages/uxdsl/CHANGELOG.md`: one subsection at the top of
  `## 0.5.0-beta.9 — unreleased`, above the newest one there, titled after
  the change and ending `(MIG-B9-37)`. It says that a theme value of
  `inherit`, `initial`, `unset`, `revert` or `revert-layer` now warns,
  `UXD_THEME_KEYWORD`, at its key path, on every path that validates a
  theme, the CLI printing it once; that the CSS is unchanged; and
  `### Visual changes`: none.
- Not edited: `migration.md` (§6), the playground, the theme JSON Schema.

## 12. Verification

```bash
TMPDIR=<empty dir> node --test packages/uxdsl/test/theme-css-wide-keyword.test.js   # exit 0; T1–T8 run; <empty dir> stays empty
node --test packages/uxdsl/test/diagnostics-catalog.test.js packages/uxdsl/test/diagnostics-coverage.test.js   # exit 0 (AC2)
TMPDIR=<empty dir> bash <§4's part 1>                                                # exit 0; AC3's lines
node --test packages/uxdsl/test/theme-validate-unknown-family.test.js packages/uxdsl/test/theme-validation-matrix.test.js packages/uxdsl/test/ds-runtime-apply-theme.test.js packages/uxdsl/test/cli/uxdsl-cli.test.js packages/uxdsl/test/cli/theme-command.test.js   # exit 0 (AC4)
git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- <AC4's paths>      # exit 0
npm run verify:doc-examples                    # exit 0
node scripts/generate-agent-guide.js --check   # exit 0
node scripts/generate-language-artifacts.js --check   # exit 0
npm test                                       # background, with a log; exit 0
npm run verify:1.0 -- --skip-playground-walk   # background, with a log; exit 0
npm run verify:playground-browser              # background, with a log; exit 0 (Chrome)
```

§4's part 2 (Chrome) is evidence for the catalog's meaning, not an
acceptance criterion: the story changes no rendering. It may be re-run on
the head and must print BASE's lines.

## 13. Delivery

Delivered by the light flow for an S story (decision D1 of 2026-11-04): a
scout, one implementer, one review and the deliverer.

Branch `feat/b9-37-css-wide-keyword-warning`. Commit:
`feat(FEAT-010): MIG-B9-37 - a CSS-wide keyword as a theme token value warns at its key path`.

PR title: `FEAT-010: MIG-B9-37 - a located warning for a CSS-wide keyword as a theme token value`.
The body:

- **Goal:** §1, in two sentences.
- **Owner answers:** Q1 to Q5 as answered, and what each changed in §5.
- **C1 to C5:** AC3's output next to BASE's, and T1 to T8's results.
- **C6 to C8:** AC2 and AC4, against BASE's SHA.
- **Gates:** `npm test`, `verify:1.0 -- --skip-playground-walk`,
  `verify:playground-browser`, with exit codes.
- **Not run, or not a pass:** anything §14 lists so.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

Found while writing this story, first on `a00fbbe` (2026-11-10) and again
on `5a041fc` (2026-11-13), where every one was re-checked. None is fixed
here.

- **F0 — The re-run on `5a041fc`.** This story was first measured on
  `a00fbbe`, before MIG-B9-20 merged. On `5a041fc` the preconditions' line 3
  names `cc10de6` (PR #88) instead of `a00fbbe` (PR #82), and §4 differs in
  the lines MIG-B9-20 changed and in nothing this story is about: the build
  printed `Theme config detected` twice, built `dist/b.css` at 47,938 bytes
  with the five keyword properties and warned `2 entries emit the theme
  (builds[0], builds[1])`; on `5a041fc` it prints `Theme config detected`
  once, builds `dist/b.css` at 52 bytes with no theme, and gives no marker
  warning. Chrome was 157.0.8103.39, now 157.0.8103.51, with the same
  lines. The existing tests ran 338 then, 330 now, all passing. The
  validator, the generator, `applyTheme` and the catalog are unchanged
  between the two bases; the source lines cited from `plugin.ts`,
  `bin/uxdsl.js`, `AGENTS.md` and the package README moved, and §2, §7 and
  §11 cite them on `5a041fc`.

- **F1 — A responsive expression in a family that has none is accepted and
  emitted literally.** AGENTS.md says a responsive expression is "not in
  Spacing, Colors, Palette or `fonts.families`". On `5a041fc`,
  `spacing: { 4: "xs(2rem)" }` and
  `palette: { primary: { main: "xs(1rem) md(red)" } }` pass `validateTheme`
  (`ok: true`, no warning), and the plugin emits
  `--uxdsl__space__4: xs(2rem)` and
  `--uxdsl__palette__primary-main: xs(1rem) md(red)` with no warning, so
  `padding: space(4)` is invalid at computed-value time. `xs(inherit)` there
  is the same case, not a keyword. Proposed: the owner's call, a new S story
  (no id registered here).
- **F2 — The theme's warnings carry neither code nor path on the plugin and
  `compile()` paths.** `UXD_THEME_FAMILY`'s text is
  `Unknown theme family "colour" — it will not be compiled into any CSS.`
  (§4's `compile()` line): no `UXD_THEME_FAMILY`, no path. The CLI and
  `applyTheme` add the path; no host prints the code. This story's warning
  carries both in its message (C1); `UXD_THEME_FAMILY` stays as it is (C8),
  since the CLI deduplicates on that exact text (`themeWarningTexts`) and
  tests match it (`test/cli/uxdsl-cli.test.js` lines 1094, 1113, 1136,
  1650, 1855, 1861 and 1862; `fixtures/release-1.0/run.js` lines 770 and
  780, on `5a041fc`). Proposed: the owner's call, a follow-up that gives it
  the same form.
- **F3 — Every compilation validates the theme, so the adapters repeat its
  warnings per module.** The plugin validates in `validateOptions`
  (`plugin.ts` lines 125–127), on every compilation, marker or not (§4),
  and `vite.ts` (line 200) and `webpack.ts` (line 228) relay each
  `compile()` warning, so a Vite or webpack build of N `.uxdsl` modules
  reports `UXD_THEME_FAMILY` N times today, and will report
  `UXD_THEME_KEYWORD` the same way. Read from the code, not run. MIG-B9-20,
  merged, counts `UXD_THEME_MARKER` once per build on every host
  (`vite.ts` lines 211 and 236) but left the theme's validator warnings per
  compilation. Proposed: the owner's call; a follow-up could report the
  theme's warnings once per build on every host, as `UXD_THEME_MARKER` is.
- **F4 — The strict flag is not registered.** The evidence proposed "a
  located warning (or error under a strict flag)"; D4 registered "a located
  warning". `strictTheme` and `--strict-theme` exist (the CLI's partially
  defaulted families). Proposed: the owner's call; no story.
- **F5 — MIG-B9-33's documentation target from finding 4.** MIG-B9-03's
  finding 4 also says "MIG-B9-33 documents `extends: "none"` as the
  replacement for the trick". MIG-B9-33's story file on `5a041fc` does not
  mention finding 4 or the trick (it cites Press Craftor's F‑9 and F‑13,
  line 25). This story's AGENTS.md and README sentences name
  `"extends": "none"` (§11). Proposed: MIG-B9-33's §11, the owner's call.
- **F6 — `revert-layer` is not always guaranteed-invalid.** Chrome 157
  resolves it to a cascade layer's declaration of the same custom property
  (§4, part 2, last line), since the theme's `:root` block is unlayered. The
  registration names `revert-layer`, so it warns (C1); §7 keeps the message
  from claiming more. A fact, not a defect.

### Open questions for the owner (answer before implementing)

The owner's standing instruction of 2026-11-10 (FEAT-010 §2,
`docs/features/FEAT-010-beta9.md` lines 380–381: "every owner question is
answered with its recommended option") may answer these as
recommended; the contract assumes the recommended option of each, so such an
answer changes nothing in §5.

1. **Q1 — Where the warning is located.** D4 says "a located warning" and
   does not say where. `validateTheme` knows each value's key path; only
   the CLI knows the theme file; no path knows a line in a theme file (a
   `.js`/`.cjs` theme has none).
   - (a) The key path, from the one validator: the issue's `path`, and a
     message that ends `(at <path>).`, as a theme error's does. Every path
     relays it as it relays `UXD_THEME_FAMILY`: the plugin's and
     `compile()`'s text, the CLI's `[uxdsl] Warning: <path>: <message>`,
     `applyTheme`'s `<path>: <message>`.
   - (b) As (a), and the CLI also names the theme file it loaded, as
     `annotateThemeError` does for a theme error:
     `[uxdsl] Warning: uxdsl.theme.json: <path>: <message>`. One more line in
     `bin/uxdsl.js`; `UXD_THEME_FAMILY` would keep its form, so the two theme
     warnings would read differently.
   - (c) The consuming declarations: the reference pass also reports each
     author declaration whose `var()` reaches a keyword-valued property, at
     its file, line and column, as `UXD_REFERENCE_MISSING` names its chain.
     Only the stylesheet paths have it, not `validateTheme`,
     `generateThemeCss` or `applyTheme`; a token no declaration reads is not
     reported; it adds `reference-core.ts` and `plugin.ts` to Shares.
   - (d) The `@uxdsl theme;` marker, where the stylesheet emits the
     property (MIG-B9-20, merged): a stylesheet position, but not where the
     fix goes, and a compilation without the marker, which still validates
     the theme (§4), has none to give.

   Recommendation: (a). The key path is where the fix goes, it reaches
   every path from the one validator, and it is the location every theme
   issue already carries. The contract assumes (a).
2. **Q2 — The code.** D4 names no code.
   - (a) A new catalogued code, `UXD_THEME_KEYWORD`, owner `theme` (C7).
     Other names that fit the `UXD_THEME_*` series: `UXD_THEME_CSS_WIDE`.
   - (b) `UXD_THEME_FAMILY`, with its meaning widened to cover it.
   - (c) No code, as `UXD_THEME_FAMILY`'s text has none today (F2).

   Recommendation: (a). The index's rule asks a new behavior to carry a
   catalogued code, and (b) would give one code two meanings. The contract
   assumes (a), and §7 of the index already lists this story on
   `diagnostics.ts`.
3. **Q3 — A keyword that is the whole of a breakpoint group.** §4 shows
   `xs(1rem) md(inherit)` emitting
   `--uxdsl__typography__emphasis-font-size: inherit` inside
   `@media (min-width: 768px) { :root { … } }`: the same guaranteed-invalid
   property, from `md` up, silently.
   - (a) Only a value that is itself a keyword warns.
   - (b) A responsive expression whose group is exactly a keyword warns too,
     once per value, naming the breakpoint, parsed with the language's own
     `responsiveEntries`. About five more lines.

   Recommendation: (a). D4 registered "a CSS-wide keyword as a theme token
   value", and a responsive expression is not one; (b) would widen the
   registration, which only the owner can do. (b) closes the same defect D4
   describes ("emit a guaranteed-invalid `:root` property today, silently")
   for a breakpoint group, at the cost of a second parse of every
   responsive value in the structure pass; the owner may take it instead.
   The contract assumes (a); T4 has a title for each, and AC3's count is
   126/133 under (a), 133/133 under (b).
4. **Q4 — `generateThemeCss`.** It validates, then returns a string; it has
   no channel for a warning, and drops `UXD_THEME_FAMILY` today.
   - (a) Unchanged (C6). A caller that wants the warning calls
     `validateTheme` on the same theme, and the README says so.
   - (b) It writes each warning with `console.warn`: a side effect in a
     function AGENTS.md calls "pure and per request", used on servers and in
     the browser runtime.
   - (c) A new option, an `onWarning` callback: a public API change.

   Recommendation: (a). The contract assumes (a).
5. **Q5 — How the CLI prints it.**
   - (a) Once per process, at its key path, by `warnUnknownThemeKeys`, whose
     filter (`/^Unknown /`) is extended to the new code, so `compile()`'s
     per-entry copies are skipped. `bin/uxdsl.js` joins Shares.
   - (b) No CLI change: the CLI prints `compile()`'s copy, once per entry and
     per build, as `[uxdsl] Warning: <message>`. A two-entry `builds` prints
     it twice (Press Craftor's has seven entries), and `build --watch`
     prints it again on every rebuild. `bin/uxdsl.js` leaves Shares, and
     T7's control becomes its assertion.

   Recommendation: (a). The CLI's own comments (`bin/uxdsl.js` lines
   762–771 and 1027–1028 on `5a041fc`) say a theme warning is printed once, in the form that names
   its path; (a) applies that design to the new warning. The contract
   assumes (a).
