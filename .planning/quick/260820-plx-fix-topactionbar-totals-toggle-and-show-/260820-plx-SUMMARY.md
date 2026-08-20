---
phase: quick-260820-plx
plan: 01
subsystem: renderer-ui-chrome
tags: [top-action-bar, ui-panels, visibility, shared-store, useSyncExternalStore]
status: awaiting-human-verify
requires:
  - src/renderer/src/stores/projectStore.ts (hiddenItemNames, setHiddenItemNames, markDirty)
  - src/renderer/src/stores/markupStore.ts (pageMarkups)
provides:
  - Single shared module-level UiState store behind useUiPanels (totals open/width + collapsedCategories)
  - Reactive Show All / Hide All active-state derivation on the top action bar
affects:
  - src/renderer/src/App.tsx (now re-renders when TopActionBar flips totals.open — via the shared store, file unchanged)
  - src/renderer/src/components/TotalsCategoryBlock.tsx (shares one collapsedCategories list — file unchanged)
  - src/renderer/src/components/EstimateCategoryBlock.tsx (shares one collapsedCategories list — file unchanged)
tech-stack:
  added: []
  patterns:
    - "Module-level store + useSyncExternalStore(subscribe, getSnapshot) for cross-component UI state that must NOT live in a Zustand store"
    - "First-subscribe (0->1 listener) storage reconcile as the reset seam — no-op in production, clean reset in tests"
key-files:
  created:
    - src/tests/use-ui-panels-shared.test.ts
    - src/tests/top-action-bar-visibility-highlight.test.ts
    - .planning/quick/260820-plx-fix-topactionbar-totals-toggle-and-show-/260820-plx-MANUAL-NOTES.md
  modified:
    - src/renderer/src/hooks/useUiPanels.ts
    - src/renderer/src/components/TopActionBar.tsx
decisions:
  - "useUiPanels state moved to MODULE scope behind useSyncExternalStore — UseUiPanelsApi kept byte-identical so all four call sites compile untouched"
  - "apply() is the ONLY write path — one localStorage write per committed change, preserving the Splitter's pointerup-only contract"
  - "subscribe() reconciles against storage only on the 0->1 listener transition; __resetUiPanelsForTests() added for first-render determinism in tests"
  - "Hide All highlight is guarded by allItemKeys.length > 0 because [].every() is vacuously true"
metrics:
  duration: ~12min
  tasks_completed: 2 of 3 (task 3 is a blocking human-verify checkpoint)
  completed: 2026-08-20
---

# Quick Task 260820-plx: Fix TopActionBar Totals toggle and Show/Hide All highlight — Summary

Made `useUiPanels` a single module-level store read through `useSyncExternalStore` (fixing the
inert top-bar Totals button and the `collapsedCategories` clobber between the Totals panel and
the Estimate sheet), and wired Show All / Hide All to light up reactively from live
`hiddenItemNames` vs every markup key.

## Status

**Tasks 1 and 2 COMPLETE and committed. Task 3 is a BLOCKING human-verify checkpoint and has
NOT been performed or self-approved.** The quick task is not closed until the user runs the
9-step checklist in the plan's `<how-to-verify>` block and replies with the resume signal.

## What Changed

### Task 1 — `useUiPanels` becomes a single shared store

**Root cause:** `useUiPanels` was a per-component `useState` hook, so every caller held an
ISOLATED copy of `UiState`. App.tsx:56 owned the copy driving `<TotalsPanel open={totals.open}>`;
TopActionBar.tsx:147 owned a separate one. `handleToggleTotals` mutated only TopActionBar's copy
(plus localStorage), so App never re-rendered and the panel never moved. The same isolation made
`collapsedCategories` diverge between TotalsCategoryBlock and EstimateCategoryBlock — each kept
its own array and clobbered the other's in storage, visible after a reload.

`src/renderer/src/hooks/useUiPanels.ts` rewritten:

- Module-level `let state: UiState | null` + `const listeners = new Set<() => void>()`.
- `getSnapshot()` lazily initialises from `readStorage()` and returns the SAME reference until a
  mutation replaces it (reference stability is mandatory — `useSyncExternalStore` re-invokes
  `getSnapshot` every render and throws "getSnapshot should be cached" otherwise).
- `apply(updater)` is the ONLY write path: compute next, early-return if unchanged, assign,
  `writeStorage`, `emit`. One localStorage write per committed change.
- `subscribe(listener)` adds the listener FIRST, then reconciles against storage only on the
  0→1 transition, and returns a self-deleting closure (T-PLX-02 — the listener Set can never
  grow across mount/unmount cycles).
- `__resetUiPanelsForTests()` exported for first-render determinism in tests. Adding a named
  export does not change `UseUiPanelsApi`.
- `setTotalsOpen` / `setTotalsWidth` / `toggleCategoryCollapsed` moved to module scope with the
  three updater bodies lifted verbatim; `useCallback` dropped (module-scope functions are
  permanently stable).
- Doc comment keeps the D-03 `clmc.ui`-never-inside-`.clmc` paragraph, the T-06-01-01 hardening
  paragraph and the Splitter drag-resize paragraph verbatim, plus a new paragraph explaining why
  the store is shared.

**Storage contract unchanged:** `STORAGE_KEY`, `DEFAULTS`, `readStorage`'s 3-field defensive
shape check, silent reset to DEFAULTS on missing key / parse throw / shape mismatch, and silent
ignore of write failures are all byte-identical.

**One deliberate behavioral delta:** the old `useEffect(() => writeStorage(state), [state])`
wrote on every mount; the store now writes only on an actual mutation. Nothing depended on the
mount write, and it removes a pointless boot write. Locked by the `setItem` spy assertion
(0 writes after mounting two consumers, 1 after a single setter call).

