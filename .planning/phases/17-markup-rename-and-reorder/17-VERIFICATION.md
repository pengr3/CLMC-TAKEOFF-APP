---
phase: 17-markup-rename-and-reorder
verified: 2026-07-10T10:50:00Z
status: human_needed
score: 10/10 SPEC acceptance criteria verified; 11/11 CONTEXT decisions (D-01..D-11) verified
overrides_applied: 0
deferred: []
human_verification:
  - test: "Grip-drag feel (insertion line + lifted row) on both surfaces"
    expected: "Dragging a grip handle lifts the row, follows the cursor, and shows a clear insertion line at the drop boundary — matches the app's other drag interactions"
    why_human: "Visual/tactile feel of drag animation cannot be verified by static analysis or jsdom tests; explicitly deferred to phase UAT by every Wave-3/4 plan's VALIDATION § Manual-Only note"
  - test: "Collision message readability beneath a dense totals/Estimate row"
    expected: "The 'A group named X already exists' block reads clearly without visually colliding with adjacent rows"
    why_human: "Visual layout/density judgment, not testable via grep or jsdom"
  - test: "Reordered-row visual parity across totals panel, Estimate sheet, and an opened xlsx/csv export file"
    expected: "The same row order appears in all three surfaces after a drag reorder"
    why_human: "Confirmed at the data layer (shared aggregator + writer tests), but visually opening the exported file was not performed by this verifier — recommended as a quick manual spot-check before closing the phase"
---

# Phase 17: Markup Rename and Reorder Verification Report

**Phase Goal:** From the totals panel and the Estimate sheet, an estimator can rename any already-plotted markup group and reorder items within a category — without re-drawing — where a rename carries the group's pricing/color/hidden-state across, and a chosen row order persists in the `.clmc` and is shared identically by the totals panel, the Estimate sheet, and the BOQ export. (Move/Copy/Duplicate added during discuss-phase.)

**Verified:** 2026-07-10T10:50:00Z
**Status:** human_needed — all automated checks pass (10/10 SPEC criteria, 11/11 decisions); 3 visual/tactile UX items remain for manual UAT per the gate rule that any non-empty human-verification list overrides an otherwise-clean score
**Re-verification:** No — initial verification

## Goal Achievement

### Automated Gates

| Gate | Command | Result |
|------|---------|--------|
| Full test suite | `npx vitest run` | **786 tests / 102 files — all passed** (confirmed by direct execution, not SUMMARY claim) |
| Typecheck | `npm run typecheck` | clean (node + web), exit 0 |
| Production build | `npm run build` | clean — typecheck + electron-vite build (main/preload/renderer) all succeeded |
| Phase-17 test files only | `npx vitest run <16 phase-17 files>` | **131 tests / 16 files — all passed**, isolated re-run |

