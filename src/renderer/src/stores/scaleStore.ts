import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PageScale, ScaleUnit, CalibMode } from '../types/scale'
import { DEFAULT_UNIT } from '../types/scale'

interface ScaleStoreState {
  pageScales: Record<number, PageScale>
  globalUnit: ScaleUnit
  calibMode: CalibMode

  setScale: (page: number, pixelsPerMm: number, displayUnit: ScaleUnit) => void
  getScale: (page: number) => PageScale | null
  clearScale: (page: number) => void
  setGlobalUnit: (unit: ScaleUnit) => void
  setCalibMode: (mode: CalibMode) => void

  hydrate: (data: { pageScales: Record<number, PageScale>; globalUnit: ScaleUnit }) => void
  reset: () => void
}

export const useScaleStore = create<ScaleStoreState>()(
  subscribeWithSelector((set, get) => ({
    pageScales: {},
    globalUnit: DEFAULT_UNIT,
    calibMode: 'idle',

    setScale: (page, pixelsPerMm, displayUnit) =>
      set((state) => ({
        pageScales: {
          ...state.pageScales,
          [page]: { pixelsPerMm, displayUnit }
        }
      })),

    getScale: (page) => get().pageScales[page] ?? null,

    clearScale: (page) =>
      set((state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [page]: _removed, ...rest } = state.pageScales
        return { pageScales: rest }
      }),

    setGlobalUnit: (unit) => set({ globalUnit: unit }),

    setCalibMode: (mode) => set({ calibMode: mode }),

    hydrate: (data) =>
      set({ pageScales: data.pageScales, globalUnit: data.globalUnit, calibMode: 'idle' }),

    reset: () =>
      set({ pageScales: {}, globalUnit: DEFAULT_UNIT, calibMode: 'idle' })
  }))
)
