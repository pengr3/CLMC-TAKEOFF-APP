import type { StagePoint } from '../hooks/useCalibrationMode'
import type { PriceEntry } from '../lib/boq-types'

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
  | {
      /**
       * Phase 17 (Req 2, D-11): set the persisted per-category manual item order as
       * a single undoable command. `catKey` is a categoryId or '__uncat__'
       * (UNCAT_BUCKET_KEY); `oldOrder`/`newOrder` are ordered lists of `${name}|${type}`
       * bucket keys. Single-store command (order lives in markupStore) — no projectStore
       * side-payload, unlike rename/copy/duplicate.
       */
      type: 'reorder-items'
      catKey: string
      oldOrder: string[]
      newOrder: string[]
    }
  | {
      /**
       * Phase 17 (Req 1, D-03/D-04): rename every markup in a group across all pages
       * and atomically re-key the three name-keyed structures. `markupIdsAffected`
       * are the ids whose `.name` flips (mirrors recolor-group's per-id discipline).
       * `rateReKeys` moves `${old}|${type}` → `${new}|${type}` in projectStore.rates
       * PER TYPE present (carrying the moved entry for undo); `hiddenReKeys` moves the
       * COMPOSITE `${old}|${categoryId}` → `${new}|${categoryId}` in hiddenItemNames PER
       * categoryId the group touches (Pitfall 1 — the visibility key is name|categoryId,
       * NOT bare name); `orderReKeys` re-keys `${old}|${type}` → `${new}|${type}` inside
       * each categoryItemOrder array that contains it. The projectStore side (rate/hidden)
       * is applied by applyProjectUndo/applyProjectRedo; the markup + order side is applied
       * in the undo()/redo() set() branch. Per-name color follows automatically (D-03).
       */
      type: 'rename-group'
      oldName: string
      newName: string
      markupIdsAffected: string[]
      rateReKeys: Array<{ oldKey: string; newKey: string; entry: PriceEntry }>
      hiddenReKeys: Array<{ oldKey: string; newKey: string }>
      orderReKeys: Array<{ catKey: string; oldItemKey: string; newItemKey: string }>
    }
  | {
      /**
       * Phase 17 (Req 3, D-06): move a group to another category. Reassigns
       * `categoryId` on every markup in the group; removes the item from the source
       * category's manual order (at `index`, for exact undo re-insertion) and appends
       * it to the target category's order. Single-store (no projectStore payload — name,
       * quantity, color, rate unchanged). Undo/redo branches land in THIS plan so the
       * union stays compile-exhaustive; the FORWARD `moveGroup` action lands in 17-04.
       */
      type: 'move-group'
      markupIdsAffected: string[]
      oldCategoryId: string | null
      newCategoryId: string | null
      orderRemove: Array<{ catKey: string; itemKey: string; index: number }>
      orderAppend: Array<{ catKey: string; itemKey: string }>
    }
  | {
      /**
       * Phase 17 (Req 4, D-07): copy a group into a category as INDEPENDENT new markups
       * (fresh ids + geometry, auto-named, blank rate). `newMarkups` are the full snapshots
       * (mirrors delete-group.markups); `rateKeys` are the blank PriceEntry rows to add on
       * redo / remove on undo (cross-store, applied by applyProjectRedo/applyProjectUndo);
       * `orderAppends` append the new `name|type` keys to categoryItemOrder. Undo/redo
       * branches land in THIS plan; the FORWARD `copyGroup` action lands in 17-04.
       */
      type: 'copy-group'
      newMarkups: Markup[]
      rateKeys: Array<{ key: string; entry: PriceEntry }>
      orderAppends: Array<{ catKey: string; itemKey: string }>
    }
  | {
      /**
       * Phase 17 (Req 5, D-08): duplicate a group in place (same category, auto-named,
       * blank rate, independent snapshot). Identical shape + undo/redo semantics to
       * copy-group; distinct discriminant only so history reads correctly. FORWARD
       * `duplicateGroup` action lands in 17-04.
       */
      type: 'duplicate-group'
      newMarkups: Markup[]
      rateKeys: Array<{ key: string; entry: PriceEntry }>
      orderAppends: Array<{ catKey: string; itemKey: string }>
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
