---
phase: 04-project-persistence
plan: 03
subsystem: ui
tags: [electron, react, typescript, zustand, pdfjs-dist, project-lifecycle]

requires:
  - phase: 04-01
    provides: IPC handlers (saveProjectDialog, writeProject, readProject, hashPdf, resolvePdfPath, readPdfBytes, computeRelativePath)
  - phase: 04-02
    provides: projectStore (isDirty, setSaved, setCurrentFilePath, reset), hydrateStores, snapshotProject, project-schema (validateV1, migrate)

provides:
  - useProject hook with 8-function API (newProject/saveProject/saveProjectAs/openByExtension/openProjectDialog/relinkPdf/applyHashMismatchProceed/applyDimensionMismatchProceed)
  - usePdfDocument refactored to expose loadPdfFromPath(pdfPath) in addition to loadPdf + openPdfDialog
  - routeOpenByExtension pure helper (exported for testing)
  - MissingPdfModal — blocking modal for D-23 missing PDF flow
  - HashMismatchModal — warn modal for D-12/D-28 hash mismatch flow
  - DimensionMismatchModal — warn modal for D-27 dimension mismatch flow (presentational, parent calls applyDimensionMismatchProceed)
  - PageCountAbortModal — hard-abort modal for D-26 page count mismatch

affects:
  - 04-04 (UI chrome — Toolbar buttons, keyboard shortcuts call useProject methods)
  - 04-05 (close guard — reads useProjectStore.isDirty, calls useProject.saveProject)

tech-stack:
  added: []
  patterns:
    - "useProject is the single orchestrator for all project I/O — components never call IPC directly"
    - "Modals are pure presentational (ScalePopup pattern); parent owns modal lifecycle and result routing"
    - "Path math (relative path computation, cross-drive detection) delegates entirely to window.api.computeRelativePath — no drive-letter logic in renderer"
    - "vi.mock(@renderer/lib/pdf-setup) pattern for testing hooks that transitively import pdfjs-dist in node environment"

key-files:
  created:
    - src/renderer/src/hooks/useProject.ts
    - src/renderer/src/components/MissingPdfModal.tsx
    - src/renderer/src/components/HashMismatchModal.tsx
    - src/renderer/src/components/DimensionMismatchModal.tsx
    - src/renderer/src/components/PageCountAbortModal.tsx
  modified:
    - src/renderer/src/hooks/usePdfDocument.ts
    - src/tests/project-open-routing.test.ts

key-decisions:
  - "applyDimensionMismatchProceed signature is (data, resolvedPdfPath, clmcPath) — matching checker spec; resolvedPdfPath is accepted but unused (PDF already loaded in viewerStore by prior finishOpen call)"
  - "Path math delegates entirely to window.api.computeRelativePath (CONTEXT.md Claude's Discretion) — no renderer-side drive-letter string operations"
  - "finishOpen returns dimension-mismatch BEFORE calling hydrateStores — user must confirm via applyDimensionMismatchProceed to prevent blank canvas (BLOCKER fix)"
  - "project-open-routing test mocks @renderer/lib/pdf-setup via vi.mock to avoid pdfjs-dist DOMMatrix errors in node test environment — routeOpenByExtension is a pure string helper with no PDF.js usage"
  - "Modal files were pre-created in Wave 0 scaffold; Task 3 verified their correctness against acceptance criteria and committed them"

patterns-established:
  - "useProject: single async orchestrator returns ProjectOpenResult union; UI matches on .kind to select modal"
  - "Hook inner functions (finishOpen, saveProjectAsImpl, writeSnapshotToPath) are module-scope async functions, not useCallback, to avoid circular dependency in React hooks"

requirements-completed: [PERS-01, PERS-02]

duration: 5min
completed: 2026-04-22
---

# Phase 04 Plan 03: Renderer Project Lifecycle Summary

