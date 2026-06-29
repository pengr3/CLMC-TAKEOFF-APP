# Phase 15: BOQ Pricing & Perimeter Simplification — Research

**Researched:** 2026-06-29
**Domain:** Internal feature + refactor on existing Electron 35 / React 19 / TypeScript / Konva / Zustand / ExcelJS app
**Confidence:** HIGH — every claim below is grounded in the actual source files read this session (file:line cited). No new libraries introduced.

> Provenance note: all factual claims are `[VERIFIED: codebase]` (read directly from the named file:line this session) unless explicitly tagged `[ASSUMED]`. The ExcelJS numFmt behavior is `[VERIFIED: codebase pattern]` (the CSV writer already solves the identical Unicode problem) reinforced by `[CITED]` ECMA-376 number-format semantics.

---

## Approach Summary

This phase makes two coupled changes that share the BOQ code path. **Both are additive/subtractive within an established architecture — no new patterns are invented.**

**1. Pricing (additive).** Add an optional `rates?: Record<string, number>` field to `ProjectFileV2`, keyed by the string `` `${name}|${type}` ``. This mirrors `hiddenItemNames?` **exactly**: same additive-without-formatVersion-bump approach (project-schema.ts:87), same serialize line pattern (project-serialize.ts:60), same projectStore state + Set/Map-derivation + dirty-tracking pattern (projectStore.ts:12-95), same hydrate-inside-suspend-bracket pattern (project-serialize.ts:115-118). The aggregator gains `rate` + `cost` on each row by looking up `rates[`${name}|${type}`]` (defaulting to 0); cost = rate × quantity. The inline ₱ rate field in `TotalsRow.tsx` mirrors the existing lightbulb/arm-tool per-row interaction (TotalsRow.tsx:241-251 lightbulb is the closest analog for a per-row control that dispatches to a store with `e.stopPropagation()`).

**2. Perimeter → length-only (subtractive).** Delete the perimeter-AREA synthesis (boq-aggregator.ts:155-159), keep the perimeter-LENGTH add (boq-aggregator.ts:144-154, which is already arc-aware and must NOT regress). Make perimeter a first-class member of the D-02 collision set (currently it is excluded at boq-aggregator.ts:193). Drop the canvas fill + area-half label in PerimeterMarkup.tsx.

**Primary recommendation:** Treat `rates` as a carbon copy of `hiddenItemNames` plumbing. Treat perimeter-area removal as a "delete the second `add()` call + fold perimeter into the existing collision map + update the 3 inline `BoqRowType` duplicates" task. The single highest-risk item is **back-compat of the IPC wire-type `BoqRowType` union, which is duplicated in 4 files and already drifted** (see Perimeter-Area Removal Map).

---

## Existing Patterns To Mirror

### Pattern A — Additive optional field, NO formatVersion bump (the `rates` template)

This is the exact precedent the CONTEXT.md locked decision points to. `rates` must replicate every line below.

**1. Schema declaration** — `project-schema.ts:83-88`:
```ts
  /**
   * Additive in Phase 8 — absent in pre-Phase 8 files; defaults to [] on load.
   * Per-project visibility filter for canvas markup rendering (D-13).
   */
  hiddenItemNames?: string[]
```
`validateV2` (project-schema.ts:92-119) **does not validate `hiddenItemNames` at all** — the field rides the trailing `return raw as ProjectFileV2` cast (line 118). `rates?` does the same: add it to the `ProjectFileV2` interface, add NO validation branch. Old files (no `rates` key) pass `validateV2` unchanged.

**2. Serialize (write)** — `project-serialize.ts:60`:
```ts
    hiddenItemNames: useProjectStore.getState().hiddenItemNames
```
Add one sibling line: `rates: useProjectStore.getState().rates`. `snapshotProject` reads each store once via `.getState()` (no hooks).

**3. Hydrate (read), inside the dirty-suspend bracket** — `project-serialize.ts:115-118`:
```ts
    useProjectStore.setState({
      hiddenItemNames: Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : [],
      hiddenItemSet: new Set(Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : [])
    })
```
Add the parallel: `rates: (data.rates && typeof data.rates === 'object') ? data.rates : {}`. **Must stay inside the `suspendDirtyTracking()/resumeDirtyTracking()` try/finally** (lines 74-119) so opening a project doesn't mark it dirty (Pitfall 1). A `Record` guard (`typeof === 'object' && !null`) is the analog of the `Array.isArray` guard for the array field.

