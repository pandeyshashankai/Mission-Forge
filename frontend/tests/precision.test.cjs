require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { add, sub, scale, len, dot } = require("../src/sim/vec");
const { BODY_BY_ID, bodyState, AU } = require("../src/sim/solarSystem");
const {
  visibleDiskFraction,
  apparentEclipse,
} = require("../src/sim/advanced/eclipse");
const {
  illumination,
  eclipseStepLimit,
  forceOptions,
  centralGravity,
  relativisticAcceleration,
  dragAcceleration,
} = require("../src/sim/advanced/forces");
const { adaptiveStep } = require("../src/sim/advanced/integrator");
const { ExplorationSim } = require("../src/sim/exploration");
const { FleetWorld } = require("../src/sim/advanced/fleetWorld");
const { lambert } = require("../src/sim/advanced/lambert");
const {
  validatePrecisionForces,
  validateRelativisticTrajectories,
} = require("../src/science/precisionValidation");
const { predictAerobrake } = require("../src/sim/advanced/aerobraking");

test("finite solar disks resolve full light, umbra, annular and partial eclipses continuously", () => {
  assert.equal(visibleDiskFraction(1, 2, 4), 1);
  assert.equal(visibleDiskFraction(1, 2, 0), 0);
  assert.equal(visibleDiskFraction(1, 0.5, 0), 0.75);
  assert.ok(
    Math.abs(
      visibleDiskFraction(1, 1, 1) -
        (1 - ((2 * Math.PI) / 3 - Math.sqrt(3) / 2) / Math.PI),
    ) < 1e-14,
  );
  let previous = 0;
  for (let i = 0; i <= 2000; i++) {
    const f = visibleDiskFraction(0.00465, 0.8, 0.79535 + (i * 0.0093) / 2000);
    assert.ok(f >= 0 && f <= 1 && f >= previous - 1e-9);
    previous = f;
  }
  assert.ok(previous > 0.99999);
  assert.throws(() => visibleDiskFraction(0, 1, 1));
  assert.throws(() => visibleDiskFraction(1, -1, 1));
});
test("all 27 finite-Sun cases and five relativistic forces match independent Orekit runs", () => {
  const r = validatePrecisionForces();
  assert.equal(r.eclipses.length, 27);
  assert.equal(r.forces.length, 5);
  assert.ok(r.pass, JSON.stringify(r));
});
test("Earth and Mercury-like relativistic trajectories match Orekit over three periods", () => {
  const r = validateRelativisticTrajectories();
  assert.equal(r.length, 2);
  assert.ok(
    r.every((c) => c.pass),
    JSON.stringify(r),
  );
});
test("physical Sun/Earth geometry gives both eclipse contacts, gradual sunlight and a bounded step", () => {
  const earth = bodyState("earth", 0),
    sun = bodyState("sun", 0),
    direction = scale(sub(earth.r, sun.r), 1 / len(sub(earth.r, sun.r)));
  const tangent = [-direction[1], direction[0], 0],
    radius = BODY_BY_ID.earth.radius;
  const fractions = [];
  for (let y = radius - 100000; y <= radius + 100000; y += 1000) {
    const position = add(
      earth.r,
      add(scale(direction, 7e6), scale(tangent, y)),
    );
    const f = illumination(position, 0, "earth");
    fractions.push(f);
    if (f > 0 && f < 1) {
      const limit = eclipseStepLimit(
        position,
        add(earth.v, scale(tangent, 7000)),
        0,
        "earth",
      );
      assert.ok(limit >= 0.1 && limit < 10);
    }
  }
  assert.ok(
    fractions.includes(0) &&
      fractions.includes(1) &&
      fractions.some((f) => f > 0 && f < 1),
  );
  assert.ok(fractions.every((f, i) => i === 0 || f >= fractions[i - 1] - 1e-8));
  const behind = apparentEclipse(
    [0, 0, 0],
    [AU, 0, 0],
    7e8,
    [2 * AU, 0, 0],
    1e6,
  );
  assert.equal(behind.fraction, 1);
});
test("1PN option survives save/load and applied-control replay with power enabled", () => {
  const {
    beginRecording,
    controlState,
    controlHash,
  } = require("../src/sim/advanced/controlRecording");
  const { replayControls } = require("../src/sim/advanced/controlReplay");
  const sim = new ExplorationSim("earth", "pathfinder", 0, 600000, {
    relativity: true,
    power: true,
    srp: true,
    integrator: "accurate",
  });
  const record = beginRecording(sim);
  for (let i = 0; i < 4; i++) sim.advance(30);
  record.active = false;
  record.hash = controlHash(controlState(sim));
  record.reference = controlState(sim);
  assert.equal(
    ExplorationSim.restore(sim.serialize()).physics.relativity,
    true,
  );
  assert.ok(replayControls(record).pass);
  assert.throws(
    () => replayControls({ ...record, physicsRevision: 1 }),
    /physics revision/,
  );
  assert.throws(() => forceOptions({ relativity: 1 }));
});

