#!/usr/bin/env node
'use strict';

// Rewrites the spellings stability phase 3 removed to the canonical grammar:
//
//   rounded(k)               -> radius(k)
//   elevation(k)             -> shadow(k)
//   radius(full)             -> radius(pill)
//   palette(family-variant)  -> palette(family.variant)   (alpha kept)
//   color(family-shade)      -> color(family.shade)
//   @ds-x (args) / @ds-x args; / @ds-x(a, b) / @ds-x("a") / @ds-x(a, radius(2))
//                            -> @ds-x(a b)
//   --uxdsl__typography__<role>-size / -line / -weight / -spacing / -transform / -decoration / -style
//                            -> -font-size / -line-height / -font-weight / -letter-spacing / -text-transform / -text-decoration / -font-style
//
// Usage:
//   node node_modules/uxdsl/scripts/codemod-canonical-grammar.js [--write] [--theme uxdsl.theme.json] <paths…>
//
// Flags and paths may come in any order: every argument that is not a flag,
// and not the file after --theme, is a path. A path is a file or a directory
// (walked for .uxdsl .css .scss .ts .tsx .js .jsx .mdx .md .json; node_modules,
// dist and .next are skipped). Without --write it only reports.
//
// A typography variable is renamed only when its name does not already end in
// a CSS property name the engine gives typography variables (font-family,
// font-size, line-height, font-weight, letter-spacing, text-transform,
// text-decoration, font-style, margin-block-start, margin-block-end), so a
// second run changes nothing. A name with a former suffix inside it
// (`…-size-sm`, `…-size_x`) is left. A name such as
// `--uxdsl__typography__body-text-transform` reads both ways: role `body`'s
// `text-transform`, or role `body-text`'s former `-transform`. It is left as
// a canonical name, and, as the run leaves it, reported when the theme
// defines the role its former reading names (`body-text`), so it can be
// decided by hand.
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
// A directive's arguments are read to the matching parenthesis, function calls
// included, and in the form without parentheses to `;`, `}` or the end of the
// line. Their quotes are removed first, an escaped quote (`\"`, `\'`) with its
// backslash so a JSON or JavaScript string stays valid, and every rewrite above
// then applies to them in the same run. Inside the parentheses the commas
// become spaces, so an alpha there follows a space (`palette(primary.main 0.5)`).
//
// `densities(…)` has no mechanical rewrite (it needs a Density token in the
// theme); occurrences are reported.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const write = args.includes('--write');
const themeIndex = args.indexOf('--theme');
const themePath = themeIndex === -1 ? null : args[themeIndex + 1];
const targets = args.filter((arg, i) => !arg.startsWith('--') && (themeIndex === -1 || i !== themeIndex + 1));
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
const typographyRoles = theme.typography_details || {};

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
// A directive's arguments in parentheses: the text to the matching `)`, with
// up to two levels of nested calls, never across `;`, `{` or `}`. Where that
// does not match (an unclosed or deeper parenthesis, an interpolation), the
// text to the first `)`.
const ARGS = '\\(((?:[^;{}()]|\\((?:[^;{}()]|\\([^;{}()]*\\))*\\))*)\\)';
const ARGS_OR_FIRST = `(?:${ARGS}|\\(([^)]*)\\))`;
// The arguments of the form without parentheses: from a letter to `;`, `}` or
// the end of the line, function calls included.
const LINE_ARGS = '([a-z](?:[^;{}()\\n]|\\((?:[^;{}()\\n]|\\([^;{}()\\n]*\\))*\\))*?)';
// A quote, or an escaped quote together with its backslash.
const QUOTE = /\\?["']/g;

// The former typography suffixes and the CSS property each one names.
const TYPOGRAPHY_SUFFIXES = { size: 'font-size', line: 'line-height', weight: 'font-weight', spacing: 'letter-spacing', transform: 'text-transform', decoration: 'text-decoration', style: 'font-style' };
// The CSS property names the engine gives typography variables, in the order
// of the engine's `TYPOGRAPHY_PROPERTIES`. A name ending in one of them is
// canonical and never renamed.
const TYPOGRAPHY_PROPERTIES = ['font-family', 'font-size', 'line-height', 'font-weight', 'letter-spacing', 'text-transform', 'text-decoration', 'font-style', 'margin-block-start', 'margin-block-end'];

function rewrite(text, report) {
  let out = text;
  const count = (label, n) => { if (n) report.push([label, n]); };
  let n;
  // Every directive is brought to `@ds-x(a b)` first, so the token rewrites
  // below see its arguments without quotes and without commas.
  let directives = 0;
  for (const name of DIRECTIVES) {
    // `@ds-x (args)`, `@ds-x args;` and `@ds-x args }` -> `@ds-x(args)`.
    out = out.replace(new RegExp(`@${name}\\s+${ARGS_OR_FIRST}`, 'gi'), (match, args, first) => { directives++; return `@${name}(${args ?? first})`; });
    out = out.replace(new RegExp(`@${name}\\s+${LINE_ARGS}\\s*(?=[;}\\n])`, 'gi'), (match, inner) => { directives++; return `@${name}(${inner.trim()})`; });
    out = out.replace(new RegExp(`@${name}${ARGS_OR_FIRST}`, 'gi'), (match, args, first) => {
      const inner = args ?? first;
      // Template literals and Sass interpolation (`${…}`, `#{…}`) are code, not arguments.
      if (/[$#]\{/.test(inner)) return match;
      const next = inner.replace(QUOTE, '').replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (next !== inner) directives++;
      return `@${name}(${next})`;
    });
  }
  out = out.replace(/\brounded\(/g, () => { n = (n || 0) + 1; return 'radius('; }); count('rounded() -> radius()', n); n = 0;
  out = out.replace(/\belevation\(/g, () => { n++; return 'shadow('; }); count('elevation() -> shadow()', n); n = 0;
  out = out.replace(/\bradius\(\s*full\s*\)/g, () => { n++; return 'radius(pill)'; }); count('radius(full) -> radius(pill)', n); n = 0;
  const unresolved = [];
  const dashed = (match, fn, key, alpha) => {
    const kind = fn.toLowerCase();
    const result = dotted(kind, key.toLowerCase());
    if (!result) return match;
    if (typeof result !== 'string') { unresolved.push(`${match} (ambiguous: ${result.ambiguous.join(' or ')})`); return match; }
    n++;
    return `${fn}(${result}${alpha || ''})`;
  };
  out = out.replace(/\b(palette|color)\(\s*([a-z][a-z0-9-]*)\s*(,[^()]*)?\)/gi, dashed);
  // In a directive's arguments the commas are gone, so an alpha follows a space.
  // The arguments are the same text the directive pass above joined: to the
  // matching `)`, or else to the first one.
  for (const name of DIRECTIVES) {
    out = out.replace(new RegExp(`@${name}${ARGS_OR_FIRST}`, 'gi'), (match) => match.replace(/\b(palette|color)\(\s*([a-z][a-z0-9-]*)(\s+[^()\s][^()]*)\)/gi, dashed));
  }
  count('palette()/color() dashed -> dotted', n); n = 0;
  for (const item of unresolved) report.push(['unresolved', item]);
  count('directive arguments', directives);
  // A typography variable is decided on its whole name: the longest run of
  // `[a-z0-9-]` after the prefix, not followed by a word character or `-`.
  const ambiguousNames = [];
  out = out.replace(/--uxdsl__typography__([a-z0-9-]+)(?![\w-])/g, (match, name) => {
    let next = name;
    if (!TYPOGRAPHY_PROPERTIES.some((property) => name.endsWith(`-${property}`))) {
      const former = /^(.*)-(size|line|weight|spacing|transform|decoration|style)$/.exec(name);
      if (former) { n++; next = `${former[1]}-${TYPOGRAPHY_SUFFIXES[former[2]]}`; }
    }
    // A name that, as the run leaves it, ends in a property name and whose
    // former reading names a role of the theme reads both ways: it is reported.
    const property = TYPOGRAPHY_PROPERTIES.find((p) => next.endsWith(`-${p}`));
    const former = property && /^(.+)-(size|weight|spacing|transform|decoration|style)$/.exec(next);
    if (former && Object.prototype.hasOwnProperty.call(typographyRoles, former[1])) {
      const role = next.slice(0, -property.length - 1);
      ambiguousNames.push(`--uxdsl__typography__${next} (ambiguous: role ${role}'s ${property}, or role ${former[1]}'s former -${former[2]}, now --uxdsl__typography__${former[1]}-${TYPOGRAPHY_SUFFIXES[former[2]]})`);
    }
    return `--uxdsl__typography__${next}`;
  });
  count('typography variable suffixes', n); n = 0;
  for (const item of ambiguousNames) report.push(['unresolved', item]);
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
