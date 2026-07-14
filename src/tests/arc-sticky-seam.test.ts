/**
 * RED (Phase 18 Wave 0) — reactive Arc read seam contract for markup-arc-ref.ts.
 *
 * This test FAILS today on purpose. `@renderer/lib/markup-arc-ref` currently
 * exposes only setter handlers (setArcHeldHandler / setArcStickyToggleHandler +
 * their getters). It has NO state getter and NO subscribe seam, so the three
 * names imported below resolve to `undefined` and every assertion here fails.
 *
 * It turns GREEN when plan 18-04 adds the getSnapshot/subscribe seam:
 *   - setArcStickyState(on): stores _arcSticky, then notifies listeners
 *                            (must be a no-op — no notify — when the value is
 *                            unchanged)
 *   - getArcSticky(): reads _arcSticky (the getSnapshot)
 *   - subscribeArcSticky(cb): registers a listener; returns an unsubscribe fn
 *
 * WHY the seam must be REACTIVE (18-RESEARCH Pitfall 1 / 18-PATTERNS R-2):
 * Shift+A flips useMarkupTool's local arc state with NO coincident store change.
 * A bare module-var read (like getChainArmedItem) would leave the ToolRail /
 * ContextBar Arc toggle stale after a Shift+A. Consumers therefore read the seam
 * through useSyncExternalStore(subscribeArcSticky, getArcSticky), which requires
 * the notify path to fire on real changes only.
 *
 * Pure module test — no React, no jsdom needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setArcStickyState, getArcSticky, subscribeArcSticky } from '@renderer/lib/markup-arc-ref'

beforeEach(() => {
  // Reset the module singleton between tests. Guarded so the RED state (the
  // export is `undefined`) surfaces as a clean assertion failure inside each
  // test rather than a beforeEach crash.
  if (typeof setArcStickyState === 'function') setArcStickyState(false)
})

describe('markup-arc-ref reactive Arc seam (18-04 target)', () => {
  it('exposes setArcStickyState / getArcSticky / subscribeArcSticky as functions', () => {
    expect(typeof setArcStickyState).toBe('function')
    expect(typeof getArcSticky).toBe('function')
    expect(typeof subscribeArcSticky).toBe('function')
  })

  it('getArcSticky() reads false before any set', () => {
    expect(typeof getArcSticky).toBe('function')
    expect(getArcSticky()).toBe(false)
  })

  it('setArcStickyState(true) → getArcSticky() true; setArcStickyState(false) → false', () => {
    expect(typeof setArcStickyState).toBe('function')
    expect(typeof getArcSticky).toBe('function')

    setArcStickyState(true)
    expect(getArcSticky()).toBe(true)

    setArcStickyState(false)
    expect(getArcSticky()).toBe(false)
  })

  it('notifies a registered listener on a real change, reading the NEW value when it fires', () => {
    expect(typeof subscribeArcSticky).toBe('function')

    let valueWhenNotified: boolean | undefined
    const spy = vi.fn(() => {
      valueWhenNotified = getArcSticky()
    })
    const unsub = subscribeArcSticky(spy)

    setArcStickyState(true)

    // The listener fired exactly once, and the snapshot was already updated when
    // it fired — the store notifies AFTER committing the new value, as
    // useSyncExternalStore requires.
    expect(spy).toHaveBeenCalledTimes(1)
    expect(valueWhenNotified).toBe(true)

    unsub()
  })

  it('does NOT notify on a no-op set (same value)', () => {
    expect(typeof subscribeArcSticky).toBe('function')

    const spy = vi.fn()
    const unsub = subscribeArcSticky(spy)

    setArcStickyState(true) // false → true: a real change
    expect(spy).toHaveBeenCalledTimes(1)

    setArcStickyState(true) // true → true: no change, must NOT notify
    expect(spy).toHaveBeenCalledTimes(1)

    unsub()
  })

  it('stops notifying after the returned unsubscribe is called', () => {
    expect(typeof subscribeArcSticky).toBe('function')

    const spy = vi.fn()
    const unsub = subscribeArcSticky(spy)

    setArcStickyState(true)
    expect(spy).toHaveBeenCalledTimes(1)

    unsub()

    setArcStickyState(false) // real change, but the listener is gone
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
