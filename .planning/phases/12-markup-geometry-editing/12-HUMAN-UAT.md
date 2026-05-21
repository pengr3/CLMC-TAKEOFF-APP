---
status: passed
phase: 12-markup-geometry-editing
source: [12-VERIFICATION.md]
started: 2026-05-21T16:25:00.000Z
updated: 2026-05-21T16:50:00.000Z
approved_by: user
approved_at: 2026-05-21T16:48:00.000Z
---

## Current Test

(none — all items passed in-session)

## Tests

### 1. Single click vertex edit activation on line markup
expected: Handles visible on first click; the original selection halo (accent-color ring at 10/zoom) does NOT also render around the markup (it would engulf the handles)
result: PASS — UAT Scenario A. Initial UAT failed (halo engulfed handles); fixed via post-UAT commits 000f9e3 (single-click + halo only for pins/groups) and 564f0cb (markupClickedRef handoff so handles don't unmount on the same click). User approved 2026-05-21.

### 2. Drag a vertex handle on a linear with 3 points by 10+ screen pixels
expected: Line updates live during drag; on release the vertex stays at new position; Ctrl+Z restores exactly one vertex move; vertex edit mode stays active (handles still visible after release)
result: PASS — UAT Scenario C. Minor-adjustment failure at 800% zoom fixed via post-UAT commit 72094dc (zoom-compensate D-09 4px threshold). User approved 2026-05-21.

### 3. Escape after dragging a vertex handle on an area polygon
expected: Markup snaps back to ORIGINAL session-start vertex positions; no undo entry created
result: PASS — UAT Scenario D. vertexEditOriginalRef snapshot taken once at session start (handleMarkupClick); cancelVertexEdit() drops the drag preview without dispatching. User approved 2026-05-21.

### 4. Rubber-band select two markups; drag either one by 10+ screen pixels
expected: Both markups move by the same delta; halos remain visible on both during drag; Ctrl+Z restores BOTH in a single step
result: PASS — UAT Scenario I. moveMarkups command dispatched once for all selected markups (D-08); halos render via selection-ring Layer for multi-select. User approved 2026-05-21.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none)
