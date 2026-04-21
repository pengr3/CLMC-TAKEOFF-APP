import { useCallback, useState, useRef, RefObject } from 'react'
import Konva from 'konva'
import type { StagePoint } from './useCalibrationMode'
import { useMarkupStore } from '../stores/markupStore'
import { useViewerStore } from '../stores/viewerStore'
import type { CountMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup } from '../types/markup'
import { polygonCentroid } from '../lib/markup-math'
import { MARKUP_PALETTE } from '../lib/markup-palette'

const UNCATEGORIZED = 'Uncategorized'
const DUPLICATE_POINT_EPSILON = 2 // stage-pixel threshold for de-duping dblclick duplicate point (Pitfall 1)

export interface MarkupDrawState {
  mode: 'idle' | 'naming' | 'drawing' | 'confirming' | 'placing'
  toolType: 'count' | 'linear' | 'area' | 'perimeter' | null
  points: StagePoint[]
  previewPoint: StagePoint | null
  popupScreenPos: { x: number; y: number } | null
  pendingName: string
  pendingCategoryName: string
  pendingColor: string // D-28 — color chosen in popup before placement
  pendingPage: number | null
  errorToast: string | null
}

const INITIAL_STATE: MarkupDrawState = {
  mode: 'idle',
  toolType: null,
  points: [],
  previewPoint: null,
  popupScreenPos: null,
  pendingName: '',
  pendingCategoryName: '',
  pendingColor: MARKUP_PALETTE[0],
  pendingPage: null,
  errorToast: null
}

function screenToStagePoint(stage: Konva.Stage, sx: number, sy: number): StagePoint {
  const transform = stage.getAbsoluteTransform().copy().invert()
  return transform.point({ x: sx, y: sy })
}

function stageToScreenPoint(stage: Konva.Stage, p: StagePoint): { x: number; y: number } {
  const transform = stage.getAbsoluteTransform().copy()
  return transform.point(p)
}

