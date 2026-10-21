# Phase 19 UI contract

Extend existing dark Estimate workspace using COLORS and current inline styles, 12-13px text and native accessible buttons/inputs. No redesign of Plan/canvas/tool rail.

- Estimate header: Cost Library button, available without a PDF. Opens a centered scrollable dialog, labelled heading, explicit Close and Escape/backdrop handling; restore focus. Prevent canvas shortcuts while open.
- Library management: imported filename/time/count, Download Excel Template and Import CSV / Excel buttons. Instruction: maintain the master file externally and import updates on each PC. No library editing UI.
- Preview: count and first rows, validation errors with row/column, Cancel and Replace Library. Replacement confirms scope: affects this PC only; existing estimates unchanged. Busy and error feedback is visible, previous library retained on failure.
- Estimate item cell: compact accessible library-pick action without changing the ten-column grid or interfering with double-click rename/reorder. Picker displays target name/unit, searchable code/description/category list, material/labor rates. Incompatible units cannot be applied. Explain same-name/type scope and preservation of markup.
- Success: rates update in the row/totals through the existing live calculation. Manual editing remains available. No auto-apply on select/import.
- Dialog list uses bounded scroll, sensible maximum width/height, loading/empty/error states, explicit labels, focus containment and keyboard close. Use no network resources.

Review: all actions visible, destructive replacement explicit and reversible by reimport, row-specific validation, no invisible canvas activation, accessible dialog/list navigation. Contract accepted for implementation based on existing product patterns and the user's approved scope.
