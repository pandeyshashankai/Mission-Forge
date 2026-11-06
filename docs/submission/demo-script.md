# Showcase: getting to space versus staying in orbit

Prepared for Shashank Pandey · Astroverse · 4 November 2026, IST.

## Before presenting

- Run the regression, science, campaign, build, and browser showcase checks.
- Use the final production build. Open it locally, keep the laptop powered, and disable notifications.
- A labelled automated flight example is bundled as `submission/showcase-replay.html`, with the full result in `showcase-result.json`. It runs the actual simulator without teleporting or refilling the vehicle. Use it as a recorded example, not as a live browser flight or student result. A video of the actual presentation machine is still useful to record before the event.
- Keep the presentation and PDF report locally. NASA data is bundled; no API key or external connection is required during the demo.
- Rehearse on the actual presentation machine. Check the event's time limit when announced.

## Five-minute presentation with a running demonstration

**0:00–0:35 — Problem.** “Reaching space and reaching orbit are different. Mission Forge lets a learner predict why, test the prediction, and explain the outcome using actual flight evidence.”

**0:35–1:15 — NASA contribution.** Open Mission Lab → NASA data. Show the pinned NASA repository, radius and gravitational-parameter fields, and the unit conversion. Compare Earth with the Moon at the same altitude. Say these are archived inputs, not a live ephemeris.

**1:15–1:40 — Validation.** Open Science checks, run all three cases, and distinguish the independently computed analytic reference from the actual integrator's closure and energy tests. Say what these checks do not cover.

**1:40–2:05 — Prediction.** Open Predict & fly. Choose an explanation and enter a speed estimate. Save the prediction and review the tested First Orbit starter. Do not pretend a preselected answer is participant research.

**2:05 onward — Flight.** Launch and choose ×10. Explain finite fuel, staging, and the need for sideways speed. Let guidance complete the ascent. Rendering speed varies; discuss the architecture or limitations while it runs rather than promising an exact insertion time.

**After insertion — Evidence.** Show the orbit map and periapsis above the atmosphere. Complete the mission, compare the estimate with the reference and nearest recorded sample, save a reflection, and export the result.

**Close.** “The implemented contribution is a traceable path from NASA data to a flight decision and a learning explanation. The next validation is with real learners and physical phones.”

## If the live flight cannot finish within the slot

Switch to the clearly labelled recorded demonstration or exported result. Explain which steps were live and which were recorded. Do not increase physics speed outside supported time-warp controls or modify the vehicle's state to fabricate success.

## Likely judge questions

**Where is NASA data actually used?** Show the source fields, generated SI JSON, and the imported radius/μ in solarSystem, constants, and bodies. Radius changes altitude and the surface boundary; μ changes acceleration and orbital speed.

**Is the model scientifically accurate?** It is an educational model with explicit simplifications. Independent two-body benchmarks and ideal coast integration pass. They do not qualify all atmosphere, transfer, or re-entry behaviour.

**What is innovative?** The integrated prediction, retained misconception, recorded outcome, reflection, and inspectable provenance—not a claim that rocket building or orbital simulation is new.

**Did students learn from it?** A pilot protocol is provided; learning gains have not yet been measured. Show only actual collected feedback when available.

**Will it work without Internet?** The running local build uses bundled data. External citation links need connectivity, but gameplay and numerical checks do not. There is no service-worker installation claim.

**Does every mission pass?** All validated flight sequences should pass after the final checks. Stock Expert Lunar Orbiter deliberately exceeds budget and is expected to earn partial success until customised. Do not call that full-score success.

## Optional engineering demonstration

Use this only if the judging slot allows it. The First Orbit learning loop remains the main narrative.

1. Open Mission Lab → Flight engineering. Switch Earth/Mars and show the NASA density table citation and units.
2. Keep altitude fixed and double air-relative speed. Dynamic pressure increases by four, demonstrating the q = ½ρv² relation. Explain that this is an archived model, not live weather.
3. Change propellant and dry mass to show the ideal rocket equation. Explicitly identify these slider inputs as hypothetical, rather than NASA engine measurements.
4. In Explore freely, open Orbit transfer, choose a nearby safe target, and start the first burn. Show finite duration and falling fuel.
5. During the coast, select ×1,000. At the held burn window, confirm circularization and show the achieved apoapsis/periapsis. Manual steering cancels assistance.
6. Explain the limits: near-circular coplanar starts, short-burn estimate, source-range atmosphere cutoffs, simplified axes, and no high-precision ephemeris claim.
