---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 02-01-PLAN.md (Phase 2 Wave 1 — math foundation)
last_updated: "2026-04-20T02:42:00.000Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 7
  completed_plans: 5
---

# Project State: CLMC Takeoff App

*Single source of truth for current project position. Updated at every phase transition and plan completion.*

---

## Project Reference

**Core Value:** Speed up quantity takeoff -- let the estimator focus on reading the plan, not doing math.

**What This Is:** Windows desktop takeoff application. Users load PDF floor plans, set scale, place count/linear/area/perimeter markups, and export a BOQ/BOM to Excel or CSV.

**Current Focus:** Phase 02 — scale-calibration

---

## Current Position

Phase: 02 (scale-calibration) — EXECUTING
Plan: 2 of 3 (awaiting Task 3 human-verify checkpoint)

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 1 / 6 |
| Plans complete | 3 |
| Requirements delivered | 5 / 25 |
| Session count | 3 |

---
| Phase 01 P01 | 9min | 3 tasks | 19 files |
| Phase 01 P02 | 3min | 2 tasks | 8 files |
| Phase 01 P03 | 3min | 1 task | 8 files |
| Phase 02 P01 | 2min | 2 tasks | 5 files |
| Phase 02 P02 | 8min | 2 tasks (+ checkpoint) | 5 files |

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

---

## Session Continuity

**Last session:** 2026-04-07T03:14:00.275Z

**Stopped at:** 02-02 Task 3 checkpoint — human-verify calibration workflow

**Next action:** Human visual verification of 02-02 Task 3 checkpoint, then `/gsd:execute-phase 2 plan 3`

---
*State initialized: 2026-03-25*
*Last updated: 2026-03-28 after completing Phase 01 Plan 03*
