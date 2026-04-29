# Roadmap: CLMC Takeoff App

**Created:** 2026-03-25
**Granularity:** Standard
**Coverage:** 25/25 v1 requirements mapped

---

## Phases

- [x] **Phase 1: PDF Viewer and Canvas Foundation** - Working multi-page PDF viewer with zoom, pan, and a stable Konva canvas overlay that holds markup coordinates in PDF page space (completed 2026-03-28)
- [x] **Phase 2: Scale Calibration** - Per-page scale calibration by drawn line, measurement unit system, and scale display — the math layer that all markup measurements depend on (completed 2026-04-20)
- [x] **Phase 3: Markup Tools and Editing** - All four markup types (count, linear, area, perimeter) with freehand naming, category assignment, color-coding, labels, and full undo/redo (completed 2026-04-21 via Phase 03.1 gap-closure)
- [ ] **Phase 4: Project Persistence** - Save and load .clmc project files so work survives across sessions
- [ ] **Phase 5: BOQ Export** - Export takeoff sheet to Excel and CSV, grouped by category
- [ ] **Phase 6: Live View and UI Polish** - Running totals panel, thumbnail strip navigation, and page/scale status indicators that complete the day-to-day estimating workflow

---

## Phase Details

### Phase 1: PDF Viewer and Canvas Foundation
**Goal**: Estimators can open a construction PDF, flip between pages, zoom and pan to inspect detail, and see an invisible-but-stable canvas overlay that keeps any future markup precisely anchored to the plan geometry
**Depends on**: Nothing (first phase)
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-06
**Success Criteria** (what must be TRUE):
  1. User can open any multi-page construction PDF via a file picker and see it rendered at readable quality
  2. User can navigate forward and backward through pages without losing the current zoom state
  3. User can zoom in to 8x or more and pan freely — a test point placed on a plan feature stays on that exact feature regardless of zoom or pan applied afterward
  4. User can zoom out to fit-the-window and the full page is visible without distortion
  5. The app works on a 150% Windows display-scaled monitor without blurry rendering or offset pointer events
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — Scaffold electron-vite project, Electron shell with IPC, UI chrome, Zustand store, Vitest
- [x] 01-02-PLAN.md — PDF.js rendering, Konva canvas viewport, page navigation
- [x] 01-03-PLAN.md — Zoom-to-cursor, pan, keyboard shortcuts, status bar wiring, visual verification
- [x] 01-04-PLAN.md — Gap closure: snappy page switching with canvas cache and pre-rendering
**UI hint**: yes

### Phase 2: Scale Calibration
**Goal**: Estimators can tell the app what scale each page is drawn at by drawing a line over a known dimension, and the app converts all future pixel distances to real-world measurements correctly
**Depends on**: Phase 1
**Requirements**: SCAL-01, SCAL-02, SCAL-03, SCAL-04
**Success Criteria** (what must be TRUE):
  1. User can draw a calibration line between two points on a page, type a real-world distance, and the computed scale ratio is displayed for confirmation before it is accepted
  2. Each page stores its own independent scale — calibrating page 2 does not change page 1
  3. User can see the current page's active scale ratio displayed in the UI at all times
  4. User can measure a second known dimension on the same page and compare its reported value against the expected real-world measurement to verify calibration accuracy
  5. Pages that have not been calibrated show a visible "not calibrated" warning so the estimator cannot accidentally measure without a scale set
**Plans**: 3 plans
Plans:
- [x] 02-01-PLAN.md — Scale math library (TDD), types, per-page scale state in Zustand store
- [x] 02-02-PLAN.md — Calibration UI: canvas interaction, dialog, toolbar buttons, StatusBar display, visual verification
- [x] 02-03-PLAN.md — Scale UX polish: StatusBar 1:N ratio format, confirmation toast, Set Scale context menu (re-calibrate/clear), ScalePopup

