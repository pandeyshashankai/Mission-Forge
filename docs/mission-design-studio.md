# Mission Design Studio

Open **Mission Design Studio** from Home or Search. It runs entirely in the browser and needs no account, backend, API key or live scientific API.

1. Choose an Earth image survey, lunar geology survey or Mars image survey. Read the science objective and required returned-science points.
2. Select the instrument, orbit, arrays, battery, recorder, radio and launcher. Balance credits and delivery mass. Read warnings before launching.
3. Optionally choose 2–4 players on the same device. Each player reviews their assigned responsibilities and approves the design. Every configuration change resets approvals. This is shared-device collaboration, not online multiplayer.
4. Launch after budget, mass and altitude checks pass. Operations account for eclipses, solar generation, battery storage, observation, recorder overflow and ground contacts at one-minute intervals. Pause, advance an hour or simulate to the end.
5. Inspect the hourly telemetry and explanatory debrief. Only transmitted observations count toward science. Change a decision and compare the outcome.
6. Save up to 20 named designs locally, export/import JSON designs, generate a URL-fragment share link or download a report with telemetry and sources. Matching names replace earlier saves. Imports are reviewed before replacing the current configuration; they do not execute code. Share links contain the design itself and open the studio directly. Save explicitly before leaving the studio; running simulations are not persisted.

## Model and provenance

This is an educational trade-study model. It complements the campaign flight simulator rather than replacing it. Launch and transfer are modeled eligibility checks; spacecraft are assumed delivered into circular target orbits. Earth, Moon and Mars use rounded body radii and gravitational parameters and fixed mean solar distances. The UI links NASA CubeSat 101, the Systems Engineering Handbook, JPL physical parameters and NASA Sun facts.

Period uses Kepler's circular-orbit equation; eclipse fraction uses a zero-beta cylindrical-shadow approximation. Solar generation follows inverse-square distance. Energy is integrated in Wh over one-minute steps. The instrument operates only in sunlight; observing and downlinking cannot share the pointing system. Recorder overflow loses data. Mission duration sets the operations cost and an illustrative solar degradation of 0.2% per day.

**All equipment specifications, costs, launcher capacities and target delivery multipliers, contact schedules, science requirements and science weights are game assumptions.** They are not NASA hardware specifications, measured performance or a verified mission design. The model omits transfer propagation, detailed communications links, actual ground-station geometry, weather, orbit decay, terrain occultation and seasonal solar-distance changes. Science points represent transmitted data weighted by objective fit and simplified orbital coverage/resolution; they are not scientific discovery predictions.

## Validation

From `frontend`:

```sh
npm run test:mission-design
CI=true npm run build
```

For the browser check, start the production static server and isolated Chromium as documented in [testing.md](testing.md), then run:

```sh
npm run test:mission-design:ui
```

The browser check exercises all three scenarios, four-player approval/reset, launch restrictions, file import/export, report export, save and comparison, direct shared-link routing, and portrait/landscape layouts. Core tests verify period/eclipse/solar relationships, energy and data bounds, deterministic step equivalence, different design outcomes, achievable scenarios, bounded duration, and schema validation. These are finite automated checks, not evidence of classroom learning or physical-device usability.
