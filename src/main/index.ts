import { app, BrowserWindow, ipcMain, type Event } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'node:url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc-handlers'
import { registerCostLibraryHandlers } from './cost-library-ipc'
import { readReleaseInfo } from './release-info'
import { APP_ID, pinUserData, trustedWindowSender } from './app-identity'
import { registerRecoveryHandlers } from './project-recovery'

let canClose = false
let mainWindowRef: BrowserWindow | null = null
let activationPending = false

// All instances must resolve the same identity before Chromium acquires its
// process lock. Contenders exit before ready, IPC registration or storage access.
pinUserData(app)
const ownsSharedStorage = app.requestSingleInstanceLock()
if (!ownsSharedStorage) app.exit(0)
else app.on('second-instance', () => activateMainWindow())

function activateMainWindow(): void {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) {
    activationPending = true
    return
  }
  activationPending = false
  if (mainWindowRef.isMinimized()) mainWindowRef.restore()
  mainWindowRef.show()
  mainWindowRef.focus()
}
const rendererFile = join(__dirname, '../renderer/index.html')
const trustedRendererUrl =
  is.dev && process.env['ELECTRON_RENDERER_URL']
    ? new URL(process.env['ELECTRON_RENDERER_URL']).href
    : pathToFileURL(rendererFile).href
const assertTrusted = trustedWindowSender(() => mainWindowRef, trustedRendererUrl)

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
      sandbox: true,
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
    mainWindow.maximize()
    mainWindow.show()
    if (activationPending) activateMainWindow()
  }
  mainWindow.on('ready-to-show', showOnce)
  mainWindow.webContents.on('did-finish-load', showOnce)

  // Local application pages never navigate or create external browser/shell windows.
  const denyNavigation = (event: Event): void => event.preventDefault()
  mainWindow.webContents.on('will-navigate', denyNavigation)
  mainWindow.webContents.on('will-frame-navigate', denyNavigation)
  mainWindow.webContents.on('will-redirect', denyNavigation)
  mainWindow.webContents.on('will-attach-webview', denyNavigation)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  mainWindow.webContents.session.setPermissionCheckHandler(() => false)

  // HMR for renderer based on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(rendererFile)
  }
}

// Disable Chromium's compositor-level zoom gesture recognition.
// Without this, Ctrl+scroll is processed as a zoom gesture by the GPU compositor
// BEFORE DOM wheel events fire, so preventDefault() in the renderer is too late.
if (ownsSharedStorage) {
app.commandLine.appendSwitch('disable-pinch')

app.whenReady().then(() => {
  electronApp.setAppUserModelId(APP_ID)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers(assertTrusted)
  registerCostLibraryHandlers(assertTrusted)
  registerRecoveryHandlers(app.getPath('userData'), assertTrusted)
  ipcMain.handle('app:getReleaseInfo', async (event) => {
    assertTrusted(event)
    return readReleaseInfo(app.getVersion(), join(app.getAppPath(), 'resources/release-notes.json'))
  })

  // Confirm-close listener: renderer calls this after save/discard decision resolves.
  // Sets canClose=true then re-triggers the OS close — next close event is allowed through.
  ipcMain.on('app:confirm-close', (event) => {
    // Send-style IPC must fail closed without throwing out of the event loop.
    try {
      assertTrusted(event)
    } catch {
      return
    }
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
}
