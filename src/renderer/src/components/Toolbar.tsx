import { useState } from 'react'
import {
  FileUp,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Ruler,
  MapPin,
  Minus,
  Square,
  Hexagon,
  Save,
  SaveAll
} from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useProject } from '../hooks/useProject'
import { getCanvasControls, getCalibrationControls } from './CanvasViewport'
import { ScaleContextMenu } from './ScaleContextMenu'
import { MIN_ZOOM, MAX_ZOOM, COLORS } from '../lib/constants'

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
  title,
  onContextMenu,
  children
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>
  label?: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title: string
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children?: React.ReactNode
}): React.JSX.Element {
  const baseBackground = active ? COLORS.activeSurface : 'transparent'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onContextMenu={onContextMenu}
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
      {children}
    </button>
  )
}

export interface ToolbarProps {
  /**
   * Called when the user clicks the Open button. Owned by App.tsx so the
   * dirty-guard + result-routing through handleOpenResult (which mounts
   * MissingPdfModal/HashMismatchModal/etc.) stays in one place. Toolbar must
   * NOT call useProject().openProjectDialog directly — that path discards the
   * ProjectOpenResult and recovery modals never appear.
   */
  onOpenClick: () => void | Promise<void>
}

export function Toolbar({ onOpenClick }: ToolbarProps): React.JSX.Element {
  const { totalPages, currentPage, nextPage, prevPage } = useViewerStore()
  const getViewport = useViewerStore((s) => s.getViewport)
  const activeTool = useViewerStore((s) => s.activeTool)
  const setActiveTool = useViewerStore((s) => s.setActiveTool)
  const getScale = useScaleStore((s) => s.getScale)
  const calibMode = useScaleStore((s) => s.calibMode)

  // useProject called ONCE per render; save callbacks destructured for buttons.
  // Open is routed via the onOpenClick prop (owned by App.tsx) — see ToolbarProps.
  const { saveProject, saveProjectAs } = useProject()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const pageScale = totalPages > 0 ? getScale(currentPage) : null
  const setScaleDisabled = totalPages === 0
  const isCalibrating = calibMode !== 'idle'
  const saveDisabled = totalPages === 0

  const currentZoom = totalPages > 0 ? getViewport(currentPage).zoom : 1
  const zoomPct = Math.round(currentZoom * 100)
  // Highlight zoom text when not at 100% (tolerance of 0.01 for float comparison)
  const isZoomDefault = Math.abs(currentZoom - 1.0) < 0.01

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

  const handleSetScale = (): void => {
    const controls = getCalibrationControls()
    if (!controls) return
    if (isCalibrating) {
      controls.cancel()
    } else {
      controls.activate()
    }
  }

  const openContextMenu = (clientX: number, clientY: number): void => {
    // Only open when page has a scale
    if (setScaleDisabled || pageScale === null) return
    setContextMenu({ x: clientX, y: clientY })
  }

  const handleMarkupToolClick = (tool: 'count' | 'linear' | 'area' | 'perimeter'): void => {
    if (activeTool === tool) {
      setActiveTool('select')
    } else {
      setActiveTool(tool)
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (setScaleDisabled || pageScale === null) return
    e.preventDefault()
    openContextMenu(e.clientX, e.clientY)
  }

  const handleChevronClick = (e: React.MouseEvent<HTMLSpanElement>): void => {
    e.stopPropagation() // prevent firing the Set Scale button's onClick
    const rect = e.currentTarget.getBoundingClientRect()
    openContextMenu(rect.left, rect.bottom + 2)
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
      {/* Left: Open + Save + Save As */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => { void onOpenClick() }}
          title="Open project or PDF (Ctrl+O)"
          aria-label="Open project or PDF (Ctrl+O)"
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
          <span>Open</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <IconButton
            icon={Save}
            label="Save"
            disabled={saveDisabled}
            onClick={() => { void saveProject() }}
            title="Save (Ctrl+S)"
          />
          <IconButton
            icon={SaveAll}
            label="Save As"
            disabled={saveDisabled}
            onClick={() => { void saveProjectAs() }}
            title="Save As (Ctrl+Shift+S)"
          />
        </div>
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

      {/* Tools: Set Scale (with chevron when calibrated) */}
      {totalPages > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton
            icon={Ruler}
            label="Set Scale"
            active={isCalibrating}
            disabled={setScaleDisabled}
            onClick={handleSetScale}
            onContextMenu={handleContextMenu}
            title="Set scale calibration (draw line between known points)"
          >
            {pageScale !== null && (
              <span
                role="button"
                aria-label="Scale actions menu"
                aria-haspopup="menu"
                onClick={handleChevronClick}
                style={{
                  display: 'inline-block',
                  marginLeft: 6,
                  fontSize: 10,
                  lineHeight: 1,
                  opacity: 0.7,
                  cursor: 'pointer'
                }}
              >
                {'▾'}
              </span>
            )}
          </IconButton>
        </div>
      )}

      {/* Markup tools: Count, Linear, Area, Perimeter */}
      {totalPages > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton
            icon={MapPin}
            label="Count"
            active={activeTool === 'count'}
            disabled={setScaleDisabled}
            onClick={() => handleMarkupToolClick('count')}
            title="Count tool — place pins to tally items"
          />
          <IconButton
            icon={Minus}
            label="Linear"
            active={activeTool === 'linear'}
            disabled={setScaleDisabled}
            onClick={() => handleMarkupToolClick('linear')}
            title="Linear tool — draw polylines to measure lengths"
          />
          <IconButton
            icon={Square}
            label="Area"
            active={activeTool === 'area'}
            disabled={setScaleDisabled}
            onClick={() => handleMarkupToolClick('area')}
            title="Area tool — trace polygons to measure surface area"
          />
          <IconButton
            icon={Hexagon}
            label="Perimeter"
            active={activeTool === 'perimeter'}
            disabled={setScaleDisabled}
            onClick={() => handleMarkupToolClick('perimeter')}
            title="Perimeter tool — trace polygons for perimeter + area"
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

      {/* Scale context menu (rendered at document level via fixed positioning) */}
      {contextMenu && (
        <ScaleContextMenu
          screenPos={contextMenu}
          onRecalibrate={() => {
            const controls = getCalibrationControls()
            controls?.activate()
          }}
          onVerify={() => {
            const controls = getCalibrationControls()
            controls?.activateVerify()
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
