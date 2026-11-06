import { ExplorationSim } from "../exploration";
import { BODY_BY_ID } from "../solarSystem";
import { len, sub } from "../vec";
export function predictEncounter(initial, targetId, hours, cargoMass = 0) {
  const target = BODY_BY_ID[targetId];
  if (!target || !Number.isFinite(hours) || hours <= 0 || hours > 720)
    throw Error("Choose a target and 0–720 hour coast horizon.");
  if (!Number.isFinite(cargoMass) || cargoMass < 0 || cargoMass > 200000)
    throw Error("Invalid forecast cargo mass");
  const sim = ExplorationSim.restore(initial);
  sim.craft = { ...sim.craft, dryMass: sim.craft.dryMass + cargoMass };
  sim.throttle = 0;
  let budget = 20000,
    closest = null,
    previousBody = sim.primary;
  const samples = [],
    transitions = [],
    start = sim.t,
    end = start + hours * 3600;
  while (sim.t < end && sim.status === "flying" && budget > 0) {
    const state = sim.state(targetId, sim.t),
      distance = len(sub(sim.r, state.r)),
      relativeSpeed = len(sub(sim.v, state.v));
    const sample = {
      seconds: sim.t - start,
      distance,
      altitude: distance - target.radius,
      relativeSpeed,
    };
    samples.push(sample);
    if (!closest || distance < closest.distance) closest = sample;
    if (sim.primary !== previousBody) {
      transitions.push({
        seconds: sim.t - start,
        from: previousBody,
        to: sim.primary,
      });
      previousBody = sim.primary;
    }
    const advanced = sim.advance(
      Math.min(1800, end - sim.t),
      Math.min(100, budget),
    );
    budget -= sim.lastStepCount || 1;
    if (!(advanced > 0)) break;
  }
  const targetAtEnd = sim.state(targetId, sim.t),
    final = {
      seconds: sim.t - start,
      distance: len(sub(sim.r, targetAtEnd.r)),
      altitude: len(sub(sim.r, targetAtEnd.r)) - target.radius,
      relativeSpeed: len(sub(sim.v, targetAtEnd.v)),
    };
  samples.push(final);
  if (!closest || final.distance < closest.distance) closest = final;
  return {
    targetId,
    start,
    closest,
    samples,
    transitions,
    elapsed: sim.t - start,
    limited: sim.t < end && sim.status === "flying",
    status: sim.status,
    notice:
      "Coast-only sampled prediction; finite time/work horizon and approximate source ephemerides. Closest sample is not an exact event solution.",
  };
}
