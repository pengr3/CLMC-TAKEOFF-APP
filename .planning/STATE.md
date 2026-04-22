---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: "Completed 04-01-PLAN.md — Wave 1 logic layer: schema, serialize, project-io, IPC triad"
last_updated: "2026-04-22T02:11:42.270Z"
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 25
  completed_plans: 20
---

# Project State: CLMC Takeoff App

*Single source of truth for current project position. Updated at every phase transition and plan completion.*

---

## Project Reference

**Core Value:** Speed up quantity takeoff -- let the estimator focus on reading the plan, not doing math.

**What This Is:** Windows desktop takeoff application. Users load PDF floor plans, set scale, place count/linear/area/perimeter markups, and export a BOQ/BOM to Excel or CSV.

**Current Focus:** Phase 04 — project-persistence

---

## Current Position

Phase: 04 (project-persistence) — EXECUTING
Plan: 2 of 7

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 1 / 6 |
| Plans complete | 6 |
| Requirements delivered | 9 / 25 |
| Session count | 3 |

---
| Phase 01 P01 | 9min | 3 tasks | 19 files |
| Phase 01 P02 | 3min | 2 tasks | 8 files |
| Phase 01 P03 | 3min | 1 task | 8 files |
| Phase 02 P01 | 2min | 2 tasks | 5 files |
| Phase 02 P02 | 8min | 2 tasks (+ checkpoint) | 5 files |
| Phase 02 P02 | 8min | 2 tasks | 5 files |
| Phase 02 P02 | 8min | 3 tasks | 5 files |
| Phase 02 P03 | 7 | 3 tasks | 12 files |
| Phase 03 P01 | 7 | 3 tasks | 7 files |
| Phase 03 P02 | 3 | 2 tasks | 5 files |
| Phase 03-markup-tools-and-editing P03 | 6min | 3 tasks | 4 files |
| Phase 03 P04 | 5 | 3 tasks | 4 files |
| Phase 03.1 P01 | 6min | 3 tasks | 7 files |
| Phase 03.1 P04 | 8min | 3 tasks | 5 files |
| Phase 03.1 P02 | 6min | 3 tasks | 8 files |
| Phase 03.1 P03 | 7min | 4 tasks | 4 files |
| Phase 03.1 P05 | 10min | 4 tasks | 8 files |
| Phase 04 P00 | 2min | 2 tasks | 8 files |
| Phase 04 P01 | 4min | 4 tasks | 9 files |

## Accumulated Context

### Key Decisions Locked

