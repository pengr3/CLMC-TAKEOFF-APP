---
status: awaiting_human_verify
trigger: "missing-pdf-modal-not-appearing — When user moves/deletes PDF that .clmc points to and re-opens .clmc, app does nothing — no MissingPdfModal, no error modal, no project loads."
created: 2026-04-29T00:00:00Z
updated: 2026-04-29T00:10:00Z
---

## Current Focus

hypothesis: ROOT CAUSE FOUND — Toolbar's Open button calls `openProjectDialog()` from the useProject hook (which returns ProjectOpenResult but has no caller wiring to App.tsx state setters), and `void`s the result. The result.kind = 'missing-pdf' is generated correctly but discarded. App.tsx's handleOpenClick (which DOES route results) is only wired to keyboard shortcuts, NOT the toolbar button.
test: Implement fix — Toolbar must call App.tsx's handleOpenClick (or equivalent that routes through handleOpenResult), not the hook's `openProjectDialog`.
expecting: After fix, clicking Open with missing PDF shows MissingPdfModal.
next_action: Apply minimal fix — wire Toolbar.Open onClick to a handler that routes results through handleOpenResult.

## Symptoms

expected: Opening a .clmc whose linked PDF has been moved shows MissingPdfModal ("PDF not found" + "Browse for PDF" button)
actual: App does nothing — no modal appears, no project loads, complete silence
errors: None visible to user. Diagnostic console.error logs exist in code but user hasn't checked DevTools.
reproduction: 1) Open a PDF, add markups, Save As .clmc. 2) Move the PDF file. 3) Click Open, select the .clmc file. 4) Nothing happens.
started: After Phase 04-07 gap closure plan was supposed to fix this.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-29T00:01:00Z
  checked: src/renderer/src/components/Toolbar.tsx line 99 + line 186
  found: Toolbar destructures `openProjectDialog` from useProject() and on Open button click calls `() => { void openProjectDialog() }`. The `void` operator explicitly discards the returned ProjectOpenResult.
  implication: Even if missing-pdf result is generated correctly inside the hook, the result never reaches App.tsx state setters → no modal can appear.

- timestamp: 2026-04-29T00:02:00Z
  checked: src/renderer/src/hooks/useProject.ts lines 320-324 (openProjectDialog)
  found: openProjectDialog returns Promise<ProjectOpenResult | null>. It is a pure result-producer — it has NO side effect that surfaces the result to UI. It does not call any setState, does not invoke a callback, does not store anywhere.
  implication: The hook's openProjectDialog can only be useful if the caller awaits the return value and routes it through a state-updating handler.

- timestamp: 2026-04-29T00:03:00Z
  checked: src/renderer/src/App.tsx lines 102-112 (handleOpenClick) + lines 124-132 (useKeyboardShortcuts)
  found: App.tsx defines a proper `handleOpenClick` that opens the dialog, runs the dirty-guard, calls `openByExtension`, then ROUTES the result through `handleOpenResult`. But this `handleOpenClick` is wired ONLY to keyboard shortcuts (Ctrl+O), not exposed to the Toolbar component.
  implication: Toolbar button click bypasses the proper routing chain entirely. Two parallel open paths exist: (1) Ctrl+O → handleOpenClick → handleOpenResult ✅ shows modals, (2) Toolbar Open button → openProjectDialog → void ❌ silent failure.

- timestamp: 2026-04-29T00:04:00Z
  checked: grep `openProjectDialog` across src/
  found: Only 4 references — the definition (useProject.ts L320), the export (useProject.ts L352), and the import + usage in Toolbar.tsx (L99, L186). The function is never called from any code path that routes its result.
  implication: openProjectDialog is effectively dead-end code as currently used. The Phase 04-05 dirty-guard logic (handleOpenClick in App.tsx) was added but only wired to keyboard, leaving the Toolbar button on the old broken path.

- timestamp: 2026-04-29T00:05:00Z
  checked: .planning/phases/04-project-persistence/04-07-PLAN.md (Task 3 contract test)
  found: Plan 04-07 added a contract test for routing — but it tests only the routing logic (handleOpenResult dispatching to setters given a ProjectOpenResult). It does NOT test the upstream chain from Toolbar click → result generation → handleOpenResult call.
  implication: The plan considered "routing" complete when handleOpenResult was correct. The actual user-facing button never reaches handleOpenResult, so the test passing did not catch this bug. This is a "missing integration coverage" gap — unit test green, end-to-end broken.

- timestamp: 2026-04-29T00:06:00Z
  checked: src/renderer/src/App.tsx Toolbar component is mounted at line 137 with `<Toolbar />`. No props passed — Toolbar instantiates its own useProject() hook independently.
  found: App.tsx's `handleOpenClick` is a closure over App.tsx's setMissing/setHashMiss/etc. setters. It is not exposed via context, props, or imperative ref to Toolbar.
  implication: To fix this, either (a) pass handleOpenClick as a prop to Toolbar, OR (b) move handleOpenClick logic into Toolbar (but Toolbar can't access App's setters), OR (c) replace `void openProjectDialog()` with a Toolbar-local implementation that mirrors handleOpenClick's logic.

  Cleanest fix: option (a) — pass handleOpenClick as a prop. Minimal & preserves separation of concerns.

## Resolution

root_cause: Toolbar's Open button calls `openProjectDialog()` from the useProject hook and discards the returned ProjectOpenResult with `void`. The hook function has no side effect to surface the result to UI state. Meanwhile, App.tsx's `handleOpenClick` (which DOES route results through `handleOpenResult` → `setMissing(...)`) is wired ONLY to keyboard shortcuts via useKeyboardShortcuts. So Toolbar click bypasses the entire modal-routing chain. The 04-07 plan added a unit test for the router (handleOpenResult), but no integration test covered Toolbar.Open → handleOpenResult, masking this gap.

fix: Pass App.tsx's existing `handleOpenClick` to `<Toolbar onOpenClick={handleOpenClick} />` as a prop, and update Toolbar to invoke that prop instead of the hook's `openProjectDialog`. Removes the dead `openProjectDialog` import in Toolbar (now unused). Single source of truth for "open click" behavior — used by both keyboard shortcut and toolbar button.

verification: |
  Self-verified:
  - npm run typecheck — exits 0
  - npx vitest run — all 29 test files / 253 tests pass (251 baseline + 2 new regression tests in toolbar-open-prop.test.ts)
  - New test asserts Toolbar.Open click invokes onOpenClick prop (locks the contract)
  Awaiting user end-to-end check: Move/delete the PDF a saved .clmc points to, then click Open in the toolbar — MissingPdfModal must appear with the "Browse for PDF" button.
files_changed:
  - src/renderer/src/App.tsx (pass handleOpenClick prop to <Toolbar />)
  - src/renderer/src/components/Toolbar.tsx (accept ToolbarProps.onOpenClick, drop dead openProjectDialog import, use prop in Open button onClick)
  - src/tests/toolbar-open-prop.test.ts (new regression test — 2 cases)
