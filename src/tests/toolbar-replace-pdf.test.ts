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

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  useViewerStore.setState({
    totalPages: 3, currentPage: 1, filePath: 'C:/x.pdf', fileName: 'x.pdf',
    pageViewports: {}, pageScales: {}, pdfDocument: null, activeTool: 'select'
  })
  useProjectStore.getState().reset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Toolbar — Replace Plan PDF button (D-08)', () => {
  it('renders a button with aria-label "Replace Plan PDF"', () => {
    const onOpenClick = vi.fn()
    const onReplaceClick = vi.fn()
    act(() => {
      root.render(React.createElement(Toolbar, { onOpenClick, onReplaceClick, onExportClick: vi.fn() }))
    })
    const btn = container.querySelector('[aria-label="Replace Plan PDF"]')
    expect(btn).not.toBeNull()
  })

  it('clicking the Replace Plan PDF button invokes onReplaceClick prop', () => {
    const onOpenClick = vi.fn()
    const onReplaceClick = vi.fn()
    act(() => {
      root.render(React.createElement(Toolbar, { onOpenClick, onReplaceClick, onExportClick: vi.fn() }))
    })
    const btn = container.querySelector('[aria-label="Replace Plan PDF"]') as HTMLButtonElement | null
    expect(btn).not.toBeNull()
    act(() => { btn!.click() })
    expect(onReplaceClick).toHaveBeenCalledTimes(1)
  })
})
