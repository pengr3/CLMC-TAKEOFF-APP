# Phase 17: Markup Rename and Reorder — Specification

**Created:** 2026-07-09
**Ambiguity score:** 0.18 (gate: ≤ 0.20)
**Requirements:** 5 locked

## Goal

From the totals panel and the Estimate sheet, an estimator can **rename**, **reorder (within a category)**, **move**, **copy**, and **duplicate** markup groups — reusing measured quantities without re-drawing — with every operation persisted in the `.clmc` and reversible with a single Ctrl+Z.

## Background

Grounded in the current codebase:

- Markups live in `markupStore.pageMarkups: Record<page, Markup[]>`. A "group" is **every markup sharing a `.name`** — there is no group entity; grouping is implicit by name.
- `recolorGroup(name, color)` is the only existing whole-group, multi-page, undoable operation. `editMarkup(...)` edits a **single** markup (name/category/color/wallHeight) via the undoable `edit-markup` command. No `renameGroup`, `moveGroup`, `copyGroup`, or `duplicateGroup` exists.
- Three name-keyed side-tables in `projectStore`: `rates: Record<"${name}|${type}", PriceEntry>` (category-**independent**), `hiddenItemNames: string[]` (by name), and per-name color derived from the markups via `getColorForName(name)` (most-recently-created markup's color). **None have a rename/re-key path.**
- `aggregateBoq` buckets by `(categoryId, name|type)`, then sorts items within a category **alphabetically** (`items.sort((a,b) => a.label.localeCompare(b.label))`, boq-aggregator.ts:264). The totals panel, Estimate sheet, and xlsx/csv writers all consume this **single** aggregator output — so changing the sort changes all three surfaces at once.
- Category order persists as `markupStore.categoryOrder: string[]` (+ serialize/hydrate). There is **no** per-item order within a category.
- Undo/redo is a command stack in `markupStore` (place / delete / delete-group / edit-markup / recolor-group / move-vertex / move-markups / reshape-arc / reopen-recommit), capped at `UNDO_STACK_MAX = 50`. `projectStore` mutations (rates, hidden, defaultMarkup) are **not** on the undo stack — they mark the project dirty directly.
- `.clmc` is `ProjectFileV2`; new fields are added **additively with no `formatVersion` bump** (precedent: `rates`, `hiddenItemNames`, `arcs`, `categoryOrder`).
- Trigger surfaces today: canvas right-click → single-markup Edit/Delete; totals panel has `TotalsRowContextMenu`, a visibility lightbulb, and click-to-arm; Estimate sheet rows (`EstimateRow`) have editable rate cells. None expose group rename/move/copy/duplicate.

## Requirements

1. **Rename a markup group**: Rename the whole name-group from a totals-panel row or an Estimate-sheet row.
   - Current: no group rename; `editMarkup` renames one markup only; `rates` / `hiddenItemNames` have no re-key path.
   - Target: the action changes `.name` on **every** markup in the group (all pages) and **atomically re-keys** `rates` (`oldName|type` → `newName|type` for each type present) and `hiddenItemNames` (oldName → newName); per-name color follows automatically. If the new name already exists on another group, a **merge-confirm dialog** appears explaining the merge and that the existing target's rate is kept; confirming merges the groups (quantities add, count sequences renumber, colliding `name|type` rate keys resolve to the target's entry), cancelling aborts with no change. One undoable command reverts names + re-keying together.
   - Acceptance: renaming "A"→"B" (no existing "B") shows all "A" markups now named "B", the BOQ row relabels, and `rates["A|count"]` becomes `rates["B|count"]` with the same `PriceEntry`; Ctrl+Z restores "A" and its rate key. Renaming "A"→"B" when "B" exists shows the merge-confirm dialog; confirm yields one merged "B" group with summed quantity and the pre-existing "B" rate; cancel leaves both groups unchanged.

2. **Reorder items within a category**: Drag rows to set their order on both the totals panel and the Estimate sheet.
   - Current: items within a category are sorted alphabetically by the aggregator; no per-item order exists or persists.
   - Target: rows within a category can be reordered by drag on **both** surfaces; the aggregator emits items in a **persisted per-category manual order** — placement order by default (the order items were first added), drag reorders, newly-added items append at the end. The order is stored in an additive `.clmc` field (no `formatVersion` bump) and is the same order shown by the totals panel, the Estimate sheet, **and** the xlsx/csv export. One undoable command.
   - Acceptance: dragging row 3 above row 1 in a category persists that order; save + reload preserves it; the xlsx export lists that category's rows in the same order; Ctrl+Z restores the prior order. A category never manually reordered lists rows in placement order (not alphabetical).

