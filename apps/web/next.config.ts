import type { NextConfig } from 'next';

/**
 * Next.js config. We transpile the workspace packages because they ship raw
 * TS source (no `dist/` build) — this keeps the inner dev loop tight.
 *
 * The workspace packages use ESM-style `./foo.js` import specifiers that
 * actually resolve to `./foo.ts` source on disk. We teach webpack to follow
 * that via `extensionAlias` so the build can resolve them without a prebuilt
 * `dist/`.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@notomorrow/ui',
    '@notomorrow/domain',
    '@notomorrow/db',
    '@notomorrow/inngest',
  ],
  experimental: {
    // Server actions stay off for MVP — we use REST route handlers.
    serverActions: { allowedOrigins: [] },
  },
  eslint: {
    // Biome is the linter at the repo root; skip next-lint.
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
