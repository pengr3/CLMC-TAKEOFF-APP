# Roadmap: CLMC Takeoff App

**Created:** 2026-03-25
**Granularity:** Standard
**Coverage:** 25/25 v1 requirements mapped

---

## Phases

- [x] **Phase 1: PDF Viewer and Canvas Foundation** - Working multi-page PDF viewer with zoom, pan, and a stable Konva canvas overlay that holds markup coordinates in PDF page space (completed 2026-03-28)
- [x] **Phase 2: Scale Calibration** - Per-page scale calibration by drawn line, measurement unit system, and scale display â€” the math layer that all markup measurements depend on (completed 2026-04-20)
- [x] **Phase 3: Markup Tools and Editing** - All four markup types (count, linear, area, perimeter) with freehand naming, category assignment, color-coding, labels, and full undo/redo (completed 2026-04-21 via Phase 03.1 gap-closure)
- [x] **Phase 4: Project Persistence** - Save and load .clmc project files so work survives across sessions (completed 2026-04-29)
- [x] **Phase 4.1: ZIP-Embedded .clmc Format** - Upgrade .clmc to a self-contained ZIP archive that embeds the PDF, eliminating path-dependency and enabling true portability (completed 2026-05-02)
- [x] **Phase 5: BOQ Export** - Export takeoff sheet to Excel and CSV, grouped by category (completed 2026-05-03)
- [x] **Phase 6: Live View and UI Polish** - Running totals panel, thumbnail strip navigation, and page/scale status indicators that complete the day-to-day estimating workflow (completed 2026-05-12)
- [x] **Phase 6.1: Remove Left Thumbnail Strip Panel** (INSERTED) - Remove the left sidebar thumbnail strip; page navigation arrows are sufficient and the panel wastes horizontal canvas space
 (completed 2026-05-12)
- [ ] **Phase 7: Canvas Workspace UX and Markup Editing Fixes** - Fix five live-use delinquencies: full-screen canvas workspace, post-commit markup editing, totals panel quantity list redesign, Set Scale modal dropdown overflow, and smart category deduplication

---

## Phase Details

### Phase 1: PDF Viewer and Canvas Foundation
**Goal**: Estimators can open a construction PDF, flip between pages, zoom and pan to inspect detail, and see an invisible-but-stable canvas overlay that keeps any future markup precisely anchored to the plan geometry
**Depends on**: Nothing (first phase)
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-06
**Success Criteria** (what must be TRUE):
  1. User can open any multi-page construction PDF via a file picker and see it rendered at readable quality
  2. User can navigate forward and backward through pages without losing the current zoom state
  3. User can zoom in to 8x or more and pan freely â€” a test point placed on a plan feature stays on that exact feature regardless of zoom or pan applied afterward
  4. User can zoom out to fit-the-window and the full page is visible without distortion
  5. The app works on a 150% Windows display-scaled monitor without blurry rendering or offset pointer events
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md â€” Scaffold electron-vite project, Electron shell with IPC, UI chrome, Zustand store, Vitest
- [x] 01-02-PLAN.md â€” PDF.js rendering, Konva canvas viewport, page navigation
- [x] 01-03-PLAN.md â€” Zoom-to-cursor, pan, keyboard shortcuts, status bar wiring, visual verification
- [x] 01-04-PLAN.md â€” Gap closure: snappy page switching with canvas cache and pre-rendering
**UI hint**: yes

### Phase 2: Scale Calibration
**Goal**: Estimators can tell the app what scale each page is drawn at by drawing a line over a known dimension, and the app converts all future pixel distances to real-world measurements correctly
**Depends on**: Phase 1
**Requirements**: SCAL-01, SCAL-02, SCAL-03, SCAL-04
**Success Criteria** (what must be TRUE):
  1. User can draw a calibration line between two points on a page, type a real-world distance, and the computed scale ratio is displayed for confirmation before it is accepted
  2. Each page stores its own independent scale â€” calibrating page 2 does not change page 1
  3. User can see the current page's active scale ratio displayed in the UI at all times
  4. User can measure a second known dimension on the same page and compare its reported value against the expected real-world measurement to verify calibration accuracy
  5. Pages that have not been calibrated show a visible "not calibrated" warning so the estimator cannot accidentally measure without a scale set
