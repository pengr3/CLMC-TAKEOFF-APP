---
status: resolved
trigger: "Fix two issues: (1) F3 snap toggle unreliable in dev — Zustand + Vite HMR store duplication; (2) declutter rail tool buttons by removing the armed-item NAME badge."
created: 2026-07-15T08:36:15Z
updated: 2026-07-15T08:52:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Renderer Zustand store modules have NO Vite HMR handling. On a hot-reload, the store module re-evaluates and calls create() again, producing a NEW store instance. Components mounted before the reload stay subscribed to the OLD instance while the global keyboard handler re-imports the NEW instance — so F3 mutates instance A while the ToolRail is subscribed to instance B (state changes, UI doesn't)."
  confirming_evidence:
    - "Live console logs show F3 flips useViewerStore.getState().snapEnabled correctly, but subscribed ToolRail does not re-render after a Vite hot-reload."
    - "On a fresh clean build (no HMR) F3 works end-to-end; in a production build (no HMR) it works. Symptom is session/HMR-dependent, not project-dependent."
    - "None of the four store modules (viewerStore, scaleStore, markupStore, projectStore) reference import.meta.hot — nothing preserves the instance across HMR."
  falsification_test: "After applying the import.meta.hot.data singleton pattern, re-importing the store from any module after an HMR update yields the SAME object reference the mounted components subscribed to (verified by identity + the F3 path staying live across edits)."
  fix_rationale: "Persist the created store on import.meta.hot.data.store and reuse it on every module re-evaluation, plus import.meta.hot.accept() to make the store a self-accepting HMR boundary. This guarantees exactly one store instance across all hot reloads. Guarded by import.meta.hot so it is stripped from prod/test builds (import.meta.hot is undefined → ?? factory() path runs)."
  blind_spots: "Editing store action bodies during dev will not hot-apply (the persisted instance keeps old actions) — acceptable tradeoff for singleton preservation; a manual reload picks up new logic."

next_action: "Apply HMR singleton pattern to viewerStore, scaleStore, markupStore, projectStore; then remove ChainBadge from ToolRail and update the test."

## Symptoms

expected: "F3 toggles snap and the ToolRail Snap button reflects it, every time, including during a dev session after Vite hot-reloads. Rail tool buttons show only the tool label, not the armed item's name."
actual: "After a Vite hot-reload in dev, F3 mutates the store but the UI does not react. Rail tool buttons additionally render the armed item's NAME badge (duplicated info)."
errors: "None (no exception; silent UI desync)."
reproduction: "Issue 1: run dev, edit a file to trigger HMR, press F3 — Snap button no longer updates. Issue 2: arm an item from the Totals panel with a tool active — its name appears on the rail button."
started: "Issue 1: whenever HMR runs during a dev session. Issue 2: since the ChainBadge was added to the rail."

## Eliminated

- hypothesis: "F3 keyboard handler is broken or listener churns"
  evidence: "useKeyboardShortcuts mounts listeners once via refs (c0cd9a3); getState().snapEnabled confirmed flipping. Handler is correct."
  timestamp: 2026-07-15T08:36:15Z

## Evidence

- timestamp: 2026-07-15T08:36:15Z
  checked: "All four store modules in src/renderer/src/stores/"
  found: "None reference import.meta.hot; each calls create() at module top level unconditionally."
  implication: "A re-evaluated store module makes a fresh instance → dual-instance desync under HMR."

## Resolution

root_cause: "Renderer Zustand stores have no Vite HMR preservation, so hot-reloads spawn a second store instance; the global F3 handler and mounted components end up bound to different instances."
fix: "Wrap each store's create() in a factory and export the instance persisted on import.meta.hot.data.store (?? factory() when absent), with import.meta.hot.accept(). Read double-optional-chains (?.data?.store) and persistence only mutates data.store when data exists (Vitest web transform leaves data undefined; Vite marks data read-only). Removed the ChainBadge name from ToolRail buttons + updated its test."
verification: "npm run typecheck clean (node + web). npx vitest run: 854/854 passed across 117 files (toolrail-chain-badge test rewritten to assert the name is absent, still green). npm run build: clean production build; grep of the built renderer bundle shows 0 occurrences of import.meta.hot / .data.store, confirming the HMR blocks strip out in prod. eslint clean on all changed files."
files_changed: [src/renderer/src/stores/viewerStore.ts, src/renderer/src/stores/scaleStore.ts, src/renderer/src/stores/markupStore.ts, src/renderer/src/stores/projectStore.ts, src/renderer/src/components/ToolRail.tsx, src/tests/toolrail-chain-badge.test.ts]

commits:
  - "08be351 — fix(stores): preserve Zustand store instances across Vite HMR"
  - "d967412 — refactor(toolrail): remove armed-item name badge from tool buttons"

## Resolution — CORRECTION (2026-07-16)

The HMR-store-duplication resolution above did NOT actually fix F3. After the
push it was re-tested on a genuinely clean build (`node_modules/.vite` + `out`
cleared, full restart) with a project open — and F3 was still dead. The
declutter half (ChainBadge removal, `d967412`) was correct; the F3 diagnosis
was wrong.

true_root_cause: "A DUPLICATE keydown listener. `useKeyboardShortcuts` was
  called in TWO places — `App.tsx` (always mounted) AND `CanvasViewport.tsx`
  (mounts only when a PDF is open). Each call's mount-once effect adds its own
  window keydown listener, so with a project open there were TWO. Both
  intercepted F3 and both called `setSnapEnabled(!snapEnabled)`, toggling snap
  TWICE per physical press → net zero visible change. This exactly explains
  'works with no project, broken with a project open' (CanvasViewport is the
  second listener) and 'internal logs show it toggling' (it does — twice)."

decisive_evidence: "Clean-build console diagnostic showed `e.defaultPrevented`
  alternating false/true on handler ENTRY across successive F3 presses. A fresh
  keyboard event always starts defaultPrevented=false; seeing it already true
  means the same event object had already passed through another handler that
  called preventDefault() — i.e. a second registered listener. This is the
  signal every prior HMR-churned session had masked."

true_fix: "Removed the redundant `useKeyboardShortcuts` call from
  CanvasViewport (a Plan-04-04 leftover — App.tsx became the shortcut owner but
  the old call was never deleted) plus its now-dead `usePdfDocument`/
  `openPdfDialog` import. App.tsx already wires every binding (zoom via
  getCanvasControls). Exactly one listener remains."

true_verification: "Typecheck clean; all keyboard-shortcut tests green; user
  confirmed on a clean build — Snap toggles once per F3 and snapping engages/
  disengages ('Works now as advertised'). 08be351 (HMR singleton) left in place:
  harmless, stripped from prod, and legitimately prevents dev HMR store dup —
  just orthogonal to F3."

true_fix_commit: "8f0cc54 — fix(shortcuts): remove duplicate keydown listener that double-fired F3"

lesson: "The 'eliminated' note above ('keyboard handler is broken or listener
  churns') was too broad — it eliminated the WRONG-listener hypothesis but not
  the DUPLICATE-listener one. When a handler provably runs yet has no net
  effect, count the listeners (defaultPrevented-on-entry / addEventListener call
  sites) before theorizing about downstream state plumbing."
