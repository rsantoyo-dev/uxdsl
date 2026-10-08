# uxdsl-core (deprecated)

`uxdsl-core` is part of [`uxdsl`](https://www.npmjs.com/package/uxdsl) now. This
version, 0.5.0-beta.7, depends on `uxdsl` and only re-exports it, so an existing
install keeps working while you move:

```bash
npm uninstall uxdsl-core
npm i -D uxdsl
```

`require('uxdsl-core').compile` → `require('uxdsl').compile`.

The full old → new table is in the
[uxdsl CHANGELOG](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/uxdsl/CHANGELOG.md#package-layout-stability-phase-4-decision-de-1).
