# Engine placement and direction corrections

Free-grid placement previously retained a logical stage link even when a part
was dragged far from its parent. Stage fuel pooling therefore let a floating
engine produce thrust. A saved mount is now treated as a staging relationship;
a separate geometric contact graph determines whether a placed part belongs to
the controlled assembly.

- Disconnected liquid engines and disconnected solid-booster groups cannot fire.
- Disconnected tanks remain loaded inert mass and cannot contribute usable fuel
  to a freshly launched rocket.
- Readiness lists disconnected parts and reports missing connected engine feed.
- Reconnecting the equipment restores its capability without deleting the part.
- Rotated engine force uses the same mesh-to-inertial coordinate mapping as the
  renderer, including the opposite-axis case.
- Saved flights recompute engine/booster connection eligibility on restore.
- Placed engines render individual exhaust at their actual locations, including
  opposed engines that burn fuel while their net force cancels. Disconnected
  engines have no exhaust animation.
- The rocket mesh uses the actual inertial body direction, avoiding a second
  reconstruction against a moving local horizon.

Contact uses rotated build-part bounding boxes with a 0.15 m allowance for grid
rounding. Connected same-stage parts retain the existing shared-feed assumption;
this is not a simulation of individual pipes, valves or nozzle impingement.
Legacy sequential blueprints retain their implicit stack connections. Free-grid
parts may remain in the workspace while disconnected; they are flagged rather
than silently moved or deleted. Unsupported overhangs, overlapping geometry,
asymmetric thrust torque and every possible flight instability are not solved
by this change.

Regression tests cover a floating mounted engine, disconnected tank fuel/mass,
reconnection, and nozzle/force agreement against Three.js at several attitudes
and all quarter-turn engine orientations. The existing rotated-engine test now
places its shorter rotated contact face against the tank rather than leaving a
gap. The native side-booster flight test uses actual touching tank edges and
reconnects its group after testing free movement.

Validation: 352 distinct unit/simulation checks passed (the full 351-check run
plus the added restore/readiness regression), strict production build passed,
and native side-booster construction, reconnection and complete guided orbital
flight passed in Chromium.

The focused phone browser check also passed: imported loose/reconnected engine
layouts display the expected readiness results, and the placed-engine flight
renders individual exhaust without uncaught exceptions. Run it with
`npm --prefix frontend run test:connections:ui`.
