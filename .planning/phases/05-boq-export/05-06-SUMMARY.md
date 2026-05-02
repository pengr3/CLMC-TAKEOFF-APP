---
phase: 05-boq-export
plan: 06
subsystem: testing
tags: [uat, human-verification, phase-closure, gap-fix]

requires:
  - phase: 05-boq-export
    provides: Plans 00-05 collectively delivered the full BOQ Export pipeline
provides:
  - Human UAT result documenting 6 PASS scenarios
  - REQUIREMENTS.md EXPRT-01 + EXPRT-02 marked Complete
  - ROADMAP.md Phase 5 marked Complete (2026-05-03)
  - STATE.md advanced to Phase 6 (NOT STARTED)
affects: 06 (next phase to plan)

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/05-boq-export/05-UAT.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - src/main/boq-writers.ts (UTF-8 BOM gap fix)
    - src/tests/boq-writers-csv.test.ts (BOM test inverted)
    - src/main/ipc-handlers.ts (atomicWriteFile EPERM recovery)
    - src/tests/atomic-write.test.ts (recovery test added; rename-fail test updated)
    - src/tests/boq-export-ipc.test.ts (rename-fail test updated)

key-decisions:
  - "CSV gets UTF-8 BOM (reverses D-14 'no BOM') — Excel mojibake on Windows is unacceptable for the primary target tool; modern parsers (csv-parse, Sheets, Numbers) all transparently strip the BOM"
  - "atomicWriteFile recovers from EPERM/EEXIST/EBUSY by unlinking destination then retrying rename — non-atomic in the recovery path but the alternative is hard failure for every OneDrive/Dropbox/antivirus user"
  - "All 6 UAT scenarios PASS after gap fixes — Phase 5 closes; v1 milestone now at 11/25 requirements delivered (was 9/25)"

patterns-established:
  - "UTF-8 BOM for Excel-targeted CSV outputs — small portability cost, big rendering correctness win"
  - "Lock-recovery on atomic rename via unlink-then-retry — covers OneDrive/Dropbox/antivirus locks transparently"

requirements-completed: [EXPRT-01, EXPRT-02]

duration: ~25min (manual UAT + 2 inline gap fixes)
completed: 2026-05-03
---

# Plan 05-06: Manual UAT + phase closure — Summary

**6 manual scenarios PASS after 2 gap fixes (CSV UTF-8 BOM + OneDrive overwrite recovery). Phase 5 closes; v1 export milestone shipped.**

## Performance

- **Duration:** ~25 min including 2 gap diagnose+fix cycles
- **Tasks:** 2/2 (Task 1: 6-scenario manual UAT; Task 2: doc closure)
- **Files modified:** 9 (1 new UAT scaffold + 3 doc closures + 5 source/test files for inline gap fixes)

## Accomplishments
- All 6 UAT scenarios PASS: XLSX flow, CSV mirror, cross-tool fidelity, D-06 warning, D-18 keyboard + guard, D-21 error modal
- 2 gaps caught + fixed inline (UTF-8 BOM, OneDrive overwrite); did NOT require a separate gap-closure phase
- REQUIREMENTS.md EXPRT-01/02 → Complete; ROADMAP.md Phase 5 → Complete; STATE.md advanced
- 342/342 automated tests pass (one new recovery test added)

## Task Commits

1. **Task 1: UAT scaffold** — `564c7af` (test)
2. **Gap 1: CSV UTF-8 BOM** — `ed743c9` (fix)
3. **Gap 2: OneDrive overwrite EPERM recovery** — `1e1df50` (fix)
4. **Task 2: Phase 5 closure** — (this commit) (docs)

## Gaps caught + closed

### Gap 1 — CSV mojibake in Excel

**Symptom:** UoM column showed `mÂ²` instead of `m²` when the CSV was opened in Microsoft Excel on Windows. (Excel defaulted to Windows-1252 codepage because no BOM was present, mis-interpreting the UTF-8 sequence `0xC2 0xB2`.)

