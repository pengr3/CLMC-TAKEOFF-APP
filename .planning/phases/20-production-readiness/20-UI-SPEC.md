---
phase: "20"
slug: "production-readiness"
status: approved
reviewed_at: "2026-10-21"
shadcn_initialized: false
preset: none
created: "2026-10-21"
---

# Phase 20 — UI Design Contract

## Scope and Sources

This contract hardens the existing offline Windows interface for REL-01 through REL-05. Locked sources: `20-CONTEXT.md` D-01 (internal exports only), D-02 (safe saves, one last-good backup, periodic recovery including PDF, restart prompt), D-03 (this contract), ROADMAP Phase 20, REQUIREMENTS and `20-VALIDATION.md`. The dated update at the top of `20-RESEARCH.md` supersedes its historical pending-decision passages.

Retain Plan/Estimate, canvas mounting, Totals, toolbar arrangement, coordinate behavior and local Cost Library. No redesign, cloud service, automatic update service, new component library, or client quotation export. Phase 21 owns pilot acceptance and distribution. Ordinary visual and interaction choices below are implementation defaults derived from source, not additional user approvals.

## Design System

| Property | Value |
|---|---|
| Tool | none; existing manual React components and shared `COLORS` tokens |
| Preset | not applicable |
| Component library | none |
| Icon library | existing `lucide-react`; reuse existing icons |
| Font | locally bundled Inter 400 and 600, system fallback; no network font requests |
| shadcn gate | No `components.json` found; retain manual system under the explicit existing-style/no-new-library constraint; do not initialize shadcn |
| Active stylesheet | `src/renderer/src/app.css`, imported by `main.tsx`; scaffold `assets/main.css` is not the product theme |

There is no installed component design-system package to enumerate. The Component Inventory section is intentionally omitted for `Tool: none`.

### Existing UI Reuse

Source paths below are relative to `src/renderer/src/`; these are source reuse seams, not package exports or a closed allowlist.

| Existing source | Phase 20 use |
|---|---|
| `lib/constants.ts`, `app.css` | Shared surfaces, colors, local font weights |
| `components/TitleBar.tsx`, `TopActionBar.tsx` | Preserve filename/dirty/saving title; expose version and functional More menu |
| `components/SaveCloseModal.tsx`, `OpenErrorModal.tsx` | Existing modal recipe for save/recovery/compatibility messages; add actions where needed |
| `components/ArchiveCorruptedModal.tsx` | Existing checksum warning for project inspection; recovery must validate its own complete snapshot |
| `components/CostLibraryDialog.tsx` | Existing portal, focus containment, search, preview and explicit replace flow |
| `components/StatusBar.tsx`, `App.tsx` | Persistent recovery failure indication and existing transient success feedback |

## Spacing Scale

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Icon/text separation, compact button vertical padding |
| sm | 8px | Actions, table cells, control spacing and dialog content gaps |
| md | 16px | Sections, new dialog padding, warning inset and horizontal button padding |
| lg | 24px | Screen-edge clearance |
| xl | 32px | Major section separation |
| 2xl | 48px | Existing empty-state inset |
| 3xl | 64px | Reserved; no additional page spacing needed |

All new spacing uses only 4, 8, 16, 24, 32, 48 and 64px. Preserve untouched inherited 12px gaps and 20px modal padding without promoting them to new tokens. Preserve existing shell geometry: 32px title, 28px status, 46px toolbar and 34px icon controls; these dimensions are inherited geometry, not new spacing tokens. New dialog buttons have minimum height 28px, radius 4px and padding 4px 8px; dialogs use radius 8px. Do not shrink existing targets. In the touched library rate picker, enlarge the book button hit area to at least 28×28px while retaining its existing icon size.

## Typography

Exactly four sizes and two weights apply to new Phase 20 surfaces; do not globally restyle untouched components.

| Role | Size | Weight | Line Height |
|---|---|---|---|
| Metadata/table detail | 12px | 400 | 1.5 |
| Body | 13px | 400 | 1.5 |
| Label/button | 13px | 600 | 1.5 |
| Dialog heading | 14px | 600 | 1.2 |
| About product name | 16px | 600 | 1.2 |

