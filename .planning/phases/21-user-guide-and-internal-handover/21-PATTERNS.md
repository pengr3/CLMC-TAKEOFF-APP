# Phase 21 artifact patterns

Local inline audit, 2026-10-23. Reuse these concrete analogs; no application architecture change.

| Planned file | Role and closest existing analog | Contract |
|---|---|---|
| `docs/offline-guide/index.html` | Existing semantic HTML guide, local anchors/images and responsive table containers | Retain local runtime assets, clear trial status and actual control labels. |
| `scripts/verify-handover.cjs` | `scripts/prepare-trial-kit.cjs`, especially exported `verifyExample`, `listFiles` and guarded main entry | Built-in path/fs/assert plus installed JSDOM; read-only by default; failure exits nonzero. |
| `docs/maintainer-handover.md` | Existing candidate-bound build/storage/rollback draft | Extend the real procedure; preserve all qualifications and source/candidate distinction. |
| `docs/pilot-runbook.md` | `docs/second-pc-test.md` and `docs/release-validation.md` | Actual machine/tester/fixture/expected/actual/evidence, with separate technical and estimator gates. |
| `21-HANDOVER.md` | Pending responsibility table in maintainer draft | Named owners and actual demonstrated handover, never fabricated assignments. |
| `21-PILOT.md` | Phase 20 installed-evidence record plus quick-task evidence | Two actual internal PCs and real estimators; exact candidate, tasks, blockers/retests and explicit acceptance. |
| `21-ROLLOUT.md` | Versioned manual distribution procedure | Acceptance prerequisite; actual per-PC distribution/install evidence, separate unobserved states. |

`verify-handover.cjs` must not run the kit's main preparation path or overwrite `dist/trial-kit`. Import its existing read-only oracle only. Preserve `.gitattributes` binary handling for PDF/CLMC/XLSX/CSV.
