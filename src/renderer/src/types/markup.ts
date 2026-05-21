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

export interface LinearMarkup extends BaseMarkup {
  type: 'linear'
  points: StagePoint[]
}

export interface AreaMarkup extends BaseMarkup {
  type: 'area'
  points: StagePoint[]
}

export interface PerimeterMarkup extends BaseMarkup {
  type: 'perimeter'
  points: StagePoint[]
}

export interface WallMarkup extends BaseMarkup {
  type: 'wall'
  points: StagePoint[]
  /** millimetres */
  wallHeight: number
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
