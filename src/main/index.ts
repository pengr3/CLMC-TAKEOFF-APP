import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc-handlers'

let canClose = false
let mainWindowRef: BrowserWindow | null = null

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'CLMC Takeoff',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#cccccc',
      height: 32
    },
    backgroundColor: '#1a1a1a',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      zoomFactor: 1
    }
  })

  mainWindowRef = mainWindow

  // Close guard (D-16): always intercept close, signal renderer, wait for confirmClose.
  mainWindow.on('close', (event) => {
    if (canClose) return
    event.preventDefault()
    mainWindow.webContents.send('app:close-request')
  })

  // Disable Chromium's built-in pinch/scroll zoom entirely.
  // All zoom is handled by Konva's viewport controls in the renderer.
  // Must be applied after each page load (navigation resets zoom limits).
  const lockZoom = (): void => {
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1)
    mainWindow.webContents.setZoomLevel(0)
  }
  mainWindow.webContents.on('did-finish-load', lockZoom)

  // Also lock zoom immediately for the initial load
  lockZoom()

  // Show the window once content is loaded.
  // `ready-to-show` is the preferred trigger but is unreliable on Windows
  // (electron/electron #25253, #7779, #6427) — it intermittently does not
  // fire on subsequent dev runs, leaving the window created-but-hidden
  // because we use `show: false`. Fall back to `did-finish-load` with an
  // idempotency guard so show() is called exactly once whichever event
  // arrives first.
  let hasShown = false
  const showOnce = (): void => {
    if (hasShown || mainWindow.isDestroyed()) return
    hasShown = true
    mainWindow.show()
  }
  mainWindow.on('ready-to-show', showOnce)
  mainWindow.webContents.on('did-finish-load', showOnce)


  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Disable Chromium's compositor-level zoom gesture recognition.
// Without this, Ctrl+scroll is processed as a zoom gesture by the GPU compositor
// BEFORE DOM wheel events fire, so preventDefault() in the renderer is too late.
app.commandLine.appendSwitch('disable-pinch')

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.clmc.takeoff')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  // Confirm-close listener: renderer calls this after save/discard decision resolves.
  // Sets canClose=true then re-triggers the OS close — next close event is allowed through.
  ipcMain.on('app:confirm-close', () => {
    canClose = true
    mainWindowRef?.close()
  })

  createWindow()

  // Prevent ALL Chromium-native zoom keyboard shortcuts.
  // Also reset zoom level on any zoom-changed event as a safety net.
  // All zoom is handled by the Konva viewport controls.
  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      if (
        input.type === 'keyDown' &&
        input.control &&
        (input.key === '=' || input.key === '+' || input.key === '-' || input.key === '0')
      ) {
        event.preventDefault()
        window.webContents.setZoomLevel(0)
      }
    })

    window.webContents.on('zoom-changed', () => {
      window.webContents.setZoomLevel(0)
    })
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
