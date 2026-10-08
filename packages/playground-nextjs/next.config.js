const withMDX = require('@next/mdx')()
const path = require('node:path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The monorepo demo consumes the current engine source, not a stale local dist.
  experimental: { externalDir: true },
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
        hostname: 'loremflickr.com',
        port: '',
        pathname: '/**',
      },
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
