import { contextBridge, ipcRenderer } from 'electron';

// Renderer-facing bridge. Keep the surface small and typed; every entry
// corresponds to a specific ipcMain handler in the main process.
contextBridge.exposeInMainWorld('notomorrow', {
  ready: true,
  pomodoroBuzz: (opts?: { label?: string }): void => {
    ipcRenderer.send('pomodoro:buzz', opts ?? {});
  },
  pomodoroClear: (): void => {
    ipcRenderer.send('pomodoro:clear');
  },
});
