import { useEffect, useState, useCallback } from 'react'
import { TitleBar } from './components/TitleBar'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { CanvasViewport } from './components/CanvasViewport'
import { MissingPdfModal } from './components/MissingPdfModal'
import { HashMismatchModal } from './components/HashMismatchModal'
import { DimensionMismatchModal } from './components/DimensionMismatchModal'
import { PageCountAbortModal } from './components/PageCountAbortModal'
import { SaveCloseModal } from './components/SaveCloseModal'
import { OpenErrorModal } from './components/OpenErrorModal'
import { useViewerStore } from './stores/viewerStore'
import { attachDirtyTracking, useProjectStore } from './stores/projectStore'
import { useProject, type ProjectOpenResult } from './hooks/useProject'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCloseGuard } from './hooks/useCloseGuard'
import { getCanvasControls } from './components/CanvasViewport'
import type { ProjectFileV1 } from './lib/project-schema'

function basename(p: string): string { return p.split(/[\\/]/).pop() ?? p }

function App(): React.JSX.Element {
  const totalPages = useViewerStore((s) => s.totalPages)
  const fileName = useViewerStore((s) => s.fileName)
  const currentFilePath = useProjectStore((s) => s.currentFilePath)
  const {
    openByExtension,
    saveProject,
    saveProjectAs,
    relinkPdf,
    applyHashMismatchProceed,
    applyDimensionMismatchProceed
  } = useProject()

  const [missing, setMissing] = useState<{ data: ProjectFileV1; clmcPath: string } | null>(null)
  const [hashMiss, setHashMiss] = useState<{ resolvedPdfPath: string; data: ProjectFileV1; clmcPath: string } | null>(null)
  const [dimMiss, setDimMiss] = useState<{ resolvedPdfPath: string; data: ProjectFileV1; clmcPath: string } | null>(null)
  const [pageAbort, setPageAbort] = useState<{ expected: number; actual: number; data: ProjectFileV1; clmcPath: string } | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [closeModal, setCloseModal] = useState<'close-window' | 'open-other' | null>(null)
  const [pendingOpen, setPendingOpen] = useState<{ filePath: string; extension: string } | null>(null)

  // Derived display name for the SaveCloseModal prompt
  const displayFilename = currentFilePath
    ? (currentFilePath.split(/[\\/]/).pop() ?? 'project')
    : (fileName ?? 'project')

  // Attach dirty tracking once on mount (Pitfall 10)
  useEffect(() => attachDirtyTracking(), [])

  // Prevent Chromium from navigating when a file is dropped onto the window
  useEffect(() => {
    const preventNav = (e: DragEvent): void => { e.preventDefault() }
    window.addEventListener('dragover', preventNav)
    window.addEventListener('drop', preventNav)
    return () => {
      window.removeEventListener('dragover', preventNav)
      window.removeEventListener('drop', preventNav)
    }
  }, [])

  // Prevent Ctrl+scroll from triggering Chromium's native page zoom.
  // All zoom is handled by Konva's viewport controls.
  useEffect(() => {
    const preventNativeZoom = (e: WheelEvent): void => { if (e.ctrlKey) e.preventDefault() }
    window.addEventListener('wheel', preventNativeZoom, { passive: false })
    return () => window.removeEventListener('wheel', preventNativeZoom)
  }, [])

  // Auto-dismiss save toast after 2000ms
  useEffect(() => {
    if (!saveToast) return
    const t = window.setTimeout(() => setSaveToast(null), 2000)
    return () => window.clearTimeout(t)
  }, [saveToast])

  // D-16: intercept window close. If not dirty, confirm immediately (no modal).
  // If dirty, show SaveCloseModal so user can save/discard/cancel before the window closes.
  useCloseGuard(() => {
    if (!useProjectStore.getState().isDirty) {
      window.api.confirmClose()
      return
    }
    setCloseModal('close-window')
  })

  const handleOpenResult = useCallback((result: ProjectOpenResult | null): void => {
    if (!result || result.kind === 'canceled') return
    if (result.kind === 'ok') { setMissing(null); setHashMiss(null); setDimMiss(null); setPageAbort(null); setOpenError(null); return }
    if (result.kind === 'missing-pdf') { setMissing({ data: result.data, clmcPath: result.clmcPath }); return }
    if (result.kind === 'hash-mismatch') { setHashMiss({ resolvedPdfPath: result.resolvedPdfPath, data: result.data, clmcPath: result.clmcPath }); return }
    if (result.kind === 'dimension-mismatch') { setDimMiss({ resolvedPdfPath: result.resolvedPdfPath, data: result.data, clmcPath: result.clmcPath }); return }
    if (result.kind === 'page-count-mismatch') { setPageAbort({ expected: result.expected, actual: result.actual, data: result.data, clmcPath: result.clmcPath }); return }
    if (result.kind === 'error') { console.error('[App] open error:', result.message); setOpenError(result.message); return }
  }, [])

  // D-21: open-while-dirty guard. Show picker first (user may cancel), THEN check dirty.
  // If dirty, park the picked file in pendingOpen and show SaveCloseModal.
  // If clean, route directly to openByExtension (same as before).
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

  useKeyboardShortcuts({
    openPdf: handleOpenClick,            // kept for legacy compat
    openProject: handleOpenClick,        // D-20
    saveProject: handleSaveClick,
    saveProjectAs: handleSaveAsClick,
    zoomIn: () => getCanvasControls()?.zoomIn(),
    zoomOut: () => getCanvasControls()?.zoomOut(),
    fitToWindow: () => getCanvasControls()?.fitToWindow()
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <TitleBar />
      <Toolbar />
      <main
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          background: '#1a1a1a'
        }}
      >
        {totalPages === 0 ? <EmptyState /> : <CanvasViewport />}

        {/* Save toast — auto-dismiss after 2s (D-18) */}
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
      </main>
      <StatusBar />

      {/* OpenErrorModal — surfaces kind === 'error' results to user (previously console-only) */}
      {openError !== null && (
        <OpenErrorModal
          message={openError}
          onClose={() => setOpenError(null)}
        />
      )}

      {/* Recovery modals — mounted on ProjectOpenResult.kind */}
      {missing && (
        <MissingPdfModal
          expectedFilename={basename(missing.data.pdf.absolutePath)}
          originalPath={missing.data.pdf.absolutePath}
          onBrowse={async () => {
            const pick = await window.api.openPdf()
            if (!pick) return
            const r = await relinkPdf(pick.filePath, missing.data, missing.clmcPath)
            setMissing(null)
            handleOpenResult(r)
          }}
          onCancel={() => setMissing(null)}
        />
      )}
      {hashMiss && (
        <HashMismatchModal
          onOpenAnyway={async () => {
            const r = await applyHashMismatchProceed(hashMiss.resolvedPdfPath, hashMiss.data, hashMiss.clmcPath)
            setHashMiss(null)
            handleOpenResult(r)
          }}
          onCancel={() => setHashMiss(null)}
        />
      )}
      {dimMiss && (
        <DimensionMismatchModal
          onOpenAnyway={async () => {
            // applyDimensionMismatchProceed hydrates stores so user sees the loaded project.
            // Must NOT just flip isDirty=false — the stores need the snapshot data.
            await applyDimensionMismatchProceed(dimMiss.data, dimMiss.resolvedPdfPath, dimMiss.clmcPath)
            setDimMiss(null)
          }}
          onCancel={() => setDimMiss(null)}
        />
      )}
      {pageAbort && (
        <PageCountAbortModal
          expectedPages={pageAbort.expected}
          actualPages={pageAbort.actual}
          onPickAgain={async () => {
            const pick = await window.api.openPdf()
            if (!pick) return
            const r = await relinkPdf(pick.filePath, pageAbort.data, pageAbort.clmcPath)
            setPageAbort(null)
            handleOpenResult(r)
          }}
          onCancel={() => setPageAbort(null)}
        />
      )}

      {/* D-16 / D-21: close-window and open-while-dirty guard modal (zIndex 120 > others) */}
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
            // If save was canceled (user dismissed the Save As dialog), keep the modal
            // open — user can retry Save or choose Discard/Cancel instead.
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
