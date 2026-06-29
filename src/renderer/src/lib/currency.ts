/**
 * currency.ts — the single renderer-side currency seam (Phase 15).
 *
 * `CURRENCY_SYMBOL` is the one place the renderer's ₱ glyph is defined. The
 * inline rate input (TotalsRow), the per-category cost subtotal
 * (TotalsCategoryBlock), and the grand-total cost bar (TotalsPanel) all import
 * it, so a future Settings currency picker has a single seam to swap.
 *
 * Locked this phase to ₱ (Philippine Peso) — a hardcoded constant, no picker.
 * The main-process writers (Wave 3 / boq-writers.ts) keep their OWN local copy
 * of the symbol per the codebase's duplication-with-test-lock convention; this
 * module is renderer-only and intentionally exports nothing else.
 */
export const CURRENCY_SYMBOL = '₱'
