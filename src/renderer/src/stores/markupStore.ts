import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Markup, Category, MarkupCommand, CountMarkup } from '../types/markup'
import { CATEGORY_PALETTE, UNDO_STACK_MAX } from '../types/markup'
import type { StagePoint } from '../hooks/useCalibrationMode'

interface MarkupStoreState {
  pageMarkups: Record<number, Markup[]>
  categories: Record<string, Category>
  categoryOrder: string[]
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
    newPoint: StagePoint
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
  getColorForName: (name: string, page?: number) => string | null

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  hydrate: (data: {
    pageMarkups: Record<number, Markup[]>
    categories: Record<string, Category>
    categoryOrder: string[]
  }) => void
  reset: () => void
}

function pushCommand(stack: MarkupCommand[], cmd: MarkupCommand): MarkupCommand[] {
  const next = [...stack, cmd]
  return next.length > UNDO_STACK_MAX ? next.slice(next.length - UNDO_STACK_MAX) : next
}

export const useMarkupStore = create<MarkupStoreState>()(
  subscribeWithSelector((set, get) => ({
  pageMarkups: {},
  categories: {},
  categoryOrder: [],
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

  moveVertex: (markupId, page, vertexIndex, newPoint) =>
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
      const updated: Markup = { ...target, points: updatedPoints } as Markup
      const nextPageList = pageList.map((m) => (m.id === markupId ? updated : m))

      const cmd: MarkupCommand = {
        type: 'move-vertex',
        markupId,
        page,
        vertexIndex,
        oldPoint,
        newPoint
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
        const nextList = pageList.map((m) => {
          if (m.id !== cmd.markupId) return m
          if (m.type === 'count') return m // defensive: count has no points[]
          const restoredPoints: StagePoint[] = [
            ...m.points.slice(0, cmd.vertexIndex),
            cmd.oldPoint,
            ...m.points.slice(cmd.vertexIndex + 1)
          ]
          return { ...m, points: restoredPoints } as Markup
        })
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
        const nextList = pageList.map((m) => {
          if (m.id !== cmd.markupId) return m
          if (m.type === 'count') return m // defensive: count has no points[]
          const reappliedPoints: StagePoint[] = [
            ...m.points.slice(0, cmd.vertexIndex),
            cmd.newPoint,
            ...m.points.slice(cmd.vertexIndex + 1)
          ]
          return { ...m, points: reappliedPoints } as Markup
        })
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

  hydrate: (data) =>
    set({
      pageMarkups: data.pageMarkups,
      categories: data.categories,
      categoryOrder: data.categoryOrder,
      undoStack: [],
      redoStack: []
    }),

  reset: () =>
    set({
      pageMarkups: {},
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })
}))
)
