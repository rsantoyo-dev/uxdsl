/**
 * Core processing engine for UXDSL files.
 *
 * Responsibilities:
 * - Strip simple // line comments outside of quoted strings
 * - Inline @import/@use/import statements that reference .uxdsl files
 * - Invoke the PostCSS UXDSL plugin to transform the resulting CSS text
 *
 * This module exports a single function (CommonJS export) so that
 * consumers can `require('uxdsl-core')` and call it directly.
 */

import fs from 'fs';
import path from 'path';
import postcss, { Result } from 'postcss';

// The UXDSL PostCSS plugin is resolved dynamically. We prefer the local
// monorepo path (../postcss-uxdsl) and fall back to the installed package.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let uxdslPlugin: any;
{
  // Prefer the monorepo local package; account for being run from dist/
  const candidates = [
    path.resolve(__dirname, '../postcss-uxdsl'),
    path.resolve(__dirname, '../../postcss-uxdsl'),
  ];
  let loaded = false;
  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      uxdslPlugin = require(p);
      loaded = true;
      break;
    } catch {}
  }
  if (!loaded) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      uxdslPlugin = require('postcss-uxdsl');
      loaded = true;
    } catch (e) {
      // Re-throw a more actionable message
      throw new Error(
        'uxdsl-core: unable to resolve postcss-uxdsl locally or from dependencies. Ensure packages/postcss-uxdsl is built or installed.'
      );
    }
  }
}

/**
 * Remove // line comments while respecting quoted strings.
 * This is a minimal pre-pass to keep the core example lightweight.
 */
function stripLineComments(input: string): string {
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

/** Options accepted by the core processor. */
interface CoreOptions {
  /** Absolute path of the file being processed; enables @import inlining. */
  fileId?: string;
  /**
   * Additional options are forwarded to the UXDSL PostCSS plugin.
   * Kept as an index signature to avoid type‑coupling the packages.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Inline .uxdsl imports by resolving paths relative to the current file.
 * Detects cycles and throws with a helpful path trace.
 */
function inlineImports(
  fileId: string,
  content: string,
  visited: Set<string> = new Set<string>(),
  stack: string[] = []
): string {
  if (!visited.has(fileId)) visited.add(fileId);
  stack.push(fileId);

  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  const importRe =
    /^\s*(?:@import|@use|import)\s+(?:["']?)([^"';]+\.uxdsl)(?:["']?)\s*;?\s*$/;

  for (const line of lines) {
    const m = line.match(importRe);
    if (m) {
      const rel = m[1];
      const dep = path.resolve(path.dirname(fileId), rel);
      if (fs.existsSync(dep)) {
        if (stack.includes(dep)) {
          const cycleStart = stack.indexOf(dep);
          const cyclePath = stack
            .slice(cycleStart)
            .concat(dep)
            .map((p) => path.relative(process.cwd(), p));
          throw new Error(
            `Circular import detected in UXDSL files: ${cyclePath.join(' -> ')}`
          );
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

/**
 * Process UXDSL source text into final CSS.
 * - Strips // comments
 * - Inlines .uxdsl imports when options.fileId is provided
 * - Executes the PostCSS UXDSL plugin over the resulting text
 */
async function processUxdsl(
  source: string,
  options: CoreOptions = {}
): Promise<string> {
  // 1) Strip comments
  let cleaned = stripLineComments(source);

  // 2) Inline imports when we know the source file location
  if (options.fileId) {
    cleaned = inlineImports(options.fileId, cleaned);
  }

  // 3) Run through PostCSS with the UXDSL plugin
  const result: Result = await postcss([uxdslPlugin(options)]).process(cleaned, {
    from: options.fileId || undefined,
    map: false, // No sourcemaps for this minimal core
  });

  return result.css;
}

// CommonJS export so consumers can do `require('uxdsl-core')`
export = processUxdsl;
