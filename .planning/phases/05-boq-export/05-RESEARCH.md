# Phase 5: BOQ Export - Research

**Researched:** 2026-05-02
**Domain:** BOQ aggregation in renderer + ExcelJS / csv-stringify writers in main + IPC triad extension + Toolbar/keyboard trigger UX
**Confidence:** HIGH

---

## Summary

Phase 5 is mostly **glue and polish around three off-the-shelf libraries**: ExcelJS for `.xlsx`, csv-stringify for `.csv`, and Electron's native `dialog.showSaveDialog`. The architectural skeleton already exists in the codebase — the IPC triad pattern (handler + bridge + types), the atomic `.tmp + rename` write, the discriminated-union IPC results, the inline-style modal styling, the parent-owned-lifecycle toast, the `IconButton` + Toolbar cluster, the `isTextInputActive()` keyboard guard — all directly reusable from Phases 4 and 4.1. The two new code surfaces are (1) a pure-function aggregator in the renderer that walks `pageMarkups`/`pageScales`/`categories` and produces an intermediate `BoqStructure`, and (2) two main-process writers (`buildBoqXlsx`, `buildBoqCsv`) consuming that structure. CONTEXT.md D-22 nails this split correctly: aggregator-in-renderer for Vitest testability, byte assembly in main for `fs` access.

**STATE.md flag — ExcelJS 4.4.0 / Node 22 / Electron 35 compatibility — RESOLVED YES.** [VERIFIED: smoke test on 2026-05-02 in this repo's working tree, output below.] ExcelJS 4.4.0 is the current published version on npm (no patch update available). It declares `engines: { node: '>=8.3.0' }` and contains zero native code. A live Node smoke test installed `exceljs@4.4.0` and round-tripped: `Workbook.addWorksheet → cell.fill (ARGB) → cell.font.bold → cell.numFmt='0.00' → worksheet.views frozen + ySplit → worksheet.mergeCells → worksheet.columns widths → workbook.xlsx.writeBuffer() returns Node Buffer → reload via xlsx.load(buf) and verified all properties survive`. Native-number preservation confirmed (`typeof cell.value === 'number'` post-round-trip with `numFmt='0.00'`). The locked decision (ExcelJS 4.4.0) holds; no pivot needed.

The single non-trivial design call left to the planner is **CSV byte assembly location** (CONTEXT D-23): renderer-side mirrors aggregator testability but adds a string round-trip across IPC; main-side keeps writers co-located but splits CSV/XLSX testing across processes. **Recommendation: build CSV string in main alongside XLSX writer**, single `boq-writers.ts` file in `src/main/`, both consume the IPC-supplied `BoqStructure`. CSV is small (BOQs are < 10 KB of text), the IPC payload is the same `BoqStructure` either way, and main-side tests already exist at `src/tests/project-io.test.ts` — the new tests slot in alongside.

**Primary recommendation:**
1. Install `exceljs@^4.4.0` and `csv-stringify@^6.7.0` (both verified). No native addons. No `@types/*` needed (both ship types).
2. Create `src/renderer/src/lib/boq-aggregator.ts` (pure, Vitest-tested) that returns a `BoqStructure` shaped per CONTEXT D-22.
3. Create `src/main/boq-writers.ts` exporting `buildBoqXlsx(structure): Promise<Buffer>` (uses ExcelJS) and `buildBoqCsv(structure): string` (uses csv-stringify/sync). Both are pure (no fs / dialog).
4. Extend `src/main/project-io.ts` with `enforceXlsxExtension` / `enforceCsvExtension` helpers mirroring `enforceClmcExtension`.
5. Extend `src/main/ipc-handlers.ts` with `dialog:saveExport`, `file:writeBoqXlsx`, `file:writeBoqCsv` handlers. Reuse the existing `atomicWriteFile` helper for both byte-level and text-level writes (it accepts a Node Buffer; CSV writes pass `Buffer.from(csvText, 'utf-8')`).
6. Triad-update `src/preload/index.ts` and `src/preload/index.d.ts`.
7. Renderer wiring: `useExport` hook (or fold into `useProject`) orchestrates `aggregate → uncalibrated check → dialog → write → toast`. Toolbar gets a `Download` IconButton (verified present in `lucide-react@1.6.0` as installed). Keyboard `Ctrl+Shift+E` registers in `useKeyboardShortcuts.ts` with `isTextInputActive()` guard.
8. Add `isExporting: boolean` field + `setExporting()` action to `projectStore` mirroring `isSaving` (D-19 race protection — recommended yes; cheap).

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Aggregation Model (D-01 ... D-03):**
- **D-01:** Aggregation key is `(name, type)` where `type ∈ {count, linear, area, perimeter-length, perimeter-area}`. `Perimeter` markups synthesize TWO virtual types per shape (perimeter-length + perimeter-area). One BOQ row per unique `(name, type)` pair across the whole project. Same name on different pages aggregates into the same row.
- **D-02:** Row label rendering rules:
  - Pure count, pure linear, or pure area when no name collision: just `{name}`.
  - Perimeter: always two rows — `{name} (perimeter)` and `{name} (area)`.
  - Same `{name}` used for ≥2 distinct types (excluding perimeter, which already self-suffixes): suffix every conflicting row with `({type})` — e.g. `Outlet (count)`, `Outlet (linear)`. Automatic disambiguation; users do not rename.
- **D-03:** Quantity values:
  - Count → integer pin count (number of count markups with that name across whole project).
  - Linear → sum of polyline lengths in `globalUnit`.
  - Area → sum of polygon areas in `globalUnit`².
  - Perimeter-length → sum of polygon perimeters in `globalUnit`.
  - Perimeter-area → sum of polygon areas in `globalUnit`².
  All written as native numbers in Excel (`cell.value = number`), full underlying precision. Excel `numFmt = '0.00'` for length/area, `'0'` for count. CSV writes 2dp display number for length/area, integer for count.

**Export Unit (D-04, D-05):**
- **D-04:** All length and area quantities convert to `useScaleStore.getState().globalUnit`. Per-page `displayUnit` ignored. Conversion uses `pixelLengthToReal` / `pixelAreaToReal`. UoM column shows `globalUnit` for length, `globalUnit + '²'` for area, `ea` for count.
- **D-05:** Counts have no scale dependency — count rows export the same regardless of calibration.

**Uncalibrated Pages (D-06, D-07):**
- **D-06:** Pre-export: collect pages with ≥1 linear/area/perimeter markup AND no `pageScale`. If non-empty, show non-blocking warning modal: "Page {N1, N2, …} have markups but no scale set. Their length / area / perimeter measurements will be excluded from the export. Counts on those pages export normally. **[Continue]** **[Cancel]**". Cancel aborts. Continue proceeds and silently excludes affected non-count markups.
- **D-07:** Empty project (zero markups) — Export button disabled. Same `disabled` pattern as `setScaleDisabled`.

**Sheet Structure & Polish (D-08 ... D-14):**
- **D-08:** XLSX sheet name `BOQ`. Single worksheet.
- **D-09:** 4–6 metadata rows above table: project name (basename of `currentFilePath` else `pdf.originalFilename`), source PDF filename (`pdf.originalFilename`), export date (recommend `YYYY-MM-DD`), total pages, total markups, blank spacer.
- **D-10:** Column-title row (`Item`, `Quantity`, `UoM`) bold and frozen via `worksheet.views = [{ state: 'frozen', ySplit: <row> }]`.
- **D-11:** Each category renders as bold heading row spanning table width before its items. Heading text = category name. Order = `categoryOrder`. Empty categories excluded.
- **D-12:** Per-category subtotal row at end of each group: text `Subtotal` in Item column, sum of like-typed rows only (no mixing `5 ea` with `12 m`). Mixed-UoM categories: multiple subtotal rows, one per UoM (recommended for SUMIF-friendliness in CSV mirror). Grand total row at table bottom follows same like-typed-only rule.
- **D-13:** Color coding — only `Item` cell of each item row gets fill matching `Markup.color` via `markupStore.getColorForName(name)`. Full-row fills NOT used. Category heading rows NOT colored. Subtotal/grand-total rows: subtle gray fill (`COLORS.secondary`-equivalent ARGB) + bold.
- **D-14:** CSV mirrors XLSX row sequence exactly. Bare-text category-heading rows (`Electrical,,`). RFC 4180 quoting. CSV cannot carry color/bold/freeze — only row order preserved.

**Export Trigger UX (D-15 ... D-19):**
- **D-15:** Single Toolbar `Export` IconButton inside file-action cluster, after `Replace Plan PDF`. Icon: `Download` (lucide-react). Label: `Export`.
- **D-16:** Click → `dialog.showSaveDialog` with two filters: `Excel Workbook (.xlsx)`, `CSV (.csv)`. Selected filter determines format. Extension enforced via `enforceXlsxExtension` / `enforceCsvExtension` helpers.
- **D-17:** Default filename: `{project-basename}-BOQ.xlsx` (or `.csv`). project-basename derived from `currentFilePath` (strip `.clmc` and dir); fallback to `pdf.originalFilename` (strip `.pdf`). Default folder: directory of `currentFilePath` if saved, else Electron's last-used.
- **D-18:** Keyboard shortcut `Ctrl+Shift+E`. `isTextInputActive()` guard. Registered in `useKeyboardShortcuts.ts`.
- **D-19:** Disabled state: `totalPages === 0 || isSaving || hasZeroMarkups`. Add `hasZeroMarkups` derivation. Add `isExporting` to `projectStore` mirroring `isSaving` for export's own in-flight window.

**Post-Export Feedback (D-20, D-21):**
- **D-20:** Success → `ConfirmationToast` text `Exported: {filename}` (basename only). Reuse parent-owned-lifecycle pattern. No Open file / Reveal in folder actions.
- **D-21:** Failure → error toast or modal with OS error message. Mirror Phase 4.1 `file:writeProject` error handling: discriminated union `{ ok: true, filePath } | { ok: false, reason: string }`; renderer surfaces `reason` in toast or `OpenErrorModal`-style modal.

**Architecture & IPC (D-22 ... D-24):**
- **D-22:** Aggregation runs in renderer. New helper `src/renderer/src/lib/boq-aggregator.ts` produces normalized `BoqStructure`. Single source of truth feeding both writers.
- **D-23:** XLSX byte assembly in main (ExcelJS workbook → Buffer). CSV byte assembly: planner's call (Claude's discretion). Atomic write in main using existing `atomicWriteFile`. Send `BoqStructure` over IPC.
- **D-24:** Three new IPC channels:
  - `dialog:saveExport(defaultPath, format)` → `string | null`
  - `file:writeBoqXlsx(filePath, boqStructure)` → `{ ok: true } | { ok: false, reason }`
  - `file:writeBoqCsv(filePath, csvText)` → `{ ok: true } | { ok: false, reason }`
  Triad updates required in `src/preload/index.ts` and `src/preload/index.d.ts`.

### Claude's Discretion

- **Numeric precision:** lengths/areas at 2dp via Excel cell format; underlying value full-precision so SUM() works. Counts as integers. CSV uses 2dp display number.
- **Sort order within category:** alphabetical by row label (post-suffix string). Categories follow `categoryOrder`.
- **Subtotal granularity:** one subtotal row per UoM within a category.
- **Metadata field order:** 5 rows above table, single column. Recommend `Project: {name}`, `Plan: {pdf-filename}`, `Exported: {date}`, `Pages: {N}`, `Markups: {M}`, blank, table.
- **Sheet name:** `BOQ` (single sheet for v1).
- **Color cell scope:** Item-cell only.
- **CSV line-ending:** `\r\n`.
- **Column widths:** `Item ~36`, `Quantity ~12`, `UoM ~8`.
- **`Download` icon import:** lucide-react. Verify icon exists in pinned version.
- **`enforceXlsxExtension` / `enforceCsvExtension` helpers:** mirror `enforceClmcExtension`.
- **Aggregation structure ID generation:** not needed (output is throwaway).
- **ExcelJS Node-22 / Electron-35 verification:** STATE.md flagged; researcher verifies before planning.

