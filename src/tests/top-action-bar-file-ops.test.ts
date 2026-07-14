/** @vitest-environment jsdom */
/**
 * RED (Phase 18 Wave 0) — TopActionBar file-ops left group + disabled derivations
 * (SC-5).
 *
 * FAILS today because `@renderer/components/TopActionBar` does not exist yet — the
 * import cannot be resolved. It turns GREEN when plan 18-05 lands the TopActionBar
 * that re-homes RibbonToolbar's Home-tab file ops VERBATIM (D-08 behavior parity).
 *
 * This file MIGRATES coverage from four tests deleted in this plan's Task 3:
 *   - toolbar-open-prop.test.ts        → Open aria-label + onOpenClick firing
 *   - toolbar-saving-disabled.test.ts  → Save/Save As/Replace disabled while isSaving
 *   - toolbar-export-button.test.ts    → Export disabled derivation + prop firing
 *   - toolbar-replace-pdf.test.ts      → Replace prop firing
 *
 * Contract pinned here (18-02 testid_contract; 18-05 satisfies it byte-for-byte):
 *   container data-testid="top-action-bar"
 *   Open     aria-label="Open project or PDF (Ctrl+O)" → fires onOpenClick prop
 *   Save     aria-label/title "Save (Ctrl+S)";       disabled = totalPages===0 || isSaving
 *   Save As  aria-label/title "Save As (Ctrl+Shift+S)"; disabled = saveDisabled (same)
 *   Replace  aria-label="Replace Plan PDF";          disabled = totalPages===0 || isSaving
 *   Export   aria-label="Export"; disabled = totalPages===0 || isSaving || isExporting || !hasMarkups
 *
 * Konva isolation: TopActionBar imports the CanvasViewport module control refs,
 * which transitively pull in react-konva. Mock the module so the render stays in
 * pure jsdom, mirroring the sibling ToolRail RED tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/components/CanvasViewport', () => ({
  getCanvasControls: () => null,
  getCalibrationControls: () => null,
  getChainArmedItem: () => null,
  setChainArmedFromTotals: vi.fn()
}))
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => ({
    saveProject: vi.fn().mockResolvedValue('ok'),
    saveProjectAs: vi.fn().mockResolvedValue('ok')
  })
}))

import { TopActionBar } from '@renderer/components/TopActionBar'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

interface Props {
  onOpenClick?: () => void
  onReplaceClick?: () => void
  onExportClick?: () => void
}

function renderBar(props: Props = {}): void {
  act(() => {
    root.render(
      React.createElement(TopActionBar, {
        onOpenClick: props.onOpenClick ?? vi.fn(),
        onReplaceClick: props.onReplaceClick ?? vi.fn(),
        onExportClick: props.onExportClick ?? vi.fn()
      })
    )
  })
}

// The contract allows the identifier to live on aria-label OR title ("aria-label/title").
function byLabel(label: string): HTMLButtonElement | null {
  return container.querySelector(
    `[aria-label="${label}"], [title="${label}"]`
  ) as HTMLButtonElement | null
}

function disabledAttr(label: string): string | null | undefined {
  return byLabel(label)?.getAttribute('aria-disabled')
}

// Seed one count markup so hasMarkups === true (mirrors toolbar-export-button.test.ts).
function placeOneCount(): void {
  useMarkupStore.setState({
    pageMarkups: {
      1: [
        {
          id: 'm1',
          type: 'count',
          page: 1,
          name: 'X',
          categoryId: 'c1',
          color: '#0078d4',
          createdAt: 0,
          point: { x: 0, y: 0 },
          sequence: 1
        }
      ]
    }
  })
}

beforeEach(() => {
  window.localStorage.clear()
  useViewerStore.setState({
    totalPages: 3,
    currentPage: 1,
    filePath: 'C:/x.pdf',
    fileName: 'x.pdf',
    pageViewports: {},
    pageScales: {},
    pdfDocument: null,
    activeTool: 'select',
    viewMode: 'plan'
  })
  useScaleStore.getState().reset()
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  placeOneCount()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('TopActionBar — file ops + disabled derivations (SC-5)', () => {
  it('renders the top-action-bar container with the accent Open button', () => {
    renderBar()
    expect(container.querySelector('[data-testid="top-action-bar"]')).not.toBeNull()
    expect(byLabel('Open project or PDF (Ctrl+O)')).not.toBeNull()
  })

  it('clicking Open invokes onOpenClick exactly once (migrated from toolbar-open-prop)', () => {
    const onOpenClick = vi.fn()
    renderBar({ onOpenClick })
    act(() => {
      byLabel('Open project or PDF (Ctrl+O)')!.click()
    })
    expect(onOpenClick).toHaveBeenCalledTimes(1)
  })

  it('with no PDF (totalPages:0) Save / Save As / Replace / Export are all disabled', () => {
    useViewerStore.setState({ totalPages: 0 })
    renderBar()
    expect(disabledAttr('Save (Ctrl+S)')).toBe('true')
    expect(disabledAttr('Save As (Ctrl+Shift+S)')).toBe('true')
    expect(disabledAttr('Replace Plan PDF')).toBe('true')
    expect(disabledAttr('Export')).toBe('true')
  })

  it('with a PDF + not saving + markups present, Save / Replace / Export are enabled', () => {
    // seeded state: totalPages:3, isSaving:false, isExporting:false, hasMarkups:true
    renderBar()
    expect(disabledAttr('Save (Ctrl+S)')).toBe('false')
    expect(disabledAttr('Replace Plan PDF')).toBe('false')
    expect(disabledAttr('Export')).toBe('false')
  })

  it('isSaving:true disables Save / Save As / Replace / Export (migrated from toolbar-saving-disabled)', () => {
    act(() => {
      useProjectStore.setState({ isSaving: true })
    })
    renderBar()
    expect(disabledAttr('Save (Ctrl+S)')).toBe('true')
    expect(disabledAttr('Save As (Ctrl+Shift+S)')).toBe('true')
    expect(disabledAttr('Replace Plan PDF')).toBe('true')
    expect(disabledAttr('Export')).toBe('true')
  })

  it('no markups disables Export while Save stays enabled (Export gate = !hasMarkups)', () => {
    useMarkupStore.getState().reset() // hasMarkups → false
    renderBar()
    expect(disabledAttr('Export')).toBe('true')
    expect(disabledAttr('Save (Ctrl+S)')).toBe('false')
  })

  it('isExporting:true disables Export (migrated from toolbar-export-button)', () => {
    act(() => {
      useProjectStore.setState({ isExporting: true })
    })
    renderBar()
    expect(disabledAttr('Export')).toBe('true')
  })

  it('clicking Replace invokes onReplaceClick and clicking Export invokes onExportClick', () => {
    const onReplaceClick = vi.fn()
    const onExportClick = vi.fn()
    renderBar({ onReplaceClick, onExportClick })
    act(() => {
      byLabel('Replace Plan PDF')!.click()
    })
    act(() => {
      byLabel('Export')!.click()
    })
    expect(onReplaceClick).toHaveBeenCalledTimes(1)
    expect(onExportClick).toHaveBeenCalledTimes(1)
  })
})
