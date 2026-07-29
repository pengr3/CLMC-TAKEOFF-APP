---
status: resolved
trigger: "when marking up, in this case i am marking up using count, and then i feel like i am done with it so i click linear mark up tool, tool replace the count tool then i mark up on the workspace but still it continued to place count, basically the activated tool did not break, but this are switched properly."
created: 2026-07-29T00:00:00Z
updated: 2026-07-29T01:00:00Z
resolved: 2026-07-29T01:00:00Z
---

<!-- RESOLVED — both bugs user-confirmed in the running app ("confirmed, both work now").
     Bug #1: manual tool switch now breaks the previous tool's placement (clicks draw the
     new tool, not the old). Bug #2: the ContextBar chain-armed chip clears on switch (no
     stale prior group name). Two commits/one atomic change; knowledge base appended. -->


## Current Focus

hypothesis: "The tool-sync useEffect in CanvasViewport.tsx (lines 662-668) only calls activateMarkup(newTool) when `markupState.mode === 'idle'`. When Count is mid-placement (mode==='placing', chainArmed), switching to Linear sets viewerStore.activeTool='linear' but the guard blocks re-activation because mode!=='idle'. The internal useMarkupTool state machine stays toolType='count'/mode='placing', so recordMarkupClick keeps hitting the count-placing branch. The ToolRail/context-bar reflect activeTool (store), which is why the UI shows 'PLACING Linear' while clicks still place counts."
test: "Read tool-sync effect + recordClick dispatch + activatePreset/preset flow (App.tsx) to confirm the guard is the block and that removing/relaxing it won't break the chain-from-totals + reopen preset flows the guard was added to protect."
expecting: "Confirm mode==='idle' guard is the sole reason activateMarkup is not called on manual tool switch."
next_action: "AWAITING HUMAN VERIFY (bug #2). Bug #1 (clicks placed wrong markup) is USER-CONFIRMED FIXED ('i was able to break the count and went straight to linear'). Bug #2 surfaced in the same UAT: after the switch the ContextBar chip kept showing the PRIOR count group's name ('Instagram') over the fresh empty Linear tool — the stale-chip half of the same tool-switch reset. Fix applied + self-verified (typecheck clean; new markup-chain-ref seam test 8/8; activate-preset/chain/reopen/toolrail suites green; full suite still exactly 7 pre-existing localStorage-env failing files, 0 new). Need user to reproduce Count(chain)→Linear switch in the running app and confirm the armed chip clears (no stale prior name). On 'confirmed fixed' → archive session + append knowledge base."

reasoning_checkpoint:
  hypothesis: "The CanvasViewport tool-sync effect gates activateMarkup(newTool) on `markupState.mode === 'idle'`. A manual tool switch made mid-placement (Count mode='placing') leaves mode!=='idle', so the new tool is never activated in the internal useMarkupTool machine; recordMarkupClick keeps hitting the count-placing branch (which reads the hook's internal toolType/mode, not viewerStore.activeTool)."
  confirming_evidence:
    - "recordClick's count branch fires on `currentState.toolType==='count' && currentState.mode==='placing'` from stateRef (internal hook state) — never reads viewerStore.activeTool."
    - "Tool-sync effect first branch requires `markupState.mode === 'idle'`; with Count 'placing' this is false, so activateMarkup('linear') is skipped and internal state stays count/placing."
    - "ToolRail.handleMarkupToolClick only calls setActiveTool(tool) — it delegates the machine reset entirely to that (broken) effect."
  falsification_test: "If, after dropping the mode gate, a manual Count(placing)->Linear switch STILL placed counts, the hypothesis is wrong. Conversely, if the chain-from-totals/reopen preset flows broke (armed preset erased), the fix's safety reasoning is wrong. Regression test resolveToolSync + preset-flow reasoning cover both."
  fix_rationale: "The real discriminator between a legitimate preset arm and a stale internal machine is `toolType !== activeTool`. Preset flows (activatePreset) always converge toolType===activeTool in the settled/batched render, so they return 'none' and are untouched. A manual switch leaves toolType!==activeTool -> re-activate the new tool, resetting the previous tool's placing/drawing state. The mode==='idle' gate was redundant defense that only served to block the manual switch."
  blind_spots: "Relies on React 19 + Zustand v5 batching so no transient render exposes activeTool=new while toolType=old. Verified indirectly: the existing reopen flow's pre-mode is 'idle' (which PASSES the old gate) yet reopen works today — proving the transient render does not occur, otherwise reopen would already be broken. Cannot unit-test the inline effect directly (Konva); mitigated by extracting a pure resolveToolSync helper and testing it."

## Symptoms

