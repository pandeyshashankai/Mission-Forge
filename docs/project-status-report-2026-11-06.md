# MissionForge complete project status report

Later on 6 November, the [connected learning update](connected-learning.md) implemented
the six review recommendations, including a restricted builder adapter. The report
below preserves the earlier tested-build assessment and its historical counts.

Prepared 6 November 2026. Latest completed validation: 5 November 2026, 15:35 UTC.
This report describes the current local project and recorded validation. No fresh
full test run or deployment was performed to prepare this report.

The latest tested build is `5f65f63c45d8d6fe8b566111fae783d52590838b7136612168005f6ecff3ab5a`.
Its build identity matches the passing release-audit manifest. The source tree
contains uncommitted work; this is not a claim that the public hosted version has
been updated to this build.

## 1. Product and architecture

MissionForge is a browser-based 3D spaceflight game with a scored Earth/Moon
campaign, an open solar-system exploration sandbox, rocket construction,
engineering laboratories and a prediction–flight–reflection learning workflow.
It uses React 19, Three.js/WebGL, local scientific datasets, JavaScript simulation,
local workers, IndexedDB and optional offline service-worker caching. Some bounded
scientific components use locally bundled WebAssembly.

No account, multiplayer, hosted simulation, remote database or paid API is required.
Initial delivery uses a static website. Prepared offline play caches the game,
model libraries, science references and presentation documents on that device.

## 2. Campaign and mission progression

| Mission | Goal and learning focus |
| --- | --- |
| First Orbit | Approximately 200 km circular Earth orbit; launch, staging and sideways orbital speed. |
| Earth Observer | Approximately 700 km sun-synchronous observation orbit; inclination and transfer planning. |
| Lunar Orbiter | Trans-lunar injection, lunar arrival and capture. |
| Crewed Lunar Flyby & Return | Three crew, consumables, lunar flyby, Earth return, entry and recovery. |

Amateur, Intermediate and Expert change budgets and fault conditions. Flight
physics stays consistent. Expert includes seeded hardware faults after orbit.
All twelve mission/difficulty cases met their expected test envelopes. The stock
Expert Lunar Orbiter deliberately exceeds its budget and has an expected
budget-only partial result; it is not recorded as full objective success.

The game supports readiness checks, assisted/manual ascent, automatic staging,
countdown, maneuver planning/execution, time warp, paused checkpoints, objectives,
mission scores, event history and flight-report charts. Crewed campaign systems
include supplies, power, acceleration and entry/recovery consequences.

## 3. Rocket construction and catalogue

The Hangar offers 3D and selectable blueprint views, category filtering, part
inspection, duplication/removal, undo/redo, staged events, 2×/3×/4× booster symmetry,
reusable stages, design saving and JSON import/export. Narrow screens provide
Parts/Rocket/Details panels.

Engineering views expose wet/dry mass, centre of mass, thrust axis, approximate
side-area centre, propellant compatibility, stage delta-v, Isp, burn time, thrust,
TWR, budget, power and mission readiness. Incorrect designs receive actionable
checks and explicit test-flight confirmation.

There are **36 built-in parts across nine categories**:

| Category | Built-in parts |
| --- | --- |
| Command & Probe | PC-1 Probe Core; Solo Capsule (1 crew); Tri Capsule (3 crew) |
| Payloads | Smallsat Bus 500 kg; Observation Bus 2.5 t; Lunar Orbiter Bus 1.2 t |
| Fuel Tanks | Kerolox Tank 3.7 m — Short; Kerolox Tank 3.7 m — Medium; Kerolox Tank 3.7 m — Long; Kerolox Tank 1.8 m; Hydrolox Tank 3.7 m; Storable Propellant Tank 3.7 m; Storable Propellant Tank 1.8 m; Methalox Tank 3.7 m |
| Engines | K-9 Cluster (9× K-1); K-1 Kerolox Engine; K-1V Vacuum Kerolox; H-10 Hydrolox Upper Engine; H-1M Hydrolox Main Engine; S-27 Storable Engine; M-3 Methalox Cluster (3× M-2); M-2 Methalox Engine (full-flow) |
| Solid Boosters | SRB-63 Solid Booster |
| Attitude Control | RW-4 Reaction Wheel Assembly; RCS Thruster Ring (8× 445 N); Monopropellant Tank 3.7 m |
| Crew & Recovery | Ablative Heat Shield 3.7 m; Parachute System (2 drogues + 3 mains); Crew Consumables Pallet |
| Power & Thermal | Solar Array Wings 4 kW; Li-ion Battery 6 kWh; Radiator Panels 6 m² |
| Structure | Stage Decoupler 3.7 m; Stage Decoupler 1.8 m; Adapter 3.7 → 1.8 m; Payload Fairing 3.7 m |

