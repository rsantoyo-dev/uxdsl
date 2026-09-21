'use strict';

// MIG-B6-26 (FEAT-008) acceptance gate: a real `vsce package` run, not a
// `tsc` compile alone (which proves nothing about highlighting or
// packaging — see the story's own "Pruebas" section). Verifies the
// produced .vsix actually contains a valid manifest, the grammar, the
// language configuration, the custom data, and the compiled activation
// entry point — by listing and extracting from the real zip archive
// `vsce` wrote, not by trusting the build succeeded.
//
// Does not launch a VS Code extension host — that would need
// @vscode/test-electron and a downloaded Code binary, out of scope here
// (documented gap, see the story's evidence). This proves the package is
// well-formed and self-consistent, not that VS Code renders it correctly.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const PKG_DIR = path.resolve(__dirname, '..', '..', 'packages', 'uxdsl-vscode');

function run(cmd, args, cwd = PKG_DIR) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8' });
}

function main() {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
  const vsixName = `${pkgJson.name}-${pkgJson.version}.vsix`;
  const vsixPath = path.join(PKG_DIR, vsixName);
  fs.rmSync(vsixPath, { force: true });

  run('npm', ['run', 'package']);
  assert.ok(fs.existsSync(vsixPath), `vsce package must produce ${vsixName}`);
  console.log(`  ok  - npm run package produces ${vsixName}`);

  const listing = run('unzip', ['-l', vsixPath]);
  const requiredEntries = [
    'extension.vsixmanifest',
    'extension/package.json',
    'extension/language-configuration.json',
    'extension/uxdsl.custom-data.json',
    'extension/syntaxes/uxdsl.tmLanguage.json',
    'extension/out/extension.js',
    'extension/out/completion-context.js',
    'extension/out/generated-completions.js',
  ];
  for (const entry of requiredEntries) {
    assert.ok(listing.includes(entry), `${entry} must be inside the packaged .vsix\n${listing}`);
  }
  console.log('  ok  - the manifest, grammar, language configuration, custom data and compiled entry points are all inside the .vsix');

  // Dev-only files (never needed to *run* the extension) must not bloat
  // the package a real user installs.
  for (const excluded of ['extension/src/extension.ts', 'extension/test/completion-context.test.js', 'extension/tsconfig.json']) {
    assert.ok(!listing.includes(excluded), `${excluded} must be excluded from the packaged .vsix (see .vscodeignore)\n${listing}`);
  }
  console.log('  ok  - source/test/tsconfig files are excluded from the packaged .vsix');

  const manifest = run('unzip', ['-p', vsixPath, 'extension.vsixmanifest']);
  assert.match(manifest, /Id="uxdsl-vscode"/);
  assert.match(manifest, new RegExp(`Version="${pkgJson.version.replace(/\./g, '\\.')}"`));
  console.log('  ok  - extension.vsixmanifest declares the expected id and version');

  const packagedPkgJson = JSON.parse(run('unzip', ['-p', vsixPath, 'extension/package.json']));
  assert.ok(packagedPkgJson.activationEvents.includes('onLanguage:uxdsl'), 'the packaged manifest must still activate on the uxdsl language');
  assert.ok(packagedPkgJson.contributes.languages.some((l) => l.id === 'uxdsl'), 'the packaged manifest must still contribute the uxdsl language');
  assert.ok(packagedPkgJson.contributes.grammars.some((g) => g.scopeName === 'source.uxdsl'), 'the packaged manifest must still contribute the uxdsl grammar');
  console.log('  ok  - the packaged package.json still declares language activation, contribution and grammar');

  const grammar = JSON.parse(run('unzip', ['-p', vsixPath, 'extension/syntaxes/uxdsl.tmLanguage.json']));
  assert.equal(grammar.scopeName, 'source.uxdsl');
  assert.ok(grammar.repository.directives.patterns[0].match.includes('ds-surface'));
  console.log('  ok  - the packaged grammar is valid JSON and matches the expected scope/directives');

  console.log('PASS');
  console.log('All checks passed.');
}

main();
