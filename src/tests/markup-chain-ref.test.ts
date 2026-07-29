/**
 * Regression — tool-switch-placement-stuck (2026-07-29), part 2 (stale chip).
 *
 * The reactive chain-armed read seam for markup-chain-ref.ts. Bug: switching from a
 * chain-armed Count tool to Linear reset the useMarkupTool machine, but the ContextBar
 * chip kept showing the PRIOR group's name because it read a bare module var during
 * render and never re-rendered when the chain state cleared. The fix mirrors the 18-04
 * Arc seam: a getSnapshot/subscribe pair consumed via
 * useSyncExternalStore(subscribeChainArmed, getChainArmedItem).
 *
 * Contract pinned here (must match markup-arc-ref's semantics):
 *   - getChainArmedItem(): the getSnapshot; null when nothing armed.
 *   - setChainArmedItem(next): stores by VALUE-change, then notifies listeners;
 *     a no-op (no notify) when the value is unchanged.
 *   - subscribeChainArmed(cb): registers a listener; returns an unsubscribe fn.
 *   - notify fires AFTER the new value is committed (callbacks read the NEW value).
 *
 * Pure module test — no React, no jsdom needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  setChainArmedItem,
  getChainArmedItem,
  subscribeChainArmed
} from '@renderer/lib/markup-chain-ref'

beforeEach(() => {
  // Reset the module singleton between tests.
  setChainArmedItem(null)
})

describe('markup-chain-ref reactive chain-armed seam', () => {
  it('exposes setChainArmedItem / getChainArmedItem / subscribeChainArmed as functions', () => {
    expect(typeof setChainArmedItem).toBe('function')
    expect(typeof getChainArmedItem).toBe('function')
    expect(typeof subscribeChainArmed).toBe('function')
  })

  it('getChainArmedItem() reads null before any arm', () => {
    expect(getChainArmedItem()).toBeNull()
  })

  it('setChainArmedItem(item) → getChainArmedItem() reflects it; set null → null', () => {
    setChainArmedItem({ name: 'Instagram', color: '#f0883e' })
    expect(getChainArmedItem()).toEqual({ name: 'Instagram', color: '#f0883e' })

    setChainArmedItem(null)
    expect(getChainArmedItem()).toBeNull()
  })

  it('THE BUG: clearing an armed item on tool switch notifies with getChainArmedItem() === null', () => {
    // Arm "Instagram" (the count group), then switch tools → machine resets → clear.
    setChainArmedItem({ name: 'Instagram', color: '#f0883e' })

    let valueWhenNotified: { name: string; color: string } | null | undefined
    const spy = vi.fn(() => {
      valueWhenNotified = getChainArmedItem()
    })
    const unsub = subscribeChainArmed(spy)

    setChainArmedItem(null) // the count→linear switch clearing the armed item

    expect(spy).toHaveBeenCalledTimes(1)
    // The chip's subscriber sees null the instant it fires — no stale "Instagram".
    expect(valueWhenNotified).toBeNull()

    unsub()
  })

  it('notifies on a real change, reading the NEW value when it fires', () => {
    let valueWhenNotified: { name: string; color: string } | null | undefined
    const spy = vi.fn(() => {
      valueWhenNotified = getChainArmedItem()
    })
    const unsub = subscribeChainArmed(spy)

    setChainArmedItem({ name: 'Slab', color: '#4f9cf0' })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(valueWhenNotified).toEqual({ name: 'Slab', color: '#4f9cf0' })

    unsub()
  })

  it('does NOT notify on a no-op set (same name + color)', () => {
    setChainArmedItem({ name: 'Slab', color: '#4f9cf0' })

    const spy = vi.fn()
    const unsub = subscribeChainArmed(spy)

    // A fresh object with identical fields must be treated as unchanged so the
    // getSnapshot reference stays stable (no churn / no "getSnapshot should be
    // cached" loop under useSyncExternalStore).
    setChainArmedItem({ name: 'Slab', color: '#4f9cf0' })
    expect(spy).not.toHaveBeenCalled()

    // A color change to the same name IS a real change.
    setChainArmedItem({ name: 'Slab', color: '#e0533e' })
    expect(spy).toHaveBeenCalledTimes(1)

    unsub()
  })

  it('does NOT notify on null → null', () => {
    const spy = vi.fn()
    const unsub = subscribeChainArmed(spy)

    setChainArmedItem(null) // already null (reset in beforeEach)
    expect(spy).not.toHaveBeenCalled()

    unsub()
  })

  it('returns a referentially STABLE snapshot between notifications', () => {
    setChainArmedItem({ name: 'Slab', color: '#4f9cf0' })
    const first = getChainArmedItem()
    // Repeated reads with no intervening change return the very same reference.
    expect(getChainArmedItem()).toBe(first)
  })

  it('stops notifying after the returned unsubscribe is called', () => {
    const spy = vi.fn()
    const unsub = subscribeChainArmed(spy)

    setChainArmedItem({ name: 'A', color: '#111111' })
    expect(spy).toHaveBeenCalledTimes(1)

    unsub()

    setChainArmedItem({ name: 'B', color: '#222222' }) // real change, listener gone
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
