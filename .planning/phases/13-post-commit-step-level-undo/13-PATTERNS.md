# Phase 13: Post-Commit Step-Level Undo — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 8 (7 production surfaces + 1 new test file)
**Analogs found:** 8 / 8 (all surfaces have an exact in-repo analog from Phases 3, 7.1, 8, 9, 10, 12)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/types/markup.ts` (modify) | types | n/a — type union extension | self — `MarkupCommand` union already in file; mirror `move-markups` variant shape | exact |
| `src/renderer/src/lib/markup-reopen-ref.ts` (new) | renderer-lib (module ref) | event-driven (handler + snapshot bridge) | `src/renderer/src/lib/markup-undo-ref.ts` | exact |
| `src/renderer/src/stores/markupStore.ts` (modify) | renderer-store | command-pattern CRUD on undo/redo stacks | self — `move-markups` undo/redo branches at lines 404-421 and 519-536 | exact (in-file analog) |
| `src/renderer/src/hooks/useMarkupTool.ts` (modify) | renderer-hook | state-machine extension | self — `activatePreset` at lines 119-148; `commitShape` at lines 309-390 | exact (in-file analog) |
| `src/renderer/src/hooks/useKeyboardShortcuts.ts` (modify) | renderer-hook | event-driven dispatch | self — Ctrl+Z block at lines 92-112 (in-file insertion between line 95 and 102) | exact (in-file analog) |
| `src/renderer/src/components/CanvasViewport.tsx` (modify) | renderer-component | event-driven + ref handoff | self — `setMarkupUndoHandler` registration at lines 315-327; Esc handler at lines 638-668; page-nav cleanup at line 605 | exact (in-file analog) |
| `src/renderer/src/App.tsx` (modify) | renderer-component | state + lifecycle effect | self — `saveToast` state (line 82) + `useEffect` (122-126) + JSX block (317-339); `exportToast` (lines 93, 128-132, 341+) | exact (in-file analog) |
| `src/tests/markup-post-commit-reopen.test.ts` (new) | test | unit (jsdom + react-konva probe) | `src/tests/markup-tool-point-redo.test.ts` + `src/tests/markup-tool-pop-last-point.test.ts` | exact |

---

## Pattern Assignments

### 1. `src/renderer/src/lib/markup-reopen-ref.ts` (NEW — renderer-lib, event-driven)

**Analog:** `src/renderer/src/lib/markup-undo-ref.ts` (entire file, 33 lines, verified)

**Full file pattern to copy** (`markup-undo-ref.ts:1-33`):

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

let _markupRedoHandler: (() => boolean) | null = null

export function setMarkupRedoHandler(handler: (() => boolean) | null): void {
  _markupRedoHandler = handler
}

export function getMarkupRedoHandler(): (() => boolean) | null {
  return _markupRedoHandler
}
```

**What to copy:**
- Module-level `let _x: (() => boolean) | null = null` pattern (NOT React state, NOT Zustand)
- `setX(handler | null)` / `getX()` pair shape
- JSDoc explaining the circular-import avoidance rationale

**Phase 13 additions (NEW exports — same shape):**
- `setMarkupReopenHandler(handler: (() => boolean) | null)` / `getMarkupReopenHandler()` — handler returns true if re-open fired
- `setReopenSnapshot(markup: Markup | null)` / `getReopenSnapshot()` — transient snapshot of original markup, consumed by Enter (commitShape) or Esc (CanvasViewport)

---

### 2. `src/renderer/src/types/markup.ts` (modify — types)

**Analog:** `MarkupCommand` union in same file, lines 52-101 (verified).

**Existing `move-markups` variant pattern** (closest shape — carries old + new state for undo round-trip), lines 88-101:

```typescript
  | {
      type: 'move-markups'
      /**
       * One entry per markup being moved. Single-markup translate and
       * group-move both use this shape (moves.length === 1 vs N).
       * Count pins use oldPoints/newPoints of length 1 — [markup.point].
       */
      moves: Array<{
        markupId: string
        page: number
        oldPoints: StagePoint[]
        newPoints: StagePoint[]
      }>
    }
```

**`isMarkupTool` type guard pattern to mirror** (`src/renderer/src/types/viewer.ts:89-94`):

```typescript
export const MARKUP_TOOLS = ['count', 'linear', 'area', 'perimeter', 'wall'] as const
export type MarkupToolType = typeof MARKUP_TOOLS[number]

export function isMarkupTool(tool: ActiveTool): tool is MarkupToolType {
  return (MARKUP_TOOLS as readonly string[]).includes(tool)
}
```

**What to copy:**
- Discriminated-union variant shape with a `type: 'reopen-recommit'` literal
- Carry FULL `Markup` objects (not just IDs) — locked decision per STATE.md: *"MarkupCommand stores full Markup object (not just ID)"*
- New type guard `isMultiPointMarkup(markup: Markup): markup is LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup` returning `markup.type !== 'count'` — mirrors `isMarkupTool` exactly (one-line predicate, exported from types module)

