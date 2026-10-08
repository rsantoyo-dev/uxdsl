'use strict';

// The surface the former `postcss-uxdsl/ds-runtime` barrel exposed, rebuilt
// from the public entries that replaced it: `uxdsl/engine` (engines, theme
// model, contrast, references) plus `uxdsl/runtime` (the browser API). The
// suites written against the old barrel read it through here; what each entry
// exports on its own is pinned by test/entries.test.js.
module.exports = {
  ...require('../../dist/entries/engine'),
  ...require('../../dist/entries/runtime'),
};
