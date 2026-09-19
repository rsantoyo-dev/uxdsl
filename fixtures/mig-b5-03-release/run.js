'use strict';

// MIG-B5-03 (FEAT-006): release gate for beta.5's scoped --strict-theme
// work, reproducing the exact scenario a real consumer's CI report
// described against real npm tarballs of all five coordinated packages.
//
// Reuses the same tarball pack/install mechanism as the other
// release-gate fixtures (fixtures/lib/tarball-consumer.js).
//
// This does not publish anything — publication requires the owner's
// separate, explicit approval, same as every prior beta.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { packAndInstall } = require('../lib/tarball-consumer');

async function main() {
  const { dir, run, write, req } = packAndInstall({ tmpPrefix: 'uxdsl-beta5-release-' });
  const cli = path.join(dir, 'node_modules/uxdsl-cli/bin/uxdsl.js');
  const command = (...args) => run(process.execPath, [cli, ...args]);
  const read = (name) => fs.readFileSync(path.join(dir, 'src', name), 'utf8');
  const { DEFAULT_THEME } = req('postcss-uxdsl/ds-runtime');

  write('uxdsl.config.cjs', `module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css' };\n`);
  write('src/uxdsl-entry.uxdsl', '/* zero-config, all tokens come from the theme */');

  // The exact reported repro: palette fully specified, typography_details
  // partially overridden per-key — the documented, encouraged pattern for
  // that family (see postcss-uxdsl's README, "Guía de 5 entradas", and
  // theme-validate.ts's own "(partial allowed)" comment).
  write('uxdsl.theme.config.cjs', `module.exports = {
    palette: ${JSON.stringify(DEFAULT_THEME.palette)},
    typography_details: { h2: { fontSize: '2.2rem' } },
  };\n`);

  // --- MIG-B5-01: bare --strict-theme is unchanged from beta.4 — still
  // fails on exactly this documented partial-typography usage. ---
  assert.throws(
    () => command('build', '--strict-theme'),
    (error) => /--strict-theme:.*typography_details/.test(String(error.stderr))
  );
  console.log('PASS: bare --strict-theme still fails on the documented typography_details partial override (no regression from beta.4).');

  // --- MIG-B5-01: scoped to the family that actually matters to this
  // project, the same theme passes. ---
  command('build', '--strict-theme=palette');
  assert.ok(fs.existsSync(path.join(dir, 'src/uxdsl.css')));
  console.log('PASS: --strict-theme=palette passes with the same theme, scoping typography_details out.');

  // --- MIG-B5-01: `uxdsl theme --strict=palette` has the same scope. ---
  command('theme', '--strict=palette'); // Must not throw.
  console.log('PASS: uxdsl theme --strict=palette has the same scope as build\'s equivalent.');

  // --- MIG-B5-02: an unknown top-level family warns (not fails) from a
  // real build, and doesn't repeat on a second build in the same process.
  // This originally also asserted a second, one-level-deeper "Unknown
  // typography_details key" warning for `h9` here — MIG-B6-01 (FEAT-007)
  // found that check to be a false positive (typography_details tag names,
  // like palette and fonts.families roles, are an open namespace with no
  // real closed set to compare against — DEFAULT_THEME's own key set was
  // never meant to be one) and removed it at the source, so `h9` is
  // correctly silent below now. See docs/features/FEAT-007 for the full
  // writeup. ---
  write('uxdsl.theme.config.cjs', `module.exports = {
    palette: ${JSON.stringify(DEFAULT_THEME.palette)},
    typography_details: { h9: { fontSize: '1rem' } },
    color: { primary: '#123456' },
  };\n`);
  // console.warn writes to stderr, not stdout — execFileSync's return
  // value (what `run`/`command` give back) is stdout only, so this one
  // check needs spawnSync directly to see both streams combined.
  const firstBuild = spawnSync(process.execPath, [cli, 'build'], { cwd: dir, encoding: 'utf8' });
  const firstBuildOutput = `${firstBuild.stdout}${firstBuild.stderr}`;
  assert.equal(firstBuild.status, 0, `build with only warnings must still succeed:\n${firstBuildOutput}`);
  assert.match(firstBuildOutput, /Unknown theme family "color"/);
  assert.doesNotMatch(firstBuildOutput, /Unknown typography_details key "h9"/, 'MIG-B6-01 regression: a typo-shaped-but-valid tag name must not warn');
  assert.ok(fs.existsSync(path.join(dir, 'src/uxdsl.css')), 'an unknown-key warning must not block the build');
  console.log('PASS: unknown theme family warning prints from a real build and does not block it; the reverted nested-key warning stays gone.');
}

main().catch((error) => {
  console.error(error.stdout || '', error.stderr || '', error);
  process.exitCode = 1;
});
