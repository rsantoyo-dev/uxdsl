# MIG-B9-18 — The codemod's directive-argument rewrite is complete in one run

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | None (registered by decision 36 of 2026-11-10, as proposed in MIG-B9-29 §15, owner flag 4) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-29 (merged, PR #82). Under README §7 it shares only the append-only rows (`packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/README.md`) with any unmerged story. §7's opening sentence, "every wave-3 story waits for MIG-B9-21", is asked about in §15, Q4; until it is answered the story also waits for MIG-B9-21 |
| Blocks | MIG-B9-91 (its gate requires every wave-3 story merged, MIG-B9-18 included: decision 35 of 2026-11-10). In `0.5.0-beta.10`, MIG-B9-60 if its story file comes to edit the codemod (§15, F12; provisional) |
| Base | `feat/beta9` after MIG-B9-29 (and after MIG-B9-21 until §15's Q4 is answered). §3 and §4 were recorded on `5a041fc` (`docs/b9-wave3-story-files`: `feat/beta9` at `cc10de6`, with MIG-B9-20 merged, plus documentation commits); both are re-run on the base the story starts from |
| Owns | `packages/uxdsl/scripts/codemod-canonical-grammar.js` (the directive-argument rewrite, its place in `rewrite()`, and the header comment), `packages/uxdsl/test/codemod-canonical-grammar.test.js` (new `MIG-B9-18:` tests appended; the comment at lines 112–113 rewritten) |
| Shares | `packages/uxdsl/CHANGELOG.md` (one subsection under `## 0.5.0-beta.9 — unreleased`), `packages/uxdsl/README.md` (one sentence in "Codemod: `scripts/codemod-canonical-grammar.js`") |
| Output impact | CLI: the shipped codemod rewrites a directive's function arguments and quoted `palette()`/`color()` arguments in one run, and removes an escaped quote with its backslash. Compiled output: none |

## 1. Goal

One run of `scripts/codemod-canonical-grammar.js` finishes the directive
arguments it rewrites: a comma list with function arguments
(`@ds-surface(contained, radius(2), shadow(1))`), under §15's Q5 (b) the
form without parentheses with a function argument
(`@ds-surface contained radius(2);`), and
a quoted `palette()`/`color()` argument (`@ds-surface(palette("primary-main"))`)
reach their canonical spelling in the first run, so a second run changes
nothing. A directive inside a JSON or JavaScript string that holds an escaped
quote (`\"outlined\"`) is rewritten without breaking the string. Today the
first two are left half done, the third takes two runs, and the fourth leaves
a JSON file that `JSON.parse` rejects (§4).

## 2. Sources

- The decision, FEAT-010 §2, "Owner decisions of 2026-11-10", MIG-B9-29's
  delivery flags (`docs/features/FEAT-010-beta9.md` on `5a041fc`, line 399):

  > - **Decision 36 — F3, F7 and F8 (flag 4).** (a): MIG-B9-18 is registered, "The codemod's directive-argument rewrite is complete in one run": wave 3, S, decision gate none, depends on MIG-B9-29 (merged), branch `feat/b9-18-codemod-directive-arguments`. It runs the dashed-key rewrite on the arguments after the quotes are stripped (F8), rewrites a comma list with function arguments in one run (F3), and leaves a JSON string escape intact (F7). Option (b), folding them into MIG-B9-60's `doctor --fix`, is not taken. MIG-B9-18 ships in `0.5.0-beta.9` with wave 3.

  and line 398:

  > - **Decision 35 — F8 and the shipped claim "a second run changes nothing" (flag 3).** (a): the package README's "so a second run changes nothing" and the CHANGELOG's "Running the codemod again now changes nothing." stay as written, and F8 is fixed in `0.5.0-beta.9` by MIG-B9-18 (decision 36), so the claim holds when beta.9 ships. Until MIG-B9-18 merges, the claim is broader than the code for a quoted `palette()`/`color()` argument inside a directive (`@ds-surface(palette("primary-main"))` takes two runs). MIG-B9-91's gate requires every wave-3 story merged, MIG-B9-18 included.

  Both continue the owner's standing instruction of 2026-11-10 (same file,
  lines 372–380), verbatim "fusiona todo.. y preguntas como recomendadas, y
  sgeuimos" ("merge everything, and the questions as recommended, and let's
  keep going"): each recommendation of MIG-B9-29's delivery flags is the
  owner's decision of 2026-11-10, and the owner may still override any of
  them. The wave table (same file, line 417) lists "Registered on 2026-11-10,
  from MIG-B9-29's delivery (decision 36): the codemod's directive-argument
  rewrite is complete in one run" in wave 3, `0.5.0-beta.9`.
- The findings, MIG-B9-29 §15 (`docs/features/FEAT-010/MIG-B9-29-codemod-idempotent.md`).
  F3, lines 770–776:

  > - **F3 — Two lax directive forms with a function argument are left half
  >   done.** `@ds-surface(contained, radius(2), shadow(1))` becomes
  >   `@ds-surface(contained radius(2), shadow(1))`, because the comma rewrite
  >   stops at the first `)`, and `@ds-surface contained radius(2);` is not
  >   rewritten. Both then fail as located `UXD_SURFACE_ARGUMENT` errors ("Separate the
  >   arguments with spaces, not ","." and "Write @ds-surface(contained
  >   radius(2)), with the parentheses directly after the name."), and a second
  >   run leaves both unchanged, so it is not an idempotency defect.

  F7, lines 902–907:

  > - **F7 — The directive rewrite corrupts a JSON string that holds an escaped double quote.** Found by the scout; pre-existing on BASE.
  >   - Input: `{"css":".c { @ds-button(\"outlined\", primary); }"}`.
  >   - Result: `@ds-button(\outlined\ primary)`, which `JSON.parse` rejects (`Bad escaped character in JSON at position 25`).
  >   - A second run leaves the file as it is, so this is not an idempotency defect.
  >   - T1's `.json` fixture writes the quoted form with single quotes, and the test says why in a comment.

  F8, lines 908–913:

  > - **F8 — A quoted `palette()`/`color()` argument inside a directive takes two runs.** Found by the review; pre-existing on BASE.
  >   - Input: `@ds-surface(palette("primary-main"))` and `@ds-button(contained, color('gray-300'))`.
  >   - Run 1 prints only `directive arguments ×2`. The dashed-key rewrite runs before the directive rewrite strips the quotes, so it leaves `palette(primary-main)` and `color(gray-300)`.
  >   - Run 2 prints `palette()/color() dashed -> dotted ×2` and `1 file(s) rewritten`. Run 3 gives `0 file(s) rewritten`. BASE `e704b3e` prints the same three runs. With an ambiguous key, run 2 would also print an `unresolved:` line that run 1 did not.
  >   - It sits in the same directive-argument rewrite as F3 and F7.

  Owner flag 4, option (a), line 949:

  > - (a) A new S story, proposed as MIG-B9-18 […]: "The codemod's directive-argument rewrite is complete in one run". It would run the dashed-key rewrite after the quotes are stripped, rewrite a comma list with function arguments, and leave a JSON escape intact. Placed in wave 3 so it ships in beta.9.

- MIG-B9-29's contract and record, which this story builds on:
  - C5, lines 366–369: "every other rewrite (`rounded()`, `elevation()`,
    `radius(full)`, dashed `palette()`/`color()`, directive arguments) and the
    `densities(…)` report give BASE's files and BASE's printed lines for every
    input". This story changes exactly the directive-argument rewrite and
    where the dashed-key rewrite sees its arguments.
  - §14, line 696: "**C1.** A second run writes no file and ends
    `0 file(s) rewritten` (or `0 file(s) would change`). It prints exactly the
    first run's `unresolved:` lines, under `  <file>`. […] It does not hold
    "for any files": a quoted `palette()`/`color()` argument inside a
    directive needs a second run, on BASE as on the head (F8 in §15)."
  - Its "Owner decisions of 2026-11-10, on the delivery's flags", line 974:
    "§14's record of C1, which names F8 as the exception, stays as
    delivered."
- The code, `packages/uxdsl/scripts/codemod-canonical-grammar.js` on `5a041fc`
  (unchanged since `a00fbbe`):
  - line 122, the dashed-key rewrite, which runs before the directives:
    `out = out.replace(/\b(palette|color)\(\s*([a-z][a-z0-9-]*)\s*(,[^()]*)?\)/gi, …`
  - lines 132–144, the directive rewrite. Its three patterns stop at the
    first `)` (`\\(([^)]*)\\)`), refuse any parenthesis in the form without
    parentheses (`([a-z][^;{}()\\n]*?)`), and remove quotes one character at
    a time (line 139: `let next = inner.replace(/["']/g, '');`), so a
    backslash before a quote stays.
  - lines 11–12 of the header: `@ds-x (args) / @ds-x args; / @ds-x(a, b) / @ds-x("a")  -> @ds-x(a b)`.
- What the documentation claims, and decision 35 keeps:
  - `packages/uxdsl/README.md` lines 785–788: "The package ships a codemod
    that rewrites the removed spellings to the canonical ones —
    `rounded()`/`elevation()`/`radius(full)`, dashed `palette()`/`color()`
    arguments, and the lax directive forms (a space before the parentheses,
    missing parentheses, commas, quotes)"; line 801: "so a second run changes
    nothing".
  - `packages/uxdsl/CHANGELOG.md` lines 196–197, in MIG-B9-29's subsection
    (heading at line 188): "Running the codemod again now changes nothing."
  - `AGENTS.md` lines 44–45: "`scripts/codemod-canonical-grammar.js` in
    `uxdsl` rewrites the removed spellings."
- The test file it extends, `packages/uxdsl/test/codemod-canonical-grammar.test.js`
  lines 112–113, a comment this story makes false:
  "A double quote inside a JSON string is an escape (`\"`), which the /
  directive rewrite does not handle; the quoted form uses single quotes."
- It ships: `packages/uxdsl/package.json` line 40 (`files`) and line 94
  (`codemod:canonical-grammar`); `packages/uxdsl/test/entries.test.js` line 50.

## 3. Preconditions

```bash
git merge-base --is-ancestor a00fbbe HEAD                                     # MIG-B9-29 (PR #82) is in the base
test -f packages/uxdsl/scripts/codemod-canonical-grammar.js && test -f packages/uxdsl/test/codemod-canonical-grammar.test.js
grep -qF '@${name}\\(([^)]*)\\)' packages/uxdsl/scripts/codemod-canonical-grammar.js        # the argument scan that stops at the first ")" (F3)
grep -qF '([a-z][^;{}()\\n]*?)' packages/uxdsl/scripts/codemod-canonical-grammar.js         # the form without parentheses refuses a function argument (F3)
grep -qF "let next = inner.replace(/[" packages/uxdsl/scripts/codemod-canonical-grammar.js   # quotes removed one character at a time (F7)
node -e "const s = require('fs').readFileSync('packages/uxdsl/scripts/codemod-canonical-grammar.js', 'utf8'); process.exit(s.indexOf('dashed -> dotted') < s.indexOf('for (const name of DIRECTIVES)') ? 0 : 1)"   # the dashed-key rewrite runs first (F8)
test "$(grep -c "^test('MIG-B9-29: " packages/uxdsl/test/codemod-canonical-grammar.test.js)" = 7    # MIG-B9-29's seven tests
grep -qF "which the" packages/uxdsl/test/codemod-canonical-grammar.test.js && grep -qF "directive rewrite does not handle; the quoted form uses single quotes." packages/uxdsl/test/codemod-canonical-grammar.test.js   # the comment §11 rewrites
! git grep -q "MIG-B9-18" -- packages/uxdsl                                     # nothing of this story is in the package yet
node -e "process.exit(require('./packages/uxdsl/package.json').files.includes('scripts/codemod-canonical-grammar.js') ? 0 : 1)"   # it ships
test -f packages/uxdsl/dist/entries/theme.js && test -f packages/uxdsl/dist/plugin.js          # the codemod's theme fallback; the plugin §4 compiles with
grep -qF "so a second run changes nothing" packages/uxdsl/README.md && grep -qF "Running the" packages/uxdsl/CHANGELOG.md && grep -qF "codemod again now changes nothing." packages/uxdsl/CHANGELOG.md   # the claims decision 35 keeps
```

All twelve exit 0 on `5a041fc` (2026-11-13, run from the worktree root with
`command grep`, since the writer's shell defines `grep` as a function; the
lines are written for a plain shell). They are re-run on the base the story
starts from. A line that is only stale is corrected as README §1 item 4
allows. No story registered before this one edits the codemod or its test
file (§15, F12).

## 4. Baseline

Run from the worktree root, on `5a041fc`, with `TMPDIR` set to an empty
scratch directory, through `bash` (2026-11-13, macOS 27.0, Node 20.19.0, npm
11.21.1):

```bash
G="${G:-$PWD/packages/uxdsl/scripts/codemod-canonical-grammar.js}"
X="$(mktemp -d "${TMPDIR:?}/mig-b9-18.XXXXXX")"
# (1) F3: a function argument in a comma list, and in the form without parentheses.
printf '%s\n' '.a { @ds-surface(contained, radius(2), shadow(1)); }' '.b { @ds-surface contained radius(2); }' > "$X/f3.css"
# F7: an escaped double quote inside a JSON string.
printf '%s\n' '{"css":".c { @ds-button(\"outlined\", primary); }"}' > "$X/f7.json"
# F8: a quoted palette()/color() argument inside a directive.
printf '%s\n' '.d { @ds-surface(palette("primary-main")); }' ".e { @ds-button(contained, color('gray-300')); }" > "$X/f8.css"
# The same defect as F8 for radius(full): a quoted radius("full") inside a directive.
printf '%s\n' '.f { @ds-surface(contained radius("full")); }' > "$X/rf.css"
for f in f3.css f7.json f8.css rf.css; do
  for r in 1 2 3; do
    echo "== $f, run $r, preview"; (cd "$X" && node "$G" "$f"; echo "exit=$?")
    echo "== $f, run $r, --write"; (cd "$X" && node "$G" --write "$f"; echo "exit=$?")
    echo "-- $f after run $r:"; cat "$X/$f"
    if [ "$f" = f7.json ]; then node -e 'try { JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log("JSON.parse: ok"); } catch (e) { console.log("JSON.parse: " + e.message); }' "$X/$f"; fi
  done
done
# (2) F8 with a key the theme makes ambiguous: run 2 reports what run 1 did not.
printf '%s\n' '{ "palette": { "brand": { "blue-main": "#1d4ed8" }, "brand-blue": { "main": "#1e40af" } } }' > "$X/theme.json"
printf '%s\n' '.g { @ds-surface(palette("brand-blue-main")); }' > "$X/amb.css"
for r in 1 2 3; do echo "== amb.css, run $r, --write --theme theme.json"; (cd "$X" && node "$G" --write --theme theme.json amb.css; echo "exit=$?"); done
# (3) Commas inside a nested call, and an alpha: what one --write run leaves, and what a second run changes.
printf '%s\n' '.m { @ds-surface(contained, radius(2, 3), shadow(1)); }' '.p { @ds-surface(contained, palette(primary-main, 0.5)); }' '.q { @ds-surface(contained, palette("primary-main", 0.5)); }' > "$X/nested.css"
for r in 1 2; do echo "== nested.css, run $r, --write"; (cd "$X" && node "$G" --write nested.css; echo "exit=$?"); echo "-- nested.css after run $r:"; cat "$X/nested.css"; done
# (4) What the compiler says about F3's run-1 output, and about the forms the story's runs should reach.
(cd packages/uxdsl && node -e '
const postcss = require("postcss"); const plugin = require("./dist/plugin");
(async () => { for (const css of process.argv.slice(1)) {
  try { await postcss([plugin()]).process(css, { from: "x.css" }); console.log("compiles: " + css); }
  catch (e) { console.log(e.message.replace(/^.*?x\.css:/, "x.css:").split("\n")[0].slice(0, 150)); } } })();
' '.a { @ds-surface(contained radius(2), shadow(1)); }' '.b { @ds-surface contained radius(2); }' '.a { @ds-surface(contained radius(2) shadow(1)); }' '.c { @ds-button(\outlined\ primary); }' '.c { @ds-button(outlined primary); }' '.d { @ds-surface(palette(primary.main)); }')
rm -rf "$X"
```

It exited 0, left `TMPDIR` empty and printed (the summary lines of a
`--write` run end with one space, as the codemod prints them; part (4)
truncates each message at 150 characters):

```text
== f3.css, run 1, preview
~ f3.css
     directive arguments ×1
1 file(s) would change (1 with findings). Run again with --write to apply.
exit=0
== f3.css, run 1, --write
W f3.css
     directive arguments ×1
1 file(s) rewritten (1 with findings). 
exit=0
-- f3.css after run 1:
.a { @ds-surface(contained radius(2), shadow(1)); }
.b { @ds-surface contained radius(2); }
== f3.css, run 2, preview
0 file(s) would change (0 with findings). Run again with --write to apply.
exit=0
== f3.css, run 2, --write
0 file(s) rewritten (0 with findings). 
exit=0
-- f3.css after run 2:
.a { @ds-surface(contained radius(2), shadow(1)); }
.b { @ds-surface contained radius(2); }
== f3.css, run 3, preview
0 file(s) would change (0 with findings). Run again with --write to apply.
exit=0
== f3.css, run 3, --write
0 file(s) rewritten (0 with findings). 
exit=0
-- f3.css after run 3:
.a { @ds-surface(contained radius(2), shadow(1)); }
.b { @ds-surface contained radius(2); }
== f7.json, run 1, preview
~ f7.json
     directive arguments ×1
1 file(s) would change (1 with findings). Run again with --write to apply.
exit=0
== f7.json, run 1, --write
W f7.json
     directive arguments ×1
1 file(s) rewritten (1 with findings). 
exit=0
-- f7.json after run 1:
{"css":".c { @ds-button(\outlined\ primary); }"}
JSON.parse: Bad escaped character in JSON at position 25
== f7.json, run 2, preview
0 file(s) would change (0 with findings). Run again with --write to apply.
exit=0
== f7.json, run 2, --write
0 file(s) rewritten (0 with findings). 
exit=0
-- f7.json after run 2:
{"css":".c { @ds-button(\outlined\ primary); }"}
JSON.parse: Bad escaped character in JSON at position 25
== f7.json, run 3, preview
0 file(s) would change (0 with findings). Run again with --write to apply.
exit=0
== f7.json, run 3, --write
0 file(s) rewritten (0 with findings). 
exit=0
-- f7.json after run 3:
{"css":".c { @ds-button(\outlined\ primary); }"}
JSON.parse: Bad escaped character in JSON at position 25
== f8.css, run 1, preview
~ f8.css
     directive arguments ×2
1 file(s) would change (1 with findings). Run again with --write to apply.
exit=0
== f8.css, run 1, --write
W f8.css
     directive arguments ×2
1 file(s) rewritten (1 with findings). 
exit=0
-- f8.css after run 1:
.d { @ds-surface(palette(primary-main)); }
.e { @ds-button(contained color(gray-300)); }
== f8.css, run 2, preview
~ f8.css
     palette()/color() dashed -> dotted ×2
1 file(s) would change (1 with findings). Run again with --write to apply.
exit=0
== f8.css, run 2, --write
W f8.css
     palette()/color() dashed -> dotted ×2
1 file(s) rewritten (1 with findings). 
exit=0
-- f8.css after run 2:
.d { @ds-surface(palette(primary.main)); }
.e { @ds-button(contained color(gray.300)); }
== f8.css, run 3, preview
0 file(s) would change (0 with findings). Run again with --write to apply.
exit=0
== f8.css, run 3, --write
0 file(s) rewritten (0 with findings). 
exit=0
-- f8.css after run 3:
.d { @ds-surface(palette(primary.main)); }
.e { @ds-button(contained color(gray.300)); }
== rf.css, run 1, preview
~ rf.css
     directive arguments ×1
1 file(s) would change (1 with findings). Run again with --write to apply.
exit=0
== rf.css, run 1, --write
W rf.css
     directive arguments ×1
1 file(s) rewritten (1 with findings). 
exit=0
-- rf.css after run 1:
.f { @ds-surface(contained radius(full)); }
== rf.css, run 2, preview
~ rf.css
     radius(full) -> radius(pill) ×1
1 file(s) would change (1 with findings). Run again with --write to apply.
exit=0
== rf.css, run 2, --write
W rf.css
     radius(full) -> radius(pill) ×1
1 file(s) rewritten (1 with findings). 
exit=0
-- rf.css after run 2:
.f { @ds-surface(contained radius(pill)); }
== rf.css, run 3, preview
0 file(s) would change (0 with findings). Run again with --write to apply.
exit=0
== rf.css, run 3, --write
0 file(s) rewritten (0 with findings). 
exit=0
-- rf.css after run 3:
.f { @ds-surface(contained radius(pill)); }
== amb.css, run 1, --write --theme theme.json
W amb.css
     directive arguments ×1
1 file(s) rewritten (1 with findings). 
exit=0
== amb.css, run 2, --write --theme theme.json
  amb.css
     unresolved: palette(brand-blue-main) (ambiguous: brand.blue-main or brand-blue.main)
0 file(s) rewritten (1 with findings). 
exit=0
== amb.css, run 3, --write --theme theme.json
  amb.css
     unresolved: palette(brand-blue-main) (ambiguous: brand.blue-main or brand-blue.main)
0 file(s) rewritten (1 with findings). 
exit=0
== nested.css, run 1, --write
W nested.css
     palette()/color() dashed -> dotted ×1
     directive arguments ×3
1 file(s) rewritten (1 with findings). 
exit=0
-- nested.css after run 1:
.m { @ds-surface(contained radius(2 3), shadow(1)); }
.p { @ds-surface(contained palette(primary.main 0.5)); }
.q { @ds-surface(contained palette(primary-main 0.5)); }
== nested.css, run 2, --write
0 file(s) rewritten (0 with findings). 
exit=0
-- nested.css after run 2:
.m { @ds-surface(contained radius(2 3), shadow(1)); }
.p { @ds-surface(contained palette(primary.main 0.5)); }
.q { @ds-surface(contained palette(primary-main 0.5)); }
x.css:1:6: UXD_SURFACE_ARGUMENT: Separate the arguments with spaces, not ",". Usage: @ds-surface(role [tone] [size] [radius(k)] [shadow(k)]).
x.css:1:6: UXD_SURFACE_ARGUMENT: Write @ds-surface(contained radius(2)), with the parentheses directly after the name. Usage: @ds-surface(role [tone] 
compiles: .a { @ds-surface(contained radius(2) shadow(1)); }
x.css:1:6: UXD_BUTTON_ARGUMENT: "\outlined\ primary" is not a directive argument. Usage: @ds-button(role [tone] [size] [radius(k)] [shadow(k)]).
compiles: .c { @ds-button(outlined primary); }
x.css:1:6: UXD_SURFACE_ARGUMENT: palette(primary.main) is not a directive argument; a size is a number, and only radius(k) and shadow(k) override a fi
```

What it shows, on BASE:

- **F3.** Run 1 leaves `.a` half done (`radius(2), shadow(1)`) and `.b`
  untouched; runs 2 and 3 change nothing; both lines fail to compile with
  `UXD_SURFACE_ARGUMENT`, and the canonical form compiles.
- **F7.** Run 1 writes `@ds-button(\outlined\ primary)`, which
  `JSON.parse` rejects at position 25, and which the plugin rejects
  (`UXD_BUTTON_ARGUMENT`); later runs leave it.
- **F8.** Run 1 prints only `directive arguments ×2`; run 2 rewrites both
  keys; run 3 changes nothing. With a theme that makes the key ambiguous
  (part (2)), run 1 prints no `unresolved:` line and runs 2 and 3 print one.
- **The same defect for `radius(full)`** (`rf.css`, not named by F8): a
  quoted `radius("full")` inside a directive takes two runs (§15, F9 and Q1).
- **Part (3).** A comma inside a nested call becomes a space
  (`radius(2 3)`, `palette(primary.main 0.5)`), and F3's stop at the first
  `)` leaves `.m`'s `, shadow(1)`. `.q`, a quoted key with an alpha, is
  left dashed for good: once its quotes and comma are gone, the dashed-key
  pattern no longer matches, and run 2 changes nothing (§15, F10).
- **The F8 outputs do not compile either way.** `palette(primary.main)` is
  "not a directive argument" (`UXD_SURFACE_ARGUMENT`). The codemod rewrites
  spellings; whether an argument is valid is the compiler's (§6).

## 5. Contract

The codemod's public entry is its command line,
`node scripts/codemod-canonical-grammar.js [--write] [--theme <file>] <paths…>`,
run as a subprocess. "A directive" is `@ds-surface`, `@ds-button`,
`@ds-input` or `@ds-typo`, in any case, as on BASE. "Its arguments" are the
text between its `(` and the matching `)`, nested parentheses balanced, or,
in the form without parentheses, the text after the name up to `;`, `}` or a
newline, as on BASE, function calls included. Where §15's open questions
leave a choice, the contract assumes the option stated there.

- **C1 — Complete in one run: a second run is a no-op.** For any files and
  any `--theme` (under Q1 (a), except a quoted `radius("full")` or
  `radius('full')` inside a directive, which this contract does not pin),
  once `… --write [--theme <file>] <paths…>` has run, the same command run
  again:
  - writes no file: every file's bytes and modification time are unchanged;
  - exits 0, and prints only its summary line, starting
    `0 file(s) rewritten`, plus, under a `  <file>` header, exactly the first
    run's `unresolved:` lines, in the same order (none when the first run
    printed none);
  - run without `--write`, exits 0 and its summary line starts
    `0 file(s) would change`.

  This is MIG-B9-29's C1 for any files: §14 of that story names F8 as its
  one exception, and this story removes it (and, under Q1 (b), the quoted
  `radius("full")`). C1 holds in every file type the codemod walks.
