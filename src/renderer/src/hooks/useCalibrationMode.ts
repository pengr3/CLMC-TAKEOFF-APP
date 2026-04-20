import { useCallback, useEffect, useRef, useState, RefObject } from 'react'
import Konva from 'konva'
import { useScaleStore } from '../stores/scaleStore'
import type { CalibMode } from '../types/scale'
import { pixelLength as computePixelLength, MIN_CALIBRATION_PIXELS } from '../lib/scale-math'

export interface StagePoint {
  x: number
  y: number
}

export interface CalibrationState {
  mode: CalibMode
  startPoint: StagePoint | null
  endPoint: StagePoint | null
  previewPoint: StagePoint | null
  popupScreenPos: { x: number; y: number } | null
  linePixelLength: number
  lineTooShort: boolean
  isVerify: boolean
}

export interface UseCalibrationModeReturn {
  state: CalibrationState
  activate: () => void
  activateVerify: () => void
  cancel: () => void
  recordClick: (screenPos: { x: number; y: number }) => void
  updatePreview: (screenPos: { x: number; y: number }) => void
  recomputePopupPos: () => void
}

const INITIAL_STATE: CalibrationState = {
  mode: 'idle',
  startPoint: null,
  endPoint: null,
  previewPoint: null,
  popupScreenPos: null,
  linePixelLength: 0,
  lineTooShort: false,
  isVerify: false
}

/**
 * Converts a screen-space position to stage (page-space) coordinates
 * using the stage's inverse absolute transform.
 */
function screenToStagePoint(
  stage: Konva.Stage,
  screenX: number,
  screenY: number
): StagePoint {
  const transform = stage.getAbsoluteTransform().copy().invert()
  return transform.point({ x: screenX, y: screenY })
}

/**
 * Calibration interaction state machine (new mm-based API).
 *
 * Manages the two-click line-drawing flow, tracks isVerify flag to differentiate
 * a normal calibration from a verify-only measurement. Every mode transition
 * writes to scaleStore.setCalibMode so Toolbar/StatusBar can subscribe reactively.
 */
export function useCalibrationMode(
  stageRef: RefObject<Konva.Stage | null>
): UseCalibrationModeReturn {
  const [state, setState] = useState<CalibrationState>(INITIAL_STATE)
  const stageContainerRef = useRef<HTMLElement | null>(null)

  const activate = useCallback(() => {
    setState({ ...INITIAL_STATE, mode: 'drawing', isVerify: false })
    useScaleStore.getState().setCalibMode('drawing')
  }, [])

  const activateVerify = useCallback(() => {
    setState({ ...INITIAL_STATE, mode: 'drawing', isVerify: true })
    useScaleStore.getState().setCalibMode('drawing')
  }, [])

  const cancel = useCallback(() => {
    setState(INITIAL_STATE)
    useScaleStore.getState().setCalibMode('idle')
  }, [])

  // Escape key cancels active calibration
  useEffect(() => {
    if (state.mode === 'idle') return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.mode, cancel])

  /**
   * Compute the popup screen position (absolute screen coords).
   * Places popup near the midpoint of the drawn line.
   */
  const recomputePopupPos = useCallback(() => {
    setState((prev) => {
      if (!prev.startPoint || !prev.endPoint) return prev
      const stage = stageRef.current
      if (!stage) return prev
      const transform = stage.getAbsoluteTransform()
      const midPage = {
        x: (prev.startPoint.x + prev.endPoint.x) / 2,
        y: (prev.startPoint.y + prev.endPoint.y) / 2
      }
      const midScreen = transform.point(midPage)
      const container = stage.container()
      const rect = container.getBoundingClientRect()
      return {
        ...prev,
        popupScreenPos: {
          x: rect.left + midScreen.x,
          y: rect.top + midScreen.y + 20
        }
      }
    })
  }, [stageRef])

  const recordClick = useCallback(
    (screenPos: { x: number; y: number }) => {
      const stage = stageRef.current
      if (!stage) return

      const stagePos = screenToStagePoint(stage, screenPos.x, screenPos.y)

      setState((prev) => {
        if (prev.mode !== 'drawing') return prev

        if (!prev.startPoint) {
          // First click — record start point
          return { ...prev, startPoint: stagePos }
        }

        // Second click — compute pixel length and transition to confirming
        const length = computePixelLength(prev.startPoint, stagePos)
        const tooShort = length < MIN_CALIBRATION_PIXELS

        if (tooShort) {
          return { ...prev, lineTooShort: true }
        }

        // Compute popup position
        const transform = stage.getAbsoluteTransform()
        const midPage = {
          x: (prev.startPoint.x + stagePos.x) / 2,
          y: (prev.startPoint.y + stagePos.y) / 2
        }
        const midScreen = transform.point(midPage)
        const container = stage.container()
        const rect = container.getBoundingClientRect()
        const popupPos = {
          x: rect.left + midScreen.x,
          y: rect.top + midScreen.y + 20
        }

        const nextState: CalibrationState = {
          ...prev,
          endPoint: stagePos,
          previewPoint: null,
          linePixelLength: length,
          lineTooShort: false,
          mode: 'confirming',
          popupScreenPos: popupPos
        }

        useScaleStore.getState().setCalibMode('confirming')
        return nextState
      })
    },
    [stageRef]
  )

  const updatePreview = useCallback(
    (screenPos: { x: number; y: number }) => {
      const stage = stageRef.current
      if (!stage) return
      const stagePos = screenToStagePoint(stage, screenPos.x, screenPos.y)
      setState((prev) => {
        if (prev.mode !== 'drawing' || !prev.startPoint) return prev
        return { ...prev, previewPoint: stagePos }
      })
    },
    [stageRef]
  )

  // Store ref for cleanup
  useEffect(() => {
    const stage = stageRef.current
    if (stage) {
      stageContainerRef.current = stage.container()
    }
  }, [stageRef])

  return { state, activate, activateVerify, cancel, recordClick, updatePreview, recomputePopupPos }
}
