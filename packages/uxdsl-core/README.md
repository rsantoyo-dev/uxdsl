# uxdsl-core

Core processing engine for UXDSL - a lightweight CSS DSL for design systems.

## Installation

```bash
npm install uxdsl-core
```

## Usage

```javascript
const processUxdsl = require('uxdsl-core');

const css = await processUxdsl(`
body {
  background: theme(primary.main);
  padding: xs(10px) lg(20px);
}
`, {
  breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
});

console.log(css); // Processed CSS
```

## API

### processUxdsl(source, options)

- `source`: String containing UXDSL code
- `options`: Object with configuration
  - `fileId`: Optional file path for imports
  - `breakpoints`: Object with breakpoint definitions

Returns a Promise that resolves to processed CSS string.

## License

MIT