# Phase 5: BOQ Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 05-boq-export
**Areas discussed:** Row aggregation model, Perimeter & multi-value rows, Sheet chrome & metadata, Export trigger UX

---

## Row aggregation model

### Q1 — How should markups become BOQ rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate by item name (whole project) | One row per unique item name across the whole project. 12 'Light Switch' pins anywhere → '12 ea'. Cleanest BOQ; matches how bids are quoted. | ✓ |
| Aggregate by item name per page | Same item name on different pages stays separate. Useful if pages map to building levels. | |
| One row per individual markup | Every count pin, every linear, every polygon gets its own row. Closer to a raw audit log. | |
| Hybrid — aggregate counts, individual linear/area/perimeter | Counts sum into one row; linear/area/perimeter each get their own row. PlanSwift-style. | |

**User's choice:** Aggregate by item name (whole project)
**Notes:** Whole-project aggregation locked. Per-page breakdown deferred to v2 if estimators ask for it.

### Q2 — When pages have different displayUnits, what unit should aggregated quantities export in?

| Option | Description | Selected |
|--------|-------------|----------|
| Use globalUnit from scaleStore | Convert every markup to the project's globalUnit. One consistent unit per export. | ✓ |
| Use the first-encountered displayUnit per item-name | Each item gets its own unit; BOQ may have rows in different units. | |
| Ask the user at export time | Pop a dialog before save. Adds a step but gives full control. | |
| No conversion — block export if units are mixed | Refuse until user normalizes all pages. Strict. | |

**User's choice:** Use globalUnit from scaleStore
**Notes:** Single project-wide unit on export — simplest mental model.

### Q3 — What happens to linear/area/perimeter markups on uncalibrated pages?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip silently, but warn at export start | Pre-export modal lists affected pages; user can [Continue] or [Cancel]. Counts unaffected. | ✓ |
| Block export entirely | Hard refuse with error modal until calibrated. Strictest. | |
| Include with quantity '—' or 0 | Render row with placeholder. Risks broken Excel SUM(). | |
| Skip silently with no warning | No modal. Fastest path; least safe. | |

**User's choice:** Skip silently, but warn at export start
**Notes:** Counts on uncalibrated pages still export normally (no scale needed for `ea`).

---

## Perimeter & multi-value rows

### Q1 — How should perimeter markups appear in the BOQ?

| Option | Description | Selected |
|--------|-------------|----------|
| Two rows per perimeter aggregate | '{name} (perimeter)' + '{name} (area)'. Keeps 3-column shape; SUM() works cleanly. | ✓ |
| One row, extra columns | 'Quantity 2' / 'UoM 2' columns for multi-value types. Wider table. | |
| One row, only the area | Drop perimeter length. Lossy. | |
| One row, only the perimeter length | Drop area. Equally lossy. | |

**User's choice:** Two rows per perimeter aggregate
**Notes:** Keeps the simple 3-column BOQ shape; suffix is automatic, not user-typed.

### Q2 — When the same item-name is used for multiple markup types, how should aggregation behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate by (name, type) | BOQ key is name + type. Same suffix mechanism perimeter uses. | ✓ |
| Aggregate by name only — first type wins | Later type-mismatched markups dropped. Brittle. | |
| Block export, force user to rename | Strict; adds friction. | |

**User's choice:** Aggregate by (name, type)
**Notes:** Generalizes the perimeter approach — auto-suffix when types collide for a name.

---

## Sheet chrome & metadata

### Q1 — What should the .xlsx export include beyond the bare 3 columns? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Project metadata header | Top of sheet: project name, source PDF filename, export date, total pages, total markups. | ✓ |
| Bold category heading rows + frozen header | Bold category row above each group; frozen column-title row. | ✓ |
| Per-category subtotals + grand total | Subtotal row at end of each category; grand total at bottom. | ✓ |
| Color-coded rows (per name-group color) | Row fill matches markup's per-name-group color. | ✓ |

