# Phase 10: Granular Undo Foundation — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 5 (4 modified, 1 new)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/lib/markup-undo-ref.ts` | utility | event-driven | self (extend existing) | exact |
| `src/renderer/src/hooks/useMarkupTool.ts` | hook | event-driven | self (extend existing) | exact |
| `src/renderer/src/hooks/useKeyboardShortcuts.ts` | hook | event-driven | self (extend existing) | exact |
| `src/renderer/src/components/CanvasViewport.tsx` | component | event-driven | self (extend existing) | exact |
| `src/tests/markup-tool-point-redo.test.ts` | test | — | `src/tests/markup-tool-pop-last-point.test.ts` | exact |

---

## Pattern Assignments

### `src/renderer/src/lib/markup-undo-ref.ts` (utility, event-driven)

**Analog:** self — extend with parallel redo pair

**Existing full file** (lines 1-23):
```typescript
/**
 * Module-level ref for the in-progress markup undo handler.
 *
 * CanvasViewport registers a handler here while it is mounted. That handler
 * returns `true` when a vertex was popped from an in-progress polyline or
 * polygon (meaning the caller should treat Ctrl+Z as handled) and `false`
 * when no drawing is in progress (caller should fall through to the
 * committed-markup undo stack).
 *
 * Lives in its own module to avoid a circular import between
 * `useKeyboardShortcuts` and `CanvasViewport` (the former reads the handler,
 * the latter imports the former).
 */

let _markupUndoHandler: (() => boolean) | null = null

export function setMarkupUndoHandler(handler: (() => boolean) | null): void {
  _markupUndoHandler = handler
}

export function getMarkupUndoHandler(): (() => boolean) | null {
  return _markupUndoHandler
}
```

**What to add** — mirror the undo pair exactly, appended after line 23:
```typescript
let _markupRedoHandler: (() => boolean) | null = null

export function setMarkupRedoHandler(handler: (() => boolean) | null): void {
  _markupRedoHandler = handler
}

export function getMarkupRedoHandler(): (() => boolean) | null {
  return _markupRedoHandler
}
```

**Key invariant:** The module-level variable pattern, JSDoc style, function name symmetry (`set`/`get` prefix), and `null` sentinel type are identical to the undo pair. Copy verbatim, substitute `Undo` → `Redo`.

---

### `src/renderer/src/hooks/useMarkupTool.ts` (hook, event-driven)

**Analog:** self — three targeted extensions within the existing file

#### Extension 1: `MarkupDrawState` interface — add `redoPoints` field

**Existing interface** (lines 16-31):
```typescript
export interface MarkupDrawState {
  mode: 'idle' | 'naming' | 'drawing' | 'confirming' | 'placing'
  toolType: 'count' | 'linear' | 'area' | 'perimeter' | 'wall' | null
  points: StagePoint[]
  previewPoint: StagePoint | null
  popupScreenPos: { x: number; y: number } | null
  pendingName: string
  pendingCategoryName: string
  pendingColor: string
  pendingPage: number | null
  errorToast: string | null
  chainArmed: boolean
  pendingWallHeight: number
}
```

**What to add** — append one field before the closing brace:
```typescript
  /** Points popped by Ctrl+Z during an in-progress draw; cleared on new recordClick */
  redoPoints: StagePoint[]
```

**`INITIAL_STATE`** (lines 33-46) — add matching reset:
```typescript
const INITIAL_STATE: MarkupDrawState = {
  mode: 'idle',
  toolType: null,
  points: [],
  previewPoint: null,
  popupScreenPos: null,
  pendingName: '',
  pendingCategoryName: '',
  pendingColor: MARKUP_PALETTE[0],
  pendingPage: null,
  errorToast: null,
  chainArmed: false,
  pendingWallHeight: 2400,
  redoPoints: []          // NEW
}
```

#### Extension 2: `UseMarkupToolReturn` interface — add `repushLastPoint`

**Existing interface** (lines 64-81):
```typescript
export interface UseMarkupToolReturn {
  state: MarkupDrawState
  activate: (tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall') => void
  cancel: () => void
  recordClick: (screenPos: { x: number; y: number }) => void
  updatePreview: (screenPos: { x: number; y: number }) => void
  finishLinear: () => void
  finishPolygon: () => void
  commitCountName: (payload: { name: string; categoryName: string; color: string }) => void
  commitShape: (payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => void
  dismissError: () => void
  popLastPoint: () => boolean
}
```

