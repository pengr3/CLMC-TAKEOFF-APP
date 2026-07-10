---
phase: 17-markup-rename-and-reorder
plan: 05
subsystem: estimating
tags: [react, react-19-uncontrolled-input, context-menu, presentational, rename-ui, decoupled-components]

# Dependency graph
requires:
  - phase: 17-markup-rename-and-reorder
    plan: 02
    provides: "useMarkupStore.renameGroup(oldName,newName): { ok } — not-ok sentinel (blank OR same-type collision) with zero store writes; the { ok } branch the inline editor drives"
provides:
  - "TotalsRowContextMenu extended into the SHARED group context menu: Rename / Move to… / Copy to… / Duplicate (optional callbacks) above a separator; totals-only Copy as text prop-gated by showCopyAsText (default true) — both surfaces render the same four group actions (D-01)"
  - "InlineRenameInput: uncontrolled edit-in-place rename editor (native blur/Enter commit, Esc cancel, blank silent-cancel, stopPropagation on click/mousedown/keydown, focus+select-all on mount) that calls renameGroup and on not-ok keeps the input open+focused with the typed text and mounts the collision message (D-02/D-03/D-04)"
  - "RenameCollisionMessage: presentational role=alert / aria-live=assertive block surface (PROBLEM_RED #dc2626, parent-owned dismissal, no timer) mirroring BlockedCommitMessage (D-04)"
