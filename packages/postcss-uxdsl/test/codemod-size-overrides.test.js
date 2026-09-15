const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');
const { migrateRoot, migrateFile } = require('../scripts/codemod-size-overrides');

const run = (source) => {
  const root = postcss.parse(source);
  const result = migrateRoot(root);
  return { css: root.toString(), ...result };
};

test('codemod: folds a manual border-radius override into the @ds-surface call', () => {
  const { css, applied, skipped } = run('.card { @ds-surface(contained 2); border-radius: radius(4); }');
  assert.equal(css, '.card { @ds-surface(contained 2 radius(4)); }');
  assert.equal(applied.length, 1);
  assert.equal(skipped.length, 0);
});

test('codemod: folds a manual box-shadow override, and both together', () => {
  const onlyShadow = run('.a { @ds-surface(contained 2); box-shadow: shadow(1); }');
  assert.equal(onlyShadow.css, '.a { @ds-surface(contained 2 shadow(1)); }');

  const both = run('.b { @ds-surface(contained 2); border-radius: radius(4); box-shadow: shadow(1); }');
  assert.equal(both.css, '.b { @ds-surface(contained 2 radius(4) shadow(1)); }');
});

test('codemod: works for @ds-button and @ds-input too', () => {
  const button = run('.btn { @ds-button(contained 2); border-radius: radius(4); }');
  assert.equal(button.css, '.btn { @ds-button(contained 2 radius(4)); }');
  const input = run('.inp { @ds-input(outlined primary 2); box-shadow: shadow(0); }');
  assert.equal(input.css, '.inp { @ds-input(outlined primary 2 shadow(0)); }');
});

test('codemod: preserves comments and unrelated declarations, and only removes the matched declaration', () => {
  const source = '.card {\n  /* keep me */\n  @ds-surface(contained 2);\n  color: red;\n  border-radius: radius(4);\n  margin: 0;\n}';
  const { css } = run(source);
  assert.match(css, /\/\* keep me \*\//);
  assert.match(css, /color: red;/);
  assert.match(css, /margin: 0;/);
  assert.doesNotMatch(css, /border-radius: radius\(4\);/);
  assert.match(css, /@ds-surface\(contained 2 radius\(4\)\);/);
});

test('codemod: is idempotent — a second pass over the migrated output makes no further changes', () => {
  const first = run('.card { @ds-surface(contained 2); border-radius: radius(4); }');
  const second = run(first.css);
  assert.equal(second.css, first.css);
  assert.equal(second.applied.length, 0);
  assert.equal(second.skipped.length, 0);
});

test('codemod: leaves a call with no numeric size untouched (nothing to deduplicate against)', () => {
  const { css, applied, skipped } = run('.card { @ds-surface(contained); border-radius: radius(4); }');
  assert.equal(css, '.card { @ds-surface(contained); border-radius: radius(4); }');
  assert.equal(applied.length, 0);
  assert.equal(skipped.length, 0);
});

test('codemod: leaves an already-migrated call untouched', () => {
  const source = '.card { @ds-surface(contained 2 radius(4)); }';
  const { css, applied } = run(source);
  assert.equal(css, source);
  assert.equal(applied.length, 0);
});

test('codemod: ignores a declaration positioned before the mixin call — it is already dead code under the cascade, not the override', () => {
  // The mixin's own generated border-radius is inserted at the @ds-surface
  // call's position, so it comes AFTER this one and wins already; folding
  // this earlier, already-overridden value in would change the effective
  // radius from --radius-2 (from size) to --radius-3.
  const { css, applied, skipped } = run('.x { border-radius: radius(3); @ds-surface(contained 2); }');
  assert.equal(css, '.x { border-radius: radius(3); @ds-surface(contained 2); }');
  assert.equal(applied.length, 0);
  assert.equal(skipped.length, 0);
});

test('codemod: flags a manual override marked !important instead of silently dropping !important', () => {
  const { css, applied, skipped } = run('.y { @ds-surface(contained 2); border-radius: radius(4) !important; }');
  assert.equal(css, '.y { @ds-surface(contained 2); border-radius: radius(4) !important; }');
  assert.equal(applied.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /!important/);
});

test('codemod: flags multiple border-radius declarations as ambiguous instead of guessing', () => {
  const { css, applied, skipped } = run('.card { @ds-surface(contained 2); border-radius: radius(3); border-radius: radius(4); }');
  assert.equal(css, '.card { @ds-surface(contained 2); border-radius: radius(3); border-radius: radius(4); }');
  assert.equal(applied.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /multiple border-radius declarations/);
});

test('codemod: flags a non-bare radius() value (literal, calc, responsive) instead of dropping it', () => {
  for (const value of ['8px', 'calc(4px + 1px)', 'xs(radius(2)) md(radius(3))']) {
    const { css, applied, skipped } = run(`.card { @ds-surface(contained 2); border-radius: ${value}; }`);
    assert.equal(css, `.card { @ds-surface(contained 2); border-radius: ${value}; }`, value);
    assert.equal(applied.length, 0, value);
    assert.equal(skipped.length, 1, value);
    assert.match(skipped[0].reason, /not a bare radius\(\) call/, value);
  }
});

test('codemod CLI: --write mode persists changes to disk; default mode previews without touching the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-codemod-'));
  const file = path.join(dir, 'card.uxdsl');
  const source = '.card { @ds-surface(contained 2); border-radius: radius(4); }';
  fs.writeFileSync(file, source, 'utf8');
  try {
    const preview = migrateFile(file, false);
    assert.equal(preview.applied.length, 1);
    assert.equal(fs.readFileSync(file, 'utf8'), source, 'preview mode must not write');

    const written = migrateFile(file, true);
    assert.equal(written.applied.length, 1);
    assert.equal(fs.readFileSync(file, 'utf8'), '.card { @ds-surface(contained 2 radius(4)); }');

    const secondPass = migrateFile(file, true);
    assert.equal(secondPass.applied.length, 0);
    assert.equal(secondPass.changed, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