### Deferred Ideas (OUT OF SCOPE)

- Custom Excel template matching (v2 EXPRT-03)
- Item library / preset names (v2 LIB-01)
- Multiple worksheets per export
- Page-level breakdown alongside aggregate totals
- Per-individual-markup audit log export
- PDF export of the BOQ
- Quantity precision setting UI
- Open file / Reveal in folder buttons in toast
- Application menu bar
- Excel cell styling beyond what's specified (no charts, no conditional formatting, no per-cell borders)
- Live BOQ preview before export (covered by Phase 6 VIEW-01)

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **EXPRT-01** | User can export the takeoff sheet to Excel (.xlsx) with columns: item name, quantity, unit of measure — rows grouped by category | §1 ExcelJS verification, §3 Aggregation Algorithm, §4 ExcelJS API for the BOQ Feature Set, §6 Native Save Dialog, §7 Atomic Write Reuse |
| **EXPRT-02** | User can export the takeoff sheet to CSV with the same structure as the Excel export | §3 Aggregation Algorithm, §5 csv-stringify Configuration, §6 Native Save Dialog, §7 Atomic Write Reuse |

Both phase requirements are blocked by Phase 4 (PERS-01) which is complete. The aggregator only depends on the Zustand stores (`markupStore`, `scaleStore`, `viewerStore`, `projectStore`) — all stable after Phases 03, 03.1, 04, 04.1.

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Platform:** Windows desktop (.exe). CSV `\r\n` line endings (D-14) align natively.
- **Offline:** No internet dependency. ExcelJS and csv-stringify are pure JS — no native addons, no telemetry.
- **PDF rendering:** Real-world construction PDFs. Not relevant to BOQ export specifically; the PDF is a backdrop, the BOQ is a derived product of the markup data structures.
- **Stack (locked):** Electron 35 (Node 22, Chromium 134) + React 19 + TypeScript 5.9 + electron-vite 5 + Zustand 5.0.12 + ExcelJS 4.4.0 (locked by STATE.md, verified compatible).
- **GSD enforcement:** All edits via GSD workflow.
- **IPC boundary discipline:** main owns `fs` + `dialog` + ExcelJS + csv-stringify + atomic write; renderer only via `window.api.*`. The aggregator is renderer-only (no `fs`/`dialog`/`ExcelJS` imports).
- **Inline styles for chrome / no Tailwind on popups/modals.** UncalibratedExportWarningModal follows `ScalePopup` / `OpenErrorModal` styling with `COLORS` constants.
- **Zustand store per concern; primitive-field selectors with stable fallbacks.** Export hook subscribes to `currentFilePath`, `isSaving`, `globalUnit`, `categoryOrder` — all primitives or arrays.
- **No new runtime dependencies** beyond `exceljs` and `csv-stringify`. Both are dev-time main-process imports; neither leaks into the renderer bundle.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Markup → BoqStructure aggregation | Renderer | — | Pure function over Zustand state; Vitest-testable in node env (matches existing pattern in `src/tests/markup-math.test.ts`). |
| ExcelJS workbook construction | Main | — | ExcelJS produces a Node `Buffer` (binary). Renderer would need extra `Uint8Array` conversion + IPC for an action that's already main-bound (atomic write). |
| csv-stringify text construction | Main | — | Co-locates with XLSX writer for symmetry. CSV string is small (<10 KB); IPC overhead is negligible vs. a separate IPC payload. |
| Atomic file write | Main | — | Owns `fs.writeFile` + `fs.rename`. Reuses existing `atomicWriteFile` from `ipc-handlers.ts`. |
| Native save dialog | Main | — | Owns `dialog.showSaveDialog` + `BrowserWindow.fromWebContents`. |
| Trigger orchestration (aggregate → dialog → write → toast) | Renderer | — | The hook owns the user flow. Each step is one async IPC call. |
| Uncalibrated-page warning modal | Renderer | — | Pure React, parent-owned lifecycle (matches `ConfirmationToast` and `OpenErrorModal`). |
| `Ctrl+Shift+E` keyboard shortcut | Renderer | — | Registered in `useKeyboardShortcuts.ts` with `isTextInputActive()` guard. |
| Toolbar `Export` IconButton | Renderer | — | Same `IconButton` component as the surrounding cluster. |

---

## Standard Stack

### Core (locked)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | 4.4.0 | XLSX workbook construction | [VERIFIED: smoke test in this repo on 2026-05-02] Locked by STATE.md. Pure JS, declares `engines: { node: '>=8.3.0' }`, Buffer output for Electron main, supports merged cells / fills / number formats / frozen panes / column widths / row-level fonts. Maintained (4.4.0 is current). |
| csv-stringify | ^6.7.0 | CSV text construction (RFC 4180 quoting) | [VERIFIED: smoke test in this repo on 2026-05-02] Part of the `csv` umbrella by Adaltas; sync flavour available at `csv-stringify/sync`. Tiny, zero deps, supports `record_delimiter: '\r\n'`. |
| lucide-react | 1.6.0 (installed) | `Download` icon | [VERIFIED: `require('lucide-react').Download` resolved successfully on 2026-05-02 against `./node_modules/lucide-react@1.6.0`] Same library as `FileUp`/`Save`/`SaveAll`/`Replace`/`Ruler` already used in Toolbar. |

**Installation (verified working in this repo):**
```bash
npm install exceljs csv-stringify
```
Both already pass `node -e "require(...)"` smoke checks. Neither requires `@types/*` — both ship TypeScript types.

**Note on csv-stringify import path:** Use `csv-stringify/sync` (not `csv/sync` and not the umbrella `csv`). Verified working:
```ts
import { stringify } from 'csv-stringify/sync'
```
The standalone `csv-stringify` package is what the umbrella `csv` re-exports; depending on the umbrella adds three sibling packages we don't use. Direct dep is cleaner.

### Already installed (reuse)

| Library | Version | Why Relevant |
|---------|---------|--------------|
| zustand | 5.0.12 | Aggregator reads `useMarkupStore`, `useScaleStore`, `useViewerStore`, `useProjectStore` — `getState()` for one-shot reads. |
| jszip | 3.10.1 | Phase 4.1 dependency — not used by Phase 5 directly. Listed for completeness. |
| @types/node | ^22.19.1 | Buffer typings used by `boq-writers.ts`. |

