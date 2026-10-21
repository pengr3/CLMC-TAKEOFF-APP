import { app, ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, stat, writeFile } from 'fs/promises'
import { basename } from 'path'
import { randomUUID } from 'crypto'
import {
  buildCostLibraryTemplate,
  CostLibraryRepository,
  MAX_LIBRARY_FILE_BYTES,
  parseCostLibrary
} from './cost-library'
import type { CostLibrarySnapshot } from '../shared/cost-library'

export function registerCostLibraryHandlers(): void {
  const repository = new CostLibraryRepository(app.getPath('userData'))
  const candidates = new Map<number, { token: string; library: CostLibrarySnapshot }>()
  const observedOwners = new Set<number>()
  let saving = false
  ipcMain.handle('costLibrary:load', () => repository.load())
  ipcMain.handle('costLibrary:preview', async (event) => {
    const owner = event.sender.id
    candidates.delete(owner)
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { ok: false, reason: 'The application window is unavailable.' }
    try {
      const pick = await dialog.showOpenDialog(window, {
        title: 'Import Cost Library',
        properties: ['openFile'],
        filters: [{ name: 'Cost Library', extensions: ['xlsx', 'csv'] }]
      })
      if (pick.canceled || !pick.filePaths[0]) return { ok: true, value: null }
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
    } catch {
      return {
        ok: false,
        reason: 'Could not open this cost library. Check file access and try again.'
      }
    }
  })
  ipcMain.handle('costLibrary:cancel', (event, token: string) => {
    if (candidates.get(event.sender.id)?.token === token) candidates.delete(event.sender.id)
  })
  ipcMain.handle('costLibrary:commit', async (event, token: string) => {
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
  ipcMain.handle('costLibrary:template', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { ok: false, reason: 'The application window is unavailable.' }
    try {
      const pick = await dialog.showSaveDialog(window, {
        title: 'Save Cost Library Template',
        defaultPath: 'CLMC Cost Library Template.xlsx',
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      })
      if (pick.canceled || !pick.filePath) return { ok: true, value: false }
      const path = /\.xlsx$/i.test(pick.filePath) ? pick.filePath : `${pick.filePath}.xlsx`
      await writeFile(path, await buildCostLibraryTemplate())
      return { ok: true, value: true }
    } catch {
      return {
        ok: false,
        reason: 'Could not save the template. Check folder access and try again.'
      }
    }
  })
}