**Root cause:** `buildBoqCsv` followed the original D-14 decision to write CSV without a UTF-8 BOM, optimizing for tool portability. But the cost (Excel rendering breakage on the dominant target tool) outweighed the benefit.

**Fix:** Prepend `'﻿'` (U+FEFF) to the CSV string returned by `buildBoqCsv`. This is rendered as bytes `0xEF 0xBB 0xBF` after the UTF-8 encoding pass. Modern CSV parsers (csv-parse, csv-stringify, Sheets, Numbers, Python `csv` module) all handle the BOM transparently.

**Test update:** `boq-writers-csv.test.ts` `does NOT emit a UTF-8 BOM` test was inverted to `emits a UTF-8 BOM at byte 0`. Row-order test added a `csv.replace(/^﻿/, '')` strip before line-splitting.

### Gap 2 — OneDrive overwrite EPERM

**Symptom:** Exporting a CSV (or saving a `.clmc`) into a OneDrive-synced folder, over an existing file with the same name, failed with:
```
EPERM: operation not permitted, rename '...-BOQ.csv.tmp' -> '...-BOQ.csv'
```

**Root cause:** OneDrive (and Dropbox, antivirus, Excel-with-file-open) holds transient file handles during sync. Node.js's `fs.rename` on Windows fails with `EPERM`/`EEXIST`/`EBUSY` when the destination is locked, because Win32's `MoveFileExW` cannot replace a locked file.

**Fix:** In `atomicWriteFile`, catch the lock-related error codes, `unlink(finalPath)` to release the lock, then retry `rename(tmpPath, finalPath)` once. The retry path is non-atomic (the destination briefly does not exist between unlink and rename), but the alternative is a hard failure for every OneDrive user — unacceptable on Windows.

**Affects:** All atomic writes — `.clmc` project save (Phase 4.1), `.xlsx` BOQ export, `.csv` BOQ export.

**Test:** New `recovers from EPERM on rename by unlinking destination then retrying` test in `atomic-write.test.ts`. Existing rename-failure tests updated to reject both attempts (since recovery is the new default).

## Phase 5 closure

| Artifact | Update |
|----------|--------|
| REQUIREMENTS.md EXPRT-01 | `[ ]` → `[x]` with completion annotation |
| REQUIREMENTS.md EXPRT-02 | `[ ]` → `[x]` with completion annotation + BOM/OneDrive notes |
| REQUIREMENTS.md Traceability | EXPRT-01/02 `Pending` → `Complete` |
| ROADMAP.md Phase 5 entry | `[ ]` → `[x]` with date `2026-05-03` |
| ROADMAP.md 05-06 plan checkbox | `[ ]` → `[x]` |
| ROADMAP.md Progress table | Phase 5 `0/0 Not started` → `7/7 Complete 2026-05-03` |
| STATE.md frontmatter | completed_phases 6→7; completed_plans 34→41; percent 83→88 |
| STATE.md Current Position | Phase 05 EXECUTING → Phase 06 NOT STARTED |
| STATE.md status / stopped_at / last_activity | Phase 5 complete narrative |

## Phase 5 totals

- **Plans:** 7/7 complete
- **Source files created:** 5 (boq-types.ts, boq-aggregator.ts, boq-writers.ts, useExport.ts, UncalibratedExportWarningModal.tsx)
- **Source files modified:** 8 (Toolbar.tsx, useKeyboardShortcuts.ts, App.tsx, projectStore.ts, ipc-handlers.ts, project-io.ts, preload index.ts, preload index.d.ts)
- **Test files created:** 8 RED scaffolds (all flipped GREEN by Wave 4)
- **Test files updated:** 4 (toolbar-saving-disabled, toolbar-replace-pdf, toolbar-open-prop, atomic-write — last one for the OneDrive recovery)
- **Total tests:** 342/342 GREEN
- **Requirements delivered:** EXPRT-01, EXPRT-02 (v1 milestone now at 11/25)

## Next action

Phase 6 (Live View and UI Polish) — VIEW-01 + PDF-05. Run `/gsd-discuss-phase 6` to gather context, then `/gsd-plan-phase 6`, then `/gsd-execute-phase 6`.
