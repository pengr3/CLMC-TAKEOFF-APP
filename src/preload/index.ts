import { contextBridge, ipcRenderer, webFrame } from 'electron'

webFrame.setVisualZoomLevelLimits(1, 1)

const closeRequestListeners = new WeakMap<() => void, (...args: unknown[]) => void>()

// Wire type for file:readProject return — must match ipc-handlers.ts ReadProjectResult.
type ReadProjectResult =
  | { kind: 'v2-zip'; projectJson: string; pdfBytes: Uint8Array; computedSha256: string }
  | { kind: 'v1-json'; text: string }
  | { kind: 'unknown'; reason: string }

const api = {
  openPdf: (): Promise<{ filePath: string; data: ArrayBuffer } | null> =>
    ipcRenderer.invoke('dialog:openPdf'),

  openProject: (): Promise<{ filePath: string; extension: string; fileName: string } | null> =>
    ipcRenderer.invoke('dialog:openProject'),

  saveProjectDialog: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveProject', defaultPath),

  // v2 read: returns discriminated union with computedSha256 in v2-zip kind.
  readProject: (filePath: string): Promise<ReadProjectResult> =>
    ipcRenderer.invoke('file:readProject', filePath),

  // v2 write: caller supplies project JSON text + raw PDF bytes; main assembles ZIP atomically.
  writeProject: (
    filePath: string,
    json: string,
    pdfBytes: Uint8Array
  ): Promise<{ ok: true }> =>
    ipcRenderer.invoke('file:writeProject', filePath, json, pdfBytes),

  // SHA256 a buffer in main; used by save flow to populate project.json.pdf.sha256
  // (replaces SubtleCrypto in renderer per review feedback).
  hashBuffer: (bytes: Uint8Array): Promise<string> =>
    ipcRenderer.invoke('file:hashBuffer', bytes),

  // Read PDF bytes from a known path (used for v1 silent migration in Wave 4).
  readPdfBytes: (pdfPath: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('file:readPdfBytes', pdfPath),

  // Close guard (D-16) — fire-and-forget IPC pair.
  onCloseRequest: (cb: () => void): void => {
    const wrapped = (): void => cb()
    closeRequestListeners.set(cb, wrapped)
    ipcRenderer.on('app:close-request', wrapped)
  },
  offCloseRequest: (cb: () => void): void => {
    const wrapped = closeRequestListeners.get(cb)
    if (wrapped) {
      ipcRenderer.removeListener('app:close-request', wrapped)
      closeRequestListeners.delete(cb)
    }
  },
  confirmClose: (): void => {
    ipcRenderer.send('app:confirm-close')
  }
}

contextBridge.exposeInMainWorld('api', api)
