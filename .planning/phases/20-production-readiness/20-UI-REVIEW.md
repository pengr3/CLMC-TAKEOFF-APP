# Phase 20 — UI Review

## Current Re-audit — Source 68803dd

**Re-audited:** 2026-10-22. Examined `git show 68803dd` and its six affected components only. All seven initial warnings below are resolved. No new source-backed warning or blocker found in this scoped follow-up.

| Pillar | Revised Score | Evidence |
|--------|---------------|----------|
| Copywriting | 4/4 | `LegacyGeometryReview.tsx:32` now distinguishes “1 page needs” / “N pages need.” |
| Visuals | 4/4 | About section headings and prose now have explicit separation under the global reset. |
| Color | 4/4 | Library messages and recovery essential prose use primary text; labelled recovery heading and status border retain caution. |
| Typography | 4/4 | Recovery heading is 14px/600/1.2; actions 13px/600/1.5; candidate/error/table labels explicitly use 600. |
| Spacing | 4/4 | About now uses 8px content/list gaps, 16px section margins and list inset. |
| Experience Design | 4/4 | Presentation-only changes preserve the previously reviewed safety and keyboard flows. |

**Current overall: 24/24.** This is a scoped source assessment, not screenshot, installed-PC or physical-DPI acceptance. No screenshots captured in this follow-up. Exact rendered 60/30/10 area distribution remains unmeasured.

### Disposition of Initial Findings

| Finding | Disposition at 68803dd |
|---------|------------------------|
| COPY-01 | **RESOLVED:** singular/plural geometry count corrected at `LegacyGeometryReview.tsx:32`. |
| VIS-01 | **RESOLVED:** `AboutDialog.tsx:123–166` explicitly separates headings, paragraphs and release-note items, restoring hierarchy. |
| COL-01 | **RESOLVED:** `CostLibraryDialog.tsx:322` renders library message text in `COLORS.textPrimary`; success/cancellation is neutral and live announcement remains. Essential failure prose may also use primary text under the contract. |
| COL-02 | **RESOLVED:** `RecoveryDialog.tsx:259–262` uses primary failure prose and a labelled amber heading; `StatusBar.tsx:118–119` uses primary prose and a 4px amber border. |
| TYPE-01 | **RESOLVED:** `RecoveryDialog.tsx:183` declares the 14px/600/1.2 heading role. |
| TYPE-02 | **RESOLVED:** recovery actions declare 600/1.5 (`RecoveryDialog.tsx:101–103`), candidate/error labels 600 (`:19,262`), and legacy review table headers 600 (`LegacyRateReviewDialog.tsx:68`). |
| SPACE-01 | **RESOLVED:** About uses 8px heading/content/list-item separation and 16px section rhythm; notes loading/unavailable states retain the heading and following-section gaps. |

### Completed Priority Fixes and Verification Limits

All three original priority groups—status colors, About rhythm and recovery typography—are complete, as is the minor singular-copy recommendation. **Outstanding source recommendations: 0; initial warnings resolved: 7.** VIS-01 and SPACE-01 describe two consequences of the same spacing cause.

The six inspected components are AboutDialog, CostLibraryDialog, LegacyGeometryReview, LegacyRateReviewDialog, RecoveryDialog and StatusBar. Commit `68803dd` changes presentation/copy without introducing new control flow. Parent reports five affected suites / 39 tests pass, including the actual Chromium 150-page geometry layout test; those tests were not rerun by this auditor. Previously recorded geometry layout/keyboard evidence remains applicable to that component only.

Physical 100/125/150/200% scaling, monitor transitions, actual historical-project geometry inspection and installed non-development-PC evidence remain pending in the release-validation records. Candidate packaging/inspection remains parent-owned. No competing build, `out`/`dist` changes, implementation edits or commits were performed by this auditor.

## Initial Audit Record — Superseded Scores and Findings

The remainder preserves the initial 19/24 assessment for traceability. Its WARNINGs and proposed fixes are historical and are superseded by the dispositions above.

**Audited:** 2026-10-22  
**Baseline:** approved `20-UI-SPEC.md` (2026-10-21)  
**Screenshots:** not captured (no dev server responding on ports 3000, 5173 or 8080). Source audit supplemented by existing actual Chromium layout/keyboard evidence; no screenshot or physical-monitor acceptance is claimed.

