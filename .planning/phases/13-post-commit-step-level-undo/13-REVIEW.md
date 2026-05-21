---
phase: 13-post-commit-step-level-undo
reviewed: 2026-05-21T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/renderer/src/types/markup.ts
  - src/renderer/src/lib/markup-reopen-ref.ts
  - src/renderer/src/stores/markupStore.ts
  - src/renderer/src/hooks/useMarkupTool.ts
  - src/renderer/src/hooks/useKeyboardShortcuts.ts
  - src/renderer/src/components/CanvasViewport.tsx
  - src/renderer/src/App.tsx
  - src/tests/markup-post-commit-reopen.test.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** deep (cross-file analysis including state-machine integrity, dispatch order, ref lifecycle, and dep-array correctness)
**Files Reviewed:** 8 (7 production + 1 test)
**Status:** issues_found

## Summary

Phase 13 ships a tight, well-decomposed feature: `isMultiPointMarkup` guard, `reopen-recommit` command variant, `markup-reopen-ref` module, store actions (`commitReopen` / `removeForReopen` / `restoreFromReopen`), and the dispatch tree extension (`useKeyboardShortcuts`, `useMarkupTool.activatePreset`, `useMarkupTool.commitShape`, `CanvasViewport` reopen handler + page-nav cancel, `App.tsx` toast). All 23 phase tests pass and the full suite (534/534) is green.

That said, the integration surface contains **two correctness defects** the unit tests cannot catch because they mount `HookHost` (useMarkupTool only) and never `CanvasViewport`:

1. **CR-01 (BLOCKER):** The reopen handler does not call `setActiveTool` to align `viewerStore.activeTool` with `markupState.toolType`. After a chain → Esc → Ctrl+Z sequence, `activeTool === 'select'` while the reopen drives `markupState.mode === 'drawing'`. CanvasViewport's existing tool-sync useEffect at lines 516-522 then fires `cancelMarkup()` and wipes the seed.
2. **CR-02 (BLOCKER):** `popLastPoint` cascades to `cancel()` when it reaches the last point. That resets `useMarkupTool` to `INITIAL_STATE` but leaves `_reopenSnapshot` set. A subsequent Ctrl+Z (top of stack now belongs to a different markup) will overwrite the orphaned snapshot via `setReopenSnapshot(...)` — the original markup is permanently lost.

Other findings are sub-blocker (project-hydration leak, missing `pushCommand` cap on Esc re-push, unused imports, dep-array omissions). Comment-vs-code drift exists at two sites where copied JSDoc still says "Plan 13-02 adds it (RED)" or "RED until Plan 13-03".

## Critical Issues

### CR-01: Reopen handler omits `setActiveTool` — chain → Esc → Ctrl+Z immediately self-cancels

**File:** `src/renderer/src/components/CanvasViewport.tsx:339-386` (reopen handler) and `src/renderer/src/components/CanvasViewport.tsx:516-522` (tool-sync useEffect)
**Issue:**

Production path that reproduces:

1. User picks the Linear tool → `viewerStore.activeTool = 'linear'`. Draws and Enter-commits markup A. Chain mode keeps `markupState.mode === 'drawing'`.
2. User presses Esc to drop out of chain. The Esc handler at `CanvasViewport.tsx:737` calls `cancelMarkup()` (mode → `'idle'`, toolType → `null`) then `setActiveTool('select')`. Now `activeTool === 'select'`, `markupState.mode === 'idle'`.
3. User presses Ctrl+Z to re-open. The reopen handler at lines 339-386 sets the snapshot, removes the markup, pops the place command, clears selection/vertex-edit, calls `activatePreset(...)`. `activatePreset` sets `markupState.mode = 'drawing'` and `markupState.toolType = 'linear'`. The handler does NOT touch `viewerStore.activeTool`.
4. React commits the state changes. The tool-sync useEffect at lines 516-522 fires (deps include `markupState.toolType`, `markupState.mode`):

```js
} else if (!isMarkupTool(activeTool) && markupState.mode !== 'idle') {
  cancelMarkup()
}
```

`isMarkupTool('select') === false` and `markupState.mode === 'drawing' !== 'idle'` → `cancelMarkup()` fires → state wiped to `INITIAL_STATE`. The re-open is silently erased one tick after it appears.

The user sees: original markup vanishes (correct, `removeForReopen` ran), no in-progress preview (state was wiped), undo stack changed (place was popped). Esc would still work because `_reopenSnapshot` is still set — but until they press Esc, the canvas reads as "you just deleted a markup with no recovery path visible".

Not caught by the unit tests because `HookHost` does not mount `CanvasViewport` and so does not run the tool-sync effect. The `chainArmedFromTotals` path at `App.tsx:281-289` documents the same coupling ("MUST call setChainArmedFromTotals BEFORE setActiveTool — ordering critical") and explicitly calls `setActiveTool(toolType)` after `activatePreset` for exactly this reason.

