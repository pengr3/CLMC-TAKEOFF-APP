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
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    }
  }
}

beforeEach(() => {
  useProjectStore.getState().reset()
  useViewerStore.setState({
    filePath: null, fileName: null, currentPage: 1, totalPages: 0,
    pageViewports: {}, pdfDocument: null, pageScales: {}, activeTool: 'select'
  })
})

describe('title-bar-dirty', () => {
  it('asterisk when dirty — title renders "<file>.clmc * — CLMC Takeoff" when isDirty=true', () => {
    act(() => {
      useProjectStore.setState({ currentFilePath: 'C:/proj/plans.clmc', isDirty: true })
    })
    const { container, unmount } = mountTitleBar()
    expect(container.textContent).toContain('plans.clmc * — CLMC Takeoff')
    unmount()
  })

  it('no asterisk when clean — title renders "<file>.clmc — CLMC Takeoff" when isDirty=false', () => {
    act(() => {
      useProjectStore.setState({ currentFilePath: 'C:/proj/plans.clmc', isDirty: false })
    })
    const { container, unmount } = mountTitleBar()
    expect(container.textContent).toContain('plans.clmc — CLMC Takeoff')
    expect(container.textContent).not.toContain('plans.clmc * —')
    unmount()
  })

  it('falls back to viewerStore.fileName when currentFilePath is null', () => {
    act(() => {
      useViewerStore.setState({ fileName: 'plans.pdf' })
      useProjectStore.setState({ currentFilePath: null, isDirty: false })
    })
    const { container, unmount } = mountTitleBar()
    expect(container.textContent).toContain('plans.pdf — CLMC Takeoff')
    unmount()
  })
})
