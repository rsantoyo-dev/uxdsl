'use strict';

// MIG-B7-16 (FEAT-009): executable documentation examples.
//
// A code example in documentation that nobody compiles is a claim without a
// proof, and it ages silently. This module finds every UXDSL example in the
// documentation surfaces, pairs each one with the theme excerpt the page shows
// for it, and compiles it with the real compiler in packages/uxdsl. There is
// no parser of its own and no default values of its own: what the compiler
// accepts is what an example may show.
//
// The fence language decides first which compiler an example goes through
// (routeOf):
//   - `css`: the PostCSS plugin alone (`uxdsl/postcss`), whatever the code
//     holds. A css example shows what the plugin does with a stylesheet, CSS
//     plus UXDSL, so Sass in it fails as UXD_SASS_CONTEXT unless the example
//     documents that error.
//   - `scss`: compile(), as the file docs/doc-example.uxdsl: Dart Sass, then
//     the plugin. The fence language only chooses the highlighting.
//   - any other language (`uxdsl`, or an example given without one):
//     compile() when the code holds a Sass-only construct (SASS_ONLY), the
//     plugin alone otherwise.
//
// Conventions an example can rely on:
//   - A page that shows a theme excerpt (a JSON block) and then CSS that uses
//     it: the CSS is compiled against that excerpt, merged over the defaults.
//     The excerpt applies until the next `#`/`##` heading.
//   - In an example the plugin compiles, a top-level statement followed on
//     the same line by a comment that BEGINS with a UXD_ code —
//     `/* UXD_DIRECTIVE_CONTEXT: at the document root */` — is expected to
//     FAIL with exactly that code. In such a block every statement is compiled
//     on its own, every other statement must compile, and a statement whose
//     trailing comment is a single `var(--…)` claims that output: the CSS it
//     compiles to must contain it. A block without such a comment is compiled
//     whole and must compile.
//   - An example compile() compiles is compiled whole: PostCSS cannot parse
//     its Sass, and compile() stops at the first error, so the example
//     documents at most one, on a line that ends with a comment beginning with
//     a UXD_ code. It must fail with exactly that code (the error's `code`,
//     else the first code in its message), at that line, and compile with
//     that line removed; without such a line it must compile. A line that
//     ends with a comment that is a single `var(--…)` claims that output: the
//     compiled CSS, without its comments (Dart Sass keeps a `/* … */`
//     comment), must contain it.
//   - `<!-- doc-example: output -->` (markdown only) on the line before a block
//     marks it as compiled output being shown rather than input, and skips it.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const PKG = (name) => path.join(ROOT, 'packages', name);

const postcss = require(require.resolve('postcss', { paths: [PKG('uxdsl')] }));
const load = (rel) => require(path.join(ROOT, rel));

