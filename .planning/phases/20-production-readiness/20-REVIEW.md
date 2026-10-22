---
phase: 20-production-readiness
reviewed: 2026-10-22T04:09:40Z
depth: standard
iteration: 3
diff_base: d0bcee9
fix_diff_base: 83527d2
source_head: 38cb5d2
files_reviewed: 85
files_reviewed_list:
  - electron-builder.yml
  - electron.vite.config.ts
  - package.json
  - resources/release-notes.json
  - resources/third-party-notices.json
  - scripts/prepare-release.cjs
  - scripts/smoke-electron-host.cjs
  - scripts/smoke-packaged.cjs
  - scripts/verify-release-evidence.cjs
  - scripts/verify-release.cjs
  - src/main/app-identity.ts
  - src/main/cost-library-import.ts
  - src/main/cost-library-ipc.ts
  - src/main/cost-library-worker.ts
  - src/main/cost-library.ts
  - src/main/index.ts
  - src/main/ipc-handlers.ts
  - src/main/project-io.ts
  - src/main/project-recovery.ts
  - src/main/project-storage.ts
  - src/main/release-info.ts
  - src/main/workbook-admission.ts
  - src/main/yauzl.d.ts
  - src/preload/index.d.ts
  - src/preload/index.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/components/AboutDialog.tsx
  - src/renderer/src/components/CanvasViewport.tsx
  - src/renderer/src/components/CompatibilityDialogFrame.tsx
  - src/renderer/src/components/CostLibraryDialog.tsx
  - src/renderer/src/components/EstimateRow.tsx
  - src/renderer/src/components/LegacyRateReviewDialog.tsx
  - src/renderer/src/components/OpenErrorModal.tsx
  - src/renderer/src/components/PdfPageImage.tsx
  - src/renderer/src/components/RecoveryDialog.tsx
  - src/renderer/src/components/SaveCloseModal.tsx
  - src/renderer/src/components/SaveFailureDialog.tsx
  - src/renderer/src/components/StatusBar.tsx
  - src/renderer/src/components/TitleBar.tsx
  - src/renderer/src/components/TopActionBar.tsx
  - src/renderer/src/components/UpgradeProjectDialog.tsx
  - src/renderer/src/hooks/useCloseGuard.ts
  - src/renderer/src/hooks/useDraggable.ts
  - src/renderer/src/hooks/useExport.ts
  - src/renderer/src/hooks/usePdfDocument.ts
  - src/renderer/src/hooks/usePdfRenderer.ts
  - src/renderer/src/hooks/useProject.ts
  - src/renderer/src/hooks/useReleaseInfo.ts
  - src/renderer/src/lib/apply-library-rate.ts
  - src/renderer/src/lib/boq-aggregator.ts
  - src/renderer/src/lib/boq-types.ts
  - src/renderer/src/lib/compatibility-ui.ts
  - src/renderer/src/lib/legacy-rate-guard.ts
  - src/renderer/src/lib/pdf-page-cache.ts
  - src/renderer/src/lib/project-schema.ts
  - src/renderer/src/lib/project-serialize.ts
  - src/renderer/src/lib/rate-units.ts
  - src/renderer/src/stores/markupStore.ts
  - src/renderer/src/stores/projectStore.ts
  - src/renderer/src/stores/scaleStore.ts
  - src/shared/cost-library.ts
  - src/shared/project-validation.ts
  - src/shared/release-info.ts
  - src/shared/reliability.ts
  - scripts/smoke-reopen.cjs
  - src/renderer/src/components/LegacyGeometryReview.tsx
  - src/tests/atomic-write.test.ts
  - src/tests/category-financial-integrity.test.ts
  - src/tests/future-destination-preservation.test.ts
  - src/tests/legacy-geometry-review.test.ts
  - src/tests/project-compatibility-ui.test.ts
  - src/tests/project-store.test.ts
  - src/tests/recovery-flow.test.ts
  - src/tests/recovery-repository.test.ts
  - src/tests/smoke-candidate-identity.test.ts
  - src/tests/smoke-reopen-transition.test.ts
  - src/tests/use-export-hook.test.ts
  - scripts/smoke-geometry-layout.cjs
  - scripts/smoke-single-instance.cjs
  - src/tests/app-version.test.ts
  - src/tests/geometry-review-layout.test.ts
  - src/tests/helpers/geometry-layout-entry.tsx
  - src/tests/host-security.test.ts
  - src/tests/identity-storage.test.ts
  - src/tests/single-instance-bootstrap.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 20: Code Review Report

**Reviewed:** 2026-10-22T04:09:40Z

**Depth:** standard; GSD automatic re-review, iteration 3

**Scope:** 85 cumulative files: original 64-file IR scope, iteration-1 fixes/support retained through the 77-file second review, and eight additional ownership/layout/support files. Every file changed in `83527d2..38cb5d2` was read for this iteration. Unchanged files retain the preceding review coverage.

**Status:** clean — no unresolved findings remain in this scoped source review.

## Narrative Findings (AI reviewer)

All eight previously reported findings have substantive corrections and regression coverage. This iteration traced startup ownership, second-launch activation, recovery publication and cleanup, and the actual bounded geometry-review component. No remaining concrete bug, security vulnerability or quality defect was found in these changes. This is a scoped code-review conclusion, not whole-application security certification or installed-release acceptance.

