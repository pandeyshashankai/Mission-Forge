require('./register.cjs');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const {
  ExplorationSim,
  EXPLORERS,
  FLIGHT_MODES
} = require('../src/sim/exploration');
const {
  BODIES
} = require('../src/sim/solarSystem');
const {
  add,
  scale,
  cross,
  len
} = require('../src/sim/vec');
const flags = ['j2', 'relativity', 'damage', 'advancedTides', 'oceanTides', 'tides', 'thirdBody', 'srp', 'power', 'communications', 'drag', 'rcs', 'rigid'];
const bodies = BODIES.filter(b => b.parent),
  report = {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    flags,
    bodies: bodies.map(b => b.id),
    craft: EXPLORERS.map(c => c.id),
    groups: {},
    failures: []
  };
const limit = process.argv.includes('--sample') ? 16 : 2 ** flags.length;
function check(group, label, fn) {
  const g = report.groups[group] ??= {
    cases: 0,
    passed: 0,
    failed: 0
  };
  g.cases++;
  try {
    fn();
    g.passed++;
  } catch (e) {
    g.failed++;
    if (report.failures.length < 100) report.failures.push({
      group,
      label,
      error: e.stack
    });
  }
}
function finite(sim) {
  assert.ok([...sim.r, ...sim.v, sim.t, sim.fuel, sim.batteryWh, sim.damage.temperature, ...sim.rigid.q, ...sim.rigid.L].every(Number.isFinite));
  assert.ok(sim.fuel >= 0 && sim.fuel <= sim.craft.fuel);
  assert.ok(sim.batteryWh >= 0);
}
const {
  FleetWorld
} = require('../src/sim/advanced/fleetWorld');
const {
  calibrateThermal
} = require('../src/sim/advanced/materials');
const records = Array.from({
  length: 12
}, (_, i) => {
  const temperature = 300 + 20 * i,
    rate = .2 + .02 * i;
  return {
    temperature,
    rate,
    flux: (180000 * rate + .8 * 5.670374419e-8 * 8 * (temperature ** 4 - 300 ** 4)) / 8
  };
});
const calibration = calibrateThermal(records, {
  source: 'Synthetic all-world fleet fixture; not measured spacecraft data'
});
for (const body of bodies) for (const host of EXPLORERS) for (const guest of EXPLORERS) for (const rigid of [false, true]) for (const strict of [false, true]) for (const collisions of [false, true]) for (const thermalMaterial of ['baseline', 'aluminium', 'pica-virgin', 'avcoat-virgin', 'avcoat-char', 'calibrated']) check('world x craft pair x docking/collision switches x material', `${body.id}/${host.id}/${guest.id}/${rigid}/${strict}/${collisions}/${thermalMaterial}`, () => {
  const a = new ExplorationSim(body.id, host.id, 0, undefined, {
      thermalMaterial,
      thermalCalibration: thermalMaterial === 'calibrated' ? calibration : undefined
    }),
    world = new FleetWorld(a),
    entry = world.create(guest.id),
    b = entry.sim;
  world.setRigidContacts(rigid);
  world.strictDocking = strict;
  world.collisions = collisions;
  a.rcsEnabled = b.rcsEnabled = false;
  a.heldDirection = [1, 0, 0];
  b.heldDirection = [-1, 0, 0];
  if (rigid) {
    a.rigid.q = [0, 0, 0, 1];
    b.rigid.q = [1, 0, 0, 0];
  }
  b.r = add(a.r, scale(rigid ? [0, 1, 0] : [1, 0, 0], 6));
  b.v = [...a.v];
  a.fuel -= 50;
  b.fuel -= 50;
  const fuel = a.fuel + b.fuel;
  world.dock(entry.id);
  assert.equal(world.links.length, 1);
  world.transferFuel(entry.id, 10);
  world.transferFuel(entry.id, -10);
  assert.ok(Math.abs(a.fuel + b.fuel - fuel) < 1e-8);
  const restored = FleetWorld.restore(world.serialize());
  assert.equal(restored.links.length, 1);
  assert.equal(restored.active.primary, body.id);
  world.undock();
  assert.equal(world.links.length, 0);
  finite(a);
  finite(b);
});
console.log('Completed all-world fleet/material/contact matrix');
for (const body of bodies) for (const craft of EXPLORERS) for (const integrator of ['rk4', 'accurate']) {
  for (let mask = 0; mask < limit; mask++) check('all 13 binary switches x worlds x craft x integrators', `${body.id}/${craft.id}/${integrator}/${mask}`, () => {
    const values = Object.fromEntries(flags.map((f, i) => [f, !!(mask & 1 << i)]));
    const sim = new ExplorationSim(body.id, craft.id, 0, undefined, {
      ...values,
      integrator
    });
    sim.rcsEnabled = values.rcs;
    sim.rigidEnabled = values.rigid;
    sim.throttle = .3;
    assert.ok(sim.advance(.02) > 0);
    finite(sim);
    const saved = sim.serialize(),
      loaded = ExplorationSim.restore(saved);
    for (const flag of flags.slice(0, 10)) assert.equal(loaded.physics[flag], values[flag]);
    assert.equal(loaded.dragEnabled, values.drag);
    assert.equal(loaded.rcsEnabled, values.rcs);
    assert.equal(loaded.rigidEnabled, values.rigid);
    assert.equal(loaded.throttle, 0);
    assert.equal(loaded.primary, body.id);
    assert.deepEqual(loaded.r, saved.r);
    assert.deepEqual(loaded.v, saved.v);
    assert.ok(loaded.advance(.02) > 0);
    finite(loaded);
  });
  console.log(`Completed switches: ${body.id}/${craft.id}/${integrator}`);
}
for (const body of bodies) for (const craft of EXPLORERS) for (const mode of FLIGHT_MODES) for (const rcs of [false, true]) for (const rigid of [false, true]) for (const drag of [false, true]) for (const throttle of [0, .5, 1]) for (const empty of [false, true]) check('attitude x thrust x empty tank x drag x RCS x rotation', `${body.id}/${craft.id}/${mode}/${rcs}/${rigid}/${drag}/${throttle}/${empty}`, () => {
  const sim = new ExplorationSim(body.id, craft.id);
  sim.mode = mode;
  sim.rcsEnabled = rcs;
  sim.rigidEnabled = rigid;
  sim.dragEnabled = drag;
  sim.pitch = 12;
  sim.yaw = -8;
  sim.throttle = throttle;
  if (empty) sim.fuel = 0;
  const fuel = sim.fuel;
  sim.advance(.1);
  finite(sim);
  assert.ok(sim.fuel <= fuel);
  if (empty) assert.equal(sim.fuel, 0);
  const options = {
    ...sim.physics,
    damage: true,
    power: true,
    communications: true,
    thirdBody: true,
    srp: true
  };
  sim.setPhysics(options);
  sim.advance(.1);
  finite(sim);
  sim.setPhysics({
    ...options,
    damage: false,
    power: false,
    communications: false,
    thirdBody: false,
    srp: false
  });
  sim.advance(.1);
  finite(sim);
});
for (const body of bodies) for (const craft of EXPLORERS) for (const speed of [1, 200]) check('surface landing or impact x world x craft', `${body.id}/${craft.id}/${speed}`, () => {
  const sim = new ExplorationSim(body.id, craft.id),
    base = sim.state(body.id, 0),
    r = [body.radius + .01, 0, 0];
  sim.r = add(base.r, r);
  const spin = cross([0, 0, body.rotation ? 2 * Math.PI / body.rotation : 0], r);
  sim.v = add(base.v, add(spin, [-speed, 0, 0]));
  sim.dragEnabled = false;
  sim.advance(.1);
  finite(sim);
  assert.equal(sim.status, !body.gas && speed === 1 ? 'landed' : 'crashed');
  assert.equal(sim.throttle, 0);
  assert.equal(sim.advance(1), 0);
});
for (const craft of EXPLORERS) check('Sun cannot be selected as a planetary starting orbit', craft.id, () => assert.throws(() => new ExplorationSim('sun', craft.id), /planet or moon/));
report.finishedAt = new Date().toISOString();
report.sample = limit !== 2 ** flags.length;
report.total = Object.values(report.groups).reduce((n, g) => n + g.cases, 0);
report.failed = Object.values(report.groups).reduce((n, g) => n + g.failed, 0);
report.status = report.failed ? 'FAIL' : 'PASS';
report.limits = 'Finite short-step and state-transition matrix. Does not establish long-duration accuracy or exhaust continuous trajectories, custom content, materials and all numerical settings jointly.';
const output = path.resolve(require('./audit-output.cjs'), 'scenario-audit-results.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  status: report.status,
  total: report.total,
  groups: report.groups,
  failures: report.failures.slice(0, 5)
}));
if (report.failed) process.exitCode = 1;
