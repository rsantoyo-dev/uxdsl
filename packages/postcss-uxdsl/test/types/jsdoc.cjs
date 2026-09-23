// MIG-B6-27 (FEAT-008): the form the README documents for a plain
// `uxdsl.config.cjs` — no TypeScript in the project, types through JSDoc and
// `checkJs`. It uses `require`, never an ESM `import`, because mixing the two
// in a `.cjs` file is a run-time error that a type annotation would hide.
const { defineConfig } = require('postcss-uxdsl/config');

/** @type {import('postcss-uxdsl/config').UxdslConfig} */
module.exports = defineConfig({
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  includeTheme: true,
});
