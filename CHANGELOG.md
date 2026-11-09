# Changelog

## 2026-11-07 — clear mobile flight views

- Reserve a real camera window above/beside the primary touch controls, keeping spacecraft centred in the unobstructed area.
- Move secondary mobile instruments into accessible scrollable drawers; retain compact flight readings and all primary inputs.
- Add camera/control-intersection, small-screen, orientation and notch regression coverage.

## 2026-11-06 — Cloudflare build fix

- Fix lint warnings that Cloudflare treats as build errors under `CI=true`.
- Make release CI enforce strict production builds, preserving input behavior.

## 2026-11-06 — learning and advanced simulation

- Connect five Academy lessons, NASA Data Explorer, interactive debriefs and optional first-flight guidance.
- Add paired scientific trajectory comparisons with worker cancellation, bounded horizons and zero-difference control.
- Transfer compatible uncrewed single-stage Hangar craft into Exploration with rendered geometry, propulsion/mass/power preservation and save/fleet support.
- Add seven regression groups, including eleven worlds and three liquid-propellant families; standard suite now has 321 checks.
- Implement 342-constituent station ocean loading, BLQ import and two independent 24-hour reference series with explicit UT1/TT conventions.
- Add closed convex mesh fracture, exact uniform-density inertia, angular/friction contact impulses, persistent rendered debris and bounded hull import.
- Add complete campaign/fleet source execution inside a cancellable QuickJS Wasm worker, typed atmosphere bridge, state exports and paired backend verification; keep the faster established backend as default.
- Prepare Cloudflare Pages headers, release CI, screenshots, deployment instructions and a 30-group release audit.

## Earlier unreleased work — 2026-11-05

- Optimize harmonic workspaces/trigonometric evaluation, ocean-tide row grouping and exact-fixed-point Kepler convergence without changing physics steps, warp, graphics or controls.
- Add frozen-source/state equivalence checks and three-pair isolated CPU benchmarks with matching simulation times and SHA-256 state hashes; standard suite now contains 302 checks.
- Add command search, repeatable local challenges, logbook comparison, configurable gamepad input, optional wake lock/haptics and a bounded OPFS replay archive with IndexedDB fallback.
- Add a bounded JavaScript/Wasm gravity benchmark and worker-rendered orbit plot with a canvas fallback; retain the established flight engine.

- Expanded generated coverage with 554,997 scenario checks, including every 13-switch mask across all playable world/craft combinations and both integrators.
- Added a ten-profile world/craft browser matrix, tutorial/cancel paths and an extended release command with specialist browser flows.
- Fixed collapsed Explorer panels on short phones, off-screen tutorial hints and malformed tutorial-progress startup failures.
- Corrected stale Explorer help and adapted the older checkpoint flow to current storage/countdown behavior.


- Added IndexedDB migration, queued commits, recent snapshots, paused flight recovery and visible storage failures.
- Added versioned SHA-256 backup preview/merge and a local storage manager.
- Added an evidence dashboard, two-action First Orbit entry and artifact build identity.
- Verify offline assets before activating versioned caches; persist readiness status across reloads.
- Added seven persistence/import checks; standard regression suite now contains 289 tests.


- Audited all built-in axial single/pair/triple engineering groups, staging permutations, catalogue geometry and bounded model-option combinations.
- Reject duplicate IDs across stack/booster groups, empty IDs and radial-only axial imports.
- Preserve validated thermal observations when creating fleet companions; reject calibrated constructors without observations.
- Keep collision and rigid-contact switches consistent.
- End fully jettisoned vehicles cleanly and avoid zero-mass navigation NaNs.
- Added six regression tests; standard suite now contains 282 tests, plus 66,916 generated audit cases.


- Added a public-data arc-jet comparison bench with six source-tagged exposures, hot/cold-wall selection and assumed coupon thickness.
- Added three common-scale material temperature plots, cooling segments and CSV/JSON prediction exports.
- Added bounded scenario and convergence checks; regression suite now contains 276 tests.


- Added screenshot-derived PICA/AVCOAT material records with preserved measurement/unknown flags and phase separation.
- Added three constant-property thermal presets with implicit surface/backing conduction and AVCOAT-specific effective ablation energy.
- Archived the supplied NTRS abstracts with provenance; retained explicit missing experimental-data limits.
- Added five regression tests; total now 272.


- Added rotational rigid-body box contacts with spin, friction and finite-inertia response.
- Added a source-backed NASA CEA aluminium heat-capacity curve and experimental thermal inverse fitting with held-out checks.
- Added degree-eight FES2004 ocean-tide gravity and three actual Orekit coefficient comparisons; full ocean loading remains unfinished.
- Kept explicit data-access and physical-calibration limitations in the model documentation.


