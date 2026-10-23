---
phase: "21"
slug: user-guide-and-internal-handover
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-23"
---

# Phase 21 validation strategy

Documentation validation uses Node and existing JSDOM/JSZip/ExcelJS; no new dependencies. Quick/full documentation command: `node scripts/verify-handover.cjs` (created in 21-01-01). Run after every preparation task and wave; expected seconds, record actual duration. Do not rerun the app suite for prose alone. If app changes are required, use targeted GSD debugging and the existing Phase 20 build/release verification; keep initial regression failures qualified until resolved.

## Per-task verification map

| Task | Wave | Requirement | Verification | Status |
|---|---|---|---|---|
| 21-01-01 | 1 | HAND-01 | Create/run documentation CLI; intact pass, copied broken link and wrong-value controls fail; source/kit hashes unchanged | Pending |
| 21-01-02 | 1 | HAND-01 | CLI plus guide-to-control/source audit | Pending |
| 21-02-01 | 2 | HAND-02 | CLI plus actual-script/storage/compatibility review; named owners still pending | Pending |
| 21-02-02 | 2 | HAND-03 | CLI plus runbook/worksheet field and gating review | Pending |
| 21-03-01 | 3 | HAND-02 | Manual: actual Phase 20 acceptance, named decisions and demonstrated turnover | Pending |
| 21-03-02 | 3 | HAND-01, HAND-03 | Manual: all 16 UI-probe states, real-estimator guide/task evidence on two actual PCs, independent oracles and blocker retests | Pending |
| 21-03-03 | 3 | HAND-03 | Manual: actual release approval before distribution; per-PC records | Pending |

## Wave 0 requirements

- `scripts/verify-handover.cjs` is intentionally created in the first tracer task before dependent commands run. No installation or application code change is needed.
- Human checkpoints are consecutive manual-only tasks by necessity: automatic sampling cannot validate assignment, competence or acceptance. They carry explicit reviewer/evidence instructions rather than misleading existence-only checks.

## Manual-only verification

Human walkthrough must inspect normal/narrow/zoomed/print layout, keyboard focus/local links, long content/tables and image fallback. Prior browser-policy denial remains binding; do not route around it. Verify guide source text as useful preparation, then obtain permitted human visual evidence.

Actual owners must demonstrate build/inspection, rate-file and backup/support procedures. Real estimators must complete representative offline work with independently known measurements/prices on two actual internal PCs. Verify all candidate-bound Phase 20 prerequisites before pilot acceptance. Record acceptance and rollout separately. Missing hardware, owner names, representative PDFs or approvals are pending, not a pass.

## Sign-off

- [x] All tasks have executable automated checks or explicit manual checkpoint criteria.
- [x] First-task creation accounts for the currently missing documentation checker.
- [x] No watch mode or new dependencies.
- [ ] Actual task results and feedback latency recorded.
- [ ] Actual manual walkthrough, named turnover and two-PC pilot accepted.
- [ ] Nyquist validation audit complete; no execution acceptance asserted at planning time.

Approval: planning strategy reviewed inline 2026-10-23; execution and human acceptance pending.
