# Phase 17: Markup Rename and Reorder - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 19 (6 EXTEND stores/lib · 2 EXTEND/NEW hooks · 4 NEW components · 1 NEW helper · 6 EXTEND components)
**Analogs found:** 19 / 19 (every file has a verified in-repo analog — this is an unusually high analog-reuse phase; most EXTEND files copy a precedent that lives in the same file)

> All line numbers below were read live from the current `master` source this session and match the RESEARCH.md anchors. Excerpts are the *precedent to copy*, not the code to write.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/stores/markupStore.ts` (EXTEND) | store | event-driven (command stack) | `recolorGroup` + undo/redo reducers **(same file)** | exact (self) |
| `src/renderer/src/stores/projectStore.ts` (EXTEND) | store | CRUD (side-tables) | `setPrice` / `toggleHiddenItem` **(same file)** | exact (self) |
| `src/renderer/src/types/markup.ts` (EXTEND) | model (types) | — | `recolor-group` union variant **(same file)** | exact (self) |
| `src/renderer/src/lib/boq-aggregator.ts` (EXTEND) | service (transform) | batch / transform | `localeCompare` sort @ line 264 **(same file)** | exact (self) |
| `src/renderer/src/lib/project-serialize.ts` (EXTEND) | service | file-I/O | `rates` snapshot + hydrate-coerce **(same file)** | exact (self) |
| `src/renderer/src/lib/project-schema.ts` (EXTEND) | model (config) | file-I/O | `rates?` / `hiddenItemNames?` additive field **(same file)** | exact (self) |
| `src/renderer/src/lib/group-ops.ts` (**NEW**) | utility (pure) | transform | `nextCountSequence` + `getColorForName` (markupStore) | role-match |
| `src/renderer/src/hooks/useBoqLive.ts` (EXTEND) | hook | request-response | `rates`/`categoryOrder` selector+dep **(same file)** | exact (self) |
| `src/renderer/src/hooks/useRowReorder.ts` (**NEW**) | hook | event-driven (drag) | `Splitter.onPointerDown` + `useDraggable` | role+flow match |
| `src/renderer/src/components/GroupContextMenu.tsx` (**NEW**) | component (menu) | event-driven | `TotalsRowContextMenu.tsx` | exact |
| `src/renderer/src/components/GroupCategoryDialog.tsx` (**NEW**) | component (modal) | request-response | `DefaultMarkupChangeModal` + `CategoryAutocomplete` + `MarkupNamePopup` | exact (composed) |
| `src/renderer/src/components/InlineRenameInput.tsx` (**NEW**) | component (input) | event-driven | `EstimateRow` inline-edit recipe (184-247) | exact |
| `src/renderer/src/components/RenameCollisionMessage.tsx` (**NEW**) | component (presentational) | — | `BlockedCommitMessage.tsx` | exact |
| `src/renderer/src/components/TotalsRow.tsx` (EXTEND) | component (row) | event-driven | self: `handleContextMenu` / `Plus` hover / `itemKey` | exact (self) |
| `src/renderer/src/components/EstimateRow.tsx` (EXTEND) | component (row) | event-driven | `TotalsRow.handleContextMenu` (row has none today) | role-match |
| `src/renderer/src/components/TotalsCategoryBlock.tsx` (EXTEND) | component (block) | event-driven (drag) | self: `items.map` (111-128) + `useRowReorder` | exact (self) |
| `src/renderer/src/components/EstimateCategoryBlock.tsx` (EXTEND) | component (block) | event-driven (drag) | `TotalsCategoryBlock` (mirror) + `useRowReorder` | role-match |
| `src/renderer/src/components/TotalsPanel.tsx` (EXTEND) | component (container) | event-driven | self: context-menu state (85-89, 269-283) | exact (self) |
| `src/renderer/src/components/EstimatePanel.tsx` (EXTEND) | component (container) | event-driven | `TotalsPanel` menu host + self: `DefaultMarkupControl` modal host (204-211) | role-match |

**Export writers (`src/main/boq-writers.ts`) are deliberately NOT in this list.** They iterate `cat.items` in array order at **`boq-writers.ts:234`** (xlsx) and **`:424`** (csv); the manual order is baked into `BoqStructure` in the renderer before IPC, so the writers inherit it with **zero change**. See Shared Pattern F.

---

## Pattern Assignments

### `src/renderer/src/stores/markupStore.ts` (store, command stack) — EXTEND

**Analog:** `recolorGroup` + the `undo()`/`redo()` reducers, **same file**. This is the ONLY existing whole-group, multi-page, undoable command — the direct template for `renameGroup` / `moveGroup` / `copyGroup` / `duplicateGroup` / `reorderItems`.

**Whole-group scan + per-id payload + single push** (`markupStore.ts:230-266`) — mirror the "scan all pages by `.name`, record per-id old-state, push ONE command, clear redoStack" discipline:
```typescript
recolorGroup: (name, newColor, page) =>
  set((s) => {
    const pagesToScan = page !== undefined ? [page] : Object.keys(s.pageMarkups).map(Number)
    const oldColors: Record<string, string> = {}
    const idsAffected: string[] = []
    const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
    for (const p of pagesToScan) {
      const list = s.pageMarkups[p] ?? []
      nextPageMarkups[p] = list.map((m) => {
        if (m.name === name && m.color !== newColor) {
          oldColors[m.id] = m.color; idsAffected.push(m.id)
          return { ...m, color: newColor } as Markup
        }
        return m
      })
    }
    if (idsAffected.length === 0) return s
    const cmd: MarkupCommand = { type: 'recolor-group', name, newColor, oldColors, page, markupIdsAffected: idsAffected }
    return { pageMarkups: nextPageMarkups, undoStack: pushCommand(s.undoStack, cmd), redoStack: [] }
  }),
