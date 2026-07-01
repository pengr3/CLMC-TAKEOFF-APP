---
phase: 16-estimating-workspace
reviewed: 2026-07-01T00:00:00Z
depth: deep
files_reviewed: 20
files_reviewed_list:
  - src/main/boq-writers.ts
  - src/preload/index.d.ts
  - src/preload/index.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/components/EstimateCategoryBlock.tsx
  - src/renderer/src/components/EstimatePanel.tsx
  - src/renderer/src/components/EstimateRow.tsx
  - src/renderer/src/components/RibbonToolbar.tsx
  - src/renderer/src/components/TotalsCategoryBlock.tsx
  - src/renderer/src/components/TotalsPanel.tsx
  - src/renderer/src/components/TotalsRow.tsx
  - src/renderer/src/hooks/useBoqLive.ts
  - src/renderer/src/lib/boq-aggregator.ts
  - src/renderer/src/lib/boq-types.ts
  - src/renderer/src/lib/estimate-defaults.ts
  - src/renderer/src/lib/project-schema.ts
  - src/renderer/src/lib/project-serialize.ts
  - src/renderer/src/stores/projectStore.ts
  - src/renderer/src/stores/viewerStore.ts
  - src/renderer/src/types/viewer.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
resolved:
  - CR-01
  - WR-02
open:
  - WR-01
  - IN-01
  - IN-02
  - IN-03
# CR-01 (High) + WR-02 (Medium) resolved in d9e7e58; WR-01 + the three Lows
# (IN-01/IN-02/IN-03) remain open, so status stays issues_found (NOT clean).
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-07-01
**Depth:** deep
**Files Reviewed:** 20 (production source under `src/`)
**Status:** issues_found

## Summary

Phase 16 adds the estimating workspace: a widened `PriceEntry` pricing model, the money-math columns (material / labor / cost / markup / price / margin), a 9-column XLSX/CSV writer, a mount-preserving Plan|Estimate view swap, and an uncontrolled inline-edit Estimate grid.

The high-risk surfaces called out in the brief are, for the most part, implemented correctly:

- **Money math** (`boq-aggregator.ts:227-235`) is right: markup is treated as a percent (`cost * (1 + markup/100)`), `margin = price - cost`, `materialCost/laborCost = rate × qty`. Subtotal/grand aggregation sums row-level values consistently.
- **Percent-vs-fraction default** (`?? DEFAULT_MARKUP_PCT`) correctly honors an explicit `markup: 0` and only substitutes 30 on `undefined` — the `??` (not `||`) distinction is correct at every one of the three seams.
- **Legacy back-compat coercion** (`project-serialize.ts:127-148`) covers scalar, object-missing-markup, negative, non-number, and non-object shapes without throwing.
- **NaN/Infinity guards** are present at every ₱ write point in the writer (`money()` / `csvMoney()`) and in the panel/row `formatMoney` helpers.
- **Mount-preserving view swap** (`App.tsx:334-473`) is a genuine CSS `display` gate with both subtrees always mounted — the Konva `CanvasViewport` is never conditionally unmounted. No HIGH-severity teardown bug here.
- **`viewMode` is runtime-only** — excluded from `snapshotProject`, reset to `'plan'` on `setFile`/`resetViewer`/`hydrate`.
- **4-way type lock** (`boq-types.ts` / both preload mirrors / `boq-writers.ts`) is byte-consistent for `BoqItemRow` / `BoqCategoryGroup` / `BoqStructure`. No drift.
- **SUM-safe cells**: money cells are native numbers with a ₱ `numFmt`; markup uses a `0"%"` suffix format (not Excel `0%`, which would ×100); CSV is glyph-free with the UTF-8 BOM preserved.

One real correctness bug survives because the test suite mocks it out, plus one inert UI control and some minor duplication. Details below.

## Critical Issues

### CR-01: Estimate rate cell wipes the user's input mid-typing on decimals and multi-digit values

**Status:** RESOLVED (d9e7e58)

**File:** `src/renderer/src/components/EstimateRow.tsx:136-159` (material; labor 160-182 and markup 183-205 identical) with `seedRateText` at `:61-63` and the seed effects at `:112-131`

**Issue:** Editable cells commit on the native **`input`** event, which fires on *every keystroke* (`:145` / `:169` / `:193` bind `el.addEventListener('input', onCommit)`). Each commit calls `setPrice`, which updates the store, which re-runs the seed effect (`:112-117`) that re-writes `el.value` from the stored value whenever it differs. Because `seedRateText` returns `''` for any value that is not strictly `> 0` (`:62`), intermediate parses collapse the field:

