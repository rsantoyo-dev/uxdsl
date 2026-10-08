#!/usr/bin/env node
'use strict';

// Rewrites the spellings stability phase 3 removed to the canonical grammar:
//
//   rounded(k)               -> radius(k)
//   elevation(k)             -> shadow(k)
//   radius(full)             -> radius(pill)
//   palette(family-variant)  -> palette(family.variant)   (alpha kept)
//   color(family-shade)      -> color(family.shade)
//   @ds-x (args) / @ds-x args; / @ds-x(a, b) / @ds-x("a")
//                            -> @ds-x(a b)
//   --uxdsl__typography__<role>-size / -line / -weight / -spacing / -transform / -decoration / -style
//                            -> -font-size / -line-height / -font-weight / -letter-spacing / -text-transform / -text-decoration / -font-style
//
// Usage:
//   node node_modules/uxdsl/scripts/codemod-canonical-grammar.js [--write] [--theme uxdsl.theme.json] <paths…>
//
// A path is a file or a directory (walked for .uxdsl .css .scss .ts .tsx .js .jsx .mdx .md
// .json; node_modules, dist and .next are skipped). Without --write it only reports.
//
// A dashed palette()/color() argument is rewritten only when the split is
// unambiguous against the theme: `palette(primary-main)` becomes
// `palette(primary.main)` because `primary` is a family and `main` one of its
// variants; `palette(text-primary)` becomes `palette(text.primary)` for the same
// reason. A family whose own name contains a dash (`palette(brand-blue)`,
// where `brand-blue` is the family) is left alone, as is anything the theme
// does not know, and every such case is reported so it can be decided by hand.
// The theme is the packaged base merged with `--theme` (a JSON file or a
// `.js`/`.cjs` module exporting the theme object), so a project's own families
// and colors count.
//
// `densities(…)` has no mechanical rewrite (it needs a Density token in the
// theme); occurrences are reported.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const write = args.includes('--write');
const themeIndex = args.indexOf('--theme');
const themePath = themeIndex === -1 ? null : args[themeIndex + 1];
const targets = args.filter((arg, i) => !arg.startsWith('--') && i !== themeIndex + 1);
if (!targets.length) {
  console.error('usage: codemod-canonical-grammar.js [--write] [--theme uxdsl.theme.json] <paths…>');
  process.exit(2);
}

function loadRuntime() {
  try { return require('uxdsl/theme'); } catch (_) { return require(path.join(__dirname, '../dist/entries/theme')); }
}
const { resolveTheme } = loadRuntime();
const override = themePath ? require(path.resolve(themePath)) : {};
const theme = resolveTheme(override.theme && !override.palette ? override.theme : override);
const palette = theme.palette || {};
const colors = theme.colors || {};

const EXTENSIONS = new Set(['.uxdsl', '.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.mdx', '.md', '.json']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git', 'out', 'build']);

function* files(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) { yield target; return; }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (EXTENSIONS.has(path.extname(entry.name))) yield full;
  }
}

/** `family-variant` -> `family.variant` when the theme makes the split unambiguous. */
function dotted(kind, key) {
  const map = kind === 'palette' ? palette : colors;
  if (key.includes('.') || !key.includes('-')) return null;
  if (Object.prototype.hasOwnProperty.call(map, key)) return null; // a dashed family, as written
  const candidates = [];
  const parts = key.split('-');
  for (let i = 1; i < parts.length; i++) {
    const family = parts.slice(0, i).join('-');
    const variant = parts.slice(i).join('-');
    const entry = map[family];
    if (entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, variant)) candidates.push(`${family}.${variant}`);
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0 && kind === 'color' && /^[a-z]+-\d+$/.test(key)) return key.replace('-', '.');
  return candidates.length > 1 ? { ambiguous: candidates } : null;
}

const DIRECTIVES = ['ds-surface', 'ds-button', 'ds-input', 'ds-typo'];

