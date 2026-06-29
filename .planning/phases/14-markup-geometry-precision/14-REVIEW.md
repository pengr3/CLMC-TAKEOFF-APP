---
phase: 14-markup-geometry-precision
reviewed: 2026-06-29T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - src/renderer/src/components/BlockedCommitMessage.tsx
  - src/renderer/src/components/CanvasViewport.tsx
  - src/renderer/src/components/StatusBar.tsx
  - src/renderer/src/components/TotalsCategoryBlock.tsx
  - src/renderer/src/components/WallMarkup.tsx
  - src/renderer/src/components/markup/ArcPreview.tsx
  - src/renderer/src/components/markup/AreaMarkup.tsx
  - src/renderer/src/components/markup/BulgeHandle.tsx
  - src/renderer/src/components/markup/LinearMarkup.tsx
  - src/renderer/src/components/markup/PerimeterMarkup.tsx
  - src/renderer/src/components/markup/SnapIndicator.tsx
  - src/renderer/src/hooks/useKeyboardShortcuts.ts
  - src/renderer/src/hooks/useMarkupTool.ts
  - src/renderer/src/lib/arc-math.ts
  - src/renderer/src/lib/boq-aggregator.ts
  - src/renderer/src/lib/markup-arc-ref.ts
  - src/renderer/src/lib/markup-math.ts
  - src/renderer/src/lib/self-intersection.ts
  - src/renderer/src/lib/snapping-engine.ts
  - src/renderer/src/stores/markupStore.ts
  - src/renderer/src/stores/viewerStore.ts
  - src/renderer/src/types/markup.ts
  - src/renderer/src/types/viewer.ts
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-29
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 14 adds curved-edge arc geometry (3-point circle solve, arc-length / circular-segment-area measurement), a grid-hash snapping engine, a self-intersection commit guard, the bulge-reshape edit gesture, and the extended undo/redo command union (`reshape-arc` + arc-carrying `move-vertex`). The pure-math modules (`arc-math.ts`, `self-intersection.ts`, `snapping-engine.ts`) are carefully finite-guarded and the undo/redo arc symmetry is largely sound.

Two correctness defects rise to BLOCKER: (1) `solveCircle`'s sweep disambiguation diverges from `sampleArcEdge`'s / `ArcPreview`'s, so for a boundary class of arcs the **measured** length/area (the BOQ quantity the estimator bills from) does not match the **drawn** curve; and (2) the self-intersection guard's geometric predicates use an absolute `EPS = 1e-9` that is meaningless at the tens-of-thousands-of-pixels page coordinates this app actually uses, making its collinear-overlap / grazing-touch detection unreliable. The remaining findings concern snap-tolerance/cell drift, NaN propagation into committed arc state, the guard ignoring arc curvature, mid-arc-gesture state not being reset on undo, and several robustness gaps.

The arc metadata is correctly additive (optional `arcs?` field, no `formatVersion` bump) — backward compatibility with pre-Phase-14 `.clmc` files is preserved.

## Critical Issues

### CR-01: `solveCircle` and `sampleArcEdge`/`ArcPreview` disagree on sweep direction — measured quantity can mismatch the drawn arc

**File:** `src/renderer/src/lib/arc-math.ts:96-98` (vs `:263-266`); also `src/renderer/src/components/markup/ArcPreview.tsx:84-87`
**Issue:** Three sites independently re-derive which way the arc sweeps, and the tie-break is not equivalent.

In `solveCircle` (feeds **measurement** — `arcLength` and `circularSegmentMagnitude`):
```ts
const sweepToMid = ccw(a1, aMid)
const sweepToEnd = ccw(a1, aEnd)
const sweep = sweepToMid < sweepToEnd ? sweepToEnd : 2 * Math.PI - sweepToEnd
```

In `sampleArcEdge` (feeds **rendering** — `buildArcAwareFlatPoints`) and identically in `ArcPreview.sampleArc`:
```ts
const goCcw = ccwToMid <= ccwToEnd
const sweep = goCcw ? ccwToEnd : -(2 * Math.PI - ccwToEnd)
```

The comparison operator differs (`<` vs `<=`) and the major/minor selection is re-expressed independently. For inputs where `sweepToMid === sweepToEnd` (the on-arc point and end point share a center angle, or floating-point rounds them equal near the semicircle boundary), `solveCircle` selects the reflex sweep `2π − sweepToEnd` while the renderer selects the minor sweep `ccwToEnd`. The BOQ quantity then describes a different arc than the canvas draws — a silent measurement error on the exact value the estimator bills. Two/three independent re-implementations of one disambiguation is the root cause; the operator divergence makes it inevitable rather than theoretical.
**Fix:** Have `solveCircle` return the signed start angle + signed sweep, and make both `sampleArcEdge` and `ArcPreview.sampleArc` sample directly from those values (`a = aStart + sweep * i / count`) instead of re-deriving. Add a property test asserting the chord-sum of `buildArcAwareFlatPoints` equals `arcLength` (within sampling error) for randomized arcs that include the near-π and reflex cases.

