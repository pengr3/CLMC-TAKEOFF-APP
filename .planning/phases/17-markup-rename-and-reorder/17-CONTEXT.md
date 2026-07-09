# Phase 17: Markup Rename and Reorder - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Five whole-**group** operations — **rename**, **reorder-within-category**, **move**, **copy**, **duplicate** — invoked from the **totals-panel rows** and the **Estimate-sheet rows**, reusing measured quantities without re-drawing. Every operation persists in the `.clmc` (additive field, no `formatVersion` bump) and is reversible with a single Ctrl+Z (atomic across `markupStore` + `projectStore`). A "group" is every markup sharing a `.name` — grouping is implicit by name; there is no group entity.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `17-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `17-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**⚠ One SPEC behavior was revised during this discussion:** Requirement 1's name-collision handling changed from **merge-confirm** to **block-on-collision (no merge)**. `17-SPEC.md` was updated on 2026-07-09 to match (Req 1 target/acceptance, Boundaries, Constraints, Acceptance-Criteria checklist). See **D-04** below — it is the authoritative statement of the new behavior.

**In scope (from SPEC.md):**
- Five group operations — rename, reorder-within-category, move, copy, duplicate — triggered from totals-panel rows **and** Estimate-sheet rows.
- Atomic re-keying of `rates` + `hiddenItemNames` on rename; category reassignment on move; independent-snapshot creation with auto-name + blank rate on copy/duplicate.
- A persisted per-category manual item order (additive `.clmc` field, no `formatVersion` bump) shared by the totals panel, the Estimate sheet, and the xlsx/csv export.
- Undo/redo for all five operations, atomic across `markupStore` + `projectStore`.
- A **blocking inline validation** on rename name collision (revised — no merge dialog).

**Out of scope (from SPEC.md):**
- Live-shared / multi-category geometry (a markup belonging to >1 category at once) — independent snapshots chosen instead.
- Cross-category drag-reorder — a category change is done via **Move**, not the reorder drag.
- Reordering the categories themselves — `categoryOrder` already exists and is unchanged.
- Group operations from the canvas right-click menu — triggers live on the two list surfaces only; the canvas keeps its single-markup Edit/Delete.
- A create-time **name** prompt on copy/duplicate — they auto-name silently.
- Bulk / multi-group operations — single-group only.
- **Merging two groups** (combining quantities/rates) — rename now blocks on collision; deliberate merge is a future phase.

</spec_lock>

<decisions>
## Implementation Decisions

### Action Triggers
- **D-01:** All group ops are invoked from a **right-click context menu on both surfaces**. Extend the existing `TotalsRowContextMenu` (today only "Copy as text") with **Rename / Move to… / Copy to… / Duplicate**, and add the **same** context menu to `EstimateRow` (which has none today — its cells `stopPropagation`). "Copy as text" stays **totals-only** (the Estimate sheet has its own export); the Estimate menu carries just the four group actions. Rejected: a persistent hover-⋯ button (totals row is tight; Estimate grid is already 10 columns) and "both."

### Rename
- **D-02:** Rename is **inline edit-in-place** — the row's name cell becomes a text input. Triggered by the menu **"Rename"** item **and** double-click on the name. On the **totals row**, guard the double-click with an `e.detail === 2` check so the instant single-click cycle/arm is **not** delayed or suppressed (only the redundant second click's cycle is skipped) — perceived-performance of the single-click stays intact. The Estimate **Item** cell has no click handler, so double-click is clean there. Commit on Enter/blur, cancel on Esc. Reuse the app's uncontrolled-input + native-listener inline-edit recipe (EstimateRow / TotalsRow rate cells).
- **D-03:** Rename is **name-only** (category changes go through **Move**). Blank/whitespace names are rejected (consistent with existing naming). On a non-colliding rename, one undoable command changes `.name` on every markup in the group (all pages) and **atomically re-keys** `rates` (`old|type` → `new|type`, per type present) + `hiddenItemNames` (`old` → `new`); per-name color follows automatically.
- **D-04 (collision → BLOCK — supersedes SPEC Req 1 merge):** If the typed name already exists on another group **of the same type**, the rename is **blocked** with an inline "A group named '{name}' already exists" message; both groups are left untouched. **No merge, no merge-confirm dialog, no rate-key merge resolution, no count-sequence renumbering.** Rationale: a group's identity *is* its name (aggregator buckets by `name|type`), so two same-name+type groups cannot coexist — the only coherent outcomes on collision are merge or block, and the user explicitly rejected silent merging. This removes the merge-confirm dialog and the rate-merge logic from the phase entirely.

