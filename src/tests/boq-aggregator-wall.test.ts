/**
 * RED stubs — Wave 0: wall aggregation branch does not yet exist in boq-aggregator.ts.
 * All tests MUST FAIL at runtime because aggregateBoq ignores 'wall' markups.
 * TypeScript compiles cleanly (WallMarkup type now exists after Task 1).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { WallMarkup } from '@renderer/types/markup'

function makeWallMarkup(name: string, points: Array<{ x: number; y: number }>, wallHeight: number): WallMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'wall',
    page: 1,
    name,
    categoryId: '',
    color: '#dc2626',
    createdAt: Date.now(),
    points,
    wallHeight
  }
}

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  useScaleStore.setState({
    pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'm' } },
    globalUnit: 'm',
    calibMode: 'idle'
  })
  // Reset hiddenItemNames — projectStore must have this field after Phase 8 implementation.
  // At RED time, this field does not exist; the cast suppresses compile errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(useProjectStore as any).setState({ hiddenItemNames: [] })
})

describe('aggregateBoq — wall', () => {
  it('wall markup produces a single m² row with quantity = length_m × heightM', () => {
    // 5000px at pixelsPerMm=1 → 5000mm → 5m; wallHeight=2400mm=2.4m; area=12m²
    // MUST FAIL — 'wall' branch not yet in aggregateBoq
    const wall = makeWallMarkup('TestWall', [{ x: 0, y: 0 }, { x: 5000, y: 0 }], 2400)
    useMarkupStore.setState({ pageMarkups: { 1: [wall] } })

    const result = aggregateBoq({
      markups: { 1: [wall] },
      pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'm' } },
      globalUnit: 'm',
      totalPages: 1,
      categoriesById: {},
      categoryOrder: [],
      getColorForName: () => '#dc2626'
    })

    // Find the wall row
    const allItems = result.categories.flatMap((c) => c.items)
    const wallRow = allItems.find((r) => r.type === 'wall')
    expect(wallRow).toBeDefined()
    expect(wallRow?.uom).toBe('m²')
    expect(wallRow?.quantity).toBeCloseTo(12, 3)
  })

  it('hidden walls still aggregate (D-15)', () => {
    // D-15: aggregateBoq aggregates ALL markups regardless of hiddenItemNames.
    // MUST FAIL — 'wall' branch not yet in aggregateBoq (fails before hidden logic matters)
    const wall = makeWallMarkup('HiddenWall', [{ x: 0, y: 0 }, { x: 5000, y: 0 }], 2400)

    const result = aggregateBoq({
      markups: { 1: [wall] },
      pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'm' } },
      globalUnit: 'm',
      totalPages: 1,
      categoriesById: {},
      categoryOrder: [],
      getColorForName: () => '#dc2626'
    })

    const allItems = result.categories.flatMap((c) => c.items)
    const wallRow = allItems.find((r) => r.type === 'wall')
    expect(wallRow).toBeDefined()
    expect(wallRow?.quantity).toBeCloseTo(12, 3)
  })
})
