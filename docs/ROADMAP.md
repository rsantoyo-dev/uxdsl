# Roadmap

No dates: each step ships when its definition of done holds. The plan behind
the next releases is [FEAT-010](features/FEAT-010-beta9.md) (internal).

## 0.5.0-beta.9 — the one package

The first release of `uxdsl`, with the whole plan in one release (decided
on 2026-10-23). Done when a `.scss` file renamed to `.uxdsl` compiles to the CSS
Dart Sass produces for it, the theme is written only where `@uxdsl theme;`
is, the documentation site is built only from UXDSL's own roles and tokens
(nothing hard-coded, checked by a test), the documentation is rewritten for
the one package, an app built only from the public documentation runs without
help, and the release gate passes on the published tarball.

## 1.0.0-rc.1

Done when the release gate passes, a real project (Press Craftor) runs on the
release candidate, and the stability policy ([STABILITY.md](../STABILITY.md))
is in force.

## 1.0.0

The release candidate, unchanged, after the owner's review.

## After 1.0

Not promised before users ask for them: container queries, fluid `clamp()`
scales, DTCG import and export, more named modes than `dark`, editor
completion from the project's own theme, a Material UI theme import.
