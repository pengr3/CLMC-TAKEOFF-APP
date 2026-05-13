# Phase 7: Canvas Workspace UX and Markup Editing Fixes - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 14 (10 source + 4 test)
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/renderer/src/components/CanvasViewport.tsx` | component | event-driven | `CanvasViewport.tsx` itself (self-referential CSS + state wiring) | exact |
| `src/renderer/src/components/MarkupContextMenu.tsx` | component | request-response | `MarkupContextMenu.tsx` Delete button (existing menuitem) | exact |
| `src/renderer/src/components/MarkupNamePopup.tsx` | component | request-response | `MarkupNamePopup.tsx` mode `'count-pre'`/`'save-after'` (existing modes) | exact |
| `src/renderer/src/stores/markupStore.ts` | store | CRUD | `recolorGroup` action + `undo()`/`redo()` switch (existing patterns) | exact |
| `src/renderer/src/types/markup.ts` | model | — | Existing `MarkupCommand` union (`recolor-group` discriminant) | exact |
| `src/renderer/src/components/TotalsPanel.tsx` | component | CRUD | `TotalsPanel.tsx` itself (deletion target identified at lines 282–323) | exact |
| `src/renderer/src/components/TotalsCategoryBlock.tsx` | component | CRUD | `TotalsCategoryBlock.tsx` itself (deletion target identified at lines 142–188) | exact |
| `src/renderer/src/components/CalibrationDialog.tsx` | component | request-response | `CalibrationDialog.tsx` itself (button label + overlay CSS) | exact |
| `src/renderer/src/components/CategoryAutocomplete.tsx` | component | event-driven | `CategoryAutocomplete.tsx` `onMouseDown` selection pattern | exact |
| `src/tests/markup-commands.test.ts` | test | — | Existing `recolorGroup` describe block + place/undo symmetry blocks | exact |
| `src/tests/markup-namepopup.test.ts` | test | — | Existing `mode='count-pre'` describe blocks + `mount()` harness | exact |
| `src/tests/markup-context-menu.test.ts` | test | — | Existing Delete button test + `onClose` callback test | exact |
| `src/tests/totals-panel-render.test.ts` | test | — | Existing `'grand-total bar shows...'` test (line 237) to invert | exact |
| `src/tests/totals-panel-category-collapse.test.ts` | test | — | Existing `'renders heading + items + subtotal expanded...'` (line 105) | exact |

---

## Pattern Assignments

### `src/renderer/src/components/CanvasViewport.tsx` — D-02 CSS fix + D-04 onEdit wiring

**Analog:** `CanvasViewport.tsx` itself

**D-02: Root div CSS change** (lines 526–538):
```typescript
// BEFORE (line 528–530):
style={{
  width: '100%',
  height: '100%',
  backgroundColor: '#141414',
  backgroundImage: 'radial-gradient(circle, #1e1e1e 1px, transparent 1px)',
  backgroundSize: '20px 20px',
  overflow: 'hidden',
  cursor: getCursor(),
  position: 'relative'
}}

// AFTER — replace ONLY width/height with position/inset; all other props unchanged:
style={{
  position: 'absolute',
  inset: 0,
  backgroundColor: '#141414',
  backgroundImage: 'radial-gradient(circle, #1e1e1e 1px, transparent 1px)',
  backgroundSize: '20px 20px',
  overflow: 'hidden',
  cursor: getCursor(),
  position: 'relative'   // NOTE: keep existing 'relative' — it's needed for absolute children
}}
```

**IMPORTANT:** The existing style object has `position: 'relative'` at line 537. The fix replaces `width: '100%'` and `height: '100%'` with `position: 'absolute'` and `inset: 0`. The final style must have `position: 'absolute'` (not both — the last wins in a JS object; remove `position: 'relative'` when adding `position: 'absolute'` and `inset: 0`).

**D-04: Edit popup state — mirror contextMenu state pattern** (lines 198, 219–228):
```typescript
// Existing contextMenu state — add a parallel editPopup state alongside it
const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
// ADD:
const [editPopup, setEditPopup] = useState<{ id: string; x: number; y: number } | null>(null)
```

**D-04: Edit popup mount — mirror the save-after MarkupNamePopup block** (lines 846–959):
```typescript
// Existing contextMenu render block (lines 946–958) — add onEdit prop:
{contextMenu && contextMarkup && (
  <MarkupContextMenu
    screenPos={{ x: contextMenu.x, y: contextMenu.y }}
    currentColor={contextMarkup.color}
    onRecolor={(hex) => { useMarkupStore.getState().recolorGroup(contextMarkup.name, hex) }}
    onDelete={() => { useMarkupStore.getState().deleteMarkup(contextMarkup.page, contextMarkup.id) }}
    onEdit={() => {                           // ADD THIS
      const rect = containerRef.current!.getBoundingClientRect()
      setEditPopup({
        id: contextMenu.id,
        x: contextMenu.x - rect.left,        // convert viewport-space to container-relative
        y: contextMenu.y - rect.top
      })
      setContextMenu(null)
    }}
    onClose={() => setContextMenu(null)}
  />
)}

