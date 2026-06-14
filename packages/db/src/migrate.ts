import { drizzle } from 'drizzle-orm/postgres-js';
/**
 * CLI entrypoint for `pnpm migrate` — applies all pending migrations under
 * `./migrations` to the database at `DATABASE_URL`.
 *
 * Uses a fresh single-connection client and tears it down on exit so this is
 * safe to call from CI or a docker entrypoint.
 */
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client);
    console.log('Running migrations…');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations complete.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
