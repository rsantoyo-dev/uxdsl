'use strict';

// MIG-B7-18 (FEAT-009): the beta.7 release gate.
//
// Same rules as the beta.6 gate (fixtures/mig-b6-12-release/run.js), which it
// also runs: everything under test is installed from `npm pack` tarballs, a
// check that cannot run here is named and never counted as a pass, and the
// gate has been shown to go red by reverting closed stories (recorded in
// docs/releases/0.5.0-beta.7.md).
//
// What beta.6's gate could not see, and this one looks at: the CSS the CLI
// actually writes, loaded in a real browser. beta.6 passed 26/26 with its
// Google Fonts @import behind a :root, where Chrome discards it.
//
//   node fixtures/mig-b7-18-release/run.js                     full gate
//   node fixtures/mig-b7-18-release/run.js --skip-beta6        omit the nested beta.6 gate
//   node fixtures/mig-b7-18-release/run.js --write-contrast-baseline
//        re-pin the known contrast failures (a deliberate, reviewed act: the
//        diff of contrast-baseline.json is the review)
//
// It does not publish, change dist-tags, or ask for secrets.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { packAndInstall, REPO_ROOT } = require('../lib/tarball-consumer');

const args = new Set(process.argv.slice(2));
const BASELINE = path.join(__dirname, 'contrast-baseline.json');
const CHROME = process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Measuring instruments, not product: taken from the repo like the beta.6 gate
// takes its source-map reader.
const browserFixture = createRequire(path.join(REPO_ROOT, 'fixtures/mig02-nextjs-cssmodules/package.json'));

