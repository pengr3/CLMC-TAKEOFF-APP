# Phase 20 context — approved internal rollout

Captured 2026-10-21 from the completed user discussion. See ../../RELEASE-HANDOVER.md. Phase 19 implemented; this phase is not yet planned/executed.

## Locked outcomes

- Approximately 12 Windows PCs; versioned installers with internally distributed manual in-place upgrades. No auto-update hosting requirement. Final stable application identity, visible version, release notes, preserved projects/local library and verified fresh install/upgrade.
- Verify/repair existing embedded-PDF .clmc support rather than implement it again. Copy only the project to another PC and retain PDF/scales/geometry/prices/ordering, without source-path setup. Retain supported legacy migration.
- Agree minimal backup/recovery behavior during planning and implement it; preserve safe interrupted/failed saves, protect unsaved work and document rollback/project compatibility.
- Review supported runtime/dependencies, scaffold metadata/placeholder update endpoint and packaged content. Ensure test scratch data/planning assets and populated libraries are not shipped.
- Test installed app offline, representative large/multi-page PDFs, measurement accuracy, Windows scaling, save/reopen, rate application and exports on a non-development PC.
- Specifically validate changing measurement display units after pricing: current name|type project rates lack a persistent unit basis. No silent incorrect cost/quantity interpretation is acceptable at release.

## Open decision

Client quotation export excluding internal cost/margin was proposed but never approved. Resolve audience before expanding export behavior; do not assume consent. Internal export already exists.

## Handover

Actual two-PC pilot, user acceptance and remaining-ten-PC distribution belong to Phase 21. Do not claim them from local automated verification.
