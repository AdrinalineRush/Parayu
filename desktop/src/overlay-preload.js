const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('parayuOverlay', {
  onState: (cb) => ipcRenderer.on('overlay-state', (_e, state) => cb(state)),
  onStatus: (cb) => ipcRenderer.on('overlay-status', (_e, text) => cb(text)),
  onLevel: (cb) => ipcRenderer.on('overlay-level', (_e, level) => cb(level))
});
