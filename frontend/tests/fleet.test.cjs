require("../scripts/register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { PRESETS } = require("../src/sim/presets");
const { MISSIONS, getMission } = require("../src/sim/missions");
const { DEFAULT_PROFILE } = require("../src/sim/guidance");
const { runAutopilotFlight } = require("../src/sim/flight");
const { runReadiness } = require("../src/sim/readiness");
const { ExplorationSim, EXPLORERS } = require("../src/sim/exploration");
const { BODIES } = require("../src/sim/solarSystem");
const { storage, isValidDesign } = require("../src/sim/storage");
const { designHistory } = require("../src/game/history");

for (const m of MISSIONS)
  test(`recommended ${m.name} rocket is launchable from preflight`, () => {
    const id = m.preset || (m.payload ? "orbiter9eo" : "orbiter9");
    const p = PRESETS.find((p) => p.id === id);
    const r = runReadiness(p.make(), m, "amateur");
    assert.notEqual(
      r.overall,
      "NO-GO",
      r.checks
        .filter((c) => c.status === "fail")
        .map((c) => c.summary)
        .join("; "),
    );
  });
for (const p of PRESETS)
  test(`${p.label.split(" — ")[0]} validates and behaves according to its role`, () => {
    const m = getMission(
      p.id === "lunar_orbiter"
        ? "lunar_orbiter"
        : p.id === "crewed_flyby"
          ? "crewed_lunar_flyby"
          : p.id === "orbiter9eo"
            ? "earth_observer"
            : "first_orbit",
    );
    const d = p.make();
    assert.ok(isValidDesign(d));
    const review = runReadiness(d, m, "amateur");
    if (p.id === "empty") {
      assert.equal(review.overall, "NO-GO");
      assert.equal(review.stats.liftoffTWR, 0);
      return;
    }
    const sim = runAutopilotFlight(d, m, {
      ...DEFAULT_PROFILE,
      targetAltitude: m.target.parkingAltitude ?? m.target.altitude,
      targetInclination: m.target.inclination,
    });
    assert.equal(sim.status, "orbit");
    assert.ok(sim.guidance.done);
    assert.ok(sim.nav.el.periapsis > 140000);
    assert.equal(sim.prematureStaging.length, 0);
    assert.ok([...sim.r, ...sim.v].every(Number.isFinite));
  });
for (const craft of EXPLORERS)
  for (const b of BODIES.filter((b) => b.parent))
    test(`${craft.name} flies, burns and restores at ${b.name}`, () => {
      const sim = new ExplorationSim(b.id, craft.id);
      const initial = sim.navigation();
      sim.advance(120);
      assert.equal(sim.primary, b.id);
      assert.equal(sim.status, "flying");
      sim.throttle = 0.25;
      for (let i = 0; i < 8; i++) sim.advance(1);
      assert.ok(sim.fuel < craft.fuel);
      assert.ok(sim.navigation().el.apoapsis > initial.el.apoapsis);
      const restored = ExplorationSim.restore(
        JSON.parse(JSON.stringify(sim.serialize())),
      );
      assert.equal(restored.primary, b.id);
      assert.equal(restored.fuel, sim.fuel);
      assert.equal(restored.throttle, 0);
      assert.deepEqual(restored.r, sim.r);
    });
const values = new Map();
global.localStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => values.set(k, v),
  removeItem: (k) => values.delete(k),
};
test("display preferences have safe defaults and preserve known choices", () => {
  values.clear();
  assert.equal(storage.settings().theme, "orbital");
  storage.saveSettings({
    theme: "daylight",
    graphics: "low",
    textSize: "large",
    reduceMotion: true,
  });
  assert.equal(storage.settings().theme, "daylight");
  assert.equal(storage.settings().textSize, "large");
  assert.equal(storage.settings().reduceMotion, true);
  values.set(
    "mf.settings",
    JSON.stringify({ theme: "invalid", graphics: "broken" }),
  );
  assert.equal(storage.settings().theme, "orbital");
  assert.equal(storage.settings().graphics, "auto");
});
test("corrupt saved-list shapes do not crash the main menu", () => {
  values.clear();
  values.set("mf.designs", "{}");
  values.set("mf.checkpoints", "null");
  assert.deepEqual(storage.designs(), []);
  assert.deepEqual(storage.checkpoints(), []);
});
test("undo history is pure when React invokes the reducer twice", () => {
  const a = { name: "A" },
    b = { name: "B" },
    state = { present: a, past: [], future: [] };
  const action = { type: "set", next: b, record: true };
  const first = designHistory(state, action),
    second = designHistory(state, action);
  assert.deepEqual(first, second);
  assert.deepEqual(state, { present: a, past: [], future: [] });
  assert.equal(first.past.length, 1);
  assert.equal(designHistory(first, { type: "undo" }).present, a);
});
test("redo and loading another rocket cannot leak old history", () => {
  const state = { present: { name: "A" }, past: [], future: [] };
  const changed = designHistory(state, {
    type: "set",
    next: { name: "B" },
    record: true,
  });
  const undone = designHistory(changed, { type: "undo" });
  assert.equal(designHistory(undone, { type: "redo" }).present.name, "B");
  const loaded = designHistory(undone, { type: "load", design: { name: "C" } });
  assert.equal(loaded.past.length, 0);
  assert.equal(loaded.future.length, 0);
});