The catalogue uses approximate public-class spacecraft figures, not certified
replicas. Preset designs are:

- Aster-M — methalox booster + kerolox vacuum stage
- Orbiter-9 — two-stage kerolox
- Orbiter-9 EO — with 2.5 t Observation Bus
- Hydro-Boost — kerolox + hydrolox + 2 SRBs
- Selene-1 — kerolox + hydrolox TLI stage + storable orbiter
- Odyssey — super-heavy, hydrolox TLI, capsule + service module
- Empty — probe core only

The empty preset is a probe-only construction starting point.

## 4. Solar-system sandbox and spacecraft

Starting destinations are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus,
Neptune, the Moon, Europa and Titan. The Sun governs the heliocentric region;
it is not offered as a planetary starting orbit. Gas giants have no landable
solid surface.

| Vehicle | Role | Dry mass | Initial fuel | Thrust | Isp |
| --- | --- | ---: | ---: | ---: | ---: |
| Pathfinder | Orbital survey craft | 1,800 kg | 3,200 kg | 42 kN | 345 s |
| Wayfarer | Deep-space transfer stage | 4,200 kg | 22,000 kg | 110 kN | 455 s |
| Pioneer | Airless-world lander | 2,400 kg | 5,800 kg | 85 kN | 360 s |

These are distinct fictional procedural models. Pathfinder has survey arrays,
Wayfarer transfer tanks/engine geometry, and Pioneer braced landing legs. Their
visual meshes do not establish real spacecraft specifications.

Players can burn, coast, change primary bodies across spheres of influence,
inspect orbital elements, select six prograde/retrograde/normal/radial directions,
view orbital/system maps, use close/fleet cameras and export expeditions. New-orbit
placement deliberately replaces/refills an expedition; it is labelled as sandbox
placement rather than a flown transfer. Restored expeditions start paused with
engines off. Exploration vehicles are single-stage presets; arbitrary Hangar
rockets are not generally converted into these expedition vehicles.

Coast settings span ×1 to ×1,000,000, subject to existing integration/contact/event
limits. Powered flight runs in real time. The interface reports achieved warp.
This is not an unlimited-throughput or universal million-times-speed guarantee.

Visual improvements include distinct craft, smoothed cameras, reduced-motion
handling, view transitions, rotating planetary textures, closed-orbit apsis labels,
scene PNG export and a night-side inspection light. Map icons/craft may be enlarged
for readability; terrain and a complete moon catalogue are not implemented.

## 5. Flight physics and planning

Core behavior includes position/velocity integration, central gravity, finite
thrust and propellant, atmospheric drag, surface impacts and gentle airless
landings. Campaign and exploration have separate explicitly described force models.
The campaign retains Earth J2 and its patched Moon framework. Exploration offers:

- Central gravity, optional Earth J2 or EGM96 degree/order 2, 4 or 8 harmonics.
- Differential third-body gravity with reference-origin acceleration.
- Solar radiation pressure with finite-Sun penumbra, umbra and annular eclipses.
- Earth/Mars archived density bands and an optional local NRLMSISE-00 Earth model
  using entered F10.7/Ap values, not live space weather.
- Instantaneous elastic Earth tides, optional degree-three response and a bounded
  0–600 s constant lag; this is not a full frequency-dependent IERS solution.
- Truncated FES2004 ocean-tide gravity, independent of solid-Earth tides.
- Optional spherical-source Schwarzschild first post-Newtonian gravity.
- RK4 or bounded error-controlled Dormand–Prince 5(4), with visible presets.