Use tabular numerals and right alignment for touched money columns. Body errors and decisions use primary text; secondary text is for supplemental metadata. Do not introduce another font weight or web font.

The compact 12–16px type range deliberately follows the inherited estimator workspace density, preserving room for the plan and rate tables. New dialogs use the same familiar scale with semibold headings, readable line heights and scrolling for long content; Windows scaling validation below must confirm readability without shrinking text to fit.

## Color

| Role | Value | Usage |
|---|---|---|
| Dominant (60%) | `#1a1a1a` / `COLORS.dominant` | Existing workspace and large content regions |
| Secondary (30%) | `#252526` / `COLORS.secondary` | Existing panels, new dialogs and inset sections |
| Accent (10%) | `#0078d4` / `COLORS.accent` | Primary recovery/save action, selected controls, keyboard focus |
| Destructive/caution | `#e8a838` / `COLORS.warning` | Discard confirmation and protection/compatibility/import failure indicator; retain explicit text labels |
| Primary / secondary text | `#cccccc` / `#808080` | Essential text / supplemental metadata |
| Border / hover / active | `#3c3c3c` / `#2d2d30` / `#37373d` | Existing borders and interactive states |

The 60/30/10 split describes application chrome; the PDF retains its own colors. Accent reserved for the single primary action in each dialog, existing selected/active controls and a 2px focus outline with 2px offset. Neutral actions retain transparent/dark backgrounds. White text on blue buttons. Success and cancellation use neutral primary text; stop showing every library status in amber. No new success/error palette is required.

## Copywriting Contract

Placeholders are runtime text rendered as text nodes. Show timestamps in local time, including date. Only claim preserved/saved data after the corresponding operation confirms it.

| Element | Copy |
|---|---|
| Primary recovery CTA | Recover Project |
| Explicit save CTA | Save Project; existing toolbar accessible name may remain Save (Ctrl+S) |
| No project heading/body | Open a PDF floor plan to begin / Drag and drop a file here, or use Open above. |
| About heading/version | CLMC Takeoff / Version {installedVersion} |
| Release notes heading | Release Notes |
| Manual update explanation | Updates are installed manually. Ask your internal maintainer for the approved installer. |
| Save busy | Saving… {filename} |
| Save complete | Saved |
| Older revision saved while newer edits exist | Earlier changes saved. Newer changes are still unsaved. |
| Save failed heading/body | Could not save project / Your changes are still open. Close any app using this file and try again, or use Save As to choose another location. |
| Backup failed detail | Could not preserve the previous saved version. The save was stopped. Try another location with Save As. |
| First-save failed detail | No project file was saved. Your changes are still open. Try another location with Save As. |
| Recovery pending heading/body | Recover unsaved work? / A local recovery copy is available from {timestamp}. Recover it to review your changes before saving. |
| Saved-project candidate | {filename} · Last recovery: {timestamp} · Last project save: {savedTimestamp} |
| Never-saved candidate | {pdfFilename} · Not yet saved as a project · Last recovery: {timestamp} |
| Recovery restored | Recovered unsaved work. Save the project to keep these changes. |
| Keep action | Keep for Later |
| Recovery progress | Recovering project… |
| Recovery failure heading/body | Could not recover project / The recovery copy is incomplete or unreadable. It has been kept. Open the last saved project or try again later. |
| Missing/damaged recovery PDF detail | The recovery PDF is missing or damaged. This copy cannot be opened safely. |
| Recovery protection failure | Recovery copy could not be updated. Save your project now. |
| Recovery available again | Recover Unsaved Work |
| Discard action/confirmation | Discard Recovery Copy / Delete this local recovery copy? Its unsaved changes will no longer be recoverable. Your saved project and backup will be kept. |
| Recovery deletion confirmation actions | Keep Recovery Copy / Delete Recovery Copy |
| Discard failure | Could not delete the recovery copy. It has been kept. Try again later. |
| Backup open action | Open Backup Copy |
| Backup opened | Backup opened. Use Save As to create a project copy. |
| Legacy unit warning heading/body | Review rate units / This project was saved without rate units. Current totals use its saved measurement units. Earlier unit changes cannot be verified. Check the affected rates before relying on the estimate. |
| Legacy unit action | Review Rates; acknowledgement: I have checked these rate units; completion: Confirm Rate Units |
| Compatibility heading/body | Project needs a newer version / This project uses a format this version cannot open safely. Ask your internal maintainer for a compatible installer. The file has not been changed. |
| Save compatibility warning | Saving will use this version’s project format. Older versions may not preserve rate units correctly. Keep a separate pre-upgrade copy if you need to return to an older version. |
| Format upgrade confirmation actions | Keep Original Project / Save Upgraded Copy |
| Legacy missing-source error | The PDF used by this older project is unavailable. Restore it at the original location and open the project again. Your current project has been kept. |
| Library parsing busy | Checking workbook… Your current library is unchanged. |
| Library replacement busy | Replacing library… |
| Workbook timeout | Import took too long and was stopped. Your current library was kept. Remove unused sheets or use the CSV template, then import again. |
| Workbook resource rejection | This workbook exceeds the import limits. Your current library was kept. Remove unused sheets or use the CSV template, then import again. |
| Workbook parser failure | Could not read this workbook. Your current library was kept. Save a new copy in Excel or use the CSV template, then import again. |
| Library success/cancellation | Preserve existing Library replaced on this PC. Existing project rates are unchanged. / Library import cancelled. Your current library is unchanged. |
| Empty library/search | Preserve existing No cost library on this PC. Download the template, fill your rates, then import it. / No matching items. Try another search. |
| Library replacement confirmation | Preserve existing Replace the complete library on this PC? Existing estimates keep their saved rates. / Replace Library |

