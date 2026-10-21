import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { autoUniqueName } from '@renderer/lib/group-ops'
import type { AreaMarkup, Category } from '@renderer/types/markup'
import type { PriceEntry } from '@renderer/lib/boq-types'

// ORPHAN-RATE (/code-review 17 --fix): a rate can OUTLIVE its markups (delete never cleans
// rates), so copy/duplicate must not pick an auto-name whose `${name}|${type}` rate key
// already exists — addBlankRate would clobber the orphan and undo would delete it.

const CIVIL = 'cat-civil'
const BLANK: PriceEntry = { material: 0, labor: 0, markup: 30, basis: 'm²', review: 'reviewed' }

function cat(id: string, name: string, paletteIndex: number): Category {
  return { id, name, color: '#123456', paletteIndex }
}
function makeArea(id: string, page: number, name: string, categoryId: string): AreaMarkup {
  return {
    id,
    type: 'area',
    page,
    name,
    categoryId,
    color: '#0078d4',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ],
    createdAt: 2000 + page
  }
}
function rate(material: number, labor: number, markup = 30): PriceEntry {
  return { material, labor, markup }
}
function markupsNamed(name: string): AreaMarkup[] {
  return Object.values(useMarkupStore.getState().pageMarkups)
    .flat()
    .filter((m) => m.name === name) as AreaMarkup[]
}

beforeEach(() => {
  useMarkupStore.getState().reset()
  useProjectStore.getState().reset()
  useScaleStore.getState().reset()
  useViewerStore.setState({ currentPage: 1, totalPages: 1 })
})

describe('ORPHAN-RATE: copy/duplicate skips an auto-name whose rate key is an orphan', () => {
  it('autoUniqueName excludes names present only as rate keys', () => {
    const src = makeArea('slab', 1, 'Slab', CIVIL)
    // "Slab (2)" has no markup but DOES have a rate → must be skipped.
    const name = autoUniqueName('Slab', new Set(['area']), [src], ['Slab (2)|area'])
    expect(name).toBe('Slab (3)')
  })

  it('duplicateGroup does not clobber an orphaned rate at the default auto-name', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeArea('slab', 1, 'Slab', CIVIL)] },
      categories: { [CIVIL]: cat(CIVIL, 'Civil', 0) },
      categoryOrder: [CIVIL],
      categoryItemOrder: { [CIVIL]: ['Slab|area'] },
      undoStack: [],
      redoStack: []
    })
    useProjectStore.setState({ rates: { 'Slab (2)|area': rate(99, 5) } }) // orphan (no markup)

    useMarkupStore.getState().duplicateGroup('Slab')

    // The copy skips "Slab (2)" (taken by the orphan rate) → "Slab (3)".
    expect(markupsNamed('Slab (3)')).toHaveLength(1)
    expect(useProjectStore.getState().rates['Slab (2)|area']).toEqual(rate(99, 5)) // untouched
    expect(useProjectStore.getState().rates['Slab (3)|area']).toEqual(BLANK)
  })
})