Planetary motion defaults to approximate fixed Kepler elements. An optional JPL
DE421 pack supplies hourly states for a bounded January 2000 interval with cubic
Hermite interpolation. Outer-planet entries use system barycentres. Twenty-seven
held-out interpolation samples were below 2 m against direct kernel evaluation;
that is interpolation agreement, not observational navigation accuracy. Unsupported
epochs are rejected and uncovered bodies retain labelled approximate paths.

Planning tools include finite-burn Hohmann-style orbit transfers, pilot-confirmed
circularization, delivered/remaining delta-v cards, an 84-cell Lambert transfer
window grid, coast closest-approach forecasts and atmospheric-pass previews.
Transfers consume fuel and preserve integrated motion. Manual takeover cancels
assistance; restores disarm it. Predictive clones report their horizons/truncation
and do not execute hypothetical setup burns on the live vehicle.

The science tools expose equations including:

- Circular speed: `v = sqrt(mu/r)`; escape speed: `sqrt(2 mu/r)`.
- Orbital period: `T = 2 pi sqrt(r^3/mu)`.
- Specific orbital energy: `v^2/2 - mu/r`.
- Rocket equation: `delta-v = Isp g0 ln(m0/mf)`.
- Propellant mass flow: `mdot = thrust/(Isp g0)`.
- Drag magnitude: `0.5 rho Cd A v_relative^2`.
- Dynamic pressure: `q = 0.5 rho v_relative^2`.
- Thermal balance: `C dT/dt + emissivity sigma A(T^4 - Tamb^4) = absorbed_flux A`.

Their assumptions and units matter: two-body formulas are reference calculations,
not exact predictions under atmosphere, thrust and every perturbation.

## 6. Heat, damage, breakup and contact

Exploration has opt-in thermal/structural failure, pressure and acceleration
overload, integrity loss, shield depletion and failure-generated debris. The
Earth-air entry-heating law is an educational proxy; other atmospheres do not
receive a fabricated calibrated Earth-equivalent heating law.

The TPSX screenshot-derived evidence retains material phase, SI units and original
source-quality labels. PICA virgin, AVCOAT virgin and AVCOAT char have distinct
constant-property thermal presets. PICA char remains reference-only because
conductivity and heat capacity were not supplied. A two-node shield/backing model
integrates conduction and radiation implicitly. Only AVCOAT virgin has the supplied
effective ablation energy needed for its material-specific energy-limited recession;
other presets do not borrow that parameter.

NASA CEA crystalline-aluminium heat capacity is supported only over its published
300–933.61 K range. Range excursions and assumed vehicle quantities remain visible.
An observation importer fits heat capacity/emissivity and checks held-out data;
synthetic solver recovery is not physical spacecraft calibration.

The arc-jet laboratory uses six published MEDLI2 target-condition exposures,
hot/cold-wall reference selection, assumed coupon thickness, three-material
predictions, cooling curves and CSV/JSON export. All eighteen case/material pairs
were checked. It predicts responses; it does not reconstruct unavailable measured
temperature/recession histories, flight-lot stackups, NuSil chemistry or pyrolysis.

Failure can produce eight equal-mass fragments with paired momentum-conserving
impulses. Swept sphere collisions and debris impacts are bounded approximations.
Optional rigid-body hull contacts add quaternion orientation, angular momentum,
box inertia, separating-axis detection, normal impulses, Coulomb friction,
penetration stabilization and off-centre impact spin. Hulls are assumed boxes;
this is not detailed mesh fracture or a general articulated constraint solver.

## 7. Fleets, docking and onboard systems

Up to six local persistent vessels coast numerically in synchronization. Finite-
thrust rendezvous assistance consumes fuel. Optional port geometry checks opposed
nose axes within 5 degrees, separation <=0.5 m, lateral error <=0.2 m and relative
speed <=0.1 m/s. Docking uses a paired attachment model; fuel transfer is capacity-
limited, captured mass affects propulsion and undocking applies host recoil.

Power includes solar generation, battery charge, loads and blackout inhibition.
Sunlight can recharge the battery. Communications provide an illustrative rotating
Earth station, visibility/range checks, light-time display and optional ignition
lock. This is not a full DSN network or delayed-command simulation.

