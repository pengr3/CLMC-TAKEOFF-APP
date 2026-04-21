---
phase: 4
slug: project-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 + jsdom 29.0.2 |
| **Config file** | `vitest.config.ts` (at repo root) |
| **Quick run command** | `npx vitest run --reporter=default` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1–2 seconds |

Test file glob: `src/tests/**/*.test.ts`. Phase 4 tests live under `src/tests/` alongside existing test files; no config changes required. Runs under `environment: 'node'` (already default) so `crypto` and `fs` work natively for IO tests.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/<files-touched-by-task>.test.ts`
- **After every plan wave:** Run `npx vitest run` (full suite — already fast, ~1s)
- **Before `/gsd:verify-work`:** Full suite green + full manual-only checkpoint complete
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-W0-01 | Wave 0 | 0 | PERS-01 | unit (scaffold) | `npx vitest run src/tests/project-serialize.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-02 | Wave 0 | 0 | PERS-02 | unit (scaffold) | `npx vitest run src/tests/project-schema.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-03 | Wave 0 | 0 | PERS-01 | unit (scaffold) | `npx vitest run src/tests/project-io.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-04 | Wave 0 | 0 | PERS-01 | unit (scaffold) | `npx vitest run src/tests/project-store.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-05 | Wave 0 | 0 | D-13 | integration (scaffold) | `npx vitest run src/tests/project-shortcuts.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-06 | Wave 0 | 0 | D-15 | integration (scaffold) | `npx vitest run src/tests/title-bar-dirty.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-07 | Wave 0 | 0 | D-19 | integration (scaffold) | `npx vitest run src/tests/project-open-routing.test.ts` | ❌ W0 | ⬜ pending |
| 4-W1-SNAP | TBD plan | 1 | PERS-01 | unit | `npx vitest run src/tests/project-serialize.test.ts -t "snapshot includes D-02 fields"` | planner-assigned | ⬜ pending |
| 4-W1-SNAP-EXCL | TBD plan | 1 | PERS-01 | unit | `npx vitest run src/tests/project-serialize.test.ts -t "excludes transient state"` | planner-assigned | ⬜ pending |
| 4-W1-SCHEMA-RT | TBD plan | 1 | PERS-01 | unit | `npx vitest run src/tests/project-schema.test.ts -t "round-trip"` | planner-assigned | ⬜ pending |
| 4-W1-SHA256 | TBD plan | 1 | PERS-01 | unit | `npx vitest run src/tests/project-io.test.ts -t "sha256 stream equals buffer"` | planner-assigned | ⬜ pending |
| 4-W1-PATH-REL | TBD plan | 1 | PERS-01 | unit | `npx vitest run src/tests/project-io.test.ts -t "cross-drive returns null"` | planner-assigned | ⬜ pending |
| 4-W1-EXT | TBD plan | 1 | PERS-01 | unit | `npx vitest run src/tests/project-io.test.ts -t "enforces .clmc extension"` | planner-assigned | ⬜ pending |
| 4-W2-DIRTY-ON | TBD plan | 2 | PERS-01 | unit | `npx vitest run src/tests/project-store.test.ts -t "dirty on place"` | planner-assigned | ⬜ pending |
| 4-W2-DIRTY-HYD | TBD plan | 2 | PERS-01 | unit | `npx vitest run src/tests/project-store.test.ts -t "stays clean on hydrate"` | planner-assigned | ⬜ pending |
| 4-W2-DIRTY-SAVE | TBD plan | 2 | PERS-01 | unit | `npx vitest run src/tests/project-store.test.ts -t "clean after save"` | planner-assigned | ⬜ pending |
| 4-W1-MIG-ID | TBD plan | 1 | PERS-02 | unit | `npx vitest run src/tests/project-schema.test.ts -t "migrate v1 identity"` | planner-assigned | ⬜ pending |
| 4-W1-MIG-THROW | TBD plan | 1 | PERS-02 | unit | `npx vitest run src/tests/project-schema.test.ts -t "migrate unknown version throws"` | planner-assigned | ⬜ pending |
| 4-W1-VAL-V1 | TBD plan | 1 | PERS-02 | unit | `npx vitest run src/tests/project-schema.test.ts -t "rejects missing formatVersion"` | planner-assigned | ⬜ pending |
| 4-W2-HYD-RT | TBD plan | 2 | PERS-02 | unit | `npx vitest run src/tests/project-serialize.test.ts -t "hydrate round-trip"` | planner-assigned | ⬜ pending |
| 4-W2-HYD-UNDO | TBD plan | 2 | PERS-02 | unit | `npx vitest run src/tests/project-serialize.test.ts -t "hydrate clears undo"` | planner-assigned | ⬜ pending |
| 4-W2-COORD | TBD plan | 2 | PERS-02 | unit | `npx vitest run src/tests/project-serialize.test.ts -t "coords stable round-trip"` | planner-assigned | ⬜ pending |
| 4-W1-RESOLVE-ABS | TBD plan | 1 | PERS-02 | unit | `npx vitest run src/tests/project-io.test.ts -t "prefers absolute"` | planner-assigned | ⬜ pending |
| 4-W1-RESOLVE-REL | TBD plan | 1 | PERS-02 | unit | `npx vitest run src/tests/project-io.test.ts -t "falls back to relative"` | planner-assigned | ⬜ pending |
| 4-W1-RESOLVE-NULL | TBD plan | 1 | PERS-02 | unit | `npx vitest run src/tests/project-io.test.ts -t "returns null when missing"` | planner-assigned | ⬜ pending |
| 4-W3-SHORTCUT-FIRST | TBD plan | 3 | D-13 | integration | `npx vitest run src/tests/project-shortcuts.test.ts -t "Ctrl+S first time triggers Save As"` | planner-assigned | ⬜ pending |
| 4-W3-TITLE-DIRTY | TBD plan | 3 | D-15 | integration | `npx vitest run src/tests/title-bar-dirty.test.ts -t "asterisk when dirty"` | planner-assigned | ⬜ pending |
| 4-W3-OPEN-ROUTE | TBD plan | 3 | D-19 | integration | `npx vitest run src/tests/project-open-routing.test.ts` | planner-assigned | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Task IDs are provisional — final numbering assigned by planner during Step 8. The pattern `{PHASE}-{WAVE}-{DESC}` is a placeholder; planner should translate these to canonical `{PHASE}-{PLAN}-{TASK}` form (e.g. `04-01-02`).

---

## Wave 0 Requirements

New test files must exist (as scaffolds or stubs) before Wave 1 tasks begin. No framework install needed — Vitest 4.1.1 + jsdom 29.0.2 already present in `devDependencies`.

- [ ] `src/tests/project-serialize.test.ts` — PERS-01 snapshot field presence/exclusion + PERS-02 hydrate round-trip + coord stability
- [ ] `src/tests/project-schema.test.ts` — PERS-02 migration seam + validator (`migrate`, `validateV1`)
- [ ] `src/tests/project-io.test.ts` — SHA256 stream, cross-drive path.relative, path resolution, `.clmc` extension enforcement
- [ ] `src/tests/project-store.test.ts` — dirty-flag flow, hydrate-suspend, save-reset
- [ ] `src/tests/project-shortcuts.test.ts` — Ctrl+S / Ctrl+Shift+S routing + text-input guard (reuse `isTextInputActive` pattern)
- [ ] `src/tests/title-bar-dirty.test.ts` — asterisk rendering keyed to `projectStore.isDirty`
- [ ] `src/tests/project-open-routing.test.ts` — extension-sniffing routes `.pdf` to fresh-open, `.clmc` to hydrate path
- [ ] `src/tests/fixtures/sample-1page.pdf` — ~10 KB fixture PDF for SHA256 determinism test (committed to repo)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Missing-PDF modal fires (not silent blank canvas) | PERS-02 success criterion 3 | Requires Electron runtime, OS file-dialog, real PDF open; electron-mock in Vitest cannot exercise renderer ↔ main IPC end-to-end | 1. Open a saved .clmc. 2. Rename the linked PDF. 3. Re-open the .clmc. 4. Confirm modal appears with expected filename + original path + [Browse] + [Cancel]. 5. Cancel; confirm app returns to no-project state. 6. Re-open; Browse; pick correct PDF; confirm load succeeds. |
| Re-link with wrong page count triggers hard-abort | D-26 | Needs actual multi-page PDF and OS file dialog | 1. Save project for `plans-3page.pdf`. 2. Move/rename `plans-3page.pdf`. 3. Open .clmc; in missing-PDF modal, Browse to `plans-5page.pdf`. 4. Confirm abort modal appears — no "load anyway" option visible. 5. Click [Pick again] and confirm returns to file picker. |
| Re-link with dimension mismatch triggers warn (not abort) | D-27 | Needs two same-page-count PDFs with different dimensions | 1. Save project for `plans-a4.pdf` (3 pages, A4). 2. Open .clmc; Browse to `plans-a3.pdf` (3 pages, A3). 3. Confirm warn modal appears with [Open anyway] + [Cancel]. 4. Open anyway; confirm markups render (positions may look offset). |
| Changed PDF bytes triggers hash-mismatch warning | D-12 | Needs real file modification between saves | 1. Save project. 2. Externally modify the PDF (e.g., open in another tool, re-save, even without content changes). 3. Reopen .clmc. 4. Confirm hash-mismatch warn modal fires with [Open anyway] + [Cancel]. |
| Close-window while dirty triggers Save/Discard/Cancel modal | D-16 | Requires Electron main `BrowserWindow.on('close')` interception, not testable in Vitest | 1. Open project, make any markup change. 2. Click window X button. 3. Confirm modal: "Save changes to [filename]?" with [Save] [Discard] [Cancel]. 4. Cancel: confirm app stays open. 5. Re-click X, Discard: confirm app closes. 6. Repeat, Save on never-saved project: confirm Save-As dialog fires. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (7 new test files + 1 fixture PDF)
- [ ] No watch-mode flags (always `vitest run`, never `vitest`)
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