expected: Clicking a different markup tool (Linear) while Count is actively placing (chain-armed) should CANCEL/break the previous tool's in-progress placement so the newly selected tool governs the next workspace click. The next click after switching to Linear should begin a linear measurement, not place a count pin.
actual: The toolbar/context-bar switches visually (activeTool updates to Linear — screenshot shows "PLACING Linear"), but clicking on the workspace STILL places Count markups. The previously-active tool's placement loop did not break on switch.
errors: none reported (silent — wrong markup type placed, no exception).
reproduction: (1) Activate Count tool. (2) Place one or more count pins (Chain mode ON — "Chain" armed in the context sub-bar). (3) Click the Linear tool in the left tool rail — context-bar now shows "PLACING Linear". (4) Click on the workspace — a Count pin is placed instead of starting a Linear measurement.
started: unknown (likely present since the tool-rail / chain-mode + tab-less toolbar interaction; Phase 18 toolbar-revamp or Phase 8 chain mode are candidate introduction points).

## Notes

- Chain mode ("Chain •") was armed in the reporter's screenshot — strongly implicated. Investigate whether tool switch happens while chain-armed and whether the switch clears chainArmed / _chainArmedItem.
- Suspect files: src/renderer/src/components/CanvasViewport.tsx, the useMarkupTool hook, viewerStore setActiveTool, ToolRail/Toolbar tool-switch handler.
- Relevant locked decisions (STATE.md): chainArmed boolean on MarkupDrawState (D-05); _chainArmedItem module-ref in CanvasViewport + getChainArmedItem() in Toolbar (D-03); useMarkupTool state machine uses useState+useCallback; recordClick places CountMarkup via Zustand getState() inside setState updater.

## Eliminated

## Evidence

- timestamp: 2026-07-29T00:10:00Z
  checked: "useMarkupTool.ts recordClick (lines 238-310) — the click-dispatch branch that decides count vs linear."
  found: "The count-placing branch fires when `currentState.toolType === 'count' && currentState.mode === 'placing'` (reads stateRef, the hook's internal React state — NOT viewerStore.activeTool). It places a CountMarkup and returns early. The linear/area/perimeter/wall branch requires `prev.mode === 'drawing'` and the matching toolType."
  implication: "Which markup gets placed depends ENTIRELY on the useMarkupTool internal state (toolType+mode), not on viewerStore.activeTool. If the internal state stays count/placing after a tool switch, clicks keep placing counts even though activeTool='linear'."

- timestamp: 2026-07-29T00:12:00Z
  checked: "CanvasViewport.tsx tool-sync useEffect (lines 662-668)."
  found: "The effect that bridges viewerStore.activeTool -> useMarkupTool is: `if (isMarkupTool(activeTool) && markupState.toolType !== activeTool && markupState.mode === 'idle') activateMarkup(activeTool) else if (!isMarkupTool(activeTool) && markupState.mode !== 'idle') cancelMarkup()`. The first branch (which activates the newly-selected tool) is GATED on `markupState.mode === 'idle'`."
  implication: "When switching Count(mode='placing') -> Linear: isMarkupTool('linear')=true, toolType('count')!=='linear'=true, but mode('placing')==='idle' is FALSE -> activateMarkup('linear') is NOT called. The else-if also fails (linear IS a markup tool). So NOTHING happens: internal state remains count/placing. This is the root cause of clicks still placing counts."

- timestamp: 2026-07-29T00:14:00Z
  checked: "ToolRail.tsx handleMarkupToolClick (lines 253-260)."
  found: "Clicking a different tool while one is active calls setActiveTool(tool) only (the else branch). It does NOT cancel/reset the useMarkupTool state machine directly — it relies entirely on the tool-sync effect to do that."
  implication: "The switch's only effect is a viewerStore.activeTool change; the broken tool-sync guard is the sole path that should have reset the internal machine, and it doesn't fire when mid-placement."

## Resolution

root_cause: "The CanvasViewport tool-sync useEffect gated `activateMarkup(newTool)` on `markupState.mode === 'idle'`. When a tool is mid-placement/mid-draw (e.g. Count in mode 'placing', chain armed), switching to another markup tool updates viewerStore.activeTool (so ToolRail + ContextBar show the new tool) but the guard blocks re-activation because mode !== 'idle'. The internal useMarkupTool state machine stays toolType='count'/mode='placing', and recordMarkupClick decides which markup to place from THAT internal state (not from activeTool) — so clicks keep placing Count pins. The mode gate was added as defense for the activatePreset flow, but it was redundant there (preset flows converge toolType===activeTool) and its only real effect was to break the manual tool switch."
fix: "Extracted the tool-sync decision into a pure, unit-testable helper resolveToolSync(activeTool, toolType, mode) in types/viewer.ts. The discriminator is now `toolType !== activeTool` (→ 'activate') instead of `mode === 'idle'`; non-markup activeTool while mid-flow → 'cancel'; otherwise 'none'. Preset flows (chain-arm-from-totals, post-commit re-open) set toolType===activeTool in the same batched render as setActiveTool, so they resolve to 'none' and are never clobbered. Rewired CanvasViewport's effect to delegate to resolveToolSync (re-narrowing activeTool via isMarkupTool for the activateMarkup call's type)."
verification: "Added regression test src/tests/tool-sync-switch.test.ts (6 cases). RED→GREEN confirmed: before the fix the file failed at import (resolveToolSync undefined); after the fix all 6 pass. Manual-switch case `resolveToolSync('linear','count','placing') === 'activate'` (was 'none' under the old gate). Preset-preservation `resolveToolSync('count','count','placing') === 'none'`. Full run: activate-preset (9), chain-mode (3), toolrail-tools (7), markup-post-commit-reopen (18), markup-tool-strictmode all pass — preset/chain/reopen flows intact. Full suite: 43→37 failures (exactly the 6 new tests fixed); the remaining 7 failing files are pre-existing jsdom component-mount failures on this paused-spike branch, byte-identical before and after (verified by git-stash baseline). typecheck:web clean; new test file lints with 0 problems. Still needs human UAT: reproduce the exact Count→Linear switch in the running app and confirm the next click draws Linear, not a Count pin."
files_changed:
  - "src/renderer/src/types/viewer.ts: added MarkupDrawMode type + resolveToolSync() pure helper"
  - "src/renderer/src/components/CanvasViewport.tsx: tool-sync effect delegates to resolveToolSync (dropped the mode==='idle' gate); import resolveToolSync"
  - "src/tests/tool-sync-switch.test.ts: new regression test (6 cases)"

