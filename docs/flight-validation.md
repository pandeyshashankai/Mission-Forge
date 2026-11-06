# Flight and interface validation

Checked on 2026-11-04 with Node.js 24.19.0, npm 11.9.0, and headless Chromium using software WebGL.

## Regression suite

`npm test` runs **195 checks**:

| Group | Checks | Coverage |
| --- | ---: | --- |
| Flight physics and assembly | 11 | Guided launches, vacuum staging, lunar frames, maneuver control handoff, exhausted burns, deterministic checkpoints, energy conservation, duplication, and final-part protection |
| Exploration | 21 | Planet/moon ephemerides, a full revolution at every destination, finite burns, fuel cutoff, time warp, sphere-of-influence transition, impacts, touchdown, and save validation |
| Fleet, preflight, storage, and history | 48 | Every rocket preset, all recommended Amateur preflights, all 33 exploration craft/destination pairs, saved settings/lists, and pure undo/redo history |
| Appearance | 3 | Text and primary-button palette contrast of at least 4.5:1 in Orbital, Nebula, and Daylight |
| Input controls | 13 | WASD/arrows, rebinding conflicts, invalid saved keys, physical modifiers, independent pointers, cancellation state, settings persistence, and exploration RCS save compatibility |
| NASA data, science, and learning | 22 | Original source hashes, all 12 imported radii, 10 gravity parameters, independent Earth/Moon/Mars benchmarks, orbit closure/energy, prediction evidence, and journal persistence |
| Engineering and assisted transfer | 77 | All 178 density bands, signed rotation, independent density/rocket/Hohmann references, drag energy loss, 66 complete finite transfers, cancellation, restore disarming, invalid plans, and powered warp limits |

The palette checks are not a complete accessibility audit. Interface checks also exercise named controls, visible focus styles, theme persistence, readable layouts, and actual pointer targets.

## Mission sequences

`npm run test:missions` completes the four recommended Amateur sequences and requires a successful scored outcome. `npm run test:campaign` repeats them across all three difficulties and verifies the known Expert budget case separately.

| Mission | Sequence | Amateur | Intermediate | Expert stock design |
| --- | --- | --- | --- | --- |
| First Orbit | Launch, staging, 200 km insertion, scoring | Success | Success | Success |
| Earth Observer | Parking orbit, transfer, circularization, payload and sun-synchronous scoring | Success | Success | Success |
| Lunar Orbiter | Parking orbit, TLI, mid-course correction, lunar arrival, insertion, payload scoring | Success | Success | Partial: flight succeeds; stock cost exceeds budget |
| Crewed Lunar Flyby & Return | Parking orbit, TLI, free-return correction, lunar flyby, return corridor, separation, entry, parachutes, splashdown | Success | Success | Success |

The Expert Selene-1 starter costs **$103.7M against an $88.0M budget**. The campaign check requires that budget be its only missed objective. The UI flags the over-budget rocket and requires customisation or an explicit test flight. This is an expected stock-design limitation, not a successful full-score Expert mission.

The mission runner uses the same guidance and maneuver planners as the interface. It does not teleport mission vehicles or refill their fuel. New-orbit placement is tested separately in exploration. Arbitrary designs, every fault recovery procedure, and all manually flown trajectories are not exhaustively covered.

## Browser interface matrix

`npm run test:ui` uses Chromium's pointer input and checks that the intended element is visible and receives the click. It covers:

- All three themes, settings persistence after reload, larger text, and reduced motion.
- Home, mission selection, builder panel navigation, and preflight at **1440, 1024, 768, and 390 px** widths.
- All four recommended mission UI preflights, guidance switches, and countdown hold/scrub.
- All seven rocket presets, including the intentionally incomplete empty probe design and its blocked-launch flow.
- Blueprint selection, duplicate/undo/redo, staging, inspector, and part filters.
- Rocket save/reopen, valid file import, and rejection of an invalid file without replacing the current rocket.
- All **3 spacecraft × 11 destinations** in exploration: starting orbit, system view, and the saved craft/body identity.
- Exploration camera and attitude controls, with no uncaught JavaScript exceptions in the checked flow.

`node scripts/mobile-flight-check.cjs` checks the 390 px flight flow: builder panel switching, part inspection/duplication, preflight, countdown, pause, instruments, orbit map, finish/cancel, report, appearance settings, and exploration. Its report is intentionally a failed mission because the test ends the flight immediately after liftoff; the purpose is to test controls and navigation, not to claim a completed orbital mission on a phone.

`node scripts/browser-check.cjs --full-flight` checks a complete browser launch through automatic staging, stable orbital insertion, and a successful report. It also exercises the instrument toggle, finish cancellation, flight checkpoint save/restore, exploration fuel use, blueprint controls, countdown hold, and pause/resume. The observed First Orbit report scored **100/100**.

