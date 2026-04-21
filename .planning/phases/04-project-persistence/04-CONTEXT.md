# Phase 4: Project Persistence - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Save the current working state of a takeoff project to a `.clmc` file, and reopen it later to land in the exact same state. What gets persisted: PDF reference (path + hash), per-page scale calibrations, all markups (count/linear/area/perimeter), categories with their colors, per-page viewport (zoom + pan), global display unit, file format version, and timestamps. What does NOT get persisted: undo/redo stacks, transient draw state, active tool, in-progress popups.

Also in scope: Save / Save As shortcuts and dirty-state UX (title bar asterisk, warn-on-close), extension-sniffing Open flow (`.pdf` or `.clmc`), and a missing-PDF recovery modal with Browse + Cancel.

**Out of scope for this phase:** auto-save or recovery files, recent-files list, welcome screen / empty-state, opening a project without its PDF (read-only mode), cloud sync, multi-window editing, BOQ export (Phase 5), running totals panel (Phase 6), thumbnail strip (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### File Schema

- **D-01:** `.clmc` files are plain UTF-8 JSON — written via Node `fs.writeFile` through Electron IPC (locked by STATE.md).
- **D-02:** Top-level shape is **per-page nested**:
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
      {
        pageIndex: 1,
        dimensions: { width, height },  // PDF points at rotation 0
        scale: { pixelsPerMm, displayUnit } | null,
        viewport: { zoom, panX, panY },
        markups: [ ...Markup ]
      },
      ...
    ]
  }
  ```
- **D-03:** `formatVersion` is an **integer** (starts at `1`). Future breaking changes bump the integer; loader runs migration steps before hydrating the stores. No semver for this field.
- **D-04:** Per-page PDF **dimensions** (width/height in PDF points, rotation 0) are serialized. On open, compared against the actually-loaded PDF for sanity. Mismatch triggers a warning (see D-16).
- **D-05:** Top-level `totalPages` is serialized even though `pages[].length` duplicates it. Gives an O(1) sanity check and makes the file grep-friendly.
- **D-06:** Categories serialize with full `{ id, name, color, paletteIndex }` records plus `categoryOrder`. Preserves category identity (same IDs), color stability, and empty categories across save/reload. Required for Phase 5 BOQ grouping.
- **D-07:** Per-page viewport (`zoom`, `panX`, `panY`) and `currentPage` are serialized so reopening lands the user at the exact same page and zoom/pan.
- **D-08:** Timestamps: top-level `createdAt` (ISO-8601, set on first save) and `updatedAt` (ISO-8601, set on every save).
- **D-09:** Transient state is **excluded**: `undoStack`, `redoStack`, `calibMode`, `activeTool`, in-progress draw state, context-menu position, tooltip state, popup open/closed state. The file captures artifacts, not UI position.

### PDF Reference Strategy

- **D-10:** Both `absolutePath` and `relativePath` are stored. `relativePath` is computed relative to the `.clmc` file's location at save time. On open, absolute is tried first; if missing, relative is tried. If both fail, the missing-PDF recovery modal fires (D-16).
- **D-11:** SHA256 hash of PDF bytes is stored on save and re-computed on open. Implemented in the main process using Node `crypto.createHash('sha256')`.
- **D-12:** On hash mismatch, a non-blocking warning modal fires: `"This PDF has changed since your last save — markup positions may no longer align. [Open anyway] [Cancel]"`. If user cancels, open aborts; app returns to its pre-open state. Rationale: sometimes architect revisions just add sheets without shifting geometry; user judgement wins.

### Save Flow

- **D-13:** Keyboard shortcuts: **Ctrl+S = Save**, **Ctrl+Shift+S = Save As**. Ctrl+S on a project that has never been saved routes through Save As automatically.
- **D-14:** Default Save As filename = PDF basename with `.clmc` extension in the PDF's directory. Example: opening `C:/projects/plans.pdf` → Save As default `C:/projects/plans.clmc`.
- **D-15:** Dirty state is signalled in the **title bar only** as a trailing asterisk: `plans.clmc * — CLMC Takeoff` when dirty, `plans.clmc — CLMC Takeoff` when clean. Toolbar Save button is NOT also highlighted (single source of truth).
- **D-16:** Closing the window (or opening another project) while dirty shows a modal: `"Save changes to [filename]? [Save] [Discard] [Cancel]"`. Save triggers Save As if file has never been saved. Cancel aborts the close/open. This modal is required for Electron's `before-quit` path.
- **D-17:** **No auto-save** in v1. Explicit Ctrl+S only. The close-warning (D-16) catches accidents. Revisit in a later phase if user reports friction.
- **D-18:** On successful save, show a brief `ConfirmationToast` ("Saved" or "Saved as {filename}"). Existing parent-owned-lifecycle pattern from Phase 2 (see Code Context).

### Open Flow

- **D-19:** The existing blue **"Open PDF" button becomes "Open"** and is extension-sniffing. The Electron file picker shows both `.pdf` and `.clmc` filters (plus "All supported"). App routes by extension: `.pdf` → fresh project using that PDF; `.clmc` → hydrate stores from file then load the referenced PDF.
- **D-20:** Ctrl+O keeps its current binding and now triggers the same extension-sniffing dialog. No new shortcut for project-only.
- **D-21:** Opening any file while the current project is dirty goes through the D-16 Save/Discard/Cancel modal first.
- **D-22:** **No recent-files list** in Phase 4. Deferred to a future phase (candidate: Phase 6 UI polish, or v2).

### PDF-Not-Found Recovery

- **D-23:** When the referenced PDF is missing on open (both absolute and relative paths fail), a blocking modal fires with:
  - Expected filename (from `pdf.absolutePath` basename)
  - Original path where it was last seen
  - **[Browse for PDF]** button — opens a file picker filtered to `.pdf`
  - **[Cancel]** button — aborts the open; app returns to its pre-open state (no project loaded, or previous project still active)
- **D-24:** No "open without PDF" option. Markups are worthless without the plan to anchor to; hiding the PDF would leave the canvas blank and confusing.
- **D-25:** After successful re-link via Browse, the project loads and the `pdf.absolutePath` / `pdf.relativePath` / `pdf.sha256` are updated in memory. The change is reflected in the dirty state — user must Ctrl+S to persist the new path.

### Re-link Sanity Checks

- **D-26:** If the re-linked PDF has a **different page count** than `pdf.totalPages`, abort with an error modal: `"Selected PDF has {N} pages, but project expects {M}. This is probably a different file. [Pick again] [Cancel]"`. No "load anyway" escape hatch — page-count mismatch is almost always a wrong file.
- **D-27:** If the re-linked PDF has matching page count but **different per-page dimensions** (D-04), warn but allow the user to proceed: `"PDF dimensions don't match the original. Markup positions may look wrong. [Open anyway] [Cancel]"`. Markups are stored in normalized 0–1 page space so they'll place on any PDF; the warning flags the risk without blocking.
- **D-28:** Hash mismatch on a successful re-link fires the D-12 warning (same behavior as the initial-open hash mismatch).

### Claude's Discretion

- Exact `projectStore` shape (new Zustand slice) — at minimum tracks `currentFilePath: string | null`, `isDirty: boolean`, plus save/open actions. Dirty-flag flip strategy (subscription vs. explicit writes inside each mutating action) is a planning call.
- IPC handler naming (`dialog:saveProject`, `dialog:openProject`, `file:readProject`, `file:writeProject`, `file:hashPdf`, `file:existsCheck`, etc.) — follow existing `dialog:openPdf` convention.
- Where path-math (`path.relative`, `path.resolve`) runs — must be main process (Node only), not renderer.
- Hash computation timing / method — on save always, on open always. For large PDFs (100MB+), stream via `fs.createReadStream` rather than loading into memory. Benchmark expected but not strictly required for this phase.
- Exact styling of the PDF-not-found modal and the close-warning modal — follow existing popup patterns (ScalePopup / MarkupNamePopup inline style, dark theme, `COLORS` constants).
- Whether the close-warning is Electron-native (`dialog.showMessageBox`) or in-renderer React modal — recommend in-renderer for visual consistency with other popups, but Electron-native is acceptable if keyboard/focus handling proves simpler.
- Whether the "Open" button label keeps "Open PDF" until a project has been loaded, or switches to "Open" immediately — recommend just "Open" always for simplicity.
- Migration stub for `formatVersion`: even at v1 there's a `migrate(data, fromVersion)` seam so v2 later isn't a refactor. Claude can make this a no-op for v1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — **PERS-01** (save to `.clmc`) and **PERS-02** (reopen `.clmc`). Both are in scope; both must pass by end of this phase.

### Locked Architectural Decisions (do not revisit)
- `.planning/STATE.md` §Key Decisions — "formatVersion field in .clmc files from day one — enables future schema migrations; omitting it makes old files unreadable after any change"
- `.planning/STATE.md` §Key Decisions — "All markup coordinates stored in PDF page space (normalized 0.0–1.0)" — implies zero coordinate transform between in-memory shape and serialized shape. `Markup.point` / `Markup.points` serialize as-is.
- `.planning/STATE.md` §Key Decisions — "Zustand 5 with persist middleware" — project persistence REPLACES the persist middleware path for `.clmc` files; do NOT use Zustand `persist` to write the project file. `persist` is fine for app-level prefs (globalUnit, window state) if we want it, but that's a separate concern.
- `.planning/STATE.md` §Key Decisions — PDF referenced by path, not embedded (keeps project files small) — `pdf.absolutePath` stores the path; PDF bytes never go into `.clmc`.

### Prior-Phase Context (relevant data shapes)
- `.planning/phases/02-scale-calibration/02-CONTEXT.md` — per-page scale model (`pixelsPerMm` + `displayUnit`), global-unit preference, "reset action clears scale back to Not Set"
- `.planning/phases/03-markup-tools-and-editing/03-CONTEXT.md` — markup types, category system, per-page markup list shape
- `.planning/phases/03.1-markup-gap-closure-and-visual-redesign/03.1-CONTEXT.md` — D-26/D-27/D-29: color is a property of the name-group; category retained as a BOQ grouping label; `Markup.color` is the authoritative visual field (category.color has been stripped from render components)

### Source Type & Store Definitions (data model reference)
- `src/renderer/src/types/markup.ts` — `Markup`, `Category`, `MarkupCommand`, `CATEGORY_PALETTE`. Note: `Markup.createdAt` (number, epoch ms) already exists — serialize as-is or convert to ISO-8601; pick one and be consistent.
- `src/renderer/src/types/scale.ts` — `PageScale { pixelsPerMm, displayUnit }`, `ScaleUnit`, `MM_PER_UNIT`, `DEFAULT_UNIT`
- `src/renderer/src/types/viewer.ts` — `ViewportState { zoom, panX, panY }`, `DEFAULT_VIEWPORT`, `ActiveTool`, `ScaleState` (legacy — the real scale lives in `scaleStore`)
- `src/renderer/src/stores/markupStore.ts` — `pageMarkups`, `categories`, `categoryOrder`, undo/redo machinery (to be excluded from serialization)
- `src/renderer/src/stores/scaleStore.ts` — `pageScales`, `globalUnit`, `calibMode` (calibMode transient — exclude)
- `src/renderer/src/stores/viewerStore.ts` — `filePath`, `fileName`, `currentPage`, `totalPages`, `pageViewports`, `activeTool` (activeTool transient — exclude)

### IPC / Main-Process Patterns (to extend)
- `src/main/ipc-handlers.ts` — existing `ipcMain.handle('dialog:openPdf', ...)` pattern. New handlers for `dialog:openProject`, `dialog:saveProject`, `file:readProject`, `file:writeProject`, `file:hashPdf`, `file:checkExists` follow this shape.
- `src/preload/index.ts` — `contextBridge.exposeInMainWorld('api', { openPdf })`. Extend with new methods.
- `src/preload/index.d.ts` — `window.api` type augmentation. Extend with new signatures.

### UI Patterns (to reuse)
- `src/renderer/src/components/ConfirmationToast.tsx` — parent-owned-lifecycle pattern for the "Saved" success toast
- `src/renderer/src/components/ScalePopup.tsx` / `src/renderer/src/components/MarkupNamePopup.tsx` — inline popup styling for the missing-PDF and close-warning modals
- `src/renderer/src/components/TitleBar.tsx` — dirty-state asterisk goes here; currently subscribes to `viewerStore.fileName`, will need to also subscribe to `projectStore.currentFilePath` and `projectStore.isDirty`
- `src/renderer/src/components/Toolbar.tsx` — "Open PDF" button (lines ~184–218) becomes "Open"; Save / Save As buttons can go beside it
- `src/renderer/src/hooks/useKeyboardShortcuts.ts` — Ctrl+S / Ctrl+Shift+S registered here (alongside existing Ctrl+Z / Ctrl+Y)
- `src/renderer/src/hooks/usePdfDocument.ts` — `openPdfDialog` currently handles PDF open; refactor to handle `.pdf` vs `.clmc` routing OR wrap with a higher-level `useProject` hook

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ipc-handlers.ts` + `preload/index.ts` + `preload/index.d.ts` — triad for any new IPC method. Pattern is stable; add methods in all three files.
- `ConfirmationToast.tsx` — reuse for save-success and re-link-success toasts
- `ScalePopup.tsx` / `MarkupNamePopup.tsx` — inline popup template for the PDF-not-found modal and the save/discard/cancel modal
- `useKeyboardShortcuts.ts` `isTextInputActive()` helper — already used to guard Ctrl+Z/Ctrl+Y; reuse for Ctrl+S guard so the shortcut doesn't fire while user is typing in a markup name field
- `useMarkupStore` + `useScaleStore` + `useViewerStore` — the three sources of truth to serialize. Each store exposes the state needed directly.
- `crypto` (Node built-in, main process) — for SHA256; no new dependency required
- `path` (Node built-in, main process) — for `path.relative` / `path.resolve` / `path.basename`

