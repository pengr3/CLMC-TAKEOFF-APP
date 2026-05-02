import type { ScaleUnit } from '../types/scale'
import type { Markup } from '../types/markup'

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

/** Aggregation row type. Perimeter markups synthesize TWO virtual types per shape (D-01). */
export type BoqRowType =
  | 'count'
  | 'linear'
  | 'area'
  | 'perimeter-length'
  | 'perimeter-area'

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
  /** '#RRGGBB' or null. Item-cell fill in XLSX (D-13). */
  color: string | null
  /** Used for like-typed subtotal grouping (D-12). */
  type: BoqRowType
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