3. **Move a group to another category**: Reassign a whole group's category.
   - Current: category is set per markup at creation/edit; no group-level move; a group's rate is category-independent.
   - Target: the action reassigns `categoryId` on every markup in the group to a chosen target category; quantity, name, color, and rate (category-independent `name|type`) are unchanged. The group's BOQ row leaves the old category and appears in the target category (appended to the target's manual order). One undoable command (undo restores the original category).
   - Acceptance: moving group "Slab" from "Civil" to "Finishes" shows the "Slab" row only under "Finishes" with the same quantity and rate; Ctrl+Z returns it to "Civil".

4. **Copy a group into another category**: Reuse a measurement under a second category as an independent snapshot.
   - Current: no copy; a measurement exists under exactly one category; reusing a quantity requires re-drawing.
   - Target: the action creates **independent new markups** (new ids, same page + geometry/points/arcs) assigned to a chosen target category, under an **auto-generated unique name** (e.g. "Slab (2)") with a **fresh blank rate entry** (material ₱0 / labor ₱0 / project default markup). The original is untouched and the copy is independent — later edits to the original's geometry do not change the copy. One undoable command (undo removes the copied markups **and** their rate entry).
   - Acceptance: copying "Slab" (Civil) into "Finishes" produces a new "Slab (2)" row under "Finishes" with the same quantity, a blank rate, and a distinct rate key; editing the original "Slab" geometry does not change "Slab (2)"'s quantity; Ctrl+Z removes "Slab (2)" and its rate entry.

5. **Duplicate a group in place**: Independent snapshot within the same category.
   - Current: no duplicate; a same-name, same-type, same-category markup would merge into the source's BOQ bucket (doubling its quantity).
   - Target: the action creates **independent new markups** (new ids, same page + geometry) in the **same** category under an auto-generated unique name (e.g. "Slab (2)") with a fresh blank rate entry; it does **not** merge into the source (distinct name → distinct bucket). One undoable command.
   - Acceptance: duplicating "Slab" yields a second row "Slab (2)" in the same category with the same quantity and a blank rate, and the original "Slab" quantity is unchanged (no doubling); Ctrl+Z removes the duplicate.

## Boundaries

**In scope:**
- Five group operations — rename, reorder-within-category, move, copy, duplicate — triggered from totals-panel rows **and** Estimate-sheet rows.
- Atomic re-keying of `rates` + `hiddenItemNames` on rename; category reassignment on move; independent-snapshot creation with auto-name + blank rate on copy/duplicate.
- A persisted per-category manual item order (additive `.clmc` field, no `formatVersion` bump) shared by the totals panel, the Estimate sheet, and the xlsx/csv export.
- Undo/redo for all five operations, atomic across `markupStore` + `projectStore`.
- A merge-confirm dialog on rename name collision.

**Out of scope:**
- Live-shared / multi-category geometry (a markup belonging to >1 category at once) — explicitly rejected in favor of independent snapshots (Round 2 decision).
- Cross-category drag-reorder (dragging a row across a category boundary) — a category change is done via **Move**, not via the reorder drag (Round 1 decision).
- Reordering the categories themselves — `categoryOrder` already exists and is unchanged this phase.
- Group operations from the canvas right-click context menu — the canvas keeps its existing single-markup Edit/Delete; triggers live on the two list surfaces only (Round 3 decision).
- A create-time name/category prompt on copy/duplicate — copy/duplicate auto-name silently; the separate rename operation handles renaming afterward (Round 3 decision).
- Bulk / multi-group operations (selecting many groups and renaming/moving at once) — single-group operations only this phase.

## Constraints