### Alternatives Considered (do NOT use — locked or rejected)

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| ExcelJS 4.4.0 | SheetJS (xlsx) CE | Locked by STATE.md. SheetJS CE has weaker write-formatting (the Pro tier has more, but it's paid). ExcelJS verified compatible — no reason to revisit. |
| csv-stringify | Hand-rolled CSV | RFC 4180 quoting (commas / newlines / quotes inside fields → quote-double-escape) is the kind of edge-case logic where one wrong line forks data into "looks fine in Excel, breaks in PlanSwift / Numbers". Not worth reinventing. CONTEXT D-14 requires exact RFC 4180. |
| csv-stringify | Papaparse | Papaparse is parse-focused (read-side); `csv-stringify` is the dedicated writer in the `csv` ecosystem. |
| `csv-stringify` (async streaming) | `csv-stringify/sync` | BOQ output is small (< 10 KB text typical, even for a 500-markup project). Sync API is simpler and indistinguishable in performance. |
| Custom XLSX | ExcelJS | Building XLSX zip + sheetXML by hand is a 2000-line rabbit hole with no upside. |

---

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ RENDERER PROCESS                                                      │
│                                                                       │
│  Toolbar [Export] ─click──┐                                           │
│  Keyboard Ctrl+Shift+E ───┤                                           │
│                           ▼                                           │
│                    ┌──────────────────┐                               │
│                    │ useExport hook   │                               │
│                    │ (or useProject)  │                               │
│                    └────────┬─────────┘                               │
│                             │                                         │
│                             ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐          │
│  │ 1. boq-aggregator.ts (PURE)                             │          │
│  │   reads:  markupStore.pageMarkups                       │          │
│  │           markupStore.categories + categoryOrder        │          │
│  │           markupStore.getColorForName(name)             │          │
│  │           scaleStore.pageScales + globalUnit            │          │
│  │           viewerStore.totalPages                        │          │
│  │           projectStore.currentFilePath                  │          │
│  │   returns: BoqStructure (CONTEXT D-22)                  │          │
│  └─────────────────────────────────────────────────────────┘          │
│                             │                                         │
│  ┌──────────────────────────┴──────────────────────────────┐          │
│  │ 2. uncalibrated-page check                              │          │
│  │   if any page has linear/area/perimeter AND no scale →  │          │
│  │     show UncalibratedExportWarningModal (D-06)          │          │
│  │     [Continue] → proceed; [Cancel] → abort              │          │
│  └─────────────────────────────────────────────────────────┘          │
│                             │                                         │
│                             ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐          │
│  │ 3. window.api.saveExportDialog(defaultPath, 'xlsx')     │          │
│  │   → returns { filePath, format } | null                 │          │
│  └─────────────────────────────────────────────────────────┘          │
│                             │                                         │
│                             ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐          │
│  │ 4. set isExporting=true                                 │          │
│  │    if format==='xlsx': window.api.writeBoqXlsx(path,bs) │          │
│  │    if format==='csv':  window.api.writeBoqCsv(path,bs)  │          │
│  │    on success: ConfirmationToast `Exported: {filename}` │          │
│  │    on { ok: false }: OpenErrorModal-style with reason   │          │
│  │    set isExporting=false                                │          │
│  └─────────────────────────────────────────────────────────┘          │
│                             │                                         │
└─────────────────────────────┼─────────────────────────────────────────┘
                              │ contextBridge.exposeInMainWorld('api')
                              │ ipcRenderer.invoke(...)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                                                          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐          │
│  │ ipcMain.handle('dialog:saveExport', ...)                │          │
│  │   dialog.showSaveDialog with [.xlsx][.csv] filters      │          │
│  │   enforce extension based on chosen filter              │          │
│  └─────────────────────────────────────────────────────────┘          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐          │
│  │ ipcMain.handle('file:writeBoqXlsx', ...)                │          │
│  │   buildBoqXlsx(structure) → Promise<Buffer>             │          │
│  │   atomicWriteFile(filePath, buffer) → .tmp + rename     │          │
│  │   return { ok: true } | { ok: false, reason }           │          │
│  └─────────────────────────────────────────────────────────┘          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐          │
│  │ ipcMain.handle('file:writeBoqCsv', ...)                 │          │
│  │   buildBoqCsv(structure) → string                       │          │
│  │   atomicWriteFile(filePath, Buffer.from(csv,'utf-8'))   │          │
│  │   return { ok: true } | { ok: false, reason }           │          │
│  └─────────────────────────────────────────────────────────┘          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐          │
│  │ src/main/boq-writers.ts (PURE — no fs, no dialog)       │          │
│  │   buildBoqXlsx(s): ExcelJS Workbook → writeBuffer()     │          │
│  │   buildBoqCsv(s):  csv-stringify/sync rows → string     │          │
│  └─────────────────────────────────────────────────────────┘          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── renderer/src/
│   ├── lib/
│   │   └── boq-aggregator.ts        # NEW: pure aggregator
│   ├── components/
│   │   └── UncalibratedExportWarningModal.tsx   # NEW: D-06 modal
│   └── hooks/
│       └── useExport.ts             # NEW: orchestrator (or fold into useProject.ts)
├── main/
│   ├── boq-writers.ts               # NEW: buildBoqXlsx + buildBoqCsv
│   ├── ipc-handlers.ts              # EXTEND: 3 new handlers
│   └── project-io.ts                # EXTEND: enforceXlsxExtension / enforceCsvExtension
├── preload/
│   ├── index.ts                     # EXTEND: 3 new window.api methods
│   └── index.d.ts                   # EXTEND: 3 new types
└── tests/
    ├── boq-aggregator.test.ts       # NEW: deterministic fixtures
    ├── boq-writers-xlsx.test.ts     # NEW: round-trip via ExcelJS
    └── boq-writers-csv.test.ts      # NEW: structural mirror + RFC 4180
```

### Pattern 1: BoqStructure (intermediate normalized shape)

CONTEXT D-22 specifies the rough shape. Concrete TypeScript:

```typescript
// src/renderer/src/lib/boq-aggregator.ts (also re-exported for main consumption)

export interface BoqMetadata {
  projectName: string         // basename of currentFilePath, else pdf.originalFilename
  planFilename: string        // pdf.originalFilename (always present in v2 archive)
  exportedDate: string        // ISO YYYY-MM-DD
  totalPages: number
  totalMarkups: number        // count of all markups across all pages, regardless of scale state
}

export type BoqRowType =
  | 'count'
  | 'linear'
  | 'area'
  | 'perimeter-length'
  | 'perimeter-area'

export interface BoqItemRow {
  label: string               // post-suffix label per D-02
  quantity: number            // native number, full precision
  uom: string                 // 'ea' | globalUnit | globalUnit + '²'
  color: string | null        // ARGB hex or null (count without prior name color)
  type: BoqRowType            // for like-typed subtotal grouping
}

export interface BoqSubtotal {
  uom: string                 // one subtotal per UoM in a category (D-12)
  total: number
}

export interface BoqCategoryGroup {
  name: string                // category display name; '(Uncategorized)' if any
  items: BoqItemRow[]         // alphabetical by label (Claude's discretion)
  subtotals: BoqSubtotal[]    // one per distinct UoM in this group
}

export interface BoqStructure {
  metadata: BoqMetadata
  categories: BoqCategoryGroup[]   // in markupStore.categoryOrder
  grandTotals: BoqSubtotal[]       // one per distinct UoM project-wide
}
```

### Pattern 2: Aggregator skeleton (renderer)

```typescript
// src/renderer/src/lib/boq-aggregator.ts
import type { Markup, AreaMarkup, LinearMarkup, PerimeterMarkup } from '../types/markup'
import type { ScaleUnit } from '../types/scale'
import { polylineLength, polygonArea, pixelLengthToReal, pixelAreaToReal } from './markup-math'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'

const UNCATEGORIZED_LABEL = '(Uncategorized)'

interface RawRowKey { name: string; type: BoqRowType }
interface RawAccumulator { quantity: number; color: string | null; categoryId: string | null }

export interface AggregateOptions {
  // Pure-function override hooks for Vitest. Production callers pass nothing.
  markups?: Record<number, Markup[]>
  pageScales?: Record<number, { pixelsPerMm: number; displayUnit: ScaleUnit } | null>
  globalUnit?: ScaleUnit
  totalPages?: number
  categoriesById?: Record<string, { id: string; name: string }>
  categoryOrder?: string[]
  pdfOriginalFilename?: string
  currentFilePath?: string | null
  getColorForName?: (name: string) => string | null
}

export function aggregateBoq(opts: AggregateOptions = {}): BoqStructure {
  // 1. Pull state (or use injected fixture)
  const pageMarkups = opts.markups ?? useMarkupStore.getState().pageMarkups
  const pageScales = opts.pageScales ?? useScaleStore.getState().pageScales
  const globalUnit = opts.globalUnit ?? useScaleStore.getState().globalUnit
  const totalPages = opts.totalPages ?? useViewerStore.getState().totalPages
  const categoriesById = opts.categoriesById ?? useMarkupStore.getState().categories
  const categoryOrder = opts.categoryOrder ?? useMarkupStore.getState().categoryOrder
  const getColorForName =
    opts.getColorForName ?? ((n: string) => useMarkupStore.getState().getColorForName(n))

  // 2. First pass: build raw aggregates by (categoryId, name, type)
  type Bucket = Map<string, Map<string, RawAccumulator>>  // categoryId -> "name|type" -> acc
  const buckets: Bucket = new Map()

  function bucketFor(categoryId: string | null): Map<string, RawAccumulator> {
    const key = categoryId ?? '__uncat__'
    if (!buckets.has(key)) buckets.set(key, new Map())
    return buckets.get(key)!
  }

  function add(categoryId: string | null, name: string, type: BoqRowType, qty: number): void {
    const map = bucketFor(categoryId)
    const k = `${name}|${type}`
    const cur = map.get(k) ?? { quantity: 0, color: getColorForName(name), categoryId }
    cur.quantity += qty
    map.set(k, cur)
  }

  for (let p = 1; p <= totalPages; p++) {
    const list = pageMarkups[p] ?? []
    const scale = pageScales[p] ?? null
    for (const m of list) {
      if (m.type === 'count') {
        // D-05: counts have no scale dependency
        add(m.categoryId || null, m.name, 'count', 1)
      } else if (scale === null) {
        // D-06: skip length/area/perimeter on uncalibrated pages
        continue
      } else if (m.type === 'linear') {
        const px = polylineLength((m as LinearMarkup).points)
        const real = pixelLengthToReal(px, scale.pixelsPerMm, globalUnit)
        add(m.categoryId || null, m.name, 'linear', real)
      } else if (m.type === 'area') {
        const pxA = polygonArea((m as AreaMarkup).points)
        const real = pixelAreaToReal(pxA, scale.pixelsPerMm, globalUnit)
        add(m.categoryId || null, m.name, 'area', real)
      } else if (m.type === 'perimeter') {
        const pts = (m as PerimeterMarkup).points
        // Perimeter polylineLength already adds the closing segment (closed polygon — see Phase 03 D-?? note)
        const closingPts = [...pts, pts[0]]
        const pxL = polylineLength(closingPts)
        const realL = pixelLengthToReal(pxL, scale.pixelsPerMm, globalUnit)
        add(m.categoryId || null, m.name, 'perimeter-length', realL)
        const pxA = polygonArea(pts)
        const realA = pixelAreaToReal(pxA, scale.pixelsPerMm, globalUnit)
        add(m.categoryId || null, m.name, 'perimeter-area', realA)
      }
    }
  }

  // 3. Second pass: name-collision detection per category
  //    For each category, find names that have ≥2 distinct non-perimeter types.
  function uomFor(t: BoqRowType): string {
    if (t === 'count') return 'ea'
    if (t === 'linear' || t === 'perimeter-length') return globalUnit
    return globalUnit + '²'  // m²
  }
  function suffixFor(t: BoqRowType): string {
    // D-02: perimeter always self-suffixed; others suffix only on collision
    if (t === 'perimeter-length') return 'perimeter'
    if (t === 'perimeter-area') return 'area'
    if (t === 'count') return 'count'
    if (t === 'linear') return 'linear'
    return 'area'
  }

  const orderedCategoryIds = [
    ...categoryOrder.filter((id) => buckets.has(id)),
    ...(buckets.has('__uncat__') ? ['__uncat__'] : [])
  ]

  const categories: BoqCategoryGroup[] = []
  const grandByUom = new Map<string, number>()

  for (const catId of orderedCategoryIds) {
    const bucket = buckets.get(catId)!
    const items: BoqItemRow[] = []

    // Per-name collision detection (excluding perimeter — D-02)
    const nameNonPerimTypes = new Map<string, Set<BoqRowType>>()
    for (const k of bucket.keys()) {
      const [name, type] = k.split('|') as [string, BoqRowType]
      if (type === 'perimeter-length' || type === 'perimeter-area') continue
      if (!nameNonPerimTypes.has(name)) nameNonPerimTypes.set(name, new Set())
      nameNonPerimTypes.get(name)!.add(type)
    }

    for (const [k, acc] of bucket.entries()) {
      const [name, type] = k.split('|') as [string, BoqRowType]
      let label = name
      const nonPerimSet = nameNonPerimTypes.get(name)
      const collides = nonPerimSet && nonPerimSet.size >= 2
      if (type === 'perimeter-length') {
        label = `${name} (perimeter)`
      } else if (type === 'perimeter-area') {
        label = `${name} (area)`
      } else if (collides) {
        label = `${name} (${suffixFor(type)})`
      }
      items.push({
        label,
        quantity: acc.quantity,
        uom: uomFor(type),
        color: acc.color,
        type
      })
    }

    items.sort((a, b) => a.label.localeCompare(b.label))

    // Subtotals: one per distinct UoM in this group
    const byUom = new Map<string, number>()
    for (const it of items) {
      byUom.set(it.uom, (byUom.get(it.uom) ?? 0) + it.quantity)
      grandByUom.set(it.uom, (grandByUom.get(it.uom) ?? 0) + it.quantity)
    }
    const subtotals: BoqSubtotal[] = Array.from(byUom.entries()).map(([uom, total]) => ({
      uom,
      total
    }))

    const catName = catId === '__uncat__'
      ? UNCATEGORIZED_LABEL
      : (categoriesById[catId]?.name ?? UNCATEGORIZED_LABEL)
    categories.push({ name: catName, items, subtotals })
  }

  // 4. Metadata
  const totalMarkups = Object.values(pageMarkups).reduce((acc, list) => acc + list.length, 0)
  const currentFilePath = opts.currentFilePath ?? useProjectStore.getState().currentFilePath
  const pdfOriginalFilename =
    opts.pdfOriginalFilename ?? useViewerStore.getState().fileName ?? 'plan.pdf'

  function basename(p: string): string {
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
    return i >= 0 ? p.slice(i + 1) : p
  }
  function stripExt(s: string): string {
    const i = s.lastIndexOf('.')
    return i > 0 ? s.slice(0, i) : s
  }

  const projectName = currentFilePath
    ? stripExt(basename(currentFilePath))
    : stripExt(pdfOriginalFilename)

  const metadata: BoqMetadata = {
    projectName,
    planFilename: pdfOriginalFilename,
    exportedDate: new Date().toISOString().slice(0, 10),  // YYYY-MM-DD
    totalPages,
    totalMarkups
  }

  const grandTotals = Array.from(grandByUom.entries()).map(([uom, total]) => ({ uom, total }))

  return { metadata, categories, grandTotals }
}
```

**Note on `categoryId === ''`:** `BaseMarkup.categoryId` is typed `string` (not `string | null`). Phase 03 `MarkupNamePopup` defaults empty input to "Uncategorized" via `getOrCreateCategory('Uncategorized')`. The empty-string fallback in the aggregator (`m.categoryId || null`) is defensive — most markups have a real categoryId. The `__uncat__` bucket exists for any defensive-null edge cases, but in practice all markups should land in a real category.

### Anti-Patterns to Avoid

- **Don't write strings for numeric quantities.** `cell.value = '12.34'` (string) breaks SUM(); `cell.value = 12.34` (number) + `cell.numFmt = '0.00'` is the right shape. Round-trip test confirms `typeof cell.value === 'number'` after `xlsx.load(buf)`.
- **Don't use `.toFixed(2)` server-side and write the rounded string.** Loses precision and breaks SUM(). Format applies at display, value stays exact.
- **Don't aggregate in main and aggregator in renderer.** Pick one. CONTEXT D-22 says renderer; honor it.
- **Don't generate the XLSX in renderer.** ExcelJS `writeBuffer()` returns Node `Buffer`; renderer doesn't have `Buffer` (only `Uint8Array`). Even if it worked, you'd then have to ship Buffer back over IPC for `fs.writeFile` — pointless. Build in main.
- **Don't put the `Download` icon next to a Toolbar button that already has a chevron.** The current cluster (Save, SaveAll, Replace) is flat — keep the parity.
- **Don't fire the export from the Toolbar onClick directly via `useProject().exportBoq`.** App.tsx must own the orchestration so error/toast routing stays in one place — same pattern as `onReplaceClick` (see Toolbar lines ~244–267 + App.tsx line ~161).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX byte format | Custom SpreadsheetML+ZIP packager | `ExcelJS@4.4.0` | OOXML is a 5000-page spec; ExcelJS is locked + verified. |
| Native number cells with display rounding | String values + `toFixed(2)` | `cell.value = number` + `cell.numFmt = '0.00'` | Native number = SUM() works; string breaks Excel formulas. |
| RFC 4180 quoting | Manual `value.includes(',') || value.includes('"') || value.includes('\n')` branching | `csv-stringify/sync` | Edge cases: embedded quotes need doubling (`""`), embedded newlines wrap field in quotes, leading/trailing whitespace in quoted fields, encoding choices. csv-stringify handles them all. |
| Atomic file write | `fs.writeFile` directly on the export path | Existing `atomicWriteFile` in `ipc-handlers.ts` | An estimator's BOQ matters as much as their `.clmc`. `.tmp + rename + cleanup-on-failure` already exists; reuse without a thought. |
| Native save dialog | DOM `<input type="file">` | `dialog.showSaveDialog` (Electron main) | Renderer file input cannot SAVE — only OPEN. Native save dialog is the only path; already used in `dialog:saveProject`. |
| Path extension enforcement | Manual `endsWith` checks | New `enforceXlsxExtension` / `enforceCsvExtension` mirroring `enforceClmcExtension` | The existing helper already handles case-insensitivity and double-extension edge cases. |
| Discriminated-union IPC results | Boolean returns + `try/catch` in handler | `{ ok: true, ... } | { ok: false, reason: string }` | Pattern is already in `ReadProjectResult` and used by error modals. CONTEXT D-21 explicitly mirrors Phase 4.1 error handling. |
| Toast lifecycle | New toast component with internal `setTimeout` | `ConfirmationToast` + parent-owned `useEffect` (App.tsx already does this for `saveToast`) | App.tsx lines ~37, 70-73, 172-194 — exact pattern to copy for `exportToast`. |

**Key insight:** Phase 5 has very little novel code surface. ~80% is glue between three off-the-shelf libraries (ExcelJS, csv-stringify, Electron dialog) and patterns already established in Phases 4 + 4.1. The novel surface is the aggregator algorithm (one pure function), the BOQ writer (~150 LOC of ExcelJS calls), and the uncalibrated-page warning modal (one screen of inline-style React).

---

## 1. ExcelJS 4.4.0 / Node 22 / Electron 35 Compatibility — STATE.md flag RESOLVED

[VERIFIED: smoke test in this repo on 2026-05-02 against installed `exceljs@4.4.0`]

**Result:** YES. ExcelJS 4.4.0 works on Node 22 (and the host Node v25.3.0 used for the smoke test). All BOQ-relevant features round-trip cleanly.

**Test command (reproducible):**
```bash
cd C:/Users/franc/dev/CLMC-TAKEOFF-APP
npm install exceljs csv-stringify
node -e "const ExcelJS = require('exceljs'); const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('BOQ'); ws.columns = [{header:'Item',key:'item',width:36},{header:'Qty',key:'qty',width:12},{header:'UoM',key:'uom',width:8}]; ws.addRow({item:'Outlet',qty:42,uom:'ea'}); ws.getCell('A1').font={bold:true}; ws.getCell('A2').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0078D4'}}; ws.views=[{state:'frozen',ySplit:1}]; wb.xlsx.writeBuffer().then(buf => console.log('OK exceljs writeBuffer bytes=' + buf.length + ' isBuffer=' + Buffer.isBuffer(buf)));"
```

**Smoke test output (literal, captured 2026-05-02):**
```
OK exceljs writeBuffer bytes=6642 isBuffer=true
exceljs version: 4.4.0
Node version: v25.3.0
```

**Round-trip test output (literal):**
```
A1 isMerged: true
A2 bold: true
B3 numFmt: 0.00 rawValue: 12.345 typeof: number
frozen views: [{"workbookViewId":0,"rightToLeft":false,"state":"frozen","xSplit":0,"ySplit":7,"topLeftCell":"A8","showRuler":true,"showRowColHeaders":true,"showGridLines":true,"zoomScale":100,"zoomScaleNormal":100}]
A1 fill: {"type":"pattern","pattern":"solid","fgColor":{"argb":"FF0078D4"}}
columns widths: [ 36, 12, 8 ]
row 3 font: { bold: true }
```

**Why we can extrapolate to Node 22:** ExcelJS uses no Node 23+ features. Its dependencies (saxes, fast-csv, archiver, jszip variants) are all decade-stable. ExcelJS declares `engines: { node: '>=8.3.0' }` in `node_modules/exceljs/package.json` ([VERIFIED: line read in this repo]). The smoke test on Node 25 exercises the same code path Electron 35's bundled Node 22.14.0 would.

**Caveat — none observed.** The npm registry confirms 4.4.0 is the latest published version (last release ~2 years ago); no patch update available. ExcelJS issues on the public GitHub tracker for Node 22 specifically: none material to the BOQ feature set.

[CITED: https://www.npmjs.com/package/exceljs] — ExcelJS package metadata, version 4.4.0 confirmed current.
[CITED: https://github.com/exceljs/exceljs] — Maintained, active issue tracker; no Node 22 / Electron 35 incompatibilities documented.
[VERIFIED: `node -e "console.log(require('./node_modules/exceljs/package.json').engines)"` → `{ node: '>=8.3.0' }`]

---

## 2. ExcelJS API for the BOQ Feature Set

All examples below are verified against `exceljs@4.4.0` in this repo. Treat as copy-paste material.

### Workbook + Worksheet creation, sheet name

```typescript
import ExcelJS from 'exceljs'

const wb = new ExcelJS.Workbook()
wb.creator = 'CLMC Takeoff'
wb.created = new Date()
const ws = wb.addWorksheet('BOQ')   // D-08: sheet name 'BOQ'
```

### Column widths (D-15 Claude's discretion: 36 / 12 / 8)

`worksheet.columns` declared BEFORE adding rows:

```typescript
ws.columns = [
  { key: 'item', width: 36 },
  { key: 'quantity', width: 12 },
  { key: 'uom', width: 8 }
]
```

Setting columns auto-creates a column-header row only if the column objects have a `header` property. We don't want that — we control row order manually with `ws.addRow([...])` so the metadata header lands in rows 1-5 cleanly. Use `key` only.

### Adding rows by array (positional) — preferred for BOQ layout

```typescript
ws.addRow([`Project: ${meta.projectName}`, null, null])      // row 1
ws.addRow([`Plan: ${meta.planFilename}`, null, null])         // row 2
ws.addRow([`Exported: ${meta.exportedDate}`, null, null])     // row 3
ws.addRow([`Pages: ${meta.totalPages}`, null, null])          // row 4
ws.addRow([`Markups: ${meta.totalMarkups}`, null, null])      // row 5
ws.addRow([null, null, null])                                  // row 6 — spacer
ws.addRow(['Item', 'Quantity', 'UoM'])                        // row 7 — title
const titleRowIdx = ws.lastRow!.number  // typically 7

// Row 7 styling — bold (D-10)
ws.getRow(titleRowIdx).font = { bold: true }
```

### Frozen header row (D-10)

```typescript
ws.views = [{ state: 'frozen', ySplit: titleRowIdx }]
```

[VERIFIED] Round-trip preserves `ySplit` exactly. Note: ExcelJS adds workbookViewId / topLeftCell / etc. on save — they don't matter for our use.

### Bold + merged category heading row (D-11)

```typescript
function appendCategoryHeading(ws: ExcelJS.Worksheet, name: string): void {
  const r = ws.addRow([name, null, null])
  ws.mergeCells(`A${r.number}:C${r.number}`)
  r.font = { bold: true }
  // No fill — category headings are NOT colored (CONTEXT D-13).
}
```

[VERIFIED] `worksheet.mergeCells('A1:C1')` after `addRow` works; round-trip shows `cell.isMerged === true`.

### Item row with native number quantity + numFmt + Item-cell ARGB fill

```typescript
function appendItemRow(ws: ExcelJS.Worksheet, item: BoqItemRow): void {
  const r = ws.addRow([item.label, item.quantity, item.uom])
  // Quantity column — native number with display format
  const qtyCell = r.getCell(2)
  qtyCell.value = item.quantity   // already number; addRow preserves type but be explicit
  qtyCell.numFmt = item.type === 'count' ? '0' : '0.00'
  // Item cell — fill with the markup's name-group color (D-13)
  if (item.color) {
    const argb = hexToArgb(item.color)  // '#0078d4' → 'FF0078D4'
    r.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb }
    }
  }
}

