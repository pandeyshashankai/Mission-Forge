# Client expansion validation

Checked 5 November 2026 (Asia/Calcutta), against the production build.

- 289 automated regression checks passed; no failures or skipped tests.
- All 12 campaign envelope cases passed. The stock Expert Lunar Orbiter retains its expected budget-only partial score.
- Six actual Orekit trajectories, eight gravity/relativity vectors, 27 eclipse cases, six native-C atmosphere cases and one published ERFA matrix case and three truncated-ocean coefficient cases passed their stated tolerances (51 total).
- Broader cases passed 48 propagated Lambert arrivals, twelve Earth/Mars atmospheric configurations at two sample rates, six-vessel synchronization, repeated docking/fuel cycles and penumbra power convergence.
- Browser checks passed themes, layouts at 1440/1024/768/390 px, all seven rocket presets, all four campaign preflight flows and all 33 standard explorer/craft destination combinations.
- Keyboard remapping, simultaneous touch pointers, RCS, staging, handedness and safe-area controls passed browser interaction checks.
- First Orbit passed prediction, guided launch, insertion, report, reflection, export and reload.
- Expanded browser checks passed local content, Lambert planning, restricted three-body propagation, standards frames, recording/replay, saved programs, manual cutoff, coast/entry workers, local fleets, docking, conservative fuel transfer and undocking.
- Service-worker installation and offline reload passed with browser networking disabled. Cached source data, local atmospheric/standards models, planning and report/deck PDFs remained usable.
- Production compilation and whitespace checks passed.

Browser tests use Chromium with software WebGL and emulated viewports. Physical phones, other browser engines, learner studies and real-world navigation accuracy remain unverified. Reference comparisons verify the specified simplified configurations; they are not a universal flight-accuracy bound. See `advanced-validation-results.json`, `validation-results.json` and `../client-only-expansion.md`.

Serverless readiness adds native-to-IndexedDB migration, real database readback,
checked backup preview/merge, changed-file rejection, quota-failure atomicity,
read-only secondary tabs, paused flight recovery and an evidence dashboard.
The offline browser audit also completes First Orbit through a successful report
with networking disabled. Full storage contracts and release limitations are in
`../serverless-readiness.md`.
