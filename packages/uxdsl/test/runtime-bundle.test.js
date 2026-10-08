'use strict';

// Stability phase 4 (audit R5): `uxdsl/runtime` is what a browser app ships,
// so it must not carry the CSS parser. This bundles the entry the way an app's
// bundler would — esbuild, for the browser, minified — and reads esbuild's own
// metafile: no module of the `postcss` package may be in it, and no Node
// built-in (esbuild fails the browser build on one). `uxdsl/theme` is held to
// the same rule, since it is the isomorphic half (SSR and the browser). The
// byte budget is the guard against the parser coming back through a side door.
//
// Before this phase the five runtime functions bundled to 159,440 bytes
// minified (50,816 gzip), 28 of the 65 input modules being PostCSS.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const zlib = require('node:zlib');
const esbuild = require('esbuild');

const PKG_DIR = path.resolve(__dirname, '..');

async function bundle(specifier, exportsList) {
  const result = await esbuild.build({
    stdin: { contents: `export { ${exportsList.join(', ')} } from '${specifier}';`, resolveDir: PKG_DIR, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].contents;
  const inputs = Object.keys(result.metafile.inputs);
  return { bytes: code.length, gzip: zlib.gzipSync(code).length, inputs, code: Buffer.from(code).toString('utf8') };
}

const isPostcss = (input) => /(^|\/)node_modules\/postcss\//.test(input);

const RUNTIME = ['applyTheme', 'getAppliedTheme', 'resetTheme', 'subscribeTheme', 'loadPersistedTheme'];
const THEME = ['resolveTheme', 'deepMergeTheme', 'validateTheme', 'generateThemeCss', 'checkThemeContrast', 'googleFontsImportUrls', 'KNOWN_THEME_FAMILIES', 'DEFAULT_BREAKPOINTS'];

test('phase 4: a browser bundle of uxdsl/runtime contains no PostCSS module', async () => {
  const { bytes, gzip, inputs } = await bundle('uxdsl/runtime', RUNTIME);
  const postcssInputs = inputs.filter(isPostcss);
  assert.deepEqual(postcssInputs, [], `PostCSS reached the runtime bundle through:\n${postcssInputs.join('\n')}`);
  // The value parser is the language's own tokenizer and is browser-safe; it is
  // the one dependency the runtime is expected to carry.
  assert.ok(inputs.some((input) => /node_modules\/postcss-value-parser\//.test(input)), 'control: the bundle resolved its dependencies at all');
  console.log(`# uxdsl/runtime: ${bytes} bytes minified, ${gzip} gzip, ${inputs.length} modules`);
  assert.ok(bytes < 110000, `uxdsl/runtime bundles to ${bytes} bytes minified; the budget is 110,000`);
});

test('phase 4: a browser bundle of uxdsl/theme contains no PostCSS module either', async () => {
  const { bytes, gzip, inputs } = await bundle('uxdsl/theme', THEME);
  assert.deepEqual(inputs.filter(isPostcss), []);
  console.log(`# uxdsl/theme: ${bytes} bytes minified, ${gzip} gzip, ${inputs.length} modules`);
});

test('phase 4: negative control — the engine entry does carry PostCSS (inspectReferences reads a PostCSS root), and the check sees it', async () => {
  const { inputs } = await bundle('uxdsl/engine', ['inspectReferences']);
  assert.ok(inputs.some(isPostcss), 'the detector must find PostCSS where it really is, or the two tests above prove nothing');
});

test('phase 4: the bundled runtime applies a theme in a document, with no Node globals', async () => {
  const { code } = await bundle('uxdsl/runtime', RUNTIME);
  const elements = new Map();
  const fakeDocument = {
    createElement: (tag) => ({ tagName: tag.toUpperCase(), id: '', textContent: '', setAttribute() {}, getAttribute: () => null }),
    getElementById: (id) => elements.get(id) || null,
    head: { appendChild(node) { elements.set(node.id, node); return node; } },
  };
  // Evaluated as a browser would: a module body with `document` in scope and
  // no `require`, `process`, `Buffer` or `module`.
  const body = code.replace(/export\s*\{([^}]*)\};?\s*$/, (_, list) => `return {${list.split(',').map((pair) => {
    const [local, exported] = pair.trim().split(/\s+as\s+/);
    return `${exported || local}: ${local}`;
  }).join(', ')}};`);
  // eslint-disable-next-line no-new-func
  const runtime = new Function('document', 'require', 'process', 'Buffer', 'module', body)(fakeDocument, undefined, undefined, undefined, undefined);
  const init = runtime.applyTheme({}, { replace: true });
  assert.equal(init.ok, true, init.ok ? '' : init.error.message);
  const value = runtime.applyTheme({ palette: { primary: { main: '#0ea5e9' } } });
  assert.equal(value.ok, true, value.ok ? '' : value.error.message);
  assert.match(elements.get('uxdsl-theme').textContent, /--uxdsl__palette__primary-main: #0ea5e9/);
  const dangling = runtime.applyTheme({ palette: { primary: { main: 'color(nope.500)' } } });
  assert.equal(dangling.ok, false, 'a dangling reference is still refused in the browser');
  assert.match(dangling.error.message, /UXD_REFERENCE_MISSING|UXD_/);
});
