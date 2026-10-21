---
phase: 19
slug: cost-library
status: verified
threats_open: 0
open_below_threshold: 1
asvs_level: 1
block_on: high
register_authored_at_plan_time: false
created: 2026-10-21
---

# Phase 19 security verification

Retroactive STRIDE review performed inline under gsd-secure-phase fallback. The original plan has no formal threat register; this register was built from implementation, not inferred empty. No independent auditor or penetration test is claimed. `threats_open` counts high/critical blockers; one medium advisory remains explicit below.

## Trust boundaries

| Boundary | Data crossing |
| --- | --- |
| User-selected spreadsheet → main parser | Untrusted XLSX/CSV cells, workbook structure, filenames |
| Renderer/preload → main IPC | Preview request or opaque token; no caller-selected import path or snapshot |
| Main repository → userData | Validated versioned local price data |
| Library → Estimate/project | Explicit compatible numeric rates; existing markup retained |

## Threat register

| ID | STRIDE | Severity | Disposition | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| T19-01 | Tampering / elevation | high | mitigate | shared/cost-library.ts validates six headings, plain values, finite nonnegative rates, supported units, code uniqueness; Excel formula objects (including cached results) rejected. React renders imported strings as text, no HTML evaluation. Parser tests cover hostile/malformed cells. | closed |
| T19-02 | Spoofing / tampering | high | mitigate | main/cost-library-ipc.ts uses window-owned native dialogs; main holds staged snapshots; random token bound to sender.id; stale/forged/cross-window tokens rejected and owner-destroy cleanup present. IPC tests cover these cases. Preload exposes named functions rather than arbitrary fs/IPC. | closed |
| T19-03 | Tampering / loss | high | mitigate | main/cost-library.ts revalidates loaded/replacement snapshots; fixed userData target, UUID temp-write then rename; failed writes/renames preserve old bytes, corrupt source retained. Repository failure tests and restart UAT pass. | closed |
| T19-04 | Information disclosure | medium | mitigate | This feature makes no network request, adds no remote resource/link, displays source basename only, stores local per-PC data. Offline architecture retained; no shared service. Existing project export intentionally includes internal costs and is disclosed to the user. | closed |
| T19-05 | Tampering | medium | mitigate | apply-library-rate.ts repeats unit/numeric validation, writes only explicit material/labor with effective existing markup; importing never writes project prices. Project roundtrip and UAT 6/9/10 prove independent saved prices. | closed |
| T19-06 | Denial of service | medium | mitigate in Phase 20 | Compressed input bounded to 10 MB before read and again before parse; at most 10,000 rows/50 loaded columns, capped error collection and displayed rows. However ExcelJS loads XLSX before row limits; decompressed size/time is not independently bounded. Review archive resource budgets and hostile large workbooks in the approved Phase 20 dependency/runtime/PDF resilience work. No exploit reproduced; no risk acceptance asserted. | open — below high threshold |
| T19-07 | Repudiation | low | mitigate | Library records source filename/import timestamp; explicit replace and rate application, saved project snapshots. No multi-user audit trail promised for this single-user offline tool. | closed |

## Accepted risks

No new risk acceptance granted or assumed. T19-06 remains open below the configured blocking threshold and is carried forward explicitly. Existing `sandbox:false` and unrestricted shell.openExternal host handling are pre-existing host concerns, outside the new library's data-only surface; installed-runtime hardening remains Phase 20. This review is not a whole-app production security certification.

## Audit trail

2026-10-21: 7 threats assessed, 6 closed, 1 medium open, 0 high/critical open. Source: cost-library shared/main/IPC/dialog/apply files and preload; test evidence: five cost-library test files and 19-UAT.md. No source edit required for Phase 19 acceptance.

- [x] Every threat has disposition and evidence.
- [x] No invented accepted risks.
- [x] Configured blocking `threats_open: 0`.
- [x] Medium advisory retained for Phase 20.
