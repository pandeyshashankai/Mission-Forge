# Changelog

## 1.0.0 — 2026-10-29

The first packaged release of Mission-Forge, focused on Earth-orbit and lunar gameplay.

### Included

- Four missions: First Orbit, Earth Observer, Lunar Orbiter, and Crewed Lunar Flyby & Return.
- A 3D Hangar with rocket assembly, staging, presets, part inspection, and undo/redo.
- Pre-flight readiness checks and an engineering advisor.
- Assisted ascent, automatic staging, manual controls, orbital maps, maneuver planning, and time warp.
- Earth/Moon flight physics, spacecraft systems, crew supplies, re-entry, and recovery.
- Mission scoring, charts, recommendations, local design saves, import/export, and flight checkpoints.

### Refined

- Mission-selected guidance targets and optional advanced ascent tuning.
- A compact flight interface with detailed systems behind the Engineering toggle.
- Suggested maneuvers with optional manual burn adjustments.
- No random equipment faults in Amateur or Intermediate; Expert retains seeded faults.
- Compatibility checks for supported saved missions and imported rocket designs.
- A standalone browser build without a backend or database.

### Repository

- Project metadata and authorship for Mission-Forge by Shashank Pandey.
- A complete README with screenshots, setup, controls, hosting instructions, and model scope.
- Source, assets, dependency lockfile, and required build configuration.

### Validation

Before packaging, all 35 simulation and compatibility checks passed. A fresh dependency installation and production build passed, and the browser flow from menu to mission report completed without JavaScript errors. Test files and development reports are not included in this release.
