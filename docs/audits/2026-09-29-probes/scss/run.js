#!/usr/bin/env node
/**
 * SCSS-compatibility probe for UXDSL.
 *
 * Compiles every `cases/<name>.uxdsl` (or the names given on argv) through
 * the real shared pipeline — `require('<repo>/packages/uxdsl-core/dist')`
 * `.compile({ entry })` — and, for comparison, through Dart Sass
 * (`require('sass').compileString`) when available. Prints, per case, the
 * UXDSL output (or the error), and the Sass output (or the error).
 *
 * Read-only against the repo: nothing is written outside this directory.
 *
 * Usage:
 *   node run.js                 # all cases
 *   node run.js vars-basic nest # selected cases
 *   node run.js --json > out.json
 */
const fs = require('fs');
const path = require('path');

const REPO = '/Users/ricardosantoyo/Documents/projects/uxdsl';
const { compile } = require(path.join(REPO, 'packages/uxdsl-core/dist/index.js'));
let sass = null;
try { sass = require(path.join(REPO, 'packages/playground-nextjs/node_modules/sass')); } catch (_) { /* optional */ }

const CASES_DIR = path.join(__dirname, 'cases');
const args = process.argv.slice(2);
const json = args.includes('--json');
const names = args.filter((a) => !a.startsWith('--'));
const files = (names.length ? names.map((n) => (n.endsWith('.uxdsl') ? n : `${n}.uxdsl`)) : fs.readdirSync(CASES_DIR).filter((f) => f.endsWith('.uxdsl')).sort());

/** Strip the trailing breakpoint metadata so outputs stay readable. */
function trimMeta(css) {
  return css.replace(/\n\/\*@uxdsl-bp[\s\S]*$/, '').trim();
}

async function runUxdsl(entry) {
  try {
    const { css, warnings } = await compile(
      { entry },
      // includeTheme:false keeps the giant :root block out of the output and
      // matches a CSS-Module/component entry; references stay on the default
      // ('error') so token typos fail exactly as they would for a user.
      { includeTheme: false }
    );
    return { ok: true, css: trimMeta(css), warnings: warnings.map((w) => w.text) };
  } catch (e) {
    return { ok: false, error: `${e.name || 'Error'}: ${e.message.split('\n')[0]}` };
  }
}

function runSass(entry) {
  if (!sass) return { ok: null, error: 'sass not installed' };
  try {
    const src = fs.readFileSync(entry, 'utf8');
    const res = sass.compileString(src, {
      syntax: 'scss',
      url: new URL(`file://${entry}`),
      importers: [{
        findFileUrl(url) { return new URL(url, `file://${path.dirname(entry)}/`); },
      }],
      loadPaths: [path.dirname(entry)],
      logger: sass.Logger.silent,
    });
    return { ok: true, css: res.css.trim() };
  } catch (e) {
    return { ok: false, error: String(e.message).split('\n').slice(0, 2).join(' | ') };
  }
}

(async () => {
  const out = [];
  for (const f of files) {
    const entry = path.join(CASES_DIR, f);
    const name = f.replace(/\.uxdsl$/, '');
    const source = fs.readFileSync(entry, 'utf8');
    const u = await runUxdsl(entry);
    const s = runSass(entry);
    out.push({ name, source, uxdsl: u, sass: s });
    if (!json) {
      console.log(`\n${'='.repeat(78)}\n# ${name}\n${'-'.repeat(78)}\n${source.trim()}`);
      console.log(`\n--- UXDSL (${u.ok ? 'OK' : 'ERROR'}) ---`);
      console.log(u.ok ? (u.css || '(empty output)') : u.error);
      if (u.ok && u.warnings.length) console.log(`warnings: ${u.warnings.join(' | ')}`);
      console.log(`\n--- Dart Sass (${s.ok === null ? 'N/A' : s.ok ? 'OK' : 'ERROR'}) ---`);
      console.log(s.ok ? (s.css || '(empty output)') : s.error);
    }
  }
  if (json) console.log(JSON.stringify(out, null, 2));
})();
