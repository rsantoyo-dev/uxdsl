const path = require('path');
// MIG-B7-17 phase C: the playground's own build config uses the typed helper the package
// ships (`uxdsl/config`), as it recommends to every project — it was a plain object.
// The theme is not here: `uxdsl build` discovers `uxdsl.theme.cjs` next to this
// file, which exports the site's default theme (base + override) from themes.js.
const { defineConfig } = require('uxdsl/config');

module.exports = defineConfig({
  entry: path.join(process.cwd(), 'src/app/uxdsl-entry.uxdsl'),
  outFile: path.join(process.cwd(), 'src/app/uxdsl.css'),
  watch: ['src/**/*.uxdsl', 'src/**/*.css', 'uxdsl.theme.*.json', 'themes.js'],
});
