---
phase: 05-boq-export
plan: 05
subsystem: ui
tags: [toolbar, keyboard-shortcuts, app-wiring, export-result-routing, toast]

requires:
  - phase: 05-boq-export
    provides: useExport hook + UncalibratedExportWarningModal from Plan 04
provides:
  - Toolbar Export IconButton (Download icon, disabled-state wiring per D-07/D-19)
  - Ctrl+Shift+E keyboard shortcut (with isTextInputActive guard per D-18)
  - App.tsx handleExportClick routing ExportResult kinds to toast/modal/error UI
  - exportToast (2s auto-dismiss), uncalibratedWarning, exportError state slots
affects: 05-06 (UAT verifies the full surface end-to-end)

tech-stack:
  added: []
  patterns: [App.tsx-owns-orchestration pattern extended to a 4th flow (after Open / Save / Replace); Toolbar receives onExportClick callback prop only]

key-files:
  created: []
  modified:
    - src/renderer/src/components/Toolbar.tsx
    - src/renderer/src/hooks/useKeyboardShortcuts.ts
    - src/renderer/src/App.tsx
    - src/renderer/src/components/CanvasViewport.tsx (added exportBoq: () => {} stub to satisfy widened interface)
    - src/tests/toolbar-saving-disabled.test.ts (added onExportClick: vi.fn() to render calls)
    - src/tests/toolbar-replace-pdf.test.ts (same)
    - src/tests/toolbar-open-prop.test.ts (same)

key-decisions:
  - "Toolbar.tsx receives onExportClick callback — does NOT call useExport directly (RESEARCH §Anti-Patterns)"
  - "App.tsx routes ExportResult kinds: ok→toast, needs-uncalibrated-confirmation→modal, error→OpenErrorModal reuse with 'Export failed:' prefix, canceled→silent"
  - "exportToast offset to bottom: 60px so it doesn't overlap saveToast (bottom: 16px) during rapid Save→Export sequences"
  - "Ctrl+Shift+E branch placed BETWEEN Ctrl+Shift+S and Ctrl+S branches in useKeyboardShortcuts — preserves existing priority order"
  - "CanvasViewport.tsx passes exportBoq: () => {} as a no-op stub since App.tsx owns the real handler at the top level (mirrors saveProject/saveProjectAs stub pattern)"

patterns-established:
  - "Discriminated-union UI routing in handleExportClick — same shape as handleReplaceClick (Plan 04.1)"
  - "Modal Continue path captures the BoqStructure at modal-show time; applyExportAfterConfirm runs against that snapshot — no re-aggregation"

requirements-completed: [EXPRT-01, EXPRT-02]

duration: ~5min
completed: 2026-05-02
---

# Plan 05-05: Toolbar + Ctrl+Shift+E + App.tsx wiring — Summary

**Final UI surface for Phase 5. Click Export, Ctrl+Shift+E, and the discriminated ExportResult routing all working end-to-end.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 3/3
- **Files modified:** 7 (3 plan-listed + 1 sibling stub + 3 existing tests)

## Accomplishments
- Toolbar Export IconButton (Download icon) renders, disables on totalPages===0 / isSaving / isExporting / zero markups
- Ctrl+Shift+E keyboard shortcut fires handleExportClick (suppressed in text inputs)
- App.tsx routes all four ExportResult kinds correctly
- exportToast auto-dismisses after 2 seconds (mirrors saveToast pattern)
- All 8 Wave 0 RED test files now GREEN
- **341/341 total tests pass** — full suite green, no regressions

## Task Commits

1. **Task 1: Toolbar Export button + 3 test updates** — `a42ddfe` (feat)
2. **Task 2: Ctrl+Shift+E shortcut** — `caf109c` (feat)
3. **Task 3: App.tsx wiring + CanvasViewport stub** — `2199709` (feat)

## Deviations from Plan

### CanvasViewport stub for widened interface

`KeyboardShortcutHandlers` gained a required `exportBoq` field. CanvasViewport.tsx also calls `useKeyboardShortcuts` (with no-op stubs for the file actions since App.tsx owns those handlers at the top level). Added `exportBoq: () => {}` to the stub object — same pattern as `saveProject: () => {}` already there. Not in Plan 05's files_modified, but a necessary follow-on for the type contract.

## Verification

- `npm run typecheck` passes (both tsconfig.node.json and tsconfig.web.json)
- 341/341 tests pass
- All 8 Phase 5 RED scaffolds are now GREEN: project-store, boq-aggregator, boq-writers-xlsx, boq-writers-csv, boq-export-ipc, uncalibrated-export-warning-modal, toolbar-export-button, use-export-hook, use-keyboard-shortcuts-export
- No prior-phase regressions: atomic-write, project-io, project-schema, replace-plan-pdf, markup-shortcuts, project-shortcuts all still GREEN

## Wave 4 → Wave 5 handoff

Phase 5 implementation is complete. Plan 05-06 is the human-UAT checkpoint — autonomous: false. The estimator opens a real construction PDF, places markups, calibrates scale, exports XLSX and CSV, and verifies they open correctly in Excel/Sheets/Numbers per EXPRT-01 and EXPRT-02 acceptance criteria.
