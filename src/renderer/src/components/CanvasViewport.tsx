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
import { ScalePopup } from './ScalePopup'
import { ConfirmationToast } from './ConfirmationToast'
import { COLORS } from '../lib/constants'
import { formatScaleRatio } from '../lib/scale-math'
import type { ScaleUnit } from '../types/scale'

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

export function CanvasViewport() {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
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

  const getScaleFromStore = useScaleStore((s) => s.getScale)
  const setScale = useScaleStore((s) => s.setScale)
  const calibMode = useScaleStore((s) => s.calibMode)

  // Observe container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width: Math.floor(width), height: Math.floor(height) })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

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

  // Confirmation toast state
  const [toast, setToast] = useState<{ ratioText: string } | null>(null)

  // Dismiss toast on page change (MEDIUM #3 — persistent toast)
  useEffect(() => {
    setToast(null)
  }, [currentPage])

  // Dismiss toast when a new calibration run starts (MEDIUM #3)
  useEffect(() => {
    if (calibState.mode === 'drawing') {
      setToast(null)
    }
  }, [calibState.mode])

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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    openPdf: openPdfDialog,
    zoomIn,
    zoomOut,
    fitToWindow
  })

  // Handle Stage click — forward to calibration recordClick when in drawing mode
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (calibState.mode !== 'drawing') return
      if (e.evt.button !== 0) return
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      // Get screen coords by transforming from stage-relative to document coords
      const container = stage.container()
      const rect = container.getBoundingClientRect()
      recordClick({ x: rect.left + pointer.x, y: rect.top + pointer.y })
    },
    [calibState.mode, stageRef, recordClick]
  )

  // Handle Stage mousemove — update preview point when in drawing mode after first click
  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (calibState.mode !== 'drawing' || !calibState.startPoint) return
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const container = stage.container()
      const rect = container.getBoundingClientRect()
      updatePreview({ x: rect.left + pointer.x, y: rect.top + pointer.y })
    },
    [calibState.mode, calibState.startPoint, stageRef, updatePreview]
  )

  // Determine cursor based on interaction state.
  // Spacebar held = grab cursor (left-click pan mode).
  // Active calibration mode = crosshair for click placement.
  // Otherwise default.
  const getCursor = (): string => {
    if (spaceHeld) return 'grab'
    if (calibMode !== 'idle') return 'crosshair'
    return 'default'
  }

  // Only return null if there has NEVER been a valid render (initial state before any PDF loaded)
  if (!displayCanvas || !displayPageSize) return null

  // Current zoom for compensating visual sizes
  const currentZoom = getViewport(currentPage).zoom || 1
  const pageScale = getScaleFromStore(currentPage)
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

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#141414',
        backgroundImage:
          'radial-gradient(circle, #1e1e1e 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        overflow: 'hidden',
        cursor: getCursor(),
        position: 'relative'
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
      >
        {/* Layer 0: PDF background */}
        <Layer listening={false}>
          <KonvaImage
            image={displayCanvas}
            width={displayPageSize.width}
            height={displayPageSize.height}
          />
        </Layer>
        {/* Layer 1: Markup overlay (calibration line + persistent reference) */}
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
        </Layer>
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
          pageScale={getScaleFromStore(currentPage)}
          onCancel={cancel}
        />
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

      {/* Recompute popup position when container resizes */}
      {calibState.mode === 'confirming' && (
        <div
          style={{ display: 'none' }}
          ref={() => recomputePopupPos()}
        />
      )}
    </div>
  )
}