**What to add** — one line after `popLastPoint`:
```typescript
  repushLastPoint: () => boolean
```

#### Extension 3: `popLastPoint` — extend with auto-cancel on one-point pop + redoPoints push

**Existing implementation** (lines 356-365):
```typescript
const popLastPoint = useCallback((): boolean => {
  const current = stateRef.current
  if (current.mode !== 'drawing') return false
  if (current.points.length === 0) return false
  setState((prev) => {
    if (prev.mode !== 'drawing' || prev.points.length === 0) return prev
    return { ...prev, points: prev.points.slice(0, -1), previewPoint: null }
  })
  return true
}, [])
```

**Replacement** — the double-guard pattern (stateRef outer check, prev inner check) is the established pattern; preserve it. Add the one-point path BEFORE entering setState (critical: no nested setState):
```typescript
const popLastPoint = useCallback((): boolean => {
  const current = stateRef.current
  if (current.mode !== 'drawing') return false
  if (current.points.length === 0) return false
  // SC3: popping the first point exits the tool entirely (same as Escape)
  if (current.points.length === 1) {
    cancel()
    return true
  }
  setState((prev) => {
    if (prev.mode !== 'drawing' || prev.points.length === 0) return prev
    const popped = prev.points[prev.points.length - 1]
    return {
      ...prev,
      points: prev.points.slice(0, -1),
      previewPoint: null,
      redoPoints: [popped, ...prev.redoPoints]   // push front → LIFO repush
    }
  })
  return true
}, [cancel])
```

**Critical pitfall:** The `[cancel]` dependency must be added because the one-point branch calls `cancel()`. The existing `[]` dep array is no longer correct once `cancel` is called from within.

#### Extension 4: `repushLastPoint` — new useCallback (add after `popLastPoint`)

**Pattern source:** mirrors `popLastPoint` exactly — stateRef outer guard, prev inner guard, opposite stack direction:
```typescript
const repushLastPoint = useCallback((): boolean => {
  const current = stateRef.current
  if (current.mode !== 'drawing') return false
  if (current.redoPoints.length === 0) return false
  setState((prev) => {
    if (prev.mode !== 'drawing' || prev.redoPoints.length === 0) return prev
    const [next, ...remaining] = prev.redoPoints
    return {
      ...prev,
      points: [...prev.points, next],
      previewPoint: null,
      redoPoints: remaining
    }
  })
  return true
}, [])
```

#### Extension 5: `recordClick` setState updater — clear `redoPoints` on new placement

**Existing updater return** (lines 184-188) — the linear/area/perimeter/wall branch:
```typescript
return {
  ...prev,
  points: [...prev.points, stagePoint],
  pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage
}
```

**What to add** — one new key:
```typescript
return {
  ...prev,
  points: [...prev.points, stagePoint],
  pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage,
  redoPoints: []    // NEW: new placement invalidates in-progress redo history
}
```

#### Extension 6: return object — add `repushLastPoint`

**Existing return** (lines 367-379):
```typescript
return {
  state,
  activate,
  cancel,
  recordClick,
  updatePreview,
  finishLinear,
  finishPolygon,
  commitCountName,
  commitShape,
  dismissError,
  popLastPoint
}
```

**What to add** — one entry:
```typescript
  repushLastPoint
```

---

### `src/renderer/src/hooks/useKeyboardShortcuts.ts` (hook, event-driven)

**Analog:** self — extend the Ctrl+Y branch (lines 114-119)

**Existing Ctrl+Y dispatch** (lines 114-119):
```typescript
if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
  if (isTextInputActive()) return
  e.preventDefault()
  useMarkupStore.getState().redo()
  return
}
```

**Required import addition** — line 4 (after `getMarkupUndoHandler` import):
```typescript
import { getMarkupUndoHandler, getMarkupRedoHandler } from '../lib/markup-undo-ref'
```

