---
phase: 18-toolbar-revamp
plan: 09
reviewed: 2026-07-16T05:05:47Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/renderer/src/App.tsx
  - src/renderer/src/components/CanvasViewport.tsx
  - src/renderer/src/hooks/useKeyboardShortcuts.ts
  - src/renderer/src/components/ContextBar.tsx
  - src/renderer/src/components/ToolRail.tsx
  - src/renderer/src/stores/viewerStore.ts
findings:
  high: 0
  medium: 1
  low: 4
  total: 5
status: issues_found
---

# Phase 18 · Plan 09: Code Review Report

**Reviewed:** 2026-07-16T05:05:47Z
**Depth:** standard (with cross-file tracing of the keyboard-shortcut / arc-seam / HMR seams)
**Files Reviewed:** 6
**Status:** issues_found — **no blocking findings**

## Summary

The 18-09 integration + F3 debug-loop changes are sound on their headline claims. I verified the three focus areas the task called out and all three hold:

1. **Single keyboard-shortcut owner — CONFIRMED.** `useKeyboardShortcuts` is called in exactly one production location, `App.tsx:351`. `CanvasViewport` now imports only `isTextInputActive` (the hook call and its `usePdfDocument`/`openPdfDialog` import were removed in `8f0cc54`). Every shortcut previously reachable is still wired: file ops → App handlers; zoom (`Ctrl+=`/`-`/`0`) → `getCanvasControls()?.zoomIn/zoomOut/fitToWindow`, which reads the `_canvasControls` object `CanvasViewport` registers in its effect (`CanvasViewport.tsx:1111-1116`); undo/redo/delete/select-all/snap(F3)/arc(A/Shift+A)/nav are internal to the hook. The zoom path is safe because those branches are guarded by `if (totalPages === 0) return`, so they only fire while a PDF is open — i.e. while `CanvasViewport` is mounted and `_canvasControls` is non-null (and the `?.` optional chain covers the mount/StrictMode transient window).

2. **HMR store-singleton guard is dev-only — CONFIRMED.** `viewerStore.ts:178-192` gates everything on `import.meta.hot`. In a production build `import.meta.hot` is `undefined`, so `import.meta.hot?.data?.store` short-circuits to `?? createViewerStore()` and the whole `if (import.meta.hot) {…}` block is dead code the bundler strips. Under Vitest the stub's `data` is `undefined`, so both the read and the persistence guard fall through to a fresh store. Cannot affect prod or test correctness.

3. **`useKeyboardShortcuts` register-once refactor is sound.** Latest-ref pattern (`handlersRef`/`totalPagesRef` updated every render, listeners registered under `[]`) eliminates the add/remove listener churn without staleness. Cleanup removes all three listeners; StrictMode double-mount is leak-free.

Cleanup is clean: all four retired components + the orphaned test are deleted, and no `import` of any deleted symbol remains (only comments/test-descriptions reference the old names).

The findings below are all non-blocking quality/robustness issues. The one worth fixing is the ContextBar Delete leaving a dangling selection.

## Medium

### MR-01: ContextBar "Delete" leaves `selectedMarkupIds` dangling → stuck "Selected" morph state

**File:** `src/renderer/src/components/ContextBar.tsx:348-355`
**Issue:** The selected-panel Delete button calls `useMarkupStore.getState().deleteMarkup(selected.page, selected.id)` but never clears the viewer-store selection. `deleteMarkup` (markupStore.ts:495-505) deliberately does **not** touch `viewerStore` (documented cross-store-decoupling), and the keyboard Delete handler compensates by calling `clearSelection()` immediately after delete precisely to uphold the invariant "`selectedMarkupIds` never points at a removed markup" (`useKeyboardShortcuts.ts:193-197`). The ContextBar path skips that step. Because the `selected` morph state is `activeTool === 'select' && selectedMarkupIds.length > 0`, after a ContextBar delete the id is still present, so the bar re-renders in the selected state, `SelectedPanel` resolves `pageMarkups.find(... deletedId)` to `undefined`, and it falls back to a bare `<span>Selected</span>` pill. The bar is stuck showing an empty "SELECTED" pill until the user clicks empty canvas (which calls `clearSelection`) or presses Delete again. This differs from — and is worse than — the right-click `MarkupContextMenu` "parity" source (`CanvasViewport.tsx:2727-2729`): a right-click does not select the markup, so that path never produces a dangling selection.
**Fix:** Clear selection after the delete, matching the keyboard handler:
```tsx
onClick={() => {
  const { page, id } = selected
  useMarkupStore.getState().deleteMarkup(page, id)
  useViewerStore.getState().clearSelection()
}}
```
(`useViewerStore` is already imported in this file.)

## Low

### LW-01: `openPdfDialog` is now dead code and still carries `console.log` debug artifacts