affects: [17-06, 17-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared prop-gated context menu: one TotalsRowContextMenu renders the four group actions on BOTH surfaces; the totals-only Copy-as-text item is gated behind showCopyAsText so the Estimate surface omits it without a second menu component (D-01)"
    - "Uncontrolled input + native blur/Enter/Esc + input-clears-collision (Shared Pattern H, React-19-safe): commit/cancel via raw DOM events on a ref, never the React synthetic change/blur props; stopPropagation on click/mousedown/keydown"
    - "Editor-owned block state: the rename editor holds its own collision open/blocked state until onDone; the collision message is pure presentational with parent-owned dismissal (no internal timer)"

key-files:
  created:
    - src/renderer/src/components/RenameCollisionMessage.tsx
    - src/renderer/src/components/InlineRenameInput.tsx
    - src/tests/inline-rename-input.test.ts
  modified:
    - src/renderer/src/components/TotalsRowContextMenu.tsx

key-decisions:
  - "The four group callbacks (onRename/onMove/onCopyTo/onDuplicate) are OPTIONAL and dispatched with `?.` so the menu is fully decoupled — it renders all four items statically (grep-verifiable) while Wave 4 wires the real handlers; existing required Copy-as-text props (item/onCopy/onCopyError) left required to avoid churning the current totals wiring"
  - "InlineRenameInput uses a native `input` listener (not React onChange) to clear the collision message on the next keystroke — keeps the grep acceptance (`onChange` == 0) satisfied and stays on the React-19-safe raw-event path"
  - "Collision message positioned via `position:absolute; marginTop:4` with no top/left — anchors at its normal-flow position directly beneath the input inside the editor's relative wrapper, so it never reflows the row list (UI-SPEC §3)"

requirements-completed: [Req-1]

# Metrics
duration: ~7min
completed: 2026-07-10
---

# Phase 17 Plan 05: Shared Rename UI Primitives Summary

**Built the three decoupled rename primitives both surfaces reuse — the shared group context menu (Rename / Move to… / Copy to… / Duplicate, with totals-only Copy-as-text prop-gated), the uncontrolled `InlineRenameInput` edit-in-place editor that drives `renameGroup` and blocks-open on a collision, and the presentational `RenameCollisionMessage` — verified in isolation and ready to drop into the real Totals/Estimate rows in Wave 4.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-10T01:57:02Z
- **Completed:** 2026-07-10T02:03:34Z
- **Tasks:** 2
- **Files modified/created:** 4 (1 source modified, 2 source created, 1 test created)

## Accomplishments
- **`TotalsRowContextMenu` → shared group menu (D-01):** added optional `onRename` / `onMove` / `onCopyTo` / `onDuplicate` callbacks and `showCopyAsText` (default `true`). Renders the four group items in the locked order — Rename / Move to… / Copy to… / Duplicate — above a `MarkupContextMenu`-style separator; the existing "Copy as text" item now sits below the separator and only renders when `showCopyAsText` (the Estimate surface passes `false`). `minWidth` widened 160→180 (UI-SPEC §1); ellipsis on the two dialog-openers only. Each group item dispatches its callback then `onClose()`. Deferred-listener dismissal recipe left byte-identical.
- **`RenameCollisionMessage` (D-04):** presentational `role="alert" aria-live="assertive"` surface with a local `PROBLEM_RED = '#dc2626'` constant (keeps the COLORS-tokens-only rule intact, mirroring `BlockedCommitMessage`). Compact per UI-SPEC §3 (`padding 8px 12px`, `maxWidth 260`, `marginTop 4`, `zIndex 30`); text `A group named '{name}' already exists` in `PROBLEM_RED` weight 600. No internal timer — parent owns dismissal.
- **`InlineRenameInput` (D-02/D-03/D-04):** uncontrolled `<input defaultValue aria-label="Rename {name}">` driven entirely by native listeners on a ref — `blur`/Enter commit, Esc cancel (revert), `input` clears the collision message, and `stopPropagation` on click/mousedown/keydown so it never triggers the row's cycle/arm. Focus + select-all on mount. Commit trims and: blank/whitespace → `onDone()` with zero store writes (D-03); else calls `useMarkupStore.getState().renameGroup(currentName, trimmed)` — `{ ok:true }` → `onDone()`, `{ ok:false }` → keep the input open + refocused with the typed text and mount `RenameCollisionMessage` (D-04).
- Proven by `inline-rename-input.test.ts` (5 cases): Enter-commit calls `renameGroup` once then `onDone`; Esc cancels without `renameGroup`; blank/whitespace cancels silently; a not-ok result keeps the input mounted with the typed text + renders the "already exists" alert and does NOT call `onDone`; click/mousedown/keydown do not bubble to a parent listener.
- Full suite green (**774 tests / 100 files**); `npm run typecheck` clean (node + web).

## Task Commits

Each task was committed atomically:

1. **Task 1: shared group context menu + rename collision message** — `8e22a5a` (feat)
2. **Task 2: InlineRenameInput uncontrolled rename editor + render test** — `dd78052` (feat)

**Plan metadata (SUMMARY):** committed separately (docs).

## Files Created/Modified
- `src/renderer/src/components/TotalsRowContextMenu.tsx` — (modified) four optional group-action callbacks + `showCopyAsText` gate; four `role="menuitem"` group items above a separator; Copy-as-text moved below the separator (prop-gated); `minWidth` 160→180; shared `menuItemStyle` + hover handlers (each item kept an inline `<button role="menuitem">` so the surface stays 1:1 with `MarkupContextMenu`).
- `src/renderer/src/components/RenameCollisionMessage.tsx` — (created) presentational `role=alert` block message, local `PROBLEM_RED`, parent-owned dismissal.
- `src/renderer/src/components/InlineRenameInput.tsx` — (created) uncontrolled rename editor: mount focus+select-all effect, native-listener effect (blur/Enter/Esc/input/stop), `renameGroup` commit with `{ ok }` branch, local `collision` state hosting `RenameCollisionMessage`.
- `src/tests/inline-rename-input.test.ts` — (created) jsdom render test mirroring the `estimate-row-edit.test.ts` harness (createRoot + act + localStorage polyfill + `IS_REACT_ACT_ENVIRONMENT`), `renameGroup` stubbed via `useMarkupStore.setState`; 5 cases.

## Decisions Made
- Group-action callbacks are optional and `?.`-dispatched so the menu is fully decoupled — it renders all four items statically (grep-verifiable ≥5 `role="menuitem"`) while Wave 4 (17-06/17-07) supplies the real handlers. The existing required Copy-as-text props (`item`/`onCopy`/`onCopyError`) were left required to avoid churning the live totals wiring; Wave 4's Estimate surface passes them plus `showCopyAsText={false}`.
- The collision message is dismissed on the next keystroke via a native `input` listener (not React `onChange`), keeping both the grep acceptance (`onChange` == 0) and the React-19-safe raw-event contract.
- Collision message anchored with `position:absolute; marginTop:4` (no top/left) inside the editor's `position:relative` wrapper — sits directly beneath the input without reflowing the row list (UI-SPEC §3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded two InlineRenameInput comments to satisfy the `grep -c "onChange" == 0` acceptance**
- **Found during:** Task 2 (acceptance-grep gate)
- **Issue:** The initial JSDoc/inline comments described the React-19-safe design as "NOT React onChange/onBlur", which put the literal token `onChange` in the file. Task 2's acceptance requires `grep -c "onChange" src/renderer/src/components/InlineRenameInput.tsx` to return 0 — the comments alone tripped it (count 2) even though the component never uses React `onChange`.
- **Fix:** Reworded both comments to say "the React synthetic change/blur props" / "never the React synthetic change/blur props" — same intent, no `onChange` literal. Comment-only change; the render test and typecheck were unaffected.
- **Files modified:** `src/renderer/src/components/InlineRenameInput.tsx` (Task 2 commit `dd78052`)
- **Verification:** `grep -c "onChange" … ` → 0; `npx vitest run src/tests/inline-rename-input.test.ts` → 5 passed; `npm run typecheck` → 0.
- **Committed in:** `dd78052` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking, comment-only). End-state is byte-equivalent in behaviour to the plan's intended output.