**Phase 13 additions:**
```typescript
// PROPOSED — new union variant
  | {
      type: 'reopen-recommit'
      oldMarkup: Markup   // original committed markup, removed at re-open trigger
      newMarkup: Markup   // markup committed by Enter after point edits
      // page is implicit: oldMarkup.page === newMarkup.page (re-open never crosses pages — A4 in RESEARCH)
    }

// PROPOSED — new type guard at end of file
export function isMultiPointMarkup(
  markup: Markup
): markup is LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup {
  return markup.type !== 'count'
}
```

---

### 3. `src/renderer/src/stores/markupStore.ts` (modify — renderer-store, CRUD)

**Analog:** `move-markups` undo branch (lines 404-421) + redo branch (lines 519-536) (verified).

**Existing `undo()` reducer branch for `move-markups`** (lines 404-421):

```typescript
if (cmd.type === 'move-markups') {
  const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
  for (const move of cmd.moves) {
    const pageList = nextPageMarkups[move.page] ?? []
    nextPageMarkups[move.page] = pageList.map((m) => {
      if (m.id !== move.markupId) return m
      if (m.type === 'count') {
        return { ...m, point: move.oldPoints[0] } as Markup
      }
      return { ...m, points: move.oldPoints } as Markup
    })
  }
  return {
    pageMarkups: nextPageMarkups,
    undoStack: s.undoStack.slice(0, -1),
    redoStack: [...s.redoStack, cmd]
  }
}
```

**Existing `redo()` reducer branch for `move-markups`** (lines 519-536):

```typescript
if (cmd.type === 'move-markups') {
  const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
  for (const move of cmd.moves) {
    const pageList = nextPageMarkups[move.page] ?? []
    nextPageMarkups[move.page] = pageList.map((m) => {
      if (m.id !== move.markupId) return m
      if (m.type === 'count') {
        return { ...m, point: move.newPoints[0] } as Markup
      }
      return { ...m, points: move.newPoints } as Markup
    })
  }
  return {
    pageMarkups: nextPageMarkups,
    undoStack: pushCommand(s.undoStack, cmd),
    redoStack: s.redoStack.slice(0, -1)
  }
}
```

**Existing `placeMarkup` action pattern** (lines 144-152) — the canonical "push command + clear redoStack" shape:

```typescript
placeMarkup: (markup) =>
  set((s) => {
    const pageList = [...(s.pageMarkups[markup.page] ?? []), markup]
    return {
      pageMarkups: { ...s.pageMarkups, [markup.page]: pageList },
      undoStack: pushCommand(s.undoStack, { type: 'place', markup }),
      redoStack: []
    }
  }),
```

**What to copy:**
- Branch ordering — new `reopen-recommit` branches MUST be placed BEFORE the `cmd.markup.page` fallthrough at lines 437 (undo) and 553 (redo). The fallthrough crashes on commands that lack a `cmd.markup` field (see comment at lines 382-384 and 497-499).
- `pushCommand(stack, cmd)` helper (lines 91-94) for undoStack cap discipline (UNDO_STACK_MAX = 50)
- Immutable return shape: `pageMarkups: { ...s.pageMarkups, [page]: nextList }` (never mutate s.pageMarkups)
- For undo: pop undoStack tail + push to redoStack
- For redo: push to undoStack (via pushCommand) + pop redoStack tail
- For NEW silent actions (`removeForReopen`, `restoreFromReopen`): DO NOT touch undoStack or redoStack — these are pure data hides, not commands

**Phase 13 additions (slot BEFORE line 437 in undo, BEFORE line 553 in redo):**