```

**"Resolve category BEFORE `set()`" idiom** (`markupStore.ts:268-270`) — `moveGroup`/`copyGroup` call `getOrCreateCategory(targetName)` OUTSIDE `set()` to avoid nested `set()`:
```typescript
editMarkup: (markupId, page, oldName, ...) => {
  const newCat = get().getOrCreateCategory(newCategoryName)   // resolve BEFORE set()
  set((s) => { ... })
}
```

**delete-group add/remove-by-id branch** (`markupStore.ts:215-228` forward; `:579-589` undo; `:727-738` redo) — the analog for copy/duplicate `newMarkups` add-on-redo / remove-on-undo, and for the id-set filtering pattern.

**Cross-store hook point — `undo()`/`redo()` are pure `set((s)=>{...})` today** (`markupStore.ts:471-619` / `:621-767`). RESEARCH Pattern 3 (Option C): refactor to an action body that calls `applyProjectUndo(cmd)` / `applyProjectRedo(cmd)` **before** the `set()`, so rename re-key + copy/dup rate revert atomically. Every new command adds a branch here, placed **before** the `const page = cmd.markup.page` fallthrough at `:606` / `:754` (it assumes a `cmd.markup` field the new commands lack — same guard note already written for `delete-group`/`move-markups`/`reopen-recommit`).

**`nextCountSequence`** (`:168-173`) — reference for copy/duplicate count-`sequence` assignment (Pitfall 6). NOTE it is max+1; the copy generator wants a fresh per-page 1..k counter under the new (unique) name.

**`hydrate` (772-781) + `reset` (783-792)** — add `categoryItemOrder` to both (mirror `categoryOrder`); the `hydrate` input type at `:114-118` gains `categoryItemOrder: Record<string,string[]>`.

**Error/guard convention:** defensive no-op `return s` on unknown id / empty input (`:207,217,251,274,309`). `pushCommand` caps at `UNDO_STACK_MAX=50` (`:122-125`).

---

### `src/renderer/src/stores/projectStore.ts` (store, side-tables) — EXTEND

**Analog:** `setPrice` / `toggleHiddenItem`, **same file** — the template for the NEW `reKeyRate` / `reKeyHidden` / `addBlankRate` / `removeRate` actions consumed by `applyProjectUndo/Redo`.

**`setPrice` — mutate `rates` then `markDirty()`** (`projectStore.ts:137-143`):
```typescript
setPrice: (key, patch) => {
  set((s) => {
    const cur = s.rates[key] ?? { material: 0, labor: 0, markup: DEFAULT_MARKUP_PCT }
    return { rates: { ...s.rates, [key]: { ...cur, ...patch } } }
  })
  get().markDirty()          // ← without this a rate would not survive Save
},
```
`addBlankRate(key)` seeds exactly `{ material: 0, labor: 0, markup: DEFAULT_MARKUP_PCT }` (D-07 blank rate); `removeRate(key)` deletes the key (copy/dup undo).

**`toggleHiddenItem` — array edit + Set rebuild** (`:122-131`) — `reKeyHidden` mirrors the `filter` + `new Set(next)` rebuild; **the key is the composite `name|categoryId`**, so re-key per categoryId (Shared Pattern G / Pitfall 1):
```typescript
toggleHiddenItem: (name) => {
  set((s) => {
    const idx = s.hiddenItemNames.indexOf(name)
    const next = idx >= 0 ? s.hiddenItemNames.filter((n) => n !== name) : [...s.hiddenItemNames, name]
    return { hiddenItemNames: next, hiddenItemSet: new Set(next) }   // rebuild derived Set
  })
  get().markDirty()
},
```

**Dirty tracking — extend the selector tuple** (`attachDirtyTracking`, `:170-177`): the markup subscription watches `[s.pageMarkups, s.categories, s.categoryOrder]`. **Add `s.categoryItemOrder`** so a reorder marks the project dirty:
```typescript
const unsubMarkup = useMarkupStore.subscribe(
  (s) => [s.pageMarkups, s.categories, s.categoryOrder] as const,   // ← add categoryItemOrder
  () => markDirty(),
  { equalityFn: shallowEqualArr }
)
```

**`reset` (110-120):** no change needed here for order (order lives in markupStore), but the rate/hidden helpers must not touch `_hydrating`-guarded `markDirty` (respected automatically by routing through `markDirty` at `:104-108`).

---

### `src/renderer/src/types/markup.ts` (model, discriminated union) — EXTEND

**Analog:** the `recolor-group` union variant, **same file** (`markup.ts:80-87`) — the shape template (per-id `markupIdsAffected` + captured old-state):
```typescript
| {
    type: 'recolor-group'
    name: string
    newColor: string
    oldColors: Record<string, string>   // per-id captured old state (undo)
    page?: number
    markupIdsAffected: string[]
  }