// ADD: edit popup mount — after the contextMenu block:
{editPopup && (() => {
  const target = pageMarkups.find((m) => m.id === editPopup.id)
  const cat = target ? useMarkupStore.getState().getCategory(target.categoryId) : null
  return target ? (
    <MarkupNamePopup
      mode="edit"
      screenPos={{ x: editPopup.x, y: editPopup.y }}
      containerSize={containerSize}
      initialName={target.name}
      initialCategoryName={cat?.name ?? ''}
      initialColor={target.color}
      onConfirm={({ name, categoryName, color }) => {
        const cat2 = useMarkupStore.getState().getCategory(target.categoryId)
        useMarkupStore.getState().editMarkup(
          target.id, target.page,
          target.name, cat2?.name ?? '', target.color,
          name, categoryName, color
        )
        setEditPopup(null)
      }}
      onCancel={() => setEditPopup(null)}
    />
  ) : null
})()}
```

---

### `src/renderer/src/components/MarkupContextMenu.tsx` — add Edit menuitem (D-04)

**Analog:** Existing Delete button (lines 113–141)

**Props interface extension** (lines 5–11):
```typescript
// BEFORE:
export interface MarkupContextMenuProps {
  screenPos: { x: number; y: number }
  currentColor: string
  onRecolor: (hex: string) => void
  onDelete: () => void
  onClose: () => void
}

// AFTER — add onEdit:
export interface MarkupContextMenuProps {
  screenPos: { x: number; y: number }
  currentColor: string
  onRecolor: (hex: string) => void
  onDelete: () => void
  onEdit: () => void      // ADD
  onClose: () => void
}
```

**Edit button — copy Delete button pattern, insert BEFORE the separator** (lines 112–141):
```typescript
// Insert before the <div style={{ height: 1, ... }} /> separator at line 112:
<button
  type="button"
  role="menuitem"
  onClick={() => {
    onEdit()    // onEdit is responsible for closing the context menu (calls onClose internally)
    onClose()
  }}
  style={{
    width: '100%',
    height: 28,
    padding: '4px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: 400,
    textAlign: 'left',
    cursor: 'pointer'
  }}
  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
>
  Edit
</button>
```

**Position:** Edit button is inserted as the FIRST item, before the separator and before Delete. The UI-SPEC requires it as the first item since it is the most common post-commit action.

---

### `src/renderer/src/components/MarkupNamePopup.tsx` — add mode='edit' + D-13 canonical substitution

**Analog:** Existing `'count-pre'` / `'save-after'` modes

**Props interface extension** (lines 10–26):
```typescript
// BEFORE:
export interface MarkupNamePopupProps {
  mode: 'count-pre' | 'save-after'
  ...
}

// AFTER — add 'edit' to the union:
export interface MarkupNamePopupProps {
  mode: 'count-pre' | 'save-after' | 'edit'
  ...
}
```

**Mode-conditional labels — extend the existing ternary pattern** (lines 111–112):
```typescript
// BEFORE (line 111):
const primaryCta = mode === 'count-pre' ? 'Start Count' : 'Save Markup'
const cancelLabel = 'Discard'

// AFTER:
const primaryCta = mode === 'count-pre' ? 'Start Count' : mode === 'edit' ? 'Save Changes' : 'Save Markup'
const cancelLabel = mode === 'edit' ? 'Discard Changes' : 'Discard'
```

**aria-label — extend the existing ternary** (line 151):
```typescript
// BEFORE:
aria-label={mode === 'count-pre' ? 'Name count item' : 'Save markup'}

