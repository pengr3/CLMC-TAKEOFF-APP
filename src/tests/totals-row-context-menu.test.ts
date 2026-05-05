/** @vitest-environment jsdom */
/**
 * TotalsRowContextMenu — D-14 right-click context menu contract (plan 06-05).
 *
 * Mirrors src/tests/markup-context-menu.test.ts (jsdom env, React.createElement
 * mount harness because vitest.config.ts include glob is *.test.ts only).
 *
 * Asserts:
 *   1. Section header "Item" + a "Copy as text" menuitem.
 *   2. count row → tab-separated payload uses integer quantity (Math.round).
 *   3. length/area row → tab-separated payload uses .toFixed(2) value.
 *   4. Successful clipboard write triggers onCopy('Copied {label}') and onClose.
 *   5. Failing clipboard write triggers onCopyError() and onClose.
 *   6. Escape key calls onClose (defer-listener-registration honored).
 *   7. role="menu" + aria-label="Item actions".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { TotalsRowContextMenu } from '@renderer/components/TotalsRowContextMenu'
import type { BoqItemRow } from '@renderer/lib/boq-types'

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  }
}

function makeItem(overrides: Partial<BoqItemRow>): BoqItemRow {
  return {
    label: 'Outlet (count)',
    quantity: 7,
    uom: 'ea',
    color: '#0078d4',
    type: 'count',
    ...overrides
  }
}

interface ClipboardWriteSpy {
  writeText: ReturnType<typeof vi.fn>
}

function installClipboardMock(behavior: 'resolve' | 'reject' = 'resolve'): ClipboardWriteSpy {
  const writeText = vi.fn(() =>
    behavior === 'resolve' ? Promise.resolve() : Promise.reject(new Error('mock-failure'))
  )
  // navigator.clipboard is read-only in jsdom by default; redefine descriptor.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  })
  return { writeText }
}

const basePos = { x: 50, y: 60 }

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('TotalsRowContextMenu — structure (D-14)', () => {
  it('renders role="menu" with aria-label "Item actions" + section header "Item" + Copy as text', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: basePos,
        item: makeItem({}),
        onClose: vi.fn(),
        onCopy: vi.fn(),
        onCopyError: vi.fn()
      })
    )
    try {
      const menu = container.querySelector('[role="menu"]') as HTMLElement | null
      expect(menu).not.toBeNull()
      expect(menu!.getAttribute('aria-label')).toBe('Item actions')

      // Section header
      const header = Array.from(menu!.querySelectorAll('div')).find(
        (d) => d.textContent === 'Item'
      )
      expect(header).toBeDefined()

      // Action button
      const copyBtn = Array.from(menu!.querySelectorAll('button')).find(
        (b) => b.textContent === 'Copy as text'
      )
      expect(copyBtn).toBeDefined()
      expect(copyBtn!.getAttribute('role')).toBe('menuitem')
    } finally {
      unmount()
    }
  })

  it('positions at screenPos via fixed positioning (left/top reflect cursor coords)', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: { x: 123, y: 456 },
        item: makeItem({}),
        onClose: vi.fn(),
        onCopy: vi.fn(),
        onCopyError: vi.fn()
      })
    )
    try {
      const menu = container.querySelector('[role="menu"]') as HTMLElement
      expect(menu.style.position).toBe('fixed')
      expect(menu.style.left).toBe('123px')
      expect(menu.style.top).toBe('456px')
    } finally {
      unmount()
    }
  })
})

describe('TotalsRowContextMenu — Copy as text (D-14, UI-SPEC clipboard payload)', () => {
  it('count row → payload uses Math.round(quantity), tab-separated label\\tqty\\tuom', async () => {
    const spy = installClipboardMock('resolve')
    const onCopy = vi.fn()
    const onClose = vi.fn()
    const onCopyError = vi.fn()
    const { container, unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: basePos,
        item: makeItem({ label: 'Outlet (count)', quantity: 7.4, uom: 'ea', type: 'count' }),
        onClose,
        onCopy,
        onCopyError
      })
    )
    try {
      const copyBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Copy as text'
      ) as HTMLButtonElement
      await act(async () => {
        copyBtn.click()
        // Allow the async clipboard write microtask to settle
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(spy.writeText).toHaveBeenCalledTimes(1)
      const payload = spy.writeText.mock.calls[0][0]
      // count → integer (Math.round(7.4) = 7), tab-separated, no decimal point
      expect(payload).toBe('Outlet (count)\t7\tea')
      expect(payload.includes('.')).toBe(false)
      expect(onCopy).toHaveBeenCalledWith('Copied Outlet (count)')
      expect(onCopyError).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    } finally {
      unmount()
    }
  })

  it('linear/area/perimeter row → payload uses quantity.toFixed(2)', async () => {
    const spy = installClipboardMock('resolve')
    const onCopy = vi.fn()
    const onClose = vi.fn()
    const { container, unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: basePos,
        item: makeItem({
          label: 'Wall (linear)',
          quantity: 12.345,
          uom: 'm',
          color: '#107c10',
          type: 'linear'
        }),
        onClose,
        onCopy,
        onCopyError: vi.fn()
      })
    )
    try {
      const copyBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Copy as text'
      ) as HTMLButtonElement
      await act(async () => {
        copyBtn.click()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(spy.writeText).toHaveBeenCalledTimes(1)
      // 12.345.toFixed(2) === '12.35' (banker's rounding; toFixed rounds half-away-from-zero in V8)
      expect(spy.writeText.mock.calls[0][0]).toBe('Wall (linear)\t12.35\tm')
      expect(onCopy).toHaveBeenCalledWith('Copied Wall (linear)')
    } finally {
      unmount()
    }
  })

  it('area row → payload uses .toFixed(2) too (m² UoM)', async () => {
    const spy = installClipboardMock('resolve')
    const { container, unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: basePos,
        item: makeItem({
          label: 'Floor (area)',
          quantity: 4.5,
          uom: 'm²',
          color: '#d13438',
          type: 'area'
        }),
        onClose: vi.fn(),
        onCopy: vi.fn(),
        onCopyError: vi.fn()
      })
    )
    try {
      const copyBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Copy as text'
      ) as HTMLButtonElement
      await act(async () => {
        copyBtn.click()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(spy.writeText.mock.calls[0][0]).toBe('Floor (area)\t4.50\tm²')
    } finally {
      unmount()
    }
  })

  it('perimeter-length row → payload uses .toFixed(2)', async () => {
    const spy = installClipboardMock('resolve')
    const { container, unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: basePos,
        item: makeItem({
          label: 'Slab (perimeter)',
          quantity: 8,
          uom: 'm',
          color: '#5c2d91',
          type: 'perimeter-length'
        }),
        onClose: vi.fn(),
        onCopy: vi.fn(),
        onCopyError: vi.fn()
      })
    )
    try {
      const copyBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Copy as text'
      ) as HTMLButtonElement
      await act(async () => {
        copyBtn.click()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(spy.writeText.mock.calls[0][0]).toBe('Slab (perimeter)\t8.00\tm')
    } finally {
      unmount()
    }
  })

  it('clipboard write rejection → onCopyError fires, onCopy does NOT fire, onClose still closes', async () => {
    installClipboardMock('reject')
    const onCopy = vi.fn()
    const onCopyError = vi.fn()
    const onClose = vi.fn()
    const { container, unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: basePos,
        item: makeItem({}),
        onClose,
        onCopy,
        onCopyError
      })
    )
    try {
      const copyBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Copy as text'
      ) as HTMLButtonElement
      await act(async () => {
        copyBtn.click()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(onCopy).not.toHaveBeenCalled()
      expect(onCopyError).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalled()
    } finally {
      unmount()
    }
  })
})

describe('TotalsRowContextMenu — dismissal (defer-listener-registration)', () => {
  it('Escape key triggers onClose (after the deferred listener registration tick)', async () => {
    const onClose = vi.fn()
    const { unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: basePos,
        item: makeItem({}),
        onClose,
        onCopy: vi.fn(),
        onCopyError: vi.fn()
      })
    )
    try {
      // Wait for the deferred setTimeout(0) listener registration
      await new Promise((r) => setTimeout(r, 10))
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })
      expect(onClose).toHaveBeenCalled()
    } finally {
      unmount()
    }
  })

  it('outside click triggers onClose; inside click does not', async () => {
    const onClose = vi.fn()
    const { container, unmount } = mount(
      React.createElement(TotalsRowContextMenu, {
        screenPos: basePos,
        item: makeItem({}),
        onClose,
        onCopy: vi.fn(),
        onCopyError: vi.fn()
      })
    )
    try {
      await new Promise((r) => setTimeout(r, 10))

      // Inside click — should NOT close
      const menu = container.querySelector('[role="menu"]') as HTMLElement
      act(() => {
        const inside = new MouseEvent('mousedown', { bubbles: true })
        menu.dispatchEvent(inside)
      })
      expect(onClose).not.toHaveBeenCalled()

      // Outside click — should close
      act(() => {
        const outside = new MouseEvent('mousedown', { bubbles: true })
        document.body.dispatchEvent(outside)
      })
      expect(onClose).toHaveBeenCalled()
    } finally {
      unmount()
    }
  })
})
