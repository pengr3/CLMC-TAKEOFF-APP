import { useEffect, useRef, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { TitleBar } from './components/TitleBar'
import { AboutDialog } from './components/AboutDialog'
import { RecoveryDialog } from './components/RecoveryDialog'
import { LegacyRateReviewDialog, LEGACY_RATE_WARNING } from './components/LegacyRateReviewDialog'
import type { RecoveryCandidate } from '../../shared/reliability'
import { TopActionBar } from './components/TopActionBar'
import { ContextBar } from './components/ContextBar'
import { ToolRail } from './components/ToolRail'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { CanvasViewport } from './components/CanvasViewport'
import { TotalsPanel } from './components/TotalsPanel'
import { EstimatePanel } from './components/EstimatePanel'
import { Splitter } from './components/Splitter'
import { ArchiveCorruptedModal } from './components/ArchiveCorruptedModal'
import { DimensionMismatchModal } from './components/DimensionMismatchModal'
import { PageCountAbortModal } from './components/PageCountAbortModal'
import { SaveCloseModal } from './components/SaveCloseModal'
import { SaveFailureDialog } from './components/SaveFailureDialog'
import { OpenErrorModal } from './components/OpenErrorModal'
import { UncalibratedExportWarningModal } from './components/UncalibratedExportWarningModal'
import { useViewerStore } from './stores/viewerStore'
import { useMarkupStore } from './stores/markupStore'
import { attachDirtyTracking, useProjectStore } from './stores/projectStore'
import { useProject, startRecoverySchedule, type ProjectOpenResult } from './hooks/useProject'
import { useExport } from './hooks/useExport'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCloseGuard } from './hooks/useCloseGuard'
import { useUiPanels } from './hooks/useUiPanels'
import { useMarkupHighlight } from './hooks/useMarkupHighlight'
import { getCanvasControls, setChainArmedFromTotals } from './components/CanvasViewport'
import { labelToName, rowTypeToMarkupType } from './components/TotalsRow'
import { MARKUP_PALETTE } from './lib/markup-palette'
import { COLORS, TOTALS_RAIL_WIDTH } from './lib/constants'
import type { ProjectFile } from './lib/project-schema'
import type { BoqStructure, BoqItemRow } from './lib/boq-types'
import type { WallMarkup } from './types/markup'