## 8. UI, controls and accessibility

The workflow is Choose -> Build -> Check -> Fly. Primary actions are separated from
expandable engineering details. Orbital, Nebula and Daylight themes, larger text,
reduced motion, focus indicators, named controls and clearer telemetry are present.
Palette contrast was checked; this is not comprehensive accessibility certification.

A Ctrl/Cmd+K command palette searches navigation. Dialogs isolate flight input.
Mobile layouts handle portrait/landscape, notch insets, extra instruments and
builder panels.

Keyboard defaults use WASD steering; Shift/Ctrl throttle; E/Q full/cut; Space stage;
R RCS; G guidance; P pause; M map; C camera; comma/period time speed; Escape Settings.
Bindings can be remapped with conflict swapping and WASD/arrow presets. Mouse/
trackpad supports inspection and zoom; builder shortcuts include undo/redo,
duplicate and delete.

Touch supports independent held steering and throttle, Full/Cut, Stage, RCS,
guidance, pause/map/camera/time buttons, handedness, larger targets and sensitivity.
Lost focus, cancelled pointers, dialogs and resizing release inputs safely.
Exploration RCS is an ideal attitude-hold mode, not detailed separate RCS
propellant/actuator simulation. Its single-stage vehicles cannot stage.

Optional gamepad controls offer button/axis remapping, deadzone, pitch inversion,
neutral arming and disconnect/focus cleanup. Wake lock and haptics are opt-in and
capability-dependent. Browser fixtures tested their lifecycle; physical controllers
and phones are not certified by those fixtures.

## 9. Learning, challenges and local creation

Mission Lab provides Predict & fly: retain an orbital-speed explanation/prediction,
launch the tested First Orbit starter, compare with reference calculations and real
telemetry, and save a reflection. Predictions do not alter scores. The learning
journal and mission evidence can be exported. A guided showcase and a 60-checkpoint
curated First Orbit replay support demonstrations.

Seeded challenges reproduce one of sixteen altitude/inclination pairs with a
bounded budget; every pair was flown in the challenge validation. Local installation
preserves existing content and rejects conflicting identifiers. The logbook retains
flight results/events, compares score/time/cost/delta-v/max-q/max-g and derives five
local milestones. The exploration milestone explicitly allows sandbox placement.

Local data packs can add up to twelve bodies, twenty parts and eight Earth-orbit
missions. Standard data cannot be replaced by these packs. Imports accept bounded
data, not executable scripts or remote assets. Ordered flight programs allow
1–32 condition/action blocks and disarm on restore.

Applied-control recordings replay in a bounded local worker and compare canonical
states. Their scope is single-vessel controls/programs; multi-vessel actions and
all assistants are not universally captured. Telemetry graphs and CSV export are
available. The local replay archive supports OPFS with IndexedDB fallback,
checksums, deduplication, verified downloads, recovery and confirmed deletion.
Archive limits are twelve files, 50 MiB each and 200 MiB total; its files are
separate from whole-progress backups.

## 10. NASA and other scientific evidence

NASA-derived inputs are used by physics and visible science tools, not only logos:
12 spherical body radii, 10 gravitational parameters, 12 signed rotation periods,
178 Earth/Mars atmospheric bands and truncated EGM96 harmonics. Original GMAT/NAIF
snapshots are pinned, with hashes, field identifiers, conversions, references and
local downloads. Europa/Titan gravity and other unsourced quantities remain
labelled existing model inputs. Data is archived, not live NASA observations.

Conversions include km to m, km^3/s^2 to m^3/s^2 (factor 10^9), signed angular
rotation rates and volume-equivalent radius from the three source axes. Eight
original NASA-repository snapshots include data and method references. Additional
science includes DE421 kernel-derived samples, NRLMSISE-00, NASA CEA properties,
TPSX screenshot transcriptions and published thermal/ocean references. NASA data,
IERS conventions, third-party code and user-supplied screenshots have distinct
provenance; they are not all claimed as direct live NASA website downloads.

