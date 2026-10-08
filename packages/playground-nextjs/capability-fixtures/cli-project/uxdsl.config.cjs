// The build config of the small project whose real CLI output the playground's /docs/tooling
// page shows (captured by scripts/capture-capabilities.js). `defineConfig` is the typed
// helper from `uxdsl/config`. The theme is not named here: `uxdsl build` discovers
// `uxdsl.theme.json` next to this file.
const path = require('path');
const { defineConfig } = require('uxdsl/config');

module.exports = defineConfig({
  entry: path.join(__dirname, 'src/main.uxdsl'),
  outFile: path.join(__dirname, 'dist/app.css'),
});