```
Add five variants after `:159` per RESEARCH Pattern 3 (`rename-group` carries `rateReKeys` / `hiddenReKeys` / `orderReKeys`; `move-group` carries `oldCategoryId`/`newCategoryId` + order remove/append; `copy-group` / `duplicate-group` carry `newMarkups: Markup[]` + `rateKey`/`rateEntry`; `reorder-items` carries `catKey`/`oldOrder`/`newOrder`). Import `PriceEntry` from `../lib/boq-types` for the rate payloads (mirrors how `move-vertex` reuses `StagePoint` at `:1`).

**Note:** the `move-vertex`/`reshape-arc` optional-arc fields (`:111-133`) show the house style for "field present only in a sub-case" — use the same optional-field discipline for order/rate sub-cases.

---

### `src/renderer/src/lib/boq-aggregator.ts` (service, transform) — EXTEND

**Analog:** the aggregator itself. The ONE line to replace (`boq-aggregator.ts:263-264`):
```typescript
// 2c. Alphabetical sort by post-suffix label (Claude's discretion confirmed)
items.sort((a, b) => a.label.localeCompare(b.label))
```

**Replacement** (RESEARCH Pattern 4) — sort the bucket ENTRIES by manual-order rank *before* building `items` (JS stable sort ⇒ unranked/new keys append in placement order). `catKey` is already in scope at `:198`; the bucket key `k = \`${name}|${type}\`` matches the order-array element exactly (built at `:122`):
```typescript
const order = categoryItemOrder[catKey] ?? []          // catKey = categoryId | '__uncat__'
const rank = new Map(order.map((k, i) => [k, i]))
const entries = [...bucket.entries()]                  // placement order
entries.sort((a, b) => (rank.get(a[0]) ?? Infinity) - (rank.get(b[0]) ?? Infinity))
for (const [k, acc] of entries) { /* build BoqItemRow as at :221-261 */ }
// DELETE items.sort(localeCompare) at :264
```

**getState-default + opts-injection idiom** (`:91` `categoryOrder`, `:96` `rates`) — read the new order the same way:
```typescript
const categoryOrder = opts.categoryOrder ?? useMarkupStore.getState().categoryOrder
// add:
const categoryItemOrder = opts.categoryItemOrder ?? useMarkupStore.getState().categoryItemOrder
```
`UNCAT_BUCKET_KEY = '__uncat__'` (`:19`) is the order-map key for uncategorized. Add `categoryItemOrder?` to `AggregateOptions` (see boq-types below).

---

### `src/renderer/src/lib/project-serialize.ts` (service, file-I/O) — EXTEND

**Analog:** the `rates` snapshot + coerce-hydrate, **same file** — the exact additive-field precedent.

**Snapshot — emit from the owning store** (`project-serialize.ts:58-64`):
```typescript
categories: markup.categories,
categoryOrder: markup.categoryOrder,          // ← categoryItemOrder rides right here
...
hiddenItemNames: useProjectStore.getState().hiddenItemNames,
rates: useProjectStore.getState().rates,
defaultMarkupPct: useProjectStore.getState().defaultMarkupPct
// add: categoryItemOrder: useMarkupStore.getState().categoryItemOrder
```

**Hydrate — defensive per-field coercion of untrusted disk** (`:128-149`, the `safeRates` block is the template). For order, accept only `Record<string,string[]>`, drop non-arrays, filter non-strings, default `{}`; never throw (Security V5). Feed it into `markupStore.hydrate({ ..., categoryItemOrder })` at `:98-102`:
```typescript
const rawOrder = (data as { categoryItemOrder?: unknown }).categoryItemOrder
const safeOrder: Record<string, string[]> = {}
if (rawOrder && typeof rawOrder === 'object') {
  for (const [k, v] of Object.entries(rawOrder as Record<string, unknown>))
    if (Array.isArray(v)) safeOrder[k] = v.filter((x): x is string => typeof x === 'string')
}
// pass into markupStore.hydrate({ pageMarkups, categories, categoryOrder, categoryItemOrder: safeOrder })
```

