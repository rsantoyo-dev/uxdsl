const path = require('path');
const theme = require('./uxdsl.theme.green.json');

module.exports = {
  entry: path.join(process.cwd(), 'src/app/uxdsl-entry.uxdsl'),
  outFile: path.join(process.cwd(), 'src/app/uxdsl.css'),
  breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 },
  watch: ['src/**/*.uxdsl', 'src/**/*.css', 'uxdsl.theme.green.json'],
  theme,
};
