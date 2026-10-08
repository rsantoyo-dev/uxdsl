# vite-plugin-uxdsl (deprecated)

`vite-plugin-uxdsl` is part of [`uxdsl`](https://www.npmjs.com/package/uxdsl) now. This
last version, 0.6.0, depends on `uxdsl` and only re-exports it, so an existing
install keeps working while you move:

```bash
npm uninstall vite-plugin-uxdsl
npm i -D uxdsl
```

`import uxdsl from 'vite-plugin-uxdsl'` → `import uxdsl from 'uxdsl/vite'`.

The full old → new table is in the
[uxdsl CHANGELOG](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/uxdsl/CHANGELOG.md#package-layout-stability-phase-4-decision-de-1).
