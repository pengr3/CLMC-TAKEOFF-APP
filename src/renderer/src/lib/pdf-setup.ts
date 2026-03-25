import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

// ?url gives Vite's resolved URL for the worker — avoids CJS/ESM mismatch
console.log('[PDF] workerSrc resolved to:', workerSrc)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export { pdfjsLib }
export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
