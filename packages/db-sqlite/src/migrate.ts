import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate as drizzleMigrate } from 'drizzle-orm/better-sqlite3/migrator';

export function migrate(dbFile: string, migrationsFolder: string): void {
  const sqlite = new Database(dbFile);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  drizzleMigrate(db, { migrationsFolder });
  sqlite.close();
}
