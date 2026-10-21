import { app, ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, stat, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { randomUUID } from 'crypto'
import {
  buildCostLibraryTemplate,
  CostLibraryRepository,
  MAX_LIBRARY_FILE_BYTES,
  parseCostLibrary
} from './cost-library'
import type { CostLibrarySnapshot } from '../shared/cost-library'
import { trustedIpcHandle, type TrustedSender } from './app-identity'

export function registerCostLibraryHandlers(assertTrusted: TrustedSender): void {
  const handle = trustedIpcHandle(ipcMain, assertTrusted)
  const repository = new CostLibraryRepository(app.getPath('userData'))
  const candidates = new Map<number, { token: string; library: CostLibrarySnapshot }>()
  const observedOwners = new Set<number>()
  let saving = false
  handle('costLibrary:load', () => repository.load())
  handle('costLibrary:preview', async (event) => {
    const owner = event.sender.id
    candidates.delete(owner)
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { ok: false, reason: 'The application window is unavailable.' }
    try {
      console.info('[cost-library] Opening library import dialog')
      const pick = await dialog.showOpenDialog(window, {
        title: 'Import Cost Library',
        defaultPath: app.getPath('downloads'),
        properties: ['openFile'],
        filters: [{ name: 'Cost Library', extensions: ['xlsx', 'csv'] }]
      })
      console.info('[cost-library] Library import dialog returned', {
        canceled: pick.canceled,
        hasSelection: !!pick.filePaths[0]
      })
      if (pick.canceled) return { ok: true, value: null }
      if (!pick.filePaths[0]) {
        return {
          ok: false,
          reason: 'The import dialog did not return a file. Please try importing again.'
        }
      }
      const path = pick.filePaths[0]
      if ((await stat(path)).size > MAX_LIBRARY_FILE_BYTES)
        return { ok: false, reason: 'Choose a cost library smaller than 10 MB.' }
      const result = await parseCostLibrary(await readFile(path), path)
      if (!result.ok) return result
      const candidate = {
        token: randomUUID(),
        library: {
          formatVersion: 1 as const,
          sourceFilename: basename(path),
          importedAt: new Date().toISOString(),
          items: result.value
        }
      }
      candidates.set(owner, candidate)
      if (!observedOwners.has(owner)) {
        observedOwners.add(owner)
        event.sender.once('destroyed', () => {
          candidates.delete(owner)
          observedOwners.delete(owner)
        })
      }
      return { ok: true, value: candidate }
    } catch (error) {
      console.error('[cost-library] Library import failed', error)
      return {
        ok: false,
        reason: 'Could not open this cost library. Check file access and try again.'
      }
    }
  })
  handle('costLibrary:cancel', (event, token: string) => {
    if (candidates.get(event.sender.id)?.token === token) candidates.delete(event.sender.id)
  })
  handle('costLibrary:commit', async (event, token: string) => {
    const candidate = candidates.get(event.sender.id)
    if (!candidate || candidate.token !== token)
      return { ok: false, reason: 'This preview has expired. Import the spreadsheet again.' }
    if (saving) return { ok: false, reason: 'A library is being saved. Try again shortly.' }
    saving = true
    try {
      const result = await repository.replace(candidate.library)
      if (result.ok) candidates.delete(event.sender.id)
      return result
    } finally {
      saving = false
    }
  })
  handle('costLibrary:template', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { ok: false, reason: 'The application window is unavailable.' }
    const startedAt = Date.now()
    try {
      // Use a known Windows folder instead of inheriting a stale shell dialog location.
      const defaultPath = join(app.getPath('downloads'), 'CLMC Cost Library Template.xlsx')
      console.info('[cost-library] Opening template save dialog')
      const pick = await dialog.showSaveDialog(window, {
        title: 'Save Cost Library Template',
        defaultPath,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      })
      console.info('[cost-library] Template save dialog returned', {
        canceled: pick.canceled,
        hasDestination: !!pick.filePath,
        elapsedMs: Date.now() - startedAt
      })
      if (pick.canceled) return { ok: true, value: false }
      if (!pick.filePath) {
        return {
          ok: false,
          reason:
            'The save dialog did not return a destination. Please try downloading the template again.'
        }
      }
      const path = /\.xlsx$/i.test(pick.filePath) ? pick.filePath : `${pick.filePath}.xlsx`
      await writeFile(path, await buildCostLibraryTemplate())
      return { ok: true, value: true }
    } catch (error) {
      console.error('[cost-library] Template download failed', error)
      return {
        ok: false,
        reason: 'Could not save the template. Check folder access and try again.'
      }
    }
  })
}