### CR-02: Self-intersection guard's geometric epsilon is absolute (`1e-9`) — collinear-overlap / grazing detection is unreliable at page-scale coordinates

**File:** `src/renderer/src/lib/self-intersection.ts:22`, `:30-43`, `:81-92`
**Issue:** `EPS = 1e-9` is used as an **absolute** tolerance in `sign()` (the cross-product zero test) and `onSegment()` (the bounding-box pad). Markup coordinates here are page-space pixels in the tens of thousands. The strict-crossing branch (`d1 !== d2 && d3 !== d4`) survives because true crossings yield cross products ~1e6–1e8, far above 1e-9 — that path is fine. But the **collinear-overlap / endpoint-on-edge** branch is the load-bearing case for "two edges that graze or touch without a clean X" (a T-junction or a vertex sitting on another edge — exactly how a self-touching boundary commits a wrong area). At page scale, a cross product that should read "≈ 0, collinear" can be 1e-3–1e1 in magnitude purely from float error, so `sign()` returns ±1 and the collinear branch never fires; conversely the `onSegment` pad of ±1e-9 px is so small it cannot absorb rounding on large coordinates. The guard therefore misses near-collinear self-touches it is specifically meant to block, letting a degenerate boundary commit a wrong quantity.

(Note: the adjacent-edge skip logic at `:121-127` was traced for `n=4` and is correct — the defect is the epsilon scale, not the pair enumeration.)
**Fix:** Replace the absolute `EPS` in `sign()`/`onSegment()` with a scale-relative tolerance derived from the segment magnitudes, mirroring the `collinearTol = EPS * spread * spread` pattern already proven in `arc-math.ts:69`. Add unit tests at realistic page coordinates (0–30000 px): a bowtie quad (clean X — must detect), a T-junction where a vertex lands on another edge (collinear touch — must detect), and a near-miss (must NOT false-positive).

## Warnings

### WR-01: Snap cell size and query tolerance can drift out of the `cell >= tolerance` invariant during zoom

**File:** `src/renderer/src/components/CanvasViewport.tsx:678` and `:1154-1155`
**Issue:** The index is built with `cell = 12 / currentZoom` (subscribed render value, rebuilt by a `useEffect`). The query computes `tol = 12 / liveZoom` from `useViewerStore.getState()` at event time. During an active zoom gesture the rebuild effect has not yet run, so `liveZoom` can be smaller than the `currentZoom` baked into the index → `tol > cell`. The engine documents that the 3×3 neighbourhood query is only exhaustive when `cell >= tolerance` (`snapping-engine.ts:10-12`); violating it silently drops valid vertices just outside the 3×3 window, so snapping intermittently fails to engage mid-zoom.
**Fix:** Derive both from one zoom snapshot, build with `cell = max(12/currentZoom, 12/liveZoom)`, or clamp the query tolerance to the index's own cell (`tol = Math.min(12/liveZoom, index.cell)`).

### WR-02: NaN/Infinity on-arc midpoint from a degenerate bulge drag is committed into persistent markup state

**File:** `src/renderer/src/components/CanvasViewport.tsx:1425-1430`, `:1581`
**Issue:** `clampBulgeToSagittaCap` returns the raw dragged point unchanged when the chord is degenerate (`chordLen < EPS`) or any input is non-finite (`arc-math.ts:141,148`). The reshape preview stores `{ midX: capped.x, midY: capped.y }`, and on mouseup `reshapeArc(...)` writes it straight into `markup.arcs` with no finite-guard. The downstream pure-math guards against *reading* a NaN arc, but persisting NaN into the saved `.clmc` arc map serialises to JSON `null` and reloads as a malformed entry — the exact "corrupt save file" case the math modules defend against, now produced by normal interaction on a zero-length edge.
**Fix:** In the bulge-commit path (before `reshapeArc`), reject the new mid when `!Number.isFinite(next.midX) || !Number.isFinite(next.midY)` and fall back to dropping the arc entry (revert to straight).

### WR-03: Self-intersection guard ignores arc curvature — a self-crossing curved boundary commits silently

**File:** `src/renderer/src/components/CanvasViewport.tsx:822`, `src/renderer/src/lib/self-intersection.ts:104-116`
**Issue:** `tryFinishPolygon` runs `findSelfIntersection(markupState.points)` on the **straight chords only**. An arc edge whose sagitta bulges across another edge is not detected. The sagitta cap limits a single edge's bulge to `|chord|/2`; it does NOT prevent a capped arc from crossing a *different* edge. The estimator can commit a curved area/perimeter that self-crosses and bills a wrong quantity — the precise failure D-09 exists to prevent.
**Fix:** Run detection on the arc-sampled boundary (`buildArcAwareFlatPoints(points, arcs, true)` decomposed into segment pairs), or document this as an explicit accepted limitation with a test demonstrating the sampled-boundary case is out of scope.

### WR-04: Stale out-of-range arc entries can survive a vertex move via the `...dragged.arcs` spread