- Added opt-in thermal/structural failure, ablation mass loss, fragment generation and swept vessel/debris collisions.
- Added opposed-port geometry checks and attached port offsets.
- Added a bounded January 2000 JPL DE421 state pack with held-out kernel interpolation checks.
- Added experimental degree-three/lagged elastic Earth tides; ocean loading remains unimplemented.
- Added nine vehicle-dynamics checks; full regression suite now contains 258 tests.

## Previous expansion — 2026-11-04

### Higher-fidelity physics and broader validation

- Replaced binary point-Sun shadows with finite-disk penumbra/umbra/annular lighting for solar pressure and power; limited eclipse-contact steps and improved battery quadrature.
- Added optional Schwarzschild 1PN central gravity, persisted model settings and physics-revision checks for generic recordings.
- Added 27 actual Orekit eclipse cases, five relativistic force vectors and two three-period relativistic trajectories; 48 external-reference checks now pass.
- Improved atmospheric-preview sampling and explicit work budgets; added Earth/Mars sampling convergence, 48 propagated Lambert arrivals, six-vessel and repeated docking/fuel scenarios.
- Expanded the regression suite to 249 tests and updated science UI, downloads and offline assets.

### Client-only flight laboratory

- Added local fleets, propellant-consuming rendezvous, point-capture docking, undocking recoil and conservative fuel transfer.
- Added bounded adaptive integration, degree-8 EGM96, third-body and radiation forces, static elastic tides, NRLMSISE-00, battery and illustrative ground-link constraints.
- Added actual Orekit, native C atmosphere and published ERFA reference comparisons, retaining original model licenses and provenance.
- Added Lambert grids, worker-based coast/entry previews, telemetry exports, restricted three-body and standards-frame workbenches.
- Added ordered flight programs, verified single-vessel control recordings, local data-only content, atmosphere summaries and offline installation.
- Reorganized flight instruments into four tabs and improved phone notifications, touch targets and fleet controls.
- Expanded regression coverage to 237 checks; documented approximations and unsupported precision effects.

### NASA atmosphere, rotation and engineering expansion

- Added 178 Earth/Mars NASA GMAT density bands and 12 signed NAIF linear rotation periods with verified source files and SI conversions.
- Connected imported density to exploration drag and scored Earth upper-atmosphere blending; retained explicit thermodynamic and range limitations.
- Added interactive density/drag, rocket-equation and Hohmann-transfer workbench with six independent engineering benchmarks.
- Added finite-burn exploration transfers with fuel accounting, coast-window hold, confirmed circularization, achieved-orbit reporting, cancellation, and restore disarming.
- Added 77 regression checks, including 66 complete transfers across all exploration craft and destinations, plus a native browser engineering workflow.
- Updated provenance downloads and simulator documentation.

### NASA data and Mission Lab

- Pinned NASA/GMAT source snapshots with SHA-256 verification, a reproducible importer, SI conversions, 12 spherical radii, and 10 gravitational parameters used in the simulation.
- Destination science panels with source-field provenance, Earth/world comparisons, and downloadable data.
- Independent 60-digit benchmarks and live Earth/Moon/Mars numerical and full-orbit integration checks.
- Predict–fly–explain First Orbit showcase, recorded-flight explanations, saved reflections, learning journal, and exports.
- Fixed lunar-return targeting that could choose an orbit with a low perigee but an impractically long return time.
- Added 22 source/science/learning regression checks and a complete browser showcase check.

### Device controls

- Shared, remappable flight keys with WASD and arrow-key presets, conflict-safe swaps, and saved preferences.
- Multi-touch arrow steering, held throttle controls, full/cut commands, stage, RCS, and guidance buttons.
- Automatic or forced touch controls, mirrored thumb layouts, larger buttons, and steering sensitivity.
- Portrait/landscape and notch-safe layouts, dynamic viewport sizing, and safe pointer cancellation on blur/resize/dialogs.
- Consistent keyboard control across scored flight and exploration; Escape opens Settings.
- Ideal attitude hold for exploration RCS, with backwards-compatible expedition saves.
- Builder pinch gestures no longer select parts accidentally; paused keyboard map/camera controls remain usable.
- Fixed overlapping preflight cards on short phones and kept failure/report actions above the touch HUD.
- Expanded control-state and device-input regression checks.

## Previous unreleased work — 2026-11-03

### Interface refresh

