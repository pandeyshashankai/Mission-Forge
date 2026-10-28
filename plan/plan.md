# MissionForge 2026 — Space Mission Design & Flight Simulator

A single-player browser game where players plan a space mission, assemble a rocket in 3D, verify it against real engineering limits, then launch and fly it to Earth orbit, the Moon or Mars — crewed or uncrewed — and see exactly why it succeeded or failed.
Built from the MissionForge 2026 blueprint (the authoritative requirements, with every listed feature kept across Phases 1–3) and aligned with the NASA Space Apps "Space Mission Design Game" challenge: design and operate a mission while balancing budget, power, mass and communication limits.

## Who it's for
- Students and space enthusiasts with no prior knowledge (guided Amateur mode, interactive tutorials).
- Engineering learners who want to see mass, thrust, delta-v and orbit numbers behind every outcome.
- Advanced players who want tighter margins, subsystem failures and full engineering data (Expert mode).
- NASA Space Apps judges/reviewers evaluating a mission-design game.

## Core features and experience
**Main Menu & Save Manager**
- New mission, continue, load, import/export design, settings, difficulty picker.
- All saves stay in the player's browser; autosave plus manual save slots; designs export/import as files.

**Mission Planner & Custom Mission Creator**
- Templates: First Orbit, Earth Observer, Lunar Orbiter, Crewed Lunar Flyby & Return, Mars Orbiter (uncrewed).
- Each shows destination, target orbit, objectives, budget, crew/uncrewed, launch site, duration and constraints.
- Custom Mission Creator: choose destination (Earth orbit, Moon, Mars), target orbit (altitude, inclination), crewed or uncrewed and crew size, objectives, budget, mass limit, time limit, launch date range. Custom missions are scored with the same rules and can be saved and shared as files.
- Templates are "inspired by" real NASA programs with approximate public figures labeled as approximations — no claim of NASA endorsement.

**3D Assembly Hangar**
- Parts: capsules with set crew capacity, probe cores, fuel tanks of several sizes, decouplers, fairings, solar panels, batteries, antennas, heat shield, parachutes, science instrument, reaction wheels, RCS thrusters and propellant, docking ports, radiators, life-support modules (oxygen, water, food, CO2 scrubbing).
- Six propulsion types with real trade-offs: kerosene/oxygen, hydrogen/oxygen (efficient upper stage), methane/oxygen, storable hypergolic (restartable, long-life), solid boosters (high thrust, no throttle/shutdown), electric/ion (very efficient, very low thrust, needs large solar power).
- Parts are clean 3D shapes with clear joints, panel lines and realistic colors (white/orange tanks, dark engine bells, gold foil, gray metal) so the rocket reads as real hardware.
- Snap-to-attach, symmetry (x2/x3/x4), reorderable stage list, part inspector, undo/redo, orbit/zoom camera; live mass, cost and stage count.

**Engineering Verification Mode — Mission Readiness Review**
- A dedicated review screen before launch (and available any time in the Hangar), one row per subsystem, each with a status and its numbers:
  - Propulsion capability — e.g. "Delta-v reserve below target: 5,410 m/s available vs. 5,600 m/s required + 5% reserve".
  - Electrical power — generation vs. demand across sunlight and eclipse, battery depth.
  - Communication link — link margin at the farthest planned distance.
  - Attitude control — control torque vs. what's needed to point the craft in time.
  - Thermal — heat produced vs. radiator capacity.
  - Structure — attachment and loads at max acceleration.
  - Crew safety — seats vs. crew, life support vs. mission duration plus reserve, return delta-v, heat shield, parachutes, abort capability.
- Every status is derived from the game's calculations, never from arbitrary percentages. Tapping a row shows the full traceable calculation: inputs, formula, units, assumptions and source of each value.
- Pass / warning / fail with a single overall "Go / No-Go".

**Engineering Advisor (offline, rules-based — no AI service)**
- Reads the actual calculated values, names the broken limits and by how much, and lists concrete fixes. Example:
  - "Your spacecraft does not have enough propulsion capability to complete the selected mission."
  - Detected problems: available delta-v 3,950 m/s vs. 5,600 m/s needed; payload 4.2 t above what the stages can push; liftoff thrust-to-weight 1.05 (minimum 1.2).
  - Suggested improvements: reduce unnecessary payload mass; select a more efficient upper-stage engine; recalculate after changing fuel capacity.
- Never invents figures; every statement links to the calculation it came from.
- Active in the Hangar, Readiness Review, flight (low power, supplies running short) and Results.

**Launch & Flight**
- Launch checklist, countdown with hold/scrub.
- Real-time flight with throttle, staging and steering; Flight HUD with altitude, speeds, acceleration, throttle, stage, fuel, apoapsis, periapsis, attitude.
- Physics: gravity, atmosphere and drag, fuel burn reducing mass, staging; outcomes come from the simulation, never scripted.
- Attitude dynamics: rotation follows torque and mass distribution; reaction wheels, RCS and engine gimbal provide control; wheels saturate and RCS propellant runs out.
- Solar power depends on panel orientation, distance from the Sun and eclipses; batteries charge and drain.
- Communications: signal delay grows with distance (about 1.3 s at the Moon, roughly 3–22 minutes at Mars); commands to uncrewed craft arrive late; link drops when blocked by a planet or out of range.
- Crew life support: oxygen, water and food consumed per crew member per day; running out ends the mission.

