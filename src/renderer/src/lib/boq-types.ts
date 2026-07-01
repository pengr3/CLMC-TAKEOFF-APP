import type { ScaleUnit } from '../types/scale'
import type { Markup } from '../types/markup'

/**
 * Per-(name|type) pricing entry (Phase 16). Stored in projectStore.rates and
 * persisted in the .clmc, keyed by `${name}|${type}` (category-INDEPENDENT).
 * `material` and `labor` are ₱ per unit; `markup` is a PERCENT (30 = 30%), NOT
 * a fraction — `price = cost × (1 + markup / 100)` (D-03/D-05). Widens the
 * Phase-15 scalar `rate: number` (a legacy scalar coerces to
 * `{ material: n, labor: 0, markup: 30 }` at hydrate; D-06).
 */
export interface PriceEntry {
  /** ₱ per unit — material rate. */
  material: number
  /** ₱ per unit — labor rate. */
  labor: number
  /** Percent, e.g. 30 (NOT a fraction). Absent → DEFAULT_MARKUP_PCT (30). */
  markup: number
}

/** BOQ metadata block (5 rows above the table — D-09). */
export interface BoqMetadata {
  /** Basename of currentFilePath stripped of .clmc, else viewerStore.fileName stripped of .pdf. */
  projectName: string
  /** viewerStore.fileName ?? 'plan.pdf' — D-09 "Plan:" row. */
  planFilename: string
  /** YYYY-MM-DD via new Date().toISOString().slice(0,10) — D-09 "Exported:" row. */
  exportedDate: string
  /** viewerStore.totalPages — D-09 "Pages:" row. */
  totalPages: number
  /** Sum across all pageMarkups, regardless of scale state — D-09 "Markups:" row. */
  totalMarkups: number
}

/**
 * Aggregation row type. A perimeter markup maps to exactly ONE row (length only,
 * Phase 15) — the row type equals the markup type 'perimeter'. The pre-Phase-15
 * two-row perimeter split (a separate length type and area type) was removed.
 */
export type BoqRowType =
  | 'count'
  | 'linear'
  | 'area'
  | 'perimeter'
  | 'wall'

/**
 * One BOQ row. Quantity is a native number (full precision) — XLSX preserves it
 * with numFmt '0.00' (length/area) or '0' (count); CSV rounds at write time.
 * Color is a hex string '#RRGGBB' (the per-name-group color from Phase 03.1) or
 * null when no live markup with that name has a color.
 */
export interface BoqItemRow {
  /** Post-suffix label per D-02 ('Outlet', 'Outlet (count)', 'Wall (perimeter)'). */
  label: string
  /** Native number, full precision. */
  quantity: number
  /** 'ea' for count; globalUnit for length; globalUnit + '²' for area. */
  uom: string
  /** ₱ unit material rate for this (name,type); 0 when unset (Phase 16, D-03). */
  material: number
  /** ₱ unit labor rate for this (name,type); 0 when unset (Phase 16, D-03). */
  labor: number
  /** Markup percent, e.g. 30 (absent entry → DEFAULT_MARKUP_PCT; D-05). */
  markup: number
  /** material × quantity, ₱ (D-03). */
  materialCost: number
  /** labor × quantity, ₱ (D-03). */
  laborCost: number
  /** materialCost + laborCost, ₱ — the internal/contractor cost (D-03). */
  cost: number
  /** cost × (1 + markup/100), ₱ — the client price (D-05). */
  price: number
  /** price − cost, ₱ (D-05). */
  margin: number
  /** '#RRGGBB' or null. Item-cell fill in XLSX (D-13). */
  color: string | null
  /** Used for like-typed subtotal grouping (D-12). */
  type: BoqRowType
  /**
   * The categoryId this row belongs to, or null for uncategorized items.
   * Optional — absent only in legacy test fixtures and export writer consumers
   * that don't need it. The UI visibility layer (TotalsRow, TotalsCategoryBlock)
   * uses this to build the composite key `name|categoryId` so that same-named
   * items in different categories are toggled independently.
   */
  categoryId?: string | null
}

/** One subtotal entry — one per distinct UoM within a category (D-12). */
export interface BoqSubtotal {
  uom: string
  total: number
}

/** One category group — heading row + items + per-UoM subtotals (D-11, D-12). */
export interface BoqCategoryGroup {
  /** Category display name; '(Uncategorized)' when categoryId is null/empty. */
  name: string
  /** Alphabetical by label (Claude's discretion per CONTEXT). */
  items: BoqItemRow[]
  /** One subtotal per distinct UoM in this group. */
  subtotals: BoqSubtotal[]
  /** Σ row cost in the category, ₱; unit-agnostic. */
  costSubtotal: number
  /** Σ row price in the category, ₱; unit-agnostic. */
  priceSubtotal: number
  /** Σ row margin in the category, ₱; unit-agnostic. */
  marginSubtotal: number
}

/**
 * Normalized in-memory BOQ structure. SINGLE source of truth feeding both the
 * XLSX writer and the CSV writer (D-22). Aggregator returns this; both writers
 * consume it.
 */
export interface BoqStructure {
  metadata: BoqMetadata
  /** In markupStore.categoryOrder; empty categories excluded (D-11). */
  categories: BoqCategoryGroup[]
  /** One per distinct UoM project-wide (D-12). */
  grandTotals: BoqSubtotal[]
  /** Σ all category costSubtotals, ₱. */
  grandTotalCost: number
  /** Σ all category priceSubtotals, ₱. */
  grandTotalPrice: number
  /** Σ all category marginSubtotals, ₱. */
  grandTotalMargin: number
}

/**
 * Pure-function override hooks for the aggregator. Production callers pass
 * nothing (defaults read from useMarkupStore / useScaleStore / useViewerStore /
 * useProjectStore via getState). Tests inject deterministic fixtures.
 */
export interface AggregateOptions {
  markups?: Record<number, Markup[]>
  pageScales?: Record<number, { pixelsPerMm: number; displayUnit: ScaleUnit } | null>
  globalUnit?: ScaleUnit
  totalPages?: number
  categoriesById?: Record<string, { id: string; name: string }>
  categoryOrder?: string[]
  pdfOriginalFilename?: string
  currentFilePath?: string | null
  getColorForName?: (name: string) => string | null
  /** Per-(name|type) PriceEntry map; default useProjectStore.getState().rates. */
  rates?: Record<string, PriceEntry>
}

/**
 * useExport hook return type. App.tsx routes by kind:
 * - ok: show success toast 'Exported: {basename(filePath)}' (D-20)
 * - needs-uncalibrated-confirmation: show UncalibratedExportWarningModal (D-06)
 * - canceled: silent — no toast (dialog cancel or in-flight race)
 * - error: show OpenErrorModal-style with message (D-21)
 */
export type ExportResult =
  | { kind: 'ok'; filePath: string }
  | { kind: 'needs-uncalibrated-confirmation'; uncalibratedPages: number[]; structure: BoqStructure }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string }
