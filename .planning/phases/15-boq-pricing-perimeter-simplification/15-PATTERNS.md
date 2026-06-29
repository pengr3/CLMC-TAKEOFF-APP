# Phase 15: BOQ Pricing & Perimeter Simplification - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 12 (8 modified, 0 new source files; 10 test files to update)
**Analogs found:** 12 / 12 — every change is a modify-in-place against an existing, well-patterned file. No net-new file with no analog.

> **Read order for the planner / implementer:** every file below is its own analog. This is a "thread one more field through an existing pipeline" phase, not a "new subsystem" phase. The dominant pattern is: **mirror `hiddenItemNames?` for `rates?` persistence**, and **mirror the existing quantity column/subtotal shapes for Rate/Cost**, and **delete the `perimeter-area` arm everywhere the `perimeter-length` arm is paired with it**.

---

## File Classification

| Modified file | Role | Data flow | Closest analog | Match quality |
|---------------|------|-----------|----------------|---------------|
| `src/renderer/src/stores/projectStore.ts` | store (Zustand slice) | event-driven (state mutation) | **itself** — `hiddenItemNames` + `hiddenItemSet` + `toggleHiddenItem` (lines 12-15, 27-29, 54-55, 82-95) | exact (additive sibling field) |
| `src/renderer/src/lib/project-schema.ts` | model (schema + validator) | transform (validate) | **itself** — `hiddenItemNames?` field (lines 83-88) + `validateV2` (92-119) | exact (additive optional field) |
| `src/renderer/src/lib/project-serialize.ts` | utility (serialize/deserialize) | transform | **itself** — `hiddenItemNames` snapshot (line 60) + hydrate (lines 115-118) | exact |
| `src/renderer/src/lib/boq-types.ts` | model (shared types) | transform | **itself** — `BoqItemRow` (33-52), `BoqRowType` (19-25), `BoqSubtotal` (55-58) | exact (additive fields + enum-member drop) |
| `src/renderer/src/lib/boq-aggregator.ts` | service (pure aggregator) | transform / batch | **itself** — `add()` accumulator (107-113), row build loop (203-225), subtotal loop (231-239), perimeter synthesis (143-159) | exact |
| `src/main/boq-writers.ts` | service (export writers) | file-I/O (build buffer/string) | **itself** — `appendItemRow` (164-177) + `appendSubtotalRow` (180-187) for xlsx; CSV item/subtotal push (217-230) | exact |
| `src/renderer/src/components/TotalsRow.tsx` | component | request-response (UI event → store) | **itself** — lightbulb toggle binding (241-251) + click→store dispatch (149-182); inline-input shape from `ScalePopup.tsx` (197-216) | exact (role) + role-match (the `<input>`) |
| `src/renderer/src/components/TotalsCategoryBlock.tsx` | component | request-response | **itself** — item map (117-133); **subtotal render slot is currently EMPTY** (135) — cost subtotal is net-new render | exact |
| `src/renderer/src/components/TotalsPanel.tsx` | component | request-response | **itself** — category map (250-262); **grand-total bar does not yet render** despite docstring — grand-total cost is net-new render | exact |
| `src/renderer/src/components/TotalsPanelHeader.tsx` | component | request-response | **itself** — `rows[]` metadata list (29-35) — optional spot for a grand-total-cost summary row | exact |
| `src/renderer/src/components/markup/PerimeterMarkup.tsx` | component (Konva) | event-driven (render) | **itself** — fill at line 118, label at 79-88, area imports at 5-11 | exact (deletion) |
| `src/preload/index.d.ts` + `src/preload/index.ts` | config (IPC type mirror) | — | **itself** — duplicated `BoqRowType`/`BoqItemRow` (d.ts 6-19, ts 16-29) | exact (mirror — keep in lockstep) |

> **CRITICAL — 4-way type lock.** `BoqRowType` + `BoqItemRow` are **inline-duplicated in FOUR files** and MUST stay byte-identical in shape: `boq-types.ts` (canonical), `boq-writers.ts` (lines 18-25), `preload/index.d.ts` (lines 6-19), `preload/index.ts` (lines 16-29). The `boq-writers.ts` header comment says it explicitly: *"NEVER let these definitions diverge from boq-types.ts without updating BOTH."* It's actually all four. The preload mirrors are a **reduced** subset (no `categoryId?`), so for them only **add `rate`/`cost`** and **drop `'perimeter-area'`** — do not add `categoryId`.