**User's choice:** ALL FOUR (full polish)
**Notes:** Strong signal — the user wants a polished, bid-ready sheet. Color coding scoped to the Item cell only (full-row fill clashes with bold category-heading style — Claude's discretion).

### Q2 — How closely should the .csv mirror the .xlsx structure?

| Option | Description | Selected |
|--------|-------------|----------|
| Same structure, no styling | Same row order: metadata, category headings, items, subtotals, grand total. No bold/color. | ✓ |
| Pure flat data | Strip chrome; just Category, Item, Quantity, UoM columns. | |
| Pure flat data + Category column + Type column | Most machine-readable. | |

**User's choice:** Same structure, no styling
**Notes:** CSV mirrors XLSX row sequence; no styling layer in CSV.

---

## Export trigger UX

### Q1 — How should the user trigger export from the app?

| Option | Description | Selected |
|--------|-------------|----------|
| One Toolbar 'Export' button + format filter in save dialog | Single button; native dialog with .xlsx / .csv filters determines format. | ✓ |
| Two Toolbar buttons — Export Excel / Export CSV | More buttons, no save-dialog filter logic. | |
| Split-button dropdown ('Export ▾') | Single button + chevron; menu picks format. | |
| File menu (no toolbar button) | Add Electron application menu solely for export. Heavier change. | |

**User's choice:** One Toolbar 'Export' button + format filter in save dialog
**Notes:** Single-button approach matches the Toolbar's existing density. Native dialog is the format-picker.

### Q2 — Default filename in the Export save dialog?

| Option | Description | Selected |
|--------|-------------|----------|
| {project-basename}-BOQ.xlsx | If 'plans.clmc' → 'plans-BOQ.xlsx'. BOQ is the universal term. | ✓ |
| {project-basename}-takeoff.xlsx | Matches app name; less universal in construction. | |
| {project-basename}.xlsx | No suffix; risks visual collision with .clmc. | |
| Untitled.xlsx | Generic; loses link to source. | |

**User's choice:** {project-basename}-BOQ.xlsx
**Notes:** Falls back to {pdf-original-filename}-BOQ if the project has never been saved.

### Q3 — Keyboard shortcut for Export?

| Option | Description | Selected |
|--------|-------------|----------|
| Ctrl+E | Mnemonic; doesn't collide with existing app shortcuts. | |
| No shortcut | Toolbar-only. Less surface for accidental presses. | |
| Ctrl+Shift+E | Avoids any chance of single-letter collision. Photoshop/VS Code precedent. | ✓ |

**User's choice:** Ctrl+Shift+E
**Notes:** User picked the more careful option — fewer chances of accidental press while editing markup names. Same `isTextInputActive()` guard as `Ctrl+S`.

### Q4 — After a successful export, what should the app do?

| Option | Description | Selected |
|--------|-------------|----------|
| ConfirmationToast only | 'Exported: {filename}' toast; user opens file from Explorer themselves. | ✓ |
| Toast + 'Open file' button in toast | Inline shell.openPath() to launch Excel. | |
| Toast + 'Reveal in Explorer' button | Inline shell.showItemInFolder() to open folder. | |
| Toast + both Open and Reveal | Most flexible; complicates the toast. | |

**User's choice:** ConfirmationToast only
**Notes:** Quietest, most predictable. Reuses the existing parent-owned-lifecycle pattern.

---

## Claude's Discretion

- **Numeric precision**: counts as integers; lengths/areas at 2dp via Excel cell number-format `"0.00"`; full-precision underlying number so SUM() is correct. CSV writes 2dp display number.
- **Sort order within category**: alphabetical by post-suffix row label. Categories follow `categoryOrder` (user's order).
- **Subtotal granularity for mixed-UoM categories**: prefer multiple subtotal rows (one per UoM) within a category — SUMIF-friendly in both XLSX and CSV.
- **Empty categories** (zero markups across all pages): excluded from BOQ.
- **Metadata field set / order**: 5 rows above the table (Project / Plan / Exported / Pages / Markups), then blank, then BOQ table.
- **Sheet name**: `BOQ` (single worksheet).
- **Color cell scope**: `Item`-cell only (not full row, not category heading).
- **CSV line-ending**: `\r\n` (Windows-friendly).
- **Column widths**: Item ~36 chars, Quantity ~12 chars, UoM ~8 chars.
- **`enforceXlsxExtension` / `enforceCsvExtension`**: helpers in `project-io.ts` mirroring `enforceClmcExtension`.
- **`Download` icon**: lucide-react.
- **ExcelJS Node-22 / Electron-35 compatibility**: research flag from STATE.md — verify before planning; pivot if needed.

## Deferred Ideas

- Custom Excel template matching (v2 EXPRT-03; explicit out-of-scope per PROJECT.md).
- Item library / preset names (v2 LIB-01).
- Multiple worksheets per export (Counts / Linear / Area / Perimeter as separate sheets).
- Page-level breakdown alongside aggregate totals (rejected by user; revisit in v2 if requested).
- Per-individual-markup audit log export (rejected; could be a hidden Audit sheet in v2).
- PDF export of the BOQ.
- User-facing quantity precision setting.
- "Open file" / "Reveal in folder" buttons in the export toast (explicitly rejected).
- Application menu bar.
- Live BOQ preview before export (covered by Phase 6 VIEW-01 totals panel).
