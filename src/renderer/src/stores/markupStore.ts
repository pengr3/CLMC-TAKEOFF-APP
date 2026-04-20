import { create } from 'zustand'
import type { Markup, Category, MarkupCommand, CountMarkup } from '../types/markup'
import { CATEGORY_PALETTE, UNDO_STACK_MAX } from '../types/markup'

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

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

function pushCommand(stack: MarkupCommand[], cmd: MarkupCommand): MarkupCommand[] {
  const next = [...stack, cmd]
  return next.length > UNDO_STACK_MAX ? next.slice(next.length - UNDO_STACK_MAX) : next
}

export const useMarkupStore = create<MarkupStoreState>((set, get) => ({
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

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s
      const cmd = s.undoStack[s.undoStack.length - 1]
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
  canRedo: () => get().redoStack.length > 0
}))
