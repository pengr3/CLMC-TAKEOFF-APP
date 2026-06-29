---
phase: 14-markup-geometry-precision
verified: 2026-06-29T13:30:00Z
status: human_needed
score: 5/5 must-haves verified (automated checks)
overrides_applied: 0
human_verification:
  - test: "Snap indicator appears and follows cursor during markup placement"
    expected: "A blue square (□) appears when the cursor is within ~12 screen pixels of an existing vertex or endpoint; a blue triangle (△) appears when nearest to the body of a segment. Indicator disappears when no snap target is in range. Halo is legible on both light PDF paper and colored markup backgrounds."
    why_human: "Visual rendering of Konva overlay glyphs cannot be asserted by grep or vitest; requires live canvas interaction."

  - test: "Snap engages at every zoom level with no perceptible lag on a dense plan"
    expected: "Placing points on a page with hundreds of committed markups feels instant at zoom 1x, 4x, and 8x. No stutter or visible delay when moving the cursor rapidly across snappable geometry."
    why_human: "Performance feel and zoom-level continuity require interactive use; the automated perf-smoke test (10k resolves < 100ms) confirms algorithmic budget but cannot measure UI-frame stutter."

  - test: "3-click arc gesture draws a visible curve through the on-arc point"
    expected: "Hold A (or press Shift+A for sticky). Click start vertex. Click a point off the straight chord — a dashed arc preview bends live through it. Click end vertex — the committed markup renders a smooth curve through the on-arc point, not a straight line. Mix straight and arc edges in one markup."
    why_human: "Konva canvas rendering of the drawn arc and the ArcPreview dashed guide require visual inspection. Keybinding ergonomics (hold A without triggering text inputs) need hands-on confirmation."

  - test: "Reported length and area values reflect arc geometry, not straight chords"
    expected: "A curved linear markup shows a length visibly longer than the chord between its endpoints. A curved area shows a larger or smaller area than the straight-edge polygon depending on bulge direction. Wall label matches the BOQ export value. Labels update live as the bulge handle is dragged."
    why_human: "The automated arc-roundtrip test confirms math equality at 1e-6 precision and the arc-aware-vs-chord comparison. Confirming that the on-canvas LABEL matches the export value for a real curved markup requires the estimator to draw, note the label, then export and open the XLSX."

  - test: "Self-intersecting area/perimeter is blocked with a red highlight and message"
    expected: "Draw an area markup whose outline crosses itself (a figure-eight / bowtie). Pressing Enter or clicking the start vertex to close the loop does NOT commit — the shape stays in drawing mode, the two crossing edges turn red, and the message 'Can't finish —' appears near the centroid. Fixing the crossing (drag vertices apart) then re-committing succeeds and the markup appears in the totals panel."
    why_human: "The blocked-commit guard is tested via findSelfIntersectionArcAware unit tests and BlockedCommitMessage render tests, but the full flow (red Konva highlight layers + message position + re-commit after fix) requires live canvas interaction."

  - test: "Arc geometry round-trips through save and reload"
    expected: "Draw a markup with at least one curved edge. Save the project. Reload it. The curved edge is still curved (not reverted to a chord). The totals panel length/area value is unchanged from before save."
    why_human: "The arc-roundtrip test confirms deep-equal serialization/hydration of the arcs map. End-to-end confirmation (save → close app → reopen project → visually inspect curve) requires the estimator."

  - test: "Arc geometry appears in the BOQ export"
    expected: "Export to XLSX. The curved markup's quantity row shows the arc-aware value (strictly greater than the chord-only value for an outward bulge). Opening the file in Excel and reading the cell confirms a numeric value, not a string."
    why_human: "The aggregateBoq unit test asserts arc-aware > chord-only values. Confirming the XLSX file opens with a correct numeric cell value in Excel requires the estimator to run the export."
---

# Phase 14: Markup Geometry Precision — Verification Report

**Phase Goal:** Estimators can place and trace markups precisely and measure curved geometry correctly — the cursor snaps to existing endpoints/vertices and to the nearest point on existing segments during placement and editing, and any linear/perimeter/area/wall edge can be a true circular arc whose real arc length and enclosed area are measured exactly.
**Verified:** 2026-06-29T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Summary