**useProject hook with 8-function API + usePdfDocument refactored for path-based loading + four recovery modals (missing PDF, hash mismatch, dimension mismatch, page count abort)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-22T10:22:54Z
- **Completed:** 2026-04-22T10:27:45Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `useProject` is the single entry point for all project I/O — Plan 04-04 UI code calls these 8 methods with no direct IPC calls in components
- `usePdfDocument.loadPdfFromPath(pdfPath)` added — enables opening PDFs by path (for .clmc open flow) without showing a dialog
- `applyDimensionMismatchProceed` fills the BLOCKER gap — user clicking [Open anyway] on dimension mismatch now fully hydrates stores (no blank canvas)
- All four recovery modals created with correct button labels, COLORS constants, role=dialog, autoFocus, and Escape=Cancel
- Wave 0 project-open-routing scaffold flipped from 4 red to 4 green

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor usePdfDocument + create routeOpenByExtension stub (flip open-routing tests green)** - `a52704e` (feat)
2. **Task 2: Implement full useProject hook** - `9c71f11` (feat)
3. **Task 3: Create four recovery modals** - `9de70d0` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/renderer/src/hooks/useProject.ts` - Full 8-function project lifecycle hook; routeOpenByExtension pure helper exported
- `src/renderer/src/hooks/usePdfDocument.ts` - Added loadPdfFromPath(pdfPath); openPdfDialog unchanged
- `src/renderer/src/components/MissingPdfModal.tsx` - D-23 blocking modal: Browse for PDF + Cancel
- `src/renderer/src/components/HashMismatchModal.tsx` - D-12/D-28 warn modal: Open anyway + Cancel
- `src/renderer/src/components/DimensionMismatchModal.tsx` - D-27 warn modal: Open anyway + Cancel (presentational)
- `src/renderer/src/components/PageCountAbortModal.tsx` - D-26 hard abort modal: Pick again + Cancel only
- `src/tests/project-open-routing.test.ts` - Updated with real assertions + vi.mock for pdf-setup

## Decisions Made

- `applyDimensionMismatchProceed(data, resolvedPdfPath, clmcPath)` matches checker spec; `resolvedPdfPath` is accepted but unused since the PDF was already loaded into viewerStore by the prior `finishOpen` call
- Path math (relative path computation, cross-drive detection) delegates entirely to `window.api.computeRelativePath` — no drive-letter logic in renderer (CONTEXT.md Claude's Discretion)
- `finishOpen` returns `dimension-mismatch` kind BEFORE calling `hydrateStores`, then `applyDimensionMismatchProceed` completes hydration on user confirmation — prevents blank canvas (BLOCKER fix documented in plan)
- `vi.mock('@renderer/lib/pdf-setup')` added to routing test to prevent pdfjs-dist DOMMatrix errors in node test environment — `routeOpenByExtension` is a pure string function with zero PDF.js usage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pdfjs-dist DOMMatrix import failure in vitest node environment**
- **Found during:** Task 2 (full useProject hook importing usePdfDocument which imports pdf-setup)
- **Issue:** When useProject.ts was fully implemented, the transitive import chain (useProject → usePdfDocument → pdf-setup → pdfjs-dist) caused DOMMatrix is not defined in vitest node environment; the 4 routing tests that were green with the stub immediately failed
- **Fix:** Added `vi.mock('@renderer/lib/pdf-setup', ...)` to project-open-routing.test.ts; routeOpenByExtension is a pure helper that does not use PDF.js at all, so the mock is correct and safe
- **Files modified:** src/tests/project-open-routing.test.ts
- **Verification:** `npx vitest run src/tests/project-open-routing.test.ts` — 4/4 pass
- **Committed in:** `9c71f11` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Fix was necessary to keep the 4 green routing tests green. No scope creep.

## Issues Encountered

- pdfjs-dist requires `DOMMatrix` browser API not available in vitest node environment — resolved via vi.mock pattern (see Deviations above)

## Known Stubs

None — all functions are fully wired. `useProject` is consumed by Plan 04-04 (UI chrome) which does not yet exist; until 04-04 is built, the hook is importable but not called from the UI.

## Next Phase Readiness

- Plan 04-04 can import `useProject()` and wire Toolbar Open/Save buttons and keyboard shortcuts with no further orchestration glue
- Plan 04-04's DimensionMismatchModal `onOpenAnyway` handler has a matching `applyDimensionMismatchProceed` method that fully hydrates stores — blank-canvas bug blocked
- Plan 04-05 can call `useProject.saveProject()` and read `useProjectStore.getState().isDirty` in the close-window handler

---
*Phase: 04-project-persistence*
*Completed: 2026-04-22*
