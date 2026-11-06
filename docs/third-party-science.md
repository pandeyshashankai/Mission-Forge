# Scientific sources and model attribution

MissionForge's gameplay and user interface are authored for this project. The
following scientific data, libraries and external reference tools retain their
original authorship and licenses. None implies endorsement of MissionForge.

## NASA / GMAT / JPL-NAIF

The original seven planetary/atmosphere/method snapshots and the additional
`EGM96.cof` come from NASA's official GMAT repository, pinned at
`c9b78bd1c8499845cb78fde315e1f761b6b06f1c`. Original files and notices remain under
`data/nasa/`; downloadable originals are under `frontend/public/science/sources/`.
The GMAT license remains `LICENSE-GMAT.txt`.

EGM96 original SHA-256:
`4735c9301e20ee8db09b6d0882a24671b327cd35ec5740ea497c8eeb43a39807`.
The full original degree/order-360 file is preserved; gameplay uses its 42
non-central degree/order-8 coefficient pairs. The archive header identifies a
1986 epoch. Runtime harmonics retain the current body's imported μ and use the
coefficient file's normalization radius. `scripts/import_gravity.py` reproduces
the subset, with optional `--fetch` for the pinned original.

## NRLMSISE-00

The empirical model was developed by Mike Picone, Alan Hedin and Doug Drob.
Dominik Brodowski authored the C implementation. Native validation preserves the
C source and documentation from `magnific0/nrlmsise-00` at
`a5f81be6c8802e9014f94457b41d3484673e0bfb`. Source files and their hashes are in
`data/models/nrlmsise-native-sources.json`; original headers and documentation are
retained. This code is unchanged.

The browser uses the WebAssembly port published as `nrlmsise-00@1.0.10` by the
DigitalArsenal repository. Its npm integrity value and original/derived hashes
are in `data/models/nrlmsise-manifest.json`. The port's Apache-2.0 license remains
in `LICENSE-NRLMSISE.txt` in both source and public model directories.

The only adaptation to its JavaScript loader removes the Node `createRequire`
header and sets `ENVIRONMENT_IS_NODE=false`. Embedded WASM bytes are unchanged.
The original loader is retained as `data/models/nrlmsise-interface-original.mjs`.
The derived loader is `frontend/public/science/models/nrlmsise-browser.mjs`.
It loads no atmosphere service. Weather indices are explicit local inputs, not
live NASA observations.

## TSOFA / IAU SOFA / ERFA

The standards-frame workbench uses **unchanged** JavaScript distribution files
from `@tsastro/tsofa@18.1.0`, authored by Paul Harrison, University of Manchester.
TSOFA is a TypeScript transcription derived from the IAU SOFA library. All five
JavaScript files are preserved with SHA-256 values in
`data/models/tsofa-manifest.json`.

Although npm metadata labels the package MIT, the distributed `LICENSE.txt`
contains the actual SOFA-derived terms. That file is preserved unchanged,
including its original encoding, under `frontend/public/science/models/tsofa/`.
`LICENSE-readable.txt` is an encoding-only readable copy of the same text.

MissionForge uses computations derived from IAU SOFA through TSOFA. MissionForge
is not software supplied or endorsed by SOFA. Its own wrapper adds bounded input
validation and a workbench interface; it does not modify the library routines.
No ownership of the original algorithms is claimed. The original license terms
continue to apply to redistribution and modification of those components.

The matrix reference values come from the published ERFA C test `t_c2t06a`, pinned
at commit `1a8044cde5b7763295d472a6443387239127c6c8`. The source URL and whole-file
hash are recorded in `frame-reference.json`. Reference-test TT/UT1/polar-motion
values are not claimed to be current observed Earth orientation.

## Orekit / Hipparchus

Actual reference trajectories and non-central gravity vectors were generated
using **Orekit 13.1.9** and **Hipparchus 4.0.3**, both Apache-2.0 projects, through
JPype1 1.7.1. Maven URLs, versions and hashes are pinned in
`scripts/reference/orekit-dependencies.json`. Jars are development cache files,
not game runtime dependencies or embedded simulation services.

`generate_orekit.py` records epoch, frame, forces, integrator, tolerances and
initial state. Central cases use Orekit's analytical Keplerian propagator; the J2
trajectory uses its numerical Dormand–Prince 8(5,3) implementation; gravity vectors
use Holmes–Featherstone with the NASA-archived normalized EGM96 coefficients.

These results validate matched configurations and numerical implementations.
They do not establish real-mission navigation accuracy, learning effectiveness,
full ocean-tide fidelity or comprehensive validation of every combined option.
