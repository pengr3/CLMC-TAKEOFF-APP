import * as pdfjsLib from 'pdfjs-dist'
import rawWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Make the URL absolute so it resolves correctly regardless of base path
const workerUrl = new URL(rawWorkerUrl, import.meta.url).href

// PDF.js 5.x calls Uint8Array.prototype.toHex and Uint8Array.fromBase64
// (Web Platform APIs added in Chrome 129). These must be available inside
// the worker thread — the worker runs in a separate JS global scope and
// does not inherit prototype extensions from the renderer context.
//
// Strategy: create a blob: URL worker that (1) installs the polyfills into
// the worker global, then (2) dynamically imports the real pdf.worker.mjs.
// The CSP allows this via `worker-src 'self' blob:`.
const polyfillScript = `
// Map.prototype.getOrInsertComputed — TC39 upsert proposal, Chrome 136+
// pdfjs-dist 5.5.x uses this extensively in both pdf.mjs and pdf.worker.mjs.
// Electron 35 / Chromium 134 does not have it — polyfill required in both contexts.
if (!('getOrInsertComputed' in Map.prototype)) {
  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    value: function getOrInsertComputed(key, callbackFn) {
      if (this.has(key)) return this.get(key);
      const value = callbackFn(key);
      this.set(key, value);
      return value;
    },
    writable: true,
    configurable: true
  });
}

// Uint8Array.prototype.toHex — Chrome 129+ (Web Platform baseline)
if (!('toHex' in Uint8Array.prototype)) {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function toHex() {
      let hex = '';
      for (let i = 0; i < this.length; i++) {
        hex += this[i].toString(16).padStart(2, '0');
      }
      return hex;
    },
    writable: true,
    configurable: true
  });
}

// Uint8Array.prototype.toBase64 — Chrome 129+
if (!('toBase64' in Uint8Array.prototype)) {
  Object.defineProperty(Uint8Array.prototype, 'toBase64', {
    value: function toBase64() {
      let binary = '';
      for (let i = 0; i < this.length; i++) {
        binary += String.fromCharCode(this[i]);
      }
      return btoa(binary);
    },
    writable: true,
    configurable: true
  });
}

// Uint8Array.fromBase64 — Chrome 129+ (static method)
if (!('fromBase64' in Uint8Array)) {
  Object.defineProperty(Uint8Array, 'fromBase64', {
    value: function fromBase64(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    },
    writable: true,
    configurable: true
  });
}

// Now load the real PDF.js worker
import(${JSON.stringify(workerUrl)});
`

const blob = new Blob([polyfillScript], { type: 'text/javascript' })
const blobWorkerUrl = URL.createObjectURL(blob)

// Also polyfill in the renderer context (for any pdfjs usage on the main thread)

// Map.prototype.getOrInsertComputed — TC39 upsert proposal, Chrome 136+
// pdf.mjs (renderer-side) calls this at render/operation time, so it must exist
// in the renderer global before any page.render() / getPage() calls are made.
if (!('getOrInsertComputed' in Map.prototype)) {
  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    value(key: unknown, callbackFn: (key: unknown) => unknown) {
      if ((this as Map<unknown, unknown>).has(key)) return (this as Map<unknown, unknown>).get(key)
      const value = callbackFn(key)
      ;(this as Map<unknown, unknown>).set(key, value)
      return value
    },
    writable: true,
    configurable: true
  })
}

if (!('toHex' in Uint8Array.prototype)) {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value() {
      return Array.from(this as Uint8Array, (b) => (b as number).toString(16).padStart(2, '0')).join('')
    },
    writable: true,
    configurable: true
  })
}
if (!('toBase64' in Uint8Array.prototype)) {
  Object.defineProperty(Uint8Array.prototype, 'toBase64', {
    value() {
      let s = ''
      for (let i = 0; i < (this as Uint8Array).length; i++) s += String.fromCharCode((this as Uint8Array)[i])
      return btoa(s)
    },
    writable: true,
    configurable: true
  })
}
if (!('fromBase64' in Uint8Array)) {
  Object.defineProperty(Uint8Array, 'fromBase64', {
    value(b64: string) {
      const s = atob(b64)
      const a = new Uint8Array(s.length)
      for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i)
      return a
    },
    writable: true,
    configurable: true
  })
}

// Point PDF.js at the blob wrapper worker.
// The wrapper installs Uint8Array polyfills in the worker's global scope
// before importing the real pdf.worker.mjs — required because pdf.worker.mjs
// v5.5.207 calls Uint8Array.prototype.toHex (line 59575) and Uint8Array.fromBase64
// (line 46916), which are Chrome 129+ APIs that may not exist in the worker context.
// The CSP allows blob: workers via `worker-src 'self' blob:`.
pdfjsLib.GlobalWorkerOptions.workerSrc = blobWorkerUrl

console.log('[PDF] workerSrc set to blob wrapper; real worker:', workerUrl)

/**
 * Defensive copy for any Uint8Array about to be passed to pdfjsLib.getDocument({ data }).
 *
 * pdfjs-dist 5.x transfers the underlying ArrayBuffer to its worker via postMessage
 * (structured clone with transfer list). After getDocument is called, the source
 * Uint8Array is DETACHED — its byteLength reports 0 and any subsequent
 * `new Uint8Array(source)`, structuredClone, or IPC postMessage on it throws
 * "Cannot perform Construct on a detached ArrayBuffer" / "An object could not be cloned".
 *
 * The fix is a one-line allocation: `new Uint8Array(bytes)` builds a fresh copy
 * over a fresh ArrayBuffer. The COPY is the one transferred away; the caller's
 * `bytes` stays live for caching in viewerStore.pdfBytes, IPC writeProject, etc.
 *
 * MUST be called at every site that hands a Uint8Array to pdfjsLib.getDocument
 * AND wants the original buffer to remain readable afterwards. Failing to clone
 * is the root cause of the Phase 4.1 UAT Test 3 blocker (replacePlanPdf:286 +
 * pendingBytes:310). See `.planning/phases/04.1-zip-embedded-clmc/04.1-UAT.md`.
 */
export function cloneForPdfWorker(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes)
}

export { pdfjsLib }
export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
