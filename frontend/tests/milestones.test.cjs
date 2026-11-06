require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const loading = require("../src/sim/advanced/oceanLoading"),
  refs = require("../src/science/data/ocean-loading-reference.json"),
  data = require("../src/science/data/loading-stations.json");
const mesh = require("../src/sim/advanced/meshFracture"),
  { add, sub, scale, cross, dot, len } = require("../src/sim/vec"),
  { quaternion } = require("../src/sim/advanced/rigidBody");
const { ExplorationSim, EXPLORERS } = require("../src/sim/exploration"),
  { FleetWorld } = require("../src/sim/advanced/fleetWorld"),
  { forceOptions, groundLink } = (() => ({
    ...require("../src/sim/advanced/forces"),
    ...require("../src/sim/advanced/resources"),
  }))();
const source = () =>
  fs.readFileSync(
    path.resolve(__dirname, "../public/science/models/full-engine.js"),
    "utf8",
  );
const total = (fragments, fn) =>
  fragments.reduce((s, f) => add(s, fn(f)), [0, 0, 0]);
const energy = (f) =>
  0.5 * f.mass * dot(f.v, f.v) + 0.5 * dot(f.L, mesh.meshAngularVelocity(f));
test("all 342 loading constituents match both 24-hour HARDISP reference series", () => {
  assert.equal(loading.loadingModel.rows.length, 342);
  for (const c of refs.cases) {
    const s = data.stations.find((s) => s.name === c.station),
      start = (Date.parse(c.startUt1 + "Z") - Date.UTC(2000, 0, 1, 12)) / 1000;
    for (let i = 0; i < 24; i++) {
      const d = loading.loadingDisplacement(s, start + i * 3600, 66.184);
      assert.equal(d.constituents, 342);
      for (const [k, j] of [
        ["up", 0],
        ["south", 1],
        ["west", 2],
      ])
        assert.ok(
          Math.abs(d[k] - c.samples[i][j]) <= c.toleranceMetres,
          c.station + "/" + i + "/" + k,
        );
    }
  }
});
test("BLQ import preserves units/lag conventions and rejects truncation, duplicates and invalid coordinates", () => {
  const text = fs.readFileSync(
      path.resolve(__dirname, "../public/science/ocean-loading.blq"),
      "utf8",
    ),
    stations = loading.parseBLQ(text);
  assert.equal(stations.length, 2);
  assert.equal(stations[0].coefficients[0][0], 0.00352);
  assert.equal(stations[0].longitude, 11.9264);
  for (const t of ["", text + text, text.slice(0, -40), "hello\n1 2 3"])
    assert.throws(() => loading.parseBLQ(t));
  assert.throws(() =>
    loading.validateLoadingStation({ ...stations[0], latitude: 100 }),
  );
  assert.throws(() => loading.loadingDisplacement(stations[0], Infinity));
  assert.throws(() => loading.loadingDisplacement(stations[0], 0, 201));
});
test("natural admittance splines interpolate and clamp; ECEF transform preserves displacement length", () => {
  const spline = loading.naturalSpline([0, 1, 2], [2, 4, 6]);
  assert.equal(spline(-1), 2);
  assert.equal(spline(3), 6);
  assert.ok(Math.abs(spline(0.5) - 3) < 1e-12);
  assert.throws(() => loading.naturalSpline([0, 0, 1], [1, 2, 3]));
  const d = loading.loadingDisplacement(data.stations[0], 0);
  assert.ok(Math.abs(Math.hypot(d.up, d.south, d.west) - len(d.ecef)) < 1e-15);
  const p = loading.stationPosition(data.stations[0], d),
    base = loading.stationPosition(data.stations[0]);
  assert.ok(Math.abs(len(sub(p, base)) - len(d.ecef)) < 1e-9);
});
test("station loading is explicit in ground-link physics and unsafe reference geography cannot be selected", () => {
  const p = forceOptions({
      communications: true,
      oceanLoading: { station: data.stations[0], ttMinusUt1: 64.184 },
    }),
    sim = new ExplorationSim("earth", "pathfinder", 0, 600000, p),
    link = groundLink(sim.r, 0, p);
  assert.equal(link.stationLoading.constituents, 342);
  assert.equal(link.station, "ONSALA");
  assert.throws(() =>
    forceOptions({
      oceanLoading: { station: data.stations[1], ttMinusUt1: 64.184 },
    }),
  );
  assert.equal(groundLink(sim.r, 0, {}).stationLoading, undefined);
  assert.deepEqual(
    ExplorationSim.restore(sim.serialize()).physics.oceanLoading,
    p.oceanLoading,
  );
});
test("deterministic convex fracture conserves mass, COM, linear/angular momentum and prescribed energy", () => {
  for (const count of [2, 4, 8]) {
    const initial = {
        r: [2000, -3000, 4000],
        v: [200, 1000, -300],
        mass: 123,
        q: quaternion([0.1, 0.3, 0.2, 0.8]),
        L: [1000, -1000, 500],
        half: [1.5, 3, 1.5],
        count,
        energy: 200,
      },
      fragments = mesh.fractureHull(initial);
    assert.deepEqual(fragments, mesh.fractureHull(initial));
    assert.ok(
      Math.abs(fragments.reduce((s, f) => s + f.mass, 0) - initial.mass) <
        1e-10,
    );
    assert.ok(
      len(
        sub(
          total(fragments, (f) => scale(f.r, f.mass)),
          scale(initial.r, initial.mass),
        ),
      ) < 1e-7,
    );
    assert.ok(
      len(
        sub(
          total(fragments, (f) => scale(f.v, f.mass)),
          scale(initial.v, initial.mass),
        ),
      ) < 1e-7,
    );
    const angular = total(fragments, (f) =>
      add(f.L, cross(sub(f.r, initial.r), scale(sub(f.v, initial.v), f.mass))),
    );
    assert.ok(len(sub(angular, initial.L)) < 1e-7);
    const parent = { ...initial, mesh: mesh.boxMesh(initial.half) };
    assert.ok(
      Math.abs(
        fragments.reduce((s, f) => s + energy(f), 0) -
          energy(parent) -
          initial.energy,
      ) < 1e-5,
    );
    fragments.forEach((f) => mesh.validateMesh(f.mesh));
  }
});
test("fracture meshes are closed and malformed/open/non-convex or oversized hulls are rejected", () => {
  const tetra = { vertices: [[0,0,0],[2,0,0],[0,2,0],[0,0,2]], faces: [[0,2,1],[0,1,3],[0,3,2],[1,2,3]] };
  const pieces = mesh.fractureHull({r:[0,0,0],v:[0,0,0],mass:100,hull:tetra,count:4,energy:20});
  assert.equal(pieces.length,4);
  assert.ok(Math.abs(pieces.reduce((n,f)=>n+f.mass,0)-100)<1e-9);
  pieces.forEach(f=>mesh.validateMesh(f.mesh));
  const hull = mesh.boxMesh();
  assert.ok(mesh.validateMesh(hull).volume > 0);
  assert.throws(() =>
    mesh.validateMesh({ ...hull, faces: hull.faces.slice(1) }),
  );
  assert.throws(() =>
    mesh.fractureHull({ r: [0, 0, 0], v: [0, 0, 0], mass: 1, count: 3 }),
  );
  assert.throws(() =>
    mesh.fractureHull({ r: [0, 0, 0], v: [0, 0, 0], mass: 1, energy: 101 }),
  );
  const f = mesh.fractureHull({ r: [0, 0, 0], v: [0, 0, 0], mass: 100 })[0];
  assert.deepEqual(mesh.restoreMeshFragment(f), f);
  assert.throws(() => mesh.restoreMeshFragment({ ...f, q: [0, 0, 0, 0] }));
});
test("convex contacts conserve impulse momentum and elastic energy; friction dissipates energy", () => {
  const make = (r, v, mass) => ({
    r,
    v,
    mass,
    q: [0, 0, 0, 1],
    L: [0, 0, 0],
    mesh: mesh.boxMesh([1, 1, 1]),
    radius: Math.sqrt(3),
  });
  for (const [restitution, friction] of [
    [1, 0],
    [0.1, 0.4],
  ]) {
    const a = make([-1, 0, 0], [1, 0.2, 0], 5),
      b = make([1, 0, 0], [-1, 0, 0], 7),
      p = add(scale(a.v, 5), scale(b.v, 7)),
      before = energy(a) + energy(b),
      contact = mesh.convexContact(a, b);
    assert.ok(contact);
    mesh.resolveMeshContact(a, b, contact, restitution, friction);
    assert.ok(len(sub(add(scale(a.v, 5), scale(b.v, 7)), p)) < 1e-12);
    const after = energy(a) + energy(b);
    if (restitution === 1) assert.ok(Math.abs(after - before) < 1e-10);
    else assert.ok(after < before);
  }
  assert.equal(
    mesh.convexContact(
      make([0, 0, 0], [0, 0, 0], 1),
      make([10, 0, 0], [0, 0, 0], 1),
    ),
    null,
  );
});
test("mesh spin preserves angular momentum and keeps bounded rotational energy drift", () => {
  const f = mesh.fractureHull({
      r: [0, 0, 0],
      v: [0, 0, 0],
      mass: 100,
      L: [5, 10, 15],
    })[0],
    before = energy(f),
    L = [...f.L];
  for (let i = 0; i < 1000; i++) mesh.spinMesh(f, 0.001);
  assert.deepEqual(f.L, L);
  assert.ok(Math.abs(Math.hypot(...f.q) - 1) < 1e-12);
  assert.ok(Math.abs(energy(f) - before) < 0.001);
});
test("gameplay fractures real hulls, advances terminal debris and restores meshes without changing legacy defaults", () => {
  const a = new ExplorationSim("earth"),
    world = new FleetWorld(a),
    b = world.create("pathfinder");
  b.sim.r = add(a.r, [1, 0, 0]);
  b.sim.v = [...a.v];
  world.setMeshFracture(true);
  world.advance(0.001);
  assert.equal(a.status, "crashed");
  assert.equal(a.debris.length, 8);
  assert.ok(a.debris.every((f) => f.mesh));
  const before = a.t,
    position = [...a.debris[0].r];
  world.advance(0.01);
  assert.ok(a.t > before);
  assert.ok(len(sub(a.debris[0].r, position)) > 0);
  const saved = world.serialize(),
    restored = FleetWorld.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.meshFracture, true);
  assert.equal(restored.active.debris.length, 8);
  assert.deepEqual(restored.active.debris[0].mesh, a.debris[0].mesh);
  assert.throws(() => FleetWorld.restore({ ...saved, meshFracture: "yes" }));
});
test("complete Wasm campaign executes staging, guidance, resources and safe save/restore", async () => {
  const { createWasmEngine } = require("../src/engine/fullEngineRunner"),
    { createEngine } = require("../src/engine/fullEngineEntry"),
    { presetFalconLike } = require("../src/sim/presets"),
    { verifyEngine } = require("../src/engine/fullEngineVerification");
  const init = {
    type: "initCampaign",
    design: presetFalconLike(),
    missionId: "first_orbit",
  };
  const report = await verifyEngine(() => createWasmEngine(source()), init);
  assert.ok(report.pass);
  const e = await createWasmEngine(source());
  try {
    e.dispatch(init);
    e.dispatch({ type: "launch" });
    e.dispatch({ type: "advance", seconds: 10 });
    e.dispatch({ type: "stage" });
    const saved = e.dispatch({ type: "snapshot" });
    assert.equal(e.dispatch({ type: "restore", saved }).t, saved.state.t);
    assert.equal(e.dispatch({ type: "report" }).missionId, "first_orbit");
    assert.throws(() => e.dispatch({ type: "constructor" }));
  } finally {
    e.dispose();
  }
  assert.throws(() => e.dispatch({ type: "view" }));
});
test("complete Wasm fleet matches JavaScript across every built-in world and spacecraft", async () => {
  const { createWasmEngine } = require("../src/engine/fullEngineRunner"),
    { createEngine } = require("../src/engine/fullEngineEntry"),
    { BODIES } = require("../src/sim/solarSystem");
  const e = await createWasmEngine(source()),
    native = createEngine();
  try {
    for (const body of BODIES.filter((b) => b.parent))
      for (const craft of EXPLORERS) {
        const init = { type: "initFleet", body: body.id, craftId: craft.id };
        e.dispatch(init);
        native.dispatch(init);
        for (const cmd of [
          { type: "control", throttle: 0.5 },
          { type: "advance", seconds: 0.2 },
          { type: "control", throttle: 0 },
          { type: "advance", seconds: 60 },
        ]) {
          const a = native.dispatch(cmd),
            b = e.dispatch(cmd);
          assert.ok(len(sub(a.r, b.r)) < 0.01, body.id + "/" + craft.id);
          assert.ok(len(sub(a.v, b.v)) < 1e-6);
          assert.ok(Math.abs(a.fuel - b.fuel) < 1e-7);
        }
      }
  } finally {
    e.dispose();
  }
});
test("full Wasm advanced forces, native atmosphere bridge, programmes and mesh contacts retain parity", async () => {
  const { pathToFileURL } = require("node:url");
  const factory = (
    await import(
      pathToFileURL(
        path.resolve(
          __dirname,
          "../public/science/models/nrlmsise-browser.mjs",
        ),
      ).href
    )
  ).default;
  require("../src/sim/advanced/weatherAtmosphere").initializeWeatherModel(
    await factory(),
  );
  const { createWasmEngine } = require("../src/engine/fullEngineRunner"),
    { verifyEngine } = require("../src/engine/fullEngineVerification");
  const initial = {
    type: "initFleet",
    body: "earth",
    altitude: 600000,
    physics: {
      harmonicDegree: 8,
      thirdBody: true,
      tides: true,
      oceanTides: true,
      srp: true,
      relativity: true,
      power: true,
      damage: true,
      atmosphere: "msis",
      integrator: "accurate",
    },
  };
  const report = await verifyEngine(() => createWasmEngine(source()), initial);
  assert.ok(report.pass);
  const e = await createWasmEngine(source());
  try {
    e.dispatch(initial);
    assert.equal(
      e.dispatch({ type: "create", id: "lander" }).vessels.length,
      2,
    );
    e.dispatch({ type: "fracture", enabled: true });
    e.dispatch({
      type: "program",
      blocks: [
        { trigger: "elapsed", threshold: 0, action: "throttle", value: 0.2 },
      ],
    });
    assert.ok(e.dispatch({ type: "advance", seconds: 0.1 }).fuel < 3200);
    const saved = e.dispatch({ type: "snapshot" });
    assert.equal(saved.state.meshFracture, true);
    assert.equal(e.dispatch({ type: "restore", saved }).vessels.length, 2);
  } finally {
    e.dispose();
  }
});
