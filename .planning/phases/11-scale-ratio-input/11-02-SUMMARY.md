---
phase: "11"
plan: "02"
subsystem: scale-popup-ui
tags: [ui, scale, ratio-input, tab-switcher, canvas-viewport]
dependency_graph:
  requires: [11-01]
  provides: [ScalePopup tab switcher, ratio panel, CanvasViewport drawing-mode ScalePopup]
  affects:
    - src/renderer/src/components/ScalePopup.tsx
    - src/renderer/src/components/CanvasViewport.tsx
tech_stack:
  added: []
  patterns: [async-cancelled-ref, inline-styles-colors-tokens, conditional-tab-panel]
key_files:
  created: []
  modified:
    - src/renderer/src/components/ScalePopup.tsx
    - src/renderer/src/components/CanvasViewport.tsx
decisions:
  - pdfDocument passed as unknown prop from CanvasViewport to keep pdf-setup import out of ScalePopup; cast inline with (pdfDocument as any).getPage()
  - Render condition widened to 'drawing' mode so ScalePopup appears immediately on Set Scale click; popupScreenPos guard removed from confirm block with ?? {x:0,y:0} fallback
  - Unit selector kept visible on both tabs so shared unit state is always accessible
  - pageView === null (degenerate PDF) shows warning and disables Accept button per T-11-02-03
metrics:
  duration: 10 minutes
  completed_date: "2026-05-20"
  tasks_completed: 2
  files_changed: 2
---

# Phase 11 Plan 02: ScalePopup Tab Switcher + CanvasViewport Wiring Summary

**One-liner:** Two-tab ScalePopup ("Draw line" / "Type ratio") wired to CanvasViewport at 'drawing' mode — ratio tab fetches page.view async with cancelled-ref cleanup and calls computePixelsPerMmFromRatio on Accept.

---

## What Was Built

### Task 1 — ScalePopup.tsx tab switcher and ratio panel (`b5c2dc5`)

Extended `src/renderer/src/components/ScalePopup.tsx` with:

- **New optional props:** `pdfDocument?: unknown`, `pageWidthPx?: number`, `currentPage?: number` (all optional — existing callsites unchanged)
- **New state:** `activeTab: 'draw' | 'ratio'` (init `'draw'`), `denominator: string` (init `'100'`), `pageView: { widthPt, heightPt } | null` (init `null`)
- **Async useEffect** with `cancelled = false` / `return () => { cancelled = true }` cleanup guard — fetches `pdfDocument.getPage(currentPage)`, reads `page.view` as `[x0, y0, x1, y1]`, sets `pageView` when both dimensions positive, else `null`
- **Tab switcher** rendered immediately after title div — two buttons with `COLORS.accent` / `COLORS.dominant` active/inactive styles
- **Ratio panel** (activeTab === 'ratio'): locked left input (value=1, readOnly), colon separator, editable right denominator input
- **Sheet size display**: `isoSheetLabel(widthPt*25.4/72, heightPt*25.4/72)` when pageView non-null; warning in `COLORS.warning` when null
- **Derived guards**: `parsedDenominator`, `isValidDenominator`, `canConfirmRatio` (all three conditions)
- **handleRatioConfirmClick**: calls `computePixelsPerMmFromRatio(pageWidthPx, pageView.widthPt, parsedDenominator)` then `onConfirm(ppm, unit)`
- **handleKeyDown** updated: Enter key dispatches to correct handler based on activeTab
- **Action row**: conditionally shows "Confirm" (draw tab) or "Accept" (ratio tab) button
- Draw-line tab content, verify mode, and all existing markup/navigation behavior are unchanged

### Task 2 — CanvasViewport.tsx render condition and props (`1e99c45`)

Two targeted edits to `src/renderer/src/components/CanvasViewport.tsx`:

- **EDIT 1:** Added `const pdfDocument = useViewerStore((s) => s.pdfDocument)` selector alongside `currentPage`
- **EDIT 2:** Changed confirm-mode ScalePopup render condition from `calibState.mode === 'confirming' && calibState.popupScreenPos && !calibState.isVerify` to `(calibState.mode === 'confirming' || calibState.mode === 'drawing') && !calibState.isVerify`; screenPos fallback `calibState.popupScreenPos ?? { x: 0, y: 0 }`; new props `pdfDocument`, `pageWidthPx={displayPageSize?.width}`, `currentPage` added to confirm-mode block
- Verify-mode ScalePopup block untouched (still guards on `calibState.popupScreenPos`)

---

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tab switcher + ratio panel | `b5c2dc5` | `src/renderer/src/components/ScalePopup.tsx` (modified) |
| 2 | Widen render condition + new props | `1e99c45` | `src/renderer/src/components/CanvasViewport.tsx` (modified) |

---

## Task 3 — Checkpoint (pending human verification)

Task 3 is a `checkpoint:human-verify` gate. Execution paused at this task awaiting manual UAT in the running app. The orchestrator will present the checkpoint to the user and spawn a continuation agent after approval.

**What to verify:**
1. Click "Set Scale" — ScalePopup appears immediately (at 'drawing' mode, before any line drawn)
2. Tab bar shows "Draw line" (active) and "Type ratio" buttons
3. "Draw line" tab: existing distance input visible, Confirm button works as before
4. "Type ratio" tab: left field locked to 1, right field editable; sheet size displays after pdfDocument loaded
5. Accept button disabled until valid denominator typed and pdfDocument loaded
6. Accept sets scale and shows toast "1:N"
7. StatusBar shows correct scale
8. Verify-mode path (draw verify line) unchanged

---

## Verification

- `npx tsc --noEmit` — exits 0 (no TypeScript errors after both edits)
- `npx vitest run` — not re-run in this plan (no new test logic; math functions tested in 11-01)

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. Both functions are wired end-to-end: pdfDocument flows from CanvasViewport → ScalePopup prop → async getPage() → pageView state → isoSheetLabel display + canConfirmRatio guard → handleRatioConfirmClick → onConfirm callback.

---

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns. The async `pdfDocument.getPage()` call is entirely renderer-side, using the already-loaded pdfDocument from viewerStore. The threat register mitigations were applied:

| Threat ID | Status |
|-----------|--------|
| T-11-02-01 | Applied — parseInt + isNaN + isFinite + > 0 in canConfirmRatio; type="number" min={1} at HTML level; Accept disabled when guard fails |
| T-11-02-02 | Applied — cancelled ref cleanup guard present in useEffect |
| T-11-02-03 | Applied — degenerate pageView shows warning, disables Accept |

---

## Self-Check: PASSED

- `src/renderer/src/components/ScalePopup.tsx` — FOUND, modified
- `src/renderer/src/components/CanvasViewport.tsx` — FOUND, modified
- Commit `b5c2dc5` — Task 1 feat commit
- Commit `1e99c45` — Task 2 feat commit
- `npx tsc --noEmit` exits 0 — verified
