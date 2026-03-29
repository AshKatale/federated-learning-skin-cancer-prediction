/**
 * Preload Script
 * Exposes safe IPC methods to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Get application status
  getAppStatus: () => ipcRenderer.invoke('app-status'),

  // Start federated learning training
  startTraining: (type, config) => 
    ipcRenderer.invoke('start-fl-training', { type, config }),

  // Get training status by ID
  getTrainingStatus: (trainingId) => 
    ipcRenderer.invoke('get-training-status', trainingId),

  // Open developer tools
  openDevTools: () => 
    ipcRenderer.invoke('open-devtools'),

  // Environment info
  platform: process.platform,
  version: process.versions.electron
});
