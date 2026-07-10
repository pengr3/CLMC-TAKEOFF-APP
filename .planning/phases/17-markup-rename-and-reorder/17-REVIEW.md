---
phase: 17-markup-rename-and-reorder
reviewed: 2026-07-10T02:47:54Z
depth: deep
files_reviewed: 18
files_reviewed_list:
  - src/renderer/src/stores/markupStore.ts
  - src/renderer/src/stores/projectStore.ts
  - src/renderer/src/lib/group-ops.ts
  - src/renderer/src/lib/boq-aggregator.ts
  - src/renderer/src/lib/boq-types.ts
  - src/renderer/src/lib/project-schema.ts
  - src/renderer/src/lib/project-serialize.ts
  - src/renderer/src/types/markup.ts
  - src/renderer/src/hooks/useBoqLive.ts
  - src/renderer/src/hooks/useRowReorder.ts
  - src/renderer/src/components/EstimateCategoryBlock.tsx
  - src/renderer/src/components/EstimatePanel.tsx
  - src/renderer/src/components/EstimateRow.tsx
  - src/renderer/src/components/GroupCategoryDialog.tsx
  - src/renderer/src/components/InlineRenameInput.tsx
  - src/renderer/src/components/RenameCollisionMessage.tsx
  - src/renderer/src/components/TotalsCategoryBlock.tsx
  - src/renderer/src/components/TotalsPanel.tsx
  - src/renderer/src/components/TotalsRow.tsx
  - src/renderer/src/components/TotalsRowContextMenu.tsx
findings:
  critical: 0
  high: 1
  medium: 3
  low: 3
  total: 7
status: issues
remediation:
  fixed_at: 2026-07-10
  fixed:
    HG-01: 10daec6
    MD-01: 93db214
    LW-01: b0c319f
    LW-02: 6efe392
  deferred:
    - MD-02  # moving a hidden group un-hides it — out of scope by decision
    - MD-03  # same-category different-type rename visibility coupling — documented limitation
    - LW-03  # case-sensitive rename collision vs case-insensitive category match — by design
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-10T02:47:54Z
**Depth:** deep (cross-file trace of the markupStore ↔ projectStore cycle, the UI wiring for rename/reorder/move/copy, and the aggregator/persistence surfaces)
**Files Reviewed:** 18 source files (36 changed files total incl. 17 new test files; test files were read for behavior confirmation but are not separately findings-scoped per review policy)
**Status:** issues

## Summary

Phase 17 adds `renameGroup` / `moveGroup` / `copyGroup` / `duplicateGroup` / `reorderItems` to `markupStore`, a `categoryItemOrder` field with an additive V2 hydrate coercion, a shared `useRowReorder` drag hook, and the Totals/Estimate UI wiring (inline rename, grip drag, Move/Copy dialog). The full test suite (786 tests, 102 files) and `tsc --noEmit` both pass cleanly, and the specific phase 17 test files (131 tests) are green.

The highest-risk area — cross-store atomic undo (`applyProjectUndo`/`applyProjectRedo` called synchronously before the markupStore `set()` in `undo()`/`redo()`) — is correctly implemented and is verified by a dedicated, thorough test file (`group-undo-atomic.test.ts`) covering rename/move/copy/duplicate. The markupStore↔projectStore circular import is safe: both sides only dereference the other store lazily inside action bodies (never at module top-level), so there is no temporal-dead-zone risk. `renameGroup`'s collision-block path is a genuine zero-write no-op (proven by tests asserting `isDirty` stays `false`). The `categoryItemOrder` V5 hydrate coercion never throws on malformed input, matching its documented contract.

That said, one concrete data-integrity bug was found in the new Move/Copy category dialog (no guard against an empty/whitespace category name, and the app has no way to rename or delete a category once created), plus three cross-file/UI-state defects around per-category hidden-state re-keying and the group-spans-two-categories edge case that the phase's own tests already exercise at the store level but the UI layer does not fully account for.

## High

