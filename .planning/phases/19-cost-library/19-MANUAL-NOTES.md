# Cost library — guide material for Phase 21

## User workflow

1. Switch to Estimate. Cost Library is available even before opening a PDF.
2. Choose Cost Library → Download Excel Template. Fill only the Cost Library worksheet; Instructions is a reference sheet.
3. Keep the six headings unchanged. Use a unique item code, description, category, supported unit and numeric material/labor rate per unit. Use zero when one rate does not apply. Formulas must be pasted as values.
4. Save .xlsx or export only Cost Library as UTF-8 comma-separated CSV. Retain a backup of the master spreadsheet.
5. Cost Library → Import CSV / Excel → check preview → Replace Library. Errors identify the rows to fix; invalid or cancelled imports leave the prior library intact.
6. Each Estimate item has a small book button beside its name. Open it, search by code/description/category, select a compatible unit, then Apply Rates.
7. Applying changes material/labor for the same name and measurement type across categories. It does not rename the takeoff group, alter geometry or replace selling markup. Save the project normally.
8. Rates remain manually editable. Importing a library revision replaces only the local library; existing project rates stay as saved. Explicitly reapply an item to adopt updated rates.
9. Repeat master-file imports independently on each PC. No network/central account is required.

## Units

Counts display ea; pcs/pc/piece/each aliases import as ea. Linear/perimeter use the project's display unit, area its squared unit, and wall uses m². The picker blocks incompatible units and performs no implicit conversion. Review rates if changing project display units; final unit-change behavior is a Phase 20 release validation item.

## Maintainer notes

Accepted snapshot: Electron userData/cost-library-v1.json; includes formatVersion, sourceFilename, importedAt and items. It is outside installation and .clmc paths. Projects only store their applied numeric rates through the existing schema. Do not distribute a populated library with the installer or silently overwrite userData during upgrades.

Reproducible automated UI smoke: build, then run verify-electron.cjs in this directory with Node. It launches a hidden/offscreen test window, uses isolated scratch data under out/phase19-smoke and supplies native file selections. It does not exercise real-user training or installation; those remain Phases 20-21.
