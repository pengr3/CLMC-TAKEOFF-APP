import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
 *   Viewport clamping — measure the dialog, constrain its scroll box, and keep
 *        all edges inside the effective CSS viewport after drag/resize/scroll.
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
  const dialog = useRef<HTMLElement | null>(null)
  const positionRef = useRef<DragPosition | null>(null)
  const resizeObserver = useRef<ResizeObserver | null>(null)
  const originalLimits = useRef({ maxWidth: '', maxHeight: '' })

  useLayoutEffect(() => {
    positionRef.current = position
  }, [position])

  const clamp = useCallback((next: DragPosition): DragPosition => {
    const viewport = window.visualViewport
    const width = viewport?.width ?? window.innerWidth
    const height = viewport?.height ?? window.innerHeight
    const left = viewport?.offsetLeft ?? 0
    const top = viewport?.offsetTop ?? 0
    const element = dialog.current
    if (element) {
      // Long content scrolls at the existing type/target size; never shrink text.
      const maxWidth = `${Math.max(1, width - 48)}px`
      const maxHeight = `${Math.max(1, height - 48)}px`
      element.style.maxWidth = originalLimits.current.maxWidth
        ? `min(${originalLimits.current.maxWidth}, ${maxWidth})`
        : maxWidth
      element.style.maxHeight = originalLimits.current.maxHeight
        ? `min(${originalLimits.current.maxHeight}, ${maxHeight})`
        : maxHeight
      element.style.overflowY = 'auto'
      const bounds = element.getBoundingClientRect()
      if (bounds.width > 0 && bounds.height > 0) {
        const previous = positionRef.current ?? { x: 0, y: 0 }
        const baseLeft = bounds.left - previous.x
        const baseTop = bounds.top - previous.y
        const minX = left + 24 - baseLeft
        const maxX = left + width - 24 - bounds.width - baseLeft
        const minY = top + 24 - baseTop
        const maxY = top + height - 24 - bounds.height - baseTop
        return {
          x: Math.max(minX, Math.min(Math.max(minX, maxX), next.x)),
          y: Math.max(minY, Math.min(Math.max(minY, maxY), next.y))
        }
      }
    }
    // Unmeasurable hosts (including non-DOM adapters) retain the legacy guard.
    const clampX = Math.max(0, width / 2 - 50)
    const clampY = Math.max(0, height / 2 - 50)
    return {
      x: Math.max(-clampX, Math.min(clampX, next.x)),
      y: Math.max(-clampY, Math.min(clampY, next.y))
    }
  }, [])

  const commitPosition = useCallback(
    (next: DragPosition): void => {
      const bounded = clamp(next)
      const previous = positionRef.current
      if (previous?.x === bounded.x && previous?.y === bounded.y) return
      setPosition(bounded)
    },
    [clamp]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent): void => {
      if (e.currentTarget instanceof HTMLElement) {
        if (dialog.current !== e.currentTarget) {
          originalLimits.current = {
            maxWidth: e.currentTarget.style.maxWidth,
            maxHeight: e.currentTarget.style.maxHeight
          }
        }
        dialog.current = e.currentTarget
        resizeObserver.current?.disconnect()
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver.current = new ResizeObserver(() => {
            if (positionRef.current) commitPosition(positionRef.current)
          })
          resizeObserver.current.observe(e.currentTarget)
        }
      }
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
    [position, commitPosition]
  )

  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.mouseX
      const dy = e.clientY - dragStart.current.mouseY
      const newX = dragStart.current.posX + dx
      const newY = dragStart.current.posY + dy

      commitPosition({ x: newX, y: newY })
    }
    const onUp = (): void => {
      dragStart.current = null
    }
    const onViewportChange = (): void => {
      dragStart.current = null
      if (positionRef.current) commitPosition(positionRef.current)
    }
    const viewport = window.visualViewport
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    viewport?.addEventListener('resize', onViewportChange)
    viewport?.addEventListener('scroll', onViewportChange)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
      viewport?.removeEventListener('resize', onViewportChange)
      viewport?.removeEventListener('scroll', onViewportChange)
      resizeObserver.current?.disconnect()
    }
  }, [commitPosition])

  return { position, onPointerDown }
}