Browser checks use a dedicated test profile and clear that profile's site storage. Do not run them against a browser profile containing personal saves. Screenshots are written outside the checkout under `/tmp/mission-forge-ui-screens` and `/tmp/mission-forge-screens`; selected images are included in `docs/images` for review.

## Build and practical limits

`npm run build` produces the static application. No backend, database, account, API key, or remote font service is required. The interface uses local system fonts.

Software WebGL validates rendering and interaction but does not establish performance on a physical GPU, touch-device performance, or parity with mature commercial simulators. The viewport checks simulate screen dimensions in Chromium; they do not replace testing on physical phones or other browser engines.

See [interface review](interface-review.md) for research sources, design decisions, and the defects corrected during this pass.

## Touch and configurable-key controls update — 2026-11-04

`npm run test:controls` exercises the real interface using Chromium touch, pointer, mouse, and keyboard events:

- Saved key remapping, conflict swaps, Escape cancellation, and old-key deactivation.
- Builder pinch/rotate without accidental selection.
- Simultaneous steering/throttle, independent finger release, touch cancellation, full/cut commands, and second-finger RCS taps.
- Remapped staging, cancelled-stage gestures, exactly-once actions, and disabling the final stage.
- Pause, Settings input isolation, paused map navigation, and lost-focus cleanup.
- Portrait phone (390 × 844), landscape phone (844 × 390), portrait tablet (768 × 1024), landscape tablet (1024 × 768), and desktop (1440 × 1000).
- Mirrored steering, larger buttons, and simulated notch/home-indicator insets in both orientations.
- WASD/arrow presets, both Shift keys held independently, and mouse-held on-screen controls.
- Shared exploration controls, saved RCS attitude hold, single-stage behaviour, and automatic/always/keyboard-only visibility.
- A short phone (390 × 650) failed-launch flow with a real touch tap on the unobstructed mission-report button.

The full browser flight was also repeated after the control changes: launch, staging, orbital insertion, and the successful report passed with no uncaught browser exceptions.

These are browser device simulations, not a physical-device certification. Hardware GPU, operating-system gesture handling, browser engines beyond Chromium, and gamepads are not exhaustively validated. The controls target current browsers with Pointer Events and WebGL.


## NASA data and Mission Lab — 2026-11-04

The pinned NASA/GMAT inputs now drive body radii and gravity. `python3 scripts/import_nasa_data.py` checks original-source hashes and reproduces the local subset. `python3 scripts/science_reference.py` generates independent 60-digit two-body benchmarks; `npm run test:science` checks those against the actual game, plus full-orbit closure and energy drift.

The complete 12-case campaign was repeated with these values. All flight sequences pass; stock Expert Lunar Orbiter retains the documented budget-only partial outcome. Lunar return targeting now rejects an otherwise low-perigee solution if its predicted return is outside the nine-day window from the correction node.

`npm run test:showcase` exercises the phone science panel, Moon comparison, downloadable provenance, all three live numerical checks, prediction persistence into preflight, launch, staging, orbital insertion, successful report, measured explanation, reflection, JSON export, and journal reload. The completed run had no uncaught browser exceptions. Its synthetic prediction/reflection are automated test inputs, not student feedback.

The detailed report, printable documents, presentation, and proposed learner-testing protocol are in [the submission pack](submission/README.md). Educational effectiveness remains unmeasured.


## Atmosphere, rotation and finite transfer expansion — 2026-11-04

Seven pinned NASA snapshots are verified. Four provide data and three provide method references. All 12 bodies use linear NAIF rotation periods; Earth/Mars exploration drag uses 178 NASA GMAT density bands. Scored Earth upper density blends from 86–90 km; its existing lower atmosphere and 160 km cutoff remain. The full campaign was repeated with the imported rotation and density values and all 12 validations pass, including the expected stock Expert lunar budget partial.

`test:engineering` runs 77 checks. It completes raising and lowering transfers for all **3 craft × 11 destinations × 2 directions = 66** cases, requiring finite fuel use, no placement/refuelling, an actual coast, confirmation at the held burn window, and an achieved orbit within 1.5 km of the target. This is a checked envelope for short burns from near-circular orbits, not arbitrary transfer accuracy.

The science panel now separates three vacuum orbit benchmarks from six engineering benchmarks. Vacuum checks disable drag deliberately so physical atmospheric energy loss is not misreported as integration error. Separate tests require imported Earth/Mars drag to remove energy relative to an otherwise identical vacuum trajectory.

`npm run test:engineering:ui` exercises phone workbench controls, the speed-squared drag relation, the six independent checks, an actual assisted transfer, coast-window hold, circularization, recorded fuel use and achieved orbit, and keyboard takeover. The archived-data sources and simulator-documentation review are linked in the product and report.
