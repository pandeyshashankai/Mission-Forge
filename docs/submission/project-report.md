# Mission Forge
## Learning orbital flight through NASA data and evidence

**Author:** Shashank Pandey · Individual participant · Astroverse local hackathon

**Prepared:** 4 November 2026 (India Standard Time)

**Status:** Working browser prototype; official event rubric and submission format pending.

## 1. Abstract

Mission Forge is a browser-based spacecraft builder and flight simulator designed to help learners connect rocket design, gravity, and orbital motion. Its focused educational question is: why does reaching space not necessarily mean reaching orbit? Learners record a prediction, fly a guided mission, compare that prediction with recorded telemetry, and write a reflection. A Mission Lab makes the underlying NASA inputs, equations, assumptions, and numerical checks visible.

The application combines a scored four-mission campaign with solar-system exploration, responsive keyboard and multi-touch controls, and local saves. This submission's distinct contribution is the connection between traceable NASA inputs, an executable scientific model, and a prediction–flight–explanation learning cycle. It does not claim to be the first educational simulator or a replacement for professional navigation software.

## 2. Problem and intended users

An intended audience is students and space enthusiasts who can recognise a rocket launch but may not distinguish altitude, speed, and a stable orbit. A launch animation alone does not explain why an apparently successful climb falls back to Earth. Complex engineering interfaces can also obscure the relationship between a user's decision and its outcome.

The design hypothesis is that making one misconception testable, with a visible reference calculation and recorded flight evidence, can make orbital concepts easier to understand. This hypothesis has not yet been established through a learner study. The interface and automated checks demonstrate implementation, not measured educational effectiveness.

The first lesson avoids requiring a learner to design a capable launcher from scratch. It supplies a tested rocket and optional guidance, leaving attention available for orbital speed, staging, and periapsis. Learners can then adjust the design or attempt manual control.

## 3. Solution and learning workflow

Open **Mission Lab → Predict & fly**. The learner chooses an explanation for what keeps a spacecraft in orbit and estimates its speed at 200 km above Earth. An incorrect prediction is retained rather than silently corrected. Predictions do not affect the game score.

The showcase loads First Orbit on Amateur difficulty with Orbiter-9 and a target inclination of 28.6°. The learner reviews the vehicle, launches it, watches staging and sideways acceleration, and uses the map to inspect periapsis. After completing the mission, the report compares the prediction with the analytic speed and the nearest recorded telemetry sample to 200 km.

The report explains whether the recorded periapsis clears the atmosphere. A spacecraft that reaches space without orbital speed receives a different explanation from one that never lifts off. An unavailable telemetry sample is reported as unavailable; it is not invented. Recorded inertial speed is explicitly distinguished from purely horizontal speed and from the ideal circular reference.

The learner saves a reflection describing the next change they would make. A local learning journal survives reload and can be exported as JSON. The mission-result export also includes the prediction, evidence comparison, and saved reflection. This is a personal learning record, not an automatic assessment of conceptual mastery.

## 4. NASA data acquisition and provenance

Eight original snapshots (five data files and three method references) were retrieved from NASA's official public **nasa/GMAT** repository at commit **c9b78bd1c8499845cb78fde315e1f761b6b06f1c**, on 4 November 2026. Their original bytes, SHA-256 hashes, headers, and notices are retained in the project. The import is reproducible and does not depend on a moving branch.

| Source | Imported fields | Role in the game |
| --- | --- | --- |
| JPL/NAIF pck00011, distributed with NASA GMAT | BODY*_RADII, three axes in km | Volume-equivalent body radius, altitude, collision surface, and orbital geometry for the Sun, eight planets, Moon, Europa, and Titan |
| NASA GMAT GmatDefaults.hpp | PLANET_MU, MOON_MU, STAR_MU in km³/s² | Gravitational acceleration and orbital dynamics for the Sun, eight planets, and Moon |
| JPL/NAIF pck00011 rotation fields | BODY*_PM linear rates in degrees/day | Twelve signed rotation periods; simplified spin axes, no periodic orientation corrections |
| NASA GMAT Earth and Mars density tables | 28 Earth and 150 Mars altitude/density/scale-height bands | Exploration drag; scored Earth upper-density blend |
| NASA GMAT EGM96.cof | Fully normalized Earth gravity coefficients, truncated to degree/order 8 | Optional non-central gravity in exploration, with original source hash and independent Orekit force-vector checks |
| NASA GMAT atmosphere implementation, transfer tutorial and burn reference | Method and units documentation, not additional measured datasets | Independent implementation of exponential density, two-burn workflow, directions and propellant accounting |

