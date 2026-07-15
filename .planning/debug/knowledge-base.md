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

## f3-snap-hmr-store-dup-and-rail-badge — F3 snap toggle dead in dev after Vite HMR (dual Zustand store instance)
- **Date:** 2026-07-15
- **Error patterns:** F3, snapEnabled, snapSuspended, state changes UI doesn't, store not updating, Zustand, Vite HMR, hot reload, dual store instance, two store instances, subscribers not reacting, import.meta.hot, dev only, works in production build
- **Root cause:** Renderer Zustand store modules had no Vite HMR handling. On a hot-reload the store module re-evaluated and called create() again, producing a SECOND store instance: already-mounted components stayed subscribed to the old instance while the global keyboard handler re-imported the new one, so F3 mutated one store while the ToolRail was bound to another (the "state changes, UI doesn't" desync). Session/HMR-dependent, not project-dependent; a production build (no HMR) always worked.
- **Fix:** Wrapped each store's create() in a factory and exported the single instance persisted on import.meta.hot.data.store (?? factory() when absent), making each store a self-accepting HMR boundary via import.meta.hot.accept(). Read double-optional-chains (import.meta.hot?.data?.store) because Vitest's web/jsdom transform exposes a truthy import.meta.hot whose data is undefined; persistence only mutates data.store when data exists (never reassigns the read-only data object). In production import.meta.hot is undefined so the block strips out (verified 0 occurrences in the built bundle). Also removed the duplicate armed-item name badge (ChainBadge) from the ToolRail tool buttons.
- **Files changed:** src/renderer/src/stores/viewerStore.ts, src/renderer/src/stores/scaleStore.ts, src/renderer/src/stores/markupStore.ts, src/renderer/src/stores/projectStore.ts, src/renderer/src/components/ToolRail.tsx, src/tests/toolrail-chain-badge.test.ts
---
