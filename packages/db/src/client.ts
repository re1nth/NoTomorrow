import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Options } from 'postgres';
import * as schema from './schema/index';

/**
 * Typed drizzle database — generic over the full schema barrel so callers get
 * autocompletion on `db.query.users`, `db.select().from(goals)`, etc.
 */
export type DrizzleDatabase = PostgresJsDatabase<typeof schema>;

export interface CreateDbOptions {
  /**
   * Maximum number of connections in the pool. Default 10 — sane for serverless
   * runtimes (Next.js route handlers) and small workers. Bump for the
   * coach/inngest workers if they fan out.
   */
  max?: number;
  /** Idle connection timeout in seconds. Default 30s. */
  idleTimeout?: number;
  /** Connection acquisition timeout in seconds. Default 10s. */
  connectTimeout?: number;
  /** Forwarded to `postgres()` for advanced cases (TLS, types, debug). */
  pg?: Options<Record<string, never>>;
}

/**
 * Create a typed drizzle client.
 *
 *   const db = createDb(process.env.DATABASE_URL!);
 *   const rows = await db.select().from(users);
 *
 * Pool size + timeouts have sensible defaults; override via `opts` for
 * long-running workers (e.g. infra/inngest) or tight serverless budgets.
 */
export function createDb(url: string, opts: CreateDbOptions = {}): DrizzleDatabase {
  const sql = postgres(url, {
    max: opts.max ?? 10,
    idle_timeout: opts.idleTimeout ?? 30,
    connect_timeout: opts.connectTimeout ?? 10,
    // Important: keep `prepare: false` off the default; postgres.js prepared
    // statements are fine for our long-lived processes. Set `prepare: false`
    // explicitly via `opts.pg` when running on PgBouncer in transaction mode.
    ...opts.pg,
  });
  return drizzle(sql, { schema });
}

/**
 * Lower-level escape hatch for migrations and tests that need the raw
 * postgres.js client (e.g. to `.end()` the pool deterministically).
 */
export function createDbWithClient(
  url: string,
  opts: CreateDbOptions = {},
): { db: DrizzleDatabase; client: ReturnType<typeof postgres> } {
  const client = postgres(url, {
    max: opts.max ?? 10,
    idle_timeout: opts.idleTimeout ?? 30,
    connect_timeout: opts.connectTimeout ?? 10,
    ...opts.pg,
  });
  return { db: drizzle(client, { schema }), client };
}

export { schema };
