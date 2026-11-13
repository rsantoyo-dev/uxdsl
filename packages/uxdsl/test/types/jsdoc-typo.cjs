// The same file with a typo: `checkJs` has to catch it in plain JavaScript too,
// or the annotation is decorative.
const { defineConfig } = require('uxdsl/config');

/** @type {import('uxdsl/config').UxdslConfig} */
module.exports = defineConfig({
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  // @ts-expect-error `outfile` is not `outFile`, and the CLI would not read it.
  outfile: './dist/other.css',
});
