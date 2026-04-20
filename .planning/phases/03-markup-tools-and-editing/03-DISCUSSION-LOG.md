# Phase 3: Markup Tools and Editing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 03-markup-tools-and-editing
**Areas discussed:** Count tool workflow, Name + category entry, Category color system, Canvas label display

---

## Count Tool Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Name prompt appears first | Popup before any pin is placed; subsequent clicks place pins | ✓ |
| Pin placed first, name after | First click places pin, popup appears near it | |
| Toolbar name selector | Active item in toolbar, clicks place pins | |

**User's choice:** Name prompt appears first  
**Switch item:** Click Count tool button again (fresh name popup)

---

## Count Pin Label

| Option | Description | Selected |
|--------|-------------|----------|
| Dot + item name + running count | "Light Switch 3" | ✓ |
| Dot + item name only | No sequential number | |
| Dot only | No label, clean canvas | |

---

## Name + Category Entry (linear/area/perimeter)

| Option | Description | Selected |
|--------|-------------|----------|
| After finishing the shape | Popup after double-click/close | ✓ |
| Before starting the shape | Popup on tool activation | |
| Name optional / skippable | Has Skip button, default names | |

---

## Category Creation

| Option | Description | Selected |
|--------|-------------|----------|
| Type-to-create, auto-complete existing | New name → auto-color; existing → reuse color | ✓ |
| Pick from list or create new | Dropdown + "+ New category" option | |

---

## Category Color System

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed palette of 8–10 distinct colors | Auto-assigned in order, cycle if >8 | ✓ |
| User picks color when creating category | Color picker on first use | |
| Auto palette, user can override | Auto-assign + swatch click to change | |

**Palette selected:** blue, red, green, orange, purple, teal, pink, brown

---

## Canvas Label Display

| Option | Description | Selected |
|--------|-------------|----------|
| Name + measured value | "Wall Run — 12.4m", "Floor Area — 38.2m²" | ✓ |
| Name only | No value on canvas | |

---

## Label Zoom Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible, scale with zoom | Zoom-compensated font, never hidden | ✓ |
| Hidden below zoom threshold | Disappear at low zoom | |

---

## Claude's Discretion

- Exact pin visual style (circle vs teardrop vs square)
- Label positioning when overlapping shape edges
- Minimum label font size floor at extreme zoom-out
- Preview segment following cursor during polyline/polygon draw
- Placement animation/feedback

## Deferred Ideas

- Markup editing after placement (rename/delete by click) — v2 PROD-03
- Category visibility toggle — v2 PROD-02
- Tool keyboard shortcuts — v2 PROD-01
- User color override per category — deferred, fixed palette sufficient for v1
- Polyline mid-point editing — deferred unless trivial with Konva
