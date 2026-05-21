import { useEffect, useRef, useState, useCallback } from 'react'
import { TitleBar } from './components/TitleBar'
import { RibbonToolbar } from './components/RibbonToolbar'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { CanvasViewport } from './components/CanvasViewport'
import { TotalsPanel } from './components/TotalsPanel'
import { CanvasHeaderBar } from './components/CanvasHeaderBar'
import { Splitter } from './components/Splitter'
import { ArchiveCorruptedModal } from './components/ArchiveCorruptedModal'
import { DimensionMismatchModal } from './components/DimensionMismatchModal'
import { PageCountAbortModal } from './components/PageCountAbortModal'
import { SaveCloseModal } from './components/SaveCloseModal'
import { OpenErrorModal } from './components/OpenErrorModal'
import { UncalibratedExportWarningModal } from './components/UncalibratedExportWarningModal'
import { useViewerStore } from './stores/viewerStore'
import { useMarkupStore } from './stores/markupStore'
import { attachDirtyTracking, useProjectStore } from './stores/projectStore'
import { useProject, type ProjectOpenResult } from './hooks/useProject'
import { useExport } from './hooks/useExport'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCloseGuard } from './hooks/useCloseGuard'
import { useUiPanels } from './hooks/useUiPanels'
import { useMarkupHighlight } from './hooks/useMarkupHighlight'
import { getCanvasControls, setChainArmedFromTotals } from './components/CanvasViewport'
import { labelToName, rowTypeToMarkupType } from './components/TotalsRow'
import { MARKUP_PALETTE } from './lib/markup-palette'
import { COLORS } from './lib/constants'
import type { ProjectFileV2 } from './lib/project-schema'
import type { BoqStructure, BoqItemRow } from './lib/boq-types'
import type { WallMarkup } from './types/markup'

