---
slug: item-name-collision-bug
status: resolved
trigger: manual
created: 2026-05-18
---

# Debug Session: Item Name Collision Bug

## Symptom

Items with the same name but different categories are treated as the same object:
- "Wallahi" exists once under "Civil" category and once uncategorized
- Hiding one hides both
- The visibility toggle, canvas hide/show, and BOQ row matching all key on `name` alone

## Current Focus

### Hypothesis

The system uses `name` (string) as the sole key for visibility state (`hiddenItemNames`/`hiddenItemSet`), canvas hide/show, and TotalsRow matching. When two items share the same name but belong to different categories, every operation that uses `name` as the key treats them as a single object.

### Next Action

RESOLVED — fix applied.

## Evidence

- timestamp: 2026-05-18T00:00:00Z
  file: src/renderer/src/stores/projectStore.ts
  lines: 12-14, 82-88, 93-94
  note: hiddenItemNames is string[], hiddenItemSet is Set<string> — keyed by name alone

- timestamp: 2026-05-18T00:00:00Z
  file: src/renderer/src/components/TotalsRow.tsx
  lines: 57-59, 67-75, 103-110, 211
  note: labelToName strips suffix to get item name, hiddenItemSet.has(itemName) uses name only, toggleHiddenItem(itemName) uses name only, findPagesWithMatches uses m.name === itemName filter

- timestamp: 2026-05-18T00:00:00Z
  file: src/renderer/src/components/markup/CountPinMarkup.tsx (and Linear/Area/Perimeter/Wall)
  lines: 38-41 (approximately)
  note: hiddenItemSet.has(markup.name) — hides all markups with that name regardless of category

- timestamp: 2026-05-18T00:00:00Z
  file: src/renderer/src/components/TotalsCategoryBlock.tsx
  lines: 70-74
  note: matchesForRow filters by m.name === name AND m.type — no category filter, so same-name items from different categories both match

## Root Cause

**File:** `src/renderer/src/stores/projectStore.ts`, lines 12-14 and 82-94

The hidden-item state uses `hiddenItemNames: string[]` and `hiddenItemSet: Set<string>` keyed by item **name only** (no category component). This means:

1. **Hiding from TotalsRow:** `toggleHiddenItem(itemName)` adds/removes the raw name string. Two items in different categories sharing the same name will both be toggled simultaneously because the key collides.

2. **Canvas hide/show:** Every markup renderer (`CountPinMarkup`, `LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, `WallMarkup`) calls `hiddenItemSet.has(markup.name)`. Since both markups have `.name === "Wallahi"`, both are hidden when either is toggled.

3. **TotalsRow cycle matching:** `findPagesWithMatches` and `matchMarkupsOnPage` filter `m.name === itemName` without checking category. Clicking a row highlights markups from both categories.

4. **BOQ aggregator:** The aggregator **correctly** separates by `(categoryId, name|type)` composite bucket — so the counts are correct. The bug is purely in the visibility/UI layer.

## Blast Radius

| Operation | Keyed by | Affected |
|---|---|---|
| Toggle hide/show (lightbulb) | name alone | YES — cross-category collision |
| Canvas hide/show render | name alone | YES — all markups with that name hide |
| TotalsRow cycle click | name alone | YES — navigates to markups in other categories too |
| TotalsRow hover highlight | name alone | YES — highlights markups in other categories |
| BOQ aggregation | (categoryId, name, type) | NO — correct |
| Edit markup | markup.id | NO — correct |
| Delete markup | markup.id | NO — correct |
| Recolor group | name alone | pre-existing design decision; not changed |

## Fix Applied

Changed the visibility key from `name` to a `name|categoryId` composite key (`itemKey`) throughout the UI layer:

1. **`projectStore.ts`:** Renamed field comments to reflect the key is now `name|categoryId`. No structural change needed — the `string[]` and `Set<string>` work with any key format.

2. **`TotalsRow.tsx`:**
   - Added `itemKey` computed as `` `${itemName}|${item.categoryId ?? ''}` `` using a new `categoryId` field on `BoqItemRow`
   - `hiddenItemSet.has(itemKey)` instead of `hiddenItemSet.has(itemName)`
   - `toggleHiddenItem(itemKey)` instead of `toggleHiddenItem(itemName)`
   - `findPagesWithMatches` and `matchMarkupsOnPage` now also filter by `m.categoryId`

3. **`boq-types.ts`:** Added `categoryId: string | null` field to `BoqItemRow`

4. **`boq-aggregator.ts`:** Populates `categoryId` on each `BoqItemRow` when building items

5. **`TotalsCategoryBlock.tsx`:** `matchesForRow` now also checks `m.categoryId === categoryId` from the parent `category` context

6. **Markup renderers (`CountPinMarkup`, `LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, `WallMarkup`):** Use `hiddenItemSet.has(\`${markup.name}|${markup.categoryId}\`)` instead of `hiddenItemSet.has(markup.name)`

## Resolution

- root_cause: hiddenItemNames/hiddenItemSet keyed by name alone; two items with the same name but different categoryIds collide
- fix: composite key `name|categoryId` used throughout the UI visibility layer
- files_changed: boq-types.ts, boq-aggregator.ts, TotalsRow.tsx, TotalsCategoryBlock.tsx, CountPinMarkup.tsx, LinearMarkup.tsx, AreaMarkup.tsx, PerimeterMarkup.tsx, WallMarkup.tsx
- edge_cases: existing saved projects with hiddenItemNames using bare names will not match the new composite key format — they will effectively be reset to "all visible" on next load (safe degradation)
