---
phase: "20"
slug: production-readiness
status: blocked
threats_open: 1
asvs_level: 1
created: "2026-10-22"
---

# Phase 20 — Security

Authored ASVS1 register independently verified by gsd-security-auditor at source38cb5d2. Block threshold high. Source mitigations verified; release evidence gates remain.

## Trust Boundaries

Renderer/top frame → privileged main → user files; archives/workbooks → bounded parser → validated stores; installer → pinned userData; package registry → reviewed build host; candidate/evidence → internal distribution.

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Evidence | Status |
|---|---|---|---|---|---|---|
| T20-01-01 | Tampering | writeProtectedProject | high | mitigate | project-storage.ts: atomic-write/project-save-flow | closed |
| T20-01-02 | Tampering | useProject acknowledgement | high | mitigate | useProject.ts/projectStore.ts: coherent revision tests | closed |
| T20-01-03 | Elevation | writeProject IPC | high | mitigate | ipc-handlers.ts/app-identity.ts: sender and payload rejection | closed |
| T20-02-01 | Tampering | rate-units/aggregator | high | mitigate | rate-units.ts/boq-aggregator.ts: all-type unit invariants | closed |
| T20-02-02 | Tampering | serializer/schema | high | mitigate | project-schema.ts/project-serialize.ts: rate basis and reader-floor roundtrip | closed |
| T20-03-01 | Tampering | recovery restore | high | mitigate | project-recovery.ts/useProject.ts: hash/schema/PDF staged restore | closed |
| T20-03-02 | Denial of service | repository | high | mitigate | project-recovery.ts/useProject.ts: quota/restart/two-process ownership | closed |
| T20-03-03 | Elevation | recovery IPC | high | mitigate | project-recovery.ts/app-identity.ts: opaque IDs and generated paths | closed |
| T20-03-04 | Information disclosure | local files | medium | accept | 20-03-PLAN.md:123: approved same-user local recovery risk | closed |
| T20-04-01 | Spoofing | release-info | medium | mitigate | release-info.ts/index.ts: authoritative version and note agreement | closed |
| T20-04-02 | Elevation | release-info IPC | high | mitigate | release-info.ts/index.ts: trusted named handler/fixed resource | closed |
| T20-04-03 | Tampering | About content | medium | mitigate | AboutDialog.tsx/verify-release.cjs: text rendering and bounded notes | closed |
| T20-05-01 | Elevation | window/IPC | high | mitigate | index.ts/app-identity.ts: sandbox/navigation/permission/sender controls | closed |
| T20-05-02 | Tampering | identity/storage | high | mitigate | app-identity.ts/index.ts: pin before lock/ready; retained root | closed |
| T20-05-SC | Tampering | npm installs | high | mitigate | 20-DEPENDENCY-REVIEW.md/20-CONTEXT.md D-05: official exact packages, explicit44.9.3 approval | closed |
| T20-06-01 | Denial of service | workbook admission | high | mitigate | workbook-admission.ts/cost-library-import.ts: actual stream caps and kill/reap | closed |
| T20-06-02 | Tampering | preview/commit | high | mitigate | cost-library-ipc.ts: owner/token/explicit replacement | closed |
| T20-06-03 | Information disclosure | parser/errors | medium | mitigate | cost-library-ipc.ts/cost-library-import.ts: bounded category errors, no contents | closed |
| T20-06-SC | Tampering | ZIP reader | high | mitigate | package-lock.json/20-DEPENDENCY-REVIEW.md: reviewed exact yauzl3.4.0 | closed |
| T20-07-01 | Tampering | schema/hydrate | high | mitigate | project-schema.ts/project-validation.ts/useProject.ts: strict nested staging/portability | closed |
| T20-07-02 | Tampering | legacy rates/older readers | high | mitigate | project-storage.ts/useExport.ts/scaleStore.ts: readerfloor/rate+geometry guards/source preservation | closed |
| T20-07-03 | Denial of service | project extraction | high | mitigate | project-io.ts: actual ZIP limits/CRC/exact entries | closed |
| T20-08-01 | Denial of service | page cache | high | mitigate | pdf-page-cache.ts/usePdfRenderer.ts: 128MiB raster ownership/cancellation | closed |
| T20-08-02 | Tampering | transform/DPR | high | mitigate | usePdfRenderer.ts/PdfPageImage.tsx/LegacyGeometryReview.tsx: canonical geometry and explicit old-basis quarantine | closed |
| T20-09-01 | Information disclosure | package | high | mitigate | verify-release.cjs/dist: final exact NSIS/ASAR inspection and measured packaged smoke independently matched | closed |
| T20-09-02 | Tampering | upgrade/rollback | high | mitigate | 20-INSTALLED-EVIDENCE.json/docs/release-compatibility.md: OPEN: actual predecessor/nondev upgrade evidence | open |
| T20-09-03 | Spoofing | release evidence | high | mitigate | verify-release-evidence.cjs/smoke-packaged.cjs: strict candidate/provenance and negative controls | closed |
| T20-09-04 | Tampering | unsigned internal installer | medium | transfer | 20-INSTALLED-EVIDENCE.json: OPEN below high: owner/signing/share transfer incomplete | open |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---|---|---|---|---|
| AR20-01 | T20-03-04 | Same-user local recovery under existing userData permissions; no new encryption or telemetry promise. | User-approved plan scope;20-03-PLAN.md:123 |2026-10-22|

