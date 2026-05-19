# Phase 10: Granular Undo Foundation — Research

**Researched:** 2026-05-19
**Domain:** In-process drawing state machine, keyboard shortcut dispatch, module-level ref pattern
**Confidence:** HIGH — all findings are direct codebase reads; no external lookups required

---

## Summary

Phase 10 is a targeted extension of the undo/redo infrastructure that already exists in this codebase. The core mechanism (`popLastPoint` in `useMarkupTool`, `markup-undo-ref.ts`, and the Ctrl+Z dispatch in `useKeyboardShortcuts`) was built in Phase 3 and has been live and tested since. What is missing is the symmetric redo half: a `pushRedoPoint` capability in `useMarkupTool` and a `setMarkupRedoHandler` / `getMarkupRedoHandler` pair in `markup-undo-ref.ts` so that Ctrl+Y can re-add the most recently popped in-progress vertex before falling through to `markupStore.redo()`.

The other gap is the first-point cancellation rule (Success Criterion 3): `popLastPoint` currently returns `false` when `points.length === 0` (zero points, nothing to pop), but when there is exactly one point and Ctrl+Z is pressed, the current code pops it to zero points — it does NOT automatically call `cancel()`. After Phase 10 the one-point-pop path must trigger `cancel()` so the canvas clears and the tool exits.

No new libraries, no new IPC channels, no new store slices. Everything lives in the renderer layer. The work is mechanically small but must be done carefully to avoid state machine leaks.

**Primary recommendation:** Extend `MarkupDrawState` with a `redoPoints: StagePoint[]` stack, add `repushLastPoint(): boolean` to `useMarkupTool`, mirror the undo-ref pattern with a redo-ref, update the Ctrl+Z one-point branch to call `cancel()`, and update Ctrl+Y dispatch to prefer the in-progress redo handler before falling through to the committed store.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| In-progress point stack (push/pop/repush) | `useMarkupTool` hook (renderer) | — | All in-progress drawing state already lives here as `MarkupDrawState.points`. Adding `redoPoints` is a natural extension of the same state. |
| Ctrl+Z / Ctrl+Y keyboard dispatch | `useKeyboardShortcuts` hook (renderer) | — | Already owns the dispatch tree; adding the redo-handler check mirrors the existing undo-handler check. |
| Handler registration between CanvasViewport and keyboard hook | `markup-undo-ref.ts` module (renderer/lib) | — | The module-level ref pattern is the established cross-component bridge that avoids circular imports. A parallel redo ref goes here. |
| Cancellation when all points are popped | `useMarkupTool.cancel()` (renderer) | `CanvasViewport` (caller) | `cancel()` already resets state to `INITIAL_STATE`; the undo path just needs to call it when `points.length` drops to 0 after a pop. |
| Post-commit undo/redo (whole-markup granularity) | `markupStore` (Zustand) | — | No change in Phase 10. Committed-markup undo/redo is handled by `markupStore.undo()` / `markupStore.redo()` and is not touched. |

---

## Standard Stack

No new libraries required.

| Component | Version | Role |
|-----------|---------|------|
| Zustand 5.0.x | already installed | `markupStore` — post-commit undo/redo; unchanged |
| React 19 useState / useCallback | already installed | `useMarkupTool` state machine |
| TypeScript 5.x | already installed | Extend `MarkupDrawState` type |
| Vitest 4.1.x | already installed | Test runner — confirmed `npx vitest run` → 66 test files, 473 tests, all pass |

---

## Architecture Patterns

### System Architecture Diagram

