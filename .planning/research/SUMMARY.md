# Project Research Summary

**Project:** CLMC Takeoff App
**Domain:** Windows desktop construction quantity takeoff application (PDF markup, canvas annotation, BOQ export)
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

The CLMC Takeoff App is a single-user Windows desktop tool for performing construction quantity takeoff directly on PDF plan sets. Experts build this class of product by layering an interactive markup canvas (Konva.js) over a rasterized PDF render (PDF.js), with all markup coordinates stored in PDF page space — never in screen or canvas pixel space. This coordinate discipline is the single most critical architectural decision: everything else (zoom, pan, save/load, measurement accuracy) depends on getting it right from day one. The recommended approach is Electron 35 + React 19 + TypeScript + electron-vite, giving a controlled Chromium environment that eliminates WebView fragmentation risk and provides direct Node.js file system access in the main process.

The feature set is well-understood from mature competitors (PlanSwift, Bluebeam Revu, EasyTakeoffs). Table stakes — PDF viewing, zoom/pan, per-page scale calibration, four markup types (count, linear, area, perimeter), save/load, and Excel/CSV export — must all be present before the product is usable. The MVP recommendation from feature research is a strict three-phase build: core viewing and calibration first, markup placement second, persistence and export third. Differentiators like keyboard shortcuts, running totals panel, and color-coding by category are low-complexity quality-of-life adds that belong immediately post-MVP.

The primary risks are all technical rather than product-related. Coordinate space errors, markup drift under zoom, rotated-page handling, and HiDPI offset bugs are silent failures that look correct at first but corrupt data on save/reload or at non-standard zoom levels. These must be designed out in the canvas foundation phase — retrofitting coordinate discipline into an already-built codebase is rated HIGH recovery cost in pitfall research. A secondary cluster of risks sits in the persistence layer: project files need a `formatVersion` field from day one, PDF paths must resolve gracefully when files move, and the per-page (not per-project) scale model must be enforced from the first save.

## Key Findings

### Recommended Stack

The stack is mature and well-validated for this use case. Electron provides a bundled Chromium engine, eliminating the WebView2 version drift risk that makes Tauri a poorer choice for canvas-heavy workloads on Windows. The PDF.js + Konva.js combination is the canonical pattern for annotation-over-PDF applications, confirmed by official Konva sandboxes for exactly this use case. Zustand provides state management with minimal boilerplate, and its persist middleware handles project file serialization cleanly.

**Core technologies:**
- **Electron 35 + electron-vite 3**: Desktop shell and build tooling — bundled Chromium eliminates engine fragmentation; hot reload during development
- **React 19 + TypeScript 5**: UI framework and language — react-konva requires React 19; TypeScript mandatory for complex markup data structures
- **pdfjs-dist 5.5.x**: PDF rasterization — only mature open-source JS PDF renderer; handles multi-page, large construction drawings
- **Konva 10.2.x + react-konva 19.2.x**: Interactive canvas markup layer — per-shape event handling, Stage-level zoom/pan, official annotation sandbox matches use case
- **Zustand 5.0.x**: App-wide state — persist middleware serializes markup state to JSON; no provider pyramid
- **ExcelJS 4.4.0**: Excel export — richer formatting API than SheetJS CE for write-only BOQ output
- **electron-builder 26.8.x**: Packaging — NSIS installer for Windows distribution

### Expected Features

**Must have (table stakes) — MVP blockers:**
- PDF load with multi-page support — plans always come as PDFs; real-world files are 50–200 MB
- Page navigation (prev/next, jump) — plan sets have 10–100+ pages
- Zoom and pan with markup coordinate pinning — estimators zoom 10–20x; markups must stay on plan geometry
- Per-page scale calibration by drawn line — the industry-standard method; per-page is mandatory for mixed-scale PDFs
- Count markup (point/pin) with freehand name — most common takeoff task
- Linear markup (polyline) with freehand name — wall runs, pipe lengths, conduit
- Area markup (polygon) with freehand name — floors, ceilings, concrete slabs
- Perimeter markup with freehand name — produces both perimeter length and area from one trace
- Category/group assignment per markup — drives grouping in BOQ export
- Save/load project file — work is always resumed across sessions
- Export to Excel and CSV, grouped by category — the final deliverable for bid pricing
- Undo/redo (minimum 20 actions) — estimators misplace markups constantly
- Markup delete, select, edit in-place — corrections are routine
- Unit system selection (metric or imperial) — project-level setting

