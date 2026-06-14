import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle-kit configuration.
 *
 * Schema lives in `src/schema/*.ts`; migrations are written to `migrations/`.
 * The database URL is read from `DATABASE_URL` so the same config works for
 * local dev (docker-compose) and CI/production.
 */
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://notomorrow:notomorrow@localhost:5432/notomorrow',
  },
  // Order migrations deterministically.
  strict: true,
  verbose: true,
});
