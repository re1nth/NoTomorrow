import * as path from 'node:path';
import { BrowserWindow, app } from 'electron';
import { ensureLocalUser } from './bootstrap';
import { runMigrations } from './migrate';
import { getMigrationsDir, getSqliteDbPath, getWebAppDir } from './paths';
import { startNext } from './server';
import { setupPomodoroTray } from './tray';

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

  const dbFile = getSqliteDbPath();
  process.env.SQLITE_DB_PATH = dbFile;

  console.log(`[notomorrow] sqlite db: ${dbFile}`);
  runMigrations(dbFile, getMigrationsDir());
  const localUser = ensureLocalUser(dbFile);
  console.log(`[notomorrow] local user: ${localUser.handle} (${localUser.id})`);

  const url = await startNext(getWebAppDir());
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

  setupPomodoroTray(() => BrowserWindow.getAllWindows()[0] ?? null);

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