---

## Shared Patterns

### Currency constant (net-new shared seam)
**Decision (CONTEXT line 36):** define ONE `CURRENCY_SYMBOL = '₱'` consumed by the totals panel + both writers, so a future Settings picker has a single seam.
**Where it should live:** a renderer-side const (e.g. add to `src/renderer/src/lib/constants.ts` alongside `COLORS`) for the UI, BUT `src/main/boq-writers.ts` is a **separate process** and already inline-duplicates everything (see its header comment, lines 4-10). So the writer needs its **own** local copy of the symbol + numFmt, exactly like it locally re-declares `NUMFMT_DECIMAL` (line 42). Do not import renderer constants into main.
**Apply to:** `TotalsRow.tsx` / cost-subtotal render, `boq-writers.ts` (both builders).

`src/renderer/src/lib/constants.ts` — existing const-block shape to copy:
```typescript
export const COLORS = {
  dominant: '#1a1a1a',
  ...
} as const
// ← add e.g.  export const CURRENCY_SYMBOL = '₱'
```

`src/main/boq-writers.ts:41-48` — existing local-const shape (writer side gets its own):
```typescript
const NUMFMT_INTEGER = '0'
const NUMFMT_DECIMAL = '0.00'
const COL_WIDTH_ITEM = 36
const COL_WIDTH_QTY = 12
const COL_WIDTH_UOM = 8
// ← add e.g.  const NUMFMT_CURRENCY = '"₱"#,##0.00'  +  COL_WIDTH_RATE / COL_WIDTH_COST
```

### Rate-key string (mirror the aggregator bucket key)
**Decision (CONTEXT lines 24, 102):** the `rates` map key is `` `${name}|${type}` `` — **identical join style** to the aggregator's existing bucket key.
**Source of truth for the join:** `src/renderer/src/lib/boq-aggregator.ts:109`
```typescript
const k = `${name}|${type}`   // existing bucket key — rate key uses the SAME shape
```
**Apply to:** aggregator rate lookup (new), TotalsRow rate-edit dispatch (new), wherever a row computes its key. Note `BoqItemRow` already carries both `label`-derived name and `type`, so the row can rebuild this key locally.

---

## Pattern Assignments

### 1. `rates?` persistence → mirror `hiddenItemNames?` end-to-end

This is the spine of the phase. Four touch-points, each an exact additive twin of an existing `hiddenItemNames` line.

#### 1a. `src/renderer/src/stores/projectStore.ts` (store slice)
**Analog: the `hiddenItemNames` slice in this same file.** Add a `rates: Record<string, number>` field next to `hiddenItemNames`, and a `setRate(key, value)` action next to `toggleHiddenItem`.

State + reset (lines 12-15, 54-55, 72-80) — replicate the field + its reset entry:
```typescript
  hiddenItemNames: string[]
  /** Derived in-memory O(1) lookup — NOT persisted in .clmc. Kept in sync with hiddenItemNames. */
  hiddenItemSet: Set<string>
// → add:  rates: Record<string, number>     (persisted; no derived Set needed — it's already a map)
```
```typescript
  reset: () => set({
    currentFilePath: null,
    ...
    hiddenItemNames: [],
    hiddenItemSet: new Set()
    // → add:  rates: {}
  }),
```

Toggle/setter pattern to mirror (lines 82-91) — **note the `get().markDirty()` call at the end; the rate setter MUST do the same so Save persists it:**
```typescript
  toggleHiddenItem: (name) => {
    set((s) => {
      const idx = s.hiddenItemNames.indexOf(name)
      const next = idx >= 0
        ? s.hiddenItemNames.filter((n) => n !== name)
        : [...s.hiddenItemNames, name]
      return { hiddenItemNames: next, hiddenItemSet: new Set(next) }
    })
    get().markDirty()
  },
```
**Replicate:** a `setRate: (key: string, rate: number) => void` that does `set((s) => ({ rates: { ...s.rates, [key]: rate } }))` then `get().markDirty()`.
**Change:** rates is a plain map (no parallel `Set`). A rate of 0 / blank → store 0 or delete the key (CONTEXT: "no rate set behaves as rate = 0").

