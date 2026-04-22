import { useCallback } from 'react'
import { pdfjsLib, PDFDocumentProxy } from '../lib/pdf-setup'
import { useViewerStore } from '../stores/viewerStore'

export function usePdfDocument() {
  const setFile = useViewerStore((s) => s.setFile)
  const setPdfDocument = useViewerStore((s) => s.setPdfDocument)

  const loadPdf = useCallback(
    async (data: ArrayBuffer, filePath: string): Promise<PDFDocumentProxy> => {
      console.log('[PDF] loadPdf called, data byteLength:', data?.byteLength, 'filePath:', filePath)
      const prevDoc = useViewerStore.getState().pdfDocument as PDFDocumentProxy | null
      if (prevDoc) {
        await prevDoc.destroy()
      }
      const doc = await pdfjsLib.getDocument({ data }).promise
      const fileName = filePath.split(/[\\/]/).pop() ?? 'Unknown'
      setPdfDocument(doc)
      setFile(filePath, fileName, doc.numPages)
      return doc
    },
    [setFile, setPdfDocument]
  )

  const loadPdfFromPath = useCallback(
    async (pdfPath: string): Promise<PDFDocumentProxy> => {
      const data = await window.api.readPdfBytes(pdfPath)
      return loadPdf(data, pdfPath)
    },
    [loadPdf]
  )

  const openPdfDialog = useCallback(async (): Promise<PDFDocumentProxy | null> => {
    console.log('[PDF] openPdfDialog called')
    const result = await window.api.openPdf()
    console.log('[PDF] IPC result:', result ? `filePath=${result.filePath}, data byteLength=${result.data?.byteLength}` : 'null (cancelled)')
    if (!result) return null
    return loadPdf(result.data, result.filePath)
  }, [loadPdf])

  return { loadPdf, loadPdfFromPath, openPdfDialog }
}
