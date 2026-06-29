const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getCredentials:   ()      => ipcRenderer.invoke('credentials:get'),
  setCredentials:   (creds) => ipcRenderer.invoke('credentials:set', creds),
  clearCredentials: ()      => ipcRenderer.invoke('credentials:clear'),
})
