// The uxdsl CLI builds styles/panel.module.uxdsl into the CSS Module
// pages/index.js imports. Entries resolve from this directory. The module
// leaves the theme out: the page gets it from styles/theme.css, and a
// .module.css file holding :root is not pure.
module.exports = {
  builds: [
    { entry: '../styles/panel.module.uxdsl', outFile: '../styles/panel.generated.module.css', includeTheme: false },
  ],
};
