---
phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
plan: "01"
subsystem: ui
tags: [react, hooks, modal, drag, pointer-events, tdd]

requires:
  - phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion
    plan: "00"
    provides: "viewerStore types & deleteGroup store action — not directly consumed by this plan but ensures typecheck-clean foundation"
provides:
  - "useDraggable hook: { position: DragPosition | null; onPointerDown: (e) => void }"
  - "All 9 modal components are draggable; modal opens centred and resets to centre on every open"
  - "MarkupNamePopup + ScalePopup converted from screenPos-based positioning to full-inset flex-centred overlay (D-10/D-11/D-14)"
  - "Interactive control guard via .closest('button, input, select, textarea, [role=\"button\"]') (D-12)"
  - "Viewport clamping at ±(innerWidth/2 - 50, innerHeight/2 - 50) keeps drag handle reachable"
affects: [09-02, 09-03, 09-04, 09-05, 09-06]

tech-stack:
  added: []
  patterns:
    - "useState(null) for position — auto-resets on every mount; D-14 satisfied without explicit visibility-prop reset mechanism"
    - "Browser-native setPointerCapture(pointerId) — handles pointer leaving window automatically (no manual mouse-tracking)"
    - "Window-level pointermove + pointerup with useEffect cleanup — mirrors Splitter pattern (STATE.md: 'Splitter registers pointermove + pointerup on window… both listeners removed atomically in onUp')"
    - "Overlay-and-card composition for centred modals (pointer-events: none on overlay, auto on card, zIndex 10) — Pitfall 4 mitigated"
    - "_unused props prefix to keep callsite contract stable while removing internal consumption — applied to screenPos/containerSize in MarkupNamePopup + ScalePopup"

key-files:
  created:
    - src/renderer/src/hooks/useDraggable.ts
    - src/tests/use-draggable.test.ts
  modified:
    - src/renderer/src/components/CalibrationDialog.tsx
    - src/renderer/src/components/MarkupNamePopup.tsx
    - src/renderer/src/components/ScalePopup.tsx
    - src/renderer/src/components/SaveCloseModal.tsx
    - src/renderer/src/components/OpenErrorModal.tsx
    - src/renderer/src/components/UncalibratedExportWarningModal.tsx
    - src/renderer/src/components/ArchiveCorruptedModal.tsx
    - src/renderer/src/components/DimensionMismatchModal.tsx
    - src/renderer/src/components/PageCountAbortModal.tsx

key-decisions:
  - "Interactive control guard uses .closest() (NOT a flat tagName comparison) — catches role='button' wrappers and nested children of form controls. Caught by Test 3a (4 standard tags) and Test 3b (span[role=button] wrapper). Future custom-component modals get correct guard behaviour for free."
  - "Viewport clamping at ±(innerWidth/2 - 50) horizontally and ±(innerHeight/2 - 50) vertically — review concern. 50px margin ensures the modal body (which contains the drag handle area) is never fully off-screen. Verified deterministically by setting window.innerWidth=1024 and window.innerHeight=768 in beforeEach."
  - "screenPos / containerSize props retained in MarkupNamePopup and ScalePopup interfaces (renamed to _screenPos/_containerSize internally with 'void' touch) — keeps the 3 MarkupNamePopup callsites and 2 ScalePopup callsites in CanvasViewport.tsx untouched. The next plan can drop these props once it has reason to edit those callsites for other reasons."
  - "Overlay + card composition (pointerEvents: 'none' on overlay, 'auto' on card) — D-13 backdrop dismiss behaviour preserved on CalibrationDialog (existing overlay onClick handler unchanged); MarkupNamePopup and ScalePopup never had backdrop dismiss to preserve, so the new pointer-events: none overlay correctly lets canvas clicks pass through outside the popup card."
  - "useState(null) for position — D-14 auto-reset on modal open. When a modal closes, it unmounts; when it reopens, the hook instance is fresh, position starts at null, and the card centres via the flex overlay. No prop-driven reset key required."
  - "Browser-native setPointerCapture wrapped in try/catch — jsdom does not implement pointer capture for synthetic React events without a real DOM Element; degrading silently allows the tests (which use a stubbed currentTarget) to run while keeping the production path identical."

patterns-established:
  - "Centred-and-draggable modal: outer overlay with display: flex + alignItems/justifyContent: center; inner card with useDraggable; position !== null switches to position: absolute + transform: translate(calc(-50% + Xpx), calc(-50% + Ypx))."
  - "All future modals in this codebase MUST use useDraggable on the modal's outer card (D-10 architectural rule)."

requirements-completed: []

duration: 12min
completed: 2026-05-18
---

# Phase 09 Plan 01: useDraggable Hook and 9-Modal Retrofit Summary

