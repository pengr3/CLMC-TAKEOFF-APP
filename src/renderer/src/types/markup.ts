import type { StagePoint } from '../hooks/useCalibrationMode'

export type MarkupType = 'count' | 'linear' | 'area' | 'perimeter'

export interface BaseMarkup {
  id: string
  type: MarkupType
  page: number
  name: string
  categoryId: string
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

export type Markup = CountMarkup | LinearMarkup | AreaMarkup | PerimeterMarkup

export interface Category {
  id: string
  name: string
  color: string
  paletteIndex: number
}

export type MarkupCommand =
  | { type: 'place'; markup: Markup }
  | { type: 'delete'; markup: Markup }

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
export const LABEL_FONT_BASE = 12
