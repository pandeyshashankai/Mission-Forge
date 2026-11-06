# Higher-fidelity physics and broader validation

Implemented 4 November 2026. These changes extend the educational exploration
simulator. They do not change the scored campaign's established force model.

## Flight changes

**Finite-Sun eclipses.** Solar radiation pressure and solar generation now use the
visible fraction of the apparent solar disk. Analytic angular-disk overlap resolves
full sunlight, penumbra, umbra and annular eclipses. The calculation uses the body's
radius, the imported solar radius and the current source geometry. Solar brightness
is uniform; limb darkening, refraction and atmospheric scattering are omitted.
Primary and parent occultors are checked. Simultaneous partial shadows use the
strongest obscuration, not an exact union of several occulting disks.

The coast step approaches eclipse contacts using a conservative angular-rate bound,
with a 0.1-second minimum step. Battery generation uses the average of start/end
power rather than only the start value. This reduces sensitivity to the requested
time-warp interval. It is not a root-solved eclipse event detector.

**Relativistic gravity.** Explore → Systems → Physics & spacecraft systems offers
an independent **Relativistic central gravity (1PN)** switch. The perturbation is

`a₁PN = μ/(c²r³) [(4μ/r − v²)r + 4(r·v)v]`, with `c = 299792458 m/s`.

Position and velocity are relative to the current primary. The term is the first
post-Newtonian Schwarzschild correction for a spherical non-rotating source. It
excludes frame dragging, multi-body relativistic coupling and relativistic time
transfer. The effect is very small in ordinary short Earth flights. The Perturbed
preset enables it; the Game preset disables it. Saves persist the option.

Control traces now identify physics revision 2. Earlier generic traces are rejected
with a clear compatibility message, rather than silently replaying with a changed
power/shadow model. The curated scored First Orbit replay is unchanged.

**Atmospheric previews.** The preview now samples pressure and minimum altitude at
one-second requested intervals inside the atmosphere, instead of only at the end
of a large coast request. A 100,000-integration-step budget and six-hour horizon
remain explicit; truncation is reported. This is still a hypothetical setup burn
and a central-gravity/drag clone, not live maneuver execution or a heat-shield
certification. Other perturbations, including 1PN, are disabled for this preview.

## Independent evidence

`python scripts/reference/generate_precision.py` runs actual Orekit 13.1.9 using
the existing checksum-verified Maven jars. It generates local, downloadable fixtures:

- Five `Relativity` acceleration vectors around Earth and Sun. Agreement is within
  a relative 10⁻¹², with a 10⁻²⁰ m/s² absolute floor.
- Twenty-seven `SolarRadiationPressure.getLightingRatio` cases: low/high Earth
  shadow contacts and annular lunar geometries, using a spherical occultor and
  Orekit's specified solar radius. Absolute fraction tolerance: 2×10⁻⁸.
- Earth and Mercury-like heliocentric 1PN trajectories, each spanning three orbital
  periods and four checkpoints, using Orekit's numerical DP853 propagator.

The independent DP5(4) calculation differs from Orekit by at most 0.00831 m for
the Earth case and 3.423 m for the Mercury-like case. The live game propagator's
maximum errors in these fixtures are 0.00548 m and 0.00355 m respectively. Accepted
position limits are 1 m / 100 m and velocity limit is 0.001 m/s. These are matched
configuration checks, not errors against observed spacecraft or current ephemerides.
The heliocentric fixture is a Mercury-like test-particle orbit, not a predicted
position of the real planet Mercury.

Mission Lab → Science checks now exposes these results alongside the earlier
references, with measured errors and downloads: **48 external-reference cases**
in total. Reproduce the exported measurements with
`node frontend/scripts/export-advanced-validation.cjs`.

## Broader regression scenarios

`npm --prefix frontend run test:precision` adds twelve tests, bringing the full
suite to **249 automated tests**. Scenario groups include:

- 36 local and 12 heliocentric Lambert endpoint checks, verified by independently
  propagating the returned departure velocity and comparing arrival position and
  velocity. Heliocentric cases cover Venus, Mars and Jupiter with two departures
  and two flight-duration factors. These test mathematical two-body solutions;
  they do not establish surface clearance, launch feasibility or SOI capture.
- Earth/Mars atmospheric passes: three periapsis choices per body, RK4 and adaptive
  integration, and 1 s versus 0.5 s pressure sampling. All twelve configurations
  enter the atmosphere, finish within their budget and preserve the live vessel.
  Sampled peak pressure differs by less than 2%; minimum altitude by less than
  100 m. Energy decreases, with matching terminal status.
- Relative-velocity drag dissipation across Earth, Mars, Venus and Titan, three
  altitudes and three velocity directions (36 combinations).
- Six-vessel synchronized coasts, twenty repeated docking/fuel-transfer cycles,
  separate Earth/Moon primary frames and fleet save/restore.
- Penumbra power convergence between high requested warp and 0.2-second requests,
  with less than 0.02 Wh battery difference and 0.1 m position difference.
- Physics option persistence, replay compatibility and bounded-preview rejection /
  work-truncation handling.

Current planetary ephemerides remain approximate Kepler elements. Precision Earth
orientation is still a separate workbench with explicit inputs. Ocean loading,
frequency-dependent tides, port alignment and detailed collision geometry remain
future work. No backend, hosted weather feed or multiplayer was introduced.


Later bounded extensions add a January 2000 DE421 pack, truncated degree-eight
FES ocean-gravity coefficients, port-alignment geometry and oriented-box rigid
contacts. Earlier statements about approximate ephemerides and point capture
refer to the original update. Current data ranges and simplifications remain
explicit: these additions do not provide current global ephemerides, full ocean
loading, detailed mesh fracture or a general articulated constraint solver.
