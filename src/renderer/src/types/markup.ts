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
