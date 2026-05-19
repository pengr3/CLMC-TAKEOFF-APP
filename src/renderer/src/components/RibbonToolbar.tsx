import React, { useState } from 'react'
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
  BrickWall,
  Save,
  SaveAll,
  Replace,
  Download,
  MousePointer,
  Eye,
  EyeOff,
  Table
} from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useProjectStore } from '../stores/projectStore'
import { useMarkupStore } from '../stores/markupStore'
import { useProject } from '../hooks/useProject'
import { useUiPanels } from '../hooks/useUiPanels'
import { getCanvasControls, getCalibrationControls, getChainArmedItem, setChainArmedFromTotals } from './CanvasViewport'
import { ScaleContextMenu } from './ScaleContextMenu'
import { RibbonButton } from './RibbonButton'
import { MIN_ZOOM, MAX_ZOOM, COLORS } from '../lib/constants'

/**
 * RibbonToolbar — tabbed Office-style ribbon replacing the legacy flat Toolbar.tsx.
 *
 * Phase 09 Plan 04 (D-15 through D-24):
 *   - 7 tabs: Home, Page, Tools, View, Estimating, Settings, Help
 *   - Home (D-17): Open, Save, Save As, Replace Plan PDF, Export (1:1 from old Toolbar left group)
 *   - Page (D-18): Prev / "Page N of M" / Next
 *   - Tools (D-19): Select (new), Count, Linear, Area, Perimeter, Wall, Set Scale
 *   - View (D-20): Zoom In, Zoom Out, Fit to Window, Show Totals toggle, Show All, Hide All
 *   - Estimating (D-21): Quick Export shortcut
 *   - Settings (D-22) / Help (D-23): "Coming soon" stubs
 *   - Default active tab is Home (D-24)
 *
 * Props identical to ToolbarProps for zero-friction swap in App.tsx.
 *
 * IMPORTANT (Pitfall 6 from 09-RESEARCH): chain badge chips are gated on
 * activeTool === <toolName> AND getChainArmedItem() !== null. Reading
 * getChainArmedItem() during render is correct because re-renders are
 * driven by activeTool state changes — the module-ref is read inside the
 * render path, matching the legacy Toolbar pattern.
 *
 * IMPORTANT (Pitfall 7 from 09-RESEARCH): setHiddenItemNames does NOT call
 * markDirty internally — it's designed for hydration. Show All / Hide All
 * handlers MUST call markDirty() explicitly after.
 */

export interface RibbonToolbarProps {
  onOpenClick: () => void | Promise<void>
  onReplaceClick: () => void | Promise<void>
  onExportClick: () => void | Promise<void>
}

type TabId = 'home' | 'page' | 'tools' | 'view' | 'estimating' | 'settings' | 'help'

interface TabSpec {
  id: TabId
  label: string
}

const TABS: TabSpec[] = [
  { id: 'home', label: 'Home' },
  { id: 'page', label: 'Page' },
  { id: 'tools', label: 'Tools' },
  { id: 'view', label: 'View' },
  { id: 'estimating', label: 'Estimating' },
  { id: 'settings', label: 'Settings' },
  { id: 'help', label: 'Help' }
]

// Chain-armed badge chip — same shape as Toolbar.tsx lines 368-380.
// Extracted to a helper so it isn't duplicated 5 times in render.
function ChainBadge({
  color,
  name
}: {
  color: string
  name: string
}): React.JSX.Element {
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 4,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10,
        fontWeight: 600,
        background: COLORS.activeSurface,
        borderRadius: 3,
        padding: '1px 4px',
        maxWidth: 64,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          flexShrink: 0
        }}
      />
      {name}
    </span>
  )
}