**Plans**: 3 plans
Plans:
- [x] 02-01-PLAN.md â€” Scale math library (TDD), types, per-page scale state in Zustand store
- [x] 02-02-PLAN.md â€” Calibration UI: canvas interaction, dialog, toolbar buttons, StatusBar display, visual verification
- [x] 02-03-PLAN.md â€” Scale UX polish: StatusBar 1:N ratio format, confirmation toast, Set Scale context menu (re-calibrate/clear), ScalePopup

### Phase 3: Markup Tools and Editing
**Goal**: Estimators can place all four types of quantity markups on the plan, name them, assign them to a trade category, see them labeled and color-coded on the plan, and undo any mistakes
**Depends on**: Phase 2
**Requirements**: MARK-01, MARK-02, MARK-03, MARK-04, MARK-05, MARK-06, MARK-07, MARK-08, MARK-09, MARK-10
**Success Criteria** (what must be TRUE):
  1. User can place a count pin on the plan, type an item name, assign a category, and the pin appears labeled on the plan â€” tapping the same tool repeatedly increments the count for that named item
  2. User can draw a multi-segment polyline and see the cumulative length reported in real-world units immediately after the last segment is placed
  3. User can trace a closed polygon for an area markup and see both the enclosed area and the perimeter length reported, each in appropriate real-world units
  4. Every markup category is rendered in a distinct color, and a markup's label remains readable and positioned correctly at every zoom level from fit-to-window to maximum zoom
  5. User can undo the last 20+ markup actions (place, delete, rename) one step at a time, and redo them in sequence, with no markup data lost or corrupted after round-tripping through undo and redo
**Plans**: 5 plans
Plans:
- [x] 03-01-PLAN.md â€” TDD foundation: markup types, math library (polyline length, polygon area/centroid, unit conversion), markupStore with command-pattern undo/redo
- [x] 03-02-PLAN.md â€” DOM chrome: extend ActiveTool union, add 4 markup Toolbar buttons, build MarkupNamePopup + CategoryAutocomplete
- [x] 03-03-PLAN.md â€” Count + Linear tools: useMarkupTool hook, CountPinMarkup/LinearMarkup renderers, CanvasViewport wiring
- [x] 03-04-PLAN.md â€” Area + Perimeter tools: polygon close detection, AreaMarkup/PerimeterMarkup renderers with category-colored fills
- [x] 03-05-PLAN.md â€” Keyboard shortcuts (Ctrl+Z / Ctrl+Y) with text-input guard + end-to-end human-verify checkpoint (checkpoint ultimately closed via Phase 03.1)
**UI hint**: yes

### Phase 03.1: Markup Gap Closure and Visual Redesign (INSERTED)

**Goal**: Close 4 bugs surfaced in Plan 03-05 human verification (B1 spacebar guard in text inputs, B2 linear arc-length midpoint, B3 label legibility, B4 stale-zoom subscription) AND ship the D-21..D-35 visual redesign (count-pin circle-with-number-inside, per-name-group color model with 10-swatch palette picker, hover tooltip for names, right-click recolor context menu). Supersedes MARK-08 (per-category-color â†’ per-name-group-color) and revises UI-SPEC D-04/D-13 (count pin label format).
**Requirements**: MARK-08 (revised), B1, B2, B3, B4, D-21 through D-35
**Depends on**: Phase 3
**Plans**: 6 plans

Plans:
- [x] 03.1-01-PLAN.md â€” Color model refactor: add Markup.color field, MARKUP_PALETTE module, recolorGroup undoable command (Wave 1, autonomous)
- [x] 03.1-02-PLAN.md â€” Visual redesign of all four markup components: circle+number pin (world-anchored, auto-contrast ink), arc-length midpoint for linear, measurement-only labels (Wave 2, autonomous)
- [x] 03.1-03-PLAN.md â€” MarkupNamePopup color picker row + D-25 inheritance + CategoryAutocomplete color-role removal (Wave 2, autonomous)
- [x] 03.1-04-PLAN.md â€” Stale-zoom subscription fix (B4) + spacebar text-input guard (B1) (Wave 1, autonomous)
- [x] 03.1-05-PLAN.md â€” MarkupContextMenu (right-click recolor + delete) + MarkupTooltip (hover name) (Wave 3, autonomous)
- [x] 03.1-06-PLAN.md â€” Human-verify checkpoint + Phase 3 / 3.1 closure + REQUIREMENTS.md MARK-08 annotation (Wave 4, autonomous:false)

