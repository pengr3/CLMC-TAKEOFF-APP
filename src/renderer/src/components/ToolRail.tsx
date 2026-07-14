import React, { useState } from 'react'
import { MousePointer, MapPin, Minus, Square, Hexagon, BrickWall, Ruler, Magnet, Spline } from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { getCalibrationControls, getChainArmedItem, setChainArmedFromTotals } from './CanvasViewport'
import { getArcSticky, subscribeArcSticky, getArcStickyToggleHandler } from '../lib/markup-arc-ref'
import { ScaleContextMenu } from './ScaleContextMenu'
import { COLORS } from '../lib/constants'

/**
 * ToolRail — the persistent vertical left tool rail (Phase 18, D-02 / SC-1..3).
 *
 * Replaces RibbonToolbar's `renderToolsTab` (the "Tools" tab). Top-to-bottom:
 *   Select · Count · Linear · Area · Perimeter · Wall
 *   ── divider ──
 *   Set Scale (keeps its right-click / ▾ recalibrate+verify menu)
 *   ── divider ──
 *   Snap · Arc   (clickable toggles — Task 2 / 18-07)
 *
 * The tool-arm/disarm handler, chain badges, and Set Scale activate/cancel +
 * its ScaleContextMenu are lifted VERBATIM from RibbonToolbar.tsx so behavior
 * is byte-identical (D-08 behavior parity). The 7-tab ribbon is gone, so no tab
 * role is emitted anywhere in this component (SC-1).
 *
 * Pitfall 6 (09-RESEARCH): the chain-armed badge is gated on
 *   activeTool === tool && getChainArmedItem() !== null
 * and read during render — re-renders are driven by activeTool state changes.
 *
 * COLORS tokens + inline styles only — no Tailwind (chrome-path convention).
 * Mounted by App.tsx in 18-09; standalone until then.
 */

type MarkupTool = 'count' | 'linear' | 'area' | 'perimeter' | 'wall'

const MARKUP_TOOLS: Array<{
  tool: MarkupTool
  icon: React.ComponentType<{ size?: number; color?: string }>
  label: string
  title: string
}> = [
  { tool: 'count', icon: MapPin, label: 'Count', title: 'Count tool — place pins to tally items' },
  {
    tool: 'linear',
    icon: Minus,
    label: 'Linear',
    title: 'Linear tool — draw polylines to measure lengths'
  },
  {
    tool: 'area',
    icon: Square,
    label: 'Area',
    title: 'Area tool — trace polygons to measure surface area'
  },
  {
    tool: 'perimeter',
    icon: Hexagon,
    label: 'Perimeter',
    title: 'Perimeter tool — trace a closed outline; measures perimeter length'
  },
  {
    tool: 'wall',
    icon: BrickWall,
    label: 'Wall',
    title: 'Wall tool — measure wall area (length × height) in m²'
  }
]

// Chain-armed badge chip — lifted verbatim from RibbonToolbar.tsx:87-127 so the
// armed-item chrome is identical to the ribbon it replaces.
function ChainBadge({ color, name }: { color: string; name: string }): React.JSX.Element {
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 2,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 9,
        fontWeight: 600,
        background: COLORS.activeSurface,
        borderRadius: 3,
        padding: '1px 3px',
        maxWidth: 52,
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

// Rail separator (mockup .rsep — 32px wide 1px hairline between tool groups).
function RailDivider(): React.JSX.Element {
  return (
    <div
      style={{
        width: 32,
        height: 1,
        background: COLORS.border,
        margin: '3px 0',
        flexShrink: 0
      }}
    />
  )
}

interface RailButtonProps {
  icon: React.ComponentType<{ size?: number; color?: string }>
  label: string
  onClick: () => void
  testId: string
  /** aria-pressed value (tool active / toggle on). */
  pressed?: boolean
  /** Tool-selected chrome — accent fill + white text (mockup .tbtn.active). */
  active?: boolean
  /** Toggle-on chrome — accent text + accent border + dot (mockup .tbtn.on). */
  on?: boolean
  /** Snap held-off (Alt) — dimmed text. */
  dimmed?: boolean
  disabled?: boolean
  title?: string
  ariaLabel?: string
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children?: React.ReactNode
}

// 48×46 column button — the rail variant of RibbonButton's active/hover/disabled
// recipe shrunk to icon(20) + 9px label (mockup .tbtn.railb).
function RailButton({
  icon: Icon,
  label,
  onClick,
  testId,
  pressed,
  active = false,
  on = false,
  dimmed = false,
  disabled = false,
  title,
  ariaLabel,
  onContextMenu,
  children
}: RailButtonProps): React.JSX.Element {
  const background = active ? COLORS.accent : 'transparent'
  let color: string = COLORS.textPrimary
  if (active) color = COLORS.textOnAccent
  else if (on) color = COLORS.accent
  else if (dimmed) color = COLORS.textSecondary
  const border = on && !active ? `1px solid ${COLORS.accent}` : '1px solid transparent'

  return (
    <button
      data-testid={testId}
      onClick={disabled ? undefined : onClick}
      onContextMenu={onContextMenu}
      title={title}
      aria-label={ariaLabel ?? title ?? label}
      aria-pressed={pressed}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: 48,
        height: 46,
        padding: '4px 2px',
        background,
        border,
        borderRadius: 4,
        color,
        fontSize: 9,
        fontWeight: 600,
        lineHeight: 1.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        textAlign: 'center',
        flexShrink: 0
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active && !on) e.currentTarget.style.background = COLORS.hoverSurface
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = background
      }}
    >
      <Icon size={20} color="currentColor" />
      <span
        style={{
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
      {on && !active && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: COLORS.accent
          }}
        />
      )}
      {children}
    </button>
  )
}

