---
phase: 05-boq-export
plan: 04
subsystem: ui
tags: [react, hook, modal, export-orchestration, race-guard, useCallback]

requires:
  - phase: 05-boq-export
    provides: aggregateBoq + findUncalibratedMarkupPages from Plan 01; window.api triad from Plan 03; ExportResult type from Plan 00
provides:
  - useExport hook returning { exportBoq, applyExportAfterConfirm }
  - UncalibratedExportWarningModal component (Continue/Cancel/Escape)
  - deriveDefaultExportPath helper (D-17 — `{project-basename}-BOQ.xlsx`)
affects: 05-05 (App.tsx wires Toolbar onExportClick → exportBoq, mounts modal, surfaces ExportResult)

tech-stack:
  added: []
  patterns: [single-hook orchestration of aggregate→dialog→write; setExporting try/finally guarantees race-guard reset on every exit path; continuation entry point applyExportAfterConfirm avoids re-aggregation after modal Continue]

key-files:
  created:
    - src/renderer/src/hooks/useExport.ts
    - src/renderer/src/components/UncalibratedExportWarningModal.tsx
  modified: []

key-decisions:
  - "Hook is SEPARATE from useProject (Q6) — folding into useProject would push it past 500 LOC"
  - "setExporting(true) is set INSIDE dialogAndWrite, NOT before aggregator runs (the aggregator is fast/synchronous; we don't want to disable Toolbar Export button during ms-scale aggregation)"
  - "applyExportAfterConfirm checks the race guard AGAIN — between modal show and Continue click, user could trigger a Save (Ctrl+S); refusing in that case is correct"
  - "Modal renders role='dialog' aria-modal='true' on the inner card; onKeyDown handler attached to the OUTER overlay so jsdom keydown bubbles up correctly (matches OpenErrorModal analog)"
  - "Default save path: stripExt(basename(currentFilePath)) + '-BOQ.xlsx' if saved; stripExt(pdf.originalFilename) + '-BOQ.xlsx' otherwise (D-17)"

patterns-established:
  - "Continuation entry point pattern: exportBoq returns kind='needs-uncalibrated-confirmation' with the captured BoqStructure; App.tsx mounts modal; Continue invokes applyExportAfterConfirm(structure) — single-call invariant preserved"
  - "Path helpers (basenameAny, dirnameAny, stripExt) handle both / and \\ separators for cross-platform robustness"

requirements-completed: [EXPRT-01, EXPRT-02]

duration: ~3min
completed: 2026-05-02
---

# Plan 05-04: useExport hook + UncalibratedExportWarningModal — Summary

**Renderer's export-orchestration layer. useExport wires aggregateBoq → IPC triad with D-06 warning gate; modal handles Continue/Cancel/Escape.**

## Performance

- **Duration:** ~3 min
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- `UncalibratedExportWarningModal` — 93 LOC, focus-on-mount Continue button, Escape cancellation, comma-separated page list
- `useExport` — 99 LOC, four-kind ExportResult discriminated union, setExporting try/finally guarantee, continuation entry point for post-modal flow
- `use-export-hook.test.ts` 5/5 GREEN, `uncalibrated-export-warning-modal.test.ts` 6/6 GREEN

## Task Commits

1. **Task 1: UncalibratedExportWarningModal** — `56e793b` (feat)
2. **Task 2: useExport hook** — `39d794b` (feat)

## Deviations from Plan

None — plan executed as written.

## Verification

- `npm run typecheck` passes
- 11/11 Wave 3 tests GREEN
- aggregator + writers + IPC + project-store + project-io + atomic-write all still GREEN

## Wave 3 → Wave 4 handoff

Plan 05 (App.tsx + Toolbar + keyboard shortcut) wires:
1. Toolbar Export button → `handleExportClick` → `exportBoq()`
2. Ctrl+Shift+E → same `handleExportClick`
3. Result kind routing:
   - `ok` → 2-second auto-dismiss success toast (D-20)
   - `needs-uncalibrated-confirmation` → mount UncalibratedExportWarningModal; on Continue, call `applyExportAfterConfirm(structure)` and re-route the new ExportResult
   - `canceled` → silent
   - `error` → OpenErrorModal-style modal with `message` (D-21)