### Phase 3: Markup Tools and Editing
**Goal**: Estimators can place all four types of quantity markups on the plan, name them, assign them to a trade category, see them labeled and color-coded on the plan, and undo any mistakes
**Depends on**: Phase 2
**Requirements**: MARK-01, MARK-02, MARK-03, MARK-04, MARK-05, MARK-06, MARK-07, MARK-08, MARK-09, MARK-10
**Success Criteria** (what must be TRUE):
  1. User can place a count pin on the plan, type an item name, assign a category, and the pin appears labeled on the plan — tapping the same tool repeatedly increments the count for that named item
  2. User can draw a multi-segment polyline and see the cumulative length reported in real-world units immediately after the last segment is placed
  3. User can trace a closed polygon for an area markup and see both the enclosed area and the perimeter length reported, each in appropriate real-world units
  4. Every markup category is rendered in a distinct color, and a markup's label remains readable and positioned correctly at every zoom level from fit-to-window to maximum zoom
  5. User can undo the last 20+ markup actions (place, delete, rename) one step at a time, and redo them in sequence, with no markup data lost or corrupted after round-tripping through undo and redo
**Plans**: 5 plans
Plans:
- [x] 03-01-PLAN.md — TDD foundation: markup types, math library (polyline length, polygon area/centroid, unit conversion), markupStore with command-pattern undo/redo
- [x] 03-02-PLAN.md — DOM chrome: extend ActiveTool union, add 4 markup Toolbar buttons, build MarkupNamePopup + CategoryAutocomplete
- [x] 03-03-PLAN.md — Count + Linear tools: useMarkupTool hook, CountPinMarkup/LinearMarkup renderers, CanvasViewport wiring
- [x] 03-04-PLAN.md — Area + Perimeter tools: polygon close detection, AreaMarkup/PerimeterMarkup renderers with category-colored fills
- [x] 03-05-PLAN.md — Keyboard shortcuts (Ctrl+Z / Ctrl+Y) with text-input guard + end-to-end human-verify checkpoint (checkpoint ultimately closed via Phase 03.1)
**UI hint**: yes

### Phase 03.1: Markup Gap Closure and Visual Redesign (INSERTED)

**Goal**: Close 4 bugs surfaced in Plan 03-05 human verification (B1 spacebar guard in text inputs, B2 linear arc-length midpoint, B3 label legibility, B4 stale-zoom subscription) AND ship the D-21..D-35 visual redesign (count-pin circle-with-number-inside, per-name-group color model with 10-swatch palette picker, hover tooltip for names, right-click recolor context menu). Supersedes MARK-08 (per-category-color → per-name-group-color) and revises UI-SPEC D-04/D-13 (count pin label format).
**Requirements**: MARK-08 (revised), B1, B2, B3, B4, D-21 through D-35
**Depends on**: Phase 3
**Plans**: 6 plans

Plans:
- [x] 03.1-01-PLAN.md — Color model refactor: add Markup.color field, MARKUP_PALETTE module, recolorGroup undoable command (Wave 1, autonomous)
- [x] 03.1-02-PLAN.md — Visual redesign of all four markup components: circle+number pin (world-anchored, auto-contrast ink), arc-length midpoint for linear, measurement-only labels (Wave 2, autonomous)
- [x] 03.1-03-PLAN.md — MarkupNamePopup color picker row + D-25 inheritance + CategoryAutocomplete color-role removal (Wave 2, autonomous)
- [x] 03.1-04-PLAN.md — Stale-zoom subscription fix (B4) + spacebar text-input guard (B1) (Wave 1, autonomous)
- [x] 03.1-05-PLAN.md — MarkupContextMenu (right-click recolor + delete) + MarkupTooltip (hover name) (Wave 3, autonomous)
- [x] 03.1-06-PLAN.md — Human-verify checkpoint + Phase 3 / 3.1 closure + REQUIREMENTS.md MARK-08 annotation (Wave 4, autonomous:false)

### Phase 4: Project Persistence
**Goal**: Estimators can save their work to a .clmc file and reopen it later to continue exactly where they left off, with all markups and scale calibrations intact
**Depends on**: Phase 3
**Requirements**: PERS-01, PERS-02
**Success Criteria** (what must be TRUE):
  1. User can save the current project to a .clmc file; the saved file contains the PDF file reference, all markup positions and names, per-page scale calibrations, and a format version field
  2. User can reopen a saved .clmc file and every markup appears on the correct position on the correct page, indistinguishable from the state at save time
  3. If the original PDF file has been moved or renamed, the app shows a clear "PDF not found" message with a Browse button to re-link it — rather than crashing or silently showing a blank canvas
