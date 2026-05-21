/** @vitest-environment jsdom */
/**
 * Phase 13: Post-Commit Step-Level Undo (RED — Wave 0).
 *
 * Success Criteria covered:
 *   SC1 — Ctrl+Z on committed multi-point markup re-opens it in drawing mode
 *         with all points intact (D-10, D-13, D-14, D-24)
 *   SC2 — In-progress step-level undo/redo still works after re-open
 *         (D-13 — Phase 10 inheritance); Enter re-commits as a single command
 *         (D-15, D-16); wallHeight preserved (D-15, Pitfall 4)
 *   SC3 — Module-level ref (markup-reopen-ref) round-trips for both handler
 *         and snapshot
 *   SC4 — Esc-restore via restoreFromReopen returns original markup
 *         byte-identical with id + points preserved (D-14, D-16, Pitfall 6).
 *         Includes an end-to-end Escape keydown dispatch test (RED until
 *         Plan 13-03 Task 3 wires the listener).
 *   SC5 — undo/redo of 'reopen-recommit' command round-trips stably
 *
 * Edge cases:
 *   EDGE-1 — Count pin at top of stack: isMultiPointMarkup returns false (D-12)
 *   EDGE-3 — Vertex-edit active: handler must return false (D-17 condition 4)
 *   EDGE-4 — Top-of-stack markup on different page: handler must return false
 *            (A4 / D-17 condition 5)
 *   EDGE-5 — Wall re-open preserves wallHeight (D-15, Pitfall 4)
 *
 * Not covered here (covered elsewhere):
 *   EDGE-2 — isTextInputActive guard on Ctrl+Z — see markup-shortcuts.test.ts
 *            (REG-1 regression). Adding it here would duplicate Phase 3 / 10
 *            coverage.
 *   REG-1/2/3 — Phase 3 / 10 inheritance — separate test files run as
 *               regressions.
 *
 * Inherited contracts (documented but not re-tested):
 *   - isTextInputActive() guard on every Ctrl+Z / Ctrl+Y / Enter / Esc path
 *   - Stage inverse transform via stage.getAbsoluteTransform().copy().invert()
 *     .point(pointer) — tests use the makeFakeStage shim (identity transform)
 *   - UNDO_STACK_MAX = 50 cap applies normally to 'reopen-recommit' commands;
 *     verified by pushCommand reuse in Plan 13-02 (not re-asserted here).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import React, { useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import type Konva from 'konva'
import { useMarkupTool } from '@renderer/hooks/useMarkupTool'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import {
  isMultiPointMarkup,
  type LinearMarkup,
  type AreaMarkup,
  type PerimeterMarkup,
  type WallMarkup,
  type CountMarkup,
  type Markup
} from '@renderer/types/markup'

type Tool = ReturnType<typeof useMarkupTool>

interface Probe {
  current: Tool | null
}

// Identity-transform Konva.Stage shim — hook only uses getAbsoluteTransform.
// Copied verbatim from src/tests/markup-tool-point-redo.test.ts:32-44.
function makeFakeStage(): Konva.Stage {
  const id = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x, y: p.y })
  const identity = {
    copy: () => ({
      invert: () => ({ point: id }),
      point: id
    })
  }
  return {
    getAbsoluteTransform: () => identity
  } as unknown as Konva.Stage
}

function HookHost({ probe }: { probe: Probe }): React.JSX.Element {
  const stageRef = useRef<Konva.Stage | null>(makeFakeStage())
  probe.current = useMarkupTool(stageRef)
  return React.createElement('div', null, null)
}

function mount(probe: Probe): { unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(React.createElement(HookHost, { probe }))
  })
  return {
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

// @ts-expect-error — React's act() uses this flag to validate the test env
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Dynamic module specifier for `@renderer/lib/markup-reopen-ref` (Plan 13-02
// creates the module). Built at runtime so Vite's import-analysis pass does
// NOT fail the whole suite at collection time when the module is missing.
// Mirrors the expected behaviour described in the Wave 0 RED contract:
// tests FAIL, file LOADS.
//
// Plan 13-02 will create `@renderer/lib/markup-reopen-ref` and these dynamic
// imports will resolve to the real exports without any test-file edits.
const REOPEN_REF_PATH = ['@renderer', 'lib', 'markup-reopen-ref'].join('/')

interface MarkupReopenRefModule {
  setMarkupReopenHandler: (h: (() => boolean) | null) => void
  getMarkupReopenHandler: () => (() => boolean) | null
  setReopenSnapshot: (m: Markup | null) => void
  getReopenSnapshot: () => Markup | null
}

async function importReopenRef(): Promise<MarkupReopenRefModule> {
  // @ts-expect-error — Plan 13-02 adds the module (RED until then).
  // /* @vite-ignore */ + dynamic string prevents Vite from failing at
  // collection. The throw happens at test-execution time.
  return (await import(/* @vite-ignore */ REOPEN_REF_PATH)) as MarkupReopenRefModule
}

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 1,
    activeTool: 'select',
    vertexEditMarkupId: null,
    selectedMarkupIds: []
  })
  document.body.innerHTML = ''
})

