# The move to one package, `uxdsl` — owner's publish steps

**Status: prepared, not published.** Stability phase 4 (decision DE-1) merged
the five packages into `packages/uxdsl` and prepared a last version of each
former name under `packages/_deprecated/`. Nothing here has been run against
the registry; every step below is the owner's.

| Package | What is published | Version |
| --- | --- | --- |
| `uxdsl` | the package itself (`packages/uxdsl`) | the next release, `1.0.0-rc.1` (stability phase 7) |
| `postcss-uxdsl` | shim re-exporting `uxdsl/postcss`, `uxdsl/engine` + `uxdsl/runtime` (`./ds-runtime`), `uxdsl/engine` + `uxdsl/language` (`./language`), `uxdsl/config` and the theme JSON files | `0.6.0` |
| `uxdsl-core` | shim re-exporting the `uxdsl` root (`compile()`) | `0.6.0` |
| `uxdsl-cli` | shim whose `uxdsl` bin runs the `uxdsl` package's command | `0.6.0` |
| `vite-plugin-uxdsl` | shim re-exporting `uxdsl/vite` | `0.6.0` |
| `uxdsl-webpack-loader` | shim re-exporting `uxdsl/webpack` | `0.6.0` |

Each shim depends on `uxdsl@^1.0.0-rc.1`, so **`uxdsl` has to be on the
registry first**. A shim prints nothing; npm shows the deprecation message on
install. `packages/_deprecated/shims.test.js` (in `npm test`) checks that every
shim subpath is exactly the `uxdsl` entry it maps to, value for value, that the
names the old package exported are still there (except six internal
`postcss-uxdsl/config` helpers, listed in the test as dropped on purpose), that
the `uxdsl-cli` bin runs the command, and that the declaration files resolve.

## Before publishing

1. The PR of stability phase 4 is merged and CI is green: the `npm test` job
   and the `verify:1.0` gate (one tarball, real Chrome).
2. From a clean checkout of `main`:

   ```bash
   npm ci --ignore-scripts
   (cd packages/uxdsl && npm ci)
   npm test
   npm run verify:1.0
   node scripts/release.js --check-pack   # the uxdsl tarball against its 300 KB budget
   ```

`npm audit` on a fresh `npm i -D uxdsl` (all dependencies) reports 0
vulnerabilities: 20 packages, `uxdsl` and its `postcss` peer included. Until
the `feat/stability-deps` work it reported 5 (1 moderate, 4 high) from two
inherited chains — `chokidar@3` → `braces` (the CLI's watcher, now
`chokidar@4` + `picomatch`) and `postcss-advanced-variables@3` → `postcss@7`
(the SCSS subset, now UXDSL's own) — and installed 36 packages; the published
0.5.0-beta.6 (`npm i -D uxdsl-cli postcss-uxdsl`) reports 6 (2 moderate,
4 high) from the same two. `verify:1.0` fails on any high or critical finding
(check `AUDIT`).

## 1. Publish `uxdsl`

```bash
node scripts/release.js --version 1.0.0-rc.1 --tag next --otp <code>
```

`release.js` sets the version, builds, regenerates the language artifacts,
validates the exact tarball (budget, every declared entry point present,
shasum), publishes it, and then builds the VS Code extension's VSIX — which it
does not publish. Check the result:

```bash
npm view uxdsl@1.0.0-rc.1 version
npm view uxdsl dist-tags
```

Whether `latest` should point at the release candidate is your call
(`npm dist-tag add uxdsl@1.0.0-rc.1 latest`); `release.js` only verifies
dist-tags automatically on the beta channel.

## 2. Publish the five shims

Only after `uxdsl@1.0.0-rc.1` resolves from the registry:

```bash
for name in postcss-uxdsl uxdsl-core uxdsl-cli vite-plugin-uxdsl uxdsl-webpack-loader; do
  (cd "packages/_deprecated/$name" && npm publish --access public --otp <code>)
done
```

They go to `latest` on purpose: `npm i postcss-uxdsl` should land on the shim,
which installs `uxdsl` and shows the deprecation.

## 3. Deprecate the five names

The messages are in `packages/_deprecated/deprecations.json` (each names
`npm i -D uxdsl` and links the old → new import table). Deprecating every
version, the shim included:

```bash
node -e "const m=require('./packages/_deprecated/deprecations.json'); for (const [n,t] of Object.entries(m)) console.log(n + '\t' + t)" |
while IFS="$(printf '\t')" read -r name message; do
  npm deprecate "$name@*" "$message" --otp <code>
done
```

Check: `npm view postcss-uxdsl deprecated` prints the message, and in an empty
directory `npm i -D postcss-uxdsl` warns with it and installs `uxdsl` next to
the shim.

## 4. The VS Code extension

`release.js` leaves `packages/uxdsl-vscode/uxdsl-vscode-<version>.vsix`.
Publishing it to the Visual Studio Marketplace and Open VSX (`vsce publish
--packagePath …`, `ovsx publish …`) is yours; the extension keeps its own
version.

## 5. Afterwards

- Bump `packages/uxdsl` to the next `-dev` version right away (audit I9), so a
  local tarball never carries a published version number with unpublished code.
- The consuming project (`story-radar`) moves with `npm uninstall postcss-uxdsl
  uxdsl-cli && npm i -D uxdsl`, renames `uxdsl.theme.config.*` to
  `uxdsl.theme.*`, and replaces `uxdsl watch` with `uxdsl build --watch`.

Nothing in this file has been executed: no publish, no `npm deprecate`, no
dist-tag change.