// AFTER:
aria-label={mode === 'count-pre' ? 'Name count item' : mode === 'edit' ? 'Edit markup' : 'Save markup'}
```

**D-13 canonical substitution in handleConfirm — add findCategoryByName call** (lines 88–99):
```typescript
// Add findCategoryByName subscription alongside existing store subscriptions:
const findCategoryByName = useMarkupStore((s) => s.findCategoryByName)  // ADD (line 65 area)

// BEFORE handleConfirm (lines 88–99):
const handleConfirm = useCallback((): void => {
  const trimmedName = name.trim()
  if (trimmedName === '') {
    setNameError('Enter an item name')
    return
  }
  onConfirm({
    name: trimmedName,
    categoryName: categoryName.trim(),
    color: selectedColor
  })
}, [name, categoryName, selectedColor, onConfirm])

// AFTER — add canonical substitution before onConfirm call:
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

**D-12 keyboard navigation on category input — add onKeyDown with stopPropagation** (lines 174–188):

The category `<input>` (line 174) currently has no `onKeyDown`. The wrapper div at line 152 intercepts ALL Enter events via `handleKeyDown`. The new keyboard handler on the input must `stopPropagation` when it consumes Enter.

```typescript
// State addition (alongside existing useState calls):
const [highlightedIndex, setHighlightedIndex] = useState(-1)

// Category input onKeyDown (add to the <input> at line 174):
onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
  if (!showCategoryList) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    // highlightedIndex increment is handled by CategoryAutocomplete via prop
    setHighlightedIndex((i) => i + 1)   // clamping done in CategoryAutocomplete
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    setHighlightedIndex((i) => Math.max(-1, i - 1))
  } else if (e.key === 'Enter' && highlightedIndex >= 0) {
    e.preventDefault()
    e.stopPropagation()   // CRITICAL: prevents wrapper div's handleKeyDown from firing
    // CategoryAutocomplete calls onSelect when highlightedIndex matches
    // Pass selection up — CategoryAutocomplete exposes this via its onSelectByIndex prop
  }
}}

// Pass highlightedIndex to CategoryAutocomplete (add prop):
<CategoryAutocomplete
  query={categoryName}
  highlightedIndex={highlightedIndex}
  onHighlightChange={setHighlightedIndex}
  onSelect={(selected) => {
    setCategoryName(selected)
    setShowCategoryList(false)
    setHighlightedIndex(-1)
  }}
/>
```

---

### `src/renderer/src/components/CategoryAutocomplete.tsx` — add keyboard navigation (D-12)

**Analog:** Existing `onMouseDown + e.preventDefault()` selection pattern (lines 64, 76)

**Props interface extension:**
```typescript
// BEFORE:
export interface CategoryAutocompleteProps {
  query: string
  onSelect: (categoryName: string) => void
}

// AFTER — add controlled highlight state:
export interface CategoryAutocompleteProps {
  query: string
  onSelect: (categoryName: string) => void
  highlightedIndex?: number        // ADD — -1 means nothing highlighted
  onHighlightChange?: (i: number) => void  // ADD — called on keyboard nav
}
```

**Highlight visual on each row — extend existing itemStyle + onMouseEnter pattern:**
```typescript
// In the filtered.map() block, extend each row div:
<div
  key={cat.id}
  role="option"
  aria-selected={highlightedIndex === idx}
  data-highlighted={highlightedIndex === idx ? 'true' : undefined}
  onMouseDown={(e) => { e.preventDefault(); onSelect(cat.name) }}
  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background =
      highlightedIndex === idx ? COLORS.hoverSurface : 'transparent'
  }}
  style={{
    ...itemStyle,
    background: highlightedIndex === idx ? COLORS.hoverSurface : 'transparent'
  }}
>
  <span>{cat.name}</span>
</div>
```

**Clamp highlightedIndex to list length — in the component body:**
```typescript
// Total option count (filtered + optional create-option):
const optionCount = filtered.length + (showCreateOption ? 1 : 0)
// Clamp on receipt:
const clampedIndex = highlightedIndex !== undefined && highlightedIndex >= optionCount
  ? optionCount - 1
  : (highlightedIndex ?? -1)
```

**scrollIntoView for keyboard highlight — useEffect watching highlightedIndex:**
```typescript
useEffect(() => {
  if (clampedIndex < 0) return
  const highlighted = document.querySelector('[data-highlighted="true"]') as HTMLElement | null
  highlighted?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
}, [clampedIndex])
```

---

