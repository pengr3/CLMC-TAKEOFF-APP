/**
 * Markup canvas z-order lock (quick-260820-jru).
 *
 * WHY THIS TEST EXISTS — do not "clean up" the block order in CanvasViewport.tsx:
 *
 * Konva paints AND hit-tests sibling nodes in child order (later sibling = on top =
 * wins the click). The five committed-markup render blocks inside Layer 1b are plain
 * sibling JSX expressions, so their SOURCE ORDER is the canvas z-order — and therefore
 * the click priority. This is load-bearing behaviour, not cosmetics.
 *
 * AreaMarkup is the only filled markup type, and a closed + filled Konva Line hit-tests
 * its ENTIRE interior. When the `area` block sat after the `count` block, clicking a
 * count pin placed inside an area selected the AREA instead of the pin — a bug confirmed
 * live in the running app. Sinking `area` to the bottom and floating `count` to the top
 * fixes paint order and hit order at once.
 *
 * These assertions fail if the JSX block order drifts from MARKUP_TYPE_RANK, or if
 * MARKUP_TYPE_RANK is changed without reordering the blocks.
 *
 * This test reads source TEXT and never mounts a component, so it is immune to
 * react-konva mock drift. vitest.config.ts already defaults to environment: 'node',
 * which is all this needs.
 */
import { describe, it, expect } from 'vitest'
import { MARKUP_TYPE_RANK } from '@renderer/types/markup'
import type { MarkupType } from '@renderer/types/markup'

const CANVAS_VIEWPORT_PATH = 'src/renderer/src/components/CanvasViewport.tsx'

/** Marker comment opening Layer 1b — the listening layer holding committed markups. */
const LAYER_1B_MARKER = '{/* Layer 1b: Committed markups'

/**
 * The FULL filter expression is the only per-type token that is unique in the file.
 * The bare `m.type === 'count'` substring appears in three unrelated places and would
 * silently yield a false index.
 */
const blockToken = (type: MarkupType): string =>
  `pageMarkups.filter((m) => m.type === '${type}')`

async function readCanvasViewportSource(): Promise<string> {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const filePath = path.resolve(process.cwd(), CANVAS_VIEWPORT_PATH)
  return fs.readFileSync(filePath, 'utf8')
}

/** Markup types ordered bottom-to-top, derived from the constant itself. */
function typesByAscendingRank(): MarkupType[] {
  return (Object.keys(MARKUP_TYPE_RANK) as MarkupType[]).sort(
    (a, b) => MARKUP_TYPE_RANK[a] - MARKUP_TYPE_RANK[b]
  )
}

describe('MARKUP_TYPE_RANK', () => {
  it('covers every markup type with the locked bottom-to-top ranks', () => {
    expect(Object.keys(MARKUP_TYPE_RANK)).toHaveLength(5)
    expect(MARKUP_TYPE_RANK).toEqual({
      area: 0,
      wall: 1,
      perimeter: 2,
      linear: 3,
      count: 4
    })
  })

  it('ranks area LOWEST and count HIGHEST', () => {
    const ranks = Object.values(MARKUP_TYPE_RANK)
    expect(
      MARKUP_TYPE_RANK.area,
      'area must have the lowest rank: it is the only filled markup type, and a ' +
        'closed + filled Konva Line hit-tests its entire interior, so anything ranked ' +
        'below it becomes unclickable wherever an area overlaps it.'
    ).toBe(Math.min(...ranks))
    expect(
      MARKUP_TYPE_RANK.count,
      'count must have the highest rank so pins placed inside an area stay selectable.'
    ).toBe(Math.max(...ranks))
  })
})

describe('CanvasViewport Layer 1b block order', () => {
  it('contains exactly one render block per markup type', async () => {
    const src = await readCanvasViewportSource()
    for (const type of typesByAscendingRank()) {
      const token = blockToken(type)
      const occurrences = src.split(token).length - 1
      expect(
        occurrences,
        `expected exactly one "${token}" block in ${CANVAS_VIEWPORT_PATH}, found ` +
          `${occurrences}. A duplicated or missing block makes the ordering assertion ` +
          'below meaningless.'
      ).toBe(1)
    }
  })

  it('renders the five blocks in ascending MARKUP_TYPE_RANK order', async () => {
    const src = await readCanvasViewportSource()
    const ordered = typesByAscendingRank()
    const indices = ordered.map((type) => src.indexOf(blockToken(type)))

    ordered.forEach((type, i) => {
      expect(
        indices[i],
        `no render block found for markup type '${type}' in ${CANVAS_VIEWPORT_PATH}`
      ).toBeGreaterThan(-1)
    })

    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]
      const curr = ordered[i]
      expect(
        indices[i],
        `'${curr}' (rank ${MARKUP_TYPE_RANK[curr]}) must render AFTER '${prev}' ` +
          `(rank ${MARKUP_TYPE_RANK[prev]}) in ${CANVAS_VIEWPORT_PATH}. Konva paints and ` +
          'hit-tests siblings in child order, so block order IS z-order and click ' +
          'priority. Either the JSX blocks or MARKUP_TYPE_RANK has drifted — fix both ' +
          'together.'
      ).toBeGreaterThan(indices[i - 1])
    }
  })

  it('places all five blocks inside Layer 1b', async () => {
    const src = await readCanvasViewportSource()
    const markerIdx = src.indexOf(LAYER_1B_MARKER)
    expect(
      markerIdx,
      `Layer 1b marker comment "${LAYER_1B_MARKER}" not found in ${CANVAS_VIEWPORT_PATH}`
    ).toBeGreaterThan(-1)

    for (const type of typesByAscendingRank()) {
      expect(
        src.indexOf(blockToken(type)),
        `the '${type}' render block must sit inside Layer 1b (after the marker comment)`
      ).toBeGreaterThan(markerIdx)
    }
  })
})
