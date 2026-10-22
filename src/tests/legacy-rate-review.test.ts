/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useExport } from '@renderer/hooks/useExport'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { hydrateStores, snapshotProject } from '@renderer/lib/project-serialize'

beforeEach(() => {
  useProjectStore.getState().reset(); useScaleStore.getState().reset()
  Object.assign(window, { api: { saveExportDialog: vi.fn().mockResolvedValue(null) } })
})
function unresolved() {
  useProjectStore.setState({ rates: { 'Pipe|linear': { material: 5, labor: 7, markup: 30, basis: 'm', review: 'legacy-unresolved' } } })
}
describe('legacy rate review guards', () => {
  it('blocks unit changes while unresolved and requests review without mutation', () => {
    unresolved()
    const review = vi.fn(); window.addEventListener('clmc:review-rates', review)
    useScaleStore.getState().setGlobalUnit('ft')
    expect(useScaleStore.getState().globalUnit).toBe('m')
    expect(review).toHaveBeenCalledTimes(1)
    window.removeEventListener('clmc:review-rates', review)
  })
  it('does not block restoration or calibration while unresolved', () => {
    unresolved()
    useScaleStore.getState().hydrate({ globalUnit: 'ft', pageScales: {} })
    useScaleStore.getState().setScale(1, 2, 'ft')
    expect(useScaleStore.getState().globalUnit).toBe('ft')
    expect(useScaleStore.getState().getScale(1)?.pixelsPerMm).toBe(2)
  })
  it('guards both normal and confirmed export before any picker or write', async () => {
    unresolved()
    const el = document.createElement('div'); document.body.append(el)
    const root = createRoot(el)
    let actions!: ReturnType<typeof useExport>
    function Host() { actions = useExport(); return null }
    await act(async () => root.render(React.createElement(Host)))
    expect(await actions.exportBoq()).toMatchObject({ kind: 'canceled' })
    useProjectStore.setState({ isExporting: true })
    expect(await actions.applyExportAfterConfirm(aggregateBoq())).toMatchObject({ kind: 'canceled' })
    expect(window.api.saveExportDialog).not.toHaveBeenCalled()
    expect(useProjectStore.getState().isExporting).toBe(false)
    act(() => root.unmount()); el.remove()
  })
  it('keeps guards active after partial acknowledgement and persists review only through a saved snapshot', () => {
    unresolved()
    useProjectStore.setState({ rates: { ...useProjectStore.getState().rates, 'Other|linear': { material: 1, labor: 2, markup: 0, basis: 'm', review: 'legacy-unresolved' } } })
    const params = { pdfOriginalFilename: 'test.pdf', pdfSha256: 'a'.repeat(64), pdfTotalPages: 1, perPageDimensions: { 1: { width: 100, height: 100 } } }
    const prior = snapshotProject(params)
    useProjectStore.getState().acknowledgeRateBasis(['Pipe|linear'])
    expect(useProjectStore.getState().isDirty).toBe(true)
    useScaleStore.getState().setGlobalUnit('ft')
    expect(useScaleStore.getState().globalUnit).toBe('m')
    expect(useProjectStore.getState().getUnresolvedRateKeys()).toEqual(['Other|linear'])
    hydrateStores(prior)
    expect(useProjectStore.getState().getUnresolvedRateKeys()).toHaveLength(2)
    useProjectStore.getState().acknowledgeRateBasis(['Pipe|linear', 'Other|linear'])
    hydrateStores(snapshotProject(params))
    expect(useProjectStore.getState().getUnresolvedRateKeys()).toEqual([])
    useScaleStore.getState().setGlobalUnit('ft')
    expect(useScaleStore.getState().globalUnit).toBe('ft')
  })
})
