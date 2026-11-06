# Client-only expansion

Implemented 4 November 2026 (Asia/Calcutta). The game runs in the browser. No
accounts, database service, hosted simulation, multiplayer, or paid API is used.
Static delivery is still needed for the initial visit; **Prepare offline play**
caches the application, model libraries, data sources and presentation documents.

## Where to find the features

| Entry | What it does |
| --- | --- |
| Home → Sandbox lab → Transfer windows | 84 zero-revolution Lambert solutions, with departure/arrival velocity changes, selectable cells and explicit heliocentric assumptions. |
| Sandbox lab → Three-body flight | Earth–Moon circular restricted three-body propagation, all five Lagrange points and a Jacobi-constant drift measurement. |
| Sandbox lab → Reference frames | Game spin-frame position/velocity conversion, plus a separate IAU 2006/2000A GCRS-to-ITRS position workbench with explicit TT/UT1 and polar motion. |
| Sandbox lab → Worlds & data packs | Create playable custom planets and Earth-orbit challenges; import/export bounded planet/moon/part/mission packages. |
| Explore → Flight | Orbital elements, attitude directions, engineering and a rolling 600-point telemetry graph/CSV export. |
| Explore → Plan | Actual finite-burn orbit transfers, local-worker closest-approach forecasts, and a cloned atmospheric-pass preview. |
| Explore → Systems | Independently selectable gravity/atmosphere/integrator/resources, ordered flight programs and control-trace recording/replay. |
| Explore → Fleet | Up to six persistent vessels, synchronized coasting, rendezvous assistance, docking, fuel transfer, undocking and fleet export/import. |
| Explore → Fleet camera | Nearby spacecraft at their actual relative positions, with a camera framing the closest companion. |
| Hangar → Mass & thrust | Wet/dry centre-of-mass markers, combined engine axis and an explicitly approximate side-area centre. |
| Mission Lab → Science checks | Live comparisons with actual Orekit runs, native-C atmosphere references and a published ERFA matrix case. |
| Home → Prepare offline play | Cache the static application and scientific/presentation assets on this device. HTTPS or localhost is required by browser service-worker rules. |

## Force models and resources

Default exploration retains central gravity and the existing atmosphere. The
campaign retains its existing Earth J2 / patched Moon model. New exploration
options are opt-in and persist in vessel saves:

- Earth J2: fixed coefficient 1.08262668×10⁻³ and 6,378,137 m reference radius,
  with the simplified model +Z symmetry axis.
- Relativistic gravity: optional Schwarzschild first post-Newtonian correction in
  the primary rest frame. Frame dragging and multi-body relativity are excluded.
- Earth harmonics: archived EGM96 fully normalized coefficients, degree/order
  2, 4 or 8. Degree/order 8 has 42 non-central coefficient pairs. It replaces,
  rather than doubles, the standalone J2 term. A finite-difference potential
  gradient is evaluated in the simplified rotating frame.
- Differential third-body gravity: Sun/Moon for Earth; Sun/parent for moons;
  Sun for other planets; selected major planets in the heliocentric region.
  The indirect reference-origin acceleration is included. Source positions are
  still fixed approximate Kepler orbits, not a self-consistent n-body solution.
- Solar radiation pressure: 4.56×10⁻⁶ N/m² at 1 AU, area 8 m² and reflectivity
  coefficient 1.3. Finite-Sun primary/parent occultation produces gradual penumbra, umbra and annular eclipses.
- Elastic solid-Earth tides: instantaneous quadrupole response to Sun and Moon,
  assuming k₂=0.3. No ocean loading, lag, frequency corrections or IERS-grade
  tidal solution is claimed.
- Atmosphere: original NASA GMAT bands, or optional NRLMSISE-00 for Earth with
  entered daily/mean F10.7 and daily Ap. The WASM model is bundled locally.
  Defaults are model inputs, not live observations. Other supported worlds keep
  their explicitly labelled existing atmosphere models.
- Integrator: original RK4 or bounded Dormand–Prince 5(4) with embedded error
  control. Presets select Game, Accurate or Perturbed configurations; every
  model remains visible and individually configurable.
- Electrical model: 1,200 Wh battery, 800 W generation at 1 AU in sunlight,
  100 W baseline load and 80 W additional full-throttle load. Blackout inhibits
  thrust and attitude control; sunlight can recharge the battery.
- Communications: illustrative rotating equatorial Earth ground station,
  geometric line of sight and 2 AU range. Light time is displayed. The option
  inhibits ignition without a link; commands are not delayed and it is not a
  DSN simulation.

## Fleet dynamics and persistence

Parked free vessels propagate numerically alongside the active vessel. If they
need more work to catch up, active advancement waits for synchronization instead
of teleporting another craft to the present. Only the active vessel receives
pilot input. Docked guests are passive cargo; their independent electronics are
not simulated while attached.