- **Persistence**: the new per-category order is an additive `ProjectFileV2` field; **NO `formatVersion` bump** (mirrors `rates` / `hiddenItemNames` / `arcs` / `categoryOrder`). Old `.clmc` files load with no order field → placement order, no error.
- **Undo atomicity**: every operation pushes exactly one command onto the `markupStore` stack (cap 50); operations that also touch `projectStore` (rename re-keying; copy/duplicate rate entry) must revert those `projectStore` changes in the **same** undo step — the command model must be extended so one Ctrl+Z is atomic across both stores.
- **Rate key stays `name|type`, category-independent** (unchanged). Copy/duplicate rely on auto-name uniqueness to obtain a distinct key.
- **Auto-name uniqueness**: generated names must not collide with an existing group of the same type (else the aggregator bucket would merge); the generator picks the first free "{name} (n)".
- **Merge-on-rename** resolves colliding `name|type` rate keys to the pre-existing target entry (the source's is dropped); the confirm dialog discloses this.
- **No new npm packages** — reorder uses the existing stack (a DOM list drag-and-drop is acceptable; exact mechanism deferred to discuss-phase).

## Acceptance Criteria

- [ ] Renaming a group updates every markup's name across all pages and re-keys its `rates` + `hiddenItemNames` entry; one Ctrl+Z reverts all of it.
- [ ] Renaming onto an existing name shows a merge-confirm dialog; confirm merges (quantities sum, target rate kept), cancel makes no change.
- [ ] Within-category rows can be dragged to a new order on **both** the totals panel and the Estimate sheet.
- [ ] The manual order persists across save/reload and is identical in the totals panel, the Estimate sheet, and the xlsx/csv export.
- [ ] A category never reordered lists rows in placement order (not alphabetical).
- [ ] Move reassigns a group to another category with unchanged quantity/rate; Ctrl+Z restores the original category.
- [ ] Copy creates an independent "{name} (n)" row under a chosen other category with the same quantity, a blank rate, and a distinct rate key; editing the source geometry does not change the copy.
- [ ] Duplicate creates an independent "{name} (n)" row in the same category without doubling the source's quantity.
- [ ] Copy and duplicate are each reverted by one Ctrl+Z, removing both the new markups and their rate entry.
- [ ] Old `.clmc` files (no order field) load without error and list rows in placement order; the file still round-trips with no `formatVersion` bump.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | 5 operations, each with concrete before→after behavior       |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | Explicit out-of-scope: live-share, cross-cat drag, canvas triggers, bulk |
| Constraint Clarity | 0.80  | 0.65 | ✓      | Additive persistence, cross-store atomic undo, category-independent rate key |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | 10 pass/fail checks                                          |
| **Ambiguity**      | 0.18  | ≤0.20| ✓      |                                                              |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                              | Decision locked                                                              |
|-------|-----------------|-----------------------------------------------|------------------------------------------------------------------------------|
| 1     | Researcher      | Rename name collision behavior                | Prompt merge-or-cancel dialog (reuse confirm-with-impact pattern)            |
| 1     | Boundary Keeper | Reorder scope                                 | Within-category only (+ user opened move/copy/duplicate as new scope)        |
| 1     | Failure Analyst | Undo behavior for rename/reorder              | Both undoable via Ctrl+Z                                                      |
| 2     | Simplifier      | Which of move/copy/duplicate to include       | All three included                                                           |
| 2     | Researcher      | Reuse data model (shared vs independent)      | Independent copy (snapshot) — no multi-category geometry                     |
| 3     | Boundary Keeper | Copy/duplicate naming vs shared rate/merge    | Auto-name "{name} (n)", rename later; each gets its own rate entry          |
| 3     | Boundary Keeper | Default row order once reorder ships          | Manual placement order from the start (replaces alphabetical)               |
| 3     | Boundary Keeper | Trigger surfaces                              | Totals panel + Estimate sheet only (canvas menu unchanged)                  |
| 4     | Failure Analyst | Rate on a copied/duplicated line              | Start blank (material ₱0 / labor ₱0 / default markup)                       |
| 4     | Failure Analyst | Undo for move/copy/duplicate                  | All undoable, atomic across markupStore + projectStore                      |

---

*Phase: 17-markup-rename-and-reorder*
*Spec created: 2026-07-09*
*Next step: /gsd-discuss-phase 17 — implementation decisions (how each operation is wired: rename re-key command, per-category order storage + drag mechanism, snapshot/auto-name engine, merge-confirm dialog)*
