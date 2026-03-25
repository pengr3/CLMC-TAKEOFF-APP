import { contextBridge, ipcRenderer } from 'electron'

const api = {
  openPdf: (): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('dialog:openPdf')
}

contextBridge.exposeInMainWorld('api', api)
