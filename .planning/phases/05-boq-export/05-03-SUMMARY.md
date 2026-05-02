---
phase: 05-boq-export
plan: 03
subsystem: api
tags: [ipc, electron, preload, contextbridge, boq-export, atomic-write]

requires:
  - phase: 05-boq-export
    provides: buildBoqXlsx/buildBoqCsv from Plan 02; enforceXlsxExtension/enforceCsvExtension from Plan 02
  - phase: 04.1-zip-embedded-clmc
    provides: atomicWriteFile (.tmp + rename + cleanup) helper at ipc-handlers.ts:45-55
provides:
  - dialog:saveExport IPC channel returning { filePath, format } or null
  - file:writeBoqXlsx IPC channel returning { ok: true } | { ok: false, reason }
  - file:writeBoqCsv IPC channel returning { ok: true } | { ok: false, reason }
  - window.api.saveExportDialog / writeBoqXlsx / writeBoqCsv preload bridge
  - BoqStructure types inline-duplicated in preload/index.ts and preload/index.d.ts
affects: 05-04 (useExport hook calls these three window.api methods)

tech-stack:
  added: []
  patterns: [IPC triad pattern (main + preload + .d.ts) extended with three new channels; same-file private helper reuse (Q5 — no atomicWriteFile refactor)]

key-files:
  created: []
  modified:
    - src/main/ipc-handlers.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/tests/boq-export-ipc.test.ts (vi.hoisted fix for top-level mock variable hoisting)

key-decisions:
  - "Format detection by extension sniffing on result.filePath (D-16, RESEARCH §Pitfall 7) — Electron's showSaveDialog does NOT return filterIndex"
  - "atomicWriteFile reused as private helper in same file (Q5) — no export, no refactor"
  - "Discriminated-union returns { ok: true } | { ok: false, reason } mirror Phase 4.1's file:readProject pattern (D-21, T-05-03-03)"
  - "Format hint parameter to dialog:saveExport reorders the filters list so the user's preferred format shows up first; actual returned format determined by chosen file's extension"
  - "BoqStructure inline-duplicated in BOTH preload/index.ts (concrete) and preload/index.d.ts (ambient) following the existing ReadProjectResult pattern at preload/index.ts:7-11 (Q4)"

patterns-established:
  - "vi.hoisted() for shared state between vi.mock factory and test body — vi.mock is hoisted above top-level const initialization, so mockShowSaveDialog had to be declared inside vi.hoisted() to be available at mock-factory evaluation time"

requirements-completed: [EXPRT-01, EXPRT-02]

duration: ~3min
completed: 2026-05-02
---

# Plan 05-03: IPC triad — Summary

**Three new IPC channels (`dialog:saveExport`, `file:writeBoqXlsx`, `file:writeBoqCsv`) wired across main + preload + types. Bridges Wave 1 pure logic to Wave 3 UI orchestration.**

## Performance

- **Duration:** ~3 min
- **Tasks:** 2/2
- **Files modified:** 4 (3 plan-listed + 1 test fix)

## Accomplishments
- Three `ipcMain.handle` blocks added inside `registerIpcHandlers()` — total 76 lines, atomic write reused, discriminated-union failure mode
- `window.api` extended with three TypeScript-typed bridge methods
- `ElectronAPI` interface in `.d.ts` extended; renderer typecheck honors the new methods even though no production code calls them yet
- `boq-export-ipc.test.ts` flipped from RED → GREEN (7/7 tests)

## Task Commits

1. **Task 1: ipcMain handlers** — `7aedf5b` (feat)
2. **Task 2: preload bridge + types** — `968047e` (feat)

## Deviations from Plan

### vi.hoisted fix for boq-export-ipc.test.ts

The RED test scaffold from Plan 05-00 declared `const mockShowSaveDialog = vi.fn()` at the top level and then closed over it in `vi.mock('electron', ...)`. Vitest hoists `vi.mock` calls above top-level code, so the factory ran before the const was initialized — `ReferenceError: Cannot access 'mockShowSaveDialog' before initialization`.

Fixed by wrapping the shared state in `vi.hoisted()`:

```typescript
const { handlers, mockShowSaveDialog } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => Promise<unknown>>,
  mockShowSaveDialog: vi.fn()
}))
```

Functionally identical to the original intent; satisfies vitest's hoisting model. Committed atomically with Task 1.

## Verification

- `npm run typecheck` passes (both tsconfig.node.json — preload + main; and tsconfig.web.json — renderer)
- 7/7 boq-export-ipc tests GREEN
- 321/330 tests overall pass (4 RED test files remain — Waves 3-4 implement them: uncalibrated-export-warning-modal, toolbar-export-button, use-export-hook, use-keyboard-shortcuts-export)
- atomic-write tests still GREEN (Phase 4.1 contract not regressed)
- project-io / project-store / boq-aggregator / boq-writers all still GREEN

## Wave 2 → Wave 3 handoff

`useExport` hook (Plan 05-04) calls these three methods in sequence:

1. `window.api.saveExportDialog(defaultPath, format)` — get { filePath, format } or null
2. `window.api.writeBoqXlsx(filePath, structure)` OR `writeBoqCsv` — get { ok: true } or { ok: false, reason }
3. Failure → ExportResult kind: 'error', message = reason
