---
phase: 2
reviewers: [gemini]
reviewed_at: 2026-04-17T00:00:00Z
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md]
---

# Cross-AI Plan Review -- Phase 2

## Gemini Review

This review evaluates the three-wave implementation plan for **Phase 2: Scale Calibration**. Overall, the plans are technically sound, align with the established architectural patterns from Phase 1, and specifically address the critical challenges of coordinate space transformations in a zooming canvas environment.

---

### Plan 02-01: Scale Foundation (Wave 1)

**Summary**: A robust, "logic-first" foundation that isolates mathematical complexity and state management from the UI. By focusing on pure functions and a dedicated Zustand slice, this plan ensures that the core "source of truth" for scale is verifiable via unit tests before any pixels are drawn.

**Strengths**
- **Decoupled Math**: Moving coordinate conversions (`screenToStage`) and formatting into pure functions is excellent for testability.
- **Per-Page Integrity**: Using a `Record` keyed by page index in `scaleStore` correctly mirrors the multi-scale reality of construction sets.
- **Guardrails**: The `MIN_CALIBRATION_PIXELS` constant prevents "micro-lines" from creating infinite or nonsensical scale ratios.

**Concerns**
- **Unit Change Side-Effects (MEDIUM)**: If the `globalUnit` changes, existing `pixelsPerUnit` values in the store may become invalid unless the math accounts for the conversion or the store forces a re-calibration.
- **Precision/Rounding (LOW)**: Construction PDFs often use specific ratios (e.g., 1:96 for 1/8"). Ensure `formatScaleRatio` doesn't over-round, which could introduce cumulative errors over long distances.

**Suggestions**
- Store the scale internally in a unit-agnostic way (e.g., `pixelsPerMillimeter`) and treat the `globalUnit` only as a display/input preference to prevent data loss when switching units.

---

### Plan 02-02: Calibration Interaction (Wave 2)

**Summary**: A well-structured interaction plan that utilizes a hybrid approach (Konva for drawing, HTML for data entry). The use of a 4-state machine within a custom hook provides the necessary control to handle the "click-click" CAD-style interaction requested by the user.

**Strengths**
- **Zoom Invariance**: Calculating `strokeWidth` and `radius` as a factor of `1/stageScale` is a "pro" touch that ensures UI handles remain usable at 500% zoom.
- **Hybrid Rendering**: Using an absolute-positioned HTML `div` for the `ScalePopup` is a smart move; it avoids the significant complexity of building accessible text inputs inside a Canvas/Konva context.
- **State Locking**: Blocking page navigation during calibration prevents the "orphan line" edge case where a user draws a line on Page 1 but tries to save it to Page 2.

**Concerns**
- **Polling Pattern (MEDIUM)**: While consistent with Phase 1, the 100ms polling of `getCalibrationControls` for the Toolbar state is a reactive anti-pattern. While acceptable for a prototype, it may lead to "jank" or subtle UI lag as the app grows.
- **Popup Clipping (LOW)**: If a calibration line ends at the very top or right edge of the viewport, the HTML popup might be clipped by the window bounds.

**Suggestions**
- Add a `useClickOutside` or `Escape` key listener specifically to the `confirming` state to allow users to exit the flow gracefully without having to find a "Cancel" button.

---

### Plan 02-03: Status Bar, Verify, and Toast (Wave 3)

**Summary**: This wave adds the "Expert Polish" required for construction professional workflows. The inclusion of a verification flow (SCAL-04) is a high-value feature that builds estimator confidence, which is critical for a takeoff tool.

**Strengths**
- **Visual Affordance**: Using "Amber/Orange" for "Not Set" in the status bar provides a clear "Stop/Check" signal to the user before they start meaningful work.
- **Verification Loop**: Re-using the calibration UI for a read-only "Verify" mode is an efficient use of code that provides a critical sanity check for the user.
- **Contextual Recovery**: The "Recalibrate" option in the context menu acknowledges that users often make mistakes on their first click and need a fast way to reset.

**Concerns**
- **Right-Click Discoverability (LOW)**: Relying on a right-click on a Toolbar button for "Recalibrate" might be missed by some users.
- **Toast Duration (MEDIUM)**: 6 seconds may be too short for a "Verify" prompt. An estimator might need to pan/zoom to find a second known dimension before they are ready to click "Verify."

**Suggestions**
- Make the "Verify" toast persistent until the user moves to a different page or starts a different action, or add a dedicated "Verify Scale" button in the `ScalePopup` after a scale is already set.

---

**Risk Assessment: LOW**

The plans are highly detailed and demonstrate a deep understanding of the technical constraints (Stage vs. Screen space, per-page state). The dependency ordering is logical, and the "Wave" approach allows for verification of the math before the UI is even built.

**Justification**:
1. Phase 1 alignment: The plans reuse the module-level ref and viewerStore patterns, reducing architectural drift.
2. Edge-case awareness: Blocking navigation and handling zoom-invariant line widths shows foresight regarding common Canvas-app pitfalls.
3. User-centric design: The "Verify" flow and "Not Set" warnings directly address the core value of accuracy in construction estimating.

---

## Consensus Summary

Only one external reviewer was available (Gemini). Claude (current runtime) was skipped for independence. Codex was not installed.

### Key Strengths (from Gemini)
- Wave-based dependency ordering (math first, interaction second, chrome third) is well-reasoned
- Zoom-invariant strokeWidth/radius (2/stageScale, 4/stageScale) correctly addresses a canvas pitfall
- Hybrid HTML popup over Konva canvas is the right call for accessible form inputs
- Blocking page nav during calibration prevents orphan-line edge case
- Per-page scaleStore pattern correctly mirrors viewerStore from Phase 1

### Top Concerns (prioritized)

| Severity | Concern | Plan |
|----------|---------|------|
| MEDIUM | **globalUnit mutation side-effect**: changing globalUnit after calibration does not convert stored pixelsPerUnit values -- existing measurements silently use the wrong ratio. Consider storing in a unit-agnostic base unit (pixelsPerMm) internally. | 02-01 |
| MEDIUM | **100ms polling anti-pattern**: Toolbar reads calibration mode via setInterval(100ms) polling of module-level ref. Works but is reactive-antipattern territory; could cause subtle lag as component count grows. | 02-02 |
| MEDIUM | **Toast too short**: 6s auto-dismiss may not give an estimator time to pan/zoom to a second known dimension before "Verify" disappears. | 02-03 |
| LOW | **formatScaleRatio over-rounds**: Math.round(pixelsPerUnit) produces "1:97" for 1:96 drawings. Over long spans this creates cumulative errors. | 02-01 |
| LOW | **Popup edge clipping**: Clamp logic prevents popup leaving container, but does not account for popup going off the OS window edge. | 02-02 |
| LOW | **Right-click discoverability**: Context menu for Recalibrate is discoverable only by right-clicking the toolbar button -- no visual hint. | 02-03 |

### Divergent Views
N/A -- single reviewer.