**Fix:** Have the reopen handler set `activeTool` before/while calling `activatePreset` so the tool-sync effect's idle-→non-idle branch sees `isMarkupTool(activeTool) === true` and short-circuits:

```ts
// In CanvasViewport.tsx, inside the reopen handler around line 372, before activatePreset(...)
useViewerStore.getState().setActiveTool(tool)
activatePreset(tool, {
  name: original.name,
  categoryName: cat?.name ?? '',
  color: original.color,
  points: original.type === 'count' ? undefined : original.points,
  wallHeight: original.type === 'wall' ? original.wallHeight : undefined
})
```

Then add a regression test that mounts the real handler chain (or asserts `useViewerStore.getState().activeTool === tool` after re-open).

---

### CR-02: `popLastPoint` cascades into `cancel()` and orphans `_reopenSnapshot`

**File:** `src/renderer/src/hooks/useMarkupTool.ts:393-413` (popLastPoint) + `src/renderer/src/lib/markup-reopen-ref.ts:43-50` (snapshot)
**Issue:**

During an active re-open of a multi-point markup, the user pops points with Ctrl+Z. `popLastPoint` at line 398-401:

```js
if (current.points.length === 1) {
  cancel()
  return true
}
```

`cancel()` is `setState(INITIAL_STATE)` (line 178). It does NOT clear `_reopenSnapshot` because the snapshot lives in `markup-reopen-ref.ts` and the only code that clears it is `commitShape` (line 369), the useMarkupTool Esc listener (line 452), the CanvasViewport page-nav effect (line 662), and the reopen handler itself (which only ever sets it).

Reproduction (2-point linear or any wall — wall is min 2 points):

1. Commit a 2-point wall markup.
2. Ctrl+Z → re-open. `markupState.points.length === 2`. `_reopenSnapshot` holds the original.
3. Ctrl+Z (point 2 popped) → `popLastPoint`. points = [a]. length === 1.
4. Ctrl+Z (would pop point 1) → `popLastPoint` enters the `points.length === 1` branch → `cancel()`. `markupState` is now `INITIAL_STATE` (mode = 'idle', toolType = null, points = []). `_reopenSnapshot` is still the original wall markup.

User now sees an empty canvas, idle tool, no in-progress preview. From here:

- Press Esc → useMarkupTool's Esc listener restores correctly. Recovery path works.
- Press Ctrl+Z again → the reopen handler runs. `markupState.mode === 'idle'` ✓. Top of stack is whatever was at `undoStack[-2]` before the original was popped — say a place of markup B. If B is a multi-point markup on the current page, the handler fires: `setReopenSnapshot(B)` overwrites the original A snapshot. A's snapshot is permanently lost; A's data is permanently gone from `pageMarkups`. Subsequent Esc would restore B (good for B, but A is unrecoverable). Subsequent Enter would commit-reopen B, dispatching `reopen-recommit` with `oldMarkup = B, newMarkup = currentDrawing`.

Even without a second Ctrl+Z, the orphaned snapshot leaks state across the next session. Any subsequent commit will dispatch `commitReopen(staleSnapshot, newMarkup)` instead of `placeMarkup(newMarkup)`, creating a `reopen-recommit` command with a stale `oldMarkup` that may already be on the page or may not.

Unit tests do not catch this: SC2 (`markup-post-commit-reopen.test.ts:405-454`) pops twice on a 3-point markup (3 → 2 → 1), never the third time that would trigger `cancel()`.

**Fix:** When `popLastPoint` is about to bottom-out, treat it as an implicit Esc: restore + re-push place + clear snapshot. Either:

```ts
const popLastPoint = useCallback((): boolean => {
  const current = stateRef.current
  if (current.mode !== 'drawing') return false
  if (current.points.length === 0) return false
  if (current.points.length === 1) {
    // Phase 13: if mid re-open, snapshot must be restored (parallel to Esc semantics
    // — popping past the seeded points is a user-initiated abandon of the gesture).
    const snapshot = getReopenSnapshot()
    if (snapshot) {
      useMarkupStore.getState().restoreFromReopen(snapshot)
      useMarkupStore.setState((s) => ({
        undoStack: [...s.undoStack, { type: 'place', markup: snapshot }]
      }))
      setReopenSnapshot(null)
    }
    cancel()
    return true
  }
  // ... existing path
}, [cancel])
```

Or simpler: in `cancel()`, clear the snapshot too — but that re-opens the question of whether `cancel()` should also re-push the place command. The cleanest move is for any user-initiated abandon of the gesture (Esc, page-nav, pop-to-zero, project-hydrate) to share one helper that does {restore, re-push place, clear snapshot, INITIAL_STATE, setActiveTool('select')}.

