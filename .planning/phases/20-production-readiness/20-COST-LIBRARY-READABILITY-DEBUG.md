# Cost Library UI-05 readability debug — numeric columns and import errors

Updated 26 October 2026 (Asia/Manila). **Installed 1.1.5 passes the performed numeric-column and specific import-error regressions.** Captures 052–054 show a 250-row preview/import with readable unit and full monetary values through horizontal scrolling. Capture 058 shows the specific row 251 material-rate error above the table, without a Replace Library action; the stored 250-item library remains available. Captures 059 and 061 show one-result and zero-result searches, and 062 shows Escape returning focus to Cost Library. Raw evidence is under `.planning/tmp/20-completion-20261026/candidate-1.1.5/native/`, with the scoped review in `portable-hover-native-review.json`.

The full keyboard/overflow case remains pending. The separate curved-markup calculation discrepancy has also passed its targeted installed regression; display and release acceptance remain open. Earlier 1.1.2 numeric-column and 1.1.3 collapsed-error failures below remain historical. Source-component geometry results do not replace native evidence or pass the whole phase.

## Historical 1.1.2 failing candidate and input

| Artifact | Identity |
| --- | --- |
| Installed candidate | CLMC Takeoff **1.1.2**, final C |
| Installer SHA-256 | `b2d27d0e75d18d1f66df839a0552faf90b17cb14275d78330ac3766f0baadec6` |
| Actual ASAR SHA-256 | `084f96aef0b4e27ad746712efd4fca793554b82c8b0e7642bccda2d93f119416` |
| Valid disposable CSV | `cost-library-250-long.csv`, **250 rows**, 263,422 bytes |
| CSV SHA-256 | `e05f7665765484f5dbb9112e9109f72c98a0a357b285fd66304a2c0ad3b8f096` |

The generated input has unique 180-character codes, 480-character descriptions and 360-character categories, within the parser's 500-character text ceiling. Five accepted units repeat (`ea`, `m`, `m²`, `ft`, `ft²`); material and labor rates are finite and nonnegative. First-row expected values are `ea`, material **123456790.12**, labor **9876543.46**. This is a software fixture, not an approved construction estimate or representative-plan acceptance.

Input/oracle/admission evidence is under `.planning/tmp/20-completion-20261026/owner-display/ui-overflow/`. The independent native review is `.planning/tmp/20-completion-20261026/candidate-1.1.2/ui05-readability-independent-review.json`. The frozen full candidate record is `20-1.1.2-INSTALLED-EVIDENCE.json`, SHA-256 `acf5e6dbf871befe09cf0edb07026c9a9d3f1092d5029f9a41289ee56f27c6d4`.

## Historical 1.1.2 native reproduction and actual result

The root operator drove the exact installed candidate on the user-confirmed second PC. Windows scaling was reported as 100%; the restored window was nominally 1280×720 and captured outer images are 1282×721. This environment description does not pass the separate physical-scaling case.

1. Native captures 225/226 show the empty Cost Library and reduced window, 227/228 select the exact CSV, and 229 shows the checking state.
2. Capture **230** (`230-library-valid-preview.json` and `230-library-valid-preview-0.jpg`) shows a valid **20 of 250** preview. Unit and Material/Labor headers collapse into vertically stacked fragments; first-row `ea` and monetary values are similarly fragmented. Close, Cancel Import and Replace Library remain visibly reachable.
3. Capture **232** (`232-library-valid-replace.json` and `232-library-valid-replace-0.jpg`) visually shows the committed **250-item** library and **100 of 250** display cap with the same readability failure. Its accessibility snapshot still reflects the earlier replacing/preview state; that asynchronous tree is not treated as the screenshot's settled state.
4. Settled accessibility capture **233** confirms the committed 250-item/100-displayed counts. Its filename is not proof that Escape/focus return passed.

All native artifacts are under `.planning/tmp/20-completion-20261026/candidate-1.1.2/native/`. An independent reviewer viewed both actual JPGs. Accurate row retention/caps and visible actions are subset positives; required readable units and amounts fail. This is not evidence of parser corruption, project repricing or data loss. It does not pass remaining keyboard/focus, cancel, invalid import, zero/one/many search, legacy/recovery or full UI-01–05 checks.

