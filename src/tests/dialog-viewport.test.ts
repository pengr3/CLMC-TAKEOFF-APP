/** @vitest-environment jsdom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { useDraggable, type UseDraggableReturn } from '@renderer/hooks/useDraggable'

it('reclamps the entire dragged dialog and action row after the effective viewport shrinks', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  const el = document.createElement('div')
  document.body.append(el)
  const holder: { value: UseDraggableReturn | null } = { value: null }
  function Harness(): React.JSX.Element {
    const drag = useDraggable()
    React.useLayoutEffect(() => { holder.value = drag })
    return React.createElement('div', { role: 'dialog', onPointerDown: drag.onPointerDown },
      React.createElement('div', null, 'Long content '.repeat(200)),
      React.createElement('button', null, 'Close'))
  }
  const root = createRoot(el)
  await act(async () => { root.render(React.createElement(Harness)) })
  const dialog = el.querySelector('[role=dialog]') as HTMLDivElement
  vi.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() => {
    const { x = 0, y = 0 } = holder.value?.position ?? {}
    const width = Math.min(420, window.innerWidth - 48)
    const height = Math.min(600, window.innerHeight - 48)
    return { x: 0, y: 0, width, height,
      left: (window.innerWidth - width) / 2 + x,
      top: (window.innerHeight - height) / 2 + y,
      right: (window.innerWidth + width) / 2 + x,
      bottom: (window.innerHeight + height) / 2 + y, toJSON: () => ({}) }
  })
  const move = async (x: number, y: number): Promise<void> => {
    await act(async () => {
      const event = new Event('pointermove')
      Object.assign(event, { clientX: x, clientY: y })
      window.dispatchEvent(event)
    })
  }
  try {
    await act(async () => {
      holder.value!.onPointerDown({ target: dialog, currentTarget: dialog,
        clientX: 0, clientY: 0, pointerId: 1 } as unknown as React.PointerEvent)
    })
    await move(10000, 10000)
    expect(dialog.getBoundingClientRect().right).toBeLessThanOrEqual(1176)
    expect(dialog.getBoundingClientRect().bottom).toBeLessThanOrEqual(876)
    await act(async () => {
      window.dispatchEvent(new Event('pointerup'))
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 })
      window.dispatchEvent(new Event('resize'))
    })
    const bounds = dialog.getBoundingClientRect()
    expect(bounds.left).toBeGreaterThanOrEqual(24)
    expect(bounds.top).toBeGreaterThanOrEqual(24)
    expect(bounds.right).toBeLessThanOrEqual(616)
    expect(bounds.bottom).toBeLessThanOrEqual(376)
    expect(dialog.style.maxHeight).not.toBe('')
    expect(dialog.style.overflowY).toBe('auto')
  } finally {
    act(() => root.unmount()); el.remove(); vi.restoreAllMocks()
  }
})
