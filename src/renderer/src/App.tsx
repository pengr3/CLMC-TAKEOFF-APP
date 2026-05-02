import { useEffect, useState, useCallback } from 'react'
import { TitleBar } from './components/TitleBar'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { CanvasViewport } from './components/CanvasViewport'
import { ArchiveCorruptedModal } from './components/ArchiveCorruptedModal'
import { DimensionMismatchModal } from './components/DimensionMismatchModal'
import { PageCountAbortModal } from './components/PageCountAbortModal'
import { SaveCloseModal } from './components/SaveCloseModal'
import { OpenErrorModal } from './components/OpenErrorModal'
import { UncalibratedExportWarningModal } from './components/UncalibratedExportWarningModal'
import { useViewerStore } from './stores/viewerStore'
import { attachDirtyTracking, useProjectStore } from './stores/projectStore'
import { useProject, type ProjectOpenResult } from './hooks/useProject'
import { useExport } from './hooks/useExport'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCloseGuard } from './hooks/useCloseGuard'
import { getCanvasControls } from './components/CanvasViewport'
import type { ProjectFileV2 } from './lib/project-schema'
import type { BoqStructure } from './lib/boq-types'

function App(): React.JSX.Element {
  const totalPages = useViewerStore((s) => s.totalPages)
  const fileName = useViewerStore((s) => s.fileName)
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
      <Toolbar
        onOpenClick={handleOpenClick}
        onReplaceClick={handleReplaceClick}
        onExportClick={handleExportClick}
      />
      <main
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          background: '#1a1a1a'
        }}
      >
        {totalPages === 0 ? <EmptyState /> : <CanvasViewport />}

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
          onCancel={() => setUncalibratedWarning(null)}
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