Independent evidence includes 51 external-reference cases across Orekit orbit/
gravity/eclipse/relativity/ocean comparisons, native-C versus browser atmosphere
checks and an ERFA standards-frame matrix. Reference errors apply to matched test
configurations. Additional DE421 held-out checks, analytic benchmarks, energy/
angular-momentum invariants and integration-convergence checks have their own
scopes. None establishes universal real-world accuracy.

The supplied CSR/FES/ocean papers and thermal abstracts/PDFs were reviewed and
preserved with provenance. Papers, sample rows and nominal exposures do not supply
an absent global atlas or complete experimental histories. Published evidence is
the agreed collection boundary; no fabricated calibration fills missing data.

## 11. Local reliability and offline behavior

IndexedDB stores progress with queued commits, legacy migration, guarded schemas,
up to six recovery snapshots per category, explicit write failures and paused
campaign recovery. Small preferences remain in localStorage. Web Locks provide
one writer tab when supported; secondary tabs become read-only.

Progress backups include versioning, SHA-256 integrity, bounded validation,
preview/merge and corrupt-input rejection. SHA-256 is integrity checking, not proof
of authorship. Site data is local to the browser/origin and can be evicted; exports
remain necessary for independent backups. Separate replay archives are explicitly
excluded from progress backups/deletion.

Offline preparation verifies the inventory before activating a build-specific
cache. Updates and cleanup retain build consistency. All eighty production
artifacts were checked against recorded sizes and hashes. Static delivery is
required initially; there is no backend gameplay service.

## 12. Optimization without quality reductions

Repeated harmonic calculations share a scratch workspace and reuse trigonometric
values/radial powers. Bounded normalization caching and compiled ocean-tide row
layouts avoid repeated work while preserving live coefficient edits. Kepler
iteration stops only at an exact floating-point fixed point, with its original
iteration upper bound.

No graphics cuts, force-model removals, precision downgrades or automatic step-
budget throttling were introduced. Existing integration/warp behavior is retained.

| Local workload | Before median | After median | CPU-time reduction |
| --- | ---: | ---: | ---: |
| Central high-warp coast | 1.859 ms | 1.305 ms | 29.8% |
| Advanced high-warp coast | 70.585 ms | 28.789 ms | 59.2% |
| Adaptive high-warp coast | 6.520 ms | 4.996 ms | 23.4% |

Three pairs of isolated processes used alternating order, ten warmups and one
hundred requests per workload. All twenty-seven paired final-state hashes and
achieved simulation times matched. Nine frozen serialized trajectories and
pre-change source comparisons also matched exactly. These are local CPU results,
not a universal FPS/phone performance guarantee.

A separate sandbox workbench measures a small JS/Wasm central-gravity component
and renders an orbit plot using an OffscreenCanvas worker or canvas fallback.
It is not a complete Wasm flight engine or replacement 3D renderer.

## 13. Latest recorded validation

| Evidence | Completed result |
| --- | ---: |
| Release audit groups | 28 passed |
| Standard regression checks | 302 passed |
| Campaign envelopes | 12 expected outcomes |
| Generated catalogue/options cases | 66,916 |
| Additional generated scenarios | 554,997 |
| Total generated checks | 621,913 passed |
| Device/world/craft combinations | 330 passed; complete ten-profile matrix |
| Tutorial steps skipped | 44 across four skip-path viewports |
| Seeded target combinations | 16 passed |
| Paired optimization outcomes | 27 exact state/time matches |
| Production artifact hashes | 80 verified |

The 540,672-case switch matrix covers all 8,192 masks of thirteen binary switches
across eleven worlds, three craft and both integrators. Other matrices cover
attitude/throttle/empty fuel, landing/impact, ordered craft pairs, contact switches
and materials. They are finite compatibility scenarios; not every arbitrary rocket,
continuous input, combination of every matrix or long-duration trajectory is
exhausted.

The 28 audit groups are regressions, build, campaign, combinations, scenarios,
challenges, profile, persistence, interface, controls, engineering, visuals,
roadmap, advanced, catalogue, submission, backlog, devices, skips, mobile,
vehicle, contact, TPSX, thermal, empty vehicle, legacy flow, showcase and offline.
Browser tests use Chromium, software WebGL and emulated profiles from 320x568 to
1920x1080, including touch, landscape, tablets and DPR 1–3. They do not certify
physical devices, every GPU or other browser engines.