| Decision | Rationale |
|----------|-----------|
| Electron 35 + React 19 + TypeScript + electron-vite | Bundled Chromium eliminates WebView fragmentation risk; hot reload during dev |
| PDF.js + Konva.js | Canonical pattern for annotation-over-PDF; official Konva sandbox confirms use case |
| Zustand 5 with persist middleware | Minimal boilerplate; serializes project state to JSON cleanly |
| ExcelJS 4.4.0 | Richer formatting API than SheetJS CE for write-only BOQ output |
| All markup coordinates stored in PDF page space (normalized 0.0-1.0) | Prevents markup drift on zoom/pan and across save/reload cycles -- rated HIGH recovery cost if done wrong |
| Per-page scale model (not per-project) | Plans in a set have different scales; per-page is mandatory for mixed-scale PDFs |
| Command pattern for undo/redo | Far cheaper than full-snapshot undo; must be introduced with first markup, not retrofitted |
| formatVersion field in .clmc files from day one | Enables future schema migrations; omitting it makes old files unreadable after any change |
| Freehand markup naming (no item library) | Simpler UX for v1; user types item names directly |
| Standard export layout (not custom template) | Avoids template management complexity for v1 |
| Module-level ref pattern for canvas controls | Simpler than React context or Zustand function refs for cross-component communication |
| Discrete zoom steps [0.25..8] with snapping | Predictable behavior matching CAD tool conventions |
| DOM event listeners for middle-mouse pan | Avoids drag conflicts with Konva's built-in drag system |
| Stage inverse transform for page-space coords | `stage.getAbsoluteTransform().copy().invert().point(pointer)` is the canonical pattern — never use raw pointer coords |
| Zoom-compensated Konva overlay visuals | Divide all stroke widths and radii by currentZoom so visual sizes appear constant at all zoom levels |
| CalibrationDialog cancel keeps activeTool='scale' | User can immediately retry the line draw without re-clicking the toolbar button |
| mm-based canonical scale storage (pixelsPerMm) | Unit-independent storage enables display unit switching without recalibrating; all scale math uses a single unit |
| ConfirmationToast is pure presentational (no setTimeout) | Parent owns dismissal lifecycle via useEffect — avoids React cleanup race conditions with timers inside components |
| formatScaleRatio single-arg returns '1:N' ratio | Estimators read drawing scales as ratios (1:100, 1:50) — integer round of mm/pixel is the natural representation |
| scaleStore separate from viewerStore | Keeps scale concerns orthogonal to viewport/PDF navigation; Phase 3 markup tools import only what they need |
| MarkupCommand stores full Markup object (not just ID) | Enables undo/redo without any store lookup — safer and simpler for the command pattern |
| nextCountSequence uses max(existing)+1 (gap-preserving) | Deleted markups leave permanent gaps, preventing duplicate sequence numbers (Pitfall 5) |
| UNDO_STACK_MAX=50 (2.5x MARK-09 minimum) | Provides comfortable margin above the 20+ round-trip requirement for dense editing sessions |
| isMarkupTool type guard in viewer.ts | Plans 03/04 can discriminate activeTool without string literal comparisons across files |
| MarkupNamePopup emits raw categoryName string | Consumer (Plans 03/04) calls getOrCreateCategory — maps empty string to 'Uncategorized' |
| CategoryAutocomplete uses onMouseDown + e.preventDefault() | Prevents input onBlur from closing the dropdown list before item selection fires |
| useMarkupTool state machine uses useState+useCallback (not useReducer) | Mirrors useCalibrationMode pattern for consistency; simpler than reducer for this use case |
| recordClick places CountMarkup via Zustand getState() inside setState updater | Avoids double-render from separate dispatch; Zustand getState() is safe outside React render |
| LinearMarkup label shows only name when pageScale is null | Graceful degradation on uncalibrated page rather than showing '0 m' stub |
| finishPolygon positions popup at polygonCentroid+20px (screen-space) | Vertex average centroid is natural anchor for polygon popup |
| Layer 2 transient polygon layer separate from Layer 1 | Enables hitStrokeWidth events on start vertex without forcing Layer 1 to have listening=true |
| isOverStartPoint lives in CanvasViewport (not useMarkupTool) | Hook is isolated from Konva Layer structure; viewport owns the interactive event layer |
| PerimeterMarkup appends points[0] to polylineLength input | Includes the closing segment in perimeter calculation — without this, last-to-first segment is missing |
| RecolorGroup command stores oldColors dict (per-markup) not single oldColor | Preserves per-pin color drift on undo — D-29 uniform recolor stays reversible to exact prior state |
| MARKUP_PALETTE uses Tailwind 600-level hues (10 swatches) | Guaranteed WCAG-AA contrast against both white and black — enables D-23 auto-contrast pin numbers with zero palette edge cases |
| getColorForName returns most-recent (not first) markup color for a name | Matches "the last color chosen is the current color" mental model without walking full history |
| Category.color retained alongside Markup.color during 03.1 transition | Plans 03.1-02/03 migrate rendering components off category.color — avoiding full cascade in plan 01 keeps data-model refactor atomic |
| Pin geometry constants lifted to module scope (PIN_RADIUS_WORLD=10, NUMBER_FONT_WORLD=12) | Pure world-anchored per D-22; module-level placement makes any future zoom-division regression a single-line visible diff |
| CONTRAST_LUMINANCE_THRESHOLD = 0.179 module-level literal in color-utils.ts | WCAG break point for white text meets 4.5:1 contrast; exact value is grep-verifiable per D-23 acceptance criteria |
| polylineMidpointByArcLength walks cumulative segment distance + interpolates inside the half-mark segment | B2 fix: LinearMarkup label lands at geometric center, not an arbitrary vertex (index-based midpoint bias) |
| category.color stripped from all 4 markup render components | D-29 cascade complete; Category.name retained for BOQ grouping only (D-27) |
| MarkupNamePopup userOverrodeColor stored as useRef (not useState) | Flag participates in useEffect inheritance logic without triggering re-renders; ref avoids the stale-closure bug useState would introduce if the effect's dependency array excluded the flag |
| Render tests kept as .test.ts with React.createElement | vitest.config.ts include glob is src/tests/**/*.test.ts — avoids modifying config mid-wave (parallel-executor safety); mirrors existing spacebar-text-guard.test.ts pattern |
| MarkupNamePopup.onConfirm payload widened { name, categoryName, color } without touching CanvasViewport callsites | TypeScript's default method-parameter bivariance allowed the narrower commitCountName to satisfy the widened onConfirm type without casts — kept diff scoped to popup + hook only |
| Layer 1 split into 1a (non-listening) + 1b (listening=true) | Calibration + in-progress linear preview stay off the hit-testing graph; only committed markups cost hover work. Matches existing Layer 2 transient-polygon isolation pattern |
| Hover tooltip debounce owned by CanvasViewport not MarkupTooltip | MarkupTooltip stays pure presentational; parent holds the 200ms window.setTimeout ref and cancels on leave/context-open. Mirrors ConfirmationToast parent-owns-lifecycle pattern |
| MarkupContextMenu currentColor wired to contextMarkup.color (not getColorForName) | The pin the user right-clicked is authoritative — avoids UI surprise if name-group has drifted colors. recolorGroup still flips the whole name-group per D-29 |
| Konva onContextMenu handlers translate event via stage.getPointerPosition() then call e.evt.preventDefault() | Screen-space pointer is correct at any zoom because getPointerPosition reads raw mouse coords (unaffected by Stage transform); preventDefault suppresses the browser's native right-click menu on the canvas |

