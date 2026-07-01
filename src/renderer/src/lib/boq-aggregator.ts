import type {
  BoqStructure,
  BoqMetadata,
  BoqRowType,
  BoqItemRow,
  BoqSubtotal,
  BoqCategoryGroup,
  AggregateOptions
} from './boq-types'
import type { AreaMarkup, LinearMarkup, PerimeterMarkup, WallMarkup } from '../types/markup'
import { polylineLength, polygonArea, pixelLengthToReal, pixelAreaToReal } from './markup-math'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'
import { DEFAULT_MARKUP_PCT } from './estimate-defaults'

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
  if (t === 'linear' || t === 'perimeter') return globalUnit
  if (t === 'wall') return 'm²' // D-12: walls always produce m² regardless of project globalUnit
  return globalUnit + '²' // U+00B2 SUPERSCRIPT TWO — 'm²', 'ft²', etc.
}

function typeWord(t: BoqRowType): 'count' | 'linear' | 'area' | 'perimeter' | 'wall' {
  if (t === 'count') return 'count'
  if (t === 'linear') return 'linear'
  if (t === 'perimeter') return 'perimeter'
  if (t === 'wall') return 'wall'
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
      (m) => m.type === 'linear' || m.type === 'area' || m.type === 'perimeter' || m.type === 'wall'
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
  // Phase 15: per-(name|type) ₱ rate map. An injected map wins; otherwise read the
  // project store (the persisted, category-INDEPENDENT rates). cost = rate × quantity.
  const rates = opts.rates ?? useProjectStore.getState().rates
  // WR-01: project-wide default markup % for rows lacking an explicit entry markup.
  // An injected value wins; otherwise read the persisted project default. Resolved
  // ONCE here (not per-row) — used in the `?? defaultMarkup ??` fallback below.
  // Note: an injected `defaultMarkup: 0` is honored (?? not ||); when the caller
  // passes NOTHING and no project value exists, the field-level `?? DEFAULT_MARKUP_PCT`
  // still lands at 30 (a store getState() default of 30 also yields 30).
  const defaultMarkup = opts.defaultMarkup ?? useProjectStore.getState().defaultMarkupPct

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
        // Arc-aware (SC #4): pass m.arcs so a curved edge measures its true arc
        // length (R·sweep), not the straight chord. Straight markups have no
        // arcs field → identical to the previous single-arg call.
        const px = polylineLength((m as LinearMarkup).points, m.arcs)
        const real = pixelLengthToReal(px, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'linear', real)
      } else if (m.type === 'area') {
        // Arc-aware (SC #4): m.arcs applies the circular-segment area correction
        // (winding-independent sign rule) for curved edges.
        const pxA = polygonArea((m as AreaMarkup).points, m.arcs)
        const real = pixelAreaToReal(pxA, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'area', real)
      } else if (m.type === 'perimeter') {
        // Phase 15: perimeter is LENGTH-ONLY — one row, no area synthesis.
        // Perimeter LENGTH must include the closing segment to match the
        // PerimeterMarkup label (STATE.md decision: PerimeterMarkup appends
        // points[0] to polylineLength input).
        // Arc-aware: the closing edge n-1→0 keys on index n-1 (14-01 contract);
        // in the closing-augmented array the closing edge IS index n-1
        // (pts[n-1]→pts[n]=pts[0]), so m.arcs maps onto closingPts directly.
        // (Phase-14 arc behavior MUST NOT regress — do not touch this length path.)
        const pts = (m as PerimeterMarkup).points
        const closingPts = [...pts, pts[0]]
        const pxL = polylineLength(closingPts, m.arcs)
        const realL = pixelLengthToReal(pxL, scale.pixelsPerMm, globalUnit)
        add(catId, m.name, 'perimeter', realL)
      } else if (m.type === 'wall') {
        // scale === null already filtered upstream (if (scale === null) continue above)
        const wallM = m as WallMarkup
        // Defensive guard — popup validates, but crafted .clmc could have 0/negative wallHeight
        if (wallM.wallHeight <= 0) continue
        // Arc-aware (SC #4): curved wall runs measure along the true arc.
        const pixelLen = polylineLength(wallM.points, m.arcs)
        const lengthM = pixelLen / scale.pixelsPerMm / 1000 // px → mm → m
        const heightM = wallM.wallHeight / 1000
        add(catId, m.name, 'wall', lengthM * heightM)
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
  // Phase 16: project-wide ₱ Cost/Price/Margin accumulators (unit-agnostic single
  // numbers, Σ over category subtotals).
  let grandCost = 0
  let grandPrice = 0
  let grandMargin = 0

  for (const catKey of orderedCatKeys) {
    const bucket = buckets.get(catKey)!

    // The categoryId for this group — null for uncategorized.
    const groupCategoryId: string | null = catKey === UNCAT_BUCKET_KEY ? null : catKey

    // 2a. Per-name collision detection (Phase 15: perimeter is a first-class member —
    //     no longer excluded from the D-02 collision set).
    const nameTypes = new Map<string, Set<BoqRowType>>()
    for (const k of bucket.keys()) {
      const [name, type] = k.split('|') as [string, BoqRowType]
      let s = nameTypes.get(name)
      if (!s) {
        s = new Set()
        nameTypes.set(name, s)
      }
      s.add(type)
    }

    // 2b. Build item rows with the unified D-02 label rule (Phase 15: perimeter
    //     follows the same collision-suffix logic as count/linear/area — plain
    //     {name}, gaining {name} ({typeWord}) only when ≥2 types collide on a name).
    const items: BoqItemRow[] = []
    for (const [k, acc] of bucket.entries()) {
      const [name, type] = k.split('|') as [string, BoqRowType]
      let label = name
      const typeSet = nameTypes.get(name)
      if (typeSet && typeSet.size >= 2) {
        label = `${name} (${typeWord(type)})`
      }
      // Phase 16: PriceEntry keyed by `${name}|${type}` (same shape as the bucket
      // key, category-INDEPENDENT). Absent ENTRY → material/labor 0 + the project
      // default markup (WR-01: `entry?.markup ?? defaultMarkup ?? DEFAULT_MARKUP_PCT`
      // — the resolved project-wide default, falling back to 30 only if that is also
      // absent). An entry WITH an explicit markup 0 keeps 0, and a project default of
      // 0 is honored (both nullish `??`, not `||`). materialCost/laborCost = rate ×
      // quantity; cost = materialCost + laborCost (internal); price = cost × (1 +
      // markup/100) (client); margin = price − cost (D-03/D-04/D-05).
      const entry = rates[`${name}|${type}`]
      const material = entry?.material ?? 0
      const labor = entry?.labor ?? 0
      const markup = entry?.markup ?? defaultMarkup ?? DEFAULT_MARKUP_PCT
      const materialCost = material * acc.quantity
      const laborCost = labor * acc.quantity
      const cost = materialCost + laborCost
      const price = cost * (1 + markup / 100)
      const margin = price - cost
      items.push({
        label,
        quantity: acc.quantity,
        uom: uomFor(type, globalUnit),
        material,
        labor,
        markup,
        materialCost,
        laborCost,
        cost,
        price,
        margin,
        color: acc.color,
        type,
        categoryId: groupCategoryId
      })
    }

    // 2c. Alphabetical sort by post-suffix label (Claude's discretion confirmed)
    items.sort((a, b) => a.label.localeCompare(b.label))

    // 2d. Subtotals — one per distinct UoM (D-12, Q3) + Cost/Price/Margin ₱
    //     subtotals (Phase 16: unit-agnostic single numbers per category, PARALLEL
    //     to the per-UoM quantity subtotals, not bucketed by UoM).
    const byUom = new Map<string, number>()
    let catCost = 0
    let catPrice = 0
    let catMargin = 0
    for (const it of items) {
      byUom.set(it.uom, (byUom.get(it.uom) ?? 0) + it.quantity)
      grandByUom.set(it.uom, (grandByUom.get(it.uom) ?? 0) + it.quantity)
      catCost += it.cost
      catPrice += it.price
      catMargin += it.margin
    }
    grandCost += catCost
    grandPrice += catPrice
    grandMargin += catMargin
    const subtotals: BoqSubtotal[] = Array.from(byUom.entries()).map(([uom, total]) => ({
      uom,
      total
    }))

    const catName =
      catKey === UNCAT_BUCKET_KEY
        ? UNCATEGORIZED_LABEL
        : (categoriesById[catKey]?.name ?? UNCATEGORIZED_LABEL)
    categories.push({
      name: catName,
      items,
      subtotals,
      costSubtotal: catCost,
      priceSubtotal: catPrice,
      marginSubtotal: catMargin
    })
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

  return {
    metadata,
    categories,
    grandTotals,
    grandTotalCost: grandCost,
    grandTotalPrice: grandPrice,
    grandTotalMargin: grandMargin
  }
}