```
Keyboard event (window)
        |
        v
useKeyboardShortcuts.handleKeyDown
  ├── Ctrl+Z
  │     ├── isTextInputActive() → skip if true
  │     ├── getMarkupUndoHandler()?.()  ← in-progress pop handler
  │     │     returns true  → handled; done
  │     │     returns false → fall through to markupStore.undo()
  │     │                       (peek undo stack for delete/delete-group
  │     │                        to restore selection after undo)
  │     └── (NEW) if points.length was 1 before pop → cancel() called
  │
  └── Ctrl+Y
        ├── isTextInputActive() → skip if true
        ├── (NEW) getMarkupRedoHandler()?.()  ← in-progress re-add handler
        │     returns true  → handled; done
        │     returns false → fall through to markupStore.redo()
        └── markupStore.redo()   (post-commit only; unchanged)

CanvasViewport (mount)
  ├── setMarkupUndoHandler(popLastPoint)     ← already wired
  └── (NEW) setMarkupRedoHandler(repushLastPoint)

useMarkupTool (hook)
  ├── state.points          ← existing in-progress vertex list
  ├── (NEW) state.redoPoints ← in-progress redo stack (cleared on recordClick)
  ├── popLastPoint()        ← existing; EXTENDED: auto-cancel when last point popped
  └── (NEW) repushLastPoint() ← mirrors popLastPoint; moves top of redoPoints → points
```

### Recommended Project Structure

No new files needed beyond the test file. All changes are in existing files:

```
src/renderer/src/
├── hooks/
│   └── useMarkupTool.ts        # add redoPoints to MarkupDrawState + INITIAL_STATE;
│                                 add repushLastPoint(); extend popLastPoint auto-cancel
├── lib/
│   └── markup-undo-ref.ts      # add setMarkupRedoHandler / getMarkupRedoHandler
├── hooks/
│   └── useKeyboardShortcuts.ts # Ctrl+Y dispatch: prefer getMarkupRedoHandler() before redo()
└── components/
    └── CanvasViewport.tsx       # mount: setMarkupRedoHandler(repushLastPoint)
                                 # unmount: setMarkupRedoHandler(null)

src/tests/
└── markup-tool-point-redo.test.ts   # NEW — covers Success Criteria 1-5
```

### Pattern 1: Module-level Undo/Redo Handler Ref (established, extend it)

**What:** A module-level nullable function reference bridges `CanvasViewport` (which owns the `useMarkupTool` instance) to `useKeyboardShortcuts` (which handles global keyboard events), without circular imports.

**When to use:** Any time a keyboard handler needs to call a method that lives inside a component's hook instance.

**Existing implementation (`markup-undo-ref.ts`):**
```typescript
// Source: src/renderer/src/lib/markup-undo-ref.ts (verified)
let _markupUndoHandler: (() => boolean) | null = null
export function setMarkupUndoHandler(handler: (() => boolean) | null): void {
  _markupUndoHandler = handler
}
export function getMarkupUndoHandler(): (() => boolean) | null {
  return _markupUndoHandler
}
```

**Extension for Phase 10 — add redo pair:**
```typescript
// Add below the existing undo pair
let _markupRedoHandler: (() => boolean) | null = null
export function setMarkupRedoHandler(handler: (() => boolean) | null): void {
  _markupRedoHandler = handler
}
export function getMarkupRedoHandler(): (() => boolean) | null {
  return _markupRedoHandler
}
```

**CanvasViewport wiring (existing undo useEffect, extend it):**
```typescript
// Source: CanvasViewport.tsx lines 277-281 (verified)
// Current:
useEffect(() => {
  setMarkupUndoHandler(popLastPoint)
  return () => { setMarkupUndoHandler(null) }
}, [popLastPoint])

// Phase 10 extension — add repushLastPoint to same or separate useEffect:
useEffect(() => {
  setMarkupRedoHandler(repushLastPoint)
  return () => { setMarkupRedoHandler(null) }
}, [repushLastPoint])
```

### Pattern 2: MarkupDrawState Extension with redoPoints

**What:** Extend the existing in-memory draw state to carry a local redo stack for in-progress vertices. This is completely separate from `markupStore.redoStack` (which handles committed markups).

**Key invariant:** `redoPoints` is cleared whenever a new point is recorded (recordClick appends a point), because a new placement invalidates the redo history — identical to how `markupStore.redo()` clears when a new markup is placed.

