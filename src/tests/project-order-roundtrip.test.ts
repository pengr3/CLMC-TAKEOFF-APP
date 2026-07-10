import { describe, it, expect, beforeEach } from 'vitest'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { validateV2 } from '@renderer/lib/project-schema'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { ProjectFileV2 } from '@renderer/lib/project-schema'

// Phase 17 (Req 2, D-11 / threat T-17-01): the per-category manual item order
// persists ADDITIVELY in the .clmc (no formatVersion bump), round-trips through
// snapshot/validate/hydrate, and degrades safely on old + malformed files (V5
// coercion in hydrateStores). Mirrors project-serialize.test.ts's harness.

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
  useScaleStore.getState().reset()
  useProjectStore.getState().reset()
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 1,
    pageViewports: {},
    filePath: null,
    fileName: null,
    pageScales: {},
    pdfDocument: null,
    activeTool: 'select'
  })
})

describe('project-serialize — categoryItemOrder persistence (Phase 17 Req 2)', () => {
  it('(a) round-trips: snapshot -> validateV2 -> JSON -> hydrate deep-equals', () => {
    const order = {
      'cat-e': ['Outlet|count', 'Wire|linear'],
      __uncat__: ['Beam|area']
    }
    useMarkupStore.setState({ categoryItemOrder: order })

    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    // Snapshot carries the field.
    expect(snap.categoryItemOrder).toEqual(order)

    // validateV2 accepts it (no new validation branch rejects the additive field).
    const parsed = validateV2(JSON.parse(JSON.stringify(snap)))
    expect(parsed.categoryItemOrder).toEqual(order)

    // Wipe to a DIFFERENT value so a stale in-memory value can't mask a bad restore.
    useMarkupStore.setState({ categoryItemOrder: { wiped: ['nope|count'] } })

    hydrateStores(parsed)
    expect(useMarkupStore.getState().categoryItemOrder).toEqual(order)
  })

  it('(b) an old file with NO categoryItemOrder hydrates to {} and never throws', () => {
    // Seed a non-empty value first so we prove the open path resets it to {}.
    useMarkupStore.setState({ categoryItemOrder: { stale: ['x|count'] } })

    const call = (): void => hydrateStores(MINIMAL_V2)
    expect(call).not.toThrow()
    call()

    expect(useMarkupStore.getState().categoryItemOrder).toEqual({})
  })

  it('(c) a malformed categoryItemOrder is coerced to a safe Record<string,string[]>; never throws', () => {
    // `cat` value is not an array → dropped entirely.
    // `c2` value is an array with non-string elements → filtered to string-only.
    const data = {
      ...MINIMAL_V2,
      categoryItemOrder: { cat: 'not-an-array', c2: [1, 'x', null] }
    } as unknown as ProjectFileV2

    const call = (): void => hydrateStores(data)
    expect(call).not.toThrow()
    call()

    // cat dropped (non-array), c2 kept only its string element.
    expect(useMarkupStore.getState().categoryItemOrder).toEqual({ c2: ['x'] })
  })

  it('(c2) a wholly non-object categoryItemOrder coerces to {} and never throws', () => {
    for (const bad of ['a string', 42, null, [1, 2, 3]] as unknown[]) {
      useMarkupStore.setState({ categoryItemOrder: { stale: ['x|count'] } })
      const call = (): void =>
        hydrateStores({ ...MINIMAL_V2, categoryItemOrder: bad } as unknown as ProjectFileV2)
      expect(call).not.toThrow()
      call()
      // A non-object (or array — its numeric-index entries are non-array values) → {}.
      // (An array's Object.entries values here are numbers, which are dropped.)
      const result = useMarkupStore.getState().categoryItemOrder
      expect(Object.values(result).every((v) => Array.isArray(v))).toBe(true)
    }
  })

  it('(d) the snapshot keeps formatVersion 2 (no bump) even with categoryItemOrder present', () => {
    useMarkupStore.setState({ categoryItemOrder: { 'cat-e': ['A|count'] } })
    const snap = snapshotProject({
      pdfOriginalFilename: 'plans.pdf',
      pdfSha256: 'abc',
      pdfTotalPages: 1,
      perPageDimensions: { 1: { width: 595, height: 842 } }
    })
    expect(snap.formatVersion).toBe(2)
    // The literal 2 (never 3) — additive field must not trigger a version bump.
    expect(JSON.parse(JSON.stringify(snap)).formatVersion).toBe(2)
  })

  it('(e) LW-01: a __proto__ key is dropped, is inert, does not repoint the prototype, never throws', () => {
    // JSON.parse materializes "__proto__" as a genuine OWN enumerable property (it does
    // NOT invoke the setter), so it reaches the coercion loop. Without the dunder guard,
    // `safeOrder["__proto__"] = [...]` would repoint safeOrder's prototype to the array.
    const raw = JSON.parse('{"__proto__":["x"],"cat-e":["Outlet|count"]}')
    const data = { ...MINIMAL_V2, categoryItemOrder: raw } as unknown as ProjectFileV2

    const call = (): void => hydrateStores(data)
    expect(call).not.toThrow()
    call()

    const result = useMarkupStore.getState().categoryItemOrder
    // The dunder key is dropped entirely; the legitimate key survives.
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false)
    expect(result).toEqual({ 'cat-e': ['Outlet|count'] })
    // The sanitized object's prototype is untouched (NOT repointed to the injected array).
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(Array.isArray(Object.getPrototypeOf(result))).toBe(false)
  })

  it('opening a file with categoryItemOrder does NOT mark the project dirty', () => {
    // Hydration runs inside the suspend/resume bracket → isDirty stays false.
    const data = {
      ...MINIMAL_V2,
      categoryItemOrder: { 'cat-e': ['Outlet|count'] }
    } as unknown as ProjectFileV2
    hydrateStores(data)
    expect(useProjectStore.getState().isDirty).toBe(false)
  })
})
