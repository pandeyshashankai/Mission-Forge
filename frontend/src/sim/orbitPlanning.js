import { G0 } from "./constants";
import { sphereOfInfluence } from "./solarSystem";

export function rocketDeltaV(isp, dryMass, fuelMass) {
  if (
    ![isp, dryMass, fuelMass].every(Number.isFinite) ||
    isp <= 0 ||
    dryMass <= 0 ||
    fuelMass < 0
  )
    throw new Error(
      "Use positive specific impulse and dry mass, with non-negative fuel.",
    );
  return G0 * isp * Math.log((dryMass + fuelMass) / dryMass);
}
export function propellantForDeltaV(mass, isp, deltaV) {
  if (
    ![mass, isp, deltaV].every(Number.isFinite) ||
    mass <= 0 ||
    isp <= 0 ||
    deltaV < 0
  )
    throw new Error(
      "Use a positive mass and Isp, and a non-negative velocity change.",
    );
  return mass * -Math.expm1(-deltaV / (G0 * isp));
}
export function hohmannTransfer(mu, r1, r2) {
  if (![mu, r1, r2].every(Number.isFinite) || Math.min(mu, r1, r2) <= 0)
    throw new Error(
      "Orbit radii and gravitational parameter must be positive.",
    );
  const a = (r1 + r2) / 2;
  const burn1 = Math.sqrt(mu * (2 / r1 - 1 / a)) - Math.sqrt(mu / r1);
  const burn2 = Math.sqrt(mu / r2) - Math.sqrt(mu * (2 / r2 - 1 / a));
  return {
    r1,
    r2,
    semiMajorAxis: a,
    burn1,
    burn2,
    totalDeltaV: Math.abs(burn1) + Math.abs(burn2),
    coastTime: Math.PI * Math.sqrt(a ** 3 / mu),
  };
}
export function planOrbitTransfer(sim, targetAltitude) {
  const nav = sim.navigation(),
    b = nav.body;
  if (sim.status !== "flying")
    throw new Error("Start from a flying spacecraft.");
  if (!(nav.el.e < 0.02))
    throw new Error(
      "Start in a nearly circular orbit (eccentricity below 0.02).",
    );
  if (
    !Number.isFinite(targetAltitude) ||
    targetAltitude < Math.max(20000, (b.atmosphere?.top || 0) + 20000)
  )
    throw new Error(
      "Choose an orbit above the dense atmosphere and surface margin.",
    );
  if (b.radius + targetAltitude >= sphereOfInfluence(b) * 0.8)
    throw new Error(
      "Target orbit must remain inside this world's sphere of influence.",
    );
  if (Math.abs(targetAltitude - nav.altitude) < 1000)
    throw new Error(
      "Choose a target at least 1 km from your current altitude.",
    );
  const plan = hohmannTransfer(
    b.mu,
    b.radius + nav.altitude,
    b.radius + targetAltitude,
  );
  const mass = sim.craft.dryMass + sim.fuel;
  const fuel = propellantForDeltaV(mass, sim.craft.isp, plan.totalDeltaV);
  if (fuel > sim.fuel * 0.98)
    throw new Error(
      "Not enough propellant with a 2% reserve for this transfer.",
    );
  const flow = sim.craft.thrust / (G0 * sim.craft.isp);
  const burn1Seconds =
    propellantForDeltaV(mass, sim.craft.isp, Math.abs(plan.burn1)) / flow;
  const burn2Seconds =
    (fuel - propellantForDeltaV(mass, sim.craft.isp, Math.abs(plan.burn1))) /
    flow;
  if (Math.max(burn1Seconds, burn2Seconds) > plan.coastTime * 0.05)
    throw new Error(
      "Burns are too long for this short-burn transfer approximation. Choose a smaller orbit change or a stronger craft.",
    );
  return {
    ...plan,
    bodyId: b.id,
    targetAltitude,
    fuel,
    burn1Seconds,
    burn2Seconds,
  };
}