```typescript
// undo() branch (new — slot before fallthrough at line 437)
if (cmd.type === 'reopen-recommit') {
  const page = cmd.oldMarkup.page
  const pageList = s.pageMarkups[page] ?? []
  // Remove newMarkup (added on commit), re-add oldMarkup (removed on re-open trigger).
  const filtered = pageList.filter((m) => m.id !== cmd.newMarkup.id)
  return {
    pageMarkups: { ...s.pageMarkups, [page]: [...filtered, cmd.oldMarkup] },
    undoStack: s.undoStack.slice(0, -1),
    redoStack: [...s.redoStack, cmd]
  }
}

// redo() branch (new — slot before fallthrough at line 553)
if (cmd.type === 'reopen-recommit') {
  const page = cmd.oldMarkup.page
  const pageList = s.pageMarkups[page] ?? []
  // Re-apply: remove oldMarkup, add newMarkup.
  const filtered = pageList.filter((m) => m.id !== cmd.oldMarkup.id)
  return {
    pageMarkups: { ...s.pageMarkups, [page]: [...filtered, cmd.newMarkup] },
    undoStack: pushCommand(s.undoStack, cmd),
    redoStack: s.redoStack.slice(0, -1)
  }
}

// New actions
commitReopen: (oldMarkup: Markup, newMarkup: Markup) =>
  set((s) => {
    const page = oldMarkup.page
    const pageList = s.pageMarkups[page] ?? []
    // Idempotent: oldMarkup may have already been removed via removeForReopen.
    const filtered = pageList.filter((m) => m.id !== oldMarkup.id)
    return {
      pageMarkups: { ...s.pageMarkups, [page]: [...filtered, newMarkup] },
      undoStack: pushCommand(s.undoStack, { type: 'reopen-recommit', oldMarkup, newMarkup }),
      redoStack: []
    }
  }),

removeForReopen: (markup: Markup) =>
  set((s) => {
    const page = markup.page
    const pageList = s.pageMarkups[page] ?? []
    return {
      pageMarkups: { ...s.pageMarkups, [page]: pageList.filter((m) => m.id !== markup.id) }
      // NO undoStack/redoStack mutation — silent removal per D-16
    }
  }),

restoreFromReopen: (markup: Markup) =>
  set((s) => {
    const page = markup.page
    const pageList = s.pageMarkups[page] ?? []
    if (pageList.some((m) => m.id === markup.id)) return s  // idempotent guard
    return {
      pageMarkups: { ...s.pageMarkups, [page]: [...pageList, markup] }
      // NO undoStack/redoStack mutation — silent restore per D-16
    }
  }),
```

---

### 4. `src/renderer/src/hooks/useMarkupTool.ts` (modify — renderer-hook, state-machine)

**Analog (in-file):** `activatePreset` at lines 119-148 (verified); `commitShape` at lines 309-390 (verified).

**Existing `activatePreset` (linear/area/perimeter/wall branch — verified, lines 134-145):**

```typescript
} else {
  setState({
    ...INITIAL_STATE,
    mode: 'drawing',
    toolType: tool,
    pendingName: preset.name,
    pendingCategoryName: preset.categoryName || UNCATEGORIZED,
    pendingColor: preset.color,
    chainArmed: true,
    ...(tool === 'wall' ? { pendingWallHeight: preset.wallHeight ?? 2400 } : {})
  })
}
```

**Existing `commitShape` core (verified, lines 309-390):**

```typescript
const commitShape = useCallback((payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => {
  // Read state from the ref snapshot, dispatch the side effect ONCE, then
  // reset state via setState. Doing the store.placeMarkup inside a setState
  // updater would double-fire under React StrictMode (same pattern as the
  // count-placing path in recordClick above).
  const prev = stateRef.current
  if (prev.mode !== 'confirming') return

  const page = prev.pendingPage ?? useViewerStore.getState().currentPage
  const store = useMarkupStore.getState()
  const category = store.getOrCreateCategory(payload.categoryName || UNCATEGORIZED)
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  const name = payload.name
  const color = payload.color

  if (prev.toolType === 'linear') {
    const m: LinearMarkup = { id, type: 'linear', page, name, categoryId: category.id, color, createdAt, points: prev.points }
    store.placeMarkup(m)
  } else if (prev.toolType === 'area') {
    // ...same shape
  }
  // ...etc for perimeter, wall

  // Chain-aware post-commit reset
  setState({
    ...INITIAL_STATE,
    toolType: prev.toolType,
    mode: 'drawing',
    pendingName: payload.name,
    pendingCategoryName: payload.categoryName,
    pendingColor: payload.color,
    pendingWallHeight: payload.wallHeight ?? prev.pendingWallHeight,
    chainArmed: true
  })
}, [])
```

**What to copy:**
- `stateRef.current` read (NOT `state` from closure) to avoid StrictMode double-invoke (see comment at lines 95-102 and 310-313 — load-bearing invariant)
- `store.placeMarkup(m)` dispatch OUTSIDE `setState` updater (Pitfall 7 — same applies to `commitReopen`)
- `setState({ ...INITIAL_STATE, ... })` reset pattern after dispatch (preserves toolType/pending for chain)
- Tool-type-specific markup construction (4 branches: linear, area, perimeter, wall) — re-use the existing 4 branches to build `newMarkup`
- The `chainArmed: true` line is the load-bearing chain-mode flag — Phase 13 sets it to `false` when re-committing from re-open

**Phase 13 additions:**

1. **Extend `activatePreset` to accept `points?: StagePoint[]`** — seed `state.points` and force `chainArmed: false` when seeded (Pitfall 2 — `chainArmed: true` during re-open would trigger Phase 8 auto-commit `useEffect`):