## Interaction Contract

### Version and release notes — REL-01

Append the installed version obtained through the trusted app bridge to the existing title’s application segment: `{filename}{dirtyMark} — CLMC Takeoff {version}`. Keep app/version visible when the filename truncates; the complete filename is available by tooltip. Preserve the Saving… prefix and dirty asterisk. Do not show a guessed version while the version request is pending; a failed lookup exposes Version unavailable in About and must fail release acceptance.

Wire the existing More button into a keyboard menu with About CLMC Takeoff and, when recovery entries exist, Recover Unsaved Work. About opens a 640px maximum-width dialog containing product/version, bundled release notes for the installed release, compatibility/backup explanation and manual-update copy. Release notes scroll within the dialog; Close stays available. No browser launch or connectivity is needed. Build/test metadata is not routine product copy. Missing release notes show Release notes are unavailable in this installation. Ask your internal maintainer for this version’s notes. This fallback is a release-validation failure, not a successful notes implementation.

### Explicit save and backup — REL-04

All toolbar and keyboard save paths share visible busy/result/failure handling. Disable repeated save/Save As and destructive project switches during the transaction; no duplicate requests. Title indicates Saving…. If editing remains allowed, newer changes retain the asterisk after the captured revision saves and use the older-revision copy instead of Saved. Dialog close/open guards continue only after the requested save succeeds; cancellation/failure stays in the current project.

Show a persistent modal on failure, using the existing 420px modal recipe and Close, Save As, Try Again actions. Explain the failed stage with the applicable detail from the copy table; preserve original file, latest valid backup, live changes and dirty state. Do not claim a backup exists on a first save. When backup creation fails, stop replacement and show the backup-specific failure. Successful backup maintenance is silent and retains one last-good version; About explains its actual location and how to open it using the native Open picker. On a saved-project open failure with a validated adjacent backup, offer Open Backup Copy alongside Close. Opening the backup never overwrites the original; treat it as unsaved and route the next Save through Save As.

### Periodic recovery and restart — REL-03, REL-04

Use local completed snapshots containing matching project metadata and PDF bytes. Default schedule: attempt a dirty snapshot at most once per 60 seconds while edits exist; no snapshot writes when unchanged and no full-PDF rewrite per keystroke. This interval is an engineering default, not a guarantee that every final edit survives a crash. A recovery write never clears dirty state or produces Saved. Recoverable state includes markup positions, per-page scale, rates with unit basis, category/item order and PDF. The local cost library is independent and is not replaced during recovery.