**File:** `src/renderer/src/hooks/usePdfDocument.ts:60-68` (orphaned by the reviewed change in `CanvasViewport.tsx`)
**Issue:** The F3 fix (`8f0cc54`) removed `CanvasViewport`'s only call to `openPdfDialog`. A repo-wide grep confirms it now has zero consumers — it is exported from `usePdfDocument` but never invoked. It also contains two `console.log('[PDF] …')` statements (lines 61, 63) that would ship in the prod bundle if ever revived. This is dead code left behind by the component-deletion / F3-cleanup work the plan is responsible for.
**Fix:** Remove `openPdfDialog` from the hook (and drop it from the returned object at line 68). If the dialog helper is intended for future use, at minimum strip the `console.log` lines. Note `usePdfDocument.ts` is outside the 6 named files but is a direct consequence of the reviewed change.

### LW-02: Arc-sticky seam has no unmount reset, yet the always-mounted ToolRail can show a stale "Arc: on" pill with an unclickable toggle

**File:** `src/renderer/src/components/CanvasViewport.tsx:405-407` (+ `ToolRail.tsx:377-385`, `ContextBar.tsx:388-397`)
**Issue:** The comment on the arc-sticky publish effect justifies having no cleanup by asserting "the toggle chrome is not visible without the canvas." That premise is inaccurate: `ToolRail` (and `ContextBar`) are prepended as persistent siblings in `<main>` and render even when `totalPages === 0` (EmptyState). If a project is closed/reset while sticky-arc was on, `CanvasViewport` unmounts and the seam retains its last `true`, so the rail's Arc pill stays lit — while `getArcStickyToggleHandler()` is now `null`, so clicking it is a no-op and the user cannot turn it off until a new project mounts `CanvasViewport` (whose mount effect re-publishes the fresh `arcMode`). Cosmetic + minor stuck-control; self-heals on next PDF open. Snap does not have this issue because it is pure store state.
**Fix:** Reset the seam on unmount: `return () => setArcStickyState(false)` in the effect, or gate the rail/context Arc toggle `disabled`/hidden on `totalPages === 0` (mirroring how the markup tool buttons are already disabled).

### LW-03: Dead legacy `toolbarHeight` constant + comment referencing the deleted `RibbonToolbar`

**File:** `src/renderer/src/lib/constants.ts:28`
**Issue:** `toolbarHeight: 40` carries the comment "legacy — RibbonToolbar governs its own height; this value is not consumed by any component." `RibbonToolbar` was deleted in this plan, so both the value and its comment are now dangling references to a removed component. Not one of the 6 named files but a leftover from the same deletion sweep.
**Fix:** Delete the `toolbarHeight` field (and its comment) after confirming no runtime consumer, or update the comment to drop the `RibbonToolbar` reference.

### LW-04: Seven Phase-18 component test files fail cross-machine (`window.localStorage.clear is not a function`)

**File:** test suite (`context-bar-edit`, `context-bar-morph`, `status-line`, `top-action-bar-file-ops`, `top-action-bar-nav`, `view-mode-toggle`, `visibility-markdirty`)
**Issue:** As flagged in `18-09-SUMMARY.md`, these call `window.localStorage.clear()` instead of installing the in-memory `localStorage` polyfill the rest of the suite uses, so they fail on machines whose jsdom setup lacks a real `localStorage`. Confirmed pre-existing (fails identically at HEAD), so it does not gate this plan, but it means the phase's own regression coverage is not reliably green cross-machine — the "keyboard-shortcut tests pass" claim depends on which machine runs them.
**Fix:** Standardize these seven files on the shared in-memory `localStorage` polyfill used by the passing test files (follow-up already noted in the summary).

---

## Verified Sound (no action needed)

- **App.tsx is the sole `useKeyboardShortcuts` caller** (grep-confirmed). No shortcut behavior lost by removing `CanvasViewport`'s call; zoom correctly wired via `getCanvasControls()`.
- **HMR guard cannot affect prod/test** — fully gated behind `import.meta.hot`; dead-code-stripped in prod.
- **Register-once listener refactor** — latest-ref pattern, mount-only effect, full cleanup, no churn, no leak, StrictMode-safe.
- **Component deletions clean** — 4 components + orphaned test removed; no dangling imports of any deleted symbol.
- **ToolRail / ContextBar Snap+Arc toggles** correctly share `viewerStore.snapEnabled` (F3) and the reactive arc seam (`useSyncExternalStore(subscribeArcSticky, getArcSticky)`), so keyboard and click stay in sync.
- **Mount-preserving Konva subtree intact** — `ToolRail` prepended as a sibling column; the `display: viewMode` swap and `minWidth: 0` floors are structurally untouched (Pitfall 4 respected).

---

_Reviewed: 2026-07-16T05:05:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
