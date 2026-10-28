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

## Backlog
- P0 M2: Orbital map, maneuver nodes + guided burns, attitude hold modes, attitude dynamics (wheels/RCS), checkpoints, Earth Observer.
- P1 M3 Moon; M4 power/comms/thermal/events/full catalog; M5 Mars.
- P2 M6 game layer (custom difficulty, custom missions, tutorials, comparison, best scores, cinematic/cockpit cameras, dynamic quality). Phase 2/3 per plan.
