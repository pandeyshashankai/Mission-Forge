# Reference-led interaction update — 9 November 2026

MissionForge uses original code and artwork. This review uses the user's supplied
Spaceflight Simulator footage to identify interaction patterns, while preserving
MissionForge's NASA data, 3D physics, missions and learning tools. No reference
video, screenshot, music, interface artwork or game asset is distributed here.

## What was actually reviewed

All four supplied clips were inspected through their full duration at one-second
intervals, alongside the previously supplied beginner construction walkthrough.
This is visual inspection of recorded footage, not a hands-on audit of the app.

| Supplied clip | Duration | Useful observations | Evidence limits |
| --- | --- | --- | --- |
| New SFS Update! 1.5.6 | 89.6 s | Build/resume, world/save lists, blueprint actions, move whole rocket, revert | News footage and commentary do not establish every released behavior |
| New Update and New Features 1.5.7 | 77.9 s | Builder mirror/flip, edge flight controls, map, recovery and summaries | Includes promotional/narrated feature claims |
| SPACEFLIGHT SIMULATOR 1.6 FULL GAMEPLAY | 157.8 s | Planet/terrain views, flight layout, build and pause menus | A news/mod montage rather than a complete unmodified playthrough |
| 25 NEW PLANETS 1.6 Release | 201.3 s | Planet overview presentation and uncluttered scene | Ends with “1st April”; mod/meme content is not evidence of a released 25-planet feature |

Public sources requested for a later cross-check:
[Google Play](https://play.google.com/store/apps/details?id=com.StefMorojna.SpaceflightSimulator),
[official site](https://spaceflightsimulator.app/),
[Steam](https://store.steampowered.com/app/1718870/Spaceflight_Simulator/).
Live web access was blocked by this environment's restricted proxy. A narrow
network configuration draft was saved for review; these pages were **not read**
and are not presented as confirmation of current store features.

## Implemented interaction coverage

| Area | MissionForge behavior |
| --- | --- |
| Home | Direct blank-rocket entry; prominent mission and exploration paths; separate resume building/flight; NASA, Academy and Sandbox remain visible |
| Construction | Full grid, continuous palette drag/drop, center grip, pan, pinch/wheel zoom, Fit, magnetic attachment, mirrored side propulsion, thin selection, copy/move/rotate/flip/delete, undo/redo |
| Whole rocket | Tools → Select whole rocket, or Ctrl/Cmd+A outside text/settings/search; existing group operations apply |
| Flight framing | Side profile default for fresh settings, with near-parallel perspective; 3D, cinematic, free and map remain selectable; map returns to the preceding craft view |
| Flight camera input | Wheel zoom in Side/3D; side view drag to pan, two-finger pinch, Focus to reset; projected craft dimensions include rotation and deployed canopy |
| Controls | Existing edge throttle, full/cut, steering, stage, RCS, guidance and warp on desktop/touch; existing remapping retained |
| Readability | Surface speed below 100 km; orbital speed above, explicitly labelled; detailed instruments keep both quantities |
| Recovery appearance | Canopy/rigging inflate from the existing drogue/main state and drag area; heat glow follows computed stagnation heat flux |
| Recovery flow | Report, Edit rocket and Retry launch; editing/retrying records the completed attempt and clears the old pending checkpoint |
| Exploration | Side/3D craft switch, existing Fleet/Orbit/System views and all scientific controls retained |
| Persistence | Existing local blueprints, checkpoints, recovery, export/import and offline preparation remain |

The side view is a camera over the existing three-dimensional simulation, not a
new planar force model. One equivalent parachute canopy depicts the pack's total
drag area; it is not a calibrated fabric simulation or exact Apollo canopy array.
Heating glow is explanatory artwork, not a spectroscopic plasma calculation.

## Scope and verification boundaries

This is an interaction and presentation update, not a claim that every behavior
of a commercial app has been cloned. Paid packs, mod-only planets and joke-video
features are not treated as requirements. Existing scientific provenance and
model limitations continue to apply. Physical Android/iOS testing and the exact
Cloudflare deployment require a device/live-origin check after deployment.

See `sfs-interaction-validation.md` for checks run against this revision.

## Higher-resolution reference, November 9

Reviewed the supplied 157.77-second 720p clip using contact sheets spanning the
whole video. It contains a solar-system/news montage, a mod loader and custom
parts; it is not evidence of a complete stock-game mission workflow. The supplied
rocket image is useful for reading engine feed lines, nozzle rims and visible
payload interiors.

This refinement adds original pump fittings, paired feed-line supports and a
nozzle rim to the shared palette/blueprint engine drawing. The existing **Show
fairing interior** option now also makes the 2D shell translucent; **Hide** restores
it. It retains the shell outline and full selection target. This is an inspection
view, not physical shell removal or fairing jettison. The 3D inspection option
continues to use its existing translucent shell. No source-game artwork is bundled.

Validation: strict production build; 18 visual/studio geometry checks; native
builder flow across five viewport sizes, group operations, safe-area controls,
3D preview and save/resume. A separate browser check exercises the fairing toggle
on phone and desktop. These are browser-emulated layouts, not physical-device
certification. Propulsion, dimensions, mass and thermal behavior are unchanged.
