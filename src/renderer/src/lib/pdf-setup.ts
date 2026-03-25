import * as pdfjsLib from 'pdfjs-dist'

// Use PDF.js fake worker (runs in main thread) to avoid Uint8Array.toHex
// missing in Electron's Web Worker context (Chrome 129+ Web Platform API).
// Performance impact is negligible for construction PDF sizes.
pdfjsLib.GlobalWorkerOptions.workerSrc = ''
console.log('[PDF] running in fake-worker mode (main thread)')

export { pdfjsLib }
export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