## Numeric-column source cause and 1.1.3 repair boundary

The reviewed 1.1.2 `CostLibraryDialog.tsx` inherits `overflowWrap: 'anywhere'` into an auto-layout table set to `width: '100%'`. Long Item/Category text competes with Unit/Material/Labor columns, whose cells have no minimum width or no-wrap policy. `overflow: 'auto'` on the surrounding element permits scrolling but does not stop the table algorithm compressing those decision-critical values into fragments. Existing jsdom tests check style strings/text presence and cannot measure this rendered failure.

The scoped source repair retains the 900px dialog, its fixed header/footer, existing table scroller, row caps, state/IPC/focus code and money arithmetic. It reserves no-wrap Unit/money/action columns, lets intrinsic large-money width expand the auto-layout table, bounds wrapping Item/Category cells and gives the table a readable minimum width inside its horizontal scroller. No values are truncated or hidden to make the layout appear to fit. This follows `20-UI-SPEC.md` UI-05: right-aligned numeric values, readable codes/units and independent table scrolling at reduced width.

The production change belongs to `src/renderer/src/components/CostLibraryDialog.tsx` only. Independent final-diff review found no arithmetic/API/selection/focus/cap change. The implementation owner reported 29 existing focused tests passing, renderer typecheck and targeted lint with zero errors; these are source checks, not new installed results.

## Numeric-column Chromium source probe and provenance limits

The implementation owner exercised the actual component with app CSS/local font in an isolated, in-memory mocked-API Chromium harness. Four viewports (1280×720, 900×600, 850×600, 640×480) across preview/committed/picker states produced **12 failing before controls and 12 passing after controls** for measured text/cell containment and reachable scrolling/actions. No production app/profile was used, and this is not a parser, installer or Windows-DPI test.

Raw results, screenshots and preserved bundles are under `.planning/tmp/20-completion-20261026/ui05-layout/{before,after}/`. `PROVENANCE-AND-LIMITS.json` explicitly disqualifies the raw before-report source hash, which was sampled after a source edit; it instead binds the retained old source and compiled before bundle plus native capture 230. The after probe compiled the pre-format source; the final source SHA-256 is `cef21eb811a73522d8b357818c0b06d570684b0e96ff14de0d8dcd525b118ab5`. The format-only transition and screenshot/outer-scroll limitations are retained in that addendum. Do not relabel these reports as exact packaged 1.1.3 proof.

## Exact 1.1.3 native outcome: numeric repair, import-error failure

The root operator subsequently installed and tested the following exact replacement on the same second PC. These identities distinguish the new observations from the frozen 1.1.2 failure.

| Artifact | Identity |
| --- | --- |
| Installed candidate | CLMC Takeoff **1.1.3** |
| Numeric-fix source commit | `dce382493014f79fed5a2631774bb5b0b06d2e23` |
| Installer SHA-256 | `a205fca1e79fee92f15bef309188f231a1c677a17add370c2e88c769666ac93e` |
| Actual ASAR SHA-256 | `fd37e754436c4e9263e69cfe24cf442c1b9ae80b7f2463c2b3bbb09edf8655e4` |
| Release-manifest SHA-256 | `3835b0558cf338979af98b6b21daac9a679f1d1ed7365de27198480505d6d7c8` |
| Packaged-smoke record SHA-256 | `ea8b26212de60a9b9469020d688f239529c5a300cd09378d3e1359271168a0f9` |

Native evidence is under `.planning/tmp/20-completion-20261026/candidate-1.1.3/native/`. At restored 1282×721, capture **038** (`038-library-preview-scroll-right-0.jpg`) shows the same 250-row CSV's preview with complete, single-line Unit/Material/Labor headers and first-row `ea`, `₱123456790.12`, `₱9876543.46`. Cancel Import and Replace Library remain visible. Capture **052** (`052-library-committed250-right-0.jpg`) shows the committed 250-item library, 100-row display cap and readable right-hand values with horizontal scrolling. These actual screenshots substantiate the narrow numeric repair; they do not grant the entire UI-05 case a pass.

The later invalid CSV was rejected with the committed 250-item library retained. At the restored window size, captures **069**, **070** and **072** show the generic rejection status but omit the decision-critical row error. In **069** (`069-library-invalid-settled-after-scroll-0.jpg`), the root operator had already attempted outer-body scrolling; the specific error was still invisible. Its accessibility tree nevertheless contains `Import errors` and this exact item:

