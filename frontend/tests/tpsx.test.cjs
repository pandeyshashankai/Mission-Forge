require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { tpsxData, tpsxMaterial } = require("../src/sim/advanced/tpsx");
const { thermalStep, damageState } = require("../src/sim/advanced/damage");
const { ExplorationSim } = require("../src/sim/exploration");
test("screenshot transcription preserves virgin/char values and uncertain source labels", () => {
  const p = tpsxData.materials.find((m) => m.id === "pica-virgin").properties;
  assert.equal(p.density.value, 236);
  assert.equal(p.density.uncertainty.value, 12);
  assert.equal(p.specificHeat.source, "unknown");
  assert.equal(p.conductivity.value, 0.305);
  assert.equal(
    tpsxData.materials.find((m) => m.id === "pica-char").properties.density
      .value,
    160,
  );
  assert.throws(() => tpsxMaterial("pica-char"));
});
test("AVCOAT effective ablation energy is SI and PICA missing recession data is not invented", () => {
  assert.equal(tpsxMaterial("avcoat-virgin").ablationEnergy, 23800000);
  assert.equal(tpsxMaterial("pica-virgin").ablationEnergy, null);
  assert.equal(tpsxMaterial("avcoat-char").ablationEnergy, null);
});
test("two-node conduction conserves thermal energy and radiation at equilibrium", () => {
  const m = tpsxMaterial("pica-virgin");
  const s = damageState({ temperature: 500, backTemperature: 300 });
  m.ambient = 500;
  const next = thermalStep(s, 0, 0, 0, 0.1, m);
  const change =
    m.heatCapacity * (next.temperature - 500) +
    m.backCapacity * (next.backTemperature - 300);
  const radiation =
    m.emissivity *
    5.670374419e-8 *
    m.area *
    (next.temperature ** 4 - 500 ** 4) *
    0.1;
  assert.ok(Math.abs(change + radiation) < 0.01);
  assert.ok(next.backTemperature > 300);
  assert.ok(next.temperature < 500);
});
test("heat transfer remains finite for a nearly exhausted shield and phase choices persist", () => {
  const next = thermalStep(
    damageState({ shieldKg: 0.001, temperature: 1000 }),
    1e5,
    0,
    0,
    0.1,
    tpsxMaterial("avcoat-virgin", 0.001),
  );
  assert.ok(
    Number.isFinite(next.temperature) && Number.isFinite(next.backTemperature),
  );
  const sim = new ExplorationSim("earth", "pathfinder", 0, 200000, {
    damage: true,
    thermalMaterial: "avcoat-virgin",
  });
  sim.advance(0.1);
  assert.equal(
    ExplorationSim.restore(sim.serialize()).physics.thermalMaterial,
    "avcoat-virgin",
  );
});
test("PICA has no implied ablation; AVCOAT uses the provided energy budget above assumed onset", () => {
  const a = thermalStep(
    damageState({ temperature: 900 }),
    2e6,
    0,
    0,
    1,
    tpsxMaterial("pica-virgin"),
  );
  const b = thermalStep(
    damageState({ temperature: 900 }),
    2e6,
    0,
    0,
    1,
    tpsxMaterial("avcoat-virgin"),
  );
  assert.equal(a.shieldKg, 120);
  assert.ok(b.shieldKg < 120);
});
