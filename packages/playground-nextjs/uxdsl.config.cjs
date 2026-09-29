const path = require('path');
const fs = require('fs');
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
  // Component entries consume the richer legacy Color/Palette sheets emitted by
  // the global entry. Give strict reference validation those exact definitions.
  references: {
    css: ['default-colors.css', 'default-palette.css'].map(name =>
      fs.readFileSync(require.resolve(`postcss-uxdsl/theme/${name}`), 'utf8')),
  },
  watch: ['src/**/*.uxdsl', 'src/**/*.css', 'uxdsl.theme.*.json', 'themes.js'],
  theme,
});
