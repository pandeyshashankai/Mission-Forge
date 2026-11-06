const memory = new Map();
global.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};
require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { hangarCraft, explorationStarter } = require("../src/sim/hangarCraft");
const { ExplorationSim } = require("../src/sim/exploration");
const { FleetWorld } = require("../src/sim/advanced/fleetWorld");
const { PARTS } = require("../src/sim/parts");
const {
  lessonExperiment,
  LESSONS,
  saveLesson,
  readAcademy,
} = require("../src/features/education/academy");
const { buildDebrief } = require("../src/features/education/debrief");
const { compareModels } = require("../src/features/education/modelComparison");
const { localData } = require("../src/persistence/localData");
const { validateArchive } = require("../src/persistence/domain");
const { G0 } = require("../src/sim/constants");
test("five Academy experiments obey their physical relationships and preserve predictions", () => {
  assert.equal(LESSONS.length, 5);
  assert.ok(
    lessonExperiment("altitude", 200).circularSpeed >
      lessonExperiment("altitude", 1000).circularSpeed,
  );
  const stage = lessonExperiment("staging", 500);
  assert.ok(stage.staged > stage.retained);
  assert.ok(lessonExperiment("staging", 0).staged > stage.staged);
  assert.equal(lessonExperiment("inclination", 0).deltaV, 0);
  assert.ok(
    lessonExperiment("inclination", 30).deltaV >
      lessonExperiment("inclination", 5).deltaV,
  );
  const heat = lessonExperiment("heat", 300);
  assert.ok(heat.exposedK > heat.shieldK);
  for (const [id, v] of [
    ["orbit", NaN],
    ["staging", -1],
    ["inclination", 91],
    ["heat", 1001],
    ["altitude", 0],
  ])
    assert.throws(() => lessonExperiment(id, v));
  saveLesson("staging", {
    choice: 1,
    reflection:
      "My prediction was wrong; discarding dry mass improved the calculated delta-v.",
    experiment: stage,
  });
  assert.equal(readAcademy().lessons.staging.choice, 1);
  assert.throws(() => saveLesson("orbit", { choice: 0, reflection: "" }));
  localData.removeItem("mf.academy");
});
test("restricted Hangar adapter conserves mass, vacuum thrust/flow and electrical capacity", () => {
  const d = explorationStarter(),
    p = hangarCraft(d),
    parts = d.stack.map((n) => PARTS[n.partId]);
  assert.equal(
    p.dryMass,
    parts.reduce((s, p) => s + p.dryMass, 0),
  );
  assert.equal(p.fuel, 40000);
  assert.equal(p.power.batteryWh, 6000);
  assert.equal(p.power.solarWatts, 4000);
  const sim = new ExplorationSim("earth", "hangar", 0, 200000, {
    hangarDesign: d,
    power: true,
  });
  sim.throttle = 0.01;
  const before = sim.fuel;
  assert.ok(sim.advance(1) > 0);
  assert.equal(sim.throttle, p.minThrottle);
  assert.ok(
    Math.abs(before - sim.fuel - (p.thrust * p.minThrottle) / (G0 * p.isp)) <
      1e-7,
  );
  assert.ok(sim.batteryWh <= 6000);
  assert.equal(sim.resources().capacityWh, 6000);
  assert.deepEqual(ExplorationSim.restore(sim.serialize()).baseCraft, p);
  assert.equal(ExplorationSim.restore(sim.serialize()).throttle, 0);
  assert.equal(sim.baseCraft.design.name, d.name);
});
test("adapter rejects unsupported structures, fuel mixtures and malformed saves", () => {
  const add = (id) => {
    const d = explorationStarter();
    d.stack.unshift({ uid: "extra", partId: id });
    return d;
  };
  for (const id of [
    "decoupler_37",
    "fairing_37",
    "capsule_1",
    "tank_mono",
    "radiator_panel",
  ])
    assert.throws(() => hangarCraft(add(id)), id);
  const d = explorationStarter();
  d.stack = d.stack.filter((n) => n.partId !== "battery_pack");
  assert.throws(() => hangarCraft(d));
  const sim = new ExplorationSim("earth", "hangar", 0, 200000, {
    hangarDesign: explorationStarter(),
  });
  for (const patch of [
    { fuel: 1e8 },
    { batteryWh: 6001 },
    { hangarDesign: { name: "bad", stack: [] } },
  ])
    assert.throws(() =>
      ExplorationSim.restore({ ...sim.serialize(), ...patch }),
    );
});
test("Hangar craft survives fleet cargo recalculation, backup validation and file roundtrip", () => {
  const sim = new ExplorationSim("earth", "hangar", 0, 200000, {
      hangarDesign: explorationStarter(),
      power: true,
    }),
    world = new FleetWorld(sim);
  world.applyCargo();
  assert.equal(world.active.craft.dryMass, 3475);
  const companion = world.create("pathfinder");
  world.applyCargo();
  assert.equal(world.active.craft.thrust, 981000);
  assert.equal(companion.sim.craft.id, "pathfinder");
  const saved = world.serialize();
  validateArchive([
    ["mf.fleet-world", JSON.stringify(saved)],
    ["mf.exploration", JSON.stringify(sim.serialize())],
  ]);
  const restored = FleetWorld.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.active.baseCraft.power.batteryWh, 6000);
  assert.deepEqual(restored.active.serialize(), sim.serialize());
  restored.applyCargo();
  assert.equal(restored.active.craft.dryMass, 3475);
});
test("debrief distinguishes altitude from orbit without inventing horizontal speed or event causality", () => {
  const result = {
    missionId: "first_orbit",
    summary: { peri: 10000 },
    telemetry: [
      { t: 10, alt: 200, speed: 1000 },
      { t: 30, alt: 250, speed: 1200 },
    ],
    log: [{ t: 19, text: "Stage separated" }],
    objectives: [
      { met: false, label: "Orbit", detail: "Periapsis below target" },
    ],
  };
  const d = buildDebrief(result);
  assert.match(d.title, /intersects/);
  assert.equal(d.timeline[0].sample.t, 10);
  assert.equal(d.timeline[0].sample.offsetSeconds, 9);
  assert.equal(d.timeline[0].sample.horizontalSpeed, null);
  assert.equal(d.missingHorizontal, true);
  assert.doesNotMatch(
    buildDebrief({ ...result, missionId: "crewed_lunar_flyby" }).title,
    /intersects/,
  );
  assert.equal(buildDebrief({}).peakAltitudeKm, null);
  assert.equal(buildDebrief({}).timeline.length, 0);
  assert.match(
    buildDebrief({ ...result, summary: { peri: 200000 } }).title,
    /clears/,
  );
});
test("model comparison has identical initial states/times, zero control, deterministic J2 and guarded bounds", async () => {
  const control = await compareModels({ model: "central", horizon: 600 });
  assert.equal(control.maxDifferenceMetres, 0);
  assert.equal(control.rows.length, 121);
  assert.equal(control.rows.at(-1).t, 600);
  assert.deepEqual(control.rows[0].basic, control.rows[0].advanced);
  const a = await compareModels({ model: "j2", horizon: 600 }),
    b = await compareModels({ model: "j2", horizon: 600 });
  assert.ok(a.maxDifferenceMetres > 1);
  assert.deepEqual(a, b);
  for (const args of [
    { horizon: 0 },
    { model: "__proto__" },
    { integrator: "bad" },
    { altitude: 1 },
    { inclination: 181 },
  ])
    await assert.rejects(() => compareModels(args));
});
test("compatible liquid propulsion works across all worlds and rejects mixed-propellant fleet transfer", () => {
  const { BODIES } = require("../src/sim/solarSystem");
  for (const type of ["kerolox", "hydrolox", "methalox"])
    for (const body of BODIES.filter((b) => b.parent)) {
      const engine = Object.values(PARTS).find(
          (p) => p.engine?.propellant === type,
        ),
        tank = Object.values(PARTS).find(
          (p) => p.category === "tank" && p.propellant?.type === type,
        );
      const design = {
        name: type + " test",
        stack: [
          "probe_core",
          "battery_pack",
          "solar_array",
          tank.id,
          engine.id,
        ].map((partId, i) => ({ uid: "test-" + i, partId })),
        radials: [],
      };
      const sim = new ExplorationSim(body.id, "hangar", 0, undefined, {
        hangarDesign: design,
        power: true,
      });
      sim.throttle = 1;
      sim.advance(0.5);
      assert.ok(sim.fuel < sim.baseCraft.fuel);
      assert.ok([...sim.r, ...sim.v].every(Number.isFinite));
      assert.deepEqual(
        ExplorationSim.restore(sim.serialize()).serialize(),
        sim.serialize(),
      );
    }
  const a = new ExplorationSim("earth", "hangar", 0, 200000, {
      hangarDesign: explorationStarter(),
    }),
    w = new FleetWorld(a),
    e = w.create("pathfinder");
  e.sim.r = [a.r[0] + 10, a.r[1], a.r[2]];
  e.sim.v = [...a.v];
  w.dock(e.id);
  a.fuel -= 20;
  assert.throws(() => w.transferFuel(e.id, 10), /matching known propellant/);
  assert.equal(a.craft.thrust, 981000);
  assert.equal(
    a.craft.dryMass,
    a.baseCraft.dryMass + e.sim.dryMass + e.sim.fuel,
  );
  w.undock();
  assert.equal(a.craft.dryMass, a.baseCraft.dryMass);
});
