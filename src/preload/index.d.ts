type ReadProjectResult =
  | { kind: 'v2-zip'; projectJson: string; pdfBytes: Uint8Array; computedSha256: string }
  | { kind: 'v1-json'; text: string }
  | { kind: 'unknown'; reason: string }

type BoqRowType = 'count' | 'linear' | 'area' | 'perimeter-length' | 'perimeter-area'
interface BoqMetadata {
  projectName: string
  planFilename: string
  exportedDate: string
  totalPages: number
  totalMarkups: number
}
interface BoqItemRow {
  label: string
  quantity: number
  uom: string
  color: string | null
  type: BoqRowType
}
interface BoqSubtotal { uom: string; total: number }
interface BoqCategoryGroup {
  name: string
  items: BoqItemRow[]
  subtotals: BoqSubtotal[]
}
interface BoqStructure {
  metadata: BoqMetadata
  categories: BoqCategoryGroup[]
  grandTotals: BoqSubtotal[]
}

interface ElectronAPI {
  openPdf: () => Promise<{ filePath: string; data: ArrayBuffer } | null>
  openProject: () => Promise<{ filePath: string; extension: string; fileName: string } | null>
  saveProjectDialog: (defaultPath?: string) => Promise<string | null>

  readProject: (filePath: string) => Promise<ReadProjectResult>
  writeProject: (filePath: string, json: string, pdfBytes: Uint8Array) => Promise<{ ok: true }>
  hashBuffer: (bytes: Uint8Array) => Promise<string>

  saveExportDialog: (defaultPath: string, format: 'xlsx' | 'csv') => Promise<{ filePath: string; format: 'xlsx' | 'csv' } | null>
  writeBoqXlsx: (filePath: string, structure: BoqStructure) => Promise<{ ok: true } | { ok: false; reason: string }>
  writeBoqCsv: (filePath: string, structure: BoqStructure) => Promise<{ ok: true } | { ok: false; reason: string }>

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
