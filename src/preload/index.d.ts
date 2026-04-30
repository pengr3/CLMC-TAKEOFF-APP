type ReadProjectResult =
  | { kind: 'v2-zip'; projectJson: string; pdfBytes: Uint8Array; computedSha256: string }
  | { kind: 'v1-json'; text: string }
  | { kind: 'unknown'; reason: string }

interface ElectronAPI {
  openPdf: () => Promise<{ filePath: string; data: ArrayBuffer } | null>
  openProject: () => Promise<{ filePath: string; extension: string; fileName: string } | null>
  saveProjectDialog: (defaultPath?: string) => Promise<string | null>

  readProject: (filePath: string) => Promise<ReadProjectResult>
  writeProject: (filePath: string, json: string, pdfBytes: Uint8Array) => Promise<{ ok: true }>
  hashBuffer: (bytes: Uint8Array) => Promise<string>
  readPdfBytes: (pdfPath: string) => Promise<ArrayBuffer>

  onCloseRequest: (callback: () => void) => void
  offCloseRequest: (callback: () => void) => void
  confirmClose: () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