- Two clear home-screen paths, colourful mission cards, and a visible four-step mission workflow.
- Orbital, Nebula, and Daylight themes; larger text; reduced motion; keyboard focus indicators; named icon controls; and palette contrast checks.
- Attention-first preflight checks, plain-language orbital labels, grouped flight controls, and an optional detailed instrument view.
- Responsive builder panels, automatic part inspection, and an explicit finish-flight confirmation.
- Corrected the recommended lunar rocket's pad allowance, pure undo/redo history, saved-list shape handling, and exploration autosave/rendering behaviour.
- Expanded validation to all rocket presets, 33 exploration craft/destination pairs, all mission difficulties, theme persistence, and pointer-based interface flows.

### Added

- Solar-system exploration with eight planets, the Moon, Europa, and Titan; three spacecraft; orbital and spacecraft views; destination selection; and a system map.
- Finite-fuel sandbox burns, body-relative attitude controls, coast warp, sphere-of-influence transitions, simplified drag, impacts, and gentle touchdown.
- Expedition saves, import/export, a flight guide, and an explicit new-orbit placement tool.
- Blueprint assembly workspace, category filters, part duplication, and the Aster-M methane-booster preset.
- Flight pause/resume and a mouse-accessible throttle slider.
- Repeatable physics, exploration, mission-sequence, and browser checks.

### Fixed

- Vacuum automatic staging and active ascent guidance no longer stall in a gravity-only coast step.
- Arming a maneuver disengages ascent guidance, preventing an old ascent command from restarting engines after a transfer burn.
- Lunar attitude modes use Moon-relative position and velocity.
- Fine insertion corrections respect minimum-throttle engines through partial-step pulses.
- Impossible burn estimates and exhausted burns no longer claim successful completion.
- Selene-1 carries additional storable reserve for insertion and course correction.
- Input state clears on window blur; hidden scored flights and expeditions pause.
- Removing the final stack part no longer leaves an empty invalid design.
- Hangar and flight environment resources are released when leaving their views.

## 1.0.0 — 2026-10-29

The first packaged release of Mission-Forge, focused on Earth-orbit and lunar gameplay.

### Included

- Four missions: First Orbit, Earth Observer, Lunar Orbiter, and Crewed Lunar Flyby & Return.
- A 3D Hangar with rocket assembly, staging, presets, part inspection, and undo/redo.
- Pre-flight readiness checks and an engineering advisor.
- Assisted ascent, automatic staging, manual controls, orbital maps, maneuver planning, and time warp.
- Earth/Moon flight physics, spacecraft systems, crew supplies, re-entry, and recovery.
- Mission scoring, charts, recommendations, local design saves, import/export, and flight checkpoints.

### Refined

- Mission-selected guidance targets and optional advanced ascent tuning.
- A compact flight interface with detailed systems behind the Engineering toggle.
- Suggested maneuvers with optional manual burn adjustments.
- No random equipment faults in Amateur or Intermediate; Expert retains seeded faults.
- Compatibility checks for supported saved missions and imported rocket designs.
- A standalone browser build without a backend or database.

### Repository

- Project metadata and authorship for Mission-Forge by Shashank Pandey.
- A complete README with screenshots, setup, controls, hosting instructions, and model scope.
- Source, assets, dependency lockfile, and required build configuration.

### Validation

Before packaging, all 35 simulation and compatibility checks passed. A fresh dependency installation and production build passed, and the browser flow from menu to mission report completed without JavaScript errors. Test files and development reports are not included in this release.

### Exploration visuals and navigation

- Three distinct procedural exploration spacecraft, with segmented solar arrays,
  antennas, transfer-stage tanks, braced landing gear and throttle-scaled exhaust.
- Readable night-side craft lighting, smoother follow camera, short screen/view
  transitions and reduced-motion support.
- NASA-derived linear rotation periods now animate exploration planet textures.
- Labelled orbital apsides, with circular-orbit suppression and a scale legend.
- Save view exports a PNG for presentation imagery.
- Four geometry/resource checks and a browser flow for craft switching, export,
  reduced motion and phone controls; no new runtime dependencies.

### Engineering and reproducibility roadmap

- Unified stage and live exploration engineering inspectors, explicit force-model
  badges, classical orbital elements and an exploration attitude sphere.
- Numerical maneuver-time editing, finite-burn execution progress, lunar SOI
  sphere/transition markers and reusable saved stages with fresh part IDs.
- Value-level NASA provenance and all seven original snapshots bundled for local
  download with checksum/license preservation.
- Guided showcase entry with actual First Orbit command replay verification and
  downloadable commands/checkpoints.
- Long-coast invariant, seeded-state, J2 precession, replay, subassembly and source
  integrity checks; explicit campaign trajectory-envelope fixtures.
- Exploration developer diagnostics available through `?debug=1`.
- See docs/competitive-roadmap.md for implemented scope and remaining milestones.
