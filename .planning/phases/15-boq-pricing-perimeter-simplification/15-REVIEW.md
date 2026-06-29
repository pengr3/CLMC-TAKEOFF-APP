---
phase: 15-boq-pricing-perimeter-simplification
reviewed: 2026-06-29T18:51:33Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/main/boq-writers.ts
  - src/preload/index.ts
  - src/preload/index.d.ts
  - src/renderer/src/stores/projectStore.ts
  - src/renderer/src/lib/project-schema.ts
  - src/renderer/src/lib/project-serialize.ts
  - src/renderer/src/lib/boq-types.ts
  - src/renderer/src/lib/boq-aggregator.ts
  - src/renderer/src/lib/currency.ts
  - src/renderer/src/hooks/useBoqLive.ts
  - src/renderer/src/components/TotalsRow.tsx
  - src/renderer/src/components/TotalsCategoryBlock.tsx
  - src/renderer/src/components/TotalsPanel.tsx
  - src/renderer/src/components/markup/PerimeterMarkup.tsx
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: resolved
resolution:
  fixed_at: 2026-06-29T19:01:46Z
  fixed: [CR-01, CR-02, WR-01, WR-02, WR-03, IN-02, IN-03]
  deferred: [WR-04, IN-01, IN-04]
  typecheck: clean
  test_suite: 628 passed / 0 failed
---

# Phase 15: Code Review Report

**Reviewed:** 2026-06-29T18:51:33Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** resolved (7 fixed, 3 deferred)

> **Resolution (2026-06-29):** The 7 low-risk findings (CR-01, CR-02, WR-01,
> WR-02, WR-03, IN-02, IN-03) were applied as atomic `fix(15):`/`docs(15):`
> commits. Each was confirmed against source + tests before editing; none broke
> a green test or contradicted a locked decision in 15-CONTEXT.md. Final state:
> typecheck clean, full vitest suite 628 passed / 0 failed (baseline preserved).
> The 3 remaining findings (WR-04, IN-01, IN-04) are **DEFERRED** for a user
> decision and were intentionally NOT touched — see the annotation on each.

## Summary

Phase 15 adds unit-rate pricing (₱ rate × quantity = cost) threaded from the project store through the aggregator and into two export writers, a live totals panel, and persistence in the `.clmc` project file. The perimeter tool is simultaneously collapsed from a two-row (length + area) output to length-only.

The core numeric discipline is sound: native-number storage with `numFmt` display formatting preserves Excel SUM correctness; the `money()` guard in the writers and the `Number.isFinite` guards in the UI prevent NaN/Infinity from reaching cells. Persistence round-trip for the additive `rates` field is correctly back-compatible. Rate-key consistency (`${name}|${type}`) is uniform across the store, aggregator, and UI.

Two blockers are present. First, a `BoqRowType` divergence between `src/preload/index.ts` and `src/preload/index.d.ts` means the preload implementation's IPC wire type is missing `'wall'` while the ambient declaration that the renderer's `window.api` calls satisfy includes it — TypeScript will not catch this mismatch at the IPC boundary, and a `wall` item row crossing the boundary carries a type that the implementation's interface does not recognise. Second, negative rates typed by the user are accepted and stored in-session (inflating costs to negative values in the live UI and exports), but the `safeRates` hydration filter silently zeroes them on next load — a save-then-reload discards the negative rate without any user feedback.

Four warnings and four informational items follow.

## Structural Findings (fallow)

No structural pre-pass was provided for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `BoqRowType` missing `'wall'` in `src/preload/index.ts` — IPC wire-type diverges from ambient declaration and from `boq-writers.ts`

> **RESOLVED** (commit `247dea1`) — added `'wall'` to the preload `BoqRowType` union so all three mirrors agree.

**File:** `src/preload/index.ts:16`

**Issue:** The local `BoqRowType` type in the preload implementation is `'count' | 'linear' | 'area' | 'perimeter'` — it omits `'wall'`. The ambient declaration in `src/preload/index.d.ts:6` has the correct five-member union `'count' | 'linear' | 'area' | 'perimeter' | 'wall'`, and `src/main/boq-writers.ts:18` also includes `'wall'`. This divergence means the preload module's `BoqItemRow.type` field cannot accept the value `'wall'` at compile time even though wall items are produced by the aggregator and expected by the writers. TypeScript checks the renderer's calls against `index.d.ts` (the ambient declaration); it never checks the preload implementation's local type against the declaration. A `BoqStructure` containing wall items is serialised through IPC and deserialised by the writer using `boq-writers.ts` types — the preload file's narrower type has no runtime effect, but any preload-side code that branches on `item.type` (e.g. for logging or validation) would silently miss the `'wall'` arm. The Wave 0 structural lock test (`boq-export-ipc.test.ts`) may not catch this because the test imports from both sides independently, not the preload implementation file specifically.