function rewrite(text, report) {
  let out = text;
  const count = (label, n) => { if (n) report.push([label, n]); };
  let n;
  out = out.replace(/\brounded\(/g, () => { n = (n || 0) + 1; return 'radius('; }); count('rounded() -> radius()', n); n = 0;
  out = out.replace(/\belevation\(/g, () => { n++; return 'shadow('; }); count('elevation() -> shadow()', n); n = 0;
  out = out.replace(/\bradius\(\s*full\s*\)/g, () => { n++; return 'radius(pill)'; }); count('radius(full) -> radius(pill)', n); n = 0;
  const unresolved = [];
  out = out.replace(/\b(palette|color)\(\s*([a-z][a-z0-9-]*)\s*(,[^()]*)?\)/gi, (match, fn, key, alpha) => {
    const kind = fn.toLowerCase();
    const result = dotted(kind, key.toLowerCase());
    if (!result) return match;
    if (typeof result !== 'string') { unresolved.push(`${match} (ambiguous: ${result.ambiguous.join(' or ')})`); return match; }
    n++;
    return `${fn}(${result}${alpha || ''})`;
  });
  count('palette()/color() dashed -> dotted', n); n = 0;
  for (const item of unresolved) report.push(['unresolved', item]);
  for (const name of DIRECTIVES) {
    // `@ds-x (args)`, `@ds-x args;` and `@ds-x args {` -> `@ds-x(args)`.
    out = out.replace(new RegExp(`@${name}\\s+\\(([^)]*)\\)`, 'gi'), (match, inner) => { n++; return `@${name}(${inner})`; });
    out = out.replace(new RegExp(`@${name}\\s+([a-z][^;{}()\\n]*?)\\s*(?=[;}\\n])`, 'gi'), (match, inner) => { n++; return `@${name}(${inner.trim()})`; });
    out = out.replace(new RegExp(`@${name}\\(([^)]*)\\)`, 'gi'), (match, inner) => {
      // Template literals and Sass interpolation (`${…}`, `#{…}`) are code, not arguments.
      if (/[$#]\{/.test(inner)) return match;
      let next = inner.replace(/["']/g, '');
      next = next.replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (next !== inner) n++;
      return `@${name}(${next})`;
    });
  }
  count('directive arguments', n); n = 0;
  const TYPOGRAPHY_SUFFIXES = { size: 'font-size', line: 'line-height', weight: 'font-weight', spacing: 'letter-spacing', transform: 'text-transform', decoration: 'text-decoration', style: 'font-style' };
  out = out.replace(/(--uxdsl__typography__[a-z0-9-]*?)-(size|line|weight|spacing|transform|decoration|style)\b(?!-)/g, (match, head, suffix) => { n++; return `${head}-${TYPOGRAPHY_SUFFIXES[suffix]}`; });
  count('typography variable suffixes', n); n = 0;
  const densities = (out.match(/\bdensities\(/g) || []).length;
  if (densities) report.push(['unresolved', `densities(…) ×${densities}: define a Density token in the theme and use density(k)`]);
  return out;
}

let changed = 0;
let total = 0;
for (const target of targets) {
  for (const file of files(path.resolve(target))) {
    const before = fs.readFileSync(file, 'utf8');
    const report = [];
    const after = rewrite(before, report);
    if (after === before && !report.length) continue;
    total++;
    const rel = path.relative(process.cwd(), file);
    console.log(`${after === before ? '  ' : write ? 'W ' : '~ '}${rel}`);
    for (const [label, detail] of report) console.log(`     ${label}${typeof detail === 'number' ? ` ×${detail}` : `: ${detail}`}`);
    if (after !== before) {
      changed++;
      if (write) fs.writeFileSync(file, after);
    }
  }
}
console.log(`${changed} file(s) ${write ? 'rewritten' : 'would change'} (${total} with findings). ${write ? '' : 'Run again with --write to apply.'}`);
