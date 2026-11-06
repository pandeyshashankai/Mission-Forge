require("../scripts/register.cjs");
const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  runThermalCase,
  thermalCSV,
} = require("../src/sim/advanced/thermalBench");
test("published hot/cold conditions remain distinct and produce the stated nominal exposure", () => {
  const h = runThermalCase(),
    c = runThermalCase({ wall: "cold" });
  assert.equal(h.nominalIncidentJm2, 1760000 * 33);
  assert.equal(c.nominalIncidentJm2, 2100000 * 33);
  assert.ok(c.maximumSurface > h.maximumSurface);
  assert.equal(h.kind, "nominal-arcjet-model-prediction");
});
test("all published exposures and available phases finish with finite bounded thermal state", () => {
  for (let caseIndex = 0; caseIndex < 6; caseIndex++)
    for (const material of ["pica-virgin", "avcoat-virgin", "avcoat-char"]) {
      const r = runThermalCase({ caseIndex, material });
      assert.ok(
        Math.abs(r.samples.at(-1).t - r.test.exposureSeconds - 30) < 1e-8,
      );
      assert.ok(
        r.samples.every(
          (s) =>
            Number.isFinite(s.temperature) &&
            Number.isFinite(s.backTemperature) &&
            s.shieldKg >= 0,
        ),
      );
      if (material !== "avcoat-virgin") assert.equal(r.modeledRecessionM, 0);
    }
});
test("thermal bench rejects unsupported geometry and exports explicit SI CSV", () => {
  assert.throws(() => runThermalCase({ thickness: 0 }));
  assert.throws(() => runThermalCase({ wall: "absorbed" }));
  assert.throws(() => runThermalCase({ material: "sla561v" }));
  assert.match(
    thermalCSV(runThermalCase()),
    /^time_s,surface_K,backing_K,shield_kg/,
  );
});
test("implicit thermal comparison converges under step refinement", () => {
  const a = runThermalCase(),
    b = runThermalCase({ step: 0.05 });
  assert.ok(Math.abs(a.maximumBacking - b.maximumBacking) < 5);
  assert.ok(
    Math.abs(a.maximumSurface - b.maximumSurface) / b.maximumSurface < 0.02,
  );
});