**Flight Guidance Computer**
- Configurable ascent profile: target orbit altitude and inclination, gravity-turn start speed and angle, throttle limits (e.g. max acceleration or max dynamic pressure), automatic staging on/off.
- Attitude hold modes: prograde, retrograde, normal, anti-normal, radial in/out, Sun-pointing (for solar panels), target-pointing (for antenna).
- Maneuver execution: automatically points and fires at a planned maneuver node, splitting the burn around the node and cutting off at the target change in velocity.
- The guidance computer flies with the same physics and the same spacecraft limits as the player; it cannot do anything the vehicle couldn't.

**Mission Events & Fault Management**
- Events come from the simulation state: solar eclipses (power drops), communication blackouts (planet in the way, too far, re-entry plasma), power emergencies (battery low), engine failures, stuck valves, reaction-wheel faults, supply shortfalls.
- Natural events (eclipses, blackouts, power shortages caused by the design) happen in every mode because they are physics.
- Random hardware failures are optional and off by default except in Expert; they use a seeded, repeatable random source so the same mission seed gives the same faults.
- Each event raises an alert with cause, affected systems and recommended responses (shut down engine, switch to backup, re-point panels, load-shed); all events go to an event log.

**Flight Cameras**
- Chase (follows behind the craft), cinematic (automatic dramatic angles at liftoff, staging, burns), cockpit/onboard view, free camera, and the orbital map. Switch with one key.

**Orbital Map & Transfers**
- Map view of Earth, Moon, Mars and the Sun with predicted path and orbit numbers.
- Maneuver nodes (prograde/retrograde/normal/radial), time warp, transfers to the Moon or Mars, capture into orbit, crewed return with re-entry and parachute splashdown.
- Motion switches by region: Earth-centered near Earth, Moon-centered near the Moon, Sun-centered between planets, Mars-centered near Mars, with consistent coordinate conversions at each boundary.
- Planets and the Moon move along their orbits over the calendar (from published orbital elements), so launch windows, months-long transfers and arrival burns come out of the simulation; a launch-window chart shows departure dates and their delta-v cost.
- Trajectories are predicted by stepping the motion forward, staying accurate through long coasts and time warp.
- A "Model limits" panel states plainly what is simplified (one main gravity source at a time, no gravity from other bodies within a region, simplified planetary orbits) and how that affects accuracy.

**Flight Checkpoints**
- Automatic checkpoints at key moments (orbit reached, before each burn, before entering a new region, every few in-game days on long coasts) plus manual checkpoints anytime.
- Resume any long mission, including a months-long Mars transfer, exactly where it left off; checkpoints are stored on the device with the mission.

**Mission Results**
- Objectives met/missed, transparent score breakdown (objectives, cost efficiency, fuel margin, crew safety, time).
- Plain-language cause chain for failures (e.g. "Stage 2 ran out of fuel → apoapsis too low → reentered").
- Flight charts (altitude, speed, fuel, power, supplies), event log, export results as a file.
- Engineering recommendations based on what actually happened (e.g. "fuel margin at capture was 2%; add ~400 m/s or move to a hydrogen upper stage").
- Design comparison against previous attempts on the same mission: mass, cost, delta-v, margins, score and what changed.
- Local best-score list per mission and difficulty.

**Difficulty — physics never changes**
- Gravity, propulsion, atmosphere, power, comms and life-support calculations are identical in every mode. Difficulty only changes assistance, budgets, failures and scoring.
- Amateur: larger budgets and margins, good starting presets, guidance computer and advisor fully available, detailed explanations, forgiving scoring.
- Intermediate: standard budgets, fewer hints, guidance computer available.
- Expert: tight budgets and resource limits, optional random subsystem failures on, minimal hints, full engineering data, strict scoring.
- Custom Difficulty: individually set guidance/autopilot availability, hint level, budget size, random failures (off/low/high), comms-delay command assistance (queued command sequences), scoring strictness, and detail shown. Optional realism toggles are limited to things that don't change core physics (e.g. disabling random failures). Scores note which settings were used.

**Interactive Tutorials**
- Guided missions that teach one concept each, using the real simulator: building a stable rocket, staging and delta-v, thrust-to-weight, gravity turn to orbit, orbits (apoapsis/periapsis), maneuver nodes, Moon transfer, power and eclipses, comms delay, life support and safe return.
- Step-by-step prompts, highlighted controls, checks that the player actually did the step.

**Graphics & Performance**
- Dynamic quality that adjusts detail to keep the frame rate smooth (target 30 FPS on a typical laptop with integrated graphics).
- Simpler models at distance, compressed textures, and assets loaded as needed rather than all up front, so the game starts quickly.
- Graphics presets (Low, Medium, High, Ultra) in Settings.

