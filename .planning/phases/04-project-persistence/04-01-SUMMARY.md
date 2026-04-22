---
phase: 04-project-persistence
plan: 01
subsystem: persistence
tags: [typescript, zustand, electron, ipc, sha256, project-file, serialization]

requires:
  - phase: 04-00
    provides: Wave 0 red test scaffolds (project-schema, project-serialize, project-io)

provides:
  - ProjectFileV1 interface + validateV1 + migrate seam (src/renderer/src/lib/project-schema.ts)
  - snapshotProject + hydrateStores pure functions (src/renderer/src/lib/project-serialize.ts)
  - sha256File streaming hash + resolvePdfPath + computeRelativePath + enforceClmcExtension (src/main/project-io.ts)
  - IPC triad: 10 ipcMain.handle channels + preload surface + TypeScript types

affects:
  - 04-02 (projectStore + dirty flag subscribe to these primitives)
  - 04-03 (UI open/save flows call window.api.openProject / saveProjectDialog / readProject / writeProject)

tech-stack:
  added: []
  patterns:
    - "snapshotProject reads stores via .getState() one-shot (no React hooks) — avoids subscription overhead in save path"
    - "hydrateStores issues single setState() per store to avoid intermediate re-renders (Pitfall 2)"
    - "sha256File uses fs.createReadStream — never loads full file into memory (Pitfall 3)"
    - "computeRelativePath uses parse().root cross-drive guard before calling path.relative (Pitfall 4)"
    - "IPC path math confined to main process (CONTEXT.md Claude's Discretion)"

key-files:
  created:
    - src/renderer/src/lib/project-schema.ts
    - src/renderer/src/lib/project-serialize.ts
    - src/main/project-io.ts
  modified:
    - src/main/ipc-handlers.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/tests/project-schema.test.ts
    - src/tests/project-serialize.test.ts
    - src/tests/project-io.test.ts

key-decisions:
  - "snapshotProject takes pdfTotalPages as a param (not viewer.totalPages) — keeps serialize pure and independently testable without PDF loading state"
  - "hydrateStores does NOT touch filePath/fileName/totalPages — those are owned by usePdfDocument.loadPdfFromPath which runs after hydrate in Wave 3 open flow"
  - "ProjectFileV1.globalUnit typed as ScaleUnit (not string) — catches unit drift at compile time"

patterns-established:
  - "project-schema: validateV1 throws on bad shape, migrate dispatches on fromVersion — migration seam ready for v2"
  - "project-serialize: pure function pair (snapshot/hydrate) with no side effects beyond store setState"
  - "project-io: all Node fs/crypto/path operations isolated in main process"

requirements-completed:
  - PERS-01
  - PERS-02

duration: 4min
completed: 2026-04-22
---

# Phase 04 Plan 01: Project Persistence Logic Layer Summary

**ProjectFileV1 schema + snapshot/hydrate pure functions + streaming SHA256 + Windows path math + 10-channel IPC triad — 16 Wave 0 red tests flipped to green**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-22T10:06:11Z
- **Completed:** 2026-04-22T10:10:17Z
- **Tasks:** 4
- **Files modified:** 9 (3 created, 3 modified production + 3 test files updated)

## Accomplishments

- ProjectFileV1 interface matching D-02 schema verbatim, with validateV1 and migrate seam for future schema versions
- snapshotProject reads all three Zustand stores via .getState() (one shot each) and excludes all D-09 transient fields; hydrateStores writes one setState() per store
- sha256File streams via fs.createReadStream (Pitfall 3); computeRelativePath has cross-drive null guard using parse().root (Pitfall 4); enforceClmcExtension appends .clmc when missing (Pitfall 6)
- IPC triad wired: 10 handlers in ipcMain (dialog:openPdf + 9 new), full preload surface, TypeScript types for window.api — path math confined to main process per CONTEXT.md

## Task Commits

Each task was committed atomically:

1. **Task 1: project-schema.ts** - `80e1a9b` (feat)
2. **Task 2: project-serialize.ts** - `27500f7` (feat)
3. **Task 3: main/project-io.ts** - `3e7c646` (feat)
4. **Task 4: IPC triad** - `6f0dde6` (feat)

## IPC Channel Inventory (10 total)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `dialog:openPdf` | main → renderer | Existing: open PDF for new project |
| `dialog:openProject` | main → renderer | Extension-sniffing open (returns .pdf or .clmc) |
| `dialog:saveProject` | main → renderer | Save dialog with .clmc enforcement |
| `file:readProject` | main → renderer | Read .clmc file as UTF-8 string |
| `file:writeProject` | main → renderer | Write .clmc JSON to disk |
| `file:hashPdf` | main → renderer | SHA256 of PDF (streaming) |
| `file:checkExists` | main → renderer | Boolean file existence check |
| `file:readPdfBytes` | main → renderer | Read PDF as ArrayBuffer |
| `file:resolvePdfPath` | main → renderer | Absolute-first / relative-fallback PDF path resolution |
| `file:computeRelativePath` | main → renderer | Cross-drive-safe relative path computation |

## Files Created/Modified

- `src/renderer/src/lib/project-schema.ts` — ProjectFileV1 interface, validateV1, migrate
- `src/renderer/src/lib/project-serialize.ts` — snapshotProject, hydrateStores
- `src/main/project-io.ts` — sha256File, resolvePdfPath, computeRelativePath, enforceClmcExtension
- `src/main/ipc-handlers.ts` — 9 new ipcMain.handle channels added
- `src/preload/index.ts` — 9 new methods exposed via contextBridge
- `src/preload/index.d.ts` — TypeScript types for all 10 window.api methods
- `src/tests/project-schema.test.ts` — 5 red tests flipped to green
- `src/tests/project-serialize.test.ts` — 5 red tests flipped to green
- `src/tests/project-io.test.ts` — 6 red tests flipped to green

## Decisions Made

- snapshotProject takes `pdfTotalPages` as a param (not `viewer.totalPages`) so the serialize function is pure and independently testable without PDF loading state. Wave 3 callers pass in the known page count from their PDF-loading context.
- hydrateStores does NOT set `filePath`/`fileName`/`totalPages` on viewerStore — those fields are owned by `usePdfDocument.loadPdfFromPath` which runs after hydrate in the Wave 3 open flow. Avoids double-write and keeps hydrate scoped to the artifact fields it owns.
- `ProjectFileV1.globalUnit` typed as `ScaleUnit` (not `string`) for compile-time safety against unit drift.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all exports are fully implemented and wired to their data sources.

## Next Phase Readiness

- Wave 1 primitives are complete and all 16 tests pass
- Wave 2 (projectStore + dirty flag) can import `snapshotProject`, `hydrateStores`, and all `window.api.*` methods directly
- Wave 3 (UI open/save flows) has a typed IPC surface ready: `window.api.openProject()`, `saveProjectDialog()`, `readProject()`, `writeProject()`, `hashPdf()`, `checkExists()`, `readPdfBytes()`, `resolvePdfPath()`, `computeRelativePath()`
- The 4 Wave 0 integration scaffolds (project-store, project-shortcuts, title-bar-dirty, project-open-routing) remain RED — those are Wave 2/3 territory

---
*Phase: 04-project-persistence*
*Completed: 2026-04-22*

## Self-Check: PASSED

- FOUND: src/renderer/src/lib/project-schema.ts
- FOUND: src/renderer/src/lib/project-serialize.ts
- FOUND: src/main/project-io.ts
- FOUND: .planning/phases/04-project-persistence/04-01-SUMMARY.md
- FOUND commit: 80e1a9b (project-schema)
- FOUND commit: 27500f7 (project-serialize)
- FOUND commit: 3e7c646 (project-io)
- FOUND commit: 6f0dde6 (IPC triad)
