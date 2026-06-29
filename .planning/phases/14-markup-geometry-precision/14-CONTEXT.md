# Phase 14: Markup Geometry Precision - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Estimators can place and trace markups precisely, and measure curved geometry correctly. Two capabilities, both validated by spikes:

1. **Snapping (MM-06):** During placement *and* editing, the cursor snaps to existing endpoints/vertices and to the nearest point on existing segments, within a tolerance that stays constant in screen pixels at every zoom level, driven by a spatial index (not a linear scan). A visible per-type indicator shows the active snap target.
2. **Curved-edge measurement (MM-05):** Any linear / perimeter / area / wall edge can be a true circular arc (3-point gesture), drawn and edited, whose real arc length and circular-segment-corrected area are measured exactly. Arc geometry round-trips through save/reload and BOQ export.

**In scope:** arc drawing + arc editing (endpoint re-solve, bulge-handle reshape), snapping during placement and editing, self-intersection guard on commit, manual-ready documentation of every new tool/gesture/shortcut/indicator.

**Out of scope (this phase):** intersection snapping, grid snapping, post-hoc straight↔arc edge conversion (right-click a committed edge), the end-user How-To-Manual itself. No new v1 requirements — this is quality-of-life (backlog MM-05 / MM-06).
</domain>

<decisions>
## Implementation Decisions

### Arc drawing gesture
- **D-01:** Curved (arc) edges are drawn with a **3-click gesture** — start / on-arc point / end. Chosen by feel via the interactive spike-003c demo. It maps 1:1 to the validated 3-point circular-arc solver and is the only gesture that can reach a **major arc (>180°)**.
- **D-02:** Within a single markup, switching an edge between straight and arc uses **both**: a **momentary hold-key** (e.g. `A`) for a one-off arc edge, **and** a **sticky toggle** for a run of arc edges. Default edge is **straight**. (Exact key confirmed at plan time against Phase 9 bindings.)

### Snap activation & indicator
- **D-03:** Snapping is **ON by default**, with **both** override mechanisms: a **momentary hold-key** (e.g. `Alt`) to suspend snapping for a single point, **and** a **persistent toggle** (e.g. `F3`) to turn it off for a stretch of work. (Exact keys confirmed at plan time against Phase 9 bindings — flagged as the one open detail.)
- **D-04:** Snap indicator uses **per-type CAD-style glyphs**: **□ square = vertex/endpoint**, **△ triangle = nearest-point-on-segment**. The **✕ glyph is reserved for intersection** snap (deferred). Shape conveys snap type so the estimator can trust *what* they snapped to.