**Plans:** 6/8 plans executed (gap-closure 04-07 added 2026-04-29 after 04-06 checkpoint surfaced F/G/H modal silent-failure)
Plans:
- [x] 04-00-PLAN.md — Wave 0 test scaffolds (7 red test files + fixture PDF)
- [x] 04-01-PLAN.md — Schema, serialize, project-io (SHA256 + path math), IPC triad
- [x] 04-02-PLAN.md — projectStore + hydrate/reset methods + subscribeWithSelector dirty-tracking
- [x] 04-03-PLAN.md — useProject hook, usePdfDocument refactor, 4 recovery modals
- [x] 04-04-PLAN.md — Toolbar Open/Save/SaveAs, TitleBar dirty asterisk, Ctrl+S/Shift+S, App modal router
- [x] 04-05-PLAN.md — Close-window guard (main+renderer) + SaveCloseModal (D-16/D-21)
- [x] 04-06-PLAN.md — Human-verify checkpoint — gaps captured (F/G/H modals did not appear)
- [ ] 04-07-PLAN.md — Gap closure: surface silent error, ENOENT-as-missing-pdf guard, diagnostic logging, contract test (closes F/G/H)

### Phase 5: BOQ Export
**Goal**: Estimators can export the complete quantity takeoff to an Excel or CSV file that is ready to paste into a bid sheet, with items grouped by trade category
**Depends on**: Phase 4
**Requirements**: EXPRT-01, EXPRT-02
**Success Criteria** (what must be TRUE):
  1. User can export to .xlsx and the resulting file opens in Excel with columns for item name, quantity (as a number, not text), and unit of measure — rows grouped under category headings
  2. User can export to .csv with the same column structure and category grouping as the Excel export
  3. Exported quantities are numeric values (not strings) so formulas and SUM() work immediately in Excel without data cleanup
**Plans**: TBD

### Phase 6: Live View and UI Polish
**Goal**: Estimators can see their running totals update live as they work and navigate large plan sets efficiently, completing the full day-to-day workflow without needing to export just to check quantities
**Depends on**: Phase 3
**Requirements**: VIEW-01, PDF-05
**Success Criteria** (what must be TRUE):
  1. User can see a live totals panel that shows current quantities for every named item, grouped by category, updating immediately when a markup is placed or removed — without leaving the markup canvas
  2. User can navigate between pages by clicking a thumbnail in a sidebar strip rather than using next/previous buttons only
  3. The totals panel remains visible and usable alongside the markup canvas without obstructing the plan view on a standard 1080p monitor
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PDF Viewer and Canvas Foundation | 4/4 | Complete | 2026-03-28 |
| 2. Scale Calibration | 3/3 | Complete   | 2026-04-20 |
| 3. Markup Tools and Editing | 5/5 | Complete | 2026-04-21 |
| 3.1. Markup Gap Closure and Visual Redesign | 6/6 | Complete | 2026-04-21 |
| 4. Project Persistence | 6/7 | In Progress|  |
| 5. BOQ Export | 0/0 | Not started | - |
| 6. Live View and UI Polish | 0/0 | Not started | - |

---

## Coverage

| Requirement | Phase |
|-------------|-------|
| PDF-01 | Phase 1 |
| PDF-02 | Phase 1 |
| PDF-03 | Phase 1 |
| PDF-04 | Phase 1 |
| PDF-05 | Phase 6 |
| PDF-06 | Phase 1 |
| SCAL-01 | Phase 2 |
| SCAL-02 | Phase 2 |
| SCAL-03 | Phase 2 |
| SCAL-04 | Phase 2 |
| MARK-01 | Phase 3 |
| MARK-02 | Phase 3 |
| MARK-03 | Phase 3 |
| MARK-04 | Phase 3 |
| MARK-05 | Phase 3 |
| MARK-06 | Phase 3 |
| MARK-07 | Phase 3 |
| MARK-08 | Phase 3 (revised by 03.1) |
| MARK-09 | Phase 3 |
| MARK-10 | Phase 3 |
| PERS-01 | Phase 4 |
| PERS-02 | Phase 4 |
| EXPRT-01 | Phase 5 |
| EXPRT-02 | Phase 5 |
| VIEW-01 | Phase 6 |

**Total v1 requirements:** 25
**Mapped:** 25
**Unmapped:** 0

---
*Created: 2026-03-25*
*Updated: 2026-04-21 — Phase 03.1 plans finalized (6 plans across 4 waves)*
