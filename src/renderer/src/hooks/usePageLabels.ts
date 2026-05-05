import { useEffect, useState } from 'react'
import { useViewerStore } from '../stores/viewerStore'

/**
 * usePageLabels — one-shot async fetch of `pdfDocument.getPageLabels()` per
 * document instance.
 *
 * Construction PDFs commonly carry labels like `"A1.01"`, `"S-101"`, `"M2.3"`
 * rather than sequential numbers. PDF.js exposes them via `getPageLabels()`,
 * which returns `Promise<string[] | null>` (null when the document has no
 * labels — callers should fall back to a `Page N` rendering).
 *
 * Lifecycle:
 * - Returns `null` while no document is loaded.
 * - On document change, kicks off `getPageLabels()` and stores the resolved
 *   array (or null) when it lands.
 * - Uses a local `cancelled` flag so an in-flight fetch from a previous
 *   document never overwrites state for the current document.
 *
 * Consumers (Phase 6 Wave 4 thumbnails, Wave 5 CanvasHeaderBar) pick the
 * label at index `currentPage - 1` and gate on `labels && labels[i]`.
 */
export function usePageLabels(): string[] | null {
  const pdfDocument = useViewerStore((s) => s.pdfDocument)
  const [labels, setLabels] = useState<string[] | null>(null)

  useEffect(() => {
    if (!pdfDocument) {
      setLabels(null)
      return
    }
    let cancelled = false
    pdfDocument.getPageLabels().then((l) => {
      if (!cancelled) setLabels(l)
    })
    return () => {
      cancelled = true
    }
  }, [pdfDocument])

  return labels
}