> Row 251, Material Unit Rate: Enter a number of zero or more, without formulas, currency symbols or thousands separators.

Capture **071** (`071-library-invalid-maximized-control-0.jpg`) is a positive height control: maximizing the same state to 1920×1032 makes that complete error visibly readable between the generic status and search. Restoring the window in **072** hides it again. An independent reviewer visually inspected 069, 071 and 072. The native application was not instrumented for DOM geometry; the zero-height mechanism below is established by the separate source reproduction, consistent with this native height dependence. Accessibility presence alone is insufficient for visible error recovery.

**Installed 1.1.3 therefore remains FAIL for this performed UI-05 case.** The maximized control is not an acceptable substitute for the required reduced-height behavior. This report does not infer blanket keyboard, picker, legacy-rate, physical-scaling or other UI acceptance from neighboring captures.

Before the 1.1.4 build, the complete 1.1.3 distribution was preserved with CreateNew copies under `candidate-1.1.3/frozen-final/`, including actual ASAR-unpacked resources. Its 153-file inventory SHA-256 is `49ced86b978c567a91d60b07f0a1c5c4aa91e910176b7e49ba164c7989b9e6cb`. The flat ASAR is 48,245,140 bytes. This preserves prior candidate identities; no result is rebound to new bytes.

## Import-error source cause and one-property 1.1.4 repair

The `Import errors` list is a flex child of the dialog's `cost-library-content` column, which has `minHeight: 0` and `overflowY: 'auto'`. The list has `maxHeight: 160` and `overflow: 'auto'`, but its default `flexShrink: 1` and zero automatic minimum allow negative free space to collapse it while the table retains its nonshrinking height. A maximum height only caps growth; it does not prevent the collapse. The full error remains in the DOM/accessibility tree while its rendered list has no usable height.

The only semantic component change for **1.1.4** is `flexShrink: 0` on that list. It preserves natural wrapped height up to the existing 160px cap, after which the list scrolls internally; the existing outer content region can scroll at short heights. There is no fixed/minimum error height, parser/API/rate change, focus change, row-cap change or new table change. Prettier only expands the style object. Independent read-only source review found no blocking concern.

| Source identity | Value |
| --- | --- |
| 1.1.4 source commit | `d3bb480a99545ba115b3f51c555260b693fd6bd7` |
| Exact 1.1.3 component SHA-256 | `cef21eb811a73522d8b357818c0b06d570684b0e96ff14de0d8dcd525b118ab5` |
| Exact 1.1.4 component SHA-256 | `d7757a4d8a3fd32d8d5f21c4e5c50c6ab81e28cfc59f6632fb5dbc1b7514a22a` |

## Import-error Chromium reproduction and source validation

The hidden Chromium harness mounted the actual component, app CSS and local fonts with an in-memory committed 250-item library and invalid-import response. It did not execute the CSV parser, production main, installed app, file picker, library commit or active profile. Each hidden window was destroyed sequentially; the run made zero HTTP requests.

The **eight before controls all failed with actual list height/clientHeight zero**. The **eight after controls all passed** using the exact formatted 1.1.4 component. Management and picker modes were measured with one issue at 1280×720, 900×600 and 640×480; management additionally tested 100 issues at 1280×720 and 640×480. The repaired one-issue list measured 19.5px at the larger viewports and 39px when wrapped at 640px. The 100-issue list retained its 160px cap and reachable internal scroll endpoints.

Assertions used actual text Range rectangles inside the list and outer-content clipping rectangles after appropriate scrolling. They checked the complete first/last error text, exact Row 251 reason, retained 250-item/100-displayed counts, absence of Replace for rejection, enabled Import/Close, visible Close/picker footer and no outer horizontal overflow. This reproduces the native failure beyond text presence or style strings. Short-height outer scrolling remains necessary, and these are source-layout results rather than Windows-DPI or installed acceptance.