const results = [];
/** Awaits `fn` — see the beta.6 gate for why an un-awaited async check always passes. */
async function check(id, label, fn) {
  let ok = false;
  let detail = '';
  try {
    const value = await fn();
    ok = value !== false;
    if (typeof value === 'string') detail = value;
  } catch (error) {
    detail = String(error && error.message ? error.message : error).split('\n')[0].slice(0, 200);
  }
  results.push({ id, label, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(8)} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

const DELEGATED = [
  ['B7-12', 'manual', 'Colors and completion in a real VS Code with the VSIX installed — owner; the scaffold itself is checked above.'],
  ['—', 'external', 'Validation in the owner\'s consuming project against these tarballs.'],
  ['—', 'postpublish', 'dist-tags (`latest` and `beta` on all five packages) — verified only after the owner publishes.'],
];

const contrastSignature = (f) => [f.mode, f.family, f.component, f.tone, f.state, f.pair, f.background, f.breakpoint].join('|');

function contrastReport(runtime, req) {
  let exceptions = [];
  try { exceptions = req('postcss-uxdsl/theme/base.contrast-exceptions.json'); } catch { /* optional */ }
  return runtime.checkThemeContrast(runtime.resolveTheme(undefined), { exceptions });
}

/** The beta.6 layout: every @import moved behind the first rule. */
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
  const run = spawnSync(process.execPath, argv, { cwd: REPO_ROOT, encoding: 'utf8', timeout });
  if (run.status !== 0) {
    const tail = `${run.stdout || ''}${run.stderr || ''}`.trim().split('\n').slice(-3).join(' | ');
    throw new Error(`${label} exited ${run.status}: ${tail}`);
  }
  return run.stdout;
}

async function main() {
  const { dir, run, write, req, version } = packAndInstall({ tmpPrefix: 'uxdsl-beta7-release-' });
  const cli = path.join(dir, 'node_modules/uxdsl-cli/bin/uxdsl.js');
  const command = (...cliArgs) => run(process.execPath, [cli, ...cliArgs]);
  const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
  const runtime = req('postcss-uxdsl/ds-runtime');
  const postcss = req('postcss');

  if (args.has('--write-contrast-baseline')) {
    const signatures = contrastReport(runtime, req).failures.map(contrastSignature).sort();
    fs.writeFileSync(BASELINE, `${JSON.stringify({ version, count: signatures.length, signatures }, null, 2)}\n`);
    console.log(`Pinned ${signatures.length} known contrast failures to ${path.relative(REPO_ROOT, BASELINE)}.`);
    return;
  }

  console.log(`\nGate for ${version}, from tarballs in ${dir}\n`);

  // --- MIG-B7-12: init leaves a typed config and the $schema it cites exists --
  await check('B7-12a', '`uxdsl init` writes a type-checked config and says where editor support is', () => {
    const out = command('init');
    const config = read('uxdsl.config.cjs');
    if (!/^\/\/ @ts-check/m.test(config)) throw new Error('no // @ts-check');
    if (!config.includes("@type {import('postcss-uxdsl/config').UxdslConfig}")) throw new Error('no @type on the config');
    if (!/Editor support/.test(out)) throw new Error('"Next steps" does not mention editor support');
    return 'typed config + next-steps line';
  });

  await check('B7-12b', 'the generated config type-checks against the installed package, and a typo is caught', () => {
    const tsc = path.join(REPO_ROOT, 'packages/postcss-uxdsl/node_modules/typescript/bin/tsc');
    const typecheck = () => spawnSync(process.execPath, [tsc, '--noEmit', '--allowJs', '--checkJs', '--module', 'node16', '--moduleResolution', 'node16', 'uxdsl.config.cjs'], { cwd: dir, encoding: 'utf8' });
    const clean = typecheck();
    if (clean.status !== 0) throw new Error(`clean config fails: ${(clean.stdout || clean.stderr).split('\n')[0]}`);
    const original = read('uxdsl.config.cjs');
    write('uxdsl.config.cjs', original.replace("entry: './src/uxdsl-entry.uxdsl'", "entry: './src/uxdsl-entry.uxdsl', includeThem: false"));
    const typo = typecheck();
    write('uxdsl.config.cjs', original);
    if (typo.status === 0) throw new Error('negative control: `includeThem` was not reported');
    return 'clean passes, typo reported';
  });

  await check('B7-12c', 'the $schema path the README cites exists in the installed package', () => {
    const schemaPath = path.join(dir, 'node_modules/postcss-uxdsl/schema/theme.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    if (!schema.properties || !schema.properties.palette) throw new Error('schema has no palette property');
    req.resolve('postcss-uxdsl/schema/theme.schema.json');
    return `${Object.keys(schema.properties).length} top-level properties`;
  });

  // --- MIG-B7-15: the "before you upgrade" flow, between two real releases ----
  await check('B7-15a', '`uxdsl theme` before (published beta.6) and after (these tarballs) can be compared', () => {
    const override = "module.exports = { theme: { typography_details: { h1: { fontWeight: '800' } } } };\n";
    const before = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'uxdsl-beta7-upgrade-before-'));
    fs.writeFileSync(path.join(before, 'package.json'), JSON.stringify({ name: 'before', version: '1.0.0', private: true }));
    fs.writeFileSync(path.join(before, 'uxdsl.theme.config.cjs'), override);
    fs.mkdirSync(path.join(before, 'src'));
    fs.writeFileSync(path.join(before, 'src/uxdsl-entry.uxdsl'), '.a { color: palette(primary.main); }\n');
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', 'uxdsl-cli@0.5.0-beta.6', 'postcss-uxdsl@0.5.0-beta.6'], before);
    const themeOf = (cwd, bin) => JSON.parse(execFileSync(process.execPath, [bin, 'theme'], { cwd, encoding: 'utf8', maxBuffer: 1 << 26 }));
    const previous = themeOf(before, path.join(before, 'node_modules/uxdsl-cli/bin/uxdsl.js'));
    write('uxdsl.theme.config.cjs', override);
    const current = themeOf(dir, cli);
    fs.rmSync(path.join(dir, 'uxdsl.theme.config.cjs'));
    const leaves = (obj, prefix = '') => Object.entries(obj || {}).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, JSON.stringify(v)]]);
    const a = new Map(leaves(previous));
    const b = new Map(leaves(current));
    // A comparison of two near-empty objects would pass vacuously.
    if (a.size < 100 || b.size < 100) throw new Error(`too few keys to compare (${a.size} / ${b.size})`);
    const changed = [...b].filter(([k, v]) => a.has(k) && a.get(k) !== v).length;
    const added = [...b.keys()].filter((k) => !a.has(k)).length;
    const removed = [...a.keys()].filter((k) => !b.has(k)).length;
    const record = path.join(dir, 'upgrade-diff.json');
    fs.writeFileSync(record, JSON.stringify({ before: previous, after: current }, null, 2));
    if (current.typography_details.h1.fontWeight !== '800') throw new Error('the override did not survive into the effective theme');
    return `${added} added, ${changed} changed, ${removed} removed leaf keys (recorded in ${path.basename(record)})`;
  });

  // --- MIG-B7-14: what the CLI writes starts with the fonts @import ----------
  write('uxdsl.config.cjs', "module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };\n");
  write('src/entry.uxdsl', '.a { padding: density(2); color: palette(primary.main); }\n');
  let built = '';
  await check('B7-14a', 'the CSS `uxdsl build` writes starts with the Google Fonts @import', () => {
    command('build');
    built = read('src/out.css');
    const first = postcss.parse(built).nodes.find((node) => node.type !== 'comment');
    if (!(first && first.type === 'atrule' && first.name === 'import')) {
      throw new Error(`first node is ${first ? (first.selector || `@${first.name}`) : 'nothing'}`);
    }
    if (!/fonts\.googleapis\.com/.test(first.params)) throw new Error(`first @import is not Google Fonts: ${first.params}`);
    return first.params.slice(0, 70);
  });

  await check('B7-15b', 'an unchanged rebuild says what "unchanged" means', () => {
    const out = command('build');
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
      const beta6 = await googleFontRequests(browser, withImportsBehindFirstRule(postcss, built));
      if (beta6.length) throw new Error('negative control: Chrome requested fonts with the import behind a rule');
      return '1 request; negative control 0';
    } finally {
      await browser.close();
    }
  });

  // --- Contrast: the exact known set, not "> 0" -------------------------------
  await check('contrast', 'contrast failures are exactly the pinned set', () => {
    if (!fs.existsSync(BASELINE)) throw new Error('no baseline — run with --write-contrast-baseline and review it');
    const pinned = new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).signatures);
    const actual = contrastReport(runtime, req).failures.map(contrastSignature);
    const added = actual.filter((s) => !pinned.has(s));
    const actualSet = new Set(actual);
    const closed = [...pinned].filter((s) => !actualSet.has(s));
    if (added.length || closed.length) {
      throw new Error(`${added.length} new (e.g. ${added[0] || '—'}), ${closed.length} closed (e.g. ${closed[0] || '—'}); re-pin deliberately`);
    }
    return `${actual.length} known failures, unchanged`;
  });

  await check('B7-01', 'a toned contained Input placeholder has no contrast failure', () => {
    const placeholder = contrastReport(runtime, req).failures.filter(
      (f) => f.family === 'input' && f.component === 'contained' && f.tone && /placeholder/.test(f.pair)
    );
    if (placeholder.length) throw new Error(`${placeholder.length} failures, e.g. ${contrastSignature(placeholder[0])}`);
    return '0 failures';
  });

  // --- MIG-B7-16 / MIG-B7-17: repository-level guarantees ---------------------
  // These read documentation and playground sources, which do not ship in a
  // tarball, so they run against the repository — labelled as such.
  await check('B7-16', '[repo] every documentation example compiles (verify:doc-examples)', () => {
    const out = repoNode('verify-doc-examples', ['scripts/verify-doc-examples.js']);
    return out.trim().split('\n')[0];
  });

  await check('B7-17', '[repo] every capability has a live playground example (capability matrix)', () => {
    repoNode('capability-matrix test', ['--test', 'scripts/capability-matrix.test.js']);
    // The test above passes while gaps sit on the recorded list; a release
    // needs that list empty (MIG-B7-17 phase C closes it).
    const evidence = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/playground-nextjs/capability-evidence.json'), 'utf8'));
    const gaps = evidence.knownGaps || [];
    if (gaps.length) throw new Error(`${gaps.length} recorded gaps remain, e.g. ${gaps.slice(0, 3).map((g) => g.id || g).join(', ')}`);
    return 'matrix complete, no recorded gaps';
  });

  // --- Everything the beta.6 gate proves still holds --------------------------
  if (args.has('--skip-beta6')) {
    DELEGATED.push(['beta6', 'skipped by flag', 'Run without --skip-beta6, or `npm run verify:beta6`.']);
  } else {
    await check('beta6', 'the beta.6 gate still passes (verify:beta6)', () => {
      const out = repoNode('verify:beta6', ['fixtures/mig-b6-12-release/run.js'], 900000);
      const line = out.split('\n').find((l) => /automated checks passed/.test(l));
      return line ? line.trim() : 'passed';
    });
  }

  console.log('\nNot executed here — owner and mechanism named, never counted as a pass:');
  for (const [id, kind, note] of DELEGATED) console.log(`  --   ${id.padEnd(8)} [${kind}] ${note}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} automated checks passed.`);
  if (failed.length) {
    console.error(`FAIL: ${failed.map((r) => r.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('PASS: beta.7 gate (automated portion). The items listed above remain.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { contrastSignature };
