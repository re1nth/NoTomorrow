import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as path from 'node:path';
import { parse } from 'node:url';

export type NextHandle = {
  url: string;
  stop: () => Promise<void>;
};

/**
 * Boots Next.js and returns the localhost URL to load in the BrowserWindow.
 *
 * Two modes:
 *  - Packaged: `server.js` exists in the staged standalone tree, so we fork it
 *    as an Electron-as-Node child process. Isolates Next in its own process.
 *  - Dev (`pnpm dev`): no server.js — require Next in-process against the
 *    workspace tree. Falls back to dev mode when there's no `.next/` yet.
 */
export async function startNext(webDir: string): Promise<NextHandle> {
  const standaloneServer = path.join(webDir, 'server.js');
  if (fs.existsSync(standaloneServer)) {
    return startForked(webDir, standaloneServer);
  }
  return startInProcessDev(webDir);
}

async function startForked(webDir: string, serverJs: string): Promise<NextHandle> {
  const port = await pickFreePort();
  const child = childProcess.spawn(process.execPath, [serverJs], {
    cwd: webDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      // Electron detects this and runs as plain Node. Without it the child
      // would try to boot another Chromium window.
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: 'inherit',
  });

  let stopped = false;
  child.on('exit', (code, signal) => {
    if (!stopped) {
      console.error(
        `[notomorrow] Next child exited unexpectedly (code=${code}, signal=${signal})`,
      );
    }
  });

  await waitForListening(port, 30_000);

  const stop = async () => {
    stopped = true;
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
        resolve();
      }, 3_000);
      child.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
    });
  };

  return { url: `http://127.0.0.1:${port}`, stop };
}

async function pickFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      if (!addr || typeof addr === 'string') {
        s.close(() => reject(new Error('pickFreePort: no address')));
        return;
      }
      const { port } = addr;
      s.close(() => resolve(port));
    });
  });
}

async function waitForListening(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const sock = net.createConnection(port, '127.0.0.1');
        sock.once('connect', () => {
          sock.end();
          resolve();
        });
        sock.once('error', reject);
      });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw new Error(
    `[notomorrow] Next did not start listening on 127.0.0.1:${port} within ${timeoutMs}ms: ${lastErr}`,
  );
}

async function startInProcessDev(webDir: string): Promise<NextHandle> {
  // No standalone tree — resolve Next through the workspace's pnpm layout
  // and boot in-process. Used by `pnpm dev` in apps/desktop.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createRequire } = require('node:module') as typeof import('node:module');
  const webRequire = createRequire(path.join(webDir, 'package.json'));
  const nextFactory = webRequire('next') as (opts: {
    dev: boolean;
    dir: string;
    quiet?: boolean;
  }) => {
    prepare(): Promise<void>;
    getRequestHandler(): (
      req: http.IncomingMessage,
      res: http.ServerResponse,
      parsedUrl: ReturnType<typeof parse>,
    ) => Promise<void>;
    close?(): Promise<void>;
  };

  const hasProdBuild = fs.existsSync(path.join(webDir, '.next', 'BUILD_ID'));
  const dev = process.env.NODE_ENV !== 'production' || !hasProdBuild;
  // Tailwind/PostCSS resolve their configs relative to cwd, not Next's `dir`.
  process.chdir(webDir);
  const app = nextFactory({ dev, dir: webDir });
  await app.prepare();
  const handle = app.getRequestHandler();

  const { url, server } = await new Promise<{ url: string; server: http.Server }>(
    (resolve, reject) => {
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
        const addr = server.address() as net.AddressInfo | null;
        if (!addr) {
          reject(new Error('Next server failed to bind'));
          return;
        }
        resolve({ url: `http://127.0.0.1:${addr.port}`, server });
      });
    },
  );

  const stop = async () => {
    await new Promise<void>((r) => server.close(() => r()));
    if (app.close) await app.close();
  };

  return { url, stop };
}
