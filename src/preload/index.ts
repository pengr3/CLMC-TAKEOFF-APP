import { contextBridge, ipcRenderer, webFrame } from 'electron'

// Lock zoom from the renderer side — prevents layout/page zoom via webFrame.
// This complements disable-pinch (compositor) and setVisualZoomLevelLimits (visual zoom).
webFrame.setVisualZoomLevelLimits(1, 1)

const api = {
  openPdf: (): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('dialog:openPdf'),

  // Project persistence (Phase 4)
  openProject: (): Promise<{ filePath: string; extension: string; fileName: string } | null> =>
    ipcRenderer.invoke('dialog:openProject'),

  saveProjectDialog: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveProject', defaultPath),

  readProject: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('file:readProject', filePath),

  writeProject: (filePath: string, json: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke('file:writeProject', filePath, json),

  hashPdf: (pdfPath: string): Promise<string> => ipcRenderer.invoke('file:hashPdf', pdfPath),

  checkExists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:checkExists', filePath),

  readPdfBytes: (pdfPath: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('file:readPdfBytes', pdfPath),

  resolvePdfPath: (
    clmcPath: string,
    absolutePath: string,
    relativePath: string | null
  ): Promise<{ resolvedPath: string; source: 'absolute' | 'relative' } | null> =>
    ipcRenderer.invoke('file:resolvePdfPath', clmcPath, absolutePath, relativePath),

  // Path math in main (CONTEXT.md). Returns null on cross-drive (Pitfall 4).
  computeRelativePath: (clmcPath: string, pdfPath: string): Promise<string | null> =>
    ipcRenderer.invoke('file:computeRelativePath', clmcPath, pdfPath)
}

contextBridge.exposeInMainWorld('api', api)
