import { describe, it, expect } from 'vitest'
import { autoUniqueName, collisionExists, snapshotGroup } from '@renderer/lib/group-ops'
import type {
  Markup,
  MarkupType,
  CountMarkup,
  AreaMarkup
} from '@renderer/types/markup'

// group-ops.ts is a pure, store-free module — every helper takes its markup input
// as an argument, so these tests build plain fixtures and never touch a store.

function makeCount(name: string, opts: Partial<CountMarkup> = {}): CountMarkup {
  return {
    id: opts.id ?? crypto.randomUUID(),
    type: 'count',
    page: opts.page ?? 1,
    name,
    categoryId: opts.categoryId ?? 'cat-1',
    color: opts.color ?? '#dc2626',
    sequence: opts.sequence ?? 1,
    point: opts.point ?? { x: 10, y: 20 },
    createdAt: opts.createdAt ?? Date.now()
  }
}

function makeArea(name: string, opts: Partial<AreaMarkup> = {}): AreaMarkup {
  return {
    id: opts.id ?? crypto.randomUUID(),
    type: 'area',
    page: opts.page ?? 1,
    name,
    categoryId: opts.categoryId ?? 'cat-1',
    color: opts.color ?? '#0078d4',
    points: opts.points ?? [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ],
    ...(opts.arcs !== undefined ? { arcs: opts.arcs } : {}),
    createdAt: opts.createdAt ?? Date.now()
  }
}

describe('group-ops — autoUniqueName (first-free, A3 base-strip, type-scoped)', () => {
  it('returns "{name} (2)" when the base name exists once under a shared type', () => {
    const markups: Markup[] = [makeArea('Slab')]
    expect(autoUniqueName('Slab', new Set<MarkupType>(['area']), markups)).toBe('Slab (2)')
  })

  it('skips to "{name} (3)" when "{name} (2)" is already taken (first-free, not max+1 gaps)', () => {
    const markups: Markup[] = [makeArea('Slab'), makeArea('Slab (2)')]
    expect(autoUniqueName('Slab', new Set<MarkupType>(['area']), markups)).toBe('Slab (3)')
  })

  it('strips a trailing " (n)" from the source before generating (A3): "Slab (2)" → "Slab (3)"', () => {
    // A duplicate of an already-copied "Slab (2)" must become "Slab (3)", NEVER "Slab (2) (2)".
    const markups: Markup[] = [makeArea('Slab'), makeArea('Slab (2)')]
    expect(autoUniqueName('Slab (2)', new Set<MarkupType>(['area']), markups)).toBe('Slab (3)')
  })

  it('is type-scoped: a same name under a DIFFERENT type does NOT count as taken', () => {
    // "Slab (2)" exists only as a COUNT; an AREA copy of "Slab" should still get "Slab (2)".
    const markups: Markup[] = [makeArea('Slab'), makeCount('Slab (2)')]
    expect(autoUniqueName('Slab', new Set<MarkupType>(['area']), markups)).toBe('Slab (2)')
  })

  it('finds the first free candidate across a run of taken numbers', () => {
    const markups: Markup[] = [
      makeArea('Wall'),
      makeArea('Wall (2)'),
      makeArea('Wall (3)'),
      makeArea('Wall (4)')
    ]
    expect(autoUniqueName('Wall', new Set<MarkupType>(['area']), markups)).toBe('Wall (5)')
  })
})