**Extension:**
```typescript
// Source: src/renderer/src/hooks/useMarkupTool.ts (verified, lines 16-46)
export interface MarkupDrawState {
  // ... existing fields ...
  /** Points popped by Ctrl+Z during an in-progress draw; cleared on new recordClick */
  redoPoints: StagePoint[]
}

const INITIAL_STATE: MarkupDrawState = {
  // ... existing fields ...
  redoPoints: []
}
```

**popLastPoint extension (auto-cancel + push to redoPoints):**
```typescript
// Verified current implementation (lines 356-365):
const popLastPoint = useCallback((): boolean => {
  const current = stateRef.current
  if (current.mode !== 'drawing') return false
  if (current.points.length === 0) return false
  // NEW: if only one point, pop it then cancel (Success Criterion 3)
  if (current.points.length === 1) {
    // Push to redoPoints before cancel so repush can recover the point
    const popped = current.points[0]
    cancel()  // resets to INITIAL_STATE — so push redo separately if needed
    // NOTE: cancel() calls setState(INITIAL_STATE) which zeros redoPoints too.
    // For SC3, the tool is exited so redoPoints is irrelevant. Just cancel.
    return true
  }
  setState((prev) => {
    if (prev.mode !== 'drawing' || prev.points.length === 0) return prev
    const popped = prev.points[prev.points.length - 1]
    return {
      ...prev,
      points: prev.points.slice(0, -1),
      previewPoint: null,
      redoPoints: [popped, ...prev.redoPoints]  // push front so repush is LIFO
    }
  })
  return true
}, [cancel])
```

**repushLastPoint (new):**
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

**recordClick extension — clear redoPoints on new placement:**
```typescript
// Inside the linear/area/perimeter/wall branch of recordClick setState updater
return {
  ...prev,
  points: [...prev.points, stagePoint],
  pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage,
  redoPoints: []   // NEW: new placement invalidates in-progress redo history
}
```

**Ctrl+Y dispatch extension in useKeyboardShortcuts:**
```typescript
// Lines 114-119 (verified):
if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
  if (isTextInputActive()) return
  e.preventDefault()
  // NEW: prefer in-progress redo before committed-markup redo
  const handledByDraw = getMarkupRedoHandler()?.() ?? false
  if (!handledByDraw) {
    useMarkupStore.getState().redo()
  }
  return
}
```

### Anti-Patterns to Avoid

- **Storing redoPoints in markupStore:** The in-progress draw stack is transient UI state, not committed markup data. Putting it in Zustand would persist it (via persist middleware) and couple the draw state machine to the committed-markup domain. Keep it in `useMarkupTool` local state exactly as `points` is.
- **Calling cancel() asynchronously in popLastPoint:** `cancel()` calls `setState(INITIAL_STATE)` which is a normal React state update. Calling it inside a `setState` updater callback is prohibited (nested setState). Call it directly from the `popLastPoint` `useCallback` body.
- **Clearing redoPoints on `cancel()`:** `INITIAL_STATE` already resets all fields including `redoPoints: []`, so this is automatic — no special handling needed.
- **Forgetting to register `repushLastPoint` in CanvasViewport's cleanup:** The cleanup function must call `setMarkupRedoHandler(null)` on unmount to avoid a stale reference. Mirrors the existing undo useEffect pattern exactly.
- **Separate useEffect per handler vs. combined:** Either works. The existing code uses a dedicated `useEffect` for the undo handler (lines 277-281). Follow the same pattern for redo — one `useEffect` per handler — for symmetry and testability.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Cross-component function bridging (no circular imports) | React context or Zustand function refs | Module-level ref pattern (`markup-undo-ref.ts`) — already established |
| In-progress vertex history | New Zustand slice | `redoPoints: StagePoint[]` field in `MarkupDrawState` (local hook state) |
| Keyboard shortcut interception | New event listener | Extend existing `useKeyboardShortcuts` dispatch tree |

---

## Common Pitfalls