function App(): React.JSX.Element {
  const totalPages = useViewerStore((s) => s.totalPages)
  const fileName = useViewerStore((s) => s.fileName)
  // Phase 16 D-01: Plan/Estimate center-area toggle. Drives a mount-preserving CSS
  // `display` swap below (the Konva CanvasViewport is NEVER conditionally unmounted).
  const viewMode = useViewerStore((s) => s.viewMode)
  // Phase 13 (Pitfall 5): subscribe to currentPage so the page-change useEffect below can
  // clear reopenToast when the user navigates while the toast is showing.
  const currentPage = useViewerStore((s) => s.currentPage)
  const currentFilePath = useProjectStore((s) => s.currentFilePath)
  const isSaving = useProjectStore((s) => s.isSaving)
  const saveFailure = useProjectStore((s) => s.saveFailure)
  const rates = useProjectStore(s => s.rates)
  const unresolvedRates = Object.values(rates).some(rate => rate.review !== 'reviewed')
  const [rateReviewOpen, setRateReviewOpen] = useState(false)
  useEffect(() => {
    const openReview = (): void => setRateReviewOpen(true)
    window.addEventListener('clmc:review-rates', openReview)
    return () => window.removeEventListener('clmc:review-rates', openReview)
  }, [])
  const {
    openByExtension,
    saveProject,
    saveProjectAs,
    retrySaveProject,
    replacePlanPdf,
    applyReplacePlanPdf,
    applyArchiveCorruptedProceed,
    writeRecoverySnapshot,
    restoreRecovery,
    discardRecovery
  } = useProject()
  const { exportBoq, applyExportAfterConfirm } = useExport()

  // Phase 6: Panel layout state (localStorage-backed widths + open/closed).
  const { totals, setTotalsOpen, setTotalsWidth } = useUiPanels()

  // Phase 6: Transient highlight state (hover ring + click pulse).
  const { hoverMatches, setHoverMatches, pulse, triggerPulse, clearPulse } = useMarkupHighlight()

  // Resize width imperatively so ordinary pointermoves do not re-render App.
  // Only crossing the rail boundary swaps the rail/content via a transient
  // preview. Persist visibility and width together ONCE on pointerup.
  const totalsPanelRef = useRef<HTMLDivElement>(null)
  const [totalsDragOpen, setTotalsDragOpen] = useState<boolean | null>(null)
  const totalsDragOpenRef = useRef<boolean | null>(null)
  // Stashes the panel's pre-drag `transition` so we can restore it on commit.
  // (React won't re-apply an unchanged inline-style prop, so a value we mutate
  // imperatively must be restored imperatively — not left to reconciliation.)
  const dragBaseTransitionRef = useRef<string | null>(null)

  const handleTotalsDragWidth = useCallback(
    (w: number): void => {
      const open = w > TOTALS_RAIL_WIDTH
      if ((totalsDragOpenRef.current ?? totals.open) !== open) {
        totalsDragOpenRef.current = open
        // Mount the correct panel contents before writing its live DOM width.
        // This runs only on an open/closed boundary crossing, not every move.
        flushSync(() => setTotalsDragOpen(open))
      }
      const el = totalsPanelRef.current
      if (!el) return
      if (dragBaseTransitionRef.current === null) {
        // First move of this drag: freeze the 150ms width transition so the panel
        // tracks the pointer 1:1 instead of easing behind it.
        dragBaseTransitionRef.current = el.style.transition
        el.style.transition = 'none'
      }
      el.style.width = `${w}px`
    },
    [totals.open]
  )

  const handleTotalsCommitWidth = useCallback(
    (finalWidth: number): void => {
      const el = totalsPanelRef.current
      if (el && dragBaseTransitionRef.current !== null) {
        // Restore the collapse/expand transition we froze at drag start.
        el.style.transition = dragBaseTransitionRef.current
        dragBaseTransitionRef.current = null
      }
      // setTotalsWidth also commits open/closed state and preserves the last
      // expanded width when released at the rail minimum.
      setTotalsWidth(finalWidth)
      totalsDragOpenRef.current = null
      setTotalsDragOpen(null)
    },
    [setTotalsWidth]
  )

  // Phase 6: Container width for Splitter max-width (50% cap) calculation.
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(window.innerWidth)
  useEffect(() => {
    const update = (): void => {
      setContainerWidth(containerRef.current?.offsetWidth ?? window.innerWidth)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Phase 6 D-14: Copy toast ("Copied {label}" or "Copy failed.") — 2000ms parent-owned dismiss.
  const [copyToast, setCopyToast] = useState<string | null>(null)
  useEffect(() => {
    if (!copyToast) return
    const t = window.setTimeout(() => setCopyToast(null), 2000)
    return () => window.clearTimeout(t)
  }, [copyToast])

  // Open-flow state (slimmed for v2)
  const [archiveCorrupted, setArchiveCorrupted] = useState<{
    validated: ProjectFile
    pdfBytes: Uint8Array
    clmcPath: string
  } | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [closeModal, setCloseModal] = useState<
    'close-window' | 'open-other' | 'recover-other' | null
  >(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [recoveryCandidates, setRecoveryCandidates] = useState<RecoveryCandidate[]>([])
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoveryScanning, setRecoveryScanning] = useState(false)
  const [pendingRecovery, setPendingRecovery] = useState<string | null>(null)
  const [discardBusy, setDiscardBusy] = useState(false)
  const recoveryAction = useRef(false)
  const scanActive = useRef(false)
  const mounted = useRef(true)
  const refreshRecovery = useCallback(async (present = false): Promise<void> => {
    if (scanActive.current || !window.api?.listRecovery) return
    scanActive.current = true
    setRecoveryScanning(true)
    try {
      const result = await window.api.listRecovery()
      if (!mounted.current) return
      if (result.ok) {
        setRecoveryCandidates(result.candidates)
        setRecoveryError(null)
        if (
          useProjectStore.getState().recoveryWarning ===
          'Recovery copies could not be checked. Try again later.'
        )
          useProjectStore.setState({ recoveryWarning: null })
        if (present) setRecoveryOpen(result.candidates.length > 0)
        if (result.candidates.length === 0) setRecoveryOpen(false)
      } else {
        setRecoveryError(result.message)
        useProjectStore.setState({ recoveryWarning: result.message })
      }
    } catch {
      if (mounted.current) {
        setRecoveryError('Recovery copies could not be checked. Try again later.')
        useProjectStore.setState({
          recoveryWarning: 'Recovery copies could not be checked. Try again later.'
        })
      }
    } finally {
      scanActive.current = false
      if (mounted.current) setRecoveryScanning(false)
    }
  }, [])
  useEffect(() => {
    mounted.current = true
    void refreshRecovery(true)
    const stop = startRecoverySchedule(writeRecoverySnapshot)
    const changed = (): void => {
      void refreshRecovery()
    }
    window.addEventListener('clmc:recovery-updated', changed)
    return () => {
      mounted.current = false
      stop()
      window.removeEventListener('clmc:recovery-updated', changed)
    }
  }, [writeRecoverySnapshot, refreshRecovery])
  const [pendingOpen, setPendingOpen] = useState<{ filePath: string; extension: string } | null>(
    null
  )
  useEffect(
    () =>
      useProjectStore.subscribe((state, previous) => {
        if (state.lastSaveOutcome && state.lastSaveOutcome !== previous.lastSaveOutcome) {
          setSaveToast(state.lastSaveOutcome.message)
        }
      }),
    []
  )

  // Replace-flow state (NEW)
  const [replacePageAbort, setReplacePageAbort] = useState<{
    expected: number
    actual: number
  } | null>(null)
  const [replaceDimMiss, setReplaceDimMiss] = useState<{
    pendingBytes: Uint8Array
    pendingFilename: string
  } | null>(null)

  // Phase 5: BOQ Export state
  const [exportToast, setExportToast] = useState<string | null>(null)
  const [uncalibratedWarning, setUncalibratedWarning] = useState<{
    pages: number[]
    structure: BoqStructure
  } | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // Phase 13 (D-11): toast slot fires on post-commit re-open via CanvasViewport.onReopenToast.
  const [reopenToast, setReopenToast] = useState<string | null>(null)

  const displayFilename = currentFilePath
    ? (currentFilePath.split(/[\\/]/).pop() ?? 'project')
    : (fileName ?? 'project')

  useEffect(() => attachDirtyTracking(), [])

  useEffect(() => {
    const preventNav = (e: DragEvent): void => {
      e.preventDefault()
    }
    window.addEventListener('dragover', preventNav)
    window.addEventListener('drop', preventNav)
    return () => {
      window.removeEventListener('dragover', preventNav)
      window.removeEventListener('drop', preventNav)
    }
  }, [])

  useEffect(() => {
    const preventNativeZoom = (e: WheelEvent): void => {
      if (e.ctrlKey) e.preventDefault()
    }
    window.addEventListener('wheel', preventNativeZoom, { passive: false })
    return () => window.removeEventListener('wheel', preventNativeZoom)
  }, [])

  useEffect(() => {
    if (!saveToast) return
    const t = window.setTimeout(() => setSaveToast(null), 2000)
    return () => window.clearTimeout(t)
  }, [saveToast])

  useEffect(() => {
    if (!exportToast) return
    const t = window.setTimeout(() => setExportToast(null), 2000)
    return () => window.clearTimeout(t)
  }, [exportToast])

  // Phase 13 (D-19): 2500ms auto-dismiss — slightly longer than save/export because users
  // need time to read the action prompt ("press Enter to commit"). Mirror the parent-owns-
  // lifecycle pattern used by saveToast / exportToast above.
  useEffect(() => {
    if (!reopenToast) return
    const t = window.setTimeout(() => setReopenToast(null), 2500)
    return () => window.clearTimeout(t)
  }, [reopenToast])

  // Phase 13 (Pitfall 5): clear re-open toast on page navigation. CanvasViewport's
  // page-nav useEffect also restores the snapshot — the toast must not linger.
  useEffect(() => {
    setReopenToast(null)
  }, [currentPage])

  // Phase 6/18 perf: stable callback for CanvasViewport.onReopenToast. CanvasViewport is
  // React.memo'd; an inline lambda here would be a NEW reference on every App render,
  // defeating the memo and re-rendering the Konva Stage. The splitter drag itself no
  // longer re-renders App (width is now driven imperatively via totalsPanelRef — see
  // handleTotalsDragWidth), but keeping this callback stable is defense-in-depth for any
  // OTHER App re-render. setReopenToast is a stable useState setter, so [] deps are correct.
  const handleReopenToast = useCallback(
    () => setReopenToast('Shape re-opened — continue drawing or press Enter to commit'),
    []
  )

  useCloseGuard(() => {
    setAboutOpen(false)
    if (!useProjectStore.getState().isDirty) {
      window.api.confirmClose()
      return
    }
    setCloseModal('close-window')
  })

  const handleOpenResult = useCallback((result: ProjectOpenResult | null): void => {
    if (!result || result.kind === 'canceled') return
    if (result.kind === 'ok') {
      setArchiveCorrupted(null)
      setOpenError(null)
      return
    }
    if (result.kind === 'archive-corrupted') {
      setArchiveCorrupted({
        validated: result.validated,
        pdfBytes: result.pdfBytes,
        clmcPath: result.clmcPath
      })
      return
    }
    if (result.kind === 'error') {
      console.error('[App] open error:', result.message)
      setOpenError(result.message)
      return
    }
  }, [])

  const handleOpenClick = useCallback(async () => {
    if (document.querySelector('[role="dialog"]')) return
    if (useProjectStore.getState().isSaving || useProjectStore.getState().saveFailure || closeModal)
      return
    const picked = await window.api.openProject()
    if (!picked) return
    if (useProjectStore.getState().isSaving || useProjectStore.getState().saveFailure) return
    if (useProjectStore.getState().isDirty) {
      setPendingOpen({ filePath: picked.filePath, extension: picked.extension })
      setCloseModal('open-other')
      return
    }
    const r = await openByExtension(picked.filePath, picked.extension)
    handleOpenResult(r)
  }, [openByExtension, handleOpenResult, closeModal])

  const handleSaveClick = useCallback(async () => {
    if (document.querySelector('[role="dialog"]')) return
    await saveProject()
  }, [saveProject])

  const handleSaveAsClick = useCallback(async () => {
    if (document.querySelector('[role="dialog"]')) return
    await saveProjectAs()
  }, [saveProjectAs])

  const performRecovery = async (id: string): Promise<void> => {
    if (recoveryAction.current || recoveryScanning) return
    recoveryAction.current = true
    setRecoveryBusy(true)
    setRecoveryError(null)
    try {
      const result = await restoreRecovery(id)
      if (result.kind === 'ok') {
        setRecoveryOpen(false)
        setSaveToast('Recovered unsaved work. Save the project to keep these changes.')
      } else if (result.kind === 'error') setRecoveryError(result.message)
    } finally {
      recoveryAction.current = false
      setRecoveryBusy(false)
    }
  }
  const requestRecovery = async (id: string): Promise<void> => {
    const state = useProjectStore.getState()
    if (state.isSaving || recoveryAction.current || recoveryScanning) return
    if (state.isDirty) {
      if (state.documentSessionId === id) {
        setRecoveryOpen(false)
        setSaveToast('This recovery copy is already open. Save the project to keep these changes.')
        return
      }
      setPendingRecovery(id)
      setCloseModal('recover-other')
      return
    }
    await performRecovery(id)
  }

  // NEW (D-08): Replace Plan PDF — opens picker, runs validation, routes result.
  const handleReplaceClick = useCallback(async () => {
    if (document.querySelector('[role="dialog"]')) return
    if (useProjectStore.getState().isSaving || useProjectStore.getState().saveFailure || closeModal)
      return
    const pick = await window.api.openPdf()
    if (!pick) return
    const newBytes = new Uint8Array(pick.data)
    const r = await replacePlanPdf(newBytes, pick.filePath)
    if (r.kind === 'page-count-mismatch') {
      setReplacePageAbort({ expected: r.expected, actual: r.actual })
      return
    }
    if (r.kind === 'dimension-mismatch') {
      setReplaceDimMiss({ pendingBytes: r.pendingBytes, pendingFilename: r.pendingFilename })
      return
    }
    if (r.kind === 'error') {
      setOpenError(`Replace Plan PDF failed: ${r.message}`)
      return
    }
    // r.kind === 'ok' — replacePlanPdf already updated viewerStore + marked dirty.
  }, [replacePlanPdf, closeModal])

  const finishGuardedSave = async (result: 'ok' | 'canceled' | 'error'): Promise<void> => {
    if (
      result !== 'ok' ||
      useProjectStore.getState().isDirty ||
      useProjectStore.getState().isSaving
    )
      return
    if (closeModal === 'close-window') window.api.confirmClose()
    else if (closeModal === 'open-other' && pendingOpen) {
      handleOpenResult(await openByExtension(pendingOpen.filePath, pendingOpen.extension))
    } else if (closeModal === 'recover-other' && pendingRecovery) {
      await performRecovery(pendingRecovery)
    }
    setCloseModal(null)
    setPendingOpen(null)
    setPendingRecovery(null)
  }

  // Phase 5: Export click handler — routes ExportResult kinds to UI state
  const handleExportClick = useCallback(async () => {
    // BL-04: reject Ctrl+Shift+E repeats while an export is already in flight.
    // Toolbar disables the button visually, but the keyboard path bypasses
    // that prop. The hook's race guard catches it too, but rejecting here
    // avoids the function call entirely.
    const { isExporting, isSaving } = useProjectStore.getState()
    if (isExporting || isSaving) return
    const fileBasename = (p: string): string => {
      const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
      return i >= 0 ? p.slice(i + 1) : p
    }
    const r = await exportBoq()
    if (r.kind === 'needs-uncalibrated-confirmation') {
      setUncalibratedWarning({ pages: r.uncalibratedPages, structure: r.structure })
      return
    }
    if (r.kind === 'error') {
      // GAP-2: the reason from main is already user-facing (e.g. the friendly
      // locked-file message). It's shown as the detail line under the export
      // title/body — no "Export failed:" prefix (the modal title says that).
      setExportError(r.message)
      return
    }
    if (r.kind === 'ok') {
      setExportToast(`Exported: ${fileBasename(r.filePath)}`)
    }
    // r.kind === 'canceled' → no-op
  }, [exportBoq])

  // Phase 7.1: Arm markup tool from TotalsPanel row click.
  // CRITICAL ordering: setChainArmedFromTotals MUST be called BEFORE setActiveTool
  // so that _activatePresetRef fires before the tool-mode state update triggers
  // CanvasViewport re-render (per 07.1-RESEARCH Focus Area 8 and PATTERNS.md).
  const handleArmTool = useCallback((item: BoqItemRow, categoryName: string): void => {
    const toolType = rowTypeToMarkupType(item.type)
    const itemName = labelToName(item.label)

    // Wall height: scan markup store for the most-recent WallMarkup with matching name.
    let wallHeight: number | undefined
    if (toolType === 'wall') {
      const { pageMarkups } = useMarkupStore.getState()
      let latestWall: WallMarkup | null = null
      for (const markups of Object.values(pageMarkups)) {
        if (!markups) continue
        for (const m of markups) {
          if (m.type === 'wall' && m.name === itemName) {
            if (latestWall === null || m.createdAt > latestWall.createdAt) {
              latestWall = m as WallMarkup
            }
          }
        }
      }
      wallHeight = latestWall?.wallHeight ?? 2400
    }

    // MUST call setChainArmedFromTotals BEFORE setActiveTool (ordering critical).
    setChainArmedFromTotals({
      name: itemName,
      categoryName,
      color: item.color ?? MARKUP_PALETTE[0],
      toolType,
      wallHeight
    })
    useViewerStore.getState().setActiveTool(toolType)
  }, [])

  useKeyboardShortcuts({
    openPdf: handleOpenClick,
    openProject: handleOpenClick,
    saveProject: handleSaveClick,
    saveProjectAs: handleSaveAsClick,
    zoomIn: () => getCanvasControls()?.zoomIn(),
    zoomOut: () => getCanvasControls()?.zoomOut(),
    fitToWindow: () => getCanvasControls()?.fitToWindow(),
    exportBoq: handleExportClick
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <TitleBar />
      <TopActionBar
        onOpenClick={handleOpenClick}
        onReplaceClick={handleReplaceClick}
        onExportClick={handleExportClick}
        onAboutClick={() => {
          if (!document.querySelector('[role="dialog"]') && !isSaving) setAboutOpen(true)
        }}
        recoveryAvailable={recoveryCandidates.length > 0 || recoveryError !== null}
        onRecoverClick={() => {
          if (!document.querySelector('[role="dialog"]') && !isSaving && !recoveryScanning)
            void refreshRecovery(true)
        }}
      />
      <ContextBar />
      {unresolvedRates && <aside aria-label="Review rate units" style={{ padding: '8px 16px', background: COLORS.secondary, color: COLORS.textPrimary, fontSize: 13, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 0 }}>{LEGACY_RATE_WARNING}</span>
        <button disabled={isSaving} onClick={() => setRateReviewOpen(true)} style={{ minHeight: 28, padding: '4px 8px', flexShrink: 0 }}>Review Rates</button>
      </aside>}
      {rateReviewOpen && unresolvedRates && <LegacyRateReviewDialog onClose={() => setRateReviewOpen(false)} />}
      <main
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          background: COLORS.dominant,
          display: 'flex',
          flexDirection: 'row'
        }}
      >
        {/* Phase 18 (SC-1): the persistent left ToolRail is the FIRST column of the
            stage row — a SIBLING of the center region, never a wrapper. Prepending it
            here (Pitfall 4) leaves the mount-preserving CanvasViewport subtree and its
            `display: viewMode` swap structurally untouched; the minWidth:0 floor on the
            center flex child below is preserved. */}
        <ToolRail />
        {/* Center region — Phase 16 D-01 mount-preserving view swap (Pitfall 1):
            BOTH the Plan subtree (canvas) AND the Estimate sheet are ALWAYS mounted;
            a CSS `display` gate (driven by viewMode) picks which is visible. The
            Konva CanvasViewport is NEVER conditionally unmounted — a conditional
            {viewMode==='plan' ? … : …} would tear down the Stage, re-rasterize the
            PDF, and measure 0×0 on return. Markups already live in Zustand, so no
            data is ever at risk; keeping the (cheap) Estimate DOM mounted while
            hidden costs nothing meaningful. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            minWidth: 0,
            overflow: 'hidden'
          }}
        >
          {/* Plan subtree: CanvasViewport + toasts. Phase 18 (D-06): the top
            CanvasHeaderBar is gone — its page/scale + "Page not calibrated → Set Scale"
            nudge now live on the single consolidated bottom StatusBar line.
            CRITICAL: minWidth: 0 prevents the canvas's intrinsic content from blocking
            shrinking when both panels are open (flex-child needs explicit 0 floor). */}
          <div
            style={{
              display: viewMode === 'plan' ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            <div
              data-testid="canvas-viewport-container"
              style={{ flex: 1, position: 'relative', minHeight: 0 }}
            >
              {totalPages === 0 ? (
                <EmptyState />
              ) : (
                <CanvasViewport
                  hoverMatches={hoverMatches}
                  pulse={pulse}
                  onPulseComplete={clearPulse}
                  onReopenToast={handleReopenToast}
                />
              )}

              {/* Toasts relocated inside center column so they don't bleed across side panels */}
              {saveToast !== null && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 16px',
                    background: '#252526',
                    border: '1px solid #3c3c3c',
                    borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    zIndex: 15,
                    display: 'flex',
                    gap: 16,
                    fontSize: 13,
                    color: '#cccccc'
                  }}
                >
                  <span>{saveToast}</span>
                  <button
                    onClick={() => setSaveToast(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {exportToast !== null && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    position: 'absolute',
                    bottom: 60,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 16px',
                    background: '#252526',
                    border: '1px solid #3c3c3c',
                    borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    zIndex: 15,
                    display: 'flex',
                    gap: 16,
                    fontSize: 13,
                    color: '#cccccc'
                  }}
                >
                  <span>{exportToast}</span>
                  <button
                    onClick={() => setExportToast(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Phase 6 D-14: Copy toast — 2000ms parent-owned dismiss */}
              {copyToast !== null && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    position: 'absolute',
                    bottom: 104,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 16px',
                    background: '#252526',
                    border: '1px solid #3c3c3c',
                    borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    zIndex: 15,
                    display: 'flex',
                    gap: 16,
                    fontSize: 13,
                    color: '#cccccc'
                  }}
                >
                  <span>{copyToast}</span>
                  <button
                    onClick={() => setCopyToast(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Phase 13 (D-11 / D-20): post-commit re-open toast. bottom: 148 avoids stacking
                collision with saveToast (16), exportToast (60), copyToast (104). */}
              {reopenToast !== null && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    position: 'absolute',
                    bottom: 148,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 16px',
                    background: '#252526',
                    border: '1px solid #3c3c3c',
                    borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    zIndex: 15,
                    display: 'flex',
                    gap: 16,
                    fontSize: 13,
                    color: '#cccccc'
                  }}
                >
                  <span>{reopenToast}</span>
                  <button
                    onClick={() => setReopenToast(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Estimate subtree — always mounted, shown only in Estimate mode. Fills the
            center area (full width); the totals panel + splitter hide (below). */}
          <div
            style={{
              display: viewMode === 'estimate' ? 'flex' : 'none',
              flex: 1,
              minWidth: 0,
              minHeight: 0
            }}
          >
            <EstimatePanel />
          </div>
        </div>

        {/* Right-side chrome — Plan-only (D-01/A4). In Estimate mode the grid is
            full-width, so the Splitter + TotalsPanel are hidden. */}
        {viewMode === 'plan' && (
          <>
            <Splitter
              side="right"
              panelWidth={totals.open ? totals.width : TOTALS_RAIL_WIDTH}
              containerWidth={containerWidth}
              minWidth={TOTALS_RAIL_WIDTH}
              onDragWidth={handleTotalsDragWidth}
              onCommit={handleTotalsCommitWidth}
              ariaLabel="Resize Totals panel"
            />

            {/* Right: Totals panel — collapsible BOQ summary */}
            <TotalsPanel
              ref={totalsPanelRef}
              open={totalsDragOpen ?? totals.open}
              width={totals.width}
              onSetOpen={setTotalsOpen}
              onSetWidth={setTotalsWidth}
              onRowHover={setHoverMatches}
              onTriggerPulse={triggerPulse}
              onCopy={(msg) => setCopyToast(msg)}
              onCopyError={() => setCopyToast('Copy failed.')}
              onArmTool={handleArmTool}
            />
          </>
        )}
      </main>
      <StatusBar
        onSaveProject={() => {
          void handleSaveClick()
        }}
        recoveryScanning={recoveryScanning}
      />

      {openError !== null && (
        <OpenErrorModal message={openError} onClose={() => setOpenError(null)} />
      )}

      {/* GAP-2: export errors use export-appropriate copy — NOT the "Failed to
          open file" open-flow wording. OpenErrorModal is parameterized with
          title/body (defaulting to the open-file copy for existing callers). */}
      {exportError !== null && (
        <OpenErrorModal
          title="Export failed"
          body="The BOQ couldn't be exported."
          message={exportError}
          onClose={() => setExportError(null)}
        />
      )}

      {uncalibratedWarning && (
        <UncalibratedExportWarningModal
          uncalibratedPages={uncalibratedWarning.pages}
          onContinue={async () => {
            const captured = uncalibratedWarning.structure
            setUncalibratedWarning(null)
            const r = await applyExportAfterConfirm(captured)
            if (r.kind === 'error') {
              setExportError(r.message)
            } else if (r.kind === 'ok') {
              const fileBasename = (p: string): string => {
                const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
                return i >= 0 ? p.slice(i + 1) : p
              }
              setExportToast(`Exported: ${fileBasename(r.filePath)}`)
            }
          }}
          onCancel={() => {
            setUncalibratedWarning(null)
            // exportBoq holds isExporting=true across the modal-open window
            // (per the BL-02 race fix). Releasing here closes the flow on Cancel.
            useProjectStore.getState().setExporting(false)
          }}
        />
      )}

      {archiveCorrupted && (
        <ArchiveCorruptedModal
          onOpenAnyway={async () => {
            await applyArchiveCorruptedProceed(
              archiveCorrupted.validated,
              archiveCorrupted.pdfBytes,
              archiveCorrupted.clmcPath
            )
            setArchiveCorrupted(null)
          }}
          onCancel={() => setArchiveCorrupted(null)}
        />
      )}

      {replacePageAbort && (
        <PageCountAbortModal
          expectedPages={replacePageAbort.expected}
          actualPages={replacePageAbort.actual}
          onPickAgain={async () => {
            setReplacePageAbort(null)
            await handleReplaceClick()
          }}
          onCancel={() => setReplacePageAbort(null)}
        />
      )}

      {replaceDimMiss && (
        <DimensionMismatchModal
          onOpenAnyway={async () => {
            await applyReplacePlanPdf(replaceDimMiss.pendingBytes, replaceDimMiss.pendingFilename)
            setReplaceDimMiss(null)
          }}
          onCancel={() => setReplaceDimMiss(null)}
        />
      )}

      {aboutOpen &&
        !saveFailure &&
        !closeModal &&
        !openError &&
        !exportError &&
        !uncalibratedWarning &&
        !archiveCorrupted &&
        !replacePageAbort &&
        !replaceDimMiss && (
          <AboutDialog projectPath={currentFilePath} onClose={() => setAboutOpen(false)} />
        )}

      {recoveryOpen &&
        recoveryCandidates.length > 0 &&
        !saveFailure &&
        !closeModal &&
        !aboutOpen &&
        !openError &&
        !exportError &&
        !uncalibratedWarning &&
        !archiveCorrupted &&
        !replacePageAbort &&
        !replaceDimMiss && (
          <RecoveryDialog
            candidates={recoveryCandidates}
            busy={recoveryBusy || recoveryScanning}
            error={recoveryError}
            onKeep={() => setRecoveryOpen(false)}
            onRecover={requestRecovery}
            onRetry={() => refreshRecovery()}
            onDiscard={async (candidate) => {
              if (recoveryAction.current || recoveryScanning)
                return { ok: false, stage: 'delete', message: 'Recovery is busy. Try again later.' }
              recoveryAction.current = true
              try {
                const result = await window.api.deleteRecovery(candidate.id, candidate.revision)
                if (result.ok) {
                  setRecoveryCandidates((current) => current.filter((c) => c.id !== candidate.id))
                  await refreshRecovery()
                }
                return result
              } finally {
                recoveryAction.current = false
              }
            }}
          />
        )}

      {saveFailure && (
        <SaveFailureDialog
          failure={saveFailure}
          busy={isSaving}
          onRetry={async () => {
            await finishGuardedSave(await retrySaveProject())
          }}
          onSaveAs={async () => {
            await finishGuardedSave(await saveProjectAs())
          }}
          onClose={() => {
            useProjectStore.getState().setSaveFailure(null)
            setCloseModal(null)
            setPendingOpen(null)
          }}
        />
      )}

      {closeModal && !saveFailure && (
        <SaveCloseModal
          filename={displayFilename}
          busy={isSaving || discardBusy}
          onSave={async () => {
            await finishGuardedSave(await saveProject())
          }}
          onDiscard={async () => {
            if (useProjectStore.getState().isSaving || recoveryAction.current) return
            recoveryAction.current = true
            setDiscardBusy(true)
            try {
              if (!(await discardRecovery())) {
                setCloseModal(null)
                setOpenError(
                  'Could not delete the recovery copy. It has been kept. Try again later.'
                )
                return
              }
              if (closeModal === 'close-window') {
                window.api.confirmClose()
              } else if (closeModal === 'open-other' && pendingOpen) {
                const res = await openByExtension(pendingOpen.filePath, pendingOpen.extension)
                handleOpenResult(res)
              } else if (closeModal === 'recover-other' && pendingRecovery) {
                recoveryAction.current = false
                await performRecovery(pendingRecovery)
              }
              setCloseModal(null)
              setPendingOpen(null)
              setPendingRecovery(null)
            } finally {
              recoveryAction.current = false
              setDiscardBusy(false)
            }
          }}
          onCancel={() => {
            setCloseModal(null)
            setPendingOpen(null)
            setPendingRecovery(null)
          }}
        />
      )}
    </div>
  )
}

export default App
