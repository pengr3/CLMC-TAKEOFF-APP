import { useCallback } from 'react'
import { aggregateBoq, findUncalibratedMarkupPages } from '../lib/boq-aggregator'
import type { BoqStructure, ExportResult } from '../lib/boq-types'
import { useProjectStore } from '../stores/projectStore'
import { useViewerStore } from '../stores/viewerStore'

function basenameAny(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(i + 1) : p
}

function dirnameAny(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : ''
}

function stripExt(s: string): string {
  const i = s.lastIndexOf('.')
  return i > 0 ? s.slice(0, i) : s
}

function deriveDefaultExportPath(
  currentFilePath: string | null,
  pdfOriginalFilename: string,
  format: 'xlsx' | 'csv'
): string {
  const projectBase = currentFilePath
    ? stripExt(basenameAny(currentFilePath))
    : stripExt(pdfOriginalFilename || 'plan')
  const dir = currentFilePath ? dirnameAny(currentFilePath) : ''
  const filename = `${projectBase}-BOQ.${format}`
  return dir ? `${dir}/${filename}` : filename
}

interface UseExportApi {
  exportBoq: () => Promise<ExportResult>
  applyExportAfterConfirm: (structure: BoqStructure) => Promise<ExportResult>
}

export function useExport(): UseExportApi {
  async function dialogAndWrite(structure: BoqStructure): Promise<ExportResult> {
    const setExporting = useProjectStore.getState().setExporting
    setExporting(true)
    try {
      const { currentFilePath } = useProjectStore.getState()
      const { fileName: pdfName } = useViewerStore.getState()
      const defaultPath = deriveDefaultExportPath(
        currentFilePath,
        pdfName ?? 'plan.pdf',
        'xlsx'
      )
      const chosen = await window.api.saveExportDialog(defaultPath, 'xlsx')
      if (!chosen) return { kind: 'canceled' }

      const writeResult =
        chosen.format === 'csv'
          ? await window.api.writeBoqCsv(chosen.filePath, structure)
          : await window.api.writeBoqXlsx(chosen.filePath, structure)

      if (!writeResult.ok) {
        return { kind: 'error', message: writeResult.reason }
      }
      return { kind: 'ok', filePath: chosen.filePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { kind: 'error', message }
    } finally {
      setExporting(false)
    }
  }

  const exportBoq = useCallback(async (): Promise<ExportResult> => {
    const { isExporting, isSaving } = useProjectStore.getState()
    if (isExporting || isSaving) return { kind: 'canceled' }

    const structure = aggregateBoq()
    const uncalibrated = findUncalibratedMarkupPages()
    if (uncalibrated.length > 0) {
      return {
        kind: 'needs-uncalibrated-confirmation',
        uncalibratedPages: uncalibrated,
        structure
      }
    }

    return dialogAndWrite(structure)
  }, [])

  const applyExportAfterConfirm = useCallback(
    async (structure: BoqStructure): Promise<ExportResult> => {
      const { isExporting, isSaving } = useProjectStore.getState()
      if (isExporting || isSaving) return { kind: 'canceled' }
      return dialogAndWrite(structure)
    },
    []
  )

  return { exportBoq, applyExportAfterConfirm }
}
