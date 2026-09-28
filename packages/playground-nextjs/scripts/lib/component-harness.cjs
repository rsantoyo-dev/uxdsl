'use strict';

// MIG-B7-09 (FEAT-009): a component-test harness for the playground.
//
// The playground had none, which is why ThemeContext.tsx — the one component
// with real logic — was tested only through the pieces extracted from it
// (src/lib/theme-scheduler.js). This keeps the runner the package already uses,
// `node --test`, and adds only what a component needs to run: a DOM (jsdom), a
// way to render and query it (React Testing Library), and a transform for TSX
// (esbuild). No second test runner, no Babel/SWC config, and nothing that
// touches the Next.js build.
//
// A component is bundled *from its own source* on every load: relative imports
// (the scheduler, themes.js and its JSON) are inlined, while every bare import
// (react, postcss-uxdsl/ds-runtime) stays external and resolves from this
// package's node_modules — so the component and the test share one React, and
// the runtime under test is the built package, not a copy of it.

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');

const PACKAGE_DIR = path.resolve(__dirname, '..', '..');

/**
 * Installs a fresh jsdom document as the global one. `pretendToBeVisual` gives it
 * a real requestAnimationFrame; `matchMedia` is stubbed because jsdom has none and
 * ThemeContext reads it to pick the initial mode.
 */
function installDom() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
  }
  const names = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'Event', 'CustomEvent', 'localStorage'];
  for (const name of names) {
    Object.defineProperty(globalThis, name, { value: window[name], configurable: true, writable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

/**
 * Bundles a TSX/TS component and returns its exports. `transform`, when given,
 * rewrites the source text first — used to load a deliberately broken copy so a
 * test can prove it would catch the regression.
 */
function loadComponent(relPath, { transform } = {}) {
  const file = path.join(PACKAGE_DIR, relPath);
  let contents = fs.readFileSync(file, 'utf8');
  if (transform) {
    const rewritten = transform(contents);
    if (rewritten === contents) throw new Error(`transform did not change ${relPath}; the mutation it describes no longer matches the source`);
    contents = rewritten;
  }
  const { outputFiles } = esbuild.buildSync({
    stdin: { contents, resolveDir: path.dirname(file), sourcefile: file, loader: /\.tsx$/.test(file) ? 'tsx' : 'ts' },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    // Compile against the package as installed, not through the tsconfig `paths`
    // that point the Next.js build at the runtime's TypeScript source.
    tsconfigRaw: { compilerOptions: {} },
    logLevel: 'silent',
  });
  const filename = path.join(path.dirname(file), `.${path.basename(file)}.bundle.cjs`);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(outputFiles[0].text, filename);
  return mod.exports;
}

module.exports = { installDom, loadComponent, PACKAGE_DIR };
