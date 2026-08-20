---
phase: quick-260820-plx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/src/hooks/useUiPanels.ts
  - src/renderer/src/components/TopActionBar.tsx
  - src/tests/use-ui-panels-shared.test.ts
  - src/tests/top-action-bar-visibility-highlight.test.ts
  - .planning/quick/260820-plx-fix-topactionbar-totals-toggle-and-show-/260820-plx-MANUAL-NOTES.md
autonomous: false
requirements: [QUICK-260820-PLX-01, QUICK-260820-PLX-02]

must_haves:
  truths:
    - "Clicking the Totals button in the top action bar actually collapses the Totals panel; clicking again reopens it"
    - "The Totals button's active highlight (aria-pressed) matches the panel's real open state, whether flipped from the top bar or from the panel's own collapse chevron"
    - "TotalsCategoryBlock and EstimateCategoryBlock share ONE collapsedCategories list — collapsing in one surface is reflected in the other and survives a reload"
    - "Show All is highlighted exactly when nothing is hidden"
    - "Hide All is highlighted exactly when every markup key is hidden"
    - "Neither Show All nor Hide All is highlighted in a partial state (some items hidden)"
    - "The Show/Hide highlight updates live when visibility changes elsewhere in the app (Totals row lightbulb), with no remount of the bar"
    - "The clmc.ui localStorage contract is unchanged: same key, same DEFAULTS, same defensive shape check, silent reset on parse failure / shape mismatch, silent ignore on write failure"
    - "The Splitter still commits width only on pointerup — no per-pointermove localStorage write, no per-pointermove App re-render"
  artifacts:
    - path: "src/renderer/src/hooks/useUiPanels.ts"
      provides: "Single shared module-level UiState store consumed via useSyncExternalStore; UseUiPanelsApi unchanged"
      contains: "useSyncExternalStore"
    - path: "src/renderer/src/components/TopActionBar.tsx"
      provides: "Reactive Show All / Hide All active-state derivation wired to the two BarButtons"
      contains: "hideAllActive"
    - path: "src/tests/use-ui-panels-shared.test.ts"
      provides: "Proof that two independent useUiPanels() consumers stay in sync + storage contract preserved"
      contains: "stay in sync"
    - path: "src/tests/top-action-bar-visibility-highlight.test.ts"
      provides: "Proof of the three Show/Hide highlight states (none / all / partial) + live store-driven update"
      contains: "aria-pressed"
    - path: ".planning/quick/260820-plx-fix-topactionbar-totals-toggle-and-show-/260820-plx-MANUAL-NOTES.md"
      provides: "How-To-Manual notes for the Totals toggle + the three-state Show/Hide highlight semantics"
      contains: "Show All"
  key_links:
    - from: "src/renderer/src/components/TopActionBar.tsx"
      to: "src/renderer/src/hooks/useUiPanels.ts"
      via: "useUiPanels() now reads the shared module store — the same state App.tsx:56 renders from"
      pattern: "useUiPanels\\(\\)"
    - from: "src/renderer/src/hooks/useUiPanels.ts"
      to: "React"
      via: "useSyncExternalStore(subscribe, getSnapshot)"
      pattern: "useSyncExternalStore\\(subscribe"
    - from: "src/renderer/src/components/TopActionBar.tsx"
      to: "src/renderer/src/stores/projectStore.ts"
      via: "reactive selector on hiddenItemNames (NOT getState())"
      pattern: "useProjectStore\\(\\(s\\) => s\\.hiddenItemNames\\)"
    - from: "src/renderer/src/components/TopActionBar.tsx"
      to: "src/renderer/src/stores/markupStore.ts"
      via: "reactive selector on pageMarkups feeding the allItemKeys memo"
      pattern: "useMarkupStore\\(\\(s\\) => s\\.pageMarkups\\)"
---

<objective>
Fix two TopActionBar defects, both already root-caused:

1. **Totals toggle is inert.** `useUiPanels` is a per-component `useState` hook, so every
   caller holds an ISOLATED copy of `UiState`. App.tsx:56 owns the copy that drives
   `<TotalsPanel open={totals.open}>` (App.tsx ~552-556); TopActionBar.tsx:147 owns a
   separate one. `handleToggleTotals` (TopActionBar.tsx:169-171) mutates only TopActionBar's
   copy + writes localStorage, so App never re-renders and the panel never moves. The same
   isolation silently corrupts `collapsedCategories` across TotalsCategoryBlock.tsx:56 and
   EstimateCategoryBlock.tsx:49 — each block keeps its own array and clobbers the other's in
   localStorage (visible after a reload). Fix: make `useUiPanels` a SINGLE SHARED store,
   keeping `UseUiPanelsApi` byte-identical so no call site changes.