### Critical Pitfalls to Watch

- **PDF coordinate origin**: PDF origin is bottom-left, canvas is top-left. Always use `viewport.convertToPdfPoint` -- never persist raw canvas pixel coordinates.
- **Markup drift on zoom/pan**: Maintain a single affine transform matrix; never apply scale and translate as independent steps.
- **Rotated pages**: Pages with `/Rotate: 90` swap width/height. Use PDF.js built-ins only -- never implement the transform manually.
- **HiDPI offset**: At 150% display scaling, set canvas dimensions to `cssSize * devicePixelRatio`.
- **Canvas size limit**: Chromium GPU texture cap; cap render scale or implement tiled rendering for A0/A1 at 4x zoom.
- **Scale compounding error**: Display computed scale factor for user confirmation after calibration. Warn on uncalibrated pages.

### Research Flags for Planning

- **Phase 3**: Review Konva polygon close interaction (double-click, ESC cancel), multi-segment polyline mid-point editing, and Konva Transformer widget before writing markup tools.

### Open Questions / Todos

- Verify Chromium 134 (bundled with Electron 35) canvas size limit -- may affect tiled rendering decision
- Verify ExcelJS 4.4.0 compatibility with Node 22 (bundled with Electron 35) before Phase 5

### Blockers

None.

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Markup Gap Closure and Visual Redesign (URGENT) — supersedes MARK-08 per-category-color must-have, revises UI-SPEC D-04/D-13 count pin label format, closes 4 bugs surfaced in Plan 03-05 human verification (spacebar blocked in text inputs, Linear/Area label legibility, stale currentZoom after zoom)

---

## Session Continuity

**Last session:** 2026-04-22T02:11:42.262Z

**Stopped at:** Completed 04-01-PLAN.md — Wave 1 logic layer: schema, serialize, project-io, IPC triad

**Next action:** Phase 2 complete. Run `/gsd:transition` to validate Phase 2 delivery and plan Phase 3 (markup tools).

---
*State initialized: 2026-03-25*
*Last updated: 2026-03-28 after completing Phase 01 Plan 03*
