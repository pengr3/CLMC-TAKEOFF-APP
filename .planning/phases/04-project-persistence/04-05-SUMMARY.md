---
phase: 04-project-persistence
plan: "05"
subsystem: close-guard
tags:
  - electron-ipc
  - close-guard
  - dirty-state
  - modal
dependency_graph:
  requires:
    - "04-03"  # project save/open hooks
    - "04-04"  # toolbar + dirty tracking
  provides:
    - close-guard-ipc
    - save-close-modal
    - open-while-dirty-guard
  affects:
    - src/main/index.ts
    - src/preload/index.ts
    - src/renderer/src/App.tsx
tech_stack:
  added: []
  patterns:
    - "WeakMap-based IPC listener wrapping (Pitfall 10 prevention)"
    - "useRef stable handler to prevent StrictMode double-registration"
    - "getState() access in callbacks to avoid stale closures over isDirty"
    - "canClose flag + mainWindowRef for Electron close interception"
key_files:
  created:
    - src/renderer/src/hooks/useCloseGuard.ts
    - src/renderer/src/components/SaveCloseModal.tsx
  modified:
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/src/App.tsx
decisions:
  - "canClose flag lives at module scope in main/index.ts (not per-window) — single-window app, no ambiguity"
  - "useProjectStore.getState().isDirty used in callbacks instead of reactive isDirty to avoid stale-closure over closeGuard handler"
  - "Save button auto-focuses in SaveCloseModal — Enter = Save, Escape = Cancel matches VS Code pattern"
  - "WeakMap used in preload for wrapped-listener lookup so offCloseRequest correctly removes the right ipcRenderer listener"
  - "SaveCloseModal zIndex=120 to appear above all other recovery modals (zIndex 100)"
metrics:
  duration: "5 minutes"
  completed: "2026-04-22"
  tasks: 3
  files_modified: 6
requirements:
  - PERS-01
---

# Phase 04 Plan 05: Close Guard + Open-While-Dirty Guard Summary

Main-process close interception (canClose flag + ipcMain.on pattern), three new preload API methods, a useCloseGuard hook with stable-ref listener registration, and a SaveCloseModal wired into both the window-close and open-other-file flows.

## What Was Built

### Task 1: Main-process close coordination + preload API additions (073e84e)

`src/main/index.ts` now intercepts every BrowserWindow `close` event via `event.preventDefault()` and signals the renderer with `webContents.send('app:close-request')`. After the renderer's async save/discard resolves, it calls `ipcRenderer.send('app:confirm-close')`, which sets `canClose = true` and calls `mainWindowRef?.close()` — the next close event passes through unintercepted.

`src/preload/index.ts` gained three new api methods:
- `onCloseRequest(cb)` — wraps the zero-arg user callback with a WeakMap-tracked wrapper, registers on the `app:close-request` channel
- `offCloseRequest(cb)` — looks up the wrapped listener via WeakMap, removes it, and deletes the entry
- `confirmClose()` — fire-and-forget `ipcRenderer.send('app:confirm-close')`

`src/preload/index.d.ts` extended `ElectronAPI` with all three typed methods.

### Task 2: useCloseGuard hook + SaveCloseModal component (723519f)

`src/renderer/src/hooks/useCloseGuard.ts` — single-effect, single-listener hook. Uses `useRef(onRequest)` so `handlerRef.current` is always current without re-registering the listener on every render. The stable `() => handlerRef.current()` function is the actual listener registered via `onCloseRequest`. Cleaned up on unmount via `offCloseRequest`.

`src/renderer/src/components/SaveCloseModal.tsx` — overlay dialog matching D-16 copy:
- "Save changes to **{filename}**?"
- Three buttons: Cancel (neutral), Discard (warning color), Save (accent, auto-focused)
- Escape key triggers onCancel; Enter key triggers onSave
- `role="dialog" aria-modal="true"` for accessibility
- zIndex 120 (above all other recovery modals at 100)

### Task 3: App.tsx wire-up for D-16 + D-21 (825b838)

`src/renderer/src/App.tsx` changes:

1. **useCloseGuard registration** — reads `useProjectStore.getState().isDirty` directly (not reactive `isDirty`) to avoid stale closure. If clean → `window.api.confirmClose()` immediately (no modal). If dirty → `setCloseModal('close-window')`.

2. **handleOpenClick refactor** — split `openProjectDialog()` (picker + route bundled) into explicit `window.api.openProject()` then dirty-check then `openByExtension`. Dirty + file picked → `setPendingOpen({ filePath, extension })` + `setCloseModal('open-other')` (D-21).

3. **SaveCloseModal JSX** — rendered when `closeModal !== null`. Both contexts handled:
   - `close-window`: Save → await saveProject() → if ok, confirmClose(); Discard → confirmClose(); Cancel → clear state
   - `open-other`: Save → await saveProject() → if ok, openByExtension(pendingOpen) + handleOpenResult; Discard → openByExtension directly; Cancel → clear state
   - If Save As dialog is dismissed by the user (saveProject returns 'canceled'), modal stays open — user can retry.

4. **displayFilename** — `currentFilePath.split(/[\\/]/).pop()` if path known; else `fileName` from viewerStore; fallback `'project'`.

## Edge Cases Handled

- **Save-while-closing race (Pitfall 5):** `confirmClose()` is only called after `saveProject()` resolves with `'ok'`. If the Save As dialog is canceled, the modal remains open — window stays alive.
- **Duplicate listener registration (Pitfall 10):** `useRef` stable handler pattern in `useCloseGuard` prevents StrictMode double-mount from registering two listeners. WeakMap in preload ensures `offCloseRequest` removes the correct wrapped listener.
- **Stale isDirty closure:** All callbacks use `useProjectStore.getState().isDirty` (snapshot read) rather than closing over the reactive hook value — avoids the case where a fast save clears dirty before the handler fires.
- **Open-while-dirty cancellation:** Picker fires before dirty check — if the user cancels the picker, no modal is shown (no state is disturbed).

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was removing a spurious `const isDirty = useProjectStore(...)` that TypeScript TS6133 flagged as unused (the plan spec correctly used `useProjectStore.getState().isDirty` in callbacks; the reactive subscription was not needed).

## Known Stubs

None — all wired to live state.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/renderer/src/hooks/useCloseGuard.ts | FOUND |
| src/renderer/src/components/SaveCloseModal.tsx | FOUND |
| .planning/phases/04-project-persistence/04-05-SUMMARY.md | FOUND |
| commit 073e84e (main + preload) | FOUND |
| commit 723519f (hook + modal) | FOUND |
| commit 825b838 (App.tsx wire-up) | FOUND |
