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

describe('Toolbar — save buttons disabled while isSaving (D-11)', () => {
  it('Save / Save As / Replace Plan PDF buttons all have aria-disabled=true when isSaving=true', () => {
    act(() => { useProjectStore.setState({ isSaving: true }) })
    act(() => {
      root.render(React.createElement(Toolbar, { onOpenClick: vi.fn(), onReplaceClick: vi.fn() }))
    })
    const save = container.querySelector('[aria-label="Save (Ctrl+S)"]')
    const saveAs = container.querySelector('[aria-label="Save As (Ctrl+Shift+S)"]')
    const replace = container.querySelector('[aria-label="Replace Plan PDF"]')
    expect(save?.getAttribute('aria-disabled')).toBe('true')
    expect(saveAs?.getAttribute('aria-disabled')).toBe('true')
    expect(replace?.getAttribute('aria-disabled')).toBe('true')
  })

  it('Save / Save As / Replace are enabled when isSaving=false and totalPages>0', () => {
    act(() => { useProjectStore.setState({ isSaving: false }) })
    act(() => {
      root.render(React.createElement(Toolbar, { onOpenClick: vi.fn(), onReplaceClick: vi.fn() }))
    })
    const save = container.querySelector('[aria-label="Save (Ctrl+S)"]')
    const replace = container.querySelector('[aria-label="Replace Plan PDF"]')
    expect(save?.getAttribute('aria-disabled')).toBe('false')
    expect(replace?.getAttribute('aria-disabled')).toBe('false')
  })
})
