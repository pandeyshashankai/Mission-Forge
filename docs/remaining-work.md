# Remaining-work register

This consolidates the competitive roadmap, serverless expansion plan and final
audit boundaries. Work remains client-only; accounts, multiplayer and hosted
simulation are excluded by instruction. Items are processed in the order below.

| # | Item | Status |
| --- | --- | --- |
| 1 | Searchable navigation / command palette with modal input isolation | Implemented; regression and dedicated browser checks passed |
| 2 | Repeatable seeded Earth-orbit challenges and safe local installation | Implemented; regression and dedicated browser checks passed |
| 3 | Local logbook, derived achievements, comparison and retained event history | Implemented; regression and dedicated browser checks passed |
| 4 | Configurable gamepad buttons/axes, deadzone, neutral arming and cleanup | Implemented; regression and dedicated browser checks passed |
| 5 | Optional screen wake lock and haptic feedback | Implemented; regression and dedicated browser checks passed |
| 6 | Bounded large replay archive using OPFS when available, with fallback | Implemented; dedicated browser lifecycle/fallback checks passed |
| 7 | Performance evidence and decisions on remaining compute/render architecture | Exact-result optimization and paired benchmarks passed; bounded Wasm/OffscreenCanvas workbench checked |
| 8 | Reconcile stale roadmap/docs and regenerate submission material | Updated scope/controls/optimization documentation; report and presentation rebuilt |
| 9 | Full regression / combinations / device / specialist / offline audit | Passed all 30 audit groups: 321 regressions, 621,913 generated checks, 330 device/world/craft cases, missions and offline play |

## Connected learning recommendations — 6 November

Academy, NASA Data Explorer, interactive debrief, first-flight guidance, model
comparison and restricted Build-to-Exploration are implemented. The full build-scoped
audit passed all 30 groups, including the dedicated education browser flow,
321 regression checks, 621,913 generated cases and 330 emulated device cases.
See [connected learning](connected-learning.md) for entry points and adapter limits.

The three requested milestones now ship bounded, tested implementations: 342-constituent station ocean loading, convex mesh fracture/contact and complete source execution in a QuickJS Wasm worker. See [implemented scope and further research](next-milestones.md).

## External completion requirements

These cannot be represented as completed by adding a button or synthetic test.
They remain explicitly tracked rather than blocking unrelated software work.

- Physical Android/iOS/desktop hardware and GPU testing: the available environment
  provides an emulated Chromium session, not the actual devices.
- Other browser-engine validation: no Firefox/WebKit executable is currently
  installed. Runtime capability fallbacks can be tested here; engine certification
  requires those environments.
- Actual learner study: requires consenting participants and recorded observations.
  The existing protocol is ready; automated examples are not learner evidence.
- General articulated constraints, concave part-level crack propagation and fully
  calibrated material failure laws remain outside the implemented convex hull model.
- Experimental spacecraft thermal calibration and detailed material/fracture laws:
  the supplied papers/screenshots do not contain full matched experimental data.
  The public-evidence collection scope remains closed; assumptions stay labelled.
- A global ocean atlas and worldwide station validation are not bundled. The new
  342-constituent station-loading response is independently checked at two fixtures;
  the truncated gravity model remains separate.
- Longer/current precision ephemerides and real-time EOP: bounded supplied packs
  and explicitly entered frame parameters remain the supported evidence.
- The local implementation is committed and tested from a clean tree. Cloudflare
  deployment and live-origin checks are performed after GitHub publication.

OPFS, WebAssembly and OffscreenCanvas are implementation choices, not scientific
accuracy claims. Architecture work must retain a useful fallback and present
measured scope rather than relabel a small demonstration as a complete physics
or renderer rewrite.