### Pitfall 1: Cancel on one-point pop uses nested setState
**What goes wrong:** `popLastPoint` is itself invoked via `useCallback`. If `popLastPoint` calls `cancel()` inside a `setState` updater function, React will throw a nested-setState error in StrictMode.
**Why it happens:** The one-point path tempts you to write `setState(prev => { if (prev.points.length === 1) { cancel(); return prev; } ... })`.
**How to avoid:** Read `stateRef.current.points.length` before entering `setState`. If it is 1, call `cancel()` directly in the `useCallback` body (not inside the updater), then return `true`. Do not enter `setState` at all for the one-point path.
**Warning sign:** `Warning: Cannot update during an existing state transition` in dev console.

### Pitfall 2: redoPoints not cleared on recordClick causes stale repush
**What goes wrong:** User places P1, P2, P3, pops P3 (now in redoPoints), then places a new P3' at a different location, then presses Ctrl+Y — the old P3 re-appears at the wrong position instead of nothing happening.
**Why it happens:** `recordClick`'s setState updater doesn't reset `redoPoints` after appending the new point.
**How to avoid:** Add `redoPoints: []` to the return object of the `recordClick` setState updater (the linear/area/perimeter/wall branch only — count has its own path that doesn't use `points`).
**Warning sign:** Test: place 3 points, pop 1, place new point, verify `repushLastPoint()` returns `false`.

### Pitfall 3: stateRef.current lag in repushLastPoint
**What goes wrong:** `repushLastPoint` checks `stateRef.current.redoPoints.length === 0` for the early-exit guard, but since `stateRef` is updated in `useEffect` (one render later than `setState`), a rapid Ctrl+Y press immediately after a `setState` call might read a stale `redoPoints` and skip the repush.
**Why it happens:** Same stale-closure risk as documented in `popLastPoint`.
**How to avoid:** The double-guard pattern already used in `popLastPoint`: check `stateRef.current` for the early exit (returns false immediately if nothing to do), then check again inside `setState(prev => ...)` as the authoritative gate. The two-level guard ensures correctness even when stateRef lags.
**Warning sign:** Test: pop a point then immediately call repushLastPoint in the same `act()` block — it must succeed.

### Pitfall 4: repushLastPoint fires during 'confirming' mode
**What goes wrong:** After the naming popup opens (mode: 'confirming'), pressing Ctrl+Y re-adds a point to the hidden in-progress stack but does not change the visible UI because the naming popup is the active interaction.
**Why it happens:** The mode guard `if (current.mode !== 'drawing') return false` correctly prevents this — as long as the guard is not inadvertently removed.
**How to avoid:** Keep the `mode !== 'drawing'` guard as the first check in both `popLastPoint` and `repushLastPoint`. The naming/confirming flow is not part of Phase 10 scope.

### Pitfall 5: Missing UseMarkupToolReturn interface update
**What goes wrong:** `repushLastPoint` is implemented in `useMarkupTool` but not declared in the `UseMarkupToolReturn` interface — TypeScript will error at the CanvasViewport callsite where `{ repushLastPoint } = useMarkupTool(stageRef)`.
**Why it happens:** The interface at lines 64-81 must be updated in lockstep with the implementation.
**How to avoid:** Update `UseMarkupToolReturn` to include `repushLastPoint: () => boolean` alongside `popLastPoint`.

### Pitfall 6: Stale module-level redo ref after hot reload in dev
**What goes wrong:** During `electron-vite dev`, a hot reload of `markup-undo-ref.ts` resets `_markupRedoHandler` to null while `CanvasViewport` still holds its old reference. Subsequent Ctrl+Y presses fall through to `markupStore.redo()`.
**Why it happens:** Module-level state is reset on HMR module boundary replacement.
**How to avoid:** This is pre-existing behavior for the undo ref and has not been a practical problem. No special handling needed — after hot reload, the next render of `CanvasViewport` will re-run its `useEffect` and re-register the handler. Document as a known dev-only flicker.

---

## Code Examples

### Verified: existing popLastPoint (Phase 3 origin)
```typescript
// Source: src/renderer/src/hooks/useMarkupTool.ts lines 356-365 (verified 2026-05-19)
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

### Verified: existing undo ref pattern
```typescript
// Source: src/renderer/src/lib/markup-undo-ref.ts (verified 2026-05-19)
let _markupUndoHandler: (() => boolean) | null = null
export function setMarkupUndoHandler(handler: (() => boolean) | null): void {
  _markupUndoHandler = handler
}
export function getMarkupUndoHandler(): (() => boolean) | null {
  return _markupUndoHandler
}
```

### Verified: existing CanvasViewport useEffect wiring
```typescript
// Source: src/renderer/src/components/CanvasViewport.tsx lines 277-281 (verified 2026-05-19)
useEffect(() => {
  setMarkupUndoHandler(popLastPoint)
  return () => {
    setMarkupUndoHandler(null)
  }
}, [popLastPoint])
```

### Verified: existing Ctrl+Y dispatch (lines 114-119)
```typescript
// Source: src/renderer/src/hooks/useKeyboardShortcuts.ts (verified 2026-05-19)
if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
  if (isTextInputActive()) return
  e.preventDefault()
  useMarkupStore.getState().redo()
  return
}
```

---

## Runtime State Inventory

Phase 10 is a renderer-layer code change only. No rename, no refactor, no migration.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None | — |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | None | — |
| Build artifacts | None | — |

---

## Environment Availability

Phase 10 is renderer-only with no new external dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / Vitest | Test runner | Yes | vitest ^4.1.1 (confirmed) | — |
| npx vitest run | Quick test command | Yes | runs in 64s for 66 files | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/tests/markup-tool-point-redo.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MARK-09 (SC1) | Ctrl+Z in drawing mode pops last point, keeps tool active | unit | `npx vitest run src/tests/markup-tool-point-redo.test.ts` | Wave 0 |
| MARK-09 (SC2) | Ctrl+Y after Ctrl+Z re-adds most recently popped point | unit | `npx vitest run src/tests/markup-tool-point-redo.test.ts` | Wave 0 |
| MARK-09 (SC3) | Ctrl+Z on first point cancels markup (same as Escape) | unit | `npx vitest run src/tests/markup-tool-point-redo.test.ts` | Wave 0 |
| MARK-09 (SC4) | Post-commit Ctrl+Z / Ctrl+Y unchanged (markup-shortcuts.test.ts passes) | unit (existing) | `npx vitest run src/tests/markup-shortcuts.test.ts` | YES (existing) |
| MARK-09 (SC5) | repushLastPoint is tool-type-agnostic (linear, area, perimeter, wall) | unit | `npx vitest run src/tests/markup-tool-point-redo.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/tests/markup-tool-point-redo.test.ts src/tests/markup-tool-pop-last-point.test.ts src/tests/markup-shortcuts.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (66 test files, all pass) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/tests/markup-tool-point-redo.test.ts` — NEW; covers MARK-09 SC1-SC3+SC5; follows `markup-tool-pop-last-point.test.ts` pattern (jsdom, React act, HookHost probe, identity-transform stage shim)

Note: `src/tests/markup-tool-pop-last-point.test.ts` already covers `popLastPoint` returning `true`/`false` and the no-committed-markup-touch invariant. Phase 10 adds the `repushLastPoint` symmetric tests in a new file. The existing pop-last-point tests should continue to pass unchanged after Phase 10 (they do not cover the auto-cancel behavior, so if SC3 is implemented, an additional test case may also go in the new file or be appended to the existing one — the planner decides).

---

## Security Domain

Phase 10 is renderer-only UI state management with no external data, no IPC, no persistence, no input that reaches the network or filesystem. No ASVS categories apply.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MARK-09 (SC1) | While drawing a linear/area/perimeter/wall markup (mode:'drawing'), Ctrl+Z removes only the last placed point and keeps the tool active with all prior points intact | `popLastPoint` already exists; Phase 10 extends it with `redoPoints` tracking |
| MARK-09 (SC2) | After popping one or more points with Ctrl+Z during drawing, Ctrl+Y re-adds the most recently popped point — full in-progress undo/redo stack is navigable | New `repushLastPoint()` in `useMarkupTool` + `getMarkupRedoHandler` in keyboard dispatch |
| MARK-09 (SC3) | Ctrl+Z on the very first point of an in-progress markup cancels the whole markup (same as Escape), leaving the canvas clean | Extend `popLastPoint` to call `cancel()` when `points.length === 1` before popping |
| MARK-09 (SC4) | After a markup is fully committed (finished), Ctrl+Z and Ctrl+Y continue to work at whole-markup granularity — no change to post-commit undo/redo behaviour | `markupStore.undo()` / `markupStore.redo()` are the fallthrough paths; not changed |
| MARK-09 (SC5) | All five multi-point tools (linear, area, perimeter, wall, and any future tool) share the same in-progress point-pop/re-add logic — not duplicated per tool | `popLastPoint` and `repushLastPoint` are tool-type-agnostic; they operate on `state.points` regardless of `state.toolType` |
</phase_requirements>

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `stateRef` double-guard pattern (check ref outside setState + check prev inside setState) is sufficient to handle the StrictMode double-invoke issue for `repushLastPoint`, mirroring how `popLastPoint` handles it | Architecture Patterns, Pitfall 3 | Stale-state bug in dev mode; testable in the Wave 0 test via `act()` |

**All other claims verified by direct codebase read.**

---

## Open Questions

1. **Should the Wave 0 test go in a new file or append to `markup-tool-pop-last-point.test.ts`?**
   - What we know: the existing pop test already has the HookHost/probe/mount setup; appending would keep related tests co-located. A new file is cleaner for the planner's per-task scope.
   - What's unclear: project convention preference (no explicit rule found).
   - Recommendation: New file `markup-tool-point-redo.test.ts` — keeps Wave 0 diff scoped and makes it easy to run just the new tests during implementation.

2. **Should `redoPoints` survive a tool switch (e.g., activate() called with the same tool type while chain is armed)?**
   - What we know: `activate()` calls `setState({ ...INITIAL_STATE, mode: 'drawing', toolType: tool })` which resets `redoPoints` to `[]`. This means switching tools clears the in-progress redo history.
   - What's unclear: Whether a tool re-arm during chain mode (which preserves name/color) should also preserve redoPoints.
   - Recommendation: Do not preserve redoPoints across activate() calls. The redo history only makes sense for the current continuous drawing session. INITIAL_STATE reset is correct.

---

## Sources

### Primary (HIGH confidence — verified by direct file read)
- `src/renderer/src/hooks/useMarkupTool.ts` — `MarkupDrawState`, `INITIAL_STATE`, `popLastPoint`, `stateRef` double-guard pattern
- `src/renderer/src/lib/markup-undo-ref.ts` — module-level handler ref pattern
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — Ctrl+Z dispatch (lines 88-112), Ctrl+Y dispatch (lines 114-119)
- `src/renderer/src/components/CanvasViewport.tsx` — useEffect wiring of undo handler (lines 277-281)
- `src/renderer/src/stores/markupStore.ts` — post-commit `undo()` / `redo()` — confirmed unchanged by Phase 10
- `src/tests/markup-tool-pop-last-point.test.ts` — test pattern for HookHost/probe/mount (verified 2026-05-19)
- `src/tests/markup-shortcuts.test.ts` — existing MARK-09/10 integration gate tests (verified 2026-05-19)
- `npx vitest run` — confirmed 66 test files, 473 tests, all pass (baseline verified 2026-05-19)

### Secondary (MEDIUM confidence)
None — all findings are from direct codebase reads.

---

## Metadata

**Confidence breakdown:**
- Current state of `popLastPoint` and undo-ref: HIGH — direct file read, confirmed by test suite
- What is missing (no `repushLastPoint`, no redo-ref, no auto-cancel on SC3): HIGH — verified by grep across all source files
- Implementation approach (redoPoints field, stateRef guard, CanvasViewport wiring): HIGH — directly mirrors established patterns in the codebase
- Test baseline: HIGH — `npx vitest run` confirmed 473/473 pass

**Research date:** 2026-05-19
**Valid until:** Stable — this is code, not ecosystem; valid until codebase changes
