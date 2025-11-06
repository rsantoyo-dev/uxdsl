# uxdsl-webpack-loader

Webpack loader for processing UXDSL files to CSS.

## Installation

```bash
npm install uxdsl-webpack-loader uxdsl-core
```

## Usage

In `webpack.config.js`:

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.uxdsl$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'uxdsl-webpack-loader',
            options: {
              breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
            }
          }
        ]
      }
    ]
  }
};
```

Then in your code:

```javascript
import './styles.uxdsl';
```

## Options

- `breakpoints`: Object defining responsive breakpoints
- Other options passed to uxdsl-core

## License

MIT