**useDraggable hook implemented with TDD (11 tests, viewport clamping, .closest() guard); all 9 modal components migrated to centred-and-draggable pattern; MarkupNamePopup and ScalePopup converted from screenPos-based positioning to full-inset flex-centred overlay — D-10 architectural rule now applies to the entire current modal surface.**

## Performance

- **Duration:** ~12 min (TDD RED+GREEN + 9-modal retrofit)
- **Started:** 2026-05-18T14:14:00Z (approx)
- **Completed:** 2026-05-18T14:25:00Z (approx)
- **Tasks:** 2 (Task 1 TDD: RED + GREEN; Task 2 single feat)
- **Files modified:** 9 modal components + 1 new hook + 1 new test = 11 files

## Accomplishments

- **`useDraggable` hook** — single React hook returning `{ position: DragPosition | null, onPointerDown }`. Implements all six contracted behaviours:
  1. position === null on mount (centre)
  2. pointermove updates position by delta after onPointerDown on non-interactive elements
  3. Interactive guard via `.closest('button, input, select, textarea, [role="button"]')` — skips drag start
  4. pointermove + pointerup listeners removed from window on unmount (T-09-01-01 listener-leak mitigation)
  5. Remount resets position to null (D-14)
  6. Position clamped to ±(innerWidth/2 - 50) and ±(innerHeight/2 - 50)
- **`use-draggable.test.ts`** — 11 RED test stubs (initial state; drag flow; 4 interactive guards via `it.each`; role="button" closest match; cleanup; remount reset; X-clamp; Y-clamp) — all GREEN
- **CalibrationDialog** — gained `useDraggable`; existing flex-centred backdrop overlay retained; inner content div gets `onPointerDown` + transform-when-dragged; backdrop click dismiss (D-13) untouched
- **MarkupNamePopup** — converted from screenPos-based `left/top` positioning to full-inset flex-centred overlay; `screenPos` & `containerSize` props retained in the prop interface (renamed to `_screenPos`/`_containerSize` internally, touched with `void` to silence eslint) so the 3 callsites in CanvasViewport stay untouched
- **ScalePopup** — same overlay conversion as MarkupNamePopup applied to both `verify` and `confirm` mode return branches; `useDraggable` applied to inner card in both
- **6 App.tsx-hosted modals** (SaveCloseModal, OpenErrorModal, UncalibratedExportWarningModal, ArchiveCorruptedModal, DimensionMismatchModal, PageCountAbortModal) — `useDraggable` added; inner `role="dialog"` div receives `onPointerDown` + position-applied transform; existing fixed+flex centring retained for the position === null branch
- **Verification:** `npm run typecheck` exits 0; full vitest suite 473 tests / 66 files pass (462 from Wave 0 + 11 new from useDraggable)
- All 9 modal files import and call `useDraggable` (`grep -rl useDraggable src/renderer/src/components | wc -l → 9`)

## Task Commits

Tasks were committed atomically:

1. **Task 1 RED: failing tests for useDraggable** — `77e9644` (test)
2. **Task 1 GREEN: useDraggable hook with viewport clamping and closest() guard** — `37a760b` (feat)
3. **Task 2: apply useDraggable to all 9 modals; convert popups to centred overlay** — `36b782d` (feat)

## Files Created/Modified

**Created**
- `src/renderer/src/hooks/useDraggable.ts` — 108 lines; exports `useDraggable`, `DragPosition`, `UseDraggableReturn` types
- `src/tests/use-draggable.test.ts` — 288 lines; 11 vitest tests covering the full contract; uses createRoot + useLayoutEffect-into-holder harness pattern (matches `use-ui-panels.test.ts`)

**Modified**
- `src/renderer/src/components/CalibrationDialog.tsx` — +useDraggable import + hook call + onPointerDown + transform when dragged; existing flex-centred overlay retained; cursor: 'default' on inner card
- `src/renderer/src/components/MarkupNamePopup.tsx` — overlay conversion: removed `popupStyle` useMemo, dropped `useMemo` from imports (no longer needed), added overlay wrapper around the JSX, applied `useDraggable` to the inner `role="dialog"` card; `screenPos`/`containerSize` props now bound to `_screenPos`/`_containerSize` with explicit `void` touch
- `src/renderer/src/components/ScalePopup.tsx` — same overlay conversion as MarkupNamePopup applied to both `verify` and `confirm` mode returns; `useDraggable` in both branches
- `src/renderer/src/components/SaveCloseModal.tsx` — useDraggable hook + onPointerDown on inner dialog card; cursor: 'default'; transform when dragged
- `src/renderer/src/components/OpenErrorModal.tsx` — same minimal retrofit pattern as SaveCloseModal
- `src/renderer/src/components/UncalibratedExportWarningModal.tsx` — same
- `src/renderer/src/components/ArchiveCorruptedModal.tsx` — same
- `src/renderer/src/components/DimensionMismatchModal.tsx` — same
- `src/renderer/src/components/PageCountAbortModal.tsx` — same