**Replacement for lines 114-119** — mirror the Ctrl+Z pattern exactly:
```typescript
if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
  if (isTextInputActive()) return
  e.preventDefault()
  // Prefer in-progress vertex redo before falling through to committed-markup redo
  const handledByDraw = getMarkupRedoHandler()?.() ?? false
  if (!handledByDraw) {
    useMarkupStore.getState().redo()
  }
  return
}
```

**Structural invariant to copy:** The `isTextInputActive()` guard comes first, then `e.preventDefault()`, then the handler check, then the fallthrough — identical ordering to the Ctrl+Z block (lines 92-112).

---

### `src/renderer/src/components/CanvasViewport.tsx` (component, event-driven)

**Analog:** self — extend the undo-handler useEffect wiring (lines 273-281)

**Existing undo wiring** (lines 273-281):
```typescript
// Expose the mid-draw undo handler via a module-level ref so useKeyboardShortcuts
// can prefer it over the committed-markup undo stack while a polyline/polygon is
// being drawn. Returns true when a vertex was popped, false otherwise.
useEffect(() => {
  setMarkupUndoHandler(popLastPoint)
  return () => {
    setMarkupUndoHandler(null)
  }
}, [popLastPoint])
```

**Required import addition** — extend line 27:
```typescript
import { setMarkupUndoHandler, setMarkupRedoHandler } from '../lib/markup-undo-ref'
```

**Destructuring addition** — extend line 270 (add `repushLastPoint` to the `useMarkupTool` destructure):
```typescript
    repushLastPoint
```

**New useEffect to add** — immediately after the existing undo useEffect, using the same structure verbatim:
```typescript
useEffect(() => {
  setMarkupRedoHandler(repushLastPoint)
  return () => {
    setMarkupRedoHandler(null)
  }
}, [repushLastPoint])
```

**Key invariants:** one `useEffect` per handler (not combined), cleanup calls the setter with `null`, dep array contains only the handler function. Copy the undo useEffect pattern exactly, substitute `Undo` → `Redo` and `popLastPoint` → `repushLastPoint`.

---

### `src/tests/markup-tool-point-redo.test.ts` (test, NEW)

**Analog:** `src/tests/markup-tool-pop-last-point.test.ts` — copy the entire scaffolding

**Full scaffolding to copy** (lines 1-67 of pop-last-point test):
```typescript
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import React, { useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import type Konva from 'konva'
import { useMarkupTool } from '@renderer/hooks/useMarkupTool'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'

type Tool = ReturnType<typeof useMarkupTool>

interface Probe {
  current: Tool | null
}

// Identity-transform Konva.Stage shim — hook only uses getAbsoluteTransform.
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

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  useViewerStore.setState({ currentPage: 1, totalPages: 1, activeTool: 'select' })
  document.body.innerHTML = ''
})
```

**Test cases to implement** (Success Criteria 1-5):

```typescript
describe('repushLastPoint / Ctrl+Y in-progress redo (SC1-SC5)', () => {

  // SC1: popLastPoint still works with redoPoints tracking (regression guard)
  it('SC1 — popLastPoint returns true and removes last vertex (regression)', () => { ... })

  // SC2: repushLastPoint re-adds the most recently popped point
  it('SC2 — repushLastPoint after pop re-adds the popped vertex', () => {
    // activate('linear'), recordClick x3, popLastPoint() → points.length===2
    // repushLastPoint() → true, points.length===3, last point restored
  })

  // SC2: redo stack is LIFO — pop p3, pop p2, repush → p2, repush → p3
  it('SC2 — multiple pops and repushes are navigable LIFO', () => { ... })

  // SC3: popping the first (only) point calls cancel, mode returns to idle
  it('SC3 — Ctrl+Z on first point cancels markup and resets to idle', () => {
    // activate('linear'), recordClick x1, popLastPoint() → true
    // state.mode === 'idle', state.points.length === 0
  })

  // SC2+SC5: redoPoints cleared when new point is placed after a pop
  it('SC2 — new click after pop clears redoPoints (no stale repush)', () => {
    // activate, click x3, pop → redoPoints.length===1
    // click new point → redoPoints.length===0
    // repushLastPoint() → false
  })

  // SC5: repushLastPoint is tool-type-agnostic (area, perimeter, wall)
  it('SC5 — repushLastPoint works for area tool', () => { ... })
  it('SC5 — repushLastPoint works for perimeter tool', () => { ... })
  it('SC5 — repushLastPoint works for wall tool', () => { ... })

  // SC4 regression guard: repushLastPoint does NOT touch committed markups
  it('SC4 — repushLastPoint does not touch committed markups', () => { ... })

  // SC2: repushLastPoint returns false when redoPoints is empty
  it('returns false when no popped points to repush', () => { ... })

  // SC2: repushLastPoint returns false when not in drawing mode
  it('returns false when not in drawing mode', () => { ... })
})
```

