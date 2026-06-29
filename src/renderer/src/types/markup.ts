import type { StagePoint } from '../hooks/useCalibrationMode'

export type MarkupType = 'count' | 'linear' | 'area' | 'perimeter' | 'wall'

export interface BaseMarkup {
  id: string
  type: MarkupType
  page: number
  name: string
  categoryId: string
  color: string
  createdAt: number
}

export interface CountMarkup extends BaseMarkup {
  type: 'count'
  point: StagePoint
  sequence: number
}

/**
 * Optional per-edge arc metadata, keyed by the segment's start-vertex index.
 *
 * Edge i→i+1 keys on index `i`. For closed area/perimeter markups the closing
 * edge n-1→0 keys on index `n-1`. Each entry carries the on-arc midpoint
 * (the third point of the 3-point circle solve); the start/end vertices come
 * from `points[i]` / `points[i+1]`.
 *
 * Absence of an entry (or of the whole map) means the edge is straight.
 *
 * Additive in Phase 14 (D-01/D-08): pre-Phase-14 `.clmc` files omit this field
 * entirely and load all-straight. Optional, so `formatVersion` stays at 2 and
 * `validateV2` needs no version bump — same strategy as `hiddenItemNames?`.
 */
export type ArcMap = Record<number, { midX: number; midY: number }>

export interface LinearMarkup extends BaseMarkup {
  type: 'linear'
  points: StagePoint[]
  /** Optional per-edge arc midpoints; absent → all edges straight (additive, no formatVersion bump). */
  arcs?: Record<number, { midX: number; midY: number }>
}

export interface AreaMarkup extends BaseMarkup {
  type: 'area'
  points: StagePoint[]
  /** Optional per-edge arc midpoints; absent → all edges straight (additive, no formatVersion bump). */
  arcs?: Record<number, { midX: number; midY: number }>
}

export interface PerimeterMarkup extends BaseMarkup {
  type: 'perimeter'
  points: StagePoint[]
  /** Optional per-edge arc midpoints; absent → all edges straight (additive, no formatVersion bump). */
  arcs?: Record<number, { midX: number; midY: number }>
}

export interface WallMarkup extends BaseMarkup {
  type: 'wall'
  points: StagePoint[]
  /** millimetres */
  wallHeight: number
  /** Optional per-edge arc midpoints; absent → all edges straight (additive, no formatVersion bump). */
  arcs?: Record<number, { midX: number; midY: number }>
}

export type Markup = CountMarkup | LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup

export interface Category {
  id: string
  name: string
  color: string
  paletteIndex: number
}

export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }
  | { type: 'delete-group'; markups: Markup[] }
  | {
      type: 'recolor-group'
      name: string
      newColor: string
      oldColors: Record<string, string>
      page?: number
      markupIdsAffected: string[]
    }
  | {
      type: 'edit-markup'
      markupId: string
      page: number
      oldName: string
      oldCategoryName: string
      oldColor: string
      newName: string
      newCategoryName: string
      newColor: string
      /** millimetres — present only when editing a WallMarkup */
      oldWallHeight?: number
      /** millimetres — present only when editing a WallMarkup */
      newWallHeight?: number
    }
  | {
      type: 'move-vertex'
      markupId: string
      page: number
      /** 0-based index into markup.points[] */
      vertexIndex: number
      oldPoint: StagePoint
      newPoint: StagePoint
      /**
       * Phase 14 (D-08, W-3): atomic arc re-solve. Present ONLY when the dragged
       * vertex is an endpoint of an arc edge — moving the corner re-bends the arc
       * to pass through the new position. Carrying the arc swap on the SAME
       * move-vertex command guarantees a single Ctrl+Z reverts BOTH the vertex
       * position and the arc curvature (no half-reverted state). Absent for
       * straight-edge vertex drags (unchanged behavior).
       */
      oldArcs?: Record<number, { midX: number; midY: number }>
      newArcs?: Record<number, { midX: number; midY: number }>
    }
  | {
      type: 'reshape-arc'
      markupId: string
      page: number
      /**
       * Full pre-edit arc map (or undefined if the markup had no arcs). Mirrors
       * move-vertex's old/new symmetry so undo restores the exact prior arc state,
       * including removing an arc that the edit added (newArcs set, oldArcs undefined).
       */
      oldArcs?: Record<number, { midX: number; midY: number }>
      /** Full post-edit arc map (or undefined if the edit cleared all arcs). */
      newArcs?: Record<number, { midX: number; midY: number }>
    }
  | {
      type: 'move-markups'
      /**
       * One entry per markup being moved. Single-markup translate and
       * group-move both use this shape (moves.length === 1 vs N).
       * Count pins use oldPoints/newPoints of length 1 — [markup.point].
       */
      moves: Array<{
        markupId: string
        page: number
        oldPoints: StagePoint[]
        newPoints: StagePoint[]
      }>
    }
  | {
      type: 'reopen-recommit'
      /** Original markup that was removed from the page on re-open trigger (D-14). */
      oldMarkup: Markup
      /** New markup committed by Enter after point edits during re-open (D-15). */
      newMarkup: Markup
      /**
       * Page is implicit: oldMarkup.page === newMarkup.page. Re-open never crosses
       * pages (A4 / D-17 condition 5 — same-page guard in the reopen handler).
       */
    }

export const CATEGORY_PALETTE = [
  '#0078d4',
  '#d13438',
  '#107c10',
  '#ca8a04',
  '#5c2d91',
  '#008272',
  '#e3008c',
  '#8e562e'
] as const

export const UNDO_STACK_MAX = 50
export const LABEL_FONT_FLOOR = 10
export const LABEL_FONT_BASE = 14

/**
 * Phase 13 (D-12): true for multi-point markups (linear / area / perimeter / wall),
 * false for count pins. Used by the post-commit re-open trigger to discriminate
 * eligibility without scattered string-literal comparisons.
 *
 * Mirrors the isMarkupTool pattern in src/renderer/src/types/viewer.ts.
 */
export function isMultiPointMarkup(
  markup: Markup
): markup is LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup {
  return markup.type !== 'count'
}
