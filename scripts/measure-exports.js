#!/usr/bin/env node
'use strict';

// Lists every export of the package's entries (values and types) with the
// files that consume it, and the exports nobody consumes.
//
//   node scripts/measure-exports.js          a report per entry
//   node scripts/measure-exports.js --json   the same data as JSON
//
// A consumer is counted by identifier, never by a bare word in the text:
//
// - outside: a file under packages/uxdsl/bin, packages/playground-nextjs/src
//   (.ts, .tsx, and the import/export lines of .mdx), scripts,
//   packages/uxdsl-vscode/src, fixtures (without node_modules) or
//   packages/_deprecated that names the export through an entry: an import or
//   re-export specifier from 'uxdsl', 'uxdsl/<entry>' or a path into
//   packages/uxdsl/{src,dist}/entries; destructuring of, or property access
//   on, a binding of such a require() or import (an object that spreads one
//   included). A function called with one such specifier counts as require():
//   the fixtures load the package through createRequire() functions. A deprecated shim that assigns such a require() or spread to
//   module.exports consumes the names packages/_deprecated/shims.test.js
//   requires that shim to keep (its FORMER table, minus DROPPED), or every
//   name when the table has no row for it.
// - src: a module under packages/uxdsl/src, other than the defining file and
//   entries/, with an identifier the type checker resolves to the export's
//   own declaration.
// - tests: files under packages/uxdsl/test that reach the export through an
//   entry, as for outside. Informational: a test is not a consumer.
// - direct: outside files that import the defining module itself (a path into
//   packages/uxdsl/{src,dist}/<module>), bypassing the entry. Informational.
//
// An export is "zero" when it has no outside and no src consumer.

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const ts = require(require.resolve('typescript', { paths: [path.join(REPO, 'packages/uxdsl')] }));

/** Each entry's public name and the source file that defines it, under packages/uxdsl/src/entries. */
const ENTRIES = { 'uxdsl/engine': 'engine', 'uxdsl/language': 'language', 'uxdsl/theme': 'theme', 'uxdsl/runtime': 'runtime', uxdsl: 'index', 'uxdsl/config': 'config' };

