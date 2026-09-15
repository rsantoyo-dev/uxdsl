#!/usr/bin/env node
'use strict';

/**
 * MIG-02: proves the 5-entry guide (1 theme + 4 CSS-Module panels) compiles
 * in a real Next.js production build under css-loader's actual strict/pure
 * CSS Modules mode — not a bare webpack config approximating it. Next.js's
 * own webpack config (next/dist/build/webpack/config/blocks/css/loaders/
 * modules.js) sets `modules: { mode: "pure" }` unconditionally for every
 * `.module.css` file, which is what rejects a selector with no local class
 * or id (e.g. a bare `:root`) — this fixture runs that exact code path,
 * no browser needed (`next build` is a Node-only static/SSR build).
 *
 * Two runs:
 *  1. Positive: the compiled theme entry as global CSS + the 4 panels as
 *     `.module.css` (includeTheme: false, so none contain `:root`) — must
 *     build clean, with no workaround (no `:global()`, no disabling pure
 *     mode) needed.
 *  2. Negative control: the same theme output, but saved with a
 *     `.module.css` extension and imported from a throwaway page — must
 *     FAIL with css-loader's real "is not pure" error, proving check #1
 *     is actually meaningful and not just "any CSS passes".
 *
 * Usage: node run.js   (from this directory, or `npm run verify` here)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FIXTURE_DIR = __dirname;
const BAD_PAGE = path.join(FIXTURE_DIR, 'pages', 'bad.js');
const BAD_STYLE = path.join(FIXTURE_DIR, 'styles', 'bad-theme.module.css');

const failures = [];
function check(label, condition) {
  if (condition) console.log(`  ok  - ${label}`);
  else { console.log(`FAIL  - ${label}`); failures.push(label); }
}

function run(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, { cwd: FIXTURE_DIR, encoding: 'utf8', stdio: 'pipe', ...opts });
    return { ok: true, output: stdout };
  } catch (err) {
    return { ok: false, output: `${err.stdout || ''}${err.stderr || ''}` || err.message };
  }
}

async function main() {
  if (!fs.existsSync(path.join(FIXTURE_DIR, 'node_modules'))) {
    console.log('Installing next/react/react-dom (first run only)...');
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: FIXTURE_DIR, stdio: 'inherit' });
  }

  console.log('Compiling theme + 4 panel entries with the monorepo\'s current postcss-uxdsl build...');
  const compileResult = run('node', ['compile.js']);
  check('theme.css + 4 panel .module.css files compiled', compileResult.ok);
  if (!compileResult.ok) console.log(compileResult.output);

  fs.rmSync(path.join(FIXTURE_DIR, '.next'), { recursive: true, force: true });
  console.log('\nBuilding (positive control): 1 theme entry (global CSS) + 4 CSS-Module panels...');
  const positive = run('npx', ['next', 'build']);
  check('next build succeeds with the compiled theme + 4 panels, no :root/pure-mode workaround needed', positive.ok);
  if (!positive.ok) console.log(positive.output);

  console.log('\nBuilding (negative control): a :root-bearing file saved as .module.css...');
  fs.copyFileSync(path.join(FIXTURE_DIR, 'styles', 'theme.css'), BAD_STYLE);
  fs.writeFileSync(BAD_PAGE, "import '../styles/bad-theme.module.css';\nexport default function Bad() { return null; }\n");
  fs.rmSync(path.join(FIXTURE_DIR, '.next'), { recursive: true, force: true });
  const negative = run('npx', ['next', 'build']);
  const expectedError = /is not pure \(pure selectors must contain at least one local class or id\)/;
  check(
    'next build genuinely REJECTS a :root-bearing .module.css (proves check above is meaningful, not "anything passes")',
    !negative.ok && expectedError.test(negative.output)
  );
  if (negative.ok || !expectedError.test(negative.output)) console.log(negative.output);

  // Restore the always-succeeding state for repeated/CI runs.
  fs.rmSync(BAD_PAGE, { force: true });
  fs.rmSync(BAD_STYLE, { force: true });
  fs.rmSync(path.join(FIXTURE_DIR, '.next'), { recursive: true, force: true });

  console.log('\nNOT VERIFIED by this script (documented gap, see docs/features/FEAT-002-beta-migration-hardening.md MIG-02):');
  console.log('  - Real browser rendering of the built pages (this only proves the build step, i.e. the webpack/css-loader compilation itself, succeeds or fails as expected).');
  console.log('  - The App Router (`app/`) CSS Modules pipeline specifically — this fixture uses the Pages Router; next/dist/build/webpack/config/blocks/css/loaders/modules.js is shared by both, so the mechanism under test is the same either way, but it was not additionally exercised through app/.');

  console.log(`\n${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  if (failures.length) {
    console.log(`${failures.length} check(s) failed:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log('All checks passed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
