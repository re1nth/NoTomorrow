import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index';

export type SqliteDatabase = BetterSQLite3Database<typeof schema>;

export interface CreateSqliteDbOptions {
  /** If true, the SQLite file is in-memory only (useful for tests). */
  memory?: boolean;
  /** Pragma overrides. Defaults: WAL journal, NORMAL sync, foreign keys ON. */
  pragmas?: Record<string, string | number>;
}

export function createDb(filePath: string, opts: CreateSqliteDbOptions = {}): SqliteDatabase {
  const sqlite = new Database(opts.memory ? ':memory:' : filePath);
  const defaults: Record<string, string | number> = {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    foreign_keys: 'ON',
  };
  const merged = { ...defaults, ...(opts.pragmas ?? {}) };
  for (const [k, v] of Object.entries(merged)) {
    sqlite.pragma(`${k} = ${v}`);
  }
  return drizzle(sqlite, { schema });
}

export { schema };
