import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'

/**
 * useDraggable — D-10/D-11/D-12/D-14 modal drag hook.
 *
 * Returns:
 *   position    — null while the modal has not yet been dragged (centred via
 *                 CSS flex/transform by the consumer). Once the user drags
 *                 anywhere on the modal body, position becomes { x, y } where
 *                 x/y are pixel offsets from the centred origin.
 *   onPointerDown — attach to the modal's outer content div. Drag is captured
 *                   on pointerdown, tracked via window pointermove until
 *                   pointerup (browser-native pointer capture).
 *
 * Behaviour:
 *   D-12 Interactive control guard — uses .closest('button, input, select,
 *        textarea, [role="button"]') so wrappers around custom controls (e.g.
 *        a span with role="button") do not accidentally start a drag.
 *   D-14 Position reset — useState(null) reinitialises every mount; modal
 *        unmount+remount (close→reopen) automatically re-centres.
 *   T-09-01-01 Listener leak — pointermove and pointerup listeners are
 *        registered once and removed on unmount.
 *   Viewport clamping — drag delta is clamped to ±(innerWidth/2 - 50) and
 *        ±(innerHeight/2 - 50) so the modal header always stays reachable.
 */
export interface DragPosition {
  x: number
  y: number
}

export interface UseDraggableReturn {
  position: DragPosition | null
  onPointerDown: (e: React.PointerEvent) => void
}

interface DragStart {
  mouseX: number
  mouseY: number
  posX: number
  posY: number
}

export function useDraggable(): UseDraggableReturn {
  const [position, setPosition] = useState<DragPosition | null>(null)
  const dragStart = useRef<DragStart | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent): void => {
      // D-12: enhanced interactive guard via .closest() so role="button"
      // wrappers and nested form-control children are caught correctly.
      const target = e.target as HTMLElement | null
      if (target && typeof target.closest === 'function') {
        if (target.closest('button, input, select, textarea, [role="button"]')) {
          return
        }
      }

      // Browser-native pointer capture — handles pointer leaving window and
      // multi-pointer conflicts automatically (RESEARCH §"Don't Hand-Roll").
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId)
      } catch {
        // jsdom or non-pointer environments may throw — degrade gracefully
      }

      const pos = position ?? { x: 0, y: 0 }
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: pos.x,
        posY: pos.y
      }
    },
    [position]
  )

  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.mouseX
      const dy = e.clientY - dragStart.current.mouseY
      const newX = dragStart.current.posX + dx
      const newY = dragStart.current.posY + dy

      // Viewport clamping (review concern): keep the drag handle reachable.
      // 50px margin ensures the modal cannot be flung entirely off-screen.
      const clampX = window.innerWidth / 2 - 50
      const clampY = window.innerHeight / 2 - 50

      setPosition({
        x: Math.max(-clampX, Math.min(clampX, newX)),
        y: Math.max(-clampY, Math.min(clampY, newY))
      })
    }
    const onUp = (): void => {
      dragStart.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  return { position, onPointerDown }
}