> **Live-recompute caveat (mirror gap):** `useBoqLive` (the live totals memo) currently depends on 8 store primitives but **does NOT subscribe to `projectStore`** for anything except `currentFilePath` (useBoqLive.ts:37). For an edited rate to recompute costs live (CONTEXT line 41), either (a) the aggregator reads `rates` and `useBoqLive` adds `rates` to its selector + dependency array (useBoqLive.ts:30-53), or (b) costs are computed in the UI layer from `boq.items[].quantity × rates[key]`. The aggregator-reads-rates path matches CONTEXT line 31 ("populate in the aggregator… reading the rate from the project store's `rates` map"). **Planner must wire `rates` into `useBoqLive`'s selector + deps, or costs will be stale until another store changes.**

#### 1b. `src/renderer/src/lib/project-schema.ts` (schema + validator)
**Analog: `hiddenItemNames?` on `ProjectFileV2` (lines 83-88) + its (absent) check in `validateV2`.**
Additive optional field — copy the JSDoc-with-default-note style verbatim:
```typescript
  /**
   * Additive in Phase 8 — absent in pre-Phase 8 files; defaults to [] on load.
   * Per-project visibility filter for canvas markup rendering (D-13).
   */
  hiddenItemNames?: string[]
// → add:
//   /** Additive in Phase 15 — absent in pre-Phase 15 files; defaults to {} on load.
//    *  Per-(name|type) unit rate in ₱. NO formatVersion bump (CONTEXT). */
//   rates?: Record<string, number>
```
**Change:** `validateV2` (lines 92-119) does **not** validate `hiddenItemNames` at all — it's tolerated as optional and defaulted at load. **Do the same for `rates`: add NO new throw.** Keep `formatVersion === 2` (line 96) — **do not bump** (CONTEXT lines 25, 63).

#### 1c. `src/renderer/src/lib/project-serialize.ts` (snapshot + hydrate)
**Analog: the two `hiddenItemNames` lines.**
Snapshot (line 60) — the field is read from `projectStore.getState()` and tacked onto the returned object:
```typescript
    currentPage: viewer.currentPage,
    pages,
    hiddenItemNames: useProjectStore.getState().hiddenItemNames
    // → add:  rates: useProjectStore.getState().rates
```
Hydrate (lines 115-118) — runs **inside** the `suspendDirtyTracking()` bracket, with an `Array.isArray` tolerance guard for legacy files:
```typescript
    useProjectStore.setState({
      hiddenItemNames: Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : [],
      hiddenItemSet: new Set(Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : [])
    })
    // → add into the SAME setState (or adjacent):
    //   rates: (data.rates && typeof data.rates === 'object') ? data.rates : {}
```
**Replicate:** the object-presence guard (legacy `.clmc` has no `rates` → default `{}`). **Change:** rates has no derived Set, so it's a single key in the `setState`.

---

### 2. Inline ₱ rate field → mirror the TotalsRow lightbulb-toggle + a ScalePopup input

#### 2a. `src/renderer/src/components/TotalsRow.tsx`
**Analog A — the lightbulb's "bind event + stopPropagation + dispatch to store" pattern (lines 241-251).** This is the exact shape the rate input must follow so the row's own `onClick` cycle-navigation (lines 149-182) does NOT fire when the user interacts with the rate field:
```typescript
      <div
        data-testid="totals-row-lightbulb"
        style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); useProjectStore.getState().toggleHiddenItem(itemKey) }}
        title={isHidden ? 'Show on canvas' : 'Hide from canvas'}
      >
```
**Replicate:** wrap the new rate `<input>` in a fixed-width slot (like the 40px UoM `<span>` at lines 291-301 and the 20px plus-slot at 305-310 — the row is a flex row of fixed slots so nothing reflows). The input's `onClick`, `onMouseDown`, `onKeyDown` must `e.stopPropagation()` so the row-level handlers (handleClick at 155, handleMouseDown at 149) don't capture them.
**Dispatch target:** `useProjectStore.getState().setRate(itemKey, value)` — `itemKey` already exists at lines 122-125 as `` `${itemName}|${item.categoryId ?? ''}` ``. **WARNING:** that key uses `categoryId`, but CONTEXT says rate is **category-independent** keyed by `` `${name}|${type}` `` (lines 24, 26). **The rate key must be `` `${itemName}|${item.type}` ``, NOT the visibility `itemKey`.** Build a separate `rateKey`.
**Read current rate:** subscribe like `const rate = useProjectStore((s) => s.rates[rateKey] ?? 0)` — mirrors the `isHidden` selector at line 134.