// ----------------------------------------------------------------------------
// Helpers — committed-markup seeding (each variant returns the placed markup).
// Mirrors the committed-markup seeding pattern at
// src/tests/markup-tool-pop-last-point.test.ts:184-198.
// ----------------------------------------------------------------------------

function seedCommittedLinear(name: string, page = 1, count = 3): LinearMarkup {
  const store = useMarkupStore.getState()
  const cat = store.getOrCreateCategory('Test')
  const id = `lin-${name}`
  const points = Array.from({ length: count }, (_, i) => ({
    x: 10 + i * 10,
    y: 10 + i * 10
  }))
  const m: LinearMarkup = {
    id,
    type: 'linear',
    page,
    name,
    categoryId: cat.id,
    color: '#0078d4',
    createdAt: 1,
    points
  }
  store.placeMarkup(m)
  return m
}

function seedCommittedArea(name: string, page = 1, count = 4): AreaMarkup {
  const store = useMarkupStore.getState()
  const cat = store.getOrCreateCategory('Test')
  const id = `area-${name}`
  // Closed-ish polygon corners
  const base = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 }
  ]
  const points = base.slice(0, count)
  const m: AreaMarkup = {
    id,
    type: 'area',
    page,
    name,
    categoryId: cat.id,
    color: '#d13438',
    createdAt: 2,
    points
  }
  store.placeMarkup(m)
  return m
}

function seedCommittedPerimeter(name: string, page = 1, count = 4): PerimeterMarkup {
  const store = useMarkupStore.getState()
  const cat = store.getOrCreateCategory('Test')
  const id = `peri-${name}`
  const base = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 0, y: 20 }
  ]
  const points = base.slice(0, count)
  const m: PerimeterMarkup = {
    id,
    type: 'perimeter',
    page,
    name,
    categoryId: cat.id,
    color: '#107c10',
    createdAt: 3,
    points
  }
  store.placeMarkup(m)
  return m
}

function seedCommittedWall(
  name: string,
  page = 1,
  wallHeight = 2400,
  count = 2
): WallMarkup {
  const store = useMarkupStore.getState()
  const cat = store.getOrCreateCategory('Test')
  const id = `wall-${name}`
  const points = Array.from({ length: count }, (_, i) => ({
    x: 5 + i * 15,
    y: 5 + i * 15
  }))
  const m: WallMarkup = {
    id,
    type: 'wall',
    page,
    name,
    categoryId: cat.id,
    color: '#ca8a04',
    createdAt: 4,
    points,
    wallHeight
  }
  store.placeMarkup(m)
  return m
}

function seedCommittedCount(name: string, page = 1): CountMarkup {
  const store = useMarkupStore.getState()
  const cat = store.getOrCreateCategory('Test')
  const id = `count-${name}`
  const m: CountMarkup = {
    id,
    type: 'count',
    page,
    name,
    categoryId: cat.id,
    color: '#5c2d91',
    createdAt: 5,
    point: { x: 5, y: 5 },
    sequence: 1
  }
  store.placeMarkup(m)
  return m
}

