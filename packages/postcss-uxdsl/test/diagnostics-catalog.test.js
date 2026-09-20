'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DIAGNOSTIC_CODES } = require('../dist/diagnostics');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.name.endsWith('.ts') && entry.name !== 'diagnostics.ts' ? [entryPath] : [];
  });
}

const COMPOSED_PREFIXES_BY_FILE = new Map([
  ['preset-engine.ts', ['UXD_PRESET', 'UXD_EDGE', 'UXD_SHADOW', 'UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
  ['surfaces.ts', ['UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
  ['naming.ts', ['UXD_FOUNDATION', 'UXD_TYPO', 'UXD_PRESET', 'UXD_EDGE', 'UXD_SHADOW', 'UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
]);

test('MIG-B6-13: every literal or family-prefix UXD code is cataloged', () => {
  const sourceDirectory = path.resolve(__dirname, '../src');
  const emitted = new Set();
  const missingComposedCodes = [];
  const buttonCodes = new Set();
  for (const filePath of sourceFiles(sourceDirectory)) {
    const source = fs.readFileSync(filePath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    for (const match of source.matchAll(/\bUXD_[A-Z0-9_]*[A-Z0-9]\b/g)) emitted.add(match[0]);
    const prefixes = COMPOSED_PREFIXES_BY_FILE.get(path.basename(filePath)) || [];
    for (const match of source.matchAll(/\$\{[^}]+\}(_[A-Z][A-Z0-9_]*)/g)) {
      for (const prefix of prefixes) {
        const code = `${prefix}${match[1]}`;
        if (!DIAGNOSTIC_CODES.has(code)) missingComposedCodes.push(code);
      }
    }
    if (path.basename(filePath) === 'control-engine.ts') {
      for (const match of source.matchAll(/\bUXD_INPUT_([A-Z0-9_]+)\b/g)) buttonCodes.add(`UXD_BUTTON_${match[1]}`);
    }
  }
  const unknown = [...emitted].filter(code => !DIAGNOSTIC_CODES.has(code) && ![...DIAGNOSTIC_CODES].some(known => known.startsWith(`${code}_`)));
  assert.deepEqual(unknown, []);
  assert.deepEqual([...new Set(missingComposedCodes)].sort(), [], 'Register every emitted prefix/suffix combination.');
  assert.deepEqual([...buttonCodes].filter(code => !DIAGNOSTIC_CODES.has(code)).sort(), [], 'Register Button diagnostics derived from the Input template.');
});