**Analog B — the actual `<input>` element shape, from `src/renderer/src/components/ScalePopup.tsx:197-216`** (the codebase's canonical numeric inline input):
```typescript
        <input
          type="text"
          inputMode="decimal"
          value={distanceText}
          onChange={(e) => setDistanceText(e.target.value)}
          placeholder="0.00"
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            height: 32,
            padding: '4px 10px',
            background: COLORS.dominant,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            color: COLORS.textPrimary,
            fontSize: 13,
            outline: 'none'
          }}
        />
```
**Replicate:** `type="text" inputMode="decimal"`, `parseFloat` on commit (ScalePopup parses at line 66: `const parsedDistance = parseFloat(distanceText)`), the dark-theme styling tokens. Shrink `height`/`width` to fit the 28px-tall row (the row is `height: 28` per line 201) — use a narrow fixed slot, not `width: '100%'`.

**Analog C — commit-on-Enter trigger (ScalePopup.tsx:81-86)** — CONTEXT line 69 leaves blur-vs-Enter to discretion; here's the Enter handler shape; add an `onBlur` twin:
```typescript
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (mode === 'confirm' && e.key === 'Enter' && canConfirm) {
      e.preventDefault()
      handleConfirmClick()
    }
  }
```
**Change:** commit calls `setRate(rateKey, parseFloat(text) || 0)`; on blur AND Enter (follow existing inline patterns — both is safest).

**Cost display:** add a Cost `<span>` next to the quantity span (lines 278-289) using `formatQuantity`-style logic. Existing quantity formatter for reference (lines 58-61):
```typescript
function formatQuantity(item: BoqItemRow): string {
  if (item.type === 'count') return String(Math.round(item.quantity))
  return item.quantity.toFixed(2)
}
```
**Replicate:** a `formatCost` → `` `₱${(item.cost).toFixed(2)}` `` (cost comes from `BoqItemRow.cost` once the aggregator populates it — see §3). Use `fontVariantNumeric: 'tabular-nums'` like the quantity span (line 282) for column alignment.

---

### 3. rate/cost on BoqItemRow + aggregator threading

#### 3a. `src/renderer/src/lib/boq-types.ts` (+ 3 mirrors)
**Analog: `BoqItemRow` (lines 33-52).** Add two numeric fields. Keep the JSDoc-per-field style:
```typescript
export interface BoqItemRow {
  label: string
  /** Native number, full precision. */
  quantity: number
  uom: string
  color: string | null
  type: BoqRowType
  categoryId?: string | null
  // → add:
  //   /** Unit rate in ₱ for this (name,type); 0 when unset. */
  //   rate: number
  //   /** rate × quantity, ₱. */
  //   cost: number
}
```
**Mirror the SAME two fields** into `boq-writers.ts:19-25`, `preload/index.d.ts:14-20`, `preload/index.ts:14-20`. (preload mirrors omit `categoryId` — leave that as-is; just add `rate`/`cost`.)

**`BoqRowType` (lines 19-25)** — drop `'perimeter-area'`; optionally rename `'perimeter-length'` → `'perimeter'` (CONTEXT line 50, planner's discretion):
```typescript
export type BoqRowType =
  | 'count'
  | 'linear'
  | 'area'
  | 'perimeter-length'   // ← if renaming: 'perimeter'
  | 'perimeter-area'     // ← DELETE this member
  | 'wall'
```
Mirror the drop into all 4 files. If renamed, also update `uomFor` (aggregator:35-40), `rowTypeToMarkupType` (TotalsRow:69-72), `labelToName` regex (TotalsRow:64-66), and the `(count|linear|area|perimeter|wall)` regex.

**`BoqSubtotal` (lines 55-58)** — quantity subtotal stays per-UoM. CONTEXT (line 32) wants a **cost** subtotal that is a single ₱ number per category (unit-agnostic). Two options: extend `BoqCategoryGroup`/`BoqStructure` with a `costSubtotal: number` + `grandCost: number`, OR add `cost` to `BoqSubtotal`. **Recommended:** add `costSubtotal: number` to `BoqCategoryGroup` (lines 61-68) and `grandCost: number` to `BoqStructure` (lines 75-81), because cost is unit-agnostic and does not fit the per-UoM `BoqSubtotal[]` shape. These structural additions must be mirrored into the writer + preload `BoqCategoryGroup`/`BoqStructure` too.

#### 3b. `src/renderer/src/lib/boq-aggregator.ts`
**Analog A — the `add()` accumulator + `RawAccumulator` (lines 20-23, 107-113).** Rate is per-(name,type), read once. The accumulator currently holds `{ quantity, color }`:
```typescript
interface RawAccumulator {
  quantity: number
  color: string | null
}
...
  function add(categoryId: string | null, name: string, type: BoqRowType, qty: number): void {
    const map = bucketFor(categoryId)
    const k = `${name}|${type}`
    const cur = map.get(k) ?? { quantity: 0, color: getColorForName(name) }
    cur.quantity += qty
    map.set(k, cur)
  }
```
**Change:** rate does NOT belong in the accumulator (it's not summed). Read it where the **row is built** (step 2b, lines 217-224), keyed by `` `${name}|${type}` `` — the same `k` shape. Add a `rates` input to `AggregateOptions` (boq-types.ts:88-98) defaulting to `useProjectStore.getState().rates` (mirror how `getColorForName` defaults at aggregator lines 89-90).

**Analog B — the row-build push (lines 217-224)** — this is where `rate` + `cost` get computed and attached:
```typescript
      items.push({
        label,
        quantity: acc.quantity,
        uom: uomFor(type, globalUnit),
        color: acc.color,
        type,
        categoryId: groupCategoryId
        // → add:
        //   const rate = rates[`${name}|${type}`] ?? 0
        //   rate,
        //   cost: rate * acc.quantity
      })
```

**Analog C — the subtotal loop (lines 231-239)** — quantity subtotals accumulate per-UoM into `byUom` + `grandByUom`. **Add a parallel cost accumulator:**
```typescript
    const byUom = new Map<string, number>()
    for (const it of items) {
      byUom.set(it.uom, (byUom.get(it.uom) ?? 0) + it.quantity)
      grandByUom.set(it.uom, (grandByUom.get(it.uom) ?? 0) + it.quantity)
    }
    // → add a sibling:  let catCost = 0; for (const it of items) catCost += it.cost
    //   then attach costSubtotal: catCost to the pushed category (line 245)
    //   and accumulate a module-scope grandCost for the return (line 274)
```
Category push is at line 245 (`categories.push({ name: catName, items, subtotals })` → add `costSubtotal`). Return is at line 274 (`return { metadata, categories, grandTotals }` → add `grandCost`).

#### 3c. perimeter LENGTH add MUST stay arc-aware
When deleting the perimeter-area arm (see §5), the **length** add (lines 150-154) must be preserved **exactly** — it is arc-aware via the closing-augmented `m.arcs` (CONTEXT lines 51, 105; do NOT regress Phase 14):
```typescript
        const pts = (m as PerimeterMarkup).points
        const closingPts = [...pts, pts[0]]
        const pxL = polylineLength(closingPts, m.arcs)
        const realL = pixelLengthToReal(pxL, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'perimeter-length', realL)   // KEEP (rename type if renaming)
```

---

### 4. Rate/Cost export columns → mirror Quantity column + subtotal rows

#### 4a. `src/main/boq-writers.ts` — XLSX (buildBoqXlsx)
**Analog A — column declaration (lines 111-115).** Columns are declared by `key` + `width` BEFORE rows:
```typescript
  ws.columns = [
    { key: 'item', width: COL_WIDTH_ITEM },
    { key: 'quantity', width: COL_WIDTH_QTY },
    { key: 'uom', width: COL_WIDTH_UOM }
    // → add:  { key: 'rate', width: COL_WIDTH_RATE }, { key: 'cost', width: COL_WIDTH_COST }
  ]
```
**Analog B — title row (line 126)** — column order is set here; CONTEXT line 44 mandates **Item · Quantity · UoM · Rate · Cost**:
```typescript
  ws.addRow(['Item', 'Quantity', 'UoM'])   // → ['Item','Quantity','UoM','Rate','Cost']
```
**Analog C — `appendItemRow` (lines 164-177)** — the per-row builder. Quantity is set as a **native number** with a `numFmt` so `SUM()` works (Pitfall 3, line 167). Rate/Cost follow the identical native-number + numFmt approach:
```typescript
function appendItemRow(ws: ExcelJS.Worksheet, item: BoqItemRow): void {
  const r = ws.addRow([safeText(item.label), item.quantity, item.uom])
  const qtyCell = r.getCell(2)
  qtyCell.value = item.quantity
  qtyCell.numFmt = numFmtForUom(item.uom)
  if (item.color !== null) { ...fill cell 1... }
}
```
**Replicate:** push `item.rate` (cell 4) + `item.cost` (cell 5) into the `addRow` array; set `getCell(4).numFmt` / `getCell(5).numFmt` to the ₱ format (CONTEXT line 45: ₱ numFmt, 2 decimals — Claude's discretion on exact string, line 68). Keep them native numbers (never `safeText` a number — see writer comment lines 71-75).

**Analog D — `appendSubtotalRow` (lines 180-187) + Grand Total (lines 140-147).** Quantity subtotals are emitted per-UoM. Cost subtotal is **one ₱ number per category** (CONTEXT line 45). The bold+fill row shape:
```typescript
function appendSubtotalRow(ws: ExcelJS.Worksheet, sub: BoqSubtotal): void {
  const r = ws.addRow([safeText('Subtotal'), sub.total, sub.uom])
  r.font = { bold: true }
  r.getCell(2).numFmt = numFmtForUom(sub.uom)
  r.eachCell((c) => { c.fill = {...SUBTOTAL_FILL_ARGB...} })
}
```
**Replicate:** after the per-UoM quantity subtotals for a category (loop at line 136), emit ONE cost-subtotal row (e.g. `['Subtotal (cost)', null, null, null, cat.costSubtotal]` with ₱ numFmt on the cost cell + bold + `SUBTOTAL_FILL_ARGB`). Same for grand-total cost after the grandTotals loop (line 147), using `GRAND_TOTAL_FILL_ARGB`. The category loop is at lines 133-137:
```typescript
  for (const cat of b.categories) {
    appendCategoryHeading(ws, cat.name)
    for (const item of cat.items) appendItemRow(ws, item)
    for (const sub of cat.subtotals) appendSubtotalRow(ws, sub)
    // → add:  appendCostSubtotalRow(ws, cat.costSubtotal)
  }
```

#### 4b. `src/main/boq-writers.ts` — CSV (buildBoqCsv)
**Analog — item + subtotal push (lines 217-230).** CSV emits rows as arrays; quantity is rounded/fixed at write time:
```typescript
    for (const item of cat.items) {
      rows.push([
        safeText(item.label),
        item.uom === 'ea' ? Math.round(item.quantity) : Number(item.quantity.toFixed(2)),
        item.uom
      ])
    }
    for (const sub of cat.subtotals) {
      rows.push([
        safeText('Subtotal'),
        sub.uom === 'ea' ? Math.round(sub.total) : Number(sub.total.toFixed(2)),
        sub.uom
      ])
    }
```
**Replicate:** append `Number(item.rate.toFixed(2))` and `Number(item.cost.toFixed(2))` as cols 4/5 (CONTEXT line 46: numeric columns, no ₱ glyph in CSV — keep raw numeric like quantity). Add the header (line 213: `rows.push(['Item', 'Quantity', 'UoM'])` → append `'Rate','Cost'`). Add a cost-subtotal row per category + grand cost (lines 233-239), padding the unused middle columns with `''` (heading rows already pad: line 216 `rows.push([safeText(cat.name), '', ''])`).

---

### 5. Perimeter-area removal (delete the paired arm everywhere)

#### 5a. `src/renderer/src/lib/boq-aggregator.ts`
**(i) Synthesis (lines 155-159) — DELETE the area add + its math, KEEP the length add above it (lines 150-154):**
```typescript
        add(catId, m.name, 'perimeter-length', realL)
        // ↓↓↓ DELETE these 4 lines (the perimeter-AREA arm) ↓↓↓
        const pxA = polygonArea(pts, m.arcs)
        const realA = pixelAreaToReal(pxA, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'perimeter-area', realA)
```
**(ii) D-02 collision exclusion (lines 190-200) — perimeter becomes a FIRST-CLASS collision member (CONTEXT lines 55-56).** Today the collision-set build SKIPS perimeter:
```typescript
    const nameNonPerimTypes = new Map<string, Set<BoqRowType>>()
    for (const k of bucket.keys()) {
      const [name, type] = k.split('|') as [string, BoqRowType]
      if (type === 'perimeter-length' || type === 'perimeter-area') continue   // ← REMOVE this skip
      ...
      s.add(type)
    }
```
**Change:** drop the `continue` so `perimeter-length` (or `perimeter`) participates in the collision count.

**(iii) Label rules (lines 205-216) — perimeter must follow the SAME suffix rule as count/linear/area, not its own hardcoded `(perimeter)`/`(area)` branch:**
```typescript
      let label = name
      if (type === 'perimeter-length') {
        label = `${name} (perimeter)`        // ← REMOVE this always-suffix branch
      } else if (type === 'perimeter-area') {
        label = `${name} (area)`             // ← REMOVE (type is gone)
      } else {
        const nonPerimSet = nameNonPerimTypes.get(name)
        if (nonPerimSet && nonPerimSet.size >= 2) {
          label = `${name} (${nonPerimeterTypeWord(type)})`
        }
      }
```
**Replicate:** collapse to the single `else` branch's rule for ALL types (including perimeter): suffix `(perimeter)` ONLY when the same name has ≥2 colliding types in the category. **`nonPerimeterTypeWord` (lines 42-46) must be extended** to return `'perimeter'` for the perimeter type (CONTEXT line 56 — "must handle the perimeter case"):
```typescript
function nonPerimeterTypeWord(t: BoqRowType): 'count' | 'linear' | 'area' {
  if (t === 'count') return 'count'
  if (t === 'linear') return 'linear'
  return 'area'
}
// → add a 'perimeter' (or 'perimeter-length') case; rename the helper (e.g. typeWord) since it's no longer "non-perimeter"
```
**(iv) `uomFor` (lines 35-40)** already maps `perimeter-length` → `globalUnit` (line 37) — keep that line (rename the literal if renaming the type).

#### 5b. `src/renderer/src/components/markup/PerimeterMarkup.tsx`
**(i) Remove the fill (line 118) — render an UNFILLED closed outline (CONTEXT line 59):**
```typescript
      <Line
        points={flatPoints}
        closed
        stroke={markup.color}
        strokeWidth={strokeWidth}
        fill={`${markup.color}33`}   // ← DELETE this line (keep closed + stroke)
        lineJoin="round"
      />
```
**(ii) Label → length only (lines 79-88) — drop the area half + the area math:**
```typescript
  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const pixelArea = polygonArea(effectivePoints, effectiveArcs)        // ← DELETE
    const closedPoints = [...effectivePoints, effectivePoints[0]]
    const pixelPerim = polylineLength(closedPoints, effectiveArcs)
    const realPerim = pixelLengthToReal(pixelPerim, pageScale.pixelsPerMm, pageScale.displayUnit)
    const realArea = pixelAreaToReal(pixelArea, pageScale.pixelsPerMm, pageScale.displayUnit) // ← DELETE
    const u = pageScale.displayUnit
    labelText = `P: ${realPerim.toFixed(1)} ${u}  A: ${realArea.toFixed(1)} ${u}²`  // → `P: ${realPerim.toFixed(1)} ${u}`
  }
```
**(iii) Imports (lines 5-11)** — `polygonArea` + `pixelAreaToReal` become unused; remove them from the import (keep `polygonCentroid`, `polylineLength`, `pixelLengthToReal`):
```typescript
import {
  polygonArea,        // ← DELETE
  polygonCentroid,    // keep (centroid still positions the label)
  polylineLength,     // keep
  pixelAreaToReal,    // ← DELETE
  pixelLengthToReal   // keep
} from '../../lib/markup-math'
```
**KEEP** the arc-aware `buildArcAwareFlatPoints(effectivePoints, effectiveArcs, true)` (line 76) and `effectiveArcs` (line 75) — the closed outline stays arc-aware.

#### 5c. Totals UI references to `perimeter-area`/`perimeter-length`
- `src/renderer/src/components/TotalsRow.tsx` — `rowTypeToMarkupType` (lines 69-72) maps both perimeter sub-types → `'perimeter'`; `labelToName` regex (line 65) includes `perimeter`. If `perimeter-area` is dropped (and/or `perimeter-length` renamed), update both. No "area" suffix to strip anymore.
- `src/renderer/src/components/TotalsCategoryBlock.tsx` — `rowTypeToMarkupType` is imported from TotalsRow (line 5); its docstring (lines 26-27) mentions "perimeter-length / perimeter-area both map to underlying 'perimeter'" — update the comment.
- `src/preload/index.d.ts` (line 6) + `src/preload/index.ts` (line 16) — drop `'perimeter-area'` from the mirrored `BoqRowType`.

---

## Net-new UI render (NOT a modify of existing rendered rows)

> Flagged so the planner doesn't assume these already render: **quantity subtotals and the grand-total bar are NOT currently painted in the UI.** Only the writers render subtotals; the panel does not.

- **`TotalsCategoryBlock.tsx` line 135** — the body block maps `category.items` (117-133) and then closes; there is **no `category.subtotals` render**. The per-category **cost subtotal** is therefore a fresh render slot here (after the items map), styled like a bold row using `COLORS` tokens (mirror the heading row style at lines 79-92, or the writer's bold+fill intent).
- **`TotalsPanel.tsx` lines 250-264** — maps categories; despite the docstring's "pinned grand-total bar" (line 17) there is **no grand-total element**. The **grand-total cost** bar is a fresh element at the bottom of the panel (or a row in `TotalsPanelHeader`'s `rows[]`, lines 29-35). Use `COLORS.secondary` background + `fontWeight: 600` to match the panel's existing chrome rows (e.g. the Totals header at lines 177-197).
- **`TotalsPanelHeader.tsx` lines 29-35** — the `rows[]` array is the cleanest seam to surface a single `Grand Total: ₱X.XX` line if a bottom bar isn't desired; just push one more `{ label, value }` entry.

---

## No Analog Found

None. Every file in scope is a modify-in-place against a strongly-patterned existing file. The only "no prior art" pieces are tiny:
- The `CURRENCY_SYMBOL` constant (trivial — copy the `COLORS` const-export shape).
- The cost-subtotal / grand-cost **render** in the panel (no existing subtotal render to copy — use the writer's subtotal styling intent + the panel's existing `COLORS` row chrome as the visual analog).

---

## Tests to update (CONTEXT line 106 — assertions that will break)

| Test file | Why it breaks | What to change |
|-----------|---------------|----------------|
| `src/tests/totals-row-cycle.test.ts` (lines 287-333) | Asserts a `'perimeter-area'` BoqRowType row + label `(area)` | Drop the perimeter-area case; keep the `perimeter`→underlying-`perimeter` mapping assertion |
| `src/tests/boq-aggregator.test.ts` | Asserts two-row perimeter synthesis + `(perimeter)`/`(area)` labels | Expect ONE perimeter row; new collision-suffix rule |
| `src/tests/boq-aggregator-wall.test.ts` | If it asserts perimeter alongside wall | Update perimeter expectations only |
| `src/tests/boq-writers-xlsx.test.ts` | Column count (3→5), subtotal rows, no perimeter-area | Add Rate/Cost columns + cost subtotal/grand assertions |
| `src/tests/boq-writers-csv.test.ts` | Same as xlsx | Add Rate/Cost numeric columns |
| `src/tests/project-schema.test.ts` | `validateV2` round-trip | Add `rates?` tolerance + no-throw assertion |
| `src/tests/project-serialize.test.ts` | snapshot/hydrate round-trip | Add `rates` persist + legacy-default `{}` |
| `src/tests/totals-row-context-menu.test.ts` | References perimeter sub-types | Update if it asserts `perimeter-area` |
| `src/tests/markup-visibility.test.ts`, `markup-post-commit-reopen.test.ts`, `highlight-overlay-listening.test.ts` | May assert perimeter fill / two-row behavior | Update perimeter render/aggregation expectations |

---

## Metadata

**Analog search scope:** `src/renderer/src/lib/`, `src/renderer/src/stores/`, `src/renderer/src/components/`, `src/renderer/src/components/markup/`, `src/renderer/src/hooks/`, `src/main/`, `src/preload/`, `src/tests/`
**Files scanned:** 13 source + 4 type-mirror confirmations + 1 input-pattern analog (ScalePopup)
**Pattern extraction date:** 2026-06-29