On restart, scan completed candidates before presenting the decision. Zero candidates produces no prompt. One candidate shows its metadata directly; multiple candidates use a scrollable single-selection list with newest first, one latest completed snapshot per project/session, and singular/plural copy. Do not silently delete a kept candidate to admit new data; if the bounded repository cannot retain existing candidates plus a new snapshot, retain existing data and show the recovery-protection failure. Storage caps and cleanup implementation belong in the plan.

The 640px recovery dialog offers Keep for Later, Discard Recovery Copy and Recover Project. Initially focus Recover Project for a valid selected candidate. Escape is Keep for Later; clicking the backdrop does nothing. Keep closes the prompt without deleting data or repeatedly prompting in the same session; More → Recover Unsaved Work reopens it and restart offers it again. Discard opens a separate explicit confirmation with Keep Recovery Copy focused and Delete Recovery Copy as the caution action. Escape invokes Keep Recovery Copy. Enter must never turn a selection into deletion. A failed deletion preserves the entry and reports the error.

Recover Project validates the candidate and embedded PDF before changing any active stores. While recovering, show progress and prevent duplicate actions. For a saved project, restore the source association and mark dirty; Save uses the normal protected transaction, and Save As remains available. If its source path is unavailable/read-only, Save falls back to the native Save As route. For a never-saved project, restore without a project destination; Save always opens Save As. Neither restore automatically writes to an original project. Keep the recovery candidate until a matching explicit save succeeds; later edits require their own recovery revision.

Missing/corrupt metadata or PDF: retain the entry and current project, show the specific error and Keep for Later/Discard Recovery Copy; allow retry after external repair. Do not present a successful blank canvas, auto-select a different PDF, or apply metadata to an unrelated PDF. A checksum-mismatched recovery candidate cannot be restored through Open anyway. Normal project inspection can retain the existing ArchiveCorruptedModal path. Opening another project while restored changes are dirty uses the existing Save/Discard/Cancel guard; explicit discard of those live changes must also retire the corresponding recovery so discarded edits do not reappear.

A periodic snapshot failure produces a persistent, readable status warning with Save Project action; successful retry clears it. Repeated background failures update the same warning rather than stacking dialogs. Recovery not-yet-complete is never advertised as protected.

### Unit basis and compatibility — REL-03, REL-05

Persist explicit rate units for newly entered/applied rates. Quantity UoM and material/labor rates must describe the same basis in Estimate and both internal exports; changing display units converts the shown rate inversely and leaves cost, price and margin invariant. Manual edits apply per the visible UoM. Counts remain per piece; walls retain their actual area basis. Keep exact-match Cost Library selection; this phase does not introduce arbitrary library-unit conversion.

When legacy priced data has no basis, retain its initial existing totals and show the legacy warning before the user relies on changed units or exports. Show affected item name/type, proposed basis from the saved display unit (wall area uses its existing area basis), and current rates in a scrollable review area. Require the explicit acknowledgement before Confirm Rate Units. Review Rates opens that area; cancellation keeps the warning pending, preserves the project and leaves exports/unit changes gated for unresolved affected rates. Acknowledgement records reviewed basis, marks the project dirty and does not claim historical accuracy. Do not silently dismiss the warning on reopen before the reviewed basis is saved.

Explain format/rollback compatibility before the first save that upgrades an older priced project; offer Keep Original Project and Save Upgraded Copy (native Save As). Keep Original Project dismisses this save attempt and leaves current edits open; Escape invokes that action. Keep the original pre-upgrade file. Unsupported future formats show the compatibility error, leave the active project intact and cannot be overwritten. Legacy source-PDF migration failures show the missing-source copy; valid embedded projects never request their original source path.

### Cost import resilience — REL-02, REL-05

Retain the existing template → import → preview → Replace Library flow. Replace generic Working… with operation-specific copy. During checking/replacing set `aria-busy`, announce status, disable competing import/template/apply/replace actions, and contain keyboard events. The app must remain responsive; the plan must implement an enforced parser deadline and record its measured limit. No fabricated percentage or promise of cancellation before the backend can stop work. At timeout/resource rejection/parser crash, clear busy state and stale preview selection, retain the committed library/project rates, announce the appropriate failure and re-enable Import CSV / Excel and Close. Never show Replace Library for rejected candidates.

