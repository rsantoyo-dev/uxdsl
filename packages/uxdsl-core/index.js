const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const uxdslPlugin = require('postcss-uxdsl');

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

function inlineImports(fileId, content, visited = new Set()) {
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
        const depSrc = fs.readFileSync(dep, 'utf-8');
        const depClean = stripLineComments(depSrc);
        out.push(inlineImports(dep, depClean, visited));
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

async function processUxdsl(source, options = {}) {
  // Strip comments
  let cleaned = stripLineComments(source);

  // Inline imports if fileId is provided
  if (options.fileId) {
    cleaned = inlineImports(options.fileId, cleaned);
  }

  // Process with PostCSS
  const result = await postcss([uxdslPlugin(options)]).process(cleaned, {
    from: options.fileId || undefined,
    map: false, // No sourcemaps for core
  });

  return result.css;
}

module.exports = processUxdsl;