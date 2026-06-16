import * as path from 'node:path';
import { BrowserWindow, app } from 'electron';
import { ensureLocalUser } from './bootstrap';
import { runMigrations } from './migrate';
import { getMigrationsDir, getSqliteDbPath, getWebAppDir } from './paths';
import { startNext } from './server';

async function boot(): Promise<void> {
  // Pin the userData folder name so the packaged .app and the dev `electron .`
  // share a stable identity. Without this, dev runs use the package.json name
  // ("desktop") and the packaged app uses productName ("NoTomorrow").
  app.setName('NoTomorrow');

  // In packaged builds Electron leaves NODE_ENV unset — Next would default
  // to dev mode and try to run webpack. Force production for packaged runs.
  if (app.isPackaged && !process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  await app.whenReady();

  // Required env for apps/web's lib/db.ts runtime branch.
  process.env.NOTOMORROW_RUNTIME = 'desktop';
  const dbFile = getSqliteDbPath();
  process.env.SQLITE_DB_PATH = dbFile;

  // NextAuth requires these even in single-user desktop mode.
  process.env.NEXTAUTH_SECRET ??= 'desktop-local-secret-not-real';
  process.env.COACH_SERVICE_URL ??= 'http://127.0.0.1:9999';
  process.env.COACH_SERVICE_TOKEN ??= 'desktop-placeholder';
  process.env.DATABASE_URL ??= `sqlite://${dbFile}`;

  console.log(`[notomorrow] sqlite db: ${dbFile}`);
  runMigrations(dbFile, getMigrationsDir());
  const localUser = ensureLocalUser(dbFile);
  console.log(`[notomorrow] local user: ${localUser.handle} (${localUser.id})`);

  const url = await startNext(getWebAppDir());
  // NEXTAUTH_URL must match the actual bound origin or the callback redirect
  // bounces to ERR_CONNECTION_REFUSED. The port is random, so we set it after
  // startNext returns; next-auth reads this per-request so this is in time.
  process.env.NEXTAUTH_URL = url;
  console.log(`[notomorrow] next ready at ${url}`);

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'NoTomorrow',
    backgroundColor: '#0b0b0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadURL(url);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = new BrowserWindow({
        width: 1280,
        height: 860,
        title: 'NoTomorrow',
        backgroundColor: '#0b0b0f',
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      void w.loadURL(url);
    }
  });
}

boot().catch((err) => {
  console.error('[notomorrow] fatal boot error:', err);
  app.exit(1);
});
