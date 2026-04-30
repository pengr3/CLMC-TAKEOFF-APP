/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { TitleBar } from '@renderer/components/TitleBar'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useViewerStore } from '@renderer/stores/viewerStore'

function mountTitleBar(): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let root!: Root
  act(() => {
    root = createRoot(container)
    root.render(React.createElement(TitleBar))
  })
  return {
    container,
    unmount: () => { act(() => { root.unmount() }); container.remove() }
  }
}

beforeEach(() => {
  useProjectStore.getState().reset()
  useViewerStore.setState({
    filePath: null, fileName: null, currentPage: 1, totalPages: 0,
    pageViewports: {}, pdfDocument: null, pageScales: {}, activeTool: 'select'
  })
})

describe('TitleBar — Saving indicator (D-11)', () => {
  it('renders text containing "Saving..." when isSaving=true', () => {
    act(() => {
      useProjectStore.setState({ currentFilePath: 'C:/proj/plans.clmc', isDirty: true, isSaving: true })
    })
    const { container, unmount } = mountTitleBar()
    expect(container.textContent).toContain('Saving...')
    expect(container.textContent).toContain('CLMC Takeoff')
    unmount()
  })

  it('falls back to filename when isSaving=false', () => {
    act(() => {
      useProjectStore.setState({ currentFilePath: 'C:/proj/plans.clmc', isDirty: false, isSaving: false })
    })
    const { container, unmount } = mountTitleBar()
    expect(container.textContent).toContain('plans.clmc')
    expect(container.textContent).not.toContain('Saving...')
    unmount()
  })
})