Scope: Phase 20 reliability surfaces, internal exports, recovery, version/About, import, compatibility, and the added legacy-geometry review. Existing workspace styling is retained; inherited library spacing and typography are not treated as newly introduced defects.

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Approved safety copy is substantially present; geometry count remains plural for one page. |
| 2. Visuals | 3/4 | About section hierarchy loses separation under the global margin reset. |
| 3. Color | 3/4 | Library success/cancellation still uses amber; recovery error body inherits amber. |
| 4. Typography | 3/4 | Recovery heading is 16px rather than 14px; recovery actions omit semibold. |
| 5. Spacing | 3/4 | About headings, paragraphs and list have no explicit section/content spacing. |
| 6. Experience Design | 4/4 | No additional source-backed flow defect found in the audited scope; external acceptance remains open. |

**Overall: 19/24**

No BLOCKER identified in this source audit. Findings below are WARNINGs; this is not release acceptance.

## Top 3 Priority Fixes

1. **Use severity-specific status colors** — amber success and cancellation misrepresent a normal outcome. In `CostLibraryDialog.tsx:322`, render success/cancellation in `COLORS.textPrimary`, reserve warning for failure indicators, and render essential recovery error prose in primary text (`RecoveryDialog.tsx:257`).
2. **Restore About section spacing** — global reset collapses its headings, explanations and notes into adjacent lines. Add explicit 8px content gaps and 16px section gaps to the scroll content in `AboutDialog.tsx:123–166`, preserving the existing fixed footer.
3. **Apply recovery typography roles explicitly** — use 14px/600/1.2 for its dialog heading and 13px/600/1.5 for actions; use 600 explicitly on candidate/error labels. This removes the 16px heading and unspecified control/strong weights in `RecoveryDialog.tsx:17,97–105,181,260`.

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **WARNING COPY-01:** `LegacyGeometryReview.tsx:32` always renders “{pending.length} pages need geometry review.” A single affected page reads “1 pages.” Select “1 page needs” versus “N pages need”; keep the explicit export-blocked explanation.
- Positive evidence: `SaveFailureDialog.tsx:54–60,150–161` distinguishes backup failure and first save, preserves the approved changes-still-open explanation, and exposes the actual path/message. `AboutDialog.tsx:7,104–145` provides version/notes unavailable states and manual-update copy. `RecoveryDialog.tsx:190–199,257–277` distinguishes single/multiple candidates and damaged PDF/metadata. Internal-export scope is retained; no client-quotation mode is introduced.
- Geometry instructions (`LegacyGeometryReview.tsx:40–41`) correctly avoid claiming historical coordinate accuracy and direct users to inspect/reposition/recalibrate. This additional quarantine is a review-fix addition, not an invented UI-SPEC feature.

### Pillar 2: Visuals (3/4)

- **WARNING VIS-01:** About’s four `h3` sections and associated paragraphs/list (`AboutDialog.tsx:123–166`) have font-size differentiation but no separating margins or layout gap. `app.css:5–9` resets all margins/padding to zero. Headings therefore directly abut preceding prose, weakening the specified heading → explanation → supplemental information hierarchy. Add section wrappers/gaps rather than increasing text size or changing the workspace.
- Positive evidence: About and recovery use bounded 640px surfaces; save failure uses 420px. Footers remain distinct; one accent primary action is used per decision. Title filename ellipsizes independently of the nonshrinking app/version (`TitleBar.tsx:46–49`). The touched book picker is labelled and at least 28×28 (`CostLibraryDialog.tsx:547,556–557`).
- Existing actual Chromium evidence, recorded in `20-REVIEW-FIX.md` WR-03 and `20-REVIEW.md`: with 150 pending pages, compact geometry feedback is 67px, leaving 371px canvas at 1024×600 and 171px at 1024×400. Expanded instructions leave 288/138px respectively. These measurements support canvas hierarchy for that component only; they do not establish full-app visual acceptance.

### Pillar 3: Color (3/4)

- **WARNING COL-01:** `CostLibraryDialog.tsx:321–324` assigns `COLORS.warning` to every message, including successful replacement and native-picker cancellation. This directly violates “stop showing every library status in amber” and neutral success/cancellation in the contract. Classify message severity explicitly; retain text and live announcement.
- **WARNING COL-02:** `RecoveryDialog.tsx:257` colors the entire recovery failure heading/explanation/detail amber. Essential body errors should use primary text; keep a labelled amber indicator/heading or border to communicate caution. The same principle applies to the persistent warning body at `StatusBar.tsx:118`.
- New surfaces predominantly reuse `COLORS.secondary`, `textPrimary`, `border` and `accent`; recovery has one accent CTA plus a selected-candidate border and focus outline. No unexplained new palette was found. Exact 60/30/10 rendered area distribution cannot be established without screenshots; token usage alone is not proof of that ratio. Hardcoded title text matches the existing primary token (`TitleBar.tsx:46,49`) and is not counted as a new palette violation.

### Pillar 4: Typography (3/4)