### `src/renderer/src/stores/markupStore.ts` — add editMarkup action (D-07)

**Analog:** `recolorGroup` action (lines 113–149) and `undo()`/`redo()` `recolor-group` branches (lines 170–186, 209–224)

**Interface declaration — add editMarkup signature** (lines 6–36):
```typescript
// Add to MarkupStoreState interface alongside existing action signatures:
editMarkup: (
  markupId: string,
  page: number,
  oldName: string,
  oldCategoryName: string,
  oldColor: string,
  newName: string,
  newCategoryName: string,
  newColor: string
) => void
```

**editMarkup action implementation — follow recolorGroup pattern:**
```typescript
// Call getOrCreateCategory BEFORE set() to avoid nested set() calls (Open Question resolved):
editMarkup: (markupId, page, oldName, oldCategoryName, oldColor, newName, newCategoryName, newColor) => {
  // Resolve category BEFORE entering set() — avoids nested set() calls
  const newCat = get().getOrCreateCategory(newCategoryName)
  set((s) => {
    const pageList = s.pageMarkups[page] ?? []
    const target = pageList.find((m) => m.id === markupId)
    if (!target) return s   // defensive no-op (mirrors deleteMarkup pattern at line 105)

    const updated: Markup = { ...target, name: newName, categoryId: newCat.id, color: newColor }
    const nextPageList = pageList.map((m) => m.id === markupId ? updated : m)

    const cmd: MarkupCommand = {
      type: 'edit-markup',
      markupId,
      page,
      oldName,
      oldCategoryName,
      oldColor,
      newName,
      newCategoryName,
      newColor
    }
    return {
      pageMarkups: { ...s.pageMarkups, [page]: nextPageList },
      undoStack: pushCommand(s.undoStack, cmd),
      redoStack: []
    }
  })
},
```

**undo() — add 'edit-markup' branch BEFORE the existing `cmd.markup.page` fallthrough** (after line 187):

The existing undo() has an early-return for `'recolor-group'` at line 170, then falls through to `cmd.markup.page` at line 189. The new branch must be inserted between these two:

```typescript
// In undo() — ADD after the recolor-group return (after line 186), BEFORE cmd.markup.page:
if (cmd.type === 'edit-markup') {
  const oldCat = get().getOrCreateCategory(cmd.oldCategoryName)
  const pageList = s.pageMarkups[cmd.page] ?? []
  const nextList = pageList.map((m) =>
    m.id === cmd.markupId
      ? { ...m, name: cmd.oldName, categoryId: oldCat.id, color: cmd.oldColor } as Markup
      : m
  )
  return {
    pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
    undoStack: s.undoStack.slice(0, -1),
    redoStack: [...s.redoStack, cmd]
  }
}
```

**redo() — add 'edit-markup' branch BEFORE the existing `cmd.markup.page` fallthrough** (after line 224):

```typescript
// In redo() — ADD after the recolor-group return (after line 223), BEFORE cmd.markup.page:
if (cmd.type === 'edit-markup') {
  const newCat = get().getOrCreateCategory(cmd.newCategoryName)
  const pageList = s.pageMarkups[cmd.page] ?? []
  const nextList = pageList.map((m) =>
    m.id === cmd.markupId
      ? { ...m, name: cmd.newName, categoryId: newCat.id, color: cmd.newColor } as Markup
      : m
  )
  return {
    pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
    undoStack: pushCommand(s.undoStack, cmd),
    redoStack: s.redoStack.slice(0, -1)
  }
}
```

**CRITICAL — Landmine 1:** `undo()` at line 189 does `const page = cmd.markup.page`. After adding the `'edit-markup'` branch above with an early `return`, TypeScript narrows `cmd` to `{ type: 'place' | 'delete', markup: Markup }` for the fallthrough code, which is correct. The guard must explicitly `return` to prevent fallthrough.

---

### `src/renderer/src/types/markup.ts` — extend MarkupCommand union (D-07)

**Analog:** Existing `recolor-group` discriminant (lines 48–55)

**Union extension** (lines 45–55):
```typescript
// BEFORE — current union (lines 45–55):
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

// AFTER — append edit-markup variant:
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
      oldCategoryName: string   // string NAME, not ID — see Pitfall 2 in RESEARCH.md
      oldColor: string
      newName: string
      newCategoryName: string
      newColor: string
    }
```

---

