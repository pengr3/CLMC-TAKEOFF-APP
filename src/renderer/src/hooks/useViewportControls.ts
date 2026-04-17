import { useCallback, useEffect, useState, RefObject } from 'react'
import Konva from 'konva'
import { ZOOM_STEPS } from '../lib/constants'
import { useViewerStore } from '../stores/viewerStore'

// Build effective zoom steps, optionally inserting the fit-to-window scale
// so the user can always zoom back to the fit view via scroll wheel.
function buildZoomSteps(fitScale?: number): number[] {
  const steps = [...ZOOM_STEPS]
  if (fitScale !== undefined && fitScale > 0) {
    // Only insert if fitScale isn't already close to an existing step
    const alreadyPresent = steps.some((s) => Math.abs(s - fitScale) < 0.001)
    if (!alreadyPresent) {
      steps.push(fitScale)
      steps.sort((a, b) => a - b)
    }
  }
  return steps
}

// Find the next zoom step in the given direction.
// fitScale: if provided, ensures the fit-to-window zoom level is reachable.
export function getNextZoomStep(
  currentZoom: number,
  direction: 1 | -1,
  fitScale?: number
): number {
  const steps = buildZoomSteps(fitScale)
  if (direction === 1) {
    // Zoom in: find first step greater than current
    for (const step of steps) {
      if (step > currentZoom + 0.001) return step
    }
    return steps[steps.length - 1]
  } else {
    // Zoom out: find last step less than current
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i] < currentZoom - 0.001) return steps[i]
    }
    return steps[0]
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

export function useViewportControls(
  stageRef: RefObject<Konva.Stage | null>,
  fitScale?: number
) {
  const [spaceHeld, setSpaceHeld] = useState(false)
  const currentPage = useViewerStore((s) => s.currentPage)
  const setViewport = useViewerStore((s) => s.setViewport)

  // Configure Konva drag buttons based on spacebar state.
  // Middle-mouse (button 1) can always drag the stage.
  // Left-mouse (button 0) can only drag when spacebar is held (pan mode).
  useEffect(() => {
    Konva.dragButtons = spaceHeld ? [0, 1] : [1]
  }, [spaceHeld])

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
      const newScale = getNextZoomStep(oldScale, direction as 1 | -1, fitScale)
      if (newScale === oldScale) return

      const vp = zoomToPoint(stage, newScale, pointer.x, pointer.y)
      setViewport(currentPage, vp)
    },
    [stageRef, currentPage, setViewport, fitScale]
  )

  // Zoom in/out from toolbar buttons (zoom toward center of viewport)
  const zoomIn = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const newScale = getNextZoomStep(oldScale, 1, fitScale)
    if (newScale === oldScale) return
    const centerX = stage.width() / 2
    const centerY = stage.height() / 2
    const vp = zoomToPoint(stage, newScale, centerX, centerY)
    setViewport(currentPage, vp)
  }, [stageRef, currentPage, setViewport, fitScale])

  const zoomOut = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const newScale = getNextZoomStep(oldScale, -1, fitScale)
    if (newScale === oldScale) return
    const centerX = stage.width() / 2
    const centerY = stage.height() / 2
    const vp = zoomToPoint(stage, newScale, centerX, centerY)
    setViewport(currentPage, vp)
  }, [stageRef, currentPage, setViewport, fitScale])

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

  // Prevent middle-click auto-scroll (browser default for middle-click)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const container = stage.container()
    const preventAutoScroll = (e: MouseEvent): void => {
      if (e.button === 1) e.preventDefault()
    }
    container.addEventListener('mousedown', preventAutoScroll)
    return () => container.removeEventListener('mousedown', preventAutoScroll)
  }, [stageRef.current])

  // Stage is always draggable — Konva.dragButtons controls which buttons work
  const isDraggable = true

  return {
    handleWheel,
    zoomIn,
    zoomOut,
    spaceHeld,
    isDraggable
  }
}