### Task 2 — Show All / Hide All light from live visibility state

**Root cause:** the Eye / EyeOff `BarButton`s were rendered with no `active` prop, so `BarButton`
always painted them transparent with `aria-pressed="false"`.

`src/renderer/src/components/TopActionBar.tsx`:

- `useMemo` added to the React import.
- Two reactive selectors beside `hasMarkups`: `useProjectStore((s) => s.hiddenItemNames)` and
  `useMarkupStore((s) => s.pageMarkups)` — both return store-owned references (a fresh
  array/object per selector call would loop under Zustand 5's `useSyncExternalStore`).
- `allItemKeys` (memoised, deduped, `${name}|${categoryId}` — the VISIBILITY key, deliberately
  NOT the `${name}|${type}` rate key), `hiddenSet`, `showAllActive = hiddenItemNames.length === 0`,
  `hideAllActive = allItemKeys.length > 0 && allItemKeys.every((k) => hiddenSet.has(k))`.
- `active={showAllActive}` / `active={hideAllActive}` passed to the two buttons. Nothing else on
  those elements changed — the `disabled` derivations, titles and aria-labels are verbatim.
- `handleShowAll` / `handleHideAll` are BYTE-IDENTICAL, both explicit `markDirty()` calls intact
  (Pitfall 7). `handleHideAll` keeps its own click-time `getState()` key build; a comment above
  `allItemKeys` notes the two key builds must stay in step.
- Header doc comment extended: the two buttons are STATE INDICATORS as well as actions, and both
  stay dark in a partial state.
- `BarButton` itself was NOT modified — it already maps `active` to `COLORS.activeSurface` +
  `aria-pressed`.

`260820-plx-MANUAL-NOTES.md` written per the standing How-To-Manual rule: Totals toggle,
Show All / Hide All semantics, the both-dark = partially-hidden reading (with a state table), and
the per-workstation vs per-project storage split.

## Commits

| # | SHA | Type | What |
|---|-----|------|------|
| 1 | `ffe5f4d` | test | RED — failing shared-store proof for useUiPanels (6 assertions) |
| 2 | `85be9f3` | feat | GREEN — useUiPanels becomes a single shared store |
| 3 | `879f08d` | test | RED — failing Show All / Hide All highlight proof (6 assertions) |
| 4 | `4f6b3b2` | style | prettier fix in the shared-store harness (curried reader flattened) |
| 5 | `0ea988c` | feat | GREEN — Show All / Hide All lit from live visibility state + MANUAL-NOTES |

## TDD Gate Compliance

Both tasks followed RED → GREEN. Task 1: `ffe5f4d` (test) → `85be9f3` (feat). Task 2:
`879f08d` (test) → `0ea988c` (feat). No REFACTOR commit was needed; `4f6b3b2` is a formatting-only
`style` commit on the Task-1 test harness.

Task 2's RED run was 3 failed / 3 passed — the three failures are the two lit states plus the
live-store-update assertion (all impossible before the fix). The three that passed at RED are the
"neither lit" states (partial, empty project, disabled contract), which exist to lock behavior
that must NOT regress, not to drive the implementation.

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | clean — 0 errors (node + web) |
| `npx vitest run` (full suite) | **120 files, 871/871 pass, 0 failures** (baseline 118 files / 859 pass + 12 new assertions) |
| `npx vitest run` on the 4 contract files (`use-ui-panels`, `top-action-bar-nav`, `splitter-drag-imperative`, `visibility-markdirty`) | green, all UNMODIFIED |
| `npm run lint` | zero NEW errors; the 4 touched files report **0 errors** and 0 non-CRLF messages (the repo-wide 77k `Delete ␍` prettier warnings are the pre-existing CRLF baseline) |
| `git diff --stat package.json package-lock.json` | empty (T-PLX-SC — zero dependency changes) |
| `git diff --stat App.tsx Splitter.tsx TotalsCategoryBlock.tsx EstimateCategoryBlock.tsx use-ui-panels.test.ts` | empty (`UseUiPanelsApi` truly unchanged — no call-site churn) |

## Deviations from Plan

**One, formatting-only.** The Task-1 test harness's curried holder-reader arrow tripped a
`prettier/prettier` indentation warning that was NOT part of the repo's pre-existing CRLF noise —
i.e. a genuinely new lint message, which the plan's `<done>` forbids. Flattened it to a
single-line function signature and committed separately as `4f6b3b2` (Rule 3 — blocking issue,
zero behavior change; the 6 assertions re-ran green after the edit).

Otherwise the plan executed exactly as written.

## Known Stubs

None. No placeholder values, no unwired data sources — both fixes read live store state.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes. The
`clmc.ui` payload and the `.clmc` schema are both unchanged; `allItemKeys` is compared for a
boolean highlight only and is never rendered as HTML or used in a query or path.

## Outstanding — BLOCKING

**Task 3 (`checkpoint:human-verify`, `gate="blocking"`) is NOT done.** Both defects are UI-feel
defects — a dead button and missing state indication — that no unit test can fully close out.
The 9-step checklist from the plan must be run against `npm run dev` with a PDF open and at least
three markups spread across two names. Resume signal: "approved", or a description of what was
seen instead.

## Self-Check: PASSED

- FOUND: src/renderer/src/hooks/useUiPanels.ts
- FOUND: src/renderer/src/components/TopActionBar.tsx
- FOUND: src/tests/use-ui-panels-shared.test.ts
- FOUND: src/tests/top-action-bar-visibility-highlight.test.ts
- FOUND: .planning/quick/260820-plx-fix-topactionbar-totals-toggle-and-show-/260820-plx-MANUAL-NOTES.md
- FOUND commits: ffe5f4d, 85be9f3, 879f08d, 4f6b3b2, 0ea988c
