---
status: passed
phase: 14-markup-geometry-precision
source: [14-VERIFICATION.md, 14-06-SUMMARY.md]
started: 2026-06-29T05:21:50Z
updated: 2026-06-29T05:21:50Z
---

## Current Test

All items approved by the user after UAT-round-2 fixes (in-progress arc render,
arc-capture cancellation, first-vertex snap glyph, arc-mode badge).

## Tests

### 1. Snap indicator appears and tracks the cursor (SC #1)
expected: Starting a markup near an existing endpoint/vertex shows a blue □ that snaps to it; moving along an existing segment shows a blue △ that snaps onto the line. The glyph follows the cursor with a contrasting halo and stays the same on-screen size when zooming 1x → 8x.
result: [pass]

### 2. Screen-constant snap tolerance + controls (SC #1)
expected: Press F3 → StatusBar shows "Snap: OFF" (amber) and no glyph appears; F3 again restores ON. Hold Alt while placing → the glyph disappears while held and returns on release. Snap tolerance feels the same in screen pixels at every zoom.
result: [pass]

### 3. No perceptible lag at scale (SC #2)
expected: On a page with thousands of existing vertices, placing/editing a markup with snapping on stays instant — no stutter or lag as the cursor moves.
result: [pass]

### 4. 3-click arc gesture draws a true curve, coexists with straight (SC #3)
expected: While drawing a linear/perimeter/area/wall edge, hold A (one-off) or Shift+A (sticky), then click start → on-arc point → end. The rendered edge is a curve passing through the on-arc point. A single markup can mix straight and arc edges. Sticky mode draws a run of arcs.
result: [pass]

### 5. True arc length + area, and BOQ matches (SC #4)
expected: A curved edge's reported length is greater than its straight chord, and a curved area reflects the circular-segment correction (outward bulge larger, inward smaller). The on-canvas label matches the value exported to the BOQ (XLSX/CSV) — both use the arc, not the chord.
result: [pass]

### 6. Arc editing: bulge handle + endpoint re-solve, undoable (SC #4)
expected: Drag the round blue bulge handle → the curve deepens/flattens and the length updates live; drag past the safe limit → the guide turns amber and stops (sagitta cap). One Ctrl+Z reverts the whole reshape. Dragging an arc's endpoint corner re-bends the arc to follow it, also reverted by a single Ctrl+Z. (Confirm the WR-02 fix: dragging a bulge on a degenerate/zero-length edge does not corrupt the saved geometry.)
result: [pass]

### 7. Self-intersecting commit is blocked (SC #5)
expected: Tracing an area/perimeter whose outline crosses itself (straight OR curved) blocks the commit, highlights the crossing in red, and shows the "Can't finish —" message; the markup stays editable. Dragging a corner apart to remove the crossing then lets it finish with a valid quantity.
result: [pass]

### 8. Arc geometry round-trips through save/reload + export (SC #5)
expected: Save the project, close the app, reopen → every arc edge reloads as the same curve with the same measured length. Re-export the BOQ → arc-aware quantities are unchanged. (Old pre-Phase-14 projects still open, with all edges straight.)
result: [pass]

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
