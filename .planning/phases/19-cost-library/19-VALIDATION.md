---
phase: 19-cost-library
status: validated
nyquist_compliant: true
validated: 2026-10-21
---

# Phase 19 validation strategy

| Requirement | Evidence required |
| --- | --- |
| COST-01 | Generated blank XLSX has fixed six headers, instructions and allowed units; filled template roundtrips |
| COST-02 | CSV quoting/BOM/leading zero codes and XLSX plain values parse; bad columns, formulas, duplicates, empty content, invalid numeric rates/units fail with row details |
| COST-03 | Preview/cancel/failed validation/failed persistence/stale candidate preserve old library; accepted replacement survives repository recreation |
| COST-04 | Management has loading/empty/error/preview/success states; accessible picker filters entries and blocks mismatched units |
| COST-05 | Explicit apply updates material/labor, preserves project default and explicit markup, marks dirty, and reflects live totals/export |
| COST-06 | Import never writes project rates; saved applied prices hydrate on a PC without library; manual project edits remain functional |

Run focused cost-library tests, existing estimate/project/export tests, TypeScript, production build and full Vitest suite. Scoped lint compares touched files with existing baseline. UI interaction tests use established React act/jsdom harness. Real Windows desktop smoke and user feel remain pending unless actually exercised.

Plan review (inline): PASS. All six requirements mapped to one vertical plan with production entry points, persistence, negative tests and review. Local JSON schema is versioned; project schema remains unchanged. User approved the template/local replacement decisions, so no new one-way-door approval is required. Phase 20 and 21 remain unexecuted.

## Final results (2026-10-21)

All six COST requirements PASS. Focused 61/61, full suite 938/938 (126 files), TypeScript/production build PASS, new-source ESLint zero errors/warnings. Actual built Electron UI/preload/IPC smoke PASS for eight workflows, zero renderer errors; screenshots visually reviewed. Native file dialog choices are simulated by the harness. True user acceptance and non-development-PC installation/pilot are Phase 20/21 gates. See 19-VERIFICATION.md and 19-01-SUMMARY.md for evidence and limits.

## Completion coverage audit — 2026-10-21

Performed inline using gsd-validate-phase; no new implementation changes or uncovered requirement found. Existing green evidence is reused rather than rerunning an unchanged suite. The later native-dialog fix expanded focused coverage to 66 tests; full-suite/build baseline above predates that small fix, as recorded in the debug and verification artifacts.

| Requirement | Existing automated tests | Actual walkthrough |
| --- | --- | --- |
| COST-01 | cost-library.test.ts template roundtrip; cost-library-ipc.test.ts native save/cancel/error | UAT 1-2 PASS |
| COST-02 | cost-library.test.ts corrupt/oversize/formula/header/duplicate/units/CSV preservation | UAT 2, 7-8 PASS |
| COST-03 | cost-library-store.test.ts recreate/replace/corrupt/write/rename; cost-library-ipc.test.ts stage/token/cancel | UAT 2-3, 6-8 PASS |
| COST-04 | cost-library-ui.test.ts entry/search/mismatch/focus/keyboard/error states | UAT 4-5, 11 PASS |
| COST-05 | cost-library-apply.test.ts markup/default/dirty/geometry/numeric gates; UI explicit apply | UAT 4-6, 10-11 PASS |
| COST-06 | cost-library-apply.test.ts serialize/hydrate/export; UI import does not reprice | UAT 6, 9-10 PASS |

Both tasks in plan 19-01 map to all six requirements and their verification commands. All are COVERED. Gaps found: 0; tests generated: 0; escalated implementation bugs: 0. Phase 19 walkthrough: 11/11 PASS, including user confirmation of final pan gesture. Installed-PC and two-PC pilot checks remain Phase 20/21.