const UXDSL_SYNTAX = /@ds-|@theme\b|\b(?:palette|density|space|color|radius|rounded|border|shadow|elevation)\(|\b(?:xs|sm|md|lg|xl)\(/; // the removed spellings stay listed so an example showing one is compiled (and must document its error)
// A Sass-only construct: it sends an example whose fence is neither css nor scss through compile().
const SASS_ONLY = /@(?:use|forward|mixin|include|function|return|each|for|if|else|while|extend|at-root|content|debug|warn|error)\b|^\s*\$[\w-]+\s*:|#\{|&/m;
const CODE = /\bUXD_[A-Z0-9_]+/;
// In an example compile() compiles: a line that ends with a comment beginning with a UXD_ code
// (the error it documents), and a line that ends with a comment that is a single var(--…) (the output it claims).
const LINE_MARK = /\/\*\s*(UXD_[A-Z0-9_]+)\b(?:(?!\*\/).)*\*\/\s*$/;
const LINE_CLAIM = /\/\*\s*(var\(--[\w-]+\))\s*\*\/\s*$/;
// The file an example compile() compiles is compiled as; it need not exist.
const DOC_EXAMPLE_FILE = path.join(ROOT, 'docs', 'doc-example.uxdsl');

/** The line each character offset falls on (1-based). */
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function looksLikeTheme(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { KNOWN_THEME_FAMILIES } = load('packages/uxdsl/dist/entries/engine');
  return Object.keys(value).some((key) => KNOWN_THEME_FAMILIES.has(key));
}

function parseTheme(code) {
  let value;
  try { value = JSON.parse(code); } catch { return null; } // not JSON: not a theme excerpt
  return looksLikeTheme(value) ? value : null;
}

/** Markdown / MDX: fenced blocks in order, with heading resets. */
function extractMarkdown(text) {
  const events = [];
  const lines = text.split('\n');
  let open = null;
  let skipNext = false;
  lines.forEach((line, i) => {
    if (open) {
      if (new RegExp(`^${open.indent}\`\`\`\\s*$`).test(line) || /^\s*```\s*$/.test(line)) {
        events.push({ type: 'block', lang: open.lang, line: open.line, code: open.body.join('\n'), skip: open.skip });
        open = null;
      } else open.body.push(line.startsWith(open.indent) ? line.slice(open.indent.length) : line);
      return;
    }
    const fence = /^(\s*)```([\w-]*)\s*$/.exec(line);
    if (fence) { open = { indent: fence[1], lang: fence[2], line: i + 2, body: [], skip: skipNext }; skipNext = false; return; }
    if (/^\s*<!--\s*doc-example:\s*output\s*-->\s*$/.test(line)) { skipNext = true; return; }
    if (/^#{1,2}\s/.test(line)) events.push({ type: 'reset' });
    if (line.trim() !== '') skipNext = false;
  });
  return events;
}

/** Balanced-parenthesis scan: the text between the `(` at `start` and its match. */
function balanced(text, start) {
  let depth = 0;
  let inString = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) { if (ch === '\\') i++; else if (ch === inString) inString = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') inString = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return text.slice(start + 1, i);
  }
  return null;
}

function firstArgument(args) {
  let depth = 0;
  let inString = null;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (inString) { if (ch === '\\') i++; else if (ch === inString) inString = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') inString = ch;
    else if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) return args.slice(0, i);
  }
  return args;
}

const unescapeTemplate = (raw) => raw.replace(/\\`/g, '`').replace(/\\\\/g, '\\');

/** TSX / JSX: the ways the playground embeds an example as text. */
function extractJsx(text) {
  const found = [];
  const add = (index, lang, code) => found.push({ type: 'block', lang, line: lineOf(text, index), code, index });

  for (const m of text.matchAll(/language-(css|uxdsl|scss|json)">\{`((?:[^`\\]|\\.)*)`\}<\/code>/g)) {
    if (!m[2].includes('${')) add(m.index, m[1], unescapeTemplate(m[2]));
  }
  for (const m of text.matchAll(/<CodeBlock\s+language="(css|uxdsl|scss|json)"\s+code=\{`((?:[^`\\]|\\.)*)`\}/g)) {
    if (!m[2].includes('${')) add(m.index, m[1], unescapeTemplate(m[2]));
  }
  // An example kept in a top-level constant and rendered as `{name}`.
  for (const m of text.matchAll(/language-(css|uxdsl|scss|json)">\{(\w+)\}<\/code>/g)) {
    const constant = new RegExp(`(?:const|let)\\s+${m[2]}\\s*=\\s*\`((?:[^\`\\\\]|\\\\.)*)\``).exec(text);
    if (constant && !constant[1].includes('${')) add(m.index, m[1], unescapeTemplate(constant[1]));
  }
  // A theme excerpt written as an object literal: JSON.stringify({...}, null, 2).
  for (const m of text.matchAll(/language-json">\{JSON\.stringify\(/g)) {
    const args = balanced(text, m.index + m[0].length - 1);
    if (args === null) continue;
    try {
      const value = vm.runInNewContext(`(${firstArgument(args)})`, Object.create(null), { timeout: 200 });
      add(m.index, 'json', JSON.stringify(value, null, 2));
    } catch { /* built from runtime values — not a static example */ }
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

/** Every example in a file, each paired with the theme excerpt shown for it. */
function collectExamples(relPath) {
  const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const events = /\.(md|mdx)$/.test(relPath) ? extractMarkdown(text) : extractJsx(text);
  const examples = [];
  const themes = []; // theme excerpts, in the order shown
  let theme = null;
  for (const event of events) {
    if (event.type === 'reset') { theme = null; continue; }
    const { lang, code, line, skip } = event;
    if (lang === 'json') {
      const parsed = parseTheme(code);
      if (parsed) { theme = parsed; themes.push({ file: relPath, line, theme: parsed }); }
      continue;
    }
    if (!['css', 'scss', 'uxdsl'].includes(lang) || skip || !UXDSL_SYNTAX.test(code)) continue;
    examples.push({ file: relPath, line, lang, code, theme });
  }
  return { examples, themes };
}

/** Splits a block into statements, each with the expectation its trailing comment declares.
 * Every top-level node is a statement — a `@theme { … }` block too, which the compiler
 * rejects, so an example showing one has to document that error. */
function statementsOf(code) {
  const root = postcss.parse(code);
  const out = [];
  root.nodes.forEach((node, i) => {
    if (node.type === 'comment') return;
    const next = root.nodes[i + 1];
    const trailing = next && next.type === 'comment' && next.source.start.line === node.source.end.line ? next.text.trim() : '';
    const expectError = /^(UXD_[A-Z0-9_]+)\b/.exec(trailing);
    const claimsOutput = /^(var\(--[\w-]+\))\s*$/.exec(trailing);
    out.push({ css: String(node), expectCode: expectError && expectError[1], claims: claimsOutput && claimsOutput[1] });
  });
  return out;
}

async function compileWithPlugin(css, theme) {
  const exported = load('packages/uxdsl/dist/plugin');
  const plugin = exported.default || exported;
  return (await postcss([plugin({ theme: theme || {}, includeTheme: false })]).process(css, { from: undefined })).css;
}

async function compileWithPipeline(css, theme) {
  const core = load('packages/uxdsl/dist/entries/index.js');
  const out = await core.compile({ source: css, from: DOC_EXAMPLE_FILE }, { includeTheme: false, theme: theme || {} });
  return typeof out === 'string' ? out : out.css;
}

/** Which compiler an example goes through, `'plugin'` or `'compile'`: the fence language decides first. */
function routeOf({ lang, code }) {
  if (lang === 'css') return 'plugin';
  if (lang === 'scss') return 'compile';
  return SASS_ONLY.test(code) ? 'compile' : 'plugin';
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The location an error message starts with: the plugin's anonymous input, or the file compile() compiles an example as.
const LOCATION = new RegExp(`^(?:uxdsl: )?(?:<css input>|${escapeRegExp(DOC_EXAMPLE_FILE)}):\\d+:\\d+: `);

/** The error's UXD_ code: its `code` property when it is one (UXD_SASS), else the first code in its message. */
const errorCode = (error) => (error && typeof error.code === 'string' && /^UXD_[A-Z0-9_]+$/.test(error.code) ? error.code : (CODE.exec(String((error && error.message) || error)) || [])[0] || null);
const firstLine = (error) => String((error && error.message) || error).split('\n')[0].replace(LOCATION, '').slice(0, 160);
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** An example compile() compiles: whole, documenting at most one error (see the conventions above). */
async function runCompiled(code, theme) {
  const lines = code.split('\n');
  const marks = [];
  const claims = [];
  lines.forEach((text, i) => {
    const mark = LINE_MARK.exec(text);
    if (mark) marks.push({ line: i + 1, code: mark[1] });
    const claim = LINE_CLAIM.exec(text);
    if (claim) claims.push(claim[1]);
  });
  if (marks.length > 1) {
    return [`documents ${marks.length} errors (lines ${marks.map((m) => m.line).join(', ')}); compile() stops at the first, so an example it compiles documents one`];
  }
  let source = code;
  if (marks.length === 1) {
    const [mark] = marks;
    let failure = null;
    try { await compileWithPipeline(code, theme); } catch (error) { failure = error; }
    if (!failure) return [`line ${mark.line} is documented as ${mark.code} but the example compiles`];
    const got = errorCode(failure);
    if (got !== mark.code) return [`line ${mark.line} is documented as ${mark.code} but the example fails with ${got || firstLine(failure)}`];
    if (failure.line !== mark.line) return [`line ${mark.line} is documented as ${mark.code}, but compile() reports it at line ${failure.line}`];
    source = lines.filter((_, i) => i + 1 !== mark.line).join('\n');
  }
  let output;
  try { output = withoutComments(await compileWithPipeline(source, theme)); } catch (error) {
    return [marks.length ? `without line ${marks[0].line}, the example fails to compile: ${firstLine(error)}` : `fails to compile as shown: ${firstLine(error)}`];
  }
  return claims.filter((claim) => !output.includes(claim)).map((claim) => `is documented as producing ${claim} but does not`);
}

/** Runs one example. Returns a list of problems; empty means it holds. */
async function runExample(example) {
  const { code, theme } = example;
  if (routeOf(example) === 'compile') return runCompiled(code, theme);
  let root;
  try { root = postcss.parse(code); } catch (error) { return [`does not parse as CSS: ${firstLine(error)}`]; }

  const marked = root.nodes.some((n, i) => {
    const next = root.nodes[i + 1];
    return n.type !== 'comment' && next && next.type === 'comment' && next.source.start.line === n.source.end.line && /^UXD_[A-Z0-9_]+\b/.test(next.text.trim());
  });
  if (!marked) {
    try { await compileWithPlugin(code, theme); return []; } catch (error) { return [`fails to compile as shown: ${firstLine(error)}`]; }
  }

  const problems = [];
  for (const st of statementsOf(code)) {
    let output = null;
    let failure = null;
    try { output = await compileWithPlugin(st.css, theme); } catch (error) { failure = error; }
    if (st.expectCode) {
      if (!failure) problems.push(`\`${st.css.split('\n').pop().slice(0, 70)}\` is documented as ${st.expectCode} but compiles`);
      else if (errorCode(failure) !== st.expectCode) problems.push(`\`${st.css.split('\n').pop().slice(0, 70)}\` is documented as ${st.expectCode} but fails with ${errorCode(failure) || firstLine(failure)}`);
    } else if (failure) problems.push(`\`${st.css.split('\n').pop().slice(0, 70)}\` fails to compile as shown: ${firstLine(failure)}`);
    else if (st.claims && !output.includes(st.claims)) problems.push(`\`${st.css.split('\n').pop().slice(0, 70)}\` is documented as producing ${st.claims} but does not`);
  }
  return problems;
}

/** Runs every example of the given files. Returns { examples, themes, problems }. */
async function verifySurfaces(files) {
  const all = { examples: [], themes: [], problems: [] };
  for (const file of files) {
    const { examples, themes } = collectExamples(file);
    all.examples.push(...examples);
    all.themes.push(...themes);
    for (const example of examples) {
      for (const problem of await runExample(example)) all.problems.push({ file: example.file, line: example.line, problem });
    }
  }
  return all;
}

/** Theme excerpts must themselves be valid themes. One problem per excerpt: a single
 * bad reference cascades into dozens of derived errors, and only the root cause helps. */
function validateThemes(themes) {
  const { validateTheme } = load('packages/uxdsl/dist/entries/engine');
  const problems = [];
  for (const { file, line, theme } of themes) {
    const errors = (validateTheme(theme).errors || []).map((error) => String(error.message || error));
    if (errors.length) problems.push({ file, line, problem: `theme excerpt is invalid (${errors.length} error${errors.length === 1 ? '' : 's'}, first: ${errors[0].slice(0, 170)})` });
  }
  return problems;
}

/** Every documentation surface whose examples are verified. History (CHANGELOG, release
 * records, feature planning) is deliberately excluded: it describes what used to be true. */
function discoverSurfaces() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (['node_modules', '.git', '.next', '.claude', 'dist', 'out', 'fixtures'].includes(entry.name)) continue;
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel); else out.push(rel);
    }
  };
  ['packages', 'docs'].forEach(walk);
  out.push('README.md', 'AGENTS.md');
  return out.filter((f) => /^(README|AGENTS)\.md$/.test(f)
    || /^packages\/[^/]+\/README\.md$/.test(f)
    || f === 'packages/uxdsl/docs/migration.md'
    || /^packages\/uxdsl\/docs\/integrations\/.*\.md$/.test(f)
    || /^docs\/architecture\/.*\.md$/.test(f)
    || /^packages\/playground-nextjs\/src\/.*\.(tsx|mdx)$/.test(f)).sort();
}

module.exports = { ROOT, discoverSurfaces, extractMarkdown, extractJsx, collectExamples, statementsOf, routeOf, runExample, verifySurfaces, validateThemes, parseTheme };