## Evidence — bug #2 (stale ContextBar chip after switch)

- timestamp: 2026-07-29T00:40:00Z
  checked: "ContextBar.tsx chain-armed read (was line 408) + how _chainArmedItem is published (CanvasViewport effect) + the arc-seam precedent (markup-arc-ref.ts:34-72)."
  found: "ContextBar read the chain-armed item via a BARE module-var getter getChainArmedItem() during render, re-rendering only on activeTool/selection/snap/arc changes. _chainArmedItem was published by a CanvasViewport useEffect that runs AFTER the activateMarkup setState commits. markup-arc-ref.ts's own comment already flags getChainArmedItem as the exact 'not reactive enough' anti-pattern the 18-04 Arc seam fixed — but only Arc was migrated."
  implication: "On Count(chain)→Linear switch: activeTool changes count→linear, ContextBar re-renders ONCE and reads the still-'Instagram' module var (the clear happens in a later effect pass ContextBar isn't subscribed to). ContextBar never re-renders again → the chip stays stuck on the prior group's name over the fresh Linear tool. Same class of staleness as the Arc toggle, newly VISIBLE because bug #1's fix now actually resets the machine (previously the machine stayed count-armed so the chip was 'accidentally correct')."

## Resolution — bug #2

root_cause: "The ContextBar placing-state chip read the chain-armed item from a non-reactive module var (getChainArmedItem on CanvasViewport). When a manual tool switch cleared the chain state, the clear was published by a CanvasViewport effect that ContextBar does not subscribe to, so the bar kept displaying the previous group's name. This is the identical reactivity gap the 18-04 Arc seam solved (markup-arc-ref.ts) — left unfixed for the chain chip and exposed once bug #1 made the machine actually reset on switch."
fix: "Extracted the chain-armed item into a dedicated reactive seam src/renderer/src/lib/markup-chain-ref.ts (mirrors markup-arc-ref): getChainArmedItem (getSnapshot) / setChainArmedItem (value-change-detected publish + notify) / subscribeChainArmed. CanvasViewport publishes into setChainArmedItem from both the state-driven effect AND the eager setChainArmedFromTotals arm path; getChainArmedItem export removed from CanvasViewport. ContextBar now reads via React.useSyncExternalStore(subscribeChainArmed, getChainArmedItem), so the chip re-renders the instant the armed item changes — including the clear on a tool switch."
verification: "New pure-module regression test src/tests/markup-chain-ref.test.ts (8 cases) incl. the explicit 'clearing an armed item on tool switch notifies with getChainArmedItem() === null' case + value-change no-op + referential stability. Redirected the two ContextBar render tests' chain mock from CanvasViewport to the new seam. typecheck:web clean. Targeted run: markup-chain-ref/activate-preset/chain-mode/toolrail-chain-badge/toolrail-tools/tool-sync-switch/arc-sticky-seam/markup-post-commit-reopen — 8 files / 64 tests all green. Full suite: still exactly 7 pre-existing localStorage-env failing files / 37 tests (byte-identical baseline), 0 new failures. Still needs human UAT: Count(chain)→Linear switch in the app; confirm the armed chip clears (no stale prior name) and re-arms correctly from the totals panel."
files_changed_bug2:
  - "src/renderer/src/lib/markup-chain-ref.ts: NEW reactive chain-armed seam (get/set/subscribe), mirrors markup-arc-ref"
  - "src/renderer/src/components/CanvasViewport.tsx: publish via setChainArmedItem (effect + setChainArmedFromTotals); removed local _chainArmedItem var + getChainArmedItem export; import setChainArmedItem"
  - "src/renderer/src/components/ContextBar.tsx: read chain-armed item via useSyncExternalStore(subscribeChainArmed, getChainArmedItem) from the seam"
  - "src/tests/markup-chain-ref.test.ts: NEW regression test (8 cases)"
  - "src/tests/context-bar-morph.test.ts + context-bar-edit.test.ts: redirect chain-armed mock to markup-chain-ref seam"