**Should have (competitive differentiators):**
- Keyboard shortcuts for all tools — estimators doing 200-item takeoffs live by hotkeys; low complexity
- Running totals panel — live BOQ view as measurements are placed; reduces export-just-to-check cycles
- Markup color coding by category — visual trade separation on dense plans; low complexity
- Markup visibility toggle per category — show/hide trades to reduce clutter; low complexity
- Per-page scale display and calibration status indicator — prevents silent wrong-scale measurement
- Scale calibration from preset list (1:100, 1:50, etc.) — shortcut when printed scale is readable
- Recent projects list — one-click reopen; trivial to implement
- Page thumbnail strip — visual navigation for large plan sets

**Defer to v2+:**
- Snap-to-content (PDF vector extraction) — high complexity; falls back silently on scanned plans
- Annotated PDF export — useful for QA but significant additional scope
- Cloud sync, multi-user, AI auto-detection, CAD file support, unit pricing — explicitly out of scope for v1

### Architecture Approach

The architecture is a layered desktop application with a strict process boundary between the Electron main process (file system, native dialogs, IPC) and the renderer process (PDF display, Konva markup canvas, React UI). The Domain Model (Zustand store) is the single source of truth for all project state. All markup coordinates are stored in PDF page space; measurements are derived from geometry plus the per-page scale ratio at read time, never stored as computed values. The Command pattern drives undo/redo to avoid full-snapshot memory overhead.

**Major components:**
1. **App Shell (main process)** — window lifecycle, native file dialogs, IPC bridge; renderer never touches file system directly
2. **PDF Renderer** — rasterizes one PDF page at a time into a canvas; exposes `ViewportState` interface (pageWidth, pageHeight, scale, offsets)
3. **Markup Canvas Layer** — Konva stage overlaid on PDF canvas; accepts pointer events; reads/writes only via Domain Model
4. **Scale Service** — converts between PDF page pixel coordinates and real-world units; per-page calibration ratio
5. **Domain Model (Project Store)** — Zustand store holding the complete project tree (pages, per-page scale, all markups)
6. **Persistence Engine** — serializes/deserializes Domain Model to `.clmc` JSON file via IPC; manages unsaved-changes flag
7. **Export Engine** — aggregates markup data grouped by category; writes `.xlsx` / `.csv` via IPC to main process

### Critical Pitfalls

1. **PDF coordinate origin inversion** — PDF origin is bottom-left, canvas origin is top-left. Store all markup coordinates in normalized PDF user-space (0.0–1.0 per axis) using `viewport.convertToPdfPoint(x, y)`. Never persist raw canvas pixel coordinates. Recovery cost if done wrong: HIGH (markups are often unrecoverable).

2. **Markup position drift on zoom and pan** — Applying scale and translate as independent steps with different origins causes drift proportional to zoom level. Maintain a single affine transform matrix; test at 1×, 2×, 4× zoom after pan. Must be established before any markup logic is written.

3. **Rotated PDF pages break all coordinate math** — Pages with `/Rotate: 90` swap width/height in the viewport. Always use PDF.js built-ins `viewport.convertToPdfPoint` and `viewport.convertToViewportPoint`; never implement the transform manually. Verify with a test PDF containing a 90°-rotated page.

4. **No schema version in project file** — Adding `formatVersion: 1` from the first save costs nothing; omitting it makes future migrations impossible. Every old project file becomes unreadable after any schema change.

5. **Scale calibration error compounds over distance** — A 2% click error on a 50m wall run produces 1m of error. Display computed scale factor for user confirmation after calibration. Warn clearly on pages where no calibration has been set. Never silently inherit scale from another page.

6. **Canvas size limit causes silent blur at high zoom** — Chromium caps GPU texture size; PDF.js silently falls back to CSS scaling rather than throwing an error. Cap render scale or implement tiled rendering. Test with an A0/A1 PDF at 4× zoom.

