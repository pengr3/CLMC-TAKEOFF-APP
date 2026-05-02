# Phase 5: BOQ Export - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert the in-memory takeoff (per-page markups + categories + per-page scales) into a single shareable BOQ spreadsheet that an estimator can paste straight into a bid sheet. Two output formats: `.xlsx` via ExcelJS and `.csv` with the same structural layout. Triggered from a Toolbar button or `Ctrl+Shift+E`.

**In scope:** Aggregation by `(item-name, type)` across the whole project, conversion of all length/area measurements to a single export unit, BOQ table with category grouping + subtotals + grand total, project-metadata header rows, color-coding from the per-name-group color model, post-export `ConfirmationToast`, native Save dialog with `.xlsx` / `.csv` filters, sensible default filename + folder, `isTextInputActive()`-guarded keyboard shortcut, pre-export warning when markups exist on uncalibrated pages.

**Out of scope:** Custom Excel template (PROJECT.md key decision; v2 EXPRT-03), running totals panel inside the app (Phase 6 VIEW-01), thumbnail strip (Phase 6 PDF-05), markup editing after placement (v2 PROD-03), open file / reveal in folder buttons in the toast, application menu bar, exporting to formats other than .xlsx / .csv.

</domain>

<decisions>
## Implementation Decisions

### Aggregation Model

- **D-01:** Aggregation key is `(name, type)` where `type` is one of `count | linear | area | perimeter-length | perimeter-area`. `Perimeter` markups synthesize TWO virtual types per shape (perimeter-length and perimeter-area). One BOQ row per unique `(name, type)` pair across the whole project. Same name on different pages aggregates into the same row. (User picked: aggregate by item name across whole project; aggregate by (name, type) when types collide; perimeter produces two rows.)
- **D-02:** Row label rendering rules:
  - Pure count, pure linear, pure area when no name collision: just `{name}`.
  - Perimeter: always two rows — `{name} (perimeter)` and `{name} (area)`.
  - Same `{name}` used for ≥2 distinct types (excluding perimeter, which already self-suffixes): suffix every conflicting row with `({type})` — e.g. `Outlet (count)`, `Outlet (linear)`. The disambiguation is automatic; users do not have to rename markups.
- **D-03:** Quantity values:
  - Count → integer pin count (number of count markups with that name across the whole project). Not the max sequence — sequences are gap-preserving.
  - Linear → sum of polyline lengths in `globalUnit`.
  - Area → sum of polygon areas in `globalUnit`².
  - Perimeter-length → sum of polygon perimeters in `globalUnit`.
  - Perimeter-area → sum of polygon areas in `globalUnit`².
  All written as native numbers in Excel (`cell.value = number`), full underlying precision. Excel cell number-format string `"0.00"` for length/area columns; `"0"` for count. CSV writes the rounded display number (no formatting layer in CSV) at 2dp for length/area, integer for count.

### Export Unit

- **D-04:** All length and area quantities convert to `useScaleStore.getState().globalUnit` for the export. Per-page `displayUnit` is ignored on export — `globalUnit` is the project-wide canonical. Conversion uses the existing `pixelLengthToReal` / `pixelAreaToReal` helpers in `markup-math.ts`. UoM column shows `globalUnit` for length, `globalUnit + '²'` (e.g. `m²`, `ft²`) for area, `ea` for count.
- **D-05:** Counts have no scale dependency — count rows export the same regardless of calibration.

### Uncalibrated Pages

- **D-06:** Pre-export check: collect all pages that contain ≥1 linear/area/perimeter markup AND have no `pageScale`. If the list is non-empty, show a non-blocking warning modal before opening the save dialog: "Page {N1, N2, …} have markups but no scale set. Their length / area / perimeter measurements will be excluded from the export. Counts on those pages export normally. **[Continue]** **[Cancel]**". Cancel aborts the flow. Continue proceeds to the save dialog and silently excludes the affected non-count markups from the export.
- **D-07:** Empty project (zero markups) — Export button is disabled in the Toolbar. No save dialog opens. Same `disabled` pattern as the existing scale-dependent tools (`setScaleDisabled`).

