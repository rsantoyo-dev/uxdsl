#!/usr/bin/env node
'use strict';

// MIG-B7-17 (FEAT-009), phase C: what the /docs/cli and /docs/diagnostics pages show is
// real output, not text somebody typed.
//
// This runs the real `uxdsl` CLI (packages/uxdsl-cli, compiling with the local
// postcss-uxdsl) against a small project, capability-fixtures/cli-project, and writes
// what it printed — stdout, stderr, exit status and the files it wrote — to
// src/generated/cli-captures.json. It also compiles a set of deliberately wrong sources
// and themes through the same CLI and records the real UXD_* diagnostics, and records a
// `uxdsl watch` session as a transcript. The pages import those JSON files.
//
//   node scripts/capture-capabilities.js          rewrite the JSON files
//   node scripts/capture-capabilities.js --check  fail when they differ from a fresh capture
//
// `--check` runs in `npm test`, so a change to the CLI or the compiler that changes what
// these commands print cannot leave the pages showing old output.
//
// Output is made machine-independent: the working directory becomes `<project>`, and
// nothing else in it depends on time or machine (sizes are bytes of generated CSS, which
// only change when the compiler does).

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');

const PLAYGROUND = path.resolve(__dirname, '..');
const FIXTURE = path.join(PLAYGROUND, 'capability-fixtures/cli-project');
// Inside the playground so the project resolves postcss-uxdsl from the playground's own
// node_modules (the local package), exactly like the fixture does in place.
const WORK = path.join(PLAYGROUND, 'capability-fixtures/.work');
const CLI = path.join(PLAYGROUND, '../uxdsl-cli/bin/uxdsl.js');
const OUT_DIR = path.join(PLAYGROUND, 'src/generated');
const CLI_OUT = path.join(OUT_DIR, 'cli-captures.json');
const DIAG_OUT = path.join(OUT_DIR, 'compiler-captures.json');

const CHECK = process.argv.includes('--check');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === 'dist') continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

function freshProject(name) {
  const dir = path.join(WORK, name);
  fs.rmSync(dir, { recursive: true, force: true });
  copyDir(FIXTURE, dir);
  return dir;
}

const normalize = (text, dir) => String(text)
  .split(dir).join('<project>')
  .split(PLAYGROUND).join('<playground>')
  .replace(/\r\n/g, '\n');

// Deterministic across machines and runs: no colors, no debug discovery lines.
const ENV = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
delete ENV.UXDSL_DEBUG;

