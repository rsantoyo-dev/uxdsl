'use strict';

// The 1.0 release gate (`npm run verify:1.0`): one tarball, `uxdsl`.
//
// It replaces verify:beta2 … verify:beta7. Every check those gates made whose
// behavior still exists is here, under its original id, run against the one
// package; the ones that checked removed features are listed in DROPPED with
// the reason. The rules are the ones every gate before it followed:
//
//   1. Everything under test comes from `npm pack` of packages/uxdsl,
//      installed the documented way (`npm i -D uxdsl`) into a temp directory.
//      Nothing resolves back into this repository. Measuring instruments
//      (esbuild, Playwright, a source-map reader) come from the repository and
//      say so.
//   2. A check that cannot run here is named, with its owner, and never
//      counted as a pass. [repo] checks read documentation and playground
//      sources, which do not ship in a tarball.
//   3. Every check is awaited (an un-awaited async check is a Promise, which is
//      truthy — the beta.6 gate's first version passed everything that way).
//
//   node fixtures/release-1.0/run.js                          full gate
//   node fixtures/release-1.0/run.js --skip-upgrade           no registry install of 0.5.0-beta.6
//   node fixtures/release-1.0/run.js --skip-playground-walk   run verify:playground-browser separately
//   node fixtures/release-1.0/run.js --write-contrast-baseline
//        re-pin the known contrast pairs (a deliberate, reviewed act: the
//        diff of contrast-baseline.json is the review)
//
// It does not publish, change dist-tags, or ask for secrets.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync, spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { packAndInstall, REPO_ROOT, PACKAGE_DIR } = require('../lib/tarball-consumer');
const { cascadedVariables } = require('../mig07-consumer/lib/css-cascade-compare');

const args = new Set(process.argv.slice(2));
const BASELINE = path.join(__dirname, 'contrast-baseline.json');
const CHROME = process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Measuring instruments, not product.
const instrument = createRequire(path.join(PACKAGE_DIR, 'package.json'));
const browserFixture = createRequire(path.join(REPO_ROOT, 'fixtures/mig02-nextjs-cssmodules/package.json'));

