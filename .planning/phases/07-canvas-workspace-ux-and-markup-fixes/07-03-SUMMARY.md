---
phase: 07-canvas-workspace-ux-and-markup-fixes
plan: "03"
subsystem: canvas-ui
tags: [edit-markup, context-menu, undo-redo, command-pattern, tdd-green, wave-3, d-04, d-05, d-06, d-07]
dependency_graph:
  requires:
    - "07-02"  # Wave 2 MarkupNamePopup edit mode + D-12/D-13 keyboard wiring
  provides:
    - EditMarkupCommand discriminant in MarkupCommand union (markup.ts)
    - editMarkup store action with getOrCreateCategory pre-resolution and pushCommand integration
    - undo() edit-markup branch before cmd.markup.page fallthrough (Landmine 1 mitigated)
    - redo() edit-markup branch with symmetric pattern
    - MarkupContextMenu onEdit prop and Edit button as first menuitem
    - CanvasViewport editPopup state and MarkupNamePopup mode='edit' mount wiring
    - Full Vitest suite GREEN — 424/424 tests pass (all Wave 0 RED tests now GREEN)
  affects:
    - src/renderer/src/types/markup.ts
    - src/renderer/src/stores/markupStore.ts
    - src/renderer/src/components/MarkupContextMenu.tsx
    - src/renderer/src/components/CanvasViewport.tsx
tech_stack:
  added: []
  patterns:
    - "EditMarkupCommand stores string category names (not IDs) — avoids stale reference on undo/redo round-trip (Pitfall 2 from RESEARCH.md)"
    - "getOrCreateCategory resolved BEFORE entering set() in editMarkup — avoids nested set() calls that would trigger Zustand's dead-lock guard"
    - "Explicit early-return if (cmd.type === 'edit-markup') in undo()/redo() — prevents fallthrough to cmd.markup.page (Landmine 1 pattern)"
    - "editPopup coords subtract getBoundingClientRect().left/top from contextMenu viewport coords — container-relative position for MarkupNamePopup (Landmine 4 pattern)"
    - "IIFE pattern for editPopup JSX block — allows imperative find+resolve before rendering MarkupNamePopup without lifting state"
    - "setEditPopup(null) in handleContextMenu — closes edit popup before new context menu opens (D-04 UX requirement)"
key_files:
  created: []
  modified:
    - src/renderer/src/types/markup.ts
    - src/renderer/src/stores/markupStore.ts
    - src/renderer/src/components/MarkupContextMenu.tsx
    - src/renderer/src/components/CanvasViewport.tsx
decisions:
  - "EditMarkupCommand stores oldCategoryName/newCategoryName as strings (not IDs) — category IDs are ephemeral (UUID per-session); names are the stable round-trip anchor. Matches RESEARCH.md Pitfall 2 recommendation."
  - "getOrCreateCategory called outside set() in editMarkup action — Zustand's set() is not reentrant; calling getOrCreateCategory (which internally calls set()) inside another set() would silently no-op or error. Pre-resolution is the correct pattern used by recolorGroup analog."
  - "Edit button inserted as FIRST menuitem in MarkupContextMenu before the Recolor group section — matches D-04 requirement: edit is the most common post-commit action and must be discoverable immediately."
  - "setEditPopup(null) added to page-change useEffect alongside setContextMenu(null) — prevents stale edit popup from persisting across page navigation."
metrics:
  duration: "8m"
  completed: "2026-05-13"
  tasks_completed: 2
  files_modified: 4
---

# Phase 07 Plan 03: Post-Commit Markup Editing — EditMarkupCommand, Store Action, ContextMenu, CanvasViewport Wiring Summary

End-to-end post-commit markup editing: EditMarkupCommand type appended to MarkupCommand union; editMarkup store action with full undo/redo support using string-based category name storage; MarkupContextMenu gains Edit as first menuitem; CanvasViewport mounts MarkupNamePopup mode='edit' at container-relative coordinates via getBoundingClientRect offset correction — all Wave 0 RED tests (9 failing) are now GREEN (424/424 full suite).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend MarkupCommand union and add editMarkup store action with undo/redo | d65f4d8 | markup.ts, markupStore.ts |
| 2 | Wire MarkupContextMenu onEdit prop and CanvasViewport editPopup state with MarkupNamePopup mode='edit' mount | 9e23755 | MarkupContextMenu.tsx, CanvasViewport.tsx |

## Verification Results

