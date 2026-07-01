/**
 * estimate-defaults.ts — the single project-wide estimating-default seam (Phase 16).
 *
 * `DEFAULT_MARKUP_PCT` is a PERCENT (30 = 30%), NOT a fraction. It is the markup
 * applied to a BOQ row that has no explicit PriceEntry markup — `price =
 * cost × (1 + markup / 100)` (D-05). Consumed in exactly three places:
 *   (a) projectStore.setPrice's brand-new-entry seed,
 *   (b) the aggregator's absent-markup read,
 *   (c) the hydrate coercion's missing-markup default.
 * (Wave 2a's Estimate grid markup-cell seed also imports it.)
 *
 * This is the ONE seam a future Settings control will change (D-05 / D-09 — the
 * Settings UI is deferred; the constant is the v1 stand-in). Exports nothing else.
 */
export const DEFAULT_MARKUP_PCT = 30
