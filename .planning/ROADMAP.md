# Roadmap: CLMC Takeoff App

**Created:** 2026-03-25
**Granularity:** Standard
**Coverage:** 25/25 v1 requirements mapped

---

## Phases

- [x] **Phase 1: PDF Viewer and Canvas Foundation** - Working multi-page PDF viewer with zoom, pan, and a stable Konva canvas overlay that holds markup coordinates in PDF page space (completed 2026-03-28)
- [x] **Phase 2: Scale Calibration** - Per-page scale calibration by drawn line, measurement unit system, and scale display â€" the math layer that all markup measurements depend on (completed 2026-04-20)
- [x] **Phase 3: Markup Tools and Editing** - All four markup types (count, linear, area, perimeter) with freehand naming, category assignment, color-coding, labels, and full undo/redo (completed 2026-04-21 via Phase 03.1 gap-closure)
- [x] **Phase 4: Project Persistence** - Save and load .clmc project files so work survives across sessions (completed 2026-04-29)
- [x] **Phase 4.1: ZIP-Embedded .clmc Format** - Upgrade .clmc to a self-contained ZIP archive that embeds the PDF, eliminating path-dependency and enabling true portability (completed 2026-05-02)
- [x] **Phase 5: BOQ Export** - Export takeoff sheet to Excel and CSV, grouped by category (completed 2026-05-03)
- [x] **Phase 6: Live View and UI Polish** - Running totals panel, thumbnail strip navigation, and page/scale status indicators that complete the day-to-day estimating workflow (completed 2026-05-12)
- [x] **Phase 6.1: Remove Left Thumbnail Strip Panel** (INSERTED) - Remove the left sidebar thumbnail strip; page navigation arrows are sufficient and the panel wastes horizontal canvas space
 (completed 2026-05-12)

- [x] **Phase 7: Canvas Workspace UX and Markup Editing Fixes** - Fix five live-use delinquencies: full-screen canvas workspace, post-commit markup editing, totals panel quantity list redesign, Set Scale modal dropdown overflow, and smart category deduplication (completed 2026-05-13)
- [x] **Phase 7.1: Resume Markup Group from Totals Panel** (INSERTED) - One-click row selection in the live totals panel arms the matching markup tool with that item's name, category, and color — eliminating the need to retype existing group names when adding more markups (completed 2026-05-19)
- [x] **Phase 8: Markup Workflow Acceleration and Wall Measurement Tool** - Chain markup mode, wall area measurement tool, per-item show/hide visibility toggle, and rifle-scope crosshair cursor (completed 2026-05-15)
- [x] **Phase 9: Selection Model, Ribbon Toolbar, Modal Polish, and Markup Completion** - Click-to-select + Delete-key deletion, drag-to-multi-select with group delete, all modals centered and draggable, ribbon-style tabbed toolbar (Home/Page/Tools/View/Estimating/Settings/Help), and Enter/double-click to finish in-progress markup (completed 2026-05-18)
- [x] **Phase 10: Granular Undo Foundation** - Polish undo so that Ctrl+Z during an in-progress multi-point markup (linear, area, perimeter, wall) pops only the last placed point rather than deleting the entire markup; establish this step-level undo contract as the foundation for all future undo behavior (completed 2026-05-19)
- [x] **Phase 11: Scale Ratio Input** - Scrapped — ratio calibration removed after UAT; draw-line method is sufficient (completed/closed 2026-05-20)
- [x] **Phase 12: Markup Geometry Editing** - Vertex edit mode (click selected markup again → drag square handles to reposition points) and drag-to-translate (drag selected markup to move it); group move for multi-select; all changes undoable via existing command pattern (completed 2026-05-21)
- [x] **Phase 13: Post-Commit Step-Level Undo** - Ctrl+Z on a committed multi-point markup (linear, area, perimeter, wall) re-opens it in drawing mode with all points intact — undoing just the commit, not the shape. Estimator can add points, pop points with further Ctrl+Z, or re-commit with Enter. Brief ConfirmationToast on re-open.
 (completed 2026-05-21)
- [x] **Phase 14: Markup Geometry Precision — Snapping + Curved-Edge Measurement** - Cursor snapping (endpoint/vertex/segment, screen-constant tolerance, F3/Alt) during placement and editing, plus true circular-arc edges (3-click gesture, bulge reshaping) with exact arc length and circular-segment area; arcs round-trip through save/reload and BOQ export (completed 2026-06-29)
- [x] **Phase 15: BOQ Pricing & Perimeter Simplification** - Priced BOQ (per-(name,type) unit rate × quantity = cost, category cost subtotals, ₱ grand total) in the totals panel and xlsx/csv export; Perimeter tool narrowed to length-only (perimeter-area removed) so every markup maps to exactly one priceable row (completed 2026-06-29)
- [ ] **Phase 16: Estimating Workspace** - Dedicated Estimate sheet in the Estimating tab (Plan | Estimate view toggle) with per-item material + labor unit rates → internal cost, plus a default-30% editable markup → client price and margin; the right-side totals panel reverts to quantity-only and pricing leaves the Plan workspace; xlsx/csv export gains Material/Labor/Cost/Markup/Price/Margin columns

---

## Phase Details

### Phase 1: PDF Viewer and Canvas Foundation

**Goal**: Estimators can open a construction PDF, flip between pages, zoom and pan to inspect detail, and see an invisible-but-stable canvas overlay that keeps any future markup precisely anchored to the plan geometry
**Depends on**: Nothing (first phase)
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-06
**Success Criteria** (what must be TRUE):

  1. User can open any multi-page construction PDF via a file picker and see it rendered at readable quality
  2. User can navigate forward and backward through pages without losing the current zoom state
  3. User can zoom in to 8x or more and pan freely â€" a test point placed on a plan feature stays on that exact feature regardless of zoom or pan applied afterward
  4. User can zoom out to fit-the-window and the full page is visible without distortion
  5. The app works on a 150% Windows display-scaled monitor without blurry rendering or offset pointer events

**Plans**: 4 plans
Plans:

- [x] 01-01-PLAN.md â€" Scaffold electron-vite project, Electron shell with IPC, UI chrome, Zustand store, Vitest
- [x] 01-02-PLAN.md â€" PDF.js rendering, Konva canvas viewport, page navigation
- [x] 01-03-PLAN.md â€" Zoom-to-cursor, pan, keyboard shortcuts, status bar wiring, visual verification
- [x] 01-04-PLAN.md â€" Gap closure: snappy page switching with canvas cache and pre-rendering

**UI hint**: yes

### Phase 2: Scale Calibration

**Goal**: Estimators can tell the app what scale each page is drawn at by drawing a line over a known dimension, and the app converts all future pixel distances to real-world measurements correctly
**Depends on**: Phase 1
**Requirements**: SCAL-01, SCAL-02, SCAL-03, SCAL-04
**Success Criteria** (what must be TRUE):

  1. User can draw a calibration line between two points on a page, type a real-world distance, and the computed scale ratio is displayed for confirmation before it is accepted
  2. Each page stores its own independent scale â€" calibrating page 2 does not change page 1
  3. User can see the current page's active scale ratio displayed in the UI at all times
  4. User can measure a second known dimension on the same page and compare its reported value against the expected real-world measurement to verify calibration accuracy
  5. Pages that have not been calibrated show a visible "not calibrated" warning so the estimator cannot accidentally measure without a scale set