**Suspend/resume bracket** (`:78-79,172-177`) — the order write lands inside `markupStore.hydrate`, already inside the bracket; nothing extra needed to keep `isDirty=false` on open.

---

### `src/renderer/src/lib/project-schema.ts` (model, config) — EXTEND

**Analog:** the `rates?` / `hiddenItemNames?` / `defaultMarkupPct?` optional fields, **same file** (`project-schema.ts:88-108`) — all ride the trailing `return raw as ProjectFileV2` cast (`:139`) with **NO `validateV2` branch, NO `formatVersion` bump**:
```typescript
/** Additive in Phase 17 — absent in pre-Phase-17 files; defaults to {} on load.
 *  Per-category manual item order: categoryId (or '__uncat__') → ordered `name|type` keys.
 *  Rides the trailing `return raw as ProjectFileV2` cast like rates/hiddenItemNames. */
categoryItemOrder?: Record<string, string[]>
```
Do **not** add a check to `validateV2` (`:113-140`) — the field is intentionally unvalidated at the schema gate and sanitized at hydrate (matches `rates`/`hiddenItemNames`). `migrateV1ToV2` (`:151-167`) needs no change (old files → field absent → `{}`).

---

### `src/renderer/src/lib/group-ops.ts` (**NEW** — pure helpers) — utility

**No exact analog** (there is no existing pure name/snapshot helper module). Closest role-match precedents in `markupStore.ts`:
- **`nextCountSequence`** (`markupStore.ts:168-173`) — the "scan existing markups, derive next number" shape (contrast: it is max+1; `autoUniqueName` is **first-free** per SPEC).
- **`getColorForName`** (`:457-469`) — the "scan all pages for markups matching a name" shape, reused by copy/duplicate snapshot color (A2 = carry source color).
- **`getOrCreateCategory`** (`:175-191`) — copy's target-category resolution (call from the action, not inside `set()`).

