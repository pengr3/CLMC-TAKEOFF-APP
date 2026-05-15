---
phase: "08-markup-workflow-and-wall-tool"
plan: "06"
subsystem: "renderer/components/visibility"
tags: [visibility, totals-row, renderers, hover, pulse, lightbulb]
dependency_graph:
  requires: ["08-02", "08-04"]
  provides: ["Lightbulb/LightbulbOff slot in TotalsRow", "hidden-item skip-render in 4 markup renderers", "wall branch in HoverRing + PulseHighlight"]
  affects:
    - src/renderer/src/components/TotalsRow.tsx
    - src/renderer/src/components/markup/CountPinMarkup.tsx
    - src/renderer/src/components/markup/LinearMarkup.tsx
    - src/renderer/src/components/markup/AreaMarkup.tsx
    - src/renderer/src/components/markup/PerimeterMarkup.tsx
    - src/renderer/src/components/HoverRing.tsx
    - src/renderer/src/components/PulseHighlight.tsx
    - src/tests/totals-row-visibility.test.ts
    - src/tests/markup-visibility.test.ts
tech_stack:
  added: []
  patterns:
    - "hiddenItemSet.has() O(1) Set lookup in renderer components (not hiddenItemNames.includes())"
    - "e.stopPropagation() on nested click target to prevent row cycle navigation (Pitfall 9)"
    - "useProjectStore.getState().toggleHiddenItem() on click (direct action, not undoable — D-16)"
    - "Return type JSX.Element | null for renderers with early return after hook call (React Rules of Hooks)"
    - "Wall branch mirrors linear open-polyline shape in HoverRing and PulseHighlight"
key_files:
  created: []
  modified:
    - src/renderer/src/components/TotalsRow.tsx
    - src/renderer/src/components/markup/CountPinMarkup.tsx
    - src/renderer/src/components/markup/LinearMarkup.tsx
    - src/renderer/src/components/markup/AreaMarkup.tsx
    - src/renderer/src/components/markup/PerimeterMarkup.tsx
    - src/renderer/src/components/HoverRing.tsx
    - src/renderer/src/components/PulseHighlight.tsx
    - src/tests/totals-row-visibility.test.ts
    - src/tests/markup-visibility.test.ts
decisions:
  - "Tests updated to set hiddenItemSet: new Set(...) alongside hiddenItemNames — Zustand setState merge does not invoke derived-set logic, so tests must supply both fields for O(1) Set lookup to work"
  - "Return types widened to JSX.Element | null to satisfy TypeScript since early-return null is added after the hook call"
  - "TotalsRow lightbulb data-testid='totals-row-lightbulb' for test discoverability"
  - "labelToName extended to strip (wall) suffix to match 08-03 BOQ disambiguation pattern"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-15"
  tasks_completed: 3
  files_changed: 9
---

# Phase 8 Plan 06: Show/Hide UI Surface and Wall Overlay Branches Summary

**One-liner:** TotalsRow gains Lightbulb/LightbulbOff slot with O(1) hiddenItemSet lookup and stopPropagation click guard; 4 markup renderers get identical hiddenItemSet.has() skip-render at component body top; HoverRing and PulseHighlight gain a wall open-polyline branch.

## What Was Built

### Task 1: TotalsRow lightbulb slot

**`src/renderer/src/components/TotalsRow.tsx`** — Four additions:

1. **Imports:** `Lightbulb`, `LightbulbOff` from `lucide-react`; `useProjectStore` from `../stores/projectStore`.

2. **Layout comment:** Updated to reflect the new 7-slot layout: `[cycle-dot 6px][lightbulb 16px][color chip 10x10]...`

3. **isHidden hook:** `const isHidden = useProjectStore((s) => s.hiddenItemSet.has(itemName))` — O(1) Set lookup using the derived `hiddenItemSet` (not `hiddenItemNames.includes()`) placed after `pagesWithMatches` useMemo.

4. **Lightbulb JSX slot:** Inserted between the cycle-dot slot and the color chip. 16px width, `flexShrink: 0`, `cursor: pointer`. Click handler calls `e.stopPropagation()` then `useProjectStore.getState().toggleHiddenItem(itemName)` — stopPropagation is MANDATORY (Pitfall 9 / T-08-06-01) to prevent the row's onClick (cycle navigation) from also firing. Title attribute: `isHidden ? 'Show on canvas' : 'Hide from canvas'`. Renders `<LightbulbOff>` when hidden, `<Lightbulb>` when visible.

5. **labelToName extended:** Regex updated to also strip `(wall)` suffix — matches BOQ disambiguation that 08-03 adds for wall items with ambiguous names.

### Task 2: Hidden-item skip-render in 4 markup renderers

Uniform two-line pattern applied to all 4 files. IDENTICAL to WallMarkup.tsx from 08-04:

```typescript
const isHidden = useProjectStore((s) => s.hiddenItemSet.has(markup.name))
if (isHidden) return null
```

- **CountPinMarkup.tsx:** Import added; placed before `const fill = markup.color`. Return type widened to `JSX.Element | null`.
- **LinearMarkup.tsx:** Import added; placed before `const strokeWidth`. Return type widened.
- **AreaMarkup.tsx:** Import added; placed before `const strokeWidth`. Return type widened.
- **PerimeterMarkup.tsx:** Import added; placed before `const strokeWidth`. Return type widened.

All 5 renderers (4 here + WallMarkup from 08-04) now use the IDENTICAL `useProjectStore((s) => s.hiddenItemSet.has(markup.name))` selector — grep uniformity check returns 1 (single unique expression).