### HG-01: Move/Copy category dialog allows confirming a blank category name — creates a permanent, unrecoverable blank-named category

**Status:** ✅ Fixed (commit `10daec6`) — `GroupCategoryDialog.handleConfirm` early-returns on a blank/whitespace name and the Confirm button is `disabled` while the trimmed input is empty; `moveGroup`/`copyGroup` also guard against an empty target so no caller can reach `getOrCreateCategory('')`. Covered by two new tests in `totals-row-group-ops.test.ts` (disabled-button and Enter-bypass paths).

**File:** `src/renderer/src/components/GroupCategoryDialog.tsx:71-78`, wired from `src/renderer/src/components/TotalsPanel.tsx:341-349` and `src/renderer/src/components/EstimatePanel.tsx:473-481`; consumed by `src/renderer/src/stores/markupStore.ts:391-407` (`getOrCreateCategory`) via `moveGroup`/`copyGroup` (`markupStore.ts:588-696`).

**Issue:** `GroupCategoryDialog`'s Category input auto-focuses on mount (per UI-SPEC §5) and both `handleConfirm` (button click) and the backdrop's `Enter` handler (`handleKey`, line 89-92) call `onConfirm(categoryName.trim())` **unconditionally** — there is no check that `categoryName` is non-empty:

```tsx
const handleConfirm = useCallback((): void => {
  const typed = categoryName.trim()
  const match = categories.find((c) => c.name.toLowerCase() === typed.toLowerCase())
  onConfirm(match ? match.name : typed)   // typed can be ''
}, [categoryName, categories, onConfirm])
```

`TotalsPanel`/`EstimatePanel` forward whatever string is emitted straight to `moveGroup(name, categoryName)` / `copyGroup(name, categoryName)`, which call `getOrCreateCategory(targetCategoryName)` with **no fallback**. `getOrCreateCategory('')` (`markupStore.ts:391-407`) does not find an existing `''`-named category and creates a brand-new `Category` with `name: ''.trim() === ''`.

