# Verification report — Milestone 2 pass + Milestone 3 (2026-06)

Automated: `cd /app/frontend && CI=true yarn test --watchAll=false src/sim` → 26/26 pass (physics.test.js 23, readiness.test.js 3).

## PASSED
- Physics: atmosphere, rocket eq., orbit shape, energy conservation incl. J2 potential, ascent presets, determinism, underpowered pad hold
- Attitude: torque-free rotation, wheel saturation + RCS unloading; RCS depletion logged
- Maneuvers: Hohmann 200→700 km (osculating Ap/Pe ≈ 689 km with J2), node clears after burn
- Checkpoints: bit-identical continuation; state captured at request time (guidance, maneuver, ω, wheel H, RCS/stage propellant, clock, region, eph, life support, entry); restore loads checkpoint design/profile; resume after full reload (UI, earlier run)
- J2 modelled: SSO 700 km/98.2° node drift numeric 0.990 °/d vs analytic 0.991 vs Sun 0.9856 → Sun-synchronous behaviour is SIMULATED (EO objective added)
- Time warp: identical digest for one big advance vs many 16.7 s chunks across the Moon SOI; caps snap to warp buttons with correct reason toasts (UI)
- Results computed from sim state (lunar orbiter 96/100, crewed flyby success 84/100 in UI runs)
- M3: Lunar Orbiter end-to-end → 100.9 × 99.5 km lunar orbit; crewed flyby free return → EI −6.6°, peak entry 5.3 g, 1.66 MW/m², splashdown 9.5 m/s; entry corridor (−10° crew lost, −3.5° skip-out); life support BVAD rates + O2 depletion → crew loss; readiness crew seats / life support / simulated re-entry
- Camera C-key focus ring fixed; no console errors in 7 Playwright runs; 1920×1080 layout OK

## FAILED / OPEN (minor)
- At 1600×900 the right HUD column needs scrolling for crewed missions
- Free-return MCC search can take up to ~10 s on slow devices (UI shows "Computing…")

## UNTESTED in final build (by testing agent)
- Earth Observer full Hohmann + SSO objective in UI after latest edits (covered by Jest)
- 1366×768 layout; Results page after splashdown in the very latest build

## KNOWN LIMITATIONS (disclosed)
- Patched conics (no simultaneous Earth+Moon gravity, no Sun perturbation); Moon on fixed Keplerian ellipse (no nodal precession); Moon plane aligned to parking orbit at insertion (launch-window assumption)
- Convective heating only (no radiative); ablator mass not subtracted; consumable mass not subtracted
- Coast step ≤ 2 s far from Earth with settled-attitude approximation above 0.1 s steps