### Move / Copy / Duplicate
- **D-05 (category picker):** Move and Copy choose the destination category via a **small dialog reusing `CategoryAutocomplete`** (type-ahead an existing category OR type a brand-new one). Follows the app's modal convention (`useDraggable`, ESC=Cancel/Enter=Confirm). Rejected: a fly-out submenu (more custom-menu work; awkward "new category" entry).
- **D-06 (Move):** Reassigns `categoryId` on every markup in the group to the chosen category; name, quantity, color, and rate (category-independent `name|type`) unchanged. The row leaves the old category and appends to the target category's manual order. One undoable command.
- **D-07 (Copy):** Creates **independent** new markups (new ids, same page + geometry/points/arcs) in the chosen category under an **auto-generated unique name** ("{name} (n)", first free) with a **fresh blank rate** (material ₱0 / labor ₱0 / project default markup). The dialog **shows the resulting auto-name** (e.g. *"Copy as 'Slab (2)' into…"*) so it isn't a surprise — this reconciles the SPEC's "no create-time name/category prompt" wording: there is **no name prompt**, but Copy still picks a category per Req 4. One undoable command (undo removes the copied markups **and** their rate entry).
- **D-08 (Duplicate):** **No dialog** — same category, auto-named "{name} (n)", fresh blank rate; independent snapshot; does **not** merge into the source (distinct name → distinct bucket). One undoable command.

### Reorder (drag)
- **D-09 (grab):** Reorder via a **dedicated grip handle** (GripVertical-style icon) that appears on **row-hover** — like the existing '+' hover affordance on `TotalsRow`. Drag works **only** from the handle → zero conflict with the totals row's single-click cycle or the Estimate row's editable cells. Handle sits on the row's **leading edge**. Appears on **both** surfaces. Rejected: grab-anywhere (collides with click-to-cycle + editable cells).
- **D-10 (drop feedback):** **Insertion line** — the grabbed row lifts slightly and follows the cursor; a thin accent line shows the drop position between rows. Rejected: live push/gap animation (more tuning; janky when dense or scrolling).
- **D-11 (order semantics — SPEC-locked, restated):** Reorder is **within-category only**. Default order is **placement order** (order items were first added), replacing the current alphabetical sort; newly-added items **append** at the end. The single persisted per-category manual order is shared by the totals panel, the Estimate sheet, **and** the xlsx/csv export (all consume the one aggregator output). Stored in an additive `.clmc` field, no `formatVersion` bump.

### Claude's Discretion / For research
- **Drag mechanism** (HTML5 native drag-and-drop vs pointer-events) — the SPEC nominally deferred this to discuss, but it's an implementation choice: **research picks it** given the constraints (no new npm packages; must support the leading-edge handle, the insertion-line indicator, and a possibly-scrolling list on both surfaces).
- **Persisted-order field shape** (e.g. `categoryItemOrder: Record<categoryId, string[]>` keyed by `name|type`), the **cross-store atomic-undo command extension**, and **how `aggregateBoq` consumes the manual order** (replace the `localeCompare` sort at `boq-aggregator.ts:264`) — planner/research decisions.
- **Grip-handle glyph + hover-zone layout** (how the new grip shares the tight totals-row hover area with the existing '+' affordance) — UI layout detail for the executor.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec (locked)
- `.planning/phases/17-markup-rename-and-reorder/17-SPEC.md` — the 5 locked requirements, boundaries, constraints, acceptance criteria. **MUST read.** NOTE: Req 1's collision behavior was revised to **block** (no merge) on 2026-07-09 — D-04 above is authoritative; the SPEC has been updated to match.

### Upstream data-model context
- `.planning/phases/16-estimating-workspace/16-CONTEXT.md` — the `PriceEntry {material, labor, markup}` rate model + Estimate-sheet architecture (Plan|Estimate toggle, EstimateRow/CategoryBlock/Panel) that this phase re-keys and extends.
- `.planning/phases/16-estimating-workspace/16-PATTERNS.md` — closest-analog mapping for Phase-16 components (useful precedent for mapping the new group commands).

