'use strict';

// MIG-B6-18 (FEAT-008), story step 0: a golden-master guard that the CLI
// (`uxdsl build`, spawned as a real subprocess) and `uxdsl-core`'s
// `compile()` (required in-process) keep agreeing on every case here —
// the exact two call sites MIG-B6-18 unified onto one shared pipeline.
// For each case: run both, compare them to each other, then compare the
// pair to a saved oracle in expected/. A diff against either the other
// path or the oracle is a real regression; an intentional behavior change
// (e.g. a bug this same story or a later one fixes) requires re-running
// with `--update` and reviewing the diff before committing the new oracle
// — never overwritten silently.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CASES_DIR = path.join(__dirname, 'cases');
const EXPECTED_DIR = path.join(__dirname, 'expected');
const CLI_BIN = path.join(ROOT, 'packages', 'uxdsl-cli', 'bin', 'uxdsl.js');
const core = require(path.join(ROOT, 'packages', 'uxdsl-core', 'dist', 'index.js'));

const UPDATE = process.argv.includes('--update');

// Cases whose entry can't compile — the oracle records the failure
// signature instead of CSS.
const EXPECT_ERROR = new Set(['missing-import', 'import-cycle']);

function runCli(entry, outFile) {
  const result = spawnSync(process.execPath, [CLI_BIN, 'build', '--entry', entry, '--out', outFile, '--no-include-theme'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return { error: (result.stderr || result.stdout || '').trim() };
  }
  return { css: fs.readFileSync(outFile, 'utf8') };
}

async function runCore(entry) {
  try {
    const { css } = await core.compile({ entry }, { includeTheme: false });
    return { css };
  } catch (err) {
    return { error: err.message };
  }
}

// Only the parts of an error message that are stable across machines/runs
// are compared — full absolute temp paths would make the oracle
// unreproducible across checkouts.
function normalizeError(message, caseDir) {
  return message.split(caseDir).join('<case>').split(ROOT).join('<root>');
}

async function runCase(name) {
  const caseDir = path.join(CASES_DIR, name);
  const entry = path.join(caseDir, 'entry.uxdsl');
  const tmpOut = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-parity-')), 'out.css');

  const cli = runCli(entry, tmpOut);
  const coreResult = await runCore(entry);

  const expectError = EXPECT_ERROR.has(name);
  if (expectError) {
    if (!cli.error) throw new Error(`[${name}] expected the CLI to fail, it compiled successfully instead`);
    if (!coreResult.error) throw new Error(`[${name}] expected compile() to fail, it compiled successfully instead`);
  } else {
    if (cli.error) throw new Error(`[${name}] CLI failed unexpectedly: ${cli.error}`);
    if (coreResult.error) throw new Error(`[${name}] compile() failed unexpectedly: ${coreResult.error}`);
    if (cli.css !== coreResult.css) {
      throw new Error(`[${name}] CLI and compile() disagree on output.\n--- CLI ---\n${cli.css}\n--- compile() ---\n${coreResult.css}`);
    }
  }

  const actual = expectError
    ? { error: normalizeError(cli.error, caseDir) }
    : { css: cli.css };

  const expectedPath = path.join(EXPECTED_DIR, `${name}.json`);
  if (UPDATE || !fs.existsSync(expectedPath)) {
    fs.writeFileSync(expectedPath, JSON.stringify(actual, null, 2) + '\n');
    console.log(`  wrote  - ${name} (oracle ${fs.existsSync(expectedPath) ? 'updated' : 'created'} — review the diff before committing)`);
    return;
  }

  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  if (expectError) {
    if (!actual.error.includes(expected.error) && !expected.error.includes(actual.error)) {
      throw new Error(`[${name}] error message drifted from the oracle.\nexpected: ${expected.error}\nactual:   ${actual.error}\nRun with --update after reviewing why, if this is intentional.`);
    }
  } else if (actual.css !== expected.css) {
    throw new Error(`[${name}] CSS output drifted from the oracle.\n--- expected ---\n${expected.css}\n--- actual ---\n${actual.css}\nRun with --update after reviewing why, if this is intentional.`);
  }
  console.log(`  ok     - ${name}`);
}

async function main() {
  fs.mkdirSync(EXPECTED_DIR, { recursive: true });
  const names = fs.readdirSync(CASES_DIR).filter((n) => fs.statSync(path.join(CASES_DIR, n)).isDirectory()).sort();
  for (const name of names) {
    await runCase(name);
  }
  console.log(`PASS: ${names.length} parity case(s) — CLI and uxdsl-core's compile() agree${UPDATE ? ' (oracle refreshed)' : ', matching the committed oracle'}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
