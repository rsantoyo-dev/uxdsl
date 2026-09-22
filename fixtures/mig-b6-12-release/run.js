'use strict';

// MIG-B6-12 (FEAT-008): the beta.6 release gate.
//
// Every prior beta closed with a gate that installed real tarballs
// (verify:beta2 .. verify:beta5). beta.6 changed far more than any of them —
// the pipeline, the adapters, the defaults, the errors, the runtime — so this
// gate runs the audit's own findings as regressions against the packaged
// product, not against the monorepo source.
//
// Three rules it follows, because they are what make a gate worth running:
//
//   1. Nothing here resolves back into this repository. Everything under test
//      comes from `npm pack` tarballs installed into a temp directory.
//   2. A check that cannot run here is *named and categorised*, never quietly
//      skipped and never counted as a pass. Browser, external and postpublish
//      work is listed with who owns it.
//   3. It must be able to fail. Reverting a beta.6 fix has to turn a line red;
//      that was verified by hand against two stories and recorded in the
//      release record.
//
// It does not publish, change dist-tags, or ask for secrets.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { packAndInstall, REPO_ROOT } = require('../lib/tarball-consumer');

// A position query needs a source-map reader. It is a *measuring instrument*,
// not part of the product, so taking it from the repo is correct here — the
// same way the browser fixtures take playwright and esbuild.
const repoRequire = createRequire(path.join(REPO_ROOT, 'package.json'));
function sourceMapConsumer() {
  for (const base of ['packages/uxdsl-core', 'packages/uxdsl-cli']) {
    try {
      return require(require.resolve('source-map-js', { paths: [path.join(REPO_ROOT, base)] })).SourceMapConsumer;
    } catch { /* try the next one */ }
  }
  return null;
}

const results = [];
/**
 * Runs one check and records it.
 *
 * `await fn()` — not `fn()` — and every call site awaits this in turn. The
 * first version did neither, so an `async` check returned a pending Promise,
 * which is truthy, and *every* asynchronous check passed no matter what it
 * asserted; the throw inside became an unhandled rejection. It was caught by
 * this story's own "revert a fix and watch it go red" step, which stayed green
 * with MIG-B6-15 reverted. A gate that cannot fail is worse than no gate, so
 * that verification is not optional here.
 */
