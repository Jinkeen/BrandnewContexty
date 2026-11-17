const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('contextyDesktop', {
  onCapture(callback) {
    ipcRenderer.on('contexty:capture', (_event, capture) => callback(capture));
    ipcRenderer.send('capture:ready');
  },
  startCapture() { ipcRenderer.send('capture:start'); }
});
