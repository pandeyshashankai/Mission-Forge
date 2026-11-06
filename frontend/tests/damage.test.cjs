require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  damageState,
  thermalStep,
  sweptContact,
  breakup,
} = require("../src/sim/advanced/damage");
const {
  de421State,
  ephemerisData,
} = require("../src/sim/advanced/ephemerides");
const { ExplorationSim } = require("../src/sim/exploration");
const { FleetWorld } = require("../src/sim/advanced/fleetWorld");
const { dockingGeometry } = require("../src/sim/advanced/docking");
test("thermal balance cools, heats, ablates and fails under sustained overload", () => {
  assert.ok(
    thermalStep({ ...damageState(), temperature: 800 }, 0, 0, 0, 10)
      .temperature < 800,
  );
  let s = { ...damageState(), temperature: 900 };
  s = thermalStep(s, 2e6, 0, 0, 10);
  assert.ok(s.shieldKg < 120);
  assert.ok(s.temperature < 1000);
  s = thermalStep({ ...damageState(), shieldKg: 0 }, 5e6, 2e5, 0, 100);
  assert.equal(s.integrity, 0);
  assert.throws(() => damageState({ temperature: NaN }));
});
test("swept collision catches tunnelling; paired fragments conserve mass and momentum", () => {
  assert.ok(
    sweptContact([-100, 0, 0], [100, 0, 0], [0, 0, 0], [0, 0, 0], 2).hit,
  );
  assert.ok(
    !sweptContact([-100, 5, 0], [100, 5, 0], [0, 0, 0], [0, 0, 0], 2).hit,
  );
  const fragments = breakup([1, 2, 3], [10, 20, 30], 800);
  assert.equal(
    fragments.reduce((s, f) => s + f.mass, 0),
    800,
  );
  for (let k = 0; k < 3; k++)
    assert.ok(
      Math.abs(
        fragments.reduce((s, f) => s + f.mass * f.v[k], 0) -
          800 * [10, 20, 30][k],
      ) < 1e-8,
    );
});
test("JPL DE421 Hermite states match independently sampled kernel midpoints within 2 m", () => {
  for (const c of ephemerisData.heldOut) {
    const actual = de421State(c.id, c.t);
    assert.ok(Math.hypot(...actual.r.map((x, i) => x - c.r[i])) < 2);
    assert.ok(Math.hypot(...actual.v.map((x, i) => x - c.v[i])) < 0.001);
  }
  assert.throws(() => de421State("earth", -1));
  assert.throws(() => de421State("earth", ephemerisData.end + 1));
});
test("ephemeris switch preserves local orbit and damage persists through saves", () => {
  const sim = new ExplorationSim();
  const n = sim.navigation();
  sim.setPhysics({ ...sim.physics, ephemeris: "de421", damage: true });
  assert.ok(Math.abs(sim.navigation().altitude - n.altitude) < 0.01);
  sim.advance(1);
  sim.damage.shieldKg = 100;
  const loaded = ExplorationSim.restore(sim.serialize());
  assert.equal(loaded.damage.shieldKg, 100);
  assert.equal(loaded.physics.ephemeris, "de421");
  assert.equal(loaded.dryMass, sim.craft.dryMass - 20);
  const edge = new ExplorationSim(
    "earth",
    "pathfinder",
    ephemerisData.end - 0.2,
    600000,
    { ephemeris: "de421" },
  );
  edge.advance(10);
  assert.ok(edge.t <= ephemerisData.end);
  assert.equal(edge.advance(10), 0);
  assert.throws(
    () =>
      sim.setPhysics({
        ...sim.physics,
        tides: true,
        advancedTides: true,
        tideLag: 600,
      }),
    /tidal lag/,
  );
});
test("geometric docking rejects misalignment and accepts opposed coincident ports", () => {
  const world = new FleetWorld(),
    b = world.create("pathfinder").sim,
    a = world.active;
  a.rcsEnabled = b.rcsEnabled = false;
  a.heldDirection = [1, 0, 0];
  b.heldDirection = [-1, 0, 0];
  b.r = [a.r[0] + 6, a.r[1], a.r[2]];
  b.v = [...a.v];
  world.strictDocking = true;
  assert.ok(dockingGeometry(a, b).ready);
  b.heldDirection = [1, 0, 0];
  assert.throws(() => world.dock(world.entries[1].id));
  b.heldDirection = [-1, 0, 0];
  world.dock(world.entries[1].id);
  assert.equal(world.links.length, 1);
});
test("degree-three tide is odd under opposite source and falls as source distance to fourth power", () => {
  const { degreeThreeTide } = require("../src/sim/advanced/harmonics"),
    r = [7e6, 1e6, 2e6],
    s = [3e8, 1e8, 0];
  const a = degreeThreeTide(r, s, 4.9e12, 6378137),
    b = degreeThreeTide(
      r,
      s.map((x) => -x),
      4.9e12,
      6378137,
    ),
    c = degreeThreeTide(
      r,
      s.map((x) => 2 * x),
      4.9e12,
      6378137,
    );
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(a[k] + b[k]) < 1e-20);
    assert.ok(Math.abs(a[k] - 16 * c[k]) < 1e-20);
  }
});
test("collision settings persist and a swept vessel collision causes actual loss", () => {
  const world = new FleetWorld(),
    entry = world.create("voyager");
  world.collisions = true;
  entry.sim.r = [...world.active.r];
  entry.sim.v = [...world.active.v];
  world.advance(0.1);
  assert.equal(world.active.status, "crashed");
  assert.equal(entry.sim.status, "crashed");
  assert.equal(world.active.debris.length, 8);
  const loaded = FleetWorld.restore(world.serialize());
  assert.equal(loaded.collisions, true);
  assert.equal(loaded.active.debris.length, 8);
});
test("actual atmospheric flight loses a vehicle under enabled thermal/pressure damage", () => {
  const sim = new ExplorationSim("earth", "pathfinder", 0, 200000, {
    damage: true,
  });
  const base = sim.state("earth", 0),
    R = sim.navigation().body.radius;
  sim.r = [base.r[0] + R + 20000, base.r[1], base.r[2]];
  sim.v = [base.v[0], base.v[1] + 7800, base.v[2]];
  for (let i = 0; i < 50 && sim.status === "flying"; i++) sim.advance(1);
  assert.equal(sim.status, "crashed");
  assert.equal(sim.debris.length, 8);
  assert.equal(sim.throttle, 0);
  assert.ok(sim.damage.absorbedJ > 0);
});
test("moving fragments can destroy a surviving spacecraft", () => {
  const world = new FleetWorld(),
    owner = world.create("voyager");
  owner.sim.status = "crashed";
  world.collisions = true;
  owner.sim.debris = [
    { r: [...world.active.r], v: [...world.active.v], mass: 10, radius: 0.5 },
  ];
  world.advance(0.1);
  assert.equal(world.active.status, "crashed");
});
