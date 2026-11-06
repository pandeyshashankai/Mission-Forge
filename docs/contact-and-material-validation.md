# Contact, material and ocean-tide validation — 5 November 2026

This release implements additional models. It does **not** mark full global ocean loading or experimentally calibrated spacecraft materials as finished.

## Rigid-body contacts

Fleet → Rigid-body hull contacts enables body orientation quaternions, world angular momentum, box principal moments of inertia, bounded-torque attitude control, oriented-box separating-axis contact detection, normal impulses, Coulomb friction and penetration stabilization. Off-centre impacts transfer angular momentum into spin. Torque-free integration preserves angular momentum and normalizes orientation. The renderer displays all three rotational degrees of freedom.

Contact mode limits advancement to 0.02 s and further limits translation/rotation sweep. It does not keep a time-warp backlog. Eight sequential contact iterations stabilize overlapping hulls. The hull is a 3 × 6 × 3 m box; restitution 0.1, friction 0.4 and maximum attitude torque 200 Nm are assumptions. This is not detailed mesh contact, flexible-body deformation, a certified docking mechanism or a general articulated-constraint solver. Existing docking uses the established paired attachment model rather than a multi-body weld solver. Debris retains the earlier sphere/contact-loss approximation.

Tests cover elastic head-on momentum/energy conservation; dissipative off-centre friction and spin; torque-free angular momentum, quaternion norm and energy drift; separated hulls; invalid states; slow-touching fleet survival; and rotational save/restore.

## Traceable material properties and calibration

The crystalline aluminium specific-heat curve comes from NASA CEA's `AL(cr)` fit, citing Cox 1989 p217, distributed in RocketCEA's original `thermo.inp`. The unchanged extracted source record is `data/models/aluminium-cea.txt`; source URL and original full-file hash are in `frontend/src/science/data/materials.json`.

The NASA polynomial defines specific heat only from 300 to 933.61 K. The game assumes 200 kg effective structural mass, retains the baseline shield assumptions, and flags property-range excursions. Melting-temperature exceedance degrades integrity. This source-backed thermodynamic curve is **not** a vehicle-calibrated heat shield or arc-jet validation.

Systems → Import thermal measurements accepts a JSON object with `source`, known `area`, `ambient`, and `records`. Each record contains `temperature` (K), `rate` (K/s), and absorbed incident `flux` (W/m²). It fits total heat capacity and emissivity to:

`C dT/dt + ε σ A (T⁴ − Tamb⁴) = q A`.

One quarter of observations is withheld. The fitter rejects poorly conditioned experiments, nonphysical parameters and held-out RMS error above 5% of the held-out forcing RMS. It retains observations and refits them on save reload. Source labels do not authenticate an experiment; applicability and data authenticity still require experimental review. Synthetic recovery tests verify the inverse solver only, not spacecraft calibration. Out-of-fit temperature ranges are flagged during flight.

## Ocean-tide gravity

Systems → Ocean-tide gravity evaluates time-variable Stokes coefficients using FES2004's positive/negative wave amplitudes, Doodson arguments and IERS 2010 equation 6.15. The shipped source explicitly says it is an **8×8 truncated test file**, containing 716 rows for 18 constituents. The original header, source URL and SHA-256 are retained. It is independent of the existing solid-Earth tide option.

Three epochs of coefficient variations match actual Orekit 13.1.9 evaluations within 10⁻¹⁷ per coefficient. Regenerate with `scripts/reference/generate_ocean_reference.py`; the reference explicitly assumes UT1=TT. Simplified spin/time scales remain in force evaluation.

This is an ocean-tide gravity contribution, **not full ocean loading**. Global high-degree coefficients, constituent admittance, station deformation, ocean-pole loading and real Earth-orientation/time inputs are not all implemented. It would be incorrect to relabel this truncated model as complete.

## Concrete data blockers

The environment's network proxy returned HTTP 403 when accessing the authoritative IERS full ocean-coefficient URL and NASA TPSX:

- `https://iers-conventions.obspm.fr/content/chapter6/additional_info/fes2004_Cnm-Snm.dat`
- `https://tpsx.arc.nasa.gov/`

Those denials were not bypassed. The accessible Orekit test file cannot replace a full global dataset. No measured, spacecraft-specific heating/ablation/strength experiment was supplied or retrieved, so no claim of calibrated spacecraft materials is made. Completing those requirements needs accessible authoritative ocean/loading data and traceable material experiments, followed by validation against independent physical measurements.
