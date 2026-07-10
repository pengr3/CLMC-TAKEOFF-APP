import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Markup, Category, MarkupCommand, CountMarkup } from '../types/markup'
import { CATEGORY_PALETTE, UNDO_STACK_MAX } from '../types/markup'
import type { StagePoint } from '../hooks/useCalibrationMode'
import { setReopenSnapshot } from '../lib/markup-reopen-ref'

interface MarkupStoreState {
  pageMarkups: Record<number, Markup[]>
  categories: Record<string, Category>
  categoryOrder: string[]
  /**
   * Phase 17 (Req 2, D-11): persisted per-category manual item order. Key is a
   * categoryId or '__uncat__' (UNCAT_BUCKET_KEY); value is the ordered list of
   * `${name}|${type}` bucket keys. Consumed by aggregateBoq to order rows (replacing
   * the former alphabetical sort). Absent key → placement order. Additive in the
   * .clmc (no formatVersion bump); mirrors categoryOrder's wiring.
   */
  categoryItemOrder: Record<string, string[]>
  undoStack: MarkupCommand[]
  redoStack: MarkupCommand[]

  getMarkups: (page: number) => Markup[]
  findCategoryByName: (name: string) => Category | null
  getCategory: (id: string) => Category | null
  getAllCategories: () => Category[]
  nextCountSequence: (page: number, name: string) => number

  getOrCreateCategory: (name: string) => Category
  placeMarkup: (markup: Markup) => void
  deleteMarkup: (page: number, markupId: string) => void
  /**
   * Delete a group of markups as a single undoable command (D-09).
   * Pushes one 'delete-group' command onto the undoStack — undo() restores
   * every markup to its original page; redo() re-removes them.
   *
   * Empty array is a no-op (no command pushed). Selection-clear in the
   * keyboard handler (Plan 02) is the caller's responsibility; this action
   * does not reach into viewerStore (cross-store coupling avoided).
   */
  deleteGroup: (markups: Markup[]) => void
  recolorGroup: (name: string, newColor: string, page?: number) => void
  /**
   * Phase 17 (Req 2): set the persisted manual item order for a category as a single
   * undoable command. `catKey` is a categoryId or '__uncat__'; `newOrder` is the
   * ordered list of `${name}|${type}` bucket keys. Defensive no-op (no command
   * pushed, state reference unchanged) when the order is unchanged. undo() restores
   * the prior order; redo() re-applies. Single-store command — mirrors recolorGroup's
   * push-one-command / clear-redo discipline.
   */
  reorderItems: (catKey: string, newOrder: string[]) => void
  editMarkup: (
    markupId: string,
    page: number,
    oldName: string,
    oldCategoryName: string,
    oldColor: string,
    newName: string,
    newCategoryName: string,
    newColor: string,
    oldWallHeight?: number,
    newWallHeight?: number
  ) => void
  /**
   * Move a single vertex of a non-count markup (linear/area/perimeter/wall).
   * Pushes one 'move-vertex' command onto undoStack, clears redoStack.
   * Defensive no-op on unknown markupId. Caller is responsible for ensuring
   * the markup is not a count pin (count markups have `point`, not `points[]`).
   */
  moveVertex: (
    markupId: string,
    page: number,
    vertexIndex: number,
    newPoint: StagePoint,
    /**
     * Phase 14 (D-08): atomic arc re-solve. When the dragged vertex is an arc
     * edge's endpoint, pass the re-solved full arc map so the points swap and the
     * arcs swap ride in ONE command (one Ctrl+Z reverts both). Omit for straight
     * edges. `oldArcs` is captured from the markup's current `arcs` field.
     */
    newArcs?: Record<number, { midX: number; midY: number }>
  ) => void
  /**
   * Replace the full per-edge arc map of a non-count markup (D-08, bulge reshape).
   * Pushes one 'reshape-arc' command onto undoStack (carrying the symmetric
   * oldArcs/newArcs), clears redoStack. Defensive no-op on unknown markupId or a
   * count pin. Mirrors moveVertex's dispatch shape: ONE command, redoStack reset.
   *
   * `newArcs` may be undefined to clear all arcs (revert every edge to straight);
   * `oldArcs` is captured from the markup's current `arcs` field so undo restores
   * the exact prior state — including removing an arc the edit added.
   */
  reshapeArc: (
    markupId: string,
    page: number,
    newArcs?: Record<number, { midX: number; midY: number }>
  ) => void
  /**
   * Translate one or more markups by replacing their points/point with the
   * supplied new values. Single-markup translate (moves.length === 1) and
   * group-move (moves.length === N) both push exactly one 'move-markups'
   * command onto undoStack and clear redoStack. Empty array is a no-op.
   *
   * For count pins: callers normalise the move as `oldPoints: [markup.point]`
   * and `newPoints: [newPoint]`. The store detects count type and writes
   * `markup.point` instead of `markup.points`.
   */
  moveMarkups: (
    moves: Array<{
      markupId: string
      page: number
      oldPoints: StagePoint[]
      newPoints: StagePoint[]
    }>
  ) => void
  /** Phase 13 (D-16): single-command commit of a re-opened markup. */
  commitReopen: (oldMarkup: Markup, newMarkup: Markup) => void
  /** Phase 13 (D-14): silent removal at re-open trigger time. NOT a command. */
  removeForReopen: (markup: Markup) => void
  /** Phase 13 (D-14): silent restoration on Esc-cancel of re-open. NOT a command. */
  restoreFromReopen: (markup: Markup) => void
  /** Phase 13 (WR-01): re-push a place command via pushCommand so UNDO_STACK_MAX is respected. */
  repushPlaceForReopenCancel: (markup: Markup) => void
  getColorForName: (name: string, page?: number) => string | null

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  hydrate: (data: {
    pageMarkups: Record<number, Markup[]>
    categories: Record<string, Category>
    categoryOrder: string[]
    /**
     * Phase 17 (Req 2): optional so pre-Phase-17 callers (and any that omit it)
     * still compile; the store coerces an absent value to {} on set. project-serialize
     * passes the V5-coerced order here.
     */
    categoryItemOrder?: Record<string, string[]>
  }) => void
  reset: () => void
}

