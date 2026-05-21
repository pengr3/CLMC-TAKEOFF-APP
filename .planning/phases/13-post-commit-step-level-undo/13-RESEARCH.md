# Phase 13: Post-Commit Step-Level Undo — Research

**Researched:** 2026-05-21
**Domain:** Command-pattern undo extension, in-progress drawing state machine handoff, Konva renderer reuse
**Confidence:** HIGH — all findings sourced from direct file reads of the current codebase (post-Phase 12)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Behavioural contract (Phase C of v1.1):**

- **D-10** Ctrl+Z on a committed multi-point markup (linear / area / perimeter / wall) re-opens it in drawing mode with all points intact — undoing the commit only, not the shape. Subsequent Ctrl+Z = pop last point (Phase 10).
- **D-11** Brief `ConfirmationToast` on re-open: *"Shape re-opened — continue drawing or press Enter to commit"*. Parent-owns-lifecycle (no internal `setTimeout`).
- **D-12** Applies to linear, area, perimeter, wall, and any future multi-point tool. Count pins excluded.

**Re-open mechanics:**

- **D-13** Re-open hands off to `useMarkupTool`'s drawing state machine — no new state machine; load original points into `MarkupDrawState.points`, transition to `mode: 'drawing'` with the original tool active, inherit name/category/color/wallHeight.
- **D-14** Original markup removed from `markupStore` on re-open, restored on Esc.
- **D-15** Re-commit reuses original markup's name + category + color (preserves BOQ identity); new markup gets fresh `id`.
- **D-16** The whole gesture (commit → re-open → optional point edits → re-commit OR Esc) is a SINGLE undoable command. Intermediate point pops/pushes do NOT push individual commands. Only Enter (re-commit) or Esc (cancel) resolves the gesture.