export function ToolRail(): React.JSX.Element {
  // --- Store selectors (mirrors RibbonToolbar's Tools-tab region) ---
  const totalPages = useViewerStore((s) => s.totalPages)
  const currentPage = useViewerStore((s) => s.currentPage)
  const activeTool = useViewerStore((s) => s.activeTool)
  const setActiveTool = useViewerStore((s) => s.setActiveTool)
  const getScale = useScaleStore((s) => s.getScale)
  const calibMode = useScaleStore((s) => s.calibMode)

  // Snap state (D-05) — runtime-only viewerStore flags F3/Alt also mutate. Reading
  // them via selectors keeps the rail toggle in sync with the shortcuts for free.
  const snapEnabled = useViewerStore((s) => s.snapEnabled)
  const snapSuspended = useViewerStore((s) => s.snapSuspended)
  const setSnapEnabled = useViewerStore((s) => s.setSnapEnabled)

  // Arc on-state (18-04 reactive seam). Shift+A flips sticky arc with NO coincident
  // store change, so the rail MUST subscribe to the seam — a bare getArcSticky()
  // read would leave the chrome stale. useSyncExternalStore(subscribeArcSticky,
  // getArcSticky) re-renders on every arc change including the keyboard shortcut.
  const arcOn = React.useSyncExternalStore(subscribeArcSticky, getArcSticky)

  // Local UI state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Derived flags — copied verbatim from RibbonToolbar.tsx:176-178.
  const pageScale = totalPages > 0 ? getScale(currentPage) : null
  const setScaleDisabled = totalPages === 0
  const isCalibrating = calibMode !== 'idle'

  // --- Handlers (lifted VERBATIM from RibbonToolbar.tsx:199-239) ---

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

  const handleMarkupToolClick = (tool: MarkupTool): void => {
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

  return (
    <div
      data-testid="tool-rail"
      style={{
        width: 56,
        background: COLORS.secondary,
        borderRight: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 0',
        gap: 3,
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      {/* Select — always enabled, never disarms a chain (mirrors ribbon). */}
      <RailButton
        icon={MousePointer}
        label="Select"
        testId="rail-tool-select"
        active={activeTool === 'select'}
        pressed={activeTool === 'select'}
        onClick={handleSelectTool}
        title="Select tool — click a markup to select; drag to rubber-band multi-select"
      />

      {/* Markup tools — disabled with no PDF; each renders its chain badge when armed. */}
      {MARKUP_TOOLS.map(({ tool, icon, label, title }) => (
        <RailButton
          key={tool}
          icon={icon}
          label={label}
          testId={`rail-tool-${tool}`}
          active={activeTool === tool}
          pressed={activeTool === tool}
          disabled={setScaleDisabled}
          onClick={() => handleMarkupToolClick(tool)}
          title={title}
        >
          {activeTool === tool && getChainArmedItem() !== null && (
            <ChainBadge color={getChainArmedItem()!.color} name={getChainArmedItem()!.name} />
          )}
        </RailButton>
      ))}

      <RailDivider />

      {/* Set Scale — a rail tool (D-02, choice a). Keeps activate/cancel via
          getCalibrationControls() and the ▾ / right-click recalibrate+verify menu. */}
      <RailButton
        icon={Ruler}
        label="Set Scale"
        testId="rail-tool-scale"
        active={isCalibrating}
        pressed={isCalibrating}
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
              top: 2,
              right: 3,
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
      </RailButton>

      <RailDivider />

      {/* Snap toggle (D-05, SC-3) — reads the SAME viewerStore.snapEnabled field
          F3 mutates, so the rail toggle and the F3 shortcut stay in sync for free.
          On-state chrome when snapping is active; dimmed while Alt-held (suspended). */}
      <RailButton
        icon={Magnet}
        label="Snap"
        testId="rail-snap-toggle"
        pressed={snapEnabled}
        on={snapEnabled && !snapSuspended}
        dimmed={snapEnabled && snapSuspended}
        onClick={() => setSnapEnabled(!snapEnabled)}
        title="Snap to vertices/edges (F3 · hold Alt to suspend)"
      />

      {/* Arc toggle (D-05, SC-3) — click mirrors Shift+A via the registered
          getArcStickyToggleHandler; the on-state is driven reactively by the
          18-04 seam so Shift+A updates the chrome with no other interaction. */}
      <RailButton
        icon={Spline}
        label="Arc"
        testId="rail-arc-toggle"
        pressed={arcOn}
        on={arcOn}
        onClick={() => getArcStickyToggleHandler()?.()}
        title="Sticky arc segments (Shift+A · hold A for one-off)"
      />

      {/* Scale context menu (rendered at document level via fixed positioning). */}
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
