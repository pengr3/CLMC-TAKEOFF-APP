import type {
  BoqStructure,
  BoqMetadata,
  BoqRowType,
  BoqItemRow,
  BoqSubtotal,
  BoqCategoryGroup,
  AggregateOptions
} from './boq-types'
import type { AreaMarkup, LinearMarkup, PerimeterMarkup } from '../types/markup'
import { polylineLength, polygonArea, pixelLengthToReal, pixelAreaToReal } from './markup-math'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'

const UNCATEGORIZED_LABEL = '(Uncategorized)'
const UNCAT_BUCKET_KEY = '__uncat__'

interface RawAccumulator {
  quantity: number
  color: string | null
}

function basenameAny(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(i + 1) : p
}

function stripExt(s: string): string {
  const i = s.lastIndexOf('.')
  return i > 0 ? s.slice(0, i) : s
}

function uomFor(t: BoqRowType, globalUnit: string): string {
  if (t === 'count') return 'ea'
  if (t === 'linear' || t === 'perimeter-length') return globalUnit
  return globalUnit + '²' // U+00B2 SUPERSCRIPT TWO — 'm²', 'ft²', etc.
}

function nonPerimeterTypeWord(t: BoqRowType): 'count' | 'linear' | 'area' {
  if (t === 'count') return 'count'
  if (t === 'linear') return 'linear'
  return 'area' // only 'area' reaches this branch given the caller's type set
}

/**
 * Returns the pages that have ≥1 linear/area/perimeter markup AND no pageScale.
 * Used by useExport to decide whether to show UncalibratedExportWarningModal (D-06).
 *
 * Counts on uncalibrated pages do NOT add the page to this list — counts have
 * no scale dependency (D-05), so an uncalibrated page with only count markups
 * exports cleanly without a warning.
 */
export function findUncalibratedMarkupPages(
  opts: Pick<AggregateOptions, 'markups' | 'pageScales' | 'totalPages'> = {}
): number[] {
  const pageMarkups = opts.markups ?? useMarkupStore.getState().pageMarkups
  const pageScales = opts.pageScales ?? useScaleStore.getState().pageScales
  const totalPages = opts.totalPages ?? useViewerStore.getState().totalPages

  const out: number[] = []
  for (let p = 1; p <= totalPages; p++) {
    if (pageScales[p]) continue
    const list = pageMarkups[p] ?? []
    const hasMeasurement = list.some(
      (m) => m.type === 'linear' || m.type === 'area' || m.type === 'perimeter'
    )
    if (hasMeasurement) out.push(p)
  }
  return out
}

/**
 * Pure aggregator. Production callers pass nothing — defaults read from the
 * Zustand stores via getState(). Tests inject deterministic fixtures via opts.
 *
 * D-22: SINGLE source of truth feeding both buildBoqXlsx and buildBoqCsv.
 */
