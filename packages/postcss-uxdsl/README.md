# postcss-uxdsl

PostCSS plugin for processing UXDSL - a lightweight CSS DSL for design systems.

## Installation

```bash
npm install postcss-uxdsl
```

## Usage

```javascript
const postcss = require('postcss');
const uxdsl = require('postcss-uxdsl');

postcss([uxdsl()]).process(css).then(result => {
  console.log(result.css);
});
```

## Options

- `breakpoints`: Object with breakpoint definitions
- `themeVar`: Custom function for theme variable generation

## License

MIT