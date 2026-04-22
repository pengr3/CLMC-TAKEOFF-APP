---
phase: 04-project-persistence
plan: 04
subsystem: ui
tags: [react, electron, zustand, typescript, keyboard-shortcuts, modals]

# Dependency graph
requires:
  - phase: 04-project-persistence/04-02
    provides: projectStore with isDirty, currentFilePath, attachDirtyTracking
  - phase: 04-project-persistence/04-03
    provides: useProject hook (8-function API), four recovery modals, ProjectOpenResult type
provides:
  - TitleBar with D-15 dirty asterisk and projectStore path preference
  - Toolbar with renamed Open button and new Save / Save As buttons
  - useKeyboardShortcuts extended with Ctrl+S, Ctrl+Shift+S, Ctrl+O (extension-sniffing)
  - chooseSaveShortcut pure helper for D-13 routing
  - App.tsx modal router for all four ProjectOpenResult recovery paths
  - applyDimensionMismatchProceed wired in DimensionMismatchModal onOpenAnyway (BLOCKER fix)
  - SaveToast inline component with 2s auto-dismiss (D-18)
affects:
  - 04-05 (close-window guard reads isDirty from same projectStore)
  - 04-06 (human verify checkpoint exercises this UI)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Toolbar calls useProject() once per render; destructure callbacks; no useCallback re-wrap (useProject already stabilizes)"
    - "App.tsx owns all modal lifecycle state; modals are pure presentational (ScalePopup pattern)"
    - "createRoot+act pattern for Zustand store tests in jsdom — renderToStaticMarkup doesn't work with useSyncExternalStore in React 19"
    - "CanvasViewport no-op stubs satisfy interface; App.tsx owns the real shortcut handlers at top-level"

key-files:
  created:
    - src/renderer/src/components/MissingPdfModal.tsx
    - src/renderer/src/components/HashMismatchModal.tsx
    - src/renderer/src/components/DimensionMismatchModal.tsx
    - src/renderer/src/components/PageCountAbortModal.tsx
  modified:
    - src/renderer/src/components/TitleBar.tsx
    - src/renderer/src/components/Toolbar.tsx
    - src/renderer/src/App.tsx
    - src/renderer/src/hooks/useKeyboardShortcuts.ts
    - src/renderer/src/components/CanvasViewport.tsx
    - src/tests/title-bar-dirty.test.ts
    - src/tests/project-shortcuts.test.ts
    - src/tests/project-open-routing.test.ts

key-decisions:
  - "TitleBar test uses createRoot+act (not renderToStaticMarkup) — React 19 useSyncExternalStore does not return updated Zustand state via SSR in jsdom"
  - "CanvasViewport keeps no-op stub handlers for new shortcuts; App.tsx is the authoritative shortcut owner"
  - "Toolbar Open button calls useProject().openProjectDialog directly (not prop-drilled) — simpler, follows usePdfDocument pattern"
  - "project-open-routing.test.ts mock added for pdf-setup to avoid DOMMatrix crash in node environment"
  - "DimensionMismatchModal onOpenAnyway always calls applyDimensionMismatchProceed (not bare setState) — only path that hydrates stores post-confirmation"

patterns-established:
  - "Modal state pattern: App.tsx owns { data, clmcPath } state per modal kind; pass callbacks to modals as props"
  - "Save toast: parent-owned setSaveToast + useEffect timer; inline div not a separate component (ConfirmationToast pattern)"

requirements-completed: [PERS-01, PERS-02]

# Metrics
duration: 11min
completed: 2026-04-22
---

# Phase 04 Plan 04: UI Chrome — Toolbar Save/Open, TitleBar Dirty Asterisk, Keyboard Shortcuts, Modal Router

**PERS-01/PERS-02 now invocable from UI: Open/Save/SaveAs toolbar buttons, Ctrl+S/Ctrl+Shift+S shortcuts, D-15 asterisk in title bar, four recovery modals wired to applyDimensionMismatchProceed (BLOCKER fix)**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-22T02:23:52Z
- **Completed:** 2026-04-22T02:34:08Z
- **Tasks:** 3
- **Files modified:** 9 (including 4 new modal components)

## Accomplishments

- TitleBar subscribes to projectStore.currentFilePath + isDirty; shows `name * — CLMC Takeoff` when dirty (D-15)
- Toolbar Open button renamed from "Open PDF" to "Open"; onClick calls useProject().openProjectDialog (D-19/D-20)
- Toolbar Save and Save As buttons added, both disabled when no PDF loaded (D-24)
- useKeyboardShortcuts extended with Ctrl+O (openProject), Ctrl+S (saveProject), Ctrl+Shift+S (saveProjectAs); all text-input-guarded
- chooseSaveShortcut pure helper exported for D-13 testing (null path → save-as)
- App.tsx wires attachDirtyTracking on mount, owns all four modal states, routes ProjectOpenResult to appropriate modal
- DimensionMismatchModal onOpenAnyway calls applyDimensionMismatchProceed (hydrates stores — BLOCKER closed; no blank canvas bug)
- SaveToast inline component with 2s auto-dismiss shows 'Saved' after successful save (D-18)
- All 7 Wave 0 test scaffolds now green (title-bar-dirty ×3, project-shortcuts ×4)
- Full suite: 244/244 tests passing; npm run typecheck exits 0

## Task Commits

1. **Task 1: TitleBar dirty asterisk + title-bar-dirty tests green** — `6bf3b4c` (feat)
2. **Task 2: useKeyboardShortcuts + project-shortcuts tests green** — `701090c` (feat)
3. **Task 3: Toolbar Open/Save/SaveAs + App.tsx modal router + save toast** — `b75e9e9` (feat)

