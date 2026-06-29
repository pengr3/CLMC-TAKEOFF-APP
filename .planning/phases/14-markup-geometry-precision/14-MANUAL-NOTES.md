# Phase 14 — Manual-Ready Notes (Markup Geometry Precision)

> **Purpose:** Manual-ready handoff for every new tool, gesture, shortcut, and on-canvas
> indicator shipped in Phase 14 (plans 14-03 → 14-06). This satisfies the project's
> `project-howto-manual` constraint: each feature is documented (shortcuts table +
> indicator legend + usage notes) the moment it is built, so the future end-user
> manual phase can lift this content directly. The end-user manual itself is a
> separate future phase (out of scope here).
>
> Keybindings below are the **FINAL confirmed keys** from the 14-03 and 14-04
> SUMMARY files — not the proposed/placeholder keys in the original UI-SPEC.

---

## 1. Shortcuts Table

| Action | Key / Gesture | Mode | Notes |
|--------|---------------|------|-------|
| Toggle snapping on/off | `F3` | Any markup placement / editing | Persistent toggle. When OFF the StatusBar shows `Snap: OFF` in amber and no □/△ glyph appears. Press `F3` again to turn it back on. |
| Suspend snapping for one click | `Alt` (hold) | During placement / vertex-drag | Momentary: the glyph disappears while `Alt` is held and returns on release. An `Alt+Tab` away safely clears the suspend (window-blur safety net) so snapping is never left stuck off. |
| Make the next edge an arc (one-off) | `A` (hold) | While drawing a linear / area / perimeter / wall edge | Curves just the next edge, then reverts to straight on its own. Releasing `A` cancels a pending hold. |
| Sticky arc mode (toggle) | `Shift+A` | While drawing | Keeps every successive edge curved until you tap `Shift+A` again. Survives chained commits (a run of arc edges stays armed). |
| Draw a curved edge (3-click gesture) | Click **start** → click **on-arc point** → click **end** | Arc mode active (hold-A or sticky) | The curve bends live through your middle point as you move toward the end. The middle (on-arc) click is a **free point** — snapping is turned off for it so you can shape the curve freely; the start and end clicks still snap. |
| Reshape a curved edge | Drag the round blue **bulge handle** | Vertex-edit mode on a selected arc-edged markup | Drag away from the chord to deepen, toward it to flatten. One `Ctrl+Z` reverts the whole reshape. |
| Re-bend a curved edge by its corner | Drag the square **corner handle** of an arc edge | Vertex-edit mode | The arc re-bends to follow the new corner; one `Ctrl+Z` reverts both the corner move and the curve. |
| (unchanged) Undo / Redo | `Ctrl+Z` / `Ctrl+Y` | Global | Arc draws, bulge reshapes, and endpoint re-solves are all single undoable actions. |
| (unchanged) Select all | `Ctrl+A` | Global | Not shadowed by the arc keys — checked separately. |

All arc / snap keybindings are guarded by the in-text-input check, so typing an item
name or category never triggers them.

---

## 2. Indicator Legend (on-canvas glyphs & handles)

| Glyph / Handle | Meaning | Appearance | Shipped? |
|----------------|---------|------------|----------|
| **□** blue square | Cursor locked onto an existing point — a corner or the end of a line (vertex / endpoint snap). On the very first point of an area/perimeter it means "close the loop". | `Rect`, accent blue `#0078d4` + contrasting halo, zoom-compensated (constant screen size) | Yes |
| **△** blue triangle | Cursor locked onto the nearest point **along** an existing line (segment snap, not a corner). | `RegularPolygon` (point up), accent blue + halo, zoom-compensated | Yes |
| **round blue handle** | The arc bulge / drag-to-bend control on a curved edge. Sits on the edge's on-arc midpoint. Drag away from the chord to deepen, toward it to flatten. Turns its guide **amber** at the safe-bend limit. | `Circle`, accent blue `#0078d4`, ~9px diameter (distinct from the square vertex handle) | Yes |
| **red highlight** | A self-crossing edge that **blocks the commit** of an area/perimeter — drawn slightly thicker than the markup stroke in problem red `#dc2626`. | Transient red line over the offending segment(s) | Yes |
| **✕ cross** | Intersection-snap glyph — **RESERVED, NOT SHIPPED** this phase. Drawn nowhere; documented so the legend stays stable when intersection snapping lands later. | — | No (reserved) |

