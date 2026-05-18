---
phase: 9
reviewers: [gemini]
skipped: [claude (self), cursor (IDE-only CLI — no pipeline/agent mode), codex (not installed), opencode (not installed), qwen (not installed)]
reviewed_at: 2026-05-18T00:00:00Z
plans_reviewed:
  - 09-00-PLAN.md
  - 09-01-PLAN.md
  - 09-02-PLAN.md
  - 09-03-PLAN.md
  - 09-04-PLAN.md
  - 09-05-PLAN.md
---

# Cross-AI Plan Review — Phase 9
## Selection Model, Ribbon Toolbar, Modal Polish, and Markup Completion

---

## Gemini Review

This review analyzes the implementation plans for **Phase 9** of the CLMC Takeoff App. Overall, the plans are highly detailed, architecturally consistent with the existing tech stack (Zustand + Konva), and demonstrate a strong understanding of CAD/Takeoff UX patterns.

---

### Plan 00 - Wave 0: Type Extensions + Store Additions

**Summary:** This plan establishes the data backbone for selection and batch deletion. By extending the `viewerStore` with transient selection state and creating a dedicated `delete-group` command, it ensures that UI interactions remain decoupled from business logic while maintaining undo/redo integrity.

**Strengths:**
- **Undo/Redo Integrity:** Creating a `delete-group` variant rather than calling `deleteMarkup` in a loop prevents the "undo-spam" problem.
- **State Hygiene:** Explicitly clearing selection on page changes and hydration prevents "ghost selections" of IDs that may no longer exist in the current context.

**Concerns:**
- **Stale Selection (MEDIUM):** The plan should explicitly state that `deleteGroup` (and `deleteMarkup`) calls `clearSelection()` or filters the deleted IDs out of `selectedMarkupIds` to avoid references to non-existent markups.

**Suggestions:**
- Ensure the `delete-group` command stores the full markup objects and their original indices to ensure "Redo" restores them to the exact Z-order they occupied.

**Risk Assessment: LOW.** This is standard state management.

---

### Plan 01 - Wave 1: useDraggable Hook + Modals

**Summary:** A clean implementation of a global UX requirement. Using a hook to toggle between CSS-flex centering and absolute translation is a clever way to handle the "center-on-open, drag-thereafter" requirement.

**Strengths:**
- **Native Capture:** Use of `setPointerCapture` ensures dragging doesn't "leak" or break if the mouse moves faster than the React render cycle.
- **Interaction Guard:** D-12 (ignoring inputs/buttons) is essential for modal usability.

**Concerns:**
- **Input Guard Complexity (LOW):** Checking only `tagName` might miss custom components or elements with `role="button"`.
- **Boundary Checking (MEDIUM):** There is no mention of "clamping" the modal to the viewport. Users could accidentally drag a modal almost entirely off-screen.

**Suggestions:**
- Enhance the guard: `if (event.target.closest('button, input, select, textarea, [role="button"]')) return;`
- Add basic viewport clamping to the `position` update logic to ensure the header remains reachable.

**Risk Assessment: LOW.**

---

### Plan 02 - Wave 1: Click-to-Select + Delete/Ctrl+A

**Summary:** This plan introduces the primary interaction model. Utilizing a separate Konva Layer (Layer 3) for selection rings is a high-performance choice, as it prevents the entire markup layer from redrawing during simple selection changes.

**Strengths:**
- **Performance Optimization:** Separate layer for selection rings is an excellent use of Konva's architecture.
- **UX Priority (D-03):** Correctly prioritizes active tools (drawing) over selection, preventing accidental clicks while measuring.

**Concerns:**
- **Layer Sync (MEDIUM):** Since selection rings are in Layer 3 and Markups in Layer 2, you must ensure Layer 3's `listening={false}` is set, or that it perfectly mirrors the transform of the stage to avoid visual drift during pan/zoom.

**Suggestions:**
- Ensure `Ctrl+A` only selects markups *on the current page* to match the user's mental model and the current store's page-based structure.

**Risk Assessment: LOW.**

---

### Plan 03 - Wave 2: Rubber-Band Multi-Select + Enter Key Commit

**Summary:** This plan covers the most complex interaction logic—coordinating rubber-band selection with existing pan/zoom controls.

**Strengths:**
- **Smart Input Mapping:** Adjusting `Konva.dragButtons` based on `activeTool` and `spaceHeld` is the standard "pro-tool" way to handle the Pan vs. Select conflict.
- **Canonical Transforms:** Correctly uses `invert().point()` to handle stage scaling.

**Concerns:**
- **AABB vs. Precise Selection (LOW):** For complex polygons (Area/Perimeter), AABB (bounding box) containment is fine, but users sometimes expect selection if the band touches the *stroke*. D-07 (full containment) is safer but might feel "strict."
- **Enter Key Ambiguity (MEDIUM):** Does "Enter" commit the *current* mouse position as a point, or just finish the shape using the *previously clicked* points? In construction takeoff, Enter usually finishes the shape without adding the current hover point.

**Suggestions:**
- Clarify that the Enter key should call the commit path and ignore the "active/floating" point that follows the cursor.

**Risk Assessment: MEDIUM.** Coordination of mouse buttons and stage transforms is the most likely area for "fidgety" bugs.

---

### Plan 04 - Wave 2: Ribbon Toolbar

**Summary:** A significant UI overhaul. Moving from a flat toolbar to a tabbed ribbon increases "discoverability" but carries the risk of logic regression during the migration.

