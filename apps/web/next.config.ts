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
  // We deliberately do NOT use `output: 'standalone'` — Next's standalone
  // tree produces its own server.js and doesn't compose cleanly with our
  // in-process `next({dev:false,dir})` boot in apps/desktop/src/main/server.
  // electron-builder ships the regular `.next/` + source + node_modules tree
  // via `extraResources` instead.
  transpilePackages: [
    '@notomorrow/ui',
    '@notomorrow/domain',
    '@notomorrow/db',
    '@notomorrow/db-sqlite',
    '@notomorrow/inngest',
  ],
  // Native modules — Next must not bundle these. `bindings` is the loader
  // better-sqlite3 uses to find its compiled .node file; if webpack bundles
  // it, its stack-frame parser blows up with a misleading
  // `Cannot read properties of undefined (reading 'indexOf')`.
  serverExternalPackages: ['better-sqlite3', 'bindings'],
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
    // Desktop runtime: redirect every schema import to the SQLite mirror so
    // table references (eq(users.handle, ...), db.query.users.findFirst)
    // share the same drizzle metadata as the SQLite client. Phase B will
    // replace this with the proper @notomorrow/db-interface abstraction.
    if (process.env.NOTOMORROW_RUNTIME === 'desktop') {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        '@notomorrow/db/schema': '@notomorrow/db-sqlite/schema',
        '@notomorrow/db': '@notomorrow/db-sqlite',
      };
    }
    return config;
  },
};

export default nextConfig;
