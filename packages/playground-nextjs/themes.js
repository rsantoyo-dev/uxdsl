const { deepMergeTheme } = require('postcss-uxdsl/ds-runtime');
const baseTheme = require('./uxdsl.theme.base.json');
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
