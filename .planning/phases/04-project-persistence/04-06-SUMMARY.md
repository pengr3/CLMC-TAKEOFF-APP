---
phase: 04-project-persistence
plan: 06
subsystem: verification

key-files:
  created: []
  modified: []

key-decisions:
  - "Checkpoint gaps reported; docs annotation deferred until next approval"

patterns-established: []

requirements-completed: []

duration: N/A
completed: 2026-04-29
---

# Phase 04 Plan 06: Human Verification Checkpoint — Gaps Captured

**Outcome: GAPS FOUND — Phase 4 not yet closed**

## Section Results

| Section | Steps | Status | Notes |
|---------|-------|--------|-------|
| A — Fresh project, save for the first time (PERS-01) | 1–9 | ✅ PASS | Save flow, dirty flag, JSON format all correct |
| B — Save As second time, overwrite | 10–13 | ✅ PASS | Ctrl+S fast-path, Ctrl+Shift+S Save As working |
| C — Reopen and continue (PERS-02) | 14–19 | ✅ PASS | Hydrate round-trip correct; viewport, scale, markups restored |
| D — Close-window-while-dirty guard (D-16) | 20–25 | ✅ PASS | SaveCloseModal, Save/Discard/Cancel all correct |
| E — Open-another-while-dirty (D-21) | 26–29 | ✅ PASS | Dirty guard fires before opening second file |
| F — Missing PDF recovery (D-23, D-25) | 30–36 | ❌ FAIL | Step 32: MissingPdfModal did not appear when PDF was renamed |
| G — Page-count hard abort (D-26) | 37–41 | ❌ FAIL | Step 37: PageCountAbortModal did not appear (dependent on F) |
| H — Hash-mismatch warn (D-12, D-28) | 42–45 | ❌ FAIL | No modal appeared when PDF replaced with different bytes |
| I — Dimension-mismatch warn (D-27) | 46–47 | N/A | Not tested (Section F failed first) |
| J — Text-input shortcut guard | 48 | Not tested | Deferred pending F/G/H fixes |
| K — Out-of-scope confirmations | 49–51 | Not tested | Deferred |

## User's Verbatim Response

> "32. a modal did not appear. 37. No modal appeared. Section F,G,H - no modal appeared. all previous sections are marked as approved."

## Root Cause Hypothesis

Three possible causes, all within `openClmcFromPath`:

1. **Silent error path** — `{ kind: 'error' }` is returned when IPC throws, file lock, or any unexpected exception. `handleOpenResult` logs to console only — no user-visible feedback. User sees nothing happen.

2. **`resolvePdfPath` returning non-null unexpectedly** — Windows path normalization, symlink, or some filesystem behavior causes `existsSync` to find the renamed file.

3. **`hashPdf` throwing silently** — For Section H (hash-mismatch), `sha256File` uses `createReadStream`; if it errors (permission, lock), the outer `catch` returns `{ kind: 'error' }` and the modal is never shown.

## Gap Summary

- **Gap 1 (F/G):** MissingPdfModal and PageCountAbortModal do not fire when PDF is missing
- **Gap 2 (H):** HashMismatchModal does not fire when PDF bytes have changed
- **Root fix needed:** Surface `{ kind: 'error' }` to the user; add diagnostic logging to identify the actual throw point

## Next Step

`/gsd:plan-phase 04 --gaps` — plan gap-closure tasks to fix the three failing recovery flows
