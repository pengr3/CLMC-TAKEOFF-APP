---
phase: 21-user-guide-and-internal-handover
status: preparation_verified_human_needed
checked: "2026-10-23"
mode: inline_codex_adapter
---

# Offline guide preparation evidence

This record covers source/structure/data checks on the development PC. It does not accept HAND-01, Phase 20, the two-PC pilot or distribution. No independent reviewer or rendered-browser walkthrough was used.

## Provenance and protected bytes

Frozen application source: `9a0349f`; version 1.1.0. Actual `dist/release-manifest.json` agrees with the inspected candidate:

| Artifact | SHA-256 |
|---|---|
| Full 136810568-byte x64 installer | `fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544` |
| Packaged ASAR | `5fd667ca5dfc02df8aa4addbd6866a0eb603c0c9fa2dfe748a47c7122861fabd` |
| Tracked training project | `c8a466c0886ad40fb792771646b7d64f8dd7af6da26909a665ffdfa291d156cb` |
| Embedded and standalone synthetic PDF | `9c0bc7b6f133905fc62b7dff8abec2e78c0beb078f3ddcdddb57c157ed025e10` |

Inherited quick task `261022-p4n-prepare-offline-guide-worked-example-mai` supplies the original guide, two actual installed screenshots and examples; its verification remains human_needed. Its original installer had a different hash; that historical scope is retained. The current kit was refreshed during Phase 20 at the current candidate; this execution never regenerated it. Guide binary handling remains in `docs/offline-guide/.gitattributes` (there is no repository-root attributes file).

The probe run compared SHA-256 before/after for **32 files**: all tracked example/image bytes, the complete existing kit including its editable results and manifest, plus the current installer/ASAR/release manifest. All were identical. Machine-readable hashes and probe results: `.planning/tmp/21-guide-probes-1792724803884/results.json`. This temporary evidence is local; the essential results and candidate identifiers are retained here.

## Focused validation

`node scripts/verify-handover.cjs` passes: one HTML document, 14 local references, two images with nonempty descriptive alt, six training rows, cost 740 / selling 962 / margin 222. Initial intact run took 13,770 ms; refined-guide run took 9,541 ms. Node v24.13.0 and existing JSDOM/JSZip/ExcelJS were used without new dependencies.

The checker imports only `verifyExample`, never the kit mutation entry point. It checks root containment (including resolved paths), local href/src/fragments, linked CSS/HTML resources, CSS imports/URLs, image alternatives and unexpected active content. It does not execute scripts, load a browser, write files or install anything. `realpathSync` retains canonical containment checks because the native async realpath returned EPERM in this restricted Windows session.

Scoped ESLint, Prettier formatting and `node --check` completed with exit 0 for the checker. Subsequent intact-guide runs took 18,757 ms, 18,535 ms and 12,026 ms; the 32-file protected baseline still matched after preparation. This is focused tooling validation, not a new application regression pass.

Independent geometry uses Euclidean lengths, shoelace area and wall height; independent prices use quantity × material/labor rates and markup. ZIP CRC, embedded PDF identity, format/basis/rates and separate XLSX/CSV readback are checked. The displayed HTML table is also compared to the independent oracle. Floating arithmetic is checked within 1e-7; 739.9999999999999/961.9999999999999 are represented as 740/962 for training money.

Eight separate disposable copies rejected their intended corruption: missing local link, wrong CSV grand total (963), wrong displayed row total (196), missing anchor, parent-root traversal, remote CSS import, empty image alt and absolute Windows path. The first broad CSV mutation changed only a subtotal the inherited oracle does not inspect; the negative fixture was corrected to target the independently checked grand total. No false negative was relabeled as a pass. CLI exit-1 checks for missing-link and wrong-export-value are recorded separately in the same results JSON. Finish each task with the intact guide passing.

## Guide-to-control audit

All eight sections were reviewed against the current source and existing candidate-bound manual evidence. This is a source audit, not a new installed walkthrough.

| Guide section | Reviewed source / observed contract | Result |
|---|---|---|
| 1 Get started | `TopActionBar.tsx`, `ToolRail.tsx`, `ScalePopup.tsx`, `ScaleContextMenu.tsx`, `useViewportControls.ts`: file actions, Plan/Estimate, pan/zoom, per-page calibration and Confirm | Refined the scale arrow/menu instructions to the actual **Verify scale** and **Recalibrate** labels. |
| 2 Worked example | Read-only `verifyExample`; tracked ZIP/PDF and independent XLSX/CSV/HTML numeric readback | Five tool types plus intentionally unpriced second area; six quantities and 740/962/222 checked. Synthetic/actual-screenshot provenance retained. |
| 3 Draw/check/edit | `CanvasViewport.tsx` selection/vertex edit/Enter/Escape and `ToolRail.tsx`; snap and arc refs/shortcut hook | Existing instructions match drawing minimums, handle correction/cancel, undo, snap F3/Alt and arc A/Shift+A. Legacy geometry review and export block retained. |
| 4 Costs/libraries/units | `CostLibraryDialog.tsx`, `src/shared/cost-library.ts`, `rate-units.ts`, `apply-library-rate.ts` | Exact six headers and template/import/replace/apply labels checked. Added supported units, cross-category same-name/type scope and explicit manual override/reapply behavior. Matching-unit application, reciprocal conversion and project snapshots retained. |
| 5 Save/transfer/recover | `useProject.ts`, `docs/release-compatibility.md`, Phase 20 `20-MANUAL-EDGES.md` | One adjacent last-good backup, embedded-PDF transfer, upgraded-copy limits, approximately 60-second recovery, 20 candidates/4 GiB, detached backup and failed-save instructions match. Prior actual tests retain their respective candidate scopes. |
| 6 Export | `TopActionBar.tsx`, `useExport.ts` and independent example readback | XLSX/CSV and UTF-8/comma guidance retained. Explicit material/labor/internal margin warning and deferred client quotation scope retained. |
| 7 Keyboard | `useKeyboardShortcuts.ts`, canvas drawing/vertex handlers | Corrected blanket text-field claim: guarded file/undo/selection/delete commands defer to typing, F3 remains available; finish editing before page/zoom navigation. Existing key combinations retained. |
| 8 Troubleshooting | Library shared limits/errors, compatibility document and source behaviors above | Added complete-folder/recopy guidance for missing local files. Retained actionable save/import/PDF/legacy advice and explicit **Support contact pending assignment**. |

Guide date advanced to 23 October; no controls, application source, dependencies or example/image bytes changed. No Phase 20 covered document was modified by Plan 21-01. The local checker does not verify image appearance or human comprehension. The candidate's regression qualification remains unchanged: initial full 1225/1229 pass, four affected files passing isolated reruns, intermittent parser review still open.

## Human evidence still required

All 16 states in `21-UI-SPEC.md` remain unobserved: E1 empty/loading/error/populated/partial/overflow/zero-one-many/long-text; E2 loading/error/overflow/long-text; E3 empty/loading/error/populated. A permitted human must inspect normal/narrow/zoomed/print layout, keyboard focus, links, tables, long content and image fallback, then real estimators must follow the guide on two actual PCs and representative jobs. Static JSDOM checks do not prove these observations.

The inherited browser file-protocol denial was respected: no alternative browser/local server was used. Owner/support assignments, Phase 20 actual target-PC/representative/historical-PDF/display checks, release/signing/dependency/stability decisions, pilot acceptance and remaining-ten approval/installs remain pending. The existing kit intentionally retains its prior guide revision and returned results; distribute no revised kit without a fresh reviewed destination and integrity manifest.
