# uxdsl-cli

Command-line build/watch utility for UXDSL projects.

## Installation

```bash
npm install -g uxdsl-cli
# or
npm install uxdsl-cli
```

## Usage

1. Create an `uxdsl.config.cjs` file in your project root:

```js
const path = require('path');

module.exports = {
  entry: path.join(process.cwd(), 'src/app/uxdsl-entry.uxdsl'),
  outFile: path.join(process.cwd(), 'src/app/uxdsl.css'),
  breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 },
  watch: ['src/**/*.uxdsl', 'src/**/*.css'],
};
```

2. Point the CLI at that config:

```bash
# Build once
npx uxdsl build

# Build and recompile on change
npx uxdsl build --watch
```

You can also skip the config file and pass paths directly:

```bash
npx uxdsl build --entry src/app/uxdsl-entry.uxdsl --out src/app/uxdsl.css --watch
```

The entry file can be a thin orchestrator of `@import` statements that pull in
the UXDSL defaults plus your app’s `.uxdsl` modules.

## License

MIT