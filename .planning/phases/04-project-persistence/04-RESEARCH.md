# Phase 4: Project Persistence - Research

**Researched:** 2026-04-21
**Domain:** Electron IPC + Node filesystem + Zustand snapshot/hydrate + JSON schema versioning
**Confidence:** HIGH

---

## Summary

Phase 4 is an integration phase, not a new-technology phase. Every primitive the implementation needs is already available: Node built-ins (`fs`, `crypto`, `path`, `dialog`), Zustand's `getState()` for snapshots, Electron's `BrowserWindow.on('close')` hook, and the existing IPC triad (`ipc-handlers.ts` + `preload/index.ts` + `preload/index.d.ts`). No new npm dependency is warranted — adding `ajv`/`zod` for a single locally-trusted JSON file would bloat the bundle for marginal safety. Runtime validation will be hand-rolled as small type-guards that run once on open.

The three genuinely tricky areas are: (1) **close-window coordination** between Electron main and renderer for the Save/Discard/Cancel modal (race conditions if done naively), (2) **path handling on Windows** (cross-drive, UNC, Unicode, trailing-backslash quirks in `path.relative`), and (3) **dirty-flag wiring** into the three existing Zustand stores without leaking into every mutating action. These are the three places the plan should spend extra care.

**Primary recommendation:** Build a single `projectStore` slice holding `{ currentFilePath, isDirty, lastSavedAt }`, have it subscribe to the three source-of-truth stores via `zustand.subscribe` (set `isDirty=true` on any relevant field change), and factor `usePdfDocument.openPdfDialog` into `loadPdfFromPath(path)` + `openPdfDialog()` so `.clmc` open can reuse just the render half. Main process owns all `fs`, `crypto`, `path`, and `dialog` calls — renderer only touches `window.api.*`.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**File Schema (D-01 … D-09):**
- D-01: `.clmc` = plain UTF-8 JSON, written via Node `fs.writeFile` through Electron IPC
- D-02: Top-level shape is **per-page nested**:
  ```
  {
    formatVersion: 1,
    createdAt: ISO-8601,
    updatedAt: ISO-8601,
    pdf: { absolutePath, relativePath, totalPages, sha256 },
    globalUnit: 'm' | 'ft' | 'mm' | 'cm' | 'in',
    categories: { [id]: { id, name, color, paletteIndex } },
    categoryOrder: [id, ...],
    currentPage: number,
    pages: [
      { pageIndex, dimensions: {width,height}, scale: {...}|null,
        viewport: {zoom,panX,panY}, markups: [...Markup] }, ...
    ]
  }
  ```
- D-03: `formatVersion` = integer (starts at `1`); future breaking changes bump the integer; loader runs migration steps before hydrating stores
- D-04: Per-page PDF dimensions (width/height in PDF points at rotation 0) serialized and compared on open
- D-05: Top-level `totalPages` serialized (O(1) sanity + grep-friendly)
- D-06: Categories serialize with full `{id,name,color,paletteIndex}` records + `categoryOrder`
- D-07: Per-page `viewport` (`zoom`, `panX`, `panY`) + `currentPage` serialized
- D-08: Top-level `createdAt` (first save) + `updatedAt` (every save), both ISO-8601
- D-09: Transient state EXCLUDED: `undoStack`, `redoStack`, `calibMode`, `activeTool`, in-progress draw state, context-menu position, tooltip state, popup open/closed state

**PDF Reference Strategy (D-10 … D-12):**
- D-10: Both `absolutePath` and `relativePath` stored; absolute tried first on open, relative fallback, else missing-PDF modal
- D-11: SHA256 of PDF bytes stored on save and recomputed on open — main process via `crypto.createHash('sha256')`
- D-12: Hash mismatch = non-blocking warning modal with [Open anyway] / [Cancel]; cancel aborts, app returns to pre-open state

**Save Flow (D-13 … D-18):**
- D-13: Ctrl+S = Save; Ctrl+Shift+S = Save As; Ctrl+S on never-saved routes through Save As automatically
- D-14: Default Save As filename = PDF basename with `.clmc` extension in PDF's directory
- D-15: Dirty state signalled in title bar ONLY as trailing asterisk (`filename.clmc *`). Toolbar button is NOT highlighted
- D-16: Close/open-other while dirty = `"Save changes to [filename]? [Save] [Discard] [Cancel]"` modal; Save routes through Save As if never-saved; Cancel aborts close/open; required for Electron `before-quit` path
- D-17: No auto-save in v1
- D-18: Brief `ConfirmationToast` on successful save ("Saved" / "Saved as {filename}")

**Open Flow (D-19 … D-22):**
- D-19: Blue "Open PDF" button → "Open", extension-sniffing (`.pdf` → fresh, `.clmc` → hydrate+render)
- D-20: Ctrl+O triggers same extension-sniffing dialog
- D-21: Opening any file while dirty goes through D-16 modal first
- D-22: No recent-files list in Phase 4

**PDF-Not-Found Recovery (D-23 … D-25):**
- D-23: Blocking modal with expected filename, original path, [Browse for PDF], [Cancel]
- D-24: No "open without PDF" option
- D-25: After successful re-link, `pdf.absolutePath/relativePath/sha256` updated in memory; dirty flips true; user must Ctrl+S to persist

**Re-link Sanity Checks (D-26 … D-28):**
- D-26: Different page count = hard abort with [Pick again] / [Cancel]
- D-27: Matching page count, mismatched per-page dimensions = warn + allow proceed
- D-28: Hash mismatch on successful re-link fires D-12 warning

### Claude's Discretion

- Exact `projectStore` shape (new Zustand slice) and dirty-flag flip strategy (subscription vs explicit)
- IPC handler naming (follow existing `dialog:openPdf` convention)
- Where path-math runs (must be main process — Node only)
- Hash computation timing / streaming strategy for large PDFs
- Exact styling of PDF-not-found and close-warning modals (follow existing popup patterns)
- Close-warning implementation: Electron-native `dialog.showMessageBox` vs in-renderer React modal (recommend in-renderer)
- "Open" button label (recommend "Open" always)
- Migration stub shape — no-op for v1

### Deferred Ideas (OUT OF SCOPE)

