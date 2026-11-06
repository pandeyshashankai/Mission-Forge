require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { ExplorationSim } = require("../src/sim/exploration");
const { BODY_BY_ID, bodyState, AU } = require("../src/sim/solarSystem");
const { add, sub, len, scale } = require("../src/sim/vec");
const {
  centralGravity,
  j2Acceleration,
  thirdBodyAcceleration,
  occluded,
  solarPressure,
  forceOptions,
} = require("../src/sim/advanced/forces");
const { adaptiveStep } = require("../src/sim/advanced/integrator");
const { updateBattery } = require("../src/sim/advanced/resources");
test("J2 modular acceleration agrees with existing campaign force", () => {
  const { earthGravity } = require("../src/sim/bodies");
  for (const r of [
    [7e6, 0, 0],
    [4e6, 4e6, 4e6],
    [0, 0, 8e6],
  ]) {
    const expected = earthGravity(r, true),
      actual = add(
        centralGravity(r, BODY_BY_ID.earth.mu),
        j2Acceleration(r, BODY_BY_ID.earth.mu),
      );
    assert.ok(len(sub(expected, actual)) < 1e-12);
  }
});
test("third-body differential force removes acceleration of the reference origin", () => {
  assert.equal(len(thirdBodyAcceleration([0, 0, 0], [1e9, 0, 0], 1e14)), 0);
  const a = thirdBodyAcceleration([1e3, 0, 0], [1e9, 0, 0], 1e14)[0];
  assert.ok(Math.abs(a / ((2 * 1e14 * 1e3) / 1e27) - 1) < 1e-5);
});
test("solar pressure is inverse-square, inverse-mass and zero in eclipse", () => {
  const a = len(solarPressure([AU, 0, 0], 100));
  assert.ok(
    Math.abs(len(solarPressure([AU * 2, 0, 0], 100)) / a - 0.25) < 1e-12,
  );
  assert.equal(len(solarPressure([AU, 0, 0], 200)), a / 2);
  assert.equal(len(solarPressure([AU, 0, 0], 100, 8, 1.3, 0)), 0);
  assert.equal(occluded([10, 0, 0], [-100, 0, 0], [0, 0, 0], 2), true);
  assert.equal(occluded([10, 4, 0], [-100, 4, 0], [0, 0, 0], 2), false);
  assert.equal(occluded([10, 0, 0], [100, 0, 0], [0, 0, 0], 2), false);
});
test("Dormand-Prince controls error for a circular two-body orbit", () => {
  const mu = BODY_BY_ID.earth.mu,
    radius = 7e6,
    period = 2 * Math.PI * Math.sqrt(radius ** 3 / mu);
  const first = [radius, 0, 0],
    velocity = [0, Math.sqrt(mu / radius), 0];
  const next = adaptiveStep(first, velocity, 0, period, (r) =>
    centralGravity(r, mu),
  );
  assert.ok(len(sub(next.r, first)) / radius < 1e-6);
  assert.ok(next.rejected > 0);
  assert.throws(() =>
    adaptiveStep(first, velocity, 0, period, () => [NaN, 0, 0]),
  );
});
test("all optional forces integrate, serialize and restore without arming thrust", () => {
  const sim = new ExplorationSim("earth", "pathfinder", 0, 500000, {
    j2: true,
    thirdBody: true,
    srp: true,
    integrator: "accurate",
    power: true,
  });
  for (let i = 0; i < 10; i++) sim.advance(30);
  assert.ok([...sim.r, ...sim.v].every(Number.isFinite));
  assert.ok(sim.integrationStats.evaluations > 0);
  const restored = ExplorationSim.restore(sim.serialize());
  assert.deepEqual(restored.physics, sim.physics);
  assert.equal(restored.batteryWh, sim.batteryWh);
  assert.equal(restored.throttle, 0);
  assert.throws(() => forceOptions({ integrator: "invented" }));
  assert.throws(() => forceOptions({ srp: "yes" }));
});
test("power conserves bounded energy and blackout prevents ignition", () => {
  assert.equal(updateBattery(100, { solarWatts: 0, loadWatts: 100 }, 3600), 0);
  assert.equal(
    updateBattery(1190, { solarWatts: 800, loadWatts: 100 }, 3600),
    1200,
  );
  const sim = new ExplorationSim("earth", "pathfinder", 0, 500000, {
    power: true,
  });
  sim.batteryWh = 0;
  sim.throttle = 1;
  const fuel = sim.fuel;
  sim.advance(1);
  assert.equal(sim.throttle, 0);
  assert.equal(sim.fuel, fuel);
  assert.throws(() => {
    sim.batteryWh = 0;
    sim.startTransfer(800000);
  });
});
const { FleetWorld } = require("../src/sim/advanced/fleetWorld");
test("parked fleet vessels propagate at the active simulation epoch and survive export/import", () => {
  const world = new FleetWorld(),
    entry = world.create("voyager"),
    before = [...entry.sim.r];
  world.advance(30);
  assert.ok(len(sub(entry.sim.r, before)) > 1000);
  assert.ok(Math.abs(world.active.t - entry.sim.t) < 1e-7);
  const restored = FleetWorld.restore(world.serialize());
  assert.equal(restored.entries.length, 2);
  assert.equal(restored.active.throttle, 0);
  restored.switchTo(entry.id);
  assert.equal(restored.active.craft.id, "voyager");
});
test("rendezvous controller closes a 100 metre separation using real propellant", () => {
  const world = new FleetWorld(),
    entry = world.create("pathfinder"),
    initialFuel = world.active.fuel;
  world.startApproach(entry.id);
  for (let i = 0; i < 1000 && world.active.rendezvous; i++) world.advance(0.25);
  const relative = world.relative(entry.id);
  assert.ok(relative.distance < 25, JSON.stringify(relative));
  assert.ok(relative.speed < 0.5);
  assert.ok(world.active.fuel < initialFuel);
  assert.equal(world.approachReady, entry.id);
  assert.equal(world.active.throttle, 0);
  world.dock(entry.id);
  assert.equal(world.links.length, 1);
});
test("docking, fuel transfer and undocking conserve mass and momentum", () => {
  const world = new FleetWorld(),
    entry = world.create("pathfinder"),
    a = world.active,
    b = entry.sim;
  b.r = add(a.r, [10, 0, 0]);
  b.v = add(a.v, [0.1, 0, 0]);
  a.fuel -= 100;
  const m1 = a.craft.dryMass + a.fuel,
    m2 = b.craft.dryMass + b.fuel,
    momentum = add(scale(a.v, m1), scale(b.v, m2));
  world.dock(entry.id);
  assert.ok(Math.abs(a.craft.dryMass + a.fuel - m1 - m2) < 1e-9);
  assert.ok(len(sub(scale(a.v, m1 + m2), momentum)) < 1e-5);
  const fuel = a.fuel + b.fuel,
    wet = a.craft.dryMass + a.fuel;
  world.transferFuel(entry.id, 50);
  assert.equal(a.fuel + b.fuel, fuel);
  assert.equal(a.craft.dryMass + a.fuel, wet);
  const restored = FleetWorld.restore(world.serialize());
  assert.equal(restored.active.craft.dryMass, a.craft.dryMass);
  world.undock();
  assert.equal(world.links.length, 0);
  assert.ok(
    len(
      sub(
        add(
          scale(a.v, a.craft.dryMass + a.fuel),
          scale(b.v, b.craft.dryMass + b.fuel),
        ),
        momentum,
      ),
    ) < 1e-5,
  );
  assert.ok(world.relative(entry.id).distance > 10);
});
test("invalid docking and malicious fleet links reject without mutation", () => {
  const world = new FleetWorld(),
    entry = world.create("lander");
  const before = JSON.stringify(world.serialize());
  assert.throws(() => world.dock(entry.id));
  assert.equal(JSON.stringify(world.serialize()), before);
  const saved = world.serialize();
  saved.links = [[saved.activeId, saved.activeId]];
  assert.throws(() => FleetWorld.restore(saved));
  assert.throws(() => world.transferFuel(entry.id, Infinity));
  const centre=world.active.serialize();centre.r=bodyState('earth',centre.t).r;assert.throws(()=>ExplorationSim.restore(centre));
  assert.equal(require('../src/sim/storage').isValidDesign({name:'Invalid',stack:[{uid:'x',partId:'toString'}]}),false);
  world.remove(entry.id);assert.equal(world.entries.length,1);assert.throws(()=>world.remove(world.activeId));
});
test("Lambert solver recovers a quarter-period circular orbit", () => {
  const { lambert } = require("../src/sim/advanced/lambert");
  const mu = BODY_BY_ID.earth.mu,
    r = 7e6,
    v = Math.sqrt(mu / r),
    t = (Math.PI / 2) * Math.sqrt(r ** 3 / mu);
  const solution = lambert([r, 0, 0], [0, r, 0], t, mu);
  assert.ok(len(sub(solution.departureVelocity, [0, v, 0])) < 1e-6);
  assert.ok(len(sub(solution.arrivalVelocity, [-v, 0, 0])) < 1e-6);
  assert.throws(() => lambert([r, 0, 0], [r, 0, 0], t, mu));
  assert.throws(() => lambert([r, 0, 0], [0, r, 0], -1, mu));
});
test("telemetry remains bounded and exports explicit SI columns", () => {
  const {
    appendTelemetry,
    telemetryCSV,
  } = require("../src/sim/advanced/telemetry");
  const sim = new ExplorationSim();
  for (let i = 0; i < 700; i++) {
    sim.t = i;
    appendTelemetry(sim);
  }
  assert.equal(sim.telemetry.length, 600);
  assert.match(telemetryCSV(sim.telemetry), /^time_s,altitude_m/);
  assert.ok(
    sim.telemetry.every((s) => Object.values(s).every(Number.isFinite)),
  );
});
test("manual control trace replays finite burns, steering and physics changes exactly", () => {
  const { beginRecording } = require("../src/sim/advanced/controlRecording");
  const { replayControls } = require("../src/sim/advanced/controlReplay");
  const sim = new ExplorationSim();
  beginRecording(sim);
  for (let i = 0; i < 60; i++) {
    sim.throttle = i < 30 ? 0.2 : 0;
    sim.pitch = i / 10;
    sim.advance(0.1);
  }
  sim.setPhysics({ ...sim.physics, j2: true });
  for (let i = 0; i < 10; i++) sim.advance(1);
  sim.recording.active = false;
  const replay = replayControls(sim.recording);
  assert.ok(replay.pass, JSON.stringify(replay));
  const modified = structuredClone(sim.recording);
  modified.commands[0].input.throttle = 1;
  assert.equal(replayControls(modified).pass, false);
  modified.commands[0].input.r = [1, 2, 3];
  assert.throws(() => replayControls(modified));
  delete modified.commands[0].input.r;
  modified.commands[0].input.throttle = Infinity;
  assert.throws(() => replayControls(modified));
});
test("ordered automation uses bounded data blocks and manual takeover disarms it", () => {
  const { armProgram } = require("../src/sim/advanced/automation");
  const sim = new ExplorationSim(),
    fuel = sim.fuel;
  armProgram(sim, [
    { trigger: "elapsed", threshold: 0, action: "throttle", value: 0.1 },
    { trigger: "elapsed", threshold: 2, action: "cut", value: 0 },
  ]);
  for (let i = 0; i < 4; i++) sim.advance(1);
  assert.ok(sim.fuel < fuel);
  assert.equal(sim.throttle, 0);
  assert.equal(sim.program.index, 2);
  armProgram(sim, [
    { trigger: "elapsed", threshold: 0, action: "throttle", value: 0.1 },
  ]);
  sim.cancelTransfer();
  assert.equal(sim.program.running, false);
  assert.throws(() =>
    armProgram(sim, [
      {
        trigger: "elapsed",
        threshold: 0,
        action: "executeJavaScript",
        value: "bad",
      },
    ]),
  );
  const restored = ExplorationSim.restore({
    ...sim.serialize(),
    program: { running: true },
    recording: { active: true },
    rendezvous: "bad",
  });
  assert.equal(restored.program, null);
  assert.equal(restored.recording, null);
  assert.equal(restored.rendezvous, null);
  const injected = JSON.parse(JSON.stringify(sim.serialize()));
  Object.defineProperty(injected, "__proto__", {
    value: { navigation: "invalid" },
    enumerable: true,
  });
  const safe = ExplorationSim.restore(injected);
  assert.equal(typeof safe.navigation, "function");
  assert.throws(() =>
    ExplorationSim.restore({ ...sim.serialize(), primary: "toString" }),
  );
});
test("CR3BP Lagrange equilibria have zero acceleration and bounded Jacobi drift", () => {
  const {
    lagrangePoints,
    cr3bpAcceleration,
    propagateCR3BP,
  } = require("../src/sim/advanced/cr3bp");
  const mu = BODY_BY_ID.moon.mu / (BODY_BY_ID.earth.mu + BODY_BY_ID.moon.mu),
    points = lagrangePoints(mu);
  for (const r of Object.values(points))
    assert.ok(len(cr3bpAcceleration(r, [0, 0, 0], mu)) < 1e-8);
  const path = propagateCR3BP({ r: points.L4, v: [0, 0, 0] }, mu, 2);
  assert.ok(path.maxDrift < 1e-9);
  assert.ok(len(sub(path.points.at(-1).r, points.L4)) < 1e-8);
});
test("body-fixed transforms preserve position and velocity on a round trip", () => {
  const { toBodyFixed, fromBodyFixed } = require("../src/sim/advanced/frames"),
    r = [7e6, 1e6, 2e6],
    v = [-1000, 7000, 3000];
  for (const t of [0, 1000, 1e7]) {
    const fixed = toBodyFixed(r, v, t, BODY_BY_ID.earth),
      back = fromBodyFixed(fixed.r, fixed.v, t, BODY_BY_ID.earth);
    assert.ok(len(sub(back.r, r)) < 1e-7);
    assert.ok(len(sub(back.v, v)) < 1e-9);
  }
});
test("data packages create flyable worlds and usable parts without changing standard records", () => {
  const {
    validateLocalBodies,
    validateLocalParts,
  } = require("../src/sim/advanced/localContent");
  const { installLocalBodies } = require("../src/sim/solarSystem"),
    { installLocalParts, PARTS } = require("../src/sim/parts");
  const bodies = [
      {
        id: "local-test",
        name: "Test planet",
        parent: "sun",
        radius: 3e6,
        mu: 2.7e13,
        rotation: 90000,
        a: 1.8 * AU,
        e: 0.03,
        inc: 2,
        node: 0,
        peri: 0,
        L: 210,
        color: "#8ad1c2",
      },
    ],
    base = { ...BODY_BY_ID };
  assert.throws(() =>
    validateLocalBodies([{ ...bodies[0], id: "earth" }], base),
  );
  assert.throws(() =>
    validateLocalBodies([{ ...bodies[0], parent: "local-test" }], base),
  );
  const part = {
    id: "local-tank",
    name: "Test tank",
    category: "tank",
    diameter: 1.8,
    height: 4,
    dryMass: 500,
    cost: 1,
    propellant: { type: "methalox", mass: 8000 },
  };
  assert.equal(validateLocalParts([part])[0].look, "tank_white");
  assert.throws(() => validateLocalParts([{ ...part, height: Infinity }]));
  const earth = BODY_BY_ID.earth;
  try {
    installLocalBodies(bodies);
    installLocalParts([part]);
    const sim = new ExplorationSim("local-test");
    sim.advance(100);
    assert.equal(sim.status, "flying");
    assert.ok(PARTS["local-tank"]);
    assert.equal(BODY_BY_ID.earth, earth);
  } finally {
    installLocalBodies([]);
    installLocalParts([]);
  }
});
test("atmospheric preview computes a dissipative pass without modifying the live vessel", () => {
  const { predictAerobrake } = require("../src/sim/advanced/aerobraking"),
    sim = new ExplorationSim("earth", "pathfinder", 0, 400000),
    before = JSON.stringify(sim.serialize());
  const result = predictAerobrake(sim, 80000);
  assert.ok(result.entered);
  assert.ok(result.maxQ > 0);
  assert.ok(result.energyChange < 0);
  assert.equal(JSON.stringify(sim.serialize()), before);
});
test("normalized zonal harmonic gradient agrees with analytic J2 and tesseral terms rotate", () => {
  const {
    harmonicAcceleration,
    GRAVITY_DATA,
  } = require("../src/sim/advanced/harmonics");
  const c = GRAVITY_DATA.coefficients.find((c) => c.n === 2 && c.m === 0),
    r = [5e6, 3e6, 4e6],
    mu = BODY_BY_ID.earth.mu;
  const actual = harmonicAcceleration(r, mu, 0, BODY_BY_ID.earth.rotation, 2, [
      c,
    ]),
    expected = j2Acceleration(r, mu, GRAVITY_DATA.radius, -Math.sqrt(5) * c.c);
  assert.ok(len(sub(actual, expected)) < 1e-8);
  const first = harmonicAcceleration(r, mu, 0, BODY_BY_ID.earth.rotation, 8),
    later = harmonicAcceleration(r, mu, 5000, BODY_BY_ID.earth.rotation, 8);
  assert.ok(len(sub(first, later)) > 1e-7);
});
test("elastic tidal response scales linearly with Love number and inversely with source distance cubed", () => {
  const { elasticTide } = require("../src/sim/advanced/harmonics"),
    r = [7e6, 0, 0],
    s = [384e6, 0, 0],
    mu = BODY_BY_ID.moon.mu;
  const first = elasticTide(r, s, mu, 6378137, 0.3);
  assert.ok(first[0] < 0);
  assert.ok(
    Math.abs(
      len(elasticTide(r, scale(s, 2), mu, 6378137, 0.3)) / len(first) - 1 / 8,
    ) < 1e-10,
  );
  assert.equal(len(elasticTide(r, s, mu, 6378137, 0)), 0);
});
test("error-controlled propagator matches four actual Orekit trajectories", () => {
  const validation = require("../src/science/advancedValidation");
  for (const row of validation.validateHarmonics())
    assert.ok(row.pass, JSON.stringify(row));
  const rows = validation.validateOrekit();
  assert.equal(rows.length, 4);
  for (const row of rows) assert.ok(row.pass, JSON.stringify(row));
});
test("browser NRLMSISE WASM matches independently compiled native C fixtures", async () => {
  const path = require("node:path"),
    { pathToFileURL } = require("node:url");
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
  const weather = require("../src/sim/advanced/weatherAtmosphere");
  weather.initializeWeatherModel(await factory());
  const rows =
    require("../src/science/advancedValidation").validateAtmosphere();
  for (const row of rows) assert.ok(row.pass, JSON.stringify(row));
  const first = weather.weatherDensity({
      altitude: 400000,
      latitude: 0,
      longitude: 0,
      doy: 180,
      seconds: 43200,
      f107: 70,
      f107a: 70,
      ap: 4,
    }),
    storm = weather.weatherDensity({
      altitude: 400000,
      latitude: 0,
      longitude: 0,
      doy: 180,
      seconds: 43200,
      f107: 250,
      f107a: 250,
      ap: 40,
    });
  assert.ok(storm.density > first.density);
  const sim = new ExplorationSim("earth", "pathfinder", 0, 400000, {
    atmosphere: "msis",
  });
  assert.ok(sim.advance(1) > 0);
});
test("standards-frame matrix matches published ERFA values and preserves round trips", async () => {
  const path = require("node:path"),
    { pathToFileURL } = require("node:url"),
    module = await import(
      pathToFileURL(
        path.resolve(__dirname, "../public/science/models/tsofa/TSOFA.js"),
      ).href
    ),
    frames = require("../src/sim/advanced/precisionFrames"),
    reference = require("../src/science/data/frame-reference.json");
  frames.initializePrecisionFrames(module);
  const matrix = frames.standardsRotation(reference.input);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      assert.ok(
        Math.abs(matrix[i][j] - reference.matrix[i][j]) < reference.tolerance,
      );
  const r = [7e6, 1e6, -2e6],
    back = frames.applyMatrix(
      frames.transpose(matrix),
      frames.applyMatrix(matrix, r),
    );
  assert.ok(len(sub(back, r)) < 1e-8);
});
test("local campaign missions validate constraints and install without altering standard mission goals", () => {
  const { installLocalMissions, getMission } = require("../src/sim/missions");
  const before = JSON.stringify(getMission("first_orbit"));
  try {
    installLocalMissions([
      {
        id: "local-test-orbit",
        name: "Test challenge",
        altitude: 350000,
        inclination: 45,
        budget: 100,
      },
    ]);
    assert.equal(getMission("local-test-orbit").target.altitude, 350000);
    assert.equal(JSON.stringify(getMission("first_orbit")), before);
    assert.throws(() =>
      installLocalMissions([
        {
          id: "first_orbit",
          name: "Bad",
          altitude: 1,
          inclination: 0,
          budget: 0,
        },
      ]),
    );
  } finally {
    installLocalMissions([]);
  }
});
test("builder mass markers agree with wet/dry engineering totals", () => {
  const { geometryAnalysis } = require("../src/sim/advanced/geometry"),
    { layoutDesign } = require("../src/three/partMeshes"),
    { designStats } = require("../src/sim/design"),
    { presetFalconLike } = require("../src/sim/presets");
  const design = presetFalconLike(),
    layout = layoutDesign(design),
    analysis = geometryAnalysis(design, layout),
    stats = designStats(design);
  assert.ok(Math.abs(analysis.wetMass - stats.mass) < 1e-7);
  assert.ok(Math.abs(analysis.dryMass - stats.dryMass) < 1e-7);
  assert.ok(analysis.wetCOM[1] > 0 && analysis.wetCOM[1] < layout.height);
  assert.ok(analysis.thrust > 0);
});
test("coast encounter forecast is bounded and does not mutate the live state", () => {
  const { predictEncounter } = require("../src/sim/advanced/encounters"),
    sim = new ExplorationSim(),
    snapshot = JSON.stringify(sim.serialize());
  const result = predictEncounter(sim.serialize(), "moon", 1);
  assert.ok(result.closest.distance > 0);
  assert.ok(result.samples.length > 1);
  assert.equal(JSON.stringify(sim.serialize()), snapshot);
  assert.ok(result.elapsed <= 3600.00001);
});
test("bundled gravity and empirical/standards models retain pinned source hashes", () => {
  const fs = require("node:fs"),
    path = require("node:path"),
    crypto = require("node:crypto");
  const hash = (file) =>
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const root = path.resolve(__dirname, "../.."),
    gravity = require("../src/science/data/egm96.json");
  assert.equal(
    hash(path.join(root, "frontend/public/science/sources/EGM96.cof")),
    gravity.source.sha256,
  );
  const weather = JSON.parse(
    fs.readFileSync(path.join(root, "data/models/nrlmsise-manifest.json")),
  );
  assert.equal(
    hash(
      path.join(root, "frontend/public/science/models/nrlmsise-browser.mjs"),
    ),
    weather.browserSha256,
  );
  const standards = JSON.parse(
    fs.readFileSync(path.join(root, "data/models/tsofa-manifest.json")),
  );
  for (const file of standards.files)
    assert.equal(
      hash(path.join(root, "frontend/public/science/models/tsofa", file.file)),
      file.sha256,
    );
});
