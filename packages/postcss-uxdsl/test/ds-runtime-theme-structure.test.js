// MIG-B6-30 (FEAT-008): the line between "a value moved" and "the compiler
// would now emit something else".
//
// `applyTheme` swaps one stylesheet of custom properties. It cannot rewrite the
// rules a build already compiled into the host's own CSS — the declarations a
// `@ds-button` expanded into, the `@media` queries baked into a component's
// responsive declaration. A patch that changes those must fail loudly and tell
// the developer to rebuild, because the alternative is a page that looks
// subtly, silently wrong.
//
// Both directions are tested on purpose. Rejecting an ordinary value change
// would make the API useless, so the "allowed" half matters as much as the
// "rejected" half.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const runtime = require('../dist/ds-runtime');
const { applyTheme, getAppliedTheme } = runtime;

function makeDocument() {
  const byId = new Map();
  return {
    createElement(tagName) {
      const attributes = {};
      return {
        tagName: tagName.toUpperCase(), id: '', textContent: '',
        setAttribute(name, value) { attributes[name] = value; },
        getAttribute(name) { return name in attributes ? attributes[name] : null; },
      };
    },
    getElementById(id) { return byId.get(id) || null; },
    head: { appendChild(node) { if (node.id) byId.set(node.id, node); return node; } },
  };
}

/** Initializes a fresh document with `projectOverride`, then applies `patch`
 * and reports the outcome together with whether anything actually moved. */
