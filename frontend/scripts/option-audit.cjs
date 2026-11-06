require("./register.cjs");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url");
const { ExplorationSim, EXPLORERS } = require("../src/sim/exploration"),
  { BODIES } = require("../src/sim/solarSystem");
const report = { date: "2026-11-05", groups: {}, failures: [] };
const check = (group, label, fn) => {
  const g = (report.groups[group] ??= { cases: 0, passed: 0, failed: 0 });
  g.cases++;
  try {
    fn();
    g.passed++;
  } catch (e) {
    g.failed++;
    report.failures.push({ group, label, error: e.stack });
  }
};
function exercise(sim) {
  const fuel = sim.fuel;
  assert.ok(sim.advance(0.05) > 0);
  assert.ok([...sim.r, ...sim.v, sim.t, sim.batteryWh].every(Number.isFinite));
  assert.ok(sim.fuel >= 0 && sim.fuel <= fuel);
  const saved = sim.serialize(),
    loaded = ExplorationSim.restore(saved);
  assert.equal(loaded.throttle, 0);
  assert.deepEqual(loaded.physics, sim.physics);
  assert.ok(loaded.advance(0.05) > 0);
  assert.ok([...loaded.r, ...loaded.v].every(Number.isFinite));
}
(async () => {
  const factory = (
    await import(
      pathToFileURL(
        path.resolve(
          __dirname,
          "../public/science/models/nrlmsise-browser.mjs",
        ),
      ).href
    )
  ).default;
  require("../src/sim/advanced/weatherAtmosphere").initializeWeatherModel(
    await factory(),
  );
  const flags = [
    "j2",
    "relativity",
    "damage",
    "advancedTides",
    "oceanTides",
    "tides",
    "thirdBody",
    "srp",
    "power",
    "communications",
  ];
  for (let mask = 0; mask < 2 ** flags.length; mask++)
    for (const integrator of ["rk4", "accurate"])
      check(
        "all binary force/system combinations on Earth",
        mask + "/" + integrator,
        () => {
          const options = {
            integrator,
            ...Object.fromEntries(
              flags.map((key, i) => [key, !!(mask & (1 << i))]),
            ),
          };
          exercise(
            new ExplorationSim("earth", "pathfinder", 0, 600000, options),
          );
        },
      );
  for (const b of BODIES.filter((b) => b.parent))
    for (const craft of EXPLORERS)
      for (const integrator of ["rk4", "accurate"])
        for (const ephemeris of ["kepler", "de421"])
          for (const harmonicDegree of [0, 2, 4, 8])
            for (const thermalMaterial of [
              "baseline",
              "aluminium",
              "pica-virgin",
              "avcoat-virgin",
              "avcoat-char",
              "calibrated",
            ])
              for (const atmosphere of ["nasa", "msis"])
                check(
                  "body craft integrator ephemeris harmonics thermal atmosphere",
                  `${b.id}/${craft.id}/${integrator}/${ephemeris}/${harmonicDegree}/${thermalMaterial}/${atmosphere}`,
                  () => {
                    const sim = new ExplorationSim(
                      b.id,
                      craft.id,
                      0,
                      undefined,
                      {
                        integrator,
                        ephemeris,
                        harmonicDegree,
                        thermalMaterial:
                          thermalMaterial === "calibrated"
                            ? "baseline"
                            : thermalMaterial,
                        atmosphere,
                        damage: true,
                        srp: true,
                        power: true,
                        thirdBody: true,
                        tides: true,
                        advancedTides: true,
                        oceanTides: true,
                      },
                    );
                    if (thermalMaterial === "calibrated") {
                      const {
                        calibrateThermal,
                      } = require("../src/sim/advanced/materials");
                      const records = Array.from({ length: 12 }, (_, i) => {
                        const temperature = 290 + i * 20,
                          rate = 0.2 + 0.01 * i;
                        return {
                          temperature,
                          rate,
                          flux:
                            (180000 * rate +
                              0.8 *
                                5.670374419e-8 *
                                8 *
                                (temperature ** 4 - 220 ** 4)) /
                            8,
                        };
                      });
                      sim.thermalCalibration = calibrateThermal(records, {
                        ambient: 220,
                        source:
                          "Synthetic option-audit fixture, not experimental material data",
                      });
                      sim.setPhysics({ ...sim.physics, thermalMaterial });
                    }
                    exercise(sim);
                  },
                );
  const { runThermalCase } = require("../src/sim/advanced/thermalBench");
  for (let caseIndex = 0; caseIndex < 6; caseIndex++)
    for (const wall of ["hot", "cold"])
      for (const material of ["pica-virgin", "avcoat-virgin", "avcoat-char"])
        for (const thickness of [0.005, 0.03, 0.15])
          for (const initialTemperature of [220, 290, 600])
            check(
              "thermal exposures wall phase thickness initial temperature",
              `${caseIndex}/${wall}/${material}/${thickness}/${initialTemperature}`,
              () => {
                const result = runThermalCase({
                  caseIndex,
                  wall,
                  material,
                  thickness,
                  initialTemperature,
                });
                assert.ok(
                  result.samples.every((s) =>
                    [s.temperature, s.backTemperature, s.shieldKg].every(
                      Number.isFinite,
                    ),
                  ),
                );
                assert.ok(
                  result.finalShieldKg <= result.initialShieldKg &&
                    result.finalShieldKg >= 0,
                );
                assert.ok(
                  result.modeledRecessionM >= 0 &&
                    result.modeledRecessionM <= thickness + 1e-9,
                );
              },
            );

  const { FleetWorld } = require("../src/sim/advanced/fleetWorld"),
    { calibrateThermal } = require("../src/sim/advanced/materials"),
    { add, sub, scale, len } = require("../src/sim/vec");
  const records = Array.from({ length: 12 }, (_, i) => {
      const temperature = 300 + 20 * i,
        rate = 0.2 + 0.02 * i;
      return {
        temperature,
        rate,
        flux:
          (180000 * rate +
            0.8 * 5.670374419e-8 * 8 * (temperature ** 4 - 300 ** 4)) /
          8,
      };
    }),
    calibration = calibrateThermal(records, {
      source: "Synthetic fleet matrix fixture, not measured spacecraft",
    });
  for (const host of EXPLORERS)
    for (const guest of EXPLORERS)
      for (const rigid of [false, true])
        for (const strict of [false, true])
          for (const collisions of [false, true])
            for (const thermalMaterial of [
              "baseline",
              "aluminium",
              "pica-virgin",
              "avcoat-virgin",
              "avcoat-char",
              "calibrated",
            ])
              check(
                "all craft-pair contact and material groups",
                `${host.id}/${guest.id}/${rigid}/${strict}/${collisions}/${thermalMaterial}`,
                () => {
                  const a = new ExplorationSim("earth", host.id, 0, 200000, {
                      thermalMaterial,
                      thermalCalibration:
                        thermalMaterial === "calibrated"
                          ? calibration
                          : undefined,
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
                  const mA = a.dryMass + a.fuel,
                    mB = b.dryMass + b.fuel,
                    momentum = add(scale(a.v, mA), scale(b.v, mB)),
                    fuel = a.fuel + b.fuel;
                  world.dock(entry.id);
                  assert.equal(world.links.length, 1);
                  world.transferFuel(entry.id, 10);
                  world.transferFuel(entry.id, -10);
                  assert.ok(Math.abs(a.fuel + b.fuel - fuel) < 1e-8);
                  const loaded = FleetWorld.restore(world.serialize());
                  assert.equal(loaded.links.length, 1);
                  assert.equal(loaded.rigidContacts, rigid);
                  world.undock();
                  assert.ok(
                    len(
                      sub(
                        add(
                          scale(a.v, a.dryMass + a.fuel),
                          scale(b.v, b.dryMass + b.fuel),
                        ),
                        momentum,
                      ),
                    ) < 0.001,
                  );
                  assert.ok(world.advance(0.01) > 0);
                  assert.ok(
                    world.entries.every((e) =>
                      [...e.sim.r, ...e.sim.v].every(Number.isFinite),
                    ),
                  );
                },
              );
  report.total = Object.values(report.groups).reduce((s, g) => s + g.cases, 0);
  report.passed = report.failures.length === 0;
  const output = "/tmp/mission-forge-option-audit.json";
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        total: report.total,
        groups: report.groups,
        failures: report.failures.slice(0, 10),
        report: output,
      },
      null,
      2,
    ),
  );
  if (!report.passed) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
