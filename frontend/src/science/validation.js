import { nasaDensity } from "./atmospheres";
import { hohmannTransfer, rocketDeltaV } from "../sim/orbitPlanning";
import benchmarks from "./data/benchmarks.json";
import { circularSpeed, escapeSpeed, orbitalPeriod } from "../sim/orbit";
import { ExplorationSim } from "../sim/exploration";
import { BODY_BY_ID } from "../sim/solarSystem";
import { len, sub } from "../sim/vec";

const relative = (observed, expected) =>
  Math.abs((observed - expected) / expected);
export function runScienceValidation() {
  return benchmarks.cases.map((reference) => {
    const body = BODY_BY_ID[reference.body],
      r = body.radius + reference.altitude;
    const analytic = [
      [
        "Circular speed",
        circularSpeed(body.mu, r),
        Number(reference.speed),
        "m/s",
      ],
      [
        "Escape speed",
        escapeSpeed(body.mu, r),
        Number(reference.escape),
        "m/s",
      ],
      [
        "Orbital period",
        orbitalPeriod(body.mu, r),
        Number(reference.period),
        "s",
      ],
    ].map(([name, actual, expected, unit]) => ({
      name,
      actual,
      expected,
      unit,
      error: relative(actual, expected),
      tolerance: 1e-10,
      pass: relative(actual, expected) <= 1e-10,
    }));
    const sim = new ExplorationSim(
      body.id,
      "pathfinder",
      0,
      reference.altitude,
      { drag: false },
    );
    const first = sim.navigation();
    const energy = (nav) => len(nav.v) ** 2 / 2 - body.mu / len(nav.r);
    const initialEnergy = energy(first),
      period = Number(reference.period);
    let remaining = period,
      steps = 0;
    while (remaining > 1e-7 && steps < 10000) {
      const advanced = sim.advance(Math.min(remaining, period / 360));
      if (!(advanced > 0)) break;
      remaining -= advanced;
      steps++;
    }
    const last = sim.navigation();
    const closure = len(sub(last.r, first.r)) / r;
    const energyError = relative(energy(last), initialEnergy);
    const integrationPass =
      remaining < 1e-6 &&
      sim.primary === body.id &&
      sim.status === "flying" &&
      closure < 0.002 &&
      energyError < 0.0002;
    return {
      body: body.id,
      name: body.name,
      altitude: reference.altitude,
      analytic,
      integration: { closure, energyError, steps, pass: integrationPass },
      pass: analytic.every((row) => row.pass) && integrationPass,
    };
  });
}
export { benchmarks };

export function runEngineeringValidation() {
  const ref = benchmarks.engineering,
    earth = BODY_BY_ID.earth;
  const plan = hohmannTransfer(
    earth.mu,
    earth.radius + ref.transfer.fromAltitude,
    earth.radius + ref.transfer.toAltitude,
  );
  const rows = [
    ...benchmarks.atmosphere.map((row) => [
      `${row.body} density at ${row.altitude / 1000} km`,
      nasaDensity(row.body, row.altitude),
      Number(row.density),
      "kg/m³",
    ]),
    [
      "Ideal rocket velocity change",
      rocketDeltaV(ref.rocket.isp, ref.rocket.dryMass, ref.rocket.fuelMass),
      Number(ref.rocket.deltaV),
      "m/s",
    ],
    ["Hohmann burn 1", plan.burn1, Number(ref.transfer.burn1), "m/s"],
    ["Hohmann burn 2", plan.burn2, Number(ref.transfer.burn2), "m/s"],
    ["Hohmann coast time", plan.coastTime, Number(ref.transfer.coastTime), "s"],
  ];
  return rows.map(([name, actual, expected, unit]) => ({
    name,
    actual,
    expected,
    unit,
    error: relative(actual, expected),
    pass: relative(actual, expected) < 1e-10,
    tolerance: 1e-10,
  }));
}