**4. Store state + action** — `projectStore.ts`. The visibility precedent uses BOTH a canonical field and a derived lookup:
- canonical: `hiddenItemNames: string[]` (line 12)
- derived: `hiddenItemSet: Set<string>` "NOT persisted in .clmc. Kept in sync" (line 13-14)

For rates, the canonical form `rates: Record<string, number>` **is already the lookup form** (O(1) by key), so no separate derived structure is needed — simpler than the visibility case. Add to: initial state (mirror line 54-55), `reset()` (mirror line 72-80 — reset to `{}`), and a `setRate(key, value)` action mirroring `toggleHiddenItem` (lines 82-91) including the trailing `get().markDirty()` call so edits persist. Also add a `setRates(map)` loader analog to `setHiddenItemNames` (lines 93-95) for hydrate, though hydrate uses `setState` directly today.

**5. Dirty-tracking subscription — DO NOTHING.** `attachDirtyTracking` (projectStore.ts:116-142) subscribes to markup/scale/viewer stores, NOT to projectStore's own fields. `hiddenItemNames` marks dirty via the explicit `get().markDirty()` inside `toggleHiddenItem` (line 90), not via a subscription. `setRate` must do the same. **Do not add a rates subscription** — follow the `toggleHiddenItem` precedent exactly.

> **Provenance for the round-trip:** save path = `snapshotProject` (project-serialize.ts:28) → JSON → ZIP; load path = `validateV2` → `migrate` (returns v2 unchanged, project-schema.ts:159) → `hydrateStores` (project-serialize.ts:73). The `rates` map round-trips as plain JSON exactly like `hiddenItemNames`. **Migration code: NONE** — additive field, no formatVersion bump (locked decision, mirrors the `arcs?`/`wallHeight`/`hiddenItemNames` precedents in STATE.md "Key Decisions Locked").

### Pattern B — Inline per-row control that dispatches to a store (the rate-field template)

The closest existing analog to "an editable thing inside `TotalsRow` that writes to a store without breaking row-click selection" is the **lightbulb visibility toggle** — `TotalsRow.tsx:241-251`:
```tsx
<div
  data-testid="totals-row-lightbulb"
  style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
  onClick={(e) => { e.stopPropagation(); useProjectStore.getState().toggleHiddenItem(itemKey) }}
  title={isHidden ? 'Show on canvas' : 'Hide from canvas'}
>
```

**Load-bearing detail:** `e.stopPropagation()` is mandatory. The whole row has `onClick={handleClick}` (TotalsRow.tsx:198) which does cycle-navigation + `onArmTool` (the "resume group" behavior). An inline `<input>` for the rate **must call `e.stopPropagation()` on its own onClick/onMouseDown** (and ideally onKeyDown for Enter) or every keystroke/click in the field will also trigger page-cycle navigation and arm the tool. This is the single biggest interaction landmine.

**The "resume group from totals row" interaction** the CONTEXT says to mirror is `onArmTool`, threaded:
`TotalsRow.handleClick` (line 181) → `onArmTool(item)` → `TotalsCategoryBlock` (TotalsCategoryBlock.tsx:130) → `TotalsPanel` (TotalsPanel.tsx:260) → `App.handleArmTool` (App.tsx:259). `handleArmTool` reads `rowTypeToMarkupType(item.type)` + `labelToName(item.label)` and imperatively scans `useMarkupStore.getState()`. **The rate edit does NOT need this chain** — it writes directly to projectStore like the lightbulb. But it must coexist with it on the same row: the `stopPropagation` guard is what keeps "click row body = resume group" and "click/type in rate field = edit rate" from colliding.

**Recommended seam for the rate input:** add a new fixed-width slot in the TotalsRow flex layout (the row already uses fixed-width slots "so cycle dot doesn't reflow" — TotalsRow.tsx:12-13 layout comment; existing slots: cycle-dot 6px @ line 214, lightbulb 16px @ 241, color chip 10px @ 254, label flex:1 @ 267, quantity minWidth 60 @ 279, uom 40px @ 292, plus-affordance 20px @ 305). Insert Rate + Cost slots between UoM and the plus-affordance, or between quantity and uom. Cost is display-only (read `item.cost`); Rate is the editable `<input type="number">` bound to `rates[itemKey-as-name|type]`.