**Fix:** Add `'wall'` to the local `BoqRowType` union in `src/preload/index.ts`:
```typescript
// src/preload/index.ts line 16
type BoqRowType = 'count' | 'linear' | 'area' | 'perimeter' | 'wall'
```

---

### CR-02: Negative rates typed by the user persist in-session (negative costs exported) but are silently zeroed on reload — save-then-reload discards data without feedback

> **RESOLVED** (commit `c8c3411`) — `commitRate` now clamps `Number.isNaN(parsed) || parsed < 0 ? 0 : parsed`, matching the `v >= 0` hydration filter.

**File:** `src/renderer/src/components/TotalsRow.tsx:174-177`

**Issue:** `commitRate` accepts any `parseFloat` result and passes it directly to `setRate`:
```typescript
const commitRate = (text: string): void => {
  const parsed = parseFloat(text)
  useProjectStore.getState().setRate(rateKey, Number.isNaN(parsed) ? 0 : parsed)
}
```
A user can type `-500` and the rate is stored as `-500`. This produces `cost = -500 × quantity` — a large negative cost number — in the live panel, in the `catCost` accumulator, in `grandTotalCost`, and in both the XLSX and CSV exports. The negative value is a valid `number` so all `Number.isFinite` guards pass and it writes to cells as `-₱500.00`.

However, the hydration sanitiser in `project-serialize.ts:122` discards any entry where `v < 0`:
```typescript
if (typeof v === 'number' && Number.isFinite(v) && v >= 0) safeRates[k] = v
```
So after a Save + re-open, the negative rate is silently zeroed. The user sees a cost calculation that has "disappeared" without any explanation. For a construction estimator tool handling money, silent data loss on reload is a serious defect — the rate entry field should reject (or clamp) negative values at commit time, matching the invariant enforced at load time.

**Fix:** Clamp the committed value at zero in `commitRate` to match the `v >= 0` invariant already enforced at hydration:
```typescript
const commitRate = (text: string): void => {
  const parsed = parseFloat(text)
  const safe = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
  useProjectStore.getState().setRate(rateKey, safe)
}
```
Alternatively, reject negative input with a visual indicator (`input` border turns red, value reverts). Either approach must be consistent with the hydration filter.

---

## Warnings

### WR-01: `typeWord()` returns `'area'` for `'wall'` type — wall collision suffix mislabels rows

> **RESOLVED** (commit `091e640`) — added an explicit `'wall'` branch and widened the return type. Confirmed no green test asserted the old `(area)` suffix for a wall.

**File:** `src/renderer/src/lib/boq-aggregator.ts:42-47`

**Issue:** The `typeWord` helper maps `BoqRowType` to the human-readable suffix used in D-02 collision labels. It handles `'count'`, `'linear'`, and `'perimeter'` explicitly, then falls through to `return 'area'` with the comment "only 'area' reaches this branch given the caller's type set". But `'wall'` also reaches this branch — `typeWord('wall')` returns `'area'`. When a user places both a wall markup and some other markup with the same name (e.g. a linear and a wall both named "Boundary"), the collision suffix for the wall row will read `"Boundary (area)"` instead of `"Boundary (wall)"`, which is incorrect and confusing for an estimator.

The function's return type `'count' | 'linear' | 'area' | 'perimeter'` also does not include `'wall'`, so TypeScript's type narrowing hides the issue.

**Fix:**
```typescript
function typeWord(t: BoqRowType): 'count' | 'linear' | 'area' | 'perimeter' | 'wall' {
  if (t === 'count') return 'count'
  if (t === 'linear') return 'linear'
  if (t === 'perimeter') return 'perimeter'
  if (t === 'wall') return 'wall'
  return 'area'
}
```

---

### WR-02: `commitRate` fires on every `input` event (every keystroke) — excessive dirty-marking and store thrashing while typing

> **RESOLVED** (commit `5e89e5d`) — removed the redundant `'change'` listener (and its `removeEventListener`); `'input'` + `'blur'` + Enter-`'keydown'` cover all commit paths.

**File:** `src/renderer/src/components/TotalsRow.tsx:184-209`

