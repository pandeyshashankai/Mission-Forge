require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { NASA_DATA } = require("../src/science/catalog");
const { nasaDensity } = require("../src/science/atmospheres");
const { atmosphere } = require("../src/sim/atmosphere");
const { BODIES, BODY_BY_ID } = require("../src/sim/solarSystem");
const { ExplorationSim, EXPLORERS } = require("../src/sim/exploration");
const {
  hohmannTransfer,
  rocketDeltaV,
  propellantForDeltaV,
  planOrbitTransfer,
} = require("../src/sim/orbitPlanning");
const { len, sub } = require("../src/sim/vec");
const fixtures = require("../src/science/data/benchmarks.json");
const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(
    Math.abs(actual - expected) <=
      Math.max(1e-15, Math.abs(expected) * tolerance),
    `${actual} vs ${expected}`,
  );
for (const world of ["earth", "mars"])
  test(`${world}: every imported density band is used with correct SI units and range`, () => {
    const model = NASA_DATA.atmospheres[world];
    assert.equal(model.bands.length, world === "earth" ? 28 : 150);
    for (const row of model.bands)
      close(nasaDensity(world, row.altitude), row.density);
    assert.equal(nasaDensity(world, model.maximumAltitude + 1), 0);
    assert.equal(nasaDensity(world, NaN), 0);
  });
test("inter-band atmospheric densities match independent Decimal references", () => {
  for (const row of fixtures.atmosphere)
    close(nasaDensity(row.body, row.altitude), Number(row.density));
});
test("scored upper atmosphere uses imported density and blends continuously at 86 km", () => {
  for (const h of [90000, 100000, 140000])
    close(atmosphere(h).rho, nasaDensity("earth", h));
  close(atmosphere(86000).rho, atmosphere(86000.00001).rho, 1e-7);
  assert.equal(atmosphere(160000).rho, 0);
});
test("all worlds use the signed NAIF linear rotation rates, including retrograde Venus/Uranus", () => {
  for (const body of BODIES)
    close(
      body.rotation,
      (86400 * 360) / NASA_DATA.bodies[body.id].rotationRateDegDay,
    );
  assert.ok(BODY_BY_ID.venus.rotation < 0);
  assert.ok(BODY_BY_ID.uranus.rotation < 0);
});
for (const [world, h] of [
  ["earth", 100000],
  ["mars", 60000],
])
  test(`${world}: imported atmospheric drag removes orbital energy compared with the same vacuum trajectory`, () => {
    const air = new ExplorationSim(world, "pathfinder", 0, h),
      vacuum = new ExplorationSim(world, "pathfinder", 0, h, { drag: false });
    const energy = (s) => {
      const n = s.navigation();
      return len(n.v) ** 2 / 2 - n.body.mu / len(n.r);
    };
    const initial = energy(air);
    air.advance(20);
    vacuum.advance(20);
    assert.ok(energy(air) < initial - 1);
    assert.ok(energy(air) < energy(vacuum) - 1);
    assert.equal(air.fuel, air.craft.fuel);
  });
test("two-burn and rocket-equation calculations match independent high-precision fixtures", () => {
  const r = fixtures.engineering.transfer,
    b = BODY_BY_ID.earth,
    p = hohmannTransfer(
      b.mu,
      b.radius + r.fromAltitude,
      b.radius + r.toAltitude,
    );
  for (const key of ["burn1", "burn2", "coastTime"])
    close(p[key], Number(r[key]));
  const q = fixtures.engineering.rocket;
  close(rocketDeltaV(q.isp, q.dryMass, q.fuelMass), Number(q.deltaV));
  close(
    propellantForDeltaV(q.dryMass + q.fuelMass, q.isp, Number(q.deltaV)),
    q.fuelMass,
  );
  assert.equal(rocketDeltaV(345, 1800, 0), 0);
  assert.throws(() => rocketDeltaV(0, 100, 100));
});
for (const body of BODIES.filter((b) => b.parent))
  for (const craft of EXPLORERS)
    for (const lower of [false, true])
      test(`${body.name}/${craft.name}: finite ${lower ? "lowering" : "raising"} transfer completes without placement or refuelling`, () => {
        const low = Math.max(200000, (body.atmosphere?.top || 0) + 100000),
          high = low + 200000,
          target = lower ? low : high;
        const sim = new ExplorationSim(
            body.id,
            craft.id,
            0,
            lower ? high : low,
          ),
          startFuel = sim.fuel,
          startR = [...sim.r], startV = [...sim.v];
        sim.startTransfer(target);
        assert.deepEqual(sim.r, startR);
        assert.deepEqual(sim.v, startV);
        const startTime = sim.t;
        sim.advance(0.1);
        assert.ok(sim.fuel < startFuel);
        assert.ok(len(sub(sim.r, startR)) > 0);
        let calls = 0,
          coasted = false;
        while (
          !["complete", "cancelled"].includes(sim.transfer.phase) &&
          calls++ < 10000
        ) {
          if (sim.transfer.phase === "ready") {
            const t = sim.t;
            assert.equal(sim.advance(10000), 0);
            assert.equal(sim.t, t);
            sim.circularizeTransfer();
            coasted = true;
          }
          sim.advance(sim.transfer.phase === "coast" ? 600 : 1);
        }
        const n = sim.navigation();
        assert.equal(sim.transfer.phase, "complete", JSON.stringify(sim.log));
        assert.ok(coasted);
        assert.equal(sim.primary, body.id);
        assert.equal(sim.status, "flying");
        assert.equal(sim.throttle, 0);
        assert.ok(sim.t - startTime > 100);
        assert.ok(
          Math.abs(n.el.apoapsis - target) < 1500,
          `${n.el.apoapsis} vs ${target}`,
        );
        assert.ok(
          Math.abs(n.el.periapsis - target) < 1500,
          `${n.el.periapsis} vs ${target}`,
        );
        assert.ok(sim.fuel > 0 && sim.fuel < startFuel);
      });
test("assistance cancels safely and restored saves never re-arm an active burn", () => {
  const sim = new ExplorationSim();
  sim.startTransfer(500000);
  sim.advance(1);
  sim.cancelTransfer("Manual steering");
  assert.equal(sim.transfer.phase, "cancelled");
  assert.equal(sim.throttle, 0);
  const restored = ExplorationSim.restore({
    ...sim.serialize(),
    transfer: { phase: "burn1", remaining: Infinity },
  });
  assert.equal(restored.transfer, null);
  assert.equal(restored.throttle, 0);
  assert.ok(restored.dragEnabled);
});
test("invalid targets, eccentric starts, insufficient fuel, and oversized transfers are rejected", () => {
  const s = new ExplorationSim();
  assert.throws(() => s.startTransfer(0));
  assert.throws(() => s.startTransfer(NaN));
  assert.throws(() => s.startTransfer(1e12));
  s.fuel = 1;
  assert.throws(() => s.startTransfer(1000000));
  const eccentric = new ExplorationSim();
  eccentric.v[0] += 1000;
  assert.throws(() => planOrbitTransfer(eccentric, 500000));
});
test("powered assisted flight remains at real-time speed under a high warp request", () => {
  const sim = new ExplorationSim();
  sim.startTransfer(500000);
  assert.ok(sim.advance(1e6) <= 1.000001);
  assert.ok(sim.transfer.remaining > 0);
});