This records existing approval. Signing/distribution ownership remains untransferred; no new acceptance is inferred.

## Security Audit Trail

| Audit Date | Total | Closed | Open at/above high | Open below high | Run By |
|---|---|---|---|---|---|
|2026-10-22|28|25|2|1|Initial audit; parent persisted approved risk|
|2026-10-22|28|26|1|1|Evidence-only independent closure after final rebuild|

Independent focused tests:20files/198tests passed, including actual utility-process kill/reap, filesystem failure matrix, portability, guards, raster/DPR and release negative controls. Initial sandbox EPERM ran no tests and was excluded; scoped host retries passed.

Recorded dependency audit:0critical/24high/10moderate/2low. Scoped reachability dispositions in20-DEPENDENCY-REVIEW.md independently checked. No whole-app certification is claimed.

T20-09-01 closed (initial independent closure; current parent revalidation):149 unpacked files,37 packaged outputs and3resources match current files and measured smoke;108 production dependency locations. Installer SHA256 d3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180, ASARcf6bac214a8afbce8b8be6b4f2db2e00ef5afb412793e4e70f45fe1b6273cd45;Electron44.9.3 and true reopen proof passed. T20-09-02 requires actual predecessor/non-development upgrade evidence. T20-09-04 requires named signing/distribution owner and approved location.

## Sign-Off

- [x] Every threat has a disposition.
- [x] Existing authorized acceptance recorded.
- [ ] threats_open:0.
- [ ] status:verified.

Phase advancement remains blocked. Continue authorized local work without claiming acceptance.

## Post-manual candidate revalidation

Sourcee61ae4a changes only library focus containment after the manual-discovered tool fix801a532. Parent reviewed this delta and retained four causal regressions,35focused tests, both typechecks/build and157files/1228tests passing. Current actual payload inspection, measured packaged smoke and149-file installed comparison passed; unchanged IPC/parser/storage mitigations retain their prior independent dispositions. Current installerd3a9a6f00bd75c28ca8b8369259f7202f1e7421f0d49006f41c041925497f180; ASARcf6bac214a8afbce8b8be6b4f2db2e00ef5afb412793e4e70f45fe1b6273cd45. This is a documented parent delta/payload revalidation; no additional independent whole-source audit is claimed. T20-09-02 and T20-09-04 remain open. Local native evidence cannot transfer signing/share ownership or establish deployed upgrade acceptance.

## Additional installed manual checks — 2026-10-23

See20-MANUAL-EDGES.md and20-MANUAL-EDGES.json for actual never-saved recovery with absent source PDF, backup-lock failure/cancel/retry and detached backup Save As, synthetic legacy safeguards/upgraded copy, invalid/corrupt/oversized/10001-row library rejection and the third manual-discovered focus fix9a0349f. New candidate installer fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544, 136810568bytes; ASAR 5fd667ca5dfc02df8aa4addbd6866a0eb603c0c9fa2dfe748a47c7122861fabd. Build/types, inspection, measured packaged smoke,149installed payload hashes and native corrected preview-cancel/Escape/Save As passed. Earlier observations retain e61 candidate provenance.

Regression qualification: initial full157files/1229tests had4failures and1225passes (806.37sec). Four-file isolated recheck passed3files/37tests, parser still failed; parser-only rerun passed2tests17.85sec. Every file has a passing result across runs; no single clean full run or confirmed cause for the intermittent parser failure is claimed. No expectation/deadline was relaxed. This stability limitation remains visible for review. External hardware, representative/historical construction PDFs, named reviews and Phase21 pilot/distribution remain pending.
