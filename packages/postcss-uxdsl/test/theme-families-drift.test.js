'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const { KNOWN_THEME_FAMILIES } = require('../dist/ds-runtime');

const THEME_IDENTIFIERS = new Set(['theme', 'effectiveTheme']);
const DYNAMIC_THEME_ACCESS_INVENTORY = new Map([
  ['theme[collection]', ['buttons', 'inputs']],
]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

function bindingPropertyName(node) {
  if (ts.isComputedPropertyName(node)) return literalElementName(node.expression);
  return ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined;
}

function literalElementName(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined;
}

function readThemeUsage(sourceText, fileName = 'fixture.ts') {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const families = new Set();
  const dynamicAccesses = new Set();

  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && THEME_IDENTIFIERS.has(node.expression.text)) {
      families.add(node.name.text);
    }
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && THEME_IDENTIFIERS.has(node.expression.text)) {
      const name = node.argumentExpression && literalElementName(node.argumentExpression);
      if (name) families.add(name);
      else dynamicAccesses.add(node.getText(source));
    }
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && ts.isIdentifier(node.initializer) && THEME_IDENTIFIERS.has(node.initializer.text)) {
      for (const element of node.name.elements) {
        if (element.dotDotDotToken) continue; // Rest binds the remaining theme, not a family.
        const name = element.propertyName
          ? bindingPropertyName(element.propertyName)
          : ts.isIdentifier(element.name) ? element.name.text : undefined;
        if (name) families.add(name);
        else if (element.propertyName) dynamicAccesses.add(element.propertyName.getText(source));
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return { families, dynamicAccesses };
}

function readThemeUsageFromFile(filePath) {
  return readThemeUsage(fs.readFileSync(filePath, 'utf8'), filePath);
}

function assertRegistered(families) {
  const missing = [...families].filter(family => !KNOWN_THEME_FAMILIES.has(family));
  assert.deepEqual(missing, [], `Add consumed families to KNOWN_THEME_FAMILIES: ${missing.join(', ')}`);
}

test('MIG-B6-01: every statically read top-level theme family is registered', () => {
  const sourceDirectory = path.resolve(__dirname, '../src');
  const usages = sourceFiles(sourceDirectory).map(readThemeUsageFromFile);
  const consumedFamilies = new Set(usages.flatMap(({ families }) => [...families]));
  const dynamicAccesses = new Set(usages.flatMap(({ dynamicAccesses }) => [...dynamicAccesses]));
  const expectedDynamicAccesses = new Set(DYNAMIC_THEME_ACCESS_INVENTORY.keys());

  assert.deepEqual([...dynamicAccesses].sort(), [...expectedDynamicAccesses].sort(), 'Add every computed theme access to DYNAMIC_THEME_ACCESS_INVENTORY.');
  for (const families of DYNAMIC_THEME_ACCESS_INVENTORY.values()) {
    for (const family of families) consumedFamilies.add(family);
  }
  assertRegistered(consumedFamilies);
});

test('MIG-B6-01: destructuring aliases are treated as top-level family reads', () => {
  const { families } = readThemeUsage('const { newFamily: alias } = theme;');
  assert.deepEqual([...families], ['newFamily']);
});

test('MIG-B6-01: computed theme accesses require an explicit inventory entry', () => {
  const { dynamicAccesses } = readThemeUsage('const value = theme[newFamily];');
  assert.deepEqual([...dynamicAccesses], ['theme[newFamily]']);
  assert.equal(DYNAMIC_THEME_ACCESS_INVENTORY.has('theme[newFamily]'), false);
});

test('MIG-B6-01: the guard rejects unregistered reads in every supported static form', () => {
  for (const source of [
    'theme.nuevaFamilia;', 'theme?.nuevaFamilia;', 'effectiveTheme.nuevaFamilia;',
    "theme['nuevaFamilia'];", "theme?.['nuevaFamilia'];",
    'const { nuevaFamilia } = theme;', 'const { nuevaFamilia: alias } = theme;',
    "const { ['nuevaFamilia']: alias } = theme;",
  ]) {
    assert.throws(() => assertRegistered(readThemeUsage(source).families), /nuevaFamilia/, source);
    assert.doesNotThrow(() => assertRegistered(readThemeUsage(source.replaceAll('nuevaFamilia', 'modes')).families));
  }
  assert.deepEqual([...readThemeUsage('const { modes, ...rest } = theme;').families], ['modes']);
});
