const processUxdsl = require('uxdsl-core');

module.exports = async function(source) {
  const callback = this.async();
  try {
    const options = this.query || {};
    const css = await processUxdsl(source, { ...options, fileId: this.resourcePath });
    // For webpack, return the CSS as a module that exports it
    const code = `module.exports = ${JSON.stringify(css)};`;
    callback(null, code);
  } catch (err) {
    callback(err);
  }
};