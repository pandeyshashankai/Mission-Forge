# Full-system test audit — 5 November 2026

The requested audit covers the finite matrices below. It is exhaustive within their stated axes, not across arbitrary-length rockets, continuous pilot inputs, unlimited local content or physical hardware.

## Automated catalogue and assembly matrix

`npm --prefix frontend run test:combinations` produces two JSON reports. The final runs cover **66,916 generated cases**, all passing.

| Group | Cases | What is checked |
| --- | ---: | --- |
| Every axial part individually | 35 | Finite engineering/runtime values and independent wet-mass totals |
| Every ordered axial pair | 1,225 | Same checks; repeated part types included |
| Every ordered axial triple | 42,875 | Same checks for all 35³ ordered stacks |
| Booster/parent/symmetry groups | 105 | All axial parents × booster × 2/3/4 symmetry; undersized parents must be rejected |
| Command/tank/engine/throttle/pressure | 5,184 | Compatible propellant produces thrust; incompatible combinations do not; fuel consumption matches mass loss |
| Preset/mission/difficulty readiness | 84 | All seven presets × four missions × three difficulties; valid readiness statuses, including expected NO-GO/warnings |
| Every preset/part/placement | 756 | Above/below/radial behavior, immutable editing and valid duplicate IDs |
| Command/tank/engine short launches | 432 | Finite physical state after 0.25 s; not successful full-mission qualification |
| Every preset staging permutation | 883 | Legal sequences or expected normalization of invalid orders; no negative runtime mass |
| Ordered-pair edit groups | 4,900 | Both selected parts and move directions, duplicate/remove mass consistency, input immutability |
| Every individual part forced launch/staging | 36 | Unsupported launches remain finite; a fully jettisoned vehicle ends cleanly |
| Every catalogue part's geometry | 36 | Finite, nonempty geometry and bounds; disposal invoked |
| Every ordered axial pair's geometry | 1,225 | Same CPU geometry checks for 35² assemblies |
| All binary force/system masks | 2,048 | Every 10-flag combination × two integrators on Earth, with short-coast/save/restore checks |
| Body/craft/integrator/ephemeris/harmonics/material/atmosphere | 6,336 | 11 worlds × 3 craft × 2 integrators × 2 ephemerides × 4 harmonic settings × 6 thermal selections × 2 atmosphere selections |
| Thermal exposure matrix | 324 | 6 exposures × hot/cold reference × 3 material phases × 3 thicknesses × 3 initial temperatures |
| Craft-pair/contact/material matrix | 432 | 3 hosts × 3 guests × rigid/port/collision switches × 6 materials; docking, fuel conservation, reload and undocking momentum |

The ten force/system flags are J2, relativity, thermal damage, advanced elastic tides, ocean-tide gravity, elastic tides, differential third-body gravity, radiation pressure, power and communications. Rigid contact mode implies collision processing; coupled switches are not independent physical effects.

The 6,336 world configurations and 2,048 binary masks coast for 0.05 s before and after reload. They are robustness/serialization checks, not long-term accuracy bounds. Existing regression checks additionally cover long conservative coasts, 10,000 seeded states, finite transfers and independent external references.

Catalogue geometry tests use a declared canvas stub for procedural texture creation in Node. They verify geometry/bounds, not actual GPU pixels. Browser tests separately exercise native canvas/WebGL and texture loading. Assemblies can be structurally representable while being unfit to launch. A fairing-only assembly can legitimately reach zero attached mass after jettison; negative mass remains a failure.

## Product defects fixed

1. **Ambiguous identifiers in imported craft.** Stack and radial groups previously could share IDs, or several radial groups could share an ID. Imports now require globally unique nonempty IDs, and radial-only boosters cannot enter the axial stack. Targeted tests reproduce invalid imports and verify valid grouped designs remain accepted.
2. **Lost calibration in new companions.** A companion inherited the calibrated material setting without its observations, making whole-fleet restore fail. Companion creation now supplies observations to the constructor, which independently refits/validates them. Calibrated constructors without observations are rejected. All three companion craft are checked through world reload.
3. **Inconsistent collision switches.** Rigid contact mode could process collisions while the collision checkbox appeared off. Enabling rigid contacts enables collisions; disabling collisions disables rigid contacts and rotational contact control. A regression test checks these transitions.

4. **Empty-vehicle navigation after forced launch.** A fairing-only vehicle could jettison all attached mass and report NaN acceleration. Acceleration is now finite at zero mass, and jettisoning all structure ends the vehicle cleanly before further integration. All 36 individual catalogue cases are forced through staging and checked.

Synthetic calibration fixtures exercise software plumbing only; they are not experimental spacecraft data.

## Regression, campaign and browser verification

The standard suite at this bounded-matrix audit contained **282 passing tests**, including six new import/calibration/switch regressions. All 12 campaign envelope cases pass their expected outcomes. The stock Expert Lunar Orbiter retains its expected budget-only partial score.

The production-browser workflow covers themes, four viewport sizes, all mission preflight flows, all seven presets, save/import, all 33 standard explorer/craft destinations, remapping, multi-touch steering/throttle, staging/RCS, the complete First Orbit learning showcase, finite transfers, camera/export behavior, curated replay, source provenance, planning workers, local content, fleet operations, material/calibration tools, thermal comparison, submission files and offline operation.

The final native catalogue audit loads 36 individual-part cases (a booster uses its required minimal parent), 35 command/part groups and three booster symmetries: **74 assemblies**, plus two invalid duplicate-ID imports that must preserve the previous craft. Canvas rendering and uncaught exceptions are checked. This is not a pixel-perfect image comparison. The contact workflow also checks calibrated companion creation, whole-fleet reload and coupled switches in the browser.

See JSON artifacts under `docs/submission/`: `combination-audit-results.json`, `option-audit-results.json` and `catalogue-browser-audit.json`. Browser/device emulation is Chromium with software WebGL; physical phones, Safari/Firefox and every arbitrary user-created design are outside this audit.

## Reproduce

- `npm --prefix frontend test`
- `npm --prefix frontend run test:combinations`
- `npm --prefix frontend run test:campaign`
- `npm --prefix frontend run test:catalogue:ui`

Other browser scripts are under `frontend/scripts/`; run them sequentially against the production build on port 8080 and Chromium CDP on port 9222. The audit scripts preserve failures in JSON and return a nonzero exit status when an assertion fails.

The later [serverless readiness update](serverless-readiness.md) adds seven
persistence/import regression groups, taking the current standard suite to 289.
The generated combination counts above are unchanged.