### Verbatim manual-ready captions (from 14-UI-SPEC, copied for the manual)

- **Vertex snap (□):** *"A blue square means your cursor has locked onto an existing point — a corner or the end of a line. Click to place exactly on it."*
- **Segment snap (△):** *"A blue triangle means your cursor has locked onto the nearest point along an existing line (not a corner). Click to drop a point right on that line."*
- **Close-the-loop (□ on start vertex):** *"When tracing an area or perimeter, a blue square on your very first point means you're about to close the shape. Click to finish the loop."*
- **Bulge handle:** *"Each curved edge has a round blue handle at its midpoint. Drag it away from the straight line to deepen the curve, or toward it to flatten the curve. Drag past the safe limit and the guide turns amber — that's the maximum bend before the shape would fold on itself."*
- **Endpoint re-solve (drag a vertex of an arc edge):** *"Dragging the square corner handle at either end of a curved edge re-bends the arc to pass through the new corner position — the curve follows the corner."*
- **Blocked commit:** *"If an area or perimeter outline crosses over itself, the app won't let you finish it — a wrong shape would report a wrong quantity. The crossing is highlighted in red. Drag the corners or curve handles apart until the red clears, then finish again."*

---

## 3. Usage Notes

### Snapping (D-03 / D-04 / D-05 / D-07)

Snapping is **on by default** — your cursor jumps to nearby points and lines and shows
a blue marker. Hold `Alt` to ignore snapping for a single click, or press `F3` to switch
snapping off entirely (the status bar shows `OFF` in amber). Press `F3` again to turn it
back on. The cursor snaps to existing **endpoints/vertices** (□) and to the **nearest point
along an existing segment** (△). The marker stays the same screen size at every zoom level
(1×→8×), driven by a spatial index so it stays instant even on a page with thousands of
vertices. While tracing an area or perimeter, a □ on your very first point means you're
about to close the shape — click to finish the loop.

### Arc drawing — the 3-click gesture (D-01 / D-02)

Edges are straight by default. **Hold `A`** while drawing one edge to make just that edge a
curve, then it goes back to straight on its own. **Tap `Shift+A`** to keep drawing curved
edges until you tap it again. The cursor gains a small blue arc tick whenever Arc mode is on.
To draw the curve: **click where the curve starts, click a point the curve must pass through,
then click where it ends.** As you move toward the end point you'll see the curve bend live
through your middle point. The middle (on-arc) click is a free point — snapping is turned off
for it so you can shape the curve freely; the start and end clicks still snap. A curved edge
is measured along its **true arc**, not the straight line between its ends — so a curved wall
or area reports the real length and area, not an under-count. Arc edges and straight edges
coexist freely in one markup.

### Arc editing — bulge handle & endpoint re-solve (D-08)

Select a curved markup and enter vertex-edit mode: each curved edge shows a **round blue
handle** at its midpoint. Drag it away from the straight line to deepen the curve, or toward
it to flatten the curve. Drag past the safe limit and the guide turns **amber** — that's the
maximum bend before the shape would fold on itself. Dragging the **square corner handle** at
either end of a curved edge re-bends the arc to pass through the new corner position — the
curve follows the corner. Each reshape (bulge drag or corner re-solve) is a single undoable
action: one `Ctrl+Z` reverts the whole move (both the corner and the curve). The reported
length/area updates live as you reshape.

### Blocked-commit recovery — self-intersection guard (D-09)

If an area or perimeter outline crosses over itself, the app **won't let you finish it** — a
wrong shape would report a wrong quantity. The markup stays in drawing/edit mode, the crossing
is highlighted in **red**, and a `Can't finish —` message explains the problem. Drag the
corners or curve handles apart until the red clears, then finish again (close-the-loop click
or `Enter`). Once the boundary is simple, the markup commits and a valid quantity appears in
the totals panel and the BOQ export. (Linear and wall runs are open shapes and are not subject
to this guard.)

### Why curves measure correctly (D-01 / D-04 — integration, 14-06)

A curved edge is measured along its true arc length (R·sweep), and a curved area applies the
circular-segment correction with the correct sign for both outward and inward bulges — so the
on-canvas label, the live totals, and the exported BOQ all report the real curved quantity,
never the straight-chord under-count. Arc geometry round-trips through save/reload and BOQ
export intact: an arc edge saved to a `.clmc` file reloads as the same curve with the same
measured length.
