# Flight and exploration design notes

## Direction

Keep the mission game useful for learning a complete flight, while offering a separate place to experiment. Exploration starts in orbit so a player can practice burns around different worlds without completing a launch every time. A new orbit is clearly labelled as a replacement expedition; flying a transfer remains a continuous physical flight with finite fuel.

The workspace separates destinations, the view, and flight instruments. Important controls remain visible. Detailed model limits sit in the flight guide, where they explain what a player can reasonably try. The builder retains its 3D view and adds a selectable blueprint for checking the stack and individual parts.

## Simulator references

The following public project documentation was read on 2026-11-03. These were documentation reviews, not hands-on benchmarks or claims of feature parity. No source code or visual assets were copied from these projects.

| Reference | Documented emphasis | Application here |
| --- | --- | --- |
| [Orbiter](https://github.com/orbitersim/orbiter) | Newtonian flight across the solar system; self-directed goals; ascent, rendezvous, and interplanetary flight | Free exploration alongside the mission campaign, local orbital telemetry, and explicit model boundaries |
| [Pioneer](https://github.com/pioneerspacesim/pioneer) | Open-ended exploration, planetary landings, gravity assists, and a large navigable universe | Destination-led navigation, persistent expeditions, and an exploration loop that does not require a score |
| [CosmoScout VR](https://github.com/cosmoscout/cosmoscout-vr) | Planetary data exploration, full-scale worlds, atmospheric rendering, and level-of-detail geometry | Separate local and system scales, clear scale labels, and restrained rendering costs in a browser |

Spaceflight Simulator's accessible assembly and orbital-map workflow, Kerbal Space Program's construction and maneuver workflow, and Juno: New Origins' engineering focus are also useful product references. Their official sites could not be read in this environment: HTTPS requests received a network-policy denial. Those comparisons reflect established product concepts rather than a current-version review. Their assets, interface layouts, and branding are not reproduced here.

## Physics choices

Scored missions continue using the original Earth/Moon model, J2, detailed atmosphere, finite engines, systems, crew supplies, and re-entry. The NASA data update imports archived GMAT gravitational parameters and NAIF-derived spherical radii. Scored Earth radius is rounded to kilometres; unit conversion and source boundaries are documented in the Mission Lab. Changing lunar gravity exposed and corrected an overly long return-targeting branch. Minimum-throttle insertion corrections use the same partial-step impulse idea already used for maneuver endpoints. This is an idealized control model, not a model of engine restart wear or valve transients.

Exploration uses fixed J2000 mean planetary elements and simplified moon elements. See [JPL's approximate positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html) and [NASA planetary fact sheets](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) for the data families. These elements omit precession and perturbations and should not be used as precision ephemerides.

State is stored in heliocentric metres and metres per second. Integration runs in the governing body's local frame and transforms back using its ephemeris. The smallest containing sphere of influence wins, so a moon's orbit is not swallowed by its parent planet's larger region. Frame changes preserve heliocentric position and velocity. Gravity is patched-conic rather than a full N-body solution.

RK4 step size follows local dynamical time and tightens near surfaces, in atmospheres, and during burns. Propellant flow uses thrust divided by exhaust velocity. Powered flight is limited to real time, while coast warp reports the time actually advanced; excess demand is discarded instead of accumulating an uncontrollable backlog. Surface checks distinguish a gentle airless touchdown from an impact. Gas-giant cloud tops count as vehicle loss.

Atmospheric drag in exploration is deliberately simple. There is no aerothermal model, lift, terrain, autonomous landing, launch-site construction, docking, or transfer optimizer in this mode. The three exploration craft are separate preset vehicles rather than a conversion of arbitrary Hangar designs. Builder-to-exploration integration and interplanetary maneuver planning remain useful next steps.

## Keeping the scope clear

This is a playable solar-system sandbox and a tested mission update. It is not a complete replacement for a mature spaceflight simulator. The complete planet list does not imply every moon, ring particle, terrain feature, or spacecraft system is simulated. The UI describes those limits without blocking ordinary play.

See the [NASA source audit](../data/nasa/README.md) and [project report](submission/project-report.md) for the verified import channel, transformations, scientific checks, and remaining model limits.

## Imported atmosphere and assisted-transfer update

Earth/Mars drag now uses archived NASA GMAT density tables in exploration; scored Earth blends the imported upper density over 86–90 km. Signed rotation periods come from the NAIF linear prime-meridian coefficients. Source-range cutoffs, spherical altitude, and simplified spin axes are explicit model boundaries. Vacuum integration checks disable drag deliberately and are distinct from tests of atmospheric energy loss.

Exploration now provides a finite-burn transfer sequence: first burn, coast-window hold, and pilot-confirmed circularization. The ideal estimate uses a Hohmann half-ellipse, but the actual state is advanced under finite thrust and decreasing propellant. Guards reject unsafe or unsuitable plans, manual input cancels, and restoring a save disarms the plan. See [the reviewed simulator/mission-analysis references](simulator-reference-review.md).

## Exploration visual update

The three fictional exploration vehicles now have distinct original procedural
models: Pathfinder has segmented survey arrays; Wayfarer has side tanks and a
larger transfer engine; Pioneer has four braced landing legs. They are illustrative
models, not replicas or NASA vehicle specifications. Flight mass, thrust and fuel
remain defined by the simulator, independently of geometry. Low graphics uses
12 radial segments; balanced/high uses 24. Geometry checks enforce fewer than
20,000 triangles per craft and verify disposal on replacement.

The craft camera follows steering with frame-time-based smoothing. Switching
views uses a short fade; OS reduced-motion preferences and the in-game Reduce
motion setting disable it and camera smoothing. Pe/Ap labels mark the two apsides
of closed eccentric orbits (e > 0.001); nearly circular orbits suppress unstable
apsis labels. The orbit view enlarges craft for visibility and explains that scale.
Planet textures now rotate at the imported linear periods. Axial tilt and complete
SPICE orientation remain outside this visual model.

Save view exports the current rendered scene as a PNG. It does not include HUD
readouts; use the existing flight report/replay exports for scientific evidence.
A short-range inspection light makes the spacecraft readable on the night side;
this is a visual aid, not a physical light or power-system simulation.

Validation commands: `npm run test:visuals` and `npm run test:visuals:ui`.
The latter uses the same localhost production server and Chromium CDP session
as the existing browser checks. It covers all three craft, PNG output, view
switching, OS reduced motion, phone layout and touch target size.