**File:** `src/renderer/src/components/CanvasViewport.tsx:1635-1656`
**Issue:** `resolved` is seeded with `{ ...dragged.arcs }` and only the incoming/outgoing edges of the dragged vertex are re-solved. If `dragged.arcs` carries an entry keyed on an index `>= n` (possible after points were popped/edited earlier without pruning arcs), that stale entry is copied verbatim into the new arc map and committed by `moveVertex`. The endpoint-re-solve index math itself traces correctly for both open and closed shapes, but it does not defend against an already-inconsistent arc map.
**Fix:** Before dispatch, drop any arc entry whose key is out of range for the current edge count (`>= n` open, `> n-1` closed). Add a test for dragging an endpoint of a polygon that previously had an arc on a since-removed edge.

### WR-05: `popLastPoint` does not reset in-flight `arcOnArc`, orphaning a mid-arc shaping point on undo

**File:** `src/renderer/src/hooks/useMarkupTool.ts:557-566`
**Issue:** While mid arc-edge (second click captured `arcOnArc`, third click pending), Ctrl+Z pops a prior **vertex** but leaves `arcOnArc` set. The next click is then treated as the arc end-click of an edge whose start vertex no longer exists at the expected index, writing `arcs[startIndex]` against a shifted index → arc attached to the wrong edge.
**Fix:** Clear `arcOnArc: null` in `popLastPoint` so a mid-arc undo cancels the in-flight arc capture cleanly.

### WR-06: `redoPoints` (mid-draw redo stack) is not invalidated when an arc edge is committed

**File:** `src/renderer/src/hooks/useMarkupTool.ts:362-380`
**Issue:** `recordClick` clears `redoPoints: []` on every new straight vertex (`:298`) and the arc start-vertex branch clears it (`:336`), but the arc **end-click** branch that appends the end vertex (`:370-380`) does not. If the user popped points (building `redoPoints`), then drew an arc edge, a later Ctrl+Y (`repushLastPoint`) re-pushes a pre-arc point, desyncing the point/arc index alignment.
**Fix:** Add `redoPoints: []` to the arc end-click return object at `useMarkupTool.ts:370-380`.

### WR-07: Perimeter length and area rely on a dual point-array convention for the closing-edge arc with no regression test

**File:** `src/renderer/src/lib/boq-aggregator.ts:150-159`
**Issue:** Perimeter LENGTH uses `closingPts = [...pts, pts[0]]` (n+1 points) with `m.arcs`; perimeter AREA uses `pts` (n points) with `m.arcs`. Both are correct only because the closing-edge arc keys on index `n-1` in *both* conventions — which it does today. The dual convention is fragile and untested: any future change to either array shape silently desyncs the closing arc between the reported length and area.
**Fix:** Add a regression test for a perimeter with an arc on the closing edge (length and area both reflect the arc, vs a hand-computed oracle). Consider a single shared `closingEdgeArcIndex` helper to make the convention explicit.

## Info

### IN-01: `lastClickTimeRef` is dead state

**File:** `src/renderer/src/hooks/useMarkupTool.ts:147`, `:272`, `:304`, `:382`
**Issue:** Comment admits it is "unused in logic." Written on every click, never read — implies a debounce that does not exist.
**Fix:** Remove `lastClickTimeRef` and its writes, or implement the intended debounce.

### IN-02: `polylineMidpointByArcLength` walks straight chords for a curved polyline, so the label floats off the true arc midpoint

**File:** `src/renderer/src/lib/markup-math.ts:124-143`
**Issue:** Uses `polylineLength(points)` (no arcs) and straight `euclideanDistance` per segment, so for an arc edge the returned midpoint is the chord midpoint, not the arc midpoint. The label chip drifts from the drawn curve on a strongly curved linear/wall edge. Cosmetic (measurement unaffected) but inconsistent with the arc-aware rendering in the same components.
**Fix:** Make the midpoint walk arc-aware (accept `arcs`, use `arcLength` per segment), or document the chord-based placement as intentional.

### IN-03: Duplicated `PROBLEM_RED` constant across two modules

**File:** `src/renderer/src/components/BlockedCommitMessage.tsx:6` and `src/renderer/src/components/CanvasViewport.tsx:76`
**Issue:** `#dc2626` defined twice with near-identical justifying comments — drift risk if the palette's problem color changes.
**Fix:** Export it once (shared constants/markup-color module) and import in both.

### IN-04: `ArcMap` shape redeclared three+ times instead of shared

**File:** `src/renderer/src/types/markup.ts:35`, `src/renderer/src/lib/markup-math.ts:9`, `src/renderer/src/lib/arc-math.ts:232`
**Issue:** `Record<number, { midX: number; midY: number }>` is hand-redeclared as `ArcMap`/`ArcMidMap` in multiple files (and inline in the `move-vertex`/`reshape-arc` command members), rather than importing the exported `ArcMap` from `types/markup.ts`. A future field addition would require touching every copy.
**Fix:** Import and reuse the exported `ArcMap` everywhere the same shape is needed.

---

_Reviewed: 2026-06-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
