# Engineering milestone status

Implemented in the current release:

| Milestone | Shipped implementation | Validated boundary |
| --- | --- | --- |
| Ocean loading | 342-constituent station displacement, BLQ import, UT1/TT conventions, hourly plots and optional station link correction | Two independent 24-hour HARDISP series; no global ocean atlas is bundled |
| Mesh fracture | Closed convex triangle clipping, 2/4/8 fragments, exact uniform-density inertia, SAT contacts, angular impulses, friction, rendering and saves | Convex hulls only; prescribed separation energy, not calibrated material crack propagation |
| Complete Wasm engine | Full campaign/fleet simulation source inside QuickJS Wasm, typed NRLMSISE bridge, worker cancellation, state exports, paired parity and renderer handoff | Interpreter backend, not a native-language rewrite; slower measured cases remain opt-in |

The connected learning release includes the five-lesson Mission Control Academy,
NASA Data Explorer, interactive debrief/reflection, first-flight guide, model
comparison and a compatible single-stage Hangar-to-Exploration adapter.

Further research: licensed global ocean atlas ingestion with geographic coverage
checks, calibrated material fracture/concave part geometries, and a native Wasm
port with measured whole-engine performance gains. Physical-device and learner
testing require real participants/devices; browser emulation does not replace them.
Cloudflare deployment and live-origin checks follow publication of this repository.

Everything remains browser-local. No gameplay server or multiplayer is required.
