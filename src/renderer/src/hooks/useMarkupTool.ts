import { useCallback, useEffect, useState, useRef, RefObject } from 'react'
import Konva from 'konva'
import type { StagePoint } from './useCalibrationMode'
import { useMarkupStore } from '../stores/markupStore'
import { useViewerStore } from '../stores/viewerStore'
import type { CountMarkup, LinearMarkup, AreaMarkup, PerimeterMarkup, WallMarkup } from '../types/markup'
import { polygonCentroid } from '../lib/markup-math'
import { MARKUP_PALETTE } from '../lib/markup-palette'
import { getReopenSnapshot, setReopenSnapshot } from '../lib/markup-reopen-ref'

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
  // ── Arc-edge drawing (Phase 14, D-01/D-02) ──────────────────────────────
  /**
   * Sticky arc-mode toggle. When 'sticky', every new edge is captured as an arc
   * (3-click gesture) until toggled back to 'off'. Default 'off' → straight.
   */
  arcMode: 'off' | 'sticky'
  /**
   * Transient one-off arc flag (hold-A). When true, the NEXT edge is an arc then
   * arcMode reverts to straight after it commits. OR'd with arcMode==='sticky'
   * to decide whether the current edge is an arc.
   */
  arcHeld: boolean
  /**
   * The on-arc shaping point captured by the SECOND click of an arc edge (the
   * point the curve must pass through). Non-null only between the on-arc click
   * and the end click — i.e. while an arc edge is mid-capture. The viewport
   * reads this to render the live ArcPreview and to know an arc is in flight.
   */
  arcOnArc: StagePoint | null
  /**
   * Accumulated per-edge arc metadata for the in-progress markup, keyed by the
   * arc edge's START-vertex index (matching the 14-01 arcs map contract).
   * Carried into commitShape so the committed markup measures as true arcs.
   */
  arcs: Record<number, { midX: number; midY: number }>
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
  redoPoints: [],
  arcMode: 'off',
  arcHeld: false,
  arcOnArc: null,
  arcs: {}
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
  /**
   * Feed a click into the arc-edge 3-click gesture (D-01). The START point is
   * the last committed vertex (or the very first click, placed as a plain
   * vertex). This handles the SECOND click (on-arc shaping point) and the THIRD
   * click (end vertex):
   *  - if no on-arc point is captured yet → capture it (arcOnArc), place nothing;
   *  - if an on-arc point IS captured → append the END vertex to points AND
   *    write arcs[startVertexIndex] = { midX, midY } from the captured on-arc
   *    point, then clear arcOnArc. If arcHeld (one-off) revert arcMode→off.
   * Returns the phase so the caller can decide preview vs placement behavior.
   */
  recordArcClick: (screenPos: { x: number; y: number }) => void
  /** Set the transient one-off (hold-A) arc flag. */
  setArcHeld: (held: boolean) => void
  /** Toggle the sticky arc-mode run between 'off' and 'sticky'. */
  toggleArcSticky: () => void
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
  activatePreset: (
    tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall',
    preset: {
      name: string
      categoryName: string
      color: string
      wallHeight?: number
      /** Phase 13 (D-13): pre-populate the in-progress points stack — used by post-commit re-open. */
      points?: StagePoint[]
    }
  ) => void
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

  const activatePreset = useCallback(
    (
      tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall',
      preset: {
        name: string
        categoryName: string
        color: string
        wallHeight?: number
        /** Phase 13 (D-13): pre-populate the in-progress points stack — used by post-commit re-open. */
        points?: StagePoint[]
      }
    ) => {
      if (tool === 'count') {
        // Count tools ignore preset.points (single-point — re-open semantics don't apply, D-12).
        setState({
          ...INITIAL_STATE,
          mode: 'placing',
          toolType: 'count',
          pendingName: preset.name,
          pendingCategoryName: preset.categoryName || UNCATEGORIZED,
          pendingColor: preset.color,
          chainArmed: true
        })
      } else {
        // Phase 13: seeded-points branch (re-open) vs no-points branch (chain arm from totals panel).
        const hasSeededPoints = preset.points !== undefined && preset.points.length > 0
        setState({
          ...INITIAL_STATE,
          mode: 'drawing',
          toolType: tool,
          pendingName: preset.name,
          pendingCategoryName: preset.categoryName || UNCATEGORIZED,
          pendingColor: preset.color,
          // Pitfall 2 (LOAD-BEARING): chainArmed MUST be false on re-open. Otherwise Phase 8's
          // auto-commit useEffect in CanvasViewport.tsx fires immediately on mode:'confirming',
          // breaking the user's ability to add or pop points before re-commit.
          chainArmed: hasSeededPoints ? false : true,
          // Copy the array — mutating preset.points in place would corrupt the Esc-restore
          // snapshot held in markup-reopen-ref.
          points: hasSeededPoints ? [...(preset.points ?? [])] : [],
          ...(tool === 'wall' ? { pendingWallHeight: preset.wallHeight ?? 2400 } : {}),
          // Seed pendingPage at re-open time so commitShape doesn't fall through to currentPage default.
          ...(hasSeededPoints ? { pendingPage: useViewerStore.getState().currentPage } : {})
        })
      }
    },
    []
  )

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

  const recordArcClick = useCallback(
    (screenPos: { x: number; y: number }) => {
      const stage = stageRef.current
      if (!stage) return
      const stagePoint = screenToStagePoint(stage, screenPos.x, screenPos.y)

      setState((prev) => {
        // Arc edges only apply to the multi-point line/polygon tools while drawing.
        if (
          prev.mode !== 'drawing' ||
          (prev.toolType !== 'linear' &&
            prev.toolType !== 'area' &&
            prev.toolType !== 'perimeter' &&
            prev.toolType !== 'wall')
        ) {
          return prev
        }

        // No start vertex yet → this click is the START vertex; place it like a
        // plain vertex. The arc gesture proper begins from the next click.
        if (prev.points.length === 0) {
          return {
            ...prev,
            points: [stagePoint],
            previewPoint: null,
            arcOnArc: null,
            pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage,
            redoPoints: []
          }
        }

        // Mid-edge: no on-arc point captured yet → this is the SECOND (on-arc)
        // click. Capture the shaping point; place no vertex.
        if (prev.arcOnArc === null) {
          return { ...prev, arcOnArc: stagePoint, previewPoint: null }
        }

        // On-arc point already captured → this is the THIRD (end) click.
        // De-duplicate against the start vertex of this edge (an end click on
        // top of the start would be degenerate).
        const startIndex = prev.points.length - 1
        const startVertex = prev.points[startIndex]
        if (
          startVertex &&
          distanceSquared(startVertex, stagePoint) <
            DUPLICATE_POINT_EPSILON * DUPLICATE_POINT_EPSILON
        ) {
          // Ignore a degenerate end click; keep the on-arc point for a retry.
          return prev
        }

        // Append the END vertex and record the on-arc midpoint keyed by the
        // edge's start-vertex index (14-01 arcs contract).
        const nextArcs = {
          ...prev.arcs,
          [startIndex]: { midX: prev.arcOnArc.x, midY: prev.arcOnArc.y }
        }

        // One-off (held) arc reverts to straight after this edge; sticky stays.
        const nextArcMode = prev.arcHeld ? 'off' : prev.arcMode

        return {
          ...prev,
          points: [...prev.points, stagePoint],
          arcs: nextArcs,
          arcOnArc: null,
          arcHeld: false,
          arcMode: nextArcMode,
          previewPoint: null,
          pendingPage: prev.pendingPage ?? useViewerStore.getState().currentPage,
          redoPoints: []
        }
      })
      lastClickTimeRef.current = Date.now()
    },
    [stageRef]
  )

  const setArcHeld = useCallback((held: boolean) => {
    setState((prev) => (prev.arcHeld === held ? prev : { ...prev, arcHeld: held }))
  }, [])

  const toggleArcSticky = useCallback(() => {
    setState((prev) => ({
      ...prev,
      arcMode: prev.arcMode === 'sticky' ? 'off' : 'sticky'
    }))
  }, [])

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

    // Phase 14 (D-01): carry any accumulated per-edge arc metadata onto the
    // committed markup so 14-01's arc-aware measurement reports true arc
    // length/area. Only attach when at least one arc edge was drawn — a
    // straight-only shape leaves `arcs` absent (matching the optional-field
    // contract; absent key ⟺ straight edge).
    const hasArcs = Object.keys(prev.arcs).length > 0
    const arcsField = hasArcs ? { arcs: { ...prev.arcs } } : {}

    let newMarkup: LinearMarkup | AreaMarkup | PerimeterMarkup | WallMarkup | null = null
    if (prev.toolType === 'linear') {
      newMarkup = { id, type: 'linear', page, name, categoryId: category.id, color, createdAt, points: prev.points, ...arcsField }
    } else if (prev.toolType === 'area') {
      newMarkup = { id, type: 'area', page, name, categoryId: category.id, color, createdAt, points: prev.points, ...arcsField }
    } else if (prev.toolType === 'perimeter') {
      newMarkup = { id, type: 'perimeter', page, name, categoryId: category.id, color, createdAt, points: prev.points, ...arcsField }
    } else if (prev.toolType === 'wall') {
      newMarkup = { id, type: 'wall', page, name, categoryId: category.id, color, createdAt, points: prev.points, wallHeight: payload.wallHeight ?? prev.pendingWallHeight, ...arcsField }
    }
    if (!newMarkup) return

    // Phase 13 (D-16): consult re-open ref. If a snapshot is held, this commit is the
    // re-commit half of the gesture — dispatch reopen-recommit (ONE command) instead of
    // place. Then clear the snapshot before the post-commit reset.
    const reopenSnapshot = getReopenSnapshot()
    if (reopenSnapshot) {
      store.commitReopen(reopenSnapshot, newMarkup)
      setReopenSnapshot(null)
    } else {
      store.placeMarkup(newMarkup)
    }

    // Chain-aware post-commit reset (Pitfall 3: dispatch store action OUTSIDE setState).
    // Phase 13 (Pitfall 2): chainArmed false after a reopen-recommit — the user requested
    // a geometry refinement, not a chain start. Phase 8 chain badge will not render.
    setState({
      ...INITIAL_STATE,
      toolType: prev.toolType,
      mode: 'drawing',
      pendingName: payload.name,
      pendingCategoryName: payload.categoryName,
      pendingColor: payload.color,
      pendingWallHeight: payload.wallHeight ?? prev.pendingWallHeight,
      chainArmed: reopenSnapshot ? false : true,
      // Preserve the sticky arc-mode run across a chained commit (D-02). A
      // one-off (held) arc has already reverted arcMode to 'off' at edge commit,
      // so this only keeps a genuinely sticky run alive into the next shape.
      arcMode: prev.arcMode
    })
  }, [])

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, errorToast: null }))
  }, [])

  const popLastPoint = useCallback((): boolean => {
    const current = stateRef.current
    if (current.mode !== 'drawing') return false
    if (current.points.length === 0) return false
    // SC3: popping the first point exits the tool entirely (same as Escape).
    // CR-02: if mid re-open, treat pop-to-zero as implicit Esc — restore the
    // original markup and re-push its place command before cancelling so the
    // snapshot is never orphaned. Mirrors the useMarkupTool Esc handler.
    if (current.points.length === 1) {
      const snapshot = getReopenSnapshot()
      if (snapshot) {
        useMarkupStore.getState().restoreFromReopen(snapshot)
        useMarkupStore.getState().repushPlaceForReopenCancel(snapshot)
        setReopenSnapshot(null)
      }
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

  // Phase 13 (D-14 / Pitfall 6): window-level Escape listener for post-commit re-open cancel.
  // When the module-level reopen snapshot is held, Esc restores the original markup byte-
  // identically, re-pushes the original 'place' command (so Ctrl+Z afterwards behaves as if
  // the re-open never happened), clears the snapshot, and resets the hook to idle.
  //
  // Why register here (in useMarkupTool) rather than only in CanvasViewport: the snapshot
  // lifecycle is anchored to this hook (commitShape consumes via getReopenSnapshot, the
  // CanvasViewport reopen handler sets it). Owning the Esc-cancel path here means the
  // restore fires whenever the hook is mounted — including tests that mount the hook
  // without CanvasViewport. CanvasViewport's existing keydown listener still handles the
  // mode-based cancel + setActiveTool('select') tail.
  useEffect(() => {
    function handleEscape(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      const snapshot = getReopenSnapshot()
      if (!snapshot) return
      useMarkupStore.getState().restoreFromReopen(snapshot)
      useMarkupStore.getState().repushPlaceForReopenCancel(snapshot)
      setReopenSnapshot(null)
      // Reset hook state so the in-progress draw clears. Equivalent to cancel().
      setState(INITIAL_STATE)
      // Return to select tool so the user has a clean canvas; mirrors the CanvasViewport
      // Esc handler's setActiveTool('select') tail.
      useViewerStore.getState().setActiveTool('select')
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  return {
    state,
    activate,
    activatePreset,
    cancel,
    recordClick,
    recordArcClick,
    setArcHeld,
    toggleArcSticky,
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
