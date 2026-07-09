# Phase 17: Markup Rename and Reorder — Research

**Researched:** 2026-07-09
**Domain:** Brownfield feature extension — whole-group commands + persisted per-category order + cross-store atomic undo, on an Electron 35 / React 19 / Zustand 5 / TypeScript desktop takeoff app
**Confidence:** HIGH (every architectural claim below is grounded in the current codebase, read this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (triggers):** All five group ops invoked from a **right-click context menu on both surfaces**. Extend `TotalsRowContextMenu` (add Rename / Move to… / Copy to… / Duplicate above a separator; keep "Copy as text" below, totals-only). Add the **same** four-item menu to `EstimateRow` (which has none today). Rejected: hover-⋯ button, "both".
- **D-02 (rename trigger):** Inline edit-in-place. Menu "Rename" **or** double-click the name cell. On the **totals row**, guard the double-click with `e.detail === 2` so the instant single-click cycle/arm is never delayed. Estimate Item cell has no click handler → double-click is clean. Commit on Enter/blur, cancel on Esc. Reuse the uncontrolled-input + native-listener recipe.
- **D-03 (rename semantics):** Name-only (category changes go through Move). Blank/whitespace rejected. One undoable command changes `.name` on every markup in the group (all pages) and **atomically re-keys** `rates` (`old|type`→`new|type`, per type present) + `hiddenItemNames` (old→new); per-name color follows automatically.
- **D-04 (collision → BLOCK — supersedes SPEC Req 1 merge):** If the typed name already exists on another group **of the same type**, rename is **blocked** with inline "A group named '{name}' already exists"; both groups untouched. **No merge, no merge-confirm dialog, no rate-key merge, no count-sequence renumbering.**
- **D-05 (category picker):** Move + Copy choose destination via a small dialog reusing `CategoryAutocomplete` (existing-or-new). App modal convention (`useDraggable`, ESC=Cancel/Enter=Confirm).
- **D-06 (Move):** Reassigns `categoryId` on every markup in the group to the chosen category; name/quantity/color/rate unchanged. Row leaves old category, appends to the target's manual order. One undoable command.
- **D-07 (Copy):** Independent new markups (new ids, same page + geometry/points/arcs) in the chosen category under an auto-generated unique name ("{name} (n)", first free) with a **fresh blank rate** (material ₱0 / labor ₱0 / project default markup). Dialog **shows the resulting auto-name**. One undoable command (undo removes copied markups **and** their rate entry).
- **D-08 (Duplicate):** No dialog — same category, auto-named "{name} (n)", fresh blank rate; independent snapshot; does not merge into source. One undoable command.
- **D-09 (grab):** Dedicated **grip handle** (GripVertical) revealed on row-hover; drag works **only** from the handle. Leading edge. Both surfaces. Rejected: grab-anywhere.
- **D-10 (drop feedback):** **Insertion line** — grabbed row lifts + follows cursor; thin accent line shows drop position. Rejected: live push/gap animation.
- **D-11 (order semantics — SPEC-locked):** Within-category only. Default = **placement order** (replacing alphabetical); newly-added items **append**. Single persisted per-category manual order shared by totals panel, Estimate sheet, **and** xlsx/csv export. Additive `.clmc` field, no `formatVersion` bump.

### Claude's Discretion / For research (answered in this doc)
- Drag mechanism (HTML5 DnD vs pointer-events) → **§ Pattern 1** (pointer-events).
- Persisted-order field shape → **§ Pattern 2**.
- Cross-store atomic-undo command extension → **§ Pattern 3**.
- How `aggregateBoq` consumes the manual order → **§ Pattern 4**.
- Supporting engines (auto-name, re-key, snapshot, inline-rename) → **§ Pattern 5**.
- Grip-handle glyph + hover-zone layout → executor UI detail (UI-SPEC §4 is authoritative).

### Deferred Ideas (OUT OF SCOPE — do not research or build)
- Deliberate group-merge (a real "Merge groups" feature) — future phase.
- Bulk / multi-group operations.
- Live-shared / multi-category geometry.
- Cross-category drag-reorder (category change is Move, not a drag).
- Reordering the categories themselves (`categoryOrder` unchanged).
- Group ops from the canvas right-click menu (list surfaces only).
- A create-time **name** prompt on copy/duplicate (they auto-name silently; Copy still picks a category).
</user_constraints>

<phase_requirements>
## Phase Requirements

This phase adds **no new v1 REQ-IDs**. The locked requirements are the 5 in `17-SPEC.md` (Req 1–5) plus decisions D-01..D-11 in `17-CONTEXT.md`.

| ID | Description | Research Support |
|----|-------------|------------------|
| Req 1 | Rename a markup group (re-key rates + hidden; block on collision) | § Pattern 3 (cross-store command), § Pattern 5b (re-key), § Pitfall 1 (visibility key is `name\|categoryId`, not bare name), § Pitfall 2 (collision definition) |
| Req 2 | Reorder items within a category (both surfaces; persisted) | § Pattern 1 (pointer drag), § Pattern 2 (order field), § Pattern 4 (aggregator consumes order) |
| Req 3 | Move a group to another category | § Pattern 3 (move-group command), § Pattern 5 (category picker dialog) |
| Req 4 | Copy a group into another category (independent snapshot) | § Pattern 3 (copy-group command), § Pattern 5a (auto-name), § Pattern 5c (snapshot) |
| Req 5 | Duplicate a group in place | § Pattern 3 (duplicate-group command), § Pattern 5a/5c |
</phase_requirements>

## Summary

Phase 17 is an almost-pure extension of three existing seams: the **markupStore command stack** (undo/redo), the **projectStore name-keyed side-tables** (`rates`, `hiddenItemNames`), and the **single renderer-side `aggregateBoq`** that feeds all three output surfaces (totals panel, Estimate sheet, xlsx/csv). Nearly every mechanism the phase needs already exists in a close analog: `recolorGroup` is a whole-group multi-page undoable command; `categoryOrder` is a markupStore-owned array serialized additively into the `.clmc`; the pointer-drag lifecycle is proven in `Splitter`/`useDraggable`; the uncontrolled-input + native-listener inline-edit recipe is proven in `EstimateRow`; the context-menu and modal recipes are proven in `TotalsRowContextMenu` and `DefaultMarkupChangeModal`. **No new npm packages are required** and the existing additive-`.clmc` pattern (no `formatVersion` bump) covers the new order field.

Three findings **correct or sharpen the SPEC/CONTEXT** and are load-bearing for planning. **(1) The aggregator runs in the RENDERER** (`src/renderer/src/lib/boq-aggregator.ts:264`), not `src/main/` as CONTEXT states; the export path (`useExport.ts:79`) aggregates in the renderer and ships the finished `BoqStructure` over IPC — so replacing the sort at line 264 propagates to the xlsx/csv writers with **zero writer, preload, or IPC changes**. **(2) The `hiddenItemNames` visibility key is the composite `name|categoryId`, not the bare name** (`TotalsRow.tsx:125-128`) — so rename must re-key hidden entries per-categoryId, not "old→new" as the SPEC's shorthand says. **(3) `defaultMarkupPct` already exists and persists** (added post-Phase-16, WR-01), extending the additive-field precedent set the planner should copy verbatim.

**Primary recommendation:** Put the new per-category order in **markupStore** (mirroring `categoryOrder`), making **reorder and move pure single-store commands**; extend the `MarkupCommand` union with five new command types; and make **rename / copy / duplicate atomic across stores** by having `markupStore.undo()/redo()` apply a small self-describing projectStore-side payload (carried on the command) via dedicated projectStore actions, immediately before the existing markup `set()`. One `undo()` call = one Ctrl+Z = both stores reverted.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rename group (names) | markupStore command | — | Names live on `Markup.name` in `pageMarkups`; renaming is a `pageMarkups` mutation like `recolorGroup` |
| Rename re-key (`rates`, `hiddenItemNames`) | projectStore | markupStore command (orchestrates undo) | Side-tables live in projectStore; the undo unit lives in markupStore → cross-store payload on the command |
| Reorder within category | markupStore command | — | Order state placed in markupStore (see § Pattern 2) → single-store undoable command |
| Move group (categoryId) | markupStore command | — | `categoryId` is per-markup in `pageMarkups`; order-append is also markupStore |
| Copy / Duplicate (new markups) | markupStore command | projectStore (new rate entry) | New markups are `pageMarkups`; the fresh blank rate is projectStore → cross-store payload |
| Consume manual order → rows | `aggregateBoq` (renderer) | — | Single source of truth feeding all three surfaces; replace the sort at line 264 |
| Persist order in `.clmc` | project-serialize / project-schema | markupStore (owns the field) | Additive optional field, read from markupStore in snapshot (mirrors `categoryOrder`) |
| Export inherits order | boq-writers (main) | — | Writers iterate `cat.items` in array order; order is baked in before IPC → **no change** |
| Inline rename input / drag UI / dialogs / context menu | Renderer components | — | Reuse existing recipes (EstimateRow, Splitter, DefaultMarkupChangeModal, TotalsRowContextMenu, CategoryAutocomplete) |

## Standard Stack

**No new packages.** The phase is built entirely from the installed stack. Versions below are **[VERIFIED: package.json]** (read this session) — the authoritative source of what's installed; the no-new-packages constraint makes the registry's "latest" irrelevant.

### Core (already installed — reuse only)
| Library | Version | Purpose in this phase | Why (verified) |
|---------|---------|----------------------|----------------|
| react | 19.2.1 | Row components, inline editor, dialogs, drag state | Existing UI layer; React-19 event semantics dictate the uncontrolled-input recipe |
| zustand | 5.0.12 | `markupStore` command stack + `projectStore` side-tables + new order field | Both stores already exist; extend, don't add |
| lucide-react | 1.6.0 | `GripVertical` grip glyph (new); `Lightbulb`/`Plus` already used | `GripVertical` is a standard lucide icon `[CITED: 17-UI-SPEC, ui-checker-verified]` — confirm the import resolves in Wave 0 (trivial) |
| typescript | 5.9.3 | Discriminated-union command types; per-field coercion | Command union is a TS discriminated union; new command types compile-checked |
| electron | 35.7.5 | Host; IPC boundary (unchanged) | Order rides inside the existing `BoqStructure` IPC payload |

### Supporting (already installed — export path, unchanged by ordering)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| exceljs | 4.4.0 | xlsx writer (main) | Iterates `cat.items` in array order → **inherits order, no change** |
| csv-stringify | 6.7.0 | csv writer (main) | Same — inherits order |
| vitest | 4.1.1 | Test framework | `environment: 'node'`, `include: src/tests/**/*.test.ts`, alias `@renderer` |

### Alternatives Considered (and rejected — locked by constraints)
| Instead of | Could Use | Tradeoff / why rejected |
|------------|-----------|-------------------------|
| pointer-events drag | `@dnd-kit/core`, `react-dnd`, HTML5 native DnD | New npm packages forbidden (D-11 / SPEC constraint); HTML5 DnD gives poor drag-image control, no clean insertion line, janky auto-scroll |
| Order in markupStore | Order in projectStore | projectStore has no command stack → reorder+move would need cross-store undo machinery for no benefit (see § Pattern 2/3) |
| Extend `MarkupCommand` union | A separate undo stack for group ops | Two stacks break the single-Ctrl+Z contract and the 50-cap discipline |

**Installation:** none — `npm install` adds nothing this phase.

## Architecture Patterns

### System Architecture Diagram

Data flow for the five operations (arrows = data/control flow):

```
  ┌─────────────────── RENDERER ──────────────────────────────────────────────┐
  │                                                                            │
  │  TotalsRow / EstimateRow                                                   │
  │   • right-click ─▶ GroupContextMenu (Rename / Move… / Copy… / Duplicate)   │
  │   • dbl-click name (e.detail===2 guard on totals) ─▶ InlineRenameInput     │
  │   • grip pointerdown ─▶ window pointermove/up ─▶ drop index (row midpoints) │
  │        │                    │                    │                         │
  │        ▼                    ▼                    ▼                         │
  │  ┌──────────────── markupStore (command stack, cap 50) ────────────────┐   │
  │  │  NEW actions: renameGroup · moveGroup · copyGroup · duplicateGroup  │   │
  │  │               reorderItems                                          │   │
  │  │  NEW state:   categoryItemOrder: Record<catKey, string[]>          │   │
  │  │  undo()/redo(): applyProjectSide(cmd) ─┐  then set() on            │   │
  │  │                                         │  pageMarkups + order      │   │
  │  └─────────────────────────────────────────┼──────────────────────────┘   │
  │        rename re-key / copy+dup new rate ▼  │  (cross-store, atomic)       │
  │  ┌──────────────── projectStore ──────────────────────────────────────┐   │
  │  │  rates: Record<`name|type`, PriceEntry>   hiddenItemNames[]         │   │
  │  │  NEW actions: reKeyRate · reKeyHidden · addBlankRate · removeRate   │   │
  │  └────────────────────────────────────────────────────────────────────┘   │
  │        │ pageMarkups / categories / categoryOrder / categoryItemOrder      │
  │        ▼         + rates + defaultMarkupPct                                 │
  │  ┌──────── aggregateBoq()  (boq-aggregator.ts — SINGLE source) ───────┐    │
  │  │  bucket (categoryId, `name|type`) ─▶ items ─▶ ORDER by             │    │
  │  │  categoryItemOrder[catKey]  (replaces localeCompare @ line 264)    │    │
  │  └───────────────┬───────────────────────────────┬────────────────────┘    │
  │        useBoqLive│(reactive)          useExport.ts│aggregateBoq() (imperative)│
  │        ▼         ▼                                 ▼                        │
  │  TotalsPanel   EstimatePanel                 window.api.writeBoq{Xlsx,Csv}  │
  │  (rows in order)(rows in order)                    │ (BoqStructure, ordered)│
  └────────────────────────────────────────────────────┼──────────────────────┘
                                                        ▼  IPC
  ┌─────────────────── MAIN ───────────────────────────────────────────────────┐
  │  boq-writers.ts: for (const item of cat.items)  ← iterates array order      │
  │  ⇒ xlsx + csv rows appear in the SAME manual order. NO writer change.        │
  └─────────────────────────────────────────────────────────────────────────────┘
```

Save/load: `snapshotProject()` reads `categoryItemOrder` from markupStore (like `categoryOrder`) → top-level additive `ProjectFileV2` field; `hydrateStores()` coerces it (untrusted disk) and feeds `markupStore.hydrate()`. No `formatVersion` bump, no `validateV2` branch.

### Recommended file touch-map (all EXTEND unless NEW)
```
src/renderer/src/
├── stores/markupStore.ts        # NEW state categoryItemOrder; 5 new actions; command union + undo/redo branches; hydrate/reset
├── stores/projectStore.ts       # NEW actions reKeyRate/reKeyHidden/addBlankRate/removeRate (each markDirty)
├── types/markup.ts              # MarkupCommand union += 5 command types
├── lib/boq-aggregator.ts        # consume categoryItemOrder; replace sort @ line 264
├── lib/project-serialize.ts     # snapshot + hydrate categoryItemOrder (coerce)
├── lib/project-schema.ts        # ProjectFileV2.categoryItemOrder?: Record<string,string[]>  (additive)
├── lib/group-ops.ts             # NEW: pure helpers — autoUniqueName(), snapshotGroup(), collision check
├── components/
│   ├── GroupContextMenu.tsx     # NEW: shared 4-item menu (+ optional "Copy as text" slot for totals)
│   ├── GroupCategoryDialog.tsx  # NEW: mode 'move'|'copy'; useDraggable + CategoryAutocomplete
│   ├── InlineRenameInput.tsx    # NEW: uncontrolled input + native listeners; collision message host
│   ├── RenameCollisionMessage.tsx # NEW: presentational (mirrors BlockedCommitMessage)
│   ├── DragReorderList (logic in *CategoryBlock) # insertion line + lifted row
│   ├── TotalsRow.tsx / EstimateRow.tsx           # grip handle, dbl-click rename, onContextMenu
│   ├── TotalsCategoryBlock.tsx / EstimateCategoryBlock.tsx # own the drag reorder + insertion line
│   └── TotalsPanel.tsx / EstimatePanel.tsx        # host context menu + Move/Copy dialog state
```

---

### Pattern 1: Within-category reorder = pointer-events, window-listener lifecycle (D-09/D-10)

**What:** Reuse the app's proven window-level pointer-drag idiom (NOT HTML5 native drag-and-drop, NOT a new library). `pointerdown` on the grip handle → `pointermove`/`pointerup` on `window` → compute the drop index from pointer-Y vs each sibling row's vertical midpoint → on `pointerup` dispatch one `reorderItems` command.

**Why this mechanism (verified precedents):**
- `Splitter.tsx:67-83` registers `pointermove`+`pointerup` on **`window`** (not the element) precisely because element-scoped listeners drop events when the cursor leaves the element during a fast drag; both listeners are removed atomically on `pointerup`. This is the exact lifecycle a scrolling reorder list needs.
- `useDraggable.ts:48-105` adds `setPointerCapture(e.pointerId)` on `pointerdown` and tracks via `window` `pointermove`/`pointerup`, degrading gracefully in jsdom. The grip handle can `setPointerCapture` too for robustness (optional — window listeners already catch everything).
- STATE.md locks "DOM event listeners for middle-mouse pan (avoids drag conflicts with Konva's built-in drag system)" and "Splitter registers pointermove+pointerup on window" — this is an established, deliberate house pattern.

**Drag ONLY from the grip (D-09):** put `onPointerDown` on the grip `<div>` only. The grip lives in the row's existing 16px left-padding gutter (UI-SPEC §4), so it does not reflow content and does not intercept the totals row's single-click cycle/arm or the Estimate row's editable cells (those cells already `stopPropagation` on click/mousedown — `EstimateRow.tsx:192,276,341`).

**Drop index from midpoints:** on each `pointermove`, read the category block's row elements (query by `data-testid="totals-row"` / `"estimate-row"` within the block, or hold refs) and compare `e.clientY` to each row's `getBoundingClientRect()` vertical midpoint to pick an insertion index. Render a 2px accent insertion-line `<div>` at that boundary and lift the grabbed row (`activeSurface`, `opacity 0.9`, shadow — UI-SPEC §4).

**Example (window-listener lifecycle, adapted from Splitter):**
```typescript
// Source: adapted from src/renderer/src/components/Splitter.tsx:59-83 (verified pattern)
function onGripPointerDown(e: React.PointerEvent, itemKey: string, catKey: string): void {
  e.preventDefault()
  e.stopPropagation()                    // never reach the row's click/cycle
  const rows = getRowRects()             // [{ key, top, bottom, mid }] for this category, in order
  const startOrder = rows.map(r => r.key)
  let dropIndex = startOrder.indexOf(itemKey)
  const onMove = (ev: PointerEvent): void => {
    dropIndex = computeDropIndex(ev.clientY, rows)   // vs each row midpoint
    setInsertionLineAt(dropIndex); setLiftedKey(itemKey)
    autoScrollIfNearEdge(ev.clientY)     // see Pitfall 5
  }
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)     // atomic cleanup (Splitter T-06-02-02)
    setInsertionLineAt(null); setLiftedKey(null)
    const newOrder = moveKey(startOrder, itemKey, dropIndex)
    if (!arraysEqual(newOrder, startOrder))
      useMarkupStore.getState().reorderItems(catKey, newOrder)   // ONE command
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
```

**Both surfaces:** identical handler in `TotalsCategoryBlock` and `EstimateCategoryBlock`. Extract the drag lifecycle into a shared hook (e.g. `useRowReorder(catKey, orderedKeys)`) so the two blocks share it.

**Anti-patterns to avoid:**
- **HTML5 `draggable`/`dragstart`:** no control over the drag ghost image, no clean insertion line, and native auto-scroll fights the app's own scroll containers. Rejected.
- **Element-scoped `pointermove`:** drops events on fast drags (Splitter's documented Pitfall 11). Use `window`.
- **A new drag-and-drop library:** forbidden (no new packages).

---

### Pattern 2: Persisted per-category order — `categoryItemOrder` in markupStore

**Field shape (recommended):**
```typescript
// markupStore state (NEW) + ProjectFileV2 top-level additive field (NEW)
categoryItemOrder: Record<string, string[]>
//                 ^ key: categoryId, or '__uncat__' for uncategorized (matches the aggregator's
//                   UNCAT_BUCKET_KEY, boq-aggregator.ts:19)
//                          ^ value: ordered list of `name|type` bucket keys (the exact key
//                            aggregator builds at boq-aggregator.ts:122 — `${name}|${type}`)
```

**Where it lives — markupStore, NOT projectStore (verified rationale):**
- `categoryOrder` already lives in **markupStore** (`markupStore.ts:11,149`), is serialized as a top-level `ProjectFileV2` field (`project-serialize.ts:59`), and hydrated via `markupStore.hydrate()` (`project-serialize.ts:98-102`). `categoryItemOrder` is a 1:1 structural sibling — copy that wiring.
- markupStore **has the command stack**; projectStore does not. Placing order here makes **reorder and move pure single-store commands** (no cross-store undo needed for them). Every operation already mutates markupStore (`pageMarkups` for rename/move/copy/dup; `categoryItemOrder` for reorder), so **all five ops auto-`markDirty`** via the existing subscription once `categoryItemOrder` is added to it (`projectStore.ts:174` `attachDirtyTracking` selector tuple `[pageMarkups, categories, categoryOrder]` → add `categoryItemOrder`).

**Why the value is `name|type`, not the label:** the aggregator buckets by `${name}|${type}` (`boq-aggregator.ts:122`); the row `label` can gain a `(count)`/`(linear)` disambiguation suffix (`boq-aggregator.ts:225`) that changes when a same-name collision appears/disappears — so the label is unstable as an order key. The `name|type` bucket key is stable and is exactly what the aggregator iterates. (Two markups sharing a name but differing in category produce the same `name|type` in **different** category buckets — fine, because the order map is keyed per-category.)

**Additive persistence (copy this precedent verbatim):** `defaultMarkupPct?`, `rates?`, `hiddenItemNames?` are all optional `ProjectFileV2` fields with **no `validateV2` branch** — they ride the trailing `return raw as ProjectFileV2` cast (`project-schema.ts:99-108,113-140`), emitted explicitly in `snapshotProject` (`project-serialize.ts:62-64`) and defensively coerced in `hydrateStores` (`project-serialize.ts:128-171`). `categoryItemOrder?: Record<string,string[]>` is added the same way:
- **Snapshot:** `categoryItemOrder: useMarkupStore.getState().categoryItemOrder` (read from markupStore, like `categoryOrder`).
- **Hydrate coercion (untrusted disk — feeds the aggregator):** accept only an object whose values are arrays of strings; drop anything else; default `{}` when absent. Old files (no field) → `{}` → placement order, no error. Pass the coerced object into `markupStore.hydrate({ ..., categoryItemOrder })`.
- **NO `formatVersion` bump**, **no `validateV2` branch** — mirrors `arcs`/`rates`/`hiddenItemNames`/`categoryOrder`.

**Degrade + append semantics (satisfies Req 2 acceptance):**
- Old file / never-reordered category → `categoryItemOrder[catKey]` absent → aggregator leaves items in **placement order** (bucket insertion order), not alphabetical.
- Newly-added item (not in the order array) → sorts **after** ordered items in placement order (see § Pattern 4 stable-sort).

---

### Pattern 3: Cross-store atomic undo — extend `MarkupCommand`, apply projectStore side in `undo()/redo()`

**The core challenge:** `markupStore.undo()/redo()` are today single `set((s) => {...})` reducers over `pageMarkups` only; they never touch projectStore (`markupStore.ts:471-767`). projectStore mutations (`setPrice`, `toggleHiddenItem`) `markDirty` directly and are **not** on the undo stack (`projectStore.ts:137-143`). Rename (re-key `rates`+`hidden`) and copy/duplicate (new rate entry) touch **both** stores and must revert together on one Ctrl+Z.

**Recommended design (Option C — payload on the command; markupStore orchestrates):**

1. **Extend the `MarkupCommand` union** (`types/markup.ts:76`) with five self-describing command types. `recolor-group` (`markupStore.ts:230-266`, `types/markup.ts:80-87`) is the closest analog — it stores per-markup old-state (`oldColors`) + `markupIdsAffected`. Mirror that discipline:

```typescript
// types/markup.ts — MarkupCommand union additions
| { type: 'rename-group'
    oldName: string; newName: string
    markupIdsAffected: string[]                                  // ids whose .name flips (mirror recolor-group)
    rateReKeys: Array<{ oldKey: string; newKey: string; entry: PriceEntry }>   // `name|type`
    hiddenReKeys: Array<{ oldKey: string; newKey: string }>      // `name|categoryId` composites (Pitfall 1)
    orderReKeys: Array<{ catKey: string; oldItemKey: string; newItemKey: string }> }
| { type: 'move-group'
    markupIdsAffected: string[]
    oldCategoryId: string | null; newCategoryId: string | null
    orderRemove: Array<{ catKey: string; itemKey: string; index: number }>     // from source order
    orderAppend: Array<{ catKey: string; itemKey: string }> }                  // to target order
| { type: 'copy-group'
    newMarkups: Markup[]                                         // full snapshots (mirror delete-group.markups)
    rateKey: string; rateEntry: PriceEntry
    orderAppend: { catKey: string; itemKey: string } }
| { type: 'duplicate-group'; /* identical shape to copy-group */ }
| { type: 'reorder-items'; catKey: string; oldOrder: string[]; newOrder: string[] }
```

2. **Refactor `undo()` and `redo()`** from `undo: () => set((s)=>{...})` to an action body that applies the projectStore side **before** the markup `set()` (both synchronous → one Ctrl+Z reverts both; React 19 batches):

```typescript
undo: () => {
  const cmd = get().undoStack.at(-1)
  if (!cmd) return
  applyProjectUndo(cmd)          // side-effect: projectStore actions for rename/copy/dup; no-op otherwise
  set((s) => { /* existing branch chain + new branches on pageMarkups & categoryItemOrder */ })
}
```
`applyProjectUndo(cmd)` switches on `cmd.type`:
- `rename-group` → for each `rateReKeys`: `removeRate(newKey)` + `setRateEntry(oldKey, entry)`; for each `hiddenReKeys`: swap `newKey`→`oldKey` in `hiddenItemNames` if present. (order re-key is markupStore-side, in the `set()`.)
- `copy-group`/`duplicate-group` → `removeRate(rateKey)`.
- `move-group`/`reorder-items`/all legacy → no-op.
`applyProjectRedo(cmd)` is the mirror (rename → apply new keys; copy/dup → re-add `rateEntry`).

3. **markupStore `set()` branch** handles the markup + order side for each new command (flip `.name` on `markupIdsAffected`; reassign `categoryId`; add/remove `newMarkups`; re-key/append/remove/swap `categoryItemOrder`). This mirrors the existing `delete-group` (add/remove `markups`) and `recolor-group` (per-id state) branches exactly.

**Dirty tracking is automatic:** every op mutates markupStore `pageMarkups` (rename flips names, move flips categoryId, copy/dup add markups) or `categoryItemOrder` (reorder) → the `attachDirtyTracking` subscription fires `markDirty` (`projectStore.ts:173-177`, extend its selector tuple with `categoryItemOrder`). So even though `applyProjectUndo` may write `rates` via `setState`, the co-occurring markup change guarantees the project is marked dirty. **No operation changes projectStore in isolation** (verified: rename→names, move→categoryId, copy/dup→markups, reorder→order all change markupStore).

**Forward path (the action, not undo):** e.g. `renameGroup(oldName, newName)`:
1. Collision check (§ Pitfall 2). If blocked → return a sentinel (`{ ok:false }`), **no store writes**; UI shows the message.
2. Compute `markupIdsAffected`, `rateReKeys` (per type actually present in `rates`), `hiddenReKeys` (per `name|categoryId` present in `hiddenItemNames`), `orderReKeys` (per category order array containing `oldName|type`).
3. Apply projectStore side via dedicated actions (`reKeyRate`, `reKeyHidden` — each `markDirty`).
4. `set()` markupStore: flip names + re-key order + push the `rename-group` command + clear redo.

**Why not the alternatives (CONTEXT options a/b):** (a) a full projectStore before/after snapshot is heavy and duplicates state; (b) an undo-context callback registry adds a parallel indirection foreign to this codebase. Option C keeps the **single command = single undo unit** contract, matches `recolor-group`/`delete-group` exactly, and confines the projectStore coupling to two small helper functions.

---

### Pattern 4: How `aggregateBoq` consumes the manual order (replace the sort at line 264)

**Verified current code** (`boq-aggregator.ts`): items are built from `bucket.entries()` — a `Map` whose insertion order is placement order (page 1..N, markup order within page) — then **overwritten** by an alphabetical sort:
```typescript
// boq-aggregator.ts:263-264 (VERIFIED — exact)
// 2c. Alphabetical sort by post-suffix label (Claude's discretion confirmed)
items.sort((a, b) => a.label.localeCompare(b.label))
```

**Replacement (sort the bucket ENTRIES by manual-order rank; stable sort preserves placement order for unranked):**
```typescript
// Read the order the same way categoryOrder is read (getState default; injectable via opts for tests)
const categoryItemOrder = opts.categoryItemOrder ?? useMarkupStore.getState().categoryItemOrder
// ... inside the per-category loop, BEFORE building items:
const order = categoryItemOrder[catKey] ?? []          // catKey is categoryId or '__uncat__'
const rank = new Map(order.map((k, i) => [k, i]))
const entries = [...bucket.entries()]                  // [ `name|type`, acc ] in placement order
entries.sort((a, b) => (rank.get(a[0]) ?? Infinity) - (rank.get(b[0]) ?? Infinity))
//   JS Array.sort is stable (ES2019+, V8/Node 22) → equal ranks (both Infinity = unranked/new)
//   keep placement order → newly-added items append after ordered ones. [VERIFIED: ES2019 spec]
for (const [k, acc] of entries) { /* build BoqItemRow as today */ }
// DELETE the `items.sort(localeCompare)` at line 264.
```
- `catKey` is already in scope in the loop (`boq-aggregator.ts:198` `for (const catKey of orderedCatKeys)`), and it is exactly the order-map key (categoryId or `UNCAT_BUCKET_KEY`).
- `k` (`name|type`) is exactly the order-array element — no `labelToName` round-trip needed.
- Add `categoryItemOrder?: Record<string,string[]>` to `AggregateOptions` (`boq-types.ts:136`) for test injection, defaulting to `useMarkupStore.getState().categoryItemOrder` (mirrors `categoryOrder`, `boq-aggregator.ts:91`).
- Thread it through **`useBoqLive`** (`useBoqLive.ts`): add `categoryItemOrder` as a **top-level primitive selector AND a `useMemo` dependency** (mirror the `rates`/`categoryOrder` pair at `useBoqLive.ts:37,43,64`) so a reorder recomputes live. Omitting the dep leaves rows stale after a drag.

**Propagation to all three surfaces (verified single-point change):**
- **Totals panel + Estimate sheet:** both render `boq.categories[].items.map(...)` in array order (`TotalsCategoryBlock.tsx:112`, `EstimateCategoryBlock.tsx:85`) via `useBoqLive`. Reorder → new `items` order → re-render.
- **xlsx/csv export:** `useExport.ts:79` calls `aggregateBoq()` in the **renderer**, then ships the finished `BoqStructure` via `window.api.writeBoq{Xlsx,Csv}(filePath, structure)` (`useExport.ts:57-58`). The main-process writers iterate `for (const item of cat.items)` (`boq-writers.ts:234`, `:424`) in array order. **The order is baked in before IPC → zero writer, preload, or IPC change.** (This corrects the CONTEXT/PATTERNS assumption that the writers might need work.)

**Test-safety (verified):** the existing aggregator/live tests are order-agnostic — they normalize with `.map(i => i.label).sort()` before asserting (`boq-aggregator.test.ts:150,169,265`; `use-boq-live.test.ts:118`). So replacing the sort will **not** break them. Wave 0 must add **new** tests that assert positional order.

---

### Pattern 5: Supporting engines

**5a — Auto-name uniqueness generator (Copy/Duplicate, D-07/D-08):**
```typescript
// group-ops.ts (NEW pure helper)
// base = source name with any trailing " (n)" stripped ("Slab (2)" → "Slab"); n starts at 2.
// free ⇔ NO existing markup has (name === candidate) with a type in the source group's type set
//        (else the aggregator bucket merges — SPEC constraint). "first free" = smallest n≥2.
function autoUniqueName(base: string, sourceTypes: Set<MarkupType>, allMarkups: Markup[]): string {
  const taken = new Set(allMarkups.filter(m => sourceTypes.has(m.type)).map(m => m.name))
  for (let n = 2; ; n++) { const c = `${base} (${n})`; if (!taken.has(c)) return c }
}
```
Contrast with `nextCountSequence` (`markupStore.ts:168-173`, max+1 gap-preserving) — that is for count *sequence* numbers, not names; the name generator is **first-free**, not max+1 (SPEC: "picks the first free").

**5b — Rename re-key correctness (Req 1 / D-03 — CORRECTED for the real key shapes):**
- **`rates`** — key is `name|type`, **category-independent** (`EstimateRow.tsx:104`, aggregator `:236`). Re-key `${old}|${T}` → `${new}|${T}` **for each type T present** in the group (a group can be count+linear). Only re-key types that actually have a `rates` entry.
- **`hiddenItemNames`** — key is the **composite `${name}|${categoryId}`**, NOT the bare name (`TotalsRow.tsx:125-128,247`; `toggleHiddenItem(itemKey)` receives the composite). **Correction to SPEC Req 1 / D-03 "hiddenItemNames (old→new)":** re-key `${old}|${catId}` → `${new}|${catId}` **for each categoryId** where a hidden entry exists (a group spanning categories has multiple hidden entries). Rebuild `hiddenItemSet` after (`projectStore.ts:128`).
- **`categoryItemOrder`** — re-key `${old}|${T}` → `${new}|${T}` in every category order array that contains it.
- **color** follows automatically — `getColorForName(newName)` reads the most-recent markup with that name (`markupStore.ts:457-469`); after the names flip, the renamed markups carry their color, so the row color is unchanged.

**5c — Independent-snapshot creation (Copy/Duplicate, D-07/D-08):**
For each source markup, build a new markup: `id = crypto.randomUUID()`; same `page`; **deep-clone** `point`/`points`/`arcs` (new object/array identities so later edits to the source don't touch the copy — SPEC "independent"); `name = autoUniqueName(...)`; `categoryId` = target (Copy, via `getOrCreateCategory(targetName).id`) or source `categoryId` (Duplicate); `color` = source color (visually identical snapshot — **[ASSUMED]**, flag A3); `createdAt = Date.now()`; **count markups:** assign fresh `sequence` per page under the new name (1,2,3… — the new name has no existing counts, so a simple per-page counter is clean). Rate: one **blank** `PriceEntry` `{ material: 0, labor: 0, markup: defaultMarkupPct }` at key `${newName}|${T}` per type (via `addBlankRate`). Order: append `${newName}|${T}` to the category's `categoryItemOrder`.

**5d — Inline-rename input (D-02/D-03):** reuse the `EstimateRow` recipe verbatim (`EstimateRow.tsx:184-247`): **uncontrolled** `<input defaultValue>`, **native** `blur`+`keydown(Enter)` commit listeners via a ref (NOT React `onChange`/`onBlur` — React 19's value-tracker suppresses synthetic `onChange` after a programmatic `.value` set, and delegates blur as `focusout`), seed guarded on `document.activeElement !== el` (never clobber mid-typing), `stopPropagation` on click/mousedown/keydown so the input never triggers row cycle/arm. Esc cancels; blank/whitespace → cancel silently (D-03). On commit, call `renameGroup`; if it returns "blocked", keep the input open and show `RenameCollisionMessage` (D-04). **Totals dbl-click guard:** add `onDoubleClick` to open the editor and, in the row's existing `handleClick` (`TotalsRow.tsx:158`), early-return when `e.detail === 2` so the second click of a double-click doesn't cycle (perceived-performance is load-bearing per MEMORY).

**5e — Move/Copy category dialog (D-05):** new `GroupCategoryDialog` (`mode: 'move'|'copy'`) copying `DefaultMarkupChangeModal` chrome (`DefaultMarkupChangeModal.tsx:61-167`: backdrop `inset:0 rgba(0,0,0,0.5) zIndex:120`, dialog `width:420 padding:20`, `useDraggable`, ESC=Cancel/Enter=Confirm, backdrop-mousedown=Cancel, confirm auto-focus) with a `CategoryAutocomplete` (`CategoryAutocomplete.tsx`) beneath a name input — reuse `MarkupNamePopup`'s `handleCategoryKeyDown` arrow-nav + the `Enter` `stopPropagation` guard (`MarkupNamePopup.tsx:140-171`) so Enter selects a highlighted category instead of confirming the dialog. Copy mode shows the auto-name preview line (D-07).

### Anti-Patterns to Avoid
- **Re-keying `hiddenItemNames` as bare `old→new`.** The stored key is `name|categoryId`. Bare-name re-key silently loses the hide-state and can collide. (Pitfall 1.)
- **Changing the boq-writers / preload / IPC for ordering.** The order is inside the already-transmitted `BoqStructure`. Touching the writers is wasted work and risks regressing the Phase-16 4-way type lock.
- **Reading the order via a fresh object/array selector in `useBoqLive`.** Returning a new identity per render loops React (`TotalsPanel.tsx:71-74` `EMPTY_MARKUPS` note). Select the stored `categoryItemOrder` reference directly.
- **Two same-name+type groups in one category.** They bucket-merge (double quantity). This is *why* collision blocks (D-04) and *why* copy/duplicate auto-name — never create one.
- **Committing rename per-keystroke** or via React `onChange`. Use the deferred native blur/Enter commit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag lifecycle across a scrolling list | Custom mouse-move state machine on the element | `Splitter`/`useDraggable` **window** `pointermove`/`pointerup` pattern | Element listeners drop events on fast drags; window + atomic cleanup is proven (STATE.md, Splitter T-06-02-02) |
| Reorder drag-and-drop | `@dnd-kit` / `react-dnd` / HTML5 DnD | pointer-events + insertion line | No new packages; HTML5 DnD has poor ghost/scroll control |
| Inline text edit committing to a store | React `onChange`/`onBlur` controlled input | uncontrolled + native `blur`/`keydown` listeners (`EstimateRow.tsx:184-247`) | React 19 value-tracker suppresses synthetic `onChange` after programmatic `.value`; blur arrives as `focusout` |
| Modal (Move/Copy) | New modal from scratch | `DefaultMarkupChangeModal` chrome + `useDraggable` | Centered/draggable/ESC/Enter/backdrop all solved + token-consistent |
| Category type-ahead (existing-or-new) | New autocomplete | `CategoryAutocomplete` + `getOrCreateCategory` | `onMouseDown`+`preventDefault` keep-open + arrow-nav already handled |
| Context menu at cursor | New menu | `TotalsRowContextMenu` recipe | Deferred-listener registration + outside-click/Escape dismissal solved |
| Order persistence in `.clmc` | New serialize path / `formatVersion` bump | Additive optional field riding `return raw as ProjectFileV2` (like `rates`) | Old files load with `{}` default; round-trips with no version bump |
| Applying manual order to all 3 surfaces | Sort in each surface / in the writers | Replace the ONE sort in `aggregateBoq` | Single source of truth; writers inherit via `BoqStructure` |
| Whole-group multi-page undoable command | New undo stack | Extend `MarkupCommand` union + `recolor-group`-style per-id payload | Preserves single-Ctrl+Z + 50-cap discipline |

**Key insight:** This phase has an unusually high analog-reuse ratio. The riskiest genuinely-new logic is (1) the cross-store payload in `undo()/redo()` and (2) the re-key correctness across three keyed structures with two different key shapes (`name|type` vs `name|categoryId`). Everything else is a copy-with-adaptation of a verified precedent.

## Runtime State Inventory

This is a data-model + persistence phase (new `.clmc` field, re-keying of persisted maps), so the inventory matters — but the app is a **single-file, offline desktop app with no external services or OS-registered state**.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (in the `.clmc`) | (1) NEW `categoryItemOrder` field. (2) `rates` keyed by `name\|type` — **rename must migrate live keys** (re-key, in-session; persisted on next Save). (3) `hiddenItemNames` keyed by `name\|categoryId` — rename must re-key. (4) `Markup.name` on every page. | Code edits (re-key logic) + additive serialize/hydrate. No offline batch migration — the `.clmc` is rewritten wholesale on Save; old files load with `categoryItemOrder` absent → `{}`. |
| Live service config | None — fully offline desktop app; no databases, no external services (CLAUDE.md "Offline: must work fully offline"). | None — verified by CLAUDE.md constraints + no network code in the read paths. |
| OS-registered state | None — no Task Scheduler / services / registry keys involved. | None — verified: this is renderer/main JS only. |
| Secrets / env vars | None referenced by this phase. | None. |
| Build artifacts / installed packages | None — no new package, no native addon, no codegen. `npm install` adds nothing. | None. |

**The canonical question — "after every file in the repo is updated, what runtime systems still hold the old string?"** Within a single open project: after a rename, the in-memory `rates`/`hiddenItemNames`/`categoryItemOrder` maps and every `Markup.name` are re-keyed by the rename command; nothing else stores the name. Across files on disk: an old `.clmc` opened later simply has the old names (no migration needed — it never saw the rename). **No orphaned runtime state exists** because the app has no external stores and the `.clmc` is rewritten in full on Save.

## Common Pitfalls

### Pitfall 1: The visibility key is `name|categoryId`, not the bare name
**What goes wrong:** Following the SPEC/D-03 shorthand "re-key `hiddenItemNames` (old→new)" literally loses hide-state on rename, because entries are stored as `${name}|${categoryId}` composites (`TotalsRow.tsx:125-128`, passed to `toggleHiddenItem` at `:247`).
**Why it happens:** SPEC Req 1 and D-03 describe the hidden re-key as name-only; the code uses a composite key (a Phase-8 name-collision fix).
**How to avoid:** Re-key `${old}|${catId}` → `${new}|${catId}` for **every** categoryId where a hidden entry exists; rebuild `hiddenItemSet`. Capture the exact swaps on the command for undo.
**Warning signs:** A hidden group reappears after rename+undo; hide-state "jumps" to a wrong category.

### Pitfall 2: Collision definition must be type-scoped and group-exclusive
**What goes wrong:** An over-broad or under-broad collision check either blocks legitimate renames or allows a bucket-merge (double quantity).
**Why it happens:** The rate key is `name|type` (category-independent) but a group can span categories and hold multiple types; "already exists" is ambiguous.
**How to avoid (recommended, flag for confirmation — A1):** **Block iff ∃ a markup NOT in the rename set with `name === newName` and `type ∈ {types present in the rename set}`.** Type-scoped (D-04 "of the same type"); category-independent (matches the shared rate key); group-exclusive (the group's own markups don't self-collide). This is the precise condition under which the rename would make two same-`(name,type)` groups indistinguishable.
**Warning signs:** Renaming into a name that exists only under a *different* type is wrongly blocked; or a rename silently doubles a quantity.

### Pitfall 3: A group can span multiple categories
**What goes wrong:** Rename/undo logic that assumes one category per group corrupts the re-key when a group's markups have different `categoryId`s (possible via per-markup `editMarkup` category change).
**Why it happens:** A "group" is by `.name` only; `categoryId` is per-markup.
**How to avoid:** Rename re-keys hidden + order across **all** categories the group touches. Move collapses the span to one category (reassigns every markup). Capture all affected (catKey,index) pairs on the command.
**Warning signs:** After rename, a row survives under one category but the hide-toggle/order is wrong under another.

### Pitfall 4: `useMemo`/selector dependency omission leaves rows stale
**What goes wrong:** Reorder persists but the panel doesn't re-render (or export uses a stale order).
**Why it happens:** `useBoqLive` recomputes only when a listed dependency identity changes (`useBoqLive.ts:64`). If `categoryItemOrder` is passed to `aggregateBoq` but not added as a selector + dep, the memo won't re-run.
**How to avoid:** Add `categoryItemOrder` as a top-level primitive selector **and** a `useMemo` dep (mirror `rates`/`categoryOrder`). Same lesson the WR-01 `defaultMarkup` dep documents (`useBoqLive.ts:44-47,64`).
**Warning signs:** Drag reorders on screen (local drag state) but reverts on drop; export order differs from screen.

### Pitfall 5: Auto-scroll + fast-drag event loss during reorder
**What goes wrong:** Dragging near the top/bottom of a scrollable category list doesn't scroll, or the drop index is wrong when the list scrolls mid-drag.
**Why it happens:** Row rects are read once; the scroll container moves them.
**How to avoid:** Recompute row rects (or read `getBoundingClientRect` live) on each `pointermove`; when `clientY` is within ~24px of the scroll container edge, scroll it by a small delta per frame. Keep listeners on `window` (Splitter pattern) so events don't drop when the cursor leaves a row.
**Warning signs:** Drop lands one row off after the list scrolls; can't reorder past the visible viewport.

### Pitfall 6: Count-markup `sequence` collisions on copy/duplicate
**What goes wrong:** Copied count markups carry the source's `sequence`, producing duplicate pin numbers under the new name.
**Why it happens:** `CountMarkup.sequence` is per (page, name) (`markupStore.ts:168-173`); a naive clone copies it.
**How to avoid:** Assign fresh sequences per page under the new (unique) name — since the new name has no existing counts, a simple 1..k per page is correct.
**Warning signs:** Two pins labelled the same number in the copied group.

## Code Examples

### Additive `.clmc` field — the exact precedent to copy (schema)
```typescript
// Source: src/renderer/src/lib/project-schema.ts:99-108 (VERIFIED — rates/defaultMarkupPct precedent)
//   Add a sibling optional field; NO validateV2 branch, NO formatVersion bump.
/** Additive in Phase 17 — absent in pre-Phase-17 files; defaults to {} on load.
 *  Per-category manual item order: categoryId (or '__uncat__') → ordered `name|type` keys.
 *  Rides the trailing `return raw as ProjectFileV2` cast like rates/hiddenItemNames. */
categoryItemOrder?: Record<string, string[]>
```

### Snapshot + hydrate (serialize) — mirror categoryOrder + rates coercion
```typescript
// Source: src/renderer/src/lib/project-serialize.ts:59-64 + :128-171 (VERIFIED patterns)
// snapshot (read from markupStore, like categoryOrder):
categoryItemOrder: useMarkupStore.getState().categoryItemOrder,
// hydrate coercion (untrusted disk — feeds the aggregator):
const raw = (data as { categoryItemOrder?: unknown }).categoryItemOrder
const safeOrder: Record<string, string[]> = {}
if (raw && typeof raw === 'object') {
  for (const [k, v] of Object.entries(raw as Record<string, unknown>))
    if (Array.isArray(v)) safeOrder[k] = v.filter((x): x is string => typeof x === 'string')
}
// pass into markupStore.hydrate({ pageMarkups, categories, categoryOrder, categoryItemOrder: safeOrder })
```

### Whole-group command with per-id payload — the analog to mirror
```typescript
// Source: src/renderer/src/stores/markupStore.ts:230-266 (recolorGroup — VERIFIED)
//   recolorGroup scans by name, records per-id old state (oldColors) + markupIdsAffected,
//   pushes ONE command, clears redoStack. rename-group/move-group mirror this exactly,
//   adding the projectStore-side payload consumed by applyProjectUndo/Redo.
```

## State of the Art

Brownfield — the "state of the art" is the existing house patterns, which are current and internally consistent. One change of approach is intrinsic to this phase:

| Old Approach | Current (this phase) | When | Impact |
|--------------|----------------------|------|--------|
| Alphabetical row order (`localeCompare`, boq-aggregator.ts:264) | Persisted per-category **manual** order; placement order by default | Phase 17 | Rows in totals/estimate/export follow user drag; new items append (not alpha-sorted) |
| Single-markup edit only (`editMarkup`) | Whole-group rename/move/copy/duplicate commands | Phase 17 | Generalizes `recolor-group` to name + category + snapshot ops |
| projectStore mutations off the undo stack | Cross-store atomic undo via command payload | Phase 17 | One Ctrl+Z reverts markupStore + projectStore together |

**Deprecated/outdated (do not reintroduce):** the merge-on-rename dialog (superseded by D-04 block); the assumption that boq-aggregator lives in `src/main/` (it is renderer); the shorthand that hidden re-key is bare-name (it is `name|categoryId`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Collision = ∃ markup outside the rename set with `name===newName` && `type ∈ sourceTypes` (type-scoped, category-independent, group-exclusive) | Pitfall 2 | Wrong scope either blocks valid renames or permits a bucket-merge (silent quantity doubling). **Confirm with user/discuss-phase.** |
| A2 | Copy/Duplicate carry the **source color** into the snapshot (visually identical) | Pattern 5c | If user expects a fresh/next-palette color, the copy looks wrong until recolored. Low risk; easy to flip. |
| A3 | Auto-name strips a trailing " (n)" from the source before generating (`"Slab (2)"` duplicate → `"Slab (3)"`, not `"Slab (2) (2)"`) | Pattern 5a | Cosmetic; nested suffixes if wrong. Confirm the base-extraction preference. |
| A4 | `categoryItemOrder` lives in **markupStore** (not projectStore as CONTEXT §code_context implies) | Pattern 2 | If the planner insists on projectStore, reorder+move need cross-store undo too (more machinery). Recommendation stands; flag the divergence from CONTEXT wording. |
| A5 | Move **explicitly** appends the moved key to the target's `categoryItemOrder` (rather than relying on placement order) | Pattern 3 | Without it, a moved group's position in the target is its creation-order position, not "last" (D-06 says "appended"). Recommendation: explicit append. |
| A6 | `GripVertical` resolves from the installed `lucide-react@1.6.0` | Standard Stack | Import fails → pick another lucide glyph. Trivial Wave-0 check. |

**Note on CONTEXT divergence (A4):** CONTEXT §code_context lists "projectStore — … the new per-category order field". This research recommends **markupStore** instead, because it makes reorder+move single-store commands and mirrors `categoryOrder` (already in markupStore). This is within the explicitly-granted research discretion ("Persisted-order field shape … planner/research decisions"). The planner should adopt markupStore unless a contrary constraint surfaces.

## Open Questions (RESOLVED)

1. **Collision scope (A1) — confirm before implementing.**
   - What we know: D-04 says "already exists on another group of the same type"; rate key is `name|type` category-independent.
   - What's unclear: whether "another group" is category-scoped or global (a group can span categories).
   - Recommendation: global + type-scoped + group-exclusive (Pitfall 2). Verify in discuss-phase or the plan.
   - RESOLVED: adopted by 17-02 — the pure `collisionExists(newName, renameSetIds, sourceTypes, allMarkups)` helper in `group-ops.ts` implements global + type-scoped + group-exclusive; `renameGroup` blocks with zero store writes.

2. **Reorder React `key` stability during drag.**
   - What we know: blocks render rows with `key={item.label}` (`TotalsCategoryBlock.tsx:117`, `EstimateCategoryBlock.tsx:86`); labels are stable per `name|type` but can gain/lose a `(type)` suffix on collision.
   - What's unclear: whether label-as-key causes a remount flicker when a reorder changes a neighbor's collision state (rare).
   - Recommendation: key by the stable `name|type` bucket key during this phase's row rendering if flicker is observed; otherwise leave as-is (low risk — reorder doesn't change collision state).
   - RESOLVED: handled by 17-06/17-07 Task 2 — category blocks may key rows by the stable `name|type` bucket key if a collision-suffix flicker appears; otherwise left as-is (low risk).

3. **Where to host the Move/Copy dialog + collision state.**
   - What we know: `TotalsPanel` already hosts `TotalsRowContextMenu` via local state (`TotalsPanel.tsx:85-89,269-283`); `EstimatePanel` hosts none today.
   - Recommendation: each panel hosts its own `GroupContextMenu` + `GroupCategoryDialog` state (mirror TotalsPanel); the dialog/menu components are shared. No global store needed.
   - RESOLVED: adopted by 17-06/17-07 Task 3 — each panel hosts its own `GroupCategoryDialog` + context-menu + rename state via local `useState` (mirror TotalsPanel); the shared menu/dialog components carry no global store.

## Validation Architecture

`workflow.nyquist_validation` is `true` (`.planning/config.json`). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (`environment: 'node'`, `globals: true`, `include: ['src/tests/**/*.test.ts']`, alias `@renderer → src/renderer/src`) |
| Quick run command | `npx vitest run src/tests/<file>.test.ts` (no `test` npm script exists — invoke vitest directly) |
| Full suite command | `npx vitest run` |
| Typecheck gate | `npm run typecheck` (node + web projects) |

**Testing notes (verified conventions):** pure logic (aggregator, group-ops, re-key) tests are Node-env and inject fixtures via `opts` — no DOM (`boq-aggregator.test.ts`). Component/render tests install an in-memory `localStorage` polyfill per-file and use `React.createElement` in `.test.ts` files (STATE.md — `include` glob is `.test.ts`; do NOT change `vitest.config.ts` mid-wave). Store tests call `useMarkupStore.getState()` / `useProjectStore.getState()` directly.

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| Req 2 | Aggregator emits items in `categoryItemOrder`; unranked append in placement order; absent order → placement (not alpha) | unit | `npx vitest run src/tests/boq-aggregator-order.test.ts` | ❌ Wave 0 |
| Req 2 | `useBoqLive` recomputes when `categoryItemOrder` changes | unit | `npx vitest run src/tests/use-boq-live-order.test.ts` | ❌ Wave 0 |
| Req 2 | `categoryItemOrder` round-trips snapshot→validateV2→hydrate; old file (absent) → `{}`; no formatVersion bump | unit | `npx vitest run src/tests/project-order-roundtrip.test.ts` | ❌ Wave 0 |
| Req 2 | Export writers preserve item array order (xlsx + csv) | unit | `npx vitest run src/tests/boq-writers-order.test.ts` | ❌ Wave 0 (extend existing writer tests) |
| Req 1 | `renameGroup` flips names all pages + re-keys `rates` (`old\|T`→`new\|T`) + `hiddenItemNames` (`old\|catId`→`new\|catId`) + order; ONE Ctrl+Z reverts all | unit | `npx vitest run src/tests/rename-group-command.test.ts` | ❌ Wave 0 |
| Req 1 | Rename collision (same type, outside group) → blocked, no store writes | unit | `npx vitest run src/tests/rename-group-collision.test.ts` | ❌ Wave 0 |
| Req 3 | `moveGroup` reassigns categoryId all markups, appends to target order, unchanged rate; undo restores category + order | unit | `npx vitest run src/tests/move-group-command.test.ts` | ❌ Wave 0 |
| Req 4/5 | `copyGroup`/`duplicateGroup` create independent snapshots (new ids, deep-cloned geometry), auto-unique name, blank rate; undo removes markups + rate entry | unit | `npx vitest run src/tests/copy-duplicate-group.test.ts` | ❌ Wave 0 |
| Req 4/5 | `autoUniqueName` picks first-free "(n)" not colliding with same-type names | unit | `npx vitest run src/tests/group-ops-autoname.test.ts` | ❌ Wave 0 |
| Req 1/4/5 | Cross-store undo atomicity: after undo, both `useMarkupStore` and `useProjectStore` match pre-op state | unit | `npx vitest run src/tests/group-undo-atomic.test.ts` | ❌ Wave 0 |
| Req 2 (UI) | Grip pointer-drag computes drop index + dispatches one `reorderItems`; drag only from grip | render | `npx vitest run src/tests/row-reorder-drag.test.ts` | ❌ Wave 0 |
| Req 1 (UI) | Inline rename: Enter commits, Esc cancels, blank cancels, totals dbl-click `e.detail===2` guard doesn't cycle | render | `npx vitest run src/tests/inline-rename-input.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the specific new test file for that task (`npx vitest run src/tests/<file>.test.ts`) + `npm run typecheck`.
- **Per wave merge:** `npx vitest run` (full suite — the phase touches the shared aggregator + stores; run everything).
- **Phase gate:** full suite green + `npm run typecheck` clean + `npm run build` clean before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/tests/boq-aggregator-order.test.ts` — Req 2 aggregator order (inject `categoryItemOrder` opt; assert positional order; unranked append; absent→placement).
- [ ] `src/tests/rename-group-command.test.ts` + `rename-group-collision.test.ts` — Req 1 (three-key re-key + block).
- [ ] `src/tests/move-group-command.test.ts` — Req 3.
- [ ] `src/tests/copy-duplicate-group.test.ts` + `group-ops-autoname.test.ts` — Req 4/5.
- [ ] `src/tests/group-undo-atomic.test.ts` — cross-store one-Ctrl+Z atomicity (the highest-risk logic).
- [ ] `src/tests/project-order-roundtrip.test.ts` — additive persistence + old-file degrade + no formatVersion bump.
- [ ] `src/tests/use-boq-live-order.test.ts`, `row-reorder-drag.test.ts`, `inline-rename-input.test.ts` — live recompute + UI.
- [ ] Confirm no existing test asserts alphabetical positional order (verified: `boq-aggregator.test.ts:150/169/265` + `use-boq-live.test.ts:118` all normalize with `.sort()` → safe). Extend `boq-writers-*.test.ts` with an order-preservation assertion.
- [ ] Framework install: none — Vitest already present.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled per convention). This is an **offline, single-user Windows desktop app** with no auth, sessions, network, or crypto. Only two ASVS categories are materially in scope, and both are already mitigated in code the phase extends.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (existing, extend it) |
|---------------|---------|----------------------------------------|
| V2 Authentication | no | No accounts — local desktop app |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single local user; file access via Electron dialog only |
| V5 Input Validation | **yes** | **Untrusted `.clmc` hydrate coercion** — the new `categoryItemOrder` is deserialized from a user-supplied file that feeds the aggregator. Coerce like `rates` (`project-serialize.ts:128-149`): accept only `Record<string,string[]>`, drop non-string/non-array, default `{}`. Never throw. |
| V6 Cryptography | no | None — no secrets, no hashing beyond the existing PDF sha256 (unchanged) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation (verified present) |
|---------|--------|----------------------------------------|
| Crafted `.clmc` with malformed `categoryItemOrder` (non-array values, huge arrays, injected keys) | Tampering / DoS | Per-field hydrate coercion (V5 above); the order only reorders existing buckets — an unknown key is inert (aggregator ignores keys with no matching bucket) |
| CSV/formula injection via a renamed group name reaching the export | Tampering | Existing `safeText()` guard prefixes `'` to `=+-@`-leading labels (`boq-writers.ts:124-130`) — already applied to every label cell; a renamed name flows through it unchanged |
| Rename to a hostile name breaking the rate/hidden re-key | Tampering | Re-key operates on exact string keys (no eval/regex on the name); names are opaque strings throughout |

No new attack surface: the phase adds no IPC channels (order rides the existing `writeBoq*` payload), no file paths, no network, no `dangerouslySetInnerHTML`, no `eval`.

## Sources

### Primary (HIGH confidence — read this session)
- `src/renderer/src/stores/markupStore.ts` — command stack, `recolorGroup`, `editMarkup`, undo/redo reducers, `MarkupCommand` handling, `UNDO_STACK_MAX=50`, `nextCountSequence`, `hydrate`/`reset`.
- `src/renderer/src/stores/projectStore.ts` — `rates: Record<string,PriceEntry>`, `hiddenItemNames`, `defaultMarkupPct`, `setPrice`/`toggleHiddenItem`/`markDirty`, `attachDirtyTracking` selector tuple.
- `src/renderer/src/types/markup.ts` — `MarkupCommand` discriminated union, `Markup` types, `CountMarkup.sequence`, `ArcMap`.
- `src/renderer/src/lib/boq-aggregator.ts` — bucket by `(categoryId, name|type)`, `UNCAT_BUCKET_KEY`, the `localeCompare` sort **at line 264**, `categoryOrder` getState default, `AggregateOptions`.
- `src/renderer/src/lib/boq-types.ts` — `PriceEntry`, `BoqItemRow`, `BoqStructure`, `AggregateOptions`.
- `src/renderer/src/lib/project-serialize.ts` / `project-schema.ts` — additive `ProjectFileV2` fields, `return raw as ProjectFileV2` cast, snapshot/hydrate coercion, no-formatVersion-bump precedent.
- `src/renderer/src/hooks/useBoqLive.ts` — primitive-selector + `useMemo`-dep liveness (incl. `rates`/`defaultMarkup`).
- `src/renderer/src/hooks/useExport.ts` — `aggregateBoq()` called in renderer (line 79), `BoqStructure` shipped via IPC.
- `src/main/boq-writers.ts` — writers iterate `cat.items` in array order (lines 234, 424); `safeText` formula guard; 4-way type lock.
- `src/renderer/src/components/{TotalsRow,EstimateRow,TotalsRowContextMenu,TotalsCategoryBlock,EstimateCategoryBlock,TotalsPanel,EstimatePanel,DefaultMarkupChangeModal,CategoryAutocomplete,MarkupNamePopup,Splitter}.tsx`; `hooks/useDraggable.ts` — verified UI recipes (visibility key `name|categoryId`, inline-edit, pointer-drag, modal, autocomplete, context menu).
- `package.json` / `vitest.config.ts` — installed versions + test config.
- `.planning/phases/17-*/{17-SPEC,17-CONTEXT,17-UI-SPEC}.md`, `.planning/STATE.md`, `.planning/phases/16-*/{16-CONTEXT,16-PATTERNS}.md` — locked requirements, decisions, precedent map.

### Secondary (MEDIUM)
- `.planning/config.json` — `nyquist_validation: true`, `commit_docs: true`, no `security_enforcement` key.
- `src/tests/boq-aggregator.test.ts`, `use-boq-live.test.ts` — order-agnostic assertion style (verified via grep) confirming the sort change is test-safe.

### Tertiary (LOW — flagged for validation)
- `lucide-react@1.6.0` exports `GripVertical` — `[CITED: 17-UI-SPEC, ui-checker-verified]`; confirm import in Wave 0.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — installed versions read from `package.json`; no new packages by constraint.
- Architecture (order field, aggregator change, export propagation, persistence): HIGH — every claim verified against the exact source lines cited.
- Cross-store undo design: HIGH on the mechanism (grounded in `recolor-group`/`delete-group`), MEDIUM on exact command-field shapes (a recommended design the planner will finalize).
- Collision semantics (A1) + copy-color (A2) + auto-name base (A3): MEDIUM — design decisions flagged for user/discuss confirmation.
- Pitfalls: HIGH — Pitfall 1 (visibility key) and the aggregator-location correction are verified code facts that contradict the SPEC/CONTEXT shorthand.

**Research date:** 2026-07-09
**Valid until:** ~2026-08-09 (stable brownfield; invalidated earlier only if the stores/aggregator are refactored before planning)
