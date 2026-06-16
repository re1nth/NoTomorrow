import * as fs from 'node:fs';

/**
 * Apply pending Drizzle migrations against the desktop SQLite file.
 *
 * The migration runner lives here (not in `@notomorrow/db-sqlite`) because
 * Electron's main process is plain Node CJS and cannot `require()` the raw
 * TS source of the workspace package. We talk to `better-sqlite3` +
 * `drizzle-orm/better-sqlite3` directly — same code, no transpile step.
 */
export function runMigrations(dbFile: string, migrationsFolder: string): void {
  if (!fs.existsSync(migrationsFolder)) {
    console.warn(
      `[notomorrow] migrations folder missing at ${migrationsFolder} — skipping. ` +
        `Run 'pnpm --filter @notomorrow/db-sqlite migrate:gen' to generate it.`,
    );
    return;
  }
  const entries = fs.readdirSync(migrationsFolder).filter((f) => f.endsWith('.sql'));
  if (entries.length === 0) {
    console.warn('[notomorrow] no migration files found — skipping');
    return;
  }
  // Lazy require so better-sqlite3 only loads when we actually need it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3') as new (path: string) => {
    pragma(s: string): unknown;
    close(): void;
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { drizzle } = require('drizzle-orm/better-sqlite3') as {
    drizzle: (db: unknown) => unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator') as {
    migrate: (db: unknown, opts: { migrationsFolder: string }) => void;
  };
  const sqlite = new Database(dbFile);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  sqlite.close();
  console.log(`[notomorrow] migrations applied from ${migrationsFolder}`);
}