## Issues Encountered
None. The `renameGroup` `{ ok }` sentinel from 17-02 dropped in cleanly; stubbing it via `useMarkupStore.setState({ renameGroup: spy })` (the estimate-row harness convention) drove both branches deterministically.

## Known Stubs
None. All three components are intentionally **standalone/decoupled** — they are NOT wired into `TotalsRow`/`EstimateRow`/panels here; that is the planned Wave 4 boundary (17-06 totals surface, 17-07 estimate surface), explicitly scoped out by this plan's objective. The four group-menu callbacks are optional-and-`?.`-gated by design (not placeholder empty-data flowing to the UI): each renders a real, styled item now and receives its handler in Wave 4. No TODO/FIXME/placeholder markers introduced.

## Threat Flags
None. Purely presentational menu/editor/message components — no new IPC channel, file path, network endpoint, or `eval` (matches the plan's threat register: T-17-11 accept — the renamed name still flows through the existing `safeText()` CSV/xlsx guard unchanged; T-17-12 — no new surface). The rename store write and its guards live in 17-02.

## User Setup Required
None — fully offline desktop feature, no external configuration.

## Next Phase Readiness
- **17-06 (totals surface wiring):** mount `TotalsRowContextMenu` with the four group callbacks + `showCopyAsText` (default true), and mount `InlineRenameInput` on the label cell (double-click guarded by `e.detail === 2` per D-02). The editor calls `renameGroup` and self-manages the collision block; the parent only supplies `currentName` + an `onDone` that closes the editor.
- **17-07 (estimate surface wiring):** render the same `TotalsRowContextMenu` with `showCopyAsText={false}` and mount `InlineRenameInput` on the Item cell (no `e.detail` guard needed — the cell has no click handler).
- No blockers. Full suite (774 tests / 100 files) green; `npm run typecheck` clean (node + web).

## Self-Check: PASSED

- All 3 created files + the 1 modified file present on disk; SUMMARY.md present.
- Both task commits present in history (`8e22a5a`, `dd78052`).
- Task verifies green: `inline-rename-input.test.ts` (5 cases), full suite 774 passed; `npm run typecheck` clean; acceptance greps (`role="menuitem"` ≥5, `onChange` == 0, native blur/keydown listeners present, imports RenameCollisionMessage, calls renameGroup) all satisfied.

---
*Phase: 17-markup-rename-and-reorder*
*Completed: 2026-07-10*