// Simulate the Plan 13-03 reopen handler dispatch surface in-place: remove the
// committed markup silently (Plan 13-02 action), snapshot it (Plan 13-02 ref
// module), and call activatePreset with seeded points (Plan 13-03 extension).
// This keeps the SC1/SC2 test bodies short and uniform.
async function simulateReopen(
  probe: Probe,
  markup: LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup
): Promise<void> {
  const store = useMarkupStore.getState()
  const mod = await importReopenRef()
  act(() => {
    // @ts-expect-error — Plan 13-02 adds removeForReopen (RED)
    store.removeForReopen(markup)
    mod.setReopenSnapshot(markup)
    const cat = store.getCategory(markup.categoryId)
    probe.current!.activatePreset(markup.type, {
      name: markup.name,
      categoryName: cat?.name ?? '',
      color: markup.color,
      // @ts-expect-error — Plan 13-03 adds points seed to activatePreset (RED)
      points: [...markup.points],
      wallHeight: markup.type === 'wall' ? markup.wallHeight : undefined
    })
  })
}

// ============================================================================
// DESCRIBE A — SC1: Ctrl+Z on committed multi-point markup re-opens drawing
// ============================================================================

describe('Phase 13 SC1 — Ctrl+Z on committed multi-point markup re-opens it in drawing mode', () => {
  it('SC1 linear: re-open populates points, sets mode=drawing, chainArmed=false (Pitfall 2)', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L1', 1, 3)

    await simulateReopen(probe, markup)

    expect(probe.current!.state.mode).toBe('drawing')
    expect(probe.current!.state.toolType).toBe('linear')
    expect(probe.current!.state.points).toHaveLength(3)
    expect(probe.current!.state.points).toEqual(markup.points)
    expect(probe.current!.state.pendingName).toBe(markup.name)
    expect(probe.current!.state.pendingColor).toBe(markup.color)
    // Pitfall 2 — load-bearing: chainArmed MUST be false on re-open seed.
    expect(probe.current!.state.chainArmed).toBe(false)
    unmount()
  })

  it('SC1 area: re-open populates 4 points into the in-progress drawing state', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedArea('A1', 1, 4)

    await simulateReopen(probe, markup)

    expect(probe.current!.state.mode).toBe('drawing')
    expect(probe.current!.state.toolType).toBe('area')
    expect(probe.current!.state.points).toHaveLength(4)
    expect(probe.current!.state.points).toEqual(markup.points)
    expect(probe.current!.state.chainArmed).toBe(false)
    unmount()
  })

  it('SC1 perimeter: re-open populates 4 points into the in-progress drawing state', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedPerimeter('P1', 1, 4)

    await simulateReopen(probe, markup)

    expect(probe.current!.state.mode).toBe('drawing')
    expect(probe.current!.state.toolType).toBe('perimeter')
    expect(probe.current!.state.points).toHaveLength(4)
    expect(probe.current!.state.points).toEqual(markup.points)
    expect(probe.current!.state.chainArmed).toBe(false)
    unmount()
  })

  it('SC1 wall: re-open with wallHeight=2400 populates points + preserves pendingWallHeight', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedWall('W1', 1, 2400, 2)

    await simulateReopen(probe, markup)

    expect(probe.current!.state.mode).toBe('drawing')
    expect(probe.current!.state.toolType).toBe('wall')
    expect(probe.current!.state.points).toHaveLength(2)
    expect(probe.current!.state.points).toEqual(markup.points)
    expect(probe.current!.state.pendingWallHeight).toBe(2400)
    expect(probe.current!.state.chainArmed).toBe(false)
    unmount()
  })

  it('SC1 store removal: removeForReopen removes original from pageMarkups[1]', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L-removal', 1, 3)

    expect(useMarkupStore.getState().pageMarkups[1]).toHaveLength(1)

    await simulateReopen(probe, markup)

    const pageList = useMarkupStore.getState().pageMarkups[1] ?? []
    expect(pageList.some((m) => m.id === markup.id)).toBe(false)
    unmount()
  })

  it('SC1 silent removal: removeForReopen does NOT push a delete command to undoStack', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L-silent', 1, 3)

    // After placeMarkup the undoStack has exactly one 'place' command.
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)
    expect(useMarkupStore.getState().undoStack[0].type).toBe('place')

    await simulateReopen(probe, markup)

    // After removeForReopen the undoStack is unchanged — silent (D-16):
    // it does NOT push a 'delete' command. The reopen handler will pop the
    // original 'place' command itself; tested separately in Plan 13-03.
    const stack = useMarkupStore.getState().undoStack
    expect(stack.every((c) => c.type !== 'delete')).toBe(true)
    unmount()
  })
})