2. **Show All / Hide All never highlight.** TopActionBar.tsx:442-455 renders the Eye/EyeOff
   `BarButton`s with no `active` prop, so `BarButton` (line 82) always paints them
   transparent. Fix: derive the active state reactively from `projectStore.hiddenItemNames`
   vs the set of every markup key.

Purpose: the top bar's visibility controls are the estimator's fastest path to
"show me everything / hide everything" — an inert toggle and unlit state indicators make the
bar untrustworthy.

Output: shared UI-panel store, two lit visibility buttons, two new test files, manual notes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

Source files (read only what each task's `<files>` names — the interfaces below are already
extracted so no codebase scavenger hunt is needed):

- `src/renderer/src/hooks/useUiPanels.ts` (109 lines — the whole file is rewritten in Task 1)
- `src/renderer/src/components/TopActionBar.tsx` (481 lines — Task 2 touches lines 1, ~142-152, ~442-455)
- `src/tests/use-ui-panels.test.ts` (do-not-edit reference: the localStorage polyfill helper + harness pattern to copy)
- `src/tests/visibility-markdirty.test.ts` (do-not-edit reference: the TopActionBar render harness, store-reset `beforeEach`, and the one-count-markup fixture to copy)

**There is NO `npm test` script — the suite runs via `npx vitest run`.**
Baseline to hold (STATE.md, commit 2452806): **118 files, 859/859 pass, 0 failures.**
`npm run typecheck` clean, `npm run lint` with zero NEW errors.

<interfaces>
<!-- Extracted from the codebase. Use these directly. -->

`src/renderer/src/hooks/useUiPanels.ts` — the contract that MUST NOT change:

  const STORAGE_KEY = 'clmc.ui'

  export interface UiState {
    totals: { open: boolean; width: number }
    collapsedCategories: string[]
  }

  const DEFAULTS: UiState = { totals: { open: true, width: 320 }, collapsedCategories: [] }

  function readStorage(): UiState   // getItem → !raw ? DEFAULTS : JSON.parse → 3-field
                                    // shape check (totals.open boolean, totals.width number,
                                    // collapsedCategories Array) → parsed, else DEFAULTS;
                                    // try/catch → DEFAULTS  (T-06-01-01)
  function writeStorage(s: UiState): void   // setItem(JSON.stringify) in try/catch, empty
                                            // catch body  (T-06-01-02)

  export interface UseUiPanelsApi {
    totals: { open: boolean; width: number }
    collapsedCategories: string[]
    setTotalsOpen: (open: boolean) => void
    setTotalsWidth: (width: number) => void
    toggleCategoryCollapsed: (categoryName: string) => void
  }

  export function useUiPanels(): UseUiPanelsApi

Current state-updater bodies (lift VERBATIM into the module-level store):

  setTotalsOpen:            (s) => ({ ...s, totals: { ...s.totals, open } })
  setTotalsWidth:           (s) => ({ ...s, totals: { ...s.totals, width } })
  toggleCategoryCollapsed:  (s) => ({ ...s, collapsedCategories:
                              s.collapsedCategories.includes(name)
                                ? s.collapsedCategories.filter((c) => c !== name)
                                : [...s.collapsedCategories, name] })

All five call sites (NONE may change):
  App.tsx:56                     const { totals, setTotalsOpen, setTotalsWidth } = useUiPanels()
  TopActionBar.tsx:147           const { totals, setTotalsOpen } = useUiPanels()
  TotalsCategoryBlock.tsx:56     const { collapsedCategories, toggleCategoryCollapsed } = useUiPanels()
  EstimateCategoryBlock.tsx:49   const { collapsedCategories, toggleCategoryCollapsed } = useUiPanels()
  (Splitter.tsx only mentions the hook in comments — no call.)