function run(dir, argv) {
  const result = spawnSync(process.execPath, [CLI, ...argv], { cwd: dir, env: ENV, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { argv, exit: result.status, stdout: normalize(result.stdout, dir), stderr: normalize(result.stderr, dir) };
}

const read = (dir, rel) => normalize(fs.readFileSync(path.join(dir, rel), 'utf8'), dir);
const count = (text, re) => (text.match(re) || []).length;

// ---------------------------------------------------------------- the CLI ----

function captureCli() {
  const project = {};
  for (const rel of ['uxdsl.config.cjs', 'uxdsl.theme.json', 'src/card.uxdsl', 'src/button.uxdsl', 'src/legacy.uxdsl']) project[rel] = fs.readFileSync(path.join(FIXTURE, rel), 'utf8');

  const runs = [];
  const add = (id, title, dir, argv, extra = {}) => { const r = run(dir, argv); runs.push({ id, title, ...r, ...extra(r, dir) }); return r; };
  const none = () => ({});

  let dir = freshProject('cli');
  fs.rmSync(path.join(dir, 'src/main.uxdsl'), { force: true });
  add('generate-entry', 'Write the entry from what is in src/, leaving one file out', dir, ['generate-entry', '--src', 'src', '--out', 'src/main.uxdsl', '--exclude', 'legacy.uxdsl'], (_, d) => ({ files: { 'src/main.uxdsl': read(d, 'src/main.uxdsl') } }));

  add('build', 'Build with the discovered config (uxdsl.config.cjs + uxdsl.theme.json)', dir, ['build'], (_, d) => {
    const css = read(d, 'dist/app.css');
    return { facts: { bytes: Buffer.byteLength(css), rootBlocks: count(css, /:root\s*\{/g), mediaQueries: count(css, /@media/g) } };
  });
  add('build-config', 'The same build with the config named explicitly', dir, ['build', '--config', 'uxdsl.config.cjs'], none);
  add('build-entry', 'Compile one file to one output, bypassing the config\'s entry', dir, ['build', '--entry', 'src/card.uxdsl', '--out', 'dist/card.css'], (_, d) => {
    const css = read(d, 'dist/card.css');
    return { facts: { bytes: Buffer.byteLength(css), rootBlocks: count(css, /:root\s*\{/g) } };
  });
  add('build-include-theme', 'With --include-theme (the default): the entry also defines every token in :root', dir, ['build', '--entry', 'src/card.uxdsl', '--out', 'dist/card-with-theme.css', '--include-theme'], (_, d) => {
    const css = read(d, 'dist/card-with-theme.css');
    return { facts: { bytes: Buffer.byteLength(css), rootBlocks: count(css, /:root\s*\{/g) } };
  });
  add('build-no-include-theme', 'With --no-include-theme: only the component rules, consuming tokens another entry defines', dir, ['build', '--entry', 'src/card.uxdsl', '--out', 'dist/card-only.css', '--no-include-theme'], (_, d) => {
    const css = read(d, 'dist/card-only.css');
    return { facts: { bytes: Buffer.byteLength(css), rootBlocks: count(css, /:root\s*\{/g) }, files: { 'dist/card-only.css': css } };
  });
  add('build-sourcemap', 'With --sourcemap: a .map next to the CSS, pointing devtools at the .uxdsl source', dir, ['build', '--entry', 'src/card.uxdsl', '--out', 'dist/card-mapped.css', '--no-include-theme', '--sourcemap'], (_, d) => {
    const css = read(d, 'dist/card-mapped.css');
    const map = JSON.parse(read(d, 'dist/card-mapped.css.map'));
    return { files: { 'dist/card-mapped.css': css }, facts: { mapSources: map.sources, mapFile: map.file, sourceMappingURL: (css.match(/sourceMappingURL=([^\s*]+)/) || [])[1] || null } };
  });
  add('build-strict-theme', 'With --strict-theme: fail when a family you declared was partly filled from the base', dir, ['build', '--strict-theme'], none);
  add('build-strict-theme-scoped', '--strict-theme scoped to the families that must be complete', dir, ['build', '--strict-theme=breakpoints'], none);

  add('theme', 'Print the effective theme: the base with this project\'s override merged over it', dir, ['theme'], (r) => {
    const theme = JSON.parse(r.stdout);
    return { stdout: undefined, facts: { families: Object.keys(theme), bytes: Buffer.byteLength(r.stdout), primary: theme.palette.primary }, excerpt: JSON.stringify({ palette: { primary: theme.palette.primary } }, null, 2) };
  });
  add('theme-diff', 'Only what this project mentions, each leaf labeled project or default', dir, ['theme', '--diff'], (r) => {
    const rows = JSON.parse(r.stdout);
    return { stdout: undefined, facts: { rows: rows.length, project: rows.filter((x) => x.source === 'project').length, default: rows.filter((x) => x.source === 'default').length }, excerpt: JSON.stringify(rows.filter((x) => x.path.startsWith('palette.primary.')), null, 2) };
  });
  add('theme-strict', 'Fail when a declared family is partly inherited', dir, ['theme', '--strict'], (r) => ({ stdout: undefined, facts: { stdoutIsTheJson: (() => { try { JSON.parse(r.stdout); return true; } catch { return false; } })() } }));
  add('theme-strict-scoped', '--strict scoped to breakpoints, which this project declares completely', dir, ['theme', '--strict=breakpoints'], () => ({ stdout: undefined }));
  add('theme-contrast', 'Check every text and border pair of the effective theme against WCAG', dir, ['theme', '--contrast'], (r) => {
    const report = JSON.parse(r.stdout);
    const byGroup = {};
    for (const f of report.failures) { const k = `${f.mode} ${f.family} ${f.pair}`; byGroup[k] = (byGroup[k] || 0) + 1; }
    return { stdout: undefined, facts: { passed: report.passed, checked: report.checked.length, failures: report.failures.length, exceptions: report.exceptions.length, exceptionsMatched: report.exceptions.filter((e) => e.matched).length, exceptionIssues: report.exceptionIssues, bytes: Buffer.byteLength(r.stdout), byGroup }, excerpt: JSON.stringify(report.failures.slice(0, 2), null, 2) };
  });

  return { fixture: 'packages/playground-nextjs/capability-fixtures/cli-project', project, runs };
}

// ------------------------------------------------------------ uxdsl watch ----

function waitFor(state, test, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const i = state.lines.findIndex((line, index) => index >= state.cursor && test(line));
      if (i >= 0) { setTimeout(() => { const lines = state.lines.slice(state.cursor); state.cursor = state.lines.length; resolve(lines); }, 400); return; }
      if (Date.now() - started > timeoutMs) { reject(new Error(`uxdsl watch: timed out waiting for ${label}. Output so far:\n${state.lines.join('\n')}`)); return; }
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function captureWatch() {
  const dir = freshProject('watch');
  const child = spawn(process.execPath, [CLI, 'watch'], { cwd: dir, env: ENV });
  const state = { lines: [], cursor: 0 };
  const collect = (stream, name) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const parts = buffer.split('\n');
      buffer = parts.pop();
      for (const line of parts) state.lines.push(`${name === 'stderr' ? '! ' : ''}${normalize(line, dir)}`);
    });
  };
  collect(child.stdout, 'stdout');
  collect(child.stderr, 'stderr');
  const card = path.join(dir, 'src/card.uxdsl');
  const original = fs.readFileSync(card, 'utf8');
  const steps = [];
  try {
    steps.push({ action: 'start: uxdsl watch', output: await waitFor(state, (l) => /watching for changes/.test(l), 30000, 'the first build') });
    fs.writeFileSync(card, original.replace('gap: density(4);', 'gap: density(4);\n  border-radius: rounded(3);'));
    steps.push({ action: 'edit src/card.uxdsl: add border-radius: rounded(3);', output: await waitFor(state, (l) => /\] built /.test(l), 30000, 'the rebuild') });
    fs.writeFileSync(card, original.replace('gap: density(4);', 'gap: density(4) xxl(2rem);'));
    steps.push({ action: 'edit src/card.uxdsl: add xxl(2rem), a breakpoint that is not configured', output: await waitFor(state, (l) => /build failed|watching for a fix/.test(l), 30000, 'the error') });
    fs.writeFileSync(card, original);
    steps.push({ action: 'undo the edit', output: await waitFor(state, (l) => /\] built /.test(l), 30000, 'the recovery') });
  } finally {
    child.kill('SIGTERM');
  }
  const css = normalize(fs.readFileSync(path.join(dir, 'dist/app.css'), 'utf8'), dir);
  return { argv: ['watch'], steps, facts: { finalBytes: Buffer.byteLength(css) } };
}

// ---------------------------------------------------------- diagnostics ----

// Each case is a real source (and, where the mistake is in the theme, a real theme file)
// compiled by `uxdsl build`. `expect` is the code the compiler must report; a case that
// reports something else fails the capture instead of showing the wrong thing.
const DIAGNOSTICS = [
  { expect: 'UXD_BREAKPOINT_UNKNOWN', title: 'A breakpoint the theme does not configure', css: '.hero {\n  padding: xs(1rem) xxl(2rem);\n}\n' },
  { expect: 'UXD_SHADOW_REFERENCE', title: 'A shadow preset that does not exist', css: '.card {\n  box-shadow: shadow(9);\n}\n' },
  { expect: 'UXD_EDGE_REFERENCE', title: 'A radius preset that does not exist', css: '.card {\n  border-radius: radius(12);\n}\n' },
  { expect: 'UXD_DENSITY_REFERENCE', title: 'A fractional Density reference', css: '.card {\n  padding: density(2.5);\n}\n' },
  { expect: 'UXD_TYPO_REFERENCE', title: 'A typography role the theme does not define', css: '.title {\n  @ds-typo(hero);\n}\n' },
  { expect: 'UXD_SURFACE_REFERENCE', title: 'A Surface role that does not exist', css: '.panel {\n  @ds-surface(glass);\n}\n' },
  { expect: 'UXD_DIRECTIVE_CONTEXT', title: 'A directive outside the rule it styles', css: '@media (min-width: 768px) {\n  @ds-surface(contained);\n}\n' },
  { expect: 'UXD_DIRECTIVE_UNKNOWN', title: 'A directive UXDSL does not have', css: '.card {\n  @ds-card(contained);\n}\n' },
  { expect: 'UXD_TOKEN_ALPHA', title: 'An alpha outside 0–1', css: '.overlay {\n  background: palette(primary-main, 2);\n}\n' },
  { expect: 'UXD_TYPO_BP', title: 'A negative breakpoint in the theme (reported by the first engine that validates the map: Typography)', css: '.a {\n  padding: space(3);\n}\n', theme: { breakpoints: { xs: 0, sm: 480, md: -1, lg: 1024, xl: 1280 } } },
  { expect: 'UXD_TYPO_FIELD', title: 'A typography field the engine does not support', css: '.a {\n  padding: space(3);\n}\n', theme: { typography_details: { h1: { opacity: '0.8' } } } },
  { expect: 'UXD_REFERENCE_MISSING', title: 'A theme value pointing at a token that does not exist', css: '.a {\n  color: palette(primary-main);\n}\n', theme: { palette: { primary: { main: 'var(--uxdsl__color__brand-500)' } } } },
];

function captureDiagnostics() {
  const results = [];
  for (const [i, spec] of DIAGNOSTICS.entries()) {
    const dir = freshProject(`diag-${i}`);
    fs.writeFileSync(path.join(dir, 'src/example.uxdsl'), spec.css);
    if (spec.theme) fs.writeFileSync(path.join(dir, 'uxdsl.theme.json'), `${JSON.stringify(spec.theme, null, 2)}\n`);
    const r = run(dir, ['build', '--entry', 'src/example.uxdsl', '--out', 'dist/example.css']);
    const code = (r.stderr.match(/\b(UXD_[A-Z0-9_]+)\b/) || [])[1] || null;
    if (r.exit === 0 || code !== spec.expect) {
      throw new Error(`diagnostic case "${spec.title}": expected ${spec.expect} and a failing exit, got ${code} (exit ${r.exit}).\n${r.stderr}`);
    }
    results.push({ code, title: spec.title, source: spec.css, theme: spec.theme || null, argv: r.argv, exit: r.exit, stderr: r.stderr });
  }
  return results;
}

// Same source, one with the aliases and one with the names they alias: the compiled
// declarations must be identical, and the page shows both.
function captureAliases() {
  const dir = freshProject('aliases');
  const source = '.with-alias {\n  box-shadow: elevation(2);\n  border-radius: rounded(2);\n}\n\n.with-name {\n  box-shadow: shadow(2);\n  border-radius: radius(2);\n}\n';
  fs.writeFileSync(path.join(dir, 'src/aliases.uxdsl'), source);
  const r = run(dir, ['build', '--entry', 'src/aliases.uxdsl', '--out', 'dist/aliases.css', '--no-include-theme']);
  if (r.exit !== 0) throw new Error(`aliases did not compile:\n${r.stderr}`);
  const css = read(dir, 'dist/aliases.css');
  const body = (selector) => ((css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`)) || [])[1] || '').trim();
  if (!body('.with-alias') || body('.with-alias') !== body('.with-name')) throw new Error(`elevation()/rounded() no longer compile to the same declarations as shadow()/radius():\n${css}`);
  return { source, argv: r.argv, css };
}

// ------------------------------------------------------------------ main ----

async function main() {
  if (!fs.existsSync(path.join(PLAYGROUND, 'node_modules/postcss-uxdsl/dist/index.js'))) throw new Error('postcss-uxdsl is not built: run `npm run local-deps` in packages/playground-nextjs first.');
  fs.mkdirSync(WORK, { recursive: true });
  try {
    const cli = captureCli();
    cli.watch = await captureWatch();
    const compiler = { diagnostics: captureDiagnostics(), aliases: captureAliases() };
    const files = [[CLI_OUT, cli], [DIAG_OUT, compiler]].map(([file, data]) => [file, `${JSON.stringify({ generatedBy: 'packages/playground-nextjs/scripts/capture-capabilities.js — do not edit; run it to refresh', ...data }, null, 2)}\n`]);
    if (CHECK) {
      const stale = files.filter(([file, text]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text).map(([file]) => path.relative(PLAYGROUND, file));
      if (stale.length) {
        console.error(`Stale captured output: ${stale.join(', ')}. The CLI or the compiler now prints something else than the playground shows.\nRun: node packages/playground-nextjs/scripts/capture-capabilities.js`);
        process.exitCode = 1;
        return;
      }
      console.log('Captured CLI and compiler output is up to date.');
    } else {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      for (const [file, text] of files) fs.writeFileSync(file, text);
      console.log(`wrote ${files.map(([f]) => path.relative(PLAYGROUND, f)).join(', ')}`);
    }
  } finally {
    fs.rmSync(WORK, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
