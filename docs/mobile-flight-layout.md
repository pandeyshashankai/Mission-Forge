# Mobile flight visibility

Phone flight uses a dedicated camera window and a separate primary control deck.
The WebGL renderer resizes to that window, so the spacecraft is centred in the
visible area rather than behind the interface. Portrait uses a bottom deck;
landscape places it beside the camera. Desktop instrument layouts are retained.

- Exploration: tap **Instruments & destinations** to open the scrollable drawer.
  Close it to return to the unobstructed view. Steering, throttle and RCS remain
  outside the drawer. Camera tabs still offer Craft, Fleet, Orbit and System.
- Campaign: the sliders button opens the instrument drawer. Altitude, speed and
  throttle stay visible in a compact strip. The camera selector provides Rocket,
  Orbit, Free and Cinema. Steering, full/cut and incremental throttle, RCS,
  guidance and staging remain available in the deck.
- Controls retain pointer capture, simultaneous input, handedness and safe-area
  handling. At the narrowest widths large buttons use the available 44 px targets
  so all controls fit without wrapping over the spacecraft.

Run `npm run test:mobile-visibility:ui` against the production browser session.
The visibility regression checks camera dimensions, an unobstructed canvas centre,
no control/camera intersections, button visibility/hit targets, instrument access
and the desktop layout. It includes 320×568, 390×844, 430×932, 568×320, 844×390,
768×1024 and two notched-screen configurations. These are emulated checks rather
than physical-device certification. Existing multi-touch and end-to-end mobile
flight tests provide complementary input coverage.
