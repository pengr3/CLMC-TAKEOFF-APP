import { useCallback } from 'react'
import { pdfjsLib, PDFDocumentProxy } from '../lib/pdf-setup'
import { useViewerStore } from '../stores/viewerStore'

export function usePdfDocument() {
  const setFile = useViewerStore((s) => s.setFile)
  const setPdfDocument = useViewerStore((s) => s.setPdfDocument)

  const loadPdf = useCallback(
    async (data: ArrayBuffer, filePath: string) => {
      console.log('[PDF] loadPdf called, data byteLength:', data?.byteLength, 'filePath:', filePath)
      // Clean up previous document
      const prevDoc = useViewerStore.getState().pdfDocument as PDFDocumentProxy | null
      if (prevDoc) {
        await prevDoc.destroy()
      }

      try {
        console.log('[PDF] calling pdfjsLib.getDocument...')
        const doc = await pdfjsLib.getDocument({ data }).promise
        console.log('[PDF] document loaded, numPages:', doc.numPages)
        const fileName = filePath.split(/[\\/]/).pop() ?? 'Unknown'
        setPdfDocument(doc)
        setFile(filePath, fileName, doc.numPages)
        return doc
      } catch (err) {
        console.error('[PDF] getDocument failed:', err)
        throw err
      }
    },
    [setFile, setPdfDocument]
  )

  const openPdfDialog = useCallback(async () => {
    console.log('[PDF] openPdfDialog called')
    const result = await window.api.openPdf()
    console.log('[PDF] IPC result:', result ? `filePath=${result.filePath}, data byteLength=${result.data?.byteLength}` : 'null (cancelled)')
    if (!result) return null
    return loadPdf(result.data, result.filePath)
  }, [loadPdf])

  return { loadPdf, openPdfDialog }
}
