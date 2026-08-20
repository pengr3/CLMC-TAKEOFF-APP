import React, { useMemo } from 'react'
import {
  FileUp,
  Save,
  SaveAll,
  Replace,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Table,
  Eye,
  EyeOff,
  MoreHorizontal
} from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'
import type { ViewMode } from '../types/viewer'
import { useProjectStore } from '../stores/projectStore'
import { useMarkupStore } from '../stores/markupStore'
import { useProject } from '../hooks/useProject'
import { useUiPanels } from '../hooks/useUiPanels'
import { getCanvasControls } from './CanvasViewport'
import { MIN_ZOOM, MAX_ZOOM, COLORS } from '../lib/constants'

/**
 * TopActionBar — the persistent slim top action bar (Phase 18 D-03).
 *
 * Re-homes every Home / Page / View / Estimating-tab action from the legacy
 * 7-tab RibbonToolbar onto ONE always-visible 46px strip:
 *   - Left:   Open · Save · Save As · Replace PDF · Export
 *   - Center: Page ◀ N/M ▶ · Zoom −/%/+ · Fit
 *   - Right:  Plan|Estimate · Totals · Show All · Hide All · ⋯ (inert)
 *
 * Behavior parity (D-08): handler bodies and disabled derivations are lifted
 * VERBATIM from RibbonToolbar.tsx — only the layout/geometry changes (72×80
 * ribbon buttons → compact 34px bar buttons). Props are identical to
 * RibbonToolbarProps so App.tsx re-wires the same handlers in 18-09.
 *
 * IMPORTANT (Pitfall 7 / SC-6): setHiddenItemNames does NOT call markDirty
 * internally (it's designed for hydration). Show All / Hide All handlers MUST
 * call markDirty() explicitly after — otherwise Save silently drops the
 * visibility change.
 *
 * Show All / Hide All are STATE INDICATORS as well as actions
 * (quick-260820-plx): each lights up only when the app is fully in that state
 * — Show All when nothing is hidden, Hide All when every markup key is hidden.
 * In a partial state (some items hidden from the Totals row lightbulbs) BOTH
 * stay dark, which is itself the "partially hidden" signal.
 *
 * IMPORTANT (R-1 / SC-5): the Phase-16 tab-leave reset useEffect
 * (RibbonToolbar.tsx:170-174) is intentionally GONE. With the tabs removed
 * there is no "leaving a tab" event, so the standalone Plan|Estimate toggle is
 * self-consistent — do NOT port any useEffect that resets viewMode.
 */

export interface TopActionBarProps {
  onOpenClick: () => void | Promise<void>
  onReplaceClick: () => void | Promise<void>
  onExportClick: () => void | Promise<void>
}

/**
 * BarButton — compact 34px icon button for the top action bar.
 *
 * Carries RibbonButton's active/hover/disabled token recipe (baseBackground =
 * active ? activeSurface : transparent; hover hoverSurface; disabled opacity
 * 0.4 + pointerEvents none + tabIndex -1) reshaped to a 34px row cell.
 */
interface BarButtonProps {
  icon: React.ComponentType<{ size?: number; color?: string }>
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  ariaLabel?: string
}

function BarButton({
  icon: Icon,
  onClick,
  active = false,
  disabled = false,
  title,
  ariaLabel
}: BarButtonProps): React.JSX.Element {
  const baseBackground = active ? COLORS.activeSurface : 'transparent'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        padding: 0,
        background: baseBackground,
        border: 'none',
        borderRadius: 4,
        color: disabled ? COLORS.textSecondary : COLORS.textPrimary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        flexShrink: 0
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) e.currentTarget.style.background = COLORS.hoverSurface
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseBackground
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.background = COLORS.activeSurface
      }}
      onMouseUp={(e) => {
        if (!disabled)
          e.currentTarget.style.background = active ? COLORS.activeSurface : COLORS.hoverSurface
      }}
    >
      <Icon size={18} color="currentColor" />
    </button>
  )
}