_Note: Plan 04-03 Tasks 2 & 3 (useProject hook + modal components) were completed as pre-work since 04-04 depends_on them. Those commits: `9c71f11`, `9de70d0`._

## Files Created/Modified

- `src/renderer/src/components/TitleBar.tsx` — Subscribes to projectStore.isDirty + currentFilePath; D-15 asterisk formula
- `src/renderer/src/components/Toolbar.tsx` — Open (renamed), Save + Save As buttons; useProject() for all three
- `src/renderer/src/App.tsx` — attachDirtyTracking, modal router, saveToast, useKeyboardShortcuts with 7 handlers
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — Added openProject/saveProject/saveProjectAs; chooseSaveShortcut helper
- `src/renderer/src/components/CanvasViewport.tsx` — No-op stubs for new handlers (App.tsx owns real wiring)
- `src/renderer/src/components/MissingPdfModal.tsx` — D-23 blocking modal; Browse for PDF + Cancel
- `src/renderer/src/components/HashMismatchModal.tsx` — D-12/D-28 warn modal; Open anyway + Cancel
- `src/renderer/src/components/DimensionMismatchModal.tsx` — D-27 warn modal; Open anyway + Cancel (presentational)
- `src/renderer/src/components/PageCountAbortModal.tsx` — D-26 hard abort; Pick again + Cancel only
- `src/tests/title-bar-dirty.test.ts` — Flipped from red stubs to 3/3 green (createRoot+act pattern)
- `src/tests/project-shortcuts.test.ts` — Flipped from red stubs to 4/4 green (jsdom header)
- `src/tests/project-open-routing.test.ts` — Added pdf-setup mock to fix DOMMatrix crash in node env

## Decisions Made

- Used `createRoot + act` (not `renderToStaticMarkup`) for TitleBar tests — React 19 `useSyncExternalStore` does not update Zustand state during SSR in jsdom; `createRoot` triggers the full subscription lifecycle
- CanvasViewport keeps no-op stubs for new keyboard handler fields — avoids prop-drilling through Toolbar and keeps App.tsx as the sole authoritative shortcut owner
- `DimensionMismatchModal.onOpenAnyway` always routes through `applyDimensionMismatchProceed`; bare `projectStore.setState({ isDirty: false })` was confirmed incorrect (would leave stores un-hydrated, causing blank canvas)
- Added `/** @vitest-environment jsdom */` to `project-shortcuts.test.ts` for the DOM-dependent `isTextInputActive` test

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added jsdom environment header to project-shortcuts.test.ts**
- **Found during:** Task 2 (project-shortcuts tests)
- **Issue:** Test 4 (`isTextInputActive` with focused input) needs DOM — requires jsdom environment
- **Fix:** Added `/** @vitest-environment jsdom */` as line 1
- **Files modified:** `src/tests/project-shortcuts.test.ts`
- **Verification:** `npx vitest run src/tests/project-shortcuts.test.ts` → 4/4 green
- **Committed in:** `701090c`

**2. [Rule 1 - Bug] Fixed renderToStaticMarkup SSR with Zustand v5 in title-bar-dirty tests**
- **Found during:** Task 1 (title-bar-dirty tests)
- **Issue:** `renderToStaticMarkup` + Zustand v5 `useSyncExternalStore` returns initial state (not setState value) in React 19 SSR; all 3 tests showed `CLMC Takeoff` regardless of store state
- **Fix:** Replaced `renderToStaticMarkup` with `createRoot + act` pattern (matches markup-namepopup.test.ts)
- **Files modified:** `src/tests/title-bar-dirty.test.ts`
- **Verification:** `npx vitest run src/tests/title-bar-dirty.test.ts` → 3/3 green
- **Committed in:** `6bf3b4c`

**3. [Rule 3 - Blocking] Added no-op stubs in CanvasViewport for new handler interface fields**
- **Found during:** Task 2 (typecheck after useKeyboardShortcuts update)
- **Issue:** `npm run typecheck:web` failed — CanvasViewport passes old 4-field handlers object; new interface requires 7 fields
- **Fix:** Added `openProject`, `saveProject`, `saveProjectAs` no-op stubs with comment explaining App.tsx owns real wiring
- **Files modified:** `src/renderer/src/components/CanvasViewport.tsx`
- **Verification:** `npm run typecheck:web` exits 0
- **Committed in:** `701090c`

---

**Total deviations:** 3 auto-fixed (1 bug fix, 2 blocking)
**Impact on plan:** All three were necessary for the code to compile and tests to pass. No scope creep.

## Issues Encountered

- Plan 04-03 Task 2 and Task 3 were not yet executed when this plan started. The parallel agent structure caused 04-03 to be split across agents. Completed those tasks (useProject full implementation + 4 modals) as pre-work before 04-04. Some of those files were committed by a concurrent agent simultaneously — no merge conflict since file contents were identical.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PERS-01 (Save) and PERS-02 (Reopen) are clickable end-to-end via toolbar and keyboard shortcuts
- D-15 dirty asterisk visible in TitleBar when isDirty=true
- D-18 Saved toast appears 2s after successful save
- D-19/D-20 Open button label + Ctrl+O extension-sniffing working
- Four recovery modals wired and accessible
- DimensionMismatchModal BLOCKER closed — applyDimensionMismatchProceed hydrates stores properly
- Plan 04-05 (close-window guard, D-16) ready to execute: projectStore.isDirty available, Electron beforeunload hook surface defined

---
*Phase: 04-project-persistence*
*Completed: 2026-04-22*