async function check(id, label, fn) {
  let ok = false;
  let detail = '';
  try {
    const value = await fn();
    ok = value !== false;
    if (typeof value === 'string') detail = value;
  } catch (error) {
    detail = String(error && error.message ? error.message : error).split('\n')[0].slice(0, 160);
  }
  results.push({ id, label, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

/** Findings this gate deliberately does not execute, each with its real owner
 * and mechanism. Printed with the results so "not run here" can never be read
 * as "passed". */
const DELEGATED = [
  ['UX-11', 'browser/CI', 'Atomic writes and watch recovery — `npm --prefix packages/uxdsl-cli test` (MIG-B6-23 suites); needs a long-lived watcher, not a one-shot fixture.'],
  ['UX-17', 'external', 'VS Code extension publication — owner decision; packaging is checked below, publication is postpublish.'],
  ['N-03', 'automated, elsewhere', '`node fixtures/webpack-adapter/run.js` — needs a real webpack build.'],
  ['N-04', 'automated, elsewhere', '`node fixtures/vite-adapter/run.js` — needs a real Vite build.'],
  ['N-05', 'automated, elsewhere', '`npm run verify:vscode-extension` — packages and validates the VSIX.'],
  ['—', 'browser', '`npm run verify:cssmodules-build` — computed styles and the runtime API in real Chrome (MIG-B6-30 phase 4). Separate job, Chrome declared.'],
  ['—', 'external', 'Press Craftor validation against these tarballs — owner or that project\'s team; CSS diff vs beta.5, `next build`, a day of `uxdsl watch`.'],
  ['—', 'postpublish', 'dist-tags (`latest` and `beta` on all five packages) — verified only after the owner publishes.'],
];

async function main() {
  const { dir, run, write, req, version } = packAndInstall({ tmpPrefix: 'uxdsl-beta6-release-' });
  const cli = path.join(dir, 'node_modules/uxdsl-cli/bin/uxdsl.js');
  const command = (...args) => run(process.execPath, [cli, ...args]);
  const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
  const runtime = req('postcss-uxdsl/ds-runtime');
  const plugin = req('postcss-uxdsl');
  const postcss = req('postcss');
  const core = req('uxdsl-core');
  const compile = (css, options = {}) => postcss([plugin(options)]).process(css, { from: 'gate.uxdsl' }).then((r) => r.css);

  console.log(`\nGate for ${version}, from tarballs in ${dir}\n`);
  console.log('Audit regressions (UX-*/N-*), run against the installed packages:');

  // --- UX-01: modes/typography are recognised families -----------------------
  await check('UX-01', 'modes and typography no longer warn as unknown families', () => {
    const result = runtime.validateAndNormalizeTheme({ modes: { dark: { palette: {} } }, typography: { 'font-code': 'monospace' } });
    const unknown = result.warnings.filter((w) => /Unknown theme family/.test(w.message));
    if (unknown.length) throw new Error(`still warns: ${unknown.map((w) => w.path).join(', ')}`);
    // and a real typo still does warn, or the check above proves nothing
    const typo = runtime.validateAndNormalizeTheme({ palete: {} }).warnings.map((w) => w.path);
    return typo.includes('palete') ? 'typo still warns' : (() => { throw new Error('a real typo stopped warning'); })();
  });

  // --- UX-02 / N-02: url() and missing partials ------------------------------
  write('src/url-case.uxdsl', ".a { background: url(https://example.com/a.png); }\n/* see https://example.com/docs */\n.b { color: red; }\n");
  await check('UX-02', 'url(https://…) and URL comments survive compilation', async () => {
    const out = await core.compile({ entry: path.join(dir, 'src/url-case.uxdsl') }, { theme: {}, includeTheme: false });
    if (!out.css.includes('url(https://example.com/a.png)')) throw new Error('url was truncated');
    if (!out.css.includes('https://example.com/docs')) throw new Error('comment was truncated');
    return 'intact';
  });
  write('src/missing-partial.uxdsl', '@import "./nope.uxdsl";\n.a { color: red; }\n');
  await check('N-02', 'a missing @import fails instead of reaching the browser', async () => {
    try {
      await core.compile({ entry: path.join(dir, 'src/missing-partial.uxdsl') }, { theme: {}, includeTheme: false });
    } catch {
      return 'rejected';
    }
    throw new Error('a missing partial compiled successfully');
  });

  // --- UX-03: located diagnostics -------------------------------------------
  await check('UX-03', 'errors carry file, line and column', async () => {
    try {
      await compile('.a { padding: density(999); }');
    } catch (error) {
      const located = error.file || error.source || (error.input && error.input.file);
      if (!located || error.line === undefined) throw new Error(`no location on: ${error.message.split('\n')[0]}`);
      return `${path.basename(String(located))}:${error.line}`;
    }
    throw new Error('an undefined density compiled successfully');
  });

  // --- UX-04 / D-5: strict flag parsing --------------------------------------
  write('uxdsl.config.cjs', "module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };\n");
  write('src/entry.uxdsl', '.a { color: palette(primary.main); }\n');
  const expectFailure = (args, pattern, label) => {
    try {
      command(...args);
    } catch (error) {
      const output = `${error.stdout || ''}${error.stderr || ''}`;
      if (!pattern.test(output)) throw new Error(`${label}: wrong message — ${output.split('\n')[0]}`);
      return true;
    }
    throw new Error(`${label}: exited 0`);
  };
  await check('UX-04', 'unknown flags and bad flag values fail with a message', () => {
    expectFailure(['build', '--strict-thme'], /Unknown option|Did you mean/, 'nonexistent flag');
    expectFailure(['build', '--strict-theme=pallete'], /pallete|Did you mean/, 'unknown family');
    expectFailure(['theme', '--strict=,'], /strict/i, 'stray comma');
    return 'all three rejected';
  });
  await check('UX-12', '--no-include-theme really suppresses :root', () => {
    command('build', '--no-include-theme');
    const out = read('src/out.css');
    if (/:root/.test(out)) throw new Error(':root still emitted');
    command('build');
    if (!/:root/.test(read('src/out.css'))) throw new Error('the default stopped emitting :root');
    return 'suppressed, and still emitted by default';
  });

  // --- UX-05 / UX-07: selectors and !important -------------------------------
  await check('UX-05', 'functional pseudo-classes are not split by state expansion', async () => {
    const css = await compile('.btn:is(.x, .y) { @ds-button(contained); }', { includeTheme: false });
    if (/\.btn:is\(\.x:hover/.test(css)) throw new Error('split inside :is()');
    if (!/:is\(\.x, \.y\):hover/.test(css)) throw new Error(`no correctly-suffixed hover selector in: ${css.slice(0, 120)}`);
    return 'intact';
  });
  await check('UX-07', '!important survives into every responsive breakpoint', async () => {
    const css = await compile('.a { padding: xs(1rem) md(2rem) !important; }', { includeTheme: false });
    const importants = (css.match(/!important/g) || []).length;
    if (importants < 2) throw new Error(`only ${importants} !important in output`);
    return `${importants} occurrences`;
  });

  // --- UX-06 / N-01 / UX-15: nothing unprocessed reaches the CSS -------------
  await check('UX-06', 'leftover and misspelled directives fail instead of passing through', async () => {
    for (const [source, label] of [
      ['@ds-surface(contained);', 'root-level directive'],
      ['.a { @ds-surfce(contained); }', 'misspelled directive'],
    ]) {
      let failed = false;
      try { await compile(source, { includeTheme: false }); } catch { failed = true; }
      if (!failed) throw new Error(`${label} compiled successfully`);
    }
    return 'both rejected';
  });
  await check('N-01', 'an unknown breakpoint function is an error, not silent output', async () => {
    try { await compile('.a { padding: xs(1rem) xxl(2rem); }', { includeTheme: false }); } catch { return 'rejected'; }
    throw new Error('xxl() reached the CSS');
  });
  await check('UX-15', 'CSS relative color syntax is accepted', async () => {
    const css = await compile('.a { color: color(from red srgb r g b / 0.5); }', { includeTheme: false });
    if (!/from red srgb/.test(css)) throw new Error(`rewritten: ${css.slice(0, 100)}`);
    return 'passed through';
  });

  // --- UX-09 / UX-19: @ds-typo emits only what the theme defines -------------
  await check('UX-09', '@ds-typo invents no fallback values', async () => {
    const css = await compile('.t { @ds-typo(caption); }', { includeTheme: false });
    for (const invented of [', auto)', ', none)', ', 0.8)', ', normal)']) {
      if (css.includes(invented)) throw new Error(`still emits a literal fallback ${invented}`);
    }
    return 'no invented fallbacks';
  });
  await check('UX-19', '@ds-typo emits one declaration per defined field, not a fixed list', async () => {
    const css = await compile('.t { @ds-typo(h1); }', { includeTheme: false });
    const declarations = (css.match(/:\s*var\(/g) || []).length;
    const fields = Object.keys(runtime.resolveTypographyRole(runtime.DEFAULT_THEME.typography_details, 'h1'));
    if (declarations !== fields.length) throw new Error(`${declarations} declarations vs ${fields.length} defined fields`);
    return `${declarations} = the theme's own ${fields.length} fields`;
  });

  // --- UX-08 / D-1: partial overrides are visible and checkable --------------
  // The contrast report is far larger than a pipe's default chunk, so these
  // spawns need an explicit buffer — truncated stdout would look exactly like
  // malformed JSON from the CLI.
  const spawn = (...args) => require('node:child_process').spawnSync(
    process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  await check('UX-08', 'theme --diff summarises a mixed entry on stderr, stdout stays JSON', () => {
    write('uxdsl.theme.config.cjs', "module.exports = { theme: { palette: { primary: { main: '#00aa00' } } } };\n");
    const spawned = spawn('theme', '--diff');
    if (spawned.status !== 0) throw new Error(`theme --diff exited ${spawned.status}`);
    JSON.parse(spawned.stdout); // stdout must still be one JSON document
    if (!/mixes your values/.test(spawned.stderr)) throw new Error(`no mix summary on stderr: ${spawned.stderr.slice(0, 120)}`);
    return 'summary on stderr, JSON on stdout';
  });
  await check('UX-08b', 'theme --contrast reports the pairs a partial override introduces', () => {
    const spawned = spawn('theme', '--contrast');
    if (spawned.status === 0) throw new Error('a failing theme exited 0');
    const report = JSON.parse(spawned.stdout);
    const primary = report.failures.filter((f) => f.tone === 'primary' && f.pair === 'text');
    if (!primary.length) throw new Error('the overridden tone was not reported');
    return `${report.failures.length} pairs, ${primary.length} on the overridden tone`;
  });
  fs.rmSync(path.join(dir, 'uxdsl.theme.config.cjs'), { force: true });

  // --- UX-10: reference validation is near-linear ----------------------------
  await check('UX-10', 'reference validation no longer grows quadratically', async () => {
    const block = (i) => `.c-${i} { padding: density(2); color: palette(primary); background: palette(surface); border-radius: radius(2); }\n`;
    const timeFor = async (count) => {
      let css = '';
      for (let i = 0; i < count; i++) css += block(i);
      write(`src/perf-${count}.uxdsl`, css);
      const started = process.hrtime.bigint();
      await core.compile({ entry: path.join(dir, `src/perf-${count}.uxdsl`) }, { theme: {}, includeTheme: true });
      return Number(process.hrtime.bigint() - started) / 1e6;
    };
    await timeFor(200); // warm up
    const small = await timeFor(400);
    const large = await timeFor(800);
    const growth = large / small;
    if (growth > 3) throw new Error(`doubling cost x${growth.toFixed(2)} (quadratic behaviour is back)`);
    return `x${growth.toFixed(2)} per doubling`;
  });

  // --- UX-13 / UX-14: init does not fight the theme file ---------------------
  await check('UX-13', 'init writes no breakpoints, so the theme file decides', () => {
    const initDir = path.join(dir, 'init-probe');
    fs.mkdirSync(initDir, { recursive: true });
    run(process.execPath, [cli, 'init'], initDir);
    const config = fs.readFileSync(path.join(initDir, 'uxdsl.config.cjs'), 'utf8');
    if (/breakpoints/.test(config)) throw new Error('init still writes breakpoints');
    return 'absent from the generated config';
  });

  // --- UX-16 / N-06: one compiler for one language ---------------------------
  await check('UX-16', '$vars in responsive values expand identically through compile()', async () => {
    write('src/vars.uxdsl', '$gap: xs(1rem) md(2rem);\n.a { gap: $gap; }\n');
    const out = await core.compile({ entry: path.join(dir, 'src/vars.uxdsl') }, { theme: {}, includeTheme: false });
    if (/xs\(|md\(/.test(out.css)) throw new Error('an unexpanded responsive function reached the CSS');
    if (!/@media/.test(out.css)) throw new Error('no media query generated');
    return 'expanded';
  });
  await check('N-06', 'uxdsl-core resolves its declared postcss-uxdsl dependency', () => {
    const resolved = req.resolve('uxdsl-core');
    const inner = createRequire(resolved).resolve('postcss-uxdsl');
    // realpath on both sides: macOS resolves /var/folders to /private/var/folders,
    // so a raw prefix comparison reports a correct resolution as an escape.
    const installRoot = fs.realpathSync(dir);
    if (!fs.realpathSync(inner).startsWith(installRoot)) throw new Error(`resolved outside the install: ${inner}`);
    return 'from node_modules, not a sibling path';
  });

  // --- UX-18: types and schema ship ------------------------------------------
  await check('UX-18', 'types and the theme JSON Schema are in the tarball', () => {
    const pkgDir = path.join(dir, 'node_modules/postcss-uxdsl');
    for (const file of ['dist/types.d.ts', 'schema/theme.schema.json', 'dist/config.d.ts']) {
      if (!fs.existsSync(path.join(pkgDir, file))) throw new Error(`missing ${file}`);
    }
    const exports = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).exports;
    for (const [subpath, conditions] of Object.entries(exports)) {
      if (typeof conditions === 'object' && conditions.types && Object.keys(conditions)[0] !== 'types') {
        throw new Error(`exports["${subpath}"] lists types after require/import`);
      }
    }
    if (typeof req('postcss-uxdsl/config').defineConfig !== 'function') throw new Error('defineConfig missing');
    return 'types first in every export condition';
  });

  // --- UX-20: source maps ----------------------------------------------------
  await check('UX-20', 'source maps: external, inline, and off byte-identical', () => {
    write('src/map.uxdsl', '.m { padding: density(2); }\n');
    write('uxdsl.config.cjs', "module.exports = { entry: './src/map.uxdsl', outFile: './src/map.css' };\n");
    command('build');
    const plain = read('src/map.css');
    command('build', '--sourcemap');
    const external = read('src/map.css');
    if (!fs.existsSync(path.join(dir, 'src/map.css.map'))) throw new Error('no .map written');
    if (!/sourceMappingURL=map\.css\.map/.test(external)) throw new Error('no annotation');
    const map = JSON.parse(read('src/map.css.map'));
    if (map.version !== 3 || !Array.isArray(map.sources)) throw new Error('not a v3 map');
    if (!map.sources.some((s) => s.endsWith('map.uxdsl'))) throw new Error(`sources missing the entry: ${map.sources}`);
    if (map.sources.some((s) => path.isAbsolute(s))) throw new Error('an absolute path leaked into sources');

    const Consumer = sourceMapConsumer();
    let positionNote = 'position query skipped (no source-map reader available)';
    if (Consumer) {
      const consumer = new Consumer(map);
      const lines = external.split('\n');
      const index = lines.findIndex((l) => l.includes('.m'));
      const original = consumer.originalPositionFor({ line: index + 1, column: lines[index].indexOf('padding') });
      if (!original.source || !original.source.endsWith('map.uxdsl')) throw new Error(`position resolved to ${original.source}`);
      positionNote = `position -> ${original.source}:${original.line}`;
    }

    command('build', '--sourcemap=inline');
    const inline = read('src/map.css');
    if (!/sourceMappingURL=data:application\/json/.test(inline)) throw new Error('inline map missing');
    if (fs.existsSync(path.join(dir, 'src/map.css.map'))) throw new Error('inline mode left a .map file');

    command('build', '--no-sourcemap');
    if (read('src/map.css') !== plain) throw new Error('off is not byte-identical to omitting the option');
    return positionNote;
  });

  // --- N-07 / D-1: the packaged base JSON is the library default -------------
  await check('N-07', 'resolveTheme(undefined) is the packaged base JSON', () => {
    const base = req('postcss-uxdsl/theme/base.json');
    const resolved = runtime.resolveTheme(undefined);
    for (const family of Object.keys(base)) {
      if (JSON.stringify(resolved[family]) !== JSON.stringify(base[family])) {
        throw new Error(`${family} differs between the base JSON and the library default`);
      }
    }
    if (Object.keys(base.palette).length < 10) throw new Error('the base palette looks like the old minimal default');
    return `${Object.keys(base).length} families, ${Object.keys(base.palette).length} palette families`;
  });

  // --- N-08: the contrast gate exists and reports honestly -------------------
  await check('N-08', 'the contrast gate runs over the packaged base and reports its real state', () => {
    let exceptions = [];
    try { exceptions = req('postcss-uxdsl/theme/base.contrast-exceptions.json'); } catch { /* optional */ }
    const report = runtime.checkThemeContrast(runtime.resolveTheme(undefined), { exceptions });
    if (typeof report.passed !== 'boolean' || !Array.isArray(report.failures)) throw new Error('unusable report shape');
    if (!report.exceptions.length || !report.exceptions[0].matched) throw new Error('the shipped exception does not match the theme it was written for');
    // Deliberately NOT asserting `passed`. MIG-B6-29 phase 3 left three
    // engine/architecture gaps open and documented; asserting a pass here
    // would be asserting a fiction. The number is recorded in the release
    // record so a change in either direction is visible.
    return `gate runs; ${report.failures.length} open failures (MIG-B6-29, disclosed), 1 exception matched`;
  });

  // --- UX-21: package hygiene ------------------------------------------------
  await check('UX-21', 'no tarball ships tests or images, and all five declare files', () => {
    for (const name of ['postcss-uxdsl', 'uxdsl-core', 'vite-plugin-uxdsl', 'uxdsl-webpack-loader', 'uxdsl-cli']) {
      const pkgDir = path.join(dir, 'node_modules', name);
      const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
      if (!Array.isArray(pkg.files) || !pkg.files.length) throw new Error(`${name} has no files field`);
      const walk = (root) => fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(root, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });
      const shipped = walk(pkgDir);
      const png = shipped.filter((f) => /\.(png|jpe?g|gif)$/i.test(f));
      const tests = shipped.filter((f) => /(^|\/)test\/|\.test\.js$/.test(f.slice(pkgDir.length)));
      if (png.length) throw new Error(`${name} ships ${png.length} image(s)`);
      if (tests.length) throw new Error(`${name} ships ${tests.length} test file(s)`);
    }
    return 'five packages clean';
  });

  // --- MIG-B6-30: the runtime, in Node with a DOM stub -----------------------
  await check('B6-30', 'applyTheme applies values and refuses structural changes', () => {
    const elements = new Map();
    const previousDocument = globalThis.document;
    globalThis.document = {
      createElement: (tag) => ({ tagName: tag.toUpperCase(), id: '', textContent: '', setAttribute() {}, getAttribute: () => null }),
      getElementById: (id) => elements.get(id) || null,
      head: { appendChild(node) { elements.set(node.id, node); return node; } },
    };
    try {
      const init = runtime.applyTheme({}, { replace: true });
      if (!init.ok) throw new Error(`init failed: ${init.error.message}`);
      const value = runtime.applyTheme({ palette: { primary: { main: '#0ea5e9' } } });
      if (!value.ok) throw new Error(`a value patch was refused: ${value.error.message}`);
      const style = elements.get('uxdsl-theme');
      if (!/#0ea5e9/.test(style.textContent)) throw new Error('the value did not reach the stylesheet');
      const before = style.textContent;
      const structural = runtime.applyTheme({ breakpoints: { md: 900 } });
      if (structural.ok) throw new Error('a threshold move was accepted');
      if (structural.error.code !== 'UXD_THEME_STRUCTURE') throw new Error(`wrong code: ${structural.error.code}`);
      if (style.textContent !== before) throw new Error('a refused patch still rewrote the stylesheet');
      return 'value applied, structural refused, CSS preserved';
    } finally {
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
  });

  // --- parity, from the installed packages ------------------------------------
  await check('parity', 'CLI, compile() and the adapters agree (fixtures/parity)', () => {
    execFileSync(process.execPath, [path.join(REPO_ROOT, 'fixtures/parity/run.js')], { cwd: REPO_ROOT, stdio: 'pipe', timeout: 300000 });
    return 'oracle agreement';
  });

  // --- report ---------------------------------------------------------------
  console.log('\nNot executed here — owner and mechanism named, never counted as a pass:');
  for (const [id, kind, note] of DELEGATED) console.log(`  --   ${id.padEnd(6)} [${kind}] ${note}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} automated checks passed.`);
  if (failed.length) {
    console.error(`FAIL: ${failed.map((r) => r.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('PASS: beta.6 gate (automated portion). Browser, external and postpublish checks remain, listed above.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
