// The same file with a typo: `checkJs` has to catch it in plain JavaScript too,
// or the annotation is decorative.
const { defineConfig } = require('postcss-uxdsl/config');

/** @type {import('postcss-uxdsl/config').UxdslConfig} */
module.exports = defineConfig({
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  // @ts-expect-error `includeThem` is ignored by the CLI at run time.
  includeThem: true,
});