- Recent files list (Phase 6 or v2)
- Welcome / empty-state screen (Phase 6)
- Auto-save / `.clmc.recover` recovery file
- Open project without PDF (read-only mode)
- Cloud sync, multi-window editing, app-level preferences file
- Export/import categories as reusable preset (v2 item library — LIB-01)
- Schema migration tooling (seam lands now, real work on v2)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PERS-01** | User can save the current project (PDF file reference + all markup positions + per-page scale) to a `.clmc` project file | File schema (CONTEXT D-01..D-09), Zustand snapshot pattern (§Architecture Patterns), SHA256 streaming (§Don't Hand-Roll), Electron `showSaveDialog` (§Code Examples), dirty-flag wiring (§Architecture Patterns → Pattern 3) |
| **PERS-02** | User can reopen a `.clmc` project file and continue marking up where they left off | Hydration pattern (§Architecture Patterns → Pattern 2), `path.resolve` + absolute/relative fallback (§Common Pitfalls Pitfall 4), hash verification (§Code Examples), re-link flow (CONTEXT D-23..D-28), `usePdfDocument` refactor (§Architecture Patterns → Pattern 4) |

Both must pass by end of Phase 4.

---

## Project Constraints (from CLAUDE.md)

- **Platform:** Windows desktop, must run as installed Windows app (.exe)
- **Offline:** No internet dependency for core features — rules out remote validation APIs, cloud schemas, remote telemetry for file operations
- **Stack (locked):** Electron 35 + React 19 + TypeScript 5 + electron-vite 3, Zustand 5, pdfjs-dist 5.5.x, Konva 10.2.x + react-konva 19.2.x
- **Markup persistence precision:** All markups must stay precisely positioned when zooming — implies zero coordinate transform on save/load (markups already stored in normalized 0–1 page space, so `JSON.stringify(markup)` round-trips cleanly)
- **No new runtime dependencies for this phase:** `crypto`, `fs`, `path`, `dialog` are all Node/Electron built-ins. Do NOT add `ajv`, `zod`, `yup`, `joi`, etc. — hand-rolled type guards are sufficient for a single trusted file format
- **IPC boundary:** main process owns `fs` + `dialog` + `path` + `crypto`; renderer only via `window.api.*`
- **Inline styles on UI chrome** (established convention, not Tailwind on canvas-adjacent components)
- **Zustand store per concern** (new `projectStore.ts` alongside `markupStore/scaleStore/viewerStore`)
- **Primitive-field selectors with stable fallbacks** mandatory (commit `0e1a8e0` pattern — see `EMPTY_MARKUPS`)
- **No CSS modules, Tailwind, or styled-components on popups/modals** — reuse `ScalePopup` / `MarkupNamePopup` inline-style pattern with `COLORS` constants
- **GSD enforcement:** All edits must route through a GSD command (this research is doing exactly that)

---

## Standard Stack

### Core (all already installed — zero new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node `fs/promises` | Node 22 (bundled by Electron 35) | `readFile`, `writeFile` for `.clmc` + PDF bytes | Native, async, already used in `ipc-handlers.ts` |
| Node `fs` (stream) | Node 22 | `createReadStream` for large-PDF SHA256 | Required for >200MB PDFs to avoid loading into memory |
| Node `crypto` | Node 22 | `createHash('sha256')` for PDF fingerprint | Native; Node's crypto is OpenSSL-backed, fast (tens of MB/s single-threaded) |
| Node `path` | Node 22 | `path.relative`, `path.resolve`, `path.basename`, `path.dirname`, `path.extname` | Native; handles Windows drive semantics correctly when using `path.win32` or default on win32 |
| Electron `dialog` | 35.x | `showSaveDialog`, `showOpenDialog` | Native OS file pickers; already used for PDF open |
| Electron `BrowserWindow` | 35.x | `'close'` event with `preventDefault()` for dirty-guard | Standard close-interception pattern |
| Electron `app` | 35.x | `'before-quit'` event for app-level quit guard | Distinguishes window-close from app-quit |
| Electron `ipcMain.handle` / `ipcRenderer.invoke` / `contextBridge` | 35.x | IPC triad for all new main-process actions | Already in use; follow `dialog:openPdf` pattern |
| Zustand 5 | 5.0.12 | `useMarkupStore.getState()` snapshot; `.subscribe()` for dirty detection | Already in use; `getState()` is the canonical one-shot read |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pdfjs-dist` | 5.5.207 | Re-render PDF bytes on `.clmc` open | Only for the post-hydration render step; reuse existing `loadPdf` function |
| React 19 + `useState`/`useEffect` | 19.2.1 | Modal lifecycle (close-warning, missing-PDF, hash-mismatch) | All popups use parent-owned lifecycle pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| Hand-rolled type guards | `zod` 3.x (~14 kB gz) | Runtime parsing + type inference from schema | **REJECT for v1**. Single trusted file format, one parse path, no external input. Adds bundle bytes for marginal safety. Revisit if schema grows past ~10 fields or public import is added. |
| Hand-rolled type guards | `ajv` 8.x + JSON schema | Industry-standard validator, great errors | **REJECT for v1**. Overkill for a file the app itself wrote last time. |
| Zustand `persist` middleware | Manual `getState()` + `JSON.stringify` | Hooking `persist` to `.clmc` would conflate app-prefs persistence with project-file persistence | **REJECT for `.clmc`** (locked by CONTEXT). `persist` is acceptable for app-level prefs (globalUnit, window size) — out of scope for Phase 4 |
| Node `crypto.createHash` streaming | `sha.js` / WebCrypto in renderer | WebCrypto `crypto.subtle.digest` works in renderer but requires loading entire PDF into an `ArrayBuffer` — bad for 200MB files; also requires IPC-marshalling bytes | **REJECT**. Main-process streaming via `fs.createReadStream` is canonical and lives where the file already is. |
| Electron-native `dialog.showMessageBox` for close-warning | In-renderer React modal | Native looks consistent with OS; React modal looks consistent with rest of app | **RECOMMEND React modal** per CONTEXT note — visual consistency with ScalePopup / MarkupNamePopup. Electron-native is fine-but-acceptable if focus/keyboard handling proves annoying. |
| `crypto.randomUUID()` (already used in markupStore) for file IDs | `nanoid` | Works in Node and in browser; already stable in codebase | **KEEP `crypto.randomUUID()`** — already in use for category IDs. No additional UUIDs are expected in the `.clmc` file format. |

**Installation:** Nothing new to install.

**Version verification (all confirmed installed via package.json):**
- electron: ^35.7.5
- react: ^19.2.1
- zustand: ^5.0.12
- pdfjs-dist: ^5.5.207
- konva: ^10.2.3
- typescript: ^5.9.3
- vitest: ^4.1.1
- jsdom: ^29.0.2

---

## Architecture Patterns

### Recommended File Layout

```
src/
├── main/
│   ├── ipc-handlers.ts          # Extend with project IPC handlers
│   └── project-io.ts            # NEW: fs read/write, hash, path helpers (main-only, Node APIs)
├── preload/
│   ├── index.ts                 # Extend with new window.api methods
│   └── index.d.ts               # Extend types
└── renderer/src/
    ├── stores/
    │   └── projectStore.ts      # NEW: currentFilePath, isDirty, lastSavedAt + actions
    ├── hooks/
    │   ├── usePdfDocument.ts    # REFACTOR: factor openPdfDialog → loadPdfFromPath(path) + openPdfDialog()
    │   ├── useProject.ts        # NEW: save/saveAs/open/newProject actions
    │   └── useCloseGuard.ts     # NEW: window.onbeforeunload/IPC close-request wiring
    ├── components/
    │   ├── SaveCloseModal.tsx   # NEW: Save/Discard/Cancel modal (D-16)
    │   ├── MissingPdfModal.tsx  # NEW: PDF-not-found with [Browse] / [Cancel] (D-23)
    │   ├── HashMismatchModal.tsx# NEW: warn + [Open anyway] / [Cancel] (D-12)
    │   └── DimensionMismatchModal.tsx # NEW: warn per D-27 (could fold into HashMismatch if layout works)
    ├── lib/
    │   ├── project-schema.ts    # NEW: ProjectFileV1 type + validate() + migrate(data, fromVersion) seam
    │   └── project-serialize.ts # NEW: snapshotStores() + hydrateStores(data) — pure functions
    └── tests/
        ├── project-schema.test.ts      # schema round-trip, migration seam
        ├── project-serialize.test.ts   # snapshot excludes transient fields
        └── project-path-math.test.ts   # path.relative edge cases (if testable in Node)
```

Separation `project-io.ts` (main) vs `project-schema.ts` / `project-serialize.ts` (renderer) keeps fs/crypto out of the renderer and keeps pure serialization testable under Vitest's `environment: 'node'`.

### Pattern 1: IPC Handler Triad (existing convention)

Every new main-process capability needs three files updated. This is mechanical.

```typescript
// src/main/ipc-handlers.ts
ipcMain.handle('dialog:saveProject', async (event, defaultPath?: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)!
  const result = await dialog.showSaveDialog(win, {
    title: 'Save Project',
    defaultPath,
    filters: [{ name: 'CLMC Project Files', extensions: ['clmc'] }],
    properties: ['showOverwriteConfirmation'] // macOS/Linux; Windows native dialog auto-confirms overwrite
  })
  if (result.canceled || !result.filePath) return null
  return result.filePath
})

ipcMain.handle('file:writeProject', async (_event, filePath: string, jsonText: string) => {
  await writeFile(filePath, jsonText, 'utf-8')
  return { ok: true }
})