The approved Electron 44.9.3 choice and internal-export/recovery scope are preserved. No source files, dependency versions or commits were modified by the reviewer.

## Resolved findings

The following entries are historical dispositions, not active findings; frontmatter counts correctly remain zero.

| ID | Previous classification | Re-review disposition |
| --- | --- | --- |
| CR-01 | BLOCKER | New snapshots record the canonical per-page basis. Unrecorded legacy geometry enters persistent visible review, retains raw coordinates without guessing historical DPR, clears untrusted calibration and blocks exports until explicit verification/recalibration. Legacy source files, including older format-3 files, remain protected through Save Copy. Review state survives persistence/recovery. |
| CR-02 | BLOCKER | Independent bounded version inspection precedes current-layout admission. Newer versions and unclassifiable/unknown layouts fail closed without replacing the destination; preservation controls cover additional members and changed layouts. |
| CR-03 | BLOCKER | Category admission checks uniqueness, known references and coverage of used category IDs. Aggregation also emits each actual bucket once, preventing duplicate or omitted financial totals. Fixture corrections retain the stronger admission rule. |
| CR-04 | BLOCKER | Serialized orphan reconciliation runs before quota admission and after failures; restart leftovers no longer cause the original quota deadlock. Unreadable completed manifests conservatively retain potentially referenced blobs. |
| CR-05 | BLOCKER | Startup pins the shared userData identity, then acquires Electron's cross-process single-instance lock before ready, IPC registration, window creation or repository initialization. Denied contenders exit without entering that initialization branch. The owner retains exclusive recovery access. Second launches restore/show/focus the existing window; early activation is remembered, and launch arguments do not replace the active document or bypass its close guard. The actual two-process regression now preserves the acknowledged PDF. |
| WR-01 | WARNING | Packaged smoke measures the actual executable/resource/unpacked inventory and installer before/after execution, checks observed executable/ASAR paths and exact approved runtime, and emits verified identities. Hash mismatch controls preserve file size/version to exercise the real identity checks. |
| WR-02 | WARNING | Both smoke harnesses prove an initially false, real red-document-to-saved-blue-document UI transition, distinctive persisted rates/scale/total, and a fresh renderer Save As/readback. A real injected read/open error produces failure rather than a passing reopen claim. |
| WR-03 | WARNING | The actual component now has a constant control count, compact page selection and a scrollable 25-dvh instruction region with reachable current-page controls. The 150-page native Chromium layout/keyboard regression confirms useful canvas space at both tested heights. |

## Verification performed in this iteration

Read the cumulative `20-REVIEW-FIX.md`, all ten files changed in `83527d2..38cb5d2`, the full current main bootstrap, the new production component, real-process/native-layout harnesses and their regression tests. Startup order is explicit in the production source: `pinUserData` → `requestSingleInstanceLock` → owner-only `whenReady` and shared handler/repository registration.

The reviewer independently reran these focused checks against current built output/source:

| Check | Actual result |
| --- | --- |
| `node scripts/smoke-single-instance.cjs` | Exit 0. `acknowledged:true`, `readable:true`, one activation/focus/restore, and `contenderInitialized:false`. Uses two real Electron processes and real recovery disk I/O. |
| `node scripts/smoke-geometry-layout.cjs` | Exit 0. Actual production component with 150 flagged pages; keyboard navigation and confirmation passed. At 1024×600: 67-pixel banner, 371-pixel canvas, three buttons; expanded instructions: 150/288 pixels. At 1024×400: 67/171 pixels; expanded: 100/138 pixels. |

The parent-reported final 156-file/1193-test regression, typechecks/build, scoped lint, positive host smoke and actual negative-open run were reviewed as supporting context. They were not rerun wholesale or treated as proof of unrelated behavior. Existing unchanged CanvasViewport lint debt is not represented as a new issue.

## React checklist applied to Electron

| Area | Re-review assessment |
| --- | --- |
| Hooks/state | The page-input ref is unconditional; store-derived page/review/calibration state and the existing confirmation action preserve the pending-review contract. |
| Async and lifecycle behavior | Owner-only startup precedes shared I/O; contender activation leaves document state and close protection intact. No new renderer IPC capability was introduced. |
| Input, accessibility and viewport behavior | Native page input, validated Go, Next Unverified, busy guards, explicit accessible confirmation and bounded instructions were traced. Actual Chromium keyboard and bounds checks passed. |
| Framework applicability | No Next.js/SSR/network-fetching guidance or performance-only suggestions were applied to this offline Electron review. |

## Remaining release gates

The installer, release manifest and packaged-smoke evidence remain stale relative to source `38cb5d2`. The parent must rebuild, inspect and rebind the final candidate before claiming packaged verification. This known remaining work is not a source defect or a passing candidate result.

Actual historical-project geometry review, physical Windows scaling/monitor transitions, deployed-predecessor upgrade, non-development-PC validation and Phase 21 pilot acceptance remain external evidence gates. A clean source review does not satisfy those gates or mark the phase accepted.

---

_Reviewer: gsd-code-reviewer_

_Depth: standard; iteration: 3_
