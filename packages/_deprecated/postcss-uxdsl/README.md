# postcss-uxdsl (deprecated)

`postcss-uxdsl` is part of [`uxdsl`](https://www.npmjs.com/package/uxdsl) now. This
version, 0.5.0-beta.7, depends on `uxdsl` and only re-exports it, so an existing
install keeps working while you move:

```bash
npm uninstall postcss-uxdsl
npm i -D uxdsl
```

`require('postcss-uxdsl')` → `require('uxdsl/postcss')`; `postcss-uxdsl/ds-runtime` → `uxdsl/runtime` (browser API), `uxdsl/theme` (theme model) or `uxdsl/engine` (per-family engines); `postcss-uxdsl/language` → `uxdsl/language` or `uxdsl/engine`; `postcss-uxdsl/config` → `uxdsl/config`.

The full old → new table is in the
[uxdsl CHANGELOG](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/uxdsl/CHANGELOG.md#package-layout-stability-phase-4-decision-de-1).
