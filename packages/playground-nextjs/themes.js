const { deepMergeTheme } = require('postcss-uxdsl/ds-runtime');
// The packaged base theme (postcss-uxdsl/theme/base.json) is `DEFAULT_THEME`; this
// playground does not keep a copy of it.
const packagedBase = require('postcss-uxdsl/theme/base.json');
// What every named theme of this site shares on top of the packaged base: the color
// collection its swatches and `color(blue.500)`-style references read. It used to come from
// the legacy `postcss-uxdsl/theme/default-colors.css` import, which was the one legacy file
// that contributed names the theme JSON did not already define.
const shared = require('./uxdsl.theme.shared.json');
const baseTheme = deepMergeTheme(packagedBase, shared);
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