> **Key-string caveat:** the existing `itemKey` in TotalsRow (line 122-125) is `` `${itemName}|${item.categoryId ?? ''}` `` — that is the **visibility** key (name|categoryId, category-DEPENDENT). The **rate** key is different: `` `${name}|${type}` `` (name|type, category-INDEPENDENT, per locked decision "the same (name,type) in two categories shares ONE rate"). Do NOT reuse `itemKey` for rates. Derive a separate `rateKey = `${itemName}|${item.type}`` — but note `item.type` is the `BoqRowType` (e.g. `'perimeter-length'`), and the rate decision keys on it directly, which is internally consistent with the aggregator's own bucket key `` `${name}|${type}` `` at boq-aggregator.ts:109. **If the planner renames `perimeter-length`→`perimeter`, the rate key changes shape for perimeters — decide rename FIRST, before keys are written, to avoid a stored-rate key mismatch.**

### Pattern C — Aggregator row construction (where rate/cost get populated)

Rows are built at boq-aggregator.ts:217-224:
```ts
      items.push({
        label, quantity: acc.quantity, uom: uomFor(type, globalUnit),
        color: acc.color, type, categoryId: groupCategoryId
      })
```
Add `rate` and `cost` here: read `const rate = rates[`${name}|${type}`] ?? 0` and `const cost = rate * acc.quantity`. The aggregator already receives all its inputs via `AggregateOptions` (boq-types.ts:88-98) with store-getState defaults (boq-aggregator.ts:82-90) — add a `rates?: Record<string, number>` option with default `useProjectStore.getState().rates`, and thread it through `useBoqLive` (useBoqLive.ts:39-53 — add `rates` to both the `aggregateBoq({...})` call and the `useMemo` dependency array so live recompute fires on rate edits).

**Cost subtotals** (locked: per-category cost subtotal + grand-total cost, unit-agnostic single ₱). The existing per-UoM subtotal loop is boq-aggregator.ts:231-239 (`byUom`/`grandByUom`). Add a parallel scalar accumulator: `catCostTotal += it.cost` and `grandCost += it.cost` (no UoM bucketing — cost is one number). Extend `BoqCategoryGroup` (boq-types.ts:61) with `costSubtotal: number` and `BoqStructure` (boq-types.ts:75) with `grandTotalCost: number`, OR add a dedicated cost field to the existing subtotal shape — planner's discretion, but the unit-agnostic single-number form is cleanest and matches the locked decision.

---

## ExcelJS ₱ Formatting

**The exact problem is already solved once in this codebase** — for `m²` in CSV. `boq-writers.ts:241-247`:
```ts
  // UTF-8 BOM (﻿ → bytes 0xEF 0xBB 0xBF) so Excel on Windows
  // auto-detects UTF-8 instead of falling back to Windows-1252 and
  // rendering 'm²' as 'mÂ²'. ...
  return '﻿' + stringify(rows, { record_delimiter: '\r\n', bom: false })
```
₱ (U+20B1 PESO SIGN) is well outside Windows-1252, so the **same BOM is what keeps ₱ from mojibake in CSV** — the existing BOM already covers it. No CSV change needed for the symbol beyond emitting the ₱ in the cell text.

### XLSX numFmt for ₱

XLSX (ECMA-376 / OOXML) stores strings and number-format codes as UTF-8 inside the zipped XML, so the ₱ glyph is safe in a numFmt literal — **no codepage issue inside .xlsx** (unlike legacy CSV). `[CITED: ECMA-376 SpreadsheetML number formats; VERIFIED: codebase already relies on UTF-8 XML for `m²`/`#RRGGBB` cells]`

The existing numFmt constants are `boq-writers.ts:41-42`:
```ts
const NUMFMT_INTEGER = '0'
const NUMFMT_DECIMAL = '0.00'
```
Add a peso format. Recommended literal (escape the symbol with a backslash so Excel treats it as a literal, not a format token):
```ts
const NUMFMT_PESO = '₱#,##0.00'   // ₱#,##0.00  → ₱1,234.56
```
Notes / caveats:
- `#,##0.00` gives thousands separators + 2 decimals (BOQ costs are money; grouping is desirable). If the planner wants no grouping, `'₱' + '0.00'` → `₱0.00`.
- The `₱` is a literal currency glyph; it does **not** need a backslash escape in OOXML the way `$` style chars sometimes do, but quoting it is harmless: `'"₱"#,##0.00'` is equally valid and unambiguous. Either form renders `₱` literally. `[ASSUMED — both forms valid; verify the chosen literal renders in the Wave-0 xlsx round-trip test, mirroring how 05-RESEARCH verified numFmt survived writeBuffer]`
- **Cells stay NATIVE NUMBERS.** Follow the established discipline at boq-writers.ts:164-169 (`qtyCell.value = item.quantity; qtyCell.numFmt = ...`) — set `costCell.value = item.cost` (a number) and `costCell.numFmt = NUMFMT_PESO`. Do NOT pre-format cost into a "₱123.45" string; that breaks `SUM()` and is explicitly the wrong pattern (boq-writers.ts:163 "native number — keeps SUM() working", confirmed in STATE.md Open-Questions "SUM() works because cells stay native numbers").
- Rate column: same `NUMFMT_PESO` (rate is also money).