**Strengths:**
- **Modular Design:** `RibbonButton` creates a reusable primitive for the 60×60px "Office-style" aesthetic.
- **Clean Tabs:** Logical grouping (Home, Page, Tools, View) follows industry standards like Bluebeam or PlanSwift.

**Concerns:**
- **Vertical Real Estate (HIGH):** A ribbon (icon + label) usually requires ~90–100px to avoid looking cramped. 60px might be too short for a 24px icon + text label + padding.
- **Ref-Based Logic:** The plan relies on calling module-level refs (e.g., `getCanvasControls`). If these refs aren't properly re-assigned to the new `RibbonToolbar` elements, functions like "Zoom to Fit" will break.

**Suggestions:**
- Audit the 60px height. Consider 90px for the ribbon container to allow for legible labels and the "Active Tab" indicator.
- Verify that `handleHideAll/ShowAll` properly triggers a re-render of the TotalsPanel if visibility affects the BOQ calculations.

**Risk Assessment: MEDIUM.** Primarily due to the risk of "missing" a feature from the old toolbar during the complete rewrite.

---

### Final Risk Evaluation
**Overall Phase Risk: LOW-MEDIUM**

The plans are technically sound and follow React/Konva best practices. The primary risks are **interaction "feel"** (rubber-band vs. pan) and **UI regressions** during the toolbar rewrite. The dependency ordering (Waves 0–3) is correct; starting with the data layer (Wave 0) ensures that the subsequent UI waves have a solid contract to build upon.

**Recommendation:** Proceed with Plan 00 and 01 immediately. Pay extra attention to the "Enter key" logic and "Ribbon height" in the later waves.

---

## Consensus Summary

Reviewed by 1 AI system (Gemini). claude-sonnet-4-6 (self) skipped for independence. Cursor CLI is IDE-only with no pipeline/agent mode.

### Agreed Strengths (from Gemini)

- **Wave 0 first:** Establishing type contracts and store additions before any UI code is correct — prevents TypeScript crashes and enables parallel Wave 1 work
- **Separate Konva layer for selection rings:** High-performance choice that prevents markup layer redraws during selection changes
- **`Konva.dragButtons` gating:** Standard "pro-tool" approach to the Pan vs. Select conflict; `spaceHeld` spacebar override is the right ergonomic escape hatch
- **`setPointerCapture` in useDraggable:** Prevents drag "leaking" when mouse moves faster than React render cycle
- **`delete-group` command variant:** Prevents "undo-spam" (one Ctrl+Z for group delete, not N individual undos)
- **State hygiene:** Clearing `selectedMarkupIds` on page changes/hydration prevents ghost selections

### Agreed Concerns

| Severity | Concern | Affects |
|----------|---------|---------|
| HIGH | **Ribbon height** — 60px RibbonButton may be too cramped for 24px icon + label + padding + active indicator. Industry (Bluebeam, PlanSwift) uses 90–100px | Plan 04 |
| MEDIUM | **Stale selection after delete** — Plans 00/02 don't explicitly state that `deleteMarkup`/`deleteGroup` clears `selectedMarkupIds`. If not cleared, deleted IDs remain in `selectedMarkupIds` causing stale refs | Plans 00, 02 |
| MEDIUM | **Enter key floating point** — Plan 03 doesn't clarify whether Enter commits the shape with only the *clicked* points or also the current *floating/hover* point. For takeoff tools, Enter should commit without adding the hover point | Plan 03 |
| MEDIUM | **Modal viewport clamping** — `useDraggable` has no bounds clamping; users can drag modals off-screen entirely. No "drag handle" is required per D-12, but the modal should remain reachable | Plan 01 |
| MEDIUM | **Layer 3 listening=false** — Plan 02 must confirm selection ring Layer has `listening={false}` to prevent it from intercepting click events intended for markups below | Plan 02 |
| LOW | **useDraggable interactive guard** — `tagName` check misses elements with `role="button"`. More robust: `event.target.closest('button, input, select, textarea, [role="button"]')` | Plan 01 |

### Divergent Views
No multi-reviewer divergence (single reviewer). The concerns above are single-source but verified against the plan specifications.

---

## Remediation Actions

Before executing, consider addressing:

1. **[Plan 04 — HIGH]** Measure the actual rendered height with 60px buttons: if `icon(20px) + gap(4px) + label(11px) + padding(~8px each side)` = ~61px, the button itself is fine but the ribbon panel needs at least `height: 72–80px` to avoid clipping. Adjust `LAYOUT.toolbarHeight` accordingly.

2. **[Plans 00+02 — MEDIUM]** Add explicit `clearSelection()` call inside `deleteMarkup` and `deleteGroup` store actions (or alternatively in the keyboard handler after the delete call — the handler approach is already in Plan 02's Delete handler spec, so verify this is present).

3. **[Plan 03 — MEDIUM]** Confirm in the Enter key spec: Enter commits using `markupState.points` (the already-placed points), not `markupState.points + currentPointer`. The floating point should be excluded.

4. **[Plan 01 — MEDIUM]** Consider adding a soft viewport clamp in `useDraggable`: cap `x` to `±(window.innerWidth / 2 - 50)` and `y` to `±(window.innerHeight / 2 - 50)` — this keeps the modal reachable without requiring a drag handle affordance.

---

*To incorporate this feedback into re-planning:*
```
/gsd-plan-phase 9 --reviews
```