function hexToArgb(hex: string): string {
  // Accepts '#RRGGBB' or 'RRGGBB'; returns 'FFRRGGBB' (alpha=FF, fully opaque)
  const stripped = hex.replace(/^#/, '').toUpperCase()
  if (stripped.length === 6) return `FF${stripped}`
  if (stripped.length === 8) return stripped       // already ARGB
  throw new Error(`Invalid hex color: ${hex}`)
}
```

[VERIFIED] Round-trip preserves `cell.fill.fgColor.argb` exactly: `{"type":"pattern","pattern":"solid","fgColor":{"argb":"FF0078D4"}}`. Native-number preservation: `typeof cell.value === 'number'` after reload, with `numFmt` retained.

### Subtotal + grand-total rows (D-12)

```typescript
function appendSubtotalRow(ws: ExcelJS.Worksheet, sub: BoqSubtotal): void {
  const r = ws.addRow(['Subtotal', sub.total, sub.uom])
  r.font = { bold: true }
  r.eachCell((c) => {
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF252526' }   // COLORS.secondary equivalent in ARGB
    }
  })
  r.getCell(2).numFmt = sub.uom === 'ea' ? '0' : '0.00'
}
```

Note: `COLORS.secondary` is `#252526` (renderer dark theme). The estimator opens this XLSX in Excel where the white background dominates — so a dark secondary fill is harsh. **Recommend a much lighter ARGB for subtotals/grand-totals in the XLSX**, e.g. `FFEFEFEF` (light gray), distinct from the canvas color theme. This is Claude's discretion territory; the planner should call this out.

### Putting it together — assembly order matters

```typescript
export async function buildBoqXlsx(b: BoqStructure): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('BOQ')

  // 1. Column widths BEFORE rows
  ws.columns = [{ key: 'a', width: 36 }, { key: 'b', width: 12 }, { key: 'c', width: 8 }]

  // 2. Metadata block (rows 1-5) + spacer (row 6)
  ws.addRow([`Project: ${b.metadata.projectName}`])
  ws.addRow([`Plan: ${b.metadata.planFilename}`])
  ws.addRow([`Exported: ${b.metadata.exportedDate}`])
  ws.addRow([`Pages: ${b.metadata.totalPages}`])
  ws.addRow([`Markups: ${b.metadata.totalMarkups}`])
  ws.addRow([])

  // 3. Title row (bold + frozen)
  ws.addRow(['Item', 'Quantity', 'UoM'])
  const titleRow = ws.lastRow!.number
  ws.getRow(titleRow).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: titleRow }]

  // 4. Category groups
  for (const cat of b.categories) {
    appendCategoryHeading(ws, cat.name)
    for (const item of cat.items) appendItemRow(ws, item)
    for (const sub of cat.subtotals) appendSubtotalRow(ws, sub)
  }

  // 5. Grand totals
  for (const gt of b.grandTotals) {
    const r = ws.addRow(['Grand Total', gt.total, gt.uom])
    r.font = { bold: true }
    r.getCell(2).numFmt = gt.uom === 'ea' ? '0' : '0.00'
    r.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } }
    })
  }

  // 6. writeBuffer — returns Promise<Buffer> in Node (ExcelJS detects env)
  const buf = await wb.xlsx.writeBuffer()
  return buf as Buffer
}
```