test("48 local and interplanetary Lambert transfers reach their propagated endpoints", () => {
  const mu = BODY_BY_ID.earth.mu,
    radius = 8e6,
    timeUnit = Math.sqrt(radius ** 3 / mu);
  for (const angle of [30, 90, 150, 210, 270, 330])
    for (const duration of [1, 3, 6])
      for (const ratio of [1, 1.5]) {
        const radians = (angle * Math.PI) / 180,
          r1 = [radius, 0, 0],
          r2 = [
            radius * ratio * Math.cos(radians),
            radius * ratio * Math.sin(radians),
            0,
          ];
        const solution = lambert(r1, r2, duration * timeUnit, mu);
        const propagated = adaptiveStep(
          r1,
          solution.departureVelocity,
          0,
          duration * timeUnit,
          (r) => centralGravity(r, mu),
          {
            relativeTolerance: 1e-12,
            positionTolerance: 1e-5,
            velocityTolerance: 1e-8,
            maxEvaluations: 100000,
          },
        );
        assert.ok(
          len(sub(propagated.r, r2)) < 0.1,
          `${angle}/${duration}/${ratio}: ${len(sub(propagated.r, r2))}`,
        );
        assert.ok(len(sub(propagated.v, solution.arrivalVelocity)) < 1e-4);
      }
  for (const target of ["venus", "mars", "jupiter"])
    for (const departure of [0, 180 * 86400])
      for (const durationScale of [0.8, 1.2]) {
        const mu = BODY_BY_ID.sun.mu,
          r1 = bodyState("earth", departure).r;
        const a = (BODY_BY_ID.earth.a + BODY_BY_ID[target].a) / 2;
        const seconds = Math.PI * Math.sqrt(a ** 3 / mu) * durationScale;
        const r2 = bodyState(target, departure + seconds).r;
        const solution = lambert(r1, r2, seconds, mu);
        const propagated = adaptiveStep(
          r1,
          solution.departureVelocity,
          departure,
          seconds,
          (r) => centralGravity(r, mu),
          {
            relativeTolerance: 1e-12,
            positionTolerance: 0.001,
            velocityTolerance: 1e-8,
            maxEvaluations: 100000,
          },
        );
        assert.ok(
          len(sub(propagated.r, r2)) < 2000,
          `${target}: heliocentric arrival error ${len(sub(propagated.r, r2))}`,
        );
        assert.ok(len(sub(propagated.v, solution.arrivalVelocity)) < 0.001);
      }
});
test("rotating-atmosphere drag dissipates relative kinetic energy across altitude and velocity directions", () => {
  for (const id of ["earth", "mars", "venus", "titan"]) {
    const b = BODY_BY_ID[id];
    for (const altitude of [1000, 20000, 60000])
      for (const v of [
        [7000, 0, 0],
        [0, 7000, 1000],
        [0, -7000, -1000],
      ]) {
        const r = [b.radius + altitude, 0, 0],
          omega = (2 * Math.PI) / b.rotation,
          rel = sub(v, [0, omega * r[0], 0]);
        assert.ok(dot(dragAcceleration(r, v, b, 5000), rel) <= 0);
      }
  }
});
test("Earth and Mars atmospheric-pass ensembles converge with finer pressure sampling and preserve the live vessel", () => {
  for (const [body, peris] of [
    ["earth", [70000, 90000, 110000]],
    ["mars", [30000, 50000, 70000]],
  ])
    for (const integrator of ["rk4", "accurate"]) {
      const sim = new ExplorationSim(body, "pathfinder", 0, 200000, {
        integrator,
      });
      const before = sim.serialize();
      for (const peri of peris) {
        const a = predictAerobrake(sim, peri),
          b = predictAerobrake(sim, peri, { sampleSeconds: 0.5 });
        assert.ok(a.entered && b.entered, `${body}/${peri}`);
        assert.equal(a.status, b.status);
        assert.ok(a.maxQ > 0 && b.maxQ > 0);
        assert.ok(
          Math.abs(a.maxQ - b.maxQ) / Math.max(a.maxQ, b.maxQ) < 0.02,
          `${body}/${peri}: pressure convergence`,
        );
        assert.ok(Math.abs(a.minimumAltitude - b.minimumAltitude) < 100);
        assert.ok(a.energyChange < 0 && b.energyChange < 0);
        assert.ok(
          !a.limited && !b.limited,
          `${body}/${peri}: incomplete prediction`,
        );
      }
      assert.deepEqual(sim.serialize(), before);
    }
});
test("six-vessel mixed-craft fleet coasts synchronize and repeated docking fuel cycles conserve propellant", () => {
  const world = new FleetWorld();
  for (let i = 0; i < 5; i++) world.create(i % 2 ? "voyager" : "pathfinder");
  for (let i = 0; i < 10; i++) world.advance(600);
  assert.ok(
    world.entries.every((e) => Math.abs(e.sim.t - world.active.t) < 1e-7),
  );
  const target = world.entries[1],
    a = world.active,
    b = target.sim;
  b.r = add(a.r, [10, 0, 0]);
  b.v = [...a.v];
  const total = world.entries.reduce((s, e) => s + e.sim.fuel, 0);
  a.fuel -= 100;
  b.fuel -= 100;
  for (let i = 0; i < 20; i++) {
    b.r = add(a.r, [10, 0, 0]);
    b.v = [...a.v];
    world.dock(target.id);
    world.transferFuel(target.id, 50);
    world.transferFuel(target.id, -50);
    world.undock();
  }
  assert.ok(
    Math.abs(
      world.entries.reduce((s, e) => s + e.sim.fuel, 0) - (total - 200),
    ) < 1e-8,
  );
  const restored = FleetWorld.restore(world.serialize());
  assert.equal(restored.entries.length, 6);
});