### Sheet Structure & Polish

- **D-08:** XLSX sheet name: `BOQ`. Single worksheet per export.
- **D-09:** Top-of-sheet metadata block (4–6 rows above the table):
  - Project name (basename of `currentFilePath`, or `pdf.originalFilename` if never saved)
  - Source PDF filename (`pdf.originalFilename`)
  - Export date (ISO-8601 or locale-formatted — Claude's discretion, recommend `YYYY-MM-DD`)
  - Total pages
  - Total markups
  - Blank spacer row before the BOQ table
- **D-10:** Column-title row (`Item`, `Quantity`, `UoM`) is bold and frozen via `worksheet.views = [{ state: 'frozen', ySplit: <row-of-title> }]` so it stays visible while scrolling.
- **D-11:** Each category renders as a bold heading row spanning the table width before its items. Heading text is the category name. Categories appear in `useMarkupStore.getState().categoryOrder` order. Empty categories (zero markups across all pages) are excluded.
- **D-12:** Per-category subtotal row at the end of each group: text label `Subtotal` in the Item column, sum of quantity column for like-typed rows only (don't sum `5 ea` with `12 m`). When a category contains rows of mixed UoM, subtotal renders as a multi-line cell — one subtotal per UoM — OR multiple subtotal rows, one per UoM (Claude's discretion; recommend multiple subtotal rows for SUMIF-friendliness in CSV mirror). Grand total row at the bottom of the table follows the same like-typed-only rule.
- **D-13:** Color coding — only the `Item` cell of each item row gets fill colour matching the markup's name-group color (from `Markup.color`, which after Phase 03.1 is the authoritative visual field; query via `useMarkupStore.getColorForName(name)` per row). Full-row fills are NOT used (they clash with the bold-category-heading style). Category heading rows do NOT use color (color is per-name-group, not per-category — Phase 03.1 D-29). Subtotal and grand-total rows have a subtle gray fill (`COLORS.secondary` or similar) and bold weight to distinguish them from item rows.
- **D-14:** CSV mirrors the XLSX row sequence exactly: metadata block at top, blank spacer, column-title row (no bold marker), category-heading rows as bare-text rows (`Electrical,,`), item rows, subtotal rows, grand total. CSV cannot carry color/bold/freeze-panes — only the row order is preserved. Quoting follows RFC 4180 (commas / newlines / quotes inside a field trigger field-quoting and quote-doubling).

### Export Trigger UX

- **D-15:** Single Toolbar `Export` button placed inside the file-action cluster, after `Replace Plan PDF`. Icon: `Download` from lucide-react (consistent with `FileUp` / `Save` / `SaveAll` / `Replace` already in the cluster). Label: `Export`. Same `IconButton` styling as the surrounding buttons.
- **D-16:** Click → native Electron `dialog.showSaveDialog` with two filters:
  1. `Excel Workbook (.xlsx)`
  2. `CSV (.csv)`
  The user-chosen filter determines the export format. The selected extension is enforced on the returned path (mirror the existing `enforceClmcExtension` pattern in `project-io.ts` — add `enforceXlsxExtension` and `enforceCsvExtension` helpers).
- **D-17:** Default filename: `{project-basename}-BOQ.xlsx` (or `.csv` if user toggles the filter). `project-basename` is derived from `currentFilePath` (strip `.clmc` extension and directory); if never saved, fall back to `pdf.originalFilename` (strip `.pdf` extension). Default folder: directory of `currentFilePath` if saved, otherwise the user's last-used Save folder (Electron remembers per dialog).
- **D-18:** Keyboard shortcut: `Ctrl+Shift+E`. Same `isTextInputActive()` guard as `Ctrl+S` to prevent firing while typing in `MarkupNamePopup` / `CategoryAutocomplete` / `ScalePopup` text inputs. Registered in `useKeyboardShortcuts.ts` alongside the existing shortcuts.
- **D-19:** Disabled state mirrors `Replace Plan PDF`: `totalPages === 0 || isSaving || hasZeroMarkups`. (Add `hasZeroMarkups` derivation; recommend a `useMarkupStore` selector that returns total markup count or `> 0` boolean.) `isSaving` covers the Save-in-flight window from Phase 4.1; export should not race a save. If we need an analogous `isExporting` state to prevent double-trigger of export itself, add it to `projectStore` mirroring `isSaving`.

### Post-Export Feedback

- **D-20:** Successful export fires `ConfirmationToast` with text `Exported: {filename}` (basename only, no full path). Reuses existing parent-owned-lifecycle pattern from save-success. No `Open file` or `Reveal in folder` actions in the toast.
- **D-21:** Failed export (e.g., disk full, file locked by Excel) fires an error toast or modal with the OS error message; does NOT crash the app. Mirror Phase 4.1 error handling on `file:writeProject`. Specifically: the IPC handler returns a discriminated union `{ ok: true, filePath } | { ok: false, reason: string }`; renderer surfaces `reason` in a toast or `OpenErrorModal`-style modal.

### Architecture & IPC

- **D-22:** Aggregation runs in the renderer (testable via Vitest, no IPC for the pure-math step). New helper `src/renderer/src/lib/boq-aggregator.ts` produces a normalized in-memory BOQ structure: `{ metadata, categories: [{ name, items: [{ label, quantity, uom, color }], subtotals: [{ uom, total }] }], grandTotals: [{ uom, total }] }`. This intermediate shape is the SINGLE source of truth that both the XLSX and CSV writers consume — no divergent code paths between formats.
- **D-23:** XLSX byte assembly runs in main (ExcelJS workbook → buffer). CSV byte assembly may live in either main or renderer (CSV is plain text — recommend renderer for symmetry of testing, then send the string to main for atomic write). Disk write happens in main using the same atomic `.tmp` + `rename` pattern as `atomicWriteFile` in `ipc-handlers.ts`. Send the in-memory BOQ structure (normalized JS object) over IPC; main owns the format-specific writers.
- **D-24:** New IPC channels:
  - `dialog:saveExport(defaultPath, format)` → `string | null` — opens the save dialog with `.xlsx` / `.csv` filters; returns the chosen path with the correct extension enforced, or `null` on cancel.
  - `file:writeBoqXlsx(filePath, boqStructure)` → `{ ok: true } | { ok: false, reason }` — main builds the ExcelJS workbook from the BOQ structure and atomic-writes the bytes.
  - `file:writeBoqCsv(filePath, boqStructure)` → `{ ok: true } | { ok: false, reason }` — main builds the CSV from the BOQ structure and atomic-writes the bytes (UTF-8, no BOM).
  Triad-pattern updates required in `src/preload/index.ts` and `src/preload/index.d.ts`.

### Claude's Discretion

- **Numeric precision**: lengths and areas at 2dp via Excel cell format; underlying value is full-precision so SUM() works correctly. Counts as integers. CSV uses the 2dp display number (since CSV has no formatting).
- **Sort order within category**: alphabetical by row label (the post-suffix string). Categories follow `categoryOrder`.
- **Subtotal granularity** for mixed-UoM categories: prefer one subtotal row per UoM within a category — keeps SUMIF in Excel/CSV friendly.
- **Metadata field order and labels**: 5 rows above the table, single column (`A:`); recommend `Project: {name}`, `Plan: {pdf-filename}`, `Exported: {date}`, `Pages: {N}`, `Markups: {M}`, then blank, then table.
- **Sheet name**: `BOQ` (constant — a future v2 multi-sheet variant could use 'Counts', 'Linear', etc., but v1 is single sheet).
- **Color cell scope**: `Item`-cell only (not full row, not category heading).
- **CSV line-ending**: `\r\n` for Windows-friendly tools (Excel, PlanSwift) — match the platform constraint that the app is Windows-desktop-only (`PROJECT.md`).
- **Column widths**: use ExcelJS auto-fit-ish sizing — set sensible defaults: `Item` ~36 chars, `Quantity` ~12 chars, `UoM` ~8 chars. Don't ship without column widths set; default ExcelJS columns are too narrow.
- **`Download` icon import**: lucide-react. Verify the icon exists in the version pinned (`lucide-react ^1.6.0` in `package.json`).
- **`enforceXlsxExtension` / `enforceCsvExtension` helpers**: mirror the existing `enforceClmcExtension` shape in `project-io.ts`.
- **Aggregation structure ID generation**: not needed (the aggregator output is throwaway, consumed and rendered immediately — no persistence).
- **ExcelJS Node-22 / Electron-35 verification**: STATE.md flagged "Verify ExcelJS 4.4.0 compatibility with Node 22 (bundled with Electron 35) before Phase 5". Researcher must verify before planning. If incompatible, fall back to a known-good ExcelJS version or pivot to `xlsx` (SheetJS CE) — but the latter has weaker formatting support and would change D-10/D-11/D-12.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — **EXPRT-01** (xlsx export with item/qty/UoM and category grouping) and **EXPRT-02** (CSV with same structure). Both must pass by end of phase.
- `.planning/ROADMAP.md` Phase 5 — Goal text and 3 success criteria (item-name + numeric quantity + UoM, category grouping, numeric Excel cells with working SUM()).

### Locked Architectural Decisions (do not revisit)
- `.planning/STATE.md` §Key Decisions — **`ExcelJS 4.4.0`** is the locked .xlsx writer. Don't pivot to SheetJS without explicit replan.
- `.planning/STATE.md` §Key Decisions — **All markup coordinates stored in PDF page space (normalized 0.0–1.0)** — aggregator must convert pixel measurements to real-world units via the existing scale-math helpers, never raw pixel coordinates.
- `.planning/STATE.md` §Key Decisions — **mm-based canonical scale storage (`pixelsPerMm`)** — converts to user-facing units via `MM_PER_UNIT` lookup; aggregator depends on this.
- `.planning/STATE.md` §Open Questions — **"Verify ExcelJS 4.4.0 compatibility with Node 22 (bundled with Electron 35) before Phase 5"** — research flag. Resolve before planning.

### Prior-Phase Context (relevant data shapes & supersedes)
- `.planning/phases/03-markup-tools-and-editing/03-CONTEXT.md` — markup types, category system. **Note:** D-08 (category-driven color) was superseded by Phase 03.1 D-26/D-29 — color is per-name-group, not per-category. Categories survive purely as BOQ grouping labels.
- `.planning/phases/03.1-markup-gap-closure-and-visual-redesign/03.1-CONTEXT.md` — D-26/D-27/D-29: `Markup.color` is the authoritative visual field. `Category.name` is the only category property the BOQ uses; `category.color` has been stripped from render and must NOT influence the BOQ layout.
- `.planning/phases/04-project-persistence/04-CONTEXT.md` — D-06: categories serialize with full `{id, name, color, paletteIndex}` records + `categoryOrder`. **This decision exists specifically to drive Phase 5 BOQ grouping.**
- `.planning/phases/04.1-zip-embedded-clmc/04.1-CONTEXT.md` — `pdf.originalFilename` is the authoritative source for "what plan does this BOQ refer to" in the metadata header. `currentFilePath` is the source for the project-basename in the default Export filename.

### Source Type & Store Definitions (data model reference)
- `src/renderer/src/types/markup.ts` — `Markup`, `Category`, `MarkupCommand`, `CountMarkup` discriminator. `Markup.color` is the canonical color field. `BaseMarkup.name` (string) is the BOQ row key together with `BaseMarkup.type`.
- `src/renderer/src/types/scale.ts` — `PageScale { pixelsPerMm, displayUnit }`, `ScaleUnit`, `MM_PER_UNIT`, `DEFAULT_UNIT`. `ScaleUnit` is the type for the BOQ UoM column for length and (with `²` suffix) area.
- `src/renderer/src/stores/markupStore.ts` — `pageMarkups: Record<number, Markup[]>`, `categories: Record<string, Category>`, `categoryOrder: string[]`, `getColorForName(name, page?)` (used for D-13 color cell fill), `findCategoryByName`, `getMarkups(page)`. The aggregator iterates these directly.
- `src/renderer/src/stores/scaleStore.ts` — `pageScales: Record<number, PageScale>`, `globalUnit`. The aggregator reads `globalUnit` for D-04 and `pageScales[p]` for the D-06 uncalibrated-page check.
- `src/renderer/src/stores/viewerStore.ts` — `totalPages`, `currentPage`. Phase 4.1: `pdfBytes` is in-memory but NOT needed by export (BOQ is metadata + markups only). NOT used by aggregator.
- `src/renderer/src/stores/projectStore.ts` — `currentFilePath`, `isSaving`, `setSaved`. Add `isExporting: boolean` if needed for D-19 disable race protection (planner's call).

### Math & Scale Helpers (reuse, don't reinvent)
- `src/renderer/src/lib/markup-math.ts` — `polylineLength(points)`, `polygonArea(points)`, `pixelLengthToReal(pixelLen, pixelsPerMm, unit)`, `pixelAreaToReal(pixelArea, pixelsPerMm, unit)`. The aggregator composes these per-markup.
- `src/renderer/src/lib/scale-math.ts` — `MM_PER_UNIT` and `fromMm(mm, unit)`. Used transitively via `pixelLengthToReal` / `pixelAreaToReal`.

### IPC / Main-Process Patterns (extend)
- `src/main/ipc-handlers.ts` — extend with `dialog:saveExport`, `file:writeBoqXlsx`, `file:writeBoqCsv`. Use the same `atomicWriteFile` helper. Use the same `bufToU8` / `u8ToBuf` zero-copy view helpers if any byte-level work crosses the boundary.
- `src/main/project-io.ts` — extend with `enforceXlsxExtension(path)` / `enforceCsvExtension(path)` helpers, mirroring `enforceClmcExtension`. ExcelJS workbook construction lives here too (export a `buildBoqXlsx(structure): Promise<Buffer>` function called by the IPC handler).
- `src/preload/index.ts` + `src/preload/index.d.ts` — extend `window.api` triad with `saveExportDialog`, `writeBoqXlsx`, `writeBoqCsv` methods.

### UI Patterns (reuse)
- `src/renderer/src/components/Toolbar.tsx` — add `Download`-icon `IconButton` after `Replace Plan PDF`; same disabled wiring as `replaceDisabled` plus the markup-count guard. **Lines ~244–267** for the file-action cluster.
- `src/renderer/src/components/ConfirmationToast.tsx` — parent-owned-lifecycle pattern; reuse for the `Exported: {filename}` toast.
- `src/renderer/src/components/ScalePopup.tsx` / `MarkupNamePopup.tsx` — inline modal styling for the **uncalibrated-pages warning modal** (D-06). Same dark-theme `COLORS` constants. Buttons: Continue / Cancel.
- `src/renderer/src/components/OpenErrorModal.tsx` — pattern to mirror for export-failure surface (D-21).
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — `isTextInputActive()` helper already exported. Register `Ctrl+Shift+E` here alongside existing `Ctrl+S` / `Ctrl+Shift+S` / `Ctrl+O` / `Ctrl+Z` / `Ctrl+Y`.
- `src/renderer/src/hooks/useProject.ts` — current home for save/open orchestration; the export orchestration hook (`useExport`) likely belongs alongside or inside `useProject`. Planner's call: a separate `useExport` keeps export concerns isolated; folding into `useProject` keeps all file-IO in one hook.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `markupStore.getColorForName(name)` — returns the most-recent markup color for a name across the whole project (Phase 03.1). Direct fit for D-13 color cell fill in the aggregator.
- `markupStore.categoryOrder` + `markupStore.categories` — already preserves user's category creation order; D-11 uses this directly.
- `pixelLengthToReal` / `pixelAreaToReal` in `markup-math.ts` — already tested. Aggregator composes them with `pageScales[p].pixelsPerMm` and `globalUnit`.
- `polylineLength` / `polygonArea` — already tested. Used unchanged.
- `atomicWriteFile` in `ipc-handlers.ts` — write-then-rename pattern; reuse for both XLSX and CSV writes (an estimator's BOQ matters as much as their `.clmc` — atomic write justified).
- `enforceClmcExtension` in `project-io.ts` — pattern to copy for `enforceXlsxExtension` / `enforceCsvExtension`.
- `ConfirmationToast` — unchanged; supports the post-export success toast.
- `IconButton` in `Toolbar.tsx` — supports the new `Export` button with zero refactoring.
- `useKeyboardShortcuts.ts` `isTextInputActive()` — guard for `Ctrl+Shift+E`.
- `dialog.showSaveDialog` pattern — already used in `dialog:saveProject`. Same shape with `.xlsx` / `.csv` filters.

### Established Patterns
- **IPC triad**: every new IPC surface requires changes to `ipc-handlers.ts` (main) + `preload/index.ts` (bridge) + `preload/index.d.ts` (types). No exceptions.
- **Atomic write**: `.tmp` + rename + cleanup-on-failure for any persistent file write.
- **Discriminated-union IPC results**: `{ ok: true, ... } | { ok: false, reason: string }` (see `ReadProjectResult`); apply to export write IPC for D-21 error surfacing.
- **Zustand selectors**: primitive-field selectors with stable fallbacks (commit `0e1a8e0` pattern). The export hook subscribes to `currentFilePath`, `isSaving`, `globalUnit`, `categoryOrder` — all primitives or arrays; no method-invocation in selectors.
- **Parent-owned lifecycle for transient UI** (toast, popup, warning modal). The component mounting the toast/modal owns its dismissal.
- **COLORS constants**: all UI chrome reads from `lib/constants.ts COLORS`; export modal styling follows.
- **Inline-style components on canvas-adjacent UI** — Toolbar, modals, popups all use inline styles. No Tailwind in the chrome path.
- **Module-level ref pattern** — not needed for export; the hook + IPC API is sufficient.
- **`isSaving` disable pattern** (Phase 4.1) — reuse for the Export button's disabled state during save-in-flight; `isExporting` mirror for the export's own in-flight window if added.

### Integration Points
- `Toolbar.tsx` lines ~244–267 — insert `Export` `IconButton` after `Replace Plan PDF`. Disabled wiring: `replaceDisabled || zeroMarkups`. New `onExportClick` prop passed from `App.tsx` (mirror the `onOpenClick` / `onReplaceClick` pattern — orchestration owned by `App.tsx` so the dirty-guard / error-routing stays in one place; **see `04-CONTEXT.md` Reusable Assets for why the Toolbar must NOT call `useProject().exportBoq` directly if the result needs routing**).
- `useKeyboardShortcuts.ts` — register `Ctrl+Shift+E` with the same guard pattern.
- `App.tsx` — add the export-orchestration handler (calls the aggregator → opens the dialog → writes via IPC → shows toast or routes errors). Same shape as the existing Save / Replace flow.
- `markupStore.ts` — no changes needed. Optionally add a `totalMarkupCount: () => number` selector or compute inline; keeps the Toolbar disable check cheap.
- `projectStore.ts` — optionally add `isExporting: boolean` field with `setExporting(bool)` action (mirrors `isSaving`).
- `ipc-handlers.ts` — three new handlers (`dialog:saveExport`, `file:writeBoqXlsx`, `file:writeBoqCsv`).
- `preload/index.ts` + `preload/index.d.ts` — three new `window.api` methods.
- `project-io.ts` (or new `boq-export.ts` file in `src/main/`) — ExcelJS workbook builder (`buildBoqXlsx`), CSV string builder (`buildBoqCsv`), extension enforcers.
- New `src/renderer/src/lib/boq-aggregator.ts` — pure function: `(markupStore, scaleStore, projectStore, viewerStore) → BoqStructure`. Vitest-tested in isolation.
- New `src/renderer/src/components/UncalibratedExportWarningModal.tsx` — D-06 warning modal. Mirrors `ScalePopup` / `OpenErrorModal` styling.
- New `src/renderer/src/hooks/useExport.ts` (or fold into `useProject.ts`) — orchestration hook.

</code_context>

<specifics>
## Specific Ideas

- **"Ready to paste into a bid sheet"** — the success bar is not just "produces a .xlsx" but "the estimator opens the file and the BOQ is already shaped the way they'd hand it off." That's why the metadata header, frozen header row, bold category headings, subtotals, and grand total all matter. The XLSX is a deliverable artifact, not a debug dump.
- **"BOQ" in the filename, not "takeoff"** — universally-understood term in construction estimating; the app name is the only place the word "Takeoff" should appear.
- **Counts have no unit** — `ea` (each) is the convention; it doesn't depend on calibration; export normally even on uncalibrated pages.
- **"Light Switches are blue"** — color in the BOQ comes from the per-name-group `Markup.color`. Same color the user sees on the canvas. The Item-cell fill is the visual bridge between canvas and spreadsheet — the BOQ is recognizable as "yes, that's my takeoff."
- **Subtotals must respect UoM** — summing `5 ea` with `12 m` is meaningless. Where a category mixes types, multiple subtotal rows (one per UoM) is the safe move. SUMIF-friendly in CSV downstream.
- **CSV is for round-tripping** — opens in Excel/Sheets/Numbers identically to other CSVs; no BOM, RFC 4180 quoting, `\r\n` line endings. The structural mirror with XLSX means an estimator can copy-paste from one to the other if needed without restructuring.

</specifics>

<deferred>
## Deferred Ideas

### To future phases (or v2)
- **Custom Excel template matching** — user provides their own .xlsx template; export fills it. v2 EXPRT-03; explicit out-of-scope per PROJECT.md key decision.
- **Item library / preset names** — v2 LIB-01; reuse named items across projects. Would change the BOQ's `name` column shape (canonical IDs vs free-text). Out of scope for v1.
- **Multiple worksheets per export** (Counts / Linear / Area / Perimeter as separate sheets) — single-sheet v1 covers the success criteria. Multi-sheet is a polish upgrade if user feedback asks.
- **Page-level breakdown alongside aggregate totals** — user picked aggregate-by-name across the whole project. Per-page sub-breakdown was an explicit option and was rejected. Revisit if estimators ask for it (v2 candidate; multi-tab with a "By Page" sheet).
- **Per-individual-markup audit log export** — every count pin / shape on its own row, no aggregation. Rejected for the BOQ but useful for verification — could be a hidden "Audit" sheet or a separate menu item in v2.
- **PDF export of the BOQ** — printable bid sheet variant. Out of scope; users print the .xlsx from Excel.
- **Quantity precision setting** — currently 2dp by Claude's discretion. A user-facing precision control (1dp / 2dp / 3dp / Round) is a v2 polish.
- **"Open file" / "Reveal in folder" buttons in the export toast** — explicitly rejected for simplicity. Revisit if users ask for it.
- **Application menu bar** — explicitly rejected; Toolbar + keyboard shortcut covers the export trigger.
- **Excel cell styling beyond what's specified** — no chart, no conditional formatting, no per-cell borders; trusted defaults from the chosen polish set.
- **Live BOQ preview before export** — Phase 6 (VIEW-01) running totals panel covers this need. Once live totals exist, "Export" is just "snapshot the panel."

</deferred>

---

*Phase: 05-boq-export*
*Context gathered: 2026-05-02*
