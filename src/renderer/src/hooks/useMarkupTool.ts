import { useCallback, useEffect, useState, useRef, RefObject } from 'react'
import Konva from 'konva'
import type { StagePoint } from './useCalibrationMode'
import { useMarkupStore } from '../stores/markupStore'
import { useViewerStore } from '../stores/viewerStore'
import type { CountMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup, WallMarkup } from '../types/markup'
import { polygonCentroid } from '../lib/markup-math'
import { MARKUP_PALETTE } from '../lib/markup-palette'

const UNCATEGORIZED = 'Uncategorized'
// DUPLICATE_POINT_EPSILON: kept for recordClick de-dup guard. Double-click finish
// is no longer used (Enter-only finish), but rapid-fire clicks at nearly the same
// position should still only place one vertex.
const DUPLICATE_POINT_EPSILON = 2

export interface MarkupDrawState {
  mode: 'idle' | 'naming' | 'drawing' | 'confirming' | 'placing'
  toolType: 'count' | 'linear' | 'area' | 'perimeter' | 'wall' | null
  points: StagePoint[]
  previewPoint: StagePoint | null
  popupScreenPos: { x: number; y: number } | null
  pendingName: string
  pendingCategoryName: string
  pendingColor: string // D-28 — color chosen in popup before placement
  pendingPage: number | null
  errorToast: string | null
  /** true after first commitShape/commitCountName; reset to false by cancel() */
  chainArmed: boolean
  /** millimetres; inherited across chain wall commits; default 2400 */
  pendingWallHeight: number
  /** Points popped by Ctrl+Z during an in-progress draw; cleared on new recordClick */
  redoPoints: StagePoint[]
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
  errorToast: null,
  chainArmed: false,
  pendingWallHeight: 2400,
  redoPoints: []
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
  activate: (tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall') => void
  cancel: () => void
  recordClick: (screenPos: { x: number; y: number }) => void
  updatePreview: (screenPos: { x: number; y: number }) => void
  finishLinear: () => void
  finishPolygon: () => void
  commitCountName: (payload: { name: string; categoryName: string; color: string }) => void
  commitShape: (payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => void
  dismissError: () => void
  // Pop the last vertex of the in-progress linear/area/perimeter draw.
  // Returns true if a point was actually popped (meaning the caller should
  // treat the undo as handled), false otherwise. Used by the global Ctrl+Z
  // handler so mid-draw misclicks can be corrected without undoing a prior
  // committed markup.
  popLastPoint: () => boolean
  repushLastPoint: () => boolean
}

export function useMarkupTool(stageRef: RefObject<Konva.Stage | null>): UseMarkupToolReturn {
  const [state, setState] = useState<MarkupDrawState>(INITIAL_STATE)
  // Ref to track last click time (unused in logic but kept for potential future debounce)
  const lastClickTimeRef = useRef<number>(0)
  // Mirror of `state` kept in a ref so recordClick's count-placing path can read
  // the current mode/name/color/category WITHOUT using a setState updater (whose
  // function body is double-invoked under React StrictMode in dev, causing the
  // store.placeMarkup side effect to fire twice → double count pins).
  const stateRef = useRef<MarkupDrawState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const activate = useCallback((tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall') => {
    if (tool === 'count') {
      // Open naming popup immediately before any pin is placed (D-01)
      setState({
        ...INITIAL_STATE,
        mode: 'naming',
        toolType: 'count',
        popupScreenPos: { x: 16, y: 16 }
      })
    } else {
      // Linear, area, perimeter, wall — start drawing immediately
      setState({ ...INITIAL_STATE, mode: 'drawing', toolType: tool })
    }
  }, [])

  const cancel = useCallback(() => {
    // INITIAL_STATE resets chainArmed and pendingWallHeight per Pitfall 7
    setState(INITIAL_STATE)
  }, [])

  const commitCountName = useCallback((payload: { name: string; categoryName: string; color: string }) => {
    setState((s) => ({
      ...s,
      mode: 'placing',
      pendingName: payload.name,
      pendingCategoryName: payload.categoryName || UNCATEGORIZED,
      pendingColor: payload.color,
      popupScreenPos: null,
      chainArmed: true  // arm chain on first count commit (D-01)
    }))
  }, [])

  const recordClick = useCallback(
    (screenPos: { x: number; y: number }) => {
      const stage = stageRef.current
      if (!stage) return
      const stagePoint = screenToStagePoint(stage, screenPos.x, screenPos.y)

      // NOTE: The count-placing side effect (store.placeMarkup) is intentionally
      // performed OUTSIDE the setState updater. React StrictMode double-invokes
      // setState updater functions in dev to surface impurities; running the
      // placeMarkup side effect inside the updater caused TWO pins to be
      // written per click. Reading state via a getState ref snapshot keeps the
      // dispatch idempotent under StrictMode.
      const currentState = stateRef.current

      if (currentState.toolType === 'count' && currentState.mode === 'placing') {
        // Place a count pin immediately — stay in placing mode for rapid-fire clicks (D-02)
        const store = useMarkupStore.getState()
        const page = useViewerStore.getState().currentPage
        const category = store.getOrCreateCategory(
          currentState.pendingCategoryName || UNCATEGORIZED
        )
        const sequence = store.nextCountSequence(page, currentState.pendingName)
        const markup: CountMarkup = {
          id: crypto.randomUUID(),
          type: 'count',
          page,
          name: currentState.pendingName,
          categoryId: category.id,
          color: currentState.pendingColor,
          createdAt: Date.now(),
          point: stagePoint,
          sequence
        }
        store.placeMarkup(markup)
        lastClickTimeRef.current = Date.now()
        return
      }

      // Linear / area / perimeter / wall — pure state update, safe inside setState updater
      setState((prev) => {
        if (
          prev.mode === 'drawing' &&
          (prev.toolType === 'linear' ||
            prev.toolType === 'area' ||
            prev.toolType === 'perimeter' ||
            prev.toolType === 'wall')
        ) {
          // De-duplicate consecutive same-position clicks (rapid-fire clicks at nearly
          // the same canvas position should only place one vertex).
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
            pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage,
            redoPoints: []    // new placement invalidates in-progress redo history
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
      if ((prev.toolType !== 'linear' && prev.toolType !== 'wall') || prev.mode !== 'drawing') return prev

      if (prev.points.length < 2) {
        // Stay in drawing mode so the tool remains live after the error dismisses.
        // The user can continue clicking without needing to switch tools.
        return {
          ...prev,
          errorToast: 'Add at least two points before ending'
        }
      }

      const stage = stageRef.current
      if (!stage) return prev

      // Place popup near the midpoint of the finished polyline (screen-space)
      const midIndex = Math.floor(prev.points.length / 2)
      const mid = prev.points[midIndex]
      const screenMid = stageToScreenPoint(stage, mid)

      return {
        ...prev,
        mode: 'confirming',
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
        // Stay in drawing mode so the tool remains live after the error dismisses.
        return {
          ...prev,
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

  const commitShape = useCallback((payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => {
    // Read state from the ref snapshot, dispatch the side effect ONCE, then
    // reset state via setState. Doing the store.placeMarkup inside a setState
    // updater would double-fire under React StrictMode (same pattern as the
    // count-placing path in recordClick above).
    const prev = stateRef.current
    if (prev.mode !== 'confirming') return

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
    } else if (prev.toolType === 'wall') {
      const m: WallMarkup = {
        id,
        type: 'wall',
        page,
        name,
        categoryId: category.id,
        color,
        createdAt,
        points: prev.points,
        wallHeight: payload.wallHeight ?? prev.pendingWallHeight
      }
      store.placeMarkup(m)
    }

    // Chain-aware post-commit reset (Pitfall 3: dispatch store.placeMarkup OUTSIDE setState).
    // Always arm chain after first commit; preserve name/category/color/toolType and reset to
    // drawing mode so the user can place successive markups without re-prompting.
    // INITIAL_STATE resets chainArmed and pendingWallHeight per Pitfall 7.
    setState({
      ...INITIAL_STATE,
      toolType: prev.toolType,
      mode: 'drawing',
      pendingName: payload.name,
      pendingCategoryName: payload.categoryName,
      pendingColor: payload.color,
      pendingWallHeight: payload.wallHeight ?? prev.pendingWallHeight,
      chainArmed: true
    })
  }, [])

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, errorToast: null }))
  }, [])

  const popLastPoint = useCallback((): boolean => {
    const current = stateRef.current
    if (current.mode !== 'drawing') return false
    if (current.points.length === 0) return false
    // SC3: popping the first point exits the tool entirely (same as Escape)
    if (current.points.length === 1) {
      cancel()
      return true
    }
    setState((prev) => {
      if (prev.mode !== 'drawing' || prev.points.length === 0) return prev
      const popped = prev.points[prev.points.length - 1]
      return {
        ...prev,
        points: prev.points.slice(0, -1),
        previewPoint: null,
        redoPoints: [popped, ...prev.redoPoints]   // push front → LIFO repush
      }
    })
    return true
  }, [cancel])

  const repushLastPoint = useCallback((): boolean => {
    const current = stateRef.current
    if (current.mode !== 'drawing') return false
    if (current.redoPoints.length === 0) return false
    setState((prev) => {
      if (prev.mode !== 'drawing' || prev.redoPoints.length === 0) return prev
      const [next, ...remaining] = prev.redoPoints
      return {
        ...prev,
        points: [...prev.points, next],
        previewPoint: null,
        redoPoints: remaining
      }
    })
    return true
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
    dismissError,
    popLastPoint,
    repushLastPoint
  }
}
