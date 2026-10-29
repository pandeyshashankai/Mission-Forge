# MissionForge 2026 — PRD

## Original problem statement
Build MissionForge 2026 from the uploaded "MissionForge_2026_Complete_Development_Blueprint.pdf" (approved plan): single-player browser space-mission design & flight simulator (NASA Space Apps "Space Mission Design Game"). Plan missions, assemble rockets in 3D, verify against real engineering limits (Readiness Review with traceable calculations + offline rules-based Engineering Advisor), launch and fly to Earth orbit / Moon / Mars, see why it succeeded or failed. Phase 1 built in milestones M1–M6; each milestone must work end-to-end with physics checks before the next.

## Architecture
- Frontend only (React 19 + Three.js 0.170, JS). Backend template untouched/unused. All saves in localStorage.
- `src/sim/` — pure simulation engine (no rendering): constants, US-1976 atmosphere, parts catalog, design/staging/runtime + Δv phase analysis, orbit elements, guidance computer, FlightSim (ECI, RK4, fixed steps 0.02 s powered/atmosphere, 0.1 s vacuum coast), readiness, advisor, scoring, storage, status table.
- `src/sim/__tests__/physics.test.js` — automated physics checks (`CI=true yarn test --watchAll=false src/sim`).
- `src/three/` — part mesh builder, HangarView, FlightView (floating origin, log depth buffer, Earth + ground cap + pad, atmosphere shell, plume, debris, orbit line).
- `src/pages/` — MainMenu, MissionPlanner, Hangar, Readiness, Flight, Results. `src/game/` — GameContext (screen, design history undo/redo, autosave), designOps.

## Implemented (2026-06, Milestone 1 — First Orbit vertical slice)
- Main menu, difficulty picker (Amateur/Intermediate/Expert budgets), settings (graphics Low/Medium/High), load/import designs, Build Status table.
- Mission Planner (First Orbit available; other templates locked with milestone).
- 3D Hangar: catalog (17 parts), attach above/below, radial boosters ×2/×3/×4, stack & staging lists (reorder jettison events), inspector, undo/redo, presets, save/export/import, live stats + advisor.
- Readiness Review: propulsion Δv, liftoff TWR, upper-stage TWR, propellant feed, mass, cost, control — traceable calcs; pending subsystems listed; GO/NO-GO; "test-fly anyway".
- Flight: checklist, guidance profile, countdown hold/scrub, HUD, staging (manual/auto), manual steering, time warp (limited to ×10 powered/in atmosphere), chase/free cameras.
- Results: objectives, score breakdown, cause chain, recommendations, charts, event log, previous attempts, export.
- Physics checks passing: atmosphere densities, rocket equation, circular speed/period, orbit shape, energy conservation, required Δv band, both presets reach 200 km orbit (±25 km, i ±2°), determinism, underpowered vehicle stays on pad.

## Implemented (2026-06, Milestone 2 — Orbital operations)
- Attitude dynamics (sim/attitude.js): cylinder inertia, engine gimbal, reaction wheels with momentum saturation, RCS (hydrazine, Isp 220 s) with wheel unloading, gravity-gradient + aero disturbance torques. Hold modes: auto/hold/prograde/retrograde/normal/anti-normal/radial±/Sun/free. New parts RW-4, RCS ring, monoprop tank; presets carry RCS.
- Readiness: Attitude control check (torque & momentum for 90°/60 s slew) + advisor rule.
- Orbital Map camera: stepped-RK4 predicted path, Ap/Pe/Node markers, dashed post-node path. Maneuver planner (node at Ap/Pe/now, raise-Ap & circularize suggestions, prograde/normal/radial Δv) and guidance execution (burn split around node, cut-off on delivered Δv, warp auto-capped).
- Checkpoints: auto (orbit, before burn, 24 h coast) + manual; resume from main menu; exact continuation (tested).
- Earth Observer mission (Vandenberg, 700 km SSO 98.2°, parking orbit + Hohmann), in-plane ascent steering.
- Cinematic camera: cuts at liftoff (pad cam), stage separation & fairing jettison (inertial drift cams), burns (orbiting cam).
- Jest: 16 checks pass (adds torque-free rotation, wheel saturation/unloading, prediction closure, checkpoint determinism, Hohmann 200→700 km, EO ascent).

## Milestone 2 verification + fixes (2026-06)
- J2 oblateness in all Earth gravity; moving Sun (β angle, node-drift readouts); EO Sun-synchronous objective from simulated J2
- Checkpoints serialize full state at request time; restore loads checkpoint design; telemetry decimation keeps saves small
- Burn-time estimate steps through stages (and 4 g crew cap); partial-step pulses for tiny burns; burns wait for alignment
- Report: /app/memory/VERIFICATION_M2_M3.md

## Implemented (2026-06, Milestone 3 — Moon)
- sim/bodies.js (Moon ephemeris, SOI 66,100 km, patched conics, adaptive steps), sim/transfer.js (TLI scan, B-plane MCC, free return, LOI, return corridor)
- sim/entry.js (capsule drag+lift L/D 0.3, auto bank, Sutton-Graves heating, shield limits, crew g limits, reefed chutes, splashdown), sim/crew.js (BVAD life support), sim/crewReadiness.js
- New parts: Lunar Orbiter Bus, storable tanks 1.8/3.7 m, S-27 storable engine, heat shield, parachute system, consumables pallet. Presets Selene-1, Odyssey Free-Return
- Missions Lunar Orbiter & Crewed Lunar Flyby available; mission-specific scoring with crew safety
- UI: Moon in 3D + map frame switching, lunar planner buttons, CrewPanel, region/Moon-alt/β/J2 rows, warps ×5000/×20000, splashdown overlay
- Fixtures: public/ck_lunar.json, public/ck_test.json (generator: /app/memory/gen_checkpoints.test.js.bak)

## Backlog
- P0 M4 next (power/eclipses, comms delay, thermal, full 6-propulsion catalog, events & faults), then M5 Mars, M6 game layer. M2 leftover: target-pointing mode (needs comms, M4).
- P1 M3 Moon; M4 power/comms/thermal/events/full catalog; M5 Mars.
- P2 M6 game layer (custom difficulty, custom missions, tutorials, comparison, best scores, cinematic/cockpit cameras, dynamic quality). Phase 2/3 per plan.