No external ADRs — the markup/rate/order data model is defined in code (see Existing Code Insights). Requirements are otherwise fully captured in the SPEC + decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/renderer/src/components/TotalsRowContextMenu.tsx`** — the existing right-click menu on totals rows (flat div, deferred outside-click/Escape listener, cursor positioning). Extend with the four group actions; mirror it for the Estimate sheet.
- **`src/renderer/src/components/DefaultMarkupChangeModal.tsx`** / **`SaveCloseModal.tsx`** — confirm-with-impact modal pattern (centered, `useDraggable`, Cancel + accent-confirm, ESC=Cancel/Enter=Confirm, confirm auto-focus). The **Move/Copy category dialog** follows this convention. (No merge modal is needed — D-04.)
- **`src/renderer/src/components/CategoryAutocomplete.tsx`** — type-ahead category entry (`onMouseDown` + `preventDefault` keeps the dropdown open); reuse inside the Move/Copy dialog for existing-or-new category selection.
- **`src/renderer/src/components/MarkupNamePopup.tsx`** — existing name/category entry popup (`getOrCreateCategory`, freehand naming); reference for the inline-rename input + new-category creation.
- **`recolorGroup` (markupStore)** — the ONLY existing whole-group, multi-page, undoable command; the closest analog for the new whole-group commands. Stores per-markup old-state for undo.
- **`editMarkup` / `edit-markup` command** — single-markup name/category/color edit; rename generalizes this to the whole group **plus** re-keying the name-keyed side-tables.
- **`useDraggable` hook** — for the Move/Copy dialog. **`labelToName` (TotalsRow.tsx)** — strips the D-02 `(count)`/`(perimeter)` disambiguation suffix; needed anywhere the row label maps back to a group name/rate key.

### Established Patterns
- **Grouping is implicit by `.name`.** BOQ aggregator buckets by `(categoryId, name|type)`; **rate key = `name|type`** (category-independent); **visibility key = `name|categoryId`** (distinct). Rename must re-key `rates` + `hiddenItemNames`. Two same-name+type groups **cannot** coexist (they bucket together) — this is *why* collision must block (D-04) and *why* copy/duplicate auto-name.
- **Command stack in `markupStore`** (place / delete / delete-group / edit-markup / recolor-group / move-vertex / move-markups / reshape-arc / reopen-recommit), cap 50. `projectStore` mutations (rates, hidden, defaultMarkup) are **NOT** on the stack — they mark dirty directly. Constraint: rename (re-key) and copy/duplicate (new rate entry) touch **both** stores → the command model must be extended so **one Ctrl+Z reverts across `markupStore` + `projectStore` atomically**.
- **Aggregator sort** at `boq-aggregator.ts:264` — `items.sort((a,b) => a.label.localeCompare(b.label))` is the single output consumed by the totals panel, the Estimate sheet, AND the xlsx/csv writers. Replacing alphabetical with the persisted per-category manual order — done once in the aggregator — changes all three surfaces together.
- **Additive `.clmc` fields, no `formatVersion` bump** (precedent: `rates`, `hiddenItemNames`, `arcs`, `categoryOrder`). The new per-category order rides the `return raw as ProjectFileV2` cast (no `validateV2` branch); old files load with no order field → placement order, no error.
- **Inline-edit recipe** (EstimateRow / TotalsRow rate cells): uncontrolled input + **native** blur/Enter listeners + `stopPropagation` on click/mousedown/keydown; seed guarded on `document.activeElement !== el` so mid-typing is never clobbered. Reuse for the inline rename input.
- **Context-menu recipe** (MarkupContextMenu / TotalsRowContextMenu): deferred listener registration (`setTimeout(…, 0)`), outside-click + Escape close, `e.detail` / `preventDefault` handling.

### Integration Points
- **`markupStore`** — new whole-group commands (rename / move / copy / duplicate) + reorder; extend the command union + undo/redo reducers; cross-store atomic undo.
- **`projectStore`** — rate re-key on rename; new blank rate entry on copy/duplicate (+ its undo); the new **per-category order** field + serialize/hydrate + `markDirty`.
- **`boq-aggregator.ts`** — consume the per-category manual order (replace the `localeCompare` sort); newly-added items append.
- **`project-serialize.ts` / `project-schema.ts`** — additive per-category order field (snapshot/hydrate; no `validateV2` branch, no `formatVersion` bump).
- **`TotalsRow.tsx` / `TotalsRowContextMenu.tsx` / `TotalsPanel.tsx` / `TotalsCategoryBlock.tsx`** and **`EstimateRow.tsx` / `EstimatePanel.tsx` / `EstimateCategoryBlock.tsx`** — trigger wiring, grip handle, inline rename, drag.
- **`src/main/boq-writers.ts`** (xlsx/csv) — already consume the aggregator output; inherit the manual order automatically (verify in a round-trip test).

</code_context>

<specifics>
## Specific Ideas

- **User explicitly rejected merge-on-rename** ("i dont think i like the merge when renaming?") → **block on collision** (D-04). Strong preference: rename must never silently combine or drop data.
- User values **snappy, direct manipulation** → inline rename + double-click accelerator (spreadsheet feel), and the totals single-click must stay instant (the `e.detail===2` guard exists precisely to protect it).
- Copy dialog should **preview the auto-generated name** ("Copy as 'Slab (2)'…") so the result is never a surprise.

</specifics>

<deferred>
## Deferred Ideas

- **Deliberate group-merge** — intentionally combining two groups (what merge-on-rename would have done) is now out of scope; a real "Merge groups" feature belongs in its own future phase.
- **Bulk / multi-group operations** (rename/move many at once) — SPEC out-of-scope; single-group only this phase.
- **Live-shared / multi-category geometry** — SPEC out-of-scope; independent snapshots chosen.
- **Cross-category drag-reorder** — SPEC out-of-scope; a category change is Move, not a drag.
- **Reordering the categories themselves** — SPEC out-of-scope; `categoryOrder` unchanged.
- **Group ops from the canvas right-click** — SPEC out-of-scope; list surfaces only.

None of these emerged as new scope creep — they are the SPEC's own explicit exclusions, restated so they aren't lost.

</deferred>

---

*Phase: 17-markup-rename-and-reorder*
*Context gathered: 2026-07-09*