Helpers to build (RESEARCH Pattern 5a/5c): `autoUniqueName(base, sourceTypes, allMarkups)` (first-free `"{name} (n)"`, n≥2, not colliding with a same-type name), `snapshotGroup(...)` (new `crypto.randomUUID()` ids + deep-cloned `point`/`points`/`arcs`), and the collision predicate (Pitfall 2 / A1: ∃ markup outside the rename set with `name===newName` && `type ∈ sourceTypes`). Keep it Node-testable (no store imports — take `allMarkups` as an arg, like `aggregateBoq`'s opts injection).

---

### `src/renderer/src/hooks/useBoqLive.ts` (hook, request-response) — EXTEND

**Analog:** the `rates` / `categoryOrder` selector+dep pair, **same file** — the exact template for wiring `categoryItemOrder` live (Pitfall 4: selector AND dep, or reorders render stale):
```typescript
const categoryOrder   = useMarkupStore((s) => s.categoryOrder)   // :37  primitive selector
const rates           = useProjectStore((s) => s.rates)          // :43
// add: const categoryItemOrder = useMarkupStore((s) => s.categoryItemOrder)
return useMemo(() => aggregateBoq({ ..., categoryOrder, rates, /* categoryItemOrder */ }),
  [pageMarkups, categories, categoryOrder, pageScales, globalUnit, totalPages, fileName, currentFilePath, rates, defaultMarkup])
//  ^ :64 — ADD categoryItemOrder to this dependency array
```
Anti-pattern (RESEARCH): never select a fresh object/array identity — select the stored `categoryItemOrder` reference directly (same reason `getColorForName` is read via `getState()` inside the memo, `:62`).

---

### `src/renderer/src/hooks/useRowReorder.ts` (**NEW** — shared drag lifecycle) — hook

**Analog:** `Splitter.onPointerDown` (`Splitter.tsx:59-85`) + `useDraggable` (`useDraggable.ts:48-105`) — the app's proven **window-listener** pointer-drag idiom (NO HTML5 DnD, NO new package). Extract the lifecycle once; both category blocks consume it.

**Window listeners registered on `pointerdown`, removed atomically on `pointerup`** (`Splitter.tsx:59-85`):
```typescript
const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
  e.preventDefault()
  const startX = e.clientX; const startWidth = panelWidth
  let lastWidth = startWidth
  const onMove = (ev: PointerEvent): void => { /* compute candidate; onDragWidth(next) */ }
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove)   // atomic cleanup (T-06-02-02)
    window.removeEventListener('pointerup', onUp)
    onCommit(lastWidth)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}, [...])
```
For reorder: `pointerdown` on the grip → `pointermove` computes the drop index from `e.clientY` vs each sibling row's `getBoundingClientRect()` midpoint → `pointerup` dispatches ONE `reorderItems(catKey, newOrder)`. `setPointerCapture(e.pointerId)` is available for robustness (`useDraggable.ts:62`, wrapped in try/catch for jsdom). Auto-scroll near edges: recompute rects per move (Pitfall 5). See Shared Pattern E.

---

### `src/renderer/src/components/GroupContextMenu.tsx` (**NEW** — menu) — component

**Analog:** `TotalsRowContextMenu.tsx` (whole file, 1:1). Copy the container chrome + the deferred-listener dismissal verbatim, add the four items above a separator; keep an optional trailing "Copy as text" slot for the totals surface only (D-01).

**Deferred-listener registration + outside-click/Escape** (`TotalsRowContextMenu.tsx:42-64`):
```typescript
useEffect(() => {
  const handleClickOutside = (e: MouseEvent): void => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
  }
  const handleKeyDown = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
  const timer = setTimeout(() => {                 // defer so the opening right-click doesn't self-close
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
  }, 0)
  return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleKeyDown) }
}, [onClose])
```
**Container + menuitem styling** (`:80-133`): `position:fixed; left/top:screenPos; padding:8; background:secondary; border:1px solid border; borderRadius:4; boxShadow:'0 4px 12px rgba(0,0,0,0.4)'; zIndex:30; gap:6; fontSize:13`. Menu item: `role="menuitem"; width:100%; height:28; padding:'4px 8px'; hover→hoverSurface`. UI-SPEC §1 says widen `minWidth` 160→180. Separator `<div style={{height:1, background:border, margin:'4px 0'}} />` (from `MarkupContextMenu`).

---

### `src/renderer/src/components/GroupCategoryDialog.tsx` (**NEW** — modal, mode 'move'|'copy') — component

**Analog (composed):** `DefaultMarkupChangeModal.tsx` (chrome) + `CategoryAutocomplete.tsx` (list) + `MarkupNamePopup.handleCategoryKeyDown` (arrow-nav guard).

**Modal chrome — backdrop, draggable dialog, ESC/Enter, backdrop-mousedown=Cancel, confirm auto-focus** (`DefaultMarkupChangeModal.tsx:38-105`):
```typescript
const confirmRef = useRef<HTMLButtonElement>(null)
useEffect(() => { confirmRef.current?.focus() }, [])
const { position, onPointerDown } = useDraggable()
const handleKey = (e) => { e.stopPropagation(); if (e.key==='Escape'){e.preventDefault();onCancel()} if (e.key==='Enter'){e.preventDefault();onConfirm()} }
const onBackdropMouseDown = (e) => { if (e.target === e.currentTarget) onCancel() }
// backdrop: position:fixed; inset:0; background:'rgba(0,0,0,0.5)'; flex-center; zIndex:120
// dialog:   width:420; padding:20; background:secondary; border; borderRadius:8; gap:12; + useDraggable transform
```
**Category type-ahead** — render `CategoryAutocomplete` beneath a name input; `onMouseDown`+`preventDefault` keeps the list open on select (`CategoryAutocomplete.tsx:99,122`); `getOrCreateCategory` resolves existing-or-new (called from the Confirm handler, not in a store `set()`).
**Arrow-nav + the Enter `stopPropagation` guard** so Enter selects a highlighted category instead of confirming the dialog (`MarkupNamePopup.tsx:140-171`, esp. `:156-159`). Copy mode shows the auto-name preview line (D-07); confirm labels "Move Group"/"Copy Group" (UI-SPEC §5).

---

### `src/renderer/src/components/InlineRenameInput.tsx` (**NEW** — inline editor) — component

**Analog:** the `EstimateRow` uncontrolled-input + native-listener recipe (`EstimateRow.tsx:184-247`), applied to a single name field. **NOT** React `onChange`/`onBlur` (React 19 value-tracker + `focusout`).

**Native blur/Enter commit + stopPropagation, re-bound on key** (`EstimateRow.tsx:184-205`):
```typescript
useEffect(() => {
  const el = materialRef.current; if (!el) return
  const onCommit = (): void => commitMaterial(el.value)
  const onKeyDown = (e: KeyboardEvent): void => { e.stopPropagation(); if (e.key === 'Enter') commitMaterial(el.value) }
  const onStop = (e: Event): void => e.stopPropagation()
  el.addEventListener('blur', onCommit); el.addEventListener('keydown', onKeyDown)
  el.addEventListener('click', onStop);  el.addEventListener('mousedown', onStop)
  return () => { /* remove all four */ }
}, [priceKey])
```
**Seed guard so mid-typing is never clobbered** (`:151-156`): `if (!el || document.activeElement === el) return` before re-seeding `el.value`. For rename: add `Escape`→cancel; blank/whitespace commit → cancel silently (D-03); on a commit that `renameGroup` reports as blocked, keep the input open and mount `RenameCollisionMessage` (D-04). Input visual per UI-SPEC §2 (height 22, `1px accent` border while editing, fontSize 13/left).

---

### `src/renderer/src/components/RenameCollisionMessage.tsx` (**NEW** — presentational) — component

**Analog:** `BlockedCommitMessage.tsx` (whole file). Copy the `role="alert" aria-live="assertive"` surface and the local `PROBLEM_RED` constant convention (keeps the "COLORS tokens only" rule intact):
```typescript
const PROBLEM_RED = '#dc2626'   // BlockedCommitMessage.tsx:6 — named const, not a COLORS token
// <div role="alert" aria-live="assertive" style={{ position:'absolute', background:COLORS.secondary,
//   border:`1px solid ${COLORS.border}`, borderRadius:4, boxShadow:'0 4px 12px rgba(0,0,0,0.4)',
//   zIndex:30, fontSize:13, lineHeight:1.4 }}>
//   <span style={{ color: PROBLEM_RED, fontWeight: 600 }}>A group named '{name}' already exists</span>
```
UI-SPEC §3 makes it MORE compact than BlockedCommitMessage: `padding:'8px 12px'`, `maxWidth:260`, `marginTop:4`, placed directly beneath the rename input (parent owns dismissal — no internal timer, mirrors the analog `:11`).

---

### `src/renderer/src/components/TotalsRow.tsx` (row) — EXTEND

**Analog:** self. Three seams already present:

**`onContextMenu` wiring** (`TotalsRow.tsx:186-189`) — already forwards cursor coords; the parent adds the four group items:
```typescript
const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>): void => {
  e.preventDefault(); onContextMenu(e.clientX, e.clientY)
}
```
**Hover-revealed affordance in a fixed-width slot** (`:306-313`, the `Plus`) — the exact template for the grip handle (render only while `bg !== 'transparent'`; fixed slot so nothing reflows). UI-SPEC §4 puts the grip in the leading 16px gutter instead:
```typescript
<div style={{ width: 20, flexShrink: 0, display:'flex', alignItems:'center', justifyContent:'center' }} title="Add more to this group">
  {bg !== 'transparent' && <Plus size={14} color={COLORS.textSecondary} />}
</div>
```
**Visibility key `name|categoryId`** (`:125-128`) — the rename re-key must migrate this composite (Pitfall 1); `toggleHiddenItem(itemKey)` at `:247` takes the composite, not the bare name.
**Double-click rename guard (D-02):** add `onDoubleClick` to open the editor; guard `handleClick` (`:158-185`) with an `e.detail === 2` early-return so the second click of a double-click does not cycle (perceived-perf is load-bearing per MEMORY). Import `GripVertical` from `lucide-react` (verified available; joins existing `Lightbulb`/`Plus` import at `:3`).

---

### `src/renderer/src/components/EstimateRow.tsx` (row) — EXTEND

**Analog:** `TotalsRow.handleContextMenu` (EstimateRow has NO context menu today). The row's cells already `stopPropagation` click/mousedown/keydown (`EstimateRow.tsx:192,276,341`) but **not `contextmenu`** — so a row-level `onContextMenu` on the grid `<div>` (`:296-313`) fires cleanly (D-01, UI-SPEC §2). The Item cell (`:315-317`) has no click handler, so double-click rename is clean (no `e.detail` guard needed here). Add the grip handle (same hover-reveal pattern as TotalsRow's `Plus`). `labelToName` is already imported (`:6`) and `priceKey` (`:104`) shows the `name|type` shape the rename re-key targets.