### Phase 4: Project Persistence
**Goal**: Estimators can save their work to a .clmc file and reopen it later to continue exactly where they left off, with all markups and scale calibrations intact
**Depends on**: Phase 3
**Requirements**: PERS-01, PERS-02
**Success Criteria** (what must be TRUE):
  1. User can save the current project to a .clmc file; the saved file contains the PDF file reference, all markup positions and names, per-page scale calibrations, and a format version field
  2. User can reopen a saved .clmc file and every markup appears on the correct position on the correct page, indistinguishable from the state at save time
  3. If the original PDF file has been moved or renamed, the app shows a clear "PDF not found" message with a Browse button to re-link it â€” rather than crashing or silently showing a blank canvas
**Plans:** 7/8 plans executed
Plans:
- [x] 04-00-PLAN.md â€” Wave 0 test scaffolds (7 red test files + fixture PDF)
- [x] 04-01-PLAN.md â€” Schema, serialize, project-io (SHA256 + path math), IPC triad
- [x] 04-02-PLAN.md â€” projectStore + hydrate/reset methods + subscribeWithSelector dirty-tracking
- [x] 04-03-PLAN.md â€” useProject hook, usePdfDocument refactor, 4 recovery modals
- [x] 04-04-PLAN.md â€” Toolbar Open/Save/SaveAs, TitleBar dirty asterisk, Ctrl+S/Shift+S, App modal router
- [x] 04-05-PLAN.md â€” Close-window guard (main+renderer) + SaveCloseModal (D-16/D-21)
- [x] 04-06-PLAN.md â€” Human-verify checkpoint â€” gaps captured (F/G/H modals did not appear)
- [x] 04-07-PLAN.md â€” Gap closure: surface silent error, ENOENT-as-missing-pdf guard, diagnostic logging, contract test (closes F/G/H)
**Status:** Complete (all 8 plans executed, human UAT A-H passed, 2026-04-29)

### Phase 4.1: ZIP-Embedded .clmc Format (INSERTED)

**Goal**: Upgrade the `.clmc` file format from plain UTF-8 JSON (with external PDF path reference) to a ZIP archive that embeds the PDF, making each project file fully self-contained and portable across machines
**Depends on**: Phase 4
**Requirements**: PERS-01, PERS-02 (same requirements, better format)
**Success Criteria** (what must be TRUE):
  1. User can save a project to a `.clmc` v2 file that contains both the project data and the PDF â€” the file opens on any machine without any PDF path setup
  2. User can open an old v1 plain-JSON `.clmc` file; it loads correctly and the app marks it dirty, prompting the user to re-save in the v2 format
  3. User can use "Replace Plan PDF" in the Toolbar to swap the embedded PDF for a revised architect drawing, with page-count validation, while preserving all markups
  4. Save shows a "Saving..." indicator in the title bar while the ZIP is being written, and Save/SaveAs buttons are disabled during the write
**Plans**: 8 plans (7 originally + 1 gap-closure inserted from UAT Test 3)
Plans:
- [x] 04.1-00-PLAN.md â€” Wave 0 RED tests + jszip install (v1-migration-pdfbytes, atomic-write)
- [x] 04.1-01-PLAN.md â€” project-io v2 primitives + project-schema v2 + serialize + atomic write
- [x] 04.1-02-PLAN.md â€” IPC handlers + preload (readProject discriminated union, writeProject atomic, computedSha256)
- [x] 04.1-03-PLAN.md â€” projectStore.isSaving + viewerStore.pdfBytes
- [x] 04.1-04-PLAN.md â€” useProject rewrite (v2 save/open + replacePlanPdf, v1 pdfBytes population, scale warning) + ArchiveCorruptedModal
- [x] 04.1-05-PLAN.md â€” TitleBar Saving... + Toolbar Replace Plan PDF + App.tsx wiring
- [x] 04.1-06-PLAN.md â€” Manual UAT + roadmap closure
- [x] 04.1-07-PLAN.md â€” Gap closure: cloneForPdfWorker helper closes UAT Test 3 detached-buffer blocker (replacePlanPdf probe was an unprotected second caller of pdfjs-dist getDocument)

**Cross-cutting constraints:** jszip STORE compression (all IO plans); Uint8Array over IPC boundary (Plans 02, 03, 04); write-then-rename atomic save (Plans 01, 02, 06); cloneForPdfWorker discipline at every pdfjsLib.getDocument({ data }) call site (Plan 07)

