import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Line, Rect } from 'react-konva'
import Konva from 'konva'
import { usePdfRenderer } from '../hooks/usePdfRenderer'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewportControls } from '../hooks/useViewportControls'
import { useKeyboardShortcuts, isTextInputActive } from '../hooks/useKeyboardShortcuts'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { useCalibrationMode } from '../hooks/useCalibrationMode'
import type { StagePoint } from '../hooks/useCalibrationMode'
import { useMarkupTool } from '../hooks/useMarkupTool'
import { useMarkupStore } from '../stores/markupStore'
import { ScalePopup } from './ScalePopup'
import { ConfirmationToast } from './ConfirmationToast'
import { MarkupNamePopup } from './MarkupNamePopup'
import { MarkupTooltip } from './MarkupTooltip'
import { MarkupContextMenu } from './MarkupContextMenu'
import { CountPinMarkup } from './markup/CountPinMarkup'
import { LinearMarkup } from './markup/LinearMarkup'
import { AreaMarkup } from './markup/AreaMarkup'
import { PerimeterMarkup } from './markup/PerimeterMarkup'
import { WallMarkup } from './WallMarkup'
import { HoverRing } from './HoverRing'
import { PulseHighlight } from './PulseHighlight'
import { VertexHandleOverlay } from './markup/VertexHandleOverlay'
import { BulgeHandle } from './markup/BulgeHandle'
import { SnapIndicator } from './markup/SnapIndicator'
import { ArcPreview } from './markup/ArcPreview'
import { clampBulgeToSagittaCap, resolveArcMidForMovedEndpoint } from '../lib/arc-math'
import { buildSnapIndex, resolveSnap, type SnapIndex, type SnapCandidate, type SnapExclude } from '../lib/snapping-engine'
import { COLORS } from '../lib/constants'
import { formatScaleRatio } from '../lib/scale-math'
import { setMarkupUndoHandler, setMarkupRedoHandler } from '../lib/markup-undo-ref'
import { setArcHeldHandler, setArcStickyToggleHandler } from '../lib/markup-arc-ref'
import { setMarkupReopenHandler, getReopenSnapshot, setReopenSnapshot } from '../lib/markup-reopen-ref'
import {
  polylineLength,
  polygonArea,
  pixelLengthToReal,
  pixelAreaToReal
} from '../lib/markup-math'
import { isMarkupTool } from '../types/viewer'
import type { ScaleUnit } from '../types/scale'
import type { Markup, CountMarkup, LinearMarkup as LinearMarkupType, AreaMarkup as AreaMarkupType, PerimeterMarkup as PerimeterMarkupType, WallMarkup as WallMarkupType } from '../types/markup'
import { isMultiPointMarkup } from '../types/markup'

// Stable empty-array reference for the pageMarkups selector fallback.
// A fresh `[]` literal inside a Zustand selector breaks useSyncExternalStore's
// Object.is snapshot check and causes an infinite re-render loop.
const EMPTY_MARKUPS: Markup[] = []

// Phase 14 (14-03 D-07): sentinel markupId for the in-progress (not-yet-
// committed) markup. Its vertices are not in the committed snap index, so this
// id is never matched there; passing it with allowVertexIndices=[0] documents
// the close-the-loop-only restriction without affecting committed-geometry snaps.
const IN_PROGRESS_MARKUP_ID = '__in_progress__'

// Plan 09-03: Rubber-band selection (D-06, D-07, D-08, D-09).
// Stage-space coordinates of the in-progress rubber-band drag rectangle.
type RubberBandState = { startX: number; startY: number; endX: number; endY: number } | null

// Translucent accent fill for the rubber-band rectangle. Defined at module
// scope (not inside JSX) so the literal does not violate the codebase's
// "COLORS tokens only / no raw hex" rule — opacity variants of accent are not
// part of the COLORS palette, and a named constant makes the intent obvious.
const RUBBER_BAND_FILL = 'rgba(0,120,212,0.1)'

// PIN_RADIUS_WORLD mirrors CountPinMarkup.tsx:25 and HoverRing.tsx:21 — pins
// are world-anchored at radius 10 stage-units, so a count markup's axis-
// aligned bounding box for D-07 containment math is point ± 10 on both axes.
const PIN_RADIUS_WORLD = 10

/**
 * Compute the axis-aligned bounding box of a markup in stage-space.
 * Used by the rubber-band containment check (D-07): a markup is selected iff
 * its FULL bbox falls inside the rubber-band rectangle (standard CAD
 * "selection window" rule). The convex-hull is not needed for AABB.
 */
function getMarkupBBox(markup: Markup): { minX: number; maxX: number; minY: number; maxY: number } {
  if (markup.type === 'count') {
    return {
      minX: markup.point.x - PIN_RADIUS_WORLD,
      maxX: markup.point.x + PIN_RADIUS_WORLD,
      minY: markup.point.y - PIN_RADIUS_WORLD,
      maxY: markup.point.y + PIN_RADIUS_WORLD
    }
  }
  // linear | area | perimeter | wall — all are point arrays in stage-space.
  const xs = markup.points.map((p) => p.x)
  const ys = markup.points.map((p) => p.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }
}

/**
 * D-07 containment check: the markup's full AABB must be entirely inside the
 * normalised rubber-band rectangle. Band corners are normalised so the test
 * works regardless of drag direction (top-left→bottom-right, or any other).
 */
function isFullyInside(
  markup: Markup,
  band: { startX: number; startY: number; endX: number; endY: number }
): boolean {
  const bx1 = Math.min(band.startX, band.endX)
  const bx2 = Math.max(band.startX, band.endX)
  const by1 = Math.min(band.startY, band.endY)
  const by2 = Math.max(band.startY, band.endY)
  const { minX, maxX, minY, maxY } = getMarkupBBox(markup)
  return minX >= bx1 && maxX <= bx2 && minY >= by1 && maxY <= by2
}

// Module-level ref for canvas control functions (consumed by Toolbar via getCanvasControls)
let _canvasControls: {
  zoomIn: () => void
  zoomOut: () => void
  fitToWindow: () => void
} | null = null

export function getCanvasControls() {
  return _canvasControls
}

// Module-level ref for calibration control functions (consumed by Toolbar via getCalibrationControls)
let _calibrationControls: {
  activate: () => void
  activateVerify: () => void
  cancel: () => void
} | null = null

export function getCalibrationControls() {
  return _calibrationControls
}

// Module-level ref for chain-armed item (consumed by Toolbar via getChainArmedItem)
let _chainArmedItem: { name: string; color: string } | null = null

export function getChainArmedItem(): { name: string; color: string } | null {
  return _chainArmedItem
}

// Module-level ref for activatePreset (consumed by setChainArmedFromTotals)
type ActivatePresetFn = (
  tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall',
  preset: { name: string; categoryName: string; color: string; wallHeight?: number }
) => void
let _activatePresetRef: ActivatePresetFn | null = null

export function setChainArmedFromTotals(
  payload: {
    name: string
    categoryName: string
    color: string
    toolType: 'count' | 'linear' | 'area' | 'perimeter' | 'wall'
    wallHeight?: number
  } | null
): void {
  if (payload === null) {
    _chainArmedItem = null
    return
  }
  _chainArmedItem = { name: payload.name, color: payload.color }
  _activatePresetRef?.(payload.toolType, {
    name: payload.name,
    categoryName: payload.categoryName,
    color: payload.color,
    wallHeight: payload.wallHeight
  })
}

// Crosshair SVG data-URL cursor with 4px center gap per D-17.
// Computed ONCE at module load — never inside a component render path.
// 8 line elements: 4 black outline (stroke-width 3) + 4 white foreground (stroke-width 1.5).
// Horizontal arms: (0,12)→(10,12) and (14,12)→(24,12)
// Vertical arms:   (12,0)→(12,10) and (12,14)→(12,24)
// encodeURIComponent is mandatory (Pitfall 8) — single quotes inside SVG avoid
// double-quote conflicts with the outer url("...") CSS value.
const CROSSHAIR_CURSOR: string = (() => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'>` +
    `<line x1='0' y1='12' x2='10' y2='12' stroke='black' stroke-width='3'/>` +
    `<line x1='14' y1='12' x2='24' y2='12' stroke='black' stroke-width='3'/>` +
    `<line x1='12' y1='0' x2='12' y2='10' stroke='black' stroke-width='3'/>` +
    `<line x1='12' y1='14' x2='12' y2='24' stroke='black' stroke-width='3'/>` +
    `<line x1='0' y1='12' x2='10' y2='12' stroke='white' stroke-width='1.5'/>` +
    `<line x1='14' y1='12' x2='24' y2='12' stroke='white' stroke-width='1.5'/>` +
    `<line x1='12' y1='0' x2='12' y2='10' stroke='white' stroke-width='1.5'/>` +
    `<line x1='12' y1='14' x2='12' y2='24' stroke='white' stroke-width='1.5'/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`
})()

// Phase 14 (14-04 D-02): arc-mode crosshair — the standard crosshair plus a
// small accent arc tick in the top-right quadrant so the estimator always knows
// the next edge will curve (UI-SPEC § "Active arc-mode cursor"). Reuses the
// same two-pass (black outline + white foreground) crosshair, then overlays a
// blue quarter-arc. Computed ONCE at module load.
const ARC_CROSSHAIR_CURSOR: string = (() => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'>` +
    `<line x1='0' y1='12' x2='10' y2='12' stroke='black' stroke-width='3'/>` +
    `<line x1='14' y1='12' x2='24' y2='12' stroke='black' stroke-width='3'/>` +
    `<line x1='12' y1='0' x2='12' y2='10' stroke='black' stroke-width='3'/>` +
    `<line x1='12' y1='14' x2='12' y2='24' stroke='black' stroke-width='3'/>` +
    `<line x1='0' y1='12' x2='10' y2='12' stroke='white' stroke-width='1.5'/>` +
    `<line x1='14' y1='12' x2='24' y2='12' stroke='white' stroke-width='1.5'/>` +
    `<line x1='12' y1='0' x2='12' y2='10' stroke='white' stroke-width='1.5'/>` +
    `<line x1='12' y1='14' x2='12' y2='24' stroke='white' stroke-width='1.5'/>` +
    // Arc tick: a quarter-arc from (18,6) to (22,10), accent blue, white halo
    // first so it reads on any background.
    `<path d='M18 6 A 6 6 0 0 1 22 10' fill='none' stroke='white' stroke-width='3'/>` +
    `<path d='M18 6 A 6 6 0 0 1 22 10' fill='none' stroke='#0078d4' stroke-width='1.75'/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`
})()

export interface CanvasViewportProps {
  /** Phase 6 D-11: markups to show a steady white outer ring on (from TotalsRow hover). */
  hoverMatches?: Markup[]
  /** Phase 6 D-12: active click-pulse (color + markups) or null when none. */
  pulse?: { matches: Markup[]; color: string } | null
  /** Phase 6: called when the pulse animation completes OR page changes (clears pulse). */
  onPulseComplete?: () => void
  /** Phase 13 (D-11): Fire when a post-commit re-open transition succeeds. App.tsx owns the toast slot. */
  onReopenToast?: () => void
}

