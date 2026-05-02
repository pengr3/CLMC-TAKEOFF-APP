/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { UncalibratedExportWarningModal } from '@renderer/components/UncalibratedExportWarningModal'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('UncalibratedExportWarningModal — D-06', () => {
  it('renders with role="dialog" and aria-modal="true"', () => {
    act(() => {
      root.render(React.createElement(UncalibratedExportWarningModal, {
        uncalibratedPages: [1, 3],
        onContinue: vi.fn(),
        onCancel: vi.fn()
      }))
    })
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
  })

  it('renders the comma-separated page list in the body text — D-06', () => {
    act(() => {
      root.render(React.createElement(UncalibratedExportWarningModal, {
        uncalibratedPages: [1, 3, 7],
        onContinue: vi.fn(),
        onCancel: vi.fn()
      }))
    })
    expect(container.textContent).toMatch(/1,\s*3,\s*7/)
  })

  it('Continue button has focus on mount', () => {
    act(() => {
      root.render(React.createElement(UncalibratedExportWarningModal, {
        uncalibratedPages: [2],
        onContinue: vi.fn(),
        onCancel: vi.fn()
      }))
    })
    const continueBtn = container.querySelector('button[aria-label="Continue"]') as HTMLButtonElement | null
    expect(continueBtn).not.toBeNull()
    expect(document.activeElement).toBe(continueBtn)
  })

  it('Continue click calls onContinue', () => {
    const onContinue = vi.fn()
    act(() => {
      root.render(React.createElement(UncalibratedExportWarningModal, {
        uncalibratedPages: [2],
        onContinue, onCancel: vi.fn()
      }))
    })
    act(() => { (container.querySelector('button[aria-label="Continue"]') as HTMLButtonElement).click() })
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('Cancel click calls onCancel', () => {
    const onCancel = vi.fn()
    act(() => {
      root.render(React.createElement(UncalibratedExportWarningModal, {
        uncalibratedPages: [2],
        onContinue: vi.fn(), onCancel
      }))
    })
    act(() => { (container.querySelector('button[aria-label="Cancel"]') as HTMLButtonElement).click() })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape key calls onCancel', () => {
    const onCancel = vi.fn()
    act(() => {
      root.render(React.createElement(UncalibratedExportWarningModal, {
        uncalibratedPages: [2],
        onContinue: vi.fn(), onCancel
      }))
    })
    const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
