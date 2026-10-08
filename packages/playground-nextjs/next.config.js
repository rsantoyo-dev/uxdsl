const withMDX = require('@next/mdx')()
const path = require('node:path')

// The routes the site had before its information architecture was settled, and where each
// one lives now. Permanent, so search engines and old links follow them.
const MOVED = {
  '/docs': '/docs/introduction',
  '/docs/home': '/',
  '/docs/config': '/docs/theme',
  '/theming': '/docs/theme',
  '/docs/densities': '/docs/spacing',
  '/densities': '/docs/spacing',
  '/spacing': '/docs/spacing',
  '/docs/palette': '/docs/colors',
  '/palette': '/docs/colors',
  '/colors': '/docs/colors',
  '/docs/productivity': '/docs/surfaces',
  '/productivity': '/docs/surfaces',
  '/docs/cli': '/docs/tooling',
  '/docs/contrast': '/docs/accessibility',
  '/borders': '/docs/borders',
  '/buttons': '/docs/buttons',
  '/inputs': '/docs/inputs',
  '/shadows': '/docs/shadows',
  '/surfaces': '/docs/surfaces',
  '/typography': '/docs/typography',
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The monorepo demo consumes the current engine source, not a stale local dist.
  experimental: { externalDir: true },
  // The version the documentation describes, shown in the header and on the quick start.
  env: { UXDSL_VERSION: require('../uxdsl/package.json').version },
  async redirects() {
    return [
      // One canonical host: the Vercel alias answers with a permanent redirect to uxdsl.io.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'uxdsl.vercel.app' }],
        destination: 'https://uxdsl.io/:path*',
        permanent: true,
      },
      ...Object.entries(MOVED).map(([source, destination]) => ({ source, destination, permanent: true })),
    ]
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'uxdsl/runtime$': path.resolve(__dirname, '../uxdsl/src/entries/runtime.ts'),
      'uxdsl/theme$': path.resolve(__dirname, '../uxdsl/src/entries/theme.ts'),
      'uxdsl/language$': path.resolve(__dirname, '../uxdsl/src/entries/language.ts'),
      'uxdsl/engine$': path.resolve(__dirname, '../uxdsl/src/entries/engine.ts'),
    }
    return config
  },
  // Configure `pageExtensions` to include MDX files
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = withMDX(nextConfig);