Add a regression test: re-open a 2-point wall, pop twice, assert `getReopenSnapshot() === null` AND undo-stack tail is the original `place` AND pageMarkups contains the original wall by id.

## Warnings

### WR-01: Esc-restore and page-nav restore bypass `pushCommand` — UNDO_STACK_MAX silently exceeded under saturation

**File:** `src/renderer/src/hooks/useMarkupTool.ts:449-451` and `src/renderer/src/components/CanvasViewport.tsx:659-661`
**Issue:** Both Esc listeners reconstruct the undo stack with `[...s.undoStack, { type: 'place', markup: snapshot }]` instead of routing through `pushCommand` (which caps at `UNDO_STACK_MAX = 50`). The re-open trigger pops the place command at line 364, then Esc/page-nav re-pushes it — symmetric, so size stays at N. But the symmetry only holds if no other command lands on the stack mid-gesture. Any code path that mutates `undoStack` between trigger and Esc (e.g. an autosave hook, a future feature, an HMR-induced double-dispatch) would let the re-push exceed 50. Not catastrophic — but the cap was deliberate (`STATE.md` §"UNDO_STACK_MAX=50") and silently violating it via direct `setState` undoes the discipline.

**Fix:** Either export `pushCommand` or add a thin store action (e.g. `repushPlaceForReopenCancel(markup)`) that internally uses `pushCommand`:

```ts
// markupStore.ts
repushPlaceForReopenCancel: (markup: Markup) =>
  set((s) => ({
    undoStack: pushCommand(s.undoStack, { type: 'place', markup })
  })),
```

### WR-02: `markup-reopen-ref` is not cleared on project hydrate/reset — stale snapshot survives "Open Project"

**File:** `src/renderer/src/lib/markup-reopen-ref.ts:43-50` and `src/renderer/src/stores/markupStore.ts:647-664`
**Issue:** `markupStore.reset()` and `markupStore.hydrate()` wipe `pageMarkups`, `categories`, `undoStack`, and `redoStack` — but neither touches `_reopenSnapshot` (and neither does `_markupReopenHandler`). If the user is mid re-open and opens another project, the snapshot survives. The next Esc dispatch in the new project would call `restoreFromReopen(staleSnapshot)` which puts a markup belonging to the OLD project's id-space onto a page in the NEW project. The undoStack would also get a stale `place` command re-pushed. Hard to trigger via the UI today (Esc requires being in `mode:'drawing'` and project-open should reset that path), but the module-ref discipline established by Phase 10 (`markup-undo-ref`) treats this kind of stale state as the canonical leak pattern (RESEARCH §Pitfall 9). Module refs that outlive the surrounding store are a hazard.

**Fix:** Clear the snapshot inside `markupStore.reset()` and `markupStore.hydrate()` (call `setReopenSnapshot(null)` from those actions, or expose a `clearReopenState()` helper), and document the invariant: any code path that wipes `undoStack` must wipe the reopen snapshot too. CanvasViewport's page-nav effect already does the right thing (lines 656-664) — generalise the discipline.

### WR-03: CanvasViewport page-nav useEffect missing several stable deps (ESLint react-hooks would flag)

**File:** `src/renderer/src/components/CanvasViewport.tsx:651-682`
**Issue:** The effect uses `cancelMarkup`, `clearVertexEdit`, `setDragPreview`, and `props.onPulseComplete` but lists only `[currentPage]` in deps. The first three are stable useCallbacks (so behaviourally OK today) but `props.onPulseComplete` is a parent-supplied prop with no guaranteed identity stability — App.tsx passes `clearPulse` from `useMarkupHighlight()` and that hook's return is recreated on every render unless wrapped. If `onPulseComplete` identity changes between renders, this effect will still call the stale reference. More importantly, the rule existed to catch the next person who adds a non-stable callback. Same shape exists for the reopen-handler effect at line 386 (deps `[markupState.mode, activatePreset, clearSelection, clearVertexEdit, props.onReopenToast]`) — that one IS complete, so the inconsistency is the page-nav effect being underspecified.

**Fix:** Either list every closure-captured value in deps and confirm stable identities, or wrap the effect body's stale-prone callbacks in a ref. Recommend adding the deps and confirming `useMarkupHighlight` returns stable identities (or memoising at the call site).

### WR-04: Test EDGE-3 / EDGE-4 assert preconditions, not handler behaviour

**File:** `src/tests/markup-post-commit-reopen.test.ts:844-879`
**Issue:** EDGE-3 ("vertex-edit blocks reopen") and EDGE-4 ("cross-page blocks reopen") set up state and assert the runtime check (`useViewerStore.getState().vertexEditMarkupId !== null` is true, or `top.markup.page !== currentPage` is true). They never invoke the reopen handler and assert it returned `false` and left state unchanged. As written, they would pass even if the handler ignored these conditions entirely. If a future refactor inverts a comparison in the handler, these tests would not catch it.