### Phase 5: BOQ Export
**Goal**: Estimators can export the complete quantity takeoff to an Excel or CSV file that is ready to paste into a bid sheet, with items grouped by trade category
**Depends on**: Phase 4
**Requirements**: EXPRT-01, EXPRT-02
**Success Criteria** (what must be TRUE):
  1. User can export to .xlsx and the resulting file opens in Excel with columns for item name, quantity (as a number, not text), and unit of measure â€” rows grouped under category headings
  2. User can export to .csv with the same column structure and category grouping as the Excel export
  3. Exported quantities are numeric values (not strings) so formulas and SUM() work immediately in Excel without data cleanup
**Plans**: 7 plans
Plans:

**Wave 0 *(prerequisite â€” RED tests + types + dep install)*:**
- [x] 05-00-PLAN.md â€” Wave 0 RED tests + boq-types.ts + projectStore.isExporting + exceljs/csv-stringify install

**Wave 1 *(parallel-safe; both blocked on Wave 0 completion)*:**
- [x] 05-01-PLAN.md â€” boq-aggregator.ts (renderer pure: BoqStructure builder, findUncalibratedMarkupPages)
- [x] 05-02-PLAN.md â€” boq-writers.ts (main pure: buildBoqXlsx + buildBoqCsv) + project-io extension enforcers + safeText formula-injection guard

**Wave 2 *(blocked on 05-02)*:**
- [x] 05-03-PLAN.md â€” IPC triad: dialog:saveExport + file:writeBoqXlsx + file:writeBoqCsv (handler + preload bridge + d.ts)

**Wave 3 *(blocked on 05-01 + 05-03)*:**
- [x] 05-04-PLAN.md â€” useExport hook + UncalibratedExportWarningModal (D-06)

**Wave 4 *(blocked on 05-04)*:**
- [x] 05-05-PLAN.md â€” Toolbar Export IconButton + Ctrl+Shift+E + App.tsx wiring (handleExportClick + exportToast + uncalibratedWarning + exportError modal)

**Wave 5 *(blocked on 05-05 â€” manual UAT and doc closure)*:**
- [x] 05-06-PLAN.md â€” Manual UAT (6 scenarios â€” all PASS) + REQUIREMENTS/ROADMAP/STATE closure

**Cross-cutting constraints:** ExcelJS 4.4.0 native-number cells with `numFmt` (Plans 00, 02 â€” preserves SUM()); inline-duplicated `BoqStructure` type at renderer/main/preload boundaries (Plans 00, 01, 02, 03 â€” mirror of `ReadProjectResult`); write-then-rename atomic save via existing `atomicWriteFile` (Plan 03); discriminated-union IPC results `{ ok: true } | { ok: false, reason }` (Plan 03); `isTextInputActive()` guard on every global Ctrl+ shortcut (Plan 05); `safeText` apostrophe-prefix on cells starting with `=`, `+`, `-`, `@` to neutralize Excel-formula injection (Plan 02 â€” applies to user-supplied Item names and category names); `isExporting` race guard mirrored on `isSaving` pattern (Plans 00, 04, 05 â€” Toolbar disable + try/finally reset).

### Phase 6: Live View and UI Polish
**Goal**: Estimators can see their running totals update live as they work and navigate large plan sets efficiently, completing the full day-to-day workflow without needing to export just to check quantities
**Depends on**: Phase 3
**Requirements**: VIEW-01, PDF-05
**Success Criteria** (what must be TRUE):
  1. User can see a live totals panel that shows current quantities for every named item, grouped by category, updating immediately when a markup is placed or removed â€” without leaving the markup canvas
  2. User can navigate between pages by clicking a thumbnail in a sidebar strip rather than using next/previous buttons only
  3. The totals panel remains visible and usable alongside the markup canvas without obstructing the plan view on a standard 1080p monitor
**Plans**: 9 plans across 7 waves
Plans:

**Wave 0 *(prerequisite â€” RED test scaffolds)*:**
- [x] 06-00-PLAN.md â€” 15 Wave 0 RED test stubs (totals, thumbnails, hooks, highlights, header bar)

**Wave 1 *(parallel-safe; both blocked on Wave 0 â€” pure hooks + simple chrome)*:**
- [x] 06-01-PLAN.md â€” useBoqLive (8 primitive selectors over aggregateBoq) + usePageLabels + useUiPanels (localStorage clmc.ui with silent-reset)
- [x] 06-02-PLAN.md â€” useMarkupHighlight (parent-owned-lifecycle) + Splitter (4px hit area, commit-on-pointerup) + CanvasHeaderBar (28px, getCalibrationControls() reuse for Set Scale)

