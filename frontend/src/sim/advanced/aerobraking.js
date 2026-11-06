import { ExplorationSim } from "../exploration";
import { len, add, scale, norm } from "../vec";
import { densityAt } from "./forces";
import { propellantForDeltaV } from "../orbitPlanning";
export function predictAerobrake(
  sim,
  periAltitude,
  { sampleSeconds = 1, stepBudget = 100000 } = {},
) {
  if (
    !Number.isFinite(sampleSeconds) ||
    sampleSeconds < 0.25 ||
    sampleSeconds > 5 ||
    !Number.isInteger(stepBudget) ||
    stepBudget < 300 ||
    stepBudget > 200000
  )
    throw Error("Invalid atmospheric preview sampling limits");
  const start = sim.navigation(),
    b = start.body;
  if (
    !b.atmosphere ||
    sim.status !== "flying" ||
    !Number.isFinite(periAltitude) ||
    periAltitude <= 0 ||
    periAltitude >= b.atmosphere.top ||
    periAltitude >= start.altitude
  )
    throw Error(
      "Choose a periapsis above the surface and inside the atmosphere, below the current orbit.",
    );
  if (Math.abs(start.vertical) > 5)
    throw Error("Plan near an apsis with radial speed below 5 m/s.");
  const clone = ExplorationSim.restore(sim.serialize());
  clone.craft = { ...sim.craft };
  clone.dragEnabled = true;
  clone.physics = {
    ...clone.physics,
    damage: false,
    relativity: false,
    j2: false,
    harmonicDegree: 0,
    tides: false,
    thirdBody: false,
    srp: false,
    power: false,
    communications: false,
  };
  clone.throttle = 0;
  const r = len(start.r),
    speed = Math.sqrt(b.mu * (2 / r - 2 / (r + b.radius + periAltitude))),
    deltaV = speed - start.speed;
  const fuel = propellantForDeltaV(
    sim.craft.dryMass + sim.fuel,
    sim.craft.isp,
    Math.abs(deltaV),
  );
  if (fuel > sim.fuel)
    throw Error("Not enough fuel for the hypothetical entry setup burn.");
  clone.v = add(clone.state(b.id, clone.t).v, scale(norm(start.v), speed));
  clone.fuel -= fuel;
  const initialEnergy = clone.navigation().el.energy,
    horizon = Math.min(21600, (clone.navigation().el.period || 21600) * 1.1),
    end = clone.t + horizon;
  let minAltitude = start.altitude,
    maxQ = 0,
    entered = false,
    iterations = 0,
    steps = 0;
  while (
    clone.t < end &&
    clone.status === "flying" &&
    iterations++ < 20000 &&
    steps < stepBudget
  ) {
    const current = clone.navigation();
    const interval = current.altitude < b.atmosphere.top ? sampleSeconds : 120;
    const advanced = clone.advance(
      Math.min(interval, end - clone.t),
      Math.min(300, stepBudget - steps),
    );
    steps += clone.lastStepCount || 0;
    if (!(advanced > 0)) break;
    const n = clone.navigation();
    minAltitude = Math.min(minAltitude, n.altitude);
    maxQ = Math.max(
      maxQ,
      0.5 *
        densityAt(b, n.altitude, {
          r: n.r,
          t: clone.t,
          options: clone.physics,
        }) *
        n.surfaceSpeed ** 2,
    );
    if (n.altitude < b.atmosphere.top) entered = true;
    if (entered && n.altitude > b.atmosphere.top && n.vertical > 0) break;
  }
  const last = clone.navigation();
  return {
    bodyId: b.id,
    startTime: sim.t,
    setupDeltaV: deltaV,
    setupFuel: fuel,
    minimumAltitude: minAltitude,
    maxQ,
    elapsed: clone.t - sim.t,
    status: clone.status,
    entered,
    apoapsis: last.el.apoapsis,
    periapsis: last.el.periapsis,
    energyChange: last.el.energy - initialEnergy,
    sampleSeconds,
    steps,
    limited: clone.t >= end || iterations >= 20000 || steps >= stepBudget,
  };
}
export function entryMetrics(sim) {
  const n = sim.navigation(),
    rho = densityAt(n.body, n.altitude, {
      r: n.r,
      t: sim.t,
      options: sim.physics,
    }),
    q = 0.5 * rho * n.surfaceSpeed ** 2;
  return {
    q,
    rho,
    flightPathAngle:
      (Math.asin(Math.max(-1, Math.min(1, n.vertical / Math.max(1, n.speed)))) *
        180) /
      Math.PI,
    heatProxy:
      n.body.id === "earth"
        ? 1.83e-4 * Math.sqrt(Math.max(0, rho)) * n.surfaceSpeed ** 3
        : null,
  };
}