ipcMain.handle('file:hashPdf', async (_event, pdfPath: string): Promise<string> => {
  return await sha256File(pdfPath) // see Code Examples below
})
```

```typescript
// src/preload/index.ts
const api = {
  openPdf: () => ipcRenderer.invoke('dialog:openPdf'),
  openProject: () => ipcRenderer.invoke('dialog:openProject'),     // returns filePath|null
  saveProjectDialog: (defaultPath?: string) =>
    ipcRenderer.invoke('dialog:saveProject', defaultPath),          // returns filePath|null
  readProject: (path: string) => ipcRenderer.invoke('file:readProject', path),
  writeProject: (path: string, json: string) =>
    ipcRenderer.invoke('file:writeProject', path, json),
  hashPdf: (path: string) => ipcRenderer.invoke('file:hashPdf', path),
  checkExists: (path: string) => ipcRenderer.invoke('file:checkExists', path),
  // Close-guard support:
  onCloseRequest: (cb: () => void) => ipcRenderer.on('app:close-request', cb),
  confirmClose: () => ipcRenderer.send('app:confirm-close')
}
contextBridge.exposeInMainWorld('api', api)
```

**Source:** Existing `ipc-handlers.ts` + `preload/index.ts` + `preload/index.d.ts` pattern

### Pattern 2: Hydrate-from-File (Open `.clmc`)

Strict one-direction flow: parse → validate → migrate → per-store hydrate → render PDF.

```
1. Read file bytes (main) → return JSON string (renderer)
2. JSON.parse → raw: unknown
3. validate(raw) → ProjectFile (type-narrowed) OR throw descriptive error
4. migrate(raw, raw.formatVersion) → always returns latest-shape ProjectFile (v1: no-op)
5. Resolve PDF path: try absolutePath first, then path.resolve(dirname(clmcPath), relativePath)
6. If neither exists: show MissingPdfModal(expectedName, originalPath, onBrowse, onCancel)
7. Hash the resolved PDF (via IPC). Compare against data.pdf.sha256.
   Mismatch → show HashMismatchModal; if user cancels, abort open.
8. Load PDF bytes → pdfjs render (existing loadPdf function)
9. Compare per-page dimensions → if mismatch, show DimensionMismatchModal (warn-only)
10. Hydrate stores — each via a single set() per store to prevent intermediate re-renders
11. projectStore.setCurrentFilePath(clmcPath); projectStore.setDirty(false)
```

**Critical:** Do NOT flip `isDirty=true` during hydration. Temporarily suspend the dirty-flag subscription or use a dedicated `hydrate()` action on each store that writes state without triggering the subscribe-based dirty flip.

### Pattern 3: Dirty-Flag Wiring (recommended)

**Recommendation: `zustand.subscribe` + selector with equality check, NOT explicit `markDirty()` calls.**

Why subscribe-based over explicit:
- One wire-up in `projectStore` vs. sprinkling `markDirty()` in every mutating action across 3 stores
- Impossible to forget (new actions in Phase 5 BOQ export, Phase 6 UI polish automatically covered)
- Easy to suspend during hydration via a module-level `_hydrating = true` guard

Pattern:

```typescript
// projectStore.ts (sketch)
let _hydrating = false

export const suspendDirtyTracking = () => { _hydrating = true }
export const resumeDirtyTracking = () => { _hydrating = false }

const markDirty = () => {
  if (_hydrating) return
  if (useProjectStore.getState().isDirty) return  // already dirty, skip set
  useProjectStore.setState({ isDirty: true })
}

// Wire subscriptions ONCE at app startup (e.g., in App.tsx or projectStore module init):
useMarkupStore.subscribe(
  (s) => ({ pageMarkups: s.pageMarkups, categories: s.categories, categoryOrder: s.categoryOrder }),
  markDirty,
  { equalityFn: shallow }
)
useScaleStore.subscribe(
  (s) => ({ pageScales: s.pageScales, globalUnit: s.globalUnit }),
  markDirty,
  { equalityFn: shallow }
)
useViewerStore.subscribe(
  (s) => ({ pageViewports: s.pageViewports, currentPage: s.currentPage }),
  markDirty,
  { equalityFn: shallow }
)
```

**Caveat (HIGH confidence):** `zustand/v5` default `subscribe` does NOT take a selector — you must either use `subscribeWithSelector` middleware, or call `.subscribe(listener)` and do the diff yourself. Prefer `subscribeWithSelector` (first-party, tiny). Alternatively: a single `subscribe` at the raw-state level diffing the three relevant top-level keys manually.

**Reset on save:**
```typescript
// In projectStore.save():
// ... write file via IPC ...
set({ currentFilePath: path, isDirty: false, lastSavedAt: Date.now() })
```

**Reset on open/new:**
After hydrate: `resumeDirtyTracking(); setState({ isDirty: false })`.

### Pattern 4: Refactor `usePdfDocument.openPdfDialog`

Current `openPdfDialog` calls `window.api.openPdf()` (which returns `{ filePath, data }`) then `loadPdf(data, filePath)`. For `.clmc` open we only have a `filePath` — bytes must be fetched separately.

**Refactor shape:**
```typescript
// usePdfDocument.ts
const loadPdfFromPath = useCallback(async (pdfPath: string) => {
  const data = await window.api.readPdfBytes(pdfPath)  // new IPC
  return loadPdf(data, pdfPath)
}, [loadPdf])

const openPdfDialog = useCallback(async () => {
  const result = await window.api.openPdf()  // unchanged
  if (!result) return null
  return loadPdf(result.data, result.filePath)
}, [loadPdf])

return { loadPdf, loadPdfFromPath, openPdfDialog }
```

This keeps the existing picker+render path identical and adds one new path. `useProject.openClmc(clmcPath)` calls `loadPdfFromPath(resolvedPdfPath)` after hydration.

**Alternative:** add a new main-process handler `file:readPdfBytes(path)` that mirrors the second half of `dialog:openPdf`. Consistent with separation of concerns (picker vs read).

### Pattern 5: Close-Window Coordination

Two scenarios to handle: user clicks window X, and OS/user initiates app quit.

**Recommended flow (in-renderer modal):**

```typescript
// main/index.ts
mainWindow.on('close', (event) => {
  // Always prevent, delegate to renderer
  if (!canClose) {  // canClose is a module-level flag set by ipcMain.on('app:confirm-close')
    event.preventDefault()
    mainWindow.webContents.send('app:close-request')
  }
})

ipcMain.on('app:confirm-close', () => {
  canClose = true
  mainWindow.close()
})
```

```typescript
// renderer: useCloseGuard.ts
useEffect(() => {
  const handler = () => {
    const { isDirty } = useProjectStore.getState()
    if (!isDirty) {
      window.api.confirmClose()
      return
    }
    // open SaveCloseModal; resolve with user choice:
    //  - Save: run save; on success → confirmClose()
    //  - Discard: confirmClose()
    //  - Cancel: do nothing (stays open)
  }
  window.api.onCloseRequest(handler)
  return () => window.api.offCloseRequest(handler)  // if exposed
}, [])
```

**Why not `window.onbeforeunload` in renderer?** Electron supports it, but:
- It runs in the renderer where we also need to draw the React modal — async coordination between the native "are you sure?" dialog and a React modal is messy.
- Using `BrowserWindow.on('close')` + IPC round-trip gives us full control, including styling the modal with our app's look.

**`before-quit` handling** (for Cmd+Q on macOS, OS shutdown, or app.quit() calls):
```typescript
// main/index.ts
let isQuitting = false
app.on('before-quit', () => { isQuitting = true })