## User flow
1. Open the game → choose difficulty (or Custom) → start a tutorial, template mission or custom mission.
2. Review objectives, budget and constraints in the Mission Planner (or build one in the Custom Mission Creator).
3. Build the rocket in the Hangar; arrange stages.
4. Open the Mission Readiness Review; fix any warnings/failures with the advisor's help until "Go".
5. Launch pad → checklist → countdown → liftoff; fly manually or set an ascent profile on the guidance computer.
6. Reach orbit; switch cameras; checkpoints are saved automatically.
7. For Moon/Mars: plan burns on the Orbital Map using the launch-window chart, warp, let the guidance computer execute burns, capture; respond to events (eclipses, blackouts, faults). Crewed missions plan the return and re-entry.
8. Leave and resume long missions from checkpoints.
9. Mission Results: score, cause chain, recommendations, comparison with earlier designs; save, retry or adjust the design.

## UI/UX feel
- Realistic aerospace / mission-control look: dark control-room interface, crisp data panels, monospaced telemetry numbers, warning colors used sparingly (amber warnings, red failures, green go).
- Cinematic but readable 3D: lit hangar, launch pad, glowing Earth with atmosphere, Moon and Mars.
- Progressive disclosure: beginners see essentials first; full calculations expand on demand.
- Desktop-first, keyboard shortcuts for flight (throttle, stage, steer, warp, camera).

## Implementation phases
Phase 1 is built now, in small milestones. Each milestone must work end-to-end and pass its physics checks before the next starts, so the game is never visually complete with broken physics underneath. A requirements status table (implemented / tested / partial / pending for every feature) is kept and reported after each milestone.

**Phase 1 — MVP (built now)**
- **Milestone 1 — First Orbit vertical slice:** main menu, local saves, part catalog (core parts), 3D Hangar, Readiness Review for propulsion/mass/cost/thrust-to-weight with traceable calculations, launch, flight HUD, staging, guidance computer ascent profile, Earth orbit, chase and free cameras, mission report. Automated physics checks against known reference answers (rocket equation, orbital speed, orbit shape, energy conservation, consistent results run to run).
- **Milestone 2 — Orbital operations:** Orbital Map, maneuver nodes, guidance maneuver execution and attitude hold, time warp, attitude dynamics with reaction wheels/RCS, flight checkpoints, Earth Observer mission.
- **Milestone 3 — Moon:** Earth/Moon region switching with moving Moon, Lunar Orbiter and Crewed Lunar Flyby & Return, re-entry and splashdown, life support, crew safety checks. Physics checks for region hand-offs.
- **Milestone 4 — Spacecraft systems & events:** solar power and eclipses, communications and delay, thermal/radiators, full part catalog and six propulsion types, mission events and fault management, Engineering Advisor across all screens.
- **Milestone 5 — Mars:** Sun-centered travel, moving planets, launch-window chart, Mars Orbiter mission, model-limits panel. Physics checks for transfer timing and delta-v against published reference values.
- **Milestone 6 — Game layer:** all three difficulties plus Custom Difficulty, Custom Mission Creator, interactive tutorials, Mission Results with recommendations and design comparison, local best scores, cinematic and cockpit cameras, dynamic graphics quality and presets, on-demand asset loading.

**Phase 2 — Deeper missions**
- Moon landing and Mars landing, Asteroid Scout mission.
- Mission Control screen with subsystem plots over time, event timeline, alarms.
- Science Operations: instrument targets, data storage and downlink, science score.
- Career Campaign with unlocks and achievements; full Tutorial Academy.
- Mission replay: review the flight path in 3D and step through the events leading to a failure.
- PDF mission reports.

**Phase 3 — Depth & polish**
- Design Lab with repeatable benchmark runs across many designs.
- Docking/rendezvous missions using the docking ports.
- Many-run reliability analysis (repeat a mission with random failures and show success rates).
- Sandbox mode with all parts unlocked, Challenges mode.
- Full accessibility (remappable keys, text size, contrast, captions, glossary), full offline play.

## Assumptions
- Built with React, TypeScript and Three.js with a modular simulation engine that runs separately from the graphics; physics uses SI units, fixed time steps, repeatable results where possible and documented accuracy tolerances.
- No scripted outcomes, made-up engineering values, placeholder buttons or half-finished features presented as finished; anything not done is marked pending in the status table.
- Runs fully in the browser; no accounts, online leaderboards, payments or AI service.
- Saves and checkpoints exist only in that browser; clearing browser data deletes them unless exported.
- Physics model: one main gravity source per region with hand-offs at region boundaries, planets from published orbital elements, layered atmosphere; limitations shown in-game.
- Random hardware failures are off by default outside Expert and Custom.
- Docking ports are buildable in Phase 1; docking missions come in Phase 3.
- Planet and part figures are approximate public values, labeled as such; NASA-themed missions are inspired-by, not official.
- English interface; desktop browsers only, no phone support for flight.
