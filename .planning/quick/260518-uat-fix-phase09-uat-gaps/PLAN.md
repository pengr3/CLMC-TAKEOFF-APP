---
id: 260518-uat
title: Fix Phase 09 UAT gaps — Test 9 (Ctrl+Z selection-restore) + Test 11 (LMB no-pan during markup)
date: 2026-05-18
status: in-progress
mode: quick
---

# Quick Task 260518-uat: Phase 09 UAT gap fixes

## Description

Phase 09 UAT (recorded in `.planning/phases/09-.../09-UAT.md`) ran 12 scenarios on 2026-05-18; 11 pass, 2 fail with root causes diagnosed. Apply both fixes atomically and re-verify in the live Electron app.

## Task 1: useKeyboardShortcuts.ts — Ctrl+Z restores selection after delete-undo

**Truth:** After Ctrl+A → Delete → Ctrl+Z, the restored markups must be re-selected (selection rings reappear), matching the pre-delete state.

**Action:** In the Ctrl+Z handler, before calling `useMarkupStore.getState().undo()`, peek `undoStack.at(-1)`. If `type === 'delete'`, capture `[markup.id]`; if `type === 'delete-group'`, capture `markups.map(m => m.id)`. After `undo()` returns, call `useViewerStore.getState().setSelectedMarkupIds(restoredIds)` (skip when no IDs captured). Only runs on the real-undo path — not the in-progress-draw `getMarkupUndoHandler` early-exit.

**Verify:** `npx vitest run` stays green (no regression to undo/redo or selection tests). Live UAT Test 9 passes.

**Done when:** `useKeyboardShortcuts.ts` Ctrl+Z block contains the peek + setSelectedMarkupIds call; vitest 473/473 green.

## Task 2: useViewportControls.ts — LMB never pans during markup

**Truth:** When a markup tool (count / linear / area / perimeter / wall) is active, LMB drag must not pan the canvas. Only MMB and Spacebar+LMB pan.

**Action:** Line 84 — remove the `activeTool !== 'select'` branch from the `Konva.dragButtons` formula; restore to `Konva.dragButtons = spaceHeld ? [0, 1] : [1]`. Drop the now-unused `activeTool` selector and useEffect dep. Update surrounding comment.

**Verify:** Typecheck clean (no orphan `activeTool` reference). Vitest green. Live UAT Test 11 passes.

**Done when:** `useViewportControls.ts` line 84 reads `Konva.dragButtons = spaceHeld ? [0, 1] : [1]`; `activeTool` selector removed; tests + typecheck green.

## Task 3: Update 09-UAT.md, commit, ask user to re-verify

**Action:** Mark gaps in 09-UAT.md as `status: fixed`, reference this quick task. Commit code fixes atomically (single commit, both files). Commit docs (PLAN.md, SUMMARY.md, STATE.md, 09-UAT.md) separately. Update STATE.md Quick Tasks table. Request live UAT re-verification of tests 9 and 11 in the Electron app.

**Done when:** Code commit lands; STATE.md table updated; user has launched the dev app and reported PASS on tests 9 and 11.

## Files modified

- `src/renderer/src/hooks/useKeyboardShortcuts.ts`
- `src/renderer/src/hooks/useViewportControls.ts`
- `.planning/phases/09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion/09-UAT.md`
- `.planning/STATE.md`
