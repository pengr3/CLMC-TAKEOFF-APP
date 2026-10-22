import { beforeEach, expect, it } from 'vitest'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { applyLibraryRate } from '@renderer/lib/apply-library-rate'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import type { ProjectFileV2, ProjectFileV3 } from '@renderer/lib/project-schema'

const params = {
  pdfOriginalFilename: 'plan.pdf',
  pdfSha256: 'abc',
  pdfTotalPages: 1,
  perPageDimensions: { 1: { width: 10000, height: 10000 } }
}
function snapshot(): ProjectFileV3 {
  return JSON.parse(JSON.stringify(snapshotProject(params)))
}
function legacySnapshot(): ProjectFileV2 {
  return { ...snapshot(), formatVersion: 2 }
}
beforeEach(() => {
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  useViewerStore.setState({ totalPages: 1 })
  useScaleStore.setState({
    globalUnit: 'm',
    pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'm' } }
  })
  useMarkupStore.setState({
    pageMarkups: {
      1: [
        {
          id: 'w',
          name: 'Wire',
          type: 'linear',
          page: 1,
          categoryId: '',
          color: '#123456',
          createdAt: 1,
          points: [
            { x: 0, y: 0 },
            { x: 10000, y: 0 }
          ]
        }
      ]
    }
  })
})

it('stamps manual prices and retains explicit basis and totals on project-only reopen', () => {
  useProjectStore.getState().setPrice('Wire|linear', { material: 10, labor: 5, markup: 0 })
  expect(useProjectStore.getState().rates['Wire|linear']).toMatchObject({
    basis: 'm',
    review: 'reviewed'
  })
  useScaleStore.setState({ globalUnit: 'ft' })
  const saved = snapshot()
  hydrateStores(saved)
  expect(useProjectStore.getState().rates['Wire|linear']).toMatchObject({
    basis: 'm',
    review: 'reviewed'
  })
  expect(aggregateBoq().grandTotalCost).toBeCloseTo(150, 10)
  expect(aggregateBoq().grandTotalPrice).toBeCloseTo(150, 10)
  expect(useProjectStore.getState().isDirty).toBe(false)
})

it.each([10, { material: 10, labor: 5, markup: 0 }])(
  'retains initial legacy numeric interpretation and unresolved state: %j',
  (legacy) => {
    const saved = legacySnapshot()
    saved.globalUnit = 'ft'
    saved.rates = { 'Wire|linear': legacy } as ProjectFileV2['rates']
    hydrateStores(saved)
    expect(useProjectStore.getState().rates['Wire|linear']).toMatchObject({
      basis: 'ft',
      review: 'legacy-unresolved'
    })
    const initial = aggregateBoq().grandTotalCost
    expect(initial).toBeCloseTo((10000 / 304.8) * (typeof legacy === 'number' ? 10 : 15), 9)
    useScaleStore.setState({ globalUnit: 'm' })
    hydrateStores(snapshot())
    expect(aggregateBoq().grandTotalCost).toBeCloseTo(initial, 9)
    expect(useProjectStore.getState().getUnresolvedRateKeys()).toEqual(['Wire|linear'])
  }
)

it('requires explicit acknowledgement, preserves it through save and increments revision', () => {
  const saved = legacySnapshot()
  saved.rates = { 'Wire|linear': { material: 10, labor: 5, markup: 0 } }
  hydrateStores(saved)
  const revision = useProjectStore.getState().editRevision
  useProjectStore.getState().setPrice('Wire|linear', { markup: 25 })
  expect(useProjectStore.getState().getUnresolvedRateKeys()).toEqual(['Wire|linear'])
  const frozen = snapshot()
  useProjectStore.getState().acknowledgeRateBasis(['Wire|linear'])
  expect(useProjectStore.getState().getUnresolvedRateKeys()).toEqual([])
  expect(useProjectStore.getState().editRevision).toBeGreaterThan(revision)
  expect(useProjectStore.getState().isDirty).toBe(true)
  expect(frozen.rates!['Wire|linear'].review).toBe('legacy-unresolved')
  hydrateStores(snapshot())
  expect(useProjectStore.getState().rates['Wire|linear'].review).toBe('reviewed')
})

it('stamps normalized library basis, preserves markup, and snapshots a detached project price', () => {
  useProjectStore.getState().setPrice('Wire|linear', { markup: 17.5 })
  const source = { code: 'W', description: 'Wire', category: '', unit: 'm', material: 4, labor: 2 }
  expect(applyLibraryRate(aggregateBoq().categories[0].items[0], source).ok).toBe(true)
  expect(useProjectStore.getState().rates['Wire|linear']).toEqual({
    material: 4,
    labor: 2,
    markup: 17.5,
    basis: 'm',
    review: 'reviewed'
  })
  const saved = snapshot()
  source.material = 999
  hydrateStores(saved)
  expect(aggregateBoq().grandTotalCost).toBe(60)
  expect(useProjectStore.getState().rates['Wire|linear'].markup).toBe(17.5)
  expect(
    applyLibraryRate(aggregateBoq().categories[0].items[0], { ...source, unit: 'ft' }).ok
  ).toBe(false)
})

it('marks absent history unresolved and infers wall basis as square metres', () => {
  const saved = legacySnapshot()
  delete (saved as Partial<ProjectFileV2>).globalUnit
  saved.rates = {
    'Wall|wall': { material: 7, labor: 0, markup: 0 },
    'Wire|linear': { material: 3, labor: 0, markup: 0 }
  }
  hydrateStores(saved)
  expect(useProjectStore.getState().rates['Wall|wall']).toMatchObject({
    basis: 'm²',
    review: 'legacy-unresolved'
  })
  expect(useProjectStore.getState().rates['Wire|linear']).toMatchObject({
    basis: 'm',
    review: 'legacy-unresolved'
  })
  expect(useProjectStore.getState().getUnresolvedRateKeys()).toEqual(['Wall|wall', 'Wire|linear'])
})