**Issue:** The native event listeners include both `'input'` and `'change'` bound to `onCommit`. For a text input, `'input'` fires on every character typed; `'change'` fires on blur or Enter (i.e. when the value is "committed" in the HTML sense). Having both means every keystroke calls `setRate(key, parsed)` which calls `set(...)` (a Zustand state update, triggering a re-render of any subscriber) and then `get().markDirty()`. The `markDirty` is idempotent after the first call, but the Zustand `set()` for rates fires on every keystroke because `{ ...s.rates, [key]: parsed }` always produces a new object. This means every character typed triggers a full BOQ re-aggregation via `useBoqLive` (which subscribes to `rates`), a re-render of the entire TotalsPanel, and a cost recalculation across all rows.

For a BOQ with hundreds of rows this is noticeable. The `'input'` listener provides live-update feedback (a stated design goal), but the `'change'` listener is then redundant — `'blur'` already provides the "commit on focus-leave" path. Keeping `'input'` alone (removing `'change'`) would preserve live updates without the double-fire on blur (browsers fire `change` then `blur` on a text input when leaving the field).

**Fix:** Remove the `'change'` listener; `'input'` + `'blur'` + `'keydown'` (Enter) already cover all commit paths:
```typescript
el.addEventListener('input', onCommit)
// el.addEventListener('change', onCommit)  // redundant — 'input' fires first on every change
el.addEventListener('blur', onCommit)
el.addEventListener('keydown', onKeyDown)
```

---

### WR-03: `grandTotalCost` row in XLSX: `r.getCell(5).value` is written twice — once in `addRow` and once explicitly

> **RESOLVED** (commit `f0c4a9e`) — removed the redundant `r.getCell(5).value` reassignment in both the grand-total-cost block and `appendCostSubtotalRow`; kept the `numFmt`. xlsx/csv writer tests stay green.

**File:** `src/main/boq-writers.ts:188-190`

**Issue:** The grand-total-cost row is built as:
```typescript
const r = ws.addRow(['Grand Total (cost)', null, null, null, grandTotalCost])
r.font = { bold: true }
r.getCell(5).value = grandTotalCost   // ← redundant: already set by addRow above
r.getCell(5).numFmt = NUMFMT_PESO
```
`addRow` already places `grandTotalCost` in the fifth cell of the new row. The subsequent `r.getCell(5).value = grandTotalCost` overwrites the same cell with the same value. This is harmless at runtime (ExcelJS accepts it), but it is redundant and can mislead a future maintainer into thinking the `addRow` position is unreliable (it is not). The same pattern appears identically in `appendCostSubtotalRow` (lines 258-260). Only the `numFmt` assignment after `addRow` is necessary.

**Fix:** Remove the redundant explicit value assignment; `numFmt` can be set alone:
```typescript
// boq-writers.ts — appendCostSubtotalRow
const r = ws.addRow(['Subtotal (cost)', null, null, null, value])
r.font = { bold: true }
// r.getCell(5).value = value  ← remove; already set by addRow
r.getCell(5).numFmt = NUMFMT_PESO

// boq-writers.ts — grandTotalCost block
const r = ws.addRow(['Grand Total (cost)', null, null, null, grandTotalCost])
r.font = { bold: true }
// r.getCell(5).value = grandTotalCost  ← remove
r.getCell(5).numFmt = NUMFMT_PESO
```

---

### WR-04: Per-category `costSubtotal` is hidden when the category is collapsed — user cannot see the category cost without expanding every row

> **DEFERRED** — UX layout decision (whether/where to surface the category cost when collapsed). Held for a user decision; intentionally not fixed in this pass.

**File:** `src/renderer/src/components/TotalsCategoryBlock.tsx:111-159`

**Issue:** The `costSubtotal` display div (lines 135-157) is inside the `{!isCollapsed && (...)}` block, so it disappears when the category is collapsed. A user who has collapsed a category to reduce visual noise loses visibility of that category's total cost. The grand total bar at the bottom of the panel still shows the project-wide sum, but the per-category breakdown is unavailable without expanding each category. This is especially problematic when a project has many categories — the user would need to expand each one just to see its cost contribution.

By contrast, the category heading row (always visible) already shows the category name but carries no cost. Moving the `costSubtotal` to the heading row (beside or under the chevron + name) would let users scan category costs at a glance.