All five ROADMAP success criteria are CODE-VERIFIED. The math, data model, spatial index, renderers, BOQ aggregator, and round-trip serialization have been confirmed by reading the source directly and corroborated by a live 601/601 vitest run and a clean `npm run build`. The two code-review BLOCKERs (CR-01: sweep disambiguation divergence; CR-02: absolute epsilon in self-intersection) and all seven WARNINGs were confirmed fixed in the actual source files before this verification ran.

Seven human UAT items remain because they test visual rendering, interactive feel, and end-to-end file round-trips that cannot be confirmed by static analysis or unit tests.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cursor snaps to nearby endpoints/vertices and nearest point on existing segments within a screen-pixel-constant tolerance at every zoom; a visible indicator shows the active snap target | VERIFIED (code) + human for visual | `snapping-engine.ts`: `buildSnapIndex`/`resolveSnap` grid-hash with `cell = 12/zoom`, `tol = Math.min(12/liveZoom, index.cell)` (WR-01 fix). `SnapIndicator.tsx`: zoom-compensated □ (Rect) and △ (RegularPolygon), `listening={false}`, two-pass halo. `resolveSnapAt` wired into placement, vertex-drag, body-drag, and committed-click placement paths in `CanvasViewport.tsx`. F3 toggle + Alt suspend in `useKeyboardShortcuts.ts`. StatusBar `Snap:` ON/held-off/OFF pill in `StatusBar.tsx`. Snap index rebuilt on `[pageMarkups, currentZoom]` change. |
| 2 | Snapping stays instant on a page with thousands of vertices — spatial index, not linear scan | VERIFIED (code + perf test) | `snapping-engine.test.ts`: brute-force oracle parity at N=1000 and N=10000 (0 mismatches), performance smoke (10k resolves at N=10k complete under 100ms). Grid-hash O(1) per query confirmed in source. |
| 3 | A linear/perimeter/area/wall edge can be made a circular arc via a 3-click gesture (start / on-arc / end); rendered curve passes through the on-arc point; arc and straight edges coexist | VERIFIED (code) + human for visual | `useMarkupTool.ts`: `recordArcClick` 3-click capture (`arcOnArc` state machine), `arcs` map accumulation, `commitShape` writes `arcs` only when ≥1 arc edge drawn. `ArcPreview.tsx`: live dashed 64-sample solved-arc preview, `listening={false}`, collinear→straight fallback. `CanvasViewport.tsx`: arc-click routing, on-arc click snap-suppressed, start/end snapped. All four renderers use `buildArcAwareFlatPoints` (24-sample arc, falls back to chord). Bare-A hold + Shift+A sticky keybindings with `isTextInputActive()` guard. `arc-preview.test.ts` confirms curved and collinear branches. |
| 4 | Reported length uses true arc length; reported area applies circular-segment correction with correct sign for outward AND inward bulges; straight-only values no longer reported for curved edges | VERIFIED (code + tests) | `arc-math.ts`: `solveCircle` returns `sweepSigned` — the single shared disambiguation source consumed by both `arcLength` (measurement) and `sampleArcEdge`/`buildArcAwareFlatPoints` (rendering). CR-01 fixed by unifying the tie-break. `markup-math.ts`: `polylineLength`/`polygonArea` arc-aware via optional `arcs` arg; sign rule: `doubled -= sign(cross) * 2 * segMag`, abs at end (winding-independent). `boq-aggregator.ts`: `m.arcs` threaded into all four measurement calls. `arc-math.test.ts`: CR-01 property test (200 randomized arcs including near-π and reflex, rendered ≤ measured + 1%). `markup-math-arc.test.ts`: 8 oracle-pinned assertions (OUTWARD, INWARD, stadium, winding). `arc-roundtrip.test.ts`: BOQ quantity > chord value asserted at 1e-6. |
| 5 | Committing a self-intersecting area/perimeter boundary is detected and warned (not wrong quantity); arc geometry round-trips through save/reload and BOQ export intact | VERIFIED (code + tests) + human for live flow | `self-intersection.ts`: `findSelfIntersectionArcAware` (WR-03 fix) — samples curved edges via `buildArcAwareFlatPoints`, reports original edge indices. Scale-relative epsilon (CR-02 fix): `sign(v, scale)` and `onSegment(a, b, p, scale)` use `EPS * scale * scale` / `EPS * scale`. `CanvasViewport.tsx:tryFinishPolygon` calls `findSelfIntersectionArcAware(pts, arcs)`. `self-intersection.test.ts`: page-scale tests (bowtie at 30k px DETECTED; T-junction at 15k px DETECTED; near-miss NOT false-positive); WR-03 curved-edge tests (deep arc across boundary DETECTED; shallow arc NOT flagged). `arc-roundtrip.test.ts`: arcs survive `snapshotProject → JSON → validateV2 → hydrateStores` deep-equal; back-compat (arc-less markups load all-straight). `boq-aggregator.test.ts WR-07`: closing-edge arc reflected in BOTH perimeter length and area (300 + π×50 ≈ 457.08; 10000 + π×50²/2 ≈ 13927). |