The kernel identifies itself as **pck00011**, dated **27 December 2022**, with scientific references in its header. The acquisition date is not a new measurement date. GMAT's gravitational parameters are archived software defaults and are not represented as the latest best-fit estimates.

Direct NASA websites were blocked by the cloud environment's outbound policy. The verified acquisition channel was NASA's own repository on GitHub. Official NASA upstream links are included for provenance, but those blocked pages were not represented as freshly retrieved sources. No third-party mirror was passed off as an official NASA download.

The original source license and notices are preserved. NASA data use does not imply NASA endorsement, sponsorship, or affiliation.

## 5. Data transformations and actual simulation use

The source axes a, b, c are converted into a volume-equivalent spherical radius:

**R = 1000 × (a × b × c)^(1/3)**, where the source axes are in kilometres and the game radius is in metres.

Gravitational parameters are converted by **μ[m³/s²] = μ[km³/s²] × 10⁹**. This cubic conversion matters: multiplying by only 1000 would produce incorrect gravity.

The generated dataset supplies the body's radius and μ to the exploration simulation. The scored Earth/Moon model also uses the imported gravitational parameters. The scored Earth radius is rounded to the nearest kilometre to retain the campaign's existing spherical altitude convention; its value is 6,371 km. The Moon uses the imported spherical radius.

Europa and Titan receive NASA-derived radii, but their gravity remains an explicitly labelled existing model input because the imported GMAT defaults do not provide those two moon parameters. Twelve rotation periods now use the NAIF linear prime-meridian rates. Earth/Mars density uses two additional NASA GMAT data files. Other atmospheres, fixed orbital elements, spacecraft specifications and simplified spin axes remain separately labelled model inputs.

At each destination, **Data & science** shows the values, source field identifiers, conversion method, source links, and limitations. The Mission Lab comparison changes orbital speed and period when the selected world or comparison altitude changes. The download contains field-level provenance and hashes. Data is bundled, so gameplay does not depend on live NASA API availability or a secret API key.

## 6. Science and technology

The ideal circular-orbit relation is **v = √(μ/r)**, with **r = R + h**. Escape speed is **vₑ = √(2μ/r)** and orbital period is **T = 2π√(r³/μ)**. Specific orbital energy is **ε = v²/2 − μ/r**. These are two-body relations; an atmosphere, thrust, or other perturbation changes the trajectory.

For the imported Earth model at 200 km, the independent analytic reference is approximately **7,788.488 m/s**, with a period of **5,301.005 s**. For the Moon at 100 km, the speed is approximately **1,633.504 m/s**. The lower lunar requirement illustrates why the same flight decision has different consequences on different worlds.

Exploration applies gravity in the governing body's frame, integrates motion with RK4 or optional error-controlled Dormand–Prince, models finite fuel and thrust, and changes frames at patched spheres of influence. Planet positions follow fixed approximate Kepler elements. It includes NASA-table-based Earth/Mars drag, separate approximations for other atmospheres, impact, and gentle airless touchdown. The scored campaign retains its additional staging, J2, guidance, maneuver, atmosphere, crew, and entry models.

Spacecraft, costs, guidance assistance, and atmosphere approximations are educational model choices. No claim is made that the craft are certified replicas, that the simulation evaluates SPICE orientation kernels, or that its planetary positions match current high-precision ephemerides.

### Engineering workbench and assisted transfers

Flight engineering exposes exponential density **ρ = ρ₀ exp[−(h−h₀)/H]**, dynamic pressure **q = ½ρv²**, drag **D = q Cᴅ A**, and the ideal rocket equation **Δv = Isp × g₀ × ln(m₀/mf)**. Isp and mass sliders are hypothetical inputs, not NASA engine hardware measurements. g₀ is the standard conversion reference, not the selected world's surface gravity.

