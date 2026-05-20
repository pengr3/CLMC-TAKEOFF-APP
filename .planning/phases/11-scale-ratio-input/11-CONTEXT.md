# Phase 11: Scale Ratio Input — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Source:** v1.1-CONTEXT.md Phase A decisions (GAP-T2-00)

<domain>
## Phase Boundary

Add a "Type ratio" tab to the existing `CalibrationDialog.tsx` so estimators can set the page scale by typing a 1:N ratio directly from the drawing title block — no need to draw a calibration line when the scale is already printed on the plan. Standalone phase; no other v1.1 phases depend on it.

</domain>

<decisions>
## Implementation Decisions

### Calibration Dialog Extension

- **D-01:** Ratio input lives on a **new "Type ratio" tab** inside the existing `ScalePopup.tsx` (the live calibration UI — `CalibrationDialog.tsx` is dead code), alongside the current "Draw line" tab. Keeps all calibration in one place; user picks the mode before touching the canvas.
- **D-02:** Input UX is **two side-by-side numeric fields** separated by a colon — `[ 1 ] : [ 100 ]`. The left field defaults to `1` and is locked. The estimator types the denominator into the right field. No text parsing, no ambiguity. Example: type `100` → ratio is 1:100.
- **D-03:** Physical page size is **auto-derived from PDF.js `page.view`** (`[0, 0, widthPt, heightPt]` at 72 pts/inch → mm via `× 25.4 / 72`). The derived sheet size (e.g. "841 × 594 mm — A1") is shown to the user for confirmation before the calibration is accepted. If the derived size looks wrong (scanned PDF with bad metadata), user can fall back to the Draw Line tab.

### Claude's Discretion

- pixelsPerMm computation: `(pageWidthPx / pageWidthMm)` where `pageWidthPx` is the Konva stage pixel width of the page at the current render resolution, and `pageWidthMm` is derived from `page.view` × ratio. Must produce exactly the same pixelsPerMm as the draw-line path for the same ratio.
- Degenerate page.view guard: if `page.view` is `[0, 0, 0, 0]` or any dimension is ≤ 0, show a warning message and disable the "Accept" button, directing the user to the Draw Line tab.
- Tab switching: the existing draw-line state (in-progress line on canvas) is unaffected by switching to the ratio tab; the canvas line tool stays armed if the user switches back.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Calibration (primary target)
- `src/renderer/src/components/ScalePopup.tsx` — **the live calibration UI** (CalibrationDialog.tsx is dead code with zero import sites; ignore it). ScalePopup is the component to extend with the "Type ratio" tab.
- `src/renderer/src/stores/scaleStore.ts` — `setPageScale(pageIndex, pixelsPerMm)` is the IPC call both tabs will invoke; `pixelsPerMm` is the canonical scale unit

### PDF page dimensions (for D-03)
- `src/renderer/src/hooks/usePdfRenderer.ts` or similar — how `pdfDocument.getPage(n)` is called; `page.view` is the raw PDF mediabox `[x0, y0, widthPt, heightPt]`; physical mm = `widthPt × 25.4 / 72`

### Existing scale math (for pixelsPerMm derivation)
- `src/renderer/src/lib/scale-math.ts` (or equivalent) — existing unit conversion helpers; ratio tab must produce values consistent with draw-line output

### Architecture patterns
- `.planning/STATE.md` §"Key Decisions Locked" — `pixelsPerMm` canonical storage, per-page scale model, additive schema fields, module-level ref pattern
- `src/renderer/src/components/CalibrationDialog.tsx` — existing tabbed modal pattern (if present) or standard modal chrome to replicate

</canonical_refs>

<specifics>
## Specific Ideas

### Split input box UI
User explicitly requested: two separate numeric input fields with a colon separator — `[ 1 ] : [ 100 ]`. The left field is locked to 1. The right field is where the denominator goes. This eliminates all parsing ambiguity and matches how estimators read scale ratios from title blocks.

### Sheet size display
Show derived sheet size (e.g. "841 × 594 mm — A1") as a read-only confirmation line under the ratio inputs. Common ISO sheet sizes to label: A0 (1189×841), A1 (841×594), A2 (594×420), A3 (420×297), A4 (297×210) ± 5mm tolerance. If no match, show just "Xmm × Ymm".

</specifics>

<deferred>
## Deferred Ideas

- Editable left-hand field (ratio other than 1:N) — user chose denominator-only input for v1.1; generalized ratio (e.g. 1:50 or 2:100) is implicitly covered by the two-field layout but the left field locking keeps it simple for v1.1
- Snap to standard ISO scale denominators (1:10, 1:20, 1:25, 1:50, 1:100, 1:200, 1:500, 1:1000) — nice autocomplete future enhancement

</deferred>

---

*Phase: 11-scale-ratio-input*
*Context extracted: 2026-05-20 from v1.1-CONTEXT.md Phase A (GAP-T2-00)*
