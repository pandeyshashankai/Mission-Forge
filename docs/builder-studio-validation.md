# Construction studio validation — 8 November 2026

The supplied 59.97-second reference was reviewed across the full sequence:
initial capsule/chute construction, stable zoom, mirrored deployed legs,
interstage and lower-stage construction, paired liquid boosters and nose cones,
rectangle selection, copying/moving groups, orientation tools, RCS and launch.
MissionForge implements that workflow with original vector artwork and its own
existing part/flight models.

| Check | Result |
| --- | --- |
| `npm test` | 339 passed: 329 existing checks and 10 studio/landing/rotation checks |
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

The ten added unit cases cover empty drafts across all missions, absolute
position preservation, mirrored propulsion, group graph copying/transforms,
rotated/reversed thrust, new-part save validation, soft/hard/folded-gear landing
outcomes, mixed legacy/editor poses, safe solid-group deletion, exploration
adapter orientation restrictions and Moon-relative touchdown normals.

Browser tests use Chromium with native pointer/touch input and viewport/cutout
emulation. Physical phone testing remains separate. The builder's attachment,
staging, shared-fuel and approximate landing-model limits are documented in the
[studio guide](builder-studio.md).