const results = [];
async function check(id, label, fn) {
  let ok = false;
  let detail = '';
  try {
    const value = await fn();
    ok = value !== false;
    if (typeof value === 'string') detail = value;
  } catch (error) {
    detail = String(error && error.message ? error.message : error).split('\n')[0].slice(0, 220);
  }
  results.push({ id, label, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(9)} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

/** Not executed here — owner and mechanism named, never counted as a pass. */
const DELEGATED = [
  ['B7-12', 'manual', 'Colors and completion in a real VS Code with the VSIX installed — owner; the VSIX itself is packaged by `npm run verify:vscode-extension`.'],
  ['—', 'external', 'Validation in the owner\'s consuming project (story-radar) against this tarball: `npm i -D uxdsl`, `uxdsl build --watch` instead of `uxdsl watch`, the uxdsl.theme.config.* → uxdsl.theme.* rename.'],
  ['—', 'postpublish', 'dist-tags of `uxdsl`, and the five deprecated names resolving to their shims — verified only after the owner publishes.'],
];

/** Checks of the former gates that tested something removed, with why. */
const DROPPED = [
  ['N-06 (beta.6)', 'uxdsl-core resolves its declared postcss-uxdsl dependency', 'one package: there is no second package to resolve. Replaced by I-2 (one copy of the postcss peer).'],
  ['B3 marker (beta.3), B4 marker (beta.4)', 'no entry carries the removed #uxdsl-bp-meta / @uxdsl-bp breakpoint marker', 'the marker was removed in stability phase 2; nothing can emit it (test/removed-language-surface.test.js and friends pin the removal in the package suite).'],
  ['UX-21 "all five declare files" (beta.6)', 'five tarballs', 'one tarball; I-4 checks its files.'],
  ['beta6 (beta.7)', 'the nested beta.6 gate', 'its checks run here directly, under their own ids.'],
];

const contrastSignature = (f) => [f.mode, f.family, f.component, f.tone, f.state, f.pair, f.background, f.breakpoint].join('|');
const exceptedSignature = (e) => `${contrastSignature(e)}|${e.exception}`;

function diffPinned(pinnedList, actualList) {
  const pinned = new Set(pinnedList);
  const actual = new Set(actualList);
  return { added: actualList.filter((s) => !pinned.has(s)), closed: [...pinned].filter((s) => !actual.has(s)) };
}

function contrastBaselineOf(report, version) {
  const signatures = report.failures.map(contrastSignature).sort();
  const excepted = (report.excepted || []).map(exceptedSignature).sort();
  return { version, count: signatures.length, signatures, exceptedCount: excepted.length, excepted };
}

function assertContrastBaseline(report, baseline) {
  if (report.exceptionIssues.length) throw new Error(`contrast exceptions invalid: ${report.exceptionIssues.join('; ')}`);
  const failing = diffPinned(baseline.signatures, report.failures.map(contrastSignature));
  if (failing.added.length || failing.closed.length) {
    throw new Error(`failing pairs: ${failing.added.length} new (e.g. ${failing.added[0] || '—'}), ${failing.closed.length} closed (e.g. ${failing.closed[0] || '—'}); re-pin deliberately`);
  }
  const excepted = diffPinned(baseline.excepted || [], (report.excepted || []).map(exceptedSignature));
  if (excepted.added.length || excepted.closed.length) {
    throw new Error(`excepted pairs: ${excepted.added.length} new (e.g. ${excepted.added[0] || '—'}), ${excepted.closed.length} closed (e.g. ${excepted.closed[0] || '—'}); re-pin deliberately`);
  }
  if (report.passed !== (report.failures.length === 0)) {
    throw new Error(`report.passed is ${report.passed} with ${report.failures.length} failing pairs and no exception issue`);
  }
  return `${report.failures.length} failing pairs, ${(report.excepted || []).length} excepted (listed, not passing), unchanged`;
}

function contrastReport(theme, req) {
  return theme.checkThemeContrast(theme.resolveTheme(undefined), { exceptions: req('uxdsl/theme/base.contrast-exceptions.json') });
}

/**
 * `npm audit --json` of the lockfile in `cwd` (`node_modules` is not needed).
 * Returns the summary line when it reports nothing; throws it, naming each
 * finding, when anything of any severity remains, and throws when the audit
 * itself could not run (no registry, no counts).
 */
function auditLockfile(cwd) {
  const audit = spawnSync('npm', ['audit', '--json'], { cwd, encoding: 'utf8', maxBuffer: 1 << 26 });
  let report;
  try { report = JSON.parse(audit.stdout); } catch { throw new Error(`npm audit did not run: ${(audit.stderr || '').trim().split('\n')[0] || `exit ${audit.status}`}`); }
  if (!report.metadata || !report.metadata.vulnerabilities) throw new Error(`npm audit returned no counts: ${JSON.stringify(report.error || report).slice(0, 160)}`);
  const counts = report.metadata.vulnerabilities;
  const chains = Object.entries(report.vulnerabilities || {}).map(([name, v]) => `${name} (${v.severity})`).join(', ');
  const summary = `${['critical', 'high', 'moderate', 'low'].map((level) => `${counts[level] || 0} ${level}`).join(', ')}${chains ? ` — ${chains}` : ''}`;
  if ((counts.total || 0) > 0) throw new Error(summary);
  return summary;
}

/**
 * S-3's verdict on `uxdsl build` of heavy.uxdsl: the UXDSL error is printed at
 * the author's line 18, column 66, under a code frame of the author's line
 * with its caret under that column, never of Dart Sass's output, where that
 * declaration is on line 29 and line 18 holds other text.
 */
function assertAuthorLocated(built) {
  const stderr = built.stderr || '';
  if (built.status !== 1) throw new Error(`exited ${built.status}: ${stderr.trim().split('\n')[0] || '(no stderr)'}`);
  if (!/heavy\.uxdsl:18:66: UXD_SPACE_REFERENCE/.test(stderr)) throw new Error(`stderr: ${stderr.trim().split('\n')[0]}`);
  if (/^> 29 \|/m.test(stderr)) throw new Error('the code frame shows line 29 of Dart Sass\'s output');
  const lines = stderr.split('\n');
  const marked = lines.findIndex((line) => /^> 18 \|/.test(line));
  if (marked === -1) throw new Error('no code frame of the author\'s line 18');
  const column = lines[marked].indexOf('inset: space(404);');
  if (column === -1) throw new Error(`the code frame's line 18 is not the author's: ${lines[marked]}`);
  if ((lines[marked + 1] || '').indexOf('^') !== column) throw new Error('the code frame\'s caret is not under the author\'s column 66');
  return 'heavy.uxdsl:18:66 UXD_SPACE_REFERENCE, framed at the author\'s line 18';
}

/**
 * S-4's verdict on `uxdsl build` of src/a.uxdsl, `.a { color: palette(primary.main); width: $nope; }`:
 * exit 1, the UXD_SASS head line at the author's position, then Dart Sass's
 * frame and stack, every line indented by two spaces, showing the author's
 * `palette(primary.main)` and never the protected `#{…}` text.
 */
function assertSassFramed(built) {
  const stderr = built.stderr || '';
  if (built.status !== 1) throw new Error(`exited ${built.status}: ${stderr.trim().split('\n')[0] || '(no stderr)'}`);
  const [head, ...frame] = stderr.replace(/\n+$/, '').split('\n');
  if (!/^\[uxdsl\] Error: src\/a\.uxdsl:1:\d+: UXD_SASS: Undefined variable\.$/.test(head)) throw new Error(`head line: ${head}`);
  if (frame.length === 0) throw new Error('no frame after the head line');
  if (/#\{/.test(stderr)) throw new Error('the frame shows the protected text (#{…}), not the author\'s');
  const unindented = frame.find((line) => !line.startsWith('  '));
  if (unindented !== undefined) throw new Error(`a frame line is not indented by two spaces: ${unindented}`);
  if (!frame.some((line) => line.includes('palette(primary.main)'))) throw new Error('no frame line shows the author\'s palette(primary.main)');
  if (!frame.some((line) => /^ {4}src\/a\.uxdsl 1:\d+ +root stylesheet$/.test(line))) throw new Error('no stack line "src/a.uxdsl 1:<column>  root stylesheet"');
  return `${head.replace('[uxdsl] Error: ', '')}, framed (${frame.length} lines)`;
}

/**
 * S-4's verdict on `uxdsl build` of an entry whose line 1 @imports a partial:
 * exit 0 and the output written, with Dart Sass's deprecation printed once as
 * `[uxdsl] Warning: src/a.uxdsl:1:9: UXD_SASS_WARNING: [import] …`; with
 * `sass: { silenceDeprecations: ['import'] }` in the config (`silenced`), no
 * `[import]` line at all.
 */
function assertLocatedWarning(built, { silenced }) {
  const stderr = built.stderr || '';
  if (built.status !== 0) throw new Error(`exited ${built.status}: ${stderr.trim().split('\n')[0] || '(no stderr)'}`);
  if (!/^\[uxdsl\] (built|unchanged) out\/a\.css/m.test(built.stdout || '')) throw new Error(`stdout: ${(built.stdout || '').trim().split('\n')[0] || '(empty)'}`);
  const deprecations = stderr.split('\n').filter((line) => line.includes('[import]'));
  if (silenced) {
    if (deprecations.length) throw new Error(`sass.silenceDeprecations did not remove the deprecation: ${deprecations[0]}`);
    return 'no [import] warning with sass.silenceDeprecations';
  }
  if (deprecations.length !== 1) throw new Error(`${deprecations.length} [import] warnings, expected 1`);
  if (!/^\[uxdsl\] Warning: src\/a\.uxdsl:1:9: UXD_SASS_WARNING: \[import\] Sass @import rules are deprecated/.test(deprecations[0])) {
    throw new Error(`the warning is not located at src/a.uxdsl:1:9: ${deprecations[0]}`);
  }
  return 'the [import] deprecation at src/a.uxdsl:1:9';
}

/**
 * The project S-5 and S-6 build: styles/panel.uxdsl @uses styles/_partial.uxdsl,
 * which @imports styles/_legacy.uxdsl, so Dart Sass loads the three files and
 * reports one deprecation, at styles/_partial.uxdsl:1:9.
 */
const ADAPTER_PROJECT = {
  'styles/panel.uxdsl': "@use './partial';\n.panel { color: palette(primary.main); }\n",
  'styles/_partial.uxdsl': "@import './legacy';\n.partial { color: green; }\n",
  'styles/_legacy.uxdsl': '.legacy { color: olive; }\n',
  'main.js': "import './styles/panel.uxdsl';\n",
};
const ADAPTER_FILES = ['styles/_legacy.uxdsl', 'styles/_partial.uxdsl', 'styles/panel.uxdsl'];
const ADAPTER_DEPRECATION = 'styles/_partial.uxdsl:1:9: UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.';

function writeAdapterProject(root) {
  for (const [file, text] of Object.entries(ADAPTER_PROJECT)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
}

const posixPath = (file) => file.split(path.sep).join('/');
/** A source of a map webpack emitted, as a path from the project's directory: without `webpack://<namespace>/` and a leading `./`. */
const fromProject = (source) => String(source).replace(/^webpack:\/\/[^/]*\//, '').replace(/^\.\//, '');

/**
 * S-5's record of the webpack loader at `loader` in three real webpack builds
 * of the adapter project at `root` — MiniCssExtractPlugin, css-loader and
 * devtool 'source-map' — with no `sass` option, with
 * `sass: { silenceDeprecations: ['import'] }` and with an unknown sass key.
 * `tools` holds `webpack`, `MiniCssExtractPlugin`, css-loader's path
 * (`cssLoader`) and source-map-js's `SourceMapConsumer`.
 */
async function webpackAdapterRecord(tools, loader, root) {
  const { webpack, MiniCssExtractPlugin, cssLoader, SourceMapConsumer } = tools;
  writeAdapterProject(root);
  const build = (name, sass) => new Promise((resolve, reject) => {
    const outDir = path.join(root, `dist-webpack-${name}`);
    webpack({
      mode: 'development',
      devtool: 'source-map',
      context: root,
      entry: './main.js',
      output: { path: outDir, filename: 'bundle.js' },
      module: { rules: [{ test: /\.uxdsl$/, use: [MiniCssExtractPlugin.loader, cssLoader, { loader, options: { includeTheme: false, ...(sass ? { sass } : {}) } }] }] },
      plugins: [new MiniCssExtractPlugin({ filename: 'main.css' })],
      optimization: { minimize: false },
    }, (error, stats) => (error ? reject(error) : resolve({ stats, outDir })));
  });
  // The text the loader emitted, without webpack's "Module Warning (from …):" line.
  const warningsOf = (stats) => stats.compilation.warnings.map((warning) => warning.message.slice(warning.message.indexOf('\n') + 1));
  const firstError = (stats) => (stats.hasErrors() ? String(stats.compilation.errors[0].message) : null);

  const plain = await build('plain');
  if (plain.stats.hasErrors()) throw new Error(`webpack build failed: ${firstError(plain.stats).split('\n').slice(0, 2).join(' ')}`);
  const map = JSON.parse(fs.readFileSync(path.join(plain.outDir, 'main.css.map'), 'utf8'));
  const css = fs.readFileSync(path.join(plain.outDir, 'main.css'), 'utf8').split('\n');
  const line = css.findIndex((text) => text.includes('color: green'));
  const position = line === -1 ? null : new SourceMapConsumer(map).originalPositionFor({ line: line + 1, column: css[line].indexOf('color: green') });
  const silenced = await build('silenced', { silenceDeprecations: ['import'] });
  const unknownKey = await build('unknown-key', { bogus: 1 });
  return {
    warnings: warningsOf(plain.stats),
    silencedWarnings: silenced.stats.hasErrors() ? [`the build failed: ${firstError(silenced.stats).split('\n').slice(0, 2).join(' ')}`] : warningsOf(silenced.stats),
    unknownKeyError: firstError(unknownKey.stats),
    dependencies: [...plain.stats.compilation.fileDependencies].map((file) => posixPath(path.relative(root, file))).filter((file) => file.endsWith('.uxdsl')).sort(),
    mapSources: map.sources.filter((source) => source.endsWith('.uxdsl')).map(fromProject).sort(),
    lookup: position && position.source ? `${fromProject(position.source)}:${position.line}` : null,
  };
}

/**
 * S-5's verdict on `webpackAdapterRecord`: the deprecation in the @use'd
 * partial is one warning, at styles/_partial.uxdsl:1:9, which
 * sass.silenceDeprecations removes; an unknown sass key fails the module with
 * compile()'s message; the three files are file dependencies; and the CSS map
 * webpack emits names each at its path from the project's directory, the
 * partial's declaration mapping back to the partial's line 2.
 */
function assertWebpackAdapter(record) {
  if (JSON.stringify(record.warnings) !== JSON.stringify([ADAPTER_DEPRECATION])) throw new Error(`warnings: ${JSON.stringify(record.warnings)}, expected one, at styles/_partial.uxdsl:1:9`);
  if (record.silencedWarnings.length) throw new Error(`sass.silenceDeprecations did not remove the deprecation: ${JSON.stringify(record.silencedWarnings)}`);
  if (!/unknown sass option "bogus"/.test(record.unknownKeyError || '')) throw new Error(record.unknownKeyError ? `the unknown sass key failed with another message: ${record.unknownKeyError.split('\n').slice(0, 2).join(' ')}` : 'an unknown sass key did not fail the module');
  const missing = ADAPTER_FILES.filter((file) => !record.dependencies.includes(file));
  if (missing.length) throw new Error(`not a file dependency: ${missing.join(', ')} (${JSON.stringify(record.dependencies)})`);
  if (JSON.stringify(record.mapSources) !== JSON.stringify(ADAPTER_FILES)) throw new Error(`the CSS map's .uxdsl sources are ${JSON.stringify(record.mapSources)}, expected ${JSON.stringify(ADAPTER_FILES)}`);
  if (record.lookup !== 'styles/_partial.uxdsl:2') throw new Error(`the partial's declaration maps back to ${record.lookup}, expected styles/_partial.uxdsl:2`);
  return 'the [import] deprecation at styles/_partial.uxdsl:1:9, removed by sass.silenceDeprecations; an unknown sass key fails the module; the three files are dependencies; the CSS map names each at its path';
}

/**
 * S-6's record of the Vite plugin factory `plugin`, run by the Vite module
 * `vite`, for the adapter project at `root`: three real `vite build`s — no
 * `sass` option, `sass: { silenceDeprecations: ['import'] }`, an unknown sass
 * key — and the files a dev server's module graph lists under the CSS module
 * once it is served.
 */
async function viteAdapterRecord(vite, plugin, root) {
  writeAdapterProject(root);
  const build = async (name, sass) => {
    const warnings = [];
    try {
      await vite.build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [plugin({ includeTheme: false, ...(sass ? { sass } : {}) })],
        build: {
          outDir: `dist-vite-${name}`,
          emptyOutDir: true,
          rollupOptions: {
            input: path.join(root, 'main.js'),
            onwarn(warning) {
              if (warning.plugin === 'uxdsl') warnings.push(String(warning.message).replace(/^\[plugin uxdsl\] /, ''));
            },
          },
        },
      });
      return { warnings, error: null };
    } catch (error) {
      return { warnings, error: String(error && error.message ? error.message : error) };
    }
  };
  // Vite's config resolution sets process.env.NODE_ENV (to 'production' for a
  // build) when it is unset, and every process started after it would inherit
  // that: an `npm install` then leaves out devDependencies. The environment is
  // put back as it was.
  const environment = { ...process.env };
  try {
    const plain = await build('plain');
    if (plain.error) throw new Error(`vite build failed: ${plain.error.split('\n')[0]}`);
    const silenced = await build('silenced', { silenceDeprecations: ['import'] });
    const unknownKey = await build('unknown-key', { bogus: 1 });
    const server = await vite.createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false }, plugins: [plugin({ includeTheme: false })] });
    let watched = [];
    try {
      await server.transformRequest('/main.js');
      await server.transformRequest('/styles/panel.uxdsl?uxdsl&lang.css');
      const css = [...(server.moduleGraph.getModulesByFile(path.join(root, 'styles/panel.uxdsl')) || [])].find((mod) => mod.id && mod.id.includes('?uxdsl'));
      if (css) watched = [...css.importedModules].map((mod) => mod.file).filter(Boolean).map((file) => posixPath(path.relative(root, file))).sort();
    } finally {
      await server.close();
    }
    return {
      warnings: plain.warnings,
      silencedWarnings: silenced.error ? [`the build failed: ${silenced.error.split('\n')[0]}`] : silenced.warnings,
      unknownKeyError: unknownKey.error,
      watched,
    };
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
    Object.assign(process.env, environment);
  }
}