### Shared currency constant

Locked decision: one `CURRENCY_SYMBOL = '₱'` seam consumed by the totals panel + both writers. **Placement caveat — process boundary:** `boq-writers.ts` runs in the **main** process and the file header (boq-writers.ts:4-10) documents that it **inline-duplicates** types rather than importing from renderer ("no shared types directory; main duplicates inline"). A renderer-side `constants.ts` `CURRENCY_SYMBOL` cannot be imported by `boq-writers.ts` without crossing that boundary. **Two clean options:** (a) define `CURRENCY_SYMBOL`/`NUMFMT_PESO` independently in both `src/renderer/src/lib/constants.ts` and `src/main/boq-writers.ts` (matches the existing deliberate type-duplication convention, with a Wave-0 test asserting they're equal — same cross-process structural-lock approach as boq-export-ipc.test.ts), or (b) put it in a tiny shared module both processes import. The codebase's established choice is duplication-with-test-lock (boq-writers.ts:8-9, preload/index.ts:14-15) — recommend (a) for consistency.

### Column order + widths

Locked column order: **Item · Quantity · UoM · Rate · Cost**. Current XLSX columns are 3 (boq-writers.ts:111-115); add `rate` + `cost` keys. Every `addRow([...])` that currently passes 3 cells (metadata exempt — those are single-column) must become 5 cells, and `mergeCells('A:C')` for category headings (boq-writers.ts:159) must extend to `A:E`. Title row (boq-writers.ts:126) becomes `['Item','Quantity','UoM','Rate','Cost']`. Width constants (boq-writers.ts:43-45) gain `COL_WIDTH_RATE`/`COL_WIDTH_COST` (~14 each for money). **All four touch-points (columns def, title row, every appendXxx row, the A:C merge) must move together or the table misaligns.**

---

## Perimeter-Area Removal Map

**Every reference to `'perimeter-area'` and `'perimeter-length'` in source (not docs), with disposition.** `[VERIFIED: codebase grep this session]`

| # | File:Line | Reference | Disposition |
|---|-----------|-----------|-------------|
| 1 | `boq-types.ts:23-24` | `BoqRowType` union members `'perimeter-length'` `'perimeter-area'` | DROP `'perimeter-area'`. Keep `'perimeter-length'` (or rename → `'perimeter'`, planner discretion). |
| 2 | `boq-aggregator.ts:159` | `add(catId, m.name, 'perimeter-area', realA)` | **DELETE** this line + the `pxA`/`realA` computation at 157-158 (`polygonArea(pts...)` + `pixelAreaToReal`). |
| 3 | `boq-aggregator.ts:154` | `add(catId, m.name, 'perimeter-length', realL)` | **KEEP — arc-aware, do not regress** (lines 150-153 build `closingPts`, pass `m.arcs` to `polylineLength`). Rename string only if union renamed. |
| 4 | `boq-aggregator.ts:37` | `uomFor`: `if (t==='linear' \|\| t==='perimeter-length') return globalUnit` | Keep; rename string if union renamed. |
| 5 | `boq-aggregator.ts:193` | collision-skip: `if (type==='perimeter-length' \|\| type==='perimeter-area') continue` | **CHANGE** — remove the skip so perimeter joins the collision set (D-02 first-class). Remove the `perimeter-area` half entirely. |
| 6 | `boq-aggregator.ts:207-210` | label rules: `'perimeter-length'`→`(perimeter)`, `'perimeter-area'`→`(area)` | **REWRITE** — delete the `perimeter-area`→`(area)` branch; the perimeter-length branch becomes part of the unified collision-suffix logic (plain `{name}`, gains `(perimeter)` only on collision). See "Label change" below. |
| 7 | `boq-aggregator.ts:42-46` | `nonPerimeterTypeWord(t)` helper | **EXTEND or REPLACE** to return `'perimeter'` for the perimeter type, since perimeter is now in the collision set (locked: "the type-word helper must handle the perimeter case"). |
| 8 | `boq-writers.ts:18` | `BoqRowType` inline duplicate (main process) | DROP `'perimeter-area'`; mirror boq-types.ts. |
| 9 | `preload/index.ts:16` | `BoqRowType` inline duplicate (preload) — **MISSED by CONTEXT canonical list** | DROP `'perimeter-area'`. ⚠️ Note this copy is ALREADY drifted: it omits `'wall'`. Aligning it is correct but verify the Wave-0 structural-lock test (`boq-export-ipc.test.ts`) still passes. |
| 10 | `preload/index.d.ts:6` | `BoqRowType` inline duplicate (preload .d.ts) — **MISSED by CONTEXT canonical list** | DROP `'perimeter-area'`. This copy DOES include `'wall'`. |
| 11 | `TotalsRow.tsx:68-72` | `rowTypeToMarkupType`: `if (t==='perimeter-length' \|\| t==='perimeter-area') return 'perimeter'` | SIMPLIFY to single `'perimeter-length'` (or `'perimeter'`) check. |
| 12 | `TotalsRow.tsx:65` | `labelToName` regex `\((count\|linear\|area\|perimeter\|wall)\)$` | **KEEP AS-IS** — already lists `perimeter`. After the change a perimeter row labeled `{name} (perimeter)` still strips correctly to `{name}`. No edit needed; this is a safety net that already works. |
| 13 | `TotalsCategoryBlock.tsx:26,45` | comments referencing "perimeter-length / perimeter-area both map to..." | Update comment text (no logic). `matchesForRow` (line 56-66) uses `rowTypeToMarkupType` so it follows #11 automatically. |

**Tests asserting the two-row behavior (must be rewritten, not just updated):** `[VERIFIED: codebase]`
- `boq-aggregator.test.ts:73` — `'perimeter markup synthesizes two rows: "(perimeter)" and "(area)"'` asserts `labels === ['Wall (area)', 'Wall (perimeter)']` (line 86). **Rewrite** to assert ONE row labeled `'Wall'` (no collision) or `'Wall (perimeter)'` (collision present).
- `boq-aggregator.test.ts:95` — `'WR-07: perimeter with an arc on the CLOSING edge — length AND area both reflect it'` finds `'Curved (perimeter)'` AND an area row. **Rewrite** to assert ONLY the arc-aware length row survives (drop the area assertion). This test is the arc-regression guard — keep its length assertion intact (Phase 14 protection).
- `totals-row-cycle.test.ts:287,333` — uses `type: 'perimeter-area'` fixture. **Rewrite** to `'perimeter-length'` (or `'perimeter'`); the underlying-type resolution to `'perimeter'` still holds.
- `totals-row-context-menu.test.ts:245,255` — `'perimeter-length'` fixture, asserts `.toFixed(2)`. Keep type string (rename if union renamed); behavior unchanged.

**Perimeter LENGTH stays arc-aware (Phase 14) — CONFIRMED.** Arc-awareness lives **entirely inside** `polylineLength`/`polygonArea` (markup-math.ts:18-32 reads `arcs?.[i-1]` and calls `arcLength`). The perimeter-length `add()` at boq-aggregator.ts:154 passes `m.arcs` into `polylineLength(closingPts, m.arcs)`. Removing the `perimeter-area` line (boq-aggregator.ts:155-159) is purely subtractive and touches NEITHER the length call NOR the math functions. There is no code path by which deleting the area synthesis can regress arc length. `[VERIFIED: codebase]`

### Label change (perimeter joins the D-02 collision set)

Today (boq-aggregator.ts:189-216): perimeter is **excluded** from `nameNonPerimTypes` (the collision map, line 193) and **always** suffixed `(perimeter)`/`(area)` (lines 207-210). New behavior (locked): perimeter is a first-class collision member — a perimeter row is plain `{name}`, gaining `{name} (perimeter)` **only** when the same name also has a count/linear/area row in that category.

Implementation: in the collision-map build (boq-aggregator.ts:190-200), STOP skipping perimeter — add `'perimeter-length'` (or `'perimeter'`) to `nameNonPerimTypes`. In the label loop (boq-aggregator.ts:204-216), delete the special perimeter branch; let perimeter fall through to the same `nonPerimSet.size >= 2` collision check the other types use. Rename `nameNonPerimTypes` → something like `nameTypes` (it now includes perimeter) and extend `nonPerimeterTypeWord` → e.g. `typeWord` returning `'perimeter'` for the perimeter case. **Consistency check:** a lone perimeter named "Skirting" with no other "Skirting" row → label `'Skirting'`. A "Skirting" perimeter + a "Skirting" linear in the same category → `'Skirting (perimeter)'` + `'Skirting (linear)'`.

### Canvas (PerimeterMarkup.tsx) — locked edits

- **Remove fill:** delete `fill={`${markup.color}33`}` (PerimeterMarkup.tsx:118). Keep the `closed` stroked `<Line>` (lines 113-120). Result: unfilled closed outline.
- **Label → length only:** PerimeterMarkup.tsx:79-88 builds `P: 24.6 m  A: 38.2 m²`. Change to `P: ${realPerim.toFixed(1)} ${u}` only. **Delete the area computation** at lines 81 (`polygonArea`) + 85 (`realArea` via `pixelAreaToReal`), and drop `polygonArea`/`pixelAreaToReal` from the import (lines 6-11) if now unused. **Keep** `polylineLength`/`pixelLengthToReal` and the arc-aware `effectiveArcs`/`closedPoints` length path (lines 75, 82-84) — the on-canvas length stays arc-aware, matching the BOQ. `buildArcAwareFlatPoints(...true)` (line 76) for the rendered outline stays.

---

## Risks & Back-Compat

| Risk | Severity | Detail / Mitigation |
|------|----------|---------------------|
| **`BoqRowType` is duplicated in 4 files; 2 already drifted** | HIGH | `boq-types.ts:19` (source), `boq-writers.ts:18`, `preload/index.ts:16` (missing `'wall'`!), `preload/index.d.ts:6`. CONTEXT's canonical list named only the first two. Dropping `'perimeter-area'` must touch all 4 or the Wave-0 structural-lock test (`boq-export-ipc.test.ts`, referenced boq-writers.ts:8) will fail at compile time. The preload drift means `'wall'` rows already can't be typed there — leave that as-is unless the planner wants to also fix it (out of phase scope, but flag it). |
| **Old `.clmc` files lose perimeter-area BOQ rows on reload** | NONE (intended) | Area was always computed **live, never stored** (the aggregator computes it from geometry each render; it is not in `Markup` nor `ProjectFileV2`). Reloading an old project simply stops synthesizing the area row. **No data loss, no migration, no formatVersion bump.** Perimeter geometry (`points`, `arcs`) is untouched. Confirmed by: `Markup` has no area field; `snapshotProject` (project-serialize.ts:28-62) stores only geometry; the area only ever existed as `add(..., 'perimeter-area', realA)` at aggregator runtime. Locked + correct. |
| **Old `.clmc` files have no `rates` key** | NONE | `validateV2` ignores unknown/absent fields (no `rates` branch); hydrate defaults to `{}` (mirror of the `Array.isArray(hiddenItemNames)` guard). Old files load clean with all costs = 0. |
| **Rate-input keystrokes triggering row cycle-nav / arm-tool** | HIGH (UX) | The row's `onClick` (TotalsRow.tsx:198) does page navigation + `onArmTool`. The rate `<input>` MUST `e.stopPropagation()` on click/mousedown/keydown (mirror the lightbulb's `e.stopPropagation()` at TotalsRow.tsx:244). Without it, typing a rate cycles pages and re-arms the draw tool. |
| **Rate key vs visibility key confusion** | MEDIUM | Visibility key = `name\|categoryId` (category-dependent, TotalsRow.tsx:122). Rate key = `name\|type` (category-INDEPENDENT, locked). They are different strings. Reusing the wrong one silently breaks the "shared rate across categories" requirement. |
| **Live recompute miss on rate edit** | MEDIUM | `useBoqLive` (useBoqLive.ts:39-53) only recomputes when one of its 8 dep-array values changes. Adding `rates` to `aggregateBoq({...})` WITHOUT adding it to the `useMemo` dep array (line 52) means cost won't update live when a rate changes. Add `rates` to BOTH. Source the rate via `useProjectStore((s) => s.rates)` selector (a top-level primitive selector, per the file's "never `(s) => s`" discipline at line 13-18). |
| **Cost cell pre-formatted as string** | MEDIUM | Breaks `SUM()`. Keep cost cells native numbers + numFmt (boq-writers.ts:163-169 precedent). |
| **`mergeCells('A:C')` not widened to `A:E`** | MEDIUM | Category-heading merge (boq-writers.ts:159) + every 3-cell `addRow` must become 5-cell or columns misalign. Mechanical but easy to miss one. |
| **Rename `perimeter-length`→`perimeter` mid-flight** | LOW-MED | If chosen, it ripples through all 13 map rows above + the rate key shape for perimeters + the 4 test fixtures. Decide BEFORE writing rate-key code so stored keys match. The rename is optional (planner discretion); doing it cleanly is fine, doing it half-way is the risk. |
| **`uom: 'm²'` superscript in new Cost column** | NONE | Cost is unit-agnostic (single ₱ number, no UoM cell). No new superscript surface. The existing `m²` BOM handling (boq-writers.ts:241) is untouched. |

