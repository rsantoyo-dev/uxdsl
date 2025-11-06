// Vite plugin to load and transform `.uxdsl` files via PostCSS
// - Strips `//` line comments
// - Runs `postcss-uxdsl` to handle variables
// - Injects resulting CSS into the document at runtime

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
let processUxdsl;
try {
  processUxdsl = require('uxdsl-core');
} catch (err) {
  try {
    const resolved = require.resolve('uxdsl-core', { paths: [__dirname] });
    processUxdsl = require(resolved);
  } catch {
    // Fallback for monorepo/dev setups where the package isn't installed yet
    const localPath = path.resolve(__dirname, '../uxdsl-core');
    processUxdsl = require(localPath);
  }
}

let projectRoot = process.cwd();
let isDev = false;

function resolveDefaultThemeFile() {
  try {
    const pkgPath = require.resolve('postcss-uxdsl');
    const resolvedDir = path.dirname(pkgPath); // may be package root or dist/
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, 'package.json'))
      ? resolvedDir
      : path.resolve(resolvedDir, '..');
    const candidates = [
      // package root src (monorepo/dev)
      path.resolve(pkgRoot, 'src/theme/default-palette.css'),
      // package root dist (published)
      path.resolve(pkgRoot, 'dist/theme/default-palette.css'),
      // resolved dir sibling 'theme' (if main points to dist/index.js and theme shipped alongside)
      path.resolve(resolvedDir, 'theme/default-palette.css'),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) return f;
    }
  } catch {}
  return '';
}

function getPostcss() {
  // Try local resolution first
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    return require('postcss');
  } catch {}
  // Try requiring from the app root (Vite project)
  try {
    const appRequire = createRequire(path.join(projectRoot, 'package.json'));
    return appRequire('postcss');
  } catch {}
  // Try CWD as fallback
  try {
    const appRequire = createRequire(path.join(process.cwd(), 'package.json'));
    return appRequire('postcss');
  } catch {}
  throw new Error(
    "vite-plugin-uxdsl: Cannot find 'postcss'. Please add it to your app devDependencies (e.g. npm i -D postcss)."
  );
}

function stripLineComments(input) {
  // Remove // comments naively, line-by-line, ignoring those inside quotes
  return input
    .split(/\r?\n/g)
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length - 1; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        if (ch === '"' && !inSingle) inDouble = !inDouble;
        if (!inSingle && !inDouble && line[i] === '/' && line[i + 1] === '/') {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

function uxdslPlugin(userOptions = {}) {
  return {
    name: 'vite-plugin-uxdsl',
    enforce: 'pre',
    configResolved(config) {
      projectRoot = config.root || projectRoot;
      isDev = config.command === 'serve' || config.mode === 'development';
    },
    resolveId(id, importer) {
      if (id && id.endsWith('.uxdsl')) {
        return path.isAbsolute(id) ? id : path.resolve(path.dirname(importer || ''), id);
      }
      return null;
    },
    async load(id) {
      if (!id.endsWith('.uxdsl')) return null;

      const source = fs.readFileSync(id, 'utf-8');

      // Process with core
      const css = await processUxdsl(source, { ...userOptions, fileId: id });

      const finalCss = css + (isDev ? `\n/*# sourceURL=${id} */` : '');

      // Load default palette CSS and watch it in dev so edits apply live
      let themeCss = '';
      const themeFile = resolveDefaultThemeFile();
      if (themeFile) {
        try { this.addWatchFile(themeFile); } catch {}
        try { themeCss = fs.readFileSync(themeFile, 'utf-8'); } catch {}
      }

      // Inject CSS at runtime, replacing existing tag on HMR to avoid duplicates
      const code = `const css = ${JSON.stringify(finalCss)};\n` +
        `const themeCss = ${JSON.stringify(themeCss)};\n` +
        `if (typeof document !== 'undefined') {\n` +
        `  if (themeCss) {\n` +
        `    let t = document.querySelector('style[data-uxdsl-theme="default-palette"]');\n` +
        `    if (!t) { t = document.createElement('style'); t.setAttribute('data-uxdsl-theme', 'default-palette'); document.head.appendChild(t); }\n` +
        `    if (t.textContent !== themeCss) t.textContent = themeCss;\n` +
        `  }\n` +
        `  const sel = 'style[data-uxdsl=' + JSON.stringify(${JSON.stringify(id)}) + ']';\n` +
        `  let s = document.querySelector(sel);\n` +
        `  if (!s) {\n` +
        `    s = document.createElement('style');\n` +
        `    s.setAttribute('data-uxdsl', ${JSON.stringify(id)});\n` +
        (isDev ? `    s.setAttribute('data-source-url', ${JSON.stringify(id)});\n` : '') +
        `    document.head.appendChild(s);\n` +
        `  }\n` +
        `  s.textContent = css;\n` +
        `}\n` +
        `export default css;`;

      return { code, map: null };
    },
  };
}

module.exports = uxdslPlugin;
module.exports.default = uxdslPlugin;
