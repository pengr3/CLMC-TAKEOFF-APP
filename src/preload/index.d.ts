interface ElectronAPI {
  openPdf: () => Promise<{ filePath: string; data: ArrayBuffer } | null>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
