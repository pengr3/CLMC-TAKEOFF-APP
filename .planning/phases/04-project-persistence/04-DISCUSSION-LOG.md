# Phase 4: Project Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 04-project-persistence
**Areas discussed:** File schema & scope, PDF reference strategy, Save & dirty-state UX, Open / Recovery UX

---

## File schema & scope

### Q1: Should viewport state (zoom + pan per page) be saved in the .clmc file?

| Option | Description | Selected |
|--------|-------------|----------|
| Save it (Recommended) | Reopening lands you exactly where you left off — same page, same zoom, same pan. Costs ~50 bytes per page. | ✓ |
| Don't save it | Reopen always starts at page 1, fit-to-window. Simpler file, but loses the 'pick up where I left off' feel. | |
| Save current page only | Save which page you were on (1 number) but not zoom/pan. | |

**User's choice:** Save it
**Notes:** Accepted recommended. Drives D-07.

### Q2: Should we store timestamps in the .clmc file?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — createdAt + updatedAt (Recommended) | Useful for recent-files sorting and sanity checks. ~30 bytes. | ✓ |
| Just updatedAt | Set on every save. Skip createdAt as YAGNI. | |
| No timestamps | Keep file minimal. Filesystem mtime is good enough. | |

**User's choice:** Yes — createdAt + updatedAt
**Notes:** Drives D-08.

### Q3: What format-version strategy for forward compatibility?

| Option | Description | Selected |
|--------|-------------|----------|
| Integer version field (Recommended) | `formatVersion: 1` — simple, monotonic, easy migration code. | ✓ |
| Semantic version string | `formatVersion: '1.0.0'` — richer but overkill. | |
| Integer + minor compat | `{ schemaVersion, appVersion }` — more info but double surface. | |

**User's choice:** Integer version field
**Notes:** Drives D-03.

### Q4: How should the .clmc JSON be laid out?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-page nested (Recommended) | `pages: [{ pageIndex, scale, viewport, markups }]` — easy to read, matches mental model. | ✓ |
| Flat by entity type | `{ markups: [], scales: {}, viewports: {} }` keyed by page. Mirrors store shape. | |
| Hybrid — flat + index | More complex; only for very large projects. | |

**User's choice:** Per-page nested
**Notes:** Drives D-02.

### Q5: How should categories be persisted?

| Option | Description | Selected |
|--------|-------------|----------|
| Full category records + order (Recommended) | `{ categories: { id: {name, color, paletteIndex} }, categoryOrder: [ids] }`. Preserves identity for BOQ grouping. | ✓ |
| Derive from markups on load | Smaller file but forces rebuild and loses empty categories. | |
| Just the name — reassign IDs/colors on load | Loses color stability across save/reload. | |

**User's choice:** Full category records + order
**Notes:** Drives D-06.

### Q6: Store per-page PDF dimensions as a re-link sanity check?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — width/height per page (Recommended) | On open compare against PDF's actual dimensions. Warn if mismatch. | ✓ |
| Page count only | Simpler but misses same-count-different-dimensions cases. | |
| No dimension check | Trust whatever PDF is at the path. | |

**User's choice:** Yes — width/height per page
**Notes:** Drives D-04 and D-27.

### Q7: Store the PDF's total page count in the .clmc file?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, top-level totalPages field (Recommended) | O(1) sanity check, grep-friendly. | ✓ |
| Derive from pages[].length | Cleaner schema, redundant field. | |

**User's choice:** Yes, top-level totalPages
**Notes:** Drives D-05.

### Q8: Confirm transient state is excluded from the file?

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude all transient state (Recommended) | undoStack, redoStack, calibMode, activeTool, draws, popups. File = artifacts, not UI position. | ✓ |
| Also persist activeTool + globalUnit | Extras so reopening restores exact tool mode. | |

**User's choice:** Exclude all transient state
**Notes:** globalUnit is already an artifact (user preference), not transient — kept in. Drives D-09.

---

## PDF reference strategy

### Q1: How should the PDF path be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| Absolute + relative fallback (Recommended) | Store both; try absolute first, fall back to relative. Makes folder-move just work. | ✓ |
| Absolute path only | Hits re-link flow on every move. | |
| Relative path only | Breaks when PDF is outside project folder. | |

**User's choice:** Absolute + relative fallback
**Notes:** Drives D-10.

### Q2: Store a hash of the PDF to detect it's been modified since save?

| Option | Description | Selected |
|--------|-------------|----------|
| SHA256 hash of PDF bytes (Recommended) | Catches architect-sent-rev-B case. ~1-2 sec on 200MB PDFs. | ✓ |
| Size + mtime only | Unreliable — Dropbox/OneDrive sync tweaks mtime. | |
| No hash check | Fast but blind. | |

**User's choice:** SHA256 hash
**Notes:** Drives D-11.

### Q3: If hash mismatches, what's the behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Warn + let user proceed (Recommended) | "PDF has changed. [Open anyway] [Cancel]". Respects user judgement. | ✓ |
| Block opening | Strict but frustrating. | |
| Silent | Console log only. | |

**User's choice:** Warn + let user proceed
**Notes:** Drives D-12.

### Q4: What filename should the initial Save As default to?

