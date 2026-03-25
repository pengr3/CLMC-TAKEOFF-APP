/**
 * Polyfills for Uint8Array Web Platform APIs (Chrome 129+) used by pdfjs-dist 5.x.
 * Required in Electron's renderer/worker context when these are not natively available.
 */

if (!('toHex' in Uint8Array.prototype)) {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function toHex(this: Uint8Array): string {
      return Array.from(this)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    },
    writable: true,
    configurable: true
  })
}

if (!('toBase64' in Uint8Array.prototype)) {
  Object.defineProperty(Uint8Array.prototype, 'toBase64', {
    value: function toBase64(this: Uint8Array): string {
      let binary = ''
      for (let i = 0; i < this.length; i++) {
        binary += String.fromCharCode(this[i])
      }
      return btoa(binary)
    },
    writable: true,
    configurable: true
  })
}

if (!('fromBase64' in Uint8Array)) {
  Object.defineProperty(Uint8Array, 'fromBase64', {
    value: function fromBase64(base64: string): Uint8Array {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    },
    writable: true,
    configurable: true
  })
}