7. **HiDPI coordinate mismatch** — At 150% Windows display scaling, mouse events are in CSS pixels but canvas dimensions must be in physical pixels. Set canvas width/height to `cssSize * devicePixelRatio` and scale the context accordingly. Test explicitly on a 150%-scaled display.

## Implications for Roadmap

Based on research, suggested phase structure (strict dependency order — nothing in a later phase is buildable without the prior phase being solid):

### Phase 1: Foundation — PDF Viewer and Canvas Infrastructure

**Rationale:** Every subsequent feature sits on top of the PDF rendering stack and coordinate system. Coordinate discipline bugs introduced here corrupt all markup data written later and are rated HIGH recovery cost. Architecture research confirms this must be built and tested before any markup logic is added.

**Delivers:** A working PDF viewer inside Electron with correct zoom, pan, HiDPI handling, and a stable Konva canvas overlay positioned precisely over the rendered page — but no markup tools yet.

**Addresses:** PDF load (multi-page), page navigation, zoom and pan, App Shell IPC scaffold, ViewportState interface

**Avoids:** PDF coordinate origin inversion (Pitfall 1), markup drift on zoom/pan (Pitfall 2), rotated page coordinate break (Pitfall 4), canvas size limit blur (Pitfall 5), HiDPI coordinate mismatch (Pitfall 10)

**Research flag:** Standard pattern — PDF.js + Konva integration is well-documented with official sandbox examples. No additional research-phase needed. Acceptance test: place a point at a known position, zoom to 4×, pan, zoom back — point must remain on the same pixel of the plan.

### Phase 2: Scale Calibration and Measurement Engine

**Rationale:** Scale Service must be solid before any markup measurement is built. Bugs here corrupt every computed value in the project. Domain Model and Scale Service can be fully unit-tested without a UI, validating the math before the canvas layer consumes it.

**Delivers:** Per-page scale calibration by drawn line (with user confirmation of computed ratio), the Scale Service (pixel-to-real-world conversion), unit system selection (metric/imperial), and a "not calibrated" page warning.

**Addresses:** Scale calibration by drawn line, per-page scale model, unit system, per-page calibration status indicator

**Avoids:** Scale calibration compounding error (Pitfall 3), float accumulation in area calculations (Pitfall 9), single-global-scale anti-pattern (PITFALLS.md technical debt table)

**Research flag:** Standard pattern — well-documented calibration workflow confirmed by EasyTakeoffs, PlanSwift, and Bluebeam documentation. Unit tests should be written before UI.

### Phase 3: Markup Placement and Undo/Redo

**Rationale:** With coordinate system and scale solid, all four markup types can be built. Undo/redo must be introduced here — not retroactively — because wrapping markup creation in Command objects from the start is far cheaper than retrofitting it to an existing codebase.

**Delivers:** Count, linear, area, and perimeter markup tools with freehand naming and category assignment. Command-pattern undo/redo (minimum 20 actions). Markup select, delete, and in-place edit.

**Addresses:** All four markup types, freehand naming, category assignment, undo/redo, markup delete/select/edit

**Avoids:** Storing markups in canvas-layer state (ARCHITECTURE.md anti-pattern 1), computing measurements in screen space (anti-pattern 2), per-markup undo via full snapshot (anti-pattern 5)

**Research flag:** Standard pattern for markup types and Command pattern undo. Canvas drawing interactions for polygon close and multi-segment polyline may benefit from quick review of Konva event handling docs.

### Phase 4: Project Persistence

**Rationale:** Persistence is isolated from markup placement by design — the Domain Model serializes cleanly to JSON. This phase introduces the `.clmc` project file format, which must be correct from the first commit: `formatVersion`, per-page scale storage, and relative PDF path resolution.

**Delivers:** Save and load `.clmc` project files (JSON). Graceful "PDF not found" recovery with Browse button. Unsaved-changes indicator. `formatVersion: 1` in every saved file.

**Addresses:** Save/load project, project file absolute path resolution, schema versioning

**Avoids:** Absolute PDF path break on move (Pitfall 7), no schema version migration trap (Pitfall 8), storing PDF bytes in project file (ARCHITECTURE.md anti-pattern 4)

**Research flag:** Standard pattern — Electron IPC + Node.js `fs.writeFile` is well-documented. No additional research needed.

### Phase 5: BOQ Export

