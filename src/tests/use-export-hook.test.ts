/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))

const mockSaveExportDialog = vi.fn()
const mockWriteBoqXlsx = vi.fn()
const mockWriteBoqCsv = vi.fn()

beforeEach(() => {
  ;(globalThis as unknown as { window: { api: Record<string, unknown> } }).window = {
    api: {
      saveExportDialog: mockSaveExportDialog,
      writeBoqXlsx: mockWriteBoqXlsx,
      writeBoqCsv: mockWriteBoqCsv
    }
  }
  mockSaveExportDialog.mockReset()
  mockWriteBoqXlsx.mockReset()
  mockWriteBoqCsv.mockReset()
})

import { useExport } from '@renderer/hooks/useExport'
import type { ExportResult } from '@renderer/lib/boq-types'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'

async function callExport(): Promise<ExportResult> {
  let captured: ExportResult = { kind: 'canceled' }
  let container: HTMLDivElement | null = null
  let root: Root | null = null
  function TC() {
    const { exportBoq } = useExport()
    React.useEffect(() => { exportBoq().then((r) => { captured = r }) }, [])
    return null
  }
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(React.createElement(TC))
    await new Promise<void>((res) => setTimeout(res, 50))
  })
  if (root) act(() => (root as Root).unmount())
  if (container) (container as HTMLDivElement).remove()
  return captured
}

describe('useExport — D-06 / D-21 / D-24 / EXPRT-01', () => {
  beforeEach(() => {
    useViewerStore.setState({
      totalPages: 1, currentPage: 1, filePath: 'C:/x.pdf', fileName: 'x.pdf',
      pageViewports: {}, pageScales: {}, pdfDocument: null, activeTool: 'select'
    })
    useProjectStore.getState().reset()
    useMarkupStore.getState().reset()
    useScaleStore.getState().reset()
    useMarkupStore.setState({
      pageMarkups: {
        1: [
          { id: 'c1', type: 'count', page: 1, name: 'Outlet', categoryId: 'cat-e',
            color: '#0078d4', createdAt: 0, point: { x: 0, y: 0 }, sequence: 1 },
          { id: 'l1', type: 'linear', page: 1, name: 'Wire', categoryId: 'cat-e',
            color: '#0078d4', createdAt: 0, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }] }
        ]
      },
      categories: { 'cat-e': { id: 'cat-e', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
      categoryOrder: ['cat-e']
    })
  })

  it('returns needs-uncalibrated-confirmation when a page has linear markup but no scale — D-06', async () => {
    const r = await callExport()
    expect(r.kind).toBe('needs-uncalibrated-confirmation')
    if (r.kind === 'needs-uncalibrated-confirmation') {
      expect(r.uncalibratedPages).toEqual([1])
    }
  })

  it('returns canceled when user cancels the save dialog (calibrated path)', async () => {
    useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } } })
    mockSaveExportDialog.mockResolvedValueOnce(null)
    const r = await callExport()
    expect(r.kind).toBe('canceled')
  })

  it('returns ok with filePath when xlsx write succeeds — D-20', async () => {
    useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } } })
    mockSaveExportDialog.mockResolvedValueOnce({ filePath: 'C:/x-BOQ.xlsx', format: 'xlsx' })
    mockWriteBoqXlsx.mockResolvedValueOnce({ ok: true })
    const r = await callExport()
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') expect(r.filePath).toBe('C:/x-BOQ.xlsx')
    expect(useProjectStore.getState().isExporting).toBe(false)
  })

  it('returns error with reason when csv write fails — D-21', async () => {
    useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } } })
    mockSaveExportDialog.mockResolvedValueOnce({ filePath: 'C:/x-BOQ.csv', format: 'csv' })
    mockWriteBoqCsv.mockResolvedValueOnce({ ok: false, reason: 'EBUSY: file is locked' })
    const r = await callExport()
    expect(r.kind).toBe('error')
    if (r.kind === 'error') expect(r.message).toContain('EBUSY')
    expect(useProjectStore.getState().isExporting).toBe(false)
  })

  it('returns canceled and does not call IPC when isExporting is already true — D-19 race guard', async () => {
    useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } } })
    useProjectStore.setState({ isExporting: true })
    const r = await callExport()
    expect(r.kind).toBe('canceled')
    expect(mockSaveExportDialog).not.toHaveBeenCalled()
  })

  it('holds isExporting=true across the needs-uncalibrated-confirmation modal window (BL-02 race fix)', async () => {
    // Page 1 has linear markup but no scale → uncalibrated → confirmation kind.
    // After exportBoq returns this kind, isExporting MUST stay true so a second
    // Ctrl+Shift+E press hits the race guard and bails.
    const r = await callExport()
    expect(r.kind).toBe('needs-uncalibrated-confirmation')
    expect(useProjectStore.getState().isExporting).toBe(true)
  })
})
