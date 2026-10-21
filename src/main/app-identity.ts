import { join } from 'node:path'
import type { App, BrowserWindow, IpcMain, IpcMainInvokeEvent, IpcMainEvent } from 'electron'

export const APP_ID = 'com.clmc.takeoff'
export const PRODUCT_NAME = 'CLMC Takeoff'
export const USER_DATA_DIRECTORY = 'clmc-takeoff'

// Keep the established storage identity independent of the installer/product label.
// No legacy directory is moved, merged, overwritten or removed.
export function pinUserData(app: Pick<App, 'getPath' | 'setPath'>): void {
  app.setPath('userData', join(app.getPath('appData'), USER_DATA_DIRECTORY))
}

export type TrustedSender = (event: IpcMainInvokeEvent | IpcMainEvent) => void

export function trustedWindowSender(
  getWindow: () => BrowserWindow | null,
  rendererUrl: string
): TrustedSender {
  return (event) => {
    const contents = getWindow()?.webContents
    if (
      !contents ||
      event.sender !== contents ||
      !event.senderFrame ||
      event.senderFrame !== contents.mainFrame ||
      event.senderFrame.url !== rendererUrl
    ) {
      throw new Error('Untrusted application sender')
    }
  }
}

export function trustedIpcHandle(
  ipc: Pick<IpcMain, 'handle'>,
  assertTrusted: TrustedSender
): IpcMain['handle'] {
  return (channel, listener) =>
    ipc.handle(channel, (event, ...args) => {
      assertTrusted(event)
      return listener(event, ...args)
    })
}