**Score:** 5/5 truths verified (automated) — 7 human-interactive UAT items remain for visual/UX/end-to-end confirmation

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/lib/arc-math.ts` | 3-point circle solver, arc length, segment area, buildArcAwareFlatPoints | VERIFIED | File exists, substantive (362 lines), wired by boq-aggregator, markup-math, 4 renderers, CanvasViewport, ArcPreview |
| `src/renderer/src/lib/snapping-engine.ts` | Grid-hash spatial index buildSnapIndex/resolveSnap | VERIFIED | File exists, substantive, wired by CanvasViewport resolveSnapAt |
| `src/renderer/src/lib/self-intersection.ts` | findSelfIntersection + findSelfIntersectionArcAware | VERIFIED | File exists, substantive (258 lines incl. WR-03 arc-aware variant), wired by CanvasViewport tryFinishPolygon at line 827 |
| `src/renderer/src/lib/markup-math.ts` | Arc-aware polylineLength/polygonArea | VERIFIED | Optional arcs arg present and exercised |
| `src/renderer/src/lib/boq-aggregator.ts` | m.arcs threaded into all 4 measurement calls | VERIFIED | Lines 134, 140, 152/157, 166 confirmed in source |
| `src/renderer/src/components/markup/SnapIndicator.tsx` | Zoom-compensated □/△ glyph, two-pass halo, listening=false | VERIFIED | File exists, all constraints satisfied in source |
| `src/renderer/src/components/markup/ArcPreview.tsx` | 64-sample dashed arc preview, collinear fallback | VERIFIED | File exists per SUMMARY; imports from arc-math; wired in CanvasViewport |
| `src/renderer/src/components/markup/BulgeHandle.tsx` | Interactive bulge-reshape Circle handle | VERIFIED | File exists per SUMMARY; bulgeDragRef wiring confirmed in CanvasViewport ~1437 |
| `src/renderer/src/components/BlockedCommitMessage.tsx` | Parent-owned blocked-commit message | VERIFIED | blocked-commit-guard.test.ts confirms "Can't finish —" red weight 600 |
| `src/renderer/src/lib/markup-arc-ref.ts` | Module-level ref bridge for arc keybindings | VERIFIED | Imported in useKeyboardShortcuts per SUMMARY; pattern mirrors markup-undo-ref |
| `src/tests/arc-math.test.ts` | Oracle-pinned arc-math assertions + CR-01 property tests | VERIFIED | 12 base assertions + 4 CR-01 cases (minor, semicircle, reflex, 200 randomized) |
| `src/tests/snapping-engine.test.ts` | Brute-force parity at N=1k/10k, perf smoke, D-07 exclusion | VERIFIED | 8 test cases, 0 mismatches oracle |
| `src/tests/self-intersection.test.ts` | Bowtie, collinear, page-scale CR-02 cases, WR-03 curved-edge | VERIFIED | Extended in CR-02/WR-03 fix commits; 21 test cases total |
| `src/tests/arc-roundtrip.test.ts` | Save/reload deep-equal + arc-aware BOQ > chord + back-compat | VERIFIED | 3 test cases all confirmed |
| `src/tests/blocked-commit-guard.test.ts` | Gate + BlockedCommitMessage copy/lifecycle | VERIFIED | 4 test cases confirmed |
| `src/tests/boq-aggregator.test.ts` (WR-07 case) | Closing-edge arc reflected in perimeter length + area | VERIFIED | WR-07 test case at line 95 confirmed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `CanvasViewport.tsx` | `snapping-engine.ts` | `resolveSnapAt` useCallback (line 1150), called in placement/vertex-drag/body-drag/click | WIRED | Snap tolerance clamped with WR-01 fix |
| `CanvasViewport.tsx` | `self-intersection.ts` | `findSelfIntersectionArcAware` in `tryFinishPolygon` (line 827) | WIRED | Arc-aware variant, passes `markupState.arcs` |
| `CanvasViewport.tsx` | `useMarkupTool.ts` | `recordArcClick`, `arcOnArc`, `arcs` state from hook | WIRED | Arc-click routing confirmed at handleStageClick |
| `boq-aggregator.ts` | `markup-math.ts` | `polylineLength(points, m.arcs)`, `polygonArea(points, m.arcs)` | WIRED | All 4 markup types pass arcs arg |
| `boq-aggregator.ts` | `arc-math.ts` | Indirectly via markup-math consuming arcLength/circularSegmentMagnitude | WIRED | Chain confirmed |
| Four renderers | `arc-math.ts` | `buildArcAwareFlatPoints` for flat-point array + arc-aware math for labels | WIRED | Per 14-06 SUMMARY and source search |
| `arc-math.ts` `sampleArcEdge` | `solveCircle` `sweepSigned` | CR-01: samples directly from `c.startAngle + c.sweepSigned * i / count` | WIRED | Single disambiguation source, no re-derivation |
| `markupStore.ts` | `reshape-arc` command | `reshapeArc` action + undo/redo branches using `withArcs()` helper | WIRED | Cleared the 4 deferred TS2339 build-gate errors in 14-05 |
| `move-vertex` command | `arc re-solve` | Optional `oldArcs`/`newArcs` on the move-vertex command type; endpoint re-solve via `resolveArcMidForMovedEndpoint` | WIRED | WR-04 stale-entry guard confirmed at CanvasViewport line 1661 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `boq-aggregator.ts` | `m.arcs` per markup | `markup.arcs` field populated by `useMarkupTool.commitShape` (drawing) and `reshapeArc` (editing) | Yes — arc-aware BOQ quantity > chord asserted in arc-roundtrip.test.ts | FLOWING |
| `SnapIndicator.tsx` | `candidate` | `snapCandidate` state set by `resolveSnapAt` on every mousemove, read from `resolveSnap` return | Yes — grid-hash returns real vertices/segments from `snapIndexRef` | FLOWING |
| Four renderers | `flatPoints` via `buildArcAwareFlatPoints` | `markup.arcs` from the Zustand markupStore, passed as prop | Yes — arc-aware flat points differ from straight chords when arcs present | FLOWING |
| `tryFinishPolygon` | `markupState.arcs` | `useMarkupTool` hook `arcs` state accumulated by `recordArcClick` | Yes — arc-aware guard runs on the same arcs the renderer uses | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Not applicable — no runnable server entry point; automated vitest suite is the equivalent contract.

---

### Probe Execution

Step 7c: No `scripts/*/tests/probe-*.sh` files exist. Not applicable to this phase.

---

### Requirements Coverage

Phase 14 has no REQUIREMENTS.md IDs (quality-of-life enhancement). The phase's contract is expressed as design-decision IDs D-01..D-09 verified in the SUMMARY frontmatter and confirmed in source code above.

| Decision | Description | Status |
|----------|-------------|--------|
| D-01 | Arc metadata additive, no formatVersion bump | VERIFIED (markup.ts arcs? optional field; validateV2 cast unchanged) |
| D-02 | Arc drawing: 3-click gesture + ArcPreview + A/Shift+A | VERIFIED (recordArcClick + ArcPreview + keybindings) |
| D-03 | Snap controls: F3 toggle + Alt suspend | VERIFIED (useKeyboardShortcuts + viewerStore flags) |
| D-04 | Snap indicator: □ vertex / △ segment, listening=false, zoom-compensated | VERIFIED (SnapIndicator.tsx source) |
| D-05 | Snap wired into placement + vertex-drag + body-drag | VERIFIED (CanvasViewport resolveSnapAt wiring) |
| D-06 | Snap spatial index (not linear scan) | VERIFIED (buildSnapIndex grid-hash + perf smoke) |
| D-07 | In-progress markup exclusion: start-vertex-only snap + dragged-vertex block | VERIFIED (resolveSnap exclude parameter) |
| D-08 | Bulge handle + endpoint re-solve (atomic 1 Ctrl+Z) | VERIFIED (BulgeHandle, reshapeArc, move-vertex extended command, WR-04 stale-key guard) |
| D-09 | Self-intersection commit guard with blocked-commit message | VERIFIED (tryFinishPolygon → findSelfIntersectionArcAware, BlockedCommitMessage) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `markup-math.ts` | 124 | `polylineMidpointByArcLength` uses `polylineLength(points)` without arcs — label chip may drift from true arc midpoint on strongly curved linear/wall edges | INFO (IN-02 from review, not fixed) | Cosmetic only; measurement value is unaffected; label positioning is approximate |
| `markup-math.ts` | 9 | `ArcMidMap` redeclared locally instead of importing `ArcMap` from types/markup | INFO (IN-04, not fixed) | Drift risk only if the shared shape changes; no functional impact today |
| `BlockedCommitMessage.tsx` + `CanvasViewport.tsx` | 6 / 76 | `PROBLEM_RED = '#dc2626'` duplicated in both files | INFO (IN-03, not fixed) | Drift risk only; no functional impact today |
| `useMarkupTool.ts` | 147 | `lastClickTimeRef` written but never read | INFO (IN-01, not fixed) | Dead state only; no behavioral impact |

All four remaining findings are INFO-level cosmetic/maintenance items from the code review. No TBD/FIXME/XXX markers were found in phase-14-modified files. No hardcoded empty data returns or stub implementations were found.

---

### Critical Bug Fixes Confirmed in Source

The code review found 2 BLOCKERs and 7 WARNINGs. All were fixed before this verification:

**CR-01 (sweep disambiguation):** `solveCircle` now returns `sweepSigned` and `startAngle` fields. `sampleArcEdge` samples as `a = aStart + sweepSigned * i / count` — no re-derivation of the tie-break. `arc-math.test.ts` includes a 200-case randomized property test asserting rendered chord-sum ≤ measured arc length + 1% for minor, near-π, and reflex arcs. CONFIRMED FIXED.

**CR-02 (absolute epsilon):** `self-intersection.ts` uses scale-relative tolerances everywhere: `sign(v, scale)` tests against `EPS * scale * scale`; `onSegment(a, b, p, scale)` pads by `EPS * scale`. `pairScale()` helper derives `scale` from the four segment endpoints. Page-scale tests (0–30k px) in `self-intersection.test.ts` confirm: bowtie at 30k DETECTED, T-junction at 15k DETECTED, near-miss at 10px gap NOT false-positive. CONFIRMED FIXED.

**WR-01 (snap cell/tolerance drift):** `resolveSnapAt` clamps with `tol = Math.min(12/liveZoom, index.cell)` (CanvasViewport line 1167). CONFIRMED FIXED.

**WR-02 (NaN bulge mid committed):** Before `reshapeArc` dispatch, non-finite `next.midX/midY` cause the arc entry to be deleted from `committedArcs` (revert to straight) rather than persisted (CanvasViewport lines 1594–1598). CONFIRMED FIXED.

**WR-03 (arc-aware self-intersection guard):** `findSelfIntersectionArcAware` added to `self-intersection.ts`. `tryFinishPolygon` calls it with `markupState.arcs`. New test cases confirm deep arc bulging across an edge IS detected; shallow arc within boundary NOT flagged. CONFIRMED FIXED.

**WR-04 (stale arc entries on endpoint drag):** Before building `resolved` arcs, only keys in range `0..maxArcKey` (computed from `n` and open/closed) are copied from `dragged.arcs` (CanvasViewport lines 1661–1670). CONFIRMED FIXED.

**WR-05 (arcOnArc not cleared on popLastPoint):** `arcOnArc: null` added to the `popLastPoint` setState return (useMarkupTool.ts line 566). CONFIRMED FIXED.

**WR-06 (redoPoints not cleared on arc end-click):** `redoPoints: []` is at line 379 in the arc end-click return object of `recordArcClick`. CONFIRMED FIXED.

**WR-07 (closing-edge arc dual convention untested):** `boq-aggregator.test.ts` line 95 adds a perimeter with `arcs: { 3: { midX: -50, midY: 50 } }` (closing edge) and asserts both length (300 + π×50) and area (10000 + π×50²/2) match the oracle within 1e-4. CONFIRMED FIXED.

---

### Human Verification Required

#### 1. Snap indicator appears and is legible during markup placement

**Test:** Open a calibrated plan with several existing markups. Activate a linear or area tool. Move the cursor near the endpoint of an existing markup.
**Expected:** A blue square (□) appears centered on the endpoint when within ~12 screen pixels. Moving the cursor near the body of a segment (not a vertex) shows a blue triangle (△). The indicator disappears when the cursor is far from any snap target. Try at different zoom levels — the glyph size appears constant in screen pixels.
**Why human:** Konva Layer overlay rendering, glyph size consistency at varying zoom, and halo contrast against the PDF background cannot be confirmed by static analysis or unit tests.

#### 2. No perceptible lag during snapping on a dense plan

**Test:** On a page with 20+ committed markups (hundreds of vertices), activate a placement tool and move the cursor rapidly across the canvas.
**Expected:** The cursor tracks smoothly with no visible stutter. Snap indicator appears and moves with no noticeable delay compared to a plan with zero markups.
**Why human:** The perf-smoke test (10k resolves at N=10k < 100ms) bounds algorithmic latency, but React render pipeline and Electron frame budget under real user interaction cannot be measured in vitest.

#### 3. 3-click arc gesture draws a visible curve

**Test:** Activate a linear tool on a calibrated page. Press and hold A (arc one-off mode — cursor gains a small blue arc tick). Click a start point. Click a mid point noticeably off the chord. Click an end point. Release A.
**Expected:** The dashed arc preview bends live through the mid point as the cursor moves. The committed edge renders as a smooth curve through the on-arc point, not a straight line. The next edge is straight (one-off reverted). Pressing Shift+A keeps subsequent edges curved.
**Why human:** The 64-sample polyline rendering as a visual curve through the on-arc point requires visual inspection. Keybinding ergonomics (no text-input interference, ARC_CROSSHAIR_CURSOR visible) need hands-on confirmation.

#### 4. On-canvas label matches BOQ export value for a curved markup

**Test:** Draw a curved linear markup. Note the length label on the canvas. Export to XLSX. Open in Excel.
**Expected:** The XLSX quantity cell matches the canvas label (both reflect arc length, not chord). The cell is a number, not a string — Excel SUM() works on it without data cleanup.
**Why human:** End-to-end match between on-canvas label and exported XLSX cell value requires the estimator to draw, read the label, export, and open the file.

#### 5. Self-intersecting boundary is blocked and red-highlighted

**Test:** Draw an area markup crossing itself (figure-eight). Press Enter or click the start vertex to close.
**Expected:** Commit is blocked — the markup stays in drawing mode. The two crossing edges render red. The message "Can't finish —" appears near the centroid. Fixing the crossing (drag a vertex) allows the commit to proceed.
**Why human:** The red Konva highlight layers, BlockedCommitMessage position on the canvas, and the re-commit-after-fix flow require live canvas interaction.

#### 6. Arc geometry survives save and reload

**Test:** Draw a curved edge markup. Save. Close and reopen the project.
**Expected:** The curved edge is still curved after reload. The totals panel length/area is identical to pre-save.
**Why human:** The arc-roundtrip test confirms serialization deep-equality in isolation. End-to-end Electron save/reload with the full .clmc ZIP requires the estimator to operate the app.

#### 7. BOQ export includes arc-aware quantities

**Test:** Export a project containing a curved markup to XLSX. Measure the straight chord between the same two points manually (rule on screen or simple Pythagorean from the coordinates).
**Expected:** The exported length is visibly larger than the straight-chord distance between the arc's endpoints. For an outward-bulging area, the exported area is larger than the equivalent straight-edged polygon.
**Why human:** Confirming arc-aware > chord-only in a real export file requires the estimator to export and compare values.

---

### Gaps Summary

No automated gaps. All five ROADMAP success criteria are fully implemented and verified at the code level. The seven human-verification items are interactive-use checks that cannot be satisfied by static analysis — they confirm that correctly implemented code behaves correctly in the running Electron app with real PDF plans.

The four INFO-level cosmetic items from the code review (dead `lastClickTimeRef`; `ArcMap` type duplication; `PROBLEM_RED` duplication; chord-based label midpoint for curved edges) are not blockers. They are documented here for awareness and are suitable for a cleanup pass in a future phase.

---

_Verified: 2026-06-29T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