---

## Validation Architecture

> Nyquist sampling for Phase 15. Framework: **Vitest** (config `vitest.config.ts`, include glob `src/tests/**/*.test.ts`, per STATE.md "Render tests kept as .test.ts"). Quick run: `npx vitest run <file>`. Full suite: `npx vitest run` (baseline 586/80 green per STATE.md last session). All four required proofs map to automatable unit tests against the **pure aggregator** + **pure writers** + **serialize round-trip** — no DOM needed for the math; the inline-edit field needs one render test.

### Required proofs → test map

| Proof (from scope) | Test type | File / target | Assertion |
|--------------------|-----------|---------------|-----------|
| **(a) cost = rate × quantity at row** | unit | `boq-aggregator.test.ts` (new case) | Inject `rates: {'Outlet\|count': 5}` + 3 Outlet counts → row `quantity:3, rate:5, cost:15`. |
| **(a) cost at category subtotal** | unit | `boq-aggregator.test.ts` | Two priced rows in one category → `category.costSubtotal === sum(row.cost)`. |
| **(a) cost at grand-total** | unit | `boq-aggregator.test.ts` | Rows across ≥2 categories → `grandTotalCost === Σ all row costs`. |
| **(a) no-rate row = 0 cost** | unit | `boq-aggregator.test.ts` | Row whose key is absent from `rates` → `rate:0, cost:0`, no throw. |
| **(b) rate persists round-trip, keyed by name\|type** | unit | `project-serialize.test.ts` + `project-schema.test.ts` | `snapshotProject` with `rates:{'Skirting\|perimeter-length':12}` → JSON → `validateV2` → `hydrateStores` → `useProjectStore.getState().rates` deep-equals input. Mirror the existing `hiddenItemNames` round-trip test. |
| **(b) category-independence** | unit | `project-serialize.test.ts` or `boq-aggregator.test.ts` | Same `name\|type` used in two categories → both rows read the SAME rate from one map entry. |
| **(b) old file (no rates) loads → {}** | unit | `project-schema.test.ts` | `validateV2` on a fixture lacking `rates` passes; `hydrateStores` yields `rates === {}`. (Mirror the pre-Phase-8 `hiddenItemNames` absent-field test.) |
| **(c) perimeter yields exactly ONE row** | unit | `boq-aggregator.test.ts` (REWRITE :73) | One perimeter markup → `category.items.length === 1`, type `'perimeter-length'`/`'perimeter'`, NO `(area)` row anywhere. |
| **(c) consistent collision-suffix label** | unit | `boq-aggregator.test.ts` | Lone perimeter "Skirting" → label `'Skirting'`. "Skirting" perimeter + "Skirting" linear same cat → `'Skirting (perimeter)'` + `'Skirting (linear)'`. |
| **(c) perimeter LENGTH stays arc-aware** | unit | `boq-aggregator.test.ts` (KEEP/REWRITE :95 WR-07) | Perimeter with arc on closing edge → length row value > straight-chord length (Phase-14 regression guard); assert NO area row. |
| **(d) old projects reload without error** | unit | `project-schema.test.ts` / `project-serialize.test.ts` | A pre-Phase-15 fixture (perimeter markup, no `rates`) → `migrate`→`validateV2`→`hydrateStores` throws nothing; perimeter geometry intact; BOQ shows length-only. |
| **xlsx Rate/Cost columns + ₱ numFmt + SUM-safe** | unit | `boq-writers-xlsx.test.ts` | Build workbook; assert title row `['Item','Quantity','UoM','Rate','Cost']`; cost cell `.value` is a NUMBER and `.numFmt` contains `₱`/`₱`; merged heading is `A:E`. (Mirror the Phase-5 round-trip numFmt check.) |
| **csv Rate/Cost numeric columns** | unit | `boq-writers-csv.test.ts` | Header row has Rate+Cost; rate/cost emitted as numeric (Number, not "₱.." string); BOM still present (line 1 starts `﻿`). |
| **inline rate field writes store + stops propagation** | render | new `totals-row-rate-edit.test.ts` | Typing in the rate input calls `setRate` with key `name\|type`; the row's `onClick`/`onArmTool` does NOT fire (assert `e.stopPropagation` — spy that page-nav/arm callback is not called). Mirror existing `totals-row-cycle.test.ts` render harness (React.createElement + jsdom). |

