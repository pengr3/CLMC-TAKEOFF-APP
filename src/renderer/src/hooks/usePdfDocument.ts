import { useCallback } from 'react'
import { pdfjsLib, PDFDocumentProxy } from '../lib/pdf-setup'
import { useViewerStore } from '../stores/viewerStore'

export function usePdfDocument() {
  const setFile = useViewerStore((s) => s.setFile)
  const setPdfDocument = useViewerStore((s) => s.setPdfDocument)
  const setPdfBytes = useViewerStore((s) => s.setPdfBytes)

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
      const doc = await pdfjsLib.getDocument({ data: u8 }).promise
      const fileName = filePath.split(/[\\/]/).pop() ?? 'Unknown'
      setPdfDocument(doc)
      setPdfBytes(u8)              // cache bytes for save (Phase 4.1)
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

  const openPdfDialog = useCallback(async (): Promise<PDFDocumentProxy | null> => {
    console.log('[PDF] openPdfDialog called')
    const result = await window.api.openPdf()
    console.log('[PDF] IPC result:', result ? `filePath=${result.filePath}, byteLength=${result.data?.byteLength}` : 'null (cancelled)')
    if (!result) return null
    return loadPdf(result.data, result.filePath)
  }, [loadPdf])

  return { loadPdf, loadPdfFromPath, loadPdfFromBytes, openPdfDialog }
}