### Established Patterns
- Zustand store per concern — new `projectStore.ts` in `src/renderer/src/stores/` for `currentFilePath`, `isDirty`, `lastSavedAt`, plus `save()`, `saveAs()`, `open()`, `newProject()` actions
- Inline styles on UI chrome; `COLORS` constants from `lib/constants.ts`
- Parent-owned lifecycle for transient UI (toast, popup) — modal dismissal owned by whatever mounted it
- Primitive-field Zustand selectors with stable fallbacks (commit `0e1a8e0` pattern) — mandatory for any new selector
- IPC boundary: main process owns `fs` + `dialog` + `path` + `crypto`; renderer only touches `window.api.*`
- Existing file picker integration: `dialog.showOpenDialog` returns `{ canceled, filePaths }` pattern; reuse this shape for project open
- For `showSaveDialog`: mirror the pattern; main process handles cancellation and returns null

### Integration Points
- `Toolbar.tsx` — button labels: "Open PDF" → "Open"; add "Save" and "Save As" buttons. Likely grouped in the left cluster next to Open.
- `TitleBar.tsx` — compute title from `projectStore.currentFilePath` + `projectStore.isDirty` (asterisk), falling back to `viewerStore.fileName` for the never-saved case.
- `useKeyboardShortcuts.ts` — add Ctrl+S, Ctrl+Shift+S, text-input guard; keep Ctrl+O wired to the same extension-sniffing open flow
- New `projectStore.ts` — subscribed to by TitleBar, Toolbar, and the close-warning modal
- Dirty-flag wiring: every mutating action in `markupStore` (placeMarkup, deleteMarkup, recolorGroup, undo, redo) and `scaleStore` (setScale, clearScale, setGlobalUnit) flips `projectStore.isDirty = true`. Ctrl+S sets it back to false after successful write. Claude's Discretion on the exact mechanism (explicit vs store subscription).
- `App.tsx` (or wherever the Electron `before-quit` listener lives) — intercept close, check `isDirty`, show D-16 modal

