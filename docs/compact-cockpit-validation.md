# Compact cockpit validation — 8 November 2026

Historical check for the first compact layout. The reserved camera rectangle
was subsequently replaced by a full-screen overlay layout; see
[the current flight guide](mobile-flight-layout.md).

The flight interface now places shortcuts in the corners, a vertical throttle
at the side, steering and stage/RCS actions below the camera, and propellant
meters at the lower edge. Its renderer uses the clear camera rectangle. The
phone builder retains a part rail, a blue workspace, quick engineering values
and expandable tools/details. NASA, Academy, Sandbox, Mission Lab and existing
flight/save/camera functions remain available.

## Automated checks

| Command (from frontend) | Result |
| --- | --- |
| `CI=true npm run build` | Production build passed |
| `npm test` | 321 checks passed |
| `npm run test:campaign` | 12 mission/difficulty validations passed |
| `npm run test:cockpit:ui` | 15 camera layouts, native vertical throttle, simultaneous steering, independent release, pause/cut, map, instruments, saves, builder and original menu access passed |
| `npm run test:controls` | 11 groups passed: remapping/persistence, touch/mouse/keyboard, staging, handedness, large controls, safe areas, desktop modes and short-phone failure report |
| `npm run test:mobile-visibility:ui` | 14 layouts, instrument drawers and desktop layout passed |
| `npm run test:ui` | Themes/accessibility, responsive build-to-readiness, four mission preflights/countdowns, seven presets, edit/undo/staging, save/import, all 33 exploration combinations and views passed without uncaught browser errors |
| `npm run test:showcase` | NASA provenance and three benchmarks; prediction, guided launch, successful orbital insertion/report, reflection, JSON export and journal reload passed without uncaught browser exceptions |
| `npm run test:submission` | Public handouts remain absent; removed links/routes stay removed; scientific data remains accessible |

The stock Expert lunar orbiter still exceeds its mission budget; that expected
partial objective is explicitly checked, with the flight inside its reference
envelope. This interface change does not alter the force models or vehicle
performance.

The visibility checks require an unobstructed camera centre, reachable primary
controls and no primary-control intersections with the clear camera rectangle.
The vertical throttle is exercised with native touch events while another
finger holds steering. Camera layouts include 320×568 through 768×1024,
landscape phones, handedness and simulated safe-area insets. Keyboard-only
layout is checked separately from Always-touch mode.

These are local Chromium emulation and simulation checks, not certification of
physical Android/iOS devices or every possible rocket and browser combination.
Retest portrait/landscape on a real phone after the deployed build updates.

See [layout and screenshots](mobile-flight-layout.md) and [controls](controls.md).
