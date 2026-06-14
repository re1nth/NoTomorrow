/**
 * Inngest client factory.
 *
 * One client per process. The web app imports `inngest` from here and hands
 * it to `serve(...)` at `/api/inngest`. Tests can construct their own client
 * with a stub event key.
 */
import { Inngest, EventSchemas } from 'inngest';
import type { Events } from './events.js';

/** Default app id used when nothing more specific is set. */
export const APP_ID = 'notomorrow';

/**
 * Build a typed Inngest client. Reads `INNGEST_EVENT_KEY` /
 * `INNGEST_SIGNING_KEY` from the environment when present — both are
 * optional in local dev (the Inngest dev server runs unauthenticated).
 *
 * Return type is inferred so the `Events` record propagates through to
 * `createFunction` calls (gives us type-safe `event.data` in handlers).
 */
export function createInngest(options: { id?: string; eventKey?: string } = {}) {
  return new Inngest({
    id: options.id ?? APP_ID,
    schemas: new EventSchemas().fromRecord<Events>(),
    eventKey: options.eventKey ?? process.env.INNGEST_EVENT_KEY,
  });
}

/** Process-wide singleton — what `apps/web` imports. */
export const inngest = createInngest();

/** Inferred client type — exported for downstream typed imports. */
export type AppInngest = ReturnType<typeof createInngest>;