---

### `src/renderer/src/components/TotalsCategoryBlock.tsx` (block) — EXTEND

**Analog:** self. Owns the row list that gets the drag reorder + insertion line.

**Row map (drag reorders this array via aggregator output)** (`TotalsCategoryBlock.tsx:111-128`):
```typescript
{!isCollapsed && category.items.map((item) => (
  <TotalsRow key={item.label} item={item} ... onContextMenu={(x, y) => onRowContextMenu(item, x, y)} ... />
))}
```
Wire `useRowReorder(catKey, orderedKeys)` here: pass `onGripPointerDown` down to each `TotalsRow`, render the 2px accent insertion-line `<div>` between rows at the drop boundary, and apply the lifted-row treatment (UI-SPEC §4). `catKey` = `item.categoryId ?? '__uncat__'`. RESEARCH Open-Q 2: if a reorder flickers a neighbor's collision suffix, key rows by the stable `name|type` bucket key instead of `item.label`.

---

### `src/renderer/src/components/EstimateCategoryBlock.tsx` (block) — EXTEND

**Analog:** `TotalsCategoryBlock` (mirror) + its own `items.map` (`EstimateCategoryBlock.tsx:85-87`):
```typescript
{category.items.map((item) => (<EstimateRow key={item.label} item={item} />))}
```
Same `useRowReorder` wiring as the totals block. NOTE the Estimate grid is a dense 10-column `gridTemplateColumns` (`:97-99`, `height:30`) — the insertion line and lifted row use the SAME tokens; the grip sits in the leading gutter of `padding:'0 16px'` (`:103`). Extract the shared logic to `useRowReorder` so the two blocks don't diverge.

