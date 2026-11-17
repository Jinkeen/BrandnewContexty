const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('contextyCapture', {
  onSource(callback) { ipcRenderer.on('capture:source', (_event, source) => callback(source)); },
  save(data) { return ipcRenderer.invoke('capture:save', data); },
  cancel() { ipcRenderer.send('capture:cancel'); }
});
