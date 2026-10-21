# Phase 20 dependency review

Reviewed 2026-10-22 (Asia/Manila), before installing the new runtime/parser.

## Approved runtime decision — 2026-10-22

The user explicitly selected **Approve Electron 44.9.3 (Recommended)** after the assistant compared the more established supported 44 branch with newly released 45, explained support dates and upgrade effects, and disclosed the automatic age-only flag. **Pin electron@44.9.3**, supported by the official schedule until 2027-03-02; do not install the superseded 45.0.0 proposal below. Exact 44.9.3 npm version/source/engine were verified read-only (`node >=22.12.0`, official electron/electron repository); the executor records its exact lifecycle and dependency review before installation. User approval resolves the mandatory human runtime-selection/age-flag disposition; it does not waive tests, advisory review, sandbox smoke, or installed validation. `yauzl@3.4.0` remains OK.

## Initial proposed install set (superseded runtime proposal)

- `electron@45.0.0` (development/build dependency): official source https://github.com/electron/electron; npm https://www.npmjs.com/package/electron. The official schedule https://releases.electronjs.org/schedule lists 45 stable from 2026-10-20 and supported until 2027-04-27; Electron 35 ended support 2025-09-02.
- `yauzl@3.4.0` (runtime dependency): official source https://github.com/thejoshwolfe/yauzl; npm https://www.npmjs.com/package/yauzl. Registry script is `test: node test/test.js`; no install lifecycle was reported. GSD registry audit returned OK: release date 2026-06-07, 31,488,127 weekly downloads, source repository present, not deprecated.
- Keep existing `electron-builder@26.8.1` unless execution demonstrates a compatibility defect. Do not expand the install set without documenting exact metadata and purpose.

## Evidence and gate

Initial research DNS failures are resolved by authorized networked read-only retries. Official registry/source metadata is now available. Raw evidence is retained under `.planning/tmp/20-package-legitimacy-network.json`, `electron-exact-metadata.json`, `20-electron-exact-legitimacy.json`, and `yauzl-registry.json` (temporary supporting data, excluded from product/package).

Electron has a known official repository and about 5,038,969 weekly downloads and is not deprecated. GSD's automatic package-legitimacy result still flags SUS solely for `too-new`: the proposed supported release is less than the default 30-day minimum age. This is an age heuristic, not a malicious-code finding. No age threshold was changed, and no unresolved flagged runtime is installed before explicit disposition. Lifecycle metadata must be checked against the exact-version output before installation; the executor records the actual package scripts and expected binary-fetch/install behavior.

**Gate disposition: RESOLVED by explicit user selection/approval of electron@44.9.3 above.** The 45.0.0 proposal is not installed. Yauzl is verified OK. Supported runtime smoke, advisory audit, exact lockfile and package contents remain execution checks; no installed-app or pilot acceptance is claimed.

## Exact preinstallation checks

Executor read-only `npm view electron@44.9.3 name version repository engines scripts bin dist --json` confirms the exact official package, `node >=22.12.0`, **no scripts property** (no npm install/postinstall lifecycle), and binaries `electron: cli.js`, `install-electron: install.js`. Its integrity is `sha512-Cv9/yMnZxNWsMlIe8T4v//NKHdUvbeyoTJoXE3BIcRxus2meeFaO9h/P3zB5d4cBXum51IgAYrT2QjpIDWKpJA==`. Electron's CLI installer may download the matching Windows binary when explicitly invoked; this expected official binary acquisition is part of the approved runtime installation. The root project retains its existing `postinstall: electron-builder install-app-deps`.

Exact yauzl 3.4.0 metadata confirms `node >=12`, only `test: node test/test.js`, no install lifecycle/binaries, and dependency `pend: ~1.2.0`. Integrity: `sha512-jIH9yLR9wqr0wOS0TpBvo/g/2UgZH5qePVbjgRliiF0BYvOZyaBknKsF+x9Iht0O6sqgnB93rCICdOZFecJuDw==`. No similarly named alternative is substituted.

Build host: Node 24.13.0, npm 11.8.0; installed electron-builder 26.8.1 retained. Official current documentation consulted: https://releases.electronjs.org/schedule (44 supported until 2027-03-02), https://www.electronjs.org/docs/latest/tutorial/sandbox (sandboxed preload limited require), https://electron-vite.org/guide/dependency-handling (v5 preload `build.externalizeDeps: false`), https://www.electronjs.org/docs/latest/tutorial/security, https://www.electronjs.org/docs/latest/api/app, https://www.electron.build/nsis/.

The CLI accepts bare package names and does not parse `name@version`; an initial literal-name invocation returned false nonexistence findings. Exact checks use the canonical `checkPackages({ecosystem:'npm', packages:['electron'], version:'44.9.3'})` API with unchanged thresholds. These official version/source/engine/script checks and the explicit human selection resolve task 02 before installation.

## Workstation identity inventory

Read-only elevated registry enumeration on this PC found **zero CLMC/clmc-takeoff display-name matches** under HKCU Uninstall, HKLM Uninstall and HKLM WOW6432Node Uninstall. This does not prove deployment state on other PCs. `%APPDATA%` contains `clmc-plan-estimator` and `clmc-takeoff`; only the latter contained `cost-library-v1.json`. Both contain browser preference/storage directories. No contents were changed, moved or merged. Final identity is `com.clmc.takeoff`, visible product `CLMC Takeoff`, executable/package slug `clmc-takeoff`, explicit `%APPDATA%/clmc-takeoff` userData and retained Chromium default session storage. Per-user full NSIS retains app data on uninstall; no deployed predecessor is fabricated. Plan 09 must record actual installation/upgrade evidence separately.
