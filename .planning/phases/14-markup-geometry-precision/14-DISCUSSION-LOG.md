# Phase 14: Markup Geometry Precision - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 14-markup-geometry-precision
**Areas discussed:** Arc drawing gesture, Snap on/off & override, Which snap targets ship, Self-intersect & arc editing

---

## Arc drawing gesture

### How should a curved (arc) edge be drawn?

| Option | Description | Selected |
|--------|-------------|----------|
| 3-click: start / on-arc / end | Three taps define the arc through a midpoint | ✓ |
| Drag-to-bulge an edge | Pull a straight edge outward into a curve | |
| Both | Offer both draw gestures | |

**User's choice:** 3-click: start / on-arc / end
**Notes:** Chosen by feel via the interactive spike-003c demo. Maps 1:1 to the validated 3-point solver and is the only gesture that reaches a major arc (>180°). Drag-to-bulge was not discarded — repurposed as the *edit* gesture (bulge handle).

### Within one markup, how to make an edge an arc vs straight?

| Option | Description | Selected |
|--------|-------------|----------|
| Hold-key for arc edge | Momentary key makes the next edge an arc | |
| Sticky arc toggle | Toggle stays on for a run of arc edges | |
| Both hold-key + toggle | One-off via hold-key, runs via toggle | ✓ |
| Separate Arc tool | Distinct tool in the toolbar | |

**User's choice:** Both hold-key + toggle
**Notes:** Default edge is straight. Exact key (e.g. `A`) confirmed at plan time against Phase 9 bindings.

---

## Snap on/off & override

### How should snapping be turned on/off during placement and editing?

| Option | Description | Selected |
|--------|-------------|----------|
| Both: toggle + hold-suspend | ON by default, hold to suspend one point, toggle for a section | ✓ |
| On + hold-to-suspend only | ON by default, momentary suspend only | |
| Persistent toggle only | Manual toggle, no momentary override | |

**User's choice:** Both: toggle + hold-suspend
**Notes:** Hold-key (e.g. `Alt`) suspends for a single point; persistent toggle (e.g. `F3`) turns it off for a stretch. Exact keys reconciled with Phase 9 bindings at plan time.

### What should the on-screen snap indicator look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type glyphs (CAD-style) | □ vertex, △ on-segment, ✕ reserved for intersection | ✓ |
| Single uniform highlight | One highlight for any snap | |
| Uniform mark + tiny label | Single mark with a text label | |

**User's choice:** Per-type glyphs (CAD-style)
**Notes:** Shape conveys snap type so the estimator trusts what they snapped to. ✕ reserved for deferred intersection snap.

---

## Which snap targets ship

### Which snap targets ship in this phase vs defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship vertex + on-segment + close-the-loop; defer intersection + grid | Recommended scope | ✓ |
| Also include intersection | Add intersection snap now | |
| Also include grid | Add grid snap now | |

**User's choice:** Ship vertex + on-segment + close-the-loop; defer intersection + grid
**Notes:** Rule — snap to other markups freely; for the in-progress/edited markup snap only to its own start vertex (never own intermediate / actively-dragged vertex). Applies in placement and editing. Intersection deferred for O(k²) cost (spike 002); grid out of scope unless requested.

---

## Self-intersect & arc editing

### Is arc + vertex editing in scope this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Editing IN (endpoint re-solve + bulge handle) | Drag endpoint re-solves arc; drag bulge handle reshapes | ✓ |
| Placement-only | Arcs drawable but not editable this phase | |

**User's choice:** Editing IN
**Notes:** Snapping + sagitta cap + self-intersection guard apply on edit; all edits undoable; round-trips through save/BOQ. User specifically asked for editing.

### Post-hoc straight↔arc edge conversion — include or defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer | No right-click "Make arc / Make straight" on committed edges this phase | ✓ |
| Include | Add edge context menu + edge hit-testing now | |

**User's choice:** Defer
**Notes:** Needs a new edge-context-menu surface no success criterion requires; arcs already reachable via draw + edit. Clean follow-up later.

### Self-intersection on commit — block or warn-but-allow?

| Option | Description | Selected |
|--------|-------------|----------|
| Block + keep editing | Refuse commit, stay in edit mode with a message | ✓ |
| Warn-but-allow | Warn but let it commit | |

**User's choice:** Block + keep editing
**Notes:** Guarantees no wrong quantity reaches the BOQ (satisfies success criterion #5). Sagitta cap prevents most cases. Warn-but-allow rejected — risks a bogus area in the BOQ.

---

## Claude's Discretion

- Exact keybindings for the arc-edge hold-key, snap-suspend hold-key, and snap toggle — chosen at plan time, reconciled against Phase 9 ribbon/shortcut bindings.
- Spatial-index structure and tolerance/cell sizing — follow the validated spike-002 design.
- Glyph/handle visual sizing — follow the zoom-compensated overlay pattern.

## Deferred Ideas

- Post-hoc straight↔arc edge conversion (right-click committed edge).
- Intersection snap (✕ glyph reserved; O(k²) cost — needs separate validation).
- Grid snap (out of scope unless requested).
- End-user How-To-Manual (its own future phase; Phase 14 still emits manual-ready docs for its new features).
