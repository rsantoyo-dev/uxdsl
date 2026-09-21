'use strict';

// MIG-B3-06 (FEAT-004): release gate for beta.3's CLI/plugin option
// parity work, reproducing the exact scenario the origin consumer report
// described — a theme file with partial overrides + externalTokens, one
// theme entry and several component/CSS-Module entries, compiled *only*
// through the CLI's `builds` array (MIG-B3-02), with no custom
// post-processing of its own to strip duplicate `:root`s.
//
// Reuses the same tarball pack/install mechanism as mig-b2-05-release
// (fixtures/lib/tarball-consumer.js) rather than re-implementing it.
//
// This does not publish anything — publication requires the owner's
// separate, explicit approval, same as beta.2.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { packAndInstall } = require('../lib/tarball-consumer');

async function main() {
  const { dir, run, write } = packAndInstall({ tmpPrefix: 'uxdsl-beta3-release-' });
  const cli = path.join(dir, 'node_modules/uxdsl-cli/bin/uxdsl.js');
  const command = (...args) => run(process.execPath, [cli, ...args]);

  // One theme entry (includeTheme: true, the default) and four component
  // entries (includeTheme: false) sharing the same theme/references —
  // the exact "theme + N CSS Module panels" shape from the origin report.
  // MIG-B6-24 (FEAT-008): the theme entry's own outFile deliberately does
  // NOT end in .module.css — that combination (a CSS-Modules-named file
  // that still defines :root/#uxdsl-bp-meta) is exactly what that story
  // makes the CLI refuse, matching real Next.js CSS Modules behavior
  // ("Selector :root is not pure"). Only the four component panels, which
  // compile with includeTheme: false and never define :root themselves,
  // use the .module.css convention.
  write('uxdsl.config.cjs', `module.exports = {
    builds: [
      { entry: './src/theme.uxdsl', outFile: './src/theme.css' },
      { entry: './src/panel-a.uxdsl', outFile: './src/panel-a.module.css', includeTheme: false },
      { entry: './src/panel-b.uxdsl', outFile: './src/panel-b.module.css', includeTheme: false },
      { entry: './src/panel-c.uxdsl', outFile: './src/panel-c.module.css', includeTheme: false },
      { entry: './src/panel-d.uxdsl', outFile: './src/panel-d.module.css', includeTheme: false },
    ],
    watch: ['src/**/*.uxdsl'],
  };\n`);

  // Partial theme override + externalTokens, exactly the shape MIG-B2-01/
  // MIG-B2-02 introduced — and `breakpoints.xl` declared *only* here, never
  // in uxdsl.config.cjs, to exercise MIG-B3-01's theme-breakpoints fix.
  // Every other family (spacing, the rest of palette, typography_details,
  // densities, ...) is left to DEFAULT_THEME entirely.
  write('uxdsl.theme.config.cjs', `module.exports = {
    theme: {
      palette: { primary: { main: '#123456' } },
      fonts: { families: { ui: 'var(--font-geist-sans)' } },
      breakpoints: { xl: 1440 },
    },
    references: { externalTokens: ['--font-geist-sans'] },
  };\n`);

  write('src/theme.uxdsl', '/* theme-only entry — no component rules of its own */');
  // The only entry with a responsive declaration reaching the theme-only
  // `xl` breakpoint — proves it reached a *component* entry too, not just
  // the theme entry, since breakpoints are shared across every build.
  write('src/panel-a.uxdsl', '.card { @ds-surface(contained); width: xs(100%) xl(50%); }');
  write('src/panel-b.uxdsl', '.button { @ds-button(contained primary 2); }');
  write('src/panel-c.uxdsl', '.input { @ds-input(outlined primary 2); }');
  write('src/panel-d.uxdsl', '.title { @ds-typo(h1); }');

  command('build');

  const read = (name) => fs.readFileSync(path.join(dir, 'src', name), 'utf8');
  const outputs = {
    theme: read('theme.css'),
    a: read('panel-a.module.css'),
    b: read('panel-b.module.css'),
    c: read('panel-c.module.css'),
    d: read('panel-d.module.css'),
  };

  // --- Central assertion: no duplicate :root/#uxdsl-bp-meta across entries ---
  for (const key of ['a', 'b', 'c', 'd']) {
    assert.doesNotMatch(outputs[key], /:root/, `panel-${key} (includeTheme: false) must not define :root`);
  }
  assert.match(outputs.theme, /:root/, 'the theme entry must still define :root');
  const combined = Object.values(outputs).join('\n');
  const bpMetaCount = (combined.match(/#uxdsl-bp-meta/g) || []).length;
  assert.equal(bpMetaCount, 1, `expected exactly one #uxdsl-bp-meta across all 5 entries; got ${bpMetaCount}`);
  console.log('PASS: zero duplicate :root/#uxdsl-bp-meta across 5 tarball-installed CLI-built entries.');

  // --- Breakpoint declared only in the theme file reaches every entry ---
  assert.match(outputs.a, /@media \(min-width: 1440px\)/, 'theme-only breakpoints.xl must reach a component entry\'s own responsive declarations');
  console.log('PASS: theme-file-only breakpoints.xl reached a component entry\'s media query.');

  // --- External token / partial theme sanity ---
  assert.match(outputs.theme, /--uxdsl__font__ui:\s*var\(--font-geist-sans\)/);
  console.log('PASS: partial theme override + externalTokens compiled through the CLI builds array.');

  // --- Negative control: an unknown token still fails, and a failed
  // multi-entry build leaves every previous output untouched (MIG-B3-02's
  // atomic-write guarantee, exercised here against real tarballs/CLI, not
  // just the in-process unit tests). ---
  write('src/panel-b.uxdsl', '.bad { color: palette(not-defined.main); }');
  assert.throws(() => command('build'), (error) => /UXD_REFERENCE_MISSING/.test(String(error.stderr)));
  assert.equal(read('theme.css'), outputs.theme, 'a failed build must not touch the theme entry\'s previous output');
  assert.equal(read('panel-a.module.css'), outputs.a, 'a failed build must not touch an unrelated entry\'s previous output');
  console.log('PASS: an unknown token still fails the whole build, leaving every previous output untouched.');

  // --- Negative control: --include-theme override propagates to every
  // builds[] entry uniformly, forcing even a `true` entry to skip :root. ---
  write('src/panel-b.uxdsl', '.button { @ds-button(contained primary 2); }'); // restore
  command('build', '--no-include-theme');
  const themeWithFlag = read('theme.css');
  assert.doesNotMatch(themeWithFlag, /:root/, '--no-include-theme must override even a builds[] entry whose own includeTheme is true');
  console.log('PASS: --no-include-theme overrides every builds[] entry, including the theme entry.');
}

main().catch((error) => {
  console.error(error.stdout || '', error.stderr || '', error);
  process.exitCode = 1;
});