The workbench also uses the Hohmann half-ellipse, **aₜ = (r₁+r₂)/2**, the vis-viva relation, and **coast = π√(aₜ³/μ)** to show two ideal burn requirements. Exploration's transfer assistant turns that estimate into finite burns with real fuel use: burn, coast, hold for confirmation, then circularize. It rejects eccentric starts, unsafe targets, insufficient propellant, or burns too long for the short-burn approximation. Manual control cancels it, and save restoration disarms it. No velocity or position reset is used to fabricate the target orbit.

The assistant follows NASA GMAT's documented two-burn workflow and Orbiter's documented emphasis on self-directed orbital goals. These were documentation reviews, not hands-on commercial-simulator benchmarks. The achieved orbit is shown separately from the ideal target.

Earth/Mars density is an archived model, not live weather or solar activity. Our altitude is spherical geometric altitude rather than GMAT's ellipsoid geodetic altitude. Scored Earth flight keeps the existing lower thermodynamic model, blends to the NASA density between 86–90 km, and keeps its educational 160 km cutoff. Exploration uses the tables within their source ranges. Temperature above 86 km remains a separate approximation, with pressure derived from that temperature and the imported density.

### Engineering, planning and repeatability additions

The builder now combines wet/dry mass, propellant, stage delta-v, Isp, burn time
and TWR in one staging inspector. Reusable stage groups preserve attached boosters
and receive fresh part IDs when inserted. Exploration provides live drag/density
instrumentation, explicit classical orbital-element singularities and a direction
sphere. Burn cards show delivered/remaining delta-v, remaining seconds and fuel.
Scored lunar maps show the sphere boundary and predicted transition markers.

Value-level provenance exposes conversions, pinned commit and checksums, with
original snapshots bundled for local download. The physics badge distinguishes
campaign Earth J2/Moon gravity from the independently configured exploration force model. A guided showcase
reruns 60 recorded First Orbit commands through FlightSim and compares numerical
checkpoints. It is an automated simulation example, not a student trial. Eleven
new checks include ten/twenty-period coast invariants, 10,000 seeded valid states,
existing Earth J2 nodal precession within 3% of a first-order estimate, replay,
subassemblies, attitude projection and all bundled source hashes. These analytic/game regression checks are now supplemented by actual Orekit
trajectories, native-C atmosphere references and an ERFA standards-frame matrix. Full roadmap status is documented in `docs/competitive-roadmap.md`.

### Local fleet, creation and advanced science

The expansion remains entirely client-side. Exploration supports up to six
persistent vessels, synchronized numerical coasting, real-thrust rendezvous
assistance and paired point-capture docking. Combined mass and momentum affect
flight; fuel transfer is capacity-limited and conserves propellant. Port orientation
and detailed vehicle collision geometry remain simplified. Companion creation is
labelled as a sandbox placement, not a completed launch or rendezvous.

Optional forces include Earth J2, degree/order-8 archived EGM96 harmonics,
differential Sun/Moon/parent gravity, solar pressure and an instantaneous elastic
solid-Earth tide response. These are individually visible and selectable. Eclipse,
battery and a geometric Earth-ground-link model affect spacecraft operation.
NRLMSISE-00 runs locally as WebAssembly with entered solar/geomagnetic indices;
its default indices are illustrative, not observed current space weather.

The Sandbox lab adds 84-cell Lambert transfer-window comparisons, circular
restricted-three-body propagation with Lagrange points/Jacobi diagnostics, and
separate simplified/IAU 2006–2000A frame workbenches. Custom planets, parts and
Earth-orbit missions are validated data packages. Visual programs use bounded
ordered blocks; user JavaScript is not executed. Control-trace replay and planning
run in bounded local workers. Preparing offline play caches static assets and
sources after the initial visit; no hosted simulator or multiplayer service is
required. Full implementation limits and source attribution are documented in
`docs/client-only-expansion.md` and `docs/third-party-science.md`.

