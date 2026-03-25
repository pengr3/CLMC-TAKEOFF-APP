import { useCallback } from 'react'
import { pdfjsLib, PDFDocumentProxy } from '../lib/pdf-setup'
import { useViewerStore } from '../stores/viewerStore'

export function usePdfDocument() {
  const setFile = useViewerStore((s) => s.setFile)
  const setPdfDocument = useViewerStore((s) => s.setPdfDocument)

  const loadPdf = useCallback(
    async (data: ArrayBuffer, filePath: string) => {
      // Clean up previous document
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

  const openPdfDialog = useCallback(async () => {
    const result = await window.api.openPdf()
    if (!result) return null
    return loadPdf(result.data, result.filePath)
  }, [loadPdf])

  return { loadPdf, openPdfDialog }
}