- **WARNING TYPE-01:** `RecoveryDialog.tsx:181` uses 16px for a decision heading. The contract reserves 16px for About’s product name; ordinary dialog headings are 14px/600/1.2. Set the recovery heading explicitly to that role.
- **WARNING TYPE-02:** The shared recovery `buttonStyle` (`RecoveryDialog.tsx:97–105`) sets 13px but omits 600 weight and 1.5 line height. Candidate/error `<strong>` (`:17,260`) also has no explicit 600 weight. Apply declared roles rather than relying on browser/Tailwind defaults. `LegacyRateReviewDialog.tsx:73–80` likewise leaves table header weight implicit; declare 600.
- Distribution in newly authored dialog source: body/action 13px, rate details 12px, headings 14px, About product 16px; recovery incorrectly reuses 16px. `app.css:2–3` bundles only Inter 400 and 600. Touched review money cells are right-aligned and tabular (`LegacyRateReviewDialog.tsx:102–107`). Inherited Cost Library 17px heading and preexisting control styles are outside this new-surface typography finding.

### Pillar 5: Spacing (3/4)

- **WARNING SPACE-01:** About’s scroll body (`AboutDialog.tsx:116–166`) does not set gaps/margins on its new sections, paragraphs or release-note list. Because the active reset sets them to zero (`app.css:5–9`), the declared 8px content / 16px section rhythm is absent. Apply explicit scale values to these elements; do not rely on user-agent paragraph/heading margins.
- Explicit new dialog padding, overlay clearance and action gaps otherwise use 16/24/8px; save/recovery button padding is 4px 8px. Geometry feedback uses 8px 16px, 8px control gaps and 4px label gaps (`LegacyGeometryReview.tsx:29–39`). No new arbitrary spacing expansion is needed. Cost Library’s inherited 14px gaps/20px padding are retained, not promoted as new spacing tokens or counted as new defects.

### Pillar 6: Experience Design (4/4)

- **Specific passing finding EXP-01:** `RecoveryDialog.tsx:40–93,116–145,294–357` suppresses zero candidates, contains keyboard focus, focuses preservation during deletion confirmation, blocks duplicate operations, and retains failed deletion feedback. Save-failure controls have shared busy guards and persistent errors (`SaveFailureDialog.tsx:61–78,166–195`). About and compatibility portals inert underlying siblings and restore focus; compatibility confirmation requires explicit acknowledgement of the current rate object (`LegacyRateReviewDialog.tsx:19–20,33–58`). No additional task-breaking defect is established by this audit.
- Import uses operation-specific live busy copy (`CostLibraryDialog.tsx:303–312`) and disables competing import/template actions; rejected previews/error behavior is covered by the existing resilience suites. `CompatibilityDialogFrame.tsx:48–72,98–131` contains Tab/Escape and separates scrolling content from wrapped actions. Actual Chromium Tab/Return to page 150 and confirmation is recorded in WR-03; the previous geometry viewport blocker is fixed.
- Evidence limit: the final 156-file/1193-test regression and actual developer-host positive/negative reopen, single-instance and geometry checks are reported in the independent code review/fix artifacts, not rerun here. Actual historical-project review, installed non-development-PC flows, physical 100/125/150/200% scaling and monitor transitions remain pending in `20-INSTALLED-EVIDENCE.json` / `20-VALIDATION.md`. These are required release evidence, not passing results inferred from this score. Parent owns candidate rebuilding/inspection; this audit did not launch a competing build or touch `dist`/`out`.

## Registry Safety

Registry audit: 0 third-party blocks declared. `components.json` is absent; shadcn registry checks are not applicable.

## Files Audited

- `AGENTS.md`, `.planning/config.json`, `20-CONTEXT.md`, approved `20-UI-SPEC.md`, Phase 20 plans/summaries, `20-REVIEW.md`, `20-REVIEW-FIX.md`, and installed-evidence limitations in `20-09-SUMMARY.md`.
- `src/renderer/src/app.css`, `lib/compatibility-ui.ts`.
- `components/AboutDialog.tsx`, `SaveFailureDialog.tsx`, `RecoveryDialog.tsx`, `CompatibilityDialogFrame.tsx`, `LegacyRateReviewDialog.tsx`, `LegacyGeometryReview.tsx`.
- Targeted source inspection of `CostLibraryDialog.tsx`, `EstimateRow.tsx`, `StatusBar.tsx`, `TitleBar.tsx`, `TopActionBar.tsx`, and `App.tsx` modal coordination.

**Recommendation count:** 3 priority fixes grouping related presentation work; 1 additional minor copy recommendation. Seven individual WARNING findings (VIS-01 and SPACE-01 describe the hierarchy and scale consequences of the same spacing cause). No implementation changes or commits made.