## 14. Bugs addressed

Recorded corrections include mission-preset mass-limit mismatch; expected lunar
budget advice; lunar return-targeting timing; narrow mission-picker collapse;
undo/redo state mutation; malformed saved-list/tutorial data startup failures;
exploration creating unrelated builder autosaves; hidden 3D rendering under maps;
short-phone panel overlap and off-screen tutorial hints; stale control/help text;
legacy save/countdown assumptions; duplicate or invalid part identifiers;
radial-only axial imports; thermal calibration lost when creating companions;
inconsistent collision/contact switches; and zero-mass navigation after complete
jettison. Their regression coverage does not imply the absence of every future bug.

## 15. Hackathon submission and judging

The submission pack contains a detailed project report, seven-slide presentation,
presenter/demo script, user-testing protocol, numerical validation records,
source evidence, recorded flight backup, printable PDFs and standalone HTML.
The learning showcase and prepared offline First Orbit both passed end-to-end.

| Judging area | Demonstrable project evidence |
| --- | --- |
| NASA data | Source-to-value provenance and visible effect on gravity, atmosphere, orbital requirements and scientific tools. |
| Problem-solving | Predict a misconception, fly, inspect numerical evidence, explain the result and plan a revision. |
| Innovation | A browser-local combination of construction, exploration, scientific evidence, repeatable challenges and reproducible controls. |
| Science and technology | Integrated dynamics, finite fuel, numerical methods, perturbations, explicit approximations and independent references. |
| Implementation | Tested gameplay, device controls, recovery/backups, offline readiness, performance evidence and a dependable demonstration route. |

The evidence supports a defensible presentation; it cannot guarantee a judging
outcome. Final Astroverse submission-format/rubric requirements still need to be
checked when available. Automated demonstrations are not learner-study results.

## 16. Work that is still genuinely unfinished

- Physical Android/iOS/desktop/controller and GPU testing; Firefox/WebKit testing.
- A real consenting-participant learner study and measured educational outcomes.
- Full global ocean loading: high-degree/frequency response, station displacement,
  loading grids/response and associated validation. The present 8x8 ocean gravity
  file has 716 rows/18 constituents and does not finish that work.
- Experimentally calibrated spacecraft materials, detailed temperature/pressure
  dependence, pyrolysis/coating/phase behavior and complete matched measured
  heat-flux/temperature/recession validation.
- Detailed mesh fracture/debris contacts, flexible structures and general
  articulated multi-body docking constraints. Current boxes/spheres/paired
  attachments are bounded educational implementations.
- Longer/current precision ephemerides, current EOP ingestion and comprehensive
  time/orientation fidelity.
- Detailed planetary terrain, all moons, universal automatic interplanetary
  mission execution and general builder-to-exploration craft conversion.
- A full flight-engine Wasm migration or full worker renderer; the workbench is
  intentionally scoped and measured separately.
- Review of the uncommitted tree and a clean release/deployment. No latest-build
  deployment is established by the audit.

Accounts, multiplayer and hosted gameplay services are excluded by the project
instruction and are not pending requirements.

## 17. Evidence and ready-to-use files

- [Validation summary](submission/final-validation.json)
- [All audit commands and logs](submission/release-audit/manifest.json)
- [Paired optimization measurements](submission/optimization-validation.json)
- [Scenario matrix](submission/scenario-audit-results.json)
- [Complete device matrix](submission/device-matrix-results.json)
- [Detailed hackathon project report](submission/project-report.md)
- [Seven-slide presentation](submission/presentation.html)
- [Demo script](submission/demo-script.md)
- [Learner protocol](submission/user-testing-protocol.md)
- [Remaining-work register](remaining-work.md)

Printable report/deck and other submission files are in
`frontend/public/submission/`. To reproduce the full audit, use
`npm --prefix frontend run audit:release -- --extended` with the documented local
static server and isolated Chromium debugging session. This report preparation
only read the project/evidence and added this status document.