- **C2 — A quoted `palette()`/`color()` argument (F8).** The dashed-key
  rewrite, with its theme rule (an unambiguous split rewritten, an ambiguous
  one reported as `unresolved:`, a dashed family left), applies to a
  directive's arguments as the directive rewrite leaves them, quotes
  removed, in the same run. With no `--theme`:
  - `.d { @ds-surface(palette("primary-main")); }` →
    `.d { @ds-surface(palette(primary.main)); }`;
  - `.e { @ds-button(contained, color('gray-300')); }` →
    `.e { @ds-button(contained color(gray.300)); }`;
  - the file's run-1 report holds `palette()/color() dashed -> dotted ×2`;
  - `.q { @ds-surface(contained, palette("primary-main", 0.5)); }` →
    `.q { @ds-surface(contained palette(primary.main 0.5)); }` under Q2 (a)
    (under (b): `palette(primary.main, 0.5)`).

  With §4's ambiguous theme, `.g { @ds-surface(palette("brand-blue-main")); }`
  becomes `.g { @ds-surface(palette(brand-blue-main)); }`, and run 1 prints
  `unresolved: palette(brand-blue-main) (ambiguous: brand.blue-main or brand-blue.main)`,
  as runs 2 and 3 do.
- **C3 — Function arguments (F3).** A directive's arguments are read to the
  matching `)`, so a function argument no longer ends them:
  - `.a { @ds-surface(contained, radius(2), shadow(1)); }` →
    `.a { @ds-surface(contained radius(2) shadow(1)); }`;
  - `.c { @ds-surface (contained, radius(2), shadow(1)); }` →
    `.c { @ds-surface(contained radius(2) shadow(1)); }`;
  - the arguments may span lines: `@ds-surface(\n  contained,\n  radius(2),\n  shadow(1)\n)`
    → `@ds-surface(contained radius(2) shadow(1))`;
  - under §15's Q5 (b) only, the form without parentheses takes a function
    argument on its line:
    `.b { @ds-surface contained radius(2); }` →
    `.b { @ds-surface(contained radius(2)); }`, and
    `.b2 { @ds-surface contained, radius(2), shadow(1); }` →
    `.b2 { @ds-surface(contained radius(2) shadow(1)); }`. Under Q5 (a),
    which the contract assumes until the owner answers, `.b` and `.b2` keep
    BASE's bytes (C5);
  - a comma inside a nested call follows Q2 (a), BASE's rule: it becomes a
    space (`radius(2, 3)` → `radius(2 3)`). Under Q2 (b) it is kept.

  Each run-1 output above that holds only a role, a tone, a size,
  `radius(k)` and `shadow(k)` compiles through `uxdsl/postcss` (§4, part 4,
  for `.a`'s).
- **C4 — An escaped quote (F7)** (Q3 (a)). In a directive's arguments, an
  escaped quote, `\"` or `\'`, is removed together with its backslash, like a
  plain quote. No other backslash is removed or added, so every other escape
  sequence in the file is left byte for byte. So:
  - `{"css":".c { @ds-button(\"outlined\", primary); }"}` →
    `{"css":".c { @ds-button(outlined primary); }"}`;
  - `JSON.parse` reads the result, and its string equals what the same run
    writes for `.c { @ds-button("outlined", primary); }` in a `.css` file;
  - the same holds for `\'` in a JavaScript string;
  - a JSON file that `JSON.parse` read before run 1 still reads after it.
- **C5 — Nothing else changes**, against BASE:
  - a directive whose arguments hold no quote, no backslash and no `(` gives
    BASE's bytes and BASE's printed lines (BASE's three lax-form rewrites, its
    comma and whitespace rule, and its `${…}`/`#{…}` guard);
  - every other rewrite and report gives BASE's files and BASE's printed
    lines for every input outside a directive's arguments: `rounded()`,
    `elevation()`, `radius(full)`, dashed `palette()`/`color()`, the
    typography rewrite of MIG-B9-29 (its C2 to C4, decisions 23 and 33) and
    `densities(…)`;
  - the printed labels are BASE's, in BASE's order:
    - `rounded() -> radius()`, `elevation() -> shadow()`,
      `radius(full) -> radius(pill)`;
    - `palette()/color() dashed -> dotted`, then its `unresolved:` lines;
    - `directive arguments`;
    - `typography variable suffixes`, then its `unresolved:` lines;
    - the `densities(…)` line.

    Each count label appears at most once per file. Its count `×n` is not
    pinned for a directive in C2 to C4's class; for every other input it is
    BASE's;
  - the command line is BASE's, MIG-B9-29's C6 included: its arguments, the
    usage line on stderr, the exit codes (0 after a run, 2 for the usage
    line), the extensions walked, `SKIP_DIRS`, how `--theme` is loaded, and
    the walk;
  - the script keeps its shape: no exports, listed in
    `packages/uxdsl/package.json`'s `files`, as `test/entries.test.js` line
    50 pins;
  - MIG-B9-29's seven tests pass, unedited except the comment at lines
    112–113 (§11).
- **C6 — Under §15's Q1 (b) only: a quoted `radius("full")`.** Every token
  rewrite the codemod makes applies to a directive's arguments after the
  quotes are removed, in the same run:
  `.f { @ds-surface(contained radius("full")); }` →
  `.f { @ds-surface(contained radius(pill)); }`, and run 1's report holds
  `radius(full) -> radius(pill) ×1`. C1's exception is then void: a second
  run is a no-op for any files.

Must stay byte-identical with BASE:

- every compiled output: nothing under `packages/uxdsl/src` changes, so
  `fixtures/parity/expected/**`, the playground's `src/app/uxdsl.css` and
  the captures stay as they are;
- the codemod's first-run files on the repository's own sources (§12's
  guard, part (1)), outside lines that hold `@ds-`; on `5a041fc` none of
  them holds a directive in C2 to C4's class, so a prototype gave 0
  differing lines in all;
- the generated set of §12's guard, part (2): directives whose arguments
  hold no quote, no backslash and no `(`, in the three lax forms, and one
  declaration for each other rewrite and report: files and printed output;
- `packages/uxdsl/scripts/codemod-namespace.js` and
  `codemod-size-overrides.js`, unedited;
- `packages/uxdsl/test/entries.test.js`, `typography-variable-names.test.js`,
  `namespace-migration.test.js` and `codemod-size-overrides.test.js`,
  unedited;
- `DIAGNOSTIC_CATALOG`: no code added. The codemod prints reports, not
  diagnostics, so this story is not on README §7's `diagnostics.ts` row.

## 6. Out of scope

- **Whether a rewritten argument is valid.** `palette()`, `color()` and a
  two-argument `radius(2 3)` are not directive arguments; the compiler
  reports them (`UXD_SURFACE_ARGUMENT`, `UXD_BUTTON_ARGUMENT`). The codemod
  rewrites spellings, not meaning. No destination.
- **The release notes' second codemod instruction**
  (`docs/releases/0.5.0-beta.9.md`, lines 167–168; the first instruction,
  lines 158–160, stays): MIG-B9-91, by decision 37 of 2026-11-10.
- **The README's and CHANGELOG's existing claims** (decision 35): they stay
  as written. This story makes them true (§11), and does not reword them.
- **A directive that holds `${…}` or `#{…}`**: BASE's bytes (C5), including
  the half rewrite §15's F11 records. No destination is proposed; §15 says
  why.
- **The form without parentheses followed by `{`** (`@ds-surface contained {`,
  with or without a function argument) and **a form without parentheses that
  starts with a quote** (`@ds-surface "contained" radius(2);`): BASE leaves
  both, and a second run leaves them too. Stable, not in F3. No destination.
- **An unclosed directive parenthesis** (§15, F13): BASE's behavior, outside
  the directive arguments C2 to C4 define. No destination is proposed.
- **A requireable codemod** (MIG-B9-60, wave 6, beta.10): exports stay
  absent (C5).
- **The README's list of skipped directories** (MIG-B9-29 §15, F4):
  MIG-B9-50.

## 7. Approach and traps

Non-normative.

- **The shape of the fix: directives first, then the token rewrites.** A
  pre-pass, before `rounded()`, does three things:
  - it turns the forms with a space before the parentheses, and without
    parentheses, into `@ds-x(…)`, with a balanced argument pattern;
  - it removes the quotes of each argument list, an escaped quote with its
    backslash (`/\\?["']/g`);
  - it leaves the `${…}`/`#{…}` guard as it is.

  The token rewrites then see the arguments unquoted (C2, and C6 under
  Q1 (b)). The existing directive pass, with the same balanced pattern, then
  joins the commas and collapses whitespace. Keep one count: a pre-pass step
  that changes a directive must still be counted under
  `directive arguments`, and the label must print once, in BASE's place.
- **Balanced arguments in a regular expression.** Two levels of nesting
  cover every argument the grammar has (`shadow(calc((1)))` included). Keep
  `;`, `{` and `}` out of the balanced pattern, so an unclosed `(` cannot
  swallow a following rule: a prototype that allowed them joined the next
  declaration into the directive. Keep BASE's `[^)]*` pattern as the
  fallback after the balanced one, so C5's inputs are unchanged.
- **Under Q1 (a)**, the narrow reading, the dashed-key rewrite alone is
  re-applied to directive arguments after the quotes are removed. Apply it
  before the commas are joined: on BASE, `palette(primary-main 0.5)` (the
  comma already gone) no longer matches the dashed-key pattern (§4, `.q`).
- **A prototype, measured on `5a041fc`.** A copy of the codemod in a
  scratch directory, never in the worktree, had the pre-pass above under
  Q1 (b) and Q2 (a): 28 lines added and 6 removed. It gave:
  - §4's reproduction: every file of part (1) final after run 1, with runs 2
    and 3 printing `0 file(s) rewritten (0 with findings).`. `f7.json`
    parses after run 1 (`{"css":".c { @ds-button(outlined primary); }"}`).
    `amb.css` prints its `unresolved:` line in all three runs.
    `nested.css` is final after run 1, `.q` included;
  - MIG-B9-29's seven tests, 7 of 7, on a copy of the package;
  - §12's guard: the corpus has 217 files, and 0 lines differ from BASE's
    first run; the control shows 18 lines outside `@ds-`; the generated
    set (7,065 lines) is identical to BASE. A mutant without the whitespace
    collapse made the generated set differ, and the guard exited 1;
  - a fuzz of 57,132 directive lines: four names, three forms, 23 arguments,
    three separators, three ends. Arguments were plain, quoted, escaped,
    functions and an ambiguous key. A second run changed nothing, plain or
    escaped. BASE changes 10,080 of them on a second run (4,032
    `radius(full)`, 4,032 dashed keys, 2,016 reports only);
  - 173,056 inputs compared with BASE's first run. 95,712 were identical.
    Every difference had a quote (41,568) or a function call (35,776) in
    the directive's arguments; none differed otherwise;
  - 200,000 random fragment sequences: a second run changed none;
  - 10,368 directive lines in a `.css`, `.uxdsl`, `.scss`, `.md`, `.tsx` and
    `.json` file, run twice with `--write`. Run 2 changed no file, and both
    runs printed the same 9,360 `unresolved:` lines. The `.json` parsed, and
    its strings equalled the `.css`. BASE's run 2 changed all six files,
    and its `unresolved:` lines went from 0 to 4,080.

  That run took 285 ms for the prototype and 153 ms for BASE, on a shared
  machine (load average about 5): indicative only.
- **Tests run the script as a subprocess**, as MIG-B9-29's do, with the
  same helpers (`tmp`, `run`, `block`, `snapshot`, `assertUnchanged`), from
  a temporary directory each test removes (`t.after`, prefix
  `uxdsl-grammar-codemod-`). No shell tools: MIG-B9-28 runs this file on
  Windows. If MIG-B9-25 is merged when this story starts, its guard also
  runs this file, which must leave `TMPDIR` empty; use its helper
  (`packages/uxdsl/test/helpers/temporary-directory.js`) if it exists.
- **Comments describe behavior.** The header (lines 4–48) says how a
  directive's arguments are read, and that a quote, an escaped one with its
  backslash, is removed before the token rewrites. No story id goes in it,
  nor in the test file's comments.
- Stop rule: if no rule makes F3, F7 and F8 final in one run while every
  input of C5's first item keeps BASE's bytes, stop and set the story to
  Blocked. Record the input in §15. Never weaken a MIG-B9-29 test, or drop
  a family's rewrite, to get there.

## 8. Tests

All in `packages/uxdsl/test/codemod-canonical-grammar.test.js`, appended
after MIG-B9-29's tests.

| Id | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- |
| T1 | `MIG-B9-18: a quoted palette() or color() argument in a directive is rewritten in the first run` | unit (the script as a subprocess) | C2, C1 | C2's inputs (`.d`, `.e`, `.q`, and `.g` with an ambiguous `--theme`) give C2's exact files and run-1 lines; the second run prints only the summary and `.g`'s `unresolved:` line. BASE fails it: its run 1 leaves `palette(primary-main)`, and its run 1 prints no `unresolved:` line for `.g` |
| T2 | `MIG-B9-18: a directive's function arguments are rewritten in one run, with or without parentheses` (under Q5 (a): `MIG-B9-18: a directive's function arguments in parentheses are rewritten in one run`) | unit | C3, C1 | C3's inputs, the multi-line one included (six under Q5 (b); four under Q5 (a), with `.b` and `.b2` asserted at BASE's bytes), give C3's exact files; a second run is a no-op. BASE fails it: `.a` keeps `, shadow(1)` (and, under Q5 (b), `.b` and `.b2` are left) |
| T3 | `MIG-B9-18: an escaped quote in a JSON or JavaScript string is removed with its backslash, and the string stays valid` | unit | C4, C1 | F7's `.json` and a `.js` file holding `'.c { @ds-button(\'outlined\', primary); }'`: `JSON.parse` reads the result, and its string equals the `.css` result; the `.js` file is the expected text. A planted `\n` in the same JSON string stays. BASE fails it: `JSON.parse` throws `Bad escaped character` |
| T4 | `MIG-B9-18: a second --write run changes no file, for directive arguments with quotes, escapes and function calls, in every file type the codemod walks` | unit | C1 | A generated set: the four directive names, three forms and the arguments of C2 to C4, in each of the ten extensions. The first run must change every file (a codemod that does nothing fails). The second run must leave bytes and mtimes, print only the summary, and repeat the first run's `unresolved:` lines. BASE fails it: its second run rewrites every file and prints `unresolved:` lines its first did not |
| T5 | `MIG-B9-18: a directive whose arguments hold no quote and no function call is rewritten as before (negative control)` | unit | C5 | A table of BASE's own outputs, measured on `5a041fc` (§4 of this file, and the table below). Every line gives exactly BASE's text, and the file's report is BASE's seven lines. A fix that rewrites more than its class fails it, for example one that drops the whitespace collapse, joins `@ds-typo h1 {`, or touches the `${r}` and `#{$r}` lines |
| T6 | under Q1 (b) only: `MIG-B9-18: a quoted radius("full") in a directive becomes radius(pill) in the first run` | unit | C6, C1 | `.f { @ds-surface(contained radius("full")); }` gives `radius(pill)` and `radius(full) -> radius(pill) ×1` in run 1; run 2 is a no-op. BASE fails it (§4, `rf.css`) |
| T7 | MIG-B9-29's seven `MIG-B9-29:` tests, and `entries.test.js`, `typography-variable-names.test.js`, `namespace-migration.test.js`, `codemod-size-overrides.test.js` | as they are | unit | C5 | An invariant guard. AC4 checks that the four files are unedited, and that this file's removed lines are only the comment at lines 112–113 |
| T8 | §12's guard (run by hand, recorded in §14) | fixture | C5 | The guard has an encoded control: BASE with its dashed-key rewrite turned off must differ on lines outside `@ds-` (18 on `5a041fc`), and on the generated set |

T5's table, BASE's first run on `5a041fc` (one file, input → output):

| Input | Output |
| --- | --- |
| `.a { @ds-surface (contained, primary); }` | `.a { @ds-surface(contained primary); }` |
| `.b { @ds-button outlined, primary; }` | `.b { @ds-button(outlined primary); }` |
| `.c { @ds-input(outlined,  primary) }` | `.c { @ds-input(outlined primary) }` |
| `.d { @ds-typo h1 {` | `.d { @ds-typo h1 {` |
| `.e { @DS-SURFACE contained }` | `.e { @ds-surface(contained)}` |
| `.f { @ds-surface(contained, ${r}); }` | `.f { @ds-surface(contained, ${r}); }` |
| `.g { @ds-surface(contained, #{$r}); }` | `.g { @ds-surface(contained, #{$r}); }` |
| `.h { @ds-surface(contained,primary,2); }` | `.h { @ds-surface(contained primary 2); }` |
| `.i { a: rounded(2); b: elevation(1); c: radius(full); d: palette(primary-main, 0.5); e: color(gray-300); f: densities(2); }` | `.i { a: radius(2); b: shadow(1); c: radius(pill); d: palette(primary.main, 0.5); e: color(gray.300); f: densities(2); }` |

Report: `W g.css`, then `rounded() -> radius() ×1`, `elevation() -> shadow() ×1`,
`radius(full) -> radius(pill) ×1`, `palette()/color() dashed -> dotted ×2`,
`directive arguments ×7`,
`unresolved: densities(…) ×1: define a Density token in the theme and use density(k)`,
then `1 file(s) rewritten (1 with findings).`. The prototype of §7 gave the
same file and lines.

T1 to T4 (and T6 under Q1 (b)) are the failing-first tests (README §2): each
fails on BASE as its control says and passes after the change. T5 and T7
state what the change must keep; they pass on BASE by design, and their
mutations show they can fail.

## 9. Acceptance criteria

BASE below is `git merge-base HEAD origin/feat/beta9`.

- **AC1** `TMPDIR=<an empty scratch directory> node --test packages/uxdsl/test/codemod-canonical-grammar.test.js`
  exits 0, with MIG-B9-29's seven tests and T1 to T5 run (T6 too under
  Q1 (b)), none skipped, and leaves that directory empty.
  - Test file: `packages/uxdsl/test/codemod-canonical-grammar.test.js`.
  - Mutations, each failing the tests named:
    - BASE's directive rewrite in place of the head's fails T1 to T4 (and
      T6);
    - the dashed-key rewrite left before the quotes are removed fails T1;
    - BASE's `[^)]*` argument scan fails T2;
    - quotes removed one character at a time (`/["']/g`) fails T3;
    - a run that stops collapsing whitespace, or joins the form without
      parentheses before `{`, fails T5;
    - under Q1 (b), `radius(full)` left before the quotes are removed fails
      T6.
- **AC2** §4's reproduction, run on the head through `bash`, exits 0, and:
  - part (1): after run 1, `f3.css` holds
    `.a { @ds-surface(contained radius(2) shadow(1)); }` and, under Q5 (b),
    `.b { @ds-surface(contained radius(2)); }` (under Q5 (a), `.b` as §4
    records it); `f7.json` holds
    `{"css":".c { @ds-button(outlined primary); }"}` and prints
    `JSON.parse: ok`; `f8.css` holds `palette(primary.main)` and
    `color(gray.300)`, and its run 1 prints
    `palette()/color() dashed -> dotted ×2`. Runs 2 and 3 of each print
    `0 file(s) would change (0 with findings).` and
    `0 file(s) rewritten (0 with findings).`. `rf.css` is as §4 records
    under Q1 (a), and final after run 1 under Q1 (b);
  - part (2): all three runs print the `unresolved:` line;
  - part (3): after run 1, `.m` is `@ds-surface(contained radius(2 3) shadow(1))`
    and `.q` is `@ds-surface(contained palette(primary.main 0.5))` (under
    Q2 (b): `radius(2, 3)` and `palette(primary.main, 0.5)`), and run 2
    prints `0 file(s) rewritten (0 with findings).`;
  - part (4): as §4 records (the compiler is unchanged).
  - Test file: none (the reproduction of §4).
  - Mutation: BASE's script prints §4's recorded output.
- **AC3** §12's guard exits 0: 0 differing lines outside `@ds-` on the
  corpus, the generated set identical to BASE's, and both controls
  different.
  - Test file: none (§12's block, recorded in §14).
  - Mutation: the encoded control; a head without the whitespace collapse
    makes the generated set differ (measured: exit 1).
- **AC4** `node --test packages/uxdsl/test/entries.test.js packages/uxdsl/test/typography-variable-names.test.js packages/uxdsl/test/namespace-migration.test.js packages/uxdsl/test/codemod-size-overrides.test.js`
  exits 0. Two invariant checks also exit 0, from the worktree root, through
  `bash`:
  - `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/src packages/uxdsl/scripts/codemod-namespace.js packages/uxdsl/scripts/codemod-size-overrides.js packages/uxdsl/test/entries.test.js packages/uxdsl/test/typography-variable-names.test.js packages/uxdsl/test/namespace-migration.test.js packages/uxdsl/test/codemod-size-overrides.test.js`;
  - `test "$(git diff -U0 "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/test/codemod-canonical-grammar.test.js | grep '^-[^-]' | grep -vc '^-      //')" = 0`
    (every removed line of the test file is a comment line).
  - Test files: the four named, and this story's test file.
  - Mutation: none; an invariant guard, like C5. Editing a MIG-B9-29 test
    body fails the second check.
- **AC5** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk`
  exits 0; `npm run verify:playground-browser` exits 0.
  - Test files: the suites `npm test` runs, which include AC1's file
    (`node --test test/*.test.js` in `packages/uxdsl`), and
    `fixtures/release-1.0/run.js`.
  - Mutation: AC1's, which `npm test` runs. The two gates are invariant
    guards: the tarball still ships the script, and nothing the playground
    renders changes.

Owner checks, never marked PASS by the agent:

- Answer §15's Q1 to Q5 before the story starts. Until then the contract
  assumes Q1 (a), Q2 (a), Q3 (a) and Q5 (a), and the story waits for
  MIG-B9-21 (Q4 (b)).

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: one subsection under `## 0.5.0-beta.9 — unreleased`, with `### Visual changes`: none. The docs guard does not demand it, because the codemod is not in `VISUAL_DEFAULT_FILES`. The shipped script's output changes, though |
| package README | yes: the docs guard counts `scripts/` and `test/` as package code and demands a README change in the same commit (MIG-B9-29 §15: it refused a test-only commit); one sentence (§11) |
| `verify-docs-update.js` classification | no (no file added or deleted under `packages/uxdsl/src`) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no: lines 44–45 stay true |
| `DIAGNOSTIC_CATALOG` | no (C5) |
| `npm run generate:capabilities` | no (a script is not a capability source) |
| playground `uxdsl:build` + captures | no (no engine or CLI change) |
| `migration.md` | no (it does not name the codemod; MIG-B9-52 owns its restructuring) |
| `docs/releases/0.5.0-beta.9.md` | no (decision 37: MIG-B9-91) |

## 11. Documentation

- `packages/uxdsl/scripts/codemod-canonical-grammar.js`: the header comment.
  - Lines 11–12, the directive line, gain the function-argument form.
  - A sentence after line 45 says three things: a directive's arguments are
    read to the matching parenthesis; their quotes are removed first, an
    escaped quote with its backslash; and the dashed Palette/Color split
    (under Q1 (b), every token rewrite) then applies to them.
- `packages/uxdsl/test/codemod-canonical-grammar.test.js`, lines 112–113.
  The comment says why the `.json` fixture uses single quotes, without
  claiming the rewrite cannot handle an escaped quote. For example: "The
  quoted form uses single quotes, so the expected JSON is the same text as
  the other files." The code on line 114 stays.
- `packages/uxdsl/README.md`, "Codemod: `scripts/codemod-canonical-grammar.js`"
  (lines 783–805): one sentence, appended after the sentence that ends "is
  left and reported, once per occurrence." (line 803). The existing wording
  stays (decision 35). It says three things:
  - a directive's arguments are rewritten in one run, a function argument
    (`radius(2)`) and a quoted `palette()`/`color()` argument included;
  - an escaped quote inside a JSON or JavaScript string is removed with its
    backslash, so the string stays valid;
  - under Q1 (b), "a quoted `radius("full")`" joins the list.
- `packages/uxdsl/CHANGELOG.md`: one subsection at the top of
  `## 0.5.0-beta.9 — unreleased`, above the newest one there, titled after
  the change and ending `(MIG-B9-18)`, for example "The canonical-grammar
  codemod rewrites a directive's arguments in one run (MIG-B9-18)". It says
  that, before:
  - `@ds-surface(contained, radius(2), shadow(1))` was left half done, and
    `@ds-surface contained radius(2);` not rewritten;
  - `@ds-surface(palette("primary-main"))` took two runs;
  - a JSON string holding `@ds-button(\"outlined\")` was left invalid.

  It says that all are now complete in one run, so a second run changes
  nothing for them too. It ends with `### Visual changes`: none.
- Not edited: `AGENTS.md`, `migration.md`, `docs/releases/0.5.0-beta.9.md`,
  and MIG-B9-29's README and CHANGELOG sentences.

**Do the shipped claims become true?** The README's "so a second run changes
nothing" (line 801) and the CHANGELOG's "Running the codemod again now
changes nothing." (lines 196–197) stay as decision 35 says.
- Under Q1 (b): after this story, a second run changes nothing for every
  input the tests, the fuzz and the corpus of §7 cover, F8 included. Both
  claims hold when beta.9 ships, as decision 35 intends, and MIG-B9-29's C1
  holds "for any files".
- Under Q1 (a): a quoted `radius("full")` inside a directive still takes two
  runs, so both claims stay broader than the code for that one input, and
  so does MIG-B9-29's C1.

## 12. Verification

```bash
TMPDIR=<empty dir> node --test packages/uxdsl/test/codemod-canonical-grammar.test.js   # exit 0; 7 MIG-B9-29 tests + T1–T5 (T6 under Q1 (b)); <empty dir> stays empty
TMPDIR=<empty dir> bash <§4's reproduction>                                            # exit 0; AC2's lines
TMPDIR=<empty dir> bash <the guard below>                                              # exit 0; AC3
node --test packages/uxdsl/test/entries.test.js packages/uxdsl/test/typography-variable-names.test.js packages/uxdsl/test/namespace-migration.test.js packages/uxdsl/test/codemod-size-overrides.test.js   # exit 0
git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/src packages/uxdsl/scripts/codemod-namespace.js packages/uxdsl/scripts/codemod-size-overrides.js packages/uxdsl/test/entries.test.js packages/uxdsl/test/typography-variable-names.test.js packages/uxdsl/test/namespace-migration.test.js packages/uxdsl/test/codemod-size-overrides.test.js   # exit 0
test "$(git diff -U0 "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/test/codemod-canonical-grammar.test.js | grep '^-[^-]' | grep -vc '^-      //')" = 0   # exit 0
npm test                                       # background, with a log; exit 0
npm run verify:1.0 -- --skip-playground-walk   # background, with a log; exit 0
npm run verify:playground-browser              # background, with a log; exit 0 (Chrome)
```

T8, the guard against BASE (AC3), from the worktree root, through `bash`,
with `TMPDIR` set to an empty scratch directory (no `rsync`: `git archive`):

```bash
H="${H:-$PWD/packages/uxdsl/scripts/codemod-canonical-grammar.js}"
T="$PWD/packages/playground-nextjs/uxdsl.theme.cjs"
B="${B:-$(git merge-base HEAD origin/feat/beta9)}"
X="$(mktemp -d "${TMPDIR:?}/mig-b9-18-guard.XXXXXX")"
mkdir -p "$X/base/scripts" "$X/off/scripts"
ln -s "$PWD/packages/uxdsl/dist" "$X/base/dist" && ln -s "$PWD/packages/uxdsl/dist" "$X/off/dist"
git show "$B:packages/uxdsl/scripts/codemod-canonical-grammar.js" > "$X/base/scripts/codemod.js"
# The encoded control: BASE with its dashed palette()/color() rewrite turned off.
sed 's/if (!result) return match;/return match;/' "$X/base/scripts/codemod.js" > "$X/off/scripts/codemod.js"
# (1) The repository's own sources, as the head tracks them.
L="packages/playground-nextjs/src fixtures/parity fixtures/mig07-consumer fixtures/mig02-nextjs-cssmodules packages/uxdsl/docs packages/uxdsl/README.md packages/uxdsl/CHANGELOG.md AGENTS.md packages/uxdsl/src/theme/base.json"
for d in base head off; do mkdir "$X/$d-run" && git archive HEAD $L | tar -x -C "$X/$d-run"; done
(cd "$X/base-run" && node "$X/base/scripts/codemod.js" --write --theme "$T" . > ../base.1)
(cd "$X/head-run" && node "$H" --write --theme "$T" . > ../head.1)
(cd "$X/off-run" && node "$X/off/scripts/codemod.js" --write --theme "$T" . > /dev/null)
all() { (cd "$X" && diff -r base-run "$1" | grep -c '^[<>]'); }
other() { (cd "$X" && diff -r base-run "$1" | grep '^[<>]' | grep -vc '@ds-'); }
head_other="$(other head-run)"; off_other="$(other off-run)"
echo "corpus: $(cd "$X/base-run" && find . -type f | wc -l | tr -d ' ') files; lines that differ, head vs BASE: $(all head-run), outside @ds- lines: $head_other; control vs BASE, outside @ds- lines: $off_other"
# (2) Directives whose arguments hold no quote, no backslash and no parenthesis, in the
# three lax forms, and one declaration for each other rewrite and report.
node -e '
const names = ["ds-surface", "ds-button", "DS-INPUT", "ds-typo"];
const args = ["contained", "primary", "2", "outlined", "#{$r}", "${r}", "--uxdsl__typography__h1-size"];
const forms = [(n, a) => `@${n}(${a})`, (n, a) => `@${n} (${a})`, (n, a) => `@${n} ${a}`];
const lines = [];
for (const n of names) for (const f of forms) for (const a of args) for (const b of args)
  for (const s of [", ", " ", ",", "  "]) for (const t of [";", " }", " {"]) lines.push(`.x { ${f(n, a + s + b)}${t}`);
for (const d of ["rounded(2)", "elevation(1)", "radius(full)", "palette(primary-main, 0.5)", "color(gray-300)", "palette(brand-blue-main)", "densities(2)", "var(--uxdsl__typography__h1-size)", "var(--uxdsl__typography__body-text-transform)"])
  lines.push(`.y { a: ${d}; }`);
require("fs").writeFileSync(process.argv[1], lines.join("\n") + "\n");
' "$X/same.css"
printf '%s\n' '{ "palette": { "brand": { "blue-main": "#1d4ed8" }, "brand-blue": { "main": "#1e40af" } }, "typography_details": { "body-text": { "textTransform": "uppercase" } } }' > "$X/theme.json"
for d in base head off; do mkdir "$X/$d-same" && cp "$X/same.css" "$X/$d-same/"; done
(cd "$X/base-same" && node "$X/base/scripts/codemod.js" --write --theme ../theme.json same.css > ../base.2)
(cd "$X/head-same" && node "$H" --write --theme ../theme.json same.css > ../head.2)
(cd "$X/off-same" && node "$X/off/scripts/codemod.js" --write --theme ../theme.json same.css > ../off.2)
same() { cmp -s "$X/base-same/same.css" "$X/$1-same/same.css" && cmp -s "$X/base.2" "$X/$1.2"; }
same head; h=$?; same off; o=$?
echo "generated set: $(wc -l < "$X/same.css" | tr -d ' ') lines; head vs BASE: $([ $h = 0 ] && echo identical || echo different); control vs BASE: $([ $o = 0 ] && echo identical || echo different)"
rm -rf "$X"
test "$head_other" = 0 && test "$off_other" -gt 0 && test $h = 0 && test $o != 0
```

On `5a041fc`, where the head is BASE, it printed
`corpus: 217 files; lines that differ, head vs BASE: 0, outside @ds- lines: 0; control vs BASE, outside @ds- lines: 18`
and `generated set: 7065 lines; head vs BASE: identical; control vs BASE: different`,
and exited 0. With the §7 prototype as `H`, it printed the same and exited
0. With a mutant of the prototype that stops collapsing whitespace, it
printed `generated set: 7065 lines; head vs BASE: different; control vs BASE: different`
and exited 1. The corpus is the head's tracked files, so this story's own
README and CHANGELOG examples are in it, and a directive among them may
differ from BASE's run. The guard counts only lines outside `@ds-`, and
§14 records the total.

## 13. Delivery

Delivered by the light flow for an S story (decision D1 of 2026-11-04): a
scout, one implementer, one review and the deliverer.

Branch `feat/b9-18-codemod-directive-arguments`. Commit:
`fix(FEAT-010): MIG-B9-18 - the canonical-grammar codemod rewrites a directive's arguments in one run`.

PR title: `FEAT-010: MIG-B9-18 - the codemod's directive-argument rewrite is complete in one run`.
The body:

- **Goal:** §1, in two sentences.
- **Owner answers:** Q1 to Q5 as answered, and what each changed in §5.
- **C1 to C4:** AC2's output (§4's reproduction on the head), next to
  BASE's; T1 to T4 (and T6).
- **C5:** T5, the guard's counts against BASE's SHA, and AC4's two checks.
- **Claims:** whether MIG-B9-29's C1 now holds "for any files", and the
  README and CHANGELOG claims of decision 35 (§11).
- **Gates:** `npm test`, `verify:1.0 -- --skip-playground-walk`,
  `verify:playground-browser`, with exit codes.
- **Not run, or not a pass:** anything §14 lists so.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

Found while writing this story, on `a00fbbe` (2026-11-10) and `5a041fc`
(2026-11-13). The codemod and its test file are the same on both. None is
fixed here, except as §5 says.

- **F9 — A quoted `radius("full")` inside a directive takes two runs, like
  F8.** Pre-existing on BASE. The `radius(full)` rewrite runs before the
  directive rewrite removes the quotes. `.f { @ds-surface(contained radius("full")); }`
  becomes `radius(full)` in run 1 and `radius(pill)` in run 2 (§4, `rf.css`).
  F8 does not name it, and neither does decision 36. Decision 35's stated
  outcome, "the claim holds when beta.9 ships", needs it. Proposed: Q1.
- **F10 — A quoted key with an alpha is never completed.**
  `@ds-surface(contained, palette("primary-main", 0.5))` becomes
  `palette(primary-main 0.5)` in run 1, and no later run rewrites it (§4,
  `.q`). It is stable, so it is not an idempotency defect. It is F8's input
  with an alpha, and C2 covers it.
- **F11 — An argument list that holds `${…}` or `#{…}` after a function call
  is half rewritten.** On BASE, `.h { @ds-surface(contained, radius(2), ${r}); }`
  becomes `@ds-surface(contained radius(2), ${r})`. The guard reads only up
  to the first `)`, which holds no `${`. A second run leaves it, and the
  prototype of §7 gives the same. The header says interpolated arguments are
  "code, not arguments", and C5 keeps BASE's bytes. No story is proposed: a
  Sass or template-literal directive is outside what the codemod rewrites.
  The owner may want it noted for MIG-B9-60.
- **F12 — Who else edits the codemod.** Nothing in README §5 or §7 does.
  MIG-B9-60 (`uxdsl doctor`, wave 6, `0.5.0-beta.10`) plans to require "the
  codemods … as modules, not spawned" (its §7). That would add exports to
  this file, which MIG-B9-29 §6 left as "its choice". MIG-B9-60's Owns and
  Shares do not list the file. If its story file comes to list it, README
  §7 gains the row `packages/uxdsl/scripts/codemod-canonical-grammar.js |
  18, 60`. MIG-B9-60 comes later in §5, so it waits for this story. Not a
  new row now: §7 adds a row only where two unmerged stories edit the same
  file.
- **F13 — An unclosed directive parenthesis joins the next lines.** On
  BASE, `.a { @ds-surface(contained\n  background: palette("primary-main");\n}`
  becomes `.a { @ds-surface(contained background: palette(primary-main);`.
  The `[^)]*` scan runs to the next `)`, anywhere, and removes the quotes and
  newlines of the following declaration. A second run on BASE then rewrites
  the key. The input is malformed: the compiler rejects it either way. The
  prototype's balanced pattern stops at `;`, `{` and `}`, and C5 keeps BASE's
  `[^)]*` as the fallback, so this survives. No story is proposed.
- **F14 — README §5 has no row for MIG-B9-18 on `5a041fc`.** FEAT-010 §2
  (line 391) says "The index registers MIG-B9-18 in wave 3 (decision 36)".
  The index on `5a041fc` has no such row, and §7 does not name 18. The row
  this file implies: `| MIG-B9-18 | [The codemod's directive-argument
  rewrite is complete in one run](MIG-B9-18-codemod-directive-arguments.md) |
  3 | — | S | 29 | Ready |`. Proposed: the index's owner, in the PR that
  adds this file. This file does not edit the index.

### Open questions for the owner (answer before implementing)

Under the owner's standing instruction of 2026-11-10 (FEAT-010 §2, the
lead-in to decisions 33 to 37), each question below is answered with its
recommended option unless the owner overrides it. The contract assumes the
recommended option for Q2 and Q3. For Q1 and Q5 it assumes the narrower
option, because the recommendation widens decision 36's wording, and for Q4
it assumes the index's rule as written. Answered as recommended, they change
this file as follows: Q1 (b) adds C6 and T6 and removes C1's one exception;
Q5 (b) makes C3's form without parentheses, T2's `.b` and `.b2` cases and
AC2's `.b` line part of the contract; Q4 (a) removes MIG-B9-21 from the
header's Depends on and Base, and the index's §7 notes this story as an
exception to its opening sentence.

1. **Q1 — Only the dashed-key rewrite, or every token rewrite, after the
   quotes are removed?** Decision 36 says "It runs the dashed-key rewrite on
   the arguments after the quotes are stripped (F8)". F9 is the same defect
   for `radius(full)`: the only other rewrite a quote can hide (`rounded(`
   and `elevation(` match with or without quotes).
   - (a) As registered: only the dashed-key rewrite. A quoted
     `radius("full")` keeps BASE's two runs. The contract does not pin it,
     and C1 names it as its one exception. The README's "so a second run
     changes nothing" and the CHANGELOG's "Running the codemod again now
     changes nothing." stay broader than the code for that input.
   - (b) Every token rewrite applies to the arguments after the quotes are
     removed. C6 and T6 are added; C1 holds for any files, and decision 35's
     outcome ("so the claim holds when beta.9 ships") is reached. Same
     mechanism and same test harness. The story stays S. The prototype of
     §7 is (b).

   Recommendation: (b). Decision 35 kept the shipped claims on the promise
   that they hold in beta.9, and (a) leaves one known input against them. It
   widens decision 36's wording, so the contract assumes (a) until the owner
   answers.
2. **Q2 — A comma inside a nested call.** F3's fix reads the whole argument
   list, so a nested call's own commas are now reached in one run. BASE
   already turns them into spaces up to its first `)` (§4, part (3)).
   - (a) BASE's rule: every comma inside the directive's parentheses
     becomes a space, nested ones included. `radius(2, 3)` → `radius(2 3)`;
     `palette(primary-main, 0.5)` → `palette(primary.main 0.5)`.
   - (b) Only the commas between arguments become spaces; a nested call
     keeps its own (`radius(2, 3)`, `palette(primary.main, 0.5)`).

   Either output fails to compile with the same code. On `5a041fc` the
   plugin gives `UXD_SURFACE_ARGUMENT: radius(2 3) takes exactly one token
   key` and `… radius(2, 3) takes exactly one token key`. `palette()` is not
   a directive argument either way. Recommendation: (a). It is BASE's rule,
   and it adds no new rule for inputs that are errors in both readings. The
   contract assumes (a).
3. **Q3 — What "leaves a JSON string escape intact" means (F7).**
   - (a) An escaped quote in a directive's arguments is removed with its
     backslash, as a plain quote is. No escape is split, and no other
     backslash moves. The JSON stays valid, and its directive becomes
     canonical: `{"css":".c { @ds-button(outlined primary); }"}`.
   - (b) A directive whose arguments hold an escaped quote is left as
     written, escape and all, and reported as `unresolved:`. The JSON stays
     valid, but the directive keeps its quotes. When the CSS in that string
     is compiled, the plugin rejects it (`UXD_BUTTON_ARGUMENT: Quoted
     arguments are not part of the directive grammar`). It also adds a
     report BASE does not have.

   Recommendation: (a). It keeps the string valid, and it does what the
   codemod does for the same directive in a `.css` file. The README already
   lists quotes among the lax forms it rewrites. The contract assumes (a).
4. **Q4 — Does this story wait for MIG-B9-21?** README §7 opens: "In
   particular every wave-3 story waits for MIG-B9-21, whose K7 rewrites
   comments in every `src` file". This story edits no file under
   `packages/uxdsl/src` or `bin`: K7 and MIG-B9-21's T6 cover those two.
   It shares no file with MIG-B9-21 except the append-only CHANGELOG.
   Decision 36 names only MIG-B9-29 as its dependency.
   - (a) No: it starts now. MIG-B9-29 is merged, and no §7 row it is on
     serializes anything.
   - (b) Yes, as §7's sentence says of every wave-3 story.

   Recommendation: (a). The sentence's reason, K7's `src` comments, does
   not reach this story's files, and it can then ship well before
   MIG-B9-91's gate. Until the owner answers, the header's Base and Depends
   on assume (b), the index's rule as written.

5. **Q5 — F3's form without parentheses.** Decision 36 says the story
   "rewrites a comma list with function arguments in one run (F3)". F3
   (MIG-B9-29 §15) names two forms: the comma list, which is left half done
   (`@ds-surface(contained, radius(2), shadow(1))` →
   `@ds-surface(contained radius(2), shadow(1))`), and
   `@ds-surface contained radius(2);`, which is not rewritten at all. On
   BASE both are stable after run 1 and fail as located
   `UXD_SURFACE_ARGUMENT` errors (§4).
   - (a) As decision 36 words it: only the comma list inside parentheses.
     `.b { @ds-surface contained radius(2); }` and
     `.b2 { @ds-surface contained, radius(2), shadow(1); }` keep BASE's
     bytes (C5), and the compiler keeps reporting them.
   - (b) Both of F3's forms, since decision 36 cites F3 by its id: C3's
     bullet for the form without parentheses, T2's `.b` and `.b2` cases and
     AC2's `.b` line apply. Same rewrite and same tests; the story stays S.

   Recommendation: (b). Decision 36 registers F3, which names both forms,
   and the story's title is that the directive-argument rewrite is
   complete. It widens decision 36's paraphrase, so the contract assumes
   (a) until the owner answers.
