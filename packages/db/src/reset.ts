import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
/**
 * CLI entrypoint for `pnpm reset` — drops the `public` schema, recreates it,
 * and re-applies migrations. Local dev only — guarded against production via
 * a required `--yes` flag or `ALLOW_DB_RESET=1` env var.
 */
import postgres from 'postgres';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const confirmed = process.argv.includes('--yes') || process.env.ALLOW_DB_RESET === '1';
  if (!confirmed) {
    console.error('Refusing to reset DB. Pass --yes or set ALLOW_DB_RESET=1.');
    process.exit(1);
  }

  const client = postgres(url, { max: 1 });
  try {
    console.log('Dropping and recreating public schema…');
    await client.unsafe('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.unsafe('CREATE SCHEMA public;');
    // Drizzle stores its bookkeeping in `drizzle` schema by default; drop too.
    await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE;');

    console.log('Re-applying migrations…');
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Reset complete.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
