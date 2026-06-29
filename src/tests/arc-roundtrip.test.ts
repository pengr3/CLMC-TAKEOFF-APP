import { describe, it, expect, beforeEach } from 'vitest'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { validateV2 } from '@renderer/lib/project-schema'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { polygonArea, polylineLength } from '@renderer/lib/markup-math'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { AreaMarkup, LinearMarkup } from '@renderer/types/markup'

/**
 * SC #5 — arc geometry round-trips through save/reload + BOQ export intact.
 *
 * A markup with an `arcs` map must:
 *   1. serialize (snapshotProject) → JSON.stringify → JSON.parse → validateV2
 *      → hydrateStores and come back with the SAME arcs map (deep-equal); and
 *   2. report an arc-aware BOQ quantity (true arc length / circular-segment
 *      corrected area) that is STRICTLY GREATER than the straight-chord value
 *      for the same shape (the OUTWARD bulge adds length + area).
 *
 * Pre-existing arc-less markups must still load + measure straight (back-compat).
 */

// 100×100 square, single OUTWARD arc on the top edge (0→1). The on-arc mid
// bulges UP (negative y in screen space is "up"); the magnitude makes a clear,
// measurable difference from the straight chord.
const SIDE = 100
const ARC_SQUARE: AreaMarkup = {
  id: 'arc-area-1',
  type: 'area',
  page: 1,
  name: 'Curved Bay',
  categoryId: 'c1',
  color: '#0078d4',
  createdAt: 1000,
  points: [
    { x: 0, y: 0 },
    { x: SIDE, y: 0 },
    { x: SIDE, y: SIDE },
    { x: 0, y: SIDE }
  ],
  // edge 0 (0,0)→(100,0): on-arc mid bulges outward (up) at the chord centre.
  arcs: { 0: { midX: 50, midY: -25 } }
}

const ARC_LINEAR: LinearMarkup = {
  id: 'arc-linear-1',
  type: 'linear',
  page: 1,
  name: 'Curved Run',
  categoryId: 'c1',
  color: '#107c10',
  createdAt: 1001,
  points: [
    { x: 0, y: 0 },
    { x: SIDE, y: 0 }
  ],
  arcs: { 0: { midX: 50, midY: -25 } }
}

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: { 1: [ARC_SQUARE, ARC_LINEAR] },
    categories: { c1: { id: 'c1', name: 'Civil', color: '#0078d4', paletteIndex: 0 } },
    categoryOrder: ['c1'],
    undoStack: [],
    redoStack: []
  })
  useScaleStore.setState({
    pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } },
    globalUnit: 'mm',
    calibMode: 'idle'
  })
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 1,
    pageViewports: { 1: { zoom: 1, panX: 0, panY: 0 } },
    filePath: 'C:/plan.pdf',
    fileName: 'plan.pdf',
    pageScales: {},
    pdfDocument: null,
    activeTool: 'select'
  })
})

describe('arc round-trip (SC #5)', () => {
  it('arcs map survives snapshot → JSON → validateV2 → hydrate (deep-equal)', () => {
    const snap = snapshotProject({
      pdfOriginalFilename: 'plan.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })

    // The arcs field rides the existing Markup[] cast through JSON + the validator.
    const text = JSON.stringify(snap)
    const validated = validateV2(JSON.parse(text))

    const reloadedArea = validated.pages[0].markups.find((m) => m.id === 'arc-area-1') as AreaMarkup
    const reloadedLinear = validated.pages[0].markups.find(
      (m) => m.id === 'arc-linear-1'
    ) as LinearMarkup
    expect(reloadedArea.arcs).toEqual(ARC_SQUARE.arcs)
    expect(reloadedLinear.arcs).toEqual(ARC_LINEAR.arcs)

    // Wipe + hydrate from the parsed/validated file → stores carry the arcs map.
    useMarkupStore.setState({ pageMarkups: {}, categories: {}, categoryOrder: [] })
    hydrateStores(validated)
    const hydrated = useMarkupStore.getState().pageMarkups[1]
    const hydratedArea = hydrated.find((m) => m.id === 'arc-area-1') as AreaMarkup
    const hydratedLinear = hydrated.find((m) => m.id === 'arc-linear-1') as LinearMarkup
    expect(hydratedArea.arcs).toEqual(ARC_SQUARE.arcs)
    expect(hydratedLinear.arcs).toEqual(ARC_LINEAR.arcs)
  })

  it('aggregateBoq reports arc-aware area + length > the straight-chord value', () => {
    // Straight-chord reference values (arcs ABSENT).
    const chordArea = polygonArea(ARC_SQUARE.points)
    const chordLen = polylineLength(ARC_LINEAR.points)
    // Arc-aware reference values (arcs PRESENT) — what the export must report.
    const arcArea = polygonArea(ARC_SQUARE.points, ARC_SQUARE.arcs)
    const arcLen = polylineLength(ARC_LINEAR.points, ARC_LINEAR.arcs)

    // Sanity: the OUTWARD bulge genuinely adds area + length.
    expect(arcArea).toBeGreaterThan(chordArea)
    expect(arcLen).toBeGreaterThan(chordLen)

    const result = aggregateBoq({
      markups: { 1: [ARC_SQUARE, ARC_LINEAR] },
      pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } },
      globalUnit: 'mm',
      totalPages: 1,
      categoriesById: { c1: { id: 'c1', name: 'Civil' } },
      categoryOrder: ['c1'],
      pdfOriginalFilename: 'plan.pdf',
      currentFilePath: null,
      getColorForName: () => '#0078d4'
    })

    const items = result.categories[0].items
    const areaRow = items.find((i) => i.label === 'Curved Bay')!
    const linearRow = items.find((i) => i.label === 'Curved Run')!

    // pixelsPerMm=1, displayUnit='mm' → real == pixel value, so we can compare
    // directly to the arc-aware math (NOT the chord value) within 1e-6.
    expect(areaRow.quantity).toBeCloseTo(arcArea, 6)
    expect(linearRow.quantity).toBeCloseTo(arcLen, 6)

    // And it is strictly greater than the straight-chord quantity (SC #4: no
    // straight-only values for curved edges).
    expect(areaRow.quantity).toBeGreaterThan(chordArea)
    expect(linearRow.quantity).toBeGreaterThan(chordLen)
  })

  it('arc-less markups still load + measure straight (back-compat)', () => {
    const straightArea: AreaMarkup = { ...ARC_SQUARE, id: 'straight-1', name: 'Plain Room' }
    delete (straightArea as { arcs?: unknown }).arcs

    const snap = snapshotProject({
      pdfOriginalFilename: 'plan.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    // Inject the arc-less markup into the serialized snapshot's page directly.
    snap.pages[0].markups = [straightArea]
    const validated = validateV2(JSON.parse(JSON.stringify(snap)))
    const reloaded = validated.pages[0].markups[0] as AreaMarkup
    expect(reloaded.arcs).toBeUndefined()
    // Measures as the plain square (no arc correction).
    expect(polygonArea(reloaded.points)).toBeCloseTo(SIDE * SIDE, 6)
  })
})