export function CanvasViewport(props: CanvasViewportProps = {}) {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

  // Callback ref: attaches ResizeObserver whenever the div mounts. The early
  // return at the bottom of this component (when displayCanvas is null) means
  // the div may be null on first render and only mount after the PDF rasterizes.
  // A useEffect with [] deps would run once at first mount (ref null) and never
  // re-run, leaving containerSize stuck at the 800x600 default. Callback refs
  // fire on every mount/unmount, so this catches the post-rasterize mount.
  const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = null
    }
    if (el) {
      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect
        setContainerSize({ width: Math.floor(width), height: Math.floor(height) })
      })
      observer.observe(el)
      resizeObserverRef.current = observer
    }
  }, [])
  const { pageCanvas, pageSize } = usePdfRenderer()

  // Keep a ref to the last valid render so we never flash blank during transitions
  const lastValidRef = useRef<{
    pageCanvas: HTMLCanvasElement
    pageSize: { width: number; height: number }
  } | null>(null)

  // Update the ref whenever we have a valid new render
  if (pageCanvas && pageSize) {
    lastValidRef.current = { pageCanvas, pageSize }
  }

  // Use current values if available, otherwise fall back to last valid
  const displayCanvas = pageCanvas ?? lastValidRef.current?.pageCanvas ?? null
  const displayPageSize = pageSize ?? lastValidRef.current?.pageSize ?? null

  const currentPage = useViewerStore((s) => s.currentPage)
  const totalPages = useViewerStore((s) => s.totalPages)
  const getViewport = useViewerStore((s) => s.getViewport)
  const setViewport = useViewerStore((s) => s.setViewport)
  // B4 fix: subscribe to the zoom primitive so changes trigger a re-render.
  // Reading through getViewport(page).zoom inside render bypasses the subscription
  // (getViewport is a stable function reference). The `?? 1` fallback is a primitive
  // literal so Object.is equality works — same pattern as EMPTY_MARKUPS precedent.
  const currentZoom = useViewerStore((s) => s.pageViewports[currentPage]?.zoom ?? 1)

  const pageScale = useScaleStore((s) => s.pageScales[currentPage] ?? null)
  const setScale = useScaleStore((s) => s.setScale)
  const calibMode = useScaleStore((s) => s.calibMode)

  // Calculate fit-to-window scale (must be defined before useViewportControls uses it)
  const calculateFitScale = useCallback(() => {
    if (!pageSize) return 1
    const padding = 20
    const availableWidth = containerSize.width - padding * 2
    const availableHeight = containerSize.height - padding * 2
    const scaleX = availableWidth / pageSize.width
    const scaleY = availableHeight / pageSize.height
    return Math.min(scaleX, scaleY)
  }, [pageSize, containerSize])

  // Pass fit scale to viewport controls so zoom steps include it
  const currentFitScale = calculateFitScale()
  const { handleWheel, zoomIn, zoomOut, spaceHeld, isDraggable } = useViewportControls(
    stageRef,
    currentFitScale
  )
  const { openPdfDialog } = usePdfDocument()

  // Calibration interaction (new mm-based hook)
  const {
    state: calibState,
    activate,
    activateVerify,
    cancel,
    recordClick,
    updatePreview,
    recomputePopupPos
  } = useCalibrationMode(stageRef)

  // Markup tool interaction state machine
  const activeTool = useViewerStore((s) => s.activeTool)

  // Plan 09-02: selection state for the click-to-select selection ring.
  // Selectors return primitive/array references so Zustand's Object.is snapshot
  // check stays stable (same pattern as currentZoom above).
  const selectedMarkupIds = useViewerStore((s) => s.selectedMarkupIds)
  const setSelectedMarkupIds = useViewerStore((s) => s.setSelectedMarkupIds)
  const clearSelection = useViewerStore((s) => s.clearSelection)

  // Phase 12: vertex-edit mode store subscriptions (Wave 1 foundation).
  // Drives VertexHandleOverlay mount/unmount and gates Enter/Escape behaviour.
  const vertexEditMarkupId = useViewerStore((s) => s.vertexEditMarkupId)
  const setVertexEditMarkupId = useViewerStore((s) => s.setVertexEditMarkupId)
  const clearVertexEdit = useViewerStore((s) => s.clearVertexEdit)

  // Phase 14 (14-03 D-03): snapping flags (snapEnabled/snapSuspended) are read
  // inside resolveSnapAt via useViewerStore.getState() so the pointer callbacks'
  // dep lists stay narrow — no subscription needed here. The StatusBar (Task 3)
  // subscribes to them for the ON/held-off/OFF pill.

  const {
    state: markupState,
    activate: activateMarkup,
    cancel: cancelMarkup,
    recordClick: recordMarkupClick,
    recordArcClick,
    setArcHeld,
    toggleArcSticky,
    updatePreview: updateMarkupPreview,
    finishLinear,
    finishPolygon,
    commitCountName,
    commitShape,
    dismissError,
    popLastPoint,
    repushLastPoint,
    activatePreset
  } = useMarkupTool(stageRef)

  // Expose the mid-draw undo handler via a module-level ref so useKeyboardShortcuts
  // can prefer it over the committed-markup undo stack while a polyline/polygon is
  // being drawn. Returns true when a vertex was popped, false otherwise.
  useEffect(() => {
    setMarkupUndoHandler(popLastPoint)
    return () => {
      setMarkupUndoHandler(null)
    }
  }, [popLastPoint])

  // Phase 14 (14-04 D-02): expose the arc-mode setters to useKeyboardShortcuts
  // via module-level refs (the arc flags live in useMarkupTool React state, not
  // a store, so the global key handler reads them through these refs). Mirrors
  // the setMarkupUndoHandler registration above.
  useEffect(() => {
    setArcHeldHandler(setArcHeld)
    setArcStickyToggleHandler(toggleArcSticky)
    return () => {
      setArcHeldHandler(null)
      setArcStickyToggleHandler(null)
    }
  }, [setArcHeld, toggleArcSticky])

  useEffect(() => {
    setMarkupRedoHandler(repushLastPoint)
    return () => {
      setMarkupRedoHandler(null)
    }
  }, [repushLastPoint])

  // Phase 13: register the post-commit re-open handler. useKeyboardShortcuts calls
  // getMarkupReopenHandler() between the in-progress draw-undo (Phase 10) and the
  // committed-markup store.undo() (Phase 3). The handler applies D-17 all 5 conditions
  // and on success snapshots the original, removes it silently, pops the 'place'
  // command, clears selection/vertex-edit, hands off to useMarkupTool via activatePreset,
  // and fires the toast.
  useEffect(() => {
    const handler = (): boolean => {
      // D-17 condition 1: no in-progress draw. (Phase 10's getMarkupUndoHandler would have
      // returned true if drawing was active — this is defensive.)
      if (markupState.mode !== 'idle') return false
      // D-17 condition 4: no vertex-edit active.
      if (useViewerStore.getState().vertexEditMarkupId !== null) return false
      // D-17 condition 2: top of stack is 'place' of a multi-point markup.
      const store = useMarkupStore.getState()
      const top = store.undoStack.at(-1)
      if (!top || top.type !== 'place') return false
      if (!isMultiPointMarkup(top.markup)) return false  // D-12 — count pins excluded
      // D-17 condition 5 (A4): markup must be on currentPage.
      if (top.markup.page !== useViewerStore.getState().currentPage) return false
      // D-17 condition 3: markup still exists in store.
      const stillExists = (store.pageMarkups[top.markup.page] ?? []).some((m) => m.id === top.markup.id)
      if (!stillExists) return false

      // All five conditions satisfied — fire the re-open transition.
      const original = top.markup
      setReopenSnapshot(original)
      store.removeForReopen(original)
      // D-16: pop the original 'place' command from undoStack. It becomes part of the
      // reopen-recommit command (Plan 13-02's commitReopen pushes it as one entry on Enter),
      // not a separate undo entry. On Esc-cancel the Esc handler below re-pushes it.
      useMarkupStore.setState((s) => ({ undoStack: s.undoStack.slice(0, -1) }))
      // D-24: clear selection + vertex-edit so the canvas reads clean.
      clearSelection()
      clearVertexEdit()
      // Map markup.type 1:1 to the tool string activatePreset expects. isMultiPointMarkup
      // already excluded 'count' so this narrow is safe.
      const tool = original.type as 'linear' | 'area' | 'perimeter' | 'wall'
      const cat = store.getCategory(original.categoryId)
      // CR-01: must align viewerStore.activeTool BEFORE activatePreset so the
      // tool-sync useEffect below sees isMarkupTool(activeTool)===true and
      // short-circuits instead of firing cancelMarkup(). Same coupling as
      // App.tsx setChainArmedFromTotals (see App.tsx:281-289).
      useViewerStore.getState().setActiveTool(tool)
      activatePreset(tool, {
        name: original.name,
        categoryName: cat?.name ?? '',
        color: original.color,
        // `original` is narrowed by isMultiPointMarkup above (count excluded), so
        // it always carries `points` — the prior `=== 'count'` guard was dead.
        points: original.points,
        wallHeight: original.type === 'wall' ? original.wallHeight : undefined
      })
      // D-11: fire the toast via app-level callback.
      props.onReopenToast?.()
      return true
    }
    setMarkupReopenHandler(handler)
    // Pitfall 9 / T-13-03-01: cleanup MUST set ref to null to survive StrictMode double-mount.
    return () => setMarkupReopenHandler(null)
  }, [markupState.mode, activatePreset, clearSelection, clearVertexEdit, props.onReopenToast])

  // Local state for polygon start-vertex hover (drives close-on-click affordance)
  const [isOverStartPoint, setIsOverStartPoint] = useState(false)

  // Plan 09-03: rubber-band rectangle in stage-space while the user is
  // mid-drag in 'select' mode. null when no drag is in progress.
  // useState drives the render; useRef gives event handlers a stable,
  // always-current value without needing rubberBand in useCallback deps
  // (which would cause a listener-swap on every state change and miss events).
  const [rubberBand, setRubberBandState] = useState<RubberBandState>(null)
  const rubberBandRef = useRef<RubberBandState>(null)
  const setRubberBand = useCallback((val: RubberBandState) => {
    rubberBandRef.current = val
    setRubberBandState(val)
  }, [])
  // Set to true in handleStageMouseUp after a real rubber-band drag (mouse moved >4px).
  // Read and cleared in handleStageClick to prevent the Konva click event (always fired
  // when _mouseListenClick=true, i.e. no Konva drag active) from wiping the selection.
  const rubberBandDraggedRef = useRef(false)

  // Phase 12: drag-preview state for live rendering during vertex-drag or body-drag.
  // setState drives re-renders; refs give event handlers stable reads without re-subscribing.
  // - { type: 'vertex' } — single-markup vertex drag: preview points override that markup's points
  //   via overridePoints prop (no store write).
  // - { type: 'body' } — translate (single or group): per-markup pixel deltas applied at render.
  // Wave 3b (plan 12-04) writes 'body' previews; Wave 3c (plan 12-05) writes 'vertex' previews.
  type DragPreview =
    | { type: 'vertex'; markupId: string; vertexIndex: number; points: StagePoint[] }
    | { type: 'body'; deltas: Record<string, { x: number; y: number }> }
    | null

  const [dragPreview, setDragPreviewState] = useState<DragPreview>(null)
  const dragPreviewRef = useRef<DragPreview>(null)
  const setDragPreview = useCallback((val: DragPreview) => {
    dragPreviewRef.current = val
    setDragPreviewState(val)
  }, [])

  // Phase 14 (14-03 D-04/D-05): snapping spatial index + active snap glyph.
  // The index is held in a module-style ref (mirroring vertexDragRef) so
  // handleStageMouseMove can read it without widening its dependency list; it is
  // rebuilt by a useEffect keyed on the current page's geometry + zoom (below).
  // snapCandidate drives the □/△ SnapIndicator on the transient overlay layer.
  const snapIndexRef = useRef<SnapIndex | null>(null)
  const [snapCandidate, setSnapCandidate] = useState<SnapCandidate | null>(null)

  // Phase 12: markup body mousedown ref — set by markup components' onMarkupMouseDown prop.
  // CanvasViewport reads this in handleStageMouseDown (before rubber-band check) to detect
  // body-drag intent. Cleared immediately on read (consume-on-read pattern). Wired in 12-04.
  const markupBodyDownRef = useRef<string | null>(null)

  // Phase 12 (post-UAT): markup-click handoff ref. handleMarkupClick sets this to the clicked
  // markup id BEFORE updating vertexEditMarkupId. handleStageClick consumes it during the
  // click-outside-commit branch so it can distinguish "click landed on a markup" (no commit —
  // handleMarkupClick already routed the transition) from "click landed on empty stage" (commit).
  // The native fallback (e.target.getAttr('id')) does not work because markup Groups never set
  // an `id` Konva attr — without this ref, the click-outside guard would always fire on the
  // first click of a markup and immediately undo handleMarkupClick's setVertexEditMarkupId.
  const markupClickedRef = useRef<string | null>(null)

  // Phase 12 (12-04): body drag state — which markup ids are being dragged, start positions, origin.
  // Single translate uses ids.length === 1; group move uses ids.length === N. Both dispatch one
  // moveMarkups command with N entries at mouseup (D-08 — group move).
  type BodyDragState = {
    ids: string[]
    origin: StagePoint            // page-space point where drag started
    startPositions: Record<string, StagePoint | StagePoint[]>  // id → point(s) snapshot
  } | null
  const bodyDragRef = useRef<BodyDragState>(null)

  // Phase 12 (12-04): bodyDraggedRef mirrors rubberBandDraggedRef — suppresses Konva click after
  // a body drag completes so clearSelection() does not immediately wipe the selection.
  // Source: RESEARCH.md Pitfall 2 + rubberBandDraggedRef pattern (lines 343-346, 939 in this file).
  const bodyDraggedRef = useRef(false)

  // Phase 12 (12-05): vertex drag state — which markup/vertex is being dragged.
  // Set by the onHandleMouseDown callback on VertexHandleOverlay (Konva child onMouseDown fires
  // BEFORE the Stage handler, and the handle's `e.cancelBubble = true` suppresses the Stage event
  // entirely — see VertexHandleOverlay.tsx:75-76). Cleared on mouseup or out-of-bounds release.
  // One drag session = one moveVertex dispatch in handleStageMouseUp = one undo entry (D-06).
  type VertexDragState = {
    markupId: string
    vertexIndex: number
    origin: StagePoint        // page-space point where drag started
    originalPoints: StagePoint[]  // snapshot for restore on out-of-bounds release
  } | null

  const vertexDragRef = useRef<VertexDragState>(null)

  // Phase 14 (14-05 D-08): bulge-drag state — which arc edge's curvature is being
  // reshaped. Set by the BulgeHandle onHandleMouseDown callback (the handle's
  // e.cancelBubble=true suppresses the Stage mousedown, mirroring vertexDragRef).
  // One drag session = ONE reshapeArc dispatch in handleStageMouseUp = one undo
  // entry. `originalArcs` is the snapshot used to restore on out-of-bounds release.
  type BulgeDragState = {
    markupId: string
    segmentIndex: number
    /** Snapshot of the markup's arcs map at drag start (for restore / dispatch). */
    originalArcs: Record<number, { midX: number; midY: number }> | undefined
  } | null
  const bulgeDragRef = useRef<BulgeDragState>(null)

  // Live bulge-reshape preview: the in-flight reshaped arcs map for the dragged
  // markup + an amber flag when the drag hit the sagitta cap (D-08/D-09 fallback).
  // setState drives the ArcPreview/BulgeHandle render; the ref keeps move handlers
  // stable-deps.
  type BulgePreview = {
    markupId: string
    arcs: Record<number, { midX: number; midY: number }>
    capped: boolean
  } | null
  const [bulgePreview, setBulgePreviewState] = useState<BulgePreview>(null)
  const bulgePreviewRef = useRef<BulgePreview>(null)
  const setBulgePreview = useCallback((val: BulgePreview) => {
    bulgePreviewRef.current = val
    setBulgePreviewState(val)
  }, [])

  // Phase 12: snapshot of points when vertex edit mode was entered.
  // Used by cancelVertexEdit() to restore on Escape (RESEARCH Finding 9).
  // Set ONCE at session start in handleMarkupClick; never updated mid-session.
  const vertexEditOriginalRef = useRef<StagePoint[] | null>(null)

  // Selection-mode click-vs-hold disambiguation. Konva fires `click` on every mouseup
  // that wasn't preceded by an internal Stage drag. After commit 4db36bb removed
  // LMB from Konva.dragButtons during markup tools, every mouseup fires `click` —
  // including the release of a deliberately-held LMB (rubber-band selection gesture),
  // which would otherwise wipe the active selection or misplace a markup.
  //
  // Implementation: capture the LMB-down screen position; at click time, compare
  // the FINAL pointer position to it. If the final delta exceeds the threshold AND
  // no markup tool is active (i.e. we are in selection mode), treat the gesture as
  // a rubber-band drag and suppress the click. When a markup tool IS active there is
  // no rubber-band selection — every mouseup is a legitimate vertex/pin placement
  // regardless of how far the mouse moved between down and up.
  const markupMouseDownPosRef = useRef<{ x: number; y: number } | null>(null)

  // Clean up a rubber-band that is still active when the user releases the mouse
  // outside the Stage canvas (Stage onMouseUp never fires for out-of-bounds releases).
  // Also clear the markup-mode down-pos so a release-outside-canvas cannot leak
  // a stale down-pos into the next in-bounds click.
  useEffect(() => {
    const cleanup = () => {
      if (rubberBandRef.current) setRubberBand(null)
      markupMouseDownPosRef.current = null
      // Phase 12: clean up any active drag refs on out-of-bounds release. The Stage's own
      // onMouseUp never fires when the user releases outside the canvas; without this
      // window-level handler, a vertex- or body-drag started inside the Stage would leave
      // the ref dangling and the next mousedown would observe a stale ref.
      if (bodyDragRef.current) {
        bodyDragRef.current = null
        setDragPreview(null)
      }
      if (vertexDragRef.current) {
        vertexDragRef.current = null
        setDragPreview(null)
      }
      // Phase 14 (14-05): an out-of-bounds release abandons a bulge reshape — drop
      // the live preview without dispatching (the markup's stored arcs are intact).
      if (bulgeDragRef.current) {
        bulgeDragRef.current = null
        setBulgePreview(null)
      }
    }
    window.addEventListener('mouseup', cleanup)
    return () => window.removeEventListener('mouseup', cleanup)
  }, [setRubberBand, setDragPreview, setBulgePreview])

  // Sync viewerStore.activeTool with the markup tool state machine.
  // Guard: skip activateMarkup when mode is already non-idle — activatePreset may have
  // already transitioned the machine to 'placing'/'drawing' with chainArmed:true.
  // Calling activateMarkup in that case would erase the preset state.
  useEffect(() => {
    if (isMarkupTool(activeTool) && markupState.toolType !== activeTool && markupState.mode === 'idle') {
      activateMarkup(activeTool)
    } else if (!isMarkupTool(activeTool) && markupState.mode !== 'idle') {
      cancelMarkup()
    }
  }, [activeTool, markupState.toolType, markupState.mode, activateMarkup, cancelMarkup])

  // Phase 12: clear vertex-edit mode when activeTool moves away from 'select'.
  // Separate effect so it does not entangle with the markup-tool sync above.
  // Drag preview is also cleared so any in-progress overlay disappears.
  useEffect(() => {
    if (activeTool !== 'select') {
      clearVertexEdit()
      setDragPreview(null)
      vertexEditOriginalRef.current = null
      // Phase 14 (14-05): abandon any in-flight bulge reshape on tool change.
      bulgeDragRef.current = null
      setBulgePreview(null)
    }
  }, [activeTool, clearVertexEdit, setDragPreview, setBulgePreview])

  // Subscribe to markupStore for rendering committed markups on the current page
  const pageMarkups = useMarkupStore((s) => s.pageMarkups[currentPage] ?? EMPTY_MARKUPS)
  const getCategory = useMarkupStore((s) => s.getCategory)

  // Phase 14 (14-03 D-04/D-05): rebuild the snap spatial index whenever the
  // current page's committed geometry OR the live zoom changes (rebuild-on-change,
  // <120ms at 50k vertices per spike-002). Every markup vertex becomes a snap
  // vertex (markupId + vertexIndex); every edge a→b becomes a snap segment
  // (markupId + segmentIndex). cell = 12/currentZoom keeps the grid bucket size
  // equal to the screen-constant tolerance at the current zoom. The built index
  // is written into snapIndexRef so handleStageMouseMove reads it without taking
  // pageMarkups/zoom into its dep list (stale-closure-safe, mirrors vertexDragRef).
  useEffect(() => {
    const cell = 12 / currentZoom
    const vertices: Array<{ point: StagePoint; markupId: string; vertexIndex: number }> = []
    const segments: Array<{ a: StagePoint; b: StagePoint; markupId: string; segmentIndex: number }> = []
    for (const m of pageMarkups) {
      if (m.type === 'count') {
        // A count pin is a single snappable point (no segments).
        vertices.push({ point: m.point, markupId: m.id, vertexIndex: 0 })
        continue
      }
      const pts = m.points
      pts.forEach((p, i) => {
        vertices.push({ point: p, markupId: m.id, vertexIndex: i })
      })
      // Open polylines (linear/wall) → n-1 edges; closed polygons (area/
      // perimeter) → also include the closing edge last→first.
      const closed = m.type === 'area' || m.type === 'perimeter'
      const edgeCount = closed ? pts.length : pts.length - 1
      for (let i = 0; i < edgeCount; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        segments.push({ a, b, markupId: m.id, segmentIndex: i })
      }
    }
    snapIndexRef.current = buildSnapIndex({ vertices, segments, cell })
  }, [pageMarkups, currentZoom])

  // Hover + context-menu state for committed markups (plan 03.1-05)
  const [hoverState, setHoverState] = useState<{ id: string; x: number; y: number } | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const [tooltipShown, setTooltipShown] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [editPopup, setEditPopup] = useState<{ id: string; x: number; y: number } | null>(null)

  const handleHoverEnter = useCallback((id: string, x: number, y: number) => {
    setHoverState({ id, x, y })
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setTooltipShown(true)
    }, 200)
  }, [])

  const handleHoverLeave = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHoverState(null)
    setTooltipShown(false)
  }, [])

  const handleContextMenu = useCallback((id: string, x: number, y: number) => {
    setEditPopup(null) // close any open edit popup before opening context menu
    setContextMenu({ id, x, y })
    // Hide any active tooltip when opening the menu
    setTooltipShown(false)
    setHoverState(null)
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  // Plan 09-02: single-click selection on any markup type.
  // D-03 guard: placement always wins — clicks during a non-'select' tool are
  // ignored here so placement/draw flows behave exactly as before.
  //
  // Phase 12 (D-04 revised post-UAT): single click on a line markup (linear/area/
  // perimeter/wall) enters vertex-edit mode immediately — the vertex handles ARE
  // the selection feedback, so the accent-color halo (which visually engulfs the
  // 8px handles at low zoom) is no longer rendered for single-selected line markups.
  // Count pins still translate-only (no vertex edit), so they keep the halo as
  // their selection indicator. The original points are snapshotted into
  // vertexEditOriginalRef BEFORE entering vertex edit so cancelVertexEdit() can
  // restore them on Escape without a store round-trip.
  const handleMarkupClick = useCallback(
    (id: string) => {
      if (activeTool !== 'select') return

      const markup = pageMarkups.find((m) => m.id === id)
      if (!markup) return

      // Hand off to handleStageClick: it bubbles up next and would otherwise read
      // vertexEditMarkupId === id and trigger commitVertexEdit (because e.target.getAttr('id')
      // returns undefined on markup Groups). This ref tells handleStageClick the click
      // landed on a markup; transition already handled here.
      markupClickedRef.current = id

      // Line markup → enter vertex edit on first click (handles are the feedback).
      if (markup.type !== 'count') {
        vertexEditOriginalRef.current = [...markup.points]
        setVertexEditMarkupId(id)
        setSelectedMarkupIds([id])
        return
      }

      // Count pin (no vertices) → select only; halo is the visual feedback.
      clearVertexEdit()
      vertexEditOriginalRef.current = null
      setSelectedMarkupIds([id])
    },
    [activeTool, pageMarkups, setSelectedMarkupIds, setVertexEditMarkupId, clearVertexEdit]
  )

  // Phase 12 (D-06): commit vertex edit — CLEANUP ONLY.
  // Clears the live drag preview and exits vertex edit mode. The vertex-position
  // store dispatch happens ONLY in handleStageMouseUp during the drag-release event
  // (Plan 12-05). Do NOT add any per-vertex moveVertex forEach here — that would
  // create N undo entries per session (one Enter requires N undos to reverse).
  // See .planning/phases/12-markup-geometry-editing/.continue-here.md blocking anti-pattern.
  const commitVertexEdit = useCallback(() => {
    setDragPreview(null)
    clearVertexEdit()
    vertexEditOriginalRef.current = null
  }, [clearVertexEdit, setDragPreview])

  // Phase 12 (D-06): cancel vertex edit — restores via vertexEditOriginalRef snapshot.
  // The renderer reads the snapshot through overridePoints (or the absence of a
  // drag preview, which falls back to the markup's own points). On cancel we simply
  // drop the drag preview and clear vertex edit; the underlying markup.points were
  // never mutated during the session, so the markup reverts visually with no store work.
  const cancelVertexEdit = useCallback(() => {
    setDragPreview(null)
    clearVertexEdit()
    vertexEditOriginalRef.current = null
  }, [clearVertexEdit, setDragPreview])

  // Confirmation toast state
  const [toast, setToast] = useState<{ ratioText: string } | null>(null)

  // Dismiss toast on page change (MEDIUM #3 — persistent toast)
  useEffect(() => {
    setToast(null)
  }, [currentPage])

  // Dismiss hover tooltip + context menu on page change (plan 03.1-05)
  // Phase 6: also clear the panel-driven pulse on page change (T-06-07-02).
  useEffect(() => {
    // Phase 13 (D-26 / Pitfall 1): page navigation during re-open treats as implicit Esc —
    // restore the original markup, re-push the 'place' command, clear the snapshot, and
    // reset the in-progress draw state. Without this, the user would cross to another
    // page mid-re-open and lose the original.
    const reopenSnapshot = getReopenSnapshot()
    if (reopenSnapshot) {
      useMarkupStore.getState().restoreFromReopen(reopenSnapshot)
      useMarkupStore.getState().repushPlaceForReopenCancel(reopenSnapshot)
      setReopenSnapshot(null)
      cancelMarkup()
    }
    setHoverState(null)
    setTooltipShown(false)
    setContextMenu(null)
    setEditPopup(null)
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    // Phase 6: clear pulse on page change so stale HoverRing/PulseHighlight don't
    // persist across navigation. clearHover is handled by App.tsx via setHoverMatches([])
    // through TotalsPanel's onRowHover when the mouse leaves the row.
    props.onPulseComplete?.()
    // Phase 12: clear vertex-edit mode and drag-preview on page change so handles
    // and live drag overlays don't persist across navigation.
    clearVertexEdit()
    setDragPreview(null)
    vertexEditOriginalRef.current = null
    // Phase 14 (14-05): drop any in-flight bulge reshape on page navigation.
    bulgeDragRef.current = null
    setBulgePreview(null)
  }, [currentPage, cancelMarkup, clearVertexEdit, setDragPreview, setBulgePreview, props.onPulseComplete])

  // Dismiss toast when a new calibration run starts (MEDIUM #3)
  useEffect(() => {
    if (calibState.mode === 'drawing') {
      setToast(null)
    }
  }, [calibState.mode])

  // Recompute popup position when container resizes while confirming
  useEffect(() => {
    if (calibState.mode === 'confirming') {
      recomputePopupPos()
    }
  }, [containerSize, calibState.mode, recomputePopupPos])

  // Escape key cancels active markup draw/place/name/confirm (D-07).
  // Plan 09-02 extension: when already in 'select' mode (no active markup
  // flow), Escape clears the selectedMarkupIds — matches the must_have
  // "Pressing Escape in 'select' mode deselects".
  // Plan 09-03 extension: Enter key commits an in-progress Linear/Wall (>=2
  // points) or Area/Perimeter (>=3 points) markup. The commit uses
  // markupState.points ONLY — the floating hover/preview point is NOT
  // appended. finishLinear/finishPolygon operate on markupState.points
  // (the array of CLICKED vertices), so this is correct by construction;
  // do NOT add any code that reads stage.getPointerPosition() before the
  // finish call. isTextInputActive() guard prevents the global Enter from
  // firing while a popup name-input is focused (Pitfall 5).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        // Phase 12 D-06: Escape in vertex edit mode restores original vertex positions
        // (drag-preview is dropped; markup.points were never mutated mid-session, so
        // the markup reverts visually with no store work).
        // Read fresh from the store so this effect's dep array can omit vertexEditMarkupId.
        if (useViewerStore.getState().vertexEditMarkupId !== null) {
          e.preventDefault()
          cancelVertexEdit()
          return
        }
        // Phase 13: post-commit re-open cancel. NOTE: the snapshot restore (markup,
        // place command, setReopenSnapshot(null)) is owned by useMarkupTool's window
        // keydown listener so it fires even when CanvasViewport is not mounted (test
        // harness compatibility). Here we ONLY handle the activeTool reset, which
        // requires the outer-component setActiveTool that useMarkupTool does not own.
        // The fall-through to the mode-based cancel branch handles cancelMarkup —
        // markupState.mode === 'drawing' is the post-activatePreset state.
        if (
          markupState.mode === 'drawing' ||
          markupState.mode === 'confirming' ||
          markupState.mode === 'naming' ||
          markupState.mode === 'placing'
        ) {
          e.preventDefault()
          cancelMarkup()
          useViewerStore.getState().setActiveTool('select')
          return
        }
        // No active markup flow: if we're in 'select' mode, deselect.
        // Read activeTool fresh from the store so this effect doesn't need
        // to re-subscribe when only the selection contents change.
        if (useViewerStore.getState().activeTool === 'select') {
          clearSelection()
        }
        return
      }

      // Plan 09-03 / D-26 / D-27: Enter key commits in-progress markup.
      if (e.key === 'Enter') {
        // Phase 12 D-06: Enter commits vertex edit (cleanup-only — the vertex-position
        // dispatch happens at drag-release in handleStageMouseUp, Plan 12-05).
        if (useViewerStore.getState().vertexEditMarkupId !== null) {
          if (isTextInputActive()) return
          e.preventDefault()
          commitVertexEdit()
          return
        }
        if (isTextInputActive()) return
        if (markupState.mode !== 'drawing') return
        if (markupState.toolType === 'linear' || markupState.toolType === 'wall') {
          if (markupState.points.length >= 2) {
            e.preventDefault()
            finishLinear()
          }
          // else: silent ignore per D-26 (degenerate shape)
          return
        }
        if (markupState.toolType === 'area' || markupState.toolType === 'perimeter') {
          if (markupState.points.length >= 3) {
            e.preventDefault()
            finishPolygon()
          }
          // else: silent ignore per D-26 (degenerate shape)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    markupState.mode,
    markupState.toolType,
    markupState.points.length,
    cancelMarkup,
    clearSelection,
    finishLinear,
    finishPolygon,
    cancelVertexEdit,
    commitVertexEdit
  ])

  // Auto-dismiss error toast after 3s
  useEffect(() => {
    if (!markupState.errorToast) return
    const id = setTimeout(() => {
      dismissError()
    }, 3000)
    return () => clearTimeout(id)
  }, [markupState.errorToast, dismissError])

  // Chain auto-commit: when chain is armed and shape finishes (mode → 'confirming'),
  // bypass the popup and commit immediately with the stored pending values.
  // stateRef.current is updated before this effect fires (hook effects run first in declaration order).
  useEffect(() => {
    if (
      markupState.mode === 'confirming' &&
      markupState.chainArmed &&
      markupState.pendingName
    ) {
      commitShape({
        name: markupState.pendingName,
        categoryName: markupState.pendingCategoryName,
        color: markupState.pendingColor,
        wallHeight: markupState.pendingWallHeight
      })
    }
  }, [
    markupState.mode,
    markupState.chainArmed,
    markupState.pendingName,
    markupState.pendingCategoryName,
    markupState.pendingColor,
    markupState.pendingWallHeight,
    commitShape
  ])

  // Reset start-vertex hover when drawing ends or tool cancels
  useEffect(() => {
    if (markupState.mode !== 'drawing') {
      setIsOverStartPoint(false)
    }
  }, [markupState.mode])

  // Apply viewport state to stage when page changes or loads
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !pageSize) return

    const vp = getViewport(currentPage)

    // If this page has never been viewed, fit to window
    if (vp.zoom === 1 && vp.panX === 0 && vp.panY === 0) {
      const fitScale = calculateFitScale()
      const centerX = (containerSize.width - pageSize.width * fitScale) / 2
      const centerY = (containerSize.height - pageSize.height * fitScale) / 2
      stage.scale({ x: fitScale, y: fitScale })
      stage.position({ x: centerX, y: centerY })
      // Store the fit state
      setViewport(currentPage, { zoom: fitScale, panX: centerX, panY: centerY })
    } else {
      stage.scale({ x: vp.zoom, y: vp.zoom })
      stage.position({ x: vp.panX, y: vp.panY })
    }
  }, [currentPage, pageSize, containerSize, getViewport, setViewport, calculateFitScale])

  // Sync stage transform back to store on drag end
  const handleDragEnd = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const pos = stage.position()
    const scale = stage.scaleX()
    setViewport(currentPage, { zoom: scale, panX: pos.x, panY: pos.y })
  }, [currentPage, setViewport])

  // fitToWindow function for toolbar button and keyboard shortcut
  const fitToWindow = useCallback(() => {
    const stage = stageRef.current
    if (!stage || !pageSize) return
    const fitScale = calculateFitScale()
    const centerX = (containerSize.width - pageSize.width * fitScale) / 2
    const centerY = (containerSize.height - pageSize.height * fitScale) / 2
    stage.scale({ x: fitScale, y: fitScale })
    stage.position({ x: centerX, y: centerY })
    setViewport(currentPage, { zoom: fitScale, panX: centerX, panY: centerY })
  }, [currentPage, pageSize, containerSize, calculateFitScale, setViewport])

  // Expose canvas control functions via module-level ref
  useEffect(() => {
    _canvasControls = { zoomIn, zoomOut, fitToWindow }
    return () => {
      _canvasControls = null
    }
  }, [zoomIn, zoomOut, fitToWindow])

  // Expose calibration control functions via module-level ref
  useEffect(() => {
    _calibrationControls = {
      activate,
      activateVerify,
      cancel
    }
    return () => {
      _calibrationControls = null
    }
  }, [activate, activateVerify, cancel])

  // Expose activatePreset to the setChainArmedFromTotals module-level setter
  useEffect(() => {
    _activatePresetRef = activatePreset
    return () => {
      _activatePresetRef = null
    }
  }, [activatePreset])

  // Populate _chainArmedItem so Toolbar can render the chain badge chip without prop drilling
  useEffect(() => {
    _chainArmedItem = (markupState.chainArmed && markupState.pendingName)
      ? { name: markupState.pendingName, color: markupState.pendingColor }
      : null
  }, [markupState.chainArmed, markupState.pendingName, markupState.pendingColor])

  // Keyboard shortcuts
  // Note: openProject, saveProject, saveProjectAs are wired in App.tsx (Plan 04-04 Task 3).
  // CanvasViewport passes no-op stubs here to satisfy the updated interface; App.tsx
  // owns the actual handlers via useKeyboardShortcuts at the top level.
  useKeyboardShortcuts({
    openPdf: openPdfDialog,
    openProject: openPdfDialog,
    saveProject: () => {},
    saveProjectAs: () => {},
    zoomIn,
    zoomOut,
    fitToWindow,
    exportBoq: () => {}
  })

  // Phase 14 (14-03 D-04/D-05/D-07): resolve a snap candidate for a page-space
  // cursor point and publish the glyph state. Returns the snapped page-point to
  // use in place of the raw cursor (or the raw cursor unchanged when nothing is
  // in tolerance or snapping is off/suspended). `exclude` carries the D-07
  // in-progress/edited-markup restriction (start-vertex-only + dragged-vertex
  // block). Reads snapEnabled/snapSuspended via getState() so the callers' dep
  // lists stay narrow; the index lives in snapIndexRef (rebuilt by the effect).
  const resolveSnapAt = useCallback(
    (pt: StagePoint, exclude?: SnapExclude): StagePoint => {
      const enabled = useViewerStore.getState().snapEnabled
      const suspended = useViewerStore.getState().snapSuspended
      const index = snapIndexRef.current
      if (!enabled || suspended || !index) {
        setSnapCandidate(null)
        return pt
      }
      const liveZoom = useViewerStore.getState().pageViewports[currentPage]?.zoom ?? 1
      const tol = 12 / liveZoom
      const candidate = resolveSnap(index, pt, tol, exclude)
      setSnapCandidate(candidate)
      // Override the cursor's page-point with the snapped point so the placed/
      // dragged geometry lands exactly where the □/△ glyph is drawn.
      return candidate ? candidate.point : pt
    },
    [currentPage]
  )

  // Handle Stage click — routes to calibration or markup tool as appropriate
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      // Rubber-band drag suppression (selection mode only): compare the FINAL pointer
      // position to the captured LMB-down position. The displacement guard is SKIPPED
      // when a markup tool is active — in markup mode there is no rubber-band selection
      // so rapid clicks with natural hand movement (drifting >4px between down and up)
      // must still register as vertex/pin placements. The guard ONLY applies in select
      // mode to prevent a rubber-band drag from accidentally placing a markup on release.
      // The ref is cleared unconditionally so a single gesture never leaks into the next.
      const downPos = markupMouseDownPosRef.current
      markupMouseDownPosRef.current = null
      const wasDragged =
        downPos !== null &&
        !isMarkupTool(activeTool) &&
        (Math.abs(pointer.x - downPos.x) > 4 || Math.abs(pointer.y - downPos.y) > 4)

      // Calibration path (existing)
      if (calibState.mode === 'drawing') {
        recordClick({ x: pointer.x, y: pointer.y })
        return
      }

      // Markup path
      if (markupState.mode === 'drawing' || markupState.mode === 'placing') {
        if (wasDragged) return // held-and-moved: do not place a point
        // Polygon close check: if area/perimeter, hovering start vertex, and 3+ points placed
        if (
          (markupState.toolType === 'area' || markupState.toolType === 'perimeter') &&
          markupState.mode === 'drawing' &&
          isOverStartPoint &&
          markupState.points.length >= 3
        ) {
          finishPolygon()
          setIsOverStartPoint(false)
          return
        }
        // Phase 14 (14-04 D-01/D-02): arc-edge 3-click gesture routing. When arc
        // mode is active (one-off held OR sticky) and a multi-point shape is mid-
        // draw with at least one vertex placed, feed the click into the arc
        // capture state machine instead of placing a plain straight vertex.
        const arcActive =
          (markupState.arcHeld || markupState.arcMode === 'sticky') &&
          markupState.mode === 'drawing' &&
          (markupState.toolType === 'linear' ||
            markupState.toolType === 'area' ||
            markupState.toolType === 'perimeter' ||
            markupState.toolType === 'wall') &&
          markupState.points.length > 0
        if (arcActive) {
          const rawArcPt = stage.getAbsoluteTransform().copy().invert().point(pointer)
          // The SECOND click is the on-arc shaping point — a FREE point (D-01,
          // UI-SPEC): snapping is SUPPRESSED for it. The THIRD (end) click is an
          // endpoint and DOES snap. arcOnArc===null ⟺ the next click is the
          // on-arc shaping click.
          const isOnArcClick = markupState.arcOnArc === null
          const arcPt = isOnArcClick
            ? rawArcPt
            : resolveSnapAt(rawArcPt, {
                markupId: IN_PROGRESS_MARKUP_ID,
                allowVertexIndices: [0]
              })
          const screenArc = stage.getAbsoluteTransform().copy().point(arcPt)
          recordArcClick({ x: screenArc.x, y: screenArc.y })
          return
        }

        // Phase 14 (14-03 D-05/D-07): snap the placed point so the committed
        // vertex lands exactly where the □/△ glyph was drawn on the preview.
        // Convert pointer→page, resolve snap, convert the snapped page-point
        // back to screen coords for recordMarkupClick (which converts internally).
        const rawClickPt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        const snappedClick = resolveSnapAt(rawClickPt, {
          markupId: IN_PROGRESS_MARKUP_ID,
          allowVertexIndices: [0]
        })
        const screenClick = stage.getAbsoluteTransform().copy().point(snappedClick)
        recordMarkupClick({ x: screenClick.x, y: screenClick.y })
        return
      }

      // Plan 09-02 / D-05: in 'select' mode, clicking empty stage canvas
      // deselects all markups. e.target is the Stage itself only when the
      // click missed every interactive shape (the markup Groups in Layer 1b).
      // Guard: if a rubber-band drag just completed, Konva still fires click
      // (no Konva drag was active so _mouseListenClick was never set to false).
      // Skip clearSelection() in that case so the rubber-band result survives.
      if (activeTool === 'select') {
        // Phase 12 D-06: click-outside commits vertex edit mode.
        // Guard: do NOT commit if a vertex drag is still active (the release of the drag
        // fires a click event after handleStageMouseUp clears vertexDragRef — at that point
        // bodyDraggedRef-style suppression would also work, but the natural guard here is
        // simpler: vertexDragRef is already null by click-time and the prior drag's effect
        // is already in the store). Also gate on body / rubber-band drag flags so a click
        // that is the trailing release of a body drag or rubber-band gesture does NOT
        // commit vertex edit.
        //
        // "Click outside" = anything that is not the vertex-edit markup's own handle. The
        // handle clicks never reach this handler (Konva cancelBubble in VertexHandleOverlay
        // suppresses bubbling to the Stage onClick). So any click reaching this point is
        // either on empty stage (e.target === stage) or on a different markup body.
        const liveVeId = useViewerStore.getState().vertexEditMarkupId
        // Consume the markup-click handoff ref. If non-null, the click landed on a markup
        // and handleMarkupClick (which bubbles up FIRST per Konva event order) has already
        // routed the vertex-edit transition correctly. In that case we must NOT call
        // commitVertexEdit — it would clear the vertex-edit ID handleMarkupClick just set,
        // and the handles would never become visible. Consume-on-read so the next click
        // re-evaluates cleanly.
        const clickedMarkupId = markupClickedRef.current
        markupClickedRef.current = null
        if (
          liveVeId !== null &&
          clickedMarkupId === null &&
          vertexDragRef.current === null &&
          !bodyDraggedRef.current &&
          !rubberBandDraggedRef.current
        ) {
          // Click landed on empty stage while a vertex-edit session was active → commit it.
          commitVertexEdit()
        }

        if (rubberBandDraggedRef.current) {
          rubberBandDraggedRef.current = false
          return
        }
        // Phase 12 (12-04): body-drag suppression — mirrors rubberBandDraggedRef pattern.
        // Konva fires click after a body-drag mouseup (no internal Konva drag was active);
        // without this guard, e.target on the dragged markup would route through the
        // existing markup-onClick flow which is fine, BUT if the drag released over
        // empty stage area (e.target === stage), clearSelection() would wipe the
        // selection we just translated. Either case: suppress the post-drag click.
        if (bodyDraggedRef.current) {
          bodyDraggedRef.current = false
          return
        }
        if (e.target === stageRef.current) {
          clearSelection()
        }
      }
    },
    [calibState.mode, markupState.mode, markupState.toolType, markupState.points.length, markupState.arcHeld, markupState.arcMode, markupState.arcOnArc, isOverStartPoint, stageRef, recordClick, recordMarkupClick, recordArcClick, finishPolygon, activeTool, clearSelection, commitVertexEdit, resolveSnapAt]
  )

  // Plan 09-03: rubber-band drag (D-06).
  // onMouseDown in 'select' mode with LMB and no spacebar starts the rubber-band.
  // Konva.dragButtons (useViewportControls) is [1] in select mode, so the Stage
  // will NOT pan for LMB — that frees LMB for this drag.
  // stopPropagation on the native event prevents Konva DD from registering a
  // window-level pointermove interceptor that would swallow subsequent move events.
  //
  // Also: in markup-tool mode, capture the LMB-down screen position so
  // handleStageMouseMove can flag a "held-and-moved" gesture and
  // handleStageClick can suppress placement on the release.
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return // LMB only
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      // Markup-mode hold tracking: capture the LMB-down screen position so
      // handleStageClick can compute final-delta and decide click-vs-drag.
      // Runs regardless of whether a markup draw is in progress so a click
      // that would START a markup is also subject to the same gate.
      if (isMarkupTool(activeTool) && !spaceHeld) {
        markupMouseDownPosRef.current = { x: pointer.x, y: pointer.y }
      }

      // Phase 12 D-07/D-08: body-drag branch — fires when a selected markup was mousedown'd.
      // markupBodyDownRef is set by the markup component's onMarkupMouseDown BEFORE this
      // Stage-level handler fires (Konva child events bubble up first).
      // CRITICAL: read pageMarkups via useMarkupStore.getState() — the closed-over `pageMarkups`
      // from the React selector is stale inside this useCallback at click-time.
      const bodyTargetId = markupBodyDownRef.current
      markupBodyDownRef.current = null  // consume immediately — prevent double-trigger
      if (
        bodyTargetId &&
        activeTool === 'select' &&
        !spaceHeld &&
        selectedMarkupIds.includes(bodyTargetId)
      ) {
        e.evt.stopPropagation()  // prevent rubber-band from starting
        const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        // Snapshot start positions for all selected markups — read from store snapshot, not stale closure.
        const currentPageMarkups = useMarkupStore.getState().pageMarkups[currentPage] ?? []
        const startPositions: Record<string, StagePoint | StagePoint[]> = {}
        for (const id of selectedMarkupIds) {
          const markup = currentPageMarkups.find((m) => m.id === id)
          if (!markup) continue
          if (markup.type === 'count') {
            startPositions[id] = { ...markup.point }
          } else {
            startPositions[id] = [...markup.points]
          }
        }
        bodyDragRef.current = {
          ids: [...selectedMarkupIds],
          origin: pt,
          startPositions
        }
        return  // suppress rubber-band
      }

      // Phase 12 (12-05): defensive safety net — if vertexDragRef was set by
      // onHandleMouseDown (child fires first via Konva bubbling, with cancelBubble=true on
      // the Rect's mousedown that should suppress the Stage handler), make sure we don't
      // ALSO start a rubber-band. Under normal flow cancelBubble keeps this branch from
      // ever firing for handle clicks; this guard catches any edge case where bubble-cancel
      // was missed (e.g. event replay, focus weirdness).
      if (vertexDragRef.current !== null && activeTool === 'select') {
        e.evt.stopPropagation()
        return
      }

      if (activeTool !== 'select') return
      if (spaceHeld) return // spacebar-held override: LMB pans the stage
      e.evt.stopPropagation()
      const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
      setRubberBand({ startX: pt.x, startY: pt.y, endX: pt.x, endY: pt.y })
    },
    [activeTool, spaceHeld, selectedMarkupIds, currentPage, stageRef, setRubberBand]
  )

  // Handle Stage mousemove — update preview point for calibration or markup drawing.
  // Plan 09-03: also update the rubber-band end-point while a drag is in progress.
  // Reads rubberBandRef.current (not the closure value) so this callback does NOT
  // need rubberBand in its deps — prevents the listener-swap cycle that caused
  // rubber-band updates to be missed on every state change.
  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      // Phase 14 (14-05 D-08): bulge-drag live preview — reshape the dragged arc
      // edge's curvature. The on-arc midpoint follows the cursor (page-space),
      // CLAMPED to the sagitta cap. Snapping is NOT applied — curvature shaping is
      // a free gesture (like the on-arc draw click). Checked FIRST: a bulge drag
      // and a vertex/body drag are mutually exclusive at the down event.
      const bg = bulgeDragRef.current
      if (bg) {
        const rawPt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        const liveMarkups =
          useMarkupStore.getState().pageMarkups[currentPage] ?? EMPTY_MARKUPS
        const markup = liveMarkups.find((m) => m.id === bg.markupId)
        if (markup && markup.type !== 'count') {
          const n = markup.points.length
          const from = markup.points[bg.segmentIndex]
          const to = markup.points[(bg.segmentIndex + 1) % n]
          if (from && to) {
            const { point: capped, clamped } = clampBulgeToSagittaCap(from, to, rawPt)
            const nextArcs = {
              ...(bg.originalArcs ?? {}),
              [bg.segmentIndex]: { midX: capped.x, midY: capped.y }
            }
            setBulgePreview({ markupId: bg.markupId, arcs: nextArcs, capped: clamped })
          }
        }
        return
      }

      // Phase 12 (12-05): vertex drag live preview — recompute the dragged markup's points
      // with only the dragged vertex moved, push to dragPreview so the renderer reflects it.
      // Read pageMarkups via getState() (stale-closure anti-pattern guard from .continue-here.md).
      // Placed BEFORE body-drag check because vertex drag and body drag are mutually exclusive
      // at the down event — defensive ordering only.
      const vd = vertexDragRef.current
      if (vd) {
        let pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        // D-07: while dragging a vertex, snap to OTHER markups freely but never
        // to this markup's own dragged vertex (blockVertexIndex). The override
        // mutates pt BEFORE it flows into the live preview below.
        pt = resolveSnapAt(pt, { markupId: vd.markupId, blockVertexIndex: vd.vertexIndex })
        const livePageMarkups =
          useMarkupStore.getState().pageMarkups[currentPage] ?? EMPTY_MARKUPS
        const markup = livePageMarkups.find((m) => m.id === vd.markupId)
        if (markup && markup.type !== 'count') {
          const newPoints = markup.points.map((p, i) =>
            i === vd.vertexIndex ? pt : p
          )
          setDragPreview({
            type: 'vertex',
            markupId: vd.markupId,
            vertexIndex: vd.vertexIndex,
            points: newPoints
          })
        }
        return
      }

      // Phase 12 (12-04): body-drag live preview — update delta for all dragged markups.
      // Read via bodyDragRef.current (stable across renders) so this callback's deps stay narrow.
      const bd = bodyDragRef.current
      if (bd) {
        let pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        // D-07: a body-drag moves the whole markup(s); exclude every dragged
        // markup from snapping (passing each id would require multiple excludes,
        // so we exclude the first/primary dragged id — the dragged markups never
        // self-snap). The override mutates pt BEFORE the deltas are computed.
        pt = resolveSnapAt(pt, { markupId: bd.ids[0] })
        const dx = pt.x - bd.origin.x
        const dy = pt.y - bd.origin.y
        const deltas: Record<string, { x: number; y: number }> = {}
        for (const id of bd.ids) {
          deltas[id] = { x: dx, y: dy }
        }
        setDragPreview({ type: 'body', deltas })
        return
      }

      const rb = rubberBandRef.current
      if (rb) {
        const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        setRubberBand({ ...rb, endX: pt.x, endY: pt.y })
        return
      }

      if (calibState.mode === 'drawing' && calibState.startPoint) {
        updatePreview({ x: pointer.x, y: pointer.y })
        return
      }
      if (markupState.mode === 'drawing' && markupState.points.length > 0) {
        // Placement preview: convert the raw pointer to page-space, resolve the
        // snap (D-05), then feed the snapped page-point back to the preview as
        // SCREEN coords (updateMarkupPreview converts screen→page internally).
        // The override mutates the placed point BEFORE updateMarkupPreview
        // consumes it. D-07: the in-progress markup contributes only its start
        // vertex (close-the-loop) — passed via allowVertexIndices=[0] on the
        // IN_PROGRESS_MARKUP_ID sentinel (never present in the committed index,
        // so this only documents the close-the-loop restriction).
        //
        // Phase 14 (14-04 D-01): while moving toward the ON-ARC shaping click
        // (arc mode active AND no on-arc point captured yet), the provisional
        // point is the free shaping point — snapping is SUPPRESSED so the live
        // 2-point preview tracks the raw cursor. Once the on-arc point is set,
        // the cursor is the provisional END (an endpoint) and snapping applies.
        const arcShapingMove =
          (markupState.arcHeld || markupState.arcMode === 'sticky') &&
          markupState.arcOnArc === null &&
          (markupState.toolType === 'linear' ||
            markupState.toolType === 'area' ||
            markupState.toolType === 'perimeter' ||
            markupState.toolType === 'wall')
        const rawPt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        const resolved = arcShapingMove
          ? rawPt
          : resolveSnapAt(rawPt, {
              markupId: IN_PROGRESS_MARKUP_ID,
              allowVertexIndices: [0]
            })
        const screen = stage.getAbsoluteTransform().copy().point(resolved)
        updateMarkupPreview({ x: screen.x, y: screen.y })
      } else {
        // Not placing — clear any lingering glyph (snapping shows only during
        // an active placement/edit gesture).
        if (snapCandidate !== null) setSnapCandidate(null)
      }
    },
    [calibState.mode, calibState.startPoint, markupState.mode, markupState.points.length, markupState.arcHeld, markupState.arcMode, markupState.arcOnArc, markupState.toolType, stageRef, updatePreview, updateMarkupPreview, setRubberBand, setDragPreview, currentPage, resolveSnapAt, snapCandidate]
  )

  // Plan 09-03: rubber-band release (D-07, D-09).
  // On mouseup, compute the markups whose FULL bbox is inside the rubber-band
  // rectangle and set them as the selection. Single-id and multi-id deletes
  // are handled by the existing Delete-key handler in useKeyboardShortcuts
  // (Wave 1) — this handler only sets selectedMarkupIds and does not delete.
  // Reads rubberBandRef.current so this callback is stable across rubber-band updates.
  const handleStageMouseUp = useCallback(() => {
    // Phase 12 (12-05): vertex drag commit — fires BEFORE body-drag and rubber-band checks
    // because the three drag gestures are mutually exclusive at the down event, but defensive
    // ordering (vertex → body → rubber-band) ensures the vertex commit path is isolated.
    //
    // Anti-pattern guard (.continue-here.md): the ONE moveVertex dispatch happens HERE,
    // once per drag session — NOT inside commitVertexEdit (which stays cleanup-only). One
    // drag = one undo entry. Vertex edit mode stays active after release so the user may
    // drag another handle.
    //
    // D-09 threshold note (post-UAT): D-09 specifies "4 screen pixels". dx/dy below are
    // page-space (the inverse stage transform converts screen → page), so the threshold
    // must be divided by currentZoom to stay screen-pixel constant. Without this, at 800%
    // zoom the threshold becomes 4 page-units × 8 = 32 screen pixels — small vertex nudges
    // never register. Read currentZoom via getState() so this callback's dep list stays
    // narrow (no re-registration on every zoom step).
    const liveZoom =
      useViewerStore.getState().pageViewports[currentPage]?.zoom ?? 1
    const dragThreshold = 4 / liveZoom

    // Phase 14 (14-05 D-08): bulge-drag commit — ONE reshapeArc dispatch per drag
    // session, mirroring the vertex-drag pattern below. The dispatch happens HERE in
    // handleStageMouseUp (the locked anti-pattern: never in a cleanup helper). The
    // live bulgePreview already holds the clamped reshaped arcs; commit it if the
    // handle moved beyond the click-vs-drag threshold.
    const bg = bulgeDragRef.current
    if (bg) {
      const stage = stageRef.current
      const pointer = stage?.getPointerPosition()
      const preview = bulgePreviewRef.current
      if (stage && pointer && preview && preview.markupId === bg.markupId) {
        // Compare the new on-arc mid to the original to gate click-vs-drag.
        const original = bg.originalArcs?.[bg.segmentIndex]
        const next = preview.arcs[bg.segmentIndex]
        const movedEnough =
          !original ||
          Math.abs(next.midX - original.midX) > dragThreshold ||
          Math.abs(next.midY - original.midY) > dragThreshold
        if (movedEnough) {
          useMarkupStore.getState().reshapeArc(bg.markupId, currentPage, preview.arcs)
        }
      }
      bulgeDragRef.current = null
      setBulgePreview(null)
      return
    }

    const vd = vertexDragRef.current
    if (vd) {
      const stage = stageRef.current
      const pointer = stage?.getPointerPosition()
      if (stage && pointer) {
        const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        const dx = pt.x - vd.origin.x
        const dy = pt.y - vd.origin.y
        // D-09 4-screen-pixel movement threshold — below threshold is a click (no dispatch),
        // above is a real drag. dx/dy are page-space, so threshold is also page-space (4/zoom).
        const moved = Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold
        if (moved) {
          // newPoint = the live preview's vertex position when available, else origin + delta.
          // Either path gives the same result; preview is preferred because handleStageMouseMove
          // writes it via the same inverse-transform path on every frame.
          const previewPoints =
            dragPreviewRef.current?.type === 'vertex'
              ? dragPreviewRef.current.points
              : null
          const newPoint = previewPoints
            ? previewPoints[vd.vertexIndex]
            : {
                x: vd.originalPoints[vd.vertexIndex].x + dx,
                y: vd.originalPoints[vd.vertexIndex].y + dy
              }
          // Pitfall 7 no-op guard: only dispatch when the vertex actually moved relative to
          // its original position. Prevents polluting the undo stack with no-op commands.
          const orig = vd.originalPoints[vd.vertexIndex]
          if (newPoint.x !== orig.x || newPoint.y !== orig.y) {
            // Phase 14 (14-05 D-08): endpoint re-solve. If the dragged vertex is an
            // endpoint of one or more ARC edges, re-bend each so the curve follows
            // the new corner — and carry the re-solved arcs on the SAME move-vertex
            // command so ONE Ctrl+Z reverts BOTH the corner and the curvature (W-3).
            // Straight-edge drags pass no arcs (unchanged behavior).
            const liveMarkups =
              useMarkupStore.getState().pageMarkups[currentPage] ?? EMPTY_MARKUPS
            const dragged = liveMarkups.find((m) => m.id === vd.markupId)
            let newArcs: Record<number, { midX: number; midY: number }> | undefined
            if (dragged && dragged.type !== 'count' && dragged.arcs) {
              const oldPts = vd.originalPoints
              const n = oldPts.length
              const closed = dragged.type === 'area' || dragged.type === 'perimeter'
              // The two edges incident to vertex vd.vertexIndex: the incoming edge
              // (start = i-1) and the outgoing edge (start = i). Arc metadata keys on
              // the edge's START-vertex index (14-01 contract).
              const newPts = oldPts.map((p, idx) => (idx === vd.vertexIndex ? newPoint : p))
              const resolved: Record<number, { midX: number; midY: number }> = {
                ...dragged.arcs
              }
              const incomingStart = vd.vertexIndex === 0 ? (closed ? n - 1 : -1) : vd.vertexIndex - 1
              const outgoingStart = vd.vertexIndex
              const hasOutgoing = closed || vd.vertexIndex < n - 1
              for (const startIdx of [incomingStart, outgoingStart]) {
                if (startIdx < 0) continue
                if (startIdx === outgoingStart && !hasOutgoing) continue
                const arc = dragged.arcs[startIdx]
                if (!arc) continue
                const endIdx = (startIdx + 1) % n
                resolved[startIdx] = resolveArcMidForMovedEndpoint(
                  oldPts[startIdx],
                  oldPts[endIdx],
                  { x: arc.midX, y: arc.midY },
                  newPts[startIdx],
                  newPts[endIdx]
                )
              }
              newArcs = resolved
            }
            useMarkupStore
              .getState()
              .moveVertex(vd.markupId, currentPage, vd.vertexIndex, newPoint, newArcs)
          }
        }
        // Vertex edit mode stays active after a single vertex drag — the user may drag another
        // handle. Drop only the live drag preview (the store now holds the new committed
        // positions). vertexEditOriginalRef is set ONCE at session start in handleMarkupClick
        // and NEVER updated mid-session — Escape always restores to the session-start state
        // (.continue-here.md decisions section "vertexEditOriginalRef set ONCE at session start").
        setDragPreview(null)
      }
      vertexDragRef.current = null
      return
    }

    // Phase 12 (12-04): body-drag commit — fires BEFORE the rubber-band check below
    // because a body drag and a rubber-band drag are mutually exclusive at mouseDown
    // (the body branch returns early before starting rubber-band), but defensive
    // ordering keeps the body commit path isolated.
    const bd = bodyDragRef.current
    if (bd) {
      const stage = stageRef.current
      const pointer = stage?.getPointerPosition()
      if (stage && pointer) {
        const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        const dx = pt.x - bd.origin.x
        const dy = pt.y - bd.origin.y
        // D-09: 4-screen-pixel movement threshold — dx/dy are page-space so the
        // threshold is divided by currentZoom (see vertex-drag branch above).
        const moved = Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold
        if (moved) {
          // Build the move-markups command entries. Read pageMarkups from the store
          // snapshot, NOT the closed-over React state — stale closure anti-pattern (per
          // .planning/phases/12-markup-geometry-editing/.continue-here.md blocking pattern).
          const currentPageMarkups = useMarkupStore.getState().pageMarkups[currentPage] ?? []
          const moves: Array<{
            markupId: string
            page: number
            oldPoints: StagePoint[]
            newPoints: StagePoint[]
          }> = []
          for (const id of bd.ids) {
            const markup = currentPageMarkups.find((m) => m.id === id)
            if (!markup) continue
            if (markup.type === 'count') {
              moves.push({
                markupId: id,
                page: markup.page,
                oldPoints: [markup.point],
                newPoints: [{ x: markup.point.x + dx, y: markup.point.y + dy }]
              })
            } else {
              moves.push({
                markupId: id,
                page: markup.page,
                oldPoints: [...markup.points],
                newPoints: markup.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
              })
            }
          }
          // StrictMode-safe: dispatch OUTSIDE setState (PATTERNS.md StrictMode section).
          // Single translate (moves.length === 1) and group move (moves.length === N) use
          // the same single moveMarkups command per D-08 — one undo entry covers both.
          if (moves.length > 0) {
            useMarkupStore.getState().moveMarkups(moves)
          }
          // Suppress Konva click after a real drag (Pitfall 2 — mirrors rubberBandDraggedRef).
          bodyDraggedRef.current = true
        }
      }
      bodyDragRef.current = null
      setDragPreview(null)
      return  // done — do not fall through to rubber-band handler
    }

    const rb = rubberBandRef.current
    if (!rb) return
    // Only treat as a rubber-band drag when the mouse moved more than 4 screen pixels in any
    // direction. rb.start/end are page-space so the threshold is divided by currentZoom
    // (otherwise micro-bands at high zoom never register as drags).
    const moved =
      Math.abs(rb.endX - rb.startX) > dragThreshold ||
      Math.abs(rb.endY - rb.startY) > dragThreshold
    if (moved) {
      const matched = pageMarkups.filter((m) => isFullyInside(m, rb))
      if (matched.length > 0) setSelectedMarkupIds(matched.map((m) => m.id))
      // Signal handleStageClick to skip clearSelection() — Konva always fires click
      // after mouseup when _mouseListenClick=true (no Konva drag active), which would
      // immediately wipe the selection we just set.
      rubberBandDraggedRef.current = true
    }
    setRubberBand(null)
  }, [pageMarkups, currentPage, setSelectedMarkupIds, setRubberBand, setDragPreview])


  // Determine cursor based on interaction state.
  // Spacebar held = grab cursor (left-click pan mode).
  // Active calibration or markup drawing = crosshair for click placement.
  // Otherwise default.
  const getCursor = (): string => {
    if (spaceHeld) return 'grab'
    if (calibMode !== 'idle') return CROSSHAIR_CURSOR
    if (
      (markupState.toolType === 'area' || markupState.toolType === 'perimeter') &&
      markupState.mode === 'drawing' &&
      isOverStartPoint &&
      markupState.points.length >= 3
    ) {
      return 'pointer'
    }
    if (markupState.mode === 'drawing') {
      // Phase 14 (14-04 D-02): arc-mode crosshair when a one-off (held) or
      // sticky arc is armed for the next edge.
      if (markupState.arcHeld || markupState.arcMode === 'sticky') return ARC_CROSSHAIR_CURSOR
      return CROSSHAIR_CURSOR
    }
    if (markupState.toolType === 'count' && markupState.mode === 'placing') return CROSSHAIR_CURSOR
    return 'default'
  }

  // Only return null if there has NEVER been a valid render (initial state before any PDF loaded)
  if (!displayCanvas || !displayPageSize) return null

  const showNotCalibratedBadge =
    calibMode === 'idle' && !pageScale && totalPages > 0

  // Visual constants for calibration overlay
  const POINT_RADIUS = 6 / currentZoom
  const POINT_STROKE_WIDTH = 1 / currentZoom
  const LINE_STROKE_WIDTH = 2 / currentZoom
  const LINE_DASH = [8 / currentZoom, 4 / currentZoom]

  // Phase 14 (14-04 D-01): the arc edge currently being shaped. Active between
  // the on-arc click and the end click (arcOnArc captured), with a live cursor
  // preview point standing in as the provisional end. When active, the straight
  // dashed last-vertex→cursor preview is SUPPRESSED for that edge and replaced
  // by the solved ArcPreview through start → onArc → cursor.
  const arcCaptureActive =
    markupState.mode === 'drawing' &&
    markupState.arcOnArc !== null &&
    markupState.points.length > 0 &&
    markupState.previewPoint !== null
  const arcCaptureStart = arcCaptureActive
    ? markupState.points[markupState.points.length - 1]
    : null
  const arcPreviewElement =
    arcCaptureActive && arcCaptureStart && markupState.arcOnArc && markupState.previewPoint ? (
      <ArcPreview
        start={arcCaptureStart}
        onArc={markupState.arcOnArc}
        end={markupState.previewPoint}
        currentZoom={currentZoom}
        color={markupState.pendingColor ?? COLORS.accent}
      />
    ) : null
  // Note: REFERENCE_LINE_STROKE and REFERENCE_LINE_DASH will be used in Phase 4
  // when the persistent calibration line is wired to the new scaleStore API.

  // Build calibration line points for active drawing
  const calibLinePoints: number[] = (() => {
    if (calibState.startPoint && (calibState.endPoint ?? calibState.previewPoint)) {
      const end = calibState.endPoint ?? calibState.previewPoint!
      return [calibState.startPoint.x, calibState.startPoint.y, end.x, end.y]
    }
    return []
  })()

  // Build reference line points from stored scale (old viewerStore linePoints for legacy)
  // New scaleStore doesn't store linePoints — reference line is omitted for new API
  // (could be added in a future phase when we want to persist the calibration line)

  // Tooltip summary builder — count shows #sequence; linear/area/perimeter
  // include the measurement when page is calibrated, name-only otherwise.
  function buildMarkupSummary(m: Markup): string {
    if (m.type === 'count') {
      return `${m.name} — #${m.sequence}`
    }
    if (!pageScale || pageScale.pixelsPerMm <= 0) return m.name
    const unit = pageScale.displayUnit
    if (m.type === 'linear') {
      const len = pixelLengthToReal(polylineLength(m.points), pageScale.pixelsPerMm, unit)
      return `${m.name} — ${len.toFixed(1)} ${unit}`
    }
    if (m.type === 'area') {
      const areaVal = pixelAreaToReal(polygonArea(m.points), pageScale.pixelsPerMm, unit)
      return `${m.name} — ${areaVal.toFixed(1)} ${unit}²`
    }
    // perimeter
    const closed = [...m.points, m.points[0]]
    const perim = pixelLengthToReal(polylineLength(closed), pageScale.pixelsPerMm, unit)
    const areaVal = pixelAreaToReal(polygonArea(m.points), pageScale.pixelsPerMm, unit)
    return `${m.name} — P:${perim.toFixed(1)} ${unit}  A:${areaVal.toFixed(1)} ${unit}²`
  }

  const hoveredMarkup: Markup | null =
    hoverState !== null
      ? (pageMarkups.find((mm) => mm.id === hoverState.id) ?? null)
      : null
  const contextMarkup: Markup | null =
    contextMenu !== null
      ? (pageMarkups.find((mm) => mm.id === contextMenu.id) ?? null)
      : null

  // Phase 12: vertex-edit handles layer — ABOVE Layer 1b, listening=true so handle Rects
  // intercept pointer events before the markup body beneath them (RESEARCH Pitfall 5).
  // Count pins have no vertex handles (D-09). Computed as a named variable (not an inline
  // IIFE) so Plan 12-05's "replace stub onHandleMouseDown" is an unambiguous one-site edit.
  //
  // post-UAT: the handles must follow the markup during BOTH a per-vertex drag AND a
  // body-drag translate. Previously only the 'vertex' drag preview branch was honored, so
  // body-drag translates left the handles pinned to the markup's stored vertex positions
  // while the body slid under the cursor. The body-drag branch shifts every vertex by the
  // drag delta so the handles travel with the markup until mouseup commits the move.
  const vertexHandleLayer = (() => {
    if (vertexEditMarkupId === null) return null
    const veMarkup = pageMarkups.find((m) => m.id === vertexEditMarkupId)
    if (!veMarkup || veMarkup.type === 'count') return null
    let markupForHandles: Markup = veMarkup
    if (dragPreview?.type === 'vertex' && dragPreview.markupId === vertexEditMarkupId) {
      markupForHandles = { ...veMarkup, points: dragPreview.points } as Markup
    } else if (dragPreview?.type === 'body') {
      const delta = dragPreview.deltas[vertexEditMarkupId]
      if (delta) {
        const shifted = veMarkup.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }))
        markupForHandles = { ...veMarkup, points: shifted } as Markup
      }
    }
    // Phase 14 (14-05 D-08): the bulge handles sit on each arc edge's on-arc
    // midpoint. During a live bulge drag, reflect the previewed (clamped) arcs so
    // the handle tracks the cursor. The handle markup uses the SAME points as the
    // vertex handles (so endpoint drags move the bulge handles too) but the live
    // bulge-reshape arcs when a drag is active.
    let markupForBulge: Markup = markupForHandles
    if (bulgePreview && bulgePreview.markupId === vertexEditMarkupId) {
      markupForBulge = { ...markupForHandles, arcs: bulgePreview.arcs } as Markup
    }
    return (
      <Layer listening={true}>
        <BulgeHandle
          markup={markupForBulge}
          currentZoom={currentZoom}
          onHandleMouseDown={(segmentIndex) => {
            // Phase 14 (14-05 D-08): start a bulge-curvature drag. The Circle's
            // e.cancelBubble=true (BulgeHandle) suppresses the Stage onMouseDown,
            // so this callback is the drag entry point (mirrors the vertex handle).
            const liveId = useViewerStore.getState().vertexEditMarkupId
            if (liveId === null) return
            const livePageMarkups =
              useMarkupStore.getState().pageMarkups[currentPage] ?? EMPTY_MARKUPS
            const markup = livePageMarkups.find((m) => m.id === liveId)
            if (!markup || markup.type === 'count') return
            bulgeDragRef.current = {
              markupId: liveId,
              segmentIndex,
              originalArcs: markup.arcs
            }
          }}
        />
        <VertexHandleOverlay
          markup={markupForHandles}
          currentZoom={currentZoom}
          onHandleMouseDown={(vertexIndex) => {
            // Phase 12 (12-05): start a vertex drag. The mousedown on the Rect already set
            // e.cancelBubble = true in VertexHandleOverlay (VertexHandleOverlay.tsx:75-76),
            // so the Stage onMouseDown will NOT fire for this gesture. We use this callback
            // (not the Stage handler) as the vertex drag entry point.
            //
            // Read pageMarkups via getState() — stale-closure anti-pattern guard from
            // .planning/phases/12-markup-geometry-editing/.continue-here.md.
            const liveId = useViewerStore.getState().vertexEditMarkupId
            if (liveId === null) return
            const livePageMarkups =
              useMarkupStore.getState().pageMarkups[currentPage] ?? EMPTY_MARKUPS
            const markup = livePageMarkups.find((m) => m.id === liveId)
            if (!markup || markup.type === 'count') return
            const stage = stageRef.current
            if (!stage) return
            const pointer = stage.getPointerPosition()
            if (!pointer) return
            const origin = stage.getAbsoluteTransform().copy().invert().point(pointer)
            vertexDragRef.current = {
              markupId: liveId,
              vertexIndex,
              origin,
              originalPoints: [...markup.points]
            }
          }}
        />
      </Layer>
    )
  })()

  // Phase 14 (14-05 D-08): live bulge-reshape arc preview. While a bulge handle is
  // being dragged, render the solved dashed arc for that edge through its current
  // (clamped) on-arc mid. The guide turns amber (COLORS.warning) when the drag hit
  // the sagitta cap (the soft "max bend" stop, UI-SPEC). listening=false transient.
  const bulgePreviewElement = (() => {
    if (!bulgePreview) return null
    const markup = pageMarkups.find((m) => m.id === bulgePreview.markupId)
    if (!markup || markup.type === 'count') return null
    const n = markup.points.length
    const segments = Object.keys(bulgePreview.arcs).map(Number)
    return (
      <Layer listening={false}>
        {segments.map((segIdx) => {
          const from = markup.points[segIdx]
          const to = markup.points[(segIdx + 1) % n]
          const mid = bulgePreview.arcs[segIdx]
          if (!from || !to || !mid) return null
          return (
            <ArcPreview
              key={segIdx}
              start={from}
              onArc={{ x: mid.midX, y: mid.midY }}
              end={to}
              currentZoom={currentZoom}
              color={bulgePreview.capped ? COLORS.warning : markup.color}
            />
          )
        })}
      </Layer>
    )
  })()

  return (
    <div
      ref={containerCallbackRef}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#141414',
        backgroundImage:
          'radial-gradient(circle, #1e1e1e 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        overflow: 'hidden',
        cursor: getCursor()
      }}
    >
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        draggable={isDraggable}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        {/* Layer 0: PDF background */}
        <Layer listening={false}>
          <KonvaImage
            image={displayCanvas}
            width={displayPageSize.width}
            height={displayPageSize.height}
          />
        </Layer>
        {/* Layer 1a: Non-interactive calibration + in-progress linear preview */}
        <Layer listening={false}>
          {/* Active calibration / verify visuals */}
          {(calibState.mode === 'drawing' || calibState.mode === 'confirming') && (
            <>
              {calibState.startPoint && (
                <Circle
                  x={calibState.startPoint.x}
                  y={calibState.startPoint.y}
                  radius={POINT_RADIUS}
                  fill={COLORS.accent}
                  stroke="#ffffff"
                  strokeWidth={POINT_STROKE_WIDTH}
                  listening={false}
                />
              )}
              {(calibState.endPoint ?? calibState.previewPoint) && (
                <Circle
                  x={(calibState.endPoint ?? calibState.previewPoint)!.x}
                  y={(calibState.endPoint ?? calibState.previewPoint)!.y}
                  radius={POINT_RADIUS}
                  fill={COLORS.accent}
                  stroke="#ffffff"
                  strokeWidth={POINT_STROKE_WIDTH}
                  listening={false}
                />
              )}
              {calibLinePoints.length === 4 && (
                <Line
                  points={calibLinePoints}
                  stroke={COLORS.accent}
                  strokeWidth={LINE_STROKE_WIDTH}
                  dash={LINE_DASH}
                  lineCap="round"
                  listening={false}
                />
              )}
            </>
          )}

          {/* Faint reference line for previously calibrated pages — only from legacy viewerStore */}
          {/* (new scaleStore doesn't persist line points; reference line deferred to Phase 4) */}

          {/* In-progress linear/wall preview — wall reuses linear preview (both are open polylines) */}
          {(markupState.toolType === 'linear' || markupState.toolType === 'wall') &&
            markupState.mode === 'drawing' &&
            markupState.points.length > 0 && (
              <>
                {/* Solid committed segments */}
                <Line
                  points={markupState.points.flatMap((p) => [p.x, p.y])}
                  stroke={COLORS.accent}
                  strokeWidth={2 / currentZoom}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
                {/* Dashed preview segment from last vertex to cursor.
                    Phase 14 (14-04): suppressed while an arc edge is being
                    shaped — the ArcPreview below renders the solved curve for
                    that edge instead. */}
                {markupState.previewPoint && !arcCaptureActive && (
                  <Line
                    points={[
                      markupState.points[markupState.points.length - 1].x,
                      markupState.points[markupState.points.length - 1].y,
                      markupState.previewPoint.x,
                      markupState.previewPoint.y
                    ]}
                    stroke={COLORS.accent}
                    strokeWidth={2 / currentZoom}
                    dash={[8 / currentZoom, 4 / currentZoom]}
                    opacity={0.6}
                    listening={false}
                  />
                )}
                {/* Phase 14 (14-04 D-01): live solved-arc preview for the edge
                    currently being shaped (start → onArc → cursor). */}
                {arcPreviewElement}
                {/* Vertex dots */}
                {markupState.points.map((p, i) => (
                  <Circle
                    key={i}
                    x={p.x}
                    y={p.y}
                    radius={4 / currentZoom}
                    fill={COLORS.accent}
                    stroke="#ffffff"
                    strokeWidth={1 / currentZoom}
                    listening={false}
                  />
                ))}
              </>
            )}

        </Layer>

        {/* Layer 1b: Committed markups — LISTENING for hover + right-click (plan 03.1-05) */}
        <Layer listening={true}>
          {/* Committed count markups */}
          {pageMarkups.filter((m) => m.type === 'count').map((m) => {
            const category = getCategory(m.categoryId)
            if (!category) return null
            return (
              <CountPinMarkup
                key={m.id}
                markup={m as CountMarkup}
                category={category}
                currentZoom={currentZoom}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                onContextMenu={handleContextMenu}
                onClick={handleMarkupClick}
                onMarkupMouseDown={(id) => { markupBodyDownRef.current = id }}
                overridePoint={
                  dragPreview?.type === 'body' && dragPreview.deltas[m.id]
                    ? {
                        x: (m as CountMarkup).point.x + dragPreview.deltas[m.id].x,
                        y: (m as CountMarkup).point.y + dragPreview.deltas[m.id].y
                      }
                    : undefined
                }
              />
            )
          })}

          {/* Committed linear markups */}
          {pageMarkups.filter((m) => m.type === 'linear').map((m) => {
            const category = getCategory(m.categoryId)
            if (!category) return null
            return (
              <LinearMarkup
                key={m.id}
                markup={m as LinearMarkupType}
                category={category}
                currentZoom={currentZoom}
                pageScale={pageScale}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                onContextMenu={handleContextMenu}
                onClick={handleMarkupClick}
                onMarkupMouseDown={(id) => { markupBodyDownRef.current = id }}
                overridePoints={
                  dragPreview?.type === 'body' && dragPreview.deltas[m.id]
                    ? (m as LinearMarkupType).points.map(p => ({
                        x: p.x + dragPreview.deltas[m.id].x,
                        y: p.y + dragPreview.deltas[m.id].y
                      }))
                    : dragPreview?.type === 'vertex' && dragPreview.markupId === m.id
                      ? dragPreview.points
                      : undefined
                }
              />
            )
          })}

          {/* Committed area markups */}
          {pageMarkups.filter((m) => m.type === 'area').map((m) => {
            const category = getCategory(m.categoryId)
            if (!category) return null
            return (
              <AreaMarkup
                key={m.id}
                markup={m as AreaMarkupType}
                category={category}
                currentZoom={currentZoom}
                pageScale={pageScale}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                onContextMenu={handleContextMenu}
                onClick={handleMarkupClick}
                onMarkupMouseDown={(id) => { markupBodyDownRef.current = id }}
                overridePoints={
                  dragPreview?.type === 'body' && dragPreview.deltas[m.id]
                    ? (m as AreaMarkupType).points.map(p => ({
                        x: p.x + dragPreview.deltas[m.id].x,
                        y: p.y + dragPreview.deltas[m.id].y
                      }))
                    : dragPreview?.type === 'vertex' && dragPreview.markupId === m.id
                      ? dragPreview.points
                      : undefined
                }
              />
            )
          })}

          {/* Committed perimeter markups */}
          {pageMarkups.filter((m) => m.type === 'perimeter').map((m) => {
            const category = getCategory(m.categoryId)
            if (!category) return null
            return (
              <PerimeterMarkup
                key={m.id}
                markup={m as PerimeterMarkupType}
                category={category}
                currentZoom={currentZoom}
                pageScale={pageScale}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                onContextMenu={handleContextMenu}
                onClick={handleMarkupClick}
                onMarkupMouseDown={(id) => { markupBodyDownRef.current = id }}
                overridePoints={
                  dragPreview?.type === 'body' && dragPreview.deltas[m.id]
                    ? (m as PerimeterMarkupType).points.map(p => ({
                        x: p.x + dragPreview.deltas[m.id].x,
                        y: p.y + dragPreview.deltas[m.id].y
                      }))
                    : dragPreview?.type === 'vertex' && dragPreview.markupId === m.id
                      ? dragPreview.points
                      : undefined
                }
              />
            )
          })}

          {/* Committed wall markups */}
          {pageMarkups.filter((m) => m.type === 'wall').map((m) => {
            const category = getCategory(m.categoryId)
            if (!category) return null
            return (
              <WallMarkup
                key={m.id}
                markup={m as WallMarkupType}
                category={category}
                currentZoom={currentZoom}
                pageScale={pageScale}
                onHoverEnter={handleHoverEnter}
                onHoverLeave={handleHoverLeave}
                onContextMenu={handleContextMenu}
                onClick={handleMarkupClick}
                onMarkupMouseDown={(id) => { markupBodyDownRef.current = id }}
                overridePoints={
                  dragPreview?.type === 'body' && dragPreview.deltas[m.id]
                    ? (m as WallMarkupType).points.map(p => ({
                        x: p.x + dragPreview.deltas[m.id].x,
                        y: p.y + dragPreview.deltas[m.id].y
                      }))
                    : dragPreview?.type === 'vertex' && dragPreview.markupId === m.id
                      ? dragPreview.points
                      : undefined
                }
              />
            )
          })}
        </Layer>

        {/* Plan 09-03: rubber-band multi-select rectangle (D-06, D-07).
            Own layer ABOVE Layer 1b so the band is visible over markup shapes.
            listening={false} — never intercepts clicks meant for markup Groups. */}
        {rubberBand && (
          <Layer listening={false}>
            <Rect
              x={Math.min(rubberBand.startX, rubberBand.endX)}
              y={Math.min(rubberBand.startY, rubberBand.endY)}
              width={Math.abs(rubberBand.endX - rubberBand.startX)}
              height={Math.abs(rubberBand.endY - rubberBand.startY)}
              stroke={COLORS.accent}
              strokeWidth={1 / currentZoom}
              fill={RUBBER_BAND_FILL}
              listening={false}
            />
          </Layer>
        )}

        {/* Phase 12: vertex-edit handles overlay. Mounts only when vertexEditMarkupId !== null
            and the target markup is a points-array type (count pins are excluded per D-09).
            Above Layer 1b with listening={true} so handle Rects intercept pointer events
            BEFORE the markup body below. Computed as `vertexHandleLayer` above the JSX so
            Plan 12-05's wiring of onHandleMouseDown is a single-site edit. */}
        {vertexHandleLayer}

        {/* Phase 14 (14-05 D-08): live bulge-reshape arc preview (dashed solved
            arc; amber at the sagitta cap). Transient, listening=false. */}
        {bulgePreviewElement}

        {/* Phase 6: Layer 2 transient — panel-driven highlights (D-11 HoverRing + D-12 PulseHighlight).
            listening={false} on both the Layer and every shape inside so these overlays NEVER
            steal hover events from the underlying committed-markup Layer 1b shapes.
            Guarded by highlight-overlay-listening.test.ts regression check. */}
        {((props.hoverMatches?.length ?? 0) > 0 || (props.pulse != null)) && (
          <Layer listening={false}>
            {(props.hoverMatches?.length ?? 0) > 0 && (
              <HoverRing markups={props.hoverMatches!} currentZoom={currentZoom} />
            )}
            {props.pulse != null && (
              <PulseHighlight
                markups={props.pulse.matches}
                color={props.pulse.color}
                currentZoom={currentZoom}
                onComplete={props.onPulseComplete ?? (() => {})}
              />
            )}
          </Layer>
        )}

        {/* Plan 09-02 / D-02 + Phase 12 D-04 revised post-UAT: selection ring Layer.
            Originally rendered for every selected markup. After Phase 12 the
            vertex handles themselves are the feedback for a single-selected line
            markup (linear/area/perimeter/wall), so the halo would visually engulf
            the 8px handles at low zoom. The halo is now reserved for:
              • count pins (no vertices, so handles can't substitute), and
              • multi-selection (≥2 markups, where each member needs a visual).
            CRITICAL: listening={false} on the Layer — without it the selection
            ring shapes would intercept clicks meant for the markup Groups in
            Layer 1b below, breaking the highlight-overlay-listening.test.ts
            regression contract (D-11). */}
        <Layer listening={false}>
          {selectedMarkupIds.length > 0 && (() => {
            const selected = pageMarkups.filter((m) => selectedMarkupIds.includes(m.id))
            const haloed =
              selected.length > 1
                ? selected
                : selected.filter((m) => m.type === 'count')
            if (haloed.length === 0) return null
            return (
              <HoverRing
                markups={haloed}
                currentZoom={currentZoom}
                color={COLORS.accent}
                opacity={1.0}
              />
            )
          })()}
        </Layer>

        {/* Phase 14 (14-03 D-04): snap glyph overlay. Above committed markups and
            above the selection ring, below nothing interactive. listening={false}
            on the Layer + every glyph shape so it NEVER steals pointer events
            (same discipline as HoverRing/PulseHighlight). The underlying color is
            the in-progress markup's pending color (or the snapped markup's color)
            so the halo contrast picker reads against the right backdrop. */}
        {snapCandidate !== null && (
          <Layer listening={false}>
            <SnapIndicator
              candidate={snapCandidate}
              currentZoom={currentZoom}
              underlyingColor={
                markupState.pendingColor ??
                pageMarkups.find((m) => m.id === snapCandidate.markupId)?.color
              }
            />
          </Layer>
        )}

        {/* Layer 2: Transient interactive polygon drawing (only mounted while drawing area/perimeter) */}
        {(markupState.toolType === 'area' || markupState.toolType === 'perimeter') &&
         markupState.mode === 'drawing' &&
         markupState.points.length > 0 && (
          <Layer>
            {/* Solid committed segments */}
            <Line
              points={markupState.points.flatMap((p) => [p.x, p.y])}
              stroke={COLORS.accent}
              strokeWidth={2 / currentZoom}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
            {/* Dashed preview segment from last point to cursor.
                Phase 14 (14-04): suppressed while an arc edge is being shaped —
                ArcPreview renders the solved curve for that edge instead. */}
            {markupState.previewPoint && !arcCaptureActive && (
              <Line
                points={[
                  markupState.points[markupState.points.length - 1].x,
                  markupState.points[markupState.points.length - 1].y,
                  markupState.previewPoint.x,
                  markupState.previewPoint.y
                ]}
                stroke={COLORS.accent}
                strokeWidth={2 / currentZoom}
                dash={[8 / currentZoom, 4 / currentZoom]}
                opacity={0.6}
                listening={false}
              />
            )}
            {/* Phase 14 (14-04 D-01): live solved-arc preview for the edge
                currently being shaped (start → onArc → cursor). */}
            {arcPreviewElement}
            {/* Non-start vertex dots (non-interactive) */}
            {markupState.points.slice(1).map((p, i) => (
              <Circle
                key={i}
                x={p.x}
                y={p.y}
                radius={4 / currentZoom}
                fill={COLORS.accent}
                stroke="#ffffff"
                strokeWidth={1 / currentZoom}
                listening={false}
              />
            ))}
            {/* Start vertex — INTERACTIVE for polygon-close hover detection via hitStrokeWidth */}
            <Circle
              x={markupState.points[0].x}
              y={markupState.points[0].y}
              radius={(isOverStartPoint && markupState.points.length >= 3 ? 7 : 5) / currentZoom}
              fill={isOverStartPoint && markupState.points.length >= 3 ? '#ffffff' : COLORS.accent}
              stroke={COLORS.accent}
              strokeWidth={2 / currentZoom}
              hitStrokeWidth={12 / currentZoom}
              onMouseEnter={() => setIsOverStartPoint(true)}
              onMouseLeave={() => setIsOverStartPoint(false)}
            />
          </Layer>
        )}
      </Stage>

      {/* ScalePopup: confirm mode — shown after user draws a calibration line */}
      {calibState.mode === 'confirming' && calibState.popupScreenPos && !calibState.isVerify && (
        <ScalePopup
          mode="confirm"
          screenPos={calibState.popupScreenPos}
          containerSize={containerSize}
          pixelLength={calibState.linePixelLength}
          onConfirm={(pixelsPerMm: number, displayUnit: ScaleUnit) => {
            setScale(currentPage, pixelsPerMm, displayUnit)
            const ratioText = formatScaleRatio(pixelsPerMm)
            cancel()
            setToast({ ratioText })
          }}
          onCancel={cancel}
        />
      )}

      {/* ScalePopup: verify mode — shown after user draws a verify line (read-only) */}
      {calibState.mode === 'confirming' && calibState.popupScreenPos && calibState.isVerify && (
        <ScalePopup
          mode="verify"
          screenPos={calibState.popupScreenPos}
          containerSize={containerSize}
          pixelLength={calibState.linePixelLength}
          pageScale={pageScale}
          onCancel={cancel}
        />
      )}

      {/* Count tool — naming popup shown before first pin is placed (count-pre mode, D-01) */}
      {markupState.toolType === 'count' &&
        markupState.mode === 'naming' &&
        markupState.popupScreenPos && (
          <MarkupNamePopup
            mode="count-pre"
            screenPos={markupState.popupScreenPos}
            containerSize={containerSize}
            onConfirm={commitCountName}
            onCancel={() => {
              cancelMarkup()
              useViewerStore.getState().setActiveTool('select')
            }}
          />
        )}

      {/* Linear/Area/Perimeter/Wall — save popup shown after shape is drawn (save-after mode) */}
      {markupState.mode === 'confirming' && markupState.popupScreenPos && (
        <MarkupNamePopup
          mode="save-after"
          screenPos={markupState.popupScreenPos}
          containerSize={containerSize}
          toolType={markupState.toolType ?? undefined}
          initialWallHeight={markupState.toolType === 'wall' ? markupState.pendingWallHeight : undefined}
          onConfirm={commitShape}
          onCancel={() => {
            cancelMarkup()
            useViewerStore.getState().setActiveTool('select')
          }}
        />
      )}

      {/* Error toast — auto-dismissed after 3s, also dismissible on click */}
      {markupState.errorToast && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            background: COLORS.warning,
            color: COLORS.dominant,
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            whiteSpace: 'nowrap'
          }}
          onClick={dismissError}
        >
          {markupState.errorToast}
        </div>
      )}

      {/* Confirmation toast — persistent until user acts, page changes, or new calibration starts */}
      {toast && (
        <ConfirmationToast
          ratioText={toast.ratioText}
          onVerify={() => {
            setToast(null)
            activateVerify()
          }}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* "Not calibrated" warning badge */}
      {showNotCalibratedBadge && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(232, 168, 56, 0.15)',
            border: '1px solid #e8a838',
            borderRadius: 4,
            padding: '6px 10px',
            color: '#e8a838',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 8
          }}
        >
          <span>Scale not set</span>
          <button
            onClick={() => activate()}
            style={{
              background: '#e8a838',
              border: 'none',
              borderRadius: 3,
              color: '#1a1a1a',
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Set Scale
          </button>
        </div>
      )}

      {/* Hover tooltip — 200ms delay + immediate hide (plan 03.1-05 / D-30 / D-33) */}
      {tooltipShown && hoverState && hoveredMarkup && (
        <MarkupTooltip
          screenPos={{ x: hoverState.x, y: hoverState.y }}
          text={buildMarkupSummary(hoveredMarkup)}
        />
      )}

      {/* Right-click context menu — recolor (D-28/D-29) + delete + edit (D-04) */}
      {contextMenu && contextMarkup && (
        <MarkupContextMenu
          screenPos={{ x: contextMenu.x, y: contextMenu.y }}
          currentColor={contextMarkup.color}
          onRecolor={(hex) => {
            useMarkupStore.getState().recolorGroup(contextMarkup.name, hex)
          }}
          onDelete={() => {
            useMarkupStore.getState().deleteMarkup(contextMarkup.page, contextMarkup.id)
          }}
          onEdit={() => {
            const rect = containerRef.current!.getBoundingClientRect()
            setEditPopup({
              id: contextMenu.id,
              x: contextMenu.x - rect.left,
              y: contextMenu.y - rect.top
            })
            setContextMenu(null)
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Edit popup — mount MarkupNamePopup in mode='edit' at container-relative coords (D-04/Landmine 4) */}
      {editPopup && (() => {
        const target = pageMarkups.find((m) => m.id === editPopup.id)
        const cat = target ? useMarkupStore.getState().getCategory(target.categoryId) : null
        return target ? (
          <MarkupNamePopup
            mode="edit"
            screenPos={{ x: editPopup.x, y: editPopup.y }}
            containerSize={containerSize}
            initialName={target.name}
            initialCategoryName={cat?.name ?? ''}
            initialColor={target.color}
            toolType={target.type as 'count' | 'linear' | 'area' | 'perimeter' | 'wall'}
            initialWallHeight={target.type === 'wall' ? (target as WallMarkupType).wallHeight : undefined}
            onConfirm={({ name, categoryName, color, wallHeight }) => {
              const cat2 = useMarkupStore.getState().getCategory(target.categoryId)
              useMarkupStore.getState().editMarkup(
                target.id,
                target.page,
                target.name,
                cat2?.name ?? '',
                target.color,
                name,
                categoryName,
                color,
                target.type === 'wall' ? (target as WallMarkupType).wallHeight : undefined,
                target.type === 'wall' ? wallHeight : undefined
              )
              setEditPopup(null)
            }}
            onCancel={() => setEditPopup(null)}
          />
        ) : null
      })()}

    </div>
  )
}
