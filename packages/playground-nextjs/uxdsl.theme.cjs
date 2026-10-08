// The theme `uxdsl build` compiles this site with: the packaged base theme with the
// `default` override merged over it, resolved once in themes.js and shared with the
// server-rendered theme tag and the runtime's initialization (ThemeContext), so all three
// start from the same effective theme. A theme file exports the theme itself, nothing else.
module.exports = require('./themes').themes.default;