mainWindow.on('close', (event) => {
  if (canClose) return  // renderer confirmed
  event.preventDefault()
  mainWindow.webContents.send('app:close-request', { isQuitting })
})
```

On Windows primarily matters for: right-click taskbar → Close window, Alt+F4, System menu Close. All route through BrowserWindow `'close'`.

### Anti-Patterns to Avoid

- **Writing the file directly from renderer** — sandbox forbids; must go through IPC handler in main.
- **Using `JSON.stringify(useMarkupStore.getState())` directly** — serializes Zustand actions as `undefined` (functions) and includes internal fields. Build an explicit `snapshotStores()` that picks fields listed in D-02.
- **Hashing the PDF in the renderer via WebCrypto** — requires loading full bytes into an ArrayBuffer and marshalling across IPC. Streaming in main is faster and leaner for 100+ MB files.
- **Calling `useMarkupStore.getState()` inside a React render** — safe outside render, but inside a `useMemo` without proper deps is a subscription blindness bug. Use hooks for reactive reads, `getState()` only in event handlers and save/load actions.
- **`JSON.stringify(data, null, 2)` on every save** — fine for humans grepping, costs a few bytes. The 2-space indent IS worth it for debuggability and git-diff-friendliness (though `.clmc` files aren't expected to be in git). Recommend pretty-printed.
- **Blocking the renderer during hash compute** — hash runs in main via IPC, fire-and-await; renderer can show a spinner if needed. For PDFs up to ~100 MB on typical SSD, expect <500ms (see Common Pitfalls Pitfall 3).
- **Hydrating stores with three separate `set()` calls per field** — causes three re-renders. Use one `set()` per store with the full replacement object.
- **Forgetting to reset `undoStack`/`redoStack` on open** — they're excluded from the file, but in-memory stacks from a previous project would leak into the new one. Clear them explicitly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA256 of a file | Your own chunking loop with `hash.update` in a tight loop | `fs.createReadStream(path).pipe(crypto.createHash('sha256'))` + event | Stream backpressure is handled; OpenSSL binding does the heavy lifting. See Code Examples. |
| Overwrite confirmation on Windows | Custom pre-save dialog asking "overwrite?" | Let `dialog.showSaveDialog` delegate to the native Windows Save dialog | Windows' native Save dialog auto-prompts for overwrite; Electron's `showOverwriteConfirmation` option is Linux-only but not needed because Windows does it natively. Confirmed against Electron docs. |
| Default filename synthesis for Save As | Manual string concat with `\` or `/` | `path.join(path.dirname(pdfPath), path.basename(pdfPath, '.pdf') + '.clmc')` | Cross-drive safe; handles trailing separators; Unicode-safe |
| Relative path computation | String manipulation on `\` / `/` | `path.relative(dirname(clmcPath), pdfPath)` | Handles Windows drive-letter semantics; returns absolute path if cross-drive (which we WANT — we fall back to absolute) |
| JSON schema validation | Custom recursive field-by-field checker | Minimal type guards: `if (typeof x.formatVersion !== 'number') throw …` | For a single trusted format with ~10 top-level fields, hand-rolled guards are smaller and more readable than zod/ajv overhead |
| Dirty-flag tracking | Explicit `markDirty()` in every mutating action | `zustand.subscribeWithSelector` on field groups | One wire-up site; forgetting is impossible; new fields in future phases auto-tracked |
| File-extension routing on Open | Manual `path.extname(p).toLowerCase()` logic in renderer | Use `path.extname(p).toLowerCase()` — it IS the answer; just do it in main process where `path` lives natively | Main already has `path`; one IPC return value carries `{ filePath, extension }` |

**Key insight:** Every piece of Phase 4 plumbing maps 1:1 to a Node/Electron built-in. The temptation is to reinvent small pieces (path separators, hashing loops, overwrite prompts) — all three misuse their built-ins. Lean on the platform.

---

## Runtime State Inventory

Phase 4 is NOT a rename/refactor phase. This section is **NOT APPLICABLE**.

However, there IS a session-lifecycle concern worth flagging: on `open` of a new `.clmc`, the in-memory state from any previous project must be fully cleared. The cleanups needed:

| Category | State to Clear | Action Required |
|----------|----------------|-----------------|
| Zustand in-memory | `markupStore.undoStack`, `markupStore.redoStack` | Explicit reset in open action (excluded from file by D-09) |
| Zustand in-memory | `scaleStore.calibMode` | Set to `'idle'` |
| Zustand in-memory | `viewerStore.activeTool` | Set to `'select'` |
| Zustand in-memory | `viewerStore.pdfDocument` | Call `prevDoc.destroy()` (existing pattern in `usePdfDocument.loadPdf`) |
| React UI state | Open popups, context menus, tooltips | Parent-owned lifecycle — unmount on project change |

Current `setFile` in `viewerStore` (line 14) partially does this but only for viewer-level state. The `useProject.newProject()` / `useProject.openClmc()` flow must also reset `markupStore` and `scaleStore` — add explicit `reset()` actions to those stores and call them from the project actions.

---

## Common Pitfalls

### Pitfall 1: Dirty Flag Flips During Hydration

**What goes wrong:** On `.clmc` open, the hydrate step writes to `markupStore.pageMarkups`, `scaleStore.pageScales`, etc. The subscribe-based dirty detector fires on every write → project opens with `isDirty=true` → title shows asterisk immediately.

**Why it happens:** Subscription listener doesn't know "this write came from hydrate, not a user action."

**How to avoid:** Module-level `_hydrating = true` guard (see Pattern 3 code). Set before first hydrate write, unset after last. The `markDirty()` function checks this flag and bails. Set `isDirty=false` explicitly after hydration completes.

**Warning signs:** Open a freshly-saved file → title shows `filename.clmc *` without any edits. Test: open a `.clmc` and assert `isDirty === false`.

### Pitfall 2: Large Intermediate Re-renders During Hydrate

**What goes wrong:** Hydrate loops over pages and calls `markupStore.placeMarkup` for each markup (or equivalent). For a project with 1,000 markups, that's 1,000 state updates → 1,000 re-renders → visible jank.

**Why it happens:** Each `set()` triggers a re-render of anything subscribed.

**How to avoid:** Add a single `markupStore.hydrate(pageMarkups, categories, categoryOrder)` action that does ONE `set()` with the full shape. Likewise `scaleStore.hydrate(pageScales, globalUnit)` and `viewerStore.hydrate(currentPage, pageViewports)`. These bypass the command-pattern undo machinery and any validation.

**Warning signs:** Slow open on medium projects. Use React DevTools Profiler or `console.time` around the open action.

### Pitfall 3: SHA256 Blocking the Main Process

**What goes wrong:** `const data = await readFile(pdfPath); const hash = crypto.createHash('sha256').update(data).digest('hex')` on a 200 MB PDF allocates a 200 MB Buffer, then blocks the main thread during `.update()`. Renderer freezes.

**Why it happens:** `readFile` buffers the whole thing; `.update()` on a huge buffer is sync crunching.

**How to avoid:** Use `fs.createReadStream(pdfPath)` → pipe into `crypto.createHash('sha256')` → resolve a Promise on `'end'`. Streaming processes the file in Node's default 64 KB chunks, letting the event loop breathe. OpenSSL binding is non-blocking per chunk. Throughput expectation on modern SSD + Node 22: **300–800 MB/s for SHA256** (CPU-bound, not IO-bound on SSD). 10 MB ≈ 15–30 ms; 100 MB ≈ 150–300 ms; 200 MB ≈ 300–600 ms. These are comfortable for a blocking IPC call; no spinner needed below ~100 MB.

**Warning signs:** Opening a large PDF hangs the UI. Test with a synthetic 200 MB PDF (easy to make via `dd` on WSL).

**Source:** [Node.js crypto docs](https://nodejs.org/api/crypto.html), [Node.js performance issue #136](https://github.com/nodejs/performance/issues/136)

### Pitfall 4: `path.relative` Across Drives on Windows

**What goes wrong:** `plans.clmc` is on `D:\`, PDF is on `C:\`. `path.relative('D:\\projects', 'C:\\plans.pdf')` returns `'C:\\plans.pdf'` (absolute) — NOT `'../..'` or any relative form. Trying to blindly resolve this from `D:\projects` at open time works correctly BUT the "portable zip" promise is broken silently.

**Why it happens:** Relative paths between different roots are mathematically impossible. Node returns an absolute path in that case.

**How to avoid:**
1. On save, detect cross-drive case: `if (path.parse(pdfPath).root !== path.parse(clmcPath).root)` → set `relativePath = null` or store as empty string, log a dev-console note.
2. Document in the file that `relativePath === null` means "cross-drive at save time; absolute only."
3. On open, if `relativePath` is null/empty, skip the relative fallback entirely.
4. **UNC paths** (`\\server\share\foo.pdf`): `path.parse` returns the UNC root; same-root UNC → relative works. UNC + local drive → cross-drive case above.
5. **Paths with Unicode** (`C:\проекты\plans.pdf`): `fs` handles UTF-16 on Windows internally; Node APIs accept/return strings as UTF-8; round-trip is safe through `JSON.stringify`/`JSON.parse`.
6. **Paths with spaces** (`C:\My Projects\plans.pdf`): no special handling; JSON escapes nothing; `fs` handles them natively. Non-issue.

**Warning signs:** Cross-drive test: save a project with PDF on `C:\` and project file on `D:\`; rename PDF; reopen; verify missing-PDF modal fires (rather than accidentally loading a stale relative target).

**Source:** [Node.js path docs](https://nodejs.org/api/path.html), cross-platform-node-guide

### Pitfall 5: Window Close Race Condition

**What goes wrong:** User clicks X → `close` event fires → renderer shows modal → user picks "Save" → renderer calls IPC to save → meanwhile `close` event finished processing → Electron defaults to closing → window gone before save resolves.

**Why it happens:** `event.preventDefault()` in the `close` handler only blocks THIS event. If the renderer is asynchronous, we need to explicitly re-close the window after the async work.

**How to avoid:** Use a module-level `canClose = false` flag in main. `close` handler always `preventDefault()`s unless `canClose === true`. Renderer, after finishing its async flow (save succeeds OR user clicks Discard), sends `ipcRenderer.send('app:confirm-close')` which sets `canClose = true` and calls `mainWindow.close()` again. Second close event passes through. See Pattern 5 above.

**Warning signs:** Sometimes the window disappears mid-save. Test: add dirty state, click X, observe whether save-then-close sequence is atomic.

**Source:** [Matthias Sommer — Two ways to react on the Electron 'close' event](https://www.matthiassommer.it/programming/frontend/two-ways-to-react-on-the-electron-close-event/), [electron/electron#3362](https://github.com/electron/electron/issues/3362)

### Pitfall 6: File Extension Double-Appending on Windows

**What goes wrong:** User types `plans` in Save As dialog (extension hidden by Windows Explorer default). Electron returns `C:\projects\plans` (no extension). App writes to that path. Next time user double-clicks `plans.clmc` in Explorer — Windows doesn't know to open it with CLMC Takeoff.

**Why it happens:** `showSaveDialog` with filters doesn't force-append the filter's extension on Windows; it offers the filter UI but the user can leave the typed name bare or with any extension.

**How to avoid:** After dialog returns `filePath`, check `path.extname(filePath).toLowerCase() !== '.clmc'` → append `.clmc`. Do this in main, before writing. This mirrors the behavior of apps like VS Code and makes the file reliably double-click-openable.

**Warning signs:** Saved `.clmc` files sometimes have no extension. Windows Explorer shows them as generic files.

**Source:** [electron/electron#9455 — incorrect file extension with dialog.showSaveDialog when filters is used](https://github.com/electron/electron/issues/9455)

### Pitfall 7: Dimension Mismatch Due to PDF Rotation

**What goes wrong:** Saved `dimensions.width = 595` (A4 portrait, no rotation). Architect republishes with `/Rotate: 90` applied. On open, `viewport.width = 842` (swapped) → dimension mismatch warning fires even though geometry is identical.

**Why it happens:** PDF.js `page.getViewport({ scale: 1, rotation: 0 })` returns the unrotated bounding box, but pages often carry a `/Rotate` entry that PDF.js applies by default (`rotation: page.rotate`).

**How to avoid:** On save AND open, always use `page.getViewport({ scale: 1, rotation: 0 })` — the un-rotated natural dimensions. The comparison is then rotation-invariant. (Or: also serialize `rotation` from the PDF and compare — but simpler to normalize at both ends.)

**Warning signs:** Dimension mismatch modal fires on a PDF that "looks" the same as the one saved.

**Source:** STATE.md Critical Pitfalls: "Rotated pages: Pages with `/Rotate: 90` swap width/height."

### Pitfall 8: JSON.stringify Drops Functions Silently

**What goes wrong:** `JSON.stringify(useMarkupStore.getState())` includes the action functions (`placeMarkup`, `undo`, etc.) as `undefined` in output — they disappear cleanly. But `JSON.stringify` ALSO drops `undefined` values in objects, which means if the snapshot object has legitimate `undefined` values (e.g. an uninitialized field), they're silently lost.

**Why it happens:** JSON spec has no representation for `undefined`; `stringify` drops them.

**How to avoid:** Build the snapshot object explicitly — `{ pageMarkups: state.pageMarkups, ... }` — never spread the whole state. Use `null` (not `undefined`) for "not set" fields (e.g. `scale: null` per D-02). TypeScript types should use `T | null`, not `T | undefined`, throughout the file-schema types.

**Warning signs:** A field documented in D-02 is missing from the written file; loading shows "can't read property X of undefined."

### Pitfall 9: Mutating Zustand State During Snapshot

**What goes wrong:** The snapshot grabs object references (`state.pageMarkups`). A few milliseconds later the user places another markup → Zustand creates a new `pageMarkups` object (good) but references passed to `JSON.stringify` are the OLD one (fine, it's frozen in time). Except if the snapshot is passed through an async `IPC.invoke` then `JSON.stringify`ed inside main — still fine since JSON is structured clone.

**Not actually a pitfall in this codebase** (Zustand returns new object refs on set — no in-place mutation). Flagging it as NON-issue so planner doesn't over-engineer. JSON.stringify happens in renderer (fast), only the string travels over IPC.

### Pitfall 10: `ipcRenderer.on` Listener Leak

**What goes wrong:** `useCloseGuard` registers `onCloseRequest` via `window.api.onCloseRequest(cb)`. Component unmounts, re-mounts → second listener registered. Now the modal opens twice on X click.

**Why it happens:** `ipcRenderer.on` adds without replacing; there's no auto-cleanup.

**How to avoid:** Expose `offCloseRequest(cb)` in preload, call it in useEffect cleanup. Or use `ipcRenderer.once` / `ipcRenderer.removeListener`. Or register ONCE at top-level (App.tsx) rather than inside a hook that can remount.

**Warning signs:** Save/Discard modal opens N times after rapid mount/unmount cycles.

---

## Code Examples

### Streaming SHA256 in Main Process

```typescript
// src/main/project-io.ts
import { createReadStream } from 'fs'
import { createHash } from 'crypto'

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
```

**Source:** [Node.js crypto docs](https://nodejs.org/api/crypto.html), standard pattern. HIGH confidence.

### Save Dialog with Extension Enforcement

```typescript
// src/main/ipc-handlers.ts
import { extname } from 'path'

