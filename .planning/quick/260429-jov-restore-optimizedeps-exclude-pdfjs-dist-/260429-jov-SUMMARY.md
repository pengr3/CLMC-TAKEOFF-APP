---
phase: quick
plan: "260429-jov"
subsystem: build-config
tags:
  - vite
  - pdfjs-dist
  - electron-vite
  - dev-launch
dependency_graph:
  requires: []
  provides:
    - vite-optimizeDeps-exclude-pdfjs
  affects:
    - electron.vite.config.ts
tech_stack:
  added: []
  patterns:
    - "optimizeDeps.exclude for pre-bundled ESM packages that manage their own worker"
key_files:
  created: []
  modified:
    - electron.vite.config.ts
decisions:
  - "optimizeDeps.exclude (not include) — pdfjs-dist ships pre-bundled ESM; exclusion tells Vite to serve it as-is rather than re-flattening it and breaking the worker reference path"
  - "Restored via git checkout rather than re-edit — the block was in the committed history; reverting the uncommitted regression was the cleanest fix"
metrics:
  duration: "2 minutes"
  completed: "2026-04-29"
  tasks: 1
  files_modified: 1
requirements: []
---

# Quick Plan 260429-jov: Restore optimizeDeps.exclude pdfjs-dist

Restored the `optimizeDeps: { exclude: ['pdfjs-dist'] }` block in `electron.vite.config.ts` renderer section that was accidentally removed, unblocking the Electron dev-launch sequence.

## What Was Built

### Task 1: Restore optimizeDeps.exclude in renderer config

The regression was a missing `optimizeDeps.exclude` block in `electron.vite.config.ts`. Without it, Vite's dep optimizer attempted to pre-bundle `pdfjs-dist`, which ships as pre-bundled ESM with a worker already copied via `viteStaticCopy`. Re-bundling it broke the worker reference path; the renderer threw during init, and `ready-to-show` never fired. Because `src/main/index.ts` uses `show: false` + `ready-to-show` for the BrowserWindow, the window stayed hidden — the app appeared to launch silently.

**Fix applied:** `git checkout -- electron.vite.config.ts` restored the committed version which contains the correct block:

```typescript
renderer: {
  resolve: {
    alias: { '@renderer': resolve('src/renderer/src') }
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  },
  plugins: [ react(), tailwindcss(), viteStaticCopy(...) ]
}
```

**Verification (human-approved):** Dev launch (`npm run dev`) completed successfully. Electron window became visible. PDF loading confirmed working. No pdfjs-dist or optimizer errors in DevTools console.

## Deviations from Plan

None — the fix was a one-field config restore. Executed via `git checkout` rather than an Edit tool call because the committed version was already correct; this is equivalent and avoids any whitespace/formatting drift.

## Known Stubs

None.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| electron.vite.config.ts contains optimizeDeps.exclude pdfjs-dist | FOUND (committed) |
| Dev window visible on launch | CONFIRMED (human-approved) |
| PDF rendering works at runtime | CONFIRMED (human-approved) |