- `npx vitest run src/tests/markup-commands.test.ts` — exits 0 (29/29 pass; 7 new editMarkup RED tests now GREEN)
- `npx vitest run src/tests/markup-context-menu.test.ts` — exits 0 (both Edit menuitem RED tests now GREEN)
- `npx vitest run` — exits 0 (424/424 pass — all Wave 0 RED tests GREEN, no regressions)
- `npx tsc --noEmit` — exits 0 (no TypeScript errors; exhaustive union handling verified)

## Must-Haves Verified

- [x] MarkupCommand union in markup.ts includes `type: 'edit-markup'` discriminant with markupId, page, oldName, oldCategoryName, oldColor, newName, newCategoryName, newColor fields
- [x] markup.ts does NOT store oldCategoryId or newCategoryId (string category names only)
- [x] markupStore.ts has editMarkup action that calls get().getOrCreateCategory(newCategoryName) before set()
- [x] markupStore.ts editMarkup inside set(): finds target, builds updated markup, pushes EditMarkupCommand via pushCommand, clears redoStack
- [x] markupStore.ts undo() contains `if (cmd.type === 'edit-markup')` branch with early return before cmd.markup.page fallthrough (Landmine 1 mitigated)
- [x] markupStore.ts redo() contains `if (cmd.type === 'edit-markup')` branch with early return before cmd.markup.page fallthrough (Landmine 1 mitigated)
- [x] MarkupContextMenu.tsx MarkupContextMenuProps includes `onEdit: () => void`
- [x] MarkupContextMenu.tsx Edit button is first menuitem (before separator and Recolor group section)
- [x] MarkupContextMenu.tsx Edit button onClick calls both onEdit() and onClose()
- [x] CanvasViewport.tsx contains `editPopup` state declaration as `useState<{ id: string; x: number; y: number } | null>(null)`
- [x] CanvasViewport.tsx onEdit prop subtracts containerRef.current.getBoundingClientRect().left/top from contextMenu coords (Landmine 4 mitigated)
- [x] CanvasViewport.tsx mounts MarkupNamePopup with mode="edit" when editPopup is non-null
- [x] CanvasViewport.tsx handleContextMenu calls setEditPopup(null) before opening new context menu
- [x] CanvasViewport.tsx page-change useEffect clears editPopup alongside contextMenu

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed without any unexpected issues. The IIFE pattern for the editPopup JSX block matched the PATTERNS.md §D-04 specification exactly.

## Known Stubs

None — all changes are complete feature implementations. The onConfirm handler in CanvasViewport wires directly to editMarkup with correct old/new field resolution. No placeholder values or TODO comments introduced.

## Threat Flags

None — changes implement the mitigations in the plan's threat register:
- T-07-03-01 (Tampering — EditMarkupCommand bypassing undo stack): mitigated via pushCommand(s.undoStack, cmd) inside editMarkup action
- T-07-03-02 (Tampering — D-13 canonical substitution bypassed): mitigated by Wave 2 handleConfirm running substitution before onConfirm for all modes including 'edit'
- T-07-03-03 (Tampering — MarkupCommand undo/redo fallthrough Landmine 1): mitigated via explicit if (cmd.type === 'edit-markup') with early return in both undo() and redo()
- T-07-03-04 (Tampering — wrong popup position Landmine 4): mitigated via getBoundingClientRect offset subtraction in CanvasViewport onEdit handler
- T-07-03-05 (XSS via markup name): accepted — React JSX renders as text node with default escaping

## Self-Check: PASSED

- src/renderer/src/types/markup.ts: FOUND (contains `edit-markup`, `oldCategoryName`, `newCategoryName`)
- src/renderer/src/stores/markupStore.ts: FOUND (contains `editMarkup`, `getOrCreateCategory(newCategoryName)` before set(), `if (cmd.type === 'edit-markup')` in undo() and redo())
- src/renderer/src/components/MarkupContextMenu.tsx: FOUND (contains `onEdit`, Edit button as first menuitem)
- src/renderer/src/components/CanvasViewport.tsx: FOUND (contains `editPopup`, `getBoundingClientRect`, `MarkupNamePopup` with `mode="edit"`)
- Commit d65f4d8: FOUND (Task 1 — EditMarkupCommand type and editMarkup store action)
- Commit 9e23755: FOUND (Task 2 — MarkupContextMenu onEdit prop and CanvasViewport editPopup wiring)
- Full Vitest suite: 424/424 passed — all Wave 0 RED tests GREEN
