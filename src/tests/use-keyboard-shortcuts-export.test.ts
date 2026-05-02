/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { useViewerStore } from '@renderer/stores/viewerStore'

let container: HTMLDivElement
let root: Root

function HookHost(props: { handlers: Parameters<typeof useKeyboardShortcuts>[0] }): null {
  useKeyboardShortcuts(props.handlers)
  return null
}

beforeEach(() => {
  useViewerStore.setState({
    totalPages: 3, currentPage: 1, filePath: 'C:/x.pdf', fileName: 'x.pdf',
    pageViewports: {}, pageScales: {}, pdfDocument: null, activeTool: 'select'
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('useKeyboardShortcuts — Ctrl+Shift+E (D-18)', () => {
  it('Ctrl+Shift+E fires handlers.exportBoq when no text input is focused', () => {
    const exportBoq = vi.fn()
    const handlers = {
      openPdf: vi.fn(), openProject: vi.fn(), saveProject: vi.fn(), saveProjectAs: vi.fn(),
      zoomIn: vi.fn(), zoomOut: vi.fn(), fitToWindow: vi.fn(), exportBoq
    }
    act(() => { root.render(React.createElement(HookHost, { handlers })) })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true }))
    })
    expect(exportBoq).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+Shift+E is suppressed when an input element is focused — isTextInputActive guard', () => {
    const exportBoq = vi.fn()
    const handlers = {
      openPdf: vi.fn(), openProject: vi.fn(), saveProject: vi.fn(), saveProjectAs: vi.fn(),
      zoomIn: vi.fn(), zoomOut: vi.fn(), fitToWindow: vi.fn(), exportBoq
    }
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    act(() => { root.render(React.createElement(HookHost, { handlers })) })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true }))
    })
    expect(exportBoq).not.toHaveBeenCalled()
    input.remove()
  })

  it('lowercase "e" with Ctrl+Shift also fires (cross-OS lock-state insensitivity)', () => {
    const exportBoq = vi.fn()
    const handlers = {
      openPdf: vi.fn(), openProject: vi.fn(), saveProject: vi.fn(), saveProjectAs: vi.fn(),
      zoomIn: vi.fn(), zoomOut: vi.fn(), fitToWindow: vi.fn(), exportBoq
    }
    act(() => { root.render(React.createElement(HookHost, { handlers })) })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, shiftKey: true }))
    })
    expect(exportBoq).toHaveBeenCalledTimes(1)
  })
})
