# Deployment & Release Process

This document outlines the process for releasing and deploying the UXDSL packages.

## Release Script

The project uses a custom release script located at `scripts/release.js` to manage versioning and publishing across the monorepo.

### Usage

Run the release script from the root directory:

```bash
node scripts/release.js --version <new-version> [options]
```

### Options

- `--version <semver>`: **Required**. The new version number to apply to all packages (e.g., `1.0.0`).
- `--tag <dist-tag>`: The npm distribution tag (default: `latest`).
- `--dry-run`: Simulate the release process without making changes or publishing.
- `--skip-build`: Skip the build step for packages.
- `--skip-publish`: Update versions but do not publish to npm.

### Workflow

1. **Update Versions**: The script iterates through all packages (`postcss-uxdsl`, `uxdsl-core`, etc.) and updates their `package.json` version.
2. **Update Dependencies**: It ensures that internal dependencies (e.g., `vite-plugin-uxdsl` depending on `uxdsl-core`) are updated to the new version.
3. **Build**: Runs the build script for each package (unless skipped).
4. **Publish**: Publishes each package to the npm registry (unless skipped).

## Manual Publishing

If you need to publish packages manually, ensure you update the versions in the correct order to satisfy dependencies:

1. `postcss-uxdsl`
2. `uxdsl-core`
3. `vite-plugin-uxdsl`, `uxdsl-webpack-loader`, `uxdsl-cli`

```bash
cd packages/postcss-uxdsl
npm publish

cd ../uxdsl-core
npm publish

# ...and so on
```

## CI/CD

(Add details about CI/CD pipelines here if applicable, e.g., GitHub Actions)
