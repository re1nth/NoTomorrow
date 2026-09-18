import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_DEV_DB_PATH = path.join(process.cwd(), '.data', 'notomorrow-dev.db');

export function sqliteDbPath(): string {
  const configured = process.env.SQLITE_DB_PATH?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SQLITE_DB_PATH must be set in production');
  }

  fs.mkdirSync(path.dirname(DEFAULT_DEV_DB_PATH), { recursive: true });
  return DEFAULT_DEV_DB_PATH;
}
