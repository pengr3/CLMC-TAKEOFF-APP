import { useCallback } from 'react'
import { pdfjsLib, PDFDocumentProxy, cloneForPdfWorker } from '../lib/pdf-setup'
import { useViewerStore } from '../stores/viewerStore'
import { pdfDecoderOptions } from '../lib/pdf-decoder-options'

interface PdfDocumentActions {
  loadPdf: (bytes: ArrayBuffer | Uint8Array, path: string) => Promise<PDFDocumentProxy>
  loadPdfFromPath: (path: string) => Promise<PDFDocumentProxy>
  loadPdfFromBytes: (bytes: Uint8Array, name: string) => Promise<PDFDocumentProxy>
  stagePdfFromBytes: (bytes: Uint8Array) => Promise<PDFDocumentProxy>
  adoptStagedPdf: (doc: PDFDocumentProxy, bytes: Uint8Array, name: string) => void
}
export function usePdfDocument(): PdfDocumentActions {
  const setFile = useViewerStore((s) => s.setFile)
  const setPdfDocument = useViewerStore((s) => s.setPdfDocument)
  const setPdfBytes = useViewerStore((s) => s.setPdfBytes)

  // Decode without changing or destroying the active document. Recovery commits only
  // after metadata, checksum and PDF loading have all succeeded.
  const stagePdfFromBytes = useCallback(async (bytes: Uint8Array): Promise<PDFDocumentProxy> => {
    return pdfjsLib.getDocument({ data: cloneForPdfWorker(bytes), ...pdfDecoderOptions() }).promise
  }, [])
  const adoptStagedPdf = useCallback(
    (doc: PDFDocumentProxy, bytes: Uint8Array, name: string): void => {
      const previous = useViewerStore.getState().pdfDocument as PDFDocumentProxy | null
      // Hydration already restored the page and applied the existing auto-fit policy. Do not call setFile,
      // which intentionally resets those fields for an ordinary PDF open.
      useViewerStore.setState({
        pdfDocument: doc,
        pdfBytes: bytes,
        filePath: name,
        fileName: name,
        totalPages: doc.numPages,
        selectedMarkupIds: [],
        vertexEditMarkupId: null
      })
      if (previous && previous !== doc) void previous.destroy().catch(() => {})
    },
    []
  )

  /**
   * Internal: load PDF.js document from raw bytes; cache bytes in viewerStore
   * so the save flow doesn't re-read from disk (RESEARCH §10.9).
   * Accepts either ArrayBuffer (from existing IPC paths) or Uint8Array (Phase 4.1).
   */
  const loadPdf = useCallback(
    async (data: ArrayBuffer | Uint8Array, filePath: string): Promise<PDFDocumentProxy> => {
      const byteLen = data instanceof Uint8Array ? data.byteLength : data.byteLength
      console.log('[PDF] loadPdf called, byteLength:', byteLen, 'filePath:', filePath)
      const prevDoc = useViewerStore.getState().pdfDocument as PDFDocumentProxy | null
      if (prevDoc) {
        await prevDoc.destroy()
      }
      const u8: Uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data)
      // pdfjsLib.getDocument({ data }) transfers the underlying ArrayBuffer to its
      // worker — after this call the original `u8` is detached (byteLength=0) and
      // any structured-clone (e.g. ipcRenderer.invoke for save) will throw "An
      // object could not be cloned". Pass a throwaway copy so `u8` stays intact
      // for setPdfBytes → save flow.
      const doc = await pdfjsLib.getDocument({
        data: cloneForPdfWorker(u8),
        ...pdfDecoderOptions()
      }).promise
      const fileName = filePath.split(/[\\/]/).pop() ?? 'Unknown'
      setPdfDocument(doc)
      setPdfBytes(u8) // cache bytes for save (Phase 4.1)
      setFile(filePath, fileName, doc.numPages)
      return doc
    },
    [setFile, setPdfDocument, setPdfBytes]
  )

  const loadPdfFromPath = useCallback(
    async (pdfPath: string): Promise<PDFDocumentProxy> => {
      const data = await window.api.readPdfBytes(pdfPath)
      return loadPdf(data, pdfPath)
    },
    [loadPdf]
  )

  /**
   * Phase 4.1: load PDF directly from in-memory bytes (no disk path).
   * Used by v2 open flow (bytes from extractClmcZip) and Replace Plan PDF.
   * displayName is used as fileName in viewerStore — Wave 5's Save As default-path
   * logic derives the .clmc filename from this.
   */
  const loadPdfFromBytes = useCallback(
    async (bytes: Uint8Array, displayName: string): Promise<PDFDocumentProxy> => {
      return loadPdf(bytes, displayName)
    },
    [loadPdf]
  )

  return { loadPdf, loadPdfFromPath, loadPdfFromBytes, stagePdfFromBytes, adoptStagedPdf }
}
