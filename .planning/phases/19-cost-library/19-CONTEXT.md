# Phase 19: Cost Library — Context

Captured from the user's completed discussion on 2026-10-21; approved to finalize and begin building. See ../../RELEASE-HANDOVER.md for the original vision and later release obligations.

## Locked decisions

App-provided fixed Excel template; optional CSV with identical headers; per-PC imports and offline persistence. The team fills and maintains rates. No cloud, syncing, assemblies or app-owned benchmark pricing. Six fields: Item Code, Description, Category, Unit, Material Unit Rate, Labor Unit Rate. Complete replacement only after preview/confirmation. Reject invalid imports with row details and preserve previous library. Explicit Estimate-row selection copies compatible rates into project data, retains markup/manual editing, and does not rename or redraw markups. Imported changes do not alter existing project rates.

## Implementation discretion

Reuse ExcelJS already installed, native dialogs and main-process filesystem access. Persist versioned library JSON in userData rather than installation/project directories. Reuse Estimate controls, COLORS, and existing modal patterns. Keep management accessible even without an open PDF. Unit compatibility uses the displayed BOQ unit; inspection confirmed count uses ea (pcs aliases to ea) and wall always uses m². Accept documented common aliases and canonicalize them, without implicit rate conversions. A code is case-insensitively unique. Import empty rows are ignored; an empty library is rejected. Disallow formulas rather than trusting cached Excel values. Show rate-key scope (same name/type across categories) when applying. Stage candidate state in the main process to avoid renderer-chosen filesystem paths.

## Out of scope

Phases 20-21 work, centralized management, automatic matching/repricing, a library of placement tools, standalone estimate quantities, resource breakdowns, .xls, quotation export changes.