### `src/renderer/src/components/TotalsPanel.tsx` — delete grand-total bar block (D-08)

**Target:** Lines 282–323 — the entire `{emptyMsg === null && (<div data-testid="totals-panel-grand-total" ...>...</div>)}` conditional block.

**Exact deletion boundary** (lines 282–323):
```typescript
// DELETE this entire block — do not modify anything else:
{/* Pinned grand-total bar (rendered only when there is a real BoqStructure to summarize). */}
{emptyMsg === null && (
  <div
    data-testid="totals-panel-grand-total"
    style={{ ... }}
  >
    <span ...>Total</span>
    <span ...>
      {boq.grandTotals.map((g) => (
        <span key={g.uom} data-testid="totals-panel-grand-total-entry">
          {g.total.toFixed(2)} {g.uom}
        </span>
      ))}
    </span>
  </div>
)}
```

The closing `</div>` at line 324 closes the outer panel div — do NOT delete it.

---

### `src/renderer/src/components/TotalsCategoryBlock.tsx` — delete subtotal rows block (D-09)

**Target:** Lines 142–188 — the entire `{category.subtotals.map(...)}` block inside the `{!isCollapsed && (<>...</>)}` fragment.

**Exact deletion boundary** (lines 142–189):
```typescript
// DELETE this block — items.map() block above (lines 125–140) is preserved:
{/* Subtotal rows — one per distinct UoM in this category (D-12). */}
{category.subtotals.map((sub) => (
  <div
    key={sub.uom}
    role="row"
    data-testid="totals-subtotal-row"
    data-subtotal-uom={sub.uom}
    style={{ ... }}
  >
    ...
  </div>
))}
```

The `</>` fragment closing tag at line 190 and the outer `{!isCollapsed && (...)}` structure are preserved.

---

### `src/renderer/src/components/CalibrationDialog.tsx` — fix dropdown overflow + rename Cancel (D-11)

**Analog:** CalibrationDialog.tsx itself

**D-11 dropdown fix — add `isolation: 'isolate'` to the overlay div** (lines 52–65):
```typescript
// The overlay div (line 52–65) — add isolation: 'isolate':
<div
  style={{
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    isolation: 'isolate'   // ADD — creates new stacking context, dropdown escapes clip
  }}
  onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
>
```

**D-11 Cancel → Discard Scale rename** (line 175):
```typescript
// BEFORE (line 175):
Cancel

// AFTER:
Discard Scale
```

---

## Test Pattern Assignments

### `src/tests/markup-commands.test.ts` — extend with EditMarkupCommand tests

**Analog:** Existing `describe('place/undo symmetry', ...)` block (lines 30–53) and `describe('category persistence across undo...', ...)` block (lines 239–261)

**Test file conventions** (lines 1–14):
```typescript
// Same imports + beforeEach reset pattern:
import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup } from '@renderer/types/markup'

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
})
```

**New describe blocks to add — follow existing symmetry pattern:**
```typescript
describe('editMarkup/undo symmetry', () => {
  it('editMarkup changes name/categoryId/color and pushes cmd to undoStack', () => { ... })
  it('undo() reverts to oldName/oldCategory/oldColor; redoStack has one entry', () => { ... })
  it('redo() re-applies newName/newCategory/newColor; undoStack has one entry', () => { ... })
  it('editMarkup clears redoStack (mirrors placeMarkup pattern)', () => { ... })
  it('editMarkup on nonexistent markupId is a no-op (does not push cmd)', () => { ... })
})

describe('editMarkup canonical category (D-13 store side)', () => {
  it('edit to existing category name reuses the category (no duplicate created)', () => { ... })
  it('edit to new category name creates the category', () => { ... })
  it('undo after edit to new category restores original categoryId', () => { ... })
})
```

**Helper for tests — editMarkup requires a pre-placed markup with a real category:**
```typescript
// Mirrors existing makeCount + getOrCreateCategory pattern from 'category persistence' tests:
const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
const m = makeCount(1, 'Switch', 1, cat.id)
useMarkupStore.getState().placeMarkup(m)
// Then call editMarkup:
useMarkupStore.getState().editMarkup(
  m.id, 1,
  'Switch', 'Electrical', '#dc2626',
  'Outlet', 'Electrical', '#0078d4'
)
```

---

### `src/tests/markup-namepopup.test.ts` — extend with mode='edit' + D-13 tests

