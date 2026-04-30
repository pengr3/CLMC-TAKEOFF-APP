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
import { useViewerStore } from './stores/viewerStore'
import { attachDirtyTracking, useProjectStore } from './stores/projectStore'
import { useProject, type ProjectOpenResult } from './hooks/useProject'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCloseGuard } from './hooks/useCloseGuard'
import { getCanvasControls } from './components/CanvasViewport'
import type { ProjectFileV2 } from './lib/project-schema'

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

  useKeyboardShortcuts({
    openPdf: handleOpenClick,
    openProject: handleOpenClick,
    saveProject: handleSaveClick,
    saveProjectAs: handleSaveAsClick,
    zoomIn: () => getCanvasControls()?.zoomIn(),
    zoomOut: () => getCanvasControls()?.zoomOut(),
    fitToWindow: () => getCanvasControls()?.fitToWindow()
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <TitleBar />
      <Toolbar onOpenClick={handleOpenClick} onReplaceClick={handleReplaceClick} />
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
      </main>
      <StatusBar />

      {openError !== null && (
        <OpenErrorModal
          message={openError}
          onClose={() => setOpenError(null)}
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
