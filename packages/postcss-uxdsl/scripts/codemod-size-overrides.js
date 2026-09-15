#!/usr/bin/env node
'use strict';

/**
 * MIG-06 codemod: folds a manual `border-radius: radius(N);` /
 * `box-shadow: shadow(N);` declaration that immediately follows a sized
 * `@ds-surface`/`@ds-button`/`@ds-input` call into that call's new MIG-05
 * `radius(N)`/`shadow(N)` override argument, removing the now-redundant
 * manual declaration.
 *
 *   .card { @ds-surface(contained 2); border-radius: radius(4); }
 *   -> .card { @ds-surface(contained 2 radius(4)); }
 *
 * Only rewrites a case that is unambiguous: exactly one border-radius (and
 * independently, exactly one box-shadow) declaration in the rule, and its
 * value is a bare radius()/shadow() call — never a literal, calc(), or a
 * responsive expression, since the override argument only takes one static
 * token key. Anything else is left untouched and reported for manual
 * review; this codemod never guesses a size that would drop the original
 * radius/shadow.
 *
 * Usage:
 *   node scripts/codemod-size-overrides.js <file-or-glob...>       # preview only (default)
 *   node scripts/codemod-size-overrides.js --write <file-or-glob...>
 *
 * Idempotent: a file with no more manual-declaration-after-sized-call
 * pattern left produces zero further changes on a second run.
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const CALL_NAMES = ['ds-surface', 'ds-button', 'ds-input'];
const OVERRIDES = [
  ['border-radius', 'radius'],
  ['box-shadow', 'shadow'],
];
// border-radius is a shorthand for these four (plus their logical
// equivalents); box-shadow has no such longhand family in CSS.
const RADIUS_LONGHANDS = new Set([
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'border-start-start-radius', 'border-start-end-radius', 'border-end-start-radius', 'border-end-end-radius',
]);

function stripParens(params) {
  let inner = String(params || '').trim();
  if (inner.startsWith('(') && inner.endsWith(')')) inner = inner.slice(1, -1).trim();
  return inner;
}

/**
 * Migrate one parsed root in place.
 * @returns {{applied: Array, skipped: Array}} a record of what changed and
 *   what was left alone (with the reason), each carrying a 1-based line.
 */