```typescript
// PROPOSED — extend signature
preset: { name: string; categoryName: string; color: string; wallHeight?: number; points?: StagePoint[] }

// PROPOSED — branch body (replaces lines 134-145)
} else {
  setState({
    ...INITIAL_STATE,
    mode: 'drawing',
    toolType: tool,
    pendingName: preset.name,
    pendingCategoryName: preset.categoryName || UNCATEGORIZED,
    pendingColor: preset.color,
    // Phase 13: chainArmed false during re-open (seeded points) — prevents Phase 8 auto-commit loop.
    chainArmed: preset.points && preset.points.length > 0 ? false : true,
    points: preset.points ? [...preset.points] : [],  // copy, NEVER reuse — Anti-Pattern in RESEARCH
    ...(tool === 'wall' ? { pendingWallHeight: preset.wallHeight ?? 2400 } : {}),
    // Seed pendingPage at re-open time so commitShape doesn't fall through to currentPage default.
    ...(preset.points && preset.points.length > 0
      ? { pendingPage: useViewerStore.getState().currentPage }
      : {})
  })
}
```

2. **Extend `commitShape` to consult `getReopenSnapshot()` and dispatch `commitReopen` vs `placeMarkup`:**

```typescript
// PROPOSED — at top of commitShape after building newMarkup
const reopenSnapshot = getReopenSnapshot()
if (reopenSnapshot) {
  store.commitReopen(reopenSnapshot, newMarkup)
  setReopenSnapshot(null)
} else {
  store.placeMarkup(newMarkup)
}

// Also: in the post-commit reset setState, set chainArmed: reopenSnapshot ? false : true
```

---

### 5. `src/renderer/src/hooks/useKeyboardShortcuts.ts` (modify — renderer-hook, dispatch)

**Analog (in-file):** Ctrl+Z dispatch block at lines 92-112 (verified). The insertion point is between line 95 (`getMarkupUndoHandler()?.()`) and line 102 (top-of-stack peek for delete-restore).

**Existing Ctrl+Z block (verified, lines 92-112):**

```typescript
if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
  if (isTextInputActive()) return
  e.preventDefault()
  const handledByDraw = getMarkupUndoHandler()?.() ?? false
  if (!handledByDraw) {
    // Phase 09 UAT gap (Test 9): peek the command being undone — if a
    // delete or delete-group is about to be reversed, capture the
    // restored markup IDs so we can re-apply selection rings after
    // undo(). Without this, Ctrl+A → Delete → Ctrl+Z restores the
    // markups but leaves selection empty, breaking the round-trip.
    const top = useMarkupStore.getState().undoStack.at(-1)
    let restoredIds: string[] = []
    if (top?.type === 'delete') restoredIds = [top.markup.id]
    else if (top?.type === 'delete-group') restoredIds = top.markups.map((m) => m.id)
    useMarkupStore.getState().undo()
    if (restoredIds.length > 0) {
      useViewerStore.getState().setSelectedMarkupIds(restoredIds)
    }
  }
  return
}
```

**What to copy:**
- `isTextInputActive()` guard at top of branch (non-negotiable per STATE.md — `isTextInputActive()` guard on every global Ctrl+ shortcut)
- `e.preventDefault()` immediately after
- Module-ref handler call pattern: `getXHandler()?.() ?? false` returning a `handled: boolean`
- Short-circuit `return` after a handler returns true
- `useMarkupStore.getState().undoStack.at(-1)` for top-of-stack peek (no subscription — read-once)
- DO NOT call `useMarkupStore.getState().undo()` after a successful re-open dispatch (Anti-Pattern: would double-pop the stack — the re-open handler itself pops the original `place` command per D-16)

**Phase 13 insertion** (between current line 95 and line 96):

```typescript
const handledByDraw = getMarkupUndoHandler()?.() ?? false
if (handledByDraw) return  // (refactor: hoist early return for clarity)

// NEW Phase 13 branch: post-commit re-open. Reads undoStack top, applies D-17 four-condition check,
// fires re-open transition via the module-level handler (registered by CanvasViewport).
const handledByReopen = getMarkupReopenHandler()?.() ?? false
if (handledByReopen) return

// Existing Phase 09 UAT gap path — unchanged from line 102 onward.
const top = useMarkupStore.getState().undoStack.at(-1)
// ...
```

---

### 6. `src/renderer/src/components/CanvasViewport.tsx` (modify — renderer-component, multi-surface)

**Analog (in-file):** Three existing in-file patterns to copy:

#### (a) Module-ref handler registration — `setMarkupUndoHandler` block, lines 315-327 (verified):

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

