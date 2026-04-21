/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { ActiveTool } from '@renderer/types/viewer'

// Test component uses the same selector pattern CanvasViewport uses post-B4 fix.
// If the selector subscribes to the zoom primitive, mutating the store triggers
// a re-render and the rendered text updates. If the subscription is broken
// (e.g. selecting a stable function reference), the text stays stale.
function TestComponent(props: { page: number }): React.ReactElement {
  const zoom = useViewerStore((s) => s.pageViewports[props.page]?.zoom ?? 1)
  return React.createElement('div', { 'data-testid': 'zoom-readout' }, zoom.toFixed(2))
}

function CountingComponent(props: {
  page: number
  onRender: () => void
}): React.ReactElement {
  props.onRender()
  const zoom = useViewerStore((s) => s.pageViewports[props.page]?.zoom ?? 1)
  return React.createElement('div', null, String(zoom))
}

beforeEach(() => {
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null,
    pageScales: {},
    activeTool: 'select' as ActiveTool
  })
})

describe('B4 — pageViewports zoom subscription', () => {
  it('component reads zoom=1 when no viewport stored (?? 1 fallback)', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(React.createElement(TestComponent, { page: 1 }))
    })
    const el = container.querySelector('[data-testid="zoom-readout"]')!
    expect(el.textContent).toBe('1.00')
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('component re-renders when setViewport changes the zoom primitive', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(React.createElement(TestComponent, { page: 1 }))
    })
    const el = container.querySelector('[data-testid="zoom-readout"]')!
    expect(el.textContent).toBe('1.00')

    act(() => {
      useViewerStore.getState().setViewport(1, { zoom: 2.5, panX: 0, panY: 0 })
    })
    expect(el.textContent).toBe('2.50')

    act(() => {
      useViewerStore.getState().setViewport(1, { zoom: 0.5, panX: 10, panY: 20 })
    })
    expect(el.textContent).toBe('0.50')

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('primitive equality — same zoom value does not force extra renders beyond React baseline', () => {
    // Guards against future regressions where an unstable fallback (fresh object each call)
    // would cause unnecessary re-renders even when zoom value hasn't changed.
    let renderCount = 0
    const onRender = (): void => {
      renderCount++
    }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(React.createElement(CountingComponent, { page: 1, onRender }))
    })
    const initialRenders = renderCount

    // Set zoom to 2, then set it to 2 again with a different panX.
    // Because the selector returns only `zoom`, Object.is(2, 2) should skip re-render.
    act(() => {
      useViewerStore.getState().setViewport(1, { zoom: 2, panX: 0, panY: 0 })
    })
    const afterFirstSet = renderCount

    act(() => {
      useViewerStore.getState().setViewport(1, { zoom: 2, panX: 50, panY: 50 })
    })
    // Zoom value unchanged (still 2) -> Object.is holds -> no re-render
    expect(renderCount).toBe(afterFirstSet)
    expect(afterFirstSet).toBeGreaterThan(initialRenders)

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
