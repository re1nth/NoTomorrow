import { Menu, Notification, Tray, ipcMain, nativeImage } from 'electron';
import type { BrowserWindow } from 'electron';

let tray: Tray | null = null;
let flashInterval: NodeJS.Timeout | null = null;
let flashTimeout: NodeJS.Timeout | null = null;

const IDLE_TITLE = '⏱';

function clearFlash(): void {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  if (flashTimeout) {
    clearTimeout(flashTimeout);
    flashTimeout = null;
  }
  tray?.setTitle(IDLE_TITLE);
}

function startFlash(label: string): void {
  if (!tray) return;
  clearFlash();
  // Alternate between two glyphs so the status bar visibly buzzes until
  // the user clicks the tray icon or dismisses the timer in the app.
  const frames = [`🔔 ${label}`, `⏰ ${label}`];
  let i = 0;
  tray.setTitle(frames[0] ?? '');
  flashInterval = setInterval(() => {
    i = (i + 1) % frames.length;
    tray?.setTitle(frames[i] ?? '');
  }, 600);
  // Safety cap — never flash forever.
  flashTimeout = setTimeout(() => clearFlash(), 5 * 60_000);
}

/**
 * Attach a menu-bar Tray icon and IPC handlers so the renderer can signal
 * timer-ended (`pomodoro:buzz`) or clear the alert (`pomodoro:clear`).
 *
 * Uses an empty nativeImage — macOS only needs the icon slot occupied to
 * render the tray; `setTitle` provides the visible feedback without needing
 * a bundled asset. On Windows/Linux the empty image renders as a blank
 * space, which is fine for the Electron-desktop-macOS target.
 */
export function setupPomodoroTray(getWindow: () => BrowserWindow | null): void {
  if (tray) return;
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('NoTomorrow');
  tray.setTitle(IDLE_TITLE);

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show NoTomorrow',
      click: () => {
        const w = getWindow();
        if (w) {
          if (w.isMinimized()) w.restore();
          w.show();
          w.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Dismiss buzz',
      click: () => clearFlash(),
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    // Clicking the tray title dismisses the buzz *and* raises the window.
    clearFlash();
    const w = getWindow();
    if (w) {
      w.show();
      w.focus();
    }
  });

  ipcMain.on('pomodoro:buzz', (_e, payload?: { label?: string }) => {
    const label = payload?.label ?? 'Pomodoro';
    startFlash(label);
    try {
      new Notification({
        title: 'Pomodoro finished',
        body: 'Time is up — take a breather.',
      }).show();
    } catch {
      /* ignore — notifications may be disabled */
    }
  });

  ipcMain.on('pomodoro:clear', () => clearFlash());
}
