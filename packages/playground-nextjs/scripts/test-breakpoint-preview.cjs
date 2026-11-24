// The Live theme handler's breakpoint preview: the pure part and the CSSOM walk,
// against a stand-in for document.styleSheets.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DEFAULT_BREAKPOINTS } = require('uxdsl/theme');
const b = require('../src/lib/breakpoint-preview');

const compiled = { ...DEFAULT_BREAKPOINTS }; // xs 0, sm 480, md 768, lg 1024, xl 1280

test('a compiled breakpoint width moves to its previewed width; other widths stay', () => {
  const next = { ...compiled, md: 900 };
  assert.equal(b.rewriteMediaText('(min-width: 768px)', compiled, next), '(min-width: 900px)');
  assert.equal(b.rewriteMediaText('(min-width:768px)', compiled, next), '(min-width:900px)');
  assert.equal(b.rewriteMediaText('print and (min-width: 768px)', compiled, next), 'print and (min-width: 900px)');
  // Control: a width that is not a compiled breakpoint, and a max-width, are left alone.
  assert.equal(b.rewriteMediaText('(min-width: 700px)', compiled, next), '(min-width: 700px)');
  assert.equal(b.rewriteMediaText('(max-width: 768px)', compiled, next), '(max-width: 768px)');
  assert.equal(b.rewriteMediaText('(prefers-color-scheme: dark)', compiled, next), '(prefers-color-scheme: dark)');
});

test('the order of the compiled map is kept, the base stays at 0, widths are whole pixels', () => {
  assert.equal(b.checkPreview(compiled, compiled), null);
  assert.equal(b.checkPreview(compiled, { ...compiled, md: 900 }), null);
  assert.match(b.checkPreview(compiled, { ...compiled, md: 1100 }), /lg \(1024px\) must be wider/);
  assert.match(b.checkPreview(compiled, { ...compiled, sm: 768 }), /md \(768px\) must be wider/);
  assert.match(b.checkPreview(compiled, { ...compiled, xs: 10 }), /base breakpoint/);
  assert.match(b.checkPreview(compiled, { ...compiled, md: 800.5 }), /whole number/);
});

test('only what changed is written to the theme file', () => {
  assert.deepEqual(b.changedBreakpoints(compiled, { ...compiled, md: 900 }), { md: 900 });
  assert.deepEqual(b.changedBreakpoints(compiled, compiled), {});
});

/** A media rule as the CSSOM exposes it: type 4, a mutable media.mediaText, nested rules. */
const mediaRule = (text, cssRules = []) => ({ type: 4, media: { mediaText: text }, cssRules });
const styleRule = (cssRules) => ({ type: 1, cssRules });

test('rules are rewritten from their compiled condition, so crossing a neighbour does not drag it, and a reset is exact', () => {
  const md = mediaRule('(min-width: 768px)');
  const lg = mediaRule('(min-width: 1024px)');
  const nested = mediaRule('(min-width: 768px)');
  const local = mediaRule('(min-width: 700px)');
  const doc = {
    styleSheets: [
      { cssRules: [md, lg, styleRule([nested]), local] },
      { get cssRules() { throw new Error('SecurityError'); } }, // a cross-origin sheet is skipped
    ],
  };
  const originals = new WeakMap();

  // md moves up to where lg was compiled, and lg moves on: lg's rule must follow lg, not md.
  const moved = b.applyToDocument(doc, compiled, { ...compiled, md: 1024, lg: 1200 }, originals);
  assert.equal(md.media.mediaText, '(min-width: 1024px)');
  assert.equal(lg.media.mediaText, '(min-width: 1200px)');
  assert.equal(nested.media.mediaText, '(min-width: 1024px)');
  assert.equal(local.media.mediaText, '(min-width: 700px)');
  assert.equal(moved, 3);

  // Applying again from the moved state still starts from the compiled conditions.
  b.applyToDocument(doc, compiled, { ...compiled, md: 900 }, originals);
  assert.equal(md.media.mediaText, '(min-width: 900px)');
  assert.equal(lg.media.mediaText, '(min-width: 1024px)');

  // Reset: the compiled map puts every rule back.
  assert.equal(b.applyToDocument(doc, compiled, compiled, originals), 0);
  assert.deepEqual([md, lg, nested].map((r) => r.media.mediaText), ['(min-width: 768px)', '(min-width: 1024px)', '(min-width: 768px)']);
});

test('an edit of the whole theme: the breakpoints go to the preview, the rest to applyTheme', () => {
  const theme = { palette: { primary: { main: 'red' } }, breakpoints: { ...compiled } };
  // Moved: the theme gets its compiled breakpoints back, the preview gets the new ones.
  const moved = b.splitThemeEdit(compiled, { ...theme, breakpoints: { ...compiled, md: 900 } });
  assert.deepEqual(moved.theme.breakpoints, compiled);
  assert.equal(moved.theme.palette.primary.main, 'red');
  assert.deepEqual(moved.preview, { ...compiled, md: 900 });
  // Unchanged: no preview.
  assert.equal(b.splitThemeEdit(compiled, theme).preview, null);
  // Added, removed, or out of order: refused with the reason, nothing to apply.
  assert.match(b.splitThemeEdit(compiled, { ...theme, breakpoints: { ...compiled, xxl: 1600 } }).error, /not added or removed/);
  const { xl, ...withoutXl } = compiled;
  assert.match(b.splitThemeEdit(compiled, { ...theme, breakpoints: withoutXl }).error, /not added or removed/);
  assert.match(b.splitThemeEdit(compiled, { ...theme, breakpoints: { ...compiled, md: 2000 } }).error, /must be wider/);
  // What the JSON tab shows: the previewed breakpoints, in the theme's own key order.
  const shown = b.withBreakpoints({ colors: {}, breakpoints: compiled, palette: {} }, { ...compiled, lg: 1200 });
  assert.deepEqual(Object.keys(shown), ['colors', 'breakpoints', 'palette']);
  assert.equal(shown.breakpoints.lg, 1200);
});