- Typing a leading-zero decimal like `0.5`: after the user types `0.`, the `input` handler runs `commitMaterial("0.")` → `parseFloat("0.") === 0` → stores `material: 0`. The store change fires the seed effect → `seedRateText(0) === ''` → `el.value` (`"0."`) differs from `""` → **the effect sets `el.value = ""`**, erasing what the user is typing. The user cannot enter `0.5`, `0.75`, etc.
- Typing `0` as the first character of any value (e.g. `05` → intended `50`? or a rate of `0.99`): the first `0` commits `material: 0`, seed effect blanks the field.
- The markup cell has a parallel problem in the other direction: typing `30` commits `markup: 3` on the first keystroke (a real, wrong intermediate price flashes), then `markup: 30`. Values are also written to the store one partial number at a time.

Net effect: the estimator cannot reliably type decimal rates, and every keystroke mutates persisted project state (each `setPrice` also calls `markDirty()` at `projectStore.ts:123`).

**Why the 642-green suite misses it:** `estimate-row-edit.test.ts:154-156` injects a **mocked `setPrice` (`vi.fn()`)** onto the store, so the real store value never changes, the seed effect never re-fires with a new value, and the clobber path is never exercised. The tests assert only that `setPrice` was *called* with the final `.value` — they set `input!.value = '42'` in one shot and never type character-by-character.

**Fix:** Commit on `blur` + `Enter` only — drop the per-keystroke `input` listener (or debounce/parse-guard it). Also make the seed effect not fight an actively-focused field. Minimal change:

```ts
// Remove the 'input' commit binding; commit on blur + Enter instead.
el.addEventListener('blur', onCommit)
el.addEventListener('keydown', onKeyDown) // already commits on Enter
// el.addEventListener('input', onCommit)  // <-- delete: fires per keystroke

// And guard the seed effect so it never overwrites the focused input:
useEffect(() => {
  const el = materialRef.current
  if (!el || document.activeElement === el) return   // don't clobber mid-edit
  const next = seedRateText(material)
  if (el.value !== next) el.value = next
}, [priceKey, material])
```

Committing on `blur`/`Enter` matches the documented "change+blur OR Enter commits" intent in the header comment (`:26-28`) without turning every keystroke into a store write. Add a test that types a decimal one character at a time against the *real* `setPrice` and asserts the field retains `0.5`.

**Resolution (d9e7e58):** Removed the per-keystroke `input` commit binding from all three cells (material/labor/markup) — commit is now bound to `blur` + Enter keydown only, matching the component's documented "change+blur OR Enter commits" contract. Each seed effect is guarded with `if (!el || document.activeElement === el) return`, so it can never overwrite a field the user is actively editing. The inputs stay uncontrolled + native listeners + `stopPropagation` (the React-19 pattern), and `parseFloat` NaN/empty → 0 plus the category-independent `${name}|${type}` key are unchanged. Added `src/tests/estimate-row-decimal-entry.test.ts`, which drives the **real** `projectStore.setPrice` (not the mocked spy that hid this bug) and proves: the focused field is not clobbered when a store write lands mid-typing, typing `0` → `0.` → `0.5` survives without being blanked, and `blur`/Enter commit `rates['Outlet|count'].material === 0.5`/`0.75`. The test was verified RED against the reintroduced bug before the fix. Full suite green (646/646); the 6 pre-existing `estimate-row-edit.test.ts` cases stay green.

## Warnings

### WR-01: Settings "Default markup %" control is inert — it changes nothing

**File:** `src/renderer/src/components/RibbonToolbar.tsx:165` (state) and `:646-677` (input)

**Issue:** `defaultMarkup` is a local `useState` that is only ever read to render its own `value` (`:652`) — grep confirms no other consumer. It is not wired to the aggregator (which hardcodes `entry?.markup ?? DEFAULT_MARKUP_PCT` with the module constant `30`), not to `setPrice`, and not persisted. Editing the field in the Settings tab therefore has **zero observable effect**: new estimate rows still default to 30%, existing rows are unchanged, and the value is lost on reload. To an estimator this is a functioning-looking knob that silently does nothing.

The code comment (`:623-630`) acknowledges this is deliberate "minimal v1 / persistence deferred" scope, so this is a known limitation rather than an accidental regression — but shipping a live-looking input that is a no-op is a UX correctness problem, not just a docs footnote.

