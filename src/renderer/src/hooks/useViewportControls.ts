import { useCallback, useEffect, useState, RefObject } from 'react'
import Konva from 'konva'
import { ZOOM_STEPS } from '../lib/constants'
import { useViewerStore } from '../stores/viewerStore'

// Find the next zoom step in the given direction
export function getNextZoomStep(currentZoom: number, direction: 1 | -1): number {
  if (direction === 1) {
    // Zoom in: find first step greater than current
    for (const step of ZOOM_STEPS) {
      if (step > currentZoom + 0.001) return step
    }
    return ZOOM_STEPS[ZOOM_STEPS.length - 1]
  } else {
    // Zoom out: find last step less than current
    for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
      if (ZOOM_STEPS[i] < currentZoom - 0.001) return ZOOM_STEPS[i]
    }
    return ZOOM_STEPS[0]
  }
}

// Zoom-to-cursor: the point under the cursor stays fixed on screen
export function zoomToPoint(
  stage: Konva.Stage,
  newScale: number,
  pointerX: number,
  pointerY: number
): { zoom: number; panX: number; panY: number } {
  const oldScale = stage.scaleX()
  const mousePointTo = {
    x: (pointerX - stage.x()) / oldScale,
    y: (pointerY - stage.y()) / oldScale
  }
  stage.scale({ x: newScale, y: newScale })
  const newPos = {
    x: pointerX - mousePointTo.x * newScale,
    y: pointerY - mousePointTo.y * newScale
  }
  stage.position(newPos)
  return { zoom: newScale, panX: newPos.x, panY: newPos.y }
}

export function useViewportControls(stageRef: RefObject<Konva.Stage | null>) {
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [middleDrag, setMiddleDrag] = useState(false)
  const currentPage = useViewerStore((s) => s.currentPage)
  const setViewport = useViewerStore((s) => s.setViewport)

  // Handle Ctrl+scroll wheel zoom
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      // Only zoom on Ctrl+scroll
      if (!e.evt.ctrlKey) return

      const oldScale = stage.scaleX()
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const direction = e.evt.deltaY < 0 ? 1 : -1
      const newScale = getNextZoomStep(oldScale, direction as 1 | -1)
      if (newScale === oldScale) return

      const vp = zoomToPoint(stage, newScale, pointer.x, pointer.y)
      setViewport(currentPage, vp)
    },
    [stageRef, currentPage, setViewport]
  )

  // Zoom in/out from toolbar buttons (zoom toward center of viewport)
  const zoomIn = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const newScale = getNextZoomStep(oldScale, 1)
    if (newScale === oldScale) return
    const centerX = stage.width() / 2
    const centerY = stage.height() / 2
    const vp = zoomToPoint(stage, newScale, centerX, centerY)
    setViewport(currentPage, vp)
  }, [stageRef, currentPage, setViewport])

  const zoomOut = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const newScale = getNextZoomStep(oldScale, -1)
    if (newScale === oldScale) return
    const centerX = stage.width() / 2
    const centerY = stage.height() / 2
    const vp = zoomToPoint(stage, newScale, centerX, centerY)
    setViewport(currentPage, vp)
  }, [stageRef, currentPage, setViewport])

  // Spacebar pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        setSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Middle-mouse-button pan — track via state so <Stage draggable> stays in sync
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const container = stage.container()

    const handleMouseDown = (e: MouseEvent): void => {
      if (e.button === 1) {
        setMiddleDrag(true)
        e.preventDefault()
      }
    }
    const handleMouseUp = (e: MouseEvent): void => {
      if (e.button === 1) {
        setMiddleDrag(false)
        // Sync position to store
        const s = stageRef.current
        if (s) {
          const pos = s.position()
          const scale = s.scaleX()
          setViewport(currentPage, { zoom: scale, panX: pos.x, panY: pos.y })
        }
      }
    }

    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [stageRef.current, currentPage, setViewport])

  const isDraggable = spaceHeld || middleDrag

  return {
    handleWheel,
    zoomIn,
    zoomOut,
    spaceHeld,
    isDraggable
  }
}
