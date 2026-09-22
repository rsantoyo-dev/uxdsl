'use strict';

// MIG-B6-20 (FEAT-008) acceptance gate: uxdsl-webpack-loader installed from
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
    names: ['postcss-uxdsl', 'uxdsl-core', 'uxdsl-webpack-loader'],
    tmpPrefix: 'uxdsl-webpack-adapter-',
    consumerPkg: { name: 'uxdsl-webpack-adapter-consumer', version: '1.0.0', private: true },
  });
  run('npm', ['install', 'webpack@^5', 'webpack-cli@^5', 'css-loader@^7', 'mini-css-extract-plugin@^2', '--no-audit', '--no-fund']);

  write('uxdsl.theme.config.cjs', "module.exports = { theme: { palette: { adapteronlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } } };\n");
  write('partial.uxdsl', '.partial { color: green; }\n');
  write('panel.uxdsl', '@import "./partial.uxdsl";\n.a { color: red; padding: xs(1rem) md(2rem); background: palette(adapteronlybrand); }\n');
  write('main.js', "import './panel.uxdsl';\n");
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
    "      use: [MiniCssExtractPlugin.loader, 'css-loader', { loader: 'uxdsl-webpack-loader', options: { includeTheme: false, breakpoints: { xs: 0, md: 900 } } }],\n" +
    "    }],\n" +
    "  },\n" +
    "  plugins: [new MiniCssExtractPlugin({ filename: 'styles.css' })],\n" +
    "  optimization: { minimize: false },\n" +
    "};\n"
  );

  // --- build with css-loader + MiniCssExtractPlugin ---
  run(path.join(dir, 'node_modules/.bin/webpack'), ['build']);
  const cssPath = path.join(dir, 'dist', 'styles.css');
  assert.ok(fs.existsSync(cssPath), 'MiniCssExtractPlugin must produce a real dist/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /\.a\s*\{[^}]*color:\s*red/, 'extracted CSS must contain the compiled rule');
  assert.match(css, /900px/, "the loader's own options (breakpoints via getOptions()) must take effect");
  assert.match(css, /\.partial\s*\{[^}]*color:\s*green/, '@import-ed partial must be inlined into the same output');
  assert.match(css, /--uxdsl__palette__adapteronlybrand-main/, "the project's uxdsl.theme.config.cjs must be discovered and applied");
  console.log('  ok  - css-loader + MiniCssExtractPlugin produce a real CSS file with the compiled rules, options and theme applied');

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
    "      use: [MiniCssExtractPlugin.loader, { loader: 'css-loader', options: { sourceMap: true } }, { loader: 'uxdsl-webpack-loader', options: { includeTheme: false, breakpoints: { xs: 0, md: 900 } } }],\n" +
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
  assert.ok(
    mapped.sources.some((src) => String(src).endsWith('panel.uxdsl')),
    `the map must name the .uxdsl source, got: ${JSON.stringify(mapped.sources)}`
  );
  // A real lookup: the line holding `color: red` must resolve back to
  // panel.uxdsl, which is what a devtools "go to source" actually does.
  const { SourceMapConsumer } = require(path.join(dir, 'node_modules', 'source-map-js'));
  const mappedCss = fs.readFileSync(path.join(dir, 'dist-map', 'styles.css'), 'utf8').split('\n');
  const redLine = mappedCss.findIndex((l) => l.includes('color: red'));
  assert.notEqual(redLine, -1, 'the mapped build must still contain the compiled rule');
  const consumer = new SourceMapConsumer(mapped);
  const original = consumer.originalPositionFor({ line: redLine + 1, column: mappedCss[redLine].indexOf('color: red') });
  assert.ok(String(original.source).endsWith('panel.uxdsl'), `a mapped position must resolve to panel.uxdsl, got ${original.source}`);
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
    "      fs.writeFileSync(path.join(__dirname, 'partial.uxdsl'), '.partial { color: blue; }\\n');\n" +
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
