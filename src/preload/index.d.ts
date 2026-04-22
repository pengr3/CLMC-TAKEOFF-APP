interface ElectronAPI {
  openPdf: () => Promise<{ filePath: string; data: ArrayBuffer } | null>
  openProject: () => Promise<{ filePath: string; extension: string; fileName: string } | null>
  saveProjectDialog: (defaultPath?: string) => Promise<string | null>
  readProject: (filePath: string) => Promise<string>
  writeProject: (filePath: string, json: string) => Promise<{ ok: true }>
  hashPdf: (pdfPath: string) => Promise<string>
  checkExists: (filePath: string) => Promise<boolean>
  readPdfBytes: (pdfPath: string) => Promise<ArrayBuffer>
  resolvePdfPath: (
    clmcPath: string,
    absolutePath: string,
    relativePath: string | null
  ) => Promise<{ resolvedPath: string; source: 'absolute' | 'relative' } | null>
  computeRelativePath: (clmcPath: string, pdfPath: string) => Promise<string | null>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
