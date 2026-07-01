# Phase 16: Estimating Workspace - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 13 (9 EXTEND, 3 REVERT/REMOVE, 3 NEW; some files are both a revert target AND a new-pattern analog)
**Analogs found:** 13 / 13 (100% — this phase is almost entirely an extension of Phase 15's own code)

> **Orientation for the planner.** Phase 16 has an unusually tight analog story: nearly every new/changed file's closest analog is the *same file* (EXTEND) or a *sibling file in the same directory* (NEW). Phase 15 already built the single-`rate` version of this exact feature end-to-end; Phase 16 (a) widens the scalar `rate` to `{material,labor,markup}` through the same seams, and (b) **moves** the UI out of the narrow totals panel into a new full-width Estimate grid. The revert map (§"Revert / Remove") and the extend map (§"Pattern Assignments") are therefore the load-bearing sections — read them together.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `src/renderer/src/components/EstimatePanel.tsx` (or `EstimateWorkspace.tsx`) | component (view container) | request-response (reads live BOQ) | `src/renderer/src/components/TotalsPanel.tsx` | role-match (container + grand-total bar) |
| **NEW** `src/renderer/src/components/EstimateRow.tsx` | component (editable grid row) | CRUD (per-cell rate/markup edit → store) | `src/renderer/src/components/TotalsRow.tsx` | **exact** (inline editable ₱ cell + native-listener commit) |
| **NEW** `src/renderer/src/components/EstimateCategoryBlock.tsx` | component (category group + subtotals) | request-response | `src/renderer/src/components/TotalsCategoryBlock.tsx` | **exact** |
| **NEW** `src/renderer/src/hooks/useEstimateLive.ts` | hook | request-response (memoized aggregate) | `src/renderer/src/hooks/useBoqLive.ts` | **exact** |
| **EXTEND** `src/renderer/src/stores/projectStore.ts` | store | CRUD (rate map) | *itself* (`rates: Record<string,number>` → `Record<string, PriceEntry>`) | **exact (self)** |
| **EXTEND** `src/renderer/src/lib/project-schema.ts` | model/schema | file-I/O (round-trip) | *itself* (`rates?` additive field) | **exact (self)** |
| **EXTEND** `src/renderer/src/lib/project-serialize.ts` | model/serialize | file-I/O (snapshot + hydrate-coerce) | *itself* (finite-≥0 hydrate guard) | **exact (self)** |
| **EXTEND** `src/renderer/src/lib/boq-types.ts` | model (types) | transform | *itself* (`rate`/`cost` → six fields) | **exact (self)** |
| **EXTEND** `src/renderer/src/lib/boq-aggregator.ts` | service (pure aggregator) | transform (rate × qty) | *itself* (`cost` → material/labor/cost/markup/price/margin) | **exact (self)** |
| **EXTEND** `src/main/boq-writers.ts` | writer (main process) | file-I/O (xlsx/csv) | *itself* (Rate/Cost cols → six cols) | **exact (self)** |
| **EXTEND** `src/preload/index.ts` | config (IPC wire types) | request-response | *itself* (BoqItemRow mirror) | **exact (self)** |
| **EXTEND** `src/preload/index.d.ts` | config (IPC type decl) | request-response | *itself* (BoqItemRow mirror) | **exact (self)** |
| **NEW/EXTEND** view-mode state (`viewMode: 'plan' \| 'estimate'`) | store | event-driven (toggle) | `src/renderer/src/stores/viewerStore.ts` `activeTool` (LOCKED — beside activeTool, session-only) | exact (self) |
| **EXTEND** `src/renderer/src/components/RibbonToolbar.tsx` `renderEstimatingTab()` | component (ribbon tab) | event-driven | *itself* (`renderEstimatingTab` lines 529-555; toggle analog = tab strip lines 614-647) | **exact (self)** |
| **EXTEND** `src/renderer/src/App.tsx` (main-area mount) | component (shell/layout) | request-response | *itself* (center-column `totalPages === 0 ? EmptyState : CanvasViewport`, lines 325-336) | **exact (self)** |

**REVERT / REMOVE (Phase 15 Plan 15-03 totals-panel pricing — strip; see dedicated §):**
`TotalsRow.tsx` (inline ₱ input + cost span), `TotalsCategoryBlock.tsx` (cost-subtotal render), `TotalsPanel.tsx` (grand-total bar).

---

## Shared Patterns

These cross-cutting patterns apply to multiple Phase 16 files. Extract once here; each Pattern Assignment references back.

### SP-1 — Additive persisted field, NO formatVersion bump (D-06)

**Source:** `src/renderer/src/lib/project-schema.ts:83-96` + the whole Phase-15 `rates` round-trip.
**Apply to:** `projectStore.ts`, `project-schema.ts`, `project-serialize.ts`.

Phase 15 added `rates?` as a purely additive optional field on `ProjectFileV2` with **no `validateV2` branch** and **no formatVersion bump** — it rides the trailing `return raw as ProjectFileV2` cast exactly like `hiddenItemNames?`. CONTEXT D-06 explicitly says "prefer the same additive approach." The exact precedent to copy:

```typescript
// project-schema.ts:88-95 — the additive-field JSDoc + declaration
  /**
   * Additive in Phase 15 — absent in pre-Phase-15 files; defaults to {} on load.
   * Per-(name|type) unit rate in ₱ ... NO formatVersion bump — validateV2 adds no
   * branch, the field rides the trailing `return raw as ProjectFileV2` cast exactly
   * like hiddenItemNames. Malformed values are sanitized at hydrate, not here.
   */
  rates?: Record<string, number>
```

For Phase 16 the value type widens from `Record<string, number>` → `Record<string, PriceEntry>` where `PriceEntry = { material: number; labor: number; markup?: number }`. **Legacy mapping (D-06, RESEARCH to finalize):** a Phase-15 `.clmc` carries `rates: Record<string, number>`; the hydrate coercion (SP-2) must accept the legacy scalar and map it — proposed `number n → { material: n, labor: 0 }`, missing `markup → 30`. This is the one place the shape mismatch is absorbed.

### SP-2 — Untrusted-disk hydrate coercion (finite-≥0 guard) — T-15-02-01 mitigation

**Source:** `src/renderer/src/lib/project-serialize.ts:113-133`.
**Apply to:** `project-serialize.ts` `hydrateStores`.

Rates flow into cost math (`rate × qty`) and ₱ export cells, so a crafted/corrupt `.clmc` is an untrusted surface. The Phase-15 guard drops any entry whose value is not a finite number ≥ 0; `rates` defaults to `{}` when absent/non-object. **This is the exact function that must be widened in Phase 16** — it currently coerces a `number`; it must now coerce/validate each field of a `PriceEntry` (material ≥ 0, labor ≥ 0, markup finite ≥ 0 or default), AND accept the legacy scalar form for back-compat:

```typescript
// project-serialize.ts:119-133 — the guard to WIDEN (currently scalar)
    const safeRates: Record<string, number> = {}
    if (data.rates && typeof data.rates === 'object') {
      for (const [k, v] of Object.entries(data.rates)) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) safeRates[k] = v
      }
    }
    // ...
    useProjectStore.setState({
      hiddenItemNames: Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : [],
      hiddenItemSet: new Set(Array.isArray(data.hiddenItemNames) ? data.hiddenItemNames : []),
      rates: safeRates
    })
```

Phase-16 shape: `if (typeof v === 'number')` becomes the legacy branch (`→ {material:v, labor:0, markup:30}`); `else if (v && typeof v === 'object')` validates `material`/`labor`/`markup` per-field. Snapshot side (`project-serialize.ts:60-62`) already emits `rates` verbatim — no change beyond the wider value type.

### SP-3 — Store action mirrors `toggleHiddenItem` incl. trailing `markDirty()`

**Source:** `src/renderer/src/stores/projectStore.ts:111-114` (`setRate`) — itself modeled on `toggleHiddenItem` (`:96-105`).
**Apply to:** `projectStore.ts` new/updated setter(s).

The load-bearing detail: **every rate mutation must call `get().markDirty()`** or the edit won't survive Save. `setRate` today:

```typescript
// projectStore.ts:111-114
  setRate: (key, rate) => {
    set((s) => ({ rates: { ...s.rates, [key]: rate } }))
    get().markDirty()
  }
```

Phase 16 needs a field-level setter for the material / labor / markup fields on the *same* `${name}|${type}` key. Locked action shape (per the plans): `setPrice(key, partial)` — merge a `Partial<PriceEntry>` into the existing entry, preserving unspecified fields, then `markDirty()`:

```typescript
// setPrice — mirror setRate's markDirty discipline, merging a partial PriceEntry
  setPrice: (key, partial) => {
    set((s) => {
      const cur = s.rates[key] ?? { material: 0, labor: 0 }
      return { rates: { ...s.rates, [key]: { ...cur, ...partial } } }
    })
    get().markDirty()   // <-- MUST keep; identical to setRate / toggleHiddenItem
  }
```

Also update `reset()` (`:85-94`) and the initial state (`:68`) — `rates: {}` stays correct for the widened value type (empty map is shape-agnostic). The derived-`Set` note in the store docstring (`:15-20`) still holds: the rate map IS the O(1) lookup; no derived structure needed.

### SP-4 — The ₱ currency seam (KEEP verbatim)

**Source:** `src/renderer/src/lib/currency.ts:14` (`export const CURRENCY_SYMBOL = '₱'`) + `src/main/boq-writers.ts:55` (`const NUMFMT_PESO = '₱#,##0.00'`).
**Apply to:** every ₱ consumer in the new Estimate grid + the widened writer.

CONTEXT §"KEEP" is explicit: keep the ₱ seam. The renderer imports `CURRENCY_SYMBOL` from `../lib/currency`; the **main process keeps its OWN local `NUMFMT_PESO`** (cannot import a renderer constant across the process boundary — `boq-writers.ts:47-55` documents this convention). New Estimate components import `CURRENCY_SYMBOL` the same way TotalsRow/TotalsCategoryBlock/TotalsPanel do today. **Do not create a second currency module.**

### SP-5 — Defensive `Number.isFinite(x) ? x : 0` at every ₱ render/write point

**Source (renderer):** `TotalsRow.tsx:68-71` (`formatCost`), `TotalsCategoryBlock.tsx:155`, `TotalsPanel.tsx:291`. **Source (main):** `boq-writers.ts:119-121` (`money()`), applied at all 8 write points.
**Apply to:** all six ₱ columns in the Estimate grid AND all new writer cells.

Every ₱ value coerces non-finite → 0 before `.toFixed(2)`. Two reasons (both still apply in Phase 16): (1) locked "no rate set = ₱0.00, never throw" rule; (2) do-not-edit legacy test fixtures build rows without the new fields, so they're `undefined` at runtime. The Estimate grid has SIX money columns (Material ₱, Labor ₱, Cost ₱, Price ₱, Margin ₱ — Markup is a %, not ₱) plus per-category and grand-total variants of Cost/Price/Margin; guard each.

```typescript
// The one-liner to replicate per ₱ cell (renderer form)
const cost = Number.isFinite(item.cost) ? item.cost : 0
return `${CURRENCY_SYMBOL}${cost.toFixed(2)}`
```

### SP-6 — Uncontrolled input + native listeners + `stopPropagation` (editable-cell commit)

**Source:** `src/renderer/src/components/TotalsRow.tsx:153-216` (the ref + `useEffect` native-listener block) and the input JSX at `:400-434`.
**Apply to:** every editable cell in `EstimateRow.tsx` (material rate, labor rate, markup %).

This is the single most important UI pattern to copy and the one most likely to be re-derived incorrectly. The inline field is **uncontrolled** (`defaultValue`, `ref`) with **native** `input`/`blur`/`keydown` listeners — NOT React `onChange`/`onBlur`. Rationale (proven in 15-03): React's synthetic `onChange` is suppressed by its value-tracker under programmatic `.value` set + native `input` dispatch, and React delegates blur as `focusout` so a raw `blur` never reaches a synthetic `onBlur`. The full mechanism:

```typescript
// TotalsRow.tsx:160-216 — the pattern EstimateRow's cells must replicate PER FIELD
  const rateInputRef = useRef<HTMLInputElement | null>(null)

  // Seed/refresh from store; only overwrite when DOM value differs (never clobber mid-type)
  const seedRateText = (r: number): string => (Number.isFinite(r) && r > 0 ? String(r) : '')
  useEffect(() => {
    const el = rateInputRef.current
    if (!el) return
    const next = seedRateText(rate)
    if (el.value !== next) el.value = next
  }, [rateKey, rate])

  // Commit: parseFloat, clamp NaN/negative → 0 (matches the ≥0 hydrate filter — money-bug guard)
  const commitRate = (text: string): void => {
    const parsed = parseFloat(text)
    const safe = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
    useProjectStore.getState().setRate(rateKey, safe)
  }

  useEffect(() => {
    const el = rateInputRef.current
    if (!el) return
    const onCommit = (): void => commitRate(el.value)
    const onKeyDown = (e: KeyboardEvent): void => { e.stopPropagation(); if (e.key === 'Enter') commitRate(el.value) }
    const onStop = (e: Event): void => e.stopPropagation()
    el.addEventListener('input', onCommit)
    el.addEventListener('blur', onCommit)          // 'change' intentionally omitted (WR-02)
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('click', onStop)
    el.addEventListener('mousedown', onStop)
    return () => { /* symmetric removeEventListener for all five */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateKey])
```

**Markup-% caveat (D-05):** markup is a percentage that *defaults to 30%*. The empty/blank field must mean "use 30% default", not "0%". So `commitMarkup` differs from `commitRate`: an empty/NaN field → clear the stored markup (fall back to 30%), a typed value → clamp ≥ 0. Design the `seed`/`commit` pair for markup accordingly (this is the one field where the "blank = 0" rule from `commitRate` does NOT transfer).

In a full-width **grid** (vs the narrow panel), the `stopPropagation` guards on the cell matter less than in TotalsRow (there's no row-cycle/arm-tool click behavior to protect if the Estimate rows aren't clickable) — but keep the native-listener commit; that part is about React event semantics, not layout.

### SP-7 — Live memoized aggregate over top-level Zustand selectors (`rates` in deps)

**Source:** `src/renderer/src/hooks/useBoqLive.ts` (whole file, esp. `:42` selector + `:58` deps).
**Apply to:** `useEstimateLive.ts` (new) — or reuse `useBoqLive` directly (Open-Q resolution below).

`rates` is BOTH a top-level primitive selector (`:42 const rates = useProjectStore((s) => s.rates)`) AND a `useMemo` dependency (`:58`), so an inline rate edit recomputes cost live with no other store change. When Phase 16 widens `rates` to the `PriceEntry` map, this selector/dep pair carries the material/labor/markup edits into the live recompute automatically — the memo re-runs on any new `rates` identity. **Recommendation:** the Estimate grid consumes the same `BoqStructure` the aggregator already produces (widened per SP-8), so `useBoqLive` can be reused as-is; a separate `useEstimateLive` is only warranted if the grid needs a differently-shaped selector (it likely does not). If a new hook is created, copy the "nine primitives, each a top-level selector, all in the deps array" discipline verbatim, and add nothing that returns a fresh object/array identity per render (that loops React — see the `EMPTY_MARKUPS` note in TotalsPanel).

### SP-8 — Aggregator computes derived money per row; unit-agnostic category/grand accumulators

**Source:** `src/renderer/src/lib/boq-aggregator.ts:217-231` (per-row rate/cost), `:236-255` (per-category costSubtotal), `:184/245/284` (grandCost).
**Apply to:** `boq-aggregator.ts` (the six-field expansion) and, by mirror, `boq-types.ts` + the writers.

The aggregator is the ONE place cost math lives; the UI does zero arithmetic (TotalsRow reads `item.cost` directly). Phase 16 expands the per-row block:

```typescript
// boq-aggregator.ts:217-231 — the block to EXPAND (currently rate → cost)
      const rate = rates[`${name}|${type}`] ?? 0
      const cost = rate * acc.quantity
      items.push({ label, quantity: acc.quantity, uom: uomFor(type, globalUnit),
        rate, cost, color: acc.color, type, categoryId: groupCategoryId })
```

Phase-16 form (per D-03/D-04/D-05):
```typescript
      const entry = rates[`${name}|${type}`] ?? { material: 0, labor: 0 }
      const markup = Number.isFinite(entry.markup) ? entry.markup! : 30     // D-05 default (percent, 0–100)
      const materialCost = entry.material * acc.quantity
      const laborCost    = entry.labor    * acc.quantity
      const cost         = materialCost + laborCost                          // D-03
      const price        = cost * (1 + markup / 100)                        // D-05 (markup is a percent)
      const margin       = price - cost                                     // D-05
      items.push({ label, quantity, uom, material: entry.material, labor: entry.labor,
        materialCost, laborCost, cost, markup, price, margin, color, type, categoryId })
```
Then the category accumulator (`catCost`, `:239-245`) becomes three parallel unit-agnostic sums (`costSubtotal`, `priceSubtotal`, `marginSubtotal`) and the grand accumulator (`grandCost`, `:184/245/284`) likewise (`grandTotalCost`, `grandTotalPrice`, `grandTotalMargin`) — each a single number PARALLEL to (not bucketed by) the per-UoM quantity subtotals, exactly as `costSubtotal` is today. **Keep the `opts.rates ?? useProjectStore.getState().rates` default (`:95`) and the `${name}|${type}` key shape unchanged.**

### SP-9 — Cross-process type duplication lock (4 copies, kept in lockstep)

**Source:** `boq-types.ts:23-92` (canonical) mirrored inline in `boq-writers.ts:11-40`, `preload/index.ts:16-45`, `preload/index.d.ts:6-35`.
**Apply to:** all four when adding the six BoqItemRow fields + the three subtotal/grand fields.

There is **no shared types directory** (RESEARCH Open-Q4, locked). `BoqRowType`/`BoqItemRow`/`BoqCategoryGroup`/`BoqStructure` are duplicated in four files; Wave-0 tests import both sides so TS surfaces drift at compile time. Phase 15 shipped this exact 4-way lock for `rate`/`cost`/`costSubtotal`/`grandTotalCost`. Phase 16 adds the wider field set to **all four** in the same change (note the two deliberate drifts to preserve: `preload/index.ts` omits `categoryId` and carries a stray historical `'wall'`; the canonical `boq-types.ts` keeps `categoryId?`).

---

## Pattern Assignments

### `src/renderer/src/components/EstimatePanel.tsx` (NEW — component / view container)

**Analog:** `src/renderer/src/components/TotalsPanel.tsx` (grand-total bar + category-list orchestration) and the App-shell mount site.

**What to copy:**
- The **live-BOQ subscription + category map** (`TotalsPanel.tsx:92`, `:251-263`): `const boq = useBoqLive()`, then `boq.categories.map((cat) => <EstimateCategoryBlock category={cat} .../>)`.
- The **grand-total bar** (`TotalsPanel.tsx:272-294`) — but the Estimate version pins THREE totals (Cost / Price / Margin, D-07) instead of one, each guarded per SP-5. Copy the chrome (secondary bg, 600 weight, top border, `tabular-nums`, suppressed when `totalPages === 0`):
```typescript
// TotalsPanel.tsx:289-292 — the grand-total value render to triple
  <span>Grand Total:</span>
  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
    {`${CURRENCY_SYMBOL}${(Number.isFinite(boq.grandTotalCost) ? boq.grandTotalCost : 0).toFixed(2)}`}
  </span>
```
- The **empty-state decision tree** (`TotalsPanel.tsx:143-151`) adapted to the Estimate copy ("Open a PDF…", "Place markups…").

**What is DIFFERENT (new, no analog):** the grid is **full-width** and replaces the canvas in the main area (D-01), not a right rail. So the outer container is not the 320px-panel chrome — it fills the center column. Column headers grouped `Item · Qty · UoM | Material ₱ · Labor ₱ · Cost ₱ | Markup % · Price ₱ · Margin ₱` (D-07) are net-new; there is no existing multi-column grid header in the codebase (TotalsPanel has no column header row — see §"No Analog Found"). Use plain fl/grid CSS in the app's dark palette (`COLORS` from `../lib/constants`), matching the mockup.

**Imports pattern to copy** (`TotalsPanel.tsx:1-13`): `COLORS` from `../lib/constants`, `CURRENCY_SYMBOL` from `../lib/currency`, `useBoqLive` from `../hooks/useBoqLive`, types from `../lib/boq-types`.

---

### `src/renderer/src/components/EstimateRow.tsx` (NEW — editable grid row, CRUD)

**Analog:** `src/renderer/src/components/TotalsRow.tsx` — **exact** (this is the whole reason TotalsRow's inline-rate machinery exists).

**Copy directly:**
- **SP-6** (uncontrolled input + native listeners + commit) for EACH of the three editable cells (material, labor, markup). `TotalsRow.tsx:153-216` + input JSX `:400-434`.
- **SP-5** (`formatCost`-style non-finite guard) for the three read-only ₱ cells (materialCost or Cost, Price, Margin) — `TotalsRow.tsx:68-71`.
- The **`rateKey` derivation** (`TotalsRow.tsx:144-147`): `${itemName}|${item.type}`, category-INDEPENDENT, DISTINCT from the `name|categoryId` visibility key. This exact key feeds `setPrice`.
- The **store read** pattern (`TotalsRow.tsx:151`): `const entry = useProjectStore((s) => s.rates[rateKey] ?? DEFAULT_ENTRY)` — top-level primitive selector; widen the fallback from `?? 0` to `?? { material: 0, labor: 0 }`.
- The **`labelToName`** import (`TotalsRow.tsx:74-76`) to strip the D-02 `(count)`/`(perimeter)` suffix before building `rateKey`.

**Markup cell caveat:** see SP-6 — blank markup = 30% default, not 0%. This is the only field whose commit/seed diverges from the copied `commitRate`.

**Drop (do NOT carry over from TotalsRow):** the cycle-dot slot (`:305-326`), the lightbulb visibility toggle (`:328-342`), the color-chip (`:344-355` — or keep a small chip if the mockup shows one; the mockup review is the authority), the row-click cycle-nav / `onArmTool` handlers (`:230-277`), and the `Plus` arm-tool affordance (`:451-458`). Those are Plan-view interactions; the Estimate grid is a spreadsheet, not a navigator. Keep ONLY the editable-cell commit machinery and the read-only value formatting.

---

### `src/renderer/src/components/EstimateCategoryBlock.tsx` (NEW — category group + subtotals)

**Analog:** `src/renderer/src/components/TotalsCategoryBlock.tsx` — **exact**.

**Copy:**
- The **category heading + collapse** (`TotalsCategoryBlock.tsx:66-108`) incl. `useUiPanels().collapsedCategories` persistence (`:47,:50,:72`) — the Estimate grid can reuse the same localStorage collapse state, or a parallel key; reuse is simpler and matches the "preferences follow the workstation" note in `useUiPanels.ts:9-11`.
- The **items map** (`:113-129`) → render `<EstimateRow>` per `category.items`.
- The **per-category subtotal render** (`:135-157`) — but TRIPLED for Cost / Price / Margin (D-07), each guarded per SP-5. The single existing render to replicate:
```typescript
// TotalsCategoryBlock.tsx:135-157 — the cost-subtotal block to triple (Cost/Price/Margin)
  <div data-testid="totals-category-cost-subtotal" style={{ /* bold secondary row, flex-end */ }}>
    <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
      {`${CURRENCY_SYMBOL}${(Number.isFinite(category.costSubtotal) ? category.costSubtotal : 0).toFixed(2)}`}
    </span>
  </div>
```
**Drop:** the `matchesForRow` markup-filter machinery (`:52-62`) and all the `onRowHover`/`onRowClick`/`onRowContextMenu`/`onTriggerPulse`/`onArmTool` props (`:36-42`) — those are Plan-view navigation, irrelevant to the Estimate spreadsheet.

---

### `src/renderer/src/hooks/useEstimateLive.ts` (NEW — hook) — OR reuse `useBoqLive`

**Analog:** `src/renderer/src/hooks/useBoqLive.ts` — **exact**. See SP-7. Prefer reusing `useBoqLive` directly (the widened `BoqStructure` already carries all six fields per row + the three subtotal/grand fields after SP-8). Only fork a new hook if a distinct selector shape is genuinely needed — copy the top-level-selector + full-deps discipline verbatim if so.

---

### `src/renderer/src/stores/projectStore.ts` (EXTEND — store)

**Analog:** *itself*. See **SP-1, SP-3**.
- Widen `rates: Record<string, number>` (`:20`, `:68`) → `Record<string, PriceEntry>` where `PriceEntry = { material: number; labor: number; markup?: number }`.
- Replace/augment `setRate` (`:111-114`) with field-level setter(s) that patch one field and call `markDirty()` (SP-3). Keep the docstring's "map IS the O(1) lookup" note (`:15-20`).
- `reset()` (`:85-94`) and initial `rates: {}` (`:68`) unchanged (empty map is shape-agnostic).
- Consider adding a project-wide **default markup** (30%) here or in a settings seam (D-05, Open-Q). Minimal v1: a module constant `DEFAULT_MARKUP_PCT = 30` consumed by the aggregator (SP-8) and the markup-cell seed; the "surface a Settings control later" is explicitly deferred (D-05, D-09).

---

### `src/renderer/src/lib/project-schema.ts` (EXTEND — model)

**Analog:** *itself*. See **SP-1**. Widen the `rates?` value type in the `ProjectFileV2` interface (`:88-95`); update the JSDoc to note the Phase-16 shape + legacy-scalar back-compat. **No `validateV2` branch, no formatVersion bump** — preserve exactly.

---

### `src/renderer/src/lib/project-serialize.ts` (EXTEND — serialize)

**Analog:** *itself*. See **SP-2**. Snapshot (`:60-62`) emits `rates` verbatim — only the value type widens. `hydrateStores` guard (`:119-133`) is the file's real work: widen it to (a) accept the legacy `number` form and map it (D-06), (b) per-field-validate the `PriceEntry` object form (material ≥ 0, labor ≥ 0, markup finite ≥ 0 or default). Keep the whole thing inside the suspend/resume bracket and the final `isDirty: false` safety reset (`:134-139`).

---

### `src/renderer/src/lib/boq-types.ts` (EXTEND — model / types)

**Analog:** *itself*. See **SP-8, SP-9**. On `BoqItemRow` (`:36-59`) replace `rate`/`cost` with the six fields (`material`, `labor`, `materialCost`, `laborCost`, `cost`, `markup`, `price`, `margin` — final field list is RESEARCH/PLAN's call, but must cover D-07's displayed columns; note `markup` is a percent (0–100), not ₱). On `BoqCategoryGroup` (`:68-77`) replace `costSubtotal` with `costSubtotal`/`priceSubtotal`/`marginSubtotal`. On `BoqStructure` (`:84-92`) replace `grandTotalCost` with `grandTotalCost`/`grandTotalPrice`/`grandTotalMargin`. On `AggregateOptions` (`:99-111`) widen `rates?: Record<string, number>` (`:110`) to the `PriceEntry` map. Keep `categoryId?` on `BoqItemRow` (`:58`). **Mirror the identical change into the other three files in the SAME change (SP-9).**

---

### `src/renderer/src/lib/boq-aggregator.ts` (EXTEND — service)

**Analog:** *itself*. See **SP-8**. Expand the per-row block (`:217-231`), the per-category accumulator (`:238-255`), and the grand accumulator (`:184`, `:245`, `:284`). Keep `opts.rates ?? useProjectStore.getState().rates` (`:95`), the `${name}|${type}` key, the D-02 collision/suffix logic (`:193-231`), and the arc-aware perimeter length path (`:148-161`) **untouched** (Phase-14/15 no-regression).

---

### `src/main/boq-writers.ts` (EXTEND — writer, main process)

**Analog:** *itself*. See **SP-4, SP-5, SP-9** and D-08.
- **Columns:** the current 5-col layout `Item · Quantity · UoM · Rate · Cost` (xlsx title `:158`, csv header `:294`) becomes the six-money-column set (D-07/D-08). Add `COL_WIDTH_*` consts next to `:56-60`; widen `ws.columns` (`:140-146`).
- **Native-number ₱ cells + numFmt:** copy `appendItemRow`'s discipline (`:216-240`) — each ₱ cell is a NATIVE number carrying `NUMFMT_PESO` (`:55`), never a pre-formatted string (keeps SUM-safe). Markup % is a number with a `0%`/`0.00%` numFmt (NOT `NUMFMT_PESO`). Guard every value with `money()` (`:119-121`, SP-5).
- **Subtotal / grand rows:** `appendCostSubtotalRow` (`:257-267`) and the grand-total-cost row (`:186-196`) become Cost/Price/Margin triples. csv mirrors (`:296-334`).
- **Heading merge:** `appendCategoryHeading` merges `A:E` today (`:208-213`); widen to the new last column and pad heading/subtotal/grand rows to the new cell count.
- **KEEP untouched:** the UTF-8 BOM return (`:342`), `safeText` formula-injection guard (`:98-102`), and the "main keeps its own `NUMFMT_PESO`" convention (`:47-55`, SP-4).
- **Mirror `BoqRowType`/`BoqItemRow`/etc. inline (`:11-40`) per SP-9.**

---

### `src/preload/index.ts` + `src/preload/index.d.ts` (EXTEND — IPC wire types)

**Analog:** *itself*. See **SP-9**. Add the six BoqItemRow fields + the three subtotal/grand fields to the inline mirrors (`index.ts:24-45`, `index.d.ts:14-35`). Preserve the deliberate drifts (`index.ts` omits `categoryId`, keeps stray `'wall'`). No IPC surface change — the `writeBoqXlsx`/`writeBoqCsv` signatures (`index.ts:81-91`) are unchanged; only the `BoqStructure` shape they carry widens.

---

### View-mode state: `viewMode: 'plan' | 'estimate'` (NEW state — Open-Q resolution)

CONTEXT Open-item: "Where the `Plan | Estimate` view-state lives (viewer store vs a new UI store) and how the main area switches without disturbing the Konva canvas mount."

**Two candidate analogs, with a recommendation:**

1. **`viewerStore.ts` `activeTool`** (`:15`, `:106` setter; type `types/viewer.ts:103`). A single string field + `set` action, already the store for "what mode is the canvas in." A `viewMode: 'plan' | 'estimate'` field + `setViewMode` action here is a 1:1 structural copy of `activeTool`/`setActiveTool`. **BUT:** the mockup shows the toggle only in the Estimating ribbon tab, and switching to Estimate should NOT reset selection/tool. `viewMode` is transient UI, not project data — and `viewerStore` mixes persisted-ish and transient fields.

2. **`useUiPanels.ts` (`clmc.ui` localStorage) — REJECTED.** Considered (it hosts transient, workstation-scoped UI state never serialized to `.clmc`, and would give free cross-reload persistence), but NOT chosen: the plans place `viewMode` in `viewerStore` for `getState()` access beside `activeTool`. Do not add `viewMode` to `useUiPanels`.

**LOCKED (RESEARCH + the plans):** `viewMode` lives in **`viewerStore`** — mirror `activeTool`/`setActiveTool` (`viewerStore.ts:15,:106`) with a `viewMode: 'plan' | 'estimate'` field + `setViewMode`. Chosen for `getState()` (non-React) access from the canvas-mount logic and to sit beside `activeTool`; it is session-only (NOT serialized to `.clmc` — the serialize path reads explicit fields only). Candidate #2 (`useUiPanels`) was NOT chosen; do NOT add `viewMode` there.

---

### `RibbonToolbar.tsx` `renderEstimatingTab()` — the `Plan | Estimate` toggle (EXTEND)

**Analog:** *itself*. Two internal patterns to copy:

1. **The segmented toggle** — closest existing analog is the **ribbon tab strip** (`RibbonToolbar.tsx:614-647`): a row of `role="tab"` buttons with `aria-selected`, an active-state background (`COLORS.dominant`) + bottom accent border (`2px solid COLORS.accent`), hover color swaps. A `Plan | Estimate` segmented control is the same two-button `aria-selected` pattern at a smaller scale. There is no dedicated segmented-control component in the repo (see §"No Analog Found") — build it from this tab-button styling.
2. **The current `renderEstimatingTab`** (`:529-555`) today renders only a "Quick Export" label + Export button. The toggle goes here (or replaces it). Read `viewMode` from the chosen state (SP-view above) and call `setViewMode('plan' | 'estimate')` on click.
3. **The module-ref control seam** (`getCanvasControls`/`getCalibrationControls`, consumed at `RibbonToolbar.tsx:167-186`, defined `CanvasViewport.tsx:130-150`) is the analog IF the Estimate grid needs imperative control from the ribbon (it likely does not — the toggle just flips `viewMode` state, and the shell mounts the grid reactively). Only reach for the `let _estimateControls = …; export function getEstimateControls()` pattern if a ribbon button must imperatively poke a mounted grid; the mockup implies a pure state toggle, so **prefer plain state**.

Note the existing handler pattern for tool toggles (`handleMarkupToolClick` `:193-202`) as the shape for a `handleViewToggle`.

---

### `App.tsx` — main-area mount switch (EXTEND — shell/layout)

**Analog:** *itself*. The center column today branches the canvas on `totalPages`:
```typescript
// App.tsx:325-336 — the mount site to extend with a viewMode branch
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
    {totalPages > 0 && <CanvasHeaderBar />}
    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      {totalPages === 0
        ? <EmptyState />
        : <CanvasViewport hoverMatches={…} pulse={…} onPulseComplete={…} onReopenToast={…} />}
      {/* toasts … */}
    </div>
  </div>
```

**How to switch WITHOUT disturbing the Konva mount (the CONTEXT concern):** the safe move is to render the Estimate grid **as a sibling overlay** or a conditional that keeps `CanvasViewport` mounted but visually hidden — because unmounting `CanvasViewport` tears down the Konva Stage + PDF render and re-fits on remount (see the auto-fit-on-empty-viewport rationale in `viewerStore.ts:120-143`). Two viable shapes for the planner to choose:
- **(A) Keep both mounted, toggle visibility** (`display: 'none'` on the inactive one). Zero canvas teardown; the Konva Stage and PDF stay warm. Costs a hidden full-width DOM subtree. **Recommended** given the "must not disturb the canvas mount" constraint.
- **(B) Conditionally render** `viewMode === 'estimate' ? <EstimatePanel/> : <CanvasViewport/>`. Simpler, but remounting the canvas on every Plan↔Estimate switch triggers a re-fit and re-raster — acceptable only if that proves cheap. The existing `totalPages === 0 ? EmptyState : CanvasViewport` swap already unmounts/remounts, so the codebase tolerates it — but that swap is rare (open/close project) whereas view-toggling is frequent. **Prefer (A).**

Either way, the right-side `TotalsPanel` (`App.tsx:451-461`) and `Splitter` (`:440-448`) are Plan-only chrome — in Estimate view they should be hidden (the grid is full-width, D-01). Gate them on `viewMode === 'plan'`.

---

## Revert / Remove (Phase 15 Plan 15-03 — strip so the totals panel is quantity-only, D-02)

CONTEXT D-02 + §"SUPERSEDE": remove Plan 15-03's inline ₱ rate field AND the per-row/subtotal/grand-total cost display from the totals panel. **KEEP the PerimeterMarkup half of 15-03** (length-only render — that's a Phase-15 keeper, not part of this revert). Precise strip map, file by file:

### `src/renderer/src/components/TotalsRow.tsx` — strip the inline rate input + cost span
| Lines | What | Action |
|-------|------|--------|
| `5` | `import { CURRENCY_SYMBOL } from '../lib/currency'` | REMOVE (no ₱ left in this file after strip) |
| `10` | `import { useProjectStore }` | REMOVE only if no other use remains — **KEEP**: still used for `hiddenItemSet` (`:225`) + `toggleHiddenItem` (`:335`). Do NOT remove. |
| `64-71` | `formatCost()` helper | REMOVE |
| `140-147` | `rateKey` useMemo | REMOVE |
| `149-151` | `rate` selector (`s.rates[rateKey]`) | REMOVE |
| `153-171` | `rateInputRef` + seed `useEffect` | REMOVE |
| `173-216` | `commitRate` + native-listener `useEffect` | REMOVE |
| `394-434` | inline ₱ rate input JSX block | REMOVE |
| `436-449` | row cost `<span data-testid="totals-row-cost">` | REMOVE |
| — | `useEffect`/`useRef` imports (`:1`) | trim if now unused after removing the two effects (cycle state still uses `useState`) |

Net: TotalsRow returns to cycle-dot + lightbulb + color-chip + label + quantity + UoM + Plus affordance (quantity-only). Keep everything in `:230-392` and `:451-458`.

### `src/renderer/src/components/TotalsCategoryBlock.tsx` — strip the ₱ cost-subtotal
| Lines | What | Action |
|-------|------|--------|
| `4` | `import { CURRENCY_SYMBOL }` | REMOVE (no ₱ left after strip) |
| `131-157` | per-category ₱ cost-subtotal `<div data-testid="totals-category-cost-subtotal">` | REMOVE |

Keep the heading, collapse, items map, and (existing pre-15) per-UoM quantity subtotals if any render here — note the block currently renders ONLY the cost subtotal in the body-after-items (`:131-157`); the per-UoM quantity subtotals are not rendered in this component today, so removal leaves heading + rows.

### `src/renderer/src/components/TotalsPanel.tsx` — strip the grand-total ₱ bar
| Lines | What | Action |
|-------|------|--------|
| `5` | `import { CURRENCY_SYMBOL }` | REMOVE (no ₱ left after strip) |
| `267-294` | pinned grand-total ₱ cost bar `<div data-testid="totals-grand-total">` | REMOVE |

Keep the rail, header, metadata header, empty-states, category list, and context menu.

### Tests to expect RED / migrate (planner: these Phase-15 tests assert the now-removed panel pricing)
The 15-03 summary lists the do-not-edit RED contracts it turned green. After the revert these will fail and are the planner's to retarget to the new Estimate grid (or delete if superseded):
- `totals-row-rate-edit.test.ts` (asserts `totals-row-rate-input` on the panel) → **move** to the EstimateRow test surface.
- `use-boq-live.test.ts` "recomputes when rates change" → still valid (aggregator liveness) but the `rates` shape widens; update fixture to the `PriceEntry` map.
- Any `totals-category-cost-subtotal` / `totals-grand-total` assertions → remove or move to the Estimate grid.
- `boq-writers-xlsx.test.ts` / `boq-writers-csv.test.ts` Rate/Cost-column assertions → **extend** to the six-column layout (D-08), not remove.

The strip is a straight reversal of commits `1da21b0` (Task 2: inline input + cost) and `380f762` (Task 3: subtotal + grand-total render) from Plan 15-03 — the planner can diff those two commits to see the exact additions to undo. Commit `ffbd168` (Task 1: `currency.ts` seam + `useBoqLive` `rates` wiring) is **KEPT** (currency.ts stays per SP-4; the `useBoqLive` rates wiring stays and widens per SP-7).

---

## No Analog Found

Files/aspects with no close match in the codebase — the planner should design these from the approved mockups + RESEARCH, not copy an existing file:

| Aspect | Role | Data Flow | Reason |
|--------|------|-----------|--------|
| Multi-column spreadsheet **grid header** (grouped `Item·Qty·UoM \| Material·Labor·Cost \| Markup·Price·Margin`) | component | — | No existing component renders a grouped multi-column header row. TotalsPanel/TotalsCategoryBlock are single-column-of-rows lists with no column header. Build from the mockup (D-07) in the `COLORS` dark palette. |
| **Segmented `Plan \| Estimate` toggle** control | component | event-driven | No dedicated segmented/pill toggle component exists. Closest visual analog is the ribbon tab strip (`RibbonToolbar.tsx:614-647`) — a two-button `aria-selected` pattern — but it's inline in RibbonToolbar, not a reusable control. Build a small toggle from that styling. |
| **Full-width center-area content swap** (canvas ↔ grid) without teardown | shell/layout | — | The app has only ever mounted `CanvasViewport` (or `EmptyState`) in the center. Swapping in a full-width non-canvas view is new; the "keep-both-mounted, toggle `display`" pattern (App.tsx §above, option A) is a design decision, not a copied precedent. |
| Project-wide **default-markup (30%) Settings control** | component/config | — | D-05/D-09 defer the Settings UI; v1 is a hardcoded `DEFAULT_MARKUP_PCT = 30` constant. The RibbonToolbar Settings tab is a "Coming soon" stub (`:557-569`) — no settings-form analog exists. Minimal v1: the constant + optional inline default field; full Settings deferred. |

---

## Metadata

**Analog search scope:** `src/renderer/src/components`, `src/renderer/src/hooks`, `src/renderer/src/stores`, `src/renderer/src/lib`, `src/renderer/src/types`, `src/main`, `src/preload`.
**Files scanned/read in full:** TotalsPanel.tsx, TotalsRow.tsx, TotalsCategoryBlock.tsx, useBoqLive.ts, boq-types.ts, boq-aggregator.ts, projectStore.ts, project-schema.ts, project-serialize.ts, currency.ts, boq-writers.ts, preload/index.ts, preload/index.d.ts, RibbonToolbar.tsx, App.tsx, useUiPanels.ts, viewerStore.ts; targeted reads of CanvasViewport.tsx (module-ref block), types/viewer.ts (ActiveTool).
**Grep confirmation:** no existing `estimate`/`viewMode`/`planView`/`ViewMode` state anywhere in `src/renderer/src` (the two substring hits are unrelated markup-code comments) — the view toggle is genuinely net-new.
**Pattern extraction date:** 2026-07-01