Higher-fidelity exploration now includes finite apparent-Sun disk eclipses (penumbra,
umbra and annular cases), eclipse-contact step limits, averaged solar-generation
integration and optional Schwarzschild 1PN gravity. Independent Orekit checks cover
27 eclipse geometries, five relativistic force vectors and Earth/Mercury-like
three-period trajectories. Atmospheric-pass previews sample pressure every second
inside the atmosphere and report their bounded work horizon. The model still omits
limb darkening, multi-body relativistic coupling and precise planetary ephemerides.
The exact equations, tolerances and broader scenario groups are documented in
`docs/higher-fidelity-physics.md`.

## 7. Numerical validation and observed implementation evidence

A separate Python script using **60-digit Decimal arithmetic** generates the analytic benchmark fixtures without importing the JavaScript game code. The game compares circular speed, escape speed, and orbital period against these values for Earth, Moon, and Mars. The relative-error tolerance is **10⁻¹⁰**.

The actual exploration integrator is then coasted in vacuum (drag explicitly disabled for this conservative test) for a full reference period, using 360 requested intervals. Its final body-relative position is compared with its start, and its specific energy is compared before and after. The acceptance limits are **0.2% of orbital radius for closure** and **0.02% for energy drift**.

| Benchmark | Closure error / orbit radius | Relative specific-energy drift |
| --- | --- | --- |
| Earth, 200 km | about 9.90 × 10⁻¹⁰ | about 2.34 × 10⁻¹¹ |
| Moon, 100 km | about 1.91 × 10⁻⁹ | about 1.45 × 10⁻¹⁰ |
| Mars, 200 km | about 2.45 × 10⁻⁹ | about 2.60 × 10⁻¹² |

These small errors support numerical consistency in the checked ideal coasting cases. They do not validate every perturbation, atmospheric model, landing, interplanetary transfer, or hardware configuration. The analytic values are calculated reference results, not measured spacecraft trajectories or published mission-qualification results.

The automated regression suite includes **321 checks**, covering physics, exploration, the fleet, preflight, storage/history, themes, input controls, NASA source integrity, transformations, numerical benchmarks, the learning journal, all density bands and rotations, and 66 complete finite-transfer cases. Six additional live benchmark rows compare density, rocket-equation and Hohmann results with independent Decimal fixtures. Campaign checks cover all four missions on three difficulties. The stock Expert Lunar Orbiter intentionally exceeds its budget; its expected result is partial success with only the budget objective missed, not a full-score success.

### External reference comparisons

Actual Orekit 13.1.9 runs provide four central/J2 trajectories and 20 checkpoints.
Both the standalone error-controlled propagator and the live exploration path
are compared with the same initial states, epoch, gravitational parameters and
fixed-axis force models. All pass 10 m position and 0.01 m/s velocity limits. The
largest measured live-game position difference is approximately 0.00691 m in
these specific cases; this is a matched numerical benchmark, not a real-world
navigation accuracy claim.

Three degree/order-8 non-central force vectors agree with Orekit's
Holmes–Featherstone implementation within 10⁻⁸ m/s². Six specified NRLMSISE inputs
match separately compiled native C within 10⁻¹⁰ relative density error. A published
ERFA celestial-to-terrestrial matrix matches within 10⁻¹² per element. These 14
external-reference checks are exposed in Mission Lab and exported with source
versions, hashes and configuration. Native-C/WASM agreement validates the port,
not measured atmospheric accuracy. The standards-frame defaults are reference-test
inputs, not current Earth-orientation observations. Ocean loading, tide lag,
full n-body back-reaction and precision planetary ephemerides are not modelled.

Updating the imported lunar gravity exposed a return-planner defect: a low Earth perigee could be selected even when the outgoing ellipse would take weeks to return. The planner now rejects candidates outside its nine-day return window from the correction node. The complete crewed sequence is checked through recovery, rather than accepting a low predicted perigee as sufficient evidence of success. A machine-readable validation snapshot accompanies this report.

Browser checks exercise actual keyboard, mouse, and multi-touch events. The showcase check goes through prediction, launch, staging, orbital insertion, successful report, reflection, export, and journal reload. Viewports are emulated in Chromium; physical mobile hardware and other browser engines still require testing.

## 8. Implementation and architecture