**Rationale:** Export is a read-only consumer of the Domain Model — it can only be built once the Model is stable and populated. Excel formatting requirements (grouped by category, numeric quantities with separate unit column) are well-defined.

**Delivers:** Excel (.xlsx) export via ExcelJS and CSV export via csv-stringify. Markup data grouped by category. Pre-export validation warning for zero-quantity items. String sanitization for special characters.

**Addresses:** Export to Excel/CSV (table stakes), zero-quantity export guard, special character handling

**Avoids:** Writing string quantities instead of numeric values (PITFALLS.md integration gotchas), zero-quantity silent export (Pitfall 12), special character export corruption (Pitfall 11)

**Research flag:** Standard pattern — ExcelJS is well-documented. Test suite should include `&`, `<`, `>`, emoji, and 300-character strings before shipping.

### Phase 6: Polish and Differentiators

**Rationale:** With all table stakes delivered, low-complexity differentiators that elevate user experience can be added safely. These are all additive — none require reworking existing logic.

**Delivers:** Keyboard shortcuts for all tools, running totals sidebar panel, markup color coding by category, category visibility toggle, scale calibration preset list (1:100, 1:50, etc.), recent projects list, page thumbnail strip.

**Addresses:** All "should have" differentiators from FEATURES.md

**Research flag:** Standard patterns throughout. No research-phase needed.

### Phase Ordering Rationale

- **Phases 1 and 2 are strictly sequential and non-negotiable.** The coordinate system and scale service are the load-bearing infrastructure. All later phases use their output as a given.
- **Phase 3 (markups) depends on Phase 2 (scale).** A count markup does not need scale, but linear, area, and perimeter markups do. Building them together keeps the implementation coherent.
- **Phase 4 (persistence) is deliberately decoupled** from Phase 3. The Zustand store serializes to JSON independently of how markups were created. This means persistence can be written and tested against a hardcoded fixture before any markup UI exists if needed.
- **Phase 5 (export) is a pure read path** over the Domain Model. It has no dependencies on persistence; a user could export without ever saving a project file.
- **Phase 6 (polish) is additive** — none of it changes existing behavior, reducing regression risk.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (PDF + Canvas Foundation):** The interaction between PDF.js `viewport.transform`, Konva's stage coordinate system, and `devicePixelRatio` is the most technically nuanced area. Review the PDF.js annotation extension reference implementation before writing the ViewportState interface.
- **Phase 3 (Markup + Undo):** Polygon close interaction (double-click to close, ESC to cancel), multi-segment polyline with mid-point editing, and the Konva Transformer widget for selected markup editing warrant a Konva docs review before implementation.

Phases with standard patterns (can skip research-phase):
- **Phase 2 (Scale Calibration):** The math is straightforward; industry workflow is well-documented. Unit tests are sufficient validation.
- **Phase 4 (Persistence):** Electron IPC + JSON file I/O is standard; no novel patterns required.
- **Phase 5 (Export):** ExcelJS write path is well-documented; sanitization and validation are mechanical.
- **Phase 6 (Polish):** All features are additive; no architectural decisions required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against npm registries as of 2026-03-25. react-konva/React 19 peer dep confirmed. ExcelJS stable at 4.4.0 for 2+ years — no known Electron 35 issues. |
| Features | HIGH | Table stakes validated against PlanSwift, Bluebeam, EasyTakeoffs, and industry workflow guides. Feature dependency graph confirmed. Complexity estimates rated MEDIUM confidence — may vary by developer. |
| Architecture | HIGH (patterns) / MEDIUM (integration details) | Core patterns (PDF page space, derived measurements, Command undo, IPC boundary) are well-established and sourced from official docs and real implementations. Specific PDF.js + Konva integration detail is MEDIUM confidence — from third-party guides rather than Mozilla official docs. |
| Pitfalls | HIGH | Coordinate system pitfalls sourced from multiple independent technical references (Apryse, Datalogics, Qoppa, Mozilla GitHub issues). HiDPI and rotated-page pitfalls confirmed by real-world issue reports. |

**Overall confidence:** HIGH

### Gaps to Address