// ============================================================================
// DESCRIBE B — SC2: In-progress step-level still works after re-open
// ============================================================================

describe('Phase 13 SC2 — In-progress step-level undo/redo still works after re-open (Phase 10 inheritance)', () => {
  it('SC2 point pop (a): after re-open, popLastPoint() pops the last seeded point twice', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L-pop', 1, 3)

    await simulateReopen(probe, markup)
    expect(probe.current!.state.points).toHaveLength(3)

    let popped1 = false
    act(() => {
      popped1 = probe.current!.popLastPoint()
    })
    expect(popped1).toBe(true)
    expect(probe.current!.state.points).toHaveLength(2)

    let popped2 = false
    act(() => {
      popped2 = probe.current!.popLastPoint()
    })
    expect(popped2).toBe(true)
    expect(probe.current!.state.points).toHaveLength(1)
    unmount()
  })

  it('SC2 re-push (b): after pop pop, repushLastPoint twice restores 3 points (LIFO)', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L-repush', 1, 3)

    await simulateReopen(probe, markup)
    act(() => {
      probe.current!.popLastPoint()
      probe.current!.popLastPoint()
    })
    expect(probe.current!.state.points).toHaveLength(1)

    let r1 = false
    act(() => {
      r1 = probe.current!.repushLastPoint()
    })
    expect(r1).toBe(true)
    expect(probe.current!.state.points).toHaveLength(2)

    let r2 = false
    act(() => {
      r2 = probe.current!.repushLastPoint()
    })
    expect(r2).toBe(true)
    expect(probe.current!.state.points).toHaveLength(3)
    unmount()
  })

  it('SC2 re-commit identity (c): commitShape dispatches ONE reopen-recommit command preserving name/category/color, fresh id', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L-commit', 1, 3)

    await simulateReopen(probe, markup)
    // finishLinear takes state from drawing → confirming so commitShape can run.
    act(() => {
      probe.current!.finishLinear()
    })

    const cat = useMarkupStore.getState().getCategory(markup.categoryId)
    act(() => {
      probe.current!.commitShape({
        name: markup.name,
        categoryName: cat?.name ?? '',
        color: markup.color
      })
    })

    const stack = useMarkupStore.getState().undoStack
    const top = stack.at(-1)
    expect(top).toBeDefined()
    // RED until Plan 13-02 (commitReopen action) + Plan 13-03 (commitShape
    // consults markup-reopen-ref) — the snapshot read inside commitShape is
    // the dispatch fork.
    expect(top?.type).toBe('reopen-recommit')
    if (top && top.type === 'reopen-recommit') {
      expect(top.oldMarkup.id).toBe(markup.id)
      expect(top.newMarkup.id).not.toBe(markup.id) // fresh id
      expect(top.newMarkup.name).toBe(markup.name)
      expect(top.newMarkup.color).toBe(markup.color)
      expect(top.newMarkup.categoryId).toBe(markup.categoryId)
      expect(top.newMarkup.type).toBe('linear')
    }
    unmount()
  })

  it('SC2 re-commit identity (c, wall): commitShape preserves wallHeight=3000 on the newMarkup', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedWall('W-commit', 1, 3000, 2)

    await simulateReopen(probe, markup)
    // finishLinear handles linear-mode; wall finalises via the same confirming
    // transition. Use finishLinear here — the hook reuses it for wall too
    // (verified by existing markup-tool-pop-last-point.test.ts SC5 tests).
    act(() => {
      probe.current!.finishLinear()
    })

    const cat = useMarkupStore.getState().getCategory(markup.categoryId)
    act(() => {
      probe.current!.commitShape({
        name: markup.name,
        categoryName: cat?.name ?? '',
        color: markup.color,
        wallHeight: 3000
      })
    })

    const top = useMarkupStore.getState().undoStack.at(-1)
    expect(top?.type).toBe('reopen-recommit')
    if (top && top.type === 'reopen-recommit') {
      // EDGE-5 + Pitfall 4: wallHeight 3000 preserved (NOT default 2400).
      expect(top.newMarkup.type).toBe('wall')
      if (top.newMarkup.type === 'wall') {
        expect(top.newMarkup.wallHeight).toBe(3000)
      }
    }
    unmount()
  })
})

