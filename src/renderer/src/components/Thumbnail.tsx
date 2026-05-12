import { useRef, useEffect, useState } from 'react'
import { Ruler, AlertTriangle } from 'lucide-react'
import { useThumbnailRender } from '../hooks/useThumbnailRender'
import { useViewerStore } from '../stores/viewerStore'
import { COLORS } from '../lib/constants'
import type { PageScale } from '../types/scale'
import type { PDFDocumentProxy } from '../lib/pdf-setup'

// A1: Markup coordinate system assumption:
// Markup coords are stored in PDF_BASE_SCALE=2.0 stage units (per STATE.md markup coordinate decision).
// thumbnailScale = TARGET_CSS_WIDTH*dpr / page.getViewport({scale:1}).width
// drawMarkupOverlay uses (thumbnailScale / PDF_BASE_SCALE) * dpr for the coordinate scale factor.
// If markups appear offset on first run, re-verify coordinate storage format in types/markup.ts.
// MANUAL VERIFY: Open a project with count pins, check thumbnail shows pins at correct positions.

export interface ThumbnailProps {
  pageNumber: number
  isActive: boolean
  pageLabel: string        // resolved label from usePageLabels fallback
  pageScale: PageScale | null
  markupCount: number
}

export function Thumbnail({
  pageNumber,
  isActive,
  pageLabel,
  pageScale,
  markupCount
}: ThumbnailProps): React.JSX.Element {
  const tileRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  const pdfDocument = useViewerStore((s) => s.pdfDocument) as PDFDocumentProxy | null

  // IntersectionObserver lazy-mount (D-17): only rasterize when tile enters viewport
  useEffect(() => {
    const el = tileRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setIsVisible(true)
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Rasterize only when visible (IntersectionObserver fired)
  const { pageCanvasRef, overlayCanvasRef, cssWidth, cssHeight, isRendering } =
    useThumbnailRender(isVisible ? pdfDocument : null, pageNumber)

  // Border style: 2px accent for active page, 1px border for idle
  const borderStyle = isActive
    ? `2px solid ${COLORS.accent}`
    : `1px solid ${COLORS.border}`

  return (
    <div
      data-thumbnail-tile
      ref={tileRef}
      onClick={() => useViewerStore.getState().setPage(pageNumber)}
      style={{
        position: 'relative',
        width: cssWidth,
        cursor: 'pointer',
        border: borderStyle,
        background: COLORS.dominant,
        userSelect: 'none'
      }}
    >
      {/* Canvas area — skeleton before intersection, two-canvas after */}
      <div
        style={{
          position: 'relative',
          width: cssWidth,
          height: cssHeight,
          overflow: 'hidden'
        }}
      >
        {!isVisible || isRendering ? (
          // Skeleton placeholder (A4 aspect ratio approximation until rendered)
          <div
            style={{
              width: '100%',
              height: '100%',
              background: COLORS.secondary
            }}
          />
        ) : (
          // Two-canvas composite: page raster (bottom) + overlay (top)
          <div style={{ position: 'relative', width: cssWidth, height: cssHeight }}>
            <div
              ref={(el) => {
                if (!el || !pageCanvasRef.current) return
                if (el.children[0] !== pageCanvasRef.current) {
                  el.innerHTML = ''
                  el.appendChild(pageCanvasRef.current)
                }
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: cssWidth,
                height: cssHeight
              }}
            />
            <div
              ref={(el) => {
                if (!el || !overlayCanvasRef.current) return
                if (el.children[0] !== overlayCanvasRef.current) {
                  el.innerHTML = ''
                  el.appendChild(overlayCanvasRef.current)
                }
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: cssWidth,
                height: cssHeight,
                pointerEvents: 'none'
              }}
            />
          </div>
        )}

        {/* Scale-status icon badge: top-left, 4px inset */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            width: 14,
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={
            pageScale !== null
              ? `Calibrated — 1:${Math.round((pageScale.pixelsPerMm ?? 1) > 0 ? 1 / (pageScale.pixelsPerMm / 3779.5275591) : 1)}`
              : 'Page not calibrated — length and area markups will be excluded from totals.'
          }
        >
          {pageScale !== null ? (
            <Ruler size={12} color={COLORS.textSecondary} />
          ) : (
            <AlertTriangle size={12} color={COLORS.warning} />
          )}
        </div>

        {/* Markup count chip: top-right, 4px inset — hidden when count=0 */}
        {markupCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: COLORS.secondary,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 3,
              padding: '0 4px',
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.textPrimary,
              lineHeight: '16px',
              minWidth: 16,
              textAlign: 'center'
            }}
            title={`${markupCount} markup${markupCount === 1 ? '' : 's'}`}
          >
            {markupCount}
          </div>
        )}
      </div>

      {/* Page label: below image, centered */}
      <div
        data-thumbnail-label
        style={{
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 400,
          color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
          padding: '4px 0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {pageLabel}
      </div>
    </div>
  )
}