### SPEC Acceptance Criteria (17-SPEC.md, 10 items)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Rename updates every markup's name + re-keys rates/hiddenItemNames; one Ctrl+Z reverts | ✓ VERIFIED | `markupStore.ts:494-586` `renameGroup` re-keys `rateReKeys`/`hiddenReKeys`/`orderReKeys` before `set()`; `rename-group-command.test.ts` + `group-undo-atomic.test.ts` (rename block) prove name flip + 3-key re-key + one-undo cross-store revert |
| 2 | Rename onto existing same-type name is BLOCKED with inline message, both groups unchanged | ✓ VERIFIED | `collisionExists` (`group-ops.ts:49-58`) checked before any write; `rename-group-collision.test.ts` asserts `{ok:false}`, zero name/rate/hidden mutation, `isDirty` stays `false`; `InlineRenameInput.tsx` mounts `RenameCollisionMessage` on `{ok:false}` and keeps the editor open with the typed text |
| 3 | Rows draggable on BOTH totals panel and Estimate sheet within a category | ✓ VERIFIED | `useRowReorder` (`useRowReorder.ts`) wired into both `TotalsCategoryBlock.tsx` (`onGripPointerDown`, `insertionIndex`, `activeSurface`) and `EstimateCategoryBlock.tsx` (identical pattern); grip present in `TotalsRow.tsx` and `EstimateRow.tsx` |
| 4 | Manual order persists across save/reload and is identical across totals/Estimate/export | ✓ VERIFIED | `boq-aggregator.ts:95-96,229-232` ranks entries by `categoryItemOrder`; `useBoqLive.ts` feeds both `TotalsPanel` and `EstimatePanel` from the same `aggregateBoq()` call; `boq-writers.ts:234,424` iterate `cat.items` in array order (no re-sort) — confirmed by direct grep, not writer-change; `boq-writers-xlsx.test.ts`/`boq-writers-csv.test.ts` assert non-alphabetical (`Zebra` before `Apple`) order preserved; `project-order-roundtrip.test.ts` proves save/reload round-trip |
| 5 | A never-reordered category lists rows in placement order, not alphabetical | ✓ VERIFIED | `grep -c "localeCompare" boq-aggregator.ts` → **0** (confirmed directly); `boq-aggregator-order.test.ts` asserts an absent order (`{}`) yields placement order (e.g., `Zebra` added before `Apple` stays first) |
| 6 | Move reassigns group to another category with unchanged qty/rate; Ctrl+Z restores | ✓ VERIFIED | `moveGroup` (`markupStore.ts:588-670`) reassigns `categoryId` only, rate untouched (category-independent `name\|type` key); `move-group-command.test.ts` (8 cases) + `group-undo-atomic.test.ts` (move block) prove single-store one-Ctrl+Z revert of categoryId + order |
| 7 | Copy creates independent "{name} (n)" row, same qty, blank rate, distinct key; source geometry edits don't affect the copy | ✓ VERIFIED | `snapshotGroup` (`group-ops.ts:69-101`) deep-clones `points`/`arcs`, fresh `crypto.randomUUID()` id; `copy-duplicate-group.test.ts` explicitly mutates the source via `moveVertex` and asserts the copy's points are unchanged |
| 8 | Duplicate creates independent "{name} (n)" row in SAME category without doubling source qty | ✓ VERIFIED | `duplicateGroup` uses source `categoryId`; `copy-duplicate-group.test.ts` asserts source markup count unchanged (no doubling) and fresh count sequences (Pitfall 6) |
| 9 | Copy/Duplicate reverted by ONE Ctrl+Z removing both new markups AND rate entry | ✓ VERIFIED | `group-undo-atomic.test.ts` copy/duplicate blocks: one `undo()` → `markupsNamed('X (2)')` length 0 AND `rates['X (2)|type']` undefined; exactly one undo-stack entry consumed per op |
| 10 | Old `.clmc` (no order field) loads without error, placement order; no `formatVersion` bump | ✓ VERIFIED | `project-schema.ts` — `categoryItemOrder?` added beside `rates?`/`hiddenItemNames?`, `validateV2` unchanged, `formatVersion` still `2`; `project-order-roundtrip.test.ts` asserts old-file → `{}` (no throw), malformed → coerced, and `formatVersion` stays `2` after a round-trip |

**Score:** 10/10 SPEC acceptance criteria verified.