Keep existing row-limit/error-list and search-cap behavior with accurate counts. Error text persists until retry/close. Native file-picker cancellation is neutral feedback. Right-align numerical library columns and keep codes/descriptions readable; status severity uses text as well as color.

### Dialogs, long text, keyboard and DPI — all UI requirements

The PDF canvas remains the primary visual workspace anchor; surrounding controls and reliability feedback support reading and measuring the plan. Each new decision dialog establishes a heading → explanation/message → primary action hierarchy: semibold heading first, essential body copy next, optional metadata subordinate, then the footer with one accent primary action and neutral alternatives. Destructive confirmation retains its labelled caution action and initially focuses the preservation action.

Use a single active modal decision at a time, portal above canvas/menus, existing dark overlay, labelled dialog semantics and no underlying canvas keyboard/pointer actions. Trap Tab/Shift+Tab, restore focus to the invoking control, and handle Enter on the focused control rather than a container-wide save/delete shortcut. Escape cancels/keeps; busy transactions do not dismiss through Escape. More menu supports Enter/Space, arrows and Escape. Preserve Ctrl+S, Ctrl+Shift+S and Ctrl+Shift+E outside dialogs; none bypass a disabled state or unresolved unit warning. Stop propagation for destructive/global canvas shortcuts while typing or using a dialog.

Dialogs use width `min(420px, calc(100vw - 48px))`, expanded review/About/recovery uses 640px, maximum height `calc(100vh - 48px)`, internal content scrolling and wrapping footer actions. Existing Cost Library retains its 900px maximum width but must keep header/footer visible with the table as its scroll region. Long names wrap with `overflow-wrap:anywhere` inside dialogs; no truncated decision-critical path, failure reason or unit label. Full paths are selectable/copyable; title/status filenames may ellipsize with a complete tooltip. Constrain draggable dialogs after viewport/DPI changes so their Close/action row remains reachable. Compact toolbar may horizontally scroll at reduced effective width; version/About and recovery commands stay reachable.

Use CSS pixels for UI and devicePixelRatio only for rendering sharpness. Test 100%, 125%, 150%, 200% Windows scaling where supported, including reduced effective window size, long filenames/item names, large prices, keyboard-only use, and a monitor/DPI transition. No text scaling or dialog reflow changes stored markup coordinates, PDF calibration or pointer alignment. Avoid new animation; honor reduced motion for any reused transition.

## Acceptance Evidence

| Scenario | Required observable result |
|---|---|
| Offline fresh install and manual upgrade | Correct installed version and bundled notes; preserved project/library; no web/update dependency |
| Save failure at write/backup/replace stage | Dirty state survives; actionable persistent failure; original/last-good file remains valid; retry/Save As works |
| Edit during save | Saved revision acknowledged; newer changes still visibly unsaved |
| Saved and never-saved interruption | Restart lists valid recovery with timestamp; PDF/state restore; no source file overwritten before explicit save |
| Keep/discard/multiple candidates | Kept entries remain discoverable; selected deletion requires confirmation; failed deletion reports retention; zero shows no prompt |
| Missing/corrupt recovery PDF | No partial hydration; candidate retained; specific failure and safe remaining actions |
| Backup and compatibility | Backup opens as a copy; unsupported project remains untouched; first upgraded save preserves pre-upgrade original |
| Price/display units | Count, length, perimeter, area and wall costs invariant; UI/export UoM match rates; legacy review cannot silently bypass |
| XLSX timeout/resource/parser failure | UI responds; busy ends; no replacement preview; library and applied project rates remain unchanged; retry works |
| Large PDF/long text/DPI/keyboard | Known plan points/measurements survive pan/zoom/reopen; actionable content fits/scrolls; focus stays in dialog and returns |

Use the existing Vitest/DOM infrastructure for meaningful interaction cases plus actual installed non-development-PC evidence from `20-VALIDATION.md`. Record exact candidate version/hash, machine/scaling, fixture, expected/actual and tester/date. This document prescribes behavior; it does not claim tests, installed validation, pilot approval or distribution have occurred.

## UI Considerations

Autonomous probe resolution approved by the user. Element kinds were reviewed against the contract and supplied as explicit unions; every applicable category has a concrete acceptance criterion.

