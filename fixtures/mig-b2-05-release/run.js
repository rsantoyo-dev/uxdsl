'use strict';

// Installed-package acceptance gate. All five coordinated packages come from
// fresh tarballs in an isolated directory, with no workspace resolution.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { cascadedVariables } = require('../mig07-consumer/lib/css-cascade-compare');
const { packAndInstall, DEFAULT_NAMES: names } = require('../lib/tarball-consumer');

async function main() {
  const { dir, run, write, req, version } = packAndInstall({
    tmpPrefix: 'uxdsl-beta2-release-',
    consumerPkg: { name: 'uxdsl-beta2-consumer', version: '1.0.0', private: true },
  });
  for (const name of names) {
    if (name !== 'uxdsl-cli') req(name);
  }
  const cli = path.join(dir, 'node_modules/uxdsl-cli/bin/uxdsl.js');
  const command = (...args) => run(process.execPath, [cli, ...args]);
  command('init');
  run('npm', ['run', 'uxdsl:build']);
  const postcss = req('postcss'), plugin = req('postcss-uxdsl'), runtime = req('postcss-uxdsl/ds-runtime');
  // Only the global (:root-scoped) declarations are comparable against
  // generateThemeCss() — it has no concept of a specific @ds-button/
  // @ds-input *usage* and never emits the per-usage-site tone hook
  // variables (--uxdsl__button__tone-main and friends) those directives
  // write directly onto the component's own selector (e.g. `.button`)
  // when a tone argument is given. Comparing the unfiltered set fails as
  // soon as any real component in the entry uses a tone, not because the
  // theme actually diverges.
  const vars = css => cascadedVariables(css, postcss).filter(line => line.includes('--uxdsl__') && line.startsWith('rule::root'));
  const output = () => fs.readFileSync(path.join(dir, 'src/uxdsl.css'), 'utf8');
  assert.deepEqual(vars(output()), vars(runtime.generateThemeCss()));
  console.log('PASS: installed CLI init + npm script build, zero-config runtime parity.');

  const source = '.card { @ds-surface(contained); } .button { @ds-button(contained primary 2); } .input { @ds-input(outlined primary 2); } .title { @ds-typo(h1); }';
  write('src/uxdsl-entry.uxdsl', source);
  command('build'); // Meaningful defaults: real components and heading, not just an empty entry.
  const theme = { spacing: { 4: '0.875rem' }, palette: { primary: { main: '#123456' } }, fonts: { families: { ui: 'var(--font-geist-sans)' } } };
  const references = { externalTokens: ['--font-geist-sans'] };
  const config = value => write('uxdsl.theme.config.cjs', `module.exports = ${JSON.stringify(value)};\n`);
  config({ theme, references });
  command('build');
  const css = output();
  assert.match(css, /--uxdsl__font__ui:\s*var\(--font-geist-sans\)/);
  assert.deepEqual(vars(css), vars(runtime.generateThemeCss(theme, references)));
  const direct = await postcss([plugin({ theme, references })]).process(source, { from: undefined });
  assert.deepEqual(vars(css), vars(direct.css));
  const component = await postcss([plugin({ theme, references, includeTheme: false })]).process(source, { from: undefined });
  assert.doesNotMatch(component.css, /:root/);
  config({ theme });
  assert.throws(() => command('build'), error => /UXD_REFERENCE_MISSING/.test(String(error.stderr)));
  assert.equal(output(), css, 'failed build preserves previous output');
  config({ theme: { fonts: { families: { ui: 'var(--font-geist-sans, Arial, sans-serif)' } } } });
  command('build');
  write('src/uxdsl-entry.uxdsl', '.bad { color: palette(not-defined.main); }');
  assert.throws(() => command('build'), error => /UXD_REFERENCE_MISSING/.test(String(error.stderr)));
  assert.equal(req('postcss-uxdsl/theme/theme-manifest.json').uxdslVersion, version);
  for (const file of ['default-spacing.css', 'default-typography.uxdsl', 'default-buttons.uxdsl']) assert.ok(fs.existsSync(req.resolve(`postcss-uxdsl/theme/${file}`)));
  console.log('PASS: five tarballs, partial theme + externals, CLI/PostCSS/runtime parity, CSS Modules output, fallback and negative controls, exports/manifest.');
}
main().catch(error => { console.error(error.stdout || '', error.stderr || '', error); process.exitCode = 1; });