const OUTSIDE_ROOTS = ['packages/uxdsl/bin', 'packages/playground-nextjs/src', 'scripts', 'packages/uxdsl-vscode/src', 'fixtures', 'packages/_deprecated'];
const TEST_ROOT = 'packages/uxdsl/test';
/** Build output and installed packages; hidden directories (.next, .out, .git) are skipped too. */
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'out', 'coverage']);
const CODE = /\.(?:[cm]?js|ts|tsx|jsx|mdx)$/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(full, out);
    } else if (entry.isFile() && CODE.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (root, file) => path.relative(root, file).split(path.sep).join('/');
const stripExt = (file) => file.replace(/\.(?:d\.ts|[cm]?js|ts|tsx)$/, '');

/** Every export of each entry, resolved to the symbol and file that declare it. */
function collectExports(root, entries) {
  const srcDir = path.join(root, 'packages/uxdsl/src');
  const srcFiles = walk(srcDir).filter((file) => /\.ts$/.test(file));
  const program = ts.createProgram(srcFiles, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    resolveJsonModule: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const resolve = (symbol) => (symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
  const result = {};
  for (const [entry, base] of Object.entries(entries)) {
    const file = path.join(srcDir, 'entries', `${base}.ts`);
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) throw new Error(`measure-exports: ${rel(root, file)} is not readable`);
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    const exports = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : [];
    result[entry] = exports
      .map((symbol) => {
        const target = resolve(symbol);
        const declaration = (target.declarations || [])[0];
        return {
          name: symbol.getName(),
          kind: target.flags & ts.SymbolFlags.Value ? 'value' : 'type',
          definedIn: declaration ? rel(srcDir, declaration.getSourceFile().fileName) : '?',
          target,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // src consumers: identifiers the checker resolves to the export's declaration.
  const users = new Map();
  for (const sourceFile of program.getSourceFiles()) {
    const fileName = path.resolve(sourceFile.fileName);
    if (!fileName.startsWith(srcDir + path.sep) || fileName.startsWith(path.join(srcDir, 'entries') + path.sep)) continue;
    const visit = (node) => {
      if (ts.isIdentifier(node)) {
        const symbol = resolve(checker.getSymbolAtLocation(node));
        if (symbol) {
          if (!users.has(symbol)) users.set(symbol, new Set());
          users.get(symbol).add(rel(srcDir, fileName));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  for (const list of Object.values(result)) {
    for (const row of list) {
      row.src = [...(users.get(row.target) || [])].filter((file) => file !== row.definedIn).sort();
    }
  }
  return result;
}

/** The text TypeScript should parse: the whole file, or only the ESM statements of an .mdx page. */
function parseableText(file, text) {
  if (!file.endsWith('.mdx')) return text;
  const chunks = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (current === null && /^(?:import|export)\s/.test(line)) current = [];
    if (current === null) continue;
    current.push(line);
    const joined = current.join('\n');
    if (/from\s*['"][^'"]+['"]\s*;?\s*$/.test(joined) || /^import\s*['"][^'"]+['"]\s*;?\s*$/.test(joined) || /;\s*$/.test(line)) {
      chunks.push(joined);
      current = null;
    }
  }
  return chunks.join('\n');
}

function scriptKind(file) {
  if (file.endsWith('.tsx') || file.endsWith('.mdx') || file.endsWith('.jsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

/** The FORMER and DROPPED tables of shims.test.js, read from its string literals. */
function shimTables(root) {
  const file = path.join(root, 'packages/_deprecated/shims.test.js');
  const tables = { FORMER: {}, DROPPED: {} };
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return tables;
  }
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text in tables && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) continue;
        const key = ts.isStringLiteral(property.name) || ts.isIdentifier(property.name) ? property.name.text : null;
        if (key === null) continue;
        tables[node.name.text][key] = property.initializer.elements.filter(ts.isStringLiteral).map((element) => element.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return tables;
}

/**
 * The names `file` consumes from each entry, and the names it imports from a
 * module of the package directly: { entries: Map<entry, Set<name|'*'>>, direct: Map<module, Set<name|'*'>> }.
 */
function consumedNames(root, file, entries, shims) {
  const text = parseableText(file, fs.readFileSync(file, 'utf8'));
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const pkgDir = path.join(root, 'packages/uxdsl');
  const entryOf = (spec) => {
    if (Object.prototype.hasOwnProperty.call(entries, spec)) return spec;
    let resolved = null;
    if (spec.startsWith('.') || path.isAbsolute(spec)) resolved = path.resolve(path.dirname(file), spec);
    else if (spec.startsWith('uxdsl/')) resolved = path.join(pkgDir, spec.slice('uxdsl/'.length));
    if (resolved === null) return null;
    for (const layer of ['src', 'dist']) {
      const dir = path.join(pkgDir, layer, 'entries');
      for (const [entry, base] of Object.entries(entries)) if (stripExt(resolved) === path.join(dir, base)) return entry;
    }
    return null;
  };
  const moduleOf = (spec) => {
    if (!(spec.startsWith('.') || path.isAbsolute(spec) || spec.startsWith('uxdsl/'))) return null;
    const resolved = spec.startsWith('uxdsl/') ? path.join(pkgDir, spec.slice('uxdsl/'.length)) : path.resolve(path.dirname(file), spec);
    for (const layer of ['src', 'dist']) {
      const dir = path.join(pkgDir, layer) + path.sep;
      if (resolved.startsWith(dir) && !resolved.startsWith(path.join(pkgDir, layer, 'entries') + path.sep)) return stripExt(rel(path.join(pkgDir, layer), resolved));
    }
    return null;
  };

  const consumed = new Map();
  const direct = new Map();
  const add = (map, key, name) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(name);
  };
  /** Binding name → the entries (and modules) it holds the exports of. */
  const bindings = new Map();
  const bind = (name, source) => {
    if (!bindings.has(name)) bindings.set(name, []);
    const list = bindings.get(name);
    if (!list.some((known) => known.kind === source.kind && known.key === source.key)) list.push(source);
  };
  const consume = (source, name) => add(source.kind === 'entry' ? consumed : direct, source.key, name);
  const sourceOf = (spec) => {
    const entry = entryOf(spec);
    if (entry) return { kind: 'entry', key: entry };
    const mod = moduleOf(spec);
    return mod ? { kind: 'module', key: mod } : null;
  };

  const requireSpec = (node) => {
    let current = node;
    while (current && (ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current))) current = current.expression;
    if (!current || !ts.isCallExpression(current) || current.arguments.length !== 1 || !ts.isStringLiteralLike(current.arguments[0])) return null;
    // require(), import(), or any function called with one module specifier:
    // the fixtures load the package through createRequire() functions of many
    // names (req, installed, instrument). Only a specifier that reaches an
    // entry or a package module counts, so a false match can only keep an export.
    const callee = current.expression;
    if (ts.isIdentifier(callee) || callee.kind === ts.SyntaxKind.ImportKeyword) return current.arguments[0].text;
    return null;
  };
  /** The sources an expression holds: a require()/import(), a binding of one, or an object that spreads them. */
  const sourcesOf = (expression) => {
    if (!expression) return [];
    const spec = requireSpec(expression);
    if (spec !== null) {
      const source = sourceOf(spec);
      return source ? [source] : [];
    }
    if (ts.isIdentifier(expression)) return [...(bindings.get(expression.text) || [])];
    if (ts.isObjectLiteralExpression(expression)) {
      return expression.properties.filter(ts.isSpreadAssignment).flatMap((spread) => sourcesOf(spread.expression));
    }
    return [];
  };
  const destructure = (pattern, sources) => {
    for (const element of pattern.elements) {
      if (element.dotDotDotToken) {
        for (const source of sources) consume(source, '*');
        continue;
      }
      const key = element.propertyName || element.name;
      if (ts.isIdentifier(key) || ts.isStringLiteral(key)) for (const source of sources) consume(source, key.text);
    }
  };

  const shimSubpath = (() => {
    const dir = path.join(root, 'packages/_deprecated') + path.sep;
    if (!file.startsWith(dir)) return null;
    const sub = stripExt(rel(dir, file));
    return sub.endsWith('/index') ? sub.slice(0, -'/index'.length) : sub;
  })();
  const shimNames = (entry) => {
    const former = shims.FORMER[shimSubpath];
    if (!former) return ['*'];
    const dropped = new Set(shims.DROPPED[shimSubpath] || []);
    return former.filter((name) => !dropped.has(name));
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const source = sourceOf(node.moduleSpecifier.text);
      const clause = node.importClause;
      if (source && clause) {
        if (clause.name) bind(clause.name.text, source);
        const named = clause.namedBindings;
        if (named && ts.isNamespaceImport(named)) bind(named.name.text, source);
        if (named && ts.isNamedImports(named)) for (const element of named.elements) consume(source, (element.propertyName || element.name).text);
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const source = sourceOf(node.moduleSpecifier.text);
      if (source) {
        if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) consume(source, '*');
        else for (const element of node.exportClause.elements) consume(source, (element.propertyName || element.name).text);
      }
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && ts.isStringLiteral(node.moduleReference.expression)) {
      const source = sourceOf(node.moduleReference.expression.text);
      if (source) bind(node.name.text, source);
    } else if (ts.isVariableDeclaration(node) && node.initializer) {
      const sources = sourcesOf(node.initializer);
      if (sources.length) {
        if (ts.isIdentifier(node.name)) for (const source of sources) bind(node.name.text, source);
        else if (ts.isObjectBindingPattern(node.name)) destructure(node.name, sources);
      }
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = node.left;
      const isModuleExports = ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression) && target.expression.text === 'module' && target.name.text === 'exports';
      const sources = sourcesOf(node.right);
      if (sources.length && isModuleExports) {
        for (const source of sources) for (const name of shimSubpath ? shimNames(source.key) : ['*']) consume(source, name);
      } else if (sources.length && ts.isIdentifier(target)) {
        for (const source of sources) bind(target.text, source);
      }
    }
    if (ts.isPropertyAccessExpression(node)) {
      const sources = ts.isIdentifier(node.expression) ? bindings.get(node.expression.text) : sourcesOf(node.expression);
      if (sources) for (const source of sources) consume(source, node.name.text);
    } else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      const sources = ts.isIdentifier(node.expression) ? bindings.get(node.expression.text) : sourcesOf(node.expression);
      if (sources) for (const source of sources) consume(source, node.argumentExpression.text);
    }
    ts.forEachChild(node, visit);
  };
  // Bindings are collected before uses are read, so a use above its binding still counts.
  visit(sourceFile);
  visit(sourceFile);
  return { entries: consumed, direct };
}

/**
 * Measures every export of `entries` (default: the package's six entries)
 * under `root` (default: this repository).
 */
function measureExports({ root = REPO, entries = ENTRIES } = {}) {
  const exportsByEntry = collectExports(root, entries);
  const shims = shimTables(root);
  const scan = (dirs) =>
    dirs
      .flatMap((dir) => walk(path.join(root, dir)))
      .map((file) => ({ file: rel(root, file), names: consumedNames(root, file, entries, shims) }));
  const outside = scan(OUTSIDE_ROOTS);
  const tests = scan([TEST_ROOT]);
  const reaching = (files, entry, name) =>
    files.filter(({ names }) => names.entries.has(entry) && (names.entries.get(entry).has(name) || names.entries.get(entry).has('*'))).map(({ file }) => file);
  const directly = (files, definedIn, name) => {
    const mod = stripExt(definedIn);
    return files.filter(({ names }) => names.direct.has(mod) && (names.direct.get(mod).has(name) || names.direct.get(mod).has('*'))).map(({ file }) => file);
  };

  const report = {};
  for (const [entry, list] of Object.entries(exportsByEntry)) {
    const rows = list.map(({ name, kind, definedIn, src }) => ({
      name,
      kind,
      definedIn,
      outside: reaching(outside, entry, name),
      src,
      tests: reaching(tests, entry, name),
      direct: directly(outside, definedIn, name),
    }));
    report[entry] = { rows, zero: rows.filter((row) => row.outside.length === 0 && row.src.length === 0).map((row) => row.name) };
  }
  return report;
}

function format(report) {
  const lines = [];
  for (const [entry, { rows, zero }] of Object.entries(report)) {
    const values = rows.filter((row) => row.kind === 'value').length;
    lines.push(`== ${entry}: ${rows.length} exports (${values} values, ${rows.length - values} types); ${zero.length} with zero consumers`);
    for (const row of rows) {
      const mark = zero.includes(row.name) ? 'ZERO' : row.outside.length === 0 ? 'SRC ' : '    ';
      const sample = row.outside.slice(0, 3).join(', ') + (row.outside.length > 3 ? ', …' : '');
      lines.push(
        `${mark} ${row.name}${row.kind === 'type' ? ' (type)' : ''} [${row.definedIn}] outside=${row.outside.length} src=${row.src.length} tests=${row.tests.length}` +
          (row.direct.length ? ` direct=${row.direct.length}` : '') +
          (sample ? `  ${sample}` : '')
      );
    }
    lines.push(`zero (${entry}): ${zero.length ? zero.join(', ') : 'none'}`, '');
  }
  return lines.join('\n');
}

if (require.main === module) {
  const report = measureExports();
  process.stdout.write(process.argv.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : `${format(report)}\n`);
}

module.exports = { measureExports, format, ENTRIES };