**Fix:** Move the `costSubtotal` span into the heading row div (lines 66-108), right-aligned, so it remains visible whether the category is expanded or collapsed:
```tsx
{/* In the heading row div */}
<span style={{ fontVariantNumeric: 'tabular-nums', marginLeft: 'auto', fontSize: 12 }}>
  {`${CURRENCY_SYMBOL}${(Number.isFinite(category.costSubtotal) ? category.costSubtotal : 0).toFixed(2)}`}
</span>
```

---

## Info

### IN-01: `category` prop in `PerimeterMarkupProps` is declared and passed but never used in the component body — dead required prop

> **DEFERRED** — removing the prop is an API change that touches the call site in `CanvasViewport.tsx`. Held for a user decision; intentionally not fixed in this pass.

**File:** `src/renderer/src/components/markup/PerimeterMarkup.tsx:14-15`

**Issue:** The interface declares `category: Category` as a required prop (line 14). The call site in `CanvasViewport.tsx:2296` looks up and passes a `Category` object. However, the `PerimeterMarkup` component function does not destructure `category` and never references it — all colour and rendering data come from `markup.color` directly. The `Category` type import (line 2) is therefore also dead. This is a leftover from the pre-Phase-15 two-row design where the category may have been needed. The dead required prop forces every call site to supply a value that is silently ignored, and it will confuse future maintainers who read the interface and expect the prop to affect rendering.

**Fix:** Remove the `category` prop from `PerimeterMarkupProps`, the `Category` import, and the corresponding `category={category}` at the call site in `CanvasViewport.tsx`.

---

### IN-02: `currentZoom` prop comment says "not used" but it IS used to compute `strokeWidth`

> **RESOLVED** (commit `6bada08`) — corrected the comment to describe the prop's real role (keeps `strokeWidth` visually constant across zoom).

**File:** `src/renderer/src/components/markup/PerimeterMarkup.tsx:16`, `src/renderer/src/components/markup/PerimeterMarkup.tsx:72`

**Issue:** The interface comment reads `// legacy prop compat — not used; labels are world-anchored per D-34`. However, line 72 reads:
```typescript
const strokeWidth = STROKE_BASE_PX / currentZoom
```
`currentZoom` is actively used to compute the stroke width so it appears consistent at every zoom level. The comment is incorrect and will mislead reviewers into thinking the prop can be removed safely when it cannot.

**Fix:** Update the comment to accurately describe the prop's role:
```typescript
currentZoom: number  // used to keep strokeWidth visually constant across zoom levels
```

---

### IN-03: Toolbar tooltips describe perimeter tool as "perimeter + area" — stale after Phase 15 collapse to length-only

> **RESOLVED** (commit `713babb`) — both tooltips now read "Perimeter tool — trace a closed outline; measures perimeter length".

**File:** `src/renderer/src/components/Toolbar.tsx:432`, `src/renderer/src/components/RibbonToolbar.tsx:431`

**Issue:** Both toolbar components have `title="Perimeter tool — trace polygons for perimeter + area"`. Since Phase 15 removed the area synthesis, the perimeter tool now produces a length-only measurement. The tooltip still advertises an "area" output that no longer exists. A user reading the tooltip and expecting an area row in the BOQ will be confused when they find only a single length row.

**Fix:** Update both tooltip strings:
```tsx
title="Perimeter tool — trace polygons to measure perimeter length"
```

---

### IN-04: `seedRateText` is defined as a function inside the component body but called only in one `useEffect` — no need for a named function

> **DEFERRED** — negligible micro-perf (a per-render one-liner closure). Held for a user decision; intentionally not fixed in this pass.

**File:** `src/renderer/src/components/TotalsRow.tsx:165`

**Issue:** `seedRateText` is defined as an arrow function inside the component render cycle:
```typescript
const seedRateText = (r: number): string => (Number.isFinite(r) && r > 0 ? String(r) : '')
```
It is called once inside the seeding `useEffect` on line 170 and once as `defaultValue` on line 412. It is effectively a pure one-liner. Defining it as a named function inside the component means it is recreated on every render. It could be a module-level utility (it has no component dependencies) or the expression inlined directly. This is a minor code organisation concern, not a correctness issue.

**Fix:** Move to module level (no captures):
```typescript
function seedRateText(r: number): string {
  return Number.isFinite(r) && r > 0 ? String(r) : ''
}
```

---

_Reviewed: 2026-06-29T18:51:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

_Resolved: 2026-06-29T19:01:46Z — 7 fixed (CR-01, CR-02, WR-01, WR-02, WR-03, IN-02, IN-03), 3 deferred (WR-04, IN-01, IN-04). Typecheck clean; full suite 628 passed / 0 failed._
