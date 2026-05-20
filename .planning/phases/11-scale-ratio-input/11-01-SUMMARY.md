---
phase: "11"
plan: "01"
subsystem: scale-math
tags: [tdd, scale, math, pure-functions]
dependency_graph:
  requires: []
  provides: [computePixelsPerMmFromRatio, isoSheetLabel]
  affects: [src/renderer/src/lib/scale-math.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, pure-function-math, module-scope-constant-lookup]
key_files:
  created:
    - src/tests/scale-ratio-math.test.ts
  modified:
    - src/renderer/src/lib/scale-math.ts
decisions:
  - computePixelsPerMmFromRatio uses denominator in formula (pageWidthPx / (pageWidthMm * denominator)) — algebraically equivalent to draw-line path; confirmed by numerical cross-check in tests
  - isoSheetLabel uses module-scope ISO_SIZES constant (not exported) for A0-A4 lookup with ±5 mm tolerance, matches both portrait and landscape orientations
  - × character (U+00D7) used in label string, not letter x, per RESEARCH.md specification
metrics:
  duration: 2 minutes
  completed_date: "2026-05-20"
  tasks_completed: 2
  files_changed: 2
---

# Phase 11 Plan 01: Scale Ratio Math — TDD RED + GREEN Summary

**One-liner:** Pure math helpers for 1:N drawing scale ratio — `computePixelsPerMmFromRatio` formula verified numerically equivalent to draw-line path; `isoSheetLabel` ISO 216 lookup with ±5 mm tolerance.

---

## What Was Built

Two new exported functions appended to `src/renderer/src/lib/scale-math.ts`:

1. **`computePixelsPerMmFromRatio(pageWidthPx, pageViewWidthPt, denominator)`** — converts a 1:N drawing scale ratio to `pixelsPerMm`. Formula: `pageWidthPx / ((pageViewWidthPt * 25.4 / 72) * denominator)`. Throws for non-positive inputs (T-11-01-01 guard).

2. **`isoSheetLabel(widthMm, heightMm)`** — returns a human-readable sheet size string (e.g. `841 × 594 mm — A1`). Checks both portrait and landscape orientations for A0–A4 within ±5 mm tolerance.

A module-scope `ISO_SIZES` constant holds the ISO 216 A-series dimensions (not exported).

Test file `src/tests/scale-ratio-math.test.ts` covers 14 test cases (8 for `computePixelsPerMmFromRatio`, 6 for `isoSheetLabel`).

---

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `26d88a1` | test(11-01): 14 failing tests — functions not yet in scale-math.ts |
| GREEN | `7adf8af` | feat(11-01): 14 tests pass; 507-test full suite green |

---

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED: failing tests | `26d88a1` | `src/tests/scale-ratio-math.test.ts` (created) |
| 2 | GREEN: implementation | `7adf8af` | `src/renderer/src/lib/scale-math.ts` (modified) |

---

## Verification

- `npx vitest run src/tests/scale-ratio-math.test.ts` — 14/14 PASS
- `npx vitest run` — 507/507 PASS (69 test files, no regressions)
- `grep -c "export function computePixelsPerMmFromRatio" src/renderer/src/lib/scale-math.ts` → 1
- `grep -c "export function isoSheetLabel" src/renderer/src/lib/scale-math.ts` → 1

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. Both functions are fully implemented and return correct values; no placeholder logic.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. Both functions are pure math helpers with no side effects.

The threat register entry T-11-01-01 (guard clauses for non-positive inputs) has been applied — all three guard throws present in `computePixelsPerMmFromRatio` and verified by tests.

## Self-Check: PASSED

- `src/tests/scale-ratio-math.test.ts` — FOUND
- `src/renderer/src/lib/scale-math.ts` — FOUND (modified)
- Commit `26d88a1` — FOUND (test RED)
- Commit `7adf8af` — FOUND (feat GREEN)