---

### `src/renderer/src/components/TotalsPanel.tsx` (container) — EXTEND

**Analog:** self. Already hosts a context menu via local state — the exact template for hosting `GroupContextMenu` + `GroupCategoryDialog` + collision state.

**Local menu state + routed handler + conditional mount** (`TotalsPanel.tsx:85-89`, `:156-159`, `:269-283`):
```typescript
const [contextMenuState, setContextMenuState] = useState<{ item: BoqItemRow; x: number; y: number } | null>(null)
const handleRowContextMenu = (item, x, y) => { setContextMenuState({ item, x, y }); onRowContextMenu?.(item, x, y) }
// ...
{contextMenuState !== null && (
  <TotalsRowContextMenu screenPos={{ x: contextMenuState.x, y: contextMenuState.y }} item={contextMenuState.item}
    onClose={() => setContextMenuState(null)} onCopy={...} onCopyError={...} />
)}
```
Add parallel `useState` for the Move/Copy dialog (`{ mode, item } | null`) and the active rename target, mounted the same conditional way. RESEARCH Open-Q 3: each panel hosts its own menu/dialog state; the components are shared. The `EMPTY_MARKUPS` stable-ref note (`:71-74`) is the reminder not to introduce fresh array/object selector identities.

---

### `src/renderer/src/components/EstimatePanel.tsx` (container) — EXTEND

**Analog:** `TotalsPanel` context-menu hosting (above) + its own modal-hosting precedent. EstimatePanel has NO context menu today but already mounts a modal via local state — the template for the Move/Copy dialog:

**Conditional modal mount off local state** (`EstimatePanel.tsx:204-211`, `DefaultMarkupControl`):
```typescript
{pendingPct !== null && (
  <DefaultMarkupChangeModal currentPct={defaultMarkupPct} pendingPct={pendingPct}
    onConfirm={confirmChange} onCancel={cancelChange} />
)}
```
Add `GroupContextMenu` (four items, no "Copy as text") + `GroupCategoryDialog` state here, mirroring TotalsPanel. The category list map is at `:337-339` (`boq.categories.map((cat) => <EstimateCategoryBlock ... />)`).

---

## Shared Patterns

### A. Whole-group, multi-page, undoable command
**Source:** `recolorGroup` (`markupStore.ts:230-266`) + undo/redo branches (`:476-493` recolor undo, `:626-643` recolor redo; `:579-589`/`:727-738` delete-group add/remove).
**Apply to:** `renameGroup`, `moveGroup`, `copyGroup`, `duplicateGroup`, `reorderItems`.
**Copy:** scan all pages by `.name`, capture per-id old-state, push ONE `MarkupCommand`, clear `redoStack`; add a matching `undo`/`redo` branch **before** the `cmd.markup.page` fallthrough (`:606`/`:754`). Cap enforced by `pushCommand` (`:122-125`).

### B. Cross-store atomic undo (markupStore orchestrates projectStore)
**Source:** design has no single precedent — assembled from `recolor-group` (per-id payload) + `setPrice`/`toggleHiddenItem` (`projectStore.ts:137-143,122-131`).
**Apply to:** `rename-group` (re-key `rates`+`hiddenItemNames`), `copy-group`/`duplicate-group` (blank rate add/remove).
**Copy:** refactor `undo()`/`redo()` from `set((s)=>{...})` to an action body calling `applyProjectUndo(cmd)`/`applyProjectRedo(cmd)` (dedicated projectStore actions `reKeyRate`/`reKeyHidden`/`addBlankRate`/`removeRate`) **immediately before** the markup `set()`. Both synchronous ⇒ one Ctrl+Z reverts both (React 19 batches).

### C. Additive `.clmc` field — no `formatVersion` bump
**Source:** `rates?`/`hiddenItemNames?`/`defaultMarkupPct?` (`project-schema.ts:88-108`, `return raw as ProjectFileV2` cast `:139`), snapshot (`project-serialize.ts:59-64`), coerce-hydrate (`:128-149`).
**Apply to:** `categoryItemOrder?: Record<string,string[]>`.
**Copy:** optional field, no `validateV2` branch; emit in snapshot from `markupStore.getState()`; coerce on hydrate (accept only `string[]` values, default `{}`, never throw); old files → absent → `{}` → placement order.

### D. Single aggregator feeds all three surfaces
**Source:** the `localeCompare` sort (`boq-aggregator.ts:264`), consumed by `useBoqLive` → `TotalsPanel`/`EstimatePanel`, and by `useExport.ts:79` → IPC → writers.
**Apply to:** replace that ONE sort with `categoryItemOrder` rank sort.
**Copy:** one change at `:264` propagates to totals panel, Estimate sheet, and xlsx/csv — no per-surface work.

