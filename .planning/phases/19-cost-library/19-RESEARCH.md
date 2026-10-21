# Phase 19 research

2026-10-21; performed inline under gsd-plan-phase (no delegated agents).

- Existing Electron IPC + preload bridge is the filesystem boundary. Add a dedicated library IPC registration module; avoid granting arbitrary renderer-selected paths.
- ExcelJS 4.4.0 is already installed for exports and supports workbook xlsx.load/writeBuffer and csv.read with Readable streams. Inspect local README/types and official https://github.com/exceljs/exceljs documentation. Preserve CSV strings via a map callback to avoid automatic date/number coercion, especially item codes with leading zeros.
- Project rates are keyed name|type, shared across categories. setPrice merges patches, marks dirty, and existing serialize/hydrate already snapshots material/labor/markup. Library application should use this path; no project schema change is needed.
- BOQ quantities expose ea for counts (pcs aliases to ea), global display units (mm/cm/m/in/ft) or their squared variants for area, and always m² for wall. Canonicalize aliases, block mismatches, never silently convert a rate.
- Existing EstimatePanel is always mounted during Plan/Estimate switches. Management must load lazily on open to avoid boot-time UI/test dependencies; preserve the Konva mount and numeric edit behaviors.
- Persist only accepted library snapshot with temp-file + rename; validate restored data and preserve corrupt files on disk while showing an actionable error.
- Test parsers with generated workbooks, CSV escaping/BOM, formula cells, duplicates, bad headers/rates/units; validate replacement/restart/failure and real apply→save/hydrate/export behavior.

No additional npm dependency is needed. Main-process parsing keeps workbook libraries out of the renderer bundle.
