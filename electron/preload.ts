import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('operBoardApi', {
  readData: () => ipcRenderer.invoke('data:read'),
  writeData: (payload: unknown) => ipcRenderer.invoke('data:write', payload),
  dataPath: () => ipcRenderer.invoke('data:path')
});
