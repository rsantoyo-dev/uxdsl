const path = require('path');
// MIG-B7-17 phase C: the playground's own build config uses the typed helper the package
// ships (`postcss-uxdsl/config`), as it recommends to every project — it was a plain object.
const { defineConfig } = require('postcss-uxdsl/config');
const { themes } = require('./themes');
const moduleEntries = require('./uxdsl-module-entries.json');
const theme = themes.default;

module.exports = defineConfig({
  builds: [
    {
      entry: path.join(process.cwd(), 'src/app/uxdsl-entry.uxdsl'),
      outFile: path.join(process.cwd(), 'src/app/uxdsl.css'),
    },
    ...moduleEntries.map(({ source, output }) => ({
      entry: path.join(process.cwd(), source),
      outFile: path.join(process.cwd(), output),
      includeTheme: false,
    })),
  ],
  breakpoints: theme.breakpoints,
  watch: ['src/**/*.uxdsl', 'src/**/*.css', 'uxdsl.theme.*.json', 'themes.js'],
  theme,
});
