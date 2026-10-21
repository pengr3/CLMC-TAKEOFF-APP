---
phase: 20-production-readiness
plan: "02"
subsystem: pricing
tags: [rate-basis, measurement, persistence, vitest, exceljs]
requires:
  - phase: 20-01
    provides: Coherent snapshot capture and revision-aware explicit save
provides:
  - Explicit portable pricing basis with reciprocal display-rate conversion
  - Unresolved legacy rate inference and explicit acknowledgement store contract
  - Strict explicit pricing validation and exact copy/duplicate redo metadata
affects: [20-03, 20-07, 20-09]
tech-stack:
  added: []
  patterns: [RateBasis denominator, reciprocal rate conversion, legacy-unresolved review state]
key-files:
  created:
    - src/renderer/src/lib/rate-units.ts
    - src/tests/rate-unit-invariance.test.ts
    - src/tests/rate-basis-roundtrip.test.ts
    - src/tests/rate-basis-operations.test.ts
  modified:
    - src/renderer/src/lib/boq-types.ts
    - src/renderer/src/lib/boq-aggregator.ts
    - src/renderer/src/components/EstimateRow.tsx
    - src/renderer/src/lib/apply-library-rate.ts
    - src/renderer/src/stores/projectStore.ts
    - src/renderer/src/stores/markupStore.ts
    - src/renderer/src/lib/project-serialize.ts
    - src/renderer/src/lib/project-schema.ts
key-decisions:
  - Basis is the rate denominator ea or a supported length/squared-area unit; convert both rates with target-size divided by source-size.
  - Missing legacy basis is inferred provisionally from the saved display unit, with wall fixed to square metres, and remains unresolved until explicit acknowledgement.
  - Preserve existing copy/duplicate blank-price semantics while capturing their basis in the command for exact redo.
  - Retain formatVersion 2 in this plan; plan 20-07 owns the reader floor and original-preserving upgrade flow.
requirements-completed: [REL-03, REL-05]
coverage:
  - id: D1
    description: Quantity, visible rate and internal XLSX/CSV output share a basis while money remains invariant
    requirement: REL-05
    verification:
      - kind: integration
        ref: src/tests/rate-unit-invariance.test.ts
        status: pass
      - kind: automated_ui
        ref: src/tests/estimate-row-edit.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Portable explicit and legacy pricing basis persists independently of the local library
    requirement: REL-03
    verification:
      - kind: integration
        ref: src/tests/rate-basis-roundtrip.test.ts
        status: pass
      - kind: integration
        ref: src/tests/cost-library-apply.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Group history preserves basis and explicit invalid pricing is rejected before live store mutation
    requirement: REL-05
    verification:
      - kind: integration
        ref: src/tests/rate-basis-operations.test.ts
        status: pass
      - kind: other
        ref: npm run typecheck
        status: pass
    human_judgment: false
actuals:
  tokens: 16118
  tasks: 3
  commits: 7
plan_head_before: dcf03e0258f92ad1f0f029872b930d5c228cbe12
duration: 13min
completed: 2026-10-21
status: complete
---

# Phase 20 Plan 02: Portable Rate Basis Summary

**Explicit rate denominators now preserve cost, selling price and margin through display-unit changes, manual edits, project reopening and group history.**

## Performance

- Duration: approximately 13 minutes, context load around 2026-10-21T15:33Z; final task commit 2026-10-21T15:46:25Z.
- Tasks: 3/3.
- Realized implementation/test/evidence diff: 22 files, 16,118 chars/4 tokens. Seven commits measured from the persisted ledger before this separate summary commit.

## Accomplishments

- One pure conversion uses `MM_PER_UNIT` and squared factors for areas. The aggregator produces display-basis material/labor rates alongside quantities; unchanged real XLSX/CSV writers consume those same rows. Count stays per piece and walls stay per square metre. No export audience or wire BOQ fields were added.
- Estimate rates display in the row UoM. A material or labor edit converts both current rates together before patching one, and native listeners rebind when the displayed basis changes. Full precision is retained until writer formatting; zero quantity/rates/markup remain valid.
- Manual prices and exact normalized-unit library applications carry basis and review metadata. Snapshots/hydration retain them independently of later library contents. Legacy scalar and object prices keep their initial saved-unit numeric interpretation and unresolved review status, including absent unit history.
- Explicit basis/dimension, review status and finite nonnegative rate values are validated before hydration resets a live document. Rename, category move, ordering, copy/duplicate and undo/redo tests retain appropriate pricing metadata. Copy/duplicate still create blank independent rates, with the captured original basis restored on redo.

## Task Commits

1. Task 1 RED: `c76e183`; TAP evidence correction: `903fad7`; GREEN tracer: `ea09965`.
2. Task 2 RED: `36d9f26`; GREEN portable rates and review: `f90b4ec`.
3. Task 3 RED: `ba95f7f`; GREEN validation and command metadata: `f91cc09`.

## Verification

