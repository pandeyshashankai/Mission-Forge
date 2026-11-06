# Serverless readiness update

Implemented and checked 5 November 2026. This applies the supplied expansion
plan's recovery, evidence and offline priorities to the existing browser game.
No backend, accounts, multiplayer or paid API was added.

## Implemented in this update

| Entry | Behavior |
| --- | --- |
| Home → Quick First Orbit | Loads the stock Orbiter-9 with Amateur guidance. A second deliberate action starts the countdown. No learner prediction is fabricated. |
| Home → Mission evidence | Showcase, science sources/checks, engineering tools, report, slides, evaluation protocol and explicit scientific limitations. |
| Evidence → Exact build identity | SHA-256 over produced artifact hashes and the worker template; source commit, uncommitted-state flag, build time and artifact inventory. |
| Home → Data & recovery | Origin usage estimate, persistent-storage request, backup export/import preview, previous snapshots and typed-confirmation deletion. |
| Home → Recover flight | Restores the last committed automatic campaign snapshot **paused**. |
| Prepare offline play | Installs a build-specific cache, verifies SHA-256 for cached artifacts and reports readiness from the worker's complete inventory after reload. |

## Storage contract

The IndexedDB database `missionforge`, schema **1**, contains `entries` and
`recovery` object stores. Values remain JSON strings so established save formats
and pure simulation classes stay separate. Startup hydrates a synchronous session
cache before importing the application. Small `mf.settings` preferences remain in
native localStorage. All other existing `mf.*` records use the database.

Existing localStorage records migrate only when their key is absent in the
primary database. A successful database transaction precedes retirement of the
legacy copy. The database copy wins a duplicate-key conflict. If opening or
migration fails, legacy storage remains available with a visible warning.
Unsupported database record schemas block writes. There are no invented
historical database versions or migrations.

Autosaves, checkpoint libraries, exploration and fleets use a queued asynchronous
commit path. Up to six committed snapshots are retained per recovery category.
Campaign flights snapshot every 15 seconds and when the page becomes hidden or
exits the flight screen; milestone/manual checkpoints also update recovery.
Abrupt process termination can lose changes since the last completed transaction.
A page-close callback cannot guarantee completion. Browser eviction, private-mode
restrictions and device loss still require exported backups.

Failed writes leave the previous database transaction intact and show an export
and recovery action. Unsaved values stay in session memory for export. A successful
write to another key does not dismiss an unresolved failure. Explicit campaign
and exploration saves await the commit before showing success. IndexedDB sessions on supported browsers
use Web Locks to permit one writer tab; another tab remains read-only until the
writer closes and the second tab reloads. Use one game tab on browsers without
Web Locks. Database version changes also block writes until reload.

## Backup contract

The `missionforge-local-backup` envelope has schema version **1**, timestamp,
build identity, JSON-string records and a canonical SHA-256 payload digest.
SHA-256 detects changed content; it is not an author signature. Import checks the
20 MiB file limit, JSON depth/node budgets, finite numbers, reserved property
names, unique application-prefixed keys and supported envelope version before
preview. Supported craft, custom-pack, checkpoint, exploration and fleet shapes
receive additional checks. Campaign snapshots reject fields that would replace
simulation or guidance methods. These are bounded shape/consistency checks, not
scientific validation of every user-supplied flight state.

A restore merges matching keys and retains others. The resulting archive is
checked before application. Primary records commit together in one IndexedDB
transaction. Preferences use localStorage and cannot participate in that database
transaction; a storage-writability probe runs first. Restore reloads to reinstall
custom catalogues and rehydrate state. Corrupt files fail before active records
are changed. Data deletion affects MissionForge progress/preferences and recovery
history, never unrelated origin keys. Offline assets remain installed.

## Offline/build contract

`npm --prefix frontend run build` runs the artifact identity generator. It hashes
compiled files, science/model data and submission documents. The generated worker
uses that identity in its cache name. Installation fails on an incomplete or
mismatched asset; old caches are removed only after successful activation. Cached
assets are served together from the installed build. Updates activate through the
home-screen preparation action, outside active flight. Missing inventory assets
make readiness incomplete on a later status query.