| Option | Description | Selected |
|--------|-------------|----------|
| PDF basename + .clmc (Recommended) | `plans.pdf` → `plans.clmc` in same directory. | ✓ |
| Untitled.clmc | Fresh generic filename. | |
| PDF basename + date | `plans-2026-04-21.clmc`. | |

**User's choice:** PDF basename + .clmc
**Notes:** Drives D-14.

---

## Save & dirty-state UX

### Q1: Save shortcuts and menu entries?

| Option | Description | Selected |
|--------|-------------|----------|
| Ctrl+S save, Ctrl+Shift+S Save As (Recommended) | Standard Windows. Ctrl+S on never-saved routes to Save As. | ✓ |
| Ctrl+S only, Save As via toolbar/menu | Minimal shortcut surface. | |
| Toolbar buttons only | No keyboard shortcuts. | |

**User's choice:** Ctrl+S save, Ctrl+Shift+S Save As
**Notes:** Drives D-13.

### Q2: How should unsaved changes be signalled?

| Option | Description | Selected |
|--------|-------------|----------|
| Asterisk in title bar (Recommended) | `plans.clmc * — CLMC Takeoff`. Industry-standard. | ✓ |
| Save button highlight | Toolbar Save lights up when dirty. | |
| Both title asterisk AND highlighted Save button | Belt and braces. | |

**User's choice:** Asterisk in title bar
**Notes:** Drives D-15.

### Q3: Warn when closing/quitting with unsaved changes?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal warning on close (Recommended) | `Save changes? [Save] [Discard] [Cancel]`. Standard. | ✓ |
| No warning — trust the user | Fast, data loss possible. | |
| Auto-save to recovery file on close | Dump to .clmc.recover, restore prompt on launch. More complex. | |

**User's choice:** Modal warning on close
**Notes:** Drives D-16.

### Q4: Auto-save behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| No auto-save, save on explicit action only (Recommended) | Predictable. Close-warning catches accidents. | ✓ |
| Auto-save every N minutes if dirty | Safety net but adds complexity. | |
| Auto-save to recovery file only | Background writes to .clmc.recover. | |

**User's choice:** No auto-save
**Notes:** Drives D-17.

---

## Open / Recovery UX

### Q1: Entry point — how should 'Open' work?

| Option | Description | Selected |
|--------|-------------|----------|
| Single 'Open' button sniffing extension (Recommended) | Existing button becomes 'Open'. Picker shows .pdf and .clmc. Ctrl+O triggers it. | ✓ |
| Two separate buttons | Keep Open PDF, add Open Project. Ctrl+O + Ctrl+Shift+O. | |
| Open menu with two options | Dropdown: Open PDF / Open Project. | |

**User's choice:** Single 'Open' button sniffing extension
**Notes:** Drives D-19 and D-20.

### Q2: Recent files support in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| No recent files in Phase 4 (Recommended) | Ship lean. Defer to Phase 6 or v2. | ✓ |
| Simple recent list (last 5) | Dropdown next to Open. Modest effort. | |
| Full recent files panel on empty state | Welcome screen. Bigger UX project. | |

**User's choice:** No recent files
**Notes:** Drives D-22 and Deferred list.

### Q3: PDF-not-found recovery modal — what does it show?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + original path + Browse + Cancel (Recommended) | Blocking modal. Browse opens .pdf picker. Cancel aborts open. | ✓ |
| Browse + Open without PDF (markups read-only) | Extra option: blank canvas + banner. | |
| Browse only — no cancel | Force re-link. Intrusive. | |

**User's choice:** Name + original path + Browse + Cancel
**Notes:** Drives D-23 and D-24.

### Q4: After re-linking to a PDF with a different page count?

| Option | Description | Selected |
|--------|-------------|----------|
| Warn and abort (Recommended) | `Selected PDF has N pages, expected M. [Pick again] [Cancel]`. No override. | ✓ |
| Warn, then load anyway if user confirms | Respects override. Riskier. | |
| Silent load — clamp pages to new PDF | Surprising. | |

**User's choice:** Warn and abort
**Notes:** Drives D-26.

---

## Claude's Discretion

Items explicitly left to Claude during planning/execution:
- `projectStore` shape (new Zustand slice) — tracks `currentFilePath`, `isDirty`, plus actions
- Dirty-flag wiring mechanism (explicit flag flips inside mutating actions vs. store subscription)
- IPC handler naming (`dialog:saveProject`, `file:writeProject`, etc.) — follow existing `dialog:openPdf` convention
- Hash computation streaming vs. full-buffer for large PDFs
- Exact styling of missing-PDF and close-warning modals (follow existing popup patterns)
- Whether close-warning uses Electron-native `dialog.showMessageBox` or an in-renderer React modal
- Whether "Open" button label stays "Open PDF" until a project loads, or switches immediately
- Migration stub for `formatVersion` (no-op at v1)

## Deferred Ideas

- Recent files list (Phase 6 or v2)
- Welcome / empty-state screen (Phase 6)
- Auto-save or `.clmc.recover` (future polish)
- Open without PDF / read-only mode
- Cloud sync / shared projects (out of scope per PROJECT.md)
- Multi-window editing
- App-level preferences persistence (separate concern from project files)
- Category export/import as preset library (v2 LIB-01)
- Schema migration tooling (seam lands in v1, real work in v2)