/**
 * S-6's verdict on `viteAdapterRecord`: the deprecation in the @use'd partial
 * is one warning, at styles/_partial.uxdsl:1:9, which sass.silenceDeprecations
 * removes; an unknown sass key fails the build with compile()'s message; and
 * the dev server's module graph lists the three files under the CSS module,
 * so an edit to any of them updates it.
 */
function assertViteAdapter(record) {
  if (JSON.stringify(record.warnings) !== JSON.stringify([ADAPTER_DEPRECATION])) throw new Error(`warnings: ${JSON.stringify(record.warnings)}, expected one, at styles/_partial.uxdsl:1:9`);
  if (record.silencedWarnings.length) throw new Error(`sass.silenceDeprecations did not remove the deprecation: ${JSON.stringify(record.silencedWarnings)}`);
  if (!/unknown sass option "bogus"/.test(record.unknownKeyError || '')) throw new Error(record.unknownKeyError ? `the unknown sass key failed with another message: ${record.unknownKeyError.split('\n')[0]}` : 'an unknown sass key did not fail the build');
  const missing = ADAPTER_FILES.filter((file) => !record.watched.includes(file));
  if (missing.length) throw new Error(`not in the dev server's module graph under the CSS module: ${missing.join(', ')} (${JSON.stringify(record.watched)})`);
  return 'the [import] deprecation at styles/_partial.uxdsl:1:9, removed by sass.silenceDeprecations; an unknown sass key fails the build; the three files are in the dev server\'s module graph';
}

/** N-02's verdict on compile() of a file whose first line @imports a missing partial. */
function assertMissingImport(error) {
  if (!error) throw new Error('compiled');
  const message = String(error.message).split('\n')[0];
  if (error.code !== 'UXD_SASS') throw new Error(`code ${error.code}: ${message}`);
  if (!message.includes('Can\'t find stylesheet to import.')) throw new Error(`message: ${message}`);
  const where = `${path.basename(String(error.file))}:${error.line}:${error.column}`;
  if (where !== 'missing-partial.uxdsl:1:9') throw new Error(`located at ${where}`);
  return `UXD_SASS at ${where}: Can't find stylesheet to import.`;
}

/**
 * What is wrong with a source map's record of the author file `name`: the
 * sources hold no file: URL, no absolute path and no duplicate, and name the
 * file once; its sourcesContent is the file's text; every mapping into it lies
 * inside that text.
 */
function mapIntegrityProblems(map, name, text, SourceMapConsumer) {
  const problems = [];
  const sources = map.sources || [];
  const list = JSON.stringify(sources);
  if (sources.some((source) => source.startsWith('file:'))) problems.push(`a file: URL among the sources ${list}`);
  if (sources.some((source) => path.isAbsolute(source))) problems.push(`an absolute path among the sources ${list}`);
  if (new Set(sources).size !== sources.length) problems.push(`a source listed twice: ${list}`);
  const named = (source) => source === name || source.endsWith(`/${name}`);
  const own = sources.filter(named);
  if (own.length !== 1) return [...problems, `${name} is named ${own.length} times among the sources ${list}`];
  if (!map.sourcesContent || map.sourcesContent[sources.indexOf(own[0])] !== text) problems.push(`the sourcesContent of ${own[0]} is not the file's text`);
  const lines = text.split('\n');
  const consumer = new SourceMapConsumer(map);
  const resolved = consumer.sources.find(named);
  consumer.eachMapping((m) => {
    if (m.source !== resolved) return;
    const line = lines[m.originalLine - 1];
    if (line === undefined || m.originalColumn > line.length) problems.push(`a mapping into ${own[0]} at ${m.originalLine}:${m.originalColumn} lies outside its text`);
  });
  return problems;
}

/** The directory of the Dart Sass package the installed uxdsl resolves (its `exports` map hides `sass/package.json`). */
function sassPackageDir(pkgDir) {
  let dir = path.dirname(createRequire(path.join(pkgDir, 'package.json')).resolve('sass'));
  while (!fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir);
  return dir;
}

function withImportsBehindFirstRule(postcss, css) {
  const root = postcss.parse(css);
  const imports = root.nodes.filter((node) => node.type === 'atrule' && node.name === 'import');
  const firstRule = root.nodes.find((node) => node.type === 'rule');
  if (!firstRule || !imports.length) throw new Error('expected a rule and at least one @import');
  imports.forEach((node) => node.remove());
  imports.reverse().forEach((node) => root.insertAfter(firstRule, node));
  return root.toString();
}

async function googleFontRequests(browser, css) {
  const page = await browser.newPage();
  const requests = [];
  await page.route('**://fonts.googleapis.com/**', (route) => {
    requests.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'text/css', body: '/* local font stub */' });
  });
  await page.setContent(`<style>${css}</style><p class="a">probe</p>`);
  await page.waitForTimeout(500);
  await page.close();
  return requests;
}

function repoNode(label, argv, timeout = 300000) {
  const run = spawnSync(process.execPath, argv, { cwd: REPO_ROOT, encoding: 'utf8', timeout, maxBuffer: 1 << 26 });
  if (run.status !== 0) {
    const tail = `${run.stdout || ''}${run.stderr || ''}`.trim().split('\n').slice(-3).join(' | ');
    throw new Error(`${label} exited ${run.status}: ${tail}`);
  }
  return run.stdout;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function waitFor(predicate, { timeout = 20000, interval = 150 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      let value;
      try { value = predicate(); } catch (error) { reject(error); return; }
      if (value) { resolve(value); return; }
      if (Date.now() - start > timeout) { reject(new Error('waitFor timed out')); return; }
      setTimeout(tick, interval);
    };
    tick();
  });
}

