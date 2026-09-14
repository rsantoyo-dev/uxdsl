const path = require('path');
const { themes } = require('./themes');
const theme = themes.default;

module.exports = {
  entry: path.join(process.cwd(), 'src/app/uxdsl-entry.uxdsl'),
  outFile: path.join(process.cwd(), 'src/app/uxdsl.css'),
  breakpoints: theme.breakpoints,
  watch: ['src/**/*.uxdsl', 'src/**/*.css', 'uxdsl.theme.*.json', 'themes.js'],
  theme,
};
