---
phase: 17
slug: markup-rename-and-reorder
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-13
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Produced by `/gsd:secure-phase 17` — verify-only mode (register authored at plan time).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `.clmc` file → renderer hydrate | `categoryItemOrder` is deserialized from a user-supplied project file and feeds the BOQ aggregator ordering. | User-controlled ordering map (`Record<string,string[]>`) |
| User-typed rename input → store re-key | A new group name is an opaque user string used as an exact map key (`name\|type`). | User-controlled label string |
| Group/label name → BOQ export (CSV/XLSX) | A renamed or copied group name reaches an export label cell. | User-controlled label text |

All other 17-xx plans introduced **no new** file/IPC/network trust boundary (renderer-only, in-memory operations persisted via the existing `file:writeProject` path).

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-01 | Tampering / DoS | `project-serialize` hydrate of `categoryItemOrder` | mitigate | Per-field coercion at `src/renderer/src/lib/project-serialize.ts:107-121` — object-guard → array-only values → string-only elements → default `{}`, never throws; passed to store at `:128`. Additive/unvalidated field at `project-schema.ts:119`. **Hardened:** dunder-key drop (`__proto__`/`constructor`/`prototype`) at `:116` (prototype-pollution guard, LW-01). | closed |
| T-17-02 | Tampering (formula injection) | Group name → CSV/XLSX export | accept (existing) | `safeText()` at `src/main/boq-writers.ts:126-130`; trigger `FORMULA_TRIGGER_RE = /^\s*[=+\-@]/` at `:124` (covers leading-whitespace bypass); applied xlsx `:270`,`:295` + csv `:423`,`:426`. | closed |
| T-17-03 | — (no new surface) | IPC / file / network / eval | accept | No `src/main`/`src/preload` change; order rides existing `BoqStructure` IPC payload. | closed |
| T-17-04 | Tampering (hostile rename re-key) | `renameGroup` store command | accept | `markupStore.ts:565` — blank reject `:567`; `collisionExists` zero-write block `:580` (`group-ops.ts:63-72`); exact string-template re-key `${name}\|${type}` (`:590-592`,`:602-604`,`:613-615`) — no eval/dynamic regex on name. | closed |
| T-17-05 | Tampering (name → CSV export) | export label cell | accept (existing) | `safeText()` guard (see T-17-02). | closed |
| T-17-06 | — (no new surface) | IPC / file / network / eval | accept | In-memory store op via existing `file:writeProject`. | closed |
| T-17-07 | DoS (leaked window listeners) | `useRowReorder` drag hook | mitigate | `useRowReorder.ts:155-159` `removeDragListeners()` removes BOTH `pointermove`+`pointerup` (+cancels rAF), called in `onUp` before dispatch `:162`; unmount safety-net `activeDragCleanupRef` (`:102-109`,`:176`) tears down an interrupted drag with no dispatch (LW-02). | closed |
| T-17-08 | — (no new surface) | modal + drag hook | accept | Presentational, renderer-only. | closed |
| T-17-09 | Tampering (bucket merge / double qty) | `autoUniqueName` on copy/duplicate | mitigate | `group-ops.ts:39-49` returns first-free `{base} (n)` not in the type-scoped `taken` set → distinct `name\|type` bucket guaranteed; `taken` also excludes orphaned rate keys (`:41-45`), preventing a silent rate clobber. | closed |
| T-17-10 | — (no new surface) | IPC / file / network / eval | accept | New markups + blank rate ride the existing serialize path. | closed |
| T-17-11 | Tampering (name → export) | export label cell | accept (existing) | `safeText()` guard (see T-17-02). | closed |
| T-17-12 | — (no new surface) | UI components | accept | Commit routes through the 17-02 rename command. | closed |
| T-17-13 | Tampering (Totals-panel wiring → export) | export label cell | accept (existing) | `safeText()` guard; no new export path. | closed |
| T-17-14 | — (no new surface) | panel menu/dialog | accept | Dispatches existing 17-01/02/04 commands only. | closed |
| T-17-15 | Tampering (Estimate-panel wiring → export) | export label cell | accept (existing) | `safeText()` guard; no new export path. | closed |
| T-17-16 | — (no new surface) | panel menu/dialog | accept | Dispatches existing commands only. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Unregistered flags

None. All 7 plan SUMMARY `## Threat Flags` sections declare "None," corroborated by the Phase 17 diff (`feff7c5^..HEAD`) touching only `src/renderer/**` plus tests. A sink scan (`eval`, `new Function`, `fetch`, `XMLHttpRequest`, `WebSocket`, `child_process`, new `ipcMain.handle`/`ipcRenderer.invoke`) found only pre-existing channels in the unchanged `src/preload/index.ts`, `src/main/index.ts`, `src/main/ipc-handlers.ts`.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-02 / 05 / 11 / 13 / 15 | CSV/XLSX formula injection via a group/label name is covered by the pre-existing `safeText()` guard (`boq-writers.ts:126-130`), which prefixes `'` to any label leading with `= + - @` (incl. after whitespace) on both xlsx and csv paths. A renamed/copied name is still a guarded label cell. Residual: a leading apostrophe persists in cell data — acceptable for a BOQ deliverable and strictly safer than formula execution. | pengr3 | 2026-07-13 |
| AR-17-02 | T-17-04 | Rename re-keys are exact string-key assignments (no eval / dynamic regex on the name); `collisionExists` blocks any rename that would merge into an indistinguishable same-`(name,type)` bucket, returning `{ ok:false }` with zero store writes. | pengr3 | 2026-07-13 |
| AR-17-03 | T-17-03 / 06 / 08 / 10 / 12 / 14 / 16 | Phase 17 is a renderer-only, in-memory feature. Reorder rides the existing `BoqStructure` export IPC; new markups + blank rate ride the existing `file:writeProject` serialize path. No new IPC/file/network/eval trust boundary introduced (verified against the Phase 17 diff). | pengr3 | 2026-07-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-13 | 16 | 16 | 0 | gsd-security-auditor (opus), verify-only mode |

**Hardening observed beyond the register (no disposition change):**
- **LW-01** — hydrate coercion also drops `__proto__`/`constructor`/`prototype` keys, closing a prototype-pollution vector the plan text did not claim.
- **LW-02** — `useRowReorder` covers an unmount-mid-drag (interrupted drag) path via `activeDragCleanupRef`, stronger than the "removed in pointerup handler" claim.

*Note: the register's "V5 per-field coercion" wording is a labeling artifact — the file is `formatVersion: 2` with an additive field; the actual control (per-field coercion at the hydrate boundary) is present and behaves as described. No impact on disposition.*

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-13
