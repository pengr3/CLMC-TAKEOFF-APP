---
phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
plan: "02"
subsystem: canvas-interaction
tags: [selection, react-konva, keyboard-shortcuts, hover-ring, delete-key, ctrl-a]

requires:
  - phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
    plan: "00"
    provides: "selectedMarkupIds, setSelectedMarkupIds, clearSelection; deleteGroup(markups) with 'delete-group' MarkupCommand"
  - phase: 06-live-view-and-ui-polish
    provides: "HoverRing Konva Layer 2 component (white @ 40% panel-hover overlay)"
provides:
  - "Single-click selection ring on all 5 markup types (count, linear, area, perimeter, wall)"
  - "HoverRingProps gains optional color + opacity (defaults unchanged — hover overlay unaffected)"
  - "Delete key handler routing to deleteMarkup (single) or deleteGroup (multi) with mandatory clearSelection() after"
  - "Ctrl+A handler — select-all on current page in 'select' mode"
  - "Empty-canvas click and Escape deselect when activeTool === 'select'"
affects: [09-03, 09-04, 09-05]

tech-stack:
  added: []
  patterns:
    - "Selection ring layer is listening={false} so it never steals click events from the markup Group layer below (mirrors highlight-overlay-listening.test.ts regression contract from Plan 06-03)"
    - "Renderers are policy-free: onClick(id) is forwarded verbatim; the D-03 placement-priority guard lives in CanvasViewport.handleMarkupClick"
    - "Keyboard handler owns the selection lifecycle — clearSelection() is called after every delete so selectedMarkupIds never points at a removed markup (Wave 0 SUMMARY decision)"
    - "Single-id delete looks up the markup's page from markupStore.pageMarkups instead of trusting viewerStore.currentPage — page-scoped clear invariant guarantees correctness, but the lookup is defence in depth"
    - "Multi-id delete builds an id Set and filters across ALL pages via deleteGroup (single 'delete-group' undo entry — Wave 0 contract)"
    - "Escape extends the existing markup-cancel effect with a select-mode deselect branch; the existing flow ordering is preserved by an early return inside the markup-flow branch"

key-files:
  created: []
  modified:
    - src/renderer/src/components/HoverRing.tsx
    - src/renderer/src/components/markup/CountPinMarkup.tsx
    - src/renderer/src/components/markup/LinearMarkup.tsx
    - src/renderer/src/components/markup/AreaMarkup.tsx
    - src/renderer/src/components/markup/PerimeterMarkup.tsx
    - src/renderer/src/components/WallMarkup.tsx
    - src/renderer/src/components/CanvasViewport.tsx
    - src/renderer/src/hooks/useKeyboardShortcuts.ts

key-decisions:
  - "HoverRing color/opacity defaults left as RING_COLOR (#ffffff) and RING_OPACITY (0.4) so the panel-hover overlay is byte-identical to before — only callers passing explicit color/opacity see new visuals"
  - "Renderer onClick prop is optional and the renderers themselves carry no select-mode guard; CanvasViewport is the single policy point for D-03 (placement-takes-priority). This keeps the renderer surface clean and lets future tool modes change behavior without touching every Markup component"
  - "Selection ring rendered in its OWN <Layer listening={false}> (separate from the panel hover/pulse Layer 2). This avoids coupling the selection-ring lifecycle to the panel-driven hoverMatches state and keeps the contract obvious — selection ring exists iff selectedMarkupIds is non-empty"
  - "Delete key looks up the markup's page from markupStore.pageMarkups rather than trusting useViewerStore.currentPage. The Wave 0 page-scoped clear invariant makes this redundant in practice, but the explicit lookup is cheap and defence in depth against any future change to the invariant"
  - "Ctrl+A guards: isTextInputActive (preserves OS Select All in inputs), activeTool === 'select' (so Ctrl+A while drawing does NOT select markups behind the in-progress shape), and totalPages > 0 (no PDF → no markups, trivial no-op)"
  - "Escape-in-select-mode reads activeTool fresh from the store inside the handler instead of subscribing — keeps the effect deps list small and avoids handler re-mount churn every time the user clicks empty canvas"

