// Vite plugin to load and transform `.uxdsl` files via PostCSS
// - Strips `//` line comments
// - Runs `postcss-uxdsl` to handle variables
// - Injects resulting CSS into the document at runtime

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

let projectRoot = process.cwd();

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
      const cleaned = stripLineComments(source);

      // Lazy require to avoid resolution issues during SSR build
      let uxdsl;
      try {
        // Prefer local workspace package name
        uxdsl = require('postcss-uxdsl');
      } catch (e) {
        // Fallback: relative require in monorepo
        const alt = path.resolve(__dirname, '../postcss-uxdsl/index.js');
        uxdsl = require(alt);
      }

      const postcss = getPostcss();
      const result = await postcss([uxdsl(userOptions)]).process(cleaned, {
        from: id,
        map: false,
      });
      const css = result.css;

      // Inject CSS at runtime and export it for potential debugging
      const code = `const css = ${JSON.stringify(css)};\n` +
        `if (typeof document !== 'undefined') {\n` +
        `  const s = document.createElement('style');\n` +
        `  s.setAttribute('data-uxdsl', ${JSON.stringify(id)});\n` +
        `  s.textContent = css;\n` +
        `  document.head.appendChild(s);\n` +
        `}\n` +
        `export default css;`;

      return { code, map: null };
    },
  };
}

module.exports = uxdslPlugin;
module.exports.default = uxdslPlugin;
