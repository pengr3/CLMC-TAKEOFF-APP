/** @vitest-environment jsdom */
/**
 * OpenErrorModal copy parameterization (Phase 16 UAT gap GAP-2).
 *
 * GAP-2: exporting a BOQ to a file open in Excel surfaced the raw
 * `EPERM: … rename '<path>.tmp' -> '<path>'` inside the FILE-OPEN error modal,
 * whose copy read "Failed to open file / An unexpected error occurred while
 * opening the file…" — misleading for an export.
 *
 * Fix: OpenErrorModal takes optional `title`/`body` props defaulting to the
 * open-file copy (existing open-error callers unchanged), and App.tsx passes
 * export-specific copy for the export error path. This test asserts BOTH:
 *   1. Default render (no title/body) still shows the open-file copy.
 *   2. Export render shows 'Export failed' + the export body + the specific
 *      reason detail — and NOT the open-file wording.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { OpenErrorModal } from '@renderer/components/OpenErrorModal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

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

describe('OpenErrorModal — copy parameterization (GAP-2)', () => {
  it('defaults to the file-open copy when no title/body given (existing callers unchanged)', () => {
    act(() => {
      root.render(
        React.createElement(OpenErrorModal, {
          message: 'ENOENT: no such file or directory',
          onClose: () => {}
        })
      )
    })
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.getAttribute('aria-label')).toBe('Failed to open file')
    expect(container.textContent).toContain('Failed to open file')
    expect(container.textContent).toContain('An unexpected error occurred while opening the file')
    // The specific reason is still shown as the detail line.
    expect(container.textContent).toContain('ENOENT: no such file or directory')
  })

  it('renders export-specific copy (title/body) and the reason — NOT the open-file wording', () => {
    const reason =
      'Couldn\'t save "BOQ.xlsx" — it looks like the file is open in another program (for example Excel). Close it and export again. (EPERM)'
    act(() => {
      root.render(
        React.createElement(OpenErrorModal, {
          title: 'Export failed',
          body: "The BOQ couldn't be exported.",
          message: reason,
          onClose: () => {}
        })
      )
    })
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.getAttribute('aria-label')).toBe('Export failed')
    expect(container.textContent).toContain('Export failed')
    expect(container.textContent).toContain("The BOQ couldn't be exported.")
    // The friendly locked-file reason is shown as the detail line.
    expect(container.textContent).toContain('open in another program')
    expect(container.textContent).toContain('BOQ.xlsx')
    // Must NOT show the open-file failure wording.
    expect(container.textContent).not.toContain('Failed to open file')
    expect(container.textContent).not.toContain('The file may be corrupted or inaccessible')
  })
})