## Decisions Made

- **`.closest()` guard verified by two distinct tests** — one `it.each` covering the four standard tags (BUTTON, INPUT, SELECT, TEXTAREA) and a separate test asserting that a `<span>` clicked inside a `<span role="button">` wrapper also stops the drag. This locks in the D-12 enhanced-guard requirement at the test level so any future regression to a tagName-based check will fail an existing test, not require a new one.
- **Viewport clamping tests use deterministic `Object.defineProperty(window, 'innerWidth', ...)`** — jsdom's defaults vary across versions; pinning innerWidth=1024 and innerHeight=768 in `beforeEach` makes the clamp value (462, 334) computable from the test code and independent of jsdom defaults.
- **`screenPos`/`containerSize` props prefix-renamed instead of removed** — the plan explicitly chose Option (a) ("keep props in MarkupNamePopup interface but ignore them internally; zero callsite changes") over Option (b) (remove and fix all 3 callsites). This was the safer choice for a parallel-executor plan because it confines the diff to the modal files and leaves CanvasViewport.tsx unmodified, avoiding any conflict with concurrent plans editing that file in this wave.
- **No raw hex literals introduced** — every new style branch uses `COLORS.*` tokens. The pre-existing `#aaaaaa` in `DimensionMismatchModal.tsx:46` is unchanged (out-of-scope per the deviation-rules SCOPE BOUNDARY — not introduced by this plan).
- **Did not touch the `onMouseDown={(e) => e.stopPropagation()}` on the MarkupNamePopup wall-height input** — mousedown and pointerdown are separate event types; the inputs's `onMouseDown.stopPropagation()` does not block our parent's `onPointerDown`. The `.closest()` guard correctly catches the INPUT before any drag starts. No change required, no behaviour change observed.
- **`try/catch` around `setPointerCapture`** — `e.currentTarget?.setPointerCapture?.(e.pointerId)` is wrapped because jsdom's synthetic events don't implement pointer capture on plain object targets. The try/catch keeps the production code path identical while making the test stub silently no-op the call.

## Deviations from Plan

None — plan executed exactly as written.

The only operational note: the plan's verify command was `npm run test -- --run` but this project has no `test` npm script (only `typecheck`, `lint`, `build`). The canonical project pattern is `npx vitest run` (also noted in 09-00-SUMMARY.md's Deviations section). Used `npx vitest run src/tests/use-draggable.test.ts` for the RED/GREEN gate and `npx vitest run` for the full-suite regression check — no source change, no plan deviation.

The plan's documented grep assertion `grep -r "useDraggable" src/renderer/src/components | grep -c "useDraggable"` returns `18` (each modal contains both an import and a hook call → 2 matches per file × 9 files). The actual intent — "all 9 modals contain useDraggable" — is satisfied: `grep -rl useDraggable src/renderer/src/components | wc -l → 9`. This is an editorial slip in the plan's grep formula, not a deviation in implementation. Captured here for the verifier.

## Issues Encountered

None.

## Self-Check: PASSED

Verified after writing SUMMARY:
- `src/renderer/src/hooks/useDraggable.ts` exists and exports `useDraggable`
- `src/tests/use-draggable.test.ts` exists
- All 9 modal files in `src/renderer/src/components/` import `useDraggable` (verified by `grep -rl` returning 9 files)
- MarkupNamePopup contains no `popupStyle.left` or `popupStyle.top` references in JSX (verified by empty `grep -n popupStyle` output)
- ScalePopup contains no `popupStyle.left` or `popupStyle.top` references in JSX (same grep)
- useDraggable.ts contains `.closest(` (line 53-54) and `Math.max(-clampX, Math.min(clampX, newX))` (line 92-93) — both matched
- Commits in git log: `77e9644` (RED test), `37a760b` (GREEN useDraggable), `36b782d` (9-modal retrofit)
- `npm run typecheck` exits 0; full vitest suite 473 tests / 66 files pass

## Next Phase Readiness

Wave 1 parallel track B (Plans 09-02 and 09-03) and Wave 2/3/4 work all unblocked:
- The useDraggable hook is the consumed contract for any future modal added during this phase or beyond — D-10's "all incoming thereafter" rule
- MarkupNamePopup and ScalePopup now centre on open and reset on every close; their callsites in CanvasViewport are untouched
- Test surface is comprehensive: 11 tests cover initial state, drag flow, interactive guard (5 cases), cleanup, remount reset, and both X and Y viewport clamping

No blockers. No CLAUDE.md violations.

---
*Phase: 09-selection-model-ribbon-toolbar-modal-polish-and-markup-completion*
*Completed: 2026-05-18*
