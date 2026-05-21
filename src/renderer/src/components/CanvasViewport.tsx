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
import { COLORS } from '../lib/constants'
import { formatScaleRatio } from '../lib/scale-math'
import { setMarkupUndoHandler, setMarkupRedoHandler } from '../lib/markup-undo-ref'
import {
  polylineLength,
  polygonArea,
  pixelLengthToReal,
  pixelAreaToReal
} from '../lib/markup-math'
import { isMarkupTool } from '../types/viewer'
import type { ScaleUnit } from '../types/scale'
import type { Markup, CountMarkup, LinearMarkup as LinearMarkupType, AreaMarkup as AreaMarkupType, PerimeterMarkup as PerimeterMarkupType, WallMarkup as WallMarkupType } from '../types/markup'

// Stable empty-array reference for the pageMarkups selector fallback.
// A fresh `[]` literal inside a Zustand selector breaks useSyncExternalStore's
// Object.is snapshot check and causes an infinite re-render loop.
const EMPTY_MARKUPS: Markup[] = []

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

export interface CanvasViewportProps {
  /** Phase 6 D-11: markups to show a steady white outer ring on (from TotalsRow hover). */
  hoverMatches?: Markup[]
  /** Phase 6 D-12: active click-pulse (color + markups) or null when none. */
  pulse?: { matches: Markup[]; color: string } | null
  /** Phase 6: called when the pulse animation completes OR page changes (clears pulse). */
  onPulseComplete?: () => void
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

  const {
    state: markupState,
    activate: activateMarkup,
    cancel: cancelMarkup,
    recordClick: recordMarkupClick,
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

  useEffect(() => {
    setMarkupRedoHandler(repushLastPoint)
    return () => {
      setMarkupRedoHandler(null)
    }
  }, [repushLastPoint])

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

  // Phase 12: markup body mousedown ref — set by markup components' onMarkupMouseDown prop.
  // CanvasViewport reads this in handleStageMouseDown (before rubber-band check) to detect
  // body-drag intent. Cleared immediately on read (consume-on-read pattern). Wired in 12-04.
  const markupBodyDownRef = useRef<string | null>(null)

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
    }
    window.addEventListener('mouseup', cleanup)
    return () => window.removeEventListener('mouseup', cleanup)
  }, [setRubberBand, setDragPreview])

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
    }
  }, [activeTool, clearVertexEdit, setDragPreview])

  // Subscribe to markupStore for rendering committed markups on the current page
  const pageMarkups = useMarkupStore((s) => s.pageMarkups[currentPage] ?? EMPTY_MARKUPS)
  const getCategory = useMarkupStore((s) => s.getCategory)

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
  }, [currentPage])

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
        recordMarkupClick({ x: pointer.x, y: pointer.y })
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
        if (
          liveVeId !== null &&
          vertexDragRef.current === null &&
          !bodyDraggedRef.current &&
          !rubberBandDraggedRef.current
        ) {
          const clickedId = e.target?.getAttr?.('id') as string | undefined
          if (clickedId !== liveVeId) {
            commitVertexEdit()
            // Allow the click to continue — empty-stage path below clears selection
            // (which is the correct outcome for "click on empty area" while in vertex
            // edit mode), and a click on a DIFFERENT markup will route through the
            // markup component's onClick → handleMarkupClick and select the new markup.
          }
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
    [calibState.mode, markupState.mode, markupState.toolType, markupState.points.length, isOverStartPoint, stageRef, recordClick, recordMarkupClick, finishPolygon, activeTool, clearSelection, commitVertexEdit]
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

      // Phase 12 (12-05): vertex drag live preview — recompute the dragged markup's points
      // with only the dragged vertex moved, push to dragPreview so the renderer reflects it.
      // Read pageMarkups via getState() (stale-closure anti-pattern guard from .continue-here.md).
      // Placed BEFORE body-drag check because vertex drag and body drag are mutually exclusive
      // at the down event — defensive ordering only.
      const vd = vertexDragRef.current
      if (vd) {
        const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
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
        const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
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
        updateMarkupPreview({ x: pointer.x, y: pointer.y })
      }
    },
    [calibState.mode, calibState.startPoint, markupState.mode, markupState.points.length, stageRef, updatePreview, updateMarkupPreview, setRubberBand, setDragPreview, currentPage]
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
    const vd = vertexDragRef.current
    if (vd) {
      const stage = stageRef.current
      const pointer = stage?.getPointerPosition()
      if (stage && pointer) {
        const pt = stage.getAbsoluteTransform().copy().invert().point(pointer)
        const dx = pt.x - vd.origin.x
        const dy = pt.y - vd.origin.y
        // D-09 4px movement threshold — below 4px is a click (no dispatch), above is a real drag.
        const moved = Math.abs(dx) > 4 || Math.abs(dy) > 4
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
            useMarkupStore
              .getState()
              .moveVertex(vd.markupId, currentPage, vd.vertexIndex, newPoint)
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
        // D-09: 4px movement threshold — below threshold = click, above = real drag.
        const moved = Math.abs(dx) > 4 || Math.abs(dy) > 4
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
    // Only treat as a rubber-band drag when the mouse moved more than 4px in any direction.
    // A zero-size band (pure click) should not interfere with the click handler below.
    const moved = Math.abs(rb.endX - rb.startX) > 4 || Math.abs(rb.endY - rb.startY) > 4
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
    if (markupState.mode === 'drawing') return CROSSHAIR_CURSOR
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
  const vertexHandleLayer = (() => {
    if (vertexEditMarkupId === null) return null
    const veMarkup = pageMarkups.find((m) => m.id === vertexEditMarkupId)
    if (!veMarkup || veMarkup.type === 'count') return null
    const preview =
      dragPreview?.type === 'vertex' && dragPreview.markupId === vertexEditMarkupId
        ? dragPreview
        : null
    const markupForHandles: Markup = preview
      ? ({ ...veMarkup, points: preview.points } as Markup)
      : veMarkup
    return (
      <Layer listening={true}>
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
                {/* Dashed preview segment from last vertex to cursor */}
                {markupState.previewPoint && (
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
            {/* Dashed preview segment from last point to cursor */}
            {markupState.previewPoint && (
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