useEffect(() => {
  setMarkupRedoHandler(repushLastPoint)
  return () => {
    setMarkupRedoHandler(null)
  }
}, [repushLastPoint])
```

**What to copy:**
- `useEffect` with handler registered on mount, cleanup sets ref to `null`
- Dep array: stable callback identity (the handler from `useMarkupTool`)
- Cleanup `return () => setX(null)` handles StrictMode double-mount (Pitfall 9)

**Phase 13 — new `reopenHandler` registration block** (slot near lines 315-327):

```typescript
useEffect(() => {
  const handler = (): boolean => {
    // D-17 condition 1: no in-progress draw
    if (markupState.mode !== 'idle') return false
    // D-17 condition 4: no vertex-edit active
    if (useViewerStore.getState().vertexEditMarkupId !== null) return false
    // D-17 condition 2: top of stack is 'place' of a multi-point markup
    const store = useMarkupStore.getState()
    const top = store.undoStack.at(-1)
    if (!top || top.type !== 'place') return false
    if (!isMultiPointMarkup(top.markup)) return false
    // D-17 condition 5 (A4 — same page)
    if (top.markup.page !== useViewerStore.getState().currentPage) return false
    // D-17 condition 3: markup still in store
    const stillExists = (store.pageMarkups[top.markup.page] ?? []).some((m) => m.id === top.markup.id)
    if (!stillExists) return false

    const original = top.markup
    setReopenSnapshot(original)
    store.removeForReopen(original)
    // Pop the 'place' command — D-16: it becomes part of reopen-recommit, not a separate undo entry.
    useMarkupStore.setState((s) => ({ undoStack: s.undoStack.slice(0, -1) }))
    clearSelection()                  // D-24
    clearVertexEdit()                 // D-24
    const tool = original.type as 'linear' | 'area' | 'perimeter' | 'wall'
    const cat = store.getCategory(original.categoryId)
    activatePreset(tool, {
      name: original.name,
      categoryName: cat?.name ?? '',
      color: original.color,
      points: original.type === 'count' ? undefined : original.points,
      wallHeight: original.type === 'wall' ? original.wallHeight : undefined
    })
    props.onReopenToast?.()
    return true
  }
  setMarkupReopenHandler(handler)
  return () => setMarkupReopenHandler(null)
}, [markupState.mode, activatePreset, clearSelection, clearVertexEdit, props.onReopenToast])
```

#### (b) Escape handler — lines 638-668 (verified):

```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      // Phase 12 D-06: Escape in vertex edit mode restores original vertex positions
      if (useViewerStore.getState().vertexEditMarkupId !== null) {
        e.preventDefault()
        cancelVertexEdit()
        return
      }
      if (
        markupState.mode === 'drawing' ||
        markupState.mode === 'confirming' ||
        markupState.mode === 'naming' ||
        markupState.mode === 'placing'
      ) {
        e.preventDefault()
        cancelMarkup()
        useViewerStore.getState().setActiveTool('select')
        return
      }
      if (useViewerStore.getState().activeTool === 'select') {
        clearSelection()
      }
      return
    }
    // Enter handler at lines 671-697 unchanged
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [...])
```

**What to copy:**
- Nested ordering inside the `Escape` branch: vertex-edit cancel FIRST, then in-progress cancel, then deselect
- Read `vertexEditMarkupId` and `activeTool` via `useViewerStore.getState()` to keep effect dep array stable (lines 645, 658, 664)
- `cancelMarkup()` returns useMarkupTool to INITIAL_STATE
- `setActiveTool('select')` after cancel

**Phase 13 — Escape extension** (slot BEFORE the existing `markupState.mode === 'drawing'` branch at line 650):

```typescript
// Phase 13 re-open cancel — restore the original markup snapshot, re-push the
// original 'place' command back onto undoStack (Pitfall 6 — round-trip exact),
// then run the standard cancel path.
const reopenSnapshot = getReopenSnapshot()
if (reopenSnapshot) {
  e.preventDefault()
  useMarkupStore.getState().restoreFromReopen(reopenSnapshot)
  useMarkupStore.setState((s) => ({
    undoStack: [...s.undoStack, { type: 'place', markup: reopenSnapshot }]
  }))
  setReopenSnapshot(null)
  cancelMarkup()
  useViewerStore.getState().setActiveTool('select')
  return
}
```

#### (c) Page-navigation cleanup — line 605 area (verified):

```typescript
// Phase 12: clear vertex-edit mode and drag-preview on page change so handles
// and live drag overlays don't persist across navigation.
clearVertexEdit()
setDragPreview(null)
vertexEditOriginalRef.current = null
}, [currentPage])
```

**What to copy:**
- `useEffect(..., [currentPage])` to react to page changes
- Clear transient UX state (vertex-edit ref, drag-preview, etc.)
- Phase 13 ADDS: restore re-open snapshot + cancel re-open as implicit Esc (Pitfall 1)

**Phase 13 — page-nav cleanup additions** (extend the existing `[currentPage]` effect OR add a sibling effect):

```typescript
// Phase 13: page navigation during re-open treats as implicit Esc — restore the original
// markup, re-push the 'place' command, and reset the in-progress draw state.
const reopenSnapshot = getReopenSnapshot()
if (reopenSnapshot) {
  useMarkupStore.getState().restoreFromReopen(reopenSnapshot)
  useMarkupStore.setState((s) => ({
    undoStack: [...s.undoStack, { type: 'place', markup: reopenSnapshot }]
  }))
  setReopenSnapshot(null)
  cancelMarkup()
}
```

#### (d) Props extension — add `onReopenToast?: () => void` to `CanvasViewportProps`:

Read the existing `CanvasViewportProps` interface (lines 230-250 area) and append `onReopenToast?: () => void`. The handler in (a) above invokes `props.onReopenToast?.()` at the end of a successful re-open.

---

### 7. `src/renderer/src/App.tsx` (modify — renderer-component, toast)

**Analog (in-file):** `saveToast` slot — state at line 82, `useEffect` at lines 122-126, JSX at lines 317-339 (all verified).

**Existing `saveToast` state (line 82):**

```typescript
const [saveToast, setSaveToast] = useState<string | null>(null)
```

**Existing `saveToast` lifecycle (lines 122-126):**

```typescript
useEffect(() => {
  if (!saveToast) return
  const t = window.setTimeout(() => setSaveToast(null), 2000)
  return () => window.clearTimeout(t)
}, [saveToast])
```

**Existing `saveToast` JSX (lines 317-339):**

```typescript
{saveToast !== null && (
  <div
    role="status"
    aria-live="polite"
    style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      padding: '8px 16px', background: '#252526', border: '1px solid #3c3c3c',
      borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 15,
      display: 'flex', gap: 16, fontSize: 13, color: '#cccccc'
    }}
  >
    <span>{saveToast}</span>
    <button
      onClick={() => setSaveToast(null)}
      style={{
        background: 'transparent', border: 'none',
        color: '#888', cursor: 'pointer', fontSize: 13
      }}
    >
      Dismiss
    </button>
  </div>
)}
```

**Existing `exportToast` JSX (parallel — lines 341+, verified):** Identical structure with `bottom: 60` to stack above `saveToast` (which sits at `bottom: 16`). `copyToast` (in CanvasViewport.tsx:71) uses 2000ms parent-owned dismissal.

**What to copy:**
- `useState<string | null>(null)` slot (string content = toast message)
- `useEffect` cleanup with `window.setTimeout` ref + `window.clearTimeout` (NOT `setTimeout`/`clearTimeout` — use the window-prefixed variant per existing convention)
- 2000ms lifecycle for save/export — Phase 13 uses **2500ms** per D-19
- JSX absolute-positioned div, `role="status"`, `aria-live="polite"`, identical styling
- "Dismiss" button calling `setX(null)`
- `bottom` offset progression: saveToast 16 → exportToast 60 → copyToast 104 (in CanvasViewport) → reopenToast **148** (new — avoid stacking collision)

**Phase 13 additions:**

```typescript
// 1. State slot — add near line 82 (saveToast)
const [reopenToast, setReopenToast] = useState<string | null>(null)