patterns-established:
  - "HoverRing reuse for selection ring: a single Konva component now serves the panel-hover (white@40%) and click-select (accent@1.0) roles via optional color/opacity props. Future selection-related rings (e.g. rubber-band hit indicator) can plug into the same component"
  - "CanvasViewport carries the policy for any markup click — renderers stay purely presentational and accept onClick(id) without applying mode rules"
  - "Keyboard handlers that mutate markupStore in any way MUST end with useViewerStore.getState().clearSelection() before returning when selection is in play — selection ownership lives outside markupStore"

requirements-completed: []

duration: 22min
completed: 2026-05-18
---

# Phase 09 Plan 02: Wave 1 Selection Model — Click-to-select, Delete, Ctrl+A Summary

**Click any of the 5 markup types in 'select' mode to render an accent-colored selection ring; press Delete to remove the selected markup as a single undoable command; press Ctrl+A to select every markup on the current page; press Escape or click empty canvas to deselect — all without touching the existing hover/pulse overlays or the placement-priority contract.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 (both `type="auto"`)
- **Commits:** 2 atomic per-task commits
- **Files modified:** 8 source files, 0 created
- **Tests:** vitest suite 462 tests / 65 files all pass; `npm run typecheck` exits 0

## Accomplishments

- **HoverRing extended** — `HoverRingProps` gains optional `color?: string` and `opacity?: number`. Defaults preserve the existing panel-hover look exactly (white @ 0.4 opacity). Plan 06-03's `highlight-overlay-listening.test.ts` regression suite still passes unchanged.
- **5 markup renderers wired** — `CountPinMarkup`, `LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, and `WallMarkup` all now accept an optional `onClick?: (id: string) => void` prop forwarded from the outer Konva `Group`. Renderers carry NO policy — the D-03 guard is in CanvasViewport.
- **CanvasViewport selection wiring**:
  - `selectedMarkupIds` / `setSelectedMarkupIds` / `clearSelection` consumed from viewerStore
  - `handleMarkupClick(id)` — D-03 guard (early return when `activeTool !== 'select'`), then `setSelectedMarkupIds([id])`
  - `handleStageClick` — D-05 empty-stage click in 'select' mode calls `clearSelection()`
  - Escape key useEffect extended — when no markup flow is active and `activeTool === 'select'`, calls `clearSelection()`
  - All 5 markup renderer usages in Layer 1b receive `onClick={handleMarkupClick}`
  - New `<Layer listening={false}>` (after the panel hover/pulse Layer) mounts a HoverRing of the selected markups using `COLORS.accent` + opacity 1.0
- **Keyboard shortcuts**:
  - `Delete` — `isTextInputActive()` guard first; reads `selectedMarkupIds`; single-id routes through `deleteMarkup(page, id)` with a page lookup; multi-id routes through `deleteGroup(toDelete)` (single 'delete-group' undo entry per Wave 0); **clearSelection() is called unconditionally after** the delete branch so no stale id survives
  - `Ctrl+A` — `isTextInputActive()` guard preserves OS Select All in inputs; only fires when `activeTool === 'select'` AND a PDF is loaded; sets `selectedMarkupIds` to every id on the current page

## Task Commits

1. **Task 1 — HoverRing color/opacity + 5 renderer onClick** — `0f242b8` (feat)
2. **Task 2 — CanvasViewport selection wiring + Delete/Ctrl+A handlers** — `6211c13` (feat)

## Files Modified

- `src/renderer/src/components/HoverRing.tsx` — optional color + opacity props; defaults preserve existing behavior
- `src/renderer/src/components/markup/CountPinMarkup.tsx` — onClick prop + Group handler
- `src/renderer/src/components/markup/LinearMarkup.tsx` — onClick prop + Group handler
- `src/renderer/src/components/markup/AreaMarkup.tsx` — onClick prop + Group handler
- `src/renderer/src/components/markup/PerimeterMarkup.tsx` — onClick prop + Group handler
- `src/renderer/src/components/WallMarkup.tsx` — onClick prop + Group handler
- `src/renderer/src/components/CanvasViewport.tsx` — viewerStore selection selectors, handleMarkupClick, handleStageClick deselect branch, Escape useEffect deselect branch, onClick passed to all 5 markup renderers, new selection-ring Layer
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — Delete handler (single + group) with clearSelection follow-up, Ctrl+A handler

## Decisions Made

- **Renderer onClick is policy-free.** Putting the D-03 guard in `CanvasViewport.handleMarkupClick` means future tool-mode behavior changes (e.g. select-while-other-tool-active modifiers) live in one place. The 5 renderers are pure presentational forwarders.
- **Selection ring lives in its own Konva Layer**, not the existing panel-hover/pulse Layer. This decouples the lifecycle (selection ring exists iff `selectedMarkupIds.length > 0`) from the panel-driven `hoverMatches` state and keeps the listening={false} contract obvious — the new Layer is unambiguously load-bearing and has its own dedicated comment in the JSX.
- **Single-id delete looks up the markup's page** from `markupStore.pageMarkups` instead of trusting `useViewerStore.currentPage`. The Wave 0 page-scoped-clear invariant makes this redundant in practice, but the explicit lookup is cheap and provides defence in depth.
- **Escape reads activeTool fresh from the store** instead of subscribing. The effect's deps list stays minimal (`[markupState.mode, cancelMarkup, clearSelection]`), avoiding handler re-mount churn on every selection mutation.
- **Multi-id batches use `deleteGroup`** to produce a single 'delete-group' undo entry (Wave 0 contract). The Set-and-filter pattern across all pages mirrors the Wave 0 implementation and supports rubber-band multi-select results spanning pages (forward-compat for Plan 09-03's rubber-band introduction).

## Deviations from Plan

None - plan executed exactly as written.

The plan referenced `npm run test -- --run` as the verification command. The project has no `test` script in `package.json`; per the Wave 0 SUMMARY's tooling note, the canonical invocation is `npx vitest run`. Used that throughout; no source deviation.

## Issues Encountered

None on the source side. One operational note for future-me / verifier:

- **Worktree path discipline.** This agent initially ran Edit/Write with absolute paths pointing to the main repo root (`C:\Users\Admin\Roaming\CLMC TAKEOFF APP\src\...`) instead of the worktree (`C:\Users\Admin\Roaming\CLMC TAKEOFF APP\.claude\worktrees\agent-ab09c11a397713872\src\...`). Edits silently landed on the main repo's working tree while the worktree stayed clean. Recovered by `git -C <main-root> checkout -- <the 6 files>` (which restored the main repo to HEAD without touching the worktree), then re-applied the same edits using the worktree-rooted absolute paths. All commits in this plan are on the worktree branch as required; the main repo's working tree was not committed and contains only pre-existing unrelated modifications (`src/main/index.ts`, `src/renderer/src/App.tsx`). Future per-task commits assert `git rev-parse --show-toplevel` so the same drift cannot recur on the next plan.

## Self-Check: PASSED

Verified after writing SUMMARY:
- `src/renderer/src/components/HoverRing.tsx` contains `color?: string` and `opacity?: number` in HoverRingProps
- All 5 markup renderer files contain `onClick?: (id: string) => void` in their Props interface and forward it on the Group
- `src/renderer/src/components/CanvasViewport.tsx` contains `handleMarkupClick`, the selection-ring `<Layer listening={false}>` block with `color={COLORS.accent}` and `opacity={1.0}`, the Escape deselect branch, and `onClick={handleMarkupClick}` on all 5 markup renderer JSX usages
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` contains a `'Delete'` key handler with `isTextInputActive()` guard, a `Ctrl+A` handler, and `clearSelection()` after the delete branch
- Commits in git log: `0f242b8` (Task 1), `6211c13` (Task 2) on branch `worktree-agent-ab09c11a397713872`
- `npm run typecheck` exits 0; full vitest suite passes (462 tests across 65 files)
- No file deletions in either commit

## Next Phase Readiness

This plan's contract is consumed by Plan 09-03 (rubber-band multi-select), Plan 09-04 (selection-ring visual extensions if any), and any future plan that wants to read `selectedMarkupIds` from viewerStore. Specifically:
- Plan 09-03 can append rubber-band-selected ids to `setSelectedMarkupIds` and the existing selection-ring Layer will render them with zero additional wiring
- Plan 09-04's draggable-modal work is fully independent
- Plan 09-05's Enter-to-commit work is independent

No blockers. No CLAUDE.md violations. The renderer-policy-free contract and the keyboard-handler-owns-selection-lifecycle decisions establish the patterns Plan 09-03's rubber-band work should follow.

---
*Phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion*
*Completed: 2026-05-18*
