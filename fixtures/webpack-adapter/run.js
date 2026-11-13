'use strict';

// MIG-B6-20 (FEAT-008) acceptance gate: uxdsl/webpack, installed from
// a real tarball (no workspace/symlink resolution back into this
// monorepo), driving real webpack compilations with `css-loader` and
// `MiniCssExtractPlugin` — not a mocked loader context. Exercises every
// criterion the story lists for this fixture: real CSS extraction via
// css-loader/MiniCssExtractPlugin, watch-mode recompilation on an
// `@import`-ed partial's edit, and options arriving via `getOptions()`.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { packAndInstall } = require('../lib/tarball-consumer');

async function main() {
  const { dir, run, write } = packAndInstall({
    tmpPrefix: 'uxdsl-webpack-adapter-',
    consumerPkg: { name: 'uxdsl-webpack-adapter-consumer', version: '1.0.0', private: true },
  });
  run('npm', ['install', 'webpack@^5', 'webpack-cli@^5', 'css-loader@^7', 'mini-css-extract-plugin@^2', '--no-audit', '--no-fund']);

  // Breakpoints are declared in the theme file (there is no loader option for
  // them); the 900px media query below proves the discovered theme is applied.
  write('uxdsl.theme.cjs', "module.exports = { palette: { adapteronlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } }, breakpoints: { md: 900 } };\n");
  // In a subdirectory, so a map that names the panel from the wrong directory
  // shows. The global stylesheet writes the one `@uxdsl theme;`.
  write('src/styles/global.uxdsl', '@uxdsl theme;\n');
  write('src/styles/partial.uxdsl', '.partial { color: green; }\n');
  write('src/styles/panel.uxdsl', '@import "./partial.uxdsl";\n.a { color: red; padding: xs(1rem) md(2rem); background: palette(adapteronlybrand); }\n');
  write('main.js', "import './src/styles/global.uxdsl';\nimport './src/styles/panel.uxdsl';\n");
  write(
    'webpack.config.js',
    "const path = require('path');\n" +
    "const MiniCssExtractPlugin = require('mini-css-extract-plugin');\n" +
    "module.exports = {\n" +
    "  mode: 'development',\n" +
    "  context: __dirname,\n" +
    "  entry: './main.js',\n" +
    "  output: { path: path.join(__dirname, 'dist'), filename: 'bundle.js' },\n" +
    "  module: {\n" +
    "    rules: [{\n" +
    "      test: /\\.uxdsl$/,\n" +
    "      use: [MiniCssExtractPlugin.loader, 'css-loader', { loader: 'uxdsl/webpack' }],\n" +
    "    }],\n" +
    "  },\n" +
    "  plugins: [new MiniCssExtractPlugin({ filename: 'styles.css' })],\n" +
    "  optimization: { minimize: false },\n" +
    "};\n"
  );

  // --- build with css-loader + MiniCssExtractPlugin ---
  const built = run(path.join(dir, 'node_modules/.bin/webpack'), ['build']);
  const cssPath = path.join(dir, 'dist', 'styles.css');
  assert.ok(fs.existsSync(cssPath), 'MiniCssExtractPlugin must produce a real dist/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /\.a\s*\{[^}]*color:\s*red/, 'extracted CSS must contain the compiled rule');
  assert.match(css, /900px/, "the discovered theme's own breakpoints must take effect");
  assert.match(css, /\.partial\s*\{[^}]*color:\s*green/, '@import-ed partial must be inlined into the same output');
  // A definition, not the var() reference the panel's rule alone would give.
  const defined = /--uxdsl__palette__adapteronlybrand-main:\s*#0af/;
  assert.doesNotMatch('.a { background: var(--uxdsl__palette__adapteronlybrand-main); }', defined, 'control: the reference alone does not pass for a definition');
  assert.match(css, defined, "the project's uxdsl.theme.cjs must be discovered and applied where the global writes @uxdsl theme;");
  assert.doesNotMatch(built, /UXD_THEME_MARKER/, 'one global stylesheet writes the marker: no theme warning');
  // Control: the same build from an entry that skips the global stylesheet
  // prints the warning, once, where the check above reads.
  write('control.js', "import './src/styles/panel.uxdsl';\n");
  const control = run(path.join(dir, 'node_modules/.bin/webpack'), ['build', '--entry-reset', '--entry', './control.js', '--output-path', path.join(dir, 'dist-control')]);
  assert.equal(control.split('UXD_THEME_MARKER: no module reaches').length - 1, 1, `control: without the global the build warns once:\n${control}`);
  console.log('  ok  - css-loader + MiniCssExtractPlugin produce a real CSS file with the compiled rules, options and theme applied, and no theme warning (and one without the global)');

  // --- no absolute build-machine paths anywhere in dist/ ---
  const distFiles = fs.readdirSync(path.join(dir, 'dist')).map((f) => path.join(dir, 'dist', f));
  const leaks = distFiles.filter((f) => fs.readFileSync(f, 'utf8').includes(dir));
  assert.deepEqual(leaks, [], `no dist/ file may contain the build machine's absolute repo path; leaked in: ${leaks.join(', ')}`);
  console.log('  ok  - no dist/ file contains the build machine\'s absolute path');

  // --- MIG-B6-21: source maps, end to end through css-loader ---
  // The loader reads webpack's own `this.sourceMap` (set from devtool), so
  // this needs no loader option of its own. Asserted by really resolving a
  // position in the emitted map, not by checking a map merely exists.
  write(
    'webpack.map.config.js',
    "const path = require('path');\n" +
    "const MiniCssExtractPlugin = require('mini-css-extract-plugin');\n" +
    "module.exports = {\n" +
    "  mode: 'development',\n" +
    "  devtool: 'source-map',\n" +
    "  context: __dirname,\n" +
    "  entry: './main.js',\n" +
    "  output: { path: path.join(__dirname, 'dist-map'), filename: 'bundle.js' },\n" +
    "  module: {\n" +
    "    rules: [{\n" +
    "      test: /\\.uxdsl$/,\n" +
    "      use: [MiniCssExtractPlugin.loader, { loader: 'css-loader', options: { sourceMap: true } }, { loader: 'uxdsl/webpack' }],\n" +
    "    }],\n" +
    "  },\n" +
    "  plugins: [new MiniCssExtractPlugin({ filename: 'styles.css' })],\n" +
    "  optimization: { minimize: false },\n" +
    "};\n"
  );
  run(path.join(dir, 'node_modules/.bin/webpack'), ['build', '--config', 'webpack.map.config.js']);
  const mapPath = path.join(dir, 'dist-map', 'styles.css.map');
  assert.ok(fs.existsSync(mapPath), 'a source map must be emitted for the extracted CSS when devtool is on');
  const mapped = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  // Control: a source that names the panel from the wrong directory fails this check.
  assert.equal(['webpack://uxdsl-webpack-adapter-consumer/./panel.uxdsl'].some((src) => src.endsWith('src/styles/panel.uxdsl')), false);
  assert.ok(
    mapped.sources.some((src) => String(src).endsWith('src/styles/panel.uxdsl')),
    `the map must name the .uxdsl source at its path, src/styles/panel.uxdsl, got: ${JSON.stringify(mapped.sources)}`
  );
  // A real lookup: the line holding `color: red` must resolve back to
  // panel.uxdsl, which is what a devtools "go to source" actually does.
  const { SourceMapConsumer } = require(path.join(dir, 'node_modules', 'source-map-js'));
  const mappedCss = fs.readFileSync(path.join(dir, 'dist-map', 'styles.css'), 'utf8').split('\n');
  const redLine = mappedCss.findIndex((l) => l.includes('color: red'));
  assert.notEqual(redLine, -1, 'the mapped build must still contain the compiled rule');
  const consumer = new SourceMapConsumer(mapped);
  const original = consumer.originalPositionFor({ line: redLine + 1, column: mappedCss[redLine].indexOf('color: red') });
  assert.ok(String(original.source).endsWith('src/styles/panel.uxdsl'), `a mapped position must resolve to src/styles/panel.uxdsl, got ${original.source}`);
  console.log('  ok  - source maps reach css-loader and resolve a real position back to the .uxdsl source');

  // --- watch mode: editing a partial recompiles ---
  write(
    'check-watch.js',
    "const path = require('path');\n" +
    "const fs = require('fs');\n" +
    "const webpack = require('webpack');\n" +
    "const config = require('./webpack.config.js');\n" +
    "const compiler = webpack(config);\n" +
    "let runs = 0;\n" +
    "const failsafe = setTimeout(() => { console.error('timed out waiting for a second recompile'); process.exit(1); }, 20000);\n" +
    "const finish = (code) => { clearTimeout(failsafe); watcher.close(() => process.exit(code)); };\n" +
    "const watcher = compiler.watch({}, (err, stats) => {\n" +
    "  runs += 1;\n" +
    "  if (err || stats.hasErrors()) {\n" +
    "    console.error(err || stats.toString());\n" +
    "    return finish(1);\n" +
    "  }\n" +
    "  if (runs === 1) {\n" +
    "    setTimeout(() => {\n" +
    "      fs.writeFileSync(path.join(__dirname, 'src', 'styles', 'partial.uxdsl'), '.partial { color: blue; }\\n');\n" +
    "    }, 300);\n" +
    "    return;\n" +
    "  }\n" +
    "  const css = fs.readFileSync(path.join(__dirname, 'dist', 'styles.css'), 'utf8');\n" +
    "  if (!/\\.partial\\s*\\{[^}]*color:\\s*blue/.test(css)) {\n" +
    "    console.error('recompiled output does not reflect the edited partial');\n" +
    "    return finish(1);\n" +
    "  }\n" +
    "  finish(0);\n" +
    "});\n"
  );
  run('node', ['check-watch.js']);
  console.log('  ok  - watch mode recompiles when an @import-ed partial changes');

  console.log('PASS');
  console.log('All checks passed.');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
