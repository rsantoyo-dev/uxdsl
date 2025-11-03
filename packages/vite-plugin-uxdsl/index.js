// Vite plugin to load and transform `.uxdsl` files via PostCSS
// - Strips `//` line comments
// - Runs `postcss-uxdsl` to handle variables
// - Injects resulting CSS into the document at runtime

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

let projectRoot = process.cwd();
let isDev = false;

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
      const cleaned = stripLineComments(source);

      // Inline simple imports so authors can keep everything in UXDSL only
      const visited = new Set();
      const self = this;
      function inlineImports(fileId, content) {
        visited.add(fileId);
        const lines = content.split(/\r?\n/);
        const out = [];
        const importRe = /^\s*(?:@import|@use|import)\s+(?:["']?)([^"';]+\.uxdsl)(?:["']?)\s*;?\s*$/;
        for (const line of lines) {
          const m = line.match(importRe);
          if (m) {
            const rel = m[1];
            const dep = path.resolve(path.dirname(fileId), rel);
            if (fs.existsSync(dep)) {
              try { self.addWatchFile(dep); } catch {}
              const depSrc = fs.readFileSync(dep, 'utf-8');
              const depClean = stripLineComments(depSrc);
              out.push(inlineImports(dep, depClean));
              continue;
            }
          }
          out.push(line);
        }
        return out.join('\n');
      }
      const inlined = inlineImports(id, cleaned);

      // Lazy require to avoid resolution issues during SSR build
      let uxdsl;
      try {
        // Prefer local workspace build output if present (for live dev)
        const localDist = path.resolve(__dirname, '../postcss-uxdsl/dist/index.js');
        if (fs.existsSync(localDist)) {
          try { delete require.cache[localDist]; } catch {}
          uxdsl = require(localDist);
        } else {
          uxdsl = require('postcss-uxdsl');
        }
      } catch (e) {
        // Last resort: relative require in monorepo structure
        const alt = path.resolve(__dirname, '../postcss-uxdsl/index.js');
        uxdsl = require(alt);
      }

      const postcss = getPostcss();
      // Support CJS default export, ESM default, or direct plugin object
      let pluginInstance;
      if (typeof uxdsl === 'function') {
        pluginInstance = uxdsl(userOptions);
      } else if (uxdsl && typeof uxdsl.default === 'function') {
        pluginInstance = uxdsl.default(userOptions);
      } else if (uxdsl && typeof uxdsl === 'object' && uxdsl.postcss === true) {
        pluginInstance = uxdsl;
      } else {
        throw new Error('vite-plugin-uxdsl: Loaded postcss-uxdsl but it was not a plugin factory');
      }

      const result = await postcss([pluginInstance]).process(inlined, {
        from: id,
        map: isDev ? { inline: true, annotation: false, sourcesContent: true } : false,
      });
      const css = result.css + (isDev ? `\n/*# sourceURL=${id} */` : '');

      // Inject CSS at runtime, replacing existing tag on HMR to avoid duplicates
      const code = `const css = ${JSON.stringify(css)};\n` +
        `if (typeof document !== 'undefined') {\n` +
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
