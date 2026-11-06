# Simulator and mission-analysis references

Reviewed on 4 November 2026. These are documentation reviews, not hands-on performance benchmarks or evidence of parity with commercial simulators. No simulator art, branding, or implementation was copied.

## Sources actually read

- **NASA GMAT, Simple Orbit Transfer tutorial**, pinned NASA repository: [tutorial](https://github.com/nasa/GMAT/blob/c9b78bd1c8499845cb78fde315e1f761b6b06f1c/doc/help/src/Tut_SimpleOrbitTransfer.xml). It describes a first burn, coast to the opposite apsis, and second circularization burn. Applied as a visible three-step exploration assistant, with a confirmation at the circularization window.
- **NASA GMAT, ImpulsiveBurn reference**: [reference](https://github.com/nasa/GMAT/blob/c9b78bd1c8499845cb78fde315e1f761b6b06f1c/doc/help/src/Resource_ImpulsiveBurn.xml). Local directions and fuel depletion informed the explicit prograde/retrograde labels and fuel accounting. Our actual assisted burns are finite-thrust integrations, rather than instantaneous state changes.
- **Orbiter Space Flight Simulator, public README**, repository HEAD `9721ab8d5ba4c30ed18d2a8921ee8b3e867882b8`: [README](https://github.com/orbitersim/orbiter/blob/9721ab8d5ba4c30ed18d2a8921ee8b3e867882b8/README.md). Its documented emphasis is Newtonian solar-system flight, self-directed goals, and learning ascent and transfers. Applied as optional flight tools inside the existing free-exploration mode, without adding a score requirement.

## Product decisions

The assistant exposes the next useful action rather than adding another panel of unnamed keys: start the first burn, coast with supported time warp, confirm circularization, and inspect the achieved orbit. Manual control cancels assistance. Saves restore with the engines off and no armed transfer. Near-circular starts, fuel margin, body sphere of influence, and short-burn applicability are checked before arming.

The engineering workbench keeps model experiments separate from spacecraft specifications. Slider values are explicitly hypothetical; it does not describe a fictional game's engine as measured NASA hardware. Atmospheric plots use the imported NASA tables with visible units, and differentiate archived reference models from live weather.

Kerbal Space Program and Spaceflight Simulator remain useful general product references, but their current official sites were not retrieved under this environment's network policy. No current-version feature comparison is claimed.
