import {
  FileUp,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Ruler,
  CheckCircle
} from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { getCanvasControls } from './CanvasViewport'
import { MIN_ZOOM, MAX_ZOOM, COLORS } from '../lib/constants'

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
  title
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>
  label?: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title: string
}): React.JSX.Element {
  const baseBackground = active ? COLORS.activeSurface : 'transparent'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: label ? 4 : 0,
        height: 28,
        padding: label ? '4px 8px' : '6px',
        background: baseBackground,
        border: 'none',
        borderRadius: 4,
        borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
        color: '#cccccc',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        lineHeight: 1.4
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) e.currentTarget.style.background = '#2d2d30'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseBackground
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.background = '#37373d'
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.background = active ? COLORS.activeSurface : '#2d2d30'
      }}
    >
      <Icon size={16} color="currentColor" />
      {label && <span>{label}</span>}
    </button>
  )
}

export function Toolbar(): React.JSX.Element {
  const { totalPages, currentPage, nextPage, prevPage } = useViewerStore()
  const getViewport = useViewerStore((s) => s.getViewport)
  const activeTool = useViewerStore((s) => s.activeTool)
  const setActiveTool = useViewerStore((s) => s.setActiveTool)
  const getPageScale = useViewerStore((s) => s.getPageScale)
  const { openPdfDialog } = usePdfDocument()

  const pageHasScale = totalPages > 0 ? getPageScale(currentPage) !== null : false

  const currentZoom = totalPages > 0 ? getViewport(currentPage).zoom : 1
  const zoomPct = Math.round(currentZoom * 100)
  // Highlight zoom text when not at 100% (tolerance of 0.01 for float comparison)
  const isZoomDefault = Math.abs(currentZoom - 1.0) < 0.01

  const handleOpenPdf = async (): Promise<void> => {
    await openPdfDialog()
  }

  const handleZoomIn = (): void => {
    const controls = getCanvasControls()
    if (controls) {
      controls.zoomIn()
    }
  }

  const handleZoomOut = (): void => {
    const controls = getCanvasControls()
    if (controls) {
      controls.zoomOut()
    }
  }

  const handleFit = (): void => {
    const controls = getCanvasControls()
    if (controls) {
      controls.fitToWindow()
    }
  }

  return (
    <div
      style={{
        height: 40,
        background: '#252526',
        borderBottom: '1px solid #3c3c3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0
      }}
    >
      {/* Left: Open PDF */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={handleOpenPdf}
          title="Open PDF file (Ctrl+O)"
          aria-label="Open PDF file (Ctrl+O)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: 28,
            padding: '4px 8px',
            background: '#0078d4',
            border: 'none',
            borderRadius: 4,
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            lineHeight: 1.4
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1a86db'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#0078d4'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.background = '#0067b8'
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.background = '#1a86db'
          }}
        >
          <FileUp size={16} color="#ffffff" />
          <span>Open PDF</span>
        </button>
      </div>

      {/* Center: Page navigation */}
      {totalPages > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton
            icon={ChevronLeft}
            onClick={prevPage}
            disabled={currentPage === 1}
            title="Previous page (Left Arrow)"
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#cccccc',
              padding: '0 4px'
            }}
            aria-live="polite"
          >
            Page {currentPage} of {totalPages}
          </span>
          <IconButton
            icon={ChevronRight}
            onClick={nextPage}
            disabled={currentPage === totalPages}
            title="Next page (Right Arrow)"
          />
        </div>
      )}

      {/* Tools: Set Scale, Verify Scale */}
      {totalPages > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton
            icon={Ruler}
            label="Set Scale"
            active={activeTool === 'scale'}
            onClick={() =>
              setActiveTool(activeTool === 'scale' ? 'select' : 'scale')
            }
            title="Set scale calibration (draw line between known points)"
          />
          <IconButton
            icon={CheckCircle}
            label="Verify"
            active={activeTool === 'verify-scale'}
            disabled={!pageHasScale}
            onClick={() =>
              setActiveTool(activeTool === 'verify-scale' ? 'select' : 'verify-scale')
            }
            title="Verify scale accuracy (measure a known dimension)"
          />
        </div>
      )}

      {/* Right: Zoom controls */}
      {totalPages > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton
            icon={ZoomOut}
            onClick={handleZoomOut}
            disabled={currentZoom <= MIN_ZOOM}
            title="Zoom out (Ctrl+-)"
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isZoomDefault ? '#cccccc' : '#0078d4',
              padding: '0 4px',
              minWidth: 40,
              textAlign: 'center'
            }}
          >
            {zoomPct}%
          </span>
          <IconButton
            icon={ZoomIn}
            onClick={handleZoomIn}
            disabled={currentZoom >= MAX_ZOOM}
            title="Zoom in (Ctrl+=)"
          />
          <IconButton
            icon={Maximize}
            onClick={handleFit}
            title="Fit to window (Ctrl+0)"
          />
        </div>
      )}
    </div>
  )
}
