---
phase: 06-live-view-and-ui-polish
plan: "04"
subsystem: ui
tags: [react, totals-panel, boq, electron, jsdom, vitest, zustand, useBoqLive, useUiPanels]

# Dependency graph
requires:
  - phase: 06-live-view-and-ui-polish
    provides: useBoqLive (06-01) — single live BoqStructure aggregator subscription
  - phase: 06-live-view-and-ui-polish
    provides: useUiPanels (06-01) — collapsedCategories localStorage persistence + setTotalsOpen
provides:
  - TotalsPanel right-column chrome with metadata header + scrollable categories + pinned grand-total bar
  - All three D-09 empty states (no PDF / no markups / only non-count on uncalibrated pages) with verbatim UI-SPEC copy
  - TotalsCategoryBlock collapsible heading wired to useUiPanels.toggleCategoryCollapsed (clmc.ui.collapsedCategories)
  - TotalsRow with fixed-width cycle slot + 10×10 color chip on item only (D-06) + tabular-nums quantity
  - TotalsPanelHeader 5-row metadata block (Project / Plan / Pages / Markups / Page) with em-dash fallback and live currentPage
affects: [06-05-row-interaction-wiring, 06-06-thumbnails, 06-08-app-shell-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "stable-empty-array-reference: Avoid Zustand identity-loop for selectors that fall back to []"
    - "html-event-triplet-mirrored-from-konva: TotalsRow hover/click/contextmenu signature mirrors CountPinMarkup.tsx (D-13/D-14 prep)"
    - "test-jsdom-localStorage-polyfill: Replicated pattern from use-ui-panels.test.ts for tests touching the clmc.ui store"

key-files:
  created:
    - src/renderer/src/components/TotalsPanel.tsx
    - src/renderer/src/components/TotalsPanelHeader.tsx
    - src/renderer/src/components/TotalsCategoryBlock.tsx
    - src/renderer/src/components/TotalsRow.tsx
  modified:
    - src/tests/totals-panel-render.test.ts
    - src/tests/totals-panel-empty-states.test.ts
    - src/tests/totals-panel-category-collapse.test.ts

key-decisions:
  - "Stable EMPTY_MARKUPS module const for the per-page Zustand selector to prevent identity-loop with fresh [] on each render"
  - "Render the metadata header even in empty states (UI-SPEC line 320) — em-dash fallback on missing values"
  - "labelToName regex strips D-02 disambiguation suffixes (count|linear|area|perimeter) so per-row match resolution finds the underlying Markup.name"
  - "perimeter-length and perimeter-area BoqRowType both map to underlying Markup.type 'perimeter' for hover-match filtering"
  - "Cycle dot lives in a fixed 6px slot so its appearance/disappearance does not reflow the row (RESEARCH §11 Q6)"
  - "TotalsRow accepts caller-owned interaction handlers; concrete wiring (highlight + cycle navigation) is Plan 06-05's responsibility"
  - "Grand-total bar only renders when there is a real BoqStructure to summarize — hidden during empty states"

patterns-established:
  - "Stable empty-fallback const: Module-scope `const EMPTY_MARKUPS: Markup[] = []` reused across renders so the selector returns a stable reference when the keyed slice is missing"
  - "Three-tier TotalsPanel composition: TotalsPanel (shell + empty-state decision tree) → TotalsCategoryBlock (collapse state owner) → TotalsRow (event triplet leaf)"
  - "Event triplet mirroring: HTML row hover/click/contextmenu signature mirrors the Konva CountPinMarkup pattern, easing the upcoming useMarkupHighlight wiring"

requirements-completed: [VIEW-01]

# Metrics
duration: ~28 min
completed: 2026-05-05
---

# Phase 06 Plan 04: TotalsPanel Render Tree Summary

**Right-column TotalsPanel with metadata header, collapsible categories, item rows (color chip + tabular-nums quantity), pinned grand-total bar, and all three D-09 empty states wired over the live useBoqLive aggregator.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-05-05T14:42:00Z
- **Completed:** 2026-05-05T15:10:08Z
- **Tasks:** 2
- **Files created:** 4 component files (TotalsPanel, TotalsPanelHeader, TotalsCategoryBlock, TotalsRow)
- **Tests flipped GREEN:** 3 (totals-panel-render, totals-panel-empty-states, totals-panel-category-collapse)
- **Tests passing:** 15/15

## Accomplishments

- Built the four-component TotalsPanel render tree (shell, header, category block, row) — VIEW-01 deliverable
- All three D-09 empty-state copy strings present verbatim from UI-SPEC, with a clean priority-ordered decision tree (no PDF → no markups → only non-count on uncalibrated)
- Category collapse state persists to `localStorage.clmc.ui.collapsedCategories` via useUiPanels, with chevron glyph swap (▾ ↔ ▸)
- Color chip discipline (D-06): chip lives ONLY on item-name cell. Heading rows, subtotal rows, and the grand-total bar carry no color
- Quantity column uses `fontVariantNumeric: 'tabular-nums'` and right alignment for column-correct numerical display
- Cycle dot fixed-width slot prevents row reflow when the dot appears/disappears (UI-SPEC contract)
- Live currentPage in metadata header (read directly from viewerStore — not from BoqMetadata) so page navigation immediately updates the displayed value

## Task Commits

Each task was committed atomically:

1. **Task 1: TotalsRow + TotalsCategoryBlock — row and section rendering** — `f195769` (feat)
2. **Task 2: TotalsPanel shell + TotalsPanelHeader + empty states** — `f27da0c` (feat)

## Files Created/Modified

- `src/renderer/src/components/TotalsPanel.tsx` — outer panel: metadata header + category list + pinned grand-total bar; collapsed-rail variant; D-09 empty-state decision tree
- `src/renderer/src/components/TotalsPanelHeader.tsx` — 5-row metadata block (Project / Plan / Pages / Markups / Page) with em-dash fallback and live `viewerStore.currentPage`
- `src/renderer/src/components/TotalsCategoryBlock.tsx` — collapsible category section; heading toggle wired to `useUiPanels().toggleCategoryCollapsed`; per-UoM subtotal rows
- `src/renderer/src/components/TotalsRow.tsx` — single BOQ item row: cycle slot + color chip + label + tabular-nums quantity + uom; hover/click/contextmenu event triplet
- `src/tests/totals-panel-render.test.ts` — 6 assertions: row labels, color chip (D-06), tabular-nums alignment, grand-total per-UoM, live currentPage, collapsed-rail Expand button
- `src/tests/totals-panel-empty-states.test.ts` — 4 assertions: each of the three D-09 variants + the inverse (count-markup present → no empty state)
- `src/tests/totals-panel-category-collapse.test.ts` — 5 assertions: render expanded by default, chevron glyph swap, click toggle, localStorage persistence, no color chip in heading

## Decisions Made

- **Stable EMPTY_MARKUPS module const.** The TotalsPanel's per-page selector returns the stored bucket or falls back to a stable empty array. Returning a fresh `[]` from the selector each render triggers Zustand subscriber re-runs and produces React's "Maximum update depth exceeded" guard. This mirrors the primitive-fallback discipline noted in 06-RESEARCH §2.
- **Render the metadata header even in empty states.** UI-SPEC line 320 explicitly requires this. Em-dash fallback is applied per-field when no project is open.
- **labelToName + rowTypeToMarkupType.** TotalsCategoryBlock resolves per-row match candidates from `pageMarkups` so TotalsRow stays store-ignorant. Aggregator labels can carry D-02 disambiguation suffixes (`(count)`, `(linear)`, `(area)`, `(perimeter)`); a single regex peels them off before name comparison. Both perimeter-length and perimeter-area collapse to underlying `Markup.type === 'perimeter'`.
- **Cycle dot in a fixed 6px slot.** Per RESEARCH §11 Q6, the slot is reserved unconditionally so the row layout does not jiggle when the cycle position changes (Plan 06-05 wires the actual cycleIndex stream).
- **Caller-owned interaction handlers.** `onRowHover` / `onRowClick` / `onRowContextMenu` are accepted as optional props with no-op defaults. Plan 06-05 binds them to `useMarkupHighlight().setHover/triggerPulse` and the cycle navigation reducer, with no further changes needed in this plan's components.
- **Grand-total bar hidden during empty states.** Showing "Total —" or zeros in the bar would clash with the centered empty message. The bar renders only when the panel is showing real categories.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stable empty-array reference for the per-page Zustand selector**
- **Found during:** Task 2 (TotalsPanel shell)
- **Issue:** The first selector iteration `useMarkupStore((s) => totalPages > 0 ? (s.pageMarkups[currentPage] ?? []) : [])` returned a fresh `[]` literal on every render when there were no markups for the page. Zustand sees a new identity, schedules a re-render, the selector creates another fresh `[]`, and React aborts with "Maximum update depth exceeded."
- **Fix:** Pulled the selector up to the whole `pageMarkups` record (whose identity is preserved by the store) and applied the fallback outside the selector against a module-scope `const EMPTY_MARKUPS: Markup[] = []`.
- **Files modified:** src/renderer/src/components/TotalsPanel.tsx
- **Verification:** All 10 totals-panel-render + empty-state tests pass; the failure mode reproduced as an "infinite update" before the fix and goes away after it
- **Committed in:** f27da0c (Task 2)

**2. [Rule 1 - Bug] jsdom inline-style hex normalisation in chip color test**
- **Found during:** Task 2 (verifying D-06 color chip)
- **Issue:** Initial test asserted `chipStyle.background.toLowerCase().toContain('#0078d4')`, but jsdom normalizes inline `background: #0078d4` to `rgb(0, 120, 212)`.
- **Fix:** Accept either the original hex or the rgb-normalised form via a small OR check.
- **Files modified:** src/tests/totals-panel-render.test.ts
- **Verification:** Color-chip test now passes deterministically
- **Committed in:** f27da0c (Task 2)

**3. [Rule 3 - Blocking] localStorage polyfill for jsdom 29 in test files**
- **Found during:** Task 1 (totals-panel-category-collapse test)
- **Issue:** This project's jsdom 29 ships an experimental persistent localStorage that requires a `--localstorage-file` flag; without it `window.localStorage.getItem`/`setItem` are undefined and `localStorage.clear()` throws "is not a function." This is a known issue documented inside `src/tests/use-ui-panels.test.ts` for the same reason.
- **Fix:** Mirrored the in-memory polyfill from `use-ui-panels.test.ts` (Map-backed Storage shape installed via `Object.defineProperty(window, 'localStorage', ...)`) and called `installLocalStoragePolyfill()` inside `beforeEach` for each new test file that touches the clmc.ui store.
- **Files modified:** src/tests/totals-panel-category-collapse.test.ts, src/tests/totals-panel-render.test.ts, src/tests/totals-panel-empty-states.test.ts
- **Verification:** All 15 plan-04 tests pass; useUiPanels persistence is asserted directly against the polyfilled store
- **Committed in:** f195769 (Task 1) + f27da0c (Task 2)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All three deviations were necessary for correctness. The Zustand identity-loop fix protects production runtime; the jsdom hex-normalisation tweak only affects test brittleness; the localStorage polyfill matches an existing in-repo pattern documented in `use-ui-panels.test.ts`. No scope creep, no architectural change.

## Issues Encountered

- **Worktree setup base mismatch:** The worktree was created at base commit `88731e4`, which predates the wave 1/2 work (06-01 through 06-03). I reset the worktree-agent branch to `1b90204` (master HEAD) so the prior-wave files (useBoqLive, useUiPanels, HoverRing, PulseHighlight, etc.) were available to depend on. Reset was applied only to the `worktree-agent-adedde2d8bdd38174` branch — no protected refs touched, no `git update-ref` used.

## TDD Gate Compliance

This plan was executed in a TDD wave with the RED scaffolds already committed by the Wave 0 plan (`41c50b2`, `f59af5d`). Both tasks flipped the corresponding scaffolded tests to GREEN by replacing `it.todo(...)` with full assertions and shipping the implementation.

- Task 1 GREEN gate: `f195769` — feat(06-04): TotalsRow + TotalsCategoryBlock
- Task 2 GREEN gate: `f27da0c` — feat(06-04): TotalsPanel shell + TotalsPanelHeader + empty states

The original RED gate was `41c50b2` / `f59af5d` (Wave 0 RED scaffold). No refactor commits were needed — the GREEN implementations matched the patterns directly.

## User Setup Required

None — purely renderer code. No env vars, no IPC, no native dependencies.

## Threat Flags

No new security-relevant surface introduced. The plan's threat model entries (T-06-04-01 information disclosure: accept; T-06-04-02 CSS injection via item.color: mitigate) are honoured — chip background is bound directly to `item.color` which the aggregator sources from `getColorForName` → MARKUP_PALETTE (a fixed 10-swatch hex set), so no user-controlled CSS can flow into the DOM.

## Self-Check: PASSED

Verified:
- `src/renderer/src/components/TotalsPanel.tsx` exists ✓
- `src/renderer/src/components/TotalsPanelHeader.tsx` exists ✓
- `src/renderer/src/components/TotalsCategoryBlock.tsx` exists ✓
- `src/renderer/src/components/TotalsRow.tsx` exists ✓
- Commit `f195769` exists ✓
- Commit `f27da0c` exists ✓
- All 3 plan-04 test files green: 15/15 tests pass ✓
- Verification grep contracts:
  - "Open a PDF to begin." appears once in code ✓
  - "Place markups to see totals." appears once in code ✓
  - "Place markups on a calibrated page" appears once in code ✓
  - `useBoqLive()` called exactly once in TotalsPanel ✓
  - `COLORS.accent` does NOT appear in TotalsCategoryBlock (D-06) ✓
- TypeScript compilation clean (`npx tsc -p tsconfig.web.json --noEmit` exits 0) ✓
- ESLint passes (no errors; auto-fixed prettier whitespace) ✓

## Next Phase Readiness

Plan 06-05 can now wire the row interaction handlers to `useMarkupHighlight` (transient overlay lifecycle from Plan 06-02) and the cycle navigation reducer:
- `onRowHover(matches)` → `useMarkupHighlight().setHover(matches)` driving the HoverRing layer
- `onRowClick(item, categoryName)` → cycle navigation (markup-cycle reducer + `useMarkupHighlight().triggerPulse(matches, item.color ?? '#cccccc')`)
- `onRowContextMenu(item, x, y)` → mount the new `TotalsRowContextMenu` (Plan 06-05 also creates this)

The TotalsPanel's `cycleIndexByKey` prop is already plumbed end-to-end so the parent can supply per-key cycle position without further component changes.

No blockers.

---
*Phase: 06-live-view-and-ui-polish*
*Completed: 2026-05-05*