### E. Pointer-events drag (window listeners, atomic cleanup)
**Source:** `Splitter.onPointerDown` (`Splitter.tsx:59-85`) + `useDraggable` (`useDraggable.ts:48-105`).
**Apply to:** the grip-handle reorder on both category blocks (via `useRowReorder`).
**Copy:** `pointerdown` on grip → `window` `pointermove`/`pointerup` → remove BOTH listeners on up → dispatch ONE `reorderItems`. Never element-scoped listeners (drop events on fast drags). NO HTML5 DnD, NO new package.

### F. Export inherits order — writers unchanged
**Source:** `useExport.ts:57-58,79` (`aggregateBoq()` in the RENDERER, ships finished `BoqStructure` via `window.api.writeBoq{Xlsx,Csv}`) → `boq-writers.ts:234,424` (`for (const item of cat.items)`).
**Apply to:** all ordering.
**Do NOT touch** `src/main/boq-writers.ts`, preload, or IPC — order is baked into `cat.items` before IPC. (Corrects the CONTEXT note that the writers might need work, and the CONTEXT claim that the aggregator lives in `src/main/`.)

### G. Visibility re-key uses the composite `name|categoryId`
**Source:** `TotalsRow.tsx:125-128` (`itemKey = \`${itemName}|${item.categoryId ?? ''}\``), `toggleHiddenItem(itemKey)` at `:247`, rebuilt Set at `projectStore.ts:128`.
**Apply to:** rename `hiddenReKeys` (per categoryId the group touches) — NOT the bare-name shorthand in SPEC Req 1 / D-03 (Pitfall 1).
**Copy:** re-key `${old}|${catId}` → `${new}|${catId}` for every categoryId with a hidden entry; rebuild `hiddenItemSet`; capture the swaps on the command for undo.

### H. Uncontrolled input + native blur/Enter commit (React-19-safe)
**Source:** `EstimateRow.tsx:184-247` (native listeners) + `:151-170` (seed guard on `document.activeElement !== el`); also `EstimatePanel.DefaultMarkupControl:128-150`.
**Apply to:** `InlineRenameInput`.
**Copy:** `defaultValue` seed; native `blur`+`keydown(Enter)` commit; `stopPropagation` on click/mousedown/keydown; never React `onChange`/`onBlur`.

---

## No Analog Found

No file is analog-less. Two carry **partial** analogs the planner should note:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `src/renderer/src/lib/group-ops.ts` (NEW) | utility | transform | No pure name/snapshot helper exists. Closest *shape* precedents: `nextCountSequence` (markupStore.ts:168-173, but max+1 vs first-free), `getColorForName` (:457-469), `getOrCreateCategory` (:175-191). `autoUniqueName` / `snapshotGroup` / collision-predicate are net-new pure logic (RESEARCH Pattern 5a/5c). Node-testable — inject `allMarkups`, no store import. |
| `src/renderer/src/stores/markupStore.ts` — cross-store `undo()`/`redo()` refactor | store | event-driven | The *whole-group command* half has an exact analog (`recolor-group`); the *projectStore-side application inside undo/redo* is net-new (Shared Pattern B). Highest-risk logic in the phase — cover with `group-undo-atomic.test.ts` (RESEARCH Validation §). |

---

## Metadata

**Analog search scope:** `src/renderer/src/stores/`, `src/renderer/src/lib/`, `src/renderer/src/hooks/`, `src/renderer/src/components/`, `src/renderer/src/types/`, `src/main/` (writers only).
**Files read this session (verified line numbers):** `markupStore.ts`, `projectStore.ts`, `types/markup.ts`, `boq-aggregator.ts`, `boq-types.ts`, `project-serialize.ts`, `project-schema.ts`, `useBoqLive.ts`, `useExport.ts`, `Splitter.tsx`, `useDraggable.ts`, `TotalsRow.tsx`, `EstimateRow.tsx`, `TotalsRowContextMenu.tsx`, `DefaultMarkupChangeModal.tsx`, `CategoryAutocomplete.tsx`, `MarkupNamePopup.tsx`, `BlockedCommitMessage.tsx`, `TotalsCategoryBlock.tsx`, `EstimateCategoryBlock.tsx`, `TotalsPanel.tsx`, `EstimatePanel.tsx`, `boq-writers.ts` (grep).
**Verified NEW (do not exist):** `group-ops.ts`, `GroupContextMenu.tsx`, `GroupCategoryDialog.tsx`, `InlineRenameInput.tsx`, `RenameCollisionMessage.tsx`, `EstimateRowContextMenu.tsx`. **`useRowReorder.ts`** is a recommended NEW extraction (not verified-absent; planner may inline into blocks instead).
**Verified available:** `GripVertical` in `lucide-react@1.6.0` (A6 confirmed).
**Pattern extraction date:** 2026-07-09
