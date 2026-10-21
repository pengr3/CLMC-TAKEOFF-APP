import { describe, it, expect, beforeEach } from 'vitest'
import { hydrateStores } from '@renderer/lib/project-serialize'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { ProjectFileV2 } from '@renderer/lib/project-schema'

// PROTO-RATES (/code-review 17 --fix): the rates hydrate loop must drop dunder keys —
// mirroring the LW-01 safeOrder guard — so a crafted .clmc cannot repoint the prototype.

const MINIMAL_V2: ProjectFileV2 = {
  formatVersion: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  pdf: { originalFilename: 'test.pdf', sha256: 'abc', totalPages: 1 },
  globalUnit: 'm',
  categories: {},
  categoryOrder: [],
  currentPage: 1,
  pages: [
    {
      pageIndex: 1,
      dimensions: { width: 800, height: 600 },
      scale: null,
      viewport: { zoom: 1, panX: 0, panY: 0 },
      markups: []
    }
  ]
}

beforeEach(() => {
  useMarkupStore.getState().reset()
  useProjectStore.getState().reset()
  useScaleStore.getState().reset()
  useViewerStore.setState({ currentPage: 1, totalPages: 1 })
})

describe('PROTO-RATES: a __proto__ key in a crafted .clmc rates map is dropped safely', () => {
  it('does not repoint the rates prototype and keeps the legitimate entry', () => {
    // JSON.parse materializes "__proto__" as a genuine OWN enumerable property (it does NOT
    // invoke the setter), so it reaches the coercion loop. Without the dunder guard,
    // `safeRates["__proto__"] = {...}` would repoint safeRates's prototype.
    const raw = JSON.parse(
      '{"__proto__":{"material":1,"labor":2,"markup":3},"Slab|area":{"material":5,"labor":1,"markup":30}}'
    )
    const data = { ...MINIMAL_V2, rates: raw } as unknown as ProjectFileV2

    expect(() => hydrateStores(data)).not.toThrow()

    const rates = useProjectStore.getState().rates
    expect(Object.prototype.hasOwnProperty.call(rates, '__proto__')).toBe(false)
    expect(Object.getPrototypeOf(rates)).toBe(Object.prototype)
    expect(rates['Slab|area']).toEqual({ material: 5, labor: 1, markup: 30, basis: 'm²', review: 'legacy-unresolved' })
  })
})
