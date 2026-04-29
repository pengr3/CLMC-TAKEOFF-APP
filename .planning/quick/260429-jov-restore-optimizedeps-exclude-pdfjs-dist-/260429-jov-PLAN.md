---
phase: quick
plan: 260429-jov
type: execute
wave: 1
depends_on: []
files_modified:
  - electron.vite.config.ts
autonomous: false
requirements:
  - QUICK-RESTORE-OPTIMIZEDEPS
must_haves:
  truths:
    - "Vite dev server starts without trying to pre-bundle pdfjs-dist"
    - "Electron renderer process loads successfully and 'ready-to-show' fires"
    - "The app window becomes visible on dev launch"
  artifacts:
    - path: "electron.vite.config.ts"
      provides: "renderer.optimizeDeps.exclude entry containing 'pdfjs-dist'"
      contains: "optimizeDeps"
  key_links:
    - from: "electron.vite.config.ts (renderer)"
      to: "Vite dep optimizer"
      via: "optimizeDeps.exclude"
      pattern: "exclude:\\s*\\[[^\\]]*['\"]pdfjs-dist['\"]"
---

<objective>
Restore the `optimizeDeps: { exclude: ['pdfjs-dist'] }` block in the renderer section of `electron.vite.config.ts`. This block was accidentally removed; without it, Vite's dep optimizer attempts to pre-bundle pdfjs-dist (which ships pre-bundled ESM with a worker), the renderer crashes before `ready-to-show` fires, and the Electron window remains hidden.

Purpose: Unblock dev launch — restore the previously-working configuration so the renderer initializes cleanly and the window becomes visible.
Output: One-line config addition in `electron.vite.config.ts`; dev server starts and Electron window appears.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@electron.vite.config.ts

<interfaces>
<!-- Current renderer config (post-regression) — note the missing optimizeDeps block: -->

```typescript
renderer: {
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: resolve('node_modules/pdfjs-dist/build/pdf.worker.mjs').replace(/\\/g, '/'),
          dest: '.'
        }
      ]
    })
  ]
}
```

<!-- Target shape — optimizeDeps added as a sibling of resolve/plugins: -->

```typescript
renderer: {
  resolve: { ... },
  plugins: [ ... ],
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  }
}
```
</interfaces>

Background: pdfjs-dist 5.5.x ships as pre-bundled ESM with a separate worker file already copied via `viteStaticCopy`. When Vite's dep optimizer tries to re-bundle it, the worker reference and module shape break, the renderer throws during init, and `ready-to-show` never fires. Main process uses `show: false` + `ready-to-show` (BrowserWindow pattern in `src/main/index.ts`), so the window stays hidden — the app appears to silently fail.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restore optimizeDeps.exclude in renderer config</name>
  <files>electron.vite.config.ts</files>
  <action>
    Edit `electron.vite.config.ts`. Inside the `renderer: { ... }` object, add an `optimizeDeps` property as a sibling of `resolve` and `plugins`:

    ```typescript
    optimizeDeps: {
      exclude: ['pdfjs-dist']
    }
    ```

    Place it after the `plugins` array (after the closing `]` and trailing comma). Do NOT modify `main`, `preload`, the `resolve.alias` block, or the `plugins` array. The `viteStaticCopy` worker copy step must remain — it works in tandem with the optimizer exclusion (worker is served as a static asset; main module is consumed as-is without pre-bundling).

    Why exclusion (not inclusion): pdfjs-dist already ships pre-bundled ESM. Vite's optimizer tries to flatten it into a single chunk and breaks the worker reference path. Excluding it tells Vite "leave this module alone — it knows how to load itself."
  </action>
  <verify>
    <automated>node -e "const c = require('fs').readFileSync('electron.vite.config.ts','utf8'); if(!/optimizeDeps\s*:\s*\{[^}]*exclude\s*:\s*\[[^\]]*['\"]pdfjs-dist['\"]/s.test(c)) { console.error('MISSING: optimizeDeps.exclude pdfjs-dist'); process.exit(1) } else { console.log('OK: optimizeDeps.exclude pdfjs-dist present') }"</automated>
  </verify>
  <done>
    `electron.vite.config.ts` parses as valid TypeScript, the renderer section contains `optimizeDeps: { exclude: ['pdfjs-dist'] }`, and `main`/`preload`/existing renderer plugins are unchanged.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Confirm dev launch — window visible</name>
  <what-built>The renderer config now excludes pdfjs-dist from Vite's dep optimizer. The Electron window should now appear on dev launch.</what-built>
  <how-to-verify>
    1. From the project root, run: `npm run dev` (or whatever script invokes `electron-vite dev` for this project — check `package.json` scripts).
    2. Wait for the Vite dev server to print its ready banner and for Electron to spawn.
    3. Confirm the Electron window becomes visible (not just present in the taskbar — actually rendered on screen).
    4. Open DevTools (Ctrl+Shift+I) in the renderer and confirm there are NO errors mentioning `pdfjs-dist`, `optimizeDeps`, `pre-bundling`, or `worker`.
    5. Load any PDF (open a file via the toolbar) to confirm pdfjs-dist itself still works at runtime.

    Expected: Window appears within a few seconds of dev start, console is clean of pdfjs/optimizer errors, PDF rendering works.

    If the window still fails to appear: check the main-process terminal for renderer crash errors and the renderer DevTools console for module-loading errors — report exact text.
  </how-to-verify>
  <resume-signal>Type "approved" if window appears and PDF loads, or paste the error output if anything fails.</resume-signal>
</task>

</tasks>

<verification>
- `electron.vite.config.ts` contains `optimizeDeps: { exclude: ['pdfjs-dist'] }` inside the `renderer` block.
- `npm run dev` starts both Vite and Electron without renderer errors.
- Electron window becomes visible on launch (proves `ready-to-show` fired, proves renderer didn't crash).
- Loading a PDF still works (proves the exclusion didn't break runtime resolution of pdfjs-dist).
</verification>

<success_criteria>
- Single config edit committed: optimizeDeps.exclude restored.
- Dev launch sequence works end-to-end: Vite ready → Electron spawns → window visible → PDF loadable.
- No regressions to main, preload, or other renderer config.
</success_criteria>

<output>
After completion, create `.planning/quick/260429-jov-restore-optimizedeps-exclude-pdfjs-dist-/260429-jov-SUMMARY.md` summarizing:
- The exact diff applied to `electron.vite.config.ts`
- The dev-launch verification result (window visible? PDF loads?)
- Any follow-up needed (e.g., add an inline comment warning future contributors not to remove the block, or guard via lint rule)
</output>
