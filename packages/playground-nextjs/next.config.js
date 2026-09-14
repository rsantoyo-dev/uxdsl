const withMDX = require('@next/mdx')()
const path = require('node:path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The monorepo demo consumes the current engine source, not a stale local dist.
  experimental: { externalDir: true },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'postcss-uxdsl/ds-runtime$': path.resolve(__dirname, '../postcss-uxdsl/src/ds-runtime.ts'),
      'postcss-uxdsl/language$': path.resolve(__dirname, '../postcss-uxdsl/src/language.ts'),
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
