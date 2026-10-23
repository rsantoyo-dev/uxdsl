# MIG-B9-35 — Canvas-identity tones: a contrast warning

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | DEC-12 (decided 2026-10-23, amended: a contrast warning, not an error by family name) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-40, MIG-B9-91 (the gate's exact contrast sets) |
| Base | `feat/beta9` after MIG-B9-13 |
| Owns | `packages/uxdsl/test/canvas-tones.test.js` (new), `packages/uxdsl/src/theme/base.contrast-exceptions.json` (becomes `[]`) |
| Shares | `packages/uxdsl/src/surfaces.ts`, `control-engine.ts`, `inputs.ts`, `buttons.ts`, `ds-runtime/contrast.ts`, `diagnostics.ts`, `fixtures/release-1.0/contrast-baseline.json`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | **breaking** for stylesheets that used those combinations (illegible by construction) |

## 1. Goal

An illegible combination is not representable: asking for the page's own
canvas color as the text or border color of a transparent role fails at
compile time, with the fix in the message. The contrast gate then reports zero
failing and zero excepted pairs for the base theme, with no pattern exception.

## 2. Sources

- Plan §4.3: "The canvas-identity families `surface`, `light`, `dark` used as a
  tone on `outlined`, `flat` or `underline`, or as a contained Input's focus
  border, draw the canvas color on the canvas. Today they compile and the
  contrast gate excepts them (111 pairs through three pattern records). Make
  them a compile error … drop the three pattern exceptions; the gate should
  then report 0 failing and 0 excepted".
- `theme/base.contrast-exceptions.json`: three pattern records
  (`canvas-identity-tone-surface`, `-light`, `-dark`), each saying "Use `…` as
  a tone only on `contained`, where it is a fill with its own `contrast` on
  top".
- `surfaces.ts` `surfaceDeclarations`: for a tone, `outlined` → transparent
  bg, `color: toneMain`, `border: 1px solid toneMain`; `flat` → transparent
  bg, `color: toneMain`; `contained`/custom → `bg: toneMain`,
  `color: tone-contrast`. `parseSurfaceArguments` validates the tone against
  `getToneFamilies(theme.palette)` (`UXD_SURFACE_TONE`). `requireRole`.
- `theme/base.json` `inputs.*.states.focus.border: "1px solid tone(main)"`:
  an Input's focus border is drawn against the ambient background whatever
  the role.
- The release gate's `contrast` check pins the exact failing and excepted
  sets in `fixtures/release-1.0/contrast-baseline.json`; `--write-contrast-baseline`
  re-pins deliberately.

## 3. Preconditions

```bash
node -e "const x=require('./packages/uxdsl/src/theme/base.contrast-exceptions.json');process.exit(x.length===3?0:1)"
grep -q "result.background = 'transparent'" packages/uxdsl/src/surfaces.ts
grep -q "compileSassStage" packages/uxdsl/src/compile.ts
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {compile}=require('./dist/entries/index.js');compile({source:'.a{@ds-surface(outlined light)}',from:process.cwd()+'/x.uxdsl'},{}).then(r=>console.log('compiles')).catch(e=>console.log(e.message.split('\n')[0]))" && node bin/uxdsl.js theme --contrast 2>&1 | tail -2
```

Recorded: `compiles`; the contrast report shows 0 failing and 111 excepted.

## 5. Contract

- **N1 — The rule.** `CANVAS_TONE_FAMILIES = ['surface', 'light', 'dark']`
  (names, exported from `surfaces.ts`). A directive whose tone is one of them
  fails with `UXD_TONE_CANVAS: "<tone>" is a canvas-identity family: on
  <role>, whose background is transparent, it would draw the canvas color on
  the canvas. Use it as a tone on a filled role (contained), or choose a
  text/border family.` when: the effective Surface's `bg` resolves to
  `transparent` (`outlined`, `flat`, a custom Surface with a transparent
  `bg`); or the directive is `@ds-input(…)` with any role (the focus border is
  drawn on the ambient background). `@ds-surface(contained light)` and
  `@ds-button(contained dark)` stay valid.
- **N2 — The contrast checker agrees.** `checkThemeContrast` skips exactly the
  combinations N1 rejects (it enumerates roles × tones; the rejected pairs are
  not representable, so they are not checked) and reports them in a new
  `unrepresentable` count for transparency. The three pattern exceptions are
  deleted (`base.contrast-exceptions.json` is `[]`); `uxdsl theme --contrast`
  on the base theme prints 0 failing, 0 excepted; the gate's baseline is
  re-pinned with `--write-contrast-baseline` and its diff reviewed (it must
  remove the 111 excepted pairs and add nothing failing).
- **N3 — A remaining failure stops the story.** If any pair still fails after
  N1–N2 (for example a `warning` text pair), the story stops as Blocked with
  the list in §15: the owner decides between re-choosing the color (visual
  change) and an exact exception record. No pattern exception is added.
- **N4 — Consumers.** The playground, the doc examples and Press Craftor's
  sources are grepped for the rejected forms (`outlined light`, `outlined
  surface`, `outlined dark`, `flat …`, `underline …`, `@ds-input(… light|
  surface|dark)`); each use is changed to a legible combination (a declared
  visual change) or reported.
- **N5 — Catalog and docs.** `UXD_TONE_CANVAS` (owner `compiler`);
  `AGENTS.md` Surfaces/Buttons/Inputs: the rule in one sentence; the
  `/docs/accessibility` page explains "unrepresentable".

Must stay byte-identical: every output that does not use a rejected
combination.

## 6. Out of scope

- Theme JSON values: tones are chosen at the directive, not in JSON; a Button
  role whose `surface` is `outlined` has no tone in the theme.
- `warning.main` text pairs: N3 decides with the owner.

## 7. Approach and traps

- Implement the check once, in `surfaces.ts` (it knows the role's `bg`), and
  call it from the control engines' `parseArguments` with the directive name,
  so the message names `@ds-input` correctly.
- The contrast module enumerates combinations in its own loops; reuse the same
  predicate (`isCanvasToneOn(role, tone, family)`) — never a second list.
- The gate's `contrast` check compares against the baseline file; run it,
  review the diff, re-pin.
- Stop rule: N3.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/canvas-tones.test.js` | `MIG-B9-35: outlined/flat with surface, light or dark, and any @ds-input with them, are UXD_TONE_CANVAS, located; contained with them compiles` | unit | N1 | `outlined primary` compiles |
| T2 | same | `MIG-B9-35: a custom Surface with a transparent bg rejects canvas tones; one with a filled bg accepts them` | unit | N1 | — |
| T3 | `test/contrast.test.js`, `test/base-theme-contrast.test.js` | `MIG-B9-35: the base theme has 0 failing and 0 excepted pairs; the unrepresentable count equals the combinations the compiler rejects` | unit | N2 | a planted exception record is reported as unused |
| T4 | `fixtures/release-1.0/run.js` `contrast` | the re-pinned exact sets | tarball | N2 | — |
| T5 | `test/diagnostics-catalog.test.js` | the code is catalogued and asserted | unit | N5 | — |
| T6 | `scripts/doc-examples.test.js` | no example uses a rejected form | docs | N4 | — |
| T7 | `fixtures/playground-browser/walk.js` | the contrast page equals Node's report (0/0) | Chrome | N2 | the `contrast-mismatch` control |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/canvas-tones.test.js packages/uxdsl/test/contrast.test.js packages/uxdsl/test/base-theme-contrast.test.js` exits 0.
- **AC2** `node packages/uxdsl/bin/uxdsl.js theme --contrast` exits 0 and
  prints 0 failing, 0 excepted; `cat packages/uxdsl/src/theme/base.contrast-exceptions.json`
  prints `[]`.
- **AC3** `npm run verify:1.0` exits 0 with `contrast ok` against the
  re-pinned baseline; the PR shows the baseline diff.
- **AC4** `npm test` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `AGENTS.md` + agent guide | yes |
| CHANGELOG | yes (`### Breaking`, `### Visual changes` if N4 changed a consumer) |
| `migration.md` | yes |
| package README | yes |
| `DIAGNOSTIC_CATALOG` | yes (`UXD_TONE_CANVAS`) |
| `npm run generate:capabilities` | yes |
| playground `uxdsl:build` + captures | yes (contrast page) |
| contrast baseline | yes (re-pin) |

## 11. Documentation

`AGENTS.md`, `packages/uxdsl/README.md`, `packages/uxdsl/CHANGELOG.md`,
`packages/uxdsl/docs/migration.md`, the playground's `/docs/accessibility`
(`ContrastReport.tsx`).

## 12. Verification

```bash
node --test packages/uxdsl/test/canvas-tones.test.js packages/uxdsl/test/contrast.test.js packages/uxdsl/test/base-theme-contrast.test.js   # exit 0
node packages/uxdsl/bin/uxdsl.js theme --contrast                 # 0 failing, 0 excepted
node fixtures/release-1.0/run.js --write-contrast-baseline --skip-playground-walk   # review the diff, then:
npm run verify:1.0                                                 # background; exit 0
npm test                                                           # background; exit 0
```

## 13. Delivery

Branch `feat/b9-35-canvas-tones`. Commit:
`feat(FEAT-010): MIG-B9-35 - canvas-identity tones on transparent roles and Inputs are UXD_TONE_CANVAS; the contrast gate at 0 failing, 0 excepted`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

Remaining failing pairs after N1–N2, if any, with the owner's options.

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- N1 rejects legible code: the contrast baseline excepts `dark` pairs only in dark mode (23 records, none in light), so `flat dark` passes in light mode and in any theme without `modes.dark`. Hard-coding family names also contradicts "palette names carry no fixed meaning"; it rejects `flat light` on a dark contained parent (the compiler assumes the background is `surface.main`) and checks the Surface's `bg` while a control's own `base.bg` can override it.
- Recommended: derive the rejection per mode from the effective theme's contrast predicate, or make it a warning; otherwise defer.
- The underline Input's focus treatment is `underline`, not `border`.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-12 changes N1.** Rewrite §1 and §5 before implementing: a tone on a transparent-background role (`outlined`, `flat`, `underline`) or on an Input is checked by contrast, not by family name. For each mode of the effective theme, compute the contrast of the tone against the canvas with the contrast gate's predicate and threshold; below it, emit a located warning with the fix (`contained`, or another tone). It never fails the build: the compiler cannot know the real background (a `data-theme` scope, a contained parent).
- The contrast gate's three pattern exceptions are replaced by the same predicate: those pairs stay listed, as warned, never as passing. Re-pin `fixtures/release-1.0/contrast-baseline.json` deliberately. The review's note on the underline Input (its focus treatment is `underline`, not `border`) applies.
