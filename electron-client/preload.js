const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getCredentials:   ()      => ipcRenderer.invoke('credentials:load'),
  setCredentials:   (creds) => ipcRenderer.invoke('credentials:save', creds),
  clearCredentials: ()      => ipcRenderer.invoke('credentials:clear'),
})
