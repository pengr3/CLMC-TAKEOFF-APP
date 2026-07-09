---
status: resolved
closed: 2026-07-09
closed_note: "Fix shipped in Phase 03.1 (2026-04); implicitly verified by subsequent count-tool UATs through Phase 16. Archived to resolved/ during planning cleanup."
trigger: "A single click on the canvas while the Count markup tool is active registers as TWO clicks — causing the count sequence to jump to 2 on the first placement. Ctrl+Z reveals a hidden 'first count' was placed."
created: 2026-04-21T00:00:00Z
updated: 2026-07-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. React 19 StrictMode double-invoked setState updater functions that contained `store.placeMarkup` side effects in `useMarkupTool.recordClick` (count-placing path) and `useMarkupTool.commitShape`. Verified by stashing the fix and running a regression test that explicitly mounts under StrictMode — the test observed exactly 2 count pins placed per single click, matching the user's report precisely.
test: Fix applied and verified both positively (post-fix test passes) and contrapositively (pre-fix test reproduces the bug with "expected 2 to be 1").
expecting: User confirms in the live Electron app that a single click now places exactly ONE pin labeled "1" and Ctrl+Z removes it cleanly (no hidden pin underneath).
next_action: Commit the fix with the required message, then request human verification.

## Symptoms

expected: Single click while Count tool is active places exactly ONE count pin with sequence number 1.
actual: Single click places TWO count pins (both at or very near the same coordinates). The visible top pin shows number 2. Ctrl+Z reveals a second pin (number 1) sitting underneath.
errors: None reported in console.
reproduction: (1) Open PDF, calibrate scale, click Count tool, type a name + pick color, click Start Count, click once on the plan. (2) Observe the pin shows "2" instead of "1". (3) Ctrl+Z → the "1" pin appears.
started: Started immediately after Phase 03.1-05 was executed — that wave flipped the committed-markups Konva Layer from `listening={false}` to `listening={true}` to enable hover tooltips and right-click context menus, and wired `onMouseEnter` / `onMouseLeave` / `onContextMenu` props on each of the four markup component Groups.

## Eliminated

## Evidence

- timestamp: 2026-04-21T00:05:00Z
  checked: Git diff of 2d26fbd — "thread hover/context-menu props through markup components"
  found: Plan 05 split Layer 1 into Layer 1a (listening=false, calibration + linear preview) and Layer 1b (listening=true, wraps all four committed-markup Groups). Each markup Group received `onMouseEnter`, `onMouseLeave`, `onContextMenu` props.
  implication: The Layer 1b `listening={true}` flip is the change that could cause markup Groups to intercept or bubble clicks. Need to verify how Konva Stage onClick interacts with a listening Layer that contains Groups WITHOUT explicit onClick handlers.

- timestamp: 2026-04-21T00:06:00Z
  checked: Current CanvasViewport.tsx handleStageClick (line 347) and Stage wiring (line 511)
  found: Stage has onClick={handleStageClick}. handleStageClick early-exits only on e.evt.button !== 0. It does NOT early-exit when e.target is a committed markup. It then calls recordMarkupClick(pointer). The Stage onClick in Konva fires for ANY click in ANY listening layer — bubbling is automatic.
  implication: handleStageClick always fires on any click inside a listening layer. If something placed a count pin FIRST via a different path, then the Stage onClick fires after and places SECOND pin. But — I don't see a second click source. Need to keep looking.

- timestamp: 2026-04-21T00:07:00Z
  checked: useMarkupTool.recordClick — count path places pin and stays in 'placing' mode
  found: recordClick in count+placing mode calls store.placeMarkup exactly once per invocation. It uses setState, which is safe against React double-invocation in StrictMode (state updaters must be pure — but placeMarkup is a side effect via useMarkupStore.getState().placeMarkup inside the setState updater).
  implication: STRONG SUSPECT. React 18/19 StrictMode in dev invokes state updater functions TWICE to catch impurities. The updater for recordClick calls `store.placeMarkup(markup)` as a side effect INSIDE `setState((prev) => {...})`. StrictMode will run this updater twice → placeMarkup called twice → two count pins with sequence 1 and 2.

- timestamp: 2026-04-21T00:08:00Z
  checked: Why this wasn't happening before plan 03.1-05
  found: StrictMode behavior is unchanged. But Layer 1 was previously `listening={false}` meaning the PDF background and calibration layers didn't respond to pointer events the same way. However, StrictMode double-invocation of setState updaters is INDEPENDENT of Konva listening. The bug should have existed before 05.
  implication: Hmm — StrictMode alone may not explain the timing tie to plan 05. Let me check git log on useMarkupTool to see if recordClick was changed recently.