function distanceSquared(a: StagePoint, b: StagePoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export interface UseMarkupToolReturn {
  state: MarkupDrawState
  activate: (tool: 'count' | 'linear' | 'area' | 'perimeter') => void
  cancel: () => void
  recordClick: (screenPos: { x: number; y: number }) => void
  updatePreview: (screenPos: { x: number; y: number }) => void
  finishLinear: () => void
  finishPolygon: () => void
  commitCountName: (payload: { name: string; categoryName: string; color: string }) => void
  commitShape: (payload: { name: string; categoryName: string; color: string }) => void
  dismissError: () => void
}

export function useMarkupTool(stageRef: RefObject<Konva.Stage | null>): UseMarkupToolReturn {
  const [state, setState] = useState<MarkupDrawState>(INITIAL_STATE)
  // Ref to track last click time (unused in logic but kept for potential future debounce)
  const lastClickTimeRef = useRef<number>(0)

  const activate = useCallback((tool: 'count' | 'linear' | 'area' | 'perimeter') => {
    if (tool === 'count') {
      // Open naming popup immediately before any pin is placed (D-01)
      setState({
        ...INITIAL_STATE,
        mode: 'naming',
        toolType: 'count',
        popupScreenPos: { x: 16, y: 16 }
      })
    } else {
      // Linear, area, perimeter — start drawing immediately
      setState({ ...INITIAL_STATE, mode: 'drawing', toolType: tool })
    }
  }, [])

  const cancel = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  const commitCountName = useCallback((payload: { name: string; categoryName: string; color: string }) => {
    setState((s) => ({
      ...s,
      mode: 'placing',
      pendingName: payload.name,
      pendingCategoryName: payload.categoryName || UNCATEGORIZED,
      pendingColor: payload.color,
      popupScreenPos: null
    }))
  }, [])

  const recordClick = useCallback(
    (screenPos: { x: number; y: number }) => {
      setState((prev) => {
        const stage = stageRef.current
        if (!stage) return prev
        const stagePoint = screenToStagePoint(stage, screenPos.x, screenPos.y)

        if (prev.toolType === 'count' && prev.mode === 'placing') {
          // Place a count pin immediately — stay in placing mode for rapid-fire clicks (D-02)
          const store = useMarkupStore.getState()
          const page = useViewerStore.getState().currentPage
          const category = store.getOrCreateCategory(prev.pendingCategoryName || UNCATEGORIZED)
          const sequence = store.nextCountSequence(page, prev.pendingName)
          const markup: CountMarkup = {
            id: crypto.randomUUID(),
            type: 'count',
            page,
            name: prev.pendingName,
            categoryId: category.id,
            color: prev.pendingColor,
            createdAt: Date.now(),
            point: stagePoint,
            sequence
          }
          store.placeMarkup(markup)
          // Stay in placing mode for subsequent clicks
          return prev
        }

        if (
          prev.mode === 'drawing' &&
          (prev.toolType === 'linear' ||
            prev.toolType === 'area' ||
            prev.toolType === 'perimeter')
        ) {
          // De-duplicate consecutive same-position clicks (Pitfall 1 — dblclick fires two clicks)
          const last = prev.points[prev.points.length - 1]
          if (
            last &&
            distanceSquared(last, stagePoint) < DUPLICATE_POINT_EPSILON * DUPLICATE_POINT_EPSILON
          ) {
            return prev
          }
          return {
            ...prev,
            points: [...prev.points, stagePoint],
            pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage
          }
        }

        return prev
      })
      lastClickTimeRef.current = Date.now()
    },
    [stageRef]
  )

  const updatePreview = useCallback(
    (screenPos: { x: number; y: number }) => {
      setState((prev) => {
        if (prev.mode !== 'drawing') return prev
        if (prev.points.length === 0) return prev
        const stage = stageRef.current
        if (!stage) return prev
        const stagePoint = screenToStagePoint(stage, screenPos.x, screenPos.y)
        return { ...prev, previewPoint: stagePoint }
      })
    },
    [stageRef]
  )

  const finishLinear = useCallback(() => {
    setState((prev) => {
      if (prev.toolType !== 'linear' || prev.mode !== 'drawing') return prev

      // Drop the trailing duplicate click that preceded the dblclick (Pitfall 1)
      let finalPoints = prev.points
      if (finalPoints.length >= 2) {
        const a = finalPoints[finalPoints.length - 2]
        const b = finalPoints[finalPoints.length - 1]
        if (distanceSquared(a, b) < DUPLICATE_POINT_EPSILON * DUPLICATE_POINT_EPSILON) {
          finalPoints = finalPoints.slice(0, -1)
        }
      }

      if (finalPoints.length < 2) {
        return {
          ...prev,
          mode: 'idle',
          points: [],
          previewPoint: null,
          errorToast: 'Add at least two points before ending'
        }
      }

      const stage = stageRef.current
      if (!stage) return prev

      // Place popup near the midpoint of the finished polyline (screen-space)
      const midIndex = Math.floor(finalPoints.length / 2)
      const mid = finalPoints[midIndex]
      const screenMid = stageToScreenPoint(stage, mid)

      return {
        ...prev,
        mode: 'confirming',
        points: finalPoints,
        previewPoint: null,
        popupScreenPos: { x: screenMid.x, y: screenMid.y + 20 },
        pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage
      }
    })
  }, [stageRef])

  const finishPolygon = useCallback(() => {
    setState((prev) => {
      if ((prev.toolType !== 'area' && prev.toolType !== 'perimeter') || prev.mode !== 'drawing') {
        return prev
      }
      if (prev.points.length < 3) {
        return {
          ...prev,
          mode: 'idle',
          points: [],
          previewPoint: null,
          errorToast: 'Add at least three points to close the shape'
        }
      }
      const stage = stageRef.current
      if (!stage) return prev
      const centroid = polygonCentroid(prev.points)
      const screenCentroid = stageToScreenPoint(stage, centroid)
      return {
        ...prev,
        mode: 'confirming',
        previewPoint: null,
        popupScreenPos: { x: screenCentroid.x, y: screenCentroid.y + 20 },
        pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage
      }
    })
  }, [stageRef])

  const commitShape = useCallback((payload: { name: string; categoryName: string; color: string }) => {
    setState((prev) => {
      if (prev.mode !== 'confirming') return prev
      const page = prev.pendingPage ?? useViewerStore.getState().currentPage
      const store = useMarkupStore.getState()
      const category = store.getOrCreateCategory(payload.categoryName || UNCATEGORIZED)
      const id = crypto.randomUUID()
      const createdAt = Date.now()
      const name = payload.name

      const color = payload.color

      if (prev.toolType === 'linear') {
        const m: LinearMarkup = {
          id,
          type: 'linear',
          page,
          name,
          categoryId: category.id,
          color,
          createdAt,
          points: prev.points
        }
        store.placeMarkup(m)
      } else if (prev.toolType === 'area') {
        const m: AreaMarkup = {
          id,
          type: 'area',
          page,
          name,
          categoryId: category.id,
          color,
          createdAt,
          points: prev.points
        }
        store.placeMarkup(m)
      } else if (prev.toolType === 'perimeter') {
        const m: PerimeterMarkup = {
          id,
          type: 'perimeter',
          page,
          name,
          categoryId: category.id,
          color,
          createdAt,
          points: prev.points
        }
        store.placeMarkup(m)
      }

      return INITIAL_STATE
    })
  }, [])

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, errorToast: null }))
  }, [])

  return {
    state,
    activate,
    cancel,
    recordClick,
    updatePreview,
    finishLinear,
    finishPolygon,
    commitCountName,
    commitShape,
    dismissError
  }
}
