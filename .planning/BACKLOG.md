# Backlog — Measurement & Markup Gaps

Captured 2026-06-16 from `/gsd-spike` gap analysis of core measurement/markup
functionality. Complements the broader product audit in
`.planning/spikes/GAP-001-key-takeoff-app-gaps.md` (2026-05-19), which has largely
shipped (vertex edit/translate = Phase 12, undo = Phases 10/13, pricing+library = Phase 14).

These are the **measurement/markup-specific** gaps. Items marked **(spike)** are being
validated experientially in `.planning/spikes/` because their feasibility/feel is uncertain;
everything else is known build-work awaiting planning.

---

## Tier 1 — Missing measurement types (high estimating value)

| ID | Gap | Why it matters | Complexity | Notes |
|----|-----|----------------|-----------|-------|
| MM-01 | **Deductions / cutouts** (holes in an area) | Subtracting doors, columns, voids from a floor/wall area is the signature takeoff feature. `polygonArea` handles a single ring only. | Medium | Data-model change: area markups need inner rings; shoelace per ring, subtract. Known approach. |
| MM-02 | **Volume** (area × depth) | Concrete slabs, excavation → m³. Wall tool does 2D→m² but there's no true volume. | Low | New tool reusing area + a depth input; mirrors wall-height pattern. |
| MM-03 | **Pitch / slope factor** | Roof area = plan area × pitch multiplier → true sloped area. Roofing takeoff impossible without it. | Low | Multiplier on an area markup; trivial math. |
| MM-04 | **Angle measurement / quick ruler** | Throwaway "how far / what angle" without creating a persistent markup. | Low | Non-persistent overlay; reuses existing length math. |
| MM-05 | **Curved / arc segments** *(spike 003)* | `polylineLength` is straight-segments only — curved walls/radii under-measure. | Medium | Drawing UX + arc-length integration uncertain → spike first. |

## Tier 2 — Drawing precision (accuracy + speed)

| ID | Gap | Why it matters | Complexity | Notes |
|----|-----|----------------|-----------|-------|
| MM-06 | **Snapping** (endpoint/vertex/intersection/grid) *(spike 002)* | Every point is freehand — can't precisely share corners or close polygons. Biggest accuracy gap. | Medium | Extends GAP-001 T2-05; perf at scale + tolerance feel → spike first. |
| MM-07 | **Ortho / angle lock** (Shift → 0/45/90°) | Rooms/walls are rectilinear; freehand is slow + imprecise. | Low | Constrain the in-progress point to the nearest axis/45°. |
| MM-08 | **Live readout while drawing** | Length/area shows only after commit (previews today are drag-edit only). Pros show running length at the cursor. | Low | Render running measurement label at cursor during placement. |
| MM-09 | **Per-segment length labels** | Polyline shows one total at the midpoint; no length per leg. | Low | Label each segment; toggle in View tab. |

## Tier 3 — Count productivity

| ID | Gap | Why it matters | Complexity | Notes |
|----|-----|----------------|-----------|-------|
| MM-10 | **Auto-count / symbol search** *(spike 001)* | Detect repeated symbols (outlets, fixtures) instead of clicking each — huge time-saver. | High | GAP-001 deferred to v2.0 as "feasibility unknown"; offline template-match accuracy/perf → spike first. |
| MM-11 | **Duplicate / array / cross-page copy** | Repeat a room, or copy a takeoff to similar sheets. No `duplicate` command exists. | Medium | New command in MarkupCommand union; array = grid offset. |
| MM-12 | **Markup rotation** | Vertex handles exist but no rotate. | Medium | Add rotate handle to VertexHandleOverlay. |

---

## Spike status (see `.planning/spikes/MANIFEST.md`)

- **001 auto-count-symbol-detect** → MM-10
- **002 snapping-engine** → MM-06
- **003 arc-segment-measure** → MM-05

After spikes resolve feasibility, promote validated items into a milestone via
`/gsd-review-backlog` or fold into roadmap phases.
