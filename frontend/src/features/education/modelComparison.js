import { NASA_DATA } from "../../science/catalog";
import { ExplorationSim } from "../../sim/exploration";
import { BODY_BY_ID } from "../../sim/solarSystem";
import { add, sub } from "../../sim/vec";
export const COMPARISON_MODELS = {
  central: {},
  j2: { j2: true },
  thirdBody: { thirdBody: true },
  relativity: { relativity: true },
  combined: {
    harmonicDegree: 8,
    thirdBody: true,
    srp: true,
    tides: true,
    oceanTides: true,
  },
};
export async function compareModels(
  {
    model = "j2",
    horizon = 3600,
    integrator = "accurate",
    altitude = 600000,
    inclination = 55,
  },
  yieldTask = () => Promise.resolve(),
) {
  if (
    !Object.prototype.hasOwnProperty.call(COMPARISON_MODELS, model) ||
    !Number.isFinite(horizon) ||
    horizon < 60 ||
    horizon > 21600 ||
    !["rk4", "accurate"].includes(integrator) ||
    !Number.isFinite(altitude) ||
    altitude < 200000 ||
    altitude > 2000000 ||
    !Number.isFinite(inclination) ||
    inclination < 0 ||
    inclination > 180
  )
    throw Error(
      "Use a supported model, 60–21,600 s horizon, 200–2,000 km altitude and 0–180° inclination.",
    );
  const options = { integrator },
    a = new ExplorationSim("earth", "pathfinder", 0, altitude, options);
  a.dragEnabled = false;
  const base = a.state("earth", 0),
    speed = Math.sqrt(
      BODY_BY_ID.earth.mu / (BODY_BY_ID.earth.radius + altitude),
    ),
    angle = (inclination * Math.PI) / 180;
  a.v = add(base.v, [0, speed * Math.cos(angle), speed * Math.sin(angle)]);
  const initial = a.serialize(),
    b = ExplorationSim.restore(initial);
  b.setPhysics({ ...options, ...COMPARISON_MODELS[model] });
  b.dragEnabled = false;
  const rows = [],
    start = Date.now();
  let steps = 0;
  for (let i = 0; i <= 120; i++) {
    const target = (horizon * i) / 120;
    for (const sim of [a, b])
      while (sim.t < target - 1e-8) {
        const advanced = sim.advance(target - sim.t);
        steps += sim.lastStepCount || 0;
        if (!(advanced > 0) || steps > 100000 || Date.now() - start > 15000)
          throw Error(
            "Comparison exceeded its bounded compute budget. Reduce the horizon.",
          );
      }
    if (Math.abs(a.t - b.t) > 1e-7)
      throw Error("Trajectory sample times did not align.");
    const delta = sub(b.r, a.r),
      relative = sub(a.r, a.state("earth", a.t).r),
      other = sub(b.r, b.state("earth", b.t).r);
    rows.push({
      t: target,
      basicTime: a.t,
      advancedTime: b.t,
      differenceMetres: Math.hypot(...delta),
      basic: relative,
      advanced: other,
    });
    if (i % 8 === 0) await yieldTask();
  }
  return {
    version: 1,
    kind: "missionforge-model-comparison",
    body: "earth",
    sourceCommit: NASA_DATA.commit,
    earth: { mu: BODY_BY_ID.earth.mu, radius: BODY_BY_ID.earth.radius },
    epoch: "J2000 game origin; simplified time/orientation",
    model,
    horizon,
    integrator,
    altitude,
    inclination,
    initial,
    baseForces: { central: true, drag: false },
    advancedForces: COMPARISON_MODELS[model],
    basicPhysics: a.physics,
    advancedPhysics: b.physics,
    maxTimeOffsetSeconds: Math.max(
      ...rows.map((r) => Math.abs(r.basicTime - r.advancedTime)),
    ),
    maxDifferenceMetres: Math.max(...rows.map((r) => r.differenceMetres)),
    rows,
    limits:
      "Identical initial state and integrator, unpowered Earth coast. Differences combine selected model effects and numerical error; this is not measured flight validation.",
  };
}