**Trigger conditions (D-17):** Re-open fires when ALL true:
1. `useMarkupTool.state.mode === 'idle'` (no in-progress draw — so Phase 10's `popLastPoint` returns `false`)
2. Top of `markupStore.undoStack` is a `place` of a multi-point markup
3. The committed markup still exists in `markupStore.markups`
4. `viewerStore.vertexEditMarkupId === null` (no active vertex-edit)

Any other Ctrl+Z follows the existing Phase 10 + Phase 3 path — `markupStore.undo()` unchanged.

**Toast (D-18 / D-19 / D-20):** Wording ±5 words but must mention Enter. Lifetime ~2.5s OR next user interaction (point placed, Ctrl+Z, Esc, Enter). Top-center positioning (reuse existing slot used by Save / Export / Copy toasts in `App.tsx`).

**Dispatch (D-21 / D-22 / D-23):**
- Reuse `useKeyboardShortcuts` Ctrl+Z dispatch tree; new branch slots BETWEEN `getMarkupUndoHandler()?.()` returning `false` AND `useMarkupStore.getState().undo()`.
- `isTextInputActive()` guard still applies.
- No new keyboard binding.

**Selection / visibility (D-24 / D-25):**
- Re-open clears `selectedMarkupIds` and `vertexEditMarkupId`.
- Esc-restore does NOT restore selection (user back in `idle`).
- `hiddenItemNames` unchanged by re-open.

### Claude's Discretion

- Naming of the new command class (`ReopenMarkupCommand` vs `RecommitMarkupCommand` vs split). Match existing `EditMarkupCommand` / `MoveMarkupsCommand` convention.
- Where the transient "original markup" snapshot lives during re-open — `useMarkupTool` state, module-level ref (`markup-reopen-ref.ts`), or CanvasViewport-scoped `useRef`. Pick whatever mirrors Phase 10's `markup-undo-ref.ts` pattern most closely.
- Test split between store unit tests and CanvasViewport integration tests (follow Phase 10's `markup-tool-point-redo.test.ts` style).
- Whether the re-opened shape's preview lives on Layer 1a (non-listening) or transient Layer 2 — match existing in-progress preview path per tool.

### Deferred Ideas (OUT OF SCOPE)

- Re-open via right-click / context menu.
- Re-open via vertex-handle gesture (Phase 12's domain).
- Multi-markup re-open.
- Branching undo / redo history.
- Count pin re-open (single-point — no useful meaning).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Phase-C (v1.1) | Ctrl+Z on a committed multi-point markup re-opens it in `mode:'drawing'` with all points intact | New `reopen-recommit` command + new branch in `useKeyboardShortcuts.ts` Ctrl+Z dispatch; `activatePreset` extension to seed `points` |
| D-10 | First Ctrl+Z after commit = re-open, not delete; subsequent Ctrl+Z = pop last point (Phase 10) | Top-of-stack peek discriminates between `place` of multi-point markup and other command types |
| D-11 | Brief toast on re-open with parent-owned lifecycle | App-level state slot mirroring existing `saveToast` / `exportToast` / `copyToast` |
| D-12 | Applies to linear / area / perimeter / wall | Existing in-progress preview renderers already handle all 4 in `mode:'drawing'` |
| D-13 | Hands off to `useMarkupTool`'s drawing state machine | `activatePreset` extension to seed `points` + tool's existing `commitShape` |
| D-14 | Original removed from store on re-open, restored on Esc | Transient ref snapshot pattern (Phase 10 / Phase 12 prior art) |
| D-15 | Re-commit preserves name/category/color (and wallHeight); new id | `commitShape` already creates new id; identity inherited via `activatePreset` payload |
| D-16 | One undoable command for the full gesture | New `reopen-recommit` command pushed only at Enter; Esc abandons without push |
| D-17 | Four trigger conditions (idle / multi-point place at top of stack / markup still exists / no vertex-edit) | Top-of-stack peek + `isMultiPointMarkup` type guard + `useViewerStore.vertexEditMarkupId` read |
| D-18 to D-20 | Toast wording / lifetime / positioning | Reuses App.tsx toast pattern (~2.5s `setTimeout` + dismissal triggers) |
| D-21 to D-23 | Keyboard / dispatch wiring | Branch slots between `getMarkupUndoHandler()?.()` (returns false) and `useMarkupStore.getState().undo()` |
| D-24 / D-25 | Selection / visibility behaviour | `clearSelection()` + `clearVertexEdit()` on re-open; `hiddenItemNames` untouched |

</phase_requirements>

---

## Summary

Phase 13 is a **dispatch and command-shape extension**, not a renderer rewrite. The hard work was done in Phases 3, 7, 8, 9, 10, and 12: the in-progress preview renderers already handle `mode: 'drawing'` for linear / area / perimeter / wall; the command-pattern store already supports place / delete / move / edit; the Phase 10 dispatch tree already has the exact insertion point we need; the Phase 7.1 `activatePreset` already seeds name/category/color/wallHeight.

What does NOT exist today and must be added in Phase 13:

1. **`isMultiPointMarkup(markup)` type guard** in `src/renderer/src/types/markup.ts` (one-line `markup.type !== 'count'` check) so the new dispatch branch can discriminate without string-literal sprawl across files.
2. **`reopen-recommit` variant on `MarkupCommand` union** in `src/renderer/src/types/markup.ts` carrying `{ oldMarkup: Markup, newMarkup: Markup }` (page is implicit from each markup's `.page` field) — and matching `undo`/`redo` reducer branches in `markupStore.ts` mirroring the existing `move-markups` shape.
3. **Module-level `markup-reopen-ref.ts`** (pattern-match `markup-undo-ref.ts`) holding the original markup snapshot AND a flag indicating "we are currently in a re-open session". This is the ONLY state that must survive across the Ctrl+Z handler → CanvasViewport mount cycle; using a `useMarkupTool` field would couple it to the in-progress draw state which `cancel()` would inadvertently clear.
4. **New `commitFromReopen()` action on `useMarkupTool`** — or a `reopenSource` field on `MarkupDrawState` that `commitShape` reads to decide whether to dispatch a `place` command (normal path) or a `reopen-recommit` command (Phase 13 path).
5. **`activatePreset` extension** to seed `points` (currently it does NOT — it only seeds name/category/color/wallHeight/chainArmed). This is a NEW optional `points?: StagePoint[]` field on the preset payload.
6. **New dispatch branch in `useKeyboardShortcuts.ts`** between line 95 (`getMarkupUndoHandler()?.()`) and line 102 (top-of-stack peek for delete restore). Branch fires the re-open exposed via a new module-level `getMarkupReopenHandler()`.
7. **Re-open toast slot** in `App.tsx` (new `reopenToast` state, ~2.5s auto-dismiss with `useEffect` pattern mirroring `saveToast` lines 122-126 + `exportToast` lines 128-132).

The whole feature is mechanically small (~6-8 files touched) but correctness-critical: the undo stack must round-trip exactly, the original markup must be restorable byte-for-byte on Esc, and the Phase 8 `chainArmed` ref + Phase 12 `vertexEditMarkupId` interactions must be carefully sequenced.

**Primary recommendation:** Three plans across two waves — Wave 0 RED tests + types/store, Wave 1 hook/dispatch/CanvasViewport/toast. Three plans is justified over the v1.1-CONTEXT.md estimate of ~2 because the surfaces touched span seven files (types, store, hook, dispatch, viewport, App, ref module) and the test surface is large (10+ acceptance criteria with edge cases).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Top-of-stack peek + discrimination | `useKeyboardShortcuts.ts` (renderer) | — | Already owns Ctrl+Z dispatch tree; lines 102-105 already do a peek for delete/delete-group restoration. The new branch mirrors that pattern. |
| `isMultiPointMarkup` type guard | `src/renderer/src/types/markup.ts` | — | Lives next to `isMarkupTool` in `types/viewer.ts` style — kept in the types module so any consumer that imports `Markup` can discriminate without circular imports. |
| `reopen-recommit` command variant | `markupStore.ts` reducer (Zustand) | `types/markup.ts` `MarkupCommand` union | The command pattern already lives in `markupStore.ts`; existing `move-markups` is the closest shape (carries old/new state for round-trip undo). |
| Transient "original markup" snapshot | `markup-reopen-ref.ts` module-level ref | — | Phase 10's `markup-undo-ref.ts` pattern is the canonical bridge between `useKeyboardShortcuts` (which dispatches the re-open) and `CanvasViewport` (which owns the `useMarkupTool` instance). Module-level survives across renders without circular imports. |
| Re-open trigger (call `activatePreset` with seeded points) | `markup-reopen-ref.ts` handler set by `CanvasViewport` | `useMarkupTool.activatePreset` extension | Same pattern as `_activatePresetRef` already in `CanvasViewport.tsx` lines 132-159 (for `setChainArmedFromTotals`). |
| In-progress preview rendering | Existing per-tool renderers (`LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, `WallMarkup`) | `CanvasViewport` Layer 1a / Layer 2 | Phase 3 / 8 / 10 already handle the `'drawing'` state visualisation for all four tools — no new code. |
| Enter (re-commit) dispatch | `CanvasViewport` Enter handler → `commitShape` → new `reopen-recommit` command path | `useMarkupTool.commitShape` extension reading the re-open ref | The existing `commitShape` (lines 309-390 in `useMarkupTool.ts`) is the natural dispatch point — extend it to consult the re-open ref. |
| Esc (cancel) restore | `CanvasViewport` Escape handler → restore from snapshot via `markupStore.placeMarkupSilent` (NEW) | `markup-reopen-ref.ts` snapshot read | Esc must NOT push to undo stack (D-16) and MUST restore the original markup. Need a new store action or direct `set()` that bypasses the command push. |
| Toast presentation | `App.tsx` `reopenToast` state + JSX block (mirror `saveToast` lines 317-339) | `markup-reopen-ref.ts` callback to App | `App.tsx` already owns the toast slot; CanvasViewport-scoped toasts (`toast` in CanvasViewport.tsx:583) are reserved for calibration. |
| Toast dismissal triggers | `App.tsx` `useEffect` watching `reopenToast` (~2.5s timer) + explicit clears on next user interaction | — | Mirror lines 122-132 `saveToast` / `exportToast` 2000ms patterns. Decision: 2500ms or earlier interaction wins per D-19. |

---

## Standard Stack

No new libraries required.

| Component | Version | Role |
|-----------|---------|------|
| Zustand 5.0.12 | already installed | `markupStore` — extend `MarkupCommand` union, add `reopen-recommit` reducer branch |
| React 19.2.1 | already installed | `useMarkupTool` state machine, App.tsx toast `useEffect` |
| Konva 10.2.3 + react-konva 19.2.3 | already installed | Existing in-progress preview renderers handle re-opened markups at no cost |
| TypeScript 5.9.3 | already installed | New `isMultiPointMarkup` type guard + `reopen-recommit` variant on union |
| Vitest 4.1.1 | already installed | Test runner — `npx vitest run` is the canonical command |

**Verified by:** `package.json` direct read (this session). No `npm view` lookups needed — every dependency is pinned by an existing phase.

---

## Architecture Patterns

### System Architecture Diagram

```
Ctrl+Z (window keydown)
    |
    v
useKeyboardShortcuts.handleKeyDown — line 92 (e.ctrlKey && e.key === 'z' && !e.shiftKey)
    |
    +-- isTextInputActive() guard --> bail (Phase 3 / 10, unchanged)
    |
    +-- getMarkupUndoHandler()?.() — Phase 10 in-progress pop
    |       returns true  -> handled, done
    |       returns false -> fall through (no in-progress draw)
    |
    +-- (NEW) getMarkupReopenHandler()?.() — Phase 13 re-open
    |       checks: top of markupStore.undoStack is 'place' of multi-point markup AND
    |               markup still in store AND vertexEditMarkupId === null
    |       if all true:
    |           - snapshot original markup into markup-reopen-ref
    |           - remove markup from markupStore (silent — no command push)
    |           - clear selection + vertex-edit
    |           - call activatePreset(originalTool, { name, category, color, wallHeight?, points: [...orig.points] })
    |               (NOTE: activatePreset extension — currently does NOT seed points)
    |           - useMarkupTool transitions to mode:'drawing' with points pre-populated
    |           - fire re-open toast via app-level callback
    |           returns true -> handled, done
    |       otherwise returns false -> fall through
    |
    +-- existing top-of-stack peek for delete/delete-group selection restore (lines 102-105)
    +-- useMarkupStore.getState().undo()  — Phase 3, unchanged

User then in mode:'drawing':
    +-- Ctrl+Z again -> Phase 10's popLastPoint (transient — does NOT push commands)
    +-- Ctrl+Y       -> Phase 10's repushLastPoint
    +-- Click        -> recordClick appends a point (clears redoPoints per Phase 10)
    +-- Enter        -> finishLinear / finishPolygon -> mode:'confirming' -> commitShape
    |       commitShape consults markup-reopen-ref:
    |           if reopen-session active:
    |               dispatch markupStore.commitReopen(oldMarkup, newMarkup)  -- NEW action
    |               -> pushes ONE 'reopen-recommit' command, removes/adds in one transaction
    |               -> clear reopen-ref
    |           else:
    |               dispatch markupStore.placeMarkup(newMarkup)  -- existing path
    +-- Escape       -> CanvasViewport Esc handler (lines 640-668):
            if reopen-session active:
                markupStore.restoreFromReopenSnapshot(originalMarkup)  -- NEW silent action
                clear reopen-ref
                cancelMarkup() (resets useMarkupTool to INITIAL_STATE)
                setActiveTool('select')
            else: existing Phase 3 cancel path
```

### Recommended Project Structure

No new directories; one new file (the re-open ref module):

```
src/renderer/src/
├── types/
│   └── markup.ts                      # add isMultiPointMarkup type guard;
│                                        add 'reopen-recommit' to MarkupCommand union
├── stores/
│   └── markupStore.ts                 # add reopen-recommit branches to undo() + redo();
│                                        add commitReopen() action; add restoreFromReopenSnapshot() action
├── hooks/
│   ├── useMarkupTool.ts               # extend activatePreset to accept optional points[];
│                                        extend commitShape to read re-open ref and dispatch reopen-recommit
│   └── useKeyboardShortcuts.ts        # add Ctrl+Z branch between line 96 and line 102 (re-open check)
├── lib/
│   ├── markup-undo-ref.ts             # unchanged
│   └── markup-reopen-ref.ts           # NEW — module-level ref pattern mirroring markup-undo-ref.ts
├── components/
│   └── CanvasViewport.tsx             # register/unregister reopenHandler with markup-reopen-ref;
│                                        extend Escape handler with re-open restore branch
└── App.tsx                            # add reopenToast state slot + 2500ms useEffect + JSX block

src/tests/
└── markup-post-commit-reopen.test.ts  # NEW — covers SC1-SC5 + edge cases (10+ test cases)
```

### Pattern 1: Module-level handler ref (extend the established pattern)

**What:** A nullable function reference bridges `CanvasViewport` (which owns the `useMarkupTool` instance) to `useKeyboardShortcuts` (which handles global keyboard events), without circular imports.

**Existing canonical pattern** (`markup-undo-ref.ts`, verified — entire file 33 lines):

```typescript
// Source: src/renderer/src/lib/markup-undo-ref.ts:15-23 (verified 2026-05-21)
let _markupUndoHandler: (() => boolean) | null = null
export function setMarkupUndoHandler(handler: (() => boolean) | null): void {
  _markupUndoHandler = handler
}
export function getMarkupUndoHandler(): (() => boolean) | null {
  return _markupUndoHandler
}
```

**Phase 13 extension — new file `markup-reopen-ref.ts`:**

```typescript
// PROPOSED: src/renderer/src/lib/markup-reopen-ref.ts
import type { Markup } from '../types/markup'

/**
 * Returns true if a re-open was triggered (handled), false if no eligible
 * top-of-stack markup exists (caller falls through to markupStore.undo()).
 *
 * The handler receives no arguments — it reads the top of markupStore.undoStack
 * itself, applies the D-17 four-condition check, and dispatches the re-open
 * transition on useMarkupTool via activatePreset.
 */
type ReopenHandler = () => boolean

let _markupReopenHandler: ReopenHandler | null = null
export function setMarkupReopenHandler(handler: ReopenHandler | null): void {
  _markupReopenHandler = handler
}
export function getMarkupReopenHandler(): ReopenHandler | null {
  return _markupReopenHandler
}

/**
 * Transient snapshot of the original markup that was re-opened. Set by the
 * reopenHandler at the start of the gesture; consumed by commitShape (on
 * Enter — to build the reopen-recommit command) OR by the Escape handler (on
 * cancel — to restore the original). Cleared after consumption.
 *
 * Why module-level and not useMarkupTool state: cancel() resets useMarkupTool
 * to INITIAL_STATE which would wipe the snapshot mid-gesture if the user
 * navigates pages or switches tools during re-open. Module-level survives
 * that. (Phase 10 prior art: markup-undo-ref.ts uses the same reasoning.)
 *
 * Why not Zustand: this is transient UX state with no need for re-render
 * subscription. Module ref avoids unnecessary store traffic.
 */
let _reopenSnapshot: Markup | null = null
export function setReopenSnapshot(markup: Markup | null): void {
  _reopenSnapshot = markup
}
export function getReopenSnapshot(): Markup | null {
  return _reopenSnapshot
}
```

### Pattern 2: `MarkupCommand` discriminated union extension

**Current state** (`types/markup.ts:52-101`, verified):

```typescript
// Source: src/renderer/src/types/markup.ts:52-101 (verified 2026-05-21)
export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
  | { type: 'delete-group'; markups: Markup[] }
  | { type: 'recolor-group'; name: string; newColor: string; oldColors: Record<string,string>; page?: number; markupIdsAffected: string[] }
  | { type: 'edit-markup'; markupId: string; page: number; oldName: string; oldCategoryName: string; oldColor: string; newName: string; newCategoryName: string; newColor: string; oldWallHeight?: number; newWallHeight?: number }
  | { type: 'move-vertex'; markupId: string; page: number; vertexIndex: number; oldPoint: StagePoint; newPoint: StagePoint }
  | { type: 'move-markups'; moves: Array<{ markupId: string; page: number; oldPoints: StagePoint[]; newPoints: StagePoint[] }> }
```

**Phase 13 extension — add one variant:**

```typescript
// PROPOSED — add to the union at the bottom of types/markup.ts
  | {
      type: 'reopen-recommit'
      /** Original markup that was removed from the page on re-open trigger. */
      oldMarkup: Markup
      /** New markup committed by Enter after point edits during re-open. */
      newMarkup: Markup
      /**
       * Page is implicit from oldMarkup.page === newMarkup.page (re-open does NOT
       * cross pages; if it did the trigger condition would not fire because page
       * navigation clears in-progress draw state per CanvasViewport.tsx:610).
       */
    }
```

### Pattern 3: `markupStore` reducer branches (mirror `move-markups`)

The `move-markups` pattern in `markupStore.ts:404-421` (undo) and `:519-536` (redo) is the closest analog: both undo and redo replace markup state from snapshot data carried inside the command. The `reopen-recommit` branches are even simpler (single old/new pair, not an array).

**Existing reducer switch (verified, `markupStore.ts:337-450`):**

```typescript
// Source: markupStore.ts:404-421 (verified 2026-05-21)
if (cmd.type === 'move-markups') {
  const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
  for (const move of cmd.moves) {
    const pageList = nextPageMarkups[move.page] ?? []
    nextPageMarkups[move.page] = pageList.map((m) => {
      if (m.id !== move.markupId) return m
      if (m.type === 'count') {
        return { ...m, point: move.oldPoints[0] } as Markup
      }
      return { ...m, points: move.oldPoints } as Markup
    })
  }
  return {
    pageMarkups: nextPageMarkups,
    undoStack: s.undoStack.slice(0, -1),
    redoStack: [...s.redoStack, cmd]
  }
}
```

**Proposed `reopen-recommit` branches (additions, NOT replacements):**

```typescript
// PROPOSED — slot into undo() switch BEFORE the final cmd.markup.page fallthrough at line 437
if (cmd.type === 'reopen-recommit') {
  const page = cmd.oldMarkup.page
  const pageList = s.pageMarkups[page] ?? []
  // Remove the newMarkup that was added on commit, re-add the oldMarkup that was removed
  const filtered = pageList.filter((m) => m.id !== cmd.newMarkup.id)
  const restored = [...filtered, cmd.oldMarkup]
  return {
    pageMarkups: { ...s.pageMarkups, [page]: restored },
    undoStack: s.undoStack.slice(0, -1),
    redoStack: [...s.redoStack, cmd]
  }
}

// PROPOSED — slot into redo() switch BEFORE the cmd.markup.page fallthrough at line 553
if (cmd.type === 'reopen-recommit') {
  const page = cmd.oldMarkup.page
  const pageList = s.pageMarkups[page] ?? []
  // Re-apply: remove oldMarkup, add newMarkup
  const filtered = pageList.filter((m) => m.id !== cmd.oldMarkup.id)
  const replaced = [...filtered, cmd.newMarkup]
  return {
    pageMarkups: { ...s.pageMarkups, [page]: replaced },
    undoStack: pushCommand(s.undoStack, cmd),
    redoStack: s.redoStack.slice(0, -1)
  }
}
```

**New action `commitReopen` (called from `useMarkupTool.commitShape` when re-open is active):**

```typescript
// PROPOSED — add to markupStore actions
commitReopen: (oldMarkup: Markup, newMarkup: Markup) =>
  set((s) => {
    const page = oldMarkup.page
    const pageList = s.pageMarkups[page] ?? []
    // Defensive: oldMarkup may have already been removed by the silent removal
    // path used at re-open trigger time. Use a filter + push that is idempotent.
    const filtered = pageList.filter((m) => m.id !== oldMarkup.id)
    const next = [...filtered, newMarkup]
    return {
      pageMarkups: { ...s.pageMarkups, [page]: next },
      undoStack: pushCommand(s.undoStack, { type: 'reopen-recommit', oldMarkup, newMarkup }),
      redoStack: []
    }
  }),

// PROPOSED — silent removal at re-open trigger time (does NOT push a command).
// Distinct from deleteMarkup() because deleteMarkup pushes 'delete' to undoStack.
// This is a pure data hide — the original markup is held in the reopen-ref snapshot
// and will be either re-added (on Esc) or replaced (on Enter).
removeForReopen: (markup: Markup) =>
  set((s) => {
    const page = markup.page
    const pageList = s.pageMarkups[page] ?? []
    return {
      pageMarkups: { ...s.pageMarkups, [page]: pageList.filter((m) => m.id !== markup.id) }
    }
  }),

// PROPOSED — silent restore on Esc cancel. Does NOT push to undoStack.
restoreFromReopen: (markup: Markup) =>
  set((s) => {
    const page = markup.page
    const pageList = s.pageMarkups[page] ?? []
    // Idempotent: if for any reason the markup is already present, don't duplicate.
    if (pageList.some((m) => m.id === markup.id)) return s
    return {
      pageMarkups: { ...s.pageMarkups, [page]: [...pageList, markup] }
    }
  }),
```

**Critical pop subtlety (D-16 + the original undo stack semantics):** When the user presses Ctrl+Z and we trigger re-open, we must ALSO pop the `place` command that put the original markup on the stack — otherwise after re-commit there would be TWO commands describing the same shape (the original `place` + the new `reopen-recommit`). The reopen handler must call `useMarkupStore.setState((s) => ({ undoStack: s.undoStack.slice(0, -1) }))` after capturing the snapshot. This is the same shape as `useMarkupStore.getState().undo()` would do, minus the actual data mutation.

### Pattern 4: `activatePreset` extension — seed `points`

**Current signature** (`useMarkupTool.ts:119-148`, verified):

```typescript
// Source: src/renderer/src/hooks/useMarkupTool.ts:119-148 (verified 2026-05-21)
const activatePreset = useCallback(
  (
    tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall',
    preset: { name: string; categoryName: string; color: string; wallHeight?: number }
  ) => {
    if (tool === 'count') {
      setState({
        ...INITIAL_STATE,
        mode: 'placing',
        toolType: 'count',
        pendingName: preset.name,
        pendingCategoryName: preset.categoryName || UNCATEGORIZED,
        pendingColor: preset.color,
        chainArmed: true
      })
    } else {
      setState({
        ...INITIAL_STATE,
        mode: 'drawing',
        toolType: tool,
        pendingName: preset.name,
        pendingCategoryName: preset.categoryName || UNCATEGORIZED,
        pendingColor: preset.color,
        chainArmed: true,
        ...(tool === 'wall' ? { pendingWallHeight: preset.wallHeight ?? 2400 } : {})
      })
    }
  },
  []
)
```

**Phase 13 extension — add optional `points` to the preset payload:**

```typescript
// PROPOSED extension
const activatePreset = useCallback(
  (
    tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall',
    preset: {
      name: string
      categoryName: string
      color: string
      wallHeight?: number
      /** Phase 13: pre-populate the in-progress points stack (used by post-commit re-open). */
      points?: StagePoint[]
    }
  ) => {
    if (tool === 'count') {
      // count never has multi-point re-open; ignore points if passed
      setState({
        ...INITIAL_STATE,
        mode: 'placing',
        toolType: 'count',
        pendingName: preset.name,
        pendingCategoryName: preset.categoryName || UNCATEGORIZED,
        pendingColor: preset.color,
        chainArmed: true
      })
    } else {
      setState({
        ...INITIAL_STATE,
        mode: 'drawing',
        toolType: tool,
        pendingName: preset.name,
        pendingCategoryName: preset.categoryName || UNCATEGORIZED,
        pendingColor: preset.color,
        // Phase 13: chainArmed is FALSE during re-open — this is not a continuous chain;
        // it is a one-time geometry refinement. Toolbar chain badge must not render.
        chainArmed: preset.points && preset.points.length > 0 ? false : true,
        points: preset.points ? [...preset.points] : [],
        ...(tool === 'wall' ? { pendingWallHeight: preset.wallHeight ?? 2400 } : {}),
        // Phase 13: when seeded with points, set pendingPage to the current page so
        // commitShape's later read does not fall through to currentPage default.
        ...(preset.points && preset.points.length > 0
          ? { pendingPage: useViewerStore.getState().currentPage }
          : {})
      })
    }
  },
  []
)
```

**CRITICAL:** `chainArmed: false` during re-open is essential. Phase 8's chain mode armed after the first commit; Phase 13 re-open is NOT a chain — it's a one-time geometry edit. If `chainArmed` were left at `true`, the Phase 8 auto-commit `useEffect` in CanvasViewport.tsx:725-746 would re-commit instantly on every chained Enter, breaking the D-16 single-command contract.

### Pattern 5: `commitShape` extension — dispatch `reopen-recommit` vs `place`

**Current implementation** (`useMarkupTool.ts:309-390`, verified):

The current `commitShape` directly calls `store.placeMarkup(m)` for whichever tool type. Phase 13 must consult the re-open ref and dispatch differently.

```typescript
// PROPOSED extension inside commitShape, near the top after the mode guard
const commitShape = useCallback((payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => {
  const prev = stateRef.current
  if (prev.mode !== 'confirming') return

  const page = prev.pendingPage ?? useViewerStore.getState().currentPage
  const store = useMarkupStore.getState()
  const category = store.getOrCreateCategory(payload.categoryName || UNCATEGORIZED)
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  const name = payload.name
  const color = payload.color

  // Build the new markup as today (existing 4 branches)
  let newMarkup: Markup | null = null
  if (prev.toolType === 'linear') { newMarkup = { id, type: 'linear', page, name, categoryId: category.id, color, createdAt, points: prev.points } }
  else if (prev.toolType === 'area') { newMarkup = { id, type: 'area', page, name, categoryId: category.id, color, createdAt, points: prev.points } }
  else if (prev.toolType === 'perimeter') { newMarkup = { id, type: 'perimeter', page, name, categoryId: category.id, color, createdAt, points: prev.points } }
  else if (prev.toolType === 'wall') { newMarkup = { id, type: 'wall', page, name, categoryId: category.id, color, createdAt, points: prev.points, wallHeight: payload.wallHeight ?? prev.pendingWallHeight } }
  if (!newMarkup) return

  // Phase 13: consult re-open ref. If a re-open snapshot is held, this commit is the
  // re-commit half of the gesture — dispatch reopen-recommit (one command) instead of
  // place (one command per the existing path). Then clear the snapshot.
  const reopenSnapshot = getReopenSnapshot()
  if (reopenSnapshot) {
    store.commitReopen(reopenSnapshot, newMarkup)
    setReopenSnapshot(null)
  } else {
    store.placeMarkup(newMarkup)
  }

  // Existing chain-aware post-commit reset (unchanged)
  setState({
    ...INITIAL_STATE,
    toolType: prev.toolType,
    mode: 'drawing',
    pendingName: payload.name,
    pendingCategoryName: payload.categoryName,
    pendingColor: payload.color,
    pendingWallHeight: payload.wallHeight ?? prev.pendingWallHeight,
    // Phase 13: do NOT chain-arm after a reopen-recommit — the user requested a geometry
    // refinement, not a chain start. Phase 8 chain badge should not appear.
    chainArmed: reopenSnapshot ? false : true
  })
}, [])
```

### Pattern 6: Re-open trigger handler registered by CanvasViewport

The handler reads `markupStore.undoStack`, applies D-17, and either fires the re-open transition or returns `false`. Lives in `CanvasViewport.tsx` because it needs `activatePreset` (which is owned by the `useMarkupTool` instance there).

```typescript
// PROPOSED — add to CanvasViewport.tsx near the existing undo/redo useEffect at lines 315-327
// Phase 13: re-open handler. Registered with markup-reopen-ref so useKeyboardShortcuts
// can call it between the in-progress pop handler and the markupStore.undo() fallthrough.
useEffect(() => {
  const handler = (): boolean => {
    // D-17 condition 1: no in-progress draw. (Phase 10's popLastPoint would have returned
    // true before we got here, so this is implicit — but defensive check is cheap.)
    if (markupState.mode !== 'idle') return false

    // D-17 condition 4: no vertex-edit active.
    if (useViewerStore.getState().vertexEditMarkupId !== null) return false

    // D-17 condition 2: top of stack is 'place' of a multi-point markup.
    const store = useMarkupStore.getState()
    const top = store.undoStack.at(-1)
    if (!top || top.type !== 'place') return false
    if (!isMultiPointMarkup(top.markup)) return false  // count pins excluded (D-12)

    // D-17 condition 3: markup still in store.
    const stillExists = (store.pageMarkups[top.markup.page] ?? []).some((m) => m.id === top.markup.id)
    if (!stillExists) return false

    // All conditions met — fire re-open transition.
    const original = top.markup
    // Snapshot original for Esc-restore + reopen-recommit command construction.
    setReopenSnapshot(original)
    // Silent remove (NOT deleteMarkup — would push a 'delete' command).
    store.removeForReopen(original)
    // Pop the original 'place' command from undoStack (D-16: it becomes part of the
    // reopen-recommit command, not a separate undo entry).
    useMarkupStore.setState((s) => ({ undoStack: s.undoStack.slice(0, -1) }))
    // D-24: clear selection + vertex-edit.
    clearSelection()
    clearVertexEdit()
    // Map markup.type to the tool string activatePreset expects (1:1 for linear/area/perimeter/wall).
    const tool = original.type as 'linear' | 'area' | 'perimeter' | 'wall'
    // Resolve category name from id (activatePreset wants the name, not the id).
    const cat = store.getCategory(original.categoryId)
    activatePreset(tool, {
      name: original.name,
      categoryName: cat?.name ?? '',
      color: original.color,
      points: original.type === 'count' ? undefined : original.points,
      wallHeight: original.type === 'wall' ? original.wallHeight : undefined
    })
    // Fire the toast via an app-level callback (passed in via props from App.tsx).
    props.onReopenToast?.()
    return true
  }
  setMarkupReopenHandler(handler)
  return () => setMarkupReopenHandler(null)
}, [markupState.mode, activatePreset, clearSelection, clearVertexEdit, props.onReopenToast])
```

### Pattern 7: Ctrl+Z dispatch branch in `useKeyboardShortcuts`

**Insertion point** (verified — `useKeyboardShortcuts.ts:92-112`):

```typescript
// Source: src/renderer/src/hooks/useKeyboardShortcuts.ts:92-112 (verified 2026-05-21)
if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
  if (isTextInputActive()) return
  e.preventDefault()
  const handledByDraw = getMarkupUndoHandler()?.() ?? false
  if (!handledByDraw) {
    // Phase 09 UAT gap (Test 9): peek the command being undone — if a
    // delete or delete-group is about to be reversed, capture the
    // restored markup IDs so we can re-apply selection rings after
    // undo(). Without this, Ctrl+A → Delete → Ctrl+Z restores the
    // markups but leaves selection empty, breaking the round-trip.
    const top = useMarkupStore.getState().undoStack.at(-1)
    let restoredIds: string[] = []
    if (top?.type === 'delete') restoredIds = [top.markup.id]
    else if (top?.type === 'delete-group') restoredIds = top.markups.map((m) => m.id)
    useMarkupStore.getState().undo()
    if (restoredIds.length > 0) {
      useViewerStore.getState().setSelectedMarkupIds(restoredIds)
    }
  }
  return
}
```

**Phase 13 — re-open branch slotted between line 95 (`getMarkupUndoHandler()`) and line 102 (top-of-stack peek):**

```typescript
// PROPOSED extension
if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
  if (isTextInputActive()) return
  e.preventDefault()
  const handledByDraw = getMarkupUndoHandler()?.() ?? false
  if (handledByDraw) return

  // NEW Phase 13: in-progress draw was not active. Before falling through to
  // markupStore.undo(), try the post-commit re-open handler. It applies D-17
  // and returns true when it triggered a re-open transition.
  const handledByReopen = getMarkupReopenHandler()?.() ?? false
  if (handledByReopen) return

  // Existing Phase 09 UAT gap path — unchanged.
  const top = useMarkupStore.getState().undoStack.at(-1)
  let restoredIds: string[] = []
  if (top?.type === 'delete') restoredIds = [top.markup.id]
  else if (top?.type === 'delete-group') restoredIds = top.markups.map((m) => m.id)
  useMarkupStore.getState().undo()
  if (restoredIds.length > 0) {
    useViewerStore.getState().setSelectedMarkupIds(restoredIds)
  }
  return
}
```

### Pattern 8: Esc handler integration in CanvasViewport

**Current Escape handler** (`CanvasViewport.tsx:638-668`, verified):

```typescript
// Source: CanvasViewport.tsx:640-668 (verified 2026-05-21)
if (e.key === 'Escape') {
  // Phase 12 D-06: Escape in vertex edit mode restores original vertex positions
  if (useViewerStore.getState().vertexEditMarkupId !== null) {
    e.preventDefault()
    cancelVertexEdit()
    return
  }
  if (
    markupState.mode === 'drawing' ||
    markupState.mode === 'confirming' ||
    markupState.mode === 'naming' ||
    markupState.mode === 'placing'
  ) {
    e.preventDefault()
    cancelMarkup()
    useViewerStore.getState().setActiveTool('select')
    return
  }
  // No active markup flow: if we're in 'select' mode, deselect.
  if (useViewerStore.getState().activeTool === 'select') {
    clearSelection()
  }
  return
}
```

**Phase 13 extension — restore re-open snapshot BEFORE cancelMarkup:**

```typescript
// PROPOSED extension — insert BEFORE the existing markupState.mode branch
if (e.key === 'Escape') {
  // Phase 12 D-06 vertex-edit restore (unchanged)
  if (useViewerStore.getState().vertexEditMarkupId !== null) {
    e.preventDefault()
    cancelVertexEdit()
    return
  }

  // Phase 13 — re-open cancel: restore the snapshot, then run the standard cancel path.
  // The Esc landing here means we are mid-re-open AND in mode:'drawing' (the markup
  // was loaded into useMarkupTool with all original points). After restoring the markup
  // to the store, cancelMarkup() resets useMarkupTool to INITIAL_STATE so the user sees
  // a clean canvas with the original markup back in place.
  const reopenSnapshot = getReopenSnapshot()
  if (reopenSnapshot) {
    e.preventDefault()
    useMarkupStore.getState().restoreFromReopen(reopenSnapshot)
    // Re-push the original 'place' command back onto undoStack so the user's NEXT Ctrl+Z
    // behaves as if the re-open never happened (D-16: cancel pushes nothing; the original
    // place must remain available for normal whole-markup undo).
    useMarkupStore.setState((s) => ({
      undoStack: [...s.undoStack, { type: 'place', markup: reopenSnapshot }]
    }))
    setReopenSnapshot(null)
    cancelMarkup()
    useViewerStore.getState().setActiveTool('select')
    return
  }

  // Existing Phase 3 + Phase 9 cancel paths (unchanged)
  if (
    markupState.mode === 'drawing' ||
    markupState.mode === 'confirming' ||
    markupState.mode === 'naming' ||
    markupState.mode === 'placing'
  ) {
    e.preventDefault()
    cancelMarkup()
    useViewerStore.getState().setActiveTool('select')
    return
  }
  if (useViewerStore.getState().activeTool === 'select') {
    clearSelection()
  }
  return
}
```

**Subtle but critical point:** The `place` command we popped at re-open trigger time must be re-pushed onto undoStack on Esc cancel so the round-trip is exact. Without this, after Esc the markup is on the page but the undo stack is empty — Ctrl+Z would do nothing (broken expectation).

### Pattern 9: Toast wiring in App.tsx

**Existing toast pattern** (App.tsx:122-132 + JSX block at 317-339, verified):

```typescript
// Source: App.tsx:82,93,122-132 (verified 2026-05-21)
const [saveToast, setSaveToast] = useState<string | null>(null)
const [exportToast, setExportToast] = useState<string | null>(null)

useEffect(() => {
  if (!saveToast) return
  const t = window.setTimeout(() => setSaveToast(null), 2000)
  return () => window.clearTimeout(t)
}, [saveToast])

useEffect(() => {
  if (!exportToast) return
  const t = window.setTimeout(() => setExportToast(null), 2000)
  return () => window.clearTimeout(t)
}, [exportToast])
```

**Phase 13 — add `reopenToast` state and matching `useEffect` + JSX block (mirror the pattern exactly):**

```typescript
// PROPOSED — add to App.tsx near line 82
const [reopenToast, setReopenToast] = useState<string | null>(null)

// PROPOSED — add useEffect near lines 122-132. D-19 says ~2.5s
useEffect(() => {
  if (!reopenToast) return
  const t = window.setTimeout(() => setReopenToast(null), 2500)
  return () => window.clearTimeout(t)
}, [reopenToast])

// PROPOSED — pass callback to CanvasViewport so reopenHandler can fire it
<CanvasViewport
  hoverMatches={hoverMatches}
  pulse={pulse}
  onPulseComplete={clearPulse}
  onReopenToast={() => setReopenToast('Shape re-opened — continue drawing or press Enter to commit')}
/>

// PROPOSED — JSX block parallel to saveToast lines 317-339, with bottom offset
// to avoid stacking on top of saveToast/exportToast/copyToast.
// Existing offsets: saveToast bottom 16, exportToast bottom 60, copyToast bottom 104.
// reopenToast → bottom 148.
{reopenToast !== null && (
  <div
    role="status"
    aria-live="polite"
    style={{
      position: 'absolute', bottom: 148, left: '50%', transform: 'translateX(-50%)',
      padding: '8px 16px', background: '#252526', border: '1px solid #3c3c3c',
      borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 15,
      display: 'flex', gap: 16, fontSize: 13, color: '#cccccc'
    }}
  >
    <span>{reopenToast}</span>
    <button
      onClick={() => setReopenToast(null)}
      style={{
        background: 'transparent', border: 'none',
        color: '#888', cursor: 'pointer', fontSize: 13
      }}
    >
      Dismiss
    </button>
  </div>
)}
```

**Dismissal triggers (D-19): "auto-dismiss after ~2.5s OR on next user interaction"** — the 2.5s timer is the easy part. The "next user interaction" part has two viable implementations:

- **(a) Simple:** rely only on the 2.5s timer. The user's next interaction does NOT explicitly dismiss the toast — it just sits until the timer fires. Acceptable per the toast lifetime existing pattern (Saving / Export toasts behave this way).
- **(b) Explicit:** add `setReopenToast(null)` calls inside the relevant CanvasViewport handlers (recordClick after first point, Ctrl+Z handler, Esc handler, Enter handler). Requires a callback wired from App.tsx down. More complex.

**Recommendation:** (a) for v1.1 — matches existing toast UX exactly, no new prop drilling. Document as locked decision and revisit only if UAT shows the 2.5s window is too long.

### Anti-Patterns to Avoid

- **Pushing individual point-edit commands during re-open** — Phase 10's `popLastPoint` / `repushLastPoint` operate on the transient `redoPoints` field; they do NOT push commands. Phase 13 inherits this — every Ctrl+Z / Ctrl+Y while re-opened is a transient pop/push only. The ONE command (`reopen-recommit`) is pushed only at Enter or never (on Esc).
- **Duplicating the in-progress preview renderer** — The existing `LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, `WallMarkup` renderers already render `mode: 'drawing'` previews from `markupState.points`. Reuse them; do not invent a "re-open preview" component.
- **Bypassing `isTextInputActive()`** — global Ctrl+Z must never fire while a name-input or category dropdown has focus (Phase 3 Pitfall 7). The Phase 13 branch lives AFTER the `isTextInputActive()` guard, so this is automatic — but do not introduce any code path that calls `getMarkupReopenHandler()` from outside the guarded block.
- **Calling `markupStore.undo()` directly inside the re-open branch** — would double-pop the stack (the re-open already pops the `place` command manually, and `markupStore.undo()` would pop a second one). Always `return` after a successful re-open dispatch.
- **Setting `chainArmed: true` during re-open** — Phase 8's auto-commit `useEffect` would fire immediately on `mode:'confirming'`, breaking the user's ability to add more points. The `activatePreset` extension MUST set `chainArmed: false` when seeded with points.
- **Mutating `original.points` in-place during the seeding** — copy the array (`[...original.points]`) before passing to `activatePreset`. Otherwise pop/push operations on the in-progress stack would mutate the snapshot held in the re-open ref, breaking Esc-restore.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-progress preview rendering | New "re-opened markup preview" component | Existing per-tool renderers — they already render `mode:'drawing'` from `markupState.points` | The renderer is tool-type-agnostic to whether the points came from clicks or from `activatePreset`. Five components × four tools = 20+ files would change for nothing. |
| Cross-component function bridging | React context or Zustand function refs | Module-level ref pattern (`markup-reopen-ref.ts`) | Phase 10's `markup-undo-ref.ts` is the established pattern. Context would force renderer re-renders on register/unregister; Zustand would persist transient UX state via `persist` middleware. |
| Undo / redo dispatch | New keyboard shortcut, new event listener | Existing `useKeyboardShortcuts` Ctrl+Z branch | The branch insertion point is one line of code between two existing dispatch checks. |
| Toast presentation | New toast component | Existing `ConfirmationToast` OR the App-level inline toast pattern (saveToast/exportToast/copyToast) | App.tsx already owns three identical inline toasts. The Phase 13 toast is a fourth instance of the same pattern. |
| Stage inverse transform | Re-deriving from `screenToStagePoint` | The original markup's points are ALREADY in page-space (PDF normalized coords) — pass them straight to `activatePreset` | Phase 13 has NO pointer-driven entry point during the trigger; the re-open is purely a state transition. |
| Markup discriminator | String literal comparison `markup.type !== 'count'` scattered across files | New `isMultiPointMarkup` type guard in `types/markup.ts` (mirror `isMarkupTool` in `types/viewer.ts:92-94`) | The discriminator is consumed in at least 3 places (reopen handler, test file, possibly markupStore). One named function is cheaper than three string-literal forks. |

**Key insight:** Phase 13 is mostly state-machine glue. The hard parts (rendering, command pattern, dispatch tree, toast UX) are already paid for.

---

## Runtime State Inventory

Phase 13 is a renderer-layer feature: new in-memory state (snapshot ref + toast) + new command variant. No rename, no refactor, no migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `.clmc` schema unchanged (additive command variant lives only in `MarkupCommand` union which is in-memory undo stack, not persisted) | — |
| Live service config | None — no external services | — |
| OS-registered state | None — no installer touchpoints | — |
| Secrets/env vars | None | — |
| Build artifacts | None — new file `markup-reopen-ref.ts` compiles cleanly; no stale outputs | — |

**Verification:** `MarkupCommand` is defined in `types/markup.ts:52-101` and consumed only by `markupStore.ts` reducer. Project file schema (`project-io.ts`) serialises `pageMarkups` and `categories` only — never `undoStack` or `redoStack`. Adding a variant to the union is purely a TypeScript and reducer extension.

---

## Common Pitfalls

### Pitfall 1: Esc-restore uses index, not id — and another action mutated the store between re-open and Esc

**What goes wrong:** If the Esc handler restores the original markup by inserting at the original array index (which we never stored anyway), and the user navigates pages or another async action mutates the page list between re-open trigger and Esc, the restore lands in the wrong slot.

**Why it happens:** Naive implementation might cache `originalIndex` and call `splice(originalIndex, 0, original)`.

**How to avoid:** The proposed `restoreFromReopen(markup)` action takes the full Markup and appends to `pageMarkups[markup.page]`. The visible order of markups within a page is not currently semantic (BOQ totals are id-based, hover detection is geometric). Append is correct and order-stable for re-render purposes. Use id-and-page restoration, NEVER index restoration.

**Warning sign:** Test that does: re-open, navigate to another page (which clears in-progress draw — see line 610), navigate back, press Esc. The markup must still be restorable. Actually — `setPage`/`nextPage`/`prevPage` clear `vertexEditMarkupId` and `selectedMarkupIds` but do NOT touch the in-progress markup state. Phase 13 must decide: does re-open survive page navigation? **Decision:** Treat page navigation during re-open as an implicit Esc-equivalent. Add a `useEffect` on `currentPage` change that calls `restoreFromReopen + setReopenSnapshot(null) + cancelMarkup()`. Otherwise the user crosses to another page mid-re-open and loses the original.

### Pitfall 2: `chainArmed` leaks across re-open

**What goes wrong:** User commits markup A (chain auto-arms `chainArmed: true`). User presses Ctrl+Z to re-open A. The re-open seeds `chainArmed: true` because `activatePreset` historically did. After Enter, Phase 8's auto-commit `useEffect` fires (because `mode === 'confirming' && chainArmed === true`), instantly re-committing without giving the user a chance to manage. The toast appears for half a frame and disappears as the re-commit lands.

**Why it happens:** `activatePreset` always sets `chainArmed: true` today (line 132 + line 142 of useMarkupTool.ts).

**How to avoid:** The `activatePreset` extension proposed above sets `chainArmed: false` when `preset.points` is non-empty. This is the load-bearing fix.

**Warning sign:** UAT test case: re-open a multi-point markup, do NOT add or remove points, press Enter. The re-commit must produce ONE `reopen-recommit` command, not loop. Asserted in `markup-post-commit-reopen.test.ts` SC2(c).

### Pitfall 3: Stage inverse transform — N/A for the trigger path, but watch the recommit click path

**What goes wrong:** Any pointer-driven path during re-open (clicking to add a new point during the geometry refinement) must convert screen-coords to page-space using `stage.getAbsoluteTransform().copy().invert().point(pointer)`.

**Why it happens:** `recordClick` already does this (useMarkupTool.ts:171). The trigger path uses no pointer at all — the original markup's `points` are already in page-space. So this pitfall is inherited from the existing path; just don't break it.

**How to avoid:** No change required if the existing `recordClick` path is used unchanged. The re-open path simply pre-seeds `points` with already-page-space data.

**Warning sign:** If a planner proposes a "click anywhere to re-open" gesture (deferred for v1.1), they would need to inverse-transform. Not applicable to Phase 13 as scoped.

### Pitfall 4: Wall `pendingWallHeight` reset to 2400 default on cancel

**What goes wrong:** User commits a wall markup at height 3000mm. User re-opens it. The Phase 13 re-open path forgets to pass `wallHeight` through `activatePreset`, so `pendingWallHeight` falls back to the 2400 default. User presses Enter — the re-committed wall is 2400mm tall, silently losing 600mm of height.

**Why it happens:** `activatePreset` line 143 sets `pendingWallHeight: preset.wallHeight ?? 2400`. If the handler in `markup-reopen-ref` doesn't pass `wallHeight: original.wallHeight`, the default wins.

**How to avoid:** Reopen handler must pass `wallHeight: original.type === 'wall' ? original.wallHeight : undefined` (shown in the Pattern 6 code above). Asserted in `markup-post-commit-reopen.test.ts` SC2(c) wall variant.

**Warning sign:** Test that re-opens a wall with `wallHeight: 3000`, presses Enter immediately, asserts the new wall still has `wallHeight: 3000`.

### Pitfall 5: Toast lingers across page changes

**What goes wrong:** Re-open toast fires. User navigates to another page (which kills the re-open per Pitfall 1 fix). Toast still hangs around for the rest of the 2.5s. Confusing.

**Why it happens:** The toast lifecycle is owned by App.tsx via `useEffect(setTimeout)`. Page change clears the re-open snapshot (Pitfall 1) but does NOT clear the toast.

**How to avoid:** Add `setReopenToast(null)` to the page-change effect in App.tsx, OR add a `useEffect` on `currentPage` in App.tsx that clears `reopenToast`. Mirrors the pattern in CanvasViewport.tsx:586-588 (`setToast(null)` on page change for the calibration toast).

**Warning sign:** Test that fires re-open, immediately changes page via `useViewerStore.getState().setPage(2)`, asserts toast is cleared.

### Pitfall 6: Redo of an Esc-cancelled re-open does nothing or duplicates

**What goes wrong:** User commits markup A. User Ctrl+Z (re-opens). User Esc (cancels). User Ctrl+Y. Naive implementation: nothing happens (since we re-pushed the `place` command on Esc, the redo stack is empty). Slightly bad implementation: duplicate place.

**Why it happens:** D-16 says Esc pushes nothing to undoStack. But for the user, the visible action was "Ctrl+Z then Esc" — a no-op. Ctrl+Y has nothing to redo, and that is the correct behaviour. The danger is that the original `place` was popped at re-open trigger and re-pushed on Esc — if the order is wrong, redoStack might contain a stale entry.

**How to avoid:** When the re-open trigger pops the `place` command from undoStack, do NOT push it to redoStack (it is being modified-in-place via the snapshot, not abandoned). When Esc fires, the `place` is re-pushed to undoStack and redoStack is untouched. Result: redoStack is exactly as it was before the user pressed Ctrl+Z. Ctrl+Y after Esc-cancelled re-open does the "right thing" — which is whatever the redo stack already contained (possibly nothing).

**Warning sign:** Test SC5 round-trip: place A, Ctrl+Z re-open, Esc cancel, Ctrl+Y → asserts `redoStack` length unchanged from before the gesture, no markup added.

### Pitfall 7: Re-open trigger fires while a different page's markup is at top of stack

**What goes wrong:** User is on page 1. User commits markup on page 1. User navigates to page 2. User Ctrl+Z. The top of undoStack is page 1's `place` command. Re-open triggers, calls `activatePreset` with `points` from page 1, and we are on page 2 — the re-opened in-progress shape renders on page 2 with page 1's coordinates.

**Why it happens:** `markupStore.undoStack` is global, not page-scoped. Phase 9's existing undo handler restores the markup to its original page regardless of current page; that is correct for whole-markup undo. For re-open, we want the user to be ON the page of the markup.

**How to avoid:** Add a D-17 condition 5 (or fold into condition 2): `top.markup.page === useViewerStore.getState().currentPage`. If the top-of-stack markup belongs to a different page, the re-open path returns `false` and Phase 3's whole-markup undo path takes over. The user can navigate to the markup's page first if they want step-level. Document this in the user constraints as an implicit boundary.

**Warning sign:** Test: commit on page 1, navigate to page 2, Ctrl+Z. Expected: markup A removed from page 1 (Phase 3 path), no re-open transition.

### Pitfall 8: Visibility (hiddenItemNames) skip-render hides the re-opened in-progress shape

**What goes wrong:** Markup A has name "Wire". User toggles "Wire" hidden via totals panel (Phase 8). User Ctrl+Z to re-open. The committed markup is removed; the in-progress shape is rendered — but Phase 8's skip-render branch in the per-tool components ALSO hides the in-progress shape because it has the same name "Wire". The user sees an empty canvas and has no idea the gesture worked.

**Why it happens:** `hiddenItemNames` is read by the renderer components per markup; the in-progress shape is rendered via `markupState.pendingName` which equals "Wire" after the re-open.

**How to avoid:** Either (a) skip-render branch ignores `pendingName` (only filters committed markup ids), or (b) the re-open trigger auto-un-hides the name. Option (a) is simpler — the in-progress preview is rendered from `useMarkupTool` state, not from `pageMarkups`. Verify that the existing per-tool components do NOT consult `hiddenItemNames` for the in-progress branch. If they do, refactor. This must be tested before re-open ships.

**Warning sign:** Test: hide "Wire", re-open a "Wire" markup, assert the preview is visible.

**Caveat — needs codebase verification:** D-25 says "Visibility (hiddenItemNames) and color are unchanged by re-open" — implying the planner needs to verify the in-progress preview is NOT subject to `hiddenItemNames`. Add a Plan-time read of `LinearMarkup.tsx` / `AreaMarkup.tsx` / `PerimeterMarkup.tsx` / `WallMarkup.tsx` to confirm.

### Pitfall 9: StrictMode double-mount registers the re-open handler twice

**What goes wrong:** In dev with React 19 StrictMode, the `useEffect` that registers the re-open handler fires twice on mount. If the second registration happens before the first cleanup, `_markupReopenHandler` ends up holding a closure over a stale `activatePreset` reference (the one from the first render, before StrictMode's intentional remount).

**Why it happens:** Same pattern that bit Phase 10 (RESEARCH §"Pitfall 6"). The current Phase 10 codebase handles it correctly because the cleanup function sets the ref to `null` and the new mount sets it to the new closure.

**How to avoid:** The proposed cleanup `return () => setMarkupReopenHandler(null)` is sufficient. Verify with the existing `markup-tool-strictmode.test.ts` pattern (which already tests strict-mode behaviour for `useMarkupTool`).

**Warning sign:** Test mounted/unmounted twice asserts the final registered handler is the new one.

---

## Code Examples

### Verified: current `MarkupCommand` union

```typescript
// Source: src/renderer/src/types/markup.ts:52-101 (verified 2026-05-21)
export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
  | { type: 'delete-group'; markups: Markup[] }
  | { type: 'recolor-group'; ... }
  | { type: 'edit-markup'; ... }
  | { type: 'move-vertex'; ... }
  | { type: 'move-markups'; ... }
```

### Verified: current `activatePreset` (linear/area/perimeter/wall branch)

```typescript
// Source: src/renderer/src/hooks/useMarkupTool.ts:134-145 (verified 2026-05-21)
setState({
  ...INITIAL_STATE,
  mode: 'drawing',
  toolType: tool,
  pendingName: preset.name,
  pendingCategoryName: preset.categoryName || UNCATEGORIZED,
  pendingColor: preset.color,
  chainArmed: true,
  ...(tool === 'wall' ? { pendingWallHeight: preset.wallHeight ?? 2400 } : {})
})
```

### Verified: current Ctrl+Z dispatch (insertion point)

```typescript
// Source: src/renderer/src/hooks/useKeyboardShortcuts.ts:92-112 (verified 2026-05-21)
if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
  if (isTextInputActive()) return
  e.preventDefault()
  const handledByDraw = getMarkupUndoHandler()?.() ?? false
  if (!handledByDraw) {
    const top = useMarkupStore.getState().undoStack.at(-1)
    let restoredIds: string[] = []
    if (top?.type === 'delete') restoredIds = [top.markup.id]
    else if (top?.type === 'delete-group') restoredIds = top.markups.map((m) => m.id)
    useMarkupStore.getState().undo()
    if (restoredIds.length > 0) {
      useViewerStore.getState().setSelectedMarkupIds(restoredIds)
    }
  }
  return
}
```

### Verified: current Esc handler

```typescript
// Source: src/renderer/src/components/CanvasViewport.tsx:640-668 (verified 2026-05-21)
if (e.key === 'Escape') {
  if (useViewerStore.getState().vertexEditMarkupId !== null) {
    e.preventDefault()
    cancelVertexEdit()
    return
  }
  if (markupState.mode === 'drawing' || markupState.mode === 'confirming' || markupState.mode === 'naming' || markupState.mode === 'placing') {
    e.preventDefault()
    cancelMarkup()
    useViewerStore.getState().setActiveTool('select')
    return
  }
  if (useViewerStore.getState().activeTool === 'select') {
    clearSelection()
  }
  return
}
```

### Verified: existing toast slot in App.tsx

```typescript
// Source: src/renderer/src/App.tsx:317-339 (verified 2026-05-21)
{saveToast !== null && (
  <div
    role="status"
    aria-live="polite"
    style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      padding: '8px 16px', background: '#252526', border: '1px solid #3c3c3c',
      borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 15,
      display: 'flex', gap: 16, fontSize: 13, color: '#cccccc'
    }}
  >
    <span>{saveToast}</span>
    <button onClick={() => setSaveToast(null)} style={{ ... }}>Dismiss</button>
  </div>
)}
```

### Verified: existing module-ref pattern (the template Phase 13 follows)

```typescript
// Source: src/renderer/src/lib/markup-undo-ref.ts:15-33 (verified 2026-05-21)
let _markupUndoHandler: (() => boolean) | null = null
export function setMarkupUndoHandler(handler: (() => boolean) | null): void { _markupUndoHandler = handler }
export function getMarkupUndoHandler(): (() => boolean) | null { return _markupUndoHandler }

let _markupRedoHandler: (() => boolean) | null = null
export function setMarkupRedoHandler(handler: (() => boolean) | null): void { _markupRedoHandler = handler }
export function getMarkupRedoHandler(): (() => boolean) | null { return _markupRedoHandler }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Whole-markup post-commit undo only (Ctrl+Z deletes the entire committed shape) | Phase 13 adds re-open semantics for multi-point markups while preserving Phase 3 behaviour for count pins and edit/move/delete commands | Phase 13 (this phase) | Estimator can refine vertex placement without redrawing from scratch — addresses user's literal request "can it be just a step-level undo?" |
| Phase 10 step-level in-progress undo (Ctrl+Z pops points only DURING drawing) | Phase 13 extends step-level semantics ACROSS the commit boundary | Phase 13 | Symmetric in-progress + post-commit step-level undo. |

**Deprecated/outdated:** Nothing. Phase 13 is purely additive.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing in-progress preview renderers (`LinearMarkup`, `AreaMarkup`, `PerimeterMarkup`, `WallMarkup`) do NOT consult `hiddenItemNames` for the in-progress branch | Pitfall 8 | If they DO consult it, re-open silently produces an empty canvas when the markup name is hidden. **Planner MUST verify** by reading the four renderer components before Wave 1. |
| A2 | Page navigation during re-open should restore the original markup (treat as implicit Esc) | Pitfall 1 | If user expects re-open to survive page navigation, the proposed `useEffect` cleanup would surprise them. Recommendation: document as locked decision after planner confirms with user via /gsd-discuss-phase or by precedent (Phase 6 cleared in-progress flow on page nav at line 610). |
| A3 | The 2.5s auto-dismiss without explicit "dismiss on next interaction" is acceptable UX per D-19 | Pattern 9 toast dismissal | If user wants explicit early dismissal, option (b) (callback-based) is needed. Adds prop-drilling. |
| A4 | `top.markup.page === useViewerStore.getState().currentPage` should be added as D-17 condition 5 | Pitfall 7 | Without it, re-open on a different page produces a visual bug. CONTEXT.md does NOT explicitly say "same page" but D-13 implies it ("hands off to drawing state machine" — drawing is page-scoped). |

**Recommendation to planner:** Resolve A1, A2, A4 before Wave 1 by reading the four renderer components (A1), confirming the page-nav cancellation semantics with the user via the planning gate (A2), and adopting A4 as a 5th D-17 condition (no user input needed — purely defensive).

---

## Open Questions

1. **Should page navigation during re-open auto-cancel and restore?**
   - What we know: line 610 of CanvasViewport.tsx clears `vertexEditMarkupId`, drag preview, etc. on page change. In-progress markup state (`useMarkupTool`) is NOT cleared today because users may need to draw across pages (but in practice, every commit dispatch reads `currentPage` so a draw-across-page would mis-page the markup).
   - What's unclear: explicit user intent for re-open + page change. CONTEXT.md does not address it.
   - Recommendation: Auto-cancel and restore (treat as implicit Esc). Document as new D-26 once confirmed. Avoids "leaking" re-open state into another page's interaction graph.

2. **Should the redo path of a `reopen-recommit` command preserve the user's intermediate point-pop / point-push state?**
   - What we know: D-16 says the whole gesture is ONE command. The intermediate point edits are transient. Undo of `reopen-recommit` restores the original markup. Redo re-applies the FINAL committed state — not the intermediate steps.
   - What's unclear: nothing actionable; this is the correct semantics per D-16. Just being explicit.
   - Recommendation: assert in SC5 round-trip that Ctrl+Y restores `newMarkup` (final state), NOT the intermediate point-by-point progression.

3. **Confirm in-progress preview renderers do not consult `hiddenItemNames` (A1)**
   - What we know: D-25 says re-open does not change visibility behaviour. The committed-markup skip-render branch is gated on `hiddenItemNames.has(name)`.
   - What's unclear: whether the in-progress preview path is gated by the same check.
   - Recommendation: planner verifies by reading `LinearMarkup.tsx`, `AreaMarkup.tsx`, `PerimeterMarkup.tsx`, `WallMarkup.tsx` in Wave 1 Task 1. If gated, refactor to bypass for in-progress state.

---

## Environment Availability

Phase 13 is renderer-only with no new external dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / Vitest | Test runner | Yes | vitest ^4.1.1 (verified by package.json) | — |
| Existing project skills | none defined | — | — | — |

No missing dependencies. No fallback required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 (verified — package.json devDependencies) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/tests/markup-post-commit-reopen.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC1 | Ctrl+Z on a committed linear/area/perimeter/wall populates `useMarkupTool.points`, sets `mode='drawing'`, removes original from `markupStore.pageMarkups`, clears selection and vertex-edit | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC1"` | Wave 0 |
| SC2(a) | After re-open, Ctrl+Z pops a point (Phase 10 `popLastPoint` path still works) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC2.*point pop"` | Wave 0 |
| SC2(b) | After re-open, Ctrl+Y re-adds the popped point (Phase 10 `repushLastPoint` still works) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC2.*re-push"` | Wave 0 |
| SC2(c) | Enter re-commits a modified shape with original name/category/color (and wallHeight for wall) — new markup has fresh id but same identity | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC2.*re-commit identity"` | Wave 0 |
| SC3 | Toast fires on re-open and auto-dismisses ~2.5s later | unit (App-level test or visual) | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC3"` | Wave 0 |
| SC4 | Esc restores original markup with deep equality on points and id preserved; `undoStack` has the original `place` command back | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC4"` | Wave 0 |
| SC5 | Undo of `reopen-recommit` restores original; redo re-applies the modified new markup (round-trip stability) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "SC5"` | Wave 0 |
| EDGE-1 | Count pin commit at top of stack → re-open does NOT fire; whole-markup undo path used as today (Phase 3 behaviour) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "count pin"` | Wave 0 |
| EDGE-2 | Re-open while text input focused → no-op (`isTextInputActive()` guard inherited from Phase 3/10) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "text input"` | Wave 0 |
| EDGE-3 | Re-open while vertex-edit active (`vertexEditMarkupId !== null`) → no-op (D-17 condition 4) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "vertex edit"` | Wave 0 |
| EDGE-4 | Re-open when top of stack is from another page → no-op (A4) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "cross-page"` | Wave 0 |
| EDGE-5 | Wall re-open preserves `wallHeight` (e.g. 3000mm → 3000mm, NOT default 2400) | unit | `npx vitest run src/tests/markup-post-commit-reopen.test.ts -t "wall height"` | Wave 0 |
| REGRESSION | Existing `markup-shortcuts.test.ts` (Ctrl+Z whole-markup undo round-trip) continues to pass after Phase 13 | unit (existing) | `npx vitest run src/tests/markup-shortcuts.test.ts` | YES |
| REGRESSION | Existing `markup-tool-point-redo.test.ts` (Phase 10) continues to pass | unit (existing) | `npx vitest run src/tests/markup-tool-point-redo.test.ts` | YES |
| REGRESSION | Existing `markup-tool-pop-last-point.test.ts` (Phase 3) continues to pass | unit (existing) | `npx vitest run src/tests/markup-tool-pop-last-point.test.ts` | YES |

### Test scaffolding (mirror existing patterns)

The new test file `markup-post-commit-reopen.test.ts` should:

- Use the `HookHost` / `Probe` pattern from `markup-tool-pop-last-point.test.ts:44-78` for `useMarkupTool` hook integration
- Use the dynamic import pattern from `markup-tool-pop-last-point.test.ts:219-231` for `markup-reopen-ref` module testing
- Use the `useMarkupStore.setState({ pageMarkups: {}, ... })` `beforeEach` reset
- Use the `useViewerStore.setState({ currentPage: 1, ... })` `beforeEach` reset
- Use `globalThis.IS_REACT_ACT_ENVIRONMENT = true` for React 19 act compatibility

### Sampling Rate
- **Per task commit:** `npx vitest run src/tests/markup-post-commit-reopen.test.ts src/tests/markup-shortcuts.test.ts src/tests/markup-tool-point-redo.test.ts src/tests/markup-tool-pop-last-point.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/tests/markup-post-commit-reopen.test.ts` — NEW; covers SC1-SC5 + 5 edge cases. Mirror `markup-tool-point-redo.test.ts` test-file scaffolding (HookHost, Probe, makeFakeStage, dynamic import for ref module).
- [ ] No framework install needed (Vitest 4.1.1 already in devDependencies)
- [ ] No new shared fixtures needed (the existing `markup-tool-pop-last-point.test.ts` scaffolding is sufficient)

---

## Security Domain

> `security_enforcement` not explicitly set in `.planning/config.json`; treating as enabled per the GSD default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | renderer-only feature, single-user desktop app |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | no access control |
| V5 Input Validation | no | no user-supplied text reaches new code paths (text-input guard already inherited via `isTextInputActive`) |
| V6 Cryptography | no | no cryptographic operations |
| V8 Data Protection at Rest | no | feature does not persist (in-memory undo stack only) |
| V12 Files and Resources | no | no file I/O changes |

**Conclusion:** Phase 13 is a UI-state extension. No security domain applies. No new attack surface, no new persistence path, no new IPC boundary.

### Known Threat Patterns for renderer-only React/Konva

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale module ref leak (HMR / StrictMode double-mount) | Tampering / DoS | `useEffect` cleanup sets ref to `null`; Phase 10 prior art confirms this is sufficient |
| Unbounded undo stack growth | DoS | Existing `UNDO_STACK_MAX = 50` in `types/markup.ts:114` already caps growth; reopen-recommit commands count toward the cap normally |
| Cross-render state pollution between users | N/A | Single-user app; no concern |

### Project Constraints (from CLAUDE.md)

- **Platform:** Windows desktop — Phase 13 changes are renderer-only, no platform-specific code
- **Offline:** Phase 13 requires no network; fully compatible
- **PDF rendering:** Phase 13 does NOT touch PDF.js or canvas rendering — only the Konva overlay state machine
- **Markup persistence:** Phase 13 markups (the `reopen-recommit` command's `newMarkup`) are written to `markupStore.pageMarkups` via the existing path, so they serialise to `.clmc` exactly as today

### GSD workflow enforcement (CLAUDE.md)

- This research is itself an artifact of `/gsd-plan-phase` — compliant.
- Implementation will go through `/gsd-execute-phase` per the locked GSD workflow.

---

## Plan-Size Recommendation

The v1.1-CONTEXT.md estimate was **~2 plans for Phase C**. Based on this research, **3 plans across 2 waves is the recommended split:**

### Wave 0 — RED tests + types/store foundations (parallelisable)

| Plan | Files | Surface |
|------|-------|---------|
| **13-01-tdd-tests-and-types** | `src/tests/markup-post-commit-reopen.test.ts` (NEW), `src/renderer/src/types/markup.ts` (extend `MarkupCommand` union, add `isMultiPointMarkup` type guard) | RED tests covering all 5 SCs + 5 edge cases + type extension that the tests reference |

### Wave 1 — production code (depends on Wave 0)

| Plan | Files | Surface |
|------|-------|---------|
| **13-02-store-and-ref** | `src/renderer/src/stores/markupStore.ts` (add `reopen-recommit` undo/redo branches, `commitReopen`, `removeForReopen`, `restoreFromReopen` actions), `src/renderer/src/lib/markup-reopen-ref.ts` (NEW) | Pure store + ref logic, easily unit-testable in isolation |
| **13-03-dispatch-hook-toast** | `src/renderer/src/hooks/useMarkupTool.ts` (`activatePreset` extension + `commitShape` extension), `src/renderer/src/hooks/useKeyboardShortcuts.ts` (Ctrl+Z branch), `src/renderer/src/components/CanvasViewport.tsx` (reopen handler registration + Esc extension + page-nav cancel effect + `onReopenToast` prop), `src/renderer/src/App.tsx` (reopenToast state + useEffect + JSX block + `onReopenToast` wiring) | All the integration glue; converts RED tests to GREEN |

### Justification for 3 plans (vs estimate of 2)

- **Surface count:** 7 files touched (types, store, ref module, hook, dispatch, viewport, App). 2 plans = average 3.5 files each; 3 plans = average 2.3 files each. Smaller plans = lower blast radius for executor errors.
- **TDD discipline:** Wave 0 produces a failing test file before any production code is written (matches Phase 10 P01's pattern). Bundling tests with production code into 2 plans risks "tests written to fit the code" rather than "code written to pass the tests".
- **Parallelisation:** Plan 13-02 (store + ref) has no React-render dependency and can be developed in parallel with Plan 13-03's hook/dispatch work once Wave 0 lands. With 2 plans this parallelism is lost.
- **Review surface:** A planner-reviewer can verify Plan 13-02 (store reducer correctness) independently of Plan 13-03 (React integration). Bundling the two would force a single large diff review.

If forced to 2 plans, the split would be Plan 1 = tests + types + store + ref; Plan 2 = hook + dispatch + viewport + App. This is workable but loses the Wave 0 RED-first discipline.

---

## Sources

### Primary (HIGH confidence — verified by direct file read this session)
- `src/renderer/src/hooks/useMarkupTool.ts` (lines 1-450) — `MarkupDrawState`, `INITIAL_STATE`, `activate`, `activatePreset`, `cancel`, `commitShape`, `recordClick`, `popLastPoint`, `repushLastPoint`
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` (lines 1-230) — Ctrl+Z dispatch (92-112), Ctrl+Y dispatch (118-127), `isTextInputActive()` (26-41)
- `src/renderer/src/lib/markup-undo-ref.ts` (full 33 lines) — module-level handler ref pattern, already extended in Phase 10 with redo pair
- `src/renderer/src/stores/markupStore.ts` (lines 1-590) — `MarkupCommand` consumption, undo/redo reducer switch, `placeMarkup`, `deleteMarkup`, `moveMarkups`
- `src/renderer/src/types/markup.ts` (lines 1-117) — `MarkupCommand` discriminated union, `Markup` types, `UNDO_STACK_MAX`
- `src/renderer/src/types/viewer.ts` (lines 1-99) — `isMarkupTool` type guard pattern to mirror, `vertexEditMarkupId` field
- `src/renderer/src/components/CanvasViewport.tsx` (lines 1-2012, key sections 280-330, 530-580, 620-830, 1340-1395) — useMarkupTool destructure (296-310), undo/redo handler wiring (315-327), Esc handler (640-668), Enter handler (671-697), chain auto-commit effect (725-746), `commitShape` callsite via Enter
- `src/renderer/src/App.tsx` (lines 60-135, 295-390) — toast slots (saveToast, exportToast, copyToast), parent-owned 2000ms `useEffect` lifecycle, JSX positioning convention
- `src/renderer/src/components/ConfirmationToast.tsx` (full 72 lines) — parent-owned-lifecycle convention, no internal setTimeout
- `src/tests/markup-tool-pop-last-point.test.ts` (lines 1-100) — HookHost/Probe/makeFakeStage scaffolding, dynamic import for ref module testing
- `.planning/phases/10-granular-undo-foundation/10-RESEARCH.md` — direct prior art, dispatch tree pattern, module-ref pattern
- `.planning/phases/10-granular-undo-foundation/10-01-PLAN.md` and `10-02-PLAN.md` — TDD wave pattern Phase 13 follows
- `.planning/phases/13-post-commit-step-level-undo/13-CONTEXT.md` — locked decisions D-10 through D-25
- `.planning/phases/v1.1-planning/v1.1-CONTEXT.md` — original Phase C scope, ~2 plan estimate, user intent quote
- `.planning/STATE.md` (lines 80-162) — full "Key Decisions Locked" table, including all 13 Phase 9/10/12 decisions, locked patterns (stage transform, module refs, chainArmed, layer split, parent toast lifecycle)
- `.planning/REQUIREMENTS.md` — MARK-09 / MARK-10 baseline (v1 complete)
- `package.json` — dependency versions verified (Vitest 4.1.1, React 19.2.1, Konva 10.2.3, Zustand 5.0.12)
- `.planning/config.json` — workflow flags (nyquist_validation: true, plan_check: true, verifier: true)

### Secondary (MEDIUM confidence — derived from cross-file pattern reading)
- Visibility skip-render pattern in `LinearMarkup.tsx` / `AreaMarkup.tsx` / `PerimeterMarkup.tsx` / `WallMarkup.tsx` — **NOT directly read in this session**. Planner must verify Assumption A1 before Wave 1.

### Tertiary (LOW confidence — none)
None. All claims are codebase-sourced.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies pinned and verified against package.json
- Architecture (re-open trigger, command shape, dispatch insertion): HIGH — direct extension of Phase 10's verified pattern
- Pitfalls (chainArmed, wallHeight, page navigation, visibility): MEDIUM-HIGH — most pitfalls are derived from Phase 8/10/12 prior art; Pitfall 8 (visibility) carries A1 risk that planner must resolve
- Plan-size hint (3 plans, 2 waves): MEDIUM — judgement call against v1.1-CONTEXT.md's ~2 estimate; justified by file count and TDD discipline but the planner may legitimately choose 2

**Research date:** 2026-05-21
**Valid until:** Stable — this is code-level research on a frozen-in-version codebase. Valid until any of: useMarkupTool, useKeyboardShortcuts, markupStore, App.tsx toast slot, or types/markup.ts changes in a structurally-relevant way.