function migrateRoot(root) {
  const applied = [];
  const skipped = [];

  root.walkAtRules(new RegExp(`^(?:${CALL_NAMES.join('|')})$`), (at) => {
    const rule = at.parent;
    if (!rule || rule.type !== 'rule') return;
    const inner = stripParens(at.params);
    const parts = inner.split(/[\s,]+/).filter(Boolean);
    const hasSize = parts.some((part) => /^\d+$/.test(part));
    if (!hasSize) return; // nothing to deduplicate against
    if (parts.some((part) => /^(radius|shadow)\(/.test(part))) return; // already migrated

    const atPosition = rule.index(at);
    // A trailing declaration only belongs to THIS call if no other
    // ds-surface/button/input call sits between them — otherwise a
    // declaration meant for (or superseded by) a later call gets folded
    // into this earlier one, and the later call's own generated value
    // becomes the new last-in-cascade winner once the fold removes it.
    const siblingCallPositions = rule.nodes
      .map((node, index) => (node.type === 'atrule' && CALL_NAMES.includes(node.name) ? index : -1))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    const nextAtPosition = siblingCallPositions.find((index) => index > atPosition) ?? Infinity;

    const additions = [];
    for (const [prop, fn] of OVERRIDES) {
      // Only a declaration positioned after the mixin call (and before the
      // next one, if any) can be the one actually taking effect: the
      // mixin's own generated declaration is inserted at the call's
      // position, so an earlier manual declaration for the same property
      // is already dead code under normal cascade rules, not the override
      // being migrated. Folding a dead declaration in would silently
      // change which value applies.
      const matches = [];
      rule.walkDecls(prop, (decl) => {
        if (decl.parent !== rule) return;
        const index = rule.index(decl);
        if (index > atPosition && index < nextAtPosition) matches.push(decl);
      });
      if (matches.length === 0) continue;
      if (matches.length > 1) {
        skipped.push({ line: at.source?.start?.line, reason: `multiple ${prop} declarations after ${at.name}(${inner}); ambiguous which one is the override` });
        continue;
      }
      const decl = matches[0];
      if (decl.important) {
        skipped.push({ line: decl.source?.start?.line, reason: `${prop} has !important; folding it into the mixin argument would silently drop !important, which the override syntax cannot express` });
        continue;
      }
      {
        // Any declaration sandwiched between the mixin and the target that
        // could change meaning once the target moves into the mixin's own
        // generated output: `all` resets every property (so a later `all:
        // initial/unset/revert` would wipe out a radius/shadow the mixin
        // now bakes in earlier, where today it runs before the sandwiched
        // `all` and survives), and — for border-radius specifically — a
        // corner longhand would flip from "overridden by the later
        // shorthand" to "last, and winning".
        const declPosition = rule.index(decl);
        const sandwiched = [];
        rule.walkDecls((node) => {
          if (node.parent !== rule || node === decl) return;
          const index = rule.index(node);
          if (index <= atPosition || index >= declPosition) return;
          if (node.prop === 'all' || (prop === 'border-radius' && RADIUS_LONGHANDS.has(node.prop))) sandwiched.push(node.prop);
        });
        if (sandwiched.length) {
          skipped.push({ line: decl.source?.start?.line, reason: `${sandwiched.join(', ')} between the mixin and this ${prop}; folding would change what applies there` });
          continue;
        }
      }
      const value = decl.value.trim();
      const match = value.match(new RegExp(`^${fn}\\(([^()]+)\\)$`));
      if (!match) {
        skipped.push({ line: decl.source?.start?.line, reason: `${prop}: ${value} is not a bare ${fn}() call; left as-is to avoid dropping a literal, calc() or responsive value` });
        continue;
      }
      additions.push({ fn, key: match[1].trim(), decl, prop });
    }
    if (!additions.length) return;

    const before = `@${at.name}(${inner})`;
    at.params = `(${[inner, ...additions.map((item) => `${item.fn}(${item.key})`)].join(' ')})`;
    additions.forEach((item) => item.decl.remove());
    applied.push({
      line: at.source?.start?.line,
      before,
      after: `@${at.name}(${stripParens(at.params)})`,
      removed: additions.map((item) => `${item.prop}: ${item.fn}(${item.key});`),
    });
  });

  return { applied, skipped };
}

function migrateFile(filePath, write) {
  const source = fs.readFileSync(filePath, 'utf8');
  const root = postcss.parse(source, { from: filePath });
  const { applied, skipped } = migrateRoot(root);
  if (!applied.length && !skipped.length) return { filePath, applied, skipped, changed: false };
  const output = root.toString();
  const changed = output !== source;
  if (write && changed) fs.writeFileSync(filePath, output, 'utf8');
  return { filePath, applied, skipped, changed };
}

function main(argv) {
  const write = argv.includes('--write');
  const files = argv.filter((arg) => arg !== '--write');
  if (!files.length) {
    console.error('Usage: codemod-size-overrides.js [--write] <file...>');
    process.exitCode = 1;
    return;
  }

  let anyChanged = false;
  let anySkipped = false;
  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file);
    const result = migrateFile(filePath, write);
    if (!result.applied.length && !result.skipped.length) continue;
    console.log(`\n${path.relative(process.cwd(), filePath)}${write && result.changed ? ' (written)' : ' (preview — pass --write to apply)'}`);
    for (const item of result.applied) {
      anyChanged = true;
      console.log(`  L${item.line}: ${item.before}`);
      console.log(`       -> ${item.after}`);
      item.removed.forEach((decl) => console.log(`       removed: ${decl}`));
    }
    for (const item of result.skipped) {
      anySkipped = true;
      console.log(`  L${item.line}: SKIPPED — ${item.reason}`);
    }
  }
  if (!anyChanged && !anySkipped) console.log('No matching @ds-surface/@ds-button/@ds-input + manual radius()/shadow() override found.');
  if (anySkipped) console.log('\nSome cases need manual review (see SKIPPED above); they were left unchanged.');
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { migrateRoot, migrateFile };