`src/renderer/src/stores/projectStore.ts` (fields Task 2 reads):
  hiddenItemNames: string[]                  // persisted in .clmc; key shape `${name}|${categoryId}`
  hiddenItemSet: Set<string>                 // derived O(1) mirror, kept in sync
  setHiddenItemNames: (names: string[]) => void   // sets BOTH; does NOT markDirty (Pitfall 7)
  markDirty: () => void

`src/renderer/src/components/TopActionBar.tsx` — the exact block Task 2 edits (442-455):

  <BarButton icon={Eye}    onClick={handleShowAll}
             disabled={totalPages === 0}
             title="Make every markup visible (clears hidden-items)"
             ariaLabel="Show All markups" />
  <BarButton icon={EyeOff} onClick={handleHideAll}
             disabled={totalPages === 0 || !hasMarkups}
             title="Hide every markup on every page"
             ariaLabel="Hide All markups" />

  BarButton (line 74-124): `active` → background COLORS.activeSurface + aria-pressed={active};
  the hover/mousedown/mouseup handlers already read `active` — no BarButton change needed.

  handleHideAll (180-191) builds keys as:
    Object.values(pageMarkups).flat().map((m) => `${m.name}|${m.categoryId}`)
</interfaces>

<constraints>
- **Storage contract frozen.** `STORAGE_KEY`, `DEFAULTS`, `readStorage()`'s defensive shape
  check, silent reset to DEFAULTS (missing key / parse throw / shape mismatch) and silent
  ignore of write failures must all survive byte-identical.
- **Splitter perf path frozen.** The store still commits to localStorage on every state
  change, so the Splitter MUST keep holding in-flight pointermove width in local component
  state and call `setTotalsWidth` only on pointerup. Do not touch App.tsx's imperative drag
  path (`totalsPanelRef` / `dragBaseTransitionRef`, App.tsx:70-102).
  `src/tests/splitter-drag-imperative.test.ts` must stay green.
- **`UseUiPanelsApi` is byte-identical.** No call site edits. `src/tests/use-ui-panels.test.ts`
  keeps passing unmodified.
