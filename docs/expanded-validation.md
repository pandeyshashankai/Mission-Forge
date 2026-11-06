# Expanded combination and device validation

This audit extends the earlier 66,916-case catalogue/option audit. The executable
scope is finite and listed below; it is not a claim that every possible rocket,
continuous trajectory, browser or physical device has been tested.

## Reproduce

```sh
npm --prefix frontend run audit:release -- --extended
```

This includes the ordinary release checks and all specialist browser suites.
It requires the documented local static server on port 8080 and isolated Chromium
CDP session on port 9222. It produces a build-scoped
[manifest](submission/release-audit/manifest.json), individual JSON/log results,
and the detailed scenario/device/skip reports in `docs/submission/`.

## Added model matrix

| Group | Axes | Cases |
| --- | --- | ---: |
| Binary switches | All 8,192 masks of 13 switches × 11 worlds × 3 craft × 2 integrators | 540,672 |
| Controls and transitions | 11 worlds × 3 craft × 6 attitude modes × RCS × rotation × drag × 3 throttle levels × full/empty fuel | 9,504 |
| Fleet/material/contact | 11 worlds × 9 ordered craft pairs × 8 contact/docking switch masks × 6 materials | 4,752 |
| Landing/impact | 11 worlds × 3 craft × slow/fast surface-relative impact | 66 |
| Unsupported Sun start | Explicit rejection for all three craft | 3 |
| **Added generated checks** | | **554,997** |

Combined with the previous 66,916 matrix executions, this defines **621,913**
generated checks. The 309 ordinary regression groups and campaign/browser checks
are counted separately.

The binary switches are J2, relativity, damage, advanced tides, ocean harmonics,
elastic tides, third-body gravity, solar pressure, power, communications, drag,
RCS and rigid-body rotation. Each configuration propagates a short powered step,
serializes/restores state, checks flags and vectors, and propagates again.
Controls cases also change force options during flight. Fleet cases dock,
transfer fuel in both directions, save/restore and undock. Calibration inputs
are explicitly synthetic fixtures, not experimental spacecraft observations.

These are short-step compatibility, state and conservation checks. Dependent
flags can be inactive where their parent feature or applicable body is absent.
They do not make an unsupported physical model available on another planet.
Materials, ephemerides, atmosphere models and harmonic degrees also retain their
separate categorical matrix from the previous option audit; the entire product
of all numeric and categorical settings is not exhausted.

## Added browser matrix

All 33 playable world/craft choices run on ten emulated profiles: 320×568,
360×640, 390×844, 430×932, 568×320, 844×390, 768×1024, 1024×768, 1366×768 and
1920×1080. Profiles declare touch capability and device-pixel ratios between
1 and 3. This is **330 world/craft/profile cases**, each with actual control
interaction, rendered canvas, both map views and expedition/active-fleet save
readback. The matrix uses low graphics and reduced motion; separate suites cover
appearance and controls. It does not cross every theme/graphics preference with
every planet/device case.

Skip/cancel tests exercise every step in both tutorials, closing tutorials,
checklist Back, countdown Hold/Scrub, and finish Cancel/Confirm on 320×568,
390×844, 568×320 and 1366×768. Malformed tutorial progress must not prevent startup.
Specialist flows cover phone flight, vehicle systems, materials/contact reload,
TPSX presets, thermal exports, forced empty-vehicle failure and checkpoint restore.
The full learning showcase and successful offline First Orbit run last.

## Defects found and fixed

- Short phone screens allocated almost no height to the Explorer inspector,
  placing the new-orbit button behind the footer. Short layouts now preserve a
  usable inspector and scroll without overlapping the footer. Landscape/tablet
  touch controls occupy a separate grid cell, keeping destination navigation and
  the inspector clear. Narrow touch groups fit within the viewport while retaining
  44 px controls; the audit checks nested workspace overflow as well as page overflow.
- Tutorial hints followed off-screen targets and could hide Skip/Close. Hints
  now stay inside the viewport, measure their height and scroll when necessary.
  Invalid saved tutorial progress is ignored safely.
- Explorer's help text still claimed that docking/heating/transfer assistance
  were absent. It now describes the implemented tools and remaining terrain limit.
- The older browser flow inspected obsolete native-localStorage saves and did not
  await countdown completion. It now checks the actual save adapter and waits for
  the visible countdown to finish.

Actual pass/fail results are recorded in the manifest. Chromium software WebGL
and emulated profiles do not certify real phones, every GPU, other browser engines,
unbounded custom content or long-duration navigation accuracy. Full ocean loading
and experimental thermal calibration remain outside the implemented science scope.

## Completed result

All **29 audit groups passed** on the corrected build. Results include **309
regressions, 12 expected campaign outcomes, 621,913 generated checks, 330
world/craft/device cases and 44 tutorial steps skipped** across the four skip-path
viewports. Every declared world/craft/profile tuple was verified present in the
recorded device report. The successful learning showcase and offline First Orbit
were the last two checks.

[Final summary](submission/final-validation.json) ·
[Command-by-command manifest](submission/release-audit/manifest.json) ·
[Scenario matrix](submission/scenario-audit-results.json) ·
[Device matrix](submission/device-matrix-results.json) ·
[Skip/cancel paths](submission/skip-path-results.json).

The latest run also includes all 16 seeded challenge targets, new local-feature
browser checks and 27 exact-state paired optimization workloads.

The connected-learning release also passes the Academy/Data Explorer/debrief/first-
flight/model-comparison/builder-adapter browser suite on the same build.
