# Phase 21 research — reuse the offline handover already prepared

Date: 2026-10-23. Method: local source/artifact audit, inline under the Codex skill adapter. No independent researcher was dispatched. Research proceeds under the user's autonomous continuation instruction. No new packages or external services are needed.

## Findings and evidence

| Area | Existing evidence | Planning consequence |
|---|---|---|
| User guide | `docs/offline-guide/index.html`: eight anchored sections, worked example, five markup types, edits, library, units, recovery, exports, shortcuts and troubleshooting | Refine and verify this guide; preserve the current app UI and local-only assets. |
| Training oracle | `scripts/prepare-trial-kit.cjs` exports `verifyExample`; independently reads ZIP/PDF, geometry, rate bases, XLSX and CSV; six rows total 740 cost / 962 selling / 222 margin | Reuse the tracked training artifacts; synthetic results never satisfy representative construction-plan acceptance. |
| Delivery | Existing `dist/trial-kit`, manifests, read-only examples and editable result worksheet; preparation refuses to overwrite an existing kit | Preserve returned results. Use a new reviewed destination or explicit archive before refreshing; no unnecessary application rebuild. |
| Maintainer draft | `docs/maintainer-handover.md` documents build/package, source/candidate hashes, identity, data locations, compatibility, rollback and unresolved owners | Add a practical turnover exercise and ownership record. Blank names and unsigned-policy decisions remain pending. |
| Target-PC protocol | `docs/second-pc-test.md` and `docs/release-validation.md` | Reuse Phase 20 technical evidence where candidate/machine/task provenance matches. Add separate real-estimator pilot evidence rather than duplicating tests or relabeling local tests. |
| Prior preparation | Quick task `261022-p4n`, including its prefixed VERIFICATION and EVIDENCE files | Structural and arithmetic checks passed. Visual guide review is still unobserved; it is not inherited as a pass. |

Current application source is `9a0349f`; version 1.1.0 installer SHA-256 is `fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544`. Confirm these against the manifest at execution time. Initial full regression passed 1225/1229 tests; all four affected files later passed isolated reruns. The original run remains non-clean and parser intermittency remains a review qualification.

## Dependency and work order

The user permits useful work while the second PC is unavailable. Plans 21-01 and 21-02 may prepare documentation and pilot materials against the frozen candidate while Phase 20 remains VERIFYING. This is a work-order exception for preparation, not acceptance of Phase 20 or removal of `Depends on: Phase 20`.

Plan 21-03 must check actual Phase 20 acceptance and owner decisions before the acceptance pilot. A target-PC visit may collect both technical and estimator evidence, but record the separate criteria and resolve the Phase 20 gate before accepting the pilot. No remaining-ten distribution without actual pilot acceptance and approved release ownership.

## Validation Architecture

Use existing Node, JSDOM, JSZip and ExcelJS dependencies. Add a focused documentation validation utility in Plan 21-01, with path containment, local-link/fragment/image checks and the independent existing training oracle. Missing references, remote runtime assets, escaped paths or incorrect numbers must exit nonzero. Prove failure using an isolated copied fixture; never corrupt tracked examples or the trial kit. Avoid a new unit-test suite for prose edits.

Human evidence is necessary for readable layout, keyboard/link usability, a complete real-estimator walkthrough, owner competence, real target displays/PDFs, pilot acceptance and rollout. Automated structure checks cannot pass those items. Prior file-URL browser access was denied by browser policy; do not serve or load the same guide through an alternate browser workaround. Leave visual review for a permitted human walkthrough.

## Risks and scope

- Guide labels and installer metadata can drift after candidate changes: record exact versions/hashes and recheck affected sections.
- Guide truthfulness must retain internal-cost/margin export wording, rate snapshots, unit conversion, one backup, approximately 60-second recovery and upgrade-copy limitations.
- Do not imply an actual deployed predecessor exists; obtain evidence or a named reviewed disposition for missing hardware/predecessor checks.
- Keep all three owners (rates, release, support), signing/share decisions, dependency/license review and regression-stability review explicit.
- No app UI redesign, auto-updater, central rates, cloud features, client quotation export or new dependency is required.
