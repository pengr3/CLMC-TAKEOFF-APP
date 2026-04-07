import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Circle, Line } from 'react-konva'
import Konva from 'konva'
import { usePdfRenderer } from '../hooks/usePdfRenderer'
import { useViewerStore } from '../stores/viewerStore'
import { useViewportControls } from '../hooks/useViewportControls'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { useCalibration } from '../hooks/useCalibration'
import { CalibrationDialog } from './CalibrationDialog'
import { COLORS } from '../lib/constants'

// Module-level ref for canvas control functions (consumed by Toolbar via getCanvasControls)
let _canvasControls: {
  zoomIn: () => void
  zoomOut: () => void
  fitToWindow: () => void
} | null = null

export function getCanvasControls() {
  return _canvasControls
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
  const activeTool = useViewerStore((s) => s.activeTool)
  const setActiveTool = useViewerStore((s) => s.setActiveTool)
  const getPageScale = useViewerStore((s) => s.getPageScale)

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

  // Calibration interaction
  const {
    calibrationPoints,
    showDialog,
    pixelDistance,
    verifyResult,
    handleStageClick,
    handleDialogConfirm,
    handleDialogCancel,
    dismissVerifyResult
  } = useCalibration(stageRef)

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

  // Expose control functions via module-level ref
  useEffect(() => {
    _canvasControls = { zoomIn, zoomOut, fitToWindow }
    return () => {
      _canvasControls = null
    }
  }, [zoomIn, zoomOut, fitToWindow])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    openPdf: openPdfDialog,
    zoomIn,
    zoomOut,
    fitToWindow
  })

  // Determine cursor based on interaction state.
  // Spacebar held = grab cursor (left-click pan mode).
  // Active tool (not select) = crosshair for click placement.
  // Otherwise default.
  const getCursor = (): string => {
    if (spaceHeld) return 'grab'
    if (activeTool !== 'select') return 'crosshair'
    return 'default'
  }

  // Only return null if there has NEVER been a valid render (initial state before any PDF loaded)
  if (!displayCanvas || !displayPageSize) return null

  // Current zoom for compensating visual sizes
  const currentZoom = getViewport(currentPage).zoom || 1
  const pageScale = getPageScale(currentPage)
  const showNotCalibratedBadge =
    activeTool === 'select' && !pageScale && totalPages > 0

  // Visual constants for calibration overlay
  const POINT_RADIUS = 6 / currentZoom
  const POINT_STROKE_WIDTH = 1 / currentZoom
  const LINE_STROKE_WIDTH = 2 / currentZoom
  const LINE_DASH = [8 / currentZoom, 4 / currentZoom]
  const REFERENCE_LINE_STROKE = 1.5 / currentZoom
  const REFERENCE_LINE_DASH = [6 / currentZoom, 3 / currentZoom]

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
        onTap={handleStageClick}
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
          {/* Persistent reference line for calibrated pages in select mode */}
          {pageScale && activeTool === 'select' && (
            <Line
              points={pageScale.linePoints}
              stroke="#ff4444"
              opacity={0.3}
              strokeWidth={REFERENCE_LINE_STROKE}
              dash={REFERENCE_LINE_DASH}
              listening={false}
            />
          )}
          {/* Active calibration / verify-scale visuals */}
          {(activeTool === 'scale' || activeTool === 'verify-scale') && (
            <>
              {calibrationPoints.map((pt, idx) => (
                <Circle
                  key={idx}
                  x={pt.x}
                  y={pt.y}
                  radius={POINT_RADIUS}
                  fill="#ff4444"
                  stroke="#ffffff"
                  strokeWidth={POINT_STROKE_WIDTH}
                  listening={false}
                />
              ))}
              {calibrationPoints.length === 2 && (
                <Line
                  points={[
                    calibrationPoints[0].x,
                    calibrationPoints[0].y,
                    calibrationPoints[1].x,
                    calibrationPoints[1].y
                  ]}
                  stroke="#ff4444"
                  strokeWidth={LINE_STROKE_WIDTH}
                  dash={LINE_DASH}
                  listening={false}
                />
              )}
            </>
          )}
        </Layer>
      </Stage>

      {/* Calibration distance dialog */}
      {showDialog && pixelDistance !== null && (
        <CalibrationDialog
          pixelDistance={pixelDistance}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}

      {/* Verify-scale result overlay */}
      {verifyResult && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: COLORS.secondary,
            border: `1px solid ${COLORS.accent}`,
            borderRadius: 6,
            padding: '12px 18px',
            color: COLORS.textPrimary,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            zIndex: 9,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}
        >
          <span>
            Measured:{' '}
            <strong style={{ color: COLORS.accent, fontFamily: 'monospace' }}>
              {verifyResult.realWorldLength.toFixed(3)} {verifyResult.unit}
            </strong>{' '}
            <span style={{ color: COLORS.textSecondary }}>
              ({verifyResult.pixelLength.toFixed(1)} px)
            </span>
          </span>
          <button
            onClick={dismissVerifyResult}
            style={{
              background: COLORS.accent,
              border: 'none',
              borderRadius: 4,
              color: COLORS.textOnAccent,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
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
            onClick={() => setActiveTool('scale')}
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
    </div>
  )
}