| Element/category | Status | Verification | Acceptance criterion |
|---|---|---|---|
| UI-01/loading | resolved | explicit | Version lookup displays no guessed version; About remains usable while loading. |
| UI-01/error | resolved | explicit | Version or bundled release-note failure displays the specified unavailable copy and fails release acceptance. |
| UI-01/overflow | resolved | explicit | Offline release notes scroll internally while Close remains visible. |
| UI-01/long-text | resolved | explicit | Long filenames cannot hide app/version; dialog text wraps and decision-critical text stays readable. |
| UI-02/loading | resolved | explicit | Every save path displays Saving and rejects duplicate saves or destructive switches. |
| UI-02/error | resolved | explicit | Write, backup or replacement errors retain dirty state and display persistent retry/Save As choices. |
| UI-02/overflow | resolved | explicit | Failure detail scrolls or wraps within the viewport with every action reachable. |
| UI-02/long-text | resolved | explicit | Save errors and destination paths wrap without hiding the cause or retry actions. |
| UI-03/empty | resolved | explicit | Zero completed recovery candidates produces no restart prompt. |
| UI-03/loading | resolved | explicit | Recovery scanning/restoring reports busy state and prevents duplicate restore or deletion. |
| UI-03/error | resolved | explicit | Corrupt metadata or missing/corrupt PDF retains the candidate and active project and displays specific safe actions. |
| UI-03/populated | resolved | explicit | Completed candidates display filename or Unsaved project, timestamp and destination association, newest first. |
| UI-03/partial | resolved | explicit | Incomplete recovery snapshots are never offered as valid protected work; no partial hydration occurs. |
| UI-03/overflow | resolved | explicit | Candidate list scrolls with recovery actions visible and keyboard selection reachable. |
| UI-03/zero-one-many | resolved | explicit | Zero prompts are suppressed, one candidate shows details directly, multiple candidates allow single selection. |
| UI-03/long-text | resolved | explicit | Long candidate names and paths wrap; Enter never causes deletion and Escape keeps recovery data. |
| UI-04/empty | resolved | explicit | Projects without unresolved legacy rates show no legacy review warning. |
| UI-04/loading | resolved | explicit | Confirmation is disabled while upgrade/review save work is in flight and cannot bypass save guards. |
| UI-04/error | resolved | explicit | Unsupported formats or failed upgraded-copy saves preserve active state and the original file. |
| UI-04/populated | resolved | explicit | Affected rates list name/type, proposed unit basis and current rates before explicit acknowledgement. |
| UI-04/partial | resolved | explicit | Any unresolved affected basis keeps warning and export/unit-change guard active. |
| UI-04/overflow | resolved | explicit | Rate-review list scrolls while acknowledgement and confirmation remain accessible. |
| UI-04/zero-one-many | resolved | explicit | Review supports zero, one and multiple affected rates without silently omitting an item. |
| UI-04/long-text | resolved | explicit | Long item names, units and numeric rates remain readable with wrapping and tabular right-aligned amounts. |
| UI-05/empty | resolved | explicit | Empty library and empty search retain the specified distinct instructions. |
| UI-05/loading | resolved | explicit | Checking and replacing show operation-specific busy copy and disable competing actions. |
| UI-05/error | resolved | explicit | Deadline, resource rejection or parser failure clears stale preview/busy state and retains library/project rates. |
| UI-05/populated | resolved | explicit | Valid preview retains accurate counts, required columns and explicit Replace Library action. |
| UI-05/partial | resolved | explicit | Invalid workbook rows prevent partial replacement and keep row-specific errors visible. |
| UI-05/overflow | resolved | explicit | Library table scrolls independently with header/footer visible at reduced effective screen width. |
| UI-05/zero-one-many | resolved | explicit | Empty, single-row and many-row results retain accurate counts and row-limit feedback. |
| UI-05/long-text | resolved | explicit | Library names and codes remain readable; decision-critical errors and actions wrap within the viewport. |


## Registry Safety

Not applicable: shadcn is not initialized, no third-party registry/block is declared or introduced, and no remote component content is fetched.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS (not applicable for Tool: none)

**Approval:** independent UI checker approved all seven dimensions on 2026-10-21; post-verification consideration probe resolved explicitly.
