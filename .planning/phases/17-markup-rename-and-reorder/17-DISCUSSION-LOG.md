# Phase 17: Markup Rename and Reorder - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 17-markup-rename-and-reorder
**Areas discussed:** Action triggers, Rename UX, Move/Copy picker, Reorder drag feel

---

## Action Triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Right-click menu (both) | Extend `TotalsRowContextMenu`; add the same menu to `EstimateRow`. Matches the app's idiom; zero row-width cost. | ✓ |
| Hover ⋯ button | Kebab button on hover opening the same menu. Totals row tight; Estimate grid already 10 columns. | |
| Both | Right-click AND hover kebab. Max discoverability; doubles build/test + row-width cost. | |

**User's choice:** Right-click menu (both)
**Notes:** "Copy as text" stays totals-only; the Estimate menu carries just the four group actions. Menu order (totals): Rename / Move to… / Copy to… / Duplicate / — / Copy as text.

---

## Rename UX — input mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Small rename popup | One reusable dialog for both surfaces; clean home for a collision warning. | |
| Inline edit-in-place | Name cell becomes a text input; spreadsheet-like, matches EstimateRow. | ✓ |

**User's choice:** Inline edit-in-place

## Rename UX — trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Menu 'Rename' only | No clash with the totals single-click cycle; consistent both surfaces. | |
| Menu + double-click | Also double-click the name (Excel-style); totals row needs an `e.detail` guard to keep the single-click cycle instant. | ✓ |

**User's choice:** Menu + double-click
**Notes:** Totals row uses an `e.detail === 2` guard so the instant single-click cycle isn't dulled; Estimate Item cell has no handler so double-click is clean there.

## Rename UX — name collision

| Option | Description | Selected |
|--------|-------------|----------|
| Concise + honest merge dialog | Merge-confirm stating quantities add + target rate kept. | |
| Detailed merge dialog | Also notes count-pin renumbering + hide/show fold-in. | |
| Minimal merge dialog | "Merge the groups? [Cancel][Merge]" with no detail. | |
| **Block it (user free-text)** | Reject the rename with an inline "already exists" message; no merge, no dialog. | ✓ |

**User's choice:** Block it — "i dont think i like the merge when renaming?"
**Notes:** The user rejected merge-on-rename outright. Because a group's identity *is* its name (aggregator buckets by `name|type`), collision can only merge or block — block chosen. This supersedes SPEC Req 1's merge behavior; `17-SPEC.md` was updated on 2026-07-09 to match. Removes the merge-confirm dialog + rate-merge logic from the phase. Captured as CONTEXT D-04. Deliberate group-merge deferred to a future phase.

---

## Move/Copy picker

| Option | Description | Selected |
|--------|-------------|----------|
| Fly-out submenu | Submenu of existing categories + "New category…". Fastest for the common case; custom-menu work; awkward new-category entry. | |
| Dialog + autocomplete | Small dialog reusing `CategoryAutocomplete` (existing or new). Reuses existing component; cleaner for new categories. | ✓ |

**User's choice:** Dialog + autocomplete
**Notes:** Move keeps the name; Copy picks a category and auto-names "{name} (n)" (shown in the dialog); Duplicate uses no dialog (same category, auto-named). Reconciles the SPEC's "no create-time name/category prompt" as *no name prompt* — Copy still picks a category per Req 4.

---

## Reorder drag feel — grab

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated drag handle | Grip icon on row-hover; drag only from the handle. Zero conflict with existing gestures. | ✓ |
| Grab anywhere on the row | More direct, but collides with click-to-cycle + editable cells. | |

**User's choice:** Dedicated drag handle
**Notes:** Handle on the row's leading edge; appears on both surfaces; within-category only.

## Reorder drag feel — drop feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Insertion line | Grabbed row lifts + follows cursor; thin accent line shows the drop position. | ✓ |
| Live push | Neighboring rows animate apart to open a gap. More tuning; can feel janky. | |

**User's choice:** Insertion line

---

## Claude's Discretion

- Underlying drag mechanism (HTML5 DnD vs pointer-events) → deferred to research (no new npm packages).
- Persisted per-category order field shape, the cross-store atomic-undo command extension, and how `aggregateBoq` consumes the manual order → planner/research.
- Grip-handle glyph + how it shares the tight totals-row hover zone with the existing '+' affordance → executor.
- Small defaults accepted: blank/whitespace rename rejected; grip handle on the leading edge; Copy dialog previews the auto-name.

## Deferred Ideas

- Deliberate group-merge feature (future phase — replaces what merge-on-rename would have done).
- SPEC's own exclusions restated: bulk/multi-group ops; live-shared multi-category geometry; cross-category drag-reorder; reordering categories themselves; canvas-menu group ops.
