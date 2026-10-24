# MIG-B9-54 — "Why UXDSL" and the browser examples

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 5 |
| Decision gate | None (plan §6.3, §6.4). Owner-involved: the text is the owner's voice. |
| Status | Ready (owner-involved) |
| Size | M |
| Depends on | MIG-B9-50 |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-50 |
| Owns | `packages/playground-nextjs/src/app/docs/why/page.mdx` (new), `examples/vite/**`, `examples/nextjs/**` (new), `fixtures/examples/run.js` (new) |
| Shares | `packages/playground-nextjs/src/lib/docs.ts`, `README.md` (two links), `fixtures/release-1.0/run.js` |
| Output impact | none |

## 1. Goal

Two things a visitor needs that no engine change provides: the reason UXDSL
exists, told by the person who built it, and a way to try it in the browser
without installing anything.

## 2. Sources

- Plan §6.3: "'Why UXDSL', in the owner's voice. A short first-person page
  (and the first article): the problem seen in real projects (values copied
  because they matched, breakpoints repeated per component, palettes that
  said a color instead of a role), the idea, and what it does not try to be.
  It is written **with the owner** from their own account; an agent drafts
  only from what the owner tells it, never invents the experience."
- Plan §6.4: "Two examples that open in the browser (StackBlitz or
  CodeSandbox), Next.js and Vite, where changing `densities.4` or a palette
  color in the theme visibly changes the page. Linked from the README and the
  quick start."
- The owner's own words recorded in this repository: "uxdsl es mi carta de
  presentación front end … mi experiencia laboral impresa en una ideología";
  "quiero que la gente lo use"; "inspirada en el motor de Material UI, solo
  que desde el CSS"; the vision quotes in FEAT-010 §1.
- StackBlitz opens a GitHub directory without an account:
  `https://stackblitz.com/github/<owner>/<repo>/tree/<branch>/<dir>`; the
  project installs its `package.json` dependencies from npm, so the examples
  need the published `uxdsl` to work there (after MIG-B9-91); before that the
  fixture builds them from the tarball.

## 3. Preconditions

```bash
test ! -d examples && test ! -d packages/playground-nextjs/src/app/docs/why
grep -q "^## " README.md
```

## 4. Baseline

None.

## 5. Contract

- **Y1 — The interview.** The agent asks the owner, in Spanish, in one
  message, the questions in §7 and writes nothing until the answers arrive.
  The page is drafted in English from the answers only; every sentence that
  describes an experience or an opinion traces to an answer; the draft goes
  back to the owner for approval before it is committed. The page says
  "inspired by Material UI" where it mentions MUI.
- **Y2 — The page.** `/docs/why` (in the "Start" section of the navigation,
  after the introduction): the problem seen in real projects, the idea, what
  UXDSL is not trying to be, the two positioning lines, a link to the quick
  start. At most 900 words. Signed with the owner's name.
- **Y3 — Two examples.** `examples/vite` (Vite + `uxdsl/vite`, one page with a
  card, a button in two tones, a form field, a light/dark toggle through
  `applyTheme`, the theme in `uxdsl.theme.json`) and `examples/nextjs`
  (Next.js with `uxdsl/postcss` and `@uxdsl theme;`, the same page). Each has
  a README with the StackBlitz URL and the two lines to try ("change
  `densities.4`, change `palette.primary.main`"). They depend on `uxdsl`
  by version range (`^0.5.0-beta.9`), so StackBlitz installs the published
  package.
- **Y4 — The fixture.** `fixtures/examples/run.js` installs each example in a
  temp directory with the local tarball (replacing the range), builds it,
  serves it and asserts in Chrome that the card's padding equals
  `--uxdsl__density__4` and that the theme toggle changes `surface.main`.
  The release gate gains `EX-1` (Vite) and `EX-2` (Next.js).
- **Y5 — Links.** The README (root and package) and `/docs/quick-start` link
  the two StackBlitz URLs; the owner verifies them after publishing (an owner
  step recorded in the release record).

Must stay byte-identical: the package.

## 6. Out of scope

- `npm create uxdsl`: later.
- Articles beyond this page: the owner's, later.

## 7. Approach and traps

The interview (sent to the owner in Spanish, one message):

1. ¿Qué problema concreto viste repetirse en proyectos reales antes de
   UXDSL? Un ejemplo con detalle (qué se copiaba, qué se repetía).
2. ¿Qué te hizo pensar en el motor de temas de Material UI como punto de
   partida, y en qué momento decidiste hacerlo desde CSS?
3. ¿Qué cosa de UXDSL te hace sentir que "ya está bien" cuando la usas?
4. ¿Qué NO quieres que UXDSL sea? (utilidades en el markup, un framework,
   un reemplazo de Sass, …)
5. ¿Para quién lo construyes primero?
6. ¿Qué frase te gustaría que alguien dijera después de probarlo cinco
   minutos?
7. ¿Hay algo de tu experiencia laboral que quieras que aparezca, y algo que
   prefieras dejar fuera?

- Nothing in the page is invented: a gap in the answers is a follow-up
  question, not a sentence.
- Stop rule: without answers the page is not written; the examples (Y3–Y5)
  proceed independently.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `fixtures/examples/run.js` | each example builds from the tarball and renders in Chrome with the theme's values | tarball + Chrome | Y3, Y4 | a planted wrong `densities.4` in the example theme changes the measured padding (the fixture asserts the theme's value, so the plant fails) |
| T2 | `fixtures/release-1.0/run.js` | `EX-1`, `EX-2` | tarball | Y4 | — |
| T3 | `fixtures/playground-browser/walk.js` | `/docs/why` renders and is in the navigation | Chrome | Y2 | — |
| T4 | `scripts/docs-shape.test.js` | the two StackBlitz URLs are present in both READMEs and the quick start | unit | Y5 | — |

## 9. Acceptance criteria

- **AC1** `node fixtures/examples/run.js` exits 0 in real Chrome.
- **AC2** `npm run verify:1.0` exits 0 with `EX-1` and `EX-2` ok.
- **AC3** `/docs/why` exists, is approved by the owner in the PR (a comment
  from the owner's account), and is at most 900 words.
- **AC4** `npm test` exits 0; `npm run verify:playground-browser` exits 0.

Owner steps: answer the interview; approve the page; open the StackBlitz URLs
after publishing.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:capabilities` | yes (the examples are not playground sources; no change expected) |
| playground captures | no |

## 11. Documentation

The page, the two example READMEs, the links.

## 12. Verification

```bash
node fixtures/examples/run.js                 # exit 0 (Chrome)
npm run verify:1.0 -- --skip-playground-walk  # background; exit 0
npm run verify:playground-browser             # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-54-why-and-examples`. Two commits:
`docs(FEAT-010): MIG-B9-54 - Why UXDSL, in the owner's voice` (after approval)
and `feat(FEAT-010): MIG-B9-54 - two browser examples (Vite, Next.js) with a tarball fixture and gate checks`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

None yet.