**Plans**: 3 plans
Plans:

- [x] 02-01-PLAN.md â€" Scale math library (TDD), types, per-page scale state in Zustand store
- [x] 02-02-PLAN.md â€" Calibration UI: canvas interaction, dialog, toolbar buttons, StatusBar display, visual verification
- [x] 02-03-PLAN.md â€" Scale UX polish: StatusBar 1:N ratio format, confirmation toast, Set Scale context menu (re-calibrate/clear), ScalePopup

### Phase 3: Markup Tools and Editing

**Goal**: Estimators can place all four types of quantity markups on the plan, name them, assign them to a trade category, see them labeled and color-coded on the plan, and undo any mistakes
**Depends on**: Phase 2
**Requirements**: MARK-01, MARK-02, MARK-03, MARK-04, MARK-05, MARK-06, MARK-07, MARK-08, MARK-09, MARK-10
**Success Criteria** (what must be TRUE):

  1. User can place a count pin on the plan, type an item name, assign a category, and the pin appears labeled on the plan â€" tapping the same tool repeatedly increments the count for that named item
  2. User can draw a multi-segment polyline and see the cumulative length reported in real-world units immediately after the last segment is placed
  3. User can trace a closed polygon for an area markup and see both the enclosed area and the perimeter length reported, each in appropriate real-world units
  4. Every markup category is rendered in a distinct color, and a markup's label remains readable and positioned correctly at every zoom level from fit-to-window to maximum zoom
  5. User can undo the last 20+ markup actions (place, delete, rename) one step at a time, and redo them in sequence, with no markup data lost or corrupted after round-tripping through undo and redo

**Plans**: 5 plans
Plans:

- [x] 03-01-PLAN.md â€" TDD foundation: markup types, math library (polyline length, polygon area/centroid, unit conversion), markupStore with command-pattern undo/redo
- [x] 03-02-PLAN.md â€" DOM chrome: extend ActiveTool union, add 4 markup Toolbar buttons, build MarkupNamePopup + CategoryAutocomplete
- [x] 03-03-PLAN.md â€" Count + Linear tools: useMarkupTool hook, CountPinMarkup/LinearMarkup renderers, CanvasViewport wiring
- [x] 03-04-PLAN.md â€" Area + Perimeter tools: polygon close detection, AreaMarkup/PerimeterMarkup renderers with category-colored fills
- [x] 03-05-PLAN.md â€" Keyboard shortcuts (Ctrl+Z / Ctrl+Y) with text-input guard + end-to-end human-verify checkpoint (checkpoint ultimately closed via Phase 03.1)

**UI hint**: yes

### Phase 03.1: Markup Gap Closure and Visual Redesign (INSERTED)