// 2. Lifecycle effect — add near lines 122-132 (saveToast/exportToast effects).
//    2500ms per D-19.
useEffect(() => {
  if (!reopenToast) return
  const t = window.setTimeout(() => setReopenToast(null), 2500)
  return () => window.clearTimeout(t)
}, [reopenToast])

// 3. Pitfall 5 — clear toast on page change
const currentPage = useViewerStore((s) => s.currentPage)
useEffect(() => {
  setReopenToast(null)
}, [currentPage])

// 4. Prop wiring to CanvasViewport (locate the existing <CanvasViewport ... /> usage and add):
onReopenToast={() => setReopenToast('Shape re-opened — continue drawing or press Enter to commit')}

// 5. JSX block — mirror saveToast block at 317-339, with bottom: 148
{reopenToast !== null && (
  <div role="status" aria-live="polite"
    style={{
      position: 'absolute', bottom: 148, left: '50%', transform: 'translateX(-50%)',
      padding: '8px 16px', background: '#252526', border: '1px solid #3c3c3c',
      borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 15,
      display: 'flex', gap: 16, fontSize: 13, color: '#cccccc'
    }}>
    <span>{reopenToast}</span>
    <button onClick={() => setReopenToast(null)}
      style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13 }}>
      Dismiss
    </button>
  </div>
)}
```

---

### 8. `src/tests/markup-post-commit-reopen.test.ts` (NEW — test)

**Analog:** `src/tests/markup-tool-point-redo.test.ts` (verified, lines 1-230) + `src/tests/markup-tool-pop-last-point.test.ts` (verified, lines 1-240). The two test files share an identical scaffold; copy from either.

**Test-file header pattern (`markup-tool-point-redo.test.ts:1-24`):**

```typescript
/** @vitest-environment jsdom */
/**
 * Phase XX: <description>
 *
 * Success Criteria covered:
 *   SC1 — ...
 *   SC2 — ...
 */
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
```

**`makeFakeStage` shim (lines 32-44):**

```typescript
function makeFakeStage(): Konva.Stage {
  const id = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x, y: p.y })
  const identity = {
    copy: () => ({ invert: () => ({ point: id }), point: id })
  }
  return { getAbsoluteTransform: () => identity } as unknown as Konva.Stage
}
```

**`HookHost` + `mount` harness (lines 46-65):**

```typescript
function HookHost({ probe }: { probe: Probe }): React.JSX.Element {
  const stageRef = useRef<Konva.Stage | null>(makeFakeStage())
  probe.current = useMarkupTool(stageRef)
  return React.createElement('div', null, null)
}

