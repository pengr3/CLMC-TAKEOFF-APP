import * as pdfjsLib from 'pdfjs-dist'
import rawWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Make the URL absolute so it's importable from inside a blob worker
const workerUrl = new URL(rawWorkerUrl, import.meta.url).href

// PDF.js 5.x calls Uint8Array.prototype.toHex / toBase64 / Uint8Array.fromBase64
// (Chrome 129+ Web Platform APIs). Electron's Web Worker context may not have them
// even on Chromium 134. We inject polyfills via a blob wrapper worker that runs
// before the real pdf.worker.mjs is imported.
const polyfillScript = `
if (!("toHex" in Uint8Array.prototype)) {
  Object.defineProperty(Uint8Array.prototype, "toHex", {
    value() { return Array.from(this, b => b.toString(16).padStart(2, "0")).join(""); },
    writable: true, configurable: true
  });
}
if (!("toBase64" in Uint8Array.prototype)) {
  Object.defineProperty(Uint8Array.prototype, "toBase64", {
    value() {
      let s = "";
      for (let i = 0; i < this.length; i++) s += String.fromCharCode(this[i]);
      return btoa(s);
    },
    writable: true, configurable: true
  });
}
if (!("fromBase64" in Uint8Array)) {
  Object.defineProperty(Uint8Array, "fromBase64", {
    value(b64) {
      const s = atob(b64), a = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
      return a;
    },
    writable: true, configurable: true
  });
}
import "${workerUrl}";
`

const blob = new Blob([polyfillScript], { type: 'text/javascript' })
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)

console.log('[PDF] worker blob URL created, real worker:', workerUrl)

export { pdfjsLib }
export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