### CONTEXT Decisions (17-CONTEXT.md, D-01..D-11)

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 (shared right-click menu, Copy-as-text totals-only) | ✓ VERIFIED | `TotalsRowContextMenu.tsx` renders 4 group items + prop-gated `showCopyAsText`; `TotalsPanel.tsx` uses default `true`, `EstimatePanel.tsx` passes `showCopyAsText={false}` (confirmed by grep) |
| D-02 (inline rename, double-click, e.detail guard on totals only) | ✓ VERIFIED | `TotalsRow.tsx:179` `if (e.detail === 2) return`; regression test `totals-row-group-ops.test.ts` dispatches `{detail:1}` then `{detail:2}` and asserts the cycle/arm spy fires at most once; `EstimateRow.tsx` Item cell has no competing click handler (`onRowClick` prop is never wired by `EstimateCategoryBlock`/`EstimatePanel` — confirmed by grep, the Estimate grid intentionally "drops all the navigator machinery") |
| D-03 (rename name-only, blank/whitespace rejected) | ✓ VERIFIED | `renameGroup` trims and returns `{ok:false}` on blank; `rename-group-collision.test.ts` covers blank + whitespace-only |
| D-04 (block-on-collision, no merge, zero writes) | ✓ VERIFIED | `collisionExists` short-circuits before any store write; `rename-group-collision.test.ts` explicitly asserts `isDirty` stays `false` after a blocked rename |
| D-05 (Move/Copy dialog reusing CategoryAutocomplete) | ✓ VERIFIED | `GroupCategoryDialog.tsx` imports `CategoryAutocomplete` + `useDraggable`, no command imports |
| D-06 (Move reassigns categoryId, appends to target order) | ✓ VERIFIED | `move-group-command.test.ts` — target order gains the key, source order loses it |
| D-07 (Copy: auto-name preview, blank rate) | ✓ VERIFIED | `GroupCategoryDialog.tsx:198` renders `Copy as '{autoName}' into…`; `copyGroup` seeds `addBlankRate` before `set()` |
| D-08 (Duplicate: no dialog, same category) | ✓ VERIFIED | `TotalsPanel.tsx`/`EstimatePanel.tsx` `onDuplicate` calls `duplicateGroup(name)` directly with no dialog state change |
| D-09 (grip-only drag) | ✓ VERIFIED | `useRowReorder.onGripPointerDown` calls `e.preventDefault(); e.stopPropagation()`; `row-reorder-drag.test.ts` asserts a non-grip pointerdown never starts a drag |
| D-10 (insertion line + lifted row) | ✓ VERIFIED | `insertionIndex`/`liftedKey` state rendered as a 2px accent line + `activeSurface`/opacity treatment in both `TotalsCategoryBlock.tsx` and `EstimateCategoryBlock.tsx` |
| D-11 (within-category only, placement-order default, single shared order) | ✓ VERIFIED | Aggregator rank-sort is the SOLE sort (localeCompare removed); shared by `useBoqLive` (totals + estimate) and `aggregateBoq()` (export) |

