const { deepMergeTheme } = require('postcss-uxdsl/ds-runtime');
// MIG-B6-29 (FEAT-008): the base theme moved into the package itself —
// this playground no longer owns the only copy of it.
const baseTheme = require('postcss-uxdsl/theme/base.json');
const overrides = {
  default: require('./uxdsl.theme.default.json'),
  green: require('./uxdsl.theme.green.json'),
  purple: require('./uxdsl.theme.purple.json'),
  slate: require('./uxdsl.theme.slate.json'),
};
const themes = Object.fromEntries(
  Object.entries(overrides).map(([name, override]) => [name, deepMergeTheme(baseTheme, override)])
);
module.exports = { baseTheme, themes };