Raw before/after source copies, contemporaneous build-input hashes, bundles, geometry and screenshots are under `.planning/tmp/20-completion-20261026/ui05-import-errors/{before-host,after}/`. Unlike the earlier numeric probe's documented hash timing limitation, both error-probe source copies were preserved before their builds and the after copy exactly matches the committed formatted component. `VERIFICATION.json` SHA-256 is `66b098c89558a06fed2473b06e4af65f5f7aab7eb14bfb04b227cd8039b7742e`. The earlier `before/` sandbox attempt stopped at an esbuild parent-directory read denial and supplies no accepted geometry.

Source checks on the repaired component passed:

- **29/29 existing focused tests**, two Cost Library test files, project Node 25.3.0, `NODE_OPTIONS=--no-experimental-webstorage`, `--maxWorkers=2`; test sources were unchanged. Renderer TypeScript and targeted component lint exited zero.
- **1,259/1,259 tests across 160 files**, 113.14 seconds, project Node 25.3.0, the same Node option and `--maxWorkers=4`. The parent supplied the exact host command and observed session 33715 exit zero; an independent review checked the log summary and executable identity. The raw summary itself does not record runtime/flags.

The full passing log is `candidate-1.1.4/full-tests-project-node-host.log`, SHA-256 `99ac7278744faed501dbf1b2eef239863c9eaab2057427a24dee13514fd8eb20`. The separate initial sandbox log `full-tests-project-node.log` failed before test collection because esbuild could not read a parent directory; it is preserved and is not counted as a test pass or a product regression. It is also distinct from the earlier 1.1.3 wrong-Node-24 attempts.

The consolidated source record is `.planning/tmp/20-completion-20261026/candidate-1.1.4/source-validation.json`, SHA-256 `ba2ec2f906489575a22028cd54b32e43a1cc9c6ec4cc71a093fbfba74262c1d0`. It binds the source commit, actual geometry controls, focused checks and full suite without claiming a built or installed 1.1.4 pass.

## Installed 1.1.4 regression update — 26 October 2026

The exact replacement is now built, inspected, smoke-tested and freshly installed. Installer SHA-256 is `82c9c90a38cbbff636b35910a70a959e81be8577e04d1e12174d5eaf70c65838`; ASAR is `7784fcb929929d281dd4974e3452e72343dfaa6e0ca79eed60a84f7cd974258a`. All149installed payload entries match. Build/inspection/smoke records are under `candidate-1.1.4/`.

Actual native captures034–041 at restored1282×721on the100%display show readable single-line units and currency amounts in the250-item preview/committed library, the20-of250preview/100displayed caps, reachable actions and Tab/Shift+Tab focus wrapping. Explicit Replace commits250items. Capture045 visibly displays the complete Row251negative-material-rate reason above the retained250-item table. The committed library, saved project and backup hashes remain unchanged after rejection, independently recorded in `native/library-invalid-preservation.json`. This resolves the two specific previously observed defects on the installed candidate. Full keyboard/search/picker/legacy/recovery/minimum-size coverage is still pending; no whole UI case pass follows.

Capture046's border-drag attempt closed the modal via the backdrop without resizing. It does not prove minimum-size behavior.048contains occluding Codex pixels and is excluded from CLMC visual evidence. Current acceptance and preservation state are in [20-INSTALLED-EVIDENCE.json](20-INSTALLED-EVIDENCE.json). The original profile is currently isolated for1.1.4testing and must be restored after the session. Francis separately accepted the exact1.1.4supplement in [the current decision record](20-1.1.4-RELEASE-DECISIONS.md); this is not final release approval.

## Historical pre-build checkpoint

At this update, the parent is building **1.1.4**. Exact final installer/ASAR inspection, same-candidate packaged smoke and native regression remain pending. On those admitted bytes, repeat the retained-library invalid import at restored 1280×720 and verify the complete Row 251 reason is visibly reachable, including appropriate outer scrolling. Check wrapped/multiple errors and their bounded internal scroll, retained counts and rejection behavior, then recheck the numeric preview/committed/picker columns and reachable header/footer/actions. Remaining keyboard/focus and other required UI states need their own candidate-bound evidence.

The original 3,191-file profile was restored after the historical 1.1.2 session with all recorded hashes matching and its disposable test profile preserved. This report makes no current profile-restoration claim for later sessions. No 1.1.4 installed pass, whole UI-05/Phase 20 completion, dependency acceptance, release approval or Phase 21 distribution is claimed here.