**Score:** 11/11 decisions verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/lib/boq-aggregator.ts` | manual-order rank sort, no `localeCompare` | ✓ VERIFIED | `grep -c "localeCompare"` → 0; rank-sort at lines 229-232 confirmed by direct read |
| `src/renderer/src/stores/markupStore.ts` | `categoryItemOrder`, `reorderItems`, `renameGroup`, `moveGroup`, `copyGroup`, `duplicateGroup`, `applyProjectUndo/Redo` | ✓ VERIFIED | All present and wired (confirmed by direct read of implementations, not just grep of names) |
| `src/renderer/src/stores/projectStore.ts` | `reKeyRate`, `reKeyHidden`, `addBlankRate`, `removeRate` | ✓ VERIFIED | Confirmed present, called from `applyProjectUndo`/`applyProjectRedo`/`renameGroup`/`copyGroup`/`duplicateGroup` |
| `src/renderer/src/lib/group-ops.ts` | `autoUniqueName`, `collisionExists`, `snapshotGroup` (no store imports) | ✓ VERIFIED | File imports only `../types/markup`; deep-clone + fresh-id/sequence logic confirmed by direct read |
| `src/renderer/src/lib/project-schema.ts` / `project-serialize.ts` | additive `categoryItemOrder?` field, no `formatVersion` bump, V5-coerced hydrate | ✓ VERIFIED | Confirmed; `project-order-roundtrip.test.ts` proves old/malformed-file safety |
| `src/renderer/src/hooks/useRowReorder.ts` | grip-only pointer drag, atomic window-listener cleanup, single dispatch | ✓ VERIFIED | Direct read confirms `removeEventListener` for both `pointermove`/`pointerup` inside `onUp`, single guarded `reorderItems` dispatch |
| `src/renderer/src/components/GroupCategoryDialog.tsx` | Move/Copy modal, no command imports | ✓ VERIFIED | Confirmed |
| `src/renderer/src/components/InlineRenameInput.tsx` | uncontrolled editor, `renameGroup`, collision handling | ✓ VERIFIED | Confirmed, native listeners not React onChange |
| `src/renderer/src/components/TotalsRowContextMenu.tsx` | shared 4-action menu + prop-gated Copy-as-text | ✓ VERIFIED | Confirmed |
| `TotalsRow/TotalsCategoryBlock/TotalsPanel.tsx` | full totals-surface wiring | ✓ VERIFIED | Confirmed by direct read (grip, e.detail guard, menu routing, dialog host) |
| `EstimateRow/EstimateCategoryBlock/EstimatePanel.tsx` | full Estimate-surface wiring | ✓ VERIFIED | Confirmed by direct read (row-level onContextMenu, grip, no e.detail guard needed, `showCopyAsText={false}`) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `boq-aggregator.ts` | `useMarkupStore.getState().categoryItemOrder` | `opts.categoryItemOrder ?? getState()` default | ✓ WIRED | Line 95-96 |
| `useBoqLive.ts` | `aggregateBoq` | primitive selector + `useMemo` dep | ✓ WIRED | `categoryItemOrder` present in both the selector list and the dep array (line 41, 69) |
| `boq-writers.ts` (xlsx/csv) | `BoqStructure.cat.items` | array-order iteration, no re-sort | ✓ WIRED | Confirmed by grep — no `.sort(` call inside the writer; the aggregator's order is inherited |
| `useRowReorder.ts` | `useMarkupStore.getState().reorderItems` | single guarded dispatch on pointerup | ✓ WIRED | Confirmed |
| `markupStore.undo()/redo()` | `projectStore.reKeyRate/reKeyHidden/removeRate/setPrice` | `applyProjectUndo/Redo(cmd)` called before `set()` | ✓ WIRED | Confirmed by direct read; `group-undo-atomic.test.ts` proves atomicity across rename/move/copy/duplicate |
| `TotalsPanel.tsx` / `EstimatePanel.tsx` | `renameGroup/moveGroup/copyGroup/duplicateGroup` | context-menu callbacks + dialog confirm | ✓ WIRED | Confirmed on both surfaces |

### Requirements Coverage

No new v1 REQ-IDs are declared for Phase 17 (confirmed: `grep -n "Phase 17\|17-markup" .planning/REQUIREMENTS.md` returns no matches — the phase extends the v1.1 Estimating milestone with SPEC-locked Req 1-5 instead). All five SPEC requirements (Rename, Reorder, Move, Copy, Duplicate) are satisfied per the acceptance-criteria table above — no orphaned requirements.

### Anti-Patterns Found

None. Grep for TODO/FIXME/PLACEHOLDER/"not yet implemented" across all 18 phase-17-touched source files returned only legitimate HTML `placeholder="..."` input attributes (EstimateRow.tsx, EstimatePanel.tsx, GroupCategoryDialog.tsx) — not stub markers.

### KNOWN LIMITATIONS — Explicit Verdicts

**Limitation #1 — `moveGroup` (and `copyGroup`/`duplicateGroup`) collapse a multi-category-spanning group onto a single target/source category.**

Confirmed in code: `moveGroup` collects `sourceMarkups` by `m.name === name` across ALL categories (`markupStore.ts:592-594`), captures a SINGLE `oldCategoryId = sourceMarkups[0].categoryId` (`:602`), and the `move-group` command type carries one `oldCategoryId` field (`types/markup.ts:207`) — not a per-markup map. If a group's markups are currently split across two categories (same name, different `categoryId`), a Move (or Copy/Duplicate, which share the same `buildSnapshotPayload(name, targetCategoryId, allMarkups)` collection-by-name logic) would reassign/snapshot ALL of them into the single resolved target/source category, and undo restores every affected markup to the single captured `oldCategoryId` — losing the original per-markup distribution.

**Verdict: ACCEPTABLE LIMITATION, not a phase-goal gap.**
- SPEC Req 3's acceptance criterion ("moving group 'Slab' from 'Civil' to 'Finishes'...") and Req 4/5's acceptance criteria all describe and are tested against the single-category case only — the exercised path is fully verified (10/10 SPEC criteria pass).
- The multi-category-spanning-group scenario is an edge case of the underlying "group = same name, any category" data model (explicitly acknowledged for Rename's Pitfall 3, but not required to be handled identically by Move/Copy/Duplicate per SPEC wording).
- The executor explicitly flagged this in 17-04-SUMMARY.md ("Known Behaviors / Next Phase Readiness") with clear rationale tied to the locked 17-02 command shape, rather than silently omitting it.
- No data corruption results — the collapse is deterministic and undo/redo remain internally consistent (proven by `group-undo-atomic.test.ts`); the only loss is the original per-markup category distribution in this rare edge case.

**Limitation #2 — `moveGroup` does NOT re-key `hiddenItemNames` (composite `name|categoryId`), so moving a currently-hidden group un-hides it in the new category.**

Confirmed in code: the `move-group` `MarkupCommand` variant (`types/markup.ts:205-211`) has no `hiddenReKeys` field (only `rename-group` does), and `moveGroup`'s implementation (`markupStore.ts:588-670`) never touches `projectStore.hiddenItemNames`. `renameGroup`, by contrast, DOES correctly re-key `hiddenItemNames` (`markupStore.ts:528-539,555`), confirmed by `rename-group-command.test.ts`.

**Verdict: ACCEPTABLE SCOPE BOUNDARY, not a phase-goal gap.**
- The phase GOAL's "carries the group's pricing/color/hidden-state across" clause is grammatically and contextually attached to **rename** (Req 1) — verified this is correctly implemented.
- SPEC Req 3 (Move)'s Target text explicitly enumerates what Move preserves: "quantity, name, color, and rate (category-independent `name|type`) are unchanged" — **hidden-state is not listed**, and Req 3's Acceptance criterion likewise omits it.
- The executor explicitly flagged this limitation in both 17-04-SUMMARY.md and `.planning/STATE.md` ("moving a hidden group currently un-hides it (move-group has no hidden re-key) — flagged for verifier") rather than hiding it — a transparent, intentional scope boundary rather than an overlooked defect.
- Recommend tracking as a follow-up enhancement (extend `move-group`'s command shape with `hiddenReKeys`, mirroring rename) if the product decision is that hidden-state should survive a Move — this is a product decision, not a phase-goal failure, since SPEC never required it.

### Human Verification Required

### 1. Grip-drag feel (insertion line + lifted row)

**Test:** On both the totals panel and the Estimate sheet, hover a row, press-drag from the grip handle to a new position within the category, and release.
**Expected:** The row lifts (slight opacity/shadow change), follows the cursor, a thin accent insertion line shows the drop position between rows, and releasing drops the row into the new position with the order persisting.
**Why human:** Visual/tactile feel of drag animation cannot be verified by static analysis or jsdom tests; explicitly deferred to phase UAT by every Wave-3/4 plan's own `VALIDATION § Manual-Only` note.

### 2. Collision message readability

**Test:** Rename a group to a name that already exists (same type) on both surfaces.
**Expected:** The "A group named '{name}' already exists" message reads clearly beneath the input without visually colliding with adjacent rows or being clipped in a dense list.
**Why human:** Visual layout/density judgment, not testable via grep or jsdom.

### 3. Cross-surface reordered-row visual parity (including the exported file)

**Test:** Reorder rows within a category, then open the totals panel, the Estimate sheet, and an exported .xlsx/.csv side by side.
**Expected:** All three show the identical row order.
**Why human:** Confirmed at the data layer by this verification (shared aggregator + writer tests assert non-alphabetical order preservation end-to-end), but actually opening an exported file was not performed by this verifier — recommended as a quick manual spot-check before closing the phase, given this is the phase goal's headline claim.

### Gaps Summary

No gaps found. All 10 SPEC acceptance criteria and all 11 CONTEXT decisions (D-01..D-11) are verified against actual source code (not SUMMARY claims) — implementations were read directly, cross-store atomicity was traced through `applyProjectUndo`/`applyProjectRedo`, the shared aggregator sort was confirmed to have zero remaining `localeCompare` calls, and both known limitations documented during execution were independently re-derived from the code and assessed as acceptable scope boundaries rather than goal gaps (both were also proactively flagged by the executor, not discovered only by this verification). The full test suite (786/786), typecheck, and production build were independently re-run and confirmed green — not merely trusted from SUMMARY.md.

Status is `human_needed` (not `passed`) solely because 3 visual/tactile UX items require manual confirmation per the verification gate rules — this reflects gate policy, not a defect. No BLOCKER or WARNING-level implementation gaps were found.

---

_Verified: 2026-07-10T10:50:00Z_
_Verifier: Claude (gsd-verifier)_