### Task 3: HoverRing + PulseHighlight wall branch

**`src/renderer/src/components/HoverRing.tsx`** — Added `if (m.type === 'wall')` branch between the `'linear'` branch and the closing-polygon fallback. Returns an open-polyline `<Line>` using the same constants (`RING_COLOR`, `RING_OPACITY`, `stroke + offset * 2`) as the `'linear'` branch.

**`src/renderer/src/components/PulseHighlight.tsx`** — Identical insertion. Wall branch uses same `color`, `stroke`, `opacity` variables as the `'linear'` branch (all derived from the rAF animation loop state).

No hidden-item check added to either overlay — hidden markup Groups are not rendered, so no mouseEnter fires for hidden markups and no hover-ring appears over invisible markup. Pulse on a hidden item is an intentional no-op visual (D-15).

## Test Results

- `src/tests/totals-row-visibility.test.ts` — **3/3 GREEN** (Lightbulb visible state, LightbulbOff hidden state, click toggles + does not cycle)
- `src/tests/markup-visibility.test.ts` — **4/4 GREEN** (CountPinMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup all return null when hidden)
- `src/tests/highlight-overlay-listening.test.ts` + `src/tests/pulse-highlight-animation.test.ts` — **16/16 GREEN** (Phase 6 overlay regression)
- `src/tests/totals-panel-render.test.ts` + `src/tests/totals-panel-category-collapse.test.ts` — **11/11 GREEN** (Phase 6/7 totals regression)
- Full suite: **443/443 GREEN** (no regressions)
- `npx tsc --noEmit` — exits 0

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (TotalsRow) | `a8e5866` | feat(08-06): add lightbulb visibility slot to TotalsRow |
| Task 2 (4 renderers) | `89e054a` | feat(08-06): add hidden-item skip-render to 4 markup renderers |
| Task 3 (HoverRing + PulseHighlight) | `dd1056e` | feat(08-06): add wall branch to HoverRing and PulseHighlight |

## Deviations from Plan

### Test setState calls updated to include hiddenItemSet (Rule 1 — bug fix)

**Found during:** Task 1/2 implementation analysis
**Issue:** The Wave 0 RED stubs in `totals-row-visibility.test.ts` and `markup-visibility.test.ts` set `hiddenItemNames: ['Hidden']` via `useProjectStore.setState()` but did NOT set `hiddenItemSet`. When the component calls `useProjectStore((s) => s.hiddenItemSet.has(markup.name))`, the derived Set remains empty (Zustand's `setState` merges state without invoking the `setHiddenItemNames` action that keeps both fields in sync). The tests would never pass with the O(1) implementation as written.
**Fix:** Updated all `beforeEach` and per-test setState calls to include `hiddenItemSet: new Set([...names])` alongside `hiddenItemNames`. This matches the canonical pattern: when the real `toggleHiddenItem` action runs, it atomically updates both fields.
**Files modified:** `src/tests/totals-row-visibility.test.ts`, `src/tests/markup-visibility.test.ts`
**Commits:** `a8e5866`, `89e054a`

### Return types widened to JSX.Element | null (Rule 2 — missing critical type)

**Found during:** Task 2 implementation
**Issue:** The original markup renderers all declared return type `React.JSX.Element`. Adding `if (isHidden) return null` without widening the return type would cause a TypeScript error since `null` is not assignable to `JSX.Element`.
**Fix:** Widened return types to `React.JSX.Element | null` for all 4 renderers. This matches WallMarkup.tsx from 08-04 which already uses `JSX.Element | null`. The hook call is placed BEFORE the early return, satisfying React Rules of Hooks.
**Files modified:** All 4 renderer files
**Impact:** Callers that render these components (CanvasViewport.tsx) accept null as a valid React child, so no callers need updating.

## Known Stubs

None. All visibility logic is fully wired end-to-end: toggle in TotalsRow → hiddenItemSet updated in projectStore → skip-render in 5 renderers. HoverRing and PulseHighlight handle wall as open polyline.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns. All changes are in-renderer, in-process Zustand state reads/writes. The plan's threat model items are all addressed:
- T-08-06-01 (Pitfall 9 — lightbulb click fires cycle navigation): mitigated by `e.stopPropagation()` in the click handler; enforced by test "click does not call row onClick".
- T-08-06-02 (DoS — hiddenItemSet.has() per frame): accepted; O(1) Set lookup is well within 60fps budget.
- T-08-06-03 (LightbulbOff reveals hidden state): accepted; intended affordance per D-14.

## Self-Check: PASSED

- `src/renderer/src/components/TotalsRow.tsx`: FOUND (a8e5866)
- `src/renderer/src/components/markup/CountPinMarkup.tsx`: FOUND (89e054a)
- `src/renderer/src/components/markup/LinearMarkup.tsx`: FOUND (89e054a)
- `src/renderer/src/components/markup/AreaMarkup.tsx`: FOUND (89e054a)
- `src/renderer/src/components/markup/PerimeterMarkup.tsx`: FOUND (89e054a)
- `src/renderer/src/components/HoverRing.tsx`: FOUND (dd1056e)
- `src/renderer/src/components/PulseHighlight.tsx`: FOUND (dd1056e)
- Commit a8e5866 (TotalsRow): FOUND
- Commit 89e054a (4 renderers): FOUND
- Commit dd1056e (HoverRing + PulseHighlight): FOUND
- totals-row-visibility.test.ts: 3/3 GREEN
- markup-visibility.test.ts: 4/4 GREEN
- Full suite 443/443: GREEN
- npx tsc --noEmit: exits 0
