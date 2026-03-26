# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## pdf-csp-worker-blocked — pdfjs-dist 5.5.x fails to load in Electron 35 / Chromium 134
- **Date:** 2026-03-26
- **Error patterns:** blob worker, Content Security Policy, worker-src, script-src, fake worker, Setting up fake worker failed, Failed to fetch dynamically imported module, getOrInsertComputed, toHex, fromBase64, RenderParameters, canvasContext, page.render, pdf.worker.mjs, pdfjs-dist
- **Root cause:** Three-stage failure chain with pdfjs-dist 5.5.207 on Electron 35 (Chromium 134). (1) blob: worker URL blocked by CSP — worker-src lacked blob: allowance. (2) Worker thread lacked Uint8Array.prototype.toHex / fromBase64 (Chrome 129+ APIs) — fixed by polyfilling in the blob wrapper before importing pdf.worker.mjs. (3) pdfjs-dist 5.5.207 uses Map.prototype.getOrInsertComputed (TC39 upsert, Chrome 136+) in 9 renderer and 6 worker call sites — Chromium 134 does not have it. Additionally, pdfjs-dist 5.5.x changed RenderParameters to require canvas (HTMLCanvasElement) instead of canvasContext.
- **Fix:** (1) Added blob: to worker-src in index.html CSP. (2) Polyfilled Uint8Array.prototype.toHex, Uint8Array.prototype.toBase64, and Uint8Array.fromBase64 in the blob wrapper script in pdf-setup.ts. (3) Polyfilled Map.prototype.getOrInsertComputed in both the blob wrapper script (worker context) and the renderer context block in pdf-setup.ts. (4) Updated usePdfRenderer.ts page.render() call to pass canvas property instead of canvasContext.
- **Files changed:** src/renderer/index.html, src/renderer/src/lib/pdf-setup.ts, src/renderer/src/hooks/usePdfRenderer.ts
---
