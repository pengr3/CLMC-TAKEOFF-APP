# Markup Canvas Depth (Stacking Order) — How-To-Manual Notes (quick-260820-jru)

**For:** the app How-To-Manual. This note documents how markups stack on the plan and
what the estimator can and cannot control about it today.

---

## How markups stack on the plan

Markups are drawn on the plan in a fixed order **by markup type**. The type decides
which markup sits in front when two markups overlap:

| Depth | Markup type | Notes |
|-------|-------------|-------|
| Back (bottom) | **Area** | The only markup with a translucent filled body — it always sits behind everything else |
| ↑ | **Wall** | |
| ↑ | **Perimeter** | |
| ↑ | **Linear** | |
| Front (top) | **Count pin** | Pins always sit in front so they are never buried |

This ordering controls **two things at once**:

1. **What you see** — an area's translucent fill never covers a pin, a pin number, or a
   linear / wall / perimeter line that crosses it.
2. **What you click** — clicking where two markups overlap always selects the one nearer
   the front. Clicking a count pin that sits inside an area selects the **pin**, not the
   area. The same applies to hover highlighting, right-click menus, and dragging.

To select the area itself, click anywhere inside it **away from** another markup.

---

## Why this matters for area markups

An area markup is clickable across its **whole filled interior**, not just its outline.
That is deliberate — it makes large areas easy to grab. The side effect is that if an
area were in front, it would swallow every click landing inside it. Keeping areas at the
back is what lets you keep working on top of them.

Practical consequence: you can freely place count pins, run linear measurements, and draw
walls **inside** an area markup, and every one of them stays individually clickable.

---

## Not yet available: per-markup depth control

There is currently **no way to bring an individual markup forward or send it backward**.
Depth is decided entirely by markup type, per the table above. There is no
"Bring to Front" / "Send to Back" command, and depth is not saved per markup in the
project file.

If two markups of the **same type** overlap (for example two areas), which one sits in
front is not something you can currently choose.

Per-markup z-order control is planned for a future release. Until then, the workaround
for reaching a markup hidden under another of the same type is to move or temporarily
hide the one on top (Totals panel visibility toggle).
