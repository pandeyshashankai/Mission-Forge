require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { isValidDesign } = require("../src/sim/storage");
const make = () => ({
  name: "Valid booster craft",
  stack: [{ uid: "parent", partId: "tank_k_37_m" }],
  radials: [
    { uid: "booster", parentUid: "parent", partId: "srb_63", symmetry: 2 },
  ],
});
test("craft import requires unique part identifiers across axial and radial groups", () => {
  const d = make();
  assert.ok(isValidDesign(d));
  d.radials[0].uid = "parent";
  assert.equal(isValidDesign(d), false);
  const e = make();
  e.radials.push({ ...e.radials[0] });
  assert.equal(isValidDesign(e), false);
});
test("craft import rejects empty identifiers and radial-only parts on the axial stack", () => {
  const d = make();
  d.stack[0].uid = "";
  assert.equal(isValidDesign(d), false);
  const e = make();
  e.stack[0].partId = "srb_63";
  assert.equal(isValidDesign(e), false);
});
test("craft import rejects invalid radial counts, unknown parents and unknown part IDs", () => {
  for (const patch of [
    { symmetry: 5 },
    { parentUid: "missing" },
    { partId: "toString" },
  ]) {
    const d = make();
    Object.assign(d.radials[0], patch);
    assert.equal(isValidDesign(d), false);
  }
});
test("calibrated fleet companions retain independent observations and survive whole-world reload", () => {
  const { ExplorationSim, EXPLORERS } = require("../src/sim/exploration"),
    { FleetWorld } = require("../src/sim/advanced/fleetWorld"),
    { calibrateThermal } = require("../src/sim/advanced/materials");
  const records = Array.from({ length: 12 }, (_, i) => {
    const temperature = 300 + i * 20,
      rate = 0.2 + i * 0.02;
    return {
      temperature,
      rate,
      flux:
        (180000 * rate +
          0.8 * 5.670374419e-8 * 8 * (temperature ** 4 - 300 ** 4)) /
        8,
    };
  });
  const calibration = calibrateThermal(records, {
    source: "Synthetic fleet regression fixture, not measured spacecraft data",
  });
  assert.throws(
    () =>
      new ExplorationSim("earth", "pathfinder", 0, 200000, {
        thermalMaterial: "calibrated",
      }),
    /calibration observations/,
  );
  for (const craft of EXPLORERS) {
    const active = new ExplorationSim("earth", "pathfinder", 0, 200000, {
        thermalMaterial: "calibrated",
        thermalCalibration: calibration,
      }),
      world = new FleetWorld(active),
      guest = world.create(craft.id);
    assert.notEqual(guest.sim.thermalCalibration, active.thermalCalibration);
    assert.notEqual(
      guest.sim.thermalCalibration.records,
      active.thermalCalibration.records,
    );
    const restored = FleetWorld.restore(world.serialize());
    assert.equal(restored.entries[1].sim.physics.thermalMaterial, "calibrated");
    assert.equal(restored.entries[1].sim.thermalCalibration.records.length, 12);
    assert.ok(restored.advance(0.05) > 0);
  }
});

test("collision switches stay consistent with rotational contact mode", () => {
  const { FleetWorld } = require("../src/sim/advanced/fleetWorld");
  const world = new FleetWorld();
  world.setRigidContacts(true);
  assert.equal(world.collisions, true);
  assert.equal(world.active.rigidEnabled, true);
  world.setCollisions(false);
  assert.equal(world.rigidContacts, false);
  assert.equal(world.active.rigidEnabled, false);
  assert.equal(world.collisions, false);
});

test("jettisoning a fairing-only vehicle ends cleanly with finite navigation", () => {
  const { FlightSim } = require("../src/sim/flight"),
    { MISSIONS } = require("../src/sim/missions"),
    { DEFAULT_PROFILE } = require("../src/sim/guidance");
  const sim = new FlightSim({
    design: {
      name: "Fairing only",
      stack: [{ uid: "fairing", partId: "fairing_37" }],
      radials: [],
    },
    mission: MISSIONS[0],
    profile: DEFAULT_PROFILE,
    guidanceOn: false,
  });
  sim.launch();
  sim.stage();
  sim.advance(0.1);
  assert.equal(sim.status, "crashed");
  assert.match(sim.endReason, /structure/);
  assert.equal(sim.nav.mass, 0);
  assert.equal(sim.nav.accel, 0);
  assert.ok([...sim.r, ...sim.v].every(Number.isFinite));
});
