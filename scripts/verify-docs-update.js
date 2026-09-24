#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');

function runGit(args) {
  const result = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function getPublishablePackages() {
  if (!fs.existsSync(packagesDir)) return [];

  return fs
    .readdirSync(packagesDir)
    .filter((entry) => {
      const pkgJsonPath = path.join(packagesDir, entry, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) return false;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        return pkg && pkg.name && pkg.private !== true;
      } catch {
        return false;
      }
    })
    .map((entry) => ({
      dir: entry,
      rel: `packages/${entry}`,
      readme: `packages/${entry}/README.md`,
    }));
}

// MIG-B3-05 (FEAT-004): these files define the *default* visual output any
// consumer with no override of the affected tokens/tags actually sees —
// beta.2 changed h2/h3's line-height here with no changelog note, and it
// took a consumer's own migration report to surface it. A change here is a
// visual change, not an ordinary code change, so it gets its own stricter
// requirement: the package's actual CHANGELOG.md, not just any README.
const SRC = 'packages/postcss-uxdsl/src';
const VISUAL_DEFAULT_FILES = [
  `${SRC}/default-theme.ts`,
  // MIG-B6-17 (FEAT-008) removed `typography-defaults.ts` from this list along
  // with the file itself: its DEFAULT_TYPOGRAPHY map had no importer left once
  // `@ds-typo` stopped inventing values, so guarding a path that no longer
  // exists would be exactly the dead entry MIG-B6-28 cleaned up elsewhere.
  `${SRC}/typography.ts`,
  // MIG-B6-29 (FEAT-008): DEFAULT_THEME is theme/base.json itself now — most
  // future visual-default changes will edit this file directly, not
  // default-theme.ts (which barely has any literal content left).
  `${SRC}/theme/base.json`,
  // MIG-B6-29 phase 2/4: every accepted contrast exception is itself a
  // visual-default decision (a specific color pair the theme knowingly
  // ships despite failing WCAG) — it deserves the same changelog
  // discipline as the colors it excuses.
  `${SRC}/theme/base.contrast-exceptions.json`,
  // MIG-B7-16 (FEAT-009): the list above only named files that hold default
  // *values*. A change to an engine that turns those values into CSS alters the
  // compiled output for every consumer just as much — MIG-B7-01 changed which
  // color a placeholder gets, and MIG-B7-14 changed where the theme's @import
  // sits, both inside files this guard did not cover, so neither was asked for a
  // CHANGELOG note by anything but the author's own care.
  `${SRC}/control-engine.ts`,
  `${SRC}/surfaces.ts`,
  `${SRC}/buttons.ts`,
  `${SRC}/inputs.ts`,
  `${SRC}/edges.ts`,
  `${SRC}/shadows.ts`,
  `${SRC}/foundations.ts`,
  `${SRC}/fonts.ts`,
  `${SRC}/index.ts`,
  `${SRC}/language.ts`,
  `${SRC}/preset-engine.ts`,
  `${SRC}/naming.ts`,
  `${SRC}/base-theme.ts`,
  `${SRC}/ds-runtime/theme-generator.ts`,
  // The generated legacy default files consumers can still import.
  `${SRC}/theme/default-borders.uxdsl`,
  `${SRC}/theme/default-buttons.uxdsl`,
  `${SRC}/theme/default-colors.css`,
  `${SRC}/theme/default-densities.uxdsl`,
  `${SRC}/theme/default-inputs.uxdsl`,
  `${SRC}/theme/default-palette.css`,
  `${SRC}/theme/default-radii.uxdsl`,
  `${SRC}/theme/default-shadows.uxdsl`,
  `${SRC}/theme/default-spacing.css`,
  `${SRC}/theme/default-surfaces.uxdsl`,
  `${SRC}/theme/default-typography.uxdsl`,
];

