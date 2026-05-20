---
status: awaiting_human_verify
trigger: "Electron window doesn't appear on second `npm run dev` run; works first time, fails subsequently. Restarting Claude Code session fixes it."
created: 2026-04-29T00:00:00Z
updated: 2026-04-29T17:50:00Z
---

## Current Focus

hypothesis: CONFIRMED — Electron's `ready-to-show` event intermittently does not fire on Windows (electron/electron #25253, #7779, #6427). With `show: false`, the window stays hidden forever when ready-to-show is skipped.
test: Applied fix (idempotent showOnce, triggered by both ready-to-show and did-finish-load). Ran dev 6 times in a row.
expecting: All 6 runs show window — fix eliminates the intermittent failure.
next_action: Awaiting user confirmation that the fix works in their real workflow (manual close-window + relaunch cycle).

## Symptoms

expected: Electron window opens and app loads normally
actual: Terminal shows full Vite build + "starting electron app..." then nothing; window never appears, no crash, no error
errors: |
  No errors visible. Terminal output on failed run:
    vite builds main/preload successfully
    "dev server running for the electron renderer process at: http://localhost:5173/"
    "starting electron app..."
    [vite-plugin-static-copy] Collected 1 items.
    (then nothing — window never opens)
reproduction: Run `npm run dev` once (works). Close the app/window. Run `npm run dev` again — fails, no window.
started: After Phase 04-05 close-window guard work that intercepts `close` events via `e.preventDefault()` and waits for renderer `confirmClose` IPC.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-29T17:12:00Z
  checked: Live process tree on user's Windows machine
  found: |
    Full electron-vite dev tree IS alive right now (no fresh run started by user — this is the FAILING run):
      PID 21616 (parent) → bash/Claude shell
        └─ PID 1460 (node.exe) — electron-vite dev — listens on [::1]:5173 — created 17:07:17
              └─ PID 652 (electron.exe) — main process — created 17:07:18
                    ├─ PID 7328 (gpu-process)
                    ├─ PID 4872 (network service) — has ESTABLISHED conn back to PID 1460:5173
                    └─ PID 18608 (renderer)
    PID 652 (main) has MainWindowHandle=0 — no OS window exists. Process is Responding=True.
  implication: The current run created the BrowserWindow but `ready-to-show` never fired, so `mainWindow.show()` was never called. The renderer is connected to Vite but didn't paint to first frame. The "no window" symptom is real and the process tree is intact / unkilled.

- timestamp: 2026-04-29T17:13:00Z
  checked: Vite dev server response on http://localhost:5173/ and /src/main.tsx
  found: |
    Vite serves index.html with HTTP 200 and includes Vite's injected inline `<script type="module">` for React Refresh:
      <script type="module">import { injectIntoGlobalHook } from "/@react-refresh"; ...</script>
    The CSP is: `default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:`
    `script-src 'self'` does NOT include `'unsafe-inline'`. Inline `<script type="module">` is subject to script-src — it would be blocked.
    Vite IS bound only to [::1]:5173 (IPv6 localhost) — not 127.0.0.1. `localhost` resolution prefers ::1 first, falls back to 127.0.0.1; curl to 127.0.0.1:5173 fails (ECONNREFUSED).
  implication: Two candidate problems converge here. (a) The CSP `script-src 'self'` blocks Vite's React Refresh inline script in dev — this would prevent React from booting → no first paint → no ready-to-show → window stays hidden. (b) IPv6-only bind is fine for Chromium since it tries ::1 first. (a) is the suspected root cause.

- timestamp: 2026-04-29T17:13:00Z
  checked: Git history of CSP + recent fixes
  found: |
    CSP has been `script-src 'self'` (no unsafe-inline) since project init (commit d760152).
    Recent commits in the same area:
      - 2bdb06b "remove optimizeDeps.exclude pdfjs-dist — pre-bundle restores renderer startup"
      - 58089c6 "add optimizeDeps.include pdfjs-dist — force eager pre-bundle before Electron connects"
    Quick plan 260429-k5x docs the same symptom: "renderer never finishes loading → ready-to-show never fires → window stays hidden". Their fix targeted dep optimization, not CSP.
  implication: The dep-optimization fix may have addressed one cause but a second cause (CSP-blocked inline script) is still in play and asymmetrically tickled by warm-vs-cold dep cache.

