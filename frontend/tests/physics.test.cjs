require("../scripts/register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { FlightSim, runAutopilotFlight } = require("../src/sim/flight");
const { presetFalconLike, presetLunarOrbiter } = require("../src/sim/presets");
const { getMission } = require("../src/sim/missions");
const { DEFAULT_PROFILE } = require("../src/sim/guidance");
const { EARTH } = require("../src/sim/constants");
const { burnTime } = require("../src/sim/maneuver");
const { moonState, MOON, rk4 } = require("../src/sim/bodies");
const { add, scale, norm, dot, len, sub } = require("../src/sim/vec");
const { duplicatePart, removePart } = require("../src/game/designOps");
const make = () =>
  new FlightSim({
    design: presetFalconLike(),
    mission: getMission("first_orbit"),
    profile: DEFAULT_PROFILE,
  });

test("guided launch reaches target orbit with automatic staging", () => {
  const sim = runAutopilotFlight(
    presetFalconLike(),
    getMission("first_orbit"),
    DEFAULT_PROFILE,
  );
  assert.equal(sim.status, "orbit");
  assert.ok(sim.orbitAt);
  assert.ok(Math.abs(sim.nav.el.periapsis - 200000) < 25000);
  assert.ok(Math.abs(sim.nav.el.apoapsis - 200000) < 25000);
  assert.ok(sim.stagedAt.length >= 2);
  assert.equal(sim.prematureStaging.length, 0);
});
test("batched advance completes ascent without stalling at vacuum staging", () => {
  const sim = make();
  sim.launch();
  while (sim.t < 1500 && !sim.isEnded() && !(sim.orbitAt && sim.guidance.done))
    sim.advance(10);
  assert.ok(sim.orbitAt);
  assert.ok(sim.guidance.done);
  assert.ok(sim.nav.el.periapsis > 175000);
});
test("checkpoint restoration preserves deterministic motion", () => {
  const sim = make();
  sim.launch();
  sim.advance(25);
  const restored = make();
  restored.restore(sim.serialize());
  assert.equal(restored.digest(), sim.digest());
  sim.advance(10);
  restored.advance(10);
  assert.equal(restored.digest(), sim.digest());
});
test("lunar prograde and radial attitude modes use Moon-relative state", () => {
  const sim = new FlightSim({
    design: presetLunarOrbiter(),
    mission: getMission("lunar_orbiter"),
    profile: DEFAULT_PROFILE,
  });
  const moon = moonState(0, sim.eph);
  sim.r = add(moon.r, [MOON.radius + 100000, 0, 0]);
  sim.v = add(moon.v, [0, Math.sqrt(MOON.mu / (MOON.radius + 100000)), 0]);
  sim.nav = sim.computeNav();
  sim.setAttMode("prograde");
  assert.ok(dot(sim.targetDir(), [0, 1, 0]) > 0.99999);
  sim.setAttMode("radialOut");
  assert.ok(dot(sim.targetDir(), [1, 0, 0]) > 0.99999);
});
test("arming a maneuver hands control away from ascent guidance", () => {
  const sim = make();
  sim.launch();
  sim.advance(20);
  sim.planManeuver({ t: sim.t + 120, dv: [10, 0, 0] });
  assert.equal(sim.guidance.disengaged, true);
});
test("burn-time estimate rejects an impossible burn", () => {
  const sim = make();
  assert.equal(burnTime(sim, 1e8), null);
});
test("fuel exhaustion reports a failed maneuver with its residual", () => {
  const sim = make();
  sim.rt.sections.forEach((s) => {
    for (const p in s.tanks) s.tanks[p] = 0;
  });
  sim.rt.radials.forEach((r) => (r.fuel = 0));
  sim.rt.eventIndex = sim.rt.events.length;
  sim.planManeuver({ t: sim.t, dv: [100, 0, 0] });
  sim.maneuver.phase = "burn";
  sim.maneuver.update(sim, sim.computeNav());
  assert.equal(sim.maneuver.failed, true);
  assert.equal(sim.log.at(-1).type, "fail");
});
test("RK4 conserves two-body orbital energy over ten orbits", () => {
  const r0 = EARTH.radius + 400000,
    period = 2 * Math.PI * Math.sqrt(r0 ** 3 / EARTH.mu);
  let r = [r0, 0, 0],
    v = [0, Math.sqrt(EARTH.mu / r0), 0];
  const energy = (r, v) => len(v) ** 2 / 2 - EARTH.mu / len(r);
  const initial = energy(r, v);
  const count = Math.ceil((period * 10) / 10),
    dt = (period * 10) / count;
  for (let i = 0; i < count; i++)
    ({ r, v } = rk4(r, v, i * dt, dt, null, false));
  assert.ok(Math.abs((energy(r, v) - initial) / initial) < 1e-7);
});
test("duplicating creates a unique part and resets custom staging", () => {
  const d = presetFalconLike();
  d.events = ["custom"];
  const result = duplicatePart(d, d.stack[3].uid);
  assert.equal(result.design.stack.length, d.stack.length + 1);
  assert.notEqual(result.uid, d.stack[3].uid);
  assert.equal(result.design.events, null);
  assert.equal(d.stack.length, 11);
});
test("deleting the last stack part cannot leave an invalid empty design", () => {
  const d = {
    name: "Probe",
    stack: [{ uid: "probe", partId: "probe_core" }],
    radials: [],
  };
  assert.equal(removePart(d, "probe"), d);
});

test("Aster-M methane booster completes a guided launch", () => {
  const { presetMethalox } = require("../src/sim/presets");
  const sim = runAutopilotFlight(
    presetMethalox(),
    getMission("first_orbit"),
    DEFAULT_PROFILE,
  );
  assert.equal(sim.status, "orbit");
  assert.ok(Math.abs(sim.nav.el.periapsis - 200000) < 25000);
  assert.ok(Math.abs(sim.nav.el.apoapsis - 200000) < 25000);
});
