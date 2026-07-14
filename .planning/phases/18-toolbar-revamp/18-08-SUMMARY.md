---
phase: 18-toolbar-revamp
plan: 08
subsystem: ui
tags: [react, zustand, context-bar, morph, toolbar, snap, arc, inline-rename]

# Dependency graph
requires:
  - phase: 18-toolbar-revamp
    provides: "18-03 context-bar testid contract + RED tests (context-bar-morph / context-bar-edit)"
  - phase: 18-toolbar-revamp
    provides: "18-04 reactive Arc seam (getArcSticky / subscribeArcSticky in markup-arc-ref)"
provides:
  - "ContextBar.tsx — the morphing context sub-bar (D-04), four mutually-exclusive states"
  - "Snap/Arc mini-toggles reachable from the context bar, mutating the SAME state as the ToolRail (SC-3)"
  - "Selected-markup inline rename + category chip + Recolor + Delete surface via existing store ops (SC-4)"
affects: ["18-09 (App.tsx mounts ContextBar under the top action bar)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Morph-by-state chrome component: exactly one data-testid root rendered per activeTool + selection combination"
    - "Reactive external-ref read: React.useSyncExternalStore(subscribeArcSticky, getArcSticky) so Shift+A updates the Arc pill with no coincident store change"
    - "Reuse-not-reinvent: InlineRenameInput wholesale + renameGroup/recolorGroup/deleteMarkup existing ops"

key-files:
  created:
    - "src/renderer/src/components/ContextBar.tsx — the morphing context sub-bar (415 lines)"
  modified: []

key-decisions:
  - "Placing-state item name is a DISPLAY label (swatch + getChainArmedItem().name), NOT a live-editable input — deliberate flagged parity choice (scope_flag); no new live-rename plumbing added"
  - "Selected-markup rename uses renameGroup (whole name-group rename), matching totals/estimate + recolorGroup semantics, reconciling RESEARCH P19's 'editMarkup' shorthand with the established InlineRenameInput pattern"
  - "Recolor/Delete re-home the exact ops the right-click MarkupContextMenu already dispatches (CanvasViewport.tsx:2733-2737); the canvas edit popup + right-click menu are left untouched (additive surface, Q2)"

patterns-established:
  - "Morph shell: placing / scale / selected / idle roots gated by isMarkupTool(activeTool), activeTool==='scale', activeTool==='select' && sel.length, else idle"
  - "MiniToggle reusable pill for Snap + Arc with aria-pressed sourced from viewerStore.snapEnabled and the reactive arc seam"

requirements-completed: [SC-3, SC-4]

# Metrics
duration: ~10 min
completed: 2026-07-14
---

# Phase 18 Plan 08: ContextBar Morphing Sub-Bar Summary

**A 34px context sub-bar that morphs across four states — placing (chain item + Snap/Arc toggles + finish/cancel hint), Set Scale (calibration hint), selected (inline rename + category chip + Recolor + Delete), and idle — reusing InlineRenameInput and the renameGroup/recolorGroup/deleteMarkup store ops, with the Arc on-state made reactive to Shift+A via useSyncExternalStore.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-14T17:03Z (approx, RED baseline confirmed)
- **Completed:** 2026-07-14T17:13Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- New `ContextBar.tsx` morphing on `activeTool` + `selectedMarkupIds`; exactly one `context-bar-{placing|scale|selected|idle}` root renders at a time (SC-4).
- Snap/Arc mini-toggles on the placing state mutate the SAME state as the ToolRail — Snap via `viewerStore.setSnapEnabled` (F3-shared), Arc via the registered Shift+A handler (SC-3).
- Arc on-state read through the 18-04 reactive seam `useSyncExternalStore(subscribeArcSticky, getArcSticky)` so Shift+A flips the pill with no coincident store change.
- Selected-markup panel reuses `InlineRenameInput` wholesale (native Enter/blur → `renameGroup`), a display-only category chip, a toggled `MARKUP_PALETTE` Recolor swatch row (→ `recolorGroup`), and a danger Delete button (→ `deleteMarkup`).
- Canvas edit popup + right-click `MarkupContextMenu` left completely untouched (additive surface, Q2).

## Task Commits

Each task was committed atomically:

1. **Task 1: Morph shell + placing/scale/idle states with Snap/Arc toggles** - `80d404b` (feat)
2. **Task 2: Selected-markup panel — inline rename + category chip + Recolor + Delete** - `6fd695d` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified
- `src/renderer/src/components/ContextBar.tsx` - The morphing context sub-bar (D-04). Four states keyed on `activeTool` + selection; reusable `MiniToggle` for Snap/Arc; `SelectedPanel` re-homing the existing edit ops. Inline styles + COLORS tokens only.

## Decisions Made
- **Placing item name is display-only** (scope_flag): rendered as a color swatch + `getChainArmedItem().name` label, not a live-editable input. The phase's only new plumbing is the Arc seam (non-negotiable constraint), and live-rename-during-placement has no existing seam (the armed preset name in `useMarkupTool` has no live setter). Group rename remains fully reachable in the selected state here + the totals/estimate surfaces. No new plumbing was wired.
- **Rename uses `renameGroup`** (whole name-group rename), matching totals/estimate + `recolorGroup` semantics — reconciling RESEARCH P19's "editMarkup" shorthand with the established `InlineRenameInput` pattern.
- **Additive surface (Q2):** the selected panel dispatches the exact store ops the right-click `MarkupContextMenu` already uses; the canvas popup and right-click menu are unchanged.

## Deviations from Plan

None - plan executed exactly as written.

The placing-state display-only name is a plan-specified scope choice (`<scope_flag>`), surfaced here per that instruction — not an unplanned deviation.

## Issues Encountered
None.

## Threat Flags
None — no new network endpoints, auth paths, file access, or schema changes. The inline rename value flows into the already-validated `renameGroup` path (collision/validation from Phase 17); React text-node escaping applies; no `dangerouslySetInnerHTML`/`eval`. Recolor/Delete reuse existing ops with no new persisted field or IPC (matches the plan `<threat_model>` dispositions T-18-08-01 mitigate / T-18-08-02 accept).

## Known Stubs
None — the `context-bar-selected` stub from Task 1 was fully filled in Task 2.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ContextBar` is standalone and verified; ready to be mounted by App.tsx in **18-09** under the top action bar.
- Two target RED tests are GREEN: `context-bar-morph.test.ts` (6) + `context-bar-edit.test.ts` (4).
- Full suite: 114 files / 842 tests passing; `npm run typecheck` clean. No regressions.

## Self-Check: PASSED

- File exists: `src/renderer/src/components/ContextBar.tsx` — FOUND (415 lines, exports `ContextBar`, min_lines 180 satisfied)
- Commit `80d404b` (Task 1) — FOUND
- Commit `6fd695d` (Task 2) — FOUND
- `context-bar-morph.test.ts` + `context-bar-edit.test.ts` — GREEN (10 tests)
- `npm run typecheck` — clean
- Full `npx vitest run` — 114 files / 842 tests passing (no regressions)
- No edits to `MarkupContextMenu.tsx` or `CanvasViewport.tsx`
- `.planning/STATE.md` and `.planning/ROADMAP.md` — NOT modified (worktree mode; orchestrator owns them)

---
*Phase: 18-toolbar-revamp*
*Completed: 2026-07-14*