ipcMain.handle('dialog:saveProject', async (event, defaultPath?: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)!
  const result = await dialog.showSaveDialog(win, {
    title: 'Save Project',
    defaultPath,
    filters: [{ name: 'CLMC Project', extensions: ['clmc'] }]
    // Windows auto-confirms overwrite via native dialog;
    // showOverwriteConfirmation property is Linux-only and not needed.
  })
  if (result.canceled || !result.filePath) return null
  // Enforce .clmc extension (Windows users often have extensions hidden
  // and may type 'plans' without it — Pitfall 6).
  let filePath = result.filePath
  if (extname(filePath).toLowerCase() !== '.clmc') filePath += '.clmc'
  return filePath
})
```

**Source:** Existing `dialog:openPdf` handler pattern + [Electron dialog docs](https://www.electronjs.org/docs/latest/api/dialog). HIGH confidence.

### Extension-Sniffing Open Dialog

```typescript
// src/main/ipc-handlers.ts
import { extname, basename } from 'path'

ipcMain.handle('dialog:openProject', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)!
  const result = await dialog.showOpenDialog(win, {
    title: 'Open',
    filters: [
      { name: 'Supported', extensions: ['pdf', 'clmc'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'CLMC Project', extensions: ['clmc'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const ext = extname(filePath).toLowerCase() // '.pdf' or '.clmc'
  return { filePath, extension: ext, fileName: basename(filePath) }
})
```

**Source:** Existing `dialog:openPdf` handler pattern + [Electron dialog.showOpenDialog docs](https://www.electronjs.org/docs/latest/api/dialog). HIGH confidence.

### Store Snapshot (Explicit Field Pick)

```typescript
// src/renderer/src/lib/project-serialize.ts
import type { ProjectFileV1 } from './project-schema'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'

export function snapshotProject(params: {
  pdfAbsolutePath: string
  pdfRelativePath: string | null
  pdfSha256: string
  pdfTotalPages: number
  perPageDimensions: Record<number, { width: number; height: number }>
  createdAt?: string
}): ProjectFileV1 {
  const markup = useMarkupStore.getState()
  const scale = useScaleStore.getState()
  const viewer = useViewerStore.getState()

  const now = new Date().toISOString()
  const pages = Array.from({ length: viewer.totalPages }, (_, i) => {
    const pageIndex = i + 1
    return {
      pageIndex,
      dimensions: params.perPageDimensions[pageIndex] ?? { width: 0, height: 0 },
      scale: scale.pageScales[pageIndex] ?? null,
      viewport: viewer.pageViewports[pageIndex] ?? { zoom: 1, panX: 0, panY: 0 },
      markups: markup.pageMarkups[pageIndex] ?? []
    }
  })

  return {
    formatVersion: 1,
    createdAt: params.createdAt ?? now,
    updatedAt: now,
    pdf: {
      absolutePath: params.pdfAbsolutePath,
      relativePath: params.pdfRelativePath,
      totalPages: params.pdfTotalPages,
      sha256: params.pdfSha256
    },
    globalUnit: scale.globalUnit,
    categories: markup.categories,
    categoryOrder: markup.categoryOrder,
    currentPage: viewer.currentPage,
    pages
  }
}
```

**Source:** Composition of CONTEXT D-02 schema + existing store shapes. HIGH confidence.

### Migration Seam (v1 no-op)

```typescript
// src/renderer/src/lib/project-schema.ts
export interface ProjectFileV1 {
  formatVersion: 1
  createdAt: string
  updatedAt: string
  pdf: { absolutePath: string; relativePath: string | null; totalPages: number; sha256: string }
  globalUnit: 'm' | 'ft' | 'mm' | 'cm' | 'in'
  categories: Record<string, { id: string; name: string; color: string; paletteIndex: number }>
  categoryOrder: string[]
  currentPage: number
  pages: Array<{
    pageIndex: number
    dimensions: { width: number; height: number }
    scale: { pixelsPerMm: number; displayUnit: 'm' | 'ft' | 'mm' | 'cm' | 'in' } | null
    viewport: { zoom: number; panX: number; panY: number }
    markups: Markup[]  // from types/markup.ts
  }>
}

export type ProjectFile = ProjectFileV1 // alias to current version

/**
 * Migrate stored data to the latest ProjectFile shape.
 * v1 is no-op. Future versions add cases.
 */
export function migrate(raw: unknown, fromVersion: number): ProjectFile {
  if (fromVersion === 1) return validateV1(raw)
  // case 0: throw — unsupported legacy format
  // case 2: /* migrate v2 → v3 */ break
  throw new Error(`Unsupported formatVersion: ${fromVersion}. Expected 1. File may be corrupt or from a newer app version.`)
}

function validateV1(raw: unknown): ProjectFileV1 {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid project file: not an object')
  const r = raw as Record<string, unknown>
  if (r.formatVersion !== 1) throw new Error(`Expected formatVersion 1, got ${r.formatVersion}`)
  if (typeof r.createdAt !== 'string') throw new Error('Invalid createdAt')
  if (typeof r.updatedAt !== 'string') throw new Error('Invalid updatedAt')
  if (!r.pdf || typeof r.pdf !== 'object') throw new Error('Missing pdf block')
  // ... continue for each required top-level field
  // NOTE: deep validation of pages[].markups[] may be expensive; minimal shape check is fine.
  return raw as ProjectFileV1
}
```

**Source:** [Salt & Pepper — Keep JSON schemas clean with migrations](https://saltandpepper.co/blog/keep-json-schemas-clean-with-migrations/) — simplified. HIGH confidence.

### Path Resolution with Fallback

```typescript
// src/main/project-io.ts
import { resolve, dirname, isAbsolute } from 'path'
import { existsSync } from 'fs'

export function resolvePdfPath(
  clmcFilePath: string,
  absolutePath: string,
  relativePath: string | null
): { resolvedPath: string; source: 'absolute' | 'relative' } | null {
  // 1. Try absolute
  if (absolutePath && existsSync(absolutePath)) {
    return { resolvedPath: absolutePath, source: 'absolute' }
  }
  // 2. Try relative, resolved against .clmc directory
  if (relativePath) {
    const resolved = isAbsolute(relativePath)
      ? relativePath  // defensive: if someone wrote an absolute in 'relativePath'
      : resolve(dirname(clmcFilePath), relativePath)
    if (existsSync(resolved)) {
      return { resolvedPath: resolved, source: 'relative' }
    }
  }
  return null // → show MissingPdfModal
}

export function computeRelativePath(
  clmcFilePath: string,
  pdfPath: string
): string | null {
  const { relative, parse } = require('path')
  // Cross-drive guard (Pitfall 4): path.relative returns absolute path in that case,
  // which is not useful as a "relative" fallback.
  if (parse(clmcFilePath).root !== parse(pdfPath).root) return null
  return relative(dirname(clmcFilePath), pdfPath)
}
```

**Source:** [Node.js path docs](https://nodejs.org/api/path.html). HIGH confidence.

### BrowserWindow Close Handler

```typescript
// src/main/index.ts (additions)
let canClose = false

mainWindow.on('close', (event) => {
  if (canClose) return
  event.preventDefault()
  mainWindow.webContents.send('app:close-request')
})

ipcMain.on('app:confirm-close', () => {
  canClose = true
  mainWindow.close()
})
```

```typescript
// src/renderer/src/hooks/useCloseGuard.ts
import { useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'

export function useCloseGuard(onCloseRequest: () => void): void {
  useEffect(() => {
    const handler = () => onCloseRequest()
    window.api.onCloseRequest(handler)
    return () => window.api.offCloseRequest?.(handler)
  }, [onCloseRequest])
}
// onCloseRequest shows SaveCloseModal; on resolution, calls window.api.confirmClose()
```

**Source:** [Electron BrowserWindow 'close' event docs](https://www.electronjs.org/docs/latest/api/browser-window), [Matthias Sommer on 'close' event](https://www.matthiassommer.it/programming/frontend/two-ways-to-react-on-the-electron-close-event/). HIGH confidence.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `remote` module for renderer→main dialogs | `ipcMain.handle` / `ipcRenderer.invoke` + `contextBridge` | Electron 14+ (2021) | Already in use in this codebase. Do not reintroduce `@electron/remote` |
| `nodeIntegration: true` | `contextIsolation: true` + preload script | Electron 12+ (2021) | Already set in `main/index.ts` line 26. Don't regress |
| `fs.readFileSync` for large files | `fs/promises.readFile` or streams | Node 10+ | Use streams for >10 MB PDFs |
| `JSON.stringify` with all state | Explicit field-pick snapshot | Always best practice | Applies here — Pitfall 8 |
| Zustand `persist` middleware for project files | Explicit save/load action | Locked by CONTEXT | `persist` still OK for app-level prefs (not in Phase 4 scope) |

**Deprecated/outdated (don't use):**
- `@electron/remote` — deprecated since Electron 14
- `webFrame.setSpellCheckProvider` and similar pre-contextBridge patterns
- Synchronous IPC (`ipcRenderer.sendSync`) — blocks renderer
- `crypto.createHash` called with a buffer of unbounded size — use streams for files >~10 MB

---

## Open Questions

### 1. Should `pages[]` be sparse or dense when `totalPages` is large but most pages are empty?

- **What we know:** CONTEXT D-02 shows a dense array (`pages: [pageIndex: 1, 2, 3, ...]`). Each page entry carries `markups: []` when empty. For a 50-page plan set with markups on 3 pages, that's 47 mostly-empty entries.
- **What's unclear:** File size impact (small per empty page: `{pageIndex, dimensions, scale: null, viewport, markups: []}` ≈ 120 bytes × 47 = ~6 KB — negligible). But it's wasted.
- **Recommendation:** Keep dense per D-02 decision; the ~6 KB overhead is invisible next to PDF sizes and markup data. Dense is grep-friendlier and easier to iterate on load. Flag for v2 if project files grow past ~1 MB without reason.

### 2. Should we persist PDF page `rotation` alongside `dimensions`?

- **What we know:** PDF pages can have a `/Rotate` entry (0, 90, 180, 270). Markups stored in normalized 0–1 page-space so rotation doesn't affect storage math. But display does.
- **What's unclear:** If a PDF is re-published with a changed rotation, should we warn? The CONTEXT D-27 dimension warning covers the geometric case, but a page that flipped rotation but kept the same bounding box would go undetected.
- **Recommendation:** Use un-rotated dimensions (`page.getViewport({ rotation: 0 })`) at both save and open to make the comparison rotation-invariant (Pitfall 7). This sidesteps the question without adding a field. If rotation-aware comparison is later needed, add `pages[].rotation` in a v2 schema migration.

### 3. Should `categories` be pruned on save to only categories actually used?

- **What we know:** D-06 says "preserves category identity, color stability, and empty categories." So empty categories are kept by design.
- **What's unclear:** Why? No explicit rationale beyond "category order stability."
- **Recommendation:** Follow D-06 literally (write all categories). If users hit a "category bloat" issue later, pruning can be added without a schema bump. Document this choice in code comment so it's not re-questioned.

### 4. What happens if `.clmc` file contains a markup referencing a `categoryId` that doesn't exist in `categories`?

- **What we know:** Shouldn't happen if app writes files correctly. Could happen if user edits JSON by hand, or if a future format migration has a bug.
- **What's unclear:** Current code would gracefully show the markup but `getCategory(id)` returns null (line 52 of markupStore). Display would just miss category-specific formatting — probably fine.
- **Recommendation:** On hydrate, scan `pages[].markups[]` for unknown `categoryId` values; if found, log a warning and either (a) create a synthetic "Uncategorized" category for them, or (b) let `getCategory` return null and rely on graceful degradation. Option (b) is simpler and aligns with existing null-check patterns throughout the codebase.

---

## Environment Availability

Phase 4 uses only Node built-ins and Electron APIs. No external binaries required.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node `fs/promises` | Read/write `.clmc`, read PDF bytes | ✓ | 22 (Electron 35 bundled) | — |
| Node `fs` (streams) | Streaming SHA256 for large PDFs | ✓ | 22 | — |
| Node `crypto.createHash('sha256')` | PDF fingerprint | ✓ | 22 | — |
| Node `path` (win32) | Relative/absolute resolution | ✓ | 22 | — |
| Electron `dialog` | Save/Open file pickers | ✓ | 35.7.5 | — |
| Electron `BrowserWindow` events | `'close'` preventDefault for dirty-guard | ✓ | 35.7.5 | — |
| Electron `ipcMain.handle` | New IPC handlers | ✓ | 35.7.5 | — |
| Zustand 5 `subscribeWithSelector` | Dirty-flag subscription | Uncertain | 5.0.12 | Implement manual diffing via raw `.subscribe(listener)` if middleware missing |
| Vitest 4 + jsdom 29 | Unit tests for schema, serialization, path math | ✓ | 4.1.1 / 29.0.2 | — |

**Missing dependencies with no fallback:** None.

**Verify before implementation:** Confirm `zustand/middleware` exports `subscribeWithSelector` in v5.0.12. If not, the plan should use raw `.subscribe(listener)` with manual state-diff equality check — same outcome, 3 more lines of code.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 + jsdom 29.0.2 |
| Config file | `vitest.config.ts` (at repo root) |
| Quick run command | `npx vitest run --reporter=default` |
| Full suite command | `npm test` (not defined — use `npx vitest run`) |
| Test file glob | `src/tests/**/*.test.ts` |

Existing test infrastructure covers stores (`markup-store.test.ts`, `scale-store.test.ts`, `viewer-store.test.ts`), math (`markup-math.test.ts`, `scale-math.test.ts`, `stage-transform.test.ts`, `zoom.test.ts`), and UI interaction (`markup-context-menu.test.ts`, `markup-namepopup.test.ts`, etc.). **No existing test covers file IO or IPC handlers.** Phase 4 tests will mostly live in renderer-side pure functions (schema, serialize, path math).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| **PERS-01** | Snapshot contains all required fields (D-02) | unit | `npx vitest run src/tests/project-serialize.test.ts -t "snapshot includes D-02 fields"` | ❌ Wave 0 |
| **PERS-01** | Snapshot excludes transient state (D-09: undoStack, redoStack, calibMode, activeTool) | unit | `npx vitest run src/tests/project-serialize.test.ts -t "excludes transient state"` | ❌ Wave 0 |
| **PERS-01** | JSON round-trip (serialize → parse → deep equal) | unit | `npx vitest run src/tests/project-schema.test.ts -t "round-trip"` | ❌ Wave 0 |
| **PERS-01** | SHA256 streaming matches sync computation for test PDF | unit | `npx vitest run src/tests/project-io.test.ts -t "sha256 stream equals buffer"` | ❌ Wave 0 (main-process test — may skip if vitest env='node' cleanly supports `crypto` + `fs` — it does) |
| **PERS-01** | `path.relative` cross-drive returns null via helper | unit | `npx vitest run src/tests/project-io.test.ts -t "cross-drive returns null"` | ❌ Wave 0 |
| **PERS-01** | Save-as extension enforcement appends `.clmc` when missing | unit | `npx vitest run src/tests/project-io.test.ts -t "enforces .clmc extension"` | ❌ Wave 0 |
| **PERS-01** | Dirty flag flips true on `markupStore.placeMarkup` | unit | `npx vitest run src/tests/project-store.test.ts -t "dirty on place"` | ❌ Wave 0 |
| **PERS-01** | Dirty flag stays false during hydrate | unit | `npx vitest run src/tests/project-store.test.ts -t "stays clean on hydrate"` | ❌ Wave 0 |
| **PERS-01** | Dirty flag resets to false on successful save | unit | `npx vitest run src/tests/project-store.test.ts -t "clean after save"` | ❌ Wave 0 |
| **PERS-02** | `migrate(data, 1)` is identity for valid v1 input | unit | `npx vitest run src/tests/project-schema.test.ts -t "migrate v1 identity"` | ❌ Wave 0 |
| **PERS-02** | `migrate(data, 999)` throws descriptive error | unit | `npx vitest run src/tests/project-schema.test.ts -t "migrate unknown version throws"` | ❌ Wave 0 |
| **PERS-02** | `validateV1` rejects missing `formatVersion` | unit | `npx vitest run src/tests/project-schema.test.ts -t "rejects missing formatVersion"` | ❌ Wave 0 |
| **PERS-02** | Hydration populates `markupStore.pageMarkups` with round-tripped markups | unit | `npx vitest run src/tests/project-serialize.test.ts -t "hydrate round-trip"` | ❌ Wave 0 |
| **PERS-02** | Hydration clears undo/redo stacks | unit | `npx vitest run src/tests/project-serialize.test.ts -t "hydrate clears undo"` | ❌ Wave 0 |
| **PERS-02** | Markup normalized 0–1 coords unchanged through save/load (stability test) | unit | `npx vitest run src/tests/project-serialize.test.ts -t "coords stable round-trip"` | ❌ Wave 0 |
| **PERS-02** | `resolvePdfPath` prefers absolute when both paths exist | unit | `npx vitest run src/tests/project-io.test.ts -t "prefers absolute"` | ❌ Wave 0 |
| **PERS-02** | `resolvePdfPath` falls back to relative when absolute missing | unit | `npx vitest run src/tests/project-io.test.ts -t "falls back to relative"` | ❌ Wave 0 |
| **PERS-02** | `resolvePdfPath` returns null when both missing | unit | `npx vitest run src/tests/project-io.test.ts -t "returns null when missing"` | ❌ Wave 0 |
| **PERS-02** (success criterion 3) | Missing-PDF modal fires (not silent blank canvas) | manual-only (visual) | End-to-end human verification | Checkpoint task |
| **PERS-02** (re-link D-26) | Re-link with wrong page count triggers hard-abort modal | manual-only (visual) | End-to-end human verification | Checkpoint task |
| **PERS-02** (re-link D-27) | Re-link with mismatched dimensions triggers warn (not abort) | manual-only (visual) | End-to-end human verification | Checkpoint task |
| **PERS-02** (hash D-12) | Changed PDF bytes triggers hash-mismatch warning | manual-only (visual) | End-to-end human verification | Checkpoint task |
| **Save UX D-13** | Ctrl+S on never-saved routes through Save As | integration | `npx vitest run src/tests/project-shortcuts.test.ts -t "Ctrl+S first time triggers Save As"` | ❌ Wave 0 |
| **Save UX D-15** | Title bar shows `*` when dirty | integration | `npx vitest run src/tests/title-bar-dirty.test.ts -t "asterisk when dirty"` | ❌ Wave 0 |
| **Save UX D-16** | Close-window while dirty triggers Save/Discard/Cancel modal | manual-only (Electron main needed) | End-to-end human verification | Checkpoint task |
| **Open UX D-19** | Extension routing: `.pdf` → fresh; `.clmc` → hydrate | integration | `npx vitest run src/tests/project-open-routing.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/tests/<files-touched-by-task>.test.ts`
- **Per wave merge:** `npx vitest run` (full suite; already fast — ~1s)
- **Phase gate:** Full suite green + full manual-only checkpoint (CONTEXT D-13, D-15, D-16, D-19, D-23, D-26, D-27, D-12, success criterion 3) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/tests/project-serialize.test.ts` — covers PERS-01 snapshot field presence/exclusion, PERS-02 hydrate round-trip + coord stability
- [ ] `src/tests/project-schema.test.ts` — covers PERS-02 migration seam, validator
- [ ] `src/tests/project-io.test.ts` — covers SHA256 stream, path.relative cross-drive, path resolution, extension enforcement. Note: runs under `environment: 'node'` (already default) so `crypto` and `fs` work natively. Uses a small fixture PDF committed to `src/tests/fixtures/`.
- [ ] `src/tests/project-store.test.ts` — covers dirty-flag flow, hydrate-suspend, save-reset
- [ ] `src/tests/project-shortcuts.test.ts` — Ctrl+S / Ctrl+Shift+S routing + text-input guard
- [ ] `src/tests/title-bar-dirty.test.ts` — asterisk rendering based on `projectStore.isDirty`
- [ ] `src/tests/project-open-routing.test.ts` — extension-sniffing routes to fresh-open vs hydrate paths
- [ ] **No framework install needed** — vitest 4.1.1 + jsdom 29.0.2 already in devDependencies
- [ ] **No new fixtures needed beyond one small PDF** (~10 KB) for SHA256 determinism test

---

## Sources

### Primary (HIGH confidence)

- Existing project code — `src/main/ipc-handlers.ts`, `src/preload/index.ts`, `src/renderer/src/hooks/usePdfDocument.ts`, `src/renderer/src/stores/{markup,scale,viewer}Store.ts`, `src/renderer/src/types/{markup,scale,viewer}.ts`
- `package.json` — confirmed versions: electron ^35.7.5, react ^19.2.1, zustand ^5.0.12, pdfjs-dist ^5.5.207, vitest ^4.1.1, jsdom ^29.0.2, typescript ^5.9.3
- `.planning/phases/04-project-persistence/04-CONTEXT.md` — all D-01..D-28 locked decisions
- [Electron dialog API docs](https://www.electronjs.org/docs/latest/api/dialog) — `showSaveDialog` / `showOpenDialog` options, Windows behavior
- [Electron BrowserWindow API docs](https://www.electronjs.org/docs/latest/api/browser-window) — `'close'` event, `preventDefault()` semantics
- [Electron app API docs](https://www.electronjs.org/docs/latest/api/app) — `'before-quit'` event
- [Node.js crypto docs](https://nodejs.org/api/crypto.html) — `createHash`, streaming via `update()` with read stream
- [Node.js path docs](https://nodejs.org/api/path.html) — `relative`, `resolve`, `parse`, Windows drive semantics
- [Node.js fs docs](https://nodejs.org/api/fs.html) — `createReadStream`, `fs/promises`

### Secondary (MEDIUM confidence)

- [Matthias Sommer — Two ways to react on the Electron 'close' event](https://www.matthiassommer.it/programming/frontend/two-ways-to-react-on-the-electron-close-event/) — close vs before-quit pattern
- [electron/electron#3362 — Prevent the close of the window](https://github.com/electron/electron/issues/3362) — confirms preventDefault pattern
- [electron/electron#9455 — incorrect file extension with dialog.showSaveDialog](https://github.com/electron/electron/issues/9455) — extension-enforcement pitfall confirmation
- [Salt & Pepper — Keep JSON schemas clean with migrations](https://saltandpepper.co/blog/keep-json-schemas-clean-with-migrations/) — migration pattern inspiration
- [Node.js performance issue #136 — Optimizing hashing performance](https://github.com/nodejs/performance/issues/136) — SHA256 throughput context
- [cross-platform-node-guide — file paths](https://github.com/ehmicky/cross-platform-node-guide/blob/main/docs/3_filesystem/file_paths.md) — Windows drive/UNC handling

### Tertiary (LOW confidence — flagged for validation during implementation)

- SHA256 throughput of "300–800 MB/s on modern SSD" — ballpark figure from Node performance discussions; benchmark on the actual target machine during Wave 0 if needed. Known-safe-enough for typical construction PDFs (10–100 MB).
- Zustand 5.0.12 `subscribeWithSelector` middleware availability — confirmed present in zustand 5 docs generally; verify import path (`zustand/middleware`) at implementation time.

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — every library already installed, versions confirmed via package.json, official docs consulted
- **Architecture patterns:** HIGH — all patterns already established in codebase (IPC triad, Zustand per-concern, parent-owned lifecycle, inline styles)
- **Pitfalls:** HIGH for 1–4, 6–10 (verified against platform docs or code review); MEDIUM for 5 (race condition) — pattern is well-documented but requires careful testing in practice
- **Validation strategy:** HIGH — aligned with existing `src/tests/**/*.test.ts` conventions; all test files are pure Node unit tests (no Electron runtime needed) except the checkpoint manual steps

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days — stack is stable, Electron/Node/Zustand versions pinned, no fast-moving dependencies)