**Goal**: Close 4 bugs surfaced in Plan 03-05 human verification (B1 spacebar guard in text inputs, B2 linear arc-length midpoint, B3 label legibility, B4 stale-zoom subscription) AND ship the D-21..D-35 visual redesign (count-pin circle-with-number-inside, per-name-group color model with 10-swatch palette picker, hover tooltip for names, right-click recolor context menu). Supersedes MARK-08 (per-category-color â†' per-name-group-color) and revises UI-SPEC D-04/D-13 (count pin label format).
**Requirements**: MARK-08 (revised), B1, B2, B3, B4, D-21 through D-35
**Depends on**: Phase 3
**Plans**: 6 plans

Plans:

- [x] 03.1-01-PLAN.md â€" Color model refactor: add Markup.color field, MARKUP_PALETTE module, recolorGroup undoable command (Wave 1, autonomous)
- [x] 03.1-02-PLAN.md â€" Visual redesign of all four markup components: circle+number pin (world-anchored, auto-contrast ink), arc-length midpoint for linear, measurement-only labels (Wave 2, autonomous)
- [x] 03.1-03-PLAN.md â€" MarkupNamePopup color picker row + D-25 inheritance + CategoryAutocomplete color-role removal (Wave 2, autonomous)
- [x] 03.1-04-PLAN.md â€" Stale-zoom subscription fix (B4) + spacebar text-input guard (B1) (Wave 1, autonomous)
- [x] 03.1-05-PLAN.md â€" MarkupContextMenu (right-click recolor + delete) + MarkupTooltip (hover name) (Wave 3, autonomous)
- [x] 03.1-06-PLAN.md â€" Human-verify checkpoint + Phase 3 / 3.1 closure + REQUIREMENTS.md MARK-08 annotation (Wave 4, autonomous:false)

### Phase 4: Project Persistence

**Goal**: Estimators can save their work to a .clmc file and reopen it later to continue exactly where they left off, with all markups and scale calibrations intact
**Depends on**: Phase 3
**Requirements**: PERS-01, PERS-02
**Success Criteria** (what must be TRUE):

  1. User can save the current project to a .clmc file; the saved file contains the PDF file reference, all markup positions and names, per-page scale calibrations, and a format version field
  2. User can reopen a saved .clmc file and every markup appears on the correct position on the correct page, indistinguishable from the state at save time
  3. If the original PDF file has been moved or renamed, the app shows a clear "PDF not found" message with a Browse button to re-link it â€" rather than crashing or silently showing a blank canvas

**Plans:** 7/8 plans executed
Plans:

- [x] 04-00-PLAN.md â€" Wave 0 test scaffolds (7 red test files + fixture PDF)
- [x] 04-01-PLAN.md â€" Schema, serialize, project-io (SHA256 + path math), IPC triad
- [x] 04-02-PLAN.md â€" projectStore + hydrate/reset methods + subscribeWithSelector dirty-tracking
- [x] 04-03-PLAN.md â€" useProject hook, usePdfDocument refactor, 4 recovery modals
- [x] 04-04-PLAN.md â€" Toolbar Open/Save/SaveAs, TitleBar dirty asterisk, Ctrl+S/Shift+S, App modal router
- [x] 04-05-PLAN.md â€" Close-window guard (main+renderer) + SaveCloseModal (D-16/D-21)
- [x] 04-06-PLAN.md â€" Human-verify checkpoint â€" gaps captured (F/G/H modals did not appear)
- [x] 04-07-PLAN.md â€" Gap closure: surface silent error, ENOENT-as-missing-pdf guard, diagnostic logging, contract test (closes F/G/H)

**Status:** Complete (all 8 plans executed, human UAT A-H passed, 2026-04-29)

### Phase 4.1: ZIP-Embedded .clmc Format (INSERTED)

**Goal**: Upgrade the `.clmc` file format from plain UTF-8 JSON (with external PDF path reference) to a ZIP archive that embeds the PDF, making each project file fully self-contained and portable across machines
**Depends on**: Phase 4
**Requirements**: PERS-01, PERS-02 (same requirements, better format)
**Success Criteria** (what must be TRUE):

  1. User can save a project to a `.clmc` v2 file that contains both the project data and the PDF â€" the file opens on any machine without any PDF path setup
  2. User can open an old v1 plain-JSON `.clmc` file; it loads correctly and the app marks it dirty, prompting the user to re-save in the v2 format
  3. User can use "Replace Plan PDF" in the Toolbar to swap the embedded PDF for a revised architect drawing, with page-count validation, while preserving all markups
  4. Save shows a "Saving..." indicator in the title bar while the ZIP is being written, and Save/SaveAs buttons are disabled during the write

**Plans**: 8 plans (7 originally + 1 gap-closure inserted from UAT Test 3)
Plans:

- [x] 04.1-00-PLAN.md â€" Wave 0 RED tests + jszip install (v1-migration-pdfbytes, atomic-write)
- [x] 04.1-01-PLAN.md â€" project-io v2 primitives + project-schema v2 + serialize + atomic write
- [x] 04.1-02-PLAN.md â€" IPC handlers + preload (readProject discriminated union, writeProject atomic, computedSha256)
- [x] 04.1-03-PLAN.md â€" projectStore.isSaving + viewerStore.pdfBytes
- [x] 04.1-04-PLAN.md â€" useProject rewrite (v2 save/open + replacePlanPdf, v1 pdfBytes population, scale warning) + ArchiveCorruptedModal
- [x] 04.1-05-PLAN.md â€" TitleBar Saving... + Toolbar Replace Plan PDF + App.tsx wiring
- [x] 04.1-06-PLAN.md â€" Manual UAT + roadmap closure
- [x] 04.1-07-PLAN.md â€" Gap closure: cloneForPdfWorker helper closes UAT Test 3 detached-buffer blocker (replacePlanPdf probe was an unprotected second caller of pdfjs-dist getDocument)

**Cross-cutting constraints:** jszip STORE compression (all IO plans); Uint8Array over IPC boundary (Plans 02, 03, 04); write-then-rename atomic save (Plans 01, 02, 06); cloneForPdfWorker discipline at every pdfjsLib.getDocument({ data }) call site (Plan 07)

### Phase 5: BOQ Export

**Goal**: Estimators can export the complete quantity takeoff to an Excel or CSV file that is ready to paste into a bid sheet, with items grouped by trade category
**Depends on**: Phase 4
**Requirements**: EXPRT-01, EXPRT-02
**Success Criteria** (what must be TRUE):

  1. User can export to .xlsx and the resulting file opens in Excel with columns for item name, quantity (as a number, not text), and unit of measure â€" rows grouped under category headings
  2. User can export to .csv with the same column structure and category grouping as the Excel export
  3. Exported quantities are numeric values (not strings) so formulas and SUM() work immediately in Excel without data cleanup

**Plans**: 7 plans
Plans:

**Wave 0 *(prerequisite â€" RED tests + types + dep install)*:**

- [x] 05-00-PLAN.md â€" Wave 0 RED tests + boq-types.ts + projectStore.isExporting + exceljs/csv-stringify install

**Wave 1 *(parallel-safe; both blocked on Wave 0 completion)*:**

- [x] 05-01-PLAN.md â€" boq-aggregator.ts (renderer pure: BoqStructure builder, findUncalibratedMarkupPages)
- [x] 05-02-PLAN.md â€" boq-writers.ts (main pure: buildBoqXlsx + buildBoqCsv) + project-io extension enforcers + safeText formula-injection guard

**Wave 2 *(blocked on 05-02)*:**

- [x] 05-03-PLAN.md â€" IPC triad: dialog:saveExport + file:writeBoqXlsx + file:writeBoqCsv (handler + preload bridge + d.ts)

**Wave 3 *(blocked on 05-01 + 05-03)*:**

- [x] 05-04-PLAN.md â€" useExport hook + UncalibratedExportWarningModal (D-06)

**Wave 4 *(blocked on 05-04)*:**

- [x] 05-05-PLAN.md â€" Toolbar Export IconButton + Ctrl+Shift+E + App.tsx wiring (handleExportClick + exportToast + uncalibratedWarning + exportError modal)

**Wave 5 *(blocked on 05-05 â€" manual UAT and doc closure)*:**

- [x] 05-06-PLAN.md â€" Manual UAT (6 scenarios â€" all PASS) + REQUIREMENTS/ROADMAP/STATE closure

**Cross-cutting constraints:** ExcelJS 4.4.0 native-number cells with `numFmt` (Plans 00, 02 â€" preserves SUM()); inline-duplicated `BoqStructure` type at renderer/main/preload boundaries (Plans 00, 01, 02, 03 â€" mirror of `ReadProjectResult`); write-then-rename atomic save via existing `atomicWriteFile` (Plan 03); discriminated-union IPC results `{ ok: true } | { ok: false, reason }` (Plan 03); `isTextInputActive()` guard on every global Ctrl+ shortcut (Plan 05); `safeText` apostrophe-prefix on cells starting with `=`, `+`, `-`, `@` to neutralize Excel-formula injection (Plan 02 â€" applies to user-supplied Item names and category names); `isExporting` race guard mirrored on `isSaving` pattern (Plans 00, 04, 05 â€" Toolbar disable + try/finally reset).

### Phase 6: Live View and UI Polish

**Goal**: Estimators can see their running totals update live as they work and navigate large plan sets efficiently, completing the full day-to-day workflow without needing to export just to check quantities
**Depends on**: Phase 3
**Requirements**: VIEW-01, PDF-05
**Success Criteria** (what must be TRUE):

  1. User can see a live totals panel that shows current quantities for every named item, grouped by category, updating immediately when a markup is placed or removed â€" without leaving the markup canvas
  2. User can navigate between pages by clicking a thumbnail in a sidebar strip rather than using next/previous buttons only
  3. The totals panel remains visible and usable alongside the markup canvas without obstructing the plan view on a standard 1080p monitor

**Plans**: 9 plans across 7 waves
Plans:

**Wave 0 *(prerequisite â€" RED test scaffolds)*:**

- [x] 06-00-PLAN.md â€" 15 Wave 0 RED test stubs (totals, thumbnails, hooks, highlights, header bar)

**Wave 1 *(parallel-safe; both blocked on Wave 0 â€" pure hooks + simple chrome)*:**

- [x] 06-01-PLAN.md â€" useBoqLive (8 primitive selectors over aggregateBoq) + usePageLabels + useUiPanels (localStorage clmc.ui with silent-reset)
- [x] 06-02-PLAN.md â€" useMarkupHighlight (parent-owned-lifecycle) + Splitter (4px hit area, commit-on-pointerup) + CanvasHeaderBar (28px, getCalibrationControls() reuse for Set Scale)

**Wave 2 *(blocked on 06-01 + 06-02 â€" Konva transient overlays)*:**

- [x] 06-03-PLAN.md â€" HoverRing + PulseHighlight (Konva Layer 2, listening=false, zoom-compensated, rAF fade 0.85â†'0 over 1500ms)

**Wave 3 *(parallel-safe with Wave 4; 06-04 blocked on Wave 1, 06-05 blocked on 06-03 + 06-04 â€" TotalsPanel render tree)*:**

- [x] 06-04-PLAN.md â€" TotalsPanel + TotalsPanelHeader + TotalsCategoryBlock + TotalsRow (color chip on item-name only, three D-09 empty states, grand-total bar)
- [x] 06-05-PLAN.md â€" TotalsRowContextMenu (defer-listener-registration, Copy as text TAB-separated payload, ConfirmationToast) + row hover/click wiring through useMarkupHighlight

**Wave 4 *(parallel-safe with Waves 2 & 3; blocked on Wave 1 â€" Thumbnail rasterization pipeline)*:**

- [x] 06-06-PLAN.md â€" useThumbnailRender (PDF.js render at 48 dpi via existing pdfDocument proxy, two-canvas composite, 200ms debounced overlay refresh) + Thumbnail (4 badges D-16, IntersectionObserver lazy mount) + ThumbnailStrip

**Wave 5 *(blocked on Waves 2 + 3 + 4 â€" App.tsx three-column shell)*:**

- [x] 06-07-PLAN.md â€" App.tsx three-column flex shell (minWidth:0 center column, toast relocation) + CanvasViewport Layer-2 mount points + useMarkupHighlight orchestration

**Wave 6 *(blocked on Wave 5 â€" manual UAT and closure)*:**

- [x] 06-08-PLAN.md â€" Manual UAT (zoom-compensated visuals, persistence across reload, fade timing, performance, 1080p layout, thumbnail sync) + REQUIREMENTS/ROADMAP/STATE closure

**Cross-cutting constraints:** ONE aggregator (`boq-aggregator.ts` reused via `useBoqLive` â€" D-04); per-name color travels canvas â†' row chip â†' pulse â†' BOQ export via `getColorForName(name)` (D-06 / D-12); `listening={false}` mandatory on every Konva shape inside HoverRing + PulseHighlight (Pitfall 1); zoom-compensated stroke widths (`/ currentZoom`) on transient overlays (Phase 03.1 discipline); reuse existing `viewerStore.pdfDocument.getPage(n)` for thumbnails â€" no new `pdfjsLib.getDocument({ data })` callsite (Phase 4.1 detached-buffer landmine, Pitfall 4); inline-style + `COLORS` tokens convention (no Tailwind in chrome path); UI panel state in `localStorage clmc.ui` namespace, NEVER in `.clmc` files (D-03); `getCalibrationControls()?.activate()` reuse â€" no duplicate Set Scale trigger code (D-20); defer-listener-registration via `setTimeout(0)` in TotalsRowContextMenu; localStorage parse failure â†' silent reset to defaults; tabular numbers via `font-variant-numeric: tabular-nums` only.

**UI hint**: yes

### Phase 06.1: Remove Left Thumbnail Strip Panel (INSERTED)

**Goal:** Remove the left sidebar thumbnail strip panel. The page navigation arrows already cover all page switching needs, and the thumbnail panel consumes horizontal space that would be better used by the markup canvas.
**Requirements**: UI-01 (quality-of-life improvement, no new v1 requirements)
**Depends on:** Phase 6
**Plans:** 1/1 plans complete

Plans:

- [x] 06.1-01-PLAN.md â€" Delete thumbnail files + edit useUiPanels/App.tsx for two-column shell

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

- [x] 07-02-PLAN.md — Wave 2 category dedup: CategoryAutocomplete keyboard nav + MarkupNamePopup mode='edit' + D-13 canonical substitution

**Wave 3 *(blocked on Wave 2)*:**

- [x] 07-03-PLAN.md — Wave 3 post-commit editing: EditMarkupCommand types + store action + MarkupContextMenu Edit item + CanvasViewport wiring

**Wave 4 *(blocked on Wave 3 — manual UAT and closure)*:**

- [x] 07-04-PLAN.md — Wave 4 manual UAT checkpoint and phase closure

**Cross-cutting constraints:** No new libraries or IPC channels (renderer-layer only); `COLORS.*` inline tokens only (no new hex literals, no Tailwind); `EditMarkupCommand` stores old/new category names as strings (not IDs); `getOrCreateCategory` called before `set()` updater; undo/redo explicit `'edit-markup'` branch before `cmd.markup.page` fallthrough; `e.stopPropagation()` on Enter in category input when `highlightedIndex >= 0`; subtract `containerRef.current.getBoundingClientRect()` when converting context-menu coords for popup.

**Success Criteria** (what must be TRUE):

  1. The PDF canvas area fills the full remaining horizontal and vertical space of the window — no blank gutters visible on a standard 1080p monitor at any zoom level
  2. User can click on any placed markup and edit its name, category, and/or color via an edit popup — changes persist to the project file
  3. The totals panel lists each markup item with its individual quantity — no summed total row; every placed markup quantity is visible at a glance
  4. The Set Scale modal unit dropdown fits entirely within the modal frame at all standard window sizes
  5. When typing a category name during markup placement, existing categories are shown as suggestions — selecting a suggestion prevents typo-based duplicates and the input matches existing names exactly

### Phase 7.1: Resume Markup Group from Totals Panel (INSERTED)

**Goal:** Estimators can click any item row in the live totals panel to immediately arm the matching markup tool (count/linear/area/perimeter/wall) with that item's name, category, and color — eliminating the need to retype an existing group name when placing additional markups into it.
**Depends on:** Phase 7
**Requirements:** No new v1 requirements (quality-of-life enhancement)
**Success Criteria** (what must be TRUE):

  1. Clicking any item row in the totals panel arms the matching markup tool with that item's name, category, and color — the cursor changes to crosshair and the tool is ready to place
  2. The armed tool type matches the markup type of the clicked item (count → count tool, linear → linear, area → area, perimeter → perimeter, wall → wall)
  3. A visible affordance (e.g., "+" icon on row hover) communicates that clicking the row will arm the tool
  4. Chain mode continues to work after arming from the totals panel — successive placements keep the same name/category/color without re-prompting
  5. Pressing Esc or clicking the armed tool button a second time disarms the tool and returns to the default state

**Plans**: 7 plans across 4 waves

**Wave 1 *(parallel-safe — independent hook + component extensions)*:**

- [x] 07.1-01-PLAN.md — useMarkupTool: add activatePreset() useCallback + UseMarkupToolReturn export
- [x] 07.1-02-PLAN.md — TotalsRow: export labelToName + rowTypeToMarkupType, add onArmTool prop, Plus slot
- [x] 07.1-03-PLAN.md — TotalsCategoryBlock: onArmTool prop thread with category.name curry

**Wave 2 *(blocked on Wave 1)*:**

- [x] 07.1-04-PLAN.md — CanvasViewport: _activatePresetRef module-ref + setChainArmedFromTotals export + useEffect populator
- [x] 07.1-05-PLAN.md — TotalsPanel: onArmTool pass-through prop

**Wave 3 *(blocked on Wave 2)*:**

- [x] 07.1-06-PLAN.md — App.tsx: handleArmTool + TotalsPanel wire; RibbonToolbar: setChainArmedFromTotals(null) disarm

**Wave 4 *(blocked on Wave 3 — UAT and closure)*:**

- [x] 07.1-07-PLAN.md — Human UAT (7 scenarios: A-G) + ROADMAP/STATE closure

---

### Phase 8: Markup Workflow Acceleration and Wall Measurement Tool

**Goal:** Four independent post-v1 enhancements that together accelerate placement and decluttering of the live takeoff: (1) continuous chain markup mode for all five tools, (2) new wall area measurement tool (length × height in m²), (3) per-item show/hide visibility toggle in the totals panel, (4) in-app crosshair cursor over the canvas.
**Depends on:** Phase 7
**Requirements:** No new v1 requirements (quality-of-life enhancements)
**Success Criteria** (what must be TRUE):

  1. After committing a markup, the active tool stays armed with the same name/category/color — successive placements don't re-prompt. Esc or re-clicking the tool button breaks the chain.
  2. A "Wall" tool button is in the toolbar. User draws a polyline, enters wall height (mm), and the result appears in the totals panel as a m² quantity (length × height). Wall markups export to BOQ as a m² row.
  3. Each item row in the totals panel has a Lightbulb/LightbulbOff icon. Clicking it hides/shows that item's markups on the canvas without affecting totals quantities or BOQ export. Hidden state persists in the .clmc project file.
  4. A rifle-scope crosshair cursor (white crossed lines, gap at center) replaces the OS cursor over the canvas whenever a markup or scale tool is active.

**Plans**: 8 plans in 5 waves

**Wave 0 *(prerequisite — RED test stubs + type extensions)*:**

- [x] 08-00-PLAN.md — Type extensions (`markup.ts` WallMarkup + MarkupCommand wall fields, `viewer.ts` isMarkupTool + ActiveTool, `boq-types.ts` + `boq-writers.ts` inline dup `'wall'`) + 6 RED test stubs

**Wave 1 *(parallel-safe; both blocked on Wave 0 — foundation)*:**

- [x] 08-01-PLAN.md — Chain mode refactor: `useMarkupTool.ts` chainArmed + pendingWallHeight + partial post-commit reset; `CanvasViewport.tsx` `getChainArmedItem()` module-ref
- [x] 08-02-PLAN.md — Schema + projectStore: `project-schema.ts` additive `hiddenItemNames?: string[]` (no formatVersion bump), `projectStore.ts` `toggleHiddenItem` + markDirty, serialize/hydrate

**Wave 2 *(parallel-safe; both blocked on Wave 0 — wall core)*:**

- [x] 08-03-PLAN.md — Wall math + BOQ pipeline + markupStore wall support: `markup-math.ts` wallAreaM2, `boq-aggregator.ts` wall branch, `markupStore.ts` editMarkup wallHeight extension
- [x] 08-04-PLAN.md — Wall renderer + popup: `WallMarkup.tsx` (new, 2.5× stroke + parallel hairline, zoom-compensated, m² label), `MarkupNamePopup.tsx` conditional wall-height row

**Wave 3 *(parallel-safe; both blocked on Waves 1 + 2 — UI integration)*:**

- [x] 08-05-PLAN.md — Toolbar BrickWall button + chain badge chips + crosshair cursor + CanvasViewport wall wiring
- [x] 08-06-PLAN.md — Visibility toggle UI: TotalsRow Lightbulb slot (e.stopPropagation) + skip-render in all 5 markup renderers + HoverRing/PulseHighlight review

**Wave 4 *(blocked on Wave 3 — manual UAT and closure)*:**

- [x] 08-07-PLAN.md — Manual UAT (10 scenarios: wall tool, chain mode, show/hide, crosshair, persist) + ROADMAP/STATE closure

**Cross-cutting constraints:** Zoom-compensated stroke widths (`/ currentZoom`) on all Konva shapes in WallMarkup (Pitfall 2); stateRef snapshot in commitShape wall branch (Pitfall 3); `e.stopPropagation()` on Lightbulb click (Pitfall 9); `boq-types.ts` + `boq-writers.ts` inline dup updated in lockstep in Wave 0 (Pitfall 10); `markDirty()` called explicitly in `toggleHiddenItem` (Pitfall 4); no formatVersion bump for additive `hiddenItemNames` field (Pitfall 11 note); COLORS tokens + inline styles only (no Tailwind in panel/canvas path).

### Phase 9: Selection Model, Ribbon Toolbar, Modal Polish, and Markup Completion

**Goal:** Five UX improvements that make the markup workflow faster and more intuitive: (1) click a markup to select it, press Delete to remove it; (2) hold and drag over the canvas to rubber-band-select multiple markups, press Delete to remove them as one undoable action; (3) every modal (Set Scale, Markup Name, Edit Markup, etc.) opens centered on the viewport and can be freely repositioned by dragging its header; (4) replace the flat action bar with a ribbon-style UI — a compact tab row (Home, Page, Tools, View, Estimating, Settings, Help) above a ribbon panel that is at least twice as tall and displays icon-plus-label buttons for the active tab; (5) pressing Enter or double-clicking the last placed point finalises an in-progress linear, area, or perimeter markup.
**Depends on:** Phase 8
**Requirements:** No new v1 requirements (quality-of-life enhancements)
**Success Criteria** (what must be TRUE):

  1. Clicking a placed markup selects it (visible selection ring); pressing Delete removes it and the action is undoable via Ctrl+Z
  2. Holding the mouse button and dragging across empty canvas draws a selection rectangle — all markups fully or partially inside are highlighted; pressing Delete removes all selected markups as a single undoable command
  3. Every modal that appears in the app opens at the center of the application window; dragging the modal's title bar freely repositions it and the position is maintained until the modal is closed
  4. A tabbed ribbon replaces (or wraps) the current toolbar area: a tab row with labels Home, Page, Tools, View, Estimating, Settings, Help; the ribbon panel below is at least 2× the height of the tab row and shows square icon+label buttons for the active tab; all existing markup and scale tools remain accessible via the ribbon
  5. For the Linear, Area, Perimeter, and Wall tools, pressing Enter or double-clicking the most recently placed point commits the in-progress markup — identical outcome to the existing finish-segment mechanism

**Plans:** 6 plans
Plans:

- [x] 09-00-PLAN.md — Type extensions + store additions (Wave 0)
- [x] 09-01-PLAN.md — useDraggable hook + all 9 modals draggable (Wave 1)
- [x] 09-02-PLAN.md — Click-to-select + selection ring + Delete/Ctrl+A (Wave 1)
- [x] 09-03-PLAN.md — Rubber-band multi-select + Enter key commit (Wave 2)
- [x] 09-04-PLAN.md — Ribbon toolbar RibbonButton + RibbonToolbar (Wave 2)
- [x] 09-05-PLAN.md — Manual UAT and phase closure (Wave 3) — 12/12 PASS; gaps fixed via quick task 260518-uat (commit 4db36bb) and debug session lmb-hold-drops-markup-on-release (commit 665835f)

### Phase 12: Markup Geometry Editing

**Goal:** Estimators can directly adjust placed markups without deleting and redrawing — vertex edit mode (click a selected markup again to enter handle-drag mode, reposition any vertex) and drag-to-translate (drag a selected markup to move its entire shape); group move works when multiple markups are selected; all edits are undoable via Ctrl+Z.
**Depends on:** Phase 9 (selection model), Phase 10 (undo foundation)
**Requirements:** No new v1 requirements (quality-of-life enhancement from v1.1 GAP-T1-01 + GAP-T1-02)
**Success Criteria** (what must be TRUE):

  1. Clicking an already-selected markup enters vertex edit mode — square handles appear at each vertex; dragging a handle repositions that vertex and the shape updates live
  2. Pressing Enter or clicking outside the markup commits the vertex changes; Escape restores original vertex positions
  3. Dragging a selected markup (not on a handle) translates the entire shape — 4px movement threshold prevents accidental moves on precise clicks
  4. When multiple markups are selected, dragging any one moves all selected shapes by the same delta (group move)
  5. All geometry edits (vertex move, single translate, group translate) are undoable with Ctrl+Z as a single action

**Plans**: 7 plans (12-00 through 12-06) across 5 waves
Plans:

- [x] 12-00-PLAN.md -- Wave 0 RED test stubs (move-vertex-command, move-markups-command, vertex-edit-mode)
- [x] 12-01-PLAN.md -- Types + store actions (move-vertex, move-markups) + viewerStore vertexEditMarkupId
- [x] 12-02-PLAN.md -- Markup component drag props + VertexHandleOverlay component
- [x] 12-03-PLAN.md -- CanvasViewport: refs, vertex-edit activation, keyboard handlers, handle layer
- [x] 12-04-PLAN.md -- CanvasViewport: body-drag translate + group move (D-07/D-08)
- [x] 12-05-PLAN.md -- CanvasViewport: vertex drag flow + click-outside commit (D-04..D-09 complete)
- [x] 12-06-PLAN.md -- UAT checkpoint and phase closure — 14/14 UAT scenarios PASS after three post-UAT fixes (single-click vertex edit + halo only for pins/groups 000f9e3; vertex handles appear on first click + follow body drag 564f0cb; zoom-compensate D-09 4px threshold 72094dc)

### Phase 13: Post-Commit Step-Level Undo

**Goal:** Estimators can refine a committed multi-point markup (linear, area, perimeter, wall) by pressing Ctrl+Z to re-open it in drawing mode with all its points intact — undoing just the commit, not the shape. From the re-opened state they can add more points, pop points with further Ctrl+Z (Phase 10 behaviour), or re-commit with Enter. A brief ConfirmationToast confirms the state change so first-time users understand it.
**Depends on:** Phase 10 (in-progress step-level undo), Phase 12 (markup geometry editing — vertex-edit mode shares the "edit a committed shape" mental model)
**Requirements:** No new v1 requirements (v1.1 enhancement — Phase C in v1.1-CONTEXT.md, decisions D-10/D-11/D-12)
**Success Criteria** (what must be TRUE):

  1. With a multi-point markup committed and selected, pressing Ctrl+Z re-opens the most recently committed multi-point markup in drawing mode — all its existing vertices appear as the in-progress point stack, the originating tool becomes active, and the shape itself is removed from the committed-markup layer until re-committed
  2. After re-opening, pressing Ctrl+Z again pops the last point (Phase 10 behaviour); Ctrl+Y re-adds it; pressing Enter commits the (possibly modified) shape back as a new committed markup using the original name/category/color
  3. Re-opening shows a `ConfirmationToast` reading something like "Shape re-opened — continue drawing or press Enter to commit" (parent-owns-lifecycle pattern, auto-dismiss)
  4. Pressing Esc while re-opened cancels the operation and restores the original committed markup exactly as it was before the re-open (no data loss, identical position and properties)
  5. Post-commit undo works for all five (current) multi-point tools: linear, area, perimeter, wall — count pins are unchanged (single-point, no re-open semantics); the re-open / pop / re-commit cycle is undoable end-to-end via the existing command pattern so the user can step back across the whole gesture

**Plans**: 3 plans across 3 waves

**Wave 0 *(prerequisite — RED tests + type extensions)*:**

- [x] 13-01-PLAN.md — TDD: RED test file src/tests/markup-post-commit-reopen.test.ts (15+ cases SC1-SC5 + EDGE-1/3/4/5 + module-ref round-trip + SC4 e2e Esc keydown); extend MarkupCommand union with reopen-recommit variant; add isMultiPointMarkup type guard

**Wave 1 *(blocked on Wave 0 — store + ref-module foundation)*:**

- [x] 13-02-PLAN.md — Store + ref module: markup-reopen-ref.ts (handler + snapshot refs); markupStore commitReopen/removeForReopen/restoreFromReopen actions + reopen-recommit undo/redo branches

**Wave 2 *(blocked on Waves 0 + 1 — dispatch + hook + viewport + toast — has hard runtime deps on 13-02's markup-reopen-ref module and removeForReopen/restoreFromReopen/commitReopen store actions)*:**

- [x] 13-03-PLAN.md — Dispatch + hook + viewport + toast: useMarkupTool activatePreset+commitShape extensions (consults getReopenSnapshot, dispatches commitReopen); useKeyboardShortcuts Ctrl+Z re-open branch (consults getMarkupReopenHandler); CanvasViewport handler registration + Esc + page-nav cancel + onReopenToast prop (uses removeForReopen/restoreFromReopen); App.tsx reopenToast slot (2500ms, bottom: 148)

**Cross-cutting constraints:** chainArmed: false on re-open seed AND post-commit reset (Pitfall 2 — load-bearing); wallHeight preserved across re-open (D-15 + EDGE-5); isTextInputActive() guard on every Ctrl+Z / Ctrl+Y / Enter / Esc (locked across Phases 3/10); Stage inverse transform unchanged (no new pointer path); useEffect cleanup sets module ref to null on unmount (StrictMode-safe — Pitfall 9); no new IPC/persistence/file I/O (renderer-only); UNDO_STACK_MAX=50 cap applied normally to reopen-recommit commands; page-navigation during re-open treats as implicit Esc (D-26 — Pitfall 1); cross-page guard (D-17 condition 5 — A4).

### Phase 11: Scale Ratio Input

**Goal:** Estimators can enter a drawing scale directly from the title block (e.g. 1:100) without drawing a calibration line — a new "Type ratio" tab inside `ScalePopup.tsx` auto-derives the sheet size from PDF metadata and computes pixelsPerMm from the ratio.
**Depends on:** Phase 10
**Requirements:** SCAL-01 (v1.1 enhancement — GAP-T2-00)
**Success Criteria** (what must be TRUE):

  1. ScalePopup shows two tabs: "Draw line" (existing) and "Type ratio" (new); switching tabs does not lose any in-progress state on the other tab
  2. In the "Type ratio" tab, user types a denominator (e.g. 100) into the right-hand field; the left field is locked to 1; the computed ratio (1:100) is displayed for confirmation
  3. The sheet physical size is derived from PDF.js page.view metadata and shown (e.g. "841 × 594 mm — A1") so the user can confirm the PDF has correct metadata before accepting
  4. Accepting the ratio sets the page scale to the same pixelsPerMm value that the draw-line path would have produced for the same ratio — measurements are identical regardless of which calibration method was used
  5. If the PDF has no usable page.view metadata (all-zero or degenerate), a clear warning is shown and the user is directed to use the Draw Line tab instead

**Plans**: 2 plans in 2 waves
Plans:

- [x] 11-01-PLAN.md — TDD: computePixelsPerMmFromRatio + isoSheetLabel (scale-math.ts) + test file
- [ ] 11-02-PLAN.md — ScalePopup tab switcher + ratio panel + CanvasViewport render condition widen

### Phase 10: Granular Undo Foundation

**Goal:** Make Ctrl+Z and Ctrl+Y work at point granularity during in-progress multi-point markup drawing — so a misplaced click can be corrected and re-applied without scrapping all prior work. This establishes the step-level undo/redo contract as a foundation for all future undo behaviour across the markup toolset.
**Depends on:** Phase 9
**Requirements:** MARK-09 (quality-of-life polish, no new v1 requirements)
**Success Criteria** (what must be TRUE):

  1. While drawing a linear, area, perimeter, or wall markup (mode:'drawing'), pressing Ctrl+Z removes only the last placed point and keeps the tool active with all prior points intact
  2. After popping one or more points with Ctrl+Z during drawing, pressing Ctrl+Y re-adds the most recently popped point — the full in-progress undo/redo stack is navigable before committing
  3. Ctrl+Z on the very first point of an in-progress markup cancels the whole markup (same as Escape), leaving the canvas clean
  4. After a markup is fully committed (finished), Ctrl+Z and Ctrl+Y continue to work at whole-markup granularity — no change to post-commit undo/redo behaviour
  5. All five multi-point tools (linear, area, perimeter, wall, and any future tool) share the same in-progress point-pop/re-add logic — not duplicated per tool

**Plans**: 2 plans
Plans:

- [x] 10-01-PLAN.md — Wave 0 RED test file: repushLastPoint and SC3 auto-cancel (markup-tool-point-redo.test.ts, 12 test cases)
- [x] 10-02-PLAN.md — Wave 1 implementation: redoPoints state extension, repushLastPoint, redo handler ref, Ctrl+Y dispatch extension

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
| 7. Canvas Workspace UX and Markup Editing Fixes | 5/5 | Complete | 2026-05-13 |
| 7.1. Resume Markup Group from Totals Panel | 7/7 | Complete | 2026-05-19 |
| 8. Markup Workflow Acceleration and Wall Measurement Tool | 8/8 | Complete | 2026-05-15 |
| 9. Selection Model, Ribbon Toolbar, Modal Polish, and Markup Completion | 6/6 | Complete | 2026-05-18 |
| 10. Granular Undo Foundation | 2/2 | Complete    | 2026-05-19 |
| 11. Scale Ratio Input | —/— | Scrapped | 2026-05-20 |
| 12. Markup Geometry Editing | 7/7 | Complete | 2026-05-21 |
| 13. Post-Commit Step-Level Undo | 3/3 | Complete    | 2026-05-22 |

### Phase 14: Markup Geometry Precision — Snapping + Curved-Edge Measurement

**Goal:** Estimators can place and trace markups precisely and measure curved geometry correctly — the cursor snaps to existing endpoints/vertices and to the nearest point on existing segments during placement and editing, and any linear / perimeter / area / wall edge can be a true circular arc whose real arc length and enclosed area are measured exactly, closing the straight-line under-measurement gap on curved walls, bay windows, and radii.
**Depends on:** Phase 13
**Requirements:** No new v1 requirements (quality-of-life — backlog MM-06 snapping, MM-05 curved-edge measurement)

**Validated by spikes** (`.planning/spikes/`):

- `002-snapping-engine` — uniform grid-hash spatial index; vertex snap 2–15µs at N=1k–50k (~130× under frame budget), 0 correctness mismatches vs brute force; cell = zoom-compensated tolerance; segments indexed by tolerance-padded bbox; intersection-snap deferred.
- `003-arc-segment-measure` — 3-point circular arc; arc length accurate ~1e-10 vs numerical oracle; straight chord under-measures a 90° bend ~10%; per-segment arc metadata carries the on-arc midpoint.
- `003b-curved-polygon-area` — curved AREA = shoelace ± circular-segment, accurate ~2.9e-8 for inward+outward bulges; sign rule OUTWARD ⟺ sign(cross) ≠ sign(shoelace); guard self-intersecting shapes.

**Success Criteria** (what must be TRUE):

  1. While placing or editing any markup, the cursor snaps to nearby existing endpoints/vertices and to the nearest point on existing segments within a tolerance that stays constant in screen pixels at every zoom level; a visible indicator shows the active snap target
  2. Snapping stays instant (no perceptible lag) on a page with thousands of existing vertices — driven by a spatial index, not a linear scan
  3. A linear, perimeter, area, or wall edge can be made a circular arc via a 3-point gesture (start / on-arc point / end); the rendered curve passes through the on-arc point and arc edges coexist freely with straight edges in one markup
  4. Reported length uses true arc length and reported area applies the circular-segment correction with the correct sign for both outward and inward bulges (matching the validated math); straight-only values are no longer reported for curved edges
  5. Committing an area/perimeter markup whose boundary self-intersects is detected and warned (rather than reporting a wrong quantity); arc geometry round-trips through save/reload and BOQ export intact

**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 14-01-PLAN.md — Foundation: arc metadata on the Markup model + arc-math.ts (3-point solver) + arc-aware markup-math length/area (Wave 1) — additive arcs? field (no formatVersion bump) + reshape-arc command; arc-math.ts matches spike-003/003b to ≤1e-6 (48 tests green); polylineLength/polygonArea arc-aware with winding-independent sign rule
- [x] 14-02-PLAN.md — Foundation: snapping-engine.ts grid-hash spatial index + self-intersection.ts detector (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 14-03-PLAN.md — Snapping integration: SnapIndicator glyphs + handleStageMouseMove injection + Alt/F3 controls + StatusBar pill (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 14-04-PLAN.md — Arc drawing: 3-click gesture + ArcPreview + hold-A/sticky arc mode (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 14-05-PLAN.md — Arc editing: BulgeHandle + endpoint re-solve (undoable) + self-intersection blocked commit (Wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 14-06-PLAN.md — Integration: arc-aware BOQ + Area/Perimeter/Linear/Wall arc-drawing renderers (buildArcAwareFlatPoints) + arc-roundtrip test (save/reload deep-equal + arc-aware-vs-chord BOQ) + 14-MANUAL-NOTES.md (Wave 5) — autonomous engineering complete, build green + 586 tests; Task 3 human UAT prepared + returned as checkpoint (Phase 14 checkbox gated on UAT approval)

---

### Phase 15: BOQ Pricing & Perimeter Simplification

**Goal:** Turn the quantity-only BOQ into a priced BOQ — every BOQ row carries a unit rate and a computed cost (rate × quantity), with per-category cost subtotals and a grand-total cost shown in the totals panel and in the .xlsx/.csv exports, denominated in ₱ — and narrow the Perimeter tool to a length-only measurement so each markup maps to exactly one priceable BOQ row.
**Depends on:** Phase 14 (BOQ aggregator + perimeter/area measurement engine)
**Requirements:** Reverses PROJECT.md "Unit cost / pricing — Out of Scope (v1)"; opens the v1.1 "Estimating" milestone. Source: GAP-002 re-audit (`.planning/spikes/GAP-002-post-precision-gaps.md`).
**Locked decisions:** see `.planning/phases/15-boq-pricing-perimeter-simplification/15-CONTEXT.md`

**Success Criteria** (what must be TRUE):

  1. Each BOQ row (totals panel, .xlsx, .csv) shows a unit Rate and a Cost = Rate × Quantity; each category shows a cost subtotal and the BOQ shows a grand-total cost, all denominated in ₱
  2. A user can set/edit a rate inline on any totals-panel row; the rate is stored in the .clmc project (keyed by `name|type`), survives save/reload, and the same (name, type) shares one rate across categories and pages
  3. The Perimeter tool emits exactly ONE BOQ row (length only); the `perimeter-area` row and type are removed from the aggregator, BOQ types, export writers, totals UI, and the affected tests
  4. A perimeter markup renders on canvas as an unfilled closed outline with a length-only label (`P: 24.6 m`) — no area fill, no `A:` value
  5. A perimeter BOQ row is labeled by its plain item name, gaining a `(perimeter)` suffix only when a same-named count/linear/area row exists (perimeter now participates in the shared collision-suffix rule)
  6. Existing `.clmc` projects with perimeter markups reload with length-only BOQ output and no errors (area was computed live, never stored — no data loss); the test suite is updated and green, and PROJECT.md reflects pricing as in-scope

**Plans:** 4/4 plans complete

Plans:
**Wave 0**

- [x] 15-01-PLAN.md — RED Nyquist tests first: aggregator rate/cost + perimeter one-row + collision-suffix, rates save/reload round-trip, writer Rate/Cost columns, inline-rate render + stopPropagation — written before any source touched

**Wave 1**

- [x] 15-02-PLAN.md — Data model + types + aggregator: `rates?` additive field (mirrors `hiddenItemNames`, no formatVersion bump) + `setRate`; `BoqItemRow.rate/cost` + `costSubtotal`/`grandTotalCost` across the 3 in-scope type-duplication files (boq-types + preload ×2; **boq-writers deferred to Wave 2/15-04**); perimeter-area removal + one-row + perimeter joins D-02 collision set; arc-aware length preserved. Done 2026-06-29 — commits ac1c97f/c9a5d79/85b1ade; aggregator/serialize/schema GREEN, typecheck clean

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-03-PLAN.md — Totals UI: inline ₱ rate field (`e.stopPropagation`, `name|type` rateKey) + `useBoqLive` rates subscription (live recompute) + net-new per-category cost subtotal + grand-total cost bar; PerimeterMarkup → unfilled outline + length-only `P:` label. Done 2026-06-29 — commits ffbd168/1da21b0/380f762; NEW src/renderer/src/lib/currency.ts ₱ seam; inline input is uncontrolled + native listeners (React synthetic onChange value-tracker-suppressed under native dispatch); both Wave 0 proofs (use-boq-live rates recompute + totals-row-rate-edit) GREEN, full suite 621 pass (only 15-04 writer reds remain), typecheck clean; resolved 15-02 stale-comment deferred item

**Wave 3** *(blocked on Wave 1 completion)*

- [x] 15-04-PLAN.md — Export: xlsx/csv Rate + Cost columns (₱ numFmt native numbers, A:E merge, cost subtotals + grand-total, CSV BOM kept) + PROJECT.md pricing scope flip + 15-MANUAL-NOTES.md (perimeter back-compat + ₱ + UAT)

---

### Phase 16: Estimating Workspace

**Goal:** Turn the single-rate priced BOQ into a full internal-costing + client-pricing estimate in a dedicated workspace. Pricing moves off the measurement surfaces (the Plan canvas and the right-side totals panel become quantity-only) into a full-width Estimate sheet opened from the `Estimating` tab. Each estimate line carries a material unit rate and a labor unit rate (× quantity = material cost + labor cost = internal cost), plus a markup percent (default 30%, editable per line) that yields the client price (cost × (1 + markup)) and the margin (price − cost); category subtotals, a grand total, and the .xlsx/.csv export all report Cost / Price / Margin in ₱.
**Depends on:** Phase 15 (BOQ pricing data model + aggregator + export + perimeter simplification)
**Requirements:** Extends the v1.1 "Estimating" milestone opened by Phase 15; supersedes Phase 15's inline totals-panel pricing UI (Phase 15 SC-2). No new v1 requirement IDs. Source: user redesign after Phase 15 UAT.
**Locked decisions:** see `.planning/phases/16-estimating-workspace/16-CONTEXT.md`

**Success Criteria** (what must be TRUE):

  1. Pricing appears only in the Estimate workspace: the `Estimating` tab exposes a `Plan | Estimate` toggle that swaps the main area to a full-width estimate sheet; the Plan canvas shows no pricing, and the right-side totals panel shows quantities only (no rate, no cost, no ₱) — Phase 15's inline `TotalsRow` rate field is removed
  2. Each estimate row has editable Material and Labor unit rates; Material cost = material rate × quantity, Labor cost = labor rate × quantity, and Cost = material cost + labor cost, updating live as rates or the takeoff quantity change
  3. Each row has an editable Markup % that defaults to 30% when unset; Price = Cost × (1 + markup) and Margin = Price − Cost, shown per row
  4. The estimate groups rows by category with per-category subtotals and a grand total, each reporting Cost, Price, and Margin in ₱
  5. Pricing is stored per `name|type` as `{ material, labor, markup }` in the .clmc, survives save/reload, shares one entry across categories/pages, and back-compat loads any Phase-15 single-rate file without error (missing markup defaults to 30%)
  6. The .xlsx and .csv export the full column set — Item · Qty · UoM · Material · Labor · Cost · Markup · Price · Margin — with category subtotals and a grand total; ₱ money cells stay SUM-safe native numbers; PROJECT.md and manual notes are updated

**Plans:** to be planned via `/gsd:plan-phase 16`

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