function afterPatch(projectOverride, patch, options = {}) {
  const doc = makeDocument();
  const previous = globalThis.document;
  globalThis.document = doc;
  try {
    const init = applyTheme(projectOverride, { replace: true });
    assert.equal(init.ok, true, init.ok ? '' : `setup failed: ${init.error.message}`);
    const style = doc.getElementById(runtime.DEFAULT_THEME_STYLE_ID);
    const cssBefore = style.textContent;
    const appliedBefore = getAppliedTheme();

    const result = applyTheme(patch, options);
    return {
      result,
      cssChanged: style.textContent !== cssBefore,
      stateChanged: JSON.stringify(getAppliedTheme()) !== JSON.stringify(appliedBefore),
    };
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
}

function assertRejected(label, outcome, expectedFragment) {
  assert.equal(outcome.result.ok, false, `${label}: expected a rejection`);
  assert.equal(outcome.result.error.code, 'UXD_THEME_STRUCTURE',
    `${label}: expected a structural error, got ${outcome.result.error.message}`);
  assert.match(outcome.result.error.message, /Rebuild the project/,
    `${label}: the error must say what to do about it`);
  assert.match(outcome.result.error.message, expectedFragment,
    `${label}: the error must name what changed — got ${outcome.result.error.message}`);
  assert.equal(outcome.cssChanged, false, `${label}: the stylesheet must be left untouched`);
  assert.equal(outcome.stateChanged, false, `${label}: the applied theme must be left untouched`);
}

function assertAllowed(label, outcome) {
  assert.equal(outcome.result.ok, true, `${label}: expected this to be allowed, got ${outcome.result.ok ? '' : outcome.result.error.message}`);
  // The applied override must really have moved. The *stylesheet* is not
  // asserted here: adding a breakpoint name no token references produces
  // byte-identical CSS, and that is correct, not a failure to apply.
  assert.equal(outcome.stateChanged, true, `${label}: the applied override should have changed`);
}

test('MIG-B6-30: adding a typography field is rejected', () => {
  // `textTransform` is not inherited from the `default` role, so adding it to
  // h1 genuinely adds a declaration `@ds-typo(h1)` would emit.
  assertRejected('add typography field',
    afterPatch({}, { typography_details: { h1: { textTransform: 'uppercase' } } }),
    /typography role "h1" now emits a different set of fields/);
});

test('MIG-B6-30: removing a typography field is rejected', () => {
  // Removal is only expressible for a field the project itself added, since an
  // override cannot delete a base field — so the project declares it, then a
  // `replace` patch drops it.
  assertRejected('remove typography field',
    afterPatch(
      { typography_details: { h1: { textTransform: 'uppercase' } } },
      {},
      { replace: true }),
    /typography role "h1" now emits a different set of fields/);
});

test('MIG-B6-30: introducing a focus-visible state is rejected', () => {
  assertRejected('introduce focusvisible',
    afterPatch({}, { buttons: { contained: { states: { focusvisible: { outline: '2px solid palette(primary.main)' } } } } }),
    /button role "contained" changed its states/);
});

test('MIG-B6-30: changing the Surface a Button composes from is rejected', () => {
  assertRejected('change button surface',
    afterPatch({}, { buttons: { contained: { surface: 'outlined' } } }),
    /button role "contained" changed its Surface from "contained" to "outlined"/);
});

test('MIG-B6-30: changing an Input state is rejected too', () => {
  assertRejected('change input state',
    afterPatch({}, { inputs: { outlined: { states: { hover: { bg: 'palette(surface.main)' } } } } }),
    /input role "outlined"/);
});

test('MIG-B6-30: moving a breakpoint threshold is rejected', () => {
  assertRejected('move a threshold',
    afterPatch({}, { breakpoints: { md: 800 } }),
    /breakpoint "md" moved from 768px to 800px/);
});

test('MIG-B6-30: a palette family losing its tone variants is rejected', () => {
  // `@ds-button(role family)` emits tone variables only while the family has
  // main/dark/contrast, so dropping one changes what a compiled rule needed.
  //
  // It has to be a family the *project* declared: `resolveTheme` merges every
  // override over the packaged base, so a base family always gets its variants
  // back and can never lose eligibility this way.
  assertRejected('lose tone eligibility',
    afterPatch(
      { palette: { brand: { main: '#0f172a', dark: '#020617', contrast: '#ffffff' } } },
      { palette: { brand: { main: '#0f172a', contrast: '#ffffff' } } },
      { replace: true }),
    /no longer qualifies as a Button\/Input tone/);
});

test('MIG-B6-30: a base palette family keeps its tone variants through an override', () => {
  // The mirror of the case above, so the asymmetry is recorded rather than
  // discovered again: omitting `primary.dark` in an override is not a removal.
  const outcome = afterPatch({}, { palette: { primary: { main: '#000000', contrast: '#ffffff' } } }, { replace: true });
  assert.equal(outcome.result.ok, true, outcome.result.ok ? '' : outcome.result.error.message);
});

test('MIG-B6-30: ordinary value changes are allowed', () => {
  assertAllowed('palette value', afterPatch({}, { palette: { primary: { main: '#0ea5e9' } } }));
  assertAllowed('spacing value', afterPatch({}, { spacing: { 4: '0.8rem' } }));
  assertAllowed('shadow value', afterPatch({}, { shadows: { 2: '0 1px 2px rgba(0,0,0,0.2)' } }));
  assertAllowed('radius value', afterPatch({}, { radii: { 2: '10px' } }));
  assertAllowed('typography value for a field the role already emits',
    afterPatch({}, { typography_details: { h1: { fontSize: '3rem' } } }));
});

test('MIG-B6-30: dark-mode colors are a value change, not a structural one', () => {
  assertAllowed('dark mode palette',
    afterPatch({}, { modes: { dark: { palette: { surface: { main: '#111111', contrast: '#eeeeee' } } } } }));
});

test('MIG-B6-30: a responsive expression over the same thresholds is allowed', () => {
  assertAllowed('responsive density over existing thresholds',
    afterPatch({}, { densities: { 4: 'xs(space(1)) md(space(3)) xl(space(5))' } }));
});

test('MIG-B6-30: adding a token or a breakpoint name is allowed', () => {
  // Nothing compiled earlier can reference either, so neither can break it.
  assertAllowed('add a shadow token', afterPatch({}, { shadows: { 9: '0 0 0 1px rgba(0,0,0,0.1)' } }));
  assertAllowed('add a breakpoint name', afterPatch({}, { breakpoints: { xxl: 1600 } }));
});

test('MIG-B6-30: the rejection names every change, not just the first', () => {
  const outcome = afterPatch({}, {
    breakpoints: { md: 800 },
    buttons: { contained: { surface: 'outlined' } },
  });
  assert.equal(outcome.result.ok, false);
  const { changes } = outcome.result.error;
  assert.ok(Array.isArray(changes) && changes.length >= 2,
    `expected every change listed, got ${JSON.stringify(changes)}`);
  assert.ok(changes.some((c) => /breakpoint "md"/.test(c)));
  assert.ok(changes.some((c) => /Surface/.test(c)));
});