export function TopActionBar({
  onOpenClick,
  onReplaceClick,
  onExportClick
}: TopActionBarProps): React.JSX.Element {
  // --- Store selectors (copied verbatim from RibbonToolbar.tsx:134-154) ---
  const { totalPages, currentPage, nextPage, prevPage } = useViewerStore()
  const getViewport = useViewerStore((s) => s.getViewport)
  // Phase 16 D-01: Plan | Estimate workspace toggle. Store-driven (viewMode IS
  // React state) — read the field + dispatch the setter directly.
  const viewMode = useViewerStore((s) => s.viewMode)
  const setViewMode = useViewerStore((s) => s.setViewMode)

  const { saveProject, saveProjectAs } = useProject()
  const isSaving = useProjectStore((s) => s.isSaving)
  const isExporting = useProjectStore((s) => s.isExporting)
  const hasMarkups = useMarkupStore((s) =>
    Object.values(s.pageMarkups).some((arr) => arr.length > 0)
  )
  // Reactive reads for the Show All / Hide All highlight (quick-260820-plx).
  // Both selectors return store-owned references — never build a fresh
  // array/object inside a selector: Zustand 5 runs on useSyncExternalStore and
  // a new reference per call loops. (hasMarkups above is safe: it's a boolean.)
  const hiddenItemNames = useProjectStore((s) => s.hiddenItemNames)
  const pageMarkups = useMarkupStore((s) => s.pageMarkups)

  // UI panel state (Totals toggle)
  const { totals, setTotalsOpen } = useUiPanels()

  // --- Disabled derivations (copied verbatim from RibbonToolbar.tsx:179-183) ---
  const saveDisabled = totalPages === 0 || isSaving
  const replaceDisabled = totalPages === 0 || isSaving
  const exportDisabled = totalPages === 0 || isSaving || isExporting || !hasMarkups

  // --- Show All / Hide All active-state derivation (quick-260820-plx) ---
  // Key shape `${name}|${categoryId}` is the VISIBILITY key (Pitfall 1) and
  // MIRRORS handleHideAll's key build below — the two must stay in step.
  const allItemKeys = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(pageMarkups)
            .flat()
            .map((m) => `${m.name}|${m.categoryId}`)
        )
      ),
    [pageMarkups]
  )
  const hiddenSet = useMemo(() => new Set(hiddenItemNames), [hiddenItemNames])
  const showAllActive = hiddenItemNames.length === 0
  // The length guard is load-bearing: [].every() is vacuously true, which would
  // light Hide All on an empty project.
  const hideAllActive = allItemKeys.length > 0 && allItemKeys.every((k) => hiddenSet.has(k))

  const currentZoom = totalPages > 0 ? getViewport(currentPage).zoom : 1

  // --- Handlers (copied verbatim from RibbonToolbar.tsx:187-197, 260-262) ---
  const handleZoomIn = (): void => {
    getCanvasControls()?.zoomIn()
  }

  const handleZoomOut = (): void => {
    getCanvasControls()?.zoomOut()
  }

  const handleFit = (): void => {
    getCanvasControls()?.fitToWindow()
  }

  const handleToggleTotals = (): void => {
    setTotalsOpen(!totals.open)
  }

  // Show All / Hide All — both MUST call markDirty explicitly (Pitfall 7).
  // setHiddenItemNames does NOT markDirty internally (built for hydration).
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

  // Plan | Estimate segmented control (Phase 16 D-01). Two adjacent role="radio"
  // buttons dispatching setViewMode. Copied verbatim from RibbonToolbar.tsx:555-587.
  // CRITICAL (R-1): NO tab-leave reset useEffect — the standalone toggle is
  // self-consistent; RibbonToolbar.tsx:170-174 is intentionally NOT ported.
  const renderViewModeSegment = (mode: ViewMode, label: string): React.JSX.Element => {
    const isActive = viewMode === mode
    return (
      <button
        role="radio"
        aria-checked={isActive}
        aria-label={`${label} view`}
        data-testid={`view-mode-${mode}`}
        onClick={() => setViewMode(mode)}
        style={{
          height: 28,
          minWidth: 72,
          padding: '0 16px',
          background: isActive ? COLORS.dominant : 'transparent',
          border: `1px solid ${COLORS.border}`,
          borderBottom: isActive ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
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
        {label}
      </button>
    )
  }

  // Accent Open button — reshapes RibbonToolbar.tsx:270-312 (72×80 column) into
  // a compact 34px row. Keeps the accent-primary chrome + Ctrl+O aria-label.
  const renderOpenButton = (): React.JSX.Element => (
    <button
      onClick={() => {
        void onOpenClick()
      }}
      title="Open project or PDF (Ctrl+O)"
      aria-label="Open project or PDF (Ctrl+O)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 34,
        padding: '0 12px',
        background: COLORS.accent,
        border: 'none',
        borderRadius: 4,
        color: COLORS.textOnAccent,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        cursor: 'pointer',
        flexShrink: 0
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
      <FileUp size={18} color={COLORS.textOnAccent} />
      <span>Open</span>
    </button>
  )

  const separator = (
    <div
      style={{
        width: 1,
        height: 20,
        background: COLORS.border,
        margin: '0 4px',
        flexShrink: 0
      }}
    />
  )

  return (
    <div
      data-testid="top-action-bar"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        height: 46,
        padding: '0 8px',
        gap: 4,
        background: COLORS.secondary,
        borderBottom: `1px solid ${COLORS.border}`,
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Left group — file ops */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {renderOpenButton()}
        <BarButton
          icon={Save}
          onClick={() => {
            void saveProject()
          }}
          disabled={saveDisabled}
          title="Save (Ctrl+S)"
        />
        <BarButton
          icon={SaveAll}
          onClick={() => {
            void saveProjectAs()
          }}
          disabled={saveDisabled}
          title="Save As (Ctrl+Shift+S)"
        />
        <BarButton
          icon={Replace}
          onClick={() => {
            void onReplaceClick()
          }}
          disabled={replaceDisabled}
          title="Replace Plan PDF — markups preserved, save (Ctrl+S) to persist"
          ariaLabel="Replace Plan PDF"
        />
        <BarButton
          icon={Download}
          onClick={() => {
            void onExportClick()
          }}
          disabled={exportDisabled}
          title="Export BOQ to Excel or CSV (Ctrl+Shift+E)"
          ariaLabel="Export"
        />
      </div>

      {/* Flex spacer */}
      <div style={{ flex: 1 }} />

      {/* Center group — page + zoom */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <BarButton
          icon={ChevronLeft}
          onClick={prevPage}
          disabled={currentPage === 1}
          title="Previous page (Left Arrow)"
          ariaLabel="Previous page"
        />
        <span
          aria-live="polite"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 90,
            padding: '0 8px',
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.textSecondary,
            whiteSpace: 'nowrap'
          }}
        >
          Page {currentPage} of {totalPages}
        </span>
        <BarButton
          icon={ChevronRight}
          onClick={nextPage}
          disabled={currentPage === totalPages}
          title="Next page (Right Arrow)"
          ariaLabel="Next page"
        />

        {separator}

        <BarButton
          icon={ZoomOut}
          onClick={handleZoomOut}
          disabled={totalPages === 0 || currentZoom <= MIN_ZOOM}
          title="Zoom out (Ctrl+-)"
          ariaLabel="Zoom out"
        />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 48,
            padding: '0 4px',
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.textSecondary,
            whiteSpace: 'nowrap'
          }}
        >
          {Math.round(currentZoom * 100)}%
        </span>
        <BarButton
          icon={ZoomIn}
          onClick={handleZoomIn}
          disabled={totalPages === 0 || currentZoom >= MAX_ZOOM}
          title="Zoom in (Ctrl+=)"
          ariaLabel="Zoom in"
        />
        <BarButton
          icon={Maximize}
          onClick={handleFit}
          disabled={totalPages === 0}
          title="Fit to window (Ctrl+0)"
          ariaLabel="Fit"
        />
      </div>

      {/* Flex spacer */}
      <div style={{ flex: 1 }} />

      {/* Right group — Plan|Estimate · Totals · Show All · Hide All · ⋯ */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <div
          role="radiogroup"
          aria-label="Workspace view"
          data-testid="view-mode-toggle"
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          {renderViewModeSegment('plan', 'Plan')}
          {renderViewModeSegment('estimate', 'Estimate')}
        </div>
        <BarButton
          icon={Table}
          onClick={handleToggleTotals}
          active={totals.open}
          title="Toggle Totals panel visibility"
        />
        <BarButton
          icon={Eye}
          onClick={handleShowAll}
          active={showAllActive}
          disabled={totalPages === 0}
          title="Make every markup visible (clears hidden-items)"
          ariaLabel="Show All markups"
        />
        <BarButton
          icon={EyeOff}
          onClick={handleHideAll}
          active={hideAllActive}
          disabled={totalPages === 0 || !hasMarkups}
          title="Hide every markup on every page"
          ariaLabel="Hide All markups"
        />
        {/* Inert overflow home (D-07/Q3) — reserved, no menu wired yet. */}
        <button
          data-testid="overflow-menu-button"
          aria-label="More (coming soon)"
          title="More (coming soon)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            padding: 0,
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            color: COLORS.textSecondary,
            cursor: 'default',
            flexShrink: 0
          }}
        >
          <MoreHorizontal size={18} color="currentColor" />
        </button>
      </div>
    </div>
  )
}
