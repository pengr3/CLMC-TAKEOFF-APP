import { contextBridge, ipcRenderer, webFrame } from 'electron'

// Lock zoom from the renderer side — prevents layout/page zoom via webFrame.
// This complements disable-pinch (compositor) and setVisualZoomLevelLimits (visual zoom).
webFrame.setVisualZoomLevelLimits(1, 1)

const api = {
  openPdf: (): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('dialog:openPdf')
}

contextBridge.exposeInMainWorld('api', api)