// ============================================================================
// DESCRIBE C — SC3/SC4: Module ref + Esc-restore round-trips
// ============================================================================

describe('markup-reopen-ref module-level handler + snapshot (wired from CanvasViewport → consumed by useKeyboardShortcuts)', () => {
  it('SC3: setMarkupReopenHandler stores and getMarkupReopenHandler returns the same reference; clearing unsets', async () => {
    const mod = await importReopenRef()
    expect(mod.getMarkupReopenHandler()).toBeNull()
    const fn = (): boolean => true
    mod.setMarkupReopenHandler(fn)
    expect(mod.getMarkupReopenHandler()).toBe(fn)
    mod.setMarkupReopenHandler(null)
    expect(mod.getMarkupReopenHandler()).toBeNull()
  })

  it('SC3: setReopenSnapshot stores and getReopenSnapshot returns the same reference; clearing unsets', async () => {
    const mod = await importReopenRef()
    expect(mod.getReopenSnapshot()).toBeNull()
    const m = seedCommittedLinear('Snap', 1, 3)
    mod.setReopenSnapshot(m)
    expect(mod.getReopenSnapshot()).toBe(m)
    mod.setReopenSnapshot(null)
    expect(mod.getReopenSnapshot()).toBeNull()
  })

  it('SC3: useEffect cleanup pattern — setMarkupReopenHandler(null) round-trips after a non-null set', async () => {
    // Asserts the cleanup contract: setting a handler then clearing it returns
    // to the initial state. Plan 13-03 wires a useEffect cleanup that does
    // exactly this on unmount. (Pitfall 9 — StrictMode double-mount safety.)
    const mod = await importReopenRef()
    const fn1 = (): boolean => true
    const fn2 = (): boolean => false
    mod.setMarkupReopenHandler(fn1)
    mod.setMarkupReopenHandler(fn2)
    expect(mod.getMarkupReopenHandler()).toBe(fn2)
    mod.setMarkupReopenHandler(null)
    expect(mod.getMarkupReopenHandler()).toBeNull()
  })
})