**Wave 2 *(blocked on 06-01 + 06-02 â€” Konva transient overlays)*:**
- [x] 06-03-PLAN.md â€” HoverRing + PulseHighlight (Konva Layer 2, listening=false, zoom-compensated, rAF fade 0.85â†’0 over 1500ms)

**Wave 3 *(parallel-safe with Wave 4; 06-04 blocked on Wave 1, 06-05 blocked on 06-03 + 06-04 â€” TotalsPanel render tree)*:**
- [x] 06-04-PLAN.md â€” TotalsPanel + TotalsPanelHeader + TotalsCategoryBlock + TotalsRow (color chip on item-name only, three D-09 empty states, grand-total bar)
- [x] 06-05-PLAN.md â€” TotalsRowContextMenu (defer-listener-registration, Copy as text TAB-separated payload, ConfirmationToast) + row hover/click wiring through useMarkupHighlight

**Wave 4 *(parallel-safe with Waves 2 & 3; blocked on Wave 1 â€” Thumbnail rasterization pipeline)*:**
- [x] 06-06-PLAN.md â€” useThumbnailRender (PDF.js render at 48 dpi via existing pdfDocument proxy, two-canvas composite, 200ms debounced overlay refresh) + Thumbnail (4 badges D-16, IntersectionObserver lazy mount) + ThumbnailStrip

**Wave 5 *(blocked on Waves 2 + 3 + 4 â€” App.tsx three-column shell)*:**
- [x] 06-07-PLAN.md â€” App.tsx three-column flex shell (minWidth:0 center column, toast relocation) + CanvasViewport Layer-2 mount points + useMarkupHighlight orchestration

**Wave 6 *(blocked on Wave 5 â€” manual UAT and closure)*:**
- [x] 06-08-PLAN.md â€” Manual UAT (zoom-compensated visuals, persistence across reload, fade timing, performance, 1080p layout, thumbnail sync) + REQUIREMENTS/ROADMAP/STATE closure

**Cross-cutting constraints:** ONE aggregator (`boq-aggregator.ts` reused via `useBoqLive` â€” D-04); per-name color travels canvas â†’ row chip â†’ pulse â†’ BOQ export via `getColorForName(name)` (D-06 / D-12); `listening={false}` mandatory on every Konva shape inside HoverRing + PulseHighlight (Pitfall 1); zoom-compensated stroke widths (`/ currentZoom`) on transient overlays (Phase 03.1 discipline); reuse existing `viewerStore.pdfDocument.getPage(n)` for thumbnails â€” no new `pdfjsLib.getDocument({ data })` callsite (Phase 4.1 detached-buffer landmine, Pitfall 4); inline-style + `COLORS` tokens convention (no Tailwind in chrome path); UI panel state in `localStorage clmc.ui` namespace, NEVER in `.clmc` files (D-03); `getCalibrationControls()?.activate()` reuse â€” no duplicate Set Scale trigger code (D-20); defer-listener-registration via `setTimeout(0)` in TotalsRowContextMenu; localStorage parse failure â†’ silent reset to defaults; tabular numbers via `font-variant-numeric: tabular-nums` only.

**UI hint**: yes

### Phase 06.1: Remove Left Thumbnail Strip Panel (INSERTED)

**Goal:** Remove the left sidebar thumbnail strip panel. The page navigation arrows already cover all page switching needs, and the thumbnail panel consumes horizontal space that would be better used by the markup canvas.
**Requirements**: UI-01 (quality-of-life improvement, no new v1 requirements)
**Depends on:** Phase 6
**Plans:** 1/1 plans complete

Plans:
- [x] 06.1-01-PLAN.md â€” Delete thumbnail files + edit useUiPanels/App.tsx for two-column shell


### Phase 7: Canvas Workspace UX and Markup Editing Fixes

**Goal:** Fix five live-use delinquencies discovered after v1 completion: expand the PDF canvas to fill all available window space, enable post-commit editing of any markup field, redesign the totals panel to list individual quantities without aggregating totals, fix the Set Scale modal unit dropdown overflow, and add smart category deduplication to prevent typo-based duplicate categories.
**Requirements**: UI-01, MARK-03, VIEW-01 (quality-of-life fixes, no new v1 requirements)
**Depends on:** Phase 6.1
**Plans:** 5 plans
Plans:

