require("../scripts/register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { ExplorationSim, primaryAt } = require("../src/sim/exploration");
const {
  BODIES,
  BODY_BY_ID,
  bodyState,
  DAY,
} = require("../src/sim/solarSystem");
const { len, sub, add, scale, norm } = require("../src/sim/vec");

test("all eight planets and three moons have finite, time-dependent ephemerides", () => {
  assert.equal(BODIES.length, 12);
  for (const b of BODIES.filter((b) => b.parent)) {
    const a = bodyState(b.id, 0),
      c = bodyState(b.id, DAY);
    assert.ok([...a.r, ...a.v, ...c.r, ...c.v].every(Number.isFinite));
    assert.ok(len(sub(a.r, c.r)) > 1);
  }
});
for (const id of BODIES.filter((b) => b.parent).map((b) => b.id))
  test(`starting ${id} orbit remains bound during a full period`, () => {
    const sim = new ExplorationSim(id);
    const n = sim.navigation();
    const period = n.el.period;
    let elapsed = 0;
    while (elapsed < period) {
      const dt = sim.advance(Math.min(10000, period - elapsed));
      assert.ok(dt > 0);
      elapsed += dt;
    }
    const after = sim.navigation();
    assert.equal(sim.status, "flying");
    assert.equal(sim.primary, id);
    assert.ok(
      Math.abs(after.altitude - n.altitude) < Math.max(10, n.altitude * 0.002),
    );
    assert.equal(sim.fuel, sim.craft.fuel);
  });
test("prograde finite burn raises apoapsis and consumes the expected fuel", () => {
  const sim = new ExplorationSim();
  const before = sim.navigation();
  sim.throttle = 0.5;
  const initial = sim.fuel;
  for (let i = 0; i < 20; i++) sim.advance(1);
  const expected = ((sim.craft.thrust * 0.5) / (9.80665 * sim.craft.isp)) * 20;
  assert.ok(Math.abs(initial - sim.fuel - expected) < 0.001);
  assert.ok(sim.navigation().el.apoapsis > before.el.apoapsis + 10000);
  assert.ok(sim.navigation().deltaV < before.deltaV);
});
test("retrograde burn lowers periapsis", () => {
  const sim = new ExplorationSim("moon");
  const before = sim.navigation();
  sim.mode = "retrograde";
  sim.throttle = 0.1;
  for (let i = 0; i < 10; i++) sim.advance(1);
  assert.ok(sim.navigation().el.periapsis < before.el.periapsis - 1000);
});
test("time warp cannot multiply a powered burn", () => {
  const sim = new ExplorationSim();
  sim.throttle = 1;
  assert.ok(sim.advance(1e6) <= 1.000001);
  assert.ok(sim.fuel >= 0);
});
test("fuel depletion cuts engine and never provides negative fuel", () => {
  const sim = new ExplorationSim();
  sim.fuel = 0.01;
  sim.throttle = 1;
  sim.advance(1);
  assert.equal(sim.fuel, 0);
  assert.equal(sim.throttle, 0);
  assert.match(sim.log.at(-1).text, /depleted/);
});
test("heliocentric escape transfers the governing frame continuously", () => {
  const sim = new ExplorationSim("earth");
  const base = bodyState("earth", sim.t);
  sim.r = add(base.r, [1.1e9, 0, 0]);
  sim.v = add(base.v, [4000, 0, 0]);
  sim.advance(1);
  assert.equal(sim.primary, "sun");
  assert.ok(sim.visited.includes("sun"));
});
test("surface crossing registers impact instead of tunnelling at high warp", () => {
  const sim = new ExplorationSim("moon");
  const base = bodyState("moon", 0);
  sim.r = add(base.r, [BODY_BY_ID.moon.radius + 100, 0, 0]);
  sim.v = add(base.v, [-1000, 0, 0]);
  sim.advance(100000);
  assert.equal(sim.status, "crashed");
  assert.ok(sim.t < 1);
});
test("slow airless descent registers touchdown", () => {
  const sim = new ExplorationSim("moon");
  const base = bodyState("moon", 0);
  const radius = BODY_BY_ID.moon.radius;
  sim.r = add(base.r, [radius + 0.01, 0, 0]);
  sim.v = add(base.v, [
    -1,
    ((2 * Math.PI) / BODY_BY_ID.moon.rotation) * radius,
    0,
  ]);
  sim.advance(0.1);
  assert.equal(sim.status, "landed");
});
test("save roundtrip preserves orbit and restores with engines off", () => {
  const sim = new ExplorationSim("mars", "voyager");
  sim.throttle = 0.2;
  sim.advance(1);
  const saved = JSON.parse(JSON.stringify(sim.serialize()));
  const restored = ExplorationSim.restore(saved);
  assert.deepEqual(restored.r, sim.r);
  assert.equal(restored.fuel, sim.fuel);
  assert.equal(restored.throttle, 0);
  assert.equal(restored.primary, "mars");
});
test("malformed, impossible and unknown saves are rejected", () => {
  for (const mutate of [
    (s) => (s.r[0] = null),
    (s) => (s.fuel = -10),
    (s) => (s.primary = "pluto"),
    (s) => (s.craftId = "missing"),
    (s) => (s.t = -1),
    (s) => (s.mode = "invalid"),
  ]) {
    const s = new ExplorationSim().serialize();
    mutate(s);
    assert.throws(() => ExplorationSim.restore(s));
  }
});