### Sampling rate
- **Per task commit:** `npx vitest run src/tests/boq-aggregator.test.ts` (the proof-(a)+(c) core) — < 5s.
- **Per wave merge:** `npx vitest run` (full suite; baseline 586/80 green — any drop is a regression, esp. the WR-07 arc guard and `hiddenItemNames` round-trip).
- **Phase gate:** full suite green + the xlsx/csv writer tests + a human UAT proving the inline ₱ edit feels right (per MEMORY feedback "verify in-progress UX feel", and the standing how-to-manual requirement).

### Wave 0 gaps
- [ ] Extend `boq-aggregator.test.ts` — add rate/cost cases; REWRITE the two perimeter cases (:73 two-row, :95 WR-07).
- [ ] Extend `project-serialize.test.ts` + `project-schema.test.ts` — `rates` round-trip + absent-field default (clone the `hiddenItemNames` tests).
- [ ] Extend `boq-writers-xlsx.test.ts` / `boq-writers-csv.test.ts` — 5-column layout + ₱ numFmt + native-number cost.
- [ ] New `totals-row-rate-edit.test.ts` — inline field dispatch + `stopPropagation`.
- [ ] Update fixtures in `totals-row-cycle.test.ts` (:333) and `totals-row-context-menu.test.ts` (:255) — `perimeter-area`→`perimeter-length`/`perimeter`.
- [ ] Cross-process lock: confirm `boq-export-ipc.test.ts` still compiles after editing all 4 `BoqRowType` duplicates.

