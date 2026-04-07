import { useCallback, useEffect, useState, RefObject } from 'react'
import Konva from 'konva'
import { useViewerStore } from '../stores/viewerStore'
import {
  euclideanDistance,
  computePixelsPerUnit,
  pixelsToRealWorld
} from '../lib/scale-math'
import type {
  CalibrationPoint,
  MeasurementUnit,
  ScaleState
} from '../types/viewer'

export interface VerifyResult {
  pixelLength: number
  realWorldLength: number
  unit: MeasurementUnit
}

export interface UseCalibrationReturn {
  calibrationPoints: CalibrationPoint[]
  showDialog: boolean
  pixelDistance: number | null
  verifyResult: VerifyResult | null
  handleStageClick: (e: Konva.KonvaEventObject<MouseEvent>) => void
  handleDialogConfirm: (distance: number, unit: MeasurementUnit) => void
  handleDialogCancel: () => void
  dismissVerifyResult: () => void
  cancelCalibration: () => void
}

/**
 * Calibration interaction state machine.
 *
 * Handles two-click calibration line placement, dialog trigger for distance entry,
 * and verify-scale measurement reporting. Coordinates are converted from screen
 * space to PDF page-space via the Stage's inverse absolute transform — this is
 * critical for keeping calibration accurate at any zoom level.
 */
export function useCalibration(
  stageRef: RefObject<Konva.Stage | null>
): UseCalibrationReturn {
  const activeTool = useViewerStore((s) => s.activeTool)
  const currentPage = useViewerStore((s) => s.currentPage)
  const getPageScale = useViewerStore((s) => s.getPageScale)
  const setPageScale = useViewerStore((s) => s.setPageScale)
  const setActiveTool = useViewerStore((s) => s.setActiveTool)

  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [pixelDistance, setPixelDistance] = useState<number | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)

  // Reset transient calibration state when page changes or tool changes.
  // This prevents partial calibrations from leaking across page navigation
  // (research pitfall #5) and clears stale UI when the user switches tools.
  useEffect(() => {
    setCalibrationPoints([])
    setShowDialog(false)
    setPixelDistance(null)
    setVerifyResult(null)
  }, [currentPage, activeTool])

  const cancelCalibration = useCallback(() => {
    setCalibrationPoints([])
    setShowDialog(false)
    setPixelDistance(null)
    setVerifyResult(null)
    setActiveTool('select')
  }, [setActiveTool])

  // Escape key cancels active calibration.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && activeTool !== 'select') {
        cancelCalibration()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTool, cancelCalibration])

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'scale' && activeTool !== 'verify-scale') return
      // Only respond to left click. Middle/right go to pan/context.
      if (e.evt.button !== 0) return

      const stage = stageRef.current
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      // Convert screen-space pointer to PDF page-space coordinates by inverting
      // the Stage's absolute transform (zoom + pan). This MUST happen — using
      // raw pointer coordinates would produce zoom-dependent calibration ratios.
      const transform = stage.getAbsoluteTransform().copy().invert()
      const pagePos = transform.point(pointer)
      const point: CalibrationPoint = { x: pagePos.x, y: pagePos.y }

      setCalibrationPoints((prev) => {
        if (prev.length === 0) {
          return [point]
        }
        if (prev.length === 1) {
          const next = [prev[0], point]
          const dist = euclideanDistance(
            prev[0].x,
            prev[0].y,
            point.x,
            point.y
          )
          if (dist <= 0) {
            // Degenerate click — ignore second point.
            return prev
          }
          if (activeTool === 'scale') {
            setPixelDistance(dist)
            setShowDialog(true)
          } else {
            // verify-scale
            const pageScale = getPageScale(currentPage)
            if (!pageScale) {
              // Should not normally happen — toolbar disables Verify when uncalibrated.
              // Reset and bail.
              return []
            }
            const realWorldLength = pixelsToRealWorld(
              dist,
              pageScale.pixelsPerUnit
            )
            setVerifyResult({
              pixelLength: dist,
              realWorldLength,
              unit: pageScale.unit
            })
          }
          return next
        }
        // Already had 2 points — start a new calibration cycle.
        return [point]
      })
    },
    [activeTool, stageRef, getPageScale, currentPage]
  )

  const handleDialogConfirm = useCallback(
    (distance: number, unit: MeasurementUnit) => {
      if (pixelDistance === null || calibrationPoints.length !== 2) return
      const ppu = computePixelsPerUnit(pixelDistance, distance)
      const [p1, p2] = calibrationPoints
      const scale: ScaleState = {
        pixelsPerUnit: ppu,
        unit,
        realWorldDistance: distance,
        linePoints: [p1.x, p1.y, p2.x, p2.y]
      }
      setPageScale(currentPage, scale)
      setCalibrationPoints([])
      setShowDialog(false)
      setPixelDistance(null)
      setActiveTool('select')
    },
    [pixelDistance, calibrationPoints, setPageScale, currentPage, setActiveTool]
  )

  const handleDialogCancel = useCallback(() => {
    setCalibrationPoints([])
    setShowDialog(false)
    setPixelDistance(null)
    // Keep activeTool as 'scale' so the user can immediately retry.
  }, [])

  const dismissVerifyResult = useCallback(() => {
    setVerifyResult(null)
    setCalibrationPoints([])
    setActiveTool('select')
  }, [setActiveTool])

  return {
    calibrationPoints,
    showDialog,
    pixelDistance,
    verifyResult,
    handleStageClick,
    handleDialogConfirm,
    handleDialogCancel,
    dismissVerifyResult,
    cancelCalibration
  }
}