test("high-warp penumbra power integration converges with small requested steps", () => {
  const earth = bodyState("earth", 0),
    radial = scale(earth.r, 1 / len(earth.r)),
    tangent = [-radial[1], radial[0], 0];
  const relative = add(
    scale(radial, 7e6),
    scale(tangent, BODY_BY_ID.earth.radius),
  );
  const velocity = scale(
    [-relative[1], relative[0], 0],
    Math.sqrt(BODY_BY_ID.earth.mu / len(relative)) / len(relative),
  );
  const coarse = new ExplorationSim("earth", "pathfinder", 0, 600000, {
    power: true,
    srp: true,
    integrator: "accurate",
  });
  coarse.r = add(earth.r, relative);
  coarse.v = add(earth.v, velocity);
  coarse.batteryWh = 600;
  const fine = ExplorationSim.restore(coarse.serialize());
  const initial = coarse.resources().lit;
  assert.ok(initial > 0 && initial < 1);
  while (coarse.t < 120 - 1e-8) coarse.advance(120 - coarse.t);
  while (fine.t < 120 - 1e-8) fine.advance(Math.min(0.2, 120 - fine.t));
  assert.ok(Math.abs(coarse.batteryWh - fine.batteryWh) < 0.02);
  assert.ok(len(sub(coarse.r, fine.r)) < 0.1);
  assert.equal(coarse.resources().lit, 1);
});
test("planet and moon fleets retain independent primary frames during synchronized coasts", () => {
  const world = new FleetWorld(),
    guest = world.create("voyager");
  guest.sim = new ExplorationSim("moon", "voyager", 0, 100000, {
    integrator: "accurate",
    relativity: true,
  });
  const before = world.serialize();
  for (let i = 0; i < 5; i++) world.advance(600);
  assert.equal(guest.sim.primary, "moon");
  assert.equal(world.active.primary, "earth");
  assert.ok(Math.abs(guest.sim.t - world.active.t) < 1e-7);
  const roundtrip = FleetWorld.restore(world.serialize());
  assert.equal(roundtrip.entries[1].sim.primary, "moon");
  assert.ok(
    world.entries.every(
      (entry, i) => len(sub(entry.sim.r, before.entries[i].state.r)) > 100,
    ),
  );
});
test("atmospheric forecast reports work truncation and rejects unbounded sampling inputs", () => {
  const sim = new ExplorationSim("earth", "pathfinder", 0, 200000);
  const result = predictAerobrake(sim, 70000, { stepBudget: 300 });
  assert.equal(result.limited, true);
  assert.ok(result.steps <= 300);
  assert.throws(() => predictAerobrake(sim, 70000, { sampleSeconds: 0 }));
  assert.throws(() => predictAerobrake(sim, 70000, { stepBudget: Infinity }));
});