---

## Open Questions

1. **Rename `perimeter-length` → `perimeter`?** (Planner discretion, locked as optional.) Recommendation: **yes, rename** for clarity since the two-type split is gone and `perimeter-length` is now the only perimeter type — but the rename must land BEFORE rate-key code is written (rate keys on `${name}|${type}`, so the stored key for perimeters depends on this choice). If renamed, all 13 Removal-Map rows + 4 test fixtures + the preload duplicates update together. If the planner prefers minimal diff, keeping `'perimeter-length'` is equally correct and lower-churn. **Either is fine; pick one and apply it everywhere atomically.**

2. **Cost-subtotal data shape.** `costSubtotal: number` on `BoqCategoryGroup` + `grandTotalCost: number` on `BoqStructure` (recommended, unit-agnostic single number) vs. folding cost into the existing per-UoM `BoqSubtotal` shape. The single-number form matches the locked "cost is unit-agnostic; one ₱ number per category" decision — recommend it. Confirm with planner since it touches `boq-types.ts` consumed across the process boundary (also update the inline duplicates in `boq-writers.ts:26-36` and `preload/index.ts:31-41`).

3. **`CURRENCY_SYMBOL`/`NUMFMT_PESO` placement** — duplicate-with-test-lock (matches existing convention, recommended) vs. a new shared module both processes import. The codebase has deliberately chosen duplication-with-lock for all cross-process types so far; recommend matching it, but a shared `src/shared/currency.ts` would be defensible if the planner wants to start reducing the duplication debt. (Not required this phase.)

4. **Rate input commit trigger** (blur vs Enter — locked as "follow existing inline-edit patterns"). The codebase's nearest inline-edit precedents are popup-based (`MarkupNamePopup`), not in-row. No existing in-row text input exists to copy verbatim. Recommendation: commit on **blur AND Enter** (and revert on Escape) — standard, and the lightbulb's `stopPropagation` discipline is the only hard constraint. Flag for the planner that this is a net-new in-row input pattern (no exact prior art), so a render test (Wave 0) is worth its weight.

---

*Phase: 15-boq-pricing-perimeter-simplification — research complete 2026-06-29*