**Wave 0 *(prerequisite — RED stubs + assertion inversions)*:**
- [x] 07-00-PLAN.md — Wave 0 RED test stubs: EditMarkupCommand suite, MarkupNamePopup mode='edit' suite, MarkupContextMenu Edit item suite, totals assertion inversions

**Wave 1 *(parallel-safe; blocked on Wave 0)*:**
- [x] 07-01-PLAN.md — Wave 1 parallel fixes: canvas gutter (D-02), totals panel cleanup (D-08/D-09), CalibrationDialog dropdown + Discard Scale (D-11)

**Wave 2 *(blocked on Wave 1)*:**
- [ ] 07-02-PLAN.md — Wave 2 category dedup: CategoryAutocomplete keyboard nav + MarkupNamePopup mode='edit' + D-13 canonical substitution

**Wave 3 *(blocked on Wave 2)*:**
- [ ] 07-03-PLAN.md — Wave 3 post-commit editing: EditMarkupCommand types + store action + MarkupContextMenu Edit item + CanvasViewport wiring

**Wave 4 *(blocked on Wave 3 — manual UAT and closure)*:**
- [ ] 07-04-PLAN.md — Wave 4 manual UAT checkpoint and phase closure

**Cross-cutting constraints:** No new libraries or IPC channels (renderer-layer only); `COLORS.*` inline tokens only (no new hex literals, no Tailwind); `EditMarkupCommand` stores old/new category names as strings (not IDs); `getOrCreateCategory` called before `set()` updater; undo/redo explicit `'edit-markup'` branch before `cmd.markup.page` fallthrough; `e.stopPropagation()` on Enter in category input when `highlightedIndex >= 0`; subtract `containerRef.current.getBoundingClientRect()` when converting context-menu coords for popup.

**Success Criteria** (what must be TRUE):
  1. The PDF canvas area fills the full remaining horizontal and vertical space of the window — no blank gutters visible on a standard 1080p monitor at any zoom level
  2. User can click on any placed markup and edit its name, category, and/or color via an edit popup — changes persist to the project file
  3. The totals panel lists each markup item with its individual quantity — no summed total row; every placed markup quantity is visible at a glance
  4. The Set Scale modal unit dropdown fits entirely within the modal frame at all standard window sizes
  5. When typing a category name during markup placement, existing categories are shown as suggestions — selecting a suggestion prevents typo-based duplicates and the input matches existing names exactly

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PDF Viewer and Canvas Foundation | 4/4 | Complete | 2026-03-28 |
| 2. Scale Calibration | 3/3 | Complete   | 2026-04-20 |
| 3. Markup Tools and Editing | 5/5 | Complete | 2026-04-21 |
| 3.1. Markup Gap Closure and Visual Redesign | 6/6 | Complete | 2026-04-21 |
| 4. Project Persistence | 8/8 | Complete | 2026-04-29 |
| 4.1. ZIP-Embedded .clmc Format | 8/8 | Complete | 2026-05-02 |
| 5. BOQ Export | 7/7 | Complete | 2026-05-03 |
| 6. Live View and UI Polish | 9/9 | Complete | 2026-05-12 |
| 6.1. Remove Left Thumbnail Strip Panel | 1/1 | Complete   | 2026-05-12 |
| 7. Canvas Workspace UX and Markup Editing Fixes | 0/5 | In progress | — |

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
*Updated: 2026-04-21 â€” Phase 03.1 plans finalized (6 plans across 4 waves)*
*Updated: 2026-05-02 â€” Phase 4.1 closed (8 plans incl. 04.1-07 gap closure for UAT Test 3 detached-buffer blocker)*
*Updated: 2026-05-05 â€” Phase 6 plans finalized (9 plans across 7 waves)*
*Updated: 2026-05-05 â€” Phase 6 Plan 00 complete (Wave 0 RED scaffold, 15 stubs)*
*Updated: 2026-05-05 â€” Phase 6 Plan 01 complete (Wave 1 hook foundations: useBoqLive + usePageLabels + useUiPanels)*
*Updated: 2026-05-05 â€” Phase 6 Plan 02 complete (Wave 1 glue primitives: useMarkupHighlight + Splitter + CanvasHeaderBar â€” Wave 1 of Phase 6 now complete)*
*Updated: 2026-05-12 â€” Phase 6 complete (all 9 plans, UAT Aâ€“F passed, VIEW-01 + PDF-05 delivered â€” v1 milestone complete, 25/25 requirements)*