After changing a generated report or slide PDF in an existing build, rerun
`node frontend/scripts/build-identity.cjs`. Prefer a fresh production build for a
release. The earlier working-tree audit was explicitly marked uncommitted. The
current clean implementation commit and build are recorded in
`docs/submission/final-validation.json`; deployment remains a separate check.

## Plan coverage and remaining work

Existing features retained: fixed-step replay/version guards, local planner and
replay workers, source-to-value science inspection, prediction/fly/explain journal,
finite-burn/entry previews, themes/remappable controls, adaptive rendering and
`?debug=1` FPS/frame/physics/draw-call/resource diagnostics.

This update implements the missing recovery/backups, storage manager, evidence
entry, short demo entry and verified offline installation. A native-language
physics rewrite remains future research. OPFS archives, bounded
OffscreenCanvas plotting, seeded challenges, command palette, gamepad and wake
lock now ship. A complete-source QuickJS Wasm backend is optional; it is not a
native-language rewrite. No measured learner-outcome claim is made.

The local release now has a clean tested implementation commit. Deployment, real
phone and non-Chromium checks, and learner testing remain external tasks. Source
PDFs are references rather than full experimental calibration datasets. Complete
342-constituent station response is implemented; a global ocean atlas is not bundled.

## Reproduce

```sh
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:persistence:ui
npm --prefix frontend run test:offline
```

Browser scripts require the documented Chromium CDP service on port 9222 and the
static production server on port 8080. Their storage helper addresses the actual
application adapter; explicit `window.localStorage` reads test legacy migration.
The persistence audit separately reads native IndexedDB and injects a real
`QuotaExceededError` into writes to verify that the previous disk value survives.

For a repeatable full release run, use
`npm --prefix frontend run audit:release -- --browser`. It stops at the first
failure and writes individual JSON/log results plus a scoped build manifest to
`docs/submission/release-audit/`. Without `--browser`, the manifest explicitly
limits its result to standard build, regression, campaign and combination audits.
Set `MF_AUDIT_OUTPUT` to choose another output directory.

## Initial reliability release audit

All 15 release-audit groups passed on 5 November 2026: 289 standard regression
checks, 12 expected campaign outcomes, 66,916 bounded generated cases, the
74-assembly browser catalogue audit plus two rejected imports, persistence,
interface, controls, engineering, visual tools, roadmap/replay, advanced tools,
submission documents, the full learning showcase and offline First Orbit.
The [build-scoped manifest](submission/release-audit/manifest.json) records the
actual commands, completion times, results, source commit and dirty-tree flag.
Browser coverage uses Chromium with software WebGL and emulated viewports.

A subsequent [expanded validation run](expanded-validation.md) passed all 25
audit groups, including 621,913 generated checks and 330 device/world/craft cases.
The build-scoped manifest records the latest completed run.


The local usability extension adds command search, repeatable seeded challenges,
logbook comparisons, configurable gamepad input, opt-in comfort APIs and a separate
bounded replay archive. OPFS archive bytes/metadata use a separate storage contract;
progress backup and clear actions explicitly exclude them. IndexedDB blob fallback
and archive checksums retain a local path when OPFS is unavailable. The sandbox
adds a bounded JS/Wasm component benchmark and OffscreenCanvas/canvas orbit plot.
Production [optimization](optimization.md) preserves physics, warp and display
quality rather than lowering simulation throughput under load.


## Current release addendum — 6 November 2026

The historical deferred items above are superseded by the implemented command
palette, challenges, gamepad controls, wake lock, OPFS archive and connected
learning workflow. Station loading now includes all 342 HARDISP constituents;
convex mesh fracture/contact and full-source QuickJS Wasm sessions are optional.
These do not supply a global ocean atlas or native-language engine rewrite.

The release audit now records 30 passing groups against a clean implementation
commit. See `docs/submission/final-validation.json` and the GitHub-reviewable
transcripts. Cloudflare deployment, physical hardware and learner testing remain
external checks; their outcomes are not claimed by this local audit.