// MIG-B7-16 (FEAT-009): the other half of the classification. Every file under
// `postcss-uxdsl/src` is in exactly one of these two lists, and a test
// (verify-docs-update.test.js) fails when a file is in neither — so a new engine
// cannot slip past this guard just because nobody decided which kind it is. A
// file listed here needs a reason, and the reason has to be about compiled
// output: "it is not an engine" is not one. These are judgments, read from the
// code; they are not mutation-tested.
const NON_VISUAL_SOURCE_FILES = {
  [`${SRC}/diagnostics.ts`]: 'error messages and source positions; never a compiled declaration',
  [`${SRC}/types.ts`]: 'type declarations only',
  [`${SRC}/reference-integrity.ts`]: 'validates emitted references and throws or warns; emits no CSS',
  [`${SRC}/config.ts`]: 'discovers which theme file is read; with no file the default output is unaffected',
  [`${SRC}/ds-runtime.ts`]: 'public export barrel; API changes belong in the CHANGELOG but do not alter compiled output',
  [`${SRC}/ds-runtime/index.ts`]: 'runtime setters (palette, spacing, breakpoints) that only act when a page calls them',
  [`${SRC}/ds-runtime/breakpoints.ts`]: 're-export; the default values live in language.ts, which is listed above',
  [`${SRC}/ds-runtime/apply-theme.ts`]: 'browser stylesheet management; the CSS it writes is generated by theme-generator.ts, listed above',
  [`${SRC}/ds-runtime/contrast.ts`]: 'reports WCAG results over a theme; emits no CSS',
  [`${SRC}/ds-runtime/legacy-storage.ts`]: 'localStorage migration adapter',
  [`${SRC}/ds-runtime/theme-structure.ts`]: 'compares two themes to gate applyTheme; emits no CSS',
  [`${SRC}/ds-runtime/theme-validate.ts`]: 'validates a theme object; emits no CSS',
  [`${SRC}/theme/theme-manifest.json`]: 'generated release metadata that changes with every version bump',
};
const VISUAL_DEFAULT_CHANGELOG = 'packages/postcss-uxdsl/CHANGELOG.md';

function isCodeChangeInPackage(relFile, pkgRel) {
  if (!relFile.startsWith(`${pkgRel}/`)) return false;
  const local = relFile.slice(pkgRel.length + 1);

  // Documentation-only changes do not require additional docs edits.
  const docOnly =
    local === 'README.md' ||
    local === 'CHANGELOG.md' ||
    local.startsWith('docs/');

  // MIG-B6-30 (FEAT-008): a lockfile on its own is a mechanical sync, not a
  // change an npm consumer needs told about — adding a devDependency to one
  // package rewrites the lockfile of every sibling that depends on it locally,
  // and demanding a README note there produces a sentence with nothing to say.
  // Any dependency change that *does* reach consumers also edits
  // `package.json`, which is still guarded, so nothing meaningful escapes.
  const lockfileOnly = local === 'package-lock.json' || local === 'npm-shrinkwrap.json';

  return !docOnly && !lockfileOnly;
}

function main() {
  const stagedOutput = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  if (!stagedOutput) {
    process.exit(0);
  }

  const stagedFiles = stagedOutput
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\\/g, '/'));

  const publishablePackages = getPublishablePackages();
  if (publishablePackages.length === 0) {
    process.exit(0);
  }

  const rootReadmeChanged = stagedFiles.includes('README.md');
  const violations = [];
  const touchedPackages = [];

  publishablePackages.forEach((pkg) => {
    const hasCodeChange = stagedFiles.some((f) => isCodeChangeInPackage(f, pkg.rel));
    if (!hasCodeChange) return;

    touchedPackages.push(pkg.dir);

    const packageReadmeChanged = stagedFiles.includes(pkg.readme);
    if (!packageReadmeChanged && !rootReadmeChanged) {
      violations.push(pkg);
    }
  });

  if (touchedPackages.length > 0) {
    console.log(`📦 Changed npm packages: ${touchedPackages.join(', ')}`);
  }

  if (violations.length > 0) {
    console.error('\n❌ Documentation update required before commit.');
    console.error('You changed publishable package code, but no README update was staged for:');
    violations.forEach((pkg) => {
      console.error(`  - ${pkg.rel}/ (stage ${pkg.readme} or README.md)`);
    });
    console.error('\nTip: include at least one docs note per package change to keep npm consumers informed.');
    process.exit(1);
  }

  const touchedVisualFiles = VISUAL_DEFAULT_FILES.filter((f) => stagedFiles.includes(f));
  if (touchedVisualFiles.length > 0 && !stagedFiles.includes(VISUAL_DEFAULT_CHANGELOG)) {
    console.error('\n❌ Visual-default change without a CHANGELOG note.');
    console.error(`You changed a file that defines default visual output, but ${VISUAL_DEFAULT_CHANGELOG} was not staged:`);
    touchedVisualFiles.forEach((f) => console.error(`  - ${f}`));
    console.error('\nA change here alters compiled output for any consumer with no override of the affected');
    console.error('tokens/tags. Add a "### Visual changes" entry (see 0.5.0-beta.2\'s entry in the CHANGELOG for');
    console.error('the format) — even a small tweak, since a consumer diffing compiled CSS is how this was found.');
    process.exit(1);
  }

  if (touchedPackages.length > 0) {
    console.log('✅ Docs check passed.');
  }
}

if (require.main === module) main();

module.exports = { VISUAL_DEFAULT_FILES, NON_VISUAL_SOURCE_FILES };
