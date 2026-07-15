---
status: awaiting_human_verify
trigger: "F3 (snap toggle) does not work outside a markup tool; when a tool is selected it does not fire sometimes — I spam F3 expecting it to flip snap on/off repeatedly, but sometimes it works, sometimes it doesn't."
created: 2026-07-15T05:22:26Z
updated: 2026-07-15T05:24:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Two independent causes: (A) window keydown/keyup/blur listeners re-register on every App re-render because the useEffect deps include the freshly-allocated `handlers` object literal — keydowns arriving in the remove→add gap are dropped; (B) the F3 branch bails on isTextInputActive() so any focused field suppresses the snap toggle."
  confirming_evidence:
    - "useKeyboardShortcuts.ts line 319: useEffect deps = [handlers, totalPages]."
    - "App.tsx lines 351-360: handlers passed as a fresh object literal every render."
    - "useKeyboardShortcuts.ts line 188: F3 branch runs `if (isTextInputActive()) return` before preventDefault + setSnapEnabled."
  falsification_test: "If, after moving listener registration to a mount-only effect reading refs, a spy on window.addEventListener('keydown') still shows >1 registration across forced re-renders, Cause A is not fully fixed. If F3 dispatched with a focused <input> still leaves snapEnabled unchanged, Cause B is not fixed."
  fix_rationale: "Ref pattern registers the three window listeners once (mount-only `[]` deps) and reads latest handlers/totalPages from refs, eliminating churn entirely — no keydown can land in a remove→add gap because there is no remove→add. Removing the isTextInputActive gate from ONLY the F3 branch makes the non-text snap toggle fire regardless of focus, while every text-conflicting shortcut keeps its guard."
  blind_spots: "Must preserve exact keyup/blur semantics (Alt snap-suspend, arc-held release, blur safety nets). Must not change App.tsx handler contents. Empty deps array must not trip react-hooks/exhaustive-deps (refs are exempt; store getters are module-stable)."
next_action: Apply hook ref refactor + remove F3 guard, then add tests and run vitest + typecheck.

## Symptoms

expected: F3 reliably toggles snap on/off every press, in all app states (tool selected or not, field focused or not).
actual: F3 intermittently fails when spamming during markup placement; F3 does nothing when a text input is focused.
errors: none (silent no-op)
reproduction: (1) Spam F3 while placing markups (many re-renders) — some presses dropped. (2) Focus any text input (e.g. markup name popup) and press F3 — nothing happens.
started: present since F3 was added (Phase 14, 14-03 D-03) / worsened with frequent App re-renders during placement.

## Eliminated

## Evidence

- timestamp: 2026-07-15T05:22:26Z
  checked: src/renderer/src/hooks/useKeyboardShortcuts.ts effect deps (line 319) and App.tsx call site (lines 351-360)
  found: useEffect deps are `[handlers, totalPages]`. App.tsx passes a fresh object literal as handlers on every render. Every App re-render removeEventListener's then addEventListener's keydown/keyup/blur.
  implication: Cause A confirmed — a keydown arriving during the remove→add gap is dropped. Explains intermittency, worse during placement (many re-renders).

- timestamp: 2026-07-15T05:22:26Z
  checked: F3 branch, useKeyboardShortcuts.ts lines 187-193
  found: F3 branch runs `if (isTextInputActive()) return` before `e.preventDefault(); setSnapEnabled(!snapEnabled)`.
  implication: Cause B confirmed — a focused field reliably suppresses F3. F3 types nothing, so the guard is inappropriate here.

## Resolution

root_cause: (A) window keydown/keyup/blur listeners are re-registered on every App re-render because the useEffect deps include the freshly-allocated `handlers` object literal — a keypress in the remove→add gap is dropped. (B) the F3 branch is gated by isTextInputActive(), so a focused text field suppresses the snap toggle even though F3 edits no text.
fix: |
  (A) Ref pattern in useKeyboardShortcuts: added handlersRef + totalPagesRef,
  assigned `.current` on every render, and changed the effect deps from
  [handlers, totalPages] to [] (mount-only). handleKeyDown reads
  handlersRef.current / totalPagesRef.current at the top so the entire existing
  shortcut body is unchanged. keyup/blur (Alt snap-suspend, arc-held release,
  blur safety nets) are byte-for-byte preserved. Listeners now register exactly
  once — no remove→add churn, no dropped keypress.
  (B) Removed only the `if (isTextInputActive()) return` line from the F3 branch;
  e.preventDefault() + setSnapEnabled(!snapEnabled) unchanged. All text-conflicting
  shortcuts (Ctrl+Z/Y, Delete, Shift+A, bare A, Ctrl+A, Ctrl+O/S/Shift+S/Shift+E)
  keep their guards. App.tsx unchanged — fix stands entirely inside the hook.
verification: |
  npm run typecheck → clean (node + web).
  npx vitest run → 854/854 GREEN across 117 files (was 847; +7 new in
  src/tests/f3-snap-shortcut.test.ts). New tests assert: F3 toggles snapEnabled
  with a focused <input> (Cause B); window keydown registered exactly once across
  6 forced re-renders with fresh handlers + F3 still fires (Cause A); Shift+A /
  Ctrl+Z / Delete still bail when a text input is focused and fire when not
  (guards intact).
  Remaining: live-app confirmation by the user (spam F3 during placement; F3 with
  a name popup focused).
files_changed:
  - src/renderer/src/hooks/useKeyboardShortcuts.ts
  - src/tests/f3-snap-shortcut.test.ts
</content>
</invoke>
