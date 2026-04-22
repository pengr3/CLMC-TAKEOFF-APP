---
phase: 04-project-persistence
plan: "00"
subsystem: testing
tags: [vitest, tdd, test-scaffolds, project-persistence]

requires:
  - phase: 03.1-markup-gap-closure-and-visual-redesign
    provides: "markupStore, scaleStore, viewerStore shapes that the serialize/hydrate tests will exercise"

provides:
  - "7 red test scaffolds covering all Wave 1-3 project-persistence behaviors"
  - "1 deterministic fixture PDF for SHA256 stream tests"
  - "All Wave 0 test gates for PERS-01 and PERS-02 requirements"

affects:
  - "04-01 (Wave 1): project-schema.ts and project-serialize.ts must green project-schema.test.ts and project-serialize.test.ts"
  - "04-02 (Wave 1): project-io.ts must green project-io.test.ts"
  - "04-03 (Wave 2): projectStore.ts must green project-store.test.ts"
  - "04-04 (Wave 3): TitleBar.tsx + useKeyboardShortcuts.ts must green title-bar-dirty.test.ts + project-shortcuts.test.ts"
  - "04-05 (Wave 3): useProject hook must green project-open-routing.test.ts"

tech-stack:
  added: []
  patterns:
    - "Scaffold-red pattern: imports commented out, all assertions are expect(true).toBe(false) so tests fail on assertion not missing-module"
    - "jsdom-environment header pattern: /** @vitest-environment jsdom */ on literal line 1 for any test importing react-dom/server or touching document"
    - "Minimal hand-written PDF fixture: ~391 bytes, valid PDF 1.4 single blank A4 page — committed as binary fixture for deterministic SHA256 tests"

key-files:
  created:
    - "src/tests/fixtures/sample-1page.pdf"
    - "src/tests/project-schema.test.ts"
    - "src/tests/project-serialize.test.ts"
    - "src/tests/project-io.test.ts"
    - "src/tests/project-store.test.ts"
    - "src/tests/project-shortcuts.test.ts"
    - "src/tests/title-bar-dirty.test.ts"
    - "src/tests/project-open-routing.test.ts"
  modified: []

key-decisions:
  - "All scaffold imports are commented out so scaffolds fail on assertion (expect(true).toBe(false)) rather than module-resolution — Wave 1 implementers swap comment to real import and flip assertions"
  - "title-bar-dirty.test.ts carries /** @vitest-environment jsdom */ on literal line 1 — Wave 3 must preserve this header verbatim when going green"
  - "Fixture PDF is hand-written minimal PDF 1.4 (391 bytes) with %%EOF — small enough to be deterministic, valid enough for pdfjs-dist sniffer"

patterns-established:
  - "Wave 0 scaffold pattern: describe/it names must exactly match 04-VALIDATION.md -t filter strings — these strings are cited in Wave 1+ verify blocks"

requirements-completed:
  - PERS-01
  - PERS-02

duration: 2min
completed: "2026-04-22"
---

# Phase 04 Plan 00: Wave 0 Test Scaffolds Summary

**33 red test assertions across 7 scaffold files gate all Wave 1-3 project-persistence behaviors; fixture PDF committed for deterministic SHA256 tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-22T09:39:11Z
- **Completed:** 2026-04-22T09:41:30Z
- **Tasks:** 2 of 2
- **Files modified:** 8 (7 test files + 1 fixture PDF)

## Accomplishments

- Created `src/tests/fixtures/sample-1page.pdf` (391 bytes, valid PDF 1.4, %%EOF present) for SHA256 determinism tests
- Created 3 pure-function scaffolds (project-schema, project-serialize, project-io) with 16 red tests covering Wave 1 behaviors
- Created 4 integration scaffolds (project-store, project-shortcuts, title-bar-dirty, project-open-routing) with 17 red tests covering Wave 2-3 behaviors
- All 33 scaffold tests fail cleanly on assertion (not import error); 211 existing tests remain green

## Task Commits

1. **Task 1: Fixture PDF + pure-function red-test scaffolds (schema, serialize, io)** - `f22addd` (test)
2. **Task 2: Integration-layer red-test scaffolds (store, shortcuts, title-bar, open-routing)** - `e6aec26` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/tests/fixtures/sample-1page.pdf` — Minimal valid PDF 1.4 fixture (391 bytes) for SHA256 stream comparison tests
- `src/tests/project-schema.test.ts` — 5 red tests: round-trip D-02 fields, migrate v1 identity, migrate unknown version throws, rejects missing formatVersion, accepts valid ProjectFileV1
- `src/tests/project-serialize.test.ts` — 5 red tests: snapshot includes D-02 fields, excludes transient state, hydrate round-trip, hydrate clears undo/redo, coords stable round-trip
- `src/tests/project-io.test.ts` — 6 red tests: sha256 stream equals buffer, cross-drive returns null, enforces .clmc extension, prefers absolute, falls back to relative, returns null when both missing
- `src/tests/project-store.test.ts` — 6 red tests: dirty on place, dirty on scale, dirty on viewport, stays clean on hydrate, clean after save, reset clears
- `src/tests/project-shortcuts.test.ts` — 4 red tests: Ctrl+S first-time Save As, Ctrl+S with path triggers Save, Ctrl+Shift+S always Save As, guard while isTextInputActive
- `src/tests/title-bar-dirty.test.ts` — 3 red tests: asterisk when dirty, no asterisk when clean, falls back to viewerStore.fileName (jsdom env on line 1)
- `src/tests/project-open-routing.test.ts` — 4 red tests: .pdf routes to fresh-open, .clmc routes to hydrate, case-insensitive, unknown extension rejects

## Decisions Made

- Imports kept as comments (not deleted) so Wave 1 implementers see the exact import path to wire — removing comments would lose that signal
- title-bar-dirty.test.ts jsdom header is on literal line 1 with no preceding blank line, matching the spacebar-text-guard.test.ts canonical pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Wave 0 gates are in place; `npx vitest run` exits non-zero (expected — scaffolds are intentionally red)
- Wave 1 plans (04-01, 04-02) can begin implementing against these red test names immediately
- No new dependencies added to package.json — vitest 4.1.1 + jsdom 29.0.2 already present

---
*Phase: 04-project-persistence*
*Completed: 2026-04-22*
