const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
let uxdslPlugin;
try {
  const localPath = path.resolve(__dirname, '../postcss-uxdsl');
  uxdslPlugin = require(localPath);
} catch (e1) {
  try {
    uxdslPlugin = require('postcss-uxdsl');
  } catch (e2) {
    throw e1;
  }
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

function inlineImports(fileId, content, visited = new Set(), stack = []) {
  if (!visited.has(fileId)) {
    visited.add(fileId);
  }
  stack.push(fileId);
  const lines = content.split(/\r?\n/);
  const out = [];
  const importRe = /^\s*(?:@import|@use|import)\s+(?:["']?)([^"';]+\.uxdsl)(?:["']?)\s*;?\s*$/;
  for (const line of lines) {
    const m = line.match(importRe);
    if (m) {
      const rel = m[1];
      const dep = path.resolve(path.dirname(fileId), rel);
      if (fs.existsSync(dep)) {
        if (stack.includes(dep)) {
          const cycleStart = stack.indexOf(dep);
          const cyclePath = stack.slice(cycleStart).concat(dep).map((p) => path.relative(process.cwd(), p));
          throw new Error(`Circular import detected in UXDSL files: ${cyclePath.join(' -> ')}`);
        }
        if (visited.has(dep)) {
          continue;
        }
        const depSrc = fs.readFileSync(dep, 'utf-8');
        const depClean = stripLineComments(depSrc);
        out.push(inlineImports(dep, depClean, visited, stack));
        continue;
      }
    }
    out.push(line);
  }
  stack.pop();
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
