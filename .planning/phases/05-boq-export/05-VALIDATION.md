---
phase: 5
slug: boq-export
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-02
updated: 2026-05-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/tests/<files-touched>.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1–2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/<files-touched>.test.ts`
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

> One row per `<automated>` verify command across all 7 Phase 5 plans.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-00-T1 | 00 | 0 | EXPRT-01, EXPRT-02 | T-05-00-01, T-05-00-02, T-05-00-03 | exact-version pinned deps + structural type lock | unit | `npx vitest run src/tests/project-store.test.ts --reporter=basic` | ✅ exists | ⬜ pending |
| 05-00-T2 | 00 | 0 | EXPRT-01, EXPRT-02 | n/a | RED test scaffold establishes validation contract | unit | `npx vitest run src/tests/boq-aggregator.test.ts src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts src/tests/boq-export-ipc.test.ts --reporter=basic` (intentionally RED — files don't exist yet) | ❌ Wave 0 creates | ⬜ pending |
| 05-00-T3 | 00 | 0 | EXPRT-01, EXPRT-02 | n/a | RED test scaffold for UI/hook/keyboard layers | unit | `npx vitest run src/tests/uncalibrated-export-warning-modal.test.ts src/tests/toolbar-export-button.test.ts src/tests/use-export-hook.test.ts src/tests/use-keyboard-shortcuts-export.test.ts --reporter=basic` (intentionally RED) | ❌ Wave 0 creates | ⬜ pending |
| 05-01-T1 | 01 | 1 | EXPRT-01, EXPRT-02 | T-05-01-01..T-05-01-05 | aggregator pure; defensive null-coalescing on missing categoryId; perimeter closing-segment matches render | unit | `npx vitest run src/tests/boq-aggregator.test.ts --reporter=basic` | ❌ Wave 1 creates | ⬜ pending |
| 05-02-T1 | 02 | 1 | EXPRT-01, EXPRT-02 | T-05-02-04 (project-io extension) | extension idempotency + case-insensitivity | unit | `npx vitest run src/tests/project-io.test.ts --reporter=basic` | ✅ exists, extends | ⬜ pending |
| 05-02-T2 | 02 | 1 | EXPRT-01, EXPRT-02 | T-05-02-01, T-05-02-02, T-05-02-03 | safeText apostrophe-prefix on '=', '+', '-', '@'; csv-stringify bom:false; ARGB hex validation | unit | `npx vitest run src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts --reporter=basic` | ❌ Wave 1 creates | ⬜ pending |
| 05-03-T1 | 03 | 2 | EXPRT-01, EXPRT-02 | T-05-03-01..T-05-03-07 | atomic write reuse; discriminated-union error surfacing; extension enforcement on dialog return path | unit | `npx vitest run src/tests/boq-export-ipc.test.ts --reporter=basic` | ❌ Wave 0 creates | ⬜ pending |
| 05-03-T2 | 03 | 2 | EXPRT-01, EXPRT-02 | n/a | type contract enforced cross-process via inline-duplicated BoqStructure | typecheck | `npm run typecheck` | n/a | ⬜ pending |
| 05-04-T1 | 04 | 3 | EXPRT-01, EXPRT-02 | T-05-04-05 | aria-modal contract; React-escaped page list (no XSS) | unit | `npx vitest run src/tests/uncalibrated-export-warning-modal.test.ts --reporter=basic` | ❌ Wave 0 creates | ⬜ pending |
| 05-04-T2 | 04 | 3 | EXPRT-01, EXPRT-02 | T-05-04-01, T-05-04-02 | race guard via isExporting/isSaving + try/finally setExporting reset | unit | `npx vitest run src/tests/use-export-hook.test.ts src/tests/uncalibrated-export-warning-modal.test.ts --reporter=basic` | ❌ Wave 0 creates | ⬜ pending |
| 05-05-T1 | 05 | 4 | EXPRT-01, EXPRT-02 | n/a | Toolbar disabled-state contract for D-07/D-19 | unit | `npx vitest run src/tests/toolbar-export-button.test.ts src/tests/toolbar-saving-disabled.test.ts src/tests/toolbar-replace-pdf.test.ts src/tests/toolbar-open-prop.test.ts --reporter=basic` | ❌ Wave 0 creates one; rest exist | ⬜ pending |
| 05-05-T2 | 05 | 4 | EXPRT-01, EXPRT-02 | T-05-05-01 | isTextInputActive guard prevents shortcut firing during text input | unit | `npx vitest run src/tests/use-keyboard-shortcuts-export.test.ts --reporter=basic` | ❌ Wave 0 creates | ⬜ pending |
| 05-05-T3 | 05 | 4 | EXPRT-01, EXPRT-02 | T-05-05-02..T-05-05-04 | full suite regression check after App.tsx wiring | unit | `npx vitest run --reporter=basic 2>&1 \| tail -30` | n/a | ⬜ pending |
| 05-06-T1 | 06 | 5 | EXPRT-01, EXPRT-02 | T-05-06-01, T-05-06-02 | manual cross-tool fidelity (Excel paint, Sheets/Numbers, OS dialog UX) | manual | (human checklist in 05-UAT.md — 6 scenarios) | n/a | ⬜ pending |
| 05-06-T2 | 06 | 5 | EXPRT-01, EXPRT-02 | n/a | doc-closure consistency between REQUIREMENTS / ROADMAP / STATE | grep | `grep -c "\\[x\\] \\*\\*EXPRT-01\\|\\[x\\] \\*\\*EXPRT-02" .planning/REQUIREMENTS.md` (must equal 2) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test scaffolds the planner injected so RED tests compile before any executor work in later waves. Every item below is a Wave 0 deliverable in Plan 00.

- [x] Install runtime deps `exceljs@^4.4.0` + `csv-stringify@^6.7.0` (Plan 00 Task 1; researcher Q7 confirmed timing)
- [x] `src/renderer/src/lib/boq-types.ts` — type tree (BoqMetadata, BoqRowType, BoqItemRow, BoqSubtotal, BoqCategoryGroup, BoqStructure, AggregateOptions, ExportResult)
- [x] `src/renderer/src/stores/projectStore.ts` extended with `isExporting: boolean` + `setExporting(v)` action + reset zeroes it (Plan 00 Task 1; D-19 race guard)
- [x] `src/tests/boq-aggregator.test.ts` — 8 RED tests covering EXPRT-01/02 (empty / count cross-page / perimeter→two rows / collision suffix / uncalibrated exclusion / categoryOrder + empty exclusion / per-UoM subtotals / color carryover) — Plan 00 Task 2
- [x] `src/tests/boq-writers-xlsx.test.ts` — RED round-trip via `ExcelJS.Workbook.xlsx.load` asserting native-number quantity, numFmt, ARGB Item-cell fill, bold + frozen title, light-gray subtotal fill (FFEFEFEF) — Plan 00 Task 2
- [x] `src/tests/boq-writers-csv.test.ts` — RED structural mirror + CRLF + RFC 4180 + no BOM + integer counts + 2dp lengths — Plan 00 Task 2
- [x] `src/tests/boq-export-ipc.test.ts` — RED handler tests via fs/promises mock + dialog mock + boq-writers mock — Plan 00 Task 2
- [x] `src/tests/uncalibrated-export-warning-modal.test.ts` — RED tests for D-06 modal accessibility + button + Escape — Plan 00 Task 3
- [x] `src/tests/toolbar-export-button.test.ts` — RED tests for Export IconButton aria-label + click + 5 disabled states (D-07, D-19) — Plan 00 Task 3
- [x] `src/tests/use-export-hook.test.ts` — RED tests for ExportResult discriminated union (5 kinds) — Plan 00 Task 3
- [x] `src/tests/use-keyboard-shortcuts-export.test.ts` — RED tests for Ctrl+Shift+E + isTextInputActive guard (D-18) — Plan 00 Task 3
- [x] Existing tests `src/tests/project-store.test.ts` extended with isExporting cases (Plan 00 Task 1; only GREEN test in Wave 0)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Open exported `.xlsx` in Microsoft Excel and confirm rendering | EXPRT-01 | Requires real Excel runtime — Vitest can verify the bytes but not how Excel paints them | Plan 06 UAT Scenario 1 — `=SUM(B:B)` returns non-zero number, frozen pane scrolls correctly, Item-cell colors match canvas, light-gray subtotals readable |
| Open exported `.csv` in Excel + Google Sheets + Apple Numbers, confirm cross-tool fidelity | EXPRT-02 | Excel CSV import quirks (locale, separator detection) cannot be exercised in Vitest | Plan 06 UAT Scenarios 2 + 3 — same takeoff → confirm rows align, numeric columns import as numbers, RFC 4180 quoting survives round-trip in each tool |
| Native Save dialog filter selection | D-16, D-17 | Requires Electron OS dialog | Plan 06 UAT Scenario 1 + 2 — confirm `.xlsx` filter is default, default filename is `{project-basename}-BOQ.xlsx`; switch filter to `.csv` → extension swaps |
| Pre-export uncalibrated-page warning | D-06 | Requires multi-page calibration state | Plan 06 UAT Scenario 4 — calibrate page 1, leave page 2 uncalibrated, place a count + a linear markup on page 2 → Export → modal lists page 2, Continue proceeds excluding the linear measurement, Cancel aborts |
| `Ctrl+Shift+E` shortcut and text-input guard | D-18 | Requires real keyboard event over the renderer | Plan 06 UAT Scenario 5 — focus canvas → Ctrl+Shift+E opens dialog; focus a popup input + type `Ctrl+Shift+E` → dialog must NOT open |
| Toast on success / error modal on failure | D-20, D-21 | Requires real success and forced-failure flow | Plan 06 UAT Scenario 6 — successful export shows toast `Exported: {filename}`; force a write failure (target .xlsx open in Excel) → error modal surfaces OS reason without crash |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every wave's plans have at least one Vitest run)
- [x] Wave 0 covers all MISSING file references (8 RED test files seed the validation contract)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-05-02; ready for `/gsd-execute-phase 5`