**Fix:** After Plan 13-03 wired the handler, these tests should be upgraded to either (a) call `getMarkupReopenHandler()?.()` directly and assert the return is `false` and `getReopenSnapshot() === null`, or (b) dispatch a Ctrl+Z keydown and assert the same. Currently EDGE-1 is the only EDGE test that exercises the actual guard (`isMultiPointMarkup`), and even that doesn't exercise the handler. Not blocking shipping, but the gap should be closed before a future change touches `D-17` conditions.

### WR-05: Duplicate Esc listener on `window` — both useMarkupTool and CanvasViewport register independent keydown handlers

**File:** `src/renderer/src/hooks/useMarkupTool.ts:443-461` and `src/renderer/src/components/CanvasViewport.tsx:710-790`
**Issue:** Two separate `window.addEventListener('keydown', ...)` registrations both handle `Escape`. The deviation is documented in `13-03-SUMMARY.md` as a Rule-3 fix for the SC4 e2e test. In production both fire on every key press (not just Esc — useMarkupTool's listener pays the cost of dispatching to its handler on every key, then no-ops); useMarkupTool's listener runs first because effect order is "hook first, then component body". The handlers are described as idempotent — and they are, given current code. But:

- Neither listener calls `e.stopPropagation()` or `e.stopImmediatePropagation()`. If either becomes non-idempotent in the future (someone adds a side effect to `cancel()` or the CanvasViewport Esc branch), the double-fire becomes a double side-effect.
- The deviation effectively says "we have two Esc handlers but trust that they remain idempotent forever". That's a maintainability hazard.
- The CanvasViewport handler's comment at lines 722-728 explains the split but the comment lives 80 lines away from the useMarkupTool listener it depends on. A new contributor editing one will not see the other.

**Fix:** Either (a) lift the snapshot-Esc branch back into CanvasViewport.tsx and have the SC4 test mount a thin component that registers it (closer to production), or (b) accept the duplication but add `e.stopImmediatePropagation()` in useMarkupTool's listener so only that handler runs, and update the CanvasViewport handler's comment to make the contract explicit ("if snapshot is held, useMarkupTool owns the Esc; this listener only fires the mode-based tail for non-reopen Esc"). Today's "trust idempotency" arrangement is brittle.

## Info

### IN-01: Magic number `2500` ms and `148` px lack named constants

**File:** `src/renderer/src/App.tsx:145` (`2500`) and `src/renderer/src/App.tsx:419` (`bottom: 148`)
**Issue:** D-19 (toast lifetime) and D-20 (toast stacking offsets) are both pegged to magic numbers. The save/export toasts use `2000` directly too, so the codebase already has the same pattern — but if D-19 ever changes or another toast slot is added, the 4-toast stack of bottom offsets (16 / 60 / 104 / 148) is implicit and easy to mis-step. Recommend extracting:

```ts
const TOAST_AUTO_DISMISS_MS = 2500           // D-19
const TOAST_REOPEN_BOTTOM_PX = 148           // D-20 — 4th toast slot
```

at the top of App.tsx. Same critique would apply to existing 2000ms toasts but that's pre-existing.

### IN-02: Comment drift — outdated "RED until Plan 13-03" notes in shipped code

**File:** `src/tests/markup-post-commit-reopen.test.ts:14-17, 121-124, 290, 646, 653`
**Issue:** Multiple comments still say "RED until Plan 13-03 Task 3" / "Plan 13-02 adds it (RED)" / "RED-safe — no Plan-13-02/03 surface required". These were accurate at Wave 0 commit time but Phase 13 has now landed (all 23 tests green). The `@ts-expect-error` comments still claim the production code is missing. The test file would benefit from a sweep that either removes the now-stale annotations or replaces them with a single "// kept for historical RED-state documentation". Today's reader cannot tell whether a `@ts-expect-error` is intentional (still failing) or vestigial (passes today, comment stale).

**Fix:** Walk through every `@ts-expect-error — Plan 13-02 adds it (RED)` and verify; remove the suppression if the symbol now exists (commitReopen, removeForReopen, restoreFromReopen all exist after Plan 13-02). The `importReopenRef` dynamic-import gymnastics are also unnecessary now that `@renderer/lib/markup-reopen-ref` exists — replace with a direct top-level import.

### IN-03: `seedCommittedCount` helper is defined but only used by EDGE-1; consider colocating or comment-tagging

**File:** `src/tests/markup-post-commit-reopen.test.ts:252-269`
**Issue:** Minor. Helper is fine; just a note that the test file is 893 lines and several helpers (e.g. seedCommittedArea / seedCommittedPerimeter / seedCommittedCount) have a single call site each. Not worth refactoring, but if the file grows, consider extracting helpers into a `markup-test-helpers.ts` shared fixture.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
