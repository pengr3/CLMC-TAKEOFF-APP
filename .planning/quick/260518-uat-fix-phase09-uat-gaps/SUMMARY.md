---
id: 260518-uat
title: Fix Phase 09 UAT gaps — Test 9 (Ctrl+Z selection-restore) + Test 11 (LMB no-pan during markup)
date: 2026-05-18
status: complete
mode: quick
code_commit: 4db36bb
---

# Quick Task 260518-uat: Phase 09 UAT gap fixes — SUMMARY

## Outcome

Both UAT gaps recorded in `.planning/phases/09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion/09-UAT.md` Gaps section are fixed in a single atomic commit. Automated regression suite green; awaiting live UAT re-verification of Tests 9 + 11 in the Electron app.

## Changes

### Task 1 — `src/renderer/src/hooks/useKeyboardShortcuts.ts`

Inside the `Ctrl+Z` handler (`!handledByDraw` branch), peek `useMarkupStore.getState().undoStack.at(-1)` BEFORE calling `undo()`:

- `top.type === 'delete'` → collect `[top.markup.id]`
- `top.type === 'delete-group'` → collect `top.markups.map(m => m.id)`
- otherwise → empty array

After `undo()`, when `restoredIds.length > 0`, call `useViewerStore.getState().setSelectedMarkupIds(restoredIds)`. Selection rings reappear on the restored markups, completing the round-trip.

Discriminator names verified against `src/renderer/src/types/markup.ts:52-55` (`MarkupCommand` union).

### Task 2 — `src/renderer/src/hooks/useViewportControls.ts`

Line 84 — formula simplified:

```
- Konva.dragButtons = spaceHeld || activeTool !== 'select' ? [0, 1] : [1]
+ Konva.dragButtons = spaceHeld ? [0, 1] : [1]
```

Removed the now-unused `activeTool` selector + its useEffect dep. Updated the surrounding comment (lines 75-82) to drop the stale active-tool branch. LMB now reserved for tool actions in every mode; only MMB and Spacebar+LMB pan.

## Verification

- `npm run typecheck` → clean (no orphan `activeTool` reference; no untyped command shape)
- `npx vitest run` → 66 test files, **473 / 473 pass** (no regression to undo/redo, selection, viewport, or rubber-band tests)
- Live UAT re-verification of Tests 9 + 11 → **pending user** (next step)

## Decisions

- **Selection-restore lives in the Ctrl+Z handler, not inside `markupStore.undo()`.** Wave 0 SUMMARY established that the keyboard handler owns the selection lifecycle; `markupStore` stays free of `viewerStore` imports. Peeking the stack from the handler preserves that boundary.
- **Peek then undo, do not restore selection via the undo() return value.** `undo()` returns `void`; adding a return type would touch the markupStore contract. Peeking the top of the stack from outside the store is the minimal-diff path.
- **Skip selection-restore for non-delete commands.** A `place` or `edit-markup` undo should not force-select anything — `restoredIds.length > 0` gate keeps selection unchanged for those code paths.
- **Drop the `activeTool` selector entirely** rather than keeping it for future use. YAGNI per CLAUDE.md "do not design for hypothetical future requirements." If markup tools ever need a different pan profile, re-introduce it then.

## Commit

- Code: `4db36bb` — `fix(09-03): Ctrl+Z restores selection + LMB no-pan during markup (UAT 9 + 11)`
- Docs: pending (this SUMMARY + 09-UAT.md gap status updates + STATE.md Quick Tasks row)

## Follow-ups

- User to launch `npm run dev`, place at least 2 markups, then run UAT Tests 9 + 11 from `09-UAT.md`. If both pass, mark the gaps as `status: fixed` (already pre-marked here pending user confirmation) and resume Plan 09-05 closure.