Rendezvous assistance requires free, synchronized vessels around the same body
within 100 km. It uses finite thrust and consumes propellant, approaching a
capture region rather than assigning a new position. Manual input cancels it.
Docking requires separation ≤25 m and relative speed ≤0.5 m/s. Capture conserves
linear momentum; the guest's full wet mass affects host propulsion. Fuel transfer
is capacity-limited and conserves total propellant. Undocking applies a small
separation impulse and the corresponding host recoil. Port orientation and
vehicle collision geometry are simplified.

Creating a companion is explicitly a sandbox placement 100 m away with matching
inertial velocity. It does not represent a launch, rendezvous achievement or
refilling the active spacecraft. Restoring any vessel/world disarms thrust,
programs and assistance. Existing single-vessel saves remain importable.

## Automation, recording and prediction

Programs contain 1–32 ordered blocks. A block waits for elapsed time, altitude or
fuel conditions, then changes throttle/attitude, cuts thrust or stops. At most one
block executes per advance. Programs can be saved or exported as data, and are
disarmed on reload. No user JavaScript is executed.

Control traces store initial state, model inputs, applied controls and advance
requests, not rendered video. A bounded local worker re-executes the controls and
compares canonical final states. The curated First Orbit replay additionally
checks its full sequence of 60 numerical checkpoints. Generic traces cover
single-vessel manual/program flight; transfer/rendezvous assistants and multi-
vessel world actions are outside that recorder's scope. Limits are 12,000 commands,
200,000 integration steps and a 20-second replay-worker budget.

Closest-approach forecasts are coast-only snapshots, with 20,000 physics steps,
20 seconds of worker time, and a requested horizon up to 720 hours. The actual
horizon and any truncation are reported. Closest sampled approach is not an exact
event root. Atmospheric previews apply an explicitly hypothetical impulsive setup
burn to a clone, then propagate central gravity and selected drag for at most six
hours. Other perturbations/resources are disabled in that preview. They do not
execute a maneuver on the live vehicle. Heating is an Earth-air blunt-body proxy,
not a shield limit or a certified safe corridor.

## Local content boundaries

Packages are versioned JSON: at most 12 added bodies, 20 parts and 8 Earth-orbit
missions. IDs use a reserved `local-` namespace. Standard NASA-derived bodies,
standard parts and campaign goals cannot be replaced by a package. Only numeric
and label fields are accepted; remote assets, executable code and page scripts
are not loaded. The editor is append-only to preserve saved designs and fleets.
Cross-device sharing uses files, not a hosted gallery. Install a design's content
package before loading its craft/world save on another device.

## Reference evidence

Four actual Orekit 13.1.9 trajectories provide 20 checkpoints: circular Earth,
eccentric/inclined Earth, circular Moon and fixed-axis Earth J2. Both the standalone
error-controlled integrator and the live exploration simulation are compared to
these states. Acceptance limits are 10 m position and 0.01 m/s velocity in the
specified simplified configurations. This is not a real-mission tracking error
bound. Three non-central EGM96 degree/order-8 vectors are compared against Orekit's
Holmes–Featherstone implementation with a 10⁻⁸ m/s² limit.

Six NRLMSISE cases compare the browser WASM port with separately compiled native
C, using identical specified inputs and SI output. This verifies the port, not
agreement with actual atmosphere measurements. The standards rotation is compared
with a published ERFA C test matrix at 10⁻¹² per element. Defaults in that frame
workbench are reference-test inputs, not current Earth-orientation observations.

- `npm test`: 282 automated tests, including 10,000 seeded states, 66 finite
  transfers and the new model/fleet/recording/content checks.
- `npm run test:campaign`: 12 fixed-envelope campaign cases. Expert Lunar Orbiter
  retains its documented stock-budget challenge.
- `npm run test:advanced:ui`: production-browser interactions for new features.
- `npm run test:engineering:ui`: actual finite transfer and mobile touch takeover.
- `npm run test:offline`: real service-worker installation, offline reload, planning,
  locally loaded standards model and cached science/presentation downloads.
- `npm run test:ui` and `npm run test:controls`: general layouts, themes, presets,
  save/import and shared keyboard/touch behavior.

Reference regeneration is a development operation, never a runtime game service:
`python3 scripts/reference/generate_orekit.py` (Java + pinned JPype requirements),
`python3 scripts/reference/generate_msis.py` (gcc), and
`node frontend/scripts/export-advanced-validation.cjs`. Maven artifacts and model
sources have recorded versions and hashes. See `third-party-science.md` for
attribution and source details.

See [higher-fidelity physics](higher-fidelity-physics.md) for finite-Sun lighting,
1PN gravity, improved atmospheric sampling and the expanded scenario validation.