This is trivially reachable: open "Move to…"/"Copy to…" from the row context menu, and press **Enter immediately** (the input is already focused, `showList` is `false` so `handleCategoryKeyDown` doesn't intercept Enter, so it bubbles to `handleKey` → `handleConfirm()`) without typing anything. The group is silently moved/copied into a new, permanently blank-named category.

Consequences:
- `aggregateBoq`'s `catName = categoriesById[catKey]?.name ?? UNCATEGORIZED_LABEL` (`boq-aggregator.ts:306-309`) only falls back on `null`/`undefined`, **not** on an empty string, so the category renders with a blank heading in both the Totals panel and the Estimate sheet, and in the xlsx/csv export.
- The codebase has **no rename-category or delete-category action** (`grep` for `renameCategory`/`deleteCategory` returns nothing) — once created, this category is permanent and can only be emptied (not removed) by moving every item back out, one at a time, through the very same unguarded dialog.
- This is a regression relative to the existing pattern already used elsewhere in the codebase: `useMarkupTool.ts:495` guards the identical class of input with `store.getOrCreateCategory(payload.categoryName || UNCATEGORIZED)` (falls back to the `'Uncategorized'` category). `GroupCategoryDialog`'s new confirm path does not apply the same guard.

**Fix:** Guard `handleConfirm` (and disable the Confirm button) when `typed.length === 0`, e.g.:

```tsx
const handleConfirm = useCallback((): void => {
  const typed = categoryName.trim()
  if (typed.length === 0) return // or fall back to an "Uncategorized" default, mirroring useMarkupTool.ts:495
  const match = categories.find((c) => c.name.toLowerCase() === typed.toLowerCase())
  onConfirm(match ? match.name : typed)
}, [categoryName, categories, onConfirm])
```
and pass `disabled={categoryName.trim().length === 0}` to the Confirm button. Alternatively/additionally, add the same non-empty guard inside `moveGroup`/`copyGroup` in `markupStore.ts` so any future caller can't reach `getOrCreateCategory('')`.

## Medium

### MD-01: `isRenaming`/`renamingKey` is keyed only by `name|type` (no categoryId) — a group spanning two categories opens two simultaneous rename editors

**Status:** ✅ Fixed (commit `93db214`) — added `renameKeyForItem` (`${categoryId}::${name}|${type}`, empty/null → `__uncat__`) in `TotalsRow.tsx`; both category blocks and both panels' context-menu Rename now set/compare the category-scoped key, so only the interacted row opens its editor. The value passed to `renameGroup` is still the bare group name. New test `rename-key-category-scope.test.ts` asserts exactly one editor mounts for the group-spans-two-categories scenario (double-click AND context-menu paths).

**File:** `src/renderer/src/components/TotalsCategoryBlock.tsx:64-65,193`, `src/renderer/src/components/EstimateCategoryBlock.tsx:59-60,161`, `src/renderer/src/components/TotalsPanel.tsx:308` / `EstimatePanel.tsx:442` (`onRename` sets `renamingKey`).

**Issue:** `renamingKey` (owned by the parent panel) and each row's `rowKey` are both the bare `${labelToName(label)}|${type}` string — it does not include `categoryId`. Per the SPEC/CONTEXT ("Pitfall 3"), a single name-group can legitimately span two categories (e.g. via the pre-existing single-markup `editMarkup` category edit, or the documented `moveGroup` multi-category-collapse limitation) — this exact scenario is directly exercised by `rename-group-command.test.ts`'s `"group spanning two categories"` describe block and `move-group-command.test.ts`. When this happens, the SAME `name|type` string is simultaneously the `rowKey` of **two different rows** — one per category block. Double-clicking (or choosing "Rename" from the context menu on) either row sets `renamingKey` to that shared string, so `renamingKey === rowKey` is `true` for **both** rows at once (`TotalsCategoryBlock.tsx:193`, `EstimateCategoryBlock.tsx:161`), mounting `InlineRenameInput` twice — once per category block — both auto-focusing/select-all on mount and racing for keyboard focus.

If the user commits from the first editor, the group is renamed correctly (this part of the store logic is sound), but the **second**, still-mounted `InlineRenameInput` instance is left open with a now-stale `currentName`. Any interaction that blurs it fires `commit()`, which calls `renameGroup(staleOldName, ...)`; since `staleOldName` no longer matches any markup, `renameGroup` returns `{ ok: false }` (`markupStore.ts:506`, "no group to rename"), and `InlineRenameInput` treats `ok:false` identically to a same-type collision — it mounts `RenameCollisionMessage` ("A group named '…' already exists") and keeps the stale editor open indefinitely, even though there was no actual collision.

**Fix:** Scope the rename identity by category as well as `name|type`, e.g. `renamingKey = `${categoryId}::${itemName}|${type}`` when setting/comparing, so only the row the user actually interacted with opens its editor. (This mirrors the existing distinction already drawn between the rate key `name|type` and the visibility key `name|categoryId` — `renamingKey` needs the same category-scoping.)

### MD-02: `moveGroup` does not re-key `hiddenItemNames`'s composite `name|categoryId` entry — moving a hidden group silently un-hides it

**Status:** ⏸️ Open — deferred by decision (out of scope for this remediation pass; tracked as a known limitation).

**File:** `src/renderer/src/stores/markupStore.ts:588-670` (`moveGroup`); contrast `renameGroup`'s `hiddenReKeys` handling at `markupStore.ts:528-539,555`.

**Issue:** `renameGroup` correctly re-keys the composite hidden-visibility key (`${name}|${categoryId}`) per distinct category the group touches. `moveGroup` reassigns every markup's `categoryId` to the target category but never touches `hiddenItemNames`. Since the visibility key includes the **old** `categoryId`, a group that was hidden on the canvas (`hiddenItemNames` contains `"{name}|{oldCategoryId}"`) becomes visible again the moment it is moved, because the canvas renderers (`AreaMarkup.tsx:56`, `CountPinMarkup.tsx:57`, etc.) recompute `itemKey` from the markup's **new** `categoryId` and it no longer matches any entry in `hiddenItemNames`. There is no user-facing warning that a move resets visibility, and the stale `"{name}|{oldCategoryId}"` entry is left orphaned in `hiddenItemNames` forever (harmless but a silent leak).

This exact gap is called out internally in `.planning/phases/17-markup-rename-and-reorder/17-04-SUMMARY.md` ("Move + visibility (for the UI wave): moving a hidden group effectively un-hides it… out of scope here") but no follow-up ships in Waves 5-7, and neither the `17-SPEC.md` acceptance criteria nor the UI-SPEC mention this as an accepted, user-visible limitation.

**Fix:** Either (a) extend the `move-group` command with an optional `hiddenReKeys` field (mirroring `rename-group`) so a moved-and-hidden group re-keys its hidden entry and the move remains reversible in one Ctrl+Z, or (b) if staying out of scope, surface this to the user (e.g. a one-time toast "Visibility reset — this item is no longer hidden") so the silent behavior change is not surprising.

### MD-03: A same-category, different-type rename collision can silently couple two unrelated groups' hidden/visible state

**Status:** ⏸️ Open — deferred by decision (documented limitation next to D-04; out of scope for this remediation pass).

**File:** `src/renderer/src/lib/group-ops.ts:49-58` (`collisionExists`) + `src/renderer/src/stores/markupStore.ts:511-539` (rename collision check + `hiddenReKeys` computation).

**Issue:** `collisionExists` (by design, D-04) only blocks a rename when the target name collides with **another group of the same type**; a same-name, **different**-type group is explicitly allowed to coexist (proven by `rename-group-collision.test.ts`, `"does NOT block when the same-name 'B' is under a DIFFERENT type"`). However, the visibility key (`name|categoryId`) does **not** include `type` — it is shared by any two groups with the same name and category regardless of type (this is a pre-existing characteristic of the visibility model, not new to Phase 17, but Phase 17's rename feature is the first operation that can *actively create* this state in one step rather than requiring the user to type an identical name twice at creation time).

Concretely: category C has "A" (count, not hidden) and "B" (area, **hidden** — `"B|C"` ∈ `hiddenItemNames`). Renaming "A"→"B" is allowed (different type) and produces a "B" count group in the same category. `hiddenReKeys` only re-keys an entry if `"A|C"` was itself hidden (`markupStore.ts:536`) — it does **not** check whether the **destination** key `"B|C"` is already occupied by an unrelated hidden entry. After the rename, the renamed count group "B" now silently inherits the hidden state that actually belongs to the pre-existing area group "B", because both draw from the identical composite key on the canvas.

**Fix:** At minimum, document this as a known limitation next to D-04 in the SPEC/CONTEXT (the way the move-visibility gap in MD-02 was documented). Better: warn or block the rename when the destination `name|categoryId` composite is already present in `hiddenItemNames` under a different type, since committing it silently changes an unrelated group's rendered visibility.

## Low

### LW-01: `hydrateStores`'s new `categoryItemOrder` coercion is vulnerable to a `__proto__` key silently repointing the sanitized object's prototype

**Status:** ✅ Fixed (commit `b0c319f`) — the coercion loop now skips dunder keys (`__proto__`/`constructor`/`prototype`) so a crafted `.clmc` cannot repoint the sanitized object's prototype. New test in `project-order-roundtrip.test.ts` asserts the key is dropped, the prototype is untouched, and it never throws.

**File:** `src/renderer/src/lib/project-serialize.ts:107-115`

**Issue:**
```ts
const safeOrder: Record<string, string[]> = {}
if (rawOrder && typeof rawOrder === 'object') {
  for (const [k, v] of Object.entries(rawOrder as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      safeOrder[k] = v.filter((x): x is string => typeof x === 'string')
    }
  }
}
```
A crafted `.clmc` with `"categoryItemOrder": { "__proto__": ["a"] }` assigns through the special `__proto__` accessor (`safeOrder["__proto__"] = [...]` behaves like `safeOrder.__proto__ = [...]`, per the Annex-B legacy accessor on `Object.prototype`), silently changing `safeOrder`'s own prototype rather than being sanitized/dropped like other malformed input. This mirrors a pre-existing weakness in the sibling `safeRates` coercion a few lines below (`project-serialize.ts:151-170`), so it isn't newly introduced by this diff, but Phase 17 repeats the same unguarded pattern for a brand-new untrusted-input surface that the file's own comments explicitly frame as hardened against "a crafted/corrupt `.clmc`" (T-17-01). No global `Object.prototype` pollution occurs (the mutation is scoped to the local `safeOrder` object) and no exploit path was found downstream, so this is Low, not Critical/High — but it is inconsistent with the function's "never throws / always sanitizes untrusted fields" contract.

**Fix:** Build with a null-prototype base and/or skip dunder keys, e.g. `const safeOrder: Record<string, string[]> = Object.create(null)` or `if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue`.

### LW-02: `useRowReorder`'s window pointer listeners are not cleaned up if the component unmounts mid-drag

**Status:** ✅ Fixed (commit `6efe392`) — the in-progress drag's teardown (remove both window listeners + cancel the rAF) is tracked in a ref and invoked from a `useEffect` unmount cleanup, so an interrupted drag can't leak a listener across a project switch. Normal pointerup drop behavior unchanged. New unmount-mid-drag test in `row-reorder-drag.test.ts`.

**File:** `src/renderer/src/hooks/useRowReorder.ts:132-154`

**Issue:** `onGripPointerDown` registers `pointermove`/`pointerup` listeners on `window` and only removes them inside the `onUp` handler (i.e., on `pointerup`). If the owning `TotalsCategoryBlock`/`EstimateCategoryBlock` (or the whole app tree) unmounts while a drag is in progress — e.g. the user starts dragging a row and then closes the project / opens a different `.clmc` file before releasing the pointer — the listeners are never removed, and the stale closure (capturing the old `catKey`/`startOrder`/`itemKey`) will fire `useMarkupStore.getState().reorderItems(...)` against whatever project happens to be loaded when the pointer is eventually released. This mirrors the same unguarded idiom already used by `Splitter`/`useDraggable` elsewhere in the codebase (not a regression specific to this file), but since this is new Phase-17 code it's a reasonable place to add the missing safety net.

**Fix:** Return a cleanup from `useRowReorder` (or track drag state in a ref and add a `useEffect` unmount handler) that calls the same `window.removeEventListener` pair and cancels any pending `requestAnimationFrame`, so an interrupted drag can't leak a listener across a project switch.

### LW-03: Rename collision check is case-sensitive while category-name matching is case-insensitive — inconsistent naming discipline

**Status:** ⏸️ Open — deferred by decision (group names are case-sensitive by design; out of scope for this remediation pass).

**File:** `src/renderer/src/lib/group-ops.ts:49-58` (`collisionExists`, exact `m.name === newName`) vs. `src/renderer/src/stores/markupStore.ts:371-377` (`findCategoryByName`, `.trim().toLowerCase()` comparison) and `GroupCategoryDialog.tsx:76` (also case-insensitive).

**Issue:** Category names are deduplicated case-insensitively throughout the app ("Finishes" and "finishes" resolve to the same category), but group-name rename collisions are compared with strict `===`. A user can rename "Slab" to "SLAB" (or "slab") even though, semantically, the aggregator's per-name grouping and any downstream visual scan for "duplicate-looking" names would likely consider these the same item. This is a minor naming-discipline inconsistency rather than a functional defect (the aggregator's bucket key is genuinely distinct for "Slab" vs "SLAB" so no merge/collision actually occurs), but is worth a note given the app is otherwise deliberately case-insensitive for the sibling "category" concept.

**Fix:** Consider whether group-name collision should also be case-insensitive for consistency, or explicitly document that group names are case-sensitive by design (unlike categories).

---

_Reviewed: 2026-07-10T02:47:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
