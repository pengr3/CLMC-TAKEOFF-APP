---
phase: "10"
status: issues_found
files_reviewed: 5
depth: standard
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
---

# Code Review: Phase 10 — Granular Undo Foundation

**Files reviewed:** 5
**Depth:** standard

## Files Reviewed

- `src/tests/markup-tool-point-redo.test.ts`
- `src/renderer/src/lib/markup-undo-ref.ts`
- `src/renderer/src/hooks/useMarkupTool.ts`
- `src/renderer/src/hooks/useKeyboardShortcuts.ts`
- `src/renderer/src/components/CanvasViewport.tsx`

---

## Findings

### CR-01 (Critical) — Stale `@ts-expect-error` directives on `repushLastPoint` break Wave 0 RED contract

**File:** `src/tests/markup-tool-point-redo.test.ts`
**Lines:** 123-124, 150-151, 159-160, 188-190, 244-246, 269-271, 289-291, 310-312, 330-332, 347-349

Every `repushLastPoint` call site in the test file carries the comment "— repushLastPoint does not exist yet (Wave 1 adds it — RED)" and a `@ts-expect-error` to suppress the expected type error. The validation plan requires this file to run RED before implementation. But `repushLastPoint: () => boolean` is declared in `UseMarkupToolReturn` and returned by the hook — the feature was fully implemented when the test file was committed. Because vitest's `typecheck` mode is not configured and `src/tests/` is excluded from both tsconfig files, the stale directives are inert and suppress no actual errors. Tests run GREEN immediately, bypassing the RED→GREEN TDD validation gate.

**Fix:** Remove the `@ts-expect-error` directives and update the comments to reflect that implementation is present.

---

### CR-02 (Critical) — `markup-undo-ref` module test `@ts-expect-error` is stale

**File:** `src/tests/markup-tool-point-redo.test.ts`
**Line:** 357

```typescript
// @ts-expect-error — setMarkupRedoHandler and getMarkupRedoHandler do not exist yet (Wave 1 — RED)
const { setMarkupRedoHandler, getMarkupRedoHandler } = await import(
  '@renderer/lib/markup-undo-ref'
)
```

Both exports are present in `markup-undo-ref.ts`. The `@ts-expect-error` is stale and inert (same reason as CR-01). This is misleading documentation that misrepresents the module's public API.

**Fix:** Remove the `@ts-expect-error` and update the comment.

---

### WR-01 (Warning) — SC2 "clearing" test cannot falsify a broken `redoPoints` push

**File:** `src/tests/markup-tool-point-redo.test.ts`
**Lines:** 169-194

The SC2 "new click after pop clears redoPoints" test calls `popLastPoint()` then immediately places a new click and asserts `repushLastPoint()` returns `false`. If `popLastPoint()` were broken and never populated `redoPoints`, the test would still pass because `repushLastPoint()` always returns `false` when `redoPoints` is empty. The clearing assertion is only meaningful if the intermediate state is verified.

**Fix:** Add an intermediate assertion after `popLastPoint()` and before the new click:
```typescript
act(() => { probe.current!.popLastPoint() })
expect(probe.current!.state.redoPoints).toHaveLength(1)  // add this
act(() => { probe.current!.recordClick({ x: 99, y: 99 }) })
```

---

## No Issues Found

**State machine logic (`useMarkupTool.ts`):** `stateRef` double-guard pattern correct. SC3 `cancel()` call is outside `setState` (required — nesting would discard the INITIAL_STATE reset). LIFO ordering with prepend-on-pop / shift-on-repush matches test expectations. `redoPoints: []` in `recordClick` updater correctly clears on new vertex. Dependency arrays on `popLastPoint` (`[cancel]`) and `repushLastPoint` (`[]`) both correct.

**`markup-undo-ref.ts`:** Redo handler pair mirrors undo pair exactly. Module-level nullable variable, `null` sentinel, JSDoc consistent. No issues.

**`useKeyboardShortcuts.ts`:** Ctrl+Y block ordering (text-input guard → preventDefault → handler-ref check → markupStore fallthrough) mirrors Ctrl+Z block. No ordering conflict with Ctrl+Shift+Z (undo block has `!e.shiftKey` guard). `getMarkupRedoHandler()?.() ?? false` correctly handles absent handler. No issues.

**`CanvasViewport.tsx`:** Redo useEffect mirrors undo useEffect. Null cleanup on unmount. `repushLastPoint` destructured. Import present. No issues.

**Test scaffolding:** `HookHost`/probe/mount pattern correctly copied. Per-test probe creation and unmount. `act()` wrapping. Store reset in `beforeEach`. SC3, SC4, SC5 test structures all correct.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| Warning  | 1 |
| Info     | 0 |
| **Total**| **3**|

All three findings are in the test file — two stale `@ts-expect-error` annotations that misrepresent Wave 0 RED state, and one test lacking an intermediate assertion. None affect runtime behavior of the production code. The implementation itself is correct and complete.
