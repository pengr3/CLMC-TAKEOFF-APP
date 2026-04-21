---
phase: 03-markup-tools-and-editing
plan: 05
status: partial
checkpoint_result: issues_found
supersedes_into: 3.1
updated: 2026-04-21
---

# Plan 03-05 — Keyboard Shortcuts & Human Verification

## Outcome

**Task 1 — Keyboard shortcuts (automated): PASS**
- Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z wired to `markupStore.undo()` / `.redo()`
- `isTextInputActive()` helper guards against global-undo stealing browser edit-undo (Pitfall 7)
- 9 new tests in `src/tests/markup-shortcuts.test.ts` — all green
- Full suite: 152/152 passing, typecheck clean

**Task 2 — Human verification checkpoint: PARTIAL (gaps found)**
- 25/33 steps approved
- 8 findings captured below — routed to decimal phase **3.1** for combined gap closure + design changes (option 2 chosen by user)

## Inline fixes committed during the checkpoint

Two pre-existing Zustand selector anti-patterns surfaced as infinite-render crashes before the user could reach step 1. Both fixed inline (with user approval) to unblock verification:

| Commit | Fix |
|--------|-----|
| `0e1a8e0` | `CanvasViewport.tsx` — replaced `?? []` selector fallback with a module-level `EMPTY_MARKUPS` stable reference. Fresh `[]` per call was breaking `useSyncExternalStore`'s Object.is snapshot check. |
| `56c5baf` | `CategoryAutocomplete.tsx` — replaced `useMarkupStore((s) => s.getAllCategories())` with primitive-field selectors (`categories`, `categoryOrder`) plus `useMemo` derivation. Method invocation inside a selector returns a fresh array every call → same crash class. |

Both fixes are verified by the existing test suite and the fact that verification then proceeded.

## Findings from the checkpoint

### Bugs (for 3.1 gap closure)

**B1 — Spacebar blocked in MarkupNamePopup input fields**
- File: `src/renderer/src/hooks/useViewportControls.ts:130-136`
- Global `keydown` listener calls `e.preventDefault()` for **every** spacebar press, with no focus check
- Cannot enter multi-word names like "Light Switch"
- Fix shape: guard the preventDefault + `setSpaceHeld(true)` block with `isTextInputActive()` (helper already shipped in Plan 03-05)

**B2 — Linear markup label missing or illegible (step 9)**
- File: `src/renderer/src/components/markup/LinearMarkup.tsx:33, 52-64`
- Font too small: `LABEL_FONT_BASE = 12` in `src/renderer/src/types/markup.ts:61` resolves to ~12px screen-size at typical zoom levels
- Midpoint is picked by vertex **index** (`Math.floor(points.length / 2)`) not by true arc-length midpoint → label lands on an arbitrary vertex, not geometric center
- Fix shape: raise `LABEL_FONT_BASE` to 14–16; compute a true arc-length midpoint from `polylineLength` cumulative distance

**B3 — Area/perimeter labels barely readable (step 14)**
- Files: `src/renderer/src/components/markup/AreaMarkup.tsx:26`, `PerimeterMarkup.tsx` (same `labelFontSize`)
- Same root as B2 — fix together via `LABEL_FONT_BASE` tuning; also consider a slightly larger size for the two-line polygon labels

**B4 — Existing markups shrink/enlarge after zoom when placing a new count**
- File: `src/renderer/src/components/CanvasViewport.tsx:369`
- `const currentZoom = getViewport(currentPage).zoom || 1` reads through `useViewerStore((s) => s.getViewport)` which subscribes only to the **function reference** (stable, never triggers re-render), NOT the viewport data
- Zoom changes update the store but `CanvasViewport` doesn't re-render → all zoom-compensated sizes (pinRadius, fontSize, strokeWidth, labelOffsetX) continue using the **stale** `currentZoom`
- When a later state change (e.g. entering `placing` mode for a new count) finally triggers a re-render, `currentZoom` refreshes and every markup "snaps" to the correct compensated size — producing the shrink/enlarge feel
- Fix shape: subscribe to the viewport slice directly, e.g. `useViewerStore((s) => s.viewports[currentPage]?.zoom ?? 1)` — with a stable fallback to avoid regressing the same EMPTY_MARKUPS bug class
- Scope: affects ALL four markup components + calibration overlay sizing. Foundational fix.

### Design changes (requirement shifts — 3.1 must revise UI-SPEC and MARK-08)

**D1 — Count pin: circle with sequence number INSIDE, no external "Name N" label**
- Contradicts UI-SPEC D-04 and D-13 ("Name N" text label)
- Changes `CountPinMarkup.tsx` visual rendering
- `markup.name` remains the grouping key for BOQ export (later phase); `markup.sequence` is the visible number
- Pairs naturally with B4 (same file)

**D2 — Free color per markup, not inherited from category**
- Contradicts MARK-08 ("distinct colors per category") — supersedes that must-have
- Schema change: add `color: string` to each `Markup` variant
- UI change: add color picker to `MarkupNamePopup`
- Category model: keeps the name as a group key; color becomes a suggested default (or removed entirely from Category)
- Test impact: Plan 01's category-color propagation tests need revision
- Cross-cuts all four markup types

### Accepted behavior (not a gap)

- Step 32: "Can't abruptly close an under-vertex polygon" — this is the 3-vertex minimum working as designed

## Roadmap status

- ROADMAP.md Phase 3 row: **NOT** marked complete (remains `In Progress`)
- STATE.md Current Position: **NOT** advanced to Phase 4
- Phase 3.1 will supersede the failed checkpoint items and, on completion, close Phase 3
