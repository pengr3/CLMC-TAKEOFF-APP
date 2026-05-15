import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Line } from 'react-konva'
import Konva from 'konva'
import { usePdfRenderer } from '../hooks/usePdfRenderer'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewportControls } from '../hooks/useViewportControls'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { useCalibrationMode } from '../hooks/useCalibrationMode'
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
import { COLORS } from '../lib/constants'
import { formatScaleRatio } from '../lib/scale-math'
import { setMarkupUndoHandler } from '../lib/markup-undo-ref'
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
    popLastPoint
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

  // Local state for polygon start-vertex hover (drives close-on-click affordance)
  const [isOverStartPoint, setIsOverStartPoint] = useState(false)

  // Sync viewerStore.activeTool with the markup tool state machine
  useEffect(() => {
    if (isMarkupTool(activeTool) && markupState.toolType !== activeTool) {
      activateMarkup(activeTool)
    } else if (!isMarkupTool(activeTool) && markupState.mode !== 'idle') {
      cancelMarkup()
    }
  }, [activeTool, markupState.toolType, markupState.mode, activateMarkup, cancelMarkup])

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

  // Escape key cancels active markup draw/place/name/confirm (D-07)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (
          markupState.mode === 'drawing' ||
          markupState.mode === 'confirming' ||
          markupState.mode === 'naming' ||
          markupState.mode === 'placing'
        ) {
          e.preventDefault()
          cancelMarkup()
          useViewerStore.getState().setActiveTool('select')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [markupState.mode, cancelMarkup])

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

      // Calibration path (existing)
      if (calibState.mode === 'drawing') {
        recordClick({ x: pointer.x, y: pointer.y })
        return
      }

      // Markup path
      if (markupState.mode === 'drawing' || markupState.mode === 'placing') {
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
    },
    [calibState.mode, markupState.mode, markupState.toolType, markupState.points.length, isOverStartPoint, stageRef, recordClick, recordMarkupClick, finishPolygon]
  )

  // Handle Stage mousemove — update preview point for calibration or markup drawing
  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      if (calibState.mode === 'drawing' && calibState.startPoint) {
        updatePreview({ x: pointer.x, y: pointer.y })
        return
      }
      if (markupState.mode === 'drawing' && markupState.points.length > 0) {
        updateMarkupPreview({ x: pointer.x, y: pointer.y })
      }
    },
    [calibState.mode, calibState.startPoint, markupState.mode, markupState.points.length, stageRef, updatePreview, updateMarkupPreview]
  )

  // Handle Stage dblclick — finish linear or wall polyline (both are open polylines)
  const handleStageDblClick = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if ((markupState.toolType === 'linear' || markupState.toolType === 'wall') && markupState.mode === 'drawing') {
        finishLinear()
      }
    },
    [markupState.toolType, markupState.mode, finishLinear]
  )

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
        onMouseMove={handleStageMouseMove}
        onDblClick={handleStageDblClick}
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
              />
            )
          })}
        </Layer>

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
            onConfirm={({ name, categoryName, color }) => {
              const cat2 = useMarkupStore.getState().getCategory(target.categoryId)
              useMarkupStore.getState().editMarkup(
                target.id,
                target.page,
                target.name,
                cat2?.name ?? '',
                target.color,
                name,
                categoryName,
                color
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