The application uses React, Three.js, and local browser storage. Physics and scoring modules are separate from interface components, allowing deterministic checks without a rendered browser. The NASA import produces a small, local JSON subset and keeps the full source snapshots separately. Independent benchmark generation runs in Python.

Keyboard and touch share an input layer. WASD defaults, 16 remappable actions, multi-touch steering/throttle, stage, RCS, mirrored layouts, larger buttons, and safe-area handling support desktop and mobile interaction. Opening dialogs or losing focus clears held input. The interface provides three themes, optional detailed instruments, and visible explanations of unavailable actions.

The game requires no backend, account, or live data service. Saves and learning reflections remain in the current browser unless exported. Clearing site storage removes them. File exports provide a user-controlled backup.

## 9. Innovation and comparison

Mission Forge's contribution is its integrated, inspectable learning workflow: a retained prediction; data-backed physical inputs; a complete flight; an evidence-specific explanation; a reflection; and reproducible numerical checks. It makes the relationship between a source field and a flight decision visible to a learner and to a judge.

Other simulators already offer construction, realistic or simplified physics, and planetary exploration. This report does not claim unique invention of those features or feature parity with mature commercial products. The project's scope is an accessible browser lesson with transparent provenance and an extensible mission environment.

## 10. User validation plan and remaining evidence

No learner interviews, test participants, satisfaction scores, or learning gains are claimed. Before the event, recruit a small number of willing learners and follow the included protocol. Record anonymous participant IDs, task completion, points of confusion, explanations before and after the flight, and concrete design changes made in response.

A small convenience sample can expose usability problems, but cannot establish population-level educational effectiveness. A first pilot should check whether learners can find Mission Lab, record a prediction, launch, distinguish altitude from orbital motion, and explain why periapsis matters. Collect only the information needed and avoid personal details in exported notes.

The next engineering checks are physical Android/iOS testing, a second browser engine, and a broader validation of atmosphere and transfer accuracy. The official Astroverse rubric, time limit, NASA-data eligibility rules, and required report format must be checked when released.

## 11. Demonstration and submission contents

Use the included presentation and timed demo script. Demonstrate NASA provenance and the Earth/Moon comparison, run the science checks, record a prediction, launch the tested starter, inspect the orbit map, and open the learning report. Keep an exported successful result and a recording as presentation backups; do not present a replay as a live flight.

The project includes the application source, original NASA data and notices, generated dataset, independent reference generator, test commands, detailed report, slide deck, demonstration checklist, and participant-testing worksheet. The report is also available as HTML and PDF for printing or submission, subject to the event's final requirements.

## 12. Reproduction

Run from the repository root:

```sh
python3 scripts/import_nasa_data.py
python3 scripts/science_reference.py
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run test:campaign
npm --prefix frontend run build
```

For browser checks, serve `frontend/build` on port 8080 and use a dedicated Chromium profile with a local debugging port of 9222. Then run `npm --prefix frontend run test:showcase` and `npm --prefix frontend run test:controls` sequentially. These scripts clear the dedicated profile's site storage. Do not use a browser profile containing personal saves.

## 13. Sources

1. NASA, GMAT repository and pinned revision: https://github.com/nasa/GMAT/tree/c9b78bd1c8499845cb78fde315e1f761b6b06f1c
2. JPL/NAIF planetary kernel, verified NASA repository copy: https://github.com/nasa/GMAT/blob/c9b78bd1c8499845cb78fde315e1f761b6b06f1c/application/data/planetary_coeff/SPICEPlanetaryConstantsKernel.tpc
3. NASA GMAT gravitational-parameter defaults: https://github.com/nasa/GMAT/blob/c9b78bd1c8499845cb78fde315e1f761b6b06f1c/src/gmatutil/util/GmatDefaults.hpp
4. Official upstream kernel location, provided for provenance: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
5. Original kernel bibliography and applicability notes in `data/nasa/pck00011.tpc`; original GMAT license in `data/nasa/LICENSE-GMAT.txt`.
6. NASA GMAT Earth density: https://github.com/nasa/GMAT/blob/c9b78bd1c8499845cb78fde315e1f761b6b06f1c/application/data/atmosphere/earth/EarthExponentialAtmosphereData.txt
7. NASA GMAT Mars density: https://github.com/nasa/GMAT/blob/c9b78bd1c8499845cb78fde315e1f761b6b06f1c/application/data/atmosphere/mars/MarsExponentialAtmosphereData.txt
8. NASA GMAT atmosphere implementation and Simple Orbit Transfer / ImpulsiveBurn references: original snapshots, source paths and SHA-256 hashes in the generated manifest.
9. Orbiter public README: https://github.com/orbitersim/orbiter/blob/9721ab8d5ba4c30ed18d2a8921ee8b3e867882b8/README.md
10. Generated unit/provenance manifest: `frontend/src/science/data/planetary.json`. Independent analytic fixtures: `frontend/src/science/data/benchmarks.json`.

