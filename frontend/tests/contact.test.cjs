require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  rigidState,
  boxContact,
  resolveContact,
  kineticEnergy,
  spin,
  angularVelocity,
} = require("../src/sim/advanced/rigidBody");
const body = (r, v, mass = 100) => ({ ...rigidState(), r, v, mass });
test("elastic head-on hull impulse conserves momentum and kinetic energy", () => {
  const a = body([0, 0, 0], [1, 0, 0]),
    b = body([2.9, 0, 0], [-1, 0, 0]);
  const e = kineticEnergy(a) + kineticEnergy(b);
  resolveContact(a, b, boxContact(a, b), { restitution: 1, friction: 0 });
  assert.ok(Math.abs(a.v[0] + 1) < 1e-10);
  assert.ok(Math.abs(b.v[0] - 1) < 1e-10);
  assert.ok(Math.abs(kineticEnergy(a) + kineticEnergy(b) - e) < 1e-8);
});
test("off-centre friction contact transfers spin and dissipates energy", () => {
  const a = body([0, 0, 0], [2, 1, 0]),
    b = body([2.9, 1, 0], [0, 0, 0], 200);
  const e = kineticEnergy(a) + kineticEnergy(b);
  resolveContact(a, b, boxContact(a, b));
  assert.ok(Math.hypot(...a.L) > 0);
  assert.ok(kineticEnergy(a) + kineticEnergy(b) <= e + 1e-8);
  for (let i = 0; i < 3; i++)
    assert.ok(Math.abs(a.v[i] * 100 + b.v[i] * 200 - [200, 100, 0][i]) < 1e-8);
});
test("torque-free orientation preserves angular momentum, quaternion norm and bounded energy", () => {
  const b = body([0, 0, 0], [0, 0, 0]);
  b.L = [100, 200, 300];
  const e = kineticEnergy(b);
  for (let i = 0; i < 100; i++) spin(b, 0.1);
  assert.deepEqual(b.L, [100, 200, 300]);
  assert.ok(Math.abs(Math.hypot(...b.q) - 1) < 1e-12);
  assert.ok(Math.abs(kineticEnergy(b) / e - 1) < 1e-5);
  assert.ok(Math.hypot(...angularVelocity(b)) > 0);
});
test("oriented-box separation and invalid rotational saves are rejected", () => {
  assert.equal(
    boxContact(body([0, 0, 0], [0, 0, 0]), body([30, 0, 0], [0, 0, 0])),
    null,
  );
  assert.throws(() => rigidState({ q: [0, 0, 0, 0] }));
  assert.throws(() => rigidState({ L: [Infinity, 0, 0] }));
});
test("ocean coefficient variations match three actual Orekit wave evaluations", () => {
  const { oceanCoefficients } = require("../src/sim/advanced/oceanTides"),
    ref = require("../src/science/data/ocean-reference.json");
  for (const sample of ref.samples) {
    const terms = oceanCoefficients(sample.seconds);
    for (const expected of sample.terms) {
      const actual = terms.find(
        (t) => t.n === expected.n && t.m === expected.m,
      );
      assert.ok(
        Math.abs(actual.c - expected.c) < 1e-17,
        JSON.stringify({ actual, expected }),
      );
      assert.ok(Math.abs(actual.s - expected.s) < 1e-17);
    }
  }
});
test("published aluminium thermodynamic fit produces physical temperature-dependent heat capacity", () => {
  const { aluminiumCp } = require("../src/sim/advanced/materials");
  assert.ok(aluminiumCp(300) > 850 && aluminiumCp(300) < 950);
  assert.ok(aluminiumCp(900) > aluminiumCp(300));
  assert.throws(() => aluminiumCp(1000));
});
test("thermal inverse fit recovers known parameters, withholds observations and rejects unidentifiable data", () => {
  const { calibrateThermal } = require("../src/sim/advanced/materials");
  const records = Array.from({ length: 20 }, (_, i) => {
    const temperature = 300 + 20 * i,
      rate = 0.1 + 0.02 * i,
      flux =
        (180000 * rate +
          0.75 * 5.670374419e-8 * 8 * (temperature ** 4 - 300 ** 4)) /
        8;
    return { temperature, rate, flux };
  });
  const p = calibrateThermal(records, {
    source: "Synthetic analytic fixture; not experimental calibration",
  });
  assert.ok(Math.abs(p.heatCapacity / 180000 - 1) < 1e-10);
  assert.ok(Math.abs(p.emissivity - 0.75) < 1e-10);
  assert.equal(p.heldoutCount, 5);
  assert.throws(() =>
    calibrateThermal(Array(10).fill({ temperature: 300, rate: 0, flux: 0 }), {
      source: "Degenerate test",
    }),
  );
});
test("rigid fleet contact and rotational saves integrate without destroying a slow-touching pair", () => {
  const { FleetWorld } = require("../src/sim/advanced/fleetWorld"),
    { ExplorationSim } = require("../src/sim/exploration");
  const world = new FleetWorld(),
    b = world.create("pathfinder").sim,
    a = world.active;
  b.r = [a.r[0] + 2.9, a.r[1], a.r[2]];
  b.v = [...a.v];
  a.rcsEnabled = b.rcsEnabled = false;
  world.setRigidContacts(true);
  world.advance(0.01);
  assert.equal(a.status, "flying");
  assert.equal(b.status, "flying");
  assert.ok(a.rigidEnabled);
  const loaded = FleetWorld.restore(world.serialize());
  assert.equal(loaded.rigidContacts, true);
  assert.ok(loaded.active.rigidEnabled);
  assert.ok(
    ExplorationSim.restore(a.serialize()).rigid.q.every(Number.isFinite),
  );
});
test("thermal calibration round-trips through a vessel save by refitting retained observations", () => {
  const { calibrateThermal } = require("../src/sim/advanced/materials"),
    { ExplorationSim } = require("../src/sim/exploration");
  const sim = new ExplorationSim(),
    records = Array.from({ length: 12 }, (_, i) => {
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
  sim.thermalCalibration = calibrateThermal(records, {
    source: "Synthetic save fixture; not measured hardware",
  });
  sim.setPhysics({ ...sim.physics, thermalMaterial: "calibrated" });
  const loaded = ExplorationSim.restore(sim.serialize());
  assert.ok(Math.abs(loaded.thermalCalibration.emissivity - 0.8) < 1e-9);
  assert.equal(loaded.thermalCalibration.records.length, 12);
});