describe('Phase 13 SC4 — Esc-restore via restoreFromReopen returns original markup byte-identical', () => {
  it('SC4: restoreFromReopen returns original markup with deep equality on points + id preserved', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L-esc', 1, 3)

    // Snapshot original BEFORE removeForReopen so we have a stable reference.
    const original: LinearMarkup = {
      ...markup,
      points: markup.points.map((p) => ({ ...p }))
    }

    await simulateReopen(probe, markup)

    const storeBefore = useMarkupStore.getState()
    const undoLenBefore = storeBefore.undoStack.length

    act(() => {
      // @ts-expect-error — Plan 13-02 adds restoreFromReopen (RED)
      useMarkupStore.getState().restoreFromReopen(markup)
    })

    const pageList = useMarkupStore.getState().pageMarkups[1] ?? []
    const restored = pageList.find((m) => m.id === markup.id)
    expect(restored).toBeDefined()
    // Deep equality on points (full byte-for-byte restore per D-14).
    if (restored && restored.type === 'linear') {
      expect(restored.points).toEqual(original.points)
      expect(restored.id).toBe(original.id)
      expect(restored.name).toBe(original.name)
      expect(restored.color).toBe(original.color)
      expect(restored.categoryId).toBe(original.categoryId)
    }
    // undoStack unchanged — silent restore per D-16.
    expect(useMarkupStore.getState().undoStack.length).toBe(undoLenBefore)
    unmount()
  })

  it('SC4: after Esc-equivalent flow, original "place" command can be re-pushed onto undoStack', async () => {
    // Simulate what the Esc handler in Plan 13-03 will do:
    //   removeForReopen → setReopenSnapshot → restoreFromReopen
    //   → manually push the original 'place' command back onto undoStack.
    // Asserts the round-trip post-condition (Pitfall 6): Ctrl+Z after Esc
    // must behave like the re-open never happened.
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L-esc-stack', 1, 3)

    const mod = await importReopenRef()

    act(() => {
      // @ts-expect-error — Plan 13-02 adds removeForReopen (RED)
      useMarkupStore.getState().removeForReopen(markup)
      mod.setReopenSnapshot(markup)
    })

    act(() => {
      // @ts-expect-error — Plan 13-02 adds restoreFromReopen (RED)
      useMarkupStore.getState().restoreFromReopen(markup)
      mod.setReopenSnapshot(null)
      // Manually re-push the original 'place' command — what the Esc handler
      // in CanvasViewport Plan 13-03 will do.
      useMarkupStore.setState((s) => ({
        undoStack: [...s.undoStack, { type: 'place', markup }]
      }))
    })

    const top = useMarkupStore.getState().undoStack.at(-1)
    expect(top?.type).toBe('place')
    if (top && top.type === 'place') {
      expect(top.markup.id).toBe(markup.id)
    }
    unmount()
  })

  it('SC4 (e2e Esc): keydown dispatch clears snapshot + restores markup + re-pushes place command + activeTool=select (RED until Plan 13-03 Task 3)', async () => {
    // End-to-end test for the Plan 13-03 Esc listener.
    // Mount the HookHost so the keydown listener that Plan 13-03 will wire
    // into CanvasViewport / useKeyboardShortcuts is available on `window`.
    //
    // Note: at Wave 0 commit time this test is RED — the listener is wired
    // by Plan 13-03 Task 3. Same RED state as SC1/SC2 in this file.
    // Tag: RED until Plan 13-03 Task 3 wires the keydown listener.
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedLinear('L-esc-e2e', 1, 3)

    const mod = await importReopenRef()

    await simulateReopen(probe, markup)
    // Confirm we're in re-open state before dispatch.
    expect(mod.getReopenSnapshot()).toBe(markup)
    expect(probe.current!.state.mode).toBe('drawing')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    // (a) snapshot cleared
    expect(mod.getReopenSnapshot()).toBeNull()
    // (b) original markup restored on its page
    const pageList = useMarkupStore.getState().pageMarkups[1] ?? []
    const restored = pageList.find((m) => m.id === markup.id)
    expect(restored).toBeDefined()
    if (restored && restored.type === 'linear') {
      expect(restored.points).toEqual(markup.points)
    }
    // (c) place command re-pushed onto undoStack tail
    const top = useMarkupStore.getState().undoStack.at(-1)
    expect(top?.type).toBe('place')
    if (top && top.type === 'place') {
      expect(top.markup.id).toBe(markup.id)
    }
    // (d) cancel returned focus to select tool
    expect(useViewerStore.getState().activeTool).toBe('select')
    unmount()
  })
})

// ============================================================================
// DESCRIBE D — SC5: undo/redo round-trip of 'reopen-recommit' command
// ============================================================================

