import * as os from 'node:os';

/**
 * Insert a single local user if the `users` table is empty. The packaged
 * desktop app has no sign-in flow — every request is implicitly that single
 * user. Handle is derived from the macOS account name, timezone from the
 * system locale.
 */
export function ensureLocalUser(dbFile: string): { id: string; handle: string } {
  // Lazy require to avoid loading better-sqlite3 during early Electron boot
  // if this fn is never called.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3') as new (path: string) => {
    pragma(s: string): unknown;
    prepare(sql: string): {
      get(...args: unknown[]): unknown;
      run(...args: unknown[]): unknown;
    };
    close(): void;
  };
  const sqlite = new Database(dbFile);
  try {
    sqlite.pragma('foreign_keys = ON');
    const existing = sqlite
      .prepare('SELECT id, handle FROM users LIMIT 1')
      .get() as { id: string; handle: string } | undefined;
    if (existing) return existing;
    const handle = (os.userInfo().username || 'champ')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 32) || 'champ';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const id = crypto.randomUUID();
    const joinedAt = new Date().toISOString();
    sqlite
      .prepare(
        'INSERT INTO users (id, handle, timezone, joined_at) VALUES (?, ?, ?, ?)',
      )
      .run(id, handle, timezone, joinedAt);
    return { id, handle };
  } finally {
    sqlite.close();
  }
}
