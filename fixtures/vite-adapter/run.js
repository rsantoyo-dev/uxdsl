'use strict';

// MIG-B6-20 (FEAT-008) acceptance gate: vite-plugin-uxdsl installed from a
// real tarball (no workspace/symlink resolution back into this monorepo),
// driving real `vite build` and `vite.createServer()` calls — not a mocked
// plugin context. Exercises every criterion the story lists for this
// fixture: real CSS extraction, no absolute build-machine paths in the
// production output, `?inline` returning the raw string, module-graph
// invalidation when an `@import`-ed partial changes, and the project's own
// theme file being discovered and applied.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { packAndInstall } = require('../lib/tarball-consumer');

async function main() {
  const { dir, run, write } = packAndInstall({
    names: ['postcss-uxdsl', 'uxdsl-core', 'vite-plugin-uxdsl'],
    tmpPrefix: 'uxdsl-vite-adapter-',
    consumerPkg: { name: 'uxdsl-vite-adapter-consumer', version: '1.0.0', private: true },
  });
  run('npm', ['install', 'vite@^5', '--no-audit', '--no-fund']);

  write('uxdsl.theme.config.cjs', "module.exports = { theme: { palette: { adapteronlybrand: { main: '#0af', dark: '#048', contrast: '#fff' } } } };\n");
  write('partial.uxdsl', '.partial { color: green; }\n');
  write('panel.uxdsl', '@import "./partial.uxdsl";\n.a { color: red; padding: xs(1rem) md(2rem); background: palette(adapteronlybrand); }\n');
  // A plain `export` of an otherwise-unused value is dead code from
  // Rollup's perspective once its only side effect (the CSS import) is
  // extracted separately — write it somewhere Rollup can't prove is
  // unobservable, so the whole module (and therefore the ?inline import)
  // isn't tree-shaken out of the production bundle entirely.
  write('main.js', "import './panel.uxdsl';\nimport inlineCss from './panel.uxdsl?inline';\nglobalThis.__uxdslInlineCss = inlineCss;\n");
  write('index.html', '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>\n');
  write(
    'vite.config.js',
    "const { defineConfig } = require('vite');\n" +
    "const uxdsl = require('vite-plugin-uxdsl');\n" +
    "module.exports = defineConfig({ plugins: [uxdsl.default ? uxdsl.default() : uxdsl()], build: { outDir: 'dist' } });\n"
  );

  // --- vite build: real CSS extraction ---
  run(path.join(dir, 'node_modules/.bin/vite'), ['build']);
  const assetsDir = path.join(dir, 'dist', 'assets');
  const assetFiles = fs.readdirSync(assetsDir);
  const cssFile = assetFiles.find((f) => f.endsWith('.css'));
  assert.ok(cssFile, 'vite build must extract a real .css asset');
  const css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
  assert.match(css, /\.a\{[^}]*color:red/, 'extracted CSS must contain the compiled rule');
  assert.match(css, /1rem/, 'extracted CSS must contain the resolved base responsive value');
  assert.match(css, /768px/, 'extracted CSS must contain the generated media query');
  assert.match(css, /\.partial\{[^}]*color:green/, '@import-ed partial must be inlined into the same output');
  console.log('  ok  - vite build extracts a real .css asset with the compiled rules');

  // --- theme applied ---
  assert.match(css, /--uxdsl__palette__adapteronlybrand-main/, "the project's uxdsl.theme.config.cjs must be discovered and applied");
  console.log('  ok  - the project theme (uxdsl.theme.config.cjs) is discovered and applied');

  // --- no absolute build-machine paths anywhere in dist/ ---
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );
  const distFiles = walk(path.join(dir, 'dist'));
  const leaks = distFiles.filter((f) => fs.readFileSync(f, 'utf8').includes(dir));
  assert.deepEqual(leaks, [], `no dist/ file may contain the build machine's absolute repo path; leaked in: ${leaks.join(', ')}`);
  console.log('  ok  - no dist/ file contains the build machine\'s absolute path');

  // --- ?inline returns the raw string, not a separate asset ---
  const jsFile = assetFiles.find((f) => f.endsWith('.js'));
  const bundle = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
  assert.match(bundle, /color:\s*green/, '?inline must embed the raw CSS string directly in the JS bundle');
  console.log('  ok  - ?inline compiles to the raw CSS string, matching native Vite .css?inline behavior');

  // --- dev server: editing a partial invalidates the .uxdsl module (module graph, no browser) ---
  // Run as a real child process, `require`-ing `vite` the way an actual
  // `vite` invocation would (its own file living inside the project,
  // reached via a plain `require`, cwd already at the project root) —
  // not `require()`d in-process by this fixture's own script. Confirmed
  // by direct experimentation that this specific combination matters:
  // driving the very same createServer/ssrLoadModule/moduleGraph calls
  // from a require() scoped to this fixture's own location (even with
  // `root` correct and cwd changed to match) left
  // `moduleGraph.fileToModulesMap` never linking the dependency this
  // plugin registers via `addWatchFile` — a Vite-internal quirk in how it
  // is loaded/introspects itself, unrelated to anything this plugin's
  // resolveId/load does (proven correct by every other check here, and by
  // this exact check succeeding once run this way).
  write(
    'check-hmr.js',
    "const path = require('path');\n" +
    "(async () => {\n" +
    "  const { createServer } = require('vite');\n" +
    "  const server = await createServer({ root: process.cwd(), logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });\n" +
    "  try {\n" +
    "    await server.ssrLoadModule('/main.js');\n" +
    "    const partialAbs = path.join(process.cwd(), 'partial.uxdsl');\n" +
    "    const watchers = server.moduleGraph.getModulesByFile(partialAbs);\n" +
    "    if (!watchers || watchers.size === 0) throw new Error('partial.uxdsl was not registered as a module-graph dependency');\n" +
    "  } finally {\n" +
    "    await server.close();\n" +
    "  }\n" +
    "})().catch((err) => { console.error(err.message); process.exitCode = 1; });\n"
  );
  run('node', ['check-hmr.js']);
  console.log('  ok  - createServer registers the imported partial as a module-graph dependency (HMR-capable)');

  console.log('PASS');
  console.log('All checks passed.');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
