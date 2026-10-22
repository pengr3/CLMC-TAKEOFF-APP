/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useExport } from '@renderer/hooks/useExport'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { hydrateStores, snapshotProject } from '@renderer/lib/project-serialize'
import { LegacyRateReviewDialog, LEGACY_RATE_WARNING } from '@renderer/components/LegacyRateReviewDialog'

beforeEach(() => {
  useProjectStore.getState().reset(); useScaleStore.getState().reset()
  Object.assign(window, { api: { saveExportDialog: vi.fn().mockResolvedValue(null) } })
})

describe('legacy review dialog', () => {
  it.each([0, 1, 100])('lists every affected item for %s entries and requires explicit checkbox acknowledgement', async (count) => {
    const rates = Object.fromEntries(Array.from({ length: count }, (_, i) => [`${'Long item name '.repeat(10)}${i}|linear`, { material: 123456789.12, labor: 45.67, markup: 30, basis: 'ft' as const, review: 'legacy-unresolved' as const }]))
    useProjectStore.setState({ rates })
    const host = document.createElement('div'); document.body.append(host)
    const root = createRoot(host), close = vi.fn()
    await act(async () => root.render(React.createElement(LegacyRateReviewDialog, { onClose: close })))
    if (count === 0) expect(document.querySelector('[role="dialog"]')).toBeNull()
    else {
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement
      expect(dialog.textContent).toContain(LEGACY_RATE_WARNING)
      expect(dialog.querySelectorAll('tbody tr')).toHaveLength(count)
      expect(dialog.textContent).toContain('ft')
      const buttons = Array.from(dialog.querySelectorAll('button'))
      const confirm = buttons.find(b => b.textContent === 'Confirm Rate Units')!
      expect(confirm.disabled).toBe(true)
      act(() => confirm.click())
      expect(useProjectStore.getState().getUnresolvedRateKeys()).toHaveLength(count)
      const checkbox = dialog.querySelector('input')!
      act(() => checkbox.click())
      expect(confirm.disabled).toBe(false)
      act(() => useProjectStore.getState().setSaving(true))
      expect(confirm.disabled).toBe(true)
      act(() => confirm.click())
      expect(close).not.toHaveBeenCalled()
      act(() => useProjectStore.getState().setSaving(false))
      act(() => confirm.click())
      expect(useProjectStore.getState().getUnresolvedRateKeys()).toEqual([])
      expect(close).toHaveBeenCalledTimes(1)
    }
    act(() => root.unmount()); host.remove()
  })
  it('contains keyboard shortcuts, Escape cancels and restores focus without acknowledgement', async () => {
    unresolved()
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
    const host = document.createElement('div'); document.body.append(host)
    const root = createRoot(host), close = vi.fn(), globalKey = vi.fn()
    window.addEventListener('keydown', globalKey)
    await act(async () => root.render(React.createElement(LegacyRateReviewDialog, { onClose: close })))
    const cancel = document.querySelector('[data-initial-focus]') as HTMLButtonElement
    expect(document.activeElement).toBe(cancel)
    act(() => cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(close).toHaveBeenCalledTimes(1)
    expect(globalKey).not.toHaveBeenCalled()
    expect(useProjectStore.getState().getUnresolvedRateKeys()).toHaveLength(1)
    act(() => root.unmount())
    expect(document.activeElement).toBe(trigger)
    window.removeEventListener('keydown', globalKey); host.remove(); trigger.remove()
  })
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
