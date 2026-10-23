---
phase: 21-user-guide-and-internal-handover
status: preparation_verified_human_needed
checked: "2026-10-23"
mode: inline_codex_adapter
---

# Offline guide preparation evidence

This record covers source/structure/data checks on the development PC. It does not accept HAND-01, Phase 20, the two-PC pilot or distribution. No independent reviewer or rendered-browser walkthrough was used.

## Provenance and protected bytes

Frozen application source: `9a0349f`; version 1.1.0. Actual `dist/release-manifest.json` agrees with the inspected candidate:

| Artifact | SHA-256 |
|---|---|
| Full 136810568-byte x64 installer | `fe8d848b1d76641dad7908b96e7987a3d8c643c8b627f8f10701523aa3359544` |
| Packaged ASAR | `5fd667ca5dfc02df8aa4addbd6866a0eb603c0c9fa2dfe748a47c7122861fabd` |
| Tracked training project | `c8a466c0886ad40fb792771646b7d64f8dd7af6da26909a665ffdfa291d156cb` |
| Embedded and standalone synthetic PDF | `9c0bc7b6f133905fc62b7dff8abec2e78c0beb078f3ddcdddb57c157ed025e10` |

Inherited quick task `261022-p4n-prepare-offline-guide-worked-example-mai` supplies the original guide, two actual installed screenshots and examples; its verification remains human_needed. Its original installer had a different hash; that historical scope is retained. The current kit was refreshed during Phase 20 at the current candidate; this execution never regenerated it. Guide binary handling remains in `docs/offline-guide/.gitattributes` (there is no repository-root attributes file).

The probe run compared SHA-256 before/after for **32 files**: all tracked example/image bytes, the complete existing kit including its editable results and manifest, plus the current installer/ASAR/release manifest. All were identical. Machine-readable hashes and probe results: `.planning/tmp/21-guide-probes-1792724803884/results.json`. This temporary evidence is local; the essential results and candidate identifiers are retained here.

## Focused validation

`node scripts/verify-handover.cjs` passes: one HTML document, 14 local references, two images with nonempty descriptive alt, six training rows, cost 740 / selling 962 / margin 222. Initial intact run took 13,770 ms; refined-guide run took 9,541 ms. Node v24.13.0 and existing JSDOM/JSZip/ExcelJS were used without new dependencies.

The checker imports only `verifyExample`, never the kit mutation entry point. It checks root containment (including resolved paths), local href/src/fragments, linked CSS/HTML resources, CSS imports/URLs, image alternatives and unexpected active content. It does not execute scripts, load a browser, write files or install anything. `realpathSync` retains canonical containment checks because the native async realpath returned EPERM in this restricted Windows session.

Independent geometry uses Euclidean lengths, shoelace area and wall height; independent prices use quantity × material/labor rates and markup. ZIP CRC, embedded PDF identity, format/basis/rates and separate XLSX/CSV readback are checked. The displayed HTML table is also compared to the independent oracle. Floating arithmetic is checked within 1e-7; 739.9999999999999/961.9999999999999 are represented as 740/962 for training money.

Eight separate disposable copies rejected their intended corruption: missing local link, wrong CSV grand total (963), wrong displayed row total (196), missing anchor, parent-root traversal, remote CSS import, empty image alt and absolute Windows path. The first broad CSV mutation changed only a subtotal the inherited oracle does not inspect; the negative fixture was corrected to target the independently checked grand total. No false negative was relabeled as a pass. CLI exit-1 checks for missing-link and wrong-export-value are recorded separately in the same results JSON. Finish each task with the intact guide passing.

## Guide-to-control audit

Pending completion of task 21-01-02; the following source mapping will record the actual reviewed sections and remaining human states.

## Human evidence still required

All 16 states in `21-UI-SPEC.md` remain unobserved: E1 empty/loading/error/populated/partial/overflow/zero-one-many/long-text; E2 loading/error/overflow/long-text; E3 empty/loading/error/populated. A permitted human must inspect normal/narrow/zoomed/print layout, keyboard focus, links, tables, long content and image fallback, then real estimators must follow the guide on two actual PCs and representative jobs. Static JSDOM checks do not prove these observations.

The inherited browser file-protocol denial was respected: no alternative browser/local server was used. Owner/support assignments, Phase 20 actual target-PC/representative/historical-PDF/display checks, release/signing/dependency/stability decisions, pilot acceptance and remaining-ten approval/installs remain pending. The existing kit intentionally retains its prior guide revision and returned results; distribute no revised kit without a fresh reviewed destination and integrity manifest.