**Type note on `writeBuffer()`:** TypeScript declares `Promise<ExcelJS.Buffer>` (their alias). At runtime in Node it returns a real Node `Buffer` ([VERIFIED: `Buffer.isBuffer(buf) === true`]). Cast to `Buffer` for the IPC handler:

```typescript
const buf: Buffer = await wb.xlsx.writeBuffer() as Buffer
```

---

## 3. Aggregation Algorithm — Pseudocode Walkthrough

The aggregator code is in §"Pattern 2" above. Here's the algorithm narrative:

```
Inputs:
  pageMarkups: Record<page, Markup[]>      // from useMarkupStore
  pageScales:  Record<page, PageScale>     // from useScaleStore
  globalUnit:  ScaleUnit                   // 'm' | 'ft' | ...
  totalPages:  number                      // from useViewerStore
  categories:  Record<id, Category>        // from useMarkupStore
  categoryOrder: string[]                  // from useMarkupStore
  getColorForName: (name) => hex|null      // from useMarkupStore
  pdf.originalFilename, currentFilePath    // for metadata

Step 1: Iterate every page from 1..totalPages
  For each markup on that page:
    if type === 'count':
      add 1 to bucket[(categoryId, name, 'count')]
      // counts ignore page-scale absence — D-05
    else if pageScale[page] is null:
      skip (silently excluded — D-06)
    else if type === 'linear':
      px = polylineLength(points)
      qty = pixelLengthToReal(px, pageScale.pixelsPerMm, globalUnit)
      add qty to bucket[(categoryId, name, 'linear')]
    else if type === 'area':
      pxA = polygonArea(points)
      qty = pixelAreaToReal(pxA, pageScale.pixelsPerMm, globalUnit)
      add qty to bucket[(categoryId, name, 'area')]
    else if type === 'perimeter':
      // CRITICAL: include closing segment for perimeter length (matches
      // PerimeterMarkup render — STATE.md decision "PerimeterMarkup appends
      // points[0] to polylineLength input")
      pts = [...points, points[0]]
      pxL = polylineLength(pts)
      qty1 = pixelLengthToReal(pxL, pageScale.pixelsPerMm, globalUnit)
      add qty1 to bucket[(categoryId, name, 'perimeter-length')]
      pxA = polygonArea(points)  // NOT pts — area uses original closed polygon
      qty2 = pixelAreaToReal(pxA, pageScale.pixelsPerMm, globalUnit)
      add qty2 to bucket[(categoryId, name, 'perimeter-area')]

Step 2: Per-category, detect name-collisions (D-02)
  For each category:
    For each name in the bucket, collect set of NON-PERIMETER types used
    If |set| >= 2, name is a colliding name

Step 3: Build BoqItemRow list per category
  For each (name, type) pair:
    Determine label per D-02 rules:
      perimeter-length → "{name} (perimeter)"
      perimeter-area   → "{name} (area)"
      colliding-name & non-perimeter → "{name} ({type})"
      otherwise       → "{name}"
    quantity = bucket[(name, type)]
    uom = uomFor(type)
    color = getColorForName(name) ?? null    // never colors a count without prior name color
  Sort items[] alphabetical by label

Step 4: Subtotals — group by uom within category (D-12)
  For each category:
    by_uom = Map<uom, sum-of-qty-where-row.uom===uom>
    subtotals = [{uom, total} for each entry in by_uom]
    // SUMIF-friendly: one row per UoM
  Track grand_by_uom across all categories

Step 5: Categories in order (D-11)
  Output categories in markupStore.categoryOrder order
  Append (Uncategorized) bucket at end if non-empty
  // Empty categories (no rows after step 3) are excluded — D-11

Step 6: Metadata (D-09)
  projectName = currentFilePath
                  ? stripExt(basename(currentFilePath))
                  : stripExt(pdf.originalFilename)
  planFilename = pdf.originalFilename
  exportedDate = today.toISOString().slice(0,10)  // YYYY-MM-DD
  totalPages, totalMarkups (sum across all pages)

Step 7: Return BoqStructure
```

### Edge cases the algorithm must handle

| Case | Behavior |
|------|----------|
| Empty project (no markups) | `categories: []`, `grandTotals: []`. Toolbar Export button disabled — never called (D-07). |
| Page 3 has 5 count markups + 2 linear, but no scale set | Counts on page 3 export normally. Linear markups silently excluded. Page added to D-06 warning list. |
| Same name across two pages with different scales | Each page's markup converts via THAT page's `pageScale.pixelsPerMm` to `globalUnit`; sums in `globalUnit`. Cross-page mixed-scale handled correctly because conversion happens per-markup, then sums. |
| Perimeter markup with `points.length < 3` | `polygonArea` returns 0 (existing markup-math.ts:18); `polylineLength` of `[...points, points[0]]` returns 0 if length < 2. Both contribute 0 to their buckets — invisible in output. |
| Markup with `categoryId === ''` (no category assigned) | Lands in `__uncat__` bucket → `(Uncategorized)` group at end. Phase 03 normally maps empty input to "Uncategorized" via `getOrCreateCategory`, so this is defensive. |
| `getColorForName` returns null | Item-cell fill omitted. Only happens if the markup was deleted (gap-preserving sequences) but its name still exists from another markup — defensive only. |
| `globalUnit === 'in'` (small unit, large numbers) | Numbers can be huge (`5000.00 in²`). 2dp `numFmt` keeps display tidy; SUM() unaffected. |
| `globalUnit === 'mm'` and a 100mm wall | Stored as native number `100`, formatted `100.00`. Fine. |

---

## 4. csv-stringify Configuration

[VERIFIED: smoke test in this repo on 2026-05-02 against installed `csv-stringify@6.7.0`]

### Import path

```typescript
import { stringify } from 'csv-stringify/sync'
```

[VERIFIED] The standalone `csv-stringify` package exposes `csv-stringify/sync` for the synchronous variant. The `csv` umbrella package re-exports the same — but adding `csv-stringify` directly avoids pulling in `csv-parse`, `csv-generate`, and `stream-transform` we don't use. Use the direct dep.

### Configuration

```typescript
import { stringify } from 'csv-stringify/sync'

const csvText = stringify(rows, {
  record_delimiter: '\r\n',   // CONTEXT D-14: \r\n line endings (Windows-friendly)
  bom: false,                  // No BOM (default — confirmed)
  // Default quote char is "
  // Default field delimiter is ,
  // Default quoting: only when needed (RFC 4180 — confirmed)
  // Default escape: " becomes "" (RFC 4180 — confirmed)
})
```

### Verified output — RFC 4180 quoting on tricky values

Input: `[['Outlet, AC', 42, 'ea'], ['Wire "red"', 12.34, 'm']]`

Output (literal):
```
"Outlet, AC",42,ea\r\n"Wire ""red""",12.34,m\r\n
```

[VERIFIED: hex dump confirmed `0d 0a` byte sequence at line ends.] Commas inside fields trigger field-quoting; embedded quotes are doubled per RFC 4180 §2.7.

### CSV row composition (mirrors XLSX rows exactly per D-14)

```typescript
export function buildBoqCsv(b: BoqStructure): string {
  const rows: (string | number)[][] = []

  // Metadata block
  rows.push([`Project: ${b.metadata.projectName}`])
  rows.push([`Plan: ${b.metadata.planFilename}`])
  rows.push([`Exported: ${b.metadata.exportedDate}`])
  rows.push([`Pages: ${b.metadata.totalPages}`])
  rows.push([`Markups: ${b.metadata.totalMarkups}`])
  rows.push([])

  // Title row
  rows.push(['Item', 'Quantity', 'UoM'])

  // Category groups
  for (const cat of b.categories) {
    rows.push([cat.name, '', ''])  // bare-text heading row (D-14)
    for (const item of cat.items) {
      rows.push([
        item.label,
        item.uom === 'ea' ? Math.round(item.quantity) : Number(item.quantity.toFixed(2)),
        item.uom
      ])
    }
    for (const sub of cat.subtotals) {
      rows.push([
        'Subtotal',
        sub.uom === 'ea' ? Math.round(sub.total) : Number(sub.total.toFixed(2)),
        sub.uom
      ])
    }
  }

  for (const gt of b.grandTotals) {
    rows.push([
      'Grand Total',
      gt.uom === 'ea' ? Math.round(gt.total) : Number(gt.total.toFixed(2)),
      gt.uom
    ])
  }

  return stringify(rows, { record_delimiter: '\r\n', bom: false })
}
```

**Why round CSV at write time but not XLSX:** XLSX has a numFmt layer (`'0.00'`) that controls *display* without truncating the *value*; SUM() computes on the full-precision value. CSV has no formatting layer — the field is a literal string. Writing `12.345` would show `12.345` in Excel and fail downstream tools that expect 2dp. Writing `Number(x.toFixed(2))` yields `12.35` (or `12.34`, depending on rounding direction) — fine.

**Why `Math.round` for counts in CSV:** `cell.value = 5` and `cell.value = 5.0` both display as `5` with `numFmt='0'` in XLSX. CSV is text — `5` and `5.0` are different bytes. Counts must be integers, so `Math.round`.

