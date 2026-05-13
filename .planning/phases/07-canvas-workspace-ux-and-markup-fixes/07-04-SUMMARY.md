---
phase: 07-canvas-workspace-ux-and-markup-fixes
plan: "04"
status: complete
completed: 2026-05-13
---

# 07-04 Summary — UAT Closure and Phase Completion

## What Was Verified

All six UAT scenarios approved:

| Scenario | Description | Result |
|----------|-------------|--------|
| A | Canvas fills window — no dark gutter at fit-to-window zoom, Stage tracks resize and splitter drag | ✅ PASS |
| B | TotalsPanel — no grand-total bar, no subtotal rows; category headings and item rows intact | ✅ PASS |
| C | Set Scale popup — all 5 unit options visible inside popup (full-width dropdown, no overflow) | ✅ PASS |
| D | Category keyboard nav — ArrowDown/Up highlight rows, Enter selects without submitting popup | ✅ PASS |
| E | Category canonical substitution — 'electrical' auto-corrects to 'Electrical' on Save | ✅ PASS |
| F | Post-commit markup editing — right-click → Edit → pre-filled popup → Save Changes; Ctrl+Z reverts all three fields simultaneously; Ctrl+Y re-applies | ✅ PASS |

## Test Suite

**57 files, 424 tests — all GREEN** (npx vitest run, confirmed pre-UAT)

## Fixes Shipped During UAT (Scenario C)

The native `<select>` and subsequent `position: fixed` custom dropdown both failed due to `overflow: hidden` on ancestor elements. Final fix: replaced the unit dropdown with a full-width inline dropdown button on its own dedicated row (separate from the distance input). The dropdown list renders via `position: fixed`, which escapes all CSS `overflow: hidden` ancestors per spec.

Additionally polished the ScalePopup layout: added "Set Scale" title, separated distance input and unit selector onto dedicated rows with labels, increased spacing and button sizing throughout.

## Commits

- `58acdb8` — replace native select with fixed-position dropdown in ScalePopup
- `9bce568` — polish ScalePopup layout (header, spacing, button sizing)
- `73fdbf8` — fix invisible caret and monospace Scale preview
- `db0cad0` — replace unit dropdown with inline toggle buttons (interim)
- `15e273a` — convert unit toggle buttons to full-width dropdown (final)

## Phase 7 Closure

All five live-use delinquencies resolved:
1. **Canvas gutter** — CanvasViewport root uses `position: absolute; inset: 0`; ResizeObserver drives Stage dimensions
2. **Post-commit editing** — right-click → Edit → `MarkupNamePopup mode='edit'` → `EditMarkupCommand` with full undo/redo
3. **Totals panel** — grand-total bar and subtotal rows removed; individual item rows only
4. **Set Scale dropdown** — full-width inline dropdown on dedicated row, `position: fixed` list
5. **Category deduplication** — keyboard nav in `CategoryAutocomplete`; canonical-name substitution in `handleConfirm`

ROADMAP.md and STATE.md updated. v1 milestone fully complete — 10/10 phases, 56 plans, 25/25 requirements.
