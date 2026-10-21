# Internal production rollout agreement

Agreed with the user on 2026-10-21. This document preserves the discussion behind Phases 19-21; combining phases must not remove these outcomes.

## Goal and boundaries

Prepare CLMC Takeoff App for internal turnover and offline use on approximately 12 Windows PCs. Preserve the core value: speed up quantity takeoff so the estimator can focus on reading the plan rather than doing math. Keep accurate page-space markups, large/multi-page PDF support, editable projects, and existing BOQ exports.

## Original requests mapped to the revised roadmap

| Original request | Final agreement | Phase |
| --- | --- | --- |
| Install on local PCs and support later updates | Versioned Windows installers, manual in-place upgrades distributed internally; stable app identity; keep projects and local library across upgrades; release notes and version visibility | 20 |
| One portable project rather than a separate PDF dependency | Verify and repair existing ZIP-embedded .clmc support; copy ONLY the .clmc to another PC and retain PDF, scales, geometry, prices and ordering; retain supported legacy migration | 20 |
| External estimating/cost library | User-maintained ready-to-use material/labor unit rates, imported individually on each PC from a standard app-provided template | 19 |
| How-to guide for users | Offline guide with a worked takeoff/costing/export example, plus installation/update instructions and technical handover | 21 |
| Ready for internal use and ownership transfer | Defined recovery behavior and installed-app verification in Phase 20; two-PC pilot, blocking fixes and acceptance before the remaining ten installations in Phase 21 | 20-21 |

## Locked cost-library decisions

- The internal team owns the master spreadsheet, price accuracy, updates, and importing revisions on each PC. The app does not distribute or synchronize prices.
- Ready-to-use unit rates only: no assemblies, resource recipes, productivity calculations, automatic price feeds, or central library service.
- Provide a blank .xlsx template, with CSV supported using the same fixed six columns: Item Code, Description, Category, Unit, Material Unit Rate, Labor Unit Rate.
- Each successful import replaces the local library as a complete snapshot, after a preview and explicit Replace action. Invalid/cancelled imports leave the existing library intact.
- Validate required columns/content, unique item codes, supported units and finite nonnegative numeric rates. Report row-specific errors; do not silently partially import or guess table mappings.
- Local library survives restart and is separate from projects. Users may keep freehand markup names; the library is an optional pricing aid in Estimate.
- Applying a selected item copies material/labor rates into the existing project rate entry, with compatible units and explicit action. Preserve selling markup and manual rate editing.
- Existing .clmc prices are snapshots: importing a new library never reprices them. Reapply rates explicitly if desired. Projects remain usable on a PC without that library.
- Record imported filename/time for local identification. A shared library/version management system is out of scope.

## Release gates retained in the shorter roadmap

- Safe saves, backup/recovery behavior, old-project compatibility, and clear failures; select a minimal recovery implementation during Phase 20 planning.
- Fresh installation and upgrade on a non-development Windows PC; offline PDF load/calibration/markup/estimate/export; representative large PDFs; Windows display scaling and coordinate accuracy; project-only transfer.
- Verify supported Electron/runtime dependencies before packaging, replace scaffold metadata and placeholder update endpoint, and review packaged contents. Keep core features offline.
- Internal owner can reproduce builds, distribute approved installers, retain previous release/project backups, maintain rates, and triage issues.
- Pilot is a real-user gate, not an automated pass. Never claim 12-PC deployment or human acceptance without evidence.

## Open decision, not silently included

A client-facing quotation export excluding internal costs/margin was raised but not approved. Existing internal exports remain available. Resolve audience and scope during Phase 20 planning; do not expand Phase 19 with it.

## Deferred

Automatic updates/hosting, centralized or synchronized libraries, legacy .xls, custom export-template mapping, assemblies, cloud features and collaboration. None are prerequisites for this internal rollout.