function mount(probe: Probe): { unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => { root.render(React.createElement(HookHost, { probe })) })
  return {
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}
```

**Top-level act flag + beforeEach reset (lines 67-80):**

```typescript
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

**Module-ref dynamic-import pattern (`markup-tool-pop-last-point.test.ts:219-231`):**

```typescript
describe('markup-undo-ref module-level handler (wired from CanvasViewport → consumed by useKeyboardShortcuts)', () => {
  it('setMarkupUndoHandler stores and getMarkupUndoHandler returns the same reference; clearing unsets it', async () => {
    const { setMarkupUndoHandler, getMarkupUndoHandler } = await import(
      '@renderer/lib/markup-undo-ref'
    )
    expect(getMarkupUndoHandler()).toBeNull()
    const fn = () => true
    setMarkupUndoHandler(fn)
    expect(getMarkupUndoHandler()).toBe(fn)
    setMarkupUndoHandler(null)
    expect(getMarkupUndoHandler()).toBeNull()
  })
})
```

**Committed-markup seeding pattern (lines 184-198):**

```typescript
// Seed a committed count pin so the undo stack is non-empty
const store = useMarkupStore.getState()
const cat = store.getOrCreateCategory('Test')
store.placeMarkup({
  id: 'committed-1',
  type: 'count',
  page: 1,
  name: 'Prior',
  categoryId: cat.id,
  color: '#000000',
  createdAt: 1,
  point: { x: 5, y: 5 },
  sequence: 1
})
```

**What to copy:**
- `/** @vitest-environment jsdom */` directive on line 1
- Single `// @ts-expect-error` comment for `globalThis.IS_REACT_ACT_ENVIRONMENT = true` (parallel-executor safe per STATE.md "Test files install in-memory localStorage polyfill via Object.defineProperty in beforeEach")
- `beforeEach` resets BOTH `markupStore` and `viewerStore`
- `act(() => { ... })` wrapping every state-mutating call
- `probe.current!.<method>(...)` for invoking the hook API
- Dynamic `await import(...)` for testing the module-ref module in isolation (one describe block per ref module)
- Use `// @ts-expect-error — new API does not exist yet (Wave 1 adds it — RED)` on any RED-phase API call that hasn't been added yet — this comment pattern is established at `markup-tool-point-redo.test.ts:123, 150, 161, 189`

**Phase 13 test cases to cover (per 13-RESEARCH.md §"Phase Requirements → Test Map"):**

| Test ID | Description | RED dependency |
|---------|-------------|----------------|
| SC1 | Ctrl+Z on committed multi-point markup populates `markupState.points`, sets `mode='drawing'`, removes original from store, clears selection + vertex-edit | new `commitReopen` + `removeForReopen` + reopen-ref + extended `activatePreset` |
| SC2(a) | After re-open, `popLastPoint()` removes the last seeded point (Phase 10 still works) | extended `activatePreset` (seeds `points`) |
| SC2(b) | After re-open, `repushLastPoint()` re-adds the popped point | same |
| SC2(c) | Enter re-commits → new markup has original name/category/color (+wallHeight) with fresh id; ONE `reopen-recommit` command on undoStack | `commitShape` extension |
| SC3 | Toast fires; auto-dismisses ~2500ms later (App-level toast test) | App.tsx `reopenToast` state + effect |
| SC4 | Esc restores original markup with deep equality on points + id preserved; `undoStack` has the original `place` command back | `restoreFromReopen` + Esc handler |
| SC5 | Undo of `reopen-recommit` restores original; redo re-applies modified newMarkup (round-trip) | undo/redo reducer branches |
| EDGE-1 | Count pin at top of stack → re-open does NOT fire | `isMultiPointMarkup` guard |
| EDGE-2 | Text input focused → no-op (`isTextInputActive` inherited) | dispatch guard |
| EDGE-3 | Vertex-edit active → no-op (D-17 condition 4) | reopen handler condition |
| EDGE-4 | Top-of-stack markup is on different page → no-op (A4) | reopen handler condition |
| EDGE-5 | Wall re-open preserves `wallHeight` (3000mm → 3000mm not default 2400) | activatePreset wallHeight wiring |

---

## Shared Patterns

### A. Module-level handler ref (replaces React context for cross-component event handlers)

**Source:** `src/renderer/src/lib/markup-undo-ref.ts:15-23`
**Apply to:** New `src/renderer/src/lib/markup-reopen-ref.ts` (entire file)

```typescript
let _x: (() => boolean) | null = null
export function setX(handler: (() => boolean) | null): void { _x = handler }
export function getX(): (() => boolean) | null { return _x }
```