- **No new dependencies.** `git diff --stat package.json package-lock.json` must be empty.
- Do not restyle the top bar or change any other button.
</constraints>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Make useUiPanels a single shared store (fixes the inert Totals toggle)</name>
  <files>src/renderer/src/hooks/useUiPanels.ts, src/tests/use-ui-panels-shared.test.ts</files>

  <behavior>
  New test file `src/tests/use-ui-panels-shared.test.ts` (jsdom; copy the
  `installLocalStoragePolyfill()` helper and the `useLayoutEffect` holder harness verbatim
  from `src/tests/use-ui-panels.test.ts` — jsdom 29 here has no usable localStorage without
  it, and eslint react-hooks v7 forbids render-time holder writes):

  - Test 1 (the actual bug): render TWO SEPARATE components in one tree, each calling
    `useUiPanels()`. Consumer A calls `setTotalsOpen(false)`. Consumer B's `totals.open`
    reads `false`. Then B calls `setTotalsOpen(true)` and A reads `true`.
    (This is the App.tsx-vs-TopActionBar.tsx isolation, reduced to a harness.)
  - Test 2: consumer A calls `toggleCategoryCollapsed('Civil')`; consumer B's
    `collapsedCategories` equals `['Civil']` (the TotalsCategoryBlock ↔ EstimateCategoryBlock
    clobber).
  - Test 3: after `__resetUiPanelsForTests()` + empty storage, a fresh mount reads DEFAULTS —
    `{ open: true, width: 320 }` and `[]`.
  - Test 4: seed `clmc.ui` with `{ totals: { open: false, width: 500 }, collapsedCategories: ['Civil'] }`
    BEFORE mount → the mounted consumers read those values (first-subscribe storage read).
  - Test 5: seed `clmc.ui` with garbage (`'{not json'`) and with a shape mismatch
    (`'{"totals":{"open":"yes","width":"wide"},"collapsedCategories":"nope"}'`) → both mount
    to DEFAULTS with no throw (T-06-01-01 preserved).
  - Test 6: `setTotalsWidth(420)` writes `clmc.ui` with `totals.width === 420`, and mounting
    alone (no setter call) writes nothing — assert via a `setItem` spy that the count is 0
    after mount and 1 after the single setter call (proves the Splitter's one-write-per-commit
    contract is intact).
  </behavior>

  <action>
  Rewrite `src/renderer/src/hooks/useUiPanels.ts` as a single module-level store consumed
  through `useSyncExternalStore`. Keep `STORAGE_KEY`, `UiState`, `DEFAULTS`, `readStorage`,
  `writeStorage` and `UseUiPanelsApi` exactly as they are today.

  Add below `writeStorage`:
  - `let state: UiState | null = null` and `const listeners = new Set<() => void>()`.
  - `getSnapshot(): UiState` — lazily initialises `state` from `readStorage()` when null and
    returns the SAME object reference until a mutation replaces it. Reference stability is
    mandatory: `useSyncExternalStore` re-invokes `getSnapshot` on every render and throws
    "getSnapshot should be cached" / loops forever if a fresh object is returned each call.
  - `emit()` — iterate a snapshot copy of `listeners` and call each.
  - `apply(updater: (s: UiState) => UiState): void` — compute `next` from `getSnapshot()`;
    return early if `next === state`; assign `state = next`; `writeStorage(next)`; `emit()`.
    This is the ONLY write path, preserving one localStorage write per committed change.
  - `subscribe(listener: () => void): () => void` — add the listener FIRST, then, if this was
    the 0→1 transition, reconcile against storage: read `readStorage()` and replace `state`
    only when `JSON.stringify(fresh) !== JSON.stringify(getSnapshot())`, then `emit()`.
    Return a closure that does `listeners.delete(listener)` (T-PLX-02: this closure is the
    only thing preventing an unbounded listener set across mount/unmount cycles).
  - **Reset mechanism (stated explicitly, per the quick-task constraint): first-subscribe
    storage reconcile is the PRIMARY mechanism.** Module state would otherwise survive
    Vitest's `beforeEach` localStorage clear and leak across cases; because App.tsx keeps at
    least one consumer mounted for the whole app session, the 0→1 reconcile only ever runs at
    boot in production, where in-memory state and storage are already identical (writes are
    synchronous on every change) — so it is a no-op there and a clean reset in tests.
    ALSO export `export function __resetUiPanelsForTests(): void { state = null }` for the new
    test's `beforeEach`, giving first-render determinism without waiting for the subscribe
    reconcile. Adding a named export does NOT change `UseUiPanelsApi` or any call site.
  - Move `setTotalsOpen`, `setTotalsWidth`, `toggleCategoryCollapsed` to module scope as plain
    functions wrapping `apply(...)`, with the three updater bodies lifted VERBATIM from the
    current `useCallback`s (see `<interfaces>`). Module-scope functions are permanently stable
    references, so `useCallback` is no longer needed.
  - Hook body becomes: `const s = useSyncExternalStore(subscribe, getSnapshot)` then
    `return { totals: s.totals, collapsedCategories: s.collapsedCategories, setTotalsOpen,
    setTotalsWidth, toggleCategoryCollapsed }`. No `getServerSnapshot` third argument — this
    is an Electron renderer, there is no SSR/hydration path.
  - Drop the now-unused `useState` / `useEffect` / `useCallback` imports; import
    `useSyncExternalStore` from `react`.
  - Note the one deliberate behavioral delta in the doc comment: the old `useEffect(() =>
    writeStorage(state), [state])` wrote on every mount; the new store writes only on actual
    mutation. Nothing depends on a mount write, and it removes a pointless boot write.

  Doc comment: keep the existing D-03 "`clmc.ui`, NEVER inside `.clmc`" paragraph, the
  T-06-01-01 hardening paragraph and the Splitter drag-resize paragraph VERBATIM. Add a
  paragraph explaining WHY the store is shared: App.tsx and TopActionBar both call
  `useUiPanels()` and must observe the SAME `totals.open`; with per-component `useState` the
  top-bar toggle mutated a private copy and the panel never moved (quick-260820-plx). Same
  isolation made `collapsedCategories` diverge between TotalsCategoryBlock and
  EstimateCategoryBlock.

  Do NOT touch App.tsx, TopActionBar.tsx, TotalsCategoryBlock.tsx, EstimateCategoryBlock.tsx,
  Splitter.tsx, or `src/tests/use-ui-panels.test.ts`.
  </action>

  <verify>
    <automated>npx vitest run src/tests/use-ui-panels-shared.test.ts src/tests/use-ui-panels.test.ts src/tests/top-action-bar-nav.test.ts src/tests/splitter-drag-imperative.test.ts</automated>
    <automated>grep -v '^\s*\*' src/renderer/src/hooks/useUiPanels.ts | grep -c "useSyncExternalStore"</automated>
    <automated>npm run typecheck</automated>
  </verify>

  <done>
  All six new assertions pass; the four unmodified test files above stay green; typecheck is
  clean; `useUiPanels.ts` contains `useSyncExternalStore` in code (not just comments) and no
  longer imports `useState`; `git diff --stat src/renderer/src/App.tsx
  src/renderer/src/components/TotalsCategoryBlock.tsx
  src/renderer/src/components/EstimateCategoryBlock.tsx src/tests/use-ui-panels.test.ts`
  is empty.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Light Show All / Hide All from live visibility state</name>
  <files>src/renderer/src/components/TopActionBar.tsx, src/tests/top-action-bar-visibility-highlight.test.ts, .planning/quick/260820-plx-fix-topactionbar-totals-toggle-and-show-/260820-plx-MANUAL-NOTES.md</files>

  <behavior>
  New test file `src/tests/top-action-bar-visibility-highlight.test.ts` — copy the render
  harness, the two `vi.mock` blocks (`CanvasViewport`, `useProject`), the `byLabel` helper,
  the store-reset `beforeEach` and the markup fixture shape VERBATIM from
  `src/tests/visibility-markdirty.test.ts`. Seed TWO count markups so a partial state exists:
  keys `A|c1` and `B|c1`.

  - State "none hidden": `hiddenItemNames === []` →
    `byLabel('Show All markups').getAttribute('aria-pressed') === 'true'` and
    `byLabel('Hide All markups').getAttribute('aria-pressed') === 'false'`.
  - State "all hidden": `setHiddenItemNames(['A|c1','B|c1'])` →
    Show All `'false'`, Hide All `'true'`.
  - State "partial": `setHiddenItemNames(['A|c1'])` → BOTH `'false'`.
  - Live update (reactive-selector proof): render ONCE with nothing hidden, then inside `act`
    call `useProjectStore.getState().setHiddenItemNames(['A|c1','B|c1'])` WITHOUT re-rendering
    — Hide All flips to `'true'` and Show All to `'false'`. A `getState()` one-shot read
    would leave both stale, so this test is the guard against that regression.
  - Empty project guard: `useMarkupStore.getState().reset()` (zero markups, nothing hidden) →
    Hide All is NOT pressed (`'false'`). Without the length guard, `[].every()` returns true
    and Hide All would light up on an empty project.
  - Untouched contract: with `totalPages: 0`, both buttons still report
    `aria-disabled === 'true'`; with markups present and `totalPages: 3`, both report
    `'false'` for Show All and Hide All respectively.
  </behavior>

  <action>
  In `src/renderer/src/components/TopActionBar.tsx`:

  1. Add `useMemo` to the existing React import (line 1 becomes `import React, { useMemo } from 'react'`).
  2. Beside the existing store selectors (~line 142, next to `hasMarkups`), add TWO reactive
     selectors:
       `const hiddenItemNames = useProjectStore((s) => s.hiddenItemNames)`
       `const pageMarkups = useMarkupStore((s) => s.pageMarkups)`
     Both return store-owned references. Do NOT build a fresh array/object inside a selector —
     Zustand 5 uses `useSyncExternalStore` under the hood and a new reference per call loops.
     (`hasMarkups` is safe as-is because it returns a boolean.)
  3. Derive the active states below the existing `disabled` derivations:
       `const allItemKeys = useMemo(() => Array.from(new Set(Object.values(pageMarkups).flat().map((m) => \`${m.name}|${m.categoryId}\`))), [pageMarkups])`
       `const hiddenSet = useMemo(() => new Set(hiddenItemNames), [hiddenItemNames])`
       `const showAllActive = hiddenItemNames.length === 0`
       `const hideAllActive = allItemKeys.length > 0 && allItemKeys.every((k) => hiddenSet.has(k))`
     The `allItemKeys.length > 0` guard is load-bearing: `[].every()` is vacuously true, which
     would light Hide All on an empty project.
     Key shape is `${name}|${categoryId}` — the VISIBILITY key (Pitfall 1). It is deliberately
     NOT the `${name}|${type}` rate key used by pricing.
  4. Pass `active={showAllActive}` to the Eye `BarButton` and `active={hideAllActive}` to the
     EyeOff `BarButton` (lines ~442-455). Change nothing else on those two elements — the
     existing `disabled` derivations, titles and aria-labels stay verbatim. `BarButton` itself
     is not modified: it already maps `active` to `COLORS.activeSurface` + `aria-pressed`.
  5. Leave `handleShowAll` and `handleHideAll` BYTE-IDENTICAL, including both explicit
     `markDirty()` calls (Pitfall 7). `handleHideAll` keeps its own `getState()` key build —
     reading at click time is authoritative if a markup lands between render and click. Add a
     one-line comment above `allItemKeys` noting it mirrors `handleHideAll`'s key shape and
     that the two must stay in step.
  6. Extend the file's header doc comment with a short paragraph: Show All / Hide All are
     STATE INDICATORS as well as actions — lit when the app is fully in that state, both dark
     in a partial state (quick-260820-plx).

  Then write `.planning/quick/260820-plx-fix-topactionbar-totals-toggle-and-show-/260820-plx-MANUAL-NOTES.md`
  (manual-ready, per the standing How-To-Manual rule): a short "Top action bar — visibility
  controls" section covering (a) the Totals button toggles the right-hand Totals panel and
  stays lit while the panel is open, and its state is shared with the panel's own collapse
  chevron; (b) Show All clears every hidden item and lights up when nothing is hidden;
  (c) Hide All hides every markup on every page and lights up only when everything is hidden;
  (d) hiding items one at a time from the Totals row lightbulbs leaves BOTH buttons dark —
  that dark/dark state means "partially hidden"; (e) panel preferences (Totals open/width,
  collapsed categories) live per-workstation in browser storage, not inside the `.clmc` file.
  </action>

  <verify>
    <automated>npx vitest run src/tests/top-action-bar-visibility-highlight.test.ts src/tests/visibility-markdirty.test.ts src/tests/top-action-bar-file-ops.test.ts src/tests/top-action-bar-nav.test.ts</automated>
    <automated>npm run typecheck &amp;&amp; npx vitest run 2>&amp;1 | tail -15</automated>
    <automated>npm run lint</automated>
  </verify>

  <done>
  All new highlight assertions pass; the three pre-existing TopActionBar test files stay
  green; the FULL suite is at or above the 859/859 baseline; typecheck clean; zero NEW lint
  errors; `git diff --stat package.json package-lock.json` is empty; MANUAL-NOTES.md exists.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verify — Totals toggle moves the panel, Show/Hide buttons light correctly</name>
  <files>none (verification only)</files>
  <action>