**Analog:** Existing `describe('MarkupNamePopup — color swatch row (D-26)', ...)` (lines 74–147) — same `mount()` harness and `React.createElement` pattern

**File header conventions** (lines 1–16 — exact, copy verbatim):
```typescript
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MarkupNamePopup } from '@renderer/components/MarkupNamePopup'
import { useMarkupStore } from '@renderer/stores/markupStore'
```

**New describe blocks to add:**
```typescript
describe("MarkupNamePopup — mode='edit' labels (D-06)", () => {
  it("renders 'Edit markup' aria-label in edit mode", () => {
    // querySelector('[role="dialog"]').getAttribute('aria-label') === 'Edit markup'
  })
  it("primary button reads 'Save Changes' in edit mode", () => {
    // find button textContent === 'Save Changes'
  })
  it("cancel button reads 'Discard Changes' in edit mode", () => {
    // find button textContent === 'Discard Changes'
  })
  it("pre-fills name/categoryName/color from initialName/initialCategoryName/initialColor props", () => {
    // mount with initialName='Switch', initialCategoryName='Electrical', initialColor=MARKUP_PALETTE[3]
    // assert input values and aria-checked swatch
  })
  it("no measurementPreview section rendered in edit mode", () => {
    // assert no measurement preview div exists
  })
})

describe('MarkupNamePopup — D-13 canonical substitution', () => {
  it('handleConfirm substitutes canonical name when findCategoryByName returns a match', () => {
    // Seed store with category 'Electrical' (canonical casing)
    // Mount popup with initialCategoryName='electrical' (wrong case)
    // Click Save Changes — onConfirm should receive categoryName='Electrical'
  })
  it('handleConfirm uses typed name verbatim when no case-insensitive match exists', () => {
    // No seeded categories
    // onConfirm should receive categoryName='Plumbing' (unchanged)
  })
})
```

**React.createElement pattern for edit mode (mirrors line 160):**
```typescript
React.createElement(MarkupNamePopup, {
  mode: 'edit' as const,
  screenPos: { x: 100, y: 100 },
  containerSize: { width: 1000, height: 800 },
  initialName: 'Switch',
  initialCategoryName: 'Electrical',
  initialColor: MARKUP_PALETTE[3],
  onConfirm: vi.fn(),
  onCancel: vi.fn()
})
```

---

### `src/tests/markup-context-menu.test.ts` — extend with Edit item tests

**Analog:** Existing Delete button test (lines 134–154) — exact same pattern

**New describe block to add inside existing `'MarkupContextMenu — structure...'` block:**
```typescript
it('renders Edit button as first menuitem before Delete', () => {
  // All menuitems: first should be 'Edit', last should be 'Delete'
  const menuitems = Array.from(container.querySelectorAll('[role="menuitem"]'))
  expect(menuitems[0].textContent).toBe('Edit')
  expect(menuitems[menuitems.length - 1].textContent).toBe('Delete')
})

it('clicking Edit calls onEdit then onClose', () => {
  const onEdit = vi.fn()
  const onClose = vi.fn()
  // mount with onEdit prop...
  const editBtn = Array.from(container.querySelectorAll('[role="menuitem"]')).find(
    (b) => b.textContent === 'Edit'
  ) as HTMLButtonElement
  act(() => { editBtn.click() })
  expect(onEdit).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})
```

**Props for tests with onEdit** (extend existing `baseProps`):
```typescript
// Existing baseProps (lines 56–59) — tests that mount must now include onEdit:
const basePropsWithEdit = {
  ...baseProps,
  onRecolor: vi.fn(),
  onDelete: vi.fn(),
  onEdit: vi.fn(),     // ADD
  onClose: vi.fn()
}
```

---

### `src/tests/totals-panel-render.test.ts` — update grand-total bar assertion (Landmine 7)

**Target test:** `'grand-total bar shows per-UoM totals at the bottom'` (lines 237–269)

**Required change — invert the assertion** (lines 260–265):
```typescript
// BEFORE (lines 260–265):
const bar = container.querySelector('[data-testid="totals-panel-grand-total"]')
expect(bar).not.toBeNull()
expect(bar!.textContent).toContain('Total')
expect(bar!.textContent).toContain('2.00')
expect(bar!.textContent).toContain('ea')

// AFTER — bar must be absent after D-08:
const bar = container.querySelector('[data-testid="totals-panel-grand-total"]')
expect(bar).toBeNull()   // regression guard — confirm bar is gone
```

