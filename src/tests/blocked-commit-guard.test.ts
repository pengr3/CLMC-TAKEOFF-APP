/** @vitest-environment jsdom */
/**
 * Self-intersection commit GUARD tests (plan 14-05 / D-09).
 *
 * Two surfaces:
 *  (a) the GATE — findSelfIntersection is the oracle the CanvasViewport commit
 *      guard runs on the closed boundary; a self-crossing area/perimeter MUST
 *      return a crossing (so the commit is blocked) while a simple boundary
 *      returns null (so the commit proceeds);
 *  (b) the MESSAGE — BlockedCommitMessage renders the verbatim UI-SPEC copy with
 *      the lead word "Can't finish —" in problem red weight 600, and owns NO
 *      internal dismissal timer (parent-owned lifecycle, mirrors ConfirmationToast).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { findSelfIntersection } from '@renderer/lib/self-intersection'
import type { StagePoint } from '@renderer/hooks/useCalibrationMode'
import { BlockedCommitMessage } from '@renderer/components/BlockedCommitMessage'

describe('D-09 gate — findSelfIntersection blocks a self-crossing boundary', () => {
  it('a bowtie (figure-eight) area boundary is detected as a crossing → commit blocked', () => {
    // edge 0 (v0→v1) crosses edge 2 (v2→v3): the classic bowtie.
    const bowtie: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 }
    ]
    const crossing = findSelfIntersection(bowtie)
    expect(crossing).not.toBeNull()
    // The two offending edge indices feed the red highlight.
    expect(typeof crossing!.i).toBe('number')
    expect(typeof crossing!.j).toBe('number')
  })

  it('a simple convex quad is NOT blocked (commit proceeds)', () => {
    const quad: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
    expect(findSelfIntersection(quad)).toBeNull()
  })
})

describe('BlockedCommitMessage — copy + parent-owned lifecycle (D-09)', () => {
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

  it('renders the lead word "Can\'t finish —" in problem red weight 600', () => {
    act(() => {
      root.render(
        React.createElement(BlockedCommitMessage, { anchor: { x: 100, y: 100 } })
      )
    })
    const lead = container.querySelector('span')
    expect(lead).not.toBeNull()
    expect(lead!.textContent).toContain("Can't finish")
    // Problem red #dc2626 + weight 600 (UI-SPEC Copywriting Contract).
    expect(lead!.style.color).toBe('rgb(220, 38, 38)')
    expect(lead!.style.fontWeight).toBe('600')
  })

  it('renders the verbatim body copy explaining the fix', () => {
    act(() => {
      root.render(
        React.createElement(BlockedCommitMessage, { anchor: { x: 0, y: 0 } })
      )
    })
    const text = container.textContent ?? ''
    expect(text).toContain(
      'A self-crossing shape would report a wrong area or perimeter.'
    )
    expect(text).toContain('drag the corners or curve handle apart to fix it, then')
    expect(text).toContain('finish again.')
  })

  it('is an alert surface (role=alert) anchored at the supplied screen point', () => {
    act(() => {
      root.render(
        React.createElement(BlockedCommitMessage, { anchor: { x: 42, y: 88 } })
      )
    })
    const alert = container.querySelector('[role="alert"]') as HTMLElement
    expect(alert).not.toBeNull()
    expect(alert.style.left).toBe('42px')
    expect(alert.style.top).toBe('88px')
  })
})
