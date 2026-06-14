/**
 * `pnpm --filter @notomorrow/inngest dev`
 *
 * Tiny Node HTTP server that mounts the Inngest serve handler at
 * `/api/inngest` so a developer can point the Inngest dev CLI at it without
 * needing `apps/web` running. Intended for local-only smoke testing.
 *
 * Production: `apps/web` mounts the same `functions` export at its own
 * `/api/inngest` route — do not deploy this dev server.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { serve } from 'inngest/node';
import { inngest, functions } from './index.js';

const PORT = Number.parseInt(process.env.PORT ?? '8288', 10);

const handler = serve({ client: inngest, functions: [...functions] });

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url?.startsWith('/api/inngest')) {
    return handler(req, res);
  }
  res.statusCode = 404;
  res.end('not found — try /api/inngest');
});

server.listen(PORT, () => {
  console.log(
    `[@notomorrow/inngest] dev server listening on http://localhost:${PORT}/api/inngest`,
  );
  console.log('Run `npx inngest-cli@latest dev` in another terminal to register.');
});