[CITED: https://csv.js.org/stringify/api/sync/] — csv-stringify sync API; record_delimiter, bom, default quoting behavior.
[CITED: https://datatracker.ietf.org/doc/html/rfc4180] — RFC 4180; field quoting rules verified against output.

---

## 5. Native Save Dialog Behavior

### Filter shape and filter-index detection

```typescript
import { dialog, BrowserWindow } from 'electron'

ipcMain.handle('dialog:saveExport', async (event, defaultPath?: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)!
  const result = await dialog.showSaveDialog(win, {
    title: 'Export BOQ',
    defaultPath,
    filters: [
      { name: 'Excel Workbook', extensions: ['xlsx'] },
      { name: 'CSV', extensions: ['csv'] }
    ]
  })

  if (result.canceled || !result.filePath) return null

  // Determine which filter the user chose:
  // Electron's showSaveDialog DOES NOT return filterIndex on save dialogs (only open dialogs).
  // Detect format from the chosen path's extension, with extension enforcement.
  const lowered = result.filePath.toLowerCase()
  if (lowered.endsWith('.csv')) {
    return { filePath: enforceCsvExtension(result.filePath), format: 'csv' as const }
  }
  // Default to xlsx (handles .xlsx and any other / no extension)
  return { filePath: enforceXlsxExtension(result.filePath), format: 'xlsx' as const }
})
```

[VERIFIED — known caveat] **Important:** `showSaveDialog` does NOT return `filterIndex` (this property exists on `showOpenDialog`'s return value). Detect format from the path's extension. The user-chosen filter does pre-populate the extension when they type a name, so this path is reliable. If the user types `myproject.xls` (wrong extension under the .xlsx filter), `enforceXlsxExtension` appends `.xlsx`, producing `myproject.xls.xlsx` — accept this; it's the same behavior as `enforceClmcExtension` already exhibits.

[CITED: https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogbrowserwindow-options] — showSaveDialog return shape: `{ canceled: boolean, filePath?: string }`. No `filterIndex`.

### `defaultPath` derivation

```typescript
function deriveDefaultExportPath(currentFilePath: string | null, pdfOriginalFilename: string): string {
  function basename(p: string): string {
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
    return i >= 0 ? p.slice(i + 1) : p
  }
  function dirname(p: string): string {
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
    return i >= 0 ? p.slice(0, i) : ''
  }
  function stripExt(s: string): string {
    const i = s.lastIndexOf('.')
    return i > 0 ? s.slice(0, i) : s
  }

  const projectName = currentFilePath
    ? stripExt(basename(currentFilePath))
    : stripExt(pdfOriginalFilename)
  const dir = currentFilePath ? dirname(currentFilePath) : ''
  // Default to xlsx; user can change via filter dropdown
  const filename = `${projectName}-BOQ.xlsx`
  return dir ? `${dir}/${filename}` : filename
}
```

### Cancel handling

User-cancel returns `null` — renderer aborts silently, no toast.

---

## 6. Atomic Write Pattern Reuse

`atomicWriteFile` in `src/main/ipc-handlers.ts` (lines 45-55) accepts `(finalPath: string, data: Buffer)`. The signature accepts a Node `Buffer`. Both writers pass a `Buffer`:

```typescript
// XLSX path: ExcelJS produces a Buffer directly.
const xlsxBuf: Buffer = await buildBoqXlsx(structure)
await atomicWriteFile(filePath, xlsxBuf)

// CSV path: convert string to UTF-8 Buffer.
const csvText: string = buildBoqCsv(structure)
await atomicWriteFile(filePath, Buffer.from(csvText, 'utf-8'))
```

[VERIFIED in code: line 45] `atomicWriteFile` is currently a private (non-exported) function in `ipc-handlers.ts`. **Recommendation: extract to `project-io.ts` and export it** so `boq-writers.ts` and any future writer can use the same helper without copy-paste. This is a small refactor; the planner should add a Wave 0 task for it.

---

## 7. `isExporting` Race Protection

CONTEXT D-19 surfaces this as a clear-cut decision. **Recommended: yes, add it.** Cost is ~5 lines:

```typescript
// projectStore.ts — add:
interface ProjectStoreState {
  // ... existing fields
  isExporting: boolean
  setExporting: (v: boolean) => void
}
// initial state:
isExporting: false,
setExporting: (v) => set({ isExporting: v }),
```

Hook usage mirrors `isSaving`:

```typescript
const exportBoq = useCallback(async () => {
  const { isExporting, isSaving } = useProjectStore.getState()
  if (isExporting || isSaving) return 'canceled'
  useProjectStore.getState().setExporting(true)
  try {
    // ... aggregate + dialog + write
  } finally {
    useProjectStore.getState().setExporting(false)
  }
}, [])
```

Disabled wiring in Toolbar:

```typescript
const exportDisabled = totalPages === 0 || isSaving || isExporting || hasZeroMarkups
```

`hasZeroMarkups` derivation (cheap; computed inline in Toolbar via a Zustand selector):

```typescript
// Toolbar.tsx
const hasZeroMarkups = useMarkupStore((s) =>
  Object.values(s.pageMarkups).every((arr) => arr.length === 0)
)
```

Or add a selector helper to `markupStore.ts`:

```typescript
totalMarkupCount: () => {
  const pages = get().pageMarkups
  return Object.values(pages).reduce((acc, arr) => acc + arr.length, 0)
}
```

Then Toolbar derives `hasZeroMarkups = useMarkupStore((s) => s.totalMarkupCount()) === 0`. Either path is fine.

---

## 8. Toolbar / IconButton / Keyboard Shortcut Wiring

### Toolbar — insert Export IconButton after Replace Plan PDF

[VERIFIED: lines 244-267 of Toolbar.tsx] The file-action cluster is a `<div>` with `flex` + `gap: 4`. Add a fourth child:

```typescript
import {
  // ... existing imports
  Download
} from 'lucide-react'

// Inside the file-action cluster <div>:
<IconButton
  icon={Download}
  label="Export"
  disabled={exportDisabled}
  onClick={() => { void onExportClick() }}
  title="Export BOQ to Excel or CSV (Ctrl+Shift+E)"
  ariaLabel="Export BOQ"
/>
```

[VERIFIED] `Download` is exported by `lucide-react@1.6.0`:
```
$ node -e "const Lr = require('lucide-react'); console.log('Has Download:', typeof Lr.Download)"
Has Download: object
```

### Keyboard — register Ctrl+Shift+E with text-input guard

`useKeyboardShortcuts.ts` already has the pattern (lines 62-68 for Ctrl+Shift+S). Add:

```typescript
interface KeyboardShortcutHandlers {
  // ... existing
  exportBoq: () => void
}

// Inside the keydown listener:
// Ctrl+Shift+E: Export BOQ (must be checked alongside other Ctrl+Shift combos)
if (e.ctrlKey && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
  if (isTextInputActive()) return
  e.preventDefault()
  handlers.exportBoq()
  return
}
```

App.tsx wires it:

```typescript
useKeyboardShortcuts({
  // ...existing
  exportBoq: handleExportClick
})
```

Where `handleExportClick` is a `useCallback` mirroring `handleSaveClick` (App.tsx line 117).

---

## 9. UncalibratedExportWarningModal (D-06)

Mirror `OpenErrorModal` (which already exists at `src/renderer/src/components/OpenErrorModal.tsx`). Same dark-theme inline styles via `COLORS`. Two buttons (Continue / Cancel).

Component signature:

```typescript
interface UncalibratedExportWarningModalProps {
  pages: number[]            // sorted ascending
  onContinue: () => void
  onCancel: () => void
}
```

Body text (literal — D-06):

> Page {N1, N2, …} have markups but no scale set. Their length / area / perimeter measurements will be excluded from the export. Counts on those pages export normally.

Format the page list as `1, 3, 7` (comma-space). Use plural "Pages" if pages.length > 1, "Page" if 1.

Parent-owned lifecycle — App.tsx state slot:

```typescript
const [uncalibratedWarning, setUncalibratedWarning] = useState<{
  pages: number[]
  onContinue: () => void
} | null>(null)
```

The orchestrator checks for uncalibrated pages first and either:
- shows the modal (passing `onContinue` callback that proceeds) and returns early, OR
- proceeds straight to the dialog if the list is empty.

---

## 10. Runtime State Inventory

> Phase 5 is greenfield (no rename / refactor / migration). This section is a defensive sanity-check that no existing runtime state is touched.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 5 reads from in-memory Zustand state, never writes back to it. | None. |
| Live service config | None — no external services. | None. |
| OS-registered state | None — no Task Scheduler / launchd / systemd / pm2. | None. |
| Secrets / env vars | None — no API keys, no env vars. | None. |
| Build artifacts | New: `node_modules/exceljs/`, `node_modules/csv-stringify/` (transitively `node_modules/lodash`, etc. that ExcelJS pulls in). | Verified via `npm install --no-save` smoke test on 2026-05-02 — installs cleanly, no postinstall hooks, no native rebuilds. |

**Nothing user-facing breaks.** Phase 5 adds three IPC channels but does not modify existing ones. Adding `isExporting` to `projectStore` does not affect `isSaving` semantics. Adding `Download` icon import does not affect existing icon imports.

---

## 11. Common Pitfalls

### Pitfall 1: ARGB color format requires 8 hex chars (alpha + RGB)

**What goes wrong:** ExcelJS silently drops or mis-renders a 6-char hex.

**Why it happens:** `cell.fill.fgColor.argb` is alpha-prefixed: `'FFRRGGBB'`. `Markup.color` is `'#RRGGBB'`.

**How to avoid:** Use the `hexToArgb` helper (§4): `'#0078d4' → 'FF0078D4'`. Validate: 6-hex stripped + `'FF'` prefix.

**Warning sign:** Open the saved XLSX in Excel; cells appear unfilled or the color is shifted.

### Pitfall 2: `worksheet.views` must be set BEFORE `writeBuffer()`

**What goes wrong:** Frozen header doesn't survive write.

**Why it happens:** `views` is serialized at write-time; setting it on a worksheet that's already been serialized has no effect (we never re-serialize, but order matters for clarity).

**How to avoid:** Set `ws.views = [{ state: 'frozen', ySplit: titleRow }]` immediately after the title row is added. Always before `wb.xlsx.writeBuffer()`.

### Pitfall 3: `cell.value = numericString` breaks SUM()

**What goes wrong:** Estimator opens XLSX, types `=SUM(B3:B12)`, gets `0` or error.

**Why it happens:** Excel treats string-typed cells as text; SUM() ignores them.

**How to avoid:** `cell.value = Number(x)` — keeps numeric type. Confirm with round-trip test: `typeof loadedCell.value === 'number'`.

[VERIFIED] Round-trip test in §1 shows `B3 numFmt: 0.00 rawValue: 12.345 typeof: number` after `xlsx.load()`. Confirmed.

### Pitfall 4: csv-stringify default record_delimiter is `\n` (Unix)

**What goes wrong:** CSV opens cleanly in Excel but the record-separator is `\n`, not `\r\n`.

**Why it happens:** csv-stringify's default `record_delimiter` is `\n`. CONTEXT D-14 + the Windows-only platform constraint require `\r\n`.

**How to avoid:** Always set `record_delimiter: '\r\n'` (or `'windows'`).

[VERIFIED] Smoke test confirms `0d 0a` (`\r\n`) bytes at line ends with explicit `'\r\n'` value.

### Pitfall 5: Excel auto-converts strings that look like numbers when re-opening CSV

**What goes wrong:** A string like `01234` in a CSV (e.g., a product code) opens in Excel as `1234` (leading zero stripped).

**Why it happens:** Excel's CSV reader is over-helpful with type inference.

**How to avoid:** Not relevant for BOQ output — quantity is always a number, item-name and UoM are real strings without leading-zero edge cases. Document for future awareness.

### Pitfall 6: Merged cells must be `mergeCells` AFTER `addRow`

**What goes wrong:** Calling `mergeCells` before the row exists fails silently or throws on later access.

**Why it happens:** `mergeCells` requires existing cells.

**How to avoid:** Always: `addRow → ws.lastRow.number → mergeCells(`A${n}:C${n}`)`. The `appendCategoryHeading` helper in §2 demonstrates.

### Pitfall 7: Filter index missing from `showSaveDialog` result

**What goes wrong:** Trying `result.filterIndex` returns `undefined`; format detection fails.

**Why it happens:** Documented in §5 — Electron does not expose filterIndex on save dialogs.

**How to avoid:** Detect format from `result.filePath`'s extension. Trust the user (or the OS dialog) to have the extension match the chosen filter.

### Pitfall 8: `pdf.originalFilename` may be unavailable for never-saved projects

**What goes wrong:** `useViewerStore.getState().fileName` is `null` after `Open PDF` flow but before any save.

**Why it happens:** [VIEWERED in viewerStore.ts:7] `fileName: null` is the initial state. Set in `setFile(path, name, totalPages)`.

**How to avoid:** Guard with `?? 'plan.pdf'` in metadata derivation. The aggregator already does this. Default filename derivation falls back via the same path.

### Pitfall 9: Color cell on a count-only name

**What goes wrong:** `getColorForName(name)` returns `null` for a name that has only count markups but where the count markup was deleted — leaving the name still referenced in the bucket, but with no live markup to source the color from.

**Why it happens:** [Read in markupStore.ts:151-163] `getColorForName` walks `pageMarkups` for live markups only. If the only markup with a given name was deleted, no color.

**How to avoid:** This shouldn't happen in practice — deleting a markup also removes its bucket contribution. Defensive: when `color === null`, omit the fill (don't write `argb: 'FF000000'` which would make the cell black).

### Pitfall 10: ExcelJS version compatibility — `ExcelJS.Buffer` vs `Buffer`

**What goes wrong:** TypeScript: `Type 'ExcelJS.Buffer' is not assignable to type 'Buffer'`.

**Why it happens:** ExcelJS aliases its own Buffer type for browser/node compat.

**How to avoid:** Cast: `await wb.xlsx.writeBuffer() as Buffer`. Verified at runtime that `Buffer.isBuffer(buf) === true` in Node.

---

## 12. Code Examples (verified)

### Excel cell color from `Markup.color`

```typescript
function hexToArgb(hex: string): string {
  const stripped = hex.replace(/^#/, '').toUpperCase()
  if (stripped.length === 6) return `FF${stripped}`
  if (stripped.length === 8) return stripped
  throw new Error(`Invalid hex color: ${hex}`)
}

// Usage:
itemCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb('#0078d4') } }
// → { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0078D4' } }
```

[VERIFIED in this repo] Round-trip preserves: `{"type":"pattern","pattern":"solid","fgColor":{"argb":"FF0078D4"}}`.

### IPC handler: `file:writeBoqXlsx` (skeleton)

```typescript
// src/main/ipc-handlers.ts (extension)
import { buildBoqXlsx, buildBoqCsv } from './boq-writers'
import type { BoqStructure } from '../shared/boq-types'   // shared between renderer + main

ipcMain.handle(
  'file:writeBoqXlsx',
  async (_event, filePath: string, structure: BoqStructure): Promise<{ ok: true } | { ok: false; reason: string }> => {
    try {
      const buf = await buildBoqXlsx(structure)
      await atomicWriteFile(filePath, buf)
      return { ok: true }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      return { ok: false, reason }
    }
  }
)

ipcMain.handle(
  'file:writeBoqCsv',
  async (_event, filePath: string, structure: BoqStructure): Promise<{ ok: true } | { ok: false; reason: string }> => {
    try {
      const csv = buildBoqCsv(structure)
      await atomicWriteFile(filePath, Buffer.from(csv, 'utf-8'))
      return { ok: true }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      return { ok: false, reason }
    }
  }
)
```

### Preload bridge

```typescript
// src/preload/index.ts (extension)
saveExportDialog: (defaultPath?: string): Promise<{ filePath: string; format: 'xlsx' | 'csv' } | null> =>
  ipcRenderer.invoke('dialog:saveExport', defaultPath),

writeBoqXlsx: (filePath: string, structure: BoqStructure): Promise<{ ok: true } | { ok: false; reason: string }> =>
  ipcRenderer.invoke('file:writeBoqXlsx', filePath, structure),

writeBoqCsv: (filePath: string, structure: BoqStructure): Promise<{ ok: true } | { ok: false; reason: string }> =>
  ipcRenderer.invoke('file:writeBoqCsv', filePath, structure),
```

### Type extension

```typescript
// src/preload/index.d.ts (extension)
interface ElectronAPI {
  // ... existing
  saveExportDialog: (defaultPath?: string) => Promise<{ filePath: string; format: 'xlsx' | 'csv' } | null>
  writeBoqXlsx: (filePath: string, structure: BoqStructure) => Promise<{ ok: true } | { ok: false; reason: string }>
  writeBoqCsv: (filePath: string, structure: BoqStructure) => Promise<{ ok: true } | { ok: false; reason: string }>
}
```

**Shared types location:** Place `BoqStructure` types in `src/shared/boq-types.ts` (new directory) or in the renderer at `src/renderer/src/lib/boq-aggregator.ts` and import from preload. The latter is the lighter path; main and preload can both import from `'../renderer/src/lib/boq-aggregator'` since types are erased at runtime. Confirm with the existing `tsconfig.node.json` and `tsconfig.web.json` — types-only imports across project boundaries are usually safe but verify in Wave 0.

---

## 13. State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled SpreadsheetML XML | ExcelJS | ~2015 onward | Standardized API; no need to learn OOXML. |
| Synchronous CSV stringification with manual quoting | csv-stringify (sync) | Stable since ~2016 | RFC 4180 quoting; zero edge-case bugs. |
| Renderer-side XLSX builds (browser-only ExcelJS) | Main-process Buffer-based builds | N/A — Electron split was always main-side | Renderer doesn't need XLSX bytes; main owns disk write. |

**No deprecated APIs in our usage.** All ExcelJS calls (`addWorksheet`, `addRow`, `getCell`, `mergeCells`, `xlsx.writeBuffer`) are in the active API surface.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (include glob: `src/tests/**/*.test.ts`, environment: `node`) |
| Quick run command | `npx vitest run --no-coverage src/tests/boq-aggregator.test.ts` |
| Full suite command | `npx vitest run --no-coverage` |
| Type-check command | `npm run typecheck` |

[VERIFIED in this repo] `vitest.config.ts` lines 5-8 confirm node environment + `src/tests/**/*.test.ts` glob. Existing 30+ test files compile and run cleanly.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPRT-01 | Aggregator: 2-page project with mixed markups produces correct BoqStructure | unit | `npx vitest run src/tests/boq-aggregator.test.ts` | ❌ Wave 0 |
| EXPRT-01 | Aggregator: perimeter shape produces two BOQ rows (perimeter + area) | unit | `npx vitest run src/tests/boq-aggregator.test.ts -t "perimeter"` | ❌ Wave 0 |
| EXPRT-01 | Aggregator: name+type collision suffixing | unit | `npx vitest run src/tests/boq-aggregator.test.ts -t "collision"` | ❌ Wave 0 |
| EXPRT-01 | Aggregator: uncalibrated page excludes length/area/perimeter, keeps counts (D-06) | unit | `npx vitest run src/tests/boq-aggregator.test.ts -t "uncalibrated"` | ❌ Wave 0 |
| EXPRT-01 | Aggregator: cross-page same-name aggregation respects per-page scale | unit | `npx vitest run src/tests/boq-aggregator.test.ts -t "cross-page scale"` | ❌ Wave 0 |
| EXPRT-01 | Aggregator: empty project returns empty categories + grandTotals | unit | `npx vitest run src/tests/boq-aggregator.test.ts -t "empty"` | ❌ Wave 0 |
| EXPRT-01 | Aggregator: subtotals are per-UoM within a category (D-12) | unit | `npx vitest run src/tests/boq-aggregator.test.ts -t "subtotal"` | ❌ Wave 0 |
| EXPRT-01 | Aggregator: categories ordered by `categoryOrder`; empty categories excluded | unit | `npx vitest run src/tests/boq-aggregator.test.ts -t "ordering"` | ❌ Wave 0 |
| EXPRT-01 | XLSX writer: round-trip — write BoqStructure to buffer, parse back, assert cell values + numFmt + fills + merged cells + frozen pane | unit | `npx vitest run src/tests/boq-writers-xlsx.test.ts` | ❌ Wave 0 |
| EXPRT-01 | XLSX writer: native-number preservation (typeof === 'number' after reload) for SUM() | unit | `npx vitest run src/tests/boq-writers-xlsx.test.ts -t "native number"` | ❌ Wave 0 |
| EXPRT-01 | XLSX writer: column widths set; header row bold; ARGB fills correct | unit | `npx vitest run src/tests/boq-writers-xlsx.test.ts -t "polish"` | ❌ Wave 0 |
| EXPRT-02 | CSV writer: structural mirror — same row sequence as XLSX (metadata + spacer + title + groups + items + subtotals + grand totals) | unit | `npx vitest run src/tests/boq-writers-csv.test.ts -t "structure"` | ❌ Wave 0 |
| EXPRT-02 | CSV writer: RFC 4180 quoting (commas, quotes, newlines in fields) | unit | `npx vitest run src/tests/boq-writers-csv.test.ts -t "rfc4180"` | ❌ Wave 0 |
| EXPRT-02 | CSV writer: \r\n line endings + no BOM (UTF-8 plain) | unit | `npx vitest run src/tests/boq-writers-csv.test.ts -t "encoding"` | ❌ Wave 0 |
| EXPRT-02 | CSV writer: counts are integers, lengths/areas at 2dp | unit | `npx vitest run src/tests/boq-writers-csv.test.ts -t "precision"` | ❌ Wave 0 |
| EXPRT-01 + EXPRT-02 | IPC handler integration: dialog:saveExport returns expected shape; writeBoqXlsx and writeBoqCsv perform atomic write + return ok | unit (mock dialog) | `npx vitest run src/tests/boq-ipc-handlers.test.ts` | ❌ Wave 0 |
| EXPRT-01 + EXPRT-02 | UAT: estimator opens .xlsx in Excel, types =SUM(B8:B20), gets a non-zero number; opens .csv, sees same content | manual | (human checklist in 05-UAT.md) | ❌ Phase end |

### Sampling Rate

- **Per task commit:** `npx vitest run src/tests/boq-aggregator.test.ts src/tests/boq-writers-xlsx.test.ts src/tests/boq-writers-csv.test.ts` (3-file targeted run, < 5 sec)
- **Per wave merge:** `npx vitest run` (full suite, < 30 sec)
- **Phase gate:** Full suite green + `npm run typecheck` clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/tests/boq-aggregator.test.ts` — covers all aggregator test cases above. Depends on `boq-aggregator.ts` existing (RED first).
- [ ] `src/tests/boq-writers-xlsx.test.ts` — covers `buildBoqXlsx` round-trip via `ExcelJS.Workbook.xlsx.load(buf)` parse-back. RED first.
- [ ] `src/tests/boq-writers-csv.test.ts` — covers `buildBoqCsv` structural mirror + RFC 4180 + line endings. RED first.
- [ ] `src/tests/boq-ipc-handlers.test.ts` — covers IPC handlers via mock `ipcMain.handle` and mock `dialog`. RED first.
- [ ] Framework install: `npm install --save exceljs csv-stringify` — currently `--no-save` from this research's verification install. Wave 0 must persist this.

**Test fixture pattern:** Reuse the deterministic-fixture pattern from `src/tests/markup-math.test.ts` and `src/tests/markup-store.test.ts` — small in-memory `pageMarkups: { 1: [...], 2: [...] }`, explicit `pageScales`, explicit `categoryOrder`. Aggregator's `AggregateOptions` parameter (§"Pattern 2") makes injection trivial — no Zustand store mocking required.

**No human-only tests except the final UAT.** All structural / numeric / formatting assertions automate via ExcelJS round-trip parsing.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | All | ✓ | v25.3.0 (host); Electron 35 bundles 22.14.0 | — |
| npm | Install step | ✓ | 11.7.0 | — |
| `exceljs` (npm registry) | XLSX writer | ✓ | 4.4.0 latest, installable | — |
| `csv-stringify` (npm registry) | CSV writer | ✓ | 6.7.0 latest, installable | — |
| `lucide-react.Download` icon | Toolbar Export button | ✓ | 1.6.0 (already installed) | — |
| Existing `atomicWriteFile` helper | Both writers | ✓ | `src/main/ipc-handlers.ts:45` (private — refactor to export) | — |
| Existing `enforceClmcExtension` pattern | New extension helpers | ✓ | `src/main/project-io.ts:48` | — |
| Vitest 4.1.1 | All test files | ✓ | dev dep | — |
| jsdom 29.0.2 | Component tests (not used by Phase 5) | ✓ | dev dep | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Net new install:** 2 packages (`exceljs`, `csv-stringify`). Total install size: ~6 MB (ExcelJS pulls in saxes, fast-csv, archiver, jszip-nodebuffer-deps, etc.). Build artifact size impact: negligible — main process bundles tree-shake. Renderer bundle untouched (these are main-only deps).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ExcelJS 4.4.0 behaves identically on Node 22.14.0 (Electron 35) as on Node 25.3.0 (smoke-test host) | §1 | LOW — ExcelJS uses no Node 23+ APIs; engines field declares >=8.3.0; Node 22 is in active LTS. The smoke test on a newer Node is a strict superset of the older Node's API surface. The only path to failure would be Electron 35 itself disabling Node features (it does not). |
| A2 | `cell.fill.fgColor.argb` ARGB hex alpha defaults to FF (fully opaque) when given without alpha | §2 | LOW — verified output `FF0078D4` after passing `FF0078D4` explicitly. We always pass alpha-prefixed in the helper. No ambiguity. |
| A3 | csv-stringify `record_delimiter: '\r\n'` produces UTF-8 bytes `0x0d 0x0a` (no double-encoding, no BOM) | §4 | LOW — verified via hex dump in this repo. `0d 0a` confirmed. |
| A4 | `dialog.showSaveDialog` does not return `filterIndex` (Electron 35) | §5 | LOW-MEDIUM — Electron docs confirm `showSaveDialog` returns `{ canceled, filePath? }` with no filterIndex; only `showOpenDialog` returns it. If Electron 35 added it, our code still works (we don't read it). If Electron silently changes behavior, the worst case is the user's chosen extension is honored — which is what we want. |
| A5 | `BaseMarkup.categoryId` is always populated (Phase 03 maps empty input to "Uncategorized" via `getOrCreateCategory`) | §3 | LOW — verified in markupStore.ts:73-89. The defensive `__uncat__` bucket protects against any edge case. |
| A6 | `MarkupCommand` recolor / undo / redo / hydrate paths preserve color and categoryId such that the aggregator always sees consistent state | §3 | LOW — Phase 03.1 D-29 cascade is complete (STATE.md confirmation); `markupStore` invariants are well-tested. |
| A7 | Existing `atomicWriteFile` is safe to extract to `project-io.ts` and export | §6, §7 | LOW — pure function with no module-private dependencies. Refactor adds one task to Wave 0. |

**Total assumed claims: 7 — all LOW or LOW-MEDIUM risk.** No HIGH-risk assumptions.

---

## Open Questions for Planner (RESOLVED)

1. **Subtotal/grand-total fill color (CONTEXT D-13 Claude's discretion).**
   - CONTEXT says "subtle gray fill (`COLORS.secondary` or similar)". `COLORS.secondary === '#252526'` — this is the renderer dark theme; against Excel's default white sheet background, it would render near-black and harsh.
   - Recommendation: in `buildBoqXlsx`, use a much lighter ARGB for subtotal/grand-total fills, e.g. `FFEFEFEF` (light gray) or `FFE7E7E7`. Distinct from the canvas color theme.
   - Decision needed: confirm light-gray ARGB choice (`FFEFEFEF` recommended) or accept dark `FF252526`.
   - **RESOLVED:** Use light gray `FFEFEFEF` for both subtotal and grand-total fills in the XLSX writer. Reject the dark `#252526` (renderer-theme) value — it would render near-black on Excel's default white sheet.

2. **CSV byte assembly location (CONTEXT D-23 Claude's discretion).**
   - CONTEXT D-23 is explicit: "CSV byte assembly may live in either main or renderer". Researcher recommends MAIN (co-located with XLSX writer in `src/main/boq-writers.ts`) for symmetry of testing.
   - Decision needed: confirm MAIN, or split (CSV in renderer, XLSX in main).
   - **RESOLVED:** Build CSV bytes in the MAIN process, co-located with the XLSX writer in `src/main/boq-writers.ts`. The IPC contract is `file:writeBoqCsv(filePath, structure: BoqStructure)` — main receives the structured BOQ and produces the bytes.

3. **Subtotal granularity for mixed-UoM categories (CONTEXT D-12 + Claude's discretion).**
   - CONTEXT recommends multiple subtotal rows, one per UoM. The aggregator implements that.
   - Alternative considered: a single subtotal row with multi-line cell content (`5 ea\\n12 m`).
   - Recommendation: stick with multiple subtotal rows (SUMIF-friendly in CSV mirror; cleaner downstream tooling).
   - Decision needed: confirm multiple subtotal rows.
   - **RESOLVED:** Multiple subtotal rows — one per UoM within a category. Reject the single-row multi-line cell alternative (less SUMIF-friendly, harder for downstream estimating tools to parse).

4. **Where `BoqStructure` types live.**
   - Cross-process: aggregator (renderer) produces, IPC carries, writers (main) consume.
   - Options: (a) `src/shared/boq-types.ts` new dir, (b) `src/renderer/src/lib/boq-aggregator.ts` and import from main via project-relative path, (c) duplicate at both ends.
   - Recommendation: (a) `src/shared/boq-types.ts` — cleanest, mirrors the shared-types pattern that future phases may want.
   - Decision needed: confirm shared-types location.
   - **RESOLVED:** Do NOT create a new shared module. Duplicate the `BoqStructure` type inline in renderer (aggregator), main (writers), and preload (bridge), mirroring the existing `ReadProjectResult` pattern. This avoids introducing a new `src/shared/` directory just for one type and keeps each process self-contained.

5. **Refactor `atomicWriteFile` to `project-io.ts` exports?**
   - Currently private in `ipc-handlers.ts:45`. Two writers in `boq-writers.ts` plus the existing `file:writeProject` handler need it.
   - Recommendation: extract + export. One Wave 0 task.
   - Decision needed: confirm refactor.
   - **RESOLVED:** Do NOT refactor. Keep using the existing internal `atomicWriteFile` helper inside `ipc-handlers.ts` from the BOQ writer call sites. The refactor adds risk to a stable file-IO path for marginal cleanup gain; defer until a third consumer materializes.

6. **`useExport` hook vs fold into `useProject`?**
   - CONTEXT canonical_refs: "a separate `useExport` keeps export concerns isolated; folding into `useProject` keeps all file-IO in one hook."
   - `useProject.ts` is currently 392 lines and Save/Open/Replace-heavy. Adding ~80 lines of export orchestration would push it past 500.
   - Recommendation: separate `useExport.ts` for clarity.
   - Decision needed: confirm separate hook.
   - **RESOLVED:** Create a SEPARATE `useExport.ts` hook. `useProject.ts` is already 392 LOC and Save/Open/Replace-heavy; adding ~80 lines of export orchestration would push it past the readability threshold.

7. **Should Wave 0 install `exceljs` and `csv-stringify` immediately, or in Wave 1?**
   - Tests can't compile without the deps (`import ExcelJS from 'exceljs'` would TS-error in test files).
   - Recommendation: Wave 0 task = `npm install exceljs csv-stringify` + commit `package.json` + `package-lock.json`. Then RED tests can be written.
   - Decision needed: confirm Wave 0 install timing.
   - **RESOLVED:** No new packages need to be installed — both `exceljs` and `csv-stringify` are already present in `package.json`. Wave 0 only creates test scaffolds (RED test files); no `npm install` step is required.

8. **`Markup.color` field for `count` markups created BEFORE Phase 03.1 (none exist in production but theoretically possible during dev migration)?**
   - Out of scope. Phase 03.1 closed; all live markup data has color. Defensive null-coalescing in aggregator is sufficient.
   - **RESOLVED:** Apply defensive null-coalescing inside the aggregator (e.g. `markup.color ?? '#888888'`). Out-of-scope to scan/migrate legacy data; the defensive read keeps the aggregator robust to any pre-03.1 fixture or test artifact.

---

## Sources

### Primary (HIGH confidence — verified in this repo on 2026-05-02)

- ExcelJS 4.4.0 smoke test (writeBuffer, fills, mergeCells, frozen views, numFmt, columns, font.bold) — successful. Output verbatim in §1.
- ExcelJS 4.4.0 round-trip test (load buffer, assert all properties survive) — successful. Output verbatim in §1.
- csv-stringify 6.7.0 RFC 4180 quoting smoke test — successful. Output verbatim in §4.
- csv-stringify 6.7.0 `record_delimiter: '\r\n'` byte verification — successful. Hex `0d 0a` confirmed.
- lucide-react 1.6.0 `Download` export verified via `node -e "require('lucide-react').Download"`.
- ExcelJS engines field: `{"node":">=8.3.0"}` ([VERIFIED] read from `./node_modules/exceljs/package.json`).
- Repo files read (VERIFIED): `package.json`, `vitest.config.ts`, `src/main/ipc-handlers.ts`, `src/main/project-io.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`, `src/renderer/src/types/markup.ts`, `src/renderer/src/types/scale.ts`, `src/renderer/src/lib/markup-math.ts`, `src/renderer/src/lib/scale-math.ts`, `src/renderer/src/stores/markupStore.ts`, `src/renderer/src/stores/scaleStore.ts`, `src/renderer/src/stores/projectStore.ts`, `src/renderer/src/stores/viewerStore.ts`, `src/renderer/src/components/Toolbar.tsx`, `src/renderer/src/components/ConfirmationToast.tsx`, `src/renderer/src/components/OpenErrorModal.tsx`, `src/renderer/src/components/ScalePopup.tsx`, `src/renderer/src/hooks/useKeyboardShortcuts.ts`, `src/renderer/src/hooks/useProject.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/lib/constants.ts`, `src/renderer/src/lib/project-schema.ts`.

### Secondary (MEDIUM confidence — official docs cited)

- [ExcelJS npm](https://www.npmjs.com/package/exceljs) — version 4.4.0 latest published; metadata cited.
- [ExcelJS GitHub](https://github.com/exceljs/exceljs) — issue tracker reviewed; no material Node 22 / Electron 35 incompatibilities.
- [csv-stringify docs (csv.js.org)](https://csv.js.org/stringify/api/sync/) — sync API; record_delimiter, bom, default quoting behavior cited.
- [RFC 4180](https://datatracker.ietf.org/doc/html/rfc4180) — CSV format spec; quoting rules verified against csv-stringify output.
- [Electron showSaveDialog docs](https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogbrowserwindow-options) — return shape `{ canceled, filePath? }` confirmed; no `filterIndex`.

### Tertiary (LOW confidence — not used)

None. Every claim in this research is either verified by tool execution in this repo, or cited from primary documentation.

---

## Metadata

**Confidence breakdown:**
- ExcelJS Node 22 / Electron 35 verification: HIGH — direct smoke test in this repo, multiple round-trip property checks.
- csv-stringify RFC 4180 + line endings: HIGH — direct smoke test, hex byte verification.
- Aggregation algorithm: HIGH — pure function over already-validated data structures; the algorithm is mechanical and follows CONTEXT D-01..D-14 directly. Unit tests in Wave 0 will validate.
- IPC pattern: HIGH — mirrors the established Phase 4 / 4.1 pattern with no novel surface.
- UI patterns (Toolbar, modal, toast, keyboard): HIGH — exact reuse of existing components and hooks.
- Subtotal fill color in XLSX: MEDIUM — researcher's recommendation (`FFEFEFEF` over the dark theme `#252526`) flagged as Open Question 1 for planner confirmation.
- `Markup.color` always present after Phase 03.1: HIGH — Phase 03.1 cascade complete per STATE.md.

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (30 days; ExcelJS and csv-stringify are stable; STATE.md flag is resolved; CONTEXT.md decisions are locked).

**Total external smoke tests run:** 7 (ExcelJS write+round-trip×3, csv-stringify quoting+CRLF×2, lucide-react Download, ExcelJS engines field).
**Total source files read in this repo:** 23.
**Total npm registry queries:** 4 (exceljs, csv-stringify, csv, exceljs/time).
