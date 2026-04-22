import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, access } from 'fs/promises'
import { extname, basename } from 'path'
import { sha256File, resolvePdfPath, computeRelativePath, enforceClmcExtension } from './project-io'

export function registerIpcHandlers(): void {
  ipcMain.handle('dialog:openPdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const result = await dialog.showOpenDialog(win, {
      title: 'Open PDF Floor Plan',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const data = await readFile(filePath)
    return { filePath, data: new Uint8Array(data).buffer }
  })

  // Extension-sniffing Open dialog — accepts .pdf or .clmc (D-19)
  ipcMain.handle('dialog:openProject', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const result = await dialog.showOpenDialog(win, {
      title: 'Open',
      filters: [
        { name: 'Supported (PDF, CLMC Project)', extensions: ['pdf', 'clmc'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'CLMC Project', extensions: ['clmc'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return {
      filePath,
      extension: extname(filePath).toLowerCase(), // '.pdf' or '.clmc'
      fileName: basename(filePath)
    }
  })

  // Save dialog with .clmc extension enforcement (Pitfall 6)
  ipcMain.handle('dialog:saveProject', async (event, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Project',
      defaultPath,
      filters: [{ name: 'CLMC Project', extensions: ['clmc'] }]
    })
    if (result.canceled || !result.filePath) return null
    return enforceClmcExtension(result.filePath)
  })

  ipcMain.handle('file:readProject', async (_event, filePath: string): Promise<string> => {
    return await readFile(filePath, 'utf-8')
  })

  ipcMain.handle(
    'file:writeProject',
    async (_event, filePath: string, jsonText: string): Promise<{ ok: true }> => {
      await writeFile(filePath, jsonText, 'utf-8')
      return { ok: true }
    }
  )

  ipcMain.handle('file:hashPdf', async (_event, pdfPath: string): Promise<string> => {
    return await sha256File(pdfPath)
  })

  ipcMain.handle('file:checkExists', async (_event, filePath: string): Promise<boolean> => {
    try {
      await access(filePath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('file:readPdfBytes', async (_event, pdfPath: string): Promise<ArrayBuffer> => {
    const data = await readFile(pdfPath)
    return new Uint8Array(data).buffer
  })

  ipcMain.handle(
    'file:resolvePdfPath',
    async (
      _event,
      clmcPath: string,
      absolutePath: string,
      relativePath: string | null
    ): Promise<{ resolvedPath: string; source: 'absolute' | 'relative' } | null> => {
      return resolvePdfPath(clmcPath, absolutePath, relativePath)
    }
  )

  // Path math stays in main (CONTEXT.md Claude's Discretion — Node path semantics only).
  // Pitfall 4: returns null on cross-drive inputs.
  ipcMain.handle(
    'file:computeRelativePath',
    async (_event, clmcPath: string, pdfPath: string): Promise<string | null> => {
      return computeRelativePath(clmcPath, pdfPath)
    }
  )
}
