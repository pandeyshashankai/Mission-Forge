# Pickup/drop assembly and desktop controls validation

The later full-grid studio redesign and its current test results are documented
in [Construction studio validation](builder-studio-validation.md).

## Behaviour

Parts are picked up from the palette and dropped onto the build grid. Attachment
is inferred from position; Above/Below/Beside mode selection is removed. Nearby
joints snap, free side parts retain their offsets, and placed parts can be dragged.
The grid supports pan, scroll, pinch/zoom and Fit. The 3D preview also supports
pan, zoom and Fit, with a larger inspection range for tall vehicles.

Desktop Auto displays the throttle slider/percentage, +/−, Full/Cut, steering,
RCS, guidance, staging and stage fuel directly over the flight scene. Key labels
track actual remapped bindings. Keyboard-only remains an explicit preference.
Phone flight retains its compact control layout.

Side tanks and engines contribute fuel, dry mass, cost, thrust and projected
area to their parent stage. Positions are shared by preview and engineering
calculations. Attachment data survives saved rockets, backups, reusable stages
and compatible single-stage exploration transfers. Side liquid engines render
exhaust and are removed with their parent stage. The retired English and Hindi
1080p videos were removed from the current branch.

## Checks run

| Check | Result |
| --- | --- |
| `npm test` | 329 checks passed, including eight new attachment/propulsion/validation tests |
| `CI=true npm run build` | Passed; full-engine VM artifacts rebuilt from the updated simulation source |
| `npm run test:assembly:ui` | Native palette drag, connected tank/engine placement, increased thrust, moving attachments, pan/zoom/Fit, save/reopen, desktop controls and remapped key hints passed |
| Custom-assembly flight | The side-tank/side-engine rocket completed guided orbital insertion and its successful mission report |
| `npm run test:assembly:mobile` | Native phone pickup/carry/drop, two-finger zoom without accidental edits, tall-rocket top/bottom visibility, scroll/pan/Fit and assistive selection passed |
| `npm run test:controls` | All 11 keyboard/mouse/touch, remapping, staging, safe-area, handedness, dialog and failure-report groups passed |
| `npm run test:cockpit:ui` | All 16 full-screen layout cases passed, including keyboard-only desktop |
| `npm run test:ui` | Themes, accessibility settings, responsive navigation, four mission preflights/countdowns, seven presets, editing/save/import and 33 exploration combinations passed |
| `npm run test:persistence:ui` | Disk persistence, backup preview/merge, tamper rejection, quota-failure atomicity and paused recovery passed |

These are local simulation and Chromium emulation checks, not certification of
all physical devices. Pickup/drop is a 2D grid with a 3D preview and ideal rigid
attachment links. Compatible fuel is shared within a stage and engines use a
common throttle. This does not add independent side-branch separators, individual
engine plumbing or a mesh-contact/weld solver. See [placement/model details](free-placement.md).
