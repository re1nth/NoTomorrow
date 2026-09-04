import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url));

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
  // Standalone output: Next's file tracer produces .next/standalone/ with only
  // the node_modules files actually reached at runtime. apps/desktop stages
  // that tree into the .app and forks its server.js in a child process — see
  // apps/desktop/build/stage-web.mjs and apps/desktop/src/main/server.ts.
  // Cuts the packaged web/ payload from ~410 MB to ~55 MB.
  output: 'standalone',
  // Tracer needs to see the workspace root so it can follow deps hoisted into
  // the top-level node_modules (pnpm's default layout).
  outputFileTracingRoot: path.join(__dirname_esm, '..', '..'),
  transpilePackages: ['@notomorrow/ui', '@notomorrow/db-sqlite'],
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
  // Bookmarks and outbound links from the retired email/password flow
  // land on /login now that Google is the only sign-in method.
  async redirects() {
    return [
      { source: '/register', destination: '/login', permanent: true },
      { source: '/forgot-password', destination: '/login', permanent: true },
      { source: '/reset-password', destination: '/login', permanent: true },
      { source: '/verify-email', destination: '/login', permanent: true },
    ];
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
