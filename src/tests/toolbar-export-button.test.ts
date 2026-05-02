/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@renderer/lib/pdf-setup', () => ({
  pdfjsLib: { getDocument: vi.fn() },
  PDFDocumentProxy: class {}
}))
vi.mock('@renderer/hooks/useProject', () => ({
  useProject: () => ({
    saveProject: vi.fn().mockResolvedValue('ok'),
    saveProjectAs: vi.fn().mockResolvedValue('ok'),
    replacePlanPdf: vi.fn().mockResolvedValue({ kind: 'ok' })
  })
}))

import { Toolbar } from '@renderer/components/Toolbar'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'

let container: HTMLDivElement
let root: Root

function placeOneCount(): void {
  useMarkupStore.setState({
    pageMarkups: { 1: [{
      id: 'm1', type: 'count', page: 1, name: 'X',
      categoryId: 'c1', color: '#0078d4', createdAt: 0,
      point: { x: 0, y: 0 }, sequence: 1
    }] }
  })
}

beforeEach(() => {
  useViewerStore.setState({
    totalPages: 3, currentPage: 1, filePath: 'C:/x.pdf', fileName: 'x.pdf',
    pageViewports: {}, pageScales: {}, pdfDocument: null, activeTool: 'select'
  })
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

describe('Toolbar — Export button (D-15, D-19)', () => {
  it('renders button with aria-label "Export"', () => {
    act(() => {
      root.render(React.createElement(Toolbar, {
        onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick: vi.fn()
      }))
    })
    expect(container.querySelector('[aria-label="Export"]')).not.toBeNull()
  })

  it('clicking Export button invokes onExportClick prop', () => {
    const onExportClick = vi.fn()
    act(() => {
      root.render(React.createElement(Toolbar, {
        onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick
      }))
    })
    const btn = container.querySelector('[aria-label="Export"]') as HTMLButtonElement
    act(() => { btn.click() })
    expect(onExportClick).toHaveBeenCalledTimes(1)
  })

  it('Export button is disabled when totalPages === 0 — D-19', () => {
    useViewerStore.setState({ totalPages: 0 })
    act(() => {
      root.render(React.createElement(Toolbar, {
        onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick: vi.fn()
      }))
    })
    expect(container.querySelector('[aria-label="Export"]')?.getAttribute('aria-disabled')).toBe('true')
  })

  it('Export button is disabled when isSaving === true — D-19', () => {
    act(() => { useProjectStore.setState({ isSaving: true }) })
    act(() => {
      root.render(React.createElement(Toolbar, {
        onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick: vi.fn()
      }))
    })
    expect(container.querySelector('[aria-label="Export"]')?.getAttribute('aria-disabled')).toBe('true')
  })

  it('Export button is disabled when isExporting === true — D-19', () => {
    act(() => { useProjectStore.setState({ isExporting: true }) })
    act(() => {
      root.render(React.createElement(Toolbar, {
        onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick: vi.fn()
      }))
    })
    expect(container.querySelector('[aria-label="Export"]')?.getAttribute('aria-disabled')).toBe('true')
  })

  it('Export button is disabled when zero markups exist — D-07, D-19', () => {
    useMarkupStore.getState().reset()
    act(() => {
      root.render(React.createElement(Toolbar, {
        onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick: vi.fn()
      }))
    })
    expect(container.querySelector('[aria-label="Export"]')?.getAttribute('aria-disabled')).toBe('true')
  })

  it('Export button is enabled when totalPages>0 + !isSaving + !isExporting + has markups', () => {
    act(() => {
      root.render(React.createElement(Toolbar, {
        onOpenClick: vi.fn(), onReplaceClick: vi.fn(), onExportClick: vi.fn()
      }))
    })
    expect(container.querySelector('[aria-label="Export"]')?.getAttribute('aria-disabled')).toBe('false')
  })
})