**Fix:** Either (a) disable the input with a "Coming soon" affordance until it is wired, or (b) actually make it drive the default — e.g. move the project-wide default into `projectStore` and have the aggregator read `entry?.markup ?? store.defaultMarkup ?? DEFAULT_MARKUP_PCT`, seeding `setPrice`'s new-entry markup from it. If (a) is chosen for v1, add a visible hint that the value is not yet applied.

### WR-02: Every keystroke in an Estimate cell marks the project dirty and writes a partial value to the store

**Status:** RESOLVED (d9e7e58)

**File:** `src/renderer/src/components/EstimateRow.tsx:145` / `:169` / `:193` (the `input` listener) → `src/renderer/src/stores/projectStore.ts:118-124` (`setPrice` → `markDirty`)

**Issue:** This is the same root cause as CR-01 but is worth calling out as its own state-integrity concern even if the clobber were fixed differently. Because commit is bound to `input`, typing a three-character rate dispatches three `setPrice` calls and flips `isDirty` on the first keystroke. Intermediate values are briefly the source of truth for the live BOQ (`useBoqLive` recomputes on every `rates` change), so cost/price/margin visibly flicker through wrong intermediate numbers (`3` → `30` markup, etc.) while typing. For a persisted pricing sheet, committing on `blur`/`Enter` (per CR-01) also resolves this.

**Fix:** Same as CR-01 — remove the per-keystroke `input` commit; commit on `blur` + `Enter`.

**Resolution (d9e7e58):** Fixed by the same change as CR-01 — the per-keystroke `input` commit binding is gone, so typing no longer dispatches a `setPrice` per character and no longer flips `isDirty` on the first keystroke; the store sees a single write on `blur`/Enter and the live BOQ no longer flickers wrong intermediate cost/price/margin. The new `estimate-row-decimal-entry.test.ts` asserts (against the real store) that the `input` event does not commit and does not mark the project dirty until `blur`/Enter.

## Info

### IN-01: `formatMoney` is duplicated verbatim across three Estimate components

**File:** `src/renderer/src/components/EstimateRow.tsx:54-57`, `src/renderer/src/components/EstimatePanel.tsx:32-35`, `src/renderer/src/components/EstimateCategoryBlock.tsx:29-32`

**Issue:** The identical `Number.isFinite(n) ? n : 0` + `` `${CURRENCY_SYMBOL}${safe.toFixed(2)}` `` helper is copy-pasted three times (and mirrors `TotalsRow.formatCost`). Not a bug, but three seams to keep in sync if the money format ever changes (e.g. thousands separators, currency picker).

**Fix:** Extract a single `formatMoney` into `src/renderer/src/lib/currency.ts` (already the home of `CURRENCY_SYMBOL`) and import it in all three components.

### IN-02: CSV markup column is an unlabeled bare percent number adjacent to ₱ columns

**File:** `src/main/boq-writers.ts:406` (`csvMoney(item.markup)`), header at `:389`

**Issue:** In the CSV, Material/Labor/Cost/Price/Margin are glyph-free numbers whose currency lives in the header + BOM, while Markup is *also* a bare number (e.g. `30`) that actually means "30%". The header cell reads `Markup` (not `Markup %`), so a downstream consumer reading the raw CSV could misinterpret `30` as ₱30 rather than 30%. The XLSX side is unambiguous (percent `numFmt`); only the CSV loses the unit. Low impact — the primary deliverable is XLSX — but a one-word header fix removes the ambiguity.

**Fix:** Emit the CSV header as `Markup %` (and correspondingly in the XLSX title row for parity) so the unit travels with the column even in glyph-free CSV.

### IN-03: `key={cat.name}` collides if two real categories share a display name

**File:** `src/renderer/src/components/EstimatePanel.tsx:153` and `src/renderer/src/components/TotalsPanel.tsx:250` (pre-existing pattern, now duplicated into the Estimate grid)

**Issue:** Category blocks are keyed by `cat.name`. Two distinct categories with the same display name would produce duplicate React keys (mount/reconciliation glitches) and, in the Estimate grid, share the `useUiPanels().collapsedCategories` collapse toggle (also name-keyed). This pre-dates Phase 16 (TotalsPanel already keys on name) and requires a user to create same-named categories, so impact is low — but Phase 16 propagated the pattern into a second surface. Worth a keyed-by-id follow-up if categories can ever share names.

**Fix:** Key category blocks and the collapse map by category id (falling back to a stable `__uncat__` sentinel for the uncategorized bucket) rather than by display name.

---

_Reviewed: 2026-07-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
