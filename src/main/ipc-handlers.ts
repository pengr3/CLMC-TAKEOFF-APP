import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'

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
}
