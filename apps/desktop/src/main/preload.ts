import { contextBridge } from 'electron';

// Phase A surface — empty contract. Future phases will expose Settings IPC
// (keytar-backed API key write) and an event subscription for in-process job
// notifications.
contextBridge.exposeInMainWorld('notomorrow', {
  ready: true,
});