Pause. Present the what-built summary and the numbered verification steps below to the user,
then wait for the resume signal. Do not proceed or self-approve — `auto_advance` is false,
and this checkpoint confirms the exact two defects the user reported in the running app.
Both are UI-feel defects (a dead button and missing state indication) that no unit test can
fully close out.
  </action>
  <what-built>
  Both TopActionBar defects are fixed and locked by tests:
  - `useUiPanels` is now ONE shared store (module-level state + `useSyncExternalStore`), so
    the top bar's Totals button and App's `<TotalsPanel open>` read the same value. The
    public hook API and the `clmc.ui` storage contract are unchanged.
  - Show All / Hide All now light up (`COLORS.activeSurface` + `aria-pressed`) from live
    `hiddenItemNames` vs every markup key, with neither lit in a partial state.
  </what-built>
  <how-to-verify>
  Run `npm run dev` and open a PDF with at least three markups spread across two names.

  1. Click the **Totals** button (table icon, right group). The Totals panel must COLLAPSE
     and the button must go dark. Click again — the panel reopens and the button lights.
  2. Collapse the panel with its OWN chevron instead. The top-bar Totals button must go dark
     in the same instant (shared state, both directions).
  3. Restart the app. The Totals panel's open/closed state and width are as you left them.
  4. Collapse a category in the Totals panel, switch to the **Estimate** tab: the SAME
     category is collapsed there. Collapse a different one in Estimate, switch back — both
     stay collapsed. Restart the app: both are still collapsed (previously one surface
     clobbered the other's list in storage).
  5. With nothing hidden: **Show All** is lit, **Hide All** is dark.
  6. Click **Hide All**: every markup disappears, Hide All lights, Show All goes dark.
  7. Click **Show All**: everything reappears, Show All lights, Hide All goes dark.
  8. Hide ONE item via its Totals-row lightbulb: BOTH buttons must be dark (partial state).
     Hide the rest one by one — Hide All lights only when the LAST one is hidden.
  9. Drag the Totals splitter: the panel must still track the pointer smoothly with no
     trailing/lag, and the width must persist after release + restart.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what you saw instead</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| localStorage `clmc.ui` → renderer UI state | A user- or malware-editable JSON blob on disk is parsed into React state on every app boot |
| Zustand stores → TopActionBar render | Untrusted-shaped markup names/categoryIds are template-joined into visibility keys |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-PLX-01 | Tampering | `readStorage()` in useUiPanels.ts | mitigate | Defensive 3-field shape check + try/catch preserved BYTE-IDENTICAL; hand-edited/corrupt `clmc.ui` silently resets to DEFAULTS. Locked by Task 1 Test 5 (garbage JSON + shape mismatch both mount to DEFAULTS with no throw) |
| T-PLX-02 | Denial of Service | module-level `listeners` Set | mitigate | `subscribe()` returns a closure that deletes its own listener; React invokes it on unmount. Set never grows across mount/unmount cycles. No `emit()` inside `apply()`'s early-return path, so an unchanged state cannot cascade renders |
| T-PLX-03 | Denial of Service | localStorage write volume | mitigate | `apply()` is the ONLY write path and writes once per committed change; the Splitter's pointerup-only commit is unchanged and asserted by `splitter-drag-imperative.test.ts` + Task 1 Test 6 (setItem spy count 0 on mount, 1 per setter call) |
| T-PLX-04 | Information Disclosure | `clmc.ui` contents | accept | Payload is a panel width, an open boolean and category name strings — no PII, no credentials, no file paths. Already the shipped Phase-6 contract (D-03) |
| T-PLX-05 | Tampering | `allItemKeys` template join in TopActionBar | accept | Keys are compared against `hiddenItemNames` for a boolean highlight only — never rendered as HTML, never used in a query or path. Same join `handleHideAll` already performs |
| T-PLX-SC | Tampering | npm/pip/cargo installs | mitigate | ZERO package installs in this plan — no `npm install` task exists. Gate satisfied by assertion: `git diff --stat package.json package-lock.json` must be empty in both tasks' `<done>`. No RESEARCH.md legitimacy audit required because no package is added |
</threat_model>

<verification>
1. `npm run typecheck` — clean (0 errors).
2. `npx vitest run` — FULL suite at or above the STATE.md baseline of **118 files, 859/859
   pass, 0 failures** (commit 2452806), plus the new assertions from both test files.
3. `npx vitest run src/tests/use-ui-panels.test.ts src/tests/top-action-bar-nav.test.ts src/tests/splitter-drag-imperative.test.ts src/tests/visibility-markdirty.test.ts`
   — all green with those files UNMODIFIED (proves API + storage + perf contracts held).
4. `npm run lint` — zero NEW errors.
5. `git diff --stat package.json package-lock.json` — empty (T-PLX-SC).
6. `git diff --stat src/renderer/src/App.tsx src/renderer/src/components/Splitter.tsx src/renderer/src/components/TotalsCategoryBlock.tsx src/renderer/src/components/EstimateCategoryBlock.tsx`
   — empty (no call-site churn; `UseUiPanelsApi` truly unchanged).
7. Blocking human-verify checkpoint approved.
</verification>

<success_criteria>
- Clicking the top-bar Totals button collapses/reopens the real Totals panel, and the button's
  highlight tracks the panel's actual state from BOTH directions.
- Totals open/width and collapsedCategories are a single shared state across App,
  TopActionBar, TotalsCategoryBlock and EstimateCategoryBlock; collapse state no longer
  diverges between the Totals panel and the Estimate sheet across a reload.
- Show All is lit iff nothing is hidden; Hide All is lit iff every markup key is hidden;
  neither is lit in a partial state or on an empty project.
- The highlight updates live from store changes made elsewhere (no remount required).
- `clmc.ui` key, DEFAULTS, defensive read, silent-reset and silent-write-failure behavior are
  unchanged; the Splitter still writes once per drag on pointerup.
- Full suite ≥ 859/859, typecheck clean, zero new lint errors, zero dependency changes.
</success_criteria>

<output>
Create `.planning/quick/260820-plx-fix-topactionbar-totals-toggle-and-show-/260820-plx-SUMMARY.md` when done.
</output>
