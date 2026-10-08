// What a Next.js project writes to use UXDSL through PostCSS only: Next's own
// default plugins (a custom postcss.config.js replaces them), then the UXDSL
// plugin with includeTheme: false, so CSS Modules never carry :root. The one
// global stylesheet says where the theme goes with `@uxdsl theme;`.
module.exports = {
  plugins: {
    'next/dist/compiled/postcss-flexbugs-fixes': {},
    'next/dist/compiled/postcss-preset-env': {
      autoprefixer: { flexbox: 'no-2009' },
      stage: 3,
      features: { 'custom-properties': false },
    },
    'uxdsl/postcss': { includeTheme: false },
  },
};