The test's `it(...)` description should also be updated from `'grand-total bar shows per-UoM totals at the bottom'` to `'grand-total bar is absent (D-08 cleanup)'`.

---

### `src/tests/totals-panel-category-collapse.test.ts` — update subtotal row assertions (D-09)

**Target tests:** Any test that asserts `'totals-subtotal-row'` is present:

1. `'renders heading + items + subtotal expanded by default'` (lines 105–129) — asserts `expect(subtotal).not.toBeNull()` at line 123. **Change to:** `expect(subtotal).toBeNull()`

2. `'heading click toggles collapsed state — items disappear and reappear'` (lines 158–193) — asserts `expect(container.querySelector('[data-testid="totals-subtotal-row"]')).not.toBeNull()` at lines 169, 189. **Change both to:** `expect(container.querySelector('[data-testid="totals-subtotal-row"]')).toBeNull()`

3. The `fixtureCategory` at line 71 still includes `subtotals: [{ uom: 'ea', total: 17 }]` — keep this data in the fixture to verify that data presence does not cause rendering.

**Pattern for changed assertions:**
```typescript
// BEFORE:
const subtotal = container.querySelector('[data-testid="totals-subtotal-row"]')
expect(subtotal).not.toBeNull()
expect(subtotal!.textContent).toContain('Subtotal')

// AFTER:
const subtotal = container.querySelector('[data-testid="totals-subtotal-row"]')
expect(subtotal).toBeNull()   // D-09: subtotal rows removed from render
```

---

## Shared Patterns

### Inline-style dark theme
**Source:** `src/renderer/src/lib/constants.ts` — `COLORS.*` constants
**Apply to:** All new UI surfaces in Phase 7 (Edit button in context menu, edit-mode popup labels)
```typescript
// Pattern used everywhere — no Tailwind, no raw hex literals:
import { COLORS } from '../lib/constants'
// Usage:
color: COLORS.textPrimary
background: COLORS.secondary
border: `1px solid ${COLORS.border}`
background: COLORS.accent        // primary button
color: COLORS.textOnAccent       // text on accent button
background: COLORS.hoverSurface  // hover state
```

### onMouseEnter/onMouseLeave hover state
**Source:** `src/renderer/src/components/MarkupContextMenu.tsx` lines 133–137
**Apply to:** Edit button in MarkupContextMenu
```typescript
onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
```

### Defer listener registration (setTimeout 0)
**Source:** `src/renderer/src/components/MarkupContextMenu.tsx` lines 42–52
**Apply to:** No new outside-click listeners needed in Phase 7; existing pattern is preserved.
```typescript
// Do NOT add a new outside-click listener for the edit popup —
// MarkupNamePopup uses its own Escape/onCancel discipline (no outside-click).
const timer = setTimeout(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
}, 0)
```

### pushCommand helper for undo stack
**Source:** `src/renderer/src/stores/markupStore.ts` lines 38–41
**Apply to:** `editMarkup` action — use `pushCommand(s.undoStack, cmd)` exactly as all other actions do
```typescript
function pushCommand(stack: MarkupCommand[], cmd: MarkupCommand): MarkupCommand[] {
  const next = [...stack, cmd]
  return next.length > UNDO_STACK_MAX ? next.slice(next.length - UNDO_STACK_MAX) : next
}
```

### React.createElement test harness
**Source:** `src/tests/markup-context-menu.test.ts` lines 1–71
**Apply to:** All new test cases in markup-namepopup.test.ts, markup-context-menu.test.ts
```typescript
/** @vitest-environment jsdom */
// Always use React.createElement — no JSX in .test.ts files
// Always use the mount() helper from each test file
// Always call unmount() in try/finally
// Always reset document.body.innerHTML = '' in beforeEach
```

### localStorage polyfill
**Source:** `src/tests/totals-panel-category-collapse.test.ts` lines 24–44
**Apply to:** Any new TotalsPanel or TotalsCategoryBlock render tests (already present in existing files — do not add a second polyfill)

---

## No Analog Found

All 14 files have close analogs in the codebase. No file requires construction from scratch.

---

## Metadata

**Analog search scope:** `src/renderer/src/components/`, `src/renderer/src/stores/`, `src/renderer/src/types/`, `src/tests/`
**Files scanned:** 14 source files read directly + 2 test files for context
**Pattern extraction date:** 2026-05-13