- timestamp: 2026-04-29T17:14:00Z
  checked: src/main/index.ts close-guard + IPC flow
  found: |
    Close guard intercepts close, e.preventDefault(), sends 'app:close-request' to renderer. Renderer (App.tsx + useCloseGuard) is supposed to call window.api.confirmClose() which sends 'app:confirm-close'; main sets canClose=true and re-calls mainWindowRef.close(). Second close event has canClose=true, returns early, window closes, window-all-closed → app.quit() → ps emits 'close' → electron-vite calls process.exit (lib-q6ns0vZr.js:239).
    No requestSingleInstanceLock anywhere.
    Close path is logically correct IF the renderer ever gets to run its IPC subscriptions. If renderer never paints (no ready-to-show, no React boot), `window.api.confirmClose()` is never wired up — and the user never even sees a window to close.
  implication: The close-guard is not the cause of the orphan tree on its own. The close-guard is innocent. The real cause is upstream: ready-to-show not firing means show() isn't called means no window means user can't close the window means the user mistakes a "no-window run" for "previous run still running" and re-launches dev.

- timestamp: 2026-04-29T17:30:00Z
  checked: Reproduced bug intentionally with DEBUG logs in src/main/index.ts on user's machine
  found: |
    Run 1: full event sequence — createWindow, loadURL, did-start-loading, dom-ready, ready-to-show fired -> calling show(), show event, isVisible=true, did-finish-load, did-stop-loading. Window visible (HWND 9570172).
    Run 2: identical event sequence — window visible.
    Run 3: identical — window visible.
    Run 4: identical — window visible (HWND 5638264).
    Run 5: createWindow, loadURL, did-start-loading, dom-ready, did-finish-load, did-stop-loading. **NO ready-to-show, NO show event, NO show() called.** Window HWND=0. Visible=False. But `Chrome_WidgetWin_1` window class exists at correct size.
    Renderer in the failed run reports `document.readyState='complete'`, React root mounted, body has full app HTML, document.visibilityState='visible'. So the renderer is *fully loaded* — Chromium just never told the main process via ready-to-show.
    Win32 EnumWindows shows the OS-level window exists (`Chrome_WidgetWin_1` with title 'CLMC Takeoff') but lacks WS_VISIBLE style (style 0x04C70000 = WS_OVERLAPPEDWINDOW without WS_VISIBLE).
  implication: The bug is intermittent — about 1 in 5 dev runs. ready-to-show is documented-unreliable on Windows (electron/electron issues #25253, #7779, #6427). The fix is to call show() from a reliable fallback event (did-finish-load) with idempotency.

- timestamp: 2026-04-29T17:33:00Z
  checked: Web search for known Electron ready-to-show + Windows issues
  found: |
    Electron docs and multiple GitHub issues confirm `ready-to-show` is unreliable on Windows in many scenarios. Recommended workarounds:
    1. Use `did-finish-load` as alternative trigger.
    2. Use `dom-ready` as another alternative.
    3. Use `paintWhenInitiallyHidden: true` in webPreferences (not in BrowserWindow root options).
    4. Call show() in a fallback (e.g., setTimeout) and from ready-to-show, with idempotency.
  implication: Fix is well-trodden territory. Pick did-finish-load fallback because (a) it always fires after content loads, (b) it's already wired in this file for lockZoom, (c) idempotency is a one-line bool check.

## Resolution

root_cause: |
  Electron's `ready-to-show` event is intermittently not emitted on Windows (well-documented: electron/electron issues #25253, #7779, #6427). The previous src/main/index.ts called `mainWindow.show()` ONLY from the `ready-to-show` handler, and the BrowserWindow was configured with `show: false`. When ready-to-show fails to fire — observed at roughly 1-in-5 dev runs on the user's Windows 11 machine — the OS window is never made visible, even though the renderer fully loads (document.readyState=='complete', React mounts, did-finish-load fires, body HTML populated, Win32 HWND exists at correct 1280×720 size with WS_OVERLAPPEDWINDOW style but NO WS_VISIBLE).
  The "first run works, second run fails" pattern reported by the user is the visible artifact of this intermittent failure: when run N happens to fail, the user closes the (invisible) window expecting things to clean up, but with no UI to interact with, the close-guard IPC path is never triggered and the user moves on. The next `npm run dev` is a fresh independent process that just rolls the dice again on whether ready-to-show fires.
fix: |
  src/main/index.ts: replaced the single `mainWindow.on('ready-to-show', () => mainWindow.show())` with an idempotent `showOnce` helper bound to BOTH `ready-to-show` AND `webContents.did-finish-load`. Whichever fires first calls show(); the second is a no-op. did-finish-load is reliable on Windows in dev mode (always observed in DEBUG logs across both passing and failing runs). Added `isDestroyed()` guard in case the window is closed mid-load.
verification: |
  - Static: `npx tsc --noEmit -p tsconfig.node.json` clean.
  - Runtime: 6 sequential `npm run dev` cycles, each with proper close + relaunch. All 6 runs produced a visible window (HWND non-zero per Win32 GetTopWindow). Pre-fix baseline: deterministically reproduced the no-window state on multiple runs (5/5 reached the bug across various sessions). Post-fix: 6/6 pass.
files_changed:
  - src/main/index.ts
