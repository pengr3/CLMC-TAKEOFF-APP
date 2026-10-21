# Phase 20: Production Readiness — Pattern Map

**Mapped:** 2026-10-21
**Scope:** CONTEXT, RESEARCH and approved UI-SPEC. Paths marked **proposal** are suggested seams, not existing files or locked filenames. Grouped rows describe coupled files; planner must settle final ownership.
**Tracked-source gate:** Existing analogs below verified with `git ls-files -- <path>`; no runtime mirrors. No product changes made.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/main/project-io.ts` | service | file-I/O | same file, archive assembly/extraction | exact |
| `src/main/ipc-handlers.ts` | controller | request-response/file-I/O | same file, writeProject | exact, unsafe retry must change |
| `src/main/project-storage.ts` **proposal** | service | file-I/O | `src/main/ipc-handlers.ts` | role-match; backup protocol new |
| `src/main/project-recovery.ts` **proposal** | service | file-I/O | `src/main/project-io.ts` | partial; bounded snapshot repository new |
| `src/main/project-recovery-ipc.ts` **proposal** | controller | request-response | `src/main/cost-library-ipc.ts` | role-match |
| `src/main/cost-library.ts` | service | batch/file-I/O | `src/main/cost-library-ipc.ts` preview seam | partial |
| `src/main/cost-library-ipc.ts` | controller | request-response | same file | exact |
| `src/main/cost-library-worker.ts` **proposal** | service | batch/event-driven | none | no worker-lifecycle analog |
| `src/main/index.ts` | config | event-driven | same file, ready registration | exact |
| `src/shared/reliability.ts` **proposal** | model | request-response | `src/preload/index.ts` wire union | role-match |
| `src/preload/index.ts`, `src/preload/index.d.ts` | middleware/model | request-response | `src/preload/index.ts` | exact boundary |
| `src/renderer/src/hooks/useProject.ts` | hook | request-response/file-I/O | same file | exact seam; revision protocol new |
| `src/renderer/src/hooks/useCloseGuard.ts`, `useKeyboardShortcuts.ts`, `useExport.ts` | hook | event-driven | `src/renderer/src/hooks/useProject.ts` result contract | partial |
| `src/renderer/src/hooks/useRecovery.ts` **proposal** | hook | event-driven | `src/renderer/src/hooks/useProject.ts` | role-match |
| `src/renderer/src/lib/project-schema.ts`, `project-serialize.ts` | model/utility | transform | `src/renderer/src/lib/project-serialize.ts` | exact |
| `src/renderer/src/lib/boq-types.ts`, `boq-aggregator.ts`, `apply-library-rate.ts` | model/utility | transform | same files | exact seams; basis conversion new |
| `src/renderer/src/lib/rate-units.ts` **proposal** | utility | transform | `src/renderer/src/lib/scale-math.ts` | partial |
| `src/renderer/src/stores/projectStore.ts`, `scaleStore.ts` | store | event-driven | `src/renderer/src/lib/project-serialize.ts` store boundary | partial |
| `src/renderer/src/hooks/usePdfRenderer.ts` | hook | batch/event-driven | same file | exact; eviction new |
| `src/renderer/src/components/TitleBar.tsx`, `TopActionBar.tsx`, `StatusBar.tsx`, `src/renderer/src/App.tsx` | component | event-driven | `src/renderer/src/components/TitleBar.tsx` | role-match |
| `src/renderer/src/components/CostLibraryDialog.tsx`, `EstimateRow.tsx`, `EstimatePanel.tsx` | component | request-response/event-driven | `src/renderer/src/components/SaveCloseModal.tsx` (dialog skin only), `src/renderer/src/lib/apply-library-rate.ts` (rate application) | partial |
| `src/renderer/src/components/AboutDialog.tsx`, `RecoveryDialog.tsx`, `SaveFailureDialog.tsx`, `LegacyRateReviewDialog.tsx`, `UpgradeProjectDialog.tsx` **proposals** | component | event-driven | `src/renderer/src/components/SaveCloseModal.tsx` | role-match; accessible behavior must improve |
| `src/renderer/src/hooks/useDraggable.ts`, proposed shared modal/focus hook | hook | event-driven | `src/renderer/src/components/SaveCloseModal.tsx` integration | partial |
| `package.json`, `electron-builder.yml`, `electron.vite.config.ts` | config | batch | `electron-builder.yml` | role-match; allowlist new |
| Bundled release notes, proposed release/upgrade/checklist docs | config | file-I/O | none | no release-evidence analog |
| Existing relevant `src/tests/*.test.ts`; proposed recovery, rate-invariance, worker deadline, packaging and dialog suites | test | batch/event-driven | `src/tests/atomic-write.test.ts` | role-match; actual disk/restart evidence new |

## Pattern Assignments

### 1. Protected save, portable archive and recovery

**Applies to:** project storage/recovery services, IPC, useProject/useRecovery and close guards.

**Archive core:** `src/main/project-io.ts:106-116`:

```ts
export async function assembleClmcZip(
  projectJson: string,
  pdfBytes: Buffer
): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('project.json', projectJson, { compression: 'STORE' })
  zip.file('plan.pdf', pdfBytes, { compression: 'STORE' })
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}
```

The last expression is formatted compactly here; names/values match source. Reuse this metadata/PDF pairing rather than build a second project serializer. Extraction at `125-135` uses exact archive names, rejects missing entries, then reads both with `Promise.all`. Add entry/uncompressed-size limits before unrestricted extraction; current JSZip load is not a resource-bound model.

**IPC/imports:** `src/main/ipc-handlers.ts:1-13` imports Electron, `fs/promises`, path helpers, project-io and BOQ writers. Existing write boundary at `234-237`:

```ts
const pdfBuf = u8ToBuf(pdfBytes)
const zipBuf = await assembleClmcZip(jsonText, pdfBuf)
await atomicWriteFile(filePath, zipBuf)
return { ok: true }
```

Preserve a main-owned filesystem boundary, add validated payloads and serialized saves. **Do not copy** the destination deletion at `123-124` or fixed `${finalPath}.tmp` at `96-98` into durable project saves: a later rename failure can leave the original absent. Implement unique temp paths, validated last-good backup and replacement failure preservation. Library/export behavior sharing this helper must receive explicit regression consideration.

**Renderer lifecycle:** `src/renderer/src/hooks/useProject.ts:130-145`:

```ts
const snap = snapshotProject({
  pdfOriginalFilename: fileName,
  pdfSha256,
  pdfTotalPages: totalPages,
  perPageDimensions: perPageDims,
  createdAt
})
await window.api.writeProject(clmcPath, JSON.stringify(snap), pdfBytes)
useProjectStore.getState().setSaved(clmcPath)
return 'ok'
```

Its enclosing catch returns `'error'`; finally calls `setSaving(false)`. Keep the `'ok' | 'canceled' | 'error'` caller contract or update every guard together. Current flow reads PDF state before async hash/dimension work and captures store metadata afterwards; freeze PDF+metadata+revision coherently before awaits. Replace unconditional clean acknowledgement with captured-revision acknowledgement so edits during a save stay dirty. Background recovery never invokes `setSaved`.

Recovery is a **new protocol**, not a complete existing analog: stage coherent metadata+PDF, advertise only completed snapshots, validate fully before replacing stores, retain kept/failed candidates, explicit selected deletion, saved/unsaved association rules and cleanup only for matching saved/discarded revisions. Follow UI-SPEC for 60-second dirty scheduling and bounded storage behavior.

### 2. Serialization, rate units and invariant money

**Applies to:** schema/serialize, project and scale stores, price model/aggregator, Estimate editing, library application and exports.

`src/renderer/src/lib/project-serialize.ts:165-177` preserves legacy scalar rates, sanitizes object rates and rejects reserved dictionary keys:

```ts
if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
if (typeof v === 'number') {
  safeRates[k] = {
    material: coerceField(v, 0),
    labor: 0,
    markup: DEFAULT_MARKUP_PCT
  }
} else if (v && typeof v === 'object') {
  const e = v as Partial<PriceEntry>
  safeRates[k] = {
    material: coerceField(e.material, 0),
    labor: coerceField(e.labor, 0),
    markup: coerceField(e.markup, DEFAULT_MARKUP_PCT)
```

Extend BOTH snapshot and hydrate for rate basis/review state; otherwise hydration silently drops new fields. Retain the existing dirty-tracking suppression and final reset (`205-209`), then deliberately mark recovered/migrated projects dirty after successful restore. Never make absent legacy basis look reviewed by assigning an unquestioned default.

**Price model:** `src/renderer/src/lib/boq-types.ts:12-19` currently contains only material/labor/markup. Persist explicit basis alongside these. Aggregator `267-275` is the shared monetary seam:

```ts
const entry = rates[`${name}|${type}`]
const material = entry?.material ?? 0
const labor = entry?.labor ?? 0
const markup = entry?.markup ?? defaultMarkup ?? DEFAULT_MARKUP_PCT
const materialCost = material * acc.quantity
const laborCost = labor * acc.quantity
const cost = materialCost + laborCost
const price = cost * (1 + markup / 100)
const margin = price - cost
```

Convert the shown rates into the quantity's unit basis before this calculation; retain `??` so valid zeroes survive. Reuse the resulting BOQ rows for both internal exports instead of independently converting in each writer. Count stays per piece; wall retains actual area basis.

**Conversion primitive/import convention:** `src/renderer/src/lib/scale-math.ts:1-3,50-58` imports `MM_PER_UNIT` from `../types/scale`, and defines:

```ts
export function toMm(value: number, unit: ScaleUnit): number {
  return value * MM_PER_UNIT[unit]
}
export function fromMm(mm: number, unit: ScaleUnit): number {
  return mm / MM_PER_UNIT[unit]
}
```

Reuse this canonical length basis; derive squared factors for areas and inverse factors for rates. Rate conversion/legacy acknowledgement itself has no complete analog.

**Exact library-unit guard:** `src/renderer/src/lib/apply-library-rate.ts:14-19`:

```ts
const unit = normalizeLibraryUnit(target.uom)
if (!unit || unit !== normalizeLibraryUnit(source.unit))
  return {
    ok: false,
    reason: `Choose a rate per ${target.uom}. Rates are not automatically converted.`
  }
```

Keep this contract. At `24-28`, `setPrice` copies material/labor and preserves markup; extend that write with explicit visible basis. Manual entry must use the same basis policy.

### 3. Cost import isolation and typed bridge

**Applies to:** cost-library service/IPC, proposed parser worker, preload and CostLibraryDialog.

**Imports/core:** `src/main/cost-library-ipc.ts:1-15` uses Electron, fs/promises, crypto `randomUUID`, shared types, a `CostLibraryRepository(app.getPath('userData'))` and sender-keyed candidates. At `43-49`:

```ts
const path = pick.filePaths[0]
if ((await stat(path)).size > MAX_LIBRARY_FILE_BYTES)
  return { ok: false, reason: 'Choose a cost library smaller than 10 MB.' }
const result = await parseCostLibrary(await readFile(path), path)
if (!result.ok) return result
const candidate = {
  token: randomUUID(),
```

At `57-65`, only a successful parse enters `candidates`; sender destruction clears candidates. At `74-82`, cancel and commit verify sender/token and prevent simultaneous replacement. Preserve all of these boundaries. Substitute isolated parsing at line 46; compressed input-size alone is insufficient. New worker supervisor needs enforced termination deadline/resource preflight, crash/exit handling, exactly-once completion and stale candidate invalidation. There is **no existing worker implementation to copy**.

Use the explicit result shape already present at `66-71` (`{ ok: false, reason: ... }`), extending stable failure categories for timeout/resource/parser copy. Do not replace the committed repository until explicit valid-token commit. UI busy state must clear in finally and rejected imports must expose no replacement preview.

`src/preload/index.ts:8-12` demonstrates a narrow discriminated wire union:

```ts
type ReadProjectResult =
  | { kind: 'v2-zip'; projectJson: string; pdfBytes: Uint8Array; computedSha256: string }
  | { kind: 'v1-json'; text: string }
  | { kind: 'unknown'; reason: string }
```

Prefer shared typed version/recovery/failure contracts, explicit channel methods and matching declarations. Do not expose arbitrary IPC or filesystem calls. Existing sender ownership is a useful pattern, not a complete trusted-sender/payload validation guard.

### 4. Runtime identity, packaging and visible version

**Applies to:** main startup, builder/package/Vite configuration, bridge, TitleBar, About and bundled notes.

`src/main/index.ts:94-102` registers handlers after readiness:

```ts
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.clmc.takeoff')
```

`registerIpcHandlers()` and `registerCostLibraryHandlers()` follow at `101-102`. Register trusted version/recovery seams there; any storage identity pinning/migration must happen before repository construction. `electron-builder.yml:1-2` currently says `appId: com.electron.app` / `productName: clmc-takeoff`, while main uses the CLMC model ID. Treat this mismatch and storage compatibility as migration work; changing identity blindly is not an analog.

`electron-builder.yml:5-11` is a negative exclusion list; replace with an explicit reviewed production inclusion policy. Keep worker/release-note/PDF-worker assets reachable in packaged output. Remove placeholder generic publishing at `41-43`; preserve the approved manual upgrade workflow. No existing positive package allowlist is present.

`src/renderer/src/components/TitleBar.tsx:10-25` selects filename/current path/dirty/saving, then composes Saving/dirty title variants. Extend these selectors with the bridge-supplied version; preserve state indicators and keep app/version visible independently of filename truncation. No guessed fallback version.

### 5. Bounded PDF cache and DPI

**Applies to:** usePdfRenderer and focused cache/alignment tests.

`src/renderer/src/hooks/usePdfRenderer.ts:1-4` imports React hooks, PDF proxy types, canvas constants and viewer store. Existing cache (`19-26`):

```ts
interface CachedPage {
  canvas: HTMLCanvasElement
  width: number
  height: number
}
const pageCache = new Map<string, CachedPage>()
let cachedDocumentRef: PDFDocumentProxy | null = null
```

Replace its unbounded lifetime with explicit canvas byte accounting/eviction. Preserve document invalidation (`79-82`) and foreground cancellation (`92-94`, `185-190`); extend keys/lifecycle for DPR changes and stale adjacent renders. Current `page-${pageNumber}` key alone does not encode DPR.

**Physical backing versus logical dimensions:** `45-58`:

```ts
const canvas = document.createElement('canvas')
canvas.width = Math.floor(viewport.width * dpr)
canvas.height = Math.floor(viewport.height * dpr)
const transform: [number, number, number, number, number, number] | undefined =
  dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
const renderTask = page.render({ canvas, viewport, transform })
await renderTask.promise
return { canvas, width: Math.floor(viewport.width), height: Math.floor(viewport.height) }
```

Return object is compacted without semantic change. Keep physical raster sharpness separate from stored geometry. Existing `clampedRenderScale` (`6-15`) changes viewport scale when max dimensions are exceeded; verify geometry calibration independently at clamping thresholds rather than assuming current returned viewport size is invariant.

### 6. Recovery/version/review dialogs and tests

**Applies to:** proposed dialogs, More menu, existing save/open/close dialogs, CostLibrary layout, draggable viewport constraints.

**Skin/imports:** `src/renderer/src/components/SaveCloseModal.tsx:1-3`:

```ts
import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'
import { useDraggable } from '../hooks/useDraggable'
```

At `43-54`, dialog semantics and visual recipe are:

```tsx
role="dialog"
aria-modal="true"
aria-label="Save changes before closing"
```

The style uses width 420, padding 20, `COLORS.secondary`, `COLORS.border`, radius 8, 13px body and 1.45 line height. Reuse these tokens. Apply approved responsive widths/max-height/internal scrolling; use 640px review/recovery/About and keep Cost Library's 900px cap with persistent footer.

**Do not copy** `SaveCloseModal.tsx:29-32` container-wide Enter-to-save. New/updated dialogs require focused-control activation, focus trap/restoration, safe Escape, portal above canvas and keyboard containment per approved UI-SPEC. Discard needs its own preservation-focused confirmation. About/recovery/legacy review are new workflows despite sharing this skin.

**Test harness:** `src/tests/atomic-write.test.ts:1-22,34-61` uses node Vitest, mocked fs and Electron handler capture:

```ts
const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
// ipcMain.handle mock stores each registered handler in handlers[channel].
await handlers['file:writeProject']({}, finalPath, fakeJson, fakePdf)
expect(fsP.writeFile).toHaveBeenCalledWith(tmpPath, expect.any(Buffer))
expect(fsP.writeFile).not.toHaveBeenCalledWith(finalPath, expect.any(Buffer))
expect(fsP.rename).toHaveBeenCalledWith(tmpPath, finalPath)
```

Keep failure injection but replace tests that explicitly expect destination unlink (`64+`). Add real temporary-directory checks that original/last-good bytes survive every failure stage, revision-in-flight checks, complete recovery restart checks, unit invariants and actual terminated-parser tests. DOM suites should validate focus/keyboard/result behavior; installed Windows upgrade/offline/DPI checks need recorded real evidence, not mocked claims.

## Shared Patterns

- **Process ownership:** main owns filesystem/archive/repository; renderer owns interactive state; preload exposes typed named operations. See assignments 1/3/4.
- **Dirty state:** hydrate under tracking suppression; successful explicit save acknowledges only its captured revision; recovery restores dirty and never emits Saved. Existing unconditional clean operations need adaptation.
- **Validation/error results:** exact archive names, discriminated open/result unions, finite nonnegative money, reserved-key rejection and sender-owned preview tokens are reusable. Add future-format refusal and full candidate validation before store mutation.
- **Units:** use canonical `MM_PER_UNIT`, precise numbers through aggregation and writer-stage formatting; no independent export arithmetic. Library application still requires exact normalized unit match.
- **UI:** shared COLORS/spacing/dialog hierarchy; approved UI-SPEC overrides existing unsafe Enter handling and fixed viewport dimensions. One modal decision at a time.

## No Analog Found

| New behavior | Role / Data Flow | Planner instruction |
|---|---|---|
| Durable last-good replacement and bounded restart recovery | service / file-I/O | Design transaction/repository; reuse archives, not destructive rename retry |
| Enforceable workbook termination/resource limits | service / batch/event-driven | Add packaged isolated worker/supervisor and measured deadline |
| Persisted rate basis plus acknowledged legacy upgrade | utility/model / transform | Add explicit schema/conversion/review contract and money-invariance tests |
| Positive packaging allowlist and installed release evidence | config/test / batch | Follow RESEARCH and validation matrix; confirm packaged assets and real upgrade |
| Accessible shared dialog focus lifecycle | hook/component / event-driven | Follow UI-SPEC; existing dialog is a visual analog only |

## Metadata

**Search scope:** tracked src/main, src/preload, src/shared, renderer hooks/components/lib/stores, tests and root packaging configuration. Focused extraction stopped once the save, serialization, staged IPC, cache and modal patterns were established; supplementary startup/unit/test snippets cover seams these five do not implement.
**Coverage:** Every explicit research file seam classified above; additional files are proposals. Existing paths selected as analogs are tracked. Patterns are source evidence, not a claim that Phase 20 or installed validation has passed.