- timestamp: 2026-04-21T00:10:00Z
  checked: main.tsx + git show 9d748d8 (pre-plan-03.1-02 CountPinMarkup) + plan 03.1-02 rewrite commit
  found: StrictMode IS enabled around <App />. The ORIGINAL CountPinMarkup (pre-03.1-02) rendered a SMALL 6px circle with the name text LABELED BESIDE the pin: "Name 1", "Name 2". Two pins placed at the same position showed two distinct side-labels. Plan 03.1-02 rewrote the pin to a LARGER 10px circle with the sequence number centered INSIDE; two stacked pins → only the top "2" is visible, the underlying "1" is completely hidden.
  implication: CONFIRMED. The bug has existed since plan 03-03 (side effect in setState updater + StrictMode double-invocation). It was visually invisible before plan 03.1-02 only because users could see side labels "Name 1" and "Name 2". After plan 03.1-02 the pins stack and hide each other. The user's timeline tie to plan 05 is coincidental — that's just when they did QA on the count tool.

- timestamp: 2026-04-21T00:11:00Z
  checked: Baseline test suite
  found: `npx vitest run` → 18 files, 201 tests, all passing. No StrictMode anywhere in src/tests.
  implication: Tests run in Node environment without StrictMode, which is why the double-invocation bug was not caught. Fix will not break tests; may need a regression test that explicitly exercises StrictMode double-invocation of recordClick.

- timestamp: 2026-04-21T00:14:00Z
  checked: Applied fix to useMarkupTool.ts (recordClick + commitShape), added regression test, stashed the fix and re-ran the new test against the pre-fix code
  found: Pre-fix regression test result → "expected 2 to be 1" — the test sees EXACTLY TWO count pins placed per single recordClick call under StrictMode. This is a direct, reproducible observation of the double-invocation side effect.
  implication: Hypothesis fully CONFIRMED via contrapositive. Fix restored; post-fix regression test passes. Full suite: 19 files / 203 tests green. Typecheck green.

## Resolution

root_cause: |
  React 19 StrictMode (enabled in src/renderer/src/main.tsx) double-invokes
  functions passed to `setState` in dev to surface impurities. The
  `useMarkupTool.recordClick` hook performed the `store.placeMarkup(markup)`
  side effect INSIDE a `setState((prev) => { ... })` updater. When the user
  single-clicked to place a count pin, the updater body ran twice under
  StrictMode, dispatching placeMarkup twice — creating two pins (sequence 1
  and sequence 2) stacked at the same stage coordinates. After plan 03.1-02
  redesigned count pins to render the number INSIDE a 10px circle, the
  stacked "2" pin covered the "1" pin entirely, making the double-write
  appear as a silent skip-to-2. Ctrl+Z revealed the hidden "1" pin.

  A second instance of the same pattern existed in `commitShape` (called
  when the user confirms a drawn linear/area/perimeter shape); it was also
  performing `store.placeMarkup` inside its setState updater and would
  therefore write shapes twice to the store.

fix: |
  1. Refactored `recordClick` so the count-placing path (which is pure side
     effect — the updater was already returning `prev` unchanged) reads
     state from a new `stateRef` and calls `store.placeMarkup` outside of
     setState. The linear/area/perimeter branch remains inside setState —
     it's a pure state-shape update with no side effects, so StrictMode
     double-invocation is safe there.
  2. Refactored `commitShape` identically — state is read from stateRef,
     `store.placeMarkup` is called once outside setState, and `setState` is
     then used solely to reset to INITIAL_STATE.
  3. Added `const stateRef = useRef(state)` + `useEffect(() => { stateRef.current = state })`
     to keep the ref snapshot in sync with React state.
  4. Added regression test `src/tests/markup-tool-strictmode.test.ts` that
     mounts `useMarkupTool` inside `<React.StrictMode>` and asserts exactly
     one count pin is placed per recordClick call. Verified this test
     FAILS against the pre-fix code (observed "expected 2 to be 1") and
     PASSES after the fix.

verification: |
  - Baseline: npx vitest run → 201 tests green (before adding new test)
  - Contrapositive proof: stashed fix, re-ran new regression test against
    pre-fix code → FAILED with "expected 2 to be 1" (confirms bug was
    exactly as hypothesized). Restored fix.
  - After fix + new test: npx vitest run → 19 files / 203 tests green
  - npm run typecheck (both node and web projects) → green
  - Manual verification by user still required to confirm end-to-end in
    the live Electron app.

files_changed:
  - src/renderer/src/hooks/useMarkupTool.ts
  - src/tests/markup-tool-strictmode.test.ts
