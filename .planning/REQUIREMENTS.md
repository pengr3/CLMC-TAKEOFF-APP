# Requirements: CLMC Takeoff App

**Defined:** 2026-03-25
**Core Value:** Speed up quantity takeoff — let the estimator focus on reading the plan, not doing math.

## v1 Requirements

### PDF Viewer

- [x] **PDF-01**: User can load a PDF floor plan file into the app via a file picker
- [x] **PDF-02**: User can navigate between pages of a multi-page PDF
- [x] **PDF-03**: User can zoom in and out while all markups remain pinned to their exact positions on the plan
- [x] **PDF-04**: User can pan across the plan at any zoom level
- [ ] **PDF-05**: User can navigate pages via a thumbnail strip sidebar
- [x] **PDF-06**: User can see the current page number/label displayed in the viewer

### Scale Calibration

- [x] **SCAL-01**: User can set scale by drawing a line between two known points on the plan and entering the real-world distance
- [x] **SCAL-02**: Scale is stored per page — each page can have a different scale ratio
- [x] **SCAL-03**: User can see the current page's scale ratio displayed in the UI
- [x] **SCAL-04**: User can verify scale accuracy by measuring a second known dimension and comparing against its expected value

### Markup Tools

- [x] **MARK-01**: User can place count markups (pins/dots) on the plan to tally individual items (fixtures, columns, outlets, etc.)
- [x] **MARK-02**: User can draw linear markups (polylines) to measure lengths in real-world units (walls, pipes, conduit runs, etc.)
- [x] **MARK-03**: User can trace area markups (closed polygons) to measure surface area in real-world units (floors, ceilings, tiling, etc.)
- [x] **MARK-04**: User can trace perimeter markups (closed polygons) that return both the perimeter length and the enclosed area in real-world units

### Markup Detail

- [x] **MARK-05**: User can assign a freehand item name to each markup when placing it
- [x] **MARK-06**: User can assign each markup to a named category (e.g., Electrical, Plumbing, Civil)
- [x] **MARK-07**: The item name/label is displayed on the plan next to its markup at all zoom levels
- [x] **MARK-08**: Each category is rendered in a distinct color on the plan so markups can be visually distinguished

### Markup Editing

- [x] **MARK-09**: User can undo the last 20+ actions (place markup, delete markup, rename markup)
- [x] **MARK-10**: User can redo actions that were undone

### Project Persistence

- [ ] **PERS-01**: User can save the current project (PDF file reference + all markup positions + per-page scale) to a .clmc project file
- [ ] **PERS-02**: User can reopen a .clmc project file and continue marking up where they left off

### Export

- [ ] **EXPRT-01**: User can export the takeoff sheet to Excel (.xlsx) with columns: item name, quantity, unit of measure — rows grouped by category
- [ ] **EXPRT-02**: User can export the takeoff sheet to CSV with the same structure as the Excel export

### Live View

- [ ] **VIEW-01**: User can see a running totals panel that shows live quantities for all markups, grouped by category, updating as they work

---

## v2 Requirements

### Productivity

- **PROD-01**: User can use keyboard shortcuts to switch between markup tools
- **PROD-02**: User can toggle visibility of markup categories on/off (show/hide layers)
- **PROD-03**: User can delete or rename a markup after placing it by clicking it on the plan

### Export

- **EXPRT-03**: User can define a custom Excel template and export BOQ into their existing format

### Item Library

- **LIB-01**: User can save frequently used item names to a reusable library and pick from it when placing markups

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user collaboration / sharing | Single-user tool for v1; adds server infrastructure and conflict resolution complexity |
| Cloud sync / web access | Desktop-only; no internet dependency required for core workflow |
| Unit cost / pricing calculations | BOQ quantity output only; pricing happens in client's separate tools |
| AI auto-detection of items | High complexity, requires computer vision model, unvalidated need |
| Snap to PDF vector geometry | Only works on CAD-generated PDFs (not scanned); adds rendering library complexity |
| Mobile app | Construction site use not in scope; desktop estimating workflow only |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PDF-01 | Phase 1 | Complete |
| PDF-02 | Phase 1 | Complete |
| PDF-03 | Phase 1 | Complete |
| PDF-04 | Phase 1 | Complete |
| PDF-05 | Phase 6 | Pending |
| PDF-06 | Phase 1 | Complete |
| SCAL-01 | Phase 2 | Complete |
| SCAL-02 | Phase 2 | Complete |
| SCAL-03 | Phase 2 | Complete |
| SCAL-04 | Phase 2 | Complete |
| MARK-01 | Phase 3 | Complete |
| MARK-02 | Phase 3 | Complete |
| MARK-03 | Phase 3 | Complete |
| MARK-04 | Phase 3 | Complete |
| MARK-05 | Phase 3 | Complete |
| MARK-06 | Phase 3 | Complete |
| MARK-07 | Phase 3 | Complete |
| MARK-08 | Phase 3 | Complete |
| MARK-09 | Phase 3 | Complete |
| MARK-10 | Phase 3 | Complete |
| PERS-01 | Phase 4 | Pending |
| PERS-02 | Phase 4 | Pending |
| EXPRT-01 | Phase 5 | Pending |
| EXPRT-02 | Phase 5 | Pending |
| VIEW-01 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation — PDF-05 reassigned from Phase 1 to Phase 6 (thumbnail strip is a polish feature; basic prev/next navigation via PDF-02 satisfies Phase 1)*