function App(): React.JSX.Element {
  const totalPages = useViewerStore((s) => s.totalPages)
  const fileName = useViewerStore((s) => s.fileName)
  // Phase 13 (Pitfall 5): subscribe to currentPage so the page-change useEffect below can
  // clear reopenToast when the user navigates while the toast is showing.
  const currentPage = useViewerStore((s) => s.currentPage)
  const currentFilePath = useProjectStore((s) => s.currentFilePath)
  const {
    openByExtension,
    saveProject,
    saveProjectAs,
    replacePlanPdf,
    applyReplacePlanPdf,
    applyArchiveCorruptedProceed
  } = useProject()
  const { exportBoq, applyExportAfterConfirm } = useExport()

  // Phase 6: Panel layout state (localStorage-backed widths + open/closed).
  const { totals, setTotalsOpen, setTotalsWidth } = useUiPanels()

  // Phase 6: Transient highlight state (hover ring + click pulse).
  const { hoverMatches, setHoverMatches, pulse, triggerPulse, clearPulse } = useMarkupHighlight()

  // Phase 6: Live drag-width for Splitter (held in local state; only committed to
  // useUiPanels on pointerup so localStorage isn't written 60-120x/sec during drag).
  const [totalsDragWidth, setTotalsDragWidth] = useState<number | null>(null)
  const effectiveTotalsWidth = totalsDragWidth ?? totals.width

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
  const [archiveCorrupted, setArchiveCorrupted] =
    useState<{ validated: ProjectFileV2; pdfBytes: Uint8Array; clmcPath: string } | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [closeModal, setCloseModal] = useState<'close-window' | 'open-other' | null>(null)
  const [pendingOpen, setPendingOpen] = useState<{ filePath: string; extension: string } | null>(null)

  // Replace-flow state (NEW)
  const [replacePageAbort, setReplacePageAbort] =
    useState<{ expected: number; actual: number } | null>(null)
  const [replaceDimMiss, setReplaceDimMiss] =
    useState<{ pendingBytes: Uint8Array; pendingFilename: string } | null>(null)

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
    const preventNav = (e: DragEvent): void => { e.preventDefault() }
    window.addEventListener('dragover', preventNav)
    window.addEventListener('drop', preventNav)
    return () => {
      window.removeEventListener('dragover', preventNav)
      window.removeEventListener('drop', preventNav)
    }
  }, [])

  useEffect(() => {
    const preventNativeZoom = (e: WheelEvent): void => { if (e.ctrlKey) e.preventDefault() }
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

  useCloseGuard(() => {
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
    const picked = await window.api.openProject()
    if (!picked) return
    if (useProjectStore.getState().isDirty) {
      setPendingOpen({ filePath: picked.filePath, extension: picked.extension })
      setCloseModal('open-other')
      return
    }
    const r = await openByExtension(picked.filePath, picked.extension)
    handleOpenResult(r)
  }, [openByExtension, handleOpenResult])

  const handleSaveClick = useCallback(async () => {
    const r = await saveProject()
    if (r === 'ok') setSaveToast('Saved')
  }, [saveProject])

  const handleSaveAsClick = useCallback(async () => {
    const r = await saveProjectAs()
    if (r === 'ok') setSaveToast('Saved')
  }, [saveProjectAs])

  // NEW (D-08): Replace Plan PDF — opens picker, runs validation, routes result.
  const handleReplaceClick = useCallback(async () => {
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
  }, [replacePlanPdf])

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
      setExportError(`Export failed: ${r.message}`)
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
      <RibbonToolbar
        onOpenClick={handleOpenClick}
        onReplaceClick={handleReplaceClick}
        onExportClick={handleExportClick}
      />
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
        {/* Center: CanvasHeaderBar + CanvasViewport + toasts.
            CRITICAL: minWidth: 0 prevents the canvas's intrinsic content from blocking
            shrinking when both panels are open (flex-child needs explicit 0 floor). */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {totalPages > 0 && <CanvasHeaderBar />}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {totalPages === 0
              ? <EmptyState />
              : <CanvasViewport
                  hoverMatches={hoverMatches}
                  pulse={pulse}
                  onPulseComplete={clearPulse}
                  onReopenToast={() => setReopenToast('Shape re-opened — continue drawing or press Enter to commit')}
                />
            }

            {/* Toasts relocated inside center column so they don't bleed across side panels */}
            {saveToast !== null && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                  padding: '8px 16px', background: '#252526', border: '1px solid #3c3c3c',
                  borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 15,
                  display: 'flex', gap: 16, fontSize: 13, color: '#cccccc'
                }}
              >
                <span>{saveToast}</span>
                <button
                  onClick={() => setSaveToast(null)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#888', cursor: 'pointer', fontSize: 13
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
                  position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
                  padding: '8px 16px', background: '#252526', border: '1px solid #3c3c3c',
                  borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 15,
                  display: 'flex', gap: 16, fontSize: 13, color: '#cccccc'
                }}
              >
                <span>{exportToast}</span>
                <button
                  onClick={() => setExportToast(null)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#888', cursor: 'pointer', fontSize: 13
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
                  position: 'absolute', bottom: 104, left: '50%', transform: 'translateX(-50%)',
                  padding: '8px 16px', background: '#252526', border: '1px solid #3c3c3c',
                  borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 15,
                  display: 'flex', gap: 16, fontSize: 13, color: '#cccccc'
                }}
              >
                <span>{copyToast}</span>
                <button
                  onClick={() => setCopyToast(null)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#888', cursor: 'pointer', fontSize: 13
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
                  position: 'absolute', bottom: 148, left: '50%', transform: 'translateX(-50%)',
                  padding: '8px 16px', background: '#252526', border: '1px solid #3c3c3c',
                  borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 15,
                  display: 'flex', gap: 16, fontSize: 13, color: '#cccccc'
                }}
              >
                <span>{reopenToast}</span>
                <button
                  onClick={() => setReopenToast(null)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#888', cursor: 'pointer', fontSize: 13
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>

        <Splitter
          side="right"
          panelWidth={effectiveTotalsWidth}
          containerWidth={containerWidth}
          minWidth={28}
          onDragWidth={setTotalsDragWidth}
          onCommit={(w) => { setTotalsWidth(w); setTotalsDragWidth(null) }}
          ariaLabel="Resize Totals panel"
        />

        {/* Right: Totals panel — collapsible BOQ summary */}
        <TotalsPanel
          open={totals.open}
          width={effectiveTotalsWidth}
          onSetOpen={setTotalsOpen}
          onSetWidth={setTotalsWidth}
          onRowHover={setHoverMatches}
          onTriggerPulse={triggerPulse}
          onCopy={(msg) => setCopyToast(msg)}
          onCopyError={() => setCopyToast('Copy failed.')}
          onArmTool={handleArmTool}
        />
      </main>
      <StatusBar />

      {openError !== null && (
        <OpenErrorModal
          message={openError}
          onClose={() => setOpenError(null)}
        />
      )}

      {exportError !== null && (
        <OpenErrorModal
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
              setExportError(`Export failed: ${r.message}`)
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

      {closeModal && (
        <SaveCloseModal
          filename={displayFilename}
          onSave={async () => {
            const r = await saveProject()
            if (r === 'ok') {
              setSaveToast('Saved')
              if (closeModal === 'close-window') {
                window.api.confirmClose()
              } else if (closeModal === 'open-other' && pendingOpen) {
                const res = await openByExtension(pendingOpen.filePath, pendingOpen.extension)
                handleOpenResult(res)
              }
              setCloseModal(null)
              setPendingOpen(null)
            }
          }}
          onDiscard={async () => {
            if (closeModal === 'close-window') {
              window.api.confirmClose()
            } else if (closeModal === 'open-other' && pendingOpen) {
              const res = await openByExtension(pendingOpen.filePath, pendingOpen.extension)
              handleOpenResult(res)
            }
            setCloseModal(null)
            setPendingOpen(null)
          }}
          onCancel={() => {
            setCloseModal(null)
            setPendingOpen(null)
          }}
        />
      )}
    </div>
  )
}

export default App
