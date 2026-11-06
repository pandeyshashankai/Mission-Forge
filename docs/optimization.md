# Exact-result optimization

The optimization retains the existing display, controls, force models, RK4 and
adaptive integrators, integration limits, warp behavior and numerical precision.
No automatic frame-budget throttling or quality reduction is active.

Harmonic evaluation reuses one scratch workspace across its six finite-difference
samples, computes trigonometric values and radial powers once per sample, and
bounds the cache of normalization constants. Ocean-tide evaluation compiles its
row/group layout while still reading current coefficients and detecting layout
edits; its public result remains a fresh value. Kepler iteration exits only when
an iteration leaves the floating-point anomaly exactly unchanged. It retains the
same twelve-iteration upper bound and arithmetic order.

`npm --prefix frontend run test:optimization` compares these calculations against
frozen pre-change source and nine serialized trajectories. Those snapshots are
regression evidence, not independent physical reference data.

`npm --prefix frontend run test:optimization:profile` runs three pairs of isolated
processes in alternating order. Nine workloads each use ten warmups and 100 advance
requests. All 27 paired final-state SHA-256 hashes and achieved simulation times
must match. The latest release-audit measurement reduced median CPU time by about
59% for the heavy advanced case (78.6 to 31.9 ms), 31% for the central high-warp
case, and 21% for the adaptive high-warp case. See the timestamped raw rounds in
`submission/optimization-validation.json` for the latest measurement.

Timings depend on the machine and workload; small sub-millisecond cases are noisy.
These results do not establish a universal frame rate or physical-device guarantee.