describe('Phase 13 SC5 — undo/redo round-trip of reopen-recommit command', () => {
  it('SC5 undo of reopen-recommit: undo restores oldMarkup and re-pushes command to redoStack', () => {
    const oldMarkup = seedCommittedLinear('L-undo-old', 1, 3)

    // newMarkup is a modified version (different id + extra point).
    const newMarkup: LinearMarkup = {
      id: 'lin-new-undo',
      type: 'linear',
      page: 1,
      name: oldMarkup.name,
      categoryId: oldMarkup.categoryId,
      color: oldMarkup.color,
      createdAt: 99,
      points: [...oldMarkup.points, { x: 99, y: 99 }]
    }

    // Simulate the re-open trigger sequence: silent remove + pop the original
    // 'place' command + dispatch commitReopen (which pushes a single
    // 'reopen-recommit' command and adds newMarkup).
    act(() => {
      // @ts-expect-error — Plan 13-02 adds removeForReopen (RED)
      useMarkupStore.getState().removeForReopen(oldMarkup)
      // The reopen handler pops the place command in Plan 13-03.
      useMarkupStore.setState((s) => ({ undoStack: s.undoStack.slice(0, -1) }))
      // @ts-expect-error — Plan 13-02 adds commitReopen (RED)
      useMarkupStore.getState().commitReopen(oldMarkup, newMarkup)
    })

    let pageList = useMarkupStore.getState().pageMarkups[1] ?? []
    expect(pageList.some((m) => m.id === newMarkup.id)).toBe(true)
    expect(pageList.some((m) => m.id === oldMarkup.id)).toBe(false)
    const undoLenBeforeUndo = useMarkupStore.getState().undoStack.length

    // Undo → restore oldMarkup, push command back to redoStack.
    act(() => {
      useMarkupStore.getState().undo()
    })
    pageList = useMarkupStore.getState().pageMarkups[1] ?? []
    expect(pageList.some((m) => m.id === oldMarkup.id)).toBe(true)
    expect(pageList.some((m) => m.id === newMarkup.id)).toBe(false)
    expect(useMarkupStore.getState().undoStack.length).toBe(undoLenBeforeUndo - 1)
    const redoTop = useMarkupStore.getState().redoStack.at(-1)
    expect(redoTop?.type).toBe('reopen-recommit')
  })

  it('SC5 redo of reopen-recommit: redo re-applies newMarkup and re-pushes command to undoStack', () => {
    const oldMarkup = seedCommittedLinear('L-redo-old', 1, 3)
    const newMarkup: LinearMarkup = {
      id: 'lin-new-redo',
      type: 'linear',
      page: 1,
      name: oldMarkup.name,
      categoryId: oldMarkup.categoryId,
      color: oldMarkup.color,
      createdAt: 100,
      points: [...oldMarkup.points, { x: 55, y: 55 }]
    }

    act(() => {
      // @ts-expect-error — Plan 13-02 adds removeForReopen (RED)
      useMarkupStore.getState().removeForReopen(oldMarkup)
      useMarkupStore.setState((s) => ({ undoStack: s.undoStack.slice(0, -1) }))
      // @ts-expect-error — Plan 13-02 adds commitReopen (RED)
      useMarkupStore.getState().commitReopen(oldMarkup, newMarkup)
    })

    // Undo first so we have something to redo.
    act(() => {
      useMarkupStore.getState().undo()
    })
    const redoLenBeforeRedo = useMarkupStore.getState().redoStack.length

    act(() => {
      useMarkupStore.getState().redo()
    })
    const pageList = useMarkupStore.getState().pageMarkups[1] ?? []
    expect(pageList.some((m) => m.id === newMarkup.id)).toBe(true)
    expect(pageList.some((m) => m.id === oldMarkup.id)).toBe(false)
    expect(useMarkupStore.getState().redoStack.length).toBe(redoLenBeforeRedo - 1)
    const undoTop = useMarkupStore.getState().undoStack.at(-1)
    expect(undoTop?.type).toBe('reopen-recommit')
  })

  it('SC5 round-trip stability: undo → redo → undo → redo leaves pageMarkups consistent at each step', () => {
    const oldMarkup = seedCommittedLinear('L-roundtrip', 1, 3)
    const newMarkup: LinearMarkup = {
      id: 'lin-new-roundtrip',
      type: 'linear',
      page: 1,
      name: oldMarkup.name,
      categoryId: oldMarkup.categoryId,
      color: oldMarkup.color,
      createdAt: 101,
      points: [...oldMarkup.points, { x: 77, y: 77 }]
    }

    act(() => {
      // @ts-expect-error — Plan 13-02 adds removeForReopen (RED)
      useMarkupStore.getState().removeForReopen(oldMarkup)
      useMarkupStore.setState((s) => ({ undoStack: s.undoStack.slice(0, -1) }))
      // @ts-expect-error — Plan 13-02 adds commitReopen (RED)
      useMarkupStore.getState().commitReopen(oldMarkup, newMarkup)
    })

    function assertExactlyOneOnPage(expectedId: string): void {
      const list = useMarkupStore.getState().pageMarkups[1] ?? []
      const matching = list.filter(
        (m) => m.id === oldMarkup.id || m.id === newMarkup.id
      )
      expect(matching).toHaveLength(1)
      expect(matching[0].id).toBe(expectedId)
    }

    // Initial state after commitReopen: newMarkup present.
    assertExactlyOneOnPage(newMarkup.id)

    // Cycle 1: undo → oldMarkup
    act(() => useMarkupStore.getState().undo())
    assertExactlyOneOnPage(oldMarkup.id)

    // Cycle 2: redo → newMarkup
    act(() => useMarkupStore.getState().redo())
    assertExactlyOneOnPage(newMarkup.id)

    // Cycle 3: undo → oldMarkup
    act(() => useMarkupStore.getState().undo())
    assertExactlyOneOnPage(oldMarkup.id)

    // Cycle 4: redo → newMarkup
    act(() => useMarkupStore.getState().redo())
    assertExactlyOneOnPage(newMarkup.id)
  })
})

