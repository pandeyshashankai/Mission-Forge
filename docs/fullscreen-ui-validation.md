# Full-screen UI validation — 8 November 2026

The flight camera fills its workspace on phones, tablets and desktops. Controls
float over the scene with 80% background opacity (20% transparency), while labels
and icons remain opaque. Instruments, saves and camera options open from the
flight menu instead of consuming a permanent strip of the viewport.

The new home page prioritises Mission, Explore, Quick First Orbit and Resume.
NASA Data Explorer, Academy and the laboratories remain directly accessible;
rocket files, recovery, challenges, tutorials, themes, difficulty and offline
preparation remain available. No flight force model or spacecraft parameter was
changed.

## Checks

Commands run from frontend against the production build where applicable:

| Command | Result |
| --- | --- |
| `CI=true npm run build` | Passed |
| `npm test` | 321 checks passed |
| `npm run test:cockpit:ui` | 16 full-screen layouts, five responsive home sizes, original navigation, native multi-touch throttle/steering, map switching, instruments/saves and keyboard-only desktop passed |
| `npm run test:controls` | All 11 groups passed: remapping, held inputs, pointer release, pause/modal isolation, staging, safe areas, handedness, keyboard/mouse/touch and failure-report access |
| `npm run test:mobile-visibility:ui` | All 14 layouts passed, including drawer access and desktop layout |
| `npm run test:ui` | Themes, accessibility settings, mission preflight/countdowns, seven presets, editing, save/import and all 33 exploration combinations passed with no uncaught browser errors |
| `npm run test:labs:ui` | 55 lab/profile cases passed using actual scroll gestures, both directions, bottom reachability and horizontal bounds |
| `npm run test:offline` | Cache cleanup, offline startup, NASA/Academy/model tools, local science/Wasm assets, saved exploration and a complete First Orbit flight through its successful report passed |
| `npm run test:submission` | Removed public submission documents/routes remain unavailable; scientific data remains available |

The camera test compares the renderer's dimensions with its workspace rather
than accepting a smaller reserved rectangle. Primary controls must remain in
bounds and respond to hit testing; the scene centre must remain unobstructed.
Map switching is checked after moving the scope buttons below the view tabs.
Home checks include the smallest phone header so clipped Settings/Search buttons
cannot pass unnoticed.

These results cover Chromium emulation, not certification of every physical
browser/device combination. Check the deployed build on real hardware as well.

[Current screenshots and controls](mobile-flight-layout.md)
