/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import { isTextInputActive } from '@renderer/hooks/useKeyboardShortcuts'

describe('B1 — isTextInputActive() guard correctness', () => {
  it('returns false when no element is focused', () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    expect(isTextInputActive()).toBe(false)
  })

  it('returns true when an <input> is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(isTextInputActive()).toBe(true)
    input.remove()
  })

  it('returns true when a <textarea> is focused', () => {
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    expect(isTextInputActive()).toBe(true)
    ta.remove()
  })

  it('returns true when a contenteditable element is focused', () => {
    const div = document.createElement('div')
    // Use setAttribute — reliable across jsdom and browsers. The helper has an
    // attribute-based fallback for environments where the IDL property does
    // not reflect.
    div.setAttribute('contenteditable', 'true')
    div.tabIndex = 0 // non-focusable-by-default elements need tabindex to receive focus
    document.body.appendChild(div)
    div.focus()
    expect(isTextInputActive()).toBe(true)
    div.remove()
  })

  it('returns false when a <button> is focused', () => {
    const btn = document.createElement('button')
    document.body.appendChild(btn)
    btn.focus()
    expect(isTextInputActive()).toBe(false)
    btn.remove()
  })
})

describe('B1 — useViewportControls spacebar guard source', () => {
  it('useViewportControls.ts imports isTextInputActive and applies it before preventDefault', async () => {
    // Source-level regression check: confirms the guard cannot silently be removed.
    // If someone reverts the guard, this test fails even if runtime behavior looks ok.
    const fs = await import('node:fs')
    const path = await import('node:path')
    const filePath = path.resolve(
      process.cwd(),
      'src/renderer/src/hooks/useViewportControls.ts'
    )
    const src = fs.readFileSync(filePath, 'utf8')
    expect(src).toContain("from './useKeyboardShortcuts'")
    // Confirm isTextInputActive is called in the Space block BEFORE preventDefault:
    const spaceIdx = src.indexOf("e.code === 'Space'")
    const guardIdx = src.indexOf('isTextInputActive()', spaceIdx)
    const preventIdx = src.indexOf('e.preventDefault()', spaceIdx)
    expect(guardIdx).toBeGreaterThan(-1)
    expect(preventIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(preventIdx)
  })
})
