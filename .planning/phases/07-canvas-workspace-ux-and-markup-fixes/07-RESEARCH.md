# Phase 7: Canvas Workspace UX and Markup Editing Fixes — Research

**Researched:** 2026-05-13
**Domain:** React / Konva / Zustand in an Electron 35 renderer — pure renderer-layer fixes, no IPC changes
**Confidence:** HIGH (all findings verified by direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01/D-02: Canvas gutter root cause is the ResizeObserver circular dependency; fix is `position: absolute; inset: 0` on the `containerRef` div.
- D-03: Fit-to-window centering math is correct — no math changes required.
- D-04: Edit triggered via right-click → "Edit" in `MarkupContextMenu`.
- D-05: Edit scope is per-markup only (not group rename).
- D-06: Edit popup reuses `MarkupNamePopup` in `mode='edit'`; no measurement preview.
- D-07: Edit action is undoable via new `EditMarkupCommand` storing old+new name/categoryName/color triple.
- D-08: Remove grand-total bar from `TotalsPanel.tsx` (`data-testid="totals-panel-grand-total"` block).
- D-09: Remove subtotal rows from `TotalsCategoryBlock.tsx` (`category.subtotals.map(...)` block); aggregator data unchanged.
- D-10: All other TotalsPanel interactions (collapse, hover ring, click-navigate, right-click context menu) unchanged.
- D-11: CalibrationDialog dropdown overflow — prefer stacking-context fix (`isolation: isolate`); fallback to custom dropdown only if both A and B fail.
- D-12: Add ArrowDown/ArrowUp/Enter keyboard navigation to `CategoryAutocomplete`.
- D-13: On confirm in `MarkupNamePopup.handleConfirm`, call `findCategoryByName` and substitute canonical name if case-insensitive match exists.

### Claude's Discretion
- Edit scope (D-05): per-markup recommended.
- Set Scale fix approach (D-11): prefer `overflow: visible` / `isolation: isolate` on clipping ancestor; fall back to custom dropdown only if needed.
- Category keyboard highlight state (D-12): hold `highlightedIndex` as local state in `CategoryAutocomplete` (or in `MarkupNamePopup` and passed down).

### Deferred Ideas (OUT OF SCOPE)
- Group/bulk rename
- Geometry editing (move polygon vertices)
- Markup visibility layers (v2 PROD-02)
- Custom export templates
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Canvas workspace fills all available space (no blank gutters) | D-01/D-02 root cause verified in CanvasViewport.tsx lines 526–538; fix pattern confirmed |
| MARK-03 | Area markup and all markup types support post-commit editing | EditMarkupCommand pattern confirmed against existing MarkupCommand union; MarkupNamePopup reuse confirmed |
| VIEW-01 | Live totals panel shows clean individual quantities without aggregate clutter | Exact delete blocks identified in TotalsPanel.tsx (282–323) and TotalsCategoryBlock.tsx (142–188) |
</phase_requirements>

---

## Summary

Phase 7 makes five targeted surgical fixes to the renderer layer. Every fix touches exactly one or two existing files, introduces zero new components, and follows patterns already established in earlier phases. This is not exploratory work — the codebase inspection confirms CONTEXT.md's line-number claims with one small correction and surfaces several implementation landmines the planner must address.

The most structurally important fix is the canvas gutter (D-01/D-02): the `containerRef` div at line 526 currently uses `width: '100%', height: '100%'`, but its flex parent in App.tsx has no explicit height, so percentage height resolves to zero and the ResizeObserver reports the Stage's initial `{ width: 800, height: 600 }` default. The fix (`position: absolute; inset: 0`) is a one-line CSS change with high confidence. The most structurally complex fix is EditMarkupCommand (D-07): it requires adding a new discriminant to the `MarkupCommand` union type, a new `editMarkup` action on the store, and new wiring in `CanvasViewport` — three separate file touches that must happen in a coordinated order.

**Primary recommendation:** Implement the five fixes in dependency order — canvas gutter first (no dependencies), then totals panel deletions (no dependencies), then CalibrationDialog dropdown fix (no dependencies), then category dedup + keyboard nav (CategoryAutocomplete and MarkupNamePopup only), then post-commit editing last (highest dependency count: types, store, context menu, popup, and viewport wiring). Testing strategy mirrors existing patterns exactly — no new test infrastructure needed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Canvas workspace fill (D-01/D-02) | Browser / Client (Renderer CSS) | — | Pure CSS fix on a React div; no IPC, no store changes |
| Post-commit markup editing (D-04–D-07) | Browser / Client (Renderer state + UI) | — | All state in markupStore (renderer-side Zustand); popup and context menu are renderer components |
| Totals panel cleanup (D-08/D-09) | Browser / Client (Renderer render) | — | Pure deletion of JSX blocks; aggregator (boq-aggregator.ts) unchanged |
| CalibrationDialog dropdown (D-11) | Browser / Client (Renderer CSS) | — | Stacking-context fix via inline CSS on an existing element |
| Category deduplication UX (D-12/D-13) | Browser / Client (Renderer UI + store query) | — | `findCategoryByName` is already on the store; keyboard state is local component state |

---

## Standard Stack

No new libraries are introduced in Phase 7. All fixes use the existing stack.

### Core (unchanged)
| Library | Version | Phase 7 Role |
|---------|---------|--------------|
| React | 19.x | Component state for `highlightedIndex`, `mode='edit'` extension |
| Konva / react-konva | 10.2.x / 19.2.x | No changes — Stage and Layer untouched |
| Zustand 5 | 5.0.x | `MarkupCommand` union extension; new `editMarkup` action |
| TypeScript 5 | 5.x | Strict union extension; see Implementation Landmines below |

**Version verification:** Not re-run — versions confirmed by CLAUDE.md stack table and prior phase research. [ASSUMED: versions have not changed since Phase 6 completion on 2026-05-12]

---

## Architecture Patterns

### System Architecture Diagram

```
Right-click markup (canvas event)
    │
    ▼
CanvasViewport.handleContextMenu
    │ sets contextMenu state { id, x, y }
    ▼
MarkupContextMenu rendered at screenPos
    │ "Edit" item clicked → onEdit() callback
    ▼
CanvasViewport mounts MarkupNamePopup mode='edit'
    │ pre-filled: markup.name, categories[markup.categoryId]?.name, markup.color
    ▼
User edits fields → clicks "Save Changes"
    │ onConfirm({ name, categoryName, color })
    ▼
MarkupNamePopup.handleConfirm()
    │ findCategoryByName(typed) → canonical substitution (D-13)
    │ calls onConfirm with canonical categoryName
    ▼
CanvasViewport constructs EditMarkupCommand { markupId, page, old*, new* }
    │
    ▼
markupStore.editMarkup(cmd)
    │ findCategoryByName(newCategoryName) ?? getOrCreateCategory(newCategoryName)
    │ mutates markup.name / markup.categoryId / markup.color
    │ pushes cmd to undoStack via pushCommand()
    ▼
Zustand notifies: CanvasViewport re-renders (pin color), TotalsPanel re-renders (chip color)
    │
    ▼
Ctrl+Z → undo() dispatches: reads cmd.type === 'edit-markup', reverts to old triple
```

### Recommended Project Structure (unchanged)

No structural changes. All Phase 7 work touches files that already exist.

### Pattern 1: MarkupCommand Union Extension

**What:** Add a new `'edit-markup'` discriminant to the `MarkupCommand` union in `src/renderer/src/types/markup.ts`. The `undo()` and `redo()` handlers in `markupStore.ts` switch on `cmd.type` — a new branch must be added to both.

**When to use:** Whenever a reversible mutation of markup fields (name, categoryId, color) is needed.

**Example (shape, not final code):**
```typescript
// Source: markup.ts MarkupCommand union — extend this type
| {
    type: 'edit-markup'
    markupId: string
    page: number
    oldName: string
    oldCategoryName: string   // store the NAME not the ID — category may not exist on undo
    oldColor: string
    newName: string
    newCategoryName: string
    newColor: string
  }
```

**Key insight:** Store `oldCategoryName` (the string name), NOT `oldCategoryId`. On undo, call `findCategoryByName(oldCategoryName)` to recover the category ID — the category object persists in the store after markup mutations (per STATE.md Pitfall 4 / markup-commands.test.ts). If stored as ID and the category were ever pruned (it isn't in the current codebase, but defensive) the undo would silently break.

### Pattern 2: Keyboard Navigation in CategoryAutocomplete

**What:** Add `highlightedIndex: number` local state (default `-1`) to `CategoryAutocomplete`. Forward `onKeyDown` from the category `<input>` in `MarkupNamePopup` to a handler inside `CategoryAutocomplete` — or, more simply, handle the keyboard events directly on the category input in `MarkupNamePopup` and pass `highlightedIndex` + `onHighlightChange` as controlled props.

**When to use:** Category input has focus and `showCategoryList === true`.

**State management decision (Claude's discretion):** Lifting `highlightedIndex` into `MarkupNamePopup` as a controlled prop pair (`highlightedIndex` / `onHighlightChange`) is cleaner because `MarkupNamePopup` already owns `showCategoryList` and the `onKeyDown` handler on the wrapper div. The category input's `onKeyDown` is currently not overridden — the `handleKeyDown` on the wrapper div intercepts Enter/Escape at the div level. Keyboard navigation arrows must be captured before the wrapper-level handler to avoid the Enter-submits-form conflict. See Landmine 3 below.

**Example (shape, not final code):**
```typescript
// In MarkupNamePopup: extend onKeyDown to route arrow keys
const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
  if (!showCategoryList) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault() // prevent cursor movement in input
    // update highlightedIndex
  } else if (e.key === 'Enter' && highlightedIndex >= 0) {
    e.preventDefault() // select item, NOT submit form
    // call onSelect with the highlighted item name
  }
}
```

### Anti-Patterns to Avoid

- **Changing `boq-aggregator.ts`** for the TotalsPanel cleanup — the `subtotals` and `grandTotal` fields are read by the Phase 5 export pipeline. Delete only the render blocks in TotalsPanel.tsx and TotalsCategoryBlock.tsx.
- **Storing `oldCategoryId` instead of `oldCategoryName` in EditMarkupCommand** — category IDs are UUIDs; the human-readable name is what survives conceptually across undo/redo.
- **Calling `getOrCreateCategory` directly from CanvasViewport** on the edit confirm path — the command's `execute()` must own the `getOrCreateCategory` call so redo works correctly (the command must be self-contained).
- **Modifying App.tsx** for the canvas fill fix — the change is entirely inside `CanvasViewport.tsx`'s root div. The parent div in App.tsx (`<div style={{ flex: 1, position: 'relative' }}>`) needs no change; `inset: 0` works against any positioned ancestor, and the parent already has `position: 'relative'`.
- **Resetting `highlightedIndex` on mouse-hover** — per D-12 locked discretion, mouse-hover and keyboard-highlight are independent states.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard-accessible combobox | Custom ARIA combobox from scratch | Extend existing `CategoryAutocomplete` + `onMouseDown + e.preventDefault()` pattern | The blur-before-select race is already solved by `onMouseDown`; adding arrow-key index on top of it is additive, not a rewrite |
| Undo/redo for edit action | New undo mechanism | Extend `MarkupCommand` union + existing `pushCommand` + existing `undo()`/`redo()` switch | `pushCommand` handles the UNDO_STACK_MAX=50 clamping automatically; re-implementing would regress MARK-09 |
| CSS dropdown replacement | Custom styled `<select>` from scratch | First try `isolation: isolate` on the CalibrationDialog overlay div — takes 1 line | Chromium 134 (Electron 35) supports `isolation: isolate` since Chrome 87; the custom dropdown is Option C, not the default |

**Key insight:** Every problem in Phase 7 has an existing internal solution — the work is extension and deletion, not construction.

---

## Runtime State Inventory

Phase 7 is not a rename/refactor/migration phase. All changes are renderer-layer code edits (CSS, JSX, TypeScript). No stored data, live service config, OS-registered state, secrets, or build artifacts are involved.

**Nothing found in any category — verified by phase scope inspection (code/JSX/CSS changes only, no data schema changes, no file renames).**

---

## Implementation Landmines

### Landmine 1: The MarkupCommand union is a discriminated union — TypeScript will demand exhaustive switch handling

**What goes wrong:** Adding `type: 'edit-markup'` to the `MarkupCommand` union in `markup.ts` will cause TypeScript to flag the `undo()` and `redo()` handlers in `markupStore.ts` as non-exhaustive if those handlers use a type guard `if (cmd.type === 'recolor-group')` followed by code that assumes the remaining branches only have `.markup` (the `place`/`delete` shape). The current code at `markupStore.ts` line 188 does `const page = cmd.markup.page` — this will break at runtime if an `'edit-markup'` command reaches that line.

**Root cause:** The existing `undo()`/`redo()` handlers use an early-return pattern for `'recolor-group'` and fall through to `cmd.markup.page` for `'place'`/`'delete'`. A new type without `.markup` will reach the fallthrough branch.

**Prevention:** Add the `'edit-markup'` branch explicitly in both `undo()` and `redo()` before the existing `cmd.markup.page` fallthrough. Do not use a TypeScript `never` assertion — the planner should add a clear `if (cmd.type === 'edit-markup') { ... return ... }` guard.

**Verified:** [VERIFIED: codebase inspection of markupStore.ts lines 165–240]

---

### Landmine 2: MarkupNamePopup `handleConfirm` wrapper div `onKeyDown` intercepts Enter at the div level

**What goes wrong:** The current `handleKeyDown` on the wrapper div at `MarkupNamePopup.tsx:101` fires on ALL Enter keydowns within the popup, including when the category input has focus and a suggestion row is keyboard-highlighted. The intended behavior is: Enter on a highlighted autocomplete row selects that row (does NOT submit the form). The current code will call `handleConfirm()` instead.

**Root cause:** The `onKeyDown` is on the outermost `<div role="dialog">`, not on the name input specifically. Category input does not have its own `onKeyDown` override.

**Prevention:** The category `<input>` needs its own `onKeyDown` that stops propagation when `highlightedIndex >= 0` and key is `Enter`, calling `onSelect` on the highlighted item instead. This handler must call `e.stopPropagation()` to prevent the wrapper div's `handleKeyDown` from also firing.

**Verified:** [VERIFIED: codebase inspection of MarkupNamePopup.tsx lines 101–109, 175–179]

---

### Landmine 3: `onBlur` on category input has a 120ms `setTimeout` — keyboard Enter selection must land within that window

**What goes wrong:** At `MarkupNamePopup.tsx:179`, the category input's `onBlur` calls `setTimeout(() => setShowCategoryList(false), 120)`. The `onMouseDown + e.preventDefault()` pattern on each row prevents blur from firing before mousedown selects. But keyboard Enter fires on the input itself (no `e.preventDefault()` on blur). When Enter selects a highlighted item via the input's `onKeyDown`, the input does NOT blur, so the 120ms timer is not an issue for the selection itself — but it IS an issue if the popup immediately calls `handleConfirm()` after `onSelect` (because the list would still be open and `showCategoryList` would still be `true` for the rest of the 120ms window). Since Landmine 2's fix stops propagation, the double-fire path is blocked. Document this interaction so the planner's implementation is explicit about not calling `handleConfirm` on an Enter that was consumed by the autocomplete.

**Verified:** [VERIFIED: codebase inspection of MarkupNamePopup.tsx line 179]

---

### Landmine 4: `MarkupContextMenu` uses `position: fixed` — but the "Edit" popup must use `position: absolute`

**What goes wrong:** `MarkupContextMenu` renders with `position: fixed` (line 62 of MarkupContextMenu.tsx) so it positions relative to the viewport, not the CanvasViewport container. When `CanvasViewport` receives the `onEdit` callback and mounts `MarkupNamePopup`, it must convert the fixed-position screen coords from the context menu into container-relative coords for the popup's `screenPos` prop. The popup uses `position: absolute` and positions relative to its nearest positioned ancestor (the `containerRef` div). The context menu's `screenPos` is already in screen/viewport space (it comes from the Konva `onContextMenu` handler which uses `stage.getPointerPosition()` — screen space). The popup clamps against `containerSize`, so it needs to know container-relative coords, not viewport coords. CanvasViewport must account for the container's `getBoundingClientRect()` offset.

**Root cause:** `MarkupContextMenu.screenPos` is in fixed/viewport coordinates (matching its `position: fixed`). `MarkupNamePopup.screenPos` is in container-relative coordinates (matching its `position: absolute` inside the containerRef div).

**Prevention:** When `CanvasViewport` wires `onEdit` → mount popup, subtract `containerRef.current.getBoundingClientRect().left/top` from the context menu's `screenPos` to get container-relative coordinates for the popup. This is the same conversion used elsewhere when converting pointer events to stage-space coordinates.

**Verified:** [VERIFIED: codebase inspection of MarkupContextMenu.tsx line 62, MarkupNamePopup.tsx lines 82–86, CanvasViewport.tsx line 525–538]

---

### Landmine 5: The `cancelLabel` in `MarkupNamePopup` is currently `'Discard'` — the UI-SPEC requires `'Discard Changes'` for `mode='edit'`

**What goes wrong:** `MarkupNamePopup.tsx:112` hard-codes `const cancelLabel = 'Discard'` for both `'count-pre'` and `'save-after'` modes. The UI-SPEC mandates `'Discard Changes'` for `mode='edit'`. Additionally, the existing copy `'Discard'` is NOT on the blocked list in the UI-SPEC (only `'Cancel'` is blocked). So the existing modes keep `'Discard'`; only edit mode gets `'Discard Changes'`.

**Root cause:** The cancel label is not mode-conditional today.

**Prevention:** Make `cancelLabel` mode-conditional:
- `'count-pre'` → `'Discard'` (existing)
- `'save-after'` → `'Discard'` (existing)
- `'edit'` → `'Discard Changes'` (new)

**Verified:** [VERIFIED: codebase inspection of MarkupNamePopup.tsx line 111–113]

---

### Landmine 6: `MarkupNamePopup` `aria-label` is mode-conditional — edit mode needs updating

**What goes wrong:** `MarkupNamePopup.tsx:151` sets `aria-label={mode === 'count-pre' ? 'Name count item' : 'Save markup'}`. This aria label would be wrong for `mode='edit'` — it would read `'Save markup'`.

**Prevention:** Extend the aria-label ternary to a three-way condition: `mode === 'count-pre' ? 'Name count item' : mode === 'edit' ? 'Edit markup' : 'Save markup'`.

**Verified:** [VERIFIED: codebase inspection of MarkupNamePopup.tsx line 149–153]

---

### Landmine 7: The grand-total bar test in `totals-panel-render.test.ts` asserts `bar` is NOT null — this test will fail after D-08

**What goes wrong:** `totals-panel-render.test.ts:260` asserts `expect(bar).not.toBeNull()` where `bar = container.querySelector('[data-testid="totals-panel-grand-total"]')`. After the D-08 deletion, this element no longer exists. The test will fail.

**Prevention:** The test must be updated in the same plan-step that removes the grand-total bar. Replace the assertion with `expect(bar).toBeNull()` or delete the entire `'grand-total bar shows per-UoM totals at the bottom'` test block and replace it with a regression test confirming the bar is absent.

**Verified:** [VERIFIED: codebase inspection of totals-panel-render.test.ts lines 237–269]

---

### Landmine 8: CalibrationDialog secondary button is currently labeled `'Cancel'` (blocked by UI-SPEC)

**What goes wrong:** `CalibrationDialog.tsx:175` renders `Cancel` as the secondary button label. The UI-SPEC Copywriting Contract explicitly blocks generic `Cancel` and requires `'Discard Scale'`. This change is in scope for D-11 even if Option A (stacking-context fix) resolves the dropdown issue without touching other parts of the dialog.

**Prevention:** The D-11 plan task must include the label change from `Cancel` → `Discard Scale` as a required step regardless of which dropdown-fix option is chosen. It is not optional.

**Verified:** [VERIFIED: codebase inspection of CalibrationDialog.tsx line 175]

---

## Common Pitfalls

### Pitfall 1: Percentage height on a flex child with no explicit parent height resolves to zero
**What goes wrong:** `height: '100%'` on a child of a flex container only works if that flex container has an explicit height (not just `flex: 1` on a grandchild). The App.tsx center column uses `flex: 1` at multiple nesting levels — the outermost level gets its height from the window, but intermediate divs can break the chain.
**Root cause:** CSS percentage height resolution requires an explicit height on the containing block. `flex: 1` sets the flex grow factor, not an explicit height.
**How to avoid:** Use `position: absolute; inset: 0` when you want to fill a positioned ancestor — this is independent of height propagation.
**Warning signs:** ResizeObserver reports width correctly but height = 600 (the Stage default).
**Verified:** [VERIFIED: codebase inspection of CanvasViewport.tsx line 526–538; App.tsx line 265]

### Pitfall 2: EditMarkupCommand must store old/new names as strings, not category IDs
**What goes wrong:** Category IDs are UUIDs assigned at `getOrCreateCategory` time. If `EditMarkupCommand` stores `oldCategoryId` and the category is later deleted (currently not possible, but defensively), `undo()` would set `markup.categoryId` to a dangling ID, causing `getCategory(id)` to return null and the markup to disappear from renders.
**Root cause:** The `MarkupCommand` pattern stores full `Markup` objects for place/delete specifically to avoid this problem. EditMarkupCommand should follow the same philosophy — store data that is self-contained for undo.
**How to avoid:** Store `oldCategoryName`/`newCategoryName` as strings. `undo()` calls `getOrCreateCategory(oldCategoryName)` — which is a no-op if the category still exists (it will) and correctly re-creates it if not.

### Pitfall 3: `onMouseDown + e.preventDefault()` in CategoryAutocomplete breaks keyboard scroll
**What goes wrong:** `scrollIntoView()` called inside a `onMouseDown` handler (or inside a state update triggered by it) runs before the browser paints. This is fine. But keyboard arrow keys that advance `highlightedIndex` need to call `scrollIntoView` on the newly highlighted row's DOM node — which requires a ref to each row.
**Root cause:** The existing rows have no refs (they are dynamically rendered without `ref` props). The highlight scroll must use either `document.querySelector('[data-highlighted="true"]')` after the state update (inside a `useEffect`) or per-row refs stored in a `useRef` Map.
**How to avoid:** Use a `useEffect` that watches `highlightedIndex` and calls `scrollIntoView({ block: 'nearest', behavior: 'auto' })` on the highlighted element by its `data-highlighted` attribute or a collected refs array.

### Pitfall 4: Forgetting that `MarkupContextMenu` defers its outside-click listener by `setTimeout(0)`
**What goes wrong:** The "Edit" button's `onClick` calls `onClose()` then mounts the popup. Because the menu's outside-click listener is registered with `setTimeout(0)`, the listener is active for the tick immediately AFTER the menu appears. The popup is mounted in the same render cycle as `onClose()` because React batches the state updates. If the popup is mounted before the outside-click listener deregisters, a single click on "Edit" could close both the menu AND the popup in the same event bubble.
**Root cause:** The defer pattern in `MarkupContextMenu` (line 43: `setTimeout(() => { document.addEventListener(...) }, 0)`) is well-intentioned but creates a brief window.
**How to avoid:** The popup's own render is triggered by a state update in CanvasViewport — it renders on the NEXT React commit after the context menu closes. The defer-timer clears the listener before the next event loop tick, so the popup mount does not race with the context menu's listener. This is the existing behavior for the "Delete" path (which already uses the same defer pattern). No extra guard needed — but the planner should verify this manually during UAT.

---

## Code Examples

### EditMarkupCommand — new action in markupStore

The `editMarkup` action must be added to the store alongside the existing `placeMarkup`, `deleteMarkup`, and `recolorGroup` actions. It uses the same `pushCommand` helper and clears `redoStack`:

```typescript
// Source: [VERIFIED: markupStore.ts structure — extends existing pattern]
editMarkup: (
  markupId: string,
  page: number,
  oldName: string, oldCategoryName: string, oldColor: string,
  newName: string, newCategoryName: string, newColor: string
) =>
  set((s) => {
    const pageList = s.pageMarkups[page] ?? []
    const target = pageList.find((m) => m.id === markupId)
    if (!target) return s  // defensive no-op (UI-SPEC error state)

    const newCategory = s.findCategoryByName(newCategoryName)
      ?? /* getOrCreateCategory call updates state separately */ null
    // ... see Implementation note below
  })
```

**Implementation note:** `getOrCreateCategory` itself calls `set()` internally. Because Zustand's `set` is synchronous and merges patches, calling `get().getOrCreateCategory(name)` inside another `set()` updater is safe — `getOrCreateCategory` reads via `get()` and writes via `set()`, both of which work correctly inside a nested updater context. Verify this with a simple test before landing.

### MarkupCommand union extension (markup.ts)

```typescript
// Source: [VERIFIED: markup.ts lines 45–55 — extend this union]
export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
  | {
      type: 'recolor-group'
      name: string
      newColor: string
      oldColors: Record<string, string>
      page?: number
      markupIdsAffected: string[]
    }
  | {
      type: 'edit-markup'
      markupId: string
      page: number
      oldName: string
      oldCategoryName: string
      oldColor: string
      newName: string
      newCategoryName: string
      newColor: string
    }
```

### Canonical-name substitution in MarkupNamePopup.handleConfirm (D-13)

```typescript
// Source: [VERIFIED: MarkupNamePopup.tsx lines 88–99 — extend handleConfirm]
const handleConfirm = useCallback((): void => {
  const trimmedName = name.trim()
  if (trimmedName === '') {
    setNameError('Enter an item name')
    return
  }
  const typed = categoryName.trim()
  const canonical = typed === '' ? '' : (findCategoryByName(typed)?.name ?? typed)
  onConfirm({
    name: trimmedName,
    categoryName: canonical,
    color: selectedColor
  })
}, [name, categoryName, selectedColor, onConfirm, findCategoryByName])
```

Note: `findCategoryByName` must be added to the dependency array. It is a stable function reference on the store (subscribed at line 64 of MarkupNamePopup), so adding it does not cause re-render churn.

### Canvas gutter fix (D-02)

```typescript
// Source: [VERIFIED: CanvasViewport.tsx line 526–538 — change this div's style]
// BEFORE:
<div ref={containerRef} style={{ width: '100%', height: '100%', ... }}>
// AFTER:
<div ref={containerRef} style={{ position: 'absolute', inset: 0, ... }}>
```

The `backgroundColor`, `backgroundImage`, `backgroundSize`, `overflow: 'hidden'`, `cursor`, and `position: 'relative'` properties at lines 529–538 are all preserved. Only `width: '100%'` and `height: '100%'` are replaced with `position: 'absolute'` and `inset: 0`. The existing `position: 'relative'` on the containerRef div is already present — the planner does not need to add it.

---

## Execution Order (Dependency Analysis)

The five fixes have these inter-dependencies:

| Fix | Depends On | Can Parallelize With |
|-----|-----------|----------------------|
| D-01/D-02 Canvas fill | Nothing | All others except none |
| D-08/D-09 Totals panel cleanup | Nothing; but requires updating broken test | D-01/D-02 |
| D-11 CalibrationDialog dropdown | Nothing (CSS + label change) | D-01/D-02, D-08/D-09 |
| D-12/D-13 Category dedup | D-13 requires `findCategoryByName` subscription be added to MarkupNamePopup's dependency array (currently not explicitly listed) | D-01/D-02, D-08/D-09, D-11 |
| D-04–D-07 Post-commit editing | Requires D-12/D-13 (edit popup uses MarkupNamePopup with canonical-name substitution); requires `MarkupCommand` union extension; requires `editMarkup` store action | Last in sequence |

**Recommended wave structure:**

- Wave 1 (no dependencies, parallel-safe): D-01/D-02 canvas fill + D-08/D-09 totals panel cleanup + D-11 CalibrationDialog fix
- Wave 2 (depends on MarkupNamePopup changes from D-13): D-12/D-13 category dedup + keyboard nav
- Wave 3 (depends on Wave 2 + types/store from D-07): D-04–D-07 post-commit editing

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `width: '100%', height: '100%'` on flex child | `position: absolute; inset: 0` on child of positioned flex parent | Phase 7 (this phase) | Eliminates ResizeObserver circular dependency |
| Totals panel shows grand-total bar + subtotals | Item rows + category headings only | Phase 7 (this phase) | Cleaner, less cognitive overhead for estimators |
| MarkupCommand union: `place` / `delete` / `recolor-group` | Extended with `edit-markup` | Phase 7 (this phase) | Enables undoable post-commit name/category/color edits |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zustand 5 / React 19 / react-konva / Konva versions unchanged since Phase 6 (2026-05-12) | Standard Stack | Low — no package.json changes between Phase 6 and now; if versions had changed, existing tests would have failed |

**All other claims in this research are verified by direct codebase inspection.** The single assumption (A1) is low-risk.

---

## Open Questions

1. **Can `getOrCreateCategory` be safely called from inside another `set()` updater in Zustand 5?**
   - What we know: `getOrCreateCategory` calls `set()` internally (markupStore.ts lines 84–88). The `editMarkup` action also uses `set()`. Zustand 5 allows nested `set()` calls in synchronous contexts.
   - What's unclear: whether Zustand 5's `subscribeWithSelector` middleware affects this.
   - Recommendation: The planner should implement `editMarkup` such that it calls `get().getOrCreateCategory(newCategoryName)` before the `set()` updater, capturing the resulting category ID in a local variable, then uses that ID inside the `set()` call. This avoids nesting `set()` inside `set()` entirely.

2. **Does the `inset: 0` fix affect the `EmptyState` component path?**
   - What we know: When `totalPages === 0`, App.tsx renders `<EmptyState />` instead of `<CanvasViewport />` inside the same `position: relative` parent div.
   - What's unclear: Whether `EmptyState` is also affected by the percentage-height issue (it might stretch correctly already).
   - Recommendation: Manual UAT — verify EmptyState renders correctly after the canvas fill fix. If EmptyState also used `height: '100%'`, it may need the same treatment. Inspection shows EmptyState is not in the files changed by Phase 7 per the UI-SPEC unmodified list, so it is assumed correct.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 7 is purely renderer-layer code/CSS changes with no new external dependencies. No new CLI tools, databases, runtimes, or external services are required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node environment by default; jsdom per-file with `/** @vitest-environment jsdom */`) |
| Config file | `vitest.config.ts` — `include: ['src/tests/**/*.test.ts']`, `alias: { '@renderer': 'src/renderer/src' }` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Canvas Stage receives correct containerSize from ResizeObserver after inset:0 fix | unit | `npx vitest run src/tests/` | Manual UAT only — ResizeObserver not mockable in current Vitest node env |
| MARK-03 | EditMarkupCommand execute/undo/redo symmetry (name, categoryId, color) | unit | `npx vitest run src/tests/markup-commands.test.ts` | ❌ Wave 0 — extend existing file |
| MARK-03 | EditMarkupCommand clears redoStack on new edit | unit | `npx vitest run src/tests/markup-commands.test.ts` | ❌ Wave 0 — extend existing file |
| MARK-03 | MarkupNamePopup mode='edit' renders 'Edit Markup' header, 'Save Changes' primary, 'Discard Changes' secondary | unit (jsdom) | `npx vitest run src/tests/markup-namepopup.test.ts` | ❌ Wave 0 — extend existing file |
| MARK-03 | MarkupNamePopup mode='edit' pre-fills name/categoryName/color from props | unit (jsdom) | `npx vitest run src/tests/markup-namepopup.test.ts` | ❌ Wave 0 — extend existing file |
| MARK-03 | D-13 canonical substitution: handleConfirm substitutes canonical name when findCategoryByName returns a match | unit (jsdom) | `npx vitest run src/tests/markup-namepopup.test.ts` | ❌ Wave 0 — extend existing file |
| MARK-03 | MarkupContextMenu renders 'Edit' as first item with correct callback structure | unit (jsdom) | `npx vitest run src/tests/markup-context-menu.test.ts` | ❌ Wave 0 — extend existing file |
| VIEW-01 | TotalsPanel grand-total bar is absent (data-testid not found) | unit (jsdom) | `npx vitest run src/tests/totals-panel-render.test.ts` | ❌ Wave 0 — update existing test (Landmine 7) |
| VIEW-01 | TotalsCategoryBlock renders no subtotal rows (data-testid="totals-subtotal-row" absent) | unit (jsdom) | `npx vitest run src/tests/totals-panel-category-collapse.test.ts` | ❌ Wave 0 — add assertion or update existing test |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/tests/markup-commands.test.ts` — extend with EditMarkupCommand execute/undo/redo suite (mirrors existing place/undo symmetry tests)
- [ ] `src/tests/markup-namepopup.test.ts` — extend with `mode='edit'` render tests and D-13 canonical substitution test
- [ ] `src/tests/markup-context-menu.test.ts` — extend with 'Edit' first-item and `onEdit` callback tests
- [ ] `src/tests/totals-panel-render.test.ts` — update: the existing `'grand-total bar shows per-UoM totals at the bottom'` test (line 237) asserts the bar IS present; after D-08 it must assert the bar is ABSENT (Landmine 7)
- [ ] `src/tests/totals-panel-category-collapse.test.ts` — check for and update any existing `totals-subtotal-row` assertions after D-09

**Important:** All new test files follow the `.test.ts` extension convention (not `.test.tsx`). Use `React.createElement` instead of JSX. Apply `/** @vitest-environment jsdom */` header for render tests. Install the localStorage polyfill in `beforeEach` for any tests that render TotalsPanel (per STATE.md pattern).

---

## Security Domain

`security_enforcement` is not explicitly set to `false` in `.planning/config.json`. Applying the section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — no auth in this phase |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | Existing `name.trim() !== ''` guard in MarkupNamePopup; `findCategoryByName` uses `trim().toLowerCase()` — no injection surface (renderer-only data, no IPC mutation from Phase 7 changes) |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via markup name rendered in React | Tampering | React's JSX renders text as text nodes by default — no `dangerouslySetInnerHTML` in Phase 7 code |
| State mutation bypass (edit without undo) | Tampering | EditMarkupCommand always goes through `pushCommand` + `executeCommand` — no direct `set()` mutation of markup fields bypassing the undo stack |
| Category dedup bypass (confirm with unresolved typo) | Tampering | D-13 canonical substitution runs in `handleConfirm` before `onConfirm` is called — cannot be bypassed by keyboard shortcuts (Enter calls `handleConfirm`, not `onConfirm` directly) |

**No new attack surface is introduced.** All Phase 7 changes are read-mutate-within-renderer-process operations with no new IPC channels.

---

## Sources

### Primary (HIGH confidence — verified by codebase inspection)
- `src/renderer/src/components/CanvasViewport.tsx` — lines 74–538; containerRef div, ResizeObserver effect, root div style, contextMenu state
- `src/renderer/src/components/MarkupContextMenu.tsx` — full file; props shape, defer-listener pattern, Delete button structure
- `src/renderer/src/components/MarkupNamePopup.tsx` — full file; mode union, handleConfirm, cancelLabel, aria-label, wrapper onKeyDown
- `src/renderer/src/stores/markupStore.ts` — full file; MarkupCommand dispatch via placeMarkup/deleteMarkup/recolorGroup inline pattern, undo/redo switch structure
- `src/renderer/src/types/markup.ts` — full file; MarkupCommand union, BaseMarkup fields
- `src/renderer/src/components/TotalsPanel.tsx` — full file; grand-total bar block lines 282–323
- `src/renderer/src/components/TotalsCategoryBlock.tsx` — full file; subtotal rows block lines 142–188
- `src/renderer/src/components/CalibrationDialog.tsx` — full file; overlay structure, native select, Cancel button
- `src/renderer/src/components/CategoryAutocomplete.tsx` — full file; query filtering, onMouseDown pattern, no keyboard nav
- `src/renderer/src/App.tsx` — lines 250–270; CanvasViewport parent div flex structure
- `src/tests/markup-commands.test.ts` — full file; existing test patterns for new EditMarkupCommand tests
- `src/tests/markup-context-menu.test.ts` — full file; render harness pattern
- `src/tests/markup-namepopup.test.ts` — full file; React.createElement test pattern
- `src/tests/totals-panel-render.test.ts` — full file; grand-total bar assertion that will break after D-08
- `vitest.config.ts` — test infrastructure, include glob, alias

### Secondary (HIGH confidence — project documentation)
- `.planning/phases/07-canvas-workspace-ux-and-markup-fixes/07-CONTEXT.md` — locked decisions D-01 through D-13
- `.planning/phases/07-canvas-workspace-ux-and-markup-fixes/07-UI-SPEC.md` — approved visual/interaction contract
- `.planning/STATE.md` — key decisions: MarkupCommand pattern, parent-owned lifecycle, zoom-compensated overlays
- `.planning/REQUIREMENTS.md` — MARK-03, VIEW-01, UI-01 requirement text

---

## Metadata

**Confidence breakdown:**
- Canvas gutter fix (D-01/D-02): HIGH — root cause confirmed by direct code inspection; fix pattern is CSS fundamentals
- Post-commit editing (D-04–D-07): HIGH — EditMarkupCommand shape fully derivable from existing patterns; all integration points identified; 4 landmines documented
- Totals panel cleanup (D-08/D-09): HIGH — exact line ranges verified; one breaking test identified and documented
- CalibrationDialog fix (D-11): HIGH — overlay structure confirmed; `isolation: isolate` supported in Chromium 134 since Chrome 87; label change confirmed
- Category dedup (D-12/D-13): HIGH — `CategoryAutocomplete` has no keyboard nav today (confirmed); blur-race pattern confirmed; canonical substitution call site is a 3-line change

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable codebase — no external library churn; internal code only)
