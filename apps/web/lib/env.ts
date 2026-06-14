/**
 * Typed env loader. Reads from `process.env` lazily on first access and
 * validates with Zod so the rest of the app can rely on the shape.
 *
 * Lazy access is critical for `next build`: collect-page-data evaluates every
 * route module and would otherwise crash on missing env. Tests fall back to
 * safe defaults so vitest can import any module without exploding. Build
 * (`NEXT_PHASE === 'phase-production-build'`) reuses those same defaults so
 * the static analysis pass succeeds without infra.
 */
import { z } from 'zod';

const schema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  NEXTAUTH_SECRET: z.string().min(8),

  // Database
  DATABASE_URL: z.string().min(1),

  // Coach service (apps/coach)
  COACH_SERVICE_URL: z.string().url(),
  COACH_SERVICE_TOKEN: z.string().min(1),

  // Inngest (optional in dev)
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // GitHub webhook secret (optional in dev)
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // OAuth — Google (optional; sign-in form falls back to email-only)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

const placeholderDefaults = {
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXTAUTH_SECRET: 'placeholder-secret-not-real',
  DATABASE_URL: 'postgres://placeholder:placeholder@localhost:5432/placeholder',
  COACH_SERVICE_URL: 'http://localhost:8001',
  COACH_SERVICE_TOKEN: 'placeholder-token',
};

function isStub(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  );
}

function load(): z.infer<typeof schema> {
  const raw = isStub() ? { ...placeholderDefaults, ...process.env } : process.env;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}

let cached: z.infer<typeof schema> | null = null;
function read(): z.infer<typeof schema> {
  if (!cached) cached = load();
  return cached;
}

/**
 * Lazy env. `env.FOO` triggers validation on first access; tests and the
 * production-build phase get placeholder values so module-load doesn't crash.
 */
export const env = new Proxy({} as z.infer<typeof schema>, {
  get(_t, key: string) {
    return (read() as Record<string, unknown>)[key];
  },
});

export type Env = z.infer<typeof schema>;