</code_context>

<specifics>
## Specific Ideas

- "File format like a project file, not a session dump" — `.clmc` captures the artifacts (markups, categories, scales, PDF reference) that define the takeoff, not the UI state of the editor. Undo stacks, active tool, popup open/close — all out.
- "Fit zoom and current page are part of the artifact" — the user's last viewport IS part of where they left off. Not persisting it feels sloppy. Persisting it is cheap and matters for the "pick up where I left off" feel the core value promises.
- "Relative path fallback so the whole folder is portable" — construction estimators commonly zip/email project folders. `plans.pdf` next to `plans.clmc` should reopen cleanly on a different machine even if the absolute path changes.
- "Hash warning, not hash block" — architects send revisions. User judgement wins on whether markups are still usable. Default stance: warn, don't block.
- "Page count mismatch is hard-abort" — almost always a wrong file. Unlike dimension mismatch, there's no useful degraded state.
- "No auto-save" — this is a single-user Windows app; Ctrl+S is muscle memory for this audience. Close-warning is the backstop. Revisit only if user reports losing work.

</specifics>

<deferred>
## Deferred Ideas

### To later phases (or v2)
- **Recent files list** — store last 5 opened `.clmc` paths in Electron `userData`; show as dropdown or welcome screen. Candidate: Phase 6 (UI Polish) or v2.
- **Welcome / empty-state screen** — when no project is open, show recent files + "Open" + "Open PDF" CTAs instead of a blank canvas. Phase 6 candidate.
- **Auto-save or recovery file** (`.clmc.recover`) — periodic background save for crash recovery. Revisit if users report data loss.
- **Open project without the PDF** (read-only mode) — markups hidden or shown on a blank background. Unclear real-world need; not worth building preemptively.
- **Cloud sync / shared projects** — explicitly out of scope (PROJECT.md, REQUIREMENTS.md).
- **Multi-window editing** — one project per app instance for v1.
- **App-level preferences file** (default unit, window size/position, theme) — separate from project files. Could use Zustand `persist` middleware into `userData`. Not required for Phase 4; flag for a future polish phase.
- **Export/import of categories as a reusable preset** — v2 item library territory (LIB-01).
- **Schema migration tooling** — the `migrate(data, fromVersion)` seam lands in Phase 4 but stays a no-op for v1. Real migration work happens when v2 schema changes.

</deferred>

---

*Phase: 04-project-persistence*
*Context gathered: 2026-04-21*
