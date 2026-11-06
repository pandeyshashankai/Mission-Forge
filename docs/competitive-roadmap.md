# Competitive roadmap implementation

Status: 4 November 2026 (Asia/Calcutta). This records implemented features and
remaining work from the supplied competitive analysis. The comparison text is a
design brief; its embedded citation tokens are not independently retrieved sources.
See `simulator-reference-review.md` for the documentation actually reviewed.

## Implemented in the current release

| Area | Implementation / evidence |
| --- | --- |
| Unified engineering | Builder Staging tab: wet/dry mass, propellant, vacuum/ascent Δv, launch thrust/TWR, per-burn Isp/mass/time. Exploration live mass, local TWR, fuel time, density/q/drag and fixed Cd/area. |
| Numeric maneuver editing | Existing prograde/normal/radial editor retained; new precise seconds-from-now input with finite bounds. |
| Burn execution card | Delivered/remaining Δv, progress, estimated remaining seconds, burn fuel and fuel after current burn. Preview includes both burn durations and reserve. |
| Encounter/SOI display | Scored lunar map shows the lunar SOI wire sphere and up to four predicted transition markers; predicted trajectory still uses the existing patch model. This is not a generic interplanetary encounter solver. |
| NASA provenance | Radius, μ, rotation and atmosphere details expose units, conversions, pinned commit, date, checksum, upstream links and local original downloads. All eight bundled snapshots, including EGM96, have hash tests and original licensing. |
| Physics badge | Scored campaign identifies integrated Earth J2 / central Moon gravity. Exploration identifies its selected force options, including optional J2/harmonics and differential third-body gravity. Approximate ephemerides remain explicit. |
| Deterministic replay | Curated First Orbit config plus launch/advance commands; 60 checkpoints rerun through FlightSim and compare hash `6ec55bdd`. Wall-clock result dates are excluded. The expansion below adds a separate generic single-vessel applied-control recorder. |
| Golden missions | Four explicit trajectory envelope fixtures, across three difficulty settings. Existing objective checks also apply. Expert Lunar Orbiter retains its expected budget-only partial result. |
| Invariant checks | Ten-period circular radius/energy/angular momentum; twenty-period elliptical apsides; 10,000 seeded valid states; invalid initial-state guards. Drag-free invariants are not applied to powered or dissipative flight. |
| J2 validation | Existing scored Earth J2 integration checked against first-order nodal precession over twenty periods at 600 km / 55°, within 3%. This analytic check is retained alongside the actual Orekit reference comparisons in the expansion below. |
| Release browser test | Existing production First Orbit predict→launch→orbit→report→reflection flow plus new showcase/provenance/instrument/stage reuse browser checks. |
| Developer performance | Open `/?debug=1`, then Explore: FPS, physics ms/frame, calls/triangles and GPU resource counts. 8 ms is a target, not a physical-device benchmark claim. |
| Guided showcase | Home → Guided showcase: a 5–7 minute route, live prediction/flight entry, real replay verification and report/deck links. |
| Attitude instrument | Exploration direction sphere shows front/back prograde, retrograde, normal and radial markers, local pitch and six attitude-hold controls. Manual takeover cancels active transfer assistance. |
| Stage timeline / symmetry | Engineering stage timeline added alongside existing staging event editor and 2×/3×/4× booster symmetry. |
| Reusable stages | Inspector saves the selected complete stage and attached boosters locally. Insert appends below the rocket, regenerates unique IDs and resets the staging order for review; undo remains available. |
| Orbital elements | a/e/i/Ω/ω/ν; classical angle singularities are explicitly undefined for circular/equatorial cases. |
| Existing supporting features | Named checkpoints, optional tutorial overlays, flight telemetry/report charts, themes, text/motion controls and shared keyboard/touch controls remain available. |

## Client-only expansion completed in this iteration

The user excluded servers and multiplayer and moved the client-side roadmap into
the current work. [Client-only expansion](client-only-expansion.md) records exact
feature scope, numerical evidence and entry points. Implemented additions include:

| Roadmap family | Current implementation |
| --- | --- |
| P0 recording / encounters / diagnostics | Applied-control trace replay in a bounded worker; coast closest-approach forecasts; performance overlays in both flight renderers. |
| P1 planning / builder | Lambert departure-date/flight-time grid, wet/dry mass and thrust overlays, atmospheric-pass preview, entry q/heating proxy and rolling live flight graphs. |
| P2 forces / integration | Modular central gravity/drag/J2/harmonics/differential third-body/SRP/tide/1PN contributions; Dormand–Prince error control and visible presets. |
| P2 spacecraft systems | Finite-Sun penumbra/annular eclipse-dependent solar generation, battery/blackout behavior, a model ground-link ignition lock and light-time display. |
| P2 fleet | Six persistent locally propagated vessels, real-thrust rendezvous assistance, paired docking, capacity-limited fuel transfer and recoil on undocking. |
| P2 atmosphere | NASA bands plus locally bundled NRLMSISE-00 with entered F10.7/Ap and explicit provenance. |
| P3 scientific playgrounds | Restricted three-body trajectories/Lagrange points/Jacobi monitor, standards-frame matrix workbench, truncated EGM96 harmonics and static elastic Earth tide experiments. |
| P3 creation / extension | Playable custom planets/moons, local part and mission packages, saved/exported ordered visual programs, file-based sharing. |
| Validation / accessibility | Actual Orekit fixtures, native C versus WASM atmosphere checks, ERFA matrix values, mobile instrument grouping, non-blocking notifications and optional offline static-asset caching. |

## Explicit boundaries

The implemented versions are bounded educational features. The tide model is an
instantaneous solid-Earth approximation, not an ocean-loading/frequency-dependent
IERS model. The standards-frame workbench accepts TT/UT1 and polar motion but does
not fetch current EOP or replace the flight world's approximate ephemerides.
Gravity truncates at degree/order 8. Programs use ordered triggers, not arbitrary
code or a general looping language. Docking has port alignment/contact geometry with a paired attachment model,
not a general articulated multi-body constraint solver; generic control recordings cover one active vessel. These limits are shown
in the product and expanded in the implementation document.

Hosted sharing/accounts, central databases, multiplayer and remote simulation
services are excluded by the user's instruction. There is no server work pending.
Physical-device and learner studies remain unperformed; no hardware performance
or learning-gain claim is inferred from browser emulation and unit tests.

## Reproduce checks

From `frontend/`: `npm test`, `npm run test:campaign`, `npm run test:advanced:ui`,
`npm run test:engineering:ui`, `npm run test:ui`, `npm run test:controls` and
`npm run test:showcase`. Browser checks run sequentially against a production build
on localhost:8080 and Chromium CDP on localhost:9222. Reference generators are
under `scripts/reference/`; none is a game backend.

The [higher-fidelity physics update](higher-fidelity-physics.md) adds actual Orekit
eclipse/1PN references and expanded atmosphere, transfer and fleet scenarios.


## Local usability and performance completion

Searchable navigation, seeded challenges, a local logbook/comparison, configurable
gamepad input, optional wake lock/haptics and an OPFS replay archive with an
IndexedDB fallback are implemented. Dedicated browser checks use synthetic comfort
and controller APIs; physical hardware remains an external test requirement.
The [remaining-work register](remaining-work.md) tracks those boundaries.

[Exact-result optimization](optimization.md) preserves the full flight model,
rendering quality and warp behavior. A bounded JS/Wasm benchmark and worker orbit
plot are available in the sandbox; neither is described as a complete engine or
renderer migration.
