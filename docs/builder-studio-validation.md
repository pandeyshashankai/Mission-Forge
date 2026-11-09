# Construction studio validation — 8 November 2026

The supplied 59.97-second reference was reviewed across the full sequence:
initial capsule/chute construction, stable zoom, mirrored deployed legs,
interstage and lower-stage construction, paired liquid boosters and nose cones,
rectangle selection, copying/moving groups, orientation tools, RCS and launch.
MissionForge implements that workflow with original vector artwork and its own
existing part/flight models.

| Check | Result |
| --- | --- |
| `npm test` | 343 passed: 329 existing checks and 14 studio/landing/rotation/scenery checks |
| `CI=true npm run build` | Passed with warnings treated as errors; simulation VM artifacts regenerated |
| `npm run test:studio:ui` | Native reference-style build from a blank draft; stable camera; mirrored real propulsion; deployed gear; group copy/rotate/undo/delete; five device layouts; notch-safe controls; 3D preview; empty and completed design resume |
| `npm run test:assembly:mobile` | Native palette pickup/carry/drop, two-finger zoom without edits, tall-rocket Fit, zoom/scroll pan and assistive selection |
| `npm run test:assembly:ui` | Native side tank/engine assembly, real thrust increase, moving connected equipment, pan/zoom/Fit, save/resume, remapped desktop controls and a successful guided orbital flight/report |
| `npm run test:controls` | All 11 keyboard/mouse/touch, remapping, staging, simultaneous-pointer, safe-area and failure-report groups passed |
| `npm run test:cockpit:ui` | All 16 full-screen flight layouts passed; home/navigation and original instruments remain accessible |
| `npm run test:ui` | Three themes, text/motion settings, four responsive widths, all four mission preflights/countdowns, seven presets, editing and save/import flows, and all 33 exploration craft/destination combinations passed |
| `npm run test:persistence:ui` | Disk persistence, backup preview/merge, tamper rejection, atomic quota-failure handling and paused recovery passed; no public submission entry point |
| `npm run test:catalogue:ui` | All 41 individual parts, 40 grouped non-radial parts and three solid-booster symmetry configurations rendered: 84 assemblies; two invalid grouped imports rejected; no uncaught exceptions |
| `node scripts/mission-check.cjs first_orbit` | Existing stock orbital mission completed with the updated simulation |

The initial ten added unit cases cover empty drafts across all missions, absolute
position preservation, mirrored propulsion, group graph copying/transforms,
rotated/reversed thrust, new-part save validation, soft/hard/folded-gear landing
outcomes, mixed legacy/editor poses, safe solid-group deletion, exploration
adapter orientation restrictions and Moon-relative touchdown normals.

Browser tests use Chromium with native pointer/touch input and viewport/cutout
emulation. Physical phone testing remains separate. The builder's attachment,
staging, shared-fuel and approximate landing-model limits are documented in the
[studio guide](builder-studio.md).

## Drag-only follow-up

Palette placement requires one continuous mouse/finger drag and release on the
grid. Tap-to-pick-up/tap-to-place was removed. The phone regression explicitly
checks that tapping the palette and then the grid does not add equipment, before
performing a native continuous finger drag. It also checks that releasing
outside the grid cancels and releasing a second finger cannot drop the active
finger’s part.

## Recorded shrinking/tap follow-up

The supplied 17-second recording shows the earlier permanent-header builder.
The current native drag audit compares every reference-build part's preview and
placed artwork bounds (within one pixel) while checking an unchanged camera.
The phone audit verifies no floating preview on a stationary tap, no tap-to-place,
outside-drop cancellation and independent finger release.

The production build passed with warnings treated as errors. The mobile and
full-studio audits passed. `test:offline` passed, including a complete offline
First Orbit and lazy scientific tools. `test:offline:update` served two distinct
real build identities on one origin: the update prompt appeared, the installed
package stayed consistent until applied, the new page reloaded, the previous
cache was removed and the saved rocket was preserved. Both offline audits are
part of the browser release pipeline.

## Magnetic connections and launch-station update

Four further unit cases verify assembly snapping with an unsnapped override,
reconnection of a side engine to a new tank, and finite instanced station
geometry under a bounded batch budget, and black-edge selection without
accumulating outlines across frames. The complete 343-check suite passed.
The final texture build passed with warnings treated as errors, and all 14
studio tests passed again.

`test:magnets:ui` uses real mouse and finger drags to verify that attraction is
visible before release, tank edges meet after release, attached engines retain
their relative positions, and selection is a one-pixel black unfilled border.
The detailed station renders in phone and desktop flight views without uncaught
errors. The full reference-build studio audit and mobile gesture audit passed.
The magnetic browser check is included in the release pipeline.

## Intermittent browser highlight follow-up — 9 November 2026

The app-wide keyboard-focus rule also reached focusable SVG parts. The studio
now suppresses the additional browser halo, native tap flash and text-selection
callout over parts. Keyboard focus selects the part using its existing one-pixel
black SVG border, rather than adding a second outline. Palette keyboard focus
keeps a one-pixel outline; text fields and the rest of the application's focus
styles remain available.

The strict production build passed. The magnetic browser audit now verifies
computed pointer/touch outline and tap-highlight styles, prevented workspace
context menus, and keyboard focus with the single SVG border. Native mobile
pickup/drop, cancellation, multi-touch, magnetic assembly and the complete
reference-build studio audit also passed. These checks do not test or control
phone-level touch indicators drawn outside the web page.