export function aggregateBoq(opts: AggregateOptions = {}): BoqStructure {
  const pageMarkups = opts.markups ?? useMarkupStore.getState().pageMarkups
  const pageScales = opts.pageScales ?? useScaleStore.getState().pageScales
  const globalUnit = opts.globalUnit ?? useScaleStore.getState().globalUnit
  const totalPages = opts.totalPages ?? useViewerStore.getState().totalPages
  const categoriesById =
    opts.categoriesById ?? (useMarkupStore.getState().categories as Record<string, { id: string; name: string }>)
  const categoryOrder = opts.categoryOrder ?? useMarkupStore.getState().categoryOrder
  const getColorForName =
    opts.getColorForName ?? ((n: string): string | null => useMarkupStore.getState().getColorForName(n))

  // 1. First pass: bucket by (categoryId, name|type) — sums quantities,
  //    captures color from getColorForName once per (cat, name, type) pair.
  type Bucket = Map<string, Map<string, RawAccumulator>> // catKey -> "name|type" -> acc
  const buckets: Bucket = new Map()

  function bucketFor(categoryId: string | null): Map<string, RawAccumulator> {
    const key = categoryId ?? UNCAT_BUCKET_KEY
    let m = buckets.get(key)
    if (!m) {
      m = new Map()
      buckets.set(key, m)
    }
    return m
  }

  function add(categoryId: string | null, name: string, type: BoqRowType, qty: number): void {
    const map = bucketFor(categoryId)
    const k = `${name}|${type}`
    const cur = map.get(k) ?? { quantity: 0, color: getColorForName(name) }
    cur.quantity += qty
    map.set(k, cur)
  }

  for (let p = 1; p <= totalPages; p++) {
    const list = pageMarkups[p] ?? []
    const scale = pageScales[p] ?? null
    for (const m of list) {
      // D-05: counts have no scale dependency — always export
      if (m.type === 'count') {
        const catId = m.categoryId && m.categoryId.length > 0 ? m.categoryId : null
        add(catId, m.name, 'count', 1)
        continue
      }
      // D-06: skip length/area/perimeter on uncalibrated pages (silently)
      if (scale === null) continue

      const catId = m.categoryId && m.categoryId.length > 0 ? m.categoryId : null

      if (m.type === 'linear') {
        const px = polylineLength((m as LinearMarkup).points)
        const real = pixelLengthToReal(px, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'linear', real)
      } else if (m.type === 'area') {
        const pxA = polygonArea((m as AreaMarkup).points)
        const real = pixelAreaToReal(pxA, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'area', real)
      } else if (m.type === 'perimeter') {
        // Perimeter LENGTH must include the closing segment to match the
        // PerimeterMarkup label (STATE.md decision: PerimeterMarkup appends
        // points[0] to polylineLength input).
        const pts = (m as PerimeterMarkup).points
        const closingPts = [...pts, pts[0]]
        const pxL = polylineLength(closingPts)
        const realL = pixelLengthToReal(pxL, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'perimeter-length', realL)
        // Perimeter AREA uses the original closed polygon (NOT the closing-augmented points)
        const pxA = polygonArea(pts)
        const realA = pixelAreaToReal(pxA, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'perimeter-area', realA)
      }
    }
  }

  // 2. Build categories in declared order; empty categories excluded (D-11)
  const orderedCatKeys: string[] = [
    ...categoryOrder.filter((id) => buckets.has(id)),
    ...(buckets.has(UNCAT_BUCKET_KEY) ? [UNCAT_BUCKET_KEY] : [])
  ]

  const categories: BoqCategoryGroup[] = []
  const grandByUom = new Map<string, number>()

  for (const catKey of orderedCatKeys) {
    const bucket = buckets.get(catKey)!

    // 2a. Per-name collision detection (excluding perimeter — D-02)
    const nameNonPerimTypes = new Map<string, Set<BoqRowType>>()
    for (const k of bucket.keys()) {
      const [name, type] = k.split('|') as [string, BoqRowType]
      if (type === 'perimeter-length' || type === 'perimeter-area') continue
      let s = nameNonPerimTypes.get(name)
      if (!s) {
        s = new Set()
        nameNonPerimTypes.set(name, s)
      }
      s.add(type)
    }

    // 2b. Build item rows with D-02 label rules
    const items: BoqItemRow[] = []
    for (const [k, acc] of bucket.entries()) {
      const [name, type] = k.split('|') as [string, BoqRowType]
      let label = name
      if (type === 'perimeter-length') {
        label = `${name} (perimeter)`
      } else if (type === 'perimeter-area') {
        label = `${name} (area)`
      } else {
        const nonPerimSet = nameNonPerimTypes.get(name)
        if (nonPerimSet && nonPerimSet.size >= 2) {
          label = `${name} (${nonPerimeterTypeWord(type)})`
        }
      }
      items.push({
        label,
        quantity: acc.quantity,
        uom: uomFor(type, globalUnit),
        color: acc.color,
        type
      })
    }

    // 2c. Alphabetical sort by post-suffix label (Claude's discretion confirmed)
    items.sort((a, b) => a.label.localeCompare(b.label))

    // 2d. Subtotals — one per distinct UoM (D-12, Q3)
    const byUom = new Map<string, number>()
    for (const it of items) {
      byUom.set(it.uom, (byUom.get(it.uom) ?? 0) + it.quantity)
      grandByUom.set(it.uom, (grandByUom.get(it.uom) ?? 0) + it.quantity)
    }
    const subtotals: BoqSubtotal[] = Array.from(byUom.entries()).map(([uom, total]) => ({
      uom,
      total
    }))

    const catName =
      catKey === UNCAT_BUCKET_KEY
        ? UNCATEGORIZED_LABEL
        : (categoriesById[catKey]?.name ?? UNCATEGORIZED_LABEL)
    categories.push({ name: catName, items, subtotals })
  }

  // 3. Metadata (D-09)
  const totalMarkups = Object.values(pageMarkups).reduce(
    (acc, list) => acc + (list ? list.length : 0),
    0
  )
  const currentFilePath = opts.currentFilePath ?? useProjectStore.getState().currentFilePath
  const pdfOriginalFilename =
    opts.pdfOriginalFilename ?? useViewerStore.getState().fileName ?? 'plan.pdf'

  const projectName = currentFilePath
    ? stripExt(basenameAny(currentFilePath))
    : stripExt(pdfOriginalFilename)

  const metadata: BoqMetadata = {
    projectName,
    planFilename: pdfOriginalFilename,
    exportedDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    totalPages,
    totalMarkups
  }

  const grandTotals: BoqSubtotal[] = Array.from(grandByUom.entries()).map(([uom, total]) => ({
    uom,
    total
  }))

  return { metadata, categories, grandTotals }
}