### Snap targets & rules
- **D-05:** **SHIP** these targets this phase: vertex/endpoint snap, nearest-point-on-segment snap, and **close-the-loop** snap (the in-progress markup's own start vertex).
- **D-06:** **DEFER**: intersection snap (spike 002 flagged O(k²) cost — needs separate validation; ✕ glyph reserved now) and grid snap (out of scope unless explicitly requested).
- **D-07:** **Snap-target rule:** snap to *other* markups' geometry freely; for the **in-progress or actively-edited** markup, snap **only to its own start vertex** (close-the-loop) — never to its own intermediate vertices and never to the vertex currently being dragged. This rule applies in **both** placement and editing (Phase 12 vertex/body drags).

### Arc + vertex editing
- **D-08:** Arc and vertex **editing is IN scope** this phase. Dragging an **arc endpoint vertex re-solves** the arc through the new endpoint; dragging the **on-arc bulge handle reshapes** the arc (the bulge handle *is* the edit gesture for curvature). Snapping (D-03–D-07), the sagitta cap, and the self-intersection guard (D-10) all apply during editing. All edits are **undoable** (Phase 10/13 step-level + command-pattern undo) and round-trip through save/reload and BOQ export.

### Self-intersection handling
- **D-09:** Committing an area / perimeter markup whose boundary **self-intersects** is **blocked + the markup stays in edit mode** with a clear message — never commit a shape that would report a wrong quantity. This satisfies ROADMAP success criterion #5 ("detected and warned, rather than reporting a wrong quantity") by guaranteeing no bogus area/perimeter reaches the BOQ. The arc **sagitta cap** prevents most self-intersections from arising, so this should rarely fire. (Warn-but-allow was explicitly rejected — it risks a wrong quantity slipping into the BOQ.)

### Claude's Discretion
- Exact keybindings for arc-edge hold-key (D-02), snap-suspend hold-key and snap-toggle (D-03) — pick concrete keys at plan time, reconciled against the Phase 9 ribbon/shortcut bindings; avoid collisions.
- Spatial-index data structure and tolerance/cell sizing follow the validated spike-002 design (uniform grid-hash, cell = zoom-compensated tolerance).
- Visual sizing of glyphs/handles follows the established zoom-compensated overlay pattern (divide stroke widths/radii by `currentZoom`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Snapping (MM-06)
- `.planning/spikes/002-snapping-engine/README.md` — uniform grid-hash spatial index design + perf numbers (vertex snap 2–15µs at N=1k–50k; cell = zoom-compensated tolerance; segments indexed by tolerance-padded bbox; intersection-snap deferred with rationale).

### Curved-edge measurement (MM-05)
- `.planning/spikes/003-arc-segment-measure/README.md` — 3-point circular-arc solver + true arc-length math (accurate ~1e-10 vs numerical oracle; straight chord under-measures a 90° bend ~10%; per-segment arc metadata carries the on-arc midpoint).
- `.planning/spikes/003b-curved-polygon-area/README.md` — curved AREA = shoelace ± circular-segment; **sign rule: OUTWARD ⟺ sign(cross) ≠ sign(shoelace)**; self-intersecting shapes must be guarded.

### Arc input gesture
- `.planning/spikes/003c-arc-input-gesture/README.md` — why the 3-click gesture won (interactive 3-click / drag-to-bulge / mixed-wall demo, reuses spike-003 math verbatim).
- `.planning/spikes/003c-arc-input-gesture/demo.html` — the runnable demo itself.

### Phase entry & success criteria
- `.planning/ROADMAP.md` — Phase 14 entry: goal + 5 success criteria (the acceptance bar for verification).

### Documentation constraint
- Memory `project-howto-manual` — every new tool/gesture/shortcut/indicator must be documented manual-ready as it is built (shortcuts table + usage notes + indicator legend). The manual itself is a separate future phase.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/src/types/markup.ts` — the `Markup` discriminated union. Arc metadata (per-segment on-arc midpoint / curvature) must extend this; `formatVersion` already exists in `.clmc` files for schema migration.
- `src/renderer/src/lib/markup-math.ts` — `polylineLength` / `polygonArea` live here; these become **arc-aware** (true arc length + circular-segment area correction with the spike-003b sign rule).
- Phase 10/13 command-pattern + step-level undo — arc/vertex edits (D-08) must dispatch through the existing undo machinery, not bypass it.
- Zoom-compensated overlay pattern (divide stroke widths/radii by `currentZoom`) — reuse for snap glyphs and the bulge handle so they stay constant-size on screen.

### Established Patterns
- **Coordinate space:** all markup coords are stored in normalized PDF page space (0.0–1.0). Snapping math + arc solving must operate in a consistent space and use the canonical stage inverse-transform (`stage.getAbsoluteTransform().copy().invert().point(pointer)`) — never raw pointer coords.
- **Layer split:** Layer 1a (non-listening) / 1b (listening) / Layer 2 (transient) / VertexHandleOverlay layer (Phase 12) — snap glyphs and the bulge handle are transient UI and belong on a transient/overlay layer.
- **Phase 12 editing machinery:** vertex-drag and body-drag previews, the `4 / currentZoom` page-space click-vs-drag threshold, and `commitVertexEdit` being cleanup-only (per-vertex dispatch happens in `handleStageMouseUp`).

### Integration Points
- `src/renderer/src/components/CanvasViewport.tsx` — `handleStageMouseMove` (~line 1125) is the **snapping integration point** during placement/editing; the Phase 12 vertex/body-drag handlers are where edit-time snapping + arc re-solve hook in; `handleStageMouseUp` is where commit-time self-intersection guard (D-09) fires.
</code_context>

<specifics>
## Specific Ideas

- The arc gesture decision was made experientially: the user ran the spike-003c demo (3-click vs drag-to-bulge vs mixed-wall tabs) and chose 3-click after feeling all three.
- Drag-to-bulge is **not** discarded — it is repurposed as the **edit** gesture (the on-arc bulge handle, D-08), not the draw gesture.
- Self-intersection guard intent: protect the BOQ from a wrong number, not to be pedantic — the sagitta cap should keep it from firing in normal use.
</specifics>

<deferred>
## Deferred Ideas

- **Post-hoc straight↔arc edge conversion** — right-click a committed edge → "Make arc" / "Make straight". Deferred this phase: requires new edge hit-testing + an edge context menu that no success criterion needs, and arcs are already reachable via draw (3-click) and edit (bulge handle). Clean follow-up if estimators request it.
- **Intersection snap** — costliest target (spike 002: O(k²)); needs separate validation. ✕ glyph reserved now so the indicator legend is stable when it lands.
- **Grid snap** — out of scope unless explicitly requested.
- **End-user How-To-Manual** — its own future phase spanning all features. Phase 14 still emits manual-ready docs for its new tools/shortcuts/indicators (cross-cutting constraint above), but assembling the manual is separate.
</deferred>

---

*Phase: 14-markup-geometry-precision*
*Context gathered: 2026-06-29*