export function RibbonToolbar({
  onOpenClick,
  onReplaceClick,
  onExportClick
}: RibbonToolbarProps): React.JSX.Element {
  // --- Store selectors (copied verbatim from Toolbar.tsx state region) ---
  const { totalPages, currentPage, nextPage, prevPage } = useViewerStore()
  const getViewport = useViewerStore((s) => s.getViewport)
  const activeTool = useViewerStore((s) => s.activeTool)
  const setActiveTool = useViewerStore((s) => s.setActiveTool)
  const getScale = useScaleStore((s) => s.getScale)
  const calibMode = useScaleStore((s) => s.calibMode)

  const { saveProject, saveProjectAs } = useProject()
  const isSaving = useProjectStore((s) => s.isSaving)
  const isExporting = useProjectStore((s) => s.isExporting)
  const hasMarkups = useMarkupStore((s) =>
    Object.values(s.pageMarkups).some((arr) => arr.length > 0)
  )

  // UI panel state (Show Totals toggle in View tab — D-20)
  const { totals, setTotalsOpen } = useUiPanels()

  // Local UI state
  const [activeTab, setActiveTab] = useState<TabId>('home') // D-24
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const pageScale = totalPages > 0 ? getScale(currentPage) : null
  const setScaleDisabled = totalPages === 0
  const isCalibrating = calibMode !== 'idle'
  const saveDisabled = totalPages === 0 || isSaving
  const replaceDisabled = totalPages === 0 || isSaving
  const exportDisabled = totalPages === 0 || isSaving || isExporting || !hasMarkups

  const currentZoom = totalPages > 0 ? getViewport(currentPage).zoom : 1

  // --- Handlers (copied / adapted from Toolbar.tsx) ---

  const handleZoomIn = (): void => {
    getCanvasControls()?.zoomIn()
  }

  const handleZoomOut = (): void => {
    getCanvasControls()?.zoomOut()
  }

  const handleFit = (): void => {
    getCanvasControls()?.fitToWindow()
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
    if (setScaleDisabled || pageScale === null) return
    setContextMenu({ x: clientX, y: clientY })
  }

  const handleMarkupToolClick = (
    tool: 'count' | 'linear' | 'area' | 'perimeter' | 'wall'
  ): void => {
    if (activeTool === tool) {
      setChainArmedFromTotals(null)
      setActiveTool('select')
    } else {
      setActiveTool(tool)
    }
  }

  const handleSelectTool = (): void => {
    setActiveTool('select')
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (setScaleDisabled || pageScale === null) return
    e.preventDefault()
    openContextMenu(e.clientX, e.clientY)
  }

  const handleChevronClick = (e: React.MouseEvent<HTMLSpanElement>): void => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    openContextMenu(rect.left, rect.bottom + 2)
  }

  // Show All / Hide All — both MUST call markDirty explicitly (Pitfall 7).
  const handleShowAll = (): void => {
    useProjectStore.getState().setHiddenItemNames([])
    useProjectStore.getState().markDirty()
  }

  const handleHideAll = (): void => {
    const { pageMarkups } = useMarkupStore.getState()
    const allKeys = Array.from(
      new Set(
        Object.values(pageMarkups)
          .flat()
          .map((m) => `${m.name}|${m.categoryId}`)
      )
    )
    useProjectStore.getState().setHiddenItemNames(allKeys)
    useProjectStore.getState().markDirty()
  }

  const handleToggleTotals = (): void => {
    setTotalsOpen(!totals.open)
  }

  // --- Render helpers ---

  // Reusable Open button styled like the legacy "primary" Open button
  // (accent background) — used in Home tab (D-17). RibbonButton itself
  // doesn't carry a primary-accent variant; we render a bespoke button
  // shaped like RibbonButton (72×80) but with accent background.
  const renderOpenButton = (): React.JSX.Element => (
    <button
      onClick={() => {
        void onOpenClick()
      }}
      title="Open project or PDF (Ctrl+O)"
      aria-label="Open project or PDF (Ctrl+O)"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: 72,
        height: 80,
        padding: '8px 4px',
        background: COLORS.accent,
        border: 'none',
        borderRadius: 4,
        color: COLORS.textOnAccent,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.2,
        cursor: 'pointer',
        textAlign: 'center'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = COLORS.accentHover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = COLORS.accent
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.background = COLORS.accentActive
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.background = COLORS.accentHover
      }}
    >
      <FileUp size={20} color={COLORS.textOnAccent} />
      <span>Open</span>
    </button>
  )

  const renderHomeTab = (): React.JSX.Element => (
    <>
      {renderOpenButton()}
      <RibbonButton
        icon={Save}
        label="Save"
        onClick={() => {
          void saveProject()
        }}
        disabled={saveDisabled}
        title="Save (Ctrl+S)"
      />
      <RibbonButton
        icon={SaveAll}
        label="Save As"
        onClick={() => {
          void saveProjectAs()
        }}
        disabled={saveDisabled}
        title="Save As (Ctrl+Shift+S)"
      />
      <RibbonButton
        icon={Replace}
        label="Replace PDF"
        onClick={() => {
          void onReplaceClick()
        }}
        disabled={replaceDisabled}
        title="Replace Plan PDF — markups preserved, save (Ctrl+S) to persist"
        ariaLabel="Replace Plan PDF"
      />
      <RibbonButton
        icon={Download}
        label="Export"
        onClick={() => {
          void onExportClick()
        }}
        disabled={exportDisabled}
        title="Export BOQ to Excel or CSV (Ctrl+Shift+E)"
        ariaLabel="Export"
      />
    </>
  )

  const renderPageTab = (): React.JSX.Element => {
    if (totalPages === 0) {
      return (
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          No PDF loaded — open a project or PDF from the Home tab.
        </span>
      )
    }
    return (
      <>
        <RibbonButton
          icon={ChevronLeft}
          label="Previous"
          onClick={prevPage}
          disabled={currentPage === 1}
          title="Previous page (Left Arrow)"
        />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 12px',
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textSecondary,
            minWidth: 100,
            justifyContent: 'center'
          }}
          aria-live="polite"
        >
          Page {currentPage} of {totalPages}
        </span>
        <RibbonButton
          icon={ChevronRight}
          label="Next"
          onClick={nextPage}
          disabled={currentPage === totalPages}
          title="Next page (Right Arrow)"
        />
      </>
    )
  }

  const renderToolsTab = (): React.JSX.Element => (
    <>
      <RibbonButton
        icon={MousePointer}
        label="Select"
        active={activeTool === 'select'}
        onClick={handleSelectTool}
        title="Select tool — click a markup to select; drag to rubber-band multi-select"
      />
      <RibbonButton
        icon={MapPin}
        label="Count"
        active={activeTool === 'count'}
        disabled={setScaleDisabled}
        onClick={() => handleMarkupToolClick('count')}
        title="Count tool — place pins to tally items"
      >
        {activeTool === 'count' && getChainArmedItem() !== null && (
          <ChainBadge color={getChainArmedItem()!.color} name={getChainArmedItem()!.name} />
        )}
      </RibbonButton>
      <RibbonButton
        icon={Minus}
        label="Linear"
        active={activeTool === 'linear'}
        disabled={setScaleDisabled}
        onClick={() => handleMarkupToolClick('linear')}
        title="Linear tool — draw polylines to measure lengths"
      >
        {activeTool === 'linear' && getChainArmedItem() !== null && (
          <ChainBadge color={getChainArmedItem()!.color} name={getChainArmedItem()!.name} />
        )}
      </RibbonButton>
      <RibbonButton
        icon={Square}
        label="Area"
        active={activeTool === 'area'}
        disabled={setScaleDisabled}
        onClick={() => handleMarkupToolClick('area')}
        title="Area tool — trace polygons to measure surface area"
      >
        {activeTool === 'area' && getChainArmedItem() !== null && (
          <ChainBadge color={getChainArmedItem()!.color} name={getChainArmedItem()!.name} />
        )}
      </RibbonButton>
      <RibbonButton
        icon={Hexagon}
        label="Perimeter"
        active={activeTool === 'perimeter'}
        disabled={setScaleDisabled}
        onClick={() => handleMarkupToolClick('perimeter')}
        title="Perimeter tool — trace polygons for perimeter + area"
      >
        {activeTool === 'perimeter' && getChainArmedItem() !== null && (
          <ChainBadge color={getChainArmedItem()!.color} name={getChainArmedItem()!.name} />
        )}
      </RibbonButton>
      <RibbonButton
        icon={BrickWall}
        label="Wall"
        active={activeTool === 'wall'}
        disabled={setScaleDisabled}
        onClick={() => handleMarkupToolClick('wall')}
        title="Wall tool — measure wall area (length × height) in m²"
      >
        {activeTool === 'wall' && getChainArmedItem() !== null && (
          <ChainBadge color={getChainArmedItem()!.color} name={getChainArmedItem()!.name} />
        )}
      </RibbonButton>
      <RibbonButton
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
              position: 'absolute',
              top: 4,
              right: 4,
              fontSize: 11,
              lineHeight: 1,
              opacity: 0.7,
              cursor: 'pointer',
              padding: '0 2px'
            }}
          >
            {'▾'}
          </span>
        )}
      </RibbonButton>
    </>
  )

  const renderViewTab = (): React.JSX.Element => (
    <>
      <RibbonButton
        icon={ZoomIn}
        label="Zoom In"
        onClick={handleZoomIn}
        disabled={totalPages === 0 || currentZoom >= MAX_ZOOM}
        title="Zoom in (Ctrl+=)"
      />
      <RibbonButton
        icon={ZoomOut}
        label="Zoom Out"
        onClick={handleZoomOut}
        disabled={totalPages === 0 || currentZoom <= MIN_ZOOM}
        title="Zoom out (Ctrl+-)"
      />
      <RibbonButton
        icon={Maximize}
        label="Fit"
        onClick={handleFit}
        disabled={totalPages === 0}
        title="Fit to window (Ctrl+0)"
      />
      <RibbonButton
        icon={Table}
        label={totals.open ? 'Hide Totals' : 'Show Totals'}
        active={totals.open}
        onClick={handleToggleTotals}
        title="Toggle Totals panel visibility"
      />
      <RibbonButton
        icon={Eye}
        label="Show All"
        onClick={handleShowAll}
        disabled={totalPages === 0}
        title="Make every markup visible (clears hidden-items)"
      />
      <RibbonButton
        icon={EyeOff}
        label="Hide All"
        onClick={handleHideAll}
        disabled={totalPages === 0 || !hasMarkups}
        title="Hide every markup on every page"
      />
    </>
  )

  const renderEstimatingTab = (): React.JSX.Element => (
    <>
      <span
        style={{
          alignSelf: 'center',
          paddingRight: 12,
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5
        }}
      >
        Quick Export
      </span>
      <RibbonButton
        icon={Download}
        label="Export"
        onClick={() => {
          void onExportClick()
        }}
        disabled={exportDisabled}
        title="Export BOQ to Excel or CSV (Ctrl+Shift+E)"
        ariaLabel="Export"
      />
    </>
  )

  const renderStubTab = (label: string): React.JSX.Element => (
    <span
      style={{
        width: '100%',
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: 13,
        fontStyle: 'italic'
      }}
    >
      {label} — Coming soon
    </span>
  )

  const renderActivePanel = (): React.JSX.Element => {
    switch (activeTab) {
      case 'home':
        return renderHomeTab()
      case 'page':
        return renderPageTab()
      case 'tools':
        return renderToolsTab()
      case 'view':
        return renderViewTab()
      case 'estimating':
        return renderEstimatingTab()
      case 'settings':
        return renderStubTab('Settings')
      case 'help':
        return renderStubTab('Help')
      default:
        return <></>
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        background: COLORS.secondary,
        borderBottom: `1px solid ${COLORS.border}`,
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Tab strip */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          paddingLeft: 8,
          gap: 0,
          borderBottom: `1px solid ${COLORS.border}`
        }}
        role="tablist"
        aria-label="Ribbon tabs"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              style={{
                height: 28,
                minWidth: 80,
                padding: '0 12px',
                background: isActive ? COLORS.dominant : 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? `2px solid ${COLORS.accent}`
                  : '2px solid transparent',
                color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                lineHeight: 1
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = COLORS.textPrimary
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = COLORS.textSecondary
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Ribbon panel — minHeight allows 80px buttons + padding without clipping */}
      <div
        style={{
          minHeight: 88,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 8px',
          gap: 4
        }}
        role="tabpanel"
        aria-label={`${activeTab} panel`}
      >
        {renderActivePanel()}
      </div>

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