**Test structure invariants from the analog:**
- Each `it` block creates its own `probe` and calls `mount(probe)` / `unmount()`
- Mutations inside hook methods are wrapped in `act(() => { ... })`
- Return value assertions use `toBe(true)` / `toBe(false)` directly in `act`
- State shape assertions use `toHaveLength(n)` and `toMatchObject({ x, y })`
- The `markup-undo-ref` module-level redo ref can be tested with a dynamic `import()` (same as the undo-ref test at lines 219-231 of the pop-last-point test)

---

## Shared Patterns

### Pattern: stateRef double-guard
**Source:** `src/renderer/src/hooks/useMarkupTool.ts` lines 356-365 (popLastPoint)
**Apply to:** `repushLastPoint` in `useMarkupTool.ts`

The double-guard ensures correctness under React StrictMode's double-invoke of setState updaters and stateRef lag:
1. Check `stateRef.current` outside setState — fast early exit, avoids scheduling a no-op setState
2. Check `prev` inside the setState updater — authoritative gate, correct even if stateRef is one render behind

```typescript
// Outer guard (stateRef — fast path)
const current = stateRef.current
if (current.mode !== 'drawing') return false
if (current.<stack>.length === 0) return false
// Inner guard (setState updater — authoritative)
setState((prev) => {
  if (prev.mode !== 'drawing' || prev.<stack>.length === 0) return prev
  // ... mutation
})
return true
```

### Pattern: Module-level nullable handler ref
**Source:** `src/renderer/src/lib/markup-undo-ref.ts` (full file)
**Apply to:** redo pair additions in same file, CanvasViewport useEffect wiring, useKeyboardShortcuts dispatch

```typescript
let _handler: (() => boolean) | null = null
export function setHandler(handler: (() => boolean) | null): void {
  _handler = handler
}
export function getHandler(): (() => boolean) | null {
  return _handler
}
```

### Pattern: useEffect per handler with null cleanup
**Source:** `src/renderer/src/components/CanvasViewport.tsx` lines 276-281
**Apply to:** redo handler registration in CanvasViewport

```typescript
useEffect(() => {
  setMarkupUndoHandler(popLastPoint)
  return () => {
    setMarkupUndoHandler(null)
  }
}, [popLastPoint])
```

### Pattern: Ctrl+Z keyboard dispatch with handler-ref fallthrough
**Source:** `src/renderer/src/hooks/useKeyboardShortcuts.ts` lines 92-112
**Apply to:** Ctrl+Y extension (lines 114-119)

```typescript
// isTextInputActive guard first
// e.preventDefault() second
// handler check with fallthrough third
const handledByDraw = getMarkupUndoHandler()?.() ?? false
if (!handledByDraw) {
  // committed-markup fallthrough
}
```

### Pattern: test HookHost/probe/mount scaffold
**Source:** `src/tests/markup-tool-pop-last-point.test.ts` lines 1-78
**Apply to:** `src/tests/markup-tool-point-redo.test.ts` (copy verbatim)

The HookHost/probe pattern is the established way to test a React hook in jsdom without rendering a full component tree. It must be used as-is for all `useMarkupTool` tests.

---

## No Analog Found

None. All five files have exact analogs in the codebase. Phase 10 is purely additive to existing patterns — no new patterns are introduced.

---

## Metadata

**Analog search scope:** `src/renderer/src/hooks/`, `src/renderer/src/lib/`, `src/renderer/src/components/`, `src/tests/`
**Files scanned:** 5 primary + 1 test analog
**Pattern extraction date:** 2026-05-19