function pushCommand(stack: MarkupCommand[], cmd: MarkupCommand): MarkupCommand[] {
  const next = [...stack, cmd]
  return next.length > UNDO_STACK_MAX ? next.slice(next.length - UNDO_STACK_MAX) : next
}

/**
 * Order-sensitive shallow equality for the reorderItems no-op guard (Phase 17).
 * Two orders are equal iff same length and same elements in the same positions.
 */
function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Return a copy of `markup` with its `arcs` field set to `arcs` (or removed
 * entirely when `arcs` is undefined). Count pins are returned unchanged (they
 * carry no edges / arcs field). Shared by the reshape-arc and move-vertex
 * (atomic endpoint re-solve) undo/redo branches so the arcs swap rides in the
 * SAME object the points swap produces — one render, one undo entry.
 */
function withArcs(
  markup: Markup,
  arcs: Record<number, { midX: number; midY: number }> | undefined
): Markup {
  if (markup.type === 'count') return markup
  if (arcs !== undefined) return { ...markup, arcs } as Markup
  const next = { ...markup } as { arcs?: unknown }
  delete next.arcs
  return next as Markup
}

export const useMarkupStore = create<MarkupStoreState>()(
  subscribeWithSelector((set, get) => ({
  pageMarkups: {},
  categories: {},
  categoryOrder: [],
  categoryItemOrder: {},
  undoStack: [],
  redoStack: [],

  getMarkups: (page) => get().pageMarkups[page] ?? [],

  findCategoryByName: (name) => {
    const norm = name.trim().toLowerCase()
    for (const cat of Object.values(get().categories)) {
      if (cat.name.trim().toLowerCase() === norm) return cat
    }
    return null
  },

  getCategory: (id) => get().categories[id] ?? null,

  getAllCategories: () =>
    get().categoryOrder.map((id) => get().categories[id]).filter((c): c is Category => Boolean(c)),

  nextCountSequence: (page, name) => {
    const existing = (get().pageMarkups[page] ?? []).filter(
      (m): m is CountMarkup => m.type === 'count' && m.name === name
    )
    return existing.length === 0 ? 1 : Math.max(...existing.map((m) => m.sequence)) + 1
  },

  getOrCreateCategory: (name) => {
    const existing = get().findCategoryByName(name)
    if (existing) return existing
    const paletteIndex = get().categoryOrder.length % CATEGORY_PALETTE.length
    const id = crypto.randomUUID()
    const cat: Category = {
      id,
      name: name.trim(),
      color: CATEGORY_PALETTE[paletteIndex],
      paletteIndex
    }
    set((s) => ({
      categories: { ...s.categories, [id]: cat },
      categoryOrder: [...s.categoryOrder, id]
    }))
    return cat
  },

  placeMarkup: (markup) =>
    set((s) => {
      const pageList = [...(s.pageMarkups[markup.page] ?? []), markup]
      return {
        pageMarkups: { ...s.pageMarkups, [markup.page]: pageList },
        undoStack: pushCommand(s.undoStack, { type: 'place', markup }),
        redoStack: []
      }
    }),

  deleteMarkup: (page, markupId) =>
    set((s) => {
      const pageList = s.pageMarkups[page] ?? []
      const target = pageList.find((m) => m.id === markupId)
      if (!target) return s
      return {
        pageMarkups: { ...s.pageMarkups, [page]: pageList.filter((m) => m.id !== markupId) },
        undoStack: pushCommand(s.undoStack, { type: 'delete', markup: target }),
        redoStack: []
      }
    }),

  deleteGroup: (markups) =>
    set((s) => {
      if (markups.length === 0) return s
      const idSet = new Set(markups.map((m) => m.id))
      const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
      for (const p of Object.keys(nextPageMarkups).map(Number)) {
        nextPageMarkups[p] = (nextPageMarkups[p] ?? []).filter((m) => !idSet.has(m.id))
      }
      return {
        pageMarkups: nextPageMarkups,
        undoStack: pushCommand(s.undoStack, { type: 'delete-group', markups }),
        redoStack: []
      }
    }),

  recolorGroup: (name, newColor, page) =>
    set((s) => {
      const pagesToScan =
        page !== undefined ? [page] : Object.keys(s.pageMarkups).map(Number)
      const oldColors: Record<string, string> = {}
      const idsAffected: string[] = []
      const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }

      for (const p of pagesToScan) {
        const list = s.pageMarkups[p] ?? []
        const updated = list.map((m) => {
          if (m.name === name && m.color !== newColor) {
            oldColors[m.id] = m.color
            idsAffected.push(m.id)
            return { ...m, color: newColor } as Markup
          }
          return m
        })
        nextPageMarkups[p] = updated
      }

      if (idsAffected.length === 0) return s

      const cmd: MarkupCommand = {
        type: 'recolor-group',
        name,
        newColor,
        oldColors,
        page,
        markupIdsAffected: idsAffected
      }
      return {
        pageMarkups: nextPageMarkups,
        undoStack: pushCommand(s.undoStack, cmd),
        redoStack: []
      }
    }),

  reorderItems: (catKey, newOrder) =>
    set((s) => {
      const oldOrder = s.categoryItemOrder[catKey] ?? []
      // Defensive no-op — an unchanged order pushes no command and leaves the state
      // reference intact (mirrors recolorGroup's `idsAffected.length === 0` guard).
      if (arraysEqual(oldOrder, newOrder)) return s
      const cmd: MarkupCommand = { type: 'reorder-items', catKey, oldOrder, newOrder }
      return {
        categoryItemOrder: { ...s.categoryItemOrder, [catKey]: newOrder },
        undoStack: pushCommand(s.undoStack, cmd),
        redoStack: []
      }
    }),

  editMarkup: (markupId, page, oldName, oldCategoryName, oldColor, newName, newCategoryName, newColor, oldWallHeight?, newWallHeight?) => {
    // Resolve category BEFORE entering set() — avoids nested set() calls
    const newCat = get().getOrCreateCategory(newCategoryName)
    set((s) => {
      const pageList = s.pageMarkups[page] ?? []
      const target = pageList.find((m) => m.id === markupId)
      if (!target) return s // defensive no-op (mirrors deleteMarkup pattern)

      const updated: Markup = {
        ...target,
        name: newName,
        categoryId: newCat.id,
        color: newColor,
        ...(newWallHeight !== undefined ? { wallHeight: newWallHeight } : {})
      }
      const nextPageList = pageList.map((m) => (m.id === markupId ? updated : m))

      const cmd: MarkupCommand = {
        type: 'edit-markup',
        markupId,
        page,
        oldName,
        oldCategoryName,
        oldColor,
        newName,
        newCategoryName,
        newColor,
        ...(oldWallHeight !== undefined ? { oldWallHeight, newWallHeight } : {})
      }
      return {
        pageMarkups: { ...s.pageMarkups, [page]: nextPageList },
        undoStack: pushCommand(s.undoStack, cmd),
        redoStack: []
      }
    })
  },

  moveVertex: (markupId, page, vertexIndex, newPoint, newArcs) =>
    set((s) => {
      const pageList = s.pageMarkups[page] ?? []
      const target = pageList.find((m) => m.id === markupId)
      if (!target) return s // defensive no-op (mirrors deleteMarkup pattern)

      // move-vertex is undefined for count markups (no points[] field). Caller
      // is responsible for not calling moveVertex on a count pin; defensively
      // bail if the discriminant is wrong rather than throwing.
      if (target.type === 'count') return s

      const oldPoint = target.points[vertexIndex]
      const updatedPoints: StagePoint[] = [
        ...target.points.slice(0, vertexIndex),
        newPoint,
        ...target.points.slice(vertexIndex + 1)
      ]
      // Phase 14 (D-08): when an arc re-solve rides along, capture the prior arc
      // map and swap to the new one in the SAME object the points swap produces.
      const arcReshape = newArcs !== undefined
      const oldArcs = arcReshape ? target.arcs : undefined
      const base: Markup = { ...target, points: updatedPoints } as Markup
      const updated: Markup = arcReshape ? withArcs(base, newArcs) : base
      const nextPageList = pageList.map((m) => (m.id === markupId ? updated : m))

      const cmd: MarkupCommand = {
        type: 'move-vertex',
        markupId,
        page,
        vertexIndex,
        oldPoint,
        newPoint,
        ...(arcReshape ? { oldArcs, newArcs } : {})
      }
      return {
        pageMarkups: { ...s.pageMarkups, [page]: nextPageList },
        undoStack: pushCommand(s.undoStack, cmd),
        redoStack: []
      }
    }),

  reshapeArc: (markupId, page, newArcs) =>
    set((s) => {
      const pageList = s.pageMarkups[page] ?? []
      const target = pageList.find((m) => m.id === markupId)
      if (!target) return s // defensive no-op (mirrors moveVertex pattern)
      // reshape-arc is undefined for count markups (no edges / no arcs field).
      if (target.type === 'count') return s

      const oldArcs = target.arcs
      // Apply the new arcs map (or remove the field entirely when clearing all arcs).
      const updated: Markup = (
        newArcs !== undefined ? { ...target, arcs: newArcs } : { ...target }
      ) as Markup
      if (newArcs === undefined && 'arcs' in updated) {
        delete (updated as { arcs?: unknown }).arcs
      }
      const nextPageList = pageList.map((m) => (m.id === markupId ? updated : m))

      const cmd: MarkupCommand = {
        type: 'reshape-arc',
        markupId,
        page,
        oldArcs,
        newArcs
      }
      return {
        pageMarkups: { ...s.pageMarkups, [page]: nextPageList },
        undoStack: pushCommand(s.undoStack, cmd),
        redoStack: []
      }
    }),

  moveMarkups: (moves) =>
    set((s) => {
      if (moves.length === 0) return s

      const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
      for (const move of moves) {
        const pageList = nextPageMarkups[move.page] ?? []
        nextPageMarkups[move.page] = pageList.map((m) => {
          if (m.id !== move.markupId) return m
          if (m.type === 'count') {
            return { ...m, point: move.newPoints[0] } as Markup
          }
          return { ...m, points: move.newPoints } as Markup
        })
      }

      const cmd: MarkupCommand = {
        type: 'move-markups',
        moves: moves.map((m) => ({
          markupId: m.markupId,
          page: m.page,
          oldPoints: m.oldPoints,
          newPoints: m.newPoints
        }))
      }
      return {
        pageMarkups: nextPageMarkups,
        undoStack: pushCommand(s.undoStack, cmd),
        redoStack: []
      }
    }),

  // Phase 13 (D-14, D-16): commit a re-opened markup as a single 'reopen-recommit' command.
  // Replaces oldMarkup with newMarkup in pageMarkups; pushes ONE command; clears redoStack.
  // Idempotent w.r.t. oldMarkup presence — the caller (commitShape via reopen-ref) may
  // call after removeForReopen has already taken the markup off the page.
  commitReopen: (oldMarkup, newMarkup) =>
    set((s) => {
      const page = oldMarkup.page
      const pageList = s.pageMarkups[page] ?? []
      const filtered = pageList.filter((m) => m.id !== oldMarkup.id)
      return {
        pageMarkups: { ...s.pageMarkups, [page]: [...filtered, newMarkup] },
        undoStack: pushCommand(s.undoStack, { type: 'reopen-recommit', oldMarkup, newMarkup }),
        redoStack: []
      }
    }),

  // Phase 13 (D-14): silently remove a markup for the re-open gesture. NOT a command —
  // the snapshot in markup-reopen-ref IS the recovery path. Distinct from deleteMarkup,
  // which DOES push a 'delete' command. Defensive no-op if the markup is not present.
  removeForReopen: (markup) =>
    set((s) => {
      const page = markup.page
      const pageList = s.pageMarkups[page] ?? []
      if (!pageList.some((m) => m.id === markup.id)) return s
      return {
        pageMarkups: { ...s.pageMarkups, [page]: pageList.filter((m) => m.id !== markup.id) }
      }
    }),

  // Phase 13 (D-14, D-16): silently re-add a markup on Esc-cancel of a re-open gesture.
  // NOT a command. Idempotent — duplicate ids are not added twice.
  restoreFromReopen: (markup) =>
    set((s) => {
      const page = markup.page
      const pageList = s.pageMarkups[page] ?? []
      if (pageList.some((m) => m.id === markup.id)) return s
      return {
        pageMarkups: { ...s.pageMarkups, [page]: [...pageList, markup] }
      }
    }),

  // Phase 13 (WR-01): re-push a place command through pushCommand so UNDO_STACK_MAX
  // is respected. Direct setState callers bypass the cap; routing through this action
  // keeps the 50-command discipline enforced uniformly.
  repushPlaceForReopenCancel: (markup) =>
    set((s) => ({ undoStack: pushCommand(s.undoStack, { type: 'place', markup }) })),

  getColorForName: (name, page) => {
    const pagesToScan =
      page !== undefined ? [page] : Object.keys(get().pageMarkups).map(Number)
    let latest: Markup | null = null
    for (const p of pagesToScan) {
      for (const m of get().pageMarkups[p] ?? []) {
        if (m.name === name) {
          if (!latest || m.createdAt > latest.createdAt) latest = m
        }
      }
    }
    return latest ? latest.color : null
  },

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s
      const cmd = s.undoStack[s.undoStack.length - 1]

      if (cmd.type === 'recolor-group') {
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        const pagesToScan =
          cmd.page !== undefined ? [cmd.page] : Object.keys(s.pageMarkups).map(Number)
        for (const p of pagesToScan) {
          const list = s.pageMarkups[p] ?? []
          nextPageMarkups[p] = list.map((m) =>
            cmd.oldColors[m.id] !== undefined
              ? ({ ...m, color: cmd.oldColors[m.id] } as Markup)
              : m
          )
        }
        return {
          pageMarkups: nextPageMarkups,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      if (cmd.type === 'edit-markup') {
        const oldCat = get().getOrCreateCategory(cmd.oldCategoryName)
        const pageList = s.pageMarkups[cmd.page] ?? []
        const nextList = pageList.map((m) =>
          m.id === cmd.markupId
            ? ({
                ...m,
                name: cmd.oldName,
                categoryId: oldCat.id,
                color: cmd.oldColor,
                ...(cmd.oldWallHeight !== undefined ? { wallHeight: cmd.oldWallHeight } : {})
              } as Markup)
            : m
        )
        return {
          pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      // move-vertex / move-markups branches MUST come BEFORE the
      // `cmd.markup.page` fallthrough below — they carry their own page info
      // and have no `cmd.markup` field.
      if (cmd.type === 'move-vertex') {
        const pageList = s.pageMarkups[cmd.page] ?? []
        // Phase 14 (D-08): if this move-vertex carried an atomic arc re-solve
        // (oldArcs/newArcs present), restore the points AND the prior arc map in
        // the SAME object — one Ctrl+Z reverts both the corner and the curve.
        const arcReshape = 'newArcs' in cmd
        const nextList = pageList.map((m) => {
          if (m.id !== cmd.markupId) return m
          if (m.type === 'count') return m // defensive: count has no points[]
          const restoredPoints: StagePoint[] = [
            ...m.points.slice(0, cmd.vertexIndex),
            cmd.oldPoint,
            ...m.points.slice(cmd.vertexIndex + 1)
          ]
          const withPoints = { ...m, points: restoredPoints } as Markup
          return arcReshape ? withArcs(withPoints, cmd.oldArcs) : withPoints
        })
        return {
          pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      // reshape-arc branch MUST come BEFORE the `cmd.markup.page` fallthrough —
      // it carries its own page info and has no `cmd.markup` field. Undo restores
      // the FULL prior arc map (oldArcs), including removing an arc the edit added.
      if (cmd.type === 'reshape-arc') {
        const pageList = s.pageMarkups[cmd.page] ?? []
        const nextList = pageList.map((m) =>
          m.id === cmd.markupId ? withArcs(m, cmd.oldArcs) : m
        )
        return {
          pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      if (cmd.type === 'move-markups') {
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const move of cmd.moves) {
          const pageList = nextPageMarkups[move.page] ?? []
          nextPageMarkups[move.page] = pageList.map((m) => {
            if (m.id !== move.markupId) return m
            if (m.type === 'count') {
              return { ...m, point: move.oldPoints[0] } as Markup
            }
            return { ...m, points: move.oldPoints } as Markup
          })
        }
        return {
          pageMarkups: nextPageMarkups,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      // delete-group branch MUST come BEFORE the `cmd.markup.page` access
      // below — delete-group carries `markups` (plural), not `markup`.
      if (cmd.type === 'delete-group') {
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const m of cmd.markups) {
          nextPageMarkups[m.page] = [...(nextPageMarkups[m.page] ?? []), m]
        }
        return {
          pageMarkups: nextPageMarkups,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      // Phase 13 (D-14, D-16): reopen-recommit branch MUST come BEFORE the
      // `cmd.markup.page` access below — reopen-recommit carries `oldMarkup`
      // and `newMarkup`, not `markup`. Undo removes newMarkup (added on commit),
      // re-adds oldMarkup (removed at re-open trigger).
      if (cmd.type === 'reopen-recommit') {
        const page = cmd.oldMarkup.page
        const pageList = s.pageMarkups[page] ?? []
        const filtered = pageList.filter((m) => m.id !== cmd.newMarkup.id)
        return {
          pageMarkups: { ...s.pageMarkups, [page]: [...filtered, cmd.oldMarkup] },
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      // Phase 17 (Req 2): reorder-items branch MUST come BEFORE the `cmd.markup.page`
      // access below — it carries `catKey`/`oldOrder`/`newOrder`, not `markup`. Undo
      // restores the prior per-category order.
      if (cmd.type === 'reorder-items') {
        return {
          categoryItemOrder: { ...s.categoryItemOrder, [cmd.catKey]: cmd.oldOrder },
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      // Phase 17 (Req 1/3/4/5): the whole-group command branches MUST come BEFORE the
      // `cmd.markup.page` fallthrough — none carry a `cmd.markup` field. The projectStore
      // side (rate/hidden re-key for rename; blank-rate add/remove for copy/dup) is applied
      // by applyProjectUndo(cmd) BEFORE this set() (Phase 17-02 Task 2); here we revert
      // ONLY the markupStore side (names / categoryId + categoryItemOrder).
      if (cmd.type === 'rename-group') {
        const idSet = new Set(cmd.markupIdsAffected)
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const p of Object.keys(nextPageMarkups).map(Number)) {
          nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
            idSet.has(m.id) ? ({ ...m, name: cmd.oldName } as Markup) : m
          )
        }
        const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
        for (const rk of cmd.orderReKeys) {
          const arr = nextOrder[rk.catKey]
          if (arr) nextOrder[rk.catKey] = arr.map((k) => (k === rk.newItemKey ? rk.oldItemKey : k))
        }
        return {
          pageMarkups: nextPageMarkups,
          categoryItemOrder: nextOrder,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      if (cmd.type === 'move-group') {
        const idSet = new Set(cmd.markupIdsAffected)
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const p of Object.keys(nextPageMarkups).map(Number)) {
          nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
            idSet.has(m.id) ? ({ ...m, categoryId: cmd.oldCategoryId ?? '' } as Markup) : m
          )
        }
        // Reverse the forward order edit: remove the appended key from the target,
        // then re-insert into the source at the captured index (exact restore).
        const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
        for (const ap of cmd.orderAppend) {
          const arr = nextOrder[ap.catKey]
          if (arr) nextOrder[ap.catKey] = arr.filter((k) => k !== ap.itemKey)
        }
        for (const rm of cmd.orderRemove) {
          const arr = [...(nextOrder[rm.catKey] ?? [])]
          arr.splice(rm.index, 0, rm.itemKey)
          nextOrder[rm.catKey] = arr
        }
        return {
          pageMarkups: nextPageMarkups,
          categoryItemOrder: nextOrder,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      if (cmd.type === 'copy-group' || cmd.type === 'duplicate-group') {
        // Undo the copy: remove the added snapshots and their appended order keys.
        const idSet = new Set(cmd.newMarkups.map((m) => m.id))
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const p of Object.keys(nextPageMarkups).map(Number)) {
          nextPageMarkups[p] = (nextPageMarkups[p] ?? []).filter((m) => !idSet.has(m.id))
        }
        const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
        for (const ap of cmd.orderAppends) {
          const arr = nextOrder[ap.catKey]
          if (arr) nextOrder[ap.catKey] = arr.filter((k) => k !== ap.itemKey)
        }
        return {
          pageMarkups: nextPageMarkups,
          categoryItemOrder: nextOrder,
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, cmd]
        }
      }

      const page = cmd.markup.page
      const pageList = s.pageMarkups[page] ?? []
      let nextList: Markup[]
      if (cmd.type === 'place') {
        nextList = pageList.filter((m) => m.id !== cmd.markup.id)
      } else {
        nextList = [...pageList, cmd.markup]
      }
      return {
        pageMarkups: { ...s.pageMarkups, [page]: nextList },
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, cmd]
      }
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s
      const cmd = s.redoStack[s.redoStack.length - 1]

      if (cmd.type === 'recolor-group') {
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        const pagesToScan =
          cmd.page !== undefined ? [cmd.page] : Object.keys(s.pageMarkups).map(Number)
        for (const p of pagesToScan) {
          const list = s.pageMarkups[p] ?? []
          nextPageMarkups[p] = list.map((m) =>
            cmd.markupIdsAffected.includes(m.id)
              ? ({ ...m, color: cmd.newColor } as Markup)
              : m
          )
        }
        return {
          pageMarkups: nextPageMarkups,
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      if (cmd.type === 'edit-markup') {
        const newCat = get().getOrCreateCategory(cmd.newCategoryName)
        const pageList = s.pageMarkups[cmd.page] ?? []
        const nextList = pageList.map((m) =>
          m.id === cmd.markupId
            ? ({
                ...m,
                name: cmd.newName,
                categoryId: newCat.id,
                color: cmd.newColor,
                ...(cmd.newWallHeight !== undefined ? { wallHeight: cmd.newWallHeight } : {})
              } as Markup)
            : m
        )
        return {
          pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      // move-vertex / move-markups branches MUST come BEFORE the
      // `cmd.markup.page` fallthrough below — they carry their own page info
      // and have no `cmd.markup` field.
      if (cmd.type === 'move-vertex') {
        const pageList = s.pageMarkups[cmd.page] ?? []
        // Phase 14 (D-08): re-apply the new arc map alongside the points when this
        // move-vertex carried an atomic arc re-solve.
        const arcReshape = 'newArcs' in cmd
        const nextList = pageList.map((m) => {
          if (m.id !== cmd.markupId) return m
          if (m.type === 'count') return m // defensive: count has no points[]
          const reappliedPoints: StagePoint[] = [
            ...m.points.slice(0, cmd.vertexIndex),
            cmd.newPoint,
            ...m.points.slice(cmd.vertexIndex + 1)
          ]
          const withPoints = { ...m, points: reappliedPoints } as Markup
          return arcReshape ? withArcs(withPoints, cmd.newArcs) : withPoints
        })
        return {
          pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      // reshape-arc redo re-applies the new arc map (newArcs), mirroring the
      // undo branch above. MUST precede the `cmd.markup.page` fallthrough.
      if (cmd.type === 'reshape-arc') {
        const pageList = s.pageMarkups[cmd.page] ?? []
        const nextList = pageList.map((m) =>
          m.id === cmd.markupId ? withArcs(m, cmd.newArcs) : m
        )
        return {
          pageMarkups: { ...s.pageMarkups, [cmd.page]: nextList },
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      if (cmd.type === 'move-markups') {
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const move of cmd.moves) {
          const pageList = nextPageMarkups[move.page] ?? []
          nextPageMarkups[move.page] = pageList.map((m) => {
            if (m.id !== move.markupId) return m
            if (m.type === 'count') {
              return { ...m, point: move.newPoints[0] } as Markup
            }
            return { ...m, points: move.newPoints } as Markup
          })
        }
        return {
          pageMarkups: nextPageMarkups,
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      // delete-group branch MUST come BEFORE the `cmd.markup.page` access
      // below — delete-group carries `markups` (plural), not `markup`.
      if (cmd.type === 'delete-group') {
        const idSet = new Set(cmd.markups.map((m) => m.id))
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const p of Object.keys(nextPageMarkups).map(Number)) {
          nextPageMarkups[p] = (nextPageMarkups[p] ?? []).filter((m) => !idSet.has(m.id))
        }
        return {
          pageMarkups: nextPageMarkups,
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      // Phase 13 (D-14, D-16): reopen-recommit branch MUST come BEFORE the
      // `cmd.markup.page` access below. Redo re-applies the recommit: remove
      // oldMarkup, add newMarkup, push command back onto undoStack (with cap).
      if (cmd.type === 'reopen-recommit') {
        const page = cmd.oldMarkup.page
        const pageList = s.pageMarkups[page] ?? []
        const filtered = pageList.filter((m) => m.id !== cmd.oldMarkup.id)
        return {
          pageMarkups: { ...s.pageMarkups, [page]: [...filtered, cmd.newMarkup] },
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      // Phase 17 (Req 2): reorder-items redo re-applies the new per-category order,
      // mirroring the undo branch above. MUST precede the `cmd.markup.page` fallthrough.
      if (cmd.type === 'reorder-items') {
        return {
          categoryItemOrder: { ...s.categoryItemOrder, [cmd.catKey]: cmd.newOrder },
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      // Phase 17 (Req 1/3/4/5): whole-group redo branches MUST precede the
      // `cmd.markup.page` fallthrough. The projectStore side is re-applied by
      // applyProjectRedo(cmd) BEFORE this set() (Phase 17-02 Task 2); here we re-apply
      // ONLY the markupStore side (names / categoryId + categoryItemOrder).
      if (cmd.type === 'rename-group') {
        const idSet = new Set(cmd.markupIdsAffected)
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const p of Object.keys(nextPageMarkups).map(Number)) {
          nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
            idSet.has(m.id) ? ({ ...m, name: cmd.newName } as Markup) : m
          )
        }
        const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
        for (const rk of cmd.orderReKeys) {
          const arr = nextOrder[rk.catKey]
          if (arr) nextOrder[rk.catKey] = arr.map((k) => (k === rk.oldItemKey ? rk.newItemKey : k))
        }
        return {
          pageMarkups: nextPageMarkups,
          categoryItemOrder: nextOrder,
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      if (cmd.type === 'move-group') {
        const idSet = new Set(cmd.markupIdsAffected)
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const p of Object.keys(nextPageMarkups).map(Number)) {
          nextPageMarkups[p] = (nextPageMarkups[p] ?? []).map((m) =>
            idSet.has(m.id) ? ({ ...m, categoryId: cmd.newCategoryId ?? '' } as Markup) : m
          )
        }
        const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
        for (const rm of cmd.orderRemove) {
          const arr = nextOrder[rm.catKey]
          if (arr) nextOrder[rm.catKey] = arr.filter((k) => k !== rm.itemKey)
        }
        for (const ap of cmd.orderAppend) {
          nextOrder[ap.catKey] = [...(nextOrder[ap.catKey] ?? []), ap.itemKey]
        }
        return {
          pageMarkups: nextPageMarkups,
          categoryItemOrder: nextOrder,
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      if (cmd.type === 'copy-group' || cmd.type === 'duplicate-group') {
        // Re-apply the copy: re-add the snapshots and re-append their order keys.
        const nextPageMarkups: Record<number, Markup[]> = { ...s.pageMarkups }
        for (const m of cmd.newMarkups) {
          nextPageMarkups[m.page] = [...(nextPageMarkups[m.page] ?? []), m]
        }
        const nextOrder: Record<string, string[]> = { ...s.categoryItemOrder }
        for (const ap of cmd.orderAppends) {
          nextOrder[ap.catKey] = [...(nextOrder[ap.catKey] ?? []), ap.itemKey]
        }
        return {
          pageMarkups: nextPageMarkups,
          categoryItemOrder: nextOrder,
          undoStack: pushCommand(s.undoStack, cmd),
          redoStack: s.redoStack.slice(0, -1)
        }
      }

      const page = cmd.markup.page
      const pageList = s.pageMarkups[page] ?? []
      let nextList: Markup[]
      if (cmd.type === 'place') {
        nextList = [...pageList, cmd.markup]
      } else {
        nextList = pageList.filter((m) => m.id !== cmd.markup.id)
      }
      return {
        pageMarkups: { ...s.pageMarkups, [page]: nextList },
        undoStack: pushCommand(s.undoStack, cmd),
        redoStack: s.redoStack.slice(0, -1)
      }
    }),

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  hydrate: (data) => {
    setReopenSnapshot(null)
    set({
      pageMarkups: data.pageMarkups,
      categories: data.categories,
      categoryOrder: data.categoryOrder,
      categoryItemOrder: data.categoryItemOrder ?? {},
      undoStack: [],
      redoStack: []
    })
  },

  reset: () => {
    setReopenSnapshot(null)
    set({
      pageMarkups: {},
      categories: {},
      categoryOrder: [],
      categoryItemOrder: {},
      undoStack: [],
      redoStack: []
    })
  }
}))
)
