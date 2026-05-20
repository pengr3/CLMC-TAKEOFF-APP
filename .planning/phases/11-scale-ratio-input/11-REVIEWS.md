---
phase: 11
reviewers: [gemini]
reviewed_at: 2026-05-20T00:00:00Z
plans_reviewed:
  - 11-01-PLAN.md
  - 11-02-PLAN.md
---

# Cross-AI Plan Review — Phase 11: Scale Ratio Input

## Gemini Review

This review covers the implementation plans for **Phase 11: Scale Ratio Input**.

### 1. Summary

The implementation plan is high-quality, technically sound, and follows a disciplined TDD approach for the critical mathematical components. By extending the existing `ScalePopup` rather than resurrecting dead code, the plan maintains architectural consistency. The use of a "Type ratio" tab alongside the "Draw line" method is an intuitive UX choice for estimators. The strategy for deriving physical sheet sizes from PDF metadata adds a necessary layer of validation for the user, ensuring the "fully offline" and "precise positioning" constraints are met.

### 2. Strengths

- **TDD for Math Logic:** Plan 11-01 separates the unit-testable math (pixelsPerMm and ISO labels) from the UI, ensuring that the core "Value" of the app (accuracy) is verified before any pixels are rendered.
- **Algebraic Verification:** The research correctly identified that the ratio-based `pixelsPerMm` must result in the same value as the line-based method to prevent measurement drift.
- **Async Safety:** Plan 11-02 correctly identifies the need for the `cancelled` ref pattern when fetching PDF page metadata, preventing race conditions during rapid page navigation.
- **Component Reuse:** Extending `ScalePopup` instead of creating a new modal keeps the state management simple and avoids duplicating calibration logic.
- **Defensive Guarding:** The plan includes specific checks for degenerate metadata (zero-size pages) and invalid user input (NaN, non-positive denominators).

### 3. Concerns

- **PDF Rotation Handling (MEDIUM):** Plan 11-02 intends to use `page.view[2] - page.view[0]` to get the width. However, `page.view` (the MediaBox) is pre-rotation. If a PDF has a `rotate: 90` attribute, the visual "width" the user sees (and the `pageWidthPx` passed to the component) will actually be the height from `page.view`. This produces a transposed pixelsPerMm value and a wrong sheet size label.
- **UI Obstruction in 'Drawing' Mode (LOW):** By showing `ScalePopup` immediately when `mode === 'drawing'`, the popup will be visible while the user is trying to click points on the canvas. If the fallback position is `{x: 0, y: 0}`, it might cover the corner where a user needs to click.
- **PDF.js Versioning (LOW):** The plan uses `pdfDocument: unknown` in props. While safe for typing, ensure internal usage of `getPage` and `.view` aligns with the project's `pdfjs-dist 5.5.207` which uses Promises for metadata access.

### 4. Suggestions

- **Use `getViewport` for Rotation-Safe Dimensions:** Instead of calculating width from `page.view`, use `page.getViewport({ scale: 1 }).width`. This automatically accounts for the PDF page's `rotate` attribute, ensuring the metadata width always matches the visual orientation of `pageWidthPx`.
- **Refine Popup Placement:** In `CanvasViewport.tsx`, when `calibState.popupScreenPos` is null (drawing mode), consider centering the popup rather than falling back to `{x: 0, y: 0}`.
- **Denominator Scroll Guard:** Add `onWheel={(e) => e.currentTarget.blur()}` to the denominator input to prevent accidental value changes when the user scrolls the canvas while the input is focused.
- **Test Precision:** In `scale-ratio-math.test.ts`, use `.toBeCloseTo(value, 10)` rather than strict equality to handle minor floating-point variances between the two calculation paths.

### 5. Risk Assessment: LOW

The risk is low because the feature is additive and does not modify the core rendering engine or the existing "Draw line" logic. The primary risk is the rotation mismatch mentioned above, which is easily mitigated by using the PDF.js `getViewport` API. The fallback to the "Draw line" method provides a safe failure path for users if a PDF contains bad metadata.

**Verdict:** Plans are ready to execute once rotation handling is confirmed.

---

## Consensus Summary

*Single reviewer — Gemini. Consensus section reflects Gemini's findings only.*

### Agreed Strengths

- TDD-first math separation (Plan 11-01) is correct architectural discipline
- `cancelled` ref async cleanup pattern correctly applied (Pitfall 5 in RESEARCH.md)
- Additive-only change — draw-line path, verify-mode, and all markup behavior unaffected
- Degenerate guard covers bad-metadata PDFs with a user-visible warning

### Agreed Concerns

| Concern | Severity | Implication |
|---------|----------|-------------|
| `page.view` is pre-rotation; `pageWidthPx` is post-rotation | MEDIUM | Wrong pixelsPerMm and wrong sheet size label on rotated pages |
| ScalePopup at `{x: 0, y: 0}` when popupScreenPos is null | LOW | May obscure top-left canvas area in draw-line mode |
| Denominator input scroll hijack | LOW | Unintended value change when user scrolls canvas |

### Divergent Views

None — single reviewer.

### Planner Notes

1. **Rotation fix:** RESEARCH.md Pitfall 2 already documents this risk and offers two solutions: (a) use `page.getViewport({ scale: 1 }).width` for the physical width, or (b) derive widthMm from `pageSize.width * 25.4 / (PDF_BASE_SCALE * 72)` which is already post-rotation and requires no async call for the pixelsPerMm computation. Option (b) is simpler and already described in the research — the planner should confirm which to use in the implementation.

2. **Popup position:** The `{x: 0, y: 0}` fallback is the minimal-change approach. The popup is draggable via `useDraggable()` so the user can move it. A center-of-viewport fallback would be better UX but is a LOW severity item — acceptable to address post-execution if UAT raises it.

3. **Scroll guard:** `onWheel={(e) => e.currentTarget.blur()}` is a one-liner addition to the denominator `<input>` — worth including in Plan 11-02 Task 1 implementation.

To incorporate this feedback:
```
/gsd-plan-phase 11 --reviews
```
or proceed directly with:
```
/gsd-execute-phase 11
```
(executor agents should read this file before implementing Plan 11-02)