async function main() {
  const installed = packAndInstall({ tmpPrefix: 'uxdsl-1.0-gate-' });
  const { dir, run, req, version, pack } = installed;
  const cli = path.join(dir, 'node_modules/uxdsl/bin/uxdsl.js');
  const pkgDir = path.join(dir, 'node_modules/uxdsl');
  const postcss = req('postcss');
  const plugin = req('uxdsl/postcss');
  const core = req('uxdsl');
  const themeApi = req('uxdsl/theme');
  const engine = req('uxdsl/engine');
  const runtimeApi = req('uxdsl/runtime');

  /** A fresh project directory under the install, resolving `uxdsl` from it. */
  let projects = 0;
  const project = (name) => {
    const root = path.join(dir, 'projects', `${String(++projects).padStart(2, '0')}-${name}`);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name, version: '1.0.0', private: true, devDependencies: { uxdsl: version } }));
    const p = {
      root,
      write: (rel, value) => { const full = path.join(root, rel); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, value); },
      read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8'),
      exists: (rel) => fs.existsSync(path.join(root, rel)),
      uxdsl: (...cliArgs) => run(process.execPath, [cli, ...cliArgs], root),
      spawn: (...cliArgs) => spawnSync(process.execPath, [cli, ...cliArgs], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }),
    };
    return p;
  };
  const failsWith = (fn, pattern, label) => {
    try { fn(); } catch (error) {
      const output = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`;
      if (!pattern.test(output)) throw new Error(`${label}: wrong message — ${output.trim().split('\n')[0]}`);
      return true;
    }
    throw new Error(`${label}: exited 0`);
  };
  const compileCss = (css, options = {}) => postcss([plugin(options)]).process(css, { from: 'gate.uxdsl' }).then((r) => r.css);

  if (args.has('--write-contrast-baseline')) {
    const report = contrastReport(themeApi, req);
    if (report.exceptionIssues.length) throw new Error(`contrast exceptions invalid: ${report.exceptionIssues.join('; ')}`);
    const pinned = contrastBaselineOf(report, version);
    fs.writeFileSync(BASELINE, `${JSON.stringify(pinned, null, 2)}\n`);
    console.log(`Pinned ${pinned.count} failing and ${pinned.exceptedCount} excepted contrast pairs to ${path.relative(REPO_ROOT, BASELINE)}.`);
    return;
  }

  console.log(`\nGate for uxdsl@${version}, from ${path.basename(installed.tarball)} (${pack.size} bytes packed, ${pack.unpackedSize} unpacked, ${pack.entryCount} files) in ${dir}\n`);

  // --- The install ---------------------------------------------------------
  console.log('The install:');
  await check('I-1', '`npm i -D uxdsl` installs one package with its postcss peer and no optional bundler', () => {
    const nm = path.join(dir, 'node_modules');
    if (!fs.existsSync(path.join(nm, 'postcss/package.json'))) throw new Error('the postcss peer was not installed');
    for (const optional of ['vite', 'webpack']) if (fs.existsSync(path.join(nm, optional))) throw new Error(`the optional peer ${optional} was installed`);
    for (const old of ['postcss-uxdsl', 'uxdsl-core', 'uxdsl-cli', 'vite-plugin-uxdsl', 'uxdsl-webpack-loader']) if (fs.existsSync(path.join(nm, old))) throw new Error(`${old} is installed`);
    if (!fs.existsSync(path.join(nm, '.bin/uxdsl'))) throw new Error('no node_modules/.bin/uxdsl');
    return `postcss ${JSON.parse(fs.readFileSync(path.join(nm, 'postcss/package.json'), 'utf8')).version} as the peer; bin linked`;
  });
  await check('I-2', 'one copy of postcss: the plugin resolves the project\'s own (replaces N-06)', () => {
    const fromPlugin = createRequire(req.resolve('uxdsl/postcss')).resolve('postcss');
    if (fs.realpathSync(fromPlugin) !== fs.realpathSync(req.resolve('postcss'))) throw new Error(`uxdsl resolves ${fromPlugin}`);
    if (fs.existsSync(path.join(pkgDir, 'node_modules/postcss'))) throw new Error('a nested postcss under uxdsl');
    return 'the plugin and the project share one postcss';
  });
  await check('I-3', 'every exports subpath resolves from the project, with its types first and present (UX-18)', () => {
    const exportsMap = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).exports;
    for (const [subpath, conditions] of Object.entries(exportsMap)) {
      const specifier = subpath === '.' ? 'uxdsl' : `uxdsl/${subpath.slice(2)}`;
      req.resolve(specifier);
      if (typeof conditions === 'object') {
        if (Object.keys(conditions)[0] !== 'types') throw new Error(`exports["${subpath}"] lists types after another condition`);
        if (!fs.existsSync(path.join(pkgDir, conditions.types))) throw new Error(`exports["${subpath}"].types is not in the tarball`);
      }
    }
    for (const file of ['dist/types.d.ts', 'dist/entries/config.d.ts', 'schema/theme.schema.json']) if (!fs.existsSync(path.join(pkgDir, file))) throw new Error(`missing ${file}`);
    if (typeof req('uxdsl/config').defineConfig !== 'function') throw new Error('defineConfig missing');
    return `${Object.keys(exportsMap).length} subpaths`;
  });
  await check('I-4', 'the tarball ships code, the theme JSON, the schema, the agent guide, README and LICENSE — no tests, images or CHANGELOG (UX-21)', () => {
    const walk = (root) => fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.name === 'node_modules' ? [] : entry.isDirectory() ? walk(path.join(root, entry.name)) : [path.join(root, entry.name)]);
    const shipped = walk(pkgDir).map((file) => path.relative(pkgDir, file));
    const offending = shipped.filter((file) => /\.(png|jpe?g|gif)$/i.test(file) || /(^|\/)test\/|\.test\.js$/.test(file) || file === 'CHANGELOG.md');
    if (offending.length) throw new Error(`ships ${offending.slice(0, 3).join(', ')}`);
    for (const file of ['README.md', 'LICENSE', 'docs/agent-guide.md', 'bin/uxdsl.js']) if (!shipped.includes(file)) throw new Error(`does not ship ${file}`);
    return `${shipped.length} files`;
  });
  await check('I-5', '`uxdsl --version` prints the one version', () => {
    const out = run(process.execPath, [cli, '--version']);
    if (out !== `uxdsl ${version}\n`) throw new Error(`got ${JSON.stringify(out)}`);
    return out.trim();
  });
  await check('I-6', 'a browser bundle of the installed uxdsl/runtime contains no PostCSS module (audit R5)', async () => {
    const esbuild = instrument('esbuild');
    const result = await esbuild.build({
      stdin: { contents: "export { applyTheme, getAppliedTheme, resetTheme, subscribeTheme, loadPersistedTheme } from 'uxdsl/runtime';", resolveDir: dir, loader: 'js' },
      bundle: true, minify: true, format: 'esm', platform: 'browser', write: false, metafile: true, logLevel: 'silent',
    });
    const inputs = Object.keys(result.metafile.inputs);
    const postcssInputs = inputs.filter((input) => /(^|\/)node_modules\/postcss\//.test(input));
    if (postcssInputs.length) throw new Error(`PostCSS in the bundle: ${postcssInputs[0]}`);
    if (!inputs.some((input) => input.includes('node_modules/uxdsl/'))) throw new Error('control: the bundle did not come from the installed package');
    return `${result.outputFiles[0].contents.length} bytes minified, ${inputs.length} modules`;
  });

  // --- beta.2: CLI, PostCSS and runtime agree in an installed project ------
  console.log('\nCLI, PostCSS and the runtime agree (from verify:beta2):');
  const vars = (css) => cascadedVariables(css, postcss).filter((line) => line.includes('--uxdsl__') && line.startsWith('rule::root'));
  {
    const p = project('parity');
    let built = '';
    await check('B2-a', 'init + `npm run uxdsl:build` in an installed project; zero-config :root equals generateThemeCss()', () => {
      p.uxdsl('init');
      run('npm', ['run', 'uxdsl:build'], p.root);
      built = p.read('src/uxdsl.css');
      if (JSON.stringify(vars(built)) !== JSON.stringify(vars(themeApi.generateThemeCss()))) throw new Error('the CLI output and generateThemeCss() disagree');
      return `${vars(built).length} variables`;
    });
    const source = '.card { @ds-surface(contained); } .button { @ds-button(contained primary 2); } .input { @ds-input(outlined primary 2); } .title { @ds-typo(h1); }';
    const theme = { spacing: { 4: '0.875rem' }, palette: { primary: { main: '#123456' } }, fonts: { families: { ui: 'var(--font-geist-sans)' } } };
    const references = { externalTokens: ['--font-geist-sans'] };
    const configure = (themeValue, referencesValue) => {
      p.write('uxdsl.theme.cjs', `module.exports = ${JSON.stringify(themeValue)};\n`);
      p.write('uxdsl.config.cjs', `module.exports = ${JSON.stringify({ entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', ...(referencesValue ? { references: referencesValue } : {}) })};\n`);
    };
    let partial = '';
    await check('B2-b', 'a partial theme with externals: CLI, generateThemeCss and the plugin emit the same :root; a component entry none', async () => {
      p.write('src/uxdsl-entry.uxdsl', source);
      configure(theme, references);
      p.uxdsl('build');
      partial = p.read('src/uxdsl.css');
      if (!/--uxdsl__font__ui:\s*var\(--font-geist-sans\)/.test(partial)) throw new Error('the external font token is not in the output');
      if (JSON.stringify(vars(partial)) !== JSON.stringify(vars(themeApi.generateThemeCss(theme, references)))) throw new Error('CLI vs generateThemeCss');
      const direct = await postcss([plugin({ theme, references })]).process(source, { from: undefined });
      if (JSON.stringify(vars(partial)) !== JSON.stringify(vars(direct.css))) throw new Error('CLI vs the plugin');
      const component = await postcss([plugin({ theme, references, includeTheme: false })]).process(source, { from: undefined });
      if (/:root/.test(component.css)) throw new Error('includeTheme: false emitted :root');
      return 'three paths agree';
    });
    await check('B2-c', 'without its externals the build fails with UXD_REFERENCE_MISSING and keeps the previous output', () => {
      configure(theme);
      failsWith(() => p.uxdsl('build'), /UXD_REFERENCE_MISSING/, 'missing external');
      if (p.read('src/uxdsl.css') !== partial) throw new Error('a failed build rewrote the output');
      return 'refused; output preserved';
    });
    await check('B2-d', 'an undefined palette family in a source fails with UXD_PALETTE_REFERENCE', () => {
      configure({ fonts: { families: { ui: 'var(--font-geist-sans, Arial, sans-serif)' } } });
      p.uxdsl('build');
      p.write('src/uxdsl-entry.uxdsl', '.bad { color: palette(not-defined.main); }');
      return failsWith(() => p.uxdsl('build'), /UXD_PALETTE_REFERENCE/, 'undefined palette') && 'refused';
    });
    await check('B2-e', 'the theme JSON files are exports; the removed legacy theme files are not shipped', () => {
      if (!req('uxdsl/theme/base.json').palette) throw new Error('theme/base.json has no palette');
      if (!Array.isArray(req('uxdsl/theme/base.contrast-exceptions.json'))) throw new Error('contrast exceptions are not an array');
      for (const file of ['theme-manifest.json', 'default-spacing.css', 'default-typography.uxdsl', 'default-buttons.uxdsl']) {
        let resolved = false;
        try { req.resolve(`uxdsl/theme/${file}`); resolved = true; } catch { /* expected */ }
        if (resolved) throw new Error(`${file} is still shipped`);
      }
      return 'two exports, no legacy files';
    });
  }

  // --- beta.3: one theme entry, several component entries -------------------
  console.log('\nMulti-entry builds (from verify:beta3):');
  {
    const p = project('builds');
    p.write('uxdsl.config.cjs', `module.exports = {
  builds: [
    { entry: './src/theme.uxdsl', outFile: './src/theme.css' },
    { entry: './src/panel-a.uxdsl', outFile: './src/panel-a.module.css', includeTheme: false },
    { entry: './src/panel-b.uxdsl', outFile: './src/panel-b.module.css', includeTheme: false },
    { entry: './src/panel-c.uxdsl', outFile: './src/panel-c.module.css', includeTheme: false },
    { entry: './src/panel-d.uxdsl', outFile: './src/panel-d.module.css', includeTheme: false },
  ],
  references: { externalTokens: ['--font-geist-sans'] },
  watch: ['src/**/*.uxdsl'],
};\n`);
    p.write('uxdsl.theme.cjs', "module.exports = { palette: { primary: { main: '#123456' } }, fonts: { families: { ui: 'var(--font-geist-sans)' } }, breakpoints: { xl: 1440 } };\n");
    p.write('src/theme.uxdsl', '/* theme-only entry */');
    p.write('src/panel-a.uxdsl', '.card { @ds-surface(contained); width: xs(100%) xl(50%); }');
    p.write('src/panel-b.uxdsl', '.button { @ds-button(contained primary 2); }');
    p.write('src/panel-c.uxdsl', '.input { @ds-input(outlined primary 2); }');
    p.write('src/panel-d.uxdsl', '.title { @ds-typo(h1); }');
    const outputs = {};
    const readAll = () => Object.fromEntries(['theme.css', 'panel-a.module.css', 'panel-b.module.css', 'panel-c.module.css', 'panel-d.module.css'].map((f) => [f, p.read(`src/${f}`)]));
    await check('B3-a', 'exactly one of five CLI-built entries defines :root', () => {
      p.uxdsl('build');
      Object.assign(outputs, readAll());
      const withRoot = Object.entries(outputs).filter(([, css]) => /:root/.test(css)).map(([file]) => file);
      if (withRoot.join() !== 'theme.css') throw new Error(`:root in ${withRoot.join(', ')}`);
      return 'theme.css only';
    });
    await check('B3-b', 'a breakpoint declared only in the theme file reaches a component entry', () => {
      if (!/@media \(min-width: 1440px\)/.test(outputs['panel-a.module.css'])) throw new Error('no 1440px query in panel-a');
      return '1440px in panel-a';
    });
    await check('B3-c', 'a partial theme with externals compiles through the builds array', () => {
      if (!/--uxdsl__font__ui:\s*var\(--font-geist-sans\)/.test(outputs['theme.css'])) throw new Error('no font token');
      return 'font token emitted';
    });
    await check('B3-d', 'a failed multi-entry build leaves every previous output untouched', () => {
      p.write('src/panel-b.uxdsl', '.bad { color: palette(not-defined.main); }');
      failsWith(() => p.uxdsl('build'), /UXD_PALETTE_REFERENCE/, 'bad panel');
      const after = readAll();
      for (const file of ['theme.css', 'panel-a.module.css']) if (after[file] !== outputs[file]) throw new Error(`${file} changed`);
      return 'untouched';
    });
    await check('B3-e', '--no-include-theme overrides every builds[] entry, the theme entry included', () => {
      p.write('src/panel-b.uxdsl', '.button { @ds-button(contained primary 2); }');
      p.uxdsl('build', '--no-include-theme');
      if (/:root/.test(p.read('src/theme.css'))) throw new Error('theme.css still has :root');
      return 'no :root anywhere';
    });
  }

  // --- beta.4: --multi, strict themes, watch -------------------------------
  console.log('\ninit --multi, scoped strict themes and watch (from verify:beta4):');
  {
    const p = project('multi');
    let initialTheme = '';
    await check('B4-a', '`init --multi` scaffolds a builds project that compiles: :root in the theme entry only', () => {
      p.uxdsl('init', '--multi');
      if (!/builds:\s*\[/.test(p.read('uxdsl.config.cjs'))) throw new Error('no builds array');
      p.uxdsl('build');
      initialTheme = p.read('src/theme.css');
      if (!/:root/.test(initialTheme) || /:root/.test(p.read('src/panel-a.css'))) throw new Error(':root misplaced');
      return 'theme.css + panel-a.css';
    });
    const DEFAULT_THEME = themeApi.DEFAULT_THEME;
    await check('B4-b', '--strict-theme=palette fails on a partial palette reached through a nested require(), writing nothing', () => {
      p.write('theme-data.json', JSON.stringify({ palette: { primary: { main: '#123456' } } }));
      p.write('uxdsl.theme.cjs', "module.exports = require('./theme-data.json');\n");
      p.write('uxdsl.config.cjs', "module.exports = { builds: [{ entry: './src/theme.uxdsl', outFile: './src/theme.css' }, { entry: './src/panel-a.uxdsl', outFile: './src/panel-a.css', includeTheme: false }], watch: ['src/**/*.uxdsl'] };\n");
      failsWith(() => p.uxdsl('build', '--strict-theme=palette'), /--strict-theme \(scoped to: palette\):.*palette/, 'partial palette');
      if (p.read('src/theme.css') !== initialTheme) throw new Error('the failed build wrote output');
      return 'refused before writing';
    });
    await check('B4-c', '--strict-theme=palette passes once every palette key is explicit', () => {
      p.write('theme-data.json', JSON.stringify({ palette: DEFAULT_THEME.palette }));
      p.uxdsl('build', '--strict-theme=palette');
      return 'passes';
    });
    await check('B4-d', '`uxdsl build --watch` rebuilds when only the theme file\'s nested JSON changes', async () => {
      const palette = (main) => JSON.stringify({ palette: { ...DEFAULT_THEME.palette, primary: { ...DEFAULT_THEME.palette.primary, main } } });
      p.write('theme-data.json', palette('#111111'));
      const child = spawn(process.execPath, [cli, 'build', '--watch'], { cwd: p.root, stdio: 'pipe' });
      try {
        await waitFor(() => p.read('src/theme.css').includes('#111111'));
        await delay(1000);
        p.write('theme-data.json', palette('#222222'));
        await waitFor(() => p.read('src/theme.css').includes('#222222'));
        if (p.read('src/theme.css').includes('#111111')) throw new Error('stale value kept');
      } finally {
        child.kill();
      }
      return 'rebuilt from the nested JSON';
    });
  }

  // --- beta.5: scoped strict themes, unknown families ----------------------
  console.log('\nScoped --strict-theme and unknown families (from verify:beta5):');
  {
    const p = project('strict');
    const DEFAULT_THEME = themeApi.DEFAULT_THEME;
    p.write('uxdsl.config.cjs', "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css' };\n");
    p.write('src/uxdsl-entry.uxdsl', '/* zero-config */');
    p.write('uxdsl.theme.cjs', `module.exports = { palette: ${JSON.stringify(DEFAULT_THEME.palette)}, typography_details: { h2: { fontSize: '2.2rem' } } };\n`);
    await check('B5-a', 'a bare --strict-theme is refused, naming the scoped form', () => failsWith(() => p.uxdsl('build', '--strict-theme'),
      /--strict-theme needs a scope: name the families that must be completely declared, e\.g\. --strict-theme=palette,breakpoints/, 'bare') && 'refused');
    await check('B5-b', '--strict-theme=palette passes with a partial typography, on build and on theme', () => {
      p.uxdsl('build', '--strict-theme=palette');
      p.uxdsl('theme', '--strict-theme=palette');
      return 'both pass';
    });
    await check('B5-c', 'an unknown family warns without blocking the build; a valid typography tag does not warn', () => {
      p.write('uxdsl.theme.cjs', `module.exports = { palette: ${JSON.stringify(DEFAULT_THEME.palette)}, typography_details: { h9: { fontSize: '1rem' } }, color: { primary: '#123456' } };\n`);
      const built = p.spawn('build');
      const output = `${built.stdout}${built.stderr}`;
      if (built.status !== 0) throw new Error(`exited ${built.status}`);
      if (!/Unknown theme family "color"/.test(output)) throw new Error('no unknown-family warning');
      if (/Unknown typography_details key "h9"/.test(output)) throw new Error('h9 warned');
      return 'warned, built';
    });
  }

  // --- beta.6: the audit regressions, from the installed package -----------
  console.log('\nAudit regressions (from verify:beta6):');
  await check('UX-01', 'modes is a known family; a real typo still warns', () => {
    const result = themeApi.validateTheme({ modes: { dark: { palette: {} } } });
    if (result.warnings.some((w) => /Unknown theme family/.test(w.message))) throw new Error('modes warns');
    if (!themeApi.validateTheme({ palete: {} }).warnings.map((w) => w.path).includes('palete')) throw new Error('a typo stopped warning');
    return 'typo still warns';
  });
  {
    const p = project('audit');
    p.write('src/url-case.uxdsl', '.a { background: url(https://example.com/a.png); }\n/* see https://example.com/docs */\n.b { color: red; }\n');
    await check('UX-02', 'url(https://…) and URL comments survive compile()', async () => {
      const out = await core.compile({ entry: path.join(p.root, 'src/url-case.uxdsl') }, { theme: {}, includeTheme: false });
      if (!out.css.includes('url(https://example.com/a.png)') || !out.css.includes('https://example.com/docs')) throw new Error('truncated');
      return 'intact';
    });
    p.write('src/missing-partial.uxdsl', '@import "./nope.uxdsl";\n.a { color: red; }\n');
    await check('N-02', 'a missing @import fails as Dart Sass\'s UXD_SASS at the @import instead of reaching the browser', async () => {
      let error;
      try { await core.compile({ entry: path.join(p.root, 'src/missing-partial.uxdsl') }, { theme: {}, includeTheme: false }); } catch (caught) { error = caught; }
      return assertMissingImport(error);
    });
    await check('UX-03', 'errors carry file, line and column', async () => {
      try { await compileCss('.a { padding: density(999); }'); } catch (error) {
        const located = error.file || error.source || (error.input && error.input.file);
        if (!located || error.line === undefined) throw new Error(`no location on: ${error.message.split('\n')[0]}`);
        return `${path.basename(String(located))}:${error.line}`;
      }
      throw new Error('compiled');
    });
    p.write('uxdsl.config.cjs', "module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };\n");
    p.write('src/entry.uxdsl', '.a { color: palette(primary.main); }\n');
    await check('UX-04', 'unknown flags and bad flag values fail with a message', () => {
      failsWith(() => p.uxdsl('build', '--strict-thme'), /Unknown option|Did you mean/, 'nonexistent flag');
      failsWith(() => p.uxdsl('build', '--strict-theme=pallete'), /pallete|Did you mean/, 'unknown family');
      failsWith(() => p.uxdsl('theme', '--strict-theme=,'), /strict/i, 'stray comma');
      return 'all three rejected';
    });
    await check('UX-12', '--no-include-theme really suppresses :root', () => {
      p.uxdsl('build', '--no-include-theme');
      if (/:root/.test(p.read('src/out.css'))) throw new Error(':root emitted');
      p.uxdsl('build');
      if (!/:root/.test(p.read('src/out.css'))) throw new Error('the default stopped emitting :root');
      return 'suppressed, and emitted by default';
    });
    await check('UX-08', 'theme --diff summarises a mixed entry on stderr; stdout stays JSON', () => {
      p.write('uxdsl.theme.cjs', "module.exports = { palette: { primary: { main: '#00aa00' } } };\n");
      const spawned = p.spawn('theme', '--diff');
      if (spawned.status !== 0) throw new Error(`exited ${spawned.status}`);
      JSON.parse(spawned.stdout);
      if (!/mixes your values/.test(spawned.stderr)) throw new Error('no mix summary');
      return 'summary on stderr, JSON on stdout';
    });
    await check('UX-08b', 'theme --contrast reports the pairs a partial override introduces', () => {
      const spawned = p.spawn('theme', '--contrast');
      if (spawned.status === 0) throw new Error('a failing theme exited 0');
      const report = JSON.parse(spawned.stdout);
      const primary = report.failures.filter((f) => f.tone === 'primary' && f.pair === 'text');
      if (!primary.length) throw new Error('the overridden tone was not reported');
      fs.rmSync(path.join(p.root, 'uxdsl.theme.cjs'));
      return `${report.failures.length} pairs, ${primary.length} on the overridden tone`;
    });
    await check('UX-10', 'reference validation stays near-linear', async () => {
      const block = (i) => `.c-${i} { padding: density(2); color: palette(primary); background: palette(surface); border-radius: radius(2); }\n`;
      const timeFor = async (count) => {
        p.write(`src/perf-${count}.uxdsl`, Array.from({ length: count }, (_, i) => block(i)).join(''));
        const started = process.hrtime.bigint();
        await core.compile({ entry: path.join(p.root, `src/perf-${count}.uxdsl`) }, { theme: {}, includeTheme: true });
        return Number(process.hrtime.bigint() - started) / 1e6;
      };
      await timeFor(200);
      const growth = (await timeFor(800)) / (await timeFor(400));
      if (growth > 3) throw new Error(`doubling cost x${growth.toFixed(2)}`);
      return `x${growth.toFixed(2)} per doubling`;
    });
    await check('UX-16', '$vars in responsive values expand through compile()', async () => {
      p.write('src/vars.uxdsl', '$gap: xs(1rem) md(2rem);\n.a { gap: $gap; }\n');
      const out = await core.compile({ entry: path.join(p.root, 'src/vars.uxdsl') }, { theme: {}, includeTheme: false });
      if (/xs\(|md\(/.test(out.css) || !/@media/.test(out.css)) throw new Error('not expanded');
      return 'expanded';
    });
    await check('UX-20', 'source maps: external, inline, and off byte-identical; the map names map.uxdsl once, relative, with its text, every mapping inside it', () => {
      p.write('src/map.uxdsl', '.m { padding: density(2); }\n');
      p.write('uxdsl.config.cjs', "module.exports = { entry: './src/map.uxdsl', outFile: './src/map.css' };\n");
      p.uxdsl('build');
      const plain = p.read('src/map.css');
      p.uxdsl('build', '--sourcemap');
      const external = p.read('src/map.css');
      if (!p.exists('src/map.css.map') || !/sourceMappingURL=map\.css\.map/.test(external)) throw new Error('no external map');
      const map = JSON.parse(p.read('src/map.css.map'));
      if (map.version !== 3 || !map.sources.some((s) => s.endsWith('map.uxdsl')) || map.sources.some((s) => path.isAbsolute(s))) throw new Error(`bad map sources ${map.sources}`);
      const { SourceMapConsumer, SourceMapGenerator } = instrument('source-map-js');
      const text = p.read('src/map.uxdsl');
      const integrity = mapIntegrityProblems(map, 'map.uxdsl', text, SourceMapConsumer);
      if (integrity.length) throw new Error(integrity[0]);
      const planted = SourceMapGenerator.fromSourceMap(new SourceMapConsumer(map));
      planted.addMapping({ generated: { line: 1, column: 0 }, original: { line: 5, column: 0 }, source: map.sources.find((s) => s.endsWith('map.uxdsl')) });
      if (!mapIntegrityProblems(planted.toJSON(), 'map.uxdsl', text, SourceMapConsumer).length) throw new Error('negative control: a mapping past the file\'s text was not reported');
      // Dart Sass lays the rule out over several lines: the declaration is on its own line after `.m {`.
      const lines = external.split('\n');
      const rule = lines.findIndex((l) => l.includes('.m {'));
      const index = lines.findIndex((l, i) => i > rule && l.includes('padding'));
      const original = new SourceMapConsumer(map).originalPositionFor({ line: index + 1, column: lines[index].indexOf('padding') });
      if (!original.source || !original.source.endsWith('map.uxdsl')) throw new Error(`position resolved to ${original.source}`);
      p.uxdsl('build', '--sourcemap=inline');
      if (!/sourceMappingURL=data:application\/json/.test(p.read('src/map.css')) || p.exists('src/map.css.map')) throw new Error('inline mode wrong');
      p.uxdsl('build', '--no-sourcemap');
      if (p.read('src/map.css') !== plain) throw new Error('off is not byte-identical');
      return `position -> ${original.source}:${original.line}; sources ${JSON.stringify(map.sources)}, every mapping inside map.uxdsl's text`;
    });
    await check('UX-13', 'init writes no breakpoints, so the theme file decides', () => {
      const q = project('init-probe');
      q.uxdsl('init');
      if (/breakpoints/.test(q.read('uxdsl.config.cjs'))) throw new Error('init writes breakpoints');
      return 'absent';
    });
  }
  await check('UX-05', 'functional pseudo-classes are not split by state expansion', async () => {
    const css = await compileCss('.btn:is(.x, .y) { @ds-button(contained); }', { includeTheme: false });
    if (/\.btn:is\(\.x:hover/.test(css) || !/:is\(\.x, \.y\):hover/.test(css)) throw new Error(css.slice(0, 120));
    return 'intact';
  });
  await check('UX-07', '!important survives into every responsive breakpoint', async () => {
    const importants = ((await compileCss('.a { padding: xs(1rem) md(2rem) !important; }', { includeTheme: false })).match(/!important/g) || []).length;
    if (importants < 2) throw new Error(`only ${importants}`);
    return `${importants} occurrences`;
  });
  await check('UX-06', 'leftover and misspelled directives fail instead of passing through', async () => {
    for (const [source, label] of [['@ds-surface(contained);', 'root-level'], ['.a { @ds-surfce(contained); }', 'misspelled']]) {
      let failed = false;
      try { await compileCss(source, { includeTheme: false }); } catch { failed = true; }
      if (!failed) throw new Error(`${label} directive compiled`);
    }
    return 'both rejected';
  });
  await check('N-01', 'an unknown breakpoint function is an error', async () => {
    try { await compileCss('.a { padding: xs(1rem) xxl(2rem); }', { includeTheme: false }); } catch { return 'rejected'; }
    throw new Error('xxl() reached the CSS');
  });
  await check('UX-15', 'CSS relative color syntax passes through', async () => {
    const css = await compileCss('.a { color: color(from red srgb r g b / 0.5); }', { includeTheme: false });
    if (!/from red srgb/.test(css)) throw new Error(css.slice(0, 100));
    return 'passed through';
  });
  await check('UX-09', '@ds-typo invents no fallback values', async () => {
    const css = await compileCss('.t { @ds-typo(caption); }', { includeTheme: false });
    for (const invented of [', auto)', ', none)', ', 0.8)', ', normal)']) if (css.includes(invented)) throw new Error(`emits ${invented}`);
    return 'none';
  });
  await check('UX-19', '@ds-typo emits one declaration per defined field', async () => {
    const declarations = ((await compileCss('.t { @ds-typo(h1); }', { includeTheme: false })).match(/:\s*var\(/g) || []).length;
    const fields = Object.keys(engine.resolveTypographyRole(themeApi.DEFAULT_THEME.typography_details, 'h1'));
    if (declarations !== fields.length) throw new Error(`${declarations} vs ${fields.length}`);
    return `${declarations} = the theme's own ${fields.length} fields`;
  });
  await check('N-07', 'resolveTheme(undefined) is the packaged base JSON', () => {
    const base = req('uxdsl/theme/base.json');
    const resolved = themeApi.resolveTheme(undefined);
    for (const family of Object.keys(base)) if (JSON.stringify(resolved[family]) !== JSON.stringify(base[family])) throw new Error(`${family} differs`);
    return `${Object.keys(base).length} families, ${Object.keys(base.palette).length} palette families`;
  });
  await check('N-08', 'the contrast gate runs over the packaged base and its shipped exceptions all match', () => {
    const report = contrastReport(themeApi, req);
    if (typeof report.passed !== 'boolean' || !Array.isArray(report.failures)) throw new Error('unusable report shape');
    const unmatched = report.exceptions.filter((e) => !e.matched).map((e) => e.id);
    if (!report.exceptions.length || unmatched.length) throw new Error(`unmatched exceptions: ${unmatched.join(', ')}`);
    return `passed: ${report.passed}; ${report.failures.length} failing, ${report.excepted.length} excepted by ${report.exceptions.length} exceptions`;
  });
  await check('B6-30', 'applyTheme (uxdsl/runtime) applies values and refuses structural changes', () => {
    const elements = new Map();
    const previousDocument = globalThis.document;
    globalThis.document = {
      createElement: (tag) => ({ tagName: tag.toUpperCase(), id: '', textContent: '', setAttribute() {}, getAttribute: () => null }),
      getElementById: (id) => elements.get(id) || null,
      head: { appendChild(node) { elements.set(node.id, node); return node; } },
    };
    try {
      const init = runtimeApi.applyTheme({}, { replace: true });
      if (!init.ok) throw new Error(`init failed: ${init.error.message}`);
      const value = runtimeApi.applyTheme({ palette: { primary: { main: '#0ea5e9' } } });
      if (!value.ok) throw new Error(`a value patch was refused: ${value.error.message}`);
      const style = elements.get('uxdsl-theme');
      if (!/#0ea5e9/.test(style.textContent)) throw new Error('the value did not reach the stylesheet');
      const before = style.textContent;
      const structural = runtimeApi.applyTheme({ breakpoints: { md: 900 } });
      if (structural.ok || structural.error.code !== 'UXD_THEME_STRUCTURE') throw new Error('a threshold move was not refused with UXD_THEME_STRUCTURE');
      if (style.textContent !== before) throw new Error('a refused patch rewrote the stylesheet');
      return 'value applied, structural refused, CSS preserved';
    } finally {
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
  });
  await check('parity', '[repo] CLI, compile() and the adapters agree (fixtures/parity)', () => {
    repoNode('fixtures/parity', ['fixtures/parity/run.js']);
    return 'oracle agreement';
  });

  // --- beta.9: compile() runs on Dart Sass ----------------------------------
  console.log('\ncompile() on Dart Sass (FEAT-010, MIG-B9-13):');
  await check('S-1', '[tarball, network] Bootstrap 5.3.8 renamed to .uxdsl compiles through the installed compile() to Dart Sass\'s CSS, byte for byte (fixtures/sass-corpus)', () => {
    const out = repoNode('fixtures/sass-corpus', ['fixtures/sass-corpus/run.js', '--uxdsl', pkgDir, '--sass', sassPackageDir(pkgDir), '--no-timing-budget']);
    if (!/byte-identical: true/.test(out)) throw new Error('the corpus did not print "byte-identical: true"');
    const ratio = /compile\(\)'s median is ([\d.]+)x/.exec(out);
    return `byte-identical, the five mixed checks ok${ratio ? `; compile() ${ratio[1]}x Dart Sass (reported, not asserted)` : ''}`;
  });
  await check('S-2', '[repo] the Sass matrix\'s recorded literals and compile()\'s output equal live Dart Sass (packages/uxdsl/test/core/sass-matrix.test.js)', () => {
    const out = repoNode('sass-matrix', ['--test', '--test-reporter=tap', '--test-name-pattern', 'equals live Dart Sass', 'packages/uxdsl/test/core/sass-matrix.test.js']);
    const passed = Number((/^# pass (\d+)$/m.exec(out) || [])[1]);
    if (!(passed >= 4)) throw new Error(`${passed || 0} tests passed; the four "equals live Dart Sass" tests, controls included, must run`);
    return `${passed} tests, their negative controls included`;
  });
  await check('S-3', '[tarball] a UXDSL error in a Sass-heavy file is printed by the installed CLI at the author\'s line and column, framed from the author\'s text', () => {
    const p = project('sass-heavy');
    const fixtures = path.join(PACKAGE_DIR, 'test/core/fixtures/sass-maps');
    for (const file of ['heavy.uxdsl', '_mixins.uxdsl']) p.write(file, fs.readFileSync(path.join(fixtures, file), 'utf8'));
    return assertAuthorLocated(p.spawn('build', '--entry', 'heavy.uxdsl', '--out', 'out.css', '--no-include-theme'));
  });

  // --- beta.9: the CLI and the adapters on Dart Sass -------------------------
  console.log('\nThe CLI and the adapters on Dart Sass (FEAT-010, MIG-B9-14):');
  await check('S-4', '[tarball] the installed CLI prints a Sass error with Dart Sass\'s frame of the author\'s text, and a deprecated @import as a warning at its file, line and column that sass.silenceDeprecations removes', () => {
    const p = project('cli-sass');
    p.write('uxdsl.config.cjs', "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };\n");
    p.write('src/a.uxdsl', '.a { color: palette(primary.main); width: $nope; }\n');
    const framed = assertSassFramed(p.spawn('build'));
    p.write('src/a.uxdsl', "@import './b';\n.a { color: red; }\n");
    p.write('src/_b.uxdsl', '.b { color: blue; }\n');
    const warned = assertLocatedWarning(p.spawn('build'), { silenced: false });
    p.write('uxdsl.config.cjs', "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css', sass: { silenceDeprecations: ['import'] } };\n");
    const silenced = assertLocatedWarning(p.spawn('build'), { silenced: true });
    return `${framed}; ${warned}; ${silenced}`;
  });
  // The bundlers are instruments, from the repository; the adapters under test
  // are the installed package's.
  await check('S-5', '[tarball] the installed uxdsl/webpack in real webpack builds (the repository\'s webpack, css-loader and MiniCssExtractPlugin): a deprecation in a @use\'d partial is a warning at its file, line and column that sass.silenceDeprecations removes, an unknown sass key fails the module, the partials are file dependencies, and the CSS map names each file at its path', async () => {
    const tools = {
      webpack: instrument('webpack'),
      MiniCssExtractPlugin: instrument('mini-css-extract-plugin'),
      cssLoader: instrument.resolve('css-loader'),
      SourceMapConsumer: instrument('source-map-js').SourceMapConsumer,
    };
    return assertWebpackAdapter(await webpackAdapterRecord(tools, req.resolve('uxdsl/webpack'), project('webpack-sass').root));
  });
  await check('S-6', '[tarball] the installed uxdsl/vite in real `vite build`s and a dev server (the repository\'s Vite): a deprecation in a @use\'d partial is a warning at its file, line and column that sass.silenceDeprecations removes, an unknown sass key fails the build, and the partials are in the module graph', async () => {
    const vite = await import(pathToFileURL(instrument.resolve('vite')).href);
    const mod = req('uxdsl/vite');
    return assertViteAdapter(await viteAdapterRecord(vite, mod.default || mod, project('vite-sass').root));
  });

  // --- beta.7: init, editor support, fonts, contrast -----------------------
  console.log('\nInit, editor support, fonts and contrast (from verify:beta7):');
  {
    const p = project('init');
    await check('B7-12a', '`uxdsl init` writes a type-checked config typed with uxdsl/config and says where editor support is', () => {
      const out = p.uxdsl('init');
      const config = p.read('uxdsl.config.cjs');
      if (!/^\/\/ @ts-check/m.test(config)) throw new Error('no // @ts-check');
      if (!config.includes("@type {import('uxdsl/config').UxdslConfig}")) throw new Error('no @type on the config');
      if (!/Editor support/.test(out)) throw new Error('"Next steps" does not mention editor support');
      return 'typed config + next-steps line';
    });
    await check('B7-12b', 'that config type-checks against the installed package, and a typo is caught', () => {
      const tsc = path.join(PACKAGE_DIR, 'node_modules/typescript/bin/tsc');
      const typecheck = () => spawnSync(process.execPath, [tsc, '--noEmit', '--allowJs', '--checkJs', '--module', 'node16', '--moduleResolution', 'node16', 'uxdsl.config.cjs'], { cwd: p.root, encoding: 'utf8' });
      const clean = typecheck();
      if (clean.status !== 0) throw new Error(`clean config fails: ${(clean.stdout || clean.stderr).split('\n')[0]}`);
      const original = p.read('uxdsl.config.cjs');
      p.write('uxdsl.config.cjs', original.replace("entry: './src/uxdsl-entry.uxdsl'", "entry: './src/uxdsl-entry.uxdsl', includeThem: false"));
      const typo = typecheck();
      p.write('uxdsl.config.cjs', original);
      if (typo.status === 0) throw new Error('negative control: `includeThem` was not reported');
      return 'clean passes, typo reported';
    });
    await check('B7-12c', 'the $schema path the README cites exists in the installed package', () => {
      const schema = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules/uxdsl/schema/theme.schema.json'), 'utf8'));
      if (!schema.properties || !schema.properties.palette) throw new Error('schema has no palette');
      req.resolve('uxdsl/schema/theme.schema.json');
      return `${Object.keys(schema.properties).length} top-level properties`;
    });
    await check('P4-init', '`init` says `npm i -D uxdsl` when the project does not list it, and writes uxdsl/postcss for Next.js', () => {
      const bare = project('init-bare');
      fs.writeFileSync(path.join(bare.root, 'package.json'), JSON.stringify({ name: 'bare', version: '1.0.0', private: true }));
      bare.write('next.config.js', 'module.exports = {};\n');
      const out = bare.uxdsl('init');
      if (!/npm i -D uxdsl/.test(out)) throw new Error('no install line');
      if (/postcss-uxdsl|uxdsl-cli/.test(out)) throw new Error('an old package name in the output');
      const plugins = Object.keys(require(path.join(bare.root, 'postcss.config.js')).plugins);
      if (plugins[plugins.length - 1] !== 'uxdsl/postcss') throw new Error(`plugins: ${plugins.join(', ')}`);
      return `plugins: ${plugins.join(', ')}`;
    });
    await check('P4-rename', 'a uxdsl.theme.config.cjs fails the build naming uxdsl.theme.cjs, never a silent base theme', () => {
      const q = project('renamed-theme');
      q.write('uxdsl.config.cjs', "module.exports = { entry: './src/a.uxdsl', outFile: './src/a.css' };\n");
      q.write('src/a.uxdsl', '.a { color: palette(primary.main); }\n');
      q.write('uxdsl.theme.config.cjs', "module.exports = { palette: { primary: { main: '#123456' } } };\n");
      failsWith(() => q.uxdsl('build'), /no longer read\. Rename it to uxdsl\.theme\.cjs/, 'old theme file name');
      if (q.exists('src/a.css')) throw new Error('a CSS file was written');
      return 'refused, nothing written';
    });
  }

  if (args.has('--skip-upgrade')) {
    DELEGATED.push(['B7-15a', 'skipped by flag', 'Run without --skip-upgrade (installs 0.5.0-beta.6 from the registry).']);
  } else {
    await check('B7-15a', '`uxdsl theme` before (published 0.5.0-beta.6) and after (this tarball) can be compared', () => {
      const override = "module.exports = { typography_details: { h1: { fontWeight: '800' } } };\n";
      const before = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-1.0-upgrade-before-'));
      fs.writeFileSync(path.join(before, 'package.json'), JSON.stringify({ name: 'before', version: '1.0.0', private: true }));
      fs.writeFileSync(path.join(before, 'uxdsl.theme.config.cjs'), override); // the name beta.6 reads
      // beta.6's `theme` command wants the conventional entry next to the theme file.
      fs.mkdirSync(path.join(before, 'src'));
      fs.writeFileSync(path.join(before, 'src/uxdsl-entry.uxdsl'), '.a { color: palette(primary.main); }\n');
      run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', 'uxdsl-cli@0.5.0-beta.6', 'postcss-uxdsl@0.5.0-beta.6'], before);
      const themeOf = (cwd, bin) => JSON.parse(execFileSync(process.execPath, [bin, 'theme'], { cwd, encoding: 'utf8', maxBuffer: 1 << 26 }));
      const previous = themeOf(before, path.join(before, 'node_modules/uxdsl-cli/bin/uxdsl.js'));
      const after = project('upgrade-after');
      after.write('uxdsl.theme.cjs', override); // the name 1.0 reads
      const current = themeOf(after.root, cli);
      const leaves = (obj, prefix = '') => Object.entries(obj || {}).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, JSON.stringify(v)]]));
      const a = new Map(leaves(previous));
      const b = new Map(leaves(current));
      if (a.size < 100 || b.size < 100) throw new Error(`too few keys to compare (${a.size} / ${b.size})`);
      const changed = [...b].filter(([k, v]) => a.has(k) && a.get(k) !== v).length;
      const added = [...b.keys()].filter((k) => !a.has(k)).length;
      const removed = [...a.keys()].filter((k) => !b.has(k)).length;
      fs.writeFileSync(path.join(dir, 'upgrade-diff.json'), JSON.stringify({ before: previous, after: current }, null, 2));
      if (current.typography_details.h1.fontWeight !== '800') throw new Error('the override did not survive');
      return `${added} added, ${changed} changed, ${removed} removed leaf keys (upgrade-diff.json)`;
    });
  }

  {
    const p = project('fonts');
    p.write('uxdsl.config.cjs', "module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };\n");
    p.write('src/entry.uxdsl', '.a { padding: density(2); color: palette(primary.main); }\n');
    let built = '';
    await check('B7-14a', 'the CSS `uxdsl build` writes starts with the Google Fonts @import', () => {
      p.uxdsl('build');
      built = p.read('src/out.css');
      const first = postcss.parse(built).nodes.find((node) => node.type !== 'comment');
      if (!(first && first.type === 'atrule' && first.name === 'import' && /fonts\.googleapis\.com/.test(first.params))) throw new Error(`first node is ${first ? (first.selector || `@${first.name}`) : 'nothing'}`);
      return first.params.slice(0, 70);
    });
    await check('B7-15b', 'an unchanged rebuild says what "unchanged" means', () => {
      const out = p.uxdsl('build');
      if (!/unchanged .*compiled output identical to the file on disk/.test(out)) throw new Error(`got: ${out.trim().split('\n').pop()}`);
      return 'clarified message';
    });
    await check('B7-14b', 'real Chrome requests Google Fonts from that file; the beta.6 ordering does not', async () => {
      if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set UXDSL_CHROME_PATH)`);
      const { chromium } = browserFixture('playwright-core');
      const browser = await chromium.launch({ executablePath: CHROME, headless: true });
      try {
        const good = await googleFontRequests(browser, built);
        if (good.length !== 1 || !/family=Inter/.test(good[0])) throw new Error(`requests: ${JSON.stringify(good)}`);
        if ((await googleFontRequests(browser, withImportsBehindFirstRule(postcss, built))).length) throw new Error('negative control: requested with the import behind a rule');
        return '1 request; negative control 0';
      } finally {
        await browser.close();
      }
    });
  }

  await check('contrast', 'failing and excepted contrast pairs are exactly the pinned sets', () => {
    if (!fs.existsSync(BASELINE)) throw new Error('no baseline — run with --write-contrast-baseline and review it');
    return assertContrastBaseline(contrastReport(themeApi, req), JSON.parse(fs.readFileSync(BASELINE, 'utf8')));
  });
  await check('B7-01', 'a toned contained Input placeholder has no contrast failure', () => {
    const placeholder = contrastReport(themeApi, req).failures.filter((f) => f.family === 'input' && f.component === 'contained' && f.tone && /placeholder/.test(f.pair));
    if (placeholder.length) throw new Error(`${placeholder.length} failures, e.g. ${contrastSignature(placeholder[0])}`);
    return '0 failures';
  });

  // --- Real bundlers and a real Next.js build, each from its own tarball ----
  console.log('\nReal builds (each fixture packs and installs the tarball itself):');
  await check('N-04', '[tarball] uxdsl/vite: a real `vite build` and dev server (fixtures/vite-adapter)', () => {
    const out = repoNode('fixtures/vite-adapter', ['fixtures/vite-adapter/run.js'], 900000);
    const majors = out.split('\n').filter((line) => /^\s*vite@\^\d+ … ok/.test(line)).map((line) => line.trim().replace(/ … ok.*$/, ''));
    if (majors.length < 2) throw new Error(`the fixture reported ${majors.length} Vite major(s), expected both ^5 and ^7`);
    return `${majors.join(' and ')}: extraction, ?inline, no absolute paths, HMR graph`;
  });
  await check('N-03', '[tarball] uxdsl/webpack: a real webpack build and watch (fixtures/webpack-adapter)', () => {
    repoNode('fixtures/webpack-adapter', ['fixtures/webpack-adapter/run.js'], 600000);
    return 'css-loader + MiniCssExtractPlugin, source maps, watch';
  });
  await check('cssmod', '[tarball, Chrome] Next.js CSS Modules build, a CLI-built .module.uxdsl on the served page, and the runtime in Chrome (fixtures/mig02-nextjs-cssmodules)', () => {
    repoNode('verify:cssmodules-build', ['fixtures/mig02-nextjs-cssmodules/run.js'], 900000);
    return 'pure-mode build, computed styles, the CLI-built module on the served page, applyTheme on a page';
  });
  await check('DE-9', '[tarball, Chrome] Next.js with PostCSS only: `@uxdsl theme;` in globals.css, tokens in a CSS Module (fixtures/mig02-nextjs-cssmodules/postcss-only.js)', () => {
    repoNode('postcss-only', ['fixtures/mig02-nextjs-cssmodules/postcss-only.js'], 900000);
    return 'marker emits the theme; in a module it is rejected; without it no theme';
  });

  // --- Repository-level guarantees -----------------------------------------
  console.log('\nRepository-level guarantees (documentation and playground sources):');
  await check('B7-16', '[repo] every documentation example compiles (verify:doc-examples)', () => repoNode('verify-doc-examples', ['scripts/verify-doc-examples.js']).trim().split('\n')[0]);
  await check('B7-17', '[repo] every capability has a live playground example, no recorded gaps', () => {
    repoNode('capability-matrix test', ['--test', 'scripts/capability-matrix.test.js']);
    const gaps = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/playground-nextjs/capability-evidence.json'), 'utf8')).knownGaps || [];
    if (gaps.length) throw new Error(`${gaps.length} recorded gaps remain`);
    return 'matrix complete, no recorded gaps';
  });
  if (args.has('--skip-playground-walk')) {
    DELEGATED.push(['B7-17E', 'skipped by flag', 'Run `npm run verify:playground-browser` (real Chrome walk of the built playground).']);
  } else {
    await check('B7-17E', '[repo] real Chrome walk of the built playground (verify:playground-browser)', () => {
      const out = repoNode('verify:playground-browser', ['fixtures/playground-browser/walk.js', '--build'], 1800000);
      const line = out.trim().split('\n').reverse().find((l) => /PASS|pages|routes/.test(l));
      return line ? line.trim().slice(0, 160) : 'passed';
    });
  }

  // --- What `npm i -D uxdsl` installs ---------------------------------------
  console.log('\nThe install (`npm i -D uxdsl` of the tarball):');
  // All dependencies: the documented install is `npm i -D uxdsl`, so
  // --omit=dev would leave out uxdsl itself and report a clean zero. The 1.0
  // gate requires no high and no critical finding; an audit that cannot run
  // (no registry) fails the check rather than passing it unmeasured.
  await check('AUDIT', '`npm audit` (all dependencies) of a fresh `npm i -D uxdsl`: 0 high, 0 critical', () => {
    const audit = spawnSync('npm', ['audit', '--json'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 });
    let report;
    try { report = JSON.parse(audit.stdout); } catch { throw new Error(`npm audit did not run: ${(audit.stderr || '').trim().split('\n')[0] || `exit ${audit.status}`}`); }
    if (!report.metadata || !report.metadata.vulnerabilities) throw new Error(`npm audit returned no counts: ${JSON.stringify(report.error || report).slice(0, 160)}`);
    const counts = report.metadata.vulnerabilities;
    const chains = Object.entries(report.vulnerabilities || {}).map(([name, v]) => `${name} (${v.severity})`).join(', ');
    const summary = `${['critical', 'high', 'moderate', 'low'].map((level) => `${counts[level] || 0} ${level}`).join(', ')}${chains ? ` — ${chains}` : ''}`;
    if ((counts.high || 0) > 0 || (counts.critical || 0) > 0) throw new Error(summary);
    return summary;
  });
  // The repository's own lockfile, not the fresh install: the versions
  // `packages/uxdsl/package-lock.json` pins are what the suite, the parity
  // oracles and this gate run against, and a fresh install can be clean while
  // they are behind an advisory. Nothing at all may remain here, dev
  // dependencies included; an audit that cannot run fails the check.
  await check('AUDIT-lock', '`npm audit` inside the repository\'s packages/uxdsl (its own lockfile, dev dependencies included): 0 vulnerabilities', () => auditLockfile(PACKAGE_DIR));

  // --- Measurements, reported rather than judged ----------------------------
  console.log('\nMeasured (reported, not a pass/fail):');
  const lsAll = spawnSync('npm', ['ls', '--all', '--parseable'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 });
  console.log(`  packages installed with uxdsl: ${new Set((lsAll.stdout || '').trim().split('\n').slice(1)).size}`);

  console.log('\nNot executed here — owner and mechanism named, never counted as a pass:');
  for (const [id, kind, note] of DELEGATED) console.log(`  --   ${id.padEnd(9)} [${kind}] ${note}`);
  console.log('\nChecks of the former gates dropped with the feature they tested:');
  for (const [id, what, why] of DROPPED) console.log(`  --   ${id}: ${what} — ${why}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} automated checks passed.`);
  if (failed.length) {
    console.error(`FAIL: ${failed.map((r) => r.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: the 1.0 gate (automated portion) for uxdsl@${version}. The items listed above remain.`);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { contrastSignature, exceptedSignature, contrastBaselineOf, assertContrastBaseline, auditLockfile, assertAuthorLocated, assertSassFramed, assertLocatedWarning, webpackAdapterRecord, assertWebpackAdapter, viteAdapterRecord, assertViteAdapter, assertMissingImport, mapIntegrityProblems, DROPPED };