describe('group-ops — collisionExists (type-scoped, category-independent, group-exclusive)', () => {
  const inSet = makeArea('A', { id: 'a-1' })
  const renameSetIds = new Set(['a-1'])

  it('is TRUE when a same-type markup named newName exists OUTSIDE the rename set', () => {
    const other = makeArea('B', { id: 'b-1' })
    const all: Markup[] = [inSet, other]
    expect(collisionExists('B', renameSetIds, new Set<MarkupType>(['area']), all)).toBe(true)
  })

  it('is FALSE when the only "B" is under a DIFFERENT type (no bucket merge)', () => {
    const otherCount = makeCount('B', { id: 'b-1' })
    const all: Markup[] = [inSet, otherCount]
    // sourceTypes is {area}; a count "B" cannot merge with an area group.
    expect(collisionExists('B', renameSetIds, new Set<MarkupType>(['area']), all)).toBe(false)
  })

  it('is FALSE when the matching "B" is INSIDE the rename set (a group never self-collides)', () => {
    // The rename set itself is named "A" here; renaming it to "A" (or any name only its
    // own members hold) must not block.
    const memberB = makeArea('B', { id: 'a-1' })
    const all: Markup[] = [memberB]
    expect(collisionExists('B', new Set(['a-1']), new Set<MarkupType>(['area']), all)).toBe(false)
  })

  it('is category-independent: a same-(name,type) group in ANOTHER category still collides', () => {
    const otherCat = makeArea('B', { id: 'b-1', categoryId: 'cat-2' })
    const all: Markup[] = [inSet, otherCat]
    expect(collisionExists('B', renameSetIds, new Set<MarkupType>(['area']), all)).toBe(true)
  })

  it('is FALSE when no markup holds newName at all', () => {
    const all: Markup[] = [inSet]
    expect(collisionExists('Z', renameSetIds, new Set<MarkupType>(['area']), all)).toBe(false)
  })
})

describe('group-ops — snapshotGroup (independent deep-cloned copies)', () => {
  it('assigns fresh ids and does NOT reuse source ids', () => {
    const src: Markup[] = [makeArea('Slab', { id: 'src-1' }), makeArea('Slab', { id: 'src-2' })]
    const copies = snapshotGroup(src, 'Slab (2)', 'cat-9')
    const ids = copies.map((m) => m.id)
    expect(ids).not.toContain('src-1')
    expect(ids).not.toContain('src-2')
    expect(new Set(ids).size).toBe(2) // all unique
  })

  it('renames every copy and applies the target categoryId', () => {
    const src: Markup[] = [makeArea('Slab', { categoryId: 'cat-1' })]
    const [copy] = snapshotGroup(src, 'Slab (2)', 'cat-9')
    expect(copy.name).toBe('Slab (2)')
    expect(copy.categoryId).toBe('cat-9')
  })

  it('falls back to the source categoryId when targetCategoryId is null (Duplicate in place)', () => {
    const src: Markup[] = [makeArea('Slab', { categoryId: 'cat-1' })]
    const [copy] = snapshotGroup(src, 'Slab (2)', null)
    expect(copy.categoryId).toBe('cat-1')
  })

  it('assigns fresh per-page count sequences (1..k), never the source sequence (Pitfall 6)', () => {
    const src: Markup[] = [
      makeCount('Pin', { page: 1, sequence: 7 }),
      makeCount('Pin', { page: 1, sequence: 9 }),
      makeCount('Pin', { page: 2, sequence: 4 })
    ]
    const copies = snapshotGroup(src, 'Pin (2)', 'cat-1') as CountMarkup[]
    const page1 = copies.filter((m) => m.page === 1).map((m) => m.sequence)
    const page2 = copies.filter((m) => m.page === 2).map((m) => m.sequence)
    expect(page1).toEqual([1, 2]) // fresh 1..k on page 1
    expect(page2).toEqual([1]) // fresh 1 on page 2
  })

  it('deep-clones points and arcs so later source edits never touch the copy', () => {
    const src: Markup[] = [
      makeArea('Slab', {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ],
        arcs: { 0: { midX: 5, midY: -2 } }
      })
    ]
    const [copy] = snapshotGroup(src, 'Slab (2)', 'cat-1') as AreaMarkup[]
    // Distinct array/object identities.
    const srcArea = src[0] as AreaMarkup
    expect(copy.points).not.toBe(srcArea.points)
    expect(copy.points[0]).not.toBe(srcArea.points[0])
    expect(copy.arcs).not.toBe(srcArea.arcs)
    // Mutating the source after snapshot leaves the copy intact.
    srcArea.points[0].x = 999
    srcArea.arcs![0].midX = 999
    expect(copy.points[0].x).toBe(0)
    expect(copy.arcs![0].midX).toBe(5)
  })
})