**STATE.md decision lock:** *"Module-level ref pattern for canvas controls — Simpler than React context or Zustand function refs for cross-component communication."*

### B. `isTextInputActive()` guard (non-negotiable on every global Ctrl+ shortcut)

**Source:** `src/renderer/src/hooks/useKeyboardShortcuts.ts:26-41`
**Apply to:** Ctrl+Z dispatch extension in `useKeyboardShortcuts.ts` (Phase 13 branch slots INSIDE the existing `if (isTextInputActive()) return` guarded block)

```typescript
export function isTextInputActive(): boolean {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  if (!el) return false
  if (el instanceof HTMLInputElement) return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLElement) {
    if (el.isContentEditable) return true
    if (el.contentEditable === 'true') return true
    const attr = el.getAttribute('contenteditable')
    if (attr !== null && (attr === '' || attr.toLowerCase() === 'true')) return true
  }
  return false
}
```

**STATE.md decision lock:** *"isTextInputActive() guard on every global Ctrl+ shortcut — non-negotiable."*

### C. Parent-owned toast lifecycle (no internal `setTimeout`)

**Source:** `src/renderer/src/App.tsx:82, 122-126, 317-339` (saveToast) + `:93, 128-132, 341+` (exportToast) + `src/renderer/src/components/CanvasViewport.tsx:71-76` (copyToast)
**Apply to:** New `reopenToast` slot in `App.tsx`

```typescript
const [xToast, setXToast] = useState<string | null>(null)
useEffect(() => {
  if (!xToast) return
  const t = window.setTimeout(() => setXToast(null), 2500)  // 2500ms for re-open (D-19)
  return () => window.clearTimeout(t)
}, [xToast])
```

**STATE.md decision lock:** *"ConfirmationToast is pure presentational (no setTimeout) — Parent owns dismissal lifecycle via useEffect."*

### D. Immutable Zustand reducer return (command-pattern undo/redo)

**Source:** `src/renderer/src/stores/markupStore.ts:404-421` (`move-markups` undo) + lines 91-94 (`pushCommand` cap helper)
**Apply to:** New `reopen-recommit` branches in undo() and redo() switches

- Return `{ pageMarkups: { ...s.pageMarkups, [page]: nextList }, undoStack: <new>, redoStack: <new> }`
- Use `pushCommand(stack, cmd)` to cap at UNDO_STACK_MAX = 50
- NEVER mutate `s.pageMarkups`, `s.undoStack`, or `s.redoStack` in place
- Branch must come BEFORE the `cmd.markup.page` fallthrough at lines 437 / 553

### E. `useEffect` registration with cleanup-sets-null (StrictMode-safe)

**Source:** `src/renderer/src/components/CanvasViewport.tsx:315-327`
**Apply to:** New `reopenHandler` registration in `CanvasViewport.tsx`

```typescript
useEffect(() => {
  setX(handler)
  return () => setX(null)
}, [/* stable deps */])
```

Cleanup-sets-null is load-bearing for StrictMode double-mount (Pitfall 9 in RESEARCH).

### F. `stateRef.current` read instead of closure-captured state (StrictMode-safe dispatch)

**Source:** `src/renderer/src/hooks/useMarkupTool.ts:95-102, 167-203, 309-323`
**Apply to:** `commitShape` extension (read `getReopenSnapshot()` and `prev = stateRef.current`)

```typescript
// Reading via ref keeps store.placeMarkup idempotent under React StrictMode
// (setState updater bodies are double-invoked in dev).
const stateRef = useRef<MarkupDrawState>(state)
useEffect(() => { stateRef.current = state }, [state])

// Inside any callback that fires a store side effect:
const prev = stateRef.current
store.placeMarkup(...)  // OUTSIDE setState updater
setState({ ... })       // pure reducer-style update
```

---

## No Analog Found

None. Every Phase 13 surface has an exact in-repo analog (most are in-file extensions of patterns already established in Phases 3, 7.1, 8, 9, 10, and 12).

---

## Metadata

**Analog search scope:**
- `src/renderer/src/lib/` (module-ref pattern)
- `src/renderer/src/types/` (discriminated union + type guards)
- `src/renderer/src/stores/markupStore.ts` (command-pattern reducer)
- `src/renderer/src/hooks/` (state machine + dispatch)
- `src/renderer/src/components/CanvasViewport.tsx` (handler registration, Esc, page-nav cleanup)
- `src/renderer/src/App.tsx` (toast state + JSX slot)
- `src/tests/markup-tool-point-redo.test.ts` and `src/tests/markup-tool-pop-last-point.test.ts` (test scaffold)

**Files scanned:** 8 (all primary analogs verified by direct Read this session)
**Pattern extraction date:** 2026-05-21
**Confidence:** HIGH — every excerpt below quoted from a file Read in this session, with verified line numbers.