- Task 1 required focused suites: 4 files / 38 tests passed. Repeated after the tracer commit for its end-to-end feedback gate; passed again.
- Task 2 required persistence/library/prototype suites: 4 files / 31 tests passed; node and renderer typecheck passed.
- Task 3 required invariant/operation/roundtrip/schema suites: 4 files / 44 tests passed. The oracle independently uses known metre factors across all five supported source and display units and all five markup types, with zero, small and large rates, project reopen, zero and nonzero markup, and both real writers.
- Final full source regression: **131 files / 998 tests passed**. `npm run typecheck` passed. Final strengthened all-type price/margin assertions and formatting were followed by another passing 44-test focused run; no production behavior changed after the full pass.
- `git diff --check` passed. No unexpected tracked-file deletions occurred.

## TDD Gate Compliance

| Task | Intentional RED | GREEN | Result |
|------|-----------------|-------|--------|
| 20-02-01 | Numeric cost 492.1259842519685 instead of 150 after m-to-ft; UI rate 10 instead of 3.048 | Reciprocal conversion and coherent visible-basis edits | Pass |
| 20-02-02 | Manual/hydrated entries missing basis/review | Persisted basis, unresolved inference and explicit acknowledgement | Pass |
| 20-02-03 | Copy redo changed captured ft basis to current cm; malformed explicit bases accepted | Captured command metadata and strict validation before reset | Pass |

All three persisted `20-02-0N-red.json` records returned `RED_EVIDENCE_OK` before their GREEN implementation. The initial default-reporter record was not machine-readable to the validator; actual TAP assertions with explicit test summary counts corrected it before production edits. Refactor-only commits were unnecessary.

## Contract for Plans 03 and 07

- `PriceEntry.basis?: RateBasis`: `'ea' | ScaleUnit | \`${ScaleUnit}²\``. Optional supports legacy typed inputs; production-created/hydrated entries have an explicit denominator.
- `PriceEntry.review?: 'reviewed' | 'legacy-unresolved'`. Missing basis always becomes unresolved; a basis without review also remains unresolved. Legacy inference uses saved `globalUnit`, falls back to metres when history is absent, and uses `m²` for walls. This records a proposal, not historical accuracy.
- `projectStore.getUnresolvedRateKeys(): string[]` supplies affected keys. `acknowledgeRateBasis(keys)` immutably changes only selected existing unresolved entries to reviewed and marks dirty/increments edit revision. Snapshot/save is required to retain acknowledgement across reopen.
- Manual edits retain unresolved status; merely changing markup or units does not acknowledge history. Explicit library application sets reviewed because the user selected a known normalized source unit and both rates.
- `validateRateEntries` rejects explicit incompatible/malformed basis, invalid review or nonfinite/negative monetary fields. `validateV2` and direct `hydrateStores` both enforce it before live-state mutation. Legacy basis-less numbers/objects retain established coercion and reserved dictionary-key protection.
- FormatVersion remains 2 until plan 20-07 supplies the new reader floor and upgraded-copy protection; its main-process `parseProjectMetadata` boundary must change together with that version work. No version mismatch was introduced here. Plan 20-07 must add export/unit-change gating and review UI before release. Recovery should preserve basis/review through the shared snapshot without acknowledging them.

## Deviations from Plan

1. **[Rule 1 - Command metadata bug]** Extended `src/renderer/src/stores/markupStore.ts`, the exact owning seam anticipated by task 3, after RED reproduced copy/duplicate redo replacing the captured basis with the current unit. Payloads now capture the visible basis and both forward and redo paths apply that same full entry. Source rates and independent blank-price semantics are preserved. Fixed in `f91cc09`.
2. **[Rule 2 - Required consumer assertions]** Updated existing serialization, library application/UI, prototype hydration and copy/duplicate/atomic-undo tests to assert the added metadata. Old exact three-field expectations otherwise rejected the new required representation. No production feature expansion.
3. **[Rule 3 - Verification environment]** Sandboxed Vitest failed before discovery with Vite realpath EPERM. The exact test command succeeded with approved escalation; all RED/GREEN evidence uses discovered tests. Scoped Git commits also used required sandbox escalation. No package was installed.

## Issues Encountered

The first complete regression run found only outdated exact-entry expectations after the metadata addition. Updating those directly affected fixtures produced the passing 998-test full run. Existing lint issues from plan 20-01 remain recorded in `deferred-items.md`; this plan did not sweep unrelated style or hook code.

## Known Stubs

None. Input `placeholder` attributes and blank independent copied rates are intentional UI/default values. Legacy review UI, export gating and format-floor protection are explicitly assigned to plan 20-07, with the complete unresolved store contract implemented here.

## User Setup Required

None.

## Next Phase Readiness

Plans 20-03 and 20-07 can use the contract above. Global STATE/ROADMAP/requirement progression remains the parent orchestrator's responsibility; no shared requirement was marked globally complete. Local automated evidence does not claim installed-PC visual acceptance, a non-development-PC run or deployment.

## Self-Check: PASSED

All four new implementation/test artifacts, all three RED records and all seven task/test commits were verified on disk/in Git before summary creation. Source full suite, final focused assertions and typecheck pass; no unexpected tracked-file deletions or task-generated untracked artifacts remain.
