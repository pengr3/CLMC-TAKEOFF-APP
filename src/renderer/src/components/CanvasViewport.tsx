import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage } from 'react-konva'
import Konva from 'konva'
import { usePdfRenderer } from '../hooks/usePdfRenderer'
import { useViewerStore } from '../stores/viewerStore'
import { useViewportControls } from '../hooks/useViewportControls'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { usePdfDocument } from '../hooks/usePdfDocument'
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

  const currentPage = useViewerStore((s) => s.currentPage)
  const getViewport = useViewerStore((s) => s.getViewport)
  const setViewport = useViewerStore((s) => s.setViewport)

  const { handleWheel, zoomIn, zoomOut, spaceHeld } = useViewportControls(stageRef)
  const { openPdfDialog } = usePdfDocument()

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

  // Calculate fit-to-window scale
  const calculateFitScale = useCallback(() => {
    if (!pageSize) return 1
    const padding = 20
    const availableWidth = containerSize.width - padding * 2
    const availableHeight = containerSize.height - padding * 2
    const scaleX = availableWidth / pageSize.width
    const scaleY = availableHeight / pageSize.height
    return Math.min(scaleX, scaleY)
  }, [pageSize, containerSize])

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

  // Determine cursor based on interaction state
  const getCursor = (): string => {
    if (spaceHeld) return 'grab'
    return 'default'
  }

  if (!pageCanvas || !pageSize) return null

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: COLORS.dominant,
        overflow: 'hidden',
        cursor: getCursor()
      }}
    >
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
      >
        {/* Layer 0: PDF background */}
        <Layer>
          <KonvaImage image={pageCanvas} width={pageSize.width} height={pageSize.height} />
        </Layer>
        {/* Layer 1: Markup overlay (empty in Phase 1) */}
        <Layer />
      </Stage>
    </div>
  )
}
