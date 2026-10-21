---
phase: 19-cost-library
plan: 01
subsystem: estimating
tags: [cost-library, excel, csv, offline, electron]
requires: [16-estimating-workspace, 17-markup-rename-and-reorder, 18-toolbar-revamp]
provides: [standard-cost-template, validated-local-library-import, explicit-estimate-rate-application]
affects: [20-production-readiness, 21-user-guide-and-internal-handover]
requirements-completed: [COST-01, COST-02, COST-03, COST-04, COST-05, COST-06]
completed: 2026-10-21
production_commit: 2da29cb
---

# Phase 19 Plan 01 — Cost Library

Implemented the user-approved local costing workflow: download a blank Excel template, fill externally, import/validate/preview on each PC, explicitly replace its offline library, then pick a compatible item to copy material/labor rates into an Estimate row. Team owns price data and revisions. No new dependency, central service, synchronization, assemblies or automatic repricing.

## Delivered

- Six fixed headers: Item Code, Description, Category, Unit, Material Unit Rate, Labor Unit Rate. Template includes Instructions, code-as-text formatting, frozen header, unit dropdowns and numeric validations; no example prices.
- CSV/ExcelJS parsing with preserved CSV codes/quoted fields/BOM, required values/unique code/unit/numeric checks and row/column errors. Actual formula cells (including cached results) are rejected. Limit 10 MB and 10,000 rows.
- Native picker→main-held preview token→explicit commit protocol. Candidate scoped to requesting window; cancellation/stale/cross-window tokens cannot replace data.
- Versioned userData JSON persisted by temporary write + rename, retaining previous data on failure. Template generation and parsing remain in main, not renderer.
- Estimate header management without PDF; searchable row-level picker, mismatch blocking, keyboard/focus management and confirmation scope. Existing item names/geometry/markup stay intact; category-independent name|type pricing scope is explained.
- Applied numeric rate snapshots ride existing project serialization. Existing default/explicit markup and manual editing remain available; newer library imports do not alter project prices.

## Verification

- Focused parser/repository/project/IPC/UI: **61/61 tests**.
- Full Vitest: **938/938 tests, 126/126 files**.
- `npm run build`: TypeScript and production main/preload/renderer build PASS.
- New production files ESLint: **0 errors, 0 warnings**. Existing EstimateRow exports a calculation helper and retains its pre-existing `react-refresh/only-export-components` error; existing files also have pre-existing CRLF/format warnings. No new blocking lint finding.
- Automated Electron smoke against built renderer + actual preload + production IPC: **8/8 workflows**, no renderer errors. Native dialog selections are supplied by the test harness, not claimed as manual user testing. Tests download/fill/import, apply into a visible Estimate row, preserve 12% markup, save into .clmc, replace library without repricing, recreate window, reopen project with library absent, and export CSV.
- Inspected actual Electron screenshots of management, picker and applied Estimate: readable, ten-column alignment retained, controls accessible and units/scope shown.
- Reproduce: `node .planning/phases/19-cost-library/verify-electron.cjs` after build. Scratch artifacts and raw check output are under `out/phase19-smoke/` (not distribution content).

## Execution notes

Executed inline under GSD skills because no subagents were requested. Windows sandbox blocked Vite realpath; reran tests/build with reviewed elevated permissions. No code workaround weakened filesystem isolation. Test-harness loader/file URL/visibility issues were corrected; final smoke passes. Formatting-only work was limited to newly created source/test files.

## Remaining release work

Phase 19 acceptance follow-up (2026-10-21): all 11 UAT tests pass; user confirmed Tests 1-8 and final panning, and explicitly delegated remaining actual desktop checks. See 19-UAT.md and 19-DESKTOP-UAT.md. Coverage audit found no gaps; security review has no high/critical blocker and one medium XLSX resource-budget advisory; UI review has no blocker.

Phase 20 installer/upgrades, supported-runtime review, cross-PC portability, recovery and installed-app measurement/scaling/large-PDF validation remain unexecuted. Include a review of unit changes after pricing because the existing project rate model stores rates per displayed unit rather than a persistent unit basis. Phase 21 offline guide, technical ownership transfer and real two-PC user pilot remain unexecuted; no production acceptance or deployment is claimed.

Original rollout vision and all four user requests remain in ../../RELEASE-HANDOVER.md and Phases 20-21.
