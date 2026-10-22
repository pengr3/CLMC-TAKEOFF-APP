import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PageScale, ScaleUnit, CalibMode } from '../types/scale'
import { DEFAULT_UNIT } from '../types/scale'
import { requireRateReview } from '../lib/legacy-rate-guard'

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

// Factory kept as a function so the store is created once and REUSED across Vite
// HMR updates (see the import.meta.hot block below). Prevents the dual-instance
// desync that a re-evaluated store module would otherwise cause in dev.
// Return type left to inference (see viewerStore.ts) so ReturnType<> stays exact.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createScaleStore = () =>
  create<ScaleStoreState>()(
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

      setGlobalUnit: (unit) => {
        if (unit !== get().globalUnit && requireRateReview()) return
        set({ globalUnit: unit })
      },

      setCalibMode: (mode) => set({ calibMode: mode }),

      hydrate: (data) =>
        set({ pageScales: data.pageScales, globalUnit: data.globalUnit, calibMode: 'idle' }),

      reset: () => set({ pageScales: {}, globalUnit: DEFAULT_UNIT, calibMode: 'idle' })
    }))
  )

// See viewerStore.ts for the full rationale. Prod build strips this; Vitest falls
// through to `createScaleStore()` (double optional-chain guards the web-transform
// stub whose `import.meta.hot.data` is undefined).
export const useScaleStore =
  (import.meta.hot?.data?.store as ReturnType<typeof createScaleStore> | undefined) ??
  createScaleStore()

if (import.meta.hot) {
  if (import.meta.hot.data) import.meta.hot.data.store = useScaleStore
  import.meta.hot.accept()
}
