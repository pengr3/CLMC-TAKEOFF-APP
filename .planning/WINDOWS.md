---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 1
total_count: 4
last_updated: 2026-10-21T23:50:24.677Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 20 | lint-warning | src/renderer/src/App.tsx | 209 | Pre-existing page-navigation toast effect fails react-hooks/set-state-in-effect | open |  | 2026-10-21T15:31:39.731Z |  |
| 2 | 20 | lint-warning | src/renderer/src/hooks/useCloseGuard.ts | 14 | Pre-existing render-time handler ref assignment fails react-hooks/refs | open |  | 2026-10-21T15:32:31.187Z |  |
| 3 | 20 | lint-warning | src/tests/app-version.test.ts | 21 | Existing app-version test explicit-any and missing-return-type lint errors remain outside the runtime task | open |  | 2026-10-21T23:48:59.898Z |  |
| 4 | 20 | deviation | package.json |  | Patched critical build-time tar archive processing dependency with verified exact tar 7.5.21 override | fixed |  | 2026-10-21T23:49:01.022Z | 2026-10-21T23:50:24.677Z |

````json
[
  {
    "id": 1,
    "kind": "lint-warning",
    "phase": "20",
    "file": "src/renderer/src/App.tsx",
    "line": 209,
    "description": "Pre-existing page-navigation toast effect fails react-hooks/set-state-in-effect",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-21T15:31:39.731Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "lint-warning",
    "phase": "20",
    "file": "src/renderer/src/hooks/useCloseGuard.ts",
    "line": 14,
    "description": "Pre-existing render-time handler ref assignment fails react-hooks/refs",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-21T15:32:31.187Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "lint-warning",
    "phase": "20",
    "file": "src/tests/app-version.test.ts",
    "line": 21,
    "description": "Existing app-version test explicit-any and missing-return-type lint errors remain outside the runtime task",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-21T23:48:59.898Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "20",
    "file": "package.json",
    "line": null,
    "description": "Patched critical build-time tar archive processing dependency with verified exact tar 7.5.21 override",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-21T23:49:01.022Z",
    "resolved_at": "2026-10-21T23:50:24.677Z"
  }
]
````