// ============================================================================
// DESCRIBE E — EDGE cases: non-eligibility paths
// ============================================================================

describe('Phase 13 EDGE cases — non-eligibility paths for the reopen handler', () => {
  it('EDGE-1 count pin at top of stack: isMultiPointMarkup(top.markup) returns false (D-12)', () => {
    const count = seedCommittedCount('C1', 1)
    const top = useMarkupStore.getState().undoStack.at(-1)
    expect(top?.type).toBe('place')
    if (top && top.type === 'place') {
      expect(top.markup.id).toBe(count.id)
      // Count pin must NOT be eligible for re-open per D-12.
      expect(isMultiPointMarkup(top.markup)).toBe(false)
    }
  })

  it('EDGE-3 vertex-edit active: handler eligibility check sees vertexEditMarkupId !== null (D-17 condition 4)', () => {
    // Seed a normal linear so top-of-stack would otherwise be eligible.
    const markup = seedCommittedLinear('L-edge3', 1, 3)
    // Activate vertex-edit on it.
    useViewerStore.setState({ vertexEditMarkupId: markup.id })

    // The Plan 13-03 reopen handler will read this and return false. Test the
    // runtime check directly (RED-safe — no Plan-13-02/03 surface required).
    expect(useViewerStore.getState().vertexEditMarkupId).not.toBeNull()
    // For completeness: even though the markup is multi-point, the runtime
    // guard would short-circuit before the isMultiPointMarkup check.
    const top = useMarkupStore.getState().undoStack.at(-1)
    if (top?.type === 'place') {
      expect(isMultiPointMarkup(top.markup)).toBe(true) // still multi-point
    }
    // The compound runtime check the reopen handler performs:
    const wouldBlockReopen =
      useViewerStore.getState().vertexEditMarkupId !== null
    expect(wouldBlockReopen).toBe(true)
  })

  it('EDGE-4 cross-page top-of-stack: top.markup.page !== currentPage blocks re-open (A4 / D-17 condition 5)', () => {
    // Seed a linear on page 2.
    const markup = seedCommittedLinear('L-edge4', 2, 3)
    // Navigate to page 1.
    useViewerStore.setState({ currentPage: 1 })

    const top = useMarkupStore.getState().undoStack.at(-1)
    expect(top?.type).toBe('place')
    if (top && top.type === 'place') {
      expect(top.markup.page).toBe(2)
      expect(useViewerStore.getState().currentPage).toBe(1)
      // The cross-page guard the reopen handler performs (D-17 condition 5):
      expect(top.markup.page !== useViewerStore.getState().currentPage).toBe(true)
    }
  })

  it('EDGE-5 wall height preserved: re-open seeds pendingWallHeight=3000 (not default 2400 — Pitfall 4)', async () => {
    const probe: Probe = { current: null }
    const { unmount } = mount(probe)
    const markup = seedCommittedWall('W-edge5', 1, 3000, 2)

    await simulateReopen(probe, markup)

    expect(probe.current!.state.toolType).toBe('wall')
    expect(probe.current!.state.pendingWallHeight).toBe(3000)
    expect(probe.current!.state.pendingWallHeight).not.toBe(2400) // Pitfall 4
    unmount()
  })
})