**Scope statement:** NASA data provenance and ideal-orbit numerical checks are demonstrated. Educational effectiveness, universal device compatibility, and precision mission navigation are not established by this prototype.

## Vehicle dynamics update — 5 November 2026

Exploration adds opt-in thermal balance, shield ablation and overload failure,
momentum-conserving fragment generation, swept spherical vessel/debris contacts,
and manually aligned docking ports. An offline January 2000 JPL DE421 pack provides
centre/barycentre states with held-out interpolation checks. Elastic tides can add
degree three and an experimental constant response lag. Full ocean loading,
calibrated material physics and full rigid-body contact are not implemented.
See `docs/vehicle-dynamics.md` for assumptions, provenance and bounds.

## Contact and thermophysical update — 5 November 2026

Oriented rigid boxes now carry angular momentum, finite inertia and frictional
contact response. Source-backed NASA CEA aluminium specific heat and measured-data
inverse fitting improve the thermal tools. A truncated ocean-tide gravity model
has three actual Orekit coefficient comparisons. Full global ocean loading and
vehicle-specific physical calibration remain unfinished: authoritative IERS and
NASA TPSX requests were denied by the environment proxy. No synthetic calibration
test is presented as a measured spacecraft experiment.
See `docs/contact-and-material-validation.md` for equations, evidence and bounds.

## Uploaded material evidence — 5 November 2026

Four manually transcribed TPSX phase records preserve source-quality and condition
flags. Three complete-property phases are selectable as constant-property thermal
presets, with implicit surface/backing conduction and material-specific emissivity
and thermal capacity. AVCOAT virgin uses the supplied 23.8 MJ/kg effective ablation
energy; PICA recession is disabled because its energy parameter was not supplied.
The seven uploaded NTRS abstracts inform model limitations but contain no numeric
validation histories. No calibrated material or complete ocean-loading claim follows
from these uploads. See `docs/tpsx-uploaded-evidence.md`.

## Public-data thermal comparison bench — 5 November 2026

The Sandbox Arc-jet materials tool now runs six published exposure targets against
three constant-property TPSX phases. Users select hot/cold-wall reference flux and
assumed thickness, compare shared-scale surface/backing temperature plots, and
export prediction histories plus source/input metadata. The model preserves its
explicit geometry and boundary-condition assumptions and does not present these
curves as measured validation. All 18 combinations have bounded numerical checks;
step refinement, input validation and downloadable output are verified.

## Catalogue and combination audit — 5 November 2026

The audit now covers 66,916 generated engineering, geometry, editing, staging,
force/system, thermal and fleet scenarios in explicitly bounded matrices. All
ordered built-in axial pairs and triples are included. The standard suite passes
321 tests and all 12 campaign cases meet their expected envelopes. Tests found
and corrected ambiguous import identifiers, missing thermal calibration in newly
created companions, and inconsistent collision/rigid-contact switches.
Coverage limits and reproducible artifacts are documented in `docs/full-system-test-audit.md`.

## Save recovery and offline evidence update

Large local records now migrate to a versioned IndexedDB database with queued
commits and recent recovery snapshots. A flight recovery opens paused. A local
data screen offers storage estimates, checked backup preview/merge, snapshot
restoration and explicit deletion. Failed writes preserve the previous database
transaction and offer export of the in-memory session.

