# Connected learning release — 6 November 2026

This implements the six recommendations from the project review. All behavior
remains browser-local. It does not implement the three later research milestones.

| Feature | Entry | Implemented behavior |
| --- | --- | --- |
| Mission Control Academy | Home → Start Mission Control Academy; command search | Five lessons: space versus orbit, staging/mass, altitude/speed, plane change and heat shielding. Predict first, run a calculation/thermal experiment or fly, inspect evidence, save a reflection and export the learning record. Original choices are retained, including incorrect predictions. Completion records participation, not mastery. |
| NASA Data Explorer | Home → NASA Data Explorer; Mission Lab; Academy | Two-world comparison at a shared altitude, speed/period/rotation/density, original radius/μ/rotation fields, source links, units/conversions, gameplay effects, explicit unavailable inputs and JSON export. Defaults compare Earth/Mars. Existing unsourced moon gravity stays labelled. |
| Interactive debrief | Every campaign results screen | Orbit/altitude explanations scoped to Earth orbital goals, unmet objectives, selectable events with nearest recorded telemetry and time offsets, retry action, export and saved evidence/reflection. Missing horizontal speed is explicitly unavailable. Temporal proximity is not treated as proof of causality. |
| First-time experience | Home Academy card → first lesson | An optional tested Orbiter-9 route with a saved prediction, preflight, countdown, guidance, map/periapsis interpretation and debrief. A compact guide follows this specific session through review/flight/results and can be left. Existing play modes remain accessible. |
| Scientific model comparison | Home → Compare physics models; Academy; Mission Lab | Same initial Earth state and selected integrator, unpowered 600 km/55° trajectories, central-only control, J2, third-body, 1PN or combined forces. Bounded 60–21,600 s horizon, difference plot/table, actual sample-time checks, full state/model JSON export, local worker/cancellation and yielding fallback. Differences include numerical error; this is not measured physical validation. |
| Build to Exploration | Hangar → Staging → Fly this build in Exploration | Compatible uncrewed single-stage designs with built-in parts and one liquid propellant become an actual rendered expedition vehicle. Preserve dry mass, fuel, aggregate vacuum thrust/mass-flow-equivalent Isp, battery and solar capacity. Confirm replacement of the saved expedition; enter paused at 200 km around Earth. Save/import/fleet recovery retain the design. |

## Adapter boundaries

Expedition replacement uses one IndexedDB transaction; a failed replacement leaves
the previous pair of records intact. Writable IndexedDB is required for this adapter.

The adapter accepts at most 64 axial parts and rejects radial boosters, decouplers,
fairings, crew/recovery equipment, radiators, custom parts, mixed propellants,
missing control, missing matching fuel and missing batteries. It supplies a
compatible example through the normal undoable design editor.

All engines share a throttle. Minimum throttle is the strictest engine minimum;
vacuum thrust and harmonic mass-flow aggregation preserve the supported propulsion
quantities. Engines with minimum throttle above 15% cannot use the existing fine
rendezvous controller. Fuel transfer requires matching known propellant types.

Electrical capacity/generation are preserved. Base/throttle loads remain the
exploration model's assumed 100/80 W. Attitude control is ideal; aerodynamic area,
thermal protection and hull/contact assumptions remain the exploration model's
assumptions, not a simulation of every imported part. Placement is a sandbox
initial condition, not a flown launch or a campaign achievement.

## Numerical lesson assumptions

The staging experiment uses an explicitly stated ideal two-stage mass model and
320 s Isp, without gravity/drag losses. Plane change uses the instantaneous
same-speed formula rather than a launch-cost estimate. The heat experiment uses
a ten-second prescribed flux, reference AVCOAT properties and assumed backing/
exposed capacities. It is not a measured material calibration or entry prediction.

## Reproduce

- `npm --prefix frontend run test:education`: seven groups, including all eleven
  worlds × three liquid-propellant families, bounded model controls, conservation,
  capacity/restore, import rejection and debrief evidence handling.
- `npm --prefix frontend run test:education:ui`: phone/landscape/desktop UI, sourced
  comparison, Academy reflection, worker comparison, actual adapter rendering,
  fuel/reload and one complete predict→flight→debrief→reflection campaign.
- `npm --prefix frontend run audit:release -- --extended`: includes the new suite
  alongside existing campaign, device, specialist and offline workflows.

See `submission/education-validation.json` and the build-scoped release manifest
for actual completion status. Emulated browser tests are not physical-device or
learner-study evidence.


## Browser evidence

These screenshots come from automated checks with fixture predictions/reflections;
they are not observations from a learner study.

- [Academy experiment and reflection](images/connected-academy-1440.png)
- [Phone NASA Data Explorer](images/connected-data-320.png)
- [Model comparison zero-difference control](images/connected-model-comparison.png)
- [Actual Hangar craft in Exploration](images/connected-hangar-exploration.png)
- [Optional guide on a phone layout](images/connected-guide-phone.png)

## Completed release audit

All 29 release-audit groups passed on 6 November 2026: 309 regressions, 621,913
generated checks, 330 emulated device/world/craft cases, all five lesson records,
one full Academy flight, the existing showcase and offline play. The offline
suite also exercises Data Explorer, the Academy heat experiment and comparison
worker. This does not establish physical-device certification or learner outcomes.