- **PDF.js worker configuration in Electron/Vite:** The required `vite-plugin-static-copy` pattern for copying `pdf.worker.mjs` to the renderer's public folder is noted in STACK.md but not fully detailed. Validate this configuration in Phase 1 before any other PDF work proceeds.
- **Canvas size limit threshold in Electron 35 / Chromium 134:** The maximum canvas size (typically 16384×16384 px) should be verified against the specific Chromium version bundled with Electron 35. If the limit is lower, tiled rendering may be needed earlier than anticipated.
- **ExcelJS streaming writer for large exports:** ExcelJS 4.4.0 is stable but was last published approximately two years ago. If it shows any incompatibility with Node 22 (bundled with Electron 35), the fallback is SheetJS CE for export-only use.
- **Snap-to-content feasibility:** Deferred to v2+, but the approach (PDF vector path extraction via PDF.js operator lists) should be prototyped before committing to it in a future roadmap phase, as its reliability on scanned plans is low.

## Sources

### Primary (HIGH confidence)
- [Electron 35.0.0 release blog](https://www.electronjs.org/blog/electron-35-0) — Node 22.14.0, Chromium 134 versions confirmed
- [electron-builder npm v26.8.1](https://www.npmjs.com/package/electron-builder) — packaging version confirmed
- [pdfjs-dist npm v5.5.207](https://www.npmjs.com/package/pdfjs-dist) — current release confirmed March 2026
- [mozilla/pdfjs-dist GitHub](https://github.com/mozilla/pdfjs-dist) — release history
- [Konva GitHub releases v10.2.3](https://github.com/konvajs/konva/releases) — version confirmed
- [react-konva npm v19.2.3](https://www.npmjs.com/package/react-konva) — React 19 peer dep confirmed
- [Konva Image Labeling sandbox](https://konvajs.org/docs/sandbox/Image_Labeling.html) — annotation-over-image pattern confirmed
- [Konva.js architecture overview](https://konvajs.org/docs/overview.html) — Stage/Layer/Shape model
- [zustand npm v5.0.12](https://www.npmjs.com/package/zustand) — current version confirmed
- [ExcelJS npm v4.4.0](https://www.npmjs.com/package/exceljs) — version confirmed
- [Command pattern for undo/redo](https://softwarepatternslexicon.com/java/behavioral-patterns/command-pattern/implementing-undo-and-redo/) — established pattern
- [Tauri v2 process model and IPC](https://v2.tauri.app/concept/process-model/) — IPC boundary pattern validated

### Secondary (MEDIUM confidence)
- [PDF.js annotation extension with Konva integration](https://github.com/Laomai-codefee/pdfjs-annotation-extension) — real implementation reference for PDF.js + Konva overlay
- [PDF.js coordinate transform (viewport)](https://pdfjs.express/documentation/viewer/coordinates) — coordinate system explanation
- [Optimizing In-Browser PDF Rendering — Joyfill](https://joyfill.io/blog/optimizing-in-browser-pdf-rendering-viewing) — render-visible-pages-only pattern
- [Electron vs Tauri — DoltHub 2025](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — framework comparison, WebView fragmentation risk
- [Transform view coords to PDF coords — Qoppa](https://kbdeveloper.qoppa.com/transform-from-view-coordinates-to-pdf-coordinates-to-take-into-account-cropbox-and-rotation-on-a-pdf-page/) — rotation and CropBox handling
- [Bluebeam scale calibration workflow](https://novedge.com/blogs/design-news/bluebeam-tip-bluebeam-revu-scale-calibration-workflow-for-accurate-takeoffs) — industry-standard calibration method confirmed
- [EasyTakeoffs features](https://easytakeoffs.com/features) — keyboard shortcuts, snap, undo workflow patterns
- [PlanSwift features overview](https://www.planswift.com/planswift-features/) — table stakes feature validation
- [High DPI Rendering — cmdcolin](https://cmdcolin.github.io/posts/2014-05-22/) — devicePixelRatio canvas pattern
- [Blurry Rendering on High DPI — PDF.js GitHub #10509](https://github.com/mozilla/pdf.js/issues/10509) — HiDPI pitfall confirmed

### Tertiary (LOW confidence — needs validation during implementation)
- [react-virtuoso](https://virtuoso.dev/) — virtual rendering for large page lists; evaluate during Phase 1 if 20+ page performance is observed to be a problem

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
