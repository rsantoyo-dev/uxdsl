# Stability policy

UXDSL is in beta (`0.5.0-beta.N`). This page says what a version number
promises today and what it will promise from 1.0.

## What the promise covers

- **The language:** the token functions (`space`, `density`, `color`,
  `palette`, `radius`, `border`, `shadow`), the responsive functions named
  after the theme's breakpoints, the directives (`@ds-surface`, `@ds-button`,
  `@ds-input`, `@ds-typo`) and their argument grammar, `@uxdsl theme;`.
- **The theme JSON:** its families, their fields and the one value grammar.
- **The emitted CSS variables:** `--uxdsl__<family>__<key>`.
- **The package's entry points** (`uxdsl`, `uxdsl/postcss`, `uxdsl/vite`,
  `uxdsl/webpack`, `uxdsl/runtime`, `uxdsl/theme`, `uxdsl/language`,
  `uxdsl/config`), their exports and options.
- **The CLI's commands and flags.**

Not covered: `uxdsl/engine` (tooling internals, said so in its README), the
playground site, and the wording of diagnostic messages (their `UXD_*` codes
are covered).

## Before 1.0

A beta may break any of the above. Every break is listed in the CHANGELOG
under its version, with the step to migrate, and a change in compiled output
is listed under "Visual changes" even when it fixes a bug.

## From 1.0

- **Strict semver** on everything the promise covers.
- **Allowed in a minor:** new theme families; new values in the base theme;
  new roles or states, documented as "requires a rebuild" when they change
  what a directive emits; new value functions; new `UXD_*` codes; new options
  whose default keeps today's behavior.
- **Not allowed in a minor:** renaming an emitted variable, changing which
  declarations a directive emits, moving a base breakpoint, or changing the
  output of an existing theme — except a documented bug fix under "Visual
  changes".
- **Deprecation:** a feature that will be removed warns with `UXD_DEPRECATED`
  and its replacement for at least one minor first; it is removed only in the
  next major.

## What a release has passed

Every release is gated on the tarball that gets published, installed the way
the documentation says: the full test suite, identical theme CSS from the
build and from the runtime, a walk of the documentation site in real Chrome,
every documentation example compiled, and the exact set of contrast pairs the
base theme is allowed to fail. Right after a publish the repository moves to
a development version, so no local build carries a published number.

## Reporting a regression

Open an issue with the "Bug" form: the version, the integration (CLI,
PostCSS, Vite, webpack or runtime), the `.uxdsl` input, the theme excerpt,
what you expected and what you got, and the `UXD_*` code if there is one.
A regression in a covered area is fixed in a patch release.
