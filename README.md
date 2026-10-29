# Mission-Forge

By Shashank Pandey.

Build and fly rockets in four missions: First Orbit, Earth Observer, Lunar Orbiter, and Crewed Lunar Flyby & Return.

## Run

Install Node.js 20 or later, then:

```sh
cd frontend
npm ci
npm start
```

Open http://localhost:3000 in a desktop browser with WebGL enabled. No backend, database, account, or API key is needed.

## Build

```sh
cd frontend
npm run build
```

Host `frontend/build` on any static web server. To run the included production build locally, from the project folder:

```sh
python3 -m http.server 8080 --directory frontend/build
```

Open http://localhost:8080. Do not open the HTML directly from disk.

## Play

Choose New Mission, keep the suggested rocket, open Readiness Review, and proceed to launch. Guidance and automatic staging handle ascent. In orbit, use the Map's suggested burns and Execute with guidance for transfers. Increase time warp during long coasts; it slows automatically near burns.

Start on Amateur. Amateur and Intermediate have no random equipment failures. Expert adds equipment faults and tighter budgets. Advanced guidance tuning, manual burn adjustments, and Engineering panels are optional.

Space stages; G toggles guidance; M opens the map; C changes camera. W/S and A/D steer manually; Z/X set full/cut throttle. Save or export designs from the Hangar. Resume flights from checkpoints. Saves stay in your browser.

The game simulates gravity, drag, fuel consumption, staging, Earth/Moon transfers, spacecraft systems, crew supplies, and re-entry limits. It uses approximate vehicle data, patched Earth/Moon gravity, and simplified thermal modelling. Weather and structural loads are not simulated.