The evidence screen links the judging flow, provenance, numerical checks and
scientific limitations. Production builds record artifact hashes and mark
uncommitted source changes explicitly. Offline preparation verifies cached files
before activation and reports its complete inventory after reload. Quick First
Orbit starts its countdown in two deliberate actions from home. These reliability
features do not establish additional physical accuracy or measured learning
outcomes. See `docs/serverless-readiness.md` for storage and release limitations.


### Local usability and exact-result performance work

Searchable navigation, repeatable seeded orbit challenges, a local flight logbook
and comparison, configurable gamepad controls, optional wake lock/haptics and a
bounded OPFS replay archive with IndexedDB fallback are implemented. Browser API
fixtures validate lifecycle and fallback behavior; they do not certify physical
controllers or mobile hardware. Replay archive files are separate from progress
backups and explicitly managed in the archive.

The performance workbench measures an isolated central-gravity JavaScript/Wasm
component and renders an orbit plot with an OffscreenCanvas worker or canvas
fallback. It is not a replacement flight engine. Production optimization instead
reuses harmonic workspaces and tide layouts, and stops Kepler iteration only at
an exact floating-point fixed point. Force models, integration settings, warp,
visual quality and controls are preserved. Frozen source comparisons and nine
serialized flight fixtures match exactly. Three pairs of isolated benchmark runs
also require identical final-state hashes and achieved simulation times across
all nine workloads; the raw timings and machine-specific scope are recorded in
`docs/submission/optimization-validation.json`.


### Connected learning and Build-to-Exploration

Mission Control Academy now provides five prediction/experiment/reflection lessons,
with the first lesson launching the tested First Orbit starter through optional
session-specific guidance. NASA Data Explorer compares sourced worlds at a common
altitude and exports values, conversions and source metadata. Interactive debriefs
connect objectives and recorded events to nearby telemetry with explicit time
offsets; missing horizontal speed is reported rather than inferred.

A scientific comparison runs central and selected perturbed trajectories from
identical initial conditions with the same selected integrator. Its local worker
exports sampled differences, states, force settings and a bounded horizon. Numerical
error remains part of the difference; it is not physical measurement validation.

A restricted single-stage builder adapter preserves supported dry mass, fuel,
aggregate vacuum thrust/effective Isp and solar/battery characteristics. Actual
built geometry renders in exploration and the recipe survives fleet/save restore.
Unsupported designs are rejected with reasons. Placement is not a simulated launch;
ideal attitude, fixed loads and existing drag/contact/thermal assumptions remain.

Full ocean loading, mesh fracture and a complete Wasm engine are the next
engineering milestones, not features completed by this release. The scientific
limitations and physical-device/learner-study requirements remain explicit.


## New engineering laboratories

The station ocean-loading lab evaluates all 342 HARDISP-style constituents from
11 complex BLQ amplitudes and phases. Its two 24-hour independent reference
series pass component tolerances of 6 micrometres (Onsala) and 20 micrometres
(Reykjavik). UT1 epoch and TT-minus-UT1 are explicit. The Reykjavik source
fixture contains suspect swapped geographic coordinates, so it is retained for
local-component reference checks and excluded from gameplay station selection.
This is station displacement, not a global ocean-height atlas or a replacement
for the separate truncated ocean-gravity model.

Convex triangle hull fracture produces 2, 4 or 8 closed pieces with exact
uniform-density volume, centroid and inertia integration. Contacts use convex
separating axes, angular impulses and Coulomb friction. Tests cover mass, centre
of mass, linear/angular momentum, separation energy, persistence and terminal
debris motion. Materials are not calibrated fracture laws; concave vehicle-part
fracture is outside the supported geometry.

The full-engine laboratory executes bundled campaign and fleet source inside
a QuickJS WebAssembly interpreter in a cancellable worker, including resources,
crew, staging and optional force/contact models. NRLMSISE uses its existing
bundled Wasm library through a typed bridge. Paired tests cover every built-in
world and spacecraft. This backend is slower in measured cases, remains opt-in,
and is not represented as a native C or Rust engine. State can be exported or
handed back to the standard renderer. Ordinary gameplay defaults are preserved.
