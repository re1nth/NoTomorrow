import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { parse } from 'node:url';

/**
 * Boots Next.js in-process and returns the localhost URL to load in the
 * BrowserWindow. Uses dev mode against `apps/web` source for Phase A — Phase E
 * will switch packaged builds to `.next/standalone`.
 */
export async function startNext(webDir: string): Promise<string> {
  // Load Next from the user's apps/web/node_modules instead of the .app's
  // bundled node_modules. The packaged launcher deliberately doesn't bundle
  // Next + React — they live in the repo, alongside the source they render —
  // so requiring through the .app's asar would miss react and other peer deps.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createRequire } = require('node:module') as typeof import('node:module');
  const webRequire = createRequire(require('node:path').join(webDir, 'package.json'));
  const nextFactory = webRequire('next') as (opts: {
    dev: boolean;
    dir: string;
    quiet?: boolean;
  }) => {
    prepare(): Promise<void>;
    getRequestHandler(): (req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: ReturnType<typeof parse>) => Promise<void>;
  };

  // Use prod mode only when `.next/` exists. The packaged .app sets
  // NODE_ENV=production, but if the user hasn't run `pnpm --filter web build`
  // yet, prod mode would crash with "Could not find a production build".
  // Falling back to dev means a slow first launch (webpack compile) but a
  // working window — much better UX than a blank failure.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { existsSync } = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { join } = require('node:path') as typeof import('node:path');
  const hasProdBuild = existsSync(join(webDir, '.next', 'BUILD_ID'));
  const dev = process.env.NODE_ENV !== 'production' || !hasProdBuild;
  if (process.env.NODE_ENV === 'production' && !hasProdBuild) {
    console.warn(
      "[notomorrow] no .next/ build found at " +
        webDir +
        ' — falling back to dev mode (run `pnpm --filter web build` for a fast launch).',
    );
  }
  // Tailwind/PostCSS resolve their configs relative to cwd, not Next's `dir`.
  // Switch cwd before starting so plugin discovery lands inside apps/web.
  process.chdir(webDir);
  const app = nextFactory({ dev, dir: webDir });
  await app.prepare();
  const handle = app.getRequestHandler();

  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = parse(req.url ?? '/', true);
      handle(req, res, parsedUrl).catch((err) => {
        console.error('[notomorrow] Next handler error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal error');
        }
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo | null;
      if (!addr) {
        reject(new Error('Next server failed to bind'));
        return;
      }
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